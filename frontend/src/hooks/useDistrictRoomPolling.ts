import { useEffect } from 'react';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';

export function useDistrictRoomPolling(): void {
    const apiAvailable = useGameStore((state) => state.apiAvailable);
    const currentDistrict = useGameStore((state) => state.currentDistrict);
    const phase = useGameStore((state) => state.phase);
    const setDistrictRoom = useGameStore((state) => state.setDistrictRoom);
    const addCaptureProgress = useGameStore((state) => state.addCaptureProgress);

    useEffect(() => {
        if (!currentDistrict || phase === 'menu' || phase === 'boss') {
            return;
        }

        const districtId = currentDistrict.id;
        const tickId = window.setInterval(() => {
            addCaptureProgress(districtId, 0.2);
        }, 1000);

        return () => {
            window.clearInterval(tickId);
        };
    }, [addCaptureProgress, currentDistrict, phase]);

    useEffect(() => {
        if (!apiAvailable || !currentDistrict) {
            return;
        }

        const districtId = currentDistrict.id;
        const syncDistrictRoom = async () => {
            try {
                const data = await api.districtHeartbeat(districtId);
                setDistrictRoom(districtId, data);
            } catch {
                // Network failures are non-fatal for presence refresh.
            }
        };

        void syncDistrictRoom();
        const intervalId = window.setInterval(() => {
            void syncDistrictRoom();
        }, 10_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [apiAvailable, currentDistrict, setDistrictRoom]);
}
