#!/usr/bin/env node
// Cross-platform launcher for the dev-only E2E self-test:
//   npm run selftest
// It sets RUSTMD_SELFTEST=1 and starts the normal Tauri dev flow; the dev
// window renders examples/, exports PNG+PDF and exits with the verdict.
//
// A stale `report.json` from an earlier run must never be mistaken for this
// run's result: remove it (and progress.log) before starting. The report
// checker additionally verifies every artifact and its byte count, so a
// failed launch can no longer re-use an old green report.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir =
  process.env.RUSTMD_SELFTEST_OUT || path.join(os.tmpdir(), 'rustmd-selftest');
process.env.RUSTMD_SELFTEST = '1';
process.env.RUSTMD_SELFTEST_OUT = outDir;

for (const stale of ['report.json', 'progress.log']) {
  rmSync(path.join(outDir, stale), { force: true });
}
console.log(`[selftest] fresh output directory: ${outDir}`);

const child = spawn(
  process.execPath,
  [path.join(root, 'scripts', 'launch-dev.mjs'), ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('error', (err) => {
  console.error(`[selftest] cannot start the dev app: ${err.message}`);
  process.exit(1);
});
child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
