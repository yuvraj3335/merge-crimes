# Merge Crimes — Project Brief

## Concept

**Merge Crimes** is a neon-cyberpunk, top-down arcade action game set in a city made of software ecosystems. Repo districts, missions, leaderboard rivalry, and merge-conflict boss fights are the core MVP fantasy.

## MVP Status Snapshot

The vertical slice is playable locally and includes:
- 1 city with 6 distinct districts
- Player controller with smooth movement
- Multiple mission archetypes with waypoint flow
- Merge-conflict boss minigame
- Faction leaderboard and bulletin feed
- Shared capture/presence via Durable Objects
- Public-mode-first design with no login required for the local prototype

The MVP is **not deploy-ready yet** because Worker write paths still need hardening.

## Success Criteria
- [x] Game loads and renders a neon city
- [x] Player can move around with WASD
- [x] Districts are visually distinct and meaningful
- [x] Multiple mission types are playable
- [x] Merge conflict minigame works
- [x] District capture / faction scoring loop exists in MVP form
- [x] Public mode works without login locally
- [ ] Cloudflare-deployable safely
- [x] Docs enable instant session resumption

## Near-Term Priority

Before adding more features, make the Worker safe enough to deploy in public mode.
