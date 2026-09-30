# Routing and supervision

The user-selected main controller stays in the current task and is the final quality gate. Astra / High is only a fresh-install recommendation. Installed mappings and the user's selected model, effort, and Fast setting are authoritative; routing never auto-enables Fast or raises effort to Ultra. Luna, Terra, and Sol name work lanes, not fixed models or module labels.

## Consistent entry and dispatch

Plain requests, invoked skills and user-requested separate tasks use the same [orchestration entrypoint](../payload/skills/jarvis-orchestrator/SKILL.md). Methods do not replace employee selection. An assigned executor follows its contract without creating another controller. Direct work remains local; other lanes select an approved profession and use one visible assignment plus the actual dispatch ID/settings status.

Subtasks normally use subagents. An explicitly requested separate user task may host the approved employee directly, with its settings bound through the supported task interface; subagent TOMLs do not automatically apply. Count both surfaces toward the controller's three-active-employee ceiling, within effective runtime limits. No new scheduler or mandatory ledger is introduced, and static installation checks are not proof of live compliance.

## Choose a lane

- Keep Q&A and a tiny edit with an immediate, meaningful check in the main task.
- Use Luna only when the goal, owned location, existing pattern, boundary, and simple acceptance check are all clear.
- Use Terra for ordinary scoped work, including an unknown ordinary bug whose failure mechanism needs exploration. At the 10-minute exploration check, hand back scope growth, risk growth, or a contract change for reassignment.
- Use Sol for an actual cross-module/API contract or critical-behavior change. Do not choose Sol only because of module names.

For non-Direct work, announce the lane and reason once. A Luna contract needs only goal, owned paths, and acceptance; the controller records the agent ID and its actual mapping. Avoid empty acknowledgements and a separate ledger for light work.

## Supervision and evidence

Soft reassessment defaults are 10 minutes for Luna, 20 for Terra, and 30 for Sol, and the controller may override them per task. They are prompts to inspect progress, never a time-based success, failure, or watchdog. Run only the targeted checks needed for the owned change, reuse applicable unchanged evidence with relevant dependencies and environment, and avoid duplicate full investigation or test runs. Closeout reports results, relevant evidence and blockers; timing and repair statistics are optional and useful only when diagnosing a concrete delay.

Run parallel work only when it can shorten completion or resolve an independent uncertainty without overlapping writes. Before handoff, stop the old writer and relevant tools, preserve its partial output, and treat a late result as evidence only. When review is required, a stable snapshot gets one batched review and one targeted recheck. A true remaining blocker still blocks; preferences and old out-of-scope issues do not automatically create rework.

## Independent review

An independently verified read-only reviewer is mandatory for changes affecting authentication, tenant or data isolation, sensitive or financial integrity, migrations or destructive persistence, concurrency/idempotency/critical-recovery consistency, or irreversible external operations. It is also mandatory when concrete evidence conflicts or a critical path remains unverified. Sol work and module names alone do not require review.

Examples and the full task-contract, reassessment, handoff, and acceptance rules are in the installed [orchestration policy](../payload/skills/jarvis-orchestrator/SKILL.md). These practices remain subject to the actual runtime, repository instructions, and user authorization: [subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [config reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Candidate count and concurrency

Candidate recommendations have no fixed count cap. The user chooses actual concurrency, bounded by three simultaneous subagents (including Reviewer, excluding the controller), the effective Codex limit, and available runtime slots. Queue remaining work; do not increase global settings automatically. The installer preserves an existing positive integer `agents.max_concurrent_threads_per_session`; it recommends 3 only when unset. `audit.maxSubagents` reports the Jarvis ceiling before a lower per-task user choice or runtime limit, while `codexMaxSubagents` reports the generated Codex setting.

## GPT-6 execution mapping

| Work | Compatible role key | Fresh-install recommendation |
| --- | --- | --- |
| Clear small tasks | luna | gpt-6-luna / medium |
| Scoped ordinary work | terra | gpt-6.1-sol / medium |
| Complex contract or critical behavior | sol | gpt-6.1-sol / high |
| Triggered independent review | reviewer | gpt-6.1-sol / high |

The `terra` key is retained for compatibility, not a claim that GPT-6 Terra exists. Professional employee names and skills remain separate. Reassessment can increase reasoning on the same Sol model; it is not always a model handoff. New defaults do not migrate existing saved choices automatically. Use the wizard or explicit model overrides after checking availability. This follows [official Codex guidance](https://learn.chatgpt.com/docs/models), checked 2026-09-24; quota savings and task latency were not benchmarked.

Simple implementation with a known mechanism and stable contract uses `simple` / GPT-6.1 Sol / Low. Difficulty is independent of profession and behavioral risk; controller preferences remain user-selected.

## Domain acceptance and asset retention

Use the same routing across domains. Read [domain examples](../payload/skills/jarvis-orchestrator/references/domains.md) when selecting methods and acceptance; code tests are not a mandatory gate for prose, documents or video. User-invoked skills take priority over conditional card suggestions. Read [asset evolution](../payload/skills/jarvis-orchestrator/references/assets.md) only when retaining or migrating useful material.
