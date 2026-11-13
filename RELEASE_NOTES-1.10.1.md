# rustmd 1.10.1

这一版集中解决宽表和大屏布局：CSV 与 TXT 共用同一套表格引擎，列宽按内容计算，
窄表不强制铺满，宽表可用满 4K/200% 视口；同时让左侧导航栏和编辑/预览分屏都可以
拖动调整，并在顶栏提供一键恢复默认宽度。

## 新增

- **可调布局**：拖动左侧栏右缘调整导航宽度（220–680px，默认 320px，按视口
  自适应）；拖动编辑/预览分隔条调整分屏比例（20%–80%，默认 50/50）。支持键盘
  方向键、双击/Enter 重置；两个宽度分别存 `rustmd-sidebar-width` / `rustmd-split`。
- **一键恢复默认宽度**：顶栏新增恢复按钮，同时恢复 320px + 50/50，并清除偏好。
- README 中英文补充 MD/HTML/CSV/TXT/JSON 全格式实际渲染截图，并重新生成主界面、
  深色主题、侧栏、多库截图。

## 数据表格

- CSV/TXT 共用同一套表头检测、对齐、列宽、滚动和样式逻辑。
- 列宽按内容自适应：窄表收缩、宽表占满预览宽度；折行阈值放宽到 64 显示字符，
  股票信号样本所有字段保持单行。
- TXT 首行含数值时不再被误判为表头；只有特征明确才生成 `<thead>`。
- 宽表提供顶部和底部同步横向滚动条；长表在卡片内滚动，表头固定。
- 数据视图不再限制行/列/节点数量，完整内容进入预览；超大文件的内存/渲染成本
  由用户控制。
- 宽表 PNG/栅格 PDF 的离屏舞台扩宽到表格自然宽度，不再裁掉右侧列；窄数据表仍走
  矢量 PDF，宽数据表自动回退栅格 PDF；超宽时按画布宽度降采样。
- 18 行以上的表格在预览区会把剩余高度均分给行高，减少卡片底部空白；CSV 短表
  仍按内容高度显示。

## 兼容与验证

- 保留 1.10.0 的 CSV 分隔符/空引号、HTML charset、BOM、GB18030、数据导出等修复。
- `npm run check`：ESLint、50 个前端单测、仓库/版本检查、fmt、clippy
  `-D warnings`、75 个 Rust 测试、Vite build 全部通过。
- `npm run selftest`：真实 WebView 10 篇示例全部通过；真实 GBK 股票信号文件
  24 行 × 18 列读取及 PNG/PDF 导出成功。
- 1440×900、1920×1080（4K/200%）和 3840×2160 物理截图均已验证。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.1-win-x64-portable.zip` |
| Linux | `rustmd_1.10.1_amd64.deb` / `rustmd_1.10.1_amd64.AppImage` |
| macOS | `rustmd-1.10.1-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**：
首次启动会被 Gatekeeper 拦截，请在系统设置 → 隐私与安全性中选择“仍要打开”，
或执行 `xattr -dr com.apple.quarantine /Applications/rustmd.app`。

请使用对应平台的 `.sha256` / `SHA256SUMS-linux.txt` 校验；合并的
`SHA256SUMS.txt` 需要先把全部 Release 资产下载到同一目录再执行
`sha256sum -c SHA256SUMS.txt`。
