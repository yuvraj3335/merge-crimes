import { checkGitHubRepoRefresh } from '../github/checkRepoRefresh.ts';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

async function testEmptyRepoReturnsBranchEmptyStatus(): Promise<void> {
  const result = await checkGitHubRepoRefresh({
    owner: 'acme',
    name: 'empty-repo',
    defaultBranch: 'main',
    lastKnownCommitSha: 'abc123',
    fetchGitHubJson: async () => ({ ok: false, status: 409, message: 'Git Repository is empty.' }),
  });

  if (!result.ok) {
    throw new Error('Empty GitHub repos should return a refresh status instead of a transport-style error.');
  }

  assertEqual(result.refreshCheck.status, 'branch_empty', 'Empty GitHub repos should map to the branch_empty refresh state.');
  assertEqual(result.refreshCheck.latestCommitSha, null, 'Empty GitHub repos should not report a latest commit SHA.');
  assertEqual(result.refreshCheck.hasUpdates, false, 'Empty GitHub repos should not report remote updates.');
}

async function testMissingRepoStillReturnsNotFoundError(): Promise<void> {
  const result = await checkGitHubRepoRefresh({
    owner: 'acme',
    name: 'missing-repo',
    defaultBranch: 'main',
    lastKnownCommitSha: null,
    fetchGitHubJson: async () => ({ ok: false, status: 404, message: 'Not Found' }),
  });

  if (result.ok) {
    throw new Error('Missing GitHub repos should still return an error response.');
  }

  assertEqual(result.status, 404, 'Missing GitHub repos should preserve the 404 status code.');
  assertEqual(result.body.error, 'github_repo_not_found', 'Missing GitHub repos should preserve the not-found error body.');
}

await testEmptyRepoReturnsBranchEmptyStatus();
await testMissingRepoStillReturnsNotFoundError();

console.log('checkRepoRefresh.test.ts: ok');
