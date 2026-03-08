"""OpenAI API client for the review lane.

Used for:
  - Generating review prompts for Codex (review_only mode)
  - Generating fix prompts for Codex (apply_fix mode)
  - Advisory tracker consistency check (same pattern as delivery lane)

NOT used for:
  - Policy enforcement (findings validity, stop decisions)
  - Git state queries
  - Deterministic classification
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from openai import OpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False


# ---------------------------------------------------------------------------
# Context dataclasses
# ---------------------------------------------------------------------------


@dataclass
class ReviewPromptContext:
    """Context for generating a review_only Codex prompt."""
    workstream: str
    scope_description: str
    scope_files_excerpt: str     # first ~40 lines of relevant file paths
    inventory_excerpt: str
    arch_map_excerpt: str
    prior_findings: str
    open_risks: str
    repo_root: str
    tracker_summary: str


@dataclass
class FixPromptContext:
    """Context for generating an apply_fix Codex prompt."""
    finding_id: str
    finding_title: str
    finding_file: str
    finding_description: str
    evidence: str
    recommended_action: str
    severity: str
    repo_root: str
    tracker_summary: str
    edge_cases: str = ""   # formatted edge case list from the original review finding


@dataclass
class ReviewTrackerConsistencyContext:
    """Context for advisory tracker consistency check."""
    original_tracker: str
    tracker_diff: str
    mode: str
    slice_title: str
    new_findings_count: int
    dry_run: bool


@dataclass
class ReviewTrackerConsistencyResult:
    is_consistent: bool
    issues: List[str]
    recommendation: str   # "accept" or "revert"
    reasoning: str


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class ReviewOpenAIClient:
    """Thin OpenAI Responses API wrapper for the review lane."""

    def __init__(
        self,
        api_key: str,
        model: str,
        prompts_dir: str,
        timeout: int = 120,
    ) -> None:
        if not _OPENAI_AVAILABLE:
            raise RuntimeError(
                "openai package is not installed.  Run: pip install openai>=1.50"
            )
        self._client = OpenAI(api_key=api_key, timeout=timeout)
        self._model = model
        self._prompts_dir = prompts_dir
        self._timeout = timeout

    def _load_prompt(self, filename: str) -> str:
        path = os.path.join(self._prompts_dir, filename)
        try:
            return Path(path).read_text(encoding="utf-8")
        except FileNotFoundError:
            raise RuntimeError(f"Review prompt file not found: {path}")

    def _call(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.2,
    ) -> str:
        """Make a single Responses API call and return output text."""
        response = self._client.responses.create(
            model=self._model,
            instructions=system_prompt,
            input=user_message,
        )
        return response.output_text

    # -- Public methods -------------------------------------------------------

    def generate_review_prompt(self, ctx: ReviewPromptContext) -> str:
        """Generate a bounded Codex review prompt for one review slice."""
        system = self._load_prompt("review_system.txt")
        user_template = self._load_prompt("review_user.txt")

        scope_files_text = ctx.scope_files_excerpt or "(see inventory below)"

        user_message = user_template.format(
            workstream=ctx.workstream,
            scope_description=ctx.scope_description,
            scope_files_excerpt=scope_files_text,
            inventory_excerpt=ctx.inventory_excerpt or "(not available)",
            arch_map_excerpt=ctx.arch_map_excerpt or "(not available)",
            prior_findings=ctx.prior_findings or "(none)",
            open_risks=ctx.open_risks or "(none)",
            repo_root=ctx.repo_root,
            tracker_summary=ctx.tracker_summary or "(not available)",
        )
        return self._call(system, user_message, temperature=0.2)

    def generate_fix_prompt(self, ctx: FixPromptContext) -> str:
        """Generate a bounded Codex fix prompt for one finding."""
        system = self._load_prompt("fix_system.txt")
        user_template = self._load_prompt("fix_user.txt")

        user_message = user_template.format(
            finding_id=ctx.finding_id,
            finding_title=ctx.finding_title,
            finding_file=ctx.finding_file,
            finding_description=ctx.finding_description,
            evidence=ctx.evidence,
            recommended_action=ctx.recommended_action,
            severity=ctx.severity,
            repo_root=ctx.repo_root,
            tracker_summary=ctx.tracker_summary or "(not available)",
            edge_cases=ctx.edge_cases or "(none documented)",
        )
        return self._call(system, user_message, temperature=0.2)

    def review_tracker_consistency(
        self, ctx: ReviewTrackerConsistencyContext
    ) -> ReviewTrackerConsistencyResult:
        """Advisory check: are the tracker changes consistent with the cycle?

        This cannot override deterministic policy checks.  It is logged but
        never used to force a revert.
        """
        system = self._load_prompt("review_system.txt")
        user_message = (
            "You are reviewing whether updates to the review tracker are "
            "consistent with what actually happened in this cycle.\n\n"
            f"Mode: {ctx.mode}\n"
            f"Slice: {ctx.slice_title}\n"
            f"New findings added: {ctx.new_findings_count}\n"
            f"Dry run: {ctx.dry_run}\n\n"
            f"Original tracker (excerpt):\n{ctx.original_tracker[:2000]}\n\n"
            f"Diff:\n{ctx.tracker_diff[:1500]}\n\n"
            "Return a JSON object with exactly these fields:\n"
            '{"is_consistent": bool, "issues": [str], "recommendation": "accept"|"revert", "reasoning": str}'
        )
        raw = self._call(system, user_message, temperature=0.1)
        parsed = _parse_json_from_response(raw)
        return ReviewTrackerConsistencyResult(
            is_consistent=bool(parsed.get("is_consistent", True)),
            issues=list(parsed.get("issues", [])),
            recommendation=str(parsed.get("recommendation", "accept")),
            reasoning=str(parsed.get("reasoning", raw[:300])),
        )


# ---------------------------------------------------------------------------
# Fallback prompt builders (used when OpenAI call fails)
# ---------------------------------------------------------------------------


def build_fallback_review_prompt(
    workstream: str,
    scope_description: str,
    repo_root: str,
) -> str:
    """Simple fallback review prompt when OpenAI generation fails."""
    return f"""You are performing a code review for the merge-crimes project.

Workstream: {workstream}
{scope_description}
Repo root: {repo_root}

Instructions:
1. Inspect the files in the target scope listed above.
2. Look for: dead exports, duplicated logic, overly complex functions, unused files,
   architectural issues, and simplification opportunities.
3. For each finding, verify the evidence by reading the actual file.
4. Output a JSON block in exactly this format:

{{"findings": [
  {{
    "file_path": "relative/path/to/file.ts",
    "line": 42,
    "symbol": "functionName",
    "severity": "high|medium|low",
    "confidence": 0.0-1.0,
    "category": "dead_code|duplication|complexity|architecture|other",
    "description": "What the issue is",
    "evidence": "Quoted code or search result proving the issue",
    "recommended_action": "What to do about it"
  }}
]}}

Rules:
- Never claim dead code without showing that 0 references exist.
- Never claim duplication without showing both locations.
- If confidence is below 0.5, do not include the finding.
- Output the JSON block clearly, delimited by ```json ... ```.
"""


def build_fallback_fix_prompt(
    finding_id: str,
    finding_file: str,
    finding_description: str,
    recommended_action: str,
    repo_root: str,
    edge_cases: str = "",
) -> str:
    """Fallback fix prompt when OpenAI generation fails."""
    edge_cases_section = (
        f"\nEDGE CASES TO VERIFY YOUR FIX HANDLES:\n{edge_cases}\n"
        if edge_cases else ""
    )
    return f"""You are fixing a specific issue in the merge-crimes project.
Follow these steps IN ORDER:

STEP 1 — GROUND TRUTH CHECK
Read {finding_file} and every file that imports the affected symbol.
Search for this exact evidence: {finding_description}
Output: BUG_VERIFIED: true  OR  BUG_VERIFIED: false
If BUG_VERIFIED: false — output BUG_NOT_FOUND, mark finding {finding_id} resolved in
docs/REPO_CITY_REVIEW_TRACKER.json, and skip to the output section.

STEP 2 — REASON ABOUT FIX (only if BUG_VERIFIED: true)
Write out: root cause, exact lines to change, what the fix will and won't touch.
Stop and report as blocked if the fix requires more than 3 files.

STEP 3 — PRE-FLIGHT CHECK (only if BUG_VERIFIED: true)
{edge_cases_section}
For each edge case above, confirm your proposed fix handles it correctly.
Check all callers of the affected symbol still work after your change.

STEP 4 — APPLY FIX (only if BUG_VERIFIED: true)
Implement ONLY the fix from STEP 2. No scope creep.

STEP 5 — VALIDATE
  - frontend/ changed: cd frontend && npm run build
  - frontend/ .ts/.tsx changed: also cd frontend && npm run lint
  - worker/ changed: cd worker && npm run build
If validation fails after 3 attempts: revert all changes, output FIX_STATUS: REVERTED.
If validation passes: output FIX_STATUS: APPLIED.

STEP 6 — TRACKER
If APPLIED or BUG_NOT_FOUND: mark finding {finding_id} resolved in
docs/REPO_CITY_REVIEW_TRACKER.json and queue entry qfix-{finding_id} as done.
If REVERTED: leave tracker unchanged.

Finding ID: {finding_id}
File: {finding_file}
Issue: {finding_description}
Action: {recommended_action}
Repo root: {repo_root}

Output these 8 sections at the end:
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


def _parse_json_from_response(text: str) -> Dict[str, Any]:
    """Extract a JSON object from the model response.

    Handles both raw JSON and ```json ... ``` fenced blocks.
    """
    import re
    stripped = text.strip()

    # Try raw parse
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Try fenced block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Safe default
    return {
        "is_consistent": True,
        "issues": ["Could not parse model response as JSON"],
        "recommendation": "accept",
        "reasoning": stripped[:200],
    }
