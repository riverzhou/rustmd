# AGENTS.md

Rust + [Tauri 2](https://tauri.app) local Markdown notes app (Windows). Backend is a
single file, frontend is frameworkless vanilla JS bundled by Vite 6.

## Commands

| Task | Command |
| --- | --- |
| Dev (frontend hot reload) | `scripts\run-dev.bat` (= `npx tauri dev --no-watch`) |
| Release exe (no installer) | `scripts\run-build.bat` (= `npx tauri build --no-bundle`) |
| Rust unit tests | `C:\Users\River\.cargo\bin\cargo.exe test` |
| Frontend only (browser + mock data) | `npm run dev` → http://localhost:5173 |
| E2E self-test (render + export `examples\`) | `RUSTMD_SELFTEST=1 scripts\run-dev.bat` |
| Regenerate app icons | `npm run icons` (uses `scripts/gen-icons.mjs`) |

E2E self-test (dev builds only, `import.meta.env.DEV`): the dev window renders
every note in `examples\` through the real pipeline, exports PNG + PDF for each,
and verifies residual raw math, remote AND local (vault) images in the exported
PNG (2D NCC — the local-image regression guard is
`examples\markdown_render_test.md` §4), and multi-line math geometry. Artifacts + `report.json` land in
`%LOCALAPPDATA%\Temp\opencode\rustmd-selftest`; `report.ok === false` means
failures. `examples\` doubles as the regression vault (the math-formula guide
guards the `$$` display-math protection — see `DISPLAY_MATH_RE` in
`frontend/src/preview.js`). The self-test code lives in `frontend/src/selftest.js`
(dynamic import from `main.js`; release builds never bundle it).
The `RUSTMD_SELFTEST=1 scripts\run-dev.bat` syntax is bash — it works in this
git-bash shell; in cmd/PowerShell use
`set RUSTMD_SELFTEST=1 && scripts\run-dev.bat` / `$env:RUSTMD_SELFTEST=1`.

- `cargo`/`rustup` are **not on this shell's PATH** — always use the `scripts\run-*.bat`
  wrappers or the absolute path `C:\Users\River\.cargo\bin\cargo.exe`.
- Test note vault for manual runs: `C:\Users\River\AppData\Local\Temp\rustmd-test-notes`.

## Architecture

- `src/main.rs` — everything Rust: `#[tauri::command]` handlers, front matter
  parsing, note scanning, path-escape guard, the `rmd` image protocol (serves
  vault images to the webview, containment-checked against the open notes root
  set via `set_notes_root`), and the unit tests. No other Rust modules.
  Local image `src`s are rewritten to `rmd` URLs by `frontend/src/preview.js`
  (`http://rmd.localhost/…` on Windows — the WebView2 custom-scheme workaround
  form —, `rmd://localhost/…` elsewhere); PNG/PDF/HTML export inlines them as
  data: URLs via `read_local_image`.
- `frontend/src/api.js` — the **only** Tauri bridge. It detects Tauri via
  `__TAURI_INTERNALS__` and falls back to an in-memory mock for browser dev.
- `frontend/src/main.js` — all UI state and DOM wiring (no framework, no state lib).
  `editor.js` (CodeMirror 6), `preview.js` (marked + highlight.js), `style.css`
  (theme variables via `body[data-theme]`).
- `frontend/src/selftest.js` — the dev-only E2E self-test, dynamically imported
  from `main.js` under `import.meta.env.DEV` (never bundled into release builds).
  Keep it out of `main.js`: the entry module must stay UI-only.
- Notes root = plain folder of `.md` files; tags live in front matter
  (`tags: a, b`), re-rendered on every save. Note paths are root-relative with
  forward slashes.

### Adding a Tauri command (3 touch points)

1. `#[tauri::command]` fn in `src/main.rs`
2. register it in `tauri::generate_handler![...]` in `main()`
3. wrapper in `frontend/src/api.js` (keep a mock branch for browser mode)

If a new Tauri *plugin* or capability is used, permissions must be added to
`capabilities/default.json` or the invoke fails at runtime.

## Gotchas

- **White window = JS threw during module init.** `#onboarding` and `#main` are
  both `hidden` by default; if `main.js` throws before `initEditor()`/the final
  init block, nothing ever shows (happened twice: undefined `@lezer/highlight`
  tags, and double-wrapping `EditorView.theme()`). Reproduce/debug without Rust:
  `npm run dev` + any browser (mock mode) — console errors are identical. In the
  app, open WebView2 devtools (F12 in dev builds).
- **Dev server binding**: Vite must bind IPv4 (`host: '127.0.0.1'` in
  `frontend/vite.config.js`, matching `devUrl` in `tauri.conf.json`); Vite 6 can
  silently bind IPv6-only and WebView2 fails to connect. `strictPort: true` — a
  stray node/vite holding port 5173 makes `tauri dev` serve stale content or a
  white window.
- **`tauri dev` runs with `--no-watch`** (wired in
  `scripts/launch-dev.mjs`). The Tauri dev watcher has no exclude option and
  watches the whole project dir, so any in-project write (a note saved into
  the examples vault, an export into the repo, `npm run build`) killed and
  restarted the app — users experienced it as a crash. Consequence: Rust
  code or `tauri.conf.json` edits are NOT picked up automatically — restart
  `scripts\run-dev.bat` after editing Rust. Frontend (vite) HMR is unaffected.
- `gen/schemas` is Tauri codegen output — never edit by hand.
- `frontend/dist` and `target/` are build artifacts (gitignored); the release
  exe embeds `frontend/dist` at build time, so rebuild the exe after frontend
  changes if testing the built binary.
- `resolve_in_root` in `main.rs` rejects any path escaping the notes root; it has
  tests. Don't relax it.
- **Known security gap (tracked in `AUDIT_REPORT.md`)**: note HTML is rendered
  by `marked` **without sanitization** into the privileged webview (`csp: null`),
  and `write_text`/`write_bytes`/`fetch_image_bytes` are unscoped commands —
  a malicious `.md` in the vault can execute arbitrary JS with full IPC.
  Until a sanitizer is added, treat untrusted folders as unsafe.
- Shell here is git-bash on Windows: quote paths with spaces; `ls`/`grep` work,
  but PowerShell-style syntax does not.
