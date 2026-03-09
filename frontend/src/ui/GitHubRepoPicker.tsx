import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';
import {
    getGitHubRepoTranslationEligibility,
    isGitHubRepoTranslationEligible,
} from '../repoTranslationEligibility';
import { GitHubTrustNotice } from './GitHubTrustNotice';
import { buildSelectedRepoStatusCopy } from './selectedRepoStatusCopy';

interface GitHubRepoPickerProps {
    open: boolean;
    onClose: () => void;
}

type PickerStatus = 'idle' | 'loading' | 'ready' | 'error';
type PickerTone = 'idle' | 'loading' | 'success' | 'error' | 'empty';
type SelectedRepoRowTone = 'active' | 'waiting' | 'failed' | 'listed-only';

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
    const connectedRepo = useGameStore((s) => s.connectedRepo);
    const selectedGitHubRepo = useGameStore((s) => s.selectedGitHubRepo);
    const setSelectedGitHubRepo = useGameStore((s) => s.setSelectedGitHubRepo);
    const selectedGitHubRepoEligibility = useGameStore((s) => s.selectedGitHubRepoEligibility);
    const selectedGitHubRepoIngestState = useGameStore((s) => s.selectedGitHubRepoIngestState);
    const setSelectedGitHubRepoIngestState = useGameStore((s) => s.setSelectedGitHubRepoIngestState);
    const setSelectedGitHubRepoSnapshot = useGameStore((s) => s.setSelectedGitHubRepoSnapshot);

    const [repos, setRepos] = useState<api.GitHubReadableRepo[]>([]);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [nextPage, setNextPage] = useState<number | null>(null);
    const [loadedToken, setLoadedToken] = useState<string | null>(null);
    const [errorState, setErrorState] = useState<TokenScopedError | null>(null);
    const [loadMoreMessage, setLoadMoreMessage] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadControllerRef = useRef<AbortController | null>(null);
    const ingestControllerRef = useRef<AbortController | null>(null);

    function mergeReadableRepos(
        currentRepos: api.GitHubReadableRepo[],
        nextRepos: api.GitHubReadableRepo[],
    ): api.GitHubReadableRepo[] {
        const seen = new Set<number>();
        return [...currentRepos, ...nextRepos].filter((repo) => {
            if (seen.has(repo.id)) {
                return false;
            }

            seen.add(repo.id);
            return true;
        });
    }

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
                setNextPage(response.nextPage);
                setErrorState(null);
                setLoadMoreMessage(null);
                setLoadedToken(githubAccessToken);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                setRepos([]);
                setHasNextPage(false);
                setNextPage(null);
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
        } else if (activeErrorMessage && repos.length === 0) {
            displayStatus = 'error';
        } else if (repos.length === 0) {
            displayStatus = 'empty';
        } else {
            displayStatus = 'ready';
        }
    }

    const visibleRepos = displayStatus === 'ready' ? repos : [];
    const translationEligibleRepos = visibleRepos.filter((repo) => isGitHubRepoTranslationEligible(repo.visibility));
    const listedOnlyCount = visibleRepos.length - translationEligibleRepos.length;
    const repoCountCopy = `${visibleRepos.length} listed ${visibleRepos.length === 1 ? 'repository' : 'repositories'}`;
    const selectedGitHubRepoIsActive = Boolean(
        selectedGitHubRepo
        && connectedRepo?.metadata?.provider === 'github'
        && connectedRepo.metadata.providerRepoId === selectedGitHubRepo.id,
    );
    const selectedRepoStatusCopy = buildSelectedRepoStatusCopy(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        connectedRepo,
        selectedGitHubRepoIngestState,
    );
    const pickerSelectedRepoStatusCopy = selectedRepoStatusCopy?.tone === 'loading' || selectedRepoStatusCopy?.tone === 'error'
        ? selectedRepoStatusCopy
        : null;

    const pickerHint = githubAccessToken
        ? 'You only see repos this GitHub connection can already list. Only public repos are translation-eligible in the default OAuth flow; any private repos remain reference-only if broader access is configured.'
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
                ? `${repoCountCopy} loaded so far from GitHub.`
                : `${repoCountCopy} loaded from GitHub.`,
            detail: 'Listed means this GitHub login can read the repo. Translate now means Merge Crimes can turn that repo into a city in the default public-metadata flow.',
        };
    }

    function handleReloadRepoList() {
        if (!githubAccessToken || displayStatus === 'loading') {
            return;
        }

        loadControllerRef.current?.abort();
        setErrorState(null);
        setLoadMoreMessage(null);
        setNextPage(null);
        setHasNextPage(false);
        setRepos([]);
        setLoadedToken(null);
    }

    function handleLoadNextPage() {
        if (!githubAccessToken || !nextPage || isLoadingMore) {
            return;
        }

        const controller = new AbortController();
        loadControllerRef.current?.abort();
        loadControllerRef.current = controller;
        setIsLoadingMore(true);
        setLoadMoreMessage(null);

        void api.fetchGitHubReadableRepos(githubAccessToken, controller.signal, nextPage)
            .then((response) => {
                if (controller.signal.aborted) {
                    return;
                }

                setRepos((currentRepos) => mergeReadableRepos(currentRepos, response.repos));
                setHasNextPage(response.hasNextPage);
                setNextPage(response.nextPage);
                setErrorState(null);
                setLoadMoreMessage(null);
                setLoadedToken(githubAccessToken);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                setLoadMoreMessage(error instanceof Error ? error.message : 'GitHub repo fetch failed.');
            })
            .finally(() => {
                if (loadControllerRef.current === controller) {
                    loadControllerRef.current = null;
                }

                if (!controller.signal.aborted) {
                    setIsLoadingMore(false);
                }
            });
    }

    function handleRepoSelection(repo: api.GitHubReadableRepo) {
        const isNewSelection = selectedGitHubRepo?.id !== repo.id;
        const isRetryAfterError = !isNewSelection
            && isGitHubRepoTranslationEligible(repo.visibility)
            && selectedGitHubRepoIngestState.tone === 'error'
            && selectedGitHubRepoIngestState.repoId === repo.id;
        const shouldTriggerIngest = isGitHubRepoTranslationEligible(repo.visibility)
            && (isNewSelection || isRetryAfterError);

        setSelectedGitHubRepo(repo);

        if (!isNewSelection && !isRetryAfterError) {
            return;
        }

        ingestControllerRef.current?.abort();
        setSelectedGitHubRepoSnapshot(null);
        setSelectedGitHubRepoIngestState({
            tone: 'idle',
            repoId: null,
            message: null,
        });

        if (!shouldTriggerIngest) {
            return;
        }

        const controller = new AbortController();
        ingestControllerRef.current = controller;
        setSelectedGitHubRepoIngestState({
            tone: 'loading',
            repoId: repo.id,
            message: 'Ingesting repository data... Please wait before entering the city.',
        });

        void api.fetchGitHubRepoMetadata(
            repo.ownerLogin,
            repo.name,
            controller.signal,
            githubAccessToken ?? undefined,
        )
            .then((snapshot) => {
                if (controller.signal.aborted) {
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

                const currentSelection = useGameStore.getState().selectedGitHubRepo;
                if (currentSelection?.id !== repo.id) {
                    return;
                }

                setSelectedGitHubRepoIngestState({
                    tone: 'error',
                    repoId: repo.id,
                    message: error instanceof Error
                        ? `${error.message} The current city is still active.`
                        : 'Repo ingest failed. The current city is still active.',
                });

                console.warn(
                    '[MergeCrimes] GitHub repo metadata ingest failed',
                    error instanceof Error ? error.message : error,
                );
            })
            .finally(() => {
                if (ingestControllerRef.current === controller) {
                    ingestControllerRef.current = null;
                }
            });
    }

    function getSelectedRepoRowTone(
        repo: api.GitHubReadableRepo,
        repoEligible: boolean,
        isSelected: boolean,
    ): SelectedRepoRowTone | null {
        if (!isSelected) {
            return null;
        }

        const repoIsActive = Boolean(
            connectedRepo?.metadata?.provider === 'github'
            && connectedRepo.metadata.providerRepoId === repo.id,
        );

        if (repoEligible && !repoIsActive) {
            if (selectedGitHubRepoIngestState.tone === 'loading' && selectedGitHubRepoIngestState.repoId === repo.id) {
                return 'waiting';
            }

            if (selectedGitHubRepoIngestState.tone === 'error' && selectedGitHubRepoIngestState.repoId === repo.id) {
                return 'failed';
            }
        }

        return repoEligible ? 'active' : 'listed-only';
    }

    return (
        <div className={`repo-selector-panel ${repoCityMode ? 'repo-city' : ''}`.trim()} data-testid="github-repo-picker">
            {repoCityMode && <GitHubTrustNotice context="picker" />}
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

            {pickerSelectedRepoStatusCopy && (
                <div
                    className={`repo-connection-feedback ${pickerSelectedRepoStatusCopy.tone}`.trim()}
                    aria-live="polite"
                    aria-busy={pickerSelectedRepoStatusCopy.tone === 'loading'}
                >
                    <div className="repo-connection-feedback-layout">
                        <div
                            className={`repo-connection-feedback-icon ${pickerSelectedRepoStatusCopy.tone}`.trim()}
                            aria-hidden="true"
                        >
                            {pickerSelectedRepoStatusCopy.showSpinner ? (
                                <span className="repo-status-spinner" />
                            ) : (
                                <span className="repo-status-dot" />
                            )}
                        </div>
                        <div className="repo-connection-feedback-body">
                            <div className="repo-connection-feedback-header">
                                <span className={`repo-connection-feedback-pill ${pickerSelectedRepoStatusCopy.tone}`.trim()}>
                                    {pickerSelectedRepoStatusCopy.pill}
                                </span>
                                <span className="repo-connection-feedback-title">
                                    {pickerSelectedRepoStatusCopy.title}
                                </span>
                            </div>
                            <div className="repo-connection-feedback-copy">{pickerSelectedRepoStatusCopy.message}</div>
                            <div className="repo-connection-feedback-detail">{pickerSelectedRepoStatusCopy.detail}</div>
                        </div>
                    </div>
                </div>
            )}

            {displayStatus === 'ready' ? (
                <>
                    <div className="repo-selector-eligibility-note" role="note" aria-label="Repository eligibility notice">
                        <div className="repo-selector-eligibility-title">What this list means</div>
                        <div className="repo-selector-eligibility-copy">
                            You only see repositories available through this GitHub connection. Only public repositories
                            are eligible for Repo City translation in the default OAuth flow. If this connection can list
                            private repositories, they stay listed for reference only here.
                        </div>
                    </div>
                    <div className="repo-selector-list-meta">
                        <span>{repoCountCopy}</span>
                        <span>
                            {translationEligibleRepos.length} ready for translation
                        </span>
                        {listedOnlyCount > 0 && <span>{listedOnlyCount} listed for reference</span>}
                        <span>Read-only metadata only</span>
                        {hasNextPage && <span>More GitHub pages available</span>}
                    </div>
                    <div className="repo-selector-list">
                        {visibleRepos.map((repo) => {
                            const eligibilityCopy = getGitHubRepoTranslationEligibility(repo.visibility);
                            const isSelected = selectedGitHubRepo?.id === repo.id;
                            const selectedRowTone = getSelectedRepoRowTone(repo, eligibilityCopy.eligible, isSelected);

                            return (
                                <button
                                    key={repo.id}
                                    type="button"
                                    data-testid={`github-repo-${repo.id}`}
                                    className={
                                        `repo-selector-item ${isSelected ? 'selected' : ''} ${selectedRowTone ? `selected-tone-${selectedRowTone}` : ''} ${repoCityMode ? 'repo-city' : ''}`.trim()
                                    }
                                    onClick={() => handleRepoSelection(repo)}
                                >
                                    <div className="repo-item-topline">
                                        <div>
                                            <div className="repo-item-name">{repo.fullName}</div>
                                            <div className="repo-item-branch">
                                                {repo.defaultBranch} · {repo.visibility}
                                            </div>
                                        </div>
                                        <div className="repo-item-badges">
                                            <div className="repo-item-archetype">GitHub</div>
                                            <div className={`repo-item-translation ${eligibilityCopy.tone}`.trim()}>
                                                {eligibilityCopy.pill}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="repo-item-eligibility-copy">{eligibilityCopy.pickerDetail}</div>
                                </button>
                            );
                        })}
                    </div>
                    {(hasNextPage || loadMoreMessage) && (
                        <div className="repo-selector-list-meta">
                            {hasNextPage && (
                                <button
                                    type="button"
                                    className="repo-connection-feedback-action"
                                    onClick={handleLoadNextPage}
                                    disabled={isLoadingMore}
                                >
                                    {isLoadingMore ? 'Loading more...' : 'Load next page'}
                                </button>
                            )}
                            {loadMoreMessage && <span>{loadMoreMessage}</span>}
                        </div>
                    )}
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
