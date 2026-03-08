"""Report formatting for repo-city-cycle.

Formats the mandatory eight-section final report and serialises a summary
JSON.  The section headings are fixed; deviating from them breaks log
parsing downstream.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Report data
# ---------------------------------------------------------------------------


@dataclass
class CycleReport:
    phase: str = ""
    slice_attempted: str = ""
    files_changed: List[str] = field(default_factory=list)
    commands_run: List[str] = field(default_factory=list)
    results: str = ""
    what_works_now: str = ""
    what_is_blocked: str = ""
    tracker_changes: str = "none"

    # Internal fields used for summary.json (not in the printed report headings)
    cycle_valid: bool = False
    tracker_reverted: bool = False
    committed: bool = False
    pushed: bool = False
    commit_hash: str = ""
    run_id: str = ""
    repair_attempts: int = 0
    codex_exit_code: int = -1
    validation_summary: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Section headings (exact, immutable)
# ---------------------------------------------------------------------------

_HEADINGS = [
    "Phase",
    "Slice attempted",
    "Files changed",
    "Commands run",
    "Results",
    "What works now",
    "What is blocked",
    "Tracker changes Codex made",
]


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------


def format_report(report: CycleReport) -> str:
    """Return the mandatory eight-section text report."""
    files_str = (
        "\n".join(f"  {f}" for f in sorted(report.files_changed))
        if report.files_changed
        else "  (none)"
    )
    commands_str = (
        "\n".join(f"  {c}" for c in report.commands_run)
        if report.commands_run
        else "  (none)"
    )

    sections = {
        "Phase": report.phase or "(unknown)",
        "Slice attempted": report.slice_attempted or "(none)",
        "Files changed": files_str,
        "Commands run": commands_str,
        "Results": report.results or "(none)",
        "What works now": report.what_works_now or "(unknown)",
        "What is blocked": report.what_is_blocked or "(nothing reported)",
        "Tracker changes Codex made": report.tracker_changes or "none",
    }

    parts: List[str] = []
    for heading in _HEADINGS:
        content = sections[heading]
        parts.append(f"{heading}:\n{content}")

    return "\n\n".join(parts)


def format_report_json(report: CycleReport) -> str:
    """Return the report as a compact JSON string."""
    data = {
        "phase": report.phase,
        "slice_attempted": report.slice_attempted,
        "files_changed": sorted(report.files_changed),
        "commands_run": report.commands_run,
        "results": report.results,
        "what_works_now": report.what_works_now,
        "what_is_blocked": report.what_is_blocked,
        "tracker_changes_codex_made": report.tracker_changes,
    }
    return json.dumps(data, indent=2, ensure_ascii=False)


def build_summary_json(report: CycleReport) -> Dict[str, Any]:
    """Return a dict suitable for saving as summary.json."""
    return {
        "run_id": report.run_id,
        "cycle_valid": report.cycle_valid,
        "tracker_reverted": report.tracker_reverted,
        "committed": report.committed,
        "pushed": report.pushed,
        "commit_hash": report.commit_hash,
        "repair_attempts": report.repair_attempts,
        "codex_exit_code": report.codex_exit_code,
        "phase": report.phase,
        "slice_attempted": report.slice_attempted,
        "files_changed": sorted(report.files_changed),
        "commands_run": report.commands_run,
        "validation_summary": report.validation_summary,
        "error": report.error,
        "results": report.results,
        "what_works_now": report.what_works_now,
        "what_is_blocked": report.what_is_blocked,
        "tracker_changes_codex_made": report.tracker_changes,
    }


def parse_codex_report_sections(codex_output: str) -> Dict[str, str]:
    """Extract the eight required sections from Codex's stdout.

    Codex is instructed to print the sections; this extracts them so the
    wrapper can incorporate them into its own report.

    Returns a dict keyed by the canonical heading name.  Missing sections
    are returned as empty strings.
    """
    result = {h: "" for h in _HEADINGS}

    # Build a map from lower-case heading → canonical heading
    heading_map = {h.lower(): h for h in _HEADINGS}

    current_heading: Optional[str] = None
    current_lines: List[str] = []

    def _flush():
        nonlocal current_heading, current_lines
        if current_heading:
            result[current_heading] = "\n".join(current_lines).strip()
        current_heading = None
        current_lines = []

    for line in codex_output.splitlines():
        stripped = line.rstrip()
        # Check if this line is a section heading "Heading:" or "## Heading"
        candidate = stripped.lstrip("# ").rstrip(":").strip().lower()
        if candidate in heading_map:
            _flush()
            current_heading = heading_map[candidate]
            current_lines = []
        elif current_heading is not None:
            current_lines.append(stripped)

    _flush()
    return result
