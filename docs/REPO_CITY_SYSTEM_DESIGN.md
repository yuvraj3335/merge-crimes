# Merge Crimes - Repo City System Design

## Goal

Define a feasible technical design for turning a GitHub repository into a playable city.

This design is intentionally biased toward:

- clarity
- MVP feasibility
- privacy safety
- compatibility with the current Merge Crimes codebase

## Top-Level Pipeline

The full pipeline is:

1. User connects GitHub
2. User selects a repo
3. System fetches repo metadata and activity
4. System builds a normalized `RepoModel`
5. System classifies the repo archetype
6. System maps modules into districts
7. System maps dependencies into roads
8. System maps GitHub signals into missions, threats, and bot spawns
9. Frontend renders the city and mission state

The important boundary is:

**GitHub data -> RepoModel -> Game World**

The repo is never used directly as the game world.

## Scope Boundaries

### MVP In Scope

- GitHub auth
- repo selection
- read-only metadata ingestion
- module/district generation
- mission generation from repo signals
- city layout generation
- curated coding battles

### Not In MVP

- automatic code fixes
- auto-committing PR changes
- deep semantic understanding of every source file
- always-on AI code generation
- arbitrary code execution on the server

## Data Sources

### Required GitHub Inputs

- repository metadata
- default branch
- language stats
- tree / package structure
- pull requests
- issues
- workflow runs and statuses
- checks

### Optional Later Inputs

- dependency manifests
- alerts
- commit history windows
- changed file paths per PR
- selected diff content for battle generation

## Access Model

### MVP Recommendation

Use read-only GitHub auth.

Preferred options:

- GitHub OAuth App for user identity and repo access
- or GitHub App if the product later needs more controlled installation semantics

### Required Trust Principle

The game should work well with metadata and selected safe content.

Do not require blanket private-repo content ingestion in the first version.

## Normalized Repo Model

The backend should create a normalized internal representation.

```ts
type RepoArchetype =
  | "frontend"
  | "backend"
  | "library"
  | "fullstack"
  | "monorepo"
  | "unknown";

type RepoModel = {
  repoId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  visibility: "public" | "private";
  archetype: RepoArchetype;
  languages: RepoLanguage[];
  modules: RepoModule[];
  dependencyEdges: DependencyEdge[];
  signals: RepoSignal[];
  generatedAt: string;
};

type RepoLanguage = {
  name: string;
  bytes: number;
  share: number;
};

type RepoModule = {
  id: string;
  name: string;
  path: string;
  kind: "app" | "package" | "service" | "folder" | "infra" | "tests" | "docs" | "control";
  language: string | null;
  fileCount: number;
  totalBytes: number;
  importanceScore: number;
  activityScore: number;
  riskScore: number;
};

type DependencyEdge = {
  fromModuleId: string;
  toModuleId: string;
  weight: number;
  reason: "import" | "package_dependency" | "service_link" | "folder_reference";
};

type RepoSignal =
  | { type: "failing_workflow"; target: string; severity: number }
  | { type: "open_pr"; target: string; severity: number }
  | { type: "merge_conflict"; target: string; severity: number }
  | { type: "security_alert"; target: string; severity: number }
  | { type: "issue_spike"; target: string; severity: number }
  | { type: "stale_pr"; target: string; severity: number }
  | { type: "flaky_tests"; target: string; severity: number }
  | { type: "dependency_drift"; target: string; severity: number };
```

This model should be cached and reused rather than recomputed on every page load.

## Repo Archetype Classification

Do not try to support arbitrary repos with no structure rules.

Instead, classify them into a small number of archetypes.

### Heuristic Examples

#### Frontend

Signals:

- `src/`
- `public/`
- `components/`
- `pages/`
- heavy JS/TS/CSS ratio

#### Backend

Signals:

- `api/`
- `server/`
- `routes/`
- `controllers/`
- `db/`

#### Library

Signals:

- smaller repo
- few app folders
- `src/` + `tests/`
- package-focused layout

#### Fullstack

Signals:

- both app and service layers
- distinct UI and API roots

#### Monorepo

Signals:

- `apps/*`
- `packages/*`
- workspace config

The archetype determines the city template used later.

## Module Extraction Rules

### Simple Rule First

Top-level packages or top-level major folders become primary modules.

Examples:

```text
src/
api/
tests/
docs/
infra/
.github/
```

becomes six modules.

### Monorepo Rule

Prefer:

- `apps/*`
- `packages/*`
- `services/*`

as the first-class module layer.

### Aggregation Rule

Do not create one district per tiny folder.

Cap district count in the MVP.

Suggested target:

- minimum: 4 districts
- ideal: 5-8 districts
- hard cap: 10 districts

If the repo has too many top-level items:

- merge low-value folders into a support district
- absorb tiny utilities into a shared district

## District Generation

Each primary module becomes a district.

### District Fields

```ts
type GeneratedDistrict = {
  id: string;
  moduleId: string;
  name: string;
  label: string;
  category: "interface" | "service" | "data" | "ops" | "validation" | "archive" | "shared" | "control";
  sizeScore: number;
  heatLevel: number;
  riskLevel: number;
  position: { x: number; y: number };
  footprint: { width: number; height: number };
  colorToken: string;
  buildings: GeneratedBuilding[];
};
```

### Naming Rule

Use readable generated names, not raw folder names only.

Examples:

- `src` -> Interface Quarter
- `api` -> Service Core
- `db` -> Data Vault
- `tests` -> Validation Ring
- `.github` -> Control Tower
- `docs` -> Archive Sector

Keep the raw path in metadata, but present a stylized label in the UI.

## Building Generation

Buildings are abstractions, not literal file renderings.

### Rules

- large grouped folders -> building clusters
- important files -> terminals / landmarks
- test-heavy zones -> shield nodes
- configs -> infrastructure nodes
- entrypoints -> gates / hubs

### Aggregation Strategy

If a folder contains many similar files:

- do not generate 100 tiny buildings
- generate one district structure or cluster

Example:

`src/components/*` -> one dense component block

`auth.ts` or `index.ts` -> major terminal node

## Dependency -> Road Mapping

The city needs visible connectivity.

Dependency edges become roads / rails / network routes.

### Candidate Inputs

- workspace/package dependencies
- import graph aggregated at module level
- service relationship conventions
- selected folder references

### Simplification Rule

Show only the strongest edges.

Suggested rule:

- keep top 1-3 outbound edges per district
- discard weak or noisy edges

This keeps the city readable.

## Layout Algorithm

This is not a true city simulator.

It is a graph-to-map layout.

### Small Repo

- 4-6 districts
- one central hub
- support districts around it

### Medium Repo

- hub-and-spoke
- central control / shared district
- specialized districts around perimeter

### Monorepo

- apps on outer ring
- shared packages near center
- infra and control at upper edge or hub

### Layout Inputs

- module size
- module importance
- module connectivity
- module risk

### Layout Rules

- more connected modules go closer together
- larger modules get larger footprint
- higher-risk modules can get hotter / more visually stressed districts
- control / infra districts should sit in prominent positions

## GitHub Signal Ingestion

Signals should be normalized and attached to districts.

### Signal Types

- failing workflow
- merge conflict
- open PR load
- stale PR
- issue spike
- flaky test cluster
- security advisory
- dependency drift

### Example Mapping

| Signal | Game Result |
|---|---|
| failing workflow | defense mission in control district |
| merge conflict PR | boss encounter |
| stale PR | recovery mission |
| security alert | purge mission in affected district |
| issue spike | district heat increase |
| flaky tests | sabotage mission in validation district |
| dependency drift | dependency bot event |

## Enemy Bot Generation

Bots are derived from the type of threat.

### Base Archetypes

- Hallucination Bot
- Merge Bot
- Regression Bot
- Dependency Bot
- Type Bot
- Refactor Bot
- Saboteur Bot

### Spawn Rule

Threats should create a bot identity based on signal + district.

Examples:

- merge conflict in TS-heavy district -> Merge Bot / Type Bot hybrid
- failing tests in validation-heavy district -> Regression Bot
- dependency alert in shared package district -> Dependency Bot

## Mission Generation

### Mission Schema

```ts
type GeneratedMission = {
  id: string;
  districtId: string;
  title: string;
  type: "delivery" | "recovery" | "defense" | "escape" | "boss";
  difficulty: 1 | 2 | 3 | 4 | 5;
  sourceSignalType: string;
  targetRef: string;
  description: string;
  objectives: string[];
  battleTemplateId?: string;
};
```

### Good Mission Templates

- defend workflow control
- recover clean artifact
- purge dependency poison
- stabilize validation node
- resolve conflict core
- escort verified patch

## Coding Battle System

The current Merge Crimes battle structure can be reused conceptually.

The game should not generate arbitrary freeform coding tasks in the MVP.

Use curated battle templates such as:

- choose the safe patch
- identify fake import
- select valid type fix
- pick the correct merge resolution
- choose the fix that satisfies test intent

These templates can later be flavored using repo metadata.

## Current Codebase Reuse Matrix

### Keep

- district abstraction
- mission abstraction
- event abstraction
- conflict / boss abstraction
- worker API patterns
- session model
- smoke harness concept

### Rework

- shared seed generation to support repo-driven generation
- player-facing copy
- frontend map and city rendering
- UI layout
- state selectors

### Add

- GitHub auth
- repo selection
- repo ingestion endpoints
- repo model storage / cache
- repo-to-city generator
- signal-to-mission generator

## Backend Architecture Recommendation

Current backend is Cloudflare Worker + D1 + KV + DO.

This remains acceptable.

### Recommended New Data Areas

- `github_accounts`
- `github_repo_connections`
- `repo_snapshots`
- `generated_cities`
- `generated_missions`
- `repo_signals`

### Cache Strategy

Use KV or D1 snapshot tables to avoid regenerating the city on every request.

Suggested refresh pattern:

- initial fetch on connect
- manual refresh button
- scheduled refresh every N minutes or hours for active repos

## Privacy / Safety Rules

### MVP Safety

- read-only access first
- store minimal necessary metadata
- do not pull full private source unless explicitly needed
- do not expose private repo content in public leaderboards or shared views

### Public Product Copy

Say:

- "your repo inspires the city"

Do not say:

- "we fully understand your source code"

## MVP Build Order

1. Repo connection and selection
2. RepoModel generation
3. Repo archetype classification
4. District generation
5. Static city map render
6. Signal ingestion
7. Mission generation
8. AI battle flavoring

## Success Criteria

The system is successful if:

- users can connect a repo
- a readable city is generated from that repo
- the city feels structurally related to the repo
- missions reflect GitHub activity
- AI bots feel connected to actual repo problems
- the game remains legible and fun even when the mapping is approximate
