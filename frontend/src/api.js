// Tauri command wrappers with a browser fallback (in-memory mock)
// so the UI can be developed in a plain browser via `npm run dev`.
//
// This is the ONLY module that talks to Tauri. Keep the mock branch in sync
// with the Rust behaviour (path validation, conflict detection, search scope)
// or browser debugging gives false confidence.

import { guessImageMime } from './imgutil.js';

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

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
  createNote: (dir, folder) => invoke('create_note', { dir, folder }),
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
  /// Tell the backend which notes root is open, so the `rmd` image protocol
  /// and `read_local_image` know which vault to serve.
  setNotesRoot: (dir) => invoke('set_notes_root', { dir }),
  /// Read an image file from the OPEN NOTES VAULT (root-scoped, same guard
  /// as the `rmd` protocol). `path` is an absolute path.
  readLocalImage: async (path) =>
    normalizeImage(await invoke('read_local_image', { path })),
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

function mockMeta(path) {
  const n = mockNotes.get(path);
  if (!n) return null;
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const name = path.split('/').pop().replace(/\.md$/i, '');
  return {
    path,
    folder,
    title: mockTitle(n.body, name),
    tags: [...n.tags],
    snippet: mockSnippet(n.body),
    mtime: n.mtime,
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
    const bodyLower = n.body.toLowerCase();
    const titleLower = meta.title.toLowerCase();
    const fileStem = path.split('/').pop().replace(/\.md$/i, '');
    const nameLower = fileStem.toLowerCase();
    const tagsLower = meta.tags.join(' ').toLowerCase();
    let snippet = null;
    const idx = bodyLower.indexOf(q);
    if (idx !== -1) {
      const window = n.body
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

function mockUniqueName(path, currentPath) {
  if (path === currentPath) return path;
  if (!mockNotes.has(path)) return path;
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const name = path.slice(dir.length);
  const stem = name.replace(/\.md$/i, '');
  let i = 1;
  while (mockNotes.has(`${dir}${stem} (${i}).md`)) i += 1;
  return `${dir}${stem} (${i}).md`;
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
            return resolve({
              tags: [...n.tags],
              body: n.body,
              mtime: n.mtime,
              hash: mockHash(n.body),
            });
          }
          case 'save_note': {
            // Mirror resolve_in_root's rejection (main.rs): empty / absolute /
            // parent-dir paths are refused, so browser dev sees the same
            // validation errors as the Tauri backend.
            if (!args.path || args.path.trim() === '') {
              throw new Error('empty path');
            }
            if (
              args.path.startsWith('/') ||
              /^[a-zA-Z]:[\\/]/.test(args.path)
            ) {
              throw new Error('absolute path not allowed');
            }
            if (args.path.split('/').includes('..')) {
              throw new Error('path escapes notes root');
            }
            const existing = mockNotes.get(args.path);
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
            mockNotes.set(args.path, {
              tags: [...args.args.tags],
              body: args.args.body,
              mtime: Date.now() / 1000,
            });
            return resolve(mockMeta(args.path));
          }
          case 'create_note': {
            const folder = args.folder ? `${args.folder}/` : '';
            let candidate = `${folder}untitled.md`;
            let i = 1;
            while (mockNotes.has(candidate)) {
              candidate = `${folder}untitled ${i}.md`;
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
            const clean = sanitizeMockName(args.name);
            const name = clean.toLowerCase().endsWith('.md')
              ? clean
              : `${clean}.md`;
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
            const dest = args.destFolder ? `${args.destFolder}/` : '';
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
