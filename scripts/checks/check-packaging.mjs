#!/usr/bin/env node
// Packaging-manifest consistency.
//
// The manifests are updated by hand after a GitHub release, which is exactly
// how the Scoop entry once ended up declaring `version: 1.11.0` while its URL
// and SHA256 still pointed at the 1.10.7 zip (`scoop install rustmd` installed
// the old binary). This check is static (no network): every manifest must
// describe the version it claims, use the documented release asset name, and
// carry a full SHA256. The version is compared with package.json as a warning
// because the manifests are legitimately one release behind between the
// version bump and the published assets.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const errors = [];
const notes = [];
const README = 'packaging/README.md';

const pkg = JSON.parse(read('package.json'));
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const sha256 = /^[0-9a-f]{64}$/i;

function expect(condition, message) {
  if (!condition) errors.push(message);
}

function field(text, re, file, label) {
  const match = text.match(re);
  if (!match) {
    errors.push(`${file}: missing ${label}`);
    return null;
  }
  return match[1].trim();
}

// --- winget: version + installer identity across four manifests ------------
const WINGET = 'packaging/winget';
const wingetVersionFile = `${WINGET}/RiverZhou.rustmd.yaml`;
const wingetVersion = field(
  read(wingetVersionFile),
  /^PackageVersion:\s*(\S+)$/m,
  wingetVersionFile,
  'PackageVersion'
);
if (wingetVersion) {
  expect(semver.test(wingetVersion), `${wingetVersionFile}: invalid PackageVersion ${wingetVersion}`);
  for (const file of [
    `${WINGET}/RiverZhou.rustmd.installer.yaml`,
    `${WINGET}/RiverZhou.rustmd.locale.en-US.yaml`,
    `${WINGET}/RiverZhou.rustmd.locale.zh-CN.yaml`,
  ]) {
    const text = read(file);
    const version = field(text, /^PackageVersion:\s*(\S+)$/m, file, 'PackageVersion');
    expect(version === wingetVersion, `${file}: PackageVersion ${version} != ${wingetVersion}`);
    if (file.includes('locale')) {
      expect(
        text.includes(`/releases/tag/v${wingetVersion}`),
        `${file}: ReleaseNotesUrl does not point at v${wingetVersion}`
      );
    }
  }
  const installerFile = `${WINGET}/RiverZhou.rustmd.installer.yaml`;
  const installer = read(installerFile);
  const url = field(installer, /^\s*InstallerUrl:\s*(\S+)$/m, `${installerFile}`, 'InstallerUrl');
  const digest = field(
    installer,
    /^\s*InstallerSha256:\s*(\S+)$/m,
    `${installerFile}`,
    'InstallerSha256'
  );
  const asset = `rustmd-${wingetVersion}-win-x64-portable.zip`;
  expect(
    url === `https://github.com/riverzhou/rustmd/releases/download/v${wingetVersion}/${asset}`,
    `${installerFile}: InstallerUrl does not match v${wingetVersion}/${asset}`
  );
  expect(digest !== null && sha256.test(digest), `${installerFile}: InstallerSha256 is not 64 hex chars`);
  expect(
    /NestedInstallerFiles:\s*\n\s*-\s*RelativeFilePath:\s*rustmd\.exe/.test(installer),
    `${installerFile}: portable nested installer must point at rustmd.exe (the zip is rootless)`
  );
  notes.push(`winget ${wingetVersion}`);
}

// --- scoop ----------------------------------------------------------------
const SCOOP = 'packaging/scoop/rustmd.json';
const scoop = JSON.parse(read(SCOOP));
expect(semver.test(scoop.version), `${SCOOP}: invalid version ${scoop.version}`);
const scoopUrl = scoop.architecture?.['64bit']?.url || '';
const scoopHash = scoop.architecture?.['64bit']?.hash || '';
const scoopAsset = `rustmd-${scoop.version}-win-x64-portable.zip`;
expect(
  scoopUrl === `https://github.com/riverzhou/rustmd/releases/download/v${scoop.version}/${scoopAsset}`,
  `${SCOOP}: url does not match v${scoop.version}/${scoopAsset}`
);
expect(sha256.test(scoopHash), `${SCOOP}: hash is not 64 hex chars`);
expect(
  scoop.bin === 'rustmd.exe',
  `${SCOOP}: bin must be rustmd.exe (the zip is rootless)`
);
notes.push(`scoop ${scoop.version}`);

// --- homebrew -------------------------------------------------------------
const BREW = 'packaging/homebrew/Casks/rustmd.rb';
const brew = read(BREW);
const brewVersion = field(brew, /^\s*version\s+"([^"]+)"/m, BREW, 'version');
const brewHash = field(brew, /^\s*sha256\s+"([^"]+)"/m, BREW, 'sha256');
if (brewVersion) {
  expect(semver.test(brewVersion), `${BREW}: invalid version ${brewVersion}`);
  expect(
    brew.includes(`rustmd-#{version}-macos-arm64.dmg`),
    `${BREW}: url must use the rustmd-<version>-macos-arm64.dmg asset`
  );
  expect(
    brew.includes('releases/download/v#{version}/'),
    `${BREW}: url must use the v#{version} tag`
  );
}
expect(brewHash !== null && sha256.test(brewHash), `${BREW}: sha256 is not 64 hex chars`);
if (brewVersion) notes.push(`homebrew ${brewVersion}`);

// --- AUR ------------------------------------------------------------------
const AUR = 'packaging/aur/PKGBUILD';
const aur = read(AUR);
const aurVersion = field(aur, /^pkgver=(\S+)$/m, AUR, 'pkgver');
const aurHash = field(aur, /^sha256sums=\('([^']+)'\)$/m, AUR, 'sha256sums');
if (aurVersion) {
  expect(semver.test(aurVersion), `${AUR}: invalid pkgver ${aurVersion}`);
  expect(
    aur.includes(`releases/download/v\${pkgver}/rustmd_\${pkgver}_amd64.AppImage`),
    `${AUR}: source must use the rustmd_<version>_amd64.AppImage asset`
  );
  notes.push(`aur ${aurVersion}`);
}
expect(aurHash !== null && sha256.test(aurHash), `${AUR}: sha256sums is not 64 hex chars`);

// --- release bookkeeping --------------------------------------------------
for (const [file, version] of [
  [wingetVersionFile, wingetVersion],
  [SCOOP, scoop.version],
  [BREW, brewVersion],
  [AUR, aurVersion],
]) {
  const text = read(file);
  expect(
    text.length > 0,
    `${file}: empty manifest`
  );
  if (version && pkg.version !== version) {
    notes.push(
      `note: ${path.relative(root, path.join(root, file))} is at ${version} while ` +
        `package.json is ${pkg.version} (update manifests after the release assets exist)`
    );
  }
}

// README status lines are hand-written; at least do not let them name a
// version newer than any manifest.
const packagingReadme = read(README);
const mentioned = packagingReadme.match(/\b\d+\.\d+\.\d+\b/g) || [];
if (mentioned.length && pkg.version && !mentioned.includes(pkg.version)) {
  notes.push(`note: ${README} does not mention the current package version ${pkg.version}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`packaging manifests OK (${notes.filter((n) => !n.startsWith('note:')).join(', ')})`);
for (const note of notes.filter((n) => n.startsWith('note:'))) console.log(note);
