# UI and UX Rules

## Information hierarchy

Use pictures for reversible state and navigation when meaning remains clear. Keep text for the user's task, current step, time, progress that needs precision, and irreversible actions. Do not repeat the same task title at equal prominence or explain an already obvious visual state.

## Today

The target composition is approximately:

- Left two-thirds: Expedition Map.
- Right one-third: Main Quest and its immediate action.

The map is the primary question: **Where do I go next?** The page must not demote it to a small progress widget beside a dominant dashboard.

- [IMPLEMENTED] `TodayView` places `ExpeditionMap` beside Main Quest controls.
- [IMPLEMENTED] Nodes are selected independently from starting focus.
- [IMPLEMENTED] A selected node has a detail panel with title, route intelligence, description, planned minutes, saved progress, and Start/Resume.
- [PARTIAL] Final proportions and visual dominance must be checked in the running app whenever Today layout changes.

### Node interaction contract

```text
click node -> select
select -> inspect details
Start / Resume -> open Focus Setup
confirm departure -> start focus
```

[DO NOT IMPLEMENT] A route card or node click that both selects and immediately starts a session. Users must be able to compare/switch a current fork before commitment.

## Focus Setup

- [IMPLEMENTED] Focus Setup shows the task, selected route, planned duration, minimum commitment, blocker selection, and phone ritual.
- Keep it a departure checklist, not an inventory or build-management screen.
- Do not insert relic, route, or event decisions here unless a future design explicitly assigns a pre-session choice that does not pressure the user to min-max work duration.

## Focus Active

The game moves; the player works.

Allowed presentation:

- Traveller movement.
- Autonomous inspection and rest.
- Lamp or landmark milestones.
- Small found-object or environmental gestures.
- Task, current step, elapsed time, and essential session controls.

Forbidden interaction:

- [DO NOT IMPLEMENT] Click treasure.
- [DO NOT IMPLEMENT] Click or choose an event.
- [DO NOT IMPLEMENT] Open inventory.
- [DO NOT IMPLEMENT] Choose a relic.
- [DO NOT IMPLEMENT] Choose a route.
- [DO NOT IMPLEMENT] Command the explorer.
- [DO NOT IMPLEMENT] A timed reaction, precision input, or attention check.

- [IMPLEMENTED] Current `FocusActive` uses `FocusExplorationGame` for expedition sessions and has no required gameplay input.
- [IMPLEMENTED] Session timing and ending controls currently remain in React, outside Phaser. In the redesign, these controls may receive Claude's new presentation, but the authoritative timing stays outside the scene renderer.

## Session Debrief

Debrief is the 30–60 second high-interaction window after work.

Intended order:

```text
real-world outcome
-> event/discovery
-> relic choice
-> next route
-> return to Today
```

- [IMPLEMENTED] Debrief persists across restart and records outcome separately from task completion.
- [IMPLEMENTED] Full resolution gates event/relic/route flow; partial resolution saves progress without reward.
- [IMPLEMENTED] Relic choice presents the two persisted options and requires an explicit choice.
- [IMPLEMENTED] Next-route choice is visible and required after relic persistence.

Do not place this decision flow inside Focus Active.

## Archive

Archive is world-first, not panel-first.

1. Show a place.
2. Let the user select a meaningful area or object.
3. Reveal concise supporting information.

- [PARTIAL] `LivingArchive` follows this direction with named world zones.
- [PARTIAL] Its environment and collection growth are not yet deep enough to replace all explanatory UI.

[DO NOT IMPLEMENT] A SaaS dashboard, collection-card wall, marketing hero, or analytics home disguised as the Archive.

## General interaction rules

- Keep one dominant action per state.
- Make irreversible actions explicit and text-labeled.
- Support keyboard focus and `aria-label` for visual controls.
- Respect reduced-motion settings.
- Keep route selection reversible until focus starts.
- Preserve partial progress and describe Resume honestly.
- Do not block navigation with long decorative animation.
- Use concise labels: page titles 2–6 Chinese characters and primary actions 2–4 when clarity permits.

## Avoid dashboard drift

Review any new UI for these warning signs:

- Repeated rectangular cards with identical heading/body/button structure.
- Decorative English eyebrow labels.
- A marketing headline and paragraph above functional content.
- Multiple dividers and status chips standing in for an environment.
- The same task, progress, or reward stated in several places.
- The map or Archive world reduced to a decorative header image.
