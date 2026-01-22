const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseHTML } = require('linkedom');

const {
  extractScoreInfoFromCard,
  extractScoreInfoFromProblemPage,
  extractProblemMetaFromProblemPage,
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

function parseDocument(html) {
  const { document } = parseHTML(html);
  return document;
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

test('fixture: problem page score 100 -> solved', () => {
  const doc = parseDocument(loadFixture('problem-page-score-100.html'));
  const scoreInfo = extractScoreInfoFromProblemPage(doc);
  assert.deepEqual(
    { userScore: scoreInfo.userScore, maxScore: scoreInfo.maxScore },
    { userScore: 100, maxScore: null }
  );
  assert.equal(classifyProblemStatus(scoreInfo), 'solved');
  const meta = extractProblemMetaFromProblemPage(doc, 1);
  assert.equal(meta.name, 'sum');
  assert.equal(meta.difficulty, 0);
  assert.equal(meta.author, 'Silviu Candale');
  assert.equal(meta.source, '');
});

test('fixture: problem page score 42 -> tried', () => {
  const doc = parseDocument(loadFixture('problem-page-score-42.html'));
  const scoreInfo = extractScoreInfoFromProblemPage(doc);
  assert.deepEqual(
    { userScore: scoreInfo.userScore, maxScore: scoreInfo.maxScore },
    { userScore: 42, maxScore: null }
  );
  assert.equal(classifyProblemStatus(scoreInfo), 'tried');
});

test('fixture: problem page without score cell -> unattempted', () => {
  const doc = parseDocument(loadFixture('problem-page-no-score.html'));
  const scoreInfo = extractScoreInfoFromProblemPage(doc);
  assert.deepEqual(
    { userScore: scoreInfo.userScore, maxScore: scoreInfo.maxScore },
    { userScore: null, maxScore: null }
  );
  assert.equal(classifyProblemStatus(scoreInfo), 'unattempted');
  const meta = extractProblemMetaFromProblemPage(doc, 8000);
  assert.equal(meta.name, 'Pagina nu există.');
});
