// pbinfo-get-unsolved-enhanced.js
// Enhanced version: automatically displays the table of unsolved problems and
// provides a plain list with links for quick access.
// Use this script in the browser console on pbinfo.ro, providing either a
// category URL or the global problems list URL when prompted.

function normalizeSpace(str) {
  return (str || '').toString().replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(str) {
  return normalizeSpace(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseScoreText(text) {
  const t = normalizeSpace(text);
  if (!t) return null;
  const ratio = /(\d{1,3})\s*\/\s*(\d{1,3})/.exec(t);
  if (ratio) {
    return { value: parseInt(ratio[1], 10), max: parseInt(ratio[2], 10), hasRatio: true };
  }
  const pct = /(\d{1,3})\s*%/.exec(t);
  if (pct) {
    return { value: parseInt(pct[1], 10), max: 100, hasRatio: false };
  }
  const num = /(\d{1,3})/.exec(t);
  if (!num) return null;
  return { value: parseInt(num[1], 10), max: null, hasRatio: false };
}

function selectScoreFromCandidates(candidates) {
  const userHints = ['obtinut', 'realizat', 'utilizator', 'user', 'tau'];
  const maxHints = ['maxim', 'max'];

  const normTooltip = (c) => normalizeForMatch(c.tooltip);
  const normText = (c) => normalizeForMatch(c.text);
  const normAll = (c) => `${normTooltip(c)} ${normText(c)}`;

  const isUserCand = (c) => userHints.some((h) => normAll(c).includes(h));

  // Important: pbinfo sometimes uses "Punctajul tău maxim" to mean the user's best score,
  // not the maximum possible points. Treat "maxim" as max-points only when it's not in a user context.
  const isMaxPointsCand = (c) => {
    if (isUserCand(c)) return false;
    const all = normAll(c);
    if (all.includes('punctaj maxim') || all.includes('scor maxim')) return true;
    const hasMaxHint = maxHints.some((h) => all.includes(h));
    const hasScoreWord = all.includes('punctaj') || all.includes('scor') || all.includes('score');
    return hasMaxHint && hasScoreWord;
  };

  let maxScore = null;
  for (const c of candidates) {
    if (isMaxPointsCand(c) && Number.isFinite(c.value)) {
      maxScore = c.value;
      break;
    }
  }

  const nonMaxCandidates = candidates.filter((c) => !isMaxPointsCand(c));
  if (nonMaxCandidates.length === 0) {
    return { userScore: null, maxScore };
  }

  const ranked = nonMaxCandidates
    .map((c) => {
      let rank = 0;
      if (isUserCand(c)) rank += 100;
      if (c.hasRatio) rank += 50;
      if (c.isLink) rank += 10;
      return { c, rank };
    })
    .sort((a, b) => b.rank - a.rank);

  const best = ranked[0]?.c;
  if (!best || !Number.isFinite(best.value)) {
    return { userScore: null, maxScore };
  }

  // Heuristic:
  // When pbinfo can't (or doesn't) show the user's score, it may still show the maximum points
  // as a generic "Punctaj 100p". If that's the only score-like value we see and it's not
  // explicitly "obtinut" (or a ratio like 0/100), treat it as max points, not as a solved score.
  const looksLikeUserScore = isUserCand(best) || best.hasRatio;
  if (!looksLikeUserScore && candidates.length === 1 && best.value === 100 && maxScore == null) {
    return { userScore: null, maxScore: 100 };
  }

  if (best.max != null && Number.isFinite(best.max)) maxScore = best.max;
  return { userScore: best.value, maxScore };
}

const tooltipAttrs = ['title', 'data-bs-title', 'data-bs-original-title', 'data-original-title'];
function getTooltipText(el) {
  for (const attr of tooltipAttrs) {
    const v = el.getAttribute?.(attr);
    if (v) return v;
  }
  return '';
}

function buildScoreCandidatesFromCard(card) {
  const candidates = [];

  const tooltipEls = Array.from(
    card.querySelectorAll('[title],[data-bs-title],[data-bs-original-title],[data-original-title]')
  );
  for (const el of tooltipEls) {
    const tooltip = normalizeForMatch(getTooltipText(el));
    if (!tooltip) continue;
    if (!tooltip.includes('punctaj') && !tooltip.includes('scor') && !tooltip.includes('score'))
      continue;

    const text = normalizeSpace(el.textContent);
    const parsed = parseScoreText(text);
    if (!parsed) continue;

    candidates.push({
      el,
      tooltip: getTooltipText(el),
      text,
      value: parsed.value,
      max: parsed.max,
      hasRatio: parsed.hasRatio,
      isLink: el.tagName === 'A',
    });
  }

  if (candidates.length === 0) {
    const badgeEls = Array.from(card.querySelectorAll('span.badge, a.badge, div.badge')).filter(
      (el) => !normalizeSpace(el.textContent).startsWith('#')
    );
    for (const el of badgeEls) {
      const text = normalizeSpace(el.textContent);
      const parsed = parseScoreText(text);
      if (!parsed) continue;
      const tt = normalizeForMatch(getTooltipText(el));
      const withinFooter = Boolean(el.closest?.('div.card-footer'));
      const withinSolveButton = (() => {
        const btn = el.closest?.('a.btn');
        if (!btn) return false;
        const btnText = normalizeForMatch(btn.textContent);
        return btnText.includes('rezolv');
      })();
      const hasScoreTooltip = tt.includes('punctaj') || tt.includes('scor') || tt.includes('score');
      const looksLikeScoreText = /\bp\b/i.test(text) || parsed.hasRatio;
      if (!looksLikeScoreText && !hasScoreTooltip && !withinFooter && !withinSolveButton) continue;
      candidates.push({
        el,
        tooltip: getTooltipText(el),
        text,
        value: parsed.value,
        max: parsed.max,
        hasRatio: parsed.hasRatio,
        isLink: el.tagName === 'A',
      });
    }
  }

  return candidates;
}

function extractScoreInfoFromCard(card) {
  const candidates = buildScoreCandidatesFromCard(card);
  const { userScore, maxScore } = selectScoreFromCandidates(candidates);
  return { userScore, maxScore, candidates };
}

function extractScoreInfoFromProblemPage(root) {
  const candidates = [];
  const cell = root?.querySelector?.('#scor_utilizator_problema');
  if (!cell) return { userScore: null, maxScore: null, candidates };

  const preferred =
    cell.querySelector('a.badge, span.badge, a, span, div') || (cell.firstElementChild ?? cell);
  const text = normalizeSpace(preferred.textContent);
  const tooltip = getTooltipText(preferred) || getTooltipText(cell);
  const parsed = parseScoreText(text) || parseScoreText(tooltip);
  if (parsed) {
    candidates.push({
      el: preferred,
      tooltip,
      text,
      value: parsed.value,
      max: parsed.max,
      hasRatio: parsed.hasRatio,
    });
  }

  const userScore = parsed && Number.isFinite(parsed.value) ? parsed.value : null;
  const maxScore = parsed && Number.isFinite(parsed.max) ? parsed.max : null;
  return { userScore, maxScore, candidates };
}

function extractProblemMetaFromProblemPage(root, problemId) {
  const meta = {
    name: '',
    difficulty: 3,
    postedBy_link: '',
    postedBy_name: '',
    postedBy_img: '',
    author: '',
    source: '',
  };

  const heading = root?.querySelector?.('h1') || root?.querySelector?.('h2');
  if (heading) {
    const t = normalizeSpace(heading.textContent);
    if (t) {
      const prefixRe = problemId != null ? new RegExp(`^#?\\s*${problemId}\\b\\s*`, 'i') : null;
      const withoutId = prefixRe ? t.replace(prefixRe, '') : t;
      meta.name = withoutId.replace(/^[-–—:]\s*/, '').trim();
    }
  }

  if (!meta.name) {
    const ogTitle = root?.querySelector?.('meta[property="og:title"]')?.getAttribute?.('content');
    const docTitle = root?.querySelector?.('title')?.textContent;
    const t = normalizeSpace(ogTitle || docTitle);
    if (t) meta.name = t.replace(/- pbinfo\.ro.*$/i, '').trim();
  }

  const scoreCell = root?.querySelector?.('#scor_utilizator_problema');
  const row = scoreCell?.closest?.('tr') || null;
  const tds = row ? Array.from(row.querySelectorAll('td')) : [];
  const scoreIdx = scoreCell ? tds.indexOf(scoreCell) : -1;

  const difficultyTd = scoreIdx > 0 ? tds[scoreIdx - 1] : null;
  if (difficultyTd) {
    const txt = normalizeForMatch(difficultyTd.textContent);
    if (txt.includes('uso')) meta.difficulty = 0;
    else if (txt.includes('med')) meta.difficulty = 1;
    else if (txt.includes('dific')) meta.difficulty = 2;
    else if (txt.includes('conc')) meta.difficulty = 3;
  }

  const authorTd = scoreIdx > 1 ? tds[scoreIdx - 2] : null;
  if (authorTd) {
    const a = normalizeSpace(authorTd.textContent);
    meta.author = a === '-' ? '' : a;
  }

  const sourceTd = scoreIdx > 2 ? tds[scoreIdx - 3] : null;
  if (sourceTd) {
    const s = normalizeSpace(sourceTd.textContent);
    meta.source = s === '-' ? '' : s;
  }

  const postedByTd = tds.length > 0 ? tds[0] : null;
  const pbAnchor = postedByTd?.querySelector?.('a') || null;
  if (pbAnchor) {
    meta.postedBy_link = pbAnchor.href || '';
    meta.postedBy_name = normalizeSpace(pbAnchor.textContent);
    const img = pbAnchor.querySelector?.('img') || null;
    if (img?.src) meta.postedBy_img = img.src;
  }

  return meta;
}

function classifyProblemStatus(scoreInfo) {
  const maxPoints = Number.isFinite(scoreInfo?.maxScore) ? scoreInfo.maxScore : 100;
  if (scoreInfo?.userScore == null) return 'unattempted';
  if (scoreInfo.userScore >= maxPoints) return 'solved';
  return 'tried';
}

function isLikelyPbinfoNotFoundHtml(html) {
  const t = normalizeForMatch(String(html || ''));
  return t.includes('pagina nu exista') || t.includes('pagina nu există') || t.includes(' 404 ');
}

function isLikelyPbinfoBlockedHtml(html) {
  const t = String(html || '');
  return (
    /cdn-cgi\/challenge-platform/i.test(t) ||
    /cf-chl/i.test(t) ||
    /attention required/i.test(t) ||
    /security check/i.test(t)
  );
}

function parseTotalProblems(html) {
  const m = /class="[^"]*\bnumar_probleme\b[^"]*"[^>]*>\s*([0-9]+)\s*</i.exec(html || '');
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeListUrl(inputUrl, baseUrl, paginationParam = 'start') {
  const raw = normalizeSpace(inputUrl);
  const base = normalizeSpace(baseUrl);
  if (!raw && !base) return null;
  let u;
  try {
    u = new URL(raw || base, base || undefined);
  } catch {
    return null;
  }
  u.searchParams.delete(paginationParam);
  return u.toString();
}

function buildPageUrl(
  baseUrl,
  { pageIndex, pageSize, mode = 'offset', param = 'start', pageBase = 1 }
) {
  if (!baseUrl) return null;
  const u = new URL(baseUrl);
  if (mode === 'page') {
    const base = Number.isFinite(pageBase) ? pageBase : 1;
    u.searchParams.set(param, String(base + (pageIndex - 1)));
    return u.toString();
  }
  const size = Number.isFinite(pageSize) ? pageSize : 10;
  u.searchParams.set(param, String(size * (pageIndex - 1)));
  return u.toString();
}

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  const needsQuotes = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function problemsToCsv(problems) {
  const headers = [
    'id',
    'name',
    'status',
    'userScore',
    'maxScore',
    'difficulty',
    'postedBy',
    'author',
    'source',
    'link',
  ];
  const rows = Array.isArray(problems)
    ? problems.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        userScore: p.userScore,
        maxScore: p.maxScore,
        difficulty: p.difficulty,
        postedBy: p.postedBy_name,
        author: p.author,
        source: p.source,
        link: p.link,
      }))
    : [];
  const lines = [headers.join(',')].concat(
    rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))
  );
  // Add UTF-8 BOM so Excel keeps diacritics.
  return `\ufeff${lines.join('\n')}`;
}

function problemsToLinksText(problems) {
  return (Array.isArray(problems) ? problems : [])
    .map((p) => (p && typeof p.link === 'string' ? p.link.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

function problemsToIdsText(problems) {
  return (Array.isArray(problems) ? problems : [])
    .map((p) => (p && Number.isFinite(p.id) ? String(p.id) : ''))
    .filter(Boolean)
    .join('\n');
}

function escapeMarkdownLinkText(text) {
  const t = normalizeSpace(text);
  return t.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function problemsToMarkdownText(problems) {
  return (Array.isArray(problems) ? problems : [])
    .map((p) => {
      const id = Number.isFinite(p?.id) ? p.id : null;
      const name = escapeMarkdownLinkText(p?.name || '');
      const link = typeof p?.link === 'string' ? p.link.trim() : '';
      if (!link) return '';
      const label = id != null ? (name ? `#${id} - ${name}` : `#${id}`) : name;
      return `- [${label}](<${link}>)`;
    })
    .filter(Boolean)
    .join('\n');
}

function serializeProblemForSnapshot(p, level) {
  const base = {
    id: p?.id,
    name: p?.name,
    link: p?.link,
    difficulty: p?.difficulty,
    status: p?.status,
    userScore: Number.isFinite(p?.userScore) ? p.userScore : null,
    maxScore: Number.isFinite(p?.maxScore) ? p.maxScore : null,
  };
  if (level === 'minimal') return base;
  return {
    ...base,
    postedBy_link: p?.postedBy_link,
    postedBy_name: p?.postedBy_name,
    postedBy_img: p?.postedBy_img,
    author: p?.author,
    source: p?.source,
  };
}

function computeResumeFromStateSnapshot(snapshot) {
  const candidates = [];
  const q = Array.isArray(snapshot?.pageQueue) ? snapshot.pageQueue : [];
  if (q.length > 0 && Number.isFinite(q[0])) candidates.push(q[0]);
  const d = Array.isArray(snapshot?.deferred) ? snapshot.deferred : [];
  for (const entry of d) {
    const pageIndex = Array.isArray(entry) ? entry[0] : entry?.pageIndex;
    if (Number.isFinite(pageIndex)) candidates.push(pageIndex);
  }
  const f = Array.isArray(snapshot?.inFlightPages) ? snapshot.inFlightPages : [];
  for (const pageIndex of f) if (Number.isFinite(pageIndex)) candidates.push(pageIndex);
  if (Number.isFinite(snapshot?.nextSequentialPage)) candidates.push(snapshot.nextSequentialPage);
  const min = candidates.length > 0 ? Math.min(...candidates) : null;
  return Number.isFinite(min) ? min : null;
}

function restoreProblemsFromSnapshot(snapshot) {
  const allProblems = [];
  const seenProblemIds = new Set();

  const problems = Array.isArray(snapshot?.problems) ? snapshot.problems : [];
  for (const p of problems) {
    const id = Number.isFinite(p?.id) ? p.id : NaN;
    if (!Number.isFinite(id)) continue;
    const userScore = Number.isFinite(p?.userScore) ? p.userScore : null;
    const maxScore = Number.isFinite(p?.maxScore) ? p.maxScore : 100;
    const status =
      p?.status === 'solved' || p?.status === 'tried' || p?.status === 'unattempted'
        ? p.status
        : classifyProblemStatus({ userScore, maxScore });
    const scoreKnown = userScore != null && Number.isFinite(userScore);
    allProblems.push({
      cnt: allProblems.length + 1,
      id,
      name: typeof p?.name === 'string' ? p.name : '',
      link: typeof p?.link === 'string' ? p.link : '',
      difficulty: Number.isFinite(p?.difficulty) ? p.difficulty : 3,
      score: scoreKnown ? userScore : -1,
      scoreKnown,
      userScore,
      maxScore,
      status,
      postedBy_link: typeof p?.postedBy_link === 'string' ? p.postedBy_link : '',
      postedBy_name: typeof p?.postedBy_name === 'string' ? p.postedBy_name : '',
      postedBy_img: typeof p?.postedBy_img === 'string' ? p.postedBy_img : '',
      author: typeof p?.author === 'string' ? p.author : '',
      source: typeof p?.source === 'string' ? p.source : '',
    });
    seenProblemIds.add(id);
  }

  if (Array.isArray(snapshot?.seenProblemIds) && snapshot.seenProblemIds.length > 0) {
    for (const n of snapshot.seenProblemIds) {
      const id = parseInt(n, 10);
      if (Number.isFinite(id)) seenProblemIds.add(id);
    }
  }

  return { allProblems, seenProblemIds };
}

if (typeof window === 'undefined' || typeof document === 'undefined') {
  if (typeof module !== 'undefined') {
    module.exports = {
      normalizeSpace,
      normalizeForMatch,
      parseScoreText,
      selectScoreFromCandidates,
      getTooltipText,
      buildScoreCandidatesFromCard,
      extractScoreInfoFromCard,
      extractScoreInfoFromProblemPage,
      extractProblemMetaFromProblemPage,
      classifyProblemStatus,
      parseTotalProblems,
      normalizeListUrl,
      buildPageUrl,
      problemsToCsv,
      problemsToLinksText,
      problemsToIdsText,
      problemsToMarkdownText,
      serializeProblemForSnapshot,
      computeResumeFromStateSnapshot,
      restoreProblemsFromSnapshot,
      isLikelyPbinfoNotFoundHtml,
      isLikelyPbinfoBlockedHtml,
    };
  }
} else {
  (function () {
    // restore console
    var iFrame = document.createElement('iframe');
    iFrame.style.display = 'none';
    document.body.appendChild(iFrame);
    window.console = iFrame.contentWindow.console;
    console.clear();

    const STORAGE_NAMESPACE = 'pbinfo-get-unsolved';
    const STATE_STORAGE_VERSION = 1;
    const THEME_STORAGE_KEY = `${STORAGE_NAMESPACE}:theme`;

    function safeJsonParse(value) {
      if (typeof value !== 'string' || value.trim() === '') return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }

    function fnv1a32(str) {
      const s = String(str || '');
      let h = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(16).padStart(8, '0');
    }

    function makeStateKeys(pageLink) {
      const h = fnv1a32(pageLink);
      return {
        full: `${STORAGE_NAMESPACE}:state:v${STATE_STORAGE_VERSION}:${h}`,
        minimal: `${STORAGE_NAMESPACE}:state-min:v${STATE_STORAGE_VERSION}:${h}`,
        index: `${STORAGE_NAMESPACE}:state-index:v${STATE_STORAGE_VERSION}:${h}`,
        itemPrefix: `${STORAGE_NAMESPACE}:state-item:v${STATE_STORAGE_VERSION}:${h}:`,
      };
    }

    function formatDateTime(ts) {
      const d = new Date(Number(ts));
      if (!Number.isFinite(d.getTime())) return '-';
      return d.toLocaleString();
    }

    function loadThemePreference() {
      try {
        const v = normalizeSpace(localStorage.getItem(THEME_STORAGE_KEY));
        if (v === 'light' || v === 'dark' || v === 'system') return v;
      } catch {}
      return 'system';
    }

    function persistThemePreference(value) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, value);
      } catch {}
    }

    function applyThemePreference(value, targetEl) {
      const el = targetEl && targetEl.setAttribute ? targetEl : document.documentElement;
      const v = value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
      if (v === 'system') el.removeAttribute('data-theme');
      else el.setAttribute('data-theme', v);
      persistThemePreference(v);
      return v;
    }

    const config = {
      scanMode: 'list',
      idRange: {
        startId: Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_ID_START))
          ? Number(window.PBINFO_GET_UNSOLVED_ID_START)
          : 1,
        endId: Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_ID_END))
          ? Number(window.PBINFO_GET_UNSOLVED_ID_END)
          : 8000,
        stopAfterMissing: Math.max(
          0,
          Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_ID_MISSING_STOP))
            ? Number(window.PBINFO_GET_UNSOLVED_ID_MISSING_STOP)
            : 0
        ),
        scoreBatch: {
          enabled: window.PBINFO_GET_UNSOLVED_ID_SCORE_BATCH !== false,
          size: Math.max(
            1,
            Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_ID_SCORE_BATCH_SIZE))
              ? Number(window.PBINFO_GET_UNSOLVED_ID_SCORE_BATCH_SIZE)
              : 200
          ),
        },
      },
      pagination: {
        mode: window.PBINFO_GET_UNSOLVED_PAGINATION_MODE || 'offset',
        param: window.PBINFO_GET_UNSOLVED_PAGE_PARAM || 'start',
        pageBase: Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_PAGE_BASE))
          ? Number(window.PBINFO_GET_UNSOLVED_PAGE_BASE)
          : 1,
      },
      pageSize: Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_PAGE_SIZE))
        ? Number(window.PBINFO_GET_UNSOLVED_PAGE_SIZE)
        : null,
      concurrency: Math.max(
        1,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_CONCURRENCY))
          ? Number(window.PBINFO_GET_UNSOLVED_CONCURRENCY)
          : 1
      ),
      delayMs: Math.max(
        0,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_DELAY_MS))
          ? Number(window.PBINFO_GET_UNSOLVED_DELAY_MS)
          : 0
      ),
      timeoutMs: Math.max(
        1000,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_TIMEOUT_MS))
          ? Number(window.PBINFO_GET_UNSOLVED_TIMEOUT_MS)
          : 30000
      ),
      maxRetriesPerPage: Math.max(
        0,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_MAX_RETRIES))
          ? Number(window.PBINFO_GET_UNSOLVED_MAX_RETRIES)
          : 3
      ),
      startPage: Math.max(
        1,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_START_PAGE))
          ? Number(window.PBINFO_GET_UNSOLVED_START_PAGE)
          : 1
      ),
      maxPages: Math.max(
        1,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_MAX_PAGES))
          ? Number(window.PBINFO_GET_UNSOLVED_MAX_PAGES)
          : 5000
      ),
    };

    function normalizeScanMode(value) {
      const v = normalizeForMatch(value || '');
      if (v.includes('id')) return 'id-range';
      if (v.includes('range')) return 'id-range';
      if (v.includes('index')) return 'id-range';
      if (v.includes('list')) return 'list';
      return null;
    }

    const defaultLink = location?.href || '';
    const modeFromWindow = normalizeScanMode(window.PBINFO_GET_UNSOLVED_MODE);
    let scanMode = modeFromWindow;
    if (!scanMode) {
      let modeInput = prompt(
        'Mod scanare:\n' +
          '1 = listă (paginare)\n' +
          '2 = interval ID (probleme/ID)\n' +
          'Enter = 1',
        '1'
      );
      if (modeInput === null) {
        console.warn('Nu a fost selectat un mod de scanare. Scriptul a fost oprit.');
        return;
      }
      modeInput = normalizeSpace(modeInput);
      scanMode = modeInput === '2' ? 'id-range' : 'list';
    }
    config.scanMode = scanMode;

    function parseIdRangeInput(value, fallback) {
      const raw = normalizeSpace(value);
      const fb = normalizeSpace(fallback);
      const t = raw || fb;
      if (!t) return null;
      const m = /^(\d+)\s*-\s*(\d+)$/.exec(t);
      if (m) {
        const startId = parseInt(m[1], 10);
        const endId = parseInt(m[2], 10);
        if (!Number.isFinite(startId) || !Number.isFinite(endId) || startId < 1 || endId < 1)
          return null;
        return { startId, endId };
      }
      const n = parseInt(t, 10);
      if (!Number.isFinite(n) || n < 1) return null;
      return { startId: 1, endId: n };
    }

    let pageLink = null;

    if (scanMode === 'id-range') {
      const defaultRange = `${config.idRange.startId}-${config.idRange.endId}`;
      let idRangeInput = prompt(
        'Interval ID de scanat (ex: 1-8000).\n' +
          'Notă: scanarea pe ID-uri este mai lentă și poate necesita delay/concurență mică.',
        defaultRange
      );
      if (idRangeInput === null) {
        console.warn('Nu a fost furnizat intervalul ID. Scriptul a fost oprit.');
        return;
      }
      const range = parseIdRangeInput(idRangeInput, defaultRange);
      if (!range) {
        console.warn('Interval ID invalid. Scriptul a fost oprit.');
        return;
      }
      const startId = Math.min(range.startId, range.endId);
      const endId = Math.max(range.startId, range.endId);
      config.idRange.startId = startId;
      config.idRange.endId = endId;
      pageLink = `id-range:${location?.origin || 'https://www.pbinfo.ro'}:${startId}-${endId}`;
      config.startPage = startId;
    } else {
      let pageLinkInput = prompt(
        'Pune un link către lista de probleme de unde vrei să obții problemele nerezolvate.\n' +
          'Enter = pagina curentă. Dacă folosești filtre, copiază link-ul din bara de adrese.',
        defaultLink
      );
      if (pageLinkInput === null) {
        console.warn('Nu a fost furnizat niciun link. Scriptul a fost oprit.');
        return;
      }
      pageLinkInput = normalizeSpace(pageLinkInput);
      pageLink = normalizeListUrl(
        pageLinkInput || defaultLink,
        defaultLink,
        config.pagination.param
      );
      if (!pageLink) {
        console.warn('Link invalid. Scriptul a fost oprit.');
        return;
      }
    }

    const stateKeys = makeStateKeys(pageLink);
    const savedFull = safeJsonParse(
      (() => {
        try {
          return localStorage.getItem(stateKeys.full);
        } catch {
          return null;
        }
      })()
    );
    const savedMinimal =
      savedFull == null
        ? safeJsonParse(
            (() => {
              try {
                return localStorage.getItem(stateKeys.minimal);
              } catch {
                return null;
              }
            })()
          )
        : null;

    let pendingRestore = null;
    let restoreMode = null;
    const candidate = savedFull || savedMinimal;
    if (candidate && candidate.pageLink === pageLink) {
      const savedAt = formatDateTime(candidate.savedAt);
      const pages = Number.isFinite(candidate.stats?.pages) ? candidate.stats.pages : null;
      const problems = Number.isFinite(candidate.stats?.total)
        ? candidate.stats.total
        : Array.isArray(candidate.problems)
          ? candidate.problems.length
          : null;
      const kind = savedFull ? 'full' : 'minimal';
      const note = kind === 'minimal' ? ' (doar progres, fără lista completă)' : '';
      const unitLabel = scanMode === 'id-range' ? 'ID-uri scanate' : 'Pagini scanate';
      const headLine =
        scanMode === 'id-range'
          ? `Am găsit un scan salvat pentru acest interval${note}.\n`
          : `Am găsit un scan salvat pentru acest link${note}.\n`;
      const ok = confirm(
        headLine +
          `Salvat la: ${savedAt}\n` +
          `${pages != null ? `${unitLabel}: ${pages}\n` : ''}` +
          `${problems != null ? `Probleme scanate: ${problems}\n` : ''}` +
          `\nOK = încarcă, Cancel = ignoră`
      );
      if (ok) {
        pendingRestore = candidate;
        restoreMode = kind;
        if (candidate.pagination && typeof candidate.pagination === 'object') {
          if (candidate.pagination.mode) config.pagination.mode = candidate.pagination.mode;
          if (candidate.pagination.param) config.pagination.param = candidate.pagination.param;
          if (Number.isFinite(candidate.pagination.pageBase))
            config.pagination.pageBase = candidate.pagination.pageBase;
        }
        if (Number.isFinite(candidate.scanStartPage)) config.startPage = candidate.scanStartPage;
        else if (Number.isFinite(candidate.config?.startPage))
          config.startPage = candidate.config.startPage;
      }
    }

    if (pendingRestore == null) {
      const promptText =
        scanMode === 'id-range'
          ? 'De la ce ID să încep scanarea?\n' +
            `Interval: ${config.idRange.startId}-${config.idRange.endId}\n` +
            'Pentru resume, pune un număr mai mare.\n' +
            'Enter = valoarea default.'
          : 'De la ce pagină să încep scanarea?\n' +
            '1 = de la început. Pentru resume, pune un număr mai mare.\n' +
            'Enter = valoarea default.';
      let startPageInput = prompt(promptText, String(config.startPage));
      if (startPageInput === null) {
        console.warn('Nu a fost furnizat start. Scriptul a fost oprit.');
        return;
      }
      startPageInput = normalizeSpace(startPageInput);
      const startPage = startPageInput === '' ? config.startPage : parseInt(startPageInput, 10);
      if (!Number.isFinite(startPage) || startPage < 1) {
        console.warn('Start invalid. Scriptul a fost oprit.');
        return;
      }
      if (scanMode === 'id-range' && startPage > config.idRange.endId) {
        console.warn('Start ID peste capătul intervalului. Scriptul a fost oprit.');
        return;
      }
      config.startPage = startPage;
    }

    const firstFetchedPageIndex = config.startPage;
    let themePreference = loadThemePreference();

    const overlayEnabled = window.PBINFO_GET_UNSOLVED_OVERLAY === true;
    const UI_ROOT_ID = 'pbinfo-get-unsolved-root';
    const UI_STYLE_ID = 'pbinfo-get-unsolved-style';
    const UI_ID_LOG = 'pbinfo-get-unsolved-log';
    const UI_ID_PROGRESS = 'pbinfo-get-unsolved-progress';
    const UI_ID_CONTROLS = 'pbinfo-get-unsolved-controls';
    const UI_ID_SUMMARY = 'pbinfo-get-unsolved-summary';

    // setup UI root (overlay or destructive)
    try {
      document.getElementById(UI_ROOT_ID)?.remove();
    } catch {}
    if (!overlayEnabled) {
      document.head.innerHTML = '';
      document.body.innerHTML = '';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
    }
    const appRoot = document.createElement('div');
    appRoot.id = UI_ROOT_ID;
    if (overlayEnabled) {
      appRoot.style.position = 'fixed';
      appRoot.style.top = '0';
      appRoot.style.left = '0';
      appRoot.style.right = '0';
      appRoot.style.bottom = '0';
      appRoot.style.zIndex = '2147483647';
      appRoot.style.overflow = 'auto';
      appRoot.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.15)';
    }
    document.body.appendChild(appRoot);
    themePreference = applyThemePreference(themePreference, appRoot);

    const title = document.createElement('h2');
    title.style.display = 'block';
    const titleSpan = document.createElement('span');
    titleSpan.style.color = 'red';
    titleSpan.textContent = 'pbinfo-get-unsolved-enhanced.js';
    title.appendChild(titleSpan);
    title.appendChild(document.createTextNode('.'));
    appRoot.appendChild(title);

    const style = document.createElement('style');
    style.id = UI_STYLE_ID;
    style.innerHTML = `
        #${UI_ROOT_ID}{
            font-family: Arial, sans-serif;
            --bg: #ffffff;
            --text: #111827;
            --muted: #6b7280;
            --border: #d1d5db;
            --panel: #f9fafb;
            --btn-hover: #eef2ff;
            --table-header-bg: #f3f4f6;
            --table-row-alt: #fafafa;
            --table-row-hover: #eef2ff;
            --link: #1d4ed8;
            color-scheme: light dark;
            background: var(--bg);
            color: var(--text);
            padding: 0.9rem;
            box-sizing: border-box;
            min-height: 100vh;
        }
        @media (prefers-color-scheme: dark){
            #${UI_ROOT_ID}:not([data-theme]){
                --bg: #0b0f14;
                --text: #e5e7eb;
                --muted: #9ca3af;
                --border: #243041;
                --panel: #121826;
                --btn-hover: #1b2a44;
                --table-header-bg: #121826;
                --table-row-alt: #0f1522;
                --table-row-hover: #1b2a44;
                --link: #93c5fd;
            }
        }
        #${UI_ROOT_ID}[data-theme="light"]{ color-scheme: light; }
        #${UI_ROOT_ID}[data-theme="dark"]{ color-scheme: dark; }
        #${UI_ROOT_ID}[data-theme="dark"]{
            --bg: #0b0f14;
            --text: #e5e7eb;
            --muted: #9ca3af;
            --border: #243041;
            --panel: #121826;
            --btn-hover: #1b2a44;
            --table-header-bg: #121826;
            --table-row-alt: #0f1522;
            --table-row-hover: #1b2a44;
            --link: #93c5fd;
        }
        #${UI_ROOT_ID} a{color:var(--link);text-decoration:none;}
        #${UI_ROOT_ID} a:hover{cursor:pointer;text-decoration:underline;}
        #${UI_ROOT_ID} #${UI_ID_LOG} span{line-height:1.35;}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS}{margin:0.75em 0 0.5em;display:flex;flex-wrap:wrap;gap:0.75em;align-items:flex-end;}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} .group{display:flex;flex-direction:column;gap:0.25em;min-width:12em;padding:0.5em;border:1px solid var(--border);border-radius:0.5em;background:var(--panel);}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} label{display:flex;gap:0.4em;align-items:center;user-select:none;}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} input[type="checkbox"]{accent-color:var(--link);}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} input[type="number"]{width:8em;border:1px solid var(--border);border-radius:0.45em;padding:0.2em 0.35em;background:var(--bg);color:var(--text);}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} select{width:12em;border:1px solid var(--border);border-radius:0.45em;padding:0.25em 0.35em;background:var(--bg);color:var(--text);}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} button{padding:0.35em 0.65em;border:1px solid var(--border);border-radius:0.45em;background:transparent;color:var(--text);}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} button:hover{background:var(--btn-hover);}
        #${UI_ROOT_ID} #${UI_ID_CONTROLS} button:disabled{opacity:0.55;cursor:not-allowed;}
        #${UI_ROOT_ID} #${UI_ID_PROGRESS}{margin:0.4em 0 0.2em;color:var(--muted);}
        #${UI_ROOT_ID} #${UI_ID_SUMMARY}{margin:0.5em 0;color:var(--text);}
        #${UI_ROOT_ID} .pill{display:inline-block;padding:0.1em 0.4em;border-radius:0.4em;color:white;}
        #${UI_ROOT_ID} .muted{color:var(--muted);}
        #${UI_ROOT_ID} table{border-collapse:collapse;margin-top:0.75em;}
        #${UI_ROOT_ID} th, #${UI_ROOT_ID} td{border:1px solid var(--border);padding:0.25em 0.4em;vertical-align:top;}
        #${UI_ROOT_ID} thead th{position:sticky;top:0;background:var(--table-header-bg);z-index:2;}
        #${UI_ROOT_ID} thead th a{display:inline-flex;gap:0.25em;align-items:center;}
        #${UI_ROOT_ID} tbody tr:nth-child(even){background:var(--table-row-alt);}
        #${UI_ROOT_ID} tbody tr:hover{background:var(--table-row-hover);}
    `;
    try {
      document.getElementById(UI_STYLE_ID)?.remove();
    } catch {}
    document.head.appendChild(style);

    const logDiv = document.createElement('div');
    logDiv.id = UI_ID_LOG;
    appRoot.appendChild(logDiv);

    function addLog(msg) {
      const d = new Date();
      const span = document.createElement('span');
      span.innerHTML =
        '<b>[' +
        d.getHours().toString().padStart(2, '0') +
        ':' +
        d.getMinutes().toString().padStart(2, '0') +
        ':' +
        d.getSeconds().toString().padStart(2, '0') +
        '] - </b>' +
        msg;
      span.style.display = 'block';
      logDiv.appendChild(span);
      if (overlayEnabled) {
        appRoot.scrollTop = appRoot.scrollHeight;
      } else {
        window.scroll(0, document.body.scrollHeight);
      }
    }

    if (scanMode === 'id-range') {
      addLog(
        `Mod scanare: <b>interval ID</b> (${config.idRange.startId}-${config.idRange.endId}).`
      );
      addLog(`Start ID: <b>${config.startPage}</b>.`);
    } else {
      addLog(
        'Link către lista de probleme: <a href="' + pageLink + '"><i>' + pageLink + '</i></a>'
      );
      addLog(`Start page: <b>${config.startPage}</b>.`);
    }

    const progressDiv = document.createElement('div');
    progressDiv.id = UI_ID_PROGRESS;
    appRoot.appendChild(progressDiv);

    const controlsDiv = document.createElement('div');
    controlsDiv.id = UI_ID_CONTROLS;
    appRoot.appendChild(controlsDiv);

    const summaryDiv = document.createElement('div');
    summaryDiv.id = UI_ID_SUMMARY;
    appRoot.appendChild(summaryDiv);

    let pageSize = config.pageSize;
    let totalProblems = null;
    let totalPages = scanMode === 'id-range' ? config.idRange.endId : null;
    let startedAt = Date.now();

    const stats = { solved: 0, tried: 0, unattempted: 0, total: 0, pages: 0, missing: 0 };
    let finished = false;
    let scanEnd = null;
    let restoringState = false;
    let stopRequested = false;
    let paused = false;
    let stopButton = null;
    let pauseButton = null;
    const activeRequests = new Set();
    const activePageIndexes = new Set();

    const debugEnabled = Boolean(window.PBINFO_GET_UNSOLVED_DEBUG);
    const debugDumpLimit = Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_DEBUG_LIMIT))
      ? Number(window.PBINFO_GET_UNSOLVED_DEBUG_LIMIT)
      : 20;
    const debugIncludeHtml = Boolean(window.PBINFO_GET_UNSOLVED_DEBUG_HTML);
    const debugIds = Array.isArray(window.PBINFO_GET_UNSOLVED_DEBUG_IDS)
      ? new Set(
          window.PBINFO_GET_UNSOLVED_DEBUG_IDS.map((n) => parseInt(n, 10)).filter(Number.isFinite)
        )
      : null;
    let debugDumped = 0;

    if (debugEnabled) {
      addLog(
        `<span style="color:#b35c00;"><b>Debug:</b> activ (limită dump=${debugDumpLimit}${debugIds ? `, ids=${Array.from(debugIds).join(',')}` : ''}).</span>`
      );
    }

    function shouldDebugDump(id) {
      if (!debugEnabled) return false;
      if (debugDumped >= debugDumpLimit) return false;
      if (debugIds && !debugIds.has(id)) return false;
      return true;
    }

    function debugDumpCard(card, meta) {
      debugDumped++;

      const tooltipEls = Array.from(
        card.querySelectorAll(
          '[title],[data-bs-title],[data-bs-original-title],[data-original-title]'
        )
      );
      const tooltips = tooltipEls
        .map((el) => ({
          tag: el.tagName,
          tooltip: getTooltipText(el),
          text: normalizeSpace(el.textContent),
        }))
        .filter((x) => x.tooltip || x.text);

      const badges = Array.from(card.querySelectorAll('.badge'))
        .map((el) => normalizeSpace(el.textContent))
        .filter(Boolean);

      const candidates = (meta.scoreInfo?.candidates || []).map((c) => ({
        tag: c.el?.tagName,
        tooltip: c.tooltip,
        text: c.text,
        value: c.value,
        max: c.max,
        hasRatio: c.hasRatio,
      }));

      console.log('pbinfo-get-unsolved debug:', {
        id: meta.id,
        name: meta.name,
        link: meta.link,
        scoreInfo: { userScore: meta.scoreInfo?.userScore, maxScore: meta.scoreInfo?.maxScore },
        candidates,
        tooltips,
        badges,
      });

      if (debugIncludeHtml) {
        console.log('pbinfo-get-unsolved debug card html:', (card.outerHTML || '').slice(0, 5000));
      }
    }

    async function copyTextToClipboard(text) {
      const value = String(text || '');
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '-1000px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('Clipboard copy failed');
    }

    const allProblems = [];
    const seenProblemIds = new Set();
    const sorted = {
      cnt: 1,
      id: 0,
      score: 0,
      status: 0,
      difficulty: 0,
      postedBy_name: 0,
      author: 0,
      source: 0,
    };

    const filterState = {
      statuses: new Set(['tried', 'unattempted']),
      includeUnknownScore: true,
      scoreMin: null,
      scoreMax: null,
    };

    const listDiv = document.createElement('div');
    listDiv.style.marginTop = '1em';

    const table = document.createElement('table');
    table.style.width = '75%';
    table.style.minWidth = '450px';
    table.style.maxWidth = '1050px';

    function ensureResultsAttached() {
      if (!table.isConnected) appRoot.appendChild(table);
      if (!listDiv.isConnected) appRoot.appendChild(listDiv);
    }

    function quickSort(arr, left, right, key) {
      let index;
      if (arr.length > 1) {
        index = partition(arr, left, right, key);
        if (left < index - 1) quickSort(arr, left, index - 1, key);
        if (index < right) quickSort(arr, index, right, key);
      }
      return arr;
    }
    function partition(arr, left, right, key) {
      let pivot = arr[Math.floor((right + left) / 2)][key];
      let i = left;
      let j = right;
      while (i <= j) {
        while (arr[i][key] < pivot) i++;
        while (arr[j][key] > pivot) j--;
        if (i <= j) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          i++;
          j--;
        }
      }
      return i;
    }

    function sortTable(type) {
      if (sorted[type] === 0) {
        Object.keys(sorted).forEach((k) => (sorted[k] = 0));
        sorted[type] = 1;
      } else {
        sorted[type] *= -1;
      }
      quickSort(allProblems, 0, allProblems.length - 1, type);
      if (sorted[type] === -1) allProblems.reverse();
      renderResults();
    }

    window.sortTable = sortTable;

    function getVisibleProblems() {
      const min = Number.isFinite(filterState.scoreMin) ? filterState.scoreMin : null;
      const max = Number.isFinite(filterState.scoreMax) ? filterState.scoreMax : null;
      const includeUnknown = Boolean(filterState.includeUnknownScore);
      const statuses = filterState.statuses;

      return allProblems.filter((p) => {
        if (!statuses.has(p.status)) return false;
        const scoreKnown = p.userScore != null && Number.isFinite(p.userScore);
        if (!scoreKnown) return includeUnknown;
        if (min != null && p.userScore < min) return false;
        if (max != null && p.userScore > max) return false;
        return true;
      });
    }

    function updateSummary(visible) {
      const shown = visible.length;
      const total = allProblems.length;
      const unsolved = allProblems.filter((p) => p.status !== 'solved').length;
      summaryDiv.replaceChildren();
      const b = document.createElement('b');
      b.textContent = 'Statistici:';
      summaryDiv.appendChild(b);
      summaryDiv.appendChild(
        document.createTextNode(
          ` scanate=${total} · nerezolvate=${unsolved} · afișate=${shown} · ${scanMode === 'id-range' ? 'ID-uri' : 'pagini'}=${stats.pages}`
        )
      );
    }

    function updateList(visible) {
      const tried = visible.filter((p) => p.status === 'tried');
      const unattempted = visible.filter((p) => p.status === 'unattempted');
      const solved = visible.filter((p) => p.status === 'solved');

      function mkList(items) {
        if (items.length === 0) {
          const muted = document.createElement('span');
          muted.className = 'muted';
          muted.textContent = '-';
          return muted;
        }

        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.paddingLeft = '0';
        ul.style.margin = '0';
        for (const p of items) {
          const li = document.createElement('li');
          li.style.margin = '0.15em 0';
          const a = document.createElement('a');
          a.href = p.link;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = p.name ? `#${p.id} - ${p.name}` : `#${p.id}`;
          li.appendChild(a);
          ul.appendChild(li);
        }
        return ul;
      }

      listDiv.replaceChildren();

      const h3 = document.createElement('h3');
      h3.textContent = 'Lista (filtrată):';
      listDiv.appendChild(h3);

      const counts = document.createElement('div');
      counts.style.marginBottom = '0.5em';
      counts.appendChild(document.createTextNode('Încercate: '));
      const triedB = document.createElement('b');
      triedB.textContent = String(tried.length);
      counts.appendChild(triedB);
      counts.appendChild(document.createTextNode(' · Neîncercate: '));
      const unattemptedB = document.createElement('b');
      unattemptedB.textContent = String(unattempted.length);
      counts.appendChild(unattemptedB);
      counts.appendChild(document.createTextNode(' · Rezolvate: '));
      const solvedB = document.createElement('b');
      solvedB.textContent = String(solved.length);
      counts.appendChild(solvedB);
      listDiv.appendChild(counts);

      const sections = [
        { label: 'Încercate', items: tried },
        { label: 'Neîncercate', items: unattempted },
        { label: 'Rezolvate', items: solved },
      ];
      for (const s of sections) {
        const h4 = document.createElement('h4');
        h4.style.margin = '0.75em 0 0.25em';
        h4.textContent = s.label;
        listDiv.appendChild(h4);
        listDiv.appendChild(mkList(s.items));
      }
    }

    function renderResults() {
      const visible = getVisibleProblems();
      updateTable(visible);
      updateSummary(visible);
      updateList(visible);
    }

    let renderTimer = null;
    function requestRenderResults() {
      if (renderTimer != null) clearTimeout(renderTimer);
      renderTimer = setTimeout(() => {
        renderTimer = null;
        renderResults();
      }, 150);
    }

    const liveRenderConfig = {
      enabled: window.PBINFO_GET_UNSOLVED_LIVE_RENDER === true,
      everyPages: Math.max(
        1,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_LIVE_RENDER_EVERY_PAGES))
          ? Number(window.PBINFO_GET_UNSOLVED_LIVE_RENDER_EVERY_PAGES)
          : 2
      ),
      minMs: Math.max(
        0,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_LIVE_RENDER_MIN_MS))
          ? Number(window.PBINFO_GET_UNSOLVED_LIVE_RENDER_MIN_MS)
          : 750
      ),
    };
    let lastLiveRenderAt = 0;
    let lastLiveRenderPages = 0;

    function maybeLiveRender() {
      if (!liveRenderConfig.enabled) return;
      if (finished || stopRequested || restoringState) return;
      if (allProblems.length === 0) return;

      const now = Date.now();
      if (stats.pages - lastLiveRenderPages < liveRenderConfig.everyPages) return;
      if (now - lastLiveRenderAt < liveRenderConfig.minMs) return;

      lastLiveRenderAt = now;
      lastLiveRenderPages = stats.pages;
      ensureResultsAttached();
      requestRenderResults();
    }

    function downloadText(filename, content, mime) {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      appRoot.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function stopScan(reason) {
      if (finished) return;
      stopRequested = true;
      paused = false;
      if (pauseButton) {
        pauseButton.disabled = true;
        pauseButton.textContent = 'Pauză';
      }
      if (stopButton) {
        stopButton.disabled = true;
        stopButton.textContent = 'Oprit';
      }
      pageQueue.length = 0;
      for (const xhr of activeRequests) {
        try {
          xhr.abort();
        } catch {}
      }
      finishScan({ complete: false, reason: reason || 'Oprit de utilizator' });
    }

    function togglePause() {
      if (finished || stopRequested) return;
      paused = !paused;
      if (pauseButton) pauseButton.textContent = paused ? 'Continuă' : 'Pauză';
      addLog(paused ? '<b>Scanare pusă pe pauză.</b>' : '<b>Scanare reluată.</b>');
      if (paused) {
        ensureResultsAttached();
        renderResults();
        saveScanState({ mode: 'full', reason: 'pause', silent: true });
      }
      updateProgress(inFlight);
      if (!paused) {
        for (let i = 0; i < config.concurrency; i++) schedule(kick);
      }
    }

    function setupControls() {
      const groupStatus = document.createElement('div');
      groupStatus.className = 'group';
      groupStatus.innerHTML = '<b>Stare</b>';

      const statuses = [
        { key: 'solved', label: 'rezolvate' },
        { key: 'tried', label: 'încercate' },
        { key: 'unattempted', label: 'neîncercate' },
      ];

      for (const s of statuses) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = filterState.statuses.has(s.key);
        input.addEventListener('change', () => {
          if (input.checked) filterState.statuses.add(s.key);
          else filterState.statuses.delete(s.key);
          renderResults();
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${s.label}`));
        groupStatus.appendChild(label);
      }

      const groupScore = document.createElement('div');
      groupScore.className = 'group';
      groupScore.innerHTML = '<b>Filtru punctaj</b>';

      const minLabel = document.createElement('label');
      minLabel.textContent = 'Min';
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.min = '0';
      minInput.placeholder = '-';
      if (filterState.scoreMin != null && Number.isFinite(filterState.scoreMin)) {
        minInput.value = String(filterState.scoreMin);
      }
      minInput.addEventListener('input', () => {
        const v = Number(minInput.value);
        filterState.scoreMin = Number.isFinite(v) && minInput.value !== '' ? v : null;
        requestRenderResults();
      });
      minLabel.appendChild(minInput);
      groupScore.appendChild(minLabel);

      const maxLabel = document.createElement('label');
      maxLabel.textContent = 'Max';
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.min = '0';
      maxInput.placeholder = '-';
      if (filterState.scoreMax != null && Number.isFinite(filterState.scoreMax)) {
        maxInput.value = String(filterState.scoreMax);
      }
      maxInput.addEventListener('input', () => {
        const v = Number(maxInput.value);
        filterState.scoreMax = Number.isFinite(v) && maxInput.value !== '' ? v : null;
        requestRenderResults();
      });
      maxLabel.appendChild(maxInput);
      groupScore.appendChild(maxLabel);

      const unknownLabel = document.createElement('label');
      const unknownInput = document.createElement('input');
      unknownInput.type = 'checkbox';
      unknownInput.checked = filterState.includeUnknownScore;
      unknownInput.addEventListener('change', () => {
        filterState.includeUnknownScore = unknownInput.checked;
        renderResults();
      });
      unknownLabel.appendChild(unknownInput);
      unknownLabel.appendChild(document.createTextNode(' include scor necunoscut'));
      groupScore.appendChild(unknownLabel);

      const groupAppearance = document.createElement('div');
      groupAppearance.className = 'group';
      groupAppearance.innerHTML = '<b>Aspect</b>';

      const themeLabel = document.createElement('label');
      themeLabel.textContent = 'Temă';
      const themeSelect = document.createElement('select');
      const themeOptions = [
        { value: 'system', label: 'Sistem' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ];
      for (const o of themeOptions) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        themeSelect.appendChild(opt);
      }
      themeSelect.value = themePreference;
      themeSelect.addEventListener('change', () => {
        themePreference = applyThemePreference(themeSelect.value, appRoot);
        themeSelect.value = themePreference;
      });
      themeLabel.appendChild(themeSelect);
      groupAppearance.appendChild(themeLabel);

      const groupExport = document.createElement('div');
      groupExport.className = 'group';
      groupExport.innerHTML = '<b>Export</b>';

      const exportCsv = document.createElement('button');
      exportCsv.textContent = 'CSV (filtrat)';
      exportCsv.addEventListener('click', () => {
        const visible = getVisibleProblems();
        downloadText('pbinfo-problems.csv', problemsToCsv(visible), 'text/csv;charset=utf-8');
      });
      groupExport.appendChild(exportCsv);

      const exportJson = document.createElement('button');
      exportJson.textContent = 'JSON (filtrat)';
      exportJson.addEventListener('click', () => {
        const visible = getVisibleProblems();
        const data = visible.map((p) => ({
          id: p.id,
          name: p.name,
          link: p.link,
          status: p.status,
          userScore: p.userScore,
          maxScore: p.maxScore,
          difficulty: p.difficulty,
          postedBy_name: p.postedBy_name,
          postedBy_link: p.postedBy_link,
          author: p.author,
          source: p.source,
        }));
        downloadText(
          'pbinfo-problems.json',
          JSON.stringify(data, null, 2),
          'application/json;charset=utf-8'
        );
      });
      groupExport.appendChild(exportJson);

      const copyLinks = document.createElement('button');
      copyLinks.textContent = 'Copiază link-uri';
      copyLinks.addEventListener('click', async () => {
        const visible = getVisibleProblems();
        const text = problemsToLinksText(visible);
        if (!text) {
          addLog('Nimic de copiat.');
          return;
        }
        try {
          await copyTextToClipboard(text);
          addLog(`Am copiat ${visible.length} link-uri în clipboard.`);
        } catch (err) {
          addLog('<span style="color:#b30000;">Nu am putut copia link-urile în clipboard.</span>');
          console.error(err);
        }
      });
      groupExport.appendChild(copyLinks);

      const copyIds = document.createElement('button');
      copyIds.textContent = 'Copiază ID-uri';
      copyIds.addEventListener('click', async () => {
        const visible = getVisibleProblems();
        const text = problemsToIdsText(visible);
        if (!text) {
          addLog('Nimic de copiat.');
          return;
        }
        try {
          await copyTextToClipboard(text);
          addLog(`Am copiat ${visible.length} ID-uri în clipboard.`);
        } catch (err) {
          addLog('<span style="color:#b30000;">Nu am putut copia ID-urile în clipboard.</span>');
          console.error(err);
        }
      });
      groupExport.appendChild(copyIds);

      const copyMarkdown = document.createElement('button');
      copyMarkdown.textContent = 'Copiază Markdown';
      copyMarkdown.addEventListener('click', async () => {
        const visible = getVisibleProblems();
        const text = problemsToMarkdownText(visible);
        if (!text) {
          addLog('Nimic de copiat.');
          return;
        }
        try {
          await copyTextToClipboard(text);
          addLog(`Am copiat ${visible.length} rânduri Markdown în clipboard.`);
        } catch (err) {
          addLog('<span style="color:#b30000;">Nu am putut copia Markdown în clipboard.</span>');
          console.error(err);
        }
      });
      groupExport.appendChild(copyMarkdown);

      const groupSession = document.createElement('div');
      groupSession.className = 'group';
      groupSession.innerHTML = '<b>Stare (local)</b>';

      const stateSelectLabel = document.createElement('label');
      stateSelectLabel.textContent = 'Stare';
      const stateSelect = document.createElement('select');
      stateSelectLabel.appendChild(stateSelect);
      groupSession.appendChild(stateSelectLabel);

      const saveStateBtn = document.createElement('button');
      saveStateBtn.textContent = 'Snapshot';
      saveStateBtn.addEventListener('click', () => {
        const label = prompt('Etichetă snapshot (opțional):', '');
        if (label === null) return;
        // update "latest" state too (for quick restore)
        saveScanState({ mode: 'minimal', reason: 'manual', silent: true });
        const res = saveSnapshotItem({
          mode: 'full',
          label: normalizeSpace(label),
          reason: 'manual',
        });
        if (!res.ok) {
          addLog('<span style="color:#b30000;">Nu am putut salva snapshot-ul.</span>');
          refreshSessionInfo();
          return;
        }
        addLog(`Snapshot salvat (${res.storageLevel}).`);
        refreshSessionInfo();
      });
      groupSession.appendChild(saveStateBtn);

      const loadStateBtn = document.createElement('button');
      loadStateBtn.textContent = 'Încarcă';
      loadStateBtn.addEventListener('click', () => {
        if (!paused && !finished) {
          addLog(
            '<span style="color:#b35c00;">Pune scanarea pe pauză înainte să încarci o stare.</span>'
          );
          return;
        }
        if (inFlight > 0) {
          addLog(
            '<span style="color:#b35c00;">Așteaptă să se termine request-urile în lucru înainte să încarci o stare.</span>'
          );
          return;
        }
        const ok = confirm('Încarci starea selectată? Rezultatele curente vor fi înlocuite.');
        if (!ok) return;
        const selected = normalizeSpace(stateSelect.value);
        if (selected.startsWith('snapshot:')) {
          const id = selected.slice('snapshot:'.length);
          const state = loadSnapshotItem(id);
          if (!state) {
            addLog('Snapshot inexistent (probabil șters).');
            refreshSessionInfo();
            return;
          }
          restoreFromSavedState(state, state.storageLevel === 'full' ? 'full' : 'minimal');
        } else {
          const loaded = loadSavedStateForLink();
          if (!loaded) {
            addLog('Nu există stare salvată pentru acest link.');
            refreshSessionInfo();
            return;
          }
          restoreFromSavedState(loaded.state, loaded.kind);
        }
        addLog('Stare încărcată.');
        refreshSessionInfo();
      });
      groupSession.appendChild(loadStateBtn);

      const clearStateBtn = document.createElement('button');
      clearStateBtn.textContent = 'Șterge';
      clearStateBtn.addEventListener('click', () => {
        const selected = normalizeSpace(stateSelect.value);
        const ok = confirm(
          selected.startsWith('snapshot:')
            ? 'Ștergi snapshot-ul selectat?'
            : 'Ștergi starea salvată (autosave) pentru acest link?'
        );
        if (!ok) return;
        if (selected.startsWith('snapshot:')) {
          const id = selected.slice('snapshot:'.length);
          deleteSnapshotItem(id);
          addLog('Snapshot șters.');
        } else {
          clearSavedStateForLink();
          addLog('Stare ștearsă.');
        }
        refreshSessionInfo();
      });
      groupSession.appendChild(clearStateBtn);

      const sessionInfo = document.createElement('div');
      sessionInfo.className = 'muted';
      groupSession.appendChild(sessionInfo);

      function refreshSessionInfo() {
        const selectedBefore = normalizeSpace(stateSelect.value);
        stateSelect.replaceChildren();

        const latest = loadSavedStateForLink();
        const snapshots = loadSnapshotIndexForLink();

        const options = [];
        if (latest) {
          const savedAt = latest.state?.savedAt ? formatDateTime(latest.state.savedAt) : '-';
          const level =
            latest.kind === 'full'
              ? 'complet'
              : latest.state?.storageLevel === 'progress'
                ? 'progres'
                : 'compact';
          options.push({
            value: 'autosave',
            label: `Autosave (${level}) · ${savedAt}`,
            state: latest.state,
            kind: latest.kind,
          });
        }
        for (const s of snapshots) {
          const savedAt = s.savedAt != null ? formatDateTime(s.savedAt) : '-';
          const level =
            s.storageLevel === 'full'
              ? 'complet'
              : s.storageLevel === 'progress'
                ? 'progres'
                : 'compact';
          const lbl = normalizeSpace(s.label);
          options.push({
            value: `snapshot:${s.id}`,
            label: `Snapshot (${level}) · ${savedAt}${lbl ? ` · ${lbl}` : ''}`,
            state: null,
            kind: s.storageLevel === 'full' ? 'full' : 'minimal',
          });
        }

        if (options.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '— fără stări salvate —';
          stateSelect.appendChild(opt);
          stateSelect.disabled = true;
          loadStateBtn.disabled = true;
          clearStateBtn.disabled = true;
          sessionInfo.textContent = 'Nicio stare salvată.';
          return;
        }

        stateSelect.disabled = false;
        for (const o of options) {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          stateSelect.appendChild(opt);
        }

        const prefer = options.some((o) => o.value === selectedBefore)
          ? selectedBefore
          : options[0].value;
        stateSelect.value = prefer;

        loadStateBtn.disabled = false;
        clearStateBtn.disabled = false;
        sessionInfo.textContent = `Stări salvate: ${options.length}.`;
      }

      const groupScan = document.createElement('div');
      groupScan.className = 'group';
      groupScan.innerHTML = '<b>Scan</b>';

      pauseButton = document.createElement('button');
      pauseButton.textContent = 'Pauză';
      pauseButton.addEventListener('click', togglePause);
      groupScan.appendChild(pauseButton);

      stopButton = document.createElement('button');
      stopButton.textContent = 'Stop scan';
      stopButton.addEventListener('click', () => stopScan('Oprit de utilizator'));
      groupScan.appendChild(stopButton);

      const scanNote = document.createElement('div');
      scanNote.className = 'muted';
      scanNote.textContent =
        scanMode === 'id-range'
          ? `resume: start ID > ${config.idRange.startId} (curent ${config.startPage}) · interval=${config.idRange.startId}-${config.idRange.endId}`
          : `resume: start page > 1 (curent ${config.startPage}) · maxPages=${config.maxPages}`;
      groupScan.appendChild(scanNote);

      controlsDiv.replaceChildren(
        groupStatus,
        groupScore,
        groupAppearance,
        groupExport,
        groupSession,
        groupScan
      );
      refreshSessionInfo();
    }

    function formatDuration(ms) {
      const s = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`;
      if (m > 0) return `${m}m ${String(ss).padStart(2, '0')}s`;
      return `${ss}s`;
    }

    function updateProgress(inFlight) {
      const elapsedMs = Date.now() - startedAt;
      const scanStart = Math.max(1, Number.isFinite(config.startPage) ? config.startPage : 1);
      const pauseText = paused ? ' · pauză' : '';
      const inflightText = inFlight > 0 ? ` · în lucru ${inFlight}` : '';
      const startText = scanStart > 1 ? ` (de la ${scanStart})` : '';

      if (scanMode === 'id-range') {
        const done = stats.pages;
        const endId = Number.isFinite(config.idRange.endId) ? config.idRange.endId : null;
        const totalIds = endId != null ? Math.max(0, endId - scanStart + 1) : null;
        const idsText = totalIds != null && totalIds > 0 ? `${done}/${totalIds}` : `${done}`;
        const speed = elapsedMs > 0 ? done / (elapsedMs / 1000) : 0;
        const etaMs =
          totalIds != null && totalIds > 0 && speed > 0 ? ((totalIds - done) / speed) * 1000 : null;
        const etaText = etaMs != null ? ` · ETA ~${formatDuration(etaMs)}` : '';
        const missingText = stats.missing > 0 ? ` · 404 ${stats.missing}` : '';
        progressDiv.textContent = `Progres: ID-uri ${idsText}, probleme ${stats.total} (găsite)${missingText} · timp ${formatDuration(
          elapsedMs
        )}${etaText}${pauseText}${inflightText}${startText}`;
        return;
      }

      const pagesDone = stats.pages;
      const scanPagesTotal = Number.isFinite(totalPages)
        ? Math.max(0, totalPages - scanStart + 1)
        : null;
      const pagesText =
        scanPagesTotal != null && scanPagesTotal > 0
          ? `${pagesDone}/${scanPagesTotal}`
          : `${pagesDone}`;
      const scanProblemsTotal =
        Number.isFinite(totalProblems) && Number.isFinite(pageSize)
          ? Math.max(0, totalProblems - pageSize * (scanStart - 1))
          : null;
      const probsText =
        scanProblemsTotal != null && scanProblemsTotal > 0
          ? `${stats.total}/${scanProblemsTotal}`
          : Number.isFinite(totalProblems)
            ? `${stats.total}/${totalProblems}`
            : `${stats.total}`;
      const speed = elapsedMs > 0 ? pagesDone / (elapsedMs / 1000) : 0;
      const etaMs =
        scanPagesTotal != null && scanPagesTotal > 0 && speed > 0
          ? ((scanPagesTotal - pagesDone) / speed) * 1000
          : null;
      const etaText = etaMs != null ? ` · ETA ~${formatDuration(etaMs)}` : '';

      progressDiv.textContent = `Progres: pagini ${pagesText}, probleme ${probsText} · timp ${formatDuration(
        elapsedMs
      )}${etaText}${pauseText}${inflightText}${startText}`;
    }

    setupControls();
    renderResults();
    updateProgress(0);

    function updateTable(visibleProblems) {
      function sortSymbol(t) {
        if (sorted[t] === 1) return '&#9660;';
        if (sorted[t] === -1) return '&#9650;';
        return '&#9654;';
      }
      function numberToDifficulty(n) {
        return n === 0 ? 'ușoară' : n === 1 ? 'medie' : n === 2 ? 'dificilă' : 'concurs';
      }
      function difficultyColor(n) {
        return n === 0 ? '5cb85c' : n === 1 ? 'f0ad4e' : n === 2 ? '5bc0de' : 'd9534f';
      }
      function statusLabel(s) {
        if (s === 'solved') return 'rezolvată';
        if (s === 'tried') return 'încercată';
        return 'neîncercată';
      }
      function statusColor(s) {
        if (s === 'solved') return '5cb85c';
        if (s === 'tried') return 'f0ad4e';
        return '6c757d';
      }

      table.replaceChildren();
      const thead = document.createElement('thead');
      const tbody = document.createElement('tbody');
      table.appendChild(thead);
      table.appendChild(tbody);

      const headerDefs = [
        { key: 'cnt', label: 'Contor', minWidth: '5em' },
        { key: 'id', label: 'Nume', minWidth: '10em' },
        { key: 'score', label: 'Punctaj', minWidth: '5em' },
        { key: 'status', label: 'Stare', minWidth: '7.5em' },
        { key: 'difficulty', label: 'Dificultate', minWidth: '6.5em' },
        { key: 'postedBy_name', label: 'Postată de', minWidth: '13em' },
        { key: 'author', label: 'Autor', minWidth: '10em' },
        { key: 'source', label: 'Sursa problemei', minWidth: '10em' },
      ];

      const headRow = document.createElement('tr');
      for (const h of headerDefs) {
        const th = document.createElement('th');
        th.style.minWidth = h.minWidth;
        th.style.userSelect = 'none';
        const a = document.createElement('a');
        a.href = '#';
        a.innerHTML = `${h.label} ${sortSymbol(h.key)}`;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          sortTable(h.key);
        });
        th.appendChild(a);
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);

      const list = Array.isArray(visibleProblems) ? visibleProblems : getVisibleProblems();
      list.forEach((p, i) => {
        const row = document.createElement('tr');

        const tdCnt = document.createElement('td');
        tdCnt.textContent = `${i + 1}.`;
        row.appendChild(tdCnt);

        const tdName = document.createElement('td');
        const nameA = document.createElement('a');
        nameA.href = p.link;
        nameA.target = '_blank';
        nameA.rel = 'noopener noreferrer';
        nameA.textContent = p.name ? `#${p.id} - ${p.name}` : `#${p.id}`;
        tdName.appendChild(nameA);
        row.appendChild(tdName);

        const tdScore = document.createElement('td');
        tdScore.textContent =
          p.userScore != null && Number.isFinite(p.userScore) ? `${p.userScore}p` : '-';
        row.appendChild(tdScore);

        const tdStatus = document.createElement('td');
        const statusSpan = document.createElement('span');
        statusSpan.className = 'pill';
        statusSpan.style.backgroundColor = `#${statusColor(p.status)}`;
        statusSpan.textContent = statusLabel(p.status);
        tdStatus.appendChild(statusSpan);
        row.appendChild(tdStatus);

        const tdDifficulty = document.createElement('td');
        const diffSpan = document.createElement('span');
        diffSpan.className = 'pill';
        diffSpan.style.backgroundColor = `#${difficultyColor(p.difficulty)}`;
        diffSpan.textContent = numberToDifficulty(p.difficulty);
        tdDifficulty.appendChild(diffSpan);
        row.appendChild(tdDifficulty);

        const tdPostedBy = document.createElement('td');
        if (p.postedBy_link) {
          const pbA = document.createElement('a');
          pbA.href = p.postedBy_link;
          pbA.target = '_blank';
          pbA.rel = 'noopener noreferrer';
          if (p.postedBy_img) {
            const img = document.createElement('img');
            img.style.verticalAlign = 'middle';
            img.style.width = '1.1em';
            img.src = p.postedBy_img;
            img.alt = '';
            pbA.appendChild(img);
            pbA.appendChild(document.createTextNode(' '));
          }
          pbA.appendChild(document.createTextNode(p.postedBy_name || ''));
          tdPostedBy.appendChild(pbA);
        }
        row.appendChild(tdPostedBy);

        const tdAuthor = document.createElement('td');
        tdAuthor.textContent = p.author || '';
        row.appendChild(tdAuthor);

        const tdSource = document.createElement('td');
        tdSource.textContent = p.source || '';
        row.appendChild(tdSource);

        tbody.appendChild(row);
      });
    }

    function finishScan({ complete, reason }) {
      if (finished) return;
      scanEnd = {
        finished: true,
        complete: Boolean(complete),
        reason: reason ? String(reason) : null,
        endedAt: Date.now(),
      };
      finished = true;
      if (pauseButton) pauseButton.disabled = true;
      if (stopButton) stopButton.disabled = true;

      ensureResultsAttached();
      renderResults();

      const unitLabel = scanMode === 'id-range' ? 'ID-uri' : 'pagini';
      const missingSuffix =
        scanMode === 'id-range' && stats.missing > 0 ? `, 404 ${stats.missing}` : '';
      const summary = `Rezumat: ${stats.solved} rezolvate, ${stats.tried} încercate, ${stats.unattempted} neîncercate (total ${stats.total}, ${unitLabel} ${stats.pages}${missingSuffix}).`;
      addLog(summary);

      const unsolvedCount = allProblems.filter((p) => p.status !== 'solved').length;
      if (complete) {
        addLog(
          `<u>Am terminat de extras problemele.</u> Sunt ${unsolvedCount} probleme nerezolvate. Tabelul și lista au fost adăugate mai jos.`
        );
        saveScanState({ mode: 'full', reason: 'complete', silent: true });
        return;
      }

      const reasonText = reason ? ` <span style="color:#b30000;">(${reason})</span>` : '';
      addLog(
        `<span style="color:#b30000;"><u>Scanarea s-a oprit înainte de final.</u></span>${reasonText}`
      );
      saveScanState({ mode: 'full', reason: 'stopped', silent: true });
    }

    // Fetch pages (optional concurrency)
    const maxRetriesPerPage = config.maxRetriesPerPage;
    const pageQueue = [];
    const deferredPageRequests = new Map();
    let nextSequentialPage = null;
    let queueInitialized = false;
    let inFlight = 0;
    let idRangeConsecutiveMissing = 0;
    let idRangeWarnedAboutScore = false;
    const idRangeLogEvery = Math.max(
      50,
      Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_ID_LOG_EVERY))
        ? Number(window.PBINFO_GET_UNSOLVED_ID_LOG_EVERY)
        : 200
    );
    const idRangeScoreCache = new Map();
    const idRangeScoreBatchInFlight = new Set();
    const idRangeScoreBatchFailed = new Set();
    let idRangeWarnedAboutScoreBatch = false;

    const autosaveConfig = {
      enabled: window.PBINFO_GET_UNSOLVED_AUTOSAVE !== false,
      everyPages: Math.max(
        1,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_AUTOSAVE_PAGES))
          ? Number(window.PBINFO_GET_UNSOLVED_AUTOSAVE_PAGES)
          : 50
      ),
      everyMs: Math.max(
        5000,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_AUTOSAVE_MS))
          ? Number(window.PBINFO_GET_UNSOLVED_AUTOSAVE_MS)
          : 120000
      ),
    };
    const snapshotConfig = {
      maxEntries: Math.max(
        1,
        Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_SNAPSHOTS_MAX))
          ? Number(window.PBINFO_GET_UNSOLVED_SNAPSHOTS_MAX)
          : 8
      ),
    };
    let lastAutosaveAt = 0;
    let lastAutosavePages = 0;
    let autosaveDisabled = false;

    function loadSavedStateForLink() {
      const read = (key) => {
        try {
          return safeJsonParse(localStorage.getItem(key));
        } catch {
          return null;
        }
      };
      const full = read(stateKeys.full);
      if (full && full.pageLink === pageLink) return { kind: 'full', state: full };
      const minimal = read(stateKeys.minimal);
      if (minimal && minimal.pageLink === pageLink) return { kind: 'minimal', state: minimal };
      return null;
    }

    function clearSavedStateForLink() {
      try {
        localStorage.removeItem(stateKeys.full);
      } catch {}
      try {
        localStorage.removeItem(stateKeys.minimal);
      } catch {}
    }

    function snapshotItemKey(id) {
      const key = normalizeSpace(id);
      return key ? `${stateKeys.itemPrefix}${key}` : null;
    }

    function normalizeSnapshotIndex(index) {
      const raw = Array.isArray(index) ? index : [];
      const out = [];
      for (const item of raw) {
        const id = normalizeSpace(item?.id);
        if (!id) continue;
        const savedAt = Number(item?.savedAt);
        const storageLevel =
          item?.storageLevel === 'full' ||
          item?.storageLevel === 'minimal' ||
          item?.storageLevel === 'progress'
            ? item.storageLevel
            : 'minimal';
        const label = typeof item?.label === 'string' ? item.label : '';
        out.push({ id, savedAt: Number.isFinite(savedAt) ? savedAt : null, storageLevel, label });
      }
      out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      return out;
    }

    function loadSnapshotIndexForLink() {
      try {
        const v = safeJsonParse(localStorage.getItem(stateKeys.index));
        return normalizeSnapshotIndex(v);
      } catch {
        return [];
      }
    }

    function writeSnapshotIndexForLink(index) {
      try {
        localStorage.setItem(stateKeys.index, JSON.stringify(normalizeSnapshotIndex(index)));
        return true;
      } catch {
        return false;
      }
    }

    function loadSnapshotItem(id) {
      const key = snapshotItemKey(id);
      if (!key) return null;
      try {
        const v = safeJsonParse(localStorage.getItem(key));
        return v && v.pageLink === pageLink ? v : null;
      } catch {
        return null;
      }
    }

    function deleteSnapshotItem(id) {
      const key = snapshotItemKey(id);
      if (!key) return false;
      try {
        localStorage.removeItem(key);
        const idx = loadSnapshotIndexForLink().filter((x) => x.id !== id);
        writeSnapshotIndexForLink(idx);
        return true;
      } catch {
        return false;
      }
    }

    function pruneSnapshotIndex(index) {
      const max = Number.isFinite(snapshotConfig.maxEntries) ? snapshotConfig.maxEntries : 8;
      const list = normalizeSnapshotIndex(index);
      const pruned = [];
      for (const entry of list) {
        const key = snapshotItemKey(entry.id);
        if (!key) continue;
        try {
          if (localStorage.getItem(key) == null) continue;
        } catch {}
        pruned.push(entry);
        if (pruned.length >= max) break;
      }
      const keep = new Set(pruned.map((x) => x.id));
      for (const entry of list) {
        if (keep.has(entry.id)) continue;
        const key = snapshotItemKey(entry.id);
        if (!key) continue;
        try {
          localStorage.removeItem(key);
        } catch {}
      }
      return pruned;
    }

    function saveSnapshotItem({ mode, label, reason } = {}) {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const key = snapshotItemKey(id);
      if (!key) return { ok: false, id: null, storageLevel: null };

      const desired = mode === 'minimal' || mode === 'progress' ? mode : 'full';
      const levels = desired === 'full' ? ['full', 'minimal', 'progress'] : ['minimal', 'progress'];

      for (const level of levels) {
        try {
          const snap = buildStateSnapshot(level, reason || 'snapshot');
          if (label) snap.label = String(label);
          localStorage.setItem(key, JSON.stringify(snap));

          const idx = pruneSnapshotIndex([
            { id, savedAt: snap.savedAt, storageLevel: snap.storageLevel, label: snap.label || '' },
            ...loadSnapshotIndexForLink(),
          ]);
          if (!writeSnapshotIndexForLink(idx)) {
            localStorage.removeItem(key);
            return { ok: false, id: null, storageLevel: null };
          }
          return { ok: true, id, storageLevel: snap.storageLevel };
        } catch {}
      }

      try {
        localStorage.removeItem(key);
      } catch {}
      return { ok: false, id: null, storageLevel: null };
    }

    function serializeFilters() {
      return {
        statuses: Array.from(filterState.statuses),
        includeUnknownScore: Boolean(filterState.includeUnknownScore),
        scoreMin: Number.isFinite(filterState.scoreMin) ? filterState.scoreMin : null,
        scoreMax: Number.isFinite(filterState.scoreMax) ? filterState.scoreMax : null,
      };
    }

    function serializeSorted() {
      return { ...sorted };
    }

    function buildStateSnapshot(level, reason) {
      const now = Date.now();
      const snapshot = {
        version: STATE_STORAGE_VERSION,
        storageLevel: level,
        savedAt: now,
        scanMode,
        idRange: scanMode === 'id-range' ? { ...config.idRange } : null,
        pageLink,
        pagination: { ...config.pagination },
        scanStartPage: config.startPage,
        pageSize: Number.isFinite(pageSize) ? pageSize : null,
        totalProblems: Number.isFinite(totalProblems) ? totalProblems : null,
        totalPages: Number.isFinite(totalPages) ? totalPages : null,
        elapsedMs: now - startedAt,
        stats: { ...stats },
        filters: serializeFilters(),
        sorted: serializeSorted(),
        queueInitialized: Boolean(queueInitialized),
        pageQueue: Array.from(pageQueue),
        deferred: Array.from(deferredPageRequests.entries()),
        nextSequentialPage: Number.isFinite(nextSequentialPage) ? nextSequentialPage : null,
        inFlightPages: Array.from(activePageIndexes),
        paused: Boolean(paused),
        stopRequested: Boolean(stopRequested),
        end: scanEnd,
        reason: reason ? String(reason) : null,
      };

      snapshot.resumeFromPage = computeResumeFromStateSnapshot(snapshot);

      if (level === 'progress') {
        snapshot.seenProblemIds = Array.from(seenProblemIds);
        return snapshot;
      }

      snapshot.problems = allProblems.map((p) => serializeProblemForSnapshot(p, level));
      snapshot.seenProblemIds = Array.from(seenProblemIds);
      return snapshot;
    }

    function saveScanState({ mode, reason, silent } = {}) {
      const desired = mode === 'minimal' || mode === 'progress' ? mode : 'full';
      const write = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
      };

      try {
        if (desired === 'full') {
          const snap = buildStateSnapshot('full', reason);
          write(stateKeys.full, snap);
          try {
            localStorage.removeItem(stateKeys.minimal);
          } catch {}
          return { ok: true, kind: 'full' };
        }
      } catch (err) {
        if (!silent) console.warn('Failed to save full state:', err);
      }

      try {
        const snap = buildStateSnapshot('minimal', reason);
        write(stateKeys.minimal, snap);
        return { ok: true, kind: 'minimal' };
      } catch (err) {
        if (!silent) console.warn('Failed to save minimal state:', err);
      }

      try {
        const snap = buildStateSnapshot('progress', reason);
        write(stateKeys.minimal, snap);
        return { ok: true, kind: 'minimal' };
      } catch (err) {
        if (!silent) console.warn('Failed to save progress state:', err);
        return { ok: false, kind: null };
      }
    }

    function restoreFromSavedState(state, kind) {
      if (!state || state.pageLink !== pageLink) return false;
      restoringState = true;
      try {
        for (const xhr of activeRequests) {
          try {
            xhr.abort();
          } catch {}
        }
        activeRequests.clear();
        activePageIndexes.clear();
        inFlight = 0;

        stopRequested = Boolean(state.stopRequested);
        paused = Boolean(state.paused);
        scanEnd = state.end && typeof state.end === 'object' ? state.end : null;

        if (state.pagination && typeof state.pagination === 'object') {
          if (state.pagination.mode) config.pagination.mode = state.pagination.mode;
          if (state.pagination.param) config.pagination.param = state.pagination.param;
          if (Number.isFinite(state.pagination.pageBase))
            config.pagination.pageBase = state.pagination.pageBase;
        }

        if (scanMode === 'id-range' && state.idRange && typeof state.idRange === 'object') {
          if (Number.isFinite(state.idRange.startId))
            config.idRange.startId = state.idRange.startId;
          if (Number.isFinite(state.idRange.endId)) config.idRange.endId = state.idRange.endId;
          if (Number.isFinite(state.idRange.stopAfterMissing))
            config.idRange.stopAfterMissing = state.idRange.stopAfterMissing;
          if (state.idRange.scoreBatch && typeof state.idRange.scoreBatch === 'object') {
            if (typeof state.idRange.scoreBatch.enabled === 'boolean')
              config.idRange.scoreBatch.enabled = state.idRange.scoreBatch.enabled;
            if (Number.isFinite(state.idRange.scoreBatch.size))
              config.idRange.scoreBatch.size = state.idRange.scoreBatch.size;
          }
        }

        if (Number.isFinite(state.scanStartPage)) config.startPage = state.scanStartPage;

        const elapsed = Number.isFinite(state.elapsedMs) ? state.elapsedMs : null;
        if (elapsed != null && elapsed >= 0) startedAt = Date.now() - elapsed;

        pageSize = Number.isFinite(state.pageSize) ? state.pageSize : pageSize;
        totalProblems = Number.isFinite(state.totalProblems) ? state.totalProblems : totalProblems;
        totalPages = Number.isFinite(state.totalPages) ? state.totalPages : totalPages;

        if (state.stats && typeof state.stats === 'object') {
          stats.solved = Number.isFinite(state.stats.solved) ? state.stats.solved : 0;
          stats.tried = Number.isFinite(state.stats.tried) ? state.stats.tried : 0;
          stats.unattempted = Number.isFinite(state.stats.unattempted)
            ? state.stats.unattempted
            : 0;
          stats.total = Number.isFinite(state.stats.total) ? state.stats.total : 0;
          stats.pages = Number.isFinite(state.stats.pages) ? state.stats.pages : 0;
          stats.missing = Number.isFinite(state.stats.missing) ? state.stats.missing : 0;
        }

        allProblems.length = 0;
        seenProblemIds.clear();

        const restored = restoreProblemsFromSnapshot(state);
        for (const p of restored.allProblems) allProblems.push(p);
        for (const id of restored.seenProblemIds) seenProblemIds.add(id);

        if (state.filters && typeof state.filters === 'object') {
          const statuses = new Set(
            Array.isArray(state.filters.statuses) ? state.filters.statuses : []
          );
          filterState.statuses.clear();
          for (const s of ['solved', 'tried', 'unattempted']) {
            if (statuses.has(s)) filterState.statuses.add(s);
          }
          if (filterState.statuses.size === 0) {
            filterState.statuses.add('tried');
            filterState.statuses.add('unattempted');
          }
          filterState.includeUnknownScore = Boolean(state.filters.includeUnknownScore);
          filterState.scoreMin = Number.isFinite(state.filters.scoreMin)
            ? state.filters.scoreMin
            : null;
          filterState.scoreMax = Number.isFinite(state.filters.scoreMax)
            ? state.filters.scoreMax
            : null;
        }

        if (state.sorted && typeof state.sorted === 'object') {
          for (const k of Object.keys(sorted)) {
            sorted[k] = Number.isFinite(state.sorted[k]) ? state.sorted[k] : 0;
          }
        }

        pageQueue.length = 0;
        deferredPageRequests.clear();
        queueInitialized = Boolean(state.queueInitialized);
        if (Array.isArray(state.pageQueue)) {
          for (const n of state.pageQueue) if (Number.isFinite(n)) pageQueue.push(n);
        }
        if (Array.isArray(state.deferred)) {
          for (const [pageIndex, retryCount] of state.deferred) {
            if (Number.isFinite(pageIndex) && Number.isFinite(retryCount)) {
              deferredPageRequests.set(pageIndex, retryCount);
            }
          }
        }
        nextSequentialPage = Number.isFinite(state.nextSequentialPage)
          ? state.nextSequentialPage
          : null;
        if (nextSequentialPage == null && Number.isFinite(state.resumeFromPage)) {
          nextSequentialPage = state.resumeFromPage;
        }

        if (Array.isArray(state.inFlightPages)) {
          for (const pageIndex of state.inFlightPages) deferPage(pageIndex, 0);
        }

        finished = Boolean(scanEnd?.finished);
        setupControls();

        if (pauseButton) pauseButton.textContent = paused ? 'Continuă' : 'Pauză';
        if (pauseButton) pauseButton.disabled = finished;
        if (stopButton) stopButton.disabled = finished;

        if (allProblems.length > 0) ensureResultsAttached();
        renderResults();
        updateProgress(inFlight);

        if (kind === 'minimal' && state.storageLevel === 'progress') {
          addLog(
            '<span style="color:#b35c00;"><b>Notă:</b> stare salvată doar ca progres; lista completă nu este disponibilă.</span>'
          );
        } else if (kind === 'minimal') {
          addLog(
            '<span style="color:#b35c00;"><b>Notă:</b> stare salvată compact; unele metadate (autor/sursă) pot lipsi.</span>'
          );
        }

        return true;
      } finally {
        restoringState = false;
      }
    }

    function maybeAutoSave(reason) {
      if (!autosaveConfig.enabled || autosaveDisabled) return;
      const now = Date.now();
      if (
        stats.pages - lastAutosavePages < autosaveConfig.everyPages &&
        now - lastAutosaveAt < autosaveConfig.everyMs
      )
        return;
      const res = saveScanState({ mode: 'minimal', reason: reason || 'autosave', silent: true });
      if (!res.ok) {
        autosaveDisabled = true;
        addLog(
          '<span style="color:#b35c00;"><b>Autosave:</b> dezactivat (nu am putut salva în localStorage).</span>'
        );
        return;
      }
      lastAutosaveAt = now;
      lastAutosavePages = stats.pages;
    }

    function schedule(fn) {
      if (config.delayMs > 0) setTimeout(fn, config.delayMs);
      else fn();
    }

    function parseIdRangeScoreValue(raw) {
      const t = normalizeSpace(raw);
      if (!t || t === '-') return { value: null, raw: '-' };
      const n = parseInt(t, 10);
      return Number.isFinite(n) ? { value: n, raw: t } : { value: null, raw: t };
    }

    function idRangeScoreBatchStartForId(id) {
      if (!Number.isFinite(id)) return null;
      const startId = Number.isFinite(config.idRange.startId) ? config.idRange.startId : 1;
      const size = Number.isFinite(config.idRange.scoreBatch?.size)
        ? config.idRange.scoreBatch.size
        : 200;
      if (id < startId || size <= 0) return null;
      return startId + Math.floor((id - startId) / size) * size;
    }

    function fetchIdRangeScoreBatch(batchStart, retryCount = 0) {
      if (finished || stopRequested || restoringState) return;
      if (!config.idRange.scoreBatch?.enabled) return;
      if (!Number.isFinite(batchStart)) return;
      if (idRangeScoreBatchInFlight.has(batchStart) || idRangeScoreBatchFailed.has(batchStart))
        return;
      if (paused) return;

      const size = Number.isFinite(config.idRange.scoreBatch.size)
        ? config.idRange.scoreBatch.size
        : 200;
      const endId = Number.isFinite(config.idRange.endId) ? config.idRange.endId : null;
      if (endId == null) return;

      const ids = [];
      const batchEnd = Math.min(endId, batchStart + size - 1);
      for (let id = batchStart; id <= batchEnd; id++) ids.push(id);

      idRangeScoreBatchInFlight.add(batchStart);
      const xhr = new XMLHttpRequest();
      activeRequests.add(xhr);
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        activeRequests.delete(xhr);
        idRangeScoreBatchInFlight.delete(batchStart);
      };

      const url = new URL(
        '/ajx-module/json-probleme-scor.php',
        location?.origin || 'https://www.pbinfo.ro'
      );
      url.searchParams.set('ids', ids.join(','));

      xhr.open('GET', url.toString());
      xhr.timeout = config.timeoutMs;
      xhr.onload = () => {
        const responseText = xhr.responseText || xhr.response || '';
        if (stopRequested || finished || restoringState) {
          finalize();
          return;
        }

        if (isLikelyPbinfoBlockedHtml(responseText)) {
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            if (!idRangeWarnedAboutScoreBatch) {
              idRangeWarnedAboutScoreBatch = true;
              addLog(
                '<span style="color:#b35c00;"><b>Atenție:</b> am detectat o pagină de verificare (posibil Cloudflare) la request-ul de scoruri (batch). Folosește delay mai mare / concurență mai mică.</span>'
              );
            }
            finalize();
            setTimeout(() => fetchIdRangeScoreBatch(batchStart, retryCount + 1), delay);
            return;
          }
          finalize();
          finishScan({
            complete: false,
            reason:
              'Blocare detectată la fetch-ul de scoruri (batch). Încearcă delay mai mare și/sau concurență mai mică.',
          });
          return;
        }

        if (xhr.status !== 200) {
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            finalize();
            setTimeout(() => fetchIdRangeScoreBatch(batchStart, retryCount + 1), delay);
            return;
          }
          finalize();
          idRangeScoreBatchFailed.add(batchStart);
          addLog(
            `<span style="color:#b35c00;"><b>Score batch:</b> eșuat pentru ${batchStart}-${batchEnd} (status ${xhr.status}); continui fără scoruri batch.</span>`
          );
          schedule(kick);
          return;
        }

        let payload = null;
        try {
          payload = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
        } catch {
          payload = null;
        }

        const data = Array.isArray(payload?.data) ? payload.data : [];
        for (const item of data) {
          const id = parseInt(item?.id_problema, 10);
          if (!Number.isFinite(id)) continue;
          const raw = item?.scor == null ? '-' : String(item.scor);
          const parsed = parseIdRangeScoreValue(raw);
          idRangeScoreCache.set(id, { raw: parsed.raw, value: parsed.value });
        }

        finalize();
        schedule(kick);
      };
      xhr.onabort = () => {
        finalize();
      };
      xhr.ontimeout = () => {
        finalize();
        if (stopRequested || finished || restoringState) return;
        if (retryCount < maxRetriesPerPage) {
          const delay = 1000 * (retryCount + 1);
          setTimeout(() => fetchIdRangeScoreBatch(batchStart, retryCount + 1), delay);
          return;
        }
        idRangeScoreBatchFailed.add(batchStart);
        addLog(
          `<span style="color:#b35c00;"><b>Score batch:</b> timeout pentru batch ${batchStart}-${batchEnd}; continui fără scoruri batch.</span>`
        );
        schedule(kick);
      };
      xhr.onerror = () => {
        finalize();
        if (stopRequested || finished || restoringState) return;
        if (retryCount < maxRetriesPerPage) {
          const delay = 1000 * (retryCount + 1);
          setTimeout(() => fetchIdRangeScoreBatch(batchStart, retryCount + 1), delay);
          return;
        }
        idRangeScoreBatchFailed.add(batchStart);
        addLog(
          `<span style="color:#b35c00;"><b>Score batch:</b> eroare rețea pentru batch ${batchStart}-${batchEnd}; continui fără scoruri batch.</span>`
        );
        schedule(kick);
      };
      xhr.send();
    }

    function getIdRangeScorePrefetchState(id) {
      if (scanMode !== 'id-range') return { cached: null, pending: false, batchStart: null };
      if (!config.idRange.scoreBatch?.enabled)
        return { cached: null, pending: false, batchStart: null };
      const cached = idRangeScoreCache.get(id) || null;
      if (cached) return { cached, pending: false, batchStart: null };
      const batchStart = idRangeScoreBatchStartForId(id);
      if (batchStart == null || idRangeScoreBatchFailed.has(batchStart))
        return { cached: null, pending: false, batchStart };
      if (!idRangeScoreBatchInFlight.has(batchStart)) fetchIdRangeScoreBatch(batchStart, 0);
      return { cached: null, pending: true, batchStart };
    }

    function processIdRangeFromScoreBatch(problemId, cached) {
      const scoreValue = Number.isFinite(cached?.value) ? cached.value : null;
      if (scoreValue == null) return false;

      stats.pages++;
      idRangeConsecutiveMissing = 0;

      const userScore = scoreValue;
      const maxScore = 100;
      const status = userScore >= maxScore ? 'solved' : 'tried';

      if (!seenProblemIds.has(problemId)) {
        seenProblemIds.add(problemId);
        allProblems.push({
          cnt: allProblems.length + 1,
          id: problemId,
          name: '',
          link: new URL(
            `/probleme/${problemId}`,
            location?.origin || 'https://www.pbinfo.ro'
          ).toString(),
          difficulty: 3,
          score: userScore,
          scoreKnown: true,
          userScore,
          maxScore,
          status,
          postedBy_link: '',
          postedBy_name: '',
          postedBy_img: '',
          author: '',
          source: '',
        });

        if (status === 'solved') stats.solved++;
        else stats.tried++;
        stats.total++;
      }

      if (stats.pages > 0 && stats.pages % idRangeLogEvery === 0) {
        addLog(
          `ID ${problemId}: progres (${stats.pages} scanate) · găsite ${stats.total} · 404 ${stats.missing}.`
        );
      }

      maybeAutoSave('id');
      updateProgress(inFlight);
      maybeLiveRender();
      return true;
    }

    function deferPage(pageIndex, retryCount) {
      if (!Number.isFinite(pageIndex)) return;
      const idx = Math.trunc(pageIndex);
      const existing = deferredPageRequests.get(idx);
      const rc = Math.max(0, Number.isFinite(retryCount) ? Math.trunc(retryCount) : 0);
      if (existing == null || rc > existing) deferredPageRequests.set(idx, rc);
    }

    function takeDeferred() {
      if (deferredPageRequests.size === 0) return null;
      let bestPage = null;
      let bestRetry = 0;
      for (const [pageIndex, retryCount] of deferredPageRequests.entries()) {
        if (bestPage == null || pageIndex < bestPage) {
          bestPage = pageIndex;
          bestRetry = retryCount;
        }
      }
      if (bestPage == null) return null;
      deferredPageRequests.delete(bestPage);
      return { pageIndex: bestPage, retryCount: bestRetry };
    }

    function kick() {
      if (finished || paused) return;
      if (inFlight >= config.concurrency) return;

      const deferred = takeDeferred();
      if (deferred) {
        fetchPage(deferred.pageIndex, deferred.retryCount);
        return;
      }

      if (queueInitialized) {
        fetchNext();
        return;
      }

      if (nextSequentialPage != null) {
        const p = nextSequentialPage;
        nextSequentialPage = null;
        fetchPage(p, 0);
      }
    }

    function maybeFinish() {
      if (finished) return;
      if (queueInitialized && pageQueue.length === 0 && inFlight === 0) {
        finishScan({ complete: true });
      }
    }

    function fetchNext() {
      if (finished || paused) return;
      if (inFlight >= config.concurrency) return;
      const next = pageQueue.shift();
      if (next == null) {
        maybeFinish();
        return;
      }
      fetchPage(next, 0);
    }

    function initQueueFromTotalPages() {
      if (queueInitialized) return;
      if (!Number.isFinite(totalPages)) return;
      const startAt = Math.max(1, Number.isFinite(config.startPage) ? config.startPage : 1);
      const cap = scanMode === 'list' && Number.isFinite(config.maxPages) ? config.maxPages : null;
      const cappedTotalPages = cap != null ? Math.min(totalPages, cap) : totalPages;
      if (scanMode === 'list' && cappedTotalPages < totalPages) {
        addLog(
          `<span style="color:#b35c00;"><b>Atenție:</b> totalPages=${totalPages} depășește maxPages=${cap}. Voi scana doar primele ${cappedTotalPages} pagini.</span>`
        );
        totalPages = cappedTotalPages;
      }

      for (let i = startAt + 1; i <= cappedTotalPages; i++) pageQueue.push(i);
      queueInitialized = true;
      const pagesToScan = Math.max(0, cappedTotalPages - startAt + 1);
      const extraWorkers = Math.max(0, Math.min(config.concurrency, pagesToScan) - 1);
      for (let i = 0; i < extraWorkers; i++) kick();
    }

    function fetchPage(pageIndex, retryCount = 0) {
      if (finished || stopRequested) return;
      if (paused) {
        deferPage(pageIndex, retryCount);
        return;
      }
      if (scanMode === 'list' && Number.isFinite(config.maxPages) && pageIndex > config.maxPages) {
        pageQueue.length = 0;
        deferredPageRequests.clear();
        finishScan({
          complete: false,
          reason: `Limita maxPages=${config.maxPages} a fost atinsă (pagina ${pageIndex}).`,
        });
        return;
      }

      if (scanMode === 'id-range') {
        const prefetch = getIdRangeScorePrefetchState(pageIndex);
        if (prefetch.pending) {
          deferPage(pageIndex, retryCount);
          return;
        }
        if (prefetch.cached && Number.isFinite(prefetch.cached.value)) {
          if (processIdRangeFromScoreBatch(pageIndex, prefetch.cached)) {
            schedule(kick);
            return;
          }
        }
      }

      if (inFlight >= config.concurrency) {
        deferPage(pageIndex, retryCount);
        return;
      }
      inFlight++;
      updateProgress(inFlight);
      const xhr = new XMLHttpRequest();
      activeRequests.add(xhr);
      activePageIndexes.add(pageIndex);
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        activeRequests.delete(xhr);
        activePageIndexes.delete(pageIndex);
        inFlight = Math.max(0, inFlight - 1);
        updateProgress(inFlight);
      };
      const effectivePageSize = Number.isFinite(pageSize) ? pageSize : 10;
      const startOffset = scanMode === 'list' ? effectivePageSize * (pageIndex - 1) : null;
      const url =
        scanMode === 'id-range'
          ? new URL(
              `/probleme/${pageIndex}`,
              location?.origin || 'https://www.pbinfo.ro'
            ).toString()
          : buildPageUrl(pageLink, {
              pageIndex,
              pageSize: effectivePageSize,
              mode: config.pagination.mode,
              param: config.pagination.param,
              pageBase: config.pagination.pageBase,
            });
      xhr.open('GET', url);
      xhr.timeout = config.timeoutMs;
      xhr.onload = () => {
        const responseText = xhr.responseText || xhr.response || '';
        if (stopRequested || finished || restoringState) {
          finalize();
          return;
        }
        const unitLabel = scanMode === 'id-range' ? `ID ${pageIndex}` : `pagina ${pageIndex}`;

        if (isLikelyPbinfoBlockedHtml(responseText)) {
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            addLog(
              `Serverul a răspuns cu o pagină de verificare (probabil protecție anti-bot) la ${unitLabel}. Reîncerc în ${delay / 1000}s...`
            );
            finalize();
            setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
            return;
          }
          finalize();
          finishScan({
            complete: false,
            reason: `Blocare detectată la ${unitLabel} (posibil Cloudflare). Încearcă delay mai mare și/sau concurență mai mică.`,
          });
          return;
        }

        if (
          scanMode === 'id-range' &&
          (xhr.status === 404 || isLikelyPbinfoNotFoundHtml(responseText))
        ) {
          stats.pages++;
          stats.missing++;
          idRangeConsecutiveMissing++;
          maybeAutoSave('id');
          if (
            config.idRange.stopAfterMissing > 0 &&
            idRangeConsecutiveMissing >= config.idRange.stopAfterMissing
          ) {
            finalize();
            pageQueue.length = 0;
            deferredPageRequests.clear();
            finishScan({
              complete: false,
              reason: `Am întâlnit ${idRangeConsecutiveMissing} ID-uri consecutive inexistente. Oprire automată (setare PBINFO_GET_UNSOLVED_ID_MISSING_STOP).`,
            });
            return;
          }
          if (stats.pages > 0 && stats.pages % idRangeLogEvery === 0) {
            addLog(
              `ID ${pageIndex}: progres (${stats.pages} scanate) · găsite ${stats.total} · 404 ${stats.missing}.`
            );
          }
          finalize();
          schedule(kick);
          return;
        }

        if (xhr.status !== 200) {
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            addLog(
              `Eroare la ${unitLabel} (status ${xhr.status}). Reîncerc în ${delay / 1000}s...`
            );
            finalize();
            setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
            return;
          }
          finalize();
          finishScan({
            complete: false,
            reason: `Eroare la ${unitLabel} (status ${xhr.status})`,
          });
          return;
        }

        if (/invalid request/i.test(responseText)) {
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            addLog(
              `Serverul a răspuns cu "Invalid request" la ${unitLabel}. Reîncerc în ${delay / 1000}s...`
            );
            finalize();
            setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
            return;
          }
          finalize();
          finishScan({
            complete: false,
            reason: `Serverul a răspuns cu "Invalid request" la ${unitLabel}`,
          });
          return;
        }

        if (scanMode === 'id-range') {
          stats.pages++;
          idRangeConsecutiveMissing = 0;

          const pageEl = document.createElement('div');
          pageEl.innerHTML = responseText;

          const canonicalAttr = pageEl
            .querySelector('link[rel="canonical"]')
            ?.getAttribute?.('href');
          const link =
            canonicalAttr != null
              ? new URL(canonicalAttr, location?.origin || 'https://www.pbinfo.ro').toString()
              : new URL(
                  `/probleme/${pageIndex}`,
                  location?.origin || 'https://www.pbinfo.ro'
                ).toString();

          const meta = extractProblemMetaFromProblemPage(pageEl, pageIndex);
          const scoreInfo = extractScoreInfoFromProblemPage(pageEl);
          const status = classifyProblemStatus(scoreInfo);

          if (!pageEl.querySelector('#scor_utilizator_problema') && !idRangeWarnedAboutScore) {
            idRangeWarnedAboutScore = true;
            addLog(
              `<span style="color:#b35c00;"><b>Atenție:</b> nu pare să fie disponibil punctajul tău pe pagina problemei (lipsește #scor_utilizator_problema). Verifică dacă ești autentificat pe pbinfo.ro.</span>`
            );
          }

          if (!seenProblemIds.has(pageIndex)) {
            seenProblemIds.add(pageIndex);
            const scoreKnown = scoreInfo.userScore != null && Number.isFinite(scoreInfo.userScore);
            const maxScore = Number.isFinite(scoreInfo.maxScore) ? scoreInfo.maxScore : 100;
            const score = scoreKnown ? scoreInfo.userScore : -1;
            allProblems.push({
              cnt: allProblems.length + 1,
              id: pageIndex,
              name: meta.name,
              link,
              difficulty: meta.difficulty,
              score,
              scoreKnown,
              userScore: scoreInfo.userScore,
              maxScore,
              status,
              postedBy_link: meta.postedBy_link,
              postedBy_name: meta.postedBy_name,
              postedBy_img: meta.postedBy_img,
              author: meta.author,
              source: meta.source,
            });

            if (status === 'solved') stats.solved++;
            else if (status === 'tried') stats.tried++;
            else stats.unattempted++;
            stats.total++;

            if (
              shouldDebugDump(pageIndex) &&
              (scoreInfo.candidates.length === 0 || status === 'unattempted')
            ) {
              debugDumped++;
              console.log('pbinfo-get-unsolved debug problem page:', {
                id: pageIndex,
                name: meta.name,
                link,
                scoreInfo: { userScore: scoreInfo.userScore, maxScore: scoreInfo.maxScore },
                candidates: scoreInfo.candidates,
              });
              if (debugIncludeHtml) {
                console.log('pbinfo-get-unsolved debug problem html:', responseText.slice(0, 5000));
              }
            }
          }

          if (stats.pages > 0 && stats.pages % idRangeLogEvery === 0) {
            addLog(
              `ID ${pageIndex}: progres (${stats.pages} scanate) · găsite ${stats.total} · 404 ${stats.missing}.`
            );
          }

          maybeAutoSave('id');
          maybeLiveRender();
          finalize();
          schedule(kick);
          return;
        }

        const pageEl = document.createElement('div');
        pageEl.innerHTML = responseText;
        const cards = pageEl.querySelectorAll('div.card.mb-3');

        if (pageIndex === firstFetchedPageIndex) {
          if (pageSize == null) {
            if (pageIndex === 1 && cards.length > 0) {
              pageSize = cards.length;
              addLog(`Page size detectată automat: ${pageSize}.`);
            } else {
              pageSize = effectivePageSize;
              addLog(
                `Page size implicită: ${pageSize} (pentru resume; setează PBINFO_GET_UNSOLVED_PAGE_SIZE dacă e diferit).`
              );
            }
          }
          if (totalProblems == null) {
            const t = parseTotalProblems(responseText);
            if (Number.isFinite(t)) totalProblems = t;
          }
          if (Number.isFinite(totalProblems) && Number.isFinite(pageSize)) {
            totalPages = Math.ceil(totalProblems / pageSize);
          }
          updateProgress(inFlight);
          if (!queueInitialized && Number.isFinite(totalPages)) {
            addLog(
              `Total detectat: ${totalProblems} probleme · ${totalPages} pagini · pageSize=${pageSize} · startPage=${config.startPage} · concurență=${config.concurrency}.`
            );
            initQueueFromTotalPages();
          }
        }

        if (cards.length === 0) {
          const t = totalProblems ?? parseTotalProblems(responseText);
          if (Number.isFinite(t) && startOffset >= t) {
            finalize();
            if (queueInitialized) {
              pageQueue.length = 0;
              maybeFinish();
              return;
            }
            finishScan({ complete: true });
            return;
          }
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            const hint = Number.isFinite(t) ? `0 probleme, dar total=${t}` : '0 probleme';
            addLog(`Pagina ${pageIndex} pare goală (${hint}). Reîncerc în ${delay / 1000}s...`);
            finalize();
            setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
            return;
          }
          const hint = Number.isFinite(t)
            ? `Pagina ${pageIndex} goală deși totalul este ${t}`
            : `Pagina ${pageIndex} goală`;
          finalize();
          finishScan({ complete: false, reason: hint });
          return;
        }

        stats.pages++;

        let pageSolved = 0;
        let pageTried = 0;
        let pageUnattempted = 0;
        let totalCount = 0;
        let parseFailCount = 0;
        let idFailCount = 0;

        for (let card of cards) {
          const codeEl = card.querySelector('code');
          if (!codeEl) continue;
          const idText = normalizeSpace(codeEl.textContent);
          const idMatch = /(\d+)/.exec(idText);
          const id = idMatch ? parseInt(idMatch[1], 10) : NaN;
          if (!Number.isFinite(id)) {
            idFailCount++;
            if (debugEnabled && debugDumped < debugDumpLimit && !debugIds) {
              debugDumpCard(card, { id: null, name: null, link: null, scoreInfo: null });
            }
            continue;
          }
          if (seenProblemIds.has(id)) continue;
          seenProblemIds.add(id);
          totalCount++;
          // name and link
          let name = '';
          let link = '';
          const nameAnchor = card.querySelector('h5.card-title a');
          if (nameAnchor) {
            name = nameAnchor.innerText.trim();
            link = nameAnchor.href.trim();
          }
          // difficulty
          let difficulty = 3;
          const diffEl = card.querySelector('span[title="Dificultate"]');
          if (diffEl) {
            const txt = diffEl.innerText.trim().toLowerCase();
            if (txt.includes('ușo')) difficulty = 0;
            else if (txt.includes('med')) difficulty = 1;
            else if (txt.includes('dific')) difficulty = 2;
            else difficulty = 3;
          }
          // posted by
          let pbLink = '',
            pbName = '',
            pbImg = '';
          const pbAnchor = card.querySelector('span[title="Postată de"] a');
          if (pbAnchor) {
            pbLink = pbAnchor.href;
            pbName = pbAnchor.innerText.trim();
            const img = pbAnchor.querySelector('img');
            if (img) {
              pbImg = img.src;
              try {
                const host = new URL(pbImg).hostname;
                if (host === 'www.gravatar.com') pbImg = pbImg.replace(/&s=\d+/i, '&s=128');
                else if (host === 'www.pbinfo.ro')
                  pbImg = pbImg.replace(/&gsize=\d+/i, '&gsize=128');
              } catch {}
            }
          }
          // author
          let author = '';
          const authorSpan = card.querySelector('span[title="Autor"]');
          if (authorSpan) author = normalizeSpace(authorSpan.textContent);
          // source
          let source = '';
          const srcBlock = card.querySelector('blockquote[title="Sursa problemei"]');
          if (srcBlock) source = srcBlock.innerText.trim();
          const scoreInfo = extractScoreInfoFromCard(card);
          const status = classifyProblemStatus(scoreInfo);

          if (scoreInfo.candidates.length === 0) parseFailCount++;
          if (status === 'solved') {
            pageSolved++;
            stats.solved++;
          } else if (status === 'tried') {
            pageTried++;
            stats.tried++;
          } else {
            pageUnattempted++;
            stats.unattempted++;
          }
          stats.total++;

          const scoreKnown = scoreInfo.userScore != null && Number.isFinite(scoreInfo.userScore);
          const maxScore = Number.isFinite(scoreInfo.maxScore) ? scoreInfo.maxScore : 100;
          const score = scoreKnown ? scoreInfo.userScore : -1;
          allProblems.push({
            cnt: allProblems.length + 1,
            id,
            name,
            link,
            difficulty,
            score,
            scoreKnown,
            userScore: scoreInfo.userScore,
            maxScore,
            status,
            postedBy_link: pbLink,
            postedBy_name: pbName,
            postedBy_img: pbImg,
            author,
            source,
          });

          if (
            shouldDebugDump(id) &&
            (scoreInfo.candidates.length === 0 || status === 'unattempted')
          ) {
            debugDumpCard(card, { id, name, link, scoreInfo });
          }
        }

        const scoreUnavailable = pageUnattempted === totalCount;
        const scoreWarning = scoreUnavailable ? ' (punctaj indisponibil pentru toate)' : '';
        const parseFailSuffix = parseFailCount > 0 ? ` · parseFail=${parseFailCount}` : '';
        const idFailSuffix = idFailCount > 0 ? ` · idFail=${idFailCount}` : '';
        addLog(
          `Pagina ${pageIndex}: rezolvate ${pageSolved}, încercate ${pageTried}, neîncercate ${pageUnattempted} (total ${totalCount})${scoreWarning}${parseFailSuffix}${idFailSuffix}.`
        );
        if (pageIndex === firstFetchedPageIndex && totalCount > 0 && scoreUnavailable) {
          addLog(
            `<span style="color:#b35c00;"><b>Atenție:</b> nu pare să fie disponibil punctajul tău pe această listă. Verifică dacă ești autentificat pe pbinfo.ro.</span>`
          );
        }

        maybeLiveRender();
        maybeAutoSave('page');
        finalize();
        if (queueInitialized) {
          schedule(kick);
          return;
        }
        nextSequentialPage = pageIndex + 1;
        schedule(kick);
      };
      xhr.onabort = () => {
        finalize();
        if (stopRequested || finished || restoringState) return;
        const unitLabel = scanMode === 'id-range' ? `ID ${pageIndex}` : `pagina ${pageIndex}`;
        finishScan({ complete: false, reason: `Request abort la ${unitLabel}` });
      };
      xhr.ontimeout = () => {
        finalize();
        if (stopRequested || finished || restoringState) return;
        if (retryCount < maxRetriesPerPage) {
          const delay = 1000 * (retryCount + 1);
          const unitLabel = scanMode === 'id-range' ? `ID ${pageIndex}` : `pagina ${pageIndex}`;
          addLog(`Timeout la ${unitLabel}. Reîncerc în ${delay / 1000}s...`);
          setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
          return;
        }
        const unitLabel = scanMode === 'id-range' ? `ID ${pageIndex}` : `pagina ${pageIndex}`;
        finishScan({ complete: false, reason: `Timeout la ${unitLabel}` });
      };
      xhr.onerror = () => {
        finalize();
        if (stopRequested || finished || restoringState) return;
        if (retryCount < maxRetriesPerPage) {
          const delay = 1000 * (retryCount + 1);
          const unitLabel = scanMode === 'id-range' ? `ID ${pageIndex}` : `pagina ${pageIndex}`;
          addLog(`Eroare de rețea la ${unitLabel}. Reîncerc în ${delay / 1000}s...`);
          setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
          return;
        }
        const unitLabel = scanMode === 'id-range' ? `ID ${pageIndex}` : `pagina ${pageIndex}`;
        finishScan({ complete: false, reason: `Eroare de rețea la ${unitLabel}` });
      };
      xhr.send();
    }

    if (pendingRestore) {
      restoreFromSavedState(pendingRestore, restoreMode);
      pendingRestore = null;
      restoreMode = null;
      if (!finished && !stopRequested && !paused) {
        for (let i = 0; i < config.concurrency; i++) schedule(kick);
      }
    } else {
      if (scanMode === 'id-range') {
        const startId = Math.max(1, Number.isFinite(config.startPage) ? config.startPage : 1);
        const endId = Number.isFinite(config.idRange.endId) ? config.idRange.endId : null;
        if (endId != null && endId >= startId) {
          const totalIds = endId - startId + 1;
          addLog(`Voi scana ID-uri: ${startId}-${endId} (${totalIds} request-uri).`);
        }
        if (config.delayMs === 0 && config.concurrency > 1) {
          addLog(
            '<span style="color:#b35c00;"><b>Recomandare:</b> pentru scanare pe ID-uri, setează PBINFO_GET_UNSOLVED_DELAY_MS (ex: 150) și concurență mică (1-2), ca să eviți blocarea.</span>'
          );
        }
        initQueueFromTotalPages();
      }
      fetchPage(config.startPage, 0);
    }
  })();
}
