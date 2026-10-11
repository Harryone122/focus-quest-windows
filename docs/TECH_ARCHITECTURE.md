# Technical Architecture

## Runtime stack

| Layer | Technology | Responsibility | Status |
| --- | --- | --- | --- |
| Desktop shell | Electron | Windows, tray, windows, notifications, files, lifecycle | [IMPLEMENTED] |
| App UI | React + ReactDOM | Tasks, Today, setup, Debrief, Archive UI, settings, insights | [IMPLEMENTED] |
| Game runtime | Phaser | Archive ambience and focus exploration presentation | [IMPLEMENTED] |
| Language/rules | TypeScript | Shared types, deterministic rules, renderer and main code | [IMPLEMENTED] |
| Persistence | SQLite via `better-sqlite3` | Tasks, sessions, runs, nodes, relics, settings, recovery | [IMPLEMENTED] |
| Windows inspection | `get-windows` | Running-app list and active-window blocker detection | [IMPLEMENTED] |
| Build/package | electron-vite + Vite + electron-builder/NSIS | Development, build, Windows installers | [IMPLEMENTED] |
| Test | Vitest | Rule, persistence, recovery, and exploration tests | [IMPLEMENTED] |

This table describes the current implementation. Per the 2026-09-25 core-plan decision, Phaser is replaceable for the front-end redesign. Claude owns the new scene and all visible UI; Codex owns the Electron/SQLite back end, gameplay rules, state contracts, tests, and final connection to Claude's accepted visual work. A local 3D scene does not imply a cloud service. Keep focus time and durable game state independent of whichever renderer is chosen.

No LLM, generative model, cloud AI, or machine-learning runtime is used. Starter suggestions are local deterministic rules in `src/shared/decomposition.ts`.

## Process boundaries

### Electron main process

`src/main/index.ts` boots the app, initializes the database, owns three BrowserWindows, registers IPC, runs QA seeding/capture hooks, schedules reminders, manages tray behavior, and starts/stops the foreground-window monitor.

The windows are:

- Main application window.
- Full-screen always-on-top blocker window.
- Small always-on-top mini timer window.

`src/main/database.ts` is the authoritative persistence and gameplay transaction boundary. Renderer code must not write SQLite directly.

`src/main/window-monitor.ts` polls the active Windows process during focus, checks persistent blocker rules, and shows the blocker. It never terminates another process.

`src/main/reminders.ts` reads tasks/settings and produces local Electron notifications for time cues, structured follow-up, and the evening reminder.

### Preload boundary

`src/preload/index.ts` uses `contextBridge` to expose a typed `window.focusQuest` API. The renderer has no Node integration and does not receive raw database access.

Current request channels are:

- `snapshot:get`
- `task:create`, `task:set-role`, `task:archive`, `task:delete`
- `expedition:start-run`, `expedition:select-node`
- `focus:start`, `focus:begin-debrief`, `focus:end`
- `expedition:choose-relic`, `expedition:choose-next-route`, `expedition:dismiss-debrief`
- `archive:complete-restoration`
- `apps:list`, `block-rules:save`, `settings:update`, `rpg:choice`
- `overlay:return`, `overlay:emergency`
- `data:export-backup`, `data:import-backup`, `data:export-analytics`

The main process broadcasts updated snapshots on `snapshot:changed` and blocker context on `overlay:state`.

### Renderer

`src/renderer/src/App.tsx` is the current application shell and contains the major productivity views, focus setup/active flow, blocker, and mini timer. It routes expedition-specific work into focused components.

- `ExpeditionMap.tsx` renders the current run map, selection, route intelligence, partial progress, and detail/start actions.
- `SessionDebrief.tsx` renders persistent post-session resolution, outcome, discovery, relic acceptance, and route choice.
- `LivingArchive.tsx` renders the world-first Archive zones and restoration interaction.
- `FocusExplorationGame.tsx` bridges a running Focus Session into a Phaser `ExplorationScene`.
- `ArchiveGame.tsx` contains the legacy/ambient Archive Phaser scene used outside the new exploration scene.
- `styles.css` owns the current material, layout, animation, and responsive styling across these surfaces.

## Shared rules

`src/shared/types.ts` is the typed contract for tasks, sessions, runs, nodes, Archive state, settings, backups, snapshots, and the preload API.

`src/shared/expedition.ts` owns deterministic expedition content and pure rules:

- Event and relic definitions.
- Seeded route generation.
- Node event/relic-option derivation.
- Full-resolution threshold calculation.
- Partial/full/too-short resolution.

`src/shared/world.ts` owns the legacy twelve total-focus-time world stages. `src/shared/rewards.ts` owns legacy light reward calculations. `src/shared/decomposition.ts` owns local task starter suggestions.

## Expedition transaction flow

```text
React action
  -> preload typed method
  -> IPC handler in main/index.ts
  -> FocusQuestDatabase transaction
  -> AppSnapshot
  -> snapshot:changed broadcast
  -> React rerender
```

Critical state transitions happen in database transactions, not in Phaser or component-local state.

## Current Phaser responsibilities

### `ArchiveGame` — [IMPLEMENTED, LEGACY/PARTIAL]

Creates an ambient archive scene, camera/parallax response, interactive visual echoes outside focus, and presentation selected by legacy `rpg.focusSeconds` world stages. It does not own the expedition state machine.

### Focus explorer — [IMPLEMENTED]

The autonomous explorer is split across `FocusExplorationGame` and `src/renderer/src/exploration/*`. React supplies time and IDs; a controller/planner/brain selects legal behavior; Phaser presents it. Details are in [Exploration System](EXPLORATION_SYSTEM.md).

## Autonomous exploration algorithm

The current and intended core is:

- State machine.
- Utility scoring.
- Seeded random variation.
- Waypoint graph/pathfinding.
- Timer-driven milestone planning.

[DO NOT IMPLEMENT] An LLM, external AI model, or machine-learning system for this loop. Such a dependency would reduce determinism, offline reliability, testability, and recovery without solving a need the current algorithm cannot address.

## Persistence and security properties

- [IMPLEMENTED] User task text stays in the local AppData SQLite database unless the user explicitly exports a backup.
- [IMPLEMENTED] Renderer isolation is enabled: `contextIsolation: true`, sandbox enabled, Node integration disabled.
- [IMPLEMENTED] Analytics export is initiated locally and writes CSV through a save dialog.
- [IMPLEMENTED] The blocker observes process names and overlays guidance; it does not kill processes, edit hosts, or require administrator rights.

## Current architecture debt

- [KNOWN ISSUE] `database.ts` owns schema, migration, mapping, queries, domain transitions, archive derivation, import/export, and analytics in one large class.
- [KNOWN ISSUE] `App.tsx` contains many surfaces and orchestration responsibilities.
- [KNOWN ISSUE] `styles.css` is a broad global stylesheet.
- [KNOWN ISSUE] Legacy light/time progression and the new expedition/discovery model coexist.
- [PARTIAL] The repository has strong explorer module boundaries, but only one hard-coded map definition and prototype character presentation.

These are mapping notes, not authorization for a broad refactor. Split them only when a scoped feature or test boundary needs it.
