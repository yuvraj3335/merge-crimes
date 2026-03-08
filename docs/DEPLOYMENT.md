# Merge Crimes — Deployment Guide

## Current Status

**DEPLOYED.** 🚀

- **Worker:** https://merge-crimes-api.yuvraj-432.workers.dev
- **Pages:** https://merge-crimes.pages.dev
- **Deployed:** 2026-03-07 (Session 6)

## Deployed Resource IDs

| Resource | ID / URL |
|---|---|
| Cloudflare Account | `432df860d4351cf58c0d512bd63ec658` |
| D1 Database | `823c401b-1b85-4a86-9498-965a7bab4c8c` (merge-crimes-db) |
| LEADERBOARD KV | `410d8544ed32465eb2a45320de20cc81` |
| EVENTS KV | `6049c00ca10240e6a3a04887e3f42348` |
| Worker URL | `https://merge-crimes-api.yuvraj-432.workers.dev` |
| Pages project | `merge-crimes` → `https://merge-crimes.pages.dev` |

## Deployed Smoke Test Results (2026-03-07)

| Check | Result | Notes |
|---|---|---|
| `GET /api/health` | ✅ PASS | `{status: ok, version: 0.2.0}` |
| `POST /api/session` from Pages origin | ✅ PASS | Returns signed 6h token |
| `POST /api/session` from disallowed origin | ✅ PASS | `{error: forbidden_origin}` |
| `GET /api/districts` | ✅ PASS | 6 districts |
| `GET /api/missions` | ✅ PASS | 13 missions |
| `POST /api/missions/:id/accept` (with valid token) | ✅ PASS | `status=active` |
| `POST /api/missions/:id/complete` (with valid token) | ✅ PASS | `status=completed, rewardApplied=true` |
| `POST /api/missions/:id/fail` (new session) | ✅ PASS | `status=available` |
| `GET /api/districts/:id/room` | ✅ PASS | `{presenceCount: 0, captureProgress: 0}` |
| Pages site HTTP 200 | ✅ PASS | Serving correct JS bundle |
| API URL baked into bundle | ✅ PASS | `merge-crimes-api.yuvraj-432.workers.dev` in JS |
| `POST /api/admin/seed` without secret | ✅ PASS | Blocked (not localhost) |
| Leaderboard/Events KV X-Cache | ✅ PASS | HIT/HIT confirmed 2026-03-08 after fixing kv.put to use ctx.waitUntil() |

### What Was NOT Smoke-Tested
- Browser E2E (full mission accept → complete → reward flow in real browser)
- District Room heartbeat write path (requires browser session with valid token)
- Waypoint persistence on same-tab reload in production
- Faction score cooldown replay prevention (browser smoke only, not deployed)
- KV HIT behavior (eventually consistent; both leaderboard and events returned MISS on both calls during smoke — propagation lag expected)

## Secrets Set On Worker

```
PUBLIC_SESSION_SECRET   — generated via `openssl rand -hex 32`
ADMIN_SEED_SECRET       — generated via `openssl rand -hex 16`
PUBLIC_ORIGIN_ALLOWLIST — https://merge-crimes.pages.dev,https://ed7d6d02.merge-crimes.pages.dev
```

**Store these secrets somewhere safe.** They are not in the codebase or `.dev.vars`.

## Re-Deployment Instructions

### Re-deploy Worker after code change:
```bash
cd worker
npx wrangler deploy
```

### Re-deploy Pages after frontend change:
```bash
cd frontend
VITE_API_BASE=https://merge-crimes-api.yuvraj-432.workers.dev npm run build
npx wrangler pages deploy dist --project-name merge-crimes --commit-dirty=true
```

### Re-seed production DB (requires ADMIN_SEED_SECRET):
```bash
curl -X POST https://merge-crimes-api.yuvraj-432.workers.dev/api/admin/seed \
  -H "X-Admin-Seed-Secret: <ADMIN_SEED_SECRET>"
```

### Apply new D1 migrations to production:
```bash
cd worker
npx wrangler d1 migrations apply merge-crimes-db --remote
```

## Pre-Deploy Checklist (all complete)

- [x] Secure `POST /api/admin/seed` outside local development
- [x] Validate district heartbeat payloads and district IDs
- [x] Minimal trust boundary for public write routes (signed session tokens)
- [x] Session-scoped mission ownership via D1 `mission_sessions`
- [x] Cheap replay guardrail for faction-score farming (30-min cooldown)
- [x] Visible frontend handling for API/write-session unavailability
- [x] `PUBLIC_SESSION_SECRET` configured on deployed Worker ✅
- [x] `PUBLIC_ORIGIN_ALLOWLIST` configured with Pages origin(s) ✅
- [x] D1 migrations applied to remote DB (all 3) ✅
- [x] Production DB seeded ✅
- [x] Frontend built with real `VITE_API_BASE` ✅
- [x] Deployed smoke tests passing ✅

## Production-Style Local Development

```bash
cd worker
cp .dev.vars.example .dev.vars
# Edit .dev.vars to add real secrets for production-style local testing

npx wrangler dev --local --port 8787
```

Or use the Playwright browser smoke harness (applies local migrations, starts services):
```bash
cd frontend
npm run browser:smoke
```

## DO Migration Note

The wrangler.toml uses `new_sqlite_classes` (not `new_classes`) for the Durable Object migration.
This is required for Cloudflare's free plan. The DO API (`state.storage.get/put`) works identically.

## Known Deployment Traps

- `VITE_API_BASE` must be set at **build time** — it is baked into the Vite bundle. Re-build if the Worker URL changes.
- `PUBLIC_ORIGIN_ALLOWLIST` must include ALL Pages deployment URLs (both permanent `merge-crimes.pages.dev` and preview hashes like `ed7d6d02.merge-crimes.pages.dev`).
- KV cache on free tier is eventually consistent; `X-Cache: MISS` on both calls during smoke is expected for newly created namespaces.
- DO `new_sqlite_classes` migration is required on free plan; `new_classes` will fail with code 10097.
- After `npx wrangler d1 migrations apply --remote`, local wrangler dev still uses `.wrangler/state/v3/d1/` (separate local DB). Run `npx wrangler d1 migrations apply` (without `--remote`) to also keep local DB in sync.
