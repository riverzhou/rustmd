#!/usr/bin/env node
// Fail CI when the dev self-test report did not pass. The app exits with the
// same verdict, but the report is the durable artifact and catches a missing
// file / empty run too.
//
// The report is NOT trusted on its own: every entry must have the PNG/PDF
// (and data HTML) artifacts that the self-test actually wrote, with exactly
// the recorded byte lengths, inside `report.config.outDir`. That makes a
// hand-written report or a report left over from an older run fail instead of
// turning the release gate green.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

const cliArgs = process.argv.slice(2);
const reportPath =
  cliArgs.find((arg) => !arg.startsWith('--')) ||
  path.join(
    process.env.RUSTMD_SELFTEST_OUT ||
      path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'rustmd-selftest'),
    'report.json'
  );

if (!existsSync(reportPath)) {
  console.error(`selftest report not found: ${reportPath}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`cannot parse selftest report: ${err.message}`);
  process.exit(1);
}

const requireHtml = process.argv.includes('--require-html');
const requireData = process.argv.includes('--require-data');
const errors = [];
let htmlEntries = 0;
const dataEntries = { csv: 0, txt: 0, json: 0 };
const NOTE_EXT = /\.(?:md|markdown|html?|csv|txt|json)$/i;
const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;

const rawMaxAge = process.env.RUSTMD_SELFTEST_MAX_AGE_HOURS;
const maxAgeHours = rawMaxAge === undefined || rawMaxAge === '' ? 24 : Number(rawMaxAge);
if (!Number.isFinite(maxAgeHours) || maxAgeHours < 0) {
  errors.push(
    `RUSTMD_SELFTEST_MAX_AGE_HOURS must be a non-negative number (got ${rawMaxAge})`
  );
}

if (report.ok !== true) errors.push('report.ok is not true');
if (!Array.isArray(report.entries) || report.entries.length === 0) {
  errors.push('report has no entries');
}
if (!Array.isArray(report.errors)) {
  errors.push('report.errors is not an array');
} else if (report.errors.length) {
  errors.push(...report.errors.map((e) => `selftest error: ${e}`));
}
if (!Array.isArray(report.warnings)) {
  errors.push('report.warnings is not an array');
}

// --- timestamps / freshness -------------------------------------------------
const started = Date.parse(report.startedAt);
const finished = Date.parse(report.finishedAt);
if (!Number.isFinite(started)) {
  errors.push(`report.startedAt is not a valid timestamp: ${report.startedAt}`);
}
if (!Number.isFinite(finished)) {
  errors.push(`report.finishedAt is not a valid timestamp: ${report.finishedAt}`);
}
if (Number.isFinite(started) && Number.isFinite(finished) && finished < started) {
  errors.push('report.finishedAt is before report.startedAt');
}
if (Number.isFinite(started) && maxAgeHours > 0) {
  const ageHours = (Date.now() - started) / 36e5;
  if (ageHours > maxAgeHours) {
    errors.push(
      `selftest report is stale: started ${report.startedAt} ` +
        `(${ageHours.toFixed(1)}h old; max ${maxAgeHours}h)`
    );
  }
}

// --- artifact directory -----------------------------------------------------
const configuredOut = report.config?.outDir;
const outDir =
  typeof configuredOut === 'string' && configuredOut.trim()
    ? configuredOut
    : path.dirname(reportPath);
if (typeof configuredOut !== 'string' || !configuredOut.trim()) {
  errors.push('report.config.outDir is missing');
}
if (!existsSync(outDir) || !statSync(outDir).isDirectory()) {
  errors.push(`selftest output directory does not exist: ${outDir}`);
}

/// Verify one artifact written by `selftest_write`. The size must equal the
/// recorded byte count: a truncated/stale file must not satisfy the gate.
function checkArtifact(entry, extension, expectedBytes, required = true) {
  if (typeof expectedBytes !== 'number' || !(expectedBytes > 0)) {
    if (required) errors.push(`${entry.path}: ${extension} byte count is missing`);
    return;
  }
  const file = path.join(outDir, `${entry.path}.${extension}`);
  if (!existsSync(file)) {
    errors.push(`${entry.path}: ${extension} artifact was not written (${file})`);
    return;
  }
  const stat = statSync(file);
  if (!stat.isFile()) {
    errors.push(`${entry.path}: ${extension} artifact is not a file (${file})`);
    return;
  }
  if (stat.size !== expectedBytes) {
    errors.push(
      `${entry.path}: ${extension} artifact size ${stat.size} does not match ` +
        `the report (${expectedBytes} bytes)`
    );
    return;
  }
  if (required && !(stat.size > 1000)) {
    errors.push(`${entry.path}: ${extension} artifact is suspiciously small`);
  }
  if (stat.size > MAX_ARTIFACT_BYTES) {
    errors.push(`${entry.path}: ${extension} artifact is implausibly large`);
  }
}

const seenPaths = new Set();
for (const entry of Array.isArray(report.entries) ? report.entries : []) {
  if (!entry || typeof entry !== 'object') {
    errors.push('entry is not an object');
    continue;
  }
  if (typeof entry.path !== 'string' || !entry.path) {
    errors.push('entry without path');
    continue;
  }
  if (seenPaths.has(entry.path)) {
    errors.push(`${entry.path}: duplicate entry`);
  }
  seenPaths.add(entry.path);
  if (typeof entry.kind !== 'string' || !entry.kind) {
    errors.push(`${entry.path}: entry has no kind`);
  }
  if (Object.prototype.hasOwnProperty.call(dataEntries, entry.kind)) {
    dataEntries[entry.kind] += 1;
    const render = entry.dataRender;
    if (!render || render.view !== true) {
      errors.push(`${entry.path}: data preview view is missing`);
    } else {
      if ((entry.kind === 'csv' || entry.kind === 'txt') && !(render.rows > 0)) {
        errors.push(`${entry.path}: data table has no rows`);
      }
      if (entry.kind === 'json' && !(render.groups > 0 && render.values > 0)) {
        errors.push(`${entry.path}: JSON inspector is empty`);
      }
      if (render.injected !== 0) {
        errors.push(`${entry.path}: note markup reached the data preview DOM`);
      }
    }
    if (!entry.htmlExport || !(entry.htmlExport.bytes > 100)) {
      errors.push(`${entry.path}: data HTML export missing or too small`);
    } else {
      if (entry.htmlExport.dataView !== true) {
        errors.push(`${entry.path}: exported HTML has no data view`);
      }
      if (entry.htmlExport.escapedMarkup !== true) {
        errors.push(`${entry.path}: note markup was not escaped in exported HTML`);
      }
      checkArtifact(entry, 'html', entry.htmlExport.bytes);
    }
  }
  if (entry.kind === 'html') {
    htmlEntries += 1;
    if (entry.render?.iframe !== true || entry.render?.ready !== true) {
      errors.push(`${entry.path}: HTML preview iframe did not become ready`);
    }
    if (!entry.png?.pixels || entry.png.pixels.w < 100 || entry.png.pixels.h < 100) {
      errors.push(`${entry.path}: HTML PNG dimensions are implausible`);
    } else if (entry.png.pixels.nonWhitePixels < 100) {
      errors.push(`${entry.path}: HTML PNG is essentially blank`);
    }
    if (entry.pdf?.magic !== '%PDF-') {
      errors.push(`${entry.path}: HTML PDF does not start with %PDF-`);
    }
    if (entry.png?.localImages > 0 && !(entry.png.inlinedImages > 0)) {
      errors.push(`${entry.path}: HTML local images were not inlined`);
    }
  }
  if (!entry.png || !(entry.png.bytes > 1000)) {
    errors.push(`${entry.path}: PNG missing or suspiciously small`);
  } else {
    checkArtifact(entry, 'png', entry.png.bytes);
  }
  if (!entry.pdf || !(entry.pdf.bytes > 1000)) {
    errors.push(`${entry.path}: PDF missing or suspiciously small`);
  } else {
    checkArtifact(entry, 'pdf', entry.pdf.bytes);
  }
  if (Array.isArray(entry.png?.imagePresence)) {
    for (const presence of entry.png.imagePresence) {
      if (!presence.present) {
        errors.push(`${entry.path}: image missing from PNG: ${presence.url}`);
      }
    }
  }
  // Local vault images are created and loaded locally, so their presence in
  // the exported PNG is strict — unlike remote images, which may be skipped
  // when the network is unavailable.
  if (entry.localImagesInSource > 0) {
    if (!Array.isArray(entry.png?.imagePresence) || entry.png.imagePresence.length === 0) {
      errors.push(`${entry.path}: local images were not verified in the PNG`);
    } else if (!entry.png.imagePresence.some((p) => String(p.url).startsWith('local:'))) {
      errors.push(`${entry.path}: local images are missing from the PNG report`);
    }
  }
  if (Array.isArray(entry.render?.localImgsLoaded) && entry.render.localImgsLoaded.some((ok) => !ok)) {
    errors.push(`${entry.path}: a local image failed to load in the preview`);
  }
}

// --- example coverage: every note in the fixture vault must have an entry ---
const examplesDir = report.config?.examplesDir;
if (typeof examplesDir === 'string' && examplesDir.trim() && existsSync(examplesDir)) {
  const expected = [];
  const walk = (dir, rel) => {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      if (dirent.name.startsWith('.') || dirent.isSymbolicLink()) continue;
      const nextRel = rel ? `${rel}/${dirent.name}` : dirent.name;
      if (dirent.isDirectory()) {
        walk(path.join(dir, dirent.name), nextRel);
      } else if (NOTE_EXT.test(dirent.name)) {
        expected.push(nextRel);
      }
    }
  };
  try {
    walk(examplesDir, '');
  } catch (err) {
    errors.push(`cannot list the examples directory: ${err.message}`);
  }
  for (const note of expected) {
    if (!seenPaths.has(note)) {
      errors.push(`${note}: example note is missing from the self-test report`);
    }
  }
  if (expected.length && report.entries.length < expected.length) {
    errors.push(
      `self-test covered ${report.entries.length} of ${expected.length} example notes`
    );
  }
}

if (report.htmlCharset?.ok !== true) {
  errors.push('HTML export charset normalization did not pass');
}
if (report.dataAlignment?.csv !== true || report.dataAlignment?.txt !== true) {
  errors.push('CSV/TXT header alignment or column scope did not pass');
}
if (requireHtml && htmlEntries === 0) {
  errors.push('no HTML note entry (--require-html)');
}
if (requireData && !(dataEntries.csv > 0 && dataEntries.txt > 0 && dataEntries.json > 0)) {
  errors.push(
    `missing data note coverage (csv=${dataEntries.csv}, txt=${dataEntries.txt}, ` +
      `json=${dataEntries.json})`
  );
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
for (const warning of report.warnings) {
  console.error(`selftest warning: ${warning}`);
}
console.log(
  `selftest report OK: ${report.entries.length} notes ` +
    `(html ${htmlEntries}, csv ${dataEntries.csv}, txt ${dataEntries.txt}, ` +
    `json ${dataEntries.json}), artifacts in ${outDir}`
);
