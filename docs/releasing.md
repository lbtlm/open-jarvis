# Maintainer release checklist

This document is a maintainer procedure; it does not publish anything automatically.

1. Verify publishing access for the selected `open-jarvis` npm package and the public [lbtlm/open-jarvis repository](https://github.com/lbtlm/open-jarvis). A registry E404 does not guarantee publication rights.
2. Confirm the package license remains MIT or update the package metadata, LICENSE, and documentation together.
3. Run `npm ci --ignore-scripts`, `npm run check`, `npm test`, and `npm run test:package`. Also run `pnpm run test:package:pnpm` with the supported pnpm version. It reuses the same assertions through `pnpm dlx` with a local tarball. The package test packs the release, checks its file allowlist, and executes its CLI using npm exec in a synthetic home. The CI workflow covers Windows, macOS, and Linux with Node 22 and 24 when run; do not claim a platform passed before seeing its result.
4. Test an isolated temporary Codex home with `npx --package ./open-jarvis-0.1.0.tgz open-jarvis audit --home PATH` before `install`. Run `npm run test:runtime -- --codex-bin /path/to/codex` with the actual executable, never a `.cmd` wrapper. The runtime test installs into a temporary home and reads its runtime configuration without a model request. Verify `doctor` and a rollback using the generated manifest. Never use a maintainer's active user home as the release fixture.
5. Inspect the packed file list and ensure it contains only the public executable, source, payload, documentation, license, and required metadata. Check that backups, credentials, session data, and local manifests are absent.
6. Authenticate to npm using the maintainer-controlled account, then run the chosen `npm publish` command. Publishing is an external, irreversible release action and remains a maintainer decision.
7. Create the release record only after the package is available, with the verified npm version and repository URL. State platform coverage precisely: Windows validated locally when it was run; macOS and Linux covered by CI once that CI has passed.

The `npx` commands in the README are public installation commands only after npm publishing. For local package verification, use `npm pack` followed by `npx --package ./open-jarvis-<version>.tgz …`; see the [npm npx documentation](https://docs.npmjs.com/cli/v11/commands/npx).

Repository dependency installation and publication continue to use npm and package-lock.json. pnpm is an optional consumer runner, not a second dependency-management workflow. Do not add pnpm-lock.yaml merely to validate dlx.

## Publication status

Open Jarvis targets the public [lbtlm/open-jarvis repository](https://github.com/lbtlm/open-jarvis). The `open-jarvis` npm package has not been published; use a reviewed local tarball until publication.

Installation manifests retain the internal `codex-jarvis` identity, and portable archives retain `codex-jarvis-assets`, so existing installations and archives remain compatible after the public package and executable rename.
