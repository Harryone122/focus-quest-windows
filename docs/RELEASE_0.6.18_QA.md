# Focus Quest 0.6.18 Windows package

Installer: `release-v0.6.18/Focus Quest Setup 0.6.18.exe` (Windows x64, NSIS). The packaged app was opened after the previous 0.6.17 process was closed.

## Included progress

- Lobby: Today, All Tasks, Log, Settings, route choices for both maps, and the campfire journey start. The four-tab glass navigation and compact-width layout are wired to the local save.
- Collection room: 3D bag room, the two visited map displays and luggage stickers, core displays, clue table and item selection/persistence.
- Cloud Ruins: playable map, 50-minute route, five lamps, scene/weather/exit flow, and currently integrated opening/visit/item story presentations.
- Moss Station: playable second map alongside Cloud Ruins, rain/weather, five lamps, rewards, exits, route titles, and shared departure transition. Its current scene geometry was aligned with the handed-off boardwalk profile, station sign, cart, hanging plants, and roots so the updated navigation points do not conflict with old prop positions.

The new Moss Station §49.8 story-event handoff is design data and prototype work; its new clue/event performances are **not** implemented in this package. The fifth-segment final encounter, full returned-campfire progression, and future hidden maps also remain future work.

## Verification

- `npm run dist -- --config.directories.output=release-v0.6.18`: typecheck, 22 test files / 144 tests, production build and signed NSIS installer passed.
- The extracted installer ASAR matches the tested production output byte for byte. Disposable-profile Windows QA passed Moss Station → Cloud Ruins (`exit_boat`) and Cloud Ruins → Moss Station (`exit_high`), including pause/reload and route titles. Both transitions recorded zero blank frames and zero opaque-cover frames; one Cloud Ruins → Moss Station run crossed the timing threshold under a temporary multi-second rendering stall, and an immediate repeat passed.
- Separate real Electron QA passed the lobby/Collection Room, campfire overlay, and 390px compact layout on the secondary display.
- Before replacing the running 0.6.17 app, the user's SQLite DB, WAL and SHM were copied and hash-verified to `%APPDATA%/focus-quest-windows/backup-before-0.6.18-20260930-030603`. After opening 0.6.18, the read-only save continuity check preserved 32 sessions, 40 expedition nodes and 18 tasks (including the active session).

QA reports and screenshots: `previews/area02-fixes-qa/release-v0.6.18-asar-exit_boat/`, `previews/area02-fixes-qa/release-v0.6.18-asar-exit_high/`, `previews/app-shell-v51-qa/`, and `previews/release-v0.6.18-qa/`.
