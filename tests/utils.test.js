const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeListUrl,
  buildPageUrl,
  problemsToCsv,
  problemsToLinksText,
} = require('../pbinfo-get-unsolved-enhanced.js');

test('normalizeListUrl: strips pagination param', () => {
  const url = normalizeListUrl(
    'https://www.pbinfo.ro/?pagina=probleme-lista&start=20&clasa=1',
    'https://www.pbinfo.ro/?pagina=probleme-lista',
    'start'
  );
  assert.equal(url, 'https://www.pbinfo.ro/?pagina=probleme-lista&clasa=1');
});

test('buildPageUrl: offset mode (start)', () => {
  const url = buildPageUrl('https://www.pbinfo.ro/?pagina=probleme-lista&clasa=1', {
    pageIndex: 3,
    pageSize: 10,
    mode: 'offset',
    param: 'start',
  });
  assert.equal(url, 'https://www.pbinfo.ro/?pagina=probleme-lista&clasa=1&start=20');
});

test('buildPageUrl: page mode', () => {
  const url = buildPageUrl('https://www.pbinfo.ro/?pagina=probleme-lista&clasa=1', {
    pageIndex: 3,
    pageSize: 10,
    mode: 'page',
    param: 'page',
    pageBase: 1,
  });
  assert.equal(url, 'https://www.pbinfo.ro/?pagina=probleme-lista&clasa=1&page=3');
});

test('problemsToCsv: escapes values and includes BOM', () => {
  const csv = problemsToCsv([
    {
      id: 1,
      name: 'A "quote"',
      status: 'tried',
      userScore: 10,
      maxScore: 100,
      difficulty: 1,
      postedBy_name: 'Nume',
      author: 'Autor',
      source: 'Sursă, cu virgulă',
      link: 'https://www.pbinfo.ro/probleme/1/a',
    },
  ]);
  assert.ok(csv.startsWith('\ufeffid,name,status,userScore,maxScore,difficulty,postedBy,author,source,link\n'));
  assert.ok(csv.includes('"A ""quote"""'));
  assert.ok(csv.includes('"Sursă, cu virgulă"'));
});

test('problemsToLinksText: joins links by newline', () => {
  const text = problemsToLinksText([
    { link: 'https://www.pbinfo.ro/probleme/1/a' },
    { link: 'https://www.pbinfo.ro/probleme/2/b' },
  ]);
  assert.equal(text, 'https://www.pbinfo.ro/probleme/1/a\nhttps://www.pbinfo.ro/probleme/2/b');
});
