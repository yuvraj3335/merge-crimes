"""OpenAI API client for repo-city-cycle.

Uses the OpenAI Responses API (client.responses.create) for:
  - Generating bounded cycle prompts for Codex
  - Generating focused repair prompts
  - Reviewing tracker consistency (assist — not override — deterministic checks)
  - Summarising cycle results

NOT used for:
  - Policy enforcement (pass/fail)
  - File diff truth
  - Git state queries
  - Command execution decisions
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Optional dependency guard
# ---------------------------------------------------------------------------

try:
    import openai
    from openai import OpenAI
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False


# ---------------------------------------------------------------------------
# Context dataclasses
# ---------------------------------------------------------------------------


@dataclass
class CycleContext:
    phase: str
    milestone_title: str
    milestone_description: str
    recommended_slice: str
    repo_root: str
    tracker_summary: str
    open_risks: str
    # Doc contents (will be injected into prompt)
    doc_contents: Dict[str, str]


@dataclass
class RepairContext:
    phase: str
    slice_attempted: str
    changed_files: List[str]
    failed_validations: List[str]
    validation_errors: str


@dataclass
class TrackerReviewContext:
    original_tracker: str
    tracker_diff: str
    phase: str
    slice_attempted: str
    files_changed: List[str]
    validations_passed: bool
    validation_commands: List[str]


@dataclass
class TrackerReviewResult:
    is_consistent: bool
    issues: List[str]
    recommendation: str   # "accept" or "revert"
    reasoning: str


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class OpenAIClient:
    """Thin wrapper around the OpenAI Responses API for cycle support."""

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

    # -- Prompt loading -------------------------------------------------------

    def _load_prompt(self, filename: str) -> str:
        path = os.path.join(self._prompts_dir, filename)
        try:
            return Path(path).read_text(encoding="utf-8")
        except FileNotFoundError:
            raise RuntimeError(f"Prompt file not found: {path}")

    # -- API call wrapper ----------------------------------------------------

    def _call(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.3,
    ) -> str:
        """Make a single Responses API call and return output text."""
        response = self._client.responses.create(
            model=self._model,
            instructions=system_prompt,
            input=user_message,
        )
        # Responses API: response.output_text is the convenience accessor
        return response.output_text

    # -- Public methods -------------------------------------------------------

    def generate_cycle_prompt(self, ctx: CycleContext) -> str:
        """Generate a bounded Codex implementation prompt for the current cycle."""
        system = self._load_prompt("cycle_system.txt")

        # Build doc excerpts (trim to keep prompt manageable)
        doc_excerpts = _format_doc_excerpts(ctx.doc_contents)

        user_template = self._load_prompt("cycle_user.txt")
        user_message = user_template.format(
            phase=ctx.phase,
            milestone_title=ctx.milestone_title,
            milestone_description=ctx.milestone_description,
            recommended_slice=ctx.recommended_slice,
            repo_root=ctx.repo_root,
            tracker_summary=ctx.tracker_summary,
            open_risks=ctx.open_risks or "(none noted)",
            doc_excerpts=doc_excerpts,
        )

        return self._call(system, user_message, temperature=0.2)

    def generate_repair_prompt(self, ctx: RepairContext) -> str:
        """Generate a focused repair prompt for a failed cycle."""
        system = self._load_prompt("cycle_system.txt")

        repair_template = self._load_prompt("repair_user.txt")
        user_message = repair_template.format(
            phase=ctx.phase,
            slice_attempted=ctx.slice_attempted,
            changed_files="\n".join(f"  {f}" for f in ctx.changed_files) or "  (none)",
            failed_validations="\n".join(
                f"  {v}" for v in ctx.failed_validations
            ) or "  (none)",
            validation_errors=ctx.validation_errors or "(no error output captured)",
        )

        return self._call(system, user_message, temperature=0.2)

    def review_tracker_consistency(self, ctx: TrackerReviewContext) -> TrackerReviewResult:
        """Ask the model whether tracker changes are consistent with the cycle.

        This is advisory only.  The deterministic checks in validator.py
        take precedence.  A positive review here cannot override a failed
        validation.
        """
        system = self._load_prompt("cycle_system.txt")

        review_template = self._load_prompt("tracker_review_user.txt")
        user_message = review_template.format(
            original_tracker=ctx.original_tracker[:3000],
            diff=ctx.tracker_diff[:2000],
            phase=ctx.phase,
            slice_attempted=ctx.slice_attempted,
            files_changed="\n".join(f"  {f}" for f in ctx.files_changed) or "  (none)",
            validations_passed=str(ctx.validations_passed),
            validation_commands="\n".join(
                f"  {c}" for c in ctx.validation_commands
            ) or "  (none)",
        )

        raw = self._call(system, user_message, temperature=0.1)

        # Parse JSON from the response (model is instructed to return JSON)
        parsed = _parse_json_from_response(raw)
        return TrackerReviewResult(
            is_consistent=bool(parsed.get("is_consistent", False)),
            issues=list(parsed.get("issues", [])),
            recommendation=str(parsed.get("recommendation", "revert")),
            reasoning=str(parsed.get("reasoning", raw[:500])),
        )

    def summarize_results(self, context: Dict[str, Any]) -> str:
        """Generate a human-readable summary of the cycle results."""
        system = self._load_prompt("cycle_system.txt")
        user_message = (
            "Summarise the following repo-city cycle results in 3-5 sentences "
            "suitable for a developer log.  Be factual and concise.\n\n"
            + json.dumps(context, indent=2, default=str)[:4000]
        )
        return self._call(system, user_message, temperature=0.3)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _format_doc_excerpts(doc_contents: Dict[str, str], max_chars_each: int = 800) -> str:
    """Format doc contents for injection into the prompt."""
    parts = []
    for name, content in doc_contents.items():
        excerpt = content[:max_chars_each]
        if len(content) > max_chars_each:
            excerpt += f"\n... [{len(content) - max_chars_each} chars truncated]"
        parts.append(f"=== {name} ===\n{excerpt}")
    return "\n\n".join(parts)


def _parse_json_from_response(text: str) -> Dict[str, Any]:
    """Extract a JSON object from the model response.

    The model may wrap JSON in markdown fences.  This handles both cases.
    """
    # Try raw parse first
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Try to extract from ```json ... ``` block
    import re
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Return a safe default
    return {
        "is_consistent": False,
        "issues": ["Could not parse model response as JSON"],
        "recommendation": "revert",
        "reasoning": stripped[:200],
    }
