# 更新日志（Changelog）

本项目的所有重要变更都记录在本文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 移除（Removed）

- 开发期遗留的 Rust 端诊断日志：`list_notes` / `read_note` / `save_note`
  的 `eprintln!` 调用日志，以及 panic hook、窗口关闭/销毁、应用退出的
  stderr 打印（release 构建中为 no-op，行为无任何变化）。

## [1.0.0] - 2026-10-02

首个正式发布版本。

### 新增（Added）

- **端到端自测（dev self-test）**：`RUSTMD_SELFTEST=1 scripts\run-dev.bat` 启动后，
  dev 窗口会用真实的 WebView2 + Rust 后端渲染 `examples/` 下全部示例笔记，逐一导出
  PNG/PDF，并用 2D NCC 相关算法验证外链图片确实出现在导出的 PNG 中；产物与
  `report.json` 写入 `%LOCALAPPDATA%\Temp\opencode\rustmd-selftest`。仅在 dev 构建存在
  （release 构建中自动移除）。自测校验项包括：残留未渲染公式、外链图片缺失、
  多行公式（矩阵 / align / cases）被压成单行。
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
