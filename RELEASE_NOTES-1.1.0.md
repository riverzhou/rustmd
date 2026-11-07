# rustmd 1.1.0

这一版重点是把“日常找笔记”和“安全边界”补上，并建立三端自动发布。

## 新增

- **侧栏排序**：按最后修改时间 / 按文件名两个按钮，并支持 `↑/↓` 切换升序/降序；选择会记住。
- **文件卡片显示文件名**：标题、文件名、路径、时间、标签一目了然。
- **文件夹树**：可折叠/展开的层级结构，支持空文件夹；选中父文件夹会包含子文件夹；“全部”始终可用；**子文件夹默认折叠**，展开状态会记住。
- **三端 Release**：Windows 绿色 zip、Linux deb + AppImage、macOS universal DMG；全部附 SHA256。
- **自动检查**：ESLint、Node 单测、仓库/版本检查、rustfmt、clippy、cargo test、Vite build，一条 `npm run check`。
- **安全渲染**：笔记 HTML 经 DOMPurify 消毒，webview 启用 CSP，外部链接交给系统浏览器。

## 修复

- 修复 v1.0.0 审计中的全部高/中危问题：无消毒 HTML、junction 写逃逸、远程图片 SSRF、任意路径写文件、`file:///` 图片、front matter 丢字段、UNC 路径、符号链接遍历、非原子保存、SVG 导出空白、自测机器绑定、搜索范围/竞态、保存失败丢改等。
- 保存改为原子写 + 内容 hash 冲突检测；外部修改会先询问再覆盖。
- 导出改为 Rust 打开原生保存对话框并写文件；前端不再拥有任意文件写命令。
- Linux（WebKitGTK）上含任务列表的笔记导出 PNG/PDF 时，html2canvas 解析原生
  checkbox 的计算样式会抛错；导出舞台已改为普通 span，预览仍保留原生 checkbox。
- Linux `cargo test` 的 Windows 路径断言已用 `#[cfg(windows)]` 限定。

## 依赖

发布前已刷新到最新兼容版本：Tauri 2.12.5、tauri-plugin-dialog 2.8.4、
@tauri-apps/api/CLI 2.12.4、globals 17 等；GitHub Actions 也升级到最新主版本。
完整检查（ESLint、14 个前端单测、40 个 Rust 测试、构建）与真实 WebView
端到端自测均通过。

## 许可证

本项目以 **GPL-3.0-or-later** 开源，`LICENSE` 随仓库与发布包分发。

## 文档与截图

- README 增加主界面、深色主题、侧栏截图，以及英文版 `README.en.md`。
- 新增架构、测试、发布签名、安全和 GitHub 项目文案文档。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.1.0-win-x64-portable.zip`（解压即用） |
| Linux | `rustmd_1.1.0_amd64.deb` / `rustmd_1.1.0_amd64.AppImage` |
| macOS | `rustmd-1.1.0-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍会提示未知发布者）；macOS 为 ad-hoc 签名（首次打开需在“隐私与安全性”放行）。请用 Release 中的 `SHA256SUMS.txt` 校验完整性。
