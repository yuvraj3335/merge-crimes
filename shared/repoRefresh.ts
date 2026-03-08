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
