# rustmd 1.10.7

CSV / TXT 数据预览的列宽修复版：功能和文件格式与 1.10.6 相同，修复了表头与短内容
（例如 `TOP10`、`mode`）被拆成两行的问题。

## 修复

- **列宽改为按真实字体现测**：此前列宽按"字符数 × `ch`"估算，而 `ch` 只是数字
  `0` 的宽度。`TOP10`（5 个字符）分到 8ch 后，扣掉 20px 单元格内边距只剩约 35px，
  而它在 13px 字号下约 37px，差 2px 就被 `overflow-wrap: anywhere` 从中间断开。
  现在表头和每列最宽的内容会用预览的真实字体（canvas `measureText`）量出列宽，
  并把单元格内边距、分隔线计入。
- **表头按加粗字重测量**：`mode`、`prob` 这类标题比数据更宽，旧算法按数据宽度
  估算时会把标题挤成 `mod` / `e`；现在标题单独按加粗字重量宽。
- **随字号缩放**：列宽以 `em` 写入，字号随窗口宽度变化（或导出成独立 HTML 在更大
  屏幕打开）时，表格比例保持不变，不会重新折行。
- **长文本仍然折行**：超过原 64ch 上限的说明列保持原有折行行为，列宽不变；`ch`
  计划继续作为回退、下限与上限。

## 验证

- 用 10150 行 × 25 列的真实 CSV 在浏览器里回归：修复前 `mode` / `prob` / `note`
  表头与全部 `TOP10` 行折成两行；修复后 25 个表头、10150 行数据全部单行，表格
  总宽 2453px → 2352px。
- `npm run check` 全绿：62 个前端单测、76 个 Rust 测试（1 个默认忽略）、fmt/clippy/ESLint、
  仓库/版本检查与 Vite 生产构建。
- Windows 真实 WebView2 E2E 10 篇示例通过；README 截图已重新生成。

## Linux 兼容性

- 与 1.10.6 一致：在 **Ubuntu 26.04** 上构建，运行基线为 **Ubuntu 24.04+ /
  glibc 2.39**，需要 GTK 3 与 WebKitGTK 4.1 运行库。
- Ubuntu 22.04 用户请继续使用 1.10.4，或按 `docs/LINUX_BUILD.md` 从源码构建。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.7-win-x64-portable.zip` |
| Linux | `rustmd_1.10.7_amd64.deb` / `rustmd_1.10.7_amd64.AppImage` |
| macOS | `rustmd-1.10.7-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 **ad-hoc 签名、未公证**。
每个平台资产旁有 `.sha256`（Linux 另有 `SHA256SUMS-linux.txt`），Release 里还有
合并的 `SHA256SUMS.txt`。
