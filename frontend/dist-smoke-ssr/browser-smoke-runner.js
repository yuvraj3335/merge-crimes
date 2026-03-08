import { create } from "zustand";
import "react";
const repoId = "github-yuvrajmuley-merge-crimes";
const owner = "yuvrajmuley";
const name = "merge-crimes";
const defaultBranch = "main";
const visibility = "public";
const archetype = "unknown";
const languages = [{ "name": "TypeScript", "bytes": 612e3, "share": 0.71 }, { "name": "CSS", "bytes": 82e3, "share": 0.1 }, { "name": "Markdown", "bytes": 99e3, "share": 0.11 }, { "name": "SQL", "bytes": 26e3, "share": 0.03 }, { "name": "Shell", "bytes": 47e3, "share": 0.05 }];
const modules = [{ "id": "mod-frontend", "name": "frontend", "path": "frontend/", "type": "directory", "kind": "app", "language": "TypeScript", "fileCount": 38, "totalBytes": 484211, "importanceScore": 88, "activityScore": 84, "riskScore": 38 }, { "id": "mod-worker", "name": "worker", "path": "worker/", "type": "directory", "kind": "service", "language": "TypeScript", "fileCount": 12, "totalBytes": 120897, "importanceScore": 82, "activityScore": 74, "riskScore": 44 }, { "id": "mod-shared", "name": "shared", "path": "shared/", "type": "directory", "kind": "package", "language": "TypeScript", "fileCount": 10, "totalBytes": 92406, "importanceScore": 76, "activityScore": 67, "riskScore": 29 }, { "id": "mod-docs", "name": "docs", "path": "docs/", "type": "directory", "kind": "docs", "language": "Markdown", "fileCount": 20, "totalBytes": 181219, "importanceScore": 54, "activityScore": 80, "riskScore": 16 }, { "id": "mod-control", "name": "repo-city-cycle", "path": "repo-city-cycle", "type": "file", "kind": "control", "language": "Shell", "fileCount": 1, "totalBytes": 6120, "importanceScore": 61, "activityScore": 58, "riskScore": 31 }];
const dependencyEdges = [{ "fromModuleId": "mod-frontend", "toModuleId": "mod-shared", "weight": 0.92, "reason": "import" }, { "fromModuleId": "mod-worker", "toModuleId": "mod-shared", "weight": 0.88, "reason": "import" }, { "fromModuleId": "mod-frontend", "toModuleId": "mod-worker", "weight": 0.71, "reason": "service_link" }, { "fromModuleId": "mod-control", "toModuleId": "mod-worker", "weight": 0.54, "reason": "service_link" }, { "fromModuleId": "mod-docs", "toModuleId": "mod-shared", "weight": 0.38, "reason": "folder_reference" }];
const signals = [{ "type": "merge_conflict", "target": "mod-frontend", "severity": 4, "title": "Shell merge pressure", "detail": "Concurrent UI shell changes are colliding around the repo-city entry surface." }, { "type": "open_pr", "target": "mod-worker", "severity": 2, "title": "Worker review queue", "detail": "Read-only GitHub ingest work has stacked up around the worker API boundary." }, { "type": "flaky_tests", "target": "mod-shared", "severity": 3, "title": "Shared contract drift", "detail": "Cross-package contract checks are intermittently failing when repo snapshots change shape." }, { "type": "failing_workflow", "target": "mod-control", "severity": 3, "title": "Cycle wrapper validation drift", "detail": "Repo-city cycle validation is flagging inconsistent slice bookkeeping in the automation path." }];
const generatedAt = "2026-03-08T13:45:00.000Z";
const metadata = { "provider": "github", "providerRepoId": 1000001, "fullName": "yuvrajmuley/merge-crimes", "description": "Repo-city defense game prototype with React, Cloudflare Workers, and shared generation logic.", "htmlUrl": "https://github.com/yuvrajmuley/merge-crimes", "homepageUrl": null, "topics": ["repo-city", "react", "cloudflare-workers", "typescript", "game"], "stars": 0, "forks": 0, "watchers": 0, "openIssues": 4, "primaryLanguage": "TypeScript", "license": null, "archived": false, "fork": false, "updatedAt": "2026-03-08T13:45:00.000Z", "pushedAt": "2026-03-08T13:45:00.000Z" };
const sampleRepoSnapshotJson = {
  repoId,
  owner,
  name,
  defaultBranch,
  visibility,
  archetype,
  languages,
  modules,
  dependencyEdges,
  signals,
  generatedAt,
  metadata
};
function getLatestCommitShaFromSignals(signals2) {
  for (const signal of signals2) {
    if (signal.type !== "latest_commit") {
      continue;
    }
    if (typeof signal.value !== "string") {
      continue;
    }
    const trimmedValue = signal.value.trim();
    if (trimmedValue.length > 0) {
      return trimmedValue;
    }
  }
  return null;
}
function createInitialConnectedRepoRefreshStatus(signals2) {
  return {
    status: "idle",
    checkedAt: null,
    lastKnownCommitSha: getLatestCommitShaFromSignals(signals2),
    latestRemoteCommitSha: null,
    hasNewerRemote: false,
    isChecking: false,
    errorMessage: null
  };
}
function getGitHubRepoTranslationEligibility(visibility2) {
  if (visibility2 === "public") {
    return {
      eligible: true,
      tone: "eligible",
      pill: "Translate now",
      shortLabel: "translate now",
      pickerDetail: "Eligible for Repo City translation in this read-only flow.",
      menuDetail: "This public repo can be translated in the current read-only flow."
    };
  }
  if (visibility2 === "private") {
    return {
      eligible: false,
      tone: "reference",
      pill: "Listed only",
      shortLabel: "listed only",
      pickerDetail: "Visible through this GitHub connection, but Repo City needs explicit access before translation.",
      menuDetail: "This private repo can't be translated in the current read-only flow."
    };
  }
  return {
    eligible: false,
    tone: "reference",
    pill: "Listed only",
    shortLabel: "listed only",
    pickerDetail: "Visible through this GitHub connection, but this repo is not translation-eligible in the current flow.",
    menuDetail: "This repo can't be translated in the current read-only flow."
  };
}
const DEFAULT_HUB_PRIORITY = {
  package: 0,
  infra: 1,
  control: 1,
  folder: 2,
  tests: 2,
  service: 4,
  app: 4,
  docs: 5
};
const HUB_PRIORITY_BY_ARCHETYPE = {
  frontend: {
    package: 0,
    tests: 1,
    folder: 2,
    app: 3,
    infra: 4,
    control: 4,
    docs: 5,
    service: 5
  },
  backend: {
    package: 0,
    folder: 1,
    tests: 2,
    infra: 2,
    control: 2,
    service: 4,
    app: 5,
    docs: 5
  },
  library: {
    package: 0,
    tests: 1,
    infra: 2,
    control: 2,
    docs: 3,
    folder: 3,
    service: 4,
    app: 4
  },
  fullstack: {
    package: 0,
    infra: 1,
    control: 1,
    folder: 2,
    tests: 2,
    service: 4,
    app: 4,
    docs: 5
  },
  monorepo: {
    package: -1,
    infra: 0,
    control: 0,
    folder: 2,
    tests: 1,
    service: 5,
    app: 6,
    docs: 7
  },
  unknown: {}
};
const ARCHETYPE_LAYOUT_SLOTS = {
  frontend: [
    { x: 0, y: 0 },
    { x: -34, y: -24 },
    { x: 34, y: -24 },
    { x: 0, y: -62 },
    { x: -66, y: 0 },
    { x: 66, y: 0 },
    { x: 0, y: 60 },
    { x: -66, y: 48 },
    { x: 66, y: 48 },
    { x: 0, y: 96 }
  ],
  backend: [
    { x: 0, y: 0 },
    { x: 0, y: -34 },
    { x: -42, y: -18 },
    { x: 42, y: -18 },
    { x: 0, y: -68 },
    { x: -68, y: 8 },
    { x: 68, y: 8 },
    { x: -42, y: 52 },
    { x: 42, y: 52 },
    { x: 0, y: 96 }
  ],
  library: [
    { x: 0, y: 0 },
    { x: 44, y: -18 },
    { x: 44, y: 18 },
    { x: -50, y: 0 },
    { x: 0, y: 52 },
    { x: -18, y: -48 },
    { x: 72, y: 0 },
    { x: -52, y: 48 },
    { x: 52, y: 54 },
    { x: 0, y: 88 }
  ],
  fullstack: [
    { x: 0, y: 0 },
    { x: -36, y: -24 },
    { x: 36, y: -24 },
    { x: 0, y: -64 },
    { x: 68, y: 0 },
    { x: -68, y: 0 },
    { x: 0, y: 64 },
    { x: 68, y: 50 },
    { x: -68, y: 50 },
    { x: 0, y: 100 }
  ],
  monorepo: [
    { x: 0, y: 0 },
    { x: -32, y: -22 },
    { x: 32, y: -22 },
    { x: 0, y: 34 },
    { x: -72, y: -10 },
    { x: 72, y: -10 },
    { x: -72, y: 42 },
    { x: 72, y: 42 },
    { x: 0, y: 78 },
    { x: 0, y: -74 }
  ],
  unknown: []
};
function getLanguageShare(repo, names) {
  const languageNames = new Set(names.map((name2) => name2.toLowerCase()));
  return repo.languages.reduce((sum, language) => languageNames.has(language.name.toLowerCase()) ? sum + language.share : sum, 0);
}
function classifyRepoArchetype(repo) {
  const modulesText = repo.modules.map((mod) => `${mod.name} ${mod.path}`.toLowerCase()).join(" ");
  const hasTextHint = (...hints) => hints.some((hint) => modulesText.includes(hint));
  const hasAppsRoot = hasTextHint("apps/");
  const hasPackagesRoot = hasTextHint("packages/");
  const hasServicesRoot = hasTextHint("services/");
  const hasWorkspaceConfig = hasTextHint("pnpm-workspace", "turbo.json", "nx.json", "workspace");
  const hasBackendHints = hasTextHint("api/", "server/", "routes/", "controllers/", "db/", "migrations/");
  const hasFrontendRoots = hasTextHint("frontend/", "public/", "components/", "pages/", "web/", "client/");
  const hasFrontendSurfaceHints = hasTextHint("ui/", "stories/", "storybook", "styles/", "assets/", "icons/");
  const appCount = repo.modules.filter((mod) => mod.kind === "app").length;
  const serviceCount = repo.modules.filter((mod) => mod.kind === "service").length;
  const packageCount = repo.modules.filter((mod) => mod.kind === "package").length;
  const testsCount = repo.modules.filter((mod) => mod.kind === "tests").length;
  const frontendLanguageShare = getLanguageShare(
    repo,
    ["TypeScript", "JavaScript", "TSX", "JSX", "CSS", "HTML", "SCSS", "Sass", "Less", "MDX", "Vue", "Svelte"]
  );
  const frontendMarkupShare = getLanguageShare(
    repo,
    ["CSS", "HTML", "SCSS", "Sass", "Less", "MDX", "Vue", "Svelte"]
  );
  const looksFrontendByLanguage = frontendLanguageShare >= 0.68 && frontendMarkupShare >= 0.18 && (hasFrontendRoots || hasFrontendSurfaceHints);
  const workspaceRootCount = [hasAppsRoot, hasPackagesRoot, hasServicesRoot].filter(Boolean).length;
  if (workspaceRootCount >= 2 || hasWorkspaceConfig || packageCount >= 3 && repo.modules.length >= 5) {
    return "monorepo";
  }
  if (appCount > 0 && serviceCount > 0) {
    return "fullstack";
  }
  if (serviceCount > 0 || hasBackendHints) {
    return "backend";
  }
  if (appCount > 0 || hasFrontendRoots || looksFrontendByLanguage) {
    return "frontend";
  }
  if (packageCount > 0 && testsCount > 0 && repo.modules.length <= 4 && frontendMarkupShare < 0.18) {
    return "library";
  }
  return repo.archetype;
}
function computeConnectivityScores(repo) {
  const scores = new Map(repo.modules.map((mod) => [mod.id, 0]));
  repo.dependencyEdges.forEach((edge) => {
    scores.set(edge.fromModuleId, (scores.get(edge.fromModuleId) ?? 0) + edge.weight);
    scores.set(edge.toModuleId, (scores.get(edge.toModuleId) ?? 0) + edge.weight * 0.85);
  });
  return scores;
}
function getHubPriority(mod, archetype2) {
  const override = HUB_PRIORITY_BY_ARCHETYPE[archetype2][mod.kind];
  return override ?? DEFAULT_HUB_PRIORITY[mod.kind];
}
function orderModulesForLayout(modules2, archetype2, connectivityScores) {
  return [...modules2].sort((a, b) => {
    const aScore = getHubPriority(a, archetype2) - (connectivityScores.get(a.id) ?? 0) * 1.1 - a.importanceScore / 140 + (a.kind === "app" || a.kind === "service" ? a.riskScore / 180 : 0);
    const bScore = getHubPriority(b, archetype2) - (connectivityScores.get(b.id) ?? 0) * 1.1 - b.importanceScore / 140 + (b.kind === "app" || b.kind === "service" ? b.riskScore / 180 : 0);
    return aScore - bScore || b.importanceScore - a.importanceScore || a.name.localeCompare(b.name);
  });
}
function computeLayoutPositions(archetype2, count) {
  if (count <= 1) {
    return [{ x: 0, y: 0 }];
  }
  const template = ARCHETYPE_LAYOUT_SLOTS[archetype2];
  if (template.length >= count) {
    return template.slice(0, count);
  }
  const positions = [];
  const spacing = 55;
  if (count <= 4) {
    const cols = 2;
    for (let index = 0; index < count; index += 1) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions.push({
        x: (col - (cols - 1) / 2) * spacing,
        y: (row - Math.floor((count - 1) / cols / 2)) * spacing
      });
    }
    return positions;
  }
  positions.push({ x: 0, y: 0 });
  const outerCount = count - 1;
  const angleStep = 2 * Math.PI / outerCount;
  const radius = spacing * 1.1;
  for (let index = 0; index < outerCount; index += 1) {
    const angle = angleStep * index - Math.PI / 2;
    positions.push({
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius)
    });
  }
  return positions;
}
function planDistrictLayout(modules2, archetype2, connectivityScores) {
  const sortedModules = [...modules2].sort((a, b) => b.importanceScore - a.importanceScore);
  const activeModules = orderModulesForLayout(
    sortedModules.slice(0, 10),
    archetype2,
    connectivityScores
  );
  return {
    activeModules,
    positions: computeLayoutPositions(archetype2, activeModules.length)
  };
}
function clamp$1(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function calculateRepoModuleBaseHeat(module) {
  return clamp$1(Math.round(module.riskScore * 0.35 + module.activityScore * 0.18), 0, 100);
}
const MODULE_NAME_ALIASES = {
  src: "Source",
  ui: "UI",
  "ui-kit": "UI Kit",
  api: "API",
  db: "Data",
  ci: "CI",
  docs: "Docs",
  e2e: "E2E",
  infra: "Infra",
  frontend: "Frontend",
  worker: "Worker",
  shared: "Shared",
  tests: "Tests",
  examples: "Examples",
  migrations: "Migrations",
  web: "Web",
  auth: "Auth",
  admin: "Admin",
  workspace: "Workspace"
};
function humanizeModuleName(name2) {
  const key = name2.toLowerCase();
  const alias = MODULE_NAME_ALIASES[key];
  if (alias) {
    return alias;
  }
  return key.split(/[^a-z0-9]+/g).filter(Boolean).map((part) => part.length <= 2 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function makeId(prefix, ...parts) {
  const slug = parts.map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-")).join("-");
  return `${prefix}-${slug}`;
}
const REPO_SIGNAL_TYPES = [
  "failing_workflow",
  "open_issue",
  "open_pr",
  "merge_conflict",
  "security_alert",
  "issue_spike",
  "stale_pr",
  "flaky_tests",
  "dependency_drift",
  "latest_commit"
];
const BOT_ARCHETYPES = [
  "hallucination",
  "merge",
  "regression",
  "dependency",
  "type",
  "refactor",
  "saboteur"
];
const THREAT_TYPE_ALIASES = {
  ci_failure: "failing_workflow",
  ci_failures: "failing_workflow",
  failing_ci: "failing_workflow",
  failing_pipeline: "failing_workflow",
  vulnerable_dependency: "security_alert"
};
const DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE = {
  descriptionTemplate: "Reach the encounter point, hold the route open, and prepare to restore district stability.",
  objectiveTemplates: [
    "Approach the active threat",
    "Hold the route open to the encounter point",
    "Enter the arena and neutralize the AI boss"
  ]
};
const DEFAULT_THREAT_TEMPLATE = {
  id: "generic-threat-sweep",
  encounterName: "Threat Sweep",
  summary: "A hostile pressure signature has surfaced. Read the pattern and stabilize the district without treating the repo as literal code.",
  arenaTheme: "An abstract maintenance corridor with shifting safe zones and relay anchors.",
  objective: "Claim stable ground, identify the hostile pattern, and clear the pressure wave before it hardens.",
  tone: "triage",
  mechanicHints: [
    {
      key: "anchor-control",
      label: "Anchor Control",
      description: "Capture stable anchors to keep the encounter readable while the pressure pattern shifts around you."
    }
  ],
  phases: [
    {
      key: "sweep",
      label: "Pattern Sweep",
      objective: "Read the room and mark the safest route through the pressure field.",
      pressure: "The hostile signal moves before it commits, forcing quick but readable choices."
    }
  ],
  introScene: "the district relay",
  victoryState: "the district settles into a controllable rhythm",
  failureState: "the pressure pattern takes over the playable space",
  tags: ["fallback", "abstract"]
};
const BATTLE_THREAT_TEMPLATES = {
  merge_conflict: {
    id: "merge-conflict-branch-deadlock",
    encounterName: "Branch Deadlock",
    summary: "Two incompatible route states are colliding in the district. Untangle the overlap and restore one readable path without acting out a literal merge tool.",
    arenaTheme: "A branch nexus of mirrored rails, crossing signal bridges, and lock gates that only open when one clean lane is stabilized.",
    objective: "Separate the crossing routes, preserve the clean anchor points, and reopen one stable branch corridor.",
    tone: "pressure",
    mechanicHints: [
      {
        key: "lane-separation",
        label: "Lane Separation",
        description: "Keep competing routes apart until the stable branch is obvious enough to lock in."
      },
      {
        key: "anchor-lock",
        label: "Anchor Lock",
        description: "Claim steady anchors before the crossing waves overlap again and hide the safe line."
      }
    ],
    phases: [
      {
        key: "collision-read",
        label: "Read the Collision",
        objective: "Trace where the two route states cross before either branch hardens into a deadlock.",
        pressure: "Crossing lanes pulse at different tempos and briefly erase the safe route."
      },
      {
        key: "lock-the-branch",
        label: "Lock the Clean Branch",
        objective: "Hold the stable path long enough for the conflicting lane to collapse out of the room.",
        pressure: "Residual branch echoes keep trying to re-open the rejected route."
      }
    ],
    introScene: "the branch nexus",
    victoryState: "one clean route stays open and the district can move again",
    failureState: "the room freezes into a full branch deadlock",
    tags: ["merge", "conflict", "boss-template"]
  },
  security_alert: {
    id: "security-alert-quarantine",
    encounterName: "Quarantine Breach",
    summary: "A corrupted supply route is leaking pressure through the district. The encounter stays metaphorical: contain the breach, do not simulate literal exploit details.",
    arenaTheme: "A dependency vault threaded with scan gates, sealed relay doors, and short quarantine lanes.",
    objective: "Contain the breach, route clean packets through the chamber, and lock the poisoned lane before it spreads.",
    tone: "containment",
    mechanicHints: [
      {
        key: "quarantine-window",
        label: "Quarantine Window",
        description: "Safe lanes open in short cycles. Move only when the scanner confirms a clean pass."
      },
      {
        key: "clean-route",
        label: "Clean Route",
        description: "Link trusted anchors together to weaken the breach without representing literal dependency code."
      }
    ],
    phases: [
      {
        key: "containment-sweep",
        label: "Containment Sweep",
        objective: "Tag unstable nodes before the breach reaches neighboring lanes.",
        pressure: "Quarantine barriers pulse open and closed in short intervals."
      },
      {
        key: "seal-route",
        label: "Seal the Supply Path",
        objective: "Lock the poisoned route and reopen the clean lane.",
        pressure: "Corrupted echoes try to reopen sealed paths once the room stabilizes."
      }
    ],
    introScene: "the dependency vault",
    victoryState: "the quarantine grid becomes readable enough for traffic to flow again",
    failureState: "the contaminated route spreads into adjacent lanes",
    tags: ["security", "supply-chain", "threat-template"]
  },
  failing_workflow: {
    id: "workflow-pipeline-jam",
    encounterName: "Pipeline Jam",
    summary: "Automation has stalled in a noisy corridor. The battle is about restoring readable flow, not acting out literal CI internals.",
    arenaTheme: "A workflow relay chamber with frozen conveyor rails, sync lights, and blinking checkpoint pylons.",
    objective: "Re-sequence the relay pulses, clear false interrupts, and reopen the district route before the corridor locks down.",
    tone: "stabilization",
    mechanicHints: [
      {
        key: "sync-window",
        label: "Sync Window",
        description: "Progress only during stable pulse windows or the relay will kick back additional noise."
      },
      {
        key: "interrupt-clear",
        label: "Interrupt Clear",
        description: "Reset false interrupts at side pylons to keep the central route playable and legible."
      }
    ],
    phases: [
      {
        key: "bootstrap-relay",
        label: "Bootstrap Relay",
        objective: "Bring the stalled checkpoints back online in the right order.",
        pressure: "Out-of-sequence pulses create moving dead zones across the arena."
      },
      {
        key: "release-pulse",
        label: "Release Pulse",
        objective: "Hold the stabilized channel long enough for the route to reopen.",
        pressure: "Noise surges try to desync the corridor once the flow is nearly restored."
      }
    ],
    introScene: "the workflow relay",
    victoryState: "signal flow steadies enough for the route to carry traffic again",
    failureState: "the corridor collapses into a full stop",
    tags: ["workflow", "tempo", "threat-template"]
  }
};
const BOT_ARCHETYPE_OVERLAYS = {
  hallucination: {
    enemyRole: "Hallucination Bot",
    pressureModifier: "false certainty mirages and decoy routes",
    victoryAction: "disprove the fake route and pin the real signal in place",
    failureOutcome: "the arena fills with misleading paths that hide the clean line",
    tags: ["misdirection"]
  },
  merge: {
    enemyRole: "Merge Bot",
    pressureModifier: "colliding branch waves and lane overlaps",
    victoryAction: "separate the crossing routes and re-open one clean channel",
    failureOutcome: "the room locks into crossing hazards and route deadlocks",
    tags: ["collision"]
  },
  regression: {
    enemyRole: "Regression Bot",
    pressureModifier: "rollback shocks and repeating fault loops",
    victoryAction: "break the rollback loop and re-claim forward momentum",
    failureOutcome: "the district slides back into repeated instability",
    tags: ["rollback"]
  },
  dependency: {
    enemyRole: "Dependency Bot",
    pressureModifier: "poisoned supply pulses and contaminated relay bursts",
    victoryAction: "purge the contaminated route and restore the trusted chain",
    failureOutcome: "fresh lanes keep inheriting stale pressure from the breach",
    tags: ["supply-chain"]
  },
  type: {
    enemyRole: "Type Bot",
    pressureModifier: "schema locks and collapsing shape gates",
    victoryAction: "re-align the gates until the route becomes readable again",
    failureOutcome: "the district hardens into incompatible locked paths",
    tags: ["schema"]
  },
  refactor: {
    enemyRole: "Refactor Bot",
    pressureModifier: "shape-shifting corridors and disappearing landmarks",
    victoryAction: "pin down the stable structure before the room shifts again",
    failureOutcome: "the player loses the readable route as the layout keeps changing",
    tags: ["reframe"]
  },
  saboteur: {
    enemyRole: "Saboteur Bot",
    pressureModifier: "timed disruption spikes and broken relay cues",
    victoryAction: "break the sabotage loop and reclaim the signal anchors",
    failureOutcome: "the room stays trapped in noisy interrupts",
    tags: ["disruption"]
  }
};
function normalizeToken(value) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
function isRepoSignalType(value) {
  return REPO_SIGNAL_TYPES.includes(value);
}
function isBotArchetype(value) {
  return BOT_ARCHETYPES.includes(value);
}
function normalizeThreatType(threatType) {
  const normalized = normalizeToken(threatType);
  const aliased = THREAT_TYPE_ALIASES[normalized] ?? normalized;
  return isRepoSignalType(aliased) ? aliased : "unknown";
}
function normalizeBotArchetype(botArchetype) {
  const normalized = normalizeToken(botArchetype);
  return isBotArchetype(normalized) ? normalized : "unknown";
}
function cloneMechanic(mechanic) {
  return {
    key: mechanic.key,
    label: mechanic.label,
    description: mechanic.description
  };
}
function clonePhase(phase) {
  return {
    key: phase.key,
    label: phase.label,
    objective: phase.objective,
    pressure: phase.pressure
  };
}
function buildCopy(threatTemplate, botOverlay) {
  return {
    intro: `${botOverlay.enemyRole} is twisting ${threatTemplate.introScene} with ${botOverlay.pressureModifier}.`,
    victory: `The district settles once you ${botOverlay.victoryAction}, and ${threatTemplate.victoryState}.`,
    failure: `If ${botOverlay.enemyRole} keeps control, ${botOverlay.failureOutcome} and ${threatTemplate.failureState}.`
  };
}
function dedupeTags(...groups) {
  return [...new Set(groups.flat())];
}
function buildBossRouteEscalationLine(escalationCount) {
  if (typeof escalationCount === "number" && escalationCount > 1) {
    return `This boss route condenses ${escalationCount} high-pressure reports into one escalation point.`;
  }
  return "This boss route marks the district's highest-pressure escalation point.";
}
function getBattleTemplate(threatType, botArchetype) {
  const normalizedThreatType = normalizeThreatType(threatType);
  const normalizedBotArchetype = normalizeBotArchetype(botArchetype);
  const threatTemplate = normalizedThreatType === "unknown" ? DEFAULT_THREAT_TEMPLATE : BATTLE_THREAT_TEMPLATES[normalizedThreatType] ?? DEFAULT_THREAT_TEMPLATE;
  const botOverlay = normalizedBotArchetype === "unknown" ? BOT_ARCHETYPE_OVERLAYS.saboteur : BOT_ARCHETYPE_OVERLAYS[normalizedBotArchetype];
  return {
    id: `${threatTemplate.id}__${normalizedBotArchetype}`,
    threatType: normalizedThreatType,
    botArchetype: normalizedBotArchetype,
    encounterName: threatTemplate.encounterName,
    enemyRole: botOverlay.enemyRole,
    summary: `${threatTemplate.summary} Enemy pressure comes through ${botOverlay.pressureModifier}.`,
    arenaTheme: threatTemplate.arenaTheme,
    objective: threatTemplate.objective,
    tone: threatTemplate.tone,
    mechanicHints: [
      ...threatTemplate.mechanicHints.map(cloneMechanic),
      {
        key: "enemy-pressure",
        label: "Enemy Pressure",
        description: `Expect ${botOverlay.pressureModifier} while you work the room back into a readable state.`
      }
    ],
    phases: threatTemplate.phases.map(clonePhase),
    copy: buildCopy(threatTemplate, botOverlay),
    tags: dedupeTags(
      normalizedThreatType === "unknown" ? ["unknown-threat"] : [normalizedThreatType],
      normalizedBotArchetype === "unknown" ? ["unknown-bot"] : [normalizedBotArchetype],
      threatTemplate.tags,
      botOverlay.tags
    )
  };
}
function buildBossMissionRouteCopy(districtLabel, threatType, botArchetype, escalationCount) {
  const battleTemplate = getBattleTemplate(threatType, botArchetype);
  const [approachObjective, routeObjective, resolutionObjective] = DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE.objectiveTemplates;
  return {
    title: `BOSS: ${battleTemplate.encounterName} at ${districtLabel}`,
    description: [
      `An AI boss is destabilizing ${districtLabel}.`,
      DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE.descriptionTemplate,
      buildBossRouteEscalationLine(escalationCount)
    ].join(" "),
    objectives: [
      `${approachObjective} in ${districtLabel}`,
      routeObjective,
      resolutionObjective
    ]
  };
}
const SIGNAL_MISSION_TEMPLATES = {
  failing_workflow: {
    titlePrefix: "Defend",
    type: "defense",
    descriptionTemplate: "The deployment pipeline is under attack. Hold the control terminal until the workflow stabilizes.",
    objectiveTemplates: ["Reach the control terminal", "Defend the pipeline", "Restore workflow stability"],
    baseDifficulty: 3
  },
  open_issue: {
    titlePrefix: "Stabilize",
    type: "recovery",
    descriptionTemplate: "Open issues are piling up in the district. Recover clean artifacts before the queue overruns the maintainers.",
    objectiveTemplates: ["Assess incoming issue reports", "Recover clean artifacts", "Restore district stability"],
    baseDifficulty: 2
  },
  merge_conflict: {
    titlePrefix: "BOSS: Stabilize",
    type: "boss",
    descriptionTemplate: DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE.descriptionTemplate,
    objectiveTemplates: [...DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE.objectiveTemplates],
    baseDifficulty: 4
  },
  open_pr: {
    titlePrefix: "Deliver",
    type: "delivery",
    descriptionTemplate: "Multiple pull requests need triage. Carry verified patches to the review terminal before the queue overflows.",
    objectiveTemplates: ["Collect pending patches", "Navigate to the review terminal", "Deliver before timeout"],
    baseDifficulty: 2
  },
  security_alert: {
    titlePrefix: "Purge",
    type: "defense",
    descriptionTemplate: "A security vulnerability has been detected. Purge the compromised dependency before it spreads.",
    objectiveTemplates: ["Locate the vulnerability", "Isolate the affected module", "Apply the security patch"],
    baseDifficulty: 4
  },
  issue_spike: {
    titlePrefix: "Stabilize",
    type: "recovery",
    descriptionTemplate: "A spike in reported issues is destabilizing the district. Recover clean artifacts before corruption spreads.",
    objectiveTemplates: ["Assess the damage", "Recover clean artifacts", "Restore district stability"],
    baseDifficulty: 3
  },
  stale_pr: {
    titlePrefix: "Recover",
    type: "recovery",
    descriptionTemplate: "A stale pull request has been abandoned in the district. Retrieve the useful changes before they rot.",
    objectiveTemplates: ["Locate the stale PR", "Salvage useful changes", "Clean up the branch"],
    baseDifficulty: 1
  },
  flaky_tests: {
    titlePrefix: "Sabotage Hunt",
    type: "escape",
    descriptionTemplate: "Flaky tests are masking real failures. Track down the saboteur bot before the test suite becomes meaningless.",
    objectiveTemplates: ["Identify flaky tests", "Track the saboteur", "Escape before the suite locks down"],
    baseDifficulty: 3
  },
  dependency_drift: {
    titlePrefix: "Supply Run",
    type: "delivery",
    descriptionTemplate: "Dependencies have drifted out of date. Deliver fresh packages to the module before incompatibilities cascade.",
    objectiveTemplates: ["Collect updated packages", "Navigate dependency graph", "Apply updates safely"],
    baseDifficulty: 2
  }
};
const DEFAULT_BOT_PROFILE = {
  archetype: "saboteur",
  names: ["Repo Saboteur", "Threat Proxy", "Intrusion Wraith"]
};
const SIGNAL_TO_BOT_PROFILE = {
  failing_workflow: {
    archetype: "saboteur",
    names: ["Pipeline Wrecker", "Deploy Jammer", "CI Gremlin"]
  },
  open_issue: {
    archetype: "regression",
    names: ["Bug Swarm", "Rollback Runner", "Backlog Shade"]
  },
  merge_conflict: {
    archetype: "merge",
    names: ["Conflict Core", "Branch Breaker", "Rebase Raider"]
  },
  open_pr: {
    archetype: "hallucination",
    names: ["Review Phantom", "Patch Spammer", "Approval Mirage"]
  },
  security_alert: {
    archetype: "dependency",
    names: ["Package Poisoner", "Vulnerability Leech", "Supply Chain Ghost"]
  },
  issue_spike: {
    archetype: "regression",
    names: ["Escalation Hydra", "Regression Agent", "Bug Surge"]
  },
  stale_pr: {
    archetype: "refactor",
    names: ["Branch Hoarder", "Review Fossil", "Cleanup Mirage"]
  },
  flaky_tests: {
    archetype: "saboteur",
    names: ["Test Saboteur", "Spec Scrambler", "Assertion Ghost"]
  },
  dependency_drift: {
    archetype: "dependency",
    names: ["Dependency Drifter", "Version Leech", "Outdated Package Phantom"]
  }
};
const HIGH_SEVERITY_BOSS_THRESHOLD = 4;
const SIGNAL_MISSION_COPY = {
  failing_workflow: {
    singular: "failing workflow",
    plural: "failing workflows",
    missionVerb: "Stabilize",
    objectiveVerb: "Audit"
  },
  open_issue: {
    singular: "open issue",
    plural: "open issues",
    missionVerb: "Clear",
    objectiveVerb: "Audit"
  },
  open_pr: {
    singular: "open pull request",
    plural: "open pull requests",
    missionVerb: "Review",
    objectiveVerb: "Inspect"
  },
  merge_conflict: {
    singular: "route deadlock alert",
    plural: "route deadlock alerts",
    missionVerb: "Stabilize",
    objectiveVerb: "Approach"
  },
  security_alert: {
    singular: "security alert",
    plural: "security alerts",
    missionVerb: "Purge",
    objectiveVerb: "Trace"
  },
  issue_spike: {
    singular: "issue spike",
    plural: "issue spikes",
    missionVerb: "Contain",
    objectiveVerb: "Audit"
  },
  stale_pr: {
    singular: "stale pull request",
    plural: "stale pull requests",
    missionVerb: "Recover",
    objectiveVerb: "Locate"
  },
  flaky_tests: {
    singular: "flaky test alert",
    plural: "flaky test alerts",
    missionVerb: "Trace",
    objectiveVerb: "Track"
  },
  dependency_drift: {
    singular: "dependency drift alert",
    plural: "dependency drift alerts",
    missionVerb: "Refresh",
    objectiveVerb: "Inventory"
  },
  latest_commit: {
    singular: "latest commit",
    plural: "latest commits",
    missionVerb: "Inspect",
    objectiveVerb: "Trace"
  }
};
function getMissionTemplate(signalType) {
  return SIGNAL_MISSION_TEMPLATES[signalType] ?? null;
}
function getBotProfile(signalType) {
  return SIGNAL_TO_BOT_PROFILE[signalType] ?? DEFAULT_BOT_PROFILE;
}
function isActionableSignal(signal) {
  return signal.severity > 0 && getMissionTemplate(signal.type) !== null;
}
function pluralizeLabel(count, singular, plural) {
  return count === 1 ? singular : plural;
}
function summarizeSignalGroup(group) {
  const copy = SIGNAL_MISSION_COPY[group.type];
  if (group.signals.length === 1) {
    const [signal] = group.signals;
    const title = signal.title?.trim();
    if (title) {
      return title;
    }
    if (typeof signal.value === "number" && Number.isFinite(signal.value) && signal.value > 0) {
      return `${signal.value} ${pluralizeLabel(signal.value, copy.singular, copy.plural)}`;
    }
    return `1 ${copy.singular}`;
  }
  const aggregateValue = group.signals.reduce((sum, signal) => typeof signal.value === "number" && Number.isFinite(signal.value) && signal.value > 0 ? sum + signal.value : sum, 0);
  if (aggregateValue > 0) {
    return `${aggregateValue} ${pluralizeLabel(aggregateValue, copy.singular, copy.plural)}`;
  }
  return `${group.signals.length} ${pluralizeLabel(group.signals.length, copy.singular, copy.plural)}`;
}
function getGroupedSignalThreatLevel(group) {
  return Math.min(
    5,
    group.maxSeverity + Math.min(1, Math.max(0, group.signals.length - 1))
  );
}
function buildSignalHighlights(group) {
  const titles = [...new Set(
    group.signals.map((signal) => signal.title?.trim()).filter((title) => Boolean(title))
  )];
  if (titles.length <= 1) {
    return null;
  }
  if (titles.length === 2) {
    return `Priority reports: ${titles[0]} and ${titles[1]}.`;
  }
  return `Priority reports: ${titles[0]}, ${titles[1]}, and ${titles.length - 2} more.`;
}
function groupActionableSignals(signals2) {
  const groups = /* @__PURE__ */ new Map();
  signals2.filter(isActionableSignal).forEach((signal) => {
    const key = `${signal.type}::${signal.target}`;
    const existing = groups.get(key);
    if (existing) {
      existing.signals.push(signal);
      existing.maxSeverity = Math.max(existing.maxSeverity, signal.severity);
      return;
    }
    groups.set(key, {
      type: signal.type,
      target: signal.target,
      signals: [signal],
      maxSeverity: signal.severity
    });
  });
  return [...groups.values()].map((group) => ({
    ...group,
    signals: [...group.signals].sort(
      (left, right) => right.severity - left.severity || (left.title ?? "").localeCompare(right.title ?? "")
    )
  })).sort(
    (left, right) => right.maxSeverity - left.maxSeverity || right.signals.length - left.signals.length || left.type.localeCompare(right.type) || left.target.localeCompare(right.target)
  );
}
function getActionableSignalGroupKey(group) {
  return `${group.type}::${group.target}`;
}
function isBossEscalationSignalGroup(group) {
  return group.type === "merge_conflict" || group.maxSeverity >= HIGH_SEVERITY_BOSS_THRESHOLD;
}
function shouldPreferBossEscalationGroup(candidate, current) {
  const candidateIsMergeConflict = candidate.type === "merge_conflict";
  const currentIsMergeConflict = current.type === "merge_conflict";
  if (candidateIsMergeConflict !== currentIsMergeConflict) {
    return candidateIsMergeConflict;
  }
  return candidate.maxSeverity > current.maxSeverity || candidate.maxSeverity === current.maxSeverity && (candidate.signals.length > current.signals.length || candidate.signals.length === current.signals.length && candidate.type.localeCompare(current.type) < 0);
}
function selectBossEscalationGroupKeys(groups) {
  const selectedGroupsByTarget = /* @__PURE__ */ new Map();
  groups.forEach((group) => {
    if (!isBossEscalationSignalGroup(group)) {
      return;
    }
    const current = selectedGroupsByTarget.get(group.target);
    if (!current || shouldPreferBossEscalationGroup(group, current)) {
      selectedGroupsByTarget.set(group.target, group);
    }
  });
  return new Set(
    [...selectedGroupsByTarget.values()].map((group) => getActionableSignalGroupKey(group))
  );
}
function buildSignalDrivenMissionTitle(group, districtLabel, isBossEncounter) {
  if (isBossEncounter) {
    const botProfile = getBotProfile(group.type);
    return buildBossMissionRouteCopy(districtLabel, group.type, botProfile.archetype, group.signals.length).title;
  }
  const copy = SIGNAL_MISSION_COPY[group.type];
  return `${copy.missionVerb} ${summarizeSignalGroup(group)} at ${districtLabel}`;
}
function buildSignalDrivenMissionDescription(group, districtLabel, template) {
  const copy = SIGNAL_MISSION_COPY[group.type];
  const [primarySignal] = group.signals;
  const detail = primarySignal.detail?.trim();
  const highlights = buildSignalHighlights(group);
  const summary = summarizeSignalGroup(group);
  const mappedSignalLine = group.signals.length > 1 ? `This mission condenses ${group.signals.length} mapped ${copy.plural} into one readable batch.` : `This mission is rooted in one mapped ${copy.singular} signal.`;
  const descriptionParts = [
    `${districtLabel} is reacting to ${summary}.`,
    template.descriptionTemplate
  ];
  if (detail && detail !== template.descriptionTemplate) {
    descriptionParts.push(`Signal report: ${detail}`);
  }
  if (highlights) {
    descriptionParts.push(highlights);
  }
  descriptionParts.push(mappedSignalLine);
  return descriptionParts.join(" ");
}
function buildSignalDrivenMissionObjectives(group, districtLabel, template) {
  const copy = SIGNAL_MISSION_COPY[group.type];
  const objectives = [...template.objectiveTemplates];
  objectives[0] = `${copy.objectiveVerb} ${summarizeSignalGroup(group)} mapped to ${districtLabel}`;
  return objectives;
}
function buildBossSignalDrivenMissionDescription(group, districtLabel, botArchetype) {
  return buildBossMissionRouteCopy(districtLabel, group.type, botArchetype, group.signals.length).description;
}
function buildBossSignalDrivenMissionObjectives(group, districtLabel, botArchetype) {
  return buildBossMissionRouteCopy(districtLabel, group.type, botArchetype, group.signals.length).objectives;
}
function generateSignalDrivenMissions(repo, districts, signals2) {
  const groupedSignals = groupActionableSignals(signals2);
  const bossEscalationGroupKeys = selectBossEscalationGroupKeys(groupedSignals);
  return groupedSignals.flatMap((group) => {
    const template = getMissionTemplate(group.type);
    if (!template) {
      return [];
    }
    const targetDistrict = districts.find((district) => district.moduleId === group.target);
    const districtId = targetDistrict?.id ?? districts[0]?.id ?? "unknown";
    const districtLabel = targetDistrict?.label ?? targetDistrict?.name ?? humanizeModuleName(group.target);
    const botProfile = getBotProfile(group.type);
    const isBossEncounter = bossEscalationGroupKeys.has(getActionableSignalGroupKey(group));
    const effectiveSeverity = getGroupedSignalThreatLevel(group);
    const baseDifficulty = Math.min(5, Math.max(1, Math.round(
      (template.baseDifficulty + effectiveSeverity) / 2
    )));
    const difficulty = isBossEncounter ? Math.max(4, baseDifficulty) : baseDifficulty;
    return [{
      id: makeId("mission", repo.repoId, group.type, group.target),
      districtId,
      title: buildSignalDrivenMissionTitle(group, districtLabel, isBossEncounter),
      type: isBossEncounter ? "boss" : template.type,
      difficulty,
      sourceSignalType: group.type,
      targetRef: group.target,
      description: isBossEncounter ? buildBossSignalDrivenMissionDescription(group, districtLabel, botProfile.archetype) : buildSignalDrivenMissionDescription(group, districtLabel, template),
      objectives: isBossEncounter ? buildBossSignalDrivenMissionObjectives(group, districtLabel, botProfile.archetype) : buildSignalDrivenMissionObjectives(group, districtLabel, template)
    }];
  });
}
function generateSignalDrivenBots(repo, districts, signals2) {
  const profileUsageBySignalType = /* @__PURE__ */ new Map();
  return groupActionableSignals(signals2).map((group) => {
    const profile = getBotProfile(group.type);
    const targetDistrict = districts.find((district) => district.moduleId === group.target);
    const districtId = targetDistrict?.id ?? districts[0]?.id ?? "unknown";
    const profileUsage = profileUsageBySignalType.get(group.type) ?? 0;
    const names = profile.names.length > 0 ? profile.names : DEFAULT_BOT_PROFILE.names;
    const name2 = names[profileUsage % names.length];
    profileUsageBySignalType.set(group.type, profileUsage + 1);
    return {
      id: makeId("bot", repo.repoId, group.type, group.target),
      archetype: profile.archetype,
      name: name2,
      districtId,
      sourceSignalType: group.type,
      targetRef: group.target,
      threatLevel: getGroupedSignalThreatLevel(group)
    };
  });
}
const KIND_TO_CATEGORY = {
  app: "interface",
  package: "shared",
  service: "service",
  folder: "data",
  infra: "ops",
  tests: "validation",
  docs: "archive",
  control: "control"
};
const KIND_TO_LABEL_PREFIX = {
  app: "Interface Quarter",
  package: "Shared Core",
  service: "Service Hub",
  folder: "Data Sector",
  infra: "Control Tower",
  tests: "Validation Ring",
  docs: "Archive Sector",
  control: "Command Center"
};
const DISTRICT_COLORS = [
  { color: "#61DAFB", emissive: "#00BFFF" },
  { color: "#FF6B35", emissive: "#FF4500" },
  { color: "#FFD43B", emissive: "#FFD700" },
  { color: "#00ADD8", emissive: "#00CED1" },
  { color: "#3178C6", emissive: "#4169E1" },
  { color: "#A855F7", emissive: "#9333EA" },
  { color: "#10B981", emissive: "#059669" },
  { color: "#F43F5E", emissive: "#E11D48" },
  { color: "#8B5CF6", emissive: "#7C3AED" },
  { color: "#F59E0B", emissive: "#D97706" }
];
function moduleMatchesHints(mod, hints) {
  const haystack = `${mod.name} ${mod.path}`.toLowerCase();
  return hints.some((hint) => haystack.includes(hint));
}
function computeFootprint(mod, connectivityScore, archetype2) {
  const base = archetype2 === "library" ? 24 : archetype2 === "monorepo" ? 30 : 28;
  const scale = clamp(
    0.72 + mod.importanceScore / 170 + connectivityScore * 0.14 + (mod.kind === "package" ? 0.08 : 0),
    0.72,
    1.38
  );
  const width = Math.round(base * scale);
  const heightScale = mod.kind === "service" ? 1.08 : mod.kind === "docs" ? 0.88 : 1;
  return {
    width,
    height: Math.round(width * heightScale)
  };
}
function deriveHeat(mod, signals2) {
  if (typeof mod.heatScore === "number") {
    return clamp(Math.round(mod.heatScore), 0, 100);
  }
  const signalHeat = signals2.filter((signal) => signal.target === mod.id && isActionableSignal(signal)).reduce((sum, signal) => sum + signal.severity * 12, 0);
  return clamp(Math.round(calculateRepoModuleBaseHeat(mod) + signalHeat), 0, 100);
}
function generateBuildings(mod) {
  const buildings = [];
  const moduleName = humanizeModuleName(mod.name);
  if (mod.kind === "app" || mod.kind === "service") {
    buildings.push({
      id: `bld-${mod.id}-gate`,
      label: `${moduleName} Gateway`,
      kind: "gate",
      fileCount: Math.ceil(mod.fileCount * 0.15)
    });
  }
  buildings.push({
    id: `bld-${mod.id}-main`,
    label: `${moduleName} Core`,
    kind: "cluster",
    fileCount: Math.ceil(mod.fileCount * 0.6)
  });
  if (mod.kind === "tests") {
    buildings.push({
      id: `bld-${mod.id}-shield`,
      label: "Test Shield",
      kind: "shield",
      fileCount: Math.ceil(mod.fileCount * 0.25)
    });
  }
  if (mod.kind === "infra" || mod.kind === "control") {
    buildings.push({
      id: `bld-${mod.id}-infra`,
      label: "Infra Node",
      kind: "infra",
      fileCount: Math.ceil(mod.fileCount * 0.25)
    });
  }
  if (mod.fileCount > 10 && mod.kind !== "tests" && mod.kind !== "infra") {
    buildings.push({
      id: `bld-${mod.id}-terminal`,
      label: `${moduleName} Terminal`,
      kind: "terminal",
      fileCount: Math.ceil(mod.fileCount * 0.25)
    });
  }
  return buildings;
}
function buildDistrictLabelPrefix(mod, archetype2) {
  if (moduleMatchesHints(mod, ["shared", "packages/", "package", "lib/"]) || mod.kind === "package") {
    if (archetype2 === "monorepo") {
      return "Workspace Core";
    }
    return archetype2 === "library" ? "Library Core" : "Shared Core";
  }
  if (moduleMatchesHints(mod, ["frontend", "web/", "ui", "client", "public/", "pages/", "components/"]) || mod.kind === "app") {
    if (archetype2 === "monorepo") {
      return "App Ring";
    }
    return archetype2 === "frontend" ? "Interface Quarter" : "Client Quarter";
  }
  if (moduleMatchesHints(mod, ["worker", "api/", "server/", "backend", "routes/", "controllers/"]) || mod.kind === "service") {
    return archetype2 === "backend" ? "Runtime Bastion" : "Service Spine";
  }
  if (moduleMatchesHints(mod, ["db", "data", "migration"]) || mod.kind === "folder") {
    return "Data Vault";
  }
  if (moduleMatchesHints(mod, ["test", "spec", "qa"]) || mod.kind === "tests") {
    return "Validation Ring";
  }
  if (moduleMatchesHints(mod, [".github", "ci", "infra", "ops"]) || mod.kind === "infra" || mod.kind === "control") {
    if (archetype2 === "monorepo") {
      return "Workspace Control";
    }
    return archetype2 === "library" ? "Release Gate" : "Control Tower";
  }
  if (moduleMatchesHints(mod, ["example", "storybook"]) || mod.kind === "docs" && archetype2 === "library") {
    return "Example Arcade";
  }
  if (moduleMatchesHints(mod, ["docs"]) || mod.kind === "docs") {
    return "Archive Sector";
  }
  return KIND_TO_LABEL_PREFIX[mod.kind] ?? "Sector";
}
function buildDistrictLabel(mod, archetype2) {
  return `${buildDistrictLabelPrefix(mod, archetype2)}: ${humanizeModuleName(mod.name)}`;
}
function buildDistrictDescription(repo, mod, archetype2, connectivityScore) {
  const districtRole = connectivityScore >= 1.5 ? "core junction" : mod.kind === "app" || mod.kind === "service" ? "frontline district" : "support district";
  return `${humanizeModuleName(mod.name)} is the ${districtRole} for ${repo.owner}/${repo.name} (${archetype2}) — ${mod.path}`;
}
function buildGeneratedDistricts(repo, activeModules, archetype2, positions, connectivityScores) {
  const maxFileCount = Math.max(1, ...activeModules.map((mod) => mod.fileCount));
  return activeModules.map((mod, index) => {
    const connectivityScore = connectivityScores.get(mod.id) ?? 0;
    const palette = DISTRICT_COLORS[index % DISTRICT_COLORS.length];
    return {
      id: makeId("dist", repo.repoId, mod.id),
      moduleId: mod.id,
      name: humanizeModuleName(mod.name),
      label: buildDistrictLabel(mod, archetype2),
      description: buildDistrictDescription(repo, mod, archetype2, connectivityScore),
      category: KIND_TO_CATEGORY[mod.kind] ?? "shared",
      color: palette.color,
      emissive: palette.emissive,
      sizeScore: Math.round(mod.fileCount / maxFileCount * 100),
      heatLevel: deriveHeat(mod, repo.signals),
      riskLevel: mod.riskScore,
      position: positions[index] ?? { x: 0, y: 0 },
      footprint: computeFootprint(mod, connectivityScore, archetype2),
      buildings: generateBuildings(mod)
    };
  });
}
const ROAD_STYLE_BY_REASON = {
  import: { color: "#0f172a", emissive: "#38bdf8", baseWidth: 2.6 },
  package_dependency: { color: "#111827", emissive: "#f59e0b", baseWidth: 3.2 },
  service_link: { color: "#1f2937", emissive: "#f97316", baseWidth: 3.8 },
  folder_reference: { color: "#0b1120", emissive: "#8b5cf6", baseWidth: 2.2 }
};
function projectRoadAnchor(district, dx, dy) {
  const outwardX = dx === 0 ? 1 : Math.sign(dx);
  const outwardY = dy === 0 ? 1 : Math.sign(dy);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: Math.round((district.position.x + outwardX * (district.footprint.width / 2 + 2)) * 10) / 10,
      y: district.position.y
    };
  }
  return {
    x: district.position.x,
    y: Math.round((district.position.y + outwardY * (district.footprint.height / 2 + 2)) * 10) / 10
  };
}
function buildRoadPoints(fromDistrict, toDistrict) {
  const dx = toDistrict.position.x - fromDistrict.position.x;
  const dy = toDistrict.position.y - fromDistrict.position.y;
  const start = projectRoadAnchor(fromDistrict, dx, dy);
  const end = projectRoadAnchor(toDistrict, -dx, -dy);
  if (Math.abs(dx) < 10 || Math.abs(dy) < 10) {
    return [start, end];
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = Math.round((start.x + end.x) / 2 * 10) / 10;
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end
    ];
  }
  const midY = Math.round((start.y + end.y) / 2 * 10) / 10;
  return [
    start,
    { x: start.x, y: midY },
    { x: end.x, y: midY },
    end
  ];
}
function selectReadableEdges(archetype2, repo, activeModuleIds) {
  const outboundLimit = archetype2 === "monorepo" ? 3 : 2;
  const groupedEdges = /* @__PURE__ */ new Map();
  repo.dependencyEdges.forEach((edge) => {
    if (edge.fromModuleId === edge.toModuleId || !activeModuleIds.has(edge.fromModuleId) || !activeModuleIds.has(edge.toModuleId)) {
      return;
    }
    const current = groupedEdges.get(edge.fromModuleId) ?? [];
    current.push(edge);
    groupedEdges.set(edge.fromModuleId, current);
  });
  const dedupedEdges = /* @__PURE__ */ new Map();
  groupedEdges.forEach((edges) => {
    edges.sort((a, b) => b.weight - a.weight || a.toModuleId.localeCompare(b.toModuleId)).slice(0, outboundLimit).filter((edge) => edge.weight >= 0.35).forEach((edge) => {
      const pairKey = [edge.fromModuleId, edge.toModuleId].sort().join("::");
      const existing = dedupedEdges.get(pairKey);
      if (!existing || edge.weight > existing.weight) {
        dedupedEdges.set(pairKey, edge);
      }
    });
  });
  return [...dedupedEdges.values()].sort(
    (a, b) => b.weight - a.weight || a.fromModuleId.localeCompare(b.fromModuleId)
  );
}
function generateRoads(repo, districts, archetype2) {
  if (districts.length < 2) {
    return [];
  }
  const districtByModuleId = new Map(districts.map((district) => [district.moduleId, district]));
  const activeModuleIds = new Set(districts.map((district) => district.moduleId));
  return selectReadableEdges(archetype2, repo, activeModuleIds).map((edge) => {
    const fromDistrict = districtByModuleId.get(edge.fromModuleId);
    const toDistrict = districtByModuleId.get(edge.toModuleId);
    if (!fromDistrict || !toDistrict) {
      return null;
    }
    const style = ROAD_STYLE_BY_REASON[edge.reason];
    return {
      id: makeId("road", repo.repoId, edge.fromModuleId, edge.toModuleId),
      fromDistrictId: fromDistrict.id,
      toDistrictId: toDistrict.id,
      reason: edge.reason,
      weight: edge.weight,
      width: Math.round(clamp(style.baseWidth + edge.weight * 2.4, 2.2, 6.4) * 10) / 10,
      color: style.color,
      emissive: style.emissive,
      points: buildRoadPoints(fromDistrict, toDistrict)
    };
  }).filter((road) => road !== null);
}
const ARCHETYPE_FACTIONS = {
  interface: "chrome-syndicate",
  service: "node-mafia",
  data: "python-cartel",
  ops: "go-yakuza",
  validation: "rust-collective",
  archive: "unaligned",
  shared: "node-mafia",
  control: "go-yakuza"
};
function generatedCityToDistricts(city) {
  return city.districts.map((district) => ({
    id: district.id,
    name: district.label,
    description: district.description,
    color: district.color,
    emissive: district.emissive,
    position: [district.position.x, district.position.y],
    size: [district.footprint.width, district.footprint.height],
    faction: ARCHETYPE_FACTIONS[district.category] ?? "unaligned",
    heatLevel: district.heatLevel,
    repoSource: {
      owner: city.repoOwner,
      repo: city.repoName,
      language: district.category,
      stars: 0,
      openIssues: city.missions.filter((mission) => mission.districtId === district.id).length,
      lastActivity: city.generatedAt
    },
    missionIds: city.missions.filter((mission) => mission.districtId === district.id).map((mission) => mission.id)
  }));
}
function generatedCityToMissions(city) {
  return city.missions.map((mission) => {
    const district = city.districts.find((candidate) => candidate.id === mission.districtId);
    const pos = district?.position ?? { x: 0, y: 0 };
    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      type: mission.type,
      districtId: mission.districtId,
      difficulty: mission.difficulty,
      timeLimit: mission.type === "boss" ? 60 : 45,
      reward: mission.difficulty * 100,
      factionReward: mission.difficulty * 8,
      status: "available",
      objectives: mission.objectives,
      waypoints: mission.objectives.map((objective, index) => ({
        id: `${mission.id}-wp-${index}`,
        label: objective,
        position: [
          pos.x + (index - 1) * 8,
          0.5,
          pos.y + (index - 1) * 5
        ],
        radius: 4,
        order: index
      }))
    };
  });
}
function generatedCityToConflicts(city) {
  const bossMissions = city.missions.filter((mission) => mission.type === "boss");
  return bossMissions.map((mission) => {
    const bot = city.bots.find((candidate) => candidate.districtId === mission.districtId && candidate.sourceSignalType === mission.sourceSignalType) ?? city.bots.find((candidate) => candidate.districtId === mission.districtId);
    const district = city.districts.find((candidate) => candidate.id === mission.districtId);
    const districtLabel = district?.label ?? district?.name ?? mission.districtId;
    const battleTemplate = getBattleTemplate(mission.sourceSignalType, bot?.archetype ?? "saboteur");
    const primaryMechanic = battleTemplate.mechanicHints[0];
    const firstPhase = battleTemplate.phases[0];
    const finalPhase = battleTemplate.phases[battleTemplate.phases.length - 1];
    return {
      id: `conflict-${mission.id}`,
      title: `${battleTemplate.encounterName} at ${districtLabel}`,
      description: `${battleTemplate.summary} ${battleTemplate.copy.intro}`,
      difficulty: mission.difficulty,
      timeLimit: 30,
      districtId: mission.districtId,
      reward: mission.difficulty * 150,
      hunks: [
        {
          id: 1,
          label: `${bot?.name ?? battleTemplate.enemyRole}'s pressure plan`,
          code: `// ${battleTemplate.copy.intro}
const route = rushThrough("${districtLabel}");
// ${primaryMechanic?.description ?? "Noise hides the readable path."}`,
          side: "theirs"
        },
        {
          id: 2,
          label: "Containment pass",
          code: `// ${battleTemplate.objective}
const route = traceStableAnchors("${districtLabel}");
// ${firstPhase?.objective ?? "Read the room before you commit."}`,
          side: "ours"
        },
        {
          id: 3,
          label: `${battleTemplate.encounterName} resolution`,
          code: `// ${battleTemplate.copy.victory}
const route = applyCuratedTemplate("${battleTemplate.id}");
lockRoute(route);
// ${finalPhase?.objective ?? "Hold the clean route until the pressure collapses."}`,
          side: "resolved"
        }
      ],
      correctOrder: [3]
    };
  });
}
function generateCityFromRepo(repo) {
  const archetype2 = classifyRepoArchetype(repo);
  const connectivityScores = computeConnectivityScores(repo);
  const { activeModules, positions } = planDistrictLayout(repo.modules, archetype2, connectivityScores);
  const districts = buildGeneratedDistricts(repo, activeModules, archetype2, positions, connectivityScores);
  const roads = generateRoads(repo, districts, archetype2);
  const actionableSignals = repo.signals.filter(isActionableSignal);
  const missions = generateSignalDrivenMissions(repo, districts, actionableSignals);
  const bots = generateSignalDrivenBots(repo, districts, actionableSignals);
  return {
    repoId: repo.repoId,
    repoName: repo.name,
    repoOwner: repo.owner,
    archetype: archetype2,
    districts,
    roads,
    missions,
    bots,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
const SEED_FACTIONS = [
  { id: "chrome-syndicate", name: "Chrome Syndicate", color: "#61DAFB", motto: "We render the future.", score: 2400, districtsControlled: 1 },
  { id: "rust-collective", name: "Rust Collective", color: "#FF6B35", motto: "Zero-cost. Zero mercy.", score: 3100, districtsControlled: 1 },
  { id: "python-cartel", name: "Python Cartel", color: "#FFD43B", motto: "Import power.", score: 1800, districtsControlled: 1 },
  { id: "node-mafia", name: "Node Mafia", color: "#3178C6", motto: "Async or die.", score: 2750, districtsControlled: 1 },
  { id: "go-yakuza", name: "Go Yakuza", color: "#00ADD8", motto: "Keep it simple. Keep it fast.", score: 2100, districtsControlled: 1 },
  { id: "unaligned", name: "Unaligned", color: "#A855F7", motto: "No masters, no forks.", score: 900, districtsControlled: 1 }
];
SEED_FACTIONS.reduce((factionsById, faction) => {
  factionsById[faction.id] = faction;
  return factionsById;
}, {});
function buildSeedLeaderboard(factions = SEED_FACTIONS) {
  return [...factions].sort((a, b) => b.score - a.score).map((faction, index) => ({
    rank: index + 1,
    factionId: faction.id,
    factionName: faction.name,
    score: faction.score,
    districtsControlled: faction.districtsControlled,
    missionsCompleted: Math.floor(faction.score / 100)
  }));
}
const SEED_DISTRICTS = [
  {
    id: "react-district",
    name: "React District",
    description: "The flashiest neighborhood in town. Neon signs re-render every frame. Home to the Chrome Syndicate.",
    color: "#61DAFB",
    emissive: "#00BFFF",
    position: [-30, -30],
    size: [40, 40],
    faction: "chrome-syndicate",
    heatLevel: 45,
    repoSource: {
      owner: "facebook",
      repo: "react",
      language: "JavaScript",
      stars: 22e4,
      openIssues: 900,
      lastActivity: "2026-03-07T00:00:00Z"
    },
    missionIds: ["m-deliver-patch-react", "m-escape-test-drones", "m-boss-merge-react"]
  },
  {
    id: "rust-docks",
    name: "Rust Docks",
    description: "Heavy industrial zone. Cargo ships run on zero-cost abstractions. The Rust Collective owns every crane.",
    color: "#FF6B35",
    emissive: "#FF4500",
    position: [30, -30],
    size: [40, 40],
    faction: "rust-collective",
    heatLevel: 60,
    repoSource: {
      owner: "rust-lang",
      repo: "rust",
      language: "Rust",
      stars: 95e3,
      openIssues: 8500,
      lastActivity: "2026-03-07T00:00:00Z"
    },
    missionIds: ["m-recover-artifact-rust", "m-defend-terminal-rust"]
  },
  {
    id: "python-heights",
    name: "Python Heights",
    description: "Uptown luxury. Everything is dynamically typed and beautifully indented. The Python Cartel runs the penthouses.",
    color: "#FFD43B",
    emissive: "#FFD700",
    position: [-30, 30],
    size: [40, 40],
    faction: "python-cartel",
    heatLevel: 30,
    repoSource: {
      owner: "python",
      repo: "cpython",
      language: "Python",
      stars: 62e3,
      openIssues: 7800,
      lastActivity: "2026-03-07T00:00:00Z"
    },
    missionIds: ["m-deliver-patch-python", "m-smuggle-hotfix"]
  },
  {
    id: "go-freeway",
    name: "Go Freeway",
    description: "Fast lanes, minimal signage. What you see is what you get. The Go Yakuza keep traffic flowing.",
    color: "#00ADD8",
    emissive: "#00CED1",
    position: [30, 30],
    size: [40, 40],
    faction: "go-yakuza",
    heatLevel: 20,
    repoSource: {
      owner: "golang",
      repo: "go",
      language: "Go",
      stars: 122e3,
      openIssues: 8900,
      lastActivity: "2026-03-07T00:00:00Z"
    },
    missionIds: ["m-race-regression", "m-defend-terminal-go"]
  },
  {
    id: "typescript-terminal",
    name: "TypeScript Terminal",
    description: "The transit hub. Types are checked at every gate. The Node Mafia controls the railway.",
    color: "#3178C6",
    emissive: "#4169E1",
    position: [0, -60],
    size: [35, 35],
    faction: "node-mafia",
    heatLevel: 55,
    repoSource: {
      owner: "microsoft",
      repo: "TypeScript",
      language: "TypeScript",
      stars: 99e3,
      openIssues: 5600,
      lastActivity: "2026-03-07T00:00:00Z"
    },
    missionIds: ["m-hijack-release", "m-boss-merge-ts"]
  },
  {
    id: "linux-underground",
    name: "Linux Underground",
    description: "The old city beneath. Ancient tunnels, kernel-level operations. No faction fully controls it. Neutral ground... mostly.",
    color: "#A855F7",
    emissive: "#9333EA",
    position: [0, 60],
    size: [35, 35],
    faction: "unaligned",
    heatLevel: 75,
    repoSource: {
      owner: "torvalds",
      repo: "linux",
      language: "C",
      stars: 175e3,
      openIssues: 300,
      lastActivity: "2026-03-07T00:00:00Z"
    },
    missionIds: ["m-recover-artifact-linux", "m-escape-test-drones-linux"]
  }
];
function buildSeedBossMission(id, districtId, districtLabel, difficulty, timeLimit, reward, factionReward, threatType, botArchetype, waypoint) {
  const routeCopy = buildBossMissionRouteCopy(districtLabel, threatType, botArchetype);
  return {
    id,
    title: routeCopy.title,
    description: routeCopy.description,
    type: "boss",
    districtId,
    difficulty,
    timeLimit,
    reward,
    factionReward,
    status: "available",
    objectives: routeCopy.objectives,
    waypoints: [
      {
        ...waypoint,
        label: routeCopy.objectives[0]
      }
    ]
  };
}
const SEED_MISSIONS = [
  // === DELIVERY MISSIONS ===
  {
    id: "m-deliver-patch-react",
    title: "Patch Runner: React Hotfix",
    description: "A critical useState patch needs to reach the deploy terminal before the nightly build. Dodge the linters, avoid the type-checkers, and deliver the goods.",
    type: "delivery",
    districtId: "react-district",
    difficulty: 2,
    timeLimit: 45,
    reward: 150,
    factionReward: 10,
    status: "available",
    objectives: ["Pick up the patch package", "Reach the deploy terminal", "Deliver before timeout"],
    waypoints: [
      { id: "wp-react-d1", label: "Pick Up Patch", position: [-40, 0.5, -40], radius: 4, order: 0 },
      { id: "wp-react-d2", label: "Deploy Terminal", position: [-20, 0.5, -20], radius: 4, order: 1 },
      { id: "wp-react-d3", label: "Drop Off", position: [-30, 0.5, -15], radius: 4, order: 2 }
    ]
  },
  {
    id: "m-deliver-patch-python",
    title: "Dependency Mule: PyPI Drop",
    description: "Smuggle a new dependency through Python Heights without triggering the virtual environment scanners.",
    type: "delivery",
    districtId: "python-heights",
    difficulty: 1,
    timeLimit: 60,
    reward: 100,
    factionReward: 8,
    status: "available",
    objectives: ["Collect the .whl package", "Navigate through Heights", "Drop at the pip install point"],
    waypoints: [
      { id: "wp-pypi-1", label: "Collect Package", position: [-45, 0.5, 20], radius: 4, order: 0 },
      { id: "wp-pypi-2", label: "Navigate Heights", position: [-25, 0.5, 35], radius: 4, order: 1 },
      { id: "wp-pypi-3", label: "PIP Install Point", position: [-15, 0.5, 40], radius: 4, order: 2 }
    ]
  },
  // === ESCAPE MISSIONS ===
  {
    id: "m-escape-test-drones",
    title: "Test Suite Pursuit",
    description: "You broke 47 tests. The CI drones are swarming. Run through React District and reach the safe house before coverage drops to zero.",
    type: "escape",
    districtId: "react-district",
    difficulty: 3,
    timeLimit: 30,
    reward: 200,
    factionReward: 15,
    status: "available",
    objectives: ["Evade test drones", "Reach the safe house", "Survive for 30 seconds"],
    waypoints: [
      { id: "wp-escape-r1", label: "Escape Start", position: [-45, 0.5, -45], radius: 4, order: 0 },
      { id: "wp-escape-r2", label: "Safe House", position: [-15, 0.5, -20], radius: 5, order: 1 }
    ]
  },
  {
    id: "m-escape-test-drones-linux",
    title: "Kernel Panic Escape",
    description: "Something went wrong deep in the Underground. Segfaults are spreading. Get out before the whole system locks.",
    type: "escape",
    districtId: "linux-underground",
    difficulty: 4,
    timeLimit: 25,
    reward: 300,
    factionReward: 20,
    status: "available",
    objectives: ["Navigate collapsing tunnels", "Avoid segfault zones", "Reach surface exit"],
    waypoints: [
      { id: "wp-kernel-1", label: "Deep Tunnel", position: [-5, 0.5, 55], radius: 4, order: 0 },
      { id: "wp-kernel-2", label: "Segfault Bypass", position: [8, 0.5, 65], radius: 4, order: 1 },
      { id: "wp-kernel-3", label: "Surface Exit", position: [0, 0.5, 75], radius: 5, order: 2 }
    ]
  },
  // === RECOVERY MISSIONS ===
  {
    id: "m-recover-artifact-rust",
    title: "Cargo Heist: Lost Crate",
    description: "A critical build artifact went missing in the Rust Docks. Find the corrupted crate, decrypt it, and bring it back.",
    type: "recovery",
    districtId: "rust-docks",
    difficulty: 3,
    timeLimit: 50,
    reward: 250,
    factionReward: 15,
    status: "available",
    objectives: ["Locate the lost crate", "Decrypt the artifact", "Return to base"],
    waypoints: [
      { id: "wp-cargo-1", label: "Search Area", position: [20, 0.5, -35], radius: 5, order: 0 },
      { id: "wp-cargo-2", label: "Lost Crate", position: [40, 0.5, -45], radius: 4, order: 1 },
      { id: "wp-cargo-3", label: "Docks Base", position: [30, 0.5, -25], radius: 4, order: 2 }
    ]
  },
  {
    id: "m-recover-artifact-linux",
    title: "Root Access Recovery",
    description: "Someone dropped a root key deep in the Underground. Retrieve it before the wrong faction gets their hands on it.",
    type: "recovery",
    districtId: "linux-underground",
    difficulty: 5,
    timeLimit: 40,
    reward: 400,
    factionReward: 25,
    status: "available",
    objectives: ["Descend to kernel level", "Find the root key", "Extract without detection"],
    waypoints: [
      { id: "wp-root-1", label: "Tunnel Entrance", position: [5, 0.5, 50], radius: 4, order: 0 },
      { id: "wp-root-2", label: "Root Key Location", position: [-8, 0.5, 70], radius: 4, order: 1 },
      { id: "wp-root-3", label: "Extraction Point", position: [0, 0.5, 48], radius: 5, order: 2 }
    ]
  },
  // === DEFENSE MISSIONS ===
  {
    id: "m-defend-terminal-rust",
    title: "Hold the Build Server",
    description: "Fork gangs are trying to overwrite the Rust Docks build config. Hold position at the terminal until compilation completes.",
    type: "defense",
    districtId: "rust-docks",
    difficulty: 3,
    timeLimit: 35,
    reward: 200,
    factionReward: 12,
    status: "available",
    objectives: ["Reach the build terminal", "Defend for 35 seconds", "Keep compile progress above 50%"],
    waypoints: [
      { id: "wp-defend-r1", label: "Build Terminal", position: [35, 0.5, -30], radius: 5, order: 0 }
    ]
  },
  {
    id: "m-defend-terminal-go",
    title: "Freeway Tollbooth Defense",
    description: "The Go Freeway tollbooth is under attack. Keep the goroutines running and the channels open.",
    type: "defense",
    districtId: "go-freeway",
    difficulty: 2,
    timeLimit: 40,
    reward: 175,
    factionReward: 10,
    status: "available",
    objectives: ["Guard the tollbooth", "Keep connection channels open", "Repel attackers"],
    waypoints: [
      { id: "wp-defend-g1", label: "Tollbooth", position: [25, 0.5, 35], radius: 5, order: 0 }
    ]
  },
  // === SPECIAL MISSIONS ===
  {
    id: "m-smuggle-hotfix",
    title: "Hotfix Smuggler",
    description: "CI/CD checkpoints are everywhere in Python Heights. Sneak a critical hotfix through without triggering the pipeline.",
    type: "delivery",
    districtId: "python-heights",
    difficulty: 3,
    timeLimit: 35,
    reward: 225,
    factionReward: 18,
    status: "available",
    objectives: ["Receive the hotfix", "Avoid CI checkpoints", "Deploy to production"],
    waypoints: [
      { id: "wp-hotfix-1", label: "Hotfix Source", position: [-40, 0.5, 25], radius: 4, order: 0 },
      { id: "wp-hotfix-2", label: "CI Bypass", position: [-25, 0.5, 40], radius: 4, order: 1 },
      { id: "wp-hotfix-3", label: "Prod Server", position: [-20, 0.5, 45], radius: 4, order: 2 }
    ]
  },
  {
    id: "m-hijack-release",
    title: "Release Train Heist",
    description: "The TypeScript Terminal release train is leaving. Board it, override the version bump, and hijack the release notes.",
    type: "recovery",
    districtId: "typescript-terminal",
    difficulty: 4,
    timeLimit: 30,
    reward: 350,
    factionReward: 22,
    status: "available",
    objectives: ["Board the release train", "Override version bump", "Hijack release notes"],
    waypoints: [
      { id: "wp-train-1", label: "Platform", position: [-8, 0.5, -65], radius: 4, order: 0 },
      { id: "wp-train-2", label: "Override Console", position: [5, 0.5, -55], radius: 4, order: 1 },
      { id: "wp-train-3", label: "Release Notes", position: [10, 0.5, -50], radius: 4, order: 2 }
    ]
  },
  {
    id: "m-race-regression",
    title: "Regression Race",
    description: "A regression window is closing on the Go Freeway. Race across districts to patch it before the deadline.",
    type: "escape",
    districtId: "go-freeway",
    difficulty: 2,
    timeLimit: 45,
    reward: 175,
    factionReward: 12,
    status: "available",
    objectives: ["Start at Freeway entrance", "Race to regression point", "Apply fix before window closes"],
    waypoints: [
      { id: "wp-race-1", label: "Freeway Entrance", position: [15, 0.5, 25], radius: 4, order: 0 },
      { id: "wp-race-2", label: "Regression Point", position: [40, 0.5, 40], radius: 4, order: 1 },
      { id: "wp-race-3", label: "Patch Zone", position: [45, 0.5, 45], radius: 5, order: 2 }
    ]
  },
  // === BOSS MISSIONS ===
  buildSeedBossMission(
    "m-boss-merge-react",
    "react-district",
    "React District",
    4,
    60,
    500,
    30,
    "merge_conflict",
    "merge",
    { id: "wp-boss-react", label: "", position: [-30, 0.5, -30], radius: 5, order: 0 }
  ),
  buildSeedBossMission(
    "m-boss-merge-ts",
    "typescript-terminal",
    "TypeScript Terminal",
    5,
    45,
    600,
    35,
    "merge_conflict",
    "type",
    { id: "wp-boss-ts", label: "", position: [0, 0.5, -60], radius: 5, order: 0 }
  )
];
const SEED_EVENTS = [
  {
    id: "evt-rust-patch-wave",
    headline: "RUST DOCKS RIOT: Major Patch Wave Hits",
    description: "Cargo ships overloaded with crate updates. The Docks are in chaos. Extra rewards for mission runners brave enough to enter.",
    districtId: "rust-docks",
    severity: "high",
    timestamp: "2026-03-07T08:00:00Z",
    effects: [
      { type: "heat_change", value: 20, target: "rust-docks" },
      { type: "mission_bonus", value: 50, target: "rust-docks" }
    ]
  },
  {
    id: "evt-react-hotfix-flood",
    headline: "REACT DISTRICT FLOODED: Hotfix Couriers Everywhere",
    description: "A breaking change in the core hook system has spawned waves of hotfix deliveries. Streets are packed with runners.",
    districtId: "react-district",
    severity: "medium",
    timestamp: "2026-03-07T10:00:00Z",
    effects: [
      { type: "heat_change", value: 15, target: "react-district" },
      { type: "mission_bonus", value: 30, target: "react-district" }
    ]
  },
  {
    id: "evt-python-quarantine",
    headline: "PYTHON HEIGHTS QUARANTINE: Dependency Chain Alert",
    description: "A transitive dependency vulnerability has triggered a full quarantine. All packages entering Heights are being scanned.",
    districtId: "python-heights",
    severity: "critical",
    timestamp: "2026-03-07T06:00:00Z",
    effects: [
      { type: "district_lockdown", value: 1, target: "python-heights" },
      { type: "heat_change", value: 30, target: "python-heights" }
    ]
  },
  {
    id: "evt-fork-clash",
    headline: "FORK WARS: Downtown Clash After Issue Spike",
    description: "Two major forks of the same framework are fighting for control of TypeScript Terminal. Choose your side.",
    districtId: "typescript-terminal",
    severity: "high",
    timestamp: "2026-03-07T12:00:00Z",
    effects: [
      { type: "faction_shift", value: -10, target: "typescript-terminal" },
      { type: "heat_change", value: 25, target: "typescript-terminal" }
    ]
  },
  {
    id: "evt-go-speed-boost",
    headline: "GO FREEWAY: Compilation Speed Record",
    description: "The Go compiler just broke its own speed record. The Freeway is running hot. Bonus speed for all runners.",
    districtId: "go-freeway",
    severity: "low",
    timestamp: "2026-03-07T14:00:00Z",
    effects: [
      { type: "mission_bonus", value: 25, target: "go-freeway" }
    ]
  },
  {
    id: "evt-linux-kernel-merge",
    headline: "LINUX UNDERGROUND: Massive Kernel Merge Window Opens",
    description: "Torvalds opened the merge window. The Underground is swarming with contributors and merge conflict bosses.",
    districtId: "linux-underground",
    severity: "critical",
    timestamp: "2026-03-07T04:00:00Z",
    effects: [
      { type: "heat_change", value: 35, target: "linux-underground" },
      { type: "mission_bonus", value: 75, target: "linux-underground" }
    ]
  },
  {
    id: "evt-npm-outage",
    headline: "CITY-WIDE: NPM Registry Outage",
    description: "The central package registry is down. Supply lines are disrupted across all districts. Smugglers are making a fortune.",
    districtId: "typescript-terminal",
    severity: "critical",
    timestamp: "2026-03-07T16:00:00Z",
    effects: [
      { type: "heat_change", value: 10 },
      { type: "mission_bonus", value: 40 }
    ]
  }
];
const SEED_CONFLICTS = [
  {
    id: "mc-react-hooks",
    title: "The Great Hook Conflict",
    description: "Two PRs modified the same useEffect. One adds a cleanup, the other changes the dependency array. Choose wisely.",
    difficulty: 2,
    timeLimit: 30,
    districtId: "react-district",
    reward: 500,
    hunks: [
      {
        id: 1,
        label: "Add cleanup function",
        code: "useEffect(() => {\n  subscribe(channel);\n  return () => unsubscribe(channel);\n}, [channel]);",
        side: "ours"
      },
      {
        id: 2,
        label: "Fix dependency array",
        code: "useEffect(() => {\n  subscribe(channel);\n}, [channel, userId]);",
        side: "theirs"
      },
      {
        id: 3,
        label: "Combined fix",
        code: "useEffect(() => {\n  subscribe(channel);\n  return () => unsubscribe(channel);\n}, [channel, userId]);",
        side: "resolved"
      }
    ],
    correctOrder: [3]
  },
  {
    id: "mc-rust-lifetimes",
    title: "Lifetime Showdown",
    description: "Two lifetime annotations clash. One borrow checker error blocks everything. Pick the resolution that compiles.",
    difficulty: 3,
    timeLimit: 25,
    districtId: "rust-docks",
    reward: 600,
    hunks: [
      {
        id: 1,
        label: "Explicit lifetime 'a",
        code: "fn process<'a>(data: &'a str) -> &'a str {\n  &data[1..]\n}",
        side: "ours"
      },
      {
        id: 2,
        label: "Owned String return",
        code: "fn process(data: &str) -> String {\n  data[1..].to_string()\n}",
        side: "theirs"
      },
      {
        id: 3,
        label: "Clone with lifetime",
        code: "fn process<'a>(data: &'a str) -> String {\n  data[1..].to_string()\n}",
        side: "resolved"
      }
    ],
    correctOrder: [2]
  },
  {
    id: "mc-python-imports",
    title: "Import Collision",
    description: "Two modules want the same name. Both PRs renamed the import differently. Untangle this mess.",
    difficulty: 1,
    timeLimit: 35,
    districtId: "python-heights",
    reward: 350,
    hunks: [
      {
        id: 1,
        label: "Alias import as utils_v1",
        code: "from legacy import helpers as utils_v1\nfrom modern import helpers as utils_v2",
        side: "ours"
      },
      {
        id: 2,
        label: "Remove legacy entirely",
        code: "from modern import helpers as utils",
        side: "theirs"
      },
      {
        id: 3,
        label: "Keep both with clear aliases",
        code: "from legacy import helpers as legacy_utils\nfrom modern import helpers as utils",
        side: "resolved"
      }
    ],
    correctOrder: [3]
  },
  {
    id: "mc-ts-types",
    title: "Type War at the Terminal",
    description: "A union type and an intersection type can't agree. Two PRs are fighting over the interface definition.",
    difficulty: 4,
    timeLimit: 20,
    districtId: "typescript-terminal",
    reward: 700,
    hunks: [
      {
        id: 1,
        label: "Union type approach",
        code: 'type Config = BaseConfig | ExtendedConfig;\n\nfunction init(cfg: Config) {\n  if ("extended" in cfg) { /* ... */ }\n}',
        side: "ours"
      },
      {
        id: 2,
        label: "Intersection type approach",
        code: "type Config = BaseConfig & Partial<ExtendedConfig>;\n\nfunction init(cfg: Config) {\n  if (cfg.extended) { /* ... */ }\n}",
        side: "theirs"
      },
      {
        id: 3,
        label: "Discriminated union",
        code: 'type Config = \n  | { kind: "base" } & BaseConfig\n  | { kind: "extended" } & ExtendedConfig;\n\nfunction init(cfg: Config) {\n  if (cfg.kind === "extended") { /* ... */ }\n}',
        side: "resolved"
      }
    ],
    correctOrder: [3]
  },
  {
    id: "mc-go-channels",
    title: "Channel Deadlock",
    description: "Two goroutine patterns are competing. One causes a deadlock. Pick the safe pattern before the Freeway crashes.",
    difficulty: 3,
    timeLimit: 25,
    districtId: "go-freeway",
    reward: 550,
    hunks: [
      {
        id: 1,
        label: "Unbuffered channel",
        code: "ch := make(chan int)\ngo func() { ch <- 42 }()\nresult := <-ch",
        side: "ours"
      },
      {
        id: 2,
        label: "Buffered channel",
        code: "ch := make(chan int, 1)\nch <- 42\nresult := <-ch",
        side: "theirs"
      },
      {
        id: 3,
        label: "Select with timeout",
        code: 'ch := make(chan int, 1)\ngo func() { ch <- 42 }()\nselect {\ncase result := <-ch:\n  fmt.Println(result)\ncase <-time.After(time.Second):\n  fmt.Println("timeout")\n}',
        side: "resolved"
      }
    ],
    correctOrder: [3]
  }
];
const LOCAL_RUNTIME_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1"]);
function getLocalSearchParams() {
  if (typeof window === "undefined") {
    return null;
  }
  if (window.location.protocol === "file:") {
    return new URLSearchParams(window.location.search);
  }
  if (!LOCAL_RUNTIME_HOSTS.has(window.location.hostname)) {
    return null;
  }
  return new URLSearchParams(window.location.search);
}
function getRuntimeApiBaseOverride() {
  const params = getLocalSearchParams();
  const apiBase = params?.get("apiBase")?.trim();
  return apiBase ? apiBase : null;
}
function isLocalSmokeMode() {
  return getLocalSearchParams()?.get("smoke") === "1";
}
const API_BASE = getRuntimeApiBaseOverride() ?? void 0 ?? "http://localhost:8787";
const WRITE_SESSION_REFRESH_BUFFER_MS = 6e4;
const SESSION_STORAGE_KEY = "merge-crimes-session-id";
function getOrCreateSessionId() {
  const fallback = crypto.randomUUID();
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fallback);
    return fallback;
  } catch {
    return fallback;
  }
}
const SESSION_ID = getOrCreateSessionId();
const apiRuntimeListeners = /* @__PURE__ */ new Set();
let apiRuntimeStatus = {
  connectionState: "unknown",
  writeSessionState: "unknown",
  writeSessionMessage: null
};
let publicWriteSession = null;
let publicWriteSessionPromise = null;
function emitApiRuntimeStatus(partial) {
  apiRuntimeStatus = { ...apiRuntimeStatus, ...partial };
  apiRuntimeListeners.forEach((listener) => listener(apiRuntimeStatus));
}
async function request(path, options) {
  try {
    const headers = new Headers(options?.headers);
    if (options?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
    emitApiRuntimeStatus({ connectionState: "online" });
    return res;
  } catch {
    emitApiRuntimeStatus({ connectionState: "offline" });
    return null;
  }
}
async function apiFetch(path, options) {
  const res = await request(path, options);
  if (!res?.ok) return null;
  return await res.json();
}
function writeSessionIsFresh(session) {
  return Date.parse(session.expiresAt) - Date.now() > WRITE_SESSION_REFRESH_BUFFER_MS;
}
async function ensurePublicWriteSession() {
  if (publicWriteSession && writeSessionIsFresh(publicWriteSession)) {
    emitApiRuntimeStatus({ writeSessionState: "ready", writeSessionMessage: null });
    return publicWriteSession;
  }
  if (!publicWriteSessionPromise) {
    emitApiRuntimeStatus({ writeSessionState: "checking", writeSessionMessage: null });
    publicWriteSessionPromise = request("/api/session", {
      method: "POST",
      body: JSON.stringify({ sessionId: SESSION_ID })
    }).then(async (response) => {
      if (!response) {
        emitApiRuntimeStatus({
          writeSessionState: "error",
          writeSessionMessage: "Worker API unavailable. Public writes are running in local-only fallback mode."
        });
        return null;
      }
      if (!response.ok) {
        emitApiRuntimeStatus({
          writeSessionState: "error",
          writeSessionMessage: `Write-session mint failed (${response.status}). Check PUBLIC_SESSION_SECRET and PUBLIC_ORIGIN_ALLOWLIST.`
        });
        return null;
      }
      const session = await response.json();
      publicWriteSession = session;
      emitApiRuntimeStatus({ writeSessionState: "ready", writeSessionMessage: null });
      return session;
    }).finally(() => {
      publicWriteSessionPromise = null;
    });
  }
  return publicWriteSessionPromise;
}
async function writeApiFetch(path, options, allowRetry = true) {
  const session = await ensurePublicWriteSession();
  if (!session) {
    return null;
  }
  const headers = new Headers(options?.headers);
  headers.set("Authorization", `Bearer ${session.token}`);
  headers.set("X-Merge-Session-Id", SESSION_ID);
  const response = await request(path, {
    ...options,
    headers
  });
  if (!response) {
    return null;
  }
  if (response.status === 401 && allowRetry) {
    publicWriteSession = null;
    emitApiRuntimeStatus({ writeSessionState: "checking", writeSessionMessage: null });
    return writeApiFetch(path, options, false);
  }
  if (!response.ok) {
    return null;
  }
  return await response.json();
}
async function fetchDistricts() {
  return apiFetch("/api/districts");
}
async function fetchMissions(districtId) {
  const params = new URLSearchParams({ sessionId: SESSION_ID });
  return apiFetch(`/api/missions?${params.toString()}`);
}
async function fetchLeaderboard() {
  return apiFetch("/api/leaderboard");
}
async function fetchEvents() {
  return apiFetch("/api/events");
}
async function fetchConflicts() {
  return apiFetch("/api/conflicts");
}
async function acceptMission(id) {
  return writeApiFetch(`/api/missions/${encodeURIComponent(id)}/accept`, { method: "POST" });
}
async function completeMission(id) {
  return writeApiFetch(`/api/missions/${encodeURIComponent(id)}/complete`, { method: "POST" });
}
async function failMission(id) {
  return writeApiFetch(`/api/missions/${encodeURIComponent(id)}/fail`, { method: "POST" });
}
function cloneLanguages(languages2) {
  return languages2.map((language) => ({ ...language }));
}
function cloneModules(modules2, moduleLimit) {
  const visibleModules = typeof moduleLimit === "number" ? modules2.slice(0, moduleLimit) : modules2;
  return visibleModules.map((module) => ({ ...module }));
}
function cloneDependencyEdges(dependencyEdges2, allowedModuleIds) {
  return dependencyEdges2.filter((edge) => !allowedModuleIds || allowedModuleIds.has(edge.fromModuleId) && allowedModuleIds.has(edge.toModuleId)).map((edge) => ({ ...edge }));
}
function cloneSignals$1(signals2, allowedModuleIds) {
  return signals2.filter((signal) => !allowedModuleIds || allowedModuleIds.has(signal.target)).map((signal) => ({ ...signal }));
}
function cloneMetadata(metadata2) {
  return {
    ...metadata2,
    topics: Array.isArray(metadata2.topics) ? [...metadata2.topics] : []
  };
}
function resolveMetadataFallback(snapshot, metadataFallback) {
  if (!metadataFallback) {
    return void 0;
  }
  return typeof metadataFallback === "function" ? metadataFallback(snapshot) : metadataFallback;
}
function normalizeMetadata(metadata2, snapshot, options) {
  const metadataSource = metadata2 ?? resolveMetadataFallback(snapshot, options.metadataFallback);
  if (!metadataSource) {
    return void 0;
  }
  const clonedMetadata = cloneMetadata(metadataSource);
  if (!options.metadataOverrides) {
    return clonedMetadata;
  }
  return {
    ...clonedMetadata,
    ...options.metadataOverrides,
    topics: Array.isArray(options.metadataOverrides.topics) ? [...options.metadataOverrides.topics] : clonedMetadata.topics
  };
}
function normalizeRepoSnapshot(input, options = {}) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  if (typeof candidate.repoId !== "string" || typeof candidate.owner !== "string" || typeof candidate.name !== "string" || typeof candidate.defaultBranch !== "string" || candidate.visibility !== "public" && candidate.visibility !== "private" || !Array.isArray(candidate.modules) || candidate.modules.length === 0) {
    return null;
  }
  const modules2 = cloneModules(candidate.modules, options.moduleLimit);
  const allowedModuleIds = new Set(modules2.map((module) => module.id));
  const relationFilter = options.filterRelationsToModuleIds ? allowedModuleIds : void 0;
  const dependencyEdges2 = Array.isArray(candidate.dependencyEdges) ? cloneDependencyEdges(candidate.dependencyEdges, relationFilter) : [];
  const baseSignals = Array.isArray(candidate.signals) ? cloneSignals$1(candidate.signals, relationFilter) : [];
  const baseSnapshot = {
    repoId: options.repoIdOverride ?? candidate.repoId,
    owner: candidate.owner,
    name: candidate.name,
    defaultBranch: candidate.defaultBranch,
    visibility: candidate.visibility,
    archetype: candidate.archetype ?? "unknown",
    languages: Array.isArray(candidate.languages) ? cloneLanguages(candidate.languages) : [],
    modules: modules2,
    dependencyEdges: dependencyEdges2,
    signals: baseSignals,
    generatedAt: options.generatedAtOverride ?? (typeof candidate.generatedAt === "string" ? candidate.generatedAt : (/* @__PURE__ */ new Date()).toISOString())
  };
  const signals2 = options.transformSignals ? options.transformSignals(baseSignals, { allowedModuleIds, snapshot: baseSnapshot }).map((signal) => ({ ...signal })) : baseSignals;
  const normalizedSnapshot = {
    ...baseSnapshot,
    signals: signals2
  };
  const metadata2 = normalizeMetadata(candidate.metadata, normalizedSnapshot, options);
  return metadata2 ? {
    ...normalizedSnapshot,
    metadata: metadata2
  } : normalizedSnapshot;
}
const MAX_BOOTSTRAP_MODULES = 10;
const SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY = "merge-crimes-selected-github-repo-snapshot";
function readBootstrapRepoSnapshot(input) {
  return normalizeRepoSnapshot(input, {
    moduleLimit: MAX_BOOTSTRAP_MODULES,
    filterRelationsToModuleIds: true
  });
}
const bootstrapRepoSnapshot = readBootstrapRepoSnapshot(sampleRepoSnapshotJson);
function readStoredBootstrapRepoSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const storedSnapshot = window.localStorage.getItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
    if (!storedSnapshot) {
      return null;
    }
    const parsedSnapshot = JSON.parse(storedSnapshot);
    const snapshot = readBootstrapRepoSnapshot(parsedSnapshot);
    if (!snapshot) {
      window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
    }
    return snapshot;
  } catch {
    window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
    return null;
  }
}
function writeStoredSelectedGitHubRepoSnapshot(snapshot) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!snapshot) {
      window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
      return;
    }
    const normalizedSnapshot = readBootstrapRepoSnapshot(snapshot);
    if (!normalizedSnapshot) {
      window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(normalizedSnapshot)
    );
  } catch {
  }
}
function getBootstrapRepoSnapshot() {
  if (isLocalSmokeMode()) {
    return null;
  }
  return readStoredBootstrapRepoSnapshot() ?? bootstrapRepoSnapshot;
}
function measure2DPathDistance(points) {
  if (points.length < 2) {
    return 0;
  }
  let total = 0;
  let previous = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return total;
}
const REPO_CITY_MAX_TRANSIT_HOPS = 3;
const REPO_CITY_MAX_ROUTE_DISTANCE_RATIO = 1.9;
const REPO_CITY_ROUTE_POINT_EPSILON = 0.75;
function measureTransitDistance(a, b) {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}
function toPathPoint2D(point) {
  return { x: point[0], y: point[2] };
}
function appendTransitPoint(points, point) {
  const previous = points[points.length - 1];
  if (!previous || measureTransitDistance(previous, point) > REPO_CITY_ROUTE_POINT_EPSILON) {
    points.push(point);
  }
}
function roadToTransitPoints(road, playerY, reverse = false) {
  const sourcePoints = reverse ? [...road.points].reverse() : road.points;
  return sourcePoints.map((point) => [point.x, playerY, point.y]);
}
function measureRoadDistance(points) {
  return measure2DPathDistance(points.map(toPathPoint2D));
}
function buildRoadGuidedTransitPath(city, currentDistrictId, targetDistrictId, currentPosition, targetPosition) {
  const directPath = {
    mode: "direct",
    points: [targetPosition],
    roadIds: []
  };
  if (!city || !currentDistrictId || currentDistrictId === targetDistrictId || city.roads.length === 0) {
    return directPath;
  }
  const districtById = new Map(city.districts.map((district) => [district.id, district]));
  if (!districtById.has(currentDistrictId) || !districtById.has(targetDistrictId)) {
    return directPath;
  }
  const adjacency = /* @__PURE__ */ new Map();
  const addEdge = (fromDistrictId, edge) => {
    const currentEdges = adjacency.get(fromDistrictId) ?? [];
    currentEdges.push(edge);
    adjacency.set(fromDistrictId, currentEdges);
  };
  city.roads.forEach((road) => {
    const forwardPoints = roadToTransitPoints(road, currentPosition[1]);
    const reversePoints = [...forwardPoints].reverse();
    addEdge(road.fromDistrictId, {
      roadId: road.id,
      toDistrictId: road.toDistrictId,
      points: forwardPoints,
      distance: measureRoadDistance(forwardPoints)
    });
    addEdge(road.toDistrictId, {
      roadId: road.id,
      toDistrictId: road.fromDistrictId,
      points: reversePoints,
      distance: measureRoadDistance(reversePoints)
    });
  });
  const queue = [{
    districtId: currentDistrictId,
    distance: 0,
    hops: 0
  }];
  const bestByDistrict = /* @__PURE__ */ new Map([
    [currentDistrictId, { distance: 0, hops: 0 }]
  ]);
  const previousByDistrict = /* @__PURE__ */ new Map();
  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance || a.hops - b.hops);
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (current.districtId === targetDistrictId) {
      break;
    }
    const currentBest = bestByDistrict.get(current.districtId);
    if (currentBest && current.distance > currentBest.distance + 1e-3) {
      continue;
    }
    (adjacency.get(current.districtId) ?? []).forEach((edge) => {
      const nextHops = current.hops + 1;
      if (nextHops > REPO_CITY_MAX_TRANSIT_HOPS) {
        return;
      }
      const nextDistance = current.distance + edge.distance;
      const existing = bestByDistrict.get(edge.toDistrictId);
      if (existing && (nextDistance > existing.distance + 1e-3 || Math.abs(nextDistance - existing.distance) <= 1e-3 && nextHops >= existing.hops)) {
        return;
      }
      bestByDistrict.set(edge.toDistrictId, { distance: nextDistance, hops: nextHops });
      previousByDistrict.set(edge.toDistrictId, { fromDistrictId: current.districtId, edge });
      queue.push({
        districtId: edge.toDistrictId,
        distance: nextDistance,
        hops: nextHops
      });
    });
  }
  if (!previousByDistrict.has(targetDistrictId)) {
    return directPath;
  }
  const orderedEdges = [];
  let cursor = targetDistrictId;
  while (cursor !== currentDistrictId) {
    const previous = previousByDistrict.get(cursor);
    if (!previous) {
      return directPath;
    }
    orderedEdges.unshift(previous.edge);
    cursor = previous.fromDistrictId;
  }
  const routedPoints = [];
  orderedEdges.forEach((edge) => {
    edge.points.forEach((point) => appendTransitPoint(routedPoints, point));
  });
  appendTransitPoint(routedPoints, targetPosition);
  const normalizedPoints = routedPoints.filter(
    (point) => measureTransitDistance(currentPosition, point) > REPO_CITY_ROUTE_POINT_EPSILON
  );
  if (normalizedPoints.length === 0) {
    return directPath;
  }
  const directDistance = measureTransitDistance(currentPosition, targetPosition);
  const routedDistance = measure2DPathDistance([
    toPathPoint2D(currentPosition),
    ...normalizedPoints.map(toPathPoint2D)
  ]);
  if (directDistance <= REPO_CITY_ROUTE_POINT_EPSILON || routedDistance > directDistance * REPO_CITY_MAX_ROUTE_DISTANCE_RATIO) {
    return directPath;
  }
  return {
    mode: "roads",
    points: normalizedPoints,
    roadIds: [...new Set(orderedEdges.map((edge) => edge.roadId))]
  };
}
const WAYPOINT_STATE_KEY = "mc-waypoint-state";
function saveWaypointState(missionId, currentWaypointIndex, completedWaypoints) {
  try {
    sessionStorage.setItem(WAYPOINT_STATE_KEY, JSON.stringify({ missionId, currentWaypointIndex, completedWaypoints }));
  } catch {
  }
}
function loadWaypointState(missionId) {
  try {
    const raw = sessionStorage.getItem(WAYPOINT_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.missionId !== missionId) return null;
    return { currentWaypointIndex: parsed.currentWaypointIndex, completedWaypoints: parsed.completedWaypoints };
  } catch {
    return null;
  }
}
function clearWaypointState() {
  try {
    sessionStorage.removeItem(WAYPOINT_STATE_KEY);
  } catch {
  }
}
let toastIdCounter = 0;
const initialRepoSnapshot = getBootstrapRepoSnapshot();
const initialGeneratedCity = initialRepoSnapshot ? generateCityFromRepo(initialRepoSnapshot) : null;
const initialDistricts = initialGeneratedCity ? generatedCityToDistricts(initialGeneratedCity) : SEED_DISTRICTS;
const initialMissions = initialGeneratedCity ? generatedCityToMissions(initialGeneratedCity) : SEED_MISSIONS;
const initialConflicts = initialGeneratedCity ? generatedCityToConflicts(initialGeneratedCity) : SEED_CONFLICTS;
function getOfflineApiStatusMessage(repoCityMode) {
  return repoCityMode ? "Worker API unavailable. Running local repo-city snapshot mode." : "Worker API unavailable. Running local seed mode.";
}
function createInitialSelectedGitHubRepoIngestState() {
  return {
    tone: "idle",
    repoId: null,
    message: null
  };
}
function buildResetSelectedGitHubRepoState(overrides = {}) {
  return {
    selectedGitHubRepo: null,
    selectedGitHubRepoEligibility: null,
    selectedGitHubRepoIngestState: createInitialSelectedGitHubRepoIngestState(),
    selectedGitHubRepoSnapshot: null,
    showGitHubRepoPicker: false,
    ...overrides
  };
}
const initialCapture = {};
initialDistricts.forEach((d) => {
  initialCapture[d.id] = { progress: 0, capturing: false };
});
const useGameStore = create((set, get) => ({
  // Phase
  phase: "menu",
  setPhase: (phase) => set({ phase }),
  // Player
  playerPosition: [0, 0.5, 0],
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  playerName: "Runner",
  credits: 0,
  addCredits: (amount) => set((s) => ({ credits: s.credits + amount })),
  reputation: 0,
  addReputation: (amount) => set((s) => ({ reputation: s.reputation + amount })),
  isSprinting: false,
  setSprinting: (v) => set({ isSprinting: v }),
  // Districts
  districts: initialDistricts,
  currentDistrict: null,
  repoCityTransit: null,
  setCurrentDistrict: (district) => set({ currentDistrict: district }),
  movePlayerToDistrict: (districtId, options) => {
    if (districtId === null) {
      set({ currentDistrict: null, repoCityTransit: null });
      return true;
    }
    const district = get().districts.find((candidate) => candidate.id === districtId);
    if (!district) {
      return false;
    }
    const playerY = get().playerPosition[1];
    const targetPosition = [district.position[0], playerY, district.position[1]];
    if (get().repoCityMode && options?.animated) {
      const currentPosition = [get().playerPosition[0], playerY, get().playerPosition[2]];
      const routedPath = buildRoadGuidedTransitPath(
        get().generatedCity,
        get().currentDistrict?.id ?? null,
        district.id,
        currentPosition,
        targetPosition
      );
      set({
        repoCityTransit: {
          districtId: district.id,
          targetPosition,
          pathPoints: routedPath.points,
          pathIndex: 0,
          mode: routedPath.mode,
          roadIds: routedPath.roadIds
        }
      });
      return true;
    }
    set({
      playerPosition: targetPosition,
      currentDistrict: district,
      repoCityTransit: null
    });
    return true;
  },
  advanceRepoCityTransit: () => set((state) => {
    if (!state.repoCityTransit) {
      return {};
    }
    return {
      repoCityTransit: {
        ...state.repoCityTransit,
        pathIndex: Math.min(state.repoCityTransit.pathIndex + 1, state.repoCityTransit.pathPoints.length)
      }
    };
  }),
  clearRepoCityTransit: () => set({ repoCityTransit: null }),
  // Territory Capture
  captureProgress: initialCapture,
  addCaptureProgress: (districtId, amount) => {
    const current = get().captureProgress[districtId];
    if (!current) return;
    const newProgress = Math.min(100, current.progress + amount);
    set({
      captureProgress: {
        ...get().captureProgress,
        [districtId]: { progress: newProgress, capturing: newProgress < 100 }
      }
    });
    if (newProgress >= 100) {
      const districts = get().districts.map(
        (d) => d.id === districtId ? { ...d, heatLevel: Math.max(0, d.heatLevel - 20) } : d
      );
      set({ districts });
    }
  },
  // Missions
  missions: initialMissions,
  activeMission: null,
  currentWaypointIndex: 0,
  completedWaypoints: [],
  acceptMission: (missionId) => {
    const mission = get().missions.find((m) => m.id === missionId);
    if (mission) {
      set({
        activeMission: { ...mission, status: "active" },
        missions: get().missions.map((m) => m.id === missionId ? { ...m, status: "active" } : m),
        showMissionPanel: false,
        missionTimer: mission.timeLimit,
        currentWaypointIndex: 0,
        completedWaypoints: [],
        phase: "mission"
      });
      if (get().apiAvailable) {
        acceptMission(missionId).catch(() => {
        });
      }
    }
  },
  reachWaypoint: (waypointId) => {
    const { activeMission, currentWaypointIndex, completedWaypoints } = get();
    if (!activeMission) return;
    const waypoints = activeMission.waypoints;
    const currentWp = waypoints[currentWaypointIndex];
    if (!currentWp || currentWp.id !== waypointId) return;
    const newCompleted = [...completedWaypoints, waypointId];
    const nextIndex = currentWaypointIndex + 1;
    if (nextIndex >= waypoints.length) {
      if (activeMission.type === "boss") {
        const conflict = get().conflicts.find((c) => c.districtId === activeMission.districtId) ?? null;
        clearWaypointState();
        set({
          completedWaypoints: newCompleted,
          activeConflict: conflict,
          phase: "boss",
          // Reset timer to the conflict's own timeLimit for the boss fight itself.
          missionTimer: conflict?.timeLimit ?? activeMission.timeLimit
        });
      } else {
        get().completeMission(activeMission.id);
      }
    } else {
      saveWaypointState(activeMission.id, nextIndex, newCompleted);
      set({
        currentWaypointIndex: nextIndex,
        completedWaypoints: newCompleted
      });
    }
  },
  completeMission: (missionId) => {
    const mission = get().missions.find((m) => m.id === missionId);
    if (mission) {
      clearWaypointState();
      set({
        activeMission: null,
        missions: get().missions.map((m) => m.id === missionId ? { ...m, status: "completed" } : m),
        credits: get().credits + mission.reward,
        reputation: get().reputation + mission.factionReward,
        phase: "playing",
        missionTimer: 0,
        currentWaypointIndex: 0,
        completedWaypoints: []
      });
      get().addCaptureProgress(mission.districtId, 25);
      get().addRewardToast({
        credits: mission.reward,
        rep: mission.factionReward,
        label: mission.title
      });
      if (get().apiAvailable) {
        completeMission(missionId).catch(() => {
        });
      }
    }
  },
  failMission: (missionId) => {
    clearWaypointState();
    set({
      activeMission: null,
      missions: get().missions.map((m) => m.id === missionId ? { ...m, status: "available" } : m),
      phase: "playing",
      missionTimer: 0,
      currentWaypointIndex: 0,
      completedWaypoints: []
    });
    if (get().apiAvailable) {
      failMission(missionId).catch(() => {
      });
    }
  },
  // Factions
  factions: SEED_FACTIONS.map((faction) => ({ ...faction })),
  leaderboard: buildSeedLeaderboard(),
  // Events
  events: SEED_EVENTS,
  showBulletin: false,
  setShowBulletin: (show) => set({ showBulletin: show }),
  // Merge Conflicts
  conflicts: initialConflicts,
  activeConflict: null,
  startBossFight: (conflictId) => {
    const conflict = get().conflicts.find((c) => c.id === conflictId);
    if (conflict) {
      set({ activeConflict: conflict, phase: "boss", missionTimer: conflict.timeLimit });
    }
  },
  resolveBossFight: (success) => {
    const conflict = get().activeConflict;
    const activeMission = get().activeMission;
    if (conflict && success && !activeMission) {
      set({
        credits: get().credits + conflict.reward,
        reputation: get().reputation + 25
      });
    }
    if (activeMission) {
      if (success) {
        get().completeMission(activeMission.id);
      } else {
        get().failMission(activeMission.id);
      }
    }
    set({ activeConflict: null, phase: "playing", missionTimer: 0 });
  },
  // UI
  showLeaderboard: false,
  setShowLeaderboard: (show) => set({ showLeaderboard: show }),
  showMissionPanel: false,
  setShowMissionPanel: (show) => set({ showMissionPanel: show }),
  missionTimer: 0,
  setMissionTimer: (t) => set({ missionTimer: t }),
  // Reward Toast
  rewardToasts: [],
  addRewardToast: (toast) => {
    const id = ++toastIdCounter;
    set((s) => ({ rewardToasts: [...s.rewardToasts, { ...toast, id }] }));
    setTimeout(() => get().removeRewardToast(id), 3500);
  },
  removeRewardToast: (id) => {
    set((s) => ({ rewardToasts: s.rewardToasts.filter((t) => t.id !== id) }));
  },
  // Repo City
  connectedRepo: initialRepoSnapshot,
  connectedRepoRefreshStatus: initialRepoSnapshot?.metadata?.provider === "github" ? createInitialConnectedRepoRefreshStatus(initialRepoSnapshot.signals) : null,
  generatedCity: initialGeneratedCity,
  repoCityMode: initialGeneratedCity !== null,
  loadRepoCity: (repo) => {
    const city = generateCityFromRepo(repo);
    const districts = generatedCityToDistricts(city);
    const missions = generatedCityToMissions(city);
    const conflicts = generatedCityToConflicts(city);
    const capture = {};
    districts.forEach((d) => {
      capture[d.id] = { progress: 0, capturing: false };
    });
    set({
      connectedRepo: repo,
      connectedRepoRefreshStatus: repo.metadata?.provider === "github" ? createInitialConnectedRepoRefreshStatus(repo.signals) : null,
      generatedCity: city,
      repoCityMode: true,
      districts,
      missions,
      conflicts,
      captureProgress: capture,
      activeMission: null,
      activeConflict: null,
      currentDistrict: null,
      repoCityTransit: null,
      currentWaypointIndex: 0,
      completedWaypoints: [],
      missionTimer: 0,
      phase: "menu",
      apiStatusMessage: get().apiConnectionState === "offline" ? getOfflineApiStatusMessage(true) : get().apiStatusMessage
    });
  },
  clearRepoCity: () => {
    const capture = {};
    SEED_DISTRICTS.forEach((d) => {
      capture[d.id] = { progress: 0, capturing: false };
    });
    set({
      connectedRepo: null,
      connectedRepoRefreshStatus: null,
      generatedCity: null,
      repoCityMode: false,
      districts: SEED_DISTRICTS,
      missions: SEED_MISSIONS,
      conflicts: SEED_CONFLICTS,
      captureProgress: capture,
      activeMission: null,
      activeConflict: null,
      currentDistrict: null,
      repoCityTransit: null,
      currentWaypointIndex: 0,
      completedWaypoints: [],
      missionTimer: 0,
      phase: "menu",
      apiStatusMessage: get().apiConnectionState === "offline" ? getOfflineApiStatusMessage(false) : get().apiStatusMessage
    });
  },
  setConnectedRepoRefreshStatus: (status) => set({ connectedRepoRefreshStatus: status }),
  // GitHub Auth
  githubAccessToken: null,
  githubAuthStatus: "anonymous",
  githubAuthMessage: null,
  ...buildResetSelectedGitHubRepoState(),
  setGitHubAuthExchanging: () => set({
    githubAuthStatus: "exchanging",
    githubAuthMessage: null
  }),
  setGitHubAccessToken: (token) => set({
    githubAccessToken: token,
    githubAuthStatus: "authenticated",
    githubAuthMessage: null,
    ...buildResetSelectedGitHubRepoState({ showGitHubRepoPicker: true })
  }),
  setGitHubAuthError: (message) => set({
    githubAccessToken: null,
    githubAuthStatus: "error",
    githubAuthMessage: message,
    ...buildResetSelectedGitHubRepoState()
  }),
  clearGitHubAuth: () => set({
    githubAccessToken: null,
    githubAuthStatus: "anonymous",
    githubAuthMessage: null,
    ...buildResetSelectedGitHubRepoState()
  }),
  resetSelectedGitHubRepoState: (overrides) => set(buildResetSelectedGitHubRepoState(overrides)),
  setSelectedGitHubRepo: (repo) => set((state) => {
    if (!repo) {
      return buildResetSelectedGitHubRepoState({ showGitHubRepoPicker: state.showGitHubRepoPicker });
    }
    const selectedGitHubRepoEligibility = getGitHubRepoTranslationEligibility(repo.visibility);
    if (state.selectedGitHubRepo?.id === repo.id) {
      return {
        selectedGitHubRepo: repo,
        selectedGitHubRepoEligibility
      };
    }
    return buildResetSelectedGitHubRepoState({
      selectedGitHubRepo: repo,
      selectedGitHubRepoEligibility,
      showGitHubRepoPicker: state.showGitHubRepoPicker
    });
  }),
  setSelectedGitHubRepoIngestState: (state) => set({ selectedGitHubRepoIngestState: state }),
  setSelectedGitHubRepoSnapshot: (snapshot) => {
    set({
      selectedGitHubRepoSnapshot: snapshot,
      ...snapshot ? {
        selectedGitHubRepoIngestState: createInitialSelectedGitHubRepoIngestState()
      } : {}
    });
    if (!snapshot) {
      return;
    }
    writeStoredSelectedGitHubRepoSnapshot(snapshot);
    get().loadRepoCity(snapshot);
  },
  setShowGitHubRepoPicker: (show) => set({ showGitHubRepoPicker: show }),
  // District Rooms
  districtRooms: {},
  setDistrictRoom: (districtId, data) => {
    set((s) => {
      const local = s.captureProgress[districtId];
      const mergedProgress = local ? Math.max(local.progress, data.captureProgress) : data.captureProgress;
      return {
        districtRooms: { ...s.districtRooms, [districtId]: data },
        captureProgress: {
          ...s.captureProgress,
          [districtId]: { progress: mergedProgress, capturing: mergedProgress < 100 }
        }
      };
    });
  },
  // API Integration
  apiAvailable: false,
  apiConnectionState: "unknown",
  apiStatusMessage: null,
  writeSessionState: "unknown",
  writeSessionMessage: null,
  setApiRuntimeStatus: (status) => {
    set((s) => ({
      apiConnectionState: status.connectionState,
      apiAvailable: status.connectionState === "offline" ? false : s.apiAvailable,
      apiStatusMessage: status.connectionState === "offline" ? getOfflineApiStatusMessage(s.repoCityMode) : s.apiStatusMessage,
      writeSessionState: status.writeSessionState,
      writeSessionMessage: status.writeSessionMessage
    }));
  },
  loadFromApi: async () => {
    const [districts, missions, leaderboard, events, conflicts] = await Promise.all([
      fetchDistricts(),
      fetchMissions(),
      fetchLeaderboard(),
      fetchEvents(),
      fetchConflicts()
    ]);
    if (districts && missions) {
      const preserveRepoCityState = get().repoCityMode && !!get().generatedCity && !!get().connectedRepo;
      if (preserveRepoCityState) {
        set({
          apiAvailable: true,
          apiConnectionState: "online",
          apiStatusMessage: null,
          ...leaderboard ? { leaderboard } : {},
          ...events ? { events } : {}
        });
        console.log("[MergeCrimes] Loaded runtime data from Worker API without replacing repo-city bootstrap state");
        return;
      }
      const capture = {};
      districts.forEach((d) => {
        capture[d.id] = get().captureProgress[d.id] ?? { progress: 0, capturing: false };
      });
      const restoredActiveMission = missions.find((mission) => mission.status === "active") ?? null;
      let restoredWaypointIndex = 0;
      let restoredCompletedWaypoints = [];
      if (restoredActiveMission) {
        const saved = loadWaypointState(restoredActiveMission.id);
        if (saved) {
          restoredWaypointIndex = saved.currentWaypointIndex;
          restoredCompletedWaypoints = saved.completedWaypoints;
        }
      }
      set({
        apiAvailable: true,
        apiConnectionState: "online",
        apiStatusMessage: null,
        districts,
        missions,
        captureProgress: capture,
        activeMission: restoredActiveMission,
        activeConflict: null,
        currentWaypointIndex: restoredActiveMission ? restoredWaypointIndex : get().currentWaypointIndex,
        completedWaypoints: restoredActiveMission ? restoredCompletedWaypoints : get().completedWaypoints,
        missionTimer: restoredActiveMission ? restoredActiveMission.timeLimit : get().missionTimer,
        phase: restoredActiveMission ? "mission" : get().phase,
        ...leaderboard ? { leaderboard } : {},
        ...events ? { events } : {},
        ...conflicts ? { conflicts } : {}
      });
      console.log("[MergeCrimes] Loaded game data from Worker API");
    } else {
      set({
        apiAvailable: false,
        apiConnectionState: "offline",
        apiStatusMessage: getOfflineApiStatusMessage(get().repoCityMode)
      });
      console.log("[MergeCrimes] Worker API unavailable, using local fallback data");
    }
  }
}));
function getActiveRepoRefreshState(connectedRepo, repoRefreshStatus) {
  return repoRefreshStatus.repoId === connectedRepo?.repoId ? {
    tone: repoRefreshStatus.tone,
    message: repoRefreshStatus.message
  } : {
    tone: "idle",
    message: null
  };
}
function buildRepoRefreshStatusCopy(connectedRepo, connectedRepoRefreshStatus, repoRefreshStatus) {
  const { tone, message } = getActiveRepoRefreshState(connectedRepo, repoRefreshStatus);
  const hasConnectedRepoUpdate = Boolean(connectedRepoRefreshStatus?.hasNewerRemote);
  if (tone === "loading") {
    return {
      pill: "Refresh in progress",
      title: "Refreshing GitHub metadata",
      message: message ?? "Pulling a fresh read-only snapshot without leaving this menu."
    };
  }
  if (tone === "success") {
    return {
      pill: "Snapshot updated",
      title: "Connected repo refreshed",
      message: message ?? "A fresh GitHub snapshot is ready in the current session."
    };
  }
  if (tone === "error") {
    return {
      pill: "Refresh failed",
      title: "Could not refresh this repo",
      message: message ?? "GitHub did not return a fresh snapshot. Try the refresh action again."
    };
  }
  return {
    pill: hasConnectedRepoUpdate ? "Update detected" : "Manual refresh",
    title: hasConnectedRepoUpdate ? "Newer snapshot available" : "Refresh the connected snapshot",
    message: hasConnectedRepoUpdate && connectedRepo ? `GitHub reports newer commits on ${connectedRepo.defaultBranch}. Refresh when you want to load the latest read-only snapshot.` : "Pull the latest read-only repo metadata here without changing the current repo."
  };
}
function buildRepoRefreshIndicatorTone(connectedRepo, connectedRepoRefreshStatus, repoRefreshStatus) {
  const { tone } = getActiveRepoRefreshState(connectedRepo, repoRefreshStatus);
  if (tone !== "idle") {
    return tone;
  }
  return connectedRepoRefreshStatus?.hasNewerRemote ? "success" : "idle";
}
function buildRepoHudRefreshNotice(connectedRepo, connectedRepoRefreshStatus) {
  if (!connectedRepo || !connectedRepoRefreshStatus?.hasNewerRemote) {
    return null;
  }
  return {
    title: "Newer snapshot available",
    detail: connectedRepoRefreshStatus.latestRemoteCommitSha ? `New commits landed on ${connectedRepo.defaultBranch}. Open the menu to refresh this repo snapshot.` : `New commits landed on ${connectedRepo.defaultBranch}. Open the menu to refresh this repo snapshot.`
  };
}
function isSelectedGitHubRepoSnapshotIngesting(selectedGitHubRepo, selectedGitHubRepoEligibility, selectedGitHubRepoIsActive, selectedGitHubRepoIngestState) {
  return Boolean(
    selectedGitHubRepo && selectedGitHubRepoEligibility?.eligible && true && selectedGitHubRepoIngestState.tone === "loading" && selectedGitHubRepoIngestState.repoId === selectedGitHubRepo.id
  );
}
function didSelectedGitHubRepoSnapshotIngestFail(selectedGitHubRepo, selectedGitHubRepoEligibility, selectedGitHubRepoIsActive, selectedGitHubRepoIngestState) {
  return Boolean(
    selectedGitHubRepo && selectedGitHubRepoEligibility?.eligible && true && selectedGitHubRepoIngestState.tone === "error" && selectedGitHubRepoIngestState.repoId === selectedGitHubRepo.id
  );
}
function getSelectedRepoStatusModel(selectedGitHubRepo, selectedGitHubRepoEligibility, selectedGitHubRepoIsActive, connectedRepo, selectedGitHubRepoIngestState) {
  if (!selectedGitHubRepo || !selectedGitHubRepoEligibility) {
    return {
      kind: "none",
      selectedGitHubRepo,
      selectedGitHubRepoEligibility,
      selectedGitHubRepoIsActive,
      connectedRepo,
      selectedGitHubRepoIngestState
    };
  }
  const repoStillIngesting = isSelectedGitHubRepoSnapshotIngesting(
    selectedGitHubRepo,
    selectedGitHubRepoEligibility,
    selectedGitHubRepoIsActive,
    selectedGitHubRepoIngestState
  );
  if (repoStillIngesting) {
    return {
      kind: "loading",
      selectedGitHubRepo,
      selectedGitHubRepoEligibility,
      selectedGitHubRepoIsActive,
      connectedRepo,
      selectedGitHubRepoIngestState
    };
  }
  const repoIngestFailed = didSelectedGitHubRepoSnapshotIngestFail(
    selectedGitHubRepo,
    selectedGitHubRepoEligibility,
    selectedGitHubRepoIsActive,
    selectedGitHubRepoIngestState
  );
  if (repoIngestFailed) {
    return {
      kind: "error",
      selectedGitHubRepo,
      selectedGitHubRepoEligibility,
      selectedGitHubRepoIsActive,
      connectedRepo,
      selectedGitHubRepoIngestState
    };
  }
  if (selectedGitHubRepoEligibility.eligible) {
    return {
      kind: selectedGitHubRepoIsActive ? "active" : "eligible",
      selectedGitHubRepo,
      selectedGitHubRepoEligibility,
      selectedGitHubRepoIsActive,
      connectedRepo,
      selectedGitHubRepoIngestState
    };
  }
  return {
    kind: "listed-only",
    selectedGitHubRepo,
    selectedGitHubRepoEligibility,
    selectedGitHubRepoIsActive,
    connectedRepo,
    selectedGitHubRepoIngestState
  };
}
function buildSelectedRepoStatusCopyFromModel(selectedRepoStatusModel) {
  const {
    kind,
    selectedGitHubRepo,
    selectedGitHubRepoEligibility,
    selectedGitHubRepoIngestState,
    connectedRepo
  } = selectedRepoStatusModel;
  if (kind === "none" || !selectedGitHubRepo || !selectedGitHubRepoEligibility) {
    return null;
  }
  if (kind === "loading") {
    return {
      tone: "loading",
      pill: "Ingesting repo",
      title: "Selected repo is still loading",
      message: "Ingesting repository data... Please wait before entering the city.",
      detail: connectedRepo ? `${connectedRepo.owner}/${connectedRepo.name} stays active until ${selectedGitHubRepo.fullName} finishes its read-only snapshot ingest.` : `${selectedGitHubRepo.fullName} will become the active city after its read-only snapshot is ready.`,
      showSpinner: true
    };
  }
  if (kind === "error") {
    return {
      tone: "error",
      pill: "Ingest failed",
      title: "Selected repo is not ready",
      message: selectedGitHubRepoIngestState.message ?? "GitHub did not return a readable snapshot for this repository.",
      detail: connectedRepo ? `${connectedRepo.owner}/${connectedRepo.name} stays active until you retry this public repo selection.` : "Retry this public repo selection to request a new read-only snapshot."
    };
  }
  if (kind === "active" || kind === "eligible") {
    return {
      tone: "success",
      pill: kind === "active" ? "Active city" : selectedGitHubRepoEligibility.pill,
      title: kind === "active" ? "Selected repo is active" : "Selected repo is eligible",
      message: kind === "active" ? `${selectedGitHubRepo.fullName} is the public repo behind the current Repo City snapshot.` : `${selectedGitHubRepo.fullName} is eligible for Repo City translation in this flow.`,
      detail: kind === "active" ? "Menu status and actions now match the same eligibility rule shown in the picker." : connectedRepo ? `${connectedRepo.owner}/${connectedRepo.name} stays active until a read-only snapshot for the selected repo is available.` : "The menu only switches the active city after a read-only GitHub snapshot is available."
    };
  }
  return {
    tone: "empty",
    pill: selectedGitHubRepoEligibility.pill,
    title: "Selected repo is listed only",
    message: `${selectedGitHubRepo.fullName} is visible through GitHub, but ${selectedGitHubRepoEligibility.menuDetail.toLowerCase()}`,
    detail: connectedRepo ? `${connectedRepo.owner}/${connectedRepo.name} stays the active city. Pick an eligible public repo to switch translation.` : "Pick an eligible public repo to generate a city here."
  };
}
function buildSelectedRepoStatusCopy(selectedGitHubRepo, selectedGitHubRepoEligibility, selectedGitHubRepoIsActive, connectedRepo, selectedGitHubRepoIngestState) {
  return buildSelectedRepoStatusCopyFromModel(getSelectedRepoStatusModel(
    selectedGitHubRepo,
    selectedGitHubRepoEligibility,
    selectedGitHubRepoIsActive,
    connectedRepo,
    selectedGitHubRepoIngestState
  ));
}
const SNAPSHOT_DETAIL_FORMATTER = new Intl.DateTimeFormat(void 0, {
  dateStyle: "medium",
  timeStyle: "short"
});
const SNAPSHOT_RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(void 0, {
  numeric: "auto"
});
function getSnapshotSourceLabel(source) {
  return source === "github" ? "GitHub snapshot" : "Seeded fixture";
}
function getSnapshotReadyBadge(source) {
  return source === "github" ? "GitHub snapshot ready" : "Seeded fixture ready";
}
function formatSnapshotAge(timestampMs, nowMs) {
  const diffMs = nowMs - timestampMs;
  const absoluteDiffMs = Math.abs(diffMs);
  const minuteMs = 6e4;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (absoluteDiffMs < 45e3) {
    return "just now";
  }
  if (diffMs < 0) {
    return absoluteDiffMs < 5 * minuteMs ? "just now" : "recently";
  }
  if (absoluteDiffMs < hourMs) {
    return SNAPSHOT_RELATIVE_FORMATTER.format(-Math.round(diffMs / minuteMs), "minute");
  }
  if (absoluteDiffMs < dayMs) {
    return SNAPSHOT_RELATIVE_FORMATTER.format(-Math.round(diffMs / hourMs), "hour");
  }
  return SNAPSHOT_RELATIVE_FORMATTER.format(-Math.round(diffMs / dayMs), "day");
}
function buildSnapshotFreshnessCopy(generatedAt2, source, nowMs) {
  const sourceLabel = getSnapshotSourceLabel(source);
  const fallbackPrimary = "GitHub snapshot time unavailable";
  if (!generatedAt2) {
    return {
      badge: getSnapshotReadyBadge(source),
      detail: null,
      primary: fallbackPrimary,
      source,
      sourceLabel
    };
  }
  const timestamp = new Date(generatedAt2);
  if (Number.isNaN(timestamp.getTime())) {
    return {
      badge: getSnapshotReadyBadge(source),
      detail: null,
      primary: fallbackPrimary,
      source,
      sourceLabel
    };
  }
  const ageCopy = formatSnapshotAge(timestamp.getTime(), nowMs);
  return {
    badge: getSnapshotReadyBadge(source),
    detail: SNAPSHOT_DETAIL_FORMATTER.format(timestamp),
    primary: `GitHub data refreshed ${ageCopy}`,
    source,
    sourceLabel
  };
}
const SMOKE_CONNECTED_REPO_ID = "github-smoke-trust-refresh";
const SMOKE_CONNECTED_REPO_PROVIDER_ID = 1000001;
const SMOKE_ACTIVE_COMMIT_SHA = "6dfb92f31d9142b08d41a0c08ef2a53ef0a8fd41";
const SMOKE_REMOTE_COMMIT_SHA = "8a9124d61fb6ac9ec4a54356bdf0e79eb0e3a18f";
const SMOKE_CONNECTED_REPO_GENERATED_AT = "2026-03-08T13:45:00.000Z";
const SMOKE_REFRESH_CHECKED_AT = "2026-03-08T18:30:00.000Z";
const SMOKE_ELIGIBLE_REPO = {
  id: 1000010,
  name: "issue-radar",
  fullName: "acme-dev/issue-radar",
  ownerLogin: "acme-dev",
  defaultBranch: "main",
  visibility: "public"
};
const SMOKE_LISTED_ONLY_REPO = {
  id: 1000011,
  name: "incident-core",
  fullName: "acme-dev/incident-core",
  ownerLogin: "acme-dev",
  defaultBranch: "main",
  visibility: "private"
};
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function cloneSignals(signals2) {
  return signals2.map((signal) => ({ ...signal }));
}
function buildSmokeConnectedRepo() {
  const baseSnapshot = sampleRepoSnapshotJson;
  const latestCommitTarget = baseSnapshot.modules[0]?.id ?? "mod-frontend";
  return {
    ...baseSnapshot,
    repoId: SMOKE_CONNECTED_REPO_ID,
    generatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
    languages: baseSnapshot.languages.map((language) => ({ ...language })),
    modules: baseSnapshot.modules.map((module) => ({ ...module })),
    dependencyEdges: baseSnapshot.dependencyEdges.map((edge) => ({ ...edge })),
    signals: [
      ...cloneSignals(baseSnapshot.signals).filter((signal) => signal.type !== "latest_commit"),
      {
        type: "latest_commit",
        target: latestCommitTarget,
        severity: 0,
        title: `Latest commit on ${baseSnapshot.defaultBranch}`,
        detail: SMOKE_ACTIVE_COMMIT_SHA,
        value: SMOKE_ACTIVE_COMMIT_SHA
      }
    ],
    metadata: {
      ...baseSnapshot.metadata ?? {
        provider: "github",
        providerRepoId: SMOKE_CONNECTED_REPO_PROVIDER_ID,
        fullName: `${baseSnapshot.owner}/${baseSnapshot.name}`,
        description: null,
        htmlUrl: "https://github.com/yuvrajmuley/merge-crimes",
        homepageUrl: null,
        topics: [],
        stars: 0,
        forks: 0,
        watchers: 0,
        openIssues: 0,
        primaryLanguage: "TypeScript",
        license: null,
        archived: false,
        fork: false,
        updatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
        pushedAt: SMOKE_CONNECTED_REPO_GENERATED_AT
      },
      provider: "github",
      providerRepoId: SMOKE_CONNECTED_REPO_PROVIDER_ID,
      updatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
      pushedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
      topics: [...baseSnapshot.metadata?.topics ?? []]
    }
  };
}
function resetSmokeRepoCityHarness() {
  const store = useGameStore.getState();
  const smokeRepo = buildSmokeConnectedRepo();
  store.loadRepoCity(smokeRepo);
  useGameStore.setState({
    apiAvailable: true,
    apiConnectionState: "online",
    apiStatusMessage: null,
    writeSessionState: "ready",
    writeSessionMessage: null,
    githubAccessToken: null,
    githubAuthStatus: "anonymous",
    githubAuthMessage: null,
    selectedGitHubRepo: null,
    selectedGitHubRepoEligibility: null,
    selectedGitHubRepoIngestState: {
      tone: "idle",
      repoId: null,
      message: null
    },
    selectedGitHubRepoSnapshot: null,
    showGitHubRepoPicker: false,
    connectedRepoRefreshStatus: {
      ...createInitialConnectedRepoRefreshStatus(smokeRepo.signals),
      checkedAt: SMOKE_REFRESH_CHECKED_AT,
      lastKnownCommitSha: SMOKE_ACTIVE_COMMIT_SHA
    },
    credits: 0,
    reputation: 0,
    playerPosition: [0, 0.5, 0],
    districtRooms: {},
    showMissionPanel: false,
    showLeaderboard: false,
    showBulletin: false,
    rewardToasts: [],
    phase: "menu"
  });
  return smokeRepo;
}
function setTrustState(trustState) {
  if (trustState === "anonymous") {
    useGameStore.setState({
      githubAccessToken: null,
      githubAuthStatus: "anonymous",
      githubAuthMessage: null,
      selectedGitHubRepo: null,
      selectedGitHubRepoEligibility: null,
      selectedGitHubRepoIngestState: {
        tone: "idle",
        repoId: null,
        message: null
      },
      selectedGitHubRepoSnapshot: null,
      showGitHubRepoPicker: false
    });
    return;
  }
  const selectedRepo = trustState === "listed-only" ? SMOKE_LISTED_ONLY_REPO : SMOKE_ELIGIBLE_REPO;
  const selectedRepoEligibility = getGitHubRepoTranslationEligibility(selectedRepo.visibility);
  useGameStore.setState({
    githubAccessToken: "smoke-github-token",
    githubAuthStatus: "authenticated",
    githubAuthMessage: null,
    selectedGitHubRepo: selectedRepo,
    selectedGitHubRepoEligibility: selectedRepoEligibility,
    selectedGitHubRepoIngestState: trustState === "eligible-error" ? {
      tone: "error",
      repoId: selectedRepo.id,
      message: "GitHub did not return a readable snapshot. The current city is still active."
    } : {
      tone: "idle",
      repoId: null,
      message: null
    },
    selectedGitHubRepoSnapshot: null,
    showGitHubRepoPicker: false
  });
}
function setRefreshState(refreshState, smokeRepo) {
  const baseStatus = {
    ...createInitialConnectedRepoRefreshStatus(smokeRepo.signals),
    checkedAt: SMOKE_REFRESH_CHECKED_AT,
    lastKnownCommitSha: SMOKE_ACTIVE_COMMIT_SHA
  };
  useGameStore.setState({
    connectedRepoRefreshStatus: {
      ...baseStatus,
      status: "update_detected",
      latestRemoteCommitSha: SMOKE_REMOTE_COMMIT_SHA,
      hasNewerRemote: true
    }
  });
}
function getIdleRepoRefreshStatus() {
  return {
    tone: "idle",
    message: null,
    repoId: null
  };
}
function runScenario(scenario2) {
  const smokeRepo = resetSmokeRepoCityHarness();
  const freshnessCopy = buildSnapshotFreshnessCopy(smokeRepo.generatedAt, "github", Date.now());
  switch (scenario2) {
    case "menu-anonymous": {
      const state = useGameStore.getState();
      assert(state.repoCityMode, "Expected the smoke repo city harness to enable repo-city mode");
      assert(state.githubAuthStatus === "anonymous", "Expected the anonymous trust scenario to clear GitHub auth state");
      assert(freshnessCopy.primary.includes("GitHub data refreshed"), "Expected menu freshness copy for the GitHub snapshot");
      break;
    }
    case "menu-listed-only": {
      setTrustState("listed-only");
      const state = useGameStore.getState();
      const selectedRepoStatusCopy = buildSelectedRepoStatusCopy(
        state.selectedGitHubRepo,
        state.selectedGitHubRepoEligibility,
        false,
        state.connectedRepo,
        state.selectedGitHubRepoIngestState
      );
      assert(selectedRepoStatusCopy?.title === "Selected repo is listed only", "Expected the selected private repo state to stay listed-only");
      assert(state.selectedGitHubRepo?.visibility === "private", "Expected the listed-only scenario to select a private repo");
      break;
    }
    case "menu-eligible-error": {
      setTrustState("eligible-error");
      const state = useGameStore.getState();
      const selectedRepoStatusCopy = buildSelectedRepoStatusCopy(
        state.selectedGitHubRepo,
        state.selectedGitHubRepoEligibility,
        false,
        state.connectedRepo,
        state.selectedGitHubRepoIngestState
      );
      assert(selectedRepoStatusCopy?.title === "Selected repo is not ready", "Expected the harness to surface a deterministic ingest failure state");
      assert(state.selectedGitHubRepoIngestState.tone === "error", "Expected the ingest-error scenario to set the selected repo ingest tone");
      break;
    }
    case "menu-refresh-available": {
      setRefreshState("update-detected", smokeRepo);
      const state = useGameStore.getState();
      const refreshStatusCopy = buildRepoRefreshStatusCopy(
        state.connectedRepo,
        state.connectedRepoRefreshStatus,
        getIdleRepoRefreshStatus()
      );
      const refreshIndicatorTone = buildRepoRefreshIndicatorTone(
        state.connectedRepo,
        state.connectedRepoRefreshStatus,
        getIdleRepoRefreshStatus()
      );
      assert(refreshStatusCopy.pill === "Update detected", "Expected the menu refresh surface to report an available update");
      assert(refreshStatusCopy.title === "Newer snapshot available", "Expected the menu refresh surface to show the update-available title");
      assert(refreshIndicatorTone === "success", "Expected the menu refresh indicator tone to switch to success when updates are available");
      break;
    }
    case "hud-refresh-available": {
      setRefreshState("update-detected", smokeRepo);
      const state = useGameStore.getState();
      const repoRefreshNotice = buildRepoHudRefreshNotice(state.connectedRepo, state.connectedRepoRefreshStatus);
      assert(freshnessCopy.primary.includes("GitHub data refreshed"), "Expected the HUD provenance badge to render the GitHub freshness copy");
      assert(repoRefreshNotice?.title === "Newer snapshot available", "Expected the HUD to surface the refresh-available notice");
      assert(repoRefreshNotice?.detail.includes("Open the menu to refresh this repo snapshot."), "Expected the HUD refresh detail to keep the menu refresh guidance");
      break;
    }
    default:
      throw new Error(`Unknown smoke scenario: ${scenario2}`);
  }
  console.log(JSON.stringify({ scenario: scenario2, result: "pass" }));
}
const scenario = process.argv[2];
assert(scenario, "Expected a smoke scenario argument.");
runScenario(scenario);
