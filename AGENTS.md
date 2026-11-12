# AGENTS.md

Rust + [Tauri 2](https://tauri.app) local Markdown + HTML notes app. The Rust
backend is one file (`src/main.rs`); the frontend is frameworkless vanilla JS
bundled by Vite. User-facing docs are Chinese + English (`README.md` / `README.en.md`);
this file is the developer/agent contract.

## Commands

| Task | Command |
| --- | --- |
| All checks (lint, units, repo, fmt/clippy/test, build) | `npm run check` |
| Dev window (real Tauri, hot frontend reload) | `node scripts/launch-dev.mjs` |
| Dev window shortcut (Windows) | `scripts\run-dev.bat` |
| Browser dev (in-memory mock) | `npm run dev` → http://127.0.0.1:5173 |
| Release exe, no installer | `npx tauri build --no-bundle` |
| Linux release binary | `npx tauri build --no-bundle` → `target/release/rustmd` |
| Linux Rust tests | `source "$HOME/.cargo/env" && cargo test` |
| Linux headless release smoke | `scripts/linux-headless-smoke.sh` (isolated Xvfb) |
| Windows release shortcut | `scripts\run-build.bat` |
| Frontend pure unit tests | `npm run test:unit` |
| Rust unit tests | `npm run test:rust` (`cargo test`) |
| E2E self-test (dev, real WebView) | `RUSTMD_SELFTEST_OUT=<fresh temp dir> npm run selftest` |
| Verify the self-test report | `npm run selftest:check` (CI adds `--require-html`) |
| Version/tag preflight | `node scripts/check-version.mjs v1.5.0` |
| Release notes preflight | `node scripts/release-notes.mjs v1.5.0 >/dev/null` |
| Windows sign + portable zip | `powershell -File scripts/sign-win.ps1` then `scripts/build-win-zip.ps1` |
| Regenerate app icons (PNG/ICO/ICNS) | `npm run icons` |

- `cargo`/`rustup` are often not on this shell's PATH. Use
  `node scripts/cargo.mjs …` (it probes `$CARGO`, `~/.cargo/bin/cargo`, PATH)
  or the `scripts\run-*.bat` wrappers.
- The E2E self-test writes artifacts and `report.json` to the system temp
  directory under `rustmd-selftest/`; **clear/override `RUSTMD_SELFTEST_OUT`
  before a release run** so a stale green report cannot be reused. Override
  examples with `RUSTMD_SELFTEST_EXAMPLES`. It exits the app with 0/1; the
  report checker enforces HTML coverage (`--require-html`) and freshness
  (24 h default).
- CI: `.github/workflows/ci.yml` (quality gate + three-platform compile +
  Linux Xvfb E2E); release: `.github/workflows/release.yml` (Windows portable
  zip, Linux deb/AppImage, macOS universal DMG). Details: `docs/RELEASING.md`.
- Linux release binaries link system GTK 3 + WebKitGTK 4.1 (Tauri 2 has no GTK 4
  backend); install/packaging/no-root sysroot notes live in `LINUX_BUILD.md`.
  `scripts/linux-headless-smoke.sh` can smoke-test the release binary on an
  isolated Xvfb display (artifacts in `target/headless-smoke/`).

## Architecture

- `src/main.rs` — everything Rust, in sections:
  - types and path safety (`resolve_in_root`, `strip_extended_prefix`,
    `canonical_root`, symlink/junction checks);
  - front matter split/compose (unknown fields and CRLF are preserved);
  - HTML helpers (`html_to_text`, title/snippet extraction) and HTML-specific
    save/compose (no front matter, BOM/CRLF preserved);
  - `render_html_note` / `html_preview_finish` (hidden Tauri WebView; no
    external browser; segmented full-page capture + Rust PNG stitching);
  - `set_html_preview` (sandboxed native preview iframe, random-token
    `rmdhtml` document served by Rust);
  - note scanning (`list_notes`, `list_folders`), search, metadata;
  - commands (`read/save/create/rename/delete/move`) including atomic writes
    and hash-based external-change detection;
  - `fetch_image_bytes` (SSRF checks + redirect policy), `save_export`
    (native dialog + write in Rust);
  - `print_note_pdf` / `print_html_note`: platform print engines (WebView2
    `PrintToPdfStream`, WKWebView `NSPrintOperation`, WebKitGTK print
    operation) with A4 settings, vector text, page numbers; the macOS/Linux
    path writes a temp PDF, then `stamp_page_numbers` adds the footer;
  - `print_ready_script` + `ready`/`scrollWidth` on `html_preview_finish`
    (print mode readiness for HTML notes);
  - HTML capture result handling must always resolve the waiting renderer,
    including decode/stitch errors; close/cancel on timeout or task failure;
  - the `rmd` custom protocol (`serve_rmd`, `VaultFileCache`, mtime + byte
    budget), `read_local_image`;
  - dev-only self-test commands (`selftest_config/write/finish`);
  - unit tests.
- `frontend/src/api.js` — the **only** Tauri bridge. Detects Tauri via
  `__TAURI_INTERNALS__` and falls back to an in-memory mock. Keep the mock’s
  validation/conflict/search behaviour aligned with Rust.
- `frontend/src/main.js` — UI state and DOM wiring (no framework/state lib).
  Save queue, conflict retry, unsaved guard, folder tree, sorting, note
  selection/search race guards, export menu, wrap persistence, fullscreen
  button + `F11`.
- `frontend/src/i18n.js` — English/Chinese dictionaries, system-language detection,
  `localStorage.rustmd-lang` persistence, `t()` and `data-i18n*` DOM translation.
- `frontend/src/notelist.js` — pure sorting/filtering/folder-tree helpers
  (covered by `node --test`).
- `frontend/src/markdown.js` — pure math protection + code-segment helpers
  (covered by `node --test`).
- `frontend/src/preview.js` — Markdown via marked + DOMPurify + highlight.js
  + Mermaid + MathJax; HTML notes via a sandboxed native iframe (preview) and
  a hidden Tauri WebView capture (export); note-relative CSS/JS/images are inlined and fonts use `rmd`; link interception in both Markdown and HTML previews; timeout
  warning; async preview generation guard; HTML export and local-image
  inlining for the hidden capture.
- `frontend/src/export.js` — off-screen stage, image inlining, html2canvas,
  multi-page jsPDF, `pdfFromPngDataUrl` for WebView-rendered HTML notes, and
  a 0.25–3× adaptive scale for very long Markdown notes. Markdown PDF export
  prefers the WebView's own print pipeline (`exportPdfVector` →
  `print_note_pdf`, `print_html_note`): the browser lays the note out on real
  pages and embeds font subsets, so the PDF is vector text (selectable, sharp,
  small) instead of sliced canvas images. The raster exporter stays as the
  fallback for unsupported platforms and older WebView2 runtimes.
- `frontend/src/editor.js` — CodeMirror 6 setup; Markdown/HTML language is
  swapped per note through a `Compartment`; HTML/JS/CSS highlight rules and
  line-wrap compartment.
- `frontend/src/imgutil.js` — bytes→data URL and magic-byte MIME sniffing.
- `frontend/shims/katex.js` — tiny stub aliased as `katex` in
  `frontend/vite.config.js`; mermaid 12 has an optional KaTeX import, while
  note math uses MathJax. Keep the alias or Vite will bundle the unused package.
- `frontend/src/selftest.js` — dev-only E2E; dynamically imported from
  `main.js` under `import.meta.env.DEV`, never bundled into release builds.
- `frontend/src/style.css` — theme variables via `body[data-theme]`; sidebar,
  markdown, export stage.

### Data model

- Notes root = plain folder. Note paths are root-relative with forward slashes.
  Recognized note extensions: `.md`, `.html`, `.htm` (case-insensitive).
- `kind` is `"markdown"` or `"html"`, derived from the extension (not the
  contents). It is returned in `NoteMeta` and `NoteContent`.
- Markdown front matter is `---` … `---`/`...` at the top. Only `tags` is
  editable in the app; `compose_note` preserves every other line and the file’s
  CRLF/LF style, and rewrites only the `tags:` entry.
- Notes are UTF-8. Non-UTF-8 files stay visible in the list (lossy metadata) but `read_note` returns a clear UTF-8 error; the app does not silently transcode or overwrite them.
- HTML notes have **no** front matter and **no** tags. `compose_html` writes the
  editor body verbatim (LF-normalized), restoring the file’s BOM and CRLF/LF
  style; `tags:` is never injected. `read_note` returns the raw document with
  the BOM stripped and newlines normalized.
- HTML preview uses a **sandboxed iframe** (`allow-scripts allow-forms`; no
  `allow-same-origin`; null origin) served by the `rmdhtml` protocol, so
  scripts/styles/charts and note-relative CSS/JS/images (inlined) run natively
  and quickly; local fonts use `rmd`. Export uses a hidden
  Tauri WebView window; note scripts run there, but every vault command is
  label-guarded and the hidden window may only call `html_preview_finish`
  with the exact `html-render-{token}` label. Tokens are random, not
  PID/counter-derived. No Edge/Chrome is required.
- Tall HTML exports are captured in vertical slices and stitched into one PNG
  in Rust (`png` crate); preview stays a single native iframe.
- `NoteMeta` includes `hash`; `NoteContent` includes `hash`/`mtime`/`kind`. The
  frontend sends `baseHash` on save; a mismatch returns
  `conflict: note changed on disk` and the UI asks before forcing.
- `mtime` is unix seconds (display/sort only); `hash` is the conflict token.

### IPC commands (21)

`list_notes`, `list_folders`, `read_note`, `save_note`, `create_note`,
`rename_note`, `delete_note`, `move_note`, `search_notes`, `save_export`,
`print_note_pdf`, `print_html_note`, `fetch_image_bytes`, `set_notes_root`,
`read_local_image`, `render_html_note`, `html_preview_finish`,
`set_html_preview`, `selftest_config`, `selftest_write`, `selftest_finish`.

`create_note` takes an optional `kind` (`"markdown"` default, `"html"`) and
picks `untitled.md` / `untitled.html`. `rename_note` preserves the note’s
current extension; `unique_sibling` keeps the extension.

`save_export` opens the OS save dialog in Rust and writes the selected bytes;
there is deliberately **no** arbitrary `write_text`/`write_bytes` command.
`selftest_*` are debug-only (release stubs return an error).

`print_note_pdf` prints *the main window's current document* through the
platform print engine — WebView2 `PrintToPdfStream` on Windows, WKWebView's
`NSPrintOperation` on macOS, WebKitGTK's print operation on Linux (resolved at
runtime through `libloading`, so no GTK dev headers are needed to build) — and
returns the PDF bytes (which then go through `save_export` like any other
export). It takes only a header `title` — no output path. `export.js` supplies
the document: the `.export-stage` stays mounted and `body.rmd-printing`
activates the `@media print` rules in `style.css`, which hide the app chrome
and let the note flow across pages.

`print_html_note` does the same for an HTML note, but in a hidden
`html-render-{token}` window (`mode = "print"`, no html2canvas). The window is
created at `HTML_PDF_VIEWPORT_WIDTH` (~669 CSS px, A4 minus the 0.65in side
margins) so the page lays out the way it will print; the injected `print_ready_script`
waits for fonts/charts/images and reports `scrollWidth`, and a fixed-width
page is scaled down (native scale factor / GTK print scale) instead of being
clipped. Both exporters use the same A4 margins.

Windows gets WebView2's header (title + export date) and page-number footer.
macOS/Linux print without browser chrome and then `stamp_page_numbers` appends
a centered "N / M" footer (base-14 Helvetica, wrapped in `q`/`Q` so a
page-wide `cm` cannot move it) — a stamping failure returns the PDF untouched.
On unsupported platforms (and WebView2 runtimes older than 1.0.1518) both
commands return an `unsupported:` error and the frontend falls back to the
html2canvas PDF. macOS uses the `objc2` crates; the print runs through
`runOperationModalForWindow:` with `canSpawnSeparateThread`, so AppKit detaches
a print thread and the UI is not blocked — the command then polls for the
finished PDF (`wait_for_printed_pdf`, 45 s) before stamping. Linux only needs
the `webkit2gtk` wrapper for the raw `GtkWidget` pointer. The macOS code is
compile-checked from Windows with `cargo check --target x86_64-apple-darwin`
in a scratch crate; the Linux C calls are compiled on every host
(`linux_print_webview` is plain `libloading` FFI).

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

1. **Keep note HTML out of the main document.** Markdown-rendered HTML is
   passed through `DOMPurify.sanitize` with a static config (scripts, event
   handlers, `javascript:` URLs, `<style>`, `<iframe>`, forms etc. stripped);
   MathJax/Mermaid run *after* that pass and `sanitizeRenderedDom` removes
   executable attributes/links and external CSS URLs. `.html` previews run in
   a sandboxed iframe with no `allow-same-origin` (null origin, no app
   commands); exports run in a hidden Tauri WebView whose label is rejected by
   every vault command except `html_preview_finish`. The static fallback goes
   through DOMPurify.
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
7. **`rmd` origin allowlist.** No-Origin subresource requests are allowed for
   `<img>/<link>/<script>`; requests with an `Origin` header are accepted only
   from the app webview (Tauri origins or localhost dev server) plus preview
   `font`/`script`/`style` subresources (`Sec-Fetch-Dest`). `fetch`/XHR, document
   reads, remote iframes and all other origins get 403. Do not restore
   `Access-Control-Allow-Origin: *`. Local CSS/JS/images are inlined first so
   this is only a fallback.

## Change recipes

- **Save/load/front matter**: change `split_document`/`compose_note` and the
  `save_note_impl` tests together. Keep unknown fields and CRLF. HTML notes
  use `compose_html` instead: no front matter, no tags, BOM/CRLF preserved.
- **Note formats**: `note_kind()` (Rust) and `noteKindOf()` (JS) must agree on
  `.md` / `.html` / `.htm`. Update `walk`, `read_meta`, `read_note`,
  `save_note_impl`, `create_note`, `rename_note`, the mock in `api.js`, and the
  per-note preview/export `kind` argument together.
- **Search**: `search_notes` searches body, heading, filename and tags. For
  HTML notes the body is visible text (`html_to_text`), not markup. The
  snippet window is 40 chars before the match and query length + 60 after;
  the mock in `api.js` mirrors it.
- **Preview/export**: `renderPreview(source, container, kind)` dispatches to
  Markdown rendering, the sandboxed HTML preview iframe, or the hidden WebView
  capture. `renderMarkdownInto` must sanitize before mounting; the HTML
  preview must stay in the null-origin iframe. Bump `htmlRenderSeq` so a slow
  previous preview cannot append an iframe after a newer note was selected,
  and tear down the native listener via `disposeNativeHtmlPreview` when the
  container is reused. `render_html_note` builds the hidden-window document
  with `html2canvas`; `mode=export` captures at up to 3× (target ~48k device
  px height) and `png` stitches tall segments; PDF mode uses 3× for short
  pages and a 2× cap for taller ones. HTML local images, stylesheets and classic scripts must be inlined
  (`inlineLocalAssetsInHtml`) before preview/export: WebKit sends
  `Origin: null` for CORS subresources and html2canvas uses CORS-mode image
  requests, both of which the strict `rmd` policy rejects.
  `export.js` assumes the Markdown stage is 948 px wide (860 content + 2×44
  padding) and adapts scale down to 0.25× for extremely tall notes.
  Markdown PDF export goes through `exportPdfVector` (`print_note_pdf`):
  keep the `.export-stage` markup print-friendly (the `@media print`
  block in `style.css` owns page hiding, page width and `break-inside`), and
  do not add screen-only transforms/pseudo-elements there — the print engine
  re-lays the note out at A4 width, so page breaks are the browser's, not
  `computePageCuts`'. HTML-note PDFs use `print_html_note`: the hidden window
  is sized to the printable width, `@media print` CSS in the note is honored,
  and `scrollWidth` drives the scale factor; keep `print_ready_script` in sync
  with the capture script's settle timing. `exportPdf` (image slices) remains
  the fallback for unsupported hosts; `pdfFromPngDataUrl` slices pages evenly
  so the last page is not a sliver. Page-number styling for macOS/Linux lives
  in `stamp_page_numbers` (lopdf): it appends a content stream per page and
  must never replace an existing `/Resources/Font` dictionary — it copies it.
  Keep the `RUSTMD_STAMP_PDF`/`RUSTMD_STAMP_OUT` unit test usable for checking
  the stamper against a real export.
  PNG/PDF export rasterizes
  `data:image/svg+xml` `<img>` elements before html2canvas: Chromium interprets
  `drawImage` source rectangles in SVG user units, and html2canvas always
  passes `naturalWidth`/`naturalHeight`, which cropped viewBox-only SVGs. The
  self-test's inline-SVG red/blue check covers this.
- **Editor**: line wrapping is a CodeMirror `Compartment` toggled from
  `#btn-wrap`; the state is persisted as `rustmd-wrap` (`on`/`off`).
  `#btn-fullscreen` / `F11` call `api.setFullscreen` (Tauri window
  `setFullscreen`; browser Fullscreen API); sync the real state on focus.
  HTML highlighting comes from `@codemirror/lang-html`; explicit
  tag/attribute, nested JS (keywords/strings/variables/functions) and nested
  CSS colors live in `editor.js` and `style.css` (`--hl-tag`, `--hl-attr`,
  `--hl-string`, `--hl-keyword`, `--hl-var`, `--hl-func`, `--hl-class`,
  `--hl-punct`).
- **UI strings**: add the key to both `en` and `zh-CN` dictionaries in `i18n.js`,
  use `t()` in JS and `data-i18n*` attributes in HTML. Never hardcode a
  user-visible string in `main.js`.
- **Sidebar**: `notelist.js` owns sorting/tree/filtering; `main.js` only
  renders. Keep counts (`count` = subtree, `direct` = exact folder) in sync.
  Expanded paths are stored in `rustmd-expanded-folders`; an empty set is the
  default, so every folder starts collapsed. Sort state is `rustmd-sort-key` +
  `rustmd-sort-dir` (`mtime` defaults to desc, `name` to asc). `#btn-refresh`
  rescans the vault through `loadNotes` (there is no file watcher): it flushes
  pending saves first, reloads a clean note whose hash changed, closes a clean
  note deleted on disk, keeps unsaved edits, and clears stale folder/tag
  filters.
- **Release**: bump `package.json`, `Cargo.toml`, `tauri.conf.json`,
  `Cargo.lock`, `package-lock.json`; update README version banners; add a
  `CHANGELOG` section **and** `RELEASE_NOTES-<version>.md` (the release
  preflight requires one of them); run `npm run check` + a clean
  `npm run selftest`; commit, tag `v<version>`, and push the commit + tag to
  **both** remotes (`github` and `origin`/GitLab). GitHub tag triggers the
  three-platform release; GitLab is a mirror with no CI.

## Gotchas

- **White window = JS threw during module init.** `#onboarding` and `#main`
  are both `hidden` by default. Reproduce without Rust via `npm run dev`
  (mock mode) and read the browser console; in the app use WebView2 devtools
  (F12 in dev builds).
- **Vite binds IPv4 explicitly** (`127.0.0.1`) and `strictPort: true`;
  `tauri.conf.json` `devUrl` must match. `scripts/launch-dev.mjs` chooses a
  free port and generates a temp config, but a direct `npm run dev` +
  `npx tauri dev` still assumes 5173; a stray process there yields stale
  content or a white window.
- **`tauri dev` runs with `--no-watch`** (wired in `scripts/launch-dev.mjs`).
  The watcher watches the whole project and killed/restarted the app on any
  in-project write. Consequence: restart `scripts\run-dev.bat` after editing
  Rust/`tauri.conf.json`; frontend HMR is unaffected.
- **Vite 8 / rolldown** is used. The main chunk warning is expected (MathJax
  and mermaid are lazy chunks; CodeMirror language-data is large).
- **`frontend/dist` and `target/` are build artifacts** (gitignored). The
  release exe embeds `frontend/dist`; rebuild after frontend changes.
- **`gen/schemas` is Tauri codegen** — never edit by hand. Linux builds also
  generate `gen/schemas/linux-schema.json`, which is gitignored.
- **The `rmd` protocol is Windows-specific in origin form**:
  `http://rmd.localhost/…` on Windows (WebView2 custom-scheme workaround),
  `rmd://localhost/…` elsewhere. `preview.js` picks the form from the UA.
- **Math delimiters**: display math must start a line and end a line; inline
  `$…$` is protected outside fenced/inline code. Tokens are random-prefixed
  to avoid collisions. `DISPLAY_MATH_RE` must keep its `g` flag (the
  multi-row matrix regression).
- **Selftest**: dev-only; requires examples/ and network for the remote image
  checks. HTML entries use the built-in WebView (native preview iframe +
  hidden export window), check `--require-html`, and assert iframe readiness,
  local-JS execution, PNG/PDF magic/dimensions and local CSS/JS/image inlining.
  Markdown and HTML PDF entries assert the vector path really produced text
  (`/Font` in the PDF, not just image slices) on every desktop platform. No
  external browser is installed or required. Clear the output dir first; the
  checker rejects reports older than 24h. It restores the user’s notes root
  afterwards and exits with 0/1.
- **Windows signing** is self-signed (integrity only, SmartScreen still
  warns). **macOS** is ad-hoc (Gatekeeper still asks for approval). See
  `docs/RELEASING.md`.
- **Linux runtime deps**: `libgtk-3.so.0`, `libwebkit2gtk-4.1.so.0`,
  `libsoup-3.0.so.0`; the app is dynamically linked, so build on the oldest
  distro you intend to support. See `LINUX_BUILD.md`.
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
- `LINUX_BUILD.md` — Linux dependency/build/packaging guide and headless smoke test.
