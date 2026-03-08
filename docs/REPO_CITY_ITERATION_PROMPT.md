# Repo City Iteration Prompt

Use this prompt for future iterative sessions on the repo-city pivot.

```text
Continue the Merge Crimes repo-city pivot.

---

## STEP 1 — Read the source of truth

Read these files before touching any code:
- docs/REPO_CITY_TRACKER.json
- docs/REPO_CITY_PRODUCT_VISION.md
- docs/REPO_CITY_SYSTEM_DESIGN.md
- docs/REPO_CITY_ITERATIVE_WORKFLOW.md
- docs/REPO_CITY_ITERATION_PROMPT.md

Treat docs/REPO_CITY_TRACKER.json as the authoritative record of what is done.

---

## STEP 2 — Run the phase gate check (MANDATORY before picking a slice)

For the current phase, list every named deliverable.
For each one mark it: DONE | PARTIAL | NOT STARTED.

Then answer this question:

  "Is there any deliverable in this phase that changes real user-visible behavior
   or backend functionality and is NOT done yet?"

If NO → declare the phase DONE in the tracker and move to the next phase.
If YES → that deliverable is your only valid target for this cycle.

DO NOT stay in a phase because there are more things that could be polished.
Declare it done when the core deliverables are complete and move forward.

---

## STEP 3 — Reject invalid slice targets (MANDATORY)

A slice is INVALID and must be skipped if it ONLY changes:
- UI copy, labels, or text strings
- CSS colors, borders, spacing, or visual tone
- docs/REPO_CITY_TRACKER.json metadata with no code change

An invalid slice does NOT count as progress. If the current_slice_recommendation
in the tracker is invalid under this rule, ignore it and find the next real deliverable.

---

## STEP 4 — Pick a valid slice

A valid slice must do at least ONE of the following:
- Add or change a user-visible game mechanic (city generation, navigation, battle, repo selection)
- Add or change backend/worker behavior (auth, ingest, data transformation, caching)
- Add or change a real data contract between frontend and worker
- Fix the smoke/e2e harness so it actually runs

Prefer the slice that unblocks the most downstream work.
Prefer functional changes over presentational ones.
Prefer end-to-end slices over internal-only refactors.

---

## STEP 5 — Handle the smoke blocker (MANDATORY if smoke has been blocked)

If browser:smoke has been reported as "blocked" in the last 3 or more completed slices:
- The smoke blocker IS the mandatory slice for this cycle.
- Fix wrangler.toml, the smoke harness, or the dev-worker startup so smoke can run.
- Do not append "blocked" again and move on. Fix it or formally skip it.

If you cannot fix the blocker in this cycle, document EXACTLY why in the tracker
and mark browser:smoke as "permanently skipped — [reason]" so future cycles stop
trying to run it and reporting it as blocked.

---

## STEP 6 — Implement the chosen slice

Implement it completely. Do not leave it half-done.

Rules:
- Preserve runnability after the slice.
- Do not change unrelated code.
- Do not try to solve the whole pivot in one cycle.
- Prefer metadata-first, read-only GitHub behavior in the MVP.
- Keep the district/mission/conflict abstractions unless they actively block progress.

---

## STEP 7 — Validate

Run the minimum relevant command set for the slice type:

  Shared types only:
    cd frontend && npm run build
    cd worker && npm run build

  Worker/data slice:
    cd worker && npm run build

  Frontend/UI slice:
    cd frontend && npm run lint
    cd frontend && npm run build

  UI flow / selector / full-stack slice:
    cd frontend && npm run lint
    cd frontend && npm run build
    cd frontend && npm run browser:smoke   (unless formally skipped per Step 5)

If any command fails: stop, report the failure, and do not update the tracker
as if the slice passed.

---

## STEP 8 — Update the tracker

Update docs/REPO_CITY_TRACKER.json with:
- The completed slice added to the correct phase's completed_slices array
- The phase status updated to "done" if all core deliverables are now complete
- The next phase status updated to "in_progress" if the current phase just completed
- current_slice_recommendation set to the next VALID slice (functional, not cosmetic)
- last_updated set to the current timestamp

If you are setting current_slice_recommendation, apply the same validity test from
Step 3. Do not recommend a copy-only or CSS-only slice as the next target.

---

## STEP 9 — Output

Respond with exactly these headings and nothing else:

Phase:
Slice attempted:
Files changed:
Commands run:
Validation summary (exit codes and pass/fail for each command):
What works now:
What is blocked:
Next recommended slice (must pass the validity test from Step 3):
Tracker changes made:
```
