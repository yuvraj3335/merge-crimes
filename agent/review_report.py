"""Report formatting for the review lane.

Formats the mandatory 10-section review report and serialises a summary JSON.
Section headings are fixed and different from the delivery lane's 8 headings.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Report data
# ---------------------------------------------------------------------------


@dataclass
class ReviewCycleReport:
    # -- Identity --
    run_id: str = ""
    cycle_number: int = 0
    campaign_id: str = ""

    # -- What happened --
    mode: str = ""                          # "review_only" or "apply_fix"
    slice_title: str = ""
    workstream: str = ""
    files_involved: List[str] = field(default_factory=list)
    commands_run: List[str] = field(default_factory=list)

    # -- Findings --
    new_findings_count: int = 0
    total_open_findings: int = 0
    findings_by_severity: Dict[str, int] = field(default_factory=dict)
    findings_summary: str = ""

    # -- Queue --
    queue_size: int = 0
    queue_review_count: int = 0
    queue_fix_count: int = 0

    # -- Artifacts --
    artifacts_written: List[str] = field(default_factory=list)
    dry_run: bool = True

    # -- AI narrative --
    ai_narrative: str = ""
    top_recommendations: List[str] = field(default_factory=list)

    # -- Stop decision --
    should_stop: bool = False
    stop_reason: str = ""

    # -- Tracker --
    tracker_changes: str = "none"

    # -- Validity --
    cycle_valid: bool = False
    parse_error: str = ""

    # -- Fix mode extras --
    codex_exit_code: int = -1
    committed: bool = False
    pushed: bool = False
    commit_hash: str = ""
    repair_attempts: int = 0
    validation_summary: List[Dict[str, Any]] = field(default_factory=list)

    # -- Error --
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Section headings (exact, immutable)
# ---------------------------------------------------------------------------

_REVIEW_HEADINGS = [
    "Campaign",
    "Mode and slice",
    "Files involved",
    "Commands run",
    "Findings this cycle",
    "Total finding queue",
    "Artifacts written",
    "What is now safer or simpler",
    "Stop policy decision",
    "Tracker changes",
]


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------


def format_review_report(report: ReviewCycleReport) -> str:
    """Return the mandatory 10-section text report."""

    # Campaign section
    campaign_text = (
        f"ID:      {report.campaign_id or '(unknown)'}\n"
        f"Cycle:   {report.cycle_number}\n"
        f"Mode:    {report.mode or '(unknown)'}\n"
        f"Dry run: {report.dry_run}"
    )

    # Mode and slice section
    mode_text = (
        f"Mode:        {report.mode or '(unknown)'}\n"
        f"Workstream:  {report.workstream or '(none)'}\n"
        f"Slice:       {report.slice_title or '(none)'}"
    )

    # Files
    if report.files_involved:
        files_text = "\n".join(f"  {f}" for f in sorted(report.files_involved))
    else:
        files_text = "  (none)"

    # Commands
    if report.commands_run:
        commands_text = "\n".join(f"  {c}" for c in report.commands_run)
    else:
        commands_text = "  (none)"

    # Findings this cycle
    if report.new_findings_count == 0:
        findings_text = "New findings: 0"
    else:
        sev = report.findings_by_severity
        findings_text = (
            f"New findings: {report.new_findings_count}\n"
            f"  high={sev.get('high', 0)}  medium={sev.get('medium', 0)}  low={sev.get('low', 0)}"
        )
        if report.findings_summary:
            findings_text += f"\n\n{report.findings_summary}"
    if report.parse_error:
        findings_text += f"\n\nPARSE ERROR: {report.parse_error}"

    # Total finding queue
    queue_text = (
        f"Open findings: {report.total_open_findings}\n"
        f"Pending queue: {report.queue_size} total  "
        f"({report.queue_review_count} review, {report.queue_fix_count} fix)"
    )

    # Artifacts written
    if report.artifacts_written:
        artifacts_text = "\n".join(f"  {a}" for a in report.artifacts_written)
        if report.dry_run:
            artifacts_text += "\n\n  [DRY RUN] Live files NOT modified. .dryrun files are preview only."
    else:
        artifacts_text = "  (none)"

    # What is now safer or simpler
    if report.ai_narrative:
        safer_text = report.ai_narrative
        if report.top_recommendations:
            safer_text += "\n\nRecommendations:"
            for rec in report.top_recommendations:
                safer_text += f"\n  - {rec}"
    elif report.cycle_valid and report.mode == "apply_fix":
        safer_text = f"Applied fix for: {report.slice_title}"
    elif report.new_findings_count > 0:
        safer_text = f"Identified {report.new_findings_count} new issue(s) for review."
    else:
        safer_text = "(no changes applied this cycle)"

    # Stop policy decision
    if report.should_stop:
        stop_text = f"STOPPING — {report.stop_reason}"
    else:
        stop_text = f"Continuing — {report.stop_reason or 'next slice available'}"

    # Tracker changes
    tracker_text = report.tracker_changes or "none"
    if report.dry_run and tracker_text not in ("none", ""):
        tracker_text = "[DRY RUN] Changes written to .dryrun shadow file only.\n" + tracker_text

    sections = {
        "Campaign":                    campaign_text,
        "Mode and slice":              mode_text,
        "Files involved":              files_text,
        "Commands run":                commands_text,
        "Findings this cycle":         findings_text,
        "Total finding queue":         queue_text,
        "Artifacts written":           artifacts_text,
        "What is now safer or simpler": safer_text,
        "Stop policy decision":        stop_text,
        "Tracker changes":             tracker_text,
    }

    parts: List[str] = []
    for heading in _REVIEW_HEADINGS:
        content = sections[heading]
        parts.append(f"{heading}:\n{content}")

    return "\n\n".join(parts)


def build_review_summary_json(report: ReviewCycleReport) -> Dict[str, Any]:
    """Return a dict suitable for saving as summary.json."""
    return {
        "run_id": report.run_id,
        "cycle_number": report.cycle_number,
        "campaign_id": report.campaign_id,
        "mode": report.mode,
        "workstream": report.workstream,
        "slice_title": report.slice_title,
        "cycle_valid": report.cycle_valid,
        "dry_run": report.dry_run,
        "new_findings_count": report.new_findings_count,
        "total_open_findings": report.total_open_findings,
        "findings_by_severity": report.findings_by_severity,
        "queue_size": report.queue_size,
        "queue_review_count": report.queue_review_count,
        "queue_fix_count": report.queue_fix_count,
        "artifacts_written": report.artifacts_written,
        "should_stop": report.should_stop,
        "stop_reason": report.stop_reason,
        "tracker_changes": report.tracker_changes,
        "files_involved": sorted(report.files_involved),
        "commands_run": report.commands_run,
        "committed": report.committed,
        "pushed": report.pushed,
        "commit_hash": report.commit_hash,
        "repair_attempts": report.repair_attempts,
        "codex_exit_code": report.codex_exit_code,
        "validation_summary": report.validation_summary,
        "error": report.error,
        "parse_error": report.parse_error,
    }
