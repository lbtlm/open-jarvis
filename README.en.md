# Codex Jarvis

[中文](README.md) · [MIT](LICENSE)

Codex Jarvis installs an auditable multi-agent workflow for modern Codex Desktop and CLI installations that support standalone role configuration. Astra / High is the recommendation for a fresh controller; the user's selected controller model, effort, and Fast setting govern the workflow. Luna, Terra, and Sol are logical task lanes whose model and effort are also user-selected recommendations.

This is version `0.1.0`. No npm publication or GitHub location is claimed yet. After publication, the public install command will be:

```sh
npx codex-jarvis install
```

Requires Node.js 22+ and a signed-in modern Codex client with standalone agent configuration support. The installation target is selected in order: `--home`, `CODEX_HOME`, then `~/.codex`. Desktop and CLI need one installation when they use the same home.

Before publication, validate a checkout without changing a real global configuration:

```sh
npm ci
node bin/codex-jarvis.mjs audit --home /path/to/codex-home
```

Or pack and validate the local executable through `npx`:

```sh
npm pack
npx --package ./codex-jarvis-0.1.0.tgz codex-jarvis audit --home /path/to/codex-home
```

## CLI

```text
npx codex-jarvis [install|audit|doctor|rollback]
  [--home PATH]
  [--controller-effort EFFORT]
  [--fast on|off]
  [--interactive|--yes]
  [--models FILE]
  [--previous-manifest PATH ...]
  [--manifest PATH]
  [--json]
```

With no arguments, the executable prints help. `audit` and `doctor` are read-only. `install` creates backups and hashes. `rollback` requires `--manifest`. `install` changes the shared user settings in the selected `CODEX_HOME`; use a synthetic home for development and acceptance, while `audit` performs no writes. The installer upgrades only its own v2 state and does not migrate legacy Codex configuration syntax such as `agents.max_threads` or role tables. To take over state left by the Python v1 Jarvis installer, supply every prior state manifest with a repeated `--previous-manifest`, ordered oldest to newest. Run `audit` against an explicit `--home` first. `doctor` performs static installed-file checks only; it does not probe a running Codex instance, model access, or actual role dispatch.

In a terminal, `install` prompts for each role's model, reasoning effort, and Fast choice. `--interactive` forces prompts for piped scripted tests; `--yes` skips them and applies current, explicit JSON, or recommended values. Installation without a TTY and without `--yes` is refused. A preview and final confirmation appear before writes; cancellation writes nothing. Re-running reads existing v2 settings for change instead of resetting them blindly.

`--models` takes a JSON file with optional `controller`, `luna`, `terra`, `sol`, and `reviewer` entries, each shaped as `{ "model": "…", "effort": "…", "fast": false }`. `--fast on|off` is controller-only shorthand; choose Fast for other roles individually in the wizard or JSON. Before dispatch, the orchestration skill reads the installed role TOML model, effort, and Fast settings; compatibility explicit binding uses those effective values instead of replacing them with a logical lane's fixed fallback.

## Workflow and compatibility

Copy the [model mapping example](docs/models.example.json) and keep the roles you want to override, then pass `--models ./my-models.json` to `audit` and `install`. Subsequent installations preserve custom mappings from the active v2 manifest. Existing controller effort is preserved unless explicitly overridden. Model availability and supported efforts remain account/runtime-specific, including Spark.

Luna/Medium, Terra/Medium, Sol/High, and reviewer Sol/High are recommendations, not forced mappings. Fast defaults to off to conserve credits. When supported, Fast uses `service_tier = "fast"` and `features.fast_mode = true`; off sets `service_tier = "default"` without disabling the runtime feature switch. Fast consumes more credits, and its availability remains account/runtime-specific. The independent reviewer requires an effective read-only sandbox. If a native role is unavailable, compatibility explicit binding may use a supported generic worker after loading the role TOML instructions and explicitly setting its model, effort, and Fast settings. Reports must distinguish requested settings from settings verified by the runtime.

Compatibility binding cannot recreate missing security controls. Independently verify the reviewer's effective read-only sandbox even when its native role appears loaded, because live parent settings can override it. Role visibility and model availability can differ between Desktop and CLI runtimes; restart or reopen Codex and verify a real dispatch.

See [routing](docs/routing.md), [compatibility](docs/compatibility.md), and [release guidance](docs/releasing.md). Dedicated employees and skills keep their own permission and side-effect boundaries; do not use a general worker to bypass them.

To perform a runtime compatibility check without a model request, run:

```sh
npm run test:runtime -- --codex-bin /path/to/codex
```

The script installs into a temporary Codex home, then reads its runtime configuration without sending a model request. `--codex-bin` must name the actual executable, not a `.cmd` wrapper.

## References

- [Codex subagents configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [npm npx documentation](https://docs.npmjs.com/cli/v11/commands/npx)
