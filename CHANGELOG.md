# Changelog

## Unreleased

## 0.1.4

- Standardize employee labels as `Employee name · Profession | Topic`, with meaningful optional identifiers and optional avatars; keep tool IDs separate and respect client display limits.
- Add opt-in host-local QMD discovery instructions for employees, skills and experience, with bounded collection scope, embedding-only semantic lookup, source revalidation and a direct-file fallback. QMD remains an external optional dependency.
- Add optional QMD engine setup to the installation wizard and `install --qmd`, with explicit directory, npm/pnpm and backend choices; leave ordinary installation and existing QMD connections unchanged. Reuse QMD's native automatic GPU selection and CPU fallback, and distinguish missing embedding assets from unavailable CUDA system libraries.
- Add a user-controlled Markdown experience lifecycle with candidate previews, explicit approval, conflict-checked updates and scoped local search; reuse existing asset export/import without a new service or dependency.
- Include current experience references in task-plan previews and Markdown assignments, keeping employee capability matching, source verification and actual dispatch under the controller.

## 0.1.3

- Add scoped engineering discipline for code tasks: complete behavior with minimum necessary complexity, justified reuse or additions, change-created cleanup and behavior evidence; assess concrete design burden without line-count gates or routine extra reviewers.

## 0.1.2

- Keep approved employee names visible through dispatch, progress, handoff and acceptance; distinguish task labels, runtime IDs and execution profiles without changing runtime settings or client labels.

## 0.1.1

- Preserve custom model, effort and Fast selections from explicitly supplied prior installation receipts through CLI and wizard upgrades.
- Allow provider-qualified model IDs in portable export/import while retaining validation against traversal, absolute paths and control characters.
- Add preference-preservation, partial override, rollback and portable activation regressions; document external-receipt recovery limits.

## 0.1.0

- Add a Node.js installer and `open-jarvis` executable for modern Codex desktop and CLI, distributed as a GitHub Release tarball without automatic postinstall configuration changes.
- Provide read-only audit and doctor, protected installation backups, guarded upgrades and manifest-based rollback; detect installed-policy drift separately from runtime dispatch.
- Keep models, reasoning effort and Fast editable per role. Recommend GPT-6 Luna/Medium for light work and GPT-6.1 Sol Low/Medium/High for simple, routine and complex work while preserving existing user selections and compatible role keys.
- Use the user-selected controller for routing and final acceptance, with reusable executor and independent reviewer roles, explicit compatibility bindings and runtime verification boundaries.
- Apply the same task routing across skill invocation, subagents and explicitly requested separate tasks; retain Direct work, existing approvals, scoped evidence, soft reassessment and bounded repair/review.
- Require professional capability fit before employee reuse and propose temporary specialists when essential skills or languages are missing; document Agency Agents as a template source and Vercel Skills for focused discovery.
- Add optional development, writing, office and video starter cards, employee search and task-plan previews. Installation defaults to no starter, and task-specific skill bindings may extend card suggestions.
- Add bounded portable export/import for employee cards, skills and curated templates/resources, with user-controlled asset evolution and preservation of user-owned assets and model preferences.
- Fix CRLF role rendering on Windows and preserve unset/inherited Fast preferences during noninteractive upgrades.
- Use English as the primary README, with Chinese and Japanese documentation, a concise quick start, and upgrade/rollback guidance.
- Support npm exec and optional pnpm dlx through the same package smoke assertions while retaining npm and package-lock.json for repository dependencies.
- Automate GitHub Releases after approved dev-to-main merges: check source/version, test one tarball across the CI matrix, bind its SHA and checksum, and verify remote installation. Reject mismatched recovery assets and prevent an older draft from superseding a higher stable version.
