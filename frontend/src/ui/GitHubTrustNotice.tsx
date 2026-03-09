const REQUESTED_GITHUB_OAUTH_SCOPES = ['public_repo'] as const;

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
            <div className="github-trust-notice-title">Public repo metadata only</div>
            <p className="github-trust-notice-copy">
                Merge Crimes requests the <code>public_repo</code> scope to list and read metadata from your public
                repositories. Only public repos are eligible for city generation in the default flow. If a broader
                GitHub token can list private repos, they appear as "listed only" here.
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
