# scripts/ — 脚本索引与约定

本目录只放构建、校验、开发与发布脚本；目录/命名规范见
[`docs/CONVENTIONS.md`](../docs/CONVENTIONS.md)。

## 分组

| 目录 | 用途 | 脚本 |
| --- | --- | --- |
| `checks/` | 只读校验，CI 与本地共用；失败退出非 0 | `check-repo.mjs`、`check-version.mjs`、`check-license-boundary.mjs`、`check-packaging.mjs`、`check-selftest-report.mjs` |
| `dev/` | 本地开发与自测 | `launch-dev.mjs`、`dev-server.mjs`、`run-selftest.mjs`、`capture-screenshots.mjs`、`gen-icons.mjs`、`run-dev.bat` |
| `lib/` | 供其他脚本/npm 调用的工具 | `cargo.mjs` |
| `release/` | 发布链路 | `release-notes.mjs`、`sign-win.ps1`、`build-win-zip.ps1`、`run-build.bat`、`linux-headless-smoke.sh`、`linux-wayland-smoke.sh` |

## 常用入口

```bash
npm run check                 # 全量门禁（内部调用 checks/ 与 lib/cargo.mjs）
npm run selftest              # dev/run-selftest.mjs → launch-dev.mjs → dev-server.mjs
npm run icons                 # dev/gen-icons.mjs
node scripts/dev/capture-screenshots.mjs   # README 截图（需 npm run dev + CDP :9333）
node scripts/release/release-notes.mjs v1.11.1   # 输出 Release 正文
node scripts/release/build-win-zip.ps1           # Windows 绿色包（先 build + sign）
scripts/release/linux-headless-smoke.sh          # Linux Xvfb 冒烟
```

## 命名与实现约定

- 文件名：`<动词>-<对象>.<扩展名>`，小写 kebab-case；平台脚本用 `.ps1` / `.bat` / `.sh`。
- 从脚本自身位置定位仓库根（`scripts/<group>/x` → 上两级），不要依赖当前工作目录。
- 只读检查脚本不得写工作区（可写系统临时目录）；校验失败打印原因并以非 0 退出。
- 新增脚本：放进对应分组，更新 `package.json`（如需要）、CI、AGENTS 命令表与本文件。
