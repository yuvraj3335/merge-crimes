"""Tracker management for docs/REPO_CITY_TRACKER.json.

Provides safe read, snapshot, restore, and query helpers.  Never writes to the
tracker directly — Codex does that; the wrapper only reads or reverts.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Load / validate
# ---------------------------------------------------------------------------


def load_tracker(path: str) -> Dict[str, Any]:
    """Read and JSON-parse the tracker.  Raises on parse error."""
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Tracker JSON parse error: {exc}") from exc
    validate_tracker_json(data)
    return data


def validate_tracker_json(data: Any) -> None:
    """Raise ValueError if *data* does not look like a valid tracker object."""
    if not isinstance(data, dict):
        raise ValueError("Tracker root must be a JSON object.")
    # At minimum we expect a list of phases or milestones somewhere.
    # We accept both "phases" and "milestones" as top-level keys to stay
    # forward-compatible with schema changes.
    has_phases = isinstance(data.get("phases"), list)
    has_milestones = isinstance(data.get("milestones"), list)
    if not has_phases and not has_milestones:
        raise ValueError(
            'Tracker must have a "phases" or "milestones" list at the top level.'
        )


# ---------------------------------------------------------------------------
# Phase / milestone queries
# ---------------------------------------------------------------------------


_DONE_STATUSES = {"done", "complete", "completed", "finished"}


def _iter_phases(data: Dict[str, Any]):
    """Yield phase dicts from the tracker regardless of top-level key name."""
    # Support both "phases" and "milestones" as top-level list key
    phases = data.get("milestones") or data.get("phases") or []
    for phase in phases:
        yield phase


def find_first_incomplete_milestone(
    data: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Return the first phase/milestone dict whose status is not 'done'."""
    for phase in _iter_phases(data):
        status = str(phase.get("status", "")).lower()
        if status not in _DONE_STATUSES:
            return phase
    return None


def get_current_phase(
    data: Dict[str, Any],
    milestone: Optional[Dict[str, Any]] = None,
) -> str:
    """Return the current phase identifier string."""
    if milestone:
        # The real tracker uses "name" as the phase label (e.g. "Phase 3 - …")
        for key in ("name", "phase", "id", "phase_id", "title", "number"):
            val = milestone.get(key)
            if val is not None:
                return str(val)[:80]

    # Fall back to top-level status
    return str(data.get("status", "unknown"))


def get_recommended_slice(
    data: Dict[str, Any],
    milestone: Optional[Dict[str, Any]],
) -> str:
    """Return the recommended slice description from the tracker, if present.

    Handles both the actual tracker schema (current_slice_recommendation as a
    dict with 'title' key) and generic schemas.
    """
    # --- Actual tracker schema ---
    # Top-level "current_slice_recommendation": {"title": "...", "why": "..."}
    csr = data.get("current_slice_recommendation")
    if isinstance(csr, dict):
        title = csr.get("title") or csr.get("description") or csr.get("slice") or ""
        if title:
            return str(title).strip()
    if isinstance(csr, str) and csr.strip():
        return csr.strip()

    # Generic fallbacks — top-level
    for key in (
        "recommended_slice",
        "current_slice",
        "next_slice",
        "recommendation",
        "current_recommendation",
    ):
        val = data.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
        if isinstance(val, dict):
            desc = (
                val.get("description")
                or val.get("slice")
                or val.get("title")
                or ""
            )
            if desc:
                return str(desc).strip()

    # Inside the current milestone
    if milestone:
        for key in (
            "current_slice_recommendation",
            "recommended_slice",
            "current_slice",
            "next_slice",
            "recommendation",
        ):
            val = milestone.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
            if isinstance(val, dict):
                desc = (
                    val.get("description")
                    or val.get("slice")
                    or val.get("title")
                    or ""
                )
                if desc:
                    return str(desc).strip()

        # First incomplete slice in milestone.slices list
        slices = milestone.get("slices") or []
        for s in slices:
            if isinstance(s, dict):
                status = str(s.get("status", "")).lower()
                if status not in _DONE_STATUSES:
                    return (
                        s.get("description")
                        or s.get("title")
                        or s.get("name")
                        or "first incomplete slice"
                    )

    return "no slice recommendation found in tracker"


def get_open_risks(data: Dict[str, Any]) -> List[str]:
    """Return a list of open risk/blocker strings from the tracker."""
    risks: List[str] = []
    for key in ("known_risks", "risks", "open_questions", "blockers", "notes"):
        val = data.get(key)
        if isinstance(val, list):
            for item in val:
                if isinstance(item, str):
                    risks.append(item)
                elif isinstance(item, dict):
                    text = (
                        item.get("description")
                        or item.get("text")
                        or item.get("risk")
                        or item.get("question")
                        or ""
                    )
                    if text:
                        risks.append(str(text))
    return risks


def summarize_tracker(data: Dict[str, Any]) -> str:
    """Return a compact text summary of the tracker state for prompt context."""
    lines: List[str] = []

    project = data.get("project") or data.get("name") or "merge-crimes"
    status = data.get("status", "unknown")
    updated = data.get("last_updated") or data.get("updated_at") or ""
    current_goal = data.get("current_goal") or ""
    lines.append(f"Project: {project}")
    lines.append(f"Status: {status}")
    if updated:
        lines.append(f"Last updated: {updated}")
    if current_goal:
        lines.append(f"Current goal: {current_goal}")

    lines.append("")
    lines.append("Phases / milestones:")
    for phase in _iter_phases(data):
        # Real tracker uses "name"; generic uses "phase"/"id"/"title"
        phase_label = (
            phase.get("name")
            or phase.get("title")
            or phase.get("phase")
            or phase.get("id")
            or "?"
        )
        phase_status = str(phase.get("status", "unknown")).lower()
        marker = "[x]" if phase_status in _DONE_STATUSES else "[ ]"
        lines.append(f"  {marker} {phase_label} ({phase_status})")

    # Append recommended slice
    csr = data.get("current_slice_recommendation")
    if csr:
        if isinstance(csr, dict):
            title = csr.get("title", "")
            why = csr.get("why", "")
            lines.append(f"\nRecommended slice: {title}")
            if why:
                lines.append(f"  Why: {why[:200]}")
        elif isinstance(csr, str):
            lines.append(f"\nRecommended slice: {csr}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Snapshot / restore
# ---------------------------------------------------------------------------


def snapshot_tracker_text(path: str) -> str:
    """Return the raw text of the tracker file (for later restore)."""
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def restore_tracker_text(path: str, original_text: str) -> None:
    """Overwrite the tracker with *original_text* (revert Codex edits)."""
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(original_text)


# ---------------------------------------------------------------------------
# Diff helpers
# ---------------------------------------------------------------------------


def normalize_tracker_for_diff(data: Dict[str, Any]) -> str:
    """Return a stable, sorted JSON string for diffable comparison."""
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False)


def tracker_changed(original_text: str, path: str) -> bool:
    """Return True if the tracker file has changed since *original_text*."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            current = fh.read()
        # Normalize both sides for comparison
        try:
            orig_norm = normalize_tracker_for_diff(json.loads(original_text))
            curr_norm = normalize_tracker_for_diff(json.loads(current))
            return orig_norm != curr_norm
        except json.JSONDecodeError:
            return current != original_text
    except FileNotFoundError:
        return True  # deleted counts as changed


def diff_tracker_text(original_text: str, path: str) -> str:
    """Return a human-readable summary of tracker changes."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            current = fh.read()
    except FileNotFoundError:
        return "Tracker file was deleted."

    if original_text == current:
        return "none"

    try:
        orig_data = json.loads(original_text)
        curr_data = json.loads(current)
        orig_norm = normalize_tracker_for_diff(orig_data)
        curr_norm = normalize_tracker_for_diff(curr_data)
        if orig_norm == curr_norm:
            return "none (whitespace/ordering change only)"
    except json.JSONDecodeError:
        pass

    # Build a simple line-diff summary
    import difflib

    orig_lines = original_text.splitlines(keepends=True)
    curr_lines = current.splitlines(keepends=True)
    diff_lines = list(
        difflib.unified_diff(orig_lines, curr_lines, fromfile="tracker.orig", tofile="tracker.new", n=3)
    )
    if not diff_lines:
        return "none"
    return "".join(diff_lines[:200])  # cap at 200 diff lines for readability
