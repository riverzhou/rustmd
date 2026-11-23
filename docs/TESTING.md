# 测试与 CI

## 一键检查

```bash
npm run check
```

依次执行：

| 步骤 | 命令 | 覆盖 |
| --- | --- | --- |
| ESLint | `npm run lint` | `frontend/src`、`scripts`、配置文件；未使用变量、未定义变量、`==`、`var` 等 |
| 前端单测 | `npm run test:unit` | 73 个测试（8 个文件）：排序（含大小写/变音符确定性 tie-break）、文件夹树、当前目录/子树过滤、多库同路径过滤、范围标签计数、全部笔记格式识别、CSV 解析/分隔符嗅探（TSV/引号内逗号/小数逗号）、数字/日期/布尔数值排序与稳定/缺失值规则、数字列对齐/列宽提示、TXT 制表符列与表头检测、JSON 统计/校验、侧栏/分屏宽度边界、栅格 PDF 每页方向（短页转置回归）、栅格导出几何（面积上限/分页/尾页裁剪）、最近笔记库路径去重/MRU(20)/置顶不淘汰、数学保护、代码段切分、i18n 词典/插值/系统语言 |
| 仓库检查 | `npm run check:repo` | 必需文件（含 HTML 与 CSV/TXT/JSON 示例）、文档相对链接、CSP、插件权限、图标、机器相关路径、`dist` 未被跟踪 |
| 许可边界 | `npm run check:license` | `crates/rustmd-core` 保持 MIT OR Apache-2.0、无 Tauri 依赖；`frontend/src/shared/` 无 Tauri 引用；两层源文件均有 SPDX 头 |
| 打包清单 | `npm run check:packaging` | winget / Scoop / Homebrew / AUR 的版本、资产名、URL、SHA256 互相一致（静态检查，不联网） |
| 版本检查 | `npm run check:version` | `package.json` / `Cargo.toml` / `crates/rustmd-core/Cargo.toml` / `tauri.conf.json` 及 `package-lock.json` / `Cargo.lock` 的 8 个版本值一致 |
| Rust 静态检查 | `node scripts/lib/cargo.mjs fmt --all --check`、`clippy --workspace --all-targets -- -D warnings` | 格式与 lint，warning 视为错误 |
| Rust 单测 | `node scripts/lib/cargo.mjs test --workspace` | 99 个测试（Windows；98 运行 + 1 个网络测试默认 ignored）/ 100 个（Linux、macOS；99 运行 + 1 ignored，额外 1 个 Unix 反斜杠路径测试），含 `crates/rustmd-core` 的 19 个公开 API 集成测试。覆盖 GBK/GB18030/BOM 往返、CSV/TXT/JSON 识别、数据保存/冲突/重命名、笔记命令拒绝非笔记扩展名、原子创建/重命名碰撞、PDF 页码戳记、多库根包含性、`read_local_image`/`read_local_asset` 类型限制、64 MB 上限、HTML 注入跳过 script/注释正文 |
| 前端构建 | `npm run build` | Vite 生产构建 |

`scripts/lib/cargo.mjs` 会找 `$CARGO`、`~/.cargo/bin/cargo`、PATH。CI 里直接使用 rustup 安装的 stable。`cargo test --workspace` 才会同时运行根 crate 与 `crates/rustmd-core` 的测试；直接 `cargo test` 不会运行 core 的测试（包括公开 API 集成测试）。网络测试默认 `#[ignore]`，需要时显式运行 `cargo test --workspace -- --ignored`。

## Rust 单测

覆盖范围：

- front matter：行内/块列表标签、引号与逗号、注释、嵌套 key、CRLF、BOM、未知字段保留、往返；
- 标题提取：只认 CommonMark 标题、跳过代码围栏、`#Title` 不算标题；HTML `<title>` / `<h1>` / 文件名回退；
- HTML 笔记：`.html` / `.htm` 扫描、可见文本摘要（跳过 script/style/head/comment）、BOM/CRLF 保存、无 front matter、冲突检测、搜索只命中可见文本；
- snippet：跳过标题/围栏、列表前缀、未闭合 `[`、`!=`；
- 路径安全：`..`/绝对路径拒绝、junction/symlink 逃逸拒绝、UNC 前缀还原、遍历跳过符号链接；笔记命令（read/save/rename/delete/move）拒绝 `.png` 等非笔记扩展名；
- 保存：内容相同不重写、外部修改 hash 冲突、强制覆盖、front matter 保留、原子写无残留、并发 `create_note` 不抢同名、把 `note (1).md` 重命名为 `note` 得到 `note (2).md` 而不是静默 no-op；
- 搜索：标题、文件名、标签、正文窗口；当前文件夹/子目录/递归范围（`folder` + `recursive`）；
- 文件夹：空文件夹和嵌套；
- 重命名/移动：冲突自动后缀；HTML 扩展名保留；
- 图片：MIME、`rmd` 路径、缓存 mtime + 长度校验、SSRF 私有地址拒绝；
- HTML/数据渲染：base URL（Windows 盘符/Unix/UNC 分隔符）、`strip_base_tags`/`insert_after_head` 标签边界、`serve_rmd` Origin 白名单（release 只认 Tauri 源，debug 才认回环 dev 源；null/rmdhtml 拒绝，font 放行）、`serve_html_preview` token/CSP/404、PNG 分段拼接格式校验、不支持的编码仍可见但打开报错、GBK/GB18030/UTF-8 BOM（含双 BOM 不累积）往返、GBK 四字节升级、CSV/TXT/JSON 识别/保存/冲突/重命名、字面 `<` 文本；
- 网络拉取：`#[ignore]`，显式 `cargo test --workspace -- --ignored` 时运行。

## 前端单测

`node --test` 直接 import 纯函数模块，不需要 DOM；共 73 个测试、8 个文件：

- `frontend/src/shared/notelist.test.js`：文件名、`noteKindOf` / `noteStemOf`、排序（mtime / 数字感知文件名 / 多库同路径稳定排序）、当前目录直属/子树过滤、按库过滤、默认当前目录（启动时为库根目录）范围、范围标签计数、树计数、折叠扁平化、祖先；
- `frontend/src/shared/markdown.test.js`：代码段切分、数学检测、多个 `$$` 块（g 标志回归）、句中 `$$` 不配对、行内公式与行内代码、引用块/列表中的块级公式（`\\` 行分隔符与 CRLF）、`\$` 转义与真公式共存、公式内 `\$`；
- `frontend/src/shared/i18n.test.js`：中英词典键完全一致、插值/英文复数、系统语言选择；
- `frontend/src/shared/dataformat.test.js`：CSV 引号/双引号/内嵌换行/参差行/尾行、分隔符嗅探（结构列数优先，逗号/制表符/分号竞争）、TXT 制表列与长列、列数上限、数字/日期/货币/缺失值/布尔对齐、列宽计划/上限/样本、TXT 表头检测（股票数据不误判）、CSV 排序（数值/货币/百分比/日期/布尔、缺失值置底、稳定 tie-break、文本自然顺序、不修改源数组）与导出序列化（表头保留、引号/换行/分隔符转义、排序后 CSV 源）、JSON 统计与非法 JSON；
- `frontend/src/layout.test.js`：侧栏 220–680px + 视口 42% 上限、编辑/预览 20–80%、持久化百分比解析；
- `frontend/src/pdfgeom.test.js`：栅格 PDF 每页按自身宽高选择 portrait/landscape，非法尺寸回退 portrait（仅栅格回退路径；宽表矢量 PDF 不再使用 landscape 纸张）；
- `frontend/src/exportgeom.test.js`：常规 3×、宽/高/总画布面积上限、极端尺寸低于 0.25×、分页不超过页高、块底部切页、尾页小切片合并；
- `frontend/src/vaultlist.test.js`：路径规范化、Windows 大小写/分隔符去重、MRU 上限 20、置顶优先显示、置顶不参与淘汰、旧字符串数组兼容、移除、损坏 localStorage 容错。

## 数学离线回归（CSP + 断网）

`frontend/mathlab.html` 是一个仅开发用的页面，保留**安装版 CSP 的关键部分**（无 CDN 源，MathJax 不能联网取字体/扩展），但为了让 Vite 提供模块图还允许 HMR WebSocket（`ws://127.0.0.1:*`），因此 CSP **不是与安装版逐字节相同**。它从 `/src/shared/preview.js` 导入 `renderPreview` 来渲染传入的 Markdown。MathJax 的任何 CDN 请求都会被 CSP 拦截，因此能复现“安装版里公式全部保持原文”的问题。

```bash
npm run dev
# 浏览器打开 http://127.0.0.1:5173/mathlab.html
# 控制台执行（host 由页面的 __mathLab 暴露）：
#   await __mathLab.renderPreview(mdText, __mathLab.host, 'markdown')
```

回归时至少覆盖：普通行内/块级、矩阵/align/cases、`\label`+`\eqref`、`\tag`、`\text` 中文、`\textcolor`/`\boxed`、`\mathbb`/`\mathcal`/`\mathfrak`/`\mathscr`、`\ce`、`\cancel`、`\bbox`、`\braket{a|b}`、`\dv`/`\pdv`、`\mathbbm`/`\mathds`、`\degree`/`\textcelsius`/`\upalpha`、引用块与列表中的多行公式、`\$` 货币。每个公式都应有 `mjx-container`，且 `mjx-container g[data-mml-node="mtext"][fill="red"]` 为空（红色 = 未定义宏）。

已内置到真实应用的验证：`npm run selftest`（实际启动 `scripts/dev/run-selftest.mjs`）会导出 `examples/` 全部笔记的 PNG/PDF，并断言预览无残留 `$…$`、无 MathJax/Mermaid 错误；安装版（CSP 生效）还需人工/脚本打开 `数学公式全面测试.md` 确认 `mjx-container` 数量为 34。

## 端到端自测

```bash
npm run selftest
```

等价于 `scripts/dev/run-selftest.mjs` 设置 `RUSTMD_SELFTEST=1`、删除旧的 `report.json`/`progress.log` 后启动 `scripts/dev/launch-dev.mjs`，dev 窗口会：

1. 读取 `selftest_config`（默认 `<repo>/examples`，输出到系统临时目录 `rustmd-selftest/`）；
2. 对每篇示例笔记按 `kind` 走真实 `renderPreview`：Markdown 检查残留 `$…$`、Mermaid 错误、MathJax 错误、多行公式 viewBox 高度、远程/本地图片是否真实解码；`examples/html-page-demo.html` 走 sandbox iframe 路径，检查 iframe ready、本地相对 CSS/JS/图片和内联脚本是否加载；CSV/TXT/JSON 检查表格/检查器结构、智能表头对齐、笔记文本不注入 DOM，并断言 GBK 示例的编码识别；另外用合成 CSV/TXT 表格独立验证数字右对齐、布尔居中与 `scope=col`，以及 CSV 表头点击的「升序 → 降序 → 原始顺序」三态循环、重置按钮、数据 HTML 导出保持静态（无排序控件）且排序/转义逻辑由纯函数单测覆盖。导出前本地图片必须被内联为 data URL；
3. 逐篇导出 PNG/PDF，写入输出目录；Markdown 远程图片经 `fetch_image_bytes`、本地图片经 `read_local_image`（仅图片类型）；本地 CSS/JS 经 `read_local_asset`（仅 `.css`/`.js`/`.mjs`）由父页面内联，`rmd` 只是字体等剩余资源的回退协议；PDF 优先走平台打印管线（Markdown 与数据表 `print_note_pdf`、HTML `print_html_note`，矢量文字；Markdown 为 A4，A4 放不下的数据表按实测宽度请求自定义宽纸张，Rust 夹取 3–60 in；Windows WebView2 / macOS WKWebView / Linux WebKitGTK）；只有超过前端 55 in 上限的表才回退扩宽舞台的图片 PDF（超长表按行以 3× 分页），不支持打印时也回退图片 PDF；HTML 笔记的 PNG 经内置隐藏 WebView 整页截图（相对资源先内联，字体等走 `rmd` base；超长页面分段拼接）；
4. Markdown 笔记用 2D NCC 验证每张远程/本地图片确实出现在导出的 PNG 中（图床不可达时记为 `warnings` 并跳过该图，首次失败后跳过其余远程图，不阻塞发布；本地图片仍严格断言）；走矢量打印路径的 PDF 条目（含宽数据表）要求存在内嵌字体（`/Font`），证明输出的是文字而不是图片切片；只有回退图片 PDF 不要求；HTML 笔记检查 iframe ready、本地脚本执行、本地图片内联、PNG 尺寸/非空与 PDF magic（跨域 iframe 不可读取像素）；
5. 额外导出一张带 viewBox-only 内嵌 SVG 的测试图，验证 PNG 中同时存在左右两色（html2canvas 把 drawImage 源矩形按 SVG 用户单位解释、导致裁剪的回归）；同时校验 HTML 导出会移除遗留的 GBK charset、保留 script 内文本、在 doctype 后写入 UTF-8 声明；
6. 写 `report.json`，通过 `selftest_finish` 以 0/1 退出。

新增断言：Markdown 预览不得残留未渲染公式、Mermaid/MathJax 错误数为 0、每篇导出的 PNG 不能是空白；HTML 示例还会断言 `<html lang>`/`<body class>` 在资源内联后保留、`defer` 头部脚本在 `<body>` 存在后才执行、内联脚本执行、本地图片内联数不少于引用数、CSS `url()` 背景图被内联且不残留相对 URL；Markdown 导出的独立 HTML 必须包含 highlight.js 颜色规则；PNG 的内联 SVG 回归必须保留红/蓝两色。

`report.ok === false` 或任何 `errors[]` 都表示失败。报告还有 HTML/数据覆盖、HTML PNG 尺寸、PNG/PDF magic 与文件大小、本地图片存在性、HTML 导出 charset、CSV 表头排序、24 小时新鲜度检查。校验器现在会：要求 `report.config.examplesDir` 存在且（设置了 `RUSTMD_SELFTEST_EXAMPLES` 时）与本次运行一致，核对**每个条目的 PNG/PDF/HTML 产物位于输出目录内、不早于本次运行、真实存在且字节数与报告完全一致**，并要求示例目录里的每篇笔记都有条目（目录为空也算失败）；`scripts/dev/run-selftest.mjs` 启动前会删除旧的 `report.json`/`progress.log`，失败的重跑不会复用上一次的绿色报告。报告校验：

```bash
RUSTMD_SELFTEST_OUT=/path/to/rustmd-selftest npm run selftest:check
# CI 要求至少一个 HTML + CSV/TXT/JSON 条目；报告默认拒绝 24h 前的旧结果
node scripts/checks/check-selftest-report.mjs "<out>/report.json" --require-html --require-data
# 需要检查旧报告时显式放宽：
RUSTMD_SELFTEST_MAX_AGE_HOURS=168 node scripts/checks/check-selftest-report.mjs "<out>/report.json"
```

远程图片探测失败会记为 `report.warnings` 并跳过该图的导出断言，不会阻塞发布；报告校验脚本会打印这些警告。本地图片、HTML iframe/本地脚本、数据结构和矢量 PDF 断言仍然严格。CSV/TXT/JSON 不再有显示上限；示例只覆盖小表，真实 GBK 股票信号样本（24 行×18 列）已用应用自身读取并导出验证。发布前额外用 300 行长 CSV 验证了矢量 PDF 分页（13 页）与导出列宽，测试夹具不进入仓库。HTML 笔记的 CDN 图表脚本需要网络，离线时相关 HTML 示例可能无法通过渲染断言。

可用真实报告库验证 HTML 图表导出与超长分段拼接（不需要外部浏览器）：

```bash
RUSTMD_SELFTEST_EXAMPLES="<你的报告库>" npm run selftest
```

2026-11-10/11 的 ECharts 报告在该路径下均通过（最高约 32,000 CSS px；导出 PNG 约 1,768×48,000，PDF 为矢量文字、多页）。

### 输出与故障排查

- 输出目录：`%TEMP%\rustmd-selftest`（Windows）或 `$TMPDIR/rustmd-selftest`；用 `RUSTMD_SELFTEST_OUT` 覆盖。
- 示例目录：用 `RUSTMD_SELFTEST_EXAMPLES` 覆盖。
- 如果窗口白屏/无产物：先用 `npm run dev` 复现前端异常；Linux CI 下用 `xvfb-run`、`WEBKIT_DISABLE_COMPOSITING_MODE=1`、`LIBGL_ALWAYS_SOFTWARE=1`。
- 如果应用没有退出但 report 已写入：CI 用 `timeout 1200` 兜底，并以 report 校验为准。离线环境下远程图片会拖慢导出，这是测试环境的预期行为。
- release 构建不包含 `selftest.js`，`selftest_*` 命令返回错误。

## Linux headless release smoke

Linux 上构建 release 二进制后，可用：

```bash
scripts/release/linux-headless-smoke.sh
```

它在隔离的 Xvfb display 中启动 `target/release/rustmd`，用 `xwd` 截图并校验窗口
尺寸、颜色数与边缘密度；不需要 root，不会弹到当前桌面。产物写入
`target/headless-smoke/`。依赖与打包细节见 [../LINUX_BUILD.md](LINUX_BUILD.md)。

## 浏览器 mock 手工回归

- 布局宽度：拖动侧栏右缘（220–680px）、拖动编辑/预览分隔条（20–80%）、刷新后保持；点击顶栏“恢复默认布局宽度”回到 320px + 50/50；双击手柄/Enter 只重置对应轴；
- 数据视图：TXT/CSV 宽表上下横向条同步、窄表按内容收缩、18+ 行时行高填充可用高度、4K/200%（约 1920 CSS）全宽。
- HTML 导出：CSV/TXT 宽表全宽、窄表按内容收缩、横向滚动；Markdown 仍为 820px 阅读栏宽。


`npm run dev` 的浏览器 mock 不依赖 Rust/WebView，适合在发布前快速复核 UI 状态与
localStorage 迁移：

- 最近笔记库：钉死/取消置顶、置顶分组、20 条上限与置顶不淘汰、当前库标记、
  旧字符串数组自动升级；
- 多库同开：置顶库 + 当前库聚合列表、按库分组文件夹树、各库子目录独立选择、
  跨库打开/编辑/保存、关闭多库时保留当前笔记；
- 折叠：库根节点、各级子目录、折叠后点击库名只选中不展开；
- 侧栏分隔条：拖动、双击重置、键盘 ArrowUp/ArrowDown/Home/End、窗口缩放与
  侧栏折叠后的高度保持；
- 语言/主题切换、搜索/排序/标签过滤、刷新与开关持久化。

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)：

| Job | 内容 |
| --- | --- |
| `quality` | Ubuntu 22.04：安装 Tauri 依赖，`npm ci`，`npm run check`（含 lint/单测/仓库检查/许可边界/打包清单/版本/Rust 测试/构建） |
| `build` | Windows / Ubuntu 22.04 编译（Windows 额外跑 `cargo test --workspace`，并执行签名 + 绿色 zip 的打包 dry run）；Ubuntu 26.04 执行 deb/AppImage 打包 dry run；macOS 构建 `aarch64-apple-darwin --bundles app` 并 ad-hoc 签名验证（Apple Silicon only） |
| `selftest` | Ubuntu 22.04 + Xvfb：安装 WebKitGTK 与中文字体，用 `node scripts/dev/run-selftest.mjs` 跑真实 WebView 自测（10 篇示例，步骤上限 1200 秒），用 `--require-html --require-data` 校验 report，上传产物 |
| `wayland-smoke` | Ubuntu 26.04 + sway headless：`GDK_BACKEND=wayland` 启动 release 二进制，用 grim 截图并校验非空白；`continue-on-error`，只报告不阻塞 |

Wayland smoke 是前向兼容检查，不是发布门禁。本地（有 release 二进制时）可运行：

```bash
scripts/release/linux-wayland-smoke.sh
```

脚本使用临时 `XDG_RUNTIME_DIR` 和临时 `HOME`，不会连接当前桌面；需要
`sway`、`grim` 和 ImageMagick。产物写入 `target/wayland-smoke/`
（`sway.log`、`app.log`、`wayland-smoke.png`）。

依赖 Linux 系统包：

```bash
# Ubuntu 22.04（quality / selftest）
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev libssl-dev librsvg2-dev \
  patchelf libxdo-dev build-essential curl file xdg-utils xvfb fonts-noto-cjk

# Ubuntu 26.04（发布构建 / 打包 dry run）
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev libssl-dev \
  librsvg2-dev patchelf libxdo-dev libfuse2t64 build-essential curl file xdg-utils
```

发布 workflow 的 `verify` job 在 Ubuntu 26.04 + Xvfb 用 `node scripts/dev/run-selftest.mjs` 跑自测（先清理旧报告），并用
`--require-html --require-data` 校验报告；Linux deb/AppImage 也在 26.04 构建。
详见 [RELEASING.md](RELEASING.md)。

## 加测试的原则

- 纯逻辑放 `frontend/src/shared/notelist.js` / `frontend/src/vaultlist.js` / `frontend/src/shared/markdown.js` / `frontend/src/shared/dataformat.js` 以及 `frontend/src/{layout,pdfgeom,exportgeom}.js`，用 `node --test`；不要为了测试把 DOM 逻辑塞进去。数据渲染器本身由真实 WebView 自测覆盖。
- 每个修过的 bug 至少补一个回归测试（多行公式、junction 逃逸、hash 冲突、`file:///` 等）。
- 不要放宽 `resolve_in_root` / `resolve_vault_file` / SSRF 检查来让测试通过。
- 网络测试默认 `#[ignore]`；E2E 才承担真实网络链路验证。
