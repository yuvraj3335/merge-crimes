// ─── Merge Crimes — Worker API ───
// Hono router with Zod validation, D1 queries, CORS

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { seedDatabase } from './seed';
import { SEED_DISTRICTS } from '../../shared/seed/districts.ts';
import { REPO_FIXTURES } from '../../shared/seed/repoFixtures.ts';
import { generateCityFromRepo, generatedCityToDistricts, generatedCityToMissions, generatedCityToConflicts } from '../../shared/repoCityGenerator.ts';
import {
    normalizeGitHubRepoSnapshot,
    type GitHubRepoContentsResponse,
    type GitHubRepoLanguagesResponse,
    type GitHubRepoResponse,
} from './github/normalizeRepoSnapshot';
import { checkGitHubRepoRefresh } from './github/checkRepoRefresh';

// ─── Types ───
type Bindings = {
    DB: D1Database;
    // GITHUB_CACHE is not yet wired up in wrangler.toml — caching is unimplemented.
    // Uncomment after: npx wrangler kv namespace create GITHUB_CACHE
    // GITHUB_CACHE?: KVNamespace;
    LEADERBOARD?: KVNamespace;
    EVENTS?: KVNamespace;
    DISTRICT_ROOM?: DurableObjectNamespace;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_OAUTH_SCOPE?: string;
    PUBLIC_SESSION_SECRET?: string;
    PUBLIC_ORIGIN_ALLOWLIST?: string;
    ADMIN_SEED_SECRET?: string;
};

interface RoomResponse {
    presenceCount: number;
    captureProgress: number;
}

type RoomSessions = Record<string, number>;
type MissionSessionStatus = 'active' | 'completed';

type AppContext = Context<{ Bindings: Bindings }>;

interface PublicSessionTokenPayload {
    v: 1;
    type: 'public-write';
    sid: string;
    iat: number;
    exp: number;
    fp: string;
}

interface PublicSessionResponse {
    token: string;
    expiresAt: string;
    sessionId: string;
}

interface GitHubAccessTokenResponse {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
}

interface GitHubApiErrorResponse {
    message?: string;
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

async function signOAuthState(nonce: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        TEXT_ENCODER.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, TEXT_ENCODER.encode(nonce));
    const sigHex = Array.from(new Uint8Array(sigBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return `${nonce}.${sigHex}`;
}

async function verifyOAuthState(state: string, secret: string): Promise<boolean> {
    const dotIdx = state.indexOf('.');
    if (dotIdx < 1) {
        return false;
    }
    const nonce = state.slice(0, dotIdx);
    const expected = await signOAuthState(nonce, secret);
    return expected === state;
}
const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const LOCAL_DEV_PUBLIC_SESSION_SECRET = 'merge-crimes-local-dev-public-session';
const DEFAULT_GITHUB_CLIENT_ID_PLACEHOLDER = 'replace-with-github-client-id';
const DEFAULT_GITHUB_OAUTH_SCOPE = 'public_repo';
const GITHUB_API_ACCEPT = 'application/vnd.github+json';
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_API_USER_AGENT = 'merge-crimes-worker';
const LOCAL_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
];
const PUBLIC_WRITE_SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const PUBLIC_SESSION_ID_HEADER = 'X-Merge-Session-Id';
const ADMIN_SEED_SECRET_HEADER = 'X-Admin-Seed-Secret';
const MISSION_CAPTURE_INCREMENT = 25;
const MISSION_FACTION_REWARD_COOLDOWN_MINUTES = 30;
const MAX_CAPTURE_INCREMENT = 25;
const WALK_CAPTURE_PER_HEARTBEAT = 2; // capture points added per presence heartbeat (~10s interval)
const MISSION_SELECT_COLUMNS = `
    m.id,
    m.title,
    m.description,
    m.type,
    m.district_id,
    m.difficulty,
    m.time_limit,
    m.reward,
    m.faction_reward,
    COALESCE(ms.status, m.status) AS status,
    m.objectives_json,
    m.waypoints_json
`;

function doJson(data: unknown, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(data), { ...init, headers });
}

function addMinutesToIso(isoString: string, minutes: number): string {
    return new Date(Date.parse(isoString) + (minutes * 60_000)).toISOString();
}

function subtractMinutesFromIso(isoString: string, minutes: number): string {
    return new Date(Date.parse(isoString) - (minutes * 60_000)).toISOString();
}

function isLocalHostname(hostname: string): boolean {
    return LOCAL_DEV_HOSTNAMES.has(hostname);
}

function getConfiguredOrigins(env: Bindings): string[] {
    return env.PUBLIC_ORIGIN_ALLOWLIST
        ?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? [];
}

function getAllowedOrigins(env: Bindings, requestUrl: URL): Set<string> {
    const configuredOrigins = getConfiguredOrigins(env);
    const origins = new Set(configuredOrigins.length > 0 ? configuredOrigins : LOCAL_DEV_ORIGINS);
    origins.add(requestUrl.origin);
    configuredOrigins.forEach((origin) => origins.add(origin));
    return origins;
}

function isAllowedOrigin(request: Request, env: Bindings): boolean {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (!origin) {
        return isLocalHostname(requestUrl.hostname) && getConfiguredOrigins(env).length === 0;
    }

    return getAllowedOrigins(env, requestUrl).has(origin);
}

function getPublicSessionSecret(c: AppContext): string | null {
    const configuredSecret = c.env.PUBLIC_SESSION_SECRET?.trim();
    if (configuredSecret) {
        return configuredSecret;
    }

    const hostname = new URL(c.req.url).hostname;
    if (isLocalHostname(hostname)) {
        return LOCAL_DEV_PUBLIC_SESSION_SECRET;
    }

    return null;
}

function getGitHubClientId(env: Bindings): string {
    return env.GITHUB_CLIENT_ID?.trim() || DEFAULT_GITHUB_CLIENT_ID_PLACEHOLDER;
}

function getGitHubClientSecret(env: Bindings): string | null {
    const secret = env.GITHUB_CLIENT_SECRET?.trim();
    return secret ? secret : null;
}

function getGitHubOAuthScope(env: Bindings): string {
    return env.GITHUB_OAUTH_SCOPE?.trim() || DEFAULT_GITHUB_OAUTH_SCOPE;
}

function getGitHubRepoRequestHeaders(accessToken?: string | null): HeadersInit {
    const headers: HeadersInit = {
        Accept: GITHUB_API_ACCEPT,
        'User-Agent': GITHUB_API_USER_AGENT,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
    };

    if (!accessToken) {
        return headers;
    }

    return {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
    };
}

function isGitHubApiErrorResponse(value: unknown): value is GitHubApiErrorResponse {
    return value !== null
        && typeof value === 'object'
        && 'message' in value
        && typeof (value as GitHubApiErrorResponse).message === 'string';
}

async function fetchGitHubJson<T>(url: string, accessToken?: string | null): Promise<
    { ok: true; data: T }
    | { ok: false; status: number; message: string }
> {
    const response = await fetch(url, {
        headers: getGitHubRepoRequestHeaders(accessToken),
    });

    const contentType = response.headers.get('Content-Type') ?? '';
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = isGitHubApiErrorResponse(payload)
            ? payload.message ?? `GitHub request failed with status ${response.status}`
            : typeof payload === 'string' && payload.trim().length > 0
                ? payload
                : `GitHub request failed with status ${response.status}`;
        return {
            ok: false,
            status: response.status,
            message,
        };
    }

    return {
        ok: true,
        data: payload as T,
    };
}

function getGitHubAccessTokenFromAuthorizationHeader(authorizationHeader?: string | null): string | null {
    return authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.slice('Bearer '.length).trim()
        : null;
}

async function fetchGitHubRepoMetadataSnapshot(owner: string, name: string, accessToken?: string | null) {
    const repoPath = `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    const repoResponse = await fetchGitHubJson<GitHubRepoResponse>(`https://api.github.com/repos/${repoPath}`, accessToken);
    if (!repoResponse.ok) {
        const status: 404 | 502 = repoResponse.status === 404 ? 404 : 502;
        return {
            ok: false as const,
            status,
            body: {
                error: status === 404 ? 'github_repo_not_found' : 'github_repo_fetch_failed',
                message: repoResponse.message,
                owner,
                name,
            },
        };
    }

    const [languagesResponse, contentsResponse] = await Promise.all([
        fetchGitHubJson<GitHubRepoLanguagesResponse>(`https://api.github.com/repos/${repoPath}/languages`, accessToken),
        fetchGitHubJson<GitHubRepoContentsResponse>(`https://api.github.com/repos/${repoPath}/contents`, accessToken),
    ]);

    if (!languagesResponse.ok) {
        return {
            ok: false as const,
            status: 502 as const,
            body: {
                error: 'github_repo_languages_fetch_failed',
                message: languagesResponse.message,
                owner,
                name,
            },
        };
    }

    const snapshot = await normalizeGitHubRepoSnapshot({
        repo: repoResponse.data,
        languages: languagesResponse.data,
        contents: contentsResponse.ok ? contentsResponse.data : undefined,
        fetchGitHubJson: <T>(url: string) => fetchGitHubJson<T>(url, accessToken),
    });

    return {
        ok: true as const,
        snapshot,
    };
}

function isAllowedRedirectUri(request: Request, env: Bindings, redirectUri: string): boolean {
    let parsedRedirectUri: URL;
    try {
        parsedRedirectUri = new URL(redirectUri);
    } catch {
        return false;
    }

    return getAllowedOrigins(env, new URL(request.url)).has(parsedRedirectUri.origin);
}

function getRequestFingerprintSource(request: Request): string {
    const ip = request.headers.get('CF-Connecting-IP')
        ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
        ?? 'local';
    const userAgent = request.headers.get('User-Agent') ?? 'unknown';
    return `${ip}|${userAgent}`;
}

function uint8ArrayToBase64Url(value: Uint8Array): string {
    let binary = '';
    value.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/u, '');
}

function stringToBase64Url(value: string): string {
    return uint8ArrayToBase64Url(TEXT_ENCODER.encode(value));
}

function base64UrlToUint8Array(value: string): Uint8Array {
    const padded = value
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function base64UrlToString(value: string): string {
    return TEXT_DECODER.decode(base64UrlToUint8Array(value));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        TEXT_ENCODER.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
    );
}

async function signValue(secret: string, value: string): Promise<string> {
    const key = await importHmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, TEXT_ENCODER.encode(value));
    return uint8ArrayToBase64Url(new Uint8Array(signature));
}

async function verifyValue(secret: string, value: string, signature: string): Promise<boolean> {
    const key = await importHmacKey(secret);
    return crypto.subtle.verify(
        'HMAC',
        key,
        base64UrlToUint8Array(signature),
        TEXT_ENCODER.encode(value),
    );
}

async function buildRequestFingerprint(request: Request, secret: string): Promise<string> {
    return signValue(secret, getRequestFingerprintSource(request));
}

async function createPublicSessionToken(
    request: Request,
    secret: string,
    sessionId: string,
): Promise<PublicSessionResponse> {
    const now = Date.now();
    const payload: PublicSessionTokenPayload = {
        v: 1,
        type: 'public-write',
        sid: sessionId,
        iat: now,
        exp: now + PUBLIC_WRITE_SESSION_TTL_MS,
        fp: await buildRequestFingerprint(request, secret),
    };

    const encodedPayload = stringToBase64Url(JSON.stringify(payload));
    const signature = await signValue(secret, encodedPayload);

    return {
        token: `${encodedPayload}.${signature}`,
        expiresAt: new Date(payload.exp).toISOString(),
        sessionId,
    };
}

async function verifyPublicSessionToken(
    request: Request,
    secret: string,
    token: string,
): Promise<{ ok: true; payload: PublicSessionTokenPayload } | { ok: false; message: string }> {
    const parts = token.split('.');
    if (parts.length !== 2) {
        return { ok: false, message: 'Malformed session token' };
    }

    const [encodedPayload, signature] = parts;

    let isSignatureValid = false;
    try {
        isSignatureValid = await verifyValue(secret, encodedPayload, signature);
    } catch {
        return { ok: false, message: 'Malformed session token' };
    }

    if (!isSignatureValid) {
        return { ok: false, message: 'Invalid session token signature' };
    }

    let payload: PublicSessionTokenPayload;
    try {
        payload = JSON.parse(base64UrlToString(encodedPayload)) as PublicSessionTokenPayload;
    } catch {
        return { ok: false, message: 'Unreadable session token payload' };
    }

    if (payload.v !== 1 || payload.type !== 'public-write') {
        return { ok: false, message: 'Unsupported session token type' };
    }

    if (payload.exp <= Date.now()) {
        return { ok: false, message: 'Session token has expired' };
    }

    const expectedFingerprint = await buildRequestFingerprint(request, secret);
    if (payload.fp !== expectedFingerprint) {
        return { ok: false, message: 'Session fingerprint mismatch' };
    }

    return { ok: true, payload };
}

async function parseJsonBody<T>(
    c: AppContext,
    schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return { ok: false, response: c.json({ error: 'invalid_json', message: 'Request body must be valid JSON' }, 400) };
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return {
            ok: false,
            response: c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400),
        };
    }

    return { ok: true, data: parsed.data };
}

async function requireDistrictId(c: AppContext): Promise<{ ok: true; districtId: string } | { ok: false; response: Response }> {
    const parsed = DistrictIdParam.safeParse({ id: c.req.param('id') });
    if (!parsed.success) {
        return { ok: false, response: c.json({ error: 'invalid_param', details: parsed.error.flatten() }, 400) };
    }

    const district = await c.env.DB.prepare('SELECT id FROM districts WHERE id = ?')
        .bind(parsed.data.id)
        .first<{ id: string }>();

    if (!district) {
        return { ok: false, response: c.json({ error: 'not_found', message: `District '${parsed.data.id}' not found` }, 404) };
    }

    return { ok: true, districtId: district.id };
}

async function requirePublicWriteSession(
    c: AppContext,
    expectedSessionId?: string,
): Promise<{ ok: true; sessionId: string } | { ok: false; response: Response }> {
    if (!isAllowedOrigin(c.req.raw, c.env)) {
        return {
            ok: false,
            response: c.json({ error: 'forbidden_origin', message: 'Origin is not allowed for write access' }, 403),
        };
    }

    const secret = getPublicSessionSecret(c);
    if (!secret) {
        return {
            ok: false,
            response: c.json({ error: 'write_session_unavailable', message: 'PUBLIC_SESSION_SECRET is required outside local development' }, 503),
        };
    }

    const headerSessionId = c.req.header(PUBLIC_SESSION_ID_HEADER);
    if (!headerSessionId) {
        return {
            ok: false,
            response: c.json({ error: 'missing_session_id', message: `${PUBLIC_SESSION_ID_HEADER} header is required` }, 401),
        };
    }

    if (expectedSessionId && expectedSessionId !== headerSessionId) {
        return {
            ok: false,
            response: c.json({ error: 'session_mismatch', message: 'Session header does not match request body' }, 401),
        };
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return {
            ok: false,
            response: c.json({ error: 'missing_session_token', message: 'Bearer session token is required' }, 401),
        };
    }

    const verification = await verifyPublicSessionToken(c.req.raw, secret, authHeader.slice('Bearer '.length).trim());
    if (!verification.ok) {
        return {
            ok: false,
            response: c.json({ error: 'invalid_session_token', message: verification.message }, 401),
        };
    }

    if (verification.payload.sid !== headerSessionId) {
        return {
            ok: false,
            response: c.json({ error: 'session_mismatch', message: 'Session token does not match session header' }, 401),
        };
    }

    return { ok: true, sessionId: verification.payload.sid };
}

async function incrementDistrictCapture(
    doNs: DurableObjectNamespace | undefined,
    districtId: string,
    amount: number,
): Promise<void> {
    if (!doNs) {
        return;
    }

    const stub = doNs.get(doNs.idFromName(districtId));
    const response = await stub.fetch(new Request('http://do/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
    }));

    if (!response.ok) {
        throw new Error(`District capture update failed with status ${response.status}`);
    }
}

async function resetDistrictRooms(doNs: DurableObjectNamespace | undefined): Promise<void> {
    if (!doNs) {
        return;
    }

    await Promise.all(
        SEED_DISTRICTS.map(async (district) => {
            const stub = doNs.get(doNs.idFromName(district.id));
            const response = await stub.fetch(new Request('http://do/reset', { method: 'POST' }));

            if (!response.ok) {
                throw new Error(`District room reset failed for '${district.id}' with status ${response.status}`);
            }
        }),
    );
}

function isSeedRouteAuthorized(c: AppContext): boolean {
    const hostname = new URL(c.req.url).hostname;
    if (isLocalHostname(hostname)) {
        return true;
    }

    const configuredSecret = c.env.ADMIN_SEED_SECRET?.trim();
    const providedSecret = c.req.header(ADMIN_SEED_SECRET_HEADER)?.trim();
    return Boolean(configuredSecret && providedSecret && configuredSecret === providedSecret);
}

const app = new Hono<{ Bindings: Bindings }>();

// ─── Middleware ───
app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', PUBLIC_SESSION_ID_HEADER, ADMIN_SEED_SECRET_HEADER],
}));

// ─── Zod Schemas ───
const MissionIdParam = z.object({ id: z.string().min(1) });
const DistrictIdParam = z.object({ id: z.string().min(1) });
const GitHubAuthStartQuery = z.object({
    redirectUri: z.string().url(),
    state: z.string().min(1).max(512),
});
const GitHubTokenExchangeBody = z.object({
    code: z.string().min(1),
    redirectUri: z.string().url(),
    state: z.string().min(1).max(1024).optional(),
});
const GitHubRepoMetadataQuery = z.object({
    owner: z.string().trim().min(1),
    name: z.string().trim().min(1),
});
const RefreshRepoBody = z.object({
    owner: z.string().trim().min(1),
    name: z.string().trim().min(1),
});
const RepoRefreshCheckBody = z.object({
    owner: z.string().trim().min(1),
    name: z.string().trim().min(1),
    defaultBranch: z.string().trim().min(1),
    lastKnownCommitSha: z.string().trim().min(1).nullable().optional(),
});
const MissionsQuery = z.object({
    district: z.string().optional(),
    sessionId: z.string().uuid().optional(),
});
const SessionBody = z.object({ sessionId: z.string().uuid() });
const RoomHeartbeatBody = z.object({ sessionId: z.string().uuid() });
const RoomCaptureBody = z.object({ amount: z.number().int().positive().max(MAX_CAPTURE_INCREMENT) });

// ─── DB Row → API Response Helpers ───
function rowToDistrict(row: Record<string, unknown>) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        emissive: row.emissive,
        position: [row.pos_x, row.pos_z] as [number, number],
        size: [row.size_w, row.size_d] as [number, number],
        faction: row.faction,
        heatLevel: row.heat_level,
        repoSource: row.repo_json ? JSON.parse(row.repo_json as string) : undefined,
        missionIds: JSON.parse(row.mission_ids_json as string),
    };
}

function rowToMission(row: Record<string, unknown>) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type,
        districtId: row.district_id,
        difficulty: row.difficulty,
        timeLimit: row.time_limit,
        reward: row.reward,
        factionReward: row.faction_reward,
        status: row.status,
        objectives: JSON.parse(row.objectives_json as string),
        waypoints: JSON.parse(row.waypoints_json as string),
    };
}

function rowToEvent(row: Record<string, unknown>) {
    return {
        id: row.id,
        headline: row.headline,
        description: row.description,
        districtId: row.district_id,
        severity: row.severity,
        timestamp: row.timestamp,
        effects: JSON.parse(row.effects_json as string),
    };
}

function rowToConflict(row: Record<string, unknown>) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        difficulty: row.difficulty,
        timeLimit: row.time_limit,
        districtId: row.district_id,
        reward: row.reward,
        hunks: JSON.parse(row.hunks_json as string),
        correctOrder: JSON.parse(row.correct_order_json as string),
    };
}

function bindPreparedStatement(statement: D1PreparedStatement, values: unknown[]): D1PreparedStatement {
    return values.length > 0 ? statement.bind(...values) : statement;
}

async function listMissionRows(
    db: D1Database,
    filters: { districtId?: string; sessionId?: string },
): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [];
    let sql = `SELECT ${MISSION_SELECT_COLUMNS} FROM missions m`;

    if (filters.sessionId) {
        sql += ' LEFT JOIN mission_sessions ms ON ms.mission_id = m.id AND ms.session_id = ?';
        params.push(filters.sessionId);
    } else {
        sql += ' LEFT JOIN mission_sessions ms ON 1 = 0';
    }

    if (filters.districtId) {
        sql += ' WHERE m.district_id = ?';
        params.push(filters.districtId);
    }

    sql += ' ORDER BY m.id';

    const statement = bindPreparedStatement(db.prepare(sql), params);
    const { results } = await statement.all<Record<string, unknown>>();
    return results;
}

async function getMissionRow(
    db: D1Database,
    missionId: string,
    sessionId?: string,
): Promise<Record<string, unknown> | null> {
    const params: unknown[] = [];
    let sql = `SELECT ${MISSION_SELECT_COLUMNS} FROM missions m`;

    if (sessionId) {
        sql += ' LEFT JOIN mission_sessions ms ON ms.mission_id = m.id AND ms.session_id = ?';
        params.push(sessionId);
    } else {
        sql += ' LEFT JOIN mission_sessions ms ON 1 = 0';
    }

    sql += ' WHERE m.id = ?';
    params.push(missionId);

    const statement = bindPreparedStatement(db.prepare(sql), params);
    return statement.first<Record<string, unknown>>();
}

// ══════════════════════════════════════
// ─── ROUTES ───
// ══════════════════════════════════════

// ─── Health ───
app.get('/api/health', (c) => {
    return c.json({
        status: 'ok',
        game: 'merge-crimes',
        version: '0.2.0',
        timestamp: new Date().toISOString(),
    });
});

// ─── GitHub OAuth ───
app.get('/api/auth/github/start', async (c) => {
    const query = GitHubAuthStartQuery.safeParse({
        redirectUri: c.req.query('redirectUri'),
        state: c.req.query('state'),
    });
    if (!query.success) {
        return c.json({ error: 'invalid_query', details: query.error.flatten() }, 400);
    }

    if (!isAllowedRedirectUri(c.req.raw, c.env, query.data.redirectUri)) {
        return c.json({ error: 'forbidden_redirect_uri', message: 'Redirect URI origin is not allowed' }, 403);
    }

    // Sign the client-supplied nonce so /token can verify it wasn't forged.
    const secret = getPublicSessionSecret(c);
    const signedState = secret
        ? await signOAuthState(query.data.state, secret)
        : query.data.state;

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', getGitHubClientId(c.env));
    authorizeUrl.searchParams.set('redirect_uri', query.data.redirectUri);
    authorizeUrl.searchParams.set('state', signedState);

    const scope = getGitHubOAuthScope(c.env);
    if (scope) {
        authorizeUrl.searchParams.set('scope', scope);
    }

    return c.redirect(authorizeUrl.toString(), 302);
});

app.post('/api/auth/github/token', async (c) => {
    const parsed = await parseJsonBody(c, GitHubTokenExchangeBody);
    if (!parsed.ok) {
        return parsed.response;
    }

    if (!isAllowedRedirectUri(c.req.raw, c.env, parsed.data.redirectUri)) {
        return c.json({ error: 'forbidden_redirect_uri', message: 'Redirect URI origin is not allowed' }, 403);
    }

    // Verify the signed state when a secret is configured (rejects forged states).
    const sessionSecret = getPublicSessionSecret(c);
    if (sessionSecret) {
        if (!parsed.data.state) {
            return c.json({ error: 'missing_state', message: 'OAuth state parameter is required.' }, 400);
        }
        if (!(await verifyOAuthState(parsed.data.state, sessionSecret))) {
            return c.json({ error: 'invalid_state', message: 'OAuth state parameter signature is invalid.' }, 400);
        }
    }

    const clientSecret = getGitHubClientSecret(c.env);
    if (!clientSecret) {
        return c.json({
            error: 'github_oauth_unconfigured',
            message: 'GITHUB_CLIENT_SECRET must be configured to exchange GitHub OAuth codes.',
        }, 503);
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: getGitHubClientId(c.env),
            client_secret: clientSecret,
            code: parsed.data.code,
            redirect_uri: parsed.data.redirectUri,
        }),
    });

    const payload = await response.json() as GitHubAccessTokenResponse;
    if (!response.ok || payload.error || !payload.access_token) {
        const status = response.ok ? 502 : 400;
        return c.json({
            error: 'github_oauth_exchange_failed',
            message: payload.error_description ?? payload.error ?? 'GitHub did not return an access token.',
        }, status);
    }

    return c.json({
        accessToken: payload.access_token,
        tokenType: payload.token_type ?? 'bearer',
        scope: payload.scope ?? getGitHubOAuthScope(c.env),
    });
});

app.get('/api/github/repo-metadata', async (c) => {
    const query = GitHubRepoMetadataQuery.safeParse({
        owner: c.req.query('owner'),
        name: c.req.query('name'),
    });
    if (!query.success) {
        return c.json({ error: 'invalid_query', details: query.error.flatten() }, 400);
    }

    const accessToken = getGitHubAccessTokenFromAuthorizationHeader(c.req.header('Authorization'));
    const result = await fetchGitHubRepoMetadataSnapshot(query.data.owner, query.data.name, accessToken);
    if (!result.ok) {
        return c.json(result.body, result.status);
    }

    return c.json(result.snapshot);
});

app.post('/api/refresh-repo', async (c) => {
    const parsed = await parseJsonBody(c, RefreshRepoBody);
    if (!parsed.ok) {
        return parsed.response;
    }

    const accessToken = getGitHubAccessTokenFromAuthorizationHeader(c.req.header('Authorization'));
    console.log('[MergeCrimes] Manual repo refresh requested', {
        owner: parsed.data.owner,
        name: parsed.data.name,
        authenticated: Boolean(accessToken),
    });

    const result = await fetchGitHubRepoMetadataSnapshot(parsed.data.owner, parsed.data.name, accessToken);
    if (!result.ok) {
        return c.json(result.body, result.status);
    }

    return c.json({
        message: 'Repo refresh completed.',
        snapshot: result.snapshot,
    });
});

app.post('/api/github/repo-refresh-status', async (c) => {
    const parsed = await parseJsonBody(c, RepoRefreshCheckBody);
    if (!parsed.ok) {
        return parsed.response;
    }

    const accessToken = getGitHubAccessTokenFromAuthorizationHeader(c.req.header('Authorization'));
    const result = await checkGitHubRepoRefresh({
        ...parsed.data,
        fetchGitHubJson: <T>(url: string) => fetchGitHubJson<T>(url, accessToken),
    });

    if (!result.ok) {
        return c.json(result.body, result.status);
    }

    return c.json(result.refreshCheck);
});

// ─── Anonymous Write Session ───
app.post('/api/session', async (c) => {
    if (!isAllowedOrigin(c.req.raw, c.env)) {
        return c.json({ error: 'forbidden_origin', message: 'Origin is not allowed to mint a write session' }, 403);
    }

    const secret = getPublicSessionSecret(c);
    if (!secret) {
        return c.json({ error: 'write_session_unavailable', message: 'PUBLIC_SESSION_SECRET is required outside local development' }, 503);
    }

    const parsed = await parseJsonBody(c, SessionBody);
    if (!parsed.ok) {
        return parsed.response;
    }

    const session = await createPublicSessionToken(c.req.raw, secret, parsed.data.sessionId);
    return c.json(session);
});

// ─── City Summary ───
app.get('/api/city', async (c) => {
    const db = c.env.DB;
    const [districts, missions, factions, events] = await Promise.all([
        db.prepare('SELECT COUNT(*) as count FROM districts').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM mission_sessions WHERE status = ?').bind('active').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM factions').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM events').first<{ count: number }>(),
    ]);

    return c.json({
        name: 'Merge City',
        districts: districts?.count ?? 0,
        factions: factions?.count ?? 0,
        activeMissions: missions?.count ?? 0,
        activeEvents: events?.count ?? 0,
        status: 'operational',
    });
});

// ─── Districts ───
app.get('/api/districts', async (c) => {
    const db = c.env.DB;
    const { results } = await db.prepare('SELECT * FROM districts').all();
    return c.json(results.map(rowToDistrict));
});

app.get('/api/districts/:id', async (c) => {
    const parsed = DistrictIdParam.safeParse({ id: c.req.param('id') });
    if (!parsed.success) {
        return c.json({ error: 'invalid_param', details: parsed.error.flatten() }, 400);
    }

    const db = c.env.DB;
    const row = await db.prepare('SELECT * FROM districts WHERE id = ?').bind(parsed.data.id).first();
    if (!row) {
        return c.json({ error: 'not_found', message: `District '${parsed.data.id}' not found` }, 404);
    }

    return c.json(rowToDistrict(row));
});

// ─── Missions ───
app.get('/api/missions', async (c) => {
    const query = MissionsQuery.safeParse({
        district: c.req.query('district'),
        sessionId: c.req.query('sessionId'),
    });
    if (!query.success) {
        return c.json({ error: 'invalid_query', details: query.error.flatten() }, 400);
    }

    const db = c.env.DB;
    const results = await listMissionRows(db, {
        districtId: query.data.district,
        sessionId: query.data.sessionId,
    });

    return c.json(results.map(rowToMission));
});

app.post('/api/missions/:id/accept', async (c) => {
    const parsed = MissionIdParam.safeParse({ id: c.req.param('id') });
    if (!parsed.success) {
        return c.json({ error: 'invalid_param', details: parsed.error.flatten() }, 400);
    }

    const publicSession = await requirePublicWriteSession(c);
    if (!publicSession.ok) {
        return publicSession.response;
    }

    const db = c.env.DB;
    const mission = await db.prepare('SELECT * FROM missions WHERE id = ?').bind(parsed.data.id).first();
    if (!mission) {
        return c.json({ error: 'not_found', message: `Mission '${parsed.data.id}' not found` }, 404);
    }
    if (mission.status !== 'available') {
        return c.json({ error: 'conflict', message: `Mission definition is '${mission.status}', not deployable` }, 409);
    }

    const currentMission = await db
        .prepare('SELECT status FROM mission_sessions WHERE session_id = ? AND mission_id = ?')
        .bind(publicSession.sessionId, parsed.data.id)
        .first<{ status: MissionSessionStatus }>();

    if (currentMission?.status === 'active') {
        return c.json({ error: 'conflict', message: 'Mission is already active for this session' }, 409);
    }
    if (currentMission?.status === 'completed') {
        return c.json({ error: 'conflict', message: 'Mission is already completed for this session' }, 409);
    }

    const activeMission = await db
        .prepare('SELECT mission_id as missionId FROM mission_sessions WHERE session_id = ? AND status = ? LIMIT 1')
        .bind(publicSession.sessionId, 'active')
        .first<{ missionId: string }>();

    if (activeMission && activeMission.missionId !== parsed.data.id) {
        return c.json({ error: 'conflict', message: 'Only one active mission is allowed per session' }, 409);
    }

    await db.prepare(
        `INSERT INTO mission_sessions (session_id, mission_id, status, accepted_at, completed_at, updated_at)
         VALUES (?, ?, 'active', datetime('now'), NULL, datetime('now'))
         ON CONFLICT(session_id, mission_id)
         DO UPDATE SET status = 'active', accepted_at = datetime('now'), completed_at = NULL, updated_at = datetime('now')`
    ).bind(publicSession.sessionId, parsed.data.id).run();

    const updated = await getMissionRow(db, parsed.data.id, publicSession.sessionId);
    return c.json(rowToMission(updated!));
});

app.post('/api/missions/:id/complete', async (c) => {
    const parsed = MissionIdParam.safeParse({ id: c.req.param('id') });
    if (!parsed.success) {
        return c.json({ error: 'invalid_param', details: parsed.error.flatten() }, 400);
    }

    const publicSession = await requirePublicWriteSession(c);
    if (!publicSession.ok) {
        return publicSession.response;
    }

    const db = c.env.DB;
    const mission = await db.prepare('SELECT * FROM missions WHERE id = ?').bind(parsed.data.id).first();
    if (!mission) {
        return c.json({ error: 'not_found', message: `Mission '${parsed.data.id}' not found` }, 404);
    }

    const currentMission = await db
        .prepare('SELECT status FROM mission_sessions WHERE session_id = ? AND mission_id = ?')
        .bind(publicSession.sessionId, parsed.data.id)
        .first<{ status: MissionSessionStatus }>();

    if (currentMission?.status !== 'active') {
        return c.json({ error: 'conflict', message: 'Mission must be active for this session before completion' }, 409);
    }

    // Complete mission + update faction score if the global mission reward cooldown allows it.
    const factionReward = mission.faction_reward as number;
    const districtId = mission.district_id as string;

    // Get the faction that controls this district
    const district = await db.prepare('SELECT faction FROM districts WHERE id = ?').bind(districtId).first();
    const factionId = district?.faction as string;

    const rewardedAt = new Date().toISOString();
    const rewardCooldownCutoff = subtractMinutesFromIso(rewardedAt, MISSION_FACTION_REWARD_COOLDOWN_MINUTES);

    await db
        .prepare(
            `UPDATE mission_sessions
             SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
             WHERE session_id = ? AND mission_id = ?`
        )
        .bind(publicSession.sessionId, parsed.data.id)
        .run();

    const rewardClaim = await db
        .prepare(
            `INSERT INTO mission_reward_claims (mission_id, last_rewarded_at)
             VALUES (?, ?)
             ON CONFLICT(mission_id) DO UPDATE
             SET last_rewarded_at = excluded.last_rewarded_at
             WHERE mission_reward_claims.last_rewarded_at <= ?
             RETURNING last_rewarded_at as lastRewardedAt`
        )
        .bind(parsed.data.id, rewardedAt, rewardCooldownCutoff)
        .first<{ lastRewardedAt: string }>();

    const factionRewardApplied = rewardClaim !== null;
    let nextEligibleAt = addMinutesToIso(rewardedAt, MISSION_FACTION_REWARD_COOLDOWN_MINUTES);

    if (factionRewardApplied) {
        await db.prepare('UPDATE factions SET score = score + ? WHERE id = ?').bind(factionReward, factionId).run();
        c.env.LEADERBOARD?.delete(LEADERBOARD_CACHE_KEY).catch(() => { /* cache invalidation failure is non-fatal */ });
    } else {
        const existingRewardClaim = await db
            .prepare('SELECT last_rewarded_at as lastRewardedAt FROM mission_reward_claims WHERE mission_id = ?')
            .bind(parsed.data.id)
            .first<{ lastRewardedAt: string }>();
        if (existingRewardClaim?.lastRewardedAt) {
            nextEligibleAt = addMinutesToIso(existingRewardClaim.lastRewardedAt, MISSION_FACTION_REWARD_COOLDOWN_MINUTES);
        }
    }

    incrementDistrictCapture(c.env.DISTRICT_ROOM, districtId, MISSION_CAPTURE_INCREMENT).catch(() => { /* DO sync failure is non-fatal */ });

    const updated = await getMissionRow(db, parsed.data.id, publicSession.sessionId);
    return c.json({
        mission: rowToMission(updated!),
        factionReward: {
            factionId,
            pointsAdded: factionRewardApplied ? factionReward : 0,
            rewardApplied: factionRewardApplied,
            cooldownMinutes: MISSION_FACTION_REWARD_COOLDOWN_MINUTES,
            nextEligibleAt,
        },
    });
});

app.post('/api/missions/:id/fail', async (c) => {
    const parsed = MissionIdParam.safeParse({ id: c.req.param('id') });
    if (!parsed.success) {
        return c.json({ error: 'invalid_param', details: parsed.error.flatten() }, 400);
    }

    const publicSession = await requirePublicWriteSession(c);
    if (!publicSession.ok) {
        return publicSession.response;
    }

    const db = c.env.DB;
    const mission = await db.prepare('SELECT id FROM missions WHERE id = ?').bind(parsed.data.id).first<{ id: string }>();
    if (!mission) {
        return c.json({ error: 'not_found', message: `Mission '${parsed.data.id}' not found` }, 404);
    }

    const currentMission = await db
        .prepare('SELECT status FROM mission_sessions WHERE session_id = ? AND mission_id = ?')
        .bind(publicSession.sessionId, parsed.data.id)
        .first<{ status: MissionSessionStatus }>();

    if (currentMission?.status !== 'active') {
        return c.json({ error: 'conflict', message: 'Mission must be active for this session before failure reset' }, 409);
    }

    await db
        .prepare('DELETE FROM mission_sessions WHERE session_id = ? AND mission_id = ?')
        .bind(publicSession.sessionId, parsed.data.id)
        .run();

    const updated = await getMissionRow(db, parsed.data.id, publicSession.sessionId);
    return c.json(rowToMission(updated!));
});

// ─── Leaderboard ───
const LEADERBOARD_CACHE_KEY = 'leaderboard_v1';
const LEADERBOARD_TTL_SECONDS = 60;

app.get('/api/leaderboard', async (c) => {
    // Cache-aside: try KV first (binding may be absent in early dev)
    const kv: KVNamespace | undefined = c.env.LEADERBOARD;
    if (kv) {
        const cached = await kv.get(LEADERBOARD_CACHE_KEY);
        if (cached) {
            return c.json(JSON.parse(cached), 200, { 'X-Cache': 'HIT' });
        }
    }

    const db = c.env.DB;
    const { results } = await db.prepare('SELECT * FROM factions ORDER BY score DESC').all();

    const leaderboard = results.map((row, i) => ({
        rank: i + 1,
        factionId: row.id,
        factionName: row.name,
        score: row.score,
        districtsControlled: row.districts_controlled,
        missionsCompleted: Math.floor((row.score as number) / 100),
    }));

    // Write-through to KV via waitUntil so the write completes after response is sent
    if (kv) {
        c.executionCtx.waitUntil(
            kv.put(LEADERBOARD_CACHE_KEY, JSON.stringify(leaderboard), {
                expirationTtl: LEADERBOARD_TTL_SECONDS,
            }).catch(() => { /* KV write failure is non-fatal */ })
        );
    }

    return c.json(leaderboard, 200, { 'X-Cache': 'MISS' });
});

// ─── Events ───
const EVENTS_CACHE_KEY = 'events_v1';
const EVENTS_TTL_SECONDS = 60;

app.get('/api/events', async (c) => {
    const kv: KVNamespace | undefined = c.env.EVENTS;
    if (kv) {
        const cached = await kv.get(EVENTS_CACHE_KEY);
        if (cached) {
            return c.json(JSON.parse(cached) as ReturnType<typeof rowToEvent>[], 200, { 'X-Cache': 'HIT' });
        }
    }

    const db = c.env.DB;
    const { results } = await db.prepare('SELECT * FROM events ORDER BY timestamp DESC').all();
    const events = results.map(rowToEvent);

    if (kv) {
        c.executionCtx.waitUntil(
            kv.put(EVENTS_CACHE_KEY, JSON.stringify(events), {
                expirationTtl: EVENTS_TTL_SECONDS,
            }).catch(() => { /* KV write failure is non-fatal */ })
        );
    }

    return c.json(events, 200, { 'X-Cache': 'MISS' });
});

// ─── Merge Conflicts ───
app.get('/api/conflicts', async (c) => {
    const db = c.env.DB;
    const { results } = await db.prepare('SELECT * FROM merge_conflicts').all();
    return c.json(results.map(rowToConflict));
});

// ─── District Room (Durable Object) ───

app.get('/api/districts/:id/room', async (c) => {
    const district = await requireDistrictId(c);
    if (!district.ok) {
        return district.response;
    }

    const doNs: DurableObjectNamespace | undefined = c.env.DISTRICT_ROOM;
    if (!doNs) return c.json({ presenceCount: 0, captureProgress: 0 } as RoomResponse);

    const stub = doNs.get(doNs.idFromName(district.districtId));
    const resp = await stub.fetch(new Request('http://do/room'));
    return c.json(await resp.json() as RoomResponse);
});

app.post('/api/districts/:id/room/heartbeat', async (c) => {
    const district = await requireDistrictId(c);
    if (!district.ok) {
        return district.response;
    }

    const parsed = await parseJsonBody(c, RoomHeartbeatBody);
    if (!parsed.ok) {
        return parsed.response;
    }

    const publicSession = await requirePublicWriteSession(c, parsed.data.sessionId);
    if (!publicSession.ok) {
        return publicSession.response;
    }

    const doNs: DurableObjectNamespace | undefined = c.env.DISTRICT_ROOM;
    if (!doNs) return c.json({ presenceCount: 0, captureProgress: 0 } as RoomResponse);

    const stub = doNs.get(doNs.idFromName(district.districtId));
    const resp = await stub.fetch(new Request('http://do/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
    }));
    return c.json(await resp.json() as RoomResponse);
});

// ─── Repo City ───

app.get('/api/repo-city/fixtures', (c) => {
    return c.json(REPO_FIXTURES.map((r) => ({
        repoId: r.repoId,
        owner: r.owner,
        name: r.name,
        archetype: r.archetype,
        moduleCount: r.modules.length,
        signalCount: r.signals.length,
    })));
});

app.get('/api/repo-city/generate/:repoId', (c) => {
    const repoId = c.req.param('repoId');
    const repo = REPO_FIXTURES.find((r) => r.repoId === repoId);
    if (!repo) {
        return c.json({ error: 'not_found', message: `Repo fixture '${repoId}' not found` }, 404);
    }

    const city = generateCityFromRepo(repo);
    return c.json({
        city,
        districts: generatedCityToDistricts(city),
        missions: generatedCityToMissions(city),
        conflicts: generatedCityToConflicts(city),
    });
});

// ─── Admin: Seed DB ───
app.post('/api/admin/seed', async (c) => {
    if (!isSeedRouteAuthorized(c)) {
        return c.json({
            error: 'seed_disabled',
            message: `Seed is only available on localhost or with ${ADMIN_SEED_SECRET_HEADER}`,
        }, 403);
    }

    const db = c.env.DB;
    try {
        const result = await seedDatabase(db);
        await resetDistrictRooms(c.env.DISTRICT_ROOM);
        c.env.LEADERBOARD?.delete(LEADERBOARD_CACHE_KEY).catch(() => { /* non-fatal */ });
        c.env.EVENTS?.delete(EVENTS_CACHE_KEY).catch(() => { /* non-fatal */ });
        return c.json({ status: 'seeded', ...result });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return c.json({ error: 'seed_failed', message }, 500);
    }
});

// ─── 404 Fallback ───
app.all('*', (c) => {
    return c.json(
        { error: 'not_found', message: `No route found for ${c.req.path}` },
        404
    );
});

export default app;

// ─── Durable Object: DistrictRoom ───
// Tracks per-district presence (ephemeral) and capture progress (durable)
export class DistrictRoom {
    private state: DurableObjectState;

    constructor(state: DurableObjectState) {
        this.state = state;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname === '/room') {
            return this.handleGetRoom();
        }
        if (request.method === 'POST' && url.pathname === '/heartbeat') {
            let body: unknown;
            try {
                body = await request.json();
            } catch {
                return doJson({ error: 'invalid_json' }, { status: 400 });
            }

            const parsed = RoomHeartbeatBody.safeParse(body);
            if (!parsed.success) {
                return doJson({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
            }

            return this.handleHeartbeat(parsed.data.sessionId);
        }
        if (request.method === 'POST' && url.pathname === '/capture') {
            let body: unknown;
            try {
                body = await request.json();
            } catch {
                return doJson({ error: 'invalid_json' }, { status: 400 });
            }

            const parsed = RoomCaptureBody.safeParse(body);
            if (!parsed.success) {
                return doJson({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
            }

            return this.handleCapture(parsed.data.amount);
        }
        if (request.method === 'POST' && url.pathname === '/reset') {
            return this.handleReset();
        }
        return doJson({ error: 'not_found' }, { status: 404 });
    }

    // Return only sessions seen within the last 30 seconds
    private async getActiveSessions(): Promise<RoomSessions> {
        const sessions = await this.state.storage.get<RoomSessions>('sessions') ?? {};
        const now = Date.now();
        const fresh: RoomSessions = {};
        for (const [id, ts] of Object.entries(sessions)) {
            if (now - ts < 30_000) fresh[id] = ts;
        }
        return fresh;
    }

    private async handleGetRoom(): Promise<Response> {
        const sessions = await this.getActiveSessions();
        const capture = await this.state.storage.get<number>('capture') ?? 0;
        const resp: RoomResponse = { presenceCount: Object.keys(sessions).length, captureProgress: capture };
        return doJson(resp);
    }

    private async handleHeartbeat(sessionId: string): Promise<Response> {
        const sessions = await this.getActiveSessions();
        sessions[sessionId] = Date.now();
        await this.state.storage.put('sessions', sessions);
        // Walk-up capture: each presence heartbeat contributes a small capture increment.
        const capture = await this.state.storage.get<number>('capture') ?? 0;
        const newCapture = Math.min(100, capture + WALK_CAPTURE_PER_HEARTBEAT);
        if (newCapture > capture) {
            await this.state.storage.put('capture', newCapture);
        }
        const resp: RoomResponse = { presenceCount: Object.keys(sessions).length, captureProgress: newCapture };
        return doJson(resp);
    }

    private async handleCapture(amount: number): Promise<Response> {
        const sessions = await this.getActiveSessions();
        const capture = await this.state.storage.get<number>('capture') ?? 0;
        const newCapture = Math.min(100, capture + amount);
        await this.state.storage.put('capture', newCapture);
        const resp: RoomResponse = { presenceCount: Object.keys(sessions).length, captureProgress: newCapture };
        return doJson(resp);
    }

    private async handleReset(): Promise<Response> {
        await this.state.storage.put('sessions', {});
        await this.state.storage.put('capture', 0);
        return doJson({ ok: true });
    }
}
