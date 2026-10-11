# Focus Quest 0.6.20 Windows package

Installer: `release-v0.6.20/Focus Quest Setup 0.6.20.exe` (Windows x64, NSIS). The installed 0.6.19 was replaced with 0.6.20 and the new app was opened on the secondary monitor.

## Fixes

- The Collection Room is initialized in the background and its existing 3D frame is reused on navigation, eliminating the brown loading frame seen in the user recording.
- Starting a selected map keeps the lobby campfire scene visible for the traveler's lantern lighting animation. The destination appears after both the departure animation and destination scene are ready.
- The clue board has separate `單獨釘上` and `全部釘上` buttons. Single pin applies to the selected clue; bulk pin saves all remaining clues atomically and then plays the pinning sequence.

## Verification

- `npm run build` passed: typecheck, 23 test files / 151 tests, and production renderer build.
- Disposable-profile Electron/WebGL QA passed for the preloaded Collection Room, single pin, bulk pin, campfire lantern lighting, and destination arrival with no renderer errors. The same QA passed against the packaged 0.6.20 ASAR on the secondary monitor.
- The installed `app.asar` SHA-256 matched the packaged ASAR: `7BB4BC095C3AB0958D6DCF472BF3B7CBD6B7BFC2770CE9035606C3AF66C75CA7`.
- The user's SQLite save was backed up before installation to `%APPDATA%/focus-quest-windows/backup-before-0.6.20-2026-09-30-001806072Z/`. Integrity was `ok`. Read-only checks before and after launch preserved 32 sessions, 42 expedition nodes, and 18 tasks; no active focus session was interrupted.

QA reports and screenshots: `previews/collection-departure-qa/`, `previews/collection-departure-qa-shipped/`, and `previews/release-v0.6.20-qa/`.
