"""review_cycle.py — main orchestrator for the repo-city review lane.

Two modes:
  review_only  — Codex inspects code, emits structured JSON findings.
                 Python parses, validates, stores, adds fix queue entries.
  apply_fix    — Python picks best finding, Codex fixes it, Python validates,
                 optionally commits (only when dry_run=False and allow_push=True).

Run via:
    python -m agent.review_cycle
or via the repo-city-review-cycle shell wrapper.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

from .review_config import ReviewConfig, load_review_config
from .review_tracker import (
    build_tracker_update,
    diff_review_tracker_text,
    evaluate_stop_policy,
    get_campaign_state,
    get_open_findings,
    get_pending_fix_queue,
    get_pending_queue,
    get_pending_review_queue,
    is_campaign_active,
    load_review_tracker,
    now_iso,
    pick_winning_slice_by_mode,
    restore_review_tracker_text,
    review_tracker_changed,
    snapshot_review_tracker_text,
    summarize_review_tracker,
    validate_review_tracker_json,
)
from .review_context import (
    ReviewContext,
    build_architecture_map,
    build_fix_context,
    build_inventory,
    build_review_context,
    save_context_artifacts,
)
from .review_findings import (
    Finding,
    build_fix_queue_entries,
    build_removal_candidates,
    deduplicate_findings,
    load_findings_from_artifacts,
    parse_findings_from_codex_output,
    persist_findings,
    persist_removal_candidates,
    validate_finding,
)
from .review_report import (
    ReviewCycleReport,
    build_review_summary_json,
    format_review_report,
)
from .review_openai_client import (
    FixPromptContext,
    ReviewOpenAIClient,
    ReviewPromptContext,
    ReviewTrackerConsistencyContext,
    build_fallback_fix_prompt,
    build_fallback_review_prompt,
)
from .logging_utils import RunLogger, setup_run_logger
from .codex_runner import run_codex, run_codex_repair, CodexResult
from .validator import (
    CycleValidity,
    classify_changes,
    evaluate_cycle_validity,
    get_changed_files,
    required_validation_commands,
    run_validation_commands,
)
from .git_ops import (
    GitError,
    commit_changes,
    get_current_branch,
    has_uncommitted_changes,
    is_git_repo,
    push_branch,
    sanitize_commit_message,
    stage_all_changes,
)
from .report import parse_codex_report_sections


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class ReviewCycle:
    """Review lane orchestrator — handles both review_only and apply_fix modes."""

    def __init__(self, cfg: ReviewConfig, logger: RunLogger) -> None:
        self.cfg = cfg
        self.log = logger
        run_id = logger.run_dir.split(os.sep)[-1]
        self.report = ReviewCycleReport(run_id=run_id, dry_run=cfg.dry_run, mode=cfg.mode)

        # Internal state
        self._tracker_snapshot: str = ""
        self._tracker_data: Dict[str, Any] = {}
        self._winning_entry: Optional[Dict[str, Any]] = None
        self._inventory: Dict[str, Any] = {}
        self._arch_map: Dict[str, Any] = {}
        self._review_context: Optional[ReviewContext] = None
        self._cycle_prompt: str = ""
        self._codex_result: Optional[CodexResult] = None
        self._new_findings: List[Finding] = []
        self._new_fix_entries: List[Dict[str, Any]] = []
        self._ai_client: Optional[ReviewOpenAIClient] = None
        self._timestamp: str = ""

        # apply_fix state (mirrors delivery lane)
        self._changed_files: List[str] = []
        self._consecutive_no_findings: int = 0
        self._bug_dismissed: bool = False   # True when Codex confirms bug no longer exists

    # -----------------------------------------------------------------------
    # Shared Step: Preflight
    # -----------------------------------------------------------------------

    def step_preflight(self) -> None:
        cfg = self.cfg
        log = self.log
        log.info("Step: Preflight")

        self._timestamp = now_iso()

        # Repo root
        if not os.path.isdir(cfg.repo_root):
            raise RuntimeError(f"Repo root does not exist: {cfg.repo_root}")

        # Git repo
        if not is_git_repo(cfg.repo_root):
            raise RuntimeError(f"Not a git repository: {cfg.repo_root}")

        # Review tracker must exist
        if not os.path.isfile(cfg.review_tracker_path):
            raise RuntimeError(
                f"Review tracker not found: {cfg.review_tracker_path}\n"
                "  Create docs/REPO_CITY_REVIEW_TRACKER.json from the seed template."
            )

        # Load and validate tracker
        self._tracker_snapshot = snapshot_review_tracker_text(cfg.review_tracker_path)
        try:
            self._tracker_data = load_review_tracker(cfg.review_tracker_path)
        except ValueError as exc:
            raise RuntimeError(f"Failed to load review tracker: {exc}") from exc

        # Campaign must be active
        state = get_campaign_state(self._tracker_data)
        if not is_campaign_active(self._tracker_data):
            raise RuntimeError(
                f"Review campaign is in terminal state: '{state}'. "
                "Reset or re-seed the review tracker to start a new campaign."
            )

        # Ensure artifacts dir exists
        os.makedirs(cfg.artifacts_dir, exist_ok=True)

        # Pick winning queue entry for the configured mode
        self._winning_entry = pick_winning_slice_by_mode(
            self._tracker_data, cfg.mode, self._timestamp,
            cfg.weight_severity, cfg.weight_recency,
            cfg.weight_coverage_gap, cfg.weight_starvation,
        )
        if self._winning_entry is None:
            raise RuntimeError(
                f"No pending queue entries found for mode='{cfg.mode}'. "
                "Run a review_only cycle first to populate the fix queue, "
                "or check the review tracker."
            )

        campaign = self._tracker_data.get("campaign", {})
        self.report.campaign_id = campaign.get("id", "unknown")
        self.report.cycle_number = campaign.get("cycles_run", 0) + 1
        self.report.workstream = self._winning_entry.get("workstream_id", "")
        self.report.slice_title = self._winning_entry.get("title", "")

        # Read consecutive_no_findings from stop_policy
        sp = self._tracker_data.get("stop_policy", {})
        self._consecutive_no_findings = sp.get("consecutive_no_findings", 0)

        log.info(f"Campaign: {self.report.campaign_id}  Cycle: {self.report.cycle_number}")
        log.info(f"Mode: {cfg.mode}  Workstream: {self.report.workstream}")
        log.info(f"Slice: {self.report.slice_title}")

        # Initialise AI client
        try:
            self._ai_client = ReviewOpenAIClient(
                api_key=cfg.openai_api_key,
                model=cfg.openai_model,
                prompts_dir=cfg.prompts_dir,
            )
        except Exception as exc:
            log.warning(f"AI client init failed (will use fallbacks): {exc}")
            self._ai_client = None

    # -----------------------------------------------------------------------
    # review_only: Step — Build context
    # -----------------------------------------------------------------------

    def step_build_review_context(self) -> None:
        log = self.log
        log.info("Step: Building review context (inventory + arch map)")

        self._inventory = build_inventory(self.cfg.repo_root)
        self._arch_map = build_architecture_map(self.cfg.repo_root, self._inventory)

        written = save_context_artifacts(
            self._inventory, self._arch_map, self.cfg.artifacts_dir, self.cfg.dry_run
        )
        self.report.artifacts_written.extend(written)
        log.info(
            f"Inventory: {self._inventory.get('file_count', 0)} files, "
            f"{self._inventory.get('total_lines', 0)} lines"
        )

        # Build ReviewContext for this slice
        self._review_context = build_review_context(
            self.cfg.repo_root,
            self._winning_entry,
            self._tracker_data,
            self._inventory,
            self._arch_map,
        )
        self.report.files_involved = self._review_context.scope_files[:50]

    # -----------------------------------------------------------------------
    # review_only: Step — Generate review prompt and run Codex
    # -----------------------------------------------------------------------

    def step_run_review_codex(self) -> None:
        log = self.log
        cfg = self.cfg
        ctx = self._review_context
        log.info("Step: Generating review prompt and running Codex")

        tracker_summary = summarize_review_tracker(self._tracker_data)

        scope_files_text = "\n".join(f"  {f}" for f in (ctx.scope_files or [])[:40])

        review_prompt_ctx = ReviewPromptContext(
            workstream=ctx.workstream,
            scope_description=ctx.scope_description,
            scope_files_excerpt=scope_files_text,
            inventory_excerpt=ctx.inventory_excerpt,
            arch_map_excerpt=ctx.arch_map_excerpt,
            prior_findings=ctx.prior_findings,
            open_risks=ctx.open_risks,
            repo_root=cfg.repo_root,
            tracker_summary=tracker_summary,
        )

        try:
            if self._ai_client:
                self._cycle_prompt = self._ai_client.generate_review_prompt(review_prompt_ctx)
                log.info(f"Review prompt generated ({len(self._cycle_prompt)} chars)")
            else:
                raise RuntimeError("AI client unavailable")
        except Exception as exc:
            log.warning(f"Review prompt generation failed: {exc}  — using fallback")
            self._cycle_prompt = build_fallback_review_prompt(
                ctx.workstream, ctx.scope_description, cfg.repo_root
            )

        log.save_text("cycle_prompt.txt", self._cycle_prompt)

        # Run Codex
        self._codex_result = run_codex(
            prompt=self._cycle_prompt,
            cwd=cfg.repo_root,
            codex_bin=cfg.codex_bin,
            extra_args=cfg.codex_extra_args,
        )
        log.save_codex_output(
            self._codex_result.stdout, self._codex_result.stderr, attempt=0, is_repair=False
        )
        self.report.codex_exit_code = self._codex_result.exit_code
        log.info(self._codex_result.summary())

    # -----------------------------------------------------------------------
    # review_only: Step — Parse and store findings
    # -----------------------------------------------------------------------

    def step_parse_and_store_findings(self) -> None:
        log = self.log
        cfg = self.cfg
        stdout = self._codex_result.stdout if self._codex_result else ""

        log.info("Step: Parsing findings from Codex output")

        # Load existing findings for deduplication
        existing_findings = load_findings_from_artifacts(cfg.artifacts_dir)

        cycle_num = self.report.cycle_number
        ws_id = self.report.workstream

        raw_findings, parse_error = parse_findings_from_codex_output(
            stdout, ws_id, cycle_num, existing_findings
        )

        if parse_error:
            log.warning(f"Findings parse error: {parse_error}")
            self.report.parse_error = parse_error
            self.report.cycle_valid = False
            return

        # Validate each finding
        valid_findings: List[Finding] = []
        for f in raw_findings:
            ok, reason = validate_finding(f, cfg.repo_root)
            if ok:
                valid_findings.append(f)
            else:
                log.warning(f"  Dropping finding {f.id} — {reason}: {f.file_path}")

        # Deduplicate
        new_only = deduplicate_findings(valid_findings, existing_findings)

        log.info(
            f"Findings: {len(raw_findings)} parsed, "
            f"{len(valid_findings)} valid, "
            f"{len(new_only)} new (after dedup)"
        )

        self._new_findings = new_only

        # Persist to findings.json
        if new_only:
            findings_path = persist_findings(new_only, cfg.artifacts_dir, cfg.dry_run)
            self.report.artifacts_written.append(findings_path)

        # Update report
        self.report.new_findings_count = len(new_only)
        severity_counts: Dict[str, int] = {"high": 0, "medium": 0, "low": 0}
        summary_lines = []
        for f in new_only:
            severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1
            summary_lines.append(
                f"  {f.severity.upper():6s}  {f.rule_id:8s}  {f.file_path}:{f.line_start}"
                + (f"  [{f.symbol}]" if f.symbol else "")
                + f"\n         {f.description[:80]}"
            )
        self.report.findings_by_severity = severity_counts
        self.report.findings_summary = "\n".join(summary_lines[:20])

        # Cycle is valid only if the JSON block was parseable
        self.report.cycle_valid = True

        # Update consecutive_no_findings counter
        if len(new_only) == 0:
            self._consecutive_no_findings += 1
        else:
            self._consecutive_no_findings = 0

    # -----------------------------------------------------------------------
    # review_only: Step — Add fix queue entries
    # -----------------------------------------------------------------------

    def step_add_fix_queue_entries(self) -> None:
        log = self.log
        existing_queue = self._tracker_data.get("queue", [])
        self._new_fix_entries = build_fix_queue_entries(self._new_findings, existing_queue)

        if self._new_fix_entries:
            log.info(
                f"Adding {len(self._new_fix_entries)} fix queue entries for "
                f"high/medium findings"
            )
        else:
            log.info("No new fix queue entries (no high/medium findings)")

    # -----------------------------------------------------------------------
    # apply_fix: Step — Build fix context
    # -----------------------------------------------------------------------

    def step_build_fix_context(self) -> None:
        log = self.log
        log.info("Step: Building fix context")

        self._inventory = build_inventory(self.cfg.repo_root)
        self._arch_map = build_architecture_map(self.cfg.repo_root, self._inventory)

        self._review_context = build_fix_context(
            self.cfg.repo_root,
            self._winning_entry,
            self._tracker_data,
            self._inventory,
            self._arch_map,
        )
        self.report.files_involved = self._review_context.scope_files[:20]

    # -----------------------------------------------------------------------
    # apply_fix: Step — Generate fix prompt and run Codex
    # -----------------------------------------------------------------------

    def step_run_fix_codex(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step: Generating fix prompt and running Codex")

        from .review_tracker import get_finding_by_id
        finding_id = self._winning_entry.get("finding_id", "")
        finding = get_finding_by_id(self._tracker_data, finding_id) or {}

        tracker_summary = summarize_review_tracker(self._tracker_data)

        raw_edge_cases = finding.get("edge_cases", [])
        if isinstance(raw_edge_cases, list) and raw_edge_cases:
            edge_cases_str = "\n".join(f"  - {ec}" for ec in raw_edge_cases)
        else:
            edge_cases_str = "(none documented — verify manually)"

        fix_ctx = FixPromptContext(
            finding_id=finding_id,
            finding_title=self._winning_entry.get("title", ""),
            finding_file=finding.get("file_path", ""),
            finding_description=finding.get("description", ""),
            evidence=finding.get("evidence", ""),
            recommended_action=finding.get("recommended_action", ""),
            severity=finding.get("severity", "medium"),
            repo_root=cfg.repo_root,
            tracker_summary=tracker_summary,
            edge_cases=edge_cases_str,
        )

        try:
            if self._ai_client:
                self._cycle_prompt = self._ai_client.generate_fix_prompt(fix_ctx)
                log.info(f"Fix prompt generated ({len(self._cycle_prompt)} chars)")
            else:
                raise RuntimeError("AI client unavailable")
        except Exception as exc:
            log.warning(f"Fix prompt generation failed: {exc}  — using fallback")
            self._cycle_prompt = build_fallback_fix_prompt(
                fix_ctx.finding_id,
                fix_ctx.finding_file,
                fix_ctx.finding_description,
                fix_ctx.recommended_action,
                cfg.repo_root,
                fix_ctx.edge_cases,
            )

        log.save_text("cycle_prompt.txt", self._cycle_prompt)

        self._codex_result = run_codex(
            prompt=self._cycle_prompt,
            cwd=cfg.repo_root,
            codex_bin=cfg.codex_bin,
            extra_args=cfg.codex_extra_args,
        )
        log.save_codex_output(
            self._codex_result.stdout, self._codex_result.stderr, attempt=0, is_repair=False
        )
        self.report.codex_exit_code = self._codex_result.exit_code
        log.info(self._codex_result.summary())

    # -----------------------------------------------------------------------
    # apply_fix: Step — Handle BUG_NOT_FOUND signal
    # -----------------------------------------------------------------------

    def step_handle_bug_not_found(self) -> None:
        """Check if Codex determined the bug no longer exists in the codebase.

        Codex emits 'BUG_NOT_FOUND' in its output when STEP 1 (ground truth
        verification) finds no evidence of the reported issue.  In that case:
          - The finding is a false positive or was already fixed elsewhere.
          - We mark it dismissed in the tracker (not as an error).
          - We skip validation, repair, commit — no code was changed.
        """
        log = self.log
        stdout = self._codex_result.stdout if self._codex_result else ""

        if "BUG_NOT_FOUND" not in stdout and "BUG_VERIFIED: false" not in stdout:
            log.info("Step: Bug verification — BUG_NOT_FOUND signal absent, proceeding with fix")
            return

        finding_id = self._winning_entry.get("finding_id", "unknown")
        log.info(
            f"Step: Bug not found — Codex confirmed finding {finding_id} no longer exists. "
            "Marking as dismissed (false positive or already fixed)."
        )
        self._bug_dismissed = True
        self.report.cycle_valid = True
        self.report.ai_narrative = (
            f"Finding {finding_id} was not found in the codebase during ground truth "
            "verification. It has been dismissed as a false positive or already-fixed issue."
        )

        # Mark finding dismissed in tracker data so step_update_tracker handles it
        finding_id_str = self._winning_entry.get("finding_id", "")
        for f in self._tracker_data.get("findings", []):
            if f.get("id") == finding_id_str:
                f["status"] = "dismissed"
                f["dismissed_at"] = self._timestamp
                f["dismissed_reason"] = "BUG_NOT_FOUND: Codex ground truth check found no evidence"
                break

        # Mark the fix queue entry done too
        for entry in self._tracker_data.get("queue", []):
            if entry.get("finding_id") == finding_id_str and entry.get("mode") == "fix":
                entry["status"] = "done"
                break

    # -----------------------------------------------------------------------
    # apply_fix: Step — Inspect changes
    # -----------------------------------------------------------------------

    def step_inspect_changes(self) -> None:
        log = self.log
        if self._bug_dismissed:
            log.info("Step: Skipping inspect — bug was not found (dismissed)")
            self._changed_files = []
            self._change_flags = classify_changes([])
            return
        log.info("Step: Inspecting git changes")
        self._changed_files = get_changed_files(self.cfg.repo_root)
        self._change_flags = classify_changes(self._changed_files)
        self.report.files_involved = list(self._changed_files)
        log.info(f"Changed files ({len(self._changed_files)}): {self._changed_files[:5]}")

    # -----------------------------------------------------------------------
    # apply_fix: Step — Validate
    # -----------------------------------------------------------------------

    def step_validate(self) -> None:
        log = self.log
        if self._bug_dismissed:
            log.info("Step: Skipping validate — bug was not found (dismissed)")
            self._validation_results = []
            self._cycle_validity = CycleValidity(valid=True, reason="Bug dismissed — no code changes", all_validations_passed=True)
            self.report.cycle_valid = True
            return
        log.info("Step: Running validations")

        cmds = required_validation_commands(self._change_flags, skip_smoke=self.cfg.skip_smoke)
        self.report.commands_run = list(cmds)

        if not cmds:
            log.info("No validation commands required.")
            self._validation_results = []
        else:
            log.info(f"Validation commands: {cmds}")
            self._validation_results = run_validation_commands(cmds, self.cfg.repo_root)

        for vr in self._validation_results:
            combined = (
                f"COMMAND: {vr.command}\nEXIT CODE: {vr.exit_code}\n"
                f"\n--- STDOUT ---\n{vr.stdout}\n\n--- STDERR ---\n{vr.stderr}"
            )
            log.save_validation_output(vr.command, combined)

        self._cycle_validity = evaluate_cycle_validity(
            phase="review-fix",
            flags=self._change_flags,
            validation_results=self._validation_results,
            is_phase_0=False,
        )
        self.report.cycle_valid = self._cycle_validity.valid
        self.report.validation_summary = [vr.as_dict() for vr in self._validation_results]

        if self._cycle_validity.valid:
            log.info(f"Validation: VALID — {self._cycle_validity.reason}")
        else:
            log.warning(f"Validation: INVALID — {self._cycle_validity.reason}")

    # -----------------------------------------------------------------------
    # apply_fix: Step — Repair pass
    # -----------------------------------------------------------------------

    def step_repair_pass(self) -> None:
        log = self.log
        cfg = self.cfg

        if self._bug_dismissed:
            log.info("Step: Skipping repair — bug was not found (dismissed)")
            return

        if self._cycle_validity.valid:
            log.info("Step: Skipping repair (already valid)")
            return
        if not cfg.enable_repair_pass:
            log.info("Step: Repair pass disabled")
            return

        failed = [vr.command for vr in self._validation_results if not vr.passed and not vr.skipped]
        if not failed:
            log.info("Step: No failed commands to repair")
            return

        log.info(f"Step: Repair pass ({cfg.max_repair_attempts} attempt(s))")
        from .openai_client import RepairContext
        from .openai_client import OpenAIClient

        # Reuse delivery lane's repair infrastructure
        try:
            delivery_client = OpenAIClient(
                api_key=cfg.openai_api_key,
                model=cfg.openai_model,
                prompts_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts"),
            )
        except Exception as exc:
            log.warning(f"Could not init delivery AI client for repair: {exc}")
            delivery_client = None

        for attempt in range(1, cfg.max_repair_attempts + 1):
            log.info(f"  Repair attempt {attempt}/{cfg.max_repair_attempts}")

            validation_errors = "\n".join(
                f"[{vr.command}]\n{vr.stderr[:800]}"
                for vr in self._validation_results
                if not vr.passed and not vr.skipped
            )
            repair_prompt = ""
            if delivery_client:
                try:
                    repair_prompt = delivery_client.generate_repair_prompt(
                        RepairContext(
                            phase="review-fix",
                            slice_attempted=self.report.slice_title,
                            changed_files=self._changed_files,
                            failed_validations=failed,
                            validation_errors=validation_errors,
                        )
                    )
                except Exception as exc:
                    log.warning(f"  Repair prompt generation failed: {exc}")

            if not repair_prompt:
                from .repo_city_cycle import _build_fallback_repair_prompt
                repair_prompt = _build_fallback_repair_prompt("review-fix", failed, validation_errors)

            log.save_text(f"repair_{attempt}_prompt.txt", repair_prompt)

            repair_result = run_codex_repair(
                prompt=repair_prompt, cwd=cfg.repo_root,
                codex_bin=cfg.codex_bin, extra_args=cfg.codex_extra_args,
            )
            log.save_codex_output(repair_result.stdout, repair_result.stderr, attempt=attempt, is_repair=True)
            self.report.repair_attempts += 1

            self._changed_files = get_changed_files(cfg.repo_root)
            self._change_flags = classify_changes(self._changed_files)
            cmds = required_validation_commands(self._change_flags, skip_smoke=cfg.skip_smoke)
            self._validation_results = run_validation_commands(cmds, cfg.repo_root)
            self._cycle_validity = evaluate_cycle_validity(
                phase="review-fix", flags=self._change_flags,
                validation_results=self._validation_results, is_phase_0=False,
            )
            self.report.cycle_valid = self._cycle_validity.valid
            self.report.validation_summary = [vr.as_dict() for vr in self._validation_results]

            if self._cycle_validity.valid:
                log.info(f"  Repair attempt {attempt} succeeded!")
                break
            else:
                log.warning(f"  Repair attempt {attempt} still invalid: {self._cycle_validity.reason}")

    # -----------------------------------------------------------------------
    # apply_fix: Step — Accept or revert tracker
    # -----------------------------------------------------------------------

    def step_accept_or_revert(self) -> None:
        log = self.log
        if self._bug_dismissed:
            log.info("Step: Skipping accept/revert — bug was not found (dismissed, no code changed)")
            self.report.tracker_changes = "Bug dismissed — finding marked dismissed in tracker"
            return
        log.info("Step: Tracker acceptance check")

        changed = review_tracker_changed(self._tracker_snapshot, self.cfg.review_tracker_path)
        tracker_diff = diff_review_tracker_text(self._tracker_snapshot, self.cfg.review_tracker_path)

        if not changed:
            self.report.tracker_changes = "none"
            log.info("Review tracker unchanged — nothing to accept or revert.")
            return

        self.report.tracker_changes = tracker_diff[:2000]

        revert_reason: Optional[str] = None
        if not self._cycle_validity.valid:
            revert_reason = f"Fix cycle invalid: {self._cycle_validity.reason}"
        elif not self._cycle_validity.all_validations_passed:
            revert_reason = "Not all validations passed."

        if revert_reason:
            log.warning(f"Reverting tracker changes — {revert_reason}")
            restore_review_tracker_text(self.cfg.review_tracker_path, self._tracker_snapshot)
            self.report.tracker_changes = f"REVERTED — {revert_reason}"
        else:
            log.info("Review tracker changes accepted (apply_fix cycle valid).")
            # Mark finding resolved in tracker data (for summary)
            log.info("Fix accepted — finding will be marked resolved in tracker update step.")

    # -----------------------------------------------------------------------
    # apply_fix: Step — Commit and push
    # -----------------------------------------------------------------------

    def step_commit_and_push(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step: Commit and push")

        if self._bug_dismissed:
            log.info("Skipping commit — bug was not found (no code changes to commit)")
            return

        if not self._cycle_validity.valid:
            log.info("Skipping commit — fix cycle is invalid.")
            return

        if not has_uncommitted_changes(cfg.repo_root):
            log.info("Skipping commit — no uncommitted changes.")
            return

        if cfg.dry_run:
            log.info("[DRY RUN] Skipping git add / commit / push.")
            return

        finding_id = self._winning_entry.get("finding_id", "unknown")
        commit_msg = (
            f"fix(review): {sanitize_commit_message(self.report.slice_title)[:80]}\n\n"
            f"Resolves review finding {finding_id}. "
            "Auto-committed by repo-city-review-cycle."
        )

        try:
            stage_all_changes(cfg.repo_root)
            commit_hash = commit_changes(commit_msg, cfg.repo_root)
            if not commit_hash:
                log.info("Nothing staged — no commit created.")
                return

            self.report.committed = True
            self.report.commit_hash = commit_hash
            log.info(f"Committed: {commit_hash}")

            if cfg.allow_push:
                push_branch(cfg.git_remote, cfg.base_branch, cfg.repo_root)
                self.report.pushed = True
                log.info("Push successful.")
            else:
                log.info("REPO_CITY_REVIEW_ALLOW_PUSH=false — commit created but NOT pushed.")

        except GitError as exc:
            log.error(f"Git error during commit/push: {exc}")
            self.report.error = str(exc)

    # -----------------------------------------------------------------------
    # Shared Step: Update review tracker
    # -----------------------------------------------------------------------

    def step_update_tracker(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step: Updating review tracker")

        # For apply_fix mode, mark finding resolved/dismissed based on outcome
        new_findings_for_tracker = []
        if cfg.mode == "review_only":
            new_findings_for_tracker = [f.as_dict() for f in self._new_findings]
        elif cfg.mode == "apply_fix":
            finding_id = self._winning_entry.get("finding_id", "")
            if self._bug_dismissed:
                # Already mutated in step_handle_bug_not_found — just log
                log.info(f"Finding {finding_id} was dismissed (BUG_NOT_FOUND)")
            elif hasattr(self, "_cycle_validity") and self._cycle_validity and self._cycle_validity.valid:
                # Mark the finding resolved
                for f in self._tracker_data.get("findings", []):
                    if f.get("id") == finding_id:
                        f["status"] = "resolved"
                        f["resolved_at"] = self._timestamp
                log.info(f"Marked finding {finding_id} as resolved")

        # Build updated tracker
        updated_tracker = build_tracker_update(
            data=self._tracker_data,
            winning_entry=self._winning_entry,
            new_findings=new_findings_for_tracker,
            new_fix_entries=self._new_fix_entries,
            consecutive_no_findings=self._consecutive_no_findings,
            timestamp=self._timestamp,
        )

        # AI advisory consistency check
        if self._ai_client:
            try:
                import json as _json
                original_excerpt = self._tracker_snapshot[:2000]
                diff_preview = diff_review_tracker_text(self._tracker_snapshot, cfg.review_tracker_path)
                ai_ctx = ReviewTrackerConsistencyContext(
                    original_tracker=original_excerpt,
                    tracker_diff=diff_preview[:1000],
                    mode=cfg.mode,
                    slice_title=self.report.slice_title,
                    new_findings_count=len(self._new_findings),
                    dry_run=cfg.dry_run,
                )
                ai_result = self._ai_client.review_tracker_consistency(ai_ctx)
                log.info(f"AI tracker check: {ai_result.recommendation} — {ai_result.reasoning[:100]}")
            except Exception as exc:
                log.warning(f"AI tracker consistency check failed (ignoring): {exc}")

        # Write tracker (dry_run-aware)
        tracker_dest = cfg.review_tracker_path + (".dryrun" if cfg.dry_run else "")
        import json as _json
        with open(tracker_dest, "w", encoding="utf-8") as fh:
            _json.dump(updated_tracker, fh, indent=2, ensure_ascii=False)

        diff_text = diff_review_tracker_text(self._tracker_snapshot, tracker_dest)
        self.report.tracker_changes = diff_text[:2000]
        self.report.artifacts_written.append(tracker_dest)
        log.info(f"Review tracker written: {tracker_dest}")

        # Update queue counts for report
        pending = updated_tracker.get("queue", [])
        self.report.queue_size = sum(1 for e in pending if e.get("status") == "pending")
        self.report.queue_review_count = sum(1 for e in pending if e.get("status") == "pending" and e.get("mode") == "review")
        self.report.queue_fix_count = sum(1 for e in pending if e.get("status") == "pending" and e.get("mode") == "fix")
        open_findings = get_open_findings(updated_tracker)
        self.report.total_open_findings = len(open_findings)

        # Build and save removal candidates
        all_findings_from_artifacts = load_findings_from_artifacts(cfg.artifacts_dir)
        decisions_path = os.path.join(cfg.artifacts_dir, "decisions.json")
        candidates = build_removal_candidates(all_findings_from_artifacts, decisions_path)
        candidates_path = persist_removal_candidates(candidates, cfg.artifacts_dir, cfg.dry_run)
        self.report.artifacts_written.append(candidates_path)

        self._updated_tracker = updated_tracker

    # -----------------------------------------------------------------------
    # Shared Step: Evaluate stop policy
    # -----------------------------------------------------------------------

    def step_evaluate_stop_policy(self) -> None:
        log = self.log
        tracker = getattr(self, "_updated_tracker", self._tracker_data)
        campaign = tracker.get("campaign", {})
        cycles_run = campaign.get("cycles_run", self.report.cycle_number)

        should_stop, reason = evaluate_stop_policy(
            data=tracker,
            cycles_run=cycles_run,
            max_cycles=self.cfg.max_cycles,
            stop_on_score_below=self.cfg.stop_on_score_below,
            stop_on_findings_below=self.cfg.stop_on_findings_below,
            max_consecutive_no_findings=self.cfg.max_consecutive_no_findings,
            consecutive_no_findings=self._consecutive_no_findings,
            now_iso=self._timestamp,
        )

        self.report.should_stop = should_stop
        self.report.stop_reason = reason

        if should_stop:
            log.info(f"Stop policy triggered: {reason}")
        else:
            log.info(f"Stop policy: continue ({reason or 'all checks passed'})")

    # -----------------------------------------------------------------------
    # Shared Step: Report
    # -----------------------------------------------------------------------

    def step_report(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step: Generating final report")

        # For apply_fix mode, try to extract AI narrative from Codex output
        if cfg.mode == "apply_fix" and self._codex_result:
            codex_sections = parse_codex_report_sections(self._codex_result.stdout)
            if codex_sections.get("Results"):
                self.report.ai_narrative = codex_sections["Results"]

        # Generate AI findings narrative for review_only if we have an AI client
        if cfg.mode == "review_only" and self._ai_client and self._new_findings:
            try:
                findings_json = json.dumps(
                    [f.as_dict() for f in self._new_findings[:10]], indent=2
                )[:3000]
                summary_prompt = (
                    f"Summarise these {len(self._new_findings)} code review findings "
                    f"in 3-5 sentences. List top 3 actionable recommendations.\n\n"
                    + findings_json
                )
                from .review_openai_client import _parse_json_from_response
                system = "You are a code quality analyst. Be concise and evidence-based."
                narrative = self._ai_client._call(system, summary_prompt, temperature=0.2)
                self.report.ai_narrative = narrative[:1000]
            except Exception as exc:
                log.warning(f"AI narrative generation failed (ignoring): {exc}")
                self.report.ai_narrative = (
                    f"Found {self.report.new_findings_count} new findings in workstream "
                    f"'{self.report.workstream}'."
                )

        # Format and save
        report_text = format_review_report(self.report)
        log.save_final_report(report_text)

        summary = build_review_summary_json(self.report)
        log.save_summary(summary)

        # Save final_report.txt to artifacts dir too
        final_report_dest = os.path.join(
            cfg.artifacts_dir, "final_report.txt" + (".dryrun" if cfg.dry_run else "")
        )
        try:
            with open(final_report_dest, "w", encoding="utf-8") as fh:
                fh.write(report_text)
            self.report.artifacts_written.append(final_report_dest)
        except OSError:
            pass

        # Save summary.json to artifacts dir
        summary_dest = os.path.join(
            cfg.artifacts_dir, "summary.json" + (".dryrun" if cfg.dry_run else "")
        )
        try:
            with open(summary_dest, "w", encoding="utf-8") as fh:
                json.dump(summary, fh, indent=2, ensure_ascii=False)
        except OSError:
            pass

        # Print to stdout
        print("\n" + "=" * 72)
        print("REPO-CITY-REVIEW-CYCLE REPORT")
        print("=" * 72 + "\n")
        print(report_text)
        print("\n" + "=" * 72)
        valid_label = "VALID" if self.report.cycle_valid else "INVALID"
        stop_label = "STOP" if self.report.should_stop else "CONTINUE"
        print(
            f"Cycle: {valid_label} | Mode: {cfg.mode} | "
            f"Findings: {self.report.new_findings_count} new | Campaign: {stop_label}"
        )
        if cfg.dry_run:
            print("[DRY RUN] No live files modified. See .dryrun files in docs/review_artifacts/")
        print(f"Logs: {log.run_dir}")
        print("=" * 72 + "\n")

    # -----------------------------------------------------------------------
    # Run
    # -----------------------------------------------------------------------

    def run(self) -> int:
        """Execute the full review cycle.

        Returns:
          0 = cycle valid AND campaign should continue
          1 = should stop (clean, policy-driven)
          2 = fatal error
        """
        cfg = self.cfg

        if cfg.mode == "review_only":
            steps = [
                self.step_preflight,
                self.step_build_review_context,
                self.step_run_review_codex,
                self.step_parse_and_store_findings,
                self.step_add_fix_queue_entries,
                self.step_update_tracker,
                self.step_evaluate_stop_policy,
                self.step_report,
            ]
        else:  # apply_fix
            self._cycle_validity = None
            self._change_flags = None
            self._validation_results = []
            steps = [
                self.step_preflight,
                self.step_build_fix_context,
                self.step_run_fix_codex,
                self.step_handle_bug_not_found,
                self.step_inspect_changes,
                self.step_validate,
                self.step_repair_pass,
                self.step_accept_or_revert,
                self.step_commit_and_push,
                self.step_update_tracker,
                self.step_evaluate_stop_policy,
                self.step_report,
            ]

        try:
            for step in steps:
                step()
        except RuntimeError as exc:
            self.log.error(f"Fatal: {exc}")
            self.report.error = str(exc)
            self.report.results = f"Fatal error: {exc}"
            try:
                self.step_report()
            except Exception:
                pass
            return 2
        except Exception as exc:
            tb = traceback.format_exc()
            self.log.error(f"Unexpected error: {exc}\n{tb}")
            self.report.error = f"{exc}\n{tb}"
            try:
                self.step_report()
            except Exception:
                pass
            return 2

        if self.report.should_stop:
            return 1
        return 0 if self.report.cycle_valid else 1


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    """Run a single review cycle.  Returns exit code."""
    cfg = load_review_config()
    logger = setup_run_logger(cfg.log_dir_abs)

    cycle = ReviewCycle(cfg, logger)
    return cycle.run()


if __name__ == "__main__":
    sys.exit(main())
