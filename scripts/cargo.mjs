#!/usr/bin/env node
// Cross-platform cargo launcher. `cargo` is often missing from the PATH of
// the shell this project is developed in (git-bash on Windows), while the
// rustup bin directory exists. Try, in order: $CARGO, ~/.cargo/bin/cargo,
// then `cargo` from PATH.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

const exe = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const candidates = [
  process.env.CARGO,
  path.join(homedir(), '.cargo', 'bin', exe),
  exe,
].filter(Boolean);

function probe(bin) {
  const result = spawnSync(bin, ['--version'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

const cargo = candidates.find(probe);
if (!cargo) {
  console.error(
    'cargo not found. Install Rust (https://rustup.rs) or set CARGO to the cargo executable.'
  );
  process.exit(1);
}

const result = spawnSync(cargo, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
