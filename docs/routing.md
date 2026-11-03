# Routing and supervision

The user-selected main controller stays in the current task and coordinates final acceptance. Astra / High is only a fresh-install recommendation. Match employee capability first; difficulty, model, effort and Fast are settings for this assignment. Installed mappings and the user's selected settings are authoritative; routing never auto-enables Fast or raises effort to Ultra. Execution profile keys do not define employee professions.

## Consistent entry and dispatch

Plain requests, invoked skills and user-requested separate tasks use the same [orchestration entrypoint](../payload/skills/jarvis-orchestrator/SKILL.md). Methods do not replace employee selection. An assigned executor follows its contract without creating another controller. Direct work remains local; other lanes select an approved profession and use one visible assignment plus the actual dispatch ID/settings status.

Reassess professional fit, runtime compatibility and execution settings when the objective, deliverable, profession, project or owned scope materially changes. Existing staff are candidates; being created or idle gives no priority. Reusing an approved professional card is separate from reusing its instance: unrelated work in the same profession or a different project gets a fresh finite context. Related work continues only with compatible profession, worktree, skills, permissions and settings. Same-objective supplements, answers and repairs carry only changes unless they expose incompatibility or changed risk. Preserve approved user choices; actual model/permission changes require supported runtime rebinding and verification, never a message claiming to change an old instance.

The current executor reuses already-read skills, rules, cards and retrieval results whose content remains available and applicable with no indication of change. A new objective prompts a fresh fit judgment using that content, not automatic card rereading, card hashes or library discovery; inspect only missing relevant information. Source changes, unavailable content after compaction or uncertain applicability warrant targeted rereading. Do not add per-message checks or a cache ledger. A new executor reads its own required source sections. Shared Markdown experience remains subject to current approval, hash, version and applicability checks near dispatch and never grants authority. Use scoped QMD keyword retrieval for missing information when configured; failures fall back directly to file lookup, and unchanged environment/configuration needs no repeat of a known failure for a new objective.

Subtasks normally use subagents. An explicitly requested separate user task may host the approved employee directly, with its settings bound through the supported task interface; subagent TOMLs do not automatically apply. Count both surfaces toward the controller's three-active-employee ceiling, within effective runtime limits. No new scheduler or mandatory ledger is introduced, and static installation checks are not proof of live compliance.

## Choose a lane

- Keep ordinary Q&A and single-step lookups Direct. Assign code changes, including tiny edits, to a suitable employee unless the user explicitly requests a direct edit. Keep non-code micro-edit acceptance proportionate.
- Use `micro`/`light` for explicit low-risk work. Both select Luna; an executor with a valid micro contract works directly in the authorized workspace without rescanning the global employee library/configuration.
- Use `simple`/`standard` for daily execution with clear contracts, including routine implementation and ordinary reproducible bugs. Both select `jarvis_simple`, whose fresh Codex recommendation is Terra / High; its compatibility name does not restrict it to simple tasks.
- Use `investigation` for uncertain mechanisms, requirement clarification and cross-module design. It selects `jarvis_terra` with Sol / Medium, a normal investigation responsibility rather than a failure-only fallback. At the 10-minute exploration check, report scope/risk growth or lack of progress after a changed hypothesis/check.
- Use `complex` for critical multi-constraint, authorization, isolation or recovery-consistency work. `--risk critical` selects the installed Complex profile before difficulty, whose fresh Codex recommendation is Sol / High; reviewer cards still select Reviewer. Explicit user effort overrides and custom installed mappings remain authoritative and require actual compatible binding. Clear multi-constraint work without critical risk may instead select Standard with an explicit XHigh override.

For non-Direct work, give one compact assignment centered on objective, ownership and acceptance, with the capability match, necessary skills/experience and constraints, and task settings. Existing matching authorization needs no repeated question; the controller records the agent ID and settings verification status. A micro/light contract needs only goal, owned paths and acceptance. One suitable employee normally completes investigation, implementation and verification. Begin authorized work without an empty acknowledgement or another release; report key findings, blockers or scope changes, then submit results, evidence and unresolved items together. Do not require a Luna scan, phase relay, mandatory scoring, separate ledger or routine extra review.

Each implementation reuses suitable code, consolidates related duplication, edits in place, removes superseded logic and adds only what the task needs. Related obsolete code may be cleaned up within the owned scope without a separate cleanup entrypoint. Do not expand into a repository-wide refactor or trade behavior verification for fewer lines. The controller checks reuse evidence, necessary additions and replacement cleanup during acceptance.

### Task-local plan settings (v0.1.5)

`plan --difficulty micro` selects the existing `luna` profile and inherits its installed model, effort and Fast settings. Existing user mappings take priority. After v0.1.5 is published, with an existing matching employee ID, for example:

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis plan --employee atlas-backend --difficulty micro --effort low
```

`--effort LEVEL` explicitly overrides effort only for this plan and validates it against the selected model; it writes no global settings and changes no employee identity. The example's `low` is a user-selected override, not an automatic micro downgrade. A plan is a preview, not dispatch. If the requested effort differs from the installed profile, the controller must use an explicit runtime binding and verify it; native dispatch cannot be claimed to inherit the override automatically. If that binding is unavailable, report the dispatch blocker. These options are included in v0.1.5; its download URL becomes available after publication.

## Supervision and evidence

Soft reassessment defaults are 10 minutes for Light, 20 for Standard/Investigation, and 30 for Complex, and the controller may override them per task. They are prompts to inspect progress, never a time-based success, failure, or watchdog. Run targeted checks for the actual write scope and reuse valid executor evidence first. Read-only repository work or outputs outside it need no repeated whole-repository status or binary diffs. For repository writes, identify relevant existing tracked/untracked changes and verify affected paths; widen only for global-change risk or a user request, preserving and reporting observed out-of-scope or concurrent changes. Reuse applicable evidence with relevant dependencies and environment; avoid duplicate full investigation or test runs. Closeout reports results, relevant evidence and blockers; timing and repair statistics are optional and useful only when diagnosing a concrete delay.

Run parallel work only when it can shorten completion or resolve an independent uncertainty without overlapping writes. Before changing writers, verify the old writer and relevant in-flight tools have stopped writing and preserve partial output. Briefly hand over the objective, completed work, key evidence locations, remaining work and necessary constraints; no full-chat copy or mandatory handoff form is needed. Treat a late result as evidence only. When review is required, a stable snapshot gets one batched review and one targeted recheck. A true remaining blocker still blocks; preferences and old out-of-scope issues do not automatically create rework.

## Independent review

An independently verified read-only reviewer is mandatory for changes affecting authentication, tenant or data isolation, sensitive or financial integrity, migrations or destructive persistence, concurrency/idempotency/critical-recovery consistency, or irreversible external operations. It is also mandatory when concrete evidence conflicts or a critical path remains unverified. Complex work and module names alone do not require review.

Examples and the full task-contract, reassessment, handoff, and acceptance rules are in the installed [orchestration policy](../payload/skills/jarvis-orchestrator/SKILL.md). These practices remain subject to the actual runtime, repository instructions, and user authorization: [subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [config reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Candidate count and concurrency

Candidate recommendations have no fixed count cap. The user chooses actual concurrency, bounded by three simultaneous subagents (including Reviewer, excluding the controller), the effective Codex limit, and available runtime slots. Queue remaining work; do not increase global settings automatically. The installer preserves an existing positive integer `agents.max_concurrent_threads_per_session`; it recommends 3 only when unset. `audit.maxSubagents` reports the Jarvis ceiling before a lower per-task user choice or runtime limit, while `codexMaxSubagents` reports the generated Codex setting.

## GPT-6 execution mapping

| Work | Compatible role key | Fresh-install recommendation |
| --- | --- | --- |
| Micro and clear light work | luna | gpt-6-luna / medium |
| Daily execution: simple and standard | simple | gpt-6.1-terra / high |
| Investigation, clarification and design | terra | gpt-6.1-sol / medium |
| Complex contract or critical behavior | sol | gpt-6.1-sol / high |
| Triggered independent review | reviewer | gpt-6.1-sol / high |

The native `simple` and `terra` keys remain compatible: `simple` is daily execution and `terra` is Investigation. The generic Codex subagent fallback remains Sol / Medium through the `terra` mapping. Professional employee names and skills remain separate. Reassessment may lead to a proposed setting change, subject to user selection and explicit runtime binding; it does not automatically change the model or effort. New defaults do not migrate existing saved choices automatically. Use the wizard or explicit model overrides after checking availability. See [official Codex model guidance](https://learn.chatgpt.com/docs/models); quota savings and task latency are not guaranteed by configuration.

GPT-6.1 Terra is available as an explicit Codex model choice with `low`, `medium`, `high`, `xhigh`, `max`, or `ultra` effort. These choices were checked against the Codex model directory on 2026-11-03. Terra Ultra is described as maximum reasoning with automatic task delegation; it is not a default for Jarvis executors that prohibit recursive delegation. Supporting a model choice does not verify actual runtime model, effort or speed.

For explicit noncritical work needing more checks, `plan --difficulty standard --effort xhigh` previews an override on the actual installed daily profile. It does not create a sixth role or change global settings, and a custom model must not be assumed to be Terra. The local historical replays supported this division of work, but do not prove universal model superiority or GUI capability. Sol remains responsible for Investigation and critical Complex work; controller preferences remain user-selected.

## Domain acceptance and asset retention

Use the same routing across domains. Read [domain examples](../payload/skills/jarvis-orchestrator/references/domains.md) when selecting methods and acceptance; code tests are not a mandatory gate for prose, documents or video. User-invoked skills take priority over conditional card suggestions. Read [asset evolution](../payload/skills/jarvis-orchestrator/references/assets.md) only when retaining or migrating useful material.
