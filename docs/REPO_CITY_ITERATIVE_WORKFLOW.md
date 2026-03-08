# Merge Crimes - Repo City Iterative Workflow

## Purpose

This workflow is designed so a future coding agent can make steady progress on the repo-to-city pivot without rethinking the project every turn.

The rule is:

**One bounded, testable slice at a time.**

## Canonical Files For This Pivot

When working on the repo-city direction, read these first:

- `docs/REPO_CITY_TRACKER.json`
- `docs/REPO_CITY_PRODUCT_VISION.md`
- `docs/REPO_CITY_SYSTEM_DESIGN.md`
- `docs/REPO_CITY_ITERATION_PROMPT.md`
- `docs/REPO_CITY_OPUS_PROMPT.md`

If these files conflict with older deployment-era docs, prefer the repo-city files for this track of work.

## Operating Principles

### 1. Do Not Rebuild Everything At Once

Avoid giant rewrites that combine:

- GitHub auth
- new backend models
- full city generator
- full frontend redesign
- battle redesign

in one step.

### 2. Build The Translation Layer First

The most important system is not the map renderer.

It is the path:

**GitHub data -> RepoModel -> Generated city/missions**

### 3. Keep The Current Core Loop Alive

Whenever possible:

- preserve missions
- preserve district flow
- preserve battle flow
- preserve smoke harness behavior

### 4. Prefer Internal Stability Over Thematic Perfection

A rough but consistent repo-city mapping is better than a clever but unstable one.

### 5. No Docs-Only Progress After Phase 0

Phase 0 was the only docs-first phase.

After that:

- docs can support a cycle
- docs can clarify a cycle
- docs can record a cycle

But docs alone do not count as milestone progress.

Every later cycle must include at least one real code or contract change under:

- `frontend/`
- `worker/`
- `shared/`

## Phase Plan

### Phase 0 - Product Lock

Goal:

- stop theme drift
- agree on the repo-city ideology

Deliverables:

- product vision doc
- system design doc
- tracker file
- prompts

Validation:

- docs exist
- future agent can explain the new concept clearly

### Phase 1 - Repo Model Foundation

Goal:

- introduce a normalized internal repo model

Deliverables:

- shared types for `RepoModel`, `RepoModule`, `RepoSignal`
- backend shape for static or mocked repo ingestion
- local seed fixture for one or two fake repos

Validation:

- build passes
- frontend can fetch and display a fake repo-city payload

### Phase 2 - Static Repo City Generation

Goal:

- generate districts from a fake or seeded repo model

Deliverables:

- repo archetype classifier
- folder/package to district mapping
- district size / heat / label generation

Validation:

- one example repo generates a readable 5-8 district city

### Phase 3 - Minimal City Frontend

Goal:

- replace or sideline the current heavy visual layer

Deliverables:

- minimalist city map
- district rendering
- player movement through the new map
- lightweight UI shell

Validation:

- frontend feels visibly smoother
- movement and mission panel still work

### Phase 4 - GitHub Connection MVP

Goal:

- connect a real repo in read-only mode

Deliverables:

- GitHub auth flow
- repo selection flow
- basic ingestion endpoints
- cached repo snapshots

Validation:

- user can connect GitHub and choose a repo
- one real repo can generate a city

### Phase 5 - Signal-Driven Missions

Goal:

- replace fictional mission sourcing with repo signal sourcing

Deliverables:

- signal normalization
- signal-to-mission generator
- district heat updates from signals

Validation:

- open issues / PRs / workflows alter the city and mission list

### Phase 6 - AI Bot Battle Layer

Goal:

- align coding battles with repo threats

Deliverables:

- bot archetype system
- battle template mapping by signal type
- improved boss/battle copy

Validation:

- battles feel like AI threats tied to repo state

### Phase 7 - Trust, Refresh, And Polish

Goal:

- make the system reliable and user-safe

Deliverables:

- refresh logic
- privacy copy
- better loading/error states
- performance pass

Validation:

- repeatable flows
- acceptable UX on real repos

## Session Workflow For Future Agents

Every future implementation session should do this:

1. Read `docs/REPO_CITY_TRACKER.json`
2. Read the current pivot docs
3. Find the first incomplete milestone
4. Pick the smallest end-to-end slice inside that milestone
5. Implement it
6. Run the relevant validation
7. Update the tracker with exact status

## Cycle Acceptance Requirements

A cycle only counts as real progress if all of the following are true:

1. At least one non-doc file changed
2. The slice is end-to-end enough to demonstrate capability
3. Relevant validation commands were run
4. Failures, if any, are reported honestly

If a session only changes docs after Phase 0, that session should be recorded as planning support, not milestone progress.

## Slice Rules

A good slice:

- changes one system boundary
- is testable
- leaves the app runnable
- improves visible capability

Examples of good slices:

- add shared `RepoModel` types and fake seed data
- build folder-to-district generator using mocked repo JSON
- replace the old map with a lightweight district map
- add repo selector screen with fake data before real OAuth

Examples of bad slices:

- "implement GitHub integration" with no narrower scope
- "rewrite everything into repo-city mode"
- "add full AI battle generation from diffs"

## Validation Expectations

### For Backend/Data Slices

- `worker` build passes
- data contracts are coherent

### For Frontend Slices

- `frontend` lint passes
- `frontend` build passes
- smoke harness preserved or deliberately updated

### For Cross-Cutting Slices

- all affected packages build
- document what was not tested

## Dry Run Command Matrix

Use the smallest relevant command set for the slice, but do not skip validation.

### Shared Types Only

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

### Worker/Data Slice

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

### Frontend/UI Slice

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
```

### UI Flow / Selector / Mission Flow Slice

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run browser:smoke
```

If a command is too expensive or blocked, the session output must say exactly why it was not run.

## Stop Conditions

Pause and update docs if:

- a slice requires changing the north-star concept
- GitHub permissions become unclear
- repo privacy assumptions need legal/product decisions
- the current codebase fights the new direction hard enough to justify a deeper rewrite

## Current Recommendation

The next best implementation phase is:

**Phase 1 - Repo Model Foundation**

The right first coding milestone is:

- add shared repo model types
- create one fake GitHub repo snapshot
- create a generator that turns that snapshot into districts and missions

That gives the project something concrete and testable before touching real GitHub auth.
