import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { REPO_FIXTURES } from '../../../shared/seed/repoFixtures';
import type { RepoModel } from '../../../shared/repoModel';
import * as api from '../api';
import { GitHubRepoPicker } from './GitHubRepoPicker';
import { GitHubTrustNotice } from './GitHubTrustNotice';
import { RepoPrivacyNotice } from './RepoPrivacyNotice';
import { buildSnapshotFreshnessCopy } from './snapshotFreshness';
import {
    buildSelectedRepoStatusCopy,
    didSelectedGitHubRepoSnapshotIngestFail,
    isSelectedGitHubRepoSnapshotIngesting,
} from './selectedRepoStatusCopy';

type RepoRefreshTone = 'idle' | 'loading' | 'success' | 'error';

interface RepoRefreshStatus {
    tone: RepoRefreshTone;
    message: string | null;
    repoId: string | null;
}

type GitHubAuthCardTone = 'neutral' | 'active' | 'waiting' | 'failed' | 'listed-only';
type GitHubAuthCardIcon = 'dot' | 'check' | 'spinner' | 'x' | 'list';

interface GitHubAuthCardCopy {
    title: string;
    meta: string;
    tone: GitHubAuthCardTone;
    icon: GitHubAuthCardIcon;
}

function renderGitHubAuthCardGlyph(icon: Exclude<GitHubAuthCardIcon, 'spinner'>) {
    switch (icon) {
        case 'check':
            return (
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                    <path d="M3.5 8.5 6.5 11.5 12.5 5.5" />
                </svg>
            );
        case 'x':
            return (
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                    <path d="M5 5 11 11" />
                    <path d="M11 5 5 11" />
                </svg>
            );
        case 'list':
            return (
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                    <path d="M5 5.25h6.5" />
                    <path d="M5 8h6.5" />
                    <path d="M5 10.75h6.5" />
                    <path d="M3 5.25h.01" />
                    <path d="M3 8h.01" />
                    <path d="M3 10.75h.01" />
                </svg>
            );
        case 'dot':
        default:
            return (
                <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                    <circle cx="8" cy="8" r="2.25" fill="currentColor" stroke="none" />
                </svg>
            );
    }
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
    const selectedGitHubRepoEligibility = useGameStore((s) => s.selectedGitHubRepoEligibility);
    const selectedGitHubRepoIngestState = useGameStore((s) => s.selectedGitHubRepoIngestState);
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
    const selectedGitHubRepoIsActive = Boolean(
        selectedGitHubRepo
        && connectedRepo?.metadata?.provider === 'github'
        && connectedRepo.metadata.providerRepoId === selectedGitHubRepo.id,
    );
    const selectedRepoBlocksTranslation = Boolean(
        selectedGitHubRepo
        && selectedGitHubRepoEligibility
        && !selectedGitHubRepoEligibility.eligible,
    );
    const selectedRepoStillIngesting = isSelectedGitHubRepoSnapshotIngesting(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        selectedGitHubRepoIngestState,
    );
    const selectedRepoIngestFailed = didSelectedGitHubRepoSnapshotIngestFail(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        selectedGitHubRepoIngestState,
    );
    const selectedRepoPendingSnapshot = selectedRepoStillIngesting || selectedRepoIngestFailed;
    const selectedRepoName = selectedGitHubRepo?.fullName ?? 'The selected GitHub repo';
    const startKicker = selectedRepoPendingSnapshot && !connectedRepo
        ? 'Preparing snapshot'
        : selectedRepoBlocksTranslation || selectedRepoPendingSnapshot
            ? 'Current active city'
            : 'Launch translation';
    const startTitle = selectedRepoStillIngesting && !connectedRepo
        ? 'Preparing Repo City...'
        : selectedRepoPendingSnapshot && connectedRepo
            ? 'Enter Current Repo City'
            : 'Enter Repo City';
    const startMeta = selectedRepoStillIngesting
        ? connectedRepo
            ? `${selectedRepoName} is still ingesting. Entering ${connectedRepo.owner}/${connectedRepo.name} until the new snapshot is ready.`
            : `${selectedRepoName} is still ingesting. Wait for the read-only snapshot before entering.`
        : selectedRepoIngestFailed
            ? connectedRepo
                ? `${selectedRepoName} did not finish ingest. Entering ${connectedRepo.owner}/${connectedRepo.name}.`
                : `${selectedRepoName} is not ready yet. Retry the public repo selection before entering.`
            : selectedRepoBlocksTranslation
        ? connectedRepo
            ? `${selectedGitHubRepo?.fullName} is listed only. Entering ${connectedRepo.owner}/${connectedRepo.name}.`
            : `${selectedGitHubRepo?.fullName} is listed only. Pick an eligible public repo to generate a city.`
        : generatedCity
            ? `${generatedCity.districts.length} districts · ${generatedCity.missions.length} routes ready`
            : 'Repo city translation ready';
    const footerNote = generatedCity
        ? `${generatedCity.repoName} snapshot · ${generatedCity.districts.length} districts ready`
        : 'Metadata-first seeded translation';
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
    const selectedRepoStatusCopy = buildSelectedRepoStatusCopy(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        connectedRepo,
        selectedGitHubRepoIngestState,
    );
    const githubRepoActionMeta = selectedGitHubRepo
        ? selectedRepoStillIngesting
            ? connectedRepo
                ? `Waiting for GitHub ingest... ${selectedGitHubRepo.fullName} is still loading, so ${connectedRepo.owner}/${connectedRepo.name} stays active for now.`
                : `Waiting for GitHub ingest... ${selectedGitHubRepo.fullName} is still loading before it can become the active city.`
            : selectedRepoIngestFailed
                ? connectedRepo
                    ? `Snapshot failed—retry or reconnect. ${connectedRepo.owner}/${connectedRepo.name} stays active until ${selectedGitHubRepo.fullName} loads successfully.`
                    : `Snapshot failed—retry or reconnect. ${selectedGitHubRepo.fullName} is not ready to become the active city yet.`
                : selectedGitHubRepoEligibility?.eligible
                    ? selectedGitHubRepoIsActive
                        ? `${selectedGitHubRepo.fullName} is the active translated repo.`
                        : `${selectedGitHubRepo.fullName} is eligible for repo-city translation in this flow.`
                    : `${selectedGitHubRepo.fullName} is listed only. ${selectedGitHubRepoEligibility?.menuDetail ?? "This repo can't be translated here yet."}`
        : 'Load the readable repo list without leaving this menu.';
    const githubAuthCard: GitHubAuthCardCopy | null = githubAccessToken
        ? {
              title: selectedGitHubRepo
                  ? selectedRepoStillIngesting
                      ? 'Waiting for GitHub snapshot'
                      : selectedRepoIngestFailed
                          ? 'GitHub snapshot failed'
                          : selectedGitHubRepoEligibility?.eligible
                              ? selectedGitHubRepoIsActive
                                  ? 'GitHub repo active'
                                  : 'GitHub repo selected'
                              : 'GitHub repo listed only'
                  : 'Logged in as GitHub user',
              meta: selectedGitHubRepo
                  ? githubRepoActionMeta
                  : 'GitHub login is active in this browser session.',
              tone: selectedGitHubRepo
                  ? selectedRepoStillIngesting
                      ? 'waiting'
                      : selectedRepoIngestFailed
                          ? 'failed'
                          : selectedGitHubRepoEligibility?.eligible
                              ? 'active'
                              : 'listed-only'
                  : 'neutral',
              icon: selectedGitHubRepo
                  ? selectedRepoStillIngesting
                      ? 'spinner'
                      : selectedRepoIngestFailed
                          ? 'x'
                          : selectedGitHubRepoEligibility?.eligible
                              ? 'check'
                              : 'list'
                  : 'dot',
          }
        : githubAuthStatus === 'exchanging'
            ? {
                  title: 'Completing GitHub login',
                  meta: 'Finishing the sign-in so the readable repo list can load.',
                  tone: 'waiting',
                  icon: 'spinner',
              }
            : null;

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
                        {selectedRepoStatusCopy && (
                            <div
                                className={`repo-connection-feedback ${selectedRepoStatusCopy.tone}`.trim()}
                                aria-live="polite"
                            >
                                <div className="repo-connection-feedback-layout">
                                    <div
                                        className={`repo-connection-feedback-icon ${selectedRepoStatusCopy.tone}`.trim()}
                                        aria-hidden="true"
                                    >
                                        {selectedRepoStatusCopy.showSpinner ? (
                                            <span className="repo-status-spinner" />
                                        ) : (
                                            <span className="repo-status-dot" />
                                        )}
                                    </div>
                                    <div className="repo-connection-feedback-body">
                                        <div className="repo-connection-feedback-header">
                                            <span
                                                className={`repo-connection-feedback-pill ${selectedRepoStatusCopy.tone}`.trim()}
                                            >
                                                {selectedRepoStatusCopy.pill}
                                            </span>
                                            <span className="repo-connection-feedback-title">
                                                {selectedRepoStatusCopy.title}
                                            </span>
                                        </div>
                                        <div className="repo-connection-feedback-copy">
                                            {selectedRepoStatusCopy.message}
                                        </div>
                                        <div className="repo-connection-feedback-detail">
                                            {selectedRepoStatusCopy.detail}
                                        </div>
                                    </div>
                                </div>
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
                        <span className="menu-start-kicker">{startKicker}</span>
                        <span className="menu-start-title">{startTitle}</span>
                        <span className="menu-start-meta">{startMeta}</span>
                    </>
                ) : (
                    'Enter the City'
                )}
            </button>

            <div className={`menu-secondary-actions ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                {repoCityMode && !githubAuthCard && <GitHubTrustNotice />}
                {githubAuthCard ? (
                    <div
                        className={`menu-repo-btn menu-auth-status ${repoCityMode ? 'repo-city' : ''} ${githubAuthCard.tone}`.trim()}
                        aria-live="polite"
                        aria-busy={githubAuthCard.icon === 'spinner'}
                    >
                        {repoCityMode ? (
                            <span className="menu-auth-status-layout">
                                <span className={`menu-auth-status-icon ${githubAuthCard.tone}`.trim()} aria-hidden="true">
                                    {githubAuthCard.icon === 'spinner'
                                        ? <span className="repo-status-spinner" />
                                        : renderGitHubAuthCardGlyph(githubAuthCard.icon)}
                                </span>
                                <span className="menu-auth-status-copy">
                                    <span className="menu-action-label">{githubAuthCard.title}</span>
                                    <span className="menu-action-meta">{githubAuthCard.meta}</span>
                                </span>
                            </span>
                        ) : (
                            <>
                                <span className="menu-action-label">{githubAuthCard.title}</span>
                                <span className="menu-action-meta">{githubAuthCard.meta}</span>
                            </>
                        )}
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
                                    {githubRepoActionMeta}
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
