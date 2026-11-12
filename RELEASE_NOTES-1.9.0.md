# rustmd 1.9.0

这一版把“笔记库管理”和侧栏空间利用率一起升级：最近笔记库支持钉死/置顶（最多
20 个），可以同时打开多个置顶库并汇总浏览；侧栏的分区比例可调，默认把更大的
面积留给下方笔记列表。

## 新增

- **最近笔记库 20 条 + 钉死/置顶**：切换窗口按最近使用顺序最多列出 20 个目录。
  每个目录右侧的图钉可把笔记库钉死/置顶；置顶库固定显示在“置顶”分组最上方，
  不参与容量淘汰。当前目录标记、置顶状态和顺序都会持久化。
- **多库同开**：搜索框下方新增“多库”按钮。开启后同时加载所有置顶库和当前库：
  笔记列表汇总展示，每条笔记带所属库徽标；文件夹树按库分组，各库的子目录独立
  选择。打开、保存、重命名、移动、删除和导出都会使用笔记所属的库目录。
- **库根与子目录折叠**：多库视图中的库根节点和各级子目录都可以折叠/展开；
  库根折叠状态存 `rustmd-collapsed-vaults`，子目录展开状态沿用
  `rustmd-expanded-folders`。
- **可调侧栏比例**：侧栏默认 320px，文件夹/标签区按内容自适应，笔记列表占满
  剩余高度；两者之间新增可拖动分隔条。拖动可随时调整，双击/Enter 恢复默认，
  高度存 `rustmd-nav-height`；分隔条也支持键盘方向键 / Home / End 调整。

## 变更

- 侧栏顶栏、搜索区、标签区与笔记条目的间距整体收紧，默认可见笔记数明显增加。
- 浏览器 mock 支持按目录隔离的示例库（`D:\Notes`、`D:\Knowledge`、
  `D:\Writing`），便于在浏览器模式验证置顶与多库聚合。
- README 中英文、AGENTS、架构/测试/安全/发布/审计文档同步更新；README 截图
  按 320px 侧栏重新生成，并新增多库同开截图。
- Windows 绿色 zip、Linux deb/AppImage、macOS Apple Silicon DMG 的构建与签名
  方式不变。

## 数据与兼容

- `rustmd-recent-dirs` 从纯字符串数组自动升级为 `{ dir, pinned }` 对象数组；
  旧数据无需手动迁移，首次读取时自动兼容。
- 新增 `rustmd-multi-vault`、`rustmd-collapsed-vaults`、`rustmd-nav-height`
  三个本地偏好键；笔记文件、front matter、HTML 笔记和导出格式不变。
- 新增 `set_notes_roots` IPC，用于把多个已打开库根注册给 `rmd` 本地图片协议和
  `read_local_image`。每个文件仍逐个根目录做 canonicalize + 前缀检查，不放松
  路径封闭；主窗口校验、CSP、HTML 隔离和导出边界不变。

## 验证

- `npm run check`：ESLint、34 个前端单测、仓库/版本检查、`cargo fmt`、
  clippy `-D warnings`、64 个 Rust 测试（63 通过 + 1 个网络测试 ignored）、
  Vite build 全部通过。
- `npm run selftest`：真实 WebView 渲染 6 篇示例（含 HTML），`report.ok: true`、
  0 errors；picsum 远程图不可达记为 1 条 warning（既有容错策略），
  `--require-html` 报告校验通过。
- 浏览器 mock：置顶/取消置顶、20 条上限与置顶不淘汰、多库聚合列表、按库分组的
  文件夹树、跨库打开/编辑/保存、库根与子目录折叠、侧栏分隔条拖动/双击重置。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.9.0-win-x64-portable.zip` |
| Linux | `rustmd_1.9.0_amd64.deb` / `rustmd_1.9.0_amd64.AppImage` |
| macOS | `rustmd-1.9.0-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**：
首次启动会被 Gatekeeper 拦截，请在系统设置 → 隐私与安全性中选择“仍要打开”，
或执行 `xattr -dr com.apple.quarantine /Applications/rustmd.app`。

请优先使用对应平台的 `.sha256` / `SHA256SUMS-linux.txt` 校验；合并的
`SHA256SUMS.txt` 需要先把全部 Release 资产下载到同一目录再执行
`sha256sum -c SHA256SUMS.txt`。
