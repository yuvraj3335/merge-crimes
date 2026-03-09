import { fetchRepoSignals } from '../github/fetchRepoSignals.ts';
import type { RepoModel } from '../../../shared/repoModel.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

async function testRepoWideCountsAreDistributedAcrossRankedModules(): Promise<void> {
  const snapshot: Pick<RepoModel, 'repoId' | 'owner' | 'name' | 'defaultBranch' | 'modules'> = {
    repoId: 'github:signal-test',
    owner: 'acme',
    name: 'guardian-grid',
    defaultBranch: 'main',
    modules: [
      {
        id: 'mod-api',
        name: 'api',
        path: 'api/',
        kind: 'service',
        language: 'TypeScript',
        fileCount: 20,
        totalBytes: 8_000,
        importanceScore: 92,
        activityScore: 86,
        riskScore: 61,
      },
      {
        id: 'mod-ui',
        name: 'ui',
        path: 'frontend/',
        kind: 'app',
        language: 'TypeScript',
        fileCount: 16,
        totalBytes: 5_200,
        importanceScore: 84,
        activityScore: 73,
        riskScore: 33,
      },
      {
        id: 'mod-tests',
        name: 'tests',
        path: 'tests/',
        kind: 'tests',
        language: 'TypeScript',
        fileCount: 12,
        totalBytes: 2_400,
        importanceScore: 58,
        activityScore: 51,
        riskScore: 24,
      },
      {
        id: 'mod-docs',
        name: 'docs',
        path: 'docs/',
        kind: 'docs',
        language: null,
        fileCount: 4,
        totalBytes: 900,
        importanceScore: 10,
        activityScore: 8,
        riskScore: 4,
      },
    ],
  };

  const signals = await fetchRepoSignals({
    snapshot,
    fetchGitHubJson: async <T>(url: string) => {
      const parsedUrl = new URL(url);
      const query = parsedUrl.searchParams.get('q') ?? '';

      if (query.includes('is:issue')) {
        return { ok: true, data: { total_count: 12 } as T };
      }
      if (query.includes('is:pr')) {
        return { ok: true, data: { total_count: 6 } as T };
      }
      if (parsedUrl.pathname.endsWith('/commits')) {
        return { ok: true, data: [{ sha: 'abc123def456' }] as T };
      }
      return { ok: false, status: 404, message: 'not found' };
    },
  });

  const openIssueSignals = signals.filter((signal) => signal.type === 'open_issue');
  assertEqual(openIssueSignals.length, 3, 'Open issue counts should fan out to the top three ranked modules.');
  assertEqual(openIssueSignals.map((signal) => signal.target).join(','), 'mod-api,mod-ui,mod-tests', 'Issue signals should target ranked modules in deterministic order.');
  assertEqual(openIssueSignals.map((signal) => String(signal.value)).join(','), '4,4,4', 'Issue counts should be distributed evenly across the selected modules.');
  assert(openIssueSignals.every((signal) => signal.detail?.includes('repo-wide open issues mapped to')), 'Distributed issue signals should explain the repo-wide mapping.');

  const openPrSignals = signals.filter((signal) => signal.type === 'open_pr');
  assertEqual(openPrSignals.length, 2, 'Open pull request counts should fan out to the top two ranked modules for a mid-sized queue.');
  assertEqual(openPrSignals.map((signal) => signal.target).join(','), 'mod-api,mod-ui', 'Pull request signals should target the highest-ranked review modules.');
  assertEqual(openPrSignals.map((signal) => String(signal.value)).join(','), '3,3', 'Pull request counts should split evenly across the selected modules.');

  const latestCommitSignal = signals.find((signal) => signal.type === 'latest_commit');
  assert(latestCommitSignal, 'Latest commit metadata should still be emitted alongside distributed repo-wide counts.');
  assertEqual(latestCommitSignal.target, snapshot.repoId, 'Latest commit metadata should remain repo-scoped.');
}

await testRepoWideCountsAreDistributedAcrossRankedModules();

console.log('fetchRepoSignals.test.ts: ok');
