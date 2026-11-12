# rustmd 1.8.0

这一版把“默认只看当前文件夹”做成明确、可持久化的范围开关：打开笔记库或切换
文件夹时，列表和搜索先停留在当前目录，不再自动钻进所有子文件夹；需要时再一键
展开到整个子树。

## 新增

- **当前文件夹范围**：笔记列表、全文搜索、文件夹计数和标签云默认只覆盖当前
  文件夹的直属笔记。刚打开或刚切换笔记库时，当前文件夹就是库根目录。
- **“包含子文件夹”开关**：位于搜索框下方。打开后，列表与搜索递归覆盖当前
  目录的整个子树；文件夹计数同步从“直属笔记数”切换为“子树笔记数”。
- **范围搜索**：`search_notes` 在后端直接按当前目录扫描，不递归时只读取该目录
  顶层文件，不会先全库扫描再由前端过滤；搜索范围与列表范围始终一致。
- **标签云随范围变化**：只统计当前范围内的标签；切换目录/范围后，如果活动标签
  已不在范围内会自动清除，不会留下看不见的空过滤。
- **空状态提示**：当前目录没有直属笔记、但子文件夹里有笔记时，列表会提示打开
  “包含子文件夹”，避免误以为笔记库是空的。
- **设置持久化**：开关状态保存在 `localStorage.rustmd-include-subfolders`，
  重启应用后保持；切换笔记库时当前目录回到库根目录，但开关偏好保留。

## 变更

- 版本号提升到 **1.8.0**。
- 范围逻辑抽到 `notelist.js` 的 `folderInScope` / `countTags` 纯函数，前端单测、
  浏览器 mock 与 Rust 搜索实现保持同一套语义。
- README 中英文版、AGENTS、架构/测试/安全/发布/审计文档同步更新；README 截图
  重新生成，侧栏可见新的“包含子文件夹”开关。
- Windows 绿色 zip、Linux deb/AppImage、macOS universal DMG 的构建与签名方式不变。

## 验证

- `npm run check`：ESLint、28 个前端单测、仓库/版本检查、`cargo fmt`、
  clippy `-D warnings`、59 个 Rust 测试（58 通过 + 1 个网络测试 ignored）、
  Vite build 全部通过。
- 浏览器 mock：默认范围只显示根目录 2 篇；根目录搜索不返回子目录命中；打开开关
  后 7 篇全部出现、子目录搜索命中；关闭后 `work` 只显示 3 篇直属笔记；刷新后
  开关状态保持。
- `npm run selftest`：真实 WebView 中渲染 6 篇示例（含 HTML）并完成 PNG/PDF
  导出，报告为 `ok: true`、0 errors；picsum 远程图不可达记为 1 条 warning
  （既有容错策略，不阻塞发布），`--require-html` 报告校验通过。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.8.0-win-x64-portable.zip` |
| Linux | `rustmd_1.8.0_amd64.deb` / `rustmd_1.8.0_amd64.AppImage` |
| macOS | `rustmd-1.8.0-macos-universal.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**：
首次启动会被 Gatekeeper 拦截，请在系统设置 → 隐私与安全性中选择“仍要打开”，
或执行 `xattr -dr com.apple.quarantine /Applications/rustmd.app`。

请优先使用对应平台的 `.sha256` / `SHA256SUMS-linux.txt` 校验；合并的
`SHA256SUMS.txt` 需要先把全部 Release 资产下载到同一目录再执行
`sha256sum -c SHA256SUMS.txt`。
