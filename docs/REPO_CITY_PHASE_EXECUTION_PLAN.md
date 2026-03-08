# Merge Crimes - Repo City Phase Execution Plan

## Purpose

This file turns the repo-city pivot into concrete implementation slices with explicit validation.

Use it with:

- `docs/REPO_CITY_TRACKER.json`
- `docs/REPO_CITY_ITERATIVE_WORKFLOW.md`
- `docs/REPO_CITY_ITERATION_PROMPT.md`

## Global Rule

After Phase 0, every cycle must:

1. change code
2. ship one bounded slice
3. run validation

No docs-only progress.

## Phase 1 - Repo Model Foundation

### Slice 1A

Goal:

- add shared `RepoModel` / `RepoModule` / `RepoSignal` types

Files likely:

- `shared/types.ts`

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

### Slice 1B

Goal:

- add one or two fake GitHub repo snapshots as seed fixtures

Files likely:

- `shared/seed/*`
- `worker/src/*`
- `frontend/src/*`

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

### Slice 1C

Goal:

- create a pure generator that turns a fake repo snapshot into generated districts and missions

Files likely:

- `shared/*`
- `worker/src/*`

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
```

## Phase 2 - Static Repo City Generation

### Slice 2A

Goal:

- repo archetype classifier

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

### Slice 2B

Goal:

- module-to-district mapping and district naming rules

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
```

### Slice 2C

Goal:

- dependency-edge to road mapping and static city payload

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
```

## Phase 3 - Minimal City Frontend

### Slice 3A

Goal:

- add a new minimal city surface fed by generated districts

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
```

### Slice 3B

Goal:

- preserve movement and district selection in the new city view

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run browser:smoke
```

### Slice 3C

Goal:

- replace glow-heavy HUD with minimalist shell

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run browser:smoke
```

## Phase 4 - GitHub Connection MVP

### Slice 4A

Goal:

- GitHub connect scaffolding and repo selection using mocked or partial auth flow

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
```

### Slice 4B

Goal:

- fetch one real repo and normalize into `RepoModel`

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

### Slice 4C

Goal:

- user can select a repo and see a generated city from real data

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

## Phase 5 - Signal-Driven Missions

### Slice 5A

Goal:

- normalize GitHub signals into internal threat events

### Slice 5B

Goal:

- turn normalized signals into generated missions

### Slice 5C

Goal:

- district heat / AI pressure updates from signals

Validation for all Phase 5 slices:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
```

## Phase 6 - AI Bot Battle Layer

### Slice 6A

Goal:

- bot archetype mapping by signal type

### Slice 6B

Goal:

- coding battle templates flavored by repo threat type

### Slice 6C

Goal:

- boss encounter generation from merge conflicts / severe repo events

Validation for all Phase 6 slices:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run browser:smoke
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

## Phase 7 - Trust, Refresh, And Polish

### Slice 7A

Goal:

- refresh cycle and snapshot cache behavior

### Slice 7B

Goal:

- privacy-safe copy and permission boundaries

### Slice 7C

Goal:

- frontend performance pass and selector cleanup

Validation:

```bash
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run lint
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run build
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend && npm run browser:smoke
cd /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/worker && npm run build
```

## Recommended Iterative Prompt

Use `docs/REPO_CITY_ITERATION_PROMPT.md`.

That prompt is now the default prompt for iterative execution because it explicitly forbids docs-only progress after Phase 0 and requires validation in each cycle.
