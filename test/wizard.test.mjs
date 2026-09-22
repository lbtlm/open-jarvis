import test from 'node:test';
import assert from 'node:assert/strict';
import { collectChoices } from '../src/wizard.mjs';

test('recommendations are editable, existing preferences persist, and invalid answers are retried', async () => {
  const answers = [
    '', '', '',
    '99', 'custom-small', 'wrong', 'low', 'maybe', 'n',
    '', '', '',
    '', '', '',
    '', '', '',
    'yes',
  ];
  let output = '';
  const result = await collectChoices({
    initial: { controller: { model: 'existing-controller', effort: 'max', fast: true } },
    ask: async () => { assert.ok(answers.length); return answers.shift(); },
    write: text => { output += text; },
  });
  assert.equal(result.confirmed, true);
  assert.deepEqual(result.models.controller, { model: 'existing-controller', effort: 'max', fast: true });
  assert.deepEqual(result.models.luna, { model: 'custom-small', effort: 'low', fast: false });
  assert.equal(result.models.terra.fast, false);
  assert.match(output, /99|Choose 1–4/);
  assert.equal(answers.length, 0);
});

test('empty final confirmation declines installation', async () => {
  const answers = Array(16).fill('');
  const result = await collectChoices({ initial: {}, ask: async () => answers.shift(), write: () => {} });
  assert.equal(result.confirmed, false);
});
