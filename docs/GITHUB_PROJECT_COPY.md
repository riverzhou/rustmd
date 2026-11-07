# GitHub 项目文案与可发现性

本文件给出可直接粘贴到 GitHub 仓库设置里的文案，以及提升搜索/点击率的建议。仓库 slug：`riverzhou/rustmd`。

> 2026-11-07：已通过 `gh repo edit` 应用下面的英文 About 描述与 20 个 topics。

## 1. About 描述（英文，推荐）

GitHub 的 About 描述会出现在搜索、仓库列表和社交预览中，是“被别人搜到”的第一入口。

> Local-first Markdown notes for Windows, macOS & Linux. Rust + Tauri 2, GPL-3.0, English/中文 UI, offline, plain `.md` files, folder tree, search, Mermaid, LaTeX, HTML/PNG/PDF export.

长度约 160 字符，包含 `Markdown notes`、`Windows`、`macOS`、`Linux`、`Rust`、`Tauri`、`offline`、`Mermaid`、`LaTeX`、`export` 等搜索词。

中文备选：

> 本地优先的 Markdown 笔记应用：Rust + Tauri 2，GPL-3.0，Windows/macOS/Linux，离线、纯 .md 文件、文件夹树、全文搜索、Mermaid、LaTeX、HTML/PNG/PDF 导出。

## 2. Topics（最多 20 个）

GitHub Topics 是搜索与“相关仓库”推荐的核心信号。建议：

```
markdown
markdown-editor
notes
note-taking
tauri
rust
desktop-app
offline
local-first
mermaid
mathjax
latex
pdf-export
windows
macos
linux
obsidian-alternative
typora-alternative
knowledge-base
i18n
```

一键设置（需要已登录的 `gh`）：

```bash
gh repo edit riverzhou/rustmd \
  --description "Local-first Markdown notes for Windows, macOS & Linux. Rust + Tauri 2, GPL-3.0, English/中文 UI, offline, plain .md files, folder tree, search, Mermaid, LaTeX, HTML/PNG/PDF export." \
  --add-topic markdown,markdown-editor,notes,note-taking,tauri,rust,desktop-app,offline,local-first,mermaid,mathjax,latex,pdf-export,windows,macos,linux,obsidian-alternative,typora-alternative,knowledge-base,i18n
```

如果 `--add-topic` 不接受逗号列表，重复传参：

```bash
gh repo edit riverzhou/rustmd \
  --add-topic markdown --add-topic markdown-editor --add-topic notes
```

## 3. README 搜索关键词

README 已包含自然出现的英文/中文关键词，不要为了 SEO 堆砌。重点词：

- 英文：local-first Markdown notes, Markdown editor, offline notes, knowledge base, Obsidian alternative, Typora alternative, Tauri, Rust, Mermaid, LaTeX, PDF export, portable Windows, macOS, Linux.
- 中文：Markdown 笔记、本地笔记、离线笔记、Markdown 编辑器、知识库、Obsidian 替代、Typora 替代、Tauri、Rust、Mermaid 图表、LaTeX 公式、PDF 导出、Windows 绿色版。

`README.md` 首段和 `README.en.md` 首段都包含仓库定位；GitHub 会索引 README 内容。

## 4. Social preview（社交预览图）

GitHub 仓库 Settings → Social preview 建议上传 1280×640 的图片。可直接用：

- `docs/screenshots/overview.png`（1440×900，上传后 GitHub 会裁切；若严格需要 1280×640，可再截一张带标题的图）
- 或 `docs/screenshots/dark.png`

推荐图上叠加一行文字：`rustmd — local-first Markdown notes`。

## 5. Release 文案

Release 标题：

```
rustmd v1.2.0 — local-first Markdown notes
```

第一段：

> Local-first Markdown notes for Windows, macOS and Linux. Folder tree, filename cards, full-text search, Mermaid, LaTeX, HTML/PNG/PDF export. Plain `.md` files, no account.

然后列出三端资产与 `SHA256SUMS.txt`。

## 6. 提升热度的非侵入做法

- **保持 README 首屏有截图、定位、下载入口**：访客 10 秒内知道它能做什么、怎么装。
- **每个 Release 写清楚三端资产和校验方式**：减少“下载了不会用”的流失。
- **GitHub Topics 覆盖“用途 + 技术栈 + 平台”**：例如 `markdown-editor`、`tauri`、`windows`、`obsidian-alternative`。
- **提交有意义的 Issue/PR 模板**（可选）：让外部反馈更容易变成可合并的改动。
- **不要刷 star 或堆砌无关关键词**：GitHub 搜索会降权，且损害信任。
- **在相关社区分享时用“解决什么问题”而不是“求 star”**：例如本地 Markdown、Obsidian 迁移、Windows 绿色软件、Tauri 实战。
- **保持发布节奏**：小步更新 + 清晰 CHANGELOG，比一次性大版本更容易被持续发现。

## 7. 当前仓库信息

- 仓库：`https://github.com/riverzhou/rustmd`
- 发布页：`https://github.com/riverzhou/rustmd/releases`
- CI：`https://github.com/riverzhou/rustmd/actions/workflows/ci.yml`
- 英文说明：`README.en.md`
- 中文说明：`README.md`
