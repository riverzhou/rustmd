# rustmd 深度审计报告

**审计日期**：2026-10-28
**审计对象**：`D:\GitHub\rustmd`（v1.0.0，Rust + Tauri 2 本地 Markdown 笔记应用）
**审计方式**：通读全部源码（Rust 1116 行 / 前端约 2700 行 / 脚本与配置全部）与全部文档（README、CHANGELOG、AGENTS.md）；运行 `cargo test`（21/21 通过）与 `npm run build`（成功）；对可疑点用 rustc / node 做了独立实验验证（见各条目的"验证"）；并对照本机 cargo registry 中的 tauri 2.12 源码核实了 IPC 执行模型。

---

## 1. 执行摘要

| 维度 | 评价 |
|---|---|
| 代码质量 | **优秀**（注释解释"为什么"，边界处理用心，风格一致） |
| 测试 | **良好偏优**（21 个单测全部通过且有真实回归测试；E2E 自测超出同类项目水准；但 UI 层零测试、测试有机器绑定路径） |
| 文档 | **优秀**（README/CHANGELOG/AGENTS.md 三角一致，gotchas 带根因，修复记录带动机） |
| 组织逻辑 | **清晰合理**（单一 Rust 文件 + 单一 api.js 桥是刻意的、成文的决策；唯一结构性问题是 main.js 里内嵌了 510 行自测代码） |
| 安全 | **存在 1 个高危 + 2 个中高危缺陷**，与代码整体质量形成反差 |

**结论**：这是一个完成度和工程素养都很高的个人项目，主路径（打开/编辑/保存/搜索/导出/自测）行为正确且有回归保护。但**渲染管线缺少 HTML 消毒**这一高危问题，把整个应用其它地方辛苦建立的"路径封闭"安全模型一次性击穿：一条恶意 `.md` 文件 = webview 内任意 JS = 任意文件写 + SSRF + 数据外泄。这是发布前必须修复的第一优先级。其余问题（`file:///` 图片在 Windows 上失效、front matter 数据丢失、junction 写逃逸、UNC 路径损坏等）多为平台边角或设计缺口，均有明确修法。

---

## 2. 缺陷清单

严重度定义：**高** = 安全或数据丢失，有现实利用/触发路径；**中** = 功能损坏或明显数据/健壮性风险；**低** = 边角、性能、可维护性。

### 2.1 高危（安全）

#### H-1 笔记内容中的原始 HTML 未经消毒，在特权 webview 中执行 → 任意文件写 / SSRF / 数据外泄

- **位置**：`frontend/src/preview.js:436`（`container.innerHTML = marked.parse(...)`）；`tauri.conf.json:23`（`"csp": null`）；全部前端（无任何 sanitizer，`grep` 确认）
- **描述**：marked 15 不做任何消毒。实测（node 复现，marked 15.0.12、`gfm+breaks` 与 preview.js 完全一致）以下向量**全部原样通过**：
  - `<script>…</script>` 块
  - `<img src=x onerror=…>`（行内与独立成块均通过）
  - `<iframe src="javascript:…">`、`<div onmouseover=…>`、`<svg onload=…>`、`<body onload=…>`
  - `<a href="javascript:…">`
  这些 HTML 被 `innerHTML` 注入到 Tauri webview。该 webview 持有完整 IPC：`window.__TAURI_INTERNALS__` 可调用**全部 14 个 app 命令**（`gen/schemas/acl-manifests.json` 中不存在 app 级 ACL，capabilities 只限 core+dialog 插件，app 命令默认全开）。而 `write_text`/`write_bytes` 对任意绝对路径无限制（见 H-4），`fetch_image_bytes` 可拉取任意 http(s)（见 H-3）。
- **利用链**：vault 文件夹里放入一个 `.md`（来源：同步盘、下载解压、他人分享、甚至自己打开"整个 Documents 文件夹"当 vault）→ 打开即执行任意 JS → `invoke('write_text', {path:'C:/任意路径.txt', content:'…'})`。数据外泄、持久化、破坏用户文件都成立。
- **验证**：node 脚本对 9 个向量逐一跑 `marked.parse` 确认全部 passthrough；确认 node_modules 中 dompurify 仅是 mermaid 的**传递依赖**，本项目未使用。
- **为什么容易漏**：examples 里就有原生 `<div>/<table>/<details>` 块（§5），说明"支持 raw HTML"是有意为之；自测也在真实 webview 里渲染这些 HTML，全部"成功"——自测只验渲染正确性，不验安全性。
- **建议修复**：
  1. 把 DOMPurify 提为显式依赖，在 `innerHTML` 前消毒；allowlist 需放行 `mjx-container`、mermaid 产物、`<details>/<summary>`、表格等；脚本与 `on*` 事件一律剥离（mermaid 已用 `securityLevel:'strict'`，对齐该标准即可）。
  2. 给 webview 加 CSP（meta 或 `tauri.conf.json`），至少禁 inline script / `unsafe-inline`。
  3. 导出 HTML 同样注入消毒后的内容（否则导出的文件被他人打开仍是攻击载体）。
- **注意**：消毒会改变"笔记可写任意 HTML"的现有行为，需在 CHANGELOG/README 明示策略（推荐：保留样式类 HTML，剥离脚本/事件/危险协议）。

#### H-2 路径封闭在新建文件时经由 junction/symlink 被绕过（已实测复现）

- **位置**：`src/main.rs:79-89`（`resolve_in_root`：仅当 `inside.exists()` 才做 canonicalize 封闭检查）；受影响调用：`save_note_impl`（main.rs:396）、`create_note`（main.rs:422）、`move_note`（main.rs:472，经由"新 dest 子目录"）
- **描述**：对**不存在**的最终路径，`resolve_in_root` 直接返回未规范化的拼接路径；随后 `create_dir_all(parent)` + `fs::write` 会跟随中间目录上的 junction/symlink。
- **验证**（rustc 实验）：temp 目录建 `junction vault/esc → outside`，模拟 `save_note_impl(root, "esc/evil.md")` 的最终步骤 `fs::write(root/esc/evil.md)` → **文件落在 vault 之外**（`outside/evil.md` 存在，实测输出 `file landed OUTSIDE root: true`）。Windows 普通用户在 developer mode 下即可 `mklink /J` 建 junction（本次实验即以普通权限建成）。
- **影响面**：rmd 协议与读路径安全（`resolve_vault_file` 永远 canonicalize；读的文件必然已存在）；**只有"新建"路径族受影响**。触发前提：vault 内存在指向外部的 junction（恶意 zip、同步工具、他人拷贝的笔记库都能带入）。
- **矛盾点**：AGENTS.md 明确写着 "resolve_in_root … has tests. Don't relax it." —— 当前实现对"不存在的路径"实际上是放松的。
- **建议修复**：对新路径，canonicalize **最深的已存在祖先**，前缀校验通过后再写；或先写到 root 内临时文件 → canonicalize → `fs::rename` 到目标（rename 前再校验一次）。同时补一个"junction 逃逸"单测（本次用的就是可固化成测试的脚本）。

#### H-3 `fetch_image_bytes` 是无限制的 SSRF 原语，且在 tokio worker 上阻塞 30s

- **位置**：`src/main.rs:580-606`；并发放大点：`frontend/src/export.js:57-71`（`Promise.all` 并发拉取笔记中**所有**远程图）
- **描述**：
  1. 任意 `http(s)` URL 均可被后端拉取且字节原样返回给 webview：`http://127.0.0.1:端口`、`http://169.254.169.254/…`（云元数据）、内网 RFC1918 全部可达；reqwest 默认跟随跳转（最多 10 跳），跳转目标不做任何限制。
  2. 与 H-1 叠加 = 完整的 SSRF 外泄通道；单独看，恶意笔记里放一张指向内网服务的"图片"，用户点导出即触发。
  3. 执行模型（已对照本机 tauri 2.12 源码核实）：Tauri 2 的**同步**命令通过 `respond_async_serialized` → `crate::async_runtime::spawn` 在 **tokio 运行时**上执行（并非主线程，所以不会冻结窗口 UI，这点常被误判）；但 `reqwest::blocking` 在 worker 线程上阻塞最长 30s，导出时又是全并发拉取，多张大图/慢响应会占满 worker 池，应用其它 IPC（保存、列表）随之变慢。
  4. 正面：30s 超时、`take(LIMIT+1)` 探测 25MB 上限、scheme 白名单、单测覆盖 scheme 拒绝——工程处理本身是认真的。
- **建议修复**：解析主机名后拒绝 loopback/link-local/RFC1918/IPv6 ULA（并校验每一跳跳转）；并发上限（如 4）；把客户端换成 `reqwest::Client`（非 blocking）+ async 命令；考虑把"笔记里的图片 URL"默认只允许 https 且白名单域名策略可选。

#### H-4（设计）`write_text` / `write_bytes` 是无 scope 的特权命令

- **位置**：`src/main.rs:563-572`
- **描述**：注释声称"路径来自用户 save dialog"，但命令本身对路径零校验。在 H-1 存在的情况下，它就是"任意文件写"的最终执行者，使整个 vault 封闭模型失去意义。即便修掉 H-1，这也是一个应当文档化或收敛的危险 API 面。
- **建议修复**：二选一——(a) 限定写到 `%TEMP%` 下应用前缀目录，再由用户在 dialog 中确认后 rename；(b) 维持现状但在 AGENTS/README 的安全说明中明示该命令的存在与风险，并以 H-1 的修复为前置。

### 2.2 中危

#### M-1 `file:///` 图片引用在 Windows 上失效（文档承诺的功能，已实测）

- **位置**：`frontend/src/preview.js:367-373`（`localImageAbsPath` 的 file 分支）
- **描述**：`file:///C:/vault/img.png` 经 `src.slice('file://'.length)` 得到 **`/C:/vault/img.png`（前导斜杠保留）** → Rust `Path::new("/C:/…").is_absolute()` 在 Windows 上为 **false**（rustc 实测）→ `resolve_vault_file` 以 "absolute path required" 拒绝 → 协议返回 403 → 图片永远空白。在 Linux/macOS 上 `/…` 恰是合法绝对路径，所以**只在唯一的目标平台 Windows 上坏**。
- **矛盾点**：CHANGELOG（Unreleased）明确列出 "file:///" 为已支持形式。
- **建议修复**：Windows 分支中若解码结果形如 `/X:/…`，剥掉前导 `/`；或改用 `new URL(src)` 标准解析。补一条针对 `file:///` 的自测样例。

#### M-2 每次保存都会丢弃 front matter 中除 `tags` 外的全部字段（静默数据丢失）

- **位置**：`src/main.rs:96-157`（`parse_frontmatter` 只提取 tags）、`src/main.rs:159-171`（`render_frontmatter` 只写 `tags:`）
- **描述**：`save_note_impl` 用 `render_frontmatter(tags, body)` 整体重写文件。笔记若含 `title:`、`date:`、自定义字段（Obsidian/YNote/博客生态极其常见），**第一次保存即被静默删除**。README 以 YNote 为对标、examples 里有 Obsidian 风格笔记，这个缺口不列在"已知限制"里。
- **建议修复**：保存时保留原始 front matter 块（仅替换/插入 `tags:` 行），或引入 YAML 解析做保留式合并。补单测：含 `date:` 的笔记保存后字段仍在。

#### M-3 `strip_extended_prefix` 把 UNC 路径改写成非法路径（已实测）

- **位置**：`src/main.rs:50-57`
- **描述**：Windows 上 `fs::canonicalize` 对网络共享返回 `\\?\UNC\server\share\…`；现有代码剥掉 `\\?\` 后得到 **`UNC\server\share\…`**（rustc 实测该路径 `exists()==false`，并非合法 UNC 形式）→ vault 放在 SMB 共享上时，一切"已存在路径"的读/写/移动都失败。
- **建议修复**：对 `\\?\UNC\` 前缀应剥成 `\\`（即 `\\server\share`）；现有 `\\?\C:\` 分支不变。补一个 UNC 形态的字符串级单测（不依赖真实网络）。

#### M-4 `walk` 跟随目录符号链接且无环检测 → 潜在栈溢出；符号链接目录内笔记"可见不可开"

- **位置**：`src/main.rs:344-364`
- **描述**：
  1. vault 内若存在指向祖先目录的 junction（`a/link → a`），`walk` 无限递归 → 栈溢出 → 应用崩溃（用户视角：打开该笔记库直接闪退）。
  2. 即使无环：`walk` 会进入符号链接目录并把其中笔记列入列表，但 `read_note` 的 canonicalize 会判"逃出 root"拒开 → 列表里出现点开必报错的僵尸条目。
- **建议修复**：遍历前 `fs::symlink_metadata` 检查，遇到 symlink/junction 目录直接跳过（最保守），或 canonicalize 后维护 visited 集合。

#### M-5 保存非原子、无外部修改冲突检测

- **位置**：`src/main.rs:407-410`（读-比-写）；`frontend/src/main.js:401`（save 时不带 mtime）；`src/main.rs:36-37`（`NoteContent.mtime` 返回了但前端从未使用——冲突检测的原料就在手里没用）
- **描述**：
  1. `fs::write` 原地截断重写：写入中途断电/崩溃 = 该笔记损坏，无临时文件+rename 的原子性保护。对"用户唯一语料库"的本地笔记应用，这是最值得补的健壮性缺口。
  2. 打开后若外部编辑器/同步工具改了文件，用户再保存 → 外部修改被静默覆盖（last-writer-wins，无任何提示）。
- **建议修复**：temp 文件 + `fs::rename`；save 命令接收 expected mtime，不匹配时报冲突错误由前端弹提示（刷新或强制覆盖二选一）。

#### M-6 SVG（及 ico/avif）图片在导出中大概率为空白

- **位置**：`frontend/src/imgutil.js:18-31`（`guessImageMime` 仅魔数）
- **描述**：SVG 无魔数 → 归为 `application/octet-stream`；Chromium 对 data URL 的 SVG **要求声明 MIME 为 `image/svg+xml`**，否则拒绝渲染 → vault 内的 SVG 图在应用内正常（rmd 协议按扩展名给 MIME，见 main.rs:660），但 PNG/PDF/HTML 导出中空白。ico/avif 同样缺失。讽刺的是 Rust 端 `mime_for_path` 早就算好了正确 MIME，只是没随字节一起返回。
- **建议修复**：`read_local_image` 返回 `{bytes, mime}`（用现成的 `mime_for_path`）；或前端对解码失败的文本类字节嗅探 `<?xml`/`<svg`。

#### M-7 自测（项目旗舰 QA 资产）机器绑定 + 静默失明

- **位置**：`frontend/src/main.js:859-861`（`D:/GitHub/rustmd/examples`、`C:/Users/River/AppData/Local/Temp/opencode/rustmd-selftest`）；`src/main.rs:976-993`（`repro_read_meta_after_canonicalize` 硬编码 `D:\GitHub\rustmd\examples`）；examples 中 `raw.githubusercontent.com/riverzhou/rustmd/master/…` 图片 URL
- **描述**：
  1. 路径全部硬编码：换机器/换 checkout 位置，selftest 直接不可用；Rust 侧回归测试则静默跳过（`if !exists { return; }`）——CI 上永远"通过"。
  2. **输出目录不由代码创建**：`fs::write` 要求目录已存在。本机该目录恰是历史遗留（2026-10-19 创建）；新机器上第一次 `writeBytes` 抛错 → async IIFE 中断 → **后续全部跳过，连 report.json 都没有**（unhandledrejection 只弹 toast）。
  3. 远程图片 fetch 失败时只是不进 `remoteRefs`，存在性检查被静默跳过 → 离线环境下 `report.ok` 仍可为 true，而导出 PNG 里其实是空白图。自测最核心的承诺（"缺图即失败"）在离线时不成立。
  4. examples 的远程图绑定 `riverzhou/rustmd` 公开仓库 master 分支：仓库改名/私有化 → 同 3 的静默失明。
- **建议修复**：目录由环境变量/参数注入（默认 `env::temp_dir()/rustmd-selftest` + `create_dir_all`）；fetch 失败计入 `report.errors`（或至少 report 里显式标记 degraded）；Rust 侧回归测试改用 `temp_dir` 自建 fixture，去掉硬编码路径。

#### M-8 `rename_note` 冲突处理与 `move_note` 不一致

- **位置**：`src/main.rs:442-460` vs `src/main.rs:489-504`
- **描述**：重命名到已存在的名字 → `fs::rename` 直接报错（原始错误串进 toast）；移动到冲突位置 → 自动 ` (n)` 后缀。同一用户预期，两种行为。
- **建议修复**：抽一个"冲突自动加后缀"helper 给两者共用，或统一为报错后由 UI 二次确认。

#### M-9 搜索范围与 UI 承诺不符 + 竞态

- **位置**：`frontend/index.html:41`（placeholder "搜索标题或内容…"）；`src/main.rs:513-558`（只搜 body）；`frontend/src/main.js:655-673`（无请求序号）
- **描述**：
  1. 无 heading 的笔记，其标题来自**文件名兜底**——该标题不可被搜索到（正文里没有它）；标签存于 front matter，搜索前已被剥掉 → 标签同样搜不到。"全文搜索"名不副实（README 亦如此宣称）。
  2. 250ms 防抖 + IO 延迟可变：旧的慢查询可能晚于新的快查询返回 → 列表被旧结果覆盖（短暂但真实）。
- **建议修复**：搜索语料 = body + 标题兜底名 + tags；前端维护单调递增的 query token，过期响应丢弃。

#### M-10 保存失败后静默丢改 / 关闭窗口丢最后一段输入

- **位置**：`frontend/src/main.js:397-418`（`saveCurrent` 在 await **之前**置 `pendingSave=false`）；`main.js:392-395`（`flushSave` 只看 pendingSave）；全局无 `beforeunload`
- **描述**：
  1. 保存失败（磁盘满/权限/IO）→ toast 提示，但 `pendingSave` 已是 false → 随后切换笔记时 `flushSave` 不重试 → 这段修改**永久丢失**且无二次提示。
  2. 无 `beforeunload` 守卫：用户在 500ms 防抖窗口内关窗口 → 最后一段输入丢失（即使保存链路健康）。
- **建议修复**：失败时保持 `pendingSave=true`（或单独 `failedSave` 标志，切换/关闭时重试或强提示）；加 `beforeunload` 提示（无法保证异步完成，至少拦截到用户确认）。

### 2.3 低危 / 脚注

| # | 条目 | 位置 |
|---|---|---|
| L-1 | **主 chunk 2.37MB**（gzip 724KB），含 `@codemirror/language-data`（全部语言定义只为代码围栏高亮）；lazy chunk 另有 MathJax 1.83MB、mermaid elk 1.5MB。桌面 webview 可接受，但 language-data 可裁剪到实际语言 | `frontend/src/editor.js:5`、构建产物 |
| L-2 | **浏览器 mock 与真实后端行为分叉**：mock 的 rename/move 对已存在目标**静默覆盖**（真实端报错/加后缀）、mock 搜索窗口 −40/+100 vs Rust −40/+60、mock save 接受任意路径 → 纯浏览器调试对"后端校验"给出错误信心 | `frontend/src/api.js:199-224` |
| L-3 | **main.js 1362 行**，其中 850-1362 行（~510 行）是内嵌自测（虽被 `import.meta.env.DEV` 编译隔离，但物理上混在入口模块）。自测是自洽单元，应拆 `selftest.js` 动态 import。另：自测私有的 `guessMime` 与 `imgutil.guessImageMime` 是重复实现——imgutil.js 注释自称"与自测私有副本去重"，**该注释已失真** | `frontend/src/main.js:938-951`、`frontend/src/imgutil.js:1-5` |
| L-4 | `fetch_image_bytes_fetches_remote_image` 是**默认测试套件里的真实网络测试**（picsum.photos），离线时静默跳过 → 网络坏/CI 无网时该路径的回归永远"绿" | `src/main.rs:950-964` |
| L-5 | `strip_inline`：孤立的 `!` 被吞（`a != b` → `a = b`）；未闭合的 `[` 使缓冲文本在句尾丢失（仅影响 snippet 质量） | `src/main.rs:232-240` |
| L-6 | `extract_title` 会把**代码围栏内**的 `# xxx` 当标题（`plain_snippet` 跳过围栏、标题不跳）→ 同一笔记的标题与摘要口径不一致 | `src/main.rs:175-200` |
| L-7 | front matter 解析边角：嵌套 key 下的 `tags:` 行会被误收；`tags: a # comment` 产生垃圾标签；带引号且含逗号的 tag 被拆散；首行带前导空格的 `---` 不识别；**带 front matter 的 CRLF 笔记保存后正文变 LF**（examples 里两种换行并存，证明现实常见） | `src/main.rs:96-157` |
| L-8 | `heading_text` 把 `#Title`（无空格）当标题（非 CommonMark） | `src/main.rs:175-191` |
| L-9 | 公式启发式：`$5 and $10`（闭 `$` 前是空格）安全；但紧凑写法 `$10/$20`、`$5$`（实测 match）会被当作公式排版——价格笔记的现实干扰。另：用户若真的写出字面量 `RMDMATH3X` 会与 token 命名空间碰撞（概率极低） | `frontend/src/preview.js:266-280`（node 实测） |
| L-10 | `buildExportHtml` → `setPreviewTheme` → `mmdCache.clear()`：每次 HTML 导出后，预览中所有 mermaid 图在下次渲染时全量重排（一次性能小坑） | `frontend/src/preview.js:160-168,484-500` |
| L-11 | `VaultFileCache`：64×25MB ≈ 1.6GB 内存上界；命中即 `clone()` 全部字节；满员整表 clear（触发再读风暴）；每次请求仍有一次 metadata 系统调用（缓存只省读文件） | `src/main.rs:683-723` |
| L-12 | `tauri.conf.json` 声明 `bundle.active: true` + `targets: ["nsis"]`，但文档化流程是 `--no-bundle` 裸 exe——配置与流程不一致（无害） | `tauri.conf.json:26-34` |
| L-13 | 宽于 860px 的表格在 PNG/PDF 导出中被裁（stage 固定 948px，`.markdown-body` 无 overflow 处理） | `frontend/src/export.js:13-17`、`style.css:728` |
| L-14 | `<details>` 内部含**围栏代码块**时，分段式预处理器无法预渲染（结构性限制，建议写入文档） | `frontend/src/preview.js:183-240` |
| L-15 | 空文件夹无法作为移动目标、无法删除（移动菜单只列有笔记的文件夹；vault 里可能残留空目录） | `frontend/src/main.js:600-601` |
| L-16 | `fmtTime` 对 mtime=0 显示 1970；`NoteContent.mtime` 前端从未使用 | `frontend/src/main.js:86-95` |
| L-17 | **无 LICENSE**；examples 引用的公开仓库 `riverzhou/rustmd` 却无 license 文件——若计划开源，应补 | 仓库根 |
| L-18 | 无 CI、无 lint/format 配置（clippy/rustfmt/prettier 皆无）、前端零单元测试（自测覆盖渲染/导出，rename/move/search/save 等 UI 流程无覆盖） | 仓库根 |
| L-19 | `RUSTMD_SELFTEST=1 scripts\run-dev.bat` 是 bash 语法：git-bash 下成立（与 AGENTS.md 一致），cmd/PowerShell 下不成立——建议在 README 标注"需在 bash 环境"或提供 `set` 写法 | `AGENTS.md:14` |
| L-20 | `save_note_impl` 的 no-op 检查每次保存都全文件读一次 + 读-写之间 TOCTOU（性能微瑕 + 竞态边角） | `src/main.rs:407` |

---

## 3. 已验证"不是问题"的点（审计中排除的怀疑）

| 怀疑 | 结论 |
|---|---|
| 同步命令阻塞主线程导致 UI 冻结 | **否**。对照 tauri 2.12 源码：同步命令经 `respond_async_serialized` 在 tokio 运行时执行，不在主线程。真实问题是 H-3 所述"占 worker + 并发放大"，不是冻结 |
| `restoreMath` 的 token 存在子串碰撞（token 1 vs 10/11） | **否**。`RMDMATH{i}X` 以 X 结尾，任一 token 都不是另一 token 的子串 |
| `search_notes` 的字节偏移在大小写折叠变长（ß→ss）时越界 | **否**。有 `body.get(start..end)` + 回退到 lower 窗口的双重防护，设计正确 |
| `renderDetailsBlocks` / math token 在 details 内互相破坏 | **否**。保护先于 details 预渲染执行，token 是纯字母数字词，marked 不会拆断 |
| 导出 PDF 分页切到块中间 | **基本否**。`computePageCuts` 只在块边界切，超大块按页高硬切并有 prevBottom 钳制（collapsed margin 已考虑）；CSS 常量（948=860+2×44、padding 48/44/64）与 export.js 一致（已核对） |
| `heading_text` 的 `t[hashes..]` 字节索引越界 | **否**。`#` 是 ASCII，字符数==字节数 |
| mermaid 导出的 SVG 依赖页面 CSS | **否**。mermaid.render 默认把 `<style>` 内嵌进 SVG（自测代码注释亦证实 SVG 内含 style） |
| `escapeHtml` 漏转义 | 否，5 个字符齐全且仅用于 export title（body 本就该是 HTML） |

---

## 4. 项目质量评估

### 4.1 代码质量：**优秀**

- **注释是最大亮点**：注释解释"为什么"而非"是什么"，且大量记录真实的踩坑根因——Windows `\\?\` 前缀（含回归测试）、WebView2 对 blob URL 解码失败的探测证据（selftest 六段流水线探测）、MathJax a11y worker 挂起、Vite 6 IPv6-only 绑定、`--no-watch` 崩溃循环、`DISPLAY_MATH_RE` 丢失 `g` 标志导致"错误计数为 0 的静默回归"。这种注释密度说明作者是**先深度调试、后成文**的。
- 边界处理用心：`save_note_impl` 的 no-op 写（防止无谓 mtime 更新触发 watcher 重启，且配了跨文件系统 mtime 分辨率的单测）；`resolve_in_root` 对 `..` 的逐组件拒绝 + 存在路径 canonicalize 双保险；`search_notes` 的 char boundary 调整与大小写折叠回退。
- 风格一致：Rust 无警告、命名统一、错误串面向用户；前端模块职责清晰、中文注释与 UI 语言一致。
- 短板集中在**平台边角**（H-2/H-3/M-1/M-3/M-4 全是 Windows 路径/网络边角）——主路径打磨充分，边角分析不完备。

### 4.2 测试：**良好偏优**

- `cargo test`：21/21 通过（本机实测 1.99s）。质量高：不只是"能跑"，每个已修过的 bug 都有对应回归测试（mtime 分辨率、`\\?\` 前缀、缓存失效、路径逃逸、no-op 保存、sanitize 边角）。
- E2E 自测超出同类项目一个数量级：真实 webview + 真实后端 + 真实远程图；2D NCC 像素匹配证明"图真的在导出 PNG 里"；多行公式用 mjx viewBox 高度做几何断言（针对"错误计数为 0 才能发现的回归"）；六段流水线探测把"哪一段丢图"定位到 blob 解码/drawImage/html2canvas 层级。方法论是正确的。
- 缺口：UI 交互层（rename/move/search/save 流程、竞态）零覆盖；测试机器绑定（M-7）；默认套件含真实网络测试（L-4）。

### 4.3 文档：**优秀**

- README（用户向）/ AGENTS.md（开发者+agent 向）/ CHANGELOG（历史向）三角一致且互引；AGENTS.md 的 gotchas 一节直接可当"新人 onboarding"用；"Adding a Tauri command (3 touch points)" 是典型的降低维护成本的成文约定。
- CHANGELOG 的 Fixed 条目带着完整动机与验证方式（如"纯看日志发现不了"），可追溯性极好。
- 唯一失真点：imgutil.js 的"去重"注释（L-3）。

### 4.4 构建与工具链：**良好**

- dev 端口冲突的动态处理（`launch-dev.mjs` 探测 + `--config` 覆盖 devUrl）解决了"5173 被占 → 白屏/旧内容"的隐蔽坑；`--no-watch` 的取舍被文档化。
- 图标零依赖生成（手写 PNG/ICO 编码，CRC 表齐全）——小而有品味的工程决策。
- 缺 CI 与 lint（L-18）：对一个自测如此完备的项目，"CI 里跑 cargo test + npm build + selftest" 的边际收益很高。

---

## 5. 组织逻辑评估

### 5.1 架构决策（全部可辩护，且有成文理由）

1. **单文件 Rust 后端（1116 行）**：AGENTS.md 明确声明"No other Rust modules"。在 14 个命令、无状态服务的规模下，单文件 + 清晰分区（types / path safety / front matter / text helpers / commands / vault protocol / tests）让"所有 IPC 面"一屏可审——对安全敏感项目这是优点。自然的下一步：出现第二子系统时按 `commands/` `vault/` `text/` 拆分。
2. **单一 `api.js` 桥 + 浏览器 mock**：Tauri 检测（`__TAURI_INTERNALS__`）+ in-memory fallback，使"不用 Rust 就能复现白屏"成为成文的调试路径（AGENTS.md gotcha 1）。代价是 mock 行为分叉（L-2）。
3. **无框架前端**：1362 行 main.js 承担了状态+DOM+UI 流程，规模尚可读；`state` 单对象 + 模块级函数，无状态库。
4. **examples/ 兼任回归 vault**：公式指南守护 `$$` 保护、render test §4 守护本地图协议——样例即测试夹具，聪明且省事。
5. **三触点命令约定**（Rust fn → generate_handler → api.js wrapper + mock 分支）把 Tauri 的三处接线风险降为零遗漏。
6. **rmd 自定义协议**替代 asset 协议处理动态 root，是 Tauri 2 上正确的做法；protocol 永远 canonicalize 的封闭模型本身是对的（缺口只在 H-2 的"写新文件"路径）。

### 5.2 目录结构与仓库卫生

- 布局惯例清晰：`src/`、`frontend/`、`scripts/`、`examples/`、`capabilities/`、`gen/`（生成物，文档注明勿手改）、`icons/`；`.gitignore` 正确；lock 文件齐全；版本号三处一致（1.0.0）。
- git 历史 13 个提交，信息有意义（"Fix squashed multi-line math; remote images + high-res exports; dev self-test"），无乱序噪音。
- 缺口：无 LICENSE（L-17）、无 CI（L-18）、自测代码的物理位置（L-3）。

### 5.3 一句话总评

**组织逻辑与代码成熟度明显高于"个人项目"的平均水平，短板不在"组织"而在"边界"**：对外部输入（恶意 HTML、junction、UNC、符号链接环）的边界分析不完整，且高危的 H-1 恰恰打在"其它边界都守住了"的前提上。修完 H-1/H-2/H-3 与 M-1/M-2 后，这个项目可以达到"可推荐给他人日常使用"的门槛。

---

## 6. 建议修复优先级

| 优先级 | 事项 | 对应条目 | 预估工作量 |
|---|---|---|---|
| **P0** | DOMPurify 消毒管线 + CSP（预览与导出共用） | H-1、H-4 | 0.5-1 天 |
| **P0** | 新路径写操作的封闭修复（canonicalize 最深存在祖先 + junction 逃逸单测） | H-2 | 0.5 天 |
| **P1** | fetch_image_bytes SSRF 防护（私有网段拒绝 + 跳转校验）+ 并发上限 + async 客户端 | H-3 | 0.5 天 |
| **P1** | front matter 保留式保存 + `file:///` 修复（各配回归测试/自测样例） | M-2、M-1 | 0.5-1 天 |
| **P1** | 原子写（temp+rename）+ mtime 冲突检测 + 保存失败重试/beforeunload | M-5、M-10 | 1 天 |
| **P2** | UNC 前缀修复、walk 跳过 symlink、SVG 导出 MIME、rename 冲突统一、搜索范围+竞态 | M-3~M-6、M-8、M-9 | 1-2 天 |
| **P2** | 自测去机器绑定（env 注入 + 目录自建 + fetch 失败计为 error）+ 拆 selftest.js + 修正失真注释 | M-7、L-3 | 0.5 天 |
| **P3** | CI（cargo test + npm build + selftest）、lint 配置、LICENSE、mock 行为对齐、language-data 裁剪 | L-1、L-2、L-17、L-18 | 1 天 |

---

*附：本次审计的全部实验产物已清理，仓库工作区保持干净（`git status` 无变更）。验证用 rustc/node 脚本为一次性临时文件。*

---

## 7. 后续状态（2026-10-28 整理轮）

按本报告的组织性发现执行了一轮代码与文档整理（详见 CHANGELOG「变更」条目）：

| 已处理 | 条目 |
|---|---|
| self-test 拆出 `frontend/src/selftest.js`（dev 动态导入，release 不含），main.js 回落到 UI 单一职责 | L-3（前半） |
| 自测私有 `guessMime` 移除，统一 `imgutil.guessImageMime`；imgutil 失真注释修正 | L-3（后半） |
| 浏览器 mock 与后端行为对齐（save 路径校验、rename 冲突报错、move no-op/自动后缀、搜索窗口 −40/+60） | L-2 |
| 误导注释修正（export.js maxWidth、launch-dev.mjs 自测位置） | L-3 相关 |
| README 已知限制补齐（raw HTML 不消毒、front matter 仅留 tags、搜索范围）；AGENTS.md 记录 selftest.js 位置、bash 语法与安全缺口 | 文档一致性 |

**仍开放（未动行为，待修复轮）**：H-1（无消毒渲染 + `csp:null`）、H-2（junction 写逃逸）、H-3/H-4（SSRF 与无 scope 写命令）、M-1（`file:///` Windows 失效）、M-2（front matter 丢字段）、M-3~M-10 及其余低危项。修复建议与优先级见 §6。
