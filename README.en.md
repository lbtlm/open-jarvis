[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

# Open Jarvis

Open Jarvis provides a controller-supervised workflow for specialist collaboration and reusable assets in Codex Desktop and CLI.
For development, writing, office work, video and other tasks, the controller defines acceptance, selects suitable specialists, supervises execution and accepts the result.
A specialist's profession is separate from the execution model profile. The user's model, reasoning effort and Fast choices take priority.

This is the **0.1.0 preview**. It has not been published to npm. GitHub repository: [lbtlm/open-jarvis](https://github.com/lbtlm/open-jarvis).
The three READMEs describe the same features; the CLI and all reference documents are not yet fully localized.
The project makes no claim of official certification, comparative model pricing, quota benefits or fixed savings.

## Install and get started

Requires Node.js **22+** (including npm/npx) and a signed-in Codex client that supports standalone subagent role configuration.
The installation target is selected in order: `--home`, `CODEX_HOME`, then `~/.codex`.
Desktop and CLI need only one installation when they share a Codex home.

For the current preview, place a reviewed local package in the terminal's current directory and run:

```sh
npx --package ./open-jarvis-0.1.0.tgz open-jarvis install
```

The terminal wizard lets you choose models, reasoning effort and Fast for the controller and execution roles, plus an employee starter.
The starter defaults to `none`: install the collaboration rules first and select specialists as tasks arise.
`--yes` installs noninteractively and preserves existing preferences; a fresh installation recommends Astra / High.
Fast is a separate choice and defaults to off. There is no automatic Ultra setting or switch of the user's controller to Sol.

After publication to npm, this shorter command will be available:

```sh
npx open-jarvis install
```

The examples below use the post-publication command to show the arguments. With the current local package, replace `npx open-jarvis`
with `npx --package ./open-jarvis-0.1.0.tgz open-jarvis` and keep the remaining arguments.
You do not need to clone the source, install Jarvis globally or run a Node script manually.

After installation, open a new Codex task and try a request such as:

> Complete this task using Jarvis. Have the controller define acceptance, select specialists by capability, supervise execution and accept the result; record actual agent IDs and evidence of runtime settings.

A new session helps load configuration but does not guarantee native roles are effective; verify an actual dispatch.
Use `audit` to preview changes before installing and `doctor` for static checks afterward.

## Optional pnpm entrypoint

npx is the default entrypoint. If you already use pnpm, you can run the same package and wizard:

```sh
pnpm --package=./open-jarvis-0.1.0.tgz dlx open-jarvis install
```

After publication to npm, use:

```sh
pnpm dlx open-jarvis install
```

For other examples, replace `npx open-jarvis` with `pnpm dlx open-jarvis`;
for the current local package, use the `--package` prefix above and keep the command and arguments.
Both runners share the same Codex home, employees and assets. You do not need two installations or a second asset store.
pnpm **10.18.1** has been tested locally on Windows. See [compatibility (English)](docs/compatibility.md).

## Common commands

| Command | Purpose | Example (after publication) |
| --- | --- | --- |
| `audit` | Preview installation changes without writing | `npx open-jarvis audit` |
| `install` | Install or upgrade with protected backups | `npx open-jarvis install --starter none` |
| `doctor` | Statically inspect installed files | `npx open-jarvis doctor` |
| `rollback` | Restore one installation using its manifest | `npx open-jarvis rollback --manifest /path/to/manifest.json` |
| `employees` | Search employee cards or preview starter initialization | `npx open-jarvis employees --query writing` |
| `plan` | Preview an employee, skills and execution profile | `npx open-jarvis plan --employee nova-writer --difficulty standard` |
| `export` | Write a new asset archive | `npx open-jarvis export --out ./my-assets.jarvis.json.gz` |
| `import` | Preview an archive before applying it | `npx open-jarvis import --from ./my-assets.jarvis.json.gz` |

`/path/to/manifest.json` is a placeholder; replace it with the actual installation manifest.
`--home PATH` selects the Codex home; `--project PATH` explicitly selects project assets; `--json` returns machine-readable output.
Use `npx open-jarvis --help` for all options, applying the local-package prefix when needed.
`audit` and `doctor` make no live model requests and do not prove an employee has run.

## Controller, specialists and models

The controller handles ordinary questions, single-step lookups and tiny, directly verifiable edits.
For other work, it first checks the required domain, deliverable, language, methods and tools, then prefers reuse among approved specialists whose capabilities match.
Approval, availability and a fixed model do not establish professional competence.
If no specialist matches, the controller proposes a temporary employee with responsibilities, skills and settings, then dispatches after user approval.
It does not force an unrelated employee into the task or rename one to imply expertise.

| Execution profile | Recommended model / effort | Suitable work |
| --- | --- | --- |
| `controller` | GPT-6 Astra / High | Coordination, supervision and final acceptance |
| `luna` | GPT-6 Luna / Medium | Clear, small tasks with low risk |
| `simple` | GPT-6.1 Sol / Low | Simple implementations with known mechanisms |
| `terra` | GPT-6.1 Sol / Medium | Routine tasks and scoped investigation of unknown failures |
| `sol` | GPT-6.1 Sol / High | Contract changes, complex semantics or critical behavior |
| `reviewer` | GPT-6.1 Sol / High | Independent review triggered by risk or evidence |

These are recommendations; existing user choices take priority. `terra` is a compatibility key, not a GPT-6 Terra product.
Fast is selected separately from model and effort. Model access, permissions and service settings require runtime verification.
The default is one executor. At most three subagents run concurrently, including Reviewer and excluding the controller, subject to lower user or global limits.
Executors do not delegate recursively. Independent review is triggered by specified risks or evidence, rather than required for every task.
If necessary model, Fast or Reviewer read-only settings cannot be preserved, report that dispatch as blocked.

## Employees and skills

| Starter | Candidate employees |
| --- | --- |
| `none` | No employee cards added |
| `development` | Iris (frontend), Atlas (backend), Quinn (QA), Sentry (review) |
| `writing` | Nova (writing) |
| `office` | Clara (office work) |
| `video` | Frame (video) |

Starters provide candidate cards; they do not mean employees are hired, skills are loaded or experience is verified.
The older `employees --init --yes` command remains compatible and defaults to adding missing development cards.
For example, preview writing candidates before explicitly writing them:

```sh
npx open-jarvis employees --init --starter writing
npx open-jarvis employees --init --starter writing --yes
npx open-jarvis plan --employee nova-writer --difficulty standard --skill my-writing-skill
```

`my-writing-skill` is a placeholder skill ID. Replace it with an existing skill; a missing skill blocks the plan.
`plan` does not dispatch employees, read skill bodies or prove that skills have loaded.
Follow explicitly requested skills first, then look for suitable installed skills; search externally only when something is still missing.
A card's suggestions are not a whitelist. `--skill` can temporarily bind a skill outside the card without permanently editing it.
Installing Jarvis does not install a whole skill catalog or provide Office, editing, plugin or cloud-account capabilities.
An employee card is a file asset, not a resident process. See [employee conventions (English)](payload/skills/jarvis-orchestrator/references/employees.md).

## Asset evolution and migration

Reusable results follow a small loop: propose a candidate → validate → let the user decide → save or update → reuse later.
Employee experience, skills, knowledge, preferences and templates can be retained; experience requires evidence and applicable conditions.
Approval for a task or temporary hire is not approval for permanent retention. This does not train models or automatically rewrite long-term instructions.
Scores, retrospectives and statistics are not compulsory after every task. See [asset evolution (Chinese)](docs/asset-evolution.md).

Personal assets live under `jarvis/` in the Codex home; project assets live under `.jarvis/`.
Export includes employees, knowledge, preferences, resources, selected skill directories and model preferences.
`jarvis/skills.json` explicitly registers supporting skill dependencies; export does not scan every skill or plugin or infer all dependencies from prose.
Default skill roots are project `.agents/skills`, project `.codex/skills`, home `skills`, then sibling `.agents/skills` beside the home.
Repeated `--skill-root PATH` options completely replace the default export-root list.

```sh
npx open-jarvis export --out ./my-assets.jarvis.json.gz
npx open-jarvis import --from ./my-assets.jarvis.json.gz
npx open-jarvis import --from ./my-assets.jarvis.json.gz --yes
npx open-jarvis install --models /path/to/codex-home/jarvis/models.json --yes
```

For project assets, explicitly pass `--project` on both source export and destination import, using each machine's project path.
Import previews first; `--yes` writes. Identical content is skipped; any differing content stops the entire batch without overwriting or running scripts.
Replace the path in the last command. Review model preferences before explicitly activating them through installation; import alone does not change the controller.
Restore sign-in, plugins, external tools and permissions separately on the destination. Absolute paths inside assets are not rewritten.
Archive limits: **4 MiB** per file, **32 MiB** total content, **16 MiB** compressed and **5000** files.
Move large media such as video separately. Export does not redact file contents; review before sharing. Hashes check integrity, not source authenticity.
See [asset procedures (English)](payload/skills/jarvis-orchestrator/references/assets.md).

## FAQ

**Will it replace my controller?** Existing model, effort and Fast preferences are preserved; a fresh installation recommends Astra / High.
Review a file before explicitly applying `--models`. Professions and execution profiles do not automatically replace the user's controller.

**How do I verify it is active?** Run `audit` / `doctor`, then open a new task and perform an actual dispatch.
Record real agent IDs and runtime settings. A configuration file or new session does not guarantee native registration, hot reload or effective permissions.

**What if no employee fits?** Propose a temporary profession matching the domain, language, deliverable and tools, then execute after approval.
Templates and job titles are not competence evidence. An unrelated backend employee should not be renamed as a language specialist.

**How do updates and rollback work?** Run `audit`, then `install`; use the installation manifest path with `rollback --manifest`.
Installation and rollback manage their own configuration without deleting user employees or assets. Later conflicting edits cause rollback to refuse. Backups may be sensitive; keep them private.

## Contributing and current limits

Maintainers use npm and `package-lock.json`; no pnpm lockfile is added. Relevant development checks are:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:package
pnpm run test:package:pnpm
```

Local Windows checks have verified npm/pnpm installation, migration and rollback. CI is configured for Windows, macOS and Linux on Node 22/24.
A configured matrix is not a passing result on every platform. Independent asset-code review remains incomplete due to network issues; full release-gate completion is not claimed.
Static checks do not prove live model capabilities. See [validation (English)](docs/validation.md) and [release procedure (English)](docs/releasing.md).
Read [CONTRIBUTING (English)](CONTRIBUTING.md) and [SECURITY (English)](SECURITY.md). The license is [MIT](LICENSE).
