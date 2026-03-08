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
import time
from dataclasses import dataclass
from typing import Dict, List, Optional


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


def _run_codex(
    cmd: List[str],
    cwd: str,
    env: Optional[Dict[str, str]],
    timeout: int,
) -> CodexResult:
    """Execute *cmd* and return a CodexResult."""
    effective_env = dict(os.environ)
    if env:
        effective_env.update(env)

    start = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=effective_env,
        )
        duration = time.monotonic() - start
        return CodexResult(
            exit_code=proc.returncode,
            stdout=proc.stdout or "",
            stderr=proc.stderr or "",
            duration_seconds=duration,
            command=cmd,
        )
    except subprocess.TimeoutExpired:
        duration = time.monotonic() - start
        return CodexResult(
            exit_code=-1,
            stdout="",
            stderr=f"Codex process timed out after {timeout}s.",
            duration_seconds=duration,
            command=cmd,
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
) -> CodexResult:
    """Run a full implementation cycle with Codex.

    Args:
        prompt:     The cycle prompt to pass to Codex.
        cwd:        Working directory (should be the repo root).
        codex_bin:  Path or name of the Codex binary.
        extra_args: Additional CLI flags (from REPO_CITY_CODEX_EXTRA_ARGS).
        env:        Extra environment variables to inject (secrets never logged).
        timeout:    Maximum seconds to wait before killing the process.

    Returns:
        A CodexResult with exit_code, stdout, stderr, and timing.
    """
    cmd = _build_command(codex_bin, prompt, extra_args or [])
    return _run_codex(cmd, cwd, env, timeout)


def run_codex_repair(
    prompt: str,
    cwd: str,
    codex_bin: str = "codex",
    extra_args: Optional[List[str]] = None,
    env: Optional[Dict[str, str]] = None,
    timeout: int = 900,
) -> CodexResult:
    """Run a focused repair pass with Codex.

    Same as run_codex but uses a shorter timeout and the repair prompt.
    The repair prompt must be generated externally (see openai_client.py).
    """
    cmd = _build_command(codex_bin, prompt, extra_args or [])
    return _run_codex(cmd, cwd, env, timeout)
