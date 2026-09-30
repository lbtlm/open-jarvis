import test from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedEmployees, listEmployees, planTask } from '../src/team.mjs';

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'jarvis-team-'));
  const home = join(root, 'home');
  const project = join(root, 'project');
  mkdirSync(home);
  mkdirSync(project);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, home, project };
}

function card(root, id, { name = id, keywords = [], skills = [], reviewer = false } = {}) {
  const dir = join(root, '.jarvis', 'employees');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.md`), `---\n${JSON.stringify({ name, profession: 'QA', keywords, skills, reviewer })}\n---\n${name}\n`);
}

function role(home, key, { model = 'gpt-6.1-sol', effort = 'medium', sandbox } = {}) {
  const dir = join(home, 'agents');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `jarvis_${key}.toml`), [
    `name = "jarvis_${key}"`, `model = "${model}"`,
    `model_reasoning_effort = "${effort}"`,
    ...(sandbox ? [`sandbox_mode = "${sandbox}"`] : []), '',
  ].join('\n'));
}

test('seed previews and creates only missing employee templates', t => {
  const { home } = fixture(t);
  const existing = join(home, 'jarvis', 'employees', 'quinn-qa.md');
  mkdirSync(join(home, 'jarvis', 'employees'), { recursive: true });
  writeFileSync(existing, 'User approved Quinn card');
  const preview = seedEmployees({ home });
  assert.equal(preview.status, 'preview');
  assert.ok(preview.candidates.some(path => path.endsWith('atlas-backend.md')));
  assert.equal(preview.candidates.some(path => path.endsWith('quinn-qa.md')), false);
  const seeded = seedEmployees({ home, apply: true });
  assert.equal(seeded.status, 'initialized');
  assert.ok(seeded.created.length > 0);
  assert.equal(readFileSync(existing, 'utf8'), 'User approved Quinn card');
});

test('project cards shadow personal cards and search filters across card terms', t => {
  const { home, project } = fixture(t);
  const personal = join(home, 'jarvis', 'employees');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'quinn-qa.md'), '---\n{"name":"Personal Quinn","keywords":["qa"]}\n---\n');
  card(project, 'quinn-qa', { name: 'Project Quinn', keywords: ['release'] });
  card(project, 'iris-frontend', { name: 'Iris', keywords: ['frontend'] });
  const matches = listEmployees({ home, project, query: 'project release' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].scope, 'project');
  assert.equal(matches[0].shadowedPersonalCard, join(personal, 'quinn-qa.md'));
  assert.equal(matches[0].name, 'Project Quinn');
});

test('one employee receives difficulty-specific installed profiles; custom mappings stay intact', t => {
  const { home } = fixture(t);
  const personal = join(home, 'jarvis', 'employees');
  mkdirSync(personal, { recursive: true });
  writeFileSync(join(personal, 'quinn-qa.md'), '---\n{"name":"Quinn","profession":"QA"}\n---\n');
  role(home, 'simple', { model: 'vendor/custom-simple', effort: 'low' });
  role(home, 'terra', { model: 'gpt-6.1-sol', effort: 'medium' });
  role(home, 'sol', { model: 'vendor/custom-complex', effort: 'high' });
  const plans = ['simple', 'standard', 'complex'].map(difficulty =>
    planTask({ home, employee: 'quinn-qa', difficulty }));
  assert.deepEqual(plans.map(plan => plan.role), ['jarvis_simple', 'jarvis_terra', 'jarvis_sol']);
  assert.deepEqual(plans.map(plan => plan.requested.model), ['vendor/custom-simple', 'gpt-6.1-sol', 'vendor/custom-complex']);
  assert.deepEqual(plans.map(plan => plan.requested.effort), ['low', 'medium', 'high']);
});

test('missing skills block plans and reviewer roles must request read-only sandbox', t => {
  const { home } = fixture(t);
  const employees = join(home, 'jarvis', 'employees');
  mkdirSync(employees, { recursive: true });
  writeFileSync(join(employees, 'quinn-qa.md'), `---\n${JSON.stringify({ name: 'Quinn', skills: [{ id: 'missing-skill', when: 'when needed' }] })}\n---\n`);
  role(home, 'terra');
  const plan = planTask({ home, employee: 'quinn-qa', difficulty: 'standard', skills: ['missing-skill'] });
  assert.equal(plan.status, 'blocked');
  assert.deepEqual(plan.selectedSkills.map(skill => skill.loaded), [false]);
  assert.equal(plan.selectedSkills[0].source, 'employee-card');
  assert.deepEqual(plan.blockers, ['Missing skill: missing-skill']);

  writeFileSync(join(employees, 'sentry-review.md'), `---\n${JSON.stringify({ name: 'Sentry', reviewer: true })}\n---\n`);
  role(home, 'reviewer', { sandbox: 'workspace-write' });
  assert.throws(() => planTask({ home, employee: 'sentry-review', difficulty: 'simple' }), /read-only sandbox/);
  role(home, 'reviewer', { sandbox: 'read-only' });
  const review = planTask({ home, employee: 'sentry-review', difficulty: 'simple' });
  assert.equal(review.role, 'jarvis_reviewer');
  assert.equal(review.requested.model, 'gpt-6.1-sol');
});

test('task skills need not be saved on the card and never modify it', t => {
  const { home, project } = fixture(t);
  card(project, 'nova-writer', { skills: [{ id: 'usual-skill', when: 'explicitly requested' }] });
  role(home, 'terra');
  const path = join(project, '.jarvis', 'employees', 'nova-writer.md');
  const before = readFileSync(path);
  const skill = join(project, '.agents', 'skills', 'temporary-skill');
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), '# Local skill');
  const plan = planTask({ home, project, employee: 'nova-writer', difficulty: 'standard', skills: ['temporary-skill'] });
  assert.equal(plan.status, 'proposed');
  assert.deepEqual(plan.selectedSkills, [{ id: 'temporary-skill', path: join(skill, 'SKILL.md'), source: 'task-override', loaded: false }]);
  assert.equal(plan.dispatched, false);
  assert.equal(plan.runtimeVerified, false);
  const missing = planTask({ home, project, employee: 'nova-writer', difficulty: 'standard', skills: ['missing-override'] });
  assert.equal(missing.status, 'blocked');
  assert.equal(missing.selectedSkills[0].source, 'task-override');
  assert.deepEqual(readFileSync(path), before);
});
