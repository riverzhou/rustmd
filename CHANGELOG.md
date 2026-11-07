# 更新日志（Changelog）

本项目的所有重要变更都记录在本文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-11-07

### 新增（Added）

- **侧栏排序**：笔记列表新增“时间 / 名称”两个按钮，分别按最后修改时间、
  按文件名（数字感知、`zh-CN` collation）排序；新增 `↑/↓` 方向按钮，
  两种排序都支持升序/降序；选择持久化到 localStorage。
- **文件卡片显示文件名**：每张卡片在标题下显示完整文件名（等宽字体），
  卡片 `title` 含完整相对路径，同名笔记不再难以区分。
- **文件夹树**：左侧文件夹区改为真正的树状结构（可折叠/展开、层级缩进、
  子树计数），顶部“全部”始终可用；选中父文件夹会包含所有子文件夹的笔记。
  **子文件夹默认折叠**，展开状态持久化。新增 `list_folders` 后端命令，空
  文件夹也会出现在树中，并可作为新建/移动目标。
- **三端 GitHub CI/CD**：`ci.yml` 在 Windows / Linux / macOS 编译，Ubuntu
  跑完整质量门禁和 Xvfb 真实 WebView 自测；`release.yml` 在 tag 上发布
  Windows 绿色 zip、Linux deb + AppImage、macOS universal DMG。
- **发布签名**：Windows 自签名 Authenticode（可选真实 PFX secret），
  macOS ad-hoc 整包签名（可选 Developer ID + 公证），所有平台附 SHA256。
  参考 pythontdx 的发布策略：Windows 绿色 zip + 自签名、macOS ad-hoc、
  Linux 校验和。
- **自动化检查体系**：ESLint 10 flat config、Node 原生单测、仓库一致性检查、
  版本检查、`rustfmt` / `clippy -D warnings` / `cargo test`、Vite 构建，
  统一由 `npm run check` 串起。
- **安全渲染**：集成 DOMPurify，在 `innerHTML` 前消毒笔记 HTML；Tauri CSP
  从 `null` 改为显式策略；外部链接经 `opener` 插件交给系统浏览器。
- **CSP / 权限**：`object-src 'none'`、禁止 inline script、限制 connect-src；
  capabilities 增加 `opener:default`。
- **前端纯函数测试**：`notelist.js`（排序/过滤/文件夹树）与 `markdown.js`
  （数学保护/代码段切分）拆出并配 14 个 `node --test` 用例；新增升/降序
  方向用例；Rust 单测增至
  41 个（40 通过 + 1 个网络测试 ignored）。
- **开源协议**：项目改为 **GPL-3.0-or-later**，新增根目录 `LICENSE`；
  `package.json` / `Cargo.toml` / `tauri.conf.json` 同步声明，Windows 绿色包、
  Linux deb/AppImage 与 macOS DMG 随附许可证。
- **文档**：新增 `docs/ARCHITECTURE.md`、`docs/TESTING.md`、
  `docs/RELEASING.md`、`docs/SECURITY.md`、`docs/GITHUB_PROJECT_COPY.md`；
  重写 README / AGENTS / CHANGELOG / AUDIT_REPORT；新增英文 README.en.md；
  README 加入主界面 / 深色主题 / 侧栏截图；生成 `icon.icns` 供 macOS 打包。

### 变更（Changed）

- **保存链路**：临时文件 + 原子 rename；`baseHash` 内容 hash 冲突检测；
  保存队列串行化，避免并发保存把旧 hash 当成冲突；保存失败保留“未保存”
  状态，切换/关闭前提示；标签变化也参与版本号。
- **front matter 保留式保存**：`compose_note` 只替换/插入 `tags:` 行，
  `title:`、`date:`、注释、BOM、CRLF/LF 全部保留；带引号/逗号的标签可往返。
- **导出写文件**：前端不再调用 `write_text` / `write_bytes`；改为
  `save_export` 在 Rust 内打开原生保存对话框并写用户选择的路径。
- **搜索范围**：正文 + 标题 + 文件名 + 标签；前端加查询序列号，过期响应丢弃。
- **卡片摘要**：跳过 `$$…$$` 展示公式与 fenced code，不再把 TeX/Mermaid 源码
  塞进列表摘要。
- **图片 MIME**：`fetch_image_bytes` / `read_local_image` 返回
  `{bytes, mime}`；SVG/ICO/AVIF 等导出不再空白。
- **`file:///` 图片**：Windows 盘符路径正确剥掉前导 `/`，UNC `file://server/`
  也能解析。
- **数学保护**：display math 改为“行首开始、行尾结束”的正则（去掉
  lookbehind，兼容旧 WebKit）；token 加随机前缀；行内代码中的 `$…$` 不再
  被当作公式。
- **路径安全**：新路径检查最深已存在祖先（junction/symlink 写逃逸）；
  walk 跳过符号链接/reparse point；`\\?\UNC\` 正确还原。
- **SSRF**：远程图片只允许 http(s)，拒绝 loopback/私有/链路本地/保留地址，
  每次重定向重新校验，20s 超时、25MB 上限。
- **依赖升级**：marked 18、jsPDF 4、mermaid 12.3、Vite 8（rolldown）、
  dompurify 3、highlight.js 11.12、CodeMirror 6.0.2、Tauri opener 2.7。
- **发布前依赖刷新（2026-11-07）**：`@tauri-apps/api`/CLI 2.12.4、
  `@tauri-apps/plugin-dialog` 2.8.4、`globals` 17；Cargo.lock 更新到
  Tauri 2.12.5、tauri-build 2.7.4、reqwest 0.12.28、serde 1.0.229 等；
  GitHub Actions 升级到 checkout/setup-node v7、upload-artifact v7、
  download-artifact v8、softprops/action-gh-release v3。升级后
  `npm run check`、`npx tauri build --no-bundle`、`npm run selftest` 全部通过。
- **自测**：路径由 `RUSTMD_SELFTEST_EXAMPLES` / `RUSTMD_SELFTEST_OUT`
  或默认值注入，输出目录由 Rust 创建；远程图片拉取失败计入 `errors`；
  报告由 debug-only 命令写盘，应用以 0/1 退出供 CI 消费。示例库中的
  Obsidian 调研图改用本地 `assets/`，远程回归改用稳定的 picsum 图片，
  不再绑定本仓库的 raw.githubusercontent URL。
- **图标**：`npm run icons` 现在同时生成 `icon.icns`；Tauri bundle 图标列表
  包含 `.icns`。
- **本地图片渲染**（从 Unreleased 合并）：相对路径、`./`、`file:///`、
  绝对路径、`<img>` 均可显示；`rmd` 自定义协议按当前笔记根做路径封闭，
  按 mtime 缓存；导出时内联为 data URL。
- **浏览器 mock** 与后端对齐：save 冲突、rename/move 自动后缀、搜索
  标题/标签、文件夹列表、图片 MIME。

### 修复（Fixed）

- 修复审计报告中的 H-1（无消毒 HTML + `csp:null`）、H-2（junction 写逃逸）、
  H-3（SSRF / 无限制远程拉取）、H-4（无 scope 的 `write_text/write_bytes`）。
- 修复 M-1 `file:///` Windows 失效、M-2 front matter 丢字段、M-3 UNC 路径
  损坏、M-4 walk 跟随符号链接/环、M-5 非原子保存/无冲突检测、M-6 SVG 等
  导出空白、M-7 自测机器绑定/静默失明、M-8 rename/move 冲突行为不一致、
  M-9 搜索范围与竞态、M-10 保存失败丢改/关闭丢输入。
- 修复 `strip_inline` 吞掉孤立的 `!`、未闭合 `[` 丢文本；标题提取把代码
  围栏里的 `#` 当标题；`#Title` 被误认为标题。
- 修复每次保存都全量重读笔记、排序按钮缺失、搜索旧响应覆盖新结果等
  UI 问题。
- 修复图片 `rmd` 响应被浏览器缓存导致编辑后不更新的问题（`no-store`）。
- 修复导出的宽表格/长代码被 html2canvas 裁切（导出舞台改为换行/固定布局）。
- 修复自测在离线/输出目录不存在时静默通过的问题。

### 移除（Removed）

- 移除 `write_text` / `write_bytes` 两个无 scope 的任意文件写命令。
- 移除自测/脚本中的机器绑定绝对路径（改用环境变量和默认临时目录）。
- 移除 `setPreviewTheme` 中不必要的 mermaid 缓存清空（缓存键已含主题）。
- 移除开发期遗留的 Rust 诊断日志（1.0.0 已移除，此处确认 release 无 stderr 噪声）。

### 安全（Security）

- 笔记 HTML 消毒 + CSP + 外链 opener + 路径封闭 + SSRF 防护 + 原生保存
  对话框，形成多层防线。详见 [docs/SECURITY.md](docs/SECURITY.md)。
- 审计状态见 [AUDIT_REPORT.md](AUDIT_REPORT.md)。

## [1.0.0] - 2026-10-02

首个正式发布版本。

### 新增（Added）

- **端到端自测（dev self-test）**：`RUSTMD_SELFTEST=1 scripts\run-dev.bat` 启动后，
  dev 窗口会用真实的 WebView2 + Rust 后端渲染 `examples/` 下全部示例笔记，逐一导出
  PNG/PDF，并用 2D NCC 相关算法验证外链图片确实出现在导出的 PNG 中；产物与
  `report.json` 写入系统临时目录。仅在 dev 构建存在（release 构建中自动移除）。
- 示例笔记：`examples/Markdown数学公式指南.md`（LaTeX 公式语法大全，兼作公式渲染
  回归测试样例）、`examples/Obsidian竞品深度横向调研.md`（含外链图片的长文样例）。
- Rust 单测：`fetch_image_bytes` 真实网络拉取（离线环境自动跳过）。
- 本文件（CHANGELOG.md）。

### 变更（Changed）

- 首次启动默认主题从「跟随系统」改为**浅色**（浅色为应用默认配色）；手动切换
  仍持久化到 localStorage 并优先生效。
- PNG 导出从 2x / 约 192 DPI 提升到 3x / 约 288 DPI；超长笔记自动降采样以限制
  画布内存（上限 14000 设备像素）。
- PDF 导出从单页长文档改为多页：按块级边界分页（不切断段落 / 表格 / 图片），
  无损 PNG 切片 + Flate 压缩，页面尺寸随内容。
- 外链图片导出链路改为：Rust 后端拉取字节 → 内联 `data:` URL 注入页面 →
  html2canvas 光栅化（html2canvas 无法处理跨域图片，此前导出中外链图片一律空白）。
- MathJax TeX 扩展（color / html / unicode）改为静态导入 + `loader.preLoaded` 注册，
  离线环境下 `\textcolor`、`\href`、`\unicode` 等命令不再触发网络加载失败。

### 修复（Fixed）

- **多行公式（矩阵、align、cases 等）被压成一行**：`DISPLAY_MATH_RE` 丢失全局标志后，
  `String.replace` 只保护了全文第一个 `$$…$$` 块，其余块的 `\\` 行分隔符在
  `marked` 的 Markdown 转义中塌缩为单个 `\`，MathJax 照常"成功"渲染但所有单元格
  挤在一行（错误计数为 0，纯看日志发现不了）。已补回 `g` 标志，并在自测中加入
  几何断言（渲染后的 mjx viewBox 高度）防止回归。
- 单个公式出错会让 MathJax 拒绝整个渲染批次，导致整篇笔记残留原始 `$…$` 源码：
  现在批量失败后逐公式回退渲染，坏公式保留原文，其余照常显示。
- `fetch_image_bytes` 返回的 `Vec<u8>` 被 Tauri 反序列化为普通数组对象（并非
  `Uint8Array`），`new Blob([bytes])` 会把字节串化成文本、图片永远无法解码：
  现在在 `api.js` 边界统一归一化为真正的 `Uint8Array`。
- 正文中零散出现的 `$$`（例如语法说明里引用"使用双 `$$` 包裹"）不再与真正的
  块级定界符错误配对、把周围文字吞进"公式"。

## [0.1.0] - 2026-09-30

首个可用版本。

### 新增（Added）

- 笔记列表（标题 + 摘要 + 修改时间，按时间倒序）、文件夹 / 标签分组、全文搜索
- CodeMirror 6 编辑器 + 实时预览（编辑 / 分栏 / 预览三视图，分栏可拖动，
  500ms 防抖自动保存）
- front matter 标签编辑、重命名、移动、删除
- 导出 HTML（内嵌样式、跟随当前主题）
- 深色 / 浅色主题（跟随系统 + 手动切换）、首选项持久化到 WebView localStorage
- mermaid 图表、代码高亮（highlight.js）、LaTeX 公式（MathJax 4，SVG 输出，
  离线可用）
- `examples/` 示例笔记库（综合 Markdown、代码围栏、数学公式样例）

### 修复（Fixed）

- 打开笔记时的重启循环；examples 中 mermaid 与 `<details>` 不渲染
- 输入 / 导出导致渲染器崩溃（"Page crashed!"）：mermaid SVG 缓存 + 预览防抖
- `tauri dev` 文件监视误杀应用：dev 启动脚本改为 `--no-watch`
- 公式渲染异常、导出中外链图片空白、PDF 导出模糊
