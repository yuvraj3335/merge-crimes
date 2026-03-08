# Merge Crimes — Changelog

## 2026-03-07 — Session 6: Checkpoint 5 — Cloudflare Pages + Worker Deploy

### Deployed

- **Wrangler auth** via OAuth (yuvraj@truto.one, account `432df860d4351cf58c0d512bd63ec658`)
- **D1** created: `merge-crimes-db` (`823c401b-1b85-4a86-9498-965a7bab4c8c`) — all 3 migrations applied remotely
- **KV LEADERBOARD** created: `410d8544ed32465eb2a45320de20cc81`
- **KV EVENTS** created: `6049c00ca10240e6a3a04887e3f42348`
- **wrangler.toml** updated with real D1/KV IDs + `new_sqlite_classes` DO migration (free-plan requirement)
- **Secrets set**: `PUBLIC_SESSION_SECRET`, `ADMIN_SEED_SECRET`, `PUBLIC_ORIGIN_ALLOWLIST`
- **Worker deployed**: `https://merge-crimes-api.yuvraj-432.workers.dev` (Current Version: `c8bdd4f3-9c2d-40a0-aeca-efe6603091e3`)
- **Production DB seeded**: 6 districts, 6 factions, 13 missions, 7 events, 5 conflicts
- **Pages project created** and **frontend deployed**: `https://merge-crimes.pages.dev`
- **Frontend built** with `VITE_API_BASE=https://merge-crimes-api.yuvraj-432.workers.dev` baked in

### Smoke Checks Passed
- `GET /api/health` → `{status: ok}`
- `POST /api/session` from Pages origin → signed token
- `POST /api/session` from disallowed origin → `{error: forbidden_origin}` 403
- `GET /api/districts` → 6, `GET /api/missions` → 13
- Mission accept + complete with bearer token → `active` → `completed`, `rewardApplied: true`
- Mission fail (new session) → `available`
- `GET /api/districts/python-heights/room` → `{presenceCount: 0, captureProgress: 0}` (DO working)
- Pages HTTP 200, API URL baked into JS bundle

### Known Issues After Deploy
- KV `X-Cache: MISS` on both leaderboard and events calls — expected free-tier eventual consistency
- Browser E2E on live deployment not yet tested

---

## 2026-03-08 — Session 17: Checkpoint 4 — Waypoint/Timer Reload Persistence (ADR-017)

### Decision
**ADR-017 Hybrid Policy:** persist `currentWaypointIndex` and `completedWaypoints` to `sessionStorage`; do NOT persist the timer (it resets to `mission.timeLimit` on every reload). This means a player who clears two of three waypoints and reloads resumes at waypoint 3 instead of restarting, while they cannot exploit reload to extend their remaining time.

### Code Updates
- **Updated** `frontend/src/store/gameStore.ts` — added three module-level helpers: `saveWaypointState(missionId, index, completed)`, `loadWaypointState(missionId)` (returns null if missionId doesn't match), and `clearWaypointState()`. All use `sessionStorage` with try/catch for environments where it may be unavailable.
- **Updated** `frontend/src/store/gameStore.ts` — `reachWaypoint` mid-mission branch (`nextIndex < waypoints.length`): calls `saveWaypointState` after advancing index and completed list.
- **Updated** `frontend/src/store/gameStore.ts` — `reachWaypoint` boss-entry branch (last waypoint on a boss mission): calls `clearWaypointState` before setting `phase = 'boss'`, so a reload after the boss phase starts correctly restarts the approach.
- **Updated** `frontend/src/store/gameStore.ts` — `completeMission`: calls `clearWaypointState()` before the state reset.
- **Updated** `frontend/src/store/gameStore.ts` — `failMission`: calls `clearWaypointState()` before the state reset.
- **Updated** `frontend/src/store/gameStore.ts` — `loadFromApi`: after finding `restoredActiveMission`, calls `loadWaypointState(restoredActiveMission.id)` and uses the result (if any) for `currentWaypointIndex` and `completedWaypoints` instead of always using `0`/`[]`. Timer still resets to `restoredActiveMission.timeLimit`.

### Documentation Updates
- **Updated** `docs/SESSION_STATE.json` — Checkpoint 4 marked done; Checkpoint 5 (deploy) now marked next; completed list and known_issues updated
- **Updated** `docs/HANDOFF.md` — reflects all 4 local checkpoints done; next action is deploy
- **Updated** `docs/TODO.md` — Checkpoint 4 moved to done; Checkpoint 5 now in Now
- **Updated** `docs/NEXT_PROMPT.md` — next task is Cloudflare Pages/Worker deploy
- **Added** ADR-017 to `docs/DECISIONS.md`

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes (no worker changes)
- **NOT tested:** manual browser tab-reload to confirm waypoint restore works in the actual game
- **NOT tested:** browser smoke harness (does not cover waypoint persistence)
- **NOT tested:** wrangler dev smoke in this session
- **NOT tested:** deployed Cloudflare Pages/Worker environment

---

## 2026-03-08 — Session 16: Checkpoint 3 — Manual Gameplay Code-Review Pass + Top-3 UX Fixes

### Code Updates
- **Updated** `frontend/src/game/MissionTrigger.tsx` — Added `prevIsNearRef` (a `useRef<boolean>`) to convert the mission panel auto-open from a per-frame continuous call into an edge trigger. The panel now only opens when the player *enters* the trigger radius (transition from false→true), not on every `useFrame` tick. Players can now close and keep the panel closed while staying near a trigger.
- **Updated** `frontend/src/ui/Leaderboard.tsx` — Added `activeMission` to the destructured store state and an early-return guard: `phase === 'mission' && !!activeMission`. Prevents the leaderboard panel from rendering simultaneously with the Objective Tracker, which both occupy `left: var(--hud-padding), top: 50%` and would overlap completely.
- **Updated** `frontend/src/store/gameStore.ts` — `resolveBossFight` now reads `activeMission` before the conflict-reward block. The direct `set({ credits: ..+conflict.reward, reputation: ..+25 })` is skipped when `activeMission` is set, because `completeMission` already awards `mission.reward` and `mission.factionReward`. This prevents boss missions from double-rewarding the player (was 1000¢ + 55 rep instead of 500¢ + 30 rep).

### Issues Found (Code Review)
1. **HIGH — MissionTrigger spams panel open every frame:** `setShowMissionPanel(true)` was called inside `useFrame` unconditionally each frame the player was within radius, preventing the player from ever closing the panel while nearby.
2. **MEDIUM — Leaderboard + Objective Tracker overlap:** Both panels had identical CSS position (`left: 16px, top: 50%`). Pressing L during an active mission caused a complete visual overlap.
3. **MEDIUM — Boss fight double reward:** `resolveBossFight` added `conflict.reward` credits in a direct `set()` call AND then called `completeMission` (which adds `mission.reward`). For the React boss mission, this was 500¢ + 500¢ = 1000¢ instead of the intended 500¢.

### Documentation Updates
- **Updated** `docs/SESSION_STATE.json` — Checkpoint 3 marked done; Checkpoint 4 (waypoint persistence) now marked next; completed list, known_issues, and tests updated
- **Updated** `docs/HANDOFF.md` — What Changed, What Is Incomplete, and Next Recommended Action updated for Checkpoint 4
- **Updated** `docs/TODO.md` — Checkpoint 3 moved to done; Checkpoint 4 now in Now section

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes (no worker changes)
- **NOT tested:** manual browser gameplay to confirm any of the three fixes work as expected in the browser
- **NOT tested:** browser smoke harness (does not cover MissionTrigger edge-trigger, leaderboard overlap, or boss reward)
- **NOT tested:** wrangler dev smoke in this session
- **NOT tested:** deployed Cloudflare Pages/Worker environment

---

## 2026-03-08 — Session 15: Checkpoint 2 — Boss Missions Waypoint Entry

### Code Updates
- **Updated** `frontend/src/store/gameStore.ts` — `acceptMission` now always sets `phase = 'mission'` regardless of mission type. Removed the block that immediately set `phase = 'boss'` and `activeConflict` for boss missions.
- **Updated** `frontend/src/store/gameStore.ts` — `reachWaypoint` now branches when the last waypoint is reached: boss missions transition to `phase = 'boss'`, set `activeConflict`, and reset `missionTimer` to `conflict.timeLimit`; regular missions call `completeMission` as before.
- **Updated** `frontend/src/store/gameStore.ts` — `loadFromApi` now restores active boss missions to `phase = 'mission'` with `activeConflict = null` instead of jumping to boss phase on reload.

### Documentation Updates
- **Updated** `docs/SESSION_STATE.json` — Checkpoint 2 marked done; Checkpoint 3 (manual gameplay pass) now marked next; completed list, known_issues, and tests updated
- **Updated** `docs/HANDOFF.md` — What Is Incomplete, What Changed, Next Recommended Action, and Risks updated
- **Updated** `docs/TODO.md` — Checkpoint 2 moved to done; Checkpoint 3 now in Now section
- **Updated** `docs/NEXT_PROMPT.md` — next task is manual local gameplay pass

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes (no worker changes)
- **NOT tested:** manual browser gameplay to confirm approach-then-boss flow works end-to-end in the actual game
- **NOT tested:** browser smoke harness (does not cover boss mission flow)
- **NOT tested:** wrangler dev smoke in this session
- **NOT tested:** deployed Cloudflare Pages/Worker environment

---

## 2026-03-07 — Session 14: Checkpoint 1 — Standalone Territory Capture

### Code Updates
- **Updated** `worker/src/index.ts` — added `WALK_CAPTURE_PER_HEARTBEAT = 2` constant; `DistrictRoom.handleHeartbeat` now also increments district capture by 2 on each presence heartbeat (~10s), enabling walk-up capture without mission completion
- **Updated** `frontend/src/App.tsx` — `DistrictRoomPoller` now runs a second effect: a local capture tick (0.2/s) while in a district and outside menu/boss phase, for smooth bar animation between heartbeat syncs
- **Updated** `frontend/src/ui/CaptureOverlay.tsx` — removed `progress === 0` guard so the overlay shows immediately on district entry; label changed to "Infiltrating Territory"; added a pulsing "Capturing..." status row while progress < 100
- **Updated** `frontend/src/index.css` — added `.capture-status`, `.capture-pulse` (pulse animation), and `.capture-overlay.capturing .capture-fill` shimmer animation

### Documentation Updates
- **Updated** `docs/SESSION_STATE.json` — Checkpoint 1 marked done; Checkpoint 2 (boss entry) now marked next; tests and known_issues updated
- **Updated** `docs/HANDOFF.md` — What Is Incomplete, What Changed, Next Recommended Action, and Risks updated for the new checkpoint state
- **Updated** `docs/TODO.md` — Checkpoint 1 moved to done; Checkpoint 2 now in Now section
- **Updated** `docs/NEXT_PROMPT.md` — next task is boss missions waypoint-style entry

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes
- **NOT tested:** browser smoke harness against walk-up capture tick (existing smoke only covers mission-completion capture)
- **NOT tested:** wrangler dev smoke in this session
- **NOT tested:** manual browser gameplay
- **NOT tested:** deployed Cloudflare Pages/Worker environment

---

## 2026-03-07 — Session 13: Local-First Checkpoint Workflow Reset

### Workflow Updates
- **Updated** `docs/SESSION_STATE.json` — canonical status now uses a local-first checkpoint ladder, marks deployment as the final checkpoint, and sets standalone territory capture as the next task
- **Updated** `docs/HANDOFF.md` — next action now points at the first local gameplay checkpoint instead of Cloudflare deploy work
- **Updated** `docs/TODO.md` — work is now organized as an ordered checkpoint sequence rather than an open-ended next-task list
- **Updated** `docs/NEXT_PROMPT.md` — the reusable prompt now forces each session to finish the highest-priority incomplete local checkpoint or a bounded slice of it
- **Added** ADR for the new local-first checkpoint workflow

### Verification
- `docs/SESSION_STATE.json` structure re-validated after the workflow reset
- **NOT tested:** frontend or worker runtime behavior, because this session only changed the iteration workflow and project docs

---

## 2026-03-07 — Session 12: Mission Replay Score Guardrail

### Code Updates
- **Added** `worker/migrations/0003_mission_reward_claims.sql` — D1 table for global mission reward cooldown claims
- **Updated** `worker/src/index.ts` — mission completion now awards faction score only when the mission's 30-minute cooldown claim succeeds
- **Updated** `worker/src/seed.ts` — reseed clears mission reward cooldown claims
- **Updated** `frontend/src/api.ts` — completion result type now reflects reward-application metadata
- **Updated** `frontend/scripts/browser-smoke.mjs` — healthy flow now verifies that replaying the same mission from a fresh session does not increase faction score during cooldown

### Documentation Updates
- **Updated** `docs/SESSION_STATE.json` — canonical state now reflects the replay-score guardrail and the new next task
- **Updated** `docs/HANDOFF.md`, `docs/TODO.md`, and `docs/NEXT_PROMPT.md` — replay guardrail is done locally; next task shifts to real Cloudflare config and deployed smoke
- **Added** ADR for the global per-mission faction-score cooldown
- **Updated** `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, and `docs/TEST_MATRIX.md` — data model, deploy checklist, and verification status now match the new guardrail

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes
- Frontend `npm run browser:smoke`: passes
  - healthy browser flow: session mint, mission accept, same-tab reload restore, mission complete, mission fail
  - replay guardrail: a fresh session can replay the same mission without increasing faction score during the 30-minute cooldown
  - district heartbeat: verified against `react-district` room state
  - offline mode: seed-mode banner shown when `apiBase` points at an unavailable worker
  - read-only mode: write-session mint fails with 403 from disallowed origin, warning banner shows, mission accepts stay disabled
- **NOT tested:** deployed Cloudflare Pages/Worker environment
- **NOT tested:** manual exploratory browser play beyond the automated smoke path
- **NOT tested:** automated unit/integration coverage

---

## 2026-03-07 — Session 11: Shared Faction Seed Canonicalization

### Code Updates
- **Added** `shared/seed/factions.ts` — canonical faction seed data plus a default leaderboard builder
- **Updated** `frontend/src/store/gameStore.ts` — default factions and local leaderboard bootstrap now come from shared faction seed data
- **Updated** `frontend/src/ui/HUD.tsx` — district faction names now come from shared faction seed data instead of a local constant map
- **Updated** `worker/src/seed.ts` — D1 reseed now uses the shared faction seed source instead of its own divergent copy

### Documentation Updates
- **Updated** `docs/SESSION_STATE.json` — canonical state now reflects the shared faction seed refactor and the new next task
- **Updated** `docs/HANDOFF.md`, `docs/TODO.md`, and `docs/NEXT_PROMPT.md` — faction drift cleanup is done; next task shifts to replay-score guardrails
- **Added** ADR for canonical shared faction seed data
- **Updated** `docs/ARCHITECTURE.md` and `docs/TEST_MATRIX.md` — shared seed structure and latest verification now match the code

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes
- Frontend `npm run browser:smoke`: passes after the shared faction seed refactor
- **NOT tested:** deployed Cloudflare Pages/Worker environment
- **NOT tested:** manual exploratory browser play beyond the automated smoke path
- **NOT tested:** automated unit/integration coverage

---

## 2026-03-07 — Session 10: Automated Browser Smoke + Real Reload Restore

### Code Updates
- **Added** `frontend/src/runtimeConfig.ts` — localhost-only query-param runtime overrides for `apiBase` and smoke mode
- **Added** `frontend/src/localSmokeBridge.ts` — localhost-only bridge exposing safe mission/district helpers for browser automation
- **Updated** `frontend/src/App.tsx` — app now hydrates from the Worker on mount, restoring active missions on same-tab reload without re-entering play
- **Updated** `frontend/src/api.ts` — API base can be overridden locally for smoke verification scenarios
- **Updated** `frontend/src/ui/MainMenu.tsx`, `frontend/src/ui/HUD.tsx`, `frontend/src/ui/MissionPanel.tsx`, and `frontend/src/ui/ConnectionStatusBanner.tsx` — added stable `data-testid` hooks for browser verification
- **Added** `frontend/scripts/browser-smoke.mjs` and `frontend/package.json` script — Playwright browser smoke for healthy, offline, and read-only local flows
- **Updated** `frontend/package-lock.json` — added Playwright dev dependency for the smoke harness

### Documentation Updates
- **Updated** `docs/SESSION_STATE.json` — canonical state now reflects the passing browser smoke run and the new next task
- **Updated** `docs/HANDOFF.md`, `docs/TODO.md`, and `docs/NEXT_PROMPT.md` — browser verification is complete locally; next task shifts to shared faction seed data
- **Added** ADR for the localhost-only browser smoke harness and mount-time restore behavior
- **Updated** `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, and `docs/TEST_MATRIX.md` — local smoke tooling, verification status, and remaining deploy gaps now match the code

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes
- Frontend `npm run browser:smoke`: passes
  - healthy browser flow: session mint, mission accept, same-tab reload restore, mission complete, mission fail
  - district heartbeat: verified against `react-district` room state
  - offline mode: seed-mode banner shown when `apiBase` points at an unavailable worker
  - read-only mode: write-session mint fails with 403 from disallowed origin, warning banner shows, mission accepts stay disabled
- **NOT tested:** deployed Cloudflare Pages/Worker environment
- **NOT tested:** manual exploratory browser play beyond the automated smoke path
- **NOT tested:** automated unit/integration coverage

---

## 2026-03-07 — Session 9: Visible Sync Warnings + Explicit Local Auth Verification

### Code Updates
- **Updated** `frontend/src/api.ts` — added an API runtime-status channel for connection and write-session state, plus write-session retry on 401
- **Added** `frontend/src/ui/ConnectionStatusBanner.tsx` — visible seed-mode and read-only warnings with retry actions
- **Updated** `frontend/src/ui/MissionPanel.tsx` — mission accepts are blocked while worker write access is checking or unavailable
- **Updated** `frontend/src/store/gameStore.ts` — store now tracks API connectivity and write-session state for UI consumption
- **Updated** `frontend/src/App.tsx` — subscribes to runtime status and primes write sessions in any non-menu gameplay phase
- **Updated** `worker/src/index.ts` — explicit `PUBLIC_ORIGIN_ALLOWLIST` now applies under local dev instead of always bypassing localhost
- **Added** `worker/.dev.vars.example` and `worker/.gitignore` — production-style local auth verification path

### Verification
- Frontend `npm run lint`: passes
- Frontend `npm run build`: passes
- Worker `npm run build`: passes
- Local `npx wrangler dev --local --port 8791` smoke with explicit `.dev.vars` auth:
  - allowed-origin `POST /api/session` => 200
  - disallowed-origin `POST /api/session` => 403
  - no-origin `POST /api/session` => 403
  - clean `POST /api/admin/seed` => 200
  - authenticated `POST /api/missions/:id/accept` => 200
- **NOT tested:** live browser gameplay against the new sync-warning UI and production-style auth path
- **NOT tested:** deployed Cloudflare Pages/Worker environment
- **NOT tested:** automated unit/integration coverage

---

## 2026-03-07 — Session 8: Session-Scoped Mission Ownership

### Code Updates
- **Added** `worker/migrations/0002_mission_sessions.sql` — D1 table for anonymous session-scoped mission ownership/status
- **Updated** `worker/src/index.ts` — `GET /api/missions` now accepts `sessionId` and returns session-specific mission status
- **Added** `worker/src/index.ts` — `POST /api/missions/:id/fail` resets the current session's active mission back to available
- **Updated** `worker/src/index.ts` — mission accept/complete now read/write `mission_sessions` instead of mutating mission definitions globally
- **Updated** `worker/src/index.ts` — admin reseed now resets DistrictRoom Durable Object capture/presence state
- **Updated** `worker/src/seed.ts` — reseed clears `mission_sessions`
- **Updated** `frontend/src/api.ts` — browser tab session IDs now persist via `sessionStorage`; mission reads include `sessionId`; fail route client added
- **Updated** `frontend/src/store/gameStore.ts` — active mission state is restored from API on load, and fail now syncs to the worker

### Verification
- Frontend `npm run lint`: 0 errors
- Frontend `npm run build`: passes
- Worker `npm run build`: passes
- Local `npx wrangler d1 migrations apply merge-crimes-db --local`: applied `0002_mission_sessions.sql`
- Local `npx wrangler dev --local --port 8791` smoke verified

---

## 2026-03-07 — Session 7: Public Write Hardening + Local Worker Smoke

### Code Updates
- **Added** `worker/src/index.ts` — `POST /api/session` to mint short-lived signed anonymous write sessions
- **Updated** `worker/src/index.ts` — mission accept/complete and district heartbeat now require an allowed origin plus a valid worker-issued session token
- **Updated** `worker/src/index.ts` — district room routes now check district existence before touching Durable Objects
- **Updated** `worker/src/index.ts` — `POST /api/admin/seed` is now localhost-only unless `X-Admin-Seed-Secret` matches `ADMIN_SEED_SECRET`
- **Removed** `worker/src/index.ts` public `POST /api/districts/:id/room/capture`; mission completion now increments DO capture server-side
- **Updated** `frontend/src/api.ts` — write calls now mint/reuse a public write session and attach `Authorization` + `X-Merge-Session-Id`
- **Updated** `frontend/src/store/gameStore.ts` — removed the separate public capture POST after mission completion

---

## 2026-03-07 — Session 6: Audit Alignment + Reusable AI Iteration Workflow

### Code Updates
- **Fixed** `frontend/src/game/Player.tsx` — removed the impure/unused render-time call that was failing lint
- **Fixed** `frontend/src/game/Player.tsx` — player now clears `currentDistrict` when outside all district bounds
- **Refactored** `frontend/src/ui/MergeConflictGame.tsx` — conflict-local UI state now resets by keyed remount

---

## 2026-03-07 — Session 5: Phase 3 Durable Objects + KV Events Cache
## 2026-03-07 — Session 4: Phase 3 API Wiring + KV Cache
## 2026-03-07 — Session 3: Phase 2 Worker API Complete
## 2026-03-07 — Session 2: Mission Gameplay Polish
## 2026-03-07 — Session 1: Full Phase 0+1 Build
