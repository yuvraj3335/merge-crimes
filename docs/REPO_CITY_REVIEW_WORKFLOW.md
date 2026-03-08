# Repo-City Review Lane — Workflow Guide

## Overview

The review lane is a separate, autonomous campaign that runs alongside (but never touches) the delivery lane. It has two Codex-driven modes:

- **`review_only`** — Codex inspects a scope and emits structured JSON findings.
- **`apply_fix`** — Codex implements the fix for the highest-scored finding; Python validates.

The outer loop (`repo-city-review-loop`) auto-selects between modes each cycle.

---

## Quick Start

```bash
# One review cycle (dry-run, no commits)
./repo-city-review-cycle

# One fix cycle (dry-run, no commits)
REPO_CITY_REVIEW_MODE=apply_fix ./repo-city-review-cycle

# Full loop (auto-selects modes, runs until complete or stalled)
./repo-city-review-loop

# Full loop with live commits/pushes
REPO_CITY_REVIEW_DRY_RUN=false ./repo-city-review-loop
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REPO_CITY_REVIEW_MODE` | `review_only` | `review_only` or `apply_fix` (auto in loop) |
| `REPO_CITY_REVIEW_DRY_RUN` | `true` | `false` to commit and push fixes |
| `REPO_CITY_REVIEW_MAX_CYCLES` | `80` | Loop cycle cap |
| `REPO_CITY_REVIEW_CYCLE_DELAY` | `10` | Seconds between cycles |
| `REPO_CITY_REVIEW_MAX_STALLED` | `4` | Stall guard: consecutive no-progress cycles |
| `REPO_CITY_REVIEW_STOP_SCORE_BELOW` | `10.0` | Stop if top queue score drops below this |
| `OPENAI_API_KEY` | (required) | Shared with delivery lane |
| `REPO_CITY_OPENAI_MODEL` | `gpt-4.1` | Shared with delivery lane |
| `REPO_CITY_CODEX_BIN` | `codex` | Shared with delivery lane |

---

## Full Loop Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     repo-city-review-loop                           │
│                                                                     │
│  Cycle 1 → auto-select mode → review_only                          │
│    └─ Codex inspects scope → emits JSON findings                    │
│    └─ Python parses, validates, deduplicates findings               │
│    └─ High/medium findings → fix queue entries added                │
│    └─ Tracker updated, artifacts written                            │
│                                                                     │
│  Cycle 2 → queue has fix entries with score > 1.0 → apply_fix      │
│    └─ Python picks best finding from fix queue                      │
│    └─ Codex implements the fix                                      │
│    └─ Python validates (build, lint)                                │
│    └─ Finding marked resolved (or reverted if validation fails)     │
│    └─ Tracker updated                                               │
│                                                                     │
│  Cycle 3 → more review slices pending → review_only → ...          │
│                                                                     │
│  Loop stops when:                                                   │
│    - All queue entries are done                                      │
│    - Max cycles reached                                             │
│    - Score threshold or stall guard fires                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Queue Model

Each entry in the tracker `queue` list has a `mode` field:

- **`"mode": "review"`** — Codex inspects a workstream scope. Added at campaign start.
- **`"mode": "fix"`** — Codex fixes one finding. Added automatically when a review cycle finds a high or medium-severity issue.

### Scoring

Review entries are scored:
```
score = 3.0 * severity_density
      + 1.5 * recency_norm      (higher = not run recently)
      + 2.0 * coverage_gap      (higher = scope not yet inventoried)
      + 1.0 * starvation_weight (higher = workstream has fewer prior cycles)
```

Fix entries are scored:
```
score = severity_bonus * confidence
# severity_bonus: high=3.0, medium=2.0, low=1.0
# confidence: from the original finding (0..1)
```

Priority overrides: `"urgent"` doubles the score; `"deprioritize"` halves it.

---

## Stop Conditions

The loop stops at the **first** matching condition (checked every cycle):

1. `cycles_run >= max_cycles`
2. Campaign state is `"complete"` or `"stopped"`
3. No pending queue entries remain
4. Top queue score < `stop_on_score_below` (default 10.0)
5. Open findings < `stop_on_findings_below` (default 3) AND sufficient workstream coverage
6. `consecutive_no_new_findings >= max_consecutive_no_findings` (default 3)

---

## Workstreams

Six workstreams are pre-seeded in the tracker:

| Priority | ID | Scope | Focus |
|---|---|---|---|
| 1 | `dead_code` | frontend/src, shared, worker/src | Exports/functions never imported or called |
| 2 | `duplication` | frontend/src, shared, worker/src | Duplicated logic to extract |
| 3 | `complexity` | frontend/src, worker/src | Overly complex functions |
| 4 | `unused_exports` | frontend/src, shared | Module exports with no consumers |
| 5 | `architecture` | full codebase | Wrong-direction imports, tight coupling |
| 6 | `hardening` | full codebase | Security, correctness, regression risk (deferred) |

---

## Artifacts

All artifacts are written to `docs/review_artifacts/`:

| File | Description |
|---|---|
| `inventory.json` | Walk of all source files (size, lines, type) |
| `architecture_map.json` | Import edges and layer classification |
| `findings.json` | All findings from all review cycles |
| `removal_candidates.json` | Findings suitable for immediate removal |
| `decisions.json` | Human-editable decisions (keep/defer/remove) |
| `summary.json` | Last cycle's machine-readable summary |
| `final_report.txt` | Last cycle's 10-section text report |

In dry-run mode (default), files are written with a `.dryrun` suffix instead of overwriting live files.

---

## Dry-Run vs Live Mode

**Default: `REPO_CITY_REVIEW_DRY_RUN=true`**
- Codex runs normally (reads and writes files)
- All Python-managed artifacts use `.dryrun` shadow copies
- The review tracker is updated at `REPO_CITY_REVIEW_TRACKER.json.dryrun`
- No git commits or pushes

**Live mode: `REPO_CITY_REVIEW_DRY_RUN=false`**
- Artifacts written to live files
- `apply_fix` cycles commit changes (when `REPO_CITY_REVIEW_ALLOW_PUSH=true`, also push)
- Tracker updated in place

---

## Manual Decisions

To mark a finding as `keep` (don't fix) or `defer` (fix later), edit:
```
docs/review_artifacts/decisions.json
```

Format:
```json
{
  "decisions": [
    {"finding_id": "f-000001", "verdict": "keep", "rationale": "Intentional design"},
    {"finding_id": "f-000002", "verdict": "defer", "rationale": "Needs larger refactor"}
  ]
}
```

Findings with `keep` or `defer` verdicts are excluded from `removal_candidates.json`.

---

## Compatibility

The review lane **never** reads or writes:
- `docs/REPO_CITY_TRACKER.json` (delivery tracker)
- `agent/logs/` (delivery logs)

The delivery lane (`repo-city-cycle`, `repo-city-loop`) is unaffected.
