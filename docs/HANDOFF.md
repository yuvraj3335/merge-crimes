# Merge Crimes — Handoff

## Current Status

**Phase:** DEPLOYED. All checkpoints complete.

**Live URLs:**
- **Game:** https://merge-crimes.pages.dev
- **Worker API:** https://merge-crimes-api.yuvraj-432.workers.dev

## What Works (Local + Deployed)

- Main menu with title screen and start flow
- 3D city scene with 6 districts, roads, lights, holograms, minimap, and HUD
- Player movement: WASD/arrow keys, facing, sprint, boundary clamping
- Mission loop: mission list, waypoint objectives, tracker, timer, direction arrow, reward toast, capture progress
- Boss minigame with code-hunk selection flow and countdown timer
- Worker API with D1-backed districts, missions, leaderboard, events, conflicts, and admin seed route
- KV cache-aside for leaderboard + events
- DistrictRoom Durable Object for per-district presence and shared capture progress (walk-up capture: 2pts/heartbeat)
- Standalone territory capture: client-side 0.2/s tick + DO heartbeat sync
- Anonymous public write sessions issued by the Worker, enforced on mission POST routes
- Mission ownership/status is session-scoped via D1 `mission_sessions`
- Frontend session IDs and waypoint state persist across reloads within the same browser tab
- Frontend restores an active mission AND waypoint progress on same-tab reload
- Frontend shows visible sync/write-access warnings with retry actions
- Mission accepts are blocked in the UI when worker write access is still checking or unavailable
- Faction seed data is canonical in `shared/seed/factions.ts`
- Mission faction score rewards guarded by 30-minute global cooldown per mission
- Boss missions start in 'mission' phase (waypoint approach before boss phase)
- Checkpoint 3 UX fixes (MissionTrigger edge, Leaderboard overlap, Boss double-reward)
- Checkpoint 4 waypoint persistence (sessionStorage hybrid, timer resets on reload)

## Deployment Status

| Resource | Status |
|---|---|
| Cloudflare Pages | ✅ Live at https://merge-crimes.pages.dev |
| Worker API | ✅ Live at https://merge-crimes-api.yuvraj-432.workers.dev |
| D1 Database | ✅ Created + 3 migrations applied + seeded |
| LEADERBOARD KV | ✅ Bound (ID: `410d8544ed32465eb2a45320de20cc81`) |
| EVENTS KV | ✅ Bound (ID: `6049c00ca10240e6a3a04887e3f42348`) |
| DistrictRoom DO | ✅ Deployed with `new_sqlite_classes` migration |
| PUBLIC_SESSION_SECRET | ✅ Set |
| ADMIN_SEED_SECRET | ✅ Set |
| PUBLIC_ORIGIN_ALLOWLIST | ✅ Set (Pages origin) |

## What Was Smoke-Tested (Deployed)

✅ Health, session mint + origin enforcement, mission accept, mission complete, mission fail, district room GET, districts (6), missions (13), Pages HTTP 200, API URL baked into bundle

⚠️ KV X-Cache: MISS on both calls — expected eventual consistency on free tier

## What Is Not Yet Tested

- Browser E2E against live deployment (full mission in browser on pages.dev)
- District Room heartbeat write path (needs browser with valid session)
- Faction score cooldown on deployed instance
- KV HIT (needs minutes for free-tier propagation)
- GitHub cache pipeline, OAuth, automated CI

## Next Recommended Actions

1. **Open https://merge-crimes.pages.dev** in a browser and complete a full mission
2. **KV HIT verification**: wait 5-10 min then `curl -sv https://merge-crimes-api.yuvraj-432.workers.dev/api/leaderboard 2>&1 | grep x-cache`
3. **Next features**: GitHub cache pipeline, OAuth, performance optimization

## Commands For Re-Deployment

```bash
# Re-deploy Worker (from worker/)
npx wrangler deploy

# Re-deploy Pages (from frontend/)
VITE_API_BASE=https://merge-crimes-api.yuvraj-432.workers.dev npm run build
npx wrangler pages deploy dist --project-name merge-crimes --commit-dirty=true

# Local dev
npx wrangler dev    # worker/
npm run dev         # frontend/
```
