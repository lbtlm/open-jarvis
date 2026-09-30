import test from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync, mkdtempSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { starters, starterEmployees } from '../src/starters.mjs';
import { seedEmployees } from '../src/team.mjs';

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'jarvis-starters-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return join(root, 'home');
}

test('starter names map to the approved cards only', () => {
  assert.deepEqual(starters, {
    none: [], development: ['iris-frontend', 'atlas-backend', 'quinn-qa', 'sentry-review'],
    writing: ['nova-writer'], office: ['clara-office'], video: ['frame-video'],
  });
  assert.throws(() => starterEmployees('unknown'), /Choose starter/);
  assert.throws(() => starterEmployees('toString'), /Choose starter/);
});

for (const [starter, ids] of Object.entries(starters)) {
  test(`${starter} creates exactly the selected cards and preserves existing cards`, t => {
    const home = fixture(t);
    const preview = seedEmployees({ home, starter });
    assert.equal(existsSync(home), false);
    assert.equal(preview.candidates.length, ids.length);
    const result = seedEmployees({ home, starter, apply: true });
    assert.equal(result.created.length, ids.length);
    if (!ids.length) {
      assert.equal(existsSync(home), false);
      return;
    }
    const root = join(home, 'jarvis', 'employees');
    assert.deepEqual(readdirSync(root).sort(), ids.map(id => `${id}.md`).sort());
    const existing = join(root, `${ids[0]}.md`);
    writeFileSync(existing, 'User card');
    const repeat = seedEmployees({ home, starter, apply: true });
    assert.deepEqual(repeat.created, []);
    assert.equal(readFileSync(existing, 'utf8'), 'User card');
  });
}

test('unknown starter and invalid destination fail during read-only preflight', t => {
  const home = fixture(t);
  assert.throws(() => seedEmployees({ home, starter: 'unknown', apply: true }), /Choose starter/);
  assert.equal(existsSync(home), false);
  mkdirSync(join(home, 'jarvis'), { recursive: true });
  writeFileSync(join(home, 'jarvis', 'employees'), 'blocked');
  assert.throws(() => seedEmployees({ home }), /must be a directory/);
});

test('none retains all existing cards', t => {
  const home = fixture(t);
  const root = join(home, 'jarvis', 'employees');
  mkdirSync(root, { recursive: true });
  const card = join(root, 'personal-card.md');
  writeFileSync(card, 'User card');
  assert.deepEqual(seedEmployees({ home, starter: 'none', apply: true }).created, []);
  assert.deepEqual(readdirSync(root), ['personal-card.md']);
  assert.equal(readFileSync(card, 'utf8'), 'User card');
});
