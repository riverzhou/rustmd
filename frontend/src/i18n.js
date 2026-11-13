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

    'vault.switchTitle': 'Switch notes folder',
    'vault.recent': 'Recent folders',
    'vault.noRecent': 'No recent folders yet. Browse to pick one.',
    'vault.current': 'Current',
    'vault.remove': 'Remove from recent folders',
    'vault.pin': 'Pin to top (never evicted)',
    'vault.unpin': 'Unpin',
    'vault.pinnedBadge': 'Pinned',
    'vault.pinnedGroup': 'Pinned',
    'vault.recentGroup': 'Recent',
    'vault.browse': 'Browse other folder…',
    'vault.switchFailed': 'Could not switch folder: {msg}',
    'vault.unavailable': 'Could not open: {names}',
    'vault.multiEmpty':
      'No pinned vaults yet. Pin vaults in the switch popover to show them together.',
    'vault.multiHint': 'Multi-vault: {n} open (pinned + current)',
    'vault.collapse': 'Collapse vault',
    'vault.expand': 'Expand vault',
    'vault.collapseAria': 'Collapse vault {name}',
    'vault.expandAria': 'Expand vault {name}',
    'vault.selectAria': 'Select vault {name}',

    'sidebar.newNote': 'New note',
    'sidebar.refresh': 'Refresh notes from disk',
    'sidebar.resizeWidth': 'Drag to resize the sidebar; double-click or Enter to reset',
    'sidebar.changeDir': 'Switch notes vault',
    'sidebar.searchPlaceholder': 'Search title, filename, tag or content…',
    'sidebar.folders': 'Folders',
    'sidebar.tags': 'Tags',
    'sidebar.all': 'All notes',
    'sidebar.noTags': 'No tags yet',
    'sidebar.includeSubfolders': 'Include subfolders',
    'sidebar.includeSubfoldersTitle':
      'List and search notes in subfolders (off: current folder only)',
    'sidebar.multiVault': 'Multi-vault',
    'sidebar.multiVaultTitle':
      'Multi-vault: show every pinned vault together with the current one',
    'sidebar.multiVaultOnTitle':
      'Multi-vault is on (click to show only the current vault)',
    'sidebar.resizeNav':
      'Drag to resize folders/tags vs. the note list; double-click or press Enter to reset',

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
    'topbar.resetLayout': 'Reset layout widths',
    'topbar.showSidebar': 'Show note list (Ctrl+B)',
    'topbar.move': 'Move to folder',
    'topbar.rename': 'Rename',
    'topbar.delete': 'Delete',
    'topbar.export': 'Export… (HTML / PNG / PDF)',
    'topbar.theme': 'Toggle theme',
    'topbar.wrapOn': 'Auto wrap: on (click to disable)',
    'topbar.wrapOff': 'Auto wrap: off (click to enable)',
    'topbar.fullscreenOn': 'Full screen (F11)',
    'topbar.fullscreenOff': 'Exit full screen (F11)',
    'workspace.resizeSplit': 'Drag to resize editor/preview; double-click or Enter to reset',

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
    'status.encodingTitle':
      'Text encoding detected on disk; saving keeps this encoding',

    'empty.normal':
      'Choose a note on the left, or create one to start writing',
    'empty.collapsed': 'Click the top-left button to show notes, or press Ctrl+B',

    'notes.count': (v) => `${v.n} ${v.n === 1 ? 'note' : 'notes'}`,
    'notes.empty': 'No notes yet<br>Click + at the top left to create one',
    'notes.emptyScope':
      'No notes in this folder<br>Turn on “Include subfolders” to show notes in subfolders',
    'notes.noMatches': 'No matching notes',

    'folder.collapse': 'Collapse folder',
    'folder.expand': 'Expand folder',
    'folder.collapseAria': 'Collapse {path}',
    'folder.expandAria': 'Expand {path}',

    'time.unknown': 'Modified time unknown',
    'note.untitled': 'Untitled',
    'note.kindMarkdown': 'Markdown note',
    'note.kindHtml': 'HTML note',
    'note.kindMarkdownTitle': 'Markdown note · rendered preview',
    'note.kindHtmlTitle':
      'HTML note · isolated live preview (scripts and styles run in a sandbox)',
    'note.kindCsv': 'CSV table',
    'note.kindTxt': 'Plain-text note',
    'note.kindJson': 'JSON document',
    'note.kindCsvTitle': 'CSV note · aligned table preview',
    'note.kindTxtTitle':
      'Text note · tab-aligned text with row bands and column ink tints',
    'note.kindJsonTitle':
      'JSON note · collapsible inspector with keys, types and counts',
    'note.counts': (v) =>
      `${v.words} ${v.words === 1 ? 'word' : 'words'} · ` +
      `${v.chars} ${v.chars === 1 ? 'character' : 'characters'}`,
    'new.markdown': 'Markdown note',
    'new.html': 'HTML page',
    'new.csv': 'CSV table',
    'new.txt': 'Text file',
    'new.json': 'JSON file',

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
    'toast.layoutReset': 'Default layout widths restored',
    'toast.downloadStarted': 'Download started',
    'toast.exportedTo': 'Exported to {path}',

    'toast.error': 'Error: {msg}',
    'toast.jsError': 'JS error: {msg}',
    'preview.mermaidFailed': 'Mermaid render failed: ',
    'preview.htmlTitle': 'HTML preview',
    'preview.htmlBlocked':
      'HTML preview is disabled: app IPC could not be isolated.',
    'preview.htmlFailed': 'HTML preview failed: {msg}',
    'preview.htmlTimeout':
      'The HTML preview is taking too long; it may still finish loading.',
    'preview.htmlRendering': 'Rendering HTML…',
    'preview.htmlNoRenderer':
      'HTML rendering failed ({msg}). Showing a sanitized static preview without scripts or charts.',
    'export.footer': 'Exported by rustmd · {date}',

    'data.csvSummary': (v) =>
      `${v.rows} ${v.rows === 1 ? 'row' : 'rows'} · ` +
      `${v.cols} ${v.cols === 1 ? 'column' : 'columns'} · ${v.delimiter}`,
    'data.delimiterComma': 'comma-separated',
    'data.delimiterTab': 'tab-separated',
    'data.delimiterSemicolon': 'semicolon-separated',
    'data.delimiterPipe': 'pipe-separated',
    'data.txtSummary': (v) => `${v.lines} ${v.lines === 1 ? 'line' : 'lines'}`,
    'data.txtColumns': (v) =>
      `${v.cols} tab ${v.cols === 1 ? 'column' : 'columns'}`,
    'data.tableLabel': 'Data table',
    'data.tableScroll': 'Horizontal table scroll',
    'data.empty': 'Empty file',
    'data.emptyHint':
      'This file has no content yet. Type in the editor to preview it.',
    'data.truncatedRows': (v) =>
      `Showing the first ${v.shown} of ${v.total} rows.`,
    'data.truncatedColumns': (v) =>
      `Showing the first ${v.shown} of ${v.total} columns.`,
    'data.truncatedLines': (v) =>
      `Showing the first ${v.shown} of ${v.total} lines.`,
    'data.csvUnclosedQuote':
      'A quoted field is never closed; showing the parsed text.',
    'data.jsonInvalid': 'Invalid JSON: {msg}',
    'data.invalidShort': 'Invalid JSON',
    'data.jsonKeys': (v) => `${v.n} ${v.n === 1 ? 'key' : 'keys'}`,
    'data.jsonItems': (v) => `${v.n} ${v.n === 1 ? 'item' : 'items'}`,
    'data.jsonNodes': (v) => `${v.n} ${v.n === 1 ? 'node' : 'nodes'}`,
    'data.jsonTruncated': (v) => `Inspector truncated after ${v.n} nodes.`,
    'data.jsonEmptyObject': 'empty object',
    'data.jsonEmptyArray': 'empty array',
    'data.typeObject': 'Object',
    'data.typeArray': 'Array',
    'data.typeString': 'String',
    'data.typeNumber': 'Number',
    'data.typeBoolean': 'Boolean',
    'data.typeNull': 'Null',
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

    'vault.switchTitle': '切换笔记库',
    'vault.recent': '最近打开',
    'vault.noRecent': '还没有最近目录，先浏览选择一个。',
    'vault.current': '当前',
    'vault.remove': '从最近列表移除',
    'vault.pin': '钉死并置顶（不会被淘汰）',
    'vault.unpin': '取消置顶',
    'vault.pinnedBadge': '置顶',
    'vault.pinnedGroup': '置顶',
    'vault.recentGroup': '最近',
    'vault.browse': '浏览其他目录…',
    'vault.switchFailed': '无法切换笔记库：{msg}',
    'vault.unavailable': '无法打开笔记库：{names}',
    'vault.multiEmpty': '还没有置顶的库。在切换库窗口中钉死库后即可同时显示。',
    'vault.multiHint': '多库同开：当前显示 {n} 个库（置顶 + 当前）',
    'vault.collapse': '折叠笔记库',
    'vault.expand': '展开笔记库',
    'vault.collapseAria': '折叠笔记库 {name}',
    'vault.expandAria': '展开笔记库 {name}',
    'vault.selectAria': '选择笔记库 {name}',

    'sidebar.newNote': '新建笔记',
    'sidebar.refresh': '从磁盘刷新笔记列表',
    'sidebar.resizeWidth': '拖动调整左侧栏宽度；双击或 Enter 恢复默认',
    'sidebar.changeDir': '切换笔记库',
    'sidebar.searchPlaceholder': '搜索标题、文件名、标签或内容…',
    'sidebar.folders': '文件夹',
    'sidebar.tags': '标签',
    'sidebar.all': '全部',
    'sidebar.noTags': '暂无标签',
    'sidebar.includeSubfolders': '包含子文件夹',
    'sidebar.includeSubfoldersTitle':
      '列表与搜索包含子文件夹（关闭时仅当前文件夹）',
    'sidebar.multiVault': '多库',
    'sidebar.multiVaultTitle': '同时显示多个置顶笔记库（与当前库汇总）',
    'sidebar.multiVaultOnTitle': '多库同开已开启（点击仅显示当前库）',
    'sidebar.resizeNav': '拖动调整文件夹/标签与笔记列表的高度；双击或 Enter 恢复默认',

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
    'topbar.resetLayout': '恢复默认布局宽度',
    'topbar.showSidebar': '显示笔记列表 (Ctrl+B)',
    'topbar.move': '移动到文件夹',
    'topbar.rename': '重命名',
    'topbar.delete': '删除',
    'topbar.export': '导出…（HTML / PNG / PDF）',
    'topbar.theme': '切换主题',
    'topbar.wrapOn': '自动折行：开（点击关闭）',
    'topbar.wrapOff': '自动折行：关（点击开启）',
    'topbar.fullscreenOn': '全屏 (F11)',
    'topbar.fullscreenOff': '退出全屏 (F11)',
    'workspace.resizeSplit': '拖动调整编辑/预览宽度；双击或 Enter 恢复默认',

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
    'status.encodingTitle': '从磁盘自动识别的文本编码，保存时沿用该编码',

    'empty.normal': '从左侧选择一篇笔记，或新建一篇开始写作',
    'empty.collapsed': '点击左上角按钮显示笔记列表，或按 Ctrl+B',

    'notes.count': (v) => `${v.n} 篇`,
    'notes.empty': '暂无笔记<br>点击左上角 ＋ 新建',
    'notes.emptyScope':
      '当前文件夹没有笔记<br>打开“包含子文件夹”可显示子文件夹中的笔记',
    'notes.noMatches': '没有匹配的笔记',

    'folder.collapse': '折叠文件夹',
    'folder.expand': '展开文件夹',
    'folder.collapseAria': '折叠 {path}',
    'folder.expandAria': '展开 {path}',

    'time.unknown': '修改时间未知',
    'note.untitled': '无标题',
    'note.kindMarkdown': 'Markdown 笔记',
    'note.kindHtml': 'HTML 笔记',
    'note.kindMarkdownTitle': 'Markdown 笔记 · 渲染预览',
    'note.kindHtmlTitle':
      'HTML 笔记 · 隔离的实时预览（脚本和样式在 sandbox 中运行）',
    'note.kindCsv': 'CSV 表格',
    'note.kindTxt': '纯文本笔记',
    'note.kindJson': 'JSON 文档',
    'note.kindCsvTitle': 'CSV 笔记 · 对齐表格预览',
    'note.kindTxtTitle': '文本笔记 · 制表符对齐、隔行底色 + 列文字色',
    'note.kindJsonTitle': 'JSON 笔记 · 可折叠检查器（键、类型、计数）',
    'note.counts': (v) => `${v.words} 字 · ${v.chars} 字符`,
    'new.markdown': 'Markdown 笔记',
    'new.html': 'HTML 页面',
    'new.csv': 'CSV 表格',
    'new.txt': '纯文本文件',
    'new.json': 'JSON 文件',

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
    'toast.layoutReset': '已恢复默认布局宽度',
    'toast.downloadStarted': '已开始下载',
    'toast.exportedTo': '已导出到 {path}',

    'toast.error': '错误：{msg}',
    'toast.jsError': 'JS 错误：{msg}',
    'preview.mermaidFailed': 'Mermaid 渲染失败：',
    'preview.htmlTitle': 'HTML 预览',
    'preview.htmlBlocked':
      'HTML 预览已禁用：无法隔离应用 IPC。',
    'preview.htmlFailed': 'HTML 预览失败：{msg}',
    'preview.htmlTimeout': 'HTML 预览加载时间过长，内容可能稍后才会显示。',
    'preview.htmlRendering': '正在渲染 HTML…',
    'preview.htmlNoRenderer':
      'HTML 渲染失败（{msg}）。当前显示消毒后的静态预览（脚本与图表不可用）。',
    'export.footer': '由 rustmd 导出 · {date}',

    'data.csvSummary': (v) => `${v.rows} 行 · ${v.cols} 列 · ${v.delimiter}`,
    'data.delimiterComma': '逗号分隔',
    'data.delimiterTab': '制表符分隔',
    'data.delimiterSemicolon': '分号分隔',
    'data.delimiterPipe': '竖线分隔',
    'data.txtSummary': (v) => `${v.lines} 行`,
    'data.txtColumns': (v) => `${v.cols} 个制表符列`,
    'data.tableLabel': '数据表格',
    'data.tableScroll': '表格横向滚动',
    'data.empty': '空文件',
    'data.emptyHint': '文件还没有内容，在编辑器中输入后即可预览。',
    'data.truncatedRows': (v) => `仅显示前 ${v.shown} 行，共 ${v.total} 行。`,
    'data.truncatedColumns': (v) =>
      `仅显示前 ${v.shown} 列，共 ${v.total} 列。`,
    'data.truncatedLines': (v) => `仅显示前 ${v.shown} 行，共 ${v.total} 行。`,
    'data.csvUnclosedQuote': '存在未闭合的引号字段，当前按已解析内容显示。',
    'data.jsonInvalid': 'JSON 无效：{msg}',
    'data.invalidShort': 'JSON 无效',
    'data.jsonKeys': (v) => `${v.n} 个键`,
    'data.jsonItems': (v) => `${v.n} 项`,
    'data.jsonNodes': (v) => `${v.n} 个节点`,
    'data.jsonTruncated': (v) => `检查器已在 ${v.n} 个节点后截断。`,
    'data.jsonEmptyObject': '空对象',
    'data.jsonEmptyArray': '空数组',
    'data.typeObject': '对象',
    'data.typeArray': '数组',
    'data.typeString': '字符串',
    'data.typeNumber': '数字',
    'data.typeBoolean': '布尔',
    'data.typeNull': 'Null',
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
