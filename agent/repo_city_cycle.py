"""repo_city_cycle.py — main orchestrator for the repo-city-cycle wrapper.

Orchestration flow:
    Step 1  Preflight
    Step 2  Prompt generation (OpenAI)
    Step 3  Codex run
    Step 4  Inspect changes
    Step 5  Validation
    Step 6  Optional repair pass
    Step 7  Tracker acceptance / reversion
    Step 8  Git commit and push
    Step 9  Reporting

Run via:
    python -m agent.repo_city_cycle
or via the repo-city-cycle shell wrapper.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path
from typing import Dict, List, Optional

from .config import Config, REQUIRED_DOCS, load_config
from .logging_utils import RunLogger, setup_run_logger
from .tracker import (
    diff_tracker_text,
    find_first_incomplete_milestone,
    get_current_phase,
    get_open_risks,
    get_recommended_slice,
    load_tracker,
    normalize_tracker_for_diff,
    restore_tracker_text,
    snapshot_tracker_text,
    summarize_tracker,
    tracker_changed,
)
from .codex_runner import run_codex, run_codex_repair, CodexResult
from .openai_client import (
    CycleContext,
    OpenAIClient,
    RepairContext,
    TrackerReviewContext,
)
from .validator import (
    ChangeFlags,
    CycleValidity,
    ValidationResult,
    classify_changes,
    evaluate_cycle_validity,
    get_changed_files,
    required_validation_commands,
    run_validation_commands,
)
from .git_ops import (
    GitError,
    checkout_file,
    commit_changes,
    ensure_on_branch,
    get_current_branch,
    get_diff_stat,
    has_uncommitted_changes,
    is_clean_enough_to_start,
    is_git_repo,
    pull_latest,
    push_branch,
    sanitize_commit_message,
    stage_all_changes,
)
from .report import (
    CycleReport,
    build_summary_json,
    format_report,
    format_report_json,
    parse_codex_report_sections,
)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class RepoCityCycle:
    """Full cycle orchestrator."""

    def __init__(self, cfg: Config, logger: RunLogger) -> None:
        self.cfg = cfg
        self.log = logger
        self.report = CycleReport(run_id=logger.run_dir.split(os.sep)[-1])

        self._tracker_snapshot: str = ""
        self._tracker_data: dict = {}
        self._current_milestone: Optional[dict] = None
        self._cycle_prompt: str = ""
        self._codex_result: Optional[CodexResult] = None
        self._changed_files: List[str] = []
        self._change_flags: Optional[ChangeFlags] = None
        self._validation_results: List[ValidationResult] = []
        self._cycle_validity: Optional[CycleValidity] = None
        self._ai_client: Optional[OpenAIClient] = None

    # -----------------------------------------------------------------------
    # Step 1: Preflight
    # -----------------------------------------------------------------------

    def step1_preflight(self) -> None:
        cfg = self.cfg
        log = self.log

        log.info("Step 1: Preflight checks")

        # Repo root existence
        if not os.path.isdir(cfg.repo_root):
            raise RuntimeError(f"Repo root does not exist: {cfg.repo_root}")

        # Git repo check
        if not is_git_repo(cfg.repo_root):
            raise RuntimeError(f"Not a git repository: {cfg.repo_root}")

        # Required docs
        missing_docs: List[str] = []
        for doc in REQUIRED_DOCS:
            doc_path = os.path.join(cfg.docs_dir, doc)
            if not os.path.isfile(doc_path):
                missing_docs.append(doc)
        if missing_docs:
            raise RuntimeError(
                f"Missing required repo-city docs: {missing_docs}\n"
                f"  Expected in: {cfg.docs_dir}"
            )

        # Git state check
        ok, git_msg = is_clean_enough_to_start(cfg.repo_root)
        if not ok:
            raise RuntimeError(
                f"Repository is not clean enough to start a cycle.\n{git_msg}\n"
                "Stash, commit, or revert uncommitted changes before running."
            )
        log.info(f"Git state: {git_msg}")

        # Ensure we're on the base branch
        current_branch = get_current_branch(cfg.repo_root)
        if current_branch != cfg.base_branch:
            log.info(
                f"Current branch is '{current_branch}'; switching to '{cfg.base_branch}'"
            )
            ensure_on_branch(cfg.base_branch, cfg.repo_root)

        # Optionally pull latest
        if not cfg.skip_git_pull:
            log.info(
                f"Pulling latest from {cfg.git_remote}/{cfg.base_branch} (rebase)..."
            )
            try:
                pull_out = pull_latest(cfg.git_remote, cfg.base_branch, cfg.repo_root)
                log.info(f"Pull result: {pull_out or 'up to date'}")
            except GitError as exc:
                log.warning(f"git pull --rebase failed (proceeding anyway): {exc}")
        else:
            log.info("Skipping git pull (REPO_CITY_SKIP_GIT_PULL=true)")

        # Snapshot tracker
        log.info(f"Snapshotting tracker: {cfg.tracker_path}")
        self._tracker_snapshot = snapshot_tracker_text(cfg.tracker_path)

        # Load tracker
        try:
            self._tracker_data = load_tracker(cfg.tracker_path)
        except (ValueError, FileNotFoundError) as exc:
            raise RuntimeError(f"Failed to load tracker: {exc}") from exc

        # Determine current state
        self._current_milestone = find_first_incomplete_milestone(self._tracker_data)
        phase = get_current_phase(self._tracker_data, self._current_milestone)
        milestone_title = ""
        milestone_desc = ""
        if self._current_milestone:
            milestone_title = (
                self._current_milestone.get("title")
                or self._current_milestone.get("name")
                or self._current_milestone.get("description")
                or str(self._current_milestone.get("phase", ""))
            )
            milestone_desc = (
                self._current_milestone.get("description")
                or self._current_milestone.get("goal")
                or ""
            )

        self.report.phase = phase

        recommended_slice = get_recommended_slice(self._tracker_data, self._current_milestone)
        self.report.slice_attempted = recommended_slice

        log.info(f"Current phase: {phase}")
        log.info(f"Milestone: {milestone_title}")
        log.info(f"Recommended slice: {recommended_slice}")

        # Initialise OpenAI client
        self._ai_client = OpenAIClient(
            api_key=cfg.openai_api_key,
            model=cfg.openai_model,
            prompts_dir=cfg.prompts_dir,
        )

        # Store for later use
        self._phase = phase
        self._milestone_title = milestone_title
        self._milestone_desc = milestone_desc
        self._recommended_slice = recommended_slice

    # -----------------------------------------------------------------------
    # Step 2: Prompt generation
    # -----------------------------------------------------------------------

    def step2_generate_prompt(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step 2: Generating cycle prompt via OpenAI")

        # Load doc contents for context
        doc_contents: Dict[str, str] = {}
        for doc in REQUIRED_DOCS:
            doc_path = os.path.join(cfg.docs_dir, doc)
            try:
                doc_contents[doc] = Path(doc_path).read_text(encoding="utf-8")
            except Exception:  # noqa: BLE001
                doc_contents[doc] = "(could not read)"

        ctx = CycleContext(
            phase=self._phase,
            milestone_title=self._milestone_title,
            milestone_description=self._milestone_desc,
            recommended_slice=self._recommended_slice,
            repo_root=cfg.repo_root,
            tracker_summary=summarize_tracker(self._tracker_data),
            open_risks="\n".join(get_open_risks(self._tracker_data)),
            doc_contents=doc_contents,
        )

        try:
            self._cycle_prompt = self._ai_client.generate_cycle_prompt(ctx)
            log.info(
                f"Cycle prompt generated ({len(self._cycle_prompt)} chars)"
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                f"OpenAI prompt generation failed: {exc}\n"
                "Falling back to a simple default prompt."
            )
            self._cycle_prompt = _build_fallback_prompt(
                self._phase,
                self._milestone_title,
                self._recommended_slice,
                cfg.repo_root,
            )

        log.save_text("cycle_prompt.txt", self._cycle_prompt)

    # -----------------------------------------------------------------------
    # Step 3: Codex run
    # -----------------------------------------------------------------------

    def step3_run_codex(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step 3: Running Codex")

        self._codex_result = run_codex(
            prompt=self._cycle_prompt,
            cwd=cfg.repo_root,
            codex_bin=cfg.codex_bin,
            extra_args=cfg.codex_extra_args,
        )

        log.save_codex_output(
            self._codex_result.stdout,
            self._codex_result.stderr,
            attempt=0,
            is_repair=False,
        )

        self.report.codex_exit_code = self._codex_result.exit_code
        log.info(self._codex_result.summary())

        if not self._codex_result.succeeded:
            log.warning(
                f"Codex exited {self._codex_result.exit_code}. "
                "Continuing to inspect git state."
            )

    # -----------------------------------------------------------------------
    # Step 4: Inspect changes
    # -----------------------------------------------------------------------

    def step4_inspect_changes(self) -> None:
        log = self.log
        log.info("Step 4: Inspecting git changes")

        self._changed_files = get_changed_files(self.cfg.repo_root)
        self._change_flags = classify_changes(self._changed_files)

        self.report.files_changed = list(self._changed_files)

        diff_stat = get_diff_stat(self.cfg.repo_root)
        if diff_stat:
            log.info(f"Diff stat:\n{diff_stat}")
        else:
            log.info("No staged changes (git diff --stat HEAD empty)")

        log.info(
            f"Changed files ({len(self._changed_files)}): "
            + ", ".join(self._changed_files[:10])
            + ("..." if len(self._changed_files) > 10 else "")
        )
        log.info(f"Tracker changed: {self._change_flags.tracker_changed}")
        log.info(
            f"Eligible non-doc change: {self._change_flags.has_eligible_non_doc_change}"
        )

    # -----------------------------------------------------------------------
    # Step 5: Validation
    # -----------------------------------------------------------------------

    def step5_validation(self) -> None:
        log = self.log
        log.info("Step 5: Running validation commands")

        cmds = required_validation_commands(self._change_flags, skip_smoke=self.cfg.skip_smoke)
        self.report.commands_run = list(cmds)

        if not cmds:
            log.info("No validation commands required for the changed files.")
            self._validation_results = []
        else:
            log.info(f"Validation commands: {cmds}")
            self._validation_results = run_validation_commands(
                cmds, self.cfg.repo_root
            )

        # Save individual validation logs
        for vr in self._validation_results:
            combined = (
                f"COMMAND: {vr.command}\n"
                f"EXIT CODE: {vr.exit_code}\n"
                f"SKIPPED: {vr.skipped}"
                + (f" ({vr.skip_reason})" if vr.skip_reason else "")
                + f"\n\n--- STDOUT ---\n{vr.stdout}\n\n--- STDERR ---\n{vr.stderr}"
            )
            log.save_validation_output(vr.command, combined)

        # Determine phase-0 status
        is_phase_0 = _is_phase_zero(self._phase)

        self._cycle_validity = evaluate_cycle_validity(
            phase=self._phase,
            flags=self._change_flags,
            validation_results=self._validation_results,
            is_phase_0=is_phase_0,
        )

        self.report.validation_summary = [vr.as_dict() for vr in self._validation_results]
        self.report.cycle_valid = self._cycle_validity.valid

        if self._cycle_validity.valid:
            log.info(f"Cycle validity: VALID — {self._cycle_validity.reason}")
        else:
            log.warning(f"Cycle validity: INVALID — {self._cycle_validity.reason}")

    # -----------------------------------------------------------------------
    # Step 6: Optional repair pass
    # -----------------------------------------------------------------------

    def step6_repair_pass(self) -> None:
        log = self.log
        cfg = self.cfg

        if self._cycle_validity.valid:
            log.info("Step 6: Skipping repair (cycle already valid)")
            return

        if not cfg.enable_repair_pass:
            log.info("Step 6: Repair pass disabled (REPO_CITY_ENABLE_REPAIR_PASS=false)")
            return

        failed_validations = [
            vr.command
            for vr in self._validation_results
            if not vr.passed and not vr.skipped
        ]

        if not failed_validations:
            # Failure isn't from validation commands — skip repair
            log.info(
                "Step 6: No failed validation commands to repair (invalid for other reasons)"
            )
            return

        log.info(
            f"Step 6: Repair pass ({cfg.max_repair_attempts} attempt(s) allowed)"
        )

        for attempt in range(1, cfg.max_repair_attempts + 1):
            log.info(f"  Repair attempt {attempt}/{cfg.max_repair_attempts}")

            # Generate repair prompt
            validation_errors = "\n".join(
                f"[{vr.command}]\n{vr.stderr[:800]}"
                for vr in self._validation_results
                if not vr.passed and not vr.skipped
            )
            repair_ctx = RepairContext(
                phase=self._phase,
                slice_attempted=self._recommended_slice,
                changed_files=self._changed_files,
                failed_validations=failed_validations,
                validation_errors=validation_errors,
            )
            try:
                repair_prompt = self._ai_client.generate_repair_prompt(repair_ctx)
            except Exception as exc:  # noqa: BLE001
                log.warning(f"  OpenAI repair prompt generation failed: {exc}")
                repair_prompt = _build_fallback_repair_prompt(
                    self._phase, failed_validations, validation_errors
                )

            log.save_text(f"repair_{attempt}_prompt.txt", repair_prompt)

            # Run repair
            repair_result = run_codex_repair(
                prompt=repair_prompt,
                cwd=cfg.repo_root,
                codex_bin=cfg.codex_bin,
                extra_args=cfg.codex_extra_args,
            )
            log.save_codex_output(
                repair_result.stdout,
                repair_result.stderr,
                attempt=attempt,
                is_repair=True,
            )
            log.info(f"  Repair Codex: {repair_result.summary()}")
            self.report.repair_attempts += 1

            # Re-inspect and re-validate
            self._changed_files = get_changed_files(cfg.repo_root)
            self._change_flags = classify_changes(self._changed_files)
            self.report.files_changed = list(self._changed_files)

            cmds = required_validation_commands(self._change_flags, skip_smoke=self.cfg.skip_smoke)
            self.report.commands_run = list(cmds)

            self._validation_results = run_validation_commands(cmds, cfg.repo_root)

            for vr in self._validation_results:
                combined = (
                    f"COMMAND: {vr.command}\n"
                    f"EXIT CODE: {vr.exit_code}\n\n"
                    f"--- STDOUT ---\n{vr.stdout}\n\n--- STDERR ---\n{vr.stderr}"
                )
                log.save_validation_output(f"repair_{attempt}_{vr.command}", combined)

            is_phase_0 = _is_phase_zero(self._phase)
            self._cycle_validity = evaluate_cycle_validity(
                phase=self._phase,
                flags=self._change_flags,
                validation_results=self._validation_results,
                is_phase_0=is_phase_0,
            )
            self.report.cycle_valid = self._cycle_validity.valid
            self.report.validation_summary = [
                vr.as_dict() for vr in self._validation_results
            ]

            if self._cycle_validity.valid:
                log.info(f"  Repair attempt {attempt} succeeded!")
                break
            else:
                log.warning(
                    f"  Repair attempt {attempt} still invalid: "
                    f"{self._cycle_validity.reason}"
                )

    # -----------------------------------------------------------------------
    # Step 7: Tracker acceptance / reversion
    # -----------------------------------------------------------------------

    def step7_tracker_acceptance(self) -> None:
        log = self.log
        log.info("Step 7: Tracker acceptance check")

        tracker_was_changed = tracker_changed(
            self._tracker_snapshot, self.cfg.tracker_path
        )
        tracker_diff = diff_tracker_text(
            self._tracker_snapshot, self.cfg.tracker_path
        )

        if not tracker_was_changed:
            self.report.tracker_changes = "none"
            log.info("Tracker unchanged — nothing to accept or revert.")
            return

        self.report.tracker_changes = tracker_diff[:2000]

        # Deterministic revert conditions
        revert_reason: Optional[str] = None

        if not self._cycle_validity.valid:
            revert_reason = (
                f"Cycle is invalid: {self._cycle_validity.reason}"
            )
        elif not self._cycle_validity.at_least_one_validation_ran:
            revert_reason = "No validation commands ran."
        elif not self._cycle_validity.all_validations_passed:
            revert_reason = "Not all validations passed."

        # Optional AI tracker review (advisory only — cannot override revert)
        if revert_reason is None and self._ai_client is not None:
            try:
                review_ctx = TrackerReviewContext(
                    original_tracker=self._tracker_snapshot[:3000],
                    tracker_diff=tracker_diff,
                    phase=self._phase,
                    slice_attempted=self._recommended_slice,
                    files_changed=self._changed_files,
                    validations_passed=self._cycle_validity.all_validations_passed,
                    validation_commands=[
                        vr.command for vr in self._validation_results
                    ],
                )
                review = self._ai_client.review_tracker_consistency(review_ctx)
                log.info(
                    f"AI tracker review: {review.recommendation} — {review.reasoning}"
                )
                if review.recommendation == "revert" and review.issues:
                    log.warning(
                        f"AI review recommends revert (advisory): {review.issues}"
                    )
                    # AI advisory: log but don't force revert if deterministic passed
            except Exception as exc:  # noqa: BLE001
                log.warning(f"AI tracker review failed (ignoring): {exc}")

        if revert_reason:
            log.warning(
                f"Reverting tracker changes — {revert_reason}"
            )
            restore_tracker_text(self.cfg.tracker_path, self._tracker_snapshot)
            self.report.tracker_reverted = True
            self.report.tracker_changes = f"REVERTED — {revert_reason}"
        else:
            log.info("Tracker changes accepted.")
            self.report.tracker_reverted = False

    # -----------------------------------------------------------------------
    # Step 8: Git commit and push
    # -----------------------------------------------------------------------

    def step8_commit_and_push(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step 8: Git commit and push")

        if not self._cycle_validity.valid:
            log.info("Skipping commit — cycle is invalid.")
            return

        if not has_uncommitted_changes(cfg.repo_root):
            log.info("Skipping commit — no uncommitted changes.")
            return

        commit_msg = _build_commit_message(
            self._phase, self._recommended_slice
        )
        log.info(f"Commit message: {commit_msg!r}")

        if cfg.dry_run:
            log.info(
                "[DRY RUN] Skipping git add / commit / push. "
                "Changes are NOT committed."
            )
            return

        try:
            # Stage everything (tracker reversion above already ran if needed)
            stage_all_changes(cfg.repo_root)

            commit_hash = commit_changes(commit_msg, cfg.repo_root)
            if not commit_hash:
                log.info("Nothing staged — no commit created.")
                return

            self.report.committed = True
            self.report.commit_hash = commit_hash
            log.info(f"Committed: {commit_hash}")

            if cfg.allow_push_main:
                log.info(
                    f"[WARNING] Pushing directly to {cfg.git_remote}/{cfg.base_branch}"
                )
                push_branch(cfg.git_remote, cfg.base_branch, cfg.repo_root)
                self.report.pushed = True
                log.info("Push successful.")
            else:
                log.info(
                    "REPO_CITY_ALLOW_PUSH_MAIN=false — commit created but NOT pushed."
                )

        except GitError as exc:
            log.error(f"Git error during commit/push: {exc}")
            self.report.error = str(exc)

    # -----------------------------------------------------------------------
    # Step 9: Reporting
    # -----------------------------------------------------------------------

    def step9_report(self) -> None:
        log = self.log
        cfg = self.cfg
        log.info("Step 9: Generating final report")

        # Incorporate sections parsed from Codex output (if Codex printed them)
        codex_stdout = (self._codex_result.stdout if self._codex_result else "")
        codex_sections = parse_codex_report_sections(codex_stdout)

        # Fill report fields from Codex output where we don't have better data
        if not self.report.results and codex_sections.get("Results"):
            self.report.results = codex_sections["Results"]
        if not self.report.what_works_now and codex_sections.get("What works now"):
            self.report.what_works_now = codex_sections["What works now"]
        if not self.report.what_is_blocked and codex_sections.get("What is blocked"):
            self.report.what_is_blocked = codex_sections["What is blocked"]
        if (
            self.report.tracker_changes in ("none", "")
            and codex_sections.get("Tracker changes Codex made")
        ):
            self.report.tracker_changes = codex_sections["Tracker changes Codex made"]

        # Build results text if still empty
        if not self.report.results:
            valid_str = "VALID" if self._cycle_validity and self._cycle_validity.valid else "INVALID"
            passed = sum(
                1 for vr in self._validation_results if vr.passed and not vr.skipped
            )
            failed = sum(
                1 for vr in self._validation_results if not vr.passed and not vr.skipped
            )
            self.report.results = (
                f"Cycle: {valid_str}\n"
                f"Validations: {passed} passed, {failed} failed\n"
                f"Codex exit code: {self.report.codex_exit_code}"
            )

        if not self.report.what_works_now:
            self.report.what_works_now = "(see Codex output)"
        if not self.report.what_is_blocked:
            self.report.what_is_blocked = "(see Codex output)"

        # Format and save report
        report_text = format_report(self.report)
        log.save_final_report(report_text)

        summary = build_summary_json(self.report)
        log.save_summary(summary)

        # Print to stdout
        print("\n" + "=" * 72)
        print("REPO-CITY-CYCLE FINAL REPORT")
        print("=" * 72 + "\n")

        if cfg.json_only_report:
            print(format_report_json(self.report))
        else:
            print(report_text)

        print("\n" + "=" * 72)
        valid_label = "VALID" if self.report.cycle_valid else "INVALID"
        print(f"Cycle: {valid_label} | Committed: {self.report.committed} | Pushed: {self.report.pushed}")
        if cfg.dry_run:
            print("[DRY RUN] No commit or push was made.")
        print(f"Logs: {log.run_dir}")
        print("=" * 72 + "\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    """Run a full repo-city cycle.  Returns exit code."""
    cfg = load_config()
    logger = setup_run_logger(cfg.log_dir_abs)

    cycle = RepoCityCycle(cfg, logger)

    try:
        cycle.step1_preflight()
        cycle.step2_generate_prompt()
        cycle.step3_run_codex()
        cycle.step4_inspect_changes()
        cycle.step5_validation()
        cycle.step6_repair_pass()
        cycle.step7_tracker_acceptance()
        cycle.step8_commit_and_push()
        cycle.step9_report()

        return 0 if cycle.report.cycle_valid else 1

    except RuntimeError as exc:
        logger.error(f"Fatal: {exc}")
        cycle.report.error = str(exc)
        cycle.report.results = f"Fatal error: {exc}"
        try:
            cycle.step9_report()
        except Exception:  # noqa: BLE001
            pass
        return 2

    except Exception as exc:  # noqa: BLE001
        tb = traceback.format_exc()
        logger.error(f"Unexpected error: {exc}\n{tb}")
        cycle.report.error = f"{exc}\n{tb}"
        cycle.report.results = f"Unexpected error: {exc}"
        try:
            cycle.step9_report()
        except Exception:  # noqa: BLE001
            pass
        return 2


# ---------------------------------------------------------------------------
# Fallback prompt builders (used when OpenAI call fails)
# ---------------------------------------------------------------------------


def _build_fallback_prompt(
    phase: str,
    milestone_title: str,
    recommended_slice: str,
    repo_root: str,
) -> str:
    return f"""You are running a repo-city-cycle on the Merge Crimes project.

Current phase: {phase}
Milestone: {milestone_title}
Recommended slice: {recommended_slice}
Repo root: {repo_root}

Steps:
1. Read docs/REPO_CITY_TRACKER.json, docs/REPO_CITY_PRODUCT_VISION.md,
   docs/REPO_CITY_SYSTEM_DESIGN.md, docs/REPO_CITY_ITERATIVE_WORKFLOW.md,
   docs/REPO_CITY_PHASE_EXECUTION_PLAN.md, docs/REPO_CITY_ITERATION_PROMPT.md.
2. Choose the smallest meaningful end-to-end slice in the first incomplete milestone
   that changes at least one file under frontend/, worker/, or shared/.
3. Implement that slice only.
4. Run validation:
   - If frontend/ changed: cd frontend && npm run build
   - If frontend/ materially changed: cd frontend && npm run lint
   - If worker/ or shared/ contracts changed: cd worker && npm run build
5. Update docs/REPO_CITY_TRACKER.json minimally and truthfully.
6. Print exactly these sections at the end:

Phase:
Slice attempted:
Files changed:
Commands run:
Results:
What works now:
What is blocked:
Tracker changes Codex made:
"""


def _build_fallback_repair_prompt(
    phase: str,
    failed_validations: List[str],
    validation_errors: str,
) -> str:
    failed_str = "\n".join(f"  - {v}" for v in failed_validations)
    return f"""A repo-city cycle ran but validations failed.  Fix ONLY the failures.

Phase: {phase}

Failed validations:
{failed_str}

Errors:
{validation_errors[:1000]}

Instructions:
1. Fix only what caused the validation failures above.
2. Do NOT start a new slice or broaden scope.
3. Re-run the same failed validation commands to confirm they pass.
4. Preserve the current truthful tracker state.
5. Print exactly these sections:

Phase:
Slice attempted:
Files changed:
Commands run:
Results:
What works now:
What is blocked:
Tracker changes Codex made:
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_phase_zero(phase: str) -> bool:
    """Return True if *phase* looks like Phase 0."""
    p = str(phase).lower().strip()
    return p in ("0", "phase 0", "phase_0", "phase-0", "phase0") or p.startswith(
        "phase 0"
    )


def _build_commit_message(phase: str, slice_title: str) -> str:
    safe_slice = sanitize_commit_message(slice_title)[:80]
    safe_phase = sanitize_commit_message(str(phase))[:20]
    return f"feat({safe_phase}): {safe_slice}\n\nAuto-committed by repo-city-cycle."


if __name__ == "__main__":
    sys.exit(main())
