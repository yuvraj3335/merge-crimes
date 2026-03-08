"""Tests for agent/review_findings.py."""
import os
import tempfile
import unittest

from agent.review_findings import (
    parse_findings_from_codex_output,
    validate_finding,
    deduplicate_findings,
    build_fix_queue_entries,
    Finding,
)


def _make_finding(**kwargs):
    defaults = dict(
        id="f-000001",
        workstream_id="dead_code",
        rule_id="DC-001",
        severity="high",
        confidence=0.9,
        category="dead_code",
        file_path="src/foo.ts",
        line_start=10,
        symbol="fooFn",
        description="Dead export fooFn is never imported",
        evidence='grep -r "fooFn" → 0 results outside foo.ts',
        recommended_action="Delete fooFn from foo.ts",
        status="open",
        found_at="2026-03-08T00:00:00Z",
        cycle_number=1,
    )
    defaults.update(kwargs)
    return Finding(**defaults)


class TestParseFindings(unittest.TestCase):

    def _valid_json(self, findings_list=None):
        if findings_list is None:
            findings_list = [
                {
                    "file_path": "src/foo.ts",
                    "line": 10,
                    "symbol": "fooFn",
                    "severity": "high",
                    "confidence": 0.9,
                    "category": "dead_code",
                    "description": "Dead export fooFn",
                    "evidence": 'grep "fooFn" → 0 hits',
                    "recommended_action": "Delete fooFn",
                }
            ]
        import json
        return f'```json\n{json.dumps({"findings": findings_list})}\n```'

    def test_parses_fenced_json(self):
        output = self._valid_json()
        findings, err = parse_findings_from_codex_output(output, "dead_code", 1)
        self.assertEqual(err, "")
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].file_path, "src/foo.ts")

    def test_parses_raw_json(self):
        import json
        raw = json.dumps({"findings": [
            {
                "file_path": "src/bar.ts", "line": 5, "symbol": "barFn",
                "severity": "medium", "confidence": 0.8, "category": "duplication",
                "description": "Duplicated logic", "evidence": "see both files",
                "recommended_action": "Extract to shared util",
            }
        ]})
        findings, err = parse_findings_from_codex_output(raw, "duplication", 2)
        self.assertEqual(err, "")
        self.assertEqual(len(findings), 1)

    def test_empty_output_returns_error(self):
        findings, err = parse_findings_from_codex_output("", "dead_code", 1)
        self.assertEqual(findings, [])
        self.assertNotEqual(err, "")

    def test_unparseable_output_returns_error(self):
        findings, err = parse_findings_from_codex_output(
            "This is plain text with no JSON", "dead_code", 1
        )
        self.assertEqual(findings, [])
        self.assertNotEqual(err, "")

    def test_empty_findings_list_is_valid(self):
        import json
        raw = json.dumps({"findings": []})
        findings, err = parse_findings_from_codex_output(raw, "dead_code", 1)
        self.assertEqual(err, "")
        self.assertEqual(findings, [])

    def test_severity_normalised_to_medium_when_invalid(self):
        import json
        raw = json.dumps({"findings": [
            {
                "file_path": "src/foo.ts", "line": 1, "symbol": "x",
                "severity": "critical",  # invalid
                "confidence": 0.8, "category": "dead_code",
                "description": "issue", "evidence": "proof",
                "recommended_action": "fix it",
            }
        ]})
        findings, err = parse_findings_from_codex_output(raw, "dead_code", 1)
        self.assertEqual(err, "")
        self.assertEqual(findings[0].severity, "medium")

    def test_category_normalised_to_other_when_invalid(self):
        import json
        raw = json.dumps({"findings": [
            {
                "file_path": "src/foo.ts", "line": 1, "symbol": "x",
                "severity": "low", "confidence": 0.8,
                "category": "invalid_category",
                "description": "issue", "evidence": "proof",
                "recommended_action": "fix",
            }
        ]})
        findings, err = parse_findings_from_codex_output(raw, "dead_code", 1)
        self.assertEqual(findings[0].category, "other")

    def test_ids_are_unique_across_batch(self):
        import json
        raw_list = [
            {"file_path": f"src/f{i}.ts", "line": i, "symbol": f"sym{i}",
             "severity": "low", "confidence": 0.6, "category": "other",
             "description": f"issue {i}", "evidence": f"proof {i}",
             "recommended_action": "fix"}
            for i in range(5)
        ]
        raw = json.dumps({"findings": raw_list})
        findings, _ = parse_findings_from_codex_output(raw, "dead_code", 1)
        ids = [f.id for f in findings]
        self.assertEqual(len(ids), len(set(ids)))

    def test_accepts_top_level_list(self):
        import json
        raw = json.dumps([
            {"file_path": "src/x.ts", "line": 1, "symbol": "x",
             "severity": "low", "confidence": 0.6, "category": "other",
             "description": "thing", "evidence": "proof",
             "recommended_action": "fix"}
        ])
        findings, err = parse_findings_from_codex_output(raw, "dead_code", 1)
        self.assertEqual(err, "")
        self.assertEqual(len(findings), 1)


class TestValidateFinding(unittest.TestCase):

    def test_valid_finding_with_existing_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fpath = os.path.join(tmpdir, "foo.ts")
            open(fpath, "w").close()
            f = _make_finding(file_path="foo.ts")
            ok, reason = validate_finding(f, tmpdir)
            self.assertTrue(ok)
            self.assertEqual(reason, "")

    def test_empty_file_path_fails(self):
        f = _make_finding(file_path="")
        ok, reason = validate_finding(f, "/tmp")
        self.assertFalse(ok)
        self.assertIn("file_path", reason)

    def test_missing_file_fails(self):
        f = _make_finding(file_path="nonexistent/path.ts")
        ok, reason = validate_finding(f, "/tmp")
        self.assertFalse(ok)
        self.assertIn("file", reason.lower())

    def test_empty_description_fails(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fpath = os.path.join(tmpdir, "foo.ts")
            open(fpath, "w").close()
            f = _make_finding(file_path="foo.ts", description="")
            ok, reason = validate_finding(f, tmpdir)
            self.assertFalse(ok)
            self.assertIn("description", reason)

    def test_empty_evidence_fails(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fpath = os.path.join(tmpdir, "foo.ts")
            open(fpath, "w").close()
            f = _make_finding(file_path="foo.ts", evidence="")
            ok, reason = validate_finding(f, tmpdir)
            self.assertFalse(ok)
            self.assertIn("evidence", reason)


class TestDeduplicateFindings(unittest.TestCase):

    def test_no_duplicates_all_pass(self):
        new = [_make_finding(id="f-000001", file_path="a.ts", symbol="fnA", category="dead_code")]
        existing = [_make_finding(id="f-000000", file_path="b.ts", symbol="fnB", category="dead_code")]
        result = deduplicate_findings(new, existing)
        self.assertEqual(len(result), 1)

    def test_exact_duplicate_is_dropped(self):
        existing = [_make_finding(id="f-000001", file_path="a.ts", symbol="fnA", category="dead_code")]
        new = [_make_finding(id="f-000002", file_path="a.ts", symbol="fnA", category="dead_code")]
        result = deduplicate_findings(new, existing)
        self.assertEqual(result, [])

    def test_case_insensitive_symbol_dedup(self):
        existing = [_make_finding(id="f-000001", file_path="a.ts", symbol="FnA", category="dead_code")]
        new = [_make_finding(id="f-000002", file_path="a.ts", symbol="fna", category="dead_code")]
        result = deduplicate_findings(new, existing)
        self.assertEqual(result, [])

    def test_different_category_not_deduped(self):
        existing = [_make_finding(id="f-000001", file_path="a.ts", symbol="fnA", category="dead_code")]
        new = [_make_finding(id="f-000002", file_path="a.ts", symbol="fnA", category="duplication")]
        result = deduplicate_findings(new, existing)
        self.assertEqual(len(result), 1)

    def test_batch_dedup_within_new_findings(self):
        new = [
            _make_finding(id="f-000001", file_path="a.ts", symbol="fnA", category="dead_code"),
            _make_finding(id="f-000002", file_path="a.ts", symbol="fnA", category="dead_code"),
        ]
        result = deduplicate_findings(new, [])
        self.assertEqual(len(result), 1)


class TestBuildFixQueueEntries(unittest.TestCase):

    def test_high_severity_creates_entry(self):
        findings = [_make_finding(severity="high")]
        entries = build_fix_queue_entries(findings, [])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["mode"], "fix")
        self.assertEqual(entries[0]["severity"], "high")

    def test_medium_severity_creates_entry(self):
        findings = [_make_finding(severity="medium")]
        entries = build_fix_queue_entries(findings, [])
        self.assertEqual(len(entries), 1)

    def test_low_severity_skipped(self):
        findings = [_make_finding(severity="low")]
        entries = build_fix_queue_entries(findings, [])
        self.assertEqual(entries, [])

    def test_no_duplicate_when_already_in_queue(self):
        f = _make_finding(id="f-000001", severity="high")
        existing_queue = [{"mode": "fix", "finding_id": "f-000001", "id": "qfix-f-000001"}]
        entries = build_fix_queue_entries([f], existing_queue)
        self.assertEqual(entries, [])

    def test_queue_entry_id_format(self):
        findings = [_make_finding(id="f-000042", severity="high")]
        entries = build_fix_queue_entries(findings, [])
        self.assertEqual(entries[0]["id"], "qfix-f-000042")


if __name__ == "__main__":
    unittest.main()
