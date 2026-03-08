"""Findings model for the review lane.

Parses Codex review output, validates findings, deduplicates against existing
findings, persists to findings.json, and converts findings to fix-queue entries.

A finding is only stored if:
  - The JSON block is present and parseable
  - file_path is non-empty and exists on disk
  - description and evidence are non-empty

If any of these checks fail, the finding is dropped with a logged reason.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Finding dataclass
# ---------------------------------------------------------------------------


_VALID_SEVERITIES = {"high", "medium", "low"}
_VALID_CATEGORIES = {
    "dead_code", "duplication", "complexity", "architecture",
    "unnecessary_abstraction", "overengineering",
    "security_or_trust_boundary", "test_gap", "correctness",
    "regression_risk", "edge_case", "other",
}
_VALID_STATUSES = {"open", "resolved", "dismissed"}


@dataclass
class Finding:
    id: str                         # f-NNNNNN
    workstream_id: str
    rule_id: str                    # e.g. "DC-001"
    severity: str                   # high | medium | low
    confidence: float               # 0..1
    category: str
    file_path: str
    line_start: int
    symbol: str
    description: str
    evidence: str
    recommended_action: str
    status: str = "open"
    found_at: str = ""
    cycle_number: int = 0

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ---------------------------------------------------------------------------
# Rule ID generation
# ---------------------------------------------------------------------------

_CATEGORY_PREFIX = {
    "dead_code":                  "DC",
    "duplication":                "DUP",
    "complexity":                 "CC",
    "architecture":               "ARCH",
    "unnecessary_abstraction":    "UA",
    "overengineering":            "OE",
    "security_or_trust_boundary": "SEC",
    "test_gap":                   "TG",
    "correctness":                "COR",
    "regression_risk":            "RR",
    "edge_case":                  "EC",
    "other":                      "OTH",
}


def _make_rule_id(category: str, sequence: int) -> str:
    prefix = _CATEGORY_PREFIX.get(category, "UNK")
    return f"{prefix}-{sequence:03d}"


def _next_sequence(existing: List[Finding], category: str) -> int:
    prefix = _CATEGORY_PREFIX.get(category, "UNK")
    existing_nums = []
    for f in existing:
        if f.rule_id.startswith(prefix + "-"):
            try:
                existing_nums.append(int(f.rule_id.split("-")[1]))
            except (IndexError, ValueError):
                pass
    return max(existing_nums, default=0) + 1


# ---------------------------------------------------------------------------
# Finding ID generation
# ---------------------------------------------------------------------------


def _next_finding_id(existing: List[Finding]) -> str:
    existing_nums = []
    for f in existing:
        if f.id.startswith("f-"):
            try:
                existing_nums.append(int(f.id[2:]))
            except ValueError:
                pass
    next_num = max(existing_nums, default=0) + 1
    return f"f-{next_num:06d}"


# ---------------------------------------------------------------------------
# Parse Codex review output
# ---------------------------------------------------------------------------


def parse_findings_from_codex_output(
    stdout: str,
    workstream_id: str,
    cycle_number: int,
    existing_findings: Optional[List[Finding]] = None,
) -> Tuple[List[Finding], str]:
    """Extract the JSON findings block from Codex stdout.

    Returns (findings, error_message).
    error_message is "" on success; non-empty string means the cycle is invalid.

    Handles:
    - Raw JSON: {"findings": [...]}
    - Fenced: ```json\n{"findings": [...]}\n```
    - Also accepts a top-level list: [{"file": ...}, ...]
    """
    if existing_findings is None:
        existing_findings = []

    raw = stdout.strip()
    if not raw:
        return [], "Codex output is empty — no findings block present"

    # Try to extract JSON block
    parsed_raw = None

    # Attempt 1: fenced ```json block
    fenced_match = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", raw, re.DOTALL)
    if fenced_match:
        try:
            parsed_raw = json.loads(fenced_match.group(1))
        except json.JSONDecodeError:
            pass

    # Attempt 2: find {"findings": ...} anywhere in the output
    if parsed_raw is None:
        findings_match = re.search(r'\{"findings"\s*:\s*\[.*?\]\s*\}', raw, re.DOTALL)
        if findings_match:
            try:
                parsed_raw = json.loads(findings_match.group(0))
            except json.JSONDecodeError:
                pass

    # Attempt 3: raw JSON parse of entire output
    if parsed_raw is None:
        try:
            parsed_raw = json.loads(raw)
        except json.JSONDecodeError:
            pass

    if parsed_raw is None:
        return [], (
            "Could not parse a JSON findings block from Codex output. "
            "Review mode requires exactly one {\"findings\":[...]} JSON block. "
            "Check cycle_prompt.txt and codex_stdout.txt for details."
        )

    # Normalise: accept top-level list or {"findings": [...]}
    if isinstance(parsed_raw, list):
        raw_findings = parsed_raw
    elif isinstance(parsed_raw, dict):
        raw_findings = parsed_raw.get("findings", [])
    else:
        return [], f"Unexpected JSON root type: {type(parsed_raw).__name__} (expected dict or list)"

    if not isinstance(raw_findings, list):
        return [], "'findings' value must be a JSON array"

    # Convert to Finding objects
    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    findings: List[Finding] = []
    all_existing = list(existing_findings)

    for idx, raw_f in enumerate(raw_findings):
        if not isinstance(raw_f, dict):
            continue

        # Normalise field names (Codex may use "file" or "file_path")
        file_path = (
            raw_f.get("file_path") or raw_f.get("file") or raw_f.get("filepath") or ""
        ).strip()
        severity = str(raw_f.get("severity", "medium")).lower().strip()
        if severity not in _VALID_SEVERITIES:
            severity = "medium"

        category = str(raw_f.get("category", "other")).lower().strip()
        if category not in _VALID_CATEGORIES:
            category = "other"

        confidence_raw = raw_f.get("confidence", 0.7)
        try:
            confidence = float(confidence_raw)
            confidence = max(0.0, min(1.0, confidence))
        except (TypeError, ValueError):
            confidence = 0.7

        line_raw = raw_f.get("line", raw_f.get("line_start", 0))
        try:
            line_start = int(line_raw)
        except (TypeError, ValueError):
            line_start = 0

        description = str(raw_f.get("description", "")).strip()
        evidence = str(raw_f.get("evidence", "")).strip()
        symbol = str(raw_f.get("symbol", raw_f.get("name", ""))).strip()
        recommended_action = str(
            raw_f.get("recommended_action", raw_f.get("recommendation", ""))
        ).strip()

        finding = Finding(
            id=_next_finding_id(all_existing + findings),
            workstream_id=workstream_id,
            rule_id=_make_rule_id(category, _next_sequence(all_existing + findings, category)),
            severity=severity,
            confidence=confidence,
            category=category,
            file_path=file_path,
            line_start=line_start,
            symbol=symbol,
            description=description,
            evidence=evidence,
            recommended_action=recommended_action,
            status="open",
            found_at=now_ts,
            cycle_number=cycle_number,
        )
        findings.append(finding)

    return findings, ""


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------


def validate_finding(f: Finding, repo_root: str) -> Tuple[bool, str]:
    """Return (ok, reason).

    Required:
    - file_path non-empty
    - file_path exists on disk (relative to repo_root)
    - description non-empty
    - evidence non-empty
    """
    if not f.file_path:
        return False, "file_path is empty"
    if not f.description:
        return False, "description is empty"
    if not f.evidence:
        return False, "evidence is empty"

    full_path = os.path.join(repo_root, f.file_path)
    if not os.path.isfile(full_path):
        # Also check without repo_root prefix (Codex may use absolute paths)
        if not os.path.isfile(f.file_path):
            return False, f"file does not exist: {f.file_path}"

    return True, ""


# ---------------------------------------------------------------------------
# Deduplicate
# ---------------------------------------------------------------------------


def _dedup_key(f: Finding) -> tuple:
    return (f.file_path, f.symbol.lower(), f.category)


def deduplicate_findings(
    new_findings: List[Finding],
    existing_findings: List[Finding],
) -> List[Finding]:
    """Return new_findings minus any already in existing_findings.

    Deduplication key: (file_path, symbol.lower(), category).
    """
    existing_keys = {_dedup_key(f) for f in existing_findings}
    result = []
    seen_in_batch = set()

    for f in new_findings:
        key = _dedup_key(f)
        if key not in existing_keys and key not in seen_in_batch:
            result.append(f)
            seen_in_batch.add(key)

    return result


# ---------------------------------------------------------------------------
# Persist
# ---------------------------------------------------------------------------


def persist_findings(
    new_findings: List[Finding],
    artifacts_dir: str,
    dry_run: bool = True,
) -> str:
    """Merge new findings into findings.json (or .dryrun).

    Returns the path written.
    """
    os.makedirs(artifacts_dir, exist_ok=True)

    live_path = os.path.join(artifacts_dir, "findings.json")
    dest_path = live_path + (".dryrun" if dry_run else "")

    # Load existing findings from the live file (or dryrun shadow)
    existing_data: Dict[str, Any] = {"findings": []}
    for candidate in (dest_path, live_path):
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as fh:
                    existing_data = json.load(fh)
                break
            except (json.JSONDecodeError, OSError):
                pass

    existing_list = existing_data.get("findings", [])
    existing_ids = {f.get("id") for f in existing_list}

    for f in new_findings:
        if f.id not in existing_ids:
            existing_list.append(f.as_dict())
            existing_ids.add(f.id)

    output = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_count": len(existing_list),
        "findings": existing_list,
    }

    with open(dest_path, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)

    return dest_path


def load_findings_from_artifacts(artifacts_dir: str) -> List[Finding]:
    """Load persisted findings from artifacts_dir/findings.json (or .dryrun)."""
    result = []
    for candidate in (
        os.path.join(artifacts_dir, "findings.json.dryrun"),
        os.path.join(artifacts_dir, "findings.json"),
    ):
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                for raw in data.get("findings", []):
                    try:
                        f = Finding(
                            id=raw.get("id", ""),
                            workstream_id=raw.get("workstream_id", ""),
                            rule_id=raw.get("rule_id", ""),
                            severity=raw.get("severity", "medium"),
                            confidence=float(raw.get("confidence", 0.7)),
                            category=raw.get("category", "other"),
                            file_path=raw.get("file_path", ""),
                            line_start=int(raw.get("line_start", 0)),
                            symbol=raw.get("symbol", ""),
                            description=raw.get("description", ""),
                            evidence=raw.get("evidence", ""),
                            recommended_action=raw.get("recommended_action", ""),
                            status=raw.get("status", "open"),
                            found_at=raw.get("found_at", ""),
                            cycle_number=int(raw.get("cycle_number", 0)),
                        )
                        result.append(f)
                    except (TypeError, ValueError):
                        continue
                break
            except (json.JSONDecodeError, OSError):
                pass
    return result


# ---------------------------------------------------------------------------
# Build fix queue entries
# ---------------------------------------------------------------------------


def finding_to_fix_queue_entry(
    f: Finding,
    existing_queue: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Build a mode='fix' queue entry for a finding.

    Returns None if a fix entry for this finding already exists in the queue.
    Only creates entries for high or medium severity findings.
    """
    if f.severity == "low":
        return None

    # Don't duplicate fix entries
    for entry in existing_queue:
        if entry.get("mode") == "fix" and entry.get("finding_id") == f.id:
            return None

    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    queue_id = f"qfix-{f.id}"

    return {
        "id": queue_id,
        "mode": "fix",
        "finding_id": f.id,
        "workstream_id": f.workstream_id,
        "title": f"Fix: {f.description[:80]}",
        "severity": f.severity,
        "status": "pending",
        "score": 0.0,
        "priority_override": None,
        "added_at": now_ts,
    }


def build_fix_queue_entries(
    findings: List[Finding],
    existing_queue: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Return new fix queue entries for all high/medium findings."""
    entries = []
    for f in findings:
        entry = finding_to_fix_queue_entry(f, existing_queue)
        if entry:
            entries.append(entry)
    return entries


# ---------------------------------------------------------------------------
# Removal candidates
# ---------------------------------------------------------------------------


def build_removal_candidates(
    findings: List[Finding],
    decisions_path: str,
) -> List[Dict[str, Any]]:
    """Return findings suitable for safe removal.

    Excludes:
    - Low severity findings
    - Findings with a 'keep' or 'defer' decision in decisions.json
    """
    # Load decisions
    keep_ids: set = set()
    if os.path.isfile(decisions_path):
        try:
            with open(decisions_path, "r", encoding="utf-8") as fh:
                decisions = json.load(fh)
            for d in decisions.get("decisions", []):
                if d.get("verdict") in ("keep", "defer"):
                    keep_ids.add(d.get("finding_id", ""))
        except (json.JSONDecodeError, OSError):
            pass

    candidates = []
    for f in findings:
        if f.status in ("resolved", "dismissed"):
            continue
        if f.severity == "low":
            continue
        if f.id in keep_ids:
            continue
        candidates.append({
            "finding_id": f.id,
            "workstream_id": f.workstream_id,
            "rule_id": f.rule_id,
            "severity": f.severity,
            "file_path": f.file_path,
            "symbol": f.symbol,
            "category": f.category,
            "rationale": f.description,
            "evidence": f.evidence[:200],
            "recommended_action": f.recommended_action,
        })

    return candidates


def persist_removal_candidates(
    candidates: List[Dict[str, Any]],
    artifacts_dir: str,
    dry_run: bool = True,
) -> str:
    """Save removal_candidates.json (or .dryrun).  Returns path written."""
    os.makedirs(artifacts_dir, exist_ok=True)
    filename = "removal_candidates.json" + (".dryrun" if dry_run else "")
    dest = os.path.join(artifacts_dir, filename)

    output = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "candidate_count": len(candidates),
        "candidates": candidates,
    }
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(output, fh, indent=2, ensure_ascii=False)
    return dest
