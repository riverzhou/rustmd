# 许可

rustmd 采用**分层许可**：应用本体是 GPL，抽出来的两个可复用组件是宽松许可。

> 这不是法律意见。对外发布前如需确认，请咨询律师。

---

## 1. 分层

| 部分 | 许可 | 说明 |
| --- | --- | --- |
| 应用：`src/`（Tauri 层）、`frontend/src/*.js`（桌面 UI）、`tauri.conf.json` | **GPL-3.0-or-later** | 与历史版本一致，不改变 |
| `crates/rustmd-core/`（平台无关引擎） | **MIT OR Apache-2.0** | Rust 生态惯例的双许可 |
| `frontend/src/shared/`（渲染栈 + host 桥） | **MIT OR Apache-2.0** | 无 Tauri 依赖，可独立复用 |
| `licenses/` | 上述双许可的全文 | — |

## 2. 为什么这样分

引擎（路径封闭、front matter、编码往返、扫描、hash、原子写）和渲染栈（Markdown / Mermaid / MathJax / 表格 / JSON 视图）本身是**可复用组件**，不是这个应用的私有细节。

- 宽松许可让它们能被其他前端、其他宿主、其他语言绑定直接使用，不必拖着整个应用；
- 应用继续 GPL，社区权利不变；
- 反过来，GPL 应用链接 MIT/Apache 代码是兼容的，不产生冲突。

这也顺带解决了一个长期问题：想知道"哪部分能抄、哪部分不能抄"的人，看目录就知道。

## 3. 为什么可以这样重许可

仓库只有一个人类作者（River Zhou，另有 dependabot 的机器提交），没有 CLA。

- 唯一版权人可以把任一文件换许可（**向前生效**）；
- 已经发布的版本对已经获得它的人仍然是 GPL，那些授权不会消失；
- 一旦将来合入外部贡献，这条路径就变复杂——见 §5。

## 4. 边界规则

1. `crates/rustmd-core/` 与 `frontend/src/shared/` 里**不得出现 GPL-only 代码**（复制粘贴也不行）。
2. 两个目录的每个源文件首行必须有 SPDX 头：`SPDX-License-Identifier: MIT OR Apache-2.0`。
3. **可复用层不得依赖应用层**：core 不得依赖 `tauri`；shared 不得 import `@tauri-apps/*`、读取 `__TAURI_INTERNALS__` 或直接调用 `invoke(`。
4. 可复用层的新依赖必须宽松（MIT / Apache-2.0 / BSD / ISC）。core 目前只有 `serde`、`encoding_rs`。
5. 可复用层通过 `host.js` 的桥接口获得宿主能力（`configureHost`），不直接摸宿主的 IPC。

以上 1–3 条由 `npm run check:license` 自动检查，已接入 `npm run check`。

## 5. 外部贡献

如果将来接受外部 PR：**先把贡献条款写进 `CONTRIBUTING.md`**。原因很实际——把一行外部贡献者写的代码从 GPL 层挪到 MIT 层，需要那位贡献者同意。这件事在没有贡献者时是零成本，有了之后是法律工程。

## 6. 不受影响的事

- **历史版本**：已发布的版本仍是 GPL，已有用户的授权不变。
- **应用本体**：桌面端继续 GPL-3.0-or-later。
- **依赖许可**：`Cargo.lock` / `package-lock.json` 里的第三方依赖各自保留其许可；发布二进制时按需附带声明。
