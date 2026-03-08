# Repo-City Review Lane — Prompt Design

## Overview

Both modes use two-part prompts: a **system prompt** (static rules) and a **user template** (dynamic context injected per-cycle). The prompts live in `agent/review_prompts/`.

---

## Review Mode Prompts

### `review_system.txt` — Rules for Codex as code analyst

Key rules enforced:
1. Output exactly one `{"findings":[...]}` JSON block (or `{"findings":[]}` if clean).
2. Never claim a symbol is dead without showing grep evidence of zero references.
3. Never claim duplication without showing both locations with quoted code.
4. `file_path` must be a real file — no invented paths.
5. Drop findings with `confidence < 0.5`.
6. Maximum 15 findings per cycle (prioritise by severity × confidence).

### `review_user.txt` — Context template for review cycles

Variables injected:

| Variable | Source | Content |
|---|---|---|
| `{workstream}` | Queue entry | e.g. `dead_code` |
| `{scope_description}` | ReviewContext | Human-readable scope description |
| `{scope_files_excerpt}` | ReviewContext.scope_files | First 40 file paths in scope |
| `{inventory_excerpt}` | inventory.json | Top 50 lines of inventory summary |
| `{arch_map_excerpt}` | architecture_map.json | Import edges for target files |
| `{prior_findings}` | Tracker findings | JSON of last 5 findings in this workstream |
| `{open_risks}` | Tracker known_risks | Known risk notes |
| `{tracker_summary}` | summarize_review_tracker() | Compact campaign status |
| `{repo_root}` | ReviewConfig | Absolute path to repo root |

### Required Codex output format

```json
{"findings": [
  {
    "file_path": "frontend/src/utils/foo.ts",
    "line": 42,
    "symbol": "buildSignalMapping",
    "severity": "high",
    "confidence": 0.95,
    "category": "dead_code",
    "description": "buildSignalMapping is exported but never imported anywhere in the codebase.",
    "evidence": "grep -r 'buildSignalMapping' frontend/src shared → 0 results outside the declaring file",
    "recommended_action": "Delete buildSignalMapping from frontend/src/utils/foo.ts (lines 42–67)"
  }
]}
```

**Cycle validity rule:** If this block is absent or malformed, the cycle is INVALID.
The review queue entry is NOT marked done and will be retried next cycle.

---

## Fix Mode Prompts

### `fix_system.txt` — Rules for Codex as hardening implementer

Key rules enforced:
1. Fix ONLY what the finding describes — no scope expansion.
2. Read the target file before modifying it.
3. Verify the issue still exists (it may have been fixed already).
4. Run required validation commands after the fix.
5. Update `docs/REPO_CITY_REVIEW_TRACKER.json` to mark the finding resolved.
6. If fix would touch more than 3 files, stop and report as blocked.

### `fix_user.txt` — Context template for fix cycles

Variables injected:

| Variable | Source | Content |
|---|---|---|
| `{finding_id}` | Fix queue entry | e.g. `f-000001` |
| `{finding_title}` | Fix queue entry | Short title |
| `{finding_file}` | Finding.file_path | Relative path to fix |
| `{finding_description}` | Finding.description | What the issue is |
| `{evidence}` | Finding.evidence | Quoted proof from review cycle |
| `{recommended_action}` | Finding.recommended_action | Exact action to take |
| `{severity}` | Finding.severity | high / medium / low |
| `{tracker_summary}` | summarize_review_tracker() | Compact campaign status |
| `{repo_root}` | ReviewConfig | Absolute path to repo root |

### Required Codex output format (8 sections)

Fix mode reuses the delivery lane's 8-section output format so that
`report.parse_codex_report_sections()` works unchanged:

```
Phase:
Slice attempted:
Files changed:
Commands run:
Results:
What works now:
What is blocked:
Tracker changes Codex made:
```

---

## Evidence Quality Requirements

Evidence is the most critical field. Python's `validate_finding()` drops any finding where `evidence` is empty. Codex is instructed to include:

| Category | Required evidence |
|---|---|
| `dead_code` | Grep result showing zero references outside the declaring file |
| `duplication` | Quoted code from both duplicate locations |
| `complexity` | The relevant function body (or excerpt) |
| `architecture` | The import chain proving the violation |
| `unused_exports` | Grep result showing no external consumers |
| All others | Quoted code or search result proving the issue |

---

## Prompt Generation

Python (not a template engine) generates prompts via:
- `ReviewOpenAIClient.generate_review_prompt(ctx)` — calls OpenAI to produce a richer, context-aware prompt
- `ReviewOpenAIClient.generate_fix_prompt(ctx)` — same for fix mode
- `build_fallback_review_prompt()` / `build_fallback_fix_prompt()` — used when OpenAI call fails

The OpenAI call uses `review_system.txt` as the system prompt and a consistency check template as the user message. The result is then passed as the prompt to Codex CLI.

---

## Prompt Files

```
agent/review_prompts/
├── review_system.txt   ← system prompt for review_only mode
├── review_user.txt     ← user template for review_only mode
├── fix_system.txt      ← system prompt for apply_fix mode
└── fix_user.txt        ← user template for apply_fix mode
```

All four files are loaded at runtime and never hard-coded in Python.
Editing them changes Codex behaviour without any code changes.
