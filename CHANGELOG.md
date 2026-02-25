# Changelog

## Unreleased

- Userscript-first packaging (`dist/pbinfo-get-unsolved.userscript.js`) with persistent `Start scan` trigger.
- Backoff rewrite to exponential backoff with optional jitter plus adaptive throttling.
- Network layer migrated to `fetch` + `AbortController` with stop/pause-safe cancellation behavior.
- Fetched HTML parsing migrated to `DOMParser`.
- Local state upgraded to storage schema v2 with v1 compatibility reads and migration helpers.
- Added snapshot JSON export/import flow in UI.
- Added client-side search filter, chunked table rendering, and optional row virtualization flags.
- Added release automation workflow that publishes build artifacts and checksum file.
