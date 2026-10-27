import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { roleKeys, effortNames, supportedEfforts, defaultModels } from '../profiles.mjs';
const ROLE_NAMES = roleKeys.map(key => `jarvis_${key}`);
const EFFORTS = new Set(effortNames);
const fail = message => { throw new Error(message); };
const hash = data => createHash('sha256').update(data).digest('hex');
const decode = data => data.toString('utf8').replace(/^\uFEFF/, '');
function encodeLike(original, text) {
  const bom = original.length >= 3 && original[0] === 0xef && original[1] === 0xbb && original[2] === 0xbf;
  return Buffer.concat([bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0), Buffer.from(text)]);
}
function parseConfig(data, label = 'TOML') {
  try { return parseToml(decode(data)); }
  catch { fail(`Invalid ${label}; check its syntax locally. No content was printed.`); }
}

export function resolveModels(overrides = undefined, controllerEffort = undefined, base = defaultModels) {
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
  for (const [key, choice] of Object.entries(result)) {
    if (!supportedEfforts(choice.model).includes(choice.effort)) {
      fail(`Model mapping ${key}: ${choice.model} does not support Codex effort ${choice.effort}.`);
    }
  }
  return result;
}

function splitLines(text) {
  return text.match(/.*?(?:\r\n|\n|$)/g).filter(line => line !== '');
}

export function patchConfig(original, models, controllerEffortExplicit) {
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
  const concurrency = agents?.max_concurrent_threads_per_session;
  if (concurrency !== undefined && (!Number.isSafeInteger(concurrency) || concurrency < 1)) {
    fail('Existing agents.max_concurrent_threads_per_session must be a positive integer; no files changed.');
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
  if (!supportedEfforts(models.controller.model).includes(selectedEffort)) {
    fail(`Selected controller model ${models.controller.model} does not support Codex effort ${selectedEffort}; choose a supported effort explicitly.`);
  }
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
      ...(concurrency === undefined ? { max_concurrent_threads_per_session: 3 } : {}),
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
  expected.agents = Object.assign(expected.agents ?? Object.create(null), targets.agents);
  if (controllerFastExplicit) expected.service_tier = targets[''].service_tier;
  if (controllerFastExplicit && models.controller.fast) expected.features = Object.assign(expected.features ?? Object.create(null), { fast_mode: true });
  if (!isDeepStrictEqual(after, expected)) fail('Config merge altered unrelated settings; refusing write.');
  return encodeLike(original, result);
}

export function renderRole(source, key, models) {
  const data = parseConfig(source, `payload role jarvis_${key}.toml`);
  if (data.name !== `jarvis_${key}` || !data.description || !data.developer_instructions) {
    fail(`Incomplete or incorrect payload role: jarvis_${key}`);
  }
  let text = decode(source).replaceAll('\r\n', '\n')
    .replace(/(?:\r?\n)?^\s*service_tier\s*=.*(?:\r?\n|$)/m, '\n')
    .replace(/(?:\r?\n)?^\s*\[features\]\s*(?:#.*)?\r?\n\s*fast_mode\s*=\s*(?:true|false)\s*(?:#.*)?(?:\r?\n|$)/m, '\n');
  const replace = (field, value) => {
    const pattern = new RegExp(`^\\s*${field}\\s*=.*$`, 'm');
    if (pattern.test(text)) text = text.replace(pattern, `${field} = ${JSON.stringify(value)}`);
    else text = `${field} = ${JSON.stringify(value)}\n${text}`;
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

export function renderReviewer(source, current, prior) {
  const saved = prior.reviewerApprovalPolicy;
  if (current === null) return saved === 'never'
    ? Buffer.concat([Buffer.from('approval_policy = "never"\n'), source]) : source;
  const role = parseConfig(current, 'agents/jarvis_reviewer.toml');
  const priorHash = prior.owned.get('agents/jarvis_reviewer.toml');
  if (!Object.hasOwn(role, 'approval_policy')) {
    if (saved !== undefined) fail('Modified reviewer approval policy needs manual merge.');
    return source;
  }
  if (role.approval_policy !== 'never' || role.sandbox_mode !== 'read-only' || !priorHash) {
    fail('Unsupported reviewer customization needs manual merge.');
  }
  const text = decode(current);
  const stripped = encodeLike(current, text.replace(/^[ \t]*approval_policy[ \t]*=[ \t]*"never"[ \t]*(?:#[^\r\n]*)?(?:\r?\n|$)/m, ''));
  const bare = Object.assign(Object.create(Object.getPrototypeOf(role)), role);
  delete bare.approval_policy;
  if (!isDeepStrictEqual(parseConfig(stripped, 'reviewer without approval policy'), bare)) {
    fail('Reviewer approval policy syntax needs manual merge.');
  }
  const matchesPackage = stripped.equals(source);
  const matchesReceipt = hash(stripped) === priorHash || (saved === 'never' && hash(current) === priorHash);
  if (!matchesPackage && !matchesReceipt) fail('Modified reviewer file needs manual merge.');
  return matchesPackage ? current : Buffer.concat([Buffer.from('approval_policy = "never"\n'), source]);
}
