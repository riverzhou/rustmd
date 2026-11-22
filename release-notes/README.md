# 发布说明（Release notes）

每个版本的发布说明放在本目录，文件名固定为 `RELEASE_NOTES-<version>.md`
（例如 `RELEASE_NOTES-1.11.1.md`）。仓库根目录不再堆放发布说明。

- 发布流程：新增本版本的 `RELEASE_NOTES-<version>.md`，同时在 `CHANGELOG.md`
  补对应小节（两者都写；`scripts/release-notes.mjs` 接受任一，找不到才失败）。
- 正文取用：`node scripts/release-notes.mjs v<version>` 会优先输出本目录的
  发布说明，否则从 `CHANGELOG.md` 抽取对应小节；GitHub Release 正文即来自它。
- 校验：`npm run check:repo` 会检查当前 `package.json` 版本对应的
  `release-notes/RELEASE_NOTES-<version>.md` 是否存在，并检查本目录的相对链接。
- 历史文件保持原样，不随版本重命名或改写；新版本只新增文件。

English: one file per release, named `RELEASE_NOTES-<version>.md`, consumed by
`scripts/release-notes.mjs` for the GitHub Release body.
