# rustmd 1.2.0

这一版加入中英双语界面，并让语言跟随系统、选择本地记忆。

## 新增

- **English / 简体中文界面**：主界面、首次启动页、文件夹树、笔记列表、排序、状态栏、对话框、导出菜单与错误提示全部支持即时切换，不重载笔记，也不会丢失正在编辑的内容。
- **默认跟随系统**：首次启动读取 `navigator.language`。中文系统显示简体中文，其他系统默认英文；也可以通过语言选择器覆盖。
- **语言选择器在主界面可见**：侧栏顶部和首次启动的目录选择页都显示选择器，选项为 `English` / `简体中文`，控件 title / aria-label 为英文 `Language`。
- **选择本地持久化**：用户选择写入 `localStorage.rustmd-lang`，下次启动优先使用；删除该键后重新跟随系统。
- **英文 README 与英文截图**：`README.en.md` 使用 `overview.en.png` / `dark.en.png` / `sidebar.en.png`，中文 README 增加英文界面示例。
- **i18n 单元测试**：词典 key 对齐、变量插值、英文复数与系统语言检测；前端纯函数测试增至 17 个。

## 变更

- 版本提升到 **1.2.0**；`package.json`、`Cargo.toml`、`tauri.conf.json`、`Cargo.lock`、`package-lock.json` 同步。
- 时间、日期和字数统计按当前语言格式化；英文使用 `1 note` / `2 notes`、`1 word` / `2 words` 等复数。
- 导出 HTML 的 `<html lang>` 与页脚跟随当前界面语言；目录选择对话框标题由前端传入。
- README 中文 / 英文版均更新功能、截图与版本信息。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.2.0-win-x64-portable.zip`（解压即用） |
| Linux | `rustmd_1.2.0_amd64.deb` / `rustmd_1.2.0_amd64.AppImage` |
| macOS | `rustmd-1.2.0-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍会提示未知发布者）；macOS 为 ad-hoc 签名（首次打开需在“隐私与安全性”放行）。请用 Release 中的 `SHA256SUMS.txt` 校验完整性。

## 许可证

本项目以 **GPL-3.0-or-later** 开源，`LICENSE` 随仓库与发布包分发。
