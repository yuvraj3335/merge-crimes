import type { RepoModel, RepoSignal } from '../../../shared/repoModel';

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

function resolveRepoSignalTarget(snapshot: FetchRepoSignalsOptions['snapshot']): string {
  const preferredModule = snapshot.modules.find((module) => {
    const haystack = `${module.name} ${module.path}`.toLowerCase();
    return module.kind === 'control'
      || module.kind === 'infra'
      || haystack.includes('.github')
      || haystack.includes('ci')
      || haystack.includes('infra')
      || haystack.includes('ops')
      || haystack.includes('control');
  }) ?? snapshot.modules[0];

  return preferredModule?.id ?? snapshot.repoId;
}

function buildRepoCountDetail(
  snapshot: FetchRepoSignalsOptions['snapshot'],
  count: number,
  label: string,
): string {
  return `${count} open ${pluralize(count, label)} currently reported for ${snapshot.owner}/${snapshot.name}.`;
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

  const target = resolveRepoSignalTarget(snapshot);
  const signals: RepoSignal[] = [];

  if (openIssuesResponse.ok) {
    const openIssueCount = Math.max(0, openIssuesResponse.data.total_count);
    signals.push({
      type: 'open_issue',
      target,
      severity: severityFromOpenIssueCount(openIssueCount),
      title: `${openIssueCount} open ${pluralize(openIssueCount, 'issue')}`,
      detail: buildRepoCountDetail(snapshot, openIssueCount, 'issue'),
      value: openIssueCount,
    });
  }

  if (openPrsResponse.ok) {
    const openPrCount = Math.max(0, openPrsResponse.data.total_count);
    signals.push({
      type: 'open_pr',
      target,
      severity: severityFromOpenPullRequestCount(openPrCount),
      title: `${openPrCount} open pull ${pluralize(openPrCount, 'request')}`,
      detail: buildRepoCountDetail(snapshot, openPrCount, 'pull request'),
      value: openPrCount,
    });
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
