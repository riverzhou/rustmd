// Pure note-list helpers: file names, sorting, folder filtering and the
// folder tree. Kept free of DOM/state so `node --test` can cover them
// directly (the UI wiring lives in main.js).

export const SORT_MTIME = 'mtime';
export const SORT_NAME = 'name';
export const SORT_ASC = 'asc';
export const SORT_DESC = 'desc';
export const SORT_MODES = [SORT_MTIME, SORT_NAME];

const collator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

/** Normalize a sort key (legacy strings are keys, not states). */
export function normalizeSort(value) {
  return value === SORT_NAME ? SORT_NAME : SORT_MTIME;
}

/** Sensible first direction when the user switches sort key. */
export function defaultSortDir(key) {
  return normalizeSort(key) === SORT_NAME ? SORT_ASC : SORT_DESC;
}

export function normalizeSortDir(value, key = SORT_MTIME) {
  return value === SORT_ASC || value === SORT_DESC
    ? value
    : defaultSortDir(key);
}

/** Accept `{ key, dir }`, a legacy key string, or an empty value. */
export function normalizeSortState(sort) {
  if (typeof sort === 'string') {
    return { key: normalizeSort(sort), dir: defaultSortDir(sort) };
  }
  const key = normalizeSort(sort && sort.key);
  return { key, dir: normalizeSortDir(sort && sort.dir, key) };
}

export function fileNameOf(path) {
  const normalized = String(path || '').replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

export const NOTE_KIND_MARKDOWN = 'markdown';
export const NOTE_KIND_HTML = 'html';

/** `"html"` for `.html`/`.htm`, `"markdown"` otherwise (mirrors Rust). */
export function noteKindOf(path) {
  return /\.(?:html|htm)$/i.test(fileNameOf(path))
    ? NOTE_KIND_HTML
    : NOTE_KIND_MARKDOWN;
}

/** File name without the note extension (`.md`, `.html`, `.htm`). */
export function noteStemOf(path) {
  return fileNameOf(path).replace(/\.(?:md|html|htm)$/i, '');
}

export function folderOf(path) {
  const normalized = String(path || '').replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx < 0 ? '' : normalized.slice(0, idx);
}

export function compareFileNames(a, b) {
  return collator.compare(fileNameOf(a), fileNameOf(b));
}

export function comparePaths(a, b) {
  return collator.compare(String(a || ''), String(b || ''));
}

export function compareNotes(a, b, sort) {
  const { key, dir } = normalizeSortState(sort);
  const sign = dir === SORT_ASC ? 1 : -1;
  if (key === SORT_NAME) {
    return (
      sign * compareFileNames(a.path, b.path) || comparePaths(a.path, b.path)
    );
  }
  return (
    sign * ((Number(a.mtime) || 0) - (Number(b.mtime) || 0)) ||
    compareFileNames(a.path, b.path) ||
    comparePaths(a.path, b.path)
  );
}

export function sortNotes(notes, sort) {
  const state = normalizeSortState(sort);
  return [...notes].sort((a, b) => compareNotes(a, b, state));
}

/** True when a note in `noteFolder` belongs to the selected folder subtree. */
export function folderMatches(noteFolder, selected) {
  if (!selected) return true;
  const folder = String(noteFolder || '');
  return folder === selected || folder.startsWith(`${selected}/`);
}

export function filterNotes(notes, { folder = null, tag = null } = {}) {
  return notes.filter(
    (note) =>
      folderMatches(note.folder, folder) &&
      (!tag || (Array.isArray(note.tags) && note.tags.includes(tag)))
  );
}

function makeNode(name, path) {
  return {
    name,
    path,
    children: new Map(),
    count: 0,
    direct: 0,
  };
}

/**
 * Build the folder hierarchy from the backend's full folder list (including
 * empty folders) and the notes (which contribute missing ancestors and
 * subtree counts). `count` includes descendants; `direct` is the number of
 * notes sitting exactly in that folder.
 */
export function buildFolderTree(folderPaths = [], notes = []) {
  const root = makeNode('', '');
  const ensure = (folderPath) => {
    const clean = String(folderPath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');
    if (!clean) return root;
    let node = root;
    let acc = '';
    for (const part of clean.split('/')) {
      if (!part) continue;
      acc = acc ? `${acc}/${part}` : part;
      if (!node.children.has(part)) {
        node.children.set(part, makeNode(part, acc));
      }
      node = node.children.get(part);
    }
    return node;
  };

  for (const folderPath of folderPaths) ensure(folderPath);
  for (const note of notes) ensure(note.folder);

  for (const note of notes) {
    root.count += 1;
    let node = root;
    const folder = String(note.folder || '')
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');
    if (folder) {
      for (const part of folder.split('/')) {
        if (!part) continue;
        node = node.children.get(part);
        if (!node) break;
        node.count += 1;
      }
      if (node) node.direct += 1;
    }
  }

  const convert = (node) =>
    [...node.children.values()]
      .map((child) => ({
        name: child.name,
        path: child.path,
        count: child.count,
        direct: child.direct,
        children: convert(child),
      }))
      .sort((a, b) => collator.compare(a.name, b.name));

  return convert(root);
}

/** Depth-first list of visible nodes, honouring the expansion predicate. */
export function flattenFolderTree(tree, isExpanded = () => true, depth = 0) {
  const out = [];
  for (const node of tree) {
    out.push({ ...node, depth });
    if (node.children.length > 0 && isExpanded(node.path)) {
      out.push(...flattenFolderTree(node.children, isExpanded, depth + 1));
    }
  }
  return out;
}

/** All ancestor folder paths (`a/b/c` → `a`, `a/b`). */
export function ancestorFolders(folderPath) {
  const parts = String(folderPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);
  const out = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'));
  return out;
}
