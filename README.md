# pbinfo-get-unsolved

Obține o listă cu problemele nerezolvate de la o categorie de probleme de pe pbinfo.ro.

![screenshot](https://user-images.githubusercontent.com/68049793/193668559-2e0f63a8-1d9e-45ea-8839-09b55d1a5608.png)

## Cum îl folosești

1. Intră pe pbinfo.ro și conectează-te la un cont (altfel nu ai punctajul tău pe probleme).
2. Mergi la lista de probleme pe care vrei să o verifici (o categorie sau lista generală cu filtre).
3. Deschide consola browser-ului (`Ctrl` + `Shift` + `J`) și rulează scriptul din `pbinfo-get-unsolved-enhanced.js`.
4. La prompt, apasă `Enter` pentru pagina curentă sau lipește link-ul din bara de adresă și confirmă; apoi alege `start page` (Enter = 1).

Scriptul va scana paginile din listă și va afișa un tabel + o listă cu problemele care nu sunt rezolvate cu punctaj maxim.

După scanare:

- Folosește controalele de filtrare (stare + punctaj) pentru a restrânge lista.
- Folosește butoanele de export pentru a salva rezultatele în CSV/JSON.
- Poți copia rapid (lista filtrată) în clipboard: link-uri / ID-uri / Markdown.
- Tabelul are header sticky + highlight la hover și se adaptează automat la dark mode (tema browser-ului).

În timpul scanării poți opri rularea din butonul **Stop scan** sau o poți pune pe pauză (**Pauză/Continuă**); rezultatele parțiale rămân afișate.

## Config (opțional)

Poți seta câteva variabile înainte să rulezi scriptul:

```js
// performanță / rețea
window.PBINFO_GET_UNSOLVED_CONCURRENCY = 3; // default 1
window.PBINFO_GET_UNSOLVED_DELAY_MS = 150; // delay între request-uri (ms), default 0
window.PBINFO_GET_UNSOLVED_TIMEOUT_MS = 30000; // default 30000
window.PBINFO_GET_UNSOLVED_MAX_RETRIES = 3; // default 3
window.PBINFO_GET_UNSOLVED_START_PAGE = 1; // default 1 (resume: > 1)
window.PBINFO_GET_UNSOLVED_MAX_PAGES = 5000; // fallback cap (dacă pbinfo nu mai raportează totalul corect)

// paginare (în caz că pbinfo schimbă parametrii)
window.PBINFO_GET_UNSOLVED_PAGE_SIZE = 10; // default auto
window.PBINFO_GET_UNSOLVED_PAGINATION_MODE = 'offset'; // "offset" | "page"
window.PBINFO_GET_UNSOLVED_PAGE_PARAM = 'start'; // default "start"
window.PBINFO_GET_UNSOLVED_PAGE_BASE = 1; // doar pentru mode="page"
```

## Debug

Dacă scriptul ratează probleme sau nu reușește să identifice punctajul, poți activa un mod de debug (log în consolă).

Înainte să rulezi scriptul, execută în consolă:

```js
window.PBINFO_GET_UNSOLVED_DEBUG = true;
window.PBINFO_GET_UNSOLVED_DEBUG_IDS = [4926, 4928, 4929, 4930, 4936];
// opțional:
window.PBINFO_GET_UNSOLVED_DEBUG_LIMIT = 50;
window.PBINFO_GET_UNSOLVED_DEBUG_HTML = false;
```

Apoi rulează din nou `pbinfo-get-unsolved-enhanced.js`. Vei primi dump-uri cu ce “vede” parser-ul pentru cardurile respective.

## Bookmarklet (opțional)

Poți genera un bookmarklet minificat:

```bash
npm install
npm run build:bookmarklet
```

Rezultatul este scris în `dist/pbinfo-get-unsolved.bookmarklet.txt`. Copiază conținutul în URL-ul unui bookmark nou, apoi rulează-l pe o pagină pbinfo.

## Development

Rulează testele local:

```bash
npm install
npm test
```

Lint + format:

```bash
npm run lint
npm run format
```

## Changelog (scurt)

Acest changelog este ținut manual și include doar schimbări majore.

### Unreleased

- Îmbunătățiri la scanare, raportare, export și UI (filtre + dark mode).

## Issues / sugestii

Pentru nelămuriri sau sugestii, creează un Issue în acest repository.
