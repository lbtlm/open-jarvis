# Upgrade and rollback

## Multi-platform upgrades in 0.2.0

Version 0.2.0 adds per-client installations for Codex, WorkBuddy, Claude Code and Cursor. Follow the [multi-platform guide](multi-platform.md) to select the client and shared library. Existing Codex assets can remain in their original `<codex-home>/jarvis` directory and become the shared source; moving or duplicating the library is unnecessary. Select that directory explicitly for each new client. New installations recommend `~/.jarvis`. Do not silently choose between competing existing libraries: review the conflict and select the intended root.

The platform home and shared asset root have different purposes. Keep each client's model and permission settings separate, save the manifest returned by that client's installation, and use the matching platform when rolling it back. Rollback restores that installation's managed files; it does not migrate account sign-in, plugins or external tools, or delete the shared employee and experience library. The default Codex procedure is below; for another client add its `--platform` consistently to audit, install, doctor and rollback.

Choose a published version on [GitHub Releases](https://github.com/lbtlm/open-jarvis/releases). The URL must name that version and its installer tarball, rather than GitHub's generated source archive. No automatic background update runs, and merely downloading or invoking help does not change client configuration. Dependencies may be fetched from npm.

## Preview and install

Replace `0.2.0` below with the desired published version in both URL positions. Run the new version's read-only audit first against your existing Codex home:

```sh
npx --yes --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis audit
npx --yes --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis install
npx --yes --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis doctor
```

The install command previews/protects managed changes and writes only managed files whose desired content differs from the installed content. It creates an installation manifest with backups when it writes. Save the exact manifest path returned by this upgrade. When no files need changes and the validated ownership receipt is current, install returns `already-installed` without a new manifest. If an existing validated receipt is stale but all current files match the verified package output, install can create a new ownership receipt with `files: []` and zero content changes. It keeps prior receipts unchanged; rolling back this refresh deactivates only the new receipt and restores zero files. Use `--home ABSOLUTE_PATH` consistently when targeting a different home, and first rehearse upgrades in a copied, disposable fixture rather than your active home.

Existing model mappings, effort/Fast preferences and user-owned employee cards follow the installer's preservation rules. For Codex, the only extra role preference merged automatically is root-level Reviewer `approval_policy = "never"`, with `sandbox_mode = "read-only"` preserved. This requires a validated installed receipt plus an exact match to the package role after removing that one setting, or a checksum match to its recorded baseline. New receipts use schema version 4, bind the platform and shared root, and record the preference for later payload upgrades. The Codex adapter still reads legacy v1/v2/v3 receipts; those legacy receipts do not authorize another platform. Use this updated installer for rollback of a v4 receipt; older installers that do not understand v4 reject it. This fail-closed behavior is not a general downgrade guarantee. This does not accept arbitrary role files, permission changes, or modified instructions. Do not infer that every manual edit can be merged automatically: when audit or install reports a blocked/conflicting ownership or configuration change, stop and review the named files. Preserve your edits and backups; do not force replacement. Legacy installations with an undiscovered receipt can be previewed with `--previous-manifest ABSOLUTE_PATH` (repeatable). The CLI validates ownership and manifest contents before using them; an arbitrary JSON file is not upgrade authorization.

For a manually downloaded installer, download `SHA256SUMS` and `release-manifest.json` from the same Release, verify the tarball checksum, then use `npx --yes --package=./open-jarvis-VERSION.tgz open-jarvis audit` and `install`.

## Roll back that upgrade

Use the manifest produced by the upgrade to restore the pre-upgrade managed files:

```sh
npx --yes --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.2.0/open-jarvis-0.2.0.tgz open-jarvis rollback --manifest ABSOLUTE_UPGRADE_MANIFEST_PATH
```

Use the same target `--home` if one was specified during the upgrade. Rollback checks current file hashes before restoring; files edited after installation cause refusal and require manual preservation/merge. Rollback does not remove user-owned employee cards or resources. If the prior receipt was supplied from outside `jarvis-state`, keep that receipt and pass `--previous-manifest` again for subsequent audit/install commands. `doctor` discovers only receipts under `jarvis-state`, so after this kind of rollback it may report restored custom roles as mismatched; this does not mean the restored files were overwritten. Restart/reopen Codex after installation or rollback and separately verify actual roles/settings at runtime. Installing an older tarball is not a substitute for rollback with the correct manifest.

## Verification limits

Release smoke verifies a clean synthetic installation, doctor, idempotence and rollback using one version's package. This does not establish a genuine previous-version-to-new-version upgrade or downgrade path. A cross-version claim requires two retained version tarballs, an isolated prior installation with representative user preferences/edits, the new version's audit and install, doctor, and rollback using the upgrade manifest. Report the two actual versions and outcomes before claiming that path is validated; never use a real account or active Codex home for that check.
