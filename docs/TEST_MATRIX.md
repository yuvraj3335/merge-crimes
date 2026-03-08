# Merge Crimes — Test Matrix

## Current Verified Checks (2026-03-07)

| Check | Status | Notes |
|---|---|---|
| Frontend lint | ✅ Passed | `cd frontend && npm run lint` after the mission replay score guardrail landed |
| Frontend build | ✅ Passed | `cd frontend && npm run build` after the mission replay score guardrail landed |
| Worker build | ✅ Passed | `cd worker && npm run build` after the mission replay score guardrail landed |
| Local D1 migration apply | ✅ Passed | `cd worker && npx wrangler d1 migrations apply merge-crimes-db --local` applied through `0003_mission_reward_claims.sql` during browser smoke |
| Allowed-origin session mint | ✅ Passed | `POST /api/session` returned 200 with `Origin: http://localhost:5173` under explicit `.dev.vars` config |
| Disallowed-origin session mint | ✅ Passed | `POST /api/session` returned 403 with `Origin: http://evil.example` under explicit `.dev.vars` config |
| No-origin session mint rejection | ✅ Passed | `POST /api/session` returned 403 with no `Origin` header under explicit `.dev.vars` config |
| Clean local reseed | ✅ Passed | `POST /api/admin/seed` returned 200 under `wrangler dev --local` |
| Authenticated mission accept | ✅ Passed | `POST /api/missions/:id/accept` returned 200 with a valid worker-issued bearer token |
| Browser healthy flow | ✅ Passed | `cd frontend && npm run browser:smoke` passes after the replay guardrail landed; verified session mint, mission accept, same-tab reload restore, mission complete, and mission fail |
| Browser replay guardrail | ✅ Passed | Browser smoke completed the same mission from a fresh browser session and verified Chrome Syndicate score stayed flat at `2410` during cooldown |
| Browser district heartbeat | ✅ Passed | Browser smoke set `react-district`, and worker room state showed `presenceCount: 1` |
| Browser capture sync | ✅ Passed | Browser smoke completed a mission and worker room state showed `captureProgress: 25` in `react-district` |
| Browser offline warning | ✅ Passed | Browser smoke loaded the frontend against an unavailable `apiBase` and saw the seed-mode warning state |
| Browser read-only warning | ✅ Passed | Browser smoke loaded from a disallowed origin, saw write-session 403, and verified mission accepts stayed disabled |

## Not Re-Verified In This Session

| Check | Status | Notes |
|---|---|---|
| Manual exploratory browser play | ⬜ Not run | Browser coverage in this session was automated smoke only |
| Boss mission waypoint flow | ⬜ Not run | The smoke harness only covers non-boss mission accept/complete/fail paths |
| Pages + deployed Worker smoke | ⬜ Not run | No Cloudflare deployment exists yet |

## Still Missing

| Area | Status | Notes |
|---|---|---|
| Unit tests | ⬜ Not started | Store restore logic, mission-session helpers, and token guards need coverage |
| Integration tests | ⬜ Not started | Worker route tests are missing |
| End-to-end smoke tests | 🟡 Started | Local `npm run browser:smoke` exists, but deployed and CI-backed browser coverage is still missing |
| CI automation | ⬜ Not started | No automated build/lint/test pipeline |
