// Pure helpers for the "recent notes folders" list used by the vault
// switcher. No DOM, storage or Tauri access, so `node --test` can cover the
// MRU/dedupe rules directly.

export const RECENT_DIRS_MAX = 8;

/** Trim whitespace and trailing separators, keeping a filesystem root intact. */
export function normalizeDirPath(dir) {
  if (typeof dir !== 'string') return '';
  let value = dir.trim();
  if (!value) return '';
  // `C:\` / `C:/` must keep their separator; only strip *extra* trailing ones.
  if (/^[A-Za-z]:[\\/]+$/.test(value)) return value.slice(0, 2) + value[2];
  if (/^[\\/]+$/.test(value)) return '/';
  value = value.replace(/[\\/]+$/, '');
  return value;
}

function compareKey(dir, windows) {
  const value = normalizeDirPath(dir);
  if (!windows) return value;
  // Windows paths are case-insensitive and accept both separators.
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** True when two folder paths point at the same place. */
export function sameDir(a, b, windows = false) {
  const left = compareKey(a, windows);
  return Boolean(left) && left === compareKey(b, windows);
}

/** Last path segment, for the bold line in the switcher. */
export function dirDisplayName(dir) {
  const value = normalizeDirPath(dir);
  if (!value) return '';
  const parts = value.split(/[\\/]+/).filter(Boolean);
  if (!parts.length) return value;
  if (parts.length === 1 && /^[A-Za-z]:$/.test(parts[0])) return value;
  return parts[parts.length - 1];
}

function limitOf(max) {
  return Number.isInteger(max) && max > 0 ? max : RECENT_DIRS_MAX;
}

/** Move `dir` to the front (most recent first), dropping duplicates. */
export function addRecentDir(
  list,
  dir,
  { max = RECENT_DIRS_MAX, windows = false } = {}
) {
  const limit = limitOf(max);
  const value = normalizeDirPath(dir);
  const base = Array.isArray(list) ? list : [];
  if (!value) {
    return base.map(normalizeDirPath).filter(Boolean).slice(0, limit);
  }
  const rest = base
    .map(normalizeDirPath)
    .filter((item) => item && !sameDir(item, value, windows));
  return [value, ...rest].slice(0, limit);
}

/** Forget one folder, leaving the relative order of the others unchanged. */
export function removeRecentDir(list, dir, { windows = false } = {}) {
  if (!Array.isArray(list)) return [];
  const value = normalizeDirPath(dir);
  if (!value) return list.map(normalizeDirPath).filter(Boolean);
  return list
    .map(normalizeDirPath)
    .filter((item) => item && !sameDir(item, value, windows));
}

/** Parse the persisted JSON list, tolerating bad/legacy values. */
export function parseRecentDirs(
  raw,
  { max = RECENT_DIRS_MAX, windows = false } = {}
) {
  const limit = limitOf(max);
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw || '[]');
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const item of parsed) {
    const value = normalizeDirPath(item);
    if (!value) continue;
    if (out.some((existing) => sameDir(existing, value, windows))) continue;
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}
