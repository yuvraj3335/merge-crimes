# Repo-City Review Lane — Execution Plan

## Implementation Stages

### Stage 1 — Core skeleton (COMPLETE)

Created:
- `agent/review_config.py` — ReviewConfig dataclass + load_review_config()
- `agent/review_tracker.py` — Tracker load/validate/snapshot/restore/diff/score/stop-policy
- `agent/review_context.py` — Inventory walk + architecture map + context builders
- `agent/review_findings.py` — Finding parse/validate/dedup/persist + fix queue entry builder
- `agent/review_report.py` — 10-section ReviewCycleReport format + summary JSON
- `agent/review_openai_client.py` — Advisory OpenAI client + fallback prompt builders
- `agent/review_cycle.py` — ReviewCycle orchestrator (both modes)
- `agent/review_loop.py` — Outer loop with auto-mode selection and stall detection
- `repo-city-review-cycle` — Bash entrypoint
- `repo-city-review-loop` — Bash entrypoint
- `agent/review_prompts/review_system.txt` — Codex system prompt for review mode
- `agent/review_prompts/review_user.txt` — Codex user template for review mode
- `agent/review_prompts/fix_system.txt` — Codex system prompt for fix mode
- `agent/review_prompts/fix_user.txt` — Codex user template for fix mode
- `docs/REPO_CITY_REVIEW_TRACKER.json` — Seed tracker with 6 workstreams
- `agent/tests/__init__.py`, `test_review_tracker.py`, `test_review_findings.py`, `test_review_report.py` — 73 unit tests

**Verification:**
```bash
python3 -m unittest discover agent/tests -v
# Expected: 73 tests, 0 failures
```

---

### Stage 2 — First real review run

Run `review_only` mode against the live codebase.

```bash
./repo-city-review-cycle
```

**Expected outcome:**
- Codex reads files in the first workstream scope (dead_code)
- Emits a `{"findings":[...]}` JSON block
- Python parses, validates, stores findings in `docs/review_artifacts/findings.json.dryrun`
- 10-section report printed to stdout
- Tracker updated at `docs/REPO_CITY_REVIEW_TRACKER.json.dryrun`

**If Codex returns no JSON block:**
- Cycle is invalid (mode=review_only requires the JSON block)
- Report shows `PARSE ERROR`
- Review queue entry is NOT marked done → same slice will be retried

---

### Stage 3 — First fix run

After at least one review cycle finds high/medium-severity issues:

```bash
REPO_CITY_REVIEW_MODE=apply_fix ./repo-city-review-cycle
```

**Expected outcome:**
- Python picks highest-scored fix queue entry
- Codex reads the target file, implements the fix
- Validation runs (npm run build / npm run lint as applicable)
- If validation passes: finding marked resolved, fix queue entry marked done
- If validation fails: tracker reverted, finding stays open

**Dry-run note:** Codex runs and modifies files, but no git commit is made.

---

### Stage 4 — Full loop

```bash
REPO_CITY_REVIEW_MAX_CYCLES=12 ./repo-city-review-loop
```

**Expected outcome:**
- Alternates between review_only and apply_fix as queue fills
- Stall guard triggers if no progress for 4 consecutive cycles
- Loop exits 0 on clean completion, 1 on partial/stall

---

### Stage 5 — Live commits (optional)

```bash
REPO_CITY_REVIEW_DRY_RUN=false ./repo-city-review-loop
```

**Expected outcome:**
- Tracker written to `docs/REPO_CITY_REVIEW_TRACKER.json` (live)
- Artifacts written without `.dryrun` suffix
- `apply_fix` cycles commit changes to git
- Set `REPO_CITY_REVIEW_ALLOW_PUSH=true` to also push

---

## Compatibility Checks

Run after any implementation change:

```bash
# 1. Delivery lane unaffected
./repo-city-cycle

# 2. Review tests pass
python3 -m unittest discover agent/tests -v

# 3. Delivery lane logs unchanged
ls agent/logs/

# 4. Review tracker separate from delivery tracker
diff <(python3 -c "import json; d=json.load(open('docs/REPO_CITY_TRACKER.json')); print(list(d.keys()))") \
     <(python3 -c "import json; d=json.load(open('docs/REPO_CITY_REVIEW_TRACKER.json')); print(list(d.keys()))")
```

---

## File Layout

```
merge-crimes/
├── repo-city-review-cycle          ← bash entrypoint
├── repo-city-review-loop           ← bash entrypoint
├── agent/
│   ├── review_config.py
│   ├── review_tracker.py
│   ├── review_context.py
│   ├── review_findings.py
│   ├── review_report.py
│   ├── review_openai_client.py
│   ├── review_cycle.py
│   ├── review_loop.py
│   ├── review_prompts/
│   │   ├── review_system.txt
│   │   ├── review_user.txt
│   │   ├── fix_system.txt
│   │   └── fix_user.txt
│   ├── review_logs/                ← created at runtime
│   └── tests/
│       ├── __init__.py
│       ├── test_review_tracker.py
│       ├── test_review_findings.py
│       └── test_review_report.py
└── docs/
    ├── REPO_CITY_REVIEW_TRACKER.json
    ├── REPO_CITY_REVIEW_WORKFLOW.md
    ├── REPO_CITY_REVIEW_EXECUTION_PLAN.md
    ├── REPO_CITY_REVIEW_PROMPT.md
    └── review_artifacts/           ← created at runtime
        ├── inventory.json(.dryrun)
        ├── architecture_map.json(.dryrun)
        ├── findings.json(.dryrun)
        ├── removal_candidates.json(.dryrun)
        ├── decisions.json
        ├── summary.json
        └── final_report.txt
```
