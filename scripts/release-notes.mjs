#!/usr/bin/env node
// Print the release body for a version: prefer RELEASE_NOTES-<version>.md,
// otherwise extract the matching CHANGELOG section.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.argv[2] || process.env.GITHUB_REF_NAME || '';
const version = raw.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`usage: node scripts/release-notes.mjs <version|vversion>`);
  process.exit(1);
}

const notesFile = path.join(root, `RELEASE_NOTES-${version}.md`);
if (existsSync(notesFile)) {
  process.stdout.write(readFileSync(notesFile, 'utf8'));
  process.exit(0);
}

const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const start = changelog.search(new RegExp(`^## \\[${escaped}\\]`, 'm'));
if (start < 0) {
  console.error(`no RELEASE_NOTES-${version}.md and no CHANGELOG section for ${version}`);
  process.exit(1);
}
const rest = changelog.slice(start);
const next = rest.slice(3).search(/^## \[/m);
const section = (next < 0 ? rest : rest.slice(0, next + 3))
  .split('\n')
  .slice(1)
  .join('\n')
  .trim();
process.stdout.write(`# rustmd ${version}\n\n${section}\n`);
