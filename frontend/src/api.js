// Tauri command wrappers with a browser fallback (in-memory mock)
// so the UI can be developed in a plain browser via `npm run dev`.
//
// This is the ONLY module that talks to Tauri. Keep the mock branch in sync
// with the Rust behaviour (path validation, conflict detection, search scope)
// or browser debugging gives false confidence.

import { guessImageMime } from './imgutil.js';
import { noteKindOf, noteStemOf } from './notelist.js';

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const isWindows = /windows/i.test(
  (typeof navigator !== 'undefined' && navigator.userAgent) || ''
);

const HTML_PREVIEW_ORIGIN = isWindows
  ? 'http://rmdhtml.localhost/'
  : 'rmdhtml://localhost/';

let mockHtmlPreviewUrl = null;

let invoke = null;
if (isTauri) {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  invoke = (cmd, args) => tauriInvoke(cmd, args);
} else {
  invoke = mockInvoke;
}

async function pickDirectory(title = 'Select notes folder') {
  if (!isTauri) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  return open({ directory: true, multiple: false, title });
}

async function openExternal(url) {
  const href = String(url || '');
  if (!/^(https?:\/\/|mailto:)/i.test(href)) {
    throw new Error('unsupported URL scheme');
  }
  if (!isTauri) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(href);
}

function toUint8(data) {
  if (data instanceof Uint8Array) return data;
  if (Array.isArray(data)) return Uint8Array.from(data);
  if (data && data.buffer instanceof ArrayBuffer) {
    return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
  }
  return Uint8Array.from(data || []);
}

function normalizeImage(image) {
  const bytes = toUint8(image && image.bytes);
  const provided = (image && image.mime) || '';
  const guessed = guessImageMime(bytes);
  // A wrong/absent remote Content-Type must not produce
  // `data:application/octet-stream` for an SVG/PNG (Chromium will not decode
  // it). Prefer a real image/* header, otherwise the magic-byte guess.
  const mime = provided.startsWith('image/')
    ? provided
    : guessed !== 'application/octet-stream'
      ? guessed
      : provided || guessed;
  return { bytes, mime };
}

export const api = {
  isTauri,
  /// Every desktop backend has a vector PDF path now: WebView2 on Windows,
  /// WKWebView on macOS, WebKitGTK on Linux. Unsupported targets (or a failed
  /// print) fall back to the html2canvas + jsPDF image exporter.
  canPrintPdf: isTauri,
  pickDirectory,
  openExternal,
  listNotes: (dir) => invoke('list_notes', { dir }),
  listFolders: (dir) => invoke('list_folders', { dir }),
  readNote: (dir, path) => invoke('read_note', { dir, path }),
  saveNote: (dir, path, tags, body, baseHash, baseMtime, force = false) =>
    invoke('save_note', {
      dir,
      path,
      args: { tags, body, baseHash, baseMtime, force },
    }),
  createNote: (dir, folder, kind = 'markdown') =>
    invoke('create_note', { dir, folder, kind }),
  renameNote: (dir, path, name) => invoke('rename_note', { dir, path, name }),
  deleteNote: (dir, path) => invoke('delete_note', { dir, path }),
  moveNote: (dir, path, destFolder) =>
    invoke('move_note', { dir, path, destFolder }),
  searchNotes: (dir, query) => invoke('search_notes', { dir, query }),
  /// Open the native save dialog in Rust and write the bytes to the path the
  /// user picked. The frontend never supplies a destination path, so a
  /// compromised webview cannot use export as an arbitrary-file-write API.
  /// Resolves to the chosen path, or null when the user cancels.
  saveExport: (defaultName, filterName, extensions, data) =>
    invoke('save_export', {
      defaultName,
      filterName,
      extensions,
      data,
    }),
  /// Remote image fetch. Rust returns `{ bytes, mime }`; normalize the byte
  /// array because Tauri deserializes `Vec<u8>` into a plain array-like
  /// object, not a `Uint8Array` (`new Blob([bytes])` would stringify it).
  fetchImageBytes: async (url) =>
    normalizeImage(await invoke('fetch_image_bytes', { url })),
  /// Print the CURRENT document (the hidden print stage export.js prepared)
  /// to a vector PDF through the platform print engine. Unsupported targets
  /// reject so the caller can fall back to the image exporter.
  printNotePdf: async (title) =>
    toUint8(await invoke('print_note_pdf', { title })),
  /// Print an HTML note to a vector PDF in the hidden renderer window
  /// (same platform engines and fallback contract as `printNotePdf`).
  printHtmlNote: async (dir, path, html, title) =>
    toUint8(await invoke('print_html_note', { dir, path, html, title })),
  /// Tell the backend which notes root is open, so the `rmd` image protocol
  /// and `read_local_image` know which vault to serve.
  setNotesRoot: (dir) => invoke('set_notes_root', { dir }),
  /// Read an image file from the OPEN NOTES VAULT (root-scoped, same guard
  /// as the `rmd` protocol). `path` is an absolute path.
  readLocalImage: async (path) =>
    normalizeImage(await invoke('read_local_image', { path })),
  async setFullscreen(enabled) {
    if (!isTauri) {
      if (enabled) {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      return;
    }
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFullscreen(Boolean(enabled));
  },
  async isFullscreen() {
    if (!isTauri) return Boolean(document.fullscreenElement);
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow().isFullscreen();
  },

  /// Browser-dev fallback for the HTML-note iframe renderer. Tauri builds
  /// use the built-in WebView renderer (`renderHtmlNote`) instead.
  setHtmlPreview: async (html) => {
    if (isTauri) {
      const token = await invoke('set_html_preview', { html });
      return `${HTML_PREVIEW_ORIGIN}${encodeURIComponent(token)}`;
    }
    if (mockHtmlPreviewUrl) URL.revokeObjectURL(mockHtmlPreviewUrl);
    mockHtmlPreviewUrl = URL.createObjectURL(
      new Blob([html], { type: 'text/html' })
    );
    return mockHtmlPreviewUrl;
  },
  /// Render an HTML note to a full-page PNG in the app's built-in WebView
  /// (hidden Tauri window; no external browser). `mode` is "preview" or
  /// "export". Returns PNG bytes + layout dimensions.
  renderHtmlNote: async (dir, path, html, mode = 'export') => {
    const result = await invoke('render_html_note', { dir, path, html, mode });
    return {
      png: toUint8(result.png),
      width: result.width,
      height: result.height,
      cssWidth: result.cssWidth,
      cssHeight: result.cssHeight,
    };
  },
  // Dev-only self-test plumbing (Rust rejects these in release builds).
  selftestConfig: () => invoke('selftest_config'),
  selftestWrite: (name, data) => invoke('selftest_write', { name, data }),
  selftestFinish: (ok) => invoke('selftest_finish', { ok }),
};

// ---------------- Browser mock ----------------

const WELCOME = `# 欢迎使用 rustmd

这是一个**本地 Markdown 笔记**应用（当前运行在浏览器模拟模式）。

## 功能速览

- 左侧：文件夹树 / 标签 / 笔记列表，支持排序与全文搜索
- 右侧：CodeMirror 编辑器 + 实时预览
- 顶栏：重命名（标题框）、标签、移动、删除、导出、主题切换

## Markdown 示例

> 这是一段引用。

| 语法 | 说明 |
| ---- | ---- |
| **粗体** | \`**text**\` |
| *斜体* | \`*text*\` |
| [链接](https://tauri.app) | \`[text](url)\` |

\`\`\`rust
fn main() {
    println!("Hello, rustmd!");
}
\`\`\`

- [x] 任务列表
- [ ] 待办事项
`;

/** @type {Map<string, {tags: string[], body: string, mtime: number}>} */
const mockNotes = new Map([
  [
    'welcome.md',
    { tags: ['入门'], body: WELCOME, mtime: Date.now() / 1000 },
  ],
  [
    'work/项目计划.md',
    {
      tags: ['工作', '计划'],
      body: '# 项目计划\n\n## 本周目标\n\n- 完成 v0.2 迭代\n- 修复搜索性能问题\n\n> 注意：周五前提交。',
      mtime: Date.now() / 1000 - 3600,
    },
  ],
  [
    'work/会议纪要.md',
    {
      tags: ['工作'],
      body: '# 周会纪要\n\n1. 同步进度\n2. 讨论技术方案\n3. 确定排期\n',
      mtime: Date.now() / 1000 - 7200,
    },
  ],
  [
    'work/数学与图表.md',
    {
      tags: ['演示', '公式'],
      body: [
        '# 数学与图表',
        '',
        'Markdown 公式与 Mermaid 图表的渲染示例。',
        '',
        '## 公式',
        '',
        '$$',
        'E = mc^2',
        '$$',
        '',
        '$$',
        '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
        '$$',
        '',
        '## Mermaid',
        '',
        '```mermaid',
        'graph LR',
        '  A[输入] --> B{判断}',
        '  B -->|是| C[渲染]',
        '  B -->|否| D[原样保留]',
        '```',
        '',
      ].join('\n'),
      mtime: Date.now() / 1000 - 1800,
    },
  ],
  [
    'work/reading/阅读清单.md',
    {
      tags: ['阅读'],
      body: '# 阅读清单\n\n- 《Designing Data-Intensive Applications》\n- 《The Pragmatic Programmer》\n',
      mtime: Date.now() / 1000 - 43200,
    },
  ],
  [
    'ideas.md',
    {
      tags: ['灵感'],
      body: '# 灵感收集\n\n- 做一个终端版 todo\n- 试试 WebGPU\n',
      mtime: Date.now() / 1000 - 86400,
    },
  ],
  [
    'guides/html-page.html',
    {
      tags: [],
      body: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>HTML 页面示例</title>
</head>
<body>
  <h1>HTML 页面示例</h1>
  <p>这是一个 <strong>HTML</strong> 笔记：编辑器里是源码，右侧是消毒后的实时预览。</p>
  <ul>
    <li>支持标题、列表、表格、图片和链接</li>
    <li>脚本、事件属性和 iframe 会被移除</li>
  </ul>
  <blockquote>HTML 笔记不支持 Markdown 的 front matter 标签。</blockquote>
</body>
</html>
`,
      mtime: Date.now() / 1000 - 600,
    },
  ],
]);

function mockHash(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function mockTitle(body, fallback) {
  let inFence = false;
  for (const line of String(body).split('\n')) {
    const t = line.trimStart();
    if (t.startsWith('```') || t.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.*)/);
    if (m) return m[2].replace(/\s#+\s*$/, '').trim();
  }
  return fallback;
}

function mockSnippet(body) {
  return String(body)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/^#+\s.*$/gm, '')
    .replace(/[#>*_`[\]!|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function mockHtmlDoc(source) {
  if (typeof DOMParser === 'undefined') return null;
  try {
    return new DOMParser().parseFromString(String(source), 'text/html');
  } catch {
    return null;
  }
}

function mockHtmlTitle(source, fallback) {
  const doc = mockHtmlDoc(source);
  const text = (selector) => {
    const el = doc && doc.querySelector(selector);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  };
  return text('title') || text('h1') || fallback;
}

function mockHtmlText(source) {
  const doc = mockHtmlDoc(source);
  if (!doc || !doc.body) {
    return String(source)
      .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  for (const el of doc.querySelectorAll('script, style, head, noscript, template')) {
    el.remove();
  }
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function mockMeta(path) {
  const n = mockNotes.get(path);
  if (!n) return null;
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const name = noteStemOf(path);
  const kind = noteKindOf(path);
  const html = kind === 'html';
  return {
    path,
    folder,
    title: html ? mockHtmlTitle(n.body, name) : mockTitle(n.body, name),
    tags: html ? [] : [...n.tags],
    snippet: html ? mockHtmlText(n.body).slice(0, 100) : mockSnippet(n.body),
    mtime: n.mtime,
    kind,
    hash: mockHash(n.body),
  };
}

function mockFolders() {
  const folders = new Set();
  for (const path of mockNotes.keys()) {
    const parts = path.split('/');
    parts.pop();
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      folders.add(acc);
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function mockSearch(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const [path, n] of mockNotes) {
    const meta = mockMeta(path);
    const body =
      meta.kind === 'html'
        ? mockHtmlText(n.body)
        : stripMockFrontMatter(n.body);
    const bodyLower = body.toLowerCase();
    const titleLower = meta.title.toLowerCase();
    const fileStem = noteStemOf(path);
    const nameLower = fileStem.toLowerCase();
    const tagsLower = meta.tags.join(' ').toLowerCase();
    let snippet = null;
    const idx = bodyLower.indexOf(q);
    if (idx !== -1) {
      const window = body
        .slice(Math.max(0, idx - 40), idx + q.length + 60)
        .replace(/\n/g, ' ');
      snippet = (idx > 0 ? '…' : '') + window.trim();
    } else if (titleLower.includes(q)) {
      snippet = `标题：${meta.title}`;
    } else if (nameLower.includes(q)) {
      snippet = `文件名：${fileStem}`;
    } else if (tagsLower.includes(q)) {
      snippet = `标签：${meta.tags.join(', ')}`;
    }
    if (snippet) hits.push({ meta, snippet });
    if (hits.length >= 500) break;
  }
  return hits;
}

function sanitizeMockName(name) {
  const trimmed = String(name)
    .replace(/[<>:"|?*\\/]/g, '')
    .trim()
    .replace(/\.+$/, '');
  return trimmed || 'untitled';
}

function mockRelativePath(value, label = 'path') {
  const raw = String(value || '');
  if (!raw.trim()) throw new Error(`empty ${label}`);
  const normalized = raw.split(String.fromCharCode(92)).join('/');
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    (normalized.length > 2 &&
      /[A-Za-z]/.test(normalized[0]) &&
      normalized[1] === ':' &&
      normalized[2] === '/')
  ) {
    throw new Error(`absolute ${label} not allowed`);
  }
  if (normalized.split('/').includes('..')) {
    throw new Error(`${label} escapes notes root`);
  }
  return normalized;
}

function stripMockFrontMatter(body) {
  const text = String(body || '');
  const nl = String.fromCharCode(10);
  const lines = text.split(nl);
  if (!lines.length || lines[0].trimEnd() !== '---') return text;
  const end = lines.findIndex(
    (line, index) =>
      index > 0 && (line.trimEnd() === '---' || line.trimEnd() === '...')
  );
  if (end < 0) return text;
  return lines.slice(end + 1).join(nl);
}

function mockUniqueName(path, currentPath) {
  if (path === currentPath) return path;
  if (!mockNotes.has(path)) return path;
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const name = path.slice(dir.length);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '.md';
  let i = 1;
  while (mockNotes.has(`${dir}${stem} (${i})${ext}`)) i += 1;
  return `${dir}${stem} (${i})${ext}`;
}

function mockInvoke(command, args) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        switch (command) {
          case 'list_notes': {
            const all = [...mockNotes.keys()]
              .map(mockMeta)
              .filter(Boolean)
              .sort((a, b) => b.mtime - a.mtime);
            return resolve(all);
          }
          case 'list_folders':
            return resolve(mockFolders());
          case 'read_note': {
            const n = mockNotes.get(args.path);
            if (!n) throw new Error('note not found');
            const kind = noteKindOf(args.path);
            return resolve({
              tags: kind === 'html' ? [] : [...n.tags],
              body: n.body,
              mtime: n.mtime,
              hash: mockHash(n.body),
              kind,
            });
          }
          case 'save_note': {
            // Mirror resolve_in_root's rejection (main.rs): empty / absolute /
            // parent-dir paths are refused, so browser dev sees the same
            // validation errors as the Tauri backend.
            const savePath = mockRelativePath(args.path);
            const existing = mockNotes.get(savePath);
            if (
              !args.args.force &&
              args.args.baseHash !== undefined &&
              args.args.baseHash !== null
            ) {
              const actual = existing ? mockHash(existing.body) : '';
              if (actual !== args.args.baseHash) {
                throw new Error('conflict: note changed on disk');
              }
            }
            mockNotes.set(savePath, {
              tags:
                noteKindOf(savePath) === 'html' ? [] : [...args.args.tags],
              body: args.args.body,
              mtime: Date.now() / 1000,
            });
            return resolve(mockMeta(savePath));
          }
          case 'create_note': {
            const folderPath = args.folder
              ? mockRelativePath(args.folder, 'folder')
              : '';
            const folder = folderPath ? `${folderPath}/` : '';
            const ext = args.kind === 'html' || args.kind === 'htm' ? 'html' : 'md';
            let candidate = `${folder}untitled.${ext}`;
            let i = 1;
            while (mockNotes.has(candidate)) {
              candidate = `${folder}untitled ${i}.${ext}`;
              i += 1;
            }
            mockNotes.set(candidate, {
              tags: [],
              body: '',
              mtime: Date.now() / 1000,
            });
            return resolve(candidate);
          }
          case 'rename_note': {
            const n = mockNotes.get(args.path);
            if (!n) throw new Error('note not found');
            const dir = args.path.includes('/')
              ? args.path.slice(0, args.path.lastIndexOf('/') + 1)
              : '';
            // Preserve the current format (mirrors Rust rename_note).
            const ext = (args.path.match(/\.(md|html|htm)$/i) || ['.md'])[0].toLowerCase();
            const clean = sanitizeMockName(args.name).replace(
              /\.(?:md|html|htm)$/i,
              ''
            );
            const name = `${clean || 'untitled'}.${ext}`;
            const target = mockUniqueName(dir + name, args.path);
            if (target !== args.path) {
              mockNotes.delete(args.path);
              mockNotes.set(target, n);
            }
            return resolve(target);
          }
          case 'delete_note': {
            if (!mockNotes.delete(args.path)) throw new Error('note not found');
            return resolve(null);
          }
          case 'move_note': {
            const n = mockNotes.get(args.path);
            if (!n) throw new Error('note not found');
            const name = args.path.split('/').pop();
            const destFolder = args.destFolder
              ? mockRelativePath(args.destFolder, 'folder')
              : '';
            const dest = destFolder ? `${destFolder}/` : '';
            const target = mockUniqueName(dest + name, args.path);
            if (target !== args.path) {
              mockNotes.delete(args.path);
              mockNotes.set(target, n);
            }
            return resolve(target);
          }
          case 'search_notes':
            return resolve(mockSearch(args.query));
          case 'save_export':
            // Browser mock: no native dialog, caller falls back to download.
            return resolve(null);
          case 'print_note_pdf':
          case 'print_html_note':
            throw new Error('浏览器模拟模式不支持矢量 PDF 导出');
          case 'fetch_image_bytes': {
            // Best-effort real fetch in browser dev (works for hosts that
            // send CORS headers); the Tauri backend has no such restriction.
            fetch(args.url)
              .then((response) => {
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`);
                }
                const mime =
                  (response.headers.get('content-type') || '')
                    .split(';')[0]
                    .trim() || 'application/octet-stream';
                return response.arrayBuffer().then((buffer) => ({
                  bytes: new Uint8Array(buffer),
                  mime,
                }));
              })
              .then(resolve)
              .catch((e) => reject(e.message || String(e)));
            return;
          }
          case 'set_notes_root':
            return resolve(null);
          case 'read_local_image':
            throw new Error('read_local_image 在浏览器模拟模式下不可用');
          case 'selftest_config':
          case 'selftest_write':
          case 'selftest_finish':
            throw new Error('自测只在 Tauri dev 构建中运行');
          default:
            throw new Error(`unknown command ${command}`);
        }
      } catch (e) {
        return reject(e.message || String(e));
      }
    }, 30);
  });
}
