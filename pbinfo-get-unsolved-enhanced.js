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

  const isMaxCand = (c) =>
    maxHints.some(
      (h) => normalizeForMatch(c.tooltip).includes(h) || normalizeForMatch(c.text).includes(h)
    );
  const isUserCand = (c) =>
    userHints.some(
      (h) => normalizeForMatch(c.tooltip).includes(h) || normalizeForMatch(c.text).includes(h)
    );

  let maxScore = null;
  for (const c of candidates) {
    if (isMaxCand(c) && Number.isFinite(c.value)) {
      maxScore = c.value;
      break;
    }
  }

  const nonMaxCandidates = candidates.filter((c) => !isMaxCand(c));
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
      if (!/\bp\b/i.test(text) && !parsed.hasRatio) continue;
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

function classifyProblemStatus(scoreInfo) {
  const maxPoints = Number.isFinite(scoreInfo?.maxScore) ? scoreInfo.maxScore : 100;
  if (scoreInfo?.userScore == null) return 'unattempted';
  if (scoreInfo.userScore >= maxPoints) return 'solved';
  return 'tried';
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
      const label = id != null ? `#${id} - ${name}` : name;
      return `- [${label}](<${link}>)`;
    })
    .filter(Boolean)
    .join('\n');
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
      classifyProblemStatus,
      parseTotalProblems,
      normalizeListUrl,
      buildPageUrl,
      problemsToCsv,
      problemsToLinksText,
      problemsToIdsText,
      problemsToMarkdownText,
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

    const config = {
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

    const defaultLink = location?.href || '';
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
    const pageLink = normalizeListUrl(
      pageLinkInput || defaultLink,
      defaultLink,
      config.pagination.param
    );
    if (!pageLink) {
      console.warn('Link invalid. Scriptul a fost oprit.');
      return;
    }

    let startPageInput = prompt(
      'De la ce pagină să încep scanarea?\n' +
        '1 = de la început. Pentru resume, pune un număr mai mare.\n' +
        'Enter = valoarea default.',
      String(config.startPage)
    );
    if (startPageInput === null) {
      console.warn('Nu a fost furnizat start page. Scriptul a fost oprit.');
      return;
    }
    startPageInput = normalizeSpace(startPageInput);
    const startPage = startPageInput === '' ? config.startPage : parseInt(startPageInput, 10);
    if (!Number.isFinite(startPage) || startPage < 1) {
      console.warn('Start page invalid. Scriptul a fost oprit.');
      return;
    }
    config.startPage = startPage;
    const firstFetchedPageIndex = config.startPage;

    // wipe the page and setup UI
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    const title = document.createElement('h2');
    title.style.display = 'block';
    title.innerHTML = '<span style="color: red"> pbinfo-get-unsolved-enhanced.js</span>.';
    document.body.appendChild(title);

    const style = document.createElement('style');
    style.innerHTML = `
        :root{
            font-family: Arial, sans-serif;
            color-scheme: light dark;
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
        }
        @media (prefers-color-scheme: dark){
            :root{
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
        body{margin:0;padding:0.9rem;background:var(--bg);color:var(--text);}
        a{color:var(--link);text-decoration:none;}
        a:hover{cursor:pointer;text-decoration:underline;}
        #log span{line-height:1.35;}
        #controls{margin:0.75em 0 0.5em;display:flex;flex-wrap:wrap;gap:0.75em;align-items:flex-end;}
        #controls .group{display:flex;flex-direction:column;gap:0.25em;min-width:12em;padding:0.5em;border:1px solid var(--border);border-radius:0.5em;background:var(--panel);}
        #controls label{display:flex;gap:0.4em;align-items:center;user-select:none;}
        #controls input[type="checkbox"]{accent-color:var(--link);}
        #controls input[type="number"]{width:8em;border:1px solid var(--border);border-radius:0.45em;padding:0.2em 0.35em;background:var(--bg);color:var(--text);}
        #controls button{padding:0.35em 0.65em;border:1px solid var(--border);border-radius:0.45em;background:transparent;color:var(--text);}
        #controls button:hover{background:var(--btn-hover);}
        #controls button:disabled{opacity:0.55;cursor:not-allowed;}
        #progress{margin:0.4em 0 0.2em;color:var(--muted);}
        #summary{margin:0.5em 0;color:var(--text);}
        .pill{display:inline-block;padding:0.1em 0.4em;border-radius:0.4em;color:white;}
        .muted{color:var(--muted);}
        table{border-collapse:collapse;margin-top:0.75em;}
        th,td{border:1px solid var(--border);padding:0.25em 0.4em;vertical-align:top;}
        thead th{position:sticky;top:0;background:var(--table-header-bg);z-index:2;}
        thead th a{display:inline-flex;gap:0.25em;align-items:center;}
        tbody tr:nth-child(even){background:var(--table-row-alt);}
        tbody tr:hover{background:var(--table-row-hover);}
    `;
    document.head.appendChild(style);

    const logDiv = document.createElement('div');
    logDiv.id = 'log';
    document.body.appendChild(logDiv);

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
      window.scroll(0, logDiv.scrollHeight);
    }

    addLog('Link către lista de probleme: <a href="' + pageLink + '"><i>' + pageLink + '</i></a>');
    addLog(`Start page: <b>${config.startPage}</b>.`);

    const progressDiv = document.createElement('div');
    progressDiv.id = 'progress';
    document.body.appendChild(progressDiv);

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'controls';
    document.body.appendChild(controlsDiv);

    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'summary';
    document.body.appendChild(summaryDiv);

    let pageSize = config.pageSize;
    let totalProblems = null;
    let totalPages = null;
    const startedAt = Date.now();

    const stats = { solved: 0, tried: 0, unattempted: 0, total: 0, pages: 0 };
    let finished = false;
    let stopRequested = false;
    let paused = false;
    let stopButton = null;
    let pauseButton = null;
    const activeRequests = new Set();

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
          ` scanate=${total} · nerezolvate=${unsolved} · afișate=${shown} · pagini=${stats.pages}`
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
          a.textContent = `#${p.id} - ${p.name}`;
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

    function downloadText(filename, content, mime) {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
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
      minInput.addEventListener('input', () => {
        const v = Number(minInput.value);
        filterState.scoreMin = Number.isFinite(v) && minInput.value !== '' ? v : null;
        renderResults();
      });
      minLabel.appendChild(minInput);
      groupScore.appendChild(minLabel);

      const maxLabel = document.createElement('label');
      maxLabel.textContent = 'Max';
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.min = '0';
      maxInput.placeholder = '-';
      maxInput.addEventListener('input', () => {
        const v = Number(maxInput.value);
        filterState.scoreMax = Number.isFinite(v) && maxInput.value !== '' ? v : null;
        renderResults();
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
      scanNote.textContent = `resume: start page > 1 (curent ${config.startPage}) · maxPages=${config.maxPages}`;
      groupScan.appendChild(scanNote);

      controlsDiv.replaceChildren(groupStatus, groupScore, groupExport, groupScan);
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
      const pagesDone = stats.pages;
      const scanStart = Math.max(1, Number.isFinite(config.startPage) ? config.startPage : 1);
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
      const pauseText = paused ? ' · pauză' : '';
      const inflightText = inFlight > 0 ? ` · în lucru ${inFlight}` : '';
      const startText = scanStart > 1 ? ` (de la ${scanStart})` : '';
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
        nameA.textContent = `#${p.id} - ${p.name}`;
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
      finished = true;
      if (pauseButton) pauseButton.disabled = true;
      if (stopButton) stopButton.disabled = true;

      document.body.appendChild(table);
      document.body.appendChild(listDiv);
      renderResults();

      const summary = `Rezumat: ${stats.solved} rezolvate, ${stats.tried} încercate, ${stats.unattempted} neîncercate (total ${stats.total}, pagini ${stats.pages}).`;
      addLog(summary);

      const unsolvedCount = allProblems.filter((p) => p.status !== 'solved').length;
      if (complete) {
        addLog(
          `<u>Am terminat de extras problemele.</u> Sunt ${unsolvedCount} probleme nerezolvate. Tabelul și lista au fost adăugate mai jos.`
        );
        return;
      }

      const reasonText = reason ? ` <span style="color:#b30000;">(${reason})</span>` : '';
      addLog(
        `<span style="color:#b30000;"><u>Scanarea s-a oprit înainte de final.</u></span>${reasonText}`
      );
    }

    // Fetch pages (optional concurrency)
    const maxRetriesPerPage = config.maxRetriesPerPage;
    const pageQueue = [];
    const deferredPageRequests = new Map();
    let nextSequentialPage = null;
    let queueInitialized = false;
    let inFlight = 0;

    function schedule(fn) {
      if (config.delayMs > 0) setTimeout(fn, config.delayMs);
      else fn();
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
      const cap = Number.isFinite(config.maxPages) ? config.maxPages : null;
      const cappedTotalPages = cap != null ? Math.min(totalPages, cap) : totalPages;
      if (cappedTotalPages < totalPages) {
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
      if (Number.isFinite(config.maxPages) && pageIndex > config.maxPages) {
        pageQueue.length = 0;
        deferredPageRequests.clear();
        finishScan({
          complete: false,
          reason: `Limita maxPages=${config.maxPages} a fost atinsă (pagina ${pageIndex}).`,
        });
        return;
      }
      if (inFlight >= config.concurrency) {
        deferPage(pageIndex, retryCount);
        return;
      }
      inFlight++;
      updateProgress(inFlight);
      const xhr = new XMLHttpRequest();
      activeRequests.add(xhr);
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        activeRequests.delete(xhr);
        inFlight = Math.max(0, inFlight - 1);
        updateProgress(inFlight);
      };
      const effectivePageSize = Number.isFinite(pageSize) ? pageSize : 10;
      const startOffset = effectivePageSize * (pageIndex - 1);
      const url = buildPageUrl(pageLink, {
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
        if (xhr.status !== 200) {
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            addLog(
              `Eroare la pagina ${pageIndex} (status ${xhr.status}). Reîncerc în ${delay / 1000}s...`
            );
            finalize();
            setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
            return;
          }
          finalize();
          finishScan({
            complete: false,
            reason: `Eroare la pagina ${pageIndex} (status ${xhr.status})`,
          });
          return;
        }

        if (/invalid request/i.test(responseText)) {
          if (retryCount < maxRetriesPerPage) {
            const delay = 1000 * (retryCount + 1);
            addLog(
              `Serverul a răspuns cu "Invalid request" la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`
            );
            finalize();
            setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
            return;
          }
          finalize();
          finishScan({
            complete: false,
            reason: `Serverul a răspuns cu "Invalid request" la pagina ${pageIndex}`,
          });
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

        for (let card of cards) {
          const codeEl = card.querySelector('code');
          if (!codeEl) continue;
          const id = parseInt(codeEl.innerText.trim().slice(1));
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
          if (authorSpan) author = authorSpan.innerText.replace(/^[\s\S]*?\s/, '').trim();
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
        addLog(
          `Pagina ${pageIndex}: rezolvate ${pageSolved}, încercate ${pageTried}, neîncercate ${pageUnattempted} (total ${totalCount})${scoreWarning}${parseFailSuffix}.`
        );
        if (pageIndex === firstFetchedPageIndex && totalCount > 0 && scoreUnavailable) {
          addLog(
            `<span style="color:#b35c00;"><b>Atenție:</b> nu pare să fie disponibil punctajul tău pe această listă. Verifică dacă ești autentificat pe pbinfo.ro.</span>`
          );
        }

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
        if (stopRequested || finished) return;
        finishScan({ complete: false, reason: `Request abort la pagina ${pageIndex}` });
      };
      xhr.ontimeout = () => {
        finalize();
        if (retryCount < maxRetriesPerPage) {
          const delay = 1000 * (retryCount + 1);
          addLog(`Timeout la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
          setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
          return;
        }
        finishScan({ complete: false, reason: `Timeout la pagina ${pageIndex}` });
      };
      xhr.onerror = () => {
        finalize();
        if (stopRequested || finished) return;
        if (retryCount < maxRetriesPerPage) {
          const delay = 1000 * (retryCount + 1);
          addLog(`Eroare de rețea la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
          setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
          return;
        }
        finishScan({ complete: false, reason: `Eroare de rețea la pagina ${pageIndex}` });
      };
      xhr.send();
    }

    fetchPage(config.startPage, 0);
  })();
}
