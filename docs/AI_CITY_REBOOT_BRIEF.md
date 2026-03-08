# Merge Crimes - AI City Reboot Brief

## Purpose

This document defines the recommended thematic reboot for the current game.

The user direction is:

- keep moving through a city
- keep districts and mission flow
- shift the fantasy from framework-gang turf war to human player vs AI bots
- remove the heavy neon / glow-heavy presentation
- make the game feel minimalist, easy to read, cool, and very smooth

This is a product and experience brief, not a literal line-by-line implementation plan.

## Recommended Positioning

Keep the repo and package names as-is for now, but reframe the in-game fantasy as:

**Merge Crimes // Human vs AI**

Recommended elevator pitch:

> A minimalist code-city action game where human runners move through infected districts, challenge rogue AI bots in coding battles, and reclaim the city one mission at a time.

This is a cleaner and more marketable hook than the current framework-gang parody, and it maps well onto the systems already in the repo.

## Core Fantasy

The player is a human operator moving through a damaged code city.

The city is under attack by rogue AI coding agents that:

- ship bad patches fast
- hallucinate APIs and imports
- poison build systems
- spam broken pull requests
- create merge chaos
- corrupt district infrastructure

The player does not shoot enemies in a traditional combat loop.

Instead, the player:

1. moves through the city
2. enters threatened districts
3. accepts missions from resistance channels
4. reaches battle points and terminals
5. fights AI bots through short coding battles
6. earns credits, reputation, and district recovery progress
7. slowly pushes the AI out of the city

## What Should Stay From The Current Game

Do not throw away the existing structure. The current systems already support this fantasy.

Keep:

- district-based city traversal
- timed missions
- waypoint/objective flow
- boss encounters
- capture / progress loop
- leaderboard
- city bulletin / event feed
- shared district presence
- public-mode-first architecture

Change the meaning and presentation of those systems, not the whole game shape.

## Theme Shift

### Old Fantasy

- neon software gangs
- framework turf wars
- merge conflicts as parody combat

### New Fantasy

- human maintainers vs rogue AI agents
- each district is a part of a city-sized codebase
- the player is a runner / operator / maintainer
- missions are cleanup, defense, extraction, and recovery operations
- coding battles are the main form of combat

## Tone

Recommended tone:

- sharp
- tense
- readable
- tech-thriller
- minimal
- slightly stylized, not jokey chaos

Avoid:

- meme overload
- too many inside jokes
- gangster parody as the main story
- loud cyberpunk clutter

The city can still be futuristic, but it should feel controlled and intentional.

## World Frame

The city is a live software metropolis.

Each district represents a major stack domain, but now the district identity is not "gang ownership." It is "system function under AI pressure."

Example framing:

- React District -> interface systems under UI hallucination attacks
- Rust Docks -> systems infrastructure under unsafe optimization bots
- Python Heights -> automation sector flooded with dependency and scripting bots
- Go Freeway -> pipeline and throughput sector under concurrency sabotage
- TypeScript Terminal -> contract and validation hub under type-distortion bots
- Linux Underground -> kernel and low-level recovery zone under root-level AI corruption

This lets the existing district seed data remain useful without forcing a total rewrite of the city layout.

## System Mapping

| Current System | New Meaning |
|---|---|
| Districts | City sectors under AI pressure |
| Factions | Human resistance cells / maintainer crews |
| Capture progress | District recovery / AI purge progress |
| Heat level | AI pressure / corruption intensity |
| Missions | Recovery, defense, extraction, purge, relay jobs |
| Merge conflict encounters | AI coding battles / bot duels |
| Bulletin | Threat feed / system incident feed |
| Leaderboard | Resistance rankings / city recovery standings |
| Presence count | Operators online in the district |

## District Reframe

Do not change internal IDs unless necessary. Reword labels, descriptions, and UI copy first.

Suggested district reinterpretation:

| Current District ID | Suggested Fantasy | Primary AI Threat |
|---|---|---|
| `react-district` | Interface Quarter | hallucinated UI patches, rerender storms |
| `rust-docks` | Systems Yard | unsafe low-level suggestions, corrupted artifacts |
| `python-heights` | Automation Heights | dependency poisoning, script drift |
| `go-freeway` | Pipeline Ring | race conditions, throughput sabotage |
| `typescript-terminal` | Contract Terminal | type confusion, fake-safe configs |
| `linux-underground` | Kernel Depths | root-level corruption, system lockups |

## Player Fantasy

The player should feel like:

- a fast human operator in a city under siege
- someone who can move quickly between problem zones
- someone who can read the situation and beat the AI with judgment, not brute force
- someone reclaiming the city one operation at a time

The game should not feel like:

- a generic shooter
- a full IDE simulator
- a parody dashboard
- a slow strategy sim

## Coding Battles

The current boss/minigame structure is the right base.

Expand the fantasy so that all important mission completions can trigger an AI battle, not only boss fights.

### Battle Design Principles

- short
- readable in under 5 seconds
- one clear question at a time
- visually clean
- curated outcomes, not freeform code entry

### Good Battle Types

- choose the correct patch
- identify the hallucinated import
- pick the fix that makes the test pass
- resolve a fake AI merge conflict
- choose the safest refactor
- identify the prompt-injected bad change
- order the repair steps correctly

### Bad Battle Types

- full editor typing
- long essays
- giant diffs
- anything that requires expert programming knowledge to read

The player should feel smart, not excluded.

## AI Bot Roster

Define AI bots as enemy personalities, not just random challenge wrappers.

Suggested archetypes:

- **Patch Faker**: writes plausible but wrong hotfixes
- **Type Siren**: produces elegant-looking broken type logic
- **Dependency Leech**: injects bad packages and fake imports
- **Test Saboteur**: passes the obvious path, fails edge cases
- **Merge Mimic**: makes merge resolutions that look correct but hide regressions
- **Kernel Ghost**: suggests dangerous low-level shortcuts

Each district should emphasize one or two bot archetypes so the city feels varied.

## Mission Reframe

Current mission types can stay, but rewrite their fantasy:

| Mission Type | New Framing |
|---|---|
| Delivery | deliver trusted context, patch keys, clean artifacts |
| Escape | outrun an AI watchdog swarm or failing system collapse |
| Recovery | retrieve clean code, tests, tokens, or artifacts from corrupted nodes |
| Defense | hold a terminal while bots flood the pipeline |
| Boss | face a named AI bot in a multi-round coding duel |

## Example Mission Fantasy

### Delivery

"Carry a verified patch seed from Interface Quarter to Contract Terminal before the bot net rewrites the release branch."

### Recovery

"Recover the last clean artifact from Systems Yard before the AI recycler ships the corrupted build."

### Defense

"Hold the validation gate while AI bots spam malformed configs into the pipeline."

### Boss

"Enter the conflict core and defeat a named bot that has taken over the district routing logic."

## Progression Reframe

Keep the same progression systems, but rename them in UI where useful:

- Credits -> still fine
- Reputation -> Operator Rank or Trust
- Capture -> Recovery or Purge

The loop should feel like city restoration, not just score farming.

## GitHub Integration Strategy

GitHub can be valuable here, but it should be optional and staged.

### Phase 1 - Surface Existing Repo Identity

The repo already has `repoSource` metadata in districts. Use that in district intel panels:

- repo owner / repo name
- language
- stars
- open issues
- recent activity

This makes each sector feel tied to a real software ecosystem without adding risky live dependencies.

### Phase 2 - Read-Only World Signals

Use a scheduled worker to cache public GitHub signals and turn them into world state:

- issue spikes -> district pressure up
- release events -> defense missions
- security advisories -> quarantine / recovery missions
- activity surges -> threat feed items

Gameplay must still work if GitHub is down.

### Phase 3 - Optional Identity

Add optional GitHub login so players can:

- display a GitHub username in profile
- attach an avatar
- personalize their operator card

This should never be required for core play.

### Phase 4 - Personalized Ops

Later, let players follow selected public repos for:

- daily bounty missions
- themed district alerts
- personal challenge chains

Do not make this the MVP scope for the redesign pass.

## UX Direction

The visual direction should be minimalist city-tech, not glow-heavy cyberpunk.

Recommended style:

- dark matte surfaces
- restrained accent colors
- flat or low-depth panels
- crisp lines
- readable code-card battles
- simple map / city movement presentation

Avoid:

- giant bloom effects
- heavy blur
- multiple stacked shadows
- bright magenta/cyan everywhere
- loud typography

The game should feel precise and fast.

## Recommended Visual Metaphor

Do not turn the game into a static menu.

The player still needs to move through a city, but the city should be simplified into a clean tactical city layer:

- streets
- blocks
- sectors
- terminals
- battle nodes

This can be shown as:

- a minimalist top-down city map
- or a very light orthographic / pseudo-3D city

Either approach is valid if it feels smooth and spatial.

## Non-Goals For The First Reboot Pass

Do not try to do all of this at once:

- live LLM inference in gameplay
- full GitHub OAuth + repo permissions
- procedural mission generation from scratch
- voice acting
- giant new story campaign
- complex skill trees

The first pass should focus on a coherent, performant, player-vs-AI city experience.

## First-Pass Success Criteria

The reboot is successful if:

- the game still feels like moving through a city
- the enemy fantasy is clearly AI bots, not rival gangs
- coding battles are central to mission completion
- the UI is much cleaner and more readable
- the game feels significantly smoother
- the city still has identity without the neon overload
- the current mission loop, leaderboard, bulletin, and district progress still make sense

## Implementation Priority

If there is a tradeoff, prioritize in this order:

1. responsiveness
2. clarity
3. coherent human-vs-AI fantasy
4. city traversal feel
5. visual polish
6. extra content

Smooth and understandable beats flashy every time.
