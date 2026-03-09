import type { RepoModel, RepoModule, RepoModuleKind, RepoSignal, RepoSignalType } from './repoModel';

const DEFAULT_SIGNAL_KIND_PRIORITY: readonly RepoModuleKind[] = [
  'service',
  'app',
  'package',
  'folder',
  'control',
  'tests',
  'infra',
  'docs',
];

const SIGNAL_KIND_PRIORITY: Record<RepoSignalType, readonly RepoModuleKind[]> = {
  failing_workflow: ['control', 'infra', 'tests', 'service', 'app', 'package', 'folder', 'docs'],
  open_issue: ['service', 'app', 'folder', 'tests', 'package', 'control', 'infra', 'docs'],
  open_pr: ['service', 'app', 'package', 'control', 'folder', 'tests', 'infra', 'docs'],
  merge_conflict: ['service', 'app', 'package', 'control', 'folder', 'tests', 'infra', 'docs'],
  security_alert: ['package', 'service', 'infra', 'control', 'app', 'folder', 'tests', 'docs'],
  issue_spike: ['service', 'app', 'folder', 'tests', 'package', 'control', 'infra', 'docs'],
  stale_pr: ['package', 'service', 'app', 'control', 'folder', 'tests', 'infra', 'docs'],
  flaky_tests: ['tests', 'service', 'app', 'control', 'package', 'folder', 'infra', 'docs'],
  dependency_drift: ['package', 'service', 'infra', 'control', 'app', 'folder', 'tests', 'docs'],
  latest_commit: ['service', 'app', 'package', 'folder', 'control', 'infra', 'tests', 'docs'],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getKindPriority(signalType: RepoSignalType, moduleKind: RepoModuleKind): number {
  const priority = SIGNAL_KIND_PRIORITY[signalType] ?? DEFAULT_SIGNAL_KIND_PRIORITY;
  const rank = priority.indexOf(moduleKind);
  return rank >= 0 ? rank : priority.length;
}

function compareModulesForSignal(signalType: RepoSignalType, left: RepoModule, right: RepoModule): number {
  const priorityDifference = getKindPriority(signalType, left.kind) - getKindPriority(signalType, right.kind);
  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return (
    right.importanceScore - left.importanceScore
    || right.activityScore - left.activityScore
    || right.riskScore - left.riskScore
    || right.fileCount - left.fileCount
    || left.path.localeCompare(right.path)
  );
}

export function rankModulesForSignalTargets(
  repo: Pick<RepoModel, 'modules'>,
  signalType: RepoSignalType,
): RepoModule[] {
  return [...repo.modules].sort((left, right) => compareModulesForSignal(signalType, left, right));
}

function resolveExplicitTargetModule(repo: RepoModel, signal: RepoSignal): RepoModule | undefined {
  if (!signal.target) {
    return undefined;
  }

  const directModule = repo.modules.find((module) => module.id === signal.target);
  if (directModule) {
    return directModule;
  }

  const normalizedTarget = normalizeLookupValue(signal.target);
  if (!normalizedTarget) {
    return undefined;
  }

  const repoLevelTarget = normalizeLookupValue(repo.repoId);
  const repoNameTarget = normalizeLookupValue(`${repo.owner}/${repo.name}`);
  if (normalizedTarget === repoLevelTarget || normalizedTarget === repoNameTarget) {
    return undefined;
  }

  return repo.modules.find((module) => (
    normalizeLookupValue(module.path) === normalizedTarget
    || normalizeLookupValue(module.name) === normalizedTarget
  ));
}

function resolveSignalTargetModule(repo: RepoModel, signal: RepoSignal): RepoModule | undefined {
  const explicitTarget = resolveExplicitTargetModule(repo, signal);
  if (explicitTarget) {
    return explicitTarget;
  }

  return rankModulesForSignalTargets(repo, signal.type)[0];
}

function getSignalHeatContribution(signal: RepoSignal): number {
  if (signal.severity <= 0) {
    return 0;
  }

  return signal.severity * 12;
}

export function calculateRepoModuleBaseHeat(module: RepoModule): number {
  return clamp(Math.round(module.riskScore * 0.35 + module.activityScore * 0.18), 0, 100);
}

export function applySignalHeatToRepoModel<T extends RepoModel>(repo: T): T {
  const mappedSignals = repo.signals.map((signal) => {
    const targetModule = resolveSignalTargetModule(repo, signal);
    return targetModule
      ? { ...signal, target: targetModule.id }
      : signal;
  });

  const heatByModuleId = new Map<string, number>();
  repo.modules.forEach((module) => {
    heatByModuleId.set(module.id, calculateRepoModuleBaseHeat(module));
  });

  mappedSignals.forEach((signal) => {
    const currentHeat = heatByModuleId.get(signal.target);
    if (typeof currentHeat !== 'number') {
      return;
    }

    heatByModuleId.set(signal.target, clamp(currentHeat + getSignalHeatContribution(signal), 0, 100));
  });

  return {
    ...repo,
    modules: repo.modules.map((module) => ({
      ...module,
      heatScore: heatByModuleId.get(module.id) ?? calculateRepoModuleBaseHeat(module),
    })),
    signals: mappedSignals,
  } as T;
}
