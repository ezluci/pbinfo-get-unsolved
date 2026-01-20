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

    const isMaxCand = (c) => maxHints.some(h => normalizeForMatch(c.tooltip).includes(h) || normalizeForMatch(c.text).includes(h));
    const isUserCand = (c) => userHints.some(h => normalizeForMatch(c.tooltip).includes(h) || normalizeForMatch(c.text).includes(h));

    let maxScore = null;
    for (const c of candidates) {
        if (isMaxCand(c) && Number.isFinite(c.value)) {
            maxScore = c.value;
            break;
        }
    }

    const nonMaxCandidates = candidates.filter(c => !isMaxCand(c));
    if (nonMaxCandidates.length === 0) {
        return { userScore: null, maxScore };
    }

    const ranked = nonMaxCandidates
        .map(c => {
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

    const tooltipEls = Array.from(card.querySelectorAll('[title],[data-bs-title],[data-bs-original-title],[data-original-title]'));
    for (const el of tooltipEls) {
        const tooltip = normalizeForMatch(getTooltipText(el));
        if (!tooltip) continue;
        if (!tooltip.includes('punctaj') && !tooltip.includes('scor') && !tooltip.includes('score')) continue;

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
        const badgeEls = Array.from(card.querySelectorAll('span.badge, a.badge, div.badge'))
            .filter(el => !normalizeSpace(el.textContent).startsWith('#'));
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

    // prompt for link
    let pageLink = prompt('Pune un link către lista de probleme de unde vrei să obții problemele nerezolvate.\n' +
        'Mergi la o clasă/categorie sau la pagina generală a problemelor și copiază link-ul aici.');
    if (!pageLink) {
        console.warn('Nu a fost furnizat niciun link. Scriptul a fost oprit.');
        return;
    }
    // strip existing start parameter
    pageLink = pageLink.replace(/([?&])start=\d+/g, '');

    // wipe the page and setup UI
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    const title = document.createElement('h2');
    title.style.display = 'block';
    title.innerHTML = '<span style="color: red"> pbinfo-get-unsolved-enhanced.js</span>.';
    document.body.appendChild(title);

    const style = document.createElement('style');
    style.innerHTML = `a:hover{cursor:pointer;} td{border:1px solid black;}`;
    document.head.appendChild(style);

    const logDiv = document.createElement('div');
    logDiv.id = 'log';
    document.body.appendChild(logDiv);

    function addLog(msg) {
        const d = new Date();
        const span = document.createElement('span');
        span.innerHTML = '<b>[' + d.getHours().toString().padStart(2, '0') + ':' +
            d.getMinutes().toString().padStart(2, '0') + ':' + d.getSeconds().toString().padStart(2, '0') + '] - </b>' + msg;
        span.style.display = 'block';
        logDiv.appendChild(span);
        window.scroll(0, logDiv.scrollHeight);
    }

    addLog('Link către lista de probleme: <a href="' + pageLink + '"><i>' + pageLink + '</i></a>');

    const pageSize = 10;
    const stats = { solved: 0, tried: 0, unattempted: 0, total: 0, pages: 0 };
    let finished = false;

    const debugEnabled = Boolean(window.PBINFO_GET_UNSOLVED_DEBUG);
    const debugDumpLimit = Number.isFinite(Number(window.PBINFO_GET_UNSOLVED_DEBUG_LIMIT))
        ? Number(window.PBINFO_GET_UNSOLVED_DEBUG_LIMIT)
        : 20;
    const debugIncludeHtml = Boolean(window.PBINFO_GET_UNSOLVED_DEBUG_HTML);
    const debugIds = Array.isArray(window.PBINFO_GET_UNSOLVED_DEBUG_IDS)
        ? new Set(window.PBINFO_GET_UNSOLVED_DEBUG_IDS.map(n => parseInt(n, 10)).filter(Number.isFinite))
        : null;
    let debugDumped = 0;

    if (debugEnabled) {
        addLog(`<span style="color:#b35c00;"><b>Debug:</b> activ (limită dump=${debugDumpLimit}${debugIds ? `, ids=${Array.from(debugIds).join(',')}` : ''}).</span>`);
    }

    function shouldDebugDump(id) {
        if (!debugEnabled) return false;
        if (debugDumped >= debugDumpLimit) return false;
        if (debugIds && !debugIds.has(id)) return false;
        return true;
    }

    function debugDumpCard(card, meta) {
        debugDumped++;

        const tooltipEls = Array.from(card.querySelectorAll('[title],[data-bs-title],[data-bs-original-title],[data-original-title]'));
        const tooltips = tooltipEls
            .map(el => ({
                tag: el.tagName,
                tooltip: getTooltipText(el),
                text: normalizeSpace(el.textContent),
            }))
            .filter(x => x.tooltip || x.text);

        const badges = Array.from(card.querySelectorAll('.badge'))
            .map(el => normalizeSpace(el.textContent))
            .filter(Boolean);

        const candidates = (meta.scoreInfo?.candidates || []).map(c => ({
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

    const reqPageEl = document.createElement('div');
    reqPageEl.style.display = 'none';
    document.body.appendChild(reqPageEl);

    const problems = [];
    const seenProblemIds = new Set();
    const sorted = { cnt: 1, id: 0, score: 0, status: 0, difficulty: 0, postedBy_name: 0, author: 0, source: 0 };
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
            Object.keys(sorted).forEach(k => sorted[k] = 0);
            sorted[type] = 1;
        } else {
            sorted[type] *= -1;
        }
        quickSort(problems, 0, problems.length - 1, type);
        if (sorted[type] === -1) problems.reverse();
        updateTable();
    }

    function updateTable() {
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
        table.innerHTML = `<tr style="font-weight:bold;">
            <td style="min-width:5em;user-select:none;"><a onclick="sortTable('cnt')">Contor ${sortSymbol('cnt')}</a></td>
            <td style="min-width:10em;user-select:none;"><a onclick="sortTable('id')">Nume ${sortSymbol('id')}</a></td>
            <td style="min-width:5em;user-select:none;"><a onclick="sortTable('score')">Punctaj ${sortSymbol('score')}</a></td>
            <td style="min-width:7.5em;user-select:none;"><a onclick="sortTable('status')">Stare ${sortSymbol('status')}</a></td>
            <td style="min-width:6.5em;user-select:none;"><a onclick="sortTable('difficulty')">Dificultate ${sortSymbol('difficulty')}</a></td>
            <td style="min-width:13em;user-select:none;"><a onclick="sortTable('postedBy_name')">Postată de ${sortSymbol('postedBy_name')}</a></td>
            <td style="min-width:10em;user-select:none;"><a onclick="sortTable('author')">Autor ${sortSymbol('author')}</a></td>
            <td style="min-width:10em;user-select:none;"><a onclick="sortTable('source')">Sursa problemei ${sortSymbol('source')}</a></td>
        </tr>`;
        problems.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${p.cnt}.</td>
                <td><a href="${p.link}" target="_blank">#${p.id} - ${p.name}</a></td>
                <td>${p.scoreKnown ? `${p.score}p` : '-'}</td>
                <td><span style="color:white;background-color:#${statusColor(p.status)};">${statusLabel(p.status)}</span></td>
                <td><span style="color:white;background-color:#${difficultyColor(p.difficulty)};">${numberToDifficulty(p.difficulty)}</span></td>
                <td><a target="_blank" href="${p.postedBy_link}"><img style="vertical-align:middle;width:1.1em;" src="${p.postedBy_img}"> ${p.postedBy_name}</a></td>
                <td>${p.author}</td>
                <td>${p.source}</td>`;
            table.appendChild(row);
        });
    }

    function finishScan({ complete, reason }) {
        if (finished) return;
        finished = true;

        updateTable();
        document.body.appendChild(table);

        const tried = problems.filter(p => p.status === 'tried');
        const unattempted = problems.filter(p => p.status === 'unattempted');

        const listDiv = document.createElement('div');
        listDiv.style.marginTop = '1em';
        listDiv.innerHTML = `<h3>Lista problemelor nerezolvate:</h3>
            <div style="margin-bottom:0.5em;">
                Încercate: <b>${tried.length}</b> · Neîncercate: <b>${unattempted.length}</b>
            </div>`;

        function appendList(titleText, items) {
            if (items.length === 0) return;
            const h = document.createElement('h4');
            h.textContent = titleText;
            h.style.margin = '0.75em 0 0.25em';
            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.paddingLeft = '0';
            items.forEach(p => {
                const li = document.createElement('li');
                li.style.marginBottom = '0.25em';
                li.innerHTML = `<a href="${p.link}" target="_blank">#${p.id} - ${p.name}</a>`;
                ul.appendChild(li);
            });
            listDiv.appendChild(h);
            listDiv.appendChild(ul);
        }

        appendList('Încercate (punctaj < maxim)', tried);
        appendList('Neîncercate (punctaj indisponibil)', unattempted);

        if (tried.length + unattempted.length > 0) {
            document.body.appendChild(listDiv);
        }

        const summary = `Rezumat: ${stats.solved} rezolvate, ${stats.tried} încercate, ${stats.unattempted} neîncercate (total ${stats.total}, pagini ${stats.pages}).`;
        addLog(summary);

        if (complete) {
            addLog(`<u>Am terminat de extras problemele.</u> Sunt ${problems.length} probleme nerezolvate. Tabelul și lista au fost adăugate mai jos.`);
            return;
        }

        const reasonText = reason ? ` <span style="color:#b30000;">(${reason})</span>` : '';
        addLog(`<span style="color:#b30000;"><u>Scanarea s-a oprit înainte de final.</u></span>${reasonText}`);
    }

    // Fetch pages recursively
    const maxRetriesPerPage = 3;
    (function fetchPage(pageIndex, retryCount = 0) {
        if (finished) return;
        const xhr = new XMLHttpRequest();
        const startOffset = pageSize * (pageIndex - 1);
        const url = pageLink + (pageLink.includes('?') ? '&' : '?') + 'start=' + startOffset;
        xhr.open('GET', url);
        xhr.timeout = 30000;
        xhr.onload = () => {
            const responseText = xhr.responseText || xhr.response || '';
            if (xhr.status !== 200) {
                if (retryCount < maxRetriesPerPage) {
                    const delay = 1000 * (retryCount + 1);
                    addLog(`Eroare la pagina ${pageIndex} (status ${xhr.status}). Reîncerc în ${delay / 1000}s...`);
                    setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                    return;
                }
                finishScan({ complete: false, reason: `Eroare la pagina ${pageIndex} (status ${xhr.status})` });
                return;
            }

            if (/invalid request/i.test(responseText)) {
                if (retryCount < maxRetriesPerPage) {
                    const delay = 1000 * (retryCount + 1);
                    addLog(`Serverul a răspuns cu "Invalid request" la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
                    setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                    return;
                }
                finishScan({ complete: false, reason: `Serverul a răspuns cu "Invalid request" la pagina ${pageIndex}` });
                return;
            }

            reqPageEl.innerHTML = responseText;
            const cards = reqPageEl.querySelectorAll('div.card.mb-3');

            if (cards.length === 0) {
                const totalProblems = parseTotalProblems(responseText);
                if (Number.isFinite(totalProblems) && startOffset >= totalProblems) {
                    finishScan({ complete: true });
                    return;
                }
                if (retryCount < maxRetriesPerPage) {
                    const delay = 1000 * (retryCount + 1);
                    const hint = Number.isFinite(totalProblems)
                        ? `0 probleme, dar total=${totalProblems}`
                        : '0 probleme';
                    addLog(`Pagina ${pageIndex} pare goală (${hint}). Reîncerc în ${delay / 1000}s...`);
                    setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                    return;
                }
                const hint = Number.isFinite(totalProblems)
                    ? `Pagina ${pageIndex} goală deși totalul este ${totalProblems}`
                    : `Pagina ${pageIndex} goală`;
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
                let pbLink = '', pbName = '', pbImg = '';
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
                            else if (host === 'www.pbinfo.ro') pbImg = pbImg.replace(/&gsize=\d+/i, '&gsize=128');
                        } catch (e) {}
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

                if (status !== 'solved') {
                    const scoreKnown = scoreInfo.userScore != null && Number.isFinite(scoreInfo.userScore);
                    const score = scoreKnown ? scoreInfo.userScore : 0;
                    problems.push({
                        cnt: problems.length + 1,
                        id,
                        name,
                        link,
                        difficulty,
                        score,
                        scoreKnown,
                        status,
                        postedBy_link: pbLink,
                        postedBy_name: pbName,
                        postedBy_img: pbImg,
                        author,
                        source,
                    });
                }

                if (shouldDebugDump(id) && (scoreInfo.candidates.length === 0 || status === 'unattempted')) {
                    debugDumpCard(card, { id, name, link, scoreInfo });
                }
            }

            const scoreUnavailable = pageUnattempted === totalCount;
            const scoreWarning = scoreUnavailable ? ' (punctaj indisponibil pentru toate)' : '';
            const parseFailSuffix = parseFailCount > 0 ? ` · parseFail=${parseFailCount}` : '';
            addLog(`Pagina ${pageIndex}: rezolvate ${pageSolved}, încercate ${pageTried}, neîncercate ${pageUnattempted} (total ${totalCount})${scoreWarning}${parseFailSuffix}.`);
            if (pageIndex === 1 && totalCount > 0 && scoreUnavailable) {
                addLog(`<span style="color:#b35c00;"><b>Atenție:</b> nu pare să fie disponibil punctajul tău pe această listă. Verifică dacă ești autentificat pe pbinfo.ro.</span>`);
            }

            fetchPage(pageIndex + 1, 0);
        };
        xhr.ontimeout = () => {
            if (retryCount < maxRetriesPerPage) {
                const delay = 1000 * (retryCount + 1);
                addLog(`Timeout la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
                setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                return;
            }
            finishScan({ complete: false, reason: `Timeout la pagina ${pageIndex}` });
        };
        xhr.onerror = () => {
            if (retryCount < maxRetriesPerPage) {
                const delay = 1000 * (retryCount + 1);
                addLog(`Eroare de rețea la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
                setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                return;
            }
            finishScan({ complete: false, reason: `Eroare de rețea la pagina ${pageIndex}` });
        };
        xhr.send();
    })(1, 0);
})();
}
