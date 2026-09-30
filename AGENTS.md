# AGENTS.md

Rust + [Tauri 2](https://tauri.app) local Markdown notes app (Windows). Backend is a
single file, frontend is frameworkless vanilla JS bundled by Vite 6.

## Commands

| Task | Command |
| --- | --- |
| Dev (hot reload) | `scripts\run-dev.bat` (= `npx tauri dev`) |
| Release exe (no installer) | `scripts\run-build.bat` (= `npx tauri build --no-bundle`) |
| Rust unit tests | `C:\Users\River\.cargo\bin\cargo.exe test` |
| Frontend only (browser + mock data) | `npm run dev` → http://localhost:5173 |
| Regenerate app icons | `npm run icons` (uses `scripts/gen-icons.mjs`) |

- `cargo`/`rustup` are **not on this shell's PATH** — always use the `scripts\run-*.bat`
  wrappers or the absolute path `C:\Users\River\.cargo\bin\cargo.exe`.
- Test note vault for manual runs: `C:\Users\River\AppData\Local\Temp\rustmd-test-notes`.

## Architecture

- `src/main.rs` — everything Rust: `#[tauri::command]` handlers, front matter
  parsing, note scanning, path-escape guard, and the unit tests. No other Rust modules.
- `frontend/src/api.js` — the **only** Tauri bridge. It detects Tauri via
  `__TAURI_INTERNALS__` and falls back to an in-memory mock for browser dev.
- `frontend/src/main.js` — all UI state and DOM wiring (no framework, no state lib).
  `editor.js` (CodeMirror 6), `preview.js` (marked + highlight.js), `style.css`
  (theme variables via `body[data-theme]`).
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
- **Any write inside the project dir while `tauri dev` runs → app restart.**
  The dev watcher watches the whole project (no exclude option). E.g. running
  `npm run build` (writes `frontend/dist`) mid-session kills and restarts the
  app — looks like a crash to the user. Do frontend builds before starting
  `tauri dev`, or accept the one restart.
- `gen/schemas` is Tauri codegen output — never edit by hand.
- `frontend/dist` and `target/` are build artifacts (gitignored); the release
  exe embeds `frontend/dist` at build time, so rebuild the exe after frontend
  changes if testing the built binary.
- `resolve_in_root` in `main.rs` rejects any path escaping the notes root; it has
  tests. Don't relax it.
- Shell here is git-bash on Windows: quote paths with spaces; `ls`/`grep` work,
  but PowerShell-style syntax does not.
