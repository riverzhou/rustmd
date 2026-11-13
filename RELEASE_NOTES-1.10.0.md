# rustmd 1.10.0

这一版把 rustmd 从“Markdown / HTML 笔记”扩展为**五种格式的本地笔记与数据查看器**：
新增 CSV 表格、TXT 制表符对齐、JSON 检查器，并为所有格式补齐格式徽标、新建菜单、
编码状态和 HTML/PNG/PDF 导出。表格列宽、对齐、隔行底色与按列文字色也做了系统性
优化。

## 新增

- **CSV 表格**：引号字段、字段内换行、双引号转义；逗号/制表符/分号/竖线分隔符
  嗅探；首行表头；数字/日期/货币/布尔智能对齐；短列收紧、长文本列占余宽；
  隔行底色 + 按列文字色 + 细分隔线 + 悬停高亮。
- **TXT 制表符对齐**：按制表符拆列并保留空格；无制表符行整行显示；自动跳过前置
  说明行、按第一行多列文本识别表头；等宽字体与智能列宽。
- **JSON 检查器**：键值分列、对象/数组分组浅底与侧边轨、类型/数量标签、类型圆点、
  可折叠分组；字符串/数字/布尔/null 独立语义色；非法 JSON 显示错误和完整原文；
  浅色/深色两套配色。
- **自适应编码**：BOM → UTF-8 → GBK → GB18030；状态栏显示当前编码；保存沿用
  原编码和 BOM；GBK 文件新增四字节字符（emoji）时兼容升级为 GB18030；重复 UTF-8
  BOM 归一化，不会累积。`NoteMeta` 也返回编码，保存后状态栏同步。
- **全格式导出**：CSV/TXT/JSON 与 Markdown 共用 HTML/PNG/PDF 导出；数据 HTML
  保留表格/检查器样式与截断提示；HTML 笔记导出统一为 UTF-8 独立文件并规范化遗留
  `<meta charset="gbk">`。
- 4 个数据示例夹具，以及 HTML/CSV/TXT/JSON 中英文、深色截图。

## 变更

- 格式徽标、新建菜单、编辑器语法、列表标题和状态栏覆盖全部五种格式。
- 表格视觉从列底色改为“隔行底色 + 按列文字色”，并加入智能宽度提示；JSON 调色板
  与分组层次同步优化。
- 自测扩展到 10 篇示例（含 GBK CSV），报告检查新增 `--require-data`、数据表头
  对齐、HTML 文本不注入 DOM、数据 HTML 导出与 charset 断言；CI 自测上限 1200 秒。
- README 中英文、AGENTS、架构/测试/安全/发布/审计文档、GitHub 推广文案同步更新。

## 修复

- CSV 大行数渲染时的调用栈崩溃；分隔符被文本内逗号误导。
- TXT 前置说明行导致表头参与类型判断、数字列左对齐。
- 打印/导出时数据视图被 `overflow` 裁剪；非法 JSON 原文只导出 520px。
- Windows 保留名/前导点重命名；Unix 反斜杠文件名被误当路径分隔符。
- HTML 旧编码导出乱码；重复 BOM 保存累积；GB18030 四字节文件标错编码。
- 数据笔记保存冲突、重命名扩展名、GBK 升级等回归测试补齐。

## 数据与兼容

- 现有 Markdown / HTML 笔记、front matter、标签、最近笔记库和多库配置不受影响。
- 新增 `.csv` / `.txt` / `.json` 笔记；不写 front matter，不产生标签。
- 数据视图为资源上限：CSV 2000 行/100 列、TXT 5000 行/80 列、JSON 6000 节点；
  预览与导出都显示截断提示。
- 编码歧义保留说明：约 1920 个常用汉字的 GBK 字节也是合法 UTF-8，此时按 UTF-8
  读取；遇到乱码请先在外部转换。
- Windows 绿色 zip、Linux deb/AppImage、macOS Apple Silicon DMG 的构建方式不变。

## 验证

- `npm run check`：ESLint、45 个前端单测、仓库/版本检查、`cargo fmt`、
  clippy `-D warnings`、75 个 Rust 测试（Windows 74：73 通过 + 1 ignored；
  Linux/macOS 75：74 通过 + 1 ignored，额外 1 个 Unix 路径测试）、Vite build。
- `npm run selftest`：真实 WebView 渲染 10 篇示例，逐篇导出 HTML/PNG/PDF，
  `report.ok: true`；`check-selftest-report --require-html --require-data` 通过。
- 浏览器 mock 复核格式徽标、新建菜单、编码状态、表格对齐/列宽/配色、JSON 浅色
  深色、HTML 导出 charset 和数据导出。
- 额外用 300 行长 CSV 验证矢量 PDF 分页（13 页）与智能列宽（临时夹具不进入仓库）。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.0-win-x64-portable.zip` |
| Linux | `rustmd_1.10.0_amd64.deb` / `rustmd_1.10.0_amd64.AppImage` |
| macOS | `rustmd-1.10.0-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）。macOS 为 **ad-hoc 签名、未公证**：
首次启动会被 Gatekeeper 拦截，请在系统设置 → 隐私与安全性中选择“仍要打开”，
或执行 `xattr -dr com.apple.quarantine /Applications/rustmd.app`。

请优先使用对应平台的 `.sha256` / `SHA256SUMS-linux.txt` 校验；合并的
`SHA256SUMS.txt` 需要先把全部 Release 资产下载到同一目录再执行
`sha256sum -c SHA256SUMS.txt`。
