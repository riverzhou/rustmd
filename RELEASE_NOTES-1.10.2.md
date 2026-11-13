# rustmd 1.10.2

这是针对 1.10.1 宽数据表 PDF 导出的修复版。

## 修复

- **TXT/CSV 宽表导出 PDF 错乱**：1.10.1 会把数据表按普通 Markdown 表格的
  `width:100%` 规则压回 A4 宽度，随后 jsPDF 以 portrait 方向二次旋转，得到一张
  竖长、列被挤压且右侧裁切的页面。1.10.2 让导出舞台保留数据表的自然宽度，并按
  页面实际宽高选择 landscape/portrait；18 列 TXT 表现在导出为一张完整的横向页面。
- 数据表在导出舞台不再继承 Markdown 表格的强制 100% 宽度和逐字换行规则；列宽、
  数字/日期/中文标签都保持与 PNG 一致的排版。
- **TXT 列宽修复**：整行说明和空行不再参与列宽推断；3 列 TXT 示例的「名称」列
  不再被说明文字撑大，空行也不再显示成空表格行。README 截图同步更新。

## 兼容与验证

- 保留 1.10.1 可调布局、4K/200% 数据视图、无行/列/节点上限、GBK/GB18030、
  HTML charset 等全部改动。
- `npm run check`：ESLint、51 个前端单测、仓库/版本检查、fmt、clippy
  `-D warnings`、75 个 Rust 测试、Vite build 全部通过。
- `npm run selftest`：真实 WebView 10 篇示例全部通过。
- 真实 GBK 股票信号文件 24 行 × 18 列：PNG 8505×2847；PDF 为
  `2126.25×711 pt` 横向页面，完整显示全部列。
- 1440×900、1920×1080（4K/200%）交互与截图保持 1.10.1 的效果。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.2-win-x64-portable.zip` |
| Linux | `rustmd_1.10.2_amd64.deb` / `rustmd_1.10.2_amd64.AppImage` |
| macOS | `rustmd-1.10.2-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**：
首次启动会被 Gatekeeper 拦截，请在系统设置 → 隐私与安全性中选择“仍要打开”，
或执行 `xattr -dr com.apple.quarantine /Applications/rustmd.app`。
