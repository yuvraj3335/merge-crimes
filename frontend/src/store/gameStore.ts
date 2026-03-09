import { create } from 'zustand';
import type { District, Mission, Faction, CityEvent, MergeConflictEncounter, LeaderboardEntry } from '../../../shared/types';
import type { GitHubRepoMetadataSnapshot, RepoModel, GeneratedCity } from '../../../shared/repoModel';
import { generateCityFromRepo, generatedCityToDistricts, generatedCityToMissions, generatedCityToConflicts } from '../../../shared/repoCityGenerator';
import { buildSeedLeaderboard, SEED_FACTIONS } from '../../../shared/seed/factions';
import { SEED_DISTRICTS } from '../../../shared/seed/districts';
import { SEED_MISSIONS } from '../../../shared/seed/missions';
import { SEED_EVENTS } from '../../../shared/seed/events';
import { SEED_CONFLICTS } from '../../../shared/seed/conflicts';
import {
    createInitialConnectedRepoRefreshStatus,
    type ConnectedRepoRefreshStatus,
} from '../../../shared/repoRefresh';
import * as api from '../api';
import {
    getBootstrapRepoSnapshot,
    writeBootstrapModePreference,
    writeStoredSelectedRepoSnapshot,
} from '../repoCityBootstrap';
import {
    getGitHubRepoTranslationEligibility,
    type GitHubRepoTranslationEligibility,
} from '../repoTranslationEligibility';
import type { ApiConnectionState, ApiRuntimeStatus, ApiWriteSessionState, GitHubReadableRepo } from '../api';
import { buildRoadGuidedTransitPath, type TransitPoint } from './roadGuidedTransitPath';

// ─── Waypoint Persistence (ADR-017: Hybrid Policy) ───
// Persists waypoint index + completed set across same-tab reloads so the player
// does NOT have to repeat waypoints they already cleared.
// Timer is NOT persisted; it always resets to mission.timeLimit on reload.
const WAYPOINT_STATE_KEY = 'mc-waypoint-state';
const REPO_CITY_RUNTIME_STORAGE_KEY_PREFIX = 'mc-repo-city-runtime:';

interface PersistedWaypointState {
    missionId: string;
    currentWaypointIndex: number;
    completedWaypoints: string[];
}

interface PersistedRepoCityRuntimeState {
    version: 1;
    repoId: string;
    credits: number;
    reputation: number;
    captureProgress: Record<string, DistrictCapture>;
    missionStatuses: Record<string, Mission['status']>;
    activeMissionId: string | null;
    currentWaypointIndex: number;
    completedWaypoints: string[];
}

function saveWaypointState(missionId: string, currentWaypointIndex: number, completedWaypoints: string[]) {
    try {
        sessionStorage.setItem(WAYPOINT_STATE_KEY, JSON.stringify({ missionId, currentWaypointIndex, completedWaypoints }));
    } catch { /* sessionStorage may be unavailable in some contexts */ }
}

function loadWaypointState(missionId: string): { currentWaypointIndex: number; completedWaypoints: string[] } | null {
    try {
        const raw = sessionStorage.getItem(WAYPOINT_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedWaypointState;
        if (parsed.missionId !== missionId) return null;
        return { currentWaypointIndex: parsed.currentWaypointIndex, completedWaypoints: parsed.completedWaypoints };
    } catch { return null; }
}

function clearWaypointState() {
    try { sessionStorage.removeItem(WAYPOINT_STATE_KEY); } catch { /* ignore */ }
}

function getRepoCityRuntimeStorageKey(repoId: string): string {
    return `${REPO_CITY_RUNTIME_STORAGE_KEY_PREFIX}${encodeURIComponent(repoId)}`;
}

function loadRepoCityRuntimeState(repoId: string): PersistedRepoCityRuntimeState | null {
    try {
        const raw = sessionStorage.getItem(getRepoCityRuntimeStorageKey(repoId));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as PersistedRepoCityRuntimeState;
        if (parsed.version !== 1 || parsed.repoId !== repoId) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function saveRepoCityRuntimeState(state: {
    repoCityMode: boolean;
    connectedRepo: RepoModel | null;
    credits: number;
    reputation: number;
    captureProgress: Record<string, DistrictCapture>;
    missions: Mission[];
    activeMission: Mission | null;
    currentWaypointIndex: number;
    completedWaypoints: string[];
}): void {
    if (!state.repoCityMode || !state.connectedRepo) {
        return;
    }

    try {
        const missionStatuses = Object.fromEntries(
            state.missions.map((mission) => [mission.id, mission.status]),
        );

        const payload: PersistedRepoCityRuntimeState = {
            version: 1,
            repoId: state.connectedRepo.repoId,
            credits: state.credits,
            reputation: state.reputation,
            captureProgress: state.captureProgress,
            missionStatuses,
            activeMissionId: state.activeMission?.id ?? null,
            currentWaypointIndex: state.currentWaypointIndex,
            completedWaypoints: state.completedWaypoints,
        };

        sessionStorage.setItem(
            getRepoCityRuntimeStorageKey(state.connectedRepo.repoId),
            JSON.stringify(payload),
        );
    } catch {
        // sessionStorage is best-effort only for repo-city local progress.
    }
}

function restoreRepoCityRuntimeState(
    repo: RepoModel,
    districts: District[],
    missions: Mission[],
): {
    credits: number;
    reputation: number;
    captureProgress: Record<string, DistrictCapture>;
    missions: Mission[];
    activeMission: Mission | null;
    currentWaypointIndex: number;
    completedWaypoints: string[];
    phase: GamePhase;
} | null {
    const persisted = loadRepoCityRuntimeState(repo.repoId);
    if (!persisted) {
        return null;
    }

    const captureProgress: Record<string, DistrictCapture> = {};
    districts.forEach((district) => {
        const persistedCapture = persisted.captureProgress[district.id];
        const progress = persistedCapture
            ? Math.max(0, Math.min(100, persistedCapture.progress))
            : 0;
        captureProgress[district.id] = {
            progress,
            capturing: progress > 0 && progress < 100,
        };
    });

    const restoredMissions = missions.map((mission) => ({
        ...mission,
        status: persisted.missionStatuses[mission.id] ?? mission.status,
    }));
    const activeMission = persisted.activeMissionId
        ? restoredMissions.find((mission) => (
            mission.id === persisted.activeMissionId
            && mission.status === 'active'
        )) ?? null
        : null;

    let currentWaypointIndex = 0;
    let completedWaypoints: string[] = [];
    if (activeMission) {
        const waypointIds = new Set(activeMission.waypoints.map((waypoint) => waypoint.id));
        const restoredWaypointState = loadWaypointState(activeMission.id);
        const sourceState = restoredWaypointState ?? {
            currentWaypointIndex: persisted.currentWaypointIndex,
            completedWaypoints: persisted.completedWaypoints,
        };
        currentWaypointIndex = Math.max(
            0,
            Math.min(sourceState.currentWaypointIndex, Math.max(0, activeMission.waypoints.length - 1)),
        );
        completedWaypoints = sourceState.completedWaypoints.filter((waypointId) => waypointIds.has(waypointId));
    }

    return {
        credits: Math.max(0, persisted.credits),
        reputation: Math.max(0, persisted.reputation),
        captureProgress,
        missions: restoredMissions,
        activeMission,
        currentWaypointIndex,
        completedWaypoints,
        phase: activeMission ? 'mission' : 'menu',
    };
}

interface MissionWriteRollbackState {
    activeMission: Mission | null;
    missions: Mission[];
    credits: number;
    reputation: number;
    phase: GamePhase;
    missionTimer: number;
    currentWaypointIndex: number;
    completedWaypoints: string[];
    captureProgress: Record<string, DistrictCapture>;
    showMissionPanel: boolean;
}

function cloneMissionForRollback(mission: Mission | null): Mission | null {
    if (!mission) {
        return null;
    }

    return {
        ...mission,
        objectives: [...mission.objectives],
        waypoints: mission.waypoints.map((waypoint) => ({ ...waypoint })),
    };
}

function createMissionWriteRollbackState(state: Pick<
    GameState,
    | 'activeMission'
    | 'missions'
    | 'credits'
    | 'reputation'
    | 'phase'
    | 'missionTimer'
    | 'currentWaypointIndex'
    | 'completedWaypoints'
    | 'captureProgress'
    | 'showMissionPanel'
>): MissionWriteRollbackState {
    return {
        activeMission: cloneMissionForRollback(state.activeMission),
        missions: state.missions.map((mission) => ({
            ...mission,
            objectives: [...mission.objectives],
            waypoints: mission.waypoints.map((waypoint) => ({ ...waypoint })),
        })),
        credits: state.credits,
        reputation: state.reputation,
        phase: state.phase,
        missionTimer: state.missionTimer,
        currentWaypointIndex: state.currentWaypointIndex,
        completedWaypoints: [...state.completedWaypoints],
        captureProgress: Object.fromEntries(
            Object.entries(state.captureProgress).map(([districtId, capture]) => [districtId, { ...capture }]),
        ),
        showMissionPanel: state.showMissionPanel,
    };
}

function restoreMissionWriteRollbackState(
    set: (partial: Partial<GameState>) => void,
    getState: () => GameState,
    snapshot: MissionWriteRollbackState,
): void {
    if (snapshot.activeMission) {
        saveWaypointState(
            snapshot.activeMission.id,
            snapshot.currentWaypointIndex,
            snapshot.completedWaypoints,
        );
    } else {
        clearWaypointState();
    }

    set({
        activeMission: snapshot.activeMission,
        missions: snapshot.missions,
        credits: snapshot.credits,
        reputation: snapshot.reputation,
        phase: snapshot.phase,
        missionTimer: snapshot.missionTimer,
        currentWaypointIndex: snapshot.currentWaypointIndex,
        completedWaypoints: snapshot.completedWaypoints,
        captureProgress: snapshot.captureProgress,
        showMissionPanel: snapshot.showMissionPanel,
    });
    saveRepoCityRuntimeState(getState());
}

function shouldSyncWorkerMissionState(state: Pick<GameState, 'apiAvailable' | 'repoCityMode'>): boolean {
    return state.apiAvailable && !state.repoCityMode;
}

export type GamePhase = 'menu' | 'playing' | 'mission' | 'boss';

// ─── Capture State ───
export interface DistrictCapture {
    progress: number;    // 0–100
    capturing: boolean;
}

// ─── Reward Toast ───
export interface RewardToast {
    credits: number;
    rep: number;
    label: string;
    id: number; // unique, for animation key
}

export interface MovePlayerToDistrictOptions {
    animated?: boolean;
}

export interface RepoCityTransit {
    districtId: string;
    targetPosition: [number, number, number];
    pathPoints: [number, number, number][];
    pathIndex: number;
    mode: 'direct' | 'roads';
    roadIds: string[];
}

export interface SelectedGitHubRepoIngestState {
    tone: 'idle' | 'loading' | 'error';
    repoId: number | null;
    message: string | null;
}

interface SelectedGitHubRepoStateSlice {
    selectedGitHubRepo: GitHubReadableRepo | null;
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null;
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestState;
    showGitHubRepoPicker: boolean;
}

export interface GameState {
    // Game phase
    phase: GamePhase;
    setPhase: (phase: GamePhase) => void;

    // Player
    playerPosition: [number, number, number];
    setPlayerPosition: (pos: [number, number, number]) => void;
    playerName: string;
    credits: number;
    reputation: number;
    isSprinting: boolean;
    setSprinting: (v: boolean) => void;

    // Districts
    districts: District[];
    currentDistrict: District | null;
    repoCityTransit: RepoCityTransit | null;
    setCurrentDistrict: (district: District | null) => void;
    movePlayerToDistrict: (districtId: string | null, options?: MovePlayerToDistrictOptions) => boolean;
    advanceRepoCityTransit: () => void;
    clearRepoCityTransit: () => void;

    // Territory Capture
    captureProgress: Record<string, DistrictCapture>;
    addCaptureProgress: (districtId: string, amount: number) => void;

    // Missions
    missions: Mission[];
    activeMission: Mission | null;
    currentWaypointIndex: number;
    completedWaypoints: string[];
    acceptMission: (missionId: string) => void;
    reachWaypoint: (waypointId: string) => void;
    completeMission: (missionId: string) => void;
    failMission: (missionId: string) => void;

    // Factions
    factions: Faction[];
    leaderboard: LeaderboardEntry[];

    // Events
    events: CityEvent[];
    showBulletin: boolean;
    setShowBulletin: (show: boolean) => void;

    // Merge Conflicts
    conflicts: MergeConflictEncounter[];
    activeConflict: MergeConflictEncounter | null;
    resolveBossFight: (success: boolean) => void;

    // UI
    showLeaderboard: boolean;
    setShowLeaderboard: (show: boolean) => void;
    showMissionPanel: boolean;
    setShowMissionPanel: (show: boolean) => void;
    missionTimer: number;
    setMissionTimer: (t: number) => void;

    // Reward Toast
    rewardToasts: RewardToast[];
    addRewardToast: (toast: Omit<RewardToast, 'id'>) => void;
    removeRewardToast: (id: number) => void;

    // District Rooms (Durable Object: presence + live capture)
    districtRooms: Record<string, { presenceCount: number; captureProgress: number }>;
    setDistrictRoom: (districtId: string, data: { presenceCount: number; captureProgress: number }) => void;

    // Repo City
    connectedRepo: RepoModel | null;
    connectedRepoRefreshStatus: ConnectedRepoRefreshStatus | null;
    generatedCity: GeneratedCity | null;
    repoCityMode: boolean;
    loadRepoCity: (repo: RepoModel) => void;
    clearRepoCity: () => void;
    setConnectedRepoRefreshStatus: (status: ConnectedRepoRefreshStatus | null) => void;

    // GitHub Auth
    githubAccessToken: string | null;
    githubAuthStatus: 'anonymous' | 'exchanging' | 'authenticated' | 'error';
    githubAuthMessage: string | null;
    selectedGitHubRepo: GitHubReadableRepo | null;
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null;
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestState;
    showGitHubRepoPicker: boolean;
    setGitHubAuthExchanging: () => void;
    setGitHubAccessToken: (token: string) => void;
    setGitHubAuthError: (message: string) => void;
    setSelectedGitHubRepo: (repo: GitHubReadableRepo | null) => void;
    setSelectedGitHubRepoIngestState: (state: SelectedGitHubRepoIngestState) => void;
    setSelectedGitHubRepoSnapshot: (snapshot: GitHubRepoMetadataSnapshot | null) => void;
    setShowGitHubRepoPicker: (show: boolean) => void;

    // API
    apiAvailable: boolean;
    apiConnectionState: ApiConnectionState;
    apiStatusMessage: string | null;
    writeSessionState: ApiWriteSessionState;
    writeSessionMessage: string | null;
    setApiRuntimeStatus: (status: ApiRuntimeStatus) => void;
    loadFromApi: () => Promise<boolean>;
}

let toastIdCounter = 0;
let missionWriteMutationId = 0;
const INITIAL_PLAYER_POSITION: [number, number, number] = [0, 0.5, 0];
const initialRepoSnapshot = getBootstrapRepoSnapshot();
const initialGeneratedCity = initialRepoSnapshot ? generateCityFromRepo(initialRepoSnapshot) : null;
const baseInitialDistricts = initialGeneratedCity ? generatedCityToDistricts(initialGeneratedCity) : SEED_DISTRICTS;
const baseInitialMissions = initialGeneratedCity ? generatedCityToMissions(initialGeneratedCity) : SEED_MISSIONS;
const initialConflicts = initialGeneratedCity ? generatedCityToConflicts(initialGeneratedCity) : SEED_CONFLICTS;
const initialRepoCityRuntime = initialRepoSnapshot
    ? restoreRepoCityRuntimeState(initialRepoSnapshot, baseInitialDistricts, baseInitialMissions)
    : null;
const initialDistricts = baseInitialDistricts;
const initialMissions = initialRepoCityRuntime?.missions ?? baseInitialMissions;

function getOfflineApiStatusMessage(repoCityMode: boolean): string {
    return repoCityMode
        ? 'Worker API unavailable. Running local repo-city snapshot mode.'
        : 'Worker API unavailable. Running local seed mode.';
}

function createInitialSelectedGitHubRepoIngestState(): SelectedGitHubRepoIngestState {
    return {
        tone: 'idle',
        repoId: null,
        message: null,
    };
}

function buildResetSelectedGitHubRepoState(
    overrides: Partial<SelectedGitHubRepoStateSlice> = {},
): SelectedGitHubRepoStateSlice {
    return {
        selectedGitHubRepo: null,
        selectedGitHubRepoEligibility: null,
        selectedGitHubRepoIngestState: createInitialSelectedGitHubRepoIngestState(),
        showGitHubRepoPicker: false,
        ...overrides,
    };
}

function buildTransientRuntimeResetState() {
    return {
        playerPosition: [...INITIAL_PLAYER_POSITION] as [number, number, number],
        currentDistrict: null,
        repoCityTransit: null,
        districtRooms: {},
        showMissionPanel: false,
        showLeaderboard: false,
        showBulletin: false,
        rewardToasts: [],
        isSprinting: false,
    };
}

// ─── Initial capture progress for all districts ───
const initialCapture: Record<string, DistrictCapture> = {};
initialDistricts.forEach((d) => {
    initialCapture[d.id] = initialRepoCityRuntime?.captureProgress[d.id] ?? { progress: 0, capturing: false };
});

export const useGameStore = create<GameState>((set, get) => ({
    // Phase
    phase: initialRepoCityRuntime?.phase ?? 'menu',
    setPhase: (phase) => set({ phase }),

    // Player
    playerPosition: INITIAL_PLAYER_POSITION,
    setPlayerPosition: (pos) => set({ playerPosition: pos }),
    playerName: 'Runner',
    credits: initialRepoCityRuntime?.credits ?? 0,
    reputation: initialRepoCityRuntime?.reputation ?? 0,
    isSprinting: false,
    setSprinting: (v) => set({ isSprinting: v }),

    // Districts
    districts: initialDistricts,
    currentDistrict: null,
    repoCityTransit: null,
    setCurrentDistrict: (district) => set({ currentDistrict: district }),
    movePlayerToDistrict: (districtId, options) => {
        if (districtId === null) {
            set({ currentDistrict: null, repoCityTransit: null });
            return true;
        }

        const district = get().districts.find((candidate) => candidate.id === districtId);
        if (!district) {
            return false;
        }

        const playerY = get().playerPosition[1];
        const targetPosition: TransitPoint = [district.position[0], playerY, district.position[1]];
        if (get().repoCityMode && options?.animated) {
            const currentPosition: TransitPoint = [get().playerPosition[0], playerY, get().playerPosition[2]];
            const routedPath = buildRoadGuidedTransitPath(
                get().generatedCity,
                get().currentDistrict?.id ?? null,
                district.id,
                currentPosition,
                targetPosition,
            );
            set({
                repoCityTransit: {
                    districtId: district.id,
                    targetPosition,
                    pathPoints: routedPath.points,
                    pathIndex: 0,
                    mode: routedPath.mode,
                    roadIds: routedPath.roadIds,
                },
            });
            return true;
        }

        set({
            playerPosition: targetPosition,
            currentDistrict: district,
            repoCityTransit: null,
        });
        return true;
    },
    advanceRepoCityTransit: () => set((state) => {
        if (!state.repoCityTransit) {
            return {};
        }

        return {
            repoCityTransit: {
                ...state.repoCityTransit,
                pathIndex: Math.min(state.repoCityTransit.pathIndex + 1, state.repoCityTransit.pathPoints.length),
            },
        };
    }),
    clearRepoCityTransit: () => set({ repoCityTransit: null }),

    // Territory Capture
    captureProgress: initialCapture,
    addCaptureProgress: (districtId, amount) => {
        const current = get().captureProgress[districtId];
        if (!current) return;
        const newProgress = Math.min(100, current.progress + amount);
        const completedCaptureNow = current.progress < 100 && newProgress >= 100;
        set({
            captureProgress: {
                ...get().captureProgress,
                [districtId]: { progress: newProgress, capturing: newProgress < 100 },
            },
        });
        // Only cool the district once when capture actually crosses the finish line.
        if (completedCaptureNow) {
            const districts = get().districts.map((d) =>
                d.id === districtId ? { ...d, heatLevel: Math.max(0, d.heatLevel - 20) } : d
            );
            set({ districts });
        }
        saveRepoCityRuntimeState(get());
    },

    // Missions
    missions: initialMissions,
    activeMission: initialRepoCityRuntime?.activeMission ?? null,
    currentWaypointIndex: initialRepoCityRuntime?.currentWaypointIndex ?? 0,
    completedWaypoints: initialRepoCityRuntime?.completedWaypoints ?? [],
    acceptMission: (missionId) => {
        const mission = get().missions.find((m) => m.id === missionId);
        if (mission) {
            const rollbackState = createMissionWriteRollbackState(get());
            const shouldSync = shouldSyncWorkerMissionState(get());
            const mutationId = shouldSync ? ++missionWriteMutationId : missionWriteMutationId;
            // Boss missions start in 'mission' phase so the player must walk to the boss-route
            // approach waypoint before the fight begins. The conflict is set in reachWaypoint
            // once all approach waypoints are completed.
            set({
                activeMission: { ...mission, status: 'active' },
                missions: get().missions.map((m) => m.id === missionId ? { ...m, status: 'active' as const } : m),
                showMissionPanel: false,
                missionTimer: mission.timeLimit,
                currentWaypointIndex: 0,
                completedWaypoints: [],
                phase: 'mission',
            });
            saveRepoCityRuntimeState(get());

            if (shouldSync) {
                api.acceptMission(missionId).catch(() => {
                    if (mutationId !== missionWriteMutationId) {
                        return;
                    }

                    void get().loadFromApi()
                        .then((didSync) => {
                            if (!didSync) {
                                restoreMissionWriteRollbackState(set, get, rollbackState);
                            }
                        })
                        .catch(() => {
                            restoreMissionWriteRollbackState(set, get, rollbackState);
                        });
                });
            }
        }
    },
    reachWaypoint: (waypointId) => {
        const { activeMission, currentWaypointIndex, completedWaypoints } = get();
        if (!activeMission) return;

        const waypoints = activeMission.waypoints;
        const currentWp = waypoints[currentWaypointIndex];
        if (!currentWp || currentWp.id !== waypointId) return;

        const newCompleted = [...completedWaypoints, waypointId];
        const nextIndex = currentWaypointIndex + 1;

        if (nextIndex >= waypoints.length) {
            if (activeMission.type === 'boss') {
                // Approach complete: enter the boss fight.
                // Look up the conflict for this district and start the boss phase.
                const conflict = get().conflicts.find((c) => c.districtId === activeMission.districtId) ?? null;
                // Boss waypoints are done — clear persisted state so a reload restarts the approach.
                clearWaypointState();
                set({
                    completedWaypoints: newCompleted,
                    activeConflict: conflict,
                    phase: 'boss',
                    // Reset timer to the conflict's own timeLimit for the boss fight itself.
                    missionTimer: conflict?.timeLimit ?? activeMission.timeLimit,
                });
            } else {
                // Regular mission: all waypoints done → complete immediately.
                get().completeMission(activeMission.id);
            }
        } else {
            // Mid-mission: advance index and persist for same-tab reload survival.
            // Policy: waypoint progress is kept across reloads; timer is NOT (ADR-017).
            saveWaypointState(activeMission.id, nextIndex, newCompleted);
            set({
                currentWaypointIndex: nextIndex,
                completedWaypoints: newCompleted,
            });
            saveRepoCityRuntimeState(get());
        }
    },
    completeMission: (missionId) => {
        const mission = get().missions.find((m) => m.id === missionId);
        if (mission) {
            const rollbackState = createMissionWriteRollbackState(get());
            const shouldSync = shouldSyncWorkerMissionState(get());
            const mutationId = shouldSync ? ++missionWriteMutationId : missionWriteMutationId;
            // Mission is done — clear any persisted waypoint state.
            clearWaypointState();
            set({
                activeMission: null,
                missions: get().missions.map((m) => m.id === missionId ? { ...m, status: 'completed' as const } : m),
                phase: 'playing',
                missionTimer: 0,
                currentWaypointIndex: 0,
                completedWaypoints: [],
            });
            if (shouldSync) {
                api.completeMission(missionId)
                    .then(() => {
                        set({
                            credits: get().credits + mission.reward,
                            reputation: get().reputation + mission.factionReward,
                        });
                        get().addCaptureProgress(mission.districtId, 25);
                        get().addRewardToast({
                            credits: mission.reward,
                            rep: mission.factionReward,
                            label: mission.title,
                        });
                    })
                    .catch(() => {
                        if (mutationId !== missionWriteMutationId) {
                            return;
                        }

                        void get().loadFromApi()
                            .then((didSync) => {
                                if (!didSync) {
                                    restoreMissionWriteRollbackState(set, get, rollbackState);
                                }
                            })
                            .catch(() => {
                                restoreMissionWriteRollbackState(set, get, rollbackState);
                            });
                    });
                return;
            }

            get().addCaptureProgress(mission.districtId, 25);
            get().addRewardToast({
                credits: mission.reward,
                rep: mission.factionReward,
                label: mission.title,
            });
            set({
                credits: get().credits + mission.reward,
                reputation: get().reputation + mission.factionReward,
            });
            saveRepoCityRuntimeState(get());
        }
    },
    failMission: (missionId) => {
        const rollbackState = createMissionWriteRollbackState(get());
        const shouldSync = shouldSyncWorkerMissionState(get());
        const mutationId = shouldSync ? ++missionWriteMutationId : missionWriteMutationId;
        // Mission failed — clear any persisted waypoint state.
        clearWaypointState();
        set({
            activeMission: null,
            missions: get().missions.map((m) => m.id === missionId ? { ...m, status: 'available' as const } : m),
            phase: 'playing',
            missionTimer: 0,
            currentWaypointIndex: 0,
            completedWaypoints: [],
        });
        saveRepoCityRuntimeState(get());
        if (shouldSync) {
            api.failMission(missionId).catch(() => {
                if (mutationId !== missionWriteMutationId) {
                    return;
                }

                void get().loadFromApi()
                    .then((didSync) => {
                        if (!didSync) {
                            restoreMissionWriteRollbackState(set, get, rollbackState);
                        }
                    })
                    .catch(() => {
                        restoreMissionWriteRollbackState(set, get, rollbackState);
                    });
            });
        }
    },

    // Factions
    factions: SEED_FACTIONS.map((faction) => ({ ...faction })),
    leaderboard: buildSeedLeaderboard(),

    // Events
    events: SEED_EVENTS,
    showBulletin: false,
    setShowBulletin: (show) => set({ showBulletin: show }),

    // Merge Conflicts
    conflicts: initialConflicts,
    activeConflict: null,
    resolveBossFight: (success) => {
        const conflict = get().activeConflict;
        const activeMission = get().activeMission;
        if (conflict && success && !activeMission) {
            // Standalone boss fight (no mission context): award the conflict reward directly.
            // When triggered by a boss mission, completeMission handles credits + rep,
            // so we skip this block to prevent double-rewarding the player.
            set({
                credits: get().credits + conflict.reward,
                reputation: get().reputation + 25,
            });
        }
        if (activeMission) {
            if (success) {
                get().completeMission(activeMission.id);
            } else {
                get().failMission(activeMission.id);
            }
        }
        set({ activeConflict: null, phase: 'playing', missionTimer: 0 });
        saveRepoCityRuntimeState(get());
    },

    // UI
    showLeaderboard: false,
    setShowLeaderboard: (show) => set({ showLeaderboard: show }),
    showMissionPanel: false,
    setShowMissionPanel: (show) => set({ showMissionPanel: show }),
    missionTimer: initialRepoCityRuntime?.activeMission?.timeLimit ?? 0,
    setMissionTimer: (t) => set({ missionTimer: t }),

    // Reward Toast
    rewardToasts: [],
    addRewardToast: (toast) => {
        const id = ++toastIdCounter;
        set((s) => ({ rewardToasts: [...s.rewardToasts, { ...toast, id }] }));
        // Auto-remove after 3.5 seconds
        setTimeout(() => get().removeRewardToast(id), 3500);
    },
    removeRewardToast: (id) => {
        set((s) => ({ rewardToasts: s.rewardToasts.filter((t) => t.id !== id) }));
    },

    // Repo City
    connectedRepo: initialRepoSnapshot,
    connectedRepoRefreshStatus: initialRepoSnapshot?.metadata?.provider === 'github'
        ? createInitialConnectedRepoRefreshStatus(initialRepoSnapshot.signals)
        : null,
    generatedCity: initialGeneratedCity,
    repoCityMode: initialGeneratedCity !== null,
    loadRepoCity: (repo) => {
        const city = generateCityFromRepo(repo);
        const districts = generatedCityToDistricts(city);
        const baseMissions = generatedCityToMissions(city);
        const conflicts = generatedCityToConflicts(city);

        const capture: Record<string, DistrictCapture> = {};
        districts.forEach((d) => {
            capture[d.id] = { progress: 0, capturing: false };
        });
        const restoredRuntime = restoreRepoCityRuntimeState(repo, districts, baseMissions);

        if (restoredRuntime?.activeMission) {
            saveWaypointState(
                restoredRuntime.activeMission.id,
                restoredRuntime.currentWaypointIndex,
                restoredRuntime.completedWaypoints,
            );
        } else {
            clearWaypointState();
        }

        writeStoredSelectedRepoSnapshot(repo);
        writeBootstrapModePreference('repo-city');

        set({
            ...buildTransientRuntimeResetState(),
            connectedRepo: repo,
            connectedRepoRefreshStatus: repo.metadata?.provider === 'github'
                ? createInitialConnectedRepoRefreshStatus(repo.signals)
                : null,
            generatedCity: city,
            repoCityMode: true,
            districts,
            missions: restoredRuntime?.missions ?? baseMissions,
            conflicts,
            captureProgress: restoredRuntime?.captureProgress ?? capture,
            activeMission: restoredRuntime?.activeMission ?? null,
            activeConflict: null,
            currentWaypointIndex: restoredRuntime?.currentWaypointIndex ?? 0,
            completedWaypoints: restoredRuntime?.completedWaypoints ?? [],
            missionTimer: restoredRuntime?.activeMission?.timeLimit ?? 0,
            credits: restoredRuntime?.credits ?? 0,
            reputation: restoredRuntime?.reputation ?? 0,
            phase: restoredRuntime?.phase ?? 'menu',
            apiStatusMessage: get().apiConnectionState === 'offline'
                ? getOfflineApiStatusMessage(true)
                : get().apiStatusMessage,
        });
        saveRepoCityRuntimeState(get());
    },
    clearRepoCity: () => {
        const capture: Record<string, DistrictCapture> = {};
        SEED_DISTRICTS.forEach((d) => {
            capture[d.id] = { progress: 0, capturing: false };
        });

        clearWaypointState();
        writeBootstrapModePreference('classic');
        writeStoredSelectedRepoSnapshot(null);

        set({
            ...buildTransientRuntimeResetState(),
            ...buildResetSelectedGitHubRepoState(),
            connectedRepo: null,
            connectedRepoRefreshStatus: null,
            generatedCity: null,
            repoCityMode: false,
            districts: SEED_DISTRICTS,
            missions: SEED_MISSIONS,
            conflicts: SEED_CONFLICTS,
            captureProgress: capture,
            activeMission: null,
            activeConflict: null,
            currentWaypointIndex: 0,
            completedWaypoints: [],
            missionTimer: 0,
            credits: 0,
            reputation: 0,
            phase: 'menu',
            apiStatusMessage: get().apiConnectionState === 'offline'
                ? getOfflineApiStatusMessage(false)
                : get().apiStatusMessage,
        });
    },
    setConnectedRepoRefreshStatus: (status) => set({ connectedRepoRefreshStatus: status }),

    // GitHub Auth
    githubAccessToken: null,
    githubAuthStatus: 'anonymous',
    githubAuthMessage: null,
    ...buildResetSelectedGitHubRepoState(),
    setGitHubAuthExchanging: () => set({
        githubAuthStatus: 'exchanging',
        githubAuthMessage: null,
    }),
    setGitHubAccessToken: (token) => set({
        githubAccessToken: token,
        githubAuthStatus: 'authenticated',
        githubAuthMessage: null,
        ...buildResetSelectedGitHubRepoState({ showGitHubRepoPicker: true }),
    }),
    setGitHubAuthError: (message) => set({
        githubAccessToken: null,
        githubAuthStatus: 'error',
        githubAuthMessage: message,
        ...buildResetSelectedGitHubRepoState(),
    }),
    setSelectedGitHubRepo: (repo) => set((state) => {
        if (!repo) {
            return buildResetSelectedGitHubRepoState({ showGitHubRepoPicker: state.showGitHubRepoPicker });
        }

        const selectedGitHubRepoEligibility = getGitHubRepoTranslationEligibility(repo.visibility);
        if (state.selectedGitHubRepo?.id === repo.id) {
            return {
                selectedGitHubRepo: repo,
                selectedGitHubRepoEligibility,
            };
        }

        return buildResetSelectedGitHubRepoState({
            selectedGitHubRepo: repo,
            selectedGitHubRepoEligibility,
            showGitHubRepoPicker: state.showGitHubRepoPicker,
        });
    }),
    setSelectedGitHubRepoIngestState: (state) => set({ selectedGitHubRepoIngestState: state }),
    setSelectedGitHubRepoSnapshot: (snapshot) => {
        if (!snapshot) {
            return;
        }

        set({
            selectedGitHubRepoIngestState: createInitialSelectedGitHubRepoIngestState(),
        });
        get().loadRepoCity(snapshot);
    },
    setShowGitHubRepoPicker: (show) => set({ showGitHubRepoPicker: show }),

    // District Rooms
    districtRooms: {},
    setDistrictRoom: (districtId, data) => {
        set((s) => {
            // Merge: take the higher capture value (multiple players contributing)
            const local = s.captureProgress[districtId];
            const mergedProgress = local ? Math.max(local.progress, data.captureProgress) : data.captureProgress;
            return {
                districtRooms: { ...s.districtRooms, [districtId]: data },
                captureProgress: {
                    ...s.captureProgress,
                    [districtId]: { progress: mergedProgress, capturing: mergedProgress < 100 },
                },
            };
        });
        saveRepoCityRuntimeState(get());
    },

    // API Integration
    apiAvailable: false,
    apiConnectionState: 'unknown',
    apiStatusMessage: null,
    writeSessionState: 'unknown',
    writeSessionMessage: null,
    setApiRuntimeStatus: (status) => {
        set((s) => ({
            apiConnectionState: status.connectionState,
            apiAvailable: status.connectionState === 'offline' ? false : s.apiAvailable,
            apiStatusMessage: status.connectionState === 'offline'
                ? (status.connectionMessage ?? getOfflineApiStatusMessage(s.repoCityMode))
                : (status.connectionState === 'online' ? null : s.apiStatusMessage),
            writeSessionState: status.writeSessionState,
            writeSessionMessage: status.writeSessionMessage,
        }));
    },
    loadFromApi: async () => {
        const [districtsResult, missionsResult, leaderboardResult, eventsResult, conflictsResult] = await Promise.allSettled([
            api.fetchDistricts(),
            api.fetchMissions(),
            api.fetchLeaderboard(),
            api.fetchEvents(),
            api.fetchConflicts(),
        ]);

        const districts = districtsResult.status === 'fulfilled' ? districtsResult.value : null;
        const missions = missionsResult.status === 'fulfilled' ? missionsResult.value : null;
        const leaderboard = leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : null;
        const events = eventsResult.status === 'fulfilled' ? eventsResult.value : null;
        const conflicts = conflictsResult.status === 'fulfilled' ? conflictsResult.value : null;

        // If any core data came back, mark API as available
        if (districts && missions) {
            const preserveRepoCityState = get().repoCityMode && !!get().generatedCity && !!get().connectedRepo;
            if (preserveRepoCityState) {
                set({
                    apiAvailable: true,
                    apiConnectionState: 'online',
                    apiStatusMessage: null,
                    ...(leaderboard ? { leaderboard } : {}),
                    ...(events ? { events } : {}),
                });
                console.log('[MergeCrimes] Loaded runtime data from Worker API without replacing repo-city bootstrap state');
                return true;
            }

            const capture: Record<string, DistrictCapture> = {};
            districts.forEach((d) => {
                capture[d.id] = get().captureProgress[d.id] ?? { progress: 0, capturing: false };
            });

            const restoredActiveMission = missions.find((mission) => mission.status === 'active') ?? null;
            // Boss missions always restore to 'mission' phase so the player must walk the
            // approach route again. activeConflict is only set once the approach waypoint is reached.
            //
            // ADR-017 (Hybrid Policy): restore persisted waypoint index + completedWaypoints so
            // the player doesn't repeat already-cleared objectives after a same-tab reload.
            // The timer is NOT persisted — it always resets to mission.timeLimit on reload.
            let restoredWaypointIndex = 0;
            let restoredCompletedWaypoints: string[] = [];
            if (restoredActiveMission) {
                const saved = loadWaypointState(restoredActiveMission.id);
                if (saved) {
                    restoredWaypointIndex = saved.currentWaypointIndex;
                    restoredCompletedWaypoints = saved.completedWaypoints;
                }
                saveWaypointState(
                    restoredActiveMission.id,
                    restoredWaypointIndex,
                    restoredCompletedWaypoints,
                );
            } else {
                clearWaypointState();
            }
            const nextPhase = restoredActiveMission
                ? 'mission'
                : (get().phase === 'mission' ? 'playing' : get().phase);
            set({
                apiAvailable: true,
                apiConnectionState: 'online',
                apiStatusMessage: null,
                districts,
                missions,
                captureProgress: capture,
                activeMission: restoredActiveMission,
                activeConflict: null,
                currentWaypointIndex: restoredActiveMission ? restoredWaypointIndex : 0,
                completedWaypoints: restoredActiveMission ? restoredCompletedWaypoints : [],
                missionTimer: restoredActiveMission ? restoredActiveMission.timeLimit : 0,
                phase: nextPhase,
                ...(leaderboard ? { leaderboard } : {}),
                ...(events ? { events } : {}),
                ...(conflicts ? { conflicts } : {}),
            });
            console.log('[MergeCrimes] Loaded game data from Worker API');
            saveRepoCityRuntimeState(get());
            return true;
        } else {
            set({
                apiAvailable: false,
                apiConnectionState: 'offline',
                apiStatusMessage: getOfflineApiStatusMessage(get().repoCityMode),
            });
            console.log('[MergeCrimes] Worker API unavailable, using local fallback data');
            return false;
        }
    },
}));
