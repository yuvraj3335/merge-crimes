// ─── Merge Crimes — API Client ───
// Fetches game data from the Worker API with seed-data fallback

import type { GitHubRepoMetadataSnapshot } from '../../shared/repoModel';
import type { RepoRefreshCheckRequest, RepoRefreshCheckResult } from '../../shared/repoRefresh';
import type { District, Mission, LeaderboardEntry, CityEvent, MergeConflictEncounter } from '../../shared/types';
import { getRuntimeApiBaseOverride } from './runtimeConfig';

const API_BASE = getRuntimeApiBaseOverride() ?? import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';
const WRITE_SESSION_REFRESH_BUFFER_MS = 60_000;
const SESSION_STORAGE_KEY = 'merge-crimes-session-id';
const GITHUB_OAUTH_STATE_STORAGE_KEY = 'merge-crimes-github-oauth-state';
export const GITHUB_OAUTH_CALLBACK_PATH = '/auth/github/callback';

export type ApiConnectionState = 'unknown' | 'online' | 'offline';
export type ApiWriteSessionState = 'unknown' | 'checking' | 'ready' | 'error';
export type ApiClientErrorKind = 'transport' | 'http' | 'invalid_response';
type ApiService = 'worker' | 'github';

export interface ApiRuntimeStatus {
    connectionState: ApiConnectionState;
    connectionMessage: string | null;
    writeSessionState: ApiWriteSessionState;
    writeSessionMessage: string | null;
}

interface GitHubTokenExchangeResponse {
    accessToken: string;
    tokenType: string;
    scope: string;
}

export interface GitHubReadableRepo {
    id: number;
    name: string;
    fullName: string;
    ownerLogin: string;
    defaultBranch: string;
    visibility: 'public' | 'private' | 'internal' | 'unknown';
}

interface GitHubReadableRepoListResponse {
    repos: GitHubReadableRepo[];
    hasNextPage: boolean;
    nextPage: number | null;
}

interface RepoRefreshResponse {
    message: string;
    snapshot: GitHubRepoMetadataSnapshot;
}

interface GitHubRepoApiResponse {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    visibility?: 'public' | 'private' | 'internal';
    default_branch: string;
    owner: {
        login: string;
    };
}

export class ApiClientError extends Error {
    readonly kind: ApiClientErrorKind;
    readonly service: ApiService;
    readonly path: string;
    readonly status: number | null;

    constructor({
        message,
        kind,
        service,
        path,
        status = null,
    }: {
        message: string;
        kind: ApiClientErrorKind;
        service: ApiService;
        path: string;
        status?: number | null;
    }) {
        super(message);
        this.name = 'ApiClientError';
        this.kind = kind;
        this.service = service;
        this.path = path;
        this.status = status;
    }
}

function getOrCreateSessionId(): string {
    const fallback = crypto.randomUUID();

    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (existing) {
            return existing;
        }

        window.sessionStorage.setItem(SESSION_STORAGE_KEY, fallback);
        return fallback;
    } catch {
        return fallback;
    }
}

// Stable per-tab session ID for presence and session-scoped mission state.
export const SESSION_ID: string = getOrCreateSessionId();

export interface RoomState {
    presenceCount: number;
    captureProgress: number;
}

interface PublicWriteSession {
    token: string;
    expiresAt: string;
    sessionId: string;
}

const apiRuntimeListeners = new Set<(status: ApiRuntimeStatus) => void>();
let apiRuntimeStatus: ApiRuntimeStatus = {
    connectionState: 'unknown',
    connectionMessage: null,
    writeSessionState: 'unknown',
    writeSessionMessage: null,
};
let publicWriteSession: PublicWriteSession | null = null;
let publicWriteSessionPromise: Promise<PublicWriteSession> | null = null;

function emitApiRuntimeStatus(partial: Partial<ApiRuntimeStatus>): void {
    apiRuntimeStatus = { ...apiRuntimeStatus, ...partial };
    apiRuntimeListeners.forEach((listener) => listener(apiRuntimeStatus));
}

export function subscribeApiRuntimeStatus(listener: (status: ApiRuntimeStatus) => void): () => void {
    apiRuntimeListeners.add(listener);
    listener(apiRuntimeStatus);
    return () => {
        apiRuntimeListeners.delete(listener);
    };
}

function isAbortError(error: unknown): boolean {
    return typeof error === 'object'
        && error !== null
        && 'name' in error
        && (error as { name?: string }).name === 'AbortError';
}

function buildTransportErrorMessage(service: ApiService, fallback?: string): string {
    if (fallback) {
        return fallback;
    }

    return service === 'github'
        ? 'GitHub API unavailable. Check your network connection and try again.'
        : 'Worker API unavailable. Check your network connection and try again.';
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    const contentType = response.headers.get('content-type') ?? '';

    try {
        if (contentType.includes('application/json')) {
            const payload = await response.json() as { message?: unknown };
            if (typeof payload.message === 'string' && payload.message.trim()) {
                return payload.message;
            }
        } else {
            const text = await response.text();
            if (text.trim()) {
                return text.trim();
            }
        }
    } catch {
        // Fall back to the caller-supplied message.
    }

    return fallback;
}

async function readJsonResponse<T>(
    response: Response,
    {
        service,
        path,
        invalidMessage,
    }: {
        service: ApiService;
        path: string;
        invalidMessage: string;
    },
): Promise<T> {
    try {
        return (await response.json()) as T;
    } catch {
        throw new ApiClientError({
            message: invalidMessage,
            kind: 'invalid_response',
            service,
            path,
            status: response.status,
        });
    }
}

async function throwHttpError(
    response: Response,
    {
        service,
        path,
        fallbackMessage,
    }: {
        service: ApiService;
        path: string;
        fallbackMessage: string;
    },
): Promise<never> {
    throw new ApiClientError({
        message: await readErrorMessage(response, fallbackMessage),
        kind: 'http',
        service,
        path,
        status: response.status,
    });
}

async function requestUrl(
    url: string,
    {
        service,
        path,
        transportMessage,
        emitWorkerStatus = false,
    }: {
        service: ApiService;
        path: string;
        transportMessage?: string;
        /** Only emit worker connectionState updates when making worker calls. */
        emitWorkerStatus?: boolean;
    },
    options?: RequestInit,
): Promise<Response> {
    try {
        const headers = new Headers(options?.headers);
        if (options?.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const res = await fetch(url, {
            ...options,
            headers,
        });

        if (emitWorkerStatus) {
            emitApiRuntimeStatus({ connectionState: 'online', connectionMessage: null });
        }
        return res;
    } catch (error) {
        if (isAbortError(error)) {
            throw error;
        }

        const message = buildTransportErrorMessage(service, transportMessage);
        if (emitWorkerStatus) {
            emitApiRuntimeStatus({ connectionState: 'offline', connectionMessage: message });
        }
        throw new ApiClientError({
            message,
            kind: 'transport',
            service,
            path,
        });
    }
}

async function request(path: string, options?: RequestInit, transportMessage?: string): Promise<Response> {
    return requestUrl(`${API_BASE}${path}`, { service: 'worker', path, transportMessage, emitWorkerStatus: true }, options);
}

async function requestGitHub(url: string, options?: RequestInit, transportMessage?: string): Promise<Response> {
    return requestUrl(url, { service: 'github', path: url, transportMessage, emitWorkerStatus: false }, options);
}

async function apiFetch<T>(path: string, options?: RequestInit, invalidMessage = 'Worker returned an invalid response.'): Promise<T> {
    const res = await request(path, options);
    if (!res.ok) {
        await throwHttpError(res, {
            service: 'worker',
            path,
            fallbackMessage: `API request failed (${res.status}).`,
        });
    }

    return readJsonResponse<T>(res, { service: 'worker', path, invalidMessage });
}

function writeSessionIsFresh(session: PublicWriteSession): boolean {
    return Date.parse(session.expiresAt) - Date.now() > WRITE_SESSION_REFRESH_BUFFER_MS;
}

function emitWriteSessionError(message: string): void {
    emitApiRuntimeStatus({
        writeSessionState: 'error',
        writeSessionMessage: message,
    });
}

async function ensurePublicWriteSession(): Promise<PublicWriteSession> {
    if (publicWriteSession && writeSessionIsFresh(publicWriteSession)) {
        emitApiRuntimeStatus({ writeSessionState: 'ready', writeSessionMessage: null });
        return publicWriteSession;
    }

    if (!publicWriteSessionPromise) {
        emitApiRuntimeStatus({ writeSessionState: 'checking', writeSessionMessage: null });
        publicWriteSessionPromise = (async () => {
            try {
                const response = await request(
                    '/api/session',
                    {
                        method: 'POST',
                        body: JSON.stringify({ sessionId: SESSION_ID }),
                    },
                    'Worker API unavailable. Public writes are running in local-only fallback mode.',
                );

                if (!response.ok) {
                    const message = `Write-session mint failed (${response.status}). Check PUBLIC_SESSION_SECRET and PUBLIC_ORIGIN_ALLOWLIST.`;
                    emitWriteSessionError(message);
                    await throwHttpError(response, {
                        service: 'worker',
                        path: '/api/session',
                        fallbackMessage: message,
                    });
                }

                const session = await readJsonResponse<PublicWriteSession>(response, {
                    service: 'worker',
                    path: '/api/session',
                    invalidMessage: 'Worker returned an invalid write-session response.',
                });
                publicWriteSession = session;
                emitApiRuntimeStatus({ writeSessionState: 'ready', writeSessionMessage: null });
                return session;
            } catch (error) {
                if (!isAbortError(error) && apiRuntimeStatus.writeSessionState !== 'error') {
                    emitWriteSessionError(
                        error instanceof ApiClientError && error.kind === 'transport'
                            ? 'Worker API unavailable. Public writes are running in local-only fallback mode.'
                            : 'Worker write access is unavailable right now.',
                    );
                }

                throw error;
            } finally {
                publicWriteSessionPromise = null;
            }
        })();
    }

    return publicWriteSessionPromise;
}

async function writeApiFetch<T>(path: string, options?: RequestInit, allowRetry = true): Promise<T> {
    const session = await ensurePublicWriteSession();

    const headers = new Headers(options?.headers);
    headers.set('Authorization', `Bearer ${session.token}`);
    headers.set('X-Merge-Session-Id', SESSION_ID);

    const response = await request(path, {
        ...options,
        headers,
    });

    if (response.status === 401 && allowRetry) {
        publicWriteSession = null;
        emitApiRuntimeStatus({ writeSessionState: 'checking', writeSessionMessage: null });
        return writeApiFetch<T>(path, options, false);
    }

    if (!response.ok) {
        if (response.status === 401) {
            emitWriteSessionError('Worker write access expired. Retry write access to continue syncing.');
        }

        await throwHttpError(response, {
            service: 'worker',
            path,
            fallbackMessage: response.status === 401
                ? 'Worker write access expired. Retry write access to continue syncing.'
                : `Write request failed (${response.status}).`,
        });
    }

    return readJsonResponse<T>(response, {
        service: 'worker',
        path,
        invalidMessage: 'Worker returned an invalid write response.',
    });
}

// ─── Read Endpoints ───

export async function fetchDistricts(): Promise<District[]> {
    return apiFetch<District[]>('/api/districts', undefined, 'Worker returned an invalid districts response.');
}

export async function fetchMissions(districtId?: string): Promise<Mission[]> {
    const params = new URLSearchParams({ sessionId: SESSION_ID });
    if (districtId) {
        params.set('district', districtId);
    }

    return apiFetch<Mission[]>(`/api/missions?${params.toString()}`, undefined, 'Worker returned an invalid missions response.');
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    return apiFetch<LeaderboardEntry[]>('/api/leaderboard', undefined, 'Worker returned an invalid leaderboard response.');
}

export async function fetchEvents(): Promise<CityEvent[]> {
    return apiFetch<CityEvent[]>('/api/events', undefined, 'Worker returned an invalid events response.');
}

export async function fetchConflicts(): Promise<MergeConflictEncounter[]> {
    return apiFetch<MergeConflictEncounter[]>('/api/conflicts', undefined, 'Worker returned an invalid conflicts response.');
}

// ─── Write Endpoints ───

export async function acceptMission(id: string): Promise<Mission> {
    return writeApiFetch<Mission>(`/api/missions/${encodeURIComponent(id)}/accept`, { method: 'POST' });
}

interface CompleteMissionResult {
    mission: Mission;
    factionReward: {
        factionId: string;
        pointsAdded: number;
        rewardApplied: boolean;
        cooldownMinutes: number;
        nextEligibleAt: string;
    };
}

export async function completeMission(id: string): Promise<CompleteMissionResult> {
    return writeApiFetch<CompleteMissionResult>(`/api/missions/${encodeURIComponent(id)}/complete`, { method: 'POST' });
}

export async function failMission(id: string): Promise<Mission> {
    return writeApiFetch<Mission>(`/api/missions/${encodeURIComponent(id)}/fail`, { method: 'POST' });
}

function getGitHubOAuthRedirectUri(): string {
    if (typeof window === 'undefined') {
        return GITHUB_OAUTH_CALLBACK_PATH;
    }

    const redirectUrl = new URL(GITHUB_OAUTH_CALLBACK_PATH, window.location.origin);
    const currentParams = new URLSearchParams(window.location.search);
    const apiBase = currentParams.get('apiBase');
    const smoke = currentParams.get('smoke');

    if (apiBase) {
        redirectUrl.searchParams.set('apiBase', apiBase);
    }

    if (smoke) {
        redirectUrl.searchParams.set('smoke', smoke);
    }

    return redirectUrl.toString();
}

export function startGitHubOAuthLogin(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const state = crypto.randomUUID();
    try {
        window.sessionStorage.setItem(GITHUB_OAUTH_STATE_STORAGE_KEY, state);
    } catch {
        // sessionStorage is best-effort only for this MVP flow.
    }

    const query = new URLSearchParams({
        redirectUri: getGitHubOAuthRedirectUri(),
        state,
    });

    window.location.assign(`${API_BASE}/api/auth/github/start?${query.toString()}`);
}

export function readGitHubOAuthCallback():
    | {
        code: string | null;
        state: string | null;
        redirectUri: string;
    }
    | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const url = new URL(window.location.href);
    if (url.pathname !== GITHUB_OAUTH_CALLBACK_PATH) {
        return null;
    }

    return {
        code: url.searchParams.get('code'),
        state: url.searchParams.get('state'),
        redirectUri: getGitHubOAuthRedirectUri(),
    };
}

export function clearGitHubOAuthCallbackUrl(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
}

export function validateGitHubOAuthState(returnedState: string | null): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        const expectedNonce = window.sessionStorage.getItem(GITHUB_OAUTH_STATE_STORAGE_KEY);
        window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_STORAGE_KEY);
        // Fail closed: reject if either the stored nonce or the returned state is absent.
        if (!expectedNonce || !returnedState) {
            return false;
        }
        // The server returns a signed state "nonce.hmac" — extract just the nonce to compare.
        const dotIdx = returnedState.indexOf('.');
        const returnedNonce = dotIdx >= 0 ? returnedState.slice(0, dotIdx) : returnedState;
        return returnedNonce === expectedNonce;
    } catch {
        return false;
    }
}

export async function exchangeGitHubOAuthCode(
    code: string,
    state: string | null,
    redirectUri: string,
): Promise<GitHubTokenExchangeResponse> {
    return apiFetch<GitHubTokenExchangeResponse>('/api/auth/github/token', {
        method: 'POST',
        body: JSON.stringify({ code, ...(state ? { state } : {}), redirectUri }),
    }, 'Worker returned an invalid GitHub token response.');
}

function normalizeGitHubRepoVisibility(repo: GitHubRepoApiResponse): GitHubReadableRepo['visibility'] {
    if (repo.visibility) {
        return repo.visibility;
    }

    return repo.private ? 'private' : 'public';
}

export async function fetchGitHubReadableRepos(
    accessToken: string,
    signal?: AbortSignal,
    page = 1,
): Promise<GitHubReadableRepoListResponse> {
    const response = await requestGitHub(
        `https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member&page=${page}`,
        {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${accessToken}`,
                'X-GitHub-Api-Version': '2022-11-28',
            },
            signal,
        },
        'GitHub API unavailable. Could not load the readable repository list.',
    );

    if (!response.ok) {
        await throwHttpError(response, {
            service: 'github',
            path: 'https://api.github.com/user/repos',
            fallbackMessage: `GitHub repo fetch failed (${response.status}).`,
        });
    }

    const payload = await readJsonResponse<GitHubRepoApiResponse[]>(response, {
        service: 'github',
        path: 'https://api.github.com/user/repos',
        invalidMessage: 'GitHub returned an invalid repository list response.',
    });

    return {
        repos: payload.map((repo) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            ownerLogin: repo.owner.login,
            defaultBranch: repo.default_branch,
            visibility: normalizeGitHubRepoVisibility(repo),
        })),
        hasNextPage: response.headers.get('link')?.includes('rel="next"') ?? false,
        nextPage: response.headers.get('link')?.includes('rel="next"') ? page + 1 : null,
    };
}

export async function fetchGitHubRepoMetadata(
    owner: string,
    name: string,
    signal?: AbortSignal,
    accessToken?: string,
): Promise<GitHubRepoMetadataSnapshot> {
    const params = new URLSearchParams({
        owner,
        name,
    });

    const headers = accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
        }
        : undefined;

    return apiFetch<GitHubRepoMetadataSnapshot>(`/api/github/repo-metadata?${params.toString()}`, {
        signal,
        headers,
    }, 'Worker returned an invalid repo metadata response.');
}

export async function refreshGitHubRepo(
    owner: string,
    name: string,
    signal?: AbortSignal,
    accessToken?: string,
): Promise<RepoRefreshResponse> {
    const headers = new Headers();
    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await request('/api/refresh-repo', {
        method: 'POST',
        signal,
        headers,
        body: JSON.stringify({ owner, name }),
    }, 'Worker API unavailable. Repo refresh could not be started.');

    if (!response.ok) {
        await throwHttpError(response, {
            service: 'worker',
            path: '/api/refresh-repo',
            fallbackMessage: `Repo refresh failed (${response.status}).`,
        });
    }

    const payload = await readJsonResponse<Partial<RepoRefreshResponse> & { message?: string }>(response, {
        service: 'worker',
        path: '/api/refresh-repo',
        invalidMessage: 'Worker returned an invalid repo refresh response.',
    });
    if (!payload?.snapshot || typeof payload.message !== 'string') {
        throw new ApiClientError({
            message: 'Worker returned an invalid repo refresh response.',
            kind: 'invalid_response',
            service: 'worker',
            path: '/api/refresh-repo',
            status: response.status,
        });
    }

    return payload as RepoRefreshResponse;
}

export async function fetchGitHubRepoRefreshStatus(
    refreshCheck: RepoRefreshCheckRequest,
    signal?: AbortSignal,
    accessToken?: string,
): Promise<RepoRefreshCheckResult> {
    const headers = new Headers();
    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await request('/api/github/repo-refresh-status', {
        method: 'POST',
        signal,
        headers,
        body: JSON.stringify(refreshCheck),
    }, 'Worker API unavailable. Repo update status could not be checked.');

    if (!response.ok) {
        await throwHttpError(response, {
            service: 'worker',
            path: '/api/github/repo-refresh-status',
            fallbackMessage: `Repo update status failed (${response.status}).`,
        });
    }

    const payload = await readJsonResponse<Partial<RepoRefreshCheckResult> & { message?: string }>(response, {
        service: 'worker',
        path: '/api/github/repo-refresh-status',
        invalidMessage: 'Worker returned an invalid repo refresh status response.',
    });
    if (
        !payload
        || typeof payload.status !== 'string'
        || typeof payload.hasUpdates !== 'boolean'
        || typeof payload.checkedAt !== 'string'
    ) {
        throw new ApiClientError({
            message: 'Worker returned an invalid repo refresh status response.',
            kind: 'invalid_response',
            service: 'worker',
            path: '/api/github/repo-refresh-status',
            status: response.status,
        });
    }

    return payload as RepoRefreshCheckResult;
}

export async function primePublicWriteSession(): Promise<boolean> {
    await ensurePublicWriteSession();
    return true;
}

// ─── District Room (Durable Object) ───

export async function districtHeartbeat(districtId: string): Promise<RoomState> {
    return writeApiFetch<RoomState>(`/api/districts/${encodeURIComponent(districtId)}/room/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({ sessionId: SESSION_ID }),
    });
}
