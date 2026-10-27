import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { audit, install, doctor, rollback } from '../src/installer.mjs';
import { seedEmployees, listEmployees, planTask } from '../src/team.mjs';
import { approveExperience, resolveExperience, searchExperience } from '../src/experience.mjs';
import { exportAssets, importAssets } from '../src/assets.mjs';
import { resolveAssetsHome } from '../src/asset-root.mjs';
import { nativeModels, platformAdapter } from '../src/platforms/index.mjs';

function fixture(t) {
  const root = mkdtempSync(join(process.cwd(), '.platform-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function snapshot(root) {
  if (!existsSync(root)) return {};
  const result = {};
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) for (const [name, hash] of Object.entries(snapshot(path))) result[`${entry.name}/${name}`] = hash;
    else result[entry.name] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return result;
}

test('all four platforms share protected install, static doctor, idempotence and rollback without touching shared assets', t => {
  const root = fixture(t), assetsHome = join(root, 'shared');
  seedEmployees({ assetsHome, starter: 'development', apply: true });
  const assetsBefore = snapshot(assetsHome);
  for (const platform of ['codex', 'workbuddy', 'claude-code', 'cursor']) {
    const home = join(root, platform), options = { home, platform, assetsHome };
    const preview = audit(options);
    assert.equal(existsSync(home), false);
    assert.equal(preview.platform, platform);
    const installed = install(options);
    assert.equal(installed.assetsHome, assetsHome);
    assert.equal(JSON.parse(readFileSync(installed.manifest)).platform, platform);
    const health = doctor(options);
    assert.equal(health.ok, true, JSON.stringify(health.checks));
    assert.equal(health.runtimeVerification, 'not-performed');
    assert.equal(install(options).status, 'already-installed');
    assert.equal(planTask({ ...options, employee: 'iris-frontend', difficulty: 'standard', skills: ['jarvis-orchestrator'] }).dispatched, false);
    assert.equal(existsSync(join(home, platform === 'codex' ? 'agents/jarvis_terra.toml' : 'agents/jarvis-terra.md')), true);
    if (platform !== 'codex') assert.equal(existsSync(join(home, 'config.toml')), false);
    if (platform !== 'codex') {
      assert.match(readFileSync(join(home, 'agents/jarvis-sol.md'), 'utf8'), /name: "jarvis-sol"/);
      assert.equal(planTask({ ...options, employee: 'iris-frontend', difficulty: 'complex' }).role, 'jarvis-sol');
    }
    if (platform === 'cursor') {
      assert.equal(existsSync(join(home, 'rules')), false);
      assert.equal(health.capabilities.activation, '/jarvis-orchestrator');
    }
    assert.equal(rollback({ ...options, manifest: installed.manifest }).status, 'rolled-back');
    assert.deepEqual(snapshot(assetsHome), assetsBefore);
    assert.equal(existsSync(join(home, 'jarvis-platform.json')), false);
  }
});

test('shared employees and approved experience are visible immediately across native homes and saved bindings', t => {
  const root = fixture(t), assetsHome = join(root, 'shared');
  const first = { home: join(root, 'claude'), platform: 'claude-code', assetsHome };
  const second = { home: join(root, 'cursor'), platform: 'cursor', assetsHome };
  install(first); install(second);
  seedEmployees({ ...first, starter: 'writing', apply: true });
  const cards = listEmployees({ home: second.home });
  assert.equal(cards[0].path, join(assetsHome, 'employees/nova-writer.md'));
  const from = join(root, 'candidate.md');
  const metadata = { kind: 'jarvis-experience', id: 'shared-method', title: 'Shared method', scope: 'personal', state: 'draft', tags: ['shared'], contributors: ['Nova'], verifiedOn: '2026-10-27' };
  writeFileSync(from, `---\n${JSON.stringify(metadata)}\n---\n# Shared method\n\n## Applicability\nA task.\n## Method\nVerified method.\n## Limits\nLocal only.\n## Evidence\nIsolated test.\n`);
  const preview = approveExperience({ ...first, scope: 'personal', from });
  approveExperience({ ...first, scope: 'personal', from, apply: true, sourceSha256: preview.sourceSha256 });
  const found = searchExperience({ home: second.home });
  assert.equal(found.experiences[0].path, join(assetsHome, 'knowledge/experience/shared-method.md'));
  assert.equal(resolveExperience({ home: second.home }, 'personal:shared-method').sha256, preview.sha256);
  assert.equal(planTask({ home: second.home, platform: second.platform, employee: 'nova-writer', difficulty: 'simple', experiences: ['personal:shared-method'] }).selectedExperience.length, 1);
});

test('platform receipts cannot grant ownership or rollback another platform even at the same home', t => {
  const root = fixture(t), options = { home: join(root, 'home'), assetsHome: join(root, 'shared'), platform: 'codex' };
  const installed = install(options), before = snapshot(options.home);
  assert.throws(() => audit({ ...options, platform: 'cursor', previousManifests: [installed.manifest] }), /another platform/);
  assert.throws(() => rollback({ ...options, platform: 'workbuddy', manifest: installed.manifest }), /another platform/);
  assert.deepEqual(snapshot(options.home), before);
  const native = { home: join(root, 'workbuddy'), assetsHome: options.assetsHome, platform: 'workbuddy' };
  const second = install(native);
  const downgraded = JSON.parse(readFileSync(second.manifest));
  downgraded.version = 3;
  const invalid = join(root, 'invalid-legacy.json');
  writeFileSync(invalid, JSON.stringify(downgraded));
  assert.throws(() => audit({ ...native, previousManifests: [invalid] }), /another platform/);
  assert.throws(() => rollback({ ...native, manifest: invalid }), /another platform/);
});

test('native settings never silently convert effort or speed and reviewer controls stay distinct', t => {
  const root = fixture(t);
  for (const platform of ['workbuddy', 'claude-code', 'cursor']) {
    const options = { home: join(root, platform), assetsHome: join(root, 'shared'), platform };
    assert.throws(() => audit({ ...options, models: { controller: { model: 'some-model' } } }), /controller settings/);
    assert.throws(() => audit({ ...options, models: { sol: { effort: 'high' } } }), /explicit model/);
    assert.throws(() => audit({ ...options, models: { sol: { model: 'some-model', effort: 'ultra' } } }), /Unsupported/);
    if (platform !== 'cursor') assert.throws(() => audit({ ...options, models: { sol: { model: 'some-model', fast: false } } }), /Fast cannot/);
    const models = { sol: { model: 'some-model', effort: 'high', ...(platform === 'cursor' ? { fast: false } : {}) } };
    install({ ...options, models });
    seedEmployees({ ...options, apply: true });
    const plan = planTask({ ...options, employee: 'iris-frontend', difficulty: 'complex' });
    assert.equal(plan.installed.model, 'some-model');
    assert.equal(plan.installed.effort, 'high');
    assert.equal(plan.runtimeVerified, false);
    if (platform === 'cursor') assert.match(readFileSync(join(options.home, 'agents/jarvis-sol.md'), 'utf8'), /some-model\[effort=high,fast=false\]/);
    const reviewer = planTask({ ...options, employee: 'sentry-review', difficulty: 'complex' });
    assert.equal(reviewer.reviewerControl, platform === 'cursor' ? 'readonly-requested' : 'tools-restricted');
    const path = join(options.home, 'agents/jarvis-reviewer.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace(platform === 'cursor' ? 'readonly: true' : 'tools: "Read, Grep, Glob"', platform === 'cursor' ? 'readonly: false' : 'tools: "Read, Write"'));
    assert.equal(doctor(options).ok, false);
    assert.throws(() => planTask({ ...options, employee: 'sentry-review', difficulty: 'complex' }), /Reviewer/);
  }
});

test('asset roots retain legacy Codex assets, detect split libraries, and reuse saved cross-client bindings', t => {
  const root = fixture(t), userHome = join(root, 'user'), codex = join(userHome, '.codex'), legacy = join(codex, 'jarvis');
  mkdirSync(legacy, { recursive: true });
  const env = {};
  assert.equal(resolveAssetsHome({ home: join(userHome, '.claude'), platform: 'claude-code', userHome, env }), legacy);
  mkdirSync(join(userHome, '.jarvis'));
  assert.throws(() => resolveAssetsHome({ home: codex, userHome, env }), /Both legacy/);
  const chosen = join(root, 'chosen');
  assert.equal(resolveAssetsHome({ home: codex, assetsHome: chosen, userHome, env }), chosen);
  rmSync(join(userHome, '.jarvis'), { recursive: true });
  install({ home: codex, assetsHome: legacy });
  assert.equal(resolveAssetsHome({ home: join(userHome, '.cursor'), platform: 'cursor', userHome, env }), legacy);
  const options = { home: join(root, 'other'), platform: 'cursor', assetsHome: chosen };
  install(options);
  assert.equal(resolveAssetsHome({ home: options.home, platform: 'cursor', userHome, env }), chosen);
});

test('portable bundles map shared assets without overwrites and keep source-platform model preferences inactive', t => {
  const root = fixture(t), source = { home: join(root, 'source'), assetsHome: join(root, 'shared-source'), platform: 'claude-code' };
  seedEmployees({ ...source, starter: 'writing', apply: true });
  const out = join(root, 'assets.gz');
  exportAssets({ ...source, out, models: { sol: { model: 'sonnet', effort: 'high' } } });
  const destination = { home: join(root, 'cursor'), assetsHome: join(root, 'shared-target'), platform: 'cursor', from: out };
  const imported = importAssets({ ...destination, apply: true });
  assert.equal(imported.sourcePlatform, 'claude-code');
  assert.equal(imported.modelPreferencesApplied, false);
  assert.equal(existsSync(join(destination.assetsHome, 'models.claude-code.json')), true);
  assert.equal(existsSync(join(destination.home, 'agents')), false);
  const card = join(destination.assetsHome, 'employees/nova-writer.md');
  writeFileSync(card, 'User revision');
  const before = snapshot(destination.assetsHome);
  assert.equal(importAssets({ ...destination, apply: true }).status, 'conflicts');
  assert.deepEqual(snapshot(destination.assetsHome), before);
});

test('CLI saves the selected shared root and later cross-platform commands read the same card', t => {
  const root = fixture(t), assetsHome = join(root, 'shared'), home = join(root, 'workbuddy');
  const cli = (...args) => spawnSync(process.execPath, ['bin/open-jarvis.mjs', ...args, '--json'], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, JARVIS_HOME: '' } });
  const installed = cli('install', '--platform', 'workbuddy', '--home', home, '--assets-home', assetsHome, '--starter', 'writing', '--yes');
  assert.equal(installed.status, 0, installed.stderr);
  const listed = cli('employees', '--platform', 'workbuddy', '--home', home);
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).employees[0].path, join(assetsHome, 'employees/nova-writer.md'));
  const second = cli('employees', '--platform', 'cursor', '--home', join(root, 'cursor'), '--assets-home', assetsHome);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).employees[0].path, JSON.parse(listed.stdout).employees[0].path);
});

test('native root ancestor junctions block audit, install and rollback with independent shared assets', t => {
  const root = fixture(t), actual = join(root, 'actual'), alias = join(root, 'linked-parent'), assetsHome = join(root, 'shared');
  mkdirSync(actual);
  const installed = ['codex', 'workbuddy', 'claude-code', 'cursor'].map(platform => ({ platform,
    result: install({ home: join(actual, platform), platform, assetsHome }) }));
  symlinkSync(actual, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const before = snapshot(actual);
  for (const { platform, result } of installed) {
    const options = { platform, home: join(alias, platform), assetsHome };
    assert.throws(() => audit(options), /symlink or junction.*ancestry/);
    assert.throws(() => install(options), /symlink or junction.*ancestry/);
    assert.throws(() => rollback({ ...options, manifest: result.manifest }), /symlink or junction.*ancestry/);
  }
  assert.deepEqual(snapshot(actual), before);
  assert.equal(existsSync(assetsHome), false);
});

test('native agent identity collisions and ambiguous YAML are rejected without changing user definitions', t => {
  const root = fixture(t), assetsHome = join(root, 'shared');
  for (const [platform, declaration] of [['workbuddy', 'jarvis-sol'], ['claude-code', '"jarvis-sol"'], ['cursor', "'jarvis-sol'"]]) {
    const options = { home: join(root, platform), assetsHome, platform };
    install(options);
    seedEmployees({ ...options, apply: true });
    const directory = join(options.home, 'agents/nested/user');
    mkdirSync(directory, { recursive: true });
    const custom = join(directory, 'custom.md');
    writeFileSync(custom, `---\nname: ${declaration}\ndescription: User-owned agent\n---\nUser instructions stay intact.\n`);
    const before = snapshot(options.home);
    assert.throws(() => audit(options), /Native role name collision/);
    assert.throws(() => install(options), /Native role name collision/);
    assert.throws(() => planTask({ ...options, employee: 'iris-frontend', difficulty: 'complex' }), /Native role name collision/);
    assert.equal(doctor(options).ok, false);
    assert.deepEqual(snapshot(options.home), before);
    for (const name of ['>\n  jarvis-sol', '*some-alias', 'user-agent\n"\\u006eame": jarvis-sol']) {
      writeFileSync(custom, `---\nname: ${name}\ndescription: User-owned agent\n---\nIntact.\n`);
      const bytes = readFileSync(custom);
      assert.throws(() => audit(options), /Cannot safely identify/);
      assert.equal(doctor(options).ok, false);
      assert.deepEqual(readFileSync(custom), bytes);
    }
    writeFileSync(custom, '---\nname: another-agent # own identity\ndescription: User-owned agent\n---\nIntact.\n');
    assert.equal(audit(options).filesChanged, 0);
    assert.equal(doctor(options).ok, true);
  }
});

test('custom CODEX_HOME bindings are discovered by new platforms instead of creating another library', t => {
  const root = fixture(t), userHome = join(root, 'user'), customCodex = join(root, 'custom-codex'), assetsHome = join(root, 'external-assets');
  install({ home: customCodex, assetsHome });
  const env = { CODEX_HOME: customCodex };
  for (const platform of ['workbuddy', 'claude-code', 'cursor']) {
    const home = join(userHome, platformAdapter(platform).directory);
    assert.equal(resolveAssetsHome({ home, platform, userHome, env }), assetsHome);
    assert.equal(existsSync(join(userHome, '.jarvis')), false);
  }
  install({ home: join(userHome, '.codex'), assetsHome: join(root, 'another-assets') });
  assert.throws(() => resolveAssetsHome({ home: join(userHome, '.claude'), platform: 'claude-code', userHome, env }), /different asset homes/);
  assert.equal(existsSync(join(userHome, '.jarvis')), false);
});

test('native role overrides and stored settings reject non-objects before merging or writing', t => {
  const root = fixture(t), assetsHome = join(root, 'shared');
  for (const platform of ['workbuddy', 'claude-code', 'cursor']) {
    const options = { home: join(root, platform), assetsHome, platform };
    for (const invalid of [null, false, [], 0, 'inherit', {}]) {
      assert.throws(() => audit({ ...options, models: { sol: invalid } }), /invalid settings/);
      assert.throws(() => install({ ...options, models: { sol: invalid } }), /invalid settings/);
      assert.equal(existsSync(options.home), false);
      assert.throws(() => nativeModels(platformAdapter(platform), { sol: { model: 'valid-model' } }, { sol: invalid }), /invalid settings/);
    }
    const installed = install(options);
    const receipt = JSON.parse(readFileSync(installed.manifest));
    receipt.settings.models.sol = null;
    writeFileSync(installed.manifest, JSON.stringify(receipt));
    const before = snapshot(options.home);
    assert.throws(() => install({ ...options, models: { sol: { model: 'valid-model' } } }), /Stored models: invalid settings/);
    assert.deepEqual(snapshot(options.home), before);
  }
});
