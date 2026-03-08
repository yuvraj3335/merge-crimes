import type { RepoModel } from '../../../shared/repoModel';
import type { ConnectedRepoRefreshStatus } from '../../../shared/repoRefresh';

export type RepoRefreshTone = 'idle' | 'loading' | 'success' | 'error';

export interface RepoRefreshStatusState {
    tone: RepoRefreshTone;
    message: string | null;
    repoId: string | null;
}

export interface RepoRefreshStatusCopy {
    pill: string;
    title: string;
    message: string;
}

export interface RepoRefreshNotice {
    title: string;
    detail: string;
}

function getActiveRepoRefreshState(
    connectedRepo: RepoModel | null,
    repoRefreshStatus: RepoRefreshStatusState,
): { tone: RepoRefreshTone; message: string | null } {
    return repoRefreshStatus.repoId === connectedRepo?.repoId
        ? {
            tone: repoRefreshStatus.tone,
            message: repoRefreshStatus.message,
        }
        : {
            tone: 'idle',
            message: null,
        };
}

export function buildRepoRefreshStatusCopy(
    connectedRepo: RepoModel | null,
    connectedRepoRefreshStatus: ConnectedRepoRefreshStatus | null,
    repoRefreshStatus: RepoRefreshStatusState,
): RepoRefreshStatusCopy {
    const { tone, message } = getActiveRepoRefreshState(connectedRepo, repoRefreshStatus);
    const hasConnectedRepoUpdate = Boolean(connectedRepoRefreshStatus?.hasNewerRemote);

    if (tone === 'loading') {
        return {
            pill: 'Refresh in progress',
            title: 'Refreshing GitHub metadata',
            message: message ?? 'Pulling a fresh read-only snapshot without leaving this menu.',
        };
    }

    if (tone === 'success') {
        return {
            pill: 'Snapshot updated',
            title: 'Connected repo refreshed',
            message: message ?? 'A fresh GitHub snapshot is ready in the current session.',
        };
    }

    if (tone === 'error') {
        return {
            pill: 'Refresh failed',
            title: 'Could not refresh this repo',
            message: message ?? 'GitHub did not return a fresh snapshot. Try the refresh action again.',
        };
    }

    return {
        pill: hasConnectedRepoUpdate ? 'Update detected' : 'Manual refresh',
        title: hasConnectedRepoUpdate ? 'Newer snapshot available' : 'Refresh the connected snapshot',
        message: hasConnectedRepoUpdate && connectedRepo
            ? `GitHub reports newer commits on ${connectedRepo.defaultBranch}. Refresh when you want to load the latest read-only snapshot.`
            : 'Pull the latest read-only repo metadata here without changing the current repo.',
    };
}

export function buildRepoRefreshIndicatorTone(
    connectedRepo: RepoModel | null,
    connectedRepoRefreshStatus: ConnectedRepoRefreshStatus | null,
    repoRefreshStatus: RepoRefreshStatusState,
): RepoRefreshTone {
    const { tone } = getActiveRepoRefreshState(connectedRepo, repoRefreshStatus);

    if (tone !== 'idle') {
        return tone;
    }

    return connectedRepoRefreshStatus?.hasNewerRemote ? 'success' : 'idle';
}

export function buildRepoHudRefreshNotice(
    connectedRepo: RepoModel | null,
    connectedRepoRefreshStatus: ConnectedRepoRefreshStatus | null,
): RepoRefreshNotice | null {
    if (!connectedRepo || !connectedRepoRefreshStatus?.hasNewerRemote) {
        return null;
    }

    return {
        title: 'Newer snapshot available',
        detail: connectedRepoRefreshStatus.latestRemoteCommitSha
            ? `New commits landed on ${connectedRepo.defaultBranch}. Open the menu to refresh this repo snapshot.`
            : `New commits landed on ${connectedRepo.defaultBranch}. Open the menu to refresh this repo snapshot.`,
    };
}
