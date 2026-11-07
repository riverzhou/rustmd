#!/usr/bin/env node
// Fail CI when the dev self-test report did not pass. The app exits with the
// same verdict, but the report is the durable artifact and catches a missing
// file / empty run too.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const reportPath =
  process.argv[2] ||
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

const errors = [];
if (report.ok !== true) errors.push('report.ok is not true');
if (!Array.isArray(report.entries) || report.entries.length === 0) {
  errors.push('report has no entries');
}
if (Array.isArray(report.errors) && report.errors.length) {
  errors.push(...report.errors.map((e) => `selftest error: ${e}`));
}
for (const entry of report.entries || []) {
  if (!entry.path) errors.push('entry without path');
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

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  `selftest report OK: ${report.entries.length} notes, ${reportPath}`
);
