import { spawn } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const frontendDir = path.resolve(path.dirname(__filename), '..');
const smokeOutDir = path.join(frontendDir, 'dist-smoke-ssr');
const smokeScenarios = [
    'menu-anonymous',
    'menu-listed-only',
    'menu-eligible-error',
    'menu-refresh-available',
    'hud-refresh-available',
];

function logStep(message) {
    console.log(`[browser:smoke] ${message}`);
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

async function findBuiltRunner() {
    const entries = await readdir(smokeOutDir);
    const runnerEntry = entries.find((entry) => /^browser-smoke-runner\.(m?js|cjs)$/.test(entry));
    if (!runnerEntry) {
        throw new Error('Could not find the built SSR smoke runner output.');
    }

    return path.join(smokeOutDir, runnerEntry);
}

async function main() {
    await mkdir(smokeOutDir, { recursive: true });
    await rm(smokeOutDir, { recursive: true, force: true });

    logStep('Building the SSR smoke runner');
    await runCommand('npx', ['vite', 'build', '--ssr', 'scripts/browser-smoke-runner.tsx', '--outDir', 'dist-smoke-ssr'], {
        cwd: frontendDir,
        label: 'smoke:ssr-build',
    });

    const runnerPath = await findBuiltRunner();

    for (const scenario of smokeScenarios) {
        logStep(`Executing SSR smoke scenario: ${scenario}`);
        await runCommand('node', [runnerPath, scenario], {
            cwd: frontendDir,
            label: `smoke:ssr-run:${scenario}`,
        });
    }

    logStep('Browser smoke passed');
}

await main();
