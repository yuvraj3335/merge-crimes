import type { RepoArchetype, RepoModel, RepoModule } from './repoModel';

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

function getLanguageShare(repo: RepoModel, names: string[]): number {
  const languageNames = new Set(names.map((name) => name.toLowerCase()));

  return repo.languages.reduce((sum, language) => (
    languageNames.has(language.name.toLowerCase())
      ? sum + language.share
      : sum
  ), 0);
}

export function classifyRepoArchetype(repo: RepoModel): RepoArchetype {
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

export function computeConnectivityScores(repo: RepoModel): Map<string, number> {
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
): LayoutPosition[] {
  if (count <= 1) {
    return [{ x: 0, y: 0 }];
  }

  const template = ARCHETYPE_LAYOUT_SLOTS[archetype];
  if (template.length >= count) {
    return template.slice(0, count);
  }

  const positions: LayoutPosition[] = [];
  const spacing = 55;

  if (count <= 4) {
    const cols = 2;
    for (let index = 0; index < count; index += 1) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions.push({
        x: (col - (cols - 1) / 2) * spacing,
        y: (row - Math.floor((count - 1) / cols / 2)) * spacing,
      });
    }
    return positions;
  }

  positions.push({ x: 0, y: 0 });
  const outerCount = count - 1;
  const angleStep = (2 * Math.PI) / outerCount;
  const radius = spacing * 1.1;
  for (let index = 0; index < outerCount; index += 1) {
    const angle = angleStep * index - Math.PI / 2;
    positions.push({
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
    });
  }

  return positions;
}

export function planDistrictLayout(
  modules: RepoModule[],
  archetype: RepoArchetype,
  connectivityScores: Map<string, number>,
): {
  activeModules: RepoModule[];
  positions: LayoutPosition[];
} {
  const sortedModules = [...modules].sort((a, b) => b.importanceScore - a.importanceScore);
  const activeModules = orderModulesForLayout(
    sortedModules.slice(0, 10),
    archetype,
    connectivityScores,
  );

  return {
    activeModules,
    positions: computeLayoutPositions(archetype, activeModules.length),
  };
}
