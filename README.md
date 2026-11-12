# rustmd

**Local-first Markdown and HTML notes for Windows, macOS and Linux.** Plain `.md` / `.html` files, no account, no cloud lock-in — a lightweight desktop notes app built with **Rust + Tauri 2**.

**本地优先、离线可用的 Markdown / HTML 笔记应用**：文件夹树、文件名卡片、全文搜索、Mermaid 图表、LaTeX 公式、HTML / PNG / PDF 导出；一个笔记库就是一个普通文件夹。

[English](README.en.md) · [简体中文](README.md)

[![CI](https://github.com/riverzhou/rustmd/actions/workflows/ci.yml/badge.svg)](https://github.com/riverzhou/rustmd/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/riverzhou/rustmd?display_name=tag&sort=semver)](https://github.com/riverzhou/rustmd/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/riverzhou/rustmd/total)](https://github.com/riverzhou/rustmd/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-4f6df5)](#下载与安装)
[![Rust](https://img.shields.io/badge/Rust-2024-000?logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri)](https://tauri.app/)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/riverzhou/rustmd?style=social)](https://github.com/riverzhou/rustmd/stargazers)

当前版本 **1.4.2** · GPL-3.0-or-later · [更新日志](CHANGELOG.md) · [下载最新版](https://github.com/riverzhou/rustmd/releases/latest)

## 截图

主界面：文件夹树、文件名卡片、排序方向、MathJax 公式与 Mermaid 图表。

<img src="docs/screenshots/overview.png" alt="rustmd 主界面：左侧文件夹树与文件名卡片，右侧 CodeMirror 编辑器和实时预览" width="880">

深色主题与侧栏细节：

<img src="docs/screenshots/dark.png" alt="rustmd 深色主题：MathJax 公式、Mermaid 图表和实时预览" width="880">

<img src="docs/screenshots/sidebar.png" alt="rustmd 侧栏：全部/文件夹树、排序按钮、文件名、标签和搜索" width="300">

## 多语言界面

首次启动**跟随系统语言**：中文系统显示简体中文，其他系统默认英文。主界面侧栏顶部和首次启动的选择目录页都有语言选择器，可随时切换 **English / 简体中文**；选择会保存在本地，下次启动继续使用。切换后文件树、笔记列表、排序、状态栏、对话框、导出菜单和错误提示会立即更新。

英文界面示例：

<img src="docs/screenshots/overview.en.png" alt="rustmd English interface with language selector and markdown preview" width="880">

## 为什么是 rustmd

如果你想要一个**不把笔记锁进数据库、不强制登录、打开就能写**的 Markdown 工具：

- **纯文件存储**：笔记就是 `.md` 或 `.html`，文件夹就是文件夹；可以用 Git、Syncthing、iCloud、OneDrive 或任何同步工具管理。
- **本地优先**：核心编辑、预览、搜索、导出全部离线可用；拉取远程图片、加载 HTML 报告里的 CDN 脚本等场景才需要网络。
- **轻量跨平台**：Rust + Tauri 2，Windows / macOS / Linux 三端；Windows 提供解压即用的绿色 zip。
- **不只是编辑器**：文件夹树、全文搜索、front matter 标签、MathJax、Mermaid、代码高亮、HTML / PNG / PDF 导出。
- **安全边界认真做**：Markdown HTML 消毒、HTML 笔记在 sandbox iframe / 隐藏 WebView 中隔离渲染、CSP、路径封闭、SSRF 防护、导出走原生保存对话框。
- **适合从 Obsidian / Typora / VS Code 迁移**：直接打开已有 `.md` / `.html` 文件夹即可；front matter 中的 `title:`、`date:` 等字段保存时原样保留。

适合：个人知识库、技术笔记、写作草稿、课程笔记、本地 Markdown 文档库。

关键词：local-first、Markdown 笔记、HTML 笔记、Markdown 编辑器、多语言界面、English / 中文、离线笔记、Windows 绿色版、Tauri、Rust。

## 功能

### 多语言

- 中文 / English 两套界面；首次启动根据系统语言自动选择。
- 语言选择器位于主界面侧栏顶部（首次启动时也显示在目录选择页），选择持久化到本地。
- 切换后不重载笔记、不丢失编辑内容；排序、状态、对话框和导出文案同步更新。

### 文件导航

- **手动刷新**：侧栏顶部的刷新按钮从磁盘重新扫描整个笔记库（笔记、文件夹、标签、
  搜索与计数），无需重启；打开中的笔记被外部修改且没有未保存内容时会自动重新
  载入，被删除时安全关闭或保留未保存内容。
- **文件夹树**：支持嵌套文件夹、空文件夹、折叠/展开；选择父文件夹会包含整个子树。
- **子文件夹默认折叠**：只显示顶层文件夹，点击箭头逐层展开；展开状态会记住。
- **两种排序 + 方向**：可按最后修改时间或文件名排序，通过 `↑` / `↓` 按钮切换升序/降序；选择持久化。
- **文件名卡片**：每张笔记卡片显示标题、**文件名**、摘要、所在文件夹、修改时间与标签，同名笔记也容易区分。

### 搜索

- 同时搜索**标题、文件名、标签、正文**；大小写不敏感。HTML 笔记搜索的是页面可见文本，不会把标签、脚本或样式当作正文命中。
- 结果列表高亮命中片段，并显示是标题、文件名还是标签命中。
- 输入防抖 + 请求序列号，快速输入时旧结果不会覆盖新结果。

### 编辑与预览

- CodeMirror 6 编辑器，按文件类型切换 Markdown / HTML 语法高亮（HTML 标签、属性、属性值有独立配色；`<script>` / `<style>` 内的 JS/CSS 也按关键字、字符串、函数、变量、注释等分别着色）。
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

- 笔记库中的 `.html` / `.htm` 文件会和 Markdown 一起出现在文件夹树、笔记列表、搜索结果和文件夹计数中，并带 `HTML` 类型标记。
- 左侧编辑 HTML 源码，右侧用应用内置 WebView（Windows 的 WebView2 / Linux 的 WebKitGTK / macOS 的 WKWebView）直接整页渲染；无需安装 Edge、Chrome 或任何外部浏览器。页面自带的 `<style>`、`<script>`、本地相对 CSS/JS/字体/图片、ECharts 图表都会执行，滚动/缩放为原生清晰文本。`<title>` 或第一个 `<h1>` 作为列表标题，文件名仍可见。
- 顶部新建按钮提供 **Markdown 笔记 / HTML 页面** 两种选择；重命名、移动、删除、手动刷新和 HTML / PNG / PDF 导出与 Markdown 笔记一致。
- HTML 笔记没有 front matter，因此不显示标签编辑器；保存时不会插入 `---` 或 `tags:`，并保留文件原有的 BOM 与 CRLF/LF 换行风格。
- 预览在 **sandbox iframe** 中运行（无 `allow-same-origin`，origin 为 null），拿不到父页面 DOM/Tauri IPC；导出在隐藏的独立 Tauri WebView 窗口中执行，所有笔记/保险库命令按窗口 label 校验，隐藏窗口只能回传截图。渲染失败时才回退为 DOMPurify 消毒后的静态预览。
- 图表页面通常依赖 CDN 脚本，首次渲染/导出需要联网；HTML 笔记的 **导出 HTML** 直接保存当前源码，PNG / PDF 则由内置 WebView 整页截图（超长页面分段拼接）后导出。

### 导出

- **HTML**：Markdown 笔记导出为内嵌样式、跟随当前主题、本地图片内联的独立页面；HTML 笔记直接保存当前源码。
- **PNG**：Markdown 笔记 3× 渲染（约 288 DPI）；HTML 笔记按页面高度在 1–3× 间自适应（短页面 3×，超长报告目标高度约 48k 设备像素），整页保持。
- **PDF**：Markdown 按块边界分页；HTML 笔记按整页 PNG 切片为多页，均使用无损 PNG。
- PNG/PDF 导出时，远程图片经 Rust 后端拉取并内联，不再出现空白图；HTML 笔记的 PNG/PDF 由内置 WebView 整页渲染后导出，图表会保留，超长报告按高度自适应分段截取并拼接为单图。
- 导出目标路径由系统保存对话框选择，前端不能任意写文件。

### 安全

- Markdown 渲染出的 HTML 在进入 webview 前经 DOMPurify 消毒；脚本、事件属性、`javascript:` URL、`<style>`、`<iframe>` 等被剥离。HTML 笔记预览在 sandbox iframe（null origin）中运行，导出在隐藏 WebView 中运行，二者都无法调用应用命令。
- MathJax / Mermaid 在消毒之后生成 DOM，再做一次窄范围清理（`on*`、危险链接、外部 CSS URL）。
- Tauri CSP 默认启用；外部链接交给系统浏览器打开。HTML 预览/导出在隔离的 WebView 中运行，导出只回传 PNG。
- `resolve_in_root` 对笔记与图片做路径封闭，阻止 `..`、junction/symlink 写逃逸；扫描时跳过符号链接。
- 远程图片抓取拒绝 loopback / 私有网段 / 链路本地 / 保留地址，并校验每次重定向。
- 保存使用临时文件 + 原子替换；`baseHash` 冲突检测避免静默覆盖外部修改。
- 笔记按 UTF-8 读取；非 UTF-8 文件不会被静默隐藏，打开时会提示先转换为 UTF-8。
- HTML 笔记的相对 CSS/JS 会内联进预览/导出文档，图片内联为 data URL，字体走 `rmd`；`rmd` 只对无法内联的 classic script/style/font 子资源放行预览源，`fetch`/XHR 与文档读取仍返回 403。

## 下载与安装

从 [GitHub Releases](https://github.com/riverzhou/rustmd/releases/latest) 下载：

| 平台 | 产物 | 说明 |
| --- | --- | --- |
| Windows | `rustmd-<version>-win-x64-portable.zip` | **绿色版**：解压后直接运行 `rustmd.exe`，不写注册表 |
| Linux | `rustmd_<version>_amd64.deb` / `rustmd_<version>_amd64.AppImage` | Debian/Ubuntu 安装包 / 便携 AppImage |
| macOS | `rustmd-<version>-macos-universal.dmg` | Apple Silicon + Intel 通用包 |

每个产物都有 `.sha256`，Release 里还有合并的 `SHA256SUMS.txt`。

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

### macOS

DMG 内的 `.app` 使用 **ad-hoc 签名**（没有 Apple Developer ID，未公证）。首次打开会被 Gatekeeper 拦截：

- 系统设置 → 隐私与安全性 → “仍要打开”；或
- `xattr -dr com.apple.quarantine /Applications/rustmd.app`

彻底消除提示需要 Developer ID + 公证（见 [docs/RELEASING.md](docs/RELEASING.md)）。

### 校验下载

```bash
sha256sum -c SHA256SUMS.txt
# 或使用每个资产旁对应的 .sha256 文件
```

## 快速开始

1. 启动应用，选择或输入笔记目录；也可以直接打开已有的 Markdown 文件夹。
2. 左侧 `＋` 新建笔记；点击文件夹筛选，点击箭头展开子文件夹。
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

前置：Node.js ≥ 20.19、Rust stable（含 `rustfmt`、`clippy`）以及对应平台的 Tauri 系统依赖（Linux 见 [docs/TESTING.md](docs/TESTING.md)）。

Linux 从源码构建、依赖安装、绿色版打包与无 root sysroot 兜底见 [LINUX_BUILD.md](LINUX_BUILD.md)；构建后可运行 `scripts/linux-headless-smoke.sh` 在隔离 Xvfb 中冒烟测试 release 二进制。

| 任务 | 命令 |
| --- | --- |
| 全部检查 | `npm run check` |
| Tauri 开发窗口 | `node scripts/launch-dev.mjs`（Windows 可用 `scripts\run-dev.bat`） |
| 仅前端（mock） | `npm run dev` |
| 发布 exe（不打包安装器） | `npx tauri build --no-bundle`（Windows 可用 `scripts\run-build.bat`） |
| 前端纯函数单测 | `npm run test:unit` |
| Rust 单测 | `npm run test:rust` |
| 端到端自测 | `npm run selftest` / `npm run selftest:check` |
| 重新生成图标 | `npm run icons` |

`scripts/cargo.mjs` 会依次尝试 `$CARGO`、`~/.cargo/bin/cargo`、PATH 中的 `cargo`；Windows git-bash 不需要手动补 PATH。

### 自动化检查

`npm run check` 依次执行：

1. ESLint 10
2. Node 前端单测（排序、文件夹树、数学保护、代码段、多语言）
3. 仓库检查（文档链接、CSP、插件权限、图标、机器相关路径、`dist` 未跟踪）
4. 版本检查（`package.json` / `Cargo.toml` / `tauri.conf.json` 一致）
5. `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`
6. Vite 生产构建

CI：[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 在 Ubuntu 跑完整质量门禁，在 Windows / Linux / macOS 三端编译，并用 Xvfb + 真实 WebKitGTK 跑端到端自测。

### 端到端自测

```bash
npm run selftest
```

dev 窗口会渲染 `examples/` 下全部示例笔记，逐一导出 PNG/PDF。Markdown 笔记校验残留未渲染公式、多行公式几何、远程图片与笔记库本地图片是否真的出现在导出的 PNG 中（2D NCC）；HTML 示例校验 built-in WebView 的 iframe 是否 ready、PNG/PDF 是否产出，并加载本地相对 CSS/JS/图片与内联脚本。产物与 `report.json` 写入系统临时目录的 `rustmd-selftest/`，可用 `RUSTMD_SELFTEST_OUT` 覆盖；自测结束应用以 0/1 退出。代码位于 `frontend/src/selftest.js`，release 构建不包含它。

## 目录结构

```
├── src/main.rs               # 全部 Rust：命令、路径安全、front matter、rmd 协议、单测
├── frontend/
│   ├── index.html
│   ├── public/               # 图标、highlight.js 主题
│   └── src/                  # main.js / api.js / editor.js / preview.js / export.js
│                             #   notelist.js / markdown.js / imgutil.js / selftest.js / style.css
├── scripts/                  # 开发服务器、图标、检查、自测、签名与 Windows 绿色包
├── examples/                 # 示例笔记库，同时是自测夹具
├── capabilities/             # Tauri 权限
├── icons/                    # 应用图标（npm run icons 生成，含 .icns）
├── docs/                     # 架构、测试、发布、安全文档
├── .github/workflows/        # CI 与三端发布
├── tauri.conf.json
├── Cargo.toml
└── package.json
```

## 三端发布

发布由 [`.github/workflows/release.yml`](.github/workflows/release.yml) 完成：

- 推 `v*` tag（或手动填 tag）触发；
- Windows：绿色 zip + 自签名 Authenticode（可选真实 PFX secrets）；
- Linux：deb + AppImage + SHA256；
- macOS：universal DMG + ad-hoc 签名；
- 所有资产汇总 `SHA256SUMS.txt` 并创建 GitHub Release。

签名策略与 secrets 配置见 [docs/RELEASING.md](docs/RELEASING.md)。

## 常见问题

**Q：rustmd 开源吗？**
是，采用 **GPL-3.0-or-later**。你可以自由使用、修改和分发；衍生作品需按 GPL 兼容方式开源。详见 [LICENSE](LICENSE)。

**Q：支持同步吗？**
应用本身不做云同步。笔记是普通文件夹，交给 Syncthing、Git、iCloud、OneDrive、Dropbox 等即可。

**Q：能打开 Obsidian 的 vault 吗？**
可以打开普通 `.md` / `.html` 文件夹，文件夹层级和 Markdown front matter 标签可用。HTML 笔记按文件扩展名识别，编辑源码并由应用内置 WebView 渲染整页预览。Obsidian 特有的 `[[wikilink]]`、插件、canvas 等不在支持范围内；保存 Markdown 时其它 front matter 字段会保留。

**Q：为什么 Windows 会提示未知发布者 / macOS 会提示无法验证？**
Windows 使用自签名证书、macOS 使用 ad-hoc 签名，只保证完整性，没有购买商业代码签名/公证。校验 SHA256 后按系统提示放行即可。

**Q：支持移动端吗？**
当前只提供 Windows / macOS / Linux 桌面端。

**Q：笔记存在哪里？**
只存在你打开的文件夹里；应用没有数据库、没有账号、不会上传笔记。

**Q：如何反馈问题或贡献代码？**
欢迎提 [Issue](https://github.com/riverzhou/rustmd/issues) 或 PR。提交前请跑 `npm run check`；如果是渲染/导出问题，附上 `npm run selftest` 的 report 会很有帮助。

## 文档

- [Architecture / 架构](docs/ARCHITECTURE.md)
- [Testing & CI / 测试](docs/TESTING.md)
- [Release & Signing / 发布签名](docs/RELEASING.md)
- [Security / 安全](docs/SECURITY.md)
- [Changelog / 更新日志](CHANGELOG.md)
- [Audit Report / 审计报告](AUDIT_REPORT.md)
- [Developer & Agent Guide / 开发指南](AGENTS.md)
- [GitHub 项目文案与 topics](docs/GITHUB_PROJECT_COPY.md)

## License

rustmd 以 **GPL-3.0-or-later** 发布。完整条款见 [LICENSE](LICENSE)。

## 支持项目

如果 rustmd 对你有帮助，给一个 ⭐ 是最直接的鼓励；也欢迎分享给需要本地 Markdown 笔记的朋友。

**关键词**：Markdown 笔记、HTML 笔记、本地笔记、离线笔记、Markdown 编辑器、知识库、Obsidian 替代、Typora 替代、Tauri、Rust、Mermaid 图表、LaTeX 公式、PDF 导出、Windows 绿色版、macOS、Linux。
