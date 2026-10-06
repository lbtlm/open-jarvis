# GitHub Release procedure

Development happens on `dev`. Create feature/fix branches from `dev`, merge reviewed PRs into `dev`, then open a release PR from this repository's `dev` into `main`. Merging that PR is approval to publish: there is no environment approval, manual release button or npm publication. A merge into `dev` never publishes.

## One-time repository setup

1. Make `main` the default branch, keep `dev` as the development branch, and enable GitHub Actions on the public [lbtlm/open-jarvis repository](https://github.com/lbtlm/open-jarvis).
2. Protect both branches with pull requests and the required `CI Gate` status. Do not allow direct pushes or bypasses to `main`; branch protection is an external repository setting, not installed by these files. A main PR must come from the same repository's `dev`, including for fixes; emergency exceptions are not implemented.
3. Allow the Release workflow's job-scoped `GITHUB_TOKEN` to use `contents: write`. Preparation, platform tests and remote installation use only `contents: read`. No personal token, npm login, npm secret, OIDC permission or approval environment is needed. Leave workflows on the default `main` branch so the ordinary token can tag the final commit without additional workflow permission.
4. Check the first PR's Actions run and its `CI Gate`. After it is merged into `main`, monitor `Release`; its success includes public remote installation verification. Until the first Release exists, public tarball URLs will return 404.

## Version preparation

On `dev`, update `package.json`, the top-level and root-package versions in `package-lock.json`, and a single matching `## x.y.z` section in `CHANGELOG.md` with meaningful bullet entries. Only stable versions are supported. With no stable `vX.Y.Z` tag, the initial release may retain the current version (initially 0.1.0). Later versions must exceed the main base version and every existing stable version tag. Version checks run for release PRs and again on the final main SHA. Feature/fix PRs targeting `dev` do not require a version increase. No `next` or prerelease channel is implemented.

## What the two workflows do

`ci.yml` handles dev pushes, PRs and reusable CI. It checks out the immutable event SHA, checks source/version when relevant, installs locked dependencies, and runs syntax/unit checks. A Node 24 job using npm 11.5.2 packs once with lifecycle scripts disabled. It records the actual tarball file list, package version, source SHA and SHA256 in `release-manifest.json`, `SHA256SUMS` and release notes. Linux, Windows and macOS on Node 22/24 consume that same artifact, verify its checksum, and run npm and pnpm 10.18.1 package smoke checks. `CI Gate` succeeds only when preparation and every platform check succeed. Local runs do not establish those six CI platform results.

`release.yml` runs only on main pushes and calls the same CI for that final SHA. The privileged job downloads that run's tested artifact; it does not install dependencies or repack it. It creates `vX.Y.Z` at the exact SHA, creates a draft Release, uploads and downloads the tarball, checksum and manifest to verify their bytes, then makes the stable Release public. Notes contain this concrete version's install command:

```sh
npx --yes --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.5/open-jarvis-0.1.5.tgz open-jarvis install
```

Replace both version occurrences for another Release. The package/executable name stays `open-jarvis`, but it is delivered through GitHub. `smol-toml` and package-manager tooling may still be downloaded from npm; this is not a fully offline distribution. GitHub-generated source archives are not the installer tarball.

A separate read-only job downloads the public version asset, compares its SHA256 with the tested manifest, and runs that public URL through npm exec using a fresh cache and temporary home. It checks audit, install, doctor and rollback without model requests or a real Codex home. Runtime role dispatch and actual model execution are outside this release smoke check.

## Failure and rerun

A failed required command stops its job; publication requires all CI jobs to succeed. Main release runs are serialized with `cancel-in-progress: false` and GitHub's `queue: max` (up to 100 pending runs, not an unlimited durable queue). PR runs can cancel stale checks. Avoid merging another release while the current release needs investigation. Immediately before any publication write, the publisher independently reads every page of live stable tags. A higher version blocks creating an older release or publishing its draft, including a failed-job rerun that skips previously successful CI. A consistent already-public release remains available for read-only verification without changing latest.

Rerun the original failed workflow at its original SHA. The script never moves or deletes a tag, overwrites an asset or deletes a Release. An existing tag must resolve to the same commit; every existing required asset must have identical bytes. Matching draft assets can be reused and missing draft assets uploaded. A matching public Release is reused without writes. A wrong tag, different asset checksum, missing public asset, authentication error or network failure blocks recovery and requires maintainer investigation rather than an automatic overwrite.

If remote installation fails after publication, the Release remains public and the workflow fails. Its job summary says publication occurred and verification is pending. Retry the original run to complete verification; do not call a red run fully verified. Rerunning all jobs repacks, so byte differences fail safely against existing assets; rerunning failed jobs uses the original artifact until its 14-day retention expires. An expired artifact requires deliberate maintainer recovery, not a blind publish.

## Local scope and evidence

For release logic, run `node --test test/release-check.test.mjs test/release-github.test.mjs`. These tests inject GitHub results and make no external writes. Also run the repository's relevant checks and package smoke checks before merging. No automated cross-version upgrade claim follows from same-version smoke; see [upgrading.md](upgrading.md).

Protocol references: [GitHub workflow syntax and concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [Release API](https://docs.github.com/en/rest/releases/releases), [Release assets API](https://docs.github.com/en/rest/releases/assets), [Git references API](https://docs.github.com/en/rest/git/refs), and [npm package specifications](https://docs.npmjs.com/cli/v11/using-npm/package-spec).
