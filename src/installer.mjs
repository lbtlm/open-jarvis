import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';

import { roleKeys, effortNames, supportedEfforts, defaultModels } from './profiles.mjs';
import { resolveModels, patchConfig, renderRole, renderReviewer } from './platforms/codex.mjs';
import { platformAdapter, nativeModels, renderNativeRole, readExecutionProfile, checkNativeRoleCollisions } from './platforms/index.mjs';
import { assetRoot } from './asset-root.mjs';
import { checkAncestors } from './asset-paths.mjs';
export { supportedEfforts, defaultModels } from './profiles.mjs';

const PAYLOAD = fileURLToPath(new URL('../payload/', import.meta.url));
const START = '<!-- JARVIS_START -->';
const END = '<!-- JARVIS_END -->';
// Persistent receipt identity: keep recognizing installations made before the Open Jarvis rename.
const PACKAGE = 'codex-jarvis';
const MANIFEST_VERSION = 4;
const ROLE_KEYS = roleKeys;
const ROLE_NAMES = ROLE_KEYS.map(key => `jarvis_${key}`);
const EFFORTS = new Set(effortNames);
const MANAGED_PATHS = new Set([
  'jarvis-platform.json',
  'config.toml',
  'AGENTS.md',
  ...ROLE_KEYS.map(key => `agents/jarvis_${key}.toml`),
  'skills/jarvis-orchestrator/SKILL.md',
  'skills/jarvis-orchestrator/references/lifecycle.md',
  'skills/jarvis-orchestrator/references/employees.md',
  'skills/jarvis-orchestrator/references/employee-card.md',
  'skills/jarvis-orchestrator/references/assets.md',
  'skills/jarvis-orchestrator/references/domains.md',
  'skills/jarvis-orchestrator/references/platform.md',
]);
const installLocks = new Set();


function fail(message) {
  throw new Error(message);
}

function hash(data) {
  return createHash('sha256').update(data).digest('hex');
}

function decode(data) {
  return data.toString('utf8').replace(/^\uFEFF/, '');
}

function encodeLike(original, text) {
  const bom = original.length >= 3 && original[0] === 0xef && original[1] === 0xbb && original[2] === 0xbf;
  return Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(text)]);
}

function parseConfig(data, label = 'TOML') {
  try {
    return parseToml(decode(data));
  } catch {
    fail(`Invalid ${label}; check its syntax locally. No content was printed.`);
  }
}

function normalizeHome(value) {
  if (typeof value !== 'string' || value.length === 0) fail('options.home must be a non-empty absolute path.');
  if (!isAbsolute(value)) fail('options.home must be an absolute path.');
  const home = resolve(value);
  assertNoLinks(home, home);
  return home;
}

function validateRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) fail('Manifest contains an invalid path.');
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) fail(`Path escapes target: ${value}`);
  const parts = normalized.split('/');
  if (parts.some(part => part === '' || part === '.' || part === '..')) fail(`Path escapes target: ${value}`);
  return parts.join('/');
}

function targetPath(root, relativePath) {
  const clean = validateRelativePath(relativePath);
  const target = resolve(root, ...clean.split('/'));
  const rel = relative(resolve(root), target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) fail(`Path escapes target: ${relativePath}`);
  return target;
}

function assertNoLinks(root, target, includeTarget = true) {
  const absoluteRoot = resolve(root);
  try { checkAncestors(absoluteRoot); }
  catch { fail(`Refusing to use symlink or junction in native root ancestry: ${absoluteRoot}`); }
  const absoluteTarget = resolve(target);
  const rel = relative(absoluteRoot, absoluteTarget);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) fail('Path escapes protected root.');
  const paths = [absoluteRoot];
  let cursor = absoluteRoot;
  for (const part of rel.split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    paths.push(cursor);
  }
  if (!includeTarget) paths.pop();
  for (const item of paths) {
    if (existsSync(item) && lstatSync(item).isSymbolicLink()) fail(`Refusing to use symlink or junction: ${item}`);
  }
}

function fileMode(path, fallback = 0o600) {
  return existsSync(path) ? statSync(path).mode & 0o777 : fallback;
}

function atomicWrite(path, data, mode = undefined) {
  const parent = dirname(path);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const temp = join(parent, `.jarvis-${process.pid}-${randomUUID()}.tmp`);
  const selectedMode = mode ?? fileMode(path);
  let fd;
  try {
    fd = openSync(temp, 'wx', selectedMode);
    writeFileSync(fd, data);
    closeSync(fd);
    fd = undefined;
    chmodSync(temp, selectedMode);
    renameSync(temp, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temp)) unlinkSync(temp);
  }
}

function protectBackupDirectory(path) {
  if (process.platform !== 'win32') {
    chmodSync(path, 0o700);
    return;
  }
  const account = spawnSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
  if (account.status !== 0) fail('Could not determine the current Windows account for backup protection.');
  const match = account.stdout.match(/"([^"]*)"\s*,\s*"(S-[^"]+)"/i);
  if (!match) fail('Could not parse the current Windows account SID for backup protection.');
  const acl = spawnSync('icacls', [path, '/inheritance:r', '/grant:r', `*${match[2]}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (acl.status !== 0) fail('Could not restrict backup directory permissions.');
}




function patchInstructions(original, adapter = platformAdapter(), assetsHome) {
  let text = decode(original);
  let block = readFileSync(join(PAYLOAD, 'AGENTS.block.md'), 'utf8').replace(/^\uFEFF/, '').trim();
  if (assetsHome) block = block.replace(END, `\nJarvis platform: ${adapter.id}. Shared asset home: ${JSON.stringify(assetsHome)}. Read the local jarvis-platform.json and skills/jarvis-orchestrator/references/platform.md for native settings.\n${END}`);
  const starts = text.split(START).length - 1;
  const ends = text.split(END).length - 1;
  if (starts !== ends || starts > 1) fail('Malformed Jarvis markers; refusing instructions merge.');
  if (starts === 1) {
    const start = text.indexOf(START);
    const end = text.indexOf(END);
    if (end < start) fail('Reversed Jarvis markers; refusing instructions merge.');
    text = `${text.slice(0, start)}${block}${text.slice(end + END.length)}`;
  } else {
    text = `${text.trimEnd()}${text.trimEnd() ? '\n\n' : ''}${block}\n`;
  }
  return encodeLike(original, text);
}


function walkFiles(root, prefix = '') {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(root, entry.name);
    if (entry.isSymbolicLink()) fail(`Payload contains a symlink: ${rel}`);
    if (entry.isDirectory()) result.push(...walkFiles(full, rel));
    else if (entry.isFile()) result.push(rel);
  }
  return result.sort();
}

// Only this restrictive reviewer customization is supported. A trusted receipt and
// an exact package/baseline match must explain every other byte.

function desiredFiles(home, models, controllerEffortExplicit, prior, adapter, assetsHome) {
  assertNoLinks(home, home);
  const files = new Map();
  let reviewerSnapshot = null;
  for (const aggregate of adapter.id === 'codex' ? ['config.toml', adapter.instructions] : [adapter.instructions]) {
    const target = targetPath(home, aggregate);
    assertNoLinks(home, target);
    const before = existsSync(target) ? readFileSync(target) : Buffer.alloc(0);
    files.set(aggregate, aggregate === 'config.toml'
      ? patchConfig(before, models, controllerEffortExplicit)
      : patchInstructions(before, adapter, assetsHome));
  }
  for (const key of ROLE_KEYS) {
    const relativePath = adapter.rolePath(key);
    const source = readFileSync(join(PAYLOAD, `agents/jarvis_${key}.toml`));
    let rendered = adapter.id === 'codex' ? renderRole(source, key, models) : renderNativeRole(adapter, key, source, models[key]);
    if (key === 'reviewer' && adapter.id === 'codex') {
      const target = targetPath(home, relativePath);
      assertNoLinks(home, target);
      reviewerSnapshot = existsSync(target) ? readFileSync(target) : null;
      rendered = renderReviewer(rendered, reviewerSnapshot, prior);
    }
    files.set(relativePath, rendered);
  }
  for (const relativePath of walkFiles(join(PAYLOAD, 'skills', 'jarvis-orchestrator'), 'skills/jarvis-orchestrator')) {
    files.set(relativePath, readFileSync(join(PAYLOAD, ...relativePath.split('/'))));
  }
  if (!files.has('skills/jarvis-orchestrator/SKILL.md')) fail('Payload is missing the orchestration skill.');
  files.set('jarvis-platform.json', Buffer.from(`${JSON.stringify({ version: 1, platform: adapter.id, assetsHome, instructions: adapter.instructions, capabilities: adapter.capabilities }, null, 2)}\n`));
  return { files, reviewerSnapshot };
}

function managedPaths(adapter) {
  return new Set([...MANAGED_PATHS].filter(path => !['config.toml', 'AGENTS.md'].includes(path) && !path.startsWith('agents/'))
    .concat(adapter.id === 'codex' ? ['config.toml', adapter.instructions] : [adapter.instructions], ROLE_KEYS.map(key => adapter.rolePath(key))));
}

function validateManifestShape(manifest, home, source, allowV1 = true, adapter = platformAdapter()) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail(`Invalid installation manifest: ${source}`);
  if (![...(allowV1 ? [1] : []), 2, 3, MANIFEST_VERSION].includes(manifest.version)) fail(`Unsupported installation manifest version: ${source}`);
  if (manifest.version < 4 ? adapter.id !== 'codex' || (manifest.platform !== undefined && manifest.platform !== 'codex') : manifest.platform !== adapter.id) fail('Installation manifest belongs to another platform.');
  const allowedPaths = managedPaths(adapter);
  if (typeof manifest.home !== 'string' || resolve(manifest.home) !== home) fail('Previous installation manifest does not match target home.');
  if (!['installed', 'rolled-back'].includes(manifest.status) || !Array.isArray(manifest.files)) fail(`Incomplete installation manifest: ${source}`);
  const changedPaths = new Set();
  for (const record of manifest.files) {
    if (!record || typeof record !== 'object') fail(`Invalid installation manifest record: ${source}`);
    const clean = validateRelativePath(record.path);
    if (!allowedPaths.has(clean)) fail(`Manifest contains an unmanaged path: ${clean}`);
    if (changedPaths.has(clean)) fail(`Manifest contains a duplicate path: ${clean}`);
    changedPaths.add(clean);
    if (record.before !== null && !/^[a-f0-9]{64}$/.test(record.before ?? '')) fail(`Invalid manifest checksum: ${source}`);
    if (!/^[a-f0-9]{64}$/.test(record.after ?? '')) fail(`Invalid manifest checksum: ${source}`);
  }
  if (manifest.version >= 2) {
    if (manifest.package !== PACKAGE || !Array.isArray(manifest.ownedFiles)) fail(`Incomplete owned manifest: ${source}`);
    const ownedPaths = new Set();
    for (const record of manifest.ownedFiles) {
      const clean = validateRelativePath(record.path);
      if (!allowedPaths.has(clean)) fail(`Manifest contains an unmanaged owned path: ${clean}`);
      if (ownedPaths.has(clean)) fail(`Manifest contains a duplicate owned path: ${clean}`);
      ownedPaths.add(clean);
      if (!/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) fail(`Invalid owned checksum: ${source}`);
    }
  }
  if (manifest.settings?.reviewerApprovalPolicy !== undefined && (manifest.version < 3 || manifest.settings.reviewerApprovalPolicy !== 'never')) {
    fail(`Unsupported reviewer approval policy in manifest: ${source}`);
  }
  return manifest;
}

function readManifest(path, home, allowV1 = true, adapter = platformAdapter()) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('Manifest paths must be absolute.');
  const absolute = resolve(path);
  if (!existsSync(absolute) || lstatSync(absolute).isSymbolicLink()) fail(`Manifest does not exist or is a symlink: ${absolute}`);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absolute, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    fail(`Invalid installation manifest JSON: ${absolute}`);
  }
  return validateManifestShape(manifest, home, absolute, allowV1, adapter);
}

function newestOwnedManifest(home, adapter = platformAdapter()) {
  const state = targetPath(home, 'jarvis-state');
  if (!existsSync(state)) return undefined;
  assertNoLinks(home, state);
  const candidates = [];
  const visit = directory => {
    assertNoLinks(home, directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name === 'manifest.json') {
        try {
          const manifest = readManifest(full, home, false, adapter);
          if (manifest.status === 'installed') candidates.push({ path: full, manifest, mtime: statSync(full).mtimeMs });
        } catch {
          // An unrelated or incomplete state file grants no ownership.
        }
      }
    }
  };
  visit(state);
  candidates.sort((a, b) => b.mtime - a.mtime || b.path.localeCompare(a.path));
  return candidates[0];
}

function ownership(options, home) {
  const adapter = platformAdapter(options.platform);
  const explicit = options.previousManifests;
  if (explicit !== undefined && !Array.isArray(explicit)) fail('previousManifests must be an array of absolute paths.');
  const selected = [];
  if (explicit?.length) {
    for (const path of explicit) {
      if (typeof path !== 'string' || !isAbsolute(path)) fail('previousManifests must contain absolute paths.');
      const manifest = readManifest(path, home, true, adapter);
      if (manifest.status !== 'installed') fail('A rolled-back manifest cannot grant upgrade ownership.');
      selected.push({ path: resolve(path), manifest });
    }
  } else {
    const automatic = newestOwnedManifest(home, adapter);
    if (automatic) selected.push(automatic);
  }
  const owned = new Map();
  for (const { manifest } of selected) {
    const records = manifest.version === 1
      ? manifest.files.map(record => ({ path: record.path, sha256: record.after }))
      : manifest.ownedFiles;
    for (const record of records) owned.set(validateRelativePath(record.path), record.sha256);
  }
  const latestSettings = [...selected].reverse().find(item => item.manifest.version >= 2)?.manifest?.settings?.models;
  const reviewerApprovalPolicy = [...selected].reverse().find(item => item.manifest.version >= 2)?.manifest?.settings?.reviewerApprovalPolicy;
  return { owned, manifests: selected.map(item => item.path), models: latestSettings, reviewerApprovalPolicy };
}

function checkRoleCollisions(home, desired) {
  const agents = targetPath(home, 'agents');
  if (!existsSync(agents)) return;
  assertNoLinks(home, agents);
  for (const entry of readdirSync(agents, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) fail(`Refusing symlink in agents directory: ${entry.name}`);
    if (!entry.isFile() || !entry.name.endsWith('.toml')) continue;
    const relativePath = `agents/${entry.name}`;
    const data = parseConfig(readFileSync(join(agents, entry.name)), relativePath);
    if (ROLE_NAMES.includes(data.name) && !desired.has(relativePath)) fail(`Role name collision: ${entry.name}`);
  }
}

function plan(options) {
  const home = normalizeHome(options?.home);
  const adapter = platformAdapter(options.platform);
  const assetsHome = assetRoot(options);
  const prior = ownership(options, home);
  const models = adapter.id === 'codex' ? resolveModels(options.models, options.controllerEffort, prior.models ?? defaultModels)
    : nativeModels(adapter, options.models, prior.models, options.controllerEffort);
  const effortExplicit = options.controllerEffort !== undefined || options.models?.controller?.effort !== undefined;
  const { files: desired, reviewerSnapshot } = desiredFiles(home, models, effortExplicit, prior, adapter, assetsHome);
  // Record the effective controller choice rather than a stale receipt default.
  if (adapter.id === 'codex') models.controller.effort = parseConfig(desired.get('config.toml')).model_reasoning_effort;
  const reviewerApprovalPolicy = adapter.id === 'codex' ? parseConfig(desired.get('agents/jarvis_reviewer.toml')).approval_policy : undefined;
  if (adapter.id === 'codex') checkRoleCollisions(home, desired);
  else checkNativeRoleCollisions(adapter, home);
  const changes = [];
  for (const [relativePath, content] of desired) {
    const target = targetPath(home, relativePath);
    assertNoLinks(home, target);
    const before = existsSync(target) ? readFileSync(target) : null;
    if (relativePath === 'agents/jarvis_reviewer.toml'
      && ((before === null) !== (reviewerSnapshot === null) || (before !== null && !before.equals(reviewerSnapshot)))) {
      fail(`Concurrent edit detected: ${relativePath}`);
    }
    if (before?.equals(content)) continue;
    const priorHash = prior.owned.get(relativePath);
    const aggregate = relativePath === 'config.toml' || relativePath === adapter.instructions;
    const preservedReviewer = relativePath === 'agents/jarvis_reviewer.toml' && reviewerApprovalPolicy === 'never';
    if (before !== null && hash(before) !== priorHash && !preservedReviewer) {
      if (aggregate && prior.owned.size) fail(`Modified aggregate file needs manual merge: ${relativePath}`);
      if (!aggregate) fail(`Existing different file needs manual merge: ${relativePath}`);
    }
    changes.push({ relativePath, target, before, content, beforeMode: before === null ? null : fileMode(target), afterMode: before === null ? (relativePath === 'config.toml' ? 0o600 : 0o644) : fileMode(target) });
  }
  const ownershipRefresh = prior.manifests.length > 0 && (
    [...desired].some(([path, content]) => prior.owned.get(path) !== hash(content))
    || !isDeepStrictEqual(models, prior.models)
    || reviewerApprovalPolicy !== prior.reviewerApprovalPolicy);
  return { home, assetsHome, adapter, models, desired, changes, ownershipRefresh, reviewerApprovalPolicy, priorManifests: prior.manifests };
}

export function audit(options = {}) {
  const prepared = plan(options);
  const selected = Object.fromEntries(Object.entries(prepared.models).map(([key, value]) => [key, { ...value }]));
  const generatedConfig = prepared.adapter.id === 'codex' ? parseConfig(prepared.desired.get('config.toml'), 'generated config.toml') : null;
  if (generatedConfig) selected.controller.effort = generatedConfig.model_reasoning_effort;
  if (['fast', 'priority'].includes(generatedConfig?.service_tier)) selected.controller.fast = true;
  else if (generatedConfig?.service_tier === 'default') selected.controller.fast = false;
  return {
    status: 'validated-candidate',
    target: prepared.home,
    platform: prepared.adapter.id,
    assetsHome: prepared.assetsHome,
    capabilities: prepared.adapter.capabilities,
    filesChanged: prepared.changes.length,
    files: [...prepared.desired].map(([path, content]) => ({ path, willChange: prepared.changes.some(change => change.relativePath === path), sha256: hash(content) })),
    ownershipManifests: prepared.priorManifests,
    ownershipRefresh: prepared.ownershipRefresh,
    models: selected,
    serviceTier: generatedConfig?.service_tier ?? null,
    maxSubagents: generatedConfig ? Math.min(3, generatedConfig.agents.max_concurrent_threads_per_session) : 3,
    ...(generatedConfig ? { codexMaxSubagents: generatedConfig.agents.max_concurrent_threads_per_session } : {}),
  };
}

export function recommend(options = {}) {
  const home = normalizeHome(options?.home);
  // Prefill from the same validated receipt selection used by audit/install.
  // Otherwise CLI and wizard defaults can override an explicit legacy receipt.
  const prior = ownership(options, home);
  const adapter = platformAdapter(options.platform);
  if (adapter.id !== 'codex') return { target: home, platform: adapter.id, models: nativeModels(adapter, options.models, prior.models, options.controllerEffort), serviceTier: null };
  let base = prior.models ?? defaultModels;
  const configPath = targetPath(home, 'config.toml');
  let serviceTier = null;
  let hasConfig = false;
  if (existsSync(configPath)) {
    assertNoLinks(home, configPath);
    const config = parseConfig(readFileSync(configPath), 'config.toml');
    hasConfig = true;
    const controller = { ...(base.controller ?? defaultModels.controller) };
    if (typeof config.model === 'string' && config.model.length && !/\s|[\u0000-\u001f\u007f]/.test(config.model)) controller.model = config.model;
    if (typeof config.model_reasoning_effort === 'string' && EFFORTS.has(config.model_reasoning_effort)) {
      controller.effort = config.model_reasoning_effort;
    }
    serviceTier = typeof config.service_tier === 'string' ? config.service_tier : null;
    if (['fast', 'priority'].includes(serviceTier)) controller.fast = true;
    else if (serviceTier === 'default') controller.fast = false;
    base = { ...base, controller };
  }
  const models = resolveModels(options.models, options.controllerEffort, base);
  if (!prior.manifests.length && !hasConfig) {
    for (const value of Object.values(models)) {
      if (!Object.hasOwn(value, 'fast')) value.fast = false;
    }
    serviceTier = models.controller.fast ? 'fast' : 'default';
  }
  return { target: home, models, serviceTier };
}

function restorePartial(written) {
  for (const change of [...written].reverse()) {
    assertNoLinks(change.home, change.target);
    if (!existsSync(change.target) || !readFileSync(change.target).equals(change.content)) continue;
    if (change.before === null) unlinkSync(change.target);
    else atomicWrite(change.target, change.before, change.beforeMode);
  }
}

function acquireOperationLock(home) {
  const state = targetPath(home, 'jarvis-state');
  assertNoLinks(home, state);
  mkdirSync(state, { recursive: true, mode: 0o700 });
  assertNoLinks(home, state);
  const lock = join(state, 'install.lock');
  const token = JSON.stringify({ id: randomUUID(), pid: process.pid, startedAt: new Date().toISOString() });
  let fd;
  try {
    fd = openSync(lock, 'wx', 0o600);
    writeFileSync(fd, token);
    closeSync(fd);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    if (error?.code === 'EEXIST') fail(`An install or rollback lock already exists: ${lock}. Inspect it manually; it was not deleted.`);
    throw error;
  }
  return () => {
    if (existsSync(lock) && !lstatSync(lock).isSymbolicLink() && readFileSync(lock, 'utf8') === token) unlinkSync(lock);
  };
}

export function install(options = {}) {
  const home = normalizeHome(options?.home);
  if (installLocks.has(home)) fail(`An install is already running for ${home}.`);
  installLocks.add(home);
  try {
    const preview = plan(options);
    if (preview.changes.length === 0 && !preview.ownershipRefresh) return { status: 'already-installed', filesChanged: 0, target: home, platform: preview.adapter.id, assetsHome: preview.assetsHome };
    const releaseLock = acquireOperationLock(home);
    try {
      const prepared = plan(options);
      if (prepared.changes.length === 0 && !prepared.ownershipRefresh) return { status: 'already-installed', filesChanged: 0, target: home, platform: prepared.adapter.id, assetsHome: prepared.assetsHome };
      const state = targetPath(home, 'jarvis-state');
      const backup = join(state, 'backups', `${new Date().toISOString().replaceAll(/[-:.]/g, '')}-${randomUUID()}`);
      assertNoLinks(home, state);
      mkdirSync(dirname(backup), { recursive: true, mode: 0o700 });
      assertNoLinks(home, dirname(backup));
      mkdirSync(backup, { recursive: false, mode: 0o700 });
      protectBackupDirectory(backup);
      const manifestPath = join(backup, 'manifest.json');
      const records = prepared.changes.map(change => ({
      path: change.relativePath,
      before: change.before === null ? null : hash(change.before),
      after: hash(change.content),
      beforeMode: change.beforeMode,
      afterMode: change.afterMode,
      }));
      const manifest = {
      version: MANIFEST_VERSION,
      package: PACKAGE,
      platform: prepared.adapter.id,
      home,
      status: 'prepared',
      createdAt: new Date().toISOString(),
      settings: { models: prepared.models, assetsHome: prepared.assetsHome,
        ...(prepared.reviewerApprovalPolicy ? { reviewerApprovalPolicy: prepared.reviewerApprovalPolicy } : {}) },
      previousManifests: prepared.priorManifests,
      files: records,
      ownedFiles: [...prepared.desired].map(([path, content]) => ({ path, sha256: hash(content) })),
      };
      for (const change of prepared.changes) {
        if (change.before !== null) {
          const backupPath = targetPath(join(backup, 'original'), change.relativePath);
          atomicWrite(backupPath, change.before, 0o600);
        }
      }
      atomicWrite(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)), 0o600);
      const written = [];
      try {
        for (const change of prepared.changes) {
          assertNoLinks(home, change.target);
          const current = existsSync(change.target) ? readFileSync(change.target) : null;
          if ((current === null) !== (change.before === null) || (current && !current.equals(change.before))) {
            fail(`Concurrent edit detected: ${change.relativePath}`);
          }
          atomicWrite(change.target, change.content, change.afterMode);
          written.push({ ...change, home });
        }
        // Unchanged files also grant ownership in the new receipt. Validate them
        // under the operation lock, including zero-content ownership refreshes.
        for (const [path, content] of prepared.desired) {
          const target = targetPath(home, path);
          assertNoLinks(home, target);
          if (!existsSync(target) || !readFileSync(target).equals(content)) fail(`Concurrent edit detected: ${path}`);
        }
        manifest.status = 'installed';
        atomicWrite(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)), 0o600);
      } catch (error) {
        restorePartial(written);
        throw error;
      }
      return { status: 'installed', platform: prepared.adapter.id, assetsHome: prepared.assetsHome, target: home, filesChanged: prepared.changes.length, manifest: manifestPath,
        activation: prepared.adapter.capabilities.activation, runtimeVerification: 'not-performed' };
    } finally {
      releaseLock();
    }
  } finally {
    installLocks.delete(home);
  }
}

function planRollback(home, manifestPath, adapter) {
  const manifest = readManifest(manifestPath, home, true, adapter);
  const backupRoot = join(dirname(resolve(manifestPath)), 'original');
  const restores = [];
  for (const record of manifest.files) {
    const target = targetPath(home, record.path);
    assertNoLinks(home, target);
    const current = existsSync(target) ? hash(readFileSync(target)) : null;
    if (current === record.before) continue;
    if (current !== record.after) fail(`Changed after installation; preserve for manual merge: ${record.path}`);
    let original = null;
    if (record.before !== null) {
      const backup = targetPath(backupRoot, record.path);
      assertNoLinks(backupRoot, backup);
      if (!existsSync(backup)) fail(`Backup is missing: ${record.path}`);
      original = readFileSync(backup);
      if (hash(original) !== record.before) fail(`Backup checksum mismatch: ${record.path}`);
    }
    restores.push({ record, target, original, expected: current });
  }
  return { manifest, restores };
}

export function rollback(options = {}) {
  const home = normalizeHome(options?.home);
  const adapter = platformAdapter(options.platform);
  const manifestPath = options.manifest;
  if (typeof manifestPath !== 'string' || !isAbsolute(manifestPath)) fail('rollback requires an absolute manifest path.');
  planRollback(home, manifestPath, adapter);
  const releaseLock = acquireOperationLock(home);
  try {
    const { manifest, restores } = planRollback(home, manifestPath, adapter);
    for (const item of restores) {
      assertNoLinks(home, item.target);
      const current = existsSync(item.target) ? hash(readFileSync(item.target)) : null;
      if (current !== item.expected) fail(`Concurrent edit during rollback: ${item.record.path}`);
      if (item.original === null) unlinkSync(item.target);
      else atomicWrite(item.target, item.original, item.record.beforeMode ?? 0o600);
    }
    if (manifest.version >= 2) {
      manifest.status = 'rolled-back';
      manifest.rolledBackAt = new Date().toISOString();
      atomicWrite(resolve(manifestPath), Buffer.from(JSON.stringify(manifest, null, 2)), 0o600);
    }
    return { status: 'rolled-back', platform: adapter.id, target: home, filesRestored: restores.length, manifest: resolve(manifestPath) };
  } finally {
    releaseLock();
  }
}

function checkResult(name, ok, message, path = undefined) {
  return { name, ok, message, ...(path ? { path } : {}) };
}

export function doctor(options = {}) {
  const home = normalizeHome(options?.home);
  const adapter = platformAdapter(options.platform);
  if (adapter.id !== 'codex') return nativeDoctor(options, adapter);
  const manifestInfo = newestOwnedManifest(home, adapter);
  const expectedModels = resolveModels(undefined, undefined, manifestInfo?.manifest?.settings?.models ?? defaultModels);
  const checks = [];
  const bindingPath = targetPath(home, 'jarvis-platform.json');
  if (manifestInfo?.manifest.version >= 4) {
    const expectedHash = manifestInfo.manifest.ownedFiles.find(file => file.path === 'jarvis-platform.json')?.sha256;
    checks.push(checkResult('platform-binding', existsSync(bindingPath) && hash(readFileSync(bindingPath)) === expectedHash, 'Platform binding must match its installation receipt.', 'jarvis-platform.json'));
  }
  const configPath = targetPath(home, 'config.toml');
  if (!existsSync(configPath)) {
    checks.push(checkResult('config', false, 'config.toml is not installed.', 'config.toml'));
  } else {
    try {
      assertNoLinks(home, configPath);
      const config = parseConfig(readFileSync(configPath), 'config.toml');
      const agents = config.agents ?? {};
      const configOk = config.model === expectedModels.controller.model
        && supportedEfforts(config.model).includes(config.model_reasoning_effort)
        && agents.enabled === true
        && agents.default_subagent_model === expectedModels.terra.model
        && agents.default_subagent_reasoning_effort === expectedModels.terra.effort
        && Number.isSafeInteger(agents.max_concurrent_threads_per_session)
        && agents.max_concurrent_threads_per_session >= 1
        && !Object.hasOwn(agents, 'max_threads')
        && !ROLE_NAMES.some(name => Object.hasOwn(agents, name))
        && (!Object.hasOwn(expectedModels.controller, 'fast')
          || (config.service_tier === (expectedModels.controller.fast ? 'fast' : 'default')
            && (!expectedModels.controller.fast || config.features?.fast_mode === true)));
      checks.push(checkResult('config', configOk, configOk ? 'Required modern agent settings are present.' : 'Required modern agent settings do not match the installed Jarvis mapping.', 'config.toml'));
    } catch (error) {
      checks.push(checkResult('config', false, error.message, 'config.toml'));
    }
  }
  const agentsPath = targetPath(home, 'agents');
  for (const key of ROLE_KEYS) {
    const relativePath = `agents/jarvis_${key}.toml`;
    const rolePath = targetPath(home, relativePath);
    let ok = false;
    if (existsSync(rolePath)) {
      try {
        assertNoLinks(home, rolePath);
        const raw = readFileSync(rolePath);
        let expected = renderRole(readFileSync(join(PAYLOAD, relativePath)), key, expectedModels);
        if (key === 'reviewer') expected = renderReviewer(expected, raw, ownership({}, home));
        const role = parseConfig(raw, relativePath);
        ok = role.name === `jarvis_${key}` && role.model === expectedModels[key].model
          && role.model_reasoning_effort === expectedModels[key].effort
          && typeof role.description === 'string' && role.description.length > 0
          && typeof role.developer_instructions === 'string' && role.developer_instructions.length > 0
          && (!Object.hasOwn(expectedModels[key], 'fast')
            || (role.service_tier === (expectedModels[key].fast ? 'fast' : 'default')
              && (!expectedModels[key].fast || role.features?.fast_mode === true)));
        if (key === 'reviewer') ok = ok && role.sandbox_mode === 'read-only';
        ok = ok && raw.equals(expected);
      } catch {
        ok = false;
      }
    }
    checks.push(checkResult(`role:${key}`, ok,
      ok ? 'Role file matches the current package payload and installed mapping.' : 'Role file is missing or differs from the current package payload or installed mapping.',
      relativePath));
  }
  if (existsSync(agentsPath)) {
    try { assertNoLinks(home, agentsPath); } catch (error) { checks.push(checkResult('agents-path', false, error.message, 'agents')); }
  }
  const instructionsPath = targetPath(home, 'AGENTS.md');
  let instructionsOk = false;
  if (existsSync(instructionsPath)) {
    try {
      assertNoLinks(home, instructionsPath);
      const raw = readFileSync(instructionsPath);
      const instructions = decode(raw);
      const markersOk = instructions.split(START).length - 1 === 1 && instructions.split(END).length - 1 === 1
        && instructions.indexOf(START) < instructions.indexOf(END);
      instructionsOk = markersOk && raw.equals(patchInstructions(raw, adapter, assetRoot(options)));
    } catch {
      instructionsOk = false;
    }
  }
  checks.push(checkResult('instructions', instructionsOk,
    instructionsOk ? 'Jarvis instruction block matches the current package payload.' : 'Jarvis instruction block is missing, malformed or differs from the current package payload.',
    'AGENTS.md'));
  for (const [name, relativePath] of [
    ['main', 'skills/jarvis-orchestrator/SKILL.md'],
    ['lifecycle', 'skills/jarvis-orchestrator/references/lifecycle.md'],
    ['employees', 'skills/jarvis-orchestrator/references/employees.md'],
    ['employee-card', 'skills/jarvis-orchestrator/references/employee-card.md'],
    ['assets', 'skills/jarvis-orchestrator/references/assets.md'],
    ['domains', 'skills/jarvis-orchestrator/references/domains.md'],
    ['platform', 'skills/jarvis-orchestrator/references/platform.md'],
  ]) {
    const skillPath = targetPath(home, relativePath);
    let skillOk = false;
    if (existsSync(skillPath) && !lstatSync(skillPath).isSymbolicLink()) {
      const raw = readFileSync(skillPath);
      const expected = readFileSync(join(PAYLOAD, ...relativePath.split('/')));
      skillOk = raw.equals(expected);
    }
    checks.push(checkResult(`skill:${name}`, skillOk,
      skillOk ? 'Orchestration skill file matches the current package payload.' : 'Orchestration skill file is missing or differs from the current package payload.', relativePath));
  }
  const ok = checks.every(check => check.ok);
  return {
    status: ok ? 'healthy' : (manifestInfo ? 'misconfigured' : 'not-installed'),
    ok,
    target: home,
    platform: adapter.id,
    assetsHome: assetRoot(options),
    capabilities: adapter.capabilities,
    checks,
    staticValidation: ok ? 'healthy' : (manifestInfo ? 'drift-detected' : 'not-installed'),
    runtimeVerification: 'not-performed',
    runtimeNote: 'This check does not prove that native Jarvis roles are callable in the current runtime.',
  };
}

function nativeDoctor(options, adapter) {
  const home = normalizeHome(options.home);
  const prior = ownership(options, home);
  const assetsHome = assetRoot(options);
  const models = nativeModels(adapter, undefined, prior.models);
  const checks = [];
  try {
    checkNativeRoleCollisions(adapter, home);
    const expected = desiredFiles(home, models, false, prior, adapter, assetsHome).files;
    for (const [path, content] of expected) {
      let ok = false;
      try {
        const target = targetPath(home, path);
        assertNoLinks(home, target);
        ok = existsSync(target) && readFileSync(target).equals(content);
        if (path === 'jarvis-platform.json' && prior.owned.size) ok = ok && hash(content) === prior.owned.get(path);
        if (path.startsWith('agents/')) readExecutionProfile(adapter, home, path.match(/jarvis-(.+)\.md$/)[1]);
      } catch { ok = false; }
      checks.push(checkResult(path, ok, ok ? 'Managed file matches the platform payload and settings.' : 'Managed file is missing or has drifted.', path));
    }
  } catch (error) { checks.push(checkResult('configuration', false, error.message)); }
  const ok = checks.every(check => check.ok);
  return { status: ok ? 'healthy' : prior.manifests.length ? 'misconfigured' : 'not-installed', ok, target: home, platform: adapter.id, assetsHome, checks,
    capabilities: adapter.capabilities, staticValidation: ok ? 'healthy' : 'drift-detected', runtimeVerification: 'not-performed',
    runtimeNote: 'Static files do not prove client loading, model availability, effective permissions or dispatch. Client version and account policy must be verified separately.' };
}
