# 安全模型

rustmd 打开的是用户本地文件夹，但笔记内容、图片 URL、front matter 都可能来自不受信任的来源（同步盘、下载的笔记库、他人分享）。威胁模型按“笔记库可能恶意、webview 持有完整 IPC”设计。

## 信任边界

| 组件 | 信任级别 | 说明 |
| --- | --- | --- |
| Rust 命令 | 可信 | 但参数来自 webview，必须自行校验 |
| webview 前端 | 受 Markdown HTML 影响 | Markdown 渲染结果必须消毒 + CSP；HTML 笔记在 sandbox iframe / 隐藏 WebView 中隔离渲染 |
| 笔记文件 | 不可信 | 正文、front matter、图片引用都不能直接执行/越界 |
| 远程图片 | 不可信 | URL 可指向内网/元数据服务，必须 SSRF 防护 |
| 导出的文件 | 用户数据 | Markdown 导出内容来自已消毒 DOM；HTML 笔记导出按用户预期保留原始源码；目标路径由用户在原生对话框选择 |

## 已实施的控制

### 1. HTML 消毒

- **Markdown 笔记**：`preview.js` 在 `innerHTML` 前调用 `DOMPurify.sanitize`，使用静态配置。
- **HTML 笔记预览**：`set_html_preview` 把文档存入内存，通过 `rmdhtml` 协议加载到 `sandbox="allow-scripts allow-forms"` 的 iframe（没有 `allow-same-origin`，origin 为 null）。脚本/样式/ECharts 以及本地相对的 CSS/JS/字体/图片在 iframe 内原生运行，但 Tauri IPC 对该 origin 返回 `Origin header is not a valid URL`，父页面 DOM 也不可访问。
- **HTML 笔记导出**：`render_html_note` 只在隐藏的独立 Tauri WebView 窗口中运行（label `html-render-*`）；除 `html_preview_finish` 外，所有保险库命令都通过 `require_main` 拒绝该窗口。超长页面分段截图后由 Rust 拼接，不需要外部浏览器。
- **本地资源与读隔离**：HTML 预览/导出会内联相对 CSS/JS 与图片，字体走 `rmd`。无 Origin 的普通 `<img>/<link>/<script>` 请求允许；带 Origin 的 CORS 请求只接受应用自身 webview（Tauri / 本地 dev server），以及预览源的 `font`/`script`/`style` 子资源（按 `Sec-Fetch-Dest` 判定，脚本/样式不能读取响应文本）。`fetch`/XHR（空 dest）、文档读取、远程 iframe 一律 403。响应不再返回 `Access-Control-Allow-Origin: *`，`rmd` 的 HTML/SVG 文档还附带 sandbox CSP + `nosniff`，恶意笔记无法用 `fetch` 读取笔记库文本。
- **多库模式边界**：多库同开时 `set_notes_roots` 会注册所有已打开库根，`rmd`/`read_local_image` 只服务规范化后位于至少一个根下的文件。副作用是：A 库中的笔记（或它引用的相对 `../` 路径）可以读取/显示 B 库中已打开的本地图片，或加载 B 库中的 classic `<script>` 子资源；这不能读取文本、调用 IPC 或越过两个库的并集，且 B 必须是用户显式打开的库。不要把来源不可信的库与包含敏感文件的库同时置顶打开；关闭多库/退出应用会撤销不再活跃的根。
- 静态配置，不使用 hooks、`IN_PLACE`、函数式 `ADD_TAGS/ADD_ATTR`、自定义元素；禁止 `style/link/meta/base/iframe/object/embed/form/textarea/select/option/button` 和 `srcdoc`。
- DOMPurify 默认剥离 `<script>`、`on*` 事件、`javascript:` URL 等。
- Mermaid 使用 `securityLevel: 'strict'`；它生成的 SVG 在消毒之后挂载，不来自笔记原文。
- MathJax/Mermaid 在 DOMPurify **之后**运行，因此 `sanitizeRenderedDom` 再做一次窄范围清理：删除 `script/iframe/object/embed`、`on*` 事件、`javascript:`/`data:text/html` 等危险 URL、以及 mermaid `<style>` 中的 `@import`/外部 `url(...)`。
- Markdown 的 HTML 导出由消毒后的 DOM 构建，因此导出文件同样不含脚本/事件属性；HTML 笔记的“导出 HTML”按用户预期保存原始源码（脚本/样式保留）。

### 2. CSP

`tauri.conf.json` 的 `app.security.csp` 非空：

- 主应用：`default-src 'self'`、`script-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`form-action 'none'`、`frame-ancestors 'none'`；`frame-src http://rmdhtml.localhost rmdhtml:` 只为 HTML 预览 iframe 放行；
- 主应用 `style-src 'self' 'unsafe-inline'`（MathJax/Mermaid 注入样式所需）；
- 主应用 `img-src` 允许 `data: blob: http: https: rmd:`（远程图 + 笔记库本地图）；
- 主应用 `connect-src` 只放 IPC 和本地 dev server；`worker-src 'self' blob:`；
- `rmdhtml` 预览文档另有两套更窄的 CSP：sandbox iframe 允许内联/HTTPS/本地 `rmd` 脚本、样式、字体、图片、嵌套 frame，但 `connect-src` 不含 IPC；隐藏导出窗口同样允许这些资源，并额外允许 `ipc:` 供 `html_preview_finish` 回传截图。两套 CSP 都设置 `object-src 'none'`、`form-action 'none'`。

### 3. 路径封闭

- 所有笔记路径经 `resolve_in_root`：拒绝绝对路径/`..`，已存在路径 canonicalize 后前缀检查；新路径检查最深已存在祖先，阻止 junction/symlink 写逃逸。
- `walk` 跳过符号链接/junction，避免环和越界；只把 `.md` / `.html` / `.htm` 当作笔记。
- 范围搜索的 `folder` 参数来自 webview，后端仍先 `canonical_root` 再 `resolve_in_root`：非法/缺失目录直接报错，不会越出笔记库扫描。
- `rmd` 图片协议与 `read_local_image` 使用 `resolve_vault_file_in_roots`：逐个检查所有已注册的库根（多库同开时可能多个），只有规范化后位于至少一个根下的文件才会被服务；不会因为多库而放弃前缀检查。
- Windows `\\?\UNC\` 正确还原，不会把网络共享路径改坏。
- 唯一的前端可触发“库外写”是 `save_export`，它在 Rust 内打开系统保存对话框，前端不提供目标路径。
- `print_note_pdf` / `print_html_note`（矢量 PDF）只把已经渲染好的文档（主窗口离屏舞台 / 隐藏 `html-render-*` 窗口）交给系统打印引擎，不接收输出路径；导出的字节仍由 `save_export` 落盘。Windows 不写文件；macOS/Linux 的打印引擎只能写文件，因此写到系统临时目录下随机命名的 `.pdf` 并在读回后删除。HTML 打印窗口与截图窗口使用同一套 label 校验，笔记脚本依然只能调用 `html_preview_finish`。

### 4. SSRF

`fetch_image_bytes`：

- 仅 `http`/`https`，拒绝带用户名/密码的 URL；
- 拒绝 `localhost`、`.localhost`、`.local`、`.internal`、`.home.arpa`；
- DNS 解析后拒绝 loopback、私有网段、CGNAT、链路本地、文档/保留/组播/未指定地址，以及 IPv4-mapped IPv6、6to4、NAT64；
- 每个重定向目标重新校验，最多 5 跳；
- 20 秒超时、25 MB 上限、Content-Length 预检。

### 5. 保存与导出

- 笔记按 UTF-8 读取；非 UTF-8 文件会在列表中出现，打开时明确提示先转 UTF-8，不会被静默隐藏或覆盖。
- 笔记保存用同目录临时文件 + rename，避免半截文件。
- `baseHash` 冲突检测；外部修改不会被静默覆盖，必须用户确认。
- 保存失败保持“未保存”状态；关闭窗口有 `beforeunload` 提示。
- 导出对话框在 Rust 侧打开，写入用户选择的路径。

### 6. 外链

- 预览中的 `<a href>` 点击被拦截；http(s)/mailto 通过 Tauri `opener` 插件交给系统浏览器，其余协议拒绝。
- 不再发生“点链接把应用页面导航走”。

## 残余风险与取舍

1. **DOMPurify 库本身**：任何 sanitizer 都可能有新的绕过研究。本项目只使用字符串模式 + 静态配置（避开多数配置型 CVE），并叠加 CSP 与外部链接拦截；仍建议只打开可信来源的笔记库。
2. **Windows 自签名**：只保证完整性，不建立公共信任；SmartScreen 仍会警告。真实证书需要用户自行配置。
3. **macOS ad-hoc**：未公证，首次打开需要用户放行；不能防止用户主动运行被篡改的包。请用 SHA256 校验。
4. **远程图片**：导出或预览时会把笔记中的 URL 发给对应服务器，可能泄露“打开了这篇笔记/这个 URL”这一事实；不会把笔记正文发出去。DNS rebinding（校验时解析到公网、连接时解析到内网）没有做地址钉扎，只做了“解析结果不得包含内网地址”的检查；需要更高保证时请在网络层做出口过滤。
5. **HTML 笔记的渲染隔离**：预览 iframe 是 null origin，无法调用应用命令；导出隐藏窗口的 label 被所有保险库命令拒绝。页面仍可像普通网页一样加载远程资源（CDN 图表脚本、远程图片），相对 CSS/JS 与图片会内联；字体等剩余资源走 `rmd`。`rmd` 只放行预览源的 classic script/style/font 子资源，`fetch` 和文档读取仍返回 403。导出截图/临时状态在渲染后清理。
6. **导出 HTML**：Markdown 导出是消毒后的快照；HTML 笔记导出保留原始源码（含脚本/样式）。用户若在原笔记中放入了敏感文字，导出文件会原样包含。
7. **本地明文**：笔记是普通 `.md` / `.html` 文件，不加密；依赖操作系统/磁盘加密保护。最近打开的笔记库路径（最多 20 条，含置顶标记）保存在 WebView 的 `localStorage.rustmd-recent-dirs` 中，“包含子文件夹”与“多库同开”偏好保存在 `localStorage.rustmd-include-subfolders` / `rustmd-multi-vault`；均不加密、只在本机使用，不会上传或随笔记库同步；清除应用数据即可删除。
8. **无自动更新**：应用不会自行下载/执行代码；用户手动安装新版本。
9. **依赖供应链**：CI 使用 `npm ci` + `Cargo.lock`；Dependabot 每周检查。当前没有 SLSA/签名软件物料清单，发布资产用 SHA256 校验。
10. **GPL-3.0-or-later**：源码与二进制的分发、修改需遵守 GPL 条款；这是许可证边界，不是安全控制。

## 给用户的安全建议

- 只打开自己信任的笔记库；打开下载/他人分享的笔记库前先备份。
- 从官方 Release 下载，核对 `SHA256SUMS.txt`；Windows 首次运行确认发布者提示；macOS 在“隐私与安全性”中放行。
- 不要把包含密钥/密码的笔记导出后公开分享。
- 如果发现可疑 HTML、路径逃逸、SSRF 或签名问题，请通过仓库 Issue 私下说明复现步骤（不要公开敏感笔记内容）。

## 审计与验证

- `AUDIT_REPORT.md` 记录当前审计状态与已修复项。
- `npm run check` 覆盖路径、保存、SSRF 单测；`npm run selftest` 覆盖真实 WebView 渲染与导出（HTML 条目要求 iframe ready + PNG/PDF 产出；CI 传 `--require-html` 防止静默丢失 HTML 覆盖）。
- 发布前跑 `npm run check` + `npm run selftest`，并检查 CI 三端编译。
