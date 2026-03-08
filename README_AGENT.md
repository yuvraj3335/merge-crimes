# repo-city-cycle — Agent Setup & Usage Guide

`repo-city-cycle` is a local autonomous project runner for the Merge Crimes
repo-city pivot.  It orchestrates the Codex CLI agent and uses the OpenAI API
for planning, repair, and review support.

**Architecture summary:**
- **Codex** is the implementation agent — it writes code and updates the tracker.
- **repo-city-cycle** is the governance layer — it validates, accepts or reverts
  tracker changes, commits, and pushes.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.10+ |
| Git | any recent version |
| Node.js | 18+ (for frontend/worker builds) |
| Codex CLI | latest |
| `openai` Python package | 1.50+ |

---

## 1 — Install Codex CLI

```bash
npm install -g @openai/codex
```

Verify:

```bash
codex --version
```

---

## 2 — Authenticate Codex

Codex uses your OpenAI API key.  Set it in your shell or `.env` (see step 4).

```bash
export OPENAI_API_KEY=sk-...
```

Codex will pick it up automatically.

---

## 3 — Install Python dependencies

From the repo root:

```bash
pip install openai>=1.50
```

That is the only required package.  Everything else uses the Python standard
library.

---

## 4 — Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Minimum required:

```bash
OPENAI_API_KEY=sk-...
```

All other variables have sensible defaults.  Common overrides:

| Variable | Default | Purpose |
|----------|---------|---------|
| `REPO_CITY_CODEX_BIN` | `codex` | Path to Codex binary if not on PATH |
| `REPO_CITY_OPENAI_MODEL` | `gpt-4.1` | OpenAI model for planning/review |
| `REPO_CITY_DRY_RUN` | `false` | Skip commit/push (see below) |
| `REPO_CITY_ALLOW_PUSH_MAIN` | `true` | Push directly to main |
| `REPO_CITY_SKIP_GIT_PULL` | `false` | Skip `git pull --rebase` before cycle |
| `REPO_CITY_ENABLE_REPAIR_PASS` | `true` | Allow one repair attempt on failure |
| `REPO_CITY_MAX_REPAIR_ATTEMPTS` | `1` | How many repair attempts to allow |
| `REPO_CITY_LOG_DIR` | `agent/logs` | Where to save cycle logs |

The `.env` file is git-ignored.  Never commit it.

---

## 5 — Make the entrypoint executable (first time only)

```bash
chmod +x repo-city-cycle
```

---

## 6 — Run a cycle

```bash
./repo-city-cycle
```

That's it.  The wrapper will:

1. Load config and verify the repo.
2. Read all six repo-city docs.
3. Call OpenAI to generate a precise, bounded Codex prompt.
4. Invoke Codex in `--full-auto` mode.
5. Inspect what changed.
6. Run required validation commands (`npm run build`, `npm run lint`, etc.).
7. Optionally run a repair pass if validations fail.
8. Accept or revert `docs/REPO_CITY_TRACKER.json` changes.
9. Commit and push to `origin/main` (if valid and not dry-run).
10. Print the final eight-section report.

---

## Dry-run mode

Set `REPO_CITY_DRY_RUN=true` (in `.env` or shell) to run the entire cycle —
including Codex, validations, and report — without committing or pushing:

```bash
REPO_CITY_DRY_RUN=true ./repo-city-cycle
```

Dry-run is useful for:
- Testing the wrapper setup before a real cycle.
- Reviewing what Codex would commit before it lands on `main`.

All steps run; the summary will say `Committed: False` and
`[DRY RUN] No commit or push was made.`

---

## Direct push-to-main mode

When `REPO_CITY_ALLOW_PUSH_MAIN=true` (the default) and `REPO_CITY_DRY_RUN=false`,
the wrapper pushes directly to `origin/main` after a valid cycle.

A clear warning is printed before every push:

```
[WARNING] REPO_CITY_ALLOW_PUSH_MAIN=true — this tool WILL push directly to
origin/main after a valid cycle.
```

To disable push but still commit locally:

```bash
REPO_CITY_ALLOW_PUSH_MAIN=false ./repo-city-cycle
```

---

## Tracker acceptance and reversion

`docs/REPO_CITY_TRACKER.json` is the source of truth.  Codex may edit it.
The wrapper decides whether to keep or revert those edits.

**Tracker changes are REVERTED if:**

- The cycle is invalid (docs-only after Phase 0, or no eligible file changed).
- Any required validation command failed.
- No validation commands ran when they were required.

**Tracker changes are ACCEPTED if:**

- The cycle is valid.
- All required validations passed.

An optional OpenAI review is run as an advisory check.  It can flag potential
overstatements but cannot override a deterministic "accept" decision.

When the tracker is reverted, the report will say:

```
Tracker changes Codex made:
REVERTED — <reason>
```

---

## Log files

Each cycle creates a timestamped directory under `agent/logs/`:

```
agent/logs/
  20260308T120000Z/
    cycle.log              — structured log of all steps
    cycle_prompt.txt       — prompt sent to Codex
    codex_stdout.txt       — full Codex output
    codex_stderr.txt       — Codex stderr
    repair_1_stdout.txt    — repair pass output (if any)
    repair_1_prompt.txt    — repair prompt (if any)
    validation_*.txt       — output of each validation command
    final_report.txt       — the printed eight-section report
    summary.json           — machine-readable cycle summary
```

`agent/logs/` is git-ignored by default.  Add a line to `.gitignore` if needed:

```
agent/logs/
```

---

## JSON-only report mode

Set `REPO_CITY_JSON_ONLY_REPORT=true` to emit a JSON object to stdout instead of
the human-readable report.  Useful for scripting:

```bash
REPO_CITY_JSON_ONLY_REPORT=true ./repo-city-cycle | jq .cycle_valid
```

---

## Skipping git pull

By default the wrapper runs `git pull --rebase origin main` before invoking
Codex.  To skip this (e.g. when working offline or when you've just pulled):

```bash
REPO_CITY_SKIP_GIT_PULL=true ./repo-city-cycle
```

---

## Troubleshooting

**`ERROR: OPENAI_API_KEY is not set`**
→ Export it or add it to `.env`.

**`Codex binary not found`**
→ Install with `npm install -g @openai/codex` or set `REPO_CITY_CODEX_BIN`
to the full path of the binary.

**`openai package is not installed`**
→ Run `pip install openai>=1.50`.

**`Not a git repository`**
→ Run the tool from inside the merge-crimes repo or set `REPO_CITY_REPO_ROOT`.

**`Working tree has uncommitted changes`**
→ Stash or commit your changes before running a cycle.  The wrapper won't
overwrite in-progress work.

**`Docs-only cycle after Phase 0`**
→ Codex only touched `docs/`.  The wrapper requires at least one file change
under `frontend/`, `worker/`, or `shared/` after Phase 0.

---

## Architecture overview

```
repo-city-cycle (shell)
  └── python -m agent.repo_city_cycle
        ├── config.py          — env var loading + validation
        ├── tracker.py         — tracker JSON queries + snapshot/restore
        ├── openai_client.py   — Responses API: prompt gen, repair, review
        ├── codex_runner.py    — subprocess wrapper for Codex CLI
        ├── validator.py       — change classification + validation commands
        ├── git_ops.py         — git subprocess helpers
        ├── report.py          — eight-section report formatter
        ├── logging_utils.py   — per-run log directories + secret masking
        └── prompts/
              cycle_system.txt
              cycle_user.txt
              repair_user.txt
              tracker_review_user.txt
```
