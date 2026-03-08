import { SESSION_ID } from './api';
import { useGameStore } from './store/gameStore';
import { isLocalSmokeMode } from './runtimeConfig';

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
};

interface MergeCrimesSmokeApi {
    snapshot: () => SmokeSnapshot;
    startGame: () => void;
    setCurrentDistrict: (districtId: string | null) => boolean;
    completeActiveMission: () => boolean;
    failActiveMission: () => boolean;
}

declare global {
    interface Window {
        __MERGE_CRIMES_SMOKE__?: MergeCrimesSmokeApi;
    }
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
    };
}

function startGame(): void {
    const state = useGameStore.getState();
    if (state.phase === 'menu') {
        state.setPhase('playing');
    }
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
        setCurrentDistrict,
        completeActiveMission,
        failActiveMission,
    };

    return () => {
        delete window.__MERGE_CRIMES_SMOKE__;
    };
}
