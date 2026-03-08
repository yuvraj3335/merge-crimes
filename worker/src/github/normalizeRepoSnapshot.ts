import type { GitHubRepoMetadataSnapshot, RepoLanguage } from '../../../shared/repoModel';
import { attachTopLevelRepoModules, type RepoTopLevelTreeEntry } from '../../../shared/repoTopLevelModules';
import { applySignalHeatToRepoModel } from '../../../shared/repoSignalMapping';
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

  const topLevelEntries = contents ? normalizeGitHubTopLevelEntries(contents) : [];
  const snapshotWithModules = attachTopLevelRepoModules(snapshot, topLevelEntries);
  const signals = await fetchRepoSignals({
    snapshot: snapshotWithModules,
    fetchGitHubJson,
  });

  return applySignalHeatToRepoModel({
    ...snapshotWithModules,
    signals,
  });
}
