import type {
  DependencyEdge,
  GitHubRepoMetadataSnapshot,
  RepoLanguage,
  RepoModule,
} from '../../../shared/repoModel.ts';
import { attachTopLevelRepoModules, type RepoTopLevelTreeEntry } from '../../../shared/repoTopLevelModules.ts';
import { applySignalHeatToRepoModel } from '../../../shared/repoSignalMapping.ts';
import { fetchRepoSignals, type GitHubJsonFetcher } from './fetchRepoSignals';

export interface GitHubRepoResponse {
  id: number;
  owner: { login: string };
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  subscribers_count?: number;
  open_issues_count: number;
  default_branch: string;
  language: string | null;
  private: boolean;
  archived: boolean;
  fork: boolean;
  updated_at: string;
  pushed_at: string | null;
  license: {
    spdx_id: string | null;
    name: string;
  } | null;
}

export type GitHubRepoLanguagesResponse = Record<string, number>;

export interface GitHubRepoContentEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size?: number;
}

export type GitHubRepoContentsResponse = GitHubRepoContentEntry | GitHubRepoContentEntry[];

interface NormalizeGitHubRepoSnapshotOptions {
  repo: GitHubRepoResponse;
  languages: GitHubRepoLanguagesResponse;
  contents?: GitHubRepoContentsResponse;
  fetchGitHubJson: GitHubJsonFetcher;
}

function normalizeGitHubLanguages(payload: GitHubRepoLanguagesResponse): RepoLanguage[] {
  const totalBytes = Object.values(payload).reduce((sum, bytes) => sum + bytes, 0);

  return Object.entries(payload)
    .sort(([, leftBytes], [, rightBytes]) => rightBytes - leftBytes)
    .map(([name, bytes]) => ({
      name,
      bytes,
      share: totalBytes > 0 ? bytes / totalBytes : 0,
    }));
}

function normalizeGitHubTopLevelEntries(payload: GitHubRepoContentsResponse): RepoTopLevelTreeEntry[] {
  const entries = Array.isArray(payload) ? payload : [payload];

  return entries.flatMap((entry) => {
    if (entry.type !== 'dir' && entry.type !== 'file') {
      return [];
    }

    return [{
      name: entry.name,
      path: entry.path,
      type: entry.type === 'dir' ? 'directory' : 'file',
      size: entry.size ?? 0,
    }];
  });
}

function moduleMatchesAnyHint(module: RepoModule, hints: readonly string[]): boolean {
  const values = [module.name, module.path].map((value) => value.trim().toLowerCase());
  return values.some((value) => hints.some((hint) => (
    value === hint
    || value.startsWith(`${hint}/`)
    || value.includes(`/${hint}/`)
    || value.endsWith(`/${hint}`)
  )));
}

function pushSyntheticEdge(
  edges: DependencyEdge[],
  seenKeys: Set<string>,
  fromModule: RepoModule,
  toModule: RepoModule,
  weight: number,
  reason: DependencyEdge['reason'],
): void {
  if (fromModule.id === toModule.id) {
    return;
  }

  const edgeKey = `${fromModule.id}->${toModule.id}:${reason}`;
  if (seenKeys.has(edgeKey)) {
    return;
  }

  seenKeys.add(edgeKey);
  edges.push({
    fromModuleId: fromModule.id,
    toModuleId: toModule.id,
    weight,
    reason,
  });
}

function buildSyntheticDependencyEdges(modules: RepoModule[]): DependencyEdge[] {
  if (modules.length < 2) {
    return [];
  }

  const sortedModules = [...modules].sort((left, right) => (
    right.importanceScore - left.importanceScore
    || right.fileCount - left.fileCount
    || left.path.localeCompare(right.path)
  ));
  const packages = sortedModules.filter((module) => module.kind === 'package');
  const apps = sortedModules.filter((module) => module.kind === 'app');
  const services = sortedModules.filter((module) => module.kind === 'service');
  const tests = sortedModules.filter((module) => module.kind === 'tests');
  const supportModules = sortedModules.filter((module) => module.kind === 'infra' || module.kind === 'control');
  const folders = sortedModules.filter((module) => module.kind === 'folder');
  const dataFolders = folders.filter((module) => moduleMatchesAnyHint(module, ['data', 'db', 'database', 'schema', 'store', 'migration']));
  const packageTargets = packages.length > 0 ? packages : folders.slice(0, 2);
  const edges: DependencyEdge[] = [];
  const seenKeys = new Set<string>();

  apps.forEach((appModule) => {
    packageTargets.slice(0, 3).forEach((packageModule) => {
      pushSyntheticEdge(edges, seenKeys, appModule, packageModule, 0.82, 'package_dependency');
    });
    services.slice(0, 2).forEach((serviceModule) => {
      pushSyntheticEdge(edges, seenKeys, appModule, serviceModule, 0.58, 'service_link');
    });
    supportModules.slice(0, 1).forEach((supportModule) => {
      pushSyntheticEdge(edges, seenKeys, appModule, supportModule, 0.38, 'folder_reference');
    });
  });

  services.forEach((serviceModule) => {
    packageTargets.slice(0, 3).forEach((packageModule) => {
      pushSyntheticEdge(edges, seenKeys, serviceModule, packageModule, 0.78, 'package_dependency');
    });
    (dataFolders.length > 0 ? dataFolders : folders).slice(0, 2).forEach((folderModule) => {
      pushSyntheticEdge(edges, seenKeys, serviceModule, folderModule, 0.56, 'service_link');
    });
    supportModules.slice(0, 1).forEach((supportModule) => {
      pushSyntheticEdge(edges, seenKeys, serviceModule, supportModule, 0.42, 'service_link');
    });
  });

  tests.forEach((testModule) => {
    [...apps, ...services, ...packages].slice(0, 2).forEach((targetModule) => {
      pushSyntheticEdge(edges, seenKeys, testModule, targetModule, 0.46, 'import');
    });
  });

  supportModules.forEach((supportModule) => {
    [...apps, ...services, ...packages].slice(0, 2).forEach((targetModule) => {
      pushSyntheticEdge(edges, seenKeys, supportModule, targetModule, 0.36, 'folder_reference');
    });
  });

  if (edges.length === 0) {
    const [primaryModule, ...remainingModules] = sortedModules;
    remainingModules.slice(0, 2).forEach((module) => {
      pushSyntheticEdge(edges, seenKeys, primaryModule, module, 0.4, 'folder_reference');
    });
  }

  return edges;
}

export async function normalizeGitHubRepoSnapshot({
  repo,
  languages,
  contents,
  fetchGitHubJson,
}: NormalizeGitHubRepoSnapshotOptions): Promise<GitHubRepoMetadataSnapshot> {
  const snapshot: GitHubRepoMetadataSnapshot = {
    repoId: `github:${repo.id}`,
    owner: repo.owner.login,
    name: repo.name,
    defaultBranch: repo.default_branch,
    visibility: repo.private ? 'private' : 'public',
    archetype: 'unknown',
    languages: normalizeGitHubLanguages(languages),
    modules: [],
    dependencyEdges: [],
    signals: [],
    generatedAt: new Date().toISOString(),
    metadata: {
      provider: 'github',
      providerRepoId: repo.id,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      homepageUrl: repo.homepage,
      topics: repo.topics ?? [],
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.subscribers_count ?? repo.watchers_count,
      openIssues: repo.open_issues_count,
      primaryLanguage: repo.language,
      license: repo.license?.spdx_id ?? repo.license?.name ?? null,
      archived: repo.archived,
      fork: repo.fork,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
    },
  };

  const rawTopLevelEntries = contents ? normalizeGitHubTopLevelEntries(contents) : [];
  // When /contents is unavailable, synthesize a single root module so the city
  // generator always has at least one district to lay out (prevents Infinity bounds).
  const topLevelEntries: RepoTopLevelTreeEntry[] = rawTopLevelEntries.length > 0
    ? rawTopLevelEntries
    : [{
        name: repo.name,
        path: repo.name,
        type: 'directory',
        size: 0,
      }];
  const snapshotWithModules = attachTopLevelRepoModules(snapshot, topLevelEntries);
  const snapshotWithDependencies: GitHubRepoMetadataSnapshot = {
    ...snapshotWithModules,
    dependencyEdges: buildSyntheticDependencyEdges(snapshotWithModules.modules),
  };
  const signals = await fetchRepoSignals({
    snapshot: snapshotWithDependencies,
    fetchGitHubJson,
  });

  return applySignalHeatToRepoModel({
    ...snapshotWithDependencies,
    signals,
  });
}
