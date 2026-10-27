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
import { dirname, join, resolve } from 'node:path';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
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
  const refreshed = install({ home });
  assert.equal(refreshed.status, 'installed');
  assert.equal(refreshed.filesChanged, 0);
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
  cpSync(join(process.cwd(), 'src'), join(packageRoot, 'src'), { recursive: true });
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


test('reviewer never and effective controller effort refresh ownership without changing files', () => {
  const { home } = fixture();
  mkdirSync(home);
  writeFileSync(join(home, 'config.toml'), 'approval_policy = "on-request"\nsandbox_mode = "workspace-write"\n');
  const initial = install({ home, models: { controller: { fast: false }, sol: { fast: false } } });
  const initialReceipt = readFileSync(initial.manifest);
  const reviewer = join(home, 'agents/jarvis_reviewer.toml');
  const customized = Buffer.from('approval_policy = "never"\n' + readFileSync(reviewer, 'utf8'));
  writeFileSync(reviewer, customized);
  const config = join(home, 'config.toml');
  const preferredConfig = readFileSync(config, 'utf8').replace('model_reasoning_effort = "high"', 'model_reasoning_effort = "ultra"');
  writeFileSync(config, preferredConfig);
  const personal = join(home, 'jarvis/employees/personal.md');
  mkdirSync(dirname(personal), { recursive: true });
  writeFileSync(personal, 'user-owned sentinel');
  const preview = audit({ home });
  assert.equal(preview.filesChanged, 0);
  assert.equal(preview.ownershipRefresh, true);
  assert.equal(preview.models.controller.effort, 'ultra');
  const refreshed = install({ home });
  assert.equal(refreshed.filesChanged, 0);
  assert.equal(refreshed.status, 'installed');
  const receipt = JSON.parse(readFileSync(refreshed.manifest, 'utf8'));
  assert.equal(receipt.version, 4);
  assert.deepEqual(receipt.files, []);
  assert.equal(receipt.settings.reviewerApprovalPolicy, 'never');
  assert.equal(receipt.settings.models.controller.effort, 'ultra');
  assert.equal(receipt.settings.models.controller.fast, false);
  assert.equal(receipt.settings.models.sol.fast, false);
  assert.deepEqual(readFileSync(initial.manifest), initialReceipt);
  assert.deepEqual(readFileSync(reviewer), customized);
  assert.equal(readFileSync(config, 'utf8'), preferredConfig);
  assert.equal(doctor({ home }).ok, true);
  assert.equal(audit({ home }).ownershipRefresh, false);
  assert.equal(install({ home }).status, 'already-installed');
  assert.equal(rollback({ home, manifest: refreshed.manifest }).filesRestored, 0);
  assert.deepEqual(readFileSync(reviewer), customized);
  assert.equal(readFileSync(config, 'utf8'), preferredConfig);
  assert.equal(readFileSync(personal, 'utf8'), 'user-owned sentinel');
});

test('reviewer customization survives distinct payload upgrade, rollback and re-upgrade', async () => {
  const { root, home } = fixture();
  const previous = install({ home, models: { luna: { fast: false }, sol: { fast: true } } });
  const previousReceipt = readFileSync(previous.manifest);
  const reviewer = join(home, 'agents/jarvis_reviewer.toml');
  writeFileSync(reviewer, 'approval_policy = "never"\n' + readFileSync(reviewer, 'utf8'));
  const original = readFileSync(reviewer);
  const refreshed = install({ home });
  assert.equal(refreshed.filesChanged, 0);
  const refreshReceipt = readFileSync(refreshed.manifest);
  const packageRoot = join(root, 'next-payload');
  mkdirSync(join(packageRoot, 'src'), { recursive: true });
  cpSync(join(process.cwd(), 'src'), join(packageRoot, 'src'), { recursive: true });
  cpSync(join(process.cwd(), 'payload'), join(packageRoot, 'payload'), { recursive: true });
  const nextRole = join(packageRoot, 'payload/agents/jarvis_reviewer.toml');
  writeFileSync(nextRole, readFileSync(nextRole, 'utf8').replace('developer_instructions = """', 'developer_instructions = """\nNext package reviewer policy.'));
  const next = await import(pathToFileURL(join(packageRoot, 'src/installer.mjs')).href);
  const upgrade = next.install({ home });
  const upgradedRole = readFileSync(reviewer);
  assert.match(upgradedRole.toString(), /Next package reviewer policy/);
  assert.equal(parseToml(upgradedRole.toString()).approval_policy, 'never');
  assert.equal(parseToml(upgradedRole.toString()).sandbox_mode, 'read-only');
  assert.equal(next.doctor({ home }).ok, true);
  assert.equal(next.install({ home }).status, 'already-installed');
  next.rollback({ home, manifest: upgrade.manifest });
  assert.deepEqual(readFileSync(reviewer), original);
  assert.deepEqual(readFileSync(previous.manifest), previousReceipt);
  assert.deepEqual(readFileSync(refreshed.manifest), refreshReceipt);
  assert.equal(doctor({ home }).ok, true);
  const again = next.install({ home });
  assert.equal(again.status, 'installed');
  assert.deepEqual(readFileSync(reviewer), upgradedRole);
  assert.equal(next.doctor({ home }).ok, true);
  writeFileSync(reviewer, readFileSync(reviewer, 'utf8') + '\n# later user edit\n');
  const edited = readFileSync(reviewer);
  assert.throws(() => next.rollback({ home, manifest: again.manifest }), /Changed after installation/);
  assert.deepEqual(readFileSync(reviewer), edited);
});

test('ownership refresh rejects unrecognized reviewer changes without writing', () => {
  for (const edit of [
    text => 'approval_policy = "on-request"\n' + text,
    text => 'approval_policy = "never"\n' + text.replace('sandbox_mode = "read-only"', 'sandbox_mode = "workspace-write"'),
    text => 'approval_policy = "never"\nunknown_permission = true\n' + text,
    text => 'approval_policy = "never"\n' + text.replace('developer_instructions = """', 'developer_instructions = """\nUnapproved local instructions.'),
  ]) {
    const { home } = fixture();
    const initial = install({ home });
    const receipt = readFileSync(initial.manifest);
    const reviewer = join(home, 'agents/jarvis_reviewer.toml');
    const changed = edit(readFileSync(reviewer, 'utf8'));
    writeFileSync(reviewer, changed);
    assert.throws(() => install({ home }), /manual merge/);
    assert.equal(readFileSync(reviewer, 'utf8'), changed);
    assert.deepEqual(readFileSync(initial.manifest), receipt);
    assert.equal(doctor({ home }).checks.find(check => check.name === 'role:reviewer').ok, false);
  }
});

test('custom reviewer policy requires a valid installed receipt and rejects invalid stored preferences', () => {
  const { home } = fixture();
  const installed = install({ home });
  const reviewer = join(home, 'agents/jarvis_reviewer.toml');
  writeFileSync(reviewer, 'approval_policy = "never"\n' + readFileSync(reviewer, 'utf8'));
  const manifest = JSON.parse(readFileSync(installed.manifest, 'utf8'));
  manifest.settings.reviewerApprovalPolicy = 'on-request';
  const bad = join(dirname(installed.manifest), 'invalid.json');
  writeFileSync(bad, JSON.stringify(manifest));
  assert.throws(() => audit({ home, previousManifests: [bad] }), /Unsupported reviewer approval/);
  rmSync(join(home, 'jarvis-state'), { recursive: true });
  assert.throws(() => install({ home }), /manual merge/);
});


test('already synchronized package guidance gains fresh ownership without rewriting content', async () => {
  const { root, home } = fixture();
  const initial = install({ home });
  const oldReceipt = readFileSync(initial.manifest);
  const packageRoot = join(root, 'synced-payload');
  mkdirSync(join(packageRoot, 'src'), { recursive: true });
  cpSync(join(process.cwd(), 'src'), join(packageRoot, 'src'), { recursive: true });
  cpSync(join(process.cwd(), 'payload'), join(packageRoot, 'payload'), { recursive: true });
  const skill = 'skills/jarvis-orchestrator/SKILL.md';
  const newSkill = readFileSync(join(packageRoot, 'payload', skill), 'utf8') + '\nNew package guidance.\n';
  writeFileSync(join(packageRoot, 'payload', skill), newSkill);
  writeFileSync(join(home, skill), newSkill);
  const blockPath = join(packageRoot, 'payload/AGENTS.block.md');
  const newBlock = readFileSync(blockPath, 'utf8').replace('<!-- JARVIS_END -->', 'New package contract.\n<!-- JARVIS_END -->');
  writeFileSync(blockPath, newBlock);
  const agents = join(home, 'AGENTS.md');
  const oldAgents = readFileSync(agents, 'utf8');
  const bindingNote = oldAgents.match(/\nJarvis platform:[^\n]+\n/)[0];
  const newAgents = oldAgents.replace(/<!-- JARVIS_START -->[\s\S]*<!-- JARVIS_END -->/, newBlock.trim().replace('<!-- JARVIS_END -->', `${bindingNote}<!-- JARVIS_END -->`));
  writeFileSync(agents, newAgents);
  const next = await import(pathToFileURL(join(packageRoot, 'src/installer.mjs')).href);
  assert.equal(next.audit({ home }).filesChanged, 0);
  assert.equal(next.audit({ home }).ownershipRefresh, true);
  const refresh = next.install({ home });
  assert.deepEqual(JSON.parse(readFileSync(refresh.manifest, 'utf8')).files, []);
  assert.equal(next.install({ home }).status, 'already-installed');
  assert.deepEqual(readFileSync(initial.manifest), oldReceipt);
  next.rollback({ home, manifest: refresh.manifest });
  assert.equal(readFileSync(join(home, skill), 'utf8'), newSkill);
  assert.equal(readFileSync(agents, 'utf8'), newAgents);
});

test('recognized reviewer setting never authorizes unrelated skill or managed-instruction drift', () => {
  for (const relative of ['AGENTS.md', 'skills/jarvis-orchestrator/SKILL.md']) {
    const { home } = fixture();
    install({ home });
    const reviewer = join(home, 'agents/jarvis_reviewer.toml');
    writeFileSync(reviewer, 'approval_policy = "never"\n' + readFileSync(reviewer, 'utf8'));
    const path = join(home, relative);
    const changed = readFileSync(path, 'utf8').replace('Jarvis', 'Unapproved');
    writeFileSync(path, changed);
    assert.throws(() => install({ home }), /manual merge/);
    assert.equal(readFileSync(path, 'utf8'), changed);
  }
});


test('v2 ownership receipts remain readable and refresh to v4 without editing old records', () => {
  const { home } = fixture();
  const initial = install({ home });
  const legacy = JSON.parse(readFileSync(initial.manifest, 'utf8'));
  legacy.version = 2;
  writeFileSync(initial.manifest, JSON.stringify(legacy));
  const legacyBytes = readFileSync(initial.manifest);
  const reviewer = join(home, 'agents/jarvis_reviewer.toml');
  writeFileSync(reviewer, 'approval_policy = "never"\n' + readFileSync(reviewer, 'utf8'));
  const fresh = install({ home });
  const current = JSON.parse(readFileSync(fresh.manifest, 'utf8'));
  assert.equal(current.version, 4);
  assert.equal(current.settings.reviewerApprovalPolicy, 'never');
  assert.deepEqual(readFileSync(initial.manifest), legacyBytes);
  assert.equal(doctor({ home }).ok, true);
  rollback({ home, manifest: fresh.manifest });
  assert.equal(audit({ home }).ownershipRefresh, true);
});


test('reviewer edits between validation and before snapshot refuse the locked ownership refresh', () => {
  const { home } = fixture();
  const initial = install({ home });
  const initialReceipt = readFileSync(initial.manifest);
  const reviewer = join(home, 'agents/jarvis_reviewer.toml');
  const customized = 'approval_policy = "never"\n' + readFileSync(reviewer, 'utf8');
  writeFileSync(reviewer, customized);
  const concurrent = customized + '\n# concurrent local edit\n';
  const originalRead = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (...args) => {
    if (typeof args[0] === 'string' && resolve(args[0]) === resolve(reviewer)) {
      reads += 1;
      // Each plan reads once for renderReviewer, once for collision checking,
      // then once for its before snapshot. Interleave in the locked second plan.
      if (reads === 6) writeFileSync(reviewer, concurrent);
    }
    return originalRead(...args);
  };
  syncBuiltinESMExports();
  try {
    assert.throws(() => install({ home }), /Concurrent edit detected/);
    assert.equal(reads, 6, 'The edit must occur after reviewer validation in the second plan.');
  } finally {
    fs.readFileSync = originalRead;
    syncBuiltinESMExports();
  }
  assert.equal(readFileSync(reviewer, 'utf8'), concurrent);
  assert.deepEqual(readFileSync(initial.manifest), initialReceipt);
});
