# AGENTS.md

## Workflow
- Read `docs/REPO_CITY_TRACKER.json` before making changes.
- Read the current repo-city docs referenced by the tracker before making changes.
- Treat `docs/REPO_CITY_TRACKER.json` as the source of truth for the pivot.
- Summarize the current milestone, current recommended slice, major open questions, and major risks.
- Pick the smallest meaningful end-to-end slice inside the first incomplete milestone.
- Keep changes bounded to one slice.

## Progress Rules
- After Phase 0, docs-only cycles do not count as progress.
- Every cycle must change at least one non-doc file under `frontend/`, `worker/`, or `shared/`.
- Preserve runnability after every slice.
- Prefer metadata-first, read-only GitHub behavior in the MVP.
- Favor the translation layer over large visual rewrites with no data foundation.

## Validation Rules
- Every cycle must run at least one validation command.
- If `frontend/` changes, run `cd frontend && npm run build` at minimum.
- If `frontend/` changes materially, run `cd frontend && npm run lint`.
- If UI flow or selectors change, run `cd frontend && npm run browser:smoke` unless clearly blocked.
- If `worker/` changes, or if `shared/` contracts change, run `cd worker && npm run build`.
- If validation fails, report the failure honestly and include the blocker.

## Repo Hygiene
- Do not commit `node_modules/`, build artifacts, secrets, or local env files.
- Do not edit files under `frontend/dist/` or dependency trees under `node_modules/`.

## Required Final Output
- Phase
- Slice attempted
- Files changed
- Commands run
- Results
- What works now
- What is blocked
- Tracker changes Codex made
