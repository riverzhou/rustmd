# Security policy

## Supported versions

Security fixes land on the latest release line. Please test against the newest
[release](https://github.com/riverzhou/rustmd/releases/latest) before reporting.

| Version | Supported |
| --- | --- |
| 1.10.x | ✅ |
| older | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a vulnerability.**

Use GitHub's private reporting flow:

1. Go to the repository's **Security** tab → **Report a vulnerability**
   (<https://github.com/riverzhou/rustmd/security/advisories/new>), or
2. Email `riverzhou2000@163.com` with `rustmd security` in the subject.

Please include the affected version, platform, reproduction steps, and the impact
(can a note read outside the vault? execute code in the app? reach the network?).
A minimal note file or folder is more useful than a screenshot.

## Scope reminders

The threat model and the invariants the project actively enforces are documented in
[docs/SECURITY.md](../docs/SECURITY.md). The most important ones:

- Markdown-rendered HTML is sanitized; HTML notes run in a sandboxed iframe (preview)
  or a label-guarded hidden WebView (export), never in the app document;
- path containment for vault files, image-only local reads, and a strict SSRF policy
  for remote images;
- CSP stays on in release builds; exports write only through the native save dialog.

Reports that require the user to disable CSP, edit `tauri.conf.json`, or run a modified
build are out of scope, but we still want to hear about them if they reveal a design flaw.
