# Exploration System

## Purpose

Focus Active uses **timer-driven autonomous exploration**. The player works while a traveller makes the elapsed time legible through movement, observation, rest, and mandatory route milestones.

The system must be neither a fixed recorded animation nor a pure random walk.

## Current architecture

This section describes the existing Phaser implementation. The approved front-end redesign may replace its presentation layer with Claude's final scene. Codex retains focus timing, traveller decision/route rules, five-lamp logic, persistence, and the state/scene-anchor contract; Claude retains the scene, camera, character appearance and animation, and environment motion. Do not make the old renderer or old map coordinates a visual requirement for the new scene.

```text
React session timer
        |
        v
ProgressController
        |
        v
ExplorationPlanner
        |
        v
ExplorerBrain state machine
        |
        v
waypoint path / interaction
        |
        v
ExplorationScene (Phaser presentation)
```

- [IMPLEMENTED] `FocusExplorationGame.tsx` is the React-to-Phaser bridge. React supplies elapsed seconds, target seconds, session ID, run seed, and node ID.
- [IMPLEMENTED] `ProgressController.ts` treats elapsed timer progress as authoritative and calculates mandatory lamp milestones, preparation timing, and speed pressure.
- [IMPLEMENTED] `ExplorationPlanner.ts` finds legal graph paths and scores optional or mandatory targets.
- [IMPLEMENTED] `ExplorerBrain.ts` owns the autonomous state machine and short-term exploration memory.
- [IMPLEMENTED] `ExplorationScene.ts` renders the map, traveller, fog, canopy, lamps, paths, tweens, and interaction presentation.
- [IMPLEMENTED] `MapDefinition.ts` defines the waypoint graph and interactive objects in data rather than burying navigation inside the scene.
- [IMPLEMENTED] `InteractionRegistry.ts` maps interaction types to presentation duration, animation intent, and copy.
- [IMPLEMENTED] `ExplorerAnimationAdapter.ts` separates brain intent from the current shape-based traveller presentation.
- [IMPLEMENTED] `SeededRandom.ts` creates deterministic session variation.

This split already exists. It is not a future-only architecture and the explorer logic is not contained in `ArchiveGame.tsx`.

## Timer authority

The timer is the only source of truth for focus progress.

```text
elapsed / target = progress ratio
```

For a ten-minute session:

- 0 minutes means 0% progress.
- 5 minutes means approximately 50% progress.
- 10 minutes means 100% progress.

The traveller expresses that progress. Distance walked, animation frames, pathfinding, a hidden object, or a stalled tween must never determine focus credit.

- [IMPLEMENTED] Five progress-critical lamps are distributed across the route, one due at each fifth of planned Area exploration time.
- [IMPLEMENTED] At 50% timer progress, 2 of 5 lamps are due; the third is due at 60%.
- [IMPLEMENTED] At 100% planned time, all 5 are due. For 25-, 50-, and 90-minute Areas, the intervals are 5, 10, and 18 minutes respectively.
- [IMPLEMENTED] The planner raises the next mandatory lamp's priority before its due time so the traveller can approach and prepare rather than relying on a disconnected last-second visual change.
- [IMPLEMENTED] Optional actions are rejected when their duration would put the next mandatory milestone at risk.

## Explorer brain

The current state machine contains:

- `IDLE`
- `CHOOSE_TARGET`
- `WALK`
- `ARRIVE`
- `INTERACT`
- `LOOK_AROUND`
- `REST`

The planner combines graph distance, object type, visited state, recent targets, repeated interaction type, time until the next mandatory milestone, and seeded jitter. This is a small utility-selection system with deterministic variation, not machine learning.

- [IMPLEMENTED] Shortest paths use the waypoint graph.
- [IMPLEMENTED] Mandatory lamp targets take priority when due or when travel/preparation time requires it.
- [IMPLEMENTED] Safe time windows permit ambient discovery.
- [IMPLEMENTED] Recently visited or repetitive targets are discouraged.
- [IMPLEMENTED] Seeded jitter prevents every session on the same map from feeling identical.
- [PARTIAL] Brain memory lives in the Phaser runtime and is not persisted as exact action history.

## Interaction classes

### Progress-critical interactions

These synchronize the presentation with timer progress:

- [IMPLEMENTED] Lamp milestones.
- [FUTURE] Beacons, major landmarks, or route-specific milestone forms can reuse the same rule.

Progress-critical interactions must be guaranteed, schedulable, and recoverable from elapsed time.

### Ambient discovery

These make the traveller feel alive but do not award or withhold focus progress:

- [IMPLEMENTED] Treasure-style observations.
- [IMPLEMENTED] Inspect points.
- [IMPLEMENTED] Rest points.
- [FUTURE] Letters, plants, viewpoints, statues, desks, or small relic presentations when supported by authored maps and data.

[DO NOT IMPLEMENT] Player-clicked treasure or event decisions during Focus Active. Ambient interactions are autonomous presentation; post-session discoveries belong in Debrief.

## Current map content

- [IMPLEMENTED] `FOREST_MAP` is the one current authored `MapDefinition`.
- [IMPLEMENTED] It uses normalized waypoint coordinates, a connected graph, five mandatory lamps, and eight optional interaction objects.
- [PARTIAL] The format is intentionally compatible with a future invisible object-layer workflow, but it is currently a TypeScript definition rather than exported Tiled JSON.
- [PLANNED] Additional maps or biomes should use the same data contract before adding new scene-specific logic.

## Seed and variation

The exploration seed is derived from:

`DailyRun seed + ExpeditionNode ID + FocusSession ID`

- [IMPLEMENTED] The same inputs produce the same deterministic seed.
- [IMPLEMENTED] Different session IDs introduce different ambient choices on the same map.
- [IMPLEMENTED] Tests cover stable seed generation and variation across sessions.
- [PARTIAL] A restart reconstructs the mandatory checkpoint from current timer progress and positions the traveller at the latest lit lamp. The scene also advances its random stream approximately from elapsed time.
- [KNOWN ISSUE] Visited ambient objects, recent-target memory, the exact current path, and interaction-in-progress are not persisted. Restart recovery is coherent at the timer/lamp checkpoint, not an exact replay of the pre-restart frame or action history.

## Recovery contract

Persistent focus truth remains in SQLite: the active session, its start/suspend data, and its bound run/node. On renderer recreation:

1. React recomputes elapsed effective time.
2. `ProgressController` computes the due mandatory milestone count.
3. `ExplorationScene` lights the due lamps and restores the traveller near the latest checkpoint.
4. The seeded brain resumes autonomous presentation.

This is [PARTIAL] recovery by design today. Exact autonomous-history persistence should only be added if visual discontinuity proves materially harmful; it must not become a second source of focus truth.

## Tool boundaries

- [IMPLEMENTED] Phaser is the current runtime 2D game engine; it is not required for the approved front-end redesign.
- [PARTIAL] The current traveller is drawn/presented through the Phaser adapter rather than a production character-animation asset pipeline.
- [FUTURE] Tiled may author map art alignment, invisible waypoints, edges, interactions, and milestone metadata. Tiled is not currently installed or required.
- [FUTURE] Spine may replace the animation adapter for richer character animation. Spine is not installed and must not be a prerequisite for validating the explorer prototype.
- [DO NOT IMPLEMENT] An LLM, AI model, or machine-learning service for navigation. The correct tools are state machines, utility scoring, seeded randomness, a waypoint graph, and timer-driven planning.

## Safe extension order

1. Preserve timer authority and existing recovery tests.
2. Extend `MapDefinition`, not scene-specific hard-coded branches.
3. Add authored interaction metadata to `InteractionRegistry`.
4. Validate the planner can still reach mandatory milestones.
5. Add presentation through `ExplorerAnimationAdapter`.
6. Run exploration tests and visual QA at 0%, around 50%, and near completion.
