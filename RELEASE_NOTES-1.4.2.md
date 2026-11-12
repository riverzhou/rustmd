# rustmd 1.4.2

这一版是文档与可发现性补丁：把 rustmd 的 GitHub 宣传口径从“Markdown 笔记”
正式扩展为 **Markdown & HTML notes**，并同步 GitHub Topics。

## 变更

- GitHub About 描述明确 **Markdown & HTML notes**、纯 `.md/.html` 文件、
  内置 WebView HTML 实时预览、HTML/PNG/PDF 导出。
- GitHub Topics 新增 **`html`、`html-editor`、`html-notes`、`webview`**，
  同时保留 Markdown、Tauri/Rust、三平台、离线、Mermaid、LaTeX 等标签（共 20 个）。
- README 中英文版、`AGENTS.md`、`AUDIT_REPORT.md`、架构/安全/测试/发布文档
  同步 HTML 资源内联、WebKit 导出修复和 Origin 白名单例外。
- 版本提升到 1.4.2；应用代码与 v1.4.1 相同。

## 验证

- `npm run check`：ESLint、20 前端单测、56 Rust 测试、fmt、clippy、Vite build
  全部通过。
- `npm run selftest`：6 篇示例通过（HTML iframe ready、本地 CSS/JS/图片内联、
  Markdown 图片 NCC、PNG/PDF magic/尺寸）。
- GitHub Actions release workflow 会再次运行 `npm run check` + Xvfb E2E +
  release-notes preflight，再构建三端资产。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.4.2-win-x64-portable.zip` |
| Linux | `rustmd_1.4.2_amd64.deb` / `rustmd_1.4.2_amd64.AppImage` |
| macOS | `rustmd-1.4.2-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 ad-hoc 签名。
请用 `SHA256SUMS.txt` 校验完整性。
