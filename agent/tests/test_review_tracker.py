"""Tests for agent/review_tracker.py."""
import json
import os
import tempfile
import unittest

from agent.review_tracker import (
    validate_review_tracker_json,
    get_pending_queue,
    get_pending_review_queue,
    get_pending_fix_queue,
    get_open_findings,
    get_finding_by_id,
    score_queue_entry,
    pick_winning_slice,
    pick_winning_slice_by_mode,
    evaluate_stop_policy,
    build_tracker_update,
    snapshot_review_tracker_text,
    restore_review_tracker_text,
    review_tracker_changed,
)

NOW = "2026-03-08T12:00:00Z"


def _make_tracker(**overrides):
    """Return a minimal valid tracker dict."""
    base = {
        "schema_version": "1.0",
        "project": "test",
        "campaign": {"id": "tc-001", "state": "pending", "cycles_run": 0,
                     "total_findings": 0, "total_resolved": 0, "last_updated": None},
        "workstreams": [
            {"id": "dead_code", "priority": 1, "scope": ["src"],
             "description": "dead code", "last_run_at": None,
             "cycles_assigned": 0, "open_findings_count": 0},
            {"id": "duplication", "priority": 2, "scope": ["src"],
             "description": "duplication", "last_run_at": None,
             "cycles_assigned": 0, "open_findings_count": 0},
        ],
        "queue": [],
        "findings": [],
        "stop_policy": {
            "max_cycles": 80,
            "stop_on_findings_below": 3,
            "stop_on_score_below": 10.0,
            "max_consecutive_no_findings": 3,
            "consecutive_no_findings": 0,
            "triggered": False,
            "trigger_reason": None,
        },
        "current_slice_recommendation": None,
        "known_risks": [],
    }
    base.update(overrides)
    return base


def _review_entry(entry_id="q-001", ws="dead_code", status="pending"):
    return {
        "id": entry_id, "mode": "review", "workstream_id": ws,
        "title": "Scan dead code", "status": status, "score": 0.0,
        "priority_override": None, "added_at": NOW,
    }


def _fix_entry(entry_id="qfix-f-000001", finding_id="f-000001",
               severity="high", status="pending"):
    return {
        "id": entry_id, "mode": "fix", "finding_id": finding_id,
        "title": "Fix finding", "severity": severity, "status": status,
        "score": 0.0, "priority_override": None, "added_at": NOW,
    }


def _finding(fid="f-000001", ws="dead_code", severity="high",
             status="open", confidence=0.9):
    return {
        "id": fid, "workstream_id": ws, "rule_id": "DC-001",
        "severity": severity, "confidence": confidence,
        "category": "dead_code", "file_path": "src/foo.ts",
        "line_start": 10, "symbol": "fooFn",
        "description": "Dead export", "evidence": "grep -r fooFn → 0 hits",
        "recommended_action": "Delete fooFn", "status": status,
        "found_at": NOW, "cycle_number": 1,
    }


class TestValidateReviewTracker(unittest.TestCase):

    def test_valid_tracker_passes(self):
        """A minimal valid tracker should not raise."""
        validate_review_tracker_json(_make_tracker())

    def test_missing_key_raises(self):
        """Missing required key should raise ValueError."""
        bad = _make_tracker()
        del bad["findings"]
        with self.assertRaises(ValueError) as ctx:
            validate_review_tracker_json(bad)
        self.assertIn("findings", str(ctx.exception))

    def test_empty_workstreams_raises(self):
        """Empty workstreams list should raise ValueError."""
        bad = _make_tracker(workstreams=[])
        with self.assertRaises(ValueError) as ctx:
            validate_review_tracker_json(bad)
        self.assertIn("workstreams", str(ctx.exception))

    def test_non_dict_raises(self):
        with self.assertRaises(ValueError):
            validate_review_tracker_json("not a dict")


class TestQueueQueries(unittest.TestCase):

    def setUp(self):
        self.tracker = _make_tracker(queue=[
            _review_entry("q-001", status="pending"),
            _review_entry("q-002", ws="duplication", status="done"),
            _fix_entry("qfix-f-000001", status="pending"),
        ])

    def test_get_pending_queue_returns_pending_only(self):
        result = get_pending_queue(self.tracker)
        self.assertEqual(len(result), 2)
        for e in result:
            self.assertEqual(e["status"], "pending")

    def test_get_pending_review_queue(self):
        result = get_pending_review_queue(self.tracker)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["mode"], "review")

    def test_get_pending_fix_queue(self):
        result = get_pending_fix_queue(self.tracker)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["mode"], "fix")

    def test_empty_queue(self):
        t = _make_tracker()
        self.assertEqual(get_pending_queue(t), [])


class TestFindingQueries(unittest.TestCase):

    def setUp(self):
        self.tracker = _make_tracker(findings=[
            _finding("f-000001", status="open"),
            _finding("f-000002", status="resolved"),
            _finding("f-000003", status="open", severity="medium"),
        ])

    def test_get_open_findings_excludes_resolved(self):
        result = get_open_findings(self.tracker)
        self.assertEqual(len(result), 2)
        for f in result:
            self.assertNotEqual(f["status"], "resolved")

    def test_get_finding_by_id_found(self):
        f = get_finding_by_id(self.tracker, "f-000002")
        self.assertIsNotNone(f)
        self.assertEqual(f["status"], "resolved")

    def test_get_finding_by_id_not_found(self):
        f = get_finding_by_id(self.tracker, "f-999999")
        self.assertIsNone(f)


class TestScoreQueueEntry(unittest.TestCase):

    def test_fix_entry_score_uses_severity_and_confidence(self):
        finding = _finding("f-000001", severity="high", confidence=0.9)
        tracker = _make_tracker(
            findings=[finding],
            queue=[_fix_entry("qfix-f-000001", "f-000001", severity="high")],
        )
        entry = tracker["queue"][0]
        score = score_queue_entry(entry, tracker, NOW)
        # high=3.0, confidence=0.9 → 2.7
        self.assertAlmostEqual(score, 3.0 * 0.9, places=3)

    def test_fix_urgent_doubles_score(self):
        finding = _finding("f-000001", severity="medium", confidence=1.0)
        tracker = _make_tracker(findings=[finding])
        entry = {**_fix_entry("qfix-f-000001", "f-000001", severity="medium"),
                 "priority_override": "urgent"}
        score = score_queue_entry(entry, tracker, NOW)
        # medium=2.0, confidence=1.0 → 2.0 * 2 = 4.0
        self.assertAlmostEqual(score, 4.0, places=3)

    def test_review_entry_uses_recency(self):
        tracker = _make_tracker(
            queue=[_review_entry("q-001", ws="dead_code")],
        )
        entry = tracker["queue"][0]
        score = score_queue_entry(entry, tracker, NOW)
        # Never run: coverage_gap=1.0, recency=1.0, severity_density=0.0
        # W = 1/(1+0) = 1.0
        # score = 3*0 + 1.5*1 + 2*1 + 1*1 = 4.5
        self.assertAlmostEqual(score, 4.5, places=3)

    def test_deprioritize_halves_score(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        entry = {**tracker["queue"][0], "priority_override": "deprioritize"}
        normal_score = score_queue_entry(tracker["queue"][0], tracker, NOW)
        dep_score = score_queue_entry(entry, tracker, NOW)
        self.assertAlmostEqual(dep_score, normal_score * 0.5, places=3)


class TestPickWinningSlice(unittest.TestCase):

    def test_returns_none_when_empty_queue(self):
        tracker = _make_tracker()
        result = pick_winning_slice(tracker, NOW)
        self.assertIsNone(result)

    def test_returns_highest_scored(self):
        tracker = _make_tracker(queue=[
            _review_entry("q-001", ws="dead_code"),
            _review_entry("q-002", ws="duplication"),
        ])
        # Both have equal scores; tie-break by priority (dead_code=1 wins)
        result = pick_winning_slice(tracker, NOW)
        self.assertIsNotNone(result)
        self.assertEqual(result["workstream_id"], "dead_code")

    def test_pick_by_mode_review(self):
        tracker = _make_tracker(queue=[
            _fix_entry("qfix-f-000001", status="pending"),
            _review_entry("q-001", status="pending"),
        ])
        result = pick_winning_slice_by_mode(tracker, "review", NOW)
        self.assertIsNotNone(result)
        self.assertEqual(result["mode"], "review")

    def test_pick_by_mode_fix(self):
        tracker = _make_tracker(queue=[
            _fix_entry("qfix-f-000001", status="pending"),
            _review_entry("q-001", status="pending"),
        ])
        result = pick_winning_slice_by_mode(tracker, "fix", NOW)
        self.assertIsNotNone(result)
        self.assertEqual(result["mode"], "fix")

    def test_pick_by_mode_returns_none_when_no_match(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        result = pick_winning_slice_by_mode(tracker, "fix", NOW)
        self.assertIsNone(result)


class TestEvaluateStopPolicy(unittest.TestCase):

    def _call(self, tracker, cycles=0, max_cycles=80,
              stop_score=10.0, stop_findings=3,
              max_no_findings=3, consecutive=0):
        return evaluate_stop_policy(
            tracker, cycles, max_cycles,
            stop_score, stop_findings,
            max_no_findings, consecutive, NOW,
        )

    def test_max_cycles_triggers_stop(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        should_stop, reason = self._call(tracker, cycles=80, max_cycles=80)
        self.assertTrue(should_stop)
        self.assertIn("Max cycles", reason)

    def test_terminal_state_triggers_stop(self):
        tracker = _make_tracker(
            campaign={"id": "tc-001", "state": "complete", "cycles_run": 5,
                      "total_findings": 0, "total_resolved": 0, "last_updated": None},
            queue=[_review_entry("q-001")],
        )
        should_stop, reason = self._call(tracker, cycles=1)
        self.assertTrue(should_stop)
        self.assertIn("complete", reason)

    def test_empty_queue_triggers_stop(self):
        tracker = _make_tracker()
        should_stop, reason = self._call(tracker, cycles=1)
        self.assertTrue(should_stop)
        self.assertIn("No pending queue", reason)

    def test_stall_guard_triggers_stop(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        # stop_score=0.0 ensures score check doesn't fire before stall guard
        should_stop, reason = self._call(
            tracker, consecutive=3, max_no_findings=3, stop_score=0.0
        )
        self.assertTrue(should_stop)
        self.assertIn("consecutive", reason)

    def test_no_stop_when_all_clear(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        # Force score high by injecting a finding so score calc finds work
        # The review entry starts with score 4.5 which is below stop_score=10.0
        # But stop_on_score_below check: 4.5 < 10.0 → would stop.
        # Use low stop_score to avoid that trigger.
        should_stop, reason = self._call(
            tracker, cycles=1, stop_score=0.0, consecutive=0,
        )
        self.assertFalse(should_stop)
        self.assertEqual(reason, "")


class TestBuildTrackerUpdate(unittest.TestCase):

    def test_increments_cycles_run(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        updated = build_tracker_update(
            tracker, tracker["queue"][0], [], [], 0, NOW
        )
        self.assertEqual(updated["campaign"]["cycles_run"], 1)

    def test_marks_winning_entry_done(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        updated = build_tracker_update(
            tracker, tracker["queue"][0], [], [], 0, NOW
        )
        entry = next(e for e in updated["queue"] if e["id"] == "q-001")
        self.assertEqual(entry["status"], "done")

    def test_appends_new_fix_entries(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        new_fix = _fix_entry("qfix-f-000001")
        updated = build_tracker_update(
            tracker, tracker["queue"][0], [], [new_fix], 0, NOW
        )
        ids = [e["id"] for e in updated["queue"]]
        self.assertIn("qfix-f-000001", ids)

    def test_appends_findings(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        f = _finding("f-000001")
        updated = build_tracker_update(
            tracker, tracker["queue"][0], [f], [], 0, NOW
        )
        self.assertEqual(len(updated["findings"]), 1)
        self.assertEqual(updated["campaign"]["total_findings"], 1)

    def test_original_not_mutated(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        orig_cycles = tracker["campaign"]["cycles_run"]
        build_tracker_update(tracker, tracker["queue"][0], [], [], 0, NOW)
        self.assertEqual(tracker["campaign"]["cycles_run"], orig_cycles)


class TestSnapshotRestore(unittest.TestCase):

    def test_snapshot_and_restore(self):
        tracker = _make_tracker(queue=[_review_entry("q-001")])
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json",
                                         delete=False, encoding="utf-8") as f:
            json.dump(tracker, f)
            path = f.name
        try:
            original = snapshot_review_tracker_text(path)
            # Modify file
            with open(path, "w", encoding="utf-8") as f:
                f.write('{"modified": true, "workstreams": [{"id": "x"}], '
                        '"queue": [], "findings": [], "campaign": {}, "stop_policy": {}}')
            self.assertTrue(review_tracker_changed(original, path))
            restore_review_tracker_text(path, original)
            with open(path, encoding="utf-8") as f:
                restored = f.read()
            self.assertEqual(restored, original)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
