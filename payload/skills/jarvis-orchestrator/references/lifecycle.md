# Delegation lifecycle reference

Use this reference when work requires a ledger, handoff, recovery, or a detailed task contract. The controller owns the ledger; agents report through results and do not concurrently edit it.

## Contract

```text
Task ID: <id>
Parent: <parent id>
Objective and expected behavior: <specific result>
Model and routing reason: <Luna | Terra | Sol and matching rule>
Attempt / revision: <execution generation / contract version>
Owner and allowed paths: <single writer and exact files or directories>
Dependencies and preserved boundaries: <interfaces, invariants, skills>
Acceptance: <checks and pass criteria>
Checkpoint and escalation: <next event/time, scope/risk/authority triggers>
```

## Ledger fields

```text
task_id | parent | objective | acceptance
owner / agent_id | model / effort | allowed paths | dependencies
attempt | revision | status | next checkpoint
change snapshot | delivery paths | verification evidence | unresolved items
latest progress | controller decision | handoff reason
```

Use a commit ID when available. For uncommitted work, record a snapshot that includes tracked and untracked changes. Increment `revision` when objective, scope, or acceptance changes; increment `attempt` when execution restarts or ownership changes. Results whose identifiers do not match the active version are stale evidence.

## States and authority

`READY -> RUNNING -> SUBMITTED -> REVIEW -> DONE`

`RUNNING -> BLOCKED` for missing information or an unavailable environment. The controller may resolve the blocker and return it to `RUNNING`.

`RUNNING -> HANDOFF_PENDING -> READY` only after the former writer and its relevant commands or tools are confirmed stopped. A cancelled task uses `CANCELLED`, never `DONE`.

An executor submission, completed agent turn, or successful command does not grant `DONE`. The controller determines the final state after reviewing the current snapshot and combined result.

## Evidence return

Each agent response should include:

```text
task_id / attempt / revision:
scope understood and files or symbols examined/changed:
checks actually run, command, exit code, and relevant output:
evidence paths or snapshot:
unresolved issues, environmental blockers, or controller decisions needed:
```

For a review finding, add the condition that exposes it and the exact location. For unrun checks, say they were not run and why.
