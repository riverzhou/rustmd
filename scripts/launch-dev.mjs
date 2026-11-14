#!/usr/bin/env node
// Tauri dev flow with a dynamic dev-server port:
//   1. Prefer 5173; if it is taken, find a random free port on 127.0.0.1.
//   2. Pass the port to the Vite dev server (scripts/dev-server.mjs) via
//      the RUSTMD_VITE_PORT environment variable.
//   3. Override `build.devUrl` with `tauri dev --config`, because the Tauri
//      v2 CLI has no TAURI_DEV_URL environment variable to do this directly.
import { spawn, spawnSync } from 'node:child_process';
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
// RUSTMD_SELFTEST=1 makes the dev window run the end-to-end self-test
// (frontend/src/selftest.js: renders every example note, exports PNG+PDF,
// writes artifacts + report.json to the system temp directory (rustmd-selftest).
const devUrl = `http://127.0.0.1:${port}${process.env.RUSTMD_SELFTEST ? '?selftest=1' : ''}`;
if (port !== PREFERRED_PORT) {
  console.log(`[rustmd] port ${PREFERRED_PORT} is in use, using free port ${port}`);
} else {
  console.log(`[rustmd] dev server will use port ${port}`);
}

const tmpCfg = path.join(os.tmpdir(), `rustmd-tauri-dev-${process.pid}.json`);
fs.writeFileSync(tmpCfg, JSON.stringify({ build: { devUrl } }, null, 2));

function cleanup() {
  fs.rmSync(tmpCfg, { force: true });
}
process.on('exit', cleanup);

// --no-watch: the Tauri dev file watcher has no exclude option and watches
// the whole project dir, so ANY in-project write (a note saved into the
// examples vault, a PNG exported into the repo, even `npm run build`) killed
// and restarted the app — experienced by users as a crash. Cost: Rust code
// or tauri.conf.json changes are not picked up automatically; restart
// scripts\run-dev.bat after editing Rust. Vite HMR for the frontend is
// unaffected.
const isWin = process.platform === 'win32';
// On Windows, run a single quoted command through the shell (the old
// `spawn('npx.cmd', args, { shell: true })` form triggers Node's
// DEP0190 warning). `tmpCfg` is an internally-generated temp path; it is
// quoted so spaces in the OS temp directory work.
const tauri = isWin
  ? spawn(`npx tauri dev --config "${tmpCfg}" --no-watch`, {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: true,
    })
  : spawn('npx', ['tauri', 'dev', '--config', tmpCfg, '--no-watch'], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });

tauri.on('error', (err) => {
  console.error(`[rustmd] cannot start tauri dev: ${err.message}`);
  cleanup();
  process.exit(1);
});

// Stop a wedged dev app (Ctrl-C, CI `timeout`, SIGTERM) without leaving
// rustmd.exe/WebView2/cargo orphans holding the notes folder. On Windows the
// child is cmd.exe, so kill the whole process tree.
function stopChild() {
  if (!tauri.pid || tauri.exitCode !== null) return;
  if (isWin) {
    spawnSync('taskkill', ['/pid', String(tauri.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    tauri.kill('SIGTERM');
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopChild();
    cleanup();
    process.exit(130);
  });
}

tauri.on('close', (code, signal) => {
  cleanup();
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
