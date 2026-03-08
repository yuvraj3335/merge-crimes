import { spawn } from 'node:child_process';
import { access, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const FRONTEND_PORT = 4173;
const WORKER_PORT = 8791;
const OFFLINE_PORT = 8899;
const WORKER_BASE = `http://127.0.0.1:${WORKER_PORT}`;
const LOCALHOST_FRONTEND_BASE = `http://localhost:${FRONTEND_PORT}`;
const LOOPBACK_FRONTEND_BASE = `http://127.0.0.1:${FRONTEND_PORT}`;
const LOCALHOST_SMOKE_URL = `${LOCALHOST_FRONTEND_BASE}/?smoke=1&apiBase=${encodeURIComponent(WORKER_BASE)}`;
const LOOPBACK_SMOKE_URL = `${LOOPBACK_FRONTEND_BASE}/?smoke=1&apiBase=${encodeURIComponent(WORKER_BASE)}`;
const OFFLINE_SMOKE_URL = `${LOCALHOST_FRONTEND_BASE}/?smoke=1&apiBase=${encodeURIComponent(`http://127.0.0.1:${OFFLINE_PORT}`)}`;
const __filename = fileURLToPath(import.meta.url);
const frontendDir = path.resolve(path.dirname(__filename), '..');
const repoDir = path.resolve(frontendDir, '..');
const workerDir = path.resolve(repoDir, 'worker');
const workerDevVarsPath = path.join(workerDir, '.dev.vars');

function logStep(message) {
    console.log(`[browser:smoke] ${message}`);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function pathExists(targetPath) {
    try {
        await access(targetPath);
        return true;
    } catch {
        return false;
    }
}

function createManagedProcess(command, args, options) {
    const child = spawn(command, args, {
        cwd: options.cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = [];

    const capture = (streamName) => (chunk) => {
        const text = chunk.toString();
        for (const rawLine of text.split('\n')) {
            const line = rawLine.trimEnd();
            if (!line) {
                continue;
            }
            lines.push(`[${options.label}:${streamName}] ${line}`);
        }

        if (lines.length > 250) {
            lines.splice(0, lines.length - 250);
        }
    };

    child.stdout.on('data', capture('stdout'));
    child.stderr.on('data', capture('stderr'));

    return {
        child,
        label: options.label,
        getLogs: () => lines.join('\n'),
    };
}

async function stopManagedProcess(processHandle) {
    if (!processHandle || processHandle.child.exitCode !== null) {
        return;
    }

    processHandle.child.kill('SIGTERM');

    const didExit = await Promise.race([
        new Promise((resolve) => processHandle.child.once('exit', () => resolve(true))),
        sleep(3_000).then(() => false),
    ]);

    if (!didExit) {
        processHandle.child.kill('SIGKILL');
        await new Promise((resolve) => processHandle.child.once('exit', resolve));
    }
}

async function runCommand(command, args, options) {
    const processHandle = createManagedProcess(command, args, options);

    const exitCode = await new Promise((resolve, reject) => {
        processHandle.child.once('error', reject);
        processHandle.child.once('exit', resolve);
    });

    if (exitCode !== 0) {
        throw new Error(`${options.label} exited with code ${exitCode}\n${processHandle.getLogs()}`);
    }
}

async function waitForHttp(url, validate, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    let lastDetail = 'no response';

    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (await validate(response)) {
                return response;
            }
            lastDetail = `HTTP ${response.status}`;
        } catch (error) {
            lastDetail = error instanceof Error ? error.message : String(error);
        }

        await sleep(500);
    }

    throw new Error(`Timed out waiting for ${url}: ${lastDetail}`);
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Unexpected response ${response.status} for ${url}`);
    }
    return response.json();
}

async function fetchFactionScore(factionId) {
    const leaderboard = await fetchJson(`${WORKER_BASE}/api/leaderboard`);
    const faction = leaderboard.find((entry) => entry.factionId === factionId);
    assert(faction, `Expected faction ${factionId} on the leaderboard`);
    return faction.score;
}

async function waitForSmokeBridge(page) {
    await page.waitForFunction(() => Boolean(window.__MERGE_CRIMES_SMOKE__), undefined, { timeout: 20_000 });
}

async function getSnapshot(page) {
    return page.evaluate(() => window.__MERGE_CRIMES_SMOKE__?.snapshot() ?? null);
}

async function waitForWorkerMissionStatus(sessionId, missionId, expectedStatus, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const missions = await fetchJson(`${WORKER_BASE}/api/missions?sessionId=${sessionId}`);
        const mission = missions.find((candidate) => candidate.id === missionId);
        if (mission?.status === expectedStatus) {
            return mission;
        }

        await sleep(400);
    }

    throw new Error(`Timed out waiting for worker mission ${missionId} to reach status '${expectedStatus}'`);
}

async function waitForRoomCapture(districtId, minimumCapture, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const room = await fetchJson(`${WORKER_BASE}/api/districts/${districtId}/room`);
        if (room.captureProgress >= minimumCapture) {
            return room;
        }

        await sleep(400);
    }

    throw new Error(`Timed out waiting for ${districtId} capture to reach ${minimumCapture}`);
}

async function withTemporaryWorkerDevVars(run) {
    const existing = await pathExists(workerDevVarsPath);
    const backupPath = existing ? path.join(os.tmpdir(), `merge-crimes-dev-vars-${Date.now()}`) : null;

    if (backupPath) {
        await copyFile(workerDevVarsPath, backupPath);
    }

    const devVars = [
        'PUBLIC_SESSION_SECRET=merge-crimes-browser-smoke-secret',
        `PUBLIC_ORIGIN_ALLOWLIST=http://localhost:${FRONTEND_PORT}`,
        '',
    ].join('\n');

    await writeFile(workerDevVarsPath, devVars, 'utf8');

    try {
        return await run();
    } finally {
        if (backupPath) {
            const original = await readFile(backupPath, 'utf8');
            await writeFile(workerDevVarsPath, original, 'utf8');
            await rm(backupPath, { force: true });
        } else {
            await rm(workerDevVarsPath, { force: true });
        }
    }
}

async function runHealthyScenario(browser) {
    logStep('Running healthy browser flow');
    const page = await browser.newPage();

    try {
        await page.goto(LOCALHOST_SMOKE_URL, { waitUntil: 'domcontentloaded' });
        await waitForSmokeBridge(page);
        await page.getByTestId('enter-city').click();

        await page.waitForFunction(() => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return Boolean(snapshot?.apiAvailable && snapshot.writeSessionState === 'ready' && snapshot.phase === 'playing');
        }, undefined, { timeout: 20_000 });

        assert(await page.locator('[data-testid^="connection-status-"]').count() === 0, 'Healthy flow should not show a status banner');

        await page.evaluate(() => window.__MERGE_CRIMES_SMOKE__?.setCurrentDistrict('react-district'));
        await page.waitForFunction(() => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return Boolean(snapshot?.currentDistrictId === 'react-district' && (snapshot.districtRooms['react-district']?.presenceCount ?? 0) >= 1);
        }, undefined, { timeout: 20_000 });

        await page.getByTestId('toggle-missions').click();
        const firstMission = await page.evaluate(() => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return snapshot?.missions.find((mission) =>
                mission.status === 'available'
                && mission.type !== 'boss'
                && mission.districtId === 'react-district'
            ) ?? null;
        });

        assert(firstMission, 'Expected an available non-boss mission in react-district');
        await page.getByTestId(`accept-mission-${firstMission.id}`).click();

        await page.waitForFunction((missionId) => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return Boolean(snapshot?.activeMissionId === missionId && snapshot.phase === 'mission');
        }, firstMission.id, { timeout: 20_000 });

        let snapshot = await getSnapshot(page);
        const sessionId = snapshot?.sessionId;
        assert(sessionId, 'Expected a browser session ID after mission accept');

        await waitForWorkerMissionStatus(sessionId, firstMission.id, 'active');

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForSmokeBridge(page);
        await page.waitForFunction(({ missionId, expectedSessionId }) => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return Boolean(
                snapshot
                && snapshot.sessionId === expectedSessionId
                && snapshot.activeMissionId === missionId
                && snapshot.writeSessionState === 'ready'
                && snapshot.phase === 'mission'
            );
        }, { missionId: firstMission.id, expectedSessionId: sessionId }, { timeout: 20_000 });

        const completed = await page.evaluate(() => window.__MERGE_CRIMES_SMOKE__?.completeActiveMission() ?? false);
        assert(completed, 'Expected local smoke bridge to complete the active mission');

        await page.waitForFunction((missionId) => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            const mission = snapshot?.missions.find((candidate) => candidate.id === missionId);
            return Boolean(snapshot && snapshot.activeMissionId === null && snapshot.phase === 'playing' && mission?.status === 'completed');
        }, firstMission.id, { timeout: 20_000 });

        await waitForWorkerMissionStatus(sessionId, firstMission.id, 'completed');
        const factionScoreAfterFirstCompletion = await fetchFactionScore('chrome-syndicate');
        const reactRoom = await waitForRoomCapture('react-district', 25);
        assert(reactRoom.presenceCount >= 1, 'District heartbeat should increment presence');
        assert(reactRoom.captureProgress >= 25, 'Mission completion should advance shared capture');

        const replayContext = await browser.newContext();
        const replayPage = await replayContext.newPage();

        try {
            await replayPage.goto(LOCALHOST_SMOKE_URL, { waitUntil: 'domcontentloaded' });
            await waitForSmokeBridge(replayPage);
            await replayPage.getByTestId('enter-city').click();

            await replayPage.waitForFunction(() => {
                const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
                return Boolean(snapshot?.apiAvailable && snapshot.writeSessionState === 'ready' && snapshot.phase === 'playing');
            }, undefined, { timeout: 20_000 });

            await replayPage.evaluate(() => window.__MERGE_CRIMES_SMOKE__?.setCurrentDistrict('react-district'));
            await replayPage.waitForFunction(() => {
                const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
                return Boolean(snapshot?.currentDistrictId === 'react-district');
            }, undefined, { timeout: 20_000 });

            await replayPage.getByTestId('toggle-missions').click();
            await replayPage.getByTestId(`accept-mission-${firstMission.id}`).click();
            await replayPage.waitForFunction((missionId) => {
                const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
                return Boolean(snapshot?.activeMissionId === missionId && snapshot.phase === 'mission');
            }, firstMission.id, { timeout: 20_000 });

            const replaySnapshot = await getSnapshot(replayPage);
            const replaySessionId = replaySnapshot?.sessionId;
            assert(replaySessionId, 'Expected a second browser session ID for replay verification');

            const replayCompleted = await replayPage.evaluate(() => window.__MERGE_CRIMES_SMOKE__?.completeActiveMission() ?? false);
            assert(replayCompleted, 'Expected replay session to complete the same mission');

            await replayPage.waitForFunction((missionId) => {
                const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
                const mission = snapshot?.missions.find((candidate) => candidate.id === missionId);
                return Boolean(snapshot && snapshot.activeMissionId === null && snapshot.phase === 'playing' && mission?.status === 'completed');
            }, firstMission.id, { timeout: 20_000 });

            await waitForWorkerMissionStatus(replaySessionId, firstMission.id, 'completed');

            const factionScoreAfterReplayCompletion = await fetchFactionScore('chrome-syndicate');
            assert(
                factionScoreAfterReplayCompletion === factionScoreAfterFirstCompletion,
                'Replay completion from a fresh session should not increase faction score during cooldown',
            );
        } finally {
            await replayPage.close();
            await replayContext.close();
        }

        await page.evaluate(() => window.__MERGE_CRIMES_SMOKE__?.setCurrentDistrict(null));
        await page.getByTestId('toggle-missions').click();

        const secondMission = await page.evaluate((excludeMissionId) => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return snapshot?.missions.find((mission) =>
                mission.status === 'available'
                && mission.type !== 'boss'
                && mission.id !== excludeMissionId
            ) ?? null;
        }, firstMission.id);

        assert(secondMission, 'Expected a second available non-boss mission to test fail flow');
        await page.getByTestId(`accept-mission-${secondMission.id}`).click();

        await page.waitForFunction((missionId) => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return Boolean(snapshot?.activeMissionId === missionId && snapshot.phase === 'mission');
        }, secondMission.id, { timeout: 20_000 });

        await waitForWorkerMissionStatus(sessionId, secondMission.id, 'active');

        const failed = await page.evaluate(() => window.__MERGE_CRIMES_SMOKE__?.failActiveMission() ?? false);
        assert(failed, 'Expected local smoke bridge to fail the active mission');

        await page.waitForFunction((missionId) => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            const mission = snapshot?.missions.find((candidate) => candidate.id === missionId);
            return Boolean(snapshot && snapshot.activeMissionId === null && snapshot.phase === 'playing' && mission?.status === 'available');
        }, secondMission.id, { timeout: 20_000 });

        await waitForWorkerMissionStatus(sessionId, secondMission.id, 'available');

        snapshot = await getSnapshot(page);
        return {
            sessionId,
            completedMissionId: firstMission.id,
            failedMissionId: secondMission.id,
            reactDistrictPresence: reactRoom.presenceCount,
            reactDistrictCapture: reactRoom.captureProgress,
            chromeSyndicateScoreAfterReplayCooldownCheck: factionScoreAfterFirstCompletion,
        };
    } finally {
        await page.close();
    }
}

async function runOfflineScenario(browser) {
    logStep('Running offline warning scenario');
    const page = await browser.newPage();

    try {
        await page.goto(OFFLINE_SMOKE_URL, { waitUntil: 'domcontentloaded' });
        await waitForSmokeBridge(page);
        await page.getByTestId('enter-city').click();

        await page.waitForFunction(() => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return Boolean(snapshot && snapshot.apiAvailable === false && snapshot.apiConnectionState === 'offline');
        }, undefined, { timeout: 20_000 });

        await page.getByTestId('connection-status-offline').waitFor({ state: 'visible', timeout: 20_000 });
        const snapshot = await getSnapshot(page);
        return snapshot;
    } finally {
        await page.close();
    }
}

async function runReadOnlyScenario(browser) {
    logStep('Running read-only warning scenario');
    const page = await browser.newPage();

    try {
        await page.goto(LOOPBACK_SMOKE_URL, { waitUntil: 'domcontentloaded' });
        await waitForSmokeBridge(page);
        await page.getByTestId('enter-city').click();

        await page.waitForFunction(() => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return Boolean(snapshot?.apiAvailable && snapshot.writeSessionState === 'error');
        }, undefined, { timeout: 20_000 });

        await page.getByTestId('connection-status-write-error').waitFor({ state: 'visible', timeout: 20_000 });
        await page.getByTestId('toggle-missions').click();
        await page.getByTestId('mission-sync-note').waitFor({ state: 'visible', timeout: 20_000 });

        const missionId = await page.evaluate(() => {
            const snapshot = window.__MERGE_CRIMES_SMOKE__?.snapshot();
            return snapshot?.missions.find((mission) => mission.status === 'available' && mission.type !== 'boss')?.id ?? null;
        });
        assert(missionId, 'Expected an available non-boss mission in read-only scenario');

        assert(await page.getByTestId(`accept-mission-${missionId}`).isDisabled(), 'Mission accept button should be disabled in read-only mode');
        const snapshot = await getSnapshot(page);
        return snapshot;
    } finally {
        await page.close();
    }
}

async function main() {
    let workerProcess = null;
    let frontendProcess = null;
    let browser = null;

    try {
        await withTemporaryWorkerDevVars(async () => {
            logStep('Applying local D1 migrations');
            await runCommand('npx', ['wrangler', 'd1', 'migrations', 'apply', 'merge-crimes-db', '--local'], {
                cwd: workerDir,
                label: 'worker:migrate',
            });

            logStep('Starting worker dev server');
            workerProcess = createManagedProcess('npx', ['wrangler', 'dev', '--local', '--port', String(WORKER_PORT)], {
                cwd: workerDir,
                label: 'worker',
            });
            await waitForHttp(`${WORKER_BASE}/api/health`, async (response) => response.ok, 45_000);

            logStep('Reseeding local worker data');
            await fetchJson(`${WORKER_BASE}/api/admin/seed`, { method: 'POST' });

            logStep('Starting frontend dev server');
            frontendProcess = createManagedProcess('npm', ['run', 'dev', '--', '--host', '0.0.0.0', '--port', String(FRONTEND_PORT)], {
                cwd: frontendDir,
                label: 'frontend',
            });
            await waitForHttp(LOCALHOST_FRONTEND_BASE, async (response) => response.ok, 45_000);

            logStep('Launching Playwright Chromium');
            browser = await chromium.launch({ headless: true });

            const healthyResult = await runHealthyScenario(browser);
            const offlineResult = await runOfflineScenario(browser);
            const readOnlyResult = await runReadOnlyScenario(browser);

            logStep('Browser smoke passed');
            console.log(JSON.stringify({
                healthyResult,
                offlineResult,
                readOnlyResult,
            }, null, 2));
        });
    } catch (error) {
        const failurePath = path.join(os.tmpdir(), `merge-crimes-browser-smoke-${Date.now()}.png`);

        if (browser) {
            const pages = browser.contexts().flatMap((context) => context.pages());
            const page = pages.at(-1);
            if (page) {
                try {
                    await page.screenshot({ path: failurePath, fullPage: true });
                    console.error(`[browser:smoke] Saved failure screenshot to ${failurePath}`);
                } catch {
                    // Best-effort only.
                }
            }
        }

        if (frontendProcess) {
            console.error(frontendProcess.getLogs());
        }
        if (workerProcess) {
            console.error(workerProcess.getLogs());
        }

        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopManagedProcess(frontendProcess);
        await stopManagedProcess(workerProcess);
    }
}

await main();
