import './style.css';
import { api } from './api.js';
import { createEditor } from './editor.js';
import { renderPreview, buildExportHtml } from './preview.js';
import { exportPng, exportPdf } from './export.js';

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
  const link = $('hljs-theme');
  if (link) link.href = theme === 'dark' ? '/hljs/github-dark.css' : '/hljs/github.css';
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
  if (!state.current) return;
  state.pendingSave = true;
  statusSave.textContent = '未保存…';
  statusSave.className = 'saving';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveCurrent, 500);
  renderPreview(editor.state.doc.toString(), previewEl);
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
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content.body } });
    editor.scrollDOM.scrollTop = 0;
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
      data: buildExportHtml(title, body, state.theme),
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
