const test = require('node:test');
const assert = require('node:assert/strict');

const { parseScoreText, selectScoreFromCandidates } = require('../pbinfo-get-unsolved-enhanced.js');

test('parseScoreText: ratio', () => {
  assert.deepEqual(parseScoreText(' 65/100 '), { value: 65, max: 100, hasRatio: true });
});

test('parseScoreText: percent', () => {
  assert.deepEqual(parseScoreText('75%'), { value: 75, max: 100, hasRatio: false });
});

test('parseScoreText: points', () => {
  assert.deepEqual(parseScoreText('100p'), { value: 100, max: null, hasRatio: false });
});

test('selectScoreFromCandidates: max only => unknown user score', () => {
  const res = selectScoreFromCandidates([
    {
      tooltip: 'Punctaj maxim',
      text: '100p',
      value: 100,
      max: null,
      hasRatio: false,
      isLink: false,
    },
  ]);
  assert.deepEqual(res, { userScore: null, maxScore: 100 });
});

test('selectScoreFromCandidates: single ambiguous 100p => treat as max', () => {
  const res = selectScoreFromCandidates([
    { tooltip: 'Punctaj', text: '100p', value: 100, max: null, hasRatio: false, isLink: false },
  ]);
  assert.deepEqual(res, { userScore: null, maxScore: 100 });
});

test('selectScoreFromCandidates: prefer obtained over max', () => {
  const res = selectScoreFromCandidates([
    {
      tooltip: 'Punctaj maxim',
      text: '100p',
      value: 100,
      max: null,
      hasRatio: false,
      isLink: false,
    },
    { tooltip: 'Punctaj obținut', text: '0p', value: 0, max: null, hasRatio: false, isLink: false },
  ]);
  assert.deepEqual(res, { userScore: 0, maxScore: 100 });
});

test('selectScoreFromCandidates: ratio provides max', () => {
  const res = selectScoreFromCandidates([
    {
      tooltip: 'Punctaj obținut',
      text: '30/100',
      value: 30,
      max: 100,
      hasRatio: true,
      isLink: false,
    },
  ]);
  assert.deepEqual(res, { userScore: 30, maxScore: 100 });
});

test('selectScoreFromCandidates: ratio beats plain value', () => {
  const res = selectScoreFromCandidates([
    { tooltip: 'Punctaj', text: '100p', value: 100, max: null, hasRatio: false, isLink: false },
    { tooltip: 'Punctaj', text: '30/100', value: 30, max: 100, hasRatio: true, isLink: false },
  ]);
  assert.deepEqual(res, { userScore: 30, maxScore: 100 });
});
