# rustmd 1.3.1

这一版修复 **PNG / PDF 导出中的内嵌 SVG 图片被裁剪、文字放大**的问题。

## 修复

- **内嵌 SVG 图片导出**：以 `data:image/svg+xml` 内联、只有 `viewBox` 而没有
  `width` / `height` 的 `<img>` 图片，此前在 PNG/PDF 导出中会被裁成左上角一小块，
  图表只剩巨大的标题和坐标轴数字（例如 QuantV5 回测报告的周期走势图）。
  浏览器给这类图片的 `naturalWidth` 只有约 300px，而 html2canvas 又会把
  `drawImage` 的源矩形按 SVG 用户单位（viewBox）解释，于是只画出了图表的左上角。
  现在导出前先把 SVG 图片按目标分辨率栅格化为 PNG，再交给 html2canvas。
- **HTML 导出**：原本就是浏览器原生渲染矢量 SVG，不受影响；本次一并实测。
- **回归测试**：端到端自测新增一张 viewBox-only 的红蓝双色 SVG，要求导出 PNG 中
  同时存在左右两色；`report.inlineSvg` 记录 `redPixels` / `bluePixels`，缺一色即
  失败。`docs/TESTING.md` 已同步说明。

## 验证

- 用真实的 `QuantV5-回测-month-20d-汇总-20261109-082004.md` 测试三种导出：
  - PNG：三张走势/分组图完整显示；
  - PDF：由同一张修复后的画布分页，共 4 页；
  - HTML：保留矢量 SVG，图表正常。
- `npm run check`、`npm run selftest` 均通过（自测 5 篇示例 + 内嵌 SVG 用例）。

## 变更

- 版本提升到 **1.3.1**；`package.json`、`Cargo.toml`、`tauri.conf.json`、
  `Cargo.lock`、`package-lock.json` 同步。
- README 中英文版与 `docs/RELEASING.md` 更新到 1.3.1。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.3.1-win-x64-portable.zip`（解压即用） |
| Linux | `rustmd_1.3.1_amd64.deb` / `rustmd_1.3.1_amd64.AppImage` |
| macOS | `rustmd-1.3.1-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍会提示未知发布者）；macOS 为 ad-hoc 签名
（首次打开需在“隐私与安全性”放行）。请用 Release 中的 `SHA256SUMS.txt`
校验完整性。

## 许可证

本项目以 **GPL-3.0-or-later** 开源，`LICENSE` 随仓库与发布包分发。
