import type { GeneratedCity, RepoModel } from '../../../shared/repoModel';
import type { GitHubReadableRepo } from '../api';
import type { GitHubRepoTranslationEligibility } from '../repoTranslationEligibility';

export interface SelectedGitHubRepoIngestStateLike {
    tone: 'idle' | 'loading' | 'error';
    repoId: number | null;
    message: string | null;
}

type SelectedRepoStatusKind = 'none' | 'loading' | 'error' | 'active' | 'eligible' | 'listed-only';

export interface SelectedRepoStatusModel {
    kind: SelectedRepoStatusKind;
    selectedGitHubRepo: GitHubReadableRepo | null;
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null;
    selectedGitHubRepoIsActive: boolean;
    connectedRepo: RepoModel | null;
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestStateLike;
}

export interface SelectedRepoStatusCopy {
    tone: 'loading' | 'success' | 'error' | 'empty';
    pill: string;
    title: string;
    message: string;
    detail: string;
    showSpinner?: boolean;
}

export interface SelectedRepoAuthCardCopy {
    title: string;
    meta: string;
    tone: 'active' | 'waiting' | 'failed' | 'listed-only';
    icon: 'check' | 'spinner' | 'x' | 'list';
}

export interface SelectedRepoStartCopy {
    kicker: string;
    title: string;
    meta: string;
}

export function isSelectedGitHubRepoSnapshotIngesting(
    selectedGitHubRepo: GitHubReadableRepo | null,
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null,
    selectedGitHubRepoIsActive: boolean,
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestStateLike,
): boolean {
    return Boolean(
        selectedGitHubRepo
        && selectedGitHubRepoEligibility?.eligible
        && !selectedGitHubRepoIsActive
        && selectedGitHubRepoIngestState.tone === 'loading'
        && selectedGitHubRepoIngestState.repoId === selectedGitHubRepo.id,
    );
}

export function didSelectedGitHubRepoSnapshotIngestFail(
    selectedGitHubRepo: GitHubReadableRepo | null,
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null,
    selectedGitHubRepoIsActive: boolean,
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestStateLike,
): boolean {
    return Boolean(
        selectedGitHubRepo
        && selectedGitHubRepoEligibility?.eligible
        && !selectedGitHubRepoIsActive
        && selectedGitHubRepoIngestState.tone === 'error'
        && selectedGitHubRepoIngestState.repoId === selectedGitHubRepo.id,
    );
}

export function getSelectedRepoStatusModel(
    selectedGitHubRepo: GitHubReadableRepo | null,
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null,
    selectedGitHubRepoIsActive: boolean,
    connectedRepo: RepoModel | null,
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestStateLike,
): SelectedRepoStatusModel {
    if (!selectedGitHubRepo || !selectedGitHubRepoEligibility) {
        return {
            kind: 'none',
            selectedGitHubRepo,
            selectedGitHubRepoEligibility,
            selectedGitHubRepoIsActive,
            connectedRepo,
            selectedGitHubRepoIngestState,
        };
    }

    const repoStillIngesting = isSelectedGitHubRepoSnapshotIngesting(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        selectedGitHubRepoIngestState,
    );

    if (repoStillIngesting) {
        return {
            kind: 'loading',
            selectedGitHubRepo,
            selectedGitHubRepoEligibility,
            selectedGitHubRepoIsActive,
            connectedRepo,
            selectedGitHubRepoIngestState,
        };
    }

    const repoIngestFailed = didSelectedGitHubRepoSnapshotIngestFail(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        selectedGitHubRepoIngestState,
    );

    if (repoIngestFailed) {
        return {
            kind: 'error',
            selectedGitHubRepo,
            selectedGitHubRepoEligibility,
            selectedGitHubRepoIsActive,
            connectedRepo,
            selectedGitHubRepoIngestState,
        };
    }

    if (selectedGitHubRepoEligibility.eligible) {
        return {
            kind: selectedGitHubRepoIsActive ? 'active' : 'eligible',
            selectedGitHubRepo,
            selectedGitHubRepoEligibility,
            selectedGitHubRepoIsActive,
            connectedRepo,
            selectedGitHubRepoIngestState,
        };
    }

    return {
        kind: 'listed-only',
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        connectedRepo,
        selectedGitHubRepoIngestState,
    };
}

export function buildSelectedRepoStatusCopyFromModel(
    selectedRepoStatusModel: SelectedRepoStatusModel,
): SelectedRepoStatusCopy | null {
    const {
        kind,
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIngestState,
        connectedRepo,
    } = selectedRepoStatusModel;

    if (kind === 'none' || !selectedGitHubRepo || !selectedGitHubRepoEligibility) {
        return null;
    }

    if (kind === 'loading') {
        return {
            tone: 'loading',
            pill: 'Ingesting repo',
            title: 'Selected repo is still loading',
            message: 'Ingesting repository data... Please wait before entering the city.',
            detail: connectedRepo
                ? `${connectedRepo.owner}/${connectedRepo.name} stays active until ${selectedGitHubRepo.fullName} finishes its read-only snapshot ingest.`
                : `${selectedGitHubRepo.fullName} will become the active city after its read-only snapshot is ready.`,
            showSpinner: true,
        };
    }

    if (kind === 'error') {
        return {
            tone: 'error',
            pill: 'Ingest failed',
            title: 'Selected repo is not ready',
            message: selectedGitHubRepoIngestState.message
                ?? 'GitHub did not return a readable snapshot for this repository.',
            detail: connectedRepo
                ? `${connectedRepo.owner}/${connectedRepo.name} stays active until you retry this public repo selection.`
                : 'Retry this public repo selection to request a new read-only snapshot.',
        };
    }

    if (kind === 'active' || kind === 'eligible') {
        return {
            tone: 'success',
            pill: kind === 'active' ? 'Active city' : selectedGitHubRepoEligibility.pill,
            title: kind === 'active' ? 'Selected repo is active' : 'Selected repo is eligible',
            message: kind === 'active'
                ? `${selectedGitHubRepo.fullName} is the public repo behind the current Repo City snapshot.`
                : `${selectedGitHubRepo.fullName} is eligible for Repo City translation in this flow.`,
            detail: kind === 'active'
                ? 'Menu status and actions now match the same eligibility rule shown in the picker.'
                : connectedRepo
                    ? `${connectedRepo.owner}/${connectedRepo.name} stays active until a read-only snapshot for the selected repo is available.`
                    : 'The menu only switches the active city after a read-only GitHub snapshot is available.',
        };
    }

    return {
        tone: 'empty',
        pill: selectedGitHubRepoEligibility.pill,
        title: 'Selected repo is listed only',
        message: `${selectedGitHubRepo.fullName} is visible through GitHub, but ${selectedGitHubRepoEligibility.menuDetail.toLowerCase()}`,
        detail: connectedRepo
            ? `${connectedRepo.owner}/${connectedRepo.name} stays the active city. Pick an eligible public repo to switch translation.`
            : 'Pick an eligible public repo to generate a city here.',
    };
}

export function buildSelectedRepoStatusCopy(
    selectedGitHubRepo: GitHubReadableRepo | null,
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null,
    selectedGitHubRepoIsActive: boolean,
    connectedRepo: RepoModel | null,
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestStateLike,
): SelectedRepoStatusCopy | null {
    return buildSelectedRepoStatusCopyFromModel(getSelectedRepoStatusModel(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        connectedRepo,
        selectedGitHubRepoIngestState,
    ));
}

export function buildSelectedRepoAuthCardCopy(
    selectedRepoStatusModel: SelectedRepoStatusModel,
): SelectedRepoAuthCardCopy | null {
    const { kind, selectedGitHubRepo, selectedGitHubRepoEligibility, connectedRepo } = selectedRepoStatusModel;

    if (kind === 'none' || !selectedGitHubRepo || !selectedGitHubRepoEligibility) {
        return null;
    }

    if (kind === 'loading') {
        return {
            title: 'Waiting for GitHub snapshot',
            meta: connectedRepo
                ? `Waiting for GitHub ingest... ${selectedGitHubRepo.fullName} is still loading, so ${connectedRepo.owner}/${connectedRepo.name} stays active for now.`
                : `Waiting for GitHub ingest... ${selectedGitHubRepo.fullName} is still loading before it can become the active city.`,
            tone: 'waiting',
            icon: 'spinner',
        };
    }

    if (kind === 'error') {
        return {
            title: 'GitHub snapshot failed',
            meta: connectedRepo
                ? `Snapshot failed—retry or reconnect. ${connectedRepo.owner}/${connectedRepo.name} stays active until ${selectedGitHubRepo.fullName} loads successfully.`
                : `Snapshot failed—retry or reconnect. ${selectedGitHubRepo.fullName} is not ready to become the active city yet.`,
            tone: 'failed',
            icon: 'x',
        };
    }

    if (kind === 'active') {
        return {
            title: 'GitHub repo active',
            meta: `${selectedGitHubRepo.fullName} is the active translated repo.`,
            tone: 'active',
            icon: 'check',
        };
    }

    if (kind === 'eligible') {
        return {
            title: 'GitHub repo selected',
            meta: `${selectedGitHubRepo.fullName} is eligible for repo-city translation in this flow.`,
            tone: 'active',
            icon: 'check',
        };
    }

    return {
        title: 'GitHub repo listed only',
        meta: `${selectedGitHubRepo.fullName} is listed only. ${selectedGitHubRepoEligibility.menuDetail}`,
        tone: 'listed-only',
        icon: 'list',
    };
}

export function buildSelectedRepoStartCopy(
    selectedRepoStatusModel: SelectedRepoStatusModel,
    generatedCity: GeneratedCity | null,
): SelectedRepoStartCopy {
    const { kind, selectedGitHubRepo, connectedRepo } = selectedRepoStatusModel;
    const selectedRepoName = selectedGitHubRepo?.fullName ?? 'The selected GitHub repo';
    const readyMeta = generatedCity
        ? `${generatedCity.districts.length} districts · ${generatedCity.missions.length} routes ready`
        : 'Repo city translation ready';

    if (kind === 'loading') {
        return connectedRepo
            ? {
                kicker: 'Current active city',
                title: 'Enter Current Repo City',
                meta: `${selectedRepoName} is still ingesting. Entering ${connectedRepo.owner}/${connectedRepo.name} until the new snapshot is ready.`,
            }
            : {
                kicker: 'Preparing snapshot',
                title: 'Preparing Repo City...',
                meta: `${selectedRepoName} is still ingesting. Wait for the read-only snapshot before entering.`,
            };
    }

    if (kind === 'error') {
        return connectedRepo
            ? {
                kicker: 'Current active city',
                title: 'Enter Current Repo City',
                meta: `${selectedRepoName} did not finish ingest. Entering ${connectedRepo.owner}/${connectedRepo.name}.`,
            }
            : {
                kicker: 'Preparing snapshot',
                title: 'Enter Repo City',
                meta: `${selectedRepoName} is not ready yet. Retry the public repo selection before entering.`,
            };
    }

    if (kind === 'listed-only') {
        return connectedRepo
            ? {
                kicker: 'Current active city',
                title: 'Enter Repo City',
                meta: `${selectedRepoName} is listed only. Entering ${connectedRepo.owner}/${connectedRepo.name}.`,
            }
            : {
                kicker: 'Current active city',
                title: 'Enter Repo City',
                meta: `${selectedRepoName} is listed only. Pick an eligible public repo to generate a city.`,
            };
    }

    return {
        kicker: 'Launch translation',
        title: 'Enter Repo City',
        meta: readyMeta,
    };
}
