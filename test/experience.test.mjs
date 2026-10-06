import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { approveExperience, parseExperience, proposeExperience, searchExperience, showExperience } from '../src/experience.mjs';
import { exportAssets, importAssets } from '../src/assets.mjs';
import { planTask } from '../src/team.mjs';

const cli = fileURLToPath(new URL('../bin/open-jarvis.mjs', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'jarvis-experience-'));
  const options = { root, home: join(root, 'home'), project: join(root, 'project') };
  mkdirSync(options.home); mkdirSync(options.project);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return options;
}
function content({ id = 'retry-safe', scope = 'project', state = 'candidate', title = '中文重试经验', method = '检查中文失败记录，然后执行范围内一次修复。' } = {}) {
  return `---\n${JSON.stringify({ kind: 'jarvis-experience', id, title, scope, state, tags: ['中文', 'backend'], contributors: ['Atlas'], verifiedOn: '2026-10-05' })}\n---\n# Actual source heading\n\n## Applicability\n\n已明确授权的局部重试。\n\n## Method\n\n${method}\n\n## Limits\n\n不涵盖外部副作用。\n\n## Evidence\n\nSynthetic fixture: node --test test/experience.test.mjs; no real account operations.\n`;
}
function candidate(options, edits = {}) {
  const from = join(options.root, `candidate-${edits.scope ?? 'project'}-${edits.id ?? 'retry-safe'}.md`);
  writeFileSync(from, content(edits));
  return { ...options, from, scope: edits.scope ?? 'project' };
}
function approve(options, extra = {}) {
  const preview = approveExperience(options);
  return approveExperience({ ...options, apply: true, sourceSha256: preview.sourceSha256,
    ...(preview.currentSha256 ? { expectedSha256: preview.currentSha256 } : {}), ...extra });
}
function setupPlan(options) {
  mkdirSync(join(options.home, 'agents'), { recursive: true });
  writeFileSync(join(options.home, 'agents/jarvis_sol.toml'), 'name = "jarvis_sol"\nmodel = "gpt-6.1-sol"\nmodel_reasoning_effort = "high"\n');
  mkdirSync(join(options.project, '.jarvis/employees'), { recursive: true });
  writeFileSync(join(options.project, '.jarvis/employees/atlas-backend.md'), '---\n{"name":"Atlas"}\n---\n');
  return { ...options, employee: 'atlas-backend', difficulty: 'complex' };
}
function run(options, ...args) {
  return spawnSync(process.execPath, [cli, ...args, '--home', options.home, '--project', options.project, '--json'], { encoding: 'utf8', timeout: 20000 });
}

test('proposals are unverified templates; approval preview is read-only and requires complete evidence', t => {
  const options = fixture(t);
  const out = join(options.root, 'task-output/template.md');
  const proposal = proposeExperience({ ...options, id: 'retry-safe', title: 'Retry safely', scope: 'project', out });
  assert.equal(proposal.status, 'candidate');
  assert.equal(parseExperience(Buffer.from(proposal.content)).metadata.kind, 'jarvis-experience');
  assert.equal(parseExperience(Buffer.from(proposal.content)).metadata.verifiedOn, null);
  assert.throws(() => parseExperience(Buffer.from(content().replace('"kind":"jarvis-experience",', '')), { formal: true }), /requires kind/);
  assert.throws(() => approveExperience({ ...options, scope: 'project', from: out }), /verifiedOn/);
  assert.equal(existsSync(join(options.project, '.jarvis')), false);
  const ready = candidate(options);
  const preview = approveExperience(ready);
  assert.equal(preview.status, 'preview');
  assert.equal(preview.currentSha256, null);
  assert.equal(existsSync(preview.destination), false);
  assert.equal(existsSync(join(options.project, '.jarvis')), false);
  assert.throws(() => approveExperience({ ...ready, apply: true }), /source-sha256/);
  const applied = approve(ready);
  assert.equal(applied.status, 'approved');
  assert.equal(showExperience({ ...options, ref: 'project:retry-safe' }).sha256, applied.sha256);
  assert.equal(readFileSync(ready.from, 'utf8'), content());
  assert.equal(showExperience({ ...ready }).sourceSha256, preview.sourceSha256);
});

test('approval pins source and existing revision, preserves history outside curated roots, and rejects locks', t => {
  const options = fixture(t), ready = candidate(options);
  const preview = approveExperience(ready);
  writeFileSync(ready.from, content({ method: 'Changed method after preview.' }));
  assert.throws(() => approveExperience({ ...ready, apply: true, sourceSha256: preview.sourceSha256 }), /changed since preview/);
  const initial = approve(ready), original = readFileSync(initial.destination);
  writeFileSync(ready.from, content({ method: 'Second verified method.' }));
  const update = approveExperience(ready);
  assert.throws(() => approveExperience({ ...ready, apply: true, sourceSha256: update.sourceSha256 }), /expected-sha256/);
  assert.throws(() => approveExperience({ ...ready, apply: true, sourceSha256: update.sourceSha256, expectedSha256: '0'.repeat(64) }), /conflict/);
  assert.deepEqual(readFileSync(initial.destination), original);
  const history = join(options.project, '.jarvis/experience-history/retry-safe');
  writeFileSync(join(history, 'approval.lock'), 'in progress');
  assert.throws(() => approve(ready), /locked/);
  assert.deepEqual(readFileSync(initial.destination), original);
  rmSync(join(history, 'approval.lock'));
  const applied = approve(ready);
  assert.deepEqual(readFileSync(applied.backup), original);
  assert.equal(applied.backup.startsWith(history), true);
  assert.equal(existsSync(join(history, 'approval.lock')), false);
  writeFileSync(initial.destination, content({ state: 'approved', method: 'Manual new content.' }));
  assert.throws(() => approveExperience({ ...ready, apply: true, sourceSha256: update.sourceSha256, expectedSha256: update.currentSha256 }), /conflict/);
});

test('Unicode search respects scope before results, same IDs coexist and inactive records are excluded', t => {
  const options = fixture(t);
  approve(candidate(options));
  approve(candidate(options, { scope: 'personal', title: 'Personal retry' }));
  const both = searchExperience({ ...options, query: '中文' }).experiences;
  assert.deepEqual(both.map(record => record.scope), ['project', 'personal']);
  assert.equal(both.every(record => !Object.hasOwn(record, 'content')), true);
  assert.equal(both[0].heading, 'Method');
  assert.equal(searchExperience({ ...options, scope: 'personal', query: 'backend' }).experiences.length, 1);
  assert.equal(searchExperience({ home: options.home }).experiences.length, 1);
  writeFileSync(join(options.project, '.jarvis/knowledge/experience/draft-only.md'), content({ id: 'draft-only', state: 'draft' }));
  assert.equal(searchExperience(options).experiences.length, 2);
  const ready = candidate(options, { state: 'retired' });
  approve(ready);
  assert.deepEqual(searchExperience(options).experiences.map(record => record.scope), ['personal']);
  assert.equal(showExperience({ ...options, ref: 'project:retry-safe' }).metadata.state, 'retired');
});

test('search uses one active snapshot for state, content and digest during concurrent retirement', t => {
  const options = fixture(t), initial = approve(candidate(options));
  const active = readFileSync(initial.destination);
  const retired = Buffer.from(content({ state: 'retired', title: 'Retired replacement', method: 'Retired-only method.' }));
  const originalRead = fs.readFileSync;
  let reads = 0;
  t.mock.method(fs, 'readFileSync', (path, ...args) => String(path) === initial.destination
    ? (++reads === 1 ? active : retired) : originalRead(path, ...args));
  syncBuiltinESMExports();
  try {
    const found = searchExperience({ ...options, scope: 'project', query: '中文' }).experiences;
    assert.equal(reads, 1);
    assert.equal(found.length, 1);
    assert.equal(found[0].sha256, hash(active));
    assert.equal(found[0].title, '中文重试经验');
    assert.equal(found[0].heading, 'Method');
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});

test('search skips legacy frontmatter notes but reports the identity of malformed experience records', t => {
  const options = fixture(t);
  approve(candidate(options));
  const dir = join(options.project, '.jarvis/knowledge/experience');
  writeFileSync(join(dir, 'legacy-yaml.md'), '---\ntitle: Release checklist\nstate: published\nscope: project\ntags: [backend]\n---\n# Old note\n');
  writeFileSync(join(dir, 'legacy-json.md'), '---\n{"title":"Existing JSON note","state":"published","scope":"project","tags":["backend"]}\n---\n# Old note\n');
  assert.deepEqual(searchExperience({ ...options, scope: 'project' }).experiences.map(record => record.id), ['retry-safe']);
  const broken = join(dir, 'broken-record.md');
  writeFileSync(broken, '---\n{"kind":"jarvis-experience","id":"broken-record","scope":"project","state":"approved",\n---\n## Method\nIncomplete metadata.\n');
  assert.throws(() => searchExperience({ ...options, scope: 'project' }), /project:broken-record.*Invalid experience JSON frontmatter/);
  writeFileSync(broken, content({ id: 'broken-record', state: 'approved' }).replace('"contributors":["Atlas"]', '"contributors":[]'));
  assert.throws(() => searchExperience({ ...options, scope: 'project' }), /project:broken-record.*actual contributors/);
});

test('only headings outside backtick or tilde fences satisfy the contract; real sections may contain code', t => {
  const original = content();
  const parsed = parseExperience(Buffer.from(original));
  const frontmatter = original.slice(0, original.length - parsed.body.length);
  for (const fence of ['```markdown', '~~~~markdown']) {
    const close = fence.startsWith('`') ? '```' : '~~~~';
    const fenced = `${frontmatter}${fence}\n${parsed.body}\n${close}\n`;
    assert.throws(() => parseExperience(Buffer.from(fenced), { formal: true }), /completed Applicability/);
  }
  const methodExample = `${frontmatter}${parsed.body.replace('## Method\n', '```markdown\n## Method\n```\n')}`;
  assert.throws(() => parseExperience(Buffer.from(methodExample), { formal: true }), /completed Method/);
  const legitimate = content({ method: 'Use this example:\n\n~~~markdown\n## Limits\nThis heading is code, not the next section.\n~~~\n\nThen check the result.' });
  assert.equal(parseExperience(Buffer.from(legitimate), { formal: true }).metadata.id, 'retry-safe');
  const html = content({ method: '```html\n<!-- Render the verified example -->\n<div>Ready</div>\n```' });
  assert.equal(parseExperience(Buffer.from(html), { formal: true }).metadata.id, 'retry-safe');
  const options = fixture(t), ready = candidate(options);
  writeFileSync(ready.from, `${frontmatter}\`\`\`markdown\n${parsed.body}\n\`\`\`\n`);
  assert.throws(() => approveExperience(ready), /completed Applicability/);
  assert.equal(existsSync(join(options.project, '.jarvis')), false);
});

test('failed publication preserves the old content and removes only its staging file and lock', t => {
  const options = fixture(t), ready = candidate(options);
  const initial = approve(ready), original = readFileSync(initial.destination);
  writeFileSync(ready.from, content({ method: 'Replacement method.' }));
  t.mock.method(fs, 'renameSync', () => { const error = new Error('Synthetic publication failure'); error.code = 'EACCES'; throw error; });
  syncBuiltinESMExports();
  try {
    assert.throws(() => approve(ready), /Synthetic publication failure/);
    assert.deepEqual(readFileSync(initial.destination), original);
    assert.deepEqual(fs.readdirSync(join(options.project, '.jarvis/experience-history/retry-safe')), [`${hash(original)}.md`]);
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});

test('concurrent CLI updates allow one pinned revision and reject the competing writer', async t => {
  const options = fixture(t), ready = candidate(options);
  const initial = approve(ready);
  const candidates = ['First competing method.', 'Second competing method.'].map((method, index) => {
    const from = join(options.root, `concurrent-${index}.md`);
    writeFileSync(from, content({ method }));
    return approveExperience({ ...options, from, scope: 'project' });
  });
  const results = await Promise.all(candidates.map(preview => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'experience', 'approve', '--home', options.home, '--project', options.project,
      '--from', preview.source, '--scope', 'project', '--yes', '--source-sha256', preview.sourceSha256,
      '--expected-sha256', initial.sha256, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  })));
  assert.deepEqual(results.map(result => result.code).sort(), [0, 1]);
  assert.match(results.find(result => result.code === 1).stderr, /conflict|locked|changed during approval/);
  const winner = JSON.parse(results.find(result => result.code === 0).stdout);
  assert.equal(showExperience({ ...options, ref: 'project:retry-safe' }).sha256, winner.sha256);
  assert.equal(existsSync(join(options.project, '.jarvis/experience-history/retry-safe/approval.lock')), false);
});

test('plans reopen current MD, block stale/missing/retired references, and preserve controller settings', t => {
  const options = setupPlan(fixture(t));
  approve(candidate(options));
  const ref = searchExperience(options).experiences[0].ref;
  const plan = planTask({ ...options, experiences: [ref] });
  assert.equal(plan.status, 'proposed');
  assert.equal(plan.selectedExperience[0].ref, ref);
  assert.equal(plan.dispatched, false); assert.equal(plan.runtimeVerified, false);
  assert.equal(plan.requested.model, 'gpt-6.1-sol');
  approve(candidate(options, { method: 'A changed verified method.' }));
  assert.equal(planTask({ ...options, experiences: [ref] }).status, 'blocked');
  assert.match(planTask({ ...options, experiences: [ref] }).blockers[0], /Stale/);
  assert.match(planTask({ ...options, experiences: ['project:missing'] }).blockers[0], /Missing/);
  assert.match(planTask({ ...options, experiences: ['project:../retry-safe'] }).blockers[0], /reference/);
  approve(candidate(options, { state: 'retired' }));
  assert.match(planTask({ ...options, experiences: ['project:retry-safe'] }).blockers[0], /Inactive/);
});

test('archives omit task-local candidates/history and keep references usable after relocation', t => {
  const options = fixture(t);
  approve(candidate(options));
  approve(candidate(options, { method: 'Updated method with preserved history.' }));
  approve(candidate(options, { scope: 'personal' }));
  const references = searchExperience(options).experiences.map(record => record.ref);
  const legacy = join(options.project, '.jarvis/knowledge/experience');
  mkdirSync(join(legacy, 'notes'));
  writeFileSync(join(legacy, 'legacy.md'), '# Existing ordinary knowledge\n');
  writeFileSync(join(legacy, 'notes/old.md'), '# Existing nested knowledge\n');
  assert.deepEqual(searchExperience(options).experiences.map(record => record.ref), references);
  const out = join(options.root, 'assets.gz');
  exportAssets({ ...options, out });
  const archive = JSON.parse(gunzipSync(readFileSync(out)));
  assert.equal(archive.version, 1);
  assert.equal(archive.files.length, 4);
  assert.equal(archive.files.some(file => /history|candidate|draft/.test(file.path)), false);
  const relocated = { home: join(options.root, 'other-home'), project: join(options.root, 'other-project') };
  assert.equal(importAssets({ ...relocated, from: out, apply: true }).status, 'imported');
  assert.deepEqual(searchExperience(relocated).experiences.map(record => record.ref), references);
  assert.equal(readFileSync(join(relocated.project, '.jarvis/knowledge/experience/notes/old.md'), 'utf8'), '# Existing nested knowledge\n');
  assert.equal(showExperience({ ...relocated, ref: references[0] }).sha256, references[0].split('@')[1]);
});

test('candidate paths cannot pollute curated roots, and IDs/links cannot escape authorized paths', t => {
  const options = fixture(t);
  const destinations = [join(options.project, '.jarvis/knowledge/proposal.md'), join(options.home, 'jarvis/employees/proposal.md'),
    join(options.project, '.jarvis/resources/proposal.md'), join(options.home, 'jarvis/preferences.md'),
    join(options.project, '.jarvis/preferences.md'), join(dirname(options.home), '.agents/skills/example/proposal.md')];
  for (const out of destinations) assert.throws(() => proposeExperience({ ...options, id: 'safe', title: 'Safe', scope: 'project', out }), /curated/);
  for (const id of ['../escape', 'con', 'aux', 'com1', 'lpt9'])
    assert.throws(() => proposeExperience({ ...options, id, title: 'Unsafe', scope: 'project', out: join(options.root, 'unsafe.md') }), /metadata/);
  assert.throws(() => showExperience({ ...options, ref: 'project:../escape' }), /reference/);
  const outside = join(options.root, 'outside'); mkdirSync(outside);
  const linked = join(options.project, '.jarvis');
  try { symlinkSync(outside, linked, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Link creation unavailable in this sandbox.'); return; } throw error; }
  assert.throws(() => approve(candidate(options)), /Symbolic link or junction/);
  assert.throws(() => searchExperience(options), /Symbolic link or junction/);
  assert.equal(existsSync(join(outside, 'knowledge/experience/retry-safe.md')), false);
});

test('CLI rejects wrong flags and performs preview/pinned apply with Markdown dispatch output', t => {
  const options = setupPlan(fixture(t));
  for (const args of [['experience','search','--yes'], ['experience','show','--scope','personal'], ['plan','--id','oops'],
    ['experience','approve','--apply'], ['experience','propose','--scope','other'], ['experience','search','--source-sha256','0'.repeat(64)]])
    assert.equal(run(options, ...args).status, 1, args.join(' '));
  const ready = candidate(options);
  const previewResult = run(options, 'experience', 'approve', '--from', ready.from, '--scope', 'project');
  assert.equal(previewResult.status, 0, previewResult.stderr);
  const preview = JSON.parse(previewResult.stdout);
  assert.equal(existsSync(preview.destination), false);
  assert.equal(run(options, 'experience','approve','--from',ready.from,'--scope','project','--yes').status, 1);
  assert.equal(run(options, 'experience','approve','--from',ready.from,'--scope','project','--yes','--source-sha256',preview.sourceSha256).status, 0);
  const plan = spawnSync(process.execPath, [cli, 'plan', '--home', options.home, '--project', options.project, '--employee', 'atlas-backend',
    '--difficulty','complex','--experience','project:retry-safe','--format','markdown'], { encoding: 'utf8' });
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /^# Jarvis task plan/); assert.match(plan.stdout, /Dispatched: false/);
  assert.match(plan.stdout, /project:retry-safe@[a-f0-9]{64}/); assert.doesNotMatch(plan.stdout, /Synthetic fixture/);
  assert.equal(run(options,'plan','--employee','atlas-backend','--difficulty','complex','--format','markdown').status, 1);
  assert.equal(run(options,'experience','show','--ref','project:retry-safe','--from',ready.from).status, 1);
});
