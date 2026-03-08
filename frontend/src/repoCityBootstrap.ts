import sampleRepoSnapshotJson from '../../shared/snapshots/sample_repo_snapshot.json';
import type { DependencyEdge, RepoModel, RepoModule, RepoSignal } from '../../shared/repoModel';
import { isLocalSmokeMode } from './runtimeConfig';

const MAX_BOOTSTRAP_MODULES = 10;

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

// Keep the cross-package JSON import in one place so the frontend only has a
// single boundary to `shared/snapshots`, with smoke mode still opting into the
// legacy seed bootstrap that the browser harness expects.
export function getBootstrapRepoSnapshot(): RepoModel | null {
    if (isLocalSmokeMode()) {
        return null;
    }

    return bootstrapRepoSnapshot;
}
