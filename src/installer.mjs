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

const PAYLOAD = fileURLToPath(new URL('../payload/', import.meta.url));
const START = '<!-- JARVIS_START -->';
const END = '<!-- JARVIS_END -->';
const PACKAGE = 'codex-jarvis';
const MANIFEST_VERSION = 2;
const ROLE_KEYS = ['luna', 'terra', 'sol', 'reviewer'];
const ROLE_NAMES = ROLE_KEYS.map(key => `jarvis_${key}`);
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const MANAGED_PATHS = new Set([
  'config.toml',
  'AGENTS.md',
  ...ROLE_KEYS.map(key => `agents/jarvis_${key}.toml`),
  'skills/jarvis-orchestrator/SKILL.md',
  'skills/jarvis-orchestrator/references/lifecycle.md',
]);
const installLocks = new Set();

export const defaultModels = Object.freeze({
  controller: Object.freeze({ model: 'gpt-6-astra', effort: 'high' }),
  luna: Object.freeze({ model: 'gpt-5.6-luna', effort: 'medium' }),
  terra: Object.freeze({ model: 'gpt-5.6-terra', effort: 'medium' }),
  sol: Object.freeze({ model: 'gpt-5.6-sol', effort: 'high' }),
  reviewer: Object.freeze({ model: 'gpt-5.6-sol', effort: 'high' }),
});

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
  return resolve(value);
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

function resolveModels(overrides = undefined, controllerEffort = undefined, base = defaultModels) {
  if (overrides !== undefined && (!overrides || typeof overrides !== 'object' || Array.isArray(overrides))) {
    fail('options.models must be an object.');
  }
  const result = Object.fromEntries(Object.entries(defaultModels).map(([key, value]) => {
    const selected = base?.[key] ?? value;
    if (!selected || typeof selected.model !== 'string' || !selected.model || typeof selected.effort !== 'string' || !selected.effort) {
      fail(`Stored model mapping ${key} is invalid.`);
    }
    if (/\s|[\u0000-\u001f\u007f]/.test(selected.model)) fail(`Stored model mapping ${key}.model contains whitespace or control characters.`);
    if (!EFFORTS.has(selected.effort)) fail(`Stored model mapping ${key}.effort is unknown.`);
    return [key, {
      model: selected.model,
      effort: selected.effort,
      ...(Object.hasOwn(selected, 'fast') ? { fast: selected.fast } : {}),
    }];
  }));
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (!Object.hasOwn(result, key)) fail(`Unknown model mapping key: ${key}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Model mapping ${key} must be an object.`);
    const unknown = Object.keys(value).filter(field => !['model', 'effort', 'fast'].includes(field));
    if (unknown.length) fail(`Unknown field in model mapping ${key}: ${unknown[0]}`);
    if (!Object.hasOwn(value, 'model') && !Object.hasOwn(value, 'effort') && !Object.hasOwn(value, 'fast')) {
      fail(`Model mapping ${key} is empty.`);
    }
    for (const field of ['model', 'effort']) {
      if (Object.hasOwn(value, field) && (typeof value[field] !== 'string' || value[field].trim() === '')) {
        fail(`Model mapping ${key}.${field} must be a non-empty string.`);
      }
      if (Object.hasOwn(value, field)) result[key][field] = value[field];
    }
    if (Object.hasOwn(value, 'model') && /\s|[\u0000-\u001f\u007f]/.test(value.model)) {
      fail(`Model mapping ${key}.model contains whitespace or control characters.`);
    }
    if (Object.hasOwn(value, 'effort') && !EFFORTS.has(value.effort)) fail(`Unknown reasoning effort: ${value.effort}`);
    if (Object.hasOwn(value, 'fast')) {
      if (typeof value.fast !== 'boolean') fail(`Model mapping ${key}.fast must be boolean.`);
      result[key].fast = value.fast;
    }
  }
  if (controllerEffort !== undefined) {
    if (typeof controllerEffort !== 'string' || controllerEffort.trim() === '') fail('controllerEffort must be a non-empty string.');
    if (!EFFORTS.has(controllerEffort)) fail(`Unknown reasoning effort: ${controllerEffort}`);
    result.controller.effort = controllerEffort;
  }
  return result;
}

function splitLines(text) {
  return text.match(/.*?(?:\r\n|\n|$)/g).filter(line => line !== '');
}

function patchConfig(original, models, controllerEffortExplicit) {
  const text = decode(original);
  const parsed = parseConfig(original, 'config.toml');
  const agents = parsed.agents;
  if (agents && typeof agents === 'object' && Object.hasOwn(agents, 'max_threads')) {
    fail('Legacy agents.max_threads needs a reviewed runtime migration; no files changed.');
  }
  if (agents !== undefined && (typeof agents !== 'object' || Array.isArray(agents))) {
    fail('Existing agents setting is not a table; no files changed.');
  }
  if (agents !== undefined && !/^\s*\[agents\]\s*(?:#.*)?$/m.test(text) && /^\s*agents\s*=/m.test(text)) {
    fail('Inline agents table needs manual merge; no files changed.');
  }
  if (agents && ROLE_NAMES.some(name => Object.hasOwn(agents, name))) {
    fail('Existing config.toml Jarvis role declaration needs manual merge; no files changed.');
  }
  const controllerFastExplicit = Object.hasOwn(models.controller, 'fast');
  if (controllerFastExplicit && models.controller.fast && parsed.features !== undefined
      && (!parsed.features || typeof parsed.features !== 'object' || Array.isArray(parsed.features))) {
    fail('Existing features setting is not a table; no files changed.');
  }
  if (controllerFastExplicit && models.controller.fast && parsed.features !== undefined
      && !/^\s*\[features\]\s*(?:#.*)?$/m.test(text) && /^\s*features\s*=/m.test(text)) {
    fail('Inline features table needs manual merge; no files changed.');
  }

  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const selectedEffort = controllerEffortExplicit
    ? models.controller.effort
    : (typeof parsed.model_reasoning_effort === 'string' ? parsed.model_reasoning_effort : models.controller.effort);
  const targets = {
    '': {
      model: models.controller.model,
      model_reasoning_effort: selectedEffort,
      ...(controllerFastExplicit ? { service_tier: models.controller.fast ? 'fast' : 'default' } : {}),
    },
    agents: {
      enabled: true,
      default_subagent_model: models.terra.model,
      default_subagent_reasoning_effort: models.terra.effort,
      max_concurrent_threads_per_session: 3,
    },
    ...(controllerFastExplicit && models.controller.fast ? { features: { fast_mode: true } } : {}),
  };
  const seen = Object.fromEntries(Object.keys(targets).map(key => [key, new Set()]));
  const output = [];
  let section = '';
  const presentHeaders = new Set();
  const appendMissing = name => {
    if (!Object.hasOwn(targets, name)) return;
    for (const [key, value] of Object.entries(targets[name])) {
      if (seen[name].has(key)) continue;
      if (output.length && !/(?:\r\n|\n)$/.test(output.at(-1))) output[output.length - 1] += newline;
      output.push(`${key} = ${JSON.stringify(value)}${newline}`);
      seen[name].add(key);
    }
  };
  for (const line of splitLines(text)) {
    const trimmed = line.replace(/(?:\r\n|\n)$/, '').trim();
    const header = trimmed.match(/^\[([^\[\]]+)\]\s*(?:#.*)?$/);
    const arrayHeader = /^\s*\[\[/.test(line);
    if (header || arrayHeader) {
      appendMissing(section);
      section = header ? header[1].trim() : '<array>';
      presentHeaders.add(section);
    }
    const assignment = line.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
    if (Object.hasOwn(targets, section) && assignment && Object.hasOwn(targets[section], assignment[1])) {
      const key = assignment[1];
      output.push(`${key} = ${JSON.stringify(targets[section][key])}${newline}`);
      seen[section].add(key);
    } else {
      output.push(line);
    }
  }
  appendMissing(section);
  for (const name of Object.keys(targets).filter(name => name && !presentHeaders.has(name))) {
    if (output.length && !/(?:\r\n|\n)$/.test(output.at(-1))) output[output.length - 1] += newline;
    output.push(`${newline}[${name}]${newline}`);
    appendMissing(name);
  }
  const result = output.join('');
  const after = parseConfig(Buffer.from(result), 'generated config.toml');
  const expected = parsed;
  expected.model = targets[''].model;
  expected.model_reasoning_effort = targets[''].model_reasoning_effort;
  expected.agents = { ...(expected.agents ?? {}), ...targets.agents };
  if (controllerFastExplicit) expected.service_tier = targets[''].service_tier;
  if (controllerFastExplicit && models.controller.fast) expected.features = { ...(expected.features ?? {}), fast_mode: true };
  if (!isDeepStrictEqual(after, expected)) fail('Config merge altered unrelated settings; refusing write.');
  return encodeLike(original, result);
}

function patchInstructions(original) {
  let text = decode(original);
  const block = readFileSync(join(PAYLOAD, 'AGENTS.block.md'), 'utf8').replace(/^\uFEFF/, '').trim();
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

function renderRole(source, key, models) {
  const data = parseConfig(source, `payload role jarvis_${key}.toml`);
  if (data.name !== `jarvis_${key}` || !data.description || !data.developer_instructions) {
    fail(`Incomplete or incorrect payload role: jarvis_${key}`);
  }
  let text = decode(source)
    .replace(/(?:\r?\n)?^\s*service_tier\s*=.*(?:\r?\n|$)/m, '\n')
    .replace(/(?:\r?\n)?^\s*\[features\]\s*(?:#.*)?\r?\n\s*fast_mode\s*=\s*(?:true|false)\s*(?:#.*)?(?:\r?\n|$)/m, '\n');
  const replace = (field, value) => {
    const pattern = new RegExp(`^\\s*${field}\\s*=.*$`, 'm');
    if (!pattern.test(text)) fail(`Payload role jarvis_${key} is missing ${field}.`);
    text = text.replace(pattern, `${field} = ${JSON.stringify(value)}`);
  };
  replace('model', models[key].model);
  replace('model_reasoning_effort', models[key].effort);
  if (Object.hasOwn(models[key], 'fast')) {
    if (/^\s*service_tier\s*=/m.test(text)) {
      text = text.replace(/^\s*service_tier\s*=.*$/m, `service_tier = ${JSON.stringify(models[key].fast ? 'fast' : 'default')}`);
    } else {
      text = text.replace(/^\s*model_reasoning_effort\s*=.*$/m, match => `${match}\nservice_tier = ${JSON.stringify(models[key].fast ? 'fast' : 'default')}`);
    }
    if (models[key].fast) {
      if (/^\s*\[features\]\s*(?:#.*)?$/m.test(text)) {
        if (/^\s*fast_mode\s*=/m.test(text)) text = text.replace(/^\s*fast_mode\s*=.*$/m, 'fast_mode = true');
        else text = text.replace(/^\s*\[features\]\s*(?:#.*)?$/m, match => `${match}\nfast_mode = true`);
      } else {
        text = `${text.trimEnd()}\n\n[features]\nfast_mode = true\n`;
      }
    }
  }
  const rendered = encodeLike(source, text);
  const checked = parseConfig(rendered, `rendered role jarvis_${key}.toml`);
  if (checked.model !== models[key].model || checked.model_reasoning_effort !== models[key].effort) {
    fail(`Could not render model mapping for jarvis_${key}.`);
  }
  if (Object.hasOwn(models[key], 'fast')) {
    const expectedTier = models[key].fast ? 'fast' : 'default';
    if (checked.service_tier !== expectedTier || (models[key].fast && checked.features?.fast_mode !== true)) {
      fail(`Could not render speed mapping for jarvis_${key}.`);
    }
  }
  return rendered;
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

function desiredFiles(home, models, controllerEffortExplicit) {
  assertNoLinks(home, home);
  const files = new Map();
  for (const aggregate of ['config.toml', 'AGENTS.md']) {
    const target = targetPath(home, aggregate);
    assertNoLinks(home, target);
    const before = existsSync(target) ? readFileSync(target) : Buffer.alloc(0);
    files.set(aggregate, aggregate === 'config.toml'
      ? patchConfig(before, models, controllerEffortExplicit)
      : patchInstructions(before));
  }
  for (const key of ROLE_KEYS) {
    const relativePath = `agents/jarvis_${key}.toml`;
    files.set(relativePath, renderRole(readFileSync(join(PAYLOAD, relativePath)), key, models));
  }
  for (const relativePath of walkFiles(join(PAYLOAD, 'skills', 'jarvis-orchestrator'), 'skills/jarvis-orchestrator')) {
    files.set(relativePath, readFileSync(join(PAYLOAD, ...relativePath.split('/'))));
  }
  if (!files.has('skills/jarvis-orchestrator/SKILL.md')) fail('Payload is missing the orchestration skill.');
  return files;
}

function validateManifestShape(manifest, home, source, allowV1 = true) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail(`Invalid installation manifest: ${source}`);
  if (![...(allowV1 ? [1] : []), MANIFEST_VERSION].includes(manifest.version)) fail(`Unsupported installation manifest version: ${source}`);
  if (typeof manifest.home !== 'string' || resolve(manifest.home) !== home) fail('Previous installation manifest does not match target home.');
  if (!['installed', 'rolled-back'].includes(manifest.status) || !Array.isArray(manifest.files)) fail(`Incomplete installation manifest: ${source}`);
  const changedPaths = new Set();
  for (const record of manifest.files) {
    if (!record || typeof record !== 'object') fail(`Invalid installation manifest record: ${source}`);
    const clean = validateRelativePath(record.path);
    if (!MANAGED_PATHS.has(clean)) fail(`Manifest contains an unmanaged path: ${clean}`);
    if (changedPaths.has(clean)) fail(`Manifest contains a duplicate path: ${clean}`);
    changedPaths.add(clean);
    if (record.before !== null && !/^[a-f0-9]{64}$/.test(record.before ?? '')) fail(`Invalid manifest checksum: ${source}`);
    if (!/^[a-f0-9]{64}$/.test(record.after ?? '')) fail(`Invalid manifest checksum: ${source}`);
  }
  if (manifest.version === MANIFEST_VERSION) {
    if (manifest.package !== PACKAGE || !Array.isArray(manifest.ownedFiles)) fail(`Incomplete owned manifest: ${source}`);
    const ownedPaths = new Set();
    for (const record of manifest.ownedFiles) {
      const clean = validateRelativePath(record.path);
      if (!MANAGED_PATHS.has(clean)) fail(`Manifest contains an unmanaged owned path: ${clean}`);
      if (ownedPaths.has(clean)) fail(`Manifest contains a duplicate owned path: ${clean}`);
      ownedPaths.add(clean);
      if (!/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) fail(`Invalid owned checksum: ${source}`);
    }
  }
  return manifest;
}

function readManifest(path, home, allowV1 = true) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('Manifest paths must be absolute.');
  const absolute = resolve(path);
  if (!existsSync(absolute) || lstatSync(absolute).isSymbolicLink()) fail(`Manifest does not exist or is a symlink: ${absolute}`);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absolute, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    fail(`Invalid installation manifest JSON: ${absolute}`);
  }
  return validateManifestShape(manifest, home, absolute, allowV1);
}

function newestOwnedManifest(home) {
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
          const manifest = readManifest(full, home, false);
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
  const explicit = options.previousManifests;
  if (explicit !== undefined && !Array.isArray(explicit)) fail('previousManifests must be an array of absolute paths.');
  const selected = [];
  if (explicit?.length) {
    for (const path of explicit) {
      if (typeof path !== 'string' || !isAbsolute(path)) fail('previousManifests must contain absolute paths.');
      const manifest = readManifest(path, home);
      if (manifest.status !== 'installed') fail('A rolled-back manifest cannot grant upgrade ownership.');
      selected.push({ path: resolve(path), manifest });
    }
  } else {
    const automatic = newestOwnedManifest(home);
    if (automatic) selected.push(automatic);
  }
  const owned = new Map();
  for (const { manifest } of selected) {
    const records = manifest.version === 1
      ? manifest.files.map(record => ({ path: record.path, sha256: record.after }))
      : manifest.ownedFiles;
    for (const record of records) owned.set(validateRelativePath(record.path), record.sha256);
  }
  const latestSettings = [...selected].reverse().find(item => item.manifest.version === MANIFEST_VERSION)?.manifest?.settings?.models;
  return { owned, manifests: selected.map(item => item.path), models: latestSettings };
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
  const prior = ownership(options, home);
  const models = resolveModels(options.models, options.controllerEffort, prior.models ?? defaultModels);
  const effortExplicit = options.controllerEffort !== undefined || options.models?.controller?.effort !== undefined;
  const desired = desiredFiles(home, models, effortExplicit);
  checkRoleCollisions(home, desired);
  const changes = [];
  for (const [relativePath, content] of desired) {
    const target = targetPath(home, relativePath);
    assertNoLinks(home, target);
    const before = existsSync(target) ? readFileSync(target) : null;
    if (before?.equals(content)) continue;
    const priorHash = prior.owned.get(relativePath);
    const aggregate = relativePath === 'config.toml' || relativePath === 'AGENTS.md';
    if (before !== null && hash(before) !== priorHash) {
      if (aggregate && prior.owned.size) fail(`Modified aggregate file needs manual merge: ${relativePath}`);
      if (!aggregate) fail(`Existing different file needs manual merge: ${relativePath}`);
    }
    changes.push({ relativePath, target, before, content, beforeMode: before === null ? null : fileMode(target), afterMode: before === null ? (relativePath === 'config.toml' ? 0o600 : 0o644) : fileMode(target) });
  }
  return { home, models, desired, changes, priorManifests: prior.manifests };
}

export function audit(options = {}) {
  const prepared = plan(options);
  const selected = Object.fromEntries(Object.entries(prepared.models).map(([key, value]) => [key, { ...value }]));
  const generatedConfig = parseConfig(prepared.desired.get('config.toml'), 'generated config.toml');
  selected.controller.effort = generatedConfig.model_reasoning_effort;
  if (['fast', 'priority'].includes(generatedConfig.service_tier)) selected.controller.fast = true;
  else if (generatedConfig.service_tier === 'default') selected.controller.fast = false;
  return {
    status: 'validated-candidate',
    target: prepared.home,
    filesChanged: prepared.changes.length,
    files: [...prepared.desired].map(([path, content]) => ({ path, willChange: prepared.changes.some(change => change.relativePath === path), sha256: hash(content) })),
    ownershipManifests: prepared.priorManifests,
    models: selected,
    serviceTier: generatedConfig.service_tier ?? null,
    maxSubagents: 3,
  };
}

export function recommend(options = {}) {
  const home = normalizeHome(options?.home);
  const active = newestOwnedManifest(home)?.manifest;
  let base = active?.settings?.models ?? defaultModels;
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
  if (!active && !hasConfig) {
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
    if (preview.changes.length === 0) return { status: 'already-installed', filesChanged: 0, target: home };
    const releaseLock = acquireOperationLock(home);
    try {
      const prepared = plan(options);
      if (prepared.changes.length === 0) return { status: 'already-installed', filesChanged: 0, target: home };
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
      home,
      status: 'prepared',
      createdAt: new Date().toISOString(),
      settings: { models: prepared.models },
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
        manifest.status = 'installed';
        atomicWrite(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2)), 0o600);
      } catch (error) {
        restorePartial(written);
        throw error;
      }
      return { status: 'installed', target: home, filesChanged: prepared.changes.length, manifest: manifestPath };
    } finally {
      releaseLock();
    }
  } finally {
    installLocks.delete(home);
  }
}

function planRollback(home, manifestPath) {
  const manifest = readManifest(manifestPath, home);
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
  const manifestPath = options.manifest;
  if (typeof manifestPath !== 'string' || !isAbsolute(manifestPath)) fail('rollback requires an absolute manifest path.');
  planRollback(home, manifestPath);
  const releaseLock = acquireOperationLock(home);
  try {
    const { manifest, restores } = planRollback(home, manifestPath);
    for (const item of restores) {
      assertNoLinks(home, item.target);
      const current = existsSync(item.target) ? hash(readFileSync(item.target)) : null;
      if (current !== item.expected) fail(`Concurrent edit during rollback: ${item.record.path}`);
      if (item.original === null) unlinkSync(item.target);
      else atomicWrite(item.target, item.original, item.record.beforeMode ?? 0o600);
    }
    if (manifest.version === MANIFEST_VERSION) {
      manifest.status = 'rolled-back';
      manifest.rolledBackAt = new Date().toISOString();
      atomicWrite(resolve(manifestPath), Buffer.from(JSON.stringify(manifest, null, 2)), 0o600);
    }
    return { status: 'rolled-back', target: home, filesRestored: restores.length, manifest: resolve(manifestPath) };
  } finally {
    releaseLock();
  }
}

function checkResult(name, ok, message, path = undefined) {
  return { name, ok, message, ...(path ? { path } : {}) };
}

export function doctor(options = {}) {
  const home = normalizeHome(options?.home);
  const manifestInfo = newestOwnedManifest(home);
  const expectedModels = resolveModels(undefined, undefined, manifestInfo?.manifest?.settings?.models ?? defaultModels);
  const ownedHashes = new Map((manifestInfo?.manifest?.ownedFiles ?? []).map(record => [record.path, record.sha256]));
  const checks = [];
  const configPath = targetPath(home, 'config.toml');
  if (!existsSync(configPath)) {
    checks.push(checkResult('config', false, 'config.toml is not installed.', 'config.toml'));
  } else {
    try {
      assertNoLinks(home, configPath);
      const config = parseConfig(readFileSync(configPath), 'config.toml');
      const agents = config.agents ?? {};
      const configOk = config.model === expectedModels.controller.model
        && EFFORTS.has(config.model_reasoning_effort)
        && agents.enabled === true
        && agents.default_subagent_model === expectedModels.terra.model
        && agents.default_subagent_reasoning_effort === expectedModels.terra.effort
        && agents.max_concurrent_threads_per_session === 3
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
        const role = parseConfig(raw, relativePath);
        ok = role.name === `jarvis_${key}` && role.model === expectedModels[key].model
          && role.model_reasoning_effort === expectedModels[key].effort
          && typeof role.description === 'string' && role.description.length > 0
          && typeof role.developer_instructions === 'string' && role.developer_instructions.length > 0
          && (!Object.hasOwn(expectedModels[key], 'fast')
            || (role.service_tier === (expectedModels[key].fast ? 'fast' : 'default')
              && (!expectedModels[key].fast || role.features?.fast_mode === true)));
        if (key === 'reviewer') ok = ok && role.sandbox_mode === 'read-only';
        if (ownedHashes.has(relativePath)) ok = ok && hash(raw) === ownedHashes.get(relativePath);
      } catch {
        ok = false;
      }
    }
    checks.push(checkResult(`role:${key}`, ok, ok ? 'Role file matches the installed mapping.' : 'Role file is missing or mismatched.', relativePath));
  }
  if (existsSync(agentsPath)) {
    try { assertNoLinks(home, agentsPath); } catch (error) { checks.push(checkResult('agents-path', false, error.message, 'agents')); }
  }
  const instructionsPath = targetPath(home, 'AGENTS.md');
  const instructions = existsSync(instructionsPath) ? decode(readFileSync(instructionsPath)) : '';
  const markersOk = instructions.split(START).length - 1 === 1 && instructions.split(END).length - 1 === 1
    && instructions.indexOf(START) < instructions.indexOf(END);
  checks.push(checkResult('instructions', markersOk, markersOk ? 'Jarvis instruction markers are present.' : 'Jarvis instruction block is missing or malformed.', 'AGENTS.md'));
  for (const relativePath of ['skills/jarvis-orchestrator/SKILL.md', 'skills/jarvis-orchestrator/references/lifecycle.md']) {
    const skillPath = targetPath(home, relativePath);
    let skillOk = false;
    if (existsSync(skillPath) && !lstatSync(skillPath).isSymbolicLink()) {
      const raw = readFileSync(skillPath);
      skillOk = raw.length > 0 && (!ownedHashes.has(relativePath) || hash(raw) === ownedHashes.get(relativePath));
    }
    checks.push(checkResult(`skill:${relativePath.endsWith('SKILL.md') ? 'main' : 'lifecycle'}`, skillOk,
      skillOk ? 'Orchestration skill file matches the installed payload.' : 'Orchestration skill file is missing, empty or modified.', relativePath));
  }
  const ok = checks.every(check => check.ok);
  return {
    status: ok ? 'healthy' : (manifestInfo ? 'misconfigured' : 'not-installed'),
    ok,
    target: home,
    checks,
    runtimeVerification: 'not-performed',
    runtimeNote: 'This check does not prove that native Jarvis roles are callable in the current runtime.',
  };
}
