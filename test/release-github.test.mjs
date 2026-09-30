import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRelease, githubClient, digest } from '../scripts/release-github.mjs';

const bytes = Buffer.from('tested tarball');
const manifest = { repository: 'lbtlm/open-jarvis', name: 'open-jarvis', version: '0.1.0',
  filename: 'open-jarvis-0.1.0.tgz', sha: 'a'.repeat(40), sha256: digest(bytes) };
const assets = { [manifest.filename]: bytes, SHA256SUMS: Buffer.from('checksums'), 'release-manifest.json': Buffer.from('manifest') };
function server({ existing = false, draft = false, wrongTag = false, wrongAsset = false, uploadFails = false, missingAsset = false, annotated = false, tagPages = [[]] } = {}) {
  const calls = [];
  let ref = existing ? { object: { type: annotated ? 'tag' : 'commit', sha: wrongTag ? 'b'.repeat(40) : manifest.sha } } : null;
  let release = existing ? { id: 7, tag_name: 'v0.1.0', draft, prerelease: false,
    assets: Object.keys(assets).filter((_, i) => !missingAsset || i > 0).map((name, i) => ({ id: i + 1, name })) } : null;
  const stored = new Map(release?.assets.map(asset => [asset.id, wrongAsset ? Buffer.from('wrong') : assets[asset.name]]) ?? []);
  const api = async (method, path, body, binary) => {
    calls.push({ method, path, body });
    if (path.includes('/git/tags/')) return { object: { type: 'commit', sha: manifest.sha } };
    if (method === 'GET' && path.includes('/git/ref/')) return ref;
    if (method === 'GET' && path.includes('/releases/tags/')) return release?.draft ? null : release;
    if (method === 'GET' && path.includes('/releases?')) return release ? [release] : [];
    if (method === 'GET' && path.includes('/tags?')) {
      const index = Number(new URL(path, 'https://api.github.com').searchParams.get('page')) - 1;
      return index < tagPages.length ? tagPages[index] : [];
    }
    if (binary) return stored.get(Number(path.split('/').at(-1)));
    if (path.startsWith('https://uploads.github.com/')) {
      if (uploadFails) throw new Error('upload failed');
      const id = stored.size + 1; stored.set(id, body); return { id };
    }
    if (method === 'POST' && path.endsWith('/git/refs')) return ref = { object: { type: 'commit', sha: body.sha } };
    if (method === 'POST' && path.endsWith('/releases')) return release = { id: 7, ...body, assets: [] };
    if (method === 'PATCH') return release = { ...release, ...body };
    throw new Error(`Unexpected API call ${method} ${path}`);
  };
  return { api, calls };
}
const publish = fake => publishRelease({ manifest, assets, notes: '- Initial release.', api: fake.api });

test('creates exact-SHA tag, verified draft assets and then publishes', async () => {
  const fake = server(); await publish(fake);
  assert.equal(fake.calls.find(call => call.path.endsWith('/git/refs')).body.sha, manifest.sha);
  assert.equal(fake.calls.filter(call => call.path.startsWith('https://uploads.github.com/')).length, 3);
  assert.equal(fake.calls.at(-1).method, 'PATCH');
  assert.equal(fake.calls.at(-1).body.draft, false);
});
test('consistent public release is resumed without writes; annotated tags resolve', async () => {
  for (const annotated of [false, true]) {
    const fake = server({ existing: true, annotated }); await publish(fake);
    assert.ok(fake.calls.every(call => call.method === 'GET'));
  }
});
test('wrong tag, mismatched existing asset and missing public asset fail before mutations', async () => {
  for (const option of ['wrongTag', 'wrongAsset', 'missingAsset']) {
    const fake = server({ existing: true, [option]: true });
    await assert.rejects(publish(fake));
    assert.ok(fake.calls.every(call => call.method === 'GET'));
  }
});
test('draft with missing asset recovers; upload failure never publishes draft', async () => {
  const recovery = server({ existing: true, draft: true, missingAsset: true });
  await publish(recovery);
  assert.equal(recovery.calls.filter(call => call.path.startsWith('https://uploads.github.com/')).length, 1);
  const failure = server({ uploadFails: true });
  await assert.rejects(publish(failure), /upload failed/);
  assert.ok(failure.calls.every(call => call.method !== 'PATCH'));
});
test('local checksum mismatch fails without any API calls', async () => {
  const fake = server();
  await assert.rejects(publishRelease({ manifest: { ...manifest, sha256: 'bad' }, assets, notes: '', api: fake.api }));
  assert.equal(fake.calls.length, 0);
});
test('failed-job rerun of an old draft rejects a higher stable tag on a later page before writes', async () => {
  const firstPage = Array.from({ length: 100 }, (_, patch) => ({ name: `v0.0.${patch}` }));
  const fake = server({ existing: true, draft: true, missingAsset: true,
    tagPages: [firstPage, [{ name: 'v0.2.0' }]] });
  await assert.rejects(publish(fake), /higher stable version/i);
  assert.equal(fake.calls.filter(call => call.path.includes('/tags?')).length, 2);
  assert.ok(fake.calls.every(call => call.method === 'GET'));
});
test('new old-version release is blocked; consistent public release remains read-only', async () => {
  const tagPages = [[{ name: 'v0.2.0' }]];
  const fresh = server({ tagPages });
  await assert.rejects(publish(fresh), /higher stable version/i);
  assert.ok(fresh.calls.every(call => call.method === 'GET'));
  const published = server({ existing: true, tagPages });
  await publish(published);
  assert.ok(published.calls.every(call => call.method === 'GET'));
});
test('equal stable and higher prerelease tags allow draft recovery; failed tag listing blocks writes', async () => {
  const allowed = server({ existing: true, draft: true,
    tagPages: [[{ name: 'v0.1.0' }, { name: 'v0.0.99' }, { name: 'v1.0.0-next.1' }, { name: 'release-note' }]] });
  await publish(allowed);
  assert.equal(allowed.calls.at(-1).method, 'PATCH');
  const unavailable = server({ existing: true, draft: true, tagPages: [null] });
  await assert.rejects(publish(unavailable), /inspect stable tags/i);
  assert.ok(unavailable.calls.every(call => call.method === 'GET'));
});
test('only GET 404 means missing; all other HTTP and network failures stop', async () => {
  const client = status => githubClient('synthetic-test-token', async () => ({ status, ok: false }));
  assert.equal(await client(404)('GET', '/repos/lbtlm/open-jarvis/releases/tags/v0.1.0'), null);
  for (const status of [401, 403, 429, 500]) await assert.rejects(client(status)('GET', '/repos/lbtlm/open-jarvis/releases'));
  await assert.rejects(client(404)('POST', '/repos/lbtlm/open-jarvis/releases', {}));
  const offline = githubClient('synthetic-test-token', async () => { throw new Error('offline'); });
  await assert.rejects(offline('GET', '/repos/lbtlm/open-jarvis/releases'), /offline/);
});
