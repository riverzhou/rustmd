# 推广与增长手册（launch kit）

> 目标：让第一次看到 rustmd 的人在 **10 秒内**明白它是什么、在 **60 秒内**装上它；让每个月都有**稳定的新入口**，而不是只靠一次发帖。
>
> 本文件负责“对外推广”；[GITHUB_PROJECT_COPY.md](GITHUB_PROJECT_COPY.md) 只负责 GitHub 仓库资料（About / topics / 社交预览 / Release 文案），[../packaging/README.md](../packaging/README.md) 负责包管理器清单。

## 0. 先说现状（2026-11-14）

| 指标 | 当前值 | 说明 |
| --- | --- | --- |
| Stars / forks | 2 / 0 | 项目 2026-09-29 创建，v1.10.4 刚发布 |
| GitHub 14 天独立访客 | 2 | 基本只有作者本人 |
| 14 天外部 referrer | 1（github.com） | **没有外部入口** |
| v1.10.4 Release 下载 | 10（全部版本累计 207） | 其中包含 LICENSE / SHA256 等小文件；不是“下载页做得不好”，是没人到达 |
| GitHub Topics | 20 / 20 | About 与 topics 已按 [GITHUB_PROJECT_COPY.md](GITHUB_PROJECT_COPY.md) 更新 |
| 包管理器 | Scoop + Homebrew 已发布 | winget 待 CLA，AUR 待 AUR 账号；清单在 `packaging/` |

结论：**当前瓶颈不是转化，而是流量入口**。仓库资料优化只能接住已有流量，必须主动建立外部入口。
目标不用虚高：30 天内 **50 stars、300 次 Release 下载、10 个外部 referrer** 就是很好的第一步。

> **2026-11-14 已自动执行**：3 个 awesome list PR 已提交（awesome-local-first #66、
> awesome-markdown-editors #316、awesome-note-taking #190）；Scoop bucket 与 Homebrew tap
> 已发布；Discussions 欢迎帖已创建。winget 需要本人签 Microsoft CLA，AUR 需要 AUR 账号。

## 1. 定位：不要卖“又一个 Markdown 编辑器”

一句话（英文）：

> **Local-first Markdown & HTML notes that stay plain files.** Edit HTML source and preview the
> full page in the app's built-in WebView — no browser, no database, no account.

一句话（中文）：

> **本地优先的 Markdown / HTML 笔记：笔记就是普通文件，HTML 源码编辑 + 内置 WebView 整页预览。**
> 没有数据库、没有账号、不需要外部浏览器。

差异化排序（所有对外文案都按这个顺序）：

1. **HTML 笔记是一等公民** —— 直接编辑 `.html`，整页渲染，导出 HTML/PNG/PDF；
2. **五种格式一个列表** —— MD / HTML / CSV / TXT / JSON，各有原生视图；
3. **纯文件 + 离线 + 无账号** —— 笔记可以交给 Git / Syncthing / 网盘；
4. **Rust + Tauri 2，小体积跨平台** —— Windows 绿色版、Linux deb/AppImage、macOS Apple Silicon。

目标人群（写文案时挑一个具体的人，不要对所有人说话）：

- 用 Obsidian / Typora / VS Code 但想要“更轻、更贴近文件”的用户；
- 需要把 **HTML 报告 / 仪表盘 / 导出页面** 和笔记放在一起归档的人；
- 经常处理 CSV / JSON / 制表符文本的工程师、数据分析师；
- 中文 Windows 用户（GBK 编码、绿色版、中文界面）；
- Tauri / Rust 开发者（技术实现本身也是内容）。

## 2. 关键词地图

| 意图 | 英文 | 中文 | 主要落点 |
| --- | --- | --- | --- |
| 品类 | local-first notes, markdown notes app, note-taking app | 本地笔记、Markdown 笔记软件 | About、README 首段、目录站分类 |
| 差异化 | HTML notes, HTML editor, HTML preview, WebView notes | HTML 笔记、HTML 编辑器、HTML 网页预览 | README、topics、社区标题 |
| 数据 | CSV viewer/editor, JSON inspector, TSV | CSV 表格、JSON 查看器、制表符 | README 格式章节、目录站标签 |
| 迁移 | Obsidian alternative, Typora alternative | Obsidian 替代、Typora 替代 | 对比表、知乎/Reddit 回答 |
| 技术 | Tauri 2 app, Rust desktop app | Tauri 实战、Rust 桌面应用 | 掘金/技术博客/HN |
| 场景 | offline notes, portable notes app, markdown documentation | 离线笔记、Windows 绿色版、知识库 | 目录站、V2EX |

规则：关键词要**自然出现在句子里**，不要堆在 README 末尾。GitHub 搜索会索引仓库名、About、README 前部与 topics。

## 3. 渠道清单（按投入产出排序）

| # | 渠道 | 类型 | 预期 | 需要 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | GitHub About / topics / 社交预览 / pinned repo | 基础转化 | 决定 10 秒留存 | GitHub 设置 | 部分完成，社交预览待上传 |
| 2 | winget（Windows） | 长期搜索入口 | 高 | 提交 PR | 清单已校验；待签 Microsoft CLA |
| 3 | AUR（Arch Linux） | 长期搜索入口 | 中高 | AUR 账号 | 清单已就绪；待提交 |
| 4 | Scoop / Homebrew tap | 长期搜索入口 | 中 | 建 bucket/tap 仓库 | ✅ 已发布：`riverzhou/scoop-bucket`、`riverzhou/homebrew-tap` |
| 5 | awesome-markdown-editors、awesome-local-first、awesome-note-taking | 精准推荐 | 高 | 3 个 PR | ✅ 已提交（awesome-rust 需 50 stars，暂缓） |
| 6 | AlternativeTo | SEO / 对比搜索 | 高 | 账号 | 文案已备好 |
| 7 | Hacker News（Show HN） | 单次爆发 | 高 | 账号 + 时间窗口 | 文案已备好 |
| 8 | Reddit（r/rust、r/tauri、r/markdown 等） | 单次爆发 | 中高 | 账号 + 遵守版规 | 文案已备好 |
| 9 | V2EX「分享创造」 | 中文爆发 | 中高 | 账号 | 文案已备好 |
| 10 | 小众软件 / 少数派 Matrix | 中文长尾 | 高 | 投稿 | 文案已备好 |
| 11 | 知乎 / 掘金 | 中文搜索长尾 | 中 | 账号 | 提纲已备好 |
| 12 | Product Hunt | 单次发布 | 中 | 素材 + 预约 | 文案已备好 |
| 13 | Lobsters / Tauri Discord | 技术社区 | 中 | 邀请/账号 | 文案已备好 |
| 14 | Softpedia / LinuxLinks / OpenAlternative | 目录站 | 中低 | 表单 | 文案已备好 |

## 4. 30 天节奏

**第 0 天（今天，30 分钟）**

- 上传 `docs/social-preview.png` 到 GitHub Settings → Social preview（见 [GITHUB_PROJECT_COPY.md](GITHUB_PROJECT_COPY.md) 第 4 节）；
- 在个人主页把 `rustmd` 设为 pinned repository；
- 在 repo 的 About 里确认描述与 topics 已生效；
- 发一条简短的 Release / Discussion 欢迎帖（可选）。

**第 1 周：建立长期入口**

1. winget 需要先签 Microsoft CLA 再提 PR（步骤见 [../packaging/README.md](../packaging/README.md)）；
2. 已给 3 个 awesome list 提 PR（见 5.11 的实际链接）；
3. 向小众软件投稿（文案见 5.7）；
4. V2EX「分享创造」发帖（文案见 5.6）。

**第 2 周：英文技术社区**

1. 周二或周三 8:00–11:00（美东）发 Show HN（文案见 5.1）；
2. 隔 1–2 天发 r/rust、r/tauri（文案见 5.2 / 5.3）；
3. Lobsters 与 Tauri Discord 的 showcase 频道（文案见 5.9，频道名以服务器实际为准）；
4. 当天和次日必须在线回复评论——回复质量本身就是二次曝光。

**第 3 周：中文长尾 + 目录站**

1. 少数派 Matrix / 知乎文章（见 5.7 / 5.8）；
2. AlternativeTo 收录（见 5.12）；
3. Product Hunt 发布（见 5.13）；
4. AUR 提交（需 AUR 账号）；Scoop / Homebrew 已完成（见 [../packaging/README.md](../packaging/README.md)）。

**第 4 周：复盘与复利**

1. 看 referrers / stars / 下载，判断哪个渠道有效；
2. 把有效渠道的评论/问题整理成 FAQ 与下个版本改动；
3. 发布一个包含真实反馈的小版本（如 v1.10.5），在**最有效的那个渠道**再发一次更新说明；
4. 更新 README 的“新功能”与截图，保持 Release 节奏。

## 5. 现成文案

> 使用前替换 `<version>` 为当前版本；链接统一用 `https://github.com/riverzhou/rustmd`。
> 所有帖子都要**明确说明你是作者**，不要伪装成普通用户。

常用入口：

- Hacker News：<https://news.ycombinator.com/submit>
- Reddit：<https://www.reddit.com/r/rust/> · <https://www.reddit.com/r/tauri/> ·
  <https://www.reddit.com/r/markdown/>
- V2EX「分享创造」：<https://www.v2ex.com/go/create>
- 小众软件投稿：<https://www.appinn.com/contribute/>
- 少数派 Matrix：<https://sspai.com/matrix>
- Lobsters：<https://lobste.rs/stories/new>（需要邀请）
- Product Hunt：<https://www.producthunt.com/posts/new>
- Tauri Discord：<https://discord.com/invite/tauri>

### 5.1 Hacker News（Show HN）

标题（不超过 80 字符）：

```
Show HN: rustmd – local-first Markdown/HTML notes that stay plain files
```

正文：

```
I built rustmd because I wanted an HTML-first notes app: most Markdown editors treat HTML as
something you paste into a Markdown file, while I often keep HTML reports, dashboards and
exported pages next to my notes.

rustmd is a Tauri 2 desktop app. A note is just a .md/.html/.csv/.txt/.json file in a folder —
no database, no import, no account. Edit HTML source on the left and see the full rendered page
on the right in the app's WebView; page styles, scripts, local images/CSS/JS and charts run there,
with no external browser. Markdown gets MathJax, Mermaid and highlighting; CSV/TXT get smart
tables; JSON gets a collapsible inspector. Export is HTML/PNG/PDF (PDF text is vector on the
platform print pipeline).

The Windows build is a ~9 MB portable zip; there are Linux deb/AppImage and macOS (Apple
Silicon) builds too. GPL-3.0. Repo: https://github.com/riverzhou/rustmd

I'd especially appreciate feedback on the HTML sandbox / export isolation and on the PDF
pipeline. Happy to answer anything.
```

### 5.2 Reddit r/rust

标题：

```
rustmd – a local-first Markdown + HTML notes app built with Rust and Tauri 2
```

正文：

```
I've been building a notes app around a simple constraint: notes are plain files, and HTML is a
first-class format rather than a Markdown extension.

What's in it:
- Tauri 2 + a single Rust backend file; frameworkless frontend.
- HTML notes render in a sandboxed iframe (preview) and a label-guarded hidden WebView (export);
  page scripts/styles/local assets work, but note HTML never enters the app document.
- Markdown preview with MathJax/Mermaid/DOMPurify; CSV/TXT smart tables; JSON inspector.
- HTML/PNG/PDF export; PDF goes through the platform print engine (WebView2/WKWebView/WebKitGTK)
  so text stays selectable.
- UTF-8 / GBK / GB18030 detection, folder tree, full-text search, multi-vault view.
- GPL-3.0, Windows/macOS arm64/Linux: https://github.com/riverzhou/rustmd

It's still early, so I'm mostly looking for feedback on the architecture and
edge cases — especially encoding round-trips and the HTML preview isolation. Thanks!
```

### 5.3 Reddit r/tauri

标题：

```
A local-first Markdown/HTML notes app in Tauri 2 — hidden-WebView capture, native print-to-PDF
```

正文要点：

```
- Tauri 2 app; ~9 MB portable Windows zip, deb/AppImage on Linux, arm64 DMG on macOS.
- HTML notes: sandboxed iframe preview (null origin), hidden WebView export with a label-guarded
  `html_preview_finish` command; segmented full-page PNG capture stitched in Rust.
- PDF export uses WebView2 PrintToPdfStream / WKWebView NSPrintOperation / WebKitGTK print, then
  stamps page numbers with lopdf on macOS/Linux.
- `rmd` custom protocol with a strict origin allowlist; CSP on in release.
Repo: https://github.com/riverzhou/rustmd (GPL-3.0). Feedback welcome!
```

### 5.4 Reddit r/markdown

标题：`A Markdown notes app that also treats HTML, CSV, TXT and JSON as first-class files`

正文：从“为什么 HTML 和 Markdown 放在同一个列表”切入，列出格式支持、导出和搜索，最后放链接与“我是作者”。

### 5.5 Reddit r/opensource / r/software / r/Windows10 / r/macapps / r/Linux

平台版用短文案（3–5 行）：一句定位 + 平台资产 + 链接 + “GPL、无账号、纯文件”。**每个 subreddit 单独改写，不要复制粘贴同一段**；先看版规是否允许 self-promo。

### 5.6 V2EX「分享创造」

标题：

```
[分享创造] rustmd：本地优先的 Markdown / HTML 笔记应用（Rust + Tauri 2）
```

正文：

```
做这个应用的起点是：我经常把 HTML 报告、导出的网页和 Markdown 笔记放在同一个文件夹里，
但大多数编辑器只把 HTML 当成 Markdown 里的一段内联内容。

rustmd 的取舍：
- 笔记就是普通 .md / .html / .csv / .txt / .json 文件，没有数据库、不用导入、不用登录；
- .html 直接编辑源码，右侧在内置 WebView 里渲染整页（页面样式、脚本、本地图片/CSS/JS、
  图表都能跑），不需要 Edge/Chrome；
- Markdown 支持 MathJax、Mermaid、代码高亮；CSV/TXT 有智能表格；JSON 有可折叠检查器；
- 支持 HTML/PNG/PDF 导出、UTF-8/GBK/GB18030、文件夹树、全文搜索、最近/置顶/多库；
- Rust + Tauri 2，Windows 绿色版约 9 MB，另有 Linux deb/AppImage 和 macOS Apple Silicon。

项目是 GPL-3.0 开源的：https://github.com/riverzhou/rustmd
目前还很早期，想听听大家对“HTML 当笔记格式”这个方向的看法，以及还缺什么功能。
```

注意：V2EX 对纯推广较敏感，正文要以“做了什么东西、遇到什么问题”为主，不要只贴下载链接；回复评论时再给具体链接。

### 5.7 小众软件投稿 / 少数派 Matrix

投稿邮件/表单的核心信息（小众软件偏好“解决什么小问题”）：

```
名称：rustmd
平台：Windows / Linux / macOS (Apple Silicon)
授权：GPL-3.0-or-later，免费
下载：https://github.com/riverzhou/rustmd/releases/latest
一句话：本地优先的 Markdown / HTML / CSV / TXT / JSON 笔记应用，HTML 源码编辑 +
内置 WebView 整页预览，不需要外部浏览器。
亮点：纯文件、无账号、离线；HTML 笔记整页渲染；CSV/TXT 智能表格；JSON 检查器；
UTF-8/GBK/GB18030；HTML/PNG/PDF 导出；Windows 绿色版。
截图：附上仓库 docs/screenshots/ 里的 overview / html-note / csv-note / json-note 四张
作者说明：我是作者，项目开源，欢迎反馈。
```

少数派 Matrix 文章标题建议：

- 《把 HTML 报告也当成笔记：我为什么做了 rustmd》
- 《不把笔记锁进数据库：一个本地优先笔记应用的取舍》

文章结构：痛点（HTML 报告/Markdown/表格散落）→ 设计取舍（纯文件、HTML 一等公民、安全隔离）
→ 实际使用场景 → 不足与路线 → 下载。**不要写成功能清单**，要写“为什么这样设计”。

### 5.8 知乎 / 掘金

知乎：找“有哪些好用的本地 Markdown 笔记软件？”“Obsidian 有什么替代品？”这类问题，
写**有信息量的回答**（对比表 + 真实使用场景），末尾注明作者与开源链接。不要每个问题都贴同一段。

掘金（技术向）标题：

```
用 Rust + Tauri 2 写一个本地优先的 HTML 笔记应用：WebView、PDF 与安全边界
```

提纲：

1. 为什么 HTML 笔记不能直接塞进主文档（sandbox iframe / 隐藏 WebView / label guard）；
2. 整页截图：分段捕获 + Rust 侧 PNG 拼接；
3. PDF：WebView2 / WKWebView / WebKitGTK 三条打印路径与页码 stamp；
4. 编码：UTF-8 / GBK / GB18030 的检测、保存与 BOM；
5. 踩坑与取舍（Tauri 2、自定义协议、CSP、CI 三端构建）。

文末放 repo 链接与“欢迎 issue/PR”。

### 5.9 Lobsters / Tauri Discord / X

Lobsters（需要邀请）：

```
Title: rustmd – local-first Markdown/HTML notes that stay plain files
Tags: rust, release, show
URL: https://github.com/riverzhou/rustmd
```

Tauri Discord `#showcase`：

```
Hi! I built rustmd, a local-first notes app in Tauri 2 (Rust + vanilla JS).
HTML notes are edited as source and rendered as full pages in a hidden/sandboxed WebView;
PDF export goes through WebView2/WKWebView/WebKitGTK print-to-PDF.
Windows portable zip is ~9 MB. GPL-3.0: https://github.com/riverzhou/rustmd
Happy to share details about the WebView capture/print pipeline if useful.
```

X / Twitter 线程：

1. `rustmd — local-first Markdown & HTML notes that stay plain files. Edit HTML, preview the real page in-app, export PDF. Rust + Tauri 2. GPL. https://github.com/riverzhou/rustmd`
2. 一张 `html-note.png` + “HTML notes are files, not Markdown snippets.”
3. 一张 `csv-note.png` + “CSV/TXT get smart tables; JSON gets an inspector.”
4. 一张 `dark.png` + “Windows portable zip ~9 MB; Linux deb/AppImage; macOS arm64. Feedback welcome.”

### 5.10 GitHub Discussions 欢迎帖

标题：`Welcome to rustmd — what are you using it for?`

正文：一句项目定位 + 三个问题（你主要用哪种格式？从哪个工具迁移？最缺什么？）+ 链接到
README 与 Releases。Discussions 能把外部流量沉淀成可搜索的内容。

### 5.11 awesome list PR

目标仓库：

- [mundimark/awesome-markdown-editors](https://github.com/mundimark/awesome-markdown-editors)
- [tehtbl/awesome-note-taking](https://github.com/tehtbl/awesome-note-taking)
- [rust-unofficial/awesome-rust](https://github.com/rust-unofficial/awesome-rust)（50 stars 门槛，暂缓）
- [schickling/awesome-local-first](https://github.com/schickling/awesome-local-first)

已在 2026-11-14 提交的 PR：[awesome-local-first #66](https://github.com/schickling/awesome-local-first/pull/66)、
[awesome-markdown-editors #316](https://github.com/mundimark/awesome-markdown-editors/pull/316)、
[awesome-note-taking #190](https://github.com/tehtbl/awesome-note-taking/pull/190)。

**awesome-markdown-editors**（先加到 `UPCOMING.md`，再按维护者要求进主列表）：

```markdown
**rustmd**
(open source @ github [`riverzhou/rustmd`](https://github.com/riverzhou/rustmd)) -
A local-first notes app for Markdown, HTML, CSV, TXT and JSON built with Rust + Tauri 2 for
Windows, macOS (Apple Silicon) and Linux. HTML notes are edited as source and rendered as full
pages in the built-in WebView (no external browser); Markdown gets MathJax, Mermaid and syntax
highlighting; CSV/TXT get smart tables and JSON a collapsible inspector. Plain files, offline,
no account, folder tree, full-text search, multi-vault view, UTF-8/GBK/GB18030 and
HTML/PNG/PDF export.
```

**awesome-rust**（`Applications → Text editors`；维护者要求 **50 stars 或 2000 下载**，当前 2 stars，达到后再提）：

```markdown
* [riverzhou/rustmd](https://github.com/riverzhou/rustmd) - A local-first Markdown/HTML/CSV/TXT/JSON notes app built with Tauri 2, with full-page HTML preview in the built-in WebView, math/Mermaid, smart tables and HTML/PNG/PDF export.
```

**awesome-local-first**（`Applications → Projects`）：

```markdown
- [rustmd](https://github.com/riverzhou/rustmd): Local-first notes for Markdown, HTML, CSV, TXT and JSON; plain files, offline, with full-page HTML rendering in a built-in WebView.
```

**awesome-note-taking**（`Open Source → Tauri`，📖 表示纯文本存储）：

```markdown
- 📖 [rustmd](https://github.com/riverzhou/rustmd) - Local-first notes for Markdown, HTML, CSV, TXT and JSON with full-page HTML rendering in a built-in WebView. `GPL-3.0-or-later` `Tauri/Rust`
```

PR 规范：一次只加一个项目；fork → 新建分支 → 只改目标文件 → PR 描述里写清“作者自荐、
开源协议、平台、为什么符合列表主题”；如果维护者拒绝，不要争辩或重复提交。

### 5.12 AlternativeTo

- 入口：`https://alternativeto.net/manage/add-software/`（需要账号）；
- 名称：`rustmd`；主页：GitHub；许可：GPL-3.0；平台：Windows / Linux / macOS；
- 分类：`Note-taking`、`Markdown Editors`、`Text Editors`；
- “Alternatives to”：Obsidian、Typora、Notepad++、VS Code、Zettlr；
- 描述用第 1 节的英文一句话 + 3 个亮点；截图用 `docs/social-preview.png` 与 `docs/screenshots/`。

### 5.13 Product Hunt

- Tagline（60 字符内）：`Local-first Markdown & HTML notes. Plain files, no account.`
- 描述：第 1 节英文定位 + 三条亮点 + GPL/平台；
- Gallery：social preview + overview + html-note + csv-note + dark；
- 第一条评论：自我介绍 + 为什么做 + 求反馈（不要只放链接）；
- 发布时间：太平洋时间周二/周三 00:01 之后；当天在线回复。

### 5.14 目录站

- **Softpedia**：`https://www.softpedia.com/submit-software/`（Windows/Linux 分类，GPL，免费）；
- **LinuxLinks**：`https://www.linuxlinks.com/contact/`（说明 Linux deb/AppImage）；
- **OpenAlternative**：`https://openalternative.co/submit`（开源替代品目录，和 Obsidian/Typora 关联）；
- 每个目录用不同长度的描述（50 / 150 / 300 字），不要直接复制 README。

## 6. 包管理器提交（长期入口）

详细清单与校验命令在 [../packaging/README.md](../packaging/README.md)。提交顺序建议：

1. **winget**：fork `microsoft/winget-pkgs`，把 `packaging/winget/*` 放到
   `manifests/r/RiverZhou/rustmd/1.10.4/`，本地 `winget validate --manifest` 通过后提 PR；
   **需要先签 Microsoft CLA**（本人操作）；
2. **Scoop**：✅ 已发布到自建 [riverzhou/scoop-bucket](https://github.com/riverzhou/scoop-bucket)；
   如需进 Extras，再按 Extras 的知名度门槛提交；
3. **AUR**：创建 `rustmd-bin` 包，推 `PKGBUILD` 与 `makepkg --printsrcinfo` 生成的
   `.SRCINFO`（需要 AUR 账号）；
4. **Homebrew**：✅ 已发布到自建 [riverzhou/homebrew-tap](https://github.com/riverzhou/homebrew-tap)；
   官方 cask 的知名度门槛更高，等 star/fork 上来再提。

采纳后，把 README 的“下载与安装”增加对应的 `winget install RiverZhou.rustmd` /
`brew install --cask riverzhou/tap/rustmd` 行——这会显著提高“看到即安装”的比例。

## 7. 度量、复盘与站内动作

每周复制一份下面的表（数据来自 GitHub Traffic 与 Release API）：

```bash
gh api repos/riverzhou/rustmd/traffic/views
gh api repos/riverzhou/rustmd/traffic/popular/referrers
gh api repos/riverzhou/rustmd/traffic/popular/paths
gh release view v1.10.4 -R riverzhou/rustmd --json assets \
  --jq '.assets[] | "\(.name)\t\(.downloadCount)"'
```

| 周 | 独立访客 | 外部 referrer（前 3） | Stars | Release 下载 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-14 基线 | 2 | github.com | 2 | 0 | 尚无外部入口 |
| 第 1 周 | | | | | |
| 第 2 周 | | | | | |

判断规则：

- 某个渠道发帖 48 小时后，如果 **0 star、<10 次访问**，换标题/换切入角度再试一次；仍无效就放弃；
- 如果评论里出现重复问题（安装、SmartScreen、Gatekeeper、HTML 安全），把它写进 README FAQ；
- 不要用“求 star”换 star；star 只是结果，下载与讨论才是信号。

外部链接可以加 `?utm_source=v2ex` 之类参数，但 GitHub Traffic 的 referrer 只显示域名，
所以更可靠的做法是**每个渠道用不同的短链**（如 Bitly）来区分点击。

### GitHub 站内动作（零成本，先做）

- 在个人主页的 **Pinned repositories** 里置顶 `rustmd`（GitHub 没有 API，需在网页上操作）；
- 如果 `riverzhou/riverzhou` 的 profile README 还在用，可以加一张项目卡片：

  ```markdown
  ### rustmd
  本地优先的 Markdown / HTML / CSV / TXT / JSON 笔记应用。纯文件、离线、无账号。
  [Repository](https://github.com/riverzhou/rustmd) · [Download](https://github.com/riverzhou/rustmd/releases/latest)
  ```

- 每个 Release 末尾加一句轻量 CTA：`If rustmd saves you time, a star helps other people find it.`
  不要写成“求 star”，也不要反复催促。

## 8. 规则与风险

- **公开作者身份**：所有帖子写明“我是作者 / I built this”。
- **遵守社区规则**：Reddit 的 self-promo 比例、V2EX 的推广节点、HN 的 Show HN 一次性、
  Lobsters 的邀请制；先参与讨论，再发自己的项目。
- **不刷 star / 不买流量 / 不堆无关关键词**：GitHub 会降权，社区会反感，长期伤害更大。
- **不要承诺没有的东西**：macOS 只有 Apple Silicon；Windows 是自签名/绿色版；HTML 脚本在
  隔离环境运行——这些限制要主动写清楚，减少“下载后失望”。
- **回复优先**：发布后的 24–48 小时是黄金窗口，尽量每条评论都回复；负面反馈也要具体回应。

## 9. 可选：建一个 GitHub Pages 落地页

当前 About 的 homepage 为空。如果你希望有一个可分享的短链接（`riverzhou.github.io/rustmd`），
可以把 `docs/` 作为 Pages 源，复用 `docs/social-preview.html` 的视觉做一页
“截图 + 下载 + 三个亮点 + GitHub 链接”。注意：落地页要把主要 CTA 指回 GitHub，避免分走 star。
如果暂时不做，保持 homepage 为空即可，不要填一个无关链接。

## 10. 链接汇总

- 仓库：<https://github.com/riverzhou/rustmd>
- 下载：<https://github.com/riverzhou/rustmd/releases/latest>
- Issues：<https://github.com/riverzhou/rustmd/issues>
- Discussions：<https://github.com/riverzhou/rustmd/discussions>
- GitLab 镜像：<http://gitlab.riverzhou.cn/river/rustmd>
- 素材：`docs/demo.gif`、`docs/social-preview.png`、`docs/screenshots/`
