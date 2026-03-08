"""review_supervisor.py — self-healing outer loop for the review lane.

When the review loop stops unexpectedly (non-zero exit, campaign not yet complete),
the supervisor:
  1. Reads the last cycle's summary.json and cycle.log to understand the failure
  2. Calls OpenAI to diagnose the root cause and propose fix actions
  3. Applies fix actions to the tracker JSON (reset stop policy, re-queue entries, etc.)
  4. Re-runs the review loop
  5. Repeats up to REPO_CITY_REVIEW_MAX_REPAIRS times (default 5)

Run via:
    python3 -m agent.review_supervisor
or via the repo-city-review-supervised shell wrapper.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from openai import OpenAI

from .review_config import load_review_config
from .review_tracker import load_review_tracker, summarize_review_tracker


# ---------------------------------------------------------------------------
# Context collection
# ---------------------------------------------------------------------------


def _find_latest_log_dir(log_dir_abs: str) -> Optional[Path]:
    """Return the most recently modified log subdirectory."""
    log_root = Path(log_dir_abs)
    if not log_root.exists():
        return None
    subdirs = [d for d in log_root.iterdir() if d.is_dir()]
    if not subdirs:
        return None
    return max(subdirs, key=lambda d: d.stat().st_mtime)


def _read_last_cycle_context(log_dir_abs: str) -> Dict[str, Any]:
    """Return summary.json contents and last 60 lines of cycle.log."""
    latest = _find_latest_log_dir(log_dir_abs)
    if not latest:
        return {}

    ctx: Dict[str, Any] = {"log_dir": str(latest)}

    summary_path = latest / "summary.json"
    if summary_path.exists():
        try:
            with open(summary_path, encoding="utf-8") as fh:
                ctx["summary"] = json.load(fh)
        except Exception as exc:
            ctx["summary_error"] = str(exc)

    log_path = latest / "cycle.log"
    if log_path.exists():
        try:
            with open(log_path, encoding="utf-8") as fh:
                lines = fh.readlines()
            ctx["cycle_log_tail"] = "".join(lines[-60:])
        except Exception as exc:
            ctx["cycle_log_error"] = str(exc)

    return ctx


# ---------------------------------------------------------------------------
# OpenAI diagnosis
# ---------------------------------------------------------------------------

_REPAIR_SYSTEM = """\
You are a repair agent for the merge-crimes automated code review system.

The review loop stopped unexpectedly. Diagnose the issue and return fix actions.

KNOWN FAILURE PATTERNS AND THEIR FIXES:
1. parse_error is set → Codex output lacked a JSON block (transient formatting issue)
   Fix: restart_only
2. stop_reason contains "below threshold" AND review queue entries are uncovered
   Fix: reset_stop_policy + reset_queue_entries for any queue IDs that appear uncovered
3. stop_reason contains "No pending queue entries" but campaign is incomplete
   Fix: reset_queue_entries for relevant pending review entries
4. cycle_valid = false in apply_fix mode → changes were already reverted, safe to restart
   Fix: restart_only
5. stop_reason contains "consecutive cycles with no new findings"
   Fix: reset_consecutive_no_findings + restart_only
6. stop_reason contains "Top queue score" below threshold
   Fix: reset_stop_policy
7. Any unrecognised error → restart_only (give the loop another chance)

VALID ACTION TYPES (include only what is needed):
  {"type": "restart_only"}
  {"type": "reset_stop_policy"}
  {"type": "reset_queue_entries", "ids": ["q-007", "q-008", ...]}
  {"type": "reset_consecutive_no_findings"}

Return ONLY this JSON — no commentary, no markdown fences:
{"diagnosis": "<one sentence>", "actions": [...]}
"""


def _call_openai_for_repair(
    client: OpenAI,
    model: str,
    ctx: Dict[str, Any],
    tracker_summary: str,
) -> Dict[str, Any]:
    """Ask OpenAI to diagnose the failure and return fix actions."""
    summary = ctx.get("summary", {})
    stop_reason   = summary.get("stop_reason", "")
    parse_error   = summary.get("parse_error", "")
    error         = summary.get("error", "")
    cycle_valid   = summary.get("cycle_valid", True)
    mode          = summary.get("mode", "")
    workstream    = summary.get("workstream", "")
    should_stop   = summary.get("should_stop", False)
    cycle_log     = ctx.get("cycle_log_tail", "(no log available)")

    user_msg = f"""\
FAILURE CONTEXT:
  stop_reason:  {stop_reason!r}
  parse_error:  {parse_error!r}
  error:        {error!r}
  cycle_valid:  {cycle_valid}
  mode:         {mode!r}
  workstream:   {workstream!r}
  should_stop:  {should_stop}

LAST CYCLE LOG (last 60 lines):
{cycle_log}

TRACKER SUMMARY:
{tracker_summary}

Diagnose the root cause and return the fix actions JSON.
"""

    response = client.responses.create(
        model=model,
        instructions=_REPAIR_SYSTEM,
        input=user_msg,
    )
    text = response.output_text.strip()

    # Strip markdown fences if present
    text = re.sub(r"^```[a-z]*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?```$", "", text, flags=re.MULTILINE)

    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON found in OpenAI repair response: {text[:300]}")
    return json.loads(match.group())


# ---------------------------------------------------------------------------
# Fix action application
# ---------------------------------------------------------------------------


def _apply_fix_actions(
    actions: List[Dict[str, Any]],
    tracker_path: str,
    log_fn=print,
) -> None:
    """Apply the LLM-proposed fix actions to the tracker JSON."""
    try:
        with open(tracker_path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as exc:
        log_fn(f"[supervisor] Cannot read tracker for repair: {exc}")
        return

    changed = False

    for action in actions:
        kind = action.get("type", "")

        if kind == "restart_only":
            log_fn("[supervisor]   action=restart_only — no tracker changes required")

        elif kind == "reset_stop_policy":
            sp = data.setdefault("stop_policy", {})
            sp["triggered"] = False
            sp["trigger_reason"] = None
            sp["consecutive_no_findings"] = 0
            # If campaign was marked stopped by the policy, reopen it
            if data.get("campaign", {}).get("state") == "stopped":
                data["campaign"]["state"] = "running"
            log_fn("[supervisor]   action=reset_stop_policy — cleared triggered flag and stall counter")
            changed = True

        elif kind == "reset_queue_entries":
            ids_to_reset = set(action.get("ids", []))
            reset_count = 0
            for entry in data.get("queue", []):
                if entry.get("id") in ids_to_reset and entry.get("status") != "pending":
                    entry["status"] = "pending"
                    entry.pop("completed_at", None)
                    reset_count += 1
            log_fn(
                f"[supervisor]   action=reset_queue_entries — "
                f"reset {reset_count}/{len(ids_to_reset)} entries to pending"
            )
            if reset_count:
                changed = True

        elif kind == "reset_consecutive_no_findings":
            sp = data.setdefault("stop_policy", {})
            sp["consecutive_no_findings"] = 0
            sp["triggered"] = False
            sp["trigger_reason"] = None
            log_fn("[supervisor]   action=reset_consecutive_no_findings — cleared stall counter")
            changed = True

        else:
            log_fn(f"[supervisor]   unknown action {kind!r} — skipped")

    if changed:
        with open(tracker_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        log_fn(f"[supervisor] Tracker updated: {tracker_path}")


# ---------------------------------------------------------------------------
# Campaign state check
# ---------------------------------------------------------------------------


def _is_campaign_complete(tracker_path: str) -> bool:
    """Return True if the campaign is complete (no pending queue entries)."""
    try:
        with open(tracker_path, encoding="utf-8") as fh:
            data = json.load(fh)
        if data.get("campaign", {}).get("state") in ("complete", "stopped"):
            return True
        pending = [e for e in data.get("queue", []) if e.get("status") == "pending"]
        return len(pending) == 0
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Supervisor loop
# ---------------------------------------------------------------------------


def loop() -> int:
    """Run the review loop with self-healing on unexpected stops."""
    cfg = load_review_config()
    openai_client = OpenAI(api_key=cfg.openai_api_key)
    tracker_path = cfg.review_tracker_path
    max_repairs = int(os.environ.get("REPO_CITY_REVIEW_MAX_REPAIRS", "5"))

    # Subprocess command — inherits the current environment (DRY_RUN etc.)
    cmd = [sys.executable, "-m", "agent.review_loop"]

    print("\n" + "=" * 72)
    print("REPO-CITY-REVIEW-SUPERVISOR — self-healing review runner")
    print(f"  Max repair attempts: {max_repairs}")
    print(f"  Dry run:             {cfg.dry_run}")
    print(f"  Tracker:             {tracker_path}")
    print("=" * 72 + "\n")

    for attempt in range(max_repairs + 1):

        if _is_campaign_complete(tracker_path):
            print("\n[supervisor] Campaign complete. Done.")
            return 0

        if attempt > 0:
            print(f"\n[supervisor] ── Repair attempt {attempt}/{max_repairs} — restarting loop ──")
            time.sleep(5)

        # ── Run the review loop ──────────────────────────────────────────
        result = subprocess.run(cmd, env=os.environ.copy())
        exit_code = result.returncode

        if exit_code == 0 or _is_campaign_complete(tracker_path):
            print("\n[supervisor] Review loop completed successfully.")
            return 0

        if attempt >= max_repairs:
            print(
                f"\n[supervisor] Max repair attempts ({max_repairs}) reached without recovery.\n"
                "  Check the last summary.json and cycle.log for details."
            )
            return 1

        # ── Diagnose ─────────────────────────────────────────────────────
        print(f"\n[supervisor] Loop exited with code {exit_code}. Calling LLM to diagnose...")
        ctx = _read_last_cycle_context(cfg.log_dir_abs)

        try:
            tracker_data = load_review_tracker(tracker_path)
            tracker_summary = summarize_review_tracker(tracker_data)
        except Exception as exc:
            tracker_summary = f"(tracker unreadable: {exc})"

        try:
            repair = _call_openai_for_repair(openai_client, cfg.openai_model, ctx, tracker_summary)
            diagnosis = repair.get("diagnosis", "unknown")
            actions = repair.get("actions", [{"type": "restart_only"}])
            print(f"[supervisor] Diagnosis: {diagnosis}")
        except Exception as exc:
            print(f"[supervisor] OpenAI repair call failed ({exc}) — defaulting to restart_only")
            actions = [{"type": "restart_only"}]

        # ── Apply fixes ──────────────────────────────────────────────────
        _apply_fix_actions(actions, tracker_path, log_fn=print)

    return 1


def main() -> int:
    return loop()


if __name__ == "__main__":
    sys.exit(main())
