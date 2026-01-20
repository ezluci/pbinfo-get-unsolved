# Project Backlog

## High priority

- [x] Fix unsolved detection when pbinfo shows max points instead of user score
- [x] Add robust score parsing (title/data-bs-title variants, multiple numbers like `0/100`)
- [x] Detect and label statuses: solved / tried / unattempted
- [x] Add request retry/backoff on transient failures and rate limiting
- [x] Add safer termination conditions (avoid premature stop on empty/blocked pages)
- [x] Add debug mode to dump per-card metadata when parsing fails
- [x] Harden report rendering (avoid `innerHTML` for pbinfo strings)
- [x] Update README to reference `pbinfo-get-unsolved-enhanced.js` and current workflow
- [x] Add regression tests for score parsing heuristics
- [x] Add HTML fixture tests for common pbinfo card layouts

## Medium priority

- [x] Add UI controls to filter by status and score threshold
- [x] Add option to export results as CSV/JSON
- [x] Improve progress reporting (ETA, pages scanned, problems scanned)
- [x] Replace O(n²) duplicate checks with a `Set` of IDs
- [x] Add support for both global list and category list URLs with auto-detection
- [x] Add configurable page size / pagination strategy (in case pbinfo changes)
- [x] Add optional concurrency (limited) for faster scanning
- [x] Add a bookmarklet-friendly build (minified single line + instructions)
- [x] Add ESLint + formatting to keep style consistent

## Low priority

- [x] Add a “copy links to clipboard” button
- [x] Add a “resume from page N” option
- [x] Add a “stop scan” button during long runs
- [x] Add a pause/resume toggle (keep scan state)
- [x] Use `PBINFO_GET_UNSOLVED_MAX_PAGES` as a fallback termination cap
- [x] Add extra clipboard formats (IDs / Markdown list)
- [ ] Persist scan state to `localStorage` for reload-resume
- [x] Add better table styling (sticky header, row hover)
- [x] Add dark mode styling for the generated report
- [ ] Add theme toggle (system/light/dark)
- [x] Add a small changelog section in README
- [x] Add GitHub Actions to run tests on PRs
