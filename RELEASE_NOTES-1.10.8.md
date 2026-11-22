# rustmd 1.10.8

数学公式离线渲染修复版。安装版（CSP 生效）此前会把整篇笔记的公式都留在
`$…$` 原文；本版把 MathJax 的字体与 TeX 扩展全部内置，断网也能完整渲染。

## 修复

- **安装版数学公式全部不渲染**：MathJax v4 的字体数据（calligraphic、
  double-struck、fraktur…）和未内置的 TeX 扩展默认从 `cdn.jsdelivr.net`
  按需加载。安装版 CSP 只允许 `'self'`，请求被拦截后 MathJax 会丢弃
  **整个排版批次**，`数学公式全面测试.md` 实测 34/34 个公式全部停留在
  `$…$` 原文（`Markdown数学公式指南.md` 132/132 同样受影响）。
  现在 Vite 构建把 NewCM 字体包与 41 个 TeX 扩展镜像到应用同源，
  `loader.paths` 指向本地副本；断网 + CSP 下正常渲染。
- **引用块 / 列表中的块级公式被压扁**：`> $$…$$`、`- $$…$$` 不在原有保护
  正则内，marked 吃掉 `\\` 行分隔符；新增容器感知的块级公式保护，并在扫描
  前归一化 CRLF。
- **`\$` 转义被误当成公式**：marked 先去掉反斜杠，两个价格因此被 MathJax
  配成公式；现在 `\$` 还原为 `mathjax_ignore` 中的字面 `$`。
- **公式编号与引用失效**：启用 AMS tags 后 `\label` / `\eqref` / `\tag`
  正常编号；每次渲染前 `texReset()`，消除二次渲染的
  “Label … multiply defined” 与跨笔记引用串号。
- **扩展宏显示为红色未定义**：显式加载并离线镜像 physics、bbm、dsfont、
  textcomp、gensymb、upgreek、mathtools、units、braket，
  `\dv`、`\pdv`、`\mathbbm`、`\mathds`、`\degree`、`\braket{a|b}` 等可用。
- **Markdown 表格对齐**：`:--` / `--:` / `:-:` 的 `align` 属性此前被全局
  `text-align: left` 覆盖，现在左 / 中 / 右对齐都生效。

## 已知限制

- physics 与 braket 都定义 `\braket`；当前按加载顺序采用 braket 的
  `\braket{a|b}` 写法，physics 的双参数形式被遮蔽（`\bra{a}`、`\ket{b}`
  不受影响）。

## 验证

- 安装版真实 WebView2 + CSP 下：`数学公式全面测试.md` 34/34、
  `Markdown数学公式指南.md` 132/132 公式渲染；22 篇多格式笔记
  （MD / HTML / CSV / TXT / JSON / GBK / BOM）预览 0 控制台错误、
  0 残留公式、0 未定义宏。
- PNG + PDF 全量导出自测 22 条通过（0 错误 / 0 警告）；
  `npm run check` 全绿（69 个前端单测、75 个 Rust 测试、fmt/clippy/ESLint/
  仓库/版本检查与 Vite 构建）。

## Linux 兼容性

- 与 1.10.7 一致：在 **Ubuntu 26.04** 上构建，运行基线为 **Ubuntu 24.04+ /
  glibc 2.39**，需要 GTK 3 与 WebKitGTK 4.1 运行库。
- Ubuntu 22.04 用户请继续使用 1.10.4，或按 `LINUX_BUILD.md` 从源码构建。

## 下载

| 平台 | 文件 |
| --- | --- |
| Windows | `rustmd-1.10.8-win-x64-portable.zip` |
| Linux | `rustmd_1.10.8_amd64.deb` / `rustmd_1.10.8_amd64.AppImage` |
| macOS | `rustmd-1.10.8-macos-arm64.dmg` |

Windows 为自签名（SmartScreen 仍提示未知发布者）；macOS 为 **ad-hoc 签名、未公证**。
每个平台资产旁有 `.sha256`（Linux 另有 `SHA256SUMS-linux.txt`），Release 里还有
合并的 `SHA256SUMS.txt`。
