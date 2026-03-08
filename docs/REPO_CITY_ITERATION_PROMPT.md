# Repo City Iteration Prompt

Use this prompt for future iterative sessions on the repo-city pivot.

```text
Continue the Merge Crimes repo-city pivot.

Before making changes:
1. Read:
   - /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_TRACKER.json
   - /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_PRODUCT_VISION.md
   - /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_SYSTEM_DESIGN.md
   - /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_ITERATIVE_WORKFLOW.md
   - /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_ITERATION_PROMPT.md

2. Treat `docs/REPO_CITY_TRACKER.json` as the source of truth for the pivot.

3. Summarize:
   - current milestone
   - current recommended slice
   - major open questions
   - major risks

4. Pick the smallest meaningful end-to-end slice inside the first incomplete milestone.

5. Implement that slice fully.

Rules:
- Do not try to solve the whole pivot in one session.
- Prefer metadata-first, read-only GitHub behavior in the MVP.
- Preserve runnability after every slice.
- Keep the district/mission/conflict abstractions if they still fit.
- Favor a clean translation layer over big visual work with no data foundation.
- After Phase 0, docs-only cycles do NOT count as progress.
- Every cycle after Phase 0 must change at least one non-doc file under `frontend/`, `worker/`, or `shared/`.
- Every cycle after Phase 0 must include a dry run / validation command.
- If frontend code changes, run `npm run build` in `frontend` at minimum.
- If worker or shared contracts change, run `npm run build` in `worker` too.
- If UI flow/test selectors change, run `npm run browser:smoke` or clearly explain why you could not.
- If lint/build/smoke fails, do not hide it. Report the failure and the exact blocker.
- Be explicit about what was tested and what was not.

Output at the end must include:
- milestone advanced
- slice completed
- files changed
- commands run
- results of each command
- open risks
- exact update needed for `docs/REPO_CITY_TRACKER.json`
```
