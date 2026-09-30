// Tauri command wrappers with a browser fallback (in-memory mock)
// so the UI can be developed in a plain browser via `npm run dev`.

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let invoke = null;
if (isTauri) {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  invoke = (cmd, args) => tauriInvoke(cmd, args);
} else {
  invoke = mockInvoke;
}

async function pickDirectory() {
  if (!isTauri) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  return open({ directory: true, multiple: false, title: '选择笔记目录' });
}

async function pickSavePath(defaultName, opts = {}) {
  if (!isTauri) return null;
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({
    title: opts.title || '导出 HTML',
    defaultPath: defaultName,
    filters: [
      {
        name: opts.filterName || 'HTML 文件',
        extensions: opts.extensions || ['html', 'htm'],
      },
    ],
  });
}

export const api = {
  isTauri,
  pickDirectory,
  pickSavePath,
  listNotes: (dir) => invoke('list_notes', { dir }),
  readNote: (dir, path) => invoke('read_note', { dir, path }),
  saveNote: (dir, path, tags, body) =>
    invoke('save_note', { dir, path, args: { tags, body } }),
  createNote: (dir, folder) => invoke('create_note', { dir, folder }),
  renameNote: (dir, path, name) => invoke('rename_note', { dir, path, name }),
  deleteNote: (dir, path) => invoke('delete_note', { dir, path }),
  moveNote: (dir, path, destFolder) =>
    invoke('move_note', { dir, path, destFolder }),
  searchNotes: (dir, query) => invoke('search_notes', { dir, query }),
  writeText: (path, content) => invoke('write_text', { path, content }),
  writeBytes: (path, data) => invoke('write_bytes', { path, data }),
  fetchImageBytes: (url) => invoke('fetch_image_bytes', { url }),
};

// ---------------- Browser mock ----------------

const WELCOME = `# 欢迎使用 rustmd

这是一个**本地 Markdown 笔记**应用（当前运行在浏览器模拟模式）。

## 功能速览

- 左侧：文件夹 / 标签 / 笔记列表，支持全文搜索
- 右侧：CodeMirror 编辑器 + 实时预览
- 顶栏：重命名（标题框）、标签、移动、删除、导出 HTML、主题切换

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
    'ideas.md',
    {
      tags: ['灵感'],
      body: '# 灵感收集\n\n- 做一个终端版 todo\n- 试试 WebGPU\n',
      mtime: Date.now() / 1000 - 86400,
    },
  ],
]);

function mockTitle(body, fallback) {
  for (const line of body.split('\n')) {
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.*)/);
    if (m) return m[2].replace(/\s#+\s*$/, '').trim();
  }
  return fallback;
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
    snippet: n.body.replace(/^#+\s.*$/gm, '').replace(/[#>*_`[\]!|-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100),
    mtime: n.mtime,
  };
}

function mockInvoke(cmd, args) {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        switch (cmd) {
          case 'list_notes': {
            const all = [...mockNotes.keys()]
              .map(mockMeta)
              .filter(Boolean)
              .sort((a, b) => b.mtime - a.mtime);
            return resolve(all);
          }
          case 'read_note': {
            const n = mockNotes.get(args.path);
            if (!n) throw new Error('note not found');
            return resolve({ tags: [...n.tags], body: n.body, mtime: n.mtime });
          }
          case 'save_note': {
            mockNotes.set(args.path, {
              tags: [...args.args.tags],
              body: args.args.body,
              mtime: Date.now() / 1000,
            });
            return resolve(mockMeta(args.path));
          }
          case 'create_note': {
            const folder = args.folder ? args.folder + '/' : '';
            let candidate = `${folder}untitled.md`;
            let i = 1;
            while (mockNotes.has(candidate)) {
              candidate = `${folder}untitled ${i}.md`;
              i += 1;
            }
            mockNotes.set(candidate, { tags: [], body: '', mtime: Date.now() / 1000 });
            return resolve(candidate);
          }
          case 'rename_note': {
            const n = mockNotes.get(args.path);
            if (!n) throw new Error('note not found');
            const dir = args.path.includes('/')
              ? args.path.slice(0, args.path.lastIndexOf('/') + 1)
              : '';
            const name = args.name.toLowerCase().endsWith('.md')
              ? args.name
              : `${args.name}.md`;
            mockNotes.delete(args.path);
            mockNotes.set(dir + name, n);
            return resolve(dir + name);
          }
          case 'delete_note': {
            if (!mockNotes.delete(args.path)) throw new Error('note not found');
            return resolve(null);
          }
          case 'move_note': {
            const n = mockNotes.get(args.path);
            if (!n) throw new Error('note not found');
            const name = args.path.split('/').pop();
            const dest = args.destFolder ? args.destFolder + '/' : '';
            mockNotes.delete(args.path);
            mockNotes.set(dest + name, n);
            return resolve(dest + name);
          }
          case 'search_notes': {
            const q = args.query.toLowerCase();
            if (!q) return resolve([]);
            const hits = [];
            for (const [path, n] of mockNotes) {
              const idx = n.body.toLowerCase().indexOf(q);
              if (idx === -1) continue;
              const window = n.body.slice(Math.max(0, idx - 40), idx + 100).replace(/\n/g, ' ');
              hits.push({ meta: mockMeta(path), snippet: (idx > 0 ? '…' : '') + window.trim() });
            }
            return resolve(hits);
          }
          case 'write_text':
            console.log('[mock] write_text', args.path);
            return resolve(null);
          case 'write_bytes':
            console.log('[mock] write_bytes', args.path, args.data.length, 'bytes');
            return resolve(null);
          case 'fetch_image_bytes':
            // Best-effort real fetch in browser dev (works for hosts that
            // send CORS headers); the Tauri backend has no such restriction.
            fetch(args.url)
              .then((r) =>
                r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))
              )
              .then((buf) => resolve(new Uint8Array(buf)))
              .catch((e) => Promise.reject(e.message || String(e)));
            return;
          default:
            throw new Error(`unknown command ${cmd}`);
        }
      } catch (e) {
        return Promise.reject(e.message || String(e));
      }
    }, 30);
  });
}
