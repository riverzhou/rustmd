import './style.css';
import { api } from './api.js';
import { createEditor } from './editor.js';
import {
  renderPreview,
  buildExportHtml,
  setPreviewTheme,
  setImageContext,
} from './preview.js';
import { exportPng, exportPdf } from './export.js';
import {
  applyStaticTranslations,
  getLanguage,
  initI18n,
  onLanguageChange,
  setLanguage,
  t,
} from './i18n.js';
import {
  SORT_ASC,
  SORT_DESC,
  SORT_MTIME,
  buildFolderTree,
  defaultSortDir,
  fileNameOf,
  filterNotes,
  flattenFolderTree,
  folderOf,
  normalizeSortState,
  sortNotes,
} from './notelist.js';

// ---------------- State ----------------

initI18n();

function loadExpandedFolders() {
  try {
    const raw = JSON.parse(localStorage.getItem('rustmd-expanded-folders') || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

const initialSort = normalizeSortState({
  key:
    localStorage.getItem('rustmd-sort-key') ||
    localStorage.getItem('rustmd-sort') ||
    undefined,
  dir: localStorage.getItem('rustmd-sort-dir') || undefined,
});

const state = {
  dir: localStorage.getItem('rustmd-dir'),
  notes: [],
  folderPaths: [],
  folderTree: [],
  tags: [], // [{ name, count }]
  current: null, // relative path
  currentHash: '',
  currentMtime: 0,
  tagsOfCurrent: [],
  view: localStorage.getItem('rustmd-view') || 'split',
  // Default theme is LIGHT regardless of the OS setting (v1.0): the app's
  // light palette is the house style. A manual toggle is still persisted in
  // localStorage and always wins once the user has chosen one.
  theme: localStorage.getItem('rustmd-theme') || 'light',
  sortKey: initialSort.key,
  sortDir: initialSort.dir,
  expandedFolders: loadExpandedFolders(),
  filter: { folder: null, tag: null, query: '' },
  searchHits: null,
  saveTimer: null,
  previewTimer: null,
  pendingSave: false,
  saveFailed: false,
  saveStatus: 'saved',
  docRevision: 0,
};

let editor = null;
// True while we dispatch a programmatic document replacement (loading a
// note, clearing after delete). CodeMirror fires its update listener
// synchronously during dispatch, which would otherwise mark the note as
// dirty and schedule a spurious save of the just-loaded content.
let suppressChange = false;

// ---------------- DOM refs ----------------

const $ = (id) => document.getElementById(id);
const onboardingEl = $('onboarding');
const mainEl = $('main');
const dirInput = $('dir-input');
const onboardingError = $('onboarding-error');
const searchInput = $('search-input');
const folderList = $('folder-list');
const tagCloud = $('tag-cloud');
const noteList = $('note-list');
const noteCount = $('note-count');
const sortSwitch = $('sort-switch');
const sortDirBtn = $('sort-dir');
const editorPane = $('editor-pane');
const emptyState = $('empty-state');
const noteTitle = $('note-title');
const tagEditor = $('tag-editor');
const workspace = $('workspace');
const editorHolder = $('editor-holder');
const previewEl = $('preview');
const divider = $('divider');
const statusSave = $('status-save');
const statusPath = $('status-path');
const statusCounts = $('status-counts');
const toastEl = $('toast');

// ---------------- Utils ----------------

const SAVE_STATUS_KEYS = {
  saved: 'status.saved',
  unsaved: 'status.unsaved',
  failed: 'status.saveFailed',
  conflict: 'status.conflict',
};

function setSaveStatus(kind) {
  state.saveStatus = kind;
  statusSave.textContent = t(SAVE_STATUS_KEYS[kind] || SAVE_STATUS_KEYS.saved);
  statusSave.className =
    kind === 'saved' ? '' : kind === 'unsaved' ? 'saving' : 'error';
}

let toastTimer = null;
function toast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  toastEl.classList.toggle('error', isError);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3200);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function highlightText(text, query) {
  const safe = esc(text);
  if (!query || /[&<>"']/.test(query)) return safe;
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return safe.replace(re, (m) => `<mark>${m}</mark>`);
}

function uiLocale() {
  return getLanguage() === 'zh-CN' ? 'zh-CN' : 'en-US';
}

function fmtTime(mtime) {
  if (!mtime || mtime <= 0) return '—';
  const d = new Date(mtime * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(uiLocale(), {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  const y = d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()}/`;
  return `${y}${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function fmtFullTime(mtime) {
  if (!mtime || mtime <= 0) return t('time.unknown');
  return new Date(mtime * 1000).toLocaleString(uiLocale(), { hour12: false });
}

function countWords(text) {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin =
    (text
      .replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, ' ')
      .match(/[A-Za-z0-9_'-]+/g) || []).length;
  return cjk + latin;
}

function stemOf(path) {
  return fileNameOf(path).replace(/\.md$/i, '');
}

const FOLDER_SVG =
  '<svg class="folder-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.2c0-.67.53-1.2 1.2-1.2h2.6l1.4 1.8h4.6c.67 0 1.2.53 1.2 1.2v6c0 .67-.53 1.2-1.2 1.2H3.7c-.67 0-1.2-.53-1.2-1.2z"/></svg>';

const CHEVRON_SVG =
  '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l4 4-4 4"/></svg>';

// ---------------- Theme ----------------

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem('rustmd-theme', theme);
  setPreviewTheme(theme);
  const link = $('hljs-theme');
  if (link) link.href = theme === 'dark' ? '/hljs/github-dark.css' : '/hljs/github.css';
  // Mermaid bakes its theme in at render time; re-render the open note so
  // diagrams match the new theme.
  if (state.current && editor && editor.state.doc.length) {
    renderPreview(editor.state.doc.toString(), previewEl);
  }
}

$('btn-theme').addEventListener('click', () => {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
});

// ---------------- View mode ----------------

function applyView(mode) {
  state.view = mode;
  workspace.dataset.mode = mode;
  localStorage.setItem('rustmd-view', mode);
  for (const btn of $('view-switch').querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  }
}

$('view-switch').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (btn) applyView(btn.dataset.mode);
});

// ---------------- Sidebar visibility ----------------

function isSidebarCollapsed() {
  return mainEl.classList.contains('sidebar-collapsed');
}

function applySidebar(collapsed) {
  mainEl.classList.toggle('sidebar-collapsed', collapsed);
  localStorage.setItem('rustmd-sidebar', collapsed ? 'closed' : 'open');
  // Floating button re-opens the list; the topbar button is only visible
  // while a note is open, so this also covers the empty state.
  $('btn-show-sidebar').classList.toggle('hidden', !collapsed);
  emptyState.querySelector('p').textContent = collapsed
    ? t('empty.collapsed')
    : t('empty.normal');
}

function toggleSidebar() {
  applySidebar(!isSidebarCollapsed());
}

$('btn-toggle-sidebar').addEventListener('click', toggleSidebar);
$('btn-show-sidebar').addEventListener('click', toggleSidebar);

// ---------------- Keyboard shortcuts ----------------

window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  switch (e.key.toLowerCase()) {
    case '1':
      e.preventDefault();
      applyView('edit');
      break;
    case '2':
      e.preventDefault();
      applyView('split');
      break;
    case '3':
      e.preventDefault();
      applyView('preview');
      break;
    case 'b':
      e.preventDefault();
      toggleSidebar();
      break;
  }
});

// ---------------- Onboarding / dir ----------------

async function enterDir(dir) {
  let notes;
  try {
    notes = await api.listNotes(dir);
    // The `rmd` image protocol serves from this root (local images in notes).
    await api.setNotesRoot(dir);
  } catch (err) {
    onboardingError.textContent = t('onboarding.openError', {
      msg: err.message || err,
    });
    onboardingError.classList.remove('hidden');
    return false;
  }
  onboardingError.classList.add('hidden');
  // Let an in-flight save finish before the old vault's state is discarded.
  await saveQueue.catch(() => false);
  state.dir = dir;
  localStorage.setItem('rustmd-dir', dir);
  // A new vault must not inherit the previous vault's selection/filter,
  // editor contents or stale conflict token.
  state.filter = { folder: null, tag: null, query: '' };
  state.searchHits = null;
  state.current = null;
  state.currentHash = '';
  state.currentMtime = 0;
  state.tagsOfCurrent = [];
  clearTimeout(state.saveTimer);
  clearTimeout(state.previewTimer);
  state.pendingSave = false;
  state.saveFailed = false;
  searchInput.value = '';
  noteTitle.value = '';
  statusPath.textContent = '';
  suppressChange = true;
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '' } });
  suppressChange = false;
  renderPreview('', previewEl);
  renderTagEditor();
  updateCounts();
  setSaveStatus('saved');
  editorPane.classList.remove('visible');
  emptyState.classList.remove('hidden');
  onboardingEl.classList.add('hidden');
  mainEl.classList.remove('hidden');
  state.notes = notes;
  await loadNotes();
  return true;
}

$('pick-dir-btn').addEventListener('click', async () => {
  try {
    const dir = await api.pickDirectory(t('onboarding.dirDialogTitle'));
    if (dir) dirInput.value = dir;
  } catch (err) {
    toast(t('onboarding.browseFailed', { msg: err.message || err }), true);
  }
});

$('open-dir-btn').addEventListener('click', () => {
  const dir = dirInput.value.trim();
  if (!dir) {
    onboardingError.textContent = t('onboarding.chooseError');
    onboardingError.classList.remove('hidden');
    return;
  }
  enterDir(dir);
});

dirInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('open-dir-btn').click();
});

$('btn-change-dir').addEventListener('click', async () => {
  const ok = await flushSave();
  if (!ok && !confirm(t('dialog.changeDir'))) {
    return;
  }
  mainEl.classList.add('hidden');
  onboardingEl.classList.remove('hidden');
  dirInput.value = state.dir || '';
});

// ---------------- Notes loading ----------------

function deriveFolderPaths(notes) {
  const paths = new Set();
  for (const note of notes) {
    let acc = '';
    for (const part of String(note.folder || '').split('/')) {
      if (!part) continue;
      acc = acc ? `${acc}/${part}` : part;
      paths.add(acc);
    }
  }
  return [...paths];
}

async function refreshSearch() {
  if (!state.filter.query) {
    state.searchHits = null;
    return;
  }
  const query = state.filter.query;
  const seq = ++searchSeq;
  try {
    const hits = await api.searchNotes(state.dir, query);
    if (seq !== searchSeq || query !== state.filter.query) return;
    state.searchHits = hits;
  } catch (err) {
    if (seq !== searchSeq || query !== state.filter.query) return;
    toast(t('toast.searchFailed', { msg: err.message || err }), true);
    state.searchHits = [];
  }
}

async function loadNotes() {
  try {
    const [notes, folders] = await Promise.all([
      api.listNotes(state.dir),
      api.listFolders(state.dir).catch(() => null),
    ]);
    state.notes = notes;
    state.folderPaths = folders || deriveFolderPaths(notes);
  } catch (err) {
    toast(t('toast.readFailed', { msg: err.message || err }), true);
    return;
  }
  state.folderTree = buildFolderTree(state.folderPaths, state.notes);
  // tags
  const tagMap = new Map();
  for (const n of state.notes) {
    for (const t of n.tags) tagMap.set(t, (tagMap.get(t) || 0) + 1);
  }
  state.tags = [...tagMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  await refreshSearch();
  renderFolders();
  renderTags();
  renderNoteList();
}

function persistExpandedFolders() {
  localStorage.setItem(
    'rustmd-expanded-folders',
    JSON.stringify([...state.expandedFolders])
  );
}

function selectFolder(path) {
  state.filter.folder = state.filter.folder === path ? null : path;
  renderFolders();
  renderNoteList();
}

function toggleFolder(path) {
  // Expanded, not collapsed: an empty set means every folder starts closed
  // (subfolders are hidden until the user opens their parent).
  if (state.expandedFolders.has(path)) state.expandedFolders.delete(path);
  else state.expandedFolders.add(path);
  persistExpandedFolders();
  renderFolders();
}

function renderFolderBranch(nodes, parentEl, depth) {
  for (const node of nodes) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'nav-item' + (state.filter.folder === node.path ? ' active' : '');
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.title = node.path;

    const hasChildren = node.children.length > 0;
    const expanded = state.expandedFolders.has(node.path);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.classList.toggle('collapsed', !expanded);
    toggle.classList.toggle('invisible', !hasChildren);
    toggle.disabled = !hasChildren;
    toggle.title = t(expanded ? 'folder.collapse' : 'folder.expand');
    toggle.setAttribute(
      'aria-label',
      t(expanded ? 'folder.collapseAria' : 'folder.expandAria', {
        path: node.path,
      })
    );
    toggle.innerHTML = CHEVRON_SVG;
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      if (hasChildren) toggleFolder(node.path);
    });
    row.appendChild(toggle);
    row.insertAdjacentHTML(
      'beforeend',
      `${FOLDER_SVG}<span class="nav-label">${esc(node.name)}</span><span class="count">${node.count}</span>`
    );
    row.addEventListener('click', () => selectFolder(node.path));
    li.appendChild(row);

    if (hasChildren && expanded) {
      const children = document.createElement('ul');
      children.className = 'nav-list folder-children';
      renderFolderBranch(node.children, children, depth + 1);
      li.appendChild(children);
    }
    parentEl.appendChild(li);
  }
}

function renderFolders() {
  const nav = folderList.closest('.sidebar-nav');
  const navScroll = nav ? nav.scrollTop : 0;
  folderList.innerHTML = '';
  const allItem = document.createElement('li');
  allItem.className = 'nav-item' + (state.filter.folder === null ? ' active' : '');
  allItem.innerHTML = `${FOLDER_SVG}<span class="nav-label">${esc(
    t('sidebar.all')
  )}</span><span class="count">${state.notes.length}</span>`;
  allItem.addEventListener('click', () => {
    state.filter.folder = null;
    renderFolders();
    renderNoteList();
  });
  folderList.appendChild(allItem);
  renderFolderBranch(state.folderTree, folderList, 0);
  if (nav) nav.scrollTop = navScroll;
}

function renderTags() {
  tagCloud.innerHTML = '';
  if (state.tags.length === 0) {
    tagCloud.innerHTML = `<span style="font-size:12px;color:var(--text-faint)">${esc(
      t('sidebar.noTags')
    )}</span>`;
    return;
  }
  for (const t of state.tags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip' + (state.filter.tag === t.name ? ' active' : '');
    chip.innerHTML = `${esc(t.name)}<span class="count">${t.count}</span>`;
    chip.addEventListener('click', () => {
      state.filter.tag = state.filter.tag === t.name ? null : t.name;
      renderTags();
      renderNoteList();
    });
    tagCloud.appendChild(chip);
  }
}

function visibleNotes() {
  let list = state.searchHits
    ? state.searchHits.map((h) => ({ ...h.meta, searchSnippet: h.snippet }))
    : state.notes;
  list = filterNotes(list, state.filter);
  return sortNotes(list, { key: state.sortKey, dir: state.sortDir });
}

function renderNoteList() {
  const list = visibleNotes();
  const scrollTop = noteList.scrollTop;
  noteCount.textContent = t('notes.count', { n: list.length });
  noteList.innerHTML = '';
  if (list.length === 0) {
    noteList.innerHTML =
      '<div class="note-empty">' +
      (state.filter.query ? t('notes.noMatches') : t('notes.empty')) +
      '</div>';
    noteList.scrollTop = 0;
    return;
  }
  for (const n of list) {
    const item = document.createElement('div');
    item.className = 'note-item' + (n.path === state.current ? ' active' : '');
    item.dataset.path = n.path;
    item.title = n.folder ? `${n.folder}/${fileNameOf(n.path)}` : fileNameOf(n.path);
    const snippet = state.filter.query ? n.searchSnippet || n.snippet : n.snippet;
    const metaBits = [];
    if (n.folder) metaBits.push(`<span class="folder-path">${esc(n.folder)}</span>`);
    metaBits.push(
      `<span title="${esc(fmtFullTime(n.mtime))}">${esc(fmtTime(n.mtime))}</span>`
    );
    for (const t of n.tags.slice(0, 3)) {
      metaBits.push(`<span class="mini-tag">${esc(t)}</span>`);
    }
    item.innerHTML = `
      <div class="title">${highlightText(n.title, state.filter.query)}</div>
      <div class="file-name">${highlightText(fileNameOf(n.path), state.filter.query)}</div>
      ${snippet ? `<div class="snippet">${highlightText(snippet, state.filter.query)}</div>` : ''}
      <div class="meta">${metaBits.join('<span class="sep">·</span>')}</div>`;
    item.addEventListener('click', () => selectNote(n.path));
    noteList.appendChild(item);
  }
  noteList.scrollTop = scrollTop;
}

function renderSortControls() {
  for (const btn of sortSwitch.querySelectorAll('button[data-sort]')) {
    btn.classList.toggle('active', btn.dataset.sort === state.sortKey);
  }
  if (!sortDirBtn) return;
  sortDirBtn.textContent = state.sortDir === SORT_ASC ? '↑' : '↓';
  const field = t(
    state.sortKey === SORT_MTIME ? 'sort.timeField' : 'sort.nameField'
  );
  const direction = t(state.sortDir === SORT_ASC ? 'sort.asc' : 'sort.desc');
  sortDirBtn.title = t('sort.dirTitle', { field, direction });
  sortDirBtn.setAttribute('aria-label', t('sort.dirAria', { field, direction }));
  for (const btn of sortSwitch.querySelectorAll('button[data-sort]')) {
    btn.title = t(
      btn.dataset.sort === SORT_MTIME ? 'sort.timeTitle' : 'sort.nameTitle'
    );
  }
}

function commitSort() {
  localStorage.setItem('rustmd-sort-key', state.sortKey);
  localStorage.setItem('rustmd-sort-dir', state.sortDir);
  renderSortControls();
  renderNoteList();
}

function toggleSortDir() {
  state.sortDir = state.sortDir === SORT_ASC ? SORT_DESC : SORT_ASC;
  commitSort();
}

sortSwitch.addEventListener('click', (e) => {
  if (e.target.closest('#sort-dir')) {
    toggleSortDir();
    return;
  }
  const btn = e.target.closest('button[data-sort]');
  if (!btn) return;
  if (btn.dataset.sort === state.sortKey) {
    // Clicking the active field is a shortcut for the direction button.
    toggleSortDir();
    return;
  }
  state.sortKey = btn.dataset.sort;
  state.sortDir = defaultSortDir(state.sortKey);
  commitSort();
});

// ---------------- Note selection & editing ----------------

function initEditor() {
  editor = createEditor(editorHolder, { onChange: onEditorChange });
  // one-way proportional scroll sync (editor -> preview)
  editor.scrollDOM.addEventListener('scroll', () => {
    if (state.view !== 'split') return;
    const s = editor.scrollDOM;
    const max = s.scrollHeight - s.clientHeight;
    if (max <= 0) return;
    const ratio = s.scrollTop / max;
    const holder = previewEl.parentElement;
    holder.scrollTop = ratio * (holder.scrollHeight - holder.clientHeight);
  });
}

function scheduleSave() {
  state.pendingSave = true;
  state.saveFailed = false;
  setSaveStatus('unsaved');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    void saveCurrent();
  }, 500);
}

function onEditorChange() {
  if (suppressChange) return;
  if (!state.current) return;
  state.docRevision += 1;
  scheduleSave();
  // Debounce the preview: re-parsing the whole document (and re-rendering
  // every mermaid diagram) on each keystroke used to exhaust the WebView2
  // renderer. 250 ms is imperceptible and collapses a typing burst into one
  // render. The path guard drops the update if the note is switched/closed
  // before the timer fires.
  const path = state.current;
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(() => {
    if (state.current === path && editor) {
      renderPreview(editor.state.doc.toString(), previewEl);
    }
  }, 250);
  updateCounts();
}

function updateNoteInState(meta) {
  const idx = state.notes.findIndex((n) => n.path === meta.path);
  if (idx >= 0) state.notes[idx] = meta;
  else state.notes.push(meta);
  state.folderTree = buildFolderTree(state.folderPaths, state.notes);
}

function recomputeTags() {
  const tagMap = new Map();
  for (const n of state.notes) {
    for (const t of n.tags) tagMap.set(t, (tagMap.get(t) || 0) + 1);
  }
  state.tags = [...tagMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

let saveQueue = Promise.resolve(true);

function saveCurrent(force = false) {
  const path = state.current;
  if (!path || !editor) return Promise.resolve(true);
  const body = editor.state.doc.toString();
  const tags = [...state.tagsOfCurrent];
  const revision = state.docRevision;

  const run = async () => {
    // Read the base token inside the serialized run, not at enqueue time: a
    // queued save must compare against the hash written by the save before it,
    // not the stale pre-save hash (that would report a false conflict).
    const baseHash = state.currentHash;
    const baseMtime = state.currentMtime;
    let meta;
    try {
      meta = await api.saveNote(
        state.dir,
        path,
        tags,
        body,
        baseHash,
        baseMtime,
        force
      );
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (!force && msg.includes('conflict')) {
        const overwrite = confirm(t('dialog.conflict'));
        if (overwrite) {
          try {
            meta = await api.saveNote(
              state.dir,
              path,
              tags,
              body,
              baseHash,
              baseMtime,
              true
            );
          } catch (retryErr) {
            return reportSaveFailure(retryErr, path);
          }
        } else {
          state.pendingSave = true;
          state.saveFailed = true;
          if (state.current === path) {
            setSaveStatus('conflict');
          }
          return false;
        }
      } else {
        return reportSaveFailure(err, path);
      }
    }

    updateNoteInState(meta);
    recomputeTags();
    if (state.current === path) {
      state.currentHash = meta.hash;
      state.currentMtime = meta.mtime;
      if (state.docRevision === revision) {
        state.pendingSave = false;
        state.saveFailed = false;
        setSaveStatus('saved');
      } else {
        // More typing happened while the save was in flight.
        scheduleSave();
      }
      if (document.activeElement !== noteTitle) {
        noteTitle.value = stemOf(path);
      }
    }
    renderFolders();
    renderTags();
    if (state.filter.query) {
      await refreshSearch();
    }
    renderNoteList();
    return true;
  };

  const next = saveQueue.then(run, run);
  saveQueue = next.catch(() => false);
  return next;
}

function reportSaveFailure(err, path) {
  const msg = String(err && err.message ? err.message : err);
  state.pendingSave = true;
  state.saveFailed = true;
  if (state.current === path) {
    setSaveStatus('failed');
  }
  toast(t('toast.saveFailed', { msg }), true);
  return false;
}

async function flushSave() {
  clearTimeout(state.saveTimer);
  try {
    if (!state.pendingSave) {
      await saveQueue;
      return true;
    }
    let ok = await saveCurrent(false);
    // A change made while the save was in flight marks the note dirty again.
    for (let i = 0; i < 3 && ok && state.pendingSave; i++) {
      ok = await saveCurrent(false);
    }
    return ok;
  } catch (err) {
    reportSaveFailure(err, state.current);
    return false;
  }
}

async function selectNote(path) {
  if (path === state.current) return;
  const ok = await flushSave();
  if (!ok && !confirm(t('dialog.switchNote'))) {
    return;
  }
  if (!ok) {
    state.pendingSave = false;
    state.saveFailed = false;
  }
  try {
    const content = await api.readNote(state.dir, path);
    state.current = path;
    state.currentHash = content.hash || '';
    state.currentMtime = content.mtime || 0;
    // Local images resolve relative to THIS note's folder.
    setImageContext(state.dir, path);
    state.tagsOfCurrent = content.tags;
    // Loading must not mark the note dirty (a spurious save right after
    // opening would re-touch the file and, under `tauri dev`, retrigger the
    // file watcher → app restart loop → "window closed" + "files gone").
    suppressChange = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: content.body },
    });
    suppressChange = false;
    editor.scrollDOM.scrollTop = 0;
    clearTimeout(state.previewTimer); // drop the previous note's pending update
    renderPreview(content.body, previewEl);
    noteTitle.value = stemOf(path);
    renderTagEditor();
    updateCounts();
    statusPath.textContent = path;
    setSaveStatus('saved');
    editorPane.classList.add('visible');
    emptyState.classList.add('hidden');
    renderNoteList();
    editor.focus();
  } catch (err) {
    toast(t('toast.openFailed', { msg: err.message || err }), true);
  }
}

function updateCounts() {
  const text = editor ? editor.state.doc.toString() : '';
  const words = countWords(text);
  const chars = text.replace(/\s/g, '').length;
  statusCounts.textContent = t('note.counts', { words, chars });
}

// ---------------- Title (rename) ----------------

// Suppress rename-commit when the user mousedowns elsewhere (e.g. the note
// list) so clicking another note doesn't race the blur commit.
let suppressRename = false;
noteList.addEventListener('mousedown', () => {
  suppressRename = true;
});
window.addEventListener('mouseup', () => {
  setTimeout(() => {
    suppressRename = false;
  }, 0);
});

async function commitRename() {
  if (!state.current) return;
  const value = noteTitle.value.trim();
  const stem = stemOf(state.current);
  if (!value || value === stem || suppressRename) {
    noteTitle.value = stem;
    return;
  }
  const ok = await flushSave();
  if (!ok) {
    noteTitle.value = stem;
    return;
  }
  try {
    const newPath = await api.renameNote(state.dir, state.current, value);
    state.current = newPath;
    setImageContext(state.dir, newPath); // image resolution follows the note
    statusPath.textContent = newPath;
    noteTitle.value = stemOf(newPath);
    await loadNotes();
    const meta = state.notes.find((n) => n.path === newPath);
    if (meta) {
      state.currentHash = meta.hash || '';
      state.currentMtime = meta.mtime || 0;
    }
    renderNoteList();
    toast(t('toast.renamed', { name: stemOf(newPath) }));
  } catch (err) {
    noteTitle.value = stem;
    toast(t('toast.renameFailed', { msg: err.message || err }), true);
  }
}

noteTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.target.blur();
  }
});
noteTitle.addEventListener('blur', commitRename);
$('btn-rename').addEventListener('click', () => {
  if (!state.current) return;
  noteTitle.focus();
  noteTitle.select();
});

// ---------------- Tags ----------------

function renderTagEditor() {
  tagEditor.innerHTML = '';
  for (const tag of state.tagsOfCurrent) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${esc(tag)}<span class="remove" title="${esc(
      t('tag.remove')
    )}">×</span>`;
    chip.querySelector('.remove').addEventListener('click', () => {
      state.tagsOfCurrent = state.tagsOfCurrent.filter((x) => x !== tag);
      renderTagEditor();
      onMetaChanged();
    });
    tagEditor.appendChild(chip);
  }
  const input = document.createElement('input');
  input.placeholder = t('tag.addPlaceholder');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = input.value.trim().replace(/,/g, '');
      if (v && !state.tagsOfCurrent.includes(v)) {
        state.tagsOfCurrent.push(v);
        renderTagEditor();
        onMetaChanged();
      }
      input.value = '';
    }
  });
  tagEditor.appendChild(input);
}

function onMetaChanged() {
  if (!state.current) return;
  state.docRevision += 1;
  scheduleSave();
}

// ---------------- New / delete / move ----------------

$('btn-new-note').addEventListener('click', async () => {
  if (!state.dir) return;
  const ok = await flushSave();
  if (!ok && !confirm(t('dialog.newNote'))) return;
  if (!ok) {
    state.pendingSave = false;
    state.saveFailed = false;
  }
  try {
    // A new note must be visible: clear an active search query first.
    searchInput.value = '';
    state.filter.query = '';
    state.searchHits = null;
    const path = await api.createNote(state.dir, state.filter.folder || '');
    await loadNotes();
    await selectNote(path);
  } catch (err) {
    toast(t('toast.newFailed', { msg: err.message || err }), true);
  }
});

$('btn-delete').addEventListener('click', async () => {
  if (!state.current) return;
  if (!confirm(t('dialog.delete', { title: noteTitle.value }))) return;
  clearTimeout(state.saveTimer);
  state.pendingSave = false;
  state.saveFailed = false;
  await saveQueue.catch(() => false);
  try {
    const deleted = state.current;
    await api.deleteNote(state.dir, deleted);
    state.current = null;
    state.currentHash = '';
    state.currentMtime = 0;
    state.tagsOfCurrent = [];
    suppressChange = true;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: '' },
    });
    suppressChange = false;
    renderPreview('', previewEl);
    noteTitle.value = '';
    renderTagEditor();
    updateCounts();
    setSaveStatus('saved');
    statusPath.textContent = '';
    editorPane.classList.remove('visible');
    emptyState.classList.remove('hidden');
    await loadNotes();
    toast(t('toast.deleted'));
  } catch (err) {
    toast(t('toast.deleteFailed', { msg: err.message || err }), true);
  }
});

$('btn-move').addEventListener('click', () => {
  if (!state.current) return;
  openMoveModal();
});

async function openMoveModal() {
  const ok = await flushSave();
  if (!ok) {
    toast(t('toast.moveCancelled'), true);
    return;
  }
  const options = [
    { path: '', label: t('move.root'), depth: 0 },
    ...flattenFolderTree(state.folderTree, () => true).map((node) => ({
      path: node.path,
      label: node.path,
      depth: node.depth,
    })),
  ];
  const currentFolder = folderOf(state.current);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<h3>${esc(t('move.title'))}</h3><div class="modal-list"></div>`;
  const list = modal.querySelector('.modal-list');
  for (const opt of options) {
    const item = document.createElement('div');
    item.className = 'modal-item';
    item.style.paddingLeft = `${12 + opt.depth * 16}px`;
    item.innerHTML = `${FOLDER_SVG}<span>${esc(opt.label)}</span>`;
    if (currentFolder === opt.path) {
      item.classList.add('current');
      item.title = t('move.current');
    }
    item.addEventListener('click', async () => {
      backdrop.remove();
      if (opt.path === currentFolder) return;
      try {
        const newPath = await api.moveNote(state.dir, state.current, opt.path);
        state.current = newPath;
        setImageContext(state.dir, newPath);
        // Relative image paths resolve against the note's NEW folder —
        // re-render so the preview's rmd URLs point at the right files.
        renderPreview(editor.state.doc.toString(), previewEl);
        statusPath.textContent = newPath;
        noteTitle.value = stemOf(newPath);
        await loadNotes();
        const meta = state.notes.find((n) => n.path === newPath);
        if (meta) {
          state.currentHash = meta.hash || '';
          state.currentMtime = meta.mtime || 0;
        }
        renderNoteList();
        toast(t('toast.moved', { path: opt.label }));
      } catch (err) {
        toast(t('toast.moveFailed', { msg: err.message || err }), true);
      }
    });
    list.appendChild(item);
  }
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

// ---------------- Search ----------------

let searchTimer = null;
let searchSeq = 0;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
});

async function runSearch() {
  const q = searchInput.value.trim();
  state.filter.query = q;
  const seq = ++searchSeq;
  if (!q) {
    state.searchHits = null;
    renderNoteList();
    return;
  }
  try {
    const hits = await api.searchNotes(state.dir, q);
    if (seq !== searchSeq) return; // a newer query already started
    state.searchHits = hits;
  } catch (err) {
    if (seq !== searchSeq) return;
    toast(t('toast.searchFailed', { msg: err.message || err }), true);
    state.searchHits = [];
  }
  renderNoteList();
}

// ---------------- Export ----------------

let exportMenu = null;

function onExportOutside(e) {
  if (exportMenu && !exportMenu.contains(e.target) && !e.target.closest('#btn-export')) {
    closeExportMenu();
  }
}

function onExportEsc(e) {
  if (e.key === 'Escape') closeExportMenu();
}

function closeExportMenu() {
  if (!exportMenu) return;
  exportMenu.remove();
  exportMenu = null;
  window.removeEventListener('mousedown', onExportOutside, true);
  window.removeEventListener('keydown', onExportEsc, true);
}

function openExportMenu() {
  if (!state.current) return;
  closeExportMenu();
  const rect = $('btn-export').getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'export-menu';
  const items = [
    { kind: 'html', label: t('export.html') },
    { kind: 'png', label: t('export.png') },
    { kind: 'pdf', label: t('export.pdf') },
  ];
  for (const it of items) {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.addEventListener('click', () => {
      closeExportMenu();
      runExport(it.kind);
    });
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
  exportMenu = menu;
  window.addEventListener('mousedown', onExportOutside, true);
  window.addEventListener('keydown', onExportEsc, true);
}

function triggerDownload(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function runExport(kind) {
  if (!state.current) return;
  const ok = await flushSave();
  if (!ok) {
    toast(t('toast.exportCancelled'), true);
    return;
  }
  const title = noteTitle.value.trim() || t('note.untitled');
  const body = editor.state.doc.toString();

  let payload;
  try {
    if (kind === 'html') {
      const html = await buildExportHtml(title, body, state.theme);
      payload = {
        data: new TextEncoder().encode(html),
        ext: 'html',
        mime: 'text/html',
        filterName: t('export.filterHtml'),
        extensions: ['html', 'htm'],
      };
    } else {
      toast(t(kind === 'png' ? 'toast.exportingPng' : 'toast.exportingPdf'));
      const exported = kind === 'png' ? await exportPng(body) : await exportPdf(body);
      payload = {
        ...exported,
        filterName: t(
          kind === 'png' ? 'export.filterPng' : 'export.filterPdf'
        ),
        extensions: [exported.ext],
      };
    }
  } catch (err) {
    toast(t('toast.exportFailed', { msg: err.message || err }), true);
    return;
  }

  const defaultName = `${title}.${payload.ext}`;
  try {
    const target = await api.saveExport(
      defaultName,
      payload.filterName,
      payload.extensions,
      payload.data
    );
    if (!api.isTauri) {
      triggerDownload(new Blob([payload.data], { type: payload.mime }), defaultName);
      toast(t('toast.downloadStarted'));
      return;
    }
    if (target) toast(t('toast.exportedTo', { path: target }));
  } catch (err) {
    toast(t('toast.exportFailed', { msg: err.message || err }), true);
  }
}

$('btn-export').addEventListener('click', openExportMenu);

// ---------------- Divider drag ----------------

divider.addEventListener('mousedown', (e) => {
  e.preventDefault();
  divider.classList.add('dragging');
  const content = mainEl.querySelector('.content');
  const onMove = (ev) => {
    const rect = content.getBoundingClientRect();
    const ratio = (ev.clientX - rect.left) / rect.width;
    const clamped = Math.min(0.75, Math.max(0.25, ratio));
    editorHolder.style.flexBasis = `${clamped * 100}%`;
  };
  const onUp = () => {
    divider.classList.remove('dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    const basis = editorHolder.style.flexBasis;
    if (basis) localStorage.setItem('rustmd-split', basis);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

const savedSplit = localStorage.getItem('rustmd-split');
if (savedSplit) editorHolder.style.flexBasis = savedSplit;

// ---------------- Unsaved changes guard ----------------

window.addEventListener('beforeunload', (e) => {
  if (state.pendingSave || state.saveFailed) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------- Global error surface ----------------
// Tauri's webview console is not piped to the terminal, so surface runtime
// errors as toasts — otherwise a module-level throw looks like a silent
// white screen.

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason && (e.reason.message || e.reason.toString());
  toast(t('toast.error', { msg }), true);
});

window.addEventListener('error', (e) => {
  if (e.error) {
    console.error('[rustmd] window error', e.error);
    toast(t('toast.jsError', { msg: e.error.message || e.error }), true);
  }
});

// ---------------- Language ----------------

function syncLanguageSelects() {
  for (const select of document.querySelectorAll('[data-lang-select]')) {
    select.value = getLanguage();
  }
}

function bindLanguageSelects() {
  for (const select of document.querySelectorAll('[data-lang-select]')) {
    select.value = getLanguage();
    select.addEventListener('change', () => setLanguage(select.value));
  }
}

onLanguageChange(() => {
  applyStaticTranslations();
  syncLanguageSelects();
  renderSortControls();
  renderFolders();
  renderTags();
  renderNoteList();
  renderTagEditor();
  updateCounts();
  setSaveStatus(state.saveStatus);
  applySidebar(isSidebarCollapsed());
  closeExportMenu();
  for (const el of document.querySelectorAll('.modal-backdrop')) el.remove();
});

// ---------------- Init ----------------

async function boot() {
  applyStaticTranslations();
  bindLanguageSelects();
  applyTheme(state.theme);
  initEditor();
  applyView(state.view);
  applySidebar(localStorage.getItem('rustmd-sidebar') === 'closed');
  renderSortControls();
  renderTagEditor();

  if (!state.dir) {
    onboardingEl.classList.remove('hidden');
    return;
  }
  // Try to auto-open the last directory; fall back to onboarding if it fails.
  onboardingEl.classList.add('hidden');
  mainEl.classList.remove('hidden');
  const ok = await enterDir(state.dir);
  if (!ok) {
    state.dir = null;
    localStorage.removeItem('rustmd-dir');
    mainEl.classList.add('hidden');
    onboardingEl.classList.remove('hidden');
    dirInput.value = '';
  }
}

await boot();

// ---------------- Dev self-test (?selftest=1) ----------------
// The self-test lives in selftest.js (dynamic import below): it renders
// the examples/ vault through the real app and verifies the exports.
// Dev builds only — vite compiles import.meta.env.DEV to false in release
// builds, so the module is never bundled into shipped binaries.
// Launch: `npm run selftest` (or RUSTMD_SELFTEST=1 scripts/run-dev.bat).

if (import.meta.env.DEV && new URLSearchParams(location.search).has('selftest')) {
  const { runSelfTest } = await import('./selftest.js');
  void runSelfTest({ getState: () => ({ dir: state.dir, current: state.current }) });
}
