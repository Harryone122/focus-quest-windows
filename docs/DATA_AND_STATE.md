# Data and State

## Authority rule

SQLite, through `FocusQuestDatabase` in `src/main/database.ts`, is the persistent gameplay source of truth. Renderer snapshots mirror that state; React local state is for view selection, form input, animation, and transient UI, not long-term gameplay ownership.

Shared TypeScript interfaces in `src/shared/types.ts` define the process boundary. Database rows use snake_case and are mapped to renderer-facing camelCase objects.

## Core relationships

```text
QuestTask 1 -> many MicroStep
Task 1 -> many FocusSession
Task (main) 1 -> many DailyRun over time
DailyRun 1 -> many ExpeditionNode
DailyRun 1 -> many RunRelic
ExpeditionNode 1 -> many FocusSession attempts
FocusSession 0..1 -> PendingDebrief
ExpeditionNode 0..1 -> RunRelic acquisition for that run/node
```

## SQLite tables

### `tasks` — [IMPLEMENTED]

Fields:

- `id`
- `title`
- `role`
- `kind`
- `progress_definition`
- `starter_action`
- `obstacle`
- `deadline`
- `cue_type`
- `cue_value`
- `scheduled_date`
- `status`
- `created_at`
- `updated_at`

`role` is represented by `main | side | backlog`. `kind` is `study | report | admin | creative | other`. Task state and scheduling are persistent.

### `steps` — [IMPLEMENTED]

Fields:

- `id`
- `task_id`
- `text`
- `position`
- `status`

Rows belong to `tasks` through `task_id`. Current task creation inserts one step using the task's progress definition; the type and schema support ordered steps even though the current creation flow is minimal.

### `sessions` — [IMPLEMENTED]

Fields:

- `id`
- `task_id`
- `step_id`
- `started_at`
- `ended_at`
- `minimum_minutes`
- `paused_seconds`
- `suspended_at`
- `outcome`
- `blocked_attempts`
- `earned_light`
- `local_day`
- `run_id`
- `node_id`
- `planned_minutes`
- `resolution_applied`

`run_id`, `node_id`, and `planned_minutes` are nullable so legacy/non-expedition focus remains representable. `outcome` is `completed | progress | blocked` when recorded. Only a session with `ended_at IS NULL` is active.

### `daily_runs` — [IMPLEMENTED]

Fields:

- `id`
- `local_day`
- `main_task_id`
- `seed`
- `status`
- `depth`
- `selected_node_id`
- `started_at`
- `ended_at`

`status` is typed as `active | ended`. A partial unique index permits one `active` run for each `local_day`.

[KNOWN ISSUE] There is no current end-run command, so `ended` and `ended_at` are schema capabilities rather than a working end-of-day return to Archive.

### `expedition_nodes` — [IMPLEMENTED]

Fields:

- `id`
- `run_id`
- `parent_node_id`
- `depth`
- `distance`
- `type`
- `title`
- `description`
- `environment_hint`
- `planned_minutes`
- `state`
- `progress_seconds`
- `event_key`
- `reward_options`
- `selected_relic_key`
- `created_at`

Nodes belong to a Daily Run and form a tree through nullable `parent_node_id`. `reward_options` is persisted serialized option data. State is one of `available`, `selected`, `active`, `partial`, `awaiting_reward`, `awaiting_route`, or `cleared`.

### `run_relics` — [IMPLEMENTED]

Fields:

- `id`
- `run_id`
- `node_id`
- `relic_key`
- `acquired_at`

Rows belong to a run and source node. A unique constraint on `(run_id, node_id)` prevents choosing more than one relic for the same completed node.

### `pending_debriefs` — [IMPLEMENTED]

Fields:

- `session_id`
- `run_id`
- `node_id`
- `resolution`
- `effective_seconds`
- `progress_seconds`
- `threshold_seconds`
- `outcome`
- `complete_task`
- `created_at`

The session ID is the primary key. This row keeps the post-session sequence recoverable before all user choices are complete.

### `block_rules` — [IMPLEMENTED]

Fields:

- `id`
- `process_name`
- `display_name`
- `enabled`
- `created_at`

These rules drive foreground-process detection and the always-on-top blocker during a focus session.

### `rpg_state` — [IMPLEMENTED, LEGACY]

Fields:

- `id`
- `chapter`
- `node`
- `focus_seconds`
- `light`
- `star_pages`
- `materials`
- `ability`
- `last_loot`

The singleton row drives the older total-time/light world loop and `ArchiveGame` stages. It remains functional but is not the intended long-term discovery-first meta-progression model.

### `settings` — [IMPLEMENTED]

Fields:

- `id`
- `reminder_policy`
- `evening_reminder`
- `mini_timer`
- `phone_ritual`
- `coat_color`
- `lantern_color`

This singleton holds reminders, focus presentation preferences, and traveller colors.

### `events` — [IMPLEMENTED]

Fields:

- `id`
- `name`
- `created_at`
- `numeric_payload`

This table records anonymous/local product events used by CSV analytics export; it is not the expedition event catalog.

### `restoration_projects` — [IMPLEMENTED]

Fields:

- `project_key`
- `completed_at`

Currently only `restore_astrolabe` has gameplay rules.

## Snapshot composition

`getSnapshot()` assembles tasks, active session, recent sessions, blocker rules, legacy RPG state, settings, today's active run, its expedition nodes and relics, pending Debrief, and derived Archive state.

- [IMPLEMENTED] Renderer changes return or broadcast a fresh `AppSnapshot`.
- [IMPLEMENTED] Main and mini windows receive `snapshot:changed` broadcasts.
- [PARTIAL] Archive catalog entries are derived from expedition history rather than stored as dedicated collection rows. This is valid today, but future migrations must preserve derivation rules.

## Persistence and recovery

### Active Session — [IMPLEMENTED]

The open row in `sessions` stores start time, paused time, suspend time, task/step, and optional run/node binding. On app boot, the monitor restarts when a snapshot has an active session. React derives elapsed time from persistent timestamps.

### Selected Route — [IMPLEMENTED]

`daily_runs.selected_node_id` and the selected node's `state` are stored in SQLite. Tests reopen the database and verify selection recovery.

### Partial Node — [IMPLEMENTED]

`expedition_nodes.progress_seconds` and `state = partial` survive restart. A later Focus Session can resume and accumulate toward the full threshold.

### Pending Debrief — [IMPLEMENTED]

The `pending_debriefs` row survives restart. Full resolution also persists `event_key`, `reward_options`, and generated child nodes before user choices continue.

### Relic selection — [IMPLEMENTED persistence / PARTIAL UI]

The chosen key is stored on the node and as a `run_relics` row. Validation rejects keys outside the persisted options and prevents a second relic for the node. The current UI does not yet expose the intended two-option decision.

### Next Route — [IMPLEMENTED]

Child nodes are generated and stored on full resolution. After relic selection, choosing a child sets the source to `cleared`, the child to `selected`, and updates the run's selected node and depth. The pending Debrief is then removed.

### Explorer presentation — [PARTIAL]

Active focus time and run/node/session identity recover from SQLite. Mandatory lamp state is reconstructed from elapsed timer progress. Exact Phaser brain memory, current tween, recent ambient targets, and visited optional objects are not stored.

### Daily Run end — [KNOWN ISSUE]

Today's active run is selected by current `local_day`; there is no formal evening-end transition. Old active rows may remain in the database and there is no implemented settlement/reset contract.

## Backup

- [IMPLEMENTED] Export produces JSON backup version 3 containing current tables.
- [IMPLEMENTED] Import accepts versions 1, 2, and 3.
- [IMPLEMENTED] Migration/import paths tolerate backups or databases created before expedition and restoration tables existed.
- [IMPLEMENTED] Backup file selection and writing are owned by Electron main-process dialogs and IPC.

Any schema change must update creation/migration, row mapping, snapshot composition, backup export, compatible import, shared types, and tests together.
