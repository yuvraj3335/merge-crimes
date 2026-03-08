import type { RepoModel } from '../../../shared/repoModel';
import type { GitHubReadableRepo } from '../api';
import type { GitHubRepoTranslationEligibility } from '../repoTranslationEligibility';

interface SelectedGitHubRepoIngestStateLike {
    tone: 'idle' | 'loading' | 'error';
    repoId: number | null;
    message: string | null;
}

export interface SelectedRepoStatusCopy {
    tone: 'loading' | 'success' | 'error' | 'empty';
    pill: string;
    title: string;
    message: string;
    detail: string;
    showSpinner?: boolean;
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

export function buildSelectedRepoStatusCopy(
    selectedGitHubRepo: GitHubReadableRepo | null,
    selectedGitHubRepoEligibility: GitHubRepoTranslationEligibility | null,
    selectedGitHubRepoIsActive: boolean,
    connectedRepo: RepoModel | null,
    selectedGitHubRepoIngestState: SelectedGitHubRepoIngestStateLike,
): SelectedRepoStatusCopy | null {
    if (!selectedGitHubRepo || !selectedGitHubRepoEligibility) {
        return null;
    }

    const repoStillIngesting = isSelectedGitHubRepoSnapshotIngesting(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        selectedGitHubRepoIngestState,
    );

    if (repoStillIngesting) {
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

    const repoIngestFailed = didSelectedGitHubRepoSnapshotIngestFail(
        selectedGitHubRepo,
        selectedGitHubRepoEligibility,
        selectedGitHubRepoIsActive,
        selectedGitHubRepoIngestState,
    );

    if (repoIngestFailed) {
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

    if (selectedGitHubRepoEligibility.eligible) {
        return {
            tone: 'success',
            pill: selectedGitHubRepoIsActive ? 'Active city' : selectedGitHubRepoEligibility.pill,
            title: selectedGitHubRepoIsActive ? 'Selected repo is active' : 'Selected repo is eligible',
            message: selectedGitHubRepoIsActive
                ? `${selectedGitHubRepo.fullName} is the public repo behind the current Repo City snapshot.`
                : `${selectedGitHubRepo.fullName} is eligible for Repo City translation in this flow.`,
            detail: selectedGitHubRepoIsActive
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
