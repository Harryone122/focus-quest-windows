# Gameplay Loop

This document describes the player-facing loop and labels each step against the current repository. Detailed state transitions are in [Daily Expedition](DAILY_EXPEDITION.md); persistence is in [Data and State](DATA_AND_STATE.md).

## Current vertical slice

1. **Choose today's Main Quest** — [IMPLEMENTED]
   - A task can hold the `main` role.
   - Only an active Main Quest can start a Daily Run.

2. **Start the Daily Expedition** — [IMPLEMENTED]
   - `startDailyRun` creates one active run for the local day and generates the first fork.
   - Calling it again returns the existing active run.

3. **Choose a route node** — [IMPLEMENTED]
   - An available node can be selected from the Today map.
   - Before focus begins, the user may switch between routes in the current fork.

4. **Start a Focus Session** — [IMPLEMENTED]
   - Focus Setup binds the Main Quest, pending task step, run, node, and planned duration.
   - Starting focus changes the node from `selected` or `partial` to `active`.

5. **Autonomous exploration during focus** — [IMPLEMENTED]
   - Elapsed time drives progress.
   - The Phaser traveller walks a waypoint graph, performs ambient actions, and approaches five mandatory lamp milestones at equal fifths of planned Area time.
   - No route, event, relic, treasure, or inventory input is required.

6. **End the session and calculate resolution** — [IMPLEMENTED]
   - Under five effective minutes is `too_short` and adds no node progress.
   - A valid but incomplete session stores cumulative `partial` progress.
   - Reaching the full threshold changes the node to `awaiting_reward`.

7. **Record the real-world outcome** — [IMPLEMENTED]
   - The user records `completed`, `progress`, or `blocked` separately from whether the node was fully explored.
   - Task completion requires an explicit `completeTask` choice; session outcome alone does not complete the task.

8. **Reveal the event** — [IMPLEMENTED]
   - A full node receives a deterministic event and persisted reward options.
   - [PARTIAL] The authored event set is currently small.

9. **Choose a relic** — [IMPLEMENTED]
   - The database validates and persists one relic from the node's reward options.
   - Debrief presents the two persisted options and requires an explicit choice before the next route appears.

10. **Choose the next route** — [IMPLEMENTED]
    - After a relic is stored, the user chooses one of the generated child routes.
    - The completed node becomes `cleared`; the chosen child becomes `selected`; the run depth advances.

11. **Return to Today and focus again** — [IMPLEMENTED]
    - The snapshot returns to the Today map with the chosen route ready.
    - The route generator is depth-based and can continue producing forks rather than ending at a fixed room count.

## End-of-day loop

12. **End today's expedition / return to Archive** — [PLANNED]
    - The intended action is an explicit, safe end-of-day return rather than failure or death. The core plan does not call for a separate Camp system.
    - The current database has `DailyRunStatus = active | ended` and an `ended_at` field, but no command or UI ends a run.

13. **Daily summary** — [PLANNED]
    - Summarize paths taken, discoveries, partial progress, and the day's real focus record.
    - Do not turn the summary into a performance grade.

14. **Permanent meta progression** — [PARTIAL]
    - Cleared discoveries and acquired relics already populate Archive data.
    - One restoration project can be completed.
    - A larger discovery-driven, visibly changing Archive is future work.

15. **Fixed run ending or boss** — [DO NOT IMPLEMENT YET]
    - The current direction is an elastic daily run. Do not add a mandatory room count, boss, death, or fail state without a new product decision.

## Resolution and reward are separate axes

The code intentionally separates three questions:

- How much effective focus time accumulated on the node?
- What was the real-world work outcome?
- Did the user explicitly mark the task complete?

A `blocked` work outcome can still fully explore a node if enough focus time elapsed. A `completed` outcome does not automatically complete the task unless explicitly confirmed. This prevents the game from judging the value of real work by a simplistic success flag.

## Loop invariant

The loop must preserve:

`Guaranteed Progress + Variable Discovery + Meaningful Choice`

It must not become:

`Timer -> Random Reward Spam -> Currency Number Goes Up`
