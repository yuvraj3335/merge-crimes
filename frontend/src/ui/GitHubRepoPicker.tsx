import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';
import { RepoPrivacyNotice } from './RepoPrivacyNotice';

interface GitHubRepoPickerProps {
    open: boolean;
    onClose: () => void;
}

type PickerStatus = 'idle' | 'loading' | 'ready' | 'error';
type PickerTone = 'idle' | 'loading' | 'success' | 'error' | 'empty';

interface TokenScopedError {
    token: string;
    message: string;
}

interface PickerStatusCopy {
    tone: PickerTone;
    pill: string;
    title: string;
    message: string;
    detail: string;
    actionLabel?: string;
    showSpinner?: boolean;
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

    let displayStatus: PickerStatus | 'empty' = 'idle';
    if (githubAccessToken) {
        if (loadedToken !== githubAccessToken) {
            displayStatus = 'loading';
        } else if (activeErrorMessage) {
            displayStatus = 'error';
        } else if (repos.length === 0) {
            displayStatus = 'empty';
        } else {
            displayStatus = 'ready';
        }
    }

    const visibleRepos = displayStatus === 'ready' ? repos : [];
    const repoCountCopy = `${visibleRepos.length} readable ${visibleRepos.length === 1 ? 'repository' : 'repositories'} loaded`;

    const pickerHint = githubAccessToken
        ? 'Load the repositories this GitHub login can read. Repo City only uses read-only metadata at this step.'
        : 'GitHub is not connected in this browser state yet.';
    let pickerStatusCopy: PickerStatusCopy;
    if (!githubAccessToken) {
        pickerStatusCopy = {
            tone: 'idle',
            pill: 'Signed out',
            title: 'GitHub not connected',
            message: 'Log in with GitHub to load repositories here.',
            detail: 'This step only reads repo metadata that the current GitHub login is already allowed to access.',
        };
    } else if (displayStatus === 'loading') {
        pickerStatusCopy = {
            tone: 'loading',
            pill: 'Loading repos',
            title: 'Loading repositories...',
            message: 'Checking GitHub for the readable repositories tied to this login.',
            detail: 'Your current repo-city selection stays unchanged while this read-only request is in progress.',
            showSpinner: true,
        };
    } else if (displayStatus === 'error') {
        pickerStatusCopy = {
            tone: 'error',
            pill: 'Load failed',
            title: 'Repository list unavailable',
            message: activeErrorMessage ?? 'GitHub did not return the repository list.',
            detail: 'Nothing changed in your current repo-city session. Retrying only asks GitHub for the readable repo list again.',
            actionLabel: 'Retry load',
        };
    } else if (displayStatus === 'empty') {
        pickerStatusCopy = {
            tone: 'empty',
            pill: 'No repos',
            title: 'No repositories found',
            message: 'GitHub returned no readable repositories for this login.',
            detail: 'Check your GitHub permissions or try refreshing the list. Repo City only shows repos this token can read.',
            actionLabel: 'Refresh list',
        };
    } else {
        pickerStatusCopy = {
            tone: 'success',
            pill: 'Repos ready',
            title: 'Choose a repository',
            message: hasNextPage
                ? `${repoCountCopy} from GitHub's first page of results.`
                : `${repoCountCopy} and ready to connect.`,
            detail: 'Selecting a public repository refreshes the current repo-city snapshot without leaving this shell.',
        };
    }

    function handleReloadRepoList() {
        if (!githubAccessToken || displayStatus === 'loading') {
            return;
        }

        loadControllerRef.current?.abort();
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
                <div className="repo-connection-feedback-layout">
                    <div className={`repo-connection-feedback-icon ${pickerStatusCopy.tone}`.trim()} aria-hidden="true">
                        {pickerStatusCopy.showSpinner ? (
                            <span className="repo-status-spinner" />
                        ) : (
                            <span className="repo-status-dot" />
                        )}
                    </div>
                    <div className="repo-connection-feedback-body">
                        <div className="repo-connection-feedback-header">
                            <span className={`repo-connection-feedback-pill ${pickerStatusCopy.tone}`.trim()}>
                                {pickerStatusCopy.pill}
                            </span>
                            <span className="repo-connection-feedback-title">{pickerStatusCopy.title}</span>
                        </div>
                        <div className="repo-connection-feedback-copy">{pickerStatusCopy.message}</div>
                        <div className="repo-connection-feedback-detail">{pickerStatusCopy.detail}</div>
                    </div>
                </div>
                {pickerStatusCopy.actionLabel && (
                    <button
                        type="button"
                        className="repo-connection-feedback-action"
                        onClick={handleReloadRepoList}
                    >
                        {pickerStatusCopy.actionLabel}
                    </button>
                )}
            </div>

            {displayStatus === 'ready' ? (
                <>
                    <div className="repo-selector-list-meta">
                        <span>{repoCountCopy}</span>
                        <span>Read-only metadata only</span>
                        {hasNextPage && <span>Showing GitHub's first page of results</span>}
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
                </>
            ) : (
                <div className={`repo-selector-state ${displayStatus}`.trim()}>
                    <div className={`repo-selector-state-icon ${displayStatus}`.trim()} aria-hidden="true">
                        {pickerStatusCopy.showSpinner ? (
                            <span className="repo-status-spinner large" />
                        ) : (
                            <span className="repo-status-dot large" />
                        )}
                    </div>
                    <div className="repo-selector-state-title">{pickerStatusCopy.title}</div>
                    <div className="repo-selector-state-copy">{pickerStatusCopy.detail}</div>
                </div>
            )}

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
