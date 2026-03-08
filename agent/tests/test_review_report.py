"""Tests for agent/review_report.py."""
import unittest

from agent.review_report import (
    ReviewCycleReport,
    format_review_report,
    build_review_summary_json,
    _REVIEW_HEADINGS,
)


def _make_report(**kwargs):
    defaults = dict(
        run_id="run-001",
        cycle_number=1,
        campaign_id="rc-001",
        mode="review_only",
        slice_title="Scan frontend/src for dead exports",
        workstream="dead_code",
        files_involved=["frontend/src/foo.ts", "frontend/src/bar.ts"],
        commands_run=["grep -r fooFn frontend/src"],
        new_findings_count=2,
        total_open_findings=2,
        findings_by_severity={"high": 1, "medium": 1, "low": 0},
        findings_summary="Found fooFn (dead export) and barFn (dead export).",
        queue_size=4,
        queue_review_count=3,
        queue_fix_count=1,
        artifacts_written=["docs/review_artifacts/findings.json.dryrun"],
        dry_run=True,
        ai_narrative="Two dead exports identified for removal.",
        top_recommendations=["Remove fooFn from frontend/src/foo.ts"],
        should_stop=False,
        stop_reason="next slice available",
        tracker_changes="Added 2 findings; marked q-001 done.",
        cycle_valid=True,
    )
    defaults.update(kwargs)
    return ReviewCycleReport(**defaults)


class TestReviewHeadings(unittest.TestCase):

    def test_exactly_10_headings(self):
        self.assertEqual(len(_REVIEW_HEADINGS), 10)

    def test_required_headings_present(self):
        required = [
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
        for h in required:
            self.assertIn(h, _REVIEW_HEADINGS)


class TestFormatReviewReport(unittest.TestCase):

    def test_all_10_sections_present(self):
        report = _make_report()
        text = format_review_report(report)
        for heading in _REVIEW_HEADINGS:
            self.assertIn(heading + ":", text, f"Missing heading: {heading}")

    def test_dry_run_note_in_artifacts(self):
        report = _make_report(
            dry_run=True,
            artifacts_written=["docs/review_artifacts/findings.json.dryrun"]
        )
        text = format_review_report(report)
        self.assertIn("DRY RUN", text)

    def test_no_dry_run_note_when_live(self):
        report = _make_report(dry_run=False, artifacts_written=["findings.json"])
        text = format_review_report(report)
        # Should NOT have the dry-run disclaimer in artifacts section
        self.assertNotIn("[DRY RUN] Live files NOT modified", text)

    def test_stop_section_shows_stop_when_stopping(self):
        report = _make_report(should_stop=True, stop_reason="Max cycles reached")
        text = format_review_report(report)
        self.assertIn("STOPPING", text)
        self.assertIn("Max cycles reached", text)

    def test_continue_when_not_stopping(self):
        report = _make_report(should_stop=False, stop_reason="next slice available")
        text = format_review_report(report)
        self.assertIn("Continuing", text)

    def test_findings_severity_breakdown_shown(self):
        report = _make_report(
            new_findings_count=3,
            findings_by_severity={"high": 2, "medium": 1, "low": 0},
        )
        text = format_review_report(report)
        self.assertIn("high=2", text)
        self.assertIn("medium=1", text)

    def test_zero_findings_shows_zero(self):
        report = _make_report(new_findings_count=0, findings_by_severity={})
        text = format_review_report(report)
        self.assertIn("New findings: 0", text)

    def test_parse_error_shown_in_findings_section(self):
        report = _make_report(parse_error="Could not parse JSON block")
        text = format_review_report(report)
        self.assertIn("PARSE ERROR", text)
        self.assertIn("Could not parse JSON block", text)

    def test_apply_fix_mode_label(self):
        report = _make_report(mode="apply_fix", cycle_valid=True,
                               new_findings_count=0)
        text = format_review_report(report)
        self.assertIn("apply_fix", text)

    def test_tracker_changes_dry_run_prefix(self):
        report = _make_report(
            dry_run=True,
            tracker_changes="Added 1 finding",
        )
        text = format_review_report(report)
        self.assertIn("[DRY RUN] Changes written to .dryrun shadow file only.", text)

    def test_empty_files_shows_none(self):
        report = _make_report(files_involved=[])
        text = format_review_report(report)
        self.assertIn("(none)", text)

    def test_ai_narrative_in_safer_section(self):
        report = _make_report(ai_narrative="Two dead exports identified.")
        text = format_review_report(report)
        self.assertIn("Two dead exports identified.", text)


class TestBuildReviewSummaryJson(unittest.TestCase):

    def test_required_keys_present(self):
        report = _make_report()
        summary = build_review_summary_json(report)
        required_keys = [
            "run_id", "cycle_number", "campaign_id", "mode", "workstream",
            "slice_title", "cycle_valid", "dry_run", "new_findings_count",
            "total_open_findings", "findings_by_severity", "queue_size",
            "queue_review_count", "queue_fix_count", "artifacts_written",
            "should_stop", "stop_reason", "tracker_changes", "files_involved",
            "commands_run", "committed", "pushed", "commit_hash",
            "repair_attempts", "codex_exit_code", "validation_summary",
            "error", "parse_error",
        ]
        for key in required_keys:
            self.assertIn(key, summary, f"Missing key in summary JSON: {key}")

    def test_files_involved_is_sorted(self):
        report = _make_report(files_involved=["z.ts", "a.ts", "m.ts"])
        summary = build_review_summary_json(report)
        self.assertEqual(summary["files_involved"], sorted(["z.ts", "a.ts", "m.ts"]))

    def test_dry_run_preserved(self):
        report = _make_report(dry_run=True)
        summary = build_review_summary_json(report)
        self.assertTrue(summary["dry_run"])

    def test_values_match_report(self):
        report = _make_report(
            run_id="run-999",
            cycle_number=5,
            mode="apply_fix",
            new_findings_count=3,
        )
        summary = build_review_summary_json(report)
        self.assertEqual(summary["run_id"], "run-999")
        self.assertEqual(summary["cycle_number"], 5)
        self.assertEqual(summary["mode"], "apply_fix")
        self.assertEqual(summary["new_findings_count"], 3)


if __name__ == "__main__":
    unittest.main()
