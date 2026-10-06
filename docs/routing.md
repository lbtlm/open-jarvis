# Routing and supervision

The user-selected main controller stays in the current task and coordinates final acceptance. Astra / High is only a fresh-install recommendation. Match employee capability first; difficulty, model, effort and Fast are settings for this assignment. Installed mappings and the user's selected settings are authoritative; routing never auto-enables Fast or raises effort to Ultra. Execution profile keys do not define employee professions.

## Consistent entry and dispatch

Plain requests, invoked skills and user-requested separate tasks use the same [orchestration entrypoint](../payload/skills/jarvis-orchestrator/SKILL.md). Methods do not replace employee selection. An assigned executor follows its contract without creating another controller. Direct work remains local; other lanes select an approved profession and use one visible assignment plus the actual dispatch ID/settings status.

Subtasks normally use subagents. An explicitly requested separate user task may host the approved employee directly, with its settings bound through the supported task interface; subagent TOMLs do not automatically apply. Count both surfaces toward the controller's three-active-employee ceiling, within effective runtime limits. No new scheduler or mandatory ledger is introduced, and static installation checks are not proof of live compliance.

## Choose a lane

- Keep ordinary Q&A and single-step lookups Direct. Assign code changes, including tiny edits, to a suitable employee unless the user explicitly requests a direct edit. Keep non-code micro-edit acceptance proportionate.
- Use `micro` for a tiny change with clear scope and meaningful acceptance; use `light`/`simple` for small work, `standard` for routine work, and `complex` for major or consequential work. Judge actual impact and risk, not lines of code. Select a matching profession before choosing the execution profile.
- Use Standard for ordinary scoped work, including an unknown ordinary bug whose failure mechanism needs exploration. At the 10-minute exploration check, hand back scope growth, risk growth, or a contract change for reassignment.
- Use Complex for an actual cross-module/API contract or critical-behavior change. Do not choose Complex only because of module names.

For non-Direct work, announce the capability match and task settings once. A micro/light contract needs only goal, owned paths, and acceptance; the controller records the agent ID and its actual mapping. One suitable employee normally completes investigation, implementation and verification. Do not require a Luna scan or a file-search/document-reading/implementation relay. Avoid empty acknowledgements, mandatory scoring, a separate ledger or routine extra review.

Each implementation reuses suitable code, consolidates related duplication, edits in place, removes superseded logic and adds only what the task needs. Related obsolete code may be cleaned up within the owned scope without a separate cleanup entrypoint. Do not expand into a repository-wide refactor or trade behavior verification for fewer lines. The controller checks reuse evidence, necessary additions and replacement cleanup during acceptance.

### Task-local plan settings (v0.1.5)

`plan --difficulty micro` selects the existing `luna` profile and inherits its installed model, effort and Fast settings. Existing user mappings take priority. After v0.1.5 is published, with an existing matching employee ID, for example:

```sh
npx --package https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis plan --employee atlas-backend --difficulty micro --effort low
```

`--effort LEVEL` explicitly overrides effort only for this plan and validates it against the selected model; it writes no global settings and changes no employee identity. The example's `low` is a user-selected override, not an automatic micro downgrade. A plan is a preview, not dispatch. If the requested effort differs from the installed profile, the controller must use an explicit runtime binding and verify it; native dispatch cannot be claimed to inherit the override automatically. If that binding is unavailable, report the dispatch blocker. These options are included in v0.1.5; its download URL becomes available after publication.

## Supervision and evidence

Soft reassessment defaults are 10 minutes for Light, 20 for Standard, and 30 for Complex, and the controller may override them per task. They are prompts to inspect progress, never a time-based success, failure, or watchdog. Run only the targeted checks needed for the owned change, reuse applicable unchanged evidence with relevant dependencies and environment, and avoid duplicate full investigation or test runs. Closeout reports results, relevant evidence and blockers; timing and repair statistics are optional and useful only when diagnosing a concrete delay.

Run parallel work only when it can shorten completion or resolve an independent uncertainty without overlapping writes. Before handoff, stop the old writer and relevant tools, preserve its partial output, and treat a late result as evidence only. When review is required, a stable snapshot gets one batched review and one targeted recheck. A true remaining blocker still blocks; preferences and old out-of-scope issues do not automatically create rework.

## Independent review

An independently verified read-only reviewer is mandatory for changes affecting authentication, tenant or data isolation, sensitive or financial integrity, migrations or destructive persistence, concurrency/idempotency/critical-recovery consistency, or irreversible external operations. It is also mandatory when concrete evidence conflicts or a critical path remains unverified. Complex work and module names alone do not require review.

Examples and the full task-contract, reassessment, handoff, and acceptance rules are in the installed [orchestration policy](../payload/skills/jarvis-orchestrator/SKILL.md). These practices remain subject to the actual runtime, repository instructions, and user authorization: [subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [config reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Candidate count and concurrency

Candidate recommendations have no fixed count cap. The user chooses actual concurrency, bounded by three simultaneous subagents (including Reviewer, excluding the controller), the effective Codex limit, and available runtime slots. Queue remaining work; do not increase global settings automatically. The installer preserves an existing positive integer `agents.max_concurrent_threads_per_session`; it recommends 3 only when unset. `audit.maxSubagents` reports the Jarvis ceiling before a lower per-task user choice or runtime limit, while `codexMaxSubagents` reports the generated Codex setting.

## GPT-6 execution mapping

| Work | Compatible role key | Fresh-install recommendation |
| --- | --- | --- |
| Micro and clear light work | luna | gpt-6-luna / medium |
| Small implementation with known mechanisms | simple | gpt-6.1-sol / low |
| Scoped ordinary work | terra | gpt-6.1-sol / medium |
| Complex contract or critical behavior | sol | gpt-6.1-sol / high |
| Triggered independent review | reviewer | gpt-6.1-sol / high |

The `terra` key is retained for compatibility, not a claim that GPT-6 Terra exists. Professional employee names and skills remain separate. Reassessment may lead to a proposed setting change, subject to user selection and explicit runtime binding; it does not automatically change the model or effort. New defaults do not migrate existing saved choices automatically. Use the wizard or explicit model overrides after checking availability. This follows [official Codex guidance](https://learn.chatgpt.com/docs/models), checked 2026-09-24; quota savings and task latency were not benchmarked.

Simple implementation with a known mechanism and stable contract uses `simple` / GPT-6.1 Sol / Low. Difficulty reflects impact and risk while remaining separate from profession; controller preferences remain user-selected.

## Domain acceptance and asset retention

Use the same routing across domains. Read [domain examples](../payload/skills/jarvis-orchestrator/references/domains.md) when selecting methods and acceptance; code tests are not a mandatory gate for prose, documents or video. User-invoked skills take priority over conditional card suggestions. Read [asset evolution](../payload/skills/jarvis-orchestrator/references/assets.md) only when retaining or migrating useful material.
