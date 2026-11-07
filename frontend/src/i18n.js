// UI language support: system default, persisted override, and static DOM
// translation. Only two languages are bundled today (English / Simplified
// Chinese); adding another language means extending MESSAGES and LANGUAGES.

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
];
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'rustmd-lang';

export const MESSAGES = {
  en: {
    'onboarding.tagline': 'Local Markdown notes · plain files',
    'onboarding.dirPlaceholder': 'Notes folder, e.g. D:\\Notes',
    'onboarding.browse': 'Browse…',
    'onboarding.open': 'Open notes folder',
    'onboarding.openError': 'Could not open folder: {msg}',
    'onboarding.chooseError': 'Choose or enter a notes folder',
    'onboarding.browseFailed': 'Could not choose folder: {msg}',
    'onboarding.dirDialogTitle': 'Select notes folder',

    'sidebar.newNote': 'New note',
    'sidebar.refresh': 'Refresh notes from disk',
    'sidebar.changeDir': 'Change notes folder',
    'sidebar.searchPlaceholder': 'Search title, filename, tag or content…',
    'sidebar.folders': 'Folders',
    'sidebar.tags': 'Tags',
    'sidebar.all': 'All notes',
    'sidebar.noTags': 'No tags yet',

    'sort.time': 'Time',
    'sort.name': 'Name',
    'sort.timeTitle': 'Sort by last modified',
    'sort.nameTitle': 'Sort by file name',
    'sort.switchAria': 'Sort notes',
    'sort.timeField': 'modified time',
    'sort.nameField': 'file name',
    'sort.asc': 'ascending',
    'sort.desc': 'descending',
    'sort.dirTitle': '{field}, {direction} (click to toggle)',
    'sort.dirAria':
      'Current sort: {field}, {direction}. Click to toggle ascending or descending.',

    'topbar.titlePlaceholder': 'Untitled',
    'topbar.toggleSidebar': 'Show/hide note list (Ctrl+B)',
    'topbar.showSidebar': 'Show note list (Ctrl+B)',
    'topbar.move': 'Move to folder',
    'topbar.rename': 'Rename',
    'topbar.delete': 'Delete',
    'topbar.export': 'Export… (HTML / PNG / PDF)',
    'topbar.theme': 'Toggle theme',

    'view.edit': 'Edit',
    'view.split': 'Split',
    'view.preview': 'Preview',
    'view.editTitle': 'Editor only',
    'view.splitTitle': 'Split view',
    'view.previewTitle': 'Preview only',

    'status.saved': 'Saved',
    'status.unsaved': 'Unsaved…',
    'status.saveFailed': 'Save failed',
    'status.conflict': 'Conflict — not saved',

    'empty.normal':
      'Choose a note on the left, or create one to start writing',
    'empty.collapsed': 'Click the top-left button to show notes, or press Ctrl+B',

    'notes.count': (v) => `${v.n} ${v.n === 1 ? 'note' : 'notes'}`,
    'notes.empty': 'No notes yet<br>Click + at the top left to create one',
    'notes.noMatches': 'No matching notes',

    'folder.collapse': 'Collapse folder',
    'folder.expand': 'Expand folder',
    'folder.collapseAria': 'Collapse {path}',
    'folder.expandAria': 'Expand {path}',

    'time.unknown': 'Modified time unknown',
    'note.untitled': 'Untitled',
    'note.counts': (v) =>
      `${v.words} ${v.words === 1 ? 'word' : 'words'} · ` +
      `${v.chars} ${v.chars === 1 ? 'character' : 'characters'}`,

    'tag.remove': 'Remove',
    'tag.addPlaceholder': '+ tag',

    'dialog.changeDir':
      'The current note could not be saved. Switch folders anyway? Unsaved changes will be lost.',
    'dialog.switchNote':
      'The current note could not be saved. Switch notes anyway? Unsaved changes will be lost.',
    'dialog.newNote':
      'The current note could not be saved. Create a new note anyway? Unsaved changes will be lost.',
    'dialog.delete': 'Delete “{title}”? This cannot be undone.',
    'dialog.conflict':
      'This note was changed outside the app.\n\n' +
      'OK overwrites the file on disk with the editor contents. Cancel keeps ' +
      'the file on disk; your edits stay in the editor so you can copy them first.',

    'toast.selectDirFailed': 'Could not choose folder: {msg}',
    'toast.searchFailed': 'Search failed: {msg}',
    'toast.readFailed': 'Could not read notes: {msg}',
    'toast.saveFailed': 'Save failed: {msg}',
    'toast.openFailed': 'Could not open note: {msg}',
    'toast.renameFailed': 'Rename failed: {msg}',
    'toast.renamed': 'Renamed to {name}',
    'toast.newFailed': 'Could not create note: {msg}',
    'toast.deleted': 'Deleted',
    'toast.deleteFailed': 'Delete failed: {msg}',
    'toast.moveCancelled': 'Save failed — move cancelled',
    'toast.moveFailed': 'Move failed: {msg}',
    'toast.moved': 'Moved to {path}',
    'toast.vaultRefreshed': (v) =>
      `Refreshed · ${v.n} ${v.n === 1 ? 'note' : 'notes'}`,
    'toast.vaultRefreshedUnsaved': 'Refreshed · unsaved changes are still pending.',
    'toast.vaultRefreshFailed': 'Refresh failed: {msg}',
    'toast.vaultRefreshDeleted':
      'The open note “{name}” no longer exists on disk. It was closed.',
    'toast.vaultRefreshDeletedDirty':
      'The open note “{name}” was deleted on disk. Unsaved changes are kept in the editor.',
    'toast.vaultRefreshReloaded': '“{name}” changed on disk and was reloaded.',
    'toast.vaultRefreshReloadFailed': 'Could not reload “{name}”: {msg}',
    'toast.vaultRefreshConflict':
      '“{name}” changed on disk. Unsaved changes are kept; saving will ask before overwriting.',

    'move.title': 'Move to folder',
    'move.root': 'Root',
    'move.current': 'Current folder',

    'export.html': 'Export HTML file',
    'export.png': 'Export PNG (high resolution)',
    'export.pdf': 'Export PDF',
    'export.filterHtml': 'HTML file',
    'export.filterPng': 'PNG image',
    'export.filterPdf': 'PDF document',
    'toast.exportCancelled': 'Save failed — export cancelled',
    'toast.exportingPng': 'Generating PNG…',
    'toast.exportingPdf': 'Generating PDF…',
    'toast.exportFailed': 'Export failed: {msg}',
    'toast.downloadStarted': 'Download started',
    'toast.exportedTo': 'Exported to {path}',

    'toast.error': 'Error: {msg}',
    'toast.jsError': 'JS error: {msg}',
    'preview.mermaidFailed': 'Mermaid render failed: ',
    'export.footer': 'Exported by rustmd · {date}',
  },

  'zh-CN': {
    'onboarding.tagline': '本地 Markdown 笔记 · 纯文件存储',
    'onboarding.dirPlaceholder': '笔记目录，例如 D:\\Notes',
    'onboarding.browse': '浏览…',
    'onboarding.open': '打开笔记库',
    'onboarding.openError': '无法打开目录：{msg}',
    'onboarding.chooseError': '请选择或输入笔记目录',
    'onboarding.browseFailed': '选择目录失败：{msg}',
    'onboarding.dirDialogTitle': '选择笔记目录',

    'sidebar.newNote': '新建笔记',
    'sidebar.refresh': '从磁盘刷新笔记列表',
    'sidebar.changeDir': '切换笔记目录',
    'sidebar.searchPlaceholder': '搜索标题、文件名、标签或内容…',
    'sidebar.folders': '文件夹',
    'sidebar.tags': '标签',
    'sidebar.all': '全部',
    'sidebar.noTags': '暂无标签',

    'sort.time': '时间',
    'sort.name': '名称',
    'sort.timeTitle': '按修改时间排序',
    'sort.nameTitle': '按文件名排序',
    'sort.switchAria': '笔记排序',
    'sort.timeField': '修改时间',
    'sort.nameField': '文件名',
    'sort.asc': '升序',
    'sort.desc': '降序',
    'sort.dirTitle': '{field}{direction}（点击切换升序/降序）',
    'sort.dirAria': '当前{field}{direction}，点击切换升序或降序',

    'topbar.titlePlaceholder': '无标题',
    'topbar.toggleSidebar': '隐藏/显示笔记列表 (Ctrl+B)',
    'topbar.showSidebar': '显示笔记列表 (Ctrl+B)',
    'topbar.move': '移动到文件夹',
    'topbar.rename': '重命名',
    'topbar.delete': '删除',
    'topbar.export': '导出…（HTML / PNG / PDF）',
    'topbar.theme': '切换主题',

    'view.edit': '编辑',
    'view.split': '分栏',
    'view.preview': '预览',
    'view.editTitle': '仅编辑',
    'view.splitTitle': '分栏',
    'view.previewTitle': '仅预览',

    'status.saved': '已保存',
    'status.unsaved': '未保存…',
    'status.saveFailed': '保存失败',
    'status.conflict': '冲突未保存',

    'empty.normal': '从左侧选择一篇笔记，或新建一篇开始写作',
    'empty.collapsed': '点击左上角按钮显示笔记列表，或按 Ctrl+B',

    'notes.count': (v) => `${v.n} 篇`,
    'notes.empty': '暂无笔记<br>点击左上角 ＋ 新建',
    'notes.noMatches': '没有匹配的笔记',

    'folder.collapse': '折叠文件夹',
    'folder.expand': '展开文件夹',
    'folder.collapseAria': '折叠 {path}',
    'folder.expandAria': '展开 {path}',

    'time.unknown': '修改时间未知',
    'note.untitled': '无标题',
    'note.counts': (v) => `${v.words} 字 · ${v.chars} 字符`,

    'tag.remove': '移除',
    'tag.addPlaceholder': '+ 标签',

    'dialog.changeDir':
      '当前笔记保存失败，仍要切换目录吗？未保存的修改会丢失。',
    'dialog.switchNote':
      '当前笔记保存失败，仍要切换吗？未保存的修改会丢失。',
    'dialog.newNote':
      '当前笔记保存失败，仍要新建吗？未保存的修改会丢失。',
    'dialog.delete': '确定删除「{title}」吗？此操作不可恢复。',
    'dialog.conflict':
      '这篇笔记已在外部被修改。\n\n' +
      '点击“确定”用当前编辑器内容覆盖磁盘版本；点击“取消”保留磁盘版本' +
      '（当前编辑内容仍在编辑器中，可复制后手动处理）。',

    'toast.selectDirFailed': '选择目录失败：{msg}',
    'toast.searchFailed': '搜索失败：{msg}',
    'toast.readFailed': '读取笔记失败：{msg}',
    'toast.saveFailed': '保存失败：{msg}',
    'toast.openFailed': '打开笔记失败：{msg}',
    'toast.renameFailed': '重命名失败：{msg}',
    'toast.renamed': '已重命名为 {name}',
    'toast.newFailed': '新建笔记失败：{msg}',
    'toast.deleted': '已删除',
    'toast.deleteFailed': '删除失败：{msg}',
    'toast.moveCancelled': '保存失败，已取消移动',
    'toast.moveFailed': '移动失败：{msg}',
    'toast.moved': '已移动到 {path}',
    'toast.vaultRefreshed': (v) => `已刷新 · ${v.n} 篇笔记`,
    'toast.vaultRefreshedUnsaved': '已刷新，但仍有未保存的修改。',
    'toast.vaultRefreshFailed': '刷新失败：{msg}',
    'toast.vaultRefreshDeleted': '当前笔记“{name}”已不在磁盘上，已关闭。',
    'toast.vaultRefreshDeletedDirty':
      '当前笔记“{name}”已在磁盘上被删除，未保存的修改仍保留在编辑器中。',
    'toast.vaultRefreshReloaded': '“{name}”在磁盘上已修改，已重新载入。',
    'toast.vaultRefreshReloadFailed': '无法重新载入“{name}”：{msg}',
    'toast.vaultRefreshConflict':
      '“{name}”在磁盘上已修改，未保存的修改仍保留在编辑器中，保存时会先询问。',

    'move.title': '移动到文件夹',
    'move.root': '根目录',
    'move.current': '当前所在',

    'export.html': '导出 HTML 文件',
    'export.png': '导出 PNG（高清图）',
    'export.pdf': '导出 PDF',
    'export.filterHtml': 'HTML 文件',
    'export.filterPng': 'PNG 图片',
    'export.filterPdf': 'PDF 文档',
    'toast.exportCancelled': '保存失败，已取消导出',
    'toast.exportingPng': '正在生成 PNG…',
    'toast.exportingPdf': '正在生成 PDF…',
    'toast.exportFailed': '导出失败：{msg}',
    'toast.downloadStarted': '已开始下载',
    'toast.exportedTo': '已导出到 {path}',

    'toast.error': '错误：{msg}',
    'toast.jsError': 'JS 错误：{msg}',
    'preview.mermaidFailed': 'Mermaid 渲染失败：',
    'export.footer': '由 rustmd 导出 · {date}',
  },
};

let current = DEFAULT_LANGUAGE;
const listeners = new Set();

export function isSupportedLanguage(value) {
  return Object.prototype.hasOwnProperty.call(MESSAGES, value);
}

/** Pick a bundled language from the browser/system language list. */
export function languageFromNavigator(nav = globalThis.navigator) {
  const candidates =
    nav && Array.isArray(nav.languages) && nav.languages.length
      ? nav.languages
      : [nav && nav.language ? nav.language : ''];
  for (const raw of candidates) {
    const lang = String(raw || '').toLowerCase();
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('en')) return 'en';
  }
  return DEFAULT_LANGUAGE;
}

export function initI18n() {
  let stored = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage can be disabled; fall back to the system language.
  }
  current = isSupportedLanguage(stored)
    ? stored
    : languageFromNavigator(globalThis.navigator);
  applyDocumentLanguage();
  return current;
}

export function getLanguage() {
  return current;
}

export function setLanguage(lang, { persist = true, notify = true } = {}) {
  const next = isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  const changed = next !== current;
  current = next;
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Storage can be disabled; the in-memory language still works.
    }
  }
  applyDocumentLanguage();
  if (notify && changed) {
    for (const listener of listeners) listener(next);
  }
  return next;
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyDocumentLanguage() {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current;
  }
}

/** Format one message, interpolating `{name}` placeholders. */
export function formatMessage(lang, key, vars = {}) {
  const table = MESSAGES[lang] || MESSAGES[DEFAULT_LANGUAGE];
  let value = table[key];
  if (value === undefined) value = MESSAGES[DEFAULT_LANGUAGE][key];
  if (value === undefined) return key;
  if (typeof value === 'function') return String(value(vars));
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/** Translate a key with the current language. */
export function t(key, vars = {}) {
  return formatMessage(current, key, vars);
}

/** Translate static elements marked with data-i18n* attributes. */
export function applyStaticTranslations(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    el.innerHTML = t(el.dataset.i18nHtml);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }
}
