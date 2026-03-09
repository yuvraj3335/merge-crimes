import type { RepoRefreshCheckRequest, RepoRefreshCheckResult } from '../../../shared/repoRefresh.ts';
import type { GitHubJsonFetcher } from './fetchRepoSignals';

interface GitHubCommitSummary {
  sha: string;
}

interface RepoRefreshCheckErrorBody {
  error: 'github_repo_not_found' | 'github_repo_commit_fetch_failed';
  message: string;
  owner: string;
  name: string;
  defaultBranch: string;
}

interface CheckGitHubRepoRefreshOptions extends RepoRefreshCheckRequest {
  fetchGitHubJson: GitHubJsonFetcher;
}

type CheckGitHubRepoRefreshResult =
  | { ok: true; refreshCheck: RepoRefreshCheckResult }
  | { ok: false; status: 404 | 502; body: RepoRefreshCheckErrorBody };

function buildRepoRefreshCheckResult(
  request: RepoRefreshCheckRequest,
  latestCommitSha: string | null,
): RepoRefreshCheckResult {
  const lastKnownCommitSha = request.lastKnownCommitSha ?? null;

  if (!latestCommitSha) {
    return {
      provider: 'github',
      owner: request.owner,
      name: request.name,
      defaultBranch: request.defaultBranch,
      checkedAt: new Date().toISOString(),
      lastKnownCommitSha,
      latestCommitSha: null,
      hasUpdates: false,
      status: 'branch_empty',
    };
  }

  if (!lastKnownCommitSha) {
    return {
      provider: 'github',
      owner: request.owner,
      name: request.name,
      defaultBranch: request.defaultBranch,
      checkedAt: new Date().toISOString(),
      lastKnownCommitSha: null,
      latestCommitSha,
      hasUpdates: false,
      status: 'missing_baseline',
    };
  }

  return {
    provider: 'github',
    owner: request.owner,
    name: request.name,
    defaultBranch: request.defaultBranch,
    checkedAt: new Date().toISOString(),
    lastKnownCommitSha,
    latestCommitSha,
    hasUpdates: latestCommitSha !== lastKnownCommitSha,
    status: latestCommitSha !== lastKnownCommitSha ? 'update_detected' : 'up_to_date',
  };
}

export async function checkGitHubRepoRefresh({
  owner,
  name,
  defaultBranch,
  lastKnownCommitSha,
  fetchGitHubJson,
}: CheckGitHubRepoRefreshOptions): Promise<CheckGitHubRepoRefreshResult> {
  const repoPath = `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const commitQuery = new URLSearchParams({
    sha: defaultBranch,
    per_page: '1',
  });

  const commitsResponse = await fetchGitHubJson<GitHubCommitSummary[]>(
    `https://api.github.com/repos/${repoPath}/commits?${commitQuery.toString()}`,
  );

  if (!commitsResponse.ok) {
    if (commitsResponse.status === 409) {
      return {
        ok: true,
        refreshCheck: buildRepoRefreshCheckResult(
          { owner, name, defaultBranch, lastKnownCommitSha },
          null,
        ),
      };
    }

    const status: 404 | 502 = commitsResponse.status === 404 ? 404 : 502;
    return {
      ok: false,
      status,
      body: {
        error: status === 404 ? 'github_repo_not_found' : 'github_repo_commit_fetch_failed',
        message: commitsResponse.message,
        owner,
        name,
        defaultBranch,
      },
    };
  }

  return {
    ok: true,
    refreshCheck: buildRepoRefreshCheckResult(
      { owner, name, defaultBranch, lastKnownCommitSha },
      commitsResponse.data[0]?.sha ?? null,
    ),
  };
}
