# GitHub 项目文案与可发现性

本文件给出可直接粘贴到 GitHub 仓库设置里的文案，以及提升搜索/点击率的建议。仓库 slug：`riverzhou/rustmd`。

> 2026-11-14：v1.10.4 起统一 **Markdown + HTML + 数据笔记** 口径，并通过 `gh repo edit`
> 应用了 HTML 优先的 About 描述和 20 个 topics：其中 `html`、`html-editor`、`html-notes`、
> `webview` 四个信号专门覆盖“HTML 编辑器 / 内置 WebView 整页渲染 / HTML 报告”这条主线；
> README 首屏、Release 标题与首段同步更新。GitHub 的 topics 上限是 20 个，新增 HTML
> 词条时移除了覆盖度较低的 `txt` 与 `data-viewer`（TXT 仍出现在描述、README 与 Release 文案里）。

## 1. About 描述（英文，推荐）

GitHub 的 About 描述会出现在搜索、仓库列表和社交预览中，是“被别人搜到”的第一入口。
当前线上文案（338 字符，低于 350 上限）：

> Local-first Markdown, HTML, CSV, TXT & JSON notes for Windows, macOS (Apple Silicon) & Linux. Edit HTML and preview full pages in the built-in WebView — no external browser. Rust + Tauri 2, GPL-3.0-or-later, English/中文 UI, offline, plain files, smart CSV/TXT tables, JSON inspector, UTF-8/GBK/GB18030, Mermaid, LaTeX, HTML/PNG/PDF export.

这版描述的取舍：

- 第一句保留全部五种格式和三个平台，避免只讲 Markdown 而丢掉 CSV/TXT/JSON 的搜索词；
- 第二句把 **HTML** 放在最显眼的位置：编辑 HTML、内置 WebView 整页预览、无需外部浏览器，
  这是与普通 Markdown 应用最强的差异点；
- 末尾继续覆盖 `Rust`、`Tauri`、`offline`、`GBK`、`Mermaid`、`LaTeX`、`export` 等高意图搜索词。

中文备选（仓库 About 目前用英文；中文可用于社交分享/README 首段）：

> 本地优先的 Markdown / HTML / CSV / TXT / JSON 笔记应用：编辑 HTML 源码即可在应用内置
> WebView 中预览整页效果（脚本、样式、本地资源和图表原生执行，无需外部浏览器）；Rust +
> Tauri 2，GPL-3.0-or-later，Windows / macOS（Apple Silicon）/ Linux，离线、纯文件存储、
> CSV/TXT 智能表格、JSON 检查器、UTF-8/GBK/GB18030、文件夹树、全文搜索、Mermaid、LaTeX、
> HTML / PNG / PDF 导出。

## 2. Topics（最多 20 个）

GitHub Topics 是搜索与“相关仓库”推荐的核心信号。v1.10.4 应用的 20 个 topics：

```
markdown
markdown-editor
html
html-editor
html-notes
webview
csv
json
gbk
tauri
rust
desktop-app
offline
local-first
mermaid
pdf-export
windows
macos
linux
obsidian-alternative
```

分组理解：

- **HTML 信号（4 个）**：`html`、`html-editor`、`html-notes`、`webview` —— 对应“HTML 源码编辑 +
  内置 WebView 整页渲染 + 隐藏 WebView 截图/打印”的完整能力；
- **数据格式**：`csv`、`json`、`gbk`（TXT 通过描述、README 和 Release 文案覆盖，不占 topic 名额）；
- **技术栈**：`tauri`、`rust`；
- **平台**：`windows`、`macos`、`linux`、`desktop-app`；
- **定位/功能**：`markdown`、`markdown-editor`、`offline`、`local-first`、`mermaid`、`pdf-export`、
  `obsidian-alternative`。

一键应用（需要已登录的 `gh`；`--remove-topic` / `--add-topic` 接受逗号分隔列表）：

```bash
gh repo edit riverzhou/rustmd \
  --description "Local-first Markdown, HTML, CSV, TXT & JSON notes for Windows, macOS (Apple Silicon) & Linux. Edit HTML and preview full pages in the built-in WebView — no external browser. Rust + Tauri 2, GPL-3.0-or-later, English/中文 UI, offline, plain files, smart CSV/TXT tables, JSON inspector, UTF-8/GBK/GB18030, Mermaid, LaTeX, HTML/PNG/PDF export." \
  --remove-topic txt,data-viewer \
  --add-topic html-editor,webview
```

校验（应看到上面 20 个 topics 和新的描述）：

```bash
gh repo view riverzhou/rustmd --json description,repositoryTopics
```

注意事项：

- topics 是幂等的集合，不要重复 `--add-topic` 已经存在的词；`--remove-topic` 一个不存在的词会报错，
  此时直接跳过 remove 部分；
- 已满 20 个后新增词条必须先移除旧词条，否则 GitHub 仍然只保存前 20 个（且不报错）；
- 不要为了 SEO 加入与本项目无关的高热度词（如 `react`、`ai`），GitHub 搜索会降权。

## 3. README 搜索关键词

README 已包含自然出现的英文/中文关键词，不要为了 SEO 堆砌。重点词：

- 英文：local-first Markdown notes, **HTML notes, HTML editor, HTML page preview, built-in WebView,
  HTML reports**, CSV table, JSON inspector, tab-aligned text, data viewer, UTF-8/GBK/GB18030,
  Markdown editor, recent-folder switcher, pinned vaults, multi-vault view, current-folder scope,
  offline notes, knowledge base, Obsidian alternative, Tauri, Rust, Mermaid, LaTeX, PDF export,
  portable Windows, macOS (Apple Silicon), Linux.
- 中文：Markdown / HTML / CSV / TXT / JSON 笔记、**HTML 编辑器、HTML 网页预览、内置 WebView、
  HTML 报告**、CSV 表格、JSON 检查器、制表符对齐文本、数据查看器、UTF-8/GBK/GB18030、
  最近笔记库切换、置顶笔记库、多库同开、当前文件夹范围、本地笔记、离线笔记、知识库、
  Obsidian 替代、Tauri、Rust、Mermaid 图表、LaTeX 公式、PDF 导出、Windows 绿色版、
  macOS Apple Silicon。

`README.md` 与 `README.en.md` 首段都包含仓库定位；GitHub 会索引 README 内容。

## 4. Social preview（社交预览图）

GitHub 仓库 Settings → Social preview 建议上传 1280×640 的图片。可直接用：

- `docs/screenshots/html-note.png`（HTML 笔记整页渲染，最能体现“不是普通 Markdown 编辑器”）
- 或 `docs/screenshots/overview.png` / `docs/screenshots/dark.png`（1440×900，上传后 GitHub 会裁切；
  若严格需要 1280×640，可再截一张带标题的图）

推荐图上叠加一行文字：`rustmd — local-first Markdown & HTML notes`。

## 5. Release 文案

Release 标题：

```
rustmd v<version> — local-first Markdown, HTML & data notes
```

第一段（HTML 放前面，同时保留数据视图与导出能力）：

> Local-first Markdown, HTML, CSV, TXT and JSON notes for Windows, macOS (Apple Silicon) and
> Linux. Edit HTML and preview the full page in the app's built-in WebView — page styles, scripts,
> local assets and charts run natively, with no Edge/Chrome required. Markdown gets MathJax and
> Mermaid, CSV/TXT get smart tables, JSON gets an inspector, all in one plain-file vault. UTF-8 /
> GBK / GB18030 decoding, folder tree, full-text search, pinned recent vaults, multi-vault view,
> HTML/PNG/PDF export. Plain files, no account.

然后列出三端资产与 `SHA256SUMS.txt`。中文 Release 首段同样先写 HTML：

> 本地优先的 Markdown / HTML / CSV / TXT / JSON 笔记应用：编辑 HTML 源码即可在应用内置
> WebView 中预览整页效果（脚本、样式、本地资源和图表原生执行，无需外部浏览器）；
> Markdown 支持 MathJax / Mermaid，CSV/TXT 有智能表格，JSON 有检查器；UTF-8/GBK/GB18030
> 自动解码、文件夹树、全文搜索、最近笔记库置顶、多库同开、HTML/PNG/PDF 导出。纯文件存储，
> 无需账号。

`scripts/release-notes.mjs` 会直接输出 `RELEASE_NOTES-<version>.md` 作为 Release 正文，
因此把上面的口径写进该文件即可；workflow 的 Release 标题在
`.github/workflows/release.yml` 的 `publish` job 中维护。

## 6. 提升热度的非侵入做法

- **保持 README 首屏有截图、定位、下载入口**：访客 10 秒内知道它能做什么、怎么装。
- **HTML 是差异化卖点**：截图优先展示 HTML 笔记整页渲染（`html-note.png`），Release 首段先写
  HTML 再写 Markdown，topics 保留 4 个 HTML 信号词。
- **每个 Release 写清楚三端资产和校验方式**：减少“下载了不会用”的流失。
- **Topics 覆盖“格式 + 技术栈 + 平台”**：`markdown-editor`、`html-editor`、`html-notes`、`webview`、
  `csv`、`json`、`gbk`、`tauri`、`windows`、`obsidian-alternative`。
- **提交有意义的 Issue/PR 模板**（可选）：让外部反馈更容易变成可合并的改动。
- **不要刷 star 或堆砌无关关键词**：GitHub 搜索会降权，且损害信任。
- **在相关社区分享时用“解决什么问题”而不是“求 star”**：例如本地 Markdown、HTML 报告归档、
  Obsidian 迁移、Windows 绿色软件、Tauri 实战。
- **保持发布节奏**：小步更新 + 清晰 CHANGELOG，比一次性大版本更容易被持续发现。

## 7. 当前仓库信息

- 仓库：`https://github.com/riverzhou/rustmd`
- 发布页：`https://github.com/riverzhou/rustmd/releases`
- CI：`https://github.com/riverzhou/rustmd/actions/workflows/ci.yml`
- 镜像：GitLab `http://gitlab.riverzhou.cn/river/rustmd`（镜像仓库，不跑 CI）
- 英文说明：`README.en.md`
- 中文说明：`README.md`

最近一次核对（v1.10.4）：About 描述为第 1 节的英文文案，20 个 topics 为第 2 节的列表。
