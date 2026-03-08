export type GitHubRepoVisibility = 'public' | 'private' | 'internal' | 'unknown';

export interface GitHubRepoTranslationEligibility {
    eligible: boolean;
    tone: 'eligible' | 'reference';
    pill: string;
    shortLabel: string;
    pickerDetail: string;
    menuDetail: string;
}

export function getGitHubRepoTranslationEligibility(
    visibility: GitHubRepoVisibility,
): GitHubRepoTranslationEligibility {
    if (visibility === 'public') {
        return {
            eligible: true,
            tone: 'eligible',
            pill: 'Translate now',
            shortLabel: 'translate now',
            pickerDetail: 'Eligible for Repo City translation in this read-only flow.',
            menuDetail: 'This public repo can be translated in the current read-only flow.',
        };
    }

    if (visibility === 'private') {
        return {
            eligible: false,
            tone: 'reference',
            pill: 'Listed only',
            shortLabel: 'listed only',
            pickerDetail: 'Visible through this GitHub connection, but Repo City needs explicit access before translation.',
            menuDetail: "This private repo can't be translated in the current read-only flow.",
        };
    }

    return {
        eligible: false,
        tone: 'reference',
        pill: 'Listed only',
        shortLabel: 'listed only',
        pickerDetail: 'Visible through this GitHub connection, but this repo is not translation-eligible in the current flow.',
        menuDetail: "This repo can't be translated in the current read-only flow.",
    };
}

export function isGitHubRepoTranslationEligible(visibility: GitHubRepoVisibility): boolean {
    return getGitHubRepoTranslationEligibility(visibility).eligible;
}
