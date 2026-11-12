# rustmd 1.7.0

这一版新增**最近笔记库快速切换**：在多个笔记库之间来回切换时，不必每次都从
盘符和文件夹树里重新找路径。

## 新增

- **最近笔记库列表**：侧栏“切换笔记目录”按钮直接弹出最近打开的目录，当前
  笔记库带“当前”标记；点一下即可切换，非当前项可用 `×` 移除。列表按最近
  使用排序，最多 8 个，重启应用后仍在。
- **键盘与关闭行为**：`Esc` 或点击弹层外部关闭；按 `Esc` 关闭时焦点回到切换按钮。
- **引导页一键进入**：首次启动或上次目录不可用时，目录选择页也显示最近目录，
  点击即打开，不用重新浏览系统目录树。
- **浏览从当前目录开始**：弹层里的“浏览其他目录…”会把当前笔记库作为原生
  目录对话框的初始位置；选中后直接打开。
- **Windows 路径去重**：忽略大小写与 `/`、`\` 差异，同一目录不会在列表里
  出现两次。
- 切换前仍会先保存未保存内容；保存失败照旧弹出确认，不会静默丢修改。

## 变更

- 最近目录只保存在本机 `localStorage.rustmd-recent-dirs`，不上传、不写入
  笔记库，也不改变笔记文件格式。
- 纯前端改动（`main.js` / `vaultlist.js` / `api.js` / `style.css` / i18n /
  `index.html`）：不新增 IPC，不改变 Rust 命令、权限、CSP、路径封闭和 HTML
  隔离边界。
- README 中英文版、AGENTS、架构/测试/发布/安全/审计文档同步更新，并新增
  中英文“最近笔记库切换”截图。
- Windows 绿色 zip 随附 README/CHANGELOG/`docs/`（含截图）与 SECURITY，
  解压后离线查看 README 时截图与文档链接可用。

## 验证

- `npm run check`：ESLint、26 个前端单测、仓库/版本检查、`cargo fmt`、
  clippy `-D warnings`、58 个 Rust 测试、Vite build 全部通过。
- `npm run selftest`：6 篇示例（含 HTML）通过；Markdown/HTML PDF 仍为矢量
  文字，HTML iframe、本地资源内联和远程图片警告路径保持覆盖（本次 picsum
  远程图不可达，按既有策略记为 warning，不阻塞发布）。
- 浏览器 mock 交互检查：切换、MRU 更新、移除、ESC/焦点、中英文文案和
  900×560 最小窗口布局全部通过。
- GitHub Actions release workflow 会再次运行 `npm run check` + Linux Xvfb E2E
  + release-notes preflight，再构建三端资产。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.7.0-win-x64-portable.zip` |
| Linux | `rustmd_1.7.0_amd64.deb` / `rustmd_1.7.0_amd64.AppImage` |
| macOS | `rustmd-1.7.0-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**：
首次启动会被 Gatekeeper 拦截，请在系统设置 → 隐私与安全性中选择“仍要打开”，
或执行 `xattr -dr com.apple.quarantine /Applications/rustmd.app`。

请优先使用对应平台的 `.sha256` / `SHA256SUMS-linux.txt` 校验；合并的
`SHA256SUMS.txt` 需要先把全部 Release 资产下载到同一目录再执行
`sha256sum -c SHA256SUMS.txt`。
