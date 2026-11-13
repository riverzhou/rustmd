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
  try {
    statSync(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
};

const REQUIRED = [
  'package.json',
  'Cargo.toml',
  'Cargo.lock',
  'build.rs',
  'tauri.conf.json',
  'src/main.rs',
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
];
for (const file of REQUIRED) {
  if (!exists(file)) errors.push(`missing required file: ${file}`);
}

const pkg = JSON.parse(read('package.json'));
const config = JSON.parse(read('tauri.conf.json'));
const capabilities = JSON.parse(read('capabilities/default.json'));
const cargoToml = read('Cargo.toml');

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

// --- CSP ---
const csp = config.app && config.app.security && config.app.security.csp;
if (!csp || typeof csp !== 'string') {
  errors.push('tauri.conf.json: app.security.csp must be a non-empty policy');
} else {
  for (const directive of ["default-src 'self'", "object-src 'none'"]) {
    if (!csp.includes(directive)) errors.push(`CSP missing: ${directive}`);
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
const MACHINE_PATH = /(?:[A-Za-z]:[\\/](?:Users|GitHub)[\\/]|\/Users\/[A-Za-z0-9._-]+\/)/;
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
  const match = MACHINE_PATH.exec(text);
  if (match) errors.push(`machine-specific path in ${rel}: ${match[0]}`);
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
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(doc), decodeURI(target))
  );
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
  for (const match of text.matchAll(
    /<(?:img|a)[^>]*?\s(?:src|href)=["']([^"']+)["']/gi
  )) {
    checkDocLink(doc, match[1]);
  }
}

// --- build output must not be tracked ---
const git = spawnSync('git', ['ls-files', 'frontend/dist'], { cwd: root, encoding: 'utf8' });
if (!git.error && git.status === 0 && git.stdout.trim()) {
  errors.push('frontend/dist is tracked by git (it is a build artifact)');
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
notes.push(`${scanFiles.size} source files scanned`);
notes.push(`${docs.length} docs link-checked`);
console.log(`repo checks OK (${notes.join(', ')})`);
