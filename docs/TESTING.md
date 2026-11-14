# 测试与 CI

## 一键检查

```bash
npm run check
```

依次执行：

| 步骤 | 命令 | 覆盖 |
| --- | --- | --- |
| ESLint | `npm run lint` | `frontend/src`、`scripts`、配置文件；未使用变量、未定义变量、`==`、`var` 等 |
| 前端单测 | `npm run test:unit` | 60 个测试：排序（含大小写/变音符确定性 tie-break）、文件夹树、当前目录/子树过滤、多库同路径过滤、范围标签计数、全部笔记格式识别、CSV 解析/分隔符嗅探（TSV/引号内逗号/小数逗号）、数字列对齐/列宽提示、TXT 制表符列、JSON 统计/校验、侧栏/分屏宽度边界与持久化解析、PDF 页面方向（宽表 landscape）、栅格导出几何（面积上限/分页/尾页裁剪）、最近笔记库路径去重/MRU(20)/置顶不淘汰、数学保护、代码段切分、i18n 词典/插值/系统语言 |
| 仓库检查 | `npm run check:repo` | 必需文件（含 HTML 与 CSV/TXT/JSON 示例）、文档相对链接、CSP、插件权限、图标、机器相关路径、`dist` 未被跟踪 |
| 版本检查 | `npm run check:version` | `package.json` / `Cargo.toml` / `tauri.conf.json` 及 `package-lock.json` / `Cargo.lock` 根包版本一致 |
| Rust 静态检查 | `node scripts/cargo.mjs fmt --check`、`clippy --all-targets -- -D warnings` | 格式与 lint，warning 视为错误 |
| Rust 单测 | `node scripts/cargo.mjs test` | 77 个测试（Windows：76 个，75 通过 + 1 个网络测试默认 ignored；Linux/macOS：77 个，76 通过 + 1 ignored，额外 1 个 Unix 反斜杠路径测试。含 GBK/GB18030/BOM 往返、CSV/TXT/JSON 识别、数据保存/冲突/重命名、PDF 页码戳记、多库根包含性、`read_local_image`/`read_local_asset` 类型限制、64 MB 上限、HTML 注入跳过 script/注释正文） |
| 前端构建 | `npm run build` | Vite 生产构建 |

`scripts/cargo.mjs` 会找 `$CARGO`、`~/.cargo/bin/cargo`、PATH。CI 里直接使用 rustup 安装的 stable。

## Rust 单测

覆盖范围：

- front matter：行内/块列表标签、引号与逗号、注释、嵌套 key、CRLF、BOM、未知字段保留、往返；
- 标题提取：只认 CommonMark 标题、跳过代码围栏、`#Title` 不算标题；HTML `<title>` / `<h1>` / 文件名回退；
- HTML 笔记：`.html` / `.htm` 扫描、可见文本摘要（跳过 script/style/head/comment）、BOM/CRLF 保存、无 front matter、冲突检测、搜索只命中可见文本；
- snippet：跳过标题/围栏、列表前缀、未闭合 `[`、`!=`；
- 路径安全：`..`/绝对路径拒绝、junction/symlink 逃逸拒绝、UNC 前缀还原、遍历跳过符号链接；
- 保存：内容相同不重写、外部修改 hash 冲突、强制覆盖、front matter 保留、原子写无残留；
- 搜索：标题、文件名、标签、正文窗口；当前文件夹/子目录/递归范围（`folder` + `recursive`）；
- 文件夹：空文件夹和嵌套；
- 重命名/移动：冲突自动后缀；HTML 扩展名保留；
- 图片：MIME、`rmd` 路径、缓存 mtime、SSRF 私有地址拒绝；
- HTML/数据渲染：base URL（Windows 盘符/Unix/UNC 分隔符）、`strip_base_tags`/`insert_after_head` 标签边界、`serve_rmd` Origin 白名单（null/rmdhtml 拒绝，font 放行）、`serve_html_preview` token/CSP/404、PNG 分段拼接格式校验、不支持的编码仍可见但打开报错、GBK/GB18030/UTF-8 BOM（含双 BOM 不累积）往返、GBK 四字节升级、CSV/TXT/JSON 识别/保存/冲突/重命名、字面 `<` 文本；
- 网络拉取：`#[ignore]`，显式 `cargo test -- --ignored` 时运行。

## 前端单测

`node --test` 直接 import 纯函数模块，不需要 DOM：

- `frontend/src/notelist.test.js`：文件名、`noteKindOf` / `noteStemOf`、排序（mtime / 数字感知文件名 / 多库同路径稳定排序）、当前目录直属/子树过滤、按库过滤、默认当前目录（启动时为库根目录）范围、范围标签计数、树计数、折叠扁平化、祖先；
- `frontend/src/markdown.test.js`：代码段切分、数学检测、多个 `$$` 块（g 标志回归）、句中 `$$` 不配对、行内公式与行内代码；
- `frontend/src/vaultlist.test.js`：路径规范化、Windows 大小写/分隔符去重、MRU 上限 20、置顶优先显示、置顶不参与淘汰、旧字符串数组兼容、移除、损坏 localStorage 容错；
- `frontend/src/i18n.test.js`：中英词典完整性、插值、系统语言选择。

## 端到端自测

```bash
npm run selftest
```

等价于设置 `RUSTMD_SELFTEST=1` 后启动 `scripts/launch-dev.mjs`，dev 窗口会：

1. 读取 `selftest_config`（默认 `<repo>/examples`，输出到系统临时目录 `rustmd-selftest/`）；
2. 对每篇示例笔记按 `kind` 走真实 `renderPreview`：Markdown 检查残留 `$…$`、Mermaid 错误、MathJax 错误、多行公式 viewBox 高度、远程/本地图片是否真实解码；`examples/html-page-demo.html` 走 sandbox iframe 路径，检查 iframe ready、本地相对 CSS/JS/图片和内联脚本是否加载；CSV/TXT/JSON 检查表格/检查器结构、智能表头对齐、笔记文本不注入 DOM，并断言 GBK 示例的编码识别；另外用合成 CSV/TXT 表格独立验证数字右对齐、布尔居中与 `scope=col`。导出前本地图片必须被内联为 data URL；
3. 逐篇导出 PNG/PDF，写入输出目录；Markdown 远程图片经 `fetch_image_bytes`、本地图片经 `read_local_image`（仅图片类型；CSS/JS 走 `rmd`）；PDF 优先走平台打印管线（Markdown/窄数据表 `print_note_pdf`、HTML `print_html_note`，矢量文字、A4 分页；Windows WebView2 / macOS WKWebView / Linux WebKitGTK）；宽数据表自动回退扩宽舞台的横向图片 PDF，不支持打印时也回退图片 PDF；HTML 笔记的 PNG 经内置隐藏 WebView 整页截图（相对资源走 `rmd` base；超长页面分段拼接）；
4. Markdown 笔记用 2D NCC 验证每张远程/本地图片确实出现在导出的 PNG 中（图床不可达时记为 `warnings` 并跳过该图，首次失败后跳过其余远程图，不阻塞发布；本地图片仍严格断言）；走矢量打印路径的 PDF 条目要求存在内嵌字体（`/Font`），证明输出的是文字而不是图片切片；宽数据表/回退图片 PDF 不要求；HTML 笔记检查 iframe ready、本地脚本执行、本地图片内联、PNG 尺寸/非空与 PDF magic（跨域 iframe 不可读取像素）；
5. 额外导出一张带 viewBox-only 内嵌 SVG 的测试图，验证 PNG 中同时存在左右两色（html2canvas 把 drawImage 源矩形按 SVG 用户单位解释、导致裁剪的回归）；同时校验 HTML 导出会移除遗留的 GBK charset、保留 script 内文本、在 doctype 后写入 UTF-8 声明；
6. 写 `report.json`，通过 `selftest_finish` 以 0/1 退出。

新增断言：Markdown 预览不得残留未渲染公式、Mermaid/MathJax 错误数为 0、每篇导出的 PNG 不能是空白；HTML 示例还会断言 `<html lang>`/`<body class>` 在资源内联后保留、`defer` 头部脚本在 `<body>` 存在后才执行、内联脚本执行、本地图片内联数不少于引用数；Markdown 导出的独立 HTML 必须包含 highlight.js 颜色规则。

`report.ok === false` 或任何 `errors[]` 都表示失败。报告还有 HTML/数据覆盖、HTML PNG 尺寸、PNG/PDF magic 与文件大小、本地图片存在性、HTML 导出 charset、24 小时新鲜度检查。校验器会进一步核对**每个条目的 PNG/PDF/HTML 产物真实存在、字节数与报告完全一致**，并要求示例目录里的每篇笔记都有条目；`npm run selftest` 启动前会删除旧的 `report.json`/`progress.log`，失败的重跑不会复用上一次的绿色报告。报告校验：

```bash
RUSTMD_SELFTEST_OUT=/path/to/rustmd-selftest npm run selftest:check
# CI 要求至少一个 HTML + CSV/TXT/JSON 条目；报告默认拒绝 24h 前的旧结果
node scripts/check-selftest-report.mjs "<out>/report.json" --require-html --require-data
# 需要检查旧报告时显式放宽：
RUSTMD_SELFTEST_MAX_AGE_HOURS=168 node scripts/check-selftest-report.mjs "<out>/report.json"
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
scripts/linux-headless-smoke.sh
```

它在隔离的 Xvfb display 中启动 `target/release/rustmd`，用 `xwd` 截图并校验窗口
尺寸、颜色数与边缘密度；不需要 root，不会弹到当前桌面。产物写入
`target/headless-smoke/`。依赖与打包细节见 [../LINUX_BUILD.md](../LINUX_BUILD.md)。

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
| `quality` | Ubuntu 22.04：安装 Tauri 依赖，`npm ci`，`npm run check`（含 lint/单测/仓库检查/Rust 测试/构建） |
| `build` | Windows / Ubuntu 22.04 编译（Windows 额外跑 `cargo test`，并执行签名 + 绿色 zip 的打包 dry run）；Ubuntu 26.04 执行 deb/AppImage 打包 dry run；macOS 构建 `aarch64-apple-darwin --bundles app` 并 ad-hoc 签名验证（Apple Silicon only） |
| `selftest` | Ubuntu 22.04 + Xvfb：安装 WebKitGTK 与中文字体，跑真实 WebView 自测（10 篇示例，步骤上限 1200 秒），用 `--require-html --require-data` 校验 report，上传产物 |

依赖 Linux 系统包：

```bash
# Ubuntu 22.04（quality / selftest）
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev libssl-dev librsvg2-dev \
  patchelf libxdo-dev build-essential curl file xdg-utils xvfb fonts-noto-cjk

# Ubuntu 26.04（发布构建 / 打包 dry run）
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev libssl-dev \
  librsvg2-dev patchelf libxdo-dev libfuse2t64 build-essential curl file xdg-utils
```

发布 workflow 的 `verify` job 在 Ubuntu 26.04 + Xvfb 跑 `npm run selftest`，并用
`--require-html --require-data` 校验报告；Linux deb/AppImage 也在 26.04 构建。
详见 [RELEASING.md](RELEASING.md)。

## 加测试的原则

- 纯逻辑放 `notelist.js` / `vaultlist.js` / `markdown.js` / `dataformat.js`，用 `node --test`；不要为了测试把 DOM 逻辑塞进去。数据渲染器本身由真实 WebView 自测覆盖。
- 每个修过的 bug 至少补一个回归测试（多行公式、junction 逃逸、hash 冲突、`file:///` 等）。
- 不要放宽 `resolve_in_root` / `resolve_vault_file` / SSRF 检查来让测试通过。
- 网络测试默认 `#[ignore]`；E2E 才承担真实网络链路验证。
