# merge-crimes

Merge Crimes is a repo-to-city game project.

The current direction is the repo-city pivot:

- connect a GitHub repo
- translate that repo into a playable city
- surface threats and instability as missions
- fight AI bots attacking the project through coding battles

This repository currently contains:

- `frontend/`: the React + Vite game client
- `worker/`: the Cloudflare Worker API
- `shared/`: shared types, repo models, generator logic, and seed fixtures
- `docs/`: product, system, tracker, and iteration workflow docs

## Current Status

- Current phase: `Phase 3 - Minimal City Frontend`
- Tracker status: `phase_3_in_progress`
- Current recommended slice: `Align repo-city HUD control row with shell action cards`

The tracker is the source of truth for the pivot:

- `docs/REPO_CITY_TRACKER.json`

Important supporting docs:

- `docs/REPO_CITY_PRODUCT_VISION.md`
- `docs/REPO_CITY_SYSTEM_DESIGN.md`
- `docs/REPO_CITY_ITERATIVE_WORKFLOW.md`
- `docs/REPO_CITY_PHASE_EXECUTION_PLAN.md`
- `docs/REPO_CITY_ITERATION_PROMPT.md`

## Run The Frontend

```bash
cd frontend
npm ci
npm run dev
```

Useful frontend commands:

```bash
cd frontend
npm run lint
npm run build
npm run browser:smoke
```

## Run The Worker

```bash
cd worker
npm ci
npm run dev
```

Useful worker commands:

```bash
cd worker
npm run build
```

If you need seeded local data while the worker is running:

```bash
cd worker
npm run seed
```

## Suggested Local Workflow

1. Read `docs/REPO_CITY_TRACKER.json`.
2. Read the repo-city docs listed above.
3. Pick the smallest meaningful end-to-end slice inside the first incomplete milestone.
4. Make changes in `frontend/`, `worker/`, or `shared/`.
5. Run the required validation commands.
6. Update the tracker with the completed slice and validation results.

## Codex Notes

This repo includes a root `AGENTS.md` so future Codex runs can follow the tracker-first workflow automatically.
