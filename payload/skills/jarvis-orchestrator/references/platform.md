# Platform binding

Read the `jarvis-platform.json` at this platform installation root (two directories above this skill). Its `assetsHome` is the shared personal asset root: employees/, knowledge/experience/, resources/ and preferences.md. Project `.jarvis` assets take precedence. Use that actual path in CLI commands with `--assets-home`; never create a second personal library just because the client changes. Existing Codex `jarvis/` directories can be selected directly without moving assets. Missing or conflicting roots require an explicit choice. Skills remain installed in each client's native skill directories; third-party plugins, accounts, tools and machine paths do not transfer automatically.

The binding's `instructions` identifies the local common collaboration entry. Cursor user installations activate the skill explicitly with `/jarvis-orchestrator`; a file under the user's .cursor directory does not establish automatic project-rule loading. No project files are written by user installation.

Codex uses native TOML profiles and its own model, reasoning effort, service tier and sandbox settings. Existing user selections and the `terra` compatibility key remain valid. Other clients default to `inherit`, using the client's current model choice; the controller's model remains selected in the client. Explicit subagent models and effort must be available in the installed client version and account. Cursor encodes per-model options as `model-id[effort=high,fast=false]`. Claude Code and WorkBuddy do not receive a fabricated Codex Fast option.

The underscore names in the common routing table are logical profile keys. Codex uses those same names in `agents/*.toml`; WorkBuddy, Claude Code and Cursor use native Markdown/frontmatter profiles with hyphenated names in `agents/*.md`:

| Lane | Logical key / Codex native name | WorkBuddy, Claude Code, Cursor native name |
| --- | --- | --- |
| Micro / Light | `jarvis_luna` | `jarvis-luna` |
| Simple | `jarvis_simple` | `jarvis-simple` |
| Standard | `jarvis_terra` | `jarvis-terra` |
| Complex | `jarvis_sol` | `jarvis-sol` |
| Reviewer | `jarvis_reviewer` | `jarvis-reviewer` |

Dispatch using the actual native name returned by `plan` for the selected platform, not the logical key copied from the common routing table. A compatibility fallback reads that platform's native profile format; only Codex profiles are TOML. Codex fresh installations recommend Astra / High for the controller, while preserving installed user selections. This recommendation does not apply to other clients.

Reviewer controls differ: Codex requests a read-only sandbox; Cursor requests `readonly: true`; Claude Code and WorkBuddy restrict the reviewer to Read, Grep and Glob. Tool restrictions and permissionMode are not a filesystem sandbox. Independently verify the actual runtime controls, including shell, connectors and inherited permissions. When a task requires a guarantee that cannot be demonstrated, block that delegation and report the missing capability. Never replace this check with a prompt asserting read-only operation.

`audit`, `doctor` and `plan` inspect static configuration only. They do not prove native profile discovery, skill loading, exact model/effort/speed, account access, client-version compatibility or successful dispatch. Account policy can cause fallback even when a model ID is configured. Preserve requested settings separately from runtime-verified settings and returned execution IDs. Do not install or upgrade clients automatically.
