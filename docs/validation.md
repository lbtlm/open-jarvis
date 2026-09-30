# Validation — 0.1.0 candidate

## 2026-09-30: optional pnpm runner

Observed locally on Windows with Node.js 22.14.0 and pnpm 10.18.1. `pnpm run test:package:pnpm` passed against a locally packed tarball in isolated temporary Codex homes: distribution allowlist, audit without writes, installation, doctor, idempotence, optional employee templates and reuse, binary-resource export/import, destination activation, and rollback. It runs the same assertions as the existing npm package smoke check. The initial sandbox attempt failed with `EPERM realpath` on the user directory; the authorized run outside that outer sandbox passed, still using temporary homes and separate caches with lifecycle scripts disabled.

The default `npm run test:package` also passed after the shared-runner change, covering the same installation, migration and rollback assertions. The CI matrix includes the pnpm check on Windows/macOS/Linux with Node 22/24, pinned to pnpm 10.18.1; only the Windows local result above has been observed. No pnpm lockfile or production dependency was added. These checks do not perform model requests, establish live role permissions, complete the outstanding independent asset-code review, or publish a package to npm.

Earlier validation records follow; their dates and counts describe those earlier snapshots.

Checked on 2026-09-22, Windows, Node.js 22.14.0, npm 10.9.2.

## Automated checks

- Syntax checks: passed.
- Node tests: 22 total; 21 passed, one Unix-only permission check skipped on Windows.
- Packed npm executable: passed allowlisted file-content checks and a real `npm exec --package=<local tarball>` run outside the checkout. Audit, installation, doctor, repeated installation and rollback passed against a synthetic home.
- Interactive CLI: complete per-role model/effort/Fast choices reached TOML; declining final confirmation and ending input caused no configuration writes.
- Installer boundaries: preserved unrelated settings, guarded upgrades and rollback, checksummed private backups, serialized install/rollback operations, refused path traversal, role collisions and symlink/junction targets.

## Runtime configuration checks

| Runtime | Version | Verified |
| --- | --- | --- |
| Codex desktop bundled executable | 0.155.0-alpha.9.2 | Isolated app-server configuration read: model, High effort, child defaults, three-agent limit and Fast preference |
| npm Codex CLI | 0.155.1 | Same isolated configuration read; Fast on (`fast`) and off (`default`) |

The runtime check installs into a temporary home, starts the selected executable, calls `config/read`, and stops that process. It does not send a model request or use the maintainer's real user configuration. It proves configuration loading, not actual model entitlement, service speed, billing, native role dispatch, or a reviewer's effective sandbox.

Windows results above were observed locally. A GitHub Actions matrix is included for Windows, macOS and Linux on Node 22 and 24; the other matrix results have not been observed yet. No independent read-only agent review or live model-dispatch acceptance is claimed for this package build.

## Workflow update — 2026-09-23

- Final Node suite: 25 tests, 24 passed, one existing Unix-only permission check skipped on Windows; no failures. Skill frontmatter validation and changed JavaScript syntax checks passed.
- Updated policy, role instructions and routing documentation together. Controller-led scenario inspection covered text-only changes in sensitive modules, scoped unknown bug exploration, tenant/migration changes, noncritical cross-module work, progressing checks at soft budgets, optional review feedback, unresolved data-loss checks, uncertain writer shutdown, unrelated-document edits, and unsupported runtime overrides.
- Package drift and Windows CRLF regression checks passed. A package with different policy text is detected even when the previous receipt is internally consistent; upgrading preserves stored user model/effort/Fast selections.
- Packed `npm exec` lifecycle passed in a synthetic home: audit, install, doctor, repeated installation, and rollback. No package publication took place.
- Isolated configuration reads passed again on desktop bundled Codex 0.155.0-alpha.9.2 and npm Codex CLI 0.155.1. These checks do not prove that an existing task reloads edited rules.
- A native Reviewer test requested read-only settings but its recorded effective sandbox was workspace-write; that delegation was stopped. An explicit CLI Sol/High review recorded read-only sandbox and approval policy `never`, but model requests timed out and the process was stopped. No completed independent review is claimed; a live sandbox mismatch must block that review delegation rather than be hidden by a role label.

## Lightweight employee workflow — 2026-09-23

- Node suite: 28 tests, 27 passed, one Unix-only permission check skipped on Windows. Added checks that both employee references are installed, audited, drift-detected and rolled back while user-retained cards and unrelated skills remain untouched.
- Skill frontmatter validation passed. Controller scenario inspection: tiny edits stay Direct; a new profession needs a concrete hire approval; approved professions do not re-ask within scope; model choices stay separate from permanent cards; missing skills use search/preview before approved installation; unrelated tasks get fresh instances; candidates are not capped at three, while simultaneous workers are capped by user/Codex limits; retention is a separate closeout decision only for useful new material.
- Vercel Skills 1.7.0 help ran on system Node 22.14.0 with an engine warning (not a compatibility pass). A real `skills find react --owner vercel-labs` search passed with the available Node 24.19.0 runtime. Only the optional CLI was cached; no third-party skill, native employee or global Node update was installed.
- No independent read-only review or new native role-dispatch verification is claimed. Employee Markdown cards are dispatch instructions, not native role registrations. This upgrade uses the existing execution profiles and does not add a scheduler or database.
- Packed npm executable passed audit, install, doctor, idempotence and rollback in a synthetic home, including both new employee references. No publication took place.

## GPT-6 employee mapping — 2026-09-24

- Node suite: 31 tests, 30 passed, one Unix-only permission check skipped on Windows. Covered preservation of previously saved GPT-5.6 choices, explicit model-only migration with mixed Fast preferences, rollback, model-dependent wizard options and rejection of unsupported GPT-6 Luna / Ultra before writes.
- JavaScript syntax and skill frontmatter checks passed. Packed npm executable passed distribution checks, audit, install, doctor, repeated installation and rollback in a synthetic home.
- Updated desktop bundled Codex 0.155.0-alpha.16.3 passed an isolated app-server configuration read with Astra / High, GPT-6 Sol / Medium child defaults and a three-subagent limit. This does not verify a model request, native role dispatch, effective reviewer sandbox or hot reload in existing tasks.
- Defaults now recommend GPT-6 Luna / Medium for Light and GPT-6 Sol / Medium for Standard, High for Complex and Reviewer. The `jarvis_terra` role key remains compatible. Availability and supported Codex reasoning settings were checked against current local model metadata and official Codex model guidance. No speed or quota benchmark is claimed.

## Unified development entry — 2026-09-24

- Policy-only update: no installer code, model presets or third-party skills changed. Skill frontmatter validation and packed npm executable checks passed (distribution, audit, install, doctor, repeated installation and rollback in a synthetic home).
- Controller scenario inspection checked: a question/tiny edit stays Direct; an ordinary task selects a profession before delegation; an invoked method skill uses the same routing; an existing in-scope hire does not ask again; a new profession requires approval; an explicitly requested separate task binds its own settings and executes without another controller; an assigned executor does not hire recursively; unsupported required settings block that dispatch without silently substituting Astra; both execution surfaces count toward the controller's active-worker ceiling.
- These are policy/content checks, not live behavioral acceptance. No new employee was hired, no third-party skill was installed, and no currently running repair task was steered. Static checks do not prove that every future task follows the policy or that existing sessions reload it.

## Publication status

This is a local Open Jarvis release candidate targeting the public [lbtlm/open-jarvis repository](https://github.com/lbtlm/open-jarvis). The `open-jarvis` npm package has not been published. `npx open-jarvis install` becomes a public entrypoint only after the maintainer publishes the verified package under that name. Earlier validation records describe their original snapshots.


## 2026-09-30 portable team upgrade

- Full suite: 54 passed, 1 Windows-inapplicable POSIX permission check skipped; the subsequently added CLI migration regression passed separately (55 passing checks total).
- Package smoke: local packed npm executable passed employee initialization, planning, export/import into a second empty home, activation from saved models, idempotence and rollback. No npm publication.
- Codex CLI 0.159.0 isolated app-server config/read passed with Astra/High, GPT-6.1 Sol/Medium default children and max three subagents. This is not a model inference or live-session reload test.
- Atlas implementation and Quinn QA were actually dispatched as bounded subagents with requested GPT-6.1 Sol/High and GPT-6 Luna/Medium. Their model/effort values are requested settings, not independently verified backend identity.
- An independent Sentry CLI review requested GPT-6.1 Sol/High/default speed with read-only sandbox and never approvals. Its runtime header reported those values, but inference requests timed out, including one retry outside the outer network sandbox. The process was stopped. Independent review remains uncompleted; no clean review is claimed.
- Skill Creator quick validation passed for the orchestration skill. Asset tests cover hashes, traversal, case collisions, junctions, conflicts, rollback, idempotence, limits, selected skills and project mappings. Checksums are integrity checks, not provenance signatures.
