# rustmd 代码审计报告

**审计日期**：2026-11-11
**审计对象**：`rustmd` v1.4.0（Rust + Tauri 2，Markdown + HTML 笔记）
**审计方式**：全量阅读 Rust/前端/脚本/配置/文档；多轮静态检查与运行时回归；针对 HTML 渲染、导出、路径、IPC、Origin、CSP 做边界测试；Windows 本机真实 WebView2 端到端自测；GitHub Actions 三端构建与 Linux Xvfb E2E（发布时验证）。

---

## 1. 执行摘要

| 维度 | 状态 |
|---|---|
| 未修复高危缺陷 | **0 个已知** |
| 未修复中危缺陷 | **0 个已知**（少数产品边界见 §6） |
| Rust 测试 | **56 个**：55 通过 + 1 个网络测试默认 `#[ignore]` |
| 前端单测 | **20 个**，全部通过 |
| 静态检查 | ESLint 0 error；`cargo fmt --check`；clippy `-D warnings`；`npm run check` 全绿 |
| 运行时回归 | `npm run selftest`：6 篇示例（含 HTML）通过；HTML iframe ready、PNG/PDF、本地 JS/图片内联、长页分段均有断言 |
| 依赖审计 | `npm audit --omit=dev` 0 vulnerabilities；开发期 ESLint/minimatch moderate 告警（不进入运行时） |
| 许可证 | GPL-3.0-or-later（`LICENSE` / `package.json` / `Cargo.toml` / `tauri.conf.json`） |

**结论**：v1.4.0 的 HTML 笔记、内置 WebView 预览/导出、全屏/折行/语法高亮和 1.4.0 发布链路已通过本轮审计。历史上 v1.0.0 / v1.2.0 的高危项（未消毒 HTML、路径逃逸、SSRF、任意写）仍保持修复状态；本轮重点修复了新 HTML 渲染路径引入的跨域读、base URL、并发、资源加载和发布检查问题。

---

## 2. 本轮修复的高优先级问题

### H-1 `rmd` 协议 Origin 过宽（跨域读笔记库）

- **问题**：早期只拒绝 `Origin: null` / `rmdhtml`，其他任意 Origin 可带 `Access-Control-Allow-Origin: *` 读取 `rmd://` 文件；恶意 HTML 笔记可嵌套远程 iframe 读取笔记库。
- **修复**：`serve_rmd` 仅接受无 Origin 的普通子资源请求，或来自应用自身 webview 的 Origin（Tauri / 本地 dev server）；其余 Origin 一律 403。`Access-Control-Allow-Origin` 不再固定 `*`，只回显允许的 Origin。`@font-face` 在预览的 null/rmdhtml 源下按 `Sec-Fetch-Dest: font` 单独放行（字体不是文本读取通道）。`rmd` 返回的 HTML/SVG 文档附加 sandbox CSP 和 `nosniff`。
- **回归**：`serve_rmd_rejects_preview_origins`；手动验证 null/rmdhtml 403、主 webview 200、本地字体 200。

### H-2 HTML base URL 分隔符错误（Linux/macOS/UNC 本地资源 404）

- **问题**：把整条绝对路径作为一个 URL segment 编码，或保留多余前导斜杠，导致 `rmd://localhost//home/...` 在 `trim_start_matches('/')` 后变成相对路径，Linux/macOS 及 Windows UNC 的所有相对 CSS/JS/字体/图片 404。
- **修复**：Rust 与前端 base builder 逐 segment 编码、保留字面 `/`；`serve_rmd` 只去掉**一个**前导斜杠，让 Unix `/home` 与 Windows `C:/` / UNC `//server` 都保持绝对路径。新增 Windows 盘符、Unix `/home`、`<basefont>`/`<header>` 边界测试。
- **回归**：`html_preview_base_href_keeps_separators`、`serve_rmd_rejects_preview_origins`、真实 HTML 本地 CSS/JS/图片测试。

### H-3 隐藏导出窗口的本地图片被 CORS 拦截

- **问题**：html2canvas 以 `crossOrigin="anonymous"` 请求本地图片，Origin 为 `rmdhtml`，被严格 Origin 白名单拒绝，HTML PNG/PDF 丢失笔记库图片。
- **修复**：导出前由主窗口调用 `inlineLocalImagesInHtml`，通过 `read_local_image` 把相对图片替换为 data URL；隐藏窗口不再发跨域图片请求。自测新增 HTML 本地图片内联断言（导出 PNG 目视为完整图表）。
- **回归**：`html-page-demo.html` 的 `assets/fig1-adaptation-score.png` 必须出现在 HTML 导出 PNG 中。

### H-4 `html_preview_finish` 失败不唤醒等待方

- **问题**：分段解码/拼接错误通过 `?` 提前返回，等待 `html_preview_note_webview` 的接收方只能等 60 秒超时；`spawn_blocking` JoinError 还会泄漏隐藏窗口。
- **修复**：用闭包计算 `Result`，无论成功/失败都 `state.finish(token, result)`；解码/拼接失败立即唤醒；JoinError 路径先关闭窗口并 `cancel`/`remove_doc`；校验 `window.label() == html-render-{token}`。
- **回归**：manual malformed-payload 测试；新增 `html_preview_finish` 逻辑审查。

### H-5 渲染 token 可预测

- **问题**：`p-{pid}-{counter}` / `r-{pid}-{counter}` 同源窗口可枚举/猜测其他预览文档。
- **修复**：`getrandom` 生成 128-bit 随机 token（失败时回退时间+counter）；预览与导出仍用独立前缀；隐藏窗口回传时必须匹配完整 label；消费后从文档表移除。
- **回归**：命令/状态代码审查；随机 token 构建测试。

### H-6 快速切换笔记/搜索的竞态

- **问题**：`selectNote` 无请求序列号，慢的 A 响应可能覆盖刚点的 B；切换库后旧搜索响应可能回填。
- **修复**：`noteSelectSeq` + dir 双重校验；`clearCurrentNote`/`enterDir` 递增；搜索检查 `searchSeq`、query、dir；切换库清空 timer/searchSeq。
- **回归**：代码审查 + 手动快速切换；现有搜索测试。

---

## 3. 本轮修复的中优先级问题

| ID | 问题 | 修复 / 回归 |
|---|---|---|
| M-1 | `.htm` 重命名被改成 `.html` | 保留原扩展名；新增 `.htm` 单测 |
| M-2 | 非 UTF-8 HTML 被 `read_to_string().ok()?` 静默隐藏 | 列表用 lossy 文本保持可见，打开返回明确 UTF-8 错误；raw bytes 参与 hash；新增单测 |
| M-3 | `html_to_text` 把字面 `1 < 2` 当标签吞掉 | 只有 `<` 后接字母/`/`/`!`/`?` 才按标签解析；新增单测 |
| M-4 | `strip_base_tags` 误删 `<basefont>`，`insert_after_head` 误匹配 `<header>` | 标签名边界 + `<basefont>`/`<header>` 回归 |
| M-5 | Windows 保留名/控制字符/超长文件名 | `sanitize_filename` 过滤控制字符、保留名加 `_`、截断 180 字符；新增单测 |
| M-6 | 长 Markdown 导出 `Math.max(1, …)` 仍可能超过 canvas | 比例降到 0.25×、上限 30000 设备像素；HTML 仍分段拼接 |
| M-7 | 快速切换时旧 HTML iframe/监听器泄漏 | `htmlRenderSeq` 防旧结果、`disposeNativeHtmlPreview` 切回 Markdown 时清理 |
| M-8 | iframe 超时静默空白 | 20s 后显示 `preview.htmlTimeout` 警告，保留 iframe；成功加载后移除警告 |
| M-9 | HTML 预览点击链接会把 iframe 导航走 | 注入链接拦截，http(s)/mailto 经父窗口 `openExternal` 打开 |
| M-10 | HTML 预览高亮/标题文案与实现不符 | 标题改为“隔离的实时预览（脚本和样式在 sandbox 中运行）”；补 JS/CSS 配色 |
| M-11 | 自测报告可复用旧报告、HTML 断言可跳过 | 报告要求 `startedAt` 24h 内、`--require-html` 至少一个 HTML 条目；HTML 条目断言 iframe/ready、本地 JS、PNG 尺寸/nonWhite、PDF `%PDF-`、本地图片内联 |
| M-12 | HTML PDF 未走真实 `mode:'pdf'` | 自测分别调用 export/pdf；校验 PDF magic |
| M-13 | Release 签名真实 PFX 无 `.cer` 时 CI 复制失败 | `.cer` 改为条件复制 |
| M-14 | `docs/RELEASING.md` 说 release notes 可选，实际必需 | 改为必需；发布前本地运行 release-notes preflight |
| M-15 | 发布前 `npm run selftest` 未被 workflow 强制执行 | 文档明确、本地发布检查必跑；报告检查器支持 `--require-html`；GitHub workflow 保持三端构建与发布（OAuth token 无 workflow scope，workflow 改动不进入本次推送） |
| M-16 | mock 模式路径/搜索与 Rust 不一致 | mock 增加路径规范化（含反斜杠/父目录）、`create/move` folder 校验、搜索剥离 front matter、`.htm` 重命名保留 |

---

## 4. 验证记录

本机（Windows 11，WebView2）执行：

```text
npm run check  → ESLint、20 前端单测、repo、version、fmt、clippy -D warnings、56 Rust 测试、Vite build 全通过
npm run selftest → 6 篇示例（含 examples/html-page-demo.html）通过
```

自测覆盖：

- Markdown：残留公式、Mermaid 错误、MathJax 错误、多行矩阵 viewBox、远程/本地图片 NCC、内嵌 SVG 红蓝像素；
- HTML：sandbox iframe ready、本地相对 CSS/JS 执行、本地图片内联到导出源、PNG 非空/尺寸、PDF magic/尺寸、真实 `mode:'pdf'`；
- 超长 HTML：32k CSS px 报告导出 PNG 约 1,768×48,000，分段拼接完整；688499 报告 PNG 约 3,037×30,000（约 2.56×）；
- 手动安全：sandbox iframe 调 `read_note` 返回 `Origin header is not a valid URL`；`rmd` null/rmdhtml Origin 返回 403；主 webview 本地图片正常。

CI：Windows / Ubuntu / macOS `npx tauri build --no-bundle`；Linux Xvfb E2E；GitHub tag 触发 release workflow（verify 先跑 `npm run check`；本地发布前另跑 E2E），再生成 Windows zip、Linux deb/AppImage、macOS universal DMG，并由 `publish` 汇总 `SHA256SUMS.txt`。

---

## 5. 历史高危项（v1.0.0 / v1.2.0，保持修复）

- **未消毒 HTML + `csp:null`**：Markdown HTML 经 DOMPurify 静态配置消毒；主 CSP 非空；MathJax/Mermaid 后置清理；HTML 笔记改走 sandbox iframe / 隐藏 WebView。
- **junction/symlink 写逃逸**：`resolve_in_root` 对最深存在祖先 canonicalize；walk 跳过 reparse point。
- **SSRF**：仅 http(s)，拒绝私网/回环/元数据/保留地址，重定向逐跳校验，超时/大小上限。
- **任意文件写**：删除 `write_text/write_bytes`；仅 `save_export` 在原生对话框选择的路径写入。

---

## 6. 剩余风险与明确边界

| 项 | 说明 | 处理 |
|---|---|---|
| Windows 自签名 | SmartScreen 仍提示未知发布者 | 证书 + SHA256；支持真实 PFX secret |
| macOS ad-hoc | 未公证，首次需手动放行 | Release 文案 + RELEASING 文档 |
| 本地 HTML 字体/模块 | 字体按 `font` 目的放行；ES module（CORS `script`）仍可能受 Origin 限制 | 文档说明；如需要可改为 token 化资源协议 |
| 非 UTF-8 笔记 | 不做编码转码，打开时提示先转 UTF-8 | 明确边界，避免静默损坏 |
| Markdown 超长 PNG | 0.25× 下限；更长内容仍可能受 canvas 限制 | 建议 PDF；文档记录 |
| DNS rebinding | 校验与连接解析之间无地址钉扎 | 记录；高保证环境用出口过滤 |
| 无 macOS 运行时 CI | 只有编译 + 本地 Windows/Linux E2E | 记录；后续可加 macOS runner E2E |
| 无 UI 自动化 | 排序/树/重命名/wrap/fullscreen 无浏览器级断言 | 纯函数单测 + 手动/E2E 渲染；后续可加 WebDriver |
| 依赖开发期告警 | ESLint/minimatch moderate，不进入运行时 | `npm audit --omit=dev` 为 0；Dependabot 跟踪 |
| 导出 HTML 原文 | HTML 笔记导出保留脚本/样式；用户分享需自行审查 | 安全文档明示 |

---

## 7. 结论

v1.4.0 可以发布。所有已知高危/中危问题均已修复并有回归覆盖；剩余项属于签名、平台运行时、编码和极端长文档的产品边界，已在 README / SECURITY / TESTING / RELEASING 中记录。
