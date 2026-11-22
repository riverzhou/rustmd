# rustmd 1.4.1

这一版是 v1.4.0 的跨平台渲染修复，重点解决 Linux/macOS WebKit 下的 HTML
本地资源和 Markdown 图片导出问题。

## 修复

- **HTML 本地 CSS/JS**：WebKit 对跨域 classic script/stylesheet 会发送
  `Origin: null`，被 `rmd` 的严格 Origin 白名单拒绝。预览和导出现在先把
  笔记目录内的相对 CSS/JS 内联进文档；本地图片继续以 data URL 内联。
- **Markdown 导出图片裁切**：WebKitGTK 的 html2canvas 可能忽略 `max-width`，
  宽图表按自然宽度绘制并在画布右缘裁切。导出前将图片冻结为同尺寸
  `<canvas>` 并显式设置 CSS 宽度，修复自测中的 fig1 NCC 回归。
- **发布门禁**：release verify 增加 Xvfb E2E + `--require-html` 报告校验和
  release-notes preflight；apt 下载增加 IPv4 与超时，避免 runner 卡住。

## 验证

- `npm run check`：ESLint、20 前端单测、56 Rust 测试（55 通过 + 1 ignored）、
  fmt、clippy、Vite build 全部通过。
- `npm run selftest`：6 篇示例通过，HTML 本地 JS/图片内联、Markdown 图片 NCC、
  PDF magic/尺寸均通过。
- GitHub Actions CI：quality、Windows/macOS/Linux 编译、Linux Xvfb E2E 全部通过。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.4.1-win-x64-portable.zip` |
| Linux | `rustmd_1.4.1_amd64.deb` / `rustmd_1.4.1_amd64.AppImage` |
| macOS | `rustmd-1.4.1-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 ad-hoc 签名（首次
打开需在“隐私与安全性”放行）。请用 `SHA256SUMS.txt` 校验完整性。

## 许可证

GPL-3.0-or-later，见 `LICENSE`。
