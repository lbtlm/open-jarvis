# Maintainer release checklist

This document is a maintainer procedure; it does not publish anything automatically.

1. Confirm the final npm package name is available and confirm the GitHub owner/repository URL. Do not invent either value in public documentation.
2. Confirm the package license remains MIT or update the package metadata, LICENSE, and documentation together.
3. Run `npm ci --ignore-scripts`, `npm run check`, `npm test`, and `npm run test:package`. The package test packs the release, checks its file allowlist, and executes its CLI using npm exec in a synthetic home. The CI workflow covers Windows, macOS, and Linux with Node 22 and 24 when run; do not claim a platform passed before seeing its result.
4. Test an isolated temporary Codex home with `node bin/codex-jarvis.mjs audit --home PATH` before `install`. Run `npm run test:runtime -- --codex-bin /path/to/codex` with the actual executable, never a `.cmd` wrapper. The runtime test installs into a temporary home and reads its runtime configuration without a model request. Verify `doctor` and a rollback using the generated manifest. Never use a maintainer's active user home as the release fixture.
5. Inspect the packed file list and ensure it contains only the public executable, source, payload, documentation, license, and required metadata. Check that backups, credentials, session data, and local manifests are absent.
6. Authenticate to npm using the maintainer-controlled account, then run the chosen `npm publish` command. Publishing is an external, irreversible release action and remains a maintainer decision.
7. Create the release record only after the package is available, with the verified npm version and repository URL. State platform coverage precisely: Windows validated locally when it was run; macOS and Linux covered by CI once that CI has passed.

The `npx` commands in the README are public installation commands only after npm publishing. For local package verification, use `npm pack` followed by `npx --package ./codex-jarvis-<version>.tgz …`; see the [npm npx documentation](https://docs.npmjs.com/cli/v11/commands/npx).
