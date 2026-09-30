import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { install } from '../src/installer.mjs';

const { values } = parseArgs({ options: { 'codex-bin': { type: 'string' }, fast: { type: 'string' } } });
if (!values['codex-bin']) throw new Error('Supply --codex-bin with a Codex executable, not a shell wrapper.');
if (values.fast && !['on', 'off'].includes(values.fast)) throw new Error('--fast must be on or off.');
const executable = resolve(values['codex-bin']);
const version = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
const scratch = mkdtempSync(join(tmpdir(), 'open-jarvis-runtime-'));
const home = join(scratch, 'codex-home');
let child;
let stream;
const pending = new Map();
try {
  install({ home, ...(values.fast ? { models: { controller: { fast: values.fast === 'on' } } } : {}) });
  child = spawn(executable, ['app-server', '--stdio'], {
    cwd: scratch, env: { ...process.env, CODEX_HOME: home },
    stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
  });
  const rejectAll = error => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  child.on('error', rejectAll);
  child.on('exit', () => rejectAll(new Error('Codex app-server exited before responding.')));
  stream = createInterface({ input: child.stdout });
  stream.on('line', line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`app-server rejected request ${message.id} (code ${message.error.code}).`));
    else request.resolve(message.result);
  });
  let sequence = 0;
  function rpc(method, params) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out.`));
      }, 15000);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`, error => {
        if (error) rejectAll(new Error('Unable to write to Codex app-server.'));
      });
    });
  }
  await rpc('initialize', { clientInfo: { name: 'open-jarvis-check', version: '0.1.0' } });
  child.stdin.write('{"method":"initialized"}\n');
  const { config } = await rpc('config/read', { includeLayers: false, cwd: scratch });
  assert.equal(config.model, 'gpt-6-astra');
  assert.equal(config.model_reasoning_effort, 'high');
  assert.equal(config.agents.enabled, true);
  assert.equal(config.agents.default_subagent_model, 'gpt-6.1-sol');
  assert.equal(config.agents.default_subagent_reasoning_effort, 'medium');
  assert.equal(config.agents.max_concurrent_threads_per_session, 3);
  if (values.fast) assert.equal(config.service_tier, values.fast === 'on' ? 'fast' : 'default');
  console.log(JSON.stringify({ status: 'PASS', version, model: config.model,
    effort: config.model_reasoning_effort,
    service_tier: config.service_tier,
    default_subagent_model: config.agents.default_subagent_model,
    default_subagent_reasoning_effort: config.agents.default_subagent_reasoning_effort,
    max_subagents: config.agents.max_concurrent_threads_per_session,
    scope: 'isolated config/read only; no model request; role dispatch and effective sandbox not verified' }, null, 2));
} finally {
  stream?.close();
  if (child && child.exitCode === null && child.signalCode === null) {
    const ended = once(child, 'exit').catch(() => {});
    child.kill();
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3000);
    await ended;
    clearTimeout(timeout);
  }
  assert.ok(relative(resolve(tmpdir()), scratch).startsWith('open-jarvis-runtime-'));
  rmSync(scratch, { recursive: true, force: true });
}
