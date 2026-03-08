"""Codex CLI runner for repo-city-cycle.

Invokes the Codex binary as an external subprocess.  Captures stdout/stderr
and exit code.  Does not depend on any undocumented Codex internals.

Expected Codex CLI invocation:
    codex --full-auto [extra_args...] "<prompt>"

The wrapper treats Codex as a black box.  Even if Codex exits non-zero,
the wrapper continues and inspects git state to report honestly.
"""
from __future__ import annotations

import os
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclass
class CodexResult:
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float
    command: List[str]

    @property
    def succeeded(self) -> bool:
        return self.exit_code == 0

    def summary(self) -> str:
        status = "OK" if self.succeeded else f"FAILED (exit {self.exit_code})"
        return (
            f"Codex {status} in {self.duration_seconds:.1f}s\n"
            f"stdout ({len(self.stdout)} chars) | "
            f"stderr ({len(self.stderr)} chars)"
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_command(
    codex_bin: str,
    prompt: str,
    extra_args: List[str],
) -> List[str]:
    """Build the subprocess command list.

    Correct invocation: codex exec --full-auto [extra_args...] "<prompt>"
    """
    cmd = [codex_bin, "exec", "--full-auto"]
    if extra_args:
        cmd.extend(extra_args)
    cmd.append(prompt)
    return cmd


_HEARTBEAT_INTERVAL = 30  # seconds between "still running" log lines


def _run_codex(
    cmd: List[str],
    cwd: str,
    env: Optional[Dict[str, str]],
    timeout: int,
    log_fn: Optional[Callable[[str], None]] = None,
) -> CodexResult:
    """Execute *cmd* and return a CodexResult.

    When *log_fn* is provided (e.g. ``logger.info``), a background heartbeat
    thread emits a progress line every 30 s so the operator can see that
    Codex is still alive during long reviews.
    """
    effective_env = dict(os.environ)
    if env:
        effective_env.update(env)

    start = time.monotonic()

    # --- launch subprocess ---------------------------------------------------
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=effective_env,
        )
    except FileNotFoundError:
        duration = time.monotonic() - start
        return CodexResult(
            exit_code=127,
            stdout="",
            stderr=(
                f"Codex binary not found: {cmd[0]!r}\n"
                "Install it with: npm install -g @openai/codex\n"
                "or set REPO_CITY_CODEX_BIN to its full path."
            ),
            duration_seconds=duration,
            command=cmd,
        )
    except Exception as exc:  # noqa: BLE001
        duration = time.monotonic() - start
        return CodexResult(
            exit_code=-1,
            stdout="",
            stderr=f"Unexpected error running Codex: {exc}",
            duration_seconds=duration,
            command=cmd,
        )

    if log_fn:
        log_fn(f"  [codex] pid={proc.pid} started — timeout: {timeout}s")

    # --- background threads: drain stdout / stderr ---------------------------
    stdout_chunks: List[str] = []
    stderr_chunks: List[str] = []

    def _read_stdout() -> None:
        assert proc.stdout is not None
        for chunk in iter(lambda: proc.stdout.read(4096), ""):
            stdout_chunks.append(chunk)

    def _read_stderr() -> None:
        assert proc.stderr is not None
        for chunk in iter(lambda: proc.stderr.read(4096), ""):
            stderr_chunks.append(chunk)

    t_out = threading.Thread(target=_read_stdout, daemon=True)
    t_err = threading.Thread(target=_read_stderr, daemon=True)
    t_out.start()
    t_err.start()

    # --- heartbeat thread ----------------------------------------------------
    if log_fn:
        def _heartbeat() -> None:
            while proc.poll() is None:
                time.sleep(_HEARTBEAT_INTERVAL)
                if proc.poll() is not None:
                    break
                elapsed = time.monotonic() - start
                captured = sum(len(c) for c in stdout_chunks)
                log_fn(
                    f"  [codex] still running — {elapsed:.0f}s elapsed, "
                    f"{captured} stdout bytes captured"
                )

        threading.Thread(target=_heartbeat, daemon=True).start()

    # --- wait for completion -------------------------------------------------
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        t_out.join(timeout=5)
        t_err.join(timeout=5)
        duration = time.monotonic() - start
        return CodexResult(
            exit_code=-1,
            stdout="".join(stdout_chunks),
            stderr=f"Codex process timed out after {timeout}s.",
            duration_seconds=duration,
            command=cmd,
        )

    t_out.join(timeout=10)
    t_err.join(timeout=10)

    duration = time.monotonic() - start
    return CodexResult(
        exit_code=proc.returncode,
        stdout="".join(stdout_chunks),
        stderr="".join(stderr_chunks),
        duration_seconds=duration,
        command=cmd,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_codex(
    prompt: str,
    cwd: str,
    codex_bin: str = "codex",
    extra_args: Optional[List[str]] = None,
    env: Optional[Dict[str, str]] = None,
    timeout: int = 1800,
    log_fn: Optional[Callable[[str], None]] = None,
) -> CodexResult:
    """Run a full implementation cycle with Codex.

    Args:
        prompt:     The cycle prompt to pass to Codex.
        cwd:        Working directory (should be the repo root).
        codex_bin:  Path or name of the Codex binary.
        extra_args: Additional CLI flags (from REPO_CITY_CODEX_EXTRA_ARGS).
        env:        Extra environment variables to inject (secrets never logged).
        timeout:    Maximum seconds to wait before killing the process.
        log_fn:     Optional callable (e.g. logger.info) — receives heartbeat
                    progress lines every 30 s while Codex is running.

    Returns:
        A CodexResult with exit_code, stdout, stderr, and timing.
    """
    cmd = _build_command(codex_bin, prompt, extra_args or [])
    return _run_codex(cmd, cwd, env, timeout, log_fn=log_fn)


def run_codex_repair(
    prompt: str,
    cwd: str,
    codex_bin: str = "codex",
    extra_args: Optional[List[str]] = None,
    env: Optional[Dict[str, str]] = None,
    timeout: int = 900,
    log_fn: Optional[Callable[[str], None]] = None,
) -> CodexResult:
    """Run a focused repair pass with Codex.

    Same as run_codex but uses a shorter timeout and the repair prompt.
    The repair prompt must be generated externally (see openai_client.py).
    """
    cmd = _build_command(codex_bin, prompt, extra_args or [])
    return _run_codex(cmd, cwd, env, timeout, log_fn=log_fn)
