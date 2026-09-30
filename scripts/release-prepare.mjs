import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { releaseNotes, stableVersion } from './release-check.mjs';

const directory = process.argv[2];
assert.ok(directory, 'Supply the release bundle directory.');
const [pack] = JSON.parse(readFileSync(join(directory, 'pack.json'), 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
stableVersion(pkg.version);
const sha = process.env.GITHUB_SHA;
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(pack.filename, `open-jarvis-${pkg.version}.tgz`);
assert.equal(pack.name, pkg.name);
assert.equal(pack.version, pkg.version);
const tarball = join(directory, pack.filename);
const embedded = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }));
assert.equal(embedded.name, pkg.name);
assert.equal(embedded.version, pkg.version);
const actualFiles = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split(/\r?\n/).map(file => file.replace(/^package\//, '')).sort();
const files = pack.files.map(file => file.path).sort();
assert.deepEqual(actualFiles, files, 'Pack metadata must describe the actual tarball.');
for (const file of files) {
  assert.match(file, /^(bin\/|src\/|payload\/|docs\/|README(?:\.(?:en|zh-CN|ja))?\.md$|LICENSE$|CHANGELOG\.md$|CONTRIBUTING\.md$|SECURITY\.md$|package\.json$)/);
  assert.doesNotMatch(file, /(?:^|\/)(?:\.\.|auth\.json|\.env|node_modules|jarvis-state|\.local|sessions)(?:\/|$)/);
}
const sha256 = createHash('sha256').update(readFileSync(tarball)).digest('hex');
const manifest = { repository: 'lbtlm/open-jarvis', sha, name: pkg.name, version: pkg.version, filename: pack.filename, sha256, files };
writeFileSync(join(directory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(directory, 'SHA256SUMS'), `${sha256}  ${pack.filename}\n`);
const url = `https://github.com/lbtlm/open-jarvis/releases/download/v${pkg.version}/${pack.filename}`;
writeFileSync(join(directory, 'release-notes.md'), `${releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), pkg.version)}\n\nCommit: \`${sha}\`\n\nInstall this version (Node.js 22+):\n\n\`\`\`sh\nnpx --yes --package=${url} open-jarvis install\n\`\`\`\n\nVerify SHA256SUMS before using a manually downloaded tarball. Dependencies may be downloaded from npm. The workflow summary records remote installation verification; a failed verification leaves this release available and requires a rerun.\n`);
console.log(JSON.stringify(manifest, null, 2));
