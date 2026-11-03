import test from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedEmployees, listEmployees, planTask } from '../src/team.mjs';
import { install } from '../src/installer.mjs';

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

function role(home, key, { model = 'gpt-6.1-sol', effort = 'medium', sandbox, speed } = {}) {
  const dir = join(home, 'agents');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `jarvis_${key}.toml`), [
    `name = "jarvis_${key}"`, `model = "${model}"`,
    `model_reasoning_effort = "${effort}"`,
    ...(speed ? [`service_tier = "${speed}"`] : []),
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
  role(home, 'luna', { model: 'vendor/custom-micro', effort: 'medium' });
  role(home, 'simple', { model: 'vendor/custom-simple', effort: 'low' });
  role(home, 'terra', { model: 'gpt-6.1-sol', effort: 'medium' });
  role(home, 'sol', { model: 'vendor/custom-complex', effort: 'high' });
  const plans = ['micro', 'light', 'simple', 'standard', 'investigation', 'complex'].map(difficulty =>
    planTask({ home, employee: 'quinn-qa', difficulty }));
  assert.deepEqual(plans.map(plan => plan.role), ['jarvis_luna', 'jarvis_luna', 'jarvis_simple', 'jarvis_simple', 'jarvis_terra', 'jarvis_sol']);
  assert.deepEqual(plans.map(plan => plan.requested.model), ['vendor/custom-micro', 'vendor/custom-micro', 'vendor/custom-simple', 'vendor/custom-simple', 'gpt-6.1-sol', 'vendor/custom-complex']);
  assert.deepEqual(plans.map(plan => plan.requested.effort), ['medium', 'medium', 'low', 'low', 'medium', 'high']);
  for (const plan of plans) {
    assert.deepEqual(plan.employee, plans[0].employee);
    assert.deepEqual(plan.requested, plan.installed);
    assert.equal(plan.compatibilityBindingRequired, undefined);
  }
  const critical = planTask({ home, employee: 'quinn-qa', difficulty: 'light', risk: 'critical' });
  assert.equal(critical.role, 'jarvis_sol');
  assert.equal(critical.requested.model, 'vendor/custom-complex');
});

test('balanced routing separates daily execution, investigation and critical work without changing profiles', t => {
  const { home, project } = fixture(t);
  install({ home });
  card(project, 'atlas-backend', { name: 'Atlas' });
  card(project, 'sentry-review', { name: 'Sentry', reviewer: true });
  const paths = ['config.toml', ...['luna', 'simple', 'terra', 'sol', 'reviewer'].map(key => `agents/jarvis_${key}.toml`)];
  const before = paths.map(path => readFileSync(join(home, path)));
  const cases = [
    ['micro', 'normal', 'jarvis_luna', 'gpt-6-luna', 'medium'],
    ['light', 'normal', 'jarvis_luna', 'gpt-6-luna', 'medium'],
    ['simple', 'normal', 'jarvis_simple', 'gpt-6.1-terra', 'high'],
    ['standard', 'normal', 'jarvis_simple', 'gpt-6.1-terra', 'high'],
    ['investigation', 'normal', 'jarvis_terra', 'gpt-6.1-sol', 'medium'],
    ['complex', 'normal', 'jarvis_sol', 'gpt-6.1-sol', 'high'],
    ['micro', 'critical', 'jarvis_sol', 'gpt-6.1-sol', 'high'],
    ['standard', 'critical', 'jarvis_sol', 'gpt-6.1-sol', 'high'],
    ['investigation', 'critical', 'jarvis_sol', 'gpt-6.1-sol', 'high'],
  ];
  for (const [difficulty, risk, expectedRole, model, effort] of cases) {
    const plan = planTask({ home, project, employee: 'atlas-backend', difficulty, risk });
    assert.equal(plan.role, expectedRole);
    assert.equal(plan.requested.model, model);
    assert.equal(plan.requested.effort, effort);
    assert.equal(plan.independentReviewRequired, risk === 'critical');
  }
  const xhigh = planTask({ home, project, employee: 'atlas-backend', difficulty: 'standard', effort: 'xhigh' });
  assert.deepEqual(xhigh.requested, { ...xhigh.installed, effort: 'xhigh' });
  assert.equal(xhigh.installed.model, 'gpt-6.1-terra');
  assert.equal(xhigh.installed.effort, 'high');
  assert.equal(xhigh.compatibilityBindingRequired, true);
  assert.match(xhigh.bindingRequirement, /explicit binding/);
  const explicit = planTask({ home, project, employee: 'atlas-backend', difficulty: 'micro', risk: 'critical', effort: 'medium' });
  assert.equal(explicit.role, 'jarvis_sol');
  assert.equal(explicit.installed.effort, 'high');
  assert.equal(explicit.requested.effort, 'medium');
  assert.equal(explicit.compatibilityBindingRequired, true);
  const review = planTask({ home, project, employee: 'sentry-review', difficulty: 'micro', risk: 'critical' });
  assert.equal(review.role, 'jarvis_reviewer');
  assert.equal(review.reviewerControl, 'sandbox-requested');
  assert.match(readFileSync(join(home, 'agents/jarvis_reviewer.toml'), 'utf8'), /sandbox_mode = "read-only"/);
  assert.deepEqual(paths.map(path => readFileSync(join(home, path))), before);
});

test('task effort overrides validate the installed model without changing role or controller files', t => {
  const { home, project } = fixture(t);
  card(project, 'atlas-backend', { name: 'Atlas' });
  role(home, 'luna', { model: 'gpt-6-luna', effort: 'medium', speed: 'fast' });
  const rolePath = join(home, 'agents/jarvis_luna.toml');
  const configPath = join(home, 'config.toml');
  writeFileSync(configPath, 'model = "custom-controller"\nmodel_reasoning_effort = "high"\n');
  const before = [rolePath, configPath].map(path => readFileSync(path));
  const options = { home, project, employee: 'atlas-backend', difficulty: 'micro' };
  const plan = planTask({ ...options, effort: 'low' });
  assert.deepEqual(plan.installed, { model: 'gpt-6-luna', effort: 'medium', speed: 'fast' });
  assert.deepEqual(plan.requested, { ...plan.installed, effort: 'low' });
  assert.equal(plan.compatibilityBindingRequired, true);
  assert.match(plan.bindingRequirement, /native role alone does not apply/);
  assert.equal(plan.runtimeVerified, false);
  assert.equal(plan.dispatched, false);
  assert.equal(plan.independentReviewRequired, false);
  assert.equal(planTask({ ...options, effort: 'medium' }).compatibilityBindingRequired, undefined);
  for (const effort of ['', 'invalid', 'ultra']) assert.throws(() => planTask({ ...options, effort }), /does not support Codex effort/);
  assert.deepEqual([rolePath, configPath].map(path => readFileSync(path)), before);
});

test('missing skills block plans and reviewer roles must request read-only sandbox', t => {
  const { home } = fixture(t);
  const employees = join(home, 'jarvis', 'employees');
  mkdirSync(employees, { recursive: true });
  writeFileSync(join(employees, 'quinn-qa.md'), `---\n${JSON.stringify({ name: 'Quinn', skills: [{ id: 'missing-skill', when: 'when needed' }] })}\n---\n`);
  role(home, 'simple');
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
  role(home, 'simple');
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
