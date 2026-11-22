# rustmd 1.11.1

1.11.0 之后的导出修复 + 一轮全量代码审计。没有文件格式变化，直接覆盖安装即可。

## 导出

- **宽数据表导出为可选中文字的 PDF**：不再回退成放大就糊的横向图片。导出器按表格
  宽度申请一张足够宽的横向纸张（最多 55 英寸），Windows / macOS / Linux 的打印
  引擎都把整张表按真实文字排版；只有超过上限的超宽表才回退栅格。
- **超长表格的栅格回退按行分页**：没有原生打印环境时，每页 3× 正常比例、自带表头，
  万行级 CSV 不再被压成几 DPI，也不会因同时保留几百张画布而耗尽内存。
- **数据笔记的独立 HTML 文件**：表格/JSON 在卡片内滚动，表头与横向滚动条始终可见，
  页脚贴底；打印该文件时恢复跨页的流式排版。
- **HTML 笔记的背景图片**（CSS `url()` 引用的本地图片）现在会出现在 PNG / PDF 里。

## 安全与稳定

- Linux 宽表打印的纸张设置此前因符号名中的 NUL 字节而静默失效，已修复。
- 笔记命令只接受 `.md/.html/.htm/.csv/.txt/.json`，与文档声明一致。
- HTML 渲染结果的解码/拼接移出主线程并加了解码上限，恶意笔记无法再让主进程
  分配约 1 GB 或卡住界面。
- 发布版的 `rmd` 协议只接受 Tauri 自身来源；本机任意网页不能 CORS 读取笔记库。
- 引擎扫描去掉了几处二次方复杂度（超长 front matter、未闭合 `<script>`、连续
  `&`、重复标签），front matter 的 `...` 结束符与重复 `tags:` 键现在正确往返。
- 保存体积上限、重命名碰撞、并发新建、文件缓存长度校验等一批边界问题修复。

## 发布工具链

- 新增 `npm run check:packaging`，校验各包管理器清单的版本/URL/SHA256 一致
  （Scoop 清单此前版本写 1.11.0、实际仍指向 1.10.7，已修复）。
- 版本检查覆盖 `crates/rustmd-core`；自测报告校验更严格（必须覆盖全部示例笔记、
  产物必须属于本次运行）。
- Windows 绿色包补上 `CONTRIBUTING.md`，macOS DMG 补上 `packaging/README.md`，
  离线文档不再有死链。

## 升级说明

- 用户：直接覆盖安装；Scoop 用户执行 `scoop update; scoop update rustmd`。
  winget 清单已作为 PR [#486380](https://github.com/microsoft/winget-pkgs/pull/486380) 提交，
  Homebrew 与 Scoop 已发布 1.11.1。
- 开发者：`npm run check` 现在多一步 `check:packaging`；Rust 测试为 99 个
  （Windows）/ 100 个（Linux、macOS），1 个需要网络的测试默认忽略。
