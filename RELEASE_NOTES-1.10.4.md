# rustmd 1.10.4

这一版是一次**全量审计 + 回归**后的稳定版：修掉了一个会丢数据的撤销 bug、几处
HTML/PDF 渲染问题，并收紧了 HTML 笔记的资源与路径边界。功能与文件格式不变，
建议所有 1.10.x 用户升级。

## 安全与数据安全

- **HTML 笔记不能再读取库内任意文件**：`read_local_image` 只接受图片扩展名。
  以前恶意 HTML 笔记可以把库里的 `.env`、密钥等文本变成 `<img>` 的 data URL
  再读出来；CSS/JS 内联单独限制为 `.css`/`.js`/`.mjs`。
- **超大文件保护**：单篇笔记超过 64 MB 时只显示文件名和“内容过大”的摘要，
  不会加载正文，避免下载来的笔记库卡死界面。
- **切换笔记后的撤销已隔离**：打开新笔记会重建编辑器状态，Ctrl+Z 不会再恢复
  上一篇笔记的文本并自动保存进当前文件。
- **关闭窗口前自动保存**：窗口关闭会先 flush 500ms 防抖保存；保存失败会询问，
  不再静默丢失最后几秒输入。

## HTML / 预览 / 导出

- HTML 资源内联保留 `<html lang>`、`<body class>` 等文档属性；`defer` 头部脚本
  内联后在 `<body>` 存在时才执行，报告类页面不再丢样式/图表。
- 快速切换笔记时，旧 Markdown 渲染不会再清掉新打开的 HTML 预览。
- 栅格 PDF 的每一页按自身宽高选择方向，最后一页不再是窄而高、右侧被裁掉的页面。
- **PDF 一律使用浅色打印配色**：深色主题在 macOS/Linux 上不会出现浅字白纸。
- PNG / 栅格 PDF 的缩放同时限制宽度、高度和总像素面积，超宽大表不再触发画布上限；
  图片按真实尺寸排版，不再把 200px 小图放大到 860px。
- 独立 HTML 导出的代码块会带上 highlight.js 配色。

## 数据与界面

- CSV/TSV 分隔符嗅探修复：文本字段里的逗号、引号内的分号不再导致列错位。
- 英文界面的搜索命中不再显示中文的“标题/文件名/标签”前缀。
- 删除笔记时，500ms 自动保存不会把文件重新写回来；导出不会再并发叠加。
- 标签输入支持一次粘贴多个标签并保持焦点；搜索高亮不再破坏 `&amp;` 等实体。
- 数据视图切换后释放监听器与 ResizeObserver；长表头、长 TXT 行与深 JSON 不再被裁切；
  尊重系统“减少动态效果”设置。
- **单篇笔记 64 MB 读取上限**（正常 CSV/TXT/JSON 仍不限制行列显示）。

## 质量与发布

- `npm run check`：ESLint、**60 个前端单测**、仓库/IPC/文档/版本检查、fmt、clippy
  `-D warnings`、**77 个 Rust 测试**、Vite build。
- `npm run selftest`：真实 WebView 10 篇示例；报告校验器现在要求每个 PNG/PDF/HTML
  产物真实存在且字节数一致、示例全覆盖，并断言残留公式/Mermaid/MathJax 错误、
  空白 PNG、HTML 文档结构与脚本执行。
- CI 在打 tag 前就执行 Windows 签名 + 绿色 zip、macOS app bundle + ad-hoc 签名的
  打包 dry run；Release 缺少任一平台资产会直接失败。
- GitHub About/topics 统一为 HTML 优先口径（`html`、`html-editor`、`html-notes`、
  `webview`）。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.4-win-x64-portable.zip` |
| Linux | `rustmd_1.10.4_amd64.deb` / `rustmd_1.10.4_amd64.AppImage` |
| macOS | `rustmd-1.10.4-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 **ad-hoc 签名、未公证**。
每个平台资产旁有 `.sha256`（Linux 另有 `SHA256SUMS-linux.txt`），Release 里还有
合并的 `SHA256SUMS.txt`。
