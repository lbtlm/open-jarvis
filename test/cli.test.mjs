import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'smol-toml';

const cli = fileURLToPath(new URL('../bin/codex-jarvis.mjs', import.meta.url));
function fixture(t) {
  const path = mkdtempSync(join(tmpdir(), 'codex-jarvis-cli-'));
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
  assert.match(run(home).stdout, /Usage:/);
  assert.match(run(home, '--help').stdout, /rollback/);
  assert.equal(run(home, '--version').stdout.trim(), '0.1.0');
  assert.equal(run(home, 'install', '--typo').status, 1);
  assert.equal(run(home, 'rollback', '--json').status, 1);
  assert.equal(run(home, 'install', 'extra').status, 1);
  assert.equal(existsSync(home), false);
});

test('CODEX_HOME install, idempotence and rollback preserve original user settings', t => {
  const home = fixture(t);
  const original = '# user settings\nmodel_reasoning_effort = "ultra"\napproval_policy = "on-request"\n';
  writeFileSync(join(home, 'config.toml'), original);
  const preview = json(run(home, 'audit', '--json'));
  assert.ok(preview.status);
  assert.equal(preview.models.controller.effort, 'ultra');
  assert.equal(preview.models.controller.fast, false);
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), original);
  assert.equal(existsSync(join(home, 'jarvis-state')), false);
  const result = json(run(home, 'install', '--yes', '--json'));
  assert.equal(result.status, 'installed');
  assert.ok(result.manifest);
  const config = parse(readFileSync(join(home, 'config.toml'), 'utf8'));
  assert.equal(config.model, 'gpt-6-astra');
  assert.equal(config.model_reasoning_effort, 'ultra');
  assert.equal(config.approval_policy, 'on-request');
  assert.equal(config.agents.default_subagent_model, 'gpt-5.6-terra');
  assert.equal(json(run(home, 'install', '--yes', '--json')).status, 'already-installed');
  assert.equal(json(run(home, 'doctor', '--json')).ok, true);
  json(run(home, 'rollback', '--manifest', result.manifest, '--json'));
  assert.equal(readFileSync(join(home, 'config.toml'), 'utf8'), original);
  assert.equal(existsSync(join(home, 'agents', 'jarvis_terra.toml')), false);
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
    '4', 'low', 'n',
    '', '', 'n',
    '', '', 'y',
    '', '', 'n',
    'y',
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
    input: '\n'.repeat(16), encoding: 'utf8', timeout: 20000,
  });
  assert.equal(cancel.status, 0, cancel.stderr);
  assert.equal(existsSync(cancelled), false);
  const eof = spawnSync(process.execPath, [cli, 'install', '--interactive', '--home', cancelled], {
    input: '', encoding: 'utf8', timeout: 20000,
  });
  assert.equal(eof.status, 1);
  assert.equal(existsSync(cancelled), false);
});
