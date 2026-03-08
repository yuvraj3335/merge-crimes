"""review_loop.py — outer loop for the repo-city review lane.

Loop behaviour:
  - Auto-selects mode (review_only or apply_fix) each cycle based on queue state.
  - REPO_CITY_REVIEW_MODE can override auto-selection.
  - Stops when the review cycle returns exit code 1 (stop policy) or 2 (fatal).
  - Stops when max_cycles is reached or stall guard fires.
  - Stall detection: N consecutive cycles with no new findings or no queue change.

Environment variables (all optional, defaults from ReviewConfig):
  REPO_CITY_REVIEW_MAX_CYCLES       default 80
  REPO_CITY_REVIEW_CYCLE_DELAY      default 10
  REPO_CITY_REVIEW_MAX_STALLED      default 4
  REPO_CITY_REVIEW_MODE             default "" (auto-select)
"""
from __future__ import annotations

import json
import os
import sys
import time
from typing import Optional, Tuple

from .review_config import load_review_config
from .review_tracker import (
    get_open_findings,
    get_pending_fix_queue,
    get_pending_review_queue,
    load_review_tracker,
)
from .review_cycle import main as run_one_review_cycle


# ---------------------------------------------------------------------------
# Progress helpers
# ---------------------------------------------------------------------------


def _findings_snapshot(tracker_path: str) -> str:
    """Return a hashable string representing current findings state.

    Used for stall detection: if this string doesn't change across cycles,
    the review lane is stalled (no new findings, no resolutions).
    """
    # Check both live and dryrun variants
    for candidate in (tracker_path + ".dryrun", tracker_path):
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                open_findings = get_open_findings(data)
                campaign = data.get("campaign", {})
                return json.dumps({
                    "open_count": len(open_findings),
                    "total_findings": campaign.get("total_findings", 0),
                    "total_resolved": campaign.get("total_resolved", 0),
                    "cycles_run": campaign.get("cycles_run", 0),
                }, sort_keys=True)
            except Exception:
                pass
    return ""


def _campaign_complete(tracker_path: str) -> bool:
    """Return True if campaign state is complete or no pending entries remain."""
    for candidate in (tracker_path + ".dryrun", tracker_path):
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                state = data.get("campaign", {}).get("state", "pending")
                if state in ("complete", "stopped"):
                    return True
                pending = [
                    e for e in data.get("queue", [])
                    if e.get("status") == "pending"
                ]
                return len(pending) == 0
            except Exception:
                pass
    return False


def _choose_mode(tracker_path: str, mode_override: str) -> str:
    """Return the mode to use for the next cycle.

    Logic:
    1. If REPO_CITY_REVIEW_MODE is explicitly set to review_only or apply_fix → use it.
    2. If pending fix entries exist with score > 1.0 → apply_fix.
    3. Otherwise → review_only.
    """
    if mode_override in ("review_only", "apply_fix"):
        return mode_override

    for candidate in (tracker_path + ".dryrun", tracker_path):
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                fix_entries = get_pending_fix_queue(data)
                # If we have fix entries with reasonable scores, apply_fix
                high_score_fixes = [
                    e for e in fix_entries
                    if float(e.get("score", 0.0)) > 1.0
                ]
                if high_score_fixes:
                    return "apply_fix"
                return "review_only"
            except Exception:
                pass

    return "review_only"


def _queue_summary(tracker_path: str) -> Tuple[int, int]:
    """Return (review_pending, fix_pending) counts from the real tracker."""
    for candidate in (tracker_path, tracker_path + ".dryrun"):
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
                review_q = len(get_pending_review_queue(data))
                fix_q = len(get_pending_fix_queue(data))
                return review_q, fix_q
            except Exception:
                pass
    return 0, 0


# ---------------------------------------------------------------------------
# Loop
# ---------------------------------------------------------------------------


def loop() -> int:
    """Run review cycles until completion.  Returns 0 on clean stop, 1 on partial."""
    cfg = load_review_config()

    max_cycles = cfg.max_cycles
    delay = cfg.cycle_delay_seconds
    max_stalled = cfg.max_stalled_cycles
    mode_override = os.environ.get("REPO_CITY_REVIEW_MODE", "").strip().lower()

    tracker_path = cfg.review_tracker_path
    stalled_count = 0
    last_snapshot = _findings_snapshot(tracker_path)

    print("\n" + "=" * 72)
    print("REPO-CITY-REVIEW-LOOP — autonomous review runner")
    print(f"  Max cycles:        {max_cycles}")
    print(f"  Delay between:     {delay}s")
    print(f"  Stall guard:       {max_stalled} consecutive no-progress cycles")
    print(f"  Mode override:     {mode_override or '(auto)'}")
    print(f"  Dry run:           {cfg.dry_run}")
    print(f"  Tracker:           {tracker_path}")
    print("=" * 72 + "\n")

    for cycle_num in range(1, max_cycles + 1):
        if _campaign_complete(tracker_path):
            _print_completion(cycle_num - 1)
            return 0

        review_q, fix_q = _queue_summary(tracker_path)
        mode = _choose_mode(tracker_path, mode_override)

        # Inject mode for this cycle
        os.environ["REPO_CITY_REVIEW_MODE"] = mode

        print(f"\n{'─' * 72}")
        print(
            f"  REVIEW CYCLE {cycle_num}/{max_cycles}  |  "
            f"Mode: {mode}  |  Queue: {review_q} review, {fix_q} fix"
        )
        print(f"{'─' * 72}\n")

        # Run one cycle
        exit_code = run_one_review_cycle()

        if exit_code == 2:
            print(
                "\n[review-loop] Fatal error in cycle — stopping loop.\n"
                "  Fix the error and restart."
            )
            return 1

        if exit_code == 1:
            # Stop policy triggered or no valid work
            print("\n[review-loop] Review cycle returned stop signal.")
            if _campaign_complete(tracker_path):
                _print_completion(cycle_num)
                return 0
            print(
                "[review-loop] Campaign stopped before full completion.\n"
                "  Check stop_reason in the last summary.json."
            )
            return 1

        # Measure progress
        new_snapshot = _findings_snapshot(tracker_path)
        made_progress = new_snapshot != last_snapshot

        if made_progress:
            stalled_count = 0
            last_snapshot = new_snapshot
            print(f"\n[review-loop] Progress detected in cycle {cycle_num}.")
        else:
            stalled_count += 1
            print(
                f"\n[review-loop] No new findings this cycle "
                f"({stalled_count}/{max_stalled} stall tolerance)."
            )

        if stalled_count >= max_stalled:
            print(
                f"\n[review-loop] {max_stalled} consecutive cycles with no new findings.\n"
                "  Stopping to avoid spinning.\n"
                "  Review the last cycle's report — you may need to clear the queue or restart."
            )
            return 1

        if _campaign_complete(tracker_path):
            _print_completion(cycle_num)
            return 0

        if delay > 0:
            print(f"[review-loop] Waiting {delay}s before next cycle...")
            time.sleep(delay)

    # Reached max_cycles
    print(
        f"\n[review-loop] Reached max_cycles={max_cycles} without completing review.\n"
        f"  Increase REPO_CITY_REVIEW_MAX_CYCLES and restart."
    )
    return 1


def _print_completion(cycles_used: int) -> None:
    print("\n" + "=" * 72)
    print("  REVIEW CAMPAIGN COMPLETE!")
    print(f"  Completed in {cycles_used} cycle(s).")
    print("  Check docs/review_artifacts/ for findings, removal candidates, and reports.")
    print("=" * 72 + "\n")


def main() -> int:
    return loop()


if __name__ == "__main__":
    sys.exit(main())
