# 架构

rustmd 以主窗口为交互界面；HTML 预览使用主窗口内的 sandbox iframe，HTML 导出使用隐藏的独立 Tauri WebView 窗口。Tauri 2 负责 webview 与原生能力，Rust 后端提供文件系统与网络命令，前端是原生 JavaScript。

```
┌──────────────────────────── WebView（frontend/）────────────────────────────┐
│ main.js  UI 状态 / DOM / 保存队列 / 文件夹树 / 搜索 / 导出菜单              │
│   ├─ notelist.js   纯函数：排序、过滤、文件夹树                             │
│   ├─ markdown.js   纯函数：代码段切分、数学公式保护                         │
│   ├─ preview.js    Markdown → DOMPurify；HTML → sandbox iframe 原生渲染 / 隐藏 WebView 截图 │
│   ├─ export.js     离屏舞台 → 图片内联 → html2canvas → PNG / jsPDF          │
│   ├─ editor.js     CodeMirror 6                                             │
│   └─ api.js        唯一的 Tauri 桥（浏览器模式走内存 mock）                 │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │ invoke / rmd 协议
┌──────────────────────────────▼─────────────────────────────────────────────┐
│ src/main.rs                                                                 │
│  路径封闭 resolve_in_root / canonical_root / symlink 检查                  │
│  front matter split_document / compose_note（保留未知字段与换行）           │
│  HTML note_kind / compose_html / html_to_text / html_meta                   │
│  render_html_note / html_preview_finish（隐藏 WebView，3×/分段截图+PNG 拼接） │
│  set_html_preview（rmdhtml 协议的 sandbox iframe 预览文档）                 │
│  rmd Origin 隔离（拒绝 sandbox/rmdhtml 源的 CORS 读）                      │
│  笔记命令 list/read/save/create/rename/delete/move/search/list_folders      │
│  原子写 atomic_write + hash 冲突检测                                        │
│  导出 save_export（原生保存对话框 + 写入）                                  │
│  网络 fetch_image_bytes（SSRF 防护 + 重定向校验）                           │
│  rmd 协议 serve_rmd + VaultFileCache + read_local_image                    │
│  自测命令（仅 debug）                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 进程与数据流

1. 启动时前端从 `localStorage` 读取上次目录；有则 `list_notes` + `list_folders` + `set_notes_root`，失败则回到引导页。扫描识别 `.md` / `.html` / `.htm`。
2. 选择笔记：`read_note` 返回 `{ tags, body, mtime, hash, kind }`；编辑器按 `kind` 切换 Markdown/HTML 语法，预览走对应渲染管线；`setImageContext(root, notePath)` 记录图片解析上下文。
3. 编辑/标签变化：500 ms 防抖后进入保存队列；`save_note` 带 `baseHash`，后端比较磁盘内容 hash，不一致返回 `conflict:`，前端询问是否覆盖；写盘使用同目录临时文件 + rename。
4. 预览：Markdown 走 `protectMath` → `marked.parse` → DOMPurify → 恢复公式 span → Mermaid / MathJax。HTML 笔记写入 `rmdhtml` 内存文档，在 `sandbox="allow-scripts allow-forms"` 的 null-origin iframe 中原生渲染（内联/远程脚本、样式、本地相对 CSS/JS/字体/图片、ECharts 直接执行），父页面只收高度消息；不需要外部浏览器，也不会把笔记脚本注入主文档。
5. 导出：Markdown 走离屏 948 px 舞台；远程图片经 `fetch_image_bytes`、本地图片经 `read_local_image` 内联为 data URL；html2canvas 光栅化；PNG 直接输出，PDF 按块边界分页切片后写入 jsPDF。HTML 笔记的 HTML 导出保存当前源码；PNG/PDF 由隐藏 Tauri WebView 整页渲染——PNG 最高 3×（目标约 48k 设备像素高），CSS 高度超过 12000px 时按垂直段截取（单张模式以 30000/h 为缩放上限），Rust `png` 拼接为单图；PDF 短页面 3×、较高页面 2× 捕获后切片。
6. 保存导出文件：前端把字节交给 `save_export`；Rust 打开系统保存对话框，只有用户选中的路径会被写入。

## 前端模块

| 文件 | 职责 |
| --- | --- |
| `main.js` | 状态、DOM 接线、保存队列、冲突重试、未保存守卫、搜索序列号、文件夹树渲染（默认折叠，展开集合存 `rustmd-expanded-folders`）、排序（键 + 升/降序）、新建/导出菜单、HTML 类型徽标与标签编辑器切换、自动折行/全屏（`F11`）状态 |
| `api.js` | 唯一 Tauri 桥；浏览器 mock 必须与 Rust 的校验/冲突/搜索行为保持一致；`setFullscreen` / `isFullscreen` 走 Tauri window API，浏览器模式走 Fullscreen API |
| `i18n.js` | 中英词典、系统语言检测、`rustmd-lang` 持久化、`t()` / `data-i18n*` 静态翻译 |
| `notelist.js` | `fileNameOf`、`noteKindOf`、`noteStemOf`、`sortNotes`、`filterNotes`、`buildFolderTree`、`flattenFolderTree`；无 DOM，可单测 |
| `markdown.js` | `splitCodeSegments`、`splitInlineCode`、`protectMath`、`sourceHasMath`；无 DOM，可单测 |
| `preview.js` | marked、DOMPurify、highlight.js、Mermaid、MathJax、`rmd` 图片/资源改写、Markdown/HTML 外链拦截、HTML 导出；HTML 笔记走 sandbox iframe 原生预览，导出走隐藏 WebView 截图；本地图片在导出前 data URL 内联 |
| `export.js` | 离屏舞台、远程/本地图片内联、html2canvas、PNG、多页 PDF；长 Markdown 自适应 0.25–3× |
| `editor.js` | CodeMirror 6、Markdown/HTML 语法（Compartment 按笔记切换）、HTML 标签/属性/内嵌 JS/CSS 配色、自动折行 Compartment |
| `imgutil.js` | bytes→data URL、魔数 MIME 嗅探（SVG/ICO/AVIF 兜底） |
| `selftest.js` | dev-only E2E；`main.js` 在 `import.meta.env.DEV` 下动态 import |

## 后端命令

| 命令 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| `list_notes` | `dir` | `NoteMeta[]` | 递归扫描 `.md` / `.html` / `.htm`，跳过隐藏项和符号链接；`kind` 区分格式 |
| `list_folders` | `dir` | `string[]` | 含空文件夹；用于文件夹树与移动对话框 |
| `read_note` | `dir, path` | `NoteContent` | 返回 tags/body/mtime/hash/kind；HTML 无 tags，body 为整篇源码 |
| `save_note` | `dir, path, args` | `NoteMeta` | `args: { tags, body, baseHash?, baseMtime?, force? }` |
| `create_note` | `dir, folder, kind?` | `string` | 按 `kind` 自动选 `untitled.md` / `untitled.html`（含 ` N` 后缀） |
| `rename_note` | `dir, path, name` | `string` | 保留原扩展名；冲突自动 ` (N)` 后缀 |
| `delete_note` | `dir, path` | `()` | 直接删文件 |
| `move_note` | `dir, path, destFolder` | `string` | 同目录 no-op；冲突自动后缀 |
| `search_notes` | `dir, query` | `SearchHit[]` | 正文、标题、文件名、标签；HTML 只搜可见文本；最多 500 条 |
| `render_html_note` | `dir, path, html, mode` | `{png, width, height, cssWidth, cssHeight}` | 内置隐藏 WebView 渲染 HTML 笔记；`mode` 为 `preview` / `export` / `pdf`；`export` 最高 3×并在超高时分段，`pdf` 短页 3×、较高页 2×；仅主窗口允许 |
| `html_preview_finish` | `{ payload: { token, dataUrl?, segments?, error?, cssWidth?, cssHeight?, width?, height? } }` | `()` | 隐藏 WebView 回传 PNG/分段；必须来自 `html-render-{token}` 窗口；失败也唤醒等待方 |
| `set_html_preview` | `html` | `token` | 注册 sandbox iframe 预览文档（随机 `p-*`）；仅主窗口允许；最多保留 8 份 |
| `save_export` | `defaultName, filterName, extensions, data` | `string?` | Rust 打开保存对话框并写文件 |
| `fetch_image_bytes` | `url` | `{bytes, mime}` | 仅 http(s)；SSRF/重定向防护 |
| `set_notes_root` | `dir` | `()` | `rmd` 协议与 `read_local_image` 的根 |
| `read_local_image` | `path` | `{bytes, mime}` | 仅当前笔记库内；mtime + 字节预算缓存 |
| `selftest_config` | — | `{examplesDir, outDir}` | 仅 debug |
| `selftest_write` | `name, data` | `()` | 仅 debug；限制在自测输出根 |
| `selftest_finish` | `ok` | `()` | 仅 debug；以 0/1 退出应用 |

## 路径安全模型

- `resolve_in_root(root, rel)`：
  - 拒绝空路径、绝对路径、`..`、非普通组件；
  - 对已存在路径做 `canonicalize` 并检查前缀；
  - 对不存在的路径，canonicalize **最深的已存在祖先**并检查前缀，从而阻止“vault 内 junction/symlink 指向外部 + 新建文件”的写逃逸；
  - Windows 上剥掉 `\\?\` 前缀；`\\?\UNC\` 还原为 `\\server\share`。
- `walk`/`walk_folders` 用 `symlink_metadata` + Windows reparse point 属性跳过符号链接/junction，避免环和越界读取。
- `resolve_vault_file` 对 `rmd` 请求做同样的 canonicalize + 前缀检查；只服务当前 root。
- `serve_rmd` 的路径契约：URL 路径去掉**恰好一个**前导 `/` 后 percent-decode，再要求绝对路径；Unix `/home/...` 用 `rmd://localhost//home/...`，Windows `C:/...` 用 `http://rmd.localhost/C%3A/...`，UNC 用 `//server/share/...`。
- `rmd` 的 Origin 白名单：无 Origin 的普通 `<img>/<link>/<script>` 允许；带 Origin 的请求只允许应用自身 webview（Tauri / 本地 dev server），以及预览 iframe/隐藏窗口的 `font`/`script`/`style` 子资源（`Sec-Fetch-Dest`）。`fetch`/XHR（空 dest）、文档读取和远程 iframe 一律 403。`Access-Control-Allow-Origin` 只回显允许的 Origin，不再 `*`；`rmd` 返回的 HTML/SVG 文档加 sandbox CSP + `nosniff`。预览/导出的本地 CSS/JS 优先内联，减少对这条回退通道的依赖。
- 导出的目标路径不来自前端命令参数，而是 `save_export` 内部的原生对话框结果。
- 自测写文件使用 debug-only 命令，根固定为 `RUSTMD_SELFTEST_OUT`（默认系统临时目录）。

## Front matter 与 HTML 笔记

- 仅 Markdown 笔记（`.md`）识别文件开头的 `---` 块，闭合行 `---` 或 `...`。
- HTML 笔记（`.html` / `.htm`）没有 front matter 和标签：`read_note` 返回整篇源码（去 BOM、统一 LF），`compose_html` 保存时恢复原 BOM 与 CRLF/LF，绝不插入 `tags:`。
- HTML 笔记的预览在 `rmdhtml` 文档的 sandbox iframe 中运行（null origin，无 `allow-same-origin`，`allow-scripts allow-forms`），按原生 WebView 渲染；导出在隐藏的独立 Tauri WebView 窗口中运行，所有保险库命令按窗口 label 拒绝该窗口，只允许回传截图。相对资源通过注入的 `rmd` base 解析（MIME 覆盖 CSS/JS/字体/图片）。
- 超长 HTML 导出按垂直段（默认每段 CSS 高度约 16000/scale，不超过 canvas 高度）截取，Rust `png` crate 校验格式后拼接为单张 PNG；预览保持单个原生 iframe，速度快且文字清晰。
- HTML 标题优先取 `<title>`，其次第一个 `<h1>`，最后文件名；摘要和搜索使用 `html_to_text` 提取的可见文本。
- 读取时解析 `tags:`（行内 `a, b`、`["a,b", c]`、块列表 `- a`），忽略嵌套 key 下的 `tags:`。
- 保存时 `compose_note` 只替换/插入 `tags:` 行，保留其它字段、注释、BOM 和 CRLF/LF；文件没有 front matter 且标签为空时保持正文不变。
- 标签统一写成 JSON 风格的 flow list（`tags: ["a", "b"]`，合法 YAML），保证带引号/逗号的标签可往返。

## 渲染管线要点

- 代码围栏先切分；数学保护不进入 fenced code 或 inline code。
- 展示公式必须“行首开始、行尾结束”；行内 `$…$` 使用启发式（前后非空格/非 `$`）。随机 token 前缀避免与用户文本碰撞。
- Markdown `marked.parse` 之后立即 `DOMPurify.sanitize`，再挂载到 DOM；`<style>/<iframe>/<form>/<object>/<script>` 等被禁止。
- HTML 笔记预览在 sandbox iframe 中执行（null origin）；导出在隐藏 WebView 中执行。两者都不把脚本注入主文档，保险库命令按窗口 label 拦截。静态回退仍走 DOMPurify。
- `restoreMath` 在文本节点里把 token 换成 `<span class="rm-math">`，MathJax 逐公式回退，坏公式不会拖垮整篇。
- Mermaid `securityLevel: 'strict'`；SVG 由库生成，不来自笔记原文。
- MathJax/Mermaid 生成 DOM 后再跑 `sanitizeRenderedDom`：移除脚本/iframe、`on*`、危险链接和 mermaid 样式里的外部 URL。
- 本地图片改写为 `rmd` URL；导出时再内联 data URL，保证 HTML/PNG/PDF 自包含。
- 外链点击被拦截，经 `opener` 插件交给系统浏览器。

## 构建与产物

- `frontend/dist` 由 Vite 生成；`npx tauri build` 将其嵌入可执行文件。
- `cargo test` 与 `npx tauri build --no-bundle` 不需要打包器；发布 workflow 再按平台生成 zip/deb/AppImage/dmg。
- `npm run check` 是本地与 CI 的统一质量门禁。

## 设计取舍

- **单文件 Rust**：命令、路径安全、协议和单测在一屏内可审；规模变大时再按 `paths/`、`notes/`、`vault/` 拆分。
- **无框架前端**：状态集中在一个对象里，纯逻辑拆到可单测模块（`notelist.js`、`markdown.js`）。
- **浏览器 mock**：不需要 Rust 就能复现白屏/UI 问题；代价是必须持续与真实后端对齐。
- **examples/ 兼作夹具**：示例笔记同时是渲染/导出回归样本。
