# Security

The installer edits only its declared files beneath the selected Codex home and keeps local backups. Those backups can contain private settings from your existing configuration. Do not publish a Codex home, backup directory, environment file, credentials, or session logs in an issue or pull request.

`audit` and `doctor` are local checks. They do not verify model access, role registration in a running session, or effective agent permissions. The installer does not read `auth.json`, make model requests, change your approval policy, or grant connector permissions.

The orchestration instructions are workflow conventions. The runtime enforces permissions; an instruction saying “read-only” cannot replace a read-only sandbox. Review the effective settings before delegating sensitive work.

If you discover a vulnerability, use the repository's private vulnerability reporting feature once the public repository enables it. Until then, contact the repository maintainer privately. Include a minimal reproduction using synthetic configuration, never real credentials.
