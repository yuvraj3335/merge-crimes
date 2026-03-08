import { calculateRepoModuleBaseHeat } from './repoSignalMapping';
import type {
  DistrictCategory,
  GeneratedBuilding,
  GeneratedDistrict,
  RepoArchetype,
  RepoModel,
  RepoModule,
  RepoSignal,
} from './repoModel';
import { clamp, humanizeModuleName, makeId } from './repoCityGeneratorUtils';
import { isActionableSignal } from './signalMissionGeneration';

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

function moduleMatchesHints(mod: RepoModule, hints: string[]): boolean {
  const haystack = `${mod.name} ${mod.path}`.toLowerCase();
  return hints.some((hint) => haystack.includes(hint));
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

function deriveHeat(mod: RepoModule, signals: RepoSignal[]): number {
  if (typeof mod.heatScore === 'number') {
    return clamp(Math.round(mod.heatScore), 0, 100);
  }

  const signalHeat = signals
    .filter((signal) => signal.target === mod.id && isActionableSignal(signal))
    .reduce((sum, signal) => sum + signal.severity * 12, 0);
  return clamp(Math.round(calculateRepoModuleBaseHeat(mod) + signalHeat), 0, 100);
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

export function buildDistrictLabelPrefix(
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

export function buildGeneratedDistricts(
  repo: RepoModel,
  activeModules: RepoModule[],
  archetype: RepoArchetype,
  positions: Array<{ x: number; y: number }>,
  connectivityScores: Map<string, number>,
): GeneratedDistrict[] {
  const maxFileCount = Math.max(1, ...activeModules.map((mod) => mod.fileCount));

  return activeModules.map((mod, index) => {
    const connectivityScore = connectivityScores.get(mod.id) ?? 0;
    const palette = DISTRICT_COLORS[index % DISTRICT_COLORS.length];

    return {
      id: makeId('dist', repo.repoId, mod.id),
      moduleId: mod.id,
      name: humanizeModuleName(mod.name),
      label: buildDistrictLabel(mod, archetype),
      description: buildDistrictDescription(repo, mod, archetype, connectivityScore),
      category: KIND_TO_CATEGORY[mod.kind] ?? 'shared',
      color: palette.color,
      emissive: palette.emissive,
      sizeScore: Math.round((mod.fileCount / maxFileCount) * 100),
      heatLevel: deriveHeat(mod, repo.signals),
      riskLevel: mod.riskScore,
      position: positions[index] ?? { x: 0, y: 0 },
      footprint: computeFootprint(mod, connectivityScore, archetype),
      buildings: generateBuildings(mod),
    };
  });
}
