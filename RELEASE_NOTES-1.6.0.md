# rustmd 1.6.0

这一版把笔记格式标记统一：**Markdown 和 HTML 使用同一套醒目的格式徽标**。

## 变更

- **列表徽标统一**：笔记列表里每条笔记都显示格式徽标——`MD`（绿色）/
  `HTML`（蓝色）。此前只有 HTML 有标记，Markdown 只能靠 `.md` 文件名辨认；
  现在两种格式一眼可辨，排序、搜索、文件夹视图里表现一致。
- **顶栏徽标同步**：打开笔记后，标题旁的格式徽标使用相同配色语义
  （`MD` 绿色、`HTML` 蓝色），并带 `title` 与 `aria-label`。
- **主题适配**：明暗两套主题分别配置了绿色/蓝色的前景与浅底色，对比度足够，
  深色主题下也清晰。
- 纯 UI 变更：编辑、预览、搜索、导出、文件格式和 IPC 均未改变。

## 验证

- `npm run check`：ESLint、20 个前端单测、57 个通过的 Rust 测试、fmt、clippy、
  Vite build 全部通过。
- `npm run selftest`：6 篇示例（含 HTML）通过，PDF 仍为矢量文字。
- GitHub Actions release workflow 会再次运行 `npm run check` + Linux Xvfb E2E +
  release-notes preflight，再构建三端资产。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.6.0-win-x64-portable.zip` |
| Linux | `rustmd_1.6.0_amd64.deb` / `rustmd_1.6.0_amd64.AppImage` |
| macOS | `rustmd-1.6.0-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 ad-hoc 签名。
请用 `SHA256SUMS.txt` 校验完整性。
