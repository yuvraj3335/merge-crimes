"""Logging utilities for repo-city-cycle.

Creates per-run log directories, saves stdout/stderr for all subprocesses,
saves a summary JSON and final report text.  Never prints secrets.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Secret masking
# ---------------------------------------------------------------------------

# Patterns that look like secret tokens.  Keys in env dicts matching these
# patterns have their values replaced before logging.
_SECRET_KEY_PATTERNS = re.compile(
    r"(api.?key|secret|token|password|passwd|auth|credential)",
    re.IGNORECASE,
)

_SECRET_VALUE_PATTERNS = re.compile(
    r"(sk-[A-Za-z0-9\-_]{20,}|Bearer\s+[A-Za-z0-9\-_\.]+)",
    re.IGNORECASE,
)


def mask_secrets_in_env(env: Dict[str, str]) -> Dict[str, str]:
    """Return a copy of *env* with secret-looking values replaced."""
    masked = {}
    for k, v in env.items():
        if _SECRET_KEY_PATTERNS.search(k):
            masked[k] = "***MASKED***"
        else:
            masked[k] = v
    return masked


def mask_secrets_in_text(text: str) -> str:
    """Replace obvious secret tokens in *text* with placeholders."""
    return _SECRET_VALUE_PATTERNS.sub("***MASKED***", text)


# ---------------------------------------------------------------------------
# RunLogger
# ---------------------------------------------------------------------------


class RunLogger:
    """Manages the log directory for a single cycle run.

    Directory layout::

        <log_dir>/<run_id>/
            codex_stdout.txt
            codex_stderr.txt
            repair_<n>_stdout.txt
            repair_<n>_stderr.txt
            validation_<cmd_slug>.txt
            final_report.txt
            summary.json
    """

    def __init__(self, log_dir_abs: str, run_id: str) -> None:
        self.run_dir = os.path.join(log_dir_abs, run_id)
        os.makedirs(self.run_dir, exist_ok=True)

        # Also set up a Python logger that writes to run_dir/cycle.log
        self._logger = logging.getLogger(f"repo_city_cycle.{run_id}")
        self._logger.setLevel(logging.DEBUG)
        if not self._logger.handlers:
            fh = logging.FileHandler(
                os.path.join(self.run_dir, "cycle.log"), encoding="utf-8"
            )
            fh.setFormatter(
                logging.Formatter("%(asctime)s %(levelname)-8s %(message)s")
            )
            self._logger.addHandler(fh)

    # -- Convenience wrappers -----------------------------------------------

    def info(self, msg: str) -> None:
        self._logger.info(msg)
        print(f"[info]  {msg}")

    def warning(self, msg: str) -> None:
        self._logger.warning(msg)
        print(f"[warn]  {msg}", file=sys.stderr)

    def error(self, msg: str) -> None:
        self._logger.error(msg)
        print(f"[error] {msg}", file=sys.stderr)

    def debug(self, msg: str) -> None:
        self._logger.debug(msg)

    # -- File savers --------------------------------------------------------

    def save_text(self, filename: str, content: str) -> str:
        """Write *content* to *filename* inside run_dir.  Returns full path."""
        path = os.path.join(self.run_dir, filename)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(mask_secrets_in_text(content))
        return path

    def save_codex_output(
        self, stdout: str, stderr: str, attempt: int = 0, is_repair: bool = False
    ) -> None:
        prefix = f"repair_{attempt}" if is_repair else "codex"
        self.save_text(f"{prefix}_stdout.txt", stdout or "")
        self.save_text(f"{prefix}_stderr.txt", stderr or "")

    def save_validation_output(self, command_slug: str, output: str) -> None:
        safe_slug = re.sub(r"[^a-zA-Z0-9_\-]", "_", command_slug)[:80]
        self.save_text(f"validation_{safe_slug}.txt", output or "")

    def save_final_report(self, report_text: str) -> str:
        return self.save_text("final_report.txt", report_text)

    def save_summary(self, data: Dict[str, Any]) -> str:
        path = os.path.join(self.run_dir, "summary.json")
        safe_data = _deep_mask(data)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(safe_data, fh, indent=2, default=str)
        return path

    # -- Path helpers -------------------------------------------------------

    def path(self, filename: str) -> str:
        return os.path.join(self.run_dir, filename)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def setup_run_logger(log_dir_abs: str) -> RunLogger:
    """Create a RunLogger for the current cycle run.

    The run_id is a UTC timestamp so logs are naturally sorted.
    """
    run_id = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    logger = RunLogger(log_dir_abs, run_id)
    logger.info(f"Run started — log directory: {logger.run_dir}")
    return logger


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _deep_mask(obj: Any) -> Any:
    """Recursively mask secret-looking string values in nested dicts/lists."""
    if isinstance(obj, dict):
        return {k: _deep_mask(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_deep_mask(item) for item in obj]
    if isinstance(obj, str):
        return mask_secrets_in_text(obj)
    return obj
