import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function stableVersion(value) {
  assert.match(value, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Only stable x.y.z versions are released.');
  return value.split('.').map(BigInt);
}

export function compareVersions(a, b) {
  const left = stableVersion(a), right = stableVersion(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

export function releaseNotes(changelog, version) {
  stableVersion(version);
  const sections = [...changelog.matchAll(/^## (.+)$/gm)];
  const matches = sections.filter(section => section[1] === version || section[1].startsWith(`${version} (`));
  assert.equal(matches.length, 1, 'CHANGELOG must contain exactly one heading for the package version.');
  const heading = matches[0];
  const end = sections.find(section => section.index > heading.index)?.index ?? changelog.length;
  const notes = changelog.slice(heading.index + heading[0].length, end).trim();
  assert.ok(notes && /^- \S/m.test(notes), 'The release must have meaningful changelog entries.');
  return notes;
}

export function validateRelease({ pkg, lock, changelog, baseVersion, tags = [], sha, event }) {
  stableVersion(pkg.version);
  assert.equal(pkg.name, 'open-jarvis');
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(lock.packages[''].name, pkg.name);
  assert.match(sha, /^[a-f0-9]{40}$/, 'A full immutable commit SHA is required.');
  if (event?.pull_request?.base.ref === 'main') {
    assert.equal(event.pull_request.head.ref, 'dev', 'Only dev may propose a main release.');
    assert.equal(event.pull_request.head.repo?.full_name, event.repository.full_name, 'The dev branch must belong to this repository.');
  }
  const previous = tags.filter(tag => {
    stableVersion(tag.version);
    if (tag.version === pkg.version && tag.sha === sha && !event?.pull_request) return false;
    return true;
  });
  if (previous.length) {
    assert.ok(compareVersions(pkg.version, baseVersion) > 0, 'A release must increase the base version.');
    for (const tag of previous) assert.ok(compareVersions(pkg.version, tag.version) > 0, 'The version has already been released or is older than a release.');
  } else {
    assert.ok(compareVersions(pkg.version, baseVersion) >= 0, 'The initial release may keep, but cannot lower, the base version.');
  }
  return releaseNotes(changelog, pkg.version);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const sha = process.env.GITHUB_SHA;
  assert.match(sha, /^[a-f0-9]{40}$/);
  const isReleasePR = event.pull_request?.base.ref === 'main';
  const isReleasePush = process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main';
  if (isReleasePR || isReleasePush) {
    const base = isReleasePR ? event.pull_request.base.sha : execFileSync('git', ['rev-parse', `${sha}^`], { encoding: 'utf8' }).trim();
    assert.match(base, /^[a-f0-9]{40}$/);
    const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
    const tags = git(['tag', '--list', 'v*']).split('\n').filter(tag => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
      .map(tag => ({ version: tag.slice(1), sha: git(['rev-list', '-n', '1', tag]) }));
    validateRelease({ pkg: JSON.parse(readFileSync('package.json')), lock: JSON.parse(readFileSync('package-lock.json')),
      changelog: readFileSync('CHANGELOG.md', 'utf8'), baseVersion: JSON.parse(git(['show', `${base}:package.json`])).version,
      tags, sha, event });
  }
  console.log('Release source/version gate passed.');
}
