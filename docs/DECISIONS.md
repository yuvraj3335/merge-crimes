# Merge Crimes — Architecture Decision Records

## ADR-001: Vite + React + TypeScript + Three.js Frontend Stack

**Date:** 2026-03-07
**Decision:** Use Vite + React + TypeScript with Three.js via React Three Fiber (R3F).
**Reason:** Vite provides fast HMR for dev iteration. R3F gives declarative scene management with React integration. TypeScript ensures type safety across shared contracts.
**Alternatives:** Raw Three.js, Phaser, Unity WebGL.
**Impact:** Rapid frontend iteration with a relatively simple toolchain.

## ADR-002: Zustand for Client State

**Date:** 2026-03-07
**Decision:** Use Zustand for client-side game state management.
**Reason:** Minimal boilerplate, TS-friendly, and compatible with R3F render loops.
**Alternatives:** Redux, Jotai, React Context.
**Impact:** Fast MVP delivery. As the game grows, selector-based subscriptions and store slicing are required to avoid broad rerenders.

## ADR-003: Top-Down Isometric Camera

**Date:** 2026-03-07
**Decision:** Use a fixed top-down/isometric camera for MVP.
**Reason:** Simpler controls, lower scope, stronger map readability.
**Alternatives:** Third-person, free camera.
**Impact:** Faster to ship; gameplay readability stays high.

## ADR-004: npm Package Manager

**Date:** 2026-03-07
**Decision:** Use npm.
**Reason:** Lowest setup overhead and already compatible with the scaffold.
**Alternatives:** pnpm, yarn.
**Impact:** Simple local setup.

## ADR-005: Flat Repo Structure (No Monorepo Tooling)

**Date:** 2026-03-07
**Decision:** Keep `/frontend`, `/worker`, and `/shared` without Turborepo/Nx.
**Reason:** Current repo size does not justify heavier monorepo tooling.
**Alternatives:** Turborepo, Nx, npm workspaces.
**Impact:** Simpler structure today; revisit if shared code and automation expand.

## ADR-006: Seed Data First, GitHub Integration Later

**Date:** 2026-03-07
**Decision:** Start with hardcoded seed data for districts, missions, events, and conflict puzzles.
**Reason:** Keeps the game playable offline and avoids external API complexity in the MVP.
**Alternatives:** Early GitHub integration or API stubs.
**Impact:** Faster gameplay iteration; live GitHub signals remain a later phase.

## ADR-007: Pre-Deploy Hardening Before Cloudflare Launch

**Date:** 2026-03-07
**Decision:** Do not prioritize deployment ahead of write-route hardening.
**Reason:** The current Worker exposes public mutating routes, including a destructive seed route. Shipping before hardening would create avoidable trust and integrity problems.
**Alternatives:** Deploy first and harden later.
**Impact:** Deployment is intentionally deferred until the Worker is safe enough for public mode.

## ADR-008: SESSION_STATE.json Is The Canonical Project Status File

**Date:** 2026-03-07
**Decision:** Treat `docs/SESSION_STATE.json` as the source of truth for current phase, next task, risks, and verification status.
**Reason:** The repo uses multiple handoff docs; without a canonical status file they drift quickly.
**Alternatives:** Keep multiple equal-status narrative docs.
**Impact:** Future AI iterations should update `SESSION_STATE.json` first, then reconcile `HANDOFF`, `TODO`, and `NEXT_PROMPT`.

## ADR-009: Anonymous Signed Write Sessions For Public Mode

**Date:** 2026-03-07
**Decision:** Require worker-issued, short-lived signed session tokens for public write routes and restrict session minting by origin.
**Reason:** The project is still public-mode-first and does not have user accounts yet, but deploying unauthenticated write routes was too permissive. Signed anonymous sessions add a cheap trust boundary that fits Cloudflare free-tier constraints.
**Alternatives:** Leave writes public, add full auth now, or depend on a third-party challenge flow before stabilizing the core game loop.
**Impact:** Reads remain public, writes now depend on `PUBLIC_SESSION_SECRET` and `PUBLIC_ORIGIN_ALLOWLIST`, and the frontend must mint/reuse a write session before protected POSTs.

## ADR-010: Remove Standalone Public Capture Writes

**Date:** 2026-03-07
**Decision:** Remove the public district capture POST route and derive shared capture advancement from mission completion on the worker.
**Reason:** Public capture increments were too easy to abuse independently of mission flow, and capture progress can be inferred from an already-protected mission completion event.
**Alternatives:** Keep the route public with tighter validation, or build a fuller anti-cheat layer before reducing the route surface.
**Impact:** The public API surface is smaller, shared capture stays synced through the worker, and future walk-up capture work can be designed separately instead of inheriting the old open-ended write path.

## ADR-011: Session-Scoped Mission Ownership Via D1 Join Table

**Date:** 2026-03-07
**Decision:** Store mutable mission ownership/state in a `mission_sessions` D1 table keyed by the anonymous session ID instead of mutating the mission definition row globally.
**Reason:** Global mission rows caused public players to contend over the same accept/complete state. A small join table keeps mission definitions reusable, isolates state per anonymous session, and stays cheap enough for Cloudflare free-tier usage.
**Alternatives:** Keep global mission state, overload the `players` table before account identity exists, or move all mission progression into Durable Objects.
**Impact:** `GET /api/missions` can now return session-scoped status, writes are isolated per session, reloads can restore mission ownership for the same browser tab session, and the remaining persistence gap is limited to waypoint/timer progress rather than mission ownership itself.

## ADR-012: Surface Public-Mode API And Write Availability In The UI

**Date:** 2026-03-07
**Decision:** Expose API connectivity and write-session state in the frontend UI, and block protected mission accepts until write access is ready.
**Reason:** Silent fallback to seed mode and console-only write failures made public-mode verification too ambiguous. The app needed to show when it was online, in local fallback, or effectively read-only.
**Alternatives:** Keep failures in console logs only, allow accepts before write access is ready, or defer all UX handling until a full auth system exists.
**Impact:** The frontend now shows retryable seed-mode/read-only warnings, mission accepts wait for worker write access, and local browser verification can distinguish backend availability problems from gameplay bugs.

## ADR-013: Add A Localhost-Only Browser Smoke Harness

**Date:** 2026-03-07
**Decision:** Add a localhost-only runtime API override, smoke bridge, and Playwright browser smoke command, and hydrate from the Worker on app mount so same-tab mission restore is actually testable.
**Reason:** Browser verification became the main deployment blocker, and the first automated pass exposed that reload restore did not happen until the player manually re-entered play. A repeatable harness was needed without shipping public debug controls.
**Alternatives:** Keep manual browser-only verification, rely on canvas/keyboard interaction in automation, or defer reload-restore fixes until after deployment.
**Impact:** `npm run browser:smoke` now verifies healthy, offline, and read-only local flows; active missions restore automatically on same-tab reload; and the debug surface stays gated to localhost with `smoke=1`.

## ADR-014: Canonical Faction Seed Data Lives In Shared Seed Code

**Date:** 2026-03-07
**Decision:** Move faction seed data into `shared/seed/factions.ts` and have the frontend bootstrap, HUD, and worker D1 reseed all consume that single source.
**Reason:** Faction names, mottos, and scores had already drifted between the frontend and worker copies. That undermined leaderboard consistency and made browser smoke less trustworthy after reseeds.
**Alternatives:** Keep duplicated copies and rely on docs discipline, or move faction data entirely into D1 before deployment.
**Impact:** Faction defaults are now canonical in shared code, the frontend and worker stay aligned by construction, and future changes to faction copy or scores only need one edit.

## ADR-015: Use A Global Per-Mission Faction-Score Cooldown As The First Anti-Farm Guardrail

**Date:** 2026-03-07
**Decision:** Allow mission completion to remain public/session-scoped, but only award faction score once per mission every 30 minutes globally via D1 `mission_reward_claims`.
**Reason:** Fresh anonymous sessions could replay the same mission indefinitely and inflate faction score. A global mission cooldown is cheaper than account identity, preserves public mode, and blocks the easiest farm loop without moving simulation server-side.
**Alternatives:** Do nothing, limit rewards only per session, add full auth, or move mission validation into a heavier server-side model.
**Impact:** Mission completions still progress locally and advance shared capture, but faction leaderboard movement is rate-limited per mission. This is a pragmatic guardrail, not a full anti-abuse system.

## ADR-016: Use A Local-First Checkpoint Ladder For AI Iteration

**Date:** 2026-03-07
**Decision:** Keep the reusable iteration prompt, but drive work from an explicit checkpoint ladder in `docs/SESSION_STATE.json`, with deployment intentionally deferred until the local checkpoints are complete or the user reprioritizes.
**Reason:** The previous loop preserved continuity, but it also encouraged safe incremental hardening over decisive product progress. A checkpoint ladder makes each session finish a concrete local milestone instead of drifting into lower-pressure infra work.
**Alternatives:** Keep the generic "next highest-value task" wording, switch to fully manual session planning, or move deployment to the front of the queue.
**Impact:** Future sessions should complete one visible local checkpoint at a time, update the checkpoint statuses in the canonical state file, and leave Cloudflare deploy work until the local gameplay checklist is done.

## ADR-017: Hybrid Waypoint Persistence Policy On Same-Tab Reload

**Date:** 2026-03-08
**Decision:** Persist `currentWaypointIndex` and `completedWaypoints` to `sessionStorage` after each waypoint is cleared, and restore them when `loadFromApi` finds an active mission. The mission timer is NOT persisted — it resets to `mission.timeLimit` on every reload.
**Reason:** Without this, a player who completes two of three waypoints and then reloads loses all progress and must repeat them from the start, which is frustrating and inconsistent with the existing mission-ownership restore (which already brings back the active mission itself). Persisting the timer would let players extend their time by reloading, which undermines the mission's challenge.
**Alternatives:** (A) Do nothing — reset everything on reload; (B) Persist everything including timer; (C) Move waypoint state server-side into D1.
**Impact:** Same-tab reloads now skip already-cleared waypoints. The implementation is fully client-side via `sessionStorage` with no new API surface. State is cleared on `completeMission`, `failMission`, and boss-phase entry. Boss missions specifically reset on reload (they only have one approach waypoint anyway, and the boss phase itself clears the persisted state).
