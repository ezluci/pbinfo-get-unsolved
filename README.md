# pbinfo-get-unsolved

Obține o listă cu problemele nerezolvate de la o categorie de probleme de pe pbinfo.ro.

![screenshot](https://user-images.githubusercontent.com/68049793/193668559-2e0f63a8-1d9e-45ea-8839-09b55d1a5608.png)

## Cum îl folosești

1. Intră pe pbinfo.ro și conectează-te la un cont (altfel nu ai punctajul tău pe probleme).
2. Mergi la lista de probleme pe care vrei să o verifici (o categorie sau lista generală cu filtre).
3. Deschide consola browser-ului (`Ctrl` + `Shift` + `J`) și rulează scriptul din `pbinfo-get-unsolved-enhanced.js`.
4. La prompt, lipește link-ul din bara de adresă și confirmă.

Scriptul va scana paginile din listă și va afișa un tabel + o listă cu problemele care nu sunt rezolvate cu punctaj maxim.

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

## Development

Rulează testele local:

```bash
npm install
npm test
```

## Issues / sugestii

Pentru nelămuriri sau sugestii, creează un Issue în acest repository.
