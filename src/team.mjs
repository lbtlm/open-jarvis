import { existsSync, readdirSync, readFileSync, lstatSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseToml } from 'smol-toml';
import { difficultyRoles, supportedEfforts } from './profiles.mjs';
import { starterEmployees } from './starters.mjs';

const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
export function seedEmployees({ home, apply = false, starter = 'development' }) {
  const ids = starterEmployees(starter);
  const source = fileURLToPath(new URL('../payload/employees/', import.meta.url));
  if (!ids.length) return { status: apply ? 'initialized' : 'preview', starter, created: [], candidates: [] };
  const root = directory(join(home, 'jarvis/employees'));
  let ancestor = root;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (!lstatSync(ancestor).isDirectory()) throw new Error('Employee root must be a directory.');
  const pending = ids.map(id => ({ path: directory(join(root, `${id}.md`)), source: join(source, `${id}.md`) }))
    .filter(file => !existsSync(file.path))
    .map(file => ({ path: file.path, bytes: readFileSync(file.source) }));
  const written = [];
  if (apply) {
    try {
      if (pending.length) mkdirSync(root, { recursive: true });
      for (const file of pending) {
        writeFileSync(file.path, file.bytes, { flag: 'wx', mode: 0o600 });
        written.push(file.path);
      }
    } catch (error) {
      for (const path of written.reverse()) unlinkSync(path);
      throw error;
    }
  }
  return { status: apply ? 'initialized' : 'preview', starter, created: written, candidates: pending.map(f => f.path),
    message: 'Existing cards are retained. Templates describe capabilities, not approval or verified experience. Employee cards are user-owned and independent of installer rollback.' };
}
function directory(path) {
  let cursor = resolve(path);
  while (true) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error('Linked employee/skill path is not supported.');
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return path;
}
export function skillRoots(home, project) {
  return [project && join(project, '.agents/skills'), project && join(project, '.codex/skills'),
    join(home, 'skills'), join(dirname(home), '.agents/skills')].filter(Boolean);
}
export function findSkill(id, roots) {
  if (!safeId(id)) throw new Error('Invalid skill identifier.');
  for (const root of roots) {
    const path = directory(join(root, id, 'SKILL.md'));
    if (existsSync(path) && lstatSync(path).isFile()) return path;
  }
  return null;
}
export function listEmployees({ home, project, query = '' }) {
  const selected = new Map();
  const roots = [[project && join(project, '.jarvis/employees'), 'project'], [join(home, 'jarvis/employees'), 'personal']];
  for (const [root, scope] of roots) {
    if (!root || !existsSync(directory(root))) continue;
    for (const file of readdirSync(root).sort()) {
      if (!file.endsWith('.md')) continue;
      const id = file.slice(0, -3);
      if (!safeId(id)) continue;
      const path = directory(join(root, file));
      const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
      const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      let metadata = {};
      if (match) {
        try { metadata = JSON.parse(match[1]); } catch { throw new Error(`Invalid employee JSON frontmatter: ${id}`); }
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(`Invalid employee metadata: ${id}`);
      }
      if ((metadata.name !== undefined && typeof metadata.name !== 'string') ||
          (metadata.profession !== undefined && typeof metadata.profession !== 'string') ||
          (metadata.keywords !== undefined && (!Array.isArray(metadata.keywords) || metadata.keywords.some(k => typeof k !== 'string')))) throw new Error(`Invalid employee metadata: ${id}`);
      const skills = metadata.skills ?? [];
      if (!Array.isArray(skills) || skills.some(s => !s || !safeId(s.id) || typeof s.when !== 'string')) throw new Error(`Invalid employee skills: ${id}`);
      const card = { id, name: metadata.name ?? id, profession: metadata.profession ?? '',
        keywords: metadata.keywords ?? [], skills, reviewer: metadata.reviewer === true, scope, path };
      if (selected.has(id)) { selected.get(id).shadowedPersonalCard = path; continue; }
      selected.set(id, card);
    }
  }
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return [...selected.values()].filter(card => terms.every(term =>
    `${card.id} ${card.name} ${card.profession} ${JSON.stringify(card.keywords)}`.toLowerCase().includes(term)));
}

export function planTask({ home, project, employee, difficulty, risk = 'normal', skills = [] }) {
  if (!Object.hasOwn(difficultyRoles, difficulty)) throw new Error('Choose difficulty: light, simple, standard or complex. Direct work does not need a dispatch plan.');
  if (!['normal', 'critical'].includes(risk)) throw new Error('Choose risk: normal or critical.');
  const card = listEmployees({ home, project }).find(c => c.id === employee);
  if (!card) throw new Error('Employee not found; approve and save a card before planning.');
  const key = card.reviewer ? 'reviewer' : difficultyRoles[difficulty];
  const rolePath = directory(join(home, `agents/jarvis_${key}.toml`));
  if (!existsSync(rolePath)) throw new Error(`Execution profile is not installed: jarvis_${key}`);
  let role;
  try { role = parseToml(readFileSync(rolePath, 'utf8')); } catch { throw new Error('Invalid execution profile TOML.'); }
  if (role.name !== `jarvis_${key}` || typeof role.model !== 'string' || !supportedEfforts(role.model).includes(role.model_reasoning_effort)) throw new Error('Invalid execution profile settings.');
  if (card.reviewer && role.sandbox_mode !== 'read-only') throw new Error('Reviewer profile must request a read-only sandbox.');
  const selectedSkills = skills.map(id => ({ id, path: findSkill(id, skillRoots(home, project)),
    source: card.skills.some(skill => skill.id === id) ? 'employee-card' : 'task-override', loaded: false }));
  const blockers = selectedSkills.filter(s => !s.path).map(s => `Missing skill: ${s.id}`);
  return { status: blockers.length ? 'blocked' : 'proposed', employee: card, difficulty, risk,
    role: role.name, rolePath, requested: { model: role.model, effort: role.model_reasoning_effort, speed: role.service_tier ?? 'inherit' },
    selectedSkills, availableSkills: card.skills, independentReviewRequired: !card.reviewer && risk === 'critical',
    blockers, approvalRequired: 'Use actual user approval for this scope; a saved card is not authorization.',
    dispatched: false, runtimeVerified: false,
    next: 'Controller adds owned scope and acceptance, reads selected skills and dispatches only within actual approval. Never use a proposed plan as proof of dispatch.' };
}
