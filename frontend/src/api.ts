// ─── Merge Crimes — API Client ───
// Fetches game data from the Worker API with seed-data fallback

import type { GitHubRepoMetadataSnapshot } from '../../shared/repoModel';
import type { District, Mission, LeaderboardEntry, CityEvent, MergeConflictEncounter } from '../../shared/types';
import { getRuntimeApiBaseOverride } from './runtimeConfig';

const API_BASE = getRuntimeApiBaseOverride() ?? import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';
const WRITE_SESSION_REFRESH_BUFFER_MS = 60_000;
const SESSION_STORAGE_KEY = 'merge-crimes-session-id';
const GITHUB_OAUTH_STATE_STORAGE_KEY = 'merge-crimes-github-oauth-state';
export const GITHUB_OAUTH_CALLBACK_PATH = '/auth/github/callback';

export type ApiConnectionState = 'unknown' | 'online' | 'offline';
export type ApiWriteSessionState = 'unknown' | 'checking' | 'ready' | 'error';

export interface ApiRuntimeStatus {
    connectionState: ApiConnectionState;
    writeSessionState: ApiWriteSessionState;
    writeSessionMessage: string | null;
}

export interface GitHubTokenExchangeResponse {
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

export interface GitHubReadableRepoListResponse {
    repos: GitHubReadableRepo[];
    hasNextPage: boolean;
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
    writeSessionState: 'unknown',
    writeSessionMessage: null,
};
let publicWriteSession: PublicWriteSession | null = null;
let publicWriteSessionPromise: Promise<PublicWriteSession | null> | null = null;

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

async function request(path: string, options?: RequestInit): Promise<Response | null> {
    try {
        const headers = new Headers(options?.headers);
        if (options?.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
        });

        emitApiRuntimeStatus({ connectionState: 'online' });
        return res;
    } catch {
        emitApiRuntimeStatus({ connectionState: 'offline' });
        return null;
    }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
    const res = await request(path, options);
    if (!res?.ok) return null;
    return (await res.json()) as T;
}

function writeSessionIsFresh(session: PublicWriteSession): boolean {
    return Date.parse(session.expiresAt) - Date.now() > WRITE_SESSION_REFRESH_BUFFER_MS;
}

async function ensurePublicWriteSession(): Promise<PublicWriteSession | null> {
    if (publicWriteSession && writeSessionIsFresh(publicWriteSession)) {
        emitApiRuntimeStatus({ writeSessionState: 'ready', writeSessionMessage: null });
        return publicWriteSession;
    }

    if (!publicWriteSessionPromise) {
        emitApiRuntimeStatus({ writeSessionState: 'checking', writeSessionMessage: null });
        publicWriteSessionPromise = request('/api/session', {
            method: 'POST',
            body: JSON.stringify({ sessionId: SESSION_ID }),
        }).then(async (response) => {
            if (!response) {
                emitApiRuntimeStatus({
                    writeSessionState: 'error',
                    writeSessionMessage: 'Worker API unavailable. Public writes are running in local-only fallback mode.',
                });
                return null;
            }

            if (!response.ok) {
                emitApiRuntimeStatus({
                    writeSessionState: 'error',
                    writeSessionMessage: `Write-session mint failed (${response.status}). Check PUBLIC_SESSION_SECRET and PUBLIC_ORIGIN_ALLOWLIST.`,
                });
                return null;
            }

            const session = await response.json() as PublicWriteSession;
            publicWriteSession = session;
            emitApiRuntimeStatus({ writeSessionState: 'ready', writeSessionMessage: null });
            return session;
        }).finally(() => {
            publicWriteSessionPromise = null;
        });
    }

    return publicWriteSessionPromise;
}

async function writeApiFetch<T>(path: string, options?: RequestInit, allowRetry = true): Promise<T | null> {
    const session = await ensurePublicWriteSession();
    if (!session) {
        return null;
    }

    const headers = new Headers(options?.headers);
    headers.set('Authorization', `Bearer ${session.token}`);
    headers.set('X-Merge-Session-Id', SESSION_ID);

    const response = await request(path, {
        ...options,
        headers,
    });

    if (!response) {
        return null;
    }

    if (response.status === 401 && allowRetry) {
        publicWriteSession = null;
        emitApiRuntimeStatus({ writeSessionState: 'checking', writeSessionMessage: null });
        return writeApiFetch<T>(path, options, false);
    }

    if (!response.ok) {
        return null;
    }

    return (await response.json()) as T;
}

// ─── Read Endpoints ───

export async function fetchDistricts(): Promise<District[] | null> {
    return apiFetch<District[]>('/api/districts');
}

export async function fetchMissions(districtId?: string): Promise<Mission[] | null> {
    const params = new URLSearchParams({ sessionId: SESSION_ID });
    if (districtId) {
        params.set('district', districtId);
    }

    return apiFetch<Mission[]>(`/api/missions?${params.toString()}`);
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[] | null> {
    return apiFetch<LeaderboardEntry[]>('/api/leaderboard');
}

export async function fetchEvents(): Promise<CityEvent[] | null> {
    return apiFetch<CityEvent[]>('/api/events');
}

export async function fetchConflicts(): Promise<MergeConflictEncounter[] | null> {
    return apiFetch<MergeConflictEncounter[]>('/api/conflicts');
}

// ─── Write Endpoints ───

export async function acceptMission(id: string): Promise<Mission | null> {
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

export async function completeMission(id: string): Promise<CompleteMissionResult | null> {
    return writeApiFetch<CompleteMissionResult>(`/api/missions/${encodeURIComponent(id)}/complete`, { method: 'POST' });
}

export async function failMission(id: string): Promise<Mission | null> {
    return writeApiFetch<Mission>(`/api/missions/${encodeURIComponent(id)}/fail`, { method: 'POST' });
}

export async function seedDatabase(): Promise<{ status: string; inserted: Record<string, number> } | null> {
    return apiFetch<{ status: string; inserted: Record<string, number> }>('/api/admin/seed', { method: 'POST' });
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
        const expectedState = window.sessionStorage.getItem(GITHUB_OAUTH_STATE_STORAGE_KEY);
        window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_STORAGE_KEY);
        return !expectedState || expectedState === returnedState;
    } catch {
        return true;
    }
}

export async function exchangeGitHubOAuthCode(
    code: string,
    redirectUri: string,
): Promise<GitHubTokenExchangeResponse | null> {
    return apiFetch<GitHubTokenExchangeResponse>('/api/auth/github/token', {
        method: 'POST',
        body: JSON.stringify({ code, redirectUri }),
    });
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
): Promise<GitHubReadableRepoListResponse> {
    const response = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
        {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${accessToken}`,
                'X-GitHub-Api-Version': '2022-11-28',
            },
            signal,
        },
    );

    if (!response.ok) {
        let message = `GitHub repo fetch failed (${response.status}).`;

        try {
            const payload = await response.json() as { message?: string };
            if (payload.message) {
                message = payload.message;
            }
        } catch {
            // Keep the status-based fallback message.
        }

        throw new Error(message);
    }

    const payload = await response.json() as GitHubRepoApiResponse[];

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
    };
}

export async function fetchGitHubRepoMetadata(
    owner: string,
    name: string,
    signal?: AbortSignal,
    accessToken?: string,
): Promise<GitHubRepoMetadataSnapshot | null> {
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
    });
}

// ─── Health Check ───

export async function checkApiHealth(): Promise<boolean> {
    const result = await apiFetch<{ status: string }>('/api/health');
    return result?.status === 'ok';
}

export async function primePublicWriteSession(): Promise<boolean> {
    const session = await ensurePublicWriteSession();
    return session !== null;
}

// ─── District Room (Durable Object) ───

export async function fetchDistrictRoom(districtId: string): Promise<RoomState | null> {
    return apiFetch<RoomState>(`/api/districts/${encodeURIComponent(districtId)}/room`);
}

export async function districtHeartbeat(districtId: string): Promise<RoomState | null> {
    return writeApiFetch<RoomState>(`/api/districts/${encodeURIComponent(districtId)}/room/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({ sessionId: SESSION_ID }),
    });
}
