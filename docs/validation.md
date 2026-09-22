# Validation — 0.1.0 candidate

Checked on 2026-09-22, Windows, Node.js 22.14.0, npm 10.9.2.

## Automated checks

- Syntax checks: passed.
- Node tests: 22 total; 21 passed, one Unix-only permission check skipped on Windows.
- Packed npm executable: passed allowlisted file-content checks and a real `npm exec --package=<local tarball>` run outside the checkout. Audit, installation, doctor, repeated installation and rollback passed against a synthetic home.
- Interactive CLI: complete per-role model/effort/Fast choices reached TOML; declining final confirmation and ending input caused no configuration writes.
- Installer boundaries: preserved unrelated settings, guarded upgrades and rollback, checksummed private backups, serialized install/rollback operations, refused path traversal, role collisions and symlink/junction targets.

## Runtime configuration checks

| Runtime | Version | Verified |
| --- | --- | --- |
| Codex desktop bundled executable | 0.155.0-alpha.9.2 | Isolated app-server configuration read: model, High effort, child defaults, three-agent limit and Fast preference |
| npm Codex CLI | 0.155.1 | Same isolated configuration read; Fast on (`fast`) and off (`default`) |

The runtime check installs into a temporary home, starts the selected executable, calls `config/read`, and stops that process. It does not send a model request or use the maintainer's real user configuration. It proves configuration loading, not actual model entitlement, service speed, billing, native role dispatch, or a reviewer's effective sandbox.

Windows results above were observed locally. A GitHub Actions matrix is included for Windows, macOS and Linux on Node 22 and 24; the other matrix results have not been observed yet. No independent read-only agent review or live model-dispatch acceptance is claimed for this package build.

## Publication status

This is a local release candidate. npm publication and GitHub hosting have not been performed. `npx codex-jarvis install` becomes a public entrypoint only after the maintainer publishes the verified package under that name.
