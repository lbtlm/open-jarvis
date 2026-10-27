import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { readFileSync, existsSync, readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { checkAncestors } from '../asset-paths.mjs';
import { roleKeys, supportedEfforts } from '../profiles.mjs';

const definitions = {
  codex: { directory: '.codex', instructions: 'AGENTS.md', extension: 'toml', reviewer: 'sandbox-requested', efforts: null, fast: true },
  workbuddy: { directory: '.codebuddy', instructions: 'CODEBUDDY.md', extension: 'md', reviewer: 'tools-restricted', efforts: ['low', 'medium', 'high'], fast: false },
  'claude-code': { directory: '.claude', instructions: 'CLAUDE.md', extension: 'md', reviewer: 'tools-restricted', efforts: ['low', 'medium', 'high', 'max'], fast: false },
  cursor: { directory: '.cursor', instructions: 'jarvis-instructions.md', extension: 'md', reviewer: 'readonly-requested', efforts: ['low', 'medium', 'high'], fast: true },
};

export function platformAdapter(value = 'codex') {
  const id = ({ claude: 'claude-code', codebuddy: 'workbuddy' })[value] ?? value;
  if (!Object.hasOwn(definitions, id)) throw new Error('Choose platform: codex, workbuddy, claude-code or cursor.');
  const data = definitions[id];
  return {
    id, ...data,
    defaultHome: (env = process.env) => id === 'codex' ? env.CODEX_HOME ?? join(homedir(), data.directory) : join(homedir(), data.directory),
    roleName: key => `jarvis${id === 'codex' ? '_' : '-'}${key}`,
    rolePath: key => `agents/jarvis${id === 'codex' ? '_' : '-'}${key}.${data.extension}`,
    skillRoots: (home, project) => [...(id === 'codex'
      ? [project && join(project, '.agents/skills'), project && join(project, '.codex/skills')]
      : [project && join(project, data.directory, 'skills'), project && join(project, '.agents/skills')]),
      join(home, 'skills'), join(dirname(home), '.agents/skills')].filter(Boolean),
    capabilities: { nativeProfiles: true, model: 'configuration-only', effort: 'model-dependent', fast: data.fast ? 'model-dependent' : 'unsupported', reviewer: data.reviewer, activation: id === 'cursor' ? '/jarvis-orchestrator' : 'native-instructions', runtimeVerified: false },
  };
}

export function nativeModels(adapter, overrides, base, controllerEffort) {
  if (adapter.id === 'codex') throw new Error('Codex settings use the Codex adapter.');
  const keys = ['controller', ...roleKeys];
  for (const [label, source] of [['Stored models', base], ['Models', overrides]]) {
    if (source === undefined) continue;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error(`${label} must be an object.`);
    for (const [key, value] of Object.entries(source)) {
      if (!keys.includes(key)) throw new Error(`Unknown model mapping key: ${key}`);
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length
        || Object.keys(value).some(field => !['model', 'effort', 'fast'].includes(field))) throw new Error(`${label}: invalid settings for ${key}.`);
      if ((label === 'Stored models' || Object.hasOwn(value, 'model'))
        && (typeof value.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value.model))) throw new Error(`${label}: invalid model for ${key}.`);
      if (Object.hasOwn(value, 'effort') && !adapter.efforts.includes(value.effort)) throw new Error(`Unsupported ${adapter.id} effort: ${value.effort}.`);
      if (Object.hasOwn(value, 'fast') && (typeof value.fast !== 'boolean' || !adapter.fast)) throw new Error(`Fast cannot be expressed for ${adapter.id}.`);
    }
  }
  const result = Object.fromEntries(['controller', ...roleKeys].map(key => [key, { ...(base?.[key] ?? { model: 'inherit' }), ...(overrides?.[key] ?? {}) }]));
  for (const key of Object.keys(overrides ?? {})) if (!Object.hasOwn(result, key)) throw new Error(`Unknown model mapping key: ${key}`);
  if (controllerEffort !== undefined) result.controller.effort = controllerEffort;
  for (const [key, value] of Object.entries(result)) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['model', 'effort', 'fast'].includes(k))) throw new Error(`Invalid settings for ${key}.`);
    if (typeof value.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value.model)) throw new Error(`Invalid model for ${key}; use a model ID or inherit.`);
    if (value.effort !== undefined && !adapter.efforts.includes(value.effort)) throw new Error(`Unsupported ${adapter.id} effort: ${value.effort}.`);
    if (value.fast !== undefined && (typeof value.fast !== 'boolean' || !adapter.fast)) throw new Error(`Fast cannot be expressed for ${adapter.id}.`);
    if (value.model === 'inherit' && (value.effort !== undefined || value.fast !== undefined)) throw new Error(`Select an explicit model before setting effort or Fast for ${key}.`);
    if (key === 'controller' && (value.model !== 'inherit' || value.effort !== undefined || value.fast !== undefined)) throw new Error(`${adapter.id} controller settings are selected in the client; only inherit is supported here.`);
  }
  return result;
}

function nativeAgentName(path) {
  // Read only a bounded frontmatter prefix, never the agent's body or scripts.
  const fd = openSync(path, 'r');
  const buffer = Buffer.alloc(64 * 1024);
  let text;
  try { text = buffer.subarray(0, readSync(fd, buffer, 0, buffer.length, 0)).toString('utf8').replace(/^\uFEFF/, ''); }
  finally { closeSync(fd); }
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!header) throw new Error(`Cannot safely identify native agent frontmatter: ${path}`);
  // Flow mappings, merged keys, aliases and multiline/duplicate names require
  // manual review rather than guessing which identity the client will load.
  const rootLines = header[1].split(/\r?\n/).filter(line => line && !/^[ \t#]/.test(line));
  if (rootLines.some(line => !/^(?:[a-zA-Z_][a-zA-Z0-9_-]*|"name"|'name')\s*:/.test(line))) throw new Error(`Cannot safely identify complex native agent frontmatter: ${path}`);
  const names = header[1].split(/\r?\n/).filter(line => /^(?:name|"name"|'name')\s*:/.test(line));
  if (names.length !== 1) throw new Error(`Cannot safely identify native agent name: ${path}`);
  const value = names[0].replace(/^(?:name|"name"|'name')\s*:\s*/, '');
  let name;
  const quoted = /^("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/.exec(value);
  const single = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(value);
  const plain = /^([a-z][a-z0-9-]*)\s*(?:#.*)?$/.exec(value);
  if (quoted) { try { name = JSON.parse(quoted[1]); } catch {} }
  else if (single) name = single[1].replaceAll("''", "'");
  else if (plain) name = plain[1];
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Cannot safely identify native agent name: ${path}`);
  return name;
}

export function checkNativeRoleCollisions(adapter, home) {
  if (adapter.id === 'codex') return;
  const root = join(home, 'agents');
  checkAncestors(root);
  if (!existsSync(root)) return;
  const reserved = new Map(roleKeys.map(key => [adapter.roleName(key), adapter.rolePath(key)]));
  const visit = (directory, prefix) => {
    checkAncestors(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), relativePath = `${prefix}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Linked native agent path is not supported: ${path}`);
      if (entry.isDirectory()) visit(path, relativePath);
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        const name = nativeAgentName(path);
        if (reserved.has(name) && reserved.get(name) !== relativePath) throw new Error(`Native role name collision: ${name} in ${path}`);
      }
    }
  };
  visit(root, 'agents');
}

export function renderNativeRole(adapter, key, source, settings) {
  const role = parseToml(source.toString('utf8'));
  let model = settings.model;
  if (adapter.id === 'cursor' && (settings.effort !== undefined || settings.fast !== undefined)) {
    const options = [...(settings.effort !== undefined ? [`effort=${settings.effort}`] : []), ...(settings.fast !== undefined ? [`fast=${settings.fast}`] : [])];
    model += `[${options.join(',')}]`;
  }
  const metadata = { name: adapter.roleName(key), description: role.description, model,
    ...(adapter.id !== 'cursor' && settings.effort !== undefined ? { effort: settings.effort } : {}),
    ...(key === 'reviewer' ? adapter.id === 'cursor' ? { readonly: true } : { tools: 'Read, Grep, Glob', permissionMode: 'default' } : {}),
  };
  return Buffer.from(`---\n${Object.entries(metadata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n${role.developer_instructions.trim()}\n`);
}

// We only read the deliberately small generated YAML subset; arbitrary user
// agents are never rewritten or treated as Jarvis-owned configurations.
export function readExecutionProfile(adapter, home, key) {
  const path = join(home, adapter.rolePath(key));
  checkAncestors(path);
  const raw = readFileSync(path, 'utf8');
  if (adapter.id === 'codex') {
    const role = parseToml(raw);
    if (role.name !== `jarvis_${key}` || typeof role.model !== 'string' || !supportedEfforts(role.model).includes(role.model_reasoning_effort)) throw new Error('Invalid execution profile settings.');
    if (key === 'reviewer' && role.sandbox_mode !== 'read-only') throw new Error('Reviewer profile must request a read-only sandbox.');
    return { path, name: role.name, model: role.model, effort: role.model_reasoning_effort, speed: role.service_tier ?? 'inherit', reviewer: adapter.reviewer };
  }
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!frontmatter) throw new Error('Invalid execution profile frontmatter.');
  const metadata = {};
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const pair = /^(\w+): (.+)$/.exec(line);
    if (!pair || Object.hasOwn(metadata, pair[1])) throw new Error('Invalid generated execution profile.');
    try { metadata[pair[1]] = JSON.parse(pair[2]); } catch { throw new Error('Invalid generated execution profile value.'); }
  }
  if (metadata.name !== adapter.roleName(key) || typeof metadata.description !== 'string' || typeof metadata.model !== 'string') throw new Error('Invalid execution profile settings.');
  const selected = /^(.*?)\[([^\]]+)\]$/.exec(metadata.model);
  const settings = { model: selected ? selected[1] : metadata.model, ...(metadata.effort !== undefined ? { effort: metadata.effort } : {}) };
  if (selected) {
    if (adapter.id !== 'cursor') throw new Error('Model options are only supported by Cursor.');
    for (const option of selected[2].split(',')) {
      const [name, value] = option.split('=');
      if (!['effort', 'fast'].includes(name) || Object.hasOwn(settings, name) || !value) throw new Error('Invalid Cursor model options.');
      if (name === 'fast' && !['true', 'false'].includes(value)) throw new Error('Invalid Cursor Fast option.');
      settings[name] = name === 'fast' ? value === 'true' : value;
    }
  }
  nativeModels(adapter, { [key]: settings });
  if (key === 'reviewer' && (adapter.id === 'cursor' ? metadata.readonly !== true : metadata.tools !== 'Read, Grep, Glob' || metadata.permissionMode !== 'default')) throw new Error('Reviewer tool restrictions differ from the installed contract.');
  return { path, name: metadata.name, model: settings.model, effort: settings.effort ?? 'inherit', speed: settings.fast === undefined ? 'inherit' : settings.fast ? 'fast' : 'default', reviewer: adapter.reviewer };
}
