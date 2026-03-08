# Merge Crimes — Architecture

## System Overview

```
Browser (Client)
  React + R3F scene
  Zustand game state
  Mount-time API hydration
  Seed-data fallback
  sessionStorage-backed anonymous session ID
  Anonymous write-session cache
          |
          | HTTP polling / protected writes
          v
Cloudflare Worker (Hono)
  Routes + validation + session checks + mission-session joins + cache logic
   |           |            |
   v           v            v
   D1          KV           Durable Object
```

## Current Frontend Structure

```
frontend/src/
├── App.tsx
├── api.ts
├── localSmokeBridge.ts
├── runtimeConfig.ts
├── game/
│   ├── Camera.tsx
│   ├── CityScene.tsx
│   ├── District.tsx
│   ├── MissionTrigger.tsx
│   ├── Player.tsx
│   └── Waypoint.tsx
├── store/
│   └── gameStore.ts
├── ui/
│   ├── CaptureOverlay.tsx
│   ├── CityBulletin.tsx
│   ├── ConnectionStatusBanner.tsx
│   ├── HUD.tsx
│   ├── Leaderboard.tsx
│   ├── MainMenu.tsx
│   ├── MergeConflictGame.tsx
│   ├── MissionObjectiveTracker.tsx
│   ├── MissionPanel.tsx
│   └── RewardToast.tsx
└── index.css

frontend/scripts/
└── browser-smoke.mjs

shared/seed/
├── districts.ts
├── events.ts
├── factions.ts
├── conflicts.ts
└── missions.ts
```

## Current Worker Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/session` | Mint short-lived anonymous write session |
| GET | `/api/city` | City summary |
| GET | `/api/districts` | District list |
| GET | `/api/districts/:id` | District detail |
| GET | `/api/districts/:id/room` | District DO state |
| POST | `/api/districts/:id/room/heartbeat` | Presence heartbeat |
| GET | `/api/missions` | Mission list, with optional `sessionId` for session-scoped status |
| POST | `/api/missions/:id/accept` | Accept mission |
| POST | `/api/missions/:id/complete` | Complete mission |
| POST | `/api/missions/:id/fail` | Release current session's active mission |
| GET | `/api/leaderboard` | Faction leaderboard |
| GET | `/api/events` | City bulletin |
| GET | `/api/conflicts` | Merge conflict encounters |
| POST | `/api/admin/seed` | Local/dev reseed route, or secret-gated override |

## Data Model

| Table | Current Use |
|---|---|
| `districts` | District metadata, layout, controlling faction |
| `missions` | Mission definitions and default/base availability |
| `mission_sessions` | Session-scoped mission ownership/status for anonymous public mode |
| `mission_reward_claims` | Global faction-score cooldown claims for replay guardrails |
| `factions` | Leaderboard scores |
| `events` | Bulletin entries |
| `merge_conflicts` | Boss/conflict content |
| `players` | Planned only; not wired into runtime |

## Cloudflare Bindings

| Binding | Current Role |
|---|---|
| `DB` | D1 primary persistence |
| `LEADERBOARD` | KV cache for leaderboard |
| `EVENTS` | KV cache for event feed |
| `DISTRICT_ROOM` | Durable Object for district presence/capture |

## Worker Env Vars / Secrets

| Name | Current Role |
|---|---|
| `PUBLIC_ORIGIN_ALLOWLIST` | Comma-separated allowed browser origins for minting/using write sessions outside local dev |
| `PUBLIC_SESSION_SECRET` | HMAC secret for worker-issued anonymous write sessions |
| `ADMIN_SEED_SECRET` | Optional override for non-local admin reseeding |

## Architecture Strengths
- Clean top-level separation between frontend, worker, and shared contracts
- Heavy simulation remains client-side
- Shared seed/types keep offline and API modes conceptually aligned
- Faction seed data is now canonical in `shared/seed/factions.ts`, eliminating frontend/worker drift
- Cloudflare-native services fit the intended free-tier deployment target
- Public read routes stay simple while write routes now have a lightweight anonymous trust boundary
- Mission ownership is isolated per anonymous session without requiring full auth or server-side simulation
- Faction-score farming is now reduced by a cheap D1-backed per-mission cooldown rather than a heavier identity system
- Capture progress is now derived from mission completion on the worker instead of a separate public mutation
- Runtime degradation is now visible in the UI instead of being hidden behind console-only fallback
- Local browser verification is now repeatable through a localhost-only smoke harness instead of one-off manual steps

## Current Architecture Risks
- `frontend/src/store/gameStore.ts` is doing gameplay, UI, reward, capture, and API orchestration in one store
- Most React components subscribe to the whole Zustand store instead of selectors, which increases rerender cost during movement
- `worker/src/index.ts` is a monolithic router + DO file
- Production writes depend on correct `PUBLIC_SESSION_SECRET` and `PUBLIC_ORIGIN_ALLOWLIST` configuration
- Mission waypoint/timer progress is still client-only; reload restores mission ownership but restarts progression
- Fresh anonymous sessions can still replay missions and influence local progression/capture; the new faction-score cooldown is only a first guardrail
- The smoke bridge is intentionally localhost-only and query-param gated; keep it that way to avoid leaking debug controls into public mode
- Local browser smoke passed, but deployed Pages/Worker behavior still is not verified

## Runtime Constraints
- Public mode first
- Keep heavy simulation client-side
- No server-side per-frame simulation
- Cloudflare free-tier constraints must remain viable
- No deploy claim until write paths are hardened and verified
