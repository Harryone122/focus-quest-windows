# App icon handoff (Claude → Codex, 2026-09-26)

## What changed
- New app icon: the lantern traveller (straw hat, slate cloak, staff lantern) standing on a low-poly floating island at dusk. Colours match the Cloud Ruins scene materials (`cloak #3d4659`, `hat #b49c70`, lantern amber).
- `build/icon.svg`: source for large sizes (64 px and up).
- `build/icon-small.svg`: a tighter crop for 16–48 px (no stars, no distant island) so the hat and lantern still read in the taskbar.
- `build/icon.png`: 1024×1024 render of `icon.svg`.
- `build/icon.ico`: multi-size (16/24/32/48 from the small crop; 64/128/256 from the full icon).
- `package.json` → `build.win.icon`: `build/icon.png` → `build/icon.ico` (a one-line change).

## For Codex
- The exe, installer and shortcut icons change only after the next `npm.cmd run dist`.
- In dev mode (`electron-vite dev`), `BrowserWindow` has no `icon` option, so the window and taskbar still show the default Electron icon. If you want the new icon in dev too, add `icon: <path to build/icon.ico>` for unpackaged runs in `src/main/index.ts`. The packaged app already uses the exe icon, so this is optional.
- Not run: packaging and visual checks in the real app (Codex owns these).

## Codex verification — 2026-09-27, 0.6.8

- Packaged with `build/icon.ico`. Extracted the associated 32px icon from both the application EXE and NSIS installer; both show the delivered lantern traveller.
- Application EXE icon matches the source ICO's 32px image exactly (0 differing pixels). Source ICO SHA-256: `C80B81ACFA9F31F724B1E4F281B155A2BC95BE3D46E4D77717F5DD454705FB2B`.
- Evidence: `previews/lobby-integration/packaged-icon.png`, `installer-icon.png`. No icon artwork was regenerated or redesigned.
- The pre-existing system-tray lantern and developer Electron runtime icon were not changed. New installer/application/shortcut icon comes from the delivered ICO.
