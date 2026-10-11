# QA Checklist

Use this after implementation work. Automated coverage is identified where it exists; UI and visual items still require a running-app check.

## Gameplay QA

- [IMPLEMENTED] Start a Daily Run from an active Main Quest; starting again on the same local day returns the same run.
- [IMPLEMENTED] Select route A, switch to route B before focus, and verify A returns to `available`.
- [IMPLEMENTED] Verify the selected route can always open Focus Setup and start when its Main Quest/step is valid.
- [IMPLEMENTED] End after a valid incomplete duration; verify the node becomes `partial` and stores progress.
- [IMPLEMENTED] Switch away from a partial route, return, resume, and verify progress accumulates.
- [IMPLEMENTED] End before five effective minutes on a fresh node; verify no node progress or reward.
- [IMPLEMENTED] Reach the full threshold; verify the node enters `awaiting_reward` and event/reward options persist.
- [IMPLEMENTED] Verify partial resolution never grants a relic or child-route advance.
- [IMPLEMENTED] Verify only a persisted valid relic option can be selected and only one relic can be stored per node.
- [IMPLEMENTED] Verify next-route choice is unavailable before relic selection.
- [IMPLEMENTED] Choose a child route; verify the source is `cleared`, child is `selected`, and run depth advances.
- [IMPLEMENTED] Record `completed`, `progress`, and `blocked`; verify time resolution is independent of the outcome label.
- [IMPLEMENTED] Verify session outcome does not complete the real task unless `completeTask` is explicitly true.
- [IMPLEMENTED] Manually inspect the Debrief: the persisted event appears before two visible relic options, and neither option is auto-selected.
- [PLANNED] Test explicit expedition end, return to Archive, summary, and next-day reset after those features exist.

## Explorer QA

- [IMPLEMENTED] For the same run/node/session IDs, verify the exploration seed remains stable.
- [IMPLEMENTED] For different session IDs on the same map, verify ambient selection can vary.
- [IMPLEMENTED] Verify every planned movement follows legal waypoint edges and never teleports between disconnected points.
- [IMPLEMENTED] Verify the planner selects ambient actions when a mandatory milestone is safely distant.
- [IMPLEMENTED] Verify it prepares the next mandatory lamp when travel/interaction time requires it.
- [IMPLEMENTED] At 50% of planned Area time, verify 2 of 5 mandatory lamps are due; the third becomes due at 60%.
- [IMPLEMENTED] At completion, verify all mandatory lamps are due regardless of animation performance.
- [IMPLEMENTED] Verify optional actions cannot delay a mandatory milestone.
- [IMPLEMENTED] Verify the behavior is neither a fixed identical recording nor an unconstrained random walk.
- [PARTIAL] Restart during a session and verify a coherent timer/lamp checkpoint recovery.
- [KNOWN ISSUE] Do not expect exact recovery of current path, tween, visited optional objects, or recent-target memory.
- [PARTIAL] Visually check motion at 0%, around 50%, and near completion on the one current forest map.

## Persistence QA

- [IMPLEMENTED] Restart with an active Focus Session; verify task, step, elapsed timing, run, and node binding recover.
- [IMPLEMENTED] Restart after selecting a route; verify it remains selected.
- [IMPLEMENTED] Restart after partial completion; verify seconds and resumability remain.
- [IMPLEMENTED] Restart in `awaiting_reward`; verify the same event, relic options, and generated children remain.
- [IMPLEMENTED] Restart in `awaiting_route`; verify the selected relic remains and the same child routes remain.
- [IMPLEMENTED] Verify Daily Run seed/depth/selection do not reroll during the same day.
- [IMPLEMENTED] Export a version 3 backup and import it into a clean database.
- [IMPLEMENTED] Verify version 1 backup and pre-expedition database compatibility through automated tests.
- [KNOWN ISSUE] A past day's active run is not formally ended; test/inspect this before building any cross-day summary feature.
- [PARTIAL] Archive state is derived from historical nodes/relics; verify migrations preserve those derivation assumptions.

## Productivity QA

- [IMPLEMENTED] Create a task and verify its initial step exists.
- [IMPLEMENTED] Move tasks among main, side, and backlog roles within existing limits.
- [IMPLEMENTED] Verify an active run's Main Quest cannot be deleted, archived, or displaced by an invalid operation.
- [IMPLEMENTED] Verify Focus Setup supports 5/10/15-minute minimum commitment separately from route planned duration.
- [IMPLEMENTED] Verify Focus Active does not require gameplay interaction.
- [IMPLEMENTED] Verify elapsed time continues independently of scene rendering (currently Phaser).
- [IMPLEMENTED] Verify suspend/resume excludes suspended time from effective focus time.
- [IMPLEMENTED] Enable a block rule, enter the app, and verify the overlay appears without terminating the process.
- [IMPLEMENTED] Verify five-second emergency flow can unlock for ten minutes or end the session.
- [IMPLEMENTED] Verify Mini Timer shows only when enabled and a session is active.
- [IMPLEMENTED] Verify Phone Ritual preference is represented in Focus Setup.
- [IMPLEMENTED] Verify reminders respect off/gentle/structured policy behavior.
- [IMPLEMENTED] Verify backup, restore, and CSV analytics dialogs complete or cancel safely.

## UI QA

- [IMPLEMENTED] Node click selects; it does not immediately start focus.
- [IMPLEMENTED] Detail panel exposes title, type/intel, planned duration, description, progress, and Start/Resume.
- [IMPLEMENTED] Focus decisions happen after the session, not over the active explorer.
- [PARTIAL] Verify Today keeps the map visually dominant at supported minimum and standard window sizes.
- [PARTIAL] Verify the detail panel supports the map rather than visually overpowering it.
- [PARTIAL] Verify Archive reads first as a place, not a dashboard or card list.
- [IMPLEMENTED] Verify keyboard focus and accessible labels on visual controls.
- [IMPLEMENTED] Verify reduced-motion mode collapses decorative transitions without blocking navigation.
- [PARTIAL] Run the app after every UI change; screenshots alone are insufficient for focus timing and interaction flow.

## Visual and copy QA

- [PARTIAL] Check for excessive glow, bloom, sparkles, gold dots, or rim light.
- [PARTIAL] Check that important light sources are few, purposeful, and hierarchical.
- [PARTIAL] Check that deep shadow and quiet negative space remain.
- [PARTIAL] Check for drift toward bright cartoon, mobile-game gloss, clean-vector fantasy, or generic AI fantasy.
- [PARTIAL] Check for repeated rounded cards, glass panels, dividers, and landing-page hero composition.
- [PARTIAL] Check that Today Map has not become a small widget.
- [PARTIAL] Check that Archive has not become an analytics dashboard.
- [PARTIAL] Check that detail UI does not dominate the world/map.
- [PARTIAL] Remove duplicated task titles or explanatory copy when the visual state is already clear.
- [PARTIAL] Check for motivational slogans, fake-poetic filler, or a forced profound line on every screen.
- [PARTIAL] Verify event copy describes concrete places, objects, sounds, or changes.

## Required commands

Run from the repository root:

```powershell
npm test
npm run typecheck
```

For a UI change, also run the development app and complete the relevant manual checks:

```powershell
npm run dev
```

Do not declare a visual change complete from compilation alone.
