"""repo_city_loop.py — runs repo-city-cycle repeatedly until all phases complete.

Loop behaviour:
  - Runs one cycle at a time.
  - After each cycle re-reads the tracker to measure progress.
  - Stops when every milestone status is 'done'.
  - Stops if max_cycles is reached (safety cap).
  - Stops if N consecutive cycles produce no tracker progress (stall guard).
  - Stops on fatal errors (exit code 2).

Environment variables (all optional):
  REPO_CITY_MAX_CYCLES            default 60
  REPO_CITY_CYCLE_DELAY_SECONDS   default 10
  REPO_CITY_MAX_STALLED_CYCLES    default 3
"""
from __future__ import annotations

import json
import os
import sys
import time
from typing import List, Tuple

from .config import load_config, REQUIRED_DOCS
from .tracker import (
    _DONE_STATUSES,
    _iter_phases,
    load_tracker,
    summarize_tracker,
)
from .repo_city_cycle import main as run_one_cycle


# ---------------------------------------------------------------------------
# Progress helpers
# ---------------------------------------------------------------------------


def _count_phases(tracker_path: str) -> Tuple[int, int]:
    """Return (done, total) milestone counts."""
    try:
        data = load_tracker(tracker_path)
    except Exception:
        return 0, 0
    phases = list(_iter_phases(data))
    done = sum(
        1 for p in phases
        if str(p.get("status", "")).lower() in _DONE_STATUSES
    )
    return done, len(phases)


def _all_done(tracker_path: str) -> bool:
    done, total = _count_phases(tracker_path)
    return total > 0 and done == total


def _phase_snapshot(tracker_path: str) -> str:
    """Return a hashable string representing current phase completion state."""
    try:
        data = load_tracker(tracker_path)
        return json.dumps(
            {
                p.get("name") or p.get("phase") or str(i): p.get("status", "")
                for i, p in enumerate(_iter_phases(data))
            },
            sort_keys=True,
        )
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Loop
# ---------------------------------------------------------------------------


def loop() -> int:
    """Run cycles until completion.  Returns 0 on full completion, 1 on partial."""
    cfg = load_config()

    max_cycles = int(os.environ.get("REPO_CITY_MAX_CYCLES", "60"))
    delay = float(os.environ.get("REPO_CITY_CYCLE_DELAY_SECONDS", "10"))
    max_stalled = int(os.environ.get("REPO_CITY_MAX_STALLED_CYCLES", "3"))

    tracker_path = cfg.tracker_path
    stalled_count = 0
    last_snapshot = _phase_snapshot(tracker_path)

    print("\n" + "=" * 72)
    print("REPO-CITY-LOOP — autonomous runner")
    print(f"  Max cycles:        {max_cycles}")
    print(f"  Delay between:     {delay}s")
    print(f"  Stall guard:       {max_stalled} consecutive no-progress cycles")
    print(f"  Tracker:           {tracker_path}")
    print("=" * 72 + "\n")

    for cycle_num in range(1, max_cycles + 1):
        done_before, total = _count_phases(tracker_path)
        print(f"\n{'─' * 72}")
        print(
            f"  CYCLE {cycle_num}/{max_cycles}  |  "
            f"Progress: {done_before}/{total} phases done"
        )
        print(f"{'─' * 72}\n")

        if _all_done(tracker_path):
            _print_completion(done_before, total, cycle_num - 1)
            return 0

        # Run one cycle
        exit_code = run_one_cycle()

        if exit_code == 2:
            print(
                "\n[loop] Fatal error in cycle — stopping loop.\n"
                "  Fix the error and restart the loop."
            )
            return 1

        # Measure progress: tracker changed OR a valid cycle committed real code
        done_after, total = _count_phases(tracker_path)
        new_snapshot = _phase_snapshot(tracker_path)
        tracker_moved = new_snapshot != last_snapshot

        # Also count a valid committed cycle as progress (Codex did real work
        # even if it forgot to update the tracker)
        cycle_committed = exit_code == 0  # exit 0 = valid cycle
        made_progress = tracker_moved or cycle_committed

        if tracker_moved:
            stalled_count = 0
            last_snapshot = new_snapshot
            print(
                f"\n[loop] Tracker progress: {done_before} → {done_after} phases done."
            )
        elif cycle_committed:
            # Valid cycle with code changes but no tracker update — tolerate once,
            # but still count as progress so the stall guard doesn't fire
            stalled_count = 0
            print(
                f"\n[loop] Valid cycle committed code (no tracker change — "
                "Codex skipped tracker update, will retry)."
            )
        else:
            stalled_count += 1
            print(
                f"\n[loop] No progress this cycle "
                f"({stalled_count}/{max_stalled} stall tolerance)."
            )

        if stalled_count >= max_stalled:
            print(
                f"\n[loop] {max_stalled} consecutive cycles with no tracker progress.\n"
                "  The loop is stopping to avoid spinning.\n"
                "  Check the last cycle's logs and report, then re-run manually."
            )
            return 1

        if _all_done(tracker_path):
            _print_completion(done_after, total, cycle_num)
            return 0

        # Pause before next cycle
        if delay > 0:
            print(f"[loop] Waiting {delay}s before next cycle...")
            time.sleep(delay)

    # Reached max_cycles without completing
    done, total = _count_phases(tracker_path)
    print(
        f"\n[loop] Reached max_cycles={max_cycles} without completing all phases.\n"
        f"  Progress: {done}/{total} phases done.\n"
        "  Increase REPO_CITY_MAX_CYCLES and restart."
    )
    return 1


def _print_completion(done: int, total: int, cycles_used: int) -> None:
    print("\n" + "=" * 72)
    print("  ALL PHASES COMPLETE!")
    print(f"  {done}/{total} milestones done in {cycles_used} cycle(s).")
    print("  The project is complete.  Review the final state in the tracker.")
    print("=" * 72 + "\n")


if __name__ == "__main__":
    sys.exit(loop())
