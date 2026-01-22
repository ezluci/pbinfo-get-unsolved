const test = require('node:test');
const assert = require('node:assert/strict');

const { parseScoreText, selectScoreFromCandidates } = require('../pbinfo-get-unsolved-enhanced.js');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randChoice(rng, items) {
  return items[randInt(rng, 0, items.length - 1)];
}

function randomNoise(rng, maxLen = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ -_:/[](){}!?,.;';
  const len = randInt(rng, 0, maxLen);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[randInt(rng, 0, chars.length - 1)];
  return out;
}

function randomScoreString(rng) {
  const kind = randChoice(rng, ['ratio', 'pct', 'points', 'bare', 'junk']);
  const a = randInt(rng, 0, 120);
  const b = randInt(rng, 1, 120);
  const prefix = randomNoise(rng);
  const suffix = randomNoise(rng);
  if (kind === 'ratio') return `${prefix}${a}/${b}${suffix}`;
  if (kind === 'pct') return `${prefix}${a}%${suffix}`;
  if (kind === 'points') return `${prefix}${a}p${suffix}`;
  if (kind === 'bare') return `${prefix}${a}${suffix}`;
  return `${prefix}${randomNoise(rng, 32)}${suffix}`;
}

test('fuzz: parseScoreText never throws and returns sane ranges', () => {
  const rng = mulberry32(0xdecafbad);
  for (let i = 0; i < 2000; i++) {
    const s = randomScoreString(rng);
    const parsed = parseScoreText(s);
    if (parsed == null) continue;
    assert.ok(Number.isFinite(parsed.value));
    assert.ok(parsed.value >= 0 && parsed.value <= 999);
    if (parsed.max != null) {
      assert.ok(Number.isFinite(parsed.max));
      assert.ok(parsed.max >= 0 && parsed.max <= 999);
    }
  }
});

test('fuzz: selectScoreFromCandidates never throws', () => {
  const rng = mulberry32(0x12345678);
  for (let i = 0; i < 1000; i++) {
    const count = randInt(rng, 0, 6);
    const candidates = [];
    for (let j = 0; j < count; j++) {
      const text = randomScoreString(rng);
      const parsed = parseScoreText(text);
      candidates.push({
        tooltip: randChoice(rng, ['', 'Punctaj obținut', 'Punctaj maxim', 'Punctajul tău maxim']),
        text,
        value: parsed?.value,
        max: parsed?.max,
        hasRatio: Boolean(parsed?.hasRatio),
        isLink: rng() > 0.5,
      });
    }
    const res = selectScoreFromCandidates(candidates);
    assert.ok(Object.prototype.hasOwnProperty.call(res, 'userScore'));
    assert.ok(Object.prototype.hasOwnProperty.call(res, 'maxScore'));
    if (res.userScore != null) assert.ok(Number.isFinite(res.userScore));
    if (res.maxScore != null) assert.ok(Number.isFinite(res.maxScore));
  }
});
