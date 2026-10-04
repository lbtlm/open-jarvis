# Runtime compatibility

## Package runners

npx is the default consumer entrypoint; pnpm dlx is an optional runner for the same `open-jarvis` package and executable. Both require the package's Node.js 22+ runtime and use the same installation target (`--home`, `CODEX_HOME`, then the default Codex home). They do not create separate employee or asset stores.

Packages are distributed through [GitHub Releases](https://github.com/lbtlm/open-jarvis/releases), not the npm registry. After the chosen release exists, use `npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.1/open-jarvis-0.1.1.tgz open-jarvis install`, replacing both version occurrences with the chosen version. The equivalent pnpm prefix is `pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.1/open-jarvis-0.1.1.tgz dlx open-jarvis`.

Before the first release, use a reviewed local tarball: `npx --package ./open-jarvis-0.1.1.tgz open-jarvis install` or `pnpm --package=./open-jarvis-0.1.1.tgz dlx open-jarvis install`. Replace `install` with `doctor`, `employees`, `plan`, `export`, `import` or `rollback` and keep that command's arguments. No global Jarvis installation is required. Package dependencies may still be downloaded from the npm registry; GitHub distribution is not an offline-install guarantee.

The pnpm compatibility target is 10.18.1. The CI matrix runs both package runners on Windows, macOS and Linux with Node 22 and 24; configured CI coverage is not a claim that those jobs have run. Observed results belong in [validation.md](validation.md). Repository dependency management remains npm with package-lock.json; pnpm is not a second build or publishing pipeline. Runner support does not prove Codex model access, live agent dispatch or effective runtime permissions.

## Codex configuration

This package supports modern Codex Desktop and CLI installations that use standalone role configuration. They share one user installation location, but they need not expose the same roles or models at runtime. Treat an installed role TOML as configuration, not proof that a native custom role is registered or that its model is available. Migration from legacy Codex configuration syntax, including `agents.max_threads` and role tables, is intentionally unsupported. This does not prevent an explicitly manifested Python v1 Jarvis installer state from being handed over through repeated `--previous-manifest` options ordered from oldest to newest.

On a runtime that exposes the configured role, use it and verify an actual dispatch. When it does not expose the role, compatibility explicit binding is allowed only when all effective role requirements can be carried over:

1. Read the installed role TOML and include its complete developer instructions, model, effort, `service_tier`, and Fast feature setting in the worker contract.
2. Choose a runtime-supported generic worker, explicitly set the requested model and reasoning effort, and record the logical role, actual worker role, request, and returned agent identity.
3. Use runtime metadata when available. Otherwise say that model identity and settings were requested, not verified.
4. Preserve required runtime controls. Fast runtime overrides (`service_tier` and `features.fast_mode`) must be explicitly passed or independently verified as inherited. Do not silently drop sandbox, approval, MCP, skill, connector, or Fast constraints; block that delegation if a required setting cannot be preserved or verified.

The default execution models are GPT-6 Luna/Medium, GPT-6.1 Sol/Medium (the `terra` compatibility key), GPT-6.1 Sol/High, and reviewer GPT-6.1 Sol/High. A `--models` JSON override may change the controller and role model/effort pairs. Before compatibility dispatch, read the installed role TOML and bind its actual model and effort; logical lane names never authorize a fixed fallback that overwrites that mapping. Confirm customized v2 persistence with `audit` output and the generated manifest.

The reviewer has a stronger condition: its effective read-only sandbox must be independently verified for each runtime. A role file or instruction text cannot enforce read-only operation, and a live parent setting may override a native role's sandbox. Native roles must likewise verify live Fast and sandbox overrides. If a required guarantee cannot be checked, do not delegate that role through a compatibility fallback; report the missing capability to the controller.

Fast is optional and defaults to off. Where the runtime supports it, enabled roles use `service_tier = "fast"` and `features.fast_mode = true`; disabled roles use `service_tier = "default"` without disabling the runtime feature switch. Fast consumes more credits. No availability promise is made for a particular model, feature tier, quota, or token-saving percentage. See the [Codex subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents), [speed documentation](https://learn.chatgpt.com/docs/agent-configuration/speed), and [config reference](https://learn.chatgpt.com/docs/config-file/config-reference) for current runtime configuration.

The optional runtime check, `npm run test:runtime -- --codex-bin /path/to/codex`, invokes the actual Codex executable against a synthetic home configuration and performs no model request. It creates temporary installation files, then reads their runtime configuration. Pass the executable itself, not a `.cmd` wrapper; it validates executable behavior without proving model availability or a live user's effective permissions.
