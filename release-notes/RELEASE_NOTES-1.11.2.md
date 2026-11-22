# rustmd 1.11.2

仓库结构与发布工具链整理版：**没有应用代码或文件格式变化**，功能与 1.11.1 完全一致。
不维护本仓库构建/文档的用户可以继续使用 1.11.1；升级没有兼容风险。

## 仓库结构

- 根目录只保留入口文档、构建清单与目录：审计报告与 Linux 构建指南移入 `docs/`，
  截图 / 演示图 / 海报归 `docs/assets/`，对外文案归 `docs/marketing/`。
- 发布说明继续放在独立的 `release-notes/` 目录。
- 许可全文改为 REUSE 规范的 `LICENSES/MIT.txt`、`LICENSES/Apache-2.0.txt`。
- 脚本按用途分为 `scripts/checks/`、`dev/`、`lib/`、`release/`，全部从自身位置
  定位仓库根，可以从任意工作目录调用。

## 规范与文档

- 新增 `docs/CONVENTIONS.md`：目录与命名的唯一规范（文档、脚本、资源、代码、
  Git 分支/tag/commit 约定）。
- 新增 `scripts/README.md`：脚本分组与入口索引。
- README、AGENTS、RELEASING、TESTING、营销文案等同步新路径；
  `npm run check:repo` 校验必需文件、文档相对链接与新布局。
- 修复 `CHANGELOG.md` 中误写入的 NUL 字节（此前 grep 会把整个文件当作二进制）。

## 发布工具链

- `package.json`、CI / release workflow、Tauri dev server、Windows 绿色包与 DMG
  脚本、Linux 冒烟脚本全部适配新路径。
- Windows 绿色包与 DMG 内的离线文档按新布局打包（含 `docs/CONVENTIONS.md`、
  审计报告与 Linux 构建指南），离线 README 链接保持有效。
- 校验：`npm run check` 全绿、真实 WebView2 E2E 自测 10 篇示例 0 错误、
  Windows 绿色包重建通过、`npm run icons` 无差异、GitHub Actions 全绿。

## 升级说明

- 功能无变化，按需升级。Windows 用户覆盖解压即可。
- Scoop / Homebrew 清单会在新资产发布后刷新到 1.11.2；也可继续安装 1.11.1
  （两者应用行为相同）。
