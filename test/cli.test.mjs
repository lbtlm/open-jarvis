import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'smol-toml';
import { install as installApi } from '../src/installer.mjs';

const cli = fileURLToPath(new URL('../bin/open-jarvis.mjs', import.meta.url));
function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'open-jarvis-cli-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function run(home, ...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    env: { ...process.env, CODEX_HOME: home }, encoding: 'utf8', timeout: 20000,
  });
}
function json(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('help, version and invalid arguments never install', t => {
  const home = join(fixture(t), 'absent');
  assert.match(run(home).stdout, /Usage: open-jarvis/);
  assert.match(run(home, '--help').stdout, /Open Jarvis/);
  assert.match(run(home, '--help').stdout, /rollback/);
  assert.equal(run(home, '--version').stdout.trim(), '0.1.0');
  assert.equal(run(home, 'install', '--typo').status, 1);
  assert.equal(run(home, 'rollback', '--json').status, 1);
  assert.equal(run(home, 'install', 'extra').status, 1);
  assert.equal(existsSync(home), false);
});

test('public package metadata and executable use Open Jarvis', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'open-jarvis');
  assert.deepEqual(pkg.bin, { 'open-jarvis': 'bin/open-jarvis.mjs' });
  assert.equal(pkg.repository.url, 'git+https://github.com/lbtlm/open-jarvis.git');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.deepEqual(lock.packages[''].bin, pkg.bin);
});

test('CODEX_HOME install, idempotence and rollback preserve original user settings', t => {
  const home = fixture(t);
  const original = '# user settings\nmodel_reasoning_effort = "ultra"\napproval_policy = "on-request"\n';
  writeFileSync(join(home, 'config.toml'), original);
  const preview = json(run(home, 'audit', '--json'));
  assert.ok(preview.status);
  assert.equal(preview.models.controller.effort, 'ultra');
  assert.equal(Object.hasOwn(preview.models.controller, 'fast'), false);
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), original);
  assert.equal(existsSync(join(home, 'jarvis-state')), false);
  const result = json(run(home, 'install', '--yes', '--json'));
  assert.equal(result.status, 'installed');
  assert.ok(result.manifest);
  assert.equal(JSON.parse(readFileSync(result.manifest, 'utf8')).package, 'codex-jarvis');
  assert.equal(existsSync(join(home, 'jarvis', 'employees')), false);
  const config = parse(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(config.model, 'gpt-6-astra');
  assert.equal(config.model_reasoning_effort, 'ultra');
  assert.equal(config.approval_policy, 'on-request');
  assert.equal(config.agents.default_subagent_model, 'gpt-6.1-sol');
  assert.equal(json(run(home, 'install', '--yes', '--json')).status, 'already-installed');
  assert.equal(json(run(home, 'doctor', '--json')).ok, true);
  json(run(home, 'rollback', '--manifest', result.manifest, '--json'));
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), original);
  assert.equal(existsSync(join(home, 'agents', 'jarvis_terra.toml')), false);
});

test('starter CLI validation rejects errors before any install writes', t => {
  const home = join(fixture(t), 'absent');
  for (const args of [
    ['install', '--yes', '--starter', 'unknown'], ['audit', '--starter', 'none'],
    ['employees', '--starter', 'writing'], ['plan', '--starter', 'none'],
  ]) {
    assert.equal(run(home, ...args, '--json').status, 1);
    assert.equal(existsSync(home), false);
  }
});

test('install and employees init select starters and rollback retains user-owned cards', t => {
  const home = fixture(t);
  const result = json(run(home, 'install', '--yes', '--starter', 'writing', '--json'));
  const root = join(home, 'jarvis', 'employees');
  assert.deepEqual(readdirSync(root), ['nova-writer.md']);
  json(run(home, 'rollback', '--manifest', result.manifest, '--json'));
  assert.equal(existsSync(join(root, 'nova-writer.md')), true);
  json(run(home, 'employees', '--init', '--starter', 'office', '--yes', '--json'));
  assert.deepEqual(readdirSync(root).sort(), ['clara-office.md', 'nova-writer.md']);
  const compatibility = json(run(home, 'employees', '--init', '--json'));
  assert.equal(compatibility.starter, 'development');
  assert.equal(compatibility.candidates.length, 4);
  const noneHome = join(fixture(t), 'absent');
  json(run(noneHome, 'employees', '--init', '--starter', 'none', '--yes', '--json'));
  assert.equal(existsSync(noneHome), false);
});

test('interactive starter prefill applies only after final confirmation', t => {
  const home = join(fixture(t), 'accepted');
  const result = spawnSync(process.execPath, [cli, 'install', '--interactive', '--starter', 'video', '--home', home], {
    input: '\n'.repeat(19) + 'yes\n', encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(join(home, 'jarvis', 'employees')), ['frame-video.md']);
  const cancelled = join(fixture(t), 'cancelled');
  const cancel = spawnSync(process.execPath, [cli, 'install', '--interactive', '--starter', 'writing', '--home', cancelled], {
    input: '\n'.repeat(20), encoding: 'utf8', timeout: 20000,
  });
  assert.equal(cancel.status, 0, cancel.stderr);
  assert.equal(existsSync(cancelled), false);
});

test('invalid employee destination fails preflight before configuration changes', t => {
  const home = fixture(t);
  mkdirSync(join(home, 'jarvis'));
  writeFileSync(join(home, 'jarvis', 'employees'), 'User file');
  assert.equal(run(home, 'install', '--yes', '--starter', 'development', '--json').status, 1);
  assert.equal(existsSync(join(home, 'config.toml')), false);
  assert.equal(existsSync(join(home, 'jarvis-state')), false);
});

test('post-install seed failure reports partial status and the successful installation manifest', t => {
  const root = fixture(t);
  const home = join(root, 'home');
  const hook = join(root, 'seed-failure.cjs');
  writeFileSync(hook, `const fs = require('node:fs');
const original = fs.writeFileSync;
fs.writeFileSync = function(path, ...args) {
  if (String(path).endsWith('atlas-backend.md')) throw new Error('Synthetic seed failure');
  return original.call(this, path, ...args);
};
require('node:module').syncBuiltinESMExports();
`);
  const result = spawnSync(process.execPath, ['--require', hook, cli, 'install', '--yes', '--starter', 'development', '--home', home, '--json'], {
    encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.status, 1, result.stderr);
  const partial = JSON.parse(result.stdout);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.installation.status, 'installed');
  assert.equal(existsSync(partial.manifest), true);
  assert.equal(existsSync(join(home, 'config.toml')), true);
  assert.deepEqual(readdirSync(join(home, 'jarvis', 'employees')), []);
  const repeat = spawnSync(process.execPath, ['--require', hook, cli, 'install', '--yes', '--starter', 'development', '--home', home, '--json'], {
    encoding: 'utf8', timeout: 20000,
  });
  assert.equal(repeat.status, 1, repeat.stderr);
  const repeatedPartial = JSON.parse(repeat.stdout);
  assert.equal(repeatedPartial.installation.status, 'already-installed');
  assert.equal(repeatedPartial.manifest, null);
  assert.match(repeatedPartial.message, /no new installation backup/);
});

test('CLI plan allows temporary local skills and blocks unavailable ones without changing cards', t => {
  const home = fixture(t);
  json(run(home, 'install', '--yes', '--starter', 'writing', '--json'));
  const card = join(home, 'jarvis', 'employees', 'nova-writer.md');
  const before = readFileSync(card);
  const skill = join(home, 'skills', 'task-local-skill');
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), '# Explicit task skill');
  const plan = json(run(home, 'plan', '--employee', 'nova-writer', '--difficulty', 'standard', '--skill', 'task-local-skill', '--json'));
  assert.equal(plan.selectedSkills[0].source, 'task-override');
  assert.equal(plan.selectedSkills[0].loaded, false);
  assert.equal(plan.dispatched, false);
  assert.equal(plan.runtimeVerified, false);
  const result = run(home, 'plan', '--employee', 'nova-writer', '--difficulty', 'standard', '--skill', 'not-installed', '--json');
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).status, 'blocked');
  assert.deepEqual(readFileSync(card), before);
});

test('CLI preserves inherited role Fast settings from an existing v2 installation', t => {
  const home = fixture(t);
  const installed = installApi({ home, models: { controller: { fast: false } } });
  const manifest = JSON.parse(readFileSync(installed.manifest, 'utf8'));
  assert.equal(manifest.settings.models.controller.fast, false);
  for (const key of ['luna', 'terra', 'sol', 'reviewer']) {
    assert.equal(Object.hasOwn(manifest.settings.models[key], 'fast'), false);
  }
  const rolePath = join(home, 'agents', 'jarvis_luna.toml');
  const roleBefore = readFileSync(rolePath);
  assert.equal(parse(roleBefore.toString('utf8')).service_tier, undefined);

  const preview = json(run(home, 'audit', '--json'));
  assert.equal(preview.filesChanged, 0);
  assert.equal(preview.models.controller.fast, false);
  for (const key of ['luna', 'terra', 'sol', 'reviewer']) {
    assert.equal(Object.hasOwn(preview.models[key], 'fast'), false);
  }
  assert.equal(json(run(home, 'install', '--yes', '--json')).status, 'already-installed');
  assert.deepEqual(readFileSync(rolePath), roleBefore);
});

test('explicit home wins over environment; custom models and High remain independently configurable', t => {
  const outer = fixture(t);
  const home = join(outer, 'selected');
  const untouched = join(outer, 'not-selected');
  const mappings = join(outer, 'models.json');
  writeFileSync(mappings, JSON.stringify({ luna: { model: 'example-small', effort: 'low' } }));
  json(run(untouched, 'install', '--yes', '--home', home, '--models', mappings, '--controller-effort', 'high', '--json'));
  assert.equal(existsSync(untouched), false);
  const role = parse(readFileSync(join(home, 'agents', 'jarvis_luna.toml'), 'utf8'));
  assert.equal(role.model, 'example-small');
  assert.equal(role.model_reasoning_effort, 'low');
  assert.equal(json(run(untouched, 'doctor', '--home', home, '--json')).ok, true);
  assert.equal(run(home, 'install', '--yes', '--controller-effort', 'magic', '--json').status, 1);
});

test('malformed config or JSON errors do not print source content', t => {
  const home = fixture(t);
  const secret = 'SYNTHETIC_PRIVATE_VALUE_DO_NOT_PRINT';
  writeFileSync(join(home, 'config.toml'), `private_token = "${secret}\n`);
  const badToml = run(home, 'audit', '--json');
  assert.equal(badToml.status, 1);
  assert.ok(!`${badToml.stdout}${badToml.stderr}`.includes(secret));
  const file = join(home, 'bad.json');
  writeFileSync(file, `{ "luna": ${secret} }`);
  const badJson = run(home, 'install', '--yes', '--models', file, '--json');
  assert.equal(badJson.status, 1);
  assert.ok(!`${badJson.stdout}${badJson.stderr}`.includes(secret));
  assert.equal(existsSync(join(home, 'jarvis-state')), false);
});

test('doctor reports missing or modified installation as unhealthy without repairing it', t => {
  const home = fixture(t);
  assert.equal(run(home, 'doctor', '--json').status, 1);
  json(run(home, 'install', '--yes', '--json'));
  const role = join(home, 'agents', 'jarvis_terra.toml');
  writeFileSync(role, '# deliberately removed role\n');
  assert.equal(run(home, 'doctor', '--json').status, 1);
  assert.equal(readFileSync(role, 'utf8'), '# deliberately removed role\n');
});

test('noninteractive installs require an explicit choice; Fast flag renders a real preference', t => {
  const home = join(fixture(t), 'home');
  assert.equal(run(home, 'install', '--json').status, 1);
  assert.equal(existsSync(home), false);
  const fresh = json(run(home, 'audit', '--json'));
  assert.ok(Object.values(fresh.models).every(role => role.fast === false));
  assert.equal(existsSync(home), false);
  json(run(home, 'install', '--yes', '--fast', 'on', '--json'));
  let config = parse(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(config.service_tier, 'fast');
  assert.equal(config.features.fast_mode, true);
  json(run(home, 'install', '--yes', '--fast', 'off', '--json'));
  config = parse(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(config.service_tier, 'default');
});

test('wizard choices reach controller and role TOML; cancellation and EOF do not write', t => {
  const root = fixture(t);
  const home = join(root, 'accepted');
  const answers = [
    'custom-controller', 'ultra', 'y',
    '1', 'low', 'n',
    '2', 'low', 'n',
    '', '', 'n',
    '', '', 'y',
    '', '', 'n',
    '', 'y',
  ].join('\n') + '\n';
  const result = spawnSync(process.execPath, [cli, 'install', '--interactive', '--home', home], {
    input: answers, encoding: 'utf8', timeout: 20000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = parse(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(config.model, 'custom-controller');
  assert.equal(config.model_reasoning_effort, 'ultra');
  assert.equal(config.service_tier, 'fast');
  const luna = parse(readFileSync(join(home, 'agents', 'jarvis_luna.toml'), 'utf8'));
  const sol = parse(readFileSync(join(home, 'agents', 'jarvis_sol.toml'), 'utf8'));
  assert.equal(luna.model_reasoning_effort, 'low');
  assert.equal(luna.service_tier, 'default');
  assert.equal(sol.service_tier, 'fast');
  assert.equal(sol.features.fast_mode, true);
  const cancelled = join(root, 'cancelled');
  const cancel = spawnSync(process.execPath, [cli, 'install', '--interactive', '--home', cancelled], {
    input: '\n'.repeat(20), encoding: 'utf8', timeout: 20000,
  });
  assert.equal(cancel.status, 0, cancel.stderr);
  assert.equal(existsSync(cancelled), false);
  const eof = spawnSync(process.execPath, [cli, 'install', '--interactive', '--home', cancelled], {
    input: '', encoding: 'utf8', timeout: 20000,
  });
  assert.equal(eof.status, 1);
  assert.equal(existsSync(cancelled), false);
});
