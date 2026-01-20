# Project Backlog

## High priority
- [x] Fix unsolved detection when pbinfo shows max points instead of user score
- [x] Add robust score parsing (title/data-bs-title variants, multiple numbers like `0/100`)
- [x] Detect and label statuses: solved / tried / unattempted
- [x] Add request retry/backoff on transient failures and rate limiting
- [x] Add safer termination conditions (avoid premature stop on empty/blocked pages)
- [x] Add debug mode to dump per-card metadata when parsing fails
- [x] Update README to reference `pbinfo-get-unsolved-enhanced.js` and current workflow
- [x] Add regression tests for score parsing heuristics
- [x] Add HTML fixture tests for common pbinfo card layouts

## Medium priority
- [ ] Add UI controls to filter by status and score threshold
- [ ] Add option to export results as CSV/JSON
- [ ] Improve progress reporting (ETA, pages scanned, problems scanned)
- [x] Replace O(n²) duplicate checks with a `Set` of IDs
- [ ] Add support for both global list and category list URLs with auto-detection
- [ ] Add configurable page size / pagination strategy (in case pbinfo changes)
- [ ] Add optional concurrency (limited) for faster scanning
- [ ] Add a bookmarklet-friendly build (minified single line + instructions)
- [ ] Add ESLint + formatting to keep style consistent

## Low priority
- [ ] Add a “copy links to clipboard” button
- [ ] Add a “resume from page N” option
- [ ] Add a “stop scan” button during long runs
- [ ] Add better table styling (sticky header, row hover)
- [ ] Add dark mode styling for the generated report
- [ ] Add a small changelog section in README
- [ ] Add GitHub Actions to run tests on PRs
