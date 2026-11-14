## Summary

Describe the change and the user-visible outcome.

## Type of change

- [ ] Bug fix
- [ ] New feature / behavior change
- [ ] Documentation / screenshots / release copy
- [ ] Refactor / tests / CI (no user-visible change)

## How was it tested?

- [ ] `npm run check` (lint, unit tests, repo/IPC/docs/version checks, fmt, clippy, cargo test, build)
- [ ] `npm run selftest` + `npm run selftest:check` (rendering/export changes)
- [ ] Manual test on Windows
- [ ] Manual test on macOS
- [ ] Manual test on Linux

If a box does not apply, say so and explain what was run instead.

## Notes for reviewers

- Screenshots/GIFs for UI changes (before/after if possible).
- Security-sensitive areas touched (HTML preview/export, path containment, `rmd`
  protocol, CSP, remote images) and why the invariants in `AGENTS.md` still hold.
- New user-visible strings were added to both `en` and `zh-CN` in `frontend/src/i18n.js`.
- Docs/versions updated where needed (`README*`, `CHANGELOG.md`, `RELEASE_NOTES-<version>.md`,
  `docs/*`, `AGENTS.md`).
