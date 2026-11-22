# 目录结构与命名规范

本文件是仓库布局与命名的唯一规范。新增文件前先在这里找到对应类别；`npm run check:repo`
会校验本规范中的关键路径与文档相对链接。

## 1. 顶层布局

```
rustmd/
├── README.md / README.en.md      # 用户文档（中 / 英），GitHub 首屏
├── CHANGELOG.md                  # 版本历史（Keep a Changelog）
├── AGENTS.md                     # 开发/代理契约（架构、安全、发布流程）
├── CONTRIBUTING.md               # 贡献流程与许可条款
├── CODE_OF_CONDUCT.md            # 社区行为准则
├── LICENSE                       # 应用许可（GPL-3.0-or-later）
├── LICENSES/                     # 可复用层许可全文（REUSE 命名）
│   ├── MIT.txt
│   └── Apache-2.0.txt
├── docs/                         # 所有长文档与文档资源
├── release-notes/                # 每个版本一份发布说明
├── scripts/                      # 所有构建/校验/发布脚本（按用途分组）
├── packaging/                    # 包管理器清单（winget / Scoop / AUR / Homebrew）
├── examples/                     # 示例笔记库，同时是 E2E 自测夹具
├── frontend/                     # Vite 前端（index/mathlab/vite.config/src/shims）
├── crates/rustmd-core/           # 平台无关引擎（MIT OR Apache-2.0）
├── src/main.rs                   # Tauri 层（GPL-3.0-or-later）
├── capabilities/                 # Tauri 权限
├── gen/                          # Tauri 代码生成（勿手改）
├── icons/                        # 应用图标（npm run icons 生成）
├── .github/                      # workflows、issue/PR 模板、SECURITY
├── Cargo.toml / Cargo.lock
├── package.json / package-lock.json
├── tauri.conf.json
├── build.rs / rust-toolchain.toml
├── eslint.config.js
└── .editorconfig / .gitattributes / .gitignore
```

规则：

- **根目录只放入口文档、构建清单、工具配置和目录。** 一次性脚本、临时文档、截图、构建产物
  一律放进对应目录（构建产物已被 `.gitignore` 忽略）。
- 根目录文档只保留上表列出的文件；新增长期文档一律进 `docs/`。
- 应用与两个可复用层的许可是有边界的：应用 GPL-3.0-or-later，`crates/rustmd-core` 与
  `frontend/src/shared` 为 MIT OR Apache-2.0（见 [LICENSING.md](LICENSING.md)）。

## 2. docs/

```
docs/
├── ARCHITECTURE.md       # 数据流、IPC、安全模型
├── AUDIT_REPORT.md       # 当前审计状态 + 历史记录
├── CONVENTIONS.md        # 本规范
├── LICENSING.md          # 分层许可与边界
├── LINUX_BUILD.md        # Linux 依赖、构建、打包、无 root 兜底
├── RELEASING.md          # 版本、签名、三端发布
├── SECURITY.md           # 威胁模型与残余风险
├── TESTING.md            # 单测 / E2E / CI
├── assets/               # 可再生成的文档资源
│   ├── demo.gif
│   ├── screenshots/*.png
│   ├── social-preview.html / .png
│   └── compare-wechat.html / .png
└── marketing/            # 对外文案
    ├── GITHUB_PROJECT_COPY.md
    └── PROMOTION.md
```

- 正式文档用 **UPPER_SNAKE.md**；子目录用 **小写 kebab-case**（`assets`、`marketing`）。
- `.github/SECURITY.md` 是 GitHub 的安全报告流程入口（GitHub 固定位置）；
  `docs/SECURITY.md` 是技术威胁模型，两者用途不同，不要合并。
- 图片资源只放 `docs/assets/`，不要散落在 `docs/` 根目录。
- `docs/assets/*.html` 是可再生成的源文件（headless Edge 截图），产物 PNG 与源文件同名。

## 3. release-notes/

- 固定命名：`release-notes/RELEASE_NOTES-<version>.md`（例如 `RELEASE_NOTES-1.11.1.md`）。
- 每个版本新增一个文件，历史文件不改写、不重命名。
- 正文由 `scripts/release/release-notes.mjs` 读取，作为 GitHub Release 内容；
  `CHANGELOG.md` 同时保留对应小节。
- 目录内的 `README.md` 是该目录的说明（不属于某个版本）。

## 4. scripts/

```
scripts/
├── README.md
├── checks/     # 只读校验，CI 与本地共用
├── dev/        # 开发服务器、自测、截图、图标
├── lib/        # 共享工具（例如 cargo 定位）
└── release/    # 打包、签名、Linux 冒烟、发布说明
```

脚本命名：**小写 kebab-case，`<动词>-<对象>.<扩展名>`**，动词用
`check / build / run / launch / gen / capture / sign / release`。

| 目录 | 用途 | 现有脚本 |
| --- | --- | --- |
| `checks/` | 只读校验（能失败就退出非 0） | `check-repo`、`check-version`、`check-license-boundary`、`check-packaging`、`check-selftest-report` |
| `dev/` | 本地开发 | `launch-dev`、`dev-server`、`run-selftest`、`capture-screenshots`、`gen-icons`、`run-dev.bat` |
| `lib/` | 供其他脚本/ npm 调用的工具 | `cargo.mjs` |
| `release/` | 发布链路 | `release-notes`、`sign-win.ps1`、`build-win-zip.ps1`、`run-build.bat`、`linux-headless-smoke.sh`、`linux-wayland-smoke.sh` |

- 平台后缀：Windows 专用 `*.ps1` / `*.bat`，Unix 专用 `*.sh`，跨平台优先 `*.mjs`。
- 脚本从自身位置计算仓库根（Node: `../../`；PowerShell: 两级 `Split-Path`；
  shell: `${BASH_SOURCE[0]}/../..`），因此可以从任意工作目录启动。
- 新增脚本必须：放进对应分组、在 `package.json`（如需要）与 CI 中登记、
  在 `scripts/README.md` 与 AGENTS 的命令表中出现。
- 不放一次性脚本；调试脚本留在本地临时目录。

## 5. 其他目录

| 目录 | 规则 |
| --- | --- |
| `packaging/` | 每个包管理器一个子目录；清单文件名由该生态固定（`PKGBUILD`、`*.yaml`、`*.json`、`*.rb`） |
| `examples/` | 面向用户的示例笔记，允许自然中文文件名；是自测夹具，新增/删除笔记要同步自测期望（10 篇） |
| `frontend/src/shared/` | 可复用渲染层，每个文件带 SPDX 头，禁止 Tauri 引用 |
| `crates/rustmd-core/` | 平台无关引擎，crate 目录 kebab-case；Rust 文件 snake_case |
| `capabilities/`、`gen/`、`icons/` | Tauri 约定；`gen/` 由工具生成，勿手改 |
| `.github/` | workflows、issue/PR 模板与 `SECURITY.md` 使用 GitHub 固定命名 |

## 6. 代码命名

- **Rust**：模块/文件 `snake_case`；类型 `PascalCase`；函数/变量 `snake_case`；测试函数描述行为。
- **JavaScript**：模块文件 `kebab-case` 或小写单词（`main.js`、`api.js`、`notelist.js`）；
  函数/变量 `camelCase`；常量 `UPPER_SNAKE`；纯函数测试与模块同名 `*.test.js`。
- **CSS**：类名 `kebab-case`；主题变量 `--kebab-case`；不使用内联样式传用户数据。
- **i18n**：字典键 `点分命名空间`（`toast.saveFailed`、`data.jsonEmpty`）；中英两个字典必须同时存在。
- **localStorage/sessionStorage**：`rustmd-` 前缀（`rustmd-sidebar-width`、`rustmd-recent-dirs`）。
- **HTML id**：`#btn-*`（按钮）、`#input-*`（输入）、`#*` 面板/容器；`data-i18n*` 仅用于静态文案。

## 7. Git 与发布命名

- 分支：`master`（GitHub / GitLab 镜像同步）。
- 标签：`v<semver>`，与 `package.json` / `Cargo.toml` / `tauri.conf.json` / lockfile 一致
  （`npm run check:version v<semver>`）。
- 提交：`<type>(<scope>): <summary>`，type 用 `feat/fix/docs/chore/refactor/test/build/ci/release`。
- 发布资产：`rustmd-<version>-win-x64-portable.zip`、`rustmd-<version>-macos-arm64.dmg`、
  `rustmd_<version>_amd64.deb`、`rustmd_<version>_amd64.AppImage`（由 release workflow 生成）。
- 本地构建产物：`release/<version>/`（已被 `.gitignore` 忽略）。

## 8. 检查清单

改动目录/脚本/文档后至少运行：

```bash
npm run check:repo        # 必需文件、文档相对链接、脚本路径
npm run check:license     # 许可分层与 SPDX
npm run check:packaging   # 包管理器清单一致性
npm run check:version     # 版本一致
npm run check             # 全量门禁
```
