#!/usr/bin/env node
// Vite dev server launcher for the Tauri dev flow.
// Port is chosen by scripts/launch-dev.mjs and passed via RUSTMD_VITE_PORT
// (falls back to 5173 when run standalone).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.RUSTMD_VITE_PORT) || 5173;
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

console.log(`[rustmd] starting vite dev server on 127.0.0.1:${port}`);
const vite = spawn(
  process.execPath,
  [
    viteBin,
    '--config',
    path.join(root, 'frontend', 'vite.config.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: root, stdio: 'inherit' }
);

vite.on('error', (err) => {
  console.error(`[rustmd] cannot start the Vite dev server: ${err.message}`);
  process.exit(1);
});
vite.on('close', (code, signal) => {
  // A killed Vite (signal, code=null) must not look like a clean exit: Tauri
  // would keep waiting for devUrl and surface it as a white window instead.
  process.exit(signal ? 1 : (code ?? 0));
});
