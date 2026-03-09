import type {
    DependencyEdge,
    GitHubRepoMetadataSnapshot,
    RepoMetadata,
    RepoModel,
    RepoModule,
    RepoSignal,
} from '../../shared/repoModel';

type NormalizeRepoSnapshotContext = {
    allowedModuleIds: ReadonlySet<string>;
    snapshot: RepoModel;
};

type NormalizeRepoSnapshotOptions = {
    moduleLimit?: number;
    filterRelationsToModuleIds?: boolean;
    repoIdOverride?: string;
    generatedAtOverride?: string;
    metadataFallback?: RepoMetadata | ((snapshot: RepoModel) => RepoMetadata);
    metadataOverrides?: Partial<RepoMetadata>;
    transformSignals?: (signals: RepoSignal[], context: NormalizeRepoSnapshotContext) => RepoSignal[];
};

type NormalizeRepoSnapshotOptionsWithMetadata = NormalizeRepoSnapshotOptions & {
    metadataFallback: RepoMetadata | ((snapshot: RepoModel) => RepoMetadata);
};

function cloneLanguages(languages: RepoModel['languages']): RepoModel['languages'] {
    return languages.map((language) => ({ ...language }));
}

function cloneModules(modules: RepoModule[], moduleLimit?: number): RepoModule[] {
    const visibleModules = typeof moduleLimit === 'number'
        ? modules.slice(0, moduleLimit)
        : modules;

    return visibleModules.map((module) => ({ ...module }));
}

function cloneDependencyEdges(
    dependencyEdges: DependencyEdge[],
    allowedModuleIds?: ReadonlySet<string>,
): DependencyEdge[] {
    return dependencyEdges
        .filter((edge) => (
            !allowedModuleIds
            || (
                allowedModuleIds.has(edge.fromModuleId)
                && allowedModuleIds.has(edge.toModuleId)
            )
        ))
        .map((edge) => ({ ...edge }));
}

function cloneSignals(
    signals: RepoSignal[],
    allowedModuleIds?: ReadonlySet<string>,
    repoTarget?: string,
): RepoSignal[] {
    return signals
        .filter((signal) => (
            !allowedModuleIds
            || signal.target === repoTarget
            || allowedModuleIds.has(signal.target)
        ))
        .map((signal) => ({ ...signal }));
}

function cloneMetadata(metadata: RepoMetadata): RepoMetadata {
    return {
        ...metadata,
        topics: Array.isArray(metadata.topics) ? [...metadata.topics] : [],
    };
}

function resolveMetadataFallback(
    snapshot: RepoModel,
    metadataFallback?: NormalizeRepoSnapshotOptions['metadataFallback'],
): RepoMetadata | undefined {
    if (!metadataFallback) {
        return undefined;
    }

    return typeof metadataFallback === 'function'
        ? metadataFallback(snapshot)
        : metadataFallback;
}

function normalizeMetadata(
    metadata: RepoModel['metadata'],
    snapshot: RepoModel,
    options: NormalizeRepoSnapshotOptions,
): RepoMetadata | undefined {
    const metadataSource = metadata ?? resolveMetadataFallback(snapshot, options.metadataFallback);
    if (!metadataSource) {
        return undefined;
    }

    const clonedMetadata = cloneMetadata(metadataSource);
    if (!options.metadataOverrides) {
        return clonedMetadata;
    }

    return {
        ...clonedMetadata,
        ...options.metadataOverrides,
        topics: Array.isArray(options.metadataOverrides.topics)
            ? [...options.metadataOverrides.topics]
            : clonedMetadata.topics,
    };
}

export type { NormalizeRepoSnapshotContext, NormalizeRepoSnapshotOptions };

export function normalizeRepoSnapshot(
    input: unknown,
    options: NormalizeRepoSnapshotOptionsWithMetadata,
): GitHubRepoMetadataSnapshot | null;
export function normalizeRepoSnapshot(input: unknown, options?: NormalizeRepoSnapshotOptions): RepoModel | null;
export function normalizeRepoSnapshot(
    input: unknown,
    options: NormalizeRepoSnapshotOptions = {},
): RepoModel | null {
    if (!input || typeof input !== 'object') {
        return null;
    }

    const candidate = input as Partial<RepoModel>;
    if (
        typeof candidate.repoId !== 'string'
        || typeof candidate.owner !== 'string'
        || typeof candidate.name !== 'string'
        || typeof candidate.defaultBranch !== 'string'
        || (candidate.visibility !== 'public' && candidate.visibility !== 'private')
        || !Array.isArray(candidate.modules)
        || candidate.modules.length === 0
    ) {
        return null;
    }

    const modules = cloneModules(candidate.modules as RepoModule[], options.moduleLimit);
    const allowedModuleIds = new Set(modules.map((module) => module.id));
    const relationFilter = options.filterRelationsToModuleIds ? allowedModuleIds : undefined;
    const repoSignalTarget = options.repoIdOverride ?? candidate.repoId;
    const dependencyEdges = Array.isArray(candidate.dependencyEdges)
        ? cloneDependencyEdges(candidate.dependencyEdges as DependencyEdge[], relationFilter)
        : [];
    const baseSignals = Array.isArray(candidate.signals)
        ? cloneSignals(candidate.signals as RepoSignal[], relationFilter, repoSignalTarget)
        : [];
    const baseSnapshot: RepoModel = {
        repoId: options.repoIdOverride ?? candidate.repoId,
        owner: candidate.owner,
        name: candidate.name,
        defaultBranch: candidate.defaultBranch,
        visibility: candidate.visibility,
        archetype: candidate.archetype ?? 'unknown',
        languages: Array.isArray(candidate.languages)
            ? cloneLanguages(candidate.languages)
            : [],
        modules,
        dependencyEdges,
        signals: baseSignals,
        generatedAt: options.generatedAtOverride
            ?? (typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString()),
    };
    const signals = options.transformSignals
        ? options.transformSignals(baseSignals, { allowedModuleIds, snapshot: baseSnapshot }).map((signal) => ({ ...signal }))
        : baseSignals;
    const normalizedSnapshot: RepoModel = {
        ...baseSnapshot,
        signals,
    };
    const metadata = normalizeMetadata(candidate.metadata, normalizedSnapshot, options);

    return metadata
        ? {
            ...normalizedSnapshot,
            metadata,
        }
        : normalizedSnapshot;
}
