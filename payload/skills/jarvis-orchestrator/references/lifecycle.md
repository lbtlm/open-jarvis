# Delegation lifecycle reference

Use for multiple agents, long/resumable work, handoff, detailed review evidence, or closeout. The controller owns task state; workers report results, not concurrent ledger edits. A Light assignment needs only goal, owned paths, and acceptance, with the parent recording agent ID and mapping. No separate ledger file or acknowledgement-only turn is required.

Use the [employee naming rules](employees.md#employee-names-and-runtime-identity) throughout dispatch, progress, handoff, submission and controller acceptance.

## Detailed contract and state

```text
task_id / parent / lane and reason:
objective / scope / acceptance:
approved employee name / readable task label / supported task_name / returned runtime ID:
owner and allowed paths / dependencies / invariants:
internal execution profile / actual tool role / requested model, effort, Fast / runtime verification:
attempt / revision / next checkpoint and soft budget:
current snapshot / evidence locations / unresolved decisions:
```

Start attempt/revision at 1 when versioned tracking is needed. Increase revision for changed scope/acceptance; increase attempt only after stopping the old writer before restart/reassignment. A late result with mismatched identifiers cannot authorize another action. For uncommitted work, identify both tracked and untracked changes; a commit ID alone does not describe a dirty worktree.

`READY -> RUNNING -> SUBMITTED -> REVIEW -> DONE`

REVIEW means controller acceptance, not mandatory independent Reviewer work. Use the precise triggers in [SKILL.md](../SKILL.md#verify-and-converge). Missing requirements, unavailable environment, or unconfirmed old-writer shutdown can produce BLOCKED; elapsed time alone cannot. A cancelled task uses CANCELLED, not DONE.

`RUNNING -> HANDOFF_PENDING -> READY` requires verified shutdown of the former writer and related tools before ownership changes. Preserve and inspect partial work. On resume, verify state before continuing. Do not replay external actions of unknown outcome.

## Checkpoints and repair

Light / Standard / Complex reassessment defaults are 10 / 20 / 30 minutes; scoped Standard exploration has a checkpoint around 10 minutes. Override these in the assignment when a known operation warrants it. They are decision points, not timers implemented by Codex, deadlines, or reasons to omit validation. Inspect state and ask once at a missed checkpoint, then record the evidence-based choice and next checkpoint. A continuation with no new evidence needs a changed investigation, narrower task, safe handoff, or concrete blocker.

Batch review findings. After one repair batch and targeted recheck, further review requires a stated material blocker, new critical evidence, or changed affected scope. Keep genuine blockers open. A worker's submission or successful command does not mark the parent DONE.

## Evidence and minimal closeout

```text
employee name / task label / runtime ID / assignment (task_id / attempt / revision when in use):
changes and key paths/symbols:
checks actually run / exit codes / relevant result:
snapshot and evidence paths / reuse applicability:
blockers / required controller decisions / optional findings:
```

Keep raw logs outside the parent conversation when useful; include the relevant failure excerpt and evidence path. Reuse checks only when relevant source, dependencies, inputs, configuration, and environment remain applicable. Reviewer blockers identify the violated requirement/invariant, exact location, exposure condition, and evidence or specific missing critical check. Optional style and unrelated existing issues do not automatically block this task.

Close with relevant evidence and remaining blockers. Do not require scores, KPIs, mandatory timing/rework statistics or a retrospective after every task. At a task boundary, a short handoff can preserve accepted results, remaining work, key paths, and reusable evidence without copying the full conversation.
