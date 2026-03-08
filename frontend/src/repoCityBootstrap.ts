import sampleRepoSnapshotJson from '../../shared/snapshots/sample_repo_snapshot.json';
import type { RepoModel } from '../../shared/repoModel';
import { normalizeRepoSnapshot } from './normalizeRepoSnapshot';
import { isLocalSmokeMode } from './runtimeConfig';

const MAX_BOOTSTRAP_MODULES = 10;
const SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY = 'merge-crimes-selected-github-repo-snapshot';

function readBootstrapRepoSnapshot(input: unknown): RepoModel | null {
    return normalizeRepoSnapshot(input, {
        moduleLimit: MAX_BOOTSTRAP_MODULES,
        filterRelationsToModuleIds: true,
    });
}

const bootstrapRepoSnapshot = readBootstrapRepoSnapshot(sampleRepoSnapshotJson);

function readStoredBootstrapRepoSnapshot(): RepoModel | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const storedSnapshot = window.localStorage.getItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
        if (!storedSnapshot) {
            return null;
        }

        const parsedSnapshot = JSON.parse(storedSnapshot) as unknown;
        const snapshot = readBootstrapRepoSnapshot(parsedSnapshot);
        if (!snapshot) {
            window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
        }

        return snapshot;
    } catch {
        window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
        return null;
    }
}

export function writeStoredSelectedGitHubRepoSnapshot(snapshot: RepoModel | null): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        if (!snapshot) {
            window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
            return;
        }

        const normalizedSnapshot = readBootstrapRepoSnapshot(snapshot);
        if (!normalizedSnapshot) {
            window.localStorage.removeItem(SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(
            SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY,
            JSON.stringify(normalizedSnapshot),
        );
    } catch {
        // localStorage is best-effort only for repo-city bootstrap.
    }
}

// Keep the cross-package JSON import in one place so the frontend only has a
// single boundary to `shared/snapshots`, with smoke mode still opting into the
// legacy seed bootstrap that the browser harness expects.
export function getBootstrapRepoSnapshot(): RepoModel | null {
    if (isLocalSmokeMode()) {
        return null;
    }

    return readStoredBootstrapRepoSnapshot() ?? bootstrapRepoSnapshot;
}
