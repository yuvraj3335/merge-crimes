"""Configuration loading for the repo-city-cycle wrapper.

Reads environment variables, validates required values, and exposes a typed
Config dataclass.  Call load_config() at startup; the result is passed through
to every module that needs settings.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from typing import List


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------


@dataclass
class Config:
    # -- Required --
    openai_api_key: str
    repo_root: str

    # -- Optional with defaults --
    codex_bin: str = "codex"
    openai_model: str = "gpt-4.1"
    git_remote: str = "origin"
    base_branch: str = "main"
    allow_push_main: bool = True
    dry_run: bool = False
    enable_repair_pass: bool = True
    max_repair_attempts: int = 1
    log_dir: str = "agent/logs"
    codex_extra_args: List[str] = field(default_factory=list)
    skip_git_pull: bool = False
    json_only_report: bool = False

    # -- Derived paths (not settable by env) --

    @property
    def tracker_path(self) -> str:
        return os.path.join(self.repo_root, "docs", "REPO_CITY_TRACKER.json")

    @property
    def docs_dir(self) -> str:
        return os.path.join(self.repo_root, "docs")

    @property
    def log_dir_abs(self) -> str:
        if os.path.isabs(self.log_dir):
            return self.log_dir
        return os.path.join(self.repo_root, self.log_dir)

    @property
    def prompts_dir(self) -> str:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts")


# ---------------------------------------------------------------------------
# Required docs
# ---------------------------------------------------------------------------

REQUIRED_DOCS: List[str] = [
    "REPO_CITY_TRACKER.json",
    "REPO_CITY_PRODUCT_VISION.md",
    "REPO_CITY_SYSTEM_DESIGN.md",
    "REPO_CITY_ITERATIVE_WORKFLOW.md",
    "REPO_CITY_PHASE_EXECUTION_PLAN.md",
    "REPO_CITY_ITERATION_PROMPT.md",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_bool(val: str, default: bool = False) -> bool:
    if not val:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _parse_int(val: str, default: int) -> int:
    try:
        return int(val.strip())
    except (ValueError, AttributeError):
        return default


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------


def load_config() -> Config:
    """Load configuration from environment variables.

    Prints a clear warning when direct push-to-main is enabled.
    Exits with code 1 if required variables are missing or invalid.
    """
    # -- Required --
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print(
            "ERROR: OPENAI_API_KEY environment variable is not set.\n"
            "  Export it or add it to .env before running repo-city-cycle.",
            file=sys.stderr,
        )
        sys.exit(1)

    repo_root = os.environ.get("REPO_CITY_REPO_ROOT", "").strip()
    if not repo_root:
        # agent/ package lives one level below repo root
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    repo_root = os.path.abspath(repo_root)

    if not os.path.isdir(repo_root):
        print(
            f"ERROR: REPO_CITY_REPO_ROOT does not exist: {repo_root}",
            file=sys.stderr,
        )
        sys.exit(1)

    # -- Optional --
    codex_bin = os.environ.get("REPO_CITY_CODEX_BIN", "codex").strip() or "codex"
    openai_model = (
        os.environ.get("REPO_CITY_OPENAI_MODEL", "gpt-4.1").strip() or "gpt-4.1"
    )
    git_remote = os.environ.get("REPO_CITY_GIT_REMOTE", "origin").strip() or "origin"
    base_branch = os.environ.get("REPO_CITY_BASE_BRANCH", "main").strip() or "main"

    allow_push_main = _parse_bool(
        os.environ.get("REPO_CITY_ALLOW_PUSH_MAIN", "true"), default=True
    )
    dry_run = _parse_bool(
        os.environ.get("REPO_CITY_DRY_RUN", "false"), default=False
    )
    enable_repair_pass = _parse_bool(
        os.environ.get("REPO_CITY_ENABLE_REPAIR_PASS", "true"), default=True
    )
    max_repair_attempts = _parse_int(
        os.environ.get("REPO_CITY_MAX_REPAIR_ATTEMPTS", "1"), default=1
    )
    log_dir = (
        os.environ.get("REPO_CITY_LOG_DIR", "agent/logs").strip() or "agent/logs"
    )
    skip_git_pull = _parse_bool(
        os.environ.get("REPO_CITY_SKIP_GIT_PULL", "false"), default=False
    )
    json_only_report = _parse_bool(
        os.environ.get("REPO_CITY_JSON_ONLY_REPORT", "false"), default=False
    )

    raw_extra = os.environ.get("REPO_CITY_CODEX_EXTRA_ARGS", "").strip()
    codex_extra_args = raw_extra.split() if raw_extra else []

    cfg = Config(
        openai_api_key=api_key,
        repo_root=repo_root,
        codex_bin=codex_bin,
        openai_model=openai_model,
        git_remote=git_remote,
        base_branch=base_branch,
        allow_push_main=allow_push_main,
        dry_run=dry_run,
        enable_repair_pass=enable_repair_pass,
        max_repair_attempts=max_repair_attempts,
        log_dir=log_dir,
        codex_extra_args=codex_extra_args,
        skip_git_pull=skip_git_pull,
        json_only_report=json_only_report,
    )

    if allow_push_main and not dry_run:
        print(
            "\n[WARNING] REPO_CITY_ALLOW_PUSH_MAIN=true — "
            "this tool WILL push directly to origin/main after a valid cycle.\n"
            "  Set REPO_CITY_DRY_RUN=true to disable push.\n",
            file=sys.stderr,
        )

    return cfg
