const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseHTML } = require('linkedom');

const {
  extractScoreInfoFromCard,
  classifyProblemStatus,
  parseTotalProblems,
} = require('../pbinfo-get-unsolved-enhanced.js');

function loadFixture(name) {
  const p = path.join(__dirname, 'fixtures', name);
  return fs.readFileSync(p, 'utf8');
}

function parseCard(html) {
  const { document } = parseHTML(html);
  const card = document.querySelector('div.card.mb-3');
  assert.ok(card, 'fixture should contain a card');
  return card;
}

test('fixture: title tooltip score -> tried', () => {
  const card = parseCard(loadFixture('card-score-title.html'));
  const info = extractScoreInfoFromCard(card);
  assert.deepEqual(
    { userScore: info.userScore, maxScore: info.maxScore },
    { userScore: 0, maxScore: 100 }
  );
  assert.equal(classifyProblemStatus(info), 'tried');
});

test('fixture: data-bs-title tooltip score -> tried', () => {
  const card = parseCard(loadFixture('card-score-data-bs-title.html'));
  const info = extractScoreInfoFromCard(card);
  assert.deepEqual(
    { userScore: info.userScore, maxScore: info.maxScore },
    { userScore: 65, maxScore: 100 }
  );
  assert.equal(classifyProblemStatus(info), 'tried');
});

test('fixture: ratio score -> tried', () => {
  const card = parseCard(loadFixture('card-score-ratio.html'));
  const info = extractScoreInfoFromCard(card);
  assert.deepEqual(
    { userScore: info.userScore, maxScore: info.maxScore },
    { userScore: 30, maxScore: 100 }
  );
  assert.equal(classifyProblemStatus(info), 'tried');
});

test('fixture: ambiguous 100p -> unattempted', () => {
  const card = parseCard(loadFixture('card-score-ambiguous-100.html'));
  const info = extractScoreInfoFromCard(card);
  assert.deepEqual(
    { userScore: info.userScore, maxScore: info.maxScore },
    { userScore: null, maxScore: 100 }
  );
  assert.equal(classifyProblemStatus(info), 'unattempted');
});

test('fixture: footer score "Punctajul tau maxim" -> solved', () => {
  const card = parseCard(loadFixture('card-score-footer-user-max.html'));
  const info = extractScoreInfoFromCard(card);
  assert.deepEqual(
    { userScore: info.userScore, maxScore: info.maxScore },
    { userScore: 100, maxScore: null }
  );
  assert.equal(classifyProblemStatus(info), 'solved');
});

test('fixture: parseTotalProblems', () => {
  const html = loadFixture('list-header-total.html');
  assert.equal(parseTotalProblems(html), 187);
});
