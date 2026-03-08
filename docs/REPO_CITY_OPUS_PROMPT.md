# Repo City Opus Prompt

Use this prompt when you want a stronger one-shot attempt from Opus.

```text
You are taking over the Merge Crimes codebase for a repo-to-city product pivot.

Read these files first:
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_TRACKER.json
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_PRODUCT_VISION.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_SYSTEM_DESIGN.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/REPO_CITY_ITERATIVE_WORKFLOW.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/AI_CITY_REBOOT_BRIEF.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/docs/MINIMAL_CITY_UI_SPEC.md
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/App.tsx
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/frontend/src/store/gameStore.ts
- /Users/yuvrajmuley/Documents/yuvraj/merge-crimes/shared/types.ts

The new product direction is:

Connect a GitHub repo, translate it into a playable city, and fight AI bots attacking the project through coding battles.

Key rules:
- The repo does not literally become a city. Build a translation layer.
- Metadata-first and read-only GitHub integration in the MVP.
- Keep the current district/mission/conflict abstractions if they still help.
- Prioritize a believable MVP over a flashy but fake implementation.
- Preserve app runnability.

Current recommended milestone:
- Phase 1 - Repo Model Foundation

Your task:
- implement the strongest bounded slice of Phase 1 end-to-end

Preferred scope:
1. Add shared repo model types
2. Add one or two fake repo snapshots / seed fixtures
3. Add a repo-to-city generator contract that turns repo data into districts and missions
4. Wire enough UI/backend surface to prove the concept locally

Do not overreach into full OAuth unless you can do it cleanly and still finish the slice.

Important product rules:
- the city should be inspired by the repo, not claimed as a perfect representation
- GitHub should be optional and read-only in the first pass
- AI bots should correspond to repo threat types like merge conflicts, test failures, dependency alerts, and hallucinated changes

Implementation rules:
- make real code changes
- keep types and contracts clean
- preserve existing app behavior where possible
- prefer stable, mock-driven progress over speculative real integrations

At the end, report:
- what slice was completed
- what files changed
- what still remains for the next slice
- what was tested
- what was not tested
```
