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

    if (best.max != null && Number.isFinite(best.max)) maxScore = best.max;
    return { userScore: best.value, maxScore };
}

if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (typeof module !== 'undefined') {
        module.exports = { normalizeSpace, normalizeForMatch, parseScoreText, selectScoreFromCandidates };
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

    const reqPageEl = document.createElement('div');
    reqPageEl.style.display = 'none';
    document.body.appendChild(reqPageEl);

    const problems = [];
    const seenProblemIds = new Set();
    const sorted = { cnt: 1, id: 0, score: 0, difficulty: 0, postedBy_name: 0, author: 0, source: 0 };
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
        table.innerHTML = `<tr style="font-weight:bold;">
            <td style="min-width:5em;user-select:none;"><a onclick="sortTable('cnt')">Contor ${sortSymbol('cnt')}</a></td>
            <td style="min-width:10em;user-select:none;"><a onclick="sortTable('id')">Nume ${sortSymbol('id')}</a></td>
            <td style="min-width:5em;user-select:none;"><a onclick="sortTable('score')">Punctaj ${sortSymbol('score')}</a></td>
            <td style="min-width:6.5em;user-select:none;"><a onclick="sortTable('difficulty')">Dificultate ${sortSymbol('difficulty')}</a></td>
            <td style="min-width:13em;user-select:none;"><a onclick="sortTable('postedBy_name')">Postată de ${sortSymbol('postedBy_name')}</a></td>
            <td style="min-width:10em;user-select:none;"><a onclick="sortTable('author')">Autor ${sortSymbol('author')}</a></td>
            <td style="min-width:10em;user-select:none;"><a onclick="sortTable('source')">Sursa problemei ${sortSymbol('source')}</a></td>
        </tr>`;
        problems.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${p.cnt}.</td>
                <td><a href="${p.link}" target="_blank">#${p.id} - ${p.name}</a></td>
                <td>${p.score}p</td>
                <td><span style="color:white;background-color:#${difficultyColor(p.difficulty)};">${numberToDifficulty(p.difficulty)}</span></td>
                <td><a target="_blank" href="${p.postedBy_link}"><img style="vertical-align:middle;width:1.1em;" src="${p.postedBy_img}"> ${p.postedBy_name}</a></td>
                <td>${p.author}</td>
                <td>${p.source}</td>`;
            table.appendChild(row);
        });
    }

    const tooltipAttrs = ['title', 'data-bs-title', 'data-bs-original-title', 'data-original-title'];
    function getTooltipText(el) {
        for (const attr of tooltipAttrs) {
            const v = el.getAttribute(attr);
            if (v) return v;
        }
        return '';
    }

    function extractScoreInfo(card) {
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

        return selectScoreFromCandidates(candidates);
    }

    // Fetch pages recursively
    const maxRetriesPerPage = 3;
    (function fetchPage(pageIndex, retryCount = 0) {
        const xhr = new XMLHttpRequest();
        const url = pageLink + (pageLink.includes('?') ? '&' : '?') + 'start=' + 10 * (pageIndex - 1);
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
                addLog(`Eroare la pagina ${pageIndex} (status ${xhr.status}). Oprire.`);
                return;
            }

            if (/invalid request/i.test(responseText)) {
                if (retryCount < maxRetriesPerPage) {
                    const delay = 1000 * (retryCount + 1);
                    addLog(`Serverul a răspuns cu "Invalid request" la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
                    setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                    return;
                }
                addLog(`Serverul a răspuns cu "Invalid request" la pagina ${pageIndex}. Oprire.`);
                return;
            }

            reqPageEl.innerHTML = responseText;
            const cards = reqPageEl.querySelectorAll('div.card.mb-3');
            let solvedCount = 0;
            let totalCount = 0;
            let unknownScoreCount = 0;
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
                const { userScore, maxScore } = extractScoreInfo(card);
                if (userScore == null) unknownScoreCount++;
                let score = userScore;
                if (!Number.isFinite(score)) score = 0;
                const solvedThreshold = Number.isFinite(maxScore) ? maxScore : 100;
                if (score >= solvedThreshold && userScore != null) {
                    solvedCount++;
                } else {
                    if (isNaN(score)) score = 0;
                    problems.push({ cnt: problems.length + 1, id, name, link, difficulty, score, postedBy_link: pbLink, postedBy_name: pbName, postedBy_img: pbImg, author, source });
                }
            }
            if (cards.length === 0) {
                // no more pages, show results
                updateTable();
                document.body.appendChild(table);
                // list unsolved problems
                if (problems.length > 0) {
                    const listDiv = document.createElement('div');
                    listDiv.style.marginTop = '1em';
                    listDiv.innerHTML = '<h3>Lista problemelor nerezolvate:</h3>';
                    const ul = document.createElement('ul');
                    ul.style.listStyle = 'none';
                    ul.style.paddingLeft = '0';
                    problems.forEach(p => {
                        const li = document.createElement('li');
                        li.style.marginBottom = '0.25em';
                        li.innerHTML = `<a href="${p.link}" target="_blank">#${p.id} - ${p.name}</a>`;
                        ul.appendChild(li);
                    });
                    listDiv.appendChild(ul);
                    document.body.appendChild(listDiv);
                }
                addLog(`<u>Am terminat de extras problemele.</u> Sunt ${problems.length} probleme nerezolvate. Tabelul și lista au fost adăugate mai jos.`);
                return;
            } else {
                const unknownSuffix = unknownScoreCount > 0 ? ` (punctaj indisponibil pentru ${unknownScoreCount})` : '';
                addLog(`Pagina ${pageIndex} are ${solvedCount}/${totalCount} probleme rezolvate.${unknownSuffix}`);
                fetchPage(pageIndex + 1, 0);
            }
        };
        xhr.ontimeout = () => {
            if (retryCount < maxRetriesPerPage) {
                const delay = 1000 * (retryCount + 1);
                addLog(`Timeout la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
                setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                return;
            }
            addLog(`Timeout la pagina ${pageIndex}. Oprire.`);
        };
        xhr.onerror = () => {
            if (retryCount < maxRetriesPerPage) {
                const delay = 1000 * (retryCount + 1);
                addLog(`Eroare de rețea la pagina ${pageIndex}. Reîncerc în ${delay / 1000}s...`);
                setTimeout(() => fetchPage(pageIndex, retryCount + 1), delay);
                return;
            }
            addLog(`Eroare de rețea la pagina ${pageIndex}. Oprire.`);
        };
        xhr.send();
    })(1, 0);
})();
}
