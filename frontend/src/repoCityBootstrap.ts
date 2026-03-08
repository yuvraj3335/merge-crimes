import sampleRepoSnapshotJson from '../../shared/snapshots/sample_repo_snapshot.json';
import type { DependencyEdge, RepoModel, RepoModule, RepoSignal } from '../../shared/repoModel';
import { isLocalSmokeMode } from './runtimeConfig';

const MAX_BOOTSTRAP_MODULES = 10;
const SELECTED_GITHUB_REPO_SNAPSHOT_STORAGE_KEY = 'merge-crimes-selected-github-repo-snapshot';

function cloneModules(modules: RepoModule[]): RepoModule[] {
    return modules.slice(0, MAX_BOOTSTRAP_MODULES).map((module) => ({ ...module }));
}

function cloneDependencyEdges(
    dependencyEdges: DependencyEdge[],
    allowedModuleIds: Set<string>,
): DependencyEdge[] {
    return dependencyEdges
        .filter((edge) => allowedModuleIds.has(edge.fromModuleId) && allowedModuleIds.has(edge.toModuleId))
        .map((edge) => ({ ...edge }));
}

function cloneSignals(signals: RepoSignal[], allowedModuleIds: Set<string>): RepoSignal[] {
    return signals
        .filter((signal) => allowedModuleIds.has(signal.target))
        .map((signal) => ({ ...signal }));
}

function readBootstrapRepoSnapshot(input: unknown): RepoModel | null {
    if (!input || typeof input !== 'object') {
        return null;
    }

    const candidate = input as Partial<RepoModel>;
    if (
        !candidate.repoId
        || !candidate.owner
        || !candidate.name
        || !candidate.defaultBranch
        || !candidate.visibility
        || !Array.isArray(candidate.modules)
        || candidate.modules.length === 0
    ) {
        return null;
    }

    const modules = cloneModules(candidate.modules as RepoModule[]);
    const allowedModuleIds = new Set(modules.map((module) => module.id));

    return {
        repoId: candidate.repoId,
        owner: candidate.owner,
        name: candidate.name,
        defaultBranch: candidate.defaultBranch,
        visibility: candidate.visibility,
        archetype: candidate.archetype ?? 'unknown',
        languages: Array.isArray(candidate.languages)
            ? candidate.languages.map((language) => ({ ...language }))
            : [],
        modules,
        dependencyEdges: Array.isArray(candidate.dependencyEdges)
            ? cloneDependencyEdges(candidate.dependencyEdges as DependencyEdge[], allowedModuleIds)
            : [],
        signals: Array.isArray(candidate.signals)
            ? cloneSignals(candidate.signals as RepoSignal[], allowedModuleIds)
            : [],
        generatedAt: typeof candidate.generatedAt === 'string'
            ? candidate.generatedAt
            : new Date().toISOString(),
        ...(candidate.metadata
            ? {
                metadata: {
                    ...candidate.metadata,
                    topics: Array.isArray(candidate.metadata.topics) ? [...candidate.metadata.topics] : [],
                },
            }
            : {}),
    };
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
