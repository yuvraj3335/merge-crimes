import { useEffect } from 'react';
import * as api from '../api';
import { useGameStore } from '../store/gameStore';

export function useGitHubOAuthCallback(): void {
    const setGitHubAuthExchanging = useGameStore((state) => state.setGitHubAuthExchanging);
    const setGitHubAccessToken = useGameStore((state) => state.setGitHubAccessToken);
    const setGitHubAuthError = useGameStore((state) => state.setGitHubAuthError);

    useEffect(() => {
        const callback = api.readGitHubOAuthCallback();
        if (!callback) {
            return;
        }

        api.clearGitHubOAuthCallbackUrl();

        if (!callback.code) {
            setGitHubAuthError('GitHub login did not return an authorization code.');
            return;
        }

        if (!api.validateGitHubOAuthState(callback.state)) {
            setGitHubAuthError('GitHub login state check failed.');
            return;
        }

        setGitHubAuthExchanging();
        void api.exchangeGitHubOAuthCode(callback.code, callback.state, callback.redirectUri)
            .then((response) => {
                if (!response.accessToken) {
                    setGitHubAuthError('GitHub token exchange failed.');
                    return;
                }

                setGitHubAccessToken(response.accessToken);
            })
            .catch(() => {
                setGitHubAuthError('GitHub token exchange failed.');
            });
    }, [setGitHubAccessToken, setGitHubAuthError, setGitHubAuthExchanging]);
}
