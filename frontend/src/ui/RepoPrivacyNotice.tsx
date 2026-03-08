const REPO_PRIVACY_NOTICE =
    'This app only reads public repository metadata. No code or personal data is copied. You must explicitly select each repo to visualize. No write or content access is possible.';

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
