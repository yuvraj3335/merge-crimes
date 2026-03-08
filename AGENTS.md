# AGENTS.md — Merge Crimes Repo-City Workflow

This file encodes the standing rules for all AI agents (Codex, Claude, etc.) working on
this repository.  The `repo-city-cycle` wrapper reads and enforces these rules
automatically; agents must understand and follow them.

---

## Role division

| Role | Tool | Responsibility |
|------|------|----------------|
| **Implementation agent** | Codex CLI | Write code, update tracker, run local commands |
| **Governance layer** | repo-city-cycle wrapper | Validate, accept/revert tracker, commit, push |

Codex does the work.  The wrapper governs whether the work is accepted.

---

## Before every cycle — mandatory reads

Read all six repo-city docs **in order** before choosing a slice:

1. `docs/REPO_CITY_TRACKER.json` — source of truth for phase, milestones, slices
2. `docs/REPO_CITY_PRODUCT_VISION.md`
3. `docs/REPO_CITY_SYSTEM_DESIGN.md`
4. `docs/REPO_CITY_ITERATIVE_WORKFLOW.md`
5. `docs/REPO_CITY_PHASE_EXECUTION_PLAN.md`
6. `docs/REPO_CITY_ITERATION_PROMPT.md`

The tracker is the canonical source of truth.  If the tracker and any other doc disagree,
the tracker wins.

---

## Slice selection rules

1. Choose the **smallest meaningful end-to-end slice** inside the first incomplete milestone.
2. "Meaningful" = at least one non-doc file changes under `frontend/`, `worker/`, or `shared/`.
3. **After Phase 0, docs-only cycles do not count** and will be rejected by the wrapper.
4. Every post-Phase-0 cycle **must** change at least one file outside `docs/`.
5. Do not start multiple slices in one cycle.
6. Do not attempt Phase N+1 work while Phase N milestones are incomplete.

---

## Validation rules

After making changes, run the required validation commands.  The wrapper will also run
them; running them yourself first catches failures earlier.

| Condition | Required command |
|-----------|-----------------|
| Any file under `frontend/` changed | `cd frontend && npm run build` |
| Material frontend change (`.ts` `.tsx` `.js` `.jsx` `.css` `.scss` `.html`) | `cd frontend && npm run lint` |
| UI flow or selectors changed | `cd frontend && npm run browser:smoke` *(unless clearly blocked)* |
| Any file under `worker/` or `shared/` changed (contracts) | `cd worker && npm run build` |

**Material frontend change**: any `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss`, or `.html`
file under `frontend/`.

**UI flow / selectors changed**: any file under `frontend/src`, `frontend/app`,
`frontend/components`, Playwright configs, or test selector files.

**Worker / shared contracts changed**: any `.ts`, `.tsx`, `.js`, `.json`, `.schema`,
`.yaml`, `.yml` file under `worker/` or `shared/`, or any file whose name contains
`contract`, `schema`, `types`, or `api`.

**Every cycle must run at least one validation command.**  A cycle with no validations
will be rejected.

---

## Tracker rules

- Codex **may** update `docs/REPO_CITY_TRACKER.json`.
- Tracker edits must be **minimal and truthful**.
- **Do not claim milestone completion if validations fail.**
- Do not advance the phase counter without completing all milestones in the current phase.
- The wrapper is the final authority on whether tracker changes are accepted or reverted.

---

## Required output format

Every cycle must print a final report containing **exactly** these eight section titles
(verbatim, followed by a colon and a newline) and no additional top-level headings:

```
Phase:
<current phase identifier>

Slice attempted:
<what you tried to implement>

Files changed:
<list each changed file, one per line>

Commands run:
<list each command with its outcome>

Results:
<what succeeded, what failed>

What works now:
<current working state of the app after this cycle>

What is blocked:
<what is blocked or needs follow-up>

Tracker changes Codex made:
<exactly what changed in docs/REPO_CITY_TRACKER.json, or "none">
```

The wrapper parses this format.  Deviating from it will produce malformed logs.

---

## Anti-patterns — do not do these

- Do not touch only `docs/` after Phase 0.
- Do not claim tracker completion before validations pass.
- Do not skip validation commands.
- Do not make breaking changes without confirming the app still builds.
- Do not broaden scope mid-cycle (repair passes must fix only what broke).
- Do not add speculative features not requested by the current slice.
