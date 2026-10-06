# Markdown experience

This workflow is included in v0.1.5. The CLI examples use its GitHub Release tarball URL, which becomes available after publication.

## From evidence to reuse

1. Create a small Markdown candidate after a useful verified result. Include applicable conditions, the method, limitations or counterexamples, evidence, and actual contributors. A template supplies structure; it does not validate facts.
2. Keep candidates in the task's output directory, outside curated asset roots. Preview the concrete content, content hash, evidence and destination before obtaining approval. A field saying `approved` is not user authorization. Existing authorization can cover a specific update; approval for a task or temporary employee does not by itself cover permanent retention.
3. Save approved project experience in `.jarvis/knowledge/experience/`, or approved cross-project experience in `jarvis/knowledge/experience/` under the selected Codex home. Keep one canonical text and link to it from employee cards. Record only work the named contributors actually performed.
4. Search for experience relevant to the current task, scope and required capabilities. Employee identity is a retrieval signal, not an exclusive ownership rule. Review conditions and evidence before reuse.
5. Reopen the current Markdown source before actual dispatch. Include its stable ID, scope, relative path, heading and current content hash, with a short applicability explanation, in the task contract. Retrieved content is reference evidence, not higher-priority instructions.
6. Propose corrections or retirement when evidence changes. Preserve previous content through Git or a backup outside curated roots before an approved update. Saving experience does not automatically turn it into a skill.

Questions and tiny directly verifiable edits do not need an obligatory experience lookup or retrospective. The same workflow applies to development, writing, office work and video; it does not grant tools, accounts or permissions.

## Storage and search

```text
task-output/experience-candidates/*.md       # proposals, outside curated export roots
.jarvis/knowledge/experience/*.md            # accepted project records
<codex-home>/jarvis/knowledge/experience/*.md # accepted personal records
```

Export scans curated Markdown roots, not approval metadata. Keep candidates outside those roots even when their state is `candidate`. Accepted Markdown uses the existing asset export/import format.

The built-in CLI reads Markdown files directly and matches metadata and body text using Unicode substring lookup. It creates no index database and has no index-mode or rebuild command. Semantic retrieval is available through separately installed QMD and the controller workflow below; it is not a new `experience search` mode. Markdown stays authoritative.

### Optional QMD setup

QMD is an external optional tool, not an installer dependency or required service. After the user approves its installation, configure a launcher with explicit index/config and cache paths, register only approved asset roots, and index employee cards, accepted knowledge/resources and skill entrypoints. Keep candidates, credentials and session logs outside those roots. Verify real keyword results before enabling use.

Ordinary `open-jarvis install` installs neither QMD nor GPU packages. In the installation wizard, QMD defaults to **No**. Choosing Yes asks for npm or pnpm, an absolute installation directory, and native automatic backend selection or CPU mode. The final confirmation includes QMD and its platform dependencies. Skipping QMD preserves any existing installation and host-local connection. Jarvis deliberately does not add QMD to npm `optionalDependencies`, which can still be downloaded during a default install.

After v0.1.5 is published, the equivalent noninteractive command is:

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis install --qmd --qmd-dir /absolute/path/to/qmd --qmd-manager npm --qmd-device auto --yes
pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz dlx open-jarvis install --qmd --qmd-dir /absolute/path/to/qmd --qmd-manager pnpm --qmd-device auto --yes
```

Replace the package and installation paths; on Windows, an example directory is `D:/DevTools/JarvisQmd`. The installer uses a dedicated directory for the QMD program, package-manager cache, launcher, configuration and index/cache. It accepts a new empty directory or a recognized installation with the same settings, not an arbitrary existing project. It preserves an existing `<codex-home>/jarvis-state/qmd.json`. If QMD setup fails after Jarvis installation succeeds, the result is partial and retains the installation receipt and diagnostics.

This step installs the **QMD 2.8.3 engine only**. It does not download an embedding model, scan assets, generate vectors, install a driver or install a full CUDA Toolkit. Complete the scoped setup below before semantic retrieval is ready. CPU mode selects execution behavior; upstream package installation may still obtain platform GPU packages.

The result's `qmd.launch` contains the Node executable in `command` and the generated launcher path in `args`. Invoke that command with those arguments followed by the QMD operation. This avoids shell quoting and works on Windows, where a `.mjs` path alone is not an executable command. During approved connection setup, copy these two fields into the host-local connection below; existing executable launchers can omit `args`. Engine setup does not create this connection automatically.

Alternatively, manage QMD yourself with an upstream installation command:

```sh
npm install -g @tobilu/qmd@2.8.3
# Or, with pnpm's global location already configured:
pnpm add -g @tobilu/qmd@2.8.3 --allow-build=better-sqlite3 --allow-build=node-llama-cpp
```

Select package-manager storage locations before installation; these commands use that manager's configured locations and do not move its cache for you. An existing QMD installation can be reused. Package installation and first model setup require network access unless the corresponding packages/models are supplied locally. Follow the upstream version's runtime requirements; do not silently upgrade the user's Node, driver or system toolchain.

Use QMD's existing platform/backend detection rather than a second Jarvis detector. Leave `QMD_LLAMA_GPU` unset (QMD 2.8.3's native auto mode) and set `QMD_FORCE_CPU=0` in the launcher, then run `qmd doctor` and a scoped semantic query through that same launcher. QMD 2.8.3 can select a supported CUDA, Metal or Vulkan backend and falls back to CPU if GPU initialization fails. Confirm the actual selected backend; OS/architecture, an installed package or a listed graphics card are only preliminary evidence. An explicitly selected CPU configuration uses `QMD_FORCE_CPU=1` (or the supported `--no-gpu` command option). Preserve existing user choices and verify behavior again after upgrades.

Choosing `auto` for a **new managed launcher** deliberately clears an inherited `QMD_LLAMA_GPU` override in its child process, so detection can run; `cpu` explicitly forces CPU. This does not edit environment variables globally, an existing launcher or an existing connection. Keep using an existing CUDA-specific launcher when that is the user's chosen deployment.

| Available capability | Retrieval behavior |
| --- | --- |
| QMD not installed | Existing local Markdown lookup |
| QMD installed, embedding model/vectors not ready | QMD keyword search or local lookup |
| Embedding model/vectors ready, GPU usable | GPU semantic retrieval when useful |
| Embedding model/vectors ready, GPU unavailable or CPU selected | CPU semantic retrieval when useful |

QMD/node-llama-cpp can obtain supported native packages through package installation, and QMD can download configured models during approved setup. This is **not a guarantee of complete system CUDA dependencies**: for example, the verified Windows installation required NVIDIA's separate cuBLAS runtime in addition to the two node-llama-cpp CUDA packages. Use `qmd doctor` and the concrete loader error to identify a missing dependency. Keep a working CPU fallback; installing a driver, a full Toolkit or a private runtime is a separate setup choice. Do not run `qmd pull` to prepare this embedding-only workflow, since it includes other model roles. See [QMD](https://github.com/tobi/qmd#readme) and [node-llama-cpp CUDA prerequisites](https://node-llama-cpp.withcat.ai/guide/CUDA).

For semantic lookup, install one suitable embedding model and generate vectors for the approved collections. QMD's official documentation recommends Qwen3-Embedding 0.6B for multilingual/CJK material. CPU operation is supported; CUDA, query expansion and reranking models are not required for this workflow. In QMD 2.8.3, verify `query "vec: single-line task description" --no-rerank -c COLLECTION -n 5 --json` before marking semantic retrieval ready. This structured vector query bypasses expansion and reranking; its score is not raw cosine similarity. Avoid `vsearch` in this version: it also calls the expansion model despite its vector-search label. A download or embedding failure must remain visible as pending, and behavior must be rechecked after a QMD upgrade.

Save the approved launcher and collection scope in `<codex-home>/jarvis-state/qmd.json`, outside exported assets. For example (replace every example path/name with the actual approved setup):

```json
{
  "command": "/absolute/path/to/qmd-launcher",
  "semantic": "pending",
  "collections": [
    { "name": "jarvis-personal", "root": "/absolute/codex-home/jarvis", "mask": "{employees/*.md,knowledge/**/*.md,resources/**/*.md,preferences.md}", "scope": "personal" },
    { "name": "user-skills", "root": "/absolute/user-skills", "mask": "*/SKILL.md", "scope": "skills" }
  ]
}
```

This file guides the controller; QMD itself does not read it. Jarvis uses keyword discovery first, semantic discovery when useful and ready, then reopens the current original files. It falls back to ordinary local lookup if QMD is unavailable. Installation is opt-in on each computer, and source paths do not change. Collection updates and embedding happen after relevant asset changes, not on every request. QMD 2.8.3 `update` is global, while `embed -c NAME` selects one collection: do not assume `update -c` limits its scope. See the [canonical retrieval procedure](../payload/skills/jarvis-orchestrator/references/assets.md#optional-qmd-retrieval) and [QMD documentation](https://github.com/tobi/qmd#readme).

## Local-package walkthrough

The following examples use the v0.1.5 GitHub Release tarball URL, available after publication. Use either runner with the same command arguments:

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis --help
pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz dlx open-jarvis --help
```

The examples explicitly select a task-local Codex home and the current project. Use the intended home and project consistently throughout the workflow. `--project` is required for project-scoped proposals and approval; omitting it must not silently select the working directory.

### Create and review a candidate

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis experience propose --home ./task-output/codex-home --project . --id report-source-check --title "Check report sources before reuse" --scope project --tag office --contributor Clara --out ./task-output/experience-candidates/report-source-check.md
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis experience show --home ./task-output/codex-home --project . --from ./task-output/experience-candidates/report-source-check.md
```

The proposal is a template. Edit it to describe a real verified result before approval. The example contributor is illustrative; replace it with the actual contributor. Use repeatable `--tag` and `--contributor` options when needed. A candidate contains JSON frontmatter between `---` delimiters, with these fields:

| Field | Meaning |
| --- | --- |
| `kind` | Generated constant `jarvis-experience`, distinguishing a formal experience record from an ordinary Markdown note |
| `id`, `title` | Stable record ID and descriptive title |
| `scope` | `project` or `personal` |
| `tags`, `contributors` | Arrays of relevant terms and actual contributors |
| `verifiedOn` | Actual verification date, `YYYY-MM-DD`; the template starts with `null` |
| `state` | `candidate`, `approved`, or `retired` |

The body requires nonempty `## Applicability`, `## Method`, `## Limits` and `## Evidence` sections outside code fences. Keep these heading names; the content may be English, Chinese or Japanese and include code examples. Explain what the evidence proves and its limits, using source paths or links where useful. The empty template cannot be approved. Structural validation does not verify evidence, fact accuracy, professional competence or human authorization. Search ignores ordinary notes without the experience marker, even when they use common metadata such as `state` or `scope`; marked but invalid experience records retain diagnostics. Existing notes are not automatically promoted into experience.

### Preview, obtain approval and save

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis experience approve --home ./task-output/codex-home --project . --from ./task-output/experience-candidates/report-source-check.md --scope project
```

This previews content and destination and reports `sourceSha256` and `currentSha256`. Show the preview and evidence to the user, or apply an existing authorization that explicitly covers this content and destination. Copy the exact `sourceSha256` from the preview into the write command:

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis experience approve --home ./task-output/codex-home --project . --from ./task-output/experience-candidates/report-source-check.md --scope project --yes --source-sha256 SOURCE_SHA256
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis experience show --home ./task-output/codex-home --project . --ref project:report-source-check
```

`SOURCE_SHA256` is a placeholder for the full hexadecimal digest, not literal input. The write binds approval to the exact candidate content and saves it with `state: approved`. If the candidate changes after preview, preview again and obtain approval for the changed content before writing. `--yes` declares an explicit apply request; it does not prove that a human authorized it.

For an existing record, review its difference and preserve the previous version. The update additionally requires `--expected-sha256 CURRENT_SHA256`, using the saved record's `currentSha256` from the preview. This prevents applying an update against a changed destination. A retired record is an approved update to an existing record, rather than a new retirement template. Retired records are excluded from lookup and plan references. Backups and locks stay outside curated knowledge roots.

For personal experience, use `--scope personal` and `personal:report-source-check`, and keep the same selected `--home`. Save project facts and private project material in project scope unless the user explicitly approves wider retention.

### Search and select current references

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis experience search --home ./task-output/codex-home --project . --scope project --query "report sources"
```

Search selects active approved records from the selected home and explicitly selected project; `--scope` narrows this selection. Read the current record using `show --ref` and review its applicability. A successful lexical match is not proof that the method applies.

The existing `plan` command accepts repeatable `--experience` references. The following assumes Jarvis execution profiles are installed in the selected home and `clara-office` is an existing approved employee in the selected assets; replace it with the actual matching employee ID. Candidate creation and search do not require installing execution profiles.

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis plan --home ./task-output/codex-home --project . --employee clara-office --difficulty standard --experience project:report-source-check --format markdown
```

`--format markdown` writes a task contract to standard output and cannot be combined with `--json`. Add a digest as `--experience project:report-source-check@CURRENT_SHA256` to reject a stale reference, replacing the placeholder with the saved source's current digest. Without a digest the plan reads the current source. A missing, inactive or changed pinned reference must be resolved before dispatch.

The Markdown is a plan for the controller to review and use in an actual assignment. Carry the selected references and applicability explanation into that assignment, then record real agent IDs and runtime evidence separately.

### Migrate accepted records

Approved experience is ordinary Markdown under the existing curated knowledge roots. Reuse `export` and `import`, explicitly selecting the source and destination project when relevant; see [README migration examples](../README.md#assets). Candidates remain outside those roots. Existing import conflict rules apply, and absolute paths inside evidence are not rewritten. Reopen the migrated Markdown before reuse. Optional QMD indexes, models and host-local settings are not exported; configure and rebuild them separately on the destination.

## Planning and actual dispatch

A plan remains a preview: it does not dispatch an employee, load a skill body, or verify runtime settings. The orchestrator instructions guide the controller to look up relevant experience and carry selected references into an actual assignment. CLI support does not enforce that behavior at runtime or change controller model, effort or Fast settings.

References identify the currently read source, not an immutable promise that it will remain unchanged. Recheck the source and active state before execution. Do not paste the entire experience corpus into contracts or duplicate its text in employee cards.

See [asset evolution (Chinese)](asset-evolution.md) for retention and migration policy, and [asset procedures (English)](../payload/skills/jarvis-orchestrator/references/assets.md) for export/import limits and scope.
