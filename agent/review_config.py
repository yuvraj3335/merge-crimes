"""Configuration loading for the repo-city review lane.

Reads environment variables, validates required values, and exposes a typed
ReviewConfig dataclass.  Call load_review_config() at startup.

All env vars are prefixed REPO_CITY_REVIEW_* to avoid collisions with the
delivery lane.  OPENAI_API_KEY and REPO_CITY_OPENAI_MODEL are shared.
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
class ReviewConfig:
    # -- Required --
    openai_api_key: str
    repo_root: str

    # -- Mode --
    mode: str = "review_only"       # "review_only" or "apply_fix"

    # -- Shared with delivery lane --
    codex_bin: str = "codex"
    openai_model: str = "gpt-4.1"
    git_remote: str = "origin"
    base_branch: str = "main"
    codex_extra_args: List[str] = field(default_factory=list)

    # -- Review-specific --
    # dry_run defaults TRUE (opposite of delivery lane)
    dry_run: bool = True
    allow_push: bool = False        # must be explicit to commit/push fixes
    enable_repair_pass: bool = True
    max_repair_attempts: int = 1
    skip_smoke: bool = True
    skip_git_pull: bool = True      # review lane skips pull by default

    # -- Loop controls --
    max_cycles: int = 80
    cycle_delay_seconds: float = 10.0
    max_stalled_cycles: int = 4

    # -- Stop thresholds --
    stop_on_findings_below: int = 3
    stop_on_score_below: float = 10.0
    max_consecutive_no_findings: int = 3

    # -- Scoring weights --
    weight_severity: float = 3.0
    weight_recency: float = 1.5
    weight_coverage_gap: float = 2.0
    weight_starvation: float = 1.0

    # -- Log dir (separate from delivery lane) --
    log_dir: str = "agent/review_logs"

    # -- Derived paths (not settable by env) --

    @property
    def review_tracker_path(self) -> str:
        return os.path.join(self.repo_root, "docs", "REPO_CITY_REVIEW_TRACKER.json")

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
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "review_prompts")

    @property
    def artifacts_dir(self) -> str:
        return os.path.join(self.repo_root, "docs", "review_artifacts")


# ---------------------------------------------------------------------------
# Required docs (review lane only needs its own tracker)
# ---------------------------------------------------------------------------

REVIEW_REQUIRED_DOCS: List[str] = [
    "REPO_CITY_REVIEW_TRACKER.json",
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


def _parse_float(val: str, default: float) -> float:
    try:
        return float(val.strip())
    except (ValueError, AttributeError):
        return default


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------


def load_review_config() -> ReviewConfig:
    """Load review configuration from environment variables.

    Exits with code 1 if required variables are missing or invalid.
    """
    # -- Required --
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print(
            "ERROR: OPENAI_API_KEY environment variable is not set.\n"
            "  Export it or add it to .env before running repo-city-review-cycle.",
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

    # -- Mode --
    mode = os.environ.get("REPO_CITY_REVIEW_MODE", "review_only").strip().lower()
    if mode not in ("review_only", "apply_fix"):
        print(
            f"ERROR: REPO_CITY_REVIEW_MODE must be 'review_only' or 'apply_fix', got: {mode!r}",
            file=sys.stderr,
        )
        sys.exit(1)

    # -- Shared settings --
    codex_bin = os.environ.get("REPO_CITY_CODEX_BIN", "codex").strip() or "codex"
    openai_model = (
        os.environ.get("REPO_CITY_OPENAI_MODEL", "gpt-4.1").strip() or "gpt-4.1"
    )
    git_remote = os.environ.get("REPO_CITY_GIT_REMOTE", "origin").strip() or "origin"
    base_branch = os.environ.get("REPO_CITY_BASE_BRANCH", "main").strip() or "main"
    raw_extra = os.environ.get("REPO_CITY_CODEX_EXTRA_ARGS", "").strip()
    codex_extra_args = raw_extra.split() if raw_extra else []

    # -- Review-specific settings --
    dry_run = _parse_bool(
        os.environ.get("REPO_CITY_REVIEW_DRY_RUN", "true"), default=True
    )
    allow_push = _parse_bool(
        os.environ.get("REPO_CITY_REVIEW_ALLOW_PUSH", "false"), default=False
    )
    enable_repair_pass = _parse_bool(
        os.environ.get("REPO_CITY_REVIEW_ENABLE_REPAIR", "true"), default=True
    )
    max_repair_attempts = _parse_int(
        os.environ.get("REPO_CITY_REVIEW_MAX_REPAIR_ATTEMPTS", "1"), default=1
    )
    skip_smoke = _parse_bool(
        os.environ.get("REPO_CITY_REVIEW_SKIP_SMOKE", "true"), default=True
    )
    skip_git_pull = _parse_bool(
        os.environ.get("REPO_CITY_REVIEW_SKIP_GIT_PULL", "true"), default=True
    )
    log_dir = (
        os.environ.get("REPO_CITY_REVIEW_LOG_DIR", "agent/review_logs").strip()
        or "agent/review_logs"
    )

    # -- Loop controls --
    max_cycles = _parse_int(
        os.environ.get("REPO_CITY_REVIEW_MAX_CYCLES", "80"), default=80
    )
    cycle_delay_seconds = _parse_float(
        os.environ.get("REPO_CITY_REVIEW_CYCLE_DELAY", "10"), default=10.0
    )
    max_stalled_cycles = _parse_int(
        os.environ.get("REPO_CITY_REVIEW_MAX_STALLED", "4"), default=4
    )

    # -- Stop thresholds --
    stop_on_findings_below = _parse_int(
        os.environ.get("REPO_CITY_REVIEW_STOP_FINDINGS_BELOW", "3"), default=3
    )
    stop_on_score_below = _parse_float(
        os.environ.get("REPO_CITY_REVIEW_STOP_SCORE_BELOW", "10.0"), default=10.0
    )
    max_consecutive_no_findings = _parse_int(
        os.environ.get("REPO_CITY_REVIEW_MAX_NO_FINDINGS", "3"), default=3
    )

    # -- Scoring weights --
    weight_severity = _parse_float(
        os.environ.get("REPO_CITY_REVIEW_WEIGHT_SEVERITY", "3.0"), default=3.0
    )
    weight_recency = _parse_float(
        os.environ.get("REPO_CITY_REVIEW_WEIGHT_RECENCY", "1.5"), default=1.5
    )
    weight_coverage_gap = _parse_float(
        os.environ.get("REPO_CITY_REVIEW_WEIGHT_COVERAGE", "2.0"), default=2.0
    )
    weight_starvation = _parse_float(
        os.environ.get("REPO_CITY_REVIEW_WEIGHT_STARVATION", "1.0"), default=1.0
    )

    cfg = ReviewConfig(
        openai_api_key=api_key,
        repo_root=repo_root,
        mode=mode,
        codex_bin=codex_bin,
        openai_model=openai_model,
        git_remote=git_remote,
        base_branch=base_branch,
        codex_extra_args=codex_extra_args,
        dry_run=dry_run,
        allow_push=allow_push,
        enable_repair_pass=enable_repair_pass,
        max_repair_attempts=max_repair_attempts,
        skip_smoke=skip_smoke,
        skip_git_pull=skip_git_pull,
        log_dir=log_dir,
        max_cycles=max_cycles,
        cycle_delay_seconds=cycle_delay_seconds,
        max_stalled_cycles=max_stalled_cycles,
        stop_on_findings_below=stop_on_findings_below,
        stop_on_score_below=stop_on_score_below,
        max_consecutive_no_findings=max_consecutive_no_findings,
        weight_severity=weight_severity,
        weight_recency=weight_recency,
        weight_coverage_gap=weight_coverage_gap,
        weight_starvation=weight_starvation,
    )

    if dry_run:
        print(
            "[review] DRY RUN mode — no files will be committed or pushed.\n"
            "  Set REPO_CITY_REVIEW_DRY_RUN=false to enable live writes.",
            file=sys.stderr,
        )
    elif allow_push and mode == "apply_fix":
        print(
            "\n[WARNING] REPO_CITY_REVIEW_ALLOW_PUSH=true — "
            "apply_fix cycles WILL commit and push fixes to origin/main.\n",
            file=sys.stderr,
        )

    return cfg
