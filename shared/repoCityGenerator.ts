// ─── Repo-to-City Generator ───
// Pure, deterministic translation layer: RepoModel -> GeneratedCity.
// No side effects, no network calls. Suitable for use in both frontend and worker.

import type {
  RepoModel,
  RepoModule,
  RepoSignal,
  RepoSignalType,
  RepoArchetype,
  DependencyEdge,
  GeneratedCity,
  GeneratedDistrict,
  GeneratedRoad,
  GeneratedMission,
  GeneratedMissionType,
  GeneratedBot,
  GeneratedBuilding,
  DistrictCategory,
  BotArchetype,
  DependencyReason,
} from './repoModel';

// ─── Module Kind -> District Category ───

const KIND_TO_CATEGORY: Record<string, DistrictCategory> = {
  app: 'interface',
  package: 'shared',
  service: 'service',
  folder: 'data',
  infra: 'ops',
  tests: 'validation',
  docs: 'archive',
  control: 'control',
};

// ─── Module Kind -> Stylized Name Prefix ───

const KIND_TO_LABEL_PREFIX: Record<string, string> = {
  app: 'Interface Quarter',
  package: 'Shared Core',
  service: 'Service Hub',
  folder: 'Data Sector',
  infra: 'Control Tower',
  tests: 'Validation Ring',
  docs: 'Archive Sector',
  control: 'Command Center',
};

const MODULE_NAME_ALIASES: Record<string, string> = {
  src: 'Source',
  ui: 'UI',
  'ui-kit': 'UI Kit',
  api: 'API',
  db: 'Data',
  ci: 'CI',
  docs: 'Docs',
  e2e: 'E2E',
  infra: 'Infra',
  frontend: 'Frontend',
  worker: 'Worker',
  shared: 'Shared',
  tests: 'Tests',
  examples: 'Examples',
  migrations: 'Migrations',
  web: 'Web',
  auth: 'Auth',
  admin: 'Admin',
  workspace: 'Workspace',
};

const DEFAULT_HUB_PRIORITY: Record<RepoModule['kind'], number> = {
  package: 0,
  infra: 1,
  control: 1,
  folder: 2,
  tests: 2,
  service: 4,
  app: 4,
  docs: 5,
};

const HUB_PRIORITY_BY_ARCHETYPE: Record<RepoArchetype, Partial<Record<RepoModule['kind'], number>>> = {
  frontend: {
    package: 0,
    tests: 1,
    folder: 2,
    app: 3,
    infra: 4,
    control: 4,
    docs: 5,
    service: 5,
  },
  backend: {
    package: 0,
    folder: 1,
    tests: 2,
    infra: 2,
    control: 2,
    service: 4,
    app: 5,
    docs: 5,
  },
  library: {
    package: 0,
    tests: 1,
    infra: 2,
    control: 2,
    docs: 3,
    folder: 3,
    service: 4,
    app: 4,
  },
  fullstack: {
    package: 0,
    infra: 1,
    control: 1,
    folder: 2,
    tests: 2,
    service: 4,
    app: 4,
    docs: 5,
  },
  monorepo: {
    package: -1,
    infra: 0,
    control: 0,
    folder: 2,
    tests: 1,
    service: 5,
    app: 6,
    docs: 7,
  },
  unknown: {},
};

type LayoutPosition = { x: number; y: number };

const ARCHETYPE_LAYOUT_SLOTS: Record<RepoArchetype, LayoutPosition[]> = {
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
    { x: 0, y: 96 },
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
    { x: 0, y: 96 },
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
    { x: 0, y: 88 },
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
    { x: 0, y: 100 },
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
    { x: 0, y: -74 },
  ],
  unknown: [],
};

// ─── District Color Palette ───

const DISTRICT_COLORS: Array<{ color: string; emissive: string }> = [
  { color: '#61DAFB', emissive: '#00BFFF' },
  { color: '#FF6B35', emissive: '#FF4500' },
  { color: '#FFD43B', emissive: '#FFD700' },
  { color: '#00ADD8', emissive: '#00CED1' },
  { color: '#3178C6', emissive: '#4169E1' },
  { color: '#A855F7', emissive: '#9333EA' },
  { color: '#10B981', emissive: '#059669' },
  { color: '#F43F5E', emissive: '#E11D48' },
  { color: '#8B5CF6', emissive: '#7C3AED' },
  { color: '#F59E0B', emissive: '#D97706' },
];

const ROAD_STYLE_BY_REASON: Record<DependencyReason, { color: string; emissive: string; baseWidth: number }> = {
  import: { color: '#0f172a', emissive: '#38bdf8', baseWidth: 2.6 },
  package_dependency: { color: '#111827', emissive: '#f59e0b', baseWidth: 3.2 },
  service_link: { color: '#1f2937', emissive: '#f97316', baseWidth: 3.8 },
  folder_reference: { color: '#0b1120', emissive: '#8b5cf6', baseWidth: 2.2 },
};

// ─── Signal -> Mission Template ───

interface MissionTemplate {
  titlePrefix: string;
  type: GeneratedMissionType;
  descriptionTemplate: string;
  objectiveTemplates: string[];
  baseDifficulty: 1 | 2 | 3 | 4 | 5;
}

const SIGNAL_MISSION_TEMPLATES: Partial<Record<RepoSignalType, MissionTemplate>> = {
  failing_workflow: {
    titlePrefix: 'Defend',
    type: 'defense',
    descriptionTemplate: 'The deployment pipeline is under attack. Hold the control terminal until the workflow stabilizes.',
    objectiveTemplates: ['Reach the control terminal', 'Defend the pipeline', 'Restore workflow stability'],
    baseDifficulty: 3,
  },
  open_issue: {
    titlePrefix: 'Stabilize',
    type: 'recovery',
    descriptionTemplate: 'Open issues are piling up in the district. Recover clean artifacts before the queue overruns the maintainers.',
    objectiveTemplates: ['Assess incoming issue reports', 'Recover clean artifacts', 'Restore district stability'],
    baseDifficulty: 2,
  },
  merge_conflict: {
    titlePrefix: 'BOSS: Resolve',
    type: 'boss',
    descriptionTemplate: 'A massive merge conflict has erupted. Enter the conflict core and resolve it before the codebase fractures.',
    objectiveTemplates: ['Enter the conflict zone', 'Analyze conflicting changes', 'Choose the correct resolution'],
    baseDifficulty: 4,
  },
  open_pr: {
    titlePrefix: 'Deliver',
    type: 'delivery',
    descriptionTemplate: 'Multiple pull requests need triage. Carry verified patches to the review terminal before the queue overflows.',
    objectiveTemplates: ['Collect pending patches', 'Navigate to the review terminal', 'Deliver before timeout'],
    baseDifficulty: 2,
  },
  security_alert: {
    titlePrefix: 'Purge',
    type: 'defense',
    descriptionTemplate: 'A security vulnerability has been detected. Purge the compromised dependency before it spreads.',
    objectiveTemplates: ['Locate the vulnerability', 'Isolate the affected module', 'Apply the security patch'],
    baseDifficulty: 4,
  },
  issue_spike: {
    titlePrefix: 'Stabilize',
    type: 'recovery',
    descriptionTemplate: 'A spike in reported issues is destabilizing the district. Recover clean artifacts before corruption spreads.',
    objectiveTemplates: ['Assess the damage', 'Recover clean artifacts', 'Restore district stability'],
    baseDifficulty: 3,
  },
  stale_pr: {
    titlePrefix: 'Recover',
    type: 'recovery',
    descriptionTemplate: 'A stale pull request has been abandoned in the district. Retrieve the useful changes before they rot.',
    objectiveTemplates: ['Locate the stale PR', 'Salvage useful changes', 'Clean up the branch'],
    baseDifficulty: 1,
  },
  flaky_tests: {
    titlePrefix: 'Sabotage Hunt',
    type: 'escape',
    descriptionTemplate: 'Flaky tests are masking real failures. Track down the saboteur bot before the test suite becomes meaningless.',
    objectiveTemplates: ['Identify flaky tests', 'Track the saboteur', 'Escape before the suite locks down'],
    baseDifficulty: 3,
  },
  dependency_drift: {
    titlePrefix: 'Supply Run',
    type: 'delivery',
    descriptionTemplate: 'Dependencies have drifted out of date. Deliver fresh packages to the module before incompatibilities cascade.',
    objectiveTemplates: ['Collect updated packages', 'Navigate dependency graph', 'Apply updates safely'],
    baseDifficulty: 2,
  },
};

// ─── Signal -> Bot Archetype ───

const SIGNAL_TO_BOT: Partial<Record<RepoSignalType, BotArchetype>> = {
  failing_workflow: 'saboteur',
  open_issue: 'regression',
  merge_conflict: 'merge',
  open_pr: 'hallucination',
  security_alert: 'dependency',
  issue_spike: 'regression',
  stale_pr: 'refactor',
  flaky_tests: 'saboteur',
  dependency_drift: 'dependency',
};

const BOT_NAMES: Record<BotArchetype, string[]> = {
  hallucination: ['Phantom Patcher', 'Ghost Writer', 'Mirage Bot'],
  merge: ['Conflict Core', 'Branch Breaker', 'Merge Mimic'],
  regression: ['Rollback Runner', 'Regression Agent', 'Revert Phantom'],
  dependency: ['Dep Leech', 'Package Poison', 'Supply Chain Ghost'],
  type: ['Type Siren', 'Schema Wraith', 'Contract Breaker'],
  refactor: ['Refactor Storm', 'Dead Code Walker', 'Cleanup Mirage'],
  saboteur: ['Test Saboteur', 'Pipeline Wrecker', 'CI Gremlin'],
};

function getMissionTemplate(signalType: RepoSignalType): MissionTemplate | null {
  return SIGNAL_MISSION_TEMPLATES[signalType] ?? null;
}

function getBotArchetype(signalType: RepoSignalType): BotArchetype | null {
  return SIGNAL_TO_BOT[signalType] ?? null;
}

function isActionableSignal(signal: RepoSignal): boolean {
  return signal.severity > 0
    && getMissionTemplate(signal.type) !== null
    && getBotArchetype(signal.type) !== null;
}

// ─── Layout Helpers ───

function humanizeModuleName(name: string): string {
  const key = name.toLowerCase();
  const alias = MODULE_NAME_ALIASES[key];
  if (alias) {
    return alias;
  }

  return key
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .map((part) => (part.length <= 2
      ? part.toUpperCase()
      : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(' ');
}

function moduleMatchesHints(mod: RepoModule, hints: string[]): boolean {
  const haystack = `${mod.name} ${mod.path}`.toLowerCase();
  return hints.some((hint) => haystack.includes(hint));
}

function getLanguageShare(repo: RepoModel, names: string[]): number {
  const languageNames = new Set(names.map((name) => name.toLowerCase()));

  return repo.languages.reduce((sum, language) => (
    languageNames.has(language.name.toLowerCase())
      ? sum + language.share
      : sum
  ), 0);
}

function classifyRepoArchetype(repo: RepoModel): RepoArchetype {
  const modulesText = repo.modules
    .map((mod) => `${mod.name} ${mod.path}`.toLowerCase())
    .join(' ');
  const hasTextHint = (...hints: string[]) => hints.some((hint) => modulesText.includes(hint));
  const hasAppsRoot = hasTextHint('apps/');
  const hasPackagesRoot = hasTextHint('packages/');
  const hasServicesRoot = hasTextHint('services/');
  const hasWorkspaceConfig = hasTextHint('pnpm-workspace', 'turbo.json', 'nx.json', 'workspace');
  const hasBackendHints = hasTextHint('api/', 'server/', 'routes/', 'controllers/', 'db/', 'migrations/');
  const hasFrontendRoots = hasTextHint('frontend/', 'public/', 'components/', 'pages/', 'web/', 'client/');
  const hasFrontendSurfaceHints = hasTextHint('ui/', 'stories/', 'storybook', 'styles/', 'assets/', 'icons/');
  const appCount = repo.modules.filter((mod) => mod.kind === 'app').length;
  const serviceCount = repo.modules.filter((mod) => mod.kind === 'service').length;
  const packageCount = repo.modules.filter((mod) => mod.kind === 'package').length;
  const testsCount = repo.modules.filter((mod) => mod.kind === 'tests').length;
  const frontendLanguageShare = getLanguageShare(
    repo,
    ['TypeScript', 'JavaScript', 'TSX', 'JSX', 'CSS', 'HTML', 'SCSS', 'Sass', 'Less', 'MDX', 'Vue', 'Svelte'],
  );
  const frontendMarkupShare = getLanguageShare(
    repo,
    ['CSS', 'HTML', 'SCSS', 'Sass', 'Less', 'MDX', 'Vue', 'Svelte'],
  );
  const looksFrontendByLanguage = (
    frontendLanguageShare >= 0.68
    && frontendMarkupShare >= 0.18
    && (hasFrontendRoots || hasFrontendSurfaceHints)
  );

  const workspaceRootCount = [hasAppsRoot, hasPackagesRoot, hasServicesRoot].filter(Boolean).length;

  if (workspaceRootCount >= 2 || hasWorkspaceConfig || (packageCount >= 3 && repo.modules.length >= 5)) {
    return 'monorepo';
  }
  if (appCount > 0 && serviceCount > 0) {
    return 'fullstack';
  }
  if (serviceCount > 0 || hasBackendHints) {
    return 'backend';
  }
  if (appCount > 0 || hasFrontendRoots || looksFrontendByLanguage) {
    return 'frontend';
  }
  if (
    packageCount > 0
    && testsCount > 0
    && repo.modules.length <= 4
    && frontendMarkupShare < 0.18
  ) {
    return 'library';
  }

  return repo.archetype;
}

function computeConnectivityScores(repo: RepoModel): Map<string, number> {
  const scores = new Map<string, number>(repo.modules.map((mod) => [mod.id, 0]));

  repo.dependencyEdges.forEach((edge) => {
    scores.set(edge.fromModuleId, (scores.get(edge.fromModuleId) ?? 0) + edge.weight);
    scores.set(edge.toModuleId, (scores.get(edge.toModuleId) ?? 0) + edge.weight * 0.85);
  });

  return scores;
}

function getHubPriority(mod: RepoModule, archetype: RepoArchetype): number {
  const override = HUB_PRIORITY_BY_ARCHETYPE[archetype][mod.kind];
  return override ?? DEFAULT_HUB_PRIORITY[mod.kind];
}

function orderModulesForLayout(
  modules: RepoModule[],
  archetype: RepoArchetype,
  connectivityScores: Map<string, number>,
): RepoModule[] {
  return [...modules].sort((a, b) => {
    const aScore = getHubPriority(a, archetype)
      - (connectivityScores.get(a.id) ?? 0) * 1.1
      - a.importanceScore / 140
      + ((a.kind === 'app' || a.kind === 'service') ? a.riskScore / 180 : 0);
    const bScore = getHubPriority(b, archetype)
      - (connectivityScores.get(b.id) ?? 0) * 1.1
      - b.importanceScore / 140
      + ((b.kind === 'app' || b.kind === 'service') ? b.riskScore / 180 : 0);

    return aScore - bScore || b.importanceScore - a.importanceScore || a.name.localeCompare(b.name);
  });
}

function computeLayoutPositions(
  archetype: RepoArchetype,
  count: number,
): Array<{ x: number; y: number }> {
  if (count <= 1) return [{ x: 0, y: 0 }];

  const template = ARCHETYPE_LAYOUT_SLOTS[archetype];
  if (template.length >= count) {
    return template.slice(0, count);
  }

  const positions: Array<{ x: number; y: number }> = [];
  const spacing = 55;

  if (count <= 4) {
    const cols = 2;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: (col - (cols - 1) / 2) * spacing,
        y: (row - Math.floor((count - 1) / cols / 2)) * spacing,
      });
    }
    return positions;
  }

  // Hub-and-spoke for 5+
  positions.push({ x: 0, y: 0 }); // center hub
  const outerCount = count - 1;
  const angleStep = (2 * Math.PI) / outerCount;
  const radius = spacing * 1.1;
  for (let i = 0; i < outerCount; i++) {
    const angle = angleStep * i - Math.PI / 2;
    positions.push({
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
    });
  }

  return positions;
}

function computeFootprint(
  mod: RepoModule,
  connectivityScore: number,
  archetype: RepoArchetype,
): { width: number; height: number } {
  const base = archetype === 'library' ? 24 : archetype === 'monorepo' ? 30 : 28;
  const scale = clamp(
    0.72 + (mod.importanceScore / 170) + connectivityScore * 0.14 + (mod.kind === 'package' ? 0.08 : 0),
    0.72,
    1.38,
  );
  const width = Math.round(base * scale);
  const heightScale = mod.kind === 'service' ? 1.08 : mod.kind === 'docs' ? 0.88 : 1;

  return {
    width,
    height: Math.round(width * heightScale),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deriveHeat(mod: RepoModule, signals: RepoSignal[]): number {
  const signalHeat = signals
    .filter((s) => s.target === mod.id && isActionableSignal(s))
    .reduce((sum, s) => sum + s.severity * 12, 0);
  const riskHeat = mod.riskScore * 0.35;
  const activityHeat = mod.activityScore * 0.18;
  return Math.min(100, Math.round(signalHeat + riskHeat + activityHeat));
}

function generateBuildings(mod: RepoModule): GeneratedBuilding[] {
  const buildings: GeneratedBuilding[] = [];
  const moduleName = humanizeModuleName(mod.name);

  if (mod.kind === 'app' || mod.kind === 'service') {
    buildings.push({
      id: `bld-${mod.id}-gate`,
      label: `${moduleName} Gateway`,
      kind: 'gate',
      fileCount: Math.ceil(mod.fileCount * 0.15),
    });
  }

  buildings.push({
    id: `bld-${mod.id}-main`,
    label: `${moduleName} Core`,
    kind: 'cluster',
    fileCount: Math.ceil(mod.fileCount * 0.6),
  });

  if (mod.kind === 'tests') {
    buildings.push({
      id: `bld-${mod.id}-shield`,
      label: 'Test Shield',
      kind: 'shield',
      fileCount: Math.ceil(mod.fileCount * 0.25),
    });
  }

  if (mod.kind === 'infra' || mod.kind === 'control') {
    buildings.push({
      id: `bld-${mod.id}-infra`,
      label: 'Infra Node',
      kind: 'infra',
      fileCount: Math.ceil(mod.fileCount * 0.25),
    });
  }

  if (mod.fileCount > 10 && mod.kind !== 'tests' && mod.kind !== 'infra') {
    buildings.push({
      id: `bld-${mod.id}-terminal`,
      label: `${moduleName} Terminal`,
      kind: 'terminal',
      fileCount: Math.ceil(mod.fileCount * 0.25),
    });
  }

  return buildings;
}

function buildDistrictLabelPrefix(
  mod: RepoModule,
  archetype: RepoArchetype,
): string {
  if (moduleMatchesHints(mod, ['shared', 'packages/', 'package', 'lib/']) || mod.kind === 'package') {
    if (archetype === 'monorepo') {
      return 'Workspace Core';
    }
    return archetype === 'library' ? 'Library Core' : 'Shared Core';
  }
  if (moduleMatchesHints(mod, ['frontend', 'web/', 'ui', 'client', 'public/', 'pages/', 'components/']) || mod.kind === 'app') {
    if (archetype === 'monorepo') {
      return 'App Ring';
    }
    return archetype === 'frontend' ? 'Interface Quarter' : 'Client Quarter';
  }
  if (moduleMatchesHints(mod, ['worker', 'api/', 'server/', 'backend', 'routes/', 'controllers/']) || mod.kind === 'service') {
    return archetype === 'backend' ? 'Runtime Bastion' : 'Service Spine';
  }
  if (moduleMatchesHints(mod, ['db', 'data', 'migration']) || mod.kind === 'folder') {
    return 'Data Vault';
  }
  if (moduleMatchesHints(mod, ['test', 'spec', 'qa']) || mod.kind === 'tests') {
    return 'Validation Ring';
  }
  if (moduleMatchesHints(mod, ['.github', 'ci', 'infra', 'ops']) || mod.kind === 'infra' || mod.kind === 'control') {
    if (archetype === 'monorepo') {
      return 'Workspace Control';
    }
    return archetype === 'library' ? 'Release Gate' : 'Control Tower';
  }
  if (moduleMatchesHints(mod, ['example', 'storybook']) || (mod.kind === 'docs' && archetype === 'library')) {
    return 'Example Arcade';
  }
  if (moduleMatchesHints(mod, ['docs']) || mod.kind === 'docs') {
    return 'Archive Sector';
  }

  return KIND_TO_LABEL_PREFIX[mod.kind] ?? 'Sector';
}

function buildDistrictLabel(mod: RepoModule, archetype: RepoArchetype): string {
  return `${buildDistrictLabelPrefix(mod, archetype)}: ${humanizeModuleName(mod.name)}`;
}

function buildDistrictDescription(
  repo: RepoModel,
  mod: RepoModule,
  archetype: RepoArchetype,
  connectivityScore: number,
): string {
  const districtRole = connectivityScore >= 1.5
    ? 'core junction'
    : (mod.kind === 'app' || mod.kind === 'service')
      ? 'frontline district'
      : 'support district';

  return `${humanizeModuleName(mod.name)} is the ${districtRole} for ${repo.owner}/${repo.name} (${archetype}) — ${mod.path}`;
}

function projectRoadAnchor(
  district: GeneratedDistrict,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const outwardX = dx === 0 ? 1 : Math.sign(dx);
  const outwardY = dy === 0 ? 1 : Math.sign(dy);

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: Math.round((district.position.x + outwardX * (district.footprint.width / 2 + 2)) * 10) / 10,
      y: district.position.y,
    };
  }

  return {
    x: district.position.x,
    y: Math.round((district.position.y + outwardY * (district.footprint.height / 2 + 2)) * 10) / 10,
  };
}

function buildRoadPoints(
  fromDistrict: GeneratedDistrict,
  toDistrict: GeneratedDistrict,
): Array<{ x: number; y: number }> {
  const dx = toDistrict.position.x - fromDistrict.position.x;
  const dy = toDistrict.position.y - fromDistrict.position.y;
  const start = projectRoadAnchor(fromDistrict, dx, dy);
  const end = projectRoadAnchor(toDistrict, -dx, -dy);

  if (Math.abs(dx) < 10 || Math.abs(dy) < 10) {
    return [start, end];
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = Math.round(((start.x + end.x) / 2) * 10) / 10;
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ];
  }

  const midY = Math.round(((start.y + end.y) / 2) * 10) / 10;
  return [
    start,
    { x: start.x, y: midY },
    { x: end.x, y: midY },
    end,
  ];
}

function selectReadableEdges(
  archetype: RepoArchetype,
  repo: RepoModel,
  activeModuleIds: Set<string>,
): DependencyEdge[] {
  const outboundLimit = archetype === 'monorepo' ? 3 : 2;
  const groupedEdges = new Map<string, DependencyEdge[]>();

  repo.dependencyEdges.forEach((edge) => {
    if (
      edge.fromModuleId === edge.toModuleId
      || !activeModuleIds.has(edge.fromModuleId)
      || !activeModuleIds.has(edge.toModuleId)
    ) {
      return;
    }

    const current = groupedEdges.get(edge.fromModuleId) ?? [];
    current.push(edge);
    groupedEdges.set(edge.fromModuleId, current);
  });

  const dedupedEdges = new Map<string, DependencyEdge>();

  groupedEdges.forEach((edges) => {
    edges
      .sort((a, b) => b.weight - a.weight || a.toModuleId.localeCompare(b.toModuleId))
      .slice(0, outboundLimit)
      .filter((edge) => edge.weight >= 0.35)
      .forEach((edge) => {
        const pairKey = [edge.fromModuleId, edge.toModuleId].sort().join('::');
        const existing = dedupedEdges.get(pairKey);
        if (!existing || edge.weight > existing.weight) {
          dedupedEdges.set(pairKey, edge);
        }
      });
  });

  return [...dedupedEdges.values()].sort(
    (a, b) => b.weight - a.weight || a.fromModuleId.localeCompare(b.fromModuleId),
  );
}

function generateRoads(
  repo: RepoModel,
  districts: GeneratedDistrict[],
  archetype: RepoArchetype,
): GeneratedRoad[] {
  if (districts.length < 2) {
    return [];
  }

  const districtByModuleId = new Map(districts.map((district) => [district.moduleId, district] as const));
  const activeModuleIds = new Set(districts.map((district) => district.moduleId));

  return selectReadableEdges(archetype, repo, activeModuleIds)
    .map((edge) => {
      const fromDistrict = districtByModuleId.get(edge.fromModuleId);
      const toDistrict = districtByModuleId.get(edge.toModuleId);

      if (!fromDistrict || !toDistrict) {
        return null;
      }

      const style = ROAD_STYLE_BY_REASON[edge.reason];

      return {
        id: makeId('road', repo.repoId, edge.fromModuleId, edge.toModuleId),
        fromDistrictId: fromDistrict.id,
        toDistrictId: toDistrict.id,
        reason: edge.reason,
        weight: edge.weight,
        width: Math.round(clamp(style.baseWidth + edge.weight * 2.4, 2.2, 6.4) * 10) / 10,
        color: style.color,
        emissive: style.emissive,
        points: buildRoadPoints(fromDistrict, toDistrict),
      };
    })
    .filter((road): road is GeneratedRoad => road !== null);
}

// ─── Deterministic ID Helper ───

function makeId(prefix: string, ...parts: string[]): string {
  const slug = parts.map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-');
  return `${prefix}-${slug}`;
}

// ─── Main Generator ───

export function generateCityFromRepo(repo: RepoModel): GeneratedCity {
  const archetype = classifyRepoArchetype(repo);
  const connectivityScores = computeConnectivityScores(repo);

  // Sort modules: highest importance first, then reorder them into archetype-aware hub/perimeter slots.
  const sortedModules = [...repo.modules].sort(
    (a, b) => b.importanceScore - a.importanceScore,
  );

  // Cap at 10 districts per system design
  const activeModules = orderModulesForLayout(
    sortedModules.slice(0, 10),
    archetype,
    connectivityScores,
  );
  const positions = computeLayoutPositions(archetype, activeModules.length);

  // Generate districts
  const maxFileCount = Math.max(1, ...activeModules.map((mod) => mod.fileCount));

  const districts: GeneratedDistrict[] = activeModules.map((mod, idx) => {
    const connectivityScore = connectivityScores.get(mod.id) ?? 0;
    const category = KIND_TO_CATEGORY[mod.kind] ?? 'shared';
    const label = buildDistrictLabel(mod, archetype);
    const palette = DISTRICT_COLORS[idx % DISTRICT_COLORS.length];
    const heat = deriveHeat(mod, repo.signals);
    const footprint = computeFootprint(mod, connectivityScore, archetype);
    const buildings = generateBuildings(mod);

    return {
      id: makeId('dist', repo.repoId, mod.id),
      moduleId: mod.id,
      name: humanizeModuleName(mod.name),
      label,
      description: buildDistrictDescription(repo, mod, archetype, connectivityScore),
      category,
      color: palette.color,
      emissive: palette.emissive,
      sizeScore: Math.round(
        (mod.fileCount / maxFileCount) * 100,
      ),
      heatLevel: heat,
      riskLevel: mod.riskScore,
      position: positions[idx],
      footprint,
      buildings,
    };
  });

  const roads = generateRoads(repo, districts, archetype);
  const actionableSignals = repo.signals.filter(isActionableSignal);

  // Generate missions from signals
  const missions: GeneratedMission[] = actionableSignals.flatMap((signal, idx) => {
    const template = getMissionTemplate(signal.type);
    if (!template) {
      return [];
    }

    const targetDistrict = districts.find((d) => d.moduleId === signal.target);
    const districtId = targetDistrict?.id ?? districts[0]?.id ?? 'unknown';

    const difficulty = Math.min(5, Math.max(1, Math.round(
      (template.baseDifficulty + signal.severity) / 2,
    ))) as 1 | 2 | 3 | 4 | 5;

    const title = signal.title
      ? `${template.titlePrefix}: ${signal.title}`
      : `${template.titlePrefix}: ${signal.type.replace(/_/g, ' ')} in ${targetDistrict?.name ?? 'unknown'}`;

    return [{
      id: makeId('mission', repo.repoId, signal.type, String(idx)),
      districtId,
      title,
      type: template.type,
      difficulty,
      sourceSignalType: signal.type,
      targetRef: signal.target,
      description: signal.detail ?? template.descriptionTemplate,
      objectives: template.objectiveTemplates,
    }];
  });

  // Generate bots from signals
  const bots: GeneratedBot[] = actionableSignals.flatMap((signal, idx) => {
    const archetype = getBotArchetype(signal.type);
    if (!archetype) {
      return [];
    }

    const names = BOT_NAMES[archetype];
    const name = names[idx % names.length];
    const targetDistrict = districts.find((d) => d.moduleId === signal.target);
    const districtId = targetDistrict?.id ?? districts[0]?.id ?? 'unknown';

    return [{
      id: makeId('bot', repo.repoId, archetype, String(idx)),
      archetype,
      name,
      districtId,
      threatLevel: signal.severity,
    }];
  });

  return {
    repoId: repo.repoId,
    repoName: repo.name,
    repoOwner: repo.owner,
    archetype,
    districts,
    roads,
    missions,
    bots,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Bridge: GeneratedCity -> existing game types ───
// Converts a GeneratedCity into the District[] and Mission[] shapes the existing
// game store and UI already understand, so the repo-city can be displayed without
// rewriting the entire frontend.

import type { District, Mission, MergeConflictEncounter, FactionId } from './types';

const ARCHETYPE_FACTIONS: Record<string, FactionId> = {
  interface: 'chrome-syndicate',
  service: 'node-mafia',
  data: 'python-cartel',
  ops: 'go-yakuza',
  validation: 'rust-collective',
  archive: 'unaligned',
  shared: 'node-mafia',
  control: 'go-yakuza',
};

export function generatedCityToDistricts(city: GeneratedCity): District[] {
  return city.districts.map((gd) => ({
    id: gd.id,
    name: gd.label,
    description: gd.description,
    color: gd.color,
    emissive: gd.emissive,
    position: [gd.position.x, gd.position.y] as [number, number],
    size: [gd.footprint.width, gd.footprint.height] as [number, number],
    faction: ARCHETYPE_FACTIONS[gd.category] ?? 'unaligned',
    heatLevel: gd.heatLevel,
    repoSource: {
      owner: city.repoOwner,
      repo: city.repoName,
      language: gd.category,
      stars: 0,
      openIssues: city.missions.filter((m) => m.districtId === gd.id).length,
      lastActivity: city.generatedAt,
    },
    missionIds: city.missions
      .filter((m) => m.districtId === gd.id)
      .map((m) => m.id),
  }));
}

export function generatedCityToMissions(city: GeneratedCity): Mission[] {
  return city.missions.map((gm) => {
    const district = city.districts.find((d) => d.id === gm.districtId);
    const pos = district?.position ?? { x: 0, y: 0 };

    return {
      id: gm.id,
      title: gm.title,
      description: gm.description,
      type: gm.type,
      districtId: gm.districtId,
      difficulty: gm.difficulty,
      timeLimit: gm.type === 'boss' ? 60 : 45,
      reward: gm.difficulty * 100,
      factionReward: gm.difficulty * 8,
      status: 'available' as const,
      objectives: gm.objectives,
      waypoints: gm.objectives.map((obj, i) => ({
        id: `${gm.id}-wp-${i}`,
        label: obj,
        position: [
          pos.x + (i - 1) * 8,
          0.5,
          pos.y + (i - 1) * 5,
        ] as [number, number, number],
        radius: 4,
        order: i,
      })),
    };
  });
}

export function generatedCityToConflicts(city: GeneratedCity): MergeConflictEncounter[] {
  const bossMissions = city.missions.filter((m) => m.type === 'boss');

  return bossMissions.map((bm) => {
    const bot = city.bots.find((b) => b.districtId === bm.districtId);
    const district = city.districts.find((d) => d.id === bm.districtId);

    return {
      id: `conflict-${bm.id}`,
      title: bm.title,
      description: bm.description,
      difficulty: bm.difficulty,
      timeLimit: 30,
      districtId: bm.districtId,
      reward: bm.difficulty * 150,
      hunks: [
        {
          id: 1,
          label: `${bot?.name ?? 'AI Bot'}'s patch`,
          code: `// ${bot?.name ?? 'Bot'} suggests:\nconst fix = applyUnsafe(${district?.name ?? 'module'});\n// Looks correct but skips validation`,
          side: 'theirs' as const,
        },
        {
          id: 2,
          label: 'Your verified fix',
          code: `// Verified approach:\nconst fix = applySafe(${district?.name ?? 'module'});\nvalidate(fix);\n// Slower but correct`,
          side: 'ours' as const,
        },
        {
          id: 3,
          label: 'Combined resolution',
          code: `// Best of both:\nconst fix = applyOptimized(${district?.name ?? 'module'});\nassert(validate(fix));\n// Fast and verified`,
          side: 'resolved' as const,
        },
      ],
      correctOrder: [3],
    };
  });
}
