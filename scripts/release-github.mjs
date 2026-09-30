import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stableVersion, compareVersions } from './release-check.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Only a 404 from a read means missing. Authentication, network and write failures stop the release.
export function githubClient(token, fetchImpl = fetch) {
  assert.ok(token, 'The release job requires its GitHub token.');
  return async (method, path, body, binary = false) => {
    const url = path.startsWith('https://uploads.github.com/') ? path : `https://api.github.com${path}`;
    assert.ok(url.startsWith('https://api.github.com/') || url.startsWith('https://uploads.github.com/'));
    const response = await fetchImpl(url, { method, signal: AbortSignal.timeout(60000), headers: {
      Authorization: `Bearer ${token}`, Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json' } : {}),
    }, ...(body ? { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) } : {}) });
    if (response.status === 404 && method === 'GET') return null;
    assert.ok(response.ok, `GitHub ${method} ${new URL(url).pathname} failed: HTTP ${response.status}`);
    return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
  };
}

export async function publishRelease({ manifest, assets, notes, api }) {
  stableVersion(manifest.version);
  assert.equal(manifest.repository, 'lbtlm/open-jarvis');
  assert.equal(manifest.name, 'open-jarvis');
  assert.match(manifest.sha, /^[a-f0-9]{40}$/);
  assert.equal(manifest.filename, `open-jarvis-${manifest.version}.tgz`);
  assert.equal(digest(assets[manifest.filename]), manifest.sha256, 'Local tarball checksum mismatch.');
  const root = '/repos/lbtlm/open-jarvis';
  const tag = `v${manifest.version}`;
  const reference = `${root}/git/ref/tags/${tag}`;
  let ref = await api('GET', reference);
  if (ref) {
    let object = ref.object;
    for (let hops = 0; object.type === 'tag' && hops < 5; hops++) {
      const annotated = await api('GET', `${root}/git/tags/${object.sha}`);
      assert.ok(annotated, 'Existing annotated tag cannot be resolved.');
      object = annotated.object;
    }
    assert.equal(object.type, 'commit');
    assert.equal(object.sha, manifest.sha, 'Existing release tag points to a different commit; it will not be moved.');
  }
  let release = await api('GET', `${root}/releases/tags/${tag}`);
  if (!release) {
    // Drafts may not be returned by the tag endpoint. The authenticated list includes drafts.
    for (let page = 1; ; page++) {
      const releases = await api('GET', `${root}/releases?per_page=100&page=${page}`);
      assert.ok(Array.isArray(releases), 'Cannot inspect release history.');
      release = releases.find(item => item.tag_name === tag);
      if (release || releases.length < 100) break;
    }
  }
  if (release) {
    assert.ok(ref, 'An existing release must have its exact tag.');
    assert.equal(release.prerelease, false, 'Cannot resume a prerelease as a stable release.');
  }
  // Check every existing asset before any mutations. No clobber, deletion or ref update exists here.
  const missing = [];
  for (const [name, bytes] of Object.entries(assets)) {
    const found = release?.assets.filter(asset => asset.name === name) ?? [];
    assert.ok(found.length <= 1, `Duplicate release asset: ${name}`);
    if (found.length) {
      const existing = await api('GET', `${root}/releases/assets/${found[0].id}`, undefined, true);
      assert.ok(existing, `Release asset is unavailable: ${name}`);
      assert.equal(digest(existing), digest(bytes), `Existing asset checksum mismatch: ${name}`);
    } else {
      assert.ok(!release || release.draft, `Published release is missing ${name}; refusing to change its assets.`);
      missing.push([name, bytes]);
    }
  }
  // Failed-job reruns can reuse an earlier successful CI result. Recheck live tags here,
  // immediately before any write, so an older draft cannot replace a newer latest release.
  if (!release || release.draft) {
    for (let page = 1; ; page++) {
      const tags = await api('GET', `${root}/tags?per_page=100&page=${page}`);
      assert.ok(Array.isArray(tags), 'Cannot inspect stable tags before publication.');
      for (const existing of tags) {
        if (/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(existing.name)) {
          assert.ok(compareVersions(existing.name.slice(1), manifest.version) <= 0,
            `A higher stable version already exists (${existing.name}); refusing to publish this older version.`);
        }
      }
      if (tags.length < 100) break;
    }
  }
  if (!ref) ref = await api('POST', `${root}/git/refs`, { ref: `refs/tags/${tag}`, sha: manifest.sha });
  if (!release) release = await api('POST', `${root}/releases`, {
    tag_name: tag, target_commitish: manifest.sha, name: tag, body: notes, draft: true, prerelease: false,
  });
  assert.ok(Number.isSafeInteger(release.id), 'A valid release ID is required.');
  for (const [name, bytes] of missing) {
    const upload = `https://uploads.github.com/repos/lbtlm/open-jarvis/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
    const asset = await api('POST', upload, bytes);
    assert.ok(Number.isSafeInteger(asset.id));
    const uploaded = await api('GET', `${root}/releases/assets/${asset.id}`, undefined, true);
    assert.ok(uploaded, 'Uploaded asset cannot be downloaded.');
    assert.equal(digest(uploaded), digest(bytes), `Uploaded asset checksum mismatch: ${name}`);
  }
  if (release.draft) release = await api('PATCH', `${root}/releases/${release.id}`, { draft: false, make_latest: 'true' });
  assert.equal(release.draft, false);
  return { url: `https://github.com/lbtlm/open-jarvis/releases/tag/${tag}`, version: manifest.version, sha: manifest.sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.env.GITHUB_REPOSITORY, 'lbtlm/open-jarvis');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  const directory = process.argv[2];
  assert.ok(directory);
  const manifest = JSON.parse(readFileSync(join(directory, 'release-manifest.json'), 'utf8'));
  assert.equal(manifest.sha, process.env.GITHUB_SHA, 'Artifact must belong to this exact release run SHA.');
  const names = [manifest.filename, 'release-manifest.json', 'SHA256SUMS'];
  const assets = Object.fromEntries(names.map(name => [name, readFileSync(join(directory, name))]));
  assert.equal(assets.SHA256SUMS.toString(), `${manifest.sha256}  ${manifest.filename}\n`);
  const result = await publishRelease({ manifest, assets, notes: readFileSync(join(directory, 'release-notes.md'), 'utf8'), api: githubClient(process.env.GITHUB_TOKEN) });
  console.log(JSON.stringify({ status: 'published-or-consistent', ...result }));
}
