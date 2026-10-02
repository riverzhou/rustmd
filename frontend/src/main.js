import './style.css';
import { api } from './api.js';
import { createEditor } from './editor.js';
import { renderPreview, buildExportHtml, setPreviewTheme } from './preview.js';
import { exportPng, exportPdf, bytesToDataUrl } from './export.js';

// ---------------- State ----------------

const state = {
  dir: localStorage.getItem('rustmd-dir'),
  notes: [],
  folders: [], // [{ name, count }]
  tags: [], // [{ name, count }]
  current: null, // relative path
  tagsOfCurrent: [],
  view: localStorage.getItem('rustmd-view') || 'split',
  theme:
    localStorage.getItem('rustmd-theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  filter: { folder: null, tag: null, query: '' },
  searchHits: null,
  saveTimer: null,
  previewTimer: null,
  pendingSave: false,
};

// ---------------- DOM refs ----------------

const $ = (id) => document.getElementById(id);
const onboardingEl = $('onboarding');
const mainEl = $('main');
const dirInput = $('dir-input');
const onboardingError = $('onboarding-error');
const searchInput = $('search-input');
const folderList = $('folder-list');
const tagCloud = $('tag-cloud');
const tagGroup = $('tag-group');
const noteList = $('note-list');
const noteCount = $('note-count');
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
  const re = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'gi'
  );
  return safe.replace(re, (m) => `<mark>${m}</mark>`);
}

function fmtTime(mtime) {
  const d = new Date(mtime * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const y = d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()}/`;
  return `${y}${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function countWords(text) {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin =
    (text
      .replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g, ' ')
      .match(/[A-Za-z0-9_'-]+/g) || []).length;
  return cjk + latin;
}

const FOLDER_SVG =
  '<svg class="folder-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.2c0-.67.53-1.2 1.2-1.2h2.6l1.4 1.8h4.6c.67 0 1.2.53 1.2 1.2v6c0 .67-.53 1.2-1.2 1.2H3.7c-.67 0-1.2-.53-1.2-1.2z"/></svg>';

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
    ? '点击左上角按钮显示笔记列表，或按 Ctrl+B'
    : '从左侧选择一篇笔记，或新建一篇开始写作';
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
    case '1': e.preventDefault(); applyView('edit'); break;
    case '2': e.preventDefault(); applyView('split'); break;
    case '3': e.preventDefault(); applyView('preview'); break;
    case 'b': e.preventDefault(); toggleSidebar(); break;
  }
});

// ---------------- Onboarding / dir ----------------

async function enterDir(dir) {
  let notes;
  try {
    notes = await api.listNotes(dir);
  } catch (err) {
    onboardingError.textContent = `无法打开目录：${err.message || err}`;
    onboardingError.classList.remove('hidden');
    return;
  }
  onboardingError.classList.add('hidden');
  state.dir = dir;
  localStorage.setItem('rustmd-dir', dir);
  onboardingEl.classList.add('hidden');
  mainEl.classList.remove('hidden');
  await loadNotes();
}

$('pick-dir-btn').addEventListener('click', async () => {
  try {
    const dir = await api.pickDirectory();
    if (dir) dirInput.value = dir;
  } catch (err) {
    toast(`选择目录失败：${err.message || err}`, true);
  }
});

$('open-dir-btn').addEventListener('click', () => {
  const dir = dirInput.value.trim();
  if (!dir) {
    onboardingError.textContent = '请选择或输入笔记目录';
    onboardingError.classList.remove('hidden');
    return;
  }
  enterDir(dir);
});

dirInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('open-dir-btn').click();
});

$('btn-change-dir').addEventListener('click', () => {
  mainEl.classList.add('hidden');
  onboardingEl.classList.remove('hidden');
  dirInput.value = state.dir || '';
});

// ---------------- Notes loading ----------------

async function loadNotes() {
  try {
    state.notes = await api.listNotes(state.dir);
  } catch (err) {
    toast(`读取笔记失败：${err.message || err}`, true);
    return;
  }
  // folders
  const folderMap = new Map();
  for (const n of state.notes) {
    if (n.folder) {
      folderMap.set(n.folder, (folderMap.get(n.folder) || 0) + 1);
    }
  }
  state.folders = [...folderMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  // tags
  const tagMap = new Map();
  for (const n of state.notes) {
    for (const t of n.tags) tagMap.set(t, (tagMap.get(t) || 0) + 1);
  }
  state.tags = [...tagMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

  renderFolders();
  renderTags();
  renderNoteList();
}

function renderFolders() {
  folderList.innerHTML = '';
  const allItem = document.createElement('li');
  allItem.className = 'nav-item' + (state.filter.folder === null ? ' active' : '');
  allItem.innerHTML = `${FOLDER_SVG}<span>全部</span><span class="count">${state.notes.length}</span>`;
  allItem.addEventListener('click', () => {
    state.filter.folder = null;
    renderFolders();
    renderNoteList();
  });
  folderList.appendChild(allItem);
  for (const f of state.folders) {
    const item = document.createElement('li');
    const depth = f.name.split('/').length - 1;
    item.className = 'nav-item' + (state.filter.folder === f.name ? ' active' : '');
    item.style.paddingLeft = `${8 + depth * 14}px`;
    item.innerHTML = `${FOLDER_SVG}<span>${esc(f.name.split('/').pop())}</span><span class="count">${f.count}</span>`;
    item.title = f.name;
    item.addEventListener('click', () => {
      state.filter.folder = state.filter.folder === f.name ? null : f.name;
      renderFolders();
      renderNoteList();
    });
    folderList.appendChild(item);
  }
}

function renderTags() {
  tagCloud.innerHTML = '';
  if (state.tags.length === 0) {
    tagCloud.innerHTML = '<span style="font-size:12px;color:var(--text-faint)">暂无标签</span>';
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
  const { folder, tag } = state.filter;
  if (folder) list = list.filter((n) => n.folder === folder);
  if (tag) list = list.filter((n) => n.tags.includes(tag));
  return list;
}

function renderNoteList() {
  const list = visibleNotes();
  noteCount.textContent = `${list.length} 篇`;
  noteList.innerHTML = '';
  if (list.length === 0) {
    noteList.innerHTML =
      '<div class="note-empty">' +
      (state.filter.query ? '没有匹配的笔记' : '暂无笔记<br>点击左上角 ＋ 新建') +
      '</div>';
    return;
  }
  for (const n of list) {
    const item = document.createElement('div');
    item.className = 'note-item' + (n.path === state.current ? ' active' : '');
    const snippet = state.filter.query ? n.searchSnippet || n.snippet : n.snippet;
    const metaBits = [];
    if (n.folder) metaBits.push(esc(n.folder.split('/').pop()));
    metaBits.push(fmtTime(n.mtime));
    for (const t of n.tags.slice(0, 3)) metaBits.push(`<span class="mini-tag">${esc(t)}</span>`);
    item.innerHTML = `
      <div class="title">${highlightText(n.title, state.filter.query)}</div>
      ${snippet ? `<div class="snippet">${highlightText(snippet, state.filter.query)}</div>` : ''}
      <div class="meta">${metaBits.join('<span>·</span>')}</div>`;
    item.addEventListener('click', () => selectNote(n.path));
    noteList.appendChild(item);
  }
}

// ---------------- Note selection & editing ----------------

let editor = null;
// True while we dispatch a programmatic document replacement (loading a
// note, clearing after delete). CodeMirror fires its update listener
// synchronously during dispatch, which would otherwise mark the note as
// dirty and schedule a spurious save of the just-loaded content.
let suppressChange = false;

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

function onEditorChange() {
  if (suppressChange) return;
  if (!state.current) return;
  state.pendingSave = true;
  statusSave.textContent = '未保存…';
  statusSave.className = 'saving';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveCurrent, 500);
  // Debounce the preview: re-parsing the whole document (and re-rendering
  // every mermaid diagram) on each keystroke used to exhaust the WebView2
  // renderer. 250 ms is imperceptible and collapses a typing burst into one
  // render. The path guard drops the update if the note is switched/closed
  // before the timer fires.
  const path = state.current;
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(() => {
    if (state.current === path) renderPreview(editor.state.doc.toString(), previewEl);
  }, 250);
  updateCounts();
}

async function flushSave() {
  clearTimeout(state.saveTimer);
  if (state.pendingSave && state.current) await saveCurrent(true);
}

async function saveCurrent(force = false) {
  if (!state.current) return;
  state.pendingSave = false;
  try {
    const meta = await api.saveNote(state.dir, state.current, state.tagsOfCurrent, editor.state.doc.toString());
    const idx = state.notes.findIndex((n) => n.path === state.current);
    if (idx >= 0) state.notes[idx] = meta;
    else state.notes.unshift(meta);
    statusSave.textContent = '已保存';
    statusSave.className = '';
    renderFolders();
    renderTags();
    renderNoteList();
    if (document.activeElement !== noteTitle) {
      noteTitle.value = stemOf(state.current);
    }
  } catch (err) {
    statusSave.textContent = '保存失败';
    statusSave.className = 'error';
    toast(`保存失败：${err.message || err}`, true);
  }
}

function stemOf(path) {
  const name = path.split('/').pop();
  return name.replace(/\.md$/i, '');
}

async function selectNote(path) {
  if (path === state.current) return;
  await flushSave();
  try {
    const content = await api.readNote(state.dir, path);
    state.current = path;
    state.tagsOfCurrent = content.tags;
    // Loading must not mark the note dirty (a spurious save right after
    // opening would re-touch the file and, under `tauri dev`, retrigger the
    // file watcher → app restart loop → "window closed" + "files gone").
    suppressChange = true;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content.body } });
    suppressChange = false;
    editor.scrollDOM.scrollTop = 0;
    clearTimeout(state.previewTimer); // drop the previous note's pending update
    renderPreview(content.body, previewEl);
    noteTitle.value = stemOf(path);
    renderTagEditor();
    updateCounts();
    statusPath.textContent = path;
    statusSave.textContent = '已保存';
    statusSave.className = '';
    editorPane.classList.add('visible');
    emptyState.classList.add('hidden');
    renderNoteList();
    editor.focus();
  } catch (err) {
    toast(`打开笔记失败：${err.message || err}`, true);
  }
}

function updateCounts() {
  const text = editor ? editor.state.doc.toString() : '';
  const words = countWords(text);
  const chars = text.replace(/\s/g, '').length;
  statusCounts.textContent = `${words} 字 · ${chars} 字符`;
}

// ---------------- Title (rename) ----------------

// Suppress rename-commit when the user mousedowns elsewhere (e.g. the note
// list) so clicking another note doesn't race the blur commit.
let suppressRename = false;
noteList.addEventListener('mousedown', () => {
  suppressRename = true;
});
window.addEventListener('mouseup', () => {
  setTimeout(() => (suppressRename = false), 0);
});

async function commitRename() {
  if (!state.current) return;
  const value = noteTitle.value.trim();
  const stem = stemOf(state.current);
  if (!value || value === stem || suppressRename) {
    noteTitle.value = stem;
    return;
  }
  await flushSave();
  try {
    const newPath = await api.renameNote(state.dir, state.current, value);
    const idx = state.notes.findIndex((n) => n.path === state.current);
    if (idx >= 0) {
      state.notes[idx] = {
        ...state.notes[idx],
        path: newPath,
        folder: newPath.includes('/') ? newPath.slice(0, newPath.lastIndexOf('/')) : '',
        title: stemOf(newPath),
      };
    }
    state.current = newPath;
    statusPath.textContent = newPath;
    noteTitle.value = stemOf(newPath);
    renderFolders();
    renderNoteList();
    toast('已重命名');
  } catch (err) {
    noteTitle.value = stem;
    toast(`重命名失败：${err.message || err}`, true);
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
  for (const t of state.tagsOfCurrent) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${esc(t)}<span class="remove" title="移除">×</span>`;
    chip.querySelector('.remove').addEventListener('click', () => {
      state.tagsOfCurrent = state.tagsOfCurrent.filter((x) => x !== t);
      renderTagEditor();
      onMetaChanged();
    });
    tagEditor.appendChild(chip);
  }
  const input = document.createElement('input');
  input.placeholder = '+ 标签';
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
  state.pendingSave = true;
  statusSave.textContent = '未保存…';
  statusSave.className = 'saving';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveCurrent, 500);
}

// ---------------- New / delete / move ----------------

$('btn-new-note').addEventListener('click', async () => {
  if (!state.dir) return;
  try {
    const path = await api.createNote(state.dir, state.filter.folder || '');
    await loadNotes();
    await selectNote(path);
  } catch (err) {
    toast(`新建笔记失败：${err.message || err}`, true);
  }
});

$('btn-delete').addEventListener('click', async () => {
  if (!state.current) return;
  if (!confirm(`确定删除「${noteTitle.value}」吗？此操作不可恢复。`)) return;
  try {
    await api.deleteNote(state.dir, state.current);
    state.current = null;
    state.pendingSave = false;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '' } });
    renderPreview('', previewEl);
    noteTitle.value = '';
    editorPane.classList.remove('visible');
    emptyState.classList.remove('hidden');
    await loadNotes();
    toast('已删除');
  } catch (err) {
    toast(`删除失败：${err.message || err}`, true);
  }
});

$('btn-move').addEventListener('click', () => {
  if (!state.current) return;
  openMoveModal();
});

function openMoveModal() {
  const options = [{ name: '', label: '根目录' }, ...state.folders.map((f) => ({ name: f.name, label: f.name }))];
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = '<h3>移动到文件夹</h3><div class="modal-list"></div>';
  const list = modal.querySelector('.modal-list');
  for (const opt of options) {
    const item = document.createElement('div');
    item.className = 'modal-item';
    item.innerHTML = `${FOLDER_SVG}<span>${esc(opt.label)}</span>`;
    if (state.current && (state.current.split('/').slice(0, -1).join('/') || '') === opt.name) {
      item.classList.add('current');
      item.title = '当前所在';
    }
    item.addEventListener('click', async () => {
      backdrop.remove();
      const curFolder = state.current.split('/').slice(0, -1).join('/');
      if (opt.name === curFolder) return;
      try {
        const newPath = await api.moveNote(state.dir, state.current, opt.name);
        const idx = state.notes.findIndex((n) => n.path === state.current);
        if (idx >= 0) {
          state.notes[idx] = {
            ...state.notes[idx],
            path: newPath,
            folder: newPath.includes('/') ? newPath.slice(0, newPath.lastIndexOf('/')) : '',
          };
        }
        state.current = newPath;
        statusPath.textContent = newPath;
        noteTitle.value = stemOf(newPath);
        await loadNotes();
        toast(`已移动到 ${opt.label}`);
      } catch (err) {
        toast(`移动失败：${err.message || err}`, true);
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
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = searchInput.value.trim();
    state.filter.query = q;
    if (!q) {
      state.searchHits = null;
      renderNoteList();
      return;
    }
    try {
      state.searchHits = await api.searchNotes(state.dir, q);
    } catch (err) {
      toast(`搜索失败：${err.message || err}`, true);
      state.searchHits = [];
    }
    renderNoteList();
  }, 250);
});

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
    { kind: 'html', label: '导出 HTML 文件' },
    { kind: 'png', label: '导出 PNG（高清图）' },
    { kind: 'pdf', label: '导出 PDF' },
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

async function runExport(kind) {
  if (!state.current) return;
  await flushSave();
  const title = noteTitle.value.trim() || '无标题';
  const body = editor.state.doc.toString();

  let payload;
  if (kind === 'html') {
    payload = {
      data: await buildExportHtml(title, body, state.theme),
      ext: 'html',
      mime: 'text/html',
      opts: { title: '导出 HTML', filterName: 'HTML 文件', extensions: ['html', 'htm'] },
    };
  } else {
    toast(kind === 'png' ? '正在生成 PNG…' : '正在生成 PDF…');
    try {
      payload = kind === 'png' ? await exportPng(body) : await exportPdf(body);
    } catch (err) {
      toast(`导出失败：${err.message || err}`, true);
      return;
    }
    payload.opts = {
      title: kind === 'png' ? '导出 PNG' : '导出 PDF',
      filterName: kind === 'png' ? 'PNG 图片' : 'PDF 文档',
      extensions: [payload.ext],
    };
  }

  const defaultName = `${title}.${payload.ext}`;
  const target = await api.pickSavePath(defaultName, payload.opts);
  if (!target) {
    // Browser mock mode has no save dialog: download instead.
    const url = URL.createObjectURL(new Blob([payload.data], { type: payload.mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast('已开始下载');
    return;
  }
  try {
    if (payload.data instanceof Uint8Array) await api.writeBytes(target, payload.data);
    else await api.writeText(target, payload.data);
    toast(`已导出到 ${target}`);
  } catch (err) {
    toast(`导出失败：${err.message || err}`, true);
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

// ---------------- Global error surface ----------------
// Tauri's webview console is not piped to the terminal, so surface runtime
// errors as toasts — otherwise a module-level throw looks like a silent
// white screen.

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason && (e.reason.message || e.reason.toString());
  toast(`错误：${msg}`, true);
});

window.addEventListener('error', (e) => {
  if (e.error) {
    console.error('[rustmd] window error', e.error);
    toast(`JS 错误：${e.error.message || e.error}`, true);
  }
});

// ---------------- Init ----------------

applyTheme(state.theme);
initEditor();
applyView(state.view);
applySidebar(localStorage.getItem('rustmd-sidebar') === 'closed');
renderTagEditor();

if (state.dir) {
  // try auto-open last dir; fall back to onboarding if it fails
  onboardingEl.classList.add('hidden');
  mainEl.classList.remove('hidden');
  try {
    const notes = await api.listNotes(state.dir);
    state.notes = notes;
    renderFolders();
    renderTags();
    renderNoteList();
  } catch {
    state.dir = null;
    localStorage.removeItem('rustmd-dir');
    mainEl.classList.add('hidden');
    onboardingEl.classList.remove('hidden');
  }
} else {
  onboardingEl.classList.remove('hidden');
}

// ---------------- Dev self-test (?selftest=1) ----------------
// End-to-end render + PNG/PDF export check of the examples/ vault inside the
// REAL app (real webview, real Rust backend, real remote images). Launch with
// `RUSTMD_SELFTEST=1 scripts\run-dev.bat`; artifacts + report.json land in
// C:\Users\River\AppData\Local\Temp\opencode\rustmd-selftest.
// Dev builds only: vite compiles import.meta.env.DEV to false in release
// builds, so this block disappears from shipped binaries.

if (import.meta.env.DEV && new URLSearchParams(location.search).has('selftest')) {
  const SELFTEST_EXAMPLES_DIR = 'D:/GitHub/rustmd/examples';
  const SELFTEST_OUT_DIR =
    'C:/Users/River/AppData/Local/Temp/opencode/rustmd-selftest';

  /// Text nodes outside code/pre still holding a full math delimiter pair
  /// => a formula that was never typeset.
  function residualRawMath(box) {
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        // toUpperCase: SVG elements report lowercase tagNames — the <style>
        // inside mermaid's <svg> holds CSS whose selectors can look like
        // raw $$ / $ pairs and false-positive otherwise.
        const tag = p.tagName.toUpperCase();
        if (tag === 'CODE' || tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const bad = [];
    while (walker.nextNode()) {
      const t = walker.currentNode.nodeValue;
      if ((t.match(/\$\$/g) || []).length >= 2) bad.push('display: ' + t.trim().slice(0, 50));
      else if (/(^|[^\\$])\$[^\n]*?[^\s$\\]\$(?!\$)/.test(t)) bad.push('inline: ' + t.trim().slice(0, 50));
    }
    return bad;
  }

  /// Count saturated (chart/photo) pixels of an exported PNG. Event-based
  /// load wait — img.decode() never settles for blob: URLs in Chromium.
  async function analyzePngPixels(bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    try {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('img load timeout')), 30000);
        img.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
        img.addEventListener('error', () => { clearTimeout(t); reject(new Error('img load error')); }, { once: true });
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let saturated = 0;
      let nonWhite = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (Math.max(r, g, b) - Math.min(r, g, b) > 30) saturated++;
        if (r < 245 || g < 245 || b < 245) nonWhite++;
      }
      return { w: canvas.width, h: canvas.height, saturatedPixels: saturated, nonWhitePixels: nonWhite };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------------- Remote-image presence in the exported PNG ----------------
  // 2D normalized cross-correlation (NCC) of each reference image over the
  // export. (An earlier row-mean SAD attempt was unreliable: the COS charts
  // are grayscale and the row means of OTHER charts/tables in the document
  // partially correlate, so it picked spurious y positions and scored 26–38
  // even for exports that contained the image — while the true position
  // scores NCC ≥ 0.92 at full res.) Block NCC is far more discriminative:
  // present ≈ 0.9+, non-image regions < 0.5.
  //
  // Geometry: the export stage is always 948 CSS px wide with the article
  // (and its images) at x=44..904, so the image occupies a FIXED FRACTION
  // of the PNG width regardless of the export scale. The export is
  // downsampled to VERIFY_WORK px for speed; the reference is resampled to
  // the matching size and slid vertically (small x tolerance) to find the
  // best NCC.
  const VERIFY_WORK = 128;
  const VERIFY_PRESENT_NCC = 0.75;

  /// Magic-byte image type (same logic as export.js's guessImageMime) —
  /// a typeless Blob URL fails to decode as an <img> in the webview.
  function guessMime(bytes) {
    if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (bytes.length > 5 && bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
    if (
      bytes.length > 11 && bytes[0] === 0x52 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45
    ) return 'image/webp';
    if (bytes.length > 3 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
    return 'application/octet-stream';
  }

  function waitImg(img, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth > 0) return resolve();
      const t = setTimeout(() => reject(new Error('image load timeout')), timeoutMs);
      img.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
      img.addEventListener('error', () => { clearTimeout(t); reject(new Error('image load error')); }, { once: true });
    });
  }

  function nonWhiteOf(canvas) {
    const d = canvas.getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++;
    }
    return n;
  }

  async function pngToRChannel(bytes, width) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    try {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('png load timeout')), 60000);
        img.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
        img.addEventListener('error', () => { clearTimeout(t); reject(new Error('png load error')); }, { once: true });
      });
      const c = document.createElement('canvas');
      c.width = width;
      c.height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * width));
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const r = new Float32Array(c.width * c.height);
      for (let i = 0; i < r.length; i++) r[i] = d[i * 4];
      return { r, w: c.width, h: c.height, natW: img.naturalWidth, natH: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /// Best 2D NCC of each remote image's bytes over the export. `refs`
  /// carry the raw bytes from the SAME Rust fetch path the export uses, so
  /// a "present" verdict proves the full chain: Rust fetch → data-URL swap
  /// → html2canvas raster → PNG file.
  async function verifyRemoteImagesInPng(pngBytes, refs) {
    const { r, w, h, natH } = await pngToRChannel(pngBytes, VERIFY_WORK);
    // Image left edge / width are fixed fractions of the PNG width
    // (stage 948 CSS px, image at x=44..904) — scale independent.
    const x0 = Math.round((44 * w) / 948);
    const tw = Math.max(8, Math.round((860 * w) / 948));
    const xLo = Math.max(0, x0 - 2);
    const xHi = Math.min(w - tw, x0 + 2);
    const results = [];
    for (const ref of refs) {
      let best = { ncc: -1, mad: Infinity, y: -1 };
      let dims = null;
      let error = null;
      try {
        // Data URL — the same decode path the export itself uses.
        const url = bytesToDataUrl(ref.bytes, guessMime(ref.bytes));
        const img = new Image();
        img.src = url;
        await waitImg(img, 30000);
        dims = img.naturalWidth + 'x' + img.naturalHeight;
        const th = Math.max(8, Math.round((img.naturalHeight / img.naturalWidth) * tw));
        const c = document.createElement('canvas');
        c.width = tw; c.height = th;
        c.getContext('2d').drawImage(img, 0, 0, tw, th);
        const rd = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, tw, th).data;
        const refR = new Float32Array(tw * th);
        let cSum = 0, cSumsq = 0;
        for (let i = 0; i < refR.length; i++) {
          const v = rd[i * 4];
          refR[i] = v;
          cSum += v;
          cSumsq += v * v;
        }
        const n = tw * th;
        const cMean = cSum / n;
        const cVar = Math.max(1e-6, cSumsq / n - cMean * cMean);
        for (let y = 0; y + th <= h; y++) {
          for (let x = xLo; x <= xHi; x++) {
            let bSum = 0, bSumsq = 0, bRC = 0, bMad = 0;
            for (let ry = 0; ry < th; ry++) {
              const ro = (y + ry) * w + x;
              const rk = ry * tw;
              for (let rx = 0; rx < tw; rx++) {
                const v = r[ro + rx];
                const t = refR[rk + rx];
                bSum += v;
                bSumsq += v * v;
                bRC += v * t;
                bMad += v > t ? v - t : t - v;
              }
            }
            const bMean = bSum / n;
            const bVar = bSumsq / n - bMean * bMean;
            if (bVar < 1e-3) continue; // blank (white) region — NCC undefined
            const ncc = (bRC / n - bMean * cMean) / Math.sqrt(bVar * cVar);
            if (ncc > best.ncc) best = { ncc, mad: bMad / n, y };
          }
        }
      } catch (e) {
        error = String(e);
      }
      // Report the ORIGINAL https URL (not the data: URL — it is huge).
      results.push({
        url: ref.url,
        dims,
        ncc: best.ncc < 0 ? null : +best.ncc.toFixed(3),
        mad: Number.isFinite(best.mad) ? +best.mad.toFixed(2) : null,
        atY: best.y,
        // Best position in FULL-RES PNG pixels (handy for humans).
        atYPng: best.y < 0 ? null : Math.round(best.y * (natH / h)),
        present: best.ncc >= VERIFY_PRESENT_NCC,
        error,
      });
    }
    return results;
  }

  /// WebView2 pipeline probe: isolates WHICH stage drops the remote image
  /// from the export. Stages, in order:
  ///   1. bytes → typed blob → <img src=blob:>: does the webview decode it?
  ///      (Historical: the 02:31 export used this path, but Tauri returned
  ///      the bytes as a plain array-like, so the Blob contained the
  ///      STRINGIFIED byte list and decode always failed — the root cause
  ///      of the blank-image exports. With the api.js Uint8Array
  ///      normalization this stage should now succeed; recorded either way.)
  ///   2. bytes → <img src=data:>: does the webview decode a data URL?
  ///   3. bytes → <img> → drawImage → pixels: direct canvas decode.
  ///   4. stage <img src=https:>: does the webview load the remote image?
  ///   5. html2canvas over the ORIGINAL cross-origin img (useCORS path —
  ///      expected blank: no CORS headers on the COS host).
  ///   6. stage <img src=data:swap>: does html2canvas rasterize the
  ///      data-swapped image (the ACTUAL export path)?
  /// A present image at scale 1 is ~860×594 and ≈53% non-white → ~270k
  /// non-white px on the stage canvas; a blank export gives ≈0.
  async function probeExportPipeline(url) {
    const stage = document.createElement('div');
    stage.className = 'export-stage';
    const article = document.createElement('article');
    article.className = 'markdown-body';
    stage.appendChild(article);
    document.body.appendChild(stage);
    const result = { url };
    try {
      const bytes = await api.fetchImageBytes(url);
      result.fetchedBytes = bytes.length;
      // Byte type as seen by JS (Tauri used to return a plain array-like;
      // api.js now normalizes to Uint8Array).
      result.bytesType = Object.prototype.toString.call(bytes);
      result.bytesIsUint8 = bytes instanceof Uint8Array;
      const mime = guessMime(bytes);
      result.mime = mime;
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const dataUrl = bytesToDataUrl(bytes, mime);

      // 1) blob decode (the OLD export path — expected to fail here)
      const refImg = new Image();
      refImg.src = blobUrl;
      await waitImg(refImg, 15000).catch((e) => { result.blobImgError = String(e); });
      result.blobImg = { complete: refImg.complete, dims: refImg.naturalWidth + 'x' + refImg.naturalHeight };
      URL.revokeObjectURL(blobUrl);

      // 2+3) data: URL decode + direct drawImage
      const dataImg = new Image();
      dataImg.src = dataUrl;
      await waitImg(dataImg, 15000).catch((e) => { result.dataImgError = String(e); });
      result.dataImg = { complete: dataImg.complete, dims: dataImg.naturalWidth + 'x' + dataImg.naturalHeight };
      if (dataImg.naturalWidth > 0) {
        const c = document.createElement('canvas');
        c.width = dataImg.naturalWidth; c.height = dataImg.naturalHeight;
        c.getContext('2d').drawImage(dataImg, 0, 0);
        result.drawImageNonWhite = nonWhiteOf(c);
      }

      // 4) webview load of the original https img
      const img = document.createElement('img');
      img.src = url;
      article.appendChild(img);
      await waitImg(img, 20000).catch((e) => { result.httpsImgError = String(e); });
      result.httpsImg = { complete: img.complete, dims: img.naturalWidth + 'x' + img.naturalHeight };

      // 5) html2canvas over the original cross-origin img
      const { default: html2canvas } = await import('html2canvas');
      let canvas = await html2canvas(stage, { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false });
      result.h2cOriginalNonWhite = nonWhiteOf(canvas);

      // 6) html2canvas over the data-swapped img (the ACTUAL export path)
      img.removeAttribute('srcset');
      img.src = dataUrl;
      await waitImg(img, 20000).catch((e) => { result.swapImgError = String(e); });
      result.swapImg = { complete: img.complete, dims: img.naturalWidth + 'x' + img.naturalHeight };
      canvas = await html2canvas(stage, { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false });
      result.h2cSwapNonWhite = nonWhiteOf(canvas);
    } catch (e) {
      result.error = String(e && e.stack || e);
    } finally {
      stage.remove();
    }
    return result;
  }

  (async () => {
    const report = {
      startedAt: new Date().toISOString(),
      ok: false,
      entries: [],
      errors: [],
    };
    try {
      const notes = await api.listNotes(SELFTEST_EXAMPLES_DIR);
      for (const meta of notes) {
        const entry = { path: meta.path, remoteImagesInSource: null };
        const { body } = await api.readNote(SELFTEST_EXAMPLES_DIR, meta.path);
        entry.remoteImagesInSource = (body.match(/!\[[^\]]*\]\(\s*https?:/g) || []).length;

        // 1) render through the real preview pipeline
        const box = document.createElement('div');
        box.className = 'markdown-body';
        box.style.cssText = 'position:fixed;left:-100000px;top:0;width:900px;';
        document.body.appendChild(box);
        const t0 = performance.now();
        await renderPreview(body, box);
        // Remote imgs: renderPreview only guarantees DOM + math + mermaid are
        // done, NOT that <img> fetches settled — wait for load/error before
        // snapshotting (the old immediate check raced and reported false).
        const remoteImgs = [...box.querySelectorAll('img')].filter((i) =>
          /^https?:/.test(i.getAttribute('src') || '')
        );
        await Promise.all(
          remoteImgs.map(
            (i) =>
              new Promise((resolve) => {
                if (i.complete && i.naturalWidth > 0) return resolve();
                const t = setTimeout(resolve, 20000);
                i.addEventListener('load', () => { clearTimeout(t); resolve(); }, { once: true });
                i.addEventListener('error', () => { clearTimeout(t); resolve(); }, { once: true });
              })
          )
        );
        // Independent probe of the backend fetch path (the same one export
        // uses per image): distinguishes export-stage blanks caused by the
        // Rust fetch vs. webview img loading vs. html2canvas rasterization.
        const remoteUrls = [...new Set(remoteImgs.map((i) => i.getAttribute('src')))];
        const remoteFetchResults = await Promise.all(
          remoteUrls.map(async (url) => {
            try {
              const bytes = await api.fetchImageBytes(url);
              return { url, ok: true, bytes };
            } catch (e) {
              return { url, ok: false, error: String(e) };
            }
          })
        );
        const remoteFetch = remoteFetchResults.map(({ url, ok, error, bytes }) =>
          bytes ? { url, ok, bytes: bytes.length } : { url, ok, error }
        );
        const remoteRefs = remoteFetchResults.filter((r) => r.ok);
        entry.render = {
          ms: Math.round(performance.now() - t0),
          mermaidDiagrams: box.querySelectorAll('.mermaid-diagram').length,
          mermaidErrors: box.querySelectorAll('.mermaid-error').length,
          mjxTypeset: box.querySelectorAll('mjx-container').length,
          mjxErrors: box.querySelectorAll('mjx-merror').length,
          residualRawMath: residualRawMath(box),
          remoteImgsLoaded: remoteImgs.map((i) => i.complete && i.naturalWidth > 0),
          remoteFetch,
        };
        // Multi-line math guard (regression: DISPLAY_MATH_RE lost its global
        // flag, so only the FIRST $$…$$ block was protected from marked's
        // escaping; `\\` row separators collapsed and every matrix/align/
        // cases rendered as ONE squashed line. The batch still typeset
        // "successfully", so error counts never flagged it — only geometry
        // reveals it: a rendered 2-line environment is ≥ ~2200 SVG units
        // tall, a squashed one is ≤ ~1150.)
        const displayBlocks = body.match(/(^|\n)\s*\$\$[\s\S]*?\$\$(?=\n|$)/g) || [];
        const multirowBlocks = displayBlocks.filter((b) => b.includes('\\\\'));
        let maxVbHeight = 0;
        for (const svg of box.querySelectorAll('mjx-container svg')) {
          const vb = (svg.getAttribute('viewBox') || '').split(/\s+/);
          maxVbHeight = Math.max(maxVbHeight, parseFloat(vb[3]) || 0);
        }
        entry.render.multirowMath = {
          blocks: multirowBlocks.length,
          maxVbHeight: Math.round(maxVbHeight),
        };
        if (multirowBlocks.length && maxVbHeight < 2000) {
          report.errors.push(
            `${meta.path}: multi-line math squashed to one line ` +
              `(max mjx viewBox height ${Math.round(maxVbHeight)} < 2000)`
          );
        }
        box.remove();

        // 2) PNG export (remote images go through fetch_image_bytes in Rust)
        const t1 = performance.now();
        const png = await exportPng(body);
        entry.png = {
          bytes: png.data.length,
          ms: Math.round(performance.now() - t1),
          pixels: await analyzePngPixels(png.data),
        };
        if (remoteRefs.length) {
          entry.png.remoteImagePresence = await verifyRemoteImagesInPng(png.data, remoteRefs);
        }
        await api.writeBytes(`${SELFTEST_OUT_DIR}/${meta.path}.png`, png.data);

        // 3) PDF export
        const t2 = performance.now();
        const pdf = await exportPdf(body);
        entry.pdf = { bytes: pdf.data.length, ms: Math.round(performance.now() - t2) };
        await api.writeBytes(`${SELFTEST_OUT_DIR}/${meta.path}.pdf`, pdf.data);

        report.entries.push(entry);
        console.log('[selftest] done', meta.path);
      }
      // 4) WebView2 export pipeline probe — one remote URL is enough to
      //    localize which stage (blob decode / drawImage / html2canvas)
      //    drops the image from the export.
      const probeUrl = report.entries
        .flatMap((e) => e.render.remoteFetch || [])
        .filter((f) => f.ok)
        .map((f) => f.url)[0];
      if (probeUrl) {
        report.probe = await probeExportPipeline(probeUrl);
      }
      // The point of this selftest is that exports contain their remote
      // images — a missing one is a failure, not just a data point.
      for (const e of report.entries) {
        for (const p of e.png.remoteImagePresence || []) {
          if (!p.present) {
            report.errors.push(
              `${e.path}: remote image not found in exported PNG (ncc=${p.ncc}): ${p.url}`
            );
          }
        }
      }
      report.ok = report.errors.length === 0;
    } catch (e) {
      report.errors.push(String(e && e.stack || e));
    }
    report.finishedAt = new Date().toISOString();
    try {
      await api.writeText(`${SELFTEST_OUT_DIR}/report.json`, JSON.stringify(report, null, 2));
      console.log('[selftest] report written', report.ok ? 'OK' : 'FAILED');
    } catch (e) {
      console.error('[selftest] failed to write report:', e);
    }
  })();
}
