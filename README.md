# rustmd

用 Rust 写的本地 Markdown 笔记应用，功能对标 [YNote](https://github.com/yang0926/yanknote)：左侧笔记列表，右侧编辑器 + 实时预览。

- **后端**：Rust + [Tauri 2](https://tauri.app) —— 目录扫描、front matter 解析、全文搜索、文件读写
- **前端**：CodeMirror 6（Markdown 编辑 + 语法高亮）+ marked（实时预览）+ highlight.js（代码高亮），Vite 打包
- **存储**：纯本地 `.md` 文件，一个笔记库 = 一个文件夹，子目录 = 文件夹分组，标签存于文件头部 front matter

## 功能

- 笔记列表：标题（首个 heading 或文件名）+ 摘要 + 修改时间，按时间倒序
- 侧边栏可一键隐藏（顶栏按钮或 Ctrl+B），折叠状态持久化
- 编辑器 + 实时预览：编辑 / 分栏 / 预览 三种视图（快捷键 Ctrl+1 / Ctrl+2 / Ctrl+3），分栏可拖动；输入 500ms 防抖自动保存
- 全文搜索：大小写不敏感，列表高亮命中片段
- 文件夹与标签：子目录即文件夹；标签以 chips 形式编辑，持久化为 front matter
- 导出：HTML（带内嵌样式、跟随当前主题）/ 高清 PNG（2x 渲染，约 192 DPI）/ PDF（单页长文档，尺寸随内容），一键导出
- 深色 / 浅色主题，跟随系统，可手动切换
- 首选项（目录、视图、主题、侧边栏、分栏比例）保存在 WebView 的 localStorage

## 使用

开发模式（热更新）：

```bat
npm install
scripts\run-dev.bat
```

发布构建（生成 `target\release\rustmd.exe`）：

```bat
scripts\run-build.bat
```

> `run-*.bat` 是因为当前 shell 的 PATH 没有 rustup 的 `cargo`，脚本里补上了
> `C:\Users\River\.cargo\bin`。如果你的 PATH 正常，直接 `npx tauri dev` /
> `npx tauri build --no-bundle` 即可。

首次启动选择笔记目录（或手动输入路径）。浏览器模式下（`npm run dev` 直接访问
http://localhost:5173 ）使用内置内存 mock 数据，方便纯前端调试。

测试笔记目录：`C:\Users\River\AppData\Local\Temp\rustmd-test-notes`

## 测试

```bat
C:\Users\River\.cargo\bin\cargo.exe test
```

覆盖 front matter 解析、标题提取、片段生成、文件名清理、路径逃逸防护。

## 目录结构

```
├── Cargo.toml / build.rs     # Tauri 应用（Rust）
├── src/main.rs               # Tauri 命令 + 文件逻辑 + 单元测试
├── tauri.conf.json           # Tauri 配置
├── capabilities/default.json # 权限（core + dialog）
├── icons/                    # 应用图标（scripts/gen-icons.mjs 生成）
├── frontend/                 # Web 前端（Vite，无框架）
│   ├── index.html
│   ├── public/               # 图标、highlight.js 主题
│   └── src/                  # main.js / api.js / editor.js / preview.js / style.css
├── package.json              # 前端依赖 + tauri CLI
└── scripts/                  # 图标生成、构建/运行脚本
```

## 已知限制（v0.1）

- 删除笔记直接删文件，无回收站
- 搜索为子串匹配，未做分词
- 无快捷键（Tab 续行等编辑器内快捷键除外）
- 移动笔记通过菜单选择目标文件夹，不支持拖拽
