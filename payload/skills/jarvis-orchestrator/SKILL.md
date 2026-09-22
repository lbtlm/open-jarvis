---
name: jarvis-orchestrator
description: Route and supervise real delegated development work with the selected main controller as the final decision-maker. Use when a coding task genuinely needs subagent delegation; do not activate for ordinary questions or tiny directly verifiable edits.
---

# Jarvis Orchestrator

The selected main controller owns task contracts, routing, supervision, integration, and final acceptance. Astra / High is the recommendation for a fresh installation, not a requirement: the user's selected controller model, effort, and Fast setting govern the workflow. Do not automatically raise controller effort, enable Fast, or require Ultra for delegation or acceptance. Luna, Terra, and Sol are logical task lanes; their installed role mappings select the actual model, effort, and optional Fast setting. This is a workflow convention, not a hard lock, permission system, operating-system file lock, or cross-restart guardian. Follow real tool state, repository rules, and user authorization.
Keep orchestration in the current primary task. Do not add a nested controller merely to dispatch ordinary workers; it adds context cost and consumes another runtime slot.

## Start with a contract

Delegate only when delegation reduces risk or time for real development work. Keep ordinary questions, single-step lookups, and tiny directly verifiable edits in the main task. Automatically discover only the skills relevant to the affected behavior; do not load a historical skill archive wholesale.

Before each delegation, record or state:

- `task_id`, parent task, objective, expected behavior, and acceptance criteria.
- selected controller and executor model/effort/Fast settings, plus the routing reason;
- allowed write paths, single writer, dependencies, stable interfaces/invariants, and relevant skills;
- `attempt` (execution/ownership generation), `revision` (contract version), and the next progress checkpoint.

Use the task ledger for multi-agent, long-running, handed-off, or resumable work. For the contract and ledger template, read [references/lifecycle.md](references/lifecycle.md).

## Route work

Evaluate the rules in order; the first match sets the minimum level.

1. Clarify unknown business facts that change external behavior, data meaning, permission, or acceptance. More capable models do not decide missing requirements.
2. Send directly to the Sol lane for cross-module or API contracts; authentication, authorization, tenancy, sensitive data, or financial correctness; schema/migration/transaction/idempotency work; concurrency, cancellation, retry, timeout, connection or lifecycle behavior; production operations, external-account state, limits, or irreversible side effects; contradictory evidence, suspected races, or architecture tradeoffs. High is the recommended Sol effort, while the installed role mapping is authoritative.
3. Use the Luna lane only when the goal, location, existing pattern, boundaries, and simple acceptance check are all explicit, with no contract or high-risk semantic change. Medium is the recommendation, not a forced override.
4. Use the Terra lane for remaining bounded, contract-stable development and reproducible ordinary bugs. Medium is the recommendation, not a forced override.

Do not route based only on file count, apparent simplicity, or a user calling a change small. A read-only location search may be Luna when its scope is explicit; unknown call paths or failure mechanisms need Terra exploration before implementation routing.

## Bind roles to the actual runtime

A role file on disk is not proof that its name is registered in the current session. Inspect the exposed `agent_type` choices. Prefer the configured Jarvis role when it is available; never repeat an `unknown agent_type` call unchanged.

If a Jarvis executor name is unavailable, use the supported **compatibility explicit-binding mode**:

- Read its installed TOML and carry its complete `developer_instructions`, `model`, `model_reasoning_effort`, `service_tier`, and Fast feature setting into the worker contract. Those TOML values are the mapping source, including a user-selected override; do not substitute fixed fallback model names. Luna/Medium, Terra/Medium, and Sol/High are recommendations for logical routing lanes, not permission to overwrite the installed mapping.
- Select a supported built-in `default` or `worker` role, set `model` and `reasoning_effort` explicitly, and use `fork_turns="none"` or a supported limited fork. Do not use a full-history fork that prevents these overrides. Fast runtime overrides (`service_tier` and `features.fast_mode`) must also be explicitly passed or independently verified as inherited.
- Record `mode=compat-explicit`, the logical Jarvis role, actual tool role, requested model/effort/Fast setting and returned agent ID. Check runtime metadata when available; otherwise distinguish requested settings from verified settings. A label or worker self-report does not verify model identity or Fast inheritance.
- Only use this fallback when model, effort, Fast settings, and instructions are the role's complete execution overrides. Do not silently discard sandbox, approval, MCP, skills or other runtime settings. In particular, `jarvis_reviewer` requires its configured read-only sandbox to be reproduced or independently verified; a prompt saying read-only does not provide that sandbox. If the current interface cannot preserve or verify a required setting, block that delegation and explain the exact missing capability while continuing independent permitted work.
- If explicit model selection is unsupported, do not substitute the parent model. Report the delegation blocked. For native role loading, a fresh client/session may be needed; test the actual role call afterward instead of claiming a refresh is guaranteed to fix it.

This mode selects the real requested model and preserves the executor instructions; it must never be described as successful native custom-role registration. The controller, ownership, handoff and acceptance rules below still apply.

## Execute, observe, and escalate

Give one writer each owned path. Keep interfaces fixed before parallelizing dependent work. Start with one executor; add independent work only when it has no write conflict. Use at most three subagents and do not create parallelism merely to fill capacity.
Respect the runtime's actual available slots, including parent controllers or still-open completed agents. On a thread-limit error, collect results and inspect state; reuse an idle compatible agent with a new explicit contract when possible. Do not assume a completed report freed a slot, interrupt unrelated work, or retry spawning indefinitely. A reused agent keeps its actual model unless a supported tool explicitly changes it.

Agents must first confirm task ID, attempt, revision, scope, and acceptance. Observe at meaningful checkpoints: location found, a known long check completes, implementation ready for validation, blocked, or submitted. A status message or tool exit is never final acceptance.
Assign scoped checks to each worker. Run shared integration checks after their prerequisites have been submitted; unfinished sibling work is not a reason for each worker to repeat the same failing full suite.
If a checkpoint is missed, inspect actual agent/tool state and request one concise progress report. Decide to continue with a new checkpoint, repair, hand off, or declare a concrete blocker; do not poll or wait indefinitely without new evidence.

On every failed acceptance item, permit the initial implementation plus one evidence-based repair: failure evidence, causal hypothesis, targeted change, and retest. If it still fails, route Luna to Terra or Terra to Sol. A newly discovered high-risk boundary goes directly to Sol. Network, permission, dependency, or other environmental failures remain environment work or `BLOCKED`; do not escalate merely to repeat them. After two model handoffs on one issue, reassess missing information, environment, and task split before proceeding.

Agents report scope mismatch and stop that portion. They do not change model, sandbox or approval defaults, spawn subagents, expand write paths, perform new external actions, or mark a parent `DONE`.

## Handoff and stale results

For replacement or withdrawal, mark `HANDOFF_PENDING`, request the old writer to stop, and verify the agent plus its relevant commands/tools have stopped writing. Preserve useful work and inspect the real diff, untracked files, checks, incomplete steps, and effects. Do not reset unrelated work or stop unrelated services.

Only after old writes are confirmed stopped may you increment `attempt` and assign a new writer. If that cannot be confirmed, retain `BLOCKED`. Late results from an old attempt/revision are evidence only: isolate them from current state and never let them trigger a new action or overwrite the ledger.

On resume, read the ledger and verify agent and workspace state before restarting work. For uncertain external writes, check actual records and use an idempotency key when the interface supports one; otherwise remain blocked instead of replaying.

## Accept the combined result

Review the current change snapshot, including tracked and untracked files. A code or contract change invalidates affected evidence. Verify requirements, scope, relevant error and boundary paths, and that commands actually ran with their results. Distinguish baseline or environmental failures from introduced ones.

For high-risk changes, request an independent `jarvis_reviewer` review of a stable snapshot. The reviewer must not use external write tools; a filesystem read-only sandbox alone does not revoke connector write capabilities. The reviewer reports evidence; the executor fixes only after the controller assigns it. Do not review a moving target.

Mark an item `PASS`, `REWORK`, or `BLOCKED`. Only the selected controller may mark `DONE`, and only after all required subitems and their combined behavior are accepted on the current attempt/revision. Separate passing subitems do not prove the integration passes. Record current-attempt change and verification evidence in the ledger when one is in use.
