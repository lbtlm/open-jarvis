import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, existsSync, appendFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { digest } from './release-github.mjs';

const manifest = JSON.parse(readFileSync(join(process.argv[2], 'release-manifest.json'), 'utf8'));
assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
assert.equal(manifest.filename, `open-jarvis-${manifest.version}.tgz`);
assert.equal(manifest.sha, process.env.GITHUB_SHA);
const url = `https://github.com/lbtlm/open-jarvis/releases/download/v${manifest.version}/${manifest.filename}`;
const summary = text => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`); };
summary(`Release is public: https://github.com/lbtlm/open-jarvis/releases/tag/v${manifest.version}\nRemote installation verification is pending. A failure keeps the release public; rerun this workflow to retry verification.`);
const scratch = mkdtempSync(join(tmpdir(), 'open-jarvis-release-'));
const home = join(scratch, 'codex-home');
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.ok(response.ok, `Public asset download failed: HTTP ${response.status}`);
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), manifest.sha256, 'Public tarball differs from the tested artifact.');
  // Resolve the public version URL again through npm, with a fresh cache and temporary user home.
  const invoke = args => execFileSync('npm', ['exec', '--yes', '--ignore-scripts', `--package=${url}`, '--', 'open-jarvis', ...args, '--home', home, '--json'], {
    cwd: scratch, encoding: 'utf8', timeout: 120000, env: { ...process.env, HOME: scratch, USERPROFILE: scratch,
      CODEX_HOME: home, npm_config_cache: join(scratch, 'npm-cache'), npm_config_userconfig: join(scratch, 'empty.npmrc'),
      npm_config_update_notifier: 'false', npm_config_ignore_scripts: 'true', npm_config_fetch_retries: '0' },
  });
  const json = args => JSON.parse(invoke(args));
  assert.equal(invoke(['--version']).trim(), manifest.version, 'The remote CLI must report the released package version.');
  json(['audit']);
  assert.equal(existsSync(home), false);
  const installed = json(['install', '--yes']);
  assert.equal(installed.status, 'installed');
  assert.equal(json(['doctor']).ok, true);
  assert.equal(json(['rollback', '--manifest', installed.manifest]).status, 'rolled-back');
  assert.equal(existsSync(join(home, 'config.toml')), false);
  summary(`Remote npm exec verification passed for v${manifest.version}, SHA ${manifest.sha}: public asset checksum, audit, install, doctor, rollback. No model requests were made.`);
  console.log('Public Release installation verification passed.');
} finally {
  const bounded = relative(resolve(tmpdir()), resolve(scratch));
  assert.ok(bounded.startsWith('open-jarvis-release-') && !bounded.startsWith('..'));
  rmSync(scratch, { recursive: true, force: true });
}
