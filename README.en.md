# rustmd

**Local-first Markdown notes for Windows, macOS and Linux.** Plain `.md` files, no account, no cloud lock-in — a lightweight desktop notes app built with **Rust + Tauri 2**.

[简体中文](README.md) · [English](README.en.md)

[![CI](https://github.com/riverzhou/rustmd/actions/workflows/ci.yml/badge.svg)](https://github.com/riverzhou/rustmd/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/riverzhou/rustmd?display_name=tag&sort=semver)](https://github.com/riverzhou/rustmd/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/riverzhou/rustmd/total)](https://github.com/riverzhou/rustmd/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-4f6df5)](#download)
[![Rust](https://img.shields.io/badge/Rust-2024-000?logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri)](https://tauri.app/)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/riverzhou/rustmd?style=social)](https://github.com/riverzhou/rustmd/stargazers)

Current version **1.2.0** · GPL-3.0-or-later · [Changelog](CHANGELOG.md) · [Latest release](https://github.com/riverzhou/rustmd/releases/latest)

## Screenshots

Folder tree, filename cards, sort direction, MathJax math and Mermaid diagrams:

<img src="docs/screenshots/overview.en.png" alt="rustmd English interface with folder tree, filename cards, editor and live preview" width="880">

Dark theme and sidebar details:

<img src="docs/screenshots/dark.en.png" alt="rustmd English dark theme with MathJax and Mermaid preview" width="880">

<img src="docs/screenshots/sidebar.en.png" alt="rustmd English sidebar with folders, sort buttons, filenames and tags" width="300">

## Multilingual UI

The first launch **follows the system language**: Chinese systems start in Simplified Chinese, everything else starts in English. A language selector is available at the top of the sidebar and on the first-run folder picker; switch between **English / 简体中文** at any time. The choice is stored locally and restored on the next launch. Switching updates the folder tree, note list, sorting, status bar, dialogs, export menu and errors immediately, without reloading notes or losing edits.

Chinese interface example:

<img src="docs/screenshots/overview.png" alt="rustmd Simplified Chinese interface" width="880">

## Why rustmd

If you want a Markdown tool that keeps your notes as **plain files** instead of a database:

- **Plain-text storage** — a note is a `.md` file, a folder is a folder. Use Git, Syncthing, iCloud, OneDrive or any sync tool.
- **Offline by default** — editing, search, preview and export work without a network; only remote images and update checks need one.
- **Lightweight and cross-platform** — Rust + Tauri 2 on Windows, macOS and Linux. Windows ships a portable zip.
- **More than an editor** — folder tree, full-text search, front matter tags, MathJax, Mermaid, syntax highlighting, HTML/PNG/PDF export.
- **Security-minded** — sanitized note HTML, CSP, path containment, SSRF protection, native save dialog for exports.
- **Easy to migrate to** — open an existing Obsidian/Typora/VS Code Markdown folder; unknown front matter fields (`title:`, `date:`, …) are preserved on save.

Good for personal knowledge bases, engineering notes, writing drafts, course notes and local Markdown documentation.

## Features

### Languages

- English and Simplified Chinese interfaces; the first launch follows the system language.
- The language selector lives at the top of the sidebar (and on the first-run folder picker); the choice is persisted locally.
- Switching does not reload notes or lose edits; sorting, status, dialogs and export labels update immediately.

### Navigation

- **Folder tree** with nested folders, empty folders, collapse/expand; selecting a parent includes all descendants.
- **Subfolders collapsed by default**; the expanded state is remembered.
- **Sort by modified time or file name**, with an `↑` / `↓` button to switch ascending/descending; the choice is remembered.
- **Filename on every note card**, plus title, excerpt, folder, time and tags — no more guessing between same-named notes.

### Search

- Searches **title, filename, tags and body**, case-insensitively.
- Highlights the matching window and tells you whether the hit was in the title, filename or tags.
- Debounced with a query sequence number so a slow old result cannot overwrite a newer one.

### Editing and preview

- CodeMirror 6 with Markdown syntax highlighting.
- Edit / split / preview (`Ctrl+1` / `Ctrl+2` / `Ctrl+3`); draggable split, persisted.
- 500 ms debounced autosave; external changes are detected by content hash and confirmed before overwrite.
- Save failures keep an “unsaved” state and prompt before switching or closing.

### Markdown rendering

- GFM tables, task lists, strikethrough, autolinks.
- Code highlighting via highlight.js.
- **Mermaid** diagrams (flowchart, sequence, class, gantt, state, pie, ER, …).
- **MathJax 4** inline/display LaTeX, matrices, align, cases — bundled and offline.
- `<details>` / `<summary>` blocks.
- Vault-local images via relative paths, `./`, `file:///`, absolute paths and `<img>`.

### Export

- **HTML** — embedded CSS, current theme, local images inlined (remote images stay linked).
- **PNG** — 3× rendering (~288 DPI), good for sharing.
- **PDF** — block-aware pagination, lossless PNG slices, bounded canvas memory.
- For PNG/PDF, remote images are fetched by the Rust backend and inlined, so exports no longer show blank images.
- The destination path comes from the native save dialog; the frontend cannot write arbitrary files.

### Security

- Note HTML is sanitized with DOMPurify before `innerHTML`; scripts, event handlers, `javascript:` URLs, `<style>`, `<iframe>` etc. are stripped.
- MathJax/Mermaid run after sanitization, then a narrow post-pass removes `on*`, dangerous links and external CSS URLs.
- CSP is enabled; external links open in the system browser.
- `resolve_in_root` contains notes and images inside the vault, rejects `..`, and blocks junction/symlink write escapes; the scanner skips symlinks.
- Remote image fetching rejects loopback/private/link-local/reserved addresses and re-validates redirects.
- Saves use a temp file + atomic rename; `baseHash` conflict detection avoids silent overwrites.

## Download

Get the latest from [GitHub Releases](https://github.com/riverzhou/rustmd/releases/latest):

| Platform | Asset | Notes |
| --- | --- | --- |
| Windows | `rustmd-<version>-win-x64-portable.zip` | Portable: unzip and run `rustmd.exe`, no installer |
| Linux | `rustmd_<version>_amd64.deb` / `rustmd_<version>_amd64.AppImage` | Debian/Ubuntu package / portable AppImage |
| macOS | `rustmd-<version>-macos-universal.dmg` | Universal (Apple Silicon + Intel) |

Each asset has a `.sha256`; releases also include a combined `SHA256SUMS.txt`.

### Windows

1. Unzip and run `rustmd.exe`.
2. Requires the **WebView2 Runtime** (preinstalled on Windows 10/11; install the Evergreen Runtime if missing).
3. The build is signed with a self-signed certificate (public `.cer` included) for integrity only. SmartScreen may still warn about an unknown publisher; verify the source and SHA256, then choose “Run anyway”.
4. The portable build does not write installer entries; delete the folder to remove the app.

### Linux

```bash
sudo apt install ./rustmd_<version>_amd64.deb
# or
chmod +x rustmd_<version>_amd64.AppImage
./rustmd_<version>_amd64.AppImage
```

AppImage needs FUSE; without it use `--appimage-extract-and-run`.

### macOS

The `.app` is **ad-hoc signed** (no Apple Developer ID, not notarized). On first launch, allow it in System Settings → Privacy & Security → “Open Anyway”, or run:

```bash
xattr -dr com.apple.quarantine /Applications/rustmd.app
```

Removing the warning completely requires Developer ID + notarization; see [docs/RELEASING.md](docs/RELEASING.md).

## Quick start

1. Launch the app and choose or type a notes folder.
2. Click `＋` to create a note; click folders to filter; click the arrow to expand subfolders.
3. Rename from the title field; tags, move, delete and export are in the top bar.
4. `Ctrl+B` toggles the sidebar.

Browser-only frontend development (no Rust):

```bash
npm install
npm run dev          # http://127.0.0.1:5173, in-memory mock data
```

## Development

Requirements: Node.js ≥ 20.19, Rust stable with `rustfmt` and `clippy`, and the Tauri system dependencies for your platform (Linux: [docs/TESTING.md](docs/TESTING.md)). Linux source builds, packaging and the no-root sysroot fallback are documented in [LINUX_BUILD.md](LINUX_BUILD.md); after building, `scripts/linux-headless-smoke.sh` smoke-tests the release binary on an isolated Xvfb display.

| Task | Command |
| --- | --- |
| All checks | `npm run check` |
| Tauri dev window | `node scripts/launch-dev.mjs` (`scripts\run-dev.bat` on Windows) |
| Frontend only (mock) | `npm run dev` |
| Release exe, no bundle | `npx tauri build --no-bundle` |
| Frontend unit tests | `npm run test:unit` |
| Rust tests | `npm run test:rust` |
| End-to-end self-test | `npm run selftest` / `npm run selftest:check` |
| Regenerate icons | `npm run icons` |

`scripts/cargo.mjs` probes `$CARGO`, `~/.cargo/bin/cargo` and PATH, so the Windows git-bash shell does not need a manual PATH tweak.

### Automated checks

`npm run check` runs:

1. ESLint 10
2. Node tests for sorting, folder tree, math protection, code segments and i18n
3. Repository checks (version sync, doc links, CSP, plugin permissions, icons, machine-specific paths, untracked `dist`)
4. `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`
5. Vite production build

CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the quality gate on Ubuntu, compiles on Windows/Linux/macOS, and runs the real-WebView E2E self-test under Xvfb.

### End-to-end self-test

```bash
npm run selftest
```

The dev window renders every note in `examples/`, exports PNG/PDF, and verifies residual raw math, multi-line math geometry, and that remote and vault-local images really appear in the exported PNG (2D NCC). Artifacts and `report.json` go to the system temp directory under `rustmd-selftest/` (override with `RUSTMD_SELFTEST_OUT`); the app exits 0/1. The code lives in `frontend/src/selftest.js` and is never bundled into release builds.

## Release pipeline

[`.github/workflows/release.yml`](.github/workflows/release.yml) is triggered by a `v*` tag (or manually with an existing tag):

- Windows portable zip + self-signed Authenticode (optional real PFX secrets);
- Linux deb + AppImage + SHA256;
- macOS universal DMG + ad-hoc signing;
- a combined `SHA256SUMS.txt` and a GitHub Release.

See [docs/RELEASING.md](docs/RELEASING.md) for signing and secrets.

## FAQ

**Is rustmd open source?**
Yes — **GPL-3.0-or-later**. You can use, modify and redistribute it; derivative works must be GPL-compatible. See [LICENSE](LICENSE).

**Does it sync?**
The app does not sync. Notes are a plain folder — use Syncthing, Git, iCloud, OneDrive or Dropbox.

**Can it open my Obsidian vault?**
Yes for plain `.md` folders, folder hierarchy and front matter tags. Obsidian-specific `[[wikilinks]]`, plugins and canvas are not supported; other front matter fields are preserved on save.

**Why the Windows/macOS warning?**
Windows uses a self-signed certificate and macOS uses ad-hoc signing. They prove integrity, not a purchased identity. Verify SHA256 and allow the app in the OS prompt.

**Mobile support?**
Desktop only: Windows, macOS and Linux.

**Where are my notes?**
Only in the folder you opened. No database, account or upload.

**How can I contribute?**
Open an [issue](https://github.com/riverzhou/rustmd/issues) or PR. Run `npm run check` first; for rendering/export bugs, attach the `npm run selftest` report.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Testing & CI](docs/TESTING.md)
- [Release & signing](docs/RELEASING.md)
- [Security](docs/SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Audit report](AUDIT_REPORT.md)
- [Developer & agent guide](AGENTS.md)
- [GitHub project copy & topics](docs/GITHUB_PROJECT_COPY.md)

## License

rustmd is licensed under **GPL-3.0-or-later**. See [LICENSE](LICENSE).

## Support

If rustmd is useful to you, a ⭐ helps others discover it; sharing it with someone who wants local Markdown notes is also appreciated.

**Keywords:** local-first Markdown notes, Markdown editor, offline notes, knowledge base, Obsidian alternative, Typora alternative, Tauri, Rust, bilingual UI, English/Chinese, Mermaid, LaTeX, PDF export, portable Windows, macOS, Linux.
