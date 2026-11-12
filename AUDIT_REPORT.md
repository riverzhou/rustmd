# rustmd 代码审计报告

**审计日期**：2026-11-13（v1.9.0 全量复核；v1.8.1 与 v1.8.0 于 2026-11-12）
**审计对象**：`rustmd` v1.9.0（Rust + Tauri 2，Markdown + HTML 笔记）
**审计方式**：全量阅读 Rust/前端/脚本/配置/文档；多轮静态检查与运行时回归；针对 HTML 渲染、导出、路径、IPC、Origin、CSP 做边界测试；Windows 本机真实 WebView2 端到端自测 + 浏览器 mock 状态回归；macOS arm64 CI 构建；GitHub Actions 三端构建与 Linux Xvfb E2E（发布时验证）。

### v1.9.0 最近库置顶 / 多库同开 / 侧栏布局（当前版本）

本版在 v1.8.1 基础上完成一轮“笔记库管理 + 侧栏空间”升级，并做全量代码/文档复核：

- **最近笔记库**：上限 20，条目改为 `{ dir, pinned }`（旧字符串数组自动升级）；
  置顶库固定显示在“置顶”分组最上方且不参与淘汰。`vaultlist.js` 的 MRU、
  去重、淘汰和置顶逻辑有 10 个 Node 单测覆盖。
- **多库同开**：`set_notes_roots` 注册所有已打开库根；`resolve_vault_file_in_roots`
  对 `rmd` 协议与 `read_local_image` 逐个根做 canonicalize + 前缀检查，仍拒绝
  位于所有根之外的文件。前端给每条笔记附加 `vault` 绝对目录，打开/保存/重命名/
  移动/删除/导出均使用该目录；文件夹树按库分组，各库子目录独立选择；关闭多库
  时保留当前笔记并提升其库为主库。
- **折叠与侧栏**：库根节点和各级子目录可折叠（库根状态存
  `rustmd-collapsed-vaults`，子目录沿用 `rustmd-expanded-folders`）；侧栏默认
  320px，文件夹/标签与笔记列表之间新增可拖动分隔条（`rustmd-nav-height`，
  双击重置、键盘可调），默认给笔记列表更大面积。
- **独立复核（两轮）**：第一轮分别审计 Rust、前端状态机、发布脚本/文档，发现并
  修复了刷新把不可用库误判为删除、HTML 导出切换笔记时图片上下文混用、浏览器
  mock 未知库共享 Map、分隔条在窗口缩放时覆盖用户偏好、多根注册 all-or-nothing、
  不可读子目录导致整库扫描失败、HTML 渲染结果缺少像素/载荷上限，以及临时 PDF
  清理、保存时二次读取、无 `<head>` 文档注入位置、非 UTF-8 笔记按标题/文件名
  搜索、渲染文档 ring 淘汰在途 token 等边界问题。修复后第二轮复核未发现未修复的
  高危或中危缺陷；剩余项为产品边界，记录在 §6。
- **验证**：`npm run check` 全绿（34 个前端单测、64 个 Rust 测试 = 63 通过 +
  1 个网络测试 ignored、clippy `-D warnings`、Vite build）；`npm run selftest`
  真实 WebView 6 篇示例 `ok: true`、0 errors、1 条远程图 warning，
  `--require-html` 通过；浏览器 mock 覆盖置顶/20 条上限/多库聚合/分组/跨库
  编辑保存/库根折叠/分隔条拖动与重置。

### v1.8.1 macOS 仅 Apple Silicon（arm64）发布策略

本版是发布目标收窄的补丁版，应用代码与 1.8.0 相同：

- macOS 只构建 `aarch64-apple-darwin`；移除 `x86_64-apple-darwin` 与
  `universal-apple-darwin`，不再产出 universal DMG，也不再支持 Intel Mac。
- release workflow 的 macOS job 显式安装 arm64 target、构建
  `target/aarch64-apple-darwin/release/bundle/macos/rustmd.app`，DMG 资产改名为
  `rustmd-<version>-macos-arm64.dmg`；CI 的 macOS 编译同步改为 arm64。
- README 中英文版、AGENTS、RELEASING、TESTING、AUDIT_REPORT 与 GitHub
  项目文案明确标注 macOS 仅 Apple Silicon，下载表与校验示例改为 arm64 资产名。
- 无 Rust/前端/权限/CSP/路径封闭/HTML 隔离/导出链路变化；仍由 release
  workflow 的 macOS runner 构建、ad-hoc 签名并验证 DMG。


### v1.8.0 当前文件夹范围与范围搜索（功能 + 后端参数）

本版把“默认只看当前文件夹”落地为明确的范围语义：当前文件夹指侧栏选中的
目录；刚打开/切换笔记库时当前目录是库根目录。改动同时涉及前端列表/搜索/
计数和 Rust 搜索参数：

- 搜索框下方新增“包含子文件夹”开关，状态存
  `localStorage.rustmd-include-subfolders`；关闭时列表、搜索、文件夹计数和
  标签云只覆盖当前目录的直属笔记，打开后覆盖整个子树。
- `notelist.js` 新增纯函数 `folderInScope` / `countTags`：前者统一“直属 /
  子树”判定，后者按当前范围统计标签；新增 2 个 Node 单测，前端单测总数 28。
  文件夹树关闭范围时显示 `direct`，打开时显示 `count`；切换目录/范围会重算
  标签并清除已不在范围内的活动标签。
- `search_notes` 新增 `folder` / `recursive` 参数：前端把当前目录和开关传给
  后端，`collect_notes_scoped` 先 `canonical_root` 再 `resolve_in_root` 校验
  目录，不递归时只读取该目录顶层文件；搜索范围与列表严格一致。新增 1 个
  Rust 范围搜索单测，Rust 测试总数 59（58 通过 + 1 个网络测试 ignored）。
- 空状态新增 `notes.emptyScope`：当前目录没有直属笔记但子目录有时提示打开
  开关，避免把“范围过滤”误判成空库。
- `api.js` 与浏览器 mock 同步 `folder` / `recursive`；未新增 IPC 命令，未改
  权限、CSP、HTML 隔离、路径封闭或导出链路。`folder` 参数来自 webview，但
  后端仍做 canonical root + 前缀检查。
- README 中英文版、AGENTS、架构/测试/安全/发布/审计文档同步更新；
  `capture-screenshots.mjs` 在截图前打开子文件夹范围并重新生成全部截图。

### v1.7.0 最近笔记库快速切换（UI 功能）

本版解决频繁切换笔记库时反复在系统目录树里找路径的问题，改动集中在前端：

- 侧栏 `#btn-change-dir` 改为弹出最近笔记库切换器：当前目录标记、一键切换、
  单条移除、ESC/点击外部关闭；按 Esc 关闭时焦点回到触发按钮；引导页复用同一列表。
- 最近目录按 MRU 最多保留 8 条，存于 `localStorage.rustmd-recent-dirs`；
  Windows 路径按大小写与 `/`、`\` 归一化去重。目录名/路径使用 `textContent`
  渲染，不拼进 `innerHTML`。
- “浏览其他目录…”沿用原生目录对话框，并传入当前笔记库作为 `defaultPath`；
  选择后直接打开，减少一次确认点击。
- 切换仍走 `enterDir`：先 `listNotes` + `setNotesRoot`，成功后才清空旧库状态；
  保存失败仍弹确认，`vaultSwitchBusy` 防止并发切换交错。
- 纯前端改动：无新增 IPC，无 Rust/权限/CSP/路径封闭/HTML 隔离边界变化。
  `vaultlist.js` 新增 6 个 Node 单测（路径规范化、Windows 去重、MRU 上限、
  移除、损坏存储容错）；浏览器 mock 覆盖切换、移除、ESC/焦点、语言切换和
  900×560 最小窗口布局。
- `scripts/capture-screenshots.mjs` 新增中英文 `vault-switcher` 截图；README、
  AGENTS、架构、测试、发布、安全与 GitHub 文案同步更新。

### v1.6.0 格式徽标（UI 补丁）

笔记列表与顶栏对 Markdown / HTML 统一显示格式徽标（`MD` 绿 / `HTML` 蓝），
替换“只有 HTML 有标记”的不一致。改动只涉及 `main.js`（列表渲染与顶栏 class
切换）、`index.html`（初始 class）和 `style.css`（两套主题变量与徽标样式），
没有新增命令、没有触碰渲染/导出/路径/IPC/安全边界。回归仍由 ESLint、前端
单测、Rust 测试和完整 `npm run selftest` 覆盖。

v1.6.1 追加：自测的远程图片探测失败降级为 `report.warnings`（首次失败后
跳过其余远程图，避免大量超时），第三方图床（picsum.photos）临时不可达不再
卡死发布门禁；本地图片、PNG/PDF 矢量文字、HTML 就绪等断言保持严格。
报告校验脚本会打印警告。

### v1.5.0 矢量 PDF 与跨平台打印审计

本版把 PDF 从「html2canvas 截图 + jsPDF 切片」改成**系统 WebView 打印管线**：

- 新增 `print_note_pdf` / `print_html_note`：Windows 走 WebView2
  `PrintToPdfStream`；macOS 走 WKWebView `NSPrintOperation`；Linux 走
  WebKitGTK 打印操作（`libloading` 运行时解析 GTK C API，构建不需要 GTK
  开发头文件）。失败/不支持时自动回退图片 PDF。
- macOS 打印改用 `runOperationModalForWindow:` + `canSpawnSeparateThread`，
  AppKit 分离打印线程，主线程只做文件轮询，导出期间界面不阻塞；Linux 删除了
  打印完成后在 GTK 主线程里的 5 秒轮询（等待移到后台线程）。
- 新增 `stamp_page_numbers`（lopdf）：macOS/Linux 在每页底部叠加居中的
  「N / M」页脚。关键点：先用 `q`/`Q` 包住原有内容，消除页面级 `cm` 造成的
  坐标偏移；字体资源是**复制合并**而不是替换，解析失败时原样返回，绝不破坏
  已生成的 PDF。
- HTML 笔记打印新增 `mode="print"` 隐藏窗口：按 A4 可打印宽度（约 669 px）
  创建，脚本等字体/图表/图片就绪后回报 `scrollWidth`，固定宽度页面按比例缩放。
- 安全性：两条打印命令都只接受 `main` 窗口调用；不接收输出路径。macOS/Linux
  只能写系统临时目录下的随机文件名，读回后立即删除。HTML 打印窗口沿用
  `html-render-*` label 校验，笔记脚本仍只能调用 `html_preview_finish`。
- 验证：Windows 真机 E2E 6 篇示例全部矢量（`/Font` 断言）且无回归；macOS
  的最终 ObjC 代码用 `cargo check --target x86_64-apple-darwin` 交叉编译通过；
  Linux 的 C 调用在 Windows 上同样参与编译；页脚戳记有单测 + 真实导出 PDF
  回归（原内容保留、字体资源合并不破坏）。macOS/Linux 的**运行时打印**仍需
  在对应系统执行一次 `npm run selftest` 复核。

### v1.4.2 文档与可发现性补丁

GitHub About 改为 **Markdown & HTML notes**，描述加入内置 WebView HTML 预览；
Topics 新增 `html`、`html-editor`、`html-notes`、`webview`（保持 20 个），并同步
README/AGENTS/GITHUB_PROJECT_COPY/架构/安全/测试/发布文档。应用代码与 v1.4.1
相同，v1.4.2 仅版本、文档和仓库元数据变化。

---

## 0. v1.4.1 增量（v1.4.0 发布后 Linux CI 发现）

v1.4.0 发布后的 Linux Xvfb E2E 暴露了两个 WebKit 平台问题，已在 v1.4.1 修复：

1. **HTML 本地 CSS/JS 在 WebKit 下不执行**：WebKit 对跨域 classic script/stylesheet
   发送 `Origin: null`，被 `rmd` 严格 Origin 白名单拒绝。现在预览与导出的文档会先把
   笔记目录内的相对 CSS/JS 内联（图片继续 data URL 内联），不再依赖跨域子资源请求；
   `serve_rmd` 仅对 `Sec-Fetch-Dest: script/style/font` 放行预览源，`fetch`（空 dest）
   仍 403。
2. **Markdown 导出图片在 WebKitGTK 被裁切**：html2canvas 忽略 `<img>` 的 `max-width`
   时，宽图表按自然宽度绘制并在画布右缘裁切（fig1 NCC 0.742）。导出前将图片冻结为
   同尺寸 `<canvas>` 并显式设置 CSS 宽度后，Linux CI 的 fig1/fig2/fig3 NCC 全部通过。

同时把 release `verify` 接入 Xvfb E2E + `--require-html` 报告校验 + release-notes
preflight，apt 下载加 IPv4/超时，避免 runner 网络等待导致发布卡死。对应 CI run：
`43159967569`（quality + 三端编译 + Linux E2E 全部通过）。

---

## 1. 执行摘要

| 维度 | 状态 |
|---|---|
| 未修复高危缺陷 | **0 个已知** |
| 未修复中危缺陷 | **0 个已知**（少数产品边界见 §6） |
| Rust 测试 | **64 个**：63 通过 + 1 个网络测试默认 `#[ignore]`（含范围搜索、多库根包含性、页脚戳记单测与真实 PDF 回归） |
| 前端单测 | **34 个**，全部通过 |
| 静态检查 | ESLint 0 error；`cargo fmt --check`；clippy `-D warnings`；`npm run check` 全绿 |
| 运行时回归 | `npm run selftest`：6 篇示例（含 HTML）`ok: true`、0 errors、1 条远程图 warning；矢量 PDF 字体、HTML iframe/本地资源与分段拼接断言均通过，`--require-html` 报告校验通过 |
| UI 交互 | 浏览器 mock：最近库钉死/20 条上限、多库聚合/按库分组/跨库保存、库根与子目录折叠、侧栏分隔条拖动/双击重置/键盘调整、当前目录范围、搜索、标签云、语言/主题切换通过；排序、树、重命名等仍以纯函数单测 + 手动检查为主 |
| macOS 编译 | macOS arm64（`aarch64-apple-darwin`）CI 构建；Intel/universal 已移除，运行时仍需在 Apple Silicon Mac 上自测 |
| Linux 运行 | GTK/WebKitGTK C 调用以 `libloading` 运行时解析；发布 workflow 在 Ubuntu + Xvfb 跑完整 selftest（含矢量 PDF `/Font` 断言） |
| 依赖审计 | `npm audit --omit=dev` 0 vulnerabilities；开发期 ESLint/minimatch moderate 告警（不进入运行时） |
| 许可证 | GPL-3.0-or-later（`LICENSE` / `package.json` / `Cargo.toml` / `tauri.conf.json`） |

**结论**：v1.9.0 的最近库置顶、多库同开、库根折叠与侧栏分隔条通过本轮全量复核；新增的 `set_notes_roots`/`resolve_vault_file_in_roots` 仍保持逐根 canonicalize + 前缀检查，没有放宽 CSP、HTML 隔离、SSRF、导出写路径或主窗口命令校验。v1.8.0 的当前目录范围/搜索、v1.5.0 的矢量 PDF 打印链路和内置 WebView 预览继续有效。历史上 v1.0.0 / v1.2.0 的高危项（未消毒 HTML、路径逃逸、SSRF、任意写）仍保持修复状态。

---

## 2. 本轮修复的高优先级问题

### H-1 `rmd` 协议 Origin 过宽（跨域读笔记库）

- **问题**：早期只拒绝 `Origin: null` / `rmdhtml`，其他任意 Origin 可带 `Access-Control-Allow-Origin: *` 读取 `rmd://` 文件；恶意 HTML 笔记可嵌套远程 iframe 读取笔记库。
- **修复**：`serve_rmd` 仅接受无 Origin 的普通子资源请求，或来自应用自身 webview 的 Origin（Tauri / 本地 dev server）；其余 Origin 一律 403；预览源的 `font`/`script`/`style` 子资源按 `Sec-Fetch-Dest` 放行（脚本/样式不能读取响应文本），`fetch`/XHR 仍 403。`Access-Control-Allow-Origin` 不再固定 `*`，只回显允许的 Origin。`rmd` 返回的 HTML/SVG 文档附加 sandbox CSP 和 `nosniff`。
- **回归**：`serve_rmd_rejects_preview_origins`；单测验证 null 默认 403、null+script/font 200、null+fetch 403、主 webview 200。

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
| M-14 | `docs/RELEASING.md` 说 release notes 可选，实际必需 | 改为必需并增加 workflow preflight |
| M-15 | 发布前 `npm run selftest` 未被 workflow 强制执行 | 文档明确、本地发布检查必跑；CI 已加 `--require-html`；release verify 加 release-notes preflight |
| M-16 | mock 模式路径/搜索与 Rust 不一致 | mock 增加路径规范化（含反斜杠/父目录）、`create/move` folder 校验、搜索剥离 front matter、`.htm` 重命名保留 |

---

## 4. 验证记录

本机（Windows 11，WebView2）执行：

```text
npm run check  → ESLint、34 前端单测、repo、version、fmt、clippy -D warnings、64 Rust 测试、Vite build 全通过
npm run selftest → 6 篇示例（含 examples/html-page-demo.html）通过；report ok:true、0 errors、1 条 picsum 远程图 warning；check-selftest-report --require-html 通过
```

自测覆盖：

- Markdown：残留公式、Mermaid 错误、MathJax 错误、多行矩阵 viewBox、远程/本地图片 NCC、内嵌 SVG 红蓝像素；
- HTML：sandbox iframe ready、本地相对 CSS/JS 执行、本地图片内联到导出源、PNG 非空/尺寸、PDF magic/尺寸、真实 `mode:'pdf'`；
- 超长 HTML：32k CSS px 报告导出 PNG 约 1,768×48,000，分段拼接完整；688499 报告 PNG 约 3,037×30,000（约 2.56×）；
- 手动安全：sandbox iframe 调 `read_note` 返回 `Origin header is not a valid URL`；`rmd` 对 null+fetch 返回 403，对 null+script/font 子资源放行；主 webview 本地图片正常。
- 最近笔记库切换：一库/多库切换、MRU 更新、单条移除、ESC/外部点击关闭、ESC 关闭后焦点返回、中英文动态文案、900×560 最小窗口布局；最近目录只写 `localStorage`，不进入笔记库或网络。
- 当前目录范围：默认只显示根目录直属 2 篇；根目录搜索不返回子目录命中；打开开关后 7 篇全部出现并命中子目录搜索；选中 `work` 后关闭开关只显示 3 篇直属笔记；刷新页面后开关状态保持。

CI：Windows / Ubuntu 构建；macOS 构建 `aarch64-apple-darwin`；Linux Xvfb E2E；GitHub tag 触发 release workflow（verify 先跑 `npm run check` + Xvfb E2E + release-notes preflight），再生成 Windows zip、Linux deb/AppImage、macOS arm64 DMG，并由 `publish` 汇总 `SHA256SUMS.txt`。

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
| macOS Intel | 1.8.1 起只提供 Apple Silicon（arm64）构建，Intel Mac 不受支持 | README/RELEASING/AUDIT 明确标注；如需 Intel 需回退到 1.8.0 或自行改 target 构建 |
| 本地 HTML 字体/模块 | 字体按 `font` 目的放行；ES module（CORS `script`）仍可能受 Origin 限制 | 文档说明；如需要可改为 token 化资源协议 |
| 非 UTF-8 笔记 | 不做编码转码，打开时提示先转 UTF-8 | 明确边界，避免静默损坏 |
| Markdown 超长 PNG | 0.25× 下限；更长内容仍可能受 canvas 限制 | 建议 PDF；文档记录 |
| DNS rebinding | 校验与连接解析之间无地址钉扎 | 记录；高保证环境用出口过滤 |
| 无 macOS 运行时 CI | 只有编译 + 本地 Windows/Linux E2E | 记录；后续可加 macOS runner E2E |
| macOS 打印运行时 | macOS arm64 由 CI 构建，但尚未在真机跑打印；Linux 已由 Ubuntu Xvfb E2E 覆盖 | 发布前在 Apple Silicon Mac 上跑一次 `npm run selftest`；任何打印失败都会自动回退图片 PDF |
| Linux 打印主线程渲染 | WebKitGTK 没有异步打印 API，`webkit_print_operation_print` 会在 GTK 主线程渲染页面 | 已把文件等待移到后台线程；超长文档仍可能在渲染期间短暂停顿，必要时评估独立打印进程 |
| 无 UI 自动化 | 排序/重命名/wrap/fullscreen 仍无浏览器级断言（最近库、多库、折叠、分隔条与当前目录范围已做浏览器 mock 检查） | 纯函数单测 + 手动/E2E 渲染；后续可加 WebDriver |
| 依赖开发期告警 | ESLint/minimatch moderate，不进入运行时 | `npm audit --omit=dev` 为 0；Dependabot 跟踪 |
| 大库/慢图床卡顿 | `list_notes`/搜索/`fetch_image_bytes` 仍在同步命令内完成，超大库或慢图床可能短暂占用 UI 线程 | 现有行为；后续迁移 `spawn_blocking` |
| 超长 HTML 渲染 | `html_preview_finish` 的解码/拼接有像素/载荷上限，但仍在同步命令内完成，极端长页面可能短暂停顿 | 上限已防 OOM；后续可迁移 `spawn_blocking` |
| macOS 打印超时临时文件 | >180s 打印超时后，已 detach 的 AppKit 线程可能重新写出临时 PDF | 仅超时路径；正常路径有 Drop guard 清理 |
| IPC PNG 编码 | 渲染 PNG 以 JSON 数字数组回传，极端长图有额外序列化开销 | 已有像素上限；后续可改二进制 IPC |
| 原子写元数据 | 保留 Unix mode；Windows ACL、macOS xattr/标签不复制 | 文档记录；内容与冲突检测不受影响 |
| 冲突 token | 64-bit `DefaultHasher`，能写盘者可构造碰撞 | 仅影响外部修改检测，需本地写权限；后续可换 SHA-256 |
| 本地偏好 | 最近目录（最多 20 个路径，含置顶）、多库开关、库根/子目录折叠、侧栏高度与“包含子文件夹”开关存于 WebView `localStorage`，不加密 | 仅本机使用、不上传；清除应用数据即可删除 |
| 导出 HTML 原文 | HTML 笔记导出保留脚本/样式；用户分享需自行审查 | 安全文档明示 |

---

## 7. 结论

v1.9.0 可以发布。最近库置顶、多库同开、库根折叠与侧栏分隔条均完成代码、文档、截图和回归验证；README/AGENTS/RELEASING/TESTING 与 release workflow 保持一致；当前目录范围、范围搜索、矢量打印链路和最近笔记库切换继续有效。剩余项属于签名、平台运行时、编码和极端长文档的产品边界，已在 README / SECURITY / TESTING / RELEASING 中记录。
