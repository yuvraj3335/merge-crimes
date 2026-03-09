import sampleRepoSnapshotJson from '../../shared/snapshots/sample_repo_snapshot.json';
import type { GitHubRepoMetadataSnapshot, RepoMetadata, RepoModel } from '../../shared/repoModel';
import {
    createInitialConnectedRepoRefreshStatus,
    type ConnectedRepoRefreshStatus,
} from '../../shared/repoRefresh';
import { SESSION_ID } from './api';
import { normalizeRepoSnapshot } from './normalizeRepoSnapshot';
import { getGitHubRepoTranslationEligibility } from './repoTranslationEligibility';
import { isLocalSmokeMode } from './runtimeConfig';
import {
    SMOKE_CONNECTED_REPO_ID,
    SMOKE_CONNECTED_REPO_PROVIDER_ID,
    SMOKE_ACTIVE_COMMIT_SHA,
    SMOKE_REMOTE_COMMIT_SHA,
    SMOKE_CONNECTED_REPO_GENERATED_AT,
    SMOKE_REFRESH_CHECKED_AT,
    SMOKE_ELIGIBLE_REPO,
    SMOKE_LISTED_ONLY_REPO,
} from './smokeFixtures';
import type { GamePhase } from './store/gameStore';
import { useGameStore } from './store/gameStore';

type SmokeMissionSnapshot = {
    id: string;
    districtId: string;
    status: string;
    type: string;
};

type SmokeSnapshot = {
    phase: string;
    sessionId: string;
    apiAvailable: boolean;
    apiConnectionState: string;
    apiStatusMessage: string | null;
    writeSessionState: string;
    writeSessionMessage: string | null;
    currentDistrictId: string | null;
    activeMissionId: string | null;
    currentWaypointIndex: number;
    showMissionPanel: boolean;
    missions: SmokeMissionSnapshot[];
    districtRooms: Record<string, { presenceCount: number; captureProgress: number }>;
    repoCityMode: boolean;
    connectedRepoFullName: string | null;
    connectedRepoGeneratedAt: string | null;
    githubAuthStatus: string;
    selectedGitHubRepoFullName: string | null;
    selectedGitHubRepoVisibility: string | null;
    selectedGitHubRepoIngestTone: string;
    connectedRepoRefreshState: string | null;
    connectedRepoRefreshAvailable: boolean;
    connectedRepoRefreshLatestSha: string | null;
};

type SmokeTrustState = 'anonymous' | 'eligible-loading' | 'eligible-error' | 'listed-only';
type SmokeRefreshState = 'idle' | 'update-detected';
type SmokeBridgePhase = Extract<GamePhase, 'menu' | 'playing'>;

interface MergeCrimesSmokeApi {
    snapshot: () => SmokeSnapshot;
    startGame: () => void;
    loadRepoCityHarness: () => SmokeSnapshot;
    setTrustState: (state: SmokeTrustState) => SmokeSnapshot;
    setRefreshState: (state: SmokeRefreshState) => SmokeSnapshot;
    setPhase: (phase: SmokeBridgePhase) => SmokeSnapshot;
    setCurrentDistrict: (districtId: string | null) => boolean;
    completeActiveMission: () => boolean;
    failActiveMission: () => boolean;
}

declare global {
    interface Window {
        __MERGE_CRIMES_SMOKE__?: MergeCrimesSmokeApi;
    }
}

function buildSmokeMetadataFallback(snapshot: RepoModel): RepoMetadata {
    return {
        provider: 'github',
        providerRepoId: SMOKE_CONNECTED_REPO_PROVIDER_ID,
        fullName: `${snapshot.owner}/${snapshot.name}`,
        description: null,
        htmlUrl: 'https://github.com/yuvrajmuley/merge-crimes',
        homepageUrl: null,
        topics: [],
        stars: 0,
        forks: 0,
        watchers: 0,
        openIssues: 0,
        primaryLanguage: 'TypeScript',
        license: null,
        archived: false,
        fork: false,
        updatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
        pushedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
    };
}

function buildSmokeConnectedRepo(): GitHubRepoMetadataSnapshot {
    const smokeSnapshot = normalizeRepoSnapshot(sampleRepoSnapshotJson, {
        repoIdOverride: SMOKE_CONNECTED_REPO_ID,
        generatedAtOverride: SMOKE_CONNECTED_REPO_GENERATED_AT,
        metadataFallback: buildSmokeMetadataFallback,
        metadataOverrides: {
            provider: 'github',
            providerRepoId: SMOKE_CONNECTED_REPO_PROVIDER_ID,
            updatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
            pushedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
        },
        transformSignals: (signals, { snapshot }) => {
            const latestCommitTarget = snapshot.modules[0]?.id ?? 'mod-frontend';

            return [
                ...signals.filter((signal) => signal.type !== 'latest_commit'),
                {
                    type: 'latest_commit',
                    target: latestCommitTarget,
                    severity: 0,
                    title: `Latest commit on ${snapshot.defaultBranch}`,
                    detail: SMOKE_ACTIVE_COMMIT_SHA,
                    value: SMOKE_ACTIVE_COMMIT_SHA,
                },
            ];
        },
    });

    if (!smokeSnapshot) {
        throw new Error('Failed to normalize the smoke repo snapshot.');
    }

    return smokeSnapshot;
}

function buildIdleRefreshStatus(repo: GitHubRepoMetadataSnapshot): ConnectedRepoRefreshStatus {
    const initialStatus = createInitialConnectedRepoRefreshStatus(repo.signals);

    return {
        ...initialStatus,
        checkedAt: SMOKE_REFRESH_CHECKED_AT,
        lastKnownCommitSha: SMOKE_ACTIVE_COMMIT_SHA,
    };
}

function ensureSmokeRepoCityLoaded(): GitHubRepoMetadataSnapshot {
    const state = useGameStore.getState();
    const currentRepo = state.connectedRepo;

    if (currentRepo?.repoId === SMOKE_CONNECTED_REPO_ID && currentRepo.metadata?.provider === 'github') {
        useGameStore.setState({
            apiAvailable: true,
            apiConnectionState: 'online',
            apiStatusMessage: null,
            writeSessionState: 'ready',
            writeSessionMessage: null,
        });
        return currentRepo as GitHubRepoMetadataSnapshot;
    }

    const smokeRepo = buildSmokeConnectedRepo();
    state.loadRepoCity(smokeRepo);
    useGameStore.setState({
        apiAvailable: true,
        apiConnectionState: 'online',
        apiStatusMessage: null,
        writeSessionState: 'ready',
        writeSessionMessage: null,
        githubAccessToken: null,
        githubAuthStatus: 'anonymous',
        githubAuthMessage: null,
        selectedGitHubRepo: null,
        selectedGitHubRepoEligibility: null,
        selectedGitHubRepoIngestState: {
            tone: 'idle',
            repoId: null,
            message: null,
        },
        selectedGitHubRepoSnapshot: null,
        showGitHubRepoPicker: false,
        connectedRepoRefreshStatus: buildIdleRefreshStatus(smokeRepo),
        credits: 0,
        reputation: 0,
        playerPosition: [0, 0.5, 0],
        districtRooms: {},
        showMissionPanel: false,
        showLeaderboard: false,
        showBulletin: false,
        rewardToasts: [],
        phase: 'menu',
    });

    return smokeRepo;
}

function buildSnapshot(): SmokeSnapshot {
    const state = useGameStore.getState();

    return {
        phase: state.phase,
        sessionId: SESSION_ID,
        apiAvailable: state.apiAvailable,
        apiConnectionState: state.apiConnectionState,
        apiStatusMessage: state.apiStatusMessage,
        writeSessionState: state.writeSessionState,
        writeSessionMessage: state.writeSessionMessage,
        currentDistrictId: state.currentDistrict?.id ?? null,
        activeMissionId: state.activeMission?.id ?? null,
        currentWaypointIndex: state.currentWaypointIndex,
        showMissionPanel: state.showMissionPanel,
        missions: state.missions.map((mission) => ({
            id: mission.id,
            districtId: mission.districtId,
            status: mission.status,
            type: mission.type,
        })),
        districtRooms: state.districtRooms,
        repoCityMode: state.repoCityMode,
        connectedRepoFullName: state.connectedRepo?.metadata?.fullName ?? (
            state.connectedRepo ? `${state.connectedRepo.owner}/${state.connectedRepo.name}` : null
        ),
        connectedRepoGeneratedAt: state.connectedRepo?.generatedAt ?? null,
        githubAuthStatus: state.githubAuthStatus,
        selectedGitHubRepoFullName: state.selectedGitHubRepo?.fullName ?? null,
        selectedGitHubRepoVisibility: state.selectedGitHubRepo?.visibility ?? null,
        selectedGitHubRepoIngestTone: state.selectedGitHubRepoIngestState.tone,
        connectedRepoRefreshState: state.connectedRepoRefreshStatus?.status ?? null,
        connectedRepoRefreshAvailable: state.connectedRepoRefreshStatus?.hasNewerRemote ?? false,
        connectedRepoRefreshLatestSha: state.connectedRepoRefreshStatus?.latestRemoteCommitSha ?? null,
    };
}

function startGame(): void {
    const state = useGameStore.getState();
    if (state.phase === 'menu') {
        state.setPhase('playing');
    }
}

function loadRepoCityHarness(): SmokeSnapshot {
    ensureSmokeRepoCityLoaded();
    return buildSnapshot();
}

function setTrustState(trustState: SmokeTrustState): SmokeSnapshot {
    ensureSmokeRepoCityLoaded();

    if (trustState === 'anonymous') {
        useGameStore.setState({
            githubAccessToken: null,
            githubAuthStatus: 'anonymous',
            githubAuthMessage: null,
            selectedGitHubRepo: null,
            selectedGitHubRepoEligibility: null,
            selectedGitHubRepoIngestState: {
                tone: 'idle',
                repoId: null,
                message: null,
            },
            selectedGitHubRepoSnapshot: null,
            showGitHubRepoPicker: false,
        });

        return buildSnapshot();
    }

    const selectedRepo = trustState === 'listed-only' ? SMOKE_LISTED_ONLY_REPO : SMOKE_ELIGIBLE_REPO;
    const selectedRepoEligibility = getGitHubRepoTranslationEligibility(selectedRepo.visibility);
    const selectedRepoIngestState = trustState === 'eligible-loading'
        ? {
            tone: 'loading' as const,
            repoId: selectedRepo.id,
            message: 'Ingesting repository data... Please wait before entering the city.',
        }
        : trustState === 'eligible-error'
            ? {
                tone: 'error' as const,
                repoId: selectedRepo.id,
                message: 'GitHub did not return a readable snapshot. The current city is still active.',
            }
            : {
                tone: 'idle' as const,
                repoId: null,
                message: null,
            };

    useGameStore.setState({
        githubAccessToken: 'smoke-github-token',
        githubAuthStatus: 'authenticated',
        githubAuthMessage: null,
        selectedGitHubRepo: selectedRepo,
        selectedGitHubRepoEligibility: selectedRepoEligibility,
        selectedGitHubRepoIngestState: selectedRepoIngestState,
        selectedGitHubRepoSnapshot: null,
        showGitHubRepoPicker: false,
    });

    return buildSnapshot();
}

function setRefreshState(refreshState: SmokeRefreshState): SmokeSnapshot {
    const smokeRepo = ensureSmokeRepoCityLoaded();
    const baseRefreshStatus = buildIdleRefreshStatus(smokeRepo);

    useGameStore.setState({
        connectedRepoRefreshStatus: refreshState === 'update-detected'
            ? {
                ...baseRefreshStatus,
                status: 'update_detected',
                latestRemoteCommitSha: SMOKE_REMOTE_COMMIT_SHA,
                hasNewerRemote: true,
            }
            : baseRefreshStatus,
    });

    return buildSnapshot();
}

function setSmokePhase(phase: SmokeBridgePhase): SmokeSnapshot {
    ensureSmokeRepoCityLoaded();
    useGameStore.setState({ phase });
    return buildSnapshot();
}

function setCurrentDistrict(districtId: string | null): boolean {
    const state = useGameStore.getState();
    return state.movePlayerToDistrict(districtId);
}

function completeActiveMission(): boolean {
    let guard = 0;

    while (guard < 16) {
        const state = useGameStore.getState();
        const activeMission = state.activeMission;
        if (!activeMission) {
            return true;
        }

        if (activeMission.type === 'boss') {
            return false;
        }

        const waypoint = activeMission.waypoints[state.currentWaypointIndex];
        if (!waypoint) {
            return false;
        }

        state.reachWaypoint(waypoint.id);
        guard += 1;
    }

    return useGameStore.getState().activeMission === null;
}

function failActiveMission(): boolean {
    const state = useGameStore.getState();
    if (!state.activeMission) {
        return false;
    }

    state.failMission(state.activeMission.id);
    return true;
}

export function installLocalSmokeBridge(): (() => void) | undefined {
    if (!isLocalSmokeMode() || typeof window === 'undefined') {
        return undefined;
    }

    window.__MERGE_CRIMES_SMOKE__ = {
        snapshot: buildSnapshot,
        startGame,
        loadRepoCityHarness,
        setTrustState,
        setRefreshState,
        setPhase: setSmokePhase,
        setCurrentDistrict,
        completeActiveMission,
        failActiveMission,
    };

    return () => {
        delete window.__MERGE_CRIMES_SMOKE__;
    };
}
