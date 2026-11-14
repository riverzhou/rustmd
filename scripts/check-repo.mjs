#!/usr/bin/env node
// Repository invariants that are cheaper to check here than to discover at
// runtime: version-independent docs links, no machine-specific paths, CSP
// present, plugin permissions declared, icons listed, dist not tracked.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const notes = [];

const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => {
  // Case-exact existence check: Windows/macOS filesystems are usually
  // case-insensitive, so a link written with the wrong case would pass
  // locally and 404 on GitHub (whose storage is case-sensitive).
  const parts = String(rel)
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.');
  let current = root;
  for (const part of parts) {
    if (part === '..') {
      current = path.dirname(current);
      continue;
    }
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return false;
    }
    if (!entries.some((entry) => entry.name === part)) return false;
    current = path.join(current, part);
  }
  return true;
};

const REQUIRED = [
  'package.json',
  'package-lock.json',
  'Cargo.toml',
  'Cargo.lock',
  'build.rs',
  'rust-toolchain.toml',
  'tauri.conf.json',
  'src/main.rs',
  'README.md',
  'README.en.md',
  'AGENTS.md',
  'CHANGELOG.md',
  'AUDIT_REPORT.md',
  'frontend/index.html',
  'frontend/src/main.js',
  'frontend/src/api.js',
  'frontend/src/preview.js',
  'frontend/src/export.js',
  'frontend/src/editor.js',
  'frontend/src/notelist.js',
  'frontend/src/markdown.js',
  'frontend/src/layout.js',
  'frontend/src/layout.test.js',
  'frontend/src/pdfgeom.js',
  'frontend/src/pdfgeom.test.js',
  'frontend/src/dataformat.js',
  'frontend/src/dataformat.test.js',
  'frontend/src/dataview.js',
  'frontend/src/dataview.css',
  'frontend/src/style.css',
  'frontend/src/selftest.js',
  'capabilities/default.json',
  'LICENSE',
  'LINUX_BUILD.md',
  'frontend/shims/katex.js',
  'scripts/linux-headless-smoke.sh',
  'docs/ARCHITECTURE.md',
  'docs/TESTING.md',
  'docs/RELEASING.md',
  'docs/SECURITY.md',
  'docs/GITHUB_PROJECT_COPY.md',
  'icons/icon.ico',
  'icons/icon.icns',
  'icons/icon.png',
  'examples/html-page-demo.html',
  'examples/数据表格示例.csv',
  'examples/数据表格示例-GBK.csv',
  'examples/数据文本示例.txt',
  'examples/数据配置示例.json',
  'scripts/launch-dev.mjs',
  'scripts/check-selftest-report.mjs',
  'scripts/dev-server.mjs',
  'scripts/cargo.mjs',
  '.gitignore',
  '.gitattributes',
];
for (const file of REQUIRED) {
  if (!exists(file)) errors.push(`missing required file: ${file}`);
}

const pkg = JSON.parse(read('package.json'));
const config = JSON.parse(read('tauri.conf.json'));
const capabilities = JSON.parse(read('capabilities/default.json'));
const cargoToml = read('Cargo.toml');

// gen/schemas/capabilities.json is Tauri codegen; it must reflect the
// capability source, otherwise the built app's permission set can drift from
// the file that was reviewed.
if (exists('gen/schemas/capabilities.json')) {
  const generated = JSON.parse(read('gen/schemas/capabilities.json'));
  const generatedDefault = generated.default;
  if (!generatedDefault) {
    errors.push('gen/schemas/capabilities.json: no "default" capability');
  } else {
    const expected = [...(capabilities.permissions || [])].sort();
    const actual = [...(generatedDefault.permissions || [])].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      errors.push(
        'gen/schemas/capabilities.json is stale: run `npx tauri build`/`dev` to regenerate ' +
          `(source: ${expected.join(', ')}; generated: ${actual.join(', ')})`
      );
    }
    if (
      Array.isArray(capabilities.windows) &&
      JSON.stringify([...capabilities.windows].sort()) !==
        JSON.stringify([...(generatedDefault.windows || [])].sort())
    ) {
      errors.push('gen/schemas/capabilities.json: window list differs from capabilities/default.json');
    }
  }
}

if (pkg.license !== 'GPL-3.0-or-later') {
  errors.push(`package.json: license must be GPL-3.0-or-later (got ${pkg.license})`);
}
if (!/^license\s*=\s*"GPL-3\.0-or-later"/m.test(cargoToml)) {
  errors.push('Cargo.toml: license must be GPL-3.0-or-later');
}
if (config.bundle?.licenseFile !== 'LICENSE') {
  errors.push('tauri.conf.json: bundle.licenseFile must be LICENSE');
}

for (const script of ['build', 'lint', 'test:unit', 'check', 'tauri']) {
  if (!pkg.scripts || !pkg.scripts[script]) {
    errors.push(`package.json: missing script "${script}"`);
  }
}

// --- version / release-notes documentation consistency ---
// check-version.mjs verifies the build inputs; these checks keep the docs
// that the release workflow publishes in sync with the same number.
const version = pkg.version;
if (version) {
  for (const readme of ['README.md', 'README.en.md']) {
    if (!read(readme).includes(`**${version}**`)) {
      errors.push(`${readme}: current version banner **${version}** is missing`);
    }
  }
  if (!new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(read('CHANGELOG.md'))) {
    errors.push(`CHANGELOG.md: missing "## [${version}]" section`);
  }
  if (!exists(`RELEASE_NOTES-${version}.md`)) {
    errors.push(`missing RELEASE_NOTES-${version}.md for the current version`);
  }
}

// --- IPC surface: handler list, docs count, frontend bridge ---
const mainRs = read('src/main.rs');
const handlerMatch = mainRs.match(/generate_handler!\[([\s\S]*?)\]/);
if (!handlerMatch) {
  errors.push('src/main.rs: tauri::generate_handler![...] not found');
} else {
  const commands = handlerMatch[1]
    .split(/[\s,]+/)
    .filter((name) => /^[a-z][a-z0-9_]*$/.test(name));
  const unique = [...new Set(commands)];
  const agents = read('AGENTS.md');
  const claimed = agents.match(/IPC commands \((\d+)\)/);
  if (!claimed) {
    errors.push('AGENTS.md: "IPC commands (N)" header not found');
  } else if (Number(claimed[1]) !== unique.length) {
    errors.push(
      `AGENTS.md: claims ${claimed[1]} IPC commands, generate_handler has ${unique.length}`
    );
  }
  const api = read('frontend/src/api.js');
  // html_preview_finish is invoked by the hidden renderer window's injected
  // script, not through api.js.
  const missing = unique.filter(
    (command) => command !== 'html_preview_finish' && !api.includes(command)
  );
  if (missing.length) {
    errors.push(`frontend/src/api.js: no wrapper for IPC command(s): ${missing.join(', ')}`);
  }
  const declared = [...mainRs.matchAll(/#\[tauri::command\]\s*\n(?:pub\s+)?(?:async\s+)?fn\s+([a-z][a-z0-9_]*)/g)].map(
    (match) => match[1]
  );
  for (const command of unique) {
    if (!declared.includes(command)) {
      errors.push(`src/main.rs: generate_handler lists ${command} but no #[tauri::command] fn exists`);
    }
  }
}

// --- CSP ---
const csp = config.app && config.app.security && config.app.security.csp;
if (!csp || typeof csp !== 'string') {
  errors.push('tauri.conf.json: app.security.csp must be a non-empty policy');
} else {
  for (const directive of ["default-src 'self'", "object-src 'none'"]) {
    if (!csp.includes(directive)) errors.push(`CSP missing: ${directive}`);
  }
  // The release policy must not carry the dev server's arbitrary localhost /
  // websocket surface; that belongs to app.security.devCsp.
  if (/(?:127\.0\.0\.1|ws:\/\/|http:\/\/localhost)/.test(csp)) {
    errors.push(
      'tauri.conf.json: release csp contains dev-server origins; move them to app.security.devCsp'
    );
  }
  if (typeof config.app.security.devCsp !== 'string' || !config.app.security.devCsp) {
    errors.push('tauri.conf.json: app.security.devCsp must be set for the Vite dev server');
  }
}

// --- dev server / devUrl agreement ---
const vite = read('frontend/vite.config.js');
if (!/host:\s*'127\.0\.0\.1'/.test(vite)) {
  errors.push('vite.config.js: host must be 127.0.0.1 (WebView2 cannot reach IPv6-only)');
}
if (!/strictPort:\s*true/.test(vite)) {
  errors.push('vite.config.js: strictPort must be true');
}
if (!config.build?.devUrl?.includes('127.0.0.1:5173')) {
  errors.push(`tauri.conf.json: build.devUrl should use 127.0.0.1:5173 (got ${config.build?.devUrl})`);
}
if (config.build?.frontendDist !== 'frontend/dist') {
  errors.push('tauri.conf.json: frontendDist must be frontend/dist');
}

// --- icons ---
const bundleIcons = config.bundle?.icon || [];
for (const icon of bundleIcons) {
  if (!exists(icon)) errors.push(`bundle icon missing: ${icon}`);
}
for (const needed of ['icons/icon.ico', 'icons/icon.icns']) {
  if (!bundleIcons.includes(needed)) errors.push(`bundle.icon must include ${needed}`);
}

// --- window close guard permission ---
// @tauri-apps/api's onCloseRequested awaits the handler and then calls
// plugin:window|destroy; without allow-destroy the app becomes unclosable.
if (
  read('frontend/src/main.js').includes('onCloseRequested') &&
  !(capabilities.permissions || []).includes('core:window:allow-destroy')
) {
  errors.push(
    'capabilities/default.json: onCloseRequested requires "core:window:allow-destroy"'
  );
}

// --- plugin permissions ---
const pluginNames = [...cargoToml.matchAll(/^tauri-plugin-([a-z0-9-]+)\s*=/gm)].map(
  (m) => m[1]
);
const permissions = capabilities.permissions || [];
for (const name of pluginNames) {
  const prefix = `${name}:`;
  if (!permissions.some((p) => p === `${prefix}default` || p.startsWith(prefix))) {
    errors.push(
      `capabilities/default.json: missing permission for tauri-plugin-${name} (add "${prefix}default")`
    );
  }
}

// --- machine-specific paths ---
// Drive-letter paths under a user/checkout folder (case-insensitive: Windows
// paths are), plus the classic macOS home layout. Deliberately not "any
// absolute path": docs legitimately show /home/..., /usr, /Applications and
// URL paths.
const MACHINE_PATHS = [
  /[A-Za-z]:[\\/](?:Users|GitHub|Projects|Documents|Desktop|Dev|Work)[\\/]/i,
  /\/Users\/[A-Za-z0-9._-]+\//,
];
const SCAN_ROOTS = ['src', 'frontend/src', 'frontend/vite.config.js', 'scripts', '.github'];
const SCAN_FILES = [
  'README.md',
  'README.en.md',
  'AGENTS.md',
  'LINUX_BUILD.md',
  'CHANGELOG.md',
  'AUDIT_REPORT.md',
  'package.json',
  'tauri.conf.json',
  'capabilities/default.json',
  'eslint.config.js',
];

function walkFiles(relDir, out = []) {
  const abs = path.join(root, relDir);
  if (!exists(relDir)) return out;
  const stat = statSync(abs);
  if (stat.isFile()) {
    out.push(relDir);
    return out;
  }
  for (const entry of readdirSync(abs)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const rel = path.posix.join(relDir.replace(/\\/g, '/'), entry);
    const child = statSync(path.join(root, rel));
    if (child.isDirectory()) walkFiles(rel, out);
    else out.push(rel);
  }
  return out;
}

const scanFiles = new Set([...SCAN_FILES, ...SCAN_ROOTS.flatMap((p) => walkFiles(p))]);
for (const rel of scanFiles) {
  if (/\.(?:png|ico|icns|lock)$/i.test(rel)) continue;
  let text;
  try {
    text = read(rel);
  } catch {
    continue;
  }
  for (const pattern of MACHINE_PATHS) {
    const match = pattern.exec(text);
    if (match) {
      errors.push(`machine-specific path in ${rel}: ${match[0]}`);
      break;
    }
  }
}

// --- docs links ---
function markdownFiles(dir = 'docs') {
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of readdirSync(path.join(root, dir))) {
    const rel = path.posix.join(dir, entry);
    const stat = statSync(path.join(root, rel));
    if (stat.isDirectory()) out.push(...markdownFiles(rel));
    else if (entry.endsWith('.md')) out.push(rel);
  }
  return out;
}

const releaseNotes = readdirSync(root).filter((name) => /^RELEASE_NOTES-.*\.md$/.test(name));
const docs = [
  'README.md',
  'README.en.md',
  'AGENTS.md',
  'LINUX_BUILD.md',
  'CHANGELOG.md',
  'AUDIT_REPORT.md',
  ...releaseNotes,
  ...markdownFiles(),
];

function checkDocLink(doc, rawTarget) {
  let target = String(rawTarget).trim();
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1);
  }
  if (/^(https?:|mailto:|#|data:)/i.test(target)) return;
  target = target.split('#')[0].split('?')[0];
  if (!target) return;
  let decoded;
  try {
    decoded = decodeURI(target);
  } catch {
    errors.push(`${doc}: malformed escape in link ${rawTarget}`);
    return;
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(doc), decoded)
  );
  if (resolved.startsWith('../')) {
    errors.push(`${doc}: link escapes the repository: ${rawTarget}`);
    return;
  }
  if (!exists(resolved)) errors.push(`${doc}: broken link ${rawTarget}`);
}

for (const doc of docs) {
  if (!exists(doc)) continue;
  const text = read(doc)
    .replace(/^```[\s\S]*?^```/gm, '')
    .replace(/`[^`\n]*`/g, '');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    checkDocLink(doc, match[1]);
  }
  // Reference-style definitions: [ref]: ../path. Their targets are resolved
  // by Markdown renderers even when the inline form is not used.
  for (const match of text.matchAll(/^ {0,3}\[[^\]]+\]:\s*(\S+)/gm)) {
    checkDocLink(doc, match[1]);
  }
  for (const match of text.matchAll(
    /<(?:img|a)[^>]*?\s(?:src|href)=["']([^"']+)["']/gi
  )) {
    checkDocLink(doc, match[1]);
  }
}

// --- build output must not be tracked ---
const git = spawnSync('git', ['ls-files', 'frontend/dist'], { cwd: root, encoding: 'utf8' });
if (git.error || git.status !== 0) {
  errors.push('cannot run "git ls-files frontend/dist"; is git installed?');
} else if (git.stdout.trim()) {
  errors.push('frontend/dist is tracked by git (it is a build artifact)');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
notes.push(`${scanFiles.size} source files scanned`);
notes.push(`${docs.length} docs link-checked`);
console.log(`repo checks OK (${notes.join(', ')})`);
