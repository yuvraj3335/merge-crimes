import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const workerDir = path.resolve(path.dirname(__filename), '..');
const testEntries = [
  'src/__tests__/repoCityMissionGeneration.test.ts',
  'src/__tests__/battleTemplateMapping.test.ts',
  'src/__tests__/fetchRepoSignals.test.ts',
];

async function runNodeScript(filePath) {
  const child = spawn(process.execPath, [filePath], {
    cwd: workerDir,
    stdio: 'inherit',
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`${path.basename(filePath)} exited with code ${exitCode}`);
  }
}

async function main() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'merge-crimes-worker-tests-'));

  try {
    for (const entry of testEntries) {
      const entryPath = path.resolve(workerDir, entry);
      const outFile = path.join(
        outDir,
        path.basename(entry).replace(/\.ts$/, '.mjs'),
      );

      await build({
        entryPoints: [entryPath],
        outfile: outFile,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'node20',
        logLevel: 'silent',
      });

      await runNodeScript(outFile);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

await main();
