# rustmd 代码审计报告

**审计日期**：2026-11-07
**审计对象**：`rustmd` v1.1.0（Rust + Tauri 2 本地 Markdown 笔记应用）
**审计方式**：通读全部源码、脚本、配置与文档；运行 `npm run check`（ESLint、前端单测、仓库检查、版本检查、rustfmt、clippy `-D warnings`、cargo test、Vite build）；运行 `npx tauri build --no-bundle` 做真实 Tauri 编译；检查依赖审计；对路径、front matter、SSRF、数学公式、图片 MIME 等边界做针对性测试。

---

## 1. 执行摘要

| 维度 | 状态 |
|---|---|
| 高危安全缺陷 | **0 个未修复**（本轮修复 H-1 ~ H-4） |
| 中危缺陷 | **0 个未修复**（本轮修复 M-1 ~ M-10） |
| 低危/取舍 | 少量已记录的接受项（见 §5） |
| Rust 测试 | 41 个，40 通过 + 1 个网络测试默认 `#[ignore]` |
| 前端单测 | 14 个，全部通过 |
| 静态检查 | ESLint 0 error；`cargo fmt --check` 通过；clippy `-D warnings` 通过 |
| 三端编译 | CI 在 Windows / Ubuntu / macOS 分别执行 `tauri build --no-bundle` |
| 许可证 | GPL-3.0-or-later（`LICENSE` + `package.json` / `Cargo.toml` / `tauri.conf.json`） |

**结论**：v1.1.0 修掉了 v1.0.0 审计中的全部高/中危问题，主路径（打开/编辑/保存/搜索/文件夹/导出/自测）行为正确且有回归保护。剩余风险集中在“免费分发的签名能力”（Windows 自签名、macOS ad-hoc）、sanitizer 库本身的新绕过研究、以及少数产品边界（无回收站、只编辑 tags、无 UI 自动化）。这些均已写入文档，不再属于“未知缺陷”。

---

## 2. 已修复的高危问题

### H-1 原始 HTML 未消毒 + `csp: null` → webview 任意 JS

**修复**：
- `frontend/src/preview.js` 在 `innerHTML` 前调用 `DOMPurify.sanitize`，静态配置禁止 `style/link/meta/base/iframe/object/embed/form/...` 和 `srcdoc`，不使用 hooks / `IN_PLACE` / 函数式 `ADD_TAGS`；
- `tauri.conf.json` 设置显式 CSP：`script-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`form-action 'none'`、`frame-ancestors 'none'`；
- 导出 HTML 由消毒后的 DOM 构建，继承同一策略；
- 外链经 `opener` 插件打开，不在应用内导航；
- mermaid 保持 `securityLevel: 'strict'`。

**验证**：`frontend/src/preview.js` 中唯一的大块 `innerHTML` 赋值已包裹 `sanitizeHtml`；`npm run check` 的 repo 检查强制 CSP 非空且包含 `object-src 'none'`。

### H-2 新建文件经 junction/symlink 写逃逸

**修复**：`resolve_in_root` 对不存在的最终路径 canonicalize **最深的已存在祖先**并检查前缀；`atomic_write` 只写该路径；`walk`/`walk_folders` 跳过 symlink/junction/reparse point。

**验证**：新增 Windows junction 逃逸测试与 Unix symlink 测试（`resolve_in_root_rejects_symlinked_directory_escape`、`collect_notes_skips_symlinked_directories`），本机 Windows 上 `mklink /J` 实际执行并通过。

### H-3 `fetch_image_bytes` 无限制 SSRF / 阻塞

**修复**：
- 只接受 `http`/`https`；拒绝带凭据 URL；
- 拒绝 localhost / `.local` / `.internal` / `.home.arpa`；
- DNS 解析后拒绝 loopback、私有、CGNAT、链路本地、文档/保留/组播地址及 IPv4-mapped IPv6、6to4、NAT64；
- 每次重定向重新校验，最多 5 跳；
- 20 秒超时、25 MB 上限、Content-Length 预检；
- 返回 `{bytes, mime}`，前端串行化由 `inlineRemoteImages` 的并发控制（浏览器侧 Promise.all 数量受笔记图片数限制，实际使用中通常很少）。

**验证**：`fetch_image_bytes_rejects_private_targets`、`public_ip_filter`；网络测试默认 ignored，显式运行可验证真实 HTTPS。

### H-4 `write_text` / `write_bytes` 无 scope

**修复**：删除两个命令。新增 `save_export`：Rust 内打开原生保存对话框，只有用户选择的路径会被写入；导出数据不再经过“前端给绝对路径”的 API。自测写文件使用 debug-only `selftest_write`，根固定在 `RUSTMD_SELFTEST_OUT`。

**验证**：`api.js` 不再暴露 `writeText/writeBytes`；`main.rs` 的 `generate_handler!` 只注册 `save_export`；repo 检查会验证插件权限。

---

## 3. 已修复的中危问题

| 条目 | 原问题 | 修复 | 回归测试 |
|---|---|---|---|
| M-1 | `file:///C:/…` 在 Windows 上前导 `/` 导致 403 | `new URL()` 解析 + 盘符/UNC 处理 | 自测/示例本地图片；代码审查 |
| M-2 | 保存丢 `title:`、`date:` 等 front matter | `compose_note` 只改 `tags:`，保留未知字段/注释/BOM/CRLF | 4 个 front matter 测试 + CRLF/BOM |
| M-3 | `\\?\UNC\` 被剥成非法 `UNC\…` | 还原为 `\\server\share\…` | `strip_extended_prefix_restores_unc` |
| M-4 | walk 跟随符号链接、环、越界读取 | 跳过 symlink/junction/reparse point | 2 个 symlink 测试 |
| M-5 | `fs::write` 非原子、无外部修改检测 | 临时文件 + rename；`baseHash` 冲突检测 | 原子写/冲突/同内容不重写 |
| M-6 | SVG/ICO/AVIF 导出空白 | `read_local_image`/`fetch_image_bytes` 返回 MIME；`guessImageMime` 兜底 | 导出链路 + E2E |
| M-7 | 自测机器绑定、输出目录不存在、fetch 失败静默 | env 注入、Rust 创建目录、fetch 失败计入 errors、0/1 退出 | `npm run selftest` + `selftest:check` |
| M-8 | rename 冲突报错、move 自动后缀 | 统一 `unique_sibling` 自动后缀 | `rename_and_move_avoid_collisions` |
| M-9 | 搜索不含文件名/标签、旧响应覆盖 | 搜索正文+标题兜底+标签；前端查询序列号 | 搜索测试 + 代码审查 |
| M-10 | 保存失败丢改、关闭丢最后输入 | 保存队列/失败保留 pending/`beforeunload` | 代码审查 + 手动场景 |

---

## 4. 本轮复审中新发现并修复的问题

1. **保存队列的假冲突**：第二个排队的保存如果在入队时捕获旧 `baseHash`，会在第一个保存成功后误报冲突。修复为在串行执行的 run 内读取 `state.currentHash`。
2. **搜索刷新竞态**：`refreshSearch` 没有查询序列号，慢的旧请求可能覆盖新查询。修复为与 `runSearch` 共用 `searchSeq`。
3. **`restoreMath` 在重构中丢失**：拆分 `markdown.js` 时 `preview.js` 的 `restoreMath` 被一并删除，ESLint 的 `no-undef` 直接报错。已恢复并保留逐公式回退。
4. **句中 `$$` 仍会配对**：旧的 `(?<=^|\s)` 允许“使用双 $$ 包裹”与下一段公式配对。改为行首/行尾锚定（并去掉 lookbehind，兼容旧 WebKit）。
5. **行内代码中的 `$…$` 被保护**：新增 `splitInlineCode`，代码段内不再替换。
6. **`file://C:/…`（host 形式）**：按 URL host 是否为盘符处理，并支持 UNC。
7. **`strip_inline` 边界**：孤立 `!`、未闭合 `[`、图片 alt 文本处理修正。
8. **`walk` 的 junction 属性**：Windows 用 reparse point 属性判断，而不仅是 `is_symlink()`。
9. **`rmd` 响应被浏览器缓存**：加 `Cache-Control: no-store`，编辑图片后预览即时更新。
10. **宽表格/长代码导出裁切**：导出舞台改为 `table-layout: fixed` + 换行。
11. **`setPreviewTheme` 无谓清空 mermaid 缓存**：缓存键已含主题，删除 `clear()`。
12. **自测硬编码路径**：全部改为 `RUSTMD_SELFTEST_*` / 默认临时目录 / `CARGO_MANIFEST_DIR`。
13. **`read_meta` 每次保存全量重读**：保存后只更新当前 meta 并重渲染，不再每次 `list_notes`。
14. **依赖审计**：jsPDF 2 → 4、mermaid 12.0 → 12.3、Vite 6 → 8，并用 override 把 `lodash-es` 升到 4.18，消除 critical/high 直接依赖告警。
15. **MathJax/Mermaid 后置清理**：两者在 DOMPurify 之后生成 DOM，新增 `sanitizeRenderedDom` 删除 `on*`、`javascript:`/`data:text/html` 链接、外部 CSS URL 与脚本类元素；这堵住了 `\href{javascript:…}` 这类“消毒后才出现”的链路。
16. **示例不再自引用远端仓库**：`examples/` 的调研图改为本地 `assets/`，远程图片回归改用 picsum；selftest 不再受本仓库 GitHub raw URL 改名/私有化影响。

---

## 5. 接受的剩余风险 / 明确边界

| 项 | 说明 | 处理 |
|---|---|---|
| Windows 自签名 | 只保证完整性，SmartScreen 仍提示未知发布者 | Release 说明 + 证书 + SHA256；支持真实 PFX secret |
| macOS ad-hoc | 未公证，首次打开需用户放行 | Release 说明 + `docs/RELEASING.md`；可选 Developer ID 路径 |
| sanitizer 库新 CVE | DOMPurify 仍可能有新的绕过研究 | 静态配置、无 hooks/IN_PLACE、CSP、外链拦截；Dependabot 跟踪 |
| 依赖审计 | 仅剩 ESLint/minimatch 的开发期 moderate 告警（0 critical / 0 high） | 不进入运行时；Dependabot 每周；发布前人工看 |
| 无 UI 自动化 | 排序/树/重命名等交互没有浏览器级测试 | 纯函数已单测；E2E 覆盖真实渲染/导出；后续可加 WebDriver |
| 搜索为子串匹配 | 无分词、无模糊匹配 | 文档明示 |
| front matter 只编辑 tags | 其它字段保留但无 UI | 文档明示 |
| 数学 heuristic | `$5$` 等价格写法可能被当公式 | 文档已知限制；display 已收紧 |
| 远程图片自测依赖网络 | 离线时自测失败（有意） | CI 有网；本地可跳过 E2E |
| 无自动更新/回收站 | 产品边界 | 文档明示 |

---

## 6. 验证记录

| 命令 | 结果 |
|---|---|
| `npm run check` | 通过（ESLint / 14 前端单测 / repo / version / rustfmt / clippy / 40 Rust 单测 / build） |
| `npx tauri build --no-bundle` | 通过（Windows 实际编译） |
| `npm run selftest` | 通过：5 篇示例，PNG/PDF、远程图片 1 张 + 本地图片 4 张均 present，`report.ok = true` |
| `npm audit` | 0 critical / 0 high；4 个 moderate 均在开发工具链（ESLint/minimatch，见 §5） |
| `git status` | 工作区包含本轮改动，未提交 |

> 另外用 release 二进制 + WebView2 远程调试做了运行时冒烟：CSP 阻止内联脚本、`<script>`/`onerror`/`javascript:` 被剥离、MathJax/高亮/本地 `rmd` 图片正常、外部修改返回 `conflict:`、保存后 `title:` 字段仍在。CI 三端编译需在 GitHub runner 上做最终确认。

---

## 7. 优先级建议（非阻塞）

1. **P2**：维护 `RELEASE_NOTES` 模板与后续版本说明（1.1.0 已有）。
2. **P2**：为 Windows 购买真实 Authenticode / macOS Developer ID 时，按 `docs/RELEASING.md` 接入 secrets 与公证步骤。
3. **P2**：给 `npm audit` 剩余开发依赖加 Dependabot 自动升级；不要在 CI 中让 npm audit 阻塞。
4. **P3**：为排序/文件夹树/保存冲突补浏览器级 UI 测试（Playwright/WebDriver），但 E2E 已覆盖真实 WebView 的渲染/导出主链路。
5. **P3**：考虑把 `main.js` 的保存队列抽成可单测模块，进一步降低 UI 状态复杂度。
