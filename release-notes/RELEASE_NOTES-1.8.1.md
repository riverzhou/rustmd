# rustmd 1.8.1

这一版是发布目标补丁：macOS 只面向 Apple Silicon（arm64），不再构建
universal DMG，也不支持 Intel Mac。应用功能与 1.8.0 相同。

## 变更

- **macOS 仅 Apple Silicon**：CI 与 release workflow 改为
  `aarch64-apple-darwin`，移除 x86_64 / universal 构建。
- **资产改名**：macOS 下载文件为 `rustmd-1.8.1-macos-arm64.dmg`。
- **文档同步**：README、AGENTS、RELEASING、TESTING 和审计报告明确标注
  Apple Silicon 要求；Windows / Linux 资产与使用方式不变。
- 应用代码与 1.8.0 相同，当前文件夹范围、范围搜索、文件夹计数与标签云行为不变。

## 验证

- `npm run check` 全部通过：28 个前端单测、59 个 Rust 测试（58 通过 +
  1 个网络测试 ignored）、ESLint、仓库/版本检查和 Vite build。
- GitHub release workflow 在 macOS runner 上安装 `aarch64-apple-darwin`
  并构建、ad-hoc 签名 arm64 `.app`；1.8.0 的真实 WebView selftest
  （6 篇示例、0 errors、1 条 picsum warning）仍适用于本版应用代码。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.8.1-win-x64-portable.zip` |
| Linux | `rustmd_1.8.1_amd64.deb` / `rustmd_1.8.1_amd64.AppImage` |
| macOS | `rustmd-1.8.1-macos-arm64.dmg`（Apple Silicon only） |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**，
且仅支持 Apple Silicon（M 系列）；首次启动会被 Gatekeeper 拦截，请在系统设置 →
隐私与安全性中选择“仍要打开”，或执行
`xattr -dr com.apple.quarantine /Applications/rustmd.app`。

请优先使用对应平台的 `.sha256` / `SHA256SUMS-linux.txt` 校验；合并的
`SHA256SUMS.txt` 需要先把全部 Release 资产下载到同一目录再执行
`sha256sum -c SHA256SUMS.txt`。
