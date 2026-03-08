import { useEffect, useState } from 'react';
import {
    applyRepoRefreshCheckResult,
    createInitialConnectedRepoRefreshStatus,
} from '../../../shared/repoRefresh';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';

const CONNECTED_REPO_REFRESH_ACTIVE_POLL_MS = 60_000;
const CONNECTED_REPO_REFRESH_BACKOFF_POLL_MS = 5 * 60_000;

function useDocumentHidden(): boolean {
    const [isDocumentHidden, setIsDocumentHidden] = useState(() => (
        typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false
    ));

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const syncDocumentVisibility = () => {
            setIsDocumentHidden(document.visibilityState === 'hidden');
        };

        document.addEventListener('visibilitychange', syncDocumentVisibility);
        return () => {
            document.removeEventListener('visibilitychange', syncDocumentVisibility);
        };
    }, []);

    return isDocumentHidden;
}

export function useConnectedRepoRefreshPolling(): void {
    const repoCityMode = useGameStore((state) => state.repoCityMode);
    const connectedRepo = useGameStore((state) => state.connectedRepo);
    const setConnectedRepoRefreshStatus = useGameStore((state) => state.setConnectedRepoRefreshStatus);
    const githubAccessToken = useGameStore((state) => state.githubAccessToken);
    const apiConnectionState = useGameStore((state) => state.apiConnectionState);
    const isDocumentHidden = useDocumentHidden();
    const shouldBackOffRefreshChecks = isDocumentHidden || apiConnectionState === 'offline';

    useEffect(() => {
        if (
            !repoCityMode
            || !connectedRepo
            || connectedRepo.metadata?.provider !== 'github'
            || (connectedRepo.visibility === 'private' && !githubAccessToken)
        ) {
            return;
        }

        const repoId = connectedRepo.repoId;
        let activeController: AbortController | null = null;
        let inFlight = false;

        const getCurrentRefreshStatus = () => {
            const currentRepo = useGameStore.getState().connectedRepo;
            if (currentRepo?.repoId !== repoId) {
                return null;
            }

            return useGameStore.getState().connectedRepoRefreshStatus
                ?? createInitialConnectedRepoRefreshStatus(currentRepo.signals);
        };

        const stopCheckingState = () => {
            const currentStatus = getCurrentRefreshStatus();
            if (!currentStatus?.isChecking) {
                return;
            }

            useGameStore.getState().setConnectedRepoRefreshStatus({
                ...currentStatus,
                isChecking: false,
            });
        };

        const checkRefreshStatus = async () => {
            if (inFlight) {
                return;
            }

            const currentStatus = getCurrentRefreshStatus();
            if (!currentStatus) {
                return;
            }

            inFlight = true;
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;

            setConnectedRepoRefreshStatus({
                ...currentStatus,
                isChecking: true,
                errorMessage: null,
            });

            try {
                const refreshCheck = await api.fetchGitHubRepoRefreshStatus(
                    {
                        owner: connectedRepo.owner,
                        name: connectedRepo.name,
                        defaultBranch: connectedRepo.defaultBranch,
                        lastKnownCommitSha: currentStatus.lastKnownCommitSha,
                    },
                    controller.signal,
                    githubAccessToken ?? undefined,
                );

                if (controller.signal.aborted || useGameStore.getState().connectedRepo?.repoId !== repoId) {
                    return;
                }

                useGameStore.getState().setConnectedRepoRefreshStatus(applyRepoRefreshCheckResult(refreshCheck));
            } catch (error: unknown) {
                if (controller.signal.aborted || useGameStore.getState().connectedRepo?.repoId !== repoId) {
                    return;
                }

                useGameStore.getState().setConnectedRepoRefreshStatus({
                    ...currentStatus,
                    status: 'error',
                    isChecking: false,
                    errorMessage: error instanceof Error
                        ? error.message
                        : 'Repo update status check failed.',
                });
            } finally {
                inFlight = false;

                if (activeController === controller) {
                    activeController = null;
                }
            }
        };

        if (!shouldBackOffRefreshChecks) {
            void checkRefreshStatus();
        }

        const intervalId = window.setInterval(() => {
            void checkRefreshStatus();
        }, shouldBackOffRefreshChecks
            ? CONNECTED_REPO_REFRESH_BACKOFF_POLL_MS
            : CONNECTED_REPO_REFRESH_ACTIVE_POLL_MS);

        return () => {
            activeController?.abort();
            stopCheckingState();
            window.clearInterval(intervalId);
        };
    }, [
        apiConnectionState,
        connectedRepo,
        githubAccessToken,
        isDocumentHidden,
        repoCityMode,
        setConnectedRepoRefreshStatus,
        shouldBackOffRefreshChecks,
    ]);
}
