import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { realpathSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { exportAssets, importAssets } from '../src/assets.mjs';

const roots = new Set();
test.after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'jarvis-assets-'));
  roots.add(root);
  return { root, home: join(root, 'source'), target: join(root, 'target'), project: join(root, 'project'), targetProject: join(root, 'target-project'), out: join(root, 'assets.jarvis.json.gz') };
}
function put(root, path, data = 'example\n') {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, data);
}
function readArchive(path) { return JSON.parse(gunzipSync(readFileSync(path))); }
function saveArchive(path, archive) { writeFileSync(path, gzipSync(Buffer.from(JSON.stringify(archive)))); }
function entry(path, data = 'example\n', scope = 'home') {
  data = Buffer.from(data);
  return { scope, path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), content: data.toString('base64') };
}
function crafted(files, missingSkills = []) { return { format: 'codex-jarvis-assets', version: 1, files, missingSkills }; }

test('real roundtrip previews without writes, maps project assets, carries binary/license/model assets, and imports idempotently', () => {
  const f = fixture();
  put(f.home, 'jarvis/employees/atlas.md', '---\n{"skills":[{"id":"research","when":"research"}]}\n---\n# Atlas\n');
  put(f.home, 'jarvis/knowledge/personal/style.md', '# Personal\n');
  put(f.home, 'jarvis/knowledge/general/principles.md', '# General\n');
  put(f.home, 'jarvis/preferences.md', 'Use selected models.\n');
  put(f.home, 'jarvis/skills.json', '{"skills":["research","unavailable"]}\n');
  put(f.home, 'skills/research/SKILL.md', '# Research\n');
  put(f.home, 'skills/research/references/doc.md', '# Reference\n');
  put(f.home, 'skills/research/scripts/tool.mjs', 'throw new Error("must never execute");\n');
  put(f.home, 'skills/research/LICENSE', 'MIT example\n');
  put(f.home, 'skills/research/assets/icon.bin', Buffer.from([0, 255, 128, 17]));
  put(f.home, 'skills/jarvis-orchestrator/SKILL.md', '# Jarvis\n');
  put(f.project, '.jarvis/employees/local.md', '# Project employee\n');
  put(f.project, '.jarvis/knowledge/work.md', '# Project knowledge\n');
  put(f.project, '.jarvis/preferences.md', 'Project preference\n');
  const models = { controller: { model: 'gpt-6.1-sol', effort: 'high' }, simple: { model: 'gpt-6.1-sol', effort: 'low', fast: false } };
  const exported = exportAssets({ ...f, models });
  assert.equal(exported.status, 'exported');
  assert.equal(readArchive(f.out).format, 'codex-jarvis-assets');
  assert.deepEqual(exported.missingSkills, ['unavailable']);
  assert.equal(exported.counts.employees, 2);
  assert.equal(exported.counts.knowledge, 3);
  assert.deepEqual(exported.portability, { pathsRewritten: false, externalDependenciesBundled: false, scriptsExecuted: false });
  const preview = importAssets({ home: f.target, from: f.out, project: f.targetProject });
  assert.equal(preview.status, 'preview');
  assert.equal(preview.writtenCount, 0);
  assert.equal(preview.fileCount, exported.fileCount);
  assert.equal(existsSync(f.target), false);
  assert.equal(existsSync(f.targetProject), false);
  const imported = importAssets({ home: f.target, from: f.out, project: f.targetProject, apply: true });
  assert.equal(imported.status, 'imported');
  assert.equal(imported.writtenCount, exported.fileCount);
  assert.deepEqual(JSON.parse(readFileSync(join(f.target, 'jarvis/models.json'))), models);
  assert.deepEqual(readFileSync(join(f.target, 'skills/research/assets/icon.bin')), Buffer.from([0, 255, 128, 17]));
  assert.equal(readFileSync(join(f.target, 'skills/research/LICENSE'), 'utf8'), 'MIT example\n');
  assert.equal(readFileSync(join(f.targetProject, '.jarvis/knowledge/work.md'), 'utf8'), '# Project knowledge\n');
  const repeat = importAssets({ home: f.target, from: f.out, project: f.targetProject, apply: true });
  assert.equal(repeat.writtenCount, 0);
  assert.equal(repeat.skippedCount, exported.fileCount);
  assert.equal(repeat.sha256, exported.sha256);
  assert.equal(existsSync(join(f.target, 'config.toml')), false);
});

test('pre-rename archive format remains importable after public package rename', () => {
  const f = fixture();
  saveArchive(f.out, crafted([entry('jarvis/preferences.md', 'Legacy preference\n')]));
  assert.equal(importAssets({ home: f.target, from: f.out, apply: true }).status, 'imported');
  assert.equal(readFileSync(join(f.target, 'jarvis/preferences.md'), 'utf8'), 'Legacy preference\n');
});

test('curated resources roundtrip binary templates and project assets without collecting drafts or executing scripts', () => {
  const f = fixture();
  const binary = Buffer.from([0, 255, 128, 23]);
  put(f.home, 'jarvis/resources/office/template.bin', binary);
  put(f.home, 'jarvis/resources/office/source.md', 'Reviewed source and license');
  put(f.home, 'jarvis/resources/tool.mjs', 'throw new Error("do not execute");');
  put(f.home, 'jarvis/resources/.env', 'PRIVATE');
  put(f.home, 'jarvis/drafts/unapproved.md', 'NOT CURATED');
  put(f.project, '.jarvis/resources/video/storyboard.md', 'Accepted storyboard');
  const exported = exportAssets(f);
  assert.equal(exported.counts.resources, 4);
  assert.equal(readArchive(f.out).files.some(file => file.path.includes('drafts') || file.path.endsWith('.env')), false);
  const preview = importAssets({ home: f.target, project: f.targetProject, from: f.out });
  assert.equal(preview.counts.resources, 4);
  assert.equal(existsSync(f.target), false);
  importAssets({ home: f.target, project: f.targetProject, from: f.out, apply: true });
  assert.deepEqual(readFileSync(join(f.target, 'jarvis/resources/office/template.bin')), binary);
  assert.equal(readFileSync(join(f.targetProject, '.jarvis/resources/video/storyboard.md'), 'utf8'), 'Accepted storyboard');
  put(f.target, 'jarvis/resources/office/template.bin', 'User changed');
  const conflict = importAssets({ home: f.target, project: f.targetProject, from: f.out, apply: true });
  assert.equal(conflict.status, 'conflicts');
  assert.equal(conflict.writtenCount, 0);
});

test('resource destinations keep traversal, sensitive-path, size and junction protection', () => {
  const f = fixture();
  for (const path of ['jarvis/resources/../outside.md', 'jarvis/resources/auth.json', 'jarvis/resources/.env', 'resources/unapproved.bin']) {
    saveArchive(f.out, crafted([entry(path)]));
    assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /Unsafe|excluded|whitelist/);
    assert.equal(existsSync(f.target), false);
  }
  const large = fixture();
  put(large.home, 'jarvis/resources/large.bin', Buffer.alloc(4 * 1024 * 1024 + 1));
  assert.throws(() => exportAssets(large), /size limit/);
  const linked = fixture();
  const outside = join(linked.root, 'outside'); mkdirSync(outside);
  put(linked.home, 'jarvis/resources/valid.md');
  symlinkSync(outside, join(linked.home, 'jarvis/resources/linked'), 'junction');
  assert.throws(() => exportAssets(linked), /link or junction/);
  assert.equal(existsSync(linked.out), false);
});

test('employee skill metadata merges registry dependencies, searches roots in order, and adds only existing orchestrator', () => {
  const f = fixture();
  const alternate = join(f.root, 'alternate');
  put(f.home, 'jarvis/employees/new.md', '---\n{"metadata":{"skills":[{"id":"new-skill","when":"always"}]}}\n---\n# New\n');
  put(alternate, 'new-skill/SKILL.md', 'Alternate skill\n');
  put(f.home, 'skills/new-skill/SKILL.md', 'First skill\n');
  const result = exportAssets({ home: f.home, out: f.out, skillRoots: [join(f.home, 'skills'), alternate] });
  assert.deepEqual(result.missingSkills, []);
  assert.equal(result.counts.skills, 1);
  const skill = readArchive(f.out).files.find(file => file.path === 'skills/new-skill/SKILL.md');
  assert.equal(Buffer.from(skill.content, 'base64').toString(), 'First skill\n');
});

test('legacy employees work without metadata and default sibling .agents skills root is supported', () => {
  const f = fixture();
  put(f.home, 'jarvis/employees/legacy.md', '# Legacy\n');
  put(f.home, 'jarvis/skills.json', '{"skills":["shared"]}');
  put(f.root, '.agents/skills/shared/SKILL.md', '# Shared\n');
  const result = exportAssets(f);
  assert.deepEqual(result.missingSkills, []);
  assert.equal(result.counts.skills, 1);
});

test('default skill roots prefer project .agents then .codex, while explicit roots replace every default', () => {
  const f = fixture();
  put(f.home, 'jarvis/skills.json', '{"skills":["shared","codex-only"]}');
  put(f.home, 'skills/shared/SKILL.md', 'Home\n');
  put(f.home, 'skills/codex-only/SKILL.md', 'Home fallback\n');
  put(f.project, '.agents/skills/shared/SKILL.md', 'Project agents\n');
  put(f.project, '.codex/skills/shared/SKILL.md', 'Project codex shadowed\n');
  put(f.project, '.codex/skills/codex-only/SKILL.md', 'Project codex\n');
  exportAssets(f);
  let files = readArchive(f.out).files;
  const content = path => Buffer.from(files.find(file => file.path === path).content, 'base64').toString();
  assert.equal(content('skills/shared/SKILL.md'), 'Project agents\n');
  assert.equal(content('skills/codex-only/SKILL.md'), 'Project codex\n');
  const explicit = join(f.root, 'explicit');
  put(explicit, 'shared/SKILL.md', 'Explicit\n');
  const explicitArchive = join(f.root, 'explicit.jarvis.json.gz');
  const result = exportAssets({ ...f, out: explicitArchive, skillRoots: [explicit] });
  files = readArchive(explicitArchive).files;
  assert.equal(content('skills/shared/SKILL.md'), 'Explicit\n');
  assert.deepEqual(result.missingSkills, ['codex-only']);
});

test('saved portable model preferences survive a second export/import and explicit models replace them', () => {
  const f = fixture();
  const original = { controller: { model: 'gpt-6.1-sol', effort: 'high', fast: true }, simple: { model: 'gpt-6.1-sol', effort: 'low', fast: false } };
  exportAssets({ ...f, models: original });
  importAssets({ home: f.target, from: f.out, apply: true });
  const secondArchive = join(f.root, 'second.jarvis.json.gz');
  const second = exportAssets({ home: f.target, out: secondArchive });
  assert.equal(second.counts.models, 1);
  const secondTarget = join(f.root, 'second-target');
  importAssets({ home: secondTarget, from: secondArchive, apply: true });
  assert.deepEqual(JSON.parse(readFileSync(join(secondTarget, 'jarvis/models.json'))), original);
  const explicit = { controller: { model: 'gpt-6-sol', effort: 'medium' } };
  const explicitArchive = join(f.root, 'explicit-models.jarvis.json.gz');
  exportAssets({ home: f.target, out: explicitArchive, models: explicit });
  const modelFile = readArchive(explicitArchive).files.find(file => file.path === 'jarvis/models.json');
  assert.deepEqual(JSON.parse(Buffer.from(modelFile.content, 'base64')), explicit);
  put(f.target, 'jarvis/models.json', '{"controller":{"model":"gpt-6.1-sol","account":"private"}}');
  const invalidArchive = join(f.root, 'invalid-models.jarvis.json.gz');
  assert.throws(() => exportAssets({ home: f.target, out: invalidArchive }), /Invalid portable model/);
  assert.equal(existsSync(invalidArchive), false);
});

test('sensitive home paths, unregistered skills, and sensitive nested skill paths are excluded', () => {
  const f = fixture();
  for (const path of ['auth.json', 'config.toml', 'history.jsonl', 'sessions/run.jsonl', 'backups/config.toml', 'credentials/token', '.env', 'jarvis/employees/not-markdown.json']) put(f.home, path, 'SECRET');
  put(f.home, 'jarvis/skills.json', '{"skills":["safe"]}');
  put(f.home, 'skills/safe/SKILL.md');
  put(f.home, 'skills/unregistered/SKILL.md', 'DO NOT COPY');
  for (const path of ['.env', '.env.local', 'auth/token', 'auth.json', 'config.toml', 'credentials/key', 'node_modules/dependency/index.js', '.git/config', 'backups/file', 'sessions/session.jsonl']) put(f.home, `skills/safe/${path}`, 'SECRET');
  const result = exportAssets(f);
  assert.equal(result.fileCount, 2);
  assert.equal(gunzipSync(readFileSync(f.out)).includes('SECRET'), false);
  assert.deepEqual(readArchive(f.out).files.map(file => file.path), ['jarvis/skills.json', 'skills/safe/SKILL.md']);
});

test('conflicts are fully preflighted: apply writes nothing and preserves every user file', () => {
  const f = fixture();
  put(f.home, 'jarvis/knowledge/a.md', 'new-a');
  put(f.home, 'jarvis/knowledge/b.md', 'new-b');
  exportAssets(f);
  put(f.target, 'jarvis/knowledge/b.md', 'user-b');
  const result = importAssets({ home: f.target, from: f.out, apply: true });
  assert.equal(result.status, 'conflicts');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.writtenCount, 0);
  assert.equal(existsSync(join(f.target, 'jarvis/knowledge/a.md')), false);
  assert.equal(readFileSync(join(f.target, 'jarvis/knowledge/b.md'), 'utf8'), 'user-b');
});

test('a parent file is a preflight conflict and directory creation failure rolls back newly created files/directories', () => {
  const f = fixture();
  put(f.home, 'jarvis/knowledge/a.md', 'a');
  put(f.home, 'jarvis/knowledge/sub/b.md', 'b');
  exportAssets(f);
  put(f.target, 'jarvis/knowledge/sub', 'user-parent');
  assert.equal(importAssets({ home: f.target, from: f.out, apply: true }).status, 'conflicts');
  assert.equal(existsSync(join(f.target, 'jarvis/knowledge/a.md')), false);
  const newTarget = join(f.root, 'rollback-target');
  const original = fs.mkdirSync;
  fs.mkdirSync = (path, ...args) => {
    if (path === join(newTarget, 'jarvis/knowledge/sub')) { const error = new Error('simulated directory creation failure'); error.code = 'EACCES'; throw error; }
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => importAssets({ home: newTarget, from: f.out, apply: true }), /simulated directory/); }
  finally { fs.mkdirSync = original; syncBuiltinESMExports(); }
  assert.equal(existsSync(newTarget), false);
  assert.equal(readFileSync(join(f.target, 'jarvis/knowledge/sub'), 'utf8'), 'user-parent');
});

test('a late write failure cleans up partial files while retaining pre-existing equal files and directories', () => {
  const f = fixture();
  put(f.home, 'jarvis/knowledge/a.md', 'a');
  put(f.home, 'jarvis/knowledge/b.md', 'b');
  put(f.home, 'jarvis/knowledge/c.md', 'c');
  exportAssets(f);
  put(f.target, 'jarvis/knowledge/a.md', 'a');
  const original = fs.writeFileSync;
  let calls = 0;
  fs.writeFileSync = (fd, data, ...args) => {
    if (++calls === 2) { original(fd, data.subarray(0, 1)); throw new Error('simulated write failure'); }
    return original(fd, data, ...args);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /simulated write/); }
  finally { fs.writeFileSync = original; syncBuiltinESMExports(); }
  assert.deepEqual(readdirSync(join(f.target, 'jarvis/knowledge')), ['a.md']);
  assert.equal(readFileSync(join(f.target, 'jarvis/knowledge/a.md'), 'utf8'), 'a');
});

test('tampering, duplicate paths, unknown schema, noncanonical encoding, and invalid scopes fail before writes', () => {
  for (const mutate of [
    archive => { archive.files[0].content = Buffer.from('altered').toString('base64'); },
    archive => { archive.files[0].sha256 = '0'.repeat(64); },
    archive => { archive.files.push({ ...archive.files[0] }); },
    archive => { archive.version = 2; },
    archive => { archive.unexpected = true; },
    archive => { archive.files[0].scope = 'system'; },
    archive => { archive.files[0].content += '\n'; },
    archive => { archive.files[0].bytes = -1; },
  ]) {
    const f = fixture();
    const archive = crafted([entry('jarvis/knowledge/a.md')]);
    mutate(archive); saveArchive(f.out, archive);
    assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }));
    assert.equal(existsSync(f.target), false);
  }
});

test('traversal, Windows devices, ADS, unsafe names, sensitive destinations, and nonwhite-listed paths are rejected', () => {
  for (const path of ['../outside.md', '/absolute.md', 'jarvis/knowledge/../outside.md', 'jarvis\\knowledge\\a.md', 'jarvis/knowledge/CON.md', 'jarvis/knowledge/LPT1.md', 'jarvis/knowledge/a.md:token', 'jarvis/knowledge/trailing .md.', 'jarvis/knowledge/x\u0000.md', 'jarvis/knowledge/.env/x.md', 'skills/safe/.git/config', 'config.toml', 'AGENTS.md', 'agents/jarvis_sol.toml', 'jarvis/arbitrary.md']) {
    const f = fixture(); saveArchive(f.out, crafted([entry(path)]));
    assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), undefined, path);
    assert.equal(existsSync(f.target), false);
  }
});

test('case conflicts and file/directory overlaps inside an archive are rejected on every platform', () => {
  for (const paths of [
    ['jarvis/knowledge/a.md', 'jarvis/knowledge/A.md'],
    ['jarvis/knowledge/Folder/a.md', 'jarvis/knowledge/folder/b.md'],
    ['skills/safe/SKILL.md', 'skills/safe/SKILL.md/child'],
  ]) {
    const f = fixture(); saveArchive(f.out, crafted(paths.map(path => entry(path))));
    assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /conflicting|overlapping/);
    assert.equal(existsSync(f.target), false);
  }
});

test('existing case conflicts are reported even when the filesystem permits both spellings', () => {
  const f = fixture();
  saveArchive(f.out, crafted([entry('jarvis/knowledge/folder/a.md')]));
  put(f.target, 'jarvis/knowledge/Folder/b.md', 'user');
  const result = importAssets({ home: f.target, from: f.out, apply: true });
  assert.equal(result.status, 'conflicts');
  assert.match(result.conflicts[0].reason, /case/);
  assert.equal(existsSync(join(f.target, 'jarvis/knowledge/Folder/a.md')), false);
});

test('export rejects linked skills and import rejects junction ancestors without following them', () => {
  const f = fixture();
  const external = join(f.root, 'external');
  put(external, 'linked/SKILL.md', '# External\n');
  put(f.home, 'jarvis/skills.json', '{"skills":["linked"]}');
  mkdirSync(join(f.home, 'skills'), { recursive: true });
  symlinkSync(join(external, 'linked'), join(f.home, 'skills/linked'), 'junction');
  assert.throws(() => exportAssets(f), /link or junction/);
  assert.equal(existsSync(f.out), false);
  saveArchive(f.out, crafted([entry('jarvis/knowledge/a.md')]));
  mkdirSync(f.target);
  symlinkSync(external, join(f.target, 'jarvis'), 'junction');
  assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /link or junction/);
  assert.equal(existsSync(join(external, 'knowledge/a.md')), false);
});

test('linked references within a skill block export with a concrete path', () => {
  const f = fixture();
  put(f.home, 'jarvis/skills.json', '{"skills":["linked"]}');
  put(f.home, 'skills/linked/SKILL.md');
  const outside = join(f.root, 'outside'); mkdirSync(outside);
  const linked = join(f.home, 'skills/linked/references');
  symlinkSync(outside, linked, 'junction');
  assert.throws(() => exportAssets(f), error => error.message.includes(linked));
  assert.equal(existsSync(f.out), false);
});

test('project archives require explicit destination and cannot write arbitrary project files', () => {
  const f = fixture(); saveArchive(f.out, crafted([entry('.jarvis/knowledge/work.md', 'work', 'project')]));
  assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /supply project/);
  assert.equal(existsSync(f.target), false);
  saveArchive(f.out, crafted([entry('README.md', 'bad', 'project')]));
  assert.throws(() => importAssets({ home: f.target, from: f.out, project: f.targetProject, apply: true }), /whitelist/);
  assert.equal(existsSync(f.targetProject), false);
});

test('only model/effort/fast for supported roles can travel, with no paths or account settings', () => {
  for (const models of [
    { controller: { model: 'gpt-6.1-sol', account: 'secret' } },
    { controller: { path: 'C:/Users/private' } },
    { controller: { model: 'C:/Users/private' } },
    ...['/Users/private', '../private', 'provider/../private', 'provider//model', 'provider/model/extra', 'provider\\model', 'https://private', 'model name', 'model\nname', 'model\u0000name', 'a'.repeat(129)].map(model => ({ controller: { model } })),
    { unknown: { model: 'gpt-6.1-sol' } },
    { controller: { fast: 'yes' } },
    { controller: { effort: 'invalid' } },
  ]) {
    const f = fixture();
    assert.throws(() => exportAssets({ ...f, models }), /Invalid/);
    assert.equal(existsSync(f.out), false);
    saveArchive(f.out, crafted([entry('jarvis/models.json', JSON.stringify(models))]));
    assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /Invalid/);
    assert.equal(existsSync(f.target), false);
  }
});

test('oversized files and decompression bombs fail safely, and output archives are never overwritten', () => {
  const f = fixture();
  put(f.home, 'jarvis/knowledge/large.md', Buffer.alloc(4 * 1024 * 1024 + 1));
  assert.throws(() => exportAssets(f), /size limit/);
  assert.equal(existsSync(f.out), false);
  writeFileSync(f.out, gzipSync(Buffer.alloc(48 * 1024 * 1024 + 1)));
  assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /decompressed size limit/);
  assert.equal(existsSync(f.target), false);
  writeFileSync(f.out, 'original');
  assert.throws(() => exportAssets(f), /already exists/);
  assert.equal(readFileSync(f.out, 'utf8'), 'original');
});

test('import derives missing dependencies from cards and registry instead of trusting a completeness claim', () => {
  const f = fixture();
  saveArchive(f.out, crafted([
    entry('jarvis/skills.json', '{"skills":["registry-missing"]}'),
    entry('jarvis/employees/new.md', '---\n{"skills":[{"id":"card-missing","when":"always"}]}\n---\n# New'),
  ]));
  const result = importAssets({ home: f.target, from: f.out });
  assert.deepEqual(result.missingSkills, ['card-missing', 'registry-missing']);
  assert.equal(existsSync(f.target), false);
  saveArchive(f.out, crafted([entry('skills/broken/references/doc.md')]));
  assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /missing SKILL.md/);
  saveArchive(f.out, crafted([entry('skills/present/SKILL.md')], ['present']));
  assert.throws(() => importAssets({ home: f.target, from: f.out, apply: true }), /both included/);
});

test('declared skills require a regular SKILL.md and invalid registries or metadata never produce an archive', () => {
  const f = fixture();
  put(f.home, 'jarvis/skills.json', '{"skills":["broken"]}');
  mkdirSync(join(f.home, 'skills/broken/SKILL.md'), { recursive: true });
  assert.throws(() => exportAssets(f), /regular SKILL.md/);
  assert.equal(existsSync(f.out), false);
  put(f.home, 'jarvis/skills.json', '{"skills":["../unsafe"]}');
  assert.throws(() => exportAssets(f), /Unsafe/);
  put(f.home, 'jarvis/skills.json', '{"skills":[],"credentials":"private"}');
  assert.throws(() => exportAssets(f), /only a skills array/);
  put(f.home, 'jarvis/skills.json', '{"skills":[]}');
  put(f.home, 'jarvis/employees/broken.md', '---\nnull\n---\n# Broken');
  assert.throws(() => exportAssets(f), /Invalid employee metadata/);
  assert.equal(existsSync(f.out), false);
});
