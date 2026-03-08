# Opus One-Shot Prompt - Merge Crimes Human vs AI Reboot

Use the following prompt with Opus.

```text
You are taking over the Merge Crimes codebase for a one-shot frontend/gameplay presentation reboot.

The user has explicitly reprioritized away from deployment work.

Do not follow the old deployment-first prompt if it conflicts with this request.
This task overrides the previous priority because the user explicitly asked for a theme + UX + performance rethink.

Your job:

Transform the current game into a smoother, minimalist city-based "human player vs AI bots" experience while preserving the existing mission loop, backend contracts, and smoke-test flow as much as possible.

Read these files first:
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/AI_CITY_REBOOT_BRIEF.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/MINIMAL_CITY_UI_SPEC.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/ARCHITECTURE.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/HANDOFF.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/TEST_MATRIX.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/App.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/store/gameStore.ts
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/index.css
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/scripts/browser-smoke.mjs

Context and product direction:
- Keep moving through a city
- Keep districts, missions, waypoint flow, boss flow, leaderboard, bulletin, and district progress
- Shift the fantasy from framework gangs to human operator vs rogue AI bots
- Remove the heavy neon/glow-heavy style
- Make the UI minimalist, cool, easy to use, and noticeably smoother
- Coding battles should feel like fighting AI bots, not just abstract merge conflicts
- Do not make GitHub mandatory; only surface existing repo metadata where useful

Non-negotiable product goals:
1. The player must still feel like they are traversing a city
2. The enemy fantasy must clearly be AI bots
3. The UI must become cleaner and flatter, not more neon
4. The game must feel smoother
5. The current core gameplay loop must still function

Recommended branding:
- Keep repo/package names stable unless there is a compelling reason not to
- Rebrand in UI copy only for now
- Safe direction: "Merge Crimes // Human vs AI"

Implementation strategy:

1. Rebuild the presentation layer around a minimalist city operations view
   - Prefer a top-down or shallow-angle city map
   - Prefer DOM/SVG or a very lightweight rendering approach
   - If you keep any R3F scene, it must be radically simplified
   - City traversal must remain spatial and readable

2. Reframe all player-facing copy
   - Districts are sectors under AI pressure
   - Missions are recovery / defense / extraction / purge ops
   - Boss battles are AI coding duels
   - Bulletin is a threat feed
   - Capture is district recovery or purge progress

3. Restyle the full UI
   - no remote Google font import
   - no blur-heavy glassmorphism
   - no stacked glow spam
   - no giant text-shadow/box-shadow/filter dependence
   - use a restrained, high-contrast, flat design system

4. Improve rerender behavior
   - move components to selector-based Zustand subscriptions
   - do not let broad UI rerender every time playerPosition changes
   - only subscribe to live position where necessary

5. Preserve the current logic/backends where possible
   - do not break district IDs or mission IDs unless absolutely necessary
   - do not rewrite the worker unless a small compatibility change is truly needed
   - keep public-mode-first constraints intact

Required gameplay direction:

- City traversal remains central
- Missions still begin through district/mission interaction
- Completing missions should feel like beating AI bots through curated code battles
- Boss encounters should become stronger AI duel moments
- The game should feel more like a city under AI siege than a gang parody

Technical preference:

- Best option: replace the current heavy default 3D gameplay view with a minimalist city map layer that still supports movement
- Acceptable fallback: keep some 3D, but remove shadows, most point lights, in-scene Html, and most decorative geometry

Important existing contracts to preserve if at all possible:
- `data-testid="enter-city"`
- `data-testid="toggle-missions"`
- `data-testid="mission-panel"`
- `data-testid="mission-sync-note"`
- `data-testid="accept-mission-<missionId>"`
- `window.__MERGE_CRIMES_SMOKE__`

If you must change any of these, update `frontend/scripts/browser-smoke.mjs` in the same pass and make it pass again.

High-value files likely to change:
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/App.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/index.css
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/ui/HUD.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/ui/MainMenu.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/ui/MissionPanel.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/ui/MergeConflictGame.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/ui/CityBulletin.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/ui/Leaderboard.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/ui/ConnectionStatusBanner.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/store/gameStore.ts
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/scripts/browser-smoke.mjs

Possible file strategy:
- keep the current store and APIs
- replace or heavily reduce the current scene/view components
- introduce a simpler city map component and cleaner layout components
- remove or sideline scene pieces that are now unnecessary

GitHub direction:
- Do not implement full OAuth unless it is somehow trivial and low-risk
- Do surface existing `repoSource` metadata in district intel if useful
- Keep GitHub optional and read-only in this pass

Constraints:
- Heavy simulation stays client-side
- No live LLM requirement
- No deployment work unless required by the user
- Keep Cloudflare-free-tier-friendly architecture assumptions

Performance targets:
- noticeably lighter UI
- much lower visual overhead
- no remote webfont dependency
- much less CSS effect cost
- no broad store subscriptions in high-level UI components
- keep build/lint healthy

Definition of done:
- The game now reads as human vs AI bots
- The city is still explorable
- The UI is minimalist and easy to read
- The game feels smoother
- Mission flow still works
- Coding battle flow still works
- `npm run lint` passes in `frontend`
- `npm run build` passes in `frontend`
- `npm run build` passes in `worker` if any shared types changed
- `npm run browser:smoke` passes, or if not feasible, you must clearly state what broke and why

Execution style:
- Make real code changes, not just plans
- Favor the simplest robust implementation over speculative polish
- Do not stop after theme copy changes; carry the work through to layout/performance improvements
- If full replacement is too risky, deliver the strongest coherent minimal city reboot that actually runs well

At the end, report:
- what changed
- which files changed
- what theme decisions were made
- what performance decisions were made
- what was tested
- what was not tested
- residual risks
```
