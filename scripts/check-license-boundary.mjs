#!/usr/bin/env node
// License boundary invariants.
//
// The desktop application is GPL-3.0-or-later. The platform-independent
// engine (`crates/rustmd-core`) and the renderer (`frontend/src/shared`) are
// dual-licensed MIT OR Apache-2.0 so they stay embeddable elsewhere. That only
// works while the boundary stays clean, so it is checked here:
//
//   1. core is permissively licensed and never pulls in Tauri;
//   2. every core source file carries the SPDX header;
//   3. the desktop package stays GPL;
//   4. any future `frontend/src/shared/` stays free of Tauri imports.
//
// See docs/LICENSING.md.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const notes = [];

const read = (rel) => readFileSync(path.join(root, rel), 'utf8');


// Comments may legitimately mention Tauri (contracts, docs); only real code
// counts. Crude but sufficient: drop /* ... */ blocks and // to end of line.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

const CORE_TOML = 'crates/rustmd-core/Cargo.toml';
const CORE_DIR = 'crates/rustmd-core';
const CORE_SPDX = '// SPDX-License-Identifier: MIT OR Apache-2.0';

// --- 1. core manifest: permissive license, no Tauri ---
const coreToml = read(CORE_TOML);
if (!/^license\s*=\s*"MIT OR Apache-2\.0"$/m.test(coreToml)) {
  errors.push(`${CORE_TOML}: expected license = "MIT OR Apache-2.0"`);
}
if (/\btauri\b/i.test(coreToml)) {
  errors.push(`${CORE_TOML}: must not depend on tauri (core must stay embeddable)`);
}

// --- 2. every core source file is permissively licensed ---
const rustFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== 'target') walk(rel);
    } else if (entry.name.endsWith('.rs')) rustFiles.push(rel);
  }
};
walk(CORE_DIR);
if (rustFiles.length === 0) {
  errors.push(`${CORE_DIR}: no Rust sources found`);
}
for (const rel of rustFiles) {
  const text = read(rel);
  if (!text.startsWith(CORE_SPDX)) {
    errors.push(`${rel}: missing "${CORE_SPDX}" header`);
  }
  // A `tauri::` path or `use tauri` would drag the GPL app's dependency tree
  // into the permissive crate.
  if (/\btauri::|\buse tauri\b/.test(text)) {
    errors.push(`${rel}: references tauri; core must stay platform-independent`);
  }
}

// --- 3. the desktop package stays GPL ---
const rootToml = read('Cargo.toml');
if (!/^license\s*=\s*"GPL-3\.0-or-later"$/m.test(rootToml)) {
  errors.push('Cargo.toml: the desktop application must stay GPL-3.0-or-later');
}
if (!/^rustmd-core\s*=\s*\{\s*path\s*=\s*"crates\/rustmd-core"\s*\}$/m.test(rootToml)) {
  errors.push('Cargo.toml: expected a path dependency on rustmd-core');
}
const pkg = JSON.parse(read('package.json'));
if (pkg.license !== 'GPL-3.0-or-later') {
  errors.push(`package.json: expected license GPL-3.0-or-later, found ${pkg.license}`);
}

// --- 4. license texts exist ---
for (const rel of ['licenses/LICENSE-MIT', 'licenses/LICENSE-APACHE']) {
  try {
    if (statSync(path.join(root, rel)).size < 500) errors.push(`${rel}: looks truncated`);
  } catch {
    errors.push(`${rel}: missing`);
  }
}

// --- 5. the future shared frontend layer stays Tauri-free ---
// Every source file in the reusable layer carries its permissive SPDX header,
// stylesheets included: `dataview.css` is part of the reusable renderer and is
// embedded in exported documents, not part of the GPL shell.
const sharedDir = 'frontend/src/shared';
const JS_SPDX = '// SPDX-License-Identifier: MIT OR Apache-2.0';
const CSS_SPDX = '/* SPDX-License-Identifier: MIT OR Apache-2.0 */';
let sharedFiles = 0;
const walkJs = (dir) => {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walkJs(rel);
    else if (/\.m?js$/.test(entry.name) || entry.name.endsWith('.css')) {
      sharedFiles += 1;
      const raw = read(rel);
      if (!raw.startsWith(JS_SPDX) && !raw.startsWith(CSS_SPDX)) {
        errors.push(`${rel}: missing permissive SPDX header`);
      }
      if (/\.m?js$/.test(entry.name)) {
        const text = stripComments(raw);
        if (/@tauri-apps|__TAURI_INTERNALS__|\binvoke\s*\(/.test(text)) {
          errors.push(`${rel}: shared renderer code must not call Tauri directly`);
        }
      }
    }
  }
};
try {
  walkJs(sharedDir);
} catch {
  // Not extracted yet; nothing to check.
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
notes.push(`${rustFiles.length} core Rust files`);
notes.push(sharedFiles ? `${sharedFiles} shared source files` : 'shared layer not extracted yet');
console.log(`license boundary OK (${notes.join(', ')})`);
