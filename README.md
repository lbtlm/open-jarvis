<h1 align="center">Open Jarvis</h1>

<p align="center">Specialist collaboration. Your settings. Reusable results.</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <a href="docs/compatibility.md"><img src="https://img.shields.io/badge/Node.js-22%2B-43853d" alt="Node.js 22+"></a>
  <a href="https://github.com/lbtlm/open-jarvis/actions/workflows/release.yml"><img src="https://github.com/lbtlm/open-jarvis/actions/workflows/release.yml/badge.svg?branch=main" alt="Release pipeline on main"></a>
  <a href="https://github.com/lbtlm/open-jarvis/releases"><img src="https://img.shields.io/badge/download-GitHub_Releases-24292f" alt="GitHub Releases"></a>
</p>

Open Jarvis brings a controller-supervised workflow to **Codex, WorkBuddy, Claude Code and Cursor**. Use it for development, writing, office work and video tasks: define acceptance, choose capable specialists, verify their execution and keep useful results with your approval.

**New in 0.2.0:** install independently in each client and share employee and experience assets on one machine. Each client keeps its own models and permissions. See the [multi-platform guide (English)](docs/multi-platform.md) for platform commands and validation limits; Jarvis does not dispatch tasks between applications.

[Quick start](#quick-start) · [Capabilities](#capabilities) · [Workflow](#workflow) · [Employees & settings](#employees-and-settings) · [Commands](#commands) · [Reusable assets](#assets) · [FAQ](#faq) · [Verification](#verification) · [Contributing](#contributing)

<a id="quick-start"></a>

## Quick start

Requires **Node.js 22+** (npm/npx included) and a client supporting the native configuration described in the [multi-platform guide (English)](docs/multi-platform.md). Live model calls require that client's sign-in and access. The default is Codex; add `--platform workbuddy`, `--platform claude-code` or `--platform cursor` for another client.

Choose a published version from [GitHub Releases](https://github.com/lbtlm/open-jarvis/releases). The commands below use **0.2.0**; its download URL is available once that Release is public. Update the version, URL and filename together. If that artifact is unavailable, use a reviewed local tarball as shown below.

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis install
```

**Codex setup in the terminal wizard:** controller and worker models, reasoning effort, Fast, and an employee starter. The starter defaults to `none`, so you can begin with the collaboration rules and add specialists as needed. Existing preferences take priority; fresh installs recommend Astra / High for the controller. Fast is separate and defaults to off. Ultra and a switch to Sol are never enabled automatically.

<details>
<summary>pnpm alternative and reviewed local packages</summary>

```sh
pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz dlx open-jarvis install
```

For a reviewed tarball in your current directory, use either runner:

```sh
npx --package ./open-jarvis-0.2.0.tgz open-jarvis install
pnpm --package=./open-jarvis-0.2.0.tgz dlx open-jarvis install
```

Both runners use the same selected platform home and shared asset root. The package is distributed through GitHub Releases, **not the npm registry**; dependencies may still come from npm, so installation is not necessarily offline. `--home` selects the native platform home. Codex retains `CODEX_HOME` and `~/.codex` defaults; shared assets use `--assets-home`, `JARVIS_HOME` or the saved binding. See the [root selection rules](docs/multi-platform.md#choose-the-asset-root). `--yes` is noninteractive and preserves existing preferences. pnpm **10.18.1** has been tested locally on Windows; see [compatibility (English)](docs/compatibility.md).

</details>

After installation, open a new task in that client and try (in Cursor, explicitly invoke `/jarvis-orchestrator`):

> Complete this task using Jarvis. Have the controller define acceptance, select specialists by capability, supervise execution and accept the result. Record actual agent IDs and evidence of runtime settings.

Use `audit` to preview installation changes and `doctor` for static checks. A new session helps load configuration; an actual dispatch must still verify roles and runtime settings.

<a id="capabilities"></a>

## Capabilities

- **Work across domains.** Match specialists to the deliverable, language, methods and tools needed for development, writing, office or video work.
- **Make dispatch reviewable.** Keep scope, acceptance, requested settings, real agent IDs and runtime evidence visible.
- **Keep skills task-specific.** Use appropriate methods without permanently tying a profession to a model or skill list.
- **Reuse with approval.** Retain validated employee experience, skills, knowledge, preferences and templates; preview migration before applying it.

<a id="workflow"></a>

## Workflow

```mermaid
flowchart TD
  A["Request"] --> B{"Question, lookup or explicit direct-edit request?"}
  B -->|Yes| C["Controller handles it"]
  B -->|No| D["Match approved specialist"]
  D -->|No match| E["Owner approves new employee"]
  D -->|Match| F["Choose task settings and verify dispatch"]
  E --> F
  F --> G["Worker submits evidence"]
  C --> H["Controller accepts result"]
  G --> H
  H -->|New reusable value| I["Owner decides what to retain"]
```

### Four separate choices

- **Employee:** a reusable professional card describing capability, scope and evidence. It is not a resident service or native-role registration.
- **Skill:** the method for this task. Explicit user requests come first, then suitable installed skills; missing methods may require an external search and separate installation approval.
- **Execution settings:** model, effort and Fast selected for the assignment, with actual runtime verification. Employee identity does not permanently lock them.
- **Retained assets:** validated results saved for later use only with owner approval. Task approval is not permanent-retention approval; there is no background automatic training.

<a id="employees-and-settings"></a>

## Employees and execution settings

The controller handles ordinary questions and single-step lookups directly. Code changes, including tiny edits, go to a suitable employee unless the user explicitly requests a direct edit; the controller coordinates and accepts the result.
Employee capability comes first: check the required domain, deliverable, language, methods and tools, then prefer reuse among approved specialists whose capabilities match. Difficulty, model, effort and Fast are settings for this assignment. Small non-code edits keep proportionate acceptance without extra process.
Approval, availability and a fixed model do not establish professional competence.
If no specialist matches, the controller proposes a temporary employee with responsibilities, skills and settings, then dispatches after user approval.
It does not force an unrelated employee into the task or rename one to imply expertise.

The following are **Codex recommendations**. WorkBuddy, Claude Code and Cursor profiles default to `inherit`; their controller model stays in the client. See [native model settings](docs/multi-platform.md#native-adapters-and-official-references).

| Execution profile | Recommended model / effort | Suitable work |
| --- | --- | --- |
| `controller` | GPT-6 Astra / High | Coordination, supervision and final acceptance |
| `luna` | GPT-6 Luna / Medium | Clear, small tasks with low risk |
| `simple` | GPT-6.1 Sol / Low | Simple implementations with known mechanisms |
| `terra` | GPT-6.1 Sol / Medium | Routine tasks and scoped investigation of unknown failures |
| `sol` | GPT-6.1 Sol / High | Contract changes, complex semantics or critical behavior |
| `reviewer` | GPT-6.1 Sol / High | Independent review triggered by risk or evidence |

These are recommendations; existing user choices take priority. `terra` is a compatibility key, not a GPT-6 Terra product.
Assess difficulty by actual impact and risk: `micro` for tiny changes, `light`/`simple` for small work, `standard` for routine work, and `complex` for major or consequential work. One suitable employee normally completes investigation, implementation and verification; no mandatory Luna scan or read/implement relay is needed. Each implementation reuses suitable code, consolidates related duplication, edits in place, removes superseded logic and adds only what is needed. Related obsolete code may be cleaned up within scope; behavior checks take priority over line-count reductions.
Fast is selected separately from model and effort. Model access, permissions and service settings require runtime verification.
The default is one executor. At most three subagents run concurrently, including Reviewer and excluding the controller, subject to lower user or global limits.
Executors do not delegate recursively. Independent review is triggered by specified risks or evidence, rather than required for every task.
If necessary model, Fast or Reviewer read-only settings cannot be preserved, report that dispatch as blocked.

**Plan options:** `plan --employee atlas-backend --difficulty micro` selects the existing `luna` profile and inherits its installed settings. An explicit `--effort low` is an example of a task-only override, validated against the selected model; micro does not automatically lower effort. This does not change global settings or employee identity. When effort differs from the installed profile, the controller must bind it explicitly at runtime; a preview does not prove native-role settings changed. Replace `atlas-backend` with an existing matching employee ID. See [routing (English)](docs/routing.md).

<details>
<summary>Starter cards and skill planning</summary>

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
npx --package ./open-jarvis-0.2.0.tgz open-jarvis employees --init --starter writing
npx --package ./open-jarvis-0.2.0.tgz open-jarvis employees --init --starter writing --yes
npx --package ./open-jarvis-0.2.0.tgz open-jarvis plan --employee nova-writer --difficulty standard --skill my-writing-skill
```

`my-writing-skill` is a placeholder skill ID. Replace it with an existing skill; a missing skill blocks the plan.
`plan` does not dispatch employees, read skill bodies or prove that skills have loaded.
Follow explicitly requested skills first, then look for suitable installed skills; search externally only when something is still missing.
A card's suggestions are not a whitelist. `--skill` can temporarily bind a skill outside the card without permanently editing it.
Installing Jarvis does not install a whole skill catalog or provide Office, editing, plugin or cloud-account capabilities.
An employee card is a file asset, not a resident process. See [employee conventions (English)](payload/skills/jarvis-orchestrator/references/employees.md).

</details>

<a id="commands"></a>

## Common commands

The entries below are **command suffixes**, not standalone shell commands. Append one to the full runner prefix:

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis
```

For every suffix, you can instead use `pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz dlx open-jarvis` as the prefix. With a reviewed local package, use `npx --package ./open-jarvis-0.2.0.tgz open-jarvis` or `pnpm --package=./open-jarvis-0.2.0.tgz dlx open-jarvis` and keep the suffix unchanged.

| Command suffix | Purpose |
| --- | --- |
| `audit` | Preview installation changes without writing |
| `install --starter none` | Install or upgrade with protected backups |
| `doctor` | Statically inspect installed files |
| `rollback --manifest /path/to/manifest.json` | Restore one installation using its manifest |
| `employees --query writing` | Search employee cards or preview starter initialization |
| `plan --employee nova-writer --difficulty standard` | Preview an employee, skills and execution profile |
| `export --out ./my-assets.jarvis.json.gz` | Write a new asset archive |
| `import --from ./my-assets.jarvis.json.gz` | Preview an archive before applying it |

For example, run the static check with:

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis doctor
```

`/path/to/manifest.json` is a placeholder; replace it with the actual installation manifest.
`--platform codex|workbuddy|claude-code|cursor` selects the adapter; `--home PATH` selects its native home; `--assets-home PATH` selects the shared personal library; `--project PATH` explicitly selects project assets; `--json` returns machine-readable output.
Use `npx --package ./open-jarvis-0.2.0.tgz open-jarvis --help` for all options.
`audit` and `doctor` make no live model requests and do not prove an employee has run.

<a id="assets"></a>

## Reusable assets

Reusable results follow a small loop: propose a candidate → validate → let the user decide → save or update → reuse later.
Employee experience, skills, knowledge, preferences and templates can be retained; experience requires evidence and applicable conditions.
Approval for a task or temporary hire is not approval for permanent retention. This does not train models or automatically rewrite long-term instructions.
Scores, retrospectives and statistics are not compulsory after every task. See [asset evolution (Chinese)](docs/asset-evolution.md).

**Markdown experience:** the Markdown experience workflow keeps task-local candidates separate from approved `knowledge/experience/` records, previews the exact content before saving, and selects current source references for plans. It supports personal and project scope with basic Unicode lookup. Optional, separately installed QMD enables scoped employee, skill and experience discovery, with embedding-only semantic retrieval and a direct-file fallback. Employee cards link to canonical experience rather than copying its text. See [Markdown experience (English)](docs/experience.md) for the workflow and examples.

**Optional QMD installation:** default `install` does not download QMD and preserves existing QMD environments and connections. The interactive wizard offers QMD installation with npm or pnpm, an installation directory and `auto` or `cpu` device selection; it invokes the package manager only after final confirmation. Use this noninteractive command for Codex:

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis install --qmd --qmd-dir /absolute/path/to/qmd --qmd-manager npm --qmd-device auto --yes
```

Replace the package and absolute directory paths; `--qmd-manager pnpm` is also supported. This installs the engine and platform native packages. It does not download models, build indexes, install drivers or install the full CUDA Toolkit. Semantic retrieval needs models and an index of approved assets. GPU detection and CPU fallback follow QMD; installed packages do not prove CUDA works, and Windows may need an optional cuBLAS runtime. A QMD failure is reported as partial installation while Jarvis may remain installed. See [QMD details (English)](docs/experience.md).

<details>
<summary>Migration commands, paths and limits</summary>

Personal assets use the selected shared root (new default `~/.jarvis`); existing Codex `<home>/jarvis` remains compatible in place. Project assets live under `.jarvis/`. Select the same `--assets-home` for each client.
Export includes employees, knowledge, preferences, resources, selected skill directories and model preferences.
`<assets-home>/skills.json` explicitly registers supporting skill dependencies; export does not scan every skill or plugin or infer all dependencies from prose.
Skill lookup uses the selected platform's project skills, project `.agents/skills`, native home `skills` and user `.agents/skills`; Codex also retains its `.codex/skills` path.
Repeated `--skill-root PATH` options completely replace the default export-root list.

```sh
npx --package ./open-jarvis-0.2.0.tgz open-jarvis export --out ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.2.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.2.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz --yes
npx --package ./open-jarvis-0.2.0.tgz open-jarvis install --models /absolute/path/to/shared-assets/models.json --yes
```

For project assets, explicitly pass `--project` on both source export and destination import, using each machine's project path.
Import previews first; `--yes` writes. Identical content is skipped; any differing content stops the entire batch without overwriting or running scripts.
Replace the path in the last Codex example. Import writes portable assets to the selected library; non-Codex source model preferences use `models.<source-platform>.json`, while Codex uses `models.json`. Review them before explicitly installing for the target platform; import does not activate them or change a controller.
Restore sign-in, plugins, external tools and permissions separately on the destination. Absolute paths inside assets are not rewritten.
Archive limits: **4 MiB** per file, **32 MiB** total content, **16 MiB** compressed and **5000** files.
Move large media such as video separately. Export does not redact file contents; review before sharing. Hashes check integrity, not source authenticity.
See [asset procedures (English)](payload/skills/jarvis-orchestrator/references/assets.md).

</details>

<a id="faq"></a>

## FAQ

**Will it replace my controller?** Existing model, effort and Fast preferences are preserved; a fresh Codex installation recommends Astra / High. Other clients keep their controller selection in the client.
Review a file before explicitly applying `--models`. Professions and execution profiles do not automatically replace the user's controller.

**How do I verify it is active?** Run `audit` / `doctor`, then open a new task and perform an actual dispatch.
Record real agent IDs and runtime settings. A configuration file or new session does not guarantee native registration, hot reload or effective permissions.

**What if no employee fits?** Propose a temporary profession matching the domain, language, deliverable and tools, then execute after approval.
Templates and job titles are not competence evidence. An unrelated backend employee should not be renamed as a language specialist.

**How do updates and rollback work?** Run `audit`, then `install`; use the installation manifest path with `rollback --manifest`.
Installation and rollback manage their own configuration without deleting user employees or assets. Later conflicting edits cause rollback to refuse. Backups may be sensitive; keep them private.

<a id="verification"></a>

## Verification and current limits

The 0.2.0 adapter/shared-library checks and scoped independent read-only review passed. Codex passed an isolated configuration-read check. WorkBuddy 5.8.3 and Claude Code 2.1.39 were installed into their real native homes and passed static `doctor`; WorkBuddy employee invocation was not completed, and the Claude probe returned `Not logged in` with no model call or charge. Cursor was not installed or invoked. The owner chose to skip the remaining live-client checks and proceed with release; this does not establish successful employee calls across all clients.

See the [client validation matrix (English)](docs/multi-platform.md#020-client-validation-boundary). The [Release workflow](https://github.com/lbtlm/open-jarvis/actions/workflows/release.yml) records CI and public-package installation results separately. Static checks, package smoke and scoped review do not prove actual model execution, effective runtime permissions or a full security audit.

These three full READMEs describe the same features. The CLI and detailed reference documents remain mostly untranslated; linked documents are labeled by language. See [validation (English)](docs/validation.md) and [release procedures (English)](docs/releasing.md).

<a id="contributing"></a>

## Contributing and releases

Develop features on branches and merge them into `dev` through PRs. For a release, open a `dev` → `main` release PR.
Merging into `main` authorizes automatic CI/CD: once workflow checks pass, it creates the version tag and GitHub Release package without a second publication approval.
A failed workflow may leave a public Release awaiting installation verification. Check the run summary and Release artifacts separately.
GitHub Releases host the package, but installation dependencies may still come from a registry; fully offline installation is not guaranteed.
See [release procedures (English)](docs/releasing.md) and [upgrades (English)](docs/upgrading.md) for version selection, updating and rollback.

<details>
<summary>Contributor checks</summary>

Maintainers use npm and `package-lock.json`; no pnpm lockfile is added. Relevant development checks are:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:package
pnpm run test:package:pnpm
```

</details>

Read [CONTRIBUTING (English)](CONTRIBUTING.md) and [SECURITY (English)](SECURITY.md). The license is [MIT](LICENSE).

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)
