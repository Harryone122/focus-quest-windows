# Daily Expedition

## Definition

One local calendar day corresponds to one Daily Run. The run is elastic: one completed or partial session is valid, and many sessions may continue generating deeper route forks. There is no fixed twelve-room target in the current expedition logic.

## Current run rules

- [IMPLEMENTED] One active run can be created per `local_day` by the partial unique database index.
- [IMPLEMENTED] Starting the run again on the same day is idempotent and returns the active run.
- [IMPLEMENTED] A run stores its Main Quest, deterministic seed, current depth, and selected node.
- [IMPLEMENTED] Each fork currently contains two generated routes.
- [IMPLEMENTED] The first fork offers 25- and 50-minute rhythms. Later deterministic pairs may include 90 minutes.
- [IMPLEMENTED] Generation can continue by depth, so the run is not modeled as a fixed number of rooms.
- [PARTIAL] `passage`, `archive`, `cache`, and `detour` exist as node types, but current generation produces only `passage` and `archive`.
- [PARTIAL] Temporary relics are scoped to a run and influence route-intel presentation, but a broader temporary-build ruleset is not yet implemented.
- [PLANNED] Explicit end-of-day settlement, temporary-build reset, and a daily summary.
- [KNOWN ISSUE] Runs have `active` and `ended` statuses, but no current command marks a run ended. A previous day's run can remain `active` in SQLite even though it is no longer returned as today's run.

## Node lifecycle

```text
available <-> selected
                 |
              startFocus
                 v
               active
              /      \
       partial        awaiting_reward
          |                  |
       resume             choose relic
          |                  v
        active          awaiting_route
                             |
                       choose child route
                             v
                           cleared
```

### `available` — [IMPLEMENTED]

The route is part of the current fork and may be selected. It has not been committed by starting focus.

### `selected` — [IMPLEMENTED]

The route is highlighted and can start focus. Before `startFocus`, selecting its sibling releases it back to `available`.

### `active` — [IMPLEMENTED]

A Focus Session is currently bound to the node. The route is locked while that session is active.

### `partial` — [IMPLEMENTED]

The node stores cumulative `progress_seconds`. It grants no relic and generates no next fork. It may be selected and resumed later; switching to its sibling preserves the saved progress.

### `awaiting_reward` — [IMPLEMENTED]

The full threshold has been reached. Event and reward options are persisted, and child routes have been generated, but the relic has not yet been stored.

### `awaiting_route` — [IMPLEMENTED]

The relic has been stored. The user must choose one child route before the Debrief is cleared.

### `cleared` — [IMPLEMENTED]

The post-session choice sequence is complete and the selected child is now the run's route.

## Route switching and commitment

Before focus starts, the current fork is a planning choice, not a punishment. `available` and `selected` routes can be switched. A resumable `partial` route can also be selected, and switching away does not erase its progress.

The route becomes operationally committed only when `startFocus` creates a session and marks the node `active`.

## Partial and full resolution

- [IMPLEMENTED] Effective elapsed time under five minutes resolves as `too_short` and adds no progress to a fresh node.
- [IMPLEMENTED] Longer incomplete sessions add their effective seconds to `progress_seconds` and return the node to `partial`.
- [IMPLEMENTED] Partial progress accumulates across sessions and cannot grant its full reward twice.
- [IMPLEMENTED] Full completion uses a threshold of the smaller of 90% of planned duration or planned duration minus two minutes.
- [KNOWN GAP] The current database can resolve a node as fully complete before the fifth visual lamp becomes due at 100% of planned Area time. The five-lamp product rule is the target; align the completion rule in a separate, scoped gameplay task, not as part of a visual-framing fix.
- [IMPLEMENTED] Only full completion opens the event, relic, and next-route sequence.
- [IMPLEMENTED] A work outcome of `blocked` does not revoke time-based node completion.

## Focus rhythms: 25 / 50 / 90

The durations represent different focus rhythms, not difficulty or reward tiers.

Each Area has five mandatory visual lamp milestones, evenly spaced over its planned exploration time: every 5 minutes for 25-minute Areas, every 10 minutes for 50-minute Areas, and every 18 minutes for 90-minute Areas. The fifth is due at the planned time.

- 25 minutes supports a short, bounded work block.
- 50 minutes supports a standard deeper block.
- 90 minutes supports long-form work when the user already wants that rhythm.

[DO NOT IMPLEMENT] A universal rule that 90 minutes produces rarer relics, better-quality discoveries, or a morally better run. Longer time may naturally produce more total progress across the day, but quality must not be ranked by duration.

## Daily versus permanent state

### Daily / run-scoped

- [IMPLEMENTED] Run seed, route tree, current depth, selected node, node progress, and acquired `RunRelic` rows.
- [PARTIAL] Temporary build identity exists through run relics, but most relic effects are informational rather than systemic.
- [PLANNED] Formal reset/settlement of the daily route and temporary effects.

### Permanent

- [IMPLEMENTED] Cleared location, event, letter, and relic discoveries are derived from persistent run history.
- [IMPLEMENTED] Completed restoration projects persist.
- [PARTIAL] Archive growth has one implemented restoration and a limited visual world representation.
- [FUTURE] Multiple restoration chains, regions, world stages driven by discovery, and a richer long-term collection ecology.

## Product safeguards

- [DO NOT IMPLEMENT] Death or loss of saved partial progress at midnight.
- [DO NOT IMPLEMENT] A fixed daily room quota or forced boss.
- [DO NOT IMPLEMENT] Rarity determined solely by choosing a longer timer.
- [DO NOT IMPLEMENT] Route decisions during active focus.
