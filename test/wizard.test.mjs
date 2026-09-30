import test from 'node:test';
import assert from 'node:assert/strict';
import { collectChoices } from '../src/wizard.mjs';

test('GPT-6 choices separate model and effort, reject Luna Ultra, and retain legacy options', async () => {
  const answers = [
    '1', 'medium', '',
    '1', 'medium', '',
    '2', 'low', '',
    '2', 'medium', '',
    '2', 'high', '',
    'gpt-5.6-sol', 'high', '',
    '', 'yes',
  ];
  const result = await collectChoices({ initial: {},
    ask: async () => { assert.ok(answers.length); return answers.shift(); }, write: () => {} });
  assert.equal(result.confirmed, true);
  assert.deepEqual(result.models.luna, {model:'gpt-6-luna', effort:'medium', fast:false});
  assert.deepEqual(result.models.terra, {model:'gpt-6.1-sol', effort:'medium', fast:false});
  assert.deepEqual(result.models.sol, {model:'gpt-6.1-sol', effort:'high', fast:false});
  assert.equal(result.models.reviewer.model, 'gpt-5.6-sol');
  assert.equal(answers.length, 0);
});

test('recommendations are editable, existing preferences persist, and invalid answers are retried', async () => {
  const answers = [
    '', '', '',
    '99', 'custom-small', 'wrong', 'low', 'maybe', 'n',
    '', '', '',
    '', '', '',
    '', '', '',
    '', '', '',
    '', 'yes',
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
  assert.match(output, /99|Choose 1–3/);
  assert.equal(answers.length, 0);
});

test('empty final confirmation declines installation', async () => {
  const answers = Array(20).fill('');
  const result = await collectChoices({ initial: {}, ask: async () => answers.shift(), write: () => {} });
  assert.equal(result.confirmed, false);
  assert.equal(result.starter, 'none');
});

test('starter prefill can be changed and invalid answers are retried before confirmation', async () => {
  const answers = [...Array(18).fill(''), 'unknown', 'office', 'yes'];
  const result = await collectChoices({ initial: {}, initialStarter: 'writing',
    ask: async () => { assert.ok(answers.length); return answers.shift(); }, write: () => {} });
  assert.equal(result.starter, 'office');
  assert.equal(result.confirmed, true);
  assert.equal(answers.length, 0);
});
