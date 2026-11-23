# rustmd

**本地优先、离线可用的 Markdown / HTML / CSV / TXT / JSON 笔记应用** —— Windows、macOS（Apple Silicon）、Linux。笔记就是普通文件夹里的 `.md` / `.html` / `.csv` / `.txt` / `.json` 文件：不需要导入、没有数据库、不用登录；HTML 笔记直接编辑源码，右侧由**应用内置 WebView** 渲染完整页面，无需外部浏览器；任意笔记都能导出为 **PNG 长图 / 矢量 PDF / 独立 HTML**。

<sub>**English** · Local-first Markdown, HTML, CSV, TXT & JSON notes for Windows, macOS (Apple Silicon) and Linux. Plain files, no account, no cloud lock-in — with PNG / PDF / HTML export. → **[README.en.md](README.en.md)**</sub>

[![CI](https://github.com/riverzhou/rustmd/actions/workflows/ci.yml/badge.svg)](https://github.com/riverzhou/rustmd/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/riverzhou/rustmd?display_name=tag&sort=semver)](https://github.com/riverzhou/rustmd/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/riverzhou/rustmd/total)](https://github.com/riverzhou/rustmd/releases)
[![Rust](https://img.shields.io/badge/Rust-2024-000?logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri)](https://tauri.app/)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/riverzhou/rustmd?style=social)](https://github.com/riverzhou/rustmd/stargazers)

当前版本 **1.12.0** · GPL-3.0-or-later · [更新日志](CHANGELOG.md) · [下载最新版](https://github.com/riverzhou/rustmd/releases/latest)

[![Windows portable](https://img.shields.io/badge/Windows-portable%20zip-0078D6?logo=windows&logoColor=white)](https://github.com/riverzhou/rustmd/releases/latest)
[![Linux .deb / AppImage](https://img.shields.io/badge/Linux-.deb%20%2F%20AppImage-FCC624?logo=linux&logoColor=black)](https://github.com/riverzhou/rustmd/releases/latest)
[![macOS Apple Silicon](https://img.shields.io/badge/macOS-Apple%20Silicon-000000?logo=apple&logoColor=white)](https://github.com/riverzhou/rustmd/releases/latest)

<img src="docs/assets/demo.gif" alt="rustmd 十秒巡览：Markdown 公式与 Mermaid、HTML 笔记整页渲染、CSV/TXT 智能表格、JSON 检查器和深浅色主题" width="880">

<sub>10 秒巡览：Markdown 公式与 Mermaid → HTML 笔记整页渲染 → CSV/TXT 智能表格 → JSON 检查器 → 深浅色主题。</sub>

## 为什么是 rustmd

如果你想要一个**不把笔记锁进数据库、不强制登录、打开就能写**的工具：

- **一份笔记，三种成品**：Markdown、HTML、CSV、TXT、JSON 都能导出为 **PNG 长图、矢量 PDF、独立 HTML**；HTML 笔记整页导出，宽数据表不裁列。不需要 Edge/Chrome，也不需要 Pandoc。
- **HTML 笔记是主角**：直接编辑 `.html`，右侧由内置 WebView 渲染整页；页面样式、脚本、本地图片/CSS/JS 和图表原生执行，预览与导出保持一致——不用把 HTML 塞进 Markdown。
- **五种格式，一个列表**：Markdown（MathJax + Mermaid + 代码高亮）、HTML、CSV、TXT、JSON。CSV/TXT 有智能列宽、数字右对齐和隔行底色，CSV 还能点击表头按数值/日期/文本排序；JSON 是键值分列、可折叠的检查器；搜索同时覆盖标题、文件名、标签和正文。
- **纯文件存储**：笔记就是文件夹里的普通文件，可以用 Git、Syncthing、iCloud、OneDrive 或任何同步工具管理；没有数据库、账号或专有格式。
- **本地优先 + 多库**：核心编辑、预览、搜索、导出全部离线可用；最近笔记库、置顶、多库同开、当前文件夹范围、front matter 标签。
- **小巧轻便**：Windows 绿色包约 **17 MB**，解压即用；Rust + Tauri 2，没有 Electron 运行时。Windows / Linux / macOS（Apple Silicon）都有原生构建。
- **安全边界**：Markdown 消毒、HTML 在 sandbox iframe / 隐藏 WebView 中隔离渲染、CSP、路径封闭、SSRF 防护、导出走原生保存对话框。
- **迁移成本低**：直接打开 Obsidian / Typora / VS Code 使用的文件夹；Markdown front matter 的其他字段原样保留；UTF-8 / GBK / GB18030 自动解码。

适合：个人知识库、技术笔记、写作草稿、课程笔记、HTML 报告与本地文档库。

## 导出：PNG / PDF / HTML

导出不是附属功能，而是 rustmd 的一等能力：**同一份笔记可以变成三种成品，五种格式都支持**。

| 源格式 | PNG | PDF | HTML |
| --- | --- | --- | --- |
| Markdown | ✅ 3× 整页长图（约 288 DPI） | ✅ 矢量文字、A4、页眉页码 | ✅ 独立单文件、内嵌样式与本地图片 |
| HTML | ✅ 整页截图，超长页面分段拼接 | ✅ 隐藏 WebView 按 A4 打印，保留页面排版 | ✅ 源码原样输出 UTF-8，规范化遗留 charset |
| CSV / TXT / JSON | ✅ 按表格自然宽度扩宽，自动降采样 | ✅ 窄表 A4 矢量；宽表自定义宽纸矢量，超宽才栅格 | ✅ 完整数据视图，按浏览器全宽排版 |

- **PNG**：Markdown 通常 3× 渲染（约 288 DPI）；HTML 笔记按页面高度在 1–3× 间自适应，超长报告分段截取并拼接为单图；CSV/TXT/JSON 的离屏舞台按表格自然宽度扩宽，并在宽度、高度和画布总面积三方面自动降采样，右侧列不会被裁掉。远程图片经 Rust 后端拉取并内联，不会出现空白图。
- **PDF**：Markdown、HTML 和数据表都走系统 WebView 的打印管线（Windows：WebView2；macOS：WKWebView；Linux：WebKitGTK）——输出**矢量文字**，可选中、可搜索、任意放大都清晰；A4 排版，由引擎按 CSS 规则分页，文件通常比图片版小一个数量级。打印始终使用浅色配色，深色主题下也是白底深字。Windows 由 WebView2 绘制页眉标题 + 页脚页码；macOS/Linux 打印后由应用补一个居中的「当前页 / 总页数」页脚。HTML 笔记保留自己的排版风格，固定宽度页面会整体缩放以适配纸张。放不进 A4 的数据表会按「表格宽度 + 页边距」申请一张自定义宽纸（宽度随表格，高度保持 A4；上限 55 in，Rust 端钳制到 60 in），打印方向始终保持纵向（portrait），不会把宽纸旋转后重新裁列；表格因此仍按真实文字排版。打印字号固定为屏幕上的 13 px，`vw` 不会把按测量值设定的列宽撑出纸面；页眉、页脚和页码在宽纸上照常工作。只有超过该上限的超宽表才回退为栅格 PDF，超长表格的回退按行分页（每页 3× 正常比例、自带表头）。某个平台或环境不支持原生打印时，回退为按块边界分页的无损 PNG 切片。
- **HTML**：Markdown 导出为内嵌样式、跟随当前主题、本地图片内联的独立页面；CSV/TXT/JSON 导出保留智能列宽、隔行底色/列文字色和 JSON 检查器样式，并使用整个浏览器宽度；HTML 笔记按源码输出 UTF-8 独立文件，规范化遗留的 `<meta charset="gbk">`（相对 CSS/JS/图片不会随文件复制）。数据 HTML 导出保留完整内容。
- **零外部依赖**：不需要安装 Edge/Chrome，也不需要 Pandoc/LaTeX；预览、截图、打印都在应用内置的 WebView 中完成。导出目标由系统保存对话框选择，前端不能任意写文件。
- **一致的边界**：HTML 笔记的预览在 sandbox iframe 中运行，导出在隐藏的独立 Tauri WebView 中执行；笔记脚本拿不到应用命令，导出窗口只能回传截图或打印就绪信号。

## 和其他工具比

对比对象是常见的本地笔记/编辑器：Obsidian、Typora、VS Code、Notepad++、Zettlr 和 Joplin。Joplin 用本地数据库而不是纯文件，但它是本地优先笔记的主要替代品，所以一并列出；Notion / Evernote 这类纯云笔记没有本地文件夹，不在比较范围内。

| 能力 | **rustmd** | Obsidian | Typora | VS Code | Notepad++ | Zettlr | Joplin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 存储 | 文件 | 文件 | 文件 | 文件 | 文件 | 文件 | 数据库 |
| Windows 包 | **≈17 MB**¹ | ≈324 MB | ≈114 MB | ≈289 MB | ≈7 MB | ≈159 MB | ≈352 MB |
| 打开文件夹 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ 导入 |
| HTML 笔记预览 | ✅ 内置 | ❌ | ❌ | ⚠️ 扩展 | ❌ | ❌ | ❌ |
| 数据视图 | ✅ | ❌ | ❌ | ⚠️ 部分 | ❌ | ❌ | ❌ |
| **PNG/PDF/HTML 导出** | **✅ 5 种** | ⚠️ 仅 PDF | ✅ 仅 MD | ⚠️ 扩展 | ❌ | ⚠️ PDF/HTML | ⚠️ PDF/HTML |
| 公式/Mermaid | ✅ | ✅ | ✅ | ⚠️ 扩展 | ❌ | ✅ | ✅ |
| 多库 | ✅ | ⚠️ | ❌ | ✅ | ⚠️ | ✅ | ❌ |
| 离线无账号 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 开源 | ✅ GPL-3.0 | ❌ | ❌ | ✅ MIT² | ✅ GPL | ✅ GPL-3.0 | ✅ AGPL-3.0 |
| 价格 | 免费 | 免费* | $14.99 | 免费 | 免费 | 免费 | 免费* |
| 桌面平台 | 三端³ | 三端 | 三端 | 三端 + Web | 仅 Win | 三端 | 三端 |

> 对比基于 2026 年 11 月的公开信息与各工具官方文档，只列与本项目定位相关的维度；各工具都在持续更新，以官方说明为准。`✅` 原生支持；`⚠️` 需要扩展/插件、仅部分能力或需额外依赖；`❌` 不支持。
>
> ¹ Windows x64 官方安装包 / 便携包，单位为 MB，只表示量级；rustmd 为 17 MB 绿色 zip（解压后 exe 约 19 MB）。² VS Code 源码为 MIT，微软发行版另附许可。³ 三端 = Windows / macOS / Linux；rustmd 的 macOS 版仅支持 Apple Silicon（arm64）。* Obsidian 的 Sync/Publish 与 Joplin Cloud 为付费附加服务；Typora 为 $14.99 一次性许可。`⚠️` 在多库行表示多窗口 / 多实例，而不是单窗口汇总。
>
> 数据视图 = CSV/TXT/JSON 的原生表格 / 检查器；HTML 笔记 = 直接编辑 `.html` 源码并整页渲染。

**rustmd 的差异不是“能导出”，而是“五种格式都能导出，HTML 笔记也能整页导出”**：Typora 的三种导出只针对 Markdown；Obsidian 原生只有 PDF；VS Code 依赖扩展；Zettlr 依赖 Pandoc/LaTeX；Joplin 有 PDF/HTML 但没有 PNG。

### 为什么能这么小

rustmd 不打包 Chromium：它复用系统 WebView（Windows WebView2、macOS WKWebView、Linux WebKitGTK），只带应用本身。代价是需要系统运行时——Windows 的 WebView2 通常已自带，Linux 需要 GTK 3 + WebKitGTK 4.1；换来的是约 14 MB 的 Windows 绿色包（v1.11.2 资产 13,901,415 B）。Linux 的 deb 约 11.7 MB（11,731,458 B），macOS DMG 约 18 MB（17,956,215 B）；AppImage 因为自带 WebKitGTK 约 95 MB（94,992,888 B）。

### rustmd 不做什么

没有移动端、没有插件市场、没有内置云同步、没有数据库。需要这些时，Obsidian（插件/移动端）、VS Code（扩展）、Joplin（移动端/同步）更合适；rustmd 只把「打开文件夹 → 写 → 导出」这条路径做短。

## 截图

主界面：文件夹树、当前文件夹范围与多库开关、文件名卡片、排序方向、**MD / HTML / CSV / TXT / JSON 格式徽标**、MathJax 公式与 Mermaid 图表。

<img src="docs/assets/screenshots/overview.png" alt="rustmd 主界面：左侧当前文件夹范围与多库开关、文件夹树与带格式徽标的文件名卡片，右侧 CodeMirror 编辑器和实时预览（MathJax 公式 + Mermaid 图表）" width="880">

深色主题与侧栏细节：

<img src="docs/assets/screenshots/dark.png" alt="rustmd 深色主题：全格式徽标、MathJax 公式、Mermaid 图表和实时预览" width="880">

<img src="docs/assets/screenshots/sidebar.png" alt="rustmd 侧栏：搜索框、包含子文件夹与多库开关、可拖动分隔条、左栏宽度手柄、全部/文件夹树、排序按钮、带格式徽标的文件名和标签" width="336">

多库同开（置顶库与当前库汇总，文件夹树按库分组）：

<img src="docs/assets/screenshots/multi-vault.png" alt="rustmd 多库同开：侧栏按笔记库分组显示文件夹树，笔记列表汇总两个库的文件并带库名徽标，侧栏多库按钮显示已打开 2 个库" width="880">

最近笔记库一键切换：

<img src="docs/assets/screenshots/vault-switcher.png" alt="rustmd 最近笔记库切换：置顶库显示在最上方，当前目录标记为“当前”，每个目录都有置顶和移除按钮" width="560">

## 不同格式的渲染

HTML 笔记由内置 WebView 整页渲染，支持页面自带的样式、脚本、本地相对资源和图表：

<img src="docs/assets/screenshots/html-note.png" alt="rustmd 内置 WebView 渲染 HTML 笔记：左侧 HTML 源码，右侧完整页面效果" width="880">

CSV 表格：短列和数字列按内容收紧，长文本列按内容放宽到 64 字符上限；数字右对齐、表头与内容一致、隔行底色 + 按列文字色。截图里已点表头按「数量」升序，右侧出现「原始顺序」复位按钮：

<img src="docs/assets/screenshots/csv-note.png" alt="rustmd CSV 表格预览：智能列宽、数字右对齐、表头与数据同列对齐、隔行底色和按列文字色；已按数量升序排序并显示原始顺序复位按钮" width="880">

TXT：制表符分列对齐，保留空格，区分数据行与整行说明文字：

<img src="docs/assets/screenshots/txt-note.png" alt="rustmd TXT 制表符对齐预览：列对齐、行底色和按列文字色" width="880">

JSON 检查器（浅色 / 深色）：键值分列、分组语义色、类型标签与类型圆点、可折叠；左侧始终保留原始 JSON：

<img src="docs/assets/screenshots/json-note.png" alt="rustmd JSON 检查器浅色：键值列、对象/数组分组、类型标签和可折叠视图" width="880">

<img src="docs/assets/screenshots/json-note-dark.png" alt="rustmd JSON 检查器深色：语义色、类型标签和可折叠分组" width="880">

## 多语言界面

首次启动**跟随系统语言**：中文系统显示简体中文，其他系统默认英文。主界面侧栏顶部和首次启动的选择目录页都有语言选择器，可随时切换 **English / 简体中文**；选择会保存在本地，下次启动继续使用。切换后文件树、笔记列表、排序、状态栏、对话框、导出菜单和错误提示会立即更新。

英文界面示例：

<img src="docs/assets/screenshots/overview.en.png" alt="rustmd English interface with language selector and markdown preview" width="880">

## 功能

> 导出（PNG / PDF / HTML）已在上文单独展开；下面按多语言、导航、搜索、编辑预览和安全分组。

### 多语言

- 中文 / English 两套界面；首次启动根据系统语言自动选择。
- 语言选择器位于主界面侧栏顶部（首次启动时也显示在目录选择页），选择持久化到本地。
- 切换后不重载笔记、不丢失编辑内容；排序、状态、对话框和导出文案同步更新。

### 文件导航

- **快速切换笔记库**：侧栏切换按钮直接列出最近打开的目录（按最近使用排序，最多 20 个，
  当前目录带标记）。每个目录右侧的图钉可“钉死/置顶”：置顶库固定在列表最上方，
  且永远不会被淘汰。点一下即可切换；需要新目录时“浏览其他目录…”会从当前目录开始。
- **多库同开**：搜索框下方的“多库”按钮会同时打开所有置顶库（加上当前库），
  笔记汇总在同一个列表中；文件夹树按库分组，各库的子目录可以独立选择。
  库根节点和各级子目录都可以折叠/展开，折叠状态会记住。
  再次点击按钮恢复单库视图，当前打开笔记所在的库不会被关闭。
- **手动刷新**：侧栏顶部的刷新按钮从磁盘重新扫描整个笔记库（笔记、文件夹、标签、
  搜索与计数），无需重启；打开中的笔记被外部修改且没有未保存内容时会自动重新
  载入，被删除时安全关闭或保留未保存内容。
- **可调侧栏内部高度**：侧栏默认 320px，文件夹/标签区按内容自适应，下方笔记列表占满剩余高度；两者之间有一条可拖动分隔条，拖动可随时调整，双击/Enter 恢复默认，高度会记住。
- **宽度可调 + 一键恢复**：拖动左侧栏右缘调整导航宽度（默认 320px，最小 220px，按视口自适应，4K 最大 680px）；拖动编辑/预览分隔条调整分屏比例（20%–80%，默认 50/50）。顶栏新增“恢复默认布局宽度”按钮，一键回到 320px + 50/50；两个偏好都保存在本地。
- **默认只看当前文件夹**：笔记列表、搜索、文件夹计数和标签云默认只覆盖当前文件夹（启动时是笔记库根目录）的直属笔记，不进入子文件夹；打开搜索框下方的“包含子文件夹”开关后才递归整个子树，开关状态会记住。
- **文件夹树**：支持嵌套文件夹、空文件夹、折叠/展开。
- **子文件夹默认折叠**：只显示顶层文件夹，点击箭头逐层展开；展开状态会记住。
- **两种排序 + 方向**：可按最后修改时间或文件名排序，通过 `↑` / `↓` 按钮切换升序/降序；选择持久化。
- **文件名卡片**：每张笔记卡片显示标题、**文件名**、摘要、所在文件夹、修改时间与标签，同名笔记也容易区分。

### 搜索

- 同时搜索**标题、文件名、标签、正文**；大小写不敏感。搜索默认只覆盖当前文件夹的直属笔记，打开“包含子文件夹”后递归整个子树。HTML 笔记搜索的是页面可见文本，不会把标签、脚本或样式当作正文命中；CSV/TXT/JSON 搜索解码后的纯文本。
- 结果列表高亮命中片段，并显示是标题、文件名还是标签命中。
- 输入防抖 + 请求序列号，快速输入时旧结果不会覆盖新结果。

### 编辑与预览

- CodeMirror 6 编辑器，按文件类型切换 Markdown / HTML / JSON 语法高亮（HTML 标签、属性、属性值有独立配色；`<script>` / `<style>` 内的 JS/CSS 也按关键字、字符串、函数、变量、注释等分别着色；CSV/TXT 使用纯文本模式）。
- 编辑器支持 **自动折行 / 不折行** 切换，状态会记住；长行/宽表格可一键切换。
- 右上角 **全屏** 按钮与 `F11` 快捷键可切换全屏，退出后回到窗口模式。
- 编辑 / 分栏 / 预览三种视图（`Ctrl+1` / `Ctrl+2` / `Ctrl+3`），分栏可拖动，比例持久化。
- 500ms 防抖自动保存；外部修改通过内容 hash 检测，覆盖前会询问。
- 保存后更新文件树与标签计数；保存失败保留“未保存”状态，切换或关闭前提示。

### Markdown 渲染

- GFM：表格、任务列表、删除线、自动链接。
- 代码高亮（highlight.js）。
- **Mermaid** 图表：流程图、时序图、类图、甘特图、状态图、饼图、ER 图等。
- **MathJax 4**：行内 / 块级 LaTeX、矩阵、align、cases；MathJax 与扩展都打包在应用内，离线可用。
- `<details>` / `<summary>` 折叠块。
- 笔记库本地图片：相对路径、`./`、`file:///`、绝对路径、`<img>` 均可显示。

### HTML 笔记

- 笔记库中的 `.html` / `.htm` 文件会和 Markdown 一起出现在文件夹树、笔记列表、搜索结果和文件夹计数中。**所有支持的格式在列表和顶栏都有一致醒目的格式徽标：`MD`（绿）/ `HTML`（蓝）/ `CSV`（橙）/ `TXT`（灰）/ `JSON`（紫）**，一眼即可区分。
- 左侧编辑 HTML 源码，右侧用应用内置 WebView（Windows 的 WebView2 / Linux 的 WebKitGTK / macOS 的 WKWebView）直接整页渲染；无需安装 Edge、Chrome 或任何外部浏览器。页面自带的 `<style>`、`<script>`、本地相对 CSS/JS/字体/图片、ECharts 图表都会执行，滚动/缩放为原生清晰文本。`<title>` 或第一个 `<h1>` 作为列表标题，文件名仍可见。
- 顶部新建按钮提供 **Markdown 笔记 / HTML 页面 / CSV 表格 / 纯文本文件 / JSON 文件**；重命名、移动、删除、手动刷新和 PNG / PDF / HTML 导出与 Markdown 笔记一致。
- HTML 笔记没有 front matter，因此不显示标签编辑器；保存时不会插入 `---` 或 `tags:`，并保留文件原有的 BOM 与 CRLF/LF 换行风格。
- 预览在 **sandbox iframe** 中运行（无 `allow-same-origin`，origin 为 null），拿不到父页面 DOM/Tauri IPC；导出在隐藏的独立 Tauri WebView 窗口中执行，所有笔记/保险库命令按窗口 label 校验，隐藏窗口只能回传截图或通知打印就绪。渲染失败时才回退为 DOMPurify 消毒后的静态预览。
- 图表页面通常依赖 CDN 脚本，首次渲染/导出需要联网；HTML 笔记的 PNG / PDF / HTML 导出细节见上文「导出：PNG / PDF / HTML」——HTML 导出按源码输出 UTF-8，PNG 整页截图，PDF 在隐藏 WebView 里按 A4 矢量打印。

### CSV / TXT / JSON 数据预览

- `.csv` / `.txt` / `.json` 与 Markdown、HTML 一起出现在文件夹树、笔记列表、搜索结果和文件夹计数中，并带 **CSV（橙）/ TXT（灰）/ JSON（紫）** 徽标。
- **CSV 表格**：识别逗号 / 制表符 / 分号 / 竖线分隔符，支持带引号字段、字段内换行和双引号转义；首行作为表头。列宽按内容智能分配：数字、日期、布尔和短文本列收紧，长文本列按内容放宽到 64 字符上限（不强制分配剩余宽度）；对齐算法识别数字、日期、货币和布尔值，表头与数据格使用同一对齐方式。外观上用隔行底色负责横向扫读、按列文字色负责纵向定位，再加细分隔线和悬停高亮；列多时横向滚动。**点击表头即可排序**：升序 → 降序 → 恢复原文顺序三态循环，数值/日期/布尔列按值比较、文字列按本地化自然顺序，空值始终排在最后；排序只重排预览里的行，不会改写编辑器或磁盘上的原文。排序期间表头旁会出现「原始顺序」按钮，一键回到 CSV 的原始行顺序。**HTML / PNG / PDF 三种导出都会按当前排序后的顺序生成**，导出的仍是静态表格，不会带上排序按钮；导出不会把排序写回 CSV 文件。
- **TXT 制表符对齐**：按制表符拆成对齐的列，保留行内空格；无制表符的行按整行显示，自动跳过前置说明行。仅当第一行多列全是文本、且后续行含数字/日期/布尔时才作为表头；含数值的首行（如股票信号）按数据行处理，不会误加粗。等宽字体、数字列右对齐，配合智能列宽、隔行底色和按列文字色让纯文本也容易阅读。
- **JSON 检查器**：展示根类型、键/项数量、节点数，可折叠的对象/数组分组，键与值分列对齐，对象/数组分组带语义色浅底、侧边轨和同色系类型标签，字符串/数字/布尔/null 各有独立色彩与类型圆点；非法 JSON 显示错误与原文，便于继续编辑。
- **完整数据视图**：CSV/TXT/JSON 不再截断行、列或节点。数据视图自动使用预览区宽度（4K 在 200% 缩放下 CSS 视口约为 1920×1080），能展开更多列；窄表仍按内容收缩、不强制铺满；宽表在表格上方和下方各有一条同步横向滚动条；空间充足时 18 行以上的表格会把多余高度均分给行高，长表在卡片内滚动并保持表头可见。
- **自动编码识别**：读取时按 BOM → UTF-8 → GBK → GB18030 自动解码，状态栏显示当前编码；合法的 UTF-8 始终优先。GBK 字节序列极少数情况下也会构成合法 UTF-8（约 1920 个常用汉字的组合），这类有歧义的短文件会按 UTF-8 读取；如遇乱码，请先在外部转换为 UTF-8。保存时沿用原编码和 BOM；如果向 GBK 文件写入 GB18030 可表示的四字节字符（例如 emoji），会兼容升级为 GB18030，并在保存后同步状态栏。重复的 UTF-8 BOM 会在读取时归一化，不会在连续保存中累积。
- 单篇笔记的读取上限为 **64 MB**：超限文件仍会按文件名出现在列表里并提示过大，但不会加载正文（避免不可信的笔记库用超大文件卡死界面）；正常规模的 CSV/TXT/JSON 不设行/列显示上限。
- 数据笔记没有 front matter，因此不显示标签编辑器；重命名保留扩展名，新建菜单也支持这三种格式。

### 安全

- Markdown 渲染出的 HTML 在进入 webview 前经 DOMPurify 消毒；脚本、事件属性、`javascript:` URL、`<style>`、`<iframe>` 等被剥离。HTML 笔记预览在 sandbox iframe（null origin）中运行，导出在隐藏 WebView 中运行；预览 iframe 无法调用应用命令，导出窗口只能回传截图或打印就绪信号。
- MathJax / Mermaid 在消毒之后生成 DOM，再做一次窄范围清理（`on*`、危险链接、外部 CSS URL）。
- Tauri CSP 默认启用；外部链接交给系统浏览器打开。HTML 预览/导出在隔离的 WebView 中运行，导出窗口只能回传截图或打印就绪信号。
- `resolve_in_root` 对笔记与图片做路径封闭，阻止 `..`、junction/symlink 写逃逸；扫描时跳过符号链接。
- 远程图片抓取拒绝 loopback / 私有网段 / 链路本地 / 保留地址，并校验每次重定向。
- 保存使用临时文件 + 原子替换；`baseHash` 冲突检测避免静默覆盖外部修改。
- 文本笔记自动识别 UTF-8 / GBK / GB18030；保存沿用原编码（GBK 遇到四字节字符时升级为 GB18030）。有歧义的短 GBK 字节会按合法 UTF-8 解释，这是编码检测的残余边界；无法识别的编码不会被静默隐藏，打开时显示明确错误。CSV/TXT/JSON 预览全部使用 DOM `textContent` 构建，不执行笔记内容中的 HTML。
- HTML 笔记的相对 CSS/JS 会内联进预览/导出文档，图片内联为 data URL，字体走 `rmd`；`rmd` 只对无法内联的 classic script/style/font 子资源放行预览源，`fetch`/XHR 与文档读取仍返回 403。

## 下载与安装

从 [GitHub Releases](https://github.com/riverzhou/rustmd/releases/latest) 下载：

| 平台 | 产物 | 说明 |
| --- | --- | --- |
| Windows | `rustmd-<version>-win-x64-portable.zip` | **绿色版**：解压后直接运行 `rustmd.exe`，不写注册表 |
| Linux | `rustmd_<version>_amd64.deb` / `rustmd_<version>_amd64.AppImage` | Debian/Ubuntu 安装包 / 便携 AppImage；需要 Ubuntu 24.04+（glibc ≥ 2.39） |
| macOS | `rustmd-<version>-macos-arm64.dmg` | 仅 Apple Silicon（arm64）；不支持 Intel Mac |

Windows / macOS 资产旁提供 `.sha256`；Linux 提供 `SHA256SUMS-linux.txt`；Release 里还有合并的 `SHA256SUMS.txt`（需要全部资产在同一目录才能校验）。只下载单平台时请用对应平台的校验文件。

最近已发布的 v1.11.2 资产体积：Windows zip 13,901,415 B（约 13.3 MiB / 14 MB）；macOS DMG 17,956,215 B（约 17.1 MiB / 18 MB）；Linux deb 11,731,458 B（约 11.7 MB）；AppImage 94,992,888 B（约 95 MB）。解压后的 `rustmd.exe` 约 19 MB。

### Windows

1. 解压 zip，运行 `rustmd.exe`。
2. 需要 **WebView2 Runtime**；Windows 10/11 通常已自带，缺失时安装 Evergreen Runtime。
3. 发布包使用自签名证书做完整性签名（压缩包内附 `rustmd-selfsigned.cer`）；它**不能消除** SmartScreen 的“未知发布者”提示。请核对来源与 SHA256 后选择“仍要运行”。
4. 绿色版不写安装信息；删除文件夹即可移除程序。

### Linux

```bash
# Debian / Ubuntu
sudo apt install ./rustmd_<version>_amd64.deb

# AppImage
chmod +x rustmd_<version>_amd64.AppImage
./rustmd_<version>_amd64.AppImage
```

AppImage 需要 FUSE；没有 FUSE 时使用 `--appimage-extract-and-run`。

1.10.5 起 Linux 发布包在 **Ubuntu 26.04** 上构建，运行基线为 Ubuntu 24.04+ /
glibc 2.39，并需要 GTK 3 与 WebKitGTK 4.1 运行库。仍在使用 Ubuntu 22.04 的用户
请保留 1.10.4，或按 [docs/LINUX_BUILD.md](docs/LINUX_BUILD.md) 从源码构建。

应用使用 GTK 3，启动时自动适配 Wayland 与 X11/XWayland，无需手动设置
`GDK_BACKEND`；CI 另有非阻塞的 Wayland headless smoke。

### macOS

macOS 包仅支持 **Apple Silicon（arm64，M 系列）**，不支持 Intel Mac。DMG 内的 `.app` 使用 **ad-hoc 签名**（没有 Apple Developer ID，未公证）。首次打开会被 Gatekeeper 拦截：

- 系统设置 → 隐私与安全性 → “仍要打开”；或
- `xattr -dr com.apple.quarantine /Applications/rustmd.app`

彻底消除提示需要 Developer ID + 公证（见 [docs/RELEASING.md](docs/RELEASING.md)）。

### 包管理器

Windows（Scoop，自建 bucket）：

```powershell
scoop bucket add riverzhou https://github.com/riverzhou/scoop-bucket
scoop install rustmd
```

macOS（Homebrew，Apple Silicon）：

```bash
brew tap riverzhou/tap
brew install --cask rustmd
```

winget 清单（1.11.1）已作为 PR [#486380](https://github.com/microsoft/winget-pkgs/pull/486380) 提交，等待 moderator 审核，通过后会补上 `winget install` 一行；AUR 清单已就绪，待有 AUR 账号后提交。Scoop（自建 bucket）与 Homebrew（`riverzhou/tap`）已发布 1.11.1 清单，可直接安装。1.11.2 仅整理仓库与发布工具链、应用代码未变，包管理器清单继续指向 1.11.1（功能相同）。细节见 [packaging/](packaging/README.md)。

### 校验下载

```bash
# Windows PowerShell：计算并对照同目录的 .sha256
(Get-FileHash .\rustmd-<version>-win-x64-portable.zip -Algorithm SHA256).Hash
Get-Content .\rustmd-<version>-win-x64-portable.zip.sha256

# macOS
shasum -a 256 -c rustmd-<version>-macos-arm64.dmg.sha256

# Linux
sha256sum -c SHA256SUMS-linux.txt

# 合并文件需要先把全部 Release 资产下载到同一目录：
sha256sum -c SHA256SUMS.txt
```

## 快速开始

1. 启动应用，选择或输入笔记目录；也可以直接打开已有的 Markdown 文件夹。再次启动会打开上次的笔记库，侧栏切换按钮可一键回到最近目录。
2. 左侧 `＋` 新建笔记；点击文件夹筛选，点击箭头展开子文件夹。列表默认只看该层笔记，点击搜索框下方的“包含子文件夹”可包含整个子树。
3. 标题输入框可重命名文件；标签、移动、删除、导出在顶栏。
4. 顶栏按钮或 `Ctrl+B` 隐藏/显示侧栏。

常用快捷键：

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | 编辑 / 分栏 / 预览 |
| `Ctrl+B` | 隐藏 / 显示侧栏 |
| `F11` | 全屏 / 退出全屏 |
| `Enter`（标题框） | 提交重命名 |
| `Enter` 或 `,`（标签框） | 添加标签 |

浏览器前端调试（不需要 Rust）：

```bash
npm install
npm run dev          # http://127.0.0.1:5173，使用内存 mock 数据
```

## 开发

前置：Node.js `^20.19.0 || >=22.12.0`（Vite 8 要求）、Rust stable（含 `rustfmt`、`clippy`）以及对应平台的 Tauri 系统依赖（Linux 见 [docs/TESTING.md](docs/TESTING.md)）。

Linux 从源码构建、依赖安装、绿色版打包与无 root sysroot 兜底见 [docs/LINUX_BUILD.md](docs/LINUX_BUILD.md)；构建后可运行 `scripts/release/linux-headless-smoke.sh` 在隔离 Xvfb 中冒烟测试 release 二进制。

| 任务 | 命令 |
| --- | --- |
| 全部检查 | `npm run check` |
| Tauri 开发窗口 | `node scripts/dev/launch-dev.mjs`（Windows 可用 `scripts\dev\run-dev.bat`） |
| 仅前端（mock） | `npm run dev` |
| 发布 exe（不打包安装器） | `npx tauri build --no-bundle`（Windows 可用 `scripts\release\run-build.bat`） |
| 前端纯函数单测 | `npm run test:unit`（73 个） |
| Rust 单测 | `npm run test:rust`（`cargo test --workspace`；99 个 Windows / 100 个 Linux、macOS，1 个网络测试默认忽略） |
| 端到端自测 | `npm run selftest` / `npm run selftest:check` |
| 重新生成图标 | `npm run icons` |

`scripts/lib/cargo.mjs` 会依次尝试 `$CARGO`、`~/.cargo/bin/cargo`、PATH 中的 `cargo`；Windows git-bash 不需要手动补 PATH。

### 自动化检查

`npm run check` 依次执行：

1. ESLint 10
2. Node 前端单测（73 个：排序、文件夹树、当前目录/子树范围、范围标签计数、最近笔记库、CSV/TXT/JSON 解析与对齐、CSV 表头排序与导出序列化、数学保护、代码段、多语言）
3. 仓库检查（`npm run check:repo`：文档链接、版本横幅、CSP、插件权限、图标、机器相关路径、`dist` 未跟踪）
4. 许可边界（`npm run check:license`：可复用层不含 Tauri 依赖/引用，且每个源文件都有 SPDX 头）
5. 打包清单检查（`npm run check:packaging`：winget / Scoop / Homebrew / AUR 的版本、资产名、URL 与 SHA256 互相一致）
6. 版本检查（`package.json` / `Cargo.toml` / `tauri.conf.json` / `crates/rustmd-core` 与两个 lockfile 的版本一致）
7. `cargo fmt --check`、`cargo clippy --workspace --all-targets -- -D warnings`、`cargo test --workspace`
8. Vite 生产构建

CI：[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 在 Ubuntu 跑完整质量门禁，在 Windows / Linux / macOS 三端编译，并用 Xvfb + 真实 WebKitGTK 跑端到端自测。

### 端到端自测

```bash
npm run selftest
```

dev 窗口会渲染 `examples/` 下全部 10 篇示例笔记（含 Markdown、HTML、CSV、TXT、JSON 与 GBK CSV），逐一导出 PNG/PDF 和 HTML。Markdown 校验残留未渲染公式、多行公式几何、远程图片与笔记库本地图片是否真的出现在导出的 PNG 中（2D NCC）；HTML 校验内置 WebView 的 iframe 是否 ready、本地相对 CSS/JS/图片与内联脚本；数据笔记校验表格/JSON 检查器结构、智能表头对齐、CSV 表头排序三态循环与导出静态表、HTML 文本不注入 DOM、数据 HTML 导出及 charset；GBK 示例断言编码识别。产物与 `report.json` 写入系统临时目录的 `rustmd-selftest/`，可用 `RUSTMD_SELFTEST_OUT` 覆盖；`npm run selftest:check` 默认要求 HTML、CSV、TXT、JSON 全覆盖（脚本已带 `--require-html --require-data`）。代码位于 `frontend/src/selftest.js`，release 构建不包含它。

## 目录结构

```
├── src/main.rs               # Tauri 层（GPL-3.0-or-later）：23 个 IPC 命令、打印、窗口、自测
├── crates/rustmd-core/       # 平台无关引擎（MIT OR Apache-2.0）：路径、front matter、编码、扫描
├── frontend/                 # Vite 前端：index/mathlab/vite.config + src（main/api/export/selftest/shared）
├── scripts/                  # checks/ 校验、dev/ 开发自测截图、lib/ 工具、release/ 打包签名
├── packaging/                # winget / Scoop / AUR / Homebrew 清单
├── examples/                 # 10 篇示例笔记（含 CSV/TXT/JSON/GBK），同时是自测夹具
├── docs/                     # 架构、测试、发布、安全、许可、目录规范
│   ├── assets/               # README 截图、demo.gif、社交预览与对比海报
│   └── marketing/            # GitHub About 文案与推广手册
├── release-notes/            # 每个版本一份 RELEASE_NOTES-<version>.md
├── LICENSES/                 # MIT.txt / Apache-2.0.txt（可复用层双许可全文）
├── capabilities/ gen/ icons/ # Tauri 权限、代码生成、应用图标
├── .github/                  # CI、三端发布、issue/PR 模板
├── tauri.conf.json
├── Cargo.toml
└── package.json
```

## 三端发布

发布由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 完成：

- 推 `v*` tag（或手动填 tag）触发；
- Windows：绿色 zip + 自签名 Authenticode（可选真实 PFX secrets）；
- Linux：deb + AppImage + SHA256；
- macOS：Apple Silicon（arm64）DMG + ad-hoc 签名；
- 所有资产汇总 `SHA256SUMS.txt` 并创建 GitHub Release。

签名策略与 secrets 配置见 [docs/RELEASING.md](docs/RELEASING.md)。

## 常见问题

**Q：rustmd 开源吗？**
是，应用本体采用 **GPL-3.0-or-later**。你可以自由使用、修改和分发；衍生作品需按 GPL 兼容方式开源。另有两个可复用层——`crates/rustmd-core`（平台无关引擎）与 `frontend/src/shared`（渲染栈）——采用 **MIT OR Apache-2.0** 双许可，可以单独拿去用；边界与规则见 [LICENSE](LICENSE) 与 [docs/LICENSING.md](docs/LICENSING.md)。

**Q：支持同步吗？**
应用本身不做云同步。笔记是普通文件夹，交给 Syncthing、Git、iCloud、OneDrive、Dropbox 等即可。

**Q：能打开 Obsidian 的 vault 吗？**
可以打开普通 `.md` / `.html` / `.csv` / `.txt` / `.json` 文件夹，文件夹层级和 Markdown front matter 标签可用。HTML 笔记按文件扩展名识别，编辑源码并由应用内置 WebView 渲染整页预览。Obsidian 特有的 `[[wikilink]]`、插件、canvas 等不在支持范围内；保存 Markdown 时其它 front matter 字段会保留。

**Q：导出 PNG / PDF / HTML 需要安装浏览器或 Pandoc 吗？**
不需要。PNG 和 PDF 都由应用内置的系统 WebView 完成（Windows WebView2 / macOS WKWebView / Linux WebKitGTK），PDF 是矢量文字；HTML 导出由应用直接生成独立文件。HTML 笔记里的 CDN 脚本/图表仍需联网，和在应用内预览时一样。

**Q：为什么 Windows 会提示未知发布者 / macOS 会提示无法验证？**
Windows 使用自签名证书、macOS 使用 ad-hoc 签名，只保证完整性，没有购买商业代码签名/公证。校验 SHA256 后按系统提示放行即可。

**Q：支持移动端吗？**
当前只提供 Windows / macOS / Linux 桌面端。macOS 构建仅支持 Apple Silicon（arm64），不支持 Intel Mac。

**Q：笔记存在哪里？**
只存在你打开的文件夹里；应用没有数据库、没有账号、不会上传笔记。

**Q：如何反馈问题或贡献代码？**
欢迎提 [Issue](https://github.com/riverzhou/rustmd/issues) 或 PR。提交前请跑 `npm run check`；如果是渲染/导出问题，附上 `npm run selftest` 的 report 会很有帮助。

## 文档

- [Architecture / 架构](docs/ARCHITECTURE.md)
- [Testing & CI / 测试](docs/TESTING.md)
- [Release & Signing / 发布签名](docs/RELEASING.md)
- [Security / 安全](docs/SECURITY.md)
- [Licensing / 分层许可](docs/LICENSING.md)
- [Changelog / 更新日志](CHANGELOG.md)
- [Audit Report / 审计报告](docs/AUDIT_REPORT.md)
- [Developer & Agent Guide / 开发指南](AGENTS.md)
- [Repository layout & conventions / 目录结构与命名规范](docs/CONVENTIONS.md)
- [Scripts index / 脚本索引](scripts/README.md)
- [GitHub 项目文案与 topics](docs/marketing/GITHUB_PROJECT_COPY.md)
- [推广与增长手册](docs/marketing/PROMOTION.md)
- [包管理器清单（winget / Scoop / AUR / Homebrew）](packaging/README.md)
- [贡献指南](CONTRIBUTING.md)

## License

rustmd 应用本体以 **GPL-3.0-or-later** 发布，完整条款见 [LICENSE](LICENSE)。`crates/rustmd-core`（平台无关引擎）与 `frontend/src/shared`（渲染栈 + 编辑器）是两个可独立复用的层，采用 **MIT OR Apache-2.0** 双许可；分层边界与贡献规则见 [docs/LICENSING.md](docs/LICENSING.md)。

## 支持项目

如果 rustmd 对你有帮助，给一个 ⭐ 是最直接的鼓励；也欢迎分享给需要本地 Markdown 笔记的朋友。

**关键词**：Markdown 笔记、HTML 笔记、HTML 编辑器、HTML 网页预览、内置 WebView、HTML 报告、CSV 表格、TXT 文本、JSON 查看器、GBK 编码、本地笔记、离线笔记、Markdown 编辑器、最近笔记库切换、置顶笔记库、多库同开、知识库、Obsidian 替代、Typora 替代、Joplin 替代、Zettlr 替代、Tauri、Rust、Mermaid 图表、LaTeX 公式、PNG 导出、PDF 导出、HTML 导出、矢量 PDF、小巧轻量、Windows 绿色版、macOS、Linux。
