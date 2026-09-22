# Routing and supervision

The user-selected main controller remains in the current task as dispatcher and final quality gate. Astra / High is the recommendation for a fresh setup; it is not required. Luna, Terra, and Sol are logical lanes, while each installed role mapping selects the actual model, effort, and optional Fast setting. Do not create an additional controller layer merely to coordinate ordinary workers.

Choose the first applicable route:

1. Clarify missing facts that change behavior, permissions, data meaning, or acceptance.
2. Use the Sol lane for contracts across modules or APIs; authentication, authorization, sensitive data, finance, schemas, migrations, transactions, idempotency, concurrency, cancellation, retries, timeouts, lifecycle behavior, production operations, external-account state, limits, irreversible side effects, suspected races, or architecture tradeoffs. High is the recommendation.
3. Use the Luna lane only for a low-risk, narrow task with explicit goal, location, pattern, boundary, and check. Medium is the recommendation.
4. Use the Terra lane for the remaining bounded, contract-stable development and reproducible ordinary bugs. Medium is the recommendation.

Default to one executor. Two independent writers are appropriate only when their paths and contracts do not overlap; use at most three subagents. Give every executor a task ID, attempt, revision, owned paths, dependencies, acceptance condition, and checkpoint. An executor submission is `SUBMITTED`, never final completion.

For handoff, stop the former writer and its relevant tools before reassigning the path. Preserve and inspect partial work. Increment the attempt only after the former writer is confirmed stopped. A late result from an old attempt or revision is evidence only.

Before accepting combined work, inspect the current tracked and untracked snapshot, verify scope and boundary behavior, and distinguish a baseline or environmental failure from a new one. Only The controller may declare the parent task complete.

These practices are aligned with Codex subagent configuration and remain subject to the actual runtime, repository instructions, and user authorization: [subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) and [config reference](https://learn.chatgpt.com/docs/config-file/config-reference).
