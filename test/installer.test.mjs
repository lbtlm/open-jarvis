import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { audit, defaultModels, doctor, install, recommend, rollback } from '../src/installer.mjs';

const roots = new Set();

test('GPT-6 upgrade is explicit and preserves saved legacy mappings and Fast preferences', () => {
  const { home } = fixture();
  install({home, models:{
    luna:{model:'gpt-5.6-luna', effort:'medium', fast:true},
    terra:{model:'gpt-5.6-terra', effort:'medium'},
    sol:{model:'gpt-5.6-sol', effort:'high', fast:false},
    reviewer:{model:'gpt-5.6-sol', effort:'high'},
  }});
  assert.equal(install({home}).status, 'already-installed');
  assert.equal(recommend({home}).models.terra.model, 'gpt-5.6-terra');
  const upgrade = install({home, models:{
    luna:{model:'gpt-6-luna'}, terra:{model:'gpt-6-sol'}, sol:{model:'gpt-6-sol'}, reviewer:{model:'gpt-6-sol'},
  }});
  assert.equal(upgrade.status, 'installed');
  assert.equal(doctor({home}).ok, true);
  const choices = recommend({home}).models;
  assert.equal(choices.luna.fast, true);
  assert.equal(choices.sol.fast, false);
  assert.equal(Object.hasOwn(choices.terra, 'fast'), false);
  assert.equal(choices.terra.effort, 'medium');
  assert.equal(choices.sol.effort, 'high');
  rollback({home, manifest:upgrade.manifest});
  assert.equal(recommend({home}).models.luna.model, 'gpt-5.6-luna');
});

test('unsupported GPT-6 efforts fail without writes, including inherited controller effort', () => {
  const { home } = fixture();
  assert.throws(() => install({home, models:{luna:{model:'gpt-6-luna', effort:'ultra'}}}), /does not support/);
  assert.equal(existsSync(home), false);
  mkdirSync(home);
  const original = 'model = "gpt-6-astra"\nmodel_reasoning_effort = "ultra"\n';
  writeFileSync(join(home,'config.toml'), original);
  assert.throws(() => install({home, models:{controller:{model:'gpt-6-luna'}}}), /choose a supported effort explicitly/);
  assert.equal(readFileSync(join(home,'config.toml'),'utf8'), original);
  assert.equal(existsSync(join(home,'AGENTS.md')), false);
});

test('employee guidance is managed while retained cards and external skills stay user-owned', () => {
  const { home } = fixture();
  const cardPath = join(home, 'jarvis/employees/iris.md');
  const externalPath = join(home, 'skills/external-example/SKILL.md');
  mkdirSync(dirname(cardPath), { recursive: true });
  mkdirSync(dirname(externalPath), { recursive: true });
  writeFileSync(cardPath, 'Personal approved employee card.');
  writeFileSync(externalPath, 'External skill owned by its user.');
  const installed = install({ home });
  const report = doctor({ home });
  assert.equal(report.ok, true);
  for (const name of ['employees', 'employee-card', 'assets', 'domains']) {
    assert.equal(report.checks.find(check => check.name === `skill:${name}`).ok, true);
    const relative = `skills/jarvis-orchestrator/references/${name}.md`;
    assert.equal(audit({ home }).files.some(file => file.path === relative), true);
    const path = join(home, relative);
    const original = readFileSync(path);
    writeFileSync(path, 'Changed guidance');
    assert.equal(doctor({ home }).checks.find(check => check.name === `skill:${name}`).ok, false);
    writeFileSync(path, original);
  }
  assert.equal(install({ home }).status, 'already-installed');
  rollback({ home, manifest: installed.manifest });
  assert.equal(existsSync(join(home, 'skills/jarvis-orchestrator/references/employees.md')), false);
  assert.equal(existsSync(join(home, 'skills/jarvis-orchestrator/references/employee-card.md')), false);
  assert.equal(readFileSync(cardPath, 'utf8'), 'Personal approved employee card.');
  assert.equal(readFileSync(externalPath, 'utf8'), 'External skill owned by its user.');
});

test('existing Codex concurrency is preserved independently of the Jarvis ceiling', () => {
  for (const concurrency of [1, 2, 3, 8]) {
    const { home } = fixture();
    mkdirSync(home);
    const configPath = join(home, 'config.toml');
    const line = `max_concurrent_threads_per_session = ${concurrency} # user choice`;
    writeFileSync(configPath, `[agents]\n${line}\n`);
    const preview = audit({ home });
    assert.equal(preview.codexMaxSubagents, concurrency);
    assert.equal(preview.maxSubagents, Math.min(3, concurrency));
    const installed = install({ home });
    assert.ok(readFileSync(configPath, 'utf8').includes(line));
    assert.equal(doctor({ home }).ok, true);
    assert.equal(audit({ home }).filesChanged, 0);
    rollback({ home, manifest: installed.manifest });
    assert.equal(readFileSync(configPath, 'utf8'), `[agents]\n${line}\n`);
  }
});

test('invalid existing concurrency fails before changing the home', () => {
  for (const value of ['0', '-1', '1.5', '"3"']) {
    const { home } = fixture();
    mkdirSync(home);
    const original = `[agents]\nmax_concurrent_threads_per_session = ${value}\n`;
    writeFileSync(join(home, 'config.toml'), original);
    assert.throws(() => install({ home }), /must be a positive integer/);
    assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), original);
    assert.equal(existsSync(join(home, 'AGENTS.md')), false);
  }
});

function fixture() {
  const root = mkdtempSync(join(process.cwd(), '.installer-test-'));
  roots.add(root);
  return { root, home: join(root, 'home') };
}

test.afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

test('audit preserves unrelated TOML and reports effective sanitized settings without writing', () => {
  const { home } = fixture();
  mkdirSync(home);
  const original = [
    '# keep this comment',
    'model = "older"',
    'model_reasoning_effort = "xhigh"',
    'service_tier = "default"',
    '[mcp_servers.example.env]',
    'PRIVATE_VALUE = "do-not-print"',
    '[agents]',
    'enabled = false',
    '[agents.existing]',
    'config_file = "old.toml"',
    '',
  ].join('\n');
  writeFileSync(join(home, 'config.toml'), original);

  const result = audit({ home });

  assert.equal(result.status, 'validated-candidate');
  assert.equal(result.models.controller.effort, 'xhigh');
  assert.equal(result.maxSubagents, 3);
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), original);
  assert.equal(existsSync(join(home, 'AGENTS.md')), false);
  assert.equal(JSON.stringify(result).includes('do-not-print'), false);
});

test('install is idempotent, preserves custom mappings automatically, and doctor ignores later controller effort choice', () => {
  const { home } = fixture();
  const first = install({
    home,
    models: {
      luna: { model: 'example/luna-private', effort: 'low' },
      controller: { model: 'example/controller', effort: 'high' },
    },
  });
  assert.equal(first.status, 'installed');
  assert.equal(parseToml(readFileSync(join(home, 'agents/jarvis_luna.toml'), 'utf8')).model, 'example/luna-private');

  assert.equal(install({ home }).status, 'already-installed');
  const configPath = join(home, 'config.toml');
  writeFileSync(configPath, readFileSync(configPath, 'utf8').replace('model_reasoning_effort = "high"', 'model_reasoning_effort = "xhigh"'));
  const report = doctor({ home });
  assert.equal(report.ok, true);
  assert.equal(report.runtimeVerification, 'not-performed');
  assert.match(report.runtimeNote, /does not prove/i);
  assert.equal(install({ home }).status, 'already-installed');
});

test('install preserves existing file permissions and rollback restores exact content', { skip: process.platform === 'win32' }, () => {
  const { home } = fixture();
  mkdirSync(home);
  const configPath = join(home, 'config.toml');
  const before = Buffer.from('model = "old"\nservice_tier = "default"\n');
  writeFileSync(configPath, before, { mode: 0o640 });
  chmodSync(configPath, 0o640);
  const installed = install({ home });
  assert.equal(statSync(configPath).mode & 0o777, 0o640);
  const restored = rollback({ home, manifest: installed.manifest });
  assert.equal(restored.status, 'rolled-back');
  assert.deepEqual(readFileSync(configPath), before);
  assert.equal(statSync(configPath).mode & 0o777, 0o640);
});

test('recommend is read-only and fast choices render and persist for every role', () => {
  const { home } = fixture();
  const fresh = recommend({ home });
  assert.equal(existsSync(home), false);
  assert.equal(fresh.serviceTier, 'default');
  assert.ok(Object.values(fresh.models).every(value => value.fast === false));
  const freshFast = recommend({ home, models: { controller: { fast: true }, luna: { fast: true } } });
  assert.equal(freshFast.models.controller.fast, true);
  assert.equal(freshFast.models.luna.fast, true);
  assert.equal(freshFast.models.terra.fast, false);

  const installed = install({
    home,
    models: {
      controller: { fast: true },
      luna: { fast: true },
      terra: { fast: false },
      sol: { fast: false },
      reviewer: { fast: true },
    },
  });
  assert.equal(installed.status, 'installed');
  const config = parseToml(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(config.service_tier, 'fast');
  assert.equal(config.features.fast_mode, true);
  const luna = parseToml(readFileSync(join(home, 'agents/jarvis_luna.toml'), 'utf8'));
  const terra = parseToml(readFileSync(join(home, 'agents/jarvis_terra.toml'), 'utf8'));
  assert.equal(luna.service_tier, 'fast');
  assert.equal(luna.features.fast_mode, true);
  assert.equal(terra.service_tier, 'default');
  assert.equal(terra.features, undefined);

  assert.equal(install({ home }).status, 'already-installed');
  assert.equal(recommend({ home }).models.reviewer.fast, true);
  const preview = audit({ home });
  assert.equal(preview.models.controller.fast, true);
  assert.equal(preview.serviceTier, 'fast');

  install({ home, models: { controller: { fast: false }, luna: { fast: false } } });
  const slowed = parseToml(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(slowed.service_tier, 'default');
  assert.equal(slowed.features.fast_mode, true, 'fast:false must not disable an existing parent feature');
  const slowedLuna = parseToml(readFileSync(join(home, 'agents/jarvis_luna.toml'), 'utf8'));
  assert.equal(slowedLuna.service_tier, 'default');
  assert.equal(slowedLuna.features, undefined);
});

test('doctor detects reviewer sandbox and owned skill drift', () => {
  const first = fixture();
  install({ home: first.home });
  const reviewerPath = join(first.home, 'agents/jarvis_reviewer.toml');
  writeFileSync(reviewerPath, readFileSync(reviewerPath, 'utf8').replace('sandbox_mode = "read-only"', 'sandbox_mode = "workspace-write"'));
  const reviewerReport = doctor({ home: first.home });
  assert.equal(reviewerReport.ok, false);
  assert.equal(reviewerReport.checks.find(check => check.name === 'role:reviewer').ok, false);

  const second = fixture();
  install({ home: second.home });
  writeFileSync(join(second.home, 'skills/jarvis-orchestrator/references/lifecycle.md'), '');
  const skillReport = doctor({ home: second.home });
  assert.equal(skillReport.ok, false);
  assert.equal(skillReport.checks.find(check => check.name === 'skill:lifecycle').ok, false);
});

test('doctor detects package payload drift and upgrade preserves stored role selections', () => {
  const { home } = fixture();
  const selections = {
    controller: { model: 'example/astra', effort: 'xhigh', fast: true },
    luna: { model: 'example/luna', effort: 'low', fast: false },
    terra: { model: 'example/terra', effort: 'medium', fast: true },
    sol: { model: 'example/sol', effort: 'high', fast: false },
    reviewer: { model: 'example/reviewer', effort: 'max', fast: true },
  };
  const installed = install({ home, models: selections });
  const roleRelative = 'agents/jarvis_luna.toml';
  const rolePath = join(home, ...roleRelative.split('/'));
  const currentRole = readFileSync(rolePath, 'utf8');
  const oldRole = currentRole.replace(/developer_instructions = """\r?\n/, '$&Legacy package policy.\n');
  assert.notEqual(oldRole, currentRole);
  writeFileSync(rolePath, oldRole);

  const oldManifest = JSON.parse(readFileSync(installed.manifest, 'utf8'));
  const oldHash = createHash('sha256').update(oldRole).digest('hex');
  oldManifest.files.find(record => record.path === roleRelative).after = oldHash;
  oldManifest.ownedFiles.find(record => record.path === roleRelative).sha256 = oldHash;
  writeFileSync(installed.manifest, JSON.stringify(oldManifest, null, 2));

  const drifted = doctor({ home });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.staticValidation, 'drift-detected');
  assert.equal(drifted.runtimeVerification, 'not-performed');
  assert.equal(drifted.checks.find(check => check.name === 'role:luna').ok, false);

  const upgraded = install({ home });
  assert.equal(upgraded.status, 'installed');
  for (const [key, selected] of Object.entries(selections).filter(([key]) => key !== 'controller')) {
    const role = parseToml(readFileSync(join(home, `agents/jarvis_${key}.toml`), 'utf8'));
    assert.equal(role.model, selected.model);
    assert.equal(role.model_reasoning_effort, selected.effort);
    assert.equal(role.service_tier, selected.fast ? 'fast' : 'default');
    assert.equal(role.features?.fast_mode === true, selected.fast);
  }
  const config = parseToml(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(config.model, selections.controller.model);
  assert.equal(config.model_reasoning_effort, selections.controller.effort);
  assert.equal(config.service_tier, 'fast');
  assert.equal(config.features.fast_mode, true);
  const healthy = doctor({ home });
  assert.equal(healthy.ok, true);
  assert.equal(healthy.staticValidation, 'healthy');
});

test('install renders CRLF package roles as valid consistent TOML', async () => {
  const { root, home } = fixture();
  const packageRoot = join(root, 'crlf-package');
  mkdirSync(join(packageRoot, 'src'), { recursive: true });
  cpSync(join(process.cwd(), 'src/installer.mjs'), join(packageRoot, 'src/installer.mjs'));
  cpSync(join(process.cwd(), 'src/profiles.mjs'), join(packageRoot, 'src/profiles.mjs'));
  cpSync(join(process.cwd(), 'payload'), join(packageRoot, 'payload'), { recursive: true });
  const payloadRole = join(packageRoot, 'payload/agents/jarvis_luna.toml');
  writeFileSync(payloadRole, readFileSync(payloadRole, 'utf8').replace(/\r?\n/g, '\r\n'));

  const copiedInstaller = await import(pathToFileURL(join(packageRoot, 'src/installer.mjs')).href);
  const result = copiedInstaller.install({ home });
  assert.equal(result.status, 'installed');
  const installedRole = readFileSync(join(home, 'agents/jarvis_luna.toml'), 'utf8');
  assert.equal(installedRole.includes('\r'), false);
  assert.equal(parseToml(installedRole).name, 'jarvis_luna');
});

test('rollback rejects later user edits before restoring any file', () => {
  const { home } = fixture();
  const installed = install({ home });
  const configPath = join(home, 'config.toml');
  const configAfterInstall = readFileSync(configPath);
  const rolePath = join(home, 'agents/jarvis_luna.toml');
  writeFileSync(rolePath, Buffer.concat([readFileSync(rolePath), Buffer.from('\n# user edit\n')]));
  assert.throws(() => rollback({ home, manifest: installed.manifest }), /Changed after installation/);
  assert.deepEqual(readFileSync(configPath), configAfterInstall);
  assert.match(readFileSync(rolePath, 'utf8'), /user edit/);
});

test('rollback rejects a tampered backup before changing targets', () => {
  const { home } = fixture();
  mkdirSync(home);
  writeFileSync(join(home, 'config.toml'), 'model = "old"\n');
  const installed = install({ home });
  const configAfterInstall = readFileSync(join(home, 'config.toml'));
  writeFileSync(join(dirname(installed.manifest), 'original', 'config.toml'), 'tampered');
  assert.throws(() => rollback({ home, manifest: installed.manifest }), /Backup checksum mismatch/);
  assert.deepEqual(readFileSync(join(home, 'config.toml')), configAfterInstall);
});

test('owned upgrade changes mappings but refuses modified aggregate files', () => {
  const { home } = fixture();
  install({ home });
  const upgraded = install({ home, models: { terra: { model: 'example/terra', effort: 'high' } } });
  assert.equal(upgraded.status, 'installed');
  assert.equal(parseToml(readFileSync(join(home, 'config.toml'), 'utf8')).agents.default_subagent_model, 'example/terra');
  const instructions = join(home, 'AGENTS.md');
  writeFileSync(instructions, readFileSync(instructions, 'utf8').replace('## Jarvis', '## Customized Jarvis'));
  assert.throws(() => install({ home, models: { sol: { model: 'example/sol' } } }), /Modified aggregate file/);
});

test('legacy settings and invalid mapping values are rejected without edits', () => {
  const { home } = fixture();
  mkdirSync(home);
  const legacy = '[agents]\nmax_threads = 8\n';
  writeFileSync(join(home, 'config.toml'), legacy);
  assert.throws(() => install({ home }), /Legacy agents\.max_threads/);
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), legacy);
  assert.throws(() => audit({ home: join(fixture().root, 'other'), models: { luna: { effort: 'magic' } } }), /Unknown reasoning effort/);
  assert.throws(() => audit({ home: join(fixture().root, 'other'), models: { toString: { model: 'bad' } } }), /Unknown model mapping key/);
  assert.throws(() => audit({ home: join(fixture().root, 'other'), models: { luna: { model: 'bad model' } } }), /whitespace or control/);
  assert.throws(() => audit({ home: join(fixture().root, 'other'), models: { luna: { fast: 'yes' } } }), /fast must be boolean/);
});

test('existing operation lock is never deleted or bypassed', () => {
  const { home } = fixture();
  mkdirSync(join(home, 'jarvis-state'), { recursive: true });
  const lock = join(home, 'jarvis-state', 'install.lock');
  writeFileSync(lock, 'owner-from-another-process');
  assert.throws(() => install({ home }), /lock already exists/);
  assert.equal(readFileSync(lock, 'utf8'), 'owner-from-another-process');
});

test('manifest traversal, unmanaged paths and duplicate records are rejected', () => {
  const { root, home } = fixture();
  const installed = install({ home });
  const manifest = JSON.parse(readFileSync(installed.manifest, 'utf8'));
  const badPath = join(root, 'bad-path.json');
  manifest.files[0].path = '../outside';
  writeFileSync(badPath, JSON.stringify(manifest));
  assert.throws(() => rollback({ home, manifest: badPath }), /Path escapes target/);

  const unmanaged = JSON.parse(readFileSync(installed.manifest, 'utf8'));
  unmanaged.files[0].path = 'auth.json';
  const unmanagedPath = join(root, 'unmanaged.json');
  writeFileSync(unmanagedPath, JSON.stringify(unmanaged));
  assert.throws(() => rollback({ home, manifest: unmanagedPath }), /unmanaged path/);

  const duplicate = JSON.parse(readFileSync(installed.manifest, 'utf8'));
  duplicate.files.push({ ...duplicate.files[0] });
  const duplicatePath = join(root, 'duplicate.json');
  writeFileSync(duplicatePath, JSON.stringify(duplicate));
  assert.throws(() => rollback({ home, manifest: duplicatePath }), /duplicate path/);
});

test('explicit Python v1 manifest grants migration ownership', () => {
  const { root, home } = fixture();
  const installed = install({ home });
  const v2 = JSON.parse(readFileSync(installed.manifest, 'utf8'));
  const v1 = {
    version: 1,
    home,
    status: 'installed',
    files: v2.ownedFiles.map(file => ({ path: file.path, before: null, after: file.sha256 })),
  };
  const v1Path = join(root, 'python-v1.json');
  writeFileSync(v1Path, JSON.stringify(v1));
  rmSync(join(home, 'jarvis-state'), { recursive: true });
  const migrated = install({ home, previousManifests: [v1Path], models: { controller: { model: 'example/astra' } } });
  assert.equal(migrated.status, 'installed');
  assert.equal(parseToml(readFileSync(join(home, 'config.toml'), 'utf8')).model, 'example/astra');
});

test('symlink or junction targets are refused', () => {
  const { root, home } = fixture();
  const outside = join(root, 'outside');
  mkdirSync(home);
  mkdirSync(outside);
  symlinkSync(outside, join(home, 'agents'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => audit({ home }), /symlink or junction/);
  assert.deepEqual(defaultModels.reviewer, { model: 'gpt-6.1-sol', effort: 'high' });
});
