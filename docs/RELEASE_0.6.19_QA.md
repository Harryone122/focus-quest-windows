# Focus Quest 0.6.19 Windows package

Installer: `release-v0.6.19/Focus Quest Setup 0.6.19.exe` (Windows x64, NSIS). The user's installed 0.6.18 was replaced with 0.6.19 after verification; the installed App was launched on the secondary monitor.

## Included progress

- Moss Station §49.8 opening, first and second visits, compass-gated story, and the three currently obtainable carried-item stories are connected to the production renderer and saved event scheduler. The ten handed-off visual performances are available in the scene; the two future-map performances await their required item/core.
- Permanent clues, rain-locked departure variant, world marks, first-opening review clue, and one carried-item discovery card per exploration are persisted. Story events occupy separate between-lamp segments; the five lamp deadlines remain authoritative.
- The handed-off clip fixes are in the production scene. The boulder route and both Moss/Cloud map transitions were rechecked.
- A desktop shortcut, `Focus Quest 從頭測試.lnk`, invokes `scripts/reset-local-progress.ps1`. It moves the complete local profile to a dated backup under `%APPDATA%/focus-quest-windows-backups/` before starting a fresh playthrough; the shortcut was path-checked but deliberately not executed against the user's save.

The carried cloth from map 07 and unwritten diary core from map 08 are not yet obtainable because those maps have not been implemented. Whether the wrapped seedling can be taken away after Focus is still a draft, not a confirmed gameplay rule.

## Verification

- `npm run build`: typecheck, 23 test files / 150 tests, and production build passed. The 60-seed Moss story test covered rain, special finds, and all five lamp deadlines.
- All ten story performances rendered in real Electron/WebGL on the secondary monitor with no console errors. The boulder approach/detour clearance check passed.
- The extracted installer ASAR matched the tested production output byte for byte. Disposable-profile Windows QA passed Moss → Cloud and Cloud → Moss; both had zero blank or opaque transition frames, and pause/reload preserved the destination state. A separate lobby QA showed and stored the carried-item discovery card.
- The user's SQLite save was backed up with integrity `ok` before replacement to `%APPDATA%/focus-quest-windows/backup-before-0.6.19-20260930-072232/`. The post-launch read-only continuity check preserved 32 sessions, 40 expedition nodes and 18 tasks, including the active session.

QA reports and screenshots: `previews/moss-story-qa/`, `previews/area02-fixes-qa/release-v0.6.19-asar-exit_boat/`, `previews/area02-fixes-qa/release-v0.6.19-asar-exit_high/`, and `previews/release-v0.6.19-qa/`.
