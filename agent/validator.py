"""Validation logic for repo-city-cycle.

Inspects changed files, classifies changes, determines required validation
commands, runs them, and evaluates whether the cycle is valid.

All policy decisions here are deterministic — no AI calls.
"""
from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# Change classification
# ---------------------------------------------------------------------------


@dataclass
class ChangeFlags:
    # At least one file outside docs/ changed
    has_eligible_non_doc_change: bool = False

    # frontend/ changed at all
    frontend_changed: bool = False

    # frontend/ changed with a source file extension → triggers lint
    frontend_materially_changed: bool = False

    # UI flows or test selectors changed → may trigger browser:smoke
    ui_flow_or_selectors_changed: bool = False

    # worker/ or shared/ contract files changed → triggers worker build
    worker_or_shared_contracts_changed: bool = False

    # docs/REPO_CITY_TRACKER.json changed
    tracker_changed: bool = False

    # All files in the diff
    all_files: List[str] = field(default_factory=list)

    # Files outside docs/
    non_doc_files: List[str] = field(default_factory=list)


# Extensions that count as "material" frontend changes (trigger lint)
_MATERIAL_FE_EXTS: Set[str] = {
    ".ts", ".tsx", ".js", ".jsx", ".css", ".scss", ".html"
}

# Path prefixes that, when changed, count as UI flow / selector changes
_UI_FLOW_PREFIXES: Tuple[str, ...] = (
    "frontend/src",
    "frontend/app",
    "frontend/components",
)

# File name fragments that hint at UI flow / selector files
_UI_FLOW_FRAGMENTS: Tuple[str, ...] = (
    "playwright",
    "smoke",
    "e2e",
    "selector",
    "selectors",
    "page-object",
)

# Extensions that count as worker/shared "contract" changes
_CONTRACT_EXTS: Set[str] = {
    ".ts", ".tsx", ".js", ".json", ".schema", ".yaml", ".yml"
}

# File name fragments that hint at contract files
_CONTRACT_FRAGMENTS: Tuple[str, ...] = (
    "contract",
    "schema",
    "types",
    "api",
)


def classify_changes(files: List[str]) -> ChangeFlags:
    """Return a ChangeFlags object from a list of changed file paths."""
    flags = ChangeFlags(all_files=list(files))
    docs_prefix = "docs/"

    for f in files:
        # Normalise path separators
        fp = f.replace("\\", "/")

        if not fp.startswith(docs_prefix):
            flags.has_eligible_non_doc_change = True
            flags.non_doc_files.append(fp)

        # Tracker
        if fp == "docs/REPO_CITY_TRACKER.json":
            flags.tracker_changed = True

        # Frontend
        if fp.startswith("frontend/"):
            flags.frontend_changed = True
            ext = os.path.splitext(fp)[1].lower()
            if ext in _MATERIAL_FE_EXTS:
                flags.frontend_materially_changed = True
            # UI flow check
            if any(fp.startswith(prefix) for prefix in _UI_FLOW_PREFIXES):
                flags.ui_flow_or_selectors_changed = True
            lower_fp = fp.lower()
            if any(frag in lower_fp for frag in _UI_FLOW_FRAGMENTS):
                flags.ui_flow_or_selectors_changed = True

        # Worker / shared contracts
        if fp.startswith("worker/") or fp.startswith("shared/"):
            ext = os.path.splitext(fp)[1].lower()
            lower_name = os.path.basename(fp).lower()
            if ext in _CONTRACT_EXTS or any(
                frag in lower_name for frag in _CONTRACT_FRAGMENTS
            ):
                flags.worker_or_shared_contracts_changed = True

    return flags


# ---------------------------------------------------------------------------
# Required commands
# ---------------------------------------------------------------------------


def required_validation_commands(flags: ChangeFlags) -> List[str]:
    """Return ordered list of validation shell commands given *flags*."""
    cmds: List[str] = []

    if flags.frontend_changed:
        cmds.append("cd frontend && npm run build")

    if flags.frontend_materially_changed:
        cmds.append("cd frontend && npm run lint")

    if flags.ui_flow_or_selectors_changed:
        cmds.append("cd frontend && npm run browser:smoke")

    if flags.worker_or_shared_contracts_changed:
        cmds.append("cd worker && npm run build")

    return cmds


# ---------------------------------------------------------------------------
# Run validation commands
# ---------------------------------------------------------------------------


@dataclass
class ValidationResult:
    command: str
    exit_code: int
    stdout: str
    stderr: str
    passed: bool
    skipped: bool = False
    skip_reason: str = ""

    def as_dict(self) -> dict:
        return {
            "command": self.command,
            "exit_code": self.exit_code,
            "passed": self.passed,
            "skipped": self.skipped,
            "skip_reason": self.skip_reason,
            "stdout": self.stdout[:4000],
            "stderr": self.stderr[:4000],
        }


def _is_clearly_blocked(command: str, cwd: str) -> Tuple[bool, str]:
    """Return (blocked, reason) for commands that require infrastructure
    that might not be available locally (e.g. browser smoke tests)."""
    if "browser:smoke" in command:
        # Check if Playwright is installed
        check = subprocess.run(
            ["npx", "playwright", "--version"],
            cwd=cwd,
            capture_output=True,
            text=True,
        )
        if check.returncode != 0:
            return True, "Playwright not installed (npx playwright --version failed)"
        # Check if the smoke script exists
        smoke_script = os.path.join(cwd, "frontend", "scripts", "browser-smoke.mjs")
        if not os.path.isfile(smoke_script):
            return True, f"Smoke script not found: {smoke_script}"
    return False, ""


def run_validation_commands(
    commands: List[str],
    cwd: str,
    timeout: int = 300,
) -> List[ValidationResult]:
    """Execute each command in *commands* and return structured results."""
    results: List[ValidationResult] = []

    for cmd in commands:
        # Check if the command is clearly blocked before running
        blocked, block_reason = _is_clearly_blocked(cmd, cwd)
        if blocked:
            results.append(
                ValidationResult(
                    command=cmd,
                    exit_code=-1,
                    stdout="",
                    stderr="",
                    passed=True,  # skip = not a failure
                    skipped=True,
                    skip_reason=block_reason,
                )
            )
            continue

        try:
            proc = subprocess.run(
                cmd,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            results.append(
                ValidationResult(
                    command=cmd,
                    exit_code=proc.returncode,
                    stdout=proc.stdout,
                    stderr=proc.stderr,
                    passed=proc.returncode == 0,
                )
            )
        except subprocess.TimeoutExpired:
            results.append(
                ValidationResult(
                    command=cmd,
                    exit_code=-1,
                    stdout="",
                    stderr=f"Command timed out after {timeout}s",
                    passed=False,
                )
            )
        except Exception as exc:  # noqa: BLE001
            results.append(
                ValidationResult(
                    command=cmd,
                    exit_code=-1,
                    stdout="",
                    stderr=str(exc),
                    passed=False,
                )
            )

    return results


# ---------------------------------------------------------------------------
# Get changed files
# ---------------------------------------------------------------------------


def get_changed_files(cwd: str) -> List[str]:
    """Return all changed file paths (relative to repo root) after Codex ran."""
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    files: List[str] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        raw = line[3:]  # skip XY + space
        if " -> " in raw:
            files.append(raw.split(" -> ", 1)[1].strip())
        else:
            files.append(raw.strip())
    return sorted(set(files))


# ---------------------------------------------------------------------------
# Cycle validity
# ---------------------------------------------------------------------------


@dataclass
class CycleValidity:
    valid: bool
    reason: str
    # Individual check results
    has_non_doc_changes: bool = False
    at_least_one_validation_ran: bool = False
    all_validations_passed: bool = False


def evaluate_cycle_validity(
    phase: str,
    flags: ChangeFlags,
    validation_results: List[ValidationResult],
    is_phase_0: bool = False,
) -> CycleValidity:
    """Apply deterministic cycle validity rules.

    Returns a CycleValidity object.  Valid = True only if all hard rules pass.
    """
    # Rule 1: after Phase 0, docs-only cycles are invalid
    if not is_phase_0 and not flags.has_eligible_non_doc_change:
        return CycleValidity(
            valid=False,
            reason="Docs-only cycle after Phase 0 — no eligible non-doc files changed.",
            has_non_doc_changes=False,
            at_least_one_validation_ran=False,
            all_validations_passed=False,
        )

    has_non_doc = flags.has_eligible_non_doc_change or is_phase_0

    # Rule 2: every cycle must run at least one validation command
    non_skipped = [r for r in validation_results if not r.skipped]
    ran_at_least_one = len(non_skipped) > 0

    if not ran_at_least_one:
        # Check: were any commands required?
        required = required_validation_commands(flags)
        if required:
            return CycleValidity(
                valid=False,
                reason=f"Required validations were not run: {required}",
                has_non_doc_changes=has_non_doc,
                at_least_one_validation_ran=False,
                all_validations_passed=False,
            )
        # No commands required AND Phase 0 — that's OK (docs-only Phase 0)
        if not is_phase_0:
            return CycleValidity(
                valid=False,
                reason="No validation commands ran and this is not Phase 0.",
                has_non_doc_changes=has_non_doc,
                at_least_one_validation_ran=False,
                all_validations_passed=False,
            )

    # Rule 3: all non-skipped validations must pass
    failed = [r for r in non_skipped if not r.passed]
    if failed:
        failed_cmds = [r.command for r in failed]
        return CycleValidity(
            valid=False,
            reason=f"Validation(s) failed: {failed_cmds}",
            has_non_doc_changes=has_non_doc,
            at_least_one_validation_ran=ran_at_least_one,
            all_validations_passed=False,
        )

    return CycleValidity(
        valid=True,
        reason="All deterministic checks passed.",
        has_non_doc_changes=has_non_doc,
        at_least_one_validation_ran=ran_at_least_one or not bool(
            required_validation_commands(flags)
        ),
        all_validations_passed=True,
    )
