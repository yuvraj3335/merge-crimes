const DEFAULT_GITHUB_ACCESS_LABEL = 'No extra scopes';

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
                Merge Crimes uses GitHub&apos;s default OAuth grant with no extra repository scopes in the default flow.
                It reads public repository metadata and top-level structure names so it can build a city map. If this
                deployment is configured with broader GitHub access, private repos may appear as &quot;listed only&quot; here.
            </p>
            <div className="github-trust-notice-scopes" aria-label="Requested GitHub OAuth scopes">
                <span className="github-trust-notice-scope">{DEFAULT_GITHUB_ACCESS_LABEL}</span>
            </div>
            <p className="github-trust-notice-copy">
                The app will never edit files, push commits, open pull requests, or modify your code from this flow.
            </p>
        </div>
    );
}
