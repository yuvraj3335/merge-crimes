import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';
import { RepoPrivacyNotice } from './RepoPrivacyNotice';

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
    const loadControllerRef = useRef<AbortController | null>(null);
    const ingestControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        if (!githubAccessToken) {
            loadControllerRef.current?.abort();
            return;
        }

        if (loadedToken === githubAccessToken) {
            return;
        }

        const controller = new AbortController();
        loadControllerRef.current?.abort();
        loadControllerRef.current = controller;

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
                setLoadedToken(githubAccessToken);
            })
            .finally(() => {
                if (loadControllerRef.current === controller) {
                    loadControllerRef.current = null;
                }
            });

        return () => {
            if (loadControllerRef.current === controller) {
                loadControllerRef.current = null;
            }

            controller.abort();
        };
    }, [githubAccessToken, loadedToken, open]);

    useEffect(() => () => {
        loadControllerRef.current?.abort();
        ingestControllerRef.current?.abort();
    }, []);

    if (!open) {
        return null;
    }

    const activeErrorMessage = errorState?.token === githubAccessToken ? errorState.message : null;
    const displayStatus: PickerStatus = !githubAccessToken
        ? 'idle'
        : loadedToken !== githubAccessToken
            ? 'loading'
            : activeErrorMessage
                ? 'error'
                : 'ready';
    const visibleRepos = displayStatus === 'ready' ? repos : [];

    const pickerHint = githubAccessToken
        ? 'Load the readable repos this GitHub login can access. Picking one keeps you in the repo-city shell.'
        : 'GitHub is not connected in this browser state yet.';
    const pickerStatusCopy = !githubAccessToken
        ? {
              tone: 'idle',
              pill: 'Signed out',
              title: 'GitHub not connected',
              message: 'Log in with GitHub to load readable repos here.',
          }
        : displayStatus === 'loading'
            ? {
                  tone: 'loading',
                  pill: 'Loading',
                  title: 'Loading GitHub repos',
                  message: 'Fetching the readable repo list for this login. No page reload is needed.',
              }
            : displayStatus === 'error'
                ? {
                      tone: 'error',
                      pill: 'Load failed',
                      title: 'Could not load GitHub repos',
                      message: activeErrorMessage
                          ? `${activeErrorMessage} Your current repo selection stays unchanged.`
                          : 'GitHub did not return the repo list. Your current repo selection stays unchanged.',
                  }
                : visibleRepos.length === 0
                    ? {
                          tone: 'idle',
                          pill: 'No repos',
                          title: 'No readable repos returned',
                          message: 'This GitHub login is connected, but GitHub did not return any readable repos yet.',
                      }
                    : {
                          tone: 'success',
                          pill: 'Repos ready',
                          title: 'Choose a repo to connect',
                          message: hasNextPage
                              ? `${visibleRepos.length} readable repos loaded from the first GitHub page.`
                              : `${visibleRepos.length} readable repos loaded and ready to pick.`,
                      };

    function handleRetryRepoLoad() {
        if (!githubAccessToken || displayStatus === 'loading') {
            return;
        }

        setErrorState(null);
        setLoadedToken(null);
    }

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
            {repoCityMode && <RepoPrivacyNotice context="picker" />}
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

            <div
                className={`repo-selector-meta repo-connection-feedback ${pickerStatusCopy.tone === 'idle' ? '' : pickerStatusCopy.tone}`.trim()}
                aria-live="polite"
                aria-busy={displayStatus === 'loading'}
            >
                <div className="repo-connection-feedback-header">
                    <span className={`repo-connection-feedback-pill ${pickerStatusCopy.tone}`.trim()}>
                        {pickerStatusCopy.pill}
                    </span>
                    <span className="repo-connection-feedback-title">{pickerStatusCopy.title}</span>
                </div>
                <div className="repo-connection-feedback-copy">{pickerStatusCopy.message}</div>
                {displayStatus === 'error' && (
                    <button
                        type="button"
                        className="repo-connection-feedback-action"
                        onClick={handleRetryRepoLoad}
                    >
                        Try Again
                    </button>
                )}
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
