import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

// Stable archive format, shared with assets exported before the Open Jarvis rename.
const FORMAT = 'codex-jarvis-assets';
const LIMITS = Object.freeze({ file: 4 * 1024 * 1024, total: 32 * 1024 * 1024, compressed: 16 * 1024 * 1024, json: 48 * 1024 * 1024, files: 5000 });
const PORTABILITY = Object.freeze({ pathsRewritten: false, externalDependenciesBundled: false, scriptsExecuted: false });
const ROLES = new Set(['controller', 'luna', 'simple', 'terra', 'sol', 'reviewer']);
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const OMIT = new Set(['.git', 'node_modules', 'backups', 'credentials', 'auth', 'sessions', 'history', 'auth.json', 'config.toml']);
const hash = data => createHash('sha256').update(data).digest('hex');
const fail = message => { throw new Error(message); };

function absolute(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value)) fail(`${label} must be an absolute path.`);
  return resolve(value);
}

function safePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\')) fail('Invalid asset path.');
  for (const part of value.split('/')) {
    if (!part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f\x7f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)) fail(`Unsafe asset path: ${value}`);
  }
  return value;
}

function skillId(value) {
  safePath(value);
  if (value.includes('/')) fail(`Skill ID must name one directory: ${value}`);
  return value;
}

function omitted(part) {
  const lower = part.toLowerCase();
  return OMIT.has(lower) || lower === '.env' || lower.startsWith('.env.') || lower === 'history.jsonl' || lower === 'session.jsonl';
}

// Check every existing ancestor: a regular-looking leaf can sit inside a junction.
function checkAncestors(path) {
  const chain = [];
  for (let current = resolve(path); ; current = dirname(current)) {
    chain.push(current);
    if (dirname(current) === current) break;
  }
  for (const current of chain.reverse()) {
    let info;
    try { info = lstatSync(current); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue; throw error; }
    if (info.isSymbolicLink()) fail(`Symbolic link or junction blocks asset operation: ${current}`);
  }
}

function parseJson(data, label) {
  try { return JSON.parse(data.toString('utf8').replace(/^\uFEFF/, '')); }
  catch { fail(`Invalid ${label} JSON; no content was printed.`); }
}

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function registry(data) {
  const value = parseJson(data, 'skills registry');
  if (!object(value) || Object.keys(value).some(key => key !== 'skills') || !Array.isArray(value.skills)) fail('Skills registry must contain only a skills array.');
  return value.skills.map(skillId);
}

function models(value) {
  if (!object(value)) fail('Models must be an object.');
  for (const [role, settings] of Object.entries(value)) {
    if (!ROLES.has(role) || !object(settings) || !Object.keys(settings).length || Object.keys(settings).some(key => !['model', 'effort', 'fast'].includes(key))) fail(`Invalid portable model settings for ${role}.`);
    if (Object.hasOwn(settings, 'model') && (typeof settings.model !== 'string' || settings.model.length > 128 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]*)?$/.test(settings.model))) fail(`Invalid model for ${role}.`);
    if (Object.hasOwn(settings, 'effort') && !EFFORTS.has(settings.effort)) fail(`Invalid effort for ${role}.`);
    if (Object.hasOwn(settings, 'fast') && typeof settings.fast !== 'boolean') fail(`Invalid Fast preference for ${role}.`);
  }
  return value;
}

function employeeSkills(data, path) {
  const text = data.toString('utf8').replace(/^\uFEFF/, '');
  if (!/^---\r?\n/.test(text)) return [];
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) fail(`Unclosed employee metadata: ${path}`);
  const metadata = parseJson(Buffer.from(match[1]), `employee metadata (${path})`);
  if (!object(metadata)) fail(`Invalid employee metadata: ${path}`);
  const skills = metadata.metadata?.skills ?? metadata.skills;
  if (skills === undefined) return [];
  if (!Array.isArray(skills)) fail(`Invalid employee skills: ${path}`);
  return skills.map(item => skillId(typeof item === 'string' ? item : item?.id));
}

function category(path) {
  if (path.startsWith('skills/')) return 'skills';
  if (path.includes('/employees/')) return 'employees';
  if (path.includes('/knowledge/')) return 'knowledge';
  if (path.includes('/resources/')) return 'resources';
  if (path.endsWith('/preferences.md')) return 'preferences';
  if (path.endsWith('/skills.json')) return 'registry';
  return 'models';
}

function counts(files) {
  const result = { employees: 0, knowledge: 0, resources: 0, preferences: 0, skills: 0, registry: 0, models: 0 };
  for (const file of files) result[category(file.path)]++;
  return result;
}

function allowed(scope, path) {
  safePath(path);
  if (path.split('/').some(omitted)) fail(`Sensitive asset path is excluded: ${path}`);
  if (scope === 'home') {
    if (/^skills\/[^/]+\/.+/.test(path)) { skillId(path.split('/')[1]); return; }
    if (/^jarvis\/resources\/.+/.test(path)) return;
    if (/^jarvis\/(employees|knowledge)\/.+\.md$/.test(path) || ['jarvis/preferences.md', 'jarvis/skills.json', 'jarvis/models.json'].includes(path)) return;
  }
  if (scope === 'project' && (/^\.jarvis\/(employees|knowledge)\/.+\.md$/.test(path) || path === '.jarvis/preferences.md')) return;
  if (scope === 'project' && /^\.jarvis\/resources\/.+/.test(path)) return;
  fail(`Asset destination is outside the whitelist: ${scope}/${path}`);
}

function pathIndex() {
  const paths = new Map();
  return (scope, path) => {
    const parts = path.split('/');
    for (let index = 1; index <= parts.length; index++) {
      const prefix = `${scope}/${parts.slice(0, index).join('/')}`;
      const key = prefix.toLowerCase();
      const leaf = index === parts.length;
      const previous = paths.get(key);
      if (previous && (previous.path !== prefix || previous.leaf || leaf)) fail(`Duplicate, case-conflicting, or overlapping asset path: ${prefix}`);
      paths.set(key, { path: prefix, leaf });
    }
  };
}

export function exportAssets({ home, out, project, skillRoots, models: portableModels } = {}) {
  home = absolute(home, 'home');
  out = absolute(out, 'out');
  if (project !== undefined) project = absolute(project, 'project');
  checkAncestors(home);
  checkAncestors(out);
  if (project) checkAncestors(project);
  if (existsSync(out)) fail(`Archive already exists: ${out}`);
  const files = [], addPath = pathIndex(), requestedSkills = new Set();
  let total = 0;
  function add(scope, path, data) {
    allowed(scope, path);
    addPath(scope, path);
    if (data.length > LIMITS.file || total + data.length > LIMITS.total || files.length >= LIMITS.files) fail('Asset size or file-count limit exceeded.');
    total += data.length;
    files.push({ scope, path, bytes: data.length, sha256: hash(data), content: data.toString('base64') });
    if (category(path) === 'employees') for (const id of employeeSkills(data, path)) requestedSkills.add(id);
  }
  function walk(source, scope, destination, markdownOnly = false) {
    checkAncestors(source);
    if (!existsSync(source)) return;
    const info = lstatSync(source);
    if (info.isDirectory()) {
      for (const name of readdirSync(source).sort()) {
        const child = join(source, name);
        if (lstatSync(child).isSymbolicLink()) fail(`Symbolic link or junction blocks asset export: ${child}`);
        if (!omitted(name)) walk(child, scope, `${destination}/${name}`, markdownOnly);
      }
    } else if (info.isFile()) {
      if (!markdownOnly || destination.endsWith('.md')) {
        if (info.size > LIMITS.file) fail(`Asset file exceeds size limit: ${source}`);
        add(scope, destination, readFileSync(source));
      }
    } else fail(`Unsupported asset file type: ${source}`);
  }
  for (const [scope, root, prefix] of [['home', home, 'jarvis'], ...(project ? [['project', project, '.jarvis']] : [])]) {
    for (const kind of ['employees', 'knowledge']) walk(join(root, prefix, kind), scope, `${prefix}/${kind}`, true);
    walk(join(root, prefix, 'resources'), scope, `${prefix}/resources`);
    walk(join(root, prefix, 'preferences.md'), scope, `${prefix}/preferences.md`);
  }
  const registryPath = join(home, 'jarvis', 'skills.json');
  checkAncestors(registryPath);
  if (existsSync(registryPath)) {
    if (lstatSync(registryPath).size > LIMITS.file) fail('Skills registry exceeds size limit.');
    const data = readFileSync(registryPath);
    for (const id of registry(data)) requestedSkills.add(id);
    add('home', 'jarvis/skills.json', data);
  }
  if (skillRoots !== undefined && !Array.isArray(skillRoots)) fail('skillRoots must be an array.');
  const roots = (skillRoots ?? [
    ...(project ? [join(project, '.agents', 'skills'), join(project, '.codex', 'skills')] : []),
    join(home, 'skills'), join(dirname(home), '.agents', 'skills'),
  ]).map(root => absolute(root, 'skillRoots entry'));
  function locate(id) {
    for (const root of roots) {
      const candidate = join(root, id);
      checkAncestors(candidate);
      if (!existsSync(candidate)) continue;
      if (!lstatSync(candidate).isDirectory()) fail(`Skill must be a directory: ${candidate}`);
      checkAncestors(join(candidate, 'SKILL.md'));
      if (!existsSync(join(candidate, 'SKILL.md')) || !lstatSync(join(candidate, 'SKILL.md')).isFile()) fail(`Skill is missing a regular SKILL.md: ${candidate}`);
      return candidate;
    }
  }
  const orchestrator = locate('jarvis-orchestrator');
  if (orchestrator) requestedSkills.add('jarvis-orchestrator');
  const missingSkills = [];
  for (const id of [...requestedSkills].sort()) {
    const source = id === 'jarvis-orchestrator' ? orchestrator : locate(id);
    if (!source) missingSkills.push(id);
    else walk(source, 'home', `skills/${id}`);
  }
  if (portableModels !== undefined) add('home', 'jarvis/models.json', Buffer.from(`${JSON.stringify(models(portableModels), null, 2)}\n`));
  else {
    const savedModels = join(home, 'jarvis', 'models.json');
    checkAncestors(savedModels);
    if (existsSync(savedModels)) {
      const info = lstatSync(savedModels);
      if (!info.isFile() || info.size > LIMITS.file) fail('Saved models must be a regular file within the size limit.');
      const data = readFileSync(savedModels);
      models(parseJson(data, 'saved models'));
      add('home', 'jarvis/models.json', data);
    }
  }
  const archive = { format: FORMAT, version: 1, files, missingSkills };
  const json = Buffer.from(JSON.stringify(archive));
  if (json.length > LIMITS.json) fail('Archive JSON exceeds size limit.');
  const compressed = gzipSync(json);
  if (compressed.length > LIMITS.compressed) fail('Compressed archive exceeds size limit.');
  let fd;
  try { fd = openSync(out, 'wx'); writeFileSync(fd, compressed); }
  catch (error) { if (fd !== undefined) { closeSync(fd); fd = undefined; unlinkSync(out); } throw error; }
  finally { if (fd !== undefined) closeSync(fd); }
  return { status: 'exported', archive: out, sha256: hash(compressed), fileCount: files.length, counts: counts(files), missingSkills, bytes: total, compressedBytes: compressed.length, portability: { ...PORTABILITY } };
}

export function importAssets({ home, from, project, apply = false } = {}) {
  home = absolute(home, 'home');
  from = absolute(from, 'from');
  if (project !== undefined) project = absolute(project, 'project');
  if (typeof apply !== 'boolean') fail('apply must be a boolean.');
  checkAncestors(from); checkAncestors(home);
  if (project) checkAncestors(project);
  if (!lstatSync(from).isFile() || lstatSync(from).size > LIMITS.compressed) fail('Archive exceeds compressed size limit or is not a file.');
  const compressed = readFileSync(from);
  let json;
  try { json = gunzipSync(compressed, { maxOutputLength: LIMITS.json }); }
  catch { fail('Invalid gzip archive or decompressed size limit exceeded.'); }
  const archive = parseJson(json, 'archive');
  if (!object(archive) || archive.format !== FORMAT || archive.version !== 1 || !Array.isArray(archive.files) || !Array.isArray(archive.missingSkills) || Object.keys(archive).some(key => !['format', 'version', 'files', 'missingSkills'].includes(key))) fail('Invalid asset archive schema.');
  if (archive.files.length > LIMITS.files) fail('Archive file-count limit exceeded.');
  const declaredMissing = archive.missingSkills.map(skillId);
  if (new Set(declaredMissing).size !== declaredMissing.length) fail('Archive contains duplicate missing skill IDs.');
  const requiredSkills = new Set(), includedSkills = new Set(), skillEntries = new Set();
  const addPath = pathIndex(), addDestination = pathIndex(), entries = [], conflicts = [];
  let total = 0;
  for (const file of archive.files) {
    if (!object(file) || Object.keys(file).sort().join(',') !== 'bytes,content,path,scope,sha256' || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > LIMITS.file || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.content !== 'string' || file.content.length > Math.ceil(LIMITS.file / 3) * 4) fail('Invalid asset entry schema or size.');
    allowed(file.scope, file.path);
    addPath(file.scope, file.path);
    const data = Buffer.from(file.content, 'base64');
    if (data.toString('base64') !== file.content || data.length !== file.bytes || hash(data) !== file.sha256) fail(`Asset hash or encoding mismatch: ${file.scope}/${file.path}`);
    total += data.length;
    if (total > LIMITS.total) fail('Archive total size limit exceeded.');
    if (file.path === 'jarvis/models.json') models(parseJson(data, 'models'));
    if (file.path === 'jarvis/skills.json') for (const id of registry(data)) requiredSkills.add(id);
    if (category(file.path) === 'employees') for (const id of employeeSkills(data, file.path)) requiredSkills.add(id);
    if (file.path.startsWith('skills/')) {
      const id = file.path.split('/')[1];
      includedSkills.add(id);
      if (file.path === `skills/${id}/SKILL.md`) skillEntries.add(id);
    }
    if (file.scope === 'project' && !project) fail('Archive includes project assets; supply project to map their destination.');
    const destination = join(file.scope === 'home' ? home : project, ...file.path.split('/'));
    addDestination('destination', destination.replaceAll('\\', '/'));
    checkAncestors(destination);
    entries.push({ file, data, destination, skip: false });
  }
  for (const id of includedSkills) {
    if (!skillEntries.has(id)) fail(`Archive skill is missing SKILL.md: ${id}`);
    if (declaredMissing.includes(id)) fail(`Archive skill is both included and declared missing: ${id}`);
  }
  const missingSkills = [...new Set([...declaredMissing, ...[...requiredSkills].filter(id => !includedSkills.has(id))])].sort();
  // Windows case-insensitive collisions also matter when previewing on another OS.
  for (const entry of entries) {
    let reason;
    const chain = [];
    const root = entry.file.scope === 'home' ? home : project;
    for (let current = entry.destination; ; current = dirname(current)) {
      chain.push(current);
      if (current === root) break;
    }
    for (const current of chain.reverse()) {
      if (current !== root && existsSync(dirname(current)) && lstatSync(dirname(current)).isDirectory()) {
        const match = readdirSync(dirname(current)).find(name => name.toLowerCase() === basename(current).toLowerCase() && name !== basename(current));
        if (match) { reason = 'case-conflicting existing path'; break; }
      }
      if (!existsSync(current)) continue;
      const info = lstatSync(current);
      if (current !== entry.destination && !info.isDirectory()) { reason = 'parent is not a directory'; break; }
      if (current === entry.destination) {
        if (info.isFile() && info.size === entry.data.length && hash(readFileSync(current)) === entry.file.sha256) entry.skip = true;
        else reason = 'existing content differs or destination is not a file';
      }
    }
    if (reason) conflicts.push({ scope: entry.file.scope, path: entry.file.path, reason });
  }
  const summary = { status: conflicts.length ? 'conflicts' : apply ? 'imported' : 'preview', fileCount: entries.length, counts: counts(archive.files), missingSkills, conflicts, plannedCount: entries.filter(entry => !entry.skip).length, writtenCount: 0, skippedCount: entries.filter(entry => entry.skip).length, sha256: hash(compressed), bytes: total, portability: { ...PORTABILITY } };
  if (conflicts.length || !apply) return summary;
  const createdFiles = [], createdDirectories = [];
  function ensureDirectory(path) {
    if (existsSync(path)) { checkAncestors(path); if (!lstatSync(path).isDirectory()) fail(`Destination directory changed: ${path}`); return; }
    ensureDirectory(dirname(path));
    mkdirSync(path); createdDirectories.push(path);
  }
  try {
    for (const entry of entries) {
      if (entry.skip) continue;
      ensureDirectory(dirname(entry.destination));
      checkAncestors(entry.destination);
      const fd = openSync(entry.destination, 'wx');
      createdFiles.push(entry.destination);
      try { writeFileSync(fd, entry.data); } finally { closeSync(fd); }
      summary.writtenCount++;
    }
  } catch (error) {
    const cleanupErrors = [];
    for (const path of createdFiles.reverse()) { try { unlinkSync(path); } catch { cleanupErrors.push(path); } }
    for (const path of createdDirectories.reverse()) { try { rmdirSync(path); } catch { cleanupErrors.push(path); } }
    if (cleanupErrors.length) fail(`Asset import failed; cleanup could not remove ${cleanupErrors.length} newly created paths. Original error: ${error.code ?? 'write failure'}`);
    throw error;
  }
  return summary;
}
