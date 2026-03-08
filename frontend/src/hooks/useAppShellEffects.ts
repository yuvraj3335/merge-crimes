import { useEffect, useRef } from 'react';
import * as api from '../api';
import { installLocalSmokeBridge } from '../localSmokeBridge';
import { useGameStore } from '../store/gameStore';

export function useAppShellEffects(): void {
    const phase = useGameStore((state) => state.phase);
    const apiAvailable = useGameStore((state) => state.apiAvailable);
    const apiLoadedRef = useRef(false);
    const loadFromApi = useGameStore((state) => state.loadFromApi);
    const setApiRuntimeStatus = useGameStore((state) => state.setApiRuntimeStatus);
    const showMissionPanel = useGameStore((state) => state.showMissionPanel);
    const setShowMissionPanel = useGameStore((state) => state.setShowMissionPanel);
    const showLeaderboard = useGameStore((state) => state.showLeaderboard);
    const setShowLeaderboard = useGameStore((state) => state.setShowLeaderboard);
    const showBulletin = useGameStore((state) => state.showBulletin);
    const setShowBulletin = useGameStore((state) => state.setShowBulletin);

    useEffect(() => {
        if (apiLoadedRef.current) {
            return;
        }

        apiLoadedRef.current = true;
        void loadFromApi();
    }, [loadFromApi]);

    useEffect(() => (
        api.subscribeApiRuntimeStatus((status) => {
            setApiRuntimeStatus(status);
        })
    ), [setApiRuntimeStatus]);

    useEffect(() => installLocalSmokeBridge(), []);

    useEffect(() => {
        if (phase !== 'menu' && apiAvailable) {
            void api.primePublicWriteSession();
        }
    }, [apiAvailable, phase]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (phase === 'menu' || phase === 'boss') {
                return;
            }

            switch (event.key.toLowerCase()) {
                case 'm':
                    setShowMissionPanel(!showMissionPanel);
                    break;
                case 'l':
                    setShowLeaderboard(!showLeaderboard);
                    break;
                case 'b':
                    setShowBulletin(!showBulletin);
                    break;
                case 'escape':
                    setShowMissionPanel(false);
                    setShowLeaderboard(false);
                    setShowBulletin(false);
                    break;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [
        phase,
        setShowBulletin,
        setShowLeaderboard,
        setShowMissionPanel,
        showBulletin,
        showLeaderboard,
        showMissionPanel,
    ]);
}
