# Merge Crimes — Reusable Iteration Prompt

Use this prompt for the next session:

```text
Continue the Merge Crimes project.

Before making changes:
1. Read these files first:
   - /docs/HANDOFF.md
   - /docs/SESSION_STATE.json
   - /docs/TODO.md
   - /docs/DECISIONS.md
   - /docs/CHANGELOG.md
   - /docs/ARCHITECTURE.md
   - /docs/NEXT_PROMPT.md

2. Treat /docs/SESSION_STATE.json as the source of truth if any docs disagree.

3. Summarize:
   - current phase
   - what is already working
   - what is incomplete
   - the current checkpoint
   - the next checkpoint after that

4. From `docs/SESSION_STATE.json`, find `checkpoint_plan` and pick the first incomplete local checkpoint.

5. Implement that checkpoint end-to-end. If the checkpoint is too large for one session, implement the smallest shippable slice of it instead, and update the checkpoint status/docs to reflect exactly what remains.

Rules:
- Make real code changes, not just plans
- Local gameplay progress first
- Do not switch to deployment, Cloudflare env wiring, or other later checkpoints while an earlier local checkpoint is still incomplete, unless the user explicitly reprioritizes
- Complete one checkpoint at a time; avoid sideways hardening work that does not move the current checkpoint forward
- Keep Cloudflare free-tier constraints in mind
- Public mode first
- Keep heavy simulation client-side
- Update all required docs after changes
- Be explicit about what was tested vs not tested
- Do not claim deployment-ready status unless the relevant build/lint/test/deploy checks actually passed
- End by updating /docs/NEXT_PROMPT.md with the best next follow-up prompt

Output at the end must include:
- which checkpoint was completed or advanced
- which checkpoint is next
- what changed
- which files changed
- what was tested
- what was not tested
- remaining risks
```

## Current Highest-Value Task

**Checkpoint 5: Cloudflare Pages/Worker deploy plus deployed smoke.**

All four local checkpoints are complete. The project is ready for its first real deployment.

### What Needs To Happen

1. **Create real Cloudflare KV namespaces** for `LEADERBOARD` and `EVENTS`, then update `wrangler.toml` with the real namespace IDs (replace the local placeholder IDs)
2. **Set Worker secrets:**
   - `PUBLIC_SESSION_SECRET` — a strong random string (e.g., `openssl rand -hex 32`)
   - `PUBLIC_ORIGIN_ALLOWLIST` — the deployed Cloudflare Pages URL (added after Pages is deployed)
   - `ADMIN_SEED_SECRET` — optional but recommended for non-local reseeding
3. **Apply D1 migrations** on the production database:
   ```bash
   npx wrangler d1 migrations apply merge-crimes-db --remote
   ```
4. **Deploy the Worker:**
   ```bash
   cd worker && npx wrangler deploy
   ```
5. **Seed production data:**
   ```bash
   curl -X POST https://<worker-url>/api/admin/seed \
     -H "X-Admin-Seed-Secret: <ADMIN_SEED_SECRET>"
   ```
6. **Deploy Cloudflare Pages** with `VITE_API_BASE=https://<worker-url>` set in the Pages environment variables
7. **Run deployed smoke:** session mint, mission accept, mission complete, mission fail, leaderboard, events, district heartbeat
8. Only claim deployment success if all smoke checks pass

### Key Files To Know
- `worker/wrangler.toml` — KV namespace IDs to update
- `worker/.dev.vars.example` — shows which secrets are needed
- `worker/src/index.ts` — Worker routes
- `frontend/src/api.ts` — `VITE_API_BASE` env var consumed here

### Why This Is Next
All four local checkpoints are done:
1. ✓ Territory capture standalone walk-up
2. ✓ Boss missions waypoint-style entry
3. ✓ Manual gameplay pass + top-3 UX fixes
4. ✓ Waypoint/timer reload persistence

The game is feature-complete at the MVP scope. Deployment is the only remaining checkpoint in the ladder.

### Reminders
- Do NOT claim deployment-ready status until the deployed smoke actually passes
- Keep `SESSION_STATE.json` canonical
- Production env wiring is intentionally deferred to this checkpoint; do not skip the smoke step
