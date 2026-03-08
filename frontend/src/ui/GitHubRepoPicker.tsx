import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';

interface GitHubRepoPickerProps {
    open: boolean;
    onClose: () => void;
}

type PickerStatus = 'idle' | 'loading' | 'ready' | 'error';

interface TokenScopedError {
    token: string;
    message: string;
}

export function GitHubRepoPicker({ open, onClose }: GitHubRepoPickerProps) {
    const githubAccessToken = useGameStore((s) => s.githubAccessToken);
    const repoCityMode = useGameStore((s) => s.repoCityMode);
    const selectedGitHubRepo = useGameStore((s) => s.selectedGitHubRepo);
    const setSelectedGitHubRepo = useGameStore((s) => s.setSelectedGitHubRepo);
    const setSelectedGitHubRepoSnapshot = useGameStore((s) => s.setSelectedGitHubRepoSnapshot);

    const [repos, setRepos] = useState<api.GitHubReadableRepo[]>([]);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [loadedToken, setLoadedToken] = useState<string | null>(null);
    const [errorState, setErrorState] = useState<TokenScopedError | null>(null);
    const ingestControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open || !githubAccessToken || loadedToken === githubAccessToken) {
            return;
        }

        const controller = new AbortController();

        void api.fetchGitHubReadableRepos(githubAccessToken, controller.signal)
            .then((response) => {
                if (controller.signal.aborted) {
                    return;
                }

                setRepos(response.repos);
                setHasNextPage(response.hasNextPage);
                setErrorState(null);
                setLoadedToken(githubAccessToken);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                setRepos([]);
                setHasNextPage(false);
                setErrorState({
                    token: githubAccessToken,
                    message: error instanceof Error ? error.message : 'GitHub repo fetch failed.',
                });
                setLoadedToken(null);
            });

        return () => controller.abort();
    }, [githubAccessToken, loadedToken, open]);

    useEffect(() => () => {
        ingestControllerRef.current?.abort();
    }, []);

    if (!open) {
        return null;
    }

    const activeErrorMessage = errorState?.token === githubAccessToken ? errorState.message : null;
    const status: PickerStatus = !githubAccessToken
        ? 'idle'
        : activeErrorMessage
            ? 'error'
            : loadedToken !== githubAccessToken
            ? 'loading'
            : 'ready';
    const visibleRepos = status === 'ready' ? repos : [];

    const pickerHint = githubAccessToken
        ? 'Fetched from GitHub with the OAuth token currently stored in frontend state.'
        : 'GitHub auth token missing from frontend state.';

    function handleRepoSelection(repo: api.GitHubReadableRepo) {
        const shouldTriggerIngest = repo.visibility === 'public' && selectedGitHubRepo?.id !== repo.id;
        const isNewSelection = selectedGitHubRepo?.id !== repo.id;

        setSelectedGitHubRepo(repo);

        if (!isNewSelection) {
            return;
        }

        ingestControllerRef.current?.abort();
        setSelectedGitHubRepoSnapshot(null);

        if (!shouldTriggerIngest) {
            return;
        }

        const controller = new AbortController();
        ingestControllerRef.current = controller;

        void api.fetchGitHubRepoMetadata(
            repo.ownerLogin,
            repo.name,
            controller.signal,
            githubAccessToken ?? undefined,
        )
            .then((snapshot) => {
                if (!snapshot || controller.signal.aborted) {
                    return;
                }

                const currentSelection = useGameStore.getState().selectedGitHubRepo;
                if (currentSelection?.id !== repo.id) {
                    return;
                }

                setSelectedGitHubRepoSnapshot(snapshot);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                console.warn(
                    '[MergeCrimes] GitHub repo metadata ingest failed',
                    error instanceof Error ? error.message : error,
                );
            });
    }

    return (
        <div className={`repo-selector-panel ${repoCityMode ? 'repo-city' : ''}`.trim()} data-testid="github-repo-picker">
            <div className={`repo-selector-header ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                <div className="repo-selector-heading">
                    {repoCityMode && (
                        <div className="repo-selector-kicker">Authenticated GitHub repos</div>
                    )}
                    <div className="repo-selector-title">Pick a GitHub Repository</div>
                    <div className="repo-selector-hint">{pickerHint}</div>
                </div>
                {repoCityMode && (
                    <button
                        type="button"
                        className="repo-selector-close-icon"
                        aria-label="Close GitHub repository picker"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="repo-selector-meta" aria-live="polite">
                {status === 'loading' && 'Loading repositories from GitHub...'}
                {status === 'error' && (activeErrorMessage ?? 'GitHub repo fetch failed.')}
                {status === 'ready' && visibleRepos.length === 0 && 'No readable repositories returned by GitHub.'}
                {status === 'ready' && visibleRepos.length > 0 && `${visibleRepos.length} readable repos loaded.`}
                {status === 'idle' && !githubAccessToken && 'Log in with GitHub to load readable repos.'}
                {status === 'ready' && hasNextPage && ' Showing the first 100 repos from the initial GitHub page.'}
            </div>

            <div className="repo-selector-list">
                {visibleRepos.map((repo) => (
                    <button
                        key={repo.id}
                        type="button"
                        data-testid={`github-repo-${repo.id}`}
                        className={`repo-selector-item ${selectedGitHubRepo?.id === repo.id ? 'selected' : ''} ${repoCityMode ? 'repo-city' : ''}`.trim()}
                        onClick={() => handleRepoSelection(repo)}
                    >
                        <div className="repo-item-topline">
                            <div>
                                <div className="repo-item-name">{repo.fullName}</div>
                                <div className="repo-item-branch">
                                    {repo.defaultBranch} · {repo.visibility}
                                </div>
                            </div>
                            <div className="repo-item-archetype">GitHub</div>
                        </div>
                    </button>
                ))}
            </div>

            <button
                type="button"
                className={`repo-selector-close ${repoCityMode ? 'repo-city' : ''}`.trim()}
                onClick={onClose}
            >
                Close Picker
            </button>
        </div>
    );
}
