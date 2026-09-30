#!/usr/bin/env node
// Tauri dev flow with a dynamic dev-server port:
//   1. Prefer 5173; if it is taken, find a random free port on 127.0.0.1.
//   2. Pass the port to the Vite dev server (scripts/dev-server.mjs) via
//      the RUSTMD_VITE_PORT environment variable.
//   3. Override `build.devUrl` with `tauri dev --config`, because the Tauri
//      v2 CLI has no TAURI_DEV_URL environment variable to do this directly.
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFERRED_PORT = 5173;

function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => findEphemeral(reject));
    function findEphemeral(rejectE) {
      const s = net.createServer();
      s.once('error', rejectE);
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    }
    probe.listen(preferred, '127.0.0.1', () => {
      probe.close(() => resolve(preferred));
    });
  });
}

const port = await findFreePort(PREFERRED_PORT);
process.env.RUSTMD_VITE_PORT = String(port);
const devUrl = `http://127.0.0.1:${port}`;
if (port !== PREFERRED_PORT) {
  console.log(`[rustmd] port ${PREFERRED_PORT} is in use, using free port ${port}`);
} else {
  console.log(`[rustmd] dev server will use port ${port}`);
}

const tmpCfg = path.join(os.tmpdir(), `rustmd-tauri-dev-${process.pid}.json`);
fs.writeFileSync(tmpCfg, JSON.stringify({ build: { devUrl } }, null, 2));

// --no-watch: the Tauri dev file watcher has no exclude option and watches
// the whole project dir, so ANY in-project write (a note saved into the
// examples vault, a PNG exported into the repo, even `npm run build`) killed
// and restarted the app — experienced by users as a crash. Cost: Rust code
// or tauri.conf.json changes are not picked up automatically; restart
// scripts\run-dev.bat after editing Rust. Vite HMR for the frontend is
// unaffected.
const isWin = process.platform === 'win32';
const tauri = spawn(isWin ? 'npx.cmd' : 'npx', ['tauri', 'dev', '--config', tmpCfg, '--no-watch'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: isWin,
});

tauri.on('close', (code, signal) => {
  fs.rmSync(tmpCfg, { force: true });
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
