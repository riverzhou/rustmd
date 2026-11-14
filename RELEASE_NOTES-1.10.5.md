# rustmd 1.10.5

这是依赖维护版：功能和笔记格式与 1.10.4 相同，主要把运行时、PDF 与前端依赖更新到
当前版本，并修复了 GitHub 上合并的依赖升级 PR 带来的编译中断。建议 1.10.4 用户升级，
以获取依赖中的安全与健壮性修复。

## 依赖升级

- `libloading` 0.8.9 → **0.9.0**（Linux 打印 FFI 运行时加载）
- `lopdf` 0.36.0 → **0.47.0**（PDF 页码压印；新增畸形 PDF 的解析/解压上限、
  xref 边界校验与更多流过滤器）
- `getrandom` 0.3.4 → **0.4.3**（预览/渲染随机令牌）
- `tauri-plugin-opener` 2.7.2 → **2.7.3**
- `marked` 18.1.3 → **18.2.0**（Markdown 解析修复）
- `vite` 8.3.6 → **8.3.8**（构建链修复）

## 修复与验证

- 适配 `libloading` 0.9 的 `AsFilename` API，Linux 打印代码恢复编译。
- 适配 `lopdf` 0.47 的 `get_page_content` 返回值，PDF 页码测试恢复编译。
- 页码压印测试新增“原有字体不得被替换”的断言；并用真实 9 页 WebView2 导出 PDF
  验证：页数、正文与嵌入字体均保留，每页 `N / M` 页脚位置正确。
- `npm run check` 全绿：60 个前端单测、77 个 Rust 测试、fmt/clippy/ESLint、
  仓库/版本检查与 Vite 生产构建。
- 真实 WebView2 E2E（10 篇示例，含 HTML/CSV/TXT/JSON）通过；远程图片主机不可达
  时按既有策略记为警告，不影响发布。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.5-win-x64-portable.zip` |
| Linux | `rustmd_1.10.5_amd64.deb` / `rustmd_1.10.5_amd64.AppImage` |
| macOS | `rustmd-1.10.5-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 **ad-hoc 签名、未公证**。
每个平台资产旁有 `.sha256`（Linux 另有 `SHA256SUMS-linux.txt`），Release 里还有
合并的 `SHA256SUMS.txt`。
