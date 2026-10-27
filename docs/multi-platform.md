# Multi-platform installation

Open Jarvis **0.2.0** provides native configuration adapters for **Codex, WorkBuddy, Claude Code and Cursor**, with shared employee and experience assets on one machine. Configuration adaptation and shared-library behavior have automated coverage. Client loading and actual model execution have separate validation limits below.

## Shared workflow, independent clients

Install Jarvis separately in each application. Each application has its own controller, native execution profiles and skill entrypoint. Rule activation follows that application's supported surface, as described below. A task started in one application stays there; Jarvis does not send tasks to another application or combine their active agents.

On one machine, these installations can read the same employee cards and approved experience, knowledge, resources and preferences. The shared asset root contains `employees/`, `knowledge/`, `resources/` and `preferences.md`. It is distinct from the native platform home. A profession remains independent of its task model: choose a capable employee, then bind the execution settings supported by the current client.

Keep model identifiers, effort, Fast and permission controls in each platform's adapter settings. A Codex model identifier or sandbox field is not automatically valid in another application. Sign-in sessions, third-party plugins, MCP account connections and external tools require their own setup and authorization; sharing employee assets does not migrate them.

## Choose the asset root

Jarvis resolves personal assets in this order:

1. Explicit `--assets-home PATH`, then `JARVIS_HOME`.
2. The asset root saved by the selected platform's Jarvis installation.
3. A compatible existing library, or the neutral `~/.jarvis` default for a new library.

The root is the library itself, rather than its parent: use `/absolute/path/to/.codex/jarvis` for an existing Codex library, not `/absolute/path/to/.codex`. Existing Codex assets remain compatible in place. New installations recommend `~/.jarvis`. When existing libraries conflict, resolve the ambiguity explicitly; the installer must not silently create separate stores. Review the resolved asset root in `audit` before installation, especially when an environment variable overrides a saved root.

An explicitly selected nonstandard Codex home retains its legacy `<home>/jarvis` default when no shared root is specified; pass `--assets-home` to choose the neutral library explicitly.

Select the same root for each client to share personal assets. Installing another client does not require moving the old Codex library. Project assets remain explicitly scoped with `--project PATH`; they do not become global through this shared personal root.

## Install 0.2.0

After the 0.2.0 Release is public, use this package runner:

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis --help
```

The examples below use the 0.2.0 release package. A reviewed source checkout can instead use `npm ci --ignore-scripts` and replace the package runner prefix with `node bin/open-jarvis.mjs`.

Use `--platform codex`, `--platform workbuddy`, `--platform claude-code` or `--platform cursor`. Omitting the option retains the Codex default. `--home PATH` selects that platform's native configuration root; it does not select the shared employee library. Codex still honors `CODEX_HOME`. For a disposable rehearsal, provide both an isolated `--home` and an isolated `--assets-home` explicitly.

The following example selects Claude Code and reuses an existing Codex library in place. Replace `/absolute/path/to/.codex/jarvis` with your intended absolute asset root, or use an absolute path to the recommended new `~/.jarvis` library. Review the audit before running install:

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis audit --platform claude-code --assets-home /absolute/path/to/.codex/jarvis
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis install --platform claude-code --assets-home /absolute/path/to/.codex/jarvis --starter none --yes
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis doctor --platform claude-code
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis employees --platform claude-code
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis plan --platform claude-code --employee EMPLOYEE_ID --difficulty standard
```

Replace `EMPLOYEE_ID` with a matching, approved card from the selected library. The `none` starter adds no cards; if the library is empty, approve and save a suitable employee before planning. `plan` previews the selected employee, installed execution profile and settings; it does not dispatch an agent. The installation records its asset root in `<platform-home>/jarvis-platform.json`, together with the platform, instruction entrypoint and static capabilities, so later commands can omit `--assets-home`. An explicit root or `JARVIS_HOME` still overrides that binding.

Repeat this audit/install/doctor/plan sequence for the other clients by replacing `claude-code` with `codex`, `workbuddy` or `cursor` and choosing the same shared root. Each client gets its own native files and installation receipt. If you used a custom `--home`, repeat that same home in subsequent commands.

Save the exact manifest path returned by each installation. To restore that installation, use its platform and manifest:

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis rollback --platform claude-code --manifest /absolute/path/to/installation-manifest.json
```

The same command supports the other three platform names. Use the matching `--home` for a custom installation. The manifest is tied to its original platform and home; selecting another client is not a migration operation. Later edits can cause rollback to refuse restoration. Employee and experience assets are user-owned and are not removed by installer rollback.

For a reviewed local tarball, replace the release URL with the local package path, for example `npx --package ./open-jarvis-0.2.0.tgz open-jarvis`, keeping the suffix and options. Use the tarball from the intended Release and verify its checksum.

## Native adapters and official references

The following are configuration contracts, not claims of successful client execution. Official pages were consulted on 2026-10-27; client versions, account access and team policy can differ.

| Platform | Native home default | Native configuration contract | Official references |
| --- | --- | --- | --- |
| Codex | `~/.codex` | Standalone TOML execution profiles; native skills and collaboration rules | [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [skills](https://learn.chatgpt.com/docs/build-skills) |
| WorkBuddy | `~/.codebuddy` | CodeBuddy agents, rules and skills; project configuration can override user configuration | [WorkBuddy projects](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project), [directory layout](https://www.codebuddy.cn/docs/cli/codebuddy-dir), [subagents](https://www.codebuddy.cn/docs/cli/sub-agents) |
| Claude Code | `~/.claude` | Markdown agents with YAML frontmatter; model, effort, tools and permission mode use Claude's own semantics | [Subagents](https://code.claude.com/docs/en/sub-agents), [skills](https://code.claude.com/docs/en/skills), [memory](https://code.claude.com/docs/en/memory) |
| Cursor | `~/.cursor` | Markdown subagents and skills; project rules or UI-managed User Rules; model, `readonly` and `is_background` use Cursor's own semantics | [Subagents](https://cursor.com/docs/subagents), [skills](https://cursor.com/docs/skills), [rules](https://cursor.com/docs/rules) |

The generated role filenames are `agents/jarvis_sol.toml` (and the other underscore-named profiles) for Codex, and `agents/jarvis-sol.md` (and the other hyphen-named profiles) for the other clients. Their managed skill is `skills/jarvis-orchestrator/`. The instruction entrypoints are `AGENTS.md`, `CODEBUDDY.md`, `CLAUDE.md` and `jarvis-instructions.md`, respectively; the Cursor file is read explicitly by the skill.

WorkBuddy's project guide is the product-specific source for its configuration surface; linked CodeBuddy CLI documents explain the associated directory and agent formats. Those documents alone do not establish that every WorkBuddy build exposes every CLI capability. Project rules, skills or agents may override the installed user-level files; inspect the actual project before diagnosing a missing entrypoint.

Cursor documents automatic project loading for `.cursor/rules/*.mdc` and project `AGENTS.md`; global User Rules are configured in the client's Customize → Rules UI. Do not assume `~/.cursor/rules` or `~/.cursor/AGENTS.md` loads automatically. For the global installation, activate the installed skill explicitly with `/jarvis-orchestrator` in the task. A project rule entrypoint is only available if separately implemented and verified; installing the global skill does not create one.

Jarvis does not translate every platform's model catalog or promise a model is available. Non-Codex profiles default to `inherit`; the controller's active model stays under client control. Explicit model preferences must use identifiers and settings accepted by that platform. For WorkBuddy, Claude Code and Cursor, Jarvis accepts only `inherit` for the controller; select its active model in the client. Their `--fast` and `--controller-effort` options cannot set a controller preference and are rejected. Use `audit` or `install` with `--models /absolute/path/to/platform-models.json` for supported subagent mappings such as `sol` or `reviewer`. Cursor subagent effort/Fast settings belong in that mapping with an explicit model; WorkBuddy and Claude Code Fast mappings are unsupported. No Codex model mapping is automatically applied to another platform. Account or team policy may select a different effective model, including a Cursor fallback. Record the requested and effective values separately.

## Verify the client after installation

Use `audit` for the proposed file changes and `doctor` for static installed-file checks. Configuration generation, a passing fixture test and a successful doctor result do not prove native registration, skill loading, model access, runtime permission enforcement or a completed child-agent call.

Open a fresh task in the selected application and perform a bounded real dispatch. Record the application and version, discovered native role, employee card and asset root, requested model/effort/Fast, returned agent identifier, and effective settings when exposed. When the client does not expose evidence, mark the setting as requested or unverified. A planning preview is not a dispatch.

For Reviewer, distinguish native tool restrictions from a filesystem read-only sandbox. Excluding editing tools does not independently prove that shell commands, connectors or other channels cannot write. A platform's read-only field is a platform capability, not a portable Codex sandbox. Verify the effective controls required by the task; if a required guarantee cannot be preserved or verified, report that delegation as blocked.

## 0.2.0 client validation boundary

Automated adapter/shared-library checks and a scoped independent read-only review passed. The owner chose to skip the remaining live-client validation and proceed with release; skipped checks are not recorded as successful.

| Client | Observed evidence | Unverified boundary |
| --- | --- | --- |
| Codex | Isolated configuration read passed with desktop-bundled `codex-cli 0.164.0-alpha.11.1`, without a model request | Live dispatch, actual model execution and effective Reviewer read-only controls |
| WorkBuddy 5.8.3 | Real installation wrote 14 managed files to the native home; static `doctor` passed; GUI opened | Skill/employee invocation was not completed; further live checks skipped |
| Claude Code 2.1.39 | Real installation wrote 14 managed files; static `doctor` passed; model probe returned `Not logged in`, with zero model calls or charges | Live loading/dispatch and effective model/permissions; further checks skipped |
| Cursor | Configuration adapter and shared-library behavior have automated coverage | Jarvis was not installed in a real Cursor client and no client invocation ran; live checks skipped |

These observations do not establish that all four clients successfully invoked employees or honored every generated field. Record future runtime acceptance per application and version. Release CI and public-package smoke validate the package/install path separately; they do not replace live model or permission evidence.
