# rustmd 1.4.0

这一版把 rustmd 从「Markdown 笔记」扩展为 **Markdown + HTML 笔记**，并把 HTML 渲染、导出质量和编辑体验补齐。

## 新增

- **HTML 笔记**：识别 `.html` / `.htm`，参与文件夹树、列表、搜索、计数；有独立的
  `HTML` 类型徽标。新建菜单可直接创建 HTML 页面。
- **HTML 完整渲染**：使用应用内置 WebView（Windows WebView2 / Linux WebKitGTK /
  macOS WKWebView）原生渲染整页，支持页面自带的 `<style>`、`<script>`、内联/远程
  脚本、本地相对 CSS/JS/字体/图片、ECharts 和嵌套 iframe。**不需要 Edge、Chrome
  或任何外部浏览器。**
- **HTML 安全隔离**：预览在 `sandbox="allow-scripts"` 的 null-origin iframe 中运行；
  导出在独立隐藏 WebView 中运行。保险库命令按窗口 label 校验，预览 iframe 与导出
  窗口都无法调用；`rmd` 还会拒绝来自预览/null origin 的 CORS 读请求。
- **高清导出**：HTML 笔记 PNG 短页面 3×，长页面按高度自适应；超过 canvas 高度时
  垂直分段截取，Rust 拼接为单张完整 PNG。短页面与 Markdown 的 3× 一致，长页面的
  有效像素密度高于 Markdown 的 14,000 设备像素高度上限。PDF 短页面 3×、较高页面 2×。
- **编辑器**：自动折行 / 不折行切换并持久化；右上角全屏按钮 + `F11`；HTML 源码
  的标签、属性、属性值，以及 `<script>` / `<style>` 内的 JS/CSS 都有完整语法配色。
- **预览性能**：HTML 预览改为原生 iframe，不再光栅化为 PNG；示例首屏约 0.4–0.7 秒，
  文字和图表保持清晰。
- **示例与自测**：新增 `examples/html-page-demo.html`；完整 6 篇示例的
  `npm run selftest`（含 HTML 本地图片/脚本断言）、`npm run check` 和 Rust 56 项测试通过。

## 修复

- 修正 HTML 相对资源 base URL 错误，相对 CSS/JS/字体/图片不再 404。
- 快速切换笔记时，旧 HTML 预览的异步 iframe 不会覆盖新笔记；切回 Markdown 会清理
  监听器与定时器。
- `F11` 忽略按键重复，窗口重新聚焦时同步全屏状态。
- 依赖、文档与发布流程全面审计；`AUDIT_REPORT.md`、`AGENTS.md`、中英文 README、架构/安全/
  测试/发布文档同步到 1.4.0。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.4.0-win-x64-portable.zip` |
| Linux | `rustmd_1.4.0_amd64.deb` / `rustmd_1.4.0_amd64.AppImage` |
| macOS | `rustmd-1.4.0-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 ad-hoc 签名（首次打开
需在“隐私与安全性”放行）。请用 Release 中的 `SHA256SUMS.txt` 校验完整性。

## 许可证

GPL-3.0-or-later，见 `LICENSE`。
