import './style.css';
import './dataview.css';
import { api } from './api.js';
import { createEditor } from './editor.js';
import {
  renderPreview,
  buildExportHtml,
  captureHtmlPreview,
  setPreviewTheme,
  setImageContext,
  inlineLocalAssetsInHtml,
  ensureUtf8HtmlCharset,
} from './preview.js';
import {
  exportPng,
  exportPdf,
  exportPdfVector,
  pdfFromPngDataUrl,
} from './export.js';
import { bytesToDataUrl, dataUrlToBytes } from './imgutil.js';
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
  countTags,
  defaultSortDir,
  fileNameOf,
  filterNotes,
  flattenFolderTree,
  folderInScope,
  folderOf,
  normalizeSortState,
  isDataKind,
  noteKindOf,
  noteStemOf,
  sortNotes,
} from './notelist.js';
import {
  RECENT_DIRS_MAX,
  addRecentDir,
  dirDisplayName,
  orderRecentDirs,
  parseRecentDirs,
  pinnedDirs,
  removeRecentDir,
  sameDir,
  togglePinnedDir,
} from './vaultlist.js';

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

function loadCollapsedVaults() {
  try {
    const raw = JSON.parse(localStorage.getItem('rustmd-collapsed-vaults') || '[]');
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

const INCLUDE_SUBFOLDERS_KEY = 'rustmd-include-subfolders';
const MULTI_VAULT_KEY = 'rustmd-multi-vault';

const state = {
  dir: localStorage.getItem('rustmd-dir'),
  // Loaded vaults in display order (multi-vault mode: pinned + current).
  vaults: [],
  notes: [],
  // Per-vault folder lists/trees; keys are the exact vault directory strings.
  folderPathsByVault: new Map(),
  folderTreeByVault: new Map(),
  tags: [], // [{ name, count }]
  current: null, // relative path
  // Absolute directory of the open note. In multi-vault mode the note may
  // live in a pinned vault while `state.dir` stays the primary one.
  currentDir: null,
  currentKind: 'markdown', // "markdown" | "html" | "csv" | "txt" | "json"
  // Encoding auto-detected by Rust; shown in the status bar. Saving writes
  // the file back in this encoding.
  currentEncoding: '',
  currentHash: '',
  currentMtime: 0,
  tagsOfCurrent: [],
  view: localStorage.getItem('rustmd-view') || 'split',
  wrap: localStorage.getItem('rustmd-wrap') !== 'off',
  fullscreen: false,
  // Default theme is LIGHT regardless of the OS setting (v1.0): the app's
  // light palette is the house style. A manual toggle is still persisted in
  // localStorage and always wins once the user has chosen one.
  theme: localStorage.getItem('rustmd-theme') || 'light',
  sortKey: initialSort.key,
  sortDir: initialSort.dir,
  // The note list/search only cover the selected folder by default; subfolders
  // are opt-in and the choice survives restarts.
  includeSubfolders: localStorage.getItem(INCLUDE_SUBFOLDERS_KEY) === 'on',
  // Multi-vault mode shows every pinned vault (plus the current vault) at the
  // same time. The note list aggregates all of them; the folder tree keeps one
  // branch per vault so equal relative paths stay independent.
  multiVault: localStorage.getItem(MULTI_VAULT_KEY) === 'on',
  expandedFolders: loadExpandedFolders(),
  // Vault sections in the multi-vault tree start expanded; this set holds the
  // ones the user folded away (separate from per-folder expansion).
  collapsedVaults: loadCollapsedVaults(),
  filter: { vault: null, folder: null, tag: null, query: '' },
  searchHits: null,
  saveTimer: null,
  previewTimer: null,
  pendingSave: false,
  saveFailed: false,
  saveStatus: 'saved',
  docRevision: 0,
  // Monotonic token for loadNotes: a slower older load must not overwrite the
  // results of a newer vault switch.
  loadSeq: 0,
};

// Windows paths are case-insensitive and accept either separator; the
// recent-vault helpers need to know that when deduping.
const WINDOWS_PATHS = /windows/i.test(navigator.userAgent || '');
const RECENT_DIRS_KEY = 'rustmd-recent-dirs';
const NAV_HEIGHT_KEY = 'rustmd-nav-height';
const NAV_MIN_HEIGHT = 96;

let recentDirs = loadRecentDirs();
// Serialize root registration: overlapping loads must not leave an older
// vault set registered after a newer one.
let rootsQueue = Promise.resolve();

function registerVaultRoots(dirs) {
  const run = rootsQueue.then(
    () => api.setNotesRoots(dirs),
    () => api.setNotesRoots(dirs)
  );
  rootsQueue = run.catch(() => {});
  return run;
}

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
const sidebarEl = document.querySelector('.sidebar');
const sidebarNav = document.querySelector('.sidebar-nav');
const navResizer = $('nav-resizer');
const dirInput = $('dir-input');
const onboardingError = $('onboarding-error');
const recentDirsEl = $('recent-dirs');
const recentListEl = $('recent-list');
const changeDirBtn = $('btn-change-dir');
const searchInput = $('search-input');
const includeSubfoldersInput = $('include-subfolders');
const multiVaultBtn = $('btn-multi-vault');
const multiVaultCount = $('multi-vault-count');
const refreshBtn = $('btn-refresh');
const folderList = $('folder-list');
const tagCloud = $('tag-cloud');
const noteList = $('note-list');
const noteCount = $('note-count');
const sortSwitch = $('sort-switch');
const sortDirBtn = $('sort-dir');
const wrapBtn = $('btn-wrap');
const fullscreenBtn = $('btn-fullscreen');
const editorPane = $('editor-pane');
const emptyState = $('empty-state');
const noteTitle = $('note-title');
const noteKind = $('note-kind');
const tagEditor = $('tag-editor');
const workspace = $('workspace');
const editorHolder = $('editor-holder');
const previewEl = $('preview');
const divider = $('divider');
const statusSave = $('status-save');
const statusPath = $('status-path');
const statusCounts = $('status-counts');
const statusEncoding = $('status-encoding');
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

/// Visible text of an HTML note for the word/character counter. Regex-based
/// on purpose: this runs on every keystroke, and DOMParser would re-parse the
/// whole document each time.
function htmlTextOf(source) {
  const entities = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    '#39': "'",
    nbsp: ' ',
  };
  return String(source)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<(script|style|head|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ' '
    )
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, name) => entities[name] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function stemOf(path) {
  return noteStemOf(path);
}

const KIND_UI = {
  markdown: { label: 'MD', title: 'note.kindMarkdownTitle', aria: 'note.kindMarkdown' },
  html: { label: 'HTML', title: 'note.kindHtmlTitle', aria: 'note.kindHtml' },
  csv: { label: 'CSV', title: 'note.kindCsvTitle', aria: 'note.kindCsv' },
  txt: { label: 'TXT', title: 'note.kindTxtTitle', aria: 'note.kindTxt' },
  json: { label: 'JSON', title: 'note.kindJsonTitle', aria: 'note.kindJson' },
};

function kindUi(kind) {
  return KIND_UI[kind] || KIND_UI.markdown;
}

/** Format badge in the topbar; only Markdown notes carry front-matter tags. */
function updateKindBadge(kind = state.currentKind) {
  const current = KIND_UI[kind] ? kind : 'markdown';
  const ui = kindUi(current);
  if (noteKind) {
    noteKind.textContent = ui.label;
    for (const name of Object.keys(KIND_UI)) {
      noteKind.classList.toggle(name, name === current);
    }
    noteKind.title = t(ui.title);
    noteKind.setAttribute('aria-label', t(ui.aria));
  }
  tagEditor.classList.toggle('hidden', current !== 'markdown');
}

function updateStatusEncoding() {
  const encoding = state.current && state.currentEncoding;
  statusEncoding.textContent = encoding || '';
  statusEncoding.classList.toggle('hidden', !encoding);
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
  // diagrams match the new theme. HTML notes have their own page theme and
  // re-running the headless renderer for a CSS toggle is wasteful.
  if (
    state.current &&
    editor &&
    editor.state.doc.length &&
    state.currentKind !== 'html'
  ) {
    renderPreview(editor.state.doc.toString(), previewEl, state.currentKind);
  }
  updateKindBadge();
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
// ---------------- Line wrapping ----------------

function applyWrap(enabled) {
  state.wrap = enabled;
  if (editor) editor.setLineWrapping(enabled);
  localStorage.setItem('rustmd-wrap', enabled ? 'on' : 'off');
  const key = enabled ? 'topbar.wrapOn' : 'topbar.wrapOff';
  wrapBtn.classList.toggle('active', enabled);
  wrapBtn.title = t(key);
  wrapBtn.setAttribute('aria-label', t(key));
  wrapBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
}

wrapBtn.addEventListener('click', () => applyWrap(!state.wrap));

// ---------------- Fullscreen ----------------

function updateFullscreenButton() {
  const key = state.fullscreen
    ? 'topbar.fullscreenOff'
    : 'topbar.fullscreenOn';
  fullscreenBtn.classList.toggle('active', state.fullscreen);
  fullscreenBtn.title = t(key);
  fullscreenBtn.setAttribute('aria-label', t(key));
  fullscreenBtn.setAttribute('aria-pressed', state.fullscreen ? 'true' : 'false');
}

async function setFullscreen(enabled) {
  try {
    await api.setFullscreen(enabled);
  } catch (err) {
    toast(t('toast.error', { msg: err.message || err }), true);
    return;
  }
  state.fullscreen = enabled;
  updateFullscreenButton();
}

function toggleFullscreen() {
  void setFullscreen(!state.fullscreen);
}

fullscreenBtn.addEventListener('click', toggleFullscreen);
window.addEventListener('keydown', (e) => {
  if (e.key === 'F11' && !e.repeat) {
    e.preventDefault();
    toggleFullscreen();
  }
});
document.addEventListener('fullscreenchange', () => {
  if (!api.isTauri) {
    state.fullscreen = Boolean(document.fullscreenElement);
    updateFullscreenButton();
  }
});
async function syncFullscreenState() {
  if (!api.isTauri) {
    state.fullscreen = Boolean(document.fullscreenElement);
    updateFullscreenButton();
    return;
  }
  try {
    const value = await api.isFullscreen();
    if (Boolean(value) !== state.fullscreen) {
      state.fullscreen = Boolean(value);
      updateFullscreenButton();
    }
  } catch {
    // Window is not ready yet or the permission is unavailable; the button
    // still works through setFullscreen.
  }
}

syncFullscreenState();
window.addEventListener('focus', () => {
  void syncFullscreenState();
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
  if (!collapsed) updateNavAria();
}

function toggleSidebar() {
  applySidebar(!isSidebarCollapsed());
}

$('btn-toggle-sidebar').addEventListener('click', toggleSidebar);
$('btn-show-sidebar').addEventListener('click', toggleSidebar);

// ---------------- Sidebar folder/tag splitter ----------------

/**
 * The folders/tags block and the note list share the sidebar vertically.
 * The grip gives the list more room by default and can be dragged (or
 * keyboard-resized) to any height; the choice is persisted in px.
 */
function maxNavHeight() {
  // The sidebar spans the window height; using the window keeps this workable
  // before #main is shown, when the sidebar still has a zero client height.
  // Keep room for the header/search chrome, list header, grip and the note
  // list's 110px minimum, even at the Tauri minimum window height.
  const height = window.innerHeight || 560;
  const fixedChrome = 274;
  return Math.max(
    NAV_MIN_HEIGHT + 24,
    Math.min(Math.round(height * 0.55), height - fixedChrome)
  );
}

function applyNavHeight(height, { persist = false, clampMax = true } = {}) {
  if (!sidebarEl || !navResizer) return NAV_MIN_HEIGHT;
  const raw = Math.max(NAV_MIN_HEIGHT, Math.round(Number(height) || 0));
  const next = clampMax ? Math.min(maxNavHeight(), raw) : raw;
  sidebarEl.style.setProperty('--sidebar-nav-height', `${next}px`);
  navResizer.setAttribute('aria-valuemin', String(NAV_MIN_HEIGHT));
  navResizer.setAttribute('aria-valuemax', String(maxNavHeight()));
  navResizer.setAttribute('aria-valuenow', String(next));
  if (persist) localStorage.setItem(NAV_HEIGHT_KEY, String(next));
  return next;
}

function updateNavAria() {
  if (!navResizer || !sidebarNav) return;
  navResizer.setAttribute('aria-valuemin', String(NAV_MIN_HEIGHT));
  navResizer.setAttribute('aria-valuemax', String(maxNavHeight()));
  // A collapsed sidebar has no layout box; keep the previous value.
  if (!sidebarEl || !sidebarEl.getClientRects().length) return;
  const current = Math.round(sidebarNav.getBoundingClientRect().height);
  if (current > 0) navResizer.setAttribute('aria-valuenow', String(current));
}

let navResizerReady = false;

function initNavResizer() {
  if (!navResizer || !sidebarNav || !sidebarEl) return;
  if (navResizerReady) {
    updateNavAria();
    return;
  }
  navResizerReady = true;
  const stored = Number(localStorage.getItem(NAV_HEIGHT_KEY));
  if (Number.isFinite(stored) && stored >= NAV_MIN_HEIGHT) {
    // Keep the preferred px even if the current window is smaller: CSS
    // max-height clamps the display and the preference survives growing back.
    applyNavHeight(stored, { clampMax: false });
  }
  // Without a stored preference, CSS sizes the block to its content (up to
  // the cap), leaving the note list all remaining height.
  updateNavAria();

  navResizer.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    // preventDefault stops the click from focusing the separator; restore it
    // so keyboard resizing is available immediately after a drag.
    navResizer.focus({ preventScroll: true });
    const startY = event.clientY;
    const startHeight = sidebarNav.getBoundingClientRect().height;
    let moved = false;
    navResizer.classList.add('dragging');
    document.body.classList.add('nav-resizing');
    const onMove = (ev) => {
      if (!moved && Math.abs(ev.clientY - startY) <= 2) return;
      moved = true;
      applyNavHeight(startHeight + ev.clientY - startY);
    };
    const onUp = () => {
      navResizer.classList.remove('dragging');
      document.body.classList.remove('nav-resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // A plain click must not freeze the content-sized default into px.
      if (moved) {
        applyNavHeight(sidebarNav.getBoundingClientRect().height, {
          persist: true,
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  navResizer.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 48 : 16;
    const current = sidebarNav.getBoundingClientRect().height;
    let next = null;
    if (event.key === 'ArrowUp') next = current - step;
    else if (event.key === 'ArrowDown') next = current + step;
    else if (event.key === 'Home') next = NAV_MIN_HEIGHT;
    else if (event.key === 'End') next = maxNavHeight();
    else if (event.key === 'Enter') {
      event.preventDefault();
      localStorage.removeItem(NAV_HEIGHT_KEY);
      sidebarEl.style.removeProperty('--sidebar-nav-height');
      updateNavAria();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    applyNavHeight(next, { persist: true });
  });

  // Double-click restores the responsive CSS default.
  navResizer.addEventListener('dblclick', () => {
    localStorage.removeItem(NAV_HEIGHT_KEY);
    sidebarEl.style.removeProperty('--sidebar-nav-height');
    updateNavAria();
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Never rewrite the preferred px from a transient/clamped measurement.
      // CSS max-height clamps the display; the inline preference stays and
      // applies again when the window grows back. Just refresh the ARIA value.
      updateNavAria();
    }, 120);
  });
}

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

// ---------------- Recent vaults / switcher ----------------

function loadRecentDirs() {
  return parseRecentDirs(localStorage.getItem(RECENT_DIRS_KEY), {
    max: RECENT_DIRS_MAX,
    windows: WINDOWS_PATHS,
  });
}

function persistRecentDirs() {
  localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(recentDirs));
}

function rememberRecentDir(dir) {
  recentDirs = addRecentDir(recentDirs, dir, {
    max: RECENT_DIRS_MAX,
    windows: WINDOWS_PATHS,
  });
  persistRecentDirs();
  renderOnboardingRecents();
  renderVaultMenu();
}

function forgetRecentDir(dir) {
  recentDirs = removeRecentDir(recentDirs, dir, { windows: WINDOWS_PATHS });
  persistRecentDirs();
  renderOnboardingRecents();
  renderVaultMenu();
  if (state.multiVault && state.dir) void loadNotes();
}

/** Pinned vaults (display order = pinned-first MRU). */
function pinnedVaultDirs() {
  return pinnedDirs(recentDirs);
}

/**
 * Vaults whose notes are loaded right now. Single-vault mode has just the
 * primary folder; multi-vault mode adds every pinned vault plus the vault of
 * the open note (so unpinning it never yanks the note out from under the
 * editor). Duplicates (case/trailing-separator variants) collapse.
 */
function activeVaultDirs() {
  if (!state.dir) return [];
  if (!state.multiVault) return [state.dir];
  const dirs = [state.dir];
  for (const dir of [...pinnedVaultDirs(), state.currentDir]) {
    if (dir && !dirs.some((existing) => sameDir(existing, dir, WINDOWS_PATHS))) {
      dirs.push(dir);
    }
  }
  return dirs;
}

/** True when more than one vault is loaded and the tree should group them. */
function isMultiView() {
  return state.vaults.length > 1;
}

/**
 * Vault name for the tree/note badges. Two open vaults with the same last
 * path segment are disambiguated with their parent folder.
 */
function vaultLabel(dir) {
  const name = dirDisplayName(dir);
  if (!name) return dir;
  const matches = state.vaults.filter(
    (vault) => dirDisplayName(vault.dir) === name
  );
  if (matches.length <= 1) return name;
  // Use the shortest parent suffix that is unique among the open vaults, so
  // two different `.../a/Notes` and `.../b/Notes` never look identical.
  const segmentsOf = (value) =>
    String(value)
      .split(String.fromCharCode(92))
      .join('/')
      .split('/')
      .filter(Boolean);
  const own = segmentsOf(dir);
  for (let depth = 2; depth <= own.length; depth += 1) {
    const suffix = own.slice(-depth).join('/').toLowerCase();
    const count = matches.filter((vault) => {
      const parts = segmentsOf(vault.dir);
      return (
        parts.length >= depth &&
        parts.slice(-depth).join('/').toLowerCase() === suffix
      );
    }).length;
    if (count === 1) return own.slice(-depth).join('/');
  }
  return String(dir);
}

const PIN_SVG =
  '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9.6 2.3l4.1 4.1-1.9.5-2.9 2.9-.2 2.3-4.8-4.8 2.3-.2 2.9-2.9z"/><path d="M3.3 12.7l2.7-2.7"/></svg>';

/** Move a vault between the pinned section and the recent section. */
function togglePinnedVault(dir) {
  recentDirs = togglePinnedDir(recentDirs, dir, {
    max: RECENT_DIRS_MAX,
    windows: WINDOWS_PATHS,
  });
  persistRecentDirs();
  renderOnboardingRecents();
  renderVaultMenu();
  // The list is rebuilt, so keep keyboard focus on the pin button the user
  // just activated (switch popover or onboarding).
  if (!vaultMenu && recentListEl) {
    const row = [...recentListEl.querySelectorAll('.vault-item')].find((el) =>
      sameDir(el.dataset.dir, dir, WINDOWS_PATHS)
    );
    row?.querySelector('.vault-pin')?.focus({ preventScroll: true });
  }
  if (vaultMenu) {
    const row = [...vaultMenu.querySelectorAll('.vault-item')].find((el) =>
      sameDir(el.dataset.dir, dir, WINDOWS_PATHS)
    );
    row?.querySelector('.vault-pin')?.focus({ preventScroll: true });
  }
  if (state.multiVault && state.dir) void loadNotes();
}

function recentGroupLabel(key) {
  const label = document.createElement('div');
  label.className = 'vault-group-label';
  label.textContent = t(key);
  return label;
}

/** One row in the switcher / onboarding recent list. */
function recentDirRow(entry, { current = false, onPick, onTogglePin }) {
  const dir = entry.dir;
  const row = document.createElement('div');
  row.className =
    'vault-item' +
    (current ? ' current' : '') +
    (entry.pinned ? ' pinned' : '');
  row.dataset.dir = dir;

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'vault-open';
  open.title = dir;

  const nameRow = document.createElement('span');
  nameRow.className = 'vault-name-row';
  const name = document.createElement('span');
  name.className = 'vault-name';
  name.textContent = dirDisplayName(dir);
  nameRow.appendChild(name);
  if (entry.pinned) {
    const pinBadge = document.createElement('span');
    pinBadge.className = 'vault-pinned-badge';
    pinBadge.textContent = t('vault.pinnedBadge');
    nameRow.appendChild(pinBadge);
  }
  if (current) {
    const badge = document.createElement('span');
    badge.className = 'vault-badge';
    badge.textContent = t('vault.current');
    nameRow.appendChild(badge);
  }

  const path = document.createElement('span');
  path.className = 'vault-path';
  path.textContent = dir;

  open.append(nameRow, path);
  open.addEventListener('click', () => onPick(dir));
  row.appendChild(open);

  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'vault-pin' + (entry.pinned ? ' pinned' : '');
  pin.innerHTML = PIN_SVG;
  pin.title = t(entry.pinned ? 'vault.unpin' : 'vault.pin');
  pin.setAttribute('aria-label', t(entry.pinned ? 'vault.unpin' : 'vault.pin'));
  pin.setAttribute('aria-pressed', entry.pinned ? 'true' : 'false');
  pin.addEventListener('click', () => onTogglePin(dir));
  row.appendChild(pin);

  if (!current) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'vault-remove';
    remove.textContent = '×';
    remove.title = t('vault.remove');
    remove.setAttribute('aria-label', t('vault.remove'));
    remove.addEventListener('click', () => forgetRecentDir(dir));
    row.appendChild(remove);
  }
  return row;
}

function appendRecentRows(parent, entries, optionsFor) {
  for (const entry of entries) {
    const options =
      typeof optionsFor === 'function' ? optionsFor(entry) : optionsFor;
    parent.appendChild(recentDirRow(entry, options));
  }
}

function renderOnboardingRecents() {
  if (!recentDirsEl || !recentListEl) return;
  const ordered = orderRecentDirs(recentDirs);
  recentDirsEl.classList.toggle('hidden', ordered.length === 0);
  recentListEl.replaceChildren();
  if (!ordered.length) return;

  const pinned = ordered.filter((entry) => entry.pinned);
  const rest = ordered.filter((entry) => !entry.pinned);
  const onTogglePin = (dir) => togglePinnedVault(dir);
  const rowOptions = (entry) => ({
    current: sameDir(entry.dir, state.dir, WINDOWS_PATHS),
    onPick: (value) => {
      dirInput.value = value;
      void enterDir(value);
    },
    onTogglePin,
  });

  if (pinned.length && rest.length) recentListEl.appendChild(recentGroupLabel('vault.pinnedGroup'));
  appendRecentRows(recentListEl, pinned, rowOptions);
  if (pinned.length && rest.length) recentListEl.appendChild(recentGroupLabel('vault.recentGroup'));
  appendRecentRows(recentListEl, rest, rowOptions);
}

let vaultMenu = null;

function onVaultOutside(e) {
  if (
    vaultMenu &&
    !vaultMenu.contains(e.target) &&
    !e.target.closest('#btn-change-dir')
  ) {
    closeVaultMenu();
  }
}

function onVaultEsc(e) {
  if (e.key === 'Escape') closeVaultMenu();
}

function closeVaultMenu() {
  if (!vaultMenu) return;
  const hadFocus = vaultMenu.contains(document.activeElement);
  vaultMenu.remove();
  vaultMenu = null;
  window.removeEventListener('mousedown', onVaultOutside, true);
  window.removeEventListener('keydown', onVaultEsc, true);
  if (hadFocus) changeDirBtn.focus({ preventScroll: true });
}

function renderVaultMenu() {
  if (!vaultMenu) return;
  vaultMenu.replaceChildren();

  const title = document.createElement('div');
  title.className = 'vault-menu-title';
  title.textContent = t('vault.switchTitle');
  vaultMenu.appendChild(title);

  if (recentDirs.length) {
    const ordered = orderRecentDirs(recentDirs);
    const pinned = ordered.filter((entry) => entry.pinned);
    const rest = ordered.filter((entry) => !entry.pinned);
    const list = document.createElement('div');
    list.className = 'vault-list';
    const onPick = (dir) => {
      if (sameDir(dir, state.dir, WINDOWS_PATHS)) closeVaultMenu();
      else void switchVault(dir);
    };
    const options = (entry) => ({
      current: sameDir(entry.dir, state.dir, WINDOWS_PATHS),
      onPick,
      onTogglePin: (dir) => togglePinnedVault(dir),
    });
    if (pinned.length) {
      list.appendChild(recentGroupLabel('vault.pinnedGroup'));
      appendRecentRows(list, pinned, options);
    }
    if (rest.length) {
      if (pinned.length) list.appendChild(recentGroupLabel('vault.recentGroup'));
      appendRecentRows(list, rest, options);
    }
    vaultMenu.appendChild(list);
  } else {
    const empty = document.createElement('div');
    empty.className = 'vault-empty';
    empty.textContent = t('vault.noRecent');
    vaultMenu.appendChild(empty);
  }

  const sep = document.createElement('div');
  sep.className = 'vault-menu-sep';
  vaultMenu.appendChild(sep);

  const browse = document.createElement('button');
  browse.type = 'button';
  browse.className = 'vault-action';
  browse.textContent = t('vault.browse');
  browse.addEventListener('click', () => void browseVault());
  vaultMenu.appendChild(browse);

  if (state.multiVault) {
    const hint = document.createElement('div');
    hint.className = 'vault-multi-hint';
    hint.textContent = t('vault.multiHint', {
      n: state.vaults.length || activeVaultDirs().length,
    });
    vaultMenu.appendChild(hint);
  }
}

async function confirmVaultChange() {
  const ok = await flushSave();
  return ok || confirm(t('dialog.changeDir'));
}

async function switchVault(dir) {
  closeVaultMenu();
  if (sameDir(dir, state.dir, WINDOWS_PATHS)) return;
  if (!(await confirmVaultChange())) return;
  await enterDir(dir, { toastErrors: true });
}

async function browseVault() {
  closeVaultMenu();
  if (!(await confirmVaultChange())) return;
  let dir;
  try {
    dir = await api.pickDirectory(
      t('onboarding.dirDialogTitle'),
      state.dir || undefined
    );
  } catch (err) {
    toast(t('onboarding.browseFailed', { msg: err.message || err }), true);
    return;
  }
  if (!dir || sameDir(dir, state.dir, WINDOWS_PATHS)) return;
  await enterDir(dir, { toastErrors: true });
}

function openVaultMenu() {
  if (!state.dir) return;
  closeVaultMenu();
  const menu = document.createElement('div');
  menu.className = 'vault-menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', t('vault.switchTitle'));
  document.body.appendChild(menu);
  vaultMenu = menu;
  renderVaultMenu();

  const rect = changeDirBtn.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.max(
    8,
    Math.min(rect.left, window.innerWidth - width - 8)
  );
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
  }
  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;

  window.addEventListener('mousedown', onVaultOutside, true);
  window.addEventListener('keydown', onVaultEsc, true);
  const focusTarget =
    menu.querySelector('.vault-item:not(.current) .vault-open') ||
    menu.querySelector('.vault-action');
  focusTarget?.focus({ preventScroll: true });
}

changeDirBtn.addEventListener('click', () => {
  if (vaultMenu) closeVaultMenu();
  else openVaultMenu();
});

// ---------------- Onboarding / dir ----------------

let vaultSwitchBusy = false;

async function enterDir(dir, { toastErrors = false } = {}) {
  if (vaultSwitchBusy) return false;
  vaultSwitchBusy = true;
  try {
    try {
      // Validate the folder before switching any state.
      await api.listNotes(dir);
    } catch (err) {
      const msg = err.message || err;
      if (toastErrors) {
        toast(t('vault.switchFailed', { msg }), true);
      } else {
        onboardingError.textContent = t('onboarding.openError', { msg });
        onboardingError.classList.remove('hidden');
      }
      return false;
    }
    onboardingError.classList.add('hidden');
    // Let an in-flight save finish before the old vault's state is discarded.
    await saveQueue.catch(() => false);
    state.dir = dir;
    noteSelectSeq += 1;
    searchSeq += 1;
    clearTimeout(searchTimer);
    localStorage.setItem('rustmd-dir', dir);
    rememberRecentDir(dir);
    // A new vault must not inherit the previous vault's selection/filter,
    // editor contents or stale conflict token.
    state.filter = { vault: null, folder: null, tag: null, query: '' };
    state.searchHits = null;
    state.current = null;
    state.currentDir = null;
    state.currentKind = 'markdown';
    state.currentEncoding = '';
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
    editor.setLanguage('markdown');
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '' } });
    suppressChange = false;
    renderPreview('', previewEl, 'markdown');
    renderTagEditor();
    updateCounts();
    updateKindBadge('markdown');
    updateStatusEncoding();
    setSaveStatus('saved');
    editorPane.classList.remove('visible');
    emptyState.classList.remove('hidden');
    onboardingEl.classList.add('hidden');
    mainEl.classList.remove('hidden');
    initNavResizer();
    // loadNotes rescans every active vault (multi-vault mode) and registers
    // the roots with the `rmd` image protocol.
    await loadNotes();
    syncMultiVaultButton();
    return true;
  } finally {
    vaultSwitchBusy = false;
  }
}

$('pick-dir-btn').addEventListener('click', async () => {
  try {
    const dir = await api.pickDirectory(
      t('onboarding.dirDialogTitle'),
      state.dir || dirInput.value.trim() || undefined
    );
    if (dir) {
      dirInput.value = dir;
      void enterDir(dir);
    }
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

/** Search every visible vault (or only the selected folder's vault). */
async function searchActiveVaults(query) {
  const dirs = state.filter.vault
    ? [state.filter.vault]
    : state.vaults.map((vault) => vault.dir);
  const chunks = await Promise.all(
    dirs.map(async (dir) => {
      const hits = await api.searchNotes(
        dir,
        query,
        state.filter.folder,
        state.includeSubfolders
      );
      // Each hit carries its vault: relative paths are not unique across
      // vaults, and the aggregated list must know where to read from.
      return hits.map((hit) => ({ ...hit, meta: { ...hit.meta, vault: dir } }));
    })
  );
  return chunks.flat();
}

async function refreshSearch() {
  if (!state.filter.query) {
    state.searchHits = null;
    return;
  }
  const query = state.filter.query;
  const seq = ++searchSeq;
  try {
    const hits = await searchActiveVaults(query);
    if (seq !== searchSeq || query !== state.filter.query) return;
    state.searchHits = hits;
  } catch (err) {
    if (seq !== searchSeq || query !== state.filter.query) return;
    toast(t('toast.searchFailed', { msg: err.message || err }), true);
    state.searchHits = [];
  }
}

/**
 * Rescan every active vault. In multi-vault mode the notes of all vaults are
 * aggregated into `state.notes`, each carrying its `vault` directory; folder
 * lists/trees stay per vault so equal relative paths remain independent.
 */
async function loadNotes({ quiet = false } = {}) {
  const seq = ++state.loadSeq;
  const wanted = activeVaultDirs();
  const results = await Promise.all(
    wanted.map(async (dir) => {
      try {
        const [notes, folders] = await Promise.all([
          api.listNotes(dir),
          api.listFolders(dir).catch(() => null),
        ]);
        return { dir, notes, folders, ok: true };
      } catch (error) {
        return { dir, error, ok: false };
      }
    })
  );
  if (seq !== state.loadSeq) return { ok: true, stale: true };
  if (!results.length || !results[0].ok) {
    const error = results.length ? results[0].error : new Error('no vault');
    if (!quiet) {
      toast(t('toast.readFailed', { msg: (error && error.message) || error }), true);
    }
    return { ok: false, error };
  }

  const loaded = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  state.notes = [];
  state.folderPathsByVault = new Map();
  state.folderTreeByVault = new Map();
  for (const result of loaded) {
    const paths = result.folders || deriveFolderPaths(result.notes);
    state.folderPathsByVault.set(result.dir, paths);
    state.folderTreeByVault.set(result.dir, buildFolderTree(paths, result.notes));
    for (const note of result.notes) {
      state.notes.push({ ...note, vault: result.dir });
    }
  }
  state.vaults = loaded.map((result) => ({ dir: result.dir }));
  // In single-vault mode the vault component of the filter is redundant.
  // Keep it exact for the one loaded vault (or clear it when there is no
  // folder filter) so strict `vault ===` comparisons cannot go stale.
  if (state.vaults.length <= 1) {
    const only = state.vaults[0]?.dir || null;
    if (state.filter.folder === null) {
      state.filter.vault = null;
    } else if (
      !state.filter.vault ||
      sameDir(state.filter.vault, only, WINDOWS_PATHS)
    ) {
      state.filter.vault = only;
    }
    // Otherwise leave the stale vault for the invalid-vault check below; do
    // not silently retarget the same folder name to another vault.
  }
  updateStatusPath();

  if (seq !== state.loadSeq) return { ok: true, stale: true };
  // The `rmd` image protocol must serve every visible vault, not just the
  // primary one. Registration is serialized and Rust skips a vanished root,
  // so a disappearing pinned folder cannot take down the other roots.
  try {
    await registerVaultRoots(loaded.map((result) => result.dir));
  } catch (err) {
    // A vanished/invalid root set must not leave a superseded authorization
    // registered. Revoke through the same queue, but never let a superseded
    // load clear roots already queued by a newer load.
    console.warn('could not register vault roots', err);
    if (seq === state.loadSeq) {
      await registerVaultRoots([]).catch(() => {});
    }
  }
  if (seq !== state.loadSeq) return { ok: true, stale: true };

  if (failed.length && !quiet) {
    toast(
      t('vault.unavailable', {
        names: failed
          .map(
            (result) =>
              `${dirDisplayName(result.dir)} (${
                (result.error && result.error.message) || result.error
              })`
          )
          .join(', '),
      }),
      true
    );
  }

  // A vault (or a folder deleted outside the app) must not leave the
  // list/search scoped to a path that no longer exists.
  if (
    state.filter.vault &&
    !state.vaults.some((vault) =>
      sameDir(vault.dir, state.filter.vault, WINDOWS_PATHS)
    )
  ) {
    state.filter.vault = null;
    state.filter.folder = null;
  }
  if (state.filter.folder !== null) {
    const paths = state.filter.vault
      ? state.folderPathsByVault.get(state.filter.vault) || []
      : loaded.flatMap(
          (result) => state.folderPathsByVault.get(result.dir) || []
        );
    if (!paths.includes(state.filter.folder)) {
      state.filter.folder = null;
      state.filter.vault = null;
    }
  }

  recomputeTags();
  await refreshSearch();
  if (seq !== state.loadSeq) return { ok: true, stale: true };
  renderFolders();
  renderTags();
  renderNoteList();
  syncMultiVaultButton();
  return { ok: true, failed };
}

// ---------------- Manual vault refresh ----------------

let refreshing = false;

function setRefreshBusy(busy) {
  refreshBtn.disabled = busy;
  refreshBtn.classList.toggle('spinning', busy);
  refreshBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
}

/**
 * Rescan the whole vault from disk. The app does not watch the file system,
 * so notes added/removed/edited by other tools while the window is open would
 * otherwise stay invisible until the next folder switch.
 *
 * Pending edits are flushed first. If the open note disappeared it is closed
 * (or kept, when its save failed), and when it changed on disk with no local
 * edits it is reloaded. Unsaved edits are never replaced: the normal hash
 * conflict flow still guards the next save.
 */
async function refreshVault() {
  if (!state.dir || refreshing) return false;
  const loadSeq = state.loadSeq;
  refreshing = true;
  setRefreshBusy(true);
  try {
    const saved = await flushSave();
    const keptUnsaved = !saved || state.pendingSave || state.saveFailed;
    // The user may have switched vaults/folders while the save was in flight.
    if (state.loadSeq !== loadSeq) return false;
    const path = state.current;
    const dir = state.currentDir;
    const oldHash = path ? state.currentHash : '';
    const result = await loadNotes({ quiet: true });
    if (result.stale) return false;
    if (!result.ok) {
      toast(
        t('toast.vaultRefreshFailed', {
          msg: (result.error && result.error.message) || result.error,
        }),
        true
      );
      return false;
    }
    // A vault that failed to scan is unavailable, not evidence that its open
    // note was deleted. Keep the editor intact and report the failure.
    if (
      dir &&
      (result.failed || []).some((failure) =>
        sameDir(failure.dir, dir, WINDOWS_PATHS)
      )
    ) {
      toast(t('vault.unavailable', { names: dirDisplayName(dir) }), true);
      return false;
    }
    // Stale folder/tag filters are cleared while loadNotes rebuilds the
    // scope, so nothing else to clean up here.

    let notice = null;
    if (path && dir && state.current === path && state.currentDir === dir) {
      const meta = state.notes.find((n) => n.path === path && n.vault === dir);
      if (!meta) {
        if (keptUnsaved) {
          notice = {
            key: 'toast.vaultRefreshDeletedDirty',
            vars: { name: fileNameOf(path) },
            error: true,
          };
        } else {
          clearCurrentNote();
          renderNoteList();
          notice = {
            key: 'toast.vaultRefreshDeleted',
            vars: { name: fileNameOf(path) },
            error: true,
          };
        }
      } else if (!keptUnsaved && meta.hash && oldHash && meta.hash !== oldHash) {
        // Changed on disk while the editor was clean: show the new content.
        // With unsaved edits we leave the editor alone and let save_note's
        // baseHash conflict prompt protect them.
        try {
          const content = await api.readNote(dir, path);
          if (state.currentDir === dir && state.current === path) {
            applyNoteContent(dir, path, content, { preserveView: true });
            renderNoteList();
            notice = {
              key: 'toast.vaultRefreshReloaded',
              vars: { name: fileNameOf(path) },
            };
          }
        } catch (err) {
          notice = {
            key: 'toast.vaultRefreshReloadFailed',
            vars: { name: fileNameOf(path), msg: err.message || err },
            error: true,
          };
        }
      } else if (keptUnsaved && meta.hash && oldHash && meta.hash !== oldHash) {
        notice = {
          key: 'toast.vaultRefreshConflict',
          vars: { name: fileNameOf(path) },
          error: true,
        };
      }
    }

    if (notice) toast(t(notice.key, notice.vars), notice.error);
    else if (keptUnsaved) toast(t('toast.vaultRefreshedUnsaved'), true);
    else toast(t('toast.vaultRefreshed', { n: state.notes.length }));
    return true;
  } catch (err) {
    toast(t('toast.vaultRefreshFailed', { msg: err.message || err }), true);
    return false;
  } finally {
    refreshing = false;
    setRefreshBusy(false);
  }
}

refreshBtn.addEventListener('click', () => {
  void refreshVault();
});

function persistExpandedFolders() {
  localStorage.setItem(
    'rustmd-expanded-folders',
    JSON.stringify([...state.expandedFolders])
  );
}

function persistCollapsedVaults() {
  localStorage.setItem(
    'rustmd-collapsed-vaults',
    JSON.stringify([...state.collapsedVaults])
  );
}

/** Folder tree of one vault (multi-vault mode keeps them separate). */
function folderTreeFor(dir) {
  return state.folderTreeByVault.get(dir) || [];
}

function folderPathsFor(dir) {
  return state.folderPathsByVault.get(dir) || [];
}

/**
 * Expansion keys include the vault in multi-vault mode: two vaults can both
 * have a `work/` folder, and expanding one must not expand the other. Single
 * mode keeps the legacy path-only keys so existing saved state still applies.
 */
function expandKey(vault, path) {
  return isMultiView() ? `${vault}\u0000${path}` : path;
}

function refreshScopeViews() {
  recomputeTags();
  renderTags();
  renderFolders();
  renderNoteList();
  // Search is scoped by the selected folder/vault, so an active query must be
  // re-run against the new scope.
  if (state.filter.query) void runSearch();
}

function selectFolder(vault, path) {
  const same = state.filter.vault === vault && state.filter.folder === path;
  state.filter.vault = same ? null : vault;
  state.filter.folder = same ? null : path;
  refreshScopeViews();
}

function selectVaultRoot(vault) {
  const same = state.filter.vault === vault && state.filter.folder === null;
  state.filter.vault = same ? null : vault;
  state.filter.folder = null;
  refreshScopeViews();
}

function toggleFolder(vault, path) {
  // Expanded, not collapsed: an empty set means every folder starts closed
  // (subfolders are hidden until the user opens their parent).
  const key = expandKey(vault, path);
  if (state.expandedFolders.has(key)) state.expandedFolders.delete(key);
  else state.expandedFolders.add(key);
  persistExpandedFolders();
  renderFolders();
}

/** Fold/unfold a whole vault section in the multi-vault tree. */
function toggleVaultCollapse(dir) {
  if (state.collapsedVaults.has(dir)) state.collapsedVaults.delete(dir);
  else state.collapsedVaults.add(dir);
  persistCollapsedVaults();
  renderFolders();
}

function renderFolderBranch(nodes, parentEl, depth, vault) {
  for (const node of nodes) {
    const li = document.createElement('li');
    const row = document.createElement('div');
    const active =
      state.filter.vault === vault && state.filter.folder === node.path;
    row.className = 'nav-item' + (active ? ' active' : '');
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.title = node.path;

    const hasChildren = node.children.length > 0;
    const expanded = state.expandedFolders.has(expandKey(vault, node.path));
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
      if (hasChildren) toggleFolder(vault, node.path);
    });
    row.appendChild(toggle);
    const folderCount = state.includeSubfolders ? node.count : node.direct;
    row.insertAdjacentHTML(
      'beforeend',
      `${FOLDER_SVG}<span class="nav-label">${esc(node.name)}</span><span class="count">${folderCount}</span>`
    );
    row.addEventListener('click', () => selectFolder(vault, node.path));
    li.appendChild(row);

    if (hasChildren && expanded) {
      const children = document.createElement('ul');
      children.className = 'nav-list folder-children';
      renderFolderBranch(node.children, children, depth + 1, vault);
      li.appendChild(children);
    }
    parentEl.appendChild(li);
  }
}

/** One vault section in the multi-vault folder tree. */
function renderVaultGroup(vault, parentEl) {
  const dir = vault.dir;
  const notes = state.notes.filter((note) => note.vault === dir);
  const count = notes.filter((note) =>
    folderInScope(note.folder, null, state.includeSubfolders)
  ).length;
  const active =
    state.filter.vault === dir && state.filter.folder === null;

  const collapsed = state.collapsedVaults.has(dir);
  const li = document.createElement('li');
  const row = document.createElement('div');
  row.className =
    'nav-item nav-vault' +
    (active ? ' active' : '') +
    (collapsed ? ' collapsed' : '');
  row.title = dir;
  row.style.paddingLeft = '4px';

  // A vault section has its own chevron; the label is a real button so
  // keyboard/screen-reader users can select the vault root, while the chevron
  // only folds the section.
  const label = vaultLabel(dir);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.classList.toggle('collapsed', collapsed);
  toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  toggle.title = t(collapsed ? 'vault.expand' : 'vault.collapse');
  toggle.setAttribute(
    'aria-label',
    t(collapsed ? 'vault.expandAria' : 'vault.collapseAria', {
      name: label,
    })
  );
  toggle.innerHTML = CHEVRON_SVG;
  toggle.addEventListener('click', () => toggleVaultCollapse(dir));
  row.appendChild(toggle);

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'vault-nav-open';
  main.title = dir;
  main.setAttribute('aria-label', t('vault.selectAria', { name: label }));
  const pinned = pinnedVaultDirs().some((value) =>
    sameDir(value, dir, WINDOWS_PATHS)
  );
  main.innerHTML =
    FOLDER_SVG +
    `<span class="nav-label">${esc(label)}</span>` +
    (pinned
      ? `<span class="vault-pin-mark" title="${esc(
          t('vault.pinnedBadge')
        )}">${PIN_SVG}</span>`
      : '') +
    `<span class="count">${count}</span>`;
  main.addEventListener('click', () => selectVaultRoot(dir));
  row.appendChild(main);
  li.appendChild(row);

  if (!collapsed) {
    const children = document.createElement('ul');
    children.className = 'nav-list folder-children vault-children';
    renderFolderBranch(folderTreeFor(dir), children, 1, dir);
    li.appendChild(children);
  }
  parentEl.appendChild(li);
}

function renderFolders() {
  const nav = folderList.closest('.sidebar-nav');
  const navScroll = nav ? nav.scrollTop : 0;
  folderList.innerHTML = '';
  const allCount = state.notes.filter((n) =>
    folderInScope(n.folder, null, state.includeSubfolders)
  ).length;
  const allItem = document.createElement('li');
  allItem.className =
    'nav-item' +
    (state.filter.folder === null && state.filter.vault === null ? ' active' : '');
  allItem.innerHTML = `${FOLDER_SVG}<span class="nav-label">${esc(
    t('sidebar.all')
  )}</span><span class="count">${allCount}</span>`;
  allItem.addEventListener('click', () => {
    state.filter.folder = null;
    state.filter.vault = null;
    refreshScopeViews();
  });
  folderList.appendChild(allItem);

  if (isMultiView()) {
    for (const vault of state.vaults) renderVaultGroup(vault, folderList);
  } else {
    const only = state.vaults.length ? state.vaults[0].dir : state.dir;
    renderFolderBranch(folderTreeFor(only), folderList, 0, only);
  }
  if (nav) nav.scrollTop = navScroll;
  requestAnimationFrame(updateNavAria);
}

function syncIncludeSubfolders() {
  includeSubfoldersInput.checked = state.includeSubfolders;
}

function setIncludeSubfolders(next) {
  state.includeSubfolders = Boolean(next);
  localStorage.setItem(
    INCLUDE_SUBFOLDERS_KEY,
    state.includeSubfolders ? 'on' : 'off'
  );
  syncIncludeSubfolders();
  // Folder counts, tag counts and the note list all depend on the scope;
  // search results have to be re-fetched because the backend scopes them too.
  recomputeTags();
  renderTags();
  renderFolders();
  renderNoteList();
  if (state.filter.query) void runSearch();
}

includeSubfoldersInput.addEventListener('change', () => {
  setIncludeSubfolders(includeSubfoldersInput.checked);
});

function syncMultiVaultButton() {
  if (!multiVaultBtn) return;
  const on = state.multiVault;
  multiVaultBtn.classList.toggle('active', on);
  multiVaultBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  const key = on ? 'sidebar.multiVaultOnTitle' : 'sidebar.multiVaultTitle';
  multiVaultBtn.title = t(key);
  multiVaultBtn.setAttribute('aria-label', t(key));
  // Prefer the loaded vaults (a pinned folder may have disappeared); fall
  // back to the configured set before the first load finishes.
  const count = state.vaults.length || activeVaultDirs().length;
  if (multiVaultCount) {
    multiVaultCount.textContent = String(count);
    multiVaultCount.classList.toggle('hidden', !on || count < 2);
  }
}

/**
 * Toggle multi-vault mode. On: every pinned vault joins the primary one.
 * Off: if the open note lives in another vault, that vault becomes primary so
 * the note (and its images) stay available instead of being closed.
 */
let multiVaultBusy = false;

async function setMultiVault(next) {
  if (multiVaultBusy) return;
  const on = Boolean(next);
  if (on === state.multiVault) return;
  multiVaultBusy = true;
  try {
    if (!on) {
      if (
        state.currentDir &&
        !sameDir(state.currentDir, state.dir, WINDOWS_PATHS)
      ) {
        if (!(await confirmVaultChange())) {
          syncMultiVaultButton();
          return;
        }
        state.dir = state.currentDir;
        localStorage.setItem('rustmd-dir', state.dir);
        rememberRecentDir(state.dir);
      }
    }
    state.multiVault = on;
    localStorage.setItem(MULTI_VAULT_KEY, on ? 'on' : 'off');
    syncMultiVaultButton();
    await loadNotes();
    if (on && pinnedVaultDirs().length === 0) {
      toast(t('vault.multiEmpty'));
    }
  } finally {
    multiVaultBusy = false;
  }
}

multiVaultBtn?.addEventListener('click', () => {
  void setMultiVault(!state.multiVault);
});

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
  requestAnimationFrame(updateNavAria);
}

function visibleNotes() {
  let list = state.searchHits
    ? state.searchHits.map((h) => ({ ...h.meta, searchSnippet: h.snippet }))
    : state.notes;
  list = filterNotes(list, {
    ...state.filter,
    includeSubfolders: state.includeSubfolders,
  });
  return sortNotes(list, { key: state.sortKey, dir: state.sortDir });
}

/** Notes that exist in the current subtree but are hidden by the scope. */
function hasHiddenSubfolderNotes() {
  if (state.includeSubfolders) return false;
  return state.notes.some(
    (note) =>
      (!state.filter.vault || note.vault === state.filter.vault) &&
      (!state.filter.tag ||
        (Array.isArray(note.tags) && note.tags.includes(state.filter.tag))) &&
      folderInScope(note.folder, state.filter.folder, true) &&
      !folderInScope(note.folder, state.filter.folder, false)
  );
}

function renderNoteList() {
  const list = visibleNotes();
  const scrollTop = noteList.scrollTop;
  noteCount.textContent = t('notes.count', { n: list.length });
  noteList.innerHTML = '';
  if (list.length === 0) {
    const emptyKey = state.filter.query
      ? 'notes.noMatches'
      : hasHiddenSubfolderNotes()
        ? 'notes.emptyScope'
        : 'notes.empty';
    noteList.innerHTML = `<div class="note-empty">${t(emptyKey)}</div>`;
    noteList.scrollTop = 0;
    return;
  }
  for (const n of list) {
    const item = document.createElement('div');
    const active =
      n.path === state.current && n.vault === state.currentDir;
    item.className = 'note-item' + (active ? ' active' : '');
    item.dataset.path = n.path;
    item.dataset.vault = n.vault || '';
    const relTitle = n.folder
      ? `${n.folder}/${fileNameOf(n.path)}`
      : fileNameOf(n.path);
    item.title =
      isMultiView() && n.vault
        ? `${vaultLabel(n.vault)} · ${relTitle}`
        : relTitle;
    const snippet = state.filter.query ? n.searchSnippet || n.snippet : n.snippet;
    const metaBits = [];
    if (isMultiView() && n.vault) {
      metaBits.push(
        `<span class="vault-chip" title="${esc(n.vault)}">${esc(
          vaultLabel(n.vault)
        )}</span>`
      );
    }
    if (n.folder) metaBits.push(`<span class="folder-path">${esc(n.folder)}</span>`);
    metaBits.push(
      `<span title="${esc(fmtFullTime(n.mtime))}">${esc(fmtTime(n.mtime))}</span>`
    );
    for (const t of n.tags.slice(0, 3)) {
      metaBits.push(`<span class="mini-tag">${esc(t)}</span>`);
    }
    const kind = KIND_UI[n.kind] ? n.kind : noteKindOf(n.path);
    // Every format carries the same kind badge in the list; the topbar
    // mirrors it for the open note. Allowlist the class name (defense in
    // depth, even though `kind` comes from the backend).
    const ui = kindUi(kind);
    const kindBadge = `<span class="kind-badge ${kind}" title="${esc(
      t(ui.title)
    )}">${ui.label}</span>`;
    item.innerHTML = `
      <div class="title">${highlightText(n.title, state.filter.query)}</div>
      <div class="file-line"><span class="file-name">${highlightText(fileNameOf(n.path), state.filter.query)}</span>${kindBadge}</div>
      ${snippet ? `<div class="snippet">${highlightText(snippet, state.filter.query)}</div>` : ''}
      <div class="meta">${metaBits.join('<span class="sep">·</span>')}</div>`;
    item.addEventListener('click', () => selectNote(n.vault, n.path));
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
      renderPreview(
        editor.state.doc.toString(),
        previewEl,
        state.currentKind
      );
    }
  }, state.currentKind === 'html' ? 1500 : 250);
  updateCounts();
}

function updateNoteInState(meta, vault) {
  const entry = { ...meta, vault };
  const idx = state.notes.findIndex(
    (n) => n.path === meta.path && n.vault === vault
  );
  if (idx >= 0) state.notes[idx] = entry;
  else state.notes.push(entry);
  const vaultNotes = state.notes.filter((n) => n.vault === vault);
  state.folderTreeByVault.set(
    vault,
    buildFolderTree(folderPathsFor(vault), vaultNotes)
  );
}

function scopedNotes() {
  return state.notes.filter(
    (note) =>
      (!state.filter.vault || note.vault === state.filter.vault) &&
      folderInScope(note.folder, state.filter.folder, state.includeSubfolders)
  );
}

function recomputeTags() {
  state.tags = countTags(scopedNotes());
  // The active tag may not exist in the new scope; leaving it filtered would
  // hide every note behind an invisible (and now unclickable) chip.
  if (
    state.filter.tag &&
    !state.tags.some((tag) => tag.name === state.filter.tag)
  ) {
    state.filter.tag = null;
  }
}

let saveQueue = Promise.resolve(true);

function saveCurrent(force = false) {
  const path = state.current;
  const dir = state.currentDir;
  if (!path || !dir || !editor) return Promise.resolve(true);
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
        dir,
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
              dir,
              path,
              tags,
              body,
              baseHash,
              baseMtime,
              true
            );
          } catch (retryErr) {
            return reportSaveFailure(retryErr, dir, path);
          }
        } else {
          state.pendingSave = true;
          state.saveFailed = true;
          if (state.current === path && state.currentDir === dir) {
            setSaveStatus('conflict');
          }
          return false;
        }
      } else {
        return reportSaveFailure(err, dir, path);
      }
    }

    updateNoteInState(meta, dir);
    recomputeTags();
    if (state.current === path && state.currentDir === dir) {
      state.currentHash = meta.hash;
      state.currentMtime = meta.mtime;
      if (meta.encoding) {
        state.currentEncoding = meta.encoding;
        updateStatusEncoding();
      }
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

function reportSaveFailure(err, dir, path) {
  const msg = String(err && err.message ? err.message : err);
  state.pendingSave = true;
  state.saveFailed = true;
  if (state.current === path && state.currentDir === dir) {
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
    reportSaveFailure(err, state.currentDir, state.current);
    return false;
  }
}

/**
 * Replace the editor with a note's content and sync every dependent view.
 * `preserveView` keeps the cursor/scroll position, used by the manual refresh
 * when the open note was modified on disk.
 */
function applyNoteContent(
  vault,
  path,
  content,
  { preserveView = false, focus = false } = {}
) {
  const scrollTop = editor.scrollDOM.scrollTop;
  const head = editor.state.selection.main.head;
  state.current = path;
  state.currentDir = vault;
  state.currentHash = content.hash || '';
  state.currentMtime = content.mtime || 0;
  // Local images resolve relative to THIS note's folder in THIS vault.
  setImageContext(vault, path);
  state.currentKind = content.kind || noteKindOf(path);
  state.currentEncoding = content.encoding || 'UTF-8';
  editor.setLanguage(state.currentKind);
  state.tagsOfCurrent = content.tags || [];
  // Loading must not mark the note dirty (a spurious save right after opening
  // would re-touch the file and, under `tauri dev`, retrigger the file watcher
  // → app restart loop → "window closed" + "files gone").
  suppressChange = true;
  const changes = {
    from: 0,
    to: editor.state.doc.length,
    insert: content.body,
  };
  editor.dispatch(
    preserveView
      ? {
          changes,
          selection: { anchor: Math.min(head, content.body.length) },
        }
      : { changes }
  );
  suppressChange = false;
  clearTimeout(state.previewTimer); // drop the previous note's pending update
  renderPreview(content.body, previewEl, state.currentKind);
  noteTitle.value = stemOf(path);
  renderTagEditor();
  updateKindBadge(state.currentKind);
  updateStatusEncoding();
  updateCounts();
  updateStatusPath();
  setSaveStatus('saved');
  editorPane.classList.add('visible');
  emptyState.classList.add('hidden');
  editor.scrollDOM.scrollTop = preserveView ? scrollTop : 0;
  if (focus) editor.focus();
}

/** Close the open note and return to the empty state (delete / external delete). */
function clearCurrentNote() {
  noteSelectSeq += 1;
  clearTimeout(state.saveTimer);
  clearTimeout(state.previewTimer);
  state.pendingSave = false;
  state.saveFailed = false;
  state.current = null;
  state.currentDir = null;
  state.currentKind = 'markdown';
  state.currentEncoding = '';
  state.currentHash = '';
  state.currentMtime = 0;
  state.tagsOfCurrent = [];
  suppressChange = true;
  editor.setLanguage('markdown');
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: '' },
  });
  suppressChange = false;
  renderPreview('', previewEl, 'markdown');
  noteTitle.value = '';
  renderTagEditor();
  updateKindBadge('markdown');
  updateStatusEncoding();
  updateCounts();
  setSaveStatus('saved');
  statusPath.textContent = '';
  editorPane.classList.remove('visible');
  emptyState.classList.remove('hidden');
}

let noteSelectSeq = 0;

function updateStatusPath() {
  if (!state.current) {
    statusPath.textContent = '';
    return;
  }
  statusPath.textContent =
    isMultiView() && state.currentDir
      ? `${vaultLabel(state.currentDir)} · ${state.current}`
      : state.current;
}

async function selectNote(vault, path) {
  if (!vault) return;
  if (vault === state.currentDir && path === state.current) return;
  const seq = ++noteSelectSeq;
  const loadSeq = state.loadSeq;
  const ok = await flushSave();
  if (seq !== noteSelectSeq || loadSeq !== state.loadSeq) return;
  if (!ok && !confirm(t('dialog.switchNote'))) {
    return;
  }
  if (!ok) {
    state.pendingSave = false;
    state.saveFailed = false;
  }
  try {
    const content = await api.readNote(vault, path);
    // A second click (or a vault change) may have won while read_note was in
    // flight; never apply a stale note over the user's latest choice.
    if (seq !== noteSelectSeq) return;
    applyNoteContent(vault, path, content, { focus: true });
    renderNoteList();
  } catch (err) {
    if (seq !== noteSelectSeq) return;
    toast(t('toast.openFailed', { msg: err.message || err }), true);
  }
}

function updateCounts() {
  const raw = editor ? editor.state.doc.toString() : '';
  const text = state.currentKind === 'html' ? htmlTextOf(raw) : raw;
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
  const vault = state.currentDir;
  try {
    const newPath = await api.renameNote(vault, state.current, value);
    state.current = newPath;
    state.currentKind = noteKindOf(newPath);
    editor.setLanguage(state.currentKind);
    updateKindBadge(state.currentKind);
    setImageContext(vault, newPath); // image resolution follows the note
    renderPreview(editor.state.doc.toString(), previewEl, state.currentKind);
    updateStatusPath();
    noteTitle.value = stemOf(newPath);
    await loadNotes();
    const meta = state.notes.find(
      (n) => n.path === newPath && n.vault === vault
    );
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
  // Only Markdown notes have front matter; updateKindBadge also hides it for
  // HTML/CSV/TXT/JSON.
  if (state.currentKind !== 'markdown') return;
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

let newNoteMenu = null;

function closeNewNoteMenu() {
  if (!newNoteMenu) return;
  newNoteMenu.remove();
  newNoteMenu = null;
  window.removeEventListener('mousedown', onNewNoteOutside, true);
  window.removeEventListener('keydown', onNewNoteEsc, true);
}

function onNewNoteOutside(e) {
  if (
    newNoteMenu &&
    !newNoteMenu.contains(e.target) &&
    !e.target.closest('#btn-new-note')
  ) {
    closeNewNoteMenu();
  }
}

function onNewNoteEsc(e) {
  if (e.key === 'Escape') closeNewNoteMenu();
}

async function createNewNote(kind) {
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
    // Create in the vault/folder the user is currently scoped to; with no
    // folder filter, next to the open note (or the primary vault).
    const vault = state.filter.vault || state.currentDir || state.dir;
    const folder =
      state.filter.vault === vault ? state.filter.folder || '' : '';
    const path = await api.createNote(vault, folder, kind);
    await loadNotes();
    await selectNote(vault, path);
  } catch (err) {
    toast(t('toast.newFailed', { msg: err.message || err }), true);
  }
}

function openNewNoteMenu() {
  if (!state.dir) return;
  closeNewNoteMenu();
  const rect = $('btn-new-note').getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'export-menu new-note-menu';
  for (const kind of ['markdown', 'html', 'csv', 'txt', 'json']) {
    const button = document.createElement('button');
    button.textContent = t(`new.${kind}`);
    button.addEventListener('click', () => {
      closeNewNoteMenu();
      void createNewNote(kind);
    });
    menu.appendChild(button);
  }
  document.body.appendChild(menu);
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.max(8, rect.left)}px`;
  newNoteMenu = menu;
  window.addEventListener('mousedown', onNewNoteOutside, true);
  window.addEventListener('keydown', onNewNoteEsc, true);
}

$('btn-new-note').addEventListener('click', openNewNoteMenu);

$('btn-delete').addEventListener('click', async () => {
  if (!state.current) return;
  if (!confirm(t('dialog.delete', { title: noteTitle.value }))) return;
  clearTimeout(state.saveTimer);
  state.pendingSave = false;
  state.saveFailed = false;
  await saveQueue.catch(() => false);
  try {
    const deleted = state.current;
    await api.deleteNote(state.currentDir, deleted);
    clearCurrentNote();
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
  // Capture the note being moved now; the modal is asynchronous and the user
  // could (via keyboard/focus) change the selection before a folder is picked.
  const sourceDir = state.currentDir;
  const sourcePath = state.current;
  if (!sourceDir || !sourcePath) return;
  const options = [
    { path: '', label: t('move.root'), depth: 0 },
    ...flattenFolderTree(folderTreeFor(sourceDir), () => true).map((node) => ({
      path: node.path,
      label: node.path,
      depth: node.depth,
    })),
  ];
  const currentFolder = folderOf(sourcePath);
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
        const newPath = await api.moveNote(sourceDir, sourcePath, opt.path);
        const stillCurrent =
          state.currentDir === sourceDir && state.current === sourcePath;
        if (stillCurrent) {
          state.current = newPath;
          state.currentKind = noteKindOf(newPath);
          setImageContext(sourceDir, newPath);
          // Relative image paths resolve against the note's NEW folder —
          // re-render so the preview's rmd URLs point at the right files.
          renderPreview(
            editor.state.doc.toString(),
            previewEl,
            state.currentKind
          );
          updateStatusPath();
          noteTitle.value = stemOf(newPath);
        }
        await loadNotes();
        if (stillCurrent) {
          const meta = state.notes.find(
            (n) => n.path === newPath && n.vault === sourceDir
          );
          if (meta) {
            state.currentHash = meta.hash || '';
            state.currentMtime = meta.mtime || 0;
          }
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
    const hits = await searchActiveVaults(q);
    if (seq !== searchSeq || q !== state.filter.query) {
      return; // a newer query (or a vault switch) won
    }
    state.searchHits = hits;
  } catch (err) {
    if (seq !== searchSeq || q !== state.filter.query) {
      return;
    }
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

/// PDF prefers the platform print pipeline (vector text, real pagination);
/// unsupported platforms and old WebView2 runtimes fall back to the
/// html2canvas image exporter so the export never fails because of the
/// renderer. PNG always uses the raster path.
async function exportNote(kind, body, noteKind, title) {
  if (kind === 'pdf' && api.canPrintPdf) {
    try {
      return await exportPdfVector(body, noteKind, title);
    } catch (err) {
      console.warn('矢量 PDF 导出不可用，改用图片 PDF：', err);
    }
  }
  return kind === 'png'
    ? exportPng(body, noteKind)
    : exportPdf(body, noteKind);
}

async function runExport(kind) {
  if (!state.current) return;
  const ok = await flushSave();
  if (!ok) {
    toast(t('toast.exportCancelled'), true);
    return;
  }
  const exportDir = state.currentDir;
  const exportPath = state.current;
  if (!exportDir || !exportPath) return;
  const title = noteTitle.value.trim() || t('note.untitled');
  const body = editor.state.doc.toString();
  const currentKind = state.currentKind;
  // Pin the image context to the exported note. Markdown stages are built
  // synchronously below; explicit contexts are passed to the HTML asset
  // inliner and hidden renderer so a note switch cannot mix two vaults.
  setImageContext(exportDir, exportPath);
  const exportCtx = { root: exportDir, notePath: exportPath };

  let payload;
  try {
    if (kind === 'html') {
      if (currentKind === 'html') {
        // An HTML note is already a standalone document: export it verbatim
        // so its scripts, styles and charts keep working outside the app.
        payload = {
          data: new TextEncoder().encode(ensureUtf8HtmlCharset(body)),
          ext: 'html',
          mime: 'text/html',
          filterName: t('export.filterHtml'),
          extensions: ['html', 'htm'],
        };
      } else {
        const html = await buildExportHtml(title, body, state.theme, currentKind);
        payload = {
          data: new TextEncoder().encode(html),
          ext: 'html',
          mime: 'text/html',
          filterName: t('export.filterHtml'),
          extensions: ['html', 'htm'],
        };
      }
    } else if (currentKind === 'html') {
      // Render the page in a hidden Tauri WebView window, or the dev-only
      // sandboxed iframe in browser mode, then save/capture it. PDF prefers
      // the WebView print pipeline (real text); the image slices below are
      // the fallback for platforms without a print API.
      toast(t(kind === 'png' ? 'toast.exportingPng' : 'toast.exportingPdf'));
      if (kind === 'pdf' && api.canPrintPdf) {
        try {
          // html2canvas in the hidden WebView requests local images in CORS
          // mode; inline them first so the strict rmd origin allowlist does
          // not drop vault images from the export.
          const printBody = await inlineLocalAssetsInHtml(body, exportCtx);
          const data = await api.printHtmlNote(
            exportDir,
            exportPath,
            printBody,
            title
          );
          payload = {
            data,
            ext: 'pdf',
            mime: 'application/pdf',
            filterName: t('export.filterPdf'),
            extensions: ['pdf'],
          };
        } catch (err) {
          console.warn('HTML 矢量 PDF 导出不可用，改用图片 PDF：', err);
        }
      }
      if (!payload) {
        let pngBytes;
        let pdfDataUrl;
        let cssWidth;
        if (api.isTauri) {
          const exportBody = await inlineLocalAssetsInHtml(body, exportCtx);
          const shot = await api.renderHtmlNote(
            exportDir,
            exportPath,
            exportBody,
            kind === 'pdf' ? 'pdf' : 'export'
          );
          pngBytes = shot.png;
          if (kind === 'pdf') {
            pdfDataUrl = bytesToDataUrl(shot.png, 'image/png');
          }
          cssWidth = shot.cssWidth;
        } else {
          const shot = await captureHtmlPreview(body);
          pngBytes = dataUrlToBytes(shot.dataUrl);
          pdfDataUrl = shot.dataUrl;
          cssWidth = shot.cssWidth;
        }
        if (kind === 'png') {
          payload = {
            data: pngBytes,
            ext: 'png',
            mime: 'image/png',
            filterName: t('export.filterPng'),
            extensions: ['png'],
          };
        } else {
          const pdf = await pdfFromPngDataUrl(pdfDataUrl, cssWidth);
          payload = {
            ...pdf,
            filterName: t('export.filterPdf'),
            extensions: ['pdf'],
          };
        }
      }
    } else {
      toast(t(kind === 'png' ? 'toast.exportingPng' : 'toast.exportingPdf'));
      const exported = await exportNote(kind, body, currentKind, title);
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
  applyWrap(state.wrap);
  syncMultiVaultButton();
  updateFullscreenButton();
  updateKindBadge();
  updateStatusEncoding();
  updateCounts();
  setSaveStatus(state.saveStatus);
  // Data previews contain translated headers/stats; refresh the open one.
  if (state.current && editor && isDataKind(state.currentKind)) {
    renderPreview(editor.state.doc.toString(), previewEl, state.currentKind);
  }
  applySidebar(isSidebarCollapsed());
  closeExportMenu();
  closeNewNoteMenu();
  closeVaultMenu();
  renderOnboardingRecents();
  for (const el of document.querySelectorAll('.modal-backdrop')) el.remove();
});

// ---------------- Init ----------------

async function boot() {
  applyStaticTranslations();
  bindLanguageSelects();
  applyTheme(state.theme);
  initEditor();
  applyWrap(state.wrap);
  updateFullscreenButton();
  updateKindBadge('markdown');
  applyView(state.view);
  applySidebar(localStorage.getItem('rustmd-sidebar') === 'closed');
  syncIncludeSubfolders();
  syncMultiVaultButton();
  renderSortControls();
  renderTagEditor();
  renderOnboardingRecents();

  if (!state.dir) {
    // No vault is open: revoke any roots left registered by a previous
    // session/profile so the rmd protocol cannot serve stale folders.
    void registerVaultRoots([]).catch(() => {});
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
    void registerVaultRoots([]).catch(() => {});
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
  void runSelfTest({
    getState: () => ({
      dir: state.dir,
      current: state.current,
      currentDir: state.currentDir,
      dirs: activeVaultDirs(),
    }),
  });
}
