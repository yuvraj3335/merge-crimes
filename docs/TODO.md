# Merge Crimes — TODO

## Checkpoint Order
1. Territory capture: standalone walk-up mechanic ✓
2. Boss missions: waypoint-style entry before boss phase ✓
3. Manual local gameplay pass and top-3 user-visible fixes ✓
4. Waypoint/timer reload persistence decision and implementation ✓
5. Cloudflare Pages + Workers deploy and deployed smoke ✓ **COMPLETE**

## Deployed
- **Game:** https://merge-crimes.pages.dev
- **Worker:** https://merge-crimes-api.yuvraj-432.workers.dev

## Now (post-deploy)
- [ ] Browser E2E on live deployment (full mission in browser on pages.dev)
- [x] KV HIT verification — ✅ confirmed 2026-03-08 (fixed kv.put to use ctx.waitUntil; both leaderboard and events return X-Cache: HIT)

## Later
- [ ] GitHub cache integration pipeline (KV + scheduled Worker)
- [ ] Daily event generation from cached GitHub signals
- [ ] GitHub OAuth login
- [ ] Personal storyline / profile
- [ ] Bundle code-splitting / scene lazy-loading
- [ ] Performance optimization + LOD for districts
- [ ] Sound effects / ambient audio
- [ ] WebSocket real-time updates (upgrade from polling)
- [ ] Automated tests and CI
- [ ] Browser smoke coverage for boss approach, walk-up capture, Checkpoint 3 UX fixes, Checkpoint 4 waypoint persistence

## Done (this session)
- [x] Checkpoint 3: code-review gameplay pass — three user-visible bugs found and fixed
  - Fix 1: MissionTrigger edge trigger — panel only auto-opens on district entry, not every frame
  - Fix 2: Leaderboard hidden during active missions — prevents overlap with Objective Tracker
  - Fix 3: resolveBossFight double reward — conflict.reward now skipped when activeMission is set
  - Frontend lint/build and worker build pass after all three fixes
- [x] Checkpoint 4: waypoint/timer reload persistence (ADR-017 Hybrid Policy)
  - saveWaypointState, loadWaypointState, clearWaypointState helpers added to gameStore.ts
  - reachWaypoint saves index + completed waypoints to sessionStorage on each mid-mission advance
  - loadFromApi restores persisted waypoint state when active mission is found
  - completeMission, failMission, boss-phase entry clear persisted state
  - Timer is NOT persisted — always resets to mission.timeLimit on reload
  - Frontend lint/build and worker build pass

## Done (previous sessions — this checkpoint ladder)
- [x] Checkpoint 2: boss missions now require waypoint approach
- [x] Checkpoint 1: standalone territory capture

## Done (previous sessions — code)
- [x] Added D1 `mission_reward_claims` and a cheap global 30-minute faction-score cooldown per mission
- [x] Shared faction seed data in `shared/seed/factions.ts`
- [x] Playwright `npm run browser:smoke` harness
- [x] Mount-time API hydration for same-tab mission restore
- [x] Visible sync/write-access warnings (ConnectionStatusBanner)
- [x] Anonymous public write sessions with origin enforcement
- [x] Session-scoped mission ownership via D1 mission_sessions
- [x] DistrictRoom Durable Object presence + capture
- [x] KV cache-aside for leaderboard + events
- [x] Worker API with D1 schema and seed route
- [x] Frontend vertical slice, mission loop, boss minigame
