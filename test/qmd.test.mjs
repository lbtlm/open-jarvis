import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { previewQmd, installQmd, managerInvocation, findManager, QMD_PACKAGE } from '../src/qmd.mjs';
import { collectChoices } from '../src/wizard.mjs';

const cli = fileURLToPath(new URL('../bin/open-jarvis.mjs', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'jarvis-qmd-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function fakePackage(dir, { linked = false } = {}) {
  const pkg = join(dir, linked ? 'node_modules/.pnpm/qmd/node_modules/@tobilu/qmd' : 'node_modules/@tobilu/qmd');
  mkdirSync(join(pkg, 'bin'), { recursive: true });
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@tobilu/qmd', version: '2.8.3', bin: { qmd: 'bin/qmd' } }));
  writeFileSync(join(pkg, 'bin/qmd'), `console.log(JSON.stringify({ args: process.argv.slice(2), env: { QMD_CONFIG_DIR: process.env.QMD_CONFIG_DIR, XDG_CACHE_HOME: process.env.XDG_CACHE_HOME, INDEX_PATH: process.env.INDEX_PATH, QMD_FORCE_CPU: process.env.QMD_FORCE_CPU, QMD_LLAMA_GPU: process.env.QMD_LLAMA_GPU, CUDA_CACHE_PATH: process.env.CUDA_CACHE_PATH, NODE_LLAMA_CPP_SKIP_DOWNLOAD: process.env.NODE_LLAMA_CPP_SKIP_DOWNLOAD } }));`);
  if (linked) {
    mkdirSync(join(dir, 'node_modules/@tobilu'), { recursive: true });
    symlinkSync(pkg, join(dir, 'node_modules/@tobilu/qmd'), process.platform === 'win32' ? 'junction' : 'dir');
  }
}

test('QMD preview is read-only and blocks nonempty, overlapping, file and linked destinations', t => {
  const root = fixture(t), dir = join(root, 'engine');
  assert.equal(previewQmd({ dir }).installed, false);
  assert.equal(existsSync(dir), false);
  assert.throws(() => previewQmd({ dir: 'relative' }), /absolute/);
  assert.throws(() => previewQmd({ dir, home: dir }), /separate/);
  assert.throws(() => previewQmd({ dir: join(dir, 'qmd'), home: dir }), /separate/);
  mkdirSync(dir);
  writeFileSync(join(dir, 'user.txt'), 'keep');
  assert.throws(() => previewQmd({ dir }), /nonempty/);
  assert.equal(readFileSync(join(dir, 'user.txt'), 'utf8'), 'keep');
  const link = join(root, 'link');
  symlinkSync(dir, link, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => previewQmd({ dir: join(link, 'child') }), /link|junction/i);
  assert.throws(() => previewQmd({ dir: join(dir, 'user.txt') }), /directory/);
});

for (const manager of ['npm', 'pnpm']) test(`${manager} fixed package protocol, scoped caches, launcher and idempotence`, t => {
  const root = fixture(t), dir = join(root, 'engine & literal space');
  const options = { dir, manager, device: manager === 'npm' ? 'auto' : 'cpu', home: join(root, 'codex') };
  const calls = [];
  const runner = (command, args, settings) => {
    calls.push({ command, args, settings });
    if (args.includes(QMD_PACKAGE)) {
      fakePackage(dir, { linked: manager === 'pnpm' });
      return { status: 0, stdout: 'Synthetic fixed package installation', stderr: '' };
    }
    assert.equal(settings.env.QMD_CONFIG_DIR, join(dir, 'doctor-probe/config'));
    assert.equal(settings.env.INDEX_PATH, join(dir, 'doctor-probe/cache/qmd/index.sqlite'));
    assert.equal(settings.env.QMD_LLAMA_GPU, undefined);
    assert.equal(settings.env.QMD_DOCTOR_DEVICE_PROBE, undefined);
    assert.equal(existsSync(settings.env.INDEX_PATH), false);
    assert.deepEqual(args.slice(-3), ['--index', 'index', 'doctor']);
    return { status: 0, stdout: 'Synthetic doctor: CPU fallback; no models', stderr: '' };
  };
  const result = installQmd(options, { runner, locateManager: () => join(root, `${manager}-cli.js`) });
  assert.equal(result.status, 'installed', result.message);
  assert.equal(result.semantic, 'pending');
  assert.equal(result.doctor.status, 'checked');
  assert.equal(result.doctor.os, process.platform);
  assert.match(result.doctor.evidence, /CPU fallback/);
  assert.equal(calls.length, 2);
  const call = calls[0];
  assert.equal(call.command, process.execPath);
  assert.equal(call.settings.shell, false);
  assert.equal(call.settings.cwd, dir);
  assert.equal(call.settings.env.NODE_LLAMA_CPP_SKIP_DOWNLOAD, 'true');
  assert.equal(call.args.at(-1), QMD_PACKAGE);
  assert.ok(call.args.includes(dir));
  assert.ok(!call.args.includes('-g'));
  assert.equal(call.settings.env.TEMP, join(dir, 'tmp'));
  assert.ok(call.args.includes(manager === 'npm' ? join(dir, 'package-cache') : join(dir, 'package-cache/store')));
  if (manager === 'pnpm') assert.deepEqual(JSON.parse(readFileSync(join(dir, 'package.json'))).pnpm.onlyBuiltDependencies,
    ['better-sqlite3', 'esbuild', 'node-llama-cpp', 'tree-sitter-go', 'tree-sitter-python', 'tree-sitter-rust', 'tree-sitter-typescript']);
  const launched = spawnSync(process.execPath, [result.launcher, 'query', 'vec: literal & query', '--no-rerank'], {
    encoding: 'utf8', env: { ...process.env, QMD_CONFIG_DIR: 'other', INDEX_PATH: 'other', QMD_LLAMA_GPU: 'cuda', QMD_FORCE_CPU: 'wrong' } });
  assert.equal(launched.status, 0, launched.stderr);
  const runtime = JSON.parse(launched.stdout);
  assert.deepEqual(runtime.args, ['--index', 'index', 'query', 'vec: literal & query', '--no-rerank']);
  assert.equal(runtime.env.QMD_FORCE_CPU, options.device === 'cpu' ? '1' : '0');
  assert.equal(runtime.env.NODE_LLAMA_CPP_SKIP_DOWNLOAD, 'true');
  assert.equal(runtime.env.QMD_LLAMA_GPU, undefined);
  assert.equal(runtime.env.QMD_CONFIG_DIR, join(dir, 'config'));
  assert.equal(runtime.env.INDEX_PATH, join(dir, 'cache/qmd/index.sqlite'));
  assert.equal(runtime.env.XDG_CACHE_HOME, join(dir, 'cache'));
  assert.equal(runtime.env.CUDA_CACHE_PATH, join(dir, 'cache/cuda'));
  assert.equal(installQmd(options, { runner: () => assert.fail('Repeat must not run manager or doctor') }).status, 'already-installed');
  assert.throws(() => previewQmd({ ...options, device: options.device === 'cpu' ? 'auto' : 'cpu' }), /different/);
  writeFileSync(result.launcher, 'changed');
  assert.throws(() => previewQmd(options), /receipt/);
});

test('failed native install keeps receipt and diagnostics without blind retry', t => {
  const root = fixture(t), dir = join(root, 'engine');
  const result = installQmd({ dir }, { locateManager: () => join(root, 'npm-cli.js'), runner: () => ({ status: 1, stderr: 'Synthetic missing native build dependency' }) });
  assert.equal(result.status, 'error');
  assert.equal(existsSync(join(dir, 'jarvis-qmd.json')), true);
  assert.match(readFileSync(result.log, 'utf8'), /missing native/);
  assert.throws(() => installQmd({ dir }, { runner: () => assert.fail('Do not retry') }), /incomplete/);
});

for (const damage of ['missing', 'escaping']) test(`managed reuse rejects a ${damage} package CLI entry without writes`, t => {
  const root = fixture(t), dir = join(root, 'engine');
  const result = installQmd({ dir }, { locateManager: () => join(root, 'npm-cli.js'), runner: (_command, args) => {
    if (args.includes(QMD_PACKAGE)) fakePackage(dir);
    return { status: 0 };
  } });
  assert.equal(result.status, 'installed');
  const packagePath = join(dir, 'node_modules/@tobilu/qmd/package.json');
  if (damage === 'missing') rmSync(join(dir, 'node_modules/@tobilu/qmd/bin/qmd'));
  else {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    pkg.bin.qmd = '../outside-qmd';
    writeFileSync(packagePath, JSON.stringify(pkg));
    writeFileSync(join(dir, 'node_modules/@tobilu/outside-qmd'), '// Keep this file');
  }
  const files = ['jarvis-qmd.json', 'qmd-launcher.mjs', 'node_modules/@tobilu/qmd/package.json'];
  const before = files.map(file => readFileSync(join(dir, file)));
  const error = damage === 'missing' ? /CLI entrypoint is missing/ : /CLI entrypoint escapes its package/;
  assert.throws(() => previewQmd({ dir }), error);
  assert.throws(() => installQmd({ dir }, { runner: () => assert.fail('Do not reinstall damaged directories') }), error);
  assert.equal(existsSync(dir), true);
  for (const [index, file] of files.entries()) assert.deepEqual(readFileSync(join(dir, file)), before[index]);
  if (damage === 'escaping') assert.equal(readFileSync(join(dir, 'node_modules/@tobilu/outside-qmd'), 'utf8'), '// Keep this file');
});

test('managed reuse rejects pkg.bin retargeting after the launcher entry was removed', t => {
  const root = fixture(t), dir = join(root, 'engine');
  const result = installQmd({ dir }, { locateManager: () => join(root, 'npm-cli.js'), runner: (_command, args) => {
    if (args.includes(QMD_PACKAGE)) fakePackage(dir);
    return { status: 0 };
  } });
  assert.equal(result.status, 'installed');
  const originalEntry = join(dir, 'node_modules/@tobilu/qmd/bin/qmd');
  assert.equal(JSON.parse(readFileSync(join(dir, 'jarvis-qmd.json'), 'utf8')).entry, realpathSync(originalEntry));
  rmSync(originalEntry);
  const packagePath = join(dir, 'node_modules/@tobilu/qmd/package.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  pkg.bin.qmd = 'bin/replacement-qmd';
  writeFileSync(packagePath, JSON.stringify(pkg));
  writeFileSync(join(dir, 'node_modules/@tobilu/qmd/bin/replacement-qmd'), '// Keep replacement entry');
  const files = ['jarvis-qmd.json', 'qmd-launcher.mjs', 'node_modules/@tobilu/qmd/package.json', 'node_modules/@tobilu/qmd/bin/replacement-qmd'];
  const before = files.map(file => readFileSync(join(dir, file)));
  assert.throws(() => previewQmd({ dir }), /CLI entrypoint changed from its management receipt/);
  assert.throws(() => installQmd({ dir }, {
    locateManager: () => assert.fail('Do not locate a manager for damaged directories'),
    runner: () => assert.fail('Do not reinstall damaged directories'),
  }), /CLI entrypoint changed from its management receipt/);
  assert.equal(existsSync(originalEntry), false);
  for (const [index, file] of files.entries()) assert.deepEqual(readFileSync(join(dir, file)), before[index]);
});

test('doctor failure reports installed engine separately and does not retry a saved check', t => {
  const root = fixture(t), dir = join(root, 'engine');
  const result = installQmd({ dir }, { locateManager: () => join(root, 'npm-cli.js'), runner: (_command, args) => {
    if (args.includes(QMD_PACKAGE)) { fakePackage(dir); return { status: 0 }; }
    return { status: 1, stderr: 'Synthetic missing cublas64_13.dll; no model download' };
  } });
  assert.equal(result.status, 'error');
  assert.equal(result.engineStatus, 'installed');
  assert.equal(result.doctor.status, 'error');
  assert.match(result.doctor.evidence, /cublas64_13/);
  assert.equal(result.semantic, 'pending');
  const repeat = installQmd({ dir }, { runner: () => assert.fail('No automatic diagnosis on existing index') });
  assert.equal(repeat.status, 'error');
  assert.equal(repeat.engineStatus, 'already-installed');
});

test('manager discovery selects a JS CLI rather than shell wrappers and argv leaves registry untouched', t => {
  const root = fixture(t);
  const entry = join(root, 'node_modules/npm/bin/npm-cli.js');
  mkdirSync(join(root, 'node_modules/npm/bin'), { recursive: true });
  writeFileSync(entry, '// synthetic entry');
  assert.equal(findManager('npm', { env: { PATH: root }, execPath: join(root, 'node') }), entry);
  assert.throws(() => findManager('pnpm', { env: { PATH: root, npm_execpath: entry }, execPath: join(root, 'node') }), /JavaScript CLI/);
  const pnpmEntry = join(root, '.tools/pnpm/10.18.1/node_modules/pnpm/bin/pnpm.cjs');
  mkdirSync(join(root, '.tools/pnpm/10.18.1/node_modules/pnpm/bin'), { recursive: true });
  writeFileSync(pnpmEntry, '// synthetic pnpm entry');
  writeFileSync(join(root, 'pnpm.cmd'), 'node "%~dp0/.tools/pnpm/10.18.1/node_modules/pnpm/bin/pnpm.cjs" %*');
  assert.equal(findManager('pnpm', { env: { PATH: root }, execPath: join(root, 'node') }), pnpmEntry);
  const invocation = managerInvocation({ dir: join(root, 'a & b'), manager: 'npm' }, entry, { npm_config_registry: 'https://synthetic.invalid', PATH: root });
  assert.equal(invocation.options.env.npm_config_registry, 'https://synthetic.invalid');
  assert.ok(!invocation.args.includes('--registry'));
});

test('available managers isolate an offline synthetic install from a parent workspace', t => {
  const scratch = fixture(t);
  for (const manager of ['npm', 'pnpm']) {
    let entry;
    try { entry = findManager(manager); } catch { continue; }
    const parent = join(scratch, manager), dir = join(parent, 'engine');
    const synthetic = join(scratch, `${manager}-synthetic-package`);
    mkdirSync(dir, { recursive: true });
    mkdirSync(synthetic);
    writeFileSync(join(synthetic, 'package.json'), JSON.stringify({ name: 'jarvis-qmd-synthetic-offline', version: '1.0.0' }));
    const parentFiles = {
      'package.json': JSON.stringify({ name: 'parent-workspace', private: true, workspaces: ['engine'] }),
      'pnpm-workspace.yaml': "packages:\n  - engine\n",
      '.npmrc': `lockfile-dir=${join(parent, 'outside').replaceAll('\\', '/')}\nvirtual-store-dir=${join(parent, 'outside/modules').replaceAll('\\', '/')}\n`,
      'package-lock.json': JSON.stringify({ name: 'parent-workspace', lockfileVersion: 3, packages: {} }),
      'pnpm-lock.yaml': "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n",
      '.pnpmfile.cjs': "throw new Error('Parent pnpm hook must not execute');\n",
    };
    for (const [file, content] of Object.entries(parentFiles)) writeFileSync(join(parent, file), content);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'jarvis-qmd-engine', version: '1.0.0', private: true }));
    mkdirSync(join(dir, 'tmp'));
    const invocation = managerInvocation({ dir, manager }, entry);
    // Exercise the real argv protocol using only a local no-dependency package.
    // No QMD/native package or registry traffic is involved.
    invocation.args[invocation.args.indexOf(QMD_PACKAGE)] = `file:${synthetic}`;
    invocation.args.push('--offline', '--ignore-scripts');
    const result = spawnSync(invocation.command, invocation.args, { ...invocation.options, timeout: 30000 });
    assert.equal(result.status, 0, `${manager}: ${result.stderr || result.stdout}`);
    for (const [file, content] of Object.entries(parentFiles)) assert.equal(readFileSync(join(parent, file), 'utf8'), content);
    assert.equal(existsSync(join(parent, 'node_modules')), false);
    assert.equal(existsSync(join(parent, 'outside')), false);
    assert.equal(JSON.parse(readFileSync(join(dir, 'package.json'))).dependencies['jarvis-qmd-synthetic-offline'].startsWith('file:'), true);
  }
});

test('wizard QMD defaults off, explicit CPU preview is cancellable and does not write', async t => {
  const root = fixture(t), dir = join(root, 'engine');
  let output = '';
  const answers = [...Array(19).fill(''), 'yes', 'pnpm', 'cpu', dir, 'no'];
  const result = await collectChoices({ initial: {}, home: join(root, 'home'),
    ask: async () => { assert.ok(answers.length); return answers.shift(); }, write: text => { output += text; } });
  assert.equal(result.confirmed, false);
  assert.equal(result.qmd.manager, 'pnpm');
  assert.equal(result.qmd.device, 'cpu');
  assert.match(output, /platform native dependencies/);
  assert.match(output, /No automatic models/);
  assert.equal(existsSync(dir), false);
  const declined = [...Array(19).fill(''), '', 'yes'];
  const defaults = await collectChoices({ initial: {}, ask: async () => declined.shift(), write: () => {} });
  assert.equal(defaults.confirmed, true);
  assert.equal(defaults.qmd, null);
});

test('CLI invalid QMD flags and destination fail before installing Jarvis', t => {
  const root = fixture(t), home = join(root, 'home'), dir = join(root, 'engine');
  for (const args of [ ['audit', '--qmd'], ['doctor', '--qmd-dir', dir], ['install', '--yes', '--qmd-dir', dir],
    ['install', '--yes', '--qmd'], ['install', '--yes', '--qmd', '--qmd-dir', 'relative'],
    ['install', '--yes', '--qmd', '--qmd-dir', dir, '--qmd-manager', 'yarn'],
    ['install', '--yes', '--qmd', '--qmd-dir', dir, '--qmd-device', 'cuda'],
    ['install', '--yes', '--qmd', '--qmd-dir', join(home, 'qmd')],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args, '--home', home, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout);
    assert.equal(existsSync(home), false);
    assert.equal(existsSync(dir), false);
  }
});

test('CLI manager failure returns partial with installed controller and preserves existing connection', t => {
  const root = fixture(t), home = join(root, 'home'), dir = join(root, 'engine');
  mkdirSync(join(home, 'jarvis-state'), { recursive: true });
  const connection = join(home, 'jarvis-state/qmd.json');
  const original = '{"launcher":"D:/existing/qmd.cmd","semantic":"ready","collections":49}\n';
  writeFileSync(connection, original);
  const hook = join(root, 'runner.cjs');
  writeFileSync(hook, `const cp = require('node:child_process'); const original = cp.spawnSync; cp.spawnSync = (command, args, options) => args.includes('${QMD_PACKAGE}') ? { status: 1, stderr: 'Synthetic package manager failure' } : original(command, args, options); require('node:module').syncBuiltinESMExports();`);
  const result = spawnSync(process.execPath, ['--require', hook, cli, 'install', '--yes', '--qmd', '--qmd-dir', dir, '--home', home, '--json'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 1, result.stderr);
  const partial = JSON.parse(result.stdout);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.installation.status, 'installed');
  assert.equal(partial.qmd.status, 'error');
  assert.equal(existsSync(partial.manifest), true);
  assert.equal(existsSync(join(home, 'config.toml')), true);
  assert.equal(readFileSync(connection, 'utf8'), original);
  const upgraded = spawnSync(process.execPath, ['--require', hook, cli, 'install', '--yes', '--home', home, '--json'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(upgraded.status, 0, upgraded.stderr);
  assert.equal(JSON.parse(upgraded.stdout).status, 'already-installed');
  assert.equal(readFileSync(connection, 'utf8'), original);
});
