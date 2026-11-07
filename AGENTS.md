# AGENTS.md

Rust + [Tauri 2](https://tauri.app) local Markdown notes app. The Rust backend
is one file (`src/main.rs`); the frontend is frameworkless vanilla JS bundled by
Vite. User-facing docs are Chinese; this file is the developer/agent contract.

## Commands

| Task | Command |
| --- | --- |
| All checks (lint, units, repo, fmt/clippy/test, build) | `npm run check` |
| Dev window (real Tauri, hot frontend reload) | `node scripts/launch-dev.mjs` |
| Dev window shortcut (Windows) | `scripts\run-dev.bat` |
| Browser dev (in-memory mock) | `npm run dev` → http://127.0.0.1:5173 |
| Release exe, no installer | `npx tauri build --no-bundle` |
| Windows release shortcut | `scripts\run-build.bat` |
| Frontend pure unit tests | `npm run test:unit` |
| Rust unit tests | `npm run test:rust` (`cargo test`) |
| E2E self-test (dev, real WebView) | `npm run selftest` |
| Verify the self-test report | `npm run selftest:check` |
| Regenerate app icons (PNG/ICO/ICNS) | `npm run icons` |

- `cargo`/`rustup` are often not on this shell's PATH. Use
  `node scripts/cargo.mjs …` (it probes `$CARGO`, `~/.cargo/bin/cargo`, PATH)
  or the `scripts\run-*.bat` wrappers.
- The E2E self-test writes artifacts and `report.json` to the system temp
  directory under `rustmd-selftest/`; override with `RUSTMD_SELFTEST_OUT` and
  `RUSTMD_SELFTEST_EXAMPLES`. It exits the app with 0/1 via a debug-only
  command, so CI can consume the verdict.
- CI: `.github/workflows/ci.yml` (quality gate + three-platform compile +
  Linux Xvfb E2E); release: `.github/workflows/release.yml` (Windows portable
  zip, Linux deb/AppImage, macOS universal DMG). Details: `docs/RELEASING.md`.

## Architecture

- `src/main.rs` — everything Rust, in sections:
  - types and path safety (`resolve_in_root`, `strip_extended_prefix`,
    `canonical_root`, symlink/junction checks);
  - front matter split/compose (unknown fields and CRLF are preserved);
  - note scanning (`list_notes`, `list_folders`), search, metadata;
  - commands (`read/save/create/rename/delete/move`) including atomic writes
    and hash-based external-change detection;
  - `fetch_image_bytes` (SSRF checks + redirect policy), `save_export`
    (native dialog + write in Rust);
  - the `rmd` custom protocol (`serve_rmd`, `VaultFileCache`, mtime + byte
    budget), `read_local_image`;
  - dev-only self-test commands (`selftest_config/write/finish`);
  - unit tests.
- `frontend/src/api.js` — the **only** Tauri bridge. Detects Tauri via
  `__TAURI_INTERNALS__` and falls back to an in-memory mock. Keep the mock’s
  validation/conflict/search behaviour aligned with Rust.
- `frontend/src/main.js` — UI state and DOM wiring (no framework/state lib).
  Save queue, conflict retry, unsaved guard, folder tree, sorting, search race
  guard, export menu.
- `frontend/src/notelist.js` — pure sorting/filtering/folder-tree helpers
  (covered by `node --test`).
- `frontend/src/markdown.js` — pure math protection + code-segment helpers
  (covered by `node --test`).
- `frontend/src/preview.js` — marked + DOMPurify + highlight.js + Mermaid +
  MathJax; local `<img>` rewriting to `rmd:`; external-link interception;
  HTML export.
- `frontend/src/export.js` — off-screen stage, image inlining, html2canvas,
  multi-page jsPDF.
- `frontend/src/editor.js` — CodeMirror 6 setup.
- `frontend/src/imgutil.js` — bytes→data URL and magic-byte MIME sniffing.
- `frontend/src/selftest.js` — dev-only E2E; dynamically imported from
  `main.js` under `import.meta.env.DEV`, never bundled into release builds.
- `frontend/src/style.css` — theme variables via `body[data-theme]`; sidebar,
  markdown, export stage.

### Data model

- Notes root = plain folder. Note paths are root-relative with forward slashes.
- Front matter is `---` … `---`/`...` at the top. Only `tags` is editable in
  the app; `compose_note` preserves every other line and the file’s CRLF/LF
  style, and rewrites only the `tags:` entry.
- `NoteMeta` includes `hash`; `NoteContent` includes `hash`/`mtime`. The
  frontend sends `baseHash` on save; a mismatch returns
  `conflict: note changed on disk` and the UI asks before forcing.
- `mtime` is unix seconds (display/sort only); `hash` is the conflict token.

### IPC commands (16)

`list_notes`, `list_folders`, `read_note`, `save_note`, `create_note`,
`rename_note`, `delete_note`, `move_note`, `search_notes`, `save_export`,
`fetch_image_bytes`, `set_notes_root`, `read_local_image`,
`selftest_config`, `selftest_write`, `selftest_finish`.

`save_export` opens the OS save dialog in Rust and writes the selected bytes;
there is deliberately **no** arbitrary `write_text`/`write_bytes` command.
`selftest_*` are debug-only (release stubs return an error).

### Adding a Tauri command (3 touch points)

1. `#[tauri::command]` fn in `src/main.rs`.
2. Register it in `tauri::generate_handler![...]` in `main()`.
3. Wrapper in `frontend/src/api.js` (keep a mock branch for browser mode).

If a new Tauri *plugin* is used:
- add the Rust crate and `.plugin(...)` in `main()`;
- add the JS package (if used from the frontend);
- add `"<plugin>:default"` to `capabilities/default.json` — otherwise the
  invoke fails at runtime. `npm run check:repo` verifies this automatically.

## Security invariants — do not relax

1. **Sanitize note HTML before `innerHTML`.** `preview.js` calls
   `DOMPurify.sanitize` with a static config; scripts, event handlers,
   `javascript:` URLs, `<style>`, `<iframe>`, forms etc. are stripped.
   MathJax/Mermaid run *after* that pass, so `sanitizeRenderedDom` removes
   executable attributes/links and external CSS URLs from their output.
   Exported HTML is built from the sanitized DOM, so it inherits the policy.
2. **CSP stays on.** `tauri.conf.json` has a non-null `app.security.csp`
   (`object-src 'none'`, no inline script). Do not set it to `null`.
3. **Path containment.** `resolve_in_root` rejects `..`/absolute paths,
   canonicalizes existing paths, and canonicalizes the deepest existing
   ancestor for new paths (junction/symlink escape guard). `walk` skips
   symlinks/junctions. `resolve_vault_file` is the equivalent guard for the
   `rmd` protocol and `read_local_image`.
4. **SSRF guard.** `fetch_image_bytes` only accepts http(s), rejects
   localhost/private/loopback/link-local/reserved targets, validates DNS
   resolution, and re-validates every redirect.
5. **Scoped writes.** `save_export` is the only user-visible writer outside
   the vault; it writes only the path returned by the native save dialog.
   `selftest_write` is debug-only and confined to the self-test output root.
6. **Mermaid** stays on `securityLevel: 'strict'`; external links go through
   the `opener` plugin instead of navigating the app.

## Change recipes

- **Save/load/front matter**: change `split_document`/`compose_note` and the
  `save_note_impl` tests together. Keep unknown fields and CRLF.
- **Search**: `search_notes` searches body, heading, filename and tags. The
  snippet window is 40 chars before the match and query length + 60 after;
  the mock in `api.js` mirrors it.
- **Preview/export**: `renderMarkdownInto` is shared by preview and export.
  Anything added there must be safe in both. `export.js` assumes the stage is
  948 px wide (860 content + 2×44 padding).
- **Sidebar**: `notelist.js` owns sorting/tree/filtering; `main.js` only
  renders. Keep counts (`count` = subtree, `direct` = exact folder) in sync.
  Expanded paths are stored in `rustmd-expanded-folders`; an empty set is the
  default, so every folder starts collapsed. Sort state is `rustmd-sort-key` +
  `rustmd-sort-dir` (`mtime` defaults to desc, `name` to asc).
- **Release**: bump `package.json`, `Cargo.toml`, `tauri.conf.json`, add a
  `CHANGELOG` section (and optionally `RELEASE_NOTES-<version>.md`), tag
  `v<version>`. The release workflow verifies the tag and builds all three
  platforms.

## Gotchas

- **White window = JS threw during module init.** `#onboarding` and `#main`
  are both `hidden` by default. Reproduce without Rust via `npm run dev`
  (mock mode) and read the browser console; in the app use WebView2 devtools
  (F12 in dev builds).
- **Vite binds IPv4 explicitly** (`127.0.0.1`) and `strictPort: true`;
  `tauri.conf.json` `devUrl` must match. A stray process on 5173 makes
  `tauri dev` serve stale content or show a white window.
- **`tauri dev` runs with `--no-watch`** (wired in `scripts/launch-dev.mjs`).
  The watcher watches the whole project and killed/restarted the app on any
  in-project write. Consequence: restart `scripts\run-dev.bat` after editing
  Rust/`tauri.conf.json`; frontend HMR is unaffected.
- **Vite 8 / rolldown** is used. The main chunk warning is expected (MathJax
  and mermaid are lazy chunks; CodeMirror language-data is large).
- **`frontend/dist` and `target/` are build artifacts** (gitignored). The
  release exe embeds `frontend/dist`; rebuild after frontend changes.
- **`gen/schemas` is Tauri codegen** — never edit by hand.
- **The `rmd` protocol is Windows-specific in origin form**:
  `http://rmd.localhost/…` on Windows (WebView2 custom-scheme workaround),
  `rmd://localhost/…` elsewhere. `preview.js` picks the form from the UA.
- **Math delimiters**: display math must start a line and end a line; inline
  `$…$` is protected outside fenced/inline code. Tokens are random-prefixed
  to avoid collisions. `DISPLAY_MATH_RE` must keep its `g` flag (the
  multi-row matrix regression).
- **Selftest**: dev-only; requires examples/ and network for the remote image
  checks. It restores the user’s notes root afterwards and exits with 0/1.
- **Windows signing** is self-signed (integrity only, SmartScreen still
  warns). **macOS** is ad-hoc (Gatekeeper still asks for approval). See
  `docs/RELEASING.md`.
- Shell here is git-bash on Windows: quote paths with spaces; `ls`/`grep`
  work, PowerShell-style syntax does not.

## Documentation map

- `README.md` / `README.en.md` — user-facing features, downloads, usage (Chinese / English).
- `docs/ARCHITECTURE.md` — data flow, IPC, security model.
- `docs/TESTING.md` — unit/E2E/CI, how to run and debug.
- `docs/RELEASING.md` — versioning, signing, three-platform release.
- `docs/SECURITY.md` — threat model and residual risks.
- `CHANGELOG.md` — history; `AUDIT_REPORT.md` — current audit status.
- `docs/GITHUB_PROJECT_COPY.md` — About description, topics and discoverability copy.
