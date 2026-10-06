import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { checkAncestors } from './asset-paths.mjs';

export const QMD_PACKAGE = '@tobilu/qmd@2.8.3';
const RECEIPT = 'jarvis-qmd.json';
const LAUNCHER = 'qmd-launcher.mjs';
// QMD 2.8.3's upstream pnpm build allowlist, including its SQLite engine.
const QMD_BUILDS = ['better-sqlite3', 'esbuild', 'node-llama-cpp', 'tree-sitter-go', 'tree-sitter-python', 'tree-sitter-rust', 'tree-sitter-typescript'];
const hash = text => createHash('sha256').update(text).digest('hex');

function contains(parent, child) {
  const rel = relative(parent, child);
  return !rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

function packageFile(dir, path) {
  const actual = realpathSync(path);
  if (!contains(dir, actual) || !lstatSync(actual).isFile()) throw new Error('QMD package file escapes the managed directory or is not a regular file.');
  checkAncestors(actual);
  return actual;
}

function qmdEntry(dir, packagePath, pkg) {
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.qmd;
  if (typeof bin !== 'string' || isAbsolute(bin)) throw new Error('Installed QMD package has no safe qmd CLI entrypoint.');
  const entry = resolve(dirname(packagePath), bin);
  if (!contains(dirname(packagePath), entry)) throw new Error('QMD CLI entrypoint escapes its package.');
  try { return packageFile(dir, entry); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Installed QMD CLI entrypoint is missing: ${entry}. Preserve the directory for diagnosis.`);
    throw error;
  }
}

export function previewQmd({ dir, manager = 'npm', device = 'auto', home } = {}) {
  if (typeof dir !== 'string' || !dir || /[\u0000-\u001f\u007f]/.test(dir) || !isAbsolute(dir)) throw new Error('QMD requires an absolute --qmd-dir PATH.');
  if (!['npm', 'pnpm'].includes(manager)) throw new Error('--qmd-manager must be npm or pnpm.');
  if (!['auto', 'cpu'].includes(device)) throw new Error('--qmd-device must be auto or cpu.');
  dir = resolve(dir);
  if (home && (contains(resolve(home), dir) || contains(dir, resolve(home)))) throw new Error('QMD directory must be separate from Codex home.');
  checkAncestors(dir);
  let installed = false;
  let doctor;
  if (existsSync(dir)) {
    if (!lstatSync(dir).isDirectory()) throw new Error('QMD directory must be a directory.');
    if (readdirSync(dir).length) {
      const receiptPath = join(dir, RECEIPT);
      checkAncestors(receiptPath);
      let receipt;
      try { receipt = JSON.parse(readFileSync(receiptPath, 'utf8')); } catch { throw new Error('QMD directory is nonempty and not a verified Jarvis QMD installation. Choose a new empty directory.'); }
      if (receipt.owner !== 'open-jarvis-qmd' || receipt.dir !== dir || receipt.package !== QMD_PACKAGE || receipt.manager !== manager || receipt.device !== device || receipt.status !== 'installed') {
        throw new Error('QMD directory has a different or incomplete installation. Preserve it for diagnosis and choose a new empty directory.');
      }
      for (const file of ['package.json', LAUNCHER]) checkAncestors(join(dir, file));
      const project = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      const packagePath = packageFile(dir, join(dir, 'node_modules/@tobilu/qmd/package.json'));
      const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
      if (project.name !== 'jarvis-qmd-engine' || project.dependencies?.['@tobilu/qmd'] !== '2.8.3' || pkg.name !== '@tobilu/qmd' || pkg.version !== '2.8.3' || hash(readFileSync(join(dir, LAUNCHER))) !== receipt.launcherSha256) {
        throw new Error('QMD installation no longer matches its management receipt. No files were overwritten.');
      }
      if (qmdEntry(dir, packagePath, pkg) !== receipt.entry) {
        throw new Error('QMD CLI entrypoint changed from its management receipt. Preserve the directory for diagnosis; no files were overwritten.');
      }
      installed = true;
      doctor = receipt.doctor;
    }
  }
  return { dir, manager, device, installed, ...(doctor ? { doctor } : {}), package: QMD_PACKAGE, launcher: join(dir, LAUNCHER),
    launch: { command: process.execPath, args: [join(dir, LAUNCHER)] },
    semantic: 'pending', message: 'Engine only; models and asset indexes require separate initialization. Existing QMD connections are preserved.' };
}

// Windows npm/pnpm wrappers need shell quoting. Invoke their actual JavaScript
// CLI with Node instead; argv values (including spaces and shell symbols) stay literal.
export function findManager(manager, { env = process.env, execPath = process.execPath } = {}) {
  const names = manager === 'npm' ? ['npm-cli.js'] : ['pnpm.cjs', 'pnpm.js'];
  const roots = [dirname(execPath), ...(env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)];
  const candidates = [env.npm_execpath];
  for (const root of roots) {
    if (manager === 'pnpm') try {
      // pnpm self-update puts its JS CLI under .tools. Read the generated shim's
      // literal relative target without executing shell text; preserve PATH order.
      const target = readFileSync(join(root, 'pnpm.cmd'), 'utf8').match(/"%~dp0[\\/]([^"\r\n%]*?pnpm\.cjs)"/i)?.[1];
      if (target) candidates.push(resolve(root, target));
    } catch { /* No local pnpm shim at this PATH entry. */ }
    candidates.push(join(root, manager), ...names.map(name => join(root, name)), ...names.map(name => join(root, 'node_modules', manager, 'bin', name)));
  }
  for (const path of candidates) {
    if (!path) continue;
    try {
      const entry = realpathSync(path);
      if (names.includes(basename(entry)) && !entry.split(/[\\/]/).includes('corepack') && lstatSync(entry).isFile()) return entry;
    } catch { /* Try the next local entrypoint; never fetch a package manager. */ }
  }
  throw new Error(`Cannot locate the ${manager} JavaScript CLI. Install/configure ${manager} separately, then choose a new empty QMD directory.`);
}

export function managerInvocation(plan, entry, env = process.env) {
  const cache = join(plan.dir, 'package-cache');
  const args = plan.manager === 'npm'
    ? ['install', '--prefix', plan.dir, '--workspaces=false', '--global=false', '--save-exact', '--no-audit', '--no-fund', '--cache', cache, QMD_PACKAGE]
    : ['add', '--dir', plan.dir, '--ignore-workspace', '--ignore-pnpmfile', '--global=false', '--lockfile-dir', plan.dir, '--virtual-store-dir', join(plan.dir, 'node_modules/.pnpm'), '--save-exact', '--store-dir', join(cache, 'store'), '--cache-dir', join(cache, 'cache'), `--config.state-dir=${join(cache, 'state')}`, QMD_PACKAGE];
  return { command: process.execPath, args: [entry, ...args], options: { cwd: plan.dir, shell: false, windowsHide: true, encoding: 'utf8',
    env: { ...env, NODE_LLAMA_CPP_SKIP_DOWNLOAD: 'true', npm_config_devdir: join(cache, 'node-gyp'),
      npm_config_update_notifier: 'false', TMPDIR: join(plan.dir, 'tmp'), TEMP: join(plan.dir, 'tmp'), TMP: join(plan.dir, 'tmp') },
    maxBuffer: 16 * 1024 * 1024 } };
}

function launcherSource(plan, entry) {
  return `#!/usr/bin/env node\nimport { spawnSync } from 'node:child_process';\nconst env = { ...process.env, ...${JSON.stringify(engineEnv(plan))} };\ndelete env.QMD_LLAMA_GPU;\nconst args = process.argv.slice(2);\nif (args.some(arg => arg === '--index' || arg.startsWith('--index='))) throw new Error('This launcher uses its fixed index; do not pass --index.');\nconst result = spawnSync(process.execPath, [${JSON.stringify(entry)}, '--index', 'index', ...args], { env, stdio: 'inherit', shell: false, windowsHide: true });\nif (result.error) console.error(result.error.message);\nprocess.exitCode = result.status ?? 1;\n`;
}

function engineEnv(plan, root = plan.dir) {
  return { QMD_CONFIG_DIR: join(root, 'config'), XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'),
    INDEX_PATH: join(root, 'cache/qmd/index.sqlite'), CUDA_CACHE_PATH: join(plan.dir, 'cache/cuda'),
    QMD_FORCE_CPU: plan.device === 'cpu' ? '1' : '0', NODE_LLAMA_CPP_SKIP_DOWNLOAD: 'true' };
}

function probeDoctor(plan, entry, runner) {
  // Upstream doctor can embed an existing sample. This separate empty database
  // has no documents/vectors, so device detection runs without resolving models.
  const root = join(plan.dir, 'doctor-probe');
  for (const path of ['config', 'cache/qmd']) mkdirSync(join(root, path), { recursive: true });
  const env = { ...process.env, ...engineEnv(plan, root), NODE_LLAMA_CPP_SKIP_DOWNLOAD: 'true' };
  delete env.QMD_LLAMA_GPU;
  delete env.QMD_DOCTOR_DEVICE_PROBE;
  const result = runner(process.execPath, [entry, '--index', 'index', 'doctor'], {
    cwd: root, env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  const log = join(plan.dir, 'doctor.log');
  const evidence = `${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`;
  writeFileSync(log, `${evidence}\n`, { flag: 'wx' });
  return { status: !result.error && result.status === 0 ? 'checked' : 'error', os: process.platform, arch: process.arch,
    qmdVersion: '2.8.3', nodeVersion: process.version, devicePreference: plan.device, log, evidence: evidence.slice(0, 16384),
    scope: 'Upstream doctor with a separate empty index/config/cache; no model or asset initialization.' };
}

export function installQmd(options, { runner = spawnSync, locateManager = findManager } = {}) {
  const plan = previewQmd(options);
  if (plan.installed) return { ...plan, status: plan.doctor?.status === 'error' ? 'error' : 'already-installed', engineStatus: 'already-installed',
    ...(plan.doctor?.status === 'error' ? { message: 'Engine is already installed; the saved doctor check failed. Inspect doctor.log and resolve reported native/system dependencies separately.' } : {}) };
  const entry = locateManager(plan.manager);
  // Recheck immediately before claiming the directory. Never clean up user paths.
  previewQmd(options);
  mkdirSync(plan.dir, { recursive: true });
  const receipt = { owner: 'open-jarvis-qmd', dir: plan.dir, package: QMD_PACKAGE, manager: plan.manager, device: plan.device, status: 'installing' };
  const receiptPath = join(plan.dir, RECEIPT);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  const log = join(plan.dir, 'install.log');
  try {
    writeFileSync(join(plan.dir, 'package.json'), `${JSON.stringify({ name: 'jarvis-qmd-engine', version: '1.0.0', private: true,
      dependencies: { '@tobilu/qmd': '2.8.3' }, ...(plan.manager === 'pnpm' ? { pnpm: { onlyBuiltDependencies: QMD_BUILDS } } : {}) }, null, 2)}\n`, { flag: 'wx' });
    for (const path of ['package-cache', 'tmp', 'config', 'cache/cuda']) mkdirSync(join(plan.dir, path), { recursive: true });
    const invocation = managerInvocation(plan, entry);
    const result = runner(invocation.command, invocation.args, invocation.options);
    writeFileSync(log, `${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}\n`, { flag: 'wx' });
    if (result.error || result.status !== 0) throw new Error(`${plan.manager} QMD installation failed; inspect ${log}. Native builds may need separately installed system dependencies.`);
    const packagePath = packageFile(plan.dir, join(plan.dir, 'node_modules/@tobilu/qmd/package.json'));
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    if (pkg.name !== '@tobilu/qmd' || pkg.version !== '2.8.3') throw new Error('Installed QMD package does not match @tobilu/qmd@2.8.3.');
    const actualEntry = qmdEntry(plan.dir, packagePath, pkg);
    receipt.entry = actualEntry;
    const source = launcherSource(plan, actualEntry);
    writeFileSync(plan.launcher, source, { flag: 'wx', mode: 0o755 });
    const doctor = probeDoctor(plan, actualEntry, runner);
    receipt.status = 'installed';
    receipt.launcherSha256 = hash(source);
    receipt.doctor = doctor;
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    return { ...plan, status: doctor.status === 'error' ? 'error' : 'installed', engineStatus: 'installed', log, doctor,
      ...(doctor.status === 'error' ? { message: 'QMD engine installed, but upstream doctor failed. Inspect doctor.log for native/system dependencies; semantic initialization is pending.' } : {}), next: [
      ...(doctor.status === 'error' ? ['Inspect doctor.log; install only the missing system/native dependencies reported by upstream, then rerun doctor. Jarvis does not install CUDA DLLs, drivers or Toolkit.'] : []),
      'Invoke launch.command with launch.args plus QMD arguments; on Windows the .mjs file requires Node and is not a .cmd command. Existing connections are unchanged.',
      'Initialize models and explicitly selected asset indexes separately. Engine installation does not prove semantic readiness or model-download completion.'] };
  } catch (error) {
    return { ...plan, status: 'error', log, message: error.message, next: 'Preserve this directory for diagnosis. No models, indexes, system drivers or CUDA Toolkit were installed by Jarvis.' };
  }
}
