import type { GitHubReadableRepo } from './api';

export const SMOKE_CONNECTED_REPO_ID = 'github-smoke-trust-refresh';
export const SMOKE_CONNECTED_REPO_PROVIDER_ID = 1000001;
export const SMOKE_ACTIVE_COMMIT_SHA = '6dfb92f31d9142b08d41a0c08ef2a53ef0a8fd41';
export const SMOKE_REMOTE_COMMIT_SHA = '8a9124d61fb6ac9ec4a54356bdf0e79eb0e3a18f';
export const SMOKE_CONNECTED_REPO_GENERATED_AT = '2026-03-08T13:45:00.000Z';
export const SMOKE_REFRESH_CHECKED_AT = '2026-03-08T18:30:00.000Z';

export const SMOKE_ELIGIBLE_REPO: GitHubReadableRepo = {
    id: 1000010,
    name: 'issue-radar',
    fullName: 'acme-dev/issue-radar',
    ownerLogin: 'acme-dev',
    defaultBranch: 'main',
    visibility: 'public',
};

export const SMOKE_LISTED_ONLY_REPO: GitHubReadableRepo = {
    id: 1000011,
    name: 'incident-core',
    fullName: 'acme-dev/incident-core',
    ownerLogin: 'acme-dev',
    defaultBranch: 'main',
    visibility: 'private',
};
