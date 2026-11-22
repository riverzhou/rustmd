# rustmd 1.10.6

这是 CSV / TXT 数据预览的布局修复版：功能和文件格式与 1.10.5 相同，修复了一页
表格刚好放得下、右侧却出现多余纵向滚动条的问题。

## 修复

- **数据表格的滚动区高度改为实测**：此前用固定的 `100vh - 170px` 猜测高度，没有
  计入数据卡片标题、顶部横向滚动条、预览内边距和卡片底边距，导致表格被撑得比
  预览区更高：表格内部出现纵向滚动条，预览区外层也被撑出滚动条。
- **行高不再累积误差**：旧代码用 `Math.ceil` 分配拉伸后的行高，每行最多多加
  1px；现在使用小数像素，18 行表格不会再被顶出滚动区。
- **数据模式用满一页**：预览上下留白收紧为 15px / 8px，去掉卡片底部 margin；
  表格正好填满可用高度。
- **跟随布局变化重新测量**：窗口缩放、拖动分栏/侧栏、切换编辑/分栏/预览模式后
  都会重新计算；Markdown ↔ CSV/TXT 切换会恢复普通预览留白。

## 验证

- 浏览器 CDP 实测 18 行×8 列宽表在 1440×900 与内容高度 803px 下：表格内外均无
  纵向滚动条；17/19 行正常填满，25 行才出现合理的表格内滚动。
- `npm run check` 全绿：60 个前端单测、77 个 Rust 测试、fmt/clippy/ESLint、
  仓库/版本检查与 Vite 生产构建。
- Windows 真实 WebView2 E2E 10 篇示例通过；README 截图已按新布局重新生成。

## Linux 兼容性

- Linux deb/AppImage 仍与 1.10.5 一致，在 **Ubuntu 26.04** 上构建，运行基线为
  **Ubuntu 24.04+ / glibc 2.39**，需要 GTK 3 与 WebKitGTK 4.1 运行库。
- Ubuntu 22.04 用户请继续使用 1.10.4，或按 `LINUX_BUILD.md` 从源码构建。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.6-win-x64-portable.zip` |
| Linux | `rustmd_1.10.6_amd64.deb` / `rustmd_1.10.6_amd64.AppImage` |
| macOS | `rustmd-1.10.6-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 **ad-hoc 签名、未公证**。
每个平台资产旁有 `.sha256`（Linux 另有 `SHA256SUMS-linux.txt`），Release 里还有
合并的 `SHA256SUMS.txt`。
