#!/usr/bin/env node
// Cross-platform launcher for the dev-only E2E self-test:
//   npm run selftest
// It sets RUSTMD_SELFTEST=1 and starts the normal Tauri dev flow; the dev
// window renders examples/, exports PNG+PDF and exits with the verdict.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.RUSTMD_SELFTEST = '1';

const child = spawn(process.execPath, [path.join(root, 'scripts', 'launch-dev.mjs'), ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
