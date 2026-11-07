#!/usr/bin/env node
// Every user-facing version must agree: package.json, Cargo.toml,
// tauri.conf.json. CI additionally passes the git tag.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function read(file) {
  return readFileSync(path.join(root, file), 'utf8');
}

const pkg = JSON.parse(read('package.json'));
const cargo = read('Cargo.toml').match(/^version\s*=\s*"([^"]+)"/m);
const tauri = JSON.parse(read('tauri.conf.json'));

const versions = {
  'package.json': pkg.version,
  'Cargo.toml': cargo ? cargo[1] : null,
  'tauri.conf.json': tauri.version,
};

const errors = [];
for (const [file, version] of Object.entries(versions)) {
  if (!version) errors.push(`${file}: version not found`);
  else if (!semver.test(version)) errors.push(`${file}: invalid semver "${version}"`);
}

const values = new Set(Object.values(versions).filter(Boolean));
if (values.size > 1) {
  errors.push(
    `version mismatch: ${Object.entries(versions)
      .map(([file, version]) => `${file}=${version}`)
      .join(', ')}`
  );
}

const expectedTag = process.argv[2] || process.env.RUSTMD_EXPECT_TAG;
if (expectedTag) {
  const tag = expectedTag.startsWith('v') ? expectedTag.slice(1) : expectedTag;
  if (tag !== pkg.version) {
    errors.push(`tag ${expectedTag} does not match package version ${pkg.version}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`version OK: ${pkg.version}`);
