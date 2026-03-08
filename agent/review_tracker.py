"""Tracker management for docs/REPO_CITY_REVIEW_TRACKER.json.

Provides load, validate, snapshot, restore, diff, query, scoring, and
stop-policy evaluation for the review campaign tracker.  Never writes to the
live tracker directly in dry_run mode; callers handle all writes.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Load / validate
# ---------------------------------------------------------------------------


def load_review_tracker(path: str) -> Dict[str, Any]:
    """Read and JSON-parse the review tracker.  Raises on parse error."""
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Review tracker JSON parse error: {exc}") from exc
    validate_review_tracker_json(data)
    return data


def validate_review_tracker_json(data: Any) -> None:
    """Raise ValueError if data does not look like a valid review tracker."""
    if not isinstance(data, dict):
        raise ValueError("Review tracker root must be a JSON object.")
    required = ("campaign", "workstreams", "queue", "findings", "stop_policy")
    for key in required:
        if key not in data:
            raise ValueError(
                f"Review tracker missing required key: '{key}'. "
                f"Expected keys: {required}"
            )
    if not isinstance(data["workstreams"], list) or len(data["workstreams"]) == 0:
        raise ValueError("Review tracker 'workstreams' must be a non-empty list.")
    if not isinstance(data["queue"], list):
        raise ValueError("Review tracker 'queue' must be a list.")
    if not isinstance(data["findings"], list):
        raise ValueError("Review tracker 'findings' must be a list.")


# ---------------------------------------------------------------------------
# Campaign state
# ---------------------------------------------------------------------------


_TERMINAL_CAMPAIGN_STATES = {"stopped", "complete"}


def get_campaign_state(data: Dict[str, Any]) -> str:
    """Return data['campaign']['state']."""
    return str(data.get("campaign", {}).get("state", "pending"))


def is_campaign_active(data: Dict[str, Any]) -> bool:
    """Return True if the campaign is still running."""
    return get_campaign_state(data) not in _TERMINAL_CAMPAIGN_STATES


# ---------------------------------------------------------------------------
# Queue queries
# ---------------------------------------------------------------------------


def get_pending_queue(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return all queue entries with status 'pending'."""
    return [e for e in data.get("queue", []) if e.get("status") == "pending"]


def get_pending_review_queue(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return pending queue entries with mode='review'."""
    return [
        e for e in data.get("queue", [])
        if e.get("status") == "pending" and e.get("mode") == "review"
    ]


def get_pending_fix_queue(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return pending queue entries with mode='fix'."""
    return [
        e for e in data.get("queue", [])
        if e.get("status") == "pending" and e.get("mode") == "fix"
    ]


def get_open_findings(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return findings whose status is not resolved or dismissed."""
    closed = {"resolved", "dismissed"}
    return [f for f in data.get("findings", []) if f.get("status") not in closed]


def get_finding_by_id(data: Dict[str, Any], finding_id: str) -> Optional[Dict[str, Any]]:
    """Return the finding dict with the given id, or None."""
    for f in data.get("findings", []):
        if f.get("id") == finding_id:
            return f
    return None


def _get_workstream(data: Dict[str, Any], workstream_id: str) -> Optional[Dict[str, Any]]:
    """Return the workstream dict with the given id, or None."""
    for ws in data.get("workstreams", []):
        if ws.get("id") == workstream_id:
            return ws
    return None


def summarize_review_tracker(data: Dict[str, Any]) -> str:
    """Return a compact text summary for prompt context."""
    lines: List[str] = []
    campaign = data.get("campaign", {})
    lines.append(f"Campaign: {campaign.get('id', 'unknown')} — state: {campaign.get('state', 'unknown')}")
    lines.append(f"Cycles run: {campaign.get('cycles_run', 0)}")
    lines.append(f"Total findings: {campaign.get('total_findings', 0)}  Resolved: {campaign.get('total_resolved', 0)}")

    open_findings = get_open_findings(data)
    lines.append(f"Open findings: {len(open_findings)}")

    pending = get_pending_queue(data)
    review_q = [e for e in pending if e.get("mode") == "review"]
    fix_q = [e for e in pending if e.get("mode") == "fix"]
    lines.append(f"Queue: {len(review_q)} review entries, {len(fix_q)} fix entries pending")

    lines.append("\nWorkstreams:")
    for ws in data.get("workstreams", []):
        lines.append(
            f"  [{ws.get('id')}] {ws.get('name', '?')} — "
            f"cycles: {ws.get('cycles_assigned', 0)}, "
            f"open: {ws.get('findings_open', 0)}"
        )

    csr = data.get("current_slice_recommendation")
    if csr and isinstance(csr, dict):
        lines.append(f"\nNext slice: {csr.get('title', '?')} ({csr.get('mode', '?')} mode, score={csr.get('score', 0.0):.1f})")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def _severity_density(data: Dict[str, Any], workstream_id: str) -> float:
    """Fraction of open high/medium findings belonging to this workstream."""
    all_open = get_open_findings(data)
    if not all_open:
        return 0.0
    ws_high_med = sum(
        1 for f in all_open
        if f.get("workstream_id") == workstream_id
        and f.get("severity") in ("high", "medium")
    )
    return min(1.0, ws_high_med / max(1, len(all_open)))


def _recency_norm(last_run_iso: Optional[str], now_iso: str) -> float:
    """Normalised recency score — older = higher.  Saturates at 14 days."""
    if not last_run_iso:
        return 1.0
    try:
        def _parse(s: str) -> datetime:
            s = s.replace("Z", "+00:00")
            return datetime.fromisoformat(s)
        last = _parse(last_run_iso)
        now = _parse(now_iso)
        days = max(0.0, (now - last).total_seconds() / 86400.0)
        return min(1.0, days / 14.0)
    except Exception:
        return 1.0


def _coverage_gap(data: Dict[str, Any], workstream_id: str) -> float:
    """Rough proxy: 1.0 if workstream has never run, decreasing thereafter."""
    ws = _get_workstream(data, workstream_id)
    if not ws:
        return 1.0
    cycles = ws.get("cycles_assigned", 0)
    # Simple proxy: gap reduces by 0.2 per cycle, floored at 0
    return max(0.0, 1.0 - cycles * 0.2)


def score_queue_entry(
    entry: Dict[str, Any],
    data: Dict[str, Any],
    now_iso: str,
    weight_severity: float = 3.0,
    weight_recency: float = 1.5,
    weight_coverage_gap: float = 2.0,
    weight_starvation: float = 1.0,
) -> float:
    """Compute a numeric score for one queue entry.

    For review entries: weighted combination of severity density, recency,
    coverage gap, and workstream starvation.

    For fix entries: severity_bonus * confidence.
    """
    mode = entry.get("mode", "review")

    if mode == "fix":
        severity = entry.get("severity", "medium")
        severity_bonus = {"high": 3.0, "medium": 2.0, "low": 1.0}.get(severity, 2.0)
        # Look up confidence from the linked finding
        finding_id = entry.get("finding_id")
        confidence = 0.7
        if finding_id:
            finding = get_finding_by_id(data, finding_id)
            if finding:
                confidence = float(finding.get("confidence", 0.7))
        score = severity_bonus * confidence
    else:
        # review entry
        ws_id = entry.get("workstream_id", "")
        ws = _get_workstream(data, ws_id)
        last_run = ws.get("last_run_at") if ws else None
        cycles_assigned = ws.get("cycles_assigned", 0) if ws else 0

        S = _severity_density(data, ws_id)
        R = _recency_norm(last_run, now_iso)
        C = _coverage_gap(data, ws_id)
        W = 1.0 / (1.0 + cycles_assigned)

        score = (
            weight_severity * S
            + weight_recency * R
            + weight_coverage_gap * C
            + weight_starvation * W
        )

    # Apply priority override
    override = entry.get("priority_override")
    if override == "urgent":
        score *= 2.0
    elif override == "deprioritize":
        score *= 0.5

    return round(score, 4)


def rank_queue(
    data: Dict[str, Any],
    now_iso: str,
    weight_severity: float = 3.0,
    weight_recency: float = 1.5,
    weight_coverage_gap: float = 2.0,
    weight_starvation: float = 1.0,
) -> List[Tuple[float, Dict[str, Any]]]:
    """Return list of (score, entry) for pending entries, sorted descending."""
    pending = get_pending_queue(data)
    scored = [
        (
            score_queue_entry(
                e, data, now_iso,
                weight_severity, weight_recency, weight_coverage_gap, weight_starvation
            ),
            e,
        )
        for e in pending
    ]
    # Sort descending by score; tie-break by workstream priority then added_at
    def sort_key(item: Tuple[float, Dict]) -> tuple:
        sc, entry = item
        ws_id = entry.get("workstream_id", "")
        ws = _get_workstream(data, ws_id)
        ws_priority = ws.get("priority", 99) if ws else 99
        added_at = entry.get("added_at", "")
        return (-sc, ws_priority, added_at)

    scored.sort(key=sort_key)
    return scored


def pick_winning_slice(
    data: Dict[str, Any],
    now_iso: str,
    weight_severity: float = 3.0,
    weight_recency: float = 1.5,
    weight_coverage_gap: float = 2.0,
    weight_starvation: float = 1.0,
) -> Optional[Dict[str, Any]]:
    """Return the highest-scored pending queue entry, or None."""
    ranked = rank_queue(
        data, now_iso, weight_severity, weight_recency, weight_coverage_gap, weight_starvation
    )
    if not ranked:
        return None
    return ranked[0][1]


def pick_winning_slice_by_mode(
    data: Dict[str, Any],
    mode: str,
    now_iso: str,
    weight_severity: float = 3.0,
    weight_recency: float = 1.5,
    weight_coverage_gap: float = 2.0,
    weight_starvation: float = 1.0,
    max_ws_review_cycles: int = 5,
) -> Optional[Dict[str, Any]]:
    """Return the highest-scored pending entry matching the given mode.

    Normalises mode names so the orchestrator's "review_only" / "apply_fix"
    values match the tracker's stored "review" / "fix" entry modes.

    For review mode, enforces workstream rotation via three passes:
      Pass 1 — prefer workstreams never run (cycles_assigned == 0)
      Pass 2 — prefer workstreams under the per-workstream cap
      Pass 3 — accept any remaining review entry (ignores cap)
    """
    # Map orchestrator mode names → tracker entry mode values
    _MODE_MAP = {"review_only": "review", "apply_fix": "fix"}
    entry_mode = _MODE_MAP.get(mode, mode)  # fall back to raw value if already normalised

    ranked = rank_queue(
        data, now_iso, weight_severity, weight_recency, weight_coverage_gap, weight_starvation
    )

    if entry_mode == "review":
        # Pass 1: workstreams that have never been reviewed
        for _score, entry in ranked:
            if entry.get("mode") != "review":
                continue
            ws = _get_workstream(data, entry.get("workstream_id", ""))
            if ws is not None and ws.get("cycles_assigned", 0) == 0:
                return entry
        # Pass 2: workstreams under the per-workstream cycle cap
        for _score, entry in ranked:
            if entry.get("mode") != "review":
                continue
            ws = _get_workstream(data, entry.get("workstream_id", ""))
            if ws is None or ws.get("cycles_assigned", 0) < max_ws_review_cycles:
                return entry
        # Pass 3: cap exhausted — pick best-scored remaining review entry
        for _score, entry in ranked:
            if entry.get("mode") == "review":
                return entry
        return None

    for _score, entry in ranked:
        if entry.get("mode") == entry_mode:
            return entry
    return None


# ---------------------------------------------------------------------------
# Stop policy
# ---------------------------------------------------------------------------


def evaluate_stop_policy(
    data: Dict[str, Any],
    cycles_run: int,
    max_cycles: int,
    stop_on_score_below: float,
    stop_on_findings_below: int,
    max_consecutive_no_findings: int,
    consecutive_no_findings: int,
    now_iso: str,
) -> Tuple[bool, str]:
    """Return (should_stop, reason).  Deterministic.  First match wins.

    Check order:
    1. max_cycles reached
    2. campaign state is terminal
    3. no pending queue entries
    4. top queue score below threshold
    5. open findings below threshold AND sufficient coverage
    6. consecutive no-findings stall guard
    """
    campaign = data.get("campaign", {})

    # 1. Max cycles
    if cycles_run >= max_cycles:
        return True, f"Max cycles reached ({max_cycles})"

    # 2. Terminal campaign state
    if campaign.get("state") in _TERMINAL_CAMPAIGN_STATES:
        return True, f"Campaign state is '{campaign['state']}'"

    # 3. No pending queue entries
    pending = get_pending_queue(data)
    if not pending:
        return True, "No pending queue entries remain — campaign complete"

    # 4. Top queue score below threshold
    ranked = rank_queue(data, now_iso)
    if ranked:
        top_score = ranked[0][0]
        if top_score < stop_on_score_below:
            return True, (
                f"Top queue score {top_score:.2f} is below threshold "
                f"{stop_on_score_below:.2f}"
            )

    # 5. Open findings below threshold AND enough coverage AND all workstreams covered
    open_findings = get_open_findings(data)
    workstream_count = max(1, len(data.get("workstreams", [])))
    # Only stop on low-findings once every review workstream has run at least once
    uncovered = [
        e for e in get_pending_review_queue(data)
        if (
            (lambda ws: ws is not None and ws.get("cycles_assigned", 0) == 0)(
                _get_workstream(data, e.get("workstream_id", ""))
            )
        )
    ]
    if (
        len(open_findings) < stop_on_findings_below
        and cycles_run >= workstream_count * 2
        and len(uncovered) == 0
    ):
        return True, (
            f"Open findings ({len(open_findings)}) below threshold "
            f"({stop_on_findings_below}) after sufficient coverage"
        )

    # 6. Stall guard
    if consecutive_no_findings >= max_consecutive_no_findings:
        return True, (
            f"{consecutive_no_findings} consecutive cycles with no new findings "
            f"(threshold: {max_consecutive_no_findings})"
        )

    return False, ""


# ---------------------------------------------------------------------------
# Snapshot / restore / diff
# ---------------------------------------------------------------------------


def snapshot_review_tracker_text(path: str) -> str:
    """Return the raw text of the review tracker file (for later restore)."""
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def restore_review_tracker_text(path: str, original_text: str) -> None:
    """Overwrite the review tracker with original_text (revert changes)."""
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(original_text)


def normalize_review_tracker_for_diff(data: Dict[str, Any]) -> str:
    """Return a stable, sorted JSON string for diffable comparison."""
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False)


def review_tracker_changed(original_text: str, path: str) -> bool:
    """Return True if the review tracker has changed since original_text."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            current = fh.read()
        try:
            orig_norm = normalize_review_tracker_for_diff(json.loads(original_text))
            curr_norm = normalize_review_tracker_for_diff(json.loads(current))
            return orig_norm != curr_norm
        except json.JSONDecodeError:
            return current != original_text
    except FileNotFoundError:
        return True


def diff_review_tracker_text(original_text: str, path: str) -> str:
    """Return a human-readable summary of review tracker changes."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            current = fh.read()
    except FileNotFoundError:
        return "Review tracker file was deleted."

    if original_text == current:
        return "none"

    try:
        orig_norm = normalize_review_tracker_for_diff(json.loads(original_text))
        curr_norm = normalize_review_tracker_for_diff(json.loads(current))
        if orig_norm == curr_norm:
            return "none (whitespace/ordering change only)"
    except json.JSONDecodeError:
        pass

    import difflib
    orig_lines = original_text.splitlines(keepends=True)
    curr_lines = current.splitlines(keepends=True)
    diff_lines = list(
        difflib.unified_diff(
            orig_lines, curr_lines,
            fromfile="review_tracker.orig", tofile="review_tracker.new", n=3
        )
    )
    if not diff_lines:
        return "none"
    return "".join(diff_lines[:200])


# ---------------------------------------------------------------------------
# Tracker mutation helpers (called by review_cycle.py to prepare updates)
# ---------------------------------------------------------------------------


def now_iso() -> str:
    """Return current UTC time as ISO 8601 string."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_tracker_update(
    data: Dict[str, Any],
    winning_entry: Dict[str, Any],
    new_findings: List[Dict[str, Any]],
    new_fix_entries: List[Dict[str, Any]],
    consecutive_no_findings: int,
    timestamp: str,
) -> Dict[str, Any]:
    """Return a mutated copy of tracker data reflecting one completed cycle.

    Does NOT write to disk — caller decides where to write.
    """
    import copy
    updated = copy.deepcopy(data)

    # Update campaign counters
    campaign = updated.setdefault("campaign", {})
    campaign["cycles_run"] = campaign.get("cycles_run", 0) + 1
    campaign["total_findings"] = campaign.get("total_findings", 0) + len(new_findings)
    campaign["last_updated"] = timestamp
    if campaign.get("state") == "pending":
        campaign["state"] = "running"

    # Mark winning entry done
    for entry in updated.get("queue", []):
        if entry.get("id") == winning_entry.get("id"):
            entry["status"] = "done"
            entry["completed_at"] = timestamp
            break

    # Append new fix entries to queue
    updated["queue"].extend(new_fix_entries)

    # Append new findings (keep tracker findings capped at 100; extras live in findings.json)
    existing_ids = {f.get("id") for f in updated.get("findings", [])}
    for f in new_findings:
        if f.get("id") not in existing_ids:
            updated["findings"].append(f)
    # Cap at 100 most recent
    if len(updated["findings"]) > 100:
        updated["findings"] = updated["findings"][-100:]

    # Update workstream stats for the processed workstream
    ws_id = winning_entry.get("workstream_id") or (
        winning_entry.get("finding_id") and _find_ws_id_from_finding(data, winning_entry.get("finding_id", ""))
    )
    if ws_id:
        for ws in updated.get("workstreams", []):
            if ws.get("id") == ws_id:
                ws["cycles_assigned"] = ws.get("cycles_assigned", 0) + 1
                ws["findings_open"] = ws.get("findings_open", 0) + len(new_findings)
                ws["last_run_at"] = timestamp
                break

    # Update stop policy consecutive counter
    sp = updated.setdefault("stop_policy", {})
    sp["consecutive_no_findings"] = consecutive_no_findings

    # Recompute scores for pending entries and update current_slice_recommendation
    for entry in updated.get("queue", []):
        if entry.get("status") == "pending":
            entry["score"] = score_queue_entry(entry, updated, timestamp)
            entry["last_scored_at"] = timestamp

    # Update current_slice_recommendation
    next_winner = pick_winning_slice(updated, timestamp)
    if next_winner:
        updated["current_slice_recommendation"] = {
            "queue_entry_id": next_winner.get("id"),
            "title": next_winner.get("title", ""),
            "mode": next_winner.get("mode", "review"),
            "workstream": next_winner.get("workstream_id", ""),
            "score": next_winner.get("score", 0.0),
            "why": "Highest-scored pending queue entry",
        }
    else:
        updated["current_slice_recommendation"] = None

    return updated


def _find_ws_id_from_finding(data: Dict[str, Any], finding_id: str) -> str:
    """Return the workstream_id of a finding, or empty string."""
    for f in data.get("findings", []):
        if f.get("id") == finding_id:
            return f.get("workstream_id", "")
    return ""
