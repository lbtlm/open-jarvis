import assert from 'node:assert/strict';
import { realpathSync, mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Run via npm run test:package or pnpm run test:package:pnpm.
// Uses the package manager's executable entrypoint on every OS,
// never shell interpolation. The packed CLI runs outside the source checkout.
const pnpm = process.argv[2] === '--pnpm';
if (process.argv.length > (pnpm ? 3 : 2)) throw new Error('Only --pnpm is supported.');
const manager = process.env.npm_execpath;
if (!manager || !process.env.npm_config_user_agent?.startsWith(pnpm ? 'pnpm/' : 'npm/')) {
  throw new Error('Run this check with npm run test:package or pnpm run test:package:pnpm.');
}
if (/\.(?:cmd|bat)$/i.test(manager)) throw new Error('A package manager JavaScript or native executable entrypoint is required.');
const root = fileURLToPath(new URL('../', import.meta.url));
const suppliedTarball = process.env.OPEN_JARVIS_TARBALL;
if (suppliedTarball !== undefined && (!isAbsolute(suppliedTarball) || !suppliedTarball.endsWith('.tgz') || !lstatSync(suppliedTarball).isFile())) {
  throw new Error('OPEN_JARVIS_TARBALL must name an absolute regular .tgz file.');
}
const tempRoot = realpathSync(tmpdir());
const scratch = mkdtempSync(join(tempRoot, 'open-jarvis-package-'));
const home = join(scratch, 'isolated-home');
const execManager = (args, cwd = scratch) => execFileSync(/\.[cm]?js$/i.test(manager) ? process.execPath : manager,
  /\.[cm]?js$/i.test(manager) ? [manager, ...args] : args, {
  cwd, encoding: 'utf8', timeout: 60000,
  env: { ...process.env, CODEX_HOME: home, npm_config_update_notifier: 'false', npm_config_ignore_scripts: 'true',
    npm_config_fetch_retries: '0', npm_config_fetch_timeout: '15000',
    ...(pnpm ? {
      npm_config_cache_dir: process.env.npm_config_cache_dir ?? join(scratch, 'pnpm-cache'),
      npm_config_store_dir: process.env.npm_config_store_dir ?? join(scratch, 'pnpm-store'),
    } : {}),
  },
});
try {
  let tarball = suppliedTarball;
  if (!tarball) {
    const packed = JSON.parse(execManager(['pack', '--json', '--pack-destination', scratch], root));
    const pack = pnpm ? packed : packed[0];
    tarball = resolve(scratch, pack.filename);
  }
  // Inspect the actual archive for both entry modes; never rebuild a supplied release artifact.
  const readTar = args => execFileSync('tar', args, { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
  const entries = readTar(['-tzf', tarball]).trim().split(/\r?\n/);
  const types = readTar(['-tvzf', tarball]).trim().split(/\r?\n/);
  assert.equal(types.length, entries.length);
  const paths = [];
  const seen = new Set();
  entries.forEach((entry, index) => {
    assert.match(entry, /^package\//);
    assert.ok(!entry.includes('\\') && !entry.split('/').some(part => part === '..' || part === '.'));
    assert.ok(!seen.has(entry), 'Duplicate archive entry');
    seen.add(entry);
    assert.match(types[index], /^[-d]/, 'Archive links and special files are not allowed');
    if (types[index].startsWith('d')) return;
    paths.push(entry.slice('package/'.length));
  });
  const manifest = JSON.parse(readTar(['-xOzf', tarball, 'package/package.json']));
  const expected = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.name, expected.name);
  assert.equal(manifest.version, expected.version);
  assert.deepEqual(manifest.bin, { 'open-jarvis': 'bin/open-jarvis.mjs' });
  assert.ok(paths.includes('bin/open-jarvis.mjs'));
  assert.ok(paths.includes('payload/agents/jarvis_reviewer.toml'));
  assert.ok(paths.includes('payload/skills/jarvis-orchestrator/references/employees.md'));
  assert.ok(paths.includes('payload/skills/jarvis-orchestrator/references/employee-card.md'));
  assert.ok(paths.includes('payload/skills/jarvis-orchestrator/references/assets.md'));
  assert.ok(paths.includes('payload/employees/nova-writer.md'));
  for (const file of ['README.md', 'README.en.md', 'README.zh-CN.md', 'README.ja.md']) assert.ok(paths.includes(file));
  for (const path of paths) {
    assert.match(path, /^(bin\/|src\/|payload\/|docs\/|README(?:\.(?:en|zh-CN|ja))?\.md$|LICENSE$|CHANGELOG\.md$|CONTRIBUTING\.md$|SECURITY\.md$|package\.json$)/);
    assert.doesNotMatch(path, /(?:^|\/)(?:auth\.json|\.env|node_modules|jarvis-state|\.local|sessions)(?:\/|$)/);
  }
  const invokeAt = (targetHome, args) => JSON.parse(execManager(pnpm ? [
    '--silent', `--package=${tarball}`, 'dlx',
    'open-jarvis', ...args, '--home', targetHome, '--json',
  ] : [
    'exec', '--yes', '--ignore-scripts', `--package=${tarball}`, '--',
    'open-jarvis', ...args, '--home', targetHome, '--json',
  ]));
  const invoke = (...args) => invokeAt(home, args);
  invoke('audit');
  assert.equal(existsSync(home), false);
  const installed = invoke('install', '--yes');
  assert.equal(installed.status, 'installed');
  assert.equal(invoke('doctor').ok, true);
  assert.equal(invoke('install', '--yes').status, 'already-installed');
  assert.equal(invoke('employees').employees.length, 0);
  assert.equal(invoke('install', '--starter', 'writing', '--yes').status, 'already-installed');
  assert.equal(invoke('employees', '--query', 'writing').employees.length, 1);
  assert.equal(invoke('employees', '--init', '--yes').created.length, 4);
  assert.equal(invoke('plan', '--employee', 'atlas-backend', '--difficulty', 'simple').requested.effort, 'low');
  const bundle = join(scratch, 'team.jarvis.json.gz');
  mkdirSync(join(home, 'jarvis/resources'), { recursive: true });
  writeFileSync(join(home, 'jarvis/resources/template.bin'), Buffer.from([0, 255, 23]));
  assert.equal(invoke('export', '--out', bundle).status, 'exported');
  const secondHome = join(scratch, 'second-home');
  const second = (...args) => invokeAt(secondHome, args);
  assert.equal(second('import', '--from', bundle).status, 'preview');
  assert.equal(existsSync(secondHome), false);
  assert.equal(second('import', '--from', bundle, '--yes').status, 'imported');
  assert.deepEqual(readFileSync(join(secondHome, 'jarvis/resources/template.bin')), Buffer.from([0, 255, 23]));
  assert.equal(second('install', '--models', join(secondHome, 'jarvis/models.json'), '--yes').status, 'installed');
  assert.equal(second('employees', '--query', 'backend').employees.length, 1);
  assert.equal(second('plan', '--employee', 'atlas-backend', '--difficulty', 'complex').requested.model, 'gpt-6.1-sol');
  assert.equal(invoke('rollback', '--manifest', installed.manifest).status, 'rolled-back');
  assert.equal(existsSync(join(home, 'config.toml')), false);
  console.log(JSON.stringify({ status: 'PASS', runner: pnpm ? 'pnpm dlx' : 'npm exec', package: tarball, files: paths.length,
    checks: ['allowlisted distribution', `packed ${pnpm ? 'pnpm dlx' : 'npm exec'} entrypoint`, 'audit', 'install', 'doctor', 'idempotence', 'employee reuse', 'export/import', 'destination activation', 'rollback'],
    scope: 'synthetic home only; no model requests or publication' }, null, 2));
} finally {
  const check = relative(tempRoot, realpathSync(scratch));
  assert.ok(check && !check.startsWith('..') && check.startsWith('open-jarvis-package-'));
  rmSync(scratch, { recursive: true, force: true });
}
