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
- **Translate** — the UI dictionaries live in `frontend/src/i18n.js`.
- **Test on your platform** — the E2E self-test report is the most useful artifact for
  rendering/export bugs.

## Development setup

Requirements: Node.js ≥ 20.19, Rust stable (`rustfmt` + `clippy`), and the Tauri system
dependencies for your platform. Linux notes live in [`LINUX_BUILD.md`](LINUX_BUILD.md).

```bash
npm install
npm run dev        # browser mock at http://127.0.0.1:5173 (no Rust needed)
npm run check      # the full local gate before a PR
```

For the real desktop window use `node scripts/launch-dev.mjs` (or `scripts\run-dev.bat`
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
- [ ] Docs that describe behavior/commands are updated; version references stay in sync.
- [ ] UI changes come with a screenshot or short GIF.

## Style

- Match the surrounding code; the frontend is frameworkless JS and the Rust backend is a
  single file with section comments.
- Prefer focused fixes over new abstractions. Add a unit test when the logic is pure
  (see `frontend/src/*.test.js`).
- Commit messages follow the existing history: `fix: …`, `feat: …`, `docs: …`,
  `release: v<version> — …`.
- Do not commit `frontend/dist`, `target/`, generated schemas, or local screenshots that
  are not referenced by the documentation.

## Code of conduct

Be respectful and keep discussions on topic. The short version lives in
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Security

Please do not report vulnerabilities in a public issue. See
[`docs/SECURITY.md`](docs/SECURITY.md) and the private reporting flow in
[`.github/SECURITY.md`](.github/SECURITY.md).

## License

By contributing you agree that your changes are licensed under GPL-3.0-or-later, the
license of this repository.
