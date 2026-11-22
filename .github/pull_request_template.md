## Summary

Describe the change and the user-visible outcome.

## Type of change

- [ ] Bug fix
- [ ] New feature / behavior change
- [ ] Documentation / screenshots / release copy
- [ ] Refactor / tests / CI (no user-visible change)

## How was it tested?

- [ ] `npm run check` (lint, unit tests, repo/IPC/docs/license/packaging/version checks, fmt, clippy, `cargo test --workspace`, build)
- [ ] `npm run selftest` + `npm run selftest:check` (rendering/export changes)
- [ ] Manual test on Windows
- [ ] Manual test on macOS
- [ ] Manual test on Linux

If a box does not apply, say so and explain what was run instead.

## Notes for reviewers

- Screenshots/GIFs for UI changes (before/after if possible).
- Security-sensitive areas touched (HTML preview/export, path containment, `rmd`
  protocol, CSP, remote images) and why the invariants in `AGENTS.md` still hold.
- New user-visible strings were added to both `en` and `zh-CN` in `frontend/src/shared/i18n.js`.
- Docs/versions updated where needed (`README*`, `CHANGELOG.md`, `RELEASE_NOTES-<version>.md`,
  `docs/*`, `AGENTS.md`).
- License: app changes are GPL-3.0-or-later; changes under `crates/rustmd-core` or
  `frontend/src/shared` are offered under MIT OR Apache-2.0 (see `docs/LICENSING.md`).
