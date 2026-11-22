# Contributing to rustmd

Thanks for taking a look. rustmd is a small, local-first desktop app: plain files, no
account, no background sync. Changes that keep that promise are the easiest to review.

Before you start, read [`AGENTS.md`](AGENTS.md) — it is the developer contract for the
repository (architecture, commands, security invariants and change recipes). This file
only covers the contribution workflow.

## Ways to help

- **Report bugs** with the issue template; include the version and platform.
- **Ask/answer questions** in [Discussions](https://github.com/riverzhou/rustmd/discussions).
- **Improve docs** — especially the English/Chinese README parity, screenshots and FAQ.
- **Translate** — the UI dictionaries live in `frontend/src/shared/i18n.js`.
- **Test on your platform** — the E2E self-test report is the most useful artifact for
  rendering/export bugs.

## Development setup

Requirements: Node.js `^20.19.0 || >=22.12.0` (see `package.json` `engines`), Rust stable (`rustfmt` +
`clippy`), and the Tauri system dependencies for your platform. Linux notes live in
[`docs/LINUX_BUILD.md`](docs/LINUX_BUILD.md).

```bash
npm install
npm run dev        # browser mock at http://127.0.0.1:5173 (no Rust needed)
npm run check      # the full local gate before a PR
```

For the real desktop window use `node scripts/dev/launch-dev.mjs` (or `scripts\dev\run-dev.bat`
on Windows). For rendering/export work:

```bash
RUSTMD_SELFTEST_OUT=<fresh temp dir> npm run selftest
npm run selftest:check
```

## Pull request checklist

- [ ] The change is focused; unrelated formatting/refactors are in a separate PR.
- [ ] `npm run check` passes locally.
- [ ] Rendering/export changes include a self-test run and its warnings are understood.
- [ ] Security invariants from `AGENTS.md` are preserved (do not relax CSP, path
      containment, the `rmd` origin allowlist, HTML isolation or the SSRF guard).
- [ ] New user-visible strings exist in both `en` and `zh-CN`.
- [ ] License: app changes are offered under GPL-3.0-or-later; changes to
      `crates/rustmd-core` or `frontend/src/shared` are offered under MIT OR Apache-2.0.
- [ ] Docs that describe behavior/commands are updated; version references stay in sync.
- [ ] UI changes come with a screenshot or short GIF.

## Style

- Match the surrounding code; the frontend is frameworkless JS. The Rust backend is a
  Cargo workspace: keep platform-independent logic (paths, encodings, front matter,
  scanning, atomic writes) in `crates/rustmd-core`, and Tauri commands/printing/window
  glue in `src/main.rs`.
- Prefer focused fixes over new abstractions. Add a unit test when the logic is pure
  (`frontend/src/shared/*.test.js`, plus `frontend/src/{layout,pdfgeom,exportgeom,vaultlist}.test.js`;
  Rust tests run with `cargo test --workspace`).
- Commit messages follow the existing history: `fix: …`, `feat: …`, `docs: …`,
  `release: v<version> — …`.
- Do not commit `frontend/dist`, `target/`, or local screenshots that are not
  referenced by the documentation. `gen/schemas/acl-manifests.json`,
  `capabilities.json`, `desktop-schema.json` and `windows-schema.json` are tracked Tauri
  codegen: regenerate them with `npx tauri build`/`dev`, never edit by hand;
  `gen/schemas/linux-schema.json` is generated only on Linux and gitignored.
- Run `npm run check` (lint, units, repo/license/packaging/version checks, fmt, clippy,
  `cargo test --workspace`, Vite build) before pushing.

## Code of conduct

Be respectful and keep discussions on topic. The short version lives in
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Security

Please do not report vulnerabilities in a public issue. See
[`docs/SECURITY.md`](docs/SECURITY.md) and the private reporting flow in
[`.github/SECURITY.md`](.github/SECURITY.md).

## License

rustmd uses a layered license (see [`docs/LICENSING.md`](docs/LICENSING.md)): the
application is **GPL-3.0-or-later**, while the reusable engine
(`crates/rustmd-core`) and renderer (`frontend/src/shared`) are **MIT OR Apache-2.0**
so they can be embedded elsewhere.

By contributing you agree that:

- changes to the application — `src/`, `frontend/src/` outside `shared/`,
  `tauri.conf.json`, packaging, docs — are licensed under **GPL-3.0-or-later**;
- changes to `crates/rustmd-core` or `frontend/src/shared` are offered under
  **MIT OR Apache-2.0**, and you confirm you have the right to submit them under
  those terms. This consent is required before any contributed line can be moved
  from the GPL layer to the permissive layer;
- no GPL-only code is copied into the two reusable directories.

If you do not want a change dual-licensed, say so in the PR; where the design allows
we can keep that change in the GPL layer instead. Either way, every file in the
reusable layers keeps its `SPDX-License-Identifier: MIT OR Apache-2.0` header.
