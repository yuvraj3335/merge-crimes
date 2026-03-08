import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function useMissionTimer(): void {
    const phase = useGameStore((state) => state.phase);
    const activeMission = useGameStore((state) => state.activeMission);
    const missionTimer = useGameStore((state) => state.missionTimer);
    const setMissionTimer = useGameStore((state) => state.setMissionTimer);
    const failMission = useGameStore((state) => state.failMission);

    useEffect(() => {
        if (phase !== 'mission' || !activeMission || missionTimer <= 0) {
            return;
        }

        const intervalId = window.setInterval(() => {
            const nextTimer = missionTimer - 1;
            setMissionTimer(nextTimer);
            if (nextTimer <= 0 && activeMission) {
                failMission(activeMission.id);
            }
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [activeMission, failMission, missionTimer, phase, setMissionTimer]);
}
