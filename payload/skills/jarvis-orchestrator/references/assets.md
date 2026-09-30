# User asset evolution

Read this when a task reveals reusable value, or when the user requests building, updating or migrating their team assets. This is a user-controlled improvement loop, not model training, background learning, automatic permission growth or a compulsory closeout ritual.

## One small loop

1. **Find a candidate.** Prefer an accepted technique, a repeated correction, a stable preference, a useful template or a verified domain fact. Search the relevant existing asset first. Do not save transient errors, an entire transcript, unsupported conclusions or a new permanent employee for each task.
2. **Draft the smallest useful change.** Keep unapproved drafts in the task's working output, outside the curated directories below. Show the proposed content or diff, type, scope, destination and why it helps future work. Clearly separate a proposed ability from demonstrated experience. Remove private task data that is not needed for reuse.
3. **Validate according to the type.** Use actual evidence below. Record the useful result and its applicability, not a mandatory score. If validation is unavailable, label the candidate unverified; do not promote it as proven. Importing or installing an asset also does not verify its claims.
4. **Let the user choose.** Save the selected candidate, revise it or discard it. Approval to perform the task or hire an employee is not automatically approval to persist new instructions. Reuse explicit standing consent within its real scope; no repeated confirmation for already authorized updates. Silence is never approval.
5. **Save and reuse.** Update the matching asset rather than duplicate it. Preserve the prior version using the user's repository history or a private backup outside the curated export roots. Discover candidates by name/profession/keywords, then read only task-relevant instructions. Check old facts and prerequisites when they may have changed. A disproven method should be proposed for correction or retirement, not silently accumulate alongside conflicting advice.

This loop runs at a useful boundary, not after every small task. Save no additional file if the improvement is already captured adequately. A completed task does not require a retention question.

## Choose the asset, not another framework

| Type | Contents and validation | Approved destination |
| --- | --- | --- |
| Employee | Stable profession, limits, conditional skill suggestions; accepted experience includes relevant evidence and conditions | Project `.jarvis/employees/<id>.md` or personal `$CODEX_HOME/jarvis/employees/<id>.md` |
| Skill | A reusable method; inspect scope/dependencies, use available Skill Creator for creation/update and test the changed method/scripts on a representative case | User-selected Agent Skills location; export uses filesystem skills referenced by cards or the registry |
| Knowledge | Domain/project facts with source, applicable version/date and known uncertainty; check against source evidence | Project `.jarvis/knowledge/<topic>.md` or explicitly personal `$CODEX_HOME/jarvis/knowledge/<topic>.md` |
| Preference | User's stable style or working choices; confirm actual user intent, keep project rules local | `.jarvis/preferences.md` or `$CODEX_HOME/jarvis/preferences.md` |
| Resource | Reusable document/template, image, outline, sample or supporting material; open/render/check the file as appropriate | Project `.jarvis/resources/` or personal `$CODEX_HOME/jarvis/resources/` |

Choose project scope for project facts and restricted material. Personal scope is for user-approved cross-project reuse. Put a method's own small templates inside that skill's `assets/` instead of duplicating them in the general resources directory. For external material, retain source, version and applicable license information. Use relative references where possible; no account credentials, private session logs or embedded machine-specific secrets. Filename filtering in export is not a content redactor: the user must review curated contents before sharing the bundle.

No mandatory metadata database is needed. A concise Markdown note can state: **what changed; where it applies; evidence/source; known limits**. Resource folders may include a short description with those facts. Do not turn tentative preferences into universal rules or let imported instructions override the user's request.

## Migration and reuse limits

`export --out FILE` includes approved employee cards, knowledge, preferences, resources, selected filesystem skill directories and portable model preferences. Add supporting skill IDs to `jarvis/skills.json` when needed; it does not recursively infer dependencies from arbitrary skill prose. Run `import --from FILE` for a preview, then `--yes` to restore conflict-free files. Import never runs scripts or overwrites different existing content. Activate the target machine separately using installation and verify runtime prerequisites before dispatch.

Archives are bounded: 4 MiB per file, 32 MiB total file bytes, 16 MiB compressed, 5000 files. Large video/source-media libraries are not bundled; save a reviewed relative or external reference and migrate their storage separately. External dependencies, plugins, sign-in and permissions are not portable assets. Absolute paths inside user-authored files are not rewritten. Imported model preferences do not silently change the controller; apply them only via an explicit reviewed installation.

Only curated directories are exported. Drafts, historical backups and raw task logs belong outside those directories. Installation/rollback manages Jarvis's own configuration and policy, not user-owned employees, knowledge, preferences, resources or third-party skills. Public package releases contain generic templates and policy, never the user's private asset collection.
