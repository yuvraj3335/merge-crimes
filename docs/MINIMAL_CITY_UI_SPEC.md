# Merge Crimes - Minimal City UI and Performance Spec

## Goal

Rebuild the current presentation into a minimalist, smooth, city-based experience while preserving the existing game loop.

The user requirement is not "make it more neon."

The user requirement is:

- easy to use
- cool looking
- minimalistic
- super smooth
- still moving through a city
- still fighting AI bots

## Product Decision

The current heavy neon R3F scene is not the right default target for this pass.

The new gameplay view should feel like a clean city operations layer:

- top-down or shallow-angle city view
- clear streets and district zones
- readable terminals and battle nodes
- minimal motion
- low rendering cost

This can be implemented as:

1. a DOM/SVG city map, or
2. a very lightweight orthographic scene

For one-shot implementation reliability, prefer the first option unless there is a strong reason not to.

## Why The Current UI Feels Laggy

The repo already points to the main issues:

- large main frontend bundle
- heavy CSS glow / blur / shadow usage
- a rich R3F scene with many meshes, lights, and animated props
- some components subscribe to large portions of the Zustand store
- player position updates every frame, which increases rerender pressure for UI that reads broad state

### Known Cost Centers

- `frontend/src/App.tsx`
  - mounts the full R3F scene as the default play surface
- `frontend/src/game/CityScene.tsx`
  - multiple lights, fog, shadowed directional light, many street-light point lights
- `frontend/src/game/District.tsx`
  - many generated building meshes per district plus a point light per district
- `frontend/src/game/Waypoint.tsx`
  - uses `Html` inside the 3D scene and multiple lights
- `frontend/src/index.css`
  - lots of text-shadow, box-shadow, drop-shadow, glow, and blur-heavy styles
- `frontend/src/ui/*`
  - several components subscribe to broad store state instead of narrow selectors

The game is currently spending too much of its budget on presentation rather than interaction clarity.

## Hard Decisions

### 1. Keep City Traversal, Simplify City Rendering

Do not remove the city.

Do remove the expensive city rendering style.

The player should still move through a city, but the city should become:

- flatter
- simpler
- clearer
- cheaper to render

### 2. Make The Whole Screen The City

The current HUD + minimap pattern can be simplified.

The new city view itself should communicate:

- player position
- district boundaries
- mission targets
- battle nodes
- route context

That means the minimap can be removed or reduced because the main surface already acts like a readable map.

### 3. Replace Floating Neon Overlays With Docked Panels

Panels should feel stable and predictable:

- command bar at top
- mission / threat list on one side
- district intel or active encounter panel on the other
- minimal action bar or tabs at bottom

Avoid floating glass panels and blur-heavy overlays unless a modal is required.

## Visual Direction

### Overall Look

Think:

- dark tactical city board
- matte surfaces
- thin linework
- restrained color accents
- one primary accent per district
- one warning color for AI threat

Do not think:

- nightclub UI
- neon everywhere
- giant bloom
- stacked glows

### Recommended Palette Behavior

- background: charcoal / graphite / deep navy
- district accents: use current district colors, but tone them down
- AI threat color: controlled amber or red
- success / recovery color: muted green or cyan
- text: bright neutral off-white, not glowing cyan

### Typography

Prioritize readability and performance:

- no remote Google font import
- prefer local system stack or a very light bundled approach
- use one clean sans face for UI
- use one monospace face for coding battles

The UI should feel intentional, not flashy.

### Motion

Use only a few motion primitives:

- subtle transform on hover
- panel fade / slide
- map marker pulse at low intensity

Avoid:

- blur animations
- glow pulsing everywhere
- frequent box-shadow animation
- filter-based effects

## City Presentation Recommendation

### Preferred Direction: Minimal Top-Down City Map

The main play surface should become a tactical city map made of:

- district rectangles / blocks
- road lines
- terminals
- mission markers
- player marker
- optional simple props for identity

The player still traverses the city in world coordinates.

The city should be legible in one glance.

### Optional Direction: Low-Cost Orthographic Scene

If Opus prefers to keep some 3D:

- use an orthographic or near-orthographic camera
- remove shadows
- remove most point lights
- keep geometry very low-cost
- remove `Html` overlays from inside the scene
- reduce district props dramatically

This is acceptable only if it still feels clearly faster and cleaner than the current build.

## Proposed Layout

### Top Bar

Show:

- game title / subtitle
- current operator status
- credits
- reputation / rank
- current district
- connection state if needed

### Left Panel

Use for:

- mission list
- active objective
- district recovery progress

### Right Panel

Use for:

- district intel
- repo intel from `repoSource`
- AI threat summary
- current enemy bot type

### Bottom Strip

Use for:

- Missions
- Rankings
- Threat Feed
- optional settings / quality toggle

### Full-Screen Modal Use Only When Needed

Use modals for:

- AI coding battles
- boss encounters
- maybe title screen

Everything else should stay docked and stable.

## Interaction Model

### Movement

Keep movement simple and responsive.

Good options:

- keep keyboard movement across city coordinates
- optionally add click-to-move later

For the first pass, preserving keyboard traversal is good because it matches current behavior and reduces design drift.

### Mission Start

Approach a district or terminal -> open mission list -> accept mission.

### Mission Flow

Move through the city -> reach waypoint / terminal -> trigger coding battle -> resolve -> continue or complete.

### Boss Flow

Reach the conflict core -> enter multi-step AI duel overlay -> resolve -> reclaim district.

## Coding Battle UI

The coding battle screen should be one of the strongest parts of the redesign.

Requirements:

- very readable monospace layout
- clear enemy bot identity
- 2 to 4 answer options max
- timer visible but not screaming
- success / failure state obvious
- strong hierarchy: prompt -> options -> outcome

It should feel like a clean tactical code duel, not a noisy arcade popup.

## Performance Requirements

### Mandatory

- no remote webfont import in the main stylesheet
- no blur-heavy glassmorphism as the primary UI style
- no large-scale text-shadow / box-shadow spam
- no expensive `drop-shadow()` filter dependence
- narrow Zustand selectors in UI components
- static panels must not rerender constantly because player position changes

### Strongly Preferred

- no default R3F `Canvas` in the main play view
- no 3D shadows in gameplay
- no per-district point lights
- no in-scene `Html` labels

### If 3D Is Kept At All

- one ambient light
- one cheap directional light at most
- no shadow maps
- minimal meshes
- no decorative animated props unless almost free

## State and Rerender Strategy

The redesign should tighten state usage.

### Required Approach

Switch components away from broad `useGameStore()` reads and toward explicit selectors:

- `useGameStore((s) => s.activeMission)`
- `useGameStore((s) => s.currentDistrict)`
- `useGameStore((s) => s.showMissionPanel)`

Do this throughout the UI layer.

### Important Principle

Player position changes frequently.

Only components that genuinely need live position should subscribe to it.

Examples:

- map marker: yes
- objective distance: yes
- mission panel list: no
- leaderboard: no
- bulletin: no

This is a major smoothness win even before visual simplification.

## Keep Existing Gameplay Contracts Stable

The redesign should preserve as much existing logic as possible.

Keep:

- district IDs
- mission IDs
- worker APIs
- smoke bridge behavior
- session behavior

Preserve these test hooks unless there is a very strong reason to change them:

- `data-testid="enter-city"`
- `data-testid="toggle-missions"`
- `data-testid="mission-panel"`
- `data-testid="mission-sync-note"`
- `data-testid="accept-mission-<missionId>"`
- `window.__MERGE_CRIMES_SMOKE__`

If any UI change forces updates, the smoke harness must be updated in the same pass.

## File-Level Implementation Direction

### `frontend/src/App.tsx`

- remove or heavily reduce the current `Canvas`-first layout
- mount the new city gameplay surface
- keep mission timers, API hydration, and banners working

### `frontend/src/index.css`

- rebuild the style system
- remove Google font import
- remove most glow-heavy visual language
- introduce a flat, performant design token set

### `frontend/src/ui/HUD.tsx`

- replace the current floating HUD with a command-bar style layout
- remove the need for a separate minimap if the main city view is readable

### `frontend/src/ui/MainMenu.tsx`

- reword branding toward Human vs AI
- make the menu much cleaner and more intentional

### `frontend/src/ui/MissionPanel.tsx`

- keep mission functionality
- rewrite the copy and visuals around AI ops / district recovery

### `frontend/src/ui/MergeConflictGame.tsx`

- reframe as AI code duel
- keep the simple curated-choice battle structure
- improve hierarchy and readability

### `frontend/src/ui/CityBulletin.tsx`

- reframe as threat feed / incident feed

### `frontend/src/ui/Leaderboard.tsx`

- reframe as recovery rankings / operator standings or resistance standings

### `frontend/src/ui/ConnectionStatusBanner.tsx`

- keep functionality
- restyle to match the minimalist design system

### `frontend/src/store/gameStore.ts`

- do not rewrite core gameplay unless needed
- update copy-facing concepts carefully
- keep API behavior stable
- improve selector usage from the component side

### `frontend/scripts/browser-smoke.mjs`

- preserve existing selectors where possible
- if selectors change, update the smoke flow in the same pass

## AI Theme UI Language

Use copy like:

- AI pressure
- district corruption
- clean patch
- verified fix
- hostile bot
- system breach
- threat feed
- recovery progress
- operator rank
- conflict core

Avoid copy like:

- gang war
- cartel
- mafia
- yakuza

Those can stay in internal IDs if needed, but the player-facing product should move away from that framing.

## Acceptance Criteria

The redesign pass is successful only if all of the following are true:

- the player still moves through a city
- the enemy fantasy is clearly AI bots
- the UI is much flatter, cleaner, and easier to read
- the experience feels materially smoother than before
- mission flow still works
- coding battles still work
- district / leaderboard / bulletin systems still work
- frontend build passes
- frontend lint passes
- local smoke either still passes unchanged or is updated and passing

## Nice-To-Have If Time Allows

- simple quality toggle
- district intel panel showing `repoSource`
- better mission card grouping by district threat
- bot portraits or simple iconography
- stronger boss identity per district

## Do Not Do In This Pass

- do not chase deployment
- do not build full GitHub OAuth
- do not turn battles into full editor sessions
- do not add expensive shader or post-processing work
- do not optimize for visual spectacle over smoothness

The right answer is a clean, fast, city-based action layer with AI-bot battles.
