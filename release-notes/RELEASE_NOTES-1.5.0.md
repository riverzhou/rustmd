# rustmd 1.5.0

这一版把 **PDF 导出升级为矢量文字版**，并把页码、打印管线与排版质量统一到
Windows / macOS / Linux 三个桌面平台。

## 亮点

- **文字版 PDF（Markdown + HTML）**：不再把整页截图后切片，而是交给系统
  WebView 的打印管线重新排版——Windows 用 WebView2，macOS 用 WKWebView，
  Linux 用 WebKitGTK。文字、公式、Mermaid/SVG 图表都是矢量：可选中、可搜索、
  任意放大都清晰，文件通常比图片版小一个数量级。
- **A4 智能分页**：由引擎按 CSS 规则分页，代码块/表格/图表不会被切成两半，
  也不会再出现只有几像素的“尾页”；表格跨页时自动重复表头。
- **页码**：Windows 由 WebView2 绘制页眉标题 + 页脚页码；macOS/Linux 打印后由
  应用在每页底部补一个居中的「当前页 / 总页数」，不添加浏览器地址栏信息。
- **HTML 笔记同样支持**：在隐藏渲染窗口里按 A4 可打印宽度排版，保留笔记自己的
  样式、脚本和图表；固定宽度页面会整体缩放以适配纸张。
- **macOS 导出不再卡界面**：打印交给 AppKit 分离出来的线程，主线程只轮询输出
  文件，导出期间界面保持可交互。
- **Linux 额外阻塞已移除**：打印完成后不再在 GTK 主线程里轮询文件（原先最多
  5 秒），等待改到后台线程；WebKitGTK 自身的页面渲染仍是同步的（平台没有异步
  接口），只在渲染期间短暂停顿。
- **图片 PDF 兜底更稳**：旧版图片 PDF 仍作为不支持原生打印时的回退；切片按页
  均分，尾部过短的页并入上一页，避免阅读器显示残页。

## 行为变化

- HTML 笔记的 PDF 从“整页截图切片”变成“A4 重新排版”：响应式页面会更像打印稿，
  固定宽度页面会整体缩小以完整落到纸上。
- 导出格式仍是 PDF，保存对话框、文件名、导出菜单都不变；PNG 仍是 3× 位图。
- 非 Windows/macOS/Linux 平台、或系统打印引擎不可用时，自动回退为原来的图片版。

## 验证

- `npm run check`：ESLint、20 个前端单测、57 个通过的 Rust 测试（另 1 个网络
  测试默认忽略）、fmt、clippy、Vite build 全部通过。
- `npm run selftest`：6 篇示例（含 HTML）全部通过；矢量 PDF 断言内嵌字体
  （`/Font`）、HTML iframe ready、本地 JS/图片内联、PNG/PDF 尺寸与 magic。
- 页码戳记另有单测与真实导出 PDF 回归（原内容保留、字体资源合并不破坏）。
- GitHub Actions release workflow 会再次运行 `npm run check` + Linux Xvfb E2E +
  release-notes preflight，再构建三端资产。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.5.0-win-x64-portable.zip` |
| Linux | `rustmd_1.5.0_amd64.deb` / `rustmd_1.5.0_amd64.AppImage` |
| macOS | `rustmd-1.5.0-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 ad-hoc 签名。
请用 `SHA256SUMS.txt` 校验完整性。
