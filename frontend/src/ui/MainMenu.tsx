import { memo, useEffect, useRef, useState } from 'react';
import type { GeneratedCity, GitHubRepoMetadataSnapshot, RepoModel } from '../../../shared/repoModel';
import { REPO_FIXTURES } from '../../../shared/seed/repoFixtures';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';
import { GitHubRepoPicker } from './GitHubRepoPicker';
import { GitHubTrustNotice } from './GitHubTrustNotice';
import { RepoPrivacyNotice } from './RepoPrivacyNotice';
import {
    buildRepoRefreshIndicatorTone,
    buildRepoRefreshStatusCopy,
    type RepoRefreshStatusState,
} from './repoRefreshCopy';
import {
    buildSelectedRepoAuthCardCopy,
    buildSelectedRepoStartCopy,
    buildSelectedRepoStatusCopyFromModel,
    getSelectedRepoStatusModel,
    type SelectedRepoStatusModel,
} from './selectedRepoStatusCopy';
import {
    getSnapshotFreshnessBadge,
    type SnapshotSource,
    useSnapshotFreshnessCopy,
} from './snapshotFreshness';

type GitHubAuthStatus = 'anonymous' | 'exchanging' | 'authenticated' | 'error';
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

interface MenuSnapshotFreshnessProps {
    generatedAt: string;
    source: SnapshotSource;
}

const MenuSnapshotFreshness = memo(function MenuSnapshotFreshness({
    generatedAt,
    source,
}: MenuSnapshotFreshnessProps) {
    const snapshotFreshness = useSnapshotFreshnessCopy(generatedAt, source);

    return (
        <div
            className={`repo-city-menu-freshness ${snapshotFreshness.source}`.trim()}
            data-testid="menu-snapshot-freshness"
        >
            <span className={`repo-city-menu-freshness-pill ${snapshotFreshness.source}`.trim()}>
                {snapshotFreshness.sourceLabel}
            </span>
            <div className="repo-city-menu-freshness-copy">
                <span className="repo-city-menu-freshness-primary">
                    {snapshotFreshness.primary}
                </span>
                {snapshotFreshness.detail && (
                    <time
                        className="repo-city-menu-freshness-detail"
                        dateTime={generatedAt}
                    >
                        {snapshotFreshness.detail}
                    </time>
                )}
            </div>
        </div>
    );
});

function useMainMenuStoreState() {
    const phase = useGameStore((state) => state.phase);
    const setPhase = useGameStore((state) => state.setPhase);
    const loadRepoCity = useGameStore((state) => state.loadRepoCity);
    const clearRepoCity = useGameStore((state) => state.clearRepoCity);
    const repoCityMode = useGameStore((state) => state.repoCityMode);
    const connectedRepo = useGameStore((state) => state.connectedRepo);
    const connectedRepoRefreshStatus = useGameStore((state) => state.connectedRepoRefreshStatus);
    const generatedCity = useGameStore((state) => state.generatedCity);
    const githubAccessToken = useGameStore((state) => state.githubAccessToken);
    const githubAuthStatus = useGameStore((state) => state.githubAuthStatus);
    const githubAuthMessage = useGameStore((state) => state.githubAuthMessage);
    const selectedGitHubRepo = useGameStore((state) => state.selectedGitHubRepo);
    const selectedGitHubRepoEligibility = useGameStore((state) => state.selectedGitHubRepoEligibility);
    const selectedGitHubRepoIngestState = useGameStore((state) => state.selectedGitHubRepoIngestState);
    const setSelectedGitHubRepoSnapshot = useGameStore((state) => state.setSelectedGitHubRepoSnapshot);
    const showGitHubRepoPicker = useGameStore((state) => state.showGitHubRepoPicker);
    const setShowGitHubRepoPicker = useGameStore((state) => state.setShowGitHubRepoPicker);

    return {
        phase,
        setPhase,
        loadRepoCity,
        clearRepoCity,
        repoCityMode,
        connectedRepo,
        connectedRepoRefreshStatus,
        generatedCity,
        githubAccessToken,
        githubAuthStatus,
        githubAuthMessage,
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIngestState,
        setSelectedGitHubRepoSnapshot,
        showGitHubRepoPicker,
        setShowGitHubRepoPicker,
    };
}

function useSelectedRepoMenuStatus({
    selectedGitHubRepo,
    selectedGitHubRepoEligibility,
    connectedRepo,
    selectedGitHubRepoIngestState,
}: {
    selectedGitHubRepo: SelectedRepoStatusModel['selectedGitHubRepo'];
    selectedGitHubRepoEligibility: SelectedRepoStatusModel['selectedGitHubRepoEligibility'];
    connectedRepo: SelectedRepoStatusModel['connectedRepo'];
    selectedGitHubRepoIngestState: SelectedRepoStatusModel['selectedGitHubRepoIngestState'];
}): SelectedRepoStatusModel {
    const selectedGitHubRepoIsActive = Boolean(
        selectedGitHubRepo
        && connectedRepo?.metadata?.provider === 'github'
        && connectedRepo.metadata.providerRepoId === selectedGitHubRepo.id,
    );

    return getSelectedRepoStatusModel(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        connectedRepo,
        selectedGitHubRepoIngestState,
    );
}

function useRepoRefresh({
    connectedRepo,
    githubAccessToken,
    setSelectedGitHubRepoSnapshot,
}: {
    connectedRepo: RepoModel | null;
    githubAccessToken: string | null;
    setSelectedGitHubRepoSnapshot: (snapshot: GitHubRepoMetadataSnapshot | null) => void;
}) {
    const [isRefreshingRepo, setIsRefreshingRepo] = useState(false);
    const [repoRefreshStatus, setRepoRefreshStatus] = useState<RepoRefreshStatusState>({
        tone: 'idle',
        message: null,
        repoId: null,
    });
    const refreshControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => {
        refreshControllerRef.current?.abort();
    }, []);

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

    return {
        isRefreshingRepo,
        repoRefreshStatus,
        handleRefreshRepo,
    };
}

function getConnectedRepoSnapshotSource(connectedRepo: RepoModel | null): SnapshotSource | null {
    if (!connectedRepo) {
        return null;
    }

    return connectedRepo.metadata?.provider === 'github' ? 'github' : 'seeded';
}

function getGitHubAuthCardCopy(
    githubAccessToken: string | null,
    githubAuthStatus: GitHubAuthStatus,
    selectedRepoStatusModel: SelectedRepoStatusModel,
): GitHubAuthCardCopy | null {
    const selectedRepoAuthCardCopy = buildSelectedRepoAuthCardCopy(selectedRepoStatusModel);

    if (githubAccessToken) {
        return selectedRepoAuthCardCopy ?? {
            title: 'Logged in as GitHub user',
            meta: 'GitHub login is active in this browser session.',
            tone: 'neutral',
            icon: 'dot',
        };
    }

    if (githubAuthStatus === 'exchanging') {
        return {
            title: 'Completing GitHub login',
            meta: 'Finishing the sign-in so the readable repo list can load.',
            tone: 'waiting',
            icon: 'spinner',
        };
    }

    return null;
}

function getGitHubRepoButtonMeta(selectedRepoStatusModel: SelectedRepoStatusModel): string {
    return buildSelectedRepoAuthCardCopy(selectedRepoStatusModel)?.meta
        ?? 'Load the readable repo list without leaving this menu.';
}

function ClassicMenuHero() {
    return (
        <>
            <div className="menu-title">MERGE CRIMES</div>
            <div className="menu-subtitle">Human vs AI — Defend Your Repo</div>
        </>
    );
}

function SelectedRepoStatusPanel({
    selectedRepoStatusModel,
}: {
    selectedRepoStatusModel: SelectedRepoStatusModel;
}) {
    const selectedRepoStatusCopy = buildSelectedRepoStatusCopyFromModel(selectedRepoStatusModel);

    if (!selectedRepoStatusCopy) {
        return null;
    }

    return (
        <div
            className={`repo-connection-feedback ${selectedRepoStatusCopy.tone}`.trim()}
            aria-live="polite"
            data-testid="selected-github-repo-status"
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
    );
}

function RepoRefreshControls({
    connectedRepo,
    connectedRepoRefreshStatus,
    githubAccessToken,
    isRefreshingRepo,
    repoRefreshStatus,
    onRefreshRepo,
}: {
    connectedRepo: RepoModel;
    connectedRepoRefreshStatus: Parameters<typeof buildRepoRefreshStatusCopy>[1];
    githubAccessToken: string | null;
    isRefreshingRepo: boolean;
    repoRefreshStatus: RepoRefreshStatusState;
    onRefreshRepo: () => void;
}) {
    const canRefreshConnectedRepo = connectedRepo.metadata?.provider === 'github'
        && (connectedRepo.visibility === 'public' || Boolean(githubAccessToken));

    if (!canRefreshConnectedRepo) {
        return null;
    }

    const refreshStatusCopy = buildRepoRefreshStatusCopy(
        connectedRepo,
        connectedRepoRefreshStatus,
        repoRefreshStatus,
    );
    const refreshIndicatorTone = buildRepoRefreshIndicatorTone(
        connectedRepo,
        connectedRepoRefreshStatus,
        repoRefreshStatus,
    );

    return (
        <div className="repo-city-menu-repo-actions">
            <button
                type="button"
                className={`repo-city-refresh-btn ${isRefreshingRepo ? 'loading' : ''}`.trim()}
                data-testid="refresh-repo"
                onClick={onRefreshRepo}
                disabled={isRefreshingRepo}
            >
                <span
                    className={`repo-refresh-indicator ${isRefreshingRepo ? 'spinning' : ''}`.trim()}
                    aria-hidden="true"
                />
                <span>{isRefreshingRepo ? 'Refreshing Repo' : 'Refresh Repo'}</span>
            </button>
            <div
                className={`repo-connection-feedback ${refreshIndicatorTone === 'idle' ? '' : refreshIndicatorTone}`.trim()}
                aria-live="polite"
                aria-busy={isRefreshingRepo}
                data-testid="repo-refresh-feedback"
            >
                <div className="repo-connection-feedback-header">
                    <span
                        className={`repo-connection-feedback-pill ${refreshIndicatorTone}`.trim()}
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
    );
}

function RepoCitySummary({
    generatedCity,
    connectedRepoSnapshotSource,
}: {
    generatedCity: GeneratedCity | null;
    connectedRepoSnapshotSource: SnapshotSource | null;
}) {
    if (!generatedCity) {
        return null;
    }

    const snapshotFreshnessBadge = connectedRepoSnapshotSource
        ? getSnapshotFreshnessBadge(connectedRepoSnapshotSource)
        : null;
    const repoCitySummaryMetrics = [
        { label: 'Districts', value: generatedCity.districts.length },
        { label: 'Roads', value: generatedCity.roads.length },
        { label: 'Missions', value: generatedCity.missions.length },
        { label: 'Threats', value: generatedCity.bots.length },
    ];

    return (
        <div className="repo-city-summary repo-city">
            <div className="repo-city-summary-header">
                <div className="repo-city-summary-copy">
                    <div className={`repo-city-badge ${connectedRepoSnapshotSource ?? ''}`.trim()}>
                        {snapshotFreshnessBadge ?? 'City snapshot ready'}
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
    );
}

function RepoHero({
    connectedRepo,
    connectedRepoRefreshStatus,
    generatedCity,
    githubAccessToken,
    isRefreshingRepo,
    repoRefreshStatus,
    onRefreshRepo,
    selectedRepoStatusModel,
}: {
    connectedRepo: RepoModel | null;
    connectedRepoRefreshStatus: Parameters<typeof buildRepoRefreshStatusCopy>[1];
    generatedCity: GeneratedCity | null;
    githubAccessToken: string | null;
    isRefreshingRepo: boolean;
    repoRefreshStatus: RepoRefreshStatusState;
    onRefreshRepo: () => void;
    selectedRepoStatusModel: SelectedRepoStatusModel;
}) {
    const connectedRepoSnapshotSource = getConnectedRepoSnapshotSource(connectedRepo);

    return (
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
                        {connectedRepoSnapshotSource && (
                            <MenuSnapshotFreshness
                                generatedAt={connectedRepo.generatedAt}
                                source={connectedRepoSnapshotSource}
                            />
                        )}
                        <RepoRefreshControls
                            connectedRepo={connectedRepo}
                            connectedRepoRefreshStatus={connectedRepoRefreshStatus}
                            githubAccessToken={githubAccessToken}
                            isRefreshingRepo={isRefreshingRepo}
                            repoRefreshStatus={repoRefreshStatus}
                            onRefreshRepo={onRefreshRepo}
                        />
                    </div>
                )}
                <SelectedRepoStatusPanel selectedRepoStatusModel={selectedRepoStatusModel} />
            </div>

            <RepoCitySummary
                generatedCity={generatedCity}
                connectedRepoSnapshotSource={connectedRepoSnapshotSource}
            />
        </div>
    );
}

function MenuStartButton({
    generatedCity,
    onEnterCity,
    repoCityMode,
    selectedRepoStatusModel,
}: {
    generatedCity: GeneratedCity | null;
    onEnterCity: () => void;
    repoCityMode: boolean;
    selectedRepoStatusModel: SelectedRepoStatusModel;
}) {
    const startCopy = buildSelectedRepoStartCopy(selectedRepoStatusModel, generatedCity);

    return (
        <button
            type="button"
            className={`menu-start-btn ${repoCityMode ? 'repo-city' : ''}`.trim()}
            data-testid="enter-city"
            onClick={onEnterCity}
        >
            {repoCityMode ? (
                <>
                    <span className="menu-start-kicker">{startCopy.kicker}</span>
                    <span className="menu-start-title">{startCopy.title}</span>
                    <span className="menu-start-meta">{startCopy.meta}</span>
                </>
            ) : (
                'Enter the City'
            )}
        </button>
    );
}

function MenuActions({
    githubAccessToken,
    githubAuthMessage,
    githubAuthStatus,
    onClassicMode,
    onOpenGitHubRepoPicker,
    onToggleSeedRepoSelector,
    repoCityMode,
    selectedRepoStatusModel,
}: {
    githubAccessToken: string | null;
    githubAuthMessage: string | null;
    githubAuthStatus: GitHubAuthStatus;
    onClassicMode: () => void;
    onOpenGitHubRepoPicker: () => void;
    onToggleSeedRepoSelector: () => void;
    repoCityMode: boolean;
    selectedRepoStatusModel: SelectedRepoStatusModel;
}) {
    const githubAuthCard = getGitHubAuthCardCopy(
        githubAccessToken,
        githubAuthStatus,
        selectedRepoStatusModel,
    );
    const githubRepoButtonMeta = getGitHubRepoButtonMeta(selectedRepoStatusModel);
    const selectedGitHubRepo = selectedRepoStatusModel.selectedGitHubRepo;

    return (
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
                            <span
                                className={`menu-auth-status-icon ${githubAuthCard.tone}`.trim()}
                                aria-hidden="true"
                            >
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
                    onClick={onOpenGitHubRepoPicker}
                >
                    {repoCityMode ? (
                        <>
                            <span className="menu-action-label">
                                {selectedGitHubRepo ? 'Change GitHub Repo' : 'Pick GitHub Repo'}
                            </span>
                            <span className="menu-action-meta">
                                {githubRepoButtonMeta}
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
                onClick={onToggleSeedRepoSelector}
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
                    onClick={onClassicMode}
                >
                    <span className="menu-action-label">Classic Mode</span>
                    <span className="menu-action-meta">Return to the legacy city</span>
                </button>
            )}
        </div>
    );
}

function SeedRepoSelector({
    connectedRepo,
    onClose,
    onSelectRepo,
    repoCityMode,
    showRepoSelector,
}: {
    connectedRepo: RepoModel | null;
    onClose: () => void;
    onSelectRepo: (repo: RepoModel) => void;
    repoCityMode: boolean;
    showRepoSelector: boolean;
}) {
    if (!showRepoSelector) {
        return null;
    }

    const selectorHint = repoCityMode
        ? 'Choose a repo snapshot to translate into districts, routes, and threat signals.'
        : 'The repo inspires the city — districts, missions, and threats are generated from its structure.';

    return (
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
                        onClick={onClose}
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
                        onClick={() => onSelectRepo(repo)}
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
                onClick={onClose}
            >
                {repoCityMode ? 'Close Selector' : 'Cancel'}
            </button>
        </div>
    );
}

function MenuFooter({
    generatedCity,
    repoCityMode,
}: {
    generatedCity: GeneratedCity | null;
    repoCityMode: boolean;
}) {
    const footerNote = generatedCity
        ? `${generatedCity.repoName} snapshot · ${generatedCity.districts.length} districts ready`
        : 'Metadata-first seeded translation';

    return repoCityMode ? (
        <div className="menu-version repo-city">
            <span className="menu-version-pill">Repo City MVP</span>
            <span className="menu-version-copy">{footerNote}</span>
            <span className="menu-version-phase">Phase 3 shell</span>
        </div>
    ) : (
        <div className="menu-version">v0.2.0 — Repo City MVP — Phase 3</div>
    );
}

export function MainMenu() {
    const {
        phase,
        setPhase,
        loadRepoCity,
        clearRepoCity,
        repoCityMode,
        connectedRepo,
        connectedRepoRefreshStatus,
        generatedCity,
        githubAccessToken,
        githubAuthStatus,
        githubAuthMessage,
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIngestState,
        setSelectedGitHubRepoSnapshot,
        showGitHubRepoPicker,
        setShowGitHubRepoPicker,
    } = useMainMenuStoreState();
    const [showRepoSelector, setShowRepoSelector] = useState(false);
    const selectedRepoStatusModel = useSelectedRepoMenuStatus({
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        connectedRepo,
        selectedGitHubRepoIngestState,
    });
    const { isRefreshingRepo, repoRefreshStatus, handleRefreshRepo } = useRepoRefresh({
        connectedRepo,
        githubAccessToken,
        setSelectedGitHubRepoSnapshot,
    });

    if (phase !== 'menu') {
        return null;
    }

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

    function handleOpenGitHubRepoPicker() {
        setShowRepoSelector(false);
        setShowGitHubRepoPicker(true);
    }

    function handleToggleSeedRepoSelector() {
        setShowGitHubRepoPicker(false);
        setShowRepoSelector((current) => !current);
    }

    return (
        <div className={`main-menu ${repoCityMode ? 'repo-city' : ''}`.trim()}>
            {repoCityMode && <RepoPrivacyNotice context="menu" />}
            {repoCityMode ? (
                <RepoHero
                    connectedRepo={connectedRepo}
                    connectedRepoRefreshStatus={connectedRepoRefreshStatus}
                    generatedCity={generatedCity}
                    githubAccessToken={githubAccessToken}
                    isRefreshingRepo={isRefreshingRepo}
                    repoRefreshStatus={repoRefreshStatus}
                    onRefreshRepo={handleRefreshRepo}
                    selectedRepoStatusModel={selectedRepoStatusModel}
                />
            ) : (
                <ClassicMenuHero />
            )}

            <MenuStartButton
                generatedCity={generatedCity}
                onEnterCity={() => setPhase('playing')}
                repoCityMode={repoCityMode}
                selectedRepoStatusModel={selectedRepoStatusModel}
            />

            <MenuActions
                githubAccessToken={githubAccessToken}
                githubAuthMessage={githubAuthMessage}
                githubAuthStatus={githubAuthStatus}
                onClassicMode={handleClassicMode}
                onOpenGitHubRepoPicker={handleOpenGitHubRepoPicker}
                onToggleSeedRepoSelector={handleToggleSeedRepoSelector}
                repoCityMode={repoCityMode}
                selectedRepoStatusModel={selectedRepoStatusModel}
            />

            <SeedRepoSelector
                connectedRepo={connectedRepo}
                onClose={() => setShowRepoSelector(false)}
                onSelectRepo={handleSelectRepo}
                repoCityMode={repoCityMode}
                showRepoSelector={showRepoSelector}
            />

            <GitHubRepoPicker
                open={showGitHubRepoPicker}
                onClose={() => setShowGitHubRepoPicker(false)}
            />

            <MenuFooter generatedCity={generatedCity} repoCityMode={repoCityMode} />
        </div>
    );
}
