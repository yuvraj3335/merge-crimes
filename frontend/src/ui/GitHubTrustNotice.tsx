const REQUESTED_GITHUB_OAUTH_SCOPES = ['read:user'] as const;

interface GitHubTrustNoticeProps {
    context?: 'connect' | 'picker';
}

export function GitHubTrustNotice({ context = 'connect' }: GitHubTrustNoticeProps) {
    const kicker = context === 'picker' ? 'After GitHub connect' : 'Before GitHub connect';

    return (
        <div
            className={`github-trust-notice ${context}`.trim()}
            role="note"
            aria-label="GitHub access notice"
            data-testid={`github-trust-notice-${context}`}
        >
            <div className="github-trust-notice-kicker">{kicker}</div>
            <div className="github-trust-notice-title">Read-only access only</div>
            <p className="github-trust-notice-copy">
                Merge Crimes asks GitHub for this OAuth scope before sign-in, then uses the session only to read repo
                metadata for city generation.
            </p>
            <div className="github-trust-notice-scopes" aria-label="Requested GitHub OAuth scopes">
                {REQUESTED_GITHUB_OAUTH_SCOPES.map((scope) => (
                    <span key={scope} className="github-trust-notice-scope">
                        {scope}
                    </span>
                ))}
            </div>
            <p className="github-trust-notice-copy">
                The app will never edit files, push commits, open pull requests, or modify your code from this flow.
            </p>
        </div>
    );
}
