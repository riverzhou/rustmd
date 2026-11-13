#!/usr/bin/env node
// Fail CI when the dev self-test report did not pass. The app exits with the
// same verdict, but the report is the durable artifact and catches a missing
// file / empty run too.
import { readFileSync, existsSync } from 'node:fs';
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
const maxAgeHours = Number(
  process.env.RUSTMD_SELFTEST_MAX_AGE_HOURS || 24
);
if (report.ok !== true) errors.push('report.ok is not true');
if (report.startedAt) {
  const ageHours = (Date.now() - Date.parse(report.startedAt)) / 36e5;
  if (maxAgeHours > 0 && ageHours > maxAgeHours) {
    errors.push(
      `selftest report is stale: started ${report.startedAt} ` +
        `(${ageHours.toFixed(1)}h old; max ${maxAgeHours}h)`
    );
  }
} else {
  errors.push('report has no startedAt timestamp');
}
if (!Array.isArray(report.entries) || report.entries.length === 0) {
  errors.push('report has no entries');
}
if (Array.isArray(report.errors) && report.errors.length) {
  errors.push(...report.errors.map((e) => `selftest error: ${e}`));
}
for (const entry of report.entries || []) {
  if (!entry.path) errors.push('entry without path');
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
  }
  if (!entry.png || !(entry.png.bytes > 1000)) {
    errors.push(`${entry.path}: PNG missing or suspiciously small`);
  }
  if (!entry.pdf || !(entry.pdf.bytes > 1000)) {
    errors.push(`${entry.path}: PDF missing or suspiciously small`);
  }
  if (Array.isArray(entry.png?.imagePresence)) {
    for (const presence of entry.png.imagePresence) {
      if (!presence.present) {
        errors.push(`${entry.path}: image missing from PNG: ${presence.url}`);
      }
    }
  }
}

if (report.htmlCharset?.ok !== true) {
  errors.push('HTML export charset normalization did not pass');
}
if (report.dataAlignment?.csv !== true || report.dataAlignment?.txt !== true) {
  errors.push('CSV/TXT header alignment or column scope did not pass');
}
if (requireHtml && htmlEntries === 0) {
  errors.push('no HTML entry found (--require-html)');
}
if (requireData) {
  for (const [kind, count] of Object.entries(dataEntries)) {
    if (count === 0) errors.push(`no ${kind.toUpperCase()} entry found (--require-data)`);
  }
}

if (Array.isArray(report.warnings) && report.warnings.length) {
  for (const warning of report.warnings) {
    console.warn(`selftest warning: ${warning}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  `selftest report OK: ${report.entries.length} notes ` +
    `(html ${htmlEntries}, csv ${dataEntries.csv}, txt ${dataEntries.txt}, ` +
    `json ${dataEntries.json}), ${reportPath}`
);
