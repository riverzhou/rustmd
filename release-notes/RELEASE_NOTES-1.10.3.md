# rustmd 1.10.3

这一版优化 CSV / TXT / JSON 笔记的 **HTML 导出**：不再套用 Markdown 的
820px 阅读栏宽，改为充分利用浏览器屏幕宽度，同时保持 CSV/TXT 相同的表格逻辑。

## 变化

- 数据笔记独立导出文档使用 `data-export` 全宽布局：左右边距缩小，正文不再限制
  820px；1440 视口下 18 列 TXT 表格卡片约 1374px，1920 下约 1856px。
- 数据卡片仍按内容收缩：3 列窄表不会被强行拉满；宽表使用整个视口并在表格底部
  保留横向滚动，不再继承预览的 `max-height` 内部纵向滚动。
- CSV 与 TXT 共用同一套 `data-export` 类、列宽/对齐/表头/滚动规则；JSON 检查器
  也使用全宽布局。
- Markdown 导出的 820px 阅读栏宽保持不变，避免正文行宽过长。

## 验证

- `npm run check`：ESLint、51 个前端单测、仓库/版本检查、fmt、clippy
  `-D warnings`、75 个 Rust 测试、Vite build 全部通过。
- `npm run selftest`：真实 WebView 10 篇示例全部通过。
- 真实 GBK 股票 TXT 导出的 HTML 在 1440/1920 下验证：全宽卡片、横向滚动可访问
  全部 18 列，CSV 使用同一布局逻辑。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.3-win-x64-portable.zip` |
| Linux | `rustmd_1.10.3_amd64.deb` / `rustmd_1.10.3_amd64.AppImage` |
| macOS | `rustmd-1.10.3-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**。
