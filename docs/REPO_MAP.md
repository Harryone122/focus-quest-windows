# Repository Map

This is the fast orientation map for coding agents. Read the relevant design document before changing a mapped subsystem; then inspect the listed source and tests because code/tests define current behavior.

## Project tree

```text
focus-quest-windows/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ electron.vite.config.ts
├─ docs/
│  ├─ PRODUCT_VISION.md
│  ├─ GAMEPLAY_LOOP.md
│  ├─ DAILY_EXPEDITION.md
│  ├─ EXPLORATION_SYSTEM.md
│  ├─ ARCHIVE_META_PROGRESSION.md
│  ├─ ART_DIRECTION.md
│  ├─ UI_UX_RULES.md
│  ├─ COPY_STYLE.md
│  ├─ DATA_AND_STATE.md
│  ├─ TECH_ARCHITECTURE.md
│  ├─ QA_CHECKLIST.md
│  ├─ REPO_MAP.md
│  ├─ ui-system-v3.md
│  └─ ui-visual-compression-v4.md
├─ src/
│  ├─ main/
│  │  ├─ database.ts
│  │  ├─ index.ts
│  │  ├─ reminders.ts
│  │  └─ window-monitor.ts
│  ├─ preload/
│  │  └─ index.ts
│  ├─ renderer/
│  │  ├─ index.html
│  │  └─ src/
│  │     ├─ App.tsx
│  │     ├─ ArchiveGame.tsx
│  │     ├─ ExpeditionMap.tsx
│  │     ├─ FocusExplorationGame.tsx
│  │     ├─ LivingArchive.tsx
│  │     ├─ SessionDebrief.tsx
│  │     ├─ main.tsx
│  │     ├─ styles.css
│  │     ├─ global.d.ts
│  │     ├─ assets/
│  │     │  ├─ disordered-reading-hall-v3.png
│  │     │  ├─ focus-biome-forest-v1.png
│  │     │  ├─ lantern-traveler-silhouette.svg
│  │     │  └─ ui-paper-charcoal-v1.png
│  │     └─ exploration/
│  │        ├─ ExplorationPlanner.ts
│  │        ├─ ExplorationScene.ts
│  │        ├─ ExplorerAnimationAdapter.ts
│  │        ├─ ExplorerBrain.ts
│  │        ├─ InteractionRegistry.ts
│  │        ├─ MapDefinition.ts
│  │        ├─ ProgressController.ts
│  │        └─ SeededRandom.ts
│  └─ shared/
│     ├─ decomposition.ts
│     ├─ expedition.ts
│     ├─ rewards.ts
│     ├─ types.ts
│     └─ world.ts
└─ tests/
   ├─ behavior.test.ts
   ├─ expedition.test.ts
   └─ exploration.test.ts
```

`previews/`, `build/`, and `scripts/render-icon.cjs` contain captured visual references and icon build assets. They do not own gameplay state.

## Logic ownership

| Feature | Primary files | Responsibility | Status |
| --- | --- | --- | --- |
| Task and steps | `database.ts`, `types.ts`, `App.tsx`, `decomposition.ts` | CRUD, roles, initial step, local starter suggestions, task UI | [IMPLEMENTED] |
| Focus Session | `database.ts`, `App.tsx`, `types.ts` | Start/suspend/resume/end, timing, outcome, task completion | [IMPLEMENTED] |
| Daily Run | `database.ts`, `types.ts` | Create/idempotency, current day, seed, depth, selected node | [PARTIAL] no end-of-day return transition |
| Expedition nodes | `database.ts`, `expedition.ts`, `types.ts` | Lifecycle, partial/full resolution, event/options, children | [IMPLEMENTED] |
| Route generation | `expedition.ts`, `database.ts` | Deterministic two-route forks and persistence | [IMPLEMENTED] |
| Explorer brain | `renderer/src/exploration/*` | Timer milestones, planning, path, brain state, interactions | [IMPLEMENTED] prototype |
| Phaser focus bridge | `FocusExplorationGame.tsx`, `ExplorationScene.ts` | React time/IDs into Phaser presentation | [IMPLEMENTED] |
| Today map | `ExpeditionMap.tsx`, `App.tsx`, `styles.css` | Map, node selection, details, Start/Resume | [IMPLEMENTED] |
| Focus Setup | `App.tsx` (`FocusSetup`) | Duration/minimum, blocker apps, phone ritual, departure | [IMPLEMENTED] |
| Focus Active | `App.tsx` (`FocusActive`), `FocusExplorationGame.tsx` | Timer UI, quiet scene, end/debrief transition | [IMPLEMENTED] |
| Debrief | `SessionDebrief.tsx`, `database.ts` | Resolution, outcome, discovery, relic, next route | [PARTIAL] relic UI auto-selects first option |
| Relics | `expedition.ts`, `database.ts`, `SessionDebrief.tsx`, `ExpeditionMap.tsx` | Catalog/options, validation/persistence, route intel | [PARTIAL] limited effects and choice UI |
| Archive | `LivingArchive.tsx`, `ArchiveGame.tsx`, `database.ts` | World zones, derived collection, restoration, ambience | [PARTIAL] |
| Legacy world/reward | `world.ts`, `rewards.ts`, `ArchiveGame.tsx`, `database.ts` | Total-time stages, light, legacy RPG choice | [KNOWN ISSUE] coexists with new loop |
| SQLite | `database.ts` | Schema, migration, transactions, snapshots, archive derivation | [IMPLEMENTED] |
| IPC | `main/index.ts`, `preload/index.ts`, `types.ts`, `global.d.ts` | Typed renderer-to-main commands and snapshot events | [IMPLEMENTED] |
| Backup | `database.ts`, `main/index.ts` | JSON v3 export; v1/v2/v3 import; dialogs | [IMPLEMENTED] |
| Blocker | `window-monitor.ts`, `main/index.ts`, `App.tsx` (`BlockerView`) | Process detection, overlay, return/emergency actions | [IMPLEMENTED] |
| Mini Timer | `main/index.ts`, `App.tsx` (`MiniTimerView`) | Always-on-top session summary and visibility | [IMPLEMENTED] |
| Settings | `database.ts`, `App.tsx` (`SettingsView`) | Reminder/mini/ritual/colors, backup/export controls | [IMPLEMENTED] |
| Reminders | `reminders.ts` | Time cue, structured follow-up, evening notification | [IMPLEMENTED] |
| Insights/analytics | `App.tsx` (`InsightsView`), `database.ts`, `main/index.ts` | Local summary UI, anonymous events CSV export | [IMPLEMENTED] |

## Explorer architecture

The exploration logic is **not** all inside `ArchiveGame.tsx`.

```text
FocusActive (App.tsx)
  -> FocusExplorationGame.tsx
     -> ExplorationScene.ts
        -> ProgressController.ts
        -> ExplorerBrain.ts
           -> ExplorationPlanner.ts
              -> MapDefinition.ts
              -> SeededRandom.ts
           -> InteractionRegistry.ts
        -> ExplorerAnimationAdapter.ts
```

- `ProgressController`: timer ratio, mandatory lamps, preparation windows, speed pressure.
- `ExplorerBrain`: `IDLE`, target selection, walking, arrival, interaction, looking, rest, and memory.
- `ExplorationPlanner`: graph paths and utility-based target scoring.
- `MapDefinition`: `FOREST_MAP`, waypoint edges, five lamps, and ambient objects.
- `InteractionRegistry`: presentation contract per interaction type.
- `SeededRandom`: deterministic seed and variation.
- `ExplorationScene`: Phaser objects, movement tweens, atmosphere, and coordination.
- `ExplorerAnimationAdapter`: replaceable character-presentation boundary.

`ArchiveGame.tsx` is a separate ambient Archive scene tied mainly to legacy RPG world stages.

## Gameplay state flow

```text
Main Quest            [WORKING]
  -> DailyRun         [WORKING, PARTIAL: no formal end]
  -> Select Node      [WORKING]
  -> Start Focus      [WORKING]
  -> Partial / Full   [WORKING]
  -> Event            [WORKING]
  -> Relic            [PARTIAL: persistence works; UI auto-picks first]
  -> Next Route       [WORKING]
  -> Today            [WORKING]
  -> Return to Archive [PLANNED]
```

No step in this map is currently classified as `[BUGGY]` by an established failing test. The explicit gaps above are `[PARTIAL]`, `[PLANNED]`, or `[KNOWN ISSUE]`; do not relabel them as working merely because types exist.

## Database ownership

All tables are created, migrated, read, and written by `src/main/database.ts`. `src/main/index.ts` exposes only commands; the renderer never owns a table.

| Table | Main readers/writers | Purpose |
| --- | --- | --- |
| `tasks` | task methods, run/focus validation, snapshot | Real tasks and roles |
| `steps` | task creation, focus validation/completion, snapshot | Ordered task progress units |
| `sessions` | focus/debrief methods, blocker attempts, insights, backup | Timing and real-work outcome |
| `daily_runs` | run/node/focus/debrief methods, snapshot, backup | One seeded run per local day |
| `expedition_nodes` | route selection, focus/debrief/relic/route, archive derivation | Route tree and node lifecycle |
| `run_relics` | relic selection, route intel snapshot, archive derivation | Acquired run relics |
| `pending_debriefs` | begin/end/dismiss Debrief, snapshot | Recoverable post-session sequence |
| `block_rules` | save/list rules, window monitor via snapshot | Enabled distracting processes |
| `rpg_state` | legacy focus reward/choice, snapshot, backup | Legacy total-time/light state |
| `settings` | update/snapshot, reminders/window behavior | Local preferences |
| `events` | database event recording, analytics CSV | Anonymous/local telemetry rows |
| `restoration_projects` | Archive state and completion | Permanent restoration completion |

Exact fields and recovery contracts are in [Data and State](DATA_AND_STATE.md).

## UI ownership

| Surface | Component/entry | Notes |
| --- | --- | --- |
| App shell/navigation | `App` in `App.tsx` | Snapshot orchestration and view switching |
| Today | `TodayView` + `ExpeditionMap` | Main Quest and route map |
| Library | `LibraryView` in `App.tsx` | Backlog/role actions |
| Task creation | `TaskWizard` in `App.tsx` | Journal-style creation flow |
| Focus Setup | `FocusSetup` in `App.tsx` | Departure choices before session |
| Focus Active | `FocusActive` + `FocusExplorationGame` | Timer plus autonomous world |
| Debrief | `SessionDebrief` | Persistent partial/full choice flow |
| Archive/Journey | `LivingArchive` + `ArchiveGame` | Meta world and ambient Phaser layer |
| Settings | `SettingsView` in `App.tsx` | Preferences and local data tools |
| Insights | `InsightsView` in `App.tsx` | Focus summary/ledger |
| Blocker | `BlockerView` in `App.tsx` | Separate `#/blocker` window route |
| Mini Timer | `MiniTimerView` in `App.tsx` | Separate `#/mini` window route |
| Styling | `styles.css` | Global materials, layouts, transitions, responsive rules |

`QuestPath` remains in `App.tsx` but is not the current expedition map owner. Do not extend it as if it were the active route system without confirming its use.

## Known problems

### Gameplay gap

- [PARTIAL] Debrief does not present the persisted relic options as a real choice; it accepts the first option.
- [PARTIAL] Only a small event/relic catalog and two generated node types are active.
- [PARTIAL] Side tasks are focusable outside the run but do not create a run `detour` node.

### Architecture debt

- [KNOWN ISSUE] `database.ts`, `App.tsx`, and `styles.css` are broad responsibility hotspots.
- [KNOWN ISSUE] Legacy and expedition reward models coexist.
- [KNOWN ISSUE] `QuestPath` appears to be superseded UI still present in `App.tsx`.

### Persistence risk

- [KNOWN ISSUE] No explicit Daily Run end; previous local-day active rows may remain active.
- [PARTIAL] Explorer restores timer/lamp checkpoint, not exact brain/action memory.
- [PARTIAL] Archive catalog is derived from node/relic history, so future schema changes must preserve derivation semantics.

### UI debt

- [PARTIAL] Some expedition screens still depend on explanatory panels/copy while the world-first language matures.
- [PARTIAL] Meaningful relic choice is missing from Debrief UI.

### Explorer limitation

- [PARTIAL] One forest `MapDefinition` only.
- [PARTIAL] Prototype shape-based traveller presentation.
- [PARTIAL] No Tiled authoring or Spine runtime; both are optional future tools, not current defects.

### Visual/copy debt

- [KNOWN ISSUE] `README.md` still frames the focus scene as an animated wallpaper and total-time world stages as the main loop.
- [PARTIAL] Some copy is more poetic/motivational than the intended restrained concrete voice.
- [PARTIAL] Archive visual growth is not yet primarily driven by persistent discovery/restoration.

## Future modification map

### Changing Explorer

Read:

- `EXPLORATION_SYSTEM.md`
- `DATA_AND_STATE.md`
- `ART_DIRECTION.md`
- `QA_CHECKLIST.md`

Inspect:

- `src/renderer/src/FocusExplorationGame.tsx`
- `src/renderer/src/exploration/*`
- `tests/exploration.test.ts`
- Active-session parts of `src/main/database.ts`

### Changing Archive

Read:

- `ARCHIVE_META_PROGRESSION.md`
- `ART_DIRECTION.md`
- `UI_UX_RULES.md`
- `DATA_AND_STATE.md`

Inspect:

- `LivingArchive.tsx`
- `ArchiveGame.tsx`
- Archive derivation/restoration in `database.ts`
- `world.ts` before changing legacy stages

### Changing Daily Run or node rules

Read:

- `GAMEPLAY_LOOP.md`
- `DAILY_EXPEDITION.md`
- `DATA_AND_STATE.md`
- `QA_CHECKLIST.md`

Inspect:

- `shared/expedition.ts`
- `shared/types.ts`
- Run/node/debrief methods in `main/database.ts`
- `tests/expedition.test.ts`

### Changing Today or Debrief

Read:

- `UI_UX_RULES.md`
- `COPY_STYLE.md`
- `DAILY_EXPEDITION.md`
- `ART_DIRECTION.md`

Inspect:

- `App.tsx`
- `ExpeditionMap.tsx`
- `SessionDebrief.tsx`
- Relevant CSS and expedition tests

### Changing persistence or IPC

Read:

- `DATA_AND_STATE.md`
- `TECH_ARCHITECTURE.md`
- `QA_CHECKLIST.md`

Inspect together:

- `main/database.ts`
- `main/index.ts`
- `preload/index.ts`
- `shared/types.ts`
- `renderer/src/global.d.ts`
- Backup and expedition tests

## Agent handoff rule

Do not trust this map in place of reading the scoped code. Use it to find ownership quickly, verify behavior in code/tests, make the smallest change, run `npm test` and `npm run typecheck`, and launch the app for any UI change.
