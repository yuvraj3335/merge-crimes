const REPO_PRIVACY_NOTICE =
    'This app reads repository metadata and top-level structure names only. No personal data is copied, and this flow never edits repos. You must explicitly select each repo to visualize it. In the default OAuth flow, only public repos are eligible for city generation.';

interface RepoPrivacyNoticeProps {
    context: 'menu' | 'picker';
}

export function RepoPrivacyNotice({ context }: RepoPrivacyNoticeProps) {
    return (
        <div className={`repo-privacy-notice ${context}`.trim()} role="note">
            <div className="repo-privacy-notice-kicker">Privacy boundary</div>
            <div className="repo-privacy-notice-title">Metadata-first, read-only GitHub access</div>
            <p className="repo-privacy-notice-copy">{REPO_PRIVACY_NOTICE}</p>
        </div>
    );
}
