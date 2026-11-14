# GitHub 项目文案与可发现性

本文件给出可直接粘贴到 GitHub 仓库设置里的文案，以及提升搜索/点击率的建议。仓库 slug：`riverzhou/rustmd`。

> **2026-11-14（v1.10.4）**：About 描述与 20 个 topics 已通过 `gh repo edit` 应用；Discussions
> 已开启；README 首屏换成“下载按钮 + 10 秒动图 + 对比表”；新增 `docs/social-preview.png`
> （1280×640，需手动上传到 GitHub）与 `docs/PROMOTION.md`（对外发布手册）。
> GitHub Topics 上限 20 个：这一轮用 `note-taking` 替换了覆盖度较低的 `desktop-app`。

## 1. About 描述（英文，推荐）

GitHub 的 About 描述会出现在搜索、仓库列表和社交预览中，是“被别人搜到”的第一入口。
当前线上文案（256 字符，低于 350 上限）：

> Local-first notes app for Markdown, HTML, CSV, TXT & JSON — Windows, macOS & Linux. Edit HTML and preview full pages in the built-in WebView; Mermaid, LaTeX, smart tables, JSON inspector, HTML/PNG/PDF export. Rust + Tauri 2, offline, plain files, EN/中文.

这版描述的取舍：

- 第一句用 **notes app** 而不是“Markdown editor”，覆盖 `note-taking app` / `notes app` 这类搜索意图，
  同时保留五种格式与三个平台；
- 第二句把 **HTML + 内置 WebView 整页预览**放在最显眼的位置——这是与普通 Markdown 应用最强的差异点；
- 末尾覆盖 `Rust`、`Tauri`、`offline`、`plain files`、`Mermaid`、`LaTeX`、`HTML/PNG/PDF export`
  等高意图搜索词；
- 比上一版短 82 字符，搜索结果的截断更少；macOS 仅 Apple Silicon 的限制放在 README 下载表里，
  避免 About 过长。

中文备选（仓库 About 目前用英文；中文可用于社交分享/README 首段）：

> 本地优先的 Markdown / HTML / CSV / TXT / JSON 笔记应用：编辑 HTML 源码即可在应用内置
> WebView 中预览整页效果（脚本、样式、本地资源和图表原生执行，无需外部浏览器）；Rust +
> Tauri 2，GPL-3.0-or-later，Windows / macOS（Apple Silicon）/ Linux，离线、纯文件存储、
> CSV/TXT 智能表格、JSON 检查器、UTF-8/GBK/GB18030、文件夹树、全文搜索、Mermaid、LaTeX、
> HTML / PNG / PDF 导出。

## 2. Topics（最多 20 个）

GitHub Topics 是搜索与“相关仓库”推荐的核心信号。当前应用的 20 个 topics：

```
markdown
markdown-editor
note-taking
html
html-editor
html-notes
webview
csv
json
gbk
tauri
rust
local-first
offline
mermaid
pdf-export
obsidian-alternative
windows
macos
linux
```

分组理解：

- **HTML 信号（4 个）**：`html`、`html-editor`、`html-notes`、`webview` —— 对应“HTML 源码编辑 +
  内置 WebView 整页渲染 + 隐藏 WebView 截图/打印”的完整能力。其中 `html-notes`（约 15 个仓库）
  和 `html-editor`（约 289 个仓库）竞争很小，是**能被真正搜到**的词；
- **数据格式**：`csv`、`json`、`gbk`（TXT 通过描述、README 和 Release 文案覆盖，不占 topic 名额；
  `gbk` 只有约 70 个仓库，对中文用户是精准入口）；
- **技术栈**：`tauri`、`rust`；
- **平台**：`windows`、`macos`、`linux`；
- **定位/受众**：`markdown`、`markdown-editor`、`note-taking`、`offline`、`local-first`、
  `mermaid`、`pdf-export`、`obsidian-alternative`。

一键应用（需要已登录的 `gh`；`--remove-topic` / `--add-topic` 接受逗号分隔列表）：

```bash
gh repo edit riverzhou/rustmd \
  --description "Local-first notes app for Markdown, HTML, CSV, TXT & JSON — Windows, macOS & Linux. Edit HTML and preview full pages in the built-in WebView; Mermaid, LaTeX, smart tables, JSON inspector, HTML/PNG/PDF export. Rust + Tauri 2, offline, plain files, EN/中文." \
  --remove-topic desktop-app \
  --add-topic note-taking
```

校验（应看到上面 20 个 topics 和新的描述）：

```bash
gh repo view riverzhou/rustmd --json description,repositoryTopics
```

注意事项：

- topics 是幂等的集合，不要重复 `--add-topic` 已经存在的词；`--remove-topic` 一个不存在的词会报错，
  此时直接跳过 remove 部分；
- 已满 20 个后新增词条必须先移除旧词条，否则 GitHub 仍然只保存前 20 个（且不报错）；
- 不要为了 SEO 加入与本项目无关的高热度词（如 `react`、`ai`），GitHub 搜索会降权；
- 不要把所有名额都留给 `markdown`、`html` 这种几十万仓库的大词：低星项目在大词页面里排不上，
  小词（`html-notes`、`gbk`、`obsidian-alternative`）才有曝光机会。

## 3. README 搜索关键词

README 已包含自然出现的英文/中文关键词，不要为了 SEO 堆砌。重点词：

- 英文：local-first notes, **HTML notes, HTML editor, HTML page preview, built-in WebView,
  HTML reports**, CSV table, JSON inspector, tab-aligned text, CSV/TXT smart tables,
  UTF-8/GBK/GB18030, Markdown editor, recent-vault switcher, pinned vaults, multi-vault view,
  current-folder scope, offline notes, knowledge base, Obsidian alternative, Tauri, Rust,
  Mermaid, LaTeX, PDF export, portable Windows, macOS (Apple Silicon), Linux。
- 中文：Markdown / HTML / CSV / TXT / JSON 笔记、**HTML 编辑器、HTML 网页预览、内置 WebView、
  HTML 报告**、CSV 表格、JSON 检查器、制表符对齐文本、数据查看器、UTF-8/GBK/GB18030、
  最近笔记库切换、置顶笔记库、多库同开、当前文件夹范围、本地笔记、离线笔记、知识库、
  Obsidian 替代、Typora 替代、Tauri、Rust、Mermaid 图表、LaTeX 公式、PDF 导出、
  Windows 绿色版、macOS Apple Silicon。

`README.md` 与 `README.en.md` 首段都包含仓库定位；GitHub 会索引 README 内容。
首屏现在是“定位 → 徽章 → 三平台下载按钮 → 10 秒动图 → 对比表”，让访客先做决定再滚动。

## 4. Social preview（社交预览图）

已生成 **`docs/social-preview.png`（1280×640）**：深色背景 + 品牌图标 + “Markdown & HTML notes
that stay plain files.” + 应用截图 + 平台/技术栈信息。这是链接在 Twitter/X、Reddit、Discord、
Slack 里被分享时显示的卡片图，直接影响点击率。

上传步骤（GitHub API 不提供该设置，必须手动）：

1. 打开 `https://github.com/riverzhou/rustmd/settings`；
2. 找到 **Social preview** → **Edit** → **Upload an image**；
3. 选择 `docs/social-preview.png`（1280×640，约 370 KB），保存。

改版后重新生成（Windows，已安装 Edge；在仓库根目录执行）：

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1280,640 \
  --screenshot="docs/social-preview.png" \
  "file:///<repo>/docs/social-preview.html"
```

`docs/social-preview.html` 是排版的唯一来源：改文案、换截图、调颜色都在这里改。
需要 1280×640 的整图，不要用 1440×900 的原始截图直接上传（GitHub 会裁切）。

README 首屏另有一张 **`docs/demo.gif`（880×550，约 1.3 MB）**，由 `docs/screenshots/` 里的
5 张截图加标题条后交叉淡入生成（10 fps，约 10 秒），不需要单独录制屏幕。

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

## 6. GitHub 原生优化清单

按“访客从看到仓库到点 Star / 下载”的顺序检查：

- [x] About 描述包含品类 + 差异化 + 技术栈 + 平台，256 字符；
- [x] 20 个 topics 覆盖 HTML、数据格式、技术栈、平台与受众；
- [x] README 首屏有下载按钮、10 秒动图、对比表和“为什么是 rustmd”；
- [x] PR/Issue 模板、CODE_OF_CONDUCT 与 Discussions 让外部反馈有地方落地；
- [x] `docs/social-preview.png` 已生成（**待手动上传**）；
- [ ] 在个人主页把 `rustmd` 设为 **pinned repository**；
- [ ] 首个 Discussion 欢迎帖（模板见 [PROMOTION.md](PROMOTION.md) 第 5.10 节）；
- [ ] 每个 Release 附三端资产、SHA256 与一段“这版解决了什么”；
- [ ] 有外部用户后，在 README 加 “Used by / 用户反馈” 区块（不要编造）。

更完整的对外发布渠道、现成文案与 30 天节奏见 **[PROMOTION.md](PROMOTION.md)**；
包管理器清单见 **[../packaging/README.md](../packaging/README.md)**。

## 7. 当前仓库信息

- 仓库：`https://github.com/riverzhou/rustmd`
- 发布页：`https://github.com/riverzhou/rustmd/releases`
- Issues：`https://github.com/riverzhou/rustmd/issues`
- Discussions：`https://github.com/riverzhou/rustmd/discussions`（2026-11-14 开启）
- CI：`https://github.com/riverzhou/rustmd/actions/workflows/ci.yml`
- 镜像：GitLab `http://gitlab.riverzhou.cn/river/rustmd`（镜像仓库，不跑 CI）
- 英文说明：`README.en.md`；中文说明：`README.md`
- About homepage：暂为空（可选 GitHub Pages 落地页，见 PROMOTION.md 第 9 节）
- 社交预览：`docs/social-preview.png`（待上传）
- 最近一次核对（v1.10.4）：About 为第 1 节的 256 字符文案，20 个 topics 为第 2 节列表。
