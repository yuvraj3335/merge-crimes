import type { RepoModel, RepoModule, RepoSignal } from '../../../shared/repoModel.ts';
import { rankModulesForSignalTargets } from '../../../shared/repoSignalMapping.ts';

export type GitHubJsonFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export type GitHubJsonFetcher = <T>(url: string) => Promise<GitHubJsonFetchResult<T>>;

interface GitHubSearchIssuesResponse {
  total_count: number;
}

interface GitHubCommitSummary {
  sha: string;
}

interface FetchRepoSignalsOptions {
  snapshot: Pick<RepoModel, 'repoId' | 'owner' | 'name' | 'defaultBranch' | 'modules'>;
  fetchGitHubJson: GitHubJsonFetcher;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function severityFromOpenIssueCount(count: number): RepoSignal['severity'] {
  if (count <= 0) {
    return 0;
  }

  if (count < 5) {
    return 1;
  }

  if (count < 10) {
    return 2;
  }

  if (count < 25) {
    return 3;
  }

  if (count < 50) {
    return 4;
  }

  return 5;
}

function severityFromOpenPullRequestCount(count: number): RepoSignal['severity'] {
  if (count <= 0) {
    return 0;
  }

  if (count === 1) {
    return 1;
  }

  if (count < 5) {
    return 2;
  }

  if (count < 10) {
    return 3;
  }

  if (count < 20) {
    return 4;
  }

  return 5;
}

function buildRepoCountDetail(
  snapshot: FetchRepoSignalsOptions['snapshot'],
  count: number,
  label: string,
): string {
  return `${count} open ${pluralize(count, label)} currently reported for ${snapshot.owner}/${snapshot.name}.`;
}

function getLiveSignalTargetModules(
  snapshot: FetchRepoSignalsOptions['snapshot'],
  signalType: 'open_issue' | 'open_pr',
  totalCount: number,
): RepoModule[] {
  if (totalCount <= 0 || snapshot.modules.length === 0) {
    return [];
  }

  const maxTargets = Math.min(
    snapshot.modules.length,
    totalCount >= 10 ? 3 : totalCount >= 4 ? 2 : 1,
  );

  return rankModulesForSignalTargets(snapshot, signalType).slice(0, maxTargets);
}

function distributeCountAcrossTargets(totalCount: number, targetCount: number): number[] {
  if (targetCount <= 1) {
    return [totalCount];
  }

  const allocations = Array.from({ length: targetCount }, () => 1);
  let remaining = Math.max(0, totalCount - targetCount);
  let cursor = 0;

  while (remaining > 0) {
    allocations[cursor] += 1;
    remaining -= 1;
    cursor = (cursor + 1) % targetCount;
  }

  return allocations;
}

function buildMappedCountDetail(
  snapshot: FetchRepoSignalsOptions['snapshot'],
  module: RepoModule,
  mappedCount: number,
  totalCount: number,
  label: string,
): string {
  return `${mappedCount} of ${totalCount} repo-wide open ${pluralize(totalCount, label)} mapped to ${module.path} for ${snapshot.owner}/${snapshot.name}.`;
}

function buildCountSignals(
  snapshot: FetchRepoSignalsOptions['snapshot'],
  type: 'open_issue' | 'open_pr',
  count: number,
  label: 'issue' | 'pull request',
  severityFromCount: (count: number) => RepoSignal['severity'],
): RepoSignal[] {
  if (count <= 0) {
    return [{
      type,
      target: snapshot.repoId,
      severity: 0,
      title: `${count} open ${pluralize(count, label)}`,
      detail: buildRepoCountDetail(snapshot, count, label),
      value: count,
    }];
  }

  const targetModules = getLiveSignalTargetModules(snapshot, type, count);
  if (targetModules.length === 0) {
    return [{
      type,
      target: snapshot.repoId,
      severity: severityFromCount(count),
      title: `${count} open ${pluralize(count, label)}`,
      detail: buildRepoCountDetail(snapshot, count, label),
      value: count,
    }];
  }

  const allocations = distributeCountAcrossTargets(count, targetModules.length);
  return targetModules.map((module, index) => {
    const mappedCount = allocations[index] ?? 0;
    return {
      type,
      target: module.id,
      severity: severityFromCount(mappedCount),
      title: `${mappedCount} open ${pluralize(mappedCount, label)}`,
      detail: buildMappedCountDetail(snapshot, module, mappedCount, count, label),
      value: mappedCount,
    };
  });
}

export async function fetchRepoSignals({
  snapshot,
  fetchGitHubJson,
}: FetchRepoSignalsOptions): Promise<RepoSignal[]> {
  const repoPath = `${encodeURIComponent(snapshot.owner)}/${encodeURIComponent(snapshot.name)}`;
  const openIssueQuery = new URLSearchParams({
    q: `repo:${snapshot.owner}/${snapshot.name} is:issue state:open`,
    per_page: '1',
  });
  const openPrQuery = new URLSearchParams({
    q: `repo:${snapshot.owner}/${snapshot.name} is:pr state:open`,
    per_page: '1',
  });
  const commitQuery = new URLSearchParams({
    sha: snapshot.defaultBranch,
    per_page: '1',
  });

  const [openIssuesResponse, openPrsResponse, commitsResponse] = await Promise.all([
    fetchGitHubJson<GitHubSearchIssuesResponse>(`https://api.github.com/search/issues?${openIssueQuery.toString()}`),
    fetchGitHubJson<GitHubSearchIssuesResponse>(`https://api.github.com/search/issues?${openPrQuery.toString()}`),
    fetchGitHubJson<GitHubCommitSummary[]>(`https://api.github.com/repos/${repoPath}/commits?${commitQuery.toString()}`),
  ]);

  const target = snapshot.repoId;
  const signals: RepoSignal[] = [];

  if (openIssuesResponse.ok) {
    const openIssueCount = Math.max(0, openIssuesResponse.data.total_count);
    signals.push(...buildCountSignals(
      snapshot,
      'open_issue',
      openIssueCount,
      'issue',
      severityFromOpenIssueCount,
    ));
  }

  if (openPrsResponse.ok) {
    const openPrCount = Math.max(0, openPrsResponse.data.total_count);
    signals.push(...buildCountSignals(
      snapshot,
      'open_pr',
      openPrCount,
      'pull request',
      severityFromOpenPullRequestCount,
    ));
  }

  if (commitsResponse.ok) {
    const latestCommitSha = commitsResponse.data[0]?.sha;
    if (latestCommitSha) {
      signals.push({
        type: 'latest_commit',
        target,
        severity: 0,
        title: `Latest commit on ${snapshot.defaultBranch}`,
        detail: latestCommitSha,
        value: latestCommitSha,
      });
    }
  }

  return signals;
}
