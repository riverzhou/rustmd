# rustmd 1.11.0

结构性重构版本：把引擎与渲染层拆成**可独立使用的模块**，应用本体仍为
GPL-3.0-or-later。桌面端的功能与渲染结果与 1.10.8 完全一致。

## 为什么要拆

应用里有两块东西是可复用的组件，而不是产品细节：**笔记引擎**（路径封闭、
front matter、编码往返、扫描、hash、原子写）和**渲染栈**（Markdown、Mermaid、
MathJax、CSV/TXT/JSON 视图、编辑器）。它们现在各自是独立的模块，可以用在
别的宿主里，不必拖着整个 Tauri 应用。

## 变更

- 新增 `crates/rustmd-core`（MIT OR Apache-2.0，无 Tauri 依赖）：约 1500 行领域
  逻辑，配 6 个只走公开 API 的集成测试。
- 新增 `frontend/src/shared/`（MIT OR Apache-2.0）：渲染栈 + 编辑器 + 纯函数层 +
  `host.js` 宿主桥。渲染代码不再直接调用 `api.js`，而是调用 `host.*`，由外壳
  注入实现。
- HTML 预览文档的 IPC 隔离脚本移回 `api.js`，作为 `host.htmlIsolationScript`
  注入——隔离预览文档是宿主的职责，不是渲染层的。
- 新增 `npm run check:license`：可复用层不得引入 Tauri 依赖或引用，每个文件必须
  带 SPDX 头。已接入 `npm run check`。

## 升级说明

- 用户视角：无变化，直接覆盖安装即可。
- 开发者视角：`frontend/src/{preview,dataview,dataformat,markdown,notelist,i18n,imgutil,editor}.js`
  移到了 `frontend/src/shared/`；`Cargo.toml` 变成 workspace，`cargo test` 改用
  `--workspace`。
