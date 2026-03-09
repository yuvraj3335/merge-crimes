import sampleRepoSnapshotJson from '../../shared/snapshots/sample_repo_snapshot.json';
import type { GitHubRepoMetadataSnapshot, RepoSignal } from '../../shared/repoModel';
import { createInitialConnectedRepoRefreshStatus } from '../../shared/repoRefresh';
import { getGitHubRepoTranslationEligibility } from '../src/repoTranslationEligibility';
import {
    SMOKE_CONNECTED_REPO_ID,
    SMOKE_CONNECTED_REPO_PROVIDER_ID,
    SMOKE_ACTIVE_COMMIT_SHA,
    SMOKE_REMOTE_COMMIT_SHA,
    SMOKE_CONNECTED_REPO_GENERATED_AT,
    SMOKE_REFRESH_CHECKED_AT,
    SMOKE_ELIGIBLE_REPO,
    SMOKE_LISTED_ONLY_REPO,
} from '../src/smokeFixtures';
import { useGameStore } from '../src/store/gameStore';
import {
    buildRepoHudRefreshNotice,
    buildRepoRefreshIndicatorTone,
    buildRepoRefreshStatusCopy,
    type RepoRefreshStatusState,
} from '../src/ui/repoRefreshCopy';
import { buildSelectedRepoStatusCopy } from '../src/ui/selectedRepoStatusCopy';
import { buildSnapshotFreshnessCopy } from '../src/ui/snapshotFreshness';

type SmokeTrustState = 'anonymous' | 'eligible-error' | 'listed-only';
type SmokeRefreshState = 'idle' | 'update-detected';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function cloneSignals(signals: RepoSignal[]): RepoSignal[] {
    return signals.map((signal) => ({ ...signal }));
}

function buildSmokeConnectedRepo(): GitHubRepoMetadataSnapshot {
    const baseSnapshot = sampleRepoSnapshotJson as GitHubRepoMetadataSnapshot;
    const latestCommitTarget = baseSnapshot.modules[0]?.id ?? 'mod-frontend';

    return {
        ...baseSnapshot,
        repoId: SMOKE_CONNECTED_REPO_ID,
        generatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
        languages: baseSnapshot.languages.map((language) => ({ ...language })),
        modules: baseSnapshot.modules.map((module) => ({ ...module })),
        dependencyEdges: baseSnapshot.dependencyEdges.map((edge) => ({ ...edge })),
        signals: [
            ...cloneSignals(baseSnapshot.signals).filter((signal) => signal.type !== 'latest_commit'),
            {
                type: 'latest_commit',
                target: latestCommitTarget,
                severity: 0,
                title: `Latest commit on ${baseSnapshot.defaultBranch}`,
                detail: SMOKE_ACTIVE_COMMIT_SHA,
                value: SMOKE_ACTIVE_COMMIT_SHA,
            },
        ],
        metadata: {
            ...(baseSnapshot.metadata ?? {
                provider: 'github',
                providerRepoId: SMOKE_CONNECTED_REPO_PROVIDER_ID,
                fullName: `${baseSnapshot.owner}/${baseSnapshot.name}`,
                description: null,
                htmlUrl: 'https://github.com/yuvrajmuley/merge-crimes',
                homepageUrl: null,
                topics: [],
                stars: 0,
                forks: 0,
                watchers: 0,
                openIssues: 0,
                primaryLanguage: 'TypeScript',
                license: null,
                archived: false,
                fork: false,
                updatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
                pushedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
            }),
            provider: 'github',
            providerRepoId: SMOKE_CONNECTED_REPO_PROVIDER_ID,
            updatedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
            pushedAt: SMOKE_CONNECTED_REPO_GENERATED_AT,
            topics: [...(baseSnapshot.metadata?.topics ?? [])],
        },
    };
}

function resetSmokeRepoCityHarness(): GitHubRepoMetadataSnapshot {
    const store = useGameStore.getState();
    const smokeRepo = buildSmokeConnectedRepo();

    store.loadRepoCity(smokeRepo);
    useGameStore.setState({
        apiAvailable: true,
        apiConnectionState: 'online',
        apiStatusMessage: null,
        writeSessionState: 'ready',
        writeSessionMessage: null,
        githubAccessToken: null,
        githubAuthStatus: 'anonymous',
        githubAuthMessage: null,
        selectedGitHubRepo: null,
        selectedGitHubRepoEligibility: null,
        selectedGitHubRepoIngestState: {
            tone: 'idle',
            repoId: null,
            message: null,
        },
        showGitHubRepoPicker: false,
        connectedRepoRefreshStatus: {
            ...createInitialConnectedRepoRefreshStatus(smokeRepo.signals),
            checkedAt: SMOKE_REFRESH_CHECKED_AT,
            lastKnownCommitSha: SMOKE_ACTIVE_COMMIT_SHA,
        },
        credits: 0,
        reputation: 0,
        playerPosition: [0, 0.5, 0],
        districtRooms: {},
        showMissionPanel: false,
        showLeaderboard: false,
        showBulletin: false,
        rewardToasts: [],
        phase: 'menu',
    });

    return smokeRepo;
}

function setTrustState(trustState: SmokeTrustState) {
    if (trustState === 'anonymous') {
        useGameStore.setState({
            githubAccessToken: null,
            githubAuthStatus: 'anonymous',
            githubAuthMessage: null,
            selectedGitHubRepo: null,
            selectedGitHubRepoEligibility: null,
            selectedGitHubRepoIngestState: {
                tone: 'idle',
                repoId: null,
                message: null,
            },
            showGitHubRepoPicker: false,
        });
        return;
    }

    const selectedRepo = trustState === 'listed-only' ? SMOKE_LISTED_ONLY_REPO : SMOKE_ELIGIBLE_REPO;
    const selectedRepoEligibility = getGitHubRepoTranslationEligibility(selectedRepo.visibility);

    useGameStore.setState({
        githubAccessToken: 'smoke-github-token',
        githubAuthStatus: 'authenticated',
        githubAuthMessage: null,
        selectedGitHubRepo: selectedRepo,
        selectedGitHubRepoEligibility: selectedRepoEligibility,
        selectedGitHubRepoIngestState: trustState === 'eligible-error'
            ? {
                tone: 'error',
                repoId: selectedRepo.id,
                message: 'GitHub did not return a readable snapshot. The current city is still active.',
            }
            : {
                tone: 'idle',
                repoId: null,
                message: null,
            },
        showGitHubRepoPicker: false,
    });
}

function setRefreshState(refreshState: SmokeRefreshState, smokeRepo: GitHubRepoMetadataSnapshot) {
    const baseStatus = {
        ...createInitialConnectedRepoRefreshStatus(smokeRepo.signals),
        checkedAt: SMOKE_REFRESH_CHECKED_AT,
        lastKnownCommitSha: SMOKE_ACTIVE_COMMIT_SHA,
    };

    useGameStore.setState({
        connectedRepoRefreshStatus: refreshState === 'update-detected'
            ? {
                ...baseStatus,
                status: 'update_detected',
                latestRemoteCommitSha: SMOKE_REMOTE_COMMIT_SHA,
                hasNewerRemote: true,
            }
            : baseStatus,
    });
}

function getIdleRepoRefreshStatus(): RepoRefreshStatusState {
    return {
        tone: 'idle',
        message: null,
        repoId: null,
    };
}

function runScenario(scenario: string) {
    const smokeRepo = resetSmokeRepoCityHarness();
    const freshnessCopy = buildSnapshotFreshnessCopy(smokeRepo.generatedAt, 'github', Date.now());

    switch (scenario) {
        case 'menu-anonymous': {
            const state = useGameStore.getState();
            assert(state.repoCityMode, 'Expected the smoke repo city harness to enable repo-city mode');
            assert(state.githubAuthStatus === 'anonymous', 'Expected the anonymous trust scenario to clear GitHub auth state');
            assert(freshnessCopy.primary.includes('GitHub data refreshed'), 'Expected menu freshness copy for the GitHub snapshot');
            break;
        }
        case 'menu-listed-only': {
            setTrustState('listed-only');
            const state = useGameStore.getState();
            const selectedRepoStatusCopy = buildSelectedRepoStatusCopy(
                state.selectedGitHubRepo,
                state.selectedGitHubRepoEligibility,
                false,
                state.connectedRepo,
                state.selectedGitHubRepoIngestState,
            );
            assert(selectedRepoStatusCopy?.title === 'Selected repo is listed only', 'Expected the selected private repo state to stay listed-only');
            assert(state.selectedGitHubRepo?.visibility === 'private', 'Expected the listed-only scenario to select a private repo');
            break;
        }
        case 'menu-eligible-error': {
            setTrustState('eligible-error');
            const state = useGameStore.getState();
            const selectedRepoStatusCopy = buildSelectedRepoStatusCopy(
                state.selectedGitHubRepo,
                state.selectedGitHubRepoEligibility,
                false,
                state.connectedRepo,
                state.selectedGitHubRepoIngestState,
            );
            assert(selectedRepoStatusCopy?.title === 'Selected repo is not ready', 'Expected the harness to surface a deterministic ingest failure state');
            assert(state.selectedGitHubRepoIngestState.tone === 'error', 'Expected the ingest-error scenario to set the selected repo ingest tone');
            break;
        }
        case 'menu-refresh-available': {
            setRefreshState('update-detected', smokeRepo);
            const state = useGameStore.getState();
            const refreshStatusCopy = buildRepoRefreshStatusCopy(
                state.connectedRepo,
                state.connectedRepoRefreshStatus,
                getIdleRepoRefreshStatus(),
            );
            const refreshIndicatorTone = buildRepoRefreshIndicatorTone(
                state.connectedRepo,
                state.connectedRepoRefreshStatus,
                getIdleRepoRefreshStatus(),
            );
            assert(refreshStatusCopy.pill === 'Update detected', 'Expected the menu refresh surface to report an available update');
            assert(refreshStatusCopy.title === 'Newer snapshot available', 'Expected the menu refresh surface to show the update-available title');
            assert(refreshIndicatorTone === 'success', 'Expected the menu refresh indicator tone to switch to success when updates are available');
            break;
        }
        case 'hud-refresh-available': {
            setRefreshState('update-detected', smokeRepo);
            const state = useGameStore.getState();
            const repoRefreshNotice = buildRepoHudRefreshNotice(state.connectedRepo, state.connectedRepoRefreshStatus);
            assert(freshnessCopy.primary.includes('GitHub data refreshed'), 'Expected the HUD provenance badge to render the GitHub freshness copy');
            assert(repoRefreshNotice?.title === 'Newer snapshot available', 'Expected the HUD to surface the refresh-available notice');
            assert(repoRefreshNotice?.detail.includes('Open the menu to refresh this repo snapshot.'), 'Expected the HUD refresh detail to keep the menu refresh guidance');
            break;
        }
        default:
            throw new Error(`Unknown smoke scenario: ${scenario}`);
    }

    console.log(JSON.stringify({ scenario, result: 'pass' }));
}

const scenario = process.argv[2];

assert(scenario, 'Expected a smoke scenario argument.');
runScenario(scenario);
