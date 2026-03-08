import type { RepoSignal } from './types';

export type RepoRefreshCheckStatus =
  | 'update_detected'
  | 'up_to_date'
  | 'missing_baseline'
  | 'branch_empty';

export interface RepoRefreshCheckRequest {
  owner: string;
  name: string;
  defaultBranch: string;
  lastKnownCommitSha?: string | null;
}

export interface RepoRefreshCheckResult {
  provider: 'github';
  owner: string;
  name: string;
  defaultBranch: string;
  checkedAt: string;
  lastKnownCommitSha: string | null;
  latestCommitSha: string | null;
  hasUpdates: boolean;
  status: RepoRefreshCheckStatus;
}

export type ConnectedRepoRefreshStatusState = RepoRefreshCheckStatus | 'idle' | 'error';

export interface ConnectedRepoRefreshStatus {
  status: ConnectedRepoRefreshStatusState;
  checkedAt: string | null;
  lastKnownCommitSha: string | null;
  latestRemoteCommitSha: string | null;
  hasNewerRemote: boolean;
  isChecking: boolean;
  errorMessage: string | null;
}

export function getLatestCommitShaFromSignals(signals: readonly RepoSignal[]): string | null {
  for (const signal of signals) {
    if (signal.type !== 'latest_commit') {
      continue;
    }

    if (typeof signal.value !== 'string') {
      continue;
    }

    const trimmedValue = signal.value.trim();
    if (trimmedValue.length > 0) {
      return trimmedValue;
    }
  }

  return null;
}

export function createInitialConnectedRepoRefreshStatus(
  signals: readonly RepoSignal[],
): ConnectedRepoRefreshStatus {
  return {
    status: 'idle',
    checkedAt: null,
    lastKnownCommitSha: getLatestCommitShaFromSignals(signals),
    latestRemoteCommitSha: null,
    hasNewerRemote: false,
    isChecking: false,
    errorMessage: null,
  };
}

export function applyRepoRefreshCheckResult(
  refreshCheck: RepoRefreshCheckResult,
): ConnectedRepoRefreshStatus {
  return {
    status: refreshCheck.status,
    checkedAt: refreshCheck.checkedAt,
    lastKnownCommitSha: refreshCheck.lastKnownCommitSha,
    latestRemoteCommitSha: refreshCheck.latestCommitSha,
    hasNewerRemote: refreshCheck.hasUpdates,
    isChecking: false,
    errorMessage: null,
  };
}
