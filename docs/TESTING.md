# 测试与 CI

## 一键检查

```bash
npm run check
```

依次执行：

| 步骤 | 命令 | 覆盖 |
| --- | --- | --- |
| ESLint | `npm run lint` | `frontend/src`、`scripts`、配置文件；未使用变量、未定义变量、`==`、`var` 等 |
| 前端单测 | `npm run test:unit` | 排序、文件夹树、过滤、笔记格式识别、数学保护、代码段切分、i18n 词典/插值/系统语言 |
| 仓库检查 | `npm run check:repo` | 必需文件（含 HTML 示例）、文档相对链接、CSP、插件权限、图标、机器相关路径、`dist` 未被跟踪 |
| 版本检查 | `npm run check:version` | `package.json` / `Cargo.toml` / `tauri.conf.json` 一致 |
| Rust 静态检查 | `node scripts/cargo.mjs fmt --check`、`clippy --all-targets -- -D warnings` | 格式与 lint，warning 视为错误 |
| Rust 单测 | `node scripts/cargo.mjs test` | 56 个测试（55 通过 + 1 个网络测试默认 ignored） |
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
- 搜索：标题、文件名、标签、正文窗口；
- 文件夹：空文件夹和嵌套；
- 重命名/移动：冲突自动后缀；HTML 扩展名保留；
- 图片：MIME、`rmd` 路径、缓存 mtime、SSRF 私有地址拒绝；
- HTML 渲染：base URL（Windows 盘符/Unix/UNC 分隔符）、`strip_base_tags`/`insert_after_head` 标签边界、`serve_rmd` Origin 白名单（null/rmdhtml 拒绝，font 放行）、`serve_html_preview` token/CSP/404、PNG 分段拼接格式校验、非 UTF-8 HTML 可见但打开报错、字面 `<` 文本；
- 网络拉取：`#[ignore]`，显式 `cargo test -- --ignored` 时运行。

## 前端单测

`node --test` 直接 import 纯函数模块，不需要 DOM：

- `frontend/src/notelist.test.js`：文件名、`noteKindOf` / `noteStemOf`、排序（mtime / 数字感知文件名）、文件夹子树过滤、树计数、折叠扁平化、祖先；
- `frontend/src/markdown.test.js`：代码段切分、数学检测、多个 `$$` 块（g 标志回归）、句中 `$$` 不配对、行内公式与行内代码；
- `frontend/src/i18n.test.js`：中英词典完整性、插值、系统语言选择。

## 端到端自测

```bash
npm run selftest
```

等价于设置 `RUSTMD_SELFTEST=1` 后启动 `scripts/launch-dev.mjs`，dev 窗口会：

1. 读取 `selftest_config`（默认 `<repo>/examples`，输出到系统临时目录 `rustmd-selftest/`）；
2. 对每篇示例笔记按 `kind` 走真实 `renderPreview`：Markdown 检查残留 `$…$`、Mermaid 错误、MathJax 错误、多行公式 viewBox 高度、远程/本地图片是否真实解码；`examples/html-page-demo.html` 走 sandbox iframe 路径，检查 iframe ready、本地相对 CSS/JS/图片和内联脚本是否加载；导出前本地图片必须被内联为 data URL；
3. 逐篇导出 PNG/PDF，写入输出目录；Markdown 远程图片经 `fetch_image_bytes`、本地图片经 `read_local_image`；HTML 笔记经内置隐藏 WebView 整页截图（相对资源走 `rmd` base；超长页面分段拼接），PNG 再切片生成 PDF；
4. Markdown 笔记用 2D NCC 验证每张远程/本地图片确实出现在导出的 PNG 中；HTML 笔记检查 iframe ready、本地脚本执行、本地图片内联、PNG 尺寸/非空与 PDF magic/尺寸（跨域 iframe 不可读取像素）；
5. 额外导出一张带 viewBox-only 内嵌 SVG 的测试图，验证 PNG 中同时存在左右两色
   （html2canvas 把 drawImage 源矩形按 SVG 用户单位解释、导致裁剪的回归）；
6. 写 `report.json`，通过 `selftest_finish` 以 0/1 退出。

`report.ok === false` 或任何 `errors[]` 都表示失败。报告还有 HTML 覆盖、PNG/PDF 尺寸与 magic、本地图片存在性、24 小时新鲜度检查；报告校验：

```bash
RUSTMD_SELFTEST_OUT=/path/to/rustmd-selftest npm run selftest:check
# CI 要求报告里至少有一个 HTML 条目；报告默认拒绝 24h 前的旧结果
node scripts/check-selftest-report.mjs "<out>/report.json" --require-html
# 需要检查旧报告时显式放宽：
RUSTMD_SELFTEST_MAX_AGE_HOURS=168 node scripts/check-selftest-report.mjs "<out>/report.json"
```

网络不可用时自测会**失败**（远程图片拉取计入 `errors`），这是有意的：离线时“图片是否出现在导出中”无法被证明。HTML 笔记的 CDN 图表脚本同样需要网络。

可用真实报告库验证 HTML 图表导出与超长分段拼接（不需要外部浏览器）：

```bash
RUSTMD_SELFTEST_EXAMPLES="<你的报告库>" npm run selftest
```

2026-11-10/11 的 ECharts 报告在该路径下均通过（最高约 32,000 CSS px；导出 PNG 约 1,768×48,000，PDF 多页切片）。

### 输出与故障排查

- 输出目录：`%TEMP%\rustmd-selftest`（Windows）或 `$TMPDIR/rustmd-selftest`；用 `RUSTMD_SELFTEST_OUT` 覆盖。
- 示例目录：用 `RUSTMD_SELFTEST_EXAMPLES` 覆盖。
- 如果窗口白屏/无产物：先用 `npm run dev` 复现前端异常；Linux CI 下用 `xvfb-run`、`WEBKIT_DISABLE_COMPOSITING_MODE=1`、`LIBGL_ALWAYS_SOFTWARE=1`。
- 如果应用没有退出但 report 已写入：CI 用 `timeout 600` 兜底，并以 report 校验为准。
- release 构建不包含 `selftest.js`，`selftest_*` 命令返回错误。

## Linux headless release smoke

Linux 上构建 release 二进制后，可用：

```bash
scripts/linux-headless-smoke.sh
```

它在隔离的 Xvfb display 中启动 `target/release/rustmd`，用 `xwd` 截图并校验窗口
尺寸、颜色数与边缘密度；不需要 root，不会弹到当前桌面。产物写入
`target/headless-smoke/`。依赖与打包细节见 [../LINUX_BUILD.md](../LINUX_BUILD.md)。

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)：

| Job | 内容 |
| --- | --- |
| `quality` | Ubuntu 22.04：安装 Tauri 依赖，`npm ci`，`npm run check`（含 lint/单测/仓库检查/Rust 测试/构建） |
| `build` | Windows / Ubuntu / macOS 三端 `npx tauri build --no-bundle`，验证真实编译 |
| `selftest` | Ubuntu + Xvfb：安装 WebKitGTK 与中文字体，跑真实 WebView 自测，校验 report，上传产物 |

依赖 Linux 系统包：

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev libssl-dev librsvg2-dev \
  patchelf libxdo-dev build-essential curl file xdg-utils xvfb fonts-noto-cjk
```

发布 workflow 的 `verify` job 也会在 Ubuntu + Xvfb 跑 `npm run selftest` 并用 `--require-html` 校验报告；详见 [RELEASING.md](RELEASING.md)。

## 加测试的原则

- 纯逻辑放 `notelist.js` / `markdown.js`，用 `node --test`；不要为了测试把 DOM 逻辑塞进去。
- 每个修过的 bug 至少补一个回归测试（多行公式、junction 逃逸、hash 冲突、`file:///` 等）。
- 不要放宽 `resolve_in_root` / `resolve_vault_file` / SSRF 检查来让测试通过。
- 网络测试默认 `#[ignore]`；E2E 才承担真实网络链路验证。
