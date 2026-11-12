# 更新日志（Changelog）

本项目的所有重要变更都记录在本文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.8.0] - 2026-11-12

### 新增（Added）

- **当前文件夹范围开关**：笔记列表、全文搜索、文件夹计数和标签云默认只覆盖
  当前文件夹（启动/切换笔记库时是库根目录）的直属笔记，不再自动包含子文件夹；
  搜索框下方的“包含子文件夹”开关打开后递归整个子树。开关状态保存在
  `localStorage.rustmd-include-subfolders`，重启后保持。
- `search_notes` 新增 `folder` / `recursive` 参数，后端直接在选中的目录范围内
  扫描（不递归时只读该目录顶层文件），不再先全库搜索再由前端过滤；Rust 单测覆盖
  根目录、子目录与递归三种范围。
- 文件夹树在范围关闭时显示直属笔记数（`direct`），打开时显示子树数（`count`）；
  标签云只统计当前范围内的笔记，切换目录/范围后若活动标签已不存在会自动清除，
  避免出现看不到也点不掉的空结果过滤。当前范围没有直属笔记但子文件夹里有笔记时，
  空状态会提示打开“包含子文件夹”。

### 变更（Changed）

- 版本号提升到 **1.8.0**；`notelist.js` 新增 `folderInScope` / `countTags`，
  `main.js` 统一用当前范围驱动列表、搜索、文件夹计数与标签云，`api.js` 及其
  浏览器 mock 同步新的 `folder` / `recursive` 搜索参数。
- `scripts/capture-screenshots.mjs` 在截图前打开“包含子文件夹”，重新生成
  README 中英文明暗主题、侧栏和最近笔记库截图，确保截图包含新开关。
- README 中英文版、AGENTS、架构/测试/安全/发布/审计文档与 GitHub 项目文案
  同步更新；本轮同时全面校对版本号、测试计数、截图路径和发布命令。

### 验证（Verified）

- `npm run check`：ESLint、28 个前端单测、仓库/版本检查、`cargo fmt`、
  clippy `-D warnings`、59 个 Rust 测试（58 通过 + 1 个网络测试 ignored）、
  Vite build 全部通过。
- 浏览器 mock 交互验证：默认只显示 2 篇根目录笔记、根目录搜索不返回子目录命中；
  打开开关后 7 篇全部出现、子目录搜索命中、文件夹计数与标签云同步变化；
  选中 `work` 后关闭开关只显示 3 篇直属笔记；刷新页面后开关状态保持。
- `npm run selftest`：在真实 WebView 中渲染 6 篇示例（含 HTML）并完成
  PNG/PDF 导出，`report.json` 为 `ok: true`、0 errors；picsum 远程图不可达按
  既有策略记为 1 条 warning，不阻塞发布；`check-selftest-report --require-html`
  校验通过。

## [1.7.0] - 2026-11-12

### 新增（Added）

- **最近笔记库快速切换**：侧栏“切换笔记目录”按钮现在直接弹出最近打开的
  笔记库列表——当前目录带标记，点一下即可切换，非当前项可用 `×` 从列表移除；
  支持 `Esc` / 点击外部关闭；按 `Esc` 关闭时焦点回到触发按钮。最多保留 8 个目录，
  按最近使用排序，重启后仍在（`localStorage.rustmd-recent-dirs`）。Windows
  路径在去重时忽略大小写与 `/`、`\` 差异。
- **引导页最近目录**：首次启动/上次目录打不开时，目录选择页也会列出最近
  笔记库，一键进入，不必重新浏览系统目录树。
- **浏览从当前目录开始**：切换器里的“浏览其他目录…”把当前笔记库作为原生
  目录对话框的 `defaultPath`，选择后直接打开，少一次确认。
- **切换保护不变**：切换前仍先 flush 未保存内容；保存失败照旧弹确认，
  `vaultSwitchBusy` 防止快速连点导致两个目录的异步结果交错。

### 变更（Changed）

- 版本号提升到 **1.7.0**；新增 `vaultlist.js` 及其 6 个 Node 单测，最近目录
  只做本地持久化，不新增 IPC、不改变 Rust/权限/CSP/路径封闭/HTML 隔离边界。
- README 中英文版、AGENTS、架构/测试/发布/安全/审计文档与 GitHub 项目文案
  同步更新；`scripts/capture-screenshots.mjs` 新增中英文 `vault-switcher`
  截图并重新生成全部 README 截图。
- Windows 绿色 zip 现在随附 README/CHANGELOG/`docs/`（含截图）与 SECURITY，
  离线阅读 README 时截图和文档链接不再缺失。

### 验证（Verified）

- `npm run check`：ESLint、26 个前端单测、仓库/版本检查、`cargo fmt`、
  clippy `-D warnings`、58 个 Rust 测试、Vite build 全部通过。
- `npm run selftest`：6 篇示例（含 HTML）通过。
- 浏览器 mock 交互检查：一库/多库切换、MRU 更新、移除、ESC/焦点返回、
  中英文文案和 900×560 最小窗口布局。

## [1.6.1] - 2026-11-12

### 修复（Fixed）

- **E2E 自测不再被第三方图床拖垮**：远程图片探测失败时记录为警告
  （`report.warnings`），不再写入 `report.errors`，发布门禁不会因为 picsum 等
  外部站点临时不可达而失败；首次失败后直接跳过其余远程图，避免大量 20 秒超时
  拖长自测。本地图片、PNG/PDF 矢量文字等断言保持严格。
- 报告校验脚本会打印这些警告，CI 日志里能看出是哪张远程图被跳过。

### 变更（Changed）

- 1.6.1 包含 1.6.0 的全部内容（Markdown/HTML 统一格式徽标）。

## [1.6.0] - 2026-11-12

### 新增（Added）

- **Markdown 格式徽标**：笔记列表与顶栏现在对 Markdown 和 HTML 使用同一套
  醒目的格式徽标——`MD`（绿色）/ `HTML`（蓝色）。此前只有 HTML 有标记、
  Markdown 仅靠 `.md` 文件名区分；现在两种格式一眼可辨，徽标带 tooltip 与
  `aria-label`，并分别适配明暗主题。
- 列表徽标改为始终渲染（不再依赖文件名），顶栏徽标同步使用相同的配色语义。

## [1.5.0] - 2026-11-12

### 新增（Added）

- **矢量文字 PDF 导出（Markdown + HTML，Windows/macOS/Linux）**：PDF 不再由
  html2canvas 截图切片，而是交给系统 WebView 的打印管线重新排版——Markdown
  用新命令 `print_note_pdf`（离屏舞台 + `@media print`），HTML 笔记用
  `print_html_note`（隐藏渲染窗口按可打印宽度排版，固定宽度页面整体缩放）。
  Windows 走 WebView2 `PrintToPdfStream`；macOS 走 WKWebView 的
  `NSPrintOperation`；Linux 走 WebKitGTK 的打印操作（运行时解析 GTK C API，
  无需开发头文件）。文字、公式、Mermaid/SVG 图表都是矢量，可选中、可搜索、
  任意放大都清晰；A4 分页由引擎按 CSS 规则完成。Windows 由 WebView2 绘制
  页眉标题 + 页脚页码；macOS/Linux 打印后由 `stamp_page_numbers` 在每页底部
  补一个居中的「页码 / 总页数」（不添加浏览器地址栏信息）。不支持原生打印的
  平台或运行时自动回退到原来的图片 PDF，导出流程（保存对话框、文件名）不变。

### 修复（Fixed）

- **Linux 导出 PDF 的额外主线程阻塞**：GTK 打印完成后不再在 GTK 主线程里
  轮询输出文件（最多 5 秒的 sleep），等待改为在后台线程完成；WebKitGTK 自身
  的页面渲染仍是同步的（平台没有异步接口），界面只在渲染期间短暂停顿，
  导出提示可见。
- **macOS 导出 PDF 时界面无响应**：改用 AppKit 的
  `runOperationModalForWindow:` + `canSpawnSeparateThread`，让打印在系统
  分离出来的线程上完成，主线程只负责轮询输出文件（含文件稳定性和
  `%%EOF` 校验），导出期间界面不再卡死。
- **PDF 尾页渲染异常**：图片 PDF 不再产生被硬切出的“几像素尾页”——
  切片按页均分，末尾过短的页并入上一页；Markdown 的矢量 PDF 则由浏览器
  正常分页，不会把一行文字切成两半。

## [1.4.2] - 2026-11-12

### 文档与可发现性（Docs / Discoverability）

- GitHub 仓库 About 更新为 **Markdown & HTML notes** 口径，描述中明确
  “built-in WebView HTML preview”。
- GitHub Topics 更新为同时覆盖格式/技术栈/平台：新增 `html`、`html-editor`、
  `html-notes`、`webview`，保持 20 个 topics。
- README 中英文版、`docs/GITHUB_PROJECT_COPY.md`、`AGENTS.md`、架构/安全/
  测试/发布文档同步 HTML 本地资源内联、WebKit 导出修复、Origin 白名单例外
  和 1.4.2 发布流程。

### 变更（Changed）

- 版本号提升到 **1.4.2**；`package.json`、`Cargo.toml`、`tauri.conf.json`、
  `Cargo.lock`、`package-lock.json` 同步。
- 新增 `RELEASE_NOTES-1.4.2.md`。本次为文档/可发现性补丁版本，应用代码与
  v1.4.1 一致。

## [1.4.1] - 2026-11-12

### 修复（Fixed）

- **WebKitGTK / WKWebView 的 HTML 本地资源**：Linux/macOS 的 WebKit 对跨域
  classic `<script>` / `<link rel=stylesheet>` 会带 `Origin: null`，被 `rmd`
  的严格 Origin 白名单拒绝。HTML 预览与隐藏导出现在先把笔记目录内的相对
  CSS/JS 内联进文档，再渲染；本地图片继续 data URL 内联。所有平台行为一致。
- **Linux/macOS Markdown 导出图片被裁切**：WebKitGTK 的 html2canvas 可能忽略
  `<img>` 的 `max-width`，把宽图表按自然宽度绘制并在画布右缘裁切。导出前将
  图片冻结为同尺寸 `<canvas>`，并显式设置 CSS 宽度；自测的 fig1 NCC 恢复通过。
- **CI 发布门禁**：release `verify` 增加 `npm run selftest` + `--require-html`；
  CI 的 selftest 同样强制 HTML 覆盖；apt 下载增加 IPv4 与超时，避免 runner
  的网络等待导致发布卡住。

### 变更（Changed）

- 版本号提升到 **1.4.1**；`package.json`、`Cargo.toml`、`tauri.conf.json`、
  `Cargo.lock`、`package-lock.json`、README 中英文版同步。
- 新增 `RELEASE_NOTES-1.4.1.md`；本轮修复来自 v1.4.0 发布后的 Linux CI
  E2E 结果。

## [1.4.0] - 2026-11-11

### 新增（Added）

- **HTML 笔记**：笔记库现在同时识别 `.md` / `.html` / `.htm`。HTML 文件会出现在
  文件夹树、笔记列表、搜索和文件夹计数中，并带 `HTML` 类型标记；列表标题优先取
  `<title>`，其次第一个 `<h1>`，最后文件名。
- **编辑器**：CodeMirror 按文件类型切换 Markdown / HTML 语法高亮，HTML 标签、
  属性、属性值有独立配色；`<script>` / `<style>` 内的 JS/CSS 关键字、字符串、函数、变量、注释等也会分别着色；新增 **自动折行 / 不折行** 切换并持久化；右上角新增 **全屏**
  按钮并支持 `F11` 快捷键。
- **HTML 渲染**：HTML 笔记预览使用应用内置 WebView 的 `sandbox="allow-scripts"`
  null-origin iframe，支持内联/远程脚本、样式、本地相对 CSS/JS/字体/图片和 ECharts
  图表，无需外部浏览器；导出在隐藏的独立 Tauri WebView 中整页截图，超长页面按垂直段
  截取后用 Rust 拼接为单张 PNG。所有保险库命令按窗口 label 校验，预览 iframe 与导出
  窗口都无法调用它们。HTML 笔记不支持 front matter 标签，标签编辑器会自动隐藏。
- **新建菜单**：顶部新建按钮改为菜单，可选择 **Markdown 笔记** 或 **HTML 页面**；
  重命名、移动、删除、手动刷新以及 HTML / PNG / PDF 导出均支持 HTML 笔记，重命名
  保留原扩展名。
- **保存与导出**：HTML 笔记保存时不插入 `---` 或 `tags:`，并保留原文件的 BOM 与
  CRLF/LF 换行风格；搜索只匹配 HTML 的可见文本（不含标签、脚本、样式）。导出 HTML
  直接保存当前源码，PNG/PDF 使用内置 WebView 整页渲染结果，图表不会丢失。
- **示例与测试**：新增 `examples/html-page-demo.html`，覆盖 HTML 预览、本地 CSS/JS/
  图片、脚本执行与 PNG/PDF 导出；Rust 新增 HTML 扫描/保存/搜索/重命名测试，前端新增
  `noteKindOf` / `noteStemOf` 单测。`npm run check`、完整 6 篇示例的 `npm run selftest`
  和 Rust 49 项测试全部通过。

### 修复（Fixed）

- **HTML 预览速度与清晰度**：不再把页面光栅化为 PNG，而是用内置 WebView 的
  原生 iframe 渲染；文字/矢量图保持清晰，滚动与缩放不模糊，首次预览通常从数秒
  降到 1 秒内（示例约 0.4–0.7 秒）。
- **HTML 本地资源**：修正 `base` URL 把整条路径当成一个 URL segment、导致相对
  CSS/JS/字体/图片 404 的问题；现在这些资源都能加载（并保持 `rmd` 的 Origin 读隔离）。
- **超长 HTML 导出**：PNG 最高 3×，超过单张 canvas 高度时按垂直段截取，Rust `png`
  crate 拼接为一张完整 PNG；PDF 短页面 3×、较高页面 2×。短页面与 Markdown 的 3×
  一致，长页面的有效像素密度高于 Markdown 的 14,000 设备像素高度上限。
- **HTML 预览竞态**：快速切换笔记时，旧的异步 iframe 注册结果不会再追加到新笔记；
  切回 Markdown 时会清理 native iframe 的消息监听器和定时器。
- **全屏状态**：`F11` 忽略按键重复；窗口重新获得焦点时同步真实全屏状态，避免用
  `Esc` 退出后按钮状态残留。
- **JS/CSS 语法高亮**：补全 `<script>` / `<style>` 内的关键字、字符串、函数、变量、
  类名、标点、注释颜色，不再只有 HTML 标签/属性有颜色。
- **安全**：`rmd` 对 sandbox/null origin 与 `rmdhtml` 源的 CORS 读请求返回 403，
  避免恶意 HTML 笔记用 `fetch` 读取笔记库其他文件；隐藏 WebView 与预览 iframe
  仍受窗口 label 校验。

### 变更（Changed）

- 版本号提升到 **1.4.0**；`package.json`、`Cargo.toml`、`tauri.conf.json`、
  `Cargo.lock`、`package-lock.json` 同步，README 中英文版更新到 1.4.0。
- `AUDIT_REPORT.md` 重写为 1.4.0 审计；`AGENTS.md`、架构/安全/测试/发布文档同步
  HTML 渲染、Origin 白名单、全屏/折行、语法高亮和新的发布/自测流程。
- `examples/html-page-demo.html` 增加本地 CSS/JS 资源并修正过时的无头浏览器说明。

## [1.3.1] - 2026-11-09

### 修复（Fixed）

- **PNG / PDF 导出中的内嵌 SVG 图片**：以 `data:image/svg+xml` 内联、只有
  `viewBox` 而没有 `width` / `height` 的 `<img>` 图片，在导出时会被裁成左上角
  一小块并把文字放大（例如 QuantV5 回测报告的图表只剩巨大的标题和坐标轴数字）。
  原因有两个叠加：浏览器的 `naturalWidth` 只有 300px 左右；html2canvas 又把
  `drawImage` 的源矩形按 SVG 用户单位（viewBox）解释，等于裁掉了图表的大部分。
  现在导出前先把 SVG 图片按导出的目标分辨率栅格化为 PNG，再交给 html2canvas；
  页面截图/HTML 导出本来就是浏览器原生渲染，不受影响。
- **导出回归测试**：端到端自测新增一张 viewBox-only 的红蓝双色 SVG 用例，要求
  导出 PNG 中同时存在左右两色；`report.inlineSvg` 会记录两色像素数，缺一色即
  失败。`docs/TESTING.md` 同步说明。

### 变更（Changed）

- 版本号提升到 **1.3.1**；`package.json`、`Cargo.toml`、`tauri.conf.json`、
  `Cargo.lock`、`package-lock.json` 同步。
- 用 `QuantV5-回测-month-20d-汇总-20261109-082004.md` 实测 PNG、PDF、HTML 三种
  导出；PNG 图表完整，PDF 由同一张修复后的画布分页（4 页），HTML 保留矢量 SVG。

## [1.3.0] - 2026-11-07

### 新增（Added）

- **侧栏刷新按钮**：左侧栏顶部新增刷新按钮，点击后从磁盘重新扫描整个笔记库，
  同步笔记列表、文件夹树、标签云、搜索结果与各处计数；扫描期间按钮旋转并禁用，
  完成后提示刷新结果。适用于软件打开期间由 Git、同步盘、其他编辑器或脚本增删改
  文件的情况，无需重启或重新选择目录。
- **外部修改安全处理**：
  - 打开中的笔记在磁盘上被修改、且编辑器中无未保存内容时，自动重新载入正文、
    front matter 标签与预览（尽量保留光标和滚动位置）。
  - 打开中的笔记被外部删除时：无未保存内容则关闭编辑器并回到空状态；有未保存
    内容或保存失败时保留编辑器内容并给出提示，后续保存仍会弹出 hash 冲突确认。
  - 当前筛选的文件夹或标签被外部删除时，自动回到“全部”，避免出现无法解释的
    空列表。
  - 刷新前先提交待保存的自动保存队列，避免刷新与保存写入竞态。
- **中英文文案与无障碍**：刷新按钮的 title / aria-label、成功、失败、外部修改、
  外部删除、仍有未保存修改等提示均提供 English / 简体中文；按钮带 `aria-busy`
  与禁用状态。
- **验证**：在浏览器 mock 下用无头 Edge 覆盖外部新增、修改、删除当前笔记、
  删除筛选文件夹四条路径；`npm run check` 全部通过。

### 变更（Changed）

- 版本号提升到 **1.3.0**；`package.json`、`Cargo.toml`、`tauri.conf.json`、
  `Cargo.lock`、`package-lock.json` 同步。
- 复用编辑器装载/清空逻辑（`applyNoteContent` / `clearCurrentNote`），删除笔记与
  手动刷新走同一条状态清理路径；`loadNotes` 现在返回扫描结果，刷新失败时可以给出
  准确错误。
- README 中英文版、`docs/RELEASING.md` 与发布说明更新到 1.3.0。

## [1.2.0] - 2026-11-07

### 新增（Added）

- **中英双语界面**：新增 `frontend/src/i18n.js` 与完整词典；主界面、首次启动页、
  文件夹树、笔记列表、排序、状态栏、对话框、导出菜单与错误提示均支持
  English / 简体中文 即时切换，不重载笔记、不丢编辑内容。
- **跟随系统 + 本地持久化**：首次启动根据 `navigator.language` 选择语言
  （中文系统 → 简体中文，其他 → English）；用户选择写入
  `localStorage.rustmd-lang`，下次启动优先使用。
- **语言选择器**：主界面侧栏顶部与首次启动的选择目录页都显示语言选择器；
  选项固定为 `English` / `简体中文`，按钮的 title / aria-label 为英文
  `Language`，方便任何语言的用户找到。
- **英文 README 与英文截图**：`README.en.md` 使用英文界面截图；中文 README
  增加英文界面示例；新增 `docs/screenshots/*.en.png`。
- **i18n 单测**：词典 key 对齐、变量插值、英文复数、系统语言检测，前端单测
  从 14 个增至 **17 个**。

### 变更（Changed）

- 版本号提升到 **1.2.0**；`package.json`、`Cargo.toml`、`tauri.conf.json`、
  `Cargo.lock`、`package-lock.json` 同步。
- 时间与字数统计按当前语言格式化（`zh-CN` / `en-US`）；英文使用
  `1 note` / `2 notes` 与 `1 word` / `2 words` 等复数形式。
- 导出 HTML 的 `<html lang>` 和页脚跟随当前界面语言；目录选择对话框标题
  由前端传入当前语言。

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
- **Linux 构建与冒烟**：新增 [LINUX_BUILD.md](LINUX_BUILD.md)（Ubuntu 依赖、
  release 二进制、绿色打包、无 root sysroot 兜底）与
  `scripts/linux-headless-smoke.sh`（隔离 Xvfb 启动 release 二进制，校验窗口
  尺寸/颜色/边缘密度，产物写入 `target/headless-smoke/`）。
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
  标题/文件名/标签、文件夹列表、图片 MIME。
- **Mermaid KaTeX 裁剪**：mermaid 12 的可选 `import("katex")` 通过 Vite alias
  指向 204 B 的 `frontend/shims/katex.js`；笔记公式继续由 MathJax 渲染，
  不再打包未使用的 KaTeX。

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
- 修复 Linux 下两个路径单测失败：Windows 语义断言用 `#[cfg(windows)]`
  限定；serving 测试改用独立临时目录，避免并行测试互相删除。
- 修复 Linux（WebKitGTK）PNG/PDF 导出在任务列表笔记上崩溃：导出舞台把原生
  `<input type="checkbox">` 换成等宽 span，避开 html2canvas 对原生控件计算
  样式（如 `color(srgb …)`）的解析。

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
