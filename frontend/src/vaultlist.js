// Pure helpers for the "recent notes folders" list used by the vault
// switcher. No DOM, storage or Tauri access, so `node --test` can cover the
// MRU/dedupe/pin rules directly.
//
// An entry is `{ dir, pinned }`. The list is kept most-recent-first; pinned
// entries are never evicted by the size cap (they are merely displayed above
// the unpinned ones). `rustmd-recent-dirs` used to store a plain string array,
// so every parser here still accepts that legacy shape.

export const RECENT_DIRS_MAX = 20;

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

/** Coerce a stored string or `{ dir, pinned }` object into an entry. */
function entryOf(value) {
  const raw = typeof value === 'string' ? value : value && value.dir;
  const dir = normalizeDirPath(raw);
  if (!dir) return null;
  return {
    dir,
    pinned: Boolean(value && typeof value === 'object' && value.pinned),
  };
}

function entriesOf(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const entry = entryOf(item);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Cap the list at `max` entries without ever dropping a pinned one. Pinned
 * entries occupy their slots first; the remaining slots go to the most recent
 * unpinned entries (storage order is MRU). If the user pins more than `max`
 * vaults the list necessarily exceeds the cap — pinned retention wins — but
 * in every other case the stored/displayed list stays within `max`.
 */
function trimEntries(entries, max) {
  const limit = limitOf(max);
  if (entries.length <= limit) return entries;
  const pinnedCount = entries.reduce(
    (count, entry) => count + (entry.pinned ? 1 : 0),
    0
  );
  let unpinnedSlots = Math.max(0, limit - pinnedCount);
  return entries.filter((entry) => {
    if (entry.pinned) return true;
    if (unpinnedSlots === 0) return false;
    unpinnedSlots -= 1;
    return true;
  });
}

function findIndex(list, dir, windows) {
  return list.findIndex((entry) => sameDir(entry.dir, dir, windows));
}

/**
 * Move `dir` to the front (most recent first), dropping duplicates. The
 * pinned flag of an existing entry is preserved.
 */
export function addRecentDir(
  list,
  dir,
  { max = RECENT_DIRS_MAX, windows = false } = {}
) {
  const limit = limitOf(max);
  const base = entriesOf(list);
  const value = normalizeDirPath(dir);
  if (!value) return trimEntries(base, limit);
  const existing = base[findIndex(base, value, windows)];
  const rest = base.filter((entry) => !sameDir(entry.dir, value, windows));
  return trimEntries(
    [{ dir: value, pinned: Boolean(existing && existing.pinned) }, ...rest],
    limit
  );
}

/** Forget one folder, leaving the relative order of the others unchanged. */
export function removeRecentDir(list, dir, { windows = false } = {}) {
  const base = entriesOf(list);
  const value = normalizeDirPath(dir);
  if (!value) return base;
  return base.filter((entry) => !sameDir(entry.dir, value, windows));
}

/**
 * Flip the pinned flag of one folder and move it to the front. Pinned folders
 * are displayed above the recent list and are exempt from the size cap.
 */
export function togglePinnedDir(
  list,
  dir,
  { max = RECENT_DIRS_MAX, windows = false } = {}
) {
  const limit = limitOf(max);
  const base = entriesOf(list);
  const value = normalizeDirPath(dir);
  if (!value) return trimEntries(base, limit);
  const index = findIndex(base, value, windows);
  const current = index >= 0 ? base[index] : null;
  const rest = base.filter((entry) => !sameDir(entry.dir, value, windows));
  return trimEntries(
    [{ dir: value, pinned: !(current && current.pinned) }, ...rest],
    limit
  );
}

/** True when `dir` is pinned in the persisted list. */
export function isPinnedDir(list, dir, { windows = false } = {}) {
  const base = entriesOf(list);
  return base.some((entry) => entry.pinned && sameDir(entry.dir, dir, windows));
}

/** Display order: pinned entries first, then the unpinned ones (both MRU). */
export function orderRecentDirs(list) {
  const base = entriesOf(list);
  return [...base.filter((entry) => entry.pinned), ...base.filter((entry) => !entry.pinned)];
}

/** Absolute paths of the pinned vaults, in MRU order. */
export function pinnedDirs(list) {
  return entriesOf(list)
    .filter((entry) => entry.pinned)
    .map((entry) => entry.dir);
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
    const entry = entryOf(item);
    if (!entry) continue;
    if (out.some((existing) => sameDir(existing.dir, entry.dir, windows))) continue;
    out.push(entry);
  }
  return trimEntries(out, limit);
}
