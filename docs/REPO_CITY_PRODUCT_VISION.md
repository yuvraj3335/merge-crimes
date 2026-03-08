# Merge Crimes - Repo City Product Vision

## Status

This document defines the proposed product pivot for Merge Crimes.

It supersedes the old "framework gangs in a neon city" fantasy whenever the two directions conflict.

The new north star is:

**Connect your GitHub repo. The repo becomes a city. AI bots attack it. You move through the city and win coding battles to protect and repair your project.**

## Core Idea

The repo does not naturally become a city.

The game builds a translation layer that reads repository structure and repository activity, then maps those signals into a stylized city.

The city is not a literal one-to-one rendering of code.

It is a **playable visualization** of the repo.

## Product Thesis

The strongest version of this project is not:

- a fictional software city with fake gang wars

The strongest version is:

- a personal GitHub-connected repo defense game
- a stylized systems map
- a game about protecting code from hostile or low-quality AI-generated change

This makes the product:

- more personal
- more memorable
- more useful
- more differentiated

## One-Line Pitch

Connect a GitHub repo, watch it become a playable city, and fight AI bots trying to corrupt your codebase.

## The Fantasy

The player is a human maintainer / operator / guardian.

The city is the repo.

Its districts are systems, packages, modules, folders, and services.

AI bots are hostile coding agents that:

- hallucinate APIs
- break tests
- spam bad pull requests
- introduce unsafe refactors
- poison dependencies
- create merge chaos
- destabilize critical areas of the project

The player moves through the city, reaches threatened districts, and defeats those bots through short coding battles.

## What The Game Is

The game is:

- a repo-driven strategy-action layer
- a stylized software-world game
- a mission-based coding battle game
- a GitHub-connected systems visualization

The game is not:

- a perfect semantic model of source code
- a full IDE
- an autonomous PR repair engine
- a literal city builder

## The Critical Mindset

Do not ask:

"Can we automatically convert arbitrary code into a realistic city?"

Ask:

"Can we build a fun, readable city-shaped map that represents the repo in a way players instantly understand?"

That question produces a real product.

## The Player Promise

When a player connects a repo, the game should make them feel:

- this project is now my territory
- this repo has shape and personality
- the problem areas are visible
- the threats are understandable
- I can intervene through play

The player should not feel:

- overwhelmed by raw code complexity
- tricked into thinking the game deeply understands every line
- forced to trust a black-box AI with private code by default

## Product Principles

### 1. The Repo Inspires The City

The city is based on the repo.

It does not need to be a literal architectural diagram.

### 2. Readability Beats Accuracy

If the perfect dependency graph is too noisy, simplify it.

The city needs to be legible.

### 3. Metadata First

The MVP should use read-only repo metadata and GitHub signals before any deep code analysis.

### 4. Curated Combat

Coding battles should use curated templates and clear choices, not open-ended freeform generation.

### 5. Trust Is A Product Feature

Private repo access must be explicit, scoped, and optional.

## User Journey

### Phase 1: Connection

The user connects GitHub and selects a repo.

### Phase 2: Translation

The game reads:

- repo tree
- language mix
- packages or major folders
- issues
- PRs
- workflows
- checks
- dependency signals

### Phase 3: City Generation

The repo is translated into:

- districts
- landmarks
- roads / routes
- threat zones
- missions
- AI bot archetypes

### Phase 4: Gameplay

The player:

1. explores the repo city
2. sees where the threats are
3. enters a district
4. accepts a mission
5. reaches a battle point
6. defeats an AI bot in a coding battle
7. restores district stability

### Phase 5: Ongoing Play

The city refreshes as the repo changes.

New PRs, issues, failures, and alerts create new missions and new battles.

## Repo To City Semantics

### Repo

The whole repo becomes the city.

### Districts

Top-level folders, packages, apps, or services become districts.

### Buildings

Files, grouped subfolders, or important subsystems become buildings / nodes / terminals.

### Roads

Dependencies and import relationships become roads or network routes.

### Heat

Heat becomes:

- AI pressure
- project instability
- bug density
- threat severity

### Capture

Capture becomes:

- district recovery
- system stabilization
- repo cleanup progress

## GitHub-Driven Gameplay

### Good Inputs

- repository tree
- package structure
- language breakdown
- open pull requests
- open issues
- failing workflows
- stale branches
- security advisories
- dependency changes
- recent activity spikes

### Good Outputs

- district layout
- district danger levels
- missions
- boss encounters
- event feed items
- enemy bot types

## AI Bot Fantasy

Bots should be personified code threats.

Examples:

- Hallucination Bot
- Merge Bot
- Regression Bot
- Dependency Bot
- Refactor Bot
- Type Bot
- Prompt Injection Bot

They are not generic monsters.

They are game embodiments of repo risk.

## Mission Philosophy

Every mission should feel like a real repo problem reframed as a game event.

Examples:

- failing workflow -> defense mission at control center
- merge conflict -> boss at conflict core
- stale PR -> recovery mission
- security advisory -> purge mission
- issue spike in auth -> heat surge in auth district

## Social / Sticky Potential

This direction is more durable because it opens up:

- personal repo cities
- team repo cities
- weekly challenge seeds
- "defend your release" events
- scoreboard by recovery points or operator performance

## MVP Definition

The MVP for this pivot is not full repo intelligence.

It is:

1. connect repo
2. classify repo type
3. generate 5-8 districts from folders/packages
4. render a readable city map
5. generate missions from GitHub signals
6. resolve them via curated coding battles

That is enough to prove the product.

## Trust / Privacy Position

The default user story should be:

- read-only GitHub access
- metadata-first translation
- optional deeper inspection later

Do not require:

- full write access
- full source upload
- broad private-code inference by default

## Best Product Framing

Use language like:

- your repo becomes the city
- your systems become districts
- your workflows become infrastructure
- your AI threats become enemies
- your project health becomes the world state

Do not overclaim:

- "the game fully understands your code"
- "the AI repairs your software automatically"

## Recommendation

Keep the current codebase as the base, but rebuild the product ideology around this repo-city concept.

Best practical summary:

- keep the mission engine
- keep the district abstraction
- keep events and boss flow
- replace the old fiction
- attach GitHub as the world generator
- make the repo, not the parody city, the heart of the game
