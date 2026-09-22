import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Run via npm run test:package. Uses npm's executable entrypoint on every OS,
// never shell interpolation. The packed CLI runs outside the source checkout.
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this check with npm run test:package.');
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'codex-jarvis-package-'));
const home = join(scratch, 'isolated-home');
const execNpm = (args, cwd = scratch) => execFileSync(process.execPath, [npm, ...args], {
  cwd, encoding: 'utf8', timeout: 60000,
  env: { ...process.env, CODEX_HOME: home, npm_config_update_notifier: 'false' },
});
try {
  const [pack] = JSON.parse(execNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root));
  const paths = pack.files.map(file => file.path);
  assert.ok(paths.includes('bin/codex-jarvis.mjs'));
  assert.ok(paths.includes('payload/agents/jarvis_reviewer.toml'));
  for (const path of paths) {
    assert.match(path, /^(bin\/|src\/|payload\/|docs\/|README(?:\.en)?\.md$|LICENSE$|CHANGELOG\.md$|CONTRIBUTING\.md$|SECURITY\.md$|package\.json$)/);
    assert.doesNotMatch(path, /(?:^|\/)(?:auth\.json|\.env|node_modules|jarvis-state|\.local|sessions)(?:\/|$)/);
  }
  const tarball = join(scratch, pack.filename);
  const invoke = (...args) => JSON.parse(execNpm([
    'exec', '--yes', '--offline', '--ignore-scripts', `--package=${tarball}`, '--',
    'codex-jarvis', ...args, '--home', home, '--json',
  ]));
  invoke('audit');
  assert.equal(existsSync(home), false);
  const installed = invoke('install', '--yes');
  assert.equal(installed.status, 'installed');
  assert.equal(invoke('doctor').ok, true);
  assert.equal(invoke('install', '--yes').status, 'already-installed');
  assert.equal(invoke('rollback', '--manifest', installed.manifest).status, 'rolled-back');
  assert.equal(existsSync(join(home, 'config.toml')), false);
  console.log(JSON.stringify({ status: 'PASS', package: pack.filename, files: paths.length,
    checks: ['allowlisted distribution', 'packed npm exec entrypoint', 'audit', 'install', 'doctor', 'idempotence', 'rollback'],
    scope: 'synthetic home only; no model requests or publication' }, null, 2));
} finally {
  const check = relative(resolve(tmpdir()), resolve(scratch));
  assert.ok(check && !check.startsWith('..') && check.startsWith('codex-jarvis-package-'));
  rmSync(scratch, { recursive: true, force: true });
}
