import { create } from 'zustand';
import type { District, Mission, Faction, CityEvent, MergeConflictEncounter, LeaderboardEntry } from '../../../shared/types';
import type { GitHubRepoMetadataSnapshot, RepoModel, GeneratedCity, GeneratedRoad } from '../../../shared/repoModel';
import { generateCityFromRepo, generatedCityToDistricts, generatedCityToMissions, generatedCityToConflicts } from '../../../shared/repoCityGenerator';
import { buildSeedLeaderboard, SEED_FACTIONS } from '../../../shared/seed/factions';
import { SEED_DISTRICTS } from '../../../shared/seed/districts';
import { SEED_MISSIONS } from '../../../shared/seed/missions';
import { SEED_EVENTS } from '../../../shared/seed/events';
import { SEED_CONFLICTS } from '../../../shared/seed/conflicts';
import * as api from '../api';
import { getBootstrapRepoSnapshot, writeStoredSelectedGitHubRepoSnapshot } from '../repoCityBootstrap';
import type { ApiConnectionState, ApiRuntimeStatus, ApiWriteSessionState, GitHubReadableRepo } from '../api';

// ─── Waypoint Persistence (ADR-017: Hybrid Policy) ───
// Persists waypoint index + completed set across same-tab reloads so the player
// does NOT have to repeat waypoints they already cleared.
// Timer is NOT persisted; it always resets to mission.timeLimit on reload.
const WAYPOINT_STATE_KEY = 'mc-waypoint-state';

interface PersistedWaypointState {
    missionId: string;
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

export type GamePhase = 'menu' | 'playing' | 'mission' | 'boss' | 'bulletin' | 'leaderboard' | 'paused';

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

export interface GameState {
    // Game phase
    phase: GamePhase;
    setPhase: (phase: GamePhase) => void;

    // Player
    playerPosition: [number, number, number];
    setPlayerPosition: (pos: [number, number, number]) => void;
    playerName: string;
    credits: number;
    addCredits: (amount: number) => void;
    reputation: number;
    addReputation: (amount: number) => void;
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
    startBossFight: (conflictId: string) => void;
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
    generatedCity: GeneratedCity | null;
    repoCityMode: boolean;
    loadRepoCity: (repo: RepoModel) => void;
    clearRepoCity: () => void;

    // GitHub Auth
    githubAccessToken: string | null;
    githubAuthStatus: 'anonymous' | 'exchanging' | 'authenticated' | 'error';
    githubAuthMessage: string | null;
    selectedGitHubRepo: GitHubReadableRepo | null;
    selectedGitHubRepoSnapshot: GitHubRepoMetadataSnapshot | null;
    showGitHubRepoPicker: boolean;
    setGitHubAuthExchanging: () => void;
    setGitHubAccessToken: (token: string) => void;
    setGitHubAuthError: (message: string) => void;
    clearGitHubAuth: () => void;
    setSelectedGitHubRepo: (repo: GitHubReadableRepo | null) => void;
    setSelectedGitHubRepoSnapshot: (snapshot: GitHubRepoMetadataSnapshot | null) => void;
    setShowGitHubRepoPicker: (show: boolean) => void;

    // API
    apiAvailable: boolean;
    apiConnectionState: ApiConnectionState;
    apiStatusMessage: string | null;
    writeSessionState: ApiWriteSessionState;
    writeSessionMessage: string | null;
    setApiRuntimeStatus: (status: ApiRuntimeStatus) => void;
    loadFromApi: () => Promise<void>;
}

let toastIdCounter = 0;

const REPO_CITY_MAX_TRANSIT_HOPS = 3;
const REPO_CITY_MAX_ROUTE_DISTANCE_RATIO = 1.9;
const REPO_CITY_ROUTE_POINT_EPSILON = 0.75;
const initialRepoSnapshot = getBootstrapRepoSnapshot();
const initialGeneratedCity = initialRepoSnapshot ? generateCityFromRepo(initialRepoSnapshot) : null;
const initialDistricts = initialGeneratedCity ? generatedCityToDistricts(initialGeneratedCity) : SEED_DISTRICTS;
const initialMissions = initialGeneratedCity ? generatedCityToMissions(initialGeneratedCity) : SEED_MISSIONS;
const initialConflicts = initialGeneratedCity ? generatedCityToConflicts(initialGeneratedCity) : SEED_CONFLICTS;

type TransitPoint = [number, number, number];

interface TransitGraphEdge {
    roadId: string;
    toDistrictId: string;
    points: TransitPoint[];
    distance: number;
}

interface RoutedTransitPath {
    mode: 'direct' | 'roads';
    points: TransitPoint[];
    roadIds: string[];
}

function getOfflineApiStatusMessage(repoCityMode: boolean): string {
    return repoCityMode
        ? 'Worker API unavailable. Running local repo-city snapshot mode.'
        : 'Worker API unavailable. Running local seed mode.';
}

function measureTransitDistance(a: TransitPoint, b: TransitPoint): number {
    return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

function measureTransitPathDistance(startPoint: TransitPoint, pathPoints: TransitPoint[]): number {
    let total = 0;
    let previous = startPoint;

    pathPoints.forEach((point) => {
        total += measureTransitDistance(previous, point);
        previous = point;
    });

    return total;
}

function appendTransitPoint(points: TransitPoint[], point: TransitPoint) {
    const previous = points[points.length - 1];
    if (!previous || measureTransitDistance(previous, point) > REPO_CITY_ROUTE_POINT_EPSILON) {
        points.push(point);
    }
}

function roadToTransitPoints(road: GeneratedRoad, playerY: number, reverse = false): TransitPoint[] {
    const sourcePoints = reverse ? [...road.points].reverse() : road.points;
    return sourcePoints.map((point) => [point.x, playerY, point.y]);
}

function measureRoadDistance(points: TransitPoint[]): number {
    if (points.length < 2) {
        return 0;
    }

    return measureTransitPathDistance(points[0], points.slice(1));
}

function buildRoadGuidedTransitPath(
    city: GeneratedCity | null,
    currentDistrictId: string | null,
    targetDistrictId: string,
    currentPosition: TransitPoint,
    targetPosition: TransitPoint,
): RoutedTransitPath {
    const directPath: RoutedTransitPath = {
        mode: 'direct',
        points: [targetPosition],
        roadIds: [],
    };

    if (!city || !currentDistrictId || currentDistrictId === targetDistrictId || city.roads.length === 0) {
        return directPath;
    }

    const districtById = new Map(city.districts.map((district) => [district.id, district] as const));
    if (!districtById.has(currentDistrictId) || !districtById.has(targetDistrictId)) {
        return directPath;
    }

    const adjacency = new Map<string, TransitGraphEdge[]>();
    const addEdge = (fromDistrictId: string, edge: TransitGraphEdge) => {
        const currentEdges = adjacency.get(fromDistrictId) ?? [];
        currentEdges.push(edge);
        adjacency.set(fromDistrictId, currentEdges);
    };

    city.roads.forEach((road) => {
        const forwardPoints = roadToTransitPoints(road, currentPosition[1]);
        const reversePoints = [...forwardPoints].reverse();

        addEdge(road.fromDistrictId, {
            roadId: road.id,
            toDistrictId: road.toDistrictId,
            points: forwardPoints,
            distance: measureRoadDistance(forwardPoints),
        });
        addEdge(road.toDistrictId, {
            roadId: road.id,
            toDistrictId: road.fromDistrictId,
            points: reversePoints,
            distance: measureRoadDistance(reversePoints),
        });
    });

    const queue: Array<{ districtId: string; distance: number; hops: number }> = [{
        districtId: currentDistrictId,
        distance: 0,
        hops: 0,
    }];
    const bestByDistrict = new Map<string, { distance: number; hops: number }>([
        [currentDistrictId, { distance: 0, hops: 0 }],
    ]);
    const previousByDistrict = new Map<string, { fromDistrictId: string; edge: TransitGraphEdge }>();

    while (queue.length > 0) {
        queue.sort((a, b) => a.distance - b.distance || a.hops - b.hops);
        const current = queue.shift();
        if (!current) {
            break;
        }

        if (current.districtId === targetDistrictId) {
            break;
        }

        const currentBest = bestByDistrict.get(current.districtId);
        if (currentBest && current.distance > currentBest.distance + 0.001) {
            continue;
        }

        (adjacency.get(current.districtId) ?? []).forEach((edge) => {
            const nextHops = current.hops + 1;
            if (nextHops > REPO_CITY_MAX_TRANSIT_HOPS) {
                return;
            }

            const nextDistance = current.distance + edge.distance;
            const existing = bestByDistrict.get(edge.toDistrictId);
            if (
                existing
                && (nextDistance > existing.distance + 0.001
                    || (Math.abs(nextDistance - existing.distance) <= 0.001 && nextHops >= existing.hops))
            ) {
                return;
            }

            bestByDistrict.set(edge.toDistrictId, { distance: nextDistance, hops: nextHops });
            previousByDistrict.set(edge.toDistrictId, { fromDistrictId: current.districtId, edge });
            queue.push({
                districtId: edge.toDistrictId,
                distance: nextDistance,
                hops: nextHops,
            });
        });
    }

    if (!previousByDistrict.has(targetDistrictId)) {
        return directPath;
    }

    const orderedEdges: TransitGraphEdge[] = [];
    let cursor = targetDistrictId;
    while (cursor !== currentDistrictId) {
        const previous = previousByDistrict.get(cursor);
        if (!previous) {
            return directPath;
        }

        orderedEdges.unshift(previous.edge);
        cursor = previous.fromDistrictId;
    }

    const routedPoints: TransitPoint[] = [];
    orderedEdges.forEach((edge) => {
        edge.points.forEach((point) => appendTransitPoint(routedPoints, point));
    });
    appendTransitPoint(routedPoints, targetPosition);

    const normalizedPoints = routedPoints.filter(
        (point) => measureTransitDistance(currentPosition, point) > REPO_CITY_ROUTE_POINT_EPSILON,
    );
    if (normalizedPoints.length === 0) {
        return directPath;
    }

    const directDistance = measureTransitDistance(currentPosition, targetPosition);
    const routedDistance = measureTransitPathDistance(currentPosition, normalizedPoints);
    if (
        directDistance <= REPO_CITY_ROUTE_POINT_EPSILON
        || routedDistance > directDistance * REPO_CITY_MAX_ROUTE_DISTANCE_RATIO
    ) {
        return directPath;
    }

    return {
        mode: 'roads',
        points: normalizedPoints,
        roadIds: [...new Set(orderedEdges.map((edge) => edge.roadId))],
    };
}

// ─── Initial capture progress for all districts ───
const initialCapture: Record<string, DistrictCapture> = {};
initialDistricts.forEach((d) => {
    initialCapture[d.id] = { progress: 0, capturing: false };
});

export const useGameStore = create<GameState>((set, get) => ({
    // Phase
    phase: 'menu',
    setPhase: (phase) => set({ phase }),

    // Player
    playerPosition: [0, 0.5, 0],
    setPlayerPosition: (pos) => set({ playerPosition: pos }),
    playerName: 'Runner',
    credits: 0,
    addCredits: (amount) => set((s) => ({ credits: s.credits + amount })),
    reputation: 0,
    addReputation: (amount) => set((s) => ({ reputation: s.reputation + amount })),
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
        set({
            captureProgress: {
                ...get().captureProgress,
                [districtId]: { progress: newProgress, capturing: newProgress < 100 },
            },
        });
        // At 100%, decrease heat
        if (newProgress >= 100) {
            const districts = get().districts.map((d) =>
                d.id === districtId ? { ...d, heatLevel: Math.max(0, d.heatLevel - 20) } : d
            );
            set({ districts });
        }
    },

    // Missions
    missions: initialMissions,
    activeMission: null,
    currentWaypointIndex: 0,
    completedWaypoints: [],
    acceptMission: (missionId) => {
        const mission = get().missions.find((m) => m.id === missionId);
        if (mission) {
            // Boss missions start in 'mission' phase so the player must walk to the conflict
            // zone waypoint before the boss fight begins. The conflict is set in reachWaypoint
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
            // Fire-and-forget API sync — client is source of truth for UX
            if (get().apiAvailable) {
                api.acceptMission(missionId).catch(() => { /* network failure is non-fatal */ });
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
        }
    },
    completeMission: (missionId) => {
        const mission = get().missions.find((m) => m.id === missionId);
        if (mission) {
            // Mission is done — clear any persisted waypoint state.
            clearWaypointState();
            set({
                activeMission: null,
                missions: get().missions.map((m) => m.id === missionId ? { ...m, status: 'completed' as const } : m),
                credits: get().credits + mission.reward,
                reputation: get().reputation + mission.factionReward,
                phase: 'playing',
                missionTimer: 0,
                currentWaypointIndex: 0,
                completedWaypoints: [],
            });
            // Add capture progress for the district
            get().addCaptureProgress(mission.districtId, 25);
            // Show reward toast
            get().addRewardToast({
                credits: mission.reward,
                rep: mission.factionReward,
                label: mission.title,
            });
            // Fire-and-forget API sync — updates D1 mission status + faction score
            if (get().apiAvailable) {
                api.completeMission(missionId).catch(() => { /* network failure is non-fatal */ });
            }
        }
    },
    failMission: (missionId) => {
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
        if (get().apiAvailable) {
            api.failMission(missionId).catch(() => { /* network failure is non-fatal */ });
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
    startBossFight: (conflictId) => {
        const conflict = get().conflicts.find((c) => c.id === conflictId);
        if (conflict) {
            set({ activeConflict: conflict, phase: 'boss', missionTimer: conflict.timeLimit });
        }
    },
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
    },

    // UI
    showLeaderboard: false,
    setShowLeaderboard: (show) => set({ showLeaderboard: show }),
    showMissionPanel: false,
    setShowMissionPanel: (show) => set({ showMissionPanel: show }),
    missionTimer: 0,
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
    generatedCity: initialGeneratedCity,
    repoCityMode: initialGeneratedCity !== null,
    loadRepoCity: (repo) => {
        const city = generateCityFromRepo(repo);
        const districts = generatedCityToDistricts(city);
        const missions = generatedCityToMissions(city);
        const conflicts = generatedCityToConflicts(city);

        const capture: Record<string, DistrictCapture> = {};
        districts.forEach((d) => {
            capture[d.id] = { progress: 0, capturing: false };
        });

        set({
            connectedRepo: repo,
            generatedCity: city,
            repoCityMode: true,
            districts,
            missions,
            conflicts,
            captureProgress: capture,
            activeMission: null,
            activeConflict: null,
            currentDistrict: null,
            repoCityTransit: null,
            currentWaypointIndex: 0,
            completedWaypoints: [],
            missionTimer: 0,
            phase: 'menu',
            apiStatusMessage: get().apiConnectionState === 'offline'
                ? getOfflineApiStatusMessage(true)
                : get().apiStatusMessage,
        });
    },
    clearRepoCity: () => {
        const capture: Record<string, DistrictCapture> = {};
        SEED_DISTRICTS.forEach((d) => {
            capture[d.id] = { progress: 0, capturing: false };
        });

        set({
            connectedRepo: null,
            generatedCity: null,
            repoCityMode: false,
            districts: SEED_DISTRICTS,
            missions: SEED_MISSIONS,
            conflicts: SEED_CONFLICTS,
            captureProgress: capture,
            activeMission: null,
            activeConflict: null,
            currentDistrict: null,
            repoCityTransit: null,
            currentWaypointIndex: 0,
            completedWaypoints: [],
            missionTimer: 0,
            phase: 'menu',
            apiStatusMessage: get().apiConnectionState === 'offline'
                ? getOfflineApiStatusMessage(false)
                : get().apiStatusMessage,
        });
    },

    // GitHub Auth
    githubAccessToken: null,
    githubAuthStatus: 'anonymous',
    githubAuthMessage: null,
    selectedGitHubRepo: null,
    selectedGitHubRepoSnapshot: null,
    showGitHubRepoPicker: false,
    setGitHubAuthExchanging: () => set({
        githubAuthStatus: 'exchanging',
        githubAuthMessage: null,
    }),
    setGitHubAccessToken: (token) => set({
        githubAccessToken: token,
        githubAuthStatus: 'authenticated',
        githubAuthMessage: null,
        selectedGitHubRepo: null,
        selectedGitHubRepoSnapshot: null,
        showGitHubRepoPicker: true,
    }),
    setGitHubAuthError: (message) => set({
        githubAccessToken: null,
        githubAuthStatus: 'error',
        githubAuthMessage: message,
        selectedGitHubRepo: null,
        selectedGitHubRepoSnapshot: null,
        showGitHubRepoPicker: false,
    }),
    clearGitHubAuth: () => set({
        githubAccessToken: null,
        githubAuthStatus: 'anonymous',
        githubAuthMessage: null,
        selectedGitHubRepo: null,
        selectedGitHubRepoSnapshot: null,
        showGitHubRepoPicker: false,
    }),
    setSelectedGitHubRepo: (repo) => set({ selectedGitHubRepo: repo }),
    setSelectedGitHubRepoSnapshot: (snapshot) => {
        set({ selectedGitHubRepoSnapshot: snapshot });

        if (!snapshot) {
            return;
        }

        writeStoredSelectedGitHubRepoSnapshot(snapshot);
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
                ? getOfflineApiStatusMessage(s.repoCityMode)
                : s.apiStatusMessage,
            writeSessionState: status.writeSessionState,
            writeSessionMessage: status.writeSessionMessage,
        }));
    },
    loadFromApi: async () => {
        const [districts, missions, leaderboard, events, conflicts] = await Promise.all([
            api.fetchDistricts(),
            api.fetchMissions(),
            api.fetchLeaderboard(),
            api.fetchEvents(),
            api.fetchConflicts(),
        ]);

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
                return;
            }

            const capture: Record<string, DistrictCapture> = {};
            districts.forEach((d) => {
                capture[d.id] = get().captureProgress[d.id] ?? { progress: 0, capturing: false };
            });

            const restoredActiveMission = missions.find((mission) => mission.status === 'active') ?? null;
            // Boss missions always restore to 'mission' phase so the player must walk to the
            // conflict zone again. activeConflict is only set once the approach waypoint is reached.
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
            }
            set({
                apiAvailable: true,
                apiConnectionState: 'online',
                apiStatusMessage: null,
                districts,
                missions,
                captureProgress: capture,
                activeMission: restoredActiveMission,
                activeConflict: null,
                currentWaypointIndex: restoredActiveMission ? restoredWaypointIndex : get().currentWaypointIndex,
                completedWaypoints: restoredActiveMission ? restoredCompletedWaypoints : get().completedWaypoints,
                missionTimer: restoredActiveMission ? restoredActiveMission.timeLimit : get().missionTimer,
                phase: restoredActiveMission ? 'mission' : get().phase,
                ...(leaderboard ? { leaderboard } : {}),
                ...(events ? { events } : {}),
                ...(conflicts ? { conflicts } : {}),
            });
            console.log('[MergeCrimes] Loaded game data from Worker API');
        } else {
            set({
                apiAvailable: false,
                apiConnectionState: 'offline',
                apiStatusMessage: getOfflineApiStatusMessage(get().repoCityMode),
            });
            console.log('[MergeCrimes] Worker API unavailable, using local fallback data');
        }
    },
}));
