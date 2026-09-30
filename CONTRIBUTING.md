# Contributing

Please keep changes small, reviewable, and tied to a stated behavior. Do not include personal Codex homes, credentials, backups, session logs, or production configuration in an issue, test fixture, or pull request.

For changes to role routing or compatibility, preserve these contracts:

- The user-selected main controller is the logical controller and final quality gate. Astra / High is the recommendation for a fresh setup; Fast is optional and defaults off.
- A generic-worker compatibility binding must load the installed role TOML instructions and explicitly bind model, effort, `service_tier`, and Fast settings. It must report requested settings separately from runtime-verified settings and block the delegation if Fast inheritance cannot be passed or verified.
- Reviewer work requires independently verified effective read-only sandboxing, including when a native reviewer role is present. Do not treat role text as an access-control mechanism.
- Dedicated employees and skills retain their own authorization and side-effect boundaries.

Run the focused checks for your change. Before proposing a release-related change, run `npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm run test:runtime -- --codex-bin /path/to/codex`, and `npm pack --ignore-scripts --dry-run` where the environment supports them. The runtime test must receive the actual executable rather than a `.cmd` wrapper; it installs into a temporary home and reads its runtime configuration without a model request. Windows validation should be reported separately from macOS/Linux CI coverage.

Contributors do not publish packages, change a user's active global Codex configuration, or claim an npm or GitHub location without maintainer confirmation. See [docs/releasing.md](docs/releasing.md) for the release procedure.

For package-runner changes, also run `npm run test:package` and `pnpm run test:package:pnpm`. Both use the same package smoke assertions and isolated Codex homes. Keep npm/package-lock.json as the repository dependency source of truth; pnpm dlx support does not require a second lockfile.
