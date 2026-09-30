import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease, compareVersions, releaseNotes } from '../scripts/release-check.mjs';

const sha = 'a'.repeat(40);
const fixture = () => ({ pkg: { name: 'open-jarvis', version: '0.1.0' },
  lock: { name: 'open-jarvis', version: '0.1.0', packages: { '': { name: 'open-jarvis', version: '0.1.0' } } },
  changelog: '## 0.1.0\n\n- Initial release.\n', baseVersion: '0.1.0', sha,
  event: { repository: { full_name: 'lbtlm/open-jarvis' }, pull_request: {
    base: { ref: 'main' }, head: { ref: 'dev', repo: { full_name: 'lbtlm/open-jarvis' } },
  } } });

test('first release accepts the current version without an existing stable tag', () => {
  assert.equal(validateRelease(fixture()), '- Initial release.');
});
test('main PR requires same-repository dev', () => {
  for (const change of [f => { f.event.pull_request.head.ref = 'fix/hotfix'; },
    f => { f.event.pull_request.head.repo.full_name = 'fork/open-jarvis'; }]) {
    const f = fixture(); change(f); assert.throws(() => validateRelease(f));
  }
});
test('published version cannot be reused in a PR; release rerun accepts exact tag SHA', () => {
  const f = fixture(); f.tags = [{ version: '0.1.0', sha }];
  assert.throws(() => validateRelease(f));
  delete f.event.pull_request;
  assert.doesNotThrow(() => validateRelease(f));
  f.tags[0].sha = 'b'.repeat(40);
  assert.throws(() => validateRelease(f));
});
test('subsequent release increases both base and published versions', () => {
  const f = fixture(); f.tags = [{ version: '0.0.9', sha: 'b'.repeat(40) }]; f.baseVersion = '0.0.9';
  assert.doesNotThrow(() => validateRelease(f));
  f.baseVersion = '0.1.0'; assert.throws(() => validateRelease(f));
  f.baseVersion = '0.0.9'; f.tags[0].version = '0.2.0'; assert.throws(() => validateRelease(f));
});
test('stable syntax, lock agreement, full SHA and changelog are mandatory', () => {
  for (const change of [f => { f.pkg.version = '0.1.0-next.1'; }, f => { f.lock.version = '0.2.0'; },
    f => { f.lock.packages[''].version = '0.2.0'; }, f => { f.sha = 'main; echo injected'; },
    f => { f.changelog = '## Unreleased\n- Something.\n'; }, f => { f.changelog = '## 0.1.0\n\n'; }]) {
    const f = fixture(); change(f); assert.throws(() => validateRelease(f));
  }
  assert.throws(() => releaseNotes('## 0.1.0\n- A\n## 0.1.0\n- B\n', '0.1.0'));
  assert.equal(compareVersions('1.10.0', '1.9.99'), 1);
  assert.equal(compareVersions('999999999999999999999.0.0', '2.0.0'), 1);
});
