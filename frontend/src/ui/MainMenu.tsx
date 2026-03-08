import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { REPO_FIXTURES } from '../../../shared/seed/repoFixtures';
import type { RepoModel } from '../../../shared/repoModel';
import * as api from '../api';
import { GitHubRepoPicker } from './GitHubRepoPicker';
import { RepoPrivacyNotice } from './RepoPrivacyNotice';
import { buildSnapshotFreshnessCopy } from './snapshotFreshness';

type RepoRefreshTone = 'idle' | 'loading' | 'success' | 'error';

interface RepoRefreshStatus {
    tone: RepoRefreshTone;
    message: string | null;
    repoId: string | null;
}

export function MainMenu() {
    const phase = useGameStore((s) => s.phase);
    const setPhase = useGameStore((s) => s.setPhase);
    const loadRepoCity = useGameStore((s) => s.loadRepoCity);
    const clearRepoCity = useGameStore((s) => s.clearRepoCity);
    const repoCityMode = useGameStore((s) => s.repoCityMode);
    const connectedRepo = useGameStore((s) => s.connectedRepo);
    const generatedCity = useGameStore((s) => s.generatedCity);
    const githubAccessToken = useGameStore((s) => s.githubAccessToken);
    const githubAuthStatus = useGameStore((s) => s.githubAuthStatus);
    const githubAuthMessage = useGameStore((s) => s.githubAuthMessage);
    const selectedGitHubRepo = useGameStore((s) => s.selectedGitHubRepo);
    const setSelectedGitHubRepoSnapshot = useGameStore((s) => s.setSelectedGitHubRepoSnapshot);
    const showGitHubRepoPicker = useGameStore((s) => s.showGitHubRepoPicker);
    const setShowGitHubRepoPicker = useGameStore((s) => s.setShowGitHubRepoPicker);

    const [showRepoSelector, setShowRepoSelector] = useState(false);
    const [isRefreshingRepo, setIsRefreshingRepo] = useState(false);
    const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
    const [repoRefreshStatus, setRepoRefreshStatus] = useState<RepoRefreshStatus>({
        tone: 'idle',
        message: null,
        repoId: null,
    });
    const refreshControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => {
        refreshControllerRef.current?.abort();
    }, []);

    useEffect(() => {
        if (phase !== 'menu' || !repoCityMode || !connectedRepo) {
            return;
        }

        const intervalId = window.setInterval(() => {
            setFreshnessNow(Date.now());
        }, 30_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [connectedRepo, phase, repoCityMode]);

    if (phase !== 'menu') return null;

    function handleSelectRepo(repo: RepoModel) {
        loadRepoCity(repo);
        setShowRepoSelector(false);
    }

    function handleClassicMode() {
        if (repoCityMode) {
            clearRepoCity();
        }
        setPhase('playing');
    }

    function handleRefreshRepo() {
        if (
            !connectedRepo
            || connectedRepo.metadata?.provider !== 'github'
            || isRefreshingRepo
            || (connectedRepo.visibility === 'private' && !githubAccessToken)
        ) {
            return;
        }

        const controller = new AbortController();
        const targetRepoId = connectedRepo.repoId;

        refreshControllerRef.current?.abort();
        refreshControllerRef.current = controller;
        setIsRefreshingRepo(true);
        setRepoRefreshStatus({
            tone: 'loading',
            message: 'Refreshing read-only GitHub metadata. Your current city stays active until the new snapshot is ready.',
            repoId: targetRepoId,
        });

        void api.refreshGitHubRepo(
            connectedRepo.owner,
            connectedRepo.name,
            controller.signal,
            githubAccessToken ?? undefined,
        )
            .then((response) => {
                if (controller.signal.aborted) {
                    return;
                }

                const currentConnectedRepo = useGameStore.getState().connectedRepo;
                if (currentConnectedRepo?.repoId !== targetRepoId) {
                    return;
                }

                setSelectedGitHubRepoSnapshot(response.snapshot);
                setRepoRefreshStatus({
                    tone: 'success',
                    message: 'A newer read-only GitHub snapshot is now active in this session.',
                    repoId: targetRepoId,
                });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                setRepoRefreshStatus({
                    tone: 'error',
                    message: error instanceof Error
                        ? `${error.message} The current repo-city snapshot is unchanged.`
                        : 'Repo refresh failed. The current repo-city snapshot is unchanged.',
                    repoId: targetRepoId,
                });

                console.warn(
                    '[MergeCrimes] GitHub repo refresh failed',
                    error instanceof Error ? error.message : error,
                );
            })
            .finally(() => {
                if (refreshControllerRef.current === controller) {
                    refreshControllerRef.current = null;
                }

                if (!controller.signal.aborted) {
                    setIsRefreshingRepo(false);
                }
            });
    }

    const selectorHint = repoCityMode
        ? 'Choose a repo snapshot to translate into districts, routes, and threat signals.'
        : 'The repo inspires the city — districts, missions, and threats are generated from its structure.';
    const snapshotFreshness = connectedRepo
        ? buildSnapshotFreshnessCopy(
            connectedRepo.generatedAt,
            connectedRepo.metadata?.provider === 'github' ? 'github' : 'seeded',
            freshnessNow,
        )
        : null;
    const startMeta = generatedCity
        ? `${generatedCity.districts.length} districts · ${generatedCity.missions.length} routes ready`
        : 'Repo city translation ready';
    const footerNote = generatedCity
        ? `${generatedCity.repoName} snapshot · ${generatedCity.districts.length} districts ready`
        : 'Metadata-first seeded translation';
    const githubAuthCard = githubAccessToken
        ? {
              title: selectedGitHubRepo ? 'GitHub repo selected' : 'Logged in as GitHub user',
              meta: selectedGitHubRepo
                  ? `${selectedGitHubRepo.fullName} · ${selectedGitHubRepo.visibility}`
                  : 'GitHub login is active in this browser session.',
          }
        : githubAuthStatus === 'exchanging'
            ? {
                  title: 'Completing GitHub login',
                  meta: 'Finishing the sign-in so the readable repo list can load.',
              }
            : null;
    const repoCitySummaryMetrics = generatedCity
        ? [
              { label: 'Districts', value: generatedCity.districts.length },
              { label: 'Roads', value: generatedCity.roads.length },
              { label: 'Missions', value: generatedCity.missions.length },
              { label: 'Threats', value: generatedCity.bots.length }
          ]
        : [];
    const canRefreshConnectedRepo = repoCityMode
        && connectedRepo?.metadata?.provider === 'github'
        && (connectedRepo.visibility === 'public' || Boolean(githubAccessToken));
    const activeRefreshTone = repoRefreshStatus.repoId === connectedRepo?.repoId ? repoRefreshStatus.tone : 'idle';
    const activeRefreshMessage = repoRefreshStatus.repoId === connectedRepo?.repoId ? repoRefreshStatus.message : null;
    const refreshStatusCopy = activeRefreshTone === 'loading'
        ? {
              pill: 'Refresh in progress',
              title: 'Refreshing GitHub metadata',
              message: activeRefreshMessage ?? 'Pulling a fresh read-only snapshot without leaving this menu.',
          }
        : activeRefreshTone === 'success'
            ? {
                  pill: 'Snapshot updated',
                  title: 'Connected repo refreshed',
                  message: activeRefreshMessage ?? 'A fresh GitHub snapshot is ready in the current session.',
              }
            : activeRefreshTone === 'error'
                ? {
                      pill: 'Refresh failed',
                      title: 'Could not refresh this repo',
                      message: activeRefreshMessage
                          ?? 'GitHub did not return a fresh snapshot. Try the refresh action again.',
                  }
                : {
                      pill: 'Manual refresh',
                      title: 'Refresh the connected snapshot',
                      message: 'Pull the latest read-only repo metadata here without changing the current repo.',
                  };

    return (
        <div className={`main-menu ${repoCityMode ? 'repo-city' : ''}`.trim()}>
            {repoCityMode && <RepoPrivacyNotice context="menu" />}
            {repoCityMode ? (
                <div className="repo-city-menu-hero">
                    <div className="repo-city-menu-kicker">Repo city translation</div>
                    <div className="repo-city-menu-header">
                        <div className="repo-city-menu-heading">
                            <div className="menu-title repo-city">MERGE CRIMES</div>
                            <div className="menu-subtitle repo-city">
                                Translate the connected repo into a readable city map, then clear routes and threat
                                pressure district by district.
                            </div>
                        </div>
                        {connectedRepo && (
                            <div className="repo-city-menu-repo">
                                <div className="repo-city-menu-repo-label">Connected repo</div>
                                <div className="repo-city-menu-repo-name">
                                    {connectedRepo.owner}/{connectedRepo.name}
                                </div>
                                <div className="repo-city-menu-repo-meta">
                                    {connectedRepo.defaultBranch} · {connectedRepo.visibility}
                                </div>
                                {snapshotFreshness && (
                                    <div className={`repo-city-menu-freshness ${snapshotFreshness.source}`.trim()}>
                                        <span
                                            className={`repo-city-menu-freshness-pill ${snapshotFreshness.source}`.trim()}
                                        >
                                            {snapshotFreshness.sourceLabel}
                                        </span>
                                        <div className="repo-city-menu-freshness-copy">
                                            <span className="repo-city-menu-freshness-primary">
                                                {snapshotFreshness.primary}
                                            </span>
                                            {snapshotFreshness.detail && (
                                                <time
                                                    className="repo-city-menu-freshness-detail"
                                                    dateTime={connectedRepo.generatedAt}
                                                >
                                                    {snapshotFreshness.detail}
                                                </time>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {canRefreshConnectedRepo && (
                                    <div className="repo-city-menu-repo-actions">
                                        <button
                                            type="button"
                                            className={`repo-city-refresh-btn ${isRefreshingRepo ? 'loading' : ''}`.trim()}
                                            data-testid="refresh-repo"
                                            onClick={handleRefreshRepo}
                                            disabled={isRefreshingRepo}
                                        >
                                            <span
                                                className={`repo-refresh-indicator ${isRefreshingRepo ? 'spinning' : ''}`.trim()}
                                                aria-hidden="true"
                                            />
                                            <span>{isRefreshingRepo ? 'Refreshing Repo' : 'Refresh Repo'}</span>
                                        </button>
                                        <div
                                            className={`repo-connection-feedback ${activeRefreshTone === 'idle' ? '' : activeRefreshTone}`.trim()}
                                            aria-live="polite"
                                            aria-busy={isRefreshingRepo}
                                        >
                                            <div className="repo-connection-feedback-header">
                                                <span
                                                    className={`repo-connection-feedback-pill ${activeRefreshTone}`.trim()}
                                                >
                                                    {refreshStatusCopy.pill}
                                                </span>
                                                <span className="repo-connection-feedback-title">
                                                    {refreshStatusCopy.title}
                                                </span>
                                            </div>
                                            <div className="repo-connection-feedback-copy">
                                                {refreshStatusCopy.message}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {generatedCity && (
                        <div className="repo-city-summary repo-city">
                            <div className="repo-city-summary-header">
                                <div className="repo-city-summary-copy">
                                    <div className={`repo-city-badge ${snapshotFreshness?.source ?? ''}`.trim()}>
                                        {snapshotFreshness?.badge ?? 'City snapshot ready'}
                                    </div>
                                    <div className="repo-city-summary-title">
                                        {generatedCity.repoOwner}/{generatedCity.repoName}
                                    </div>
                                    <div className="repo-city-summary-description">
                                        {generatedCity.archetype} repo translated into districts, roads, mission routes,
                                        and bot pressure.
                                    </div>
                                </div>
                                <div className="repo-city-archetype">{generatedCity.archetype}</div>
                            </div>
                            <div className="repo-city-summary-grid">
                                {repoCitySummaryMetrics.map((metric) => (
                                    <div key={metric.label} className="repo-city-summary-metric">
                                        <span className="repo-city-summary-metric-label">{metric.label}</span>
                                        <span className="repo-city-summary-metric-value">{metric.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="menu-title">MERGE CRIMES</div>
                    <div className="menu-subtitle">Human vs AI — Defend Your Repo</div>
                </>
            )}

            <button
                type="button"
                className={`menu-start-btn ${repoCityMode ? 'repo-city' : ''}`.trim()}
                data-testid="enter-city"
                onClick={() => setPhase('playing')}
            >
                {repoCityMode ? (
                    <>
                        <span className="menu-start-kicker">Launch translation</span>
                        <span className="menu-start-title">Enter Repo City</span>
                        <span className="menu-start-meta">{startMeta}</span>
                    </>
                ) : (
                    'Enter the City'
                )}
            </button>

            <div className={`menu-secondary-actions ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                {githubAuthCard ? (
                    <div
                        className={`menu-repo-btn menu-auth-status ${repoCityMode ? 'repo-city' : ''}`.trim()}
                        aria-live="polite"
                    >
                        <span className="menu-action-label">{githubAuthCard.title}</span>
                        <span className="menu-action-meta">{githubAuthCard.meta}</span>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={`menu-repo-btn ${repoCityMode ? 'repo-city' : ''}`.trim()}
                        onClick={() => api.startGitHubOAuthLogin()}
                    >
                        {repoCityMode ? (
                            <>
                                <span className="menu-action-label">
                                    {githubAuthStatus === 'error' ? 'Retry GitHub Login' : 'Connect GitHub'}
                                </span>
                                <span className="menu-action-meta">
                                    {githubAuthStatus === 'error'
                                        ? (githubAuthMessage ?? 'GitHub login failed. Try again.')
                                        : 'Read-only repo metadata only. No code write access.'}
                                </span>
                            </>
                        ) : (
                            'Login with GitHub'
                        )}
                    </button>
                )}
                {githubAccessToken && (
                    <button
                        type="button"
                        className={`menu-repo-btn ${repoCityMode ? 'repo-city' : ''}`.trim()}
                        onClick={() => {
                            setShowRepoSelector(false);
                            setShowGitHubRepoPicker(true);
                        }}
                    >
                        {repoCityMode ? (
                            <>
                                <span className="menu-action-label">
                                    {selectedGitHubRepo ? 'Change GitHub Repo' : 'Pick GitHub Repo'}
                                </span>
                                <span className="menu-action-meta">
                                    {selectedGitHubRepo
                                        ? `${selectedGitHubRepo.fullName} is selected for repo-city translation.`
                                        : 'Load the readable repo list without leaving this menu.'}
                                </span>
                            </>
                        ) : (
                            selectedGitHubRepo ? 'Change GitHub Repo' : 'Pick GitHub Repo'
                        )}
                    </button>
                )}
                <button
                    type="button"
                    className={`menu-repo-btn ${repoCityMode ? 'repo-city' : ''}`.trim()}
                    onClick={() => {
                        setShowGitHubRepoPicker(false);
                        setShowRepoSelector(!showRepoSelector);
                    }}
                >
                    {repoCityMode ? (
                        <>
                            <span className="menu-action-label">
                                {githubAccessToken ? 'Use Seed Repo' : 'Change Repo'}
                            </span>
                            <span className="menu-action-meta">
                                {githubAccessToken ? 'Open the seeded repo snapshots.' : 'Swap the city source'}
                            </span>
                        </>
                    ) : (
                        githubAccessToken ? 'Use Seed Repo' : 'Connect a Repo'
                    )}
                </button>
                {repoCityMode && (
                    <button
                        type="button"
                        className="menu-classic-btn repo-city"
                        onClick={handleClassicMode}
                    >
                        <span className="menu-action-label">Classic Mode</span>
                        <span className="menu-action-meta">Return to the legacy city</span>
                    </button>
                )}
            </div>

            {/* Repo Selector Panel */}
            {showRepoSelector && (
                <div className={`repo-selector-panel ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                    <div className={`repo-selector-header ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                        <div className="repo-selector-heading">
                            {repoCityMode && (
                                <div className="repo-selector-kicker">Repo city fixtures</div>
                            )}
                            <div className="repo-selector-title">Select a Repository</div>
                            <div className="repo-selector-hint">{selectorHint}</div>
                        </div>
                        {repoCityMode && (
                            <button
                                type="button"
                                className="repo-selector-close-icon"
                                aria-label="Close repository selector"
                                onClick={() => setShowRepoSelector(false)}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {repoCityMode && (
                        <div className="repo-selector-meta">
                            {REPO_FIXTURES.length} seeded repos ready for translation
                        </div>
                    )}
                    <div className="repo-selector-list">
                        {REPO_FIXTURES.map((repo) => (
                            <button
                                key={repo.repoId}
                                type="button"
                                className={`repo-selector-item ${connectedRepo?.repoId === repo.repoId ? 'selected' : ''} ${repoCityMode ? 'repo-city' : ''}`.trim()}
                                onClick={() => handleSelectRepo(repo)}
                            >
                                {repoCityMode ? (
                                    <>
                                        <div className="repo-item-topline">
                                            <div>
                                                <div className="repo-item-name">
                                                    {repo.owner}/{repo.name}
                                                </div>
                                                <div className="repo-item-branch">
                                                    {repo.defaultBranch} · {repo.visibility}
                                                </div>
                                            </div>
                                            <div className="repo-item-archetype">
                                                {repo.archetype}
                                            </div>
                                        </div>
                                        <div className="repo-item-langs">
                                            {repo.languages.slice(0, 3).map((language) => language.name).join(', ')}
                                        </div>
                                        <div className="repo-item-stats">
                                            <span className="repo-item-pill">{repo.modules.length} modules</span>
                                            <span className="repo-item-pill">{repo.signals.length} signals</span>
                                            <span className="repo-item-pill">{repo.dependencyEdges.length} links</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="repo-item-name">
                                            {repo.owner}/{repo.name}
                                        </div>
                                        <div className="repo-item-meta">
                                            {repo.archetype} · {repo.modules.length} modules · {repo.signals.length} signals
                                        </div>
                                        <div className="repo-item-langs">
                                            {repo.languages.slice(0, 3).map((language) => language.name).join(', ')}
                                        </div>
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={`repo-selector-close ${repoCityMode ? 'repo-city' : ''}`.trim()}
                        onClick={() => setShowRepoSelector(false)}
                    >
                        {repoCityMode ? 'Close Selector' : 'Cancel'}
                    </button>
                </div>
            )}

            <GitHubRepoPicker
                open={showGitHubRepoPicker}
                onClose={() => setShowGitHubRepoPicker(false)}
            />

            {repoCityMode ? (
                <div className="menu-version repo-city">
                    <span className="menu-version-pill">Repo City MVP</span>
                    <span className="menu-version-copy">{footerNote}</span>
                    <span className="menu-version-phase">Phase 3 shell</span>
                </div>
            ) : (
                <div className="menu-version">v0.2.0 — Repo City MVP — Phase 3</div>
            )}
        </div>
    );
}
