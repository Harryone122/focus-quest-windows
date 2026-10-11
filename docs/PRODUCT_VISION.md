# Product Vision

## Product definition

Focus Quest is a Windows productivity game in which real focus time is the exploration action. A timer does not merely unlock a reward after the fact: while the user works, a traveller moves through a quiet world, reaches landmarks, and leaves persistent discoveries behind.

The intended experience is:

`Focus -> Progress -> Discovery -> Choice -> World Growth`

This is not a productivity dashboard with game decoration and not a separate game purchased with completed tasks.

## Experience allocation

- [IMPLEMENTED] Focus sessions prioritize the timer, task context, blocker, and quiet autonomous presentation. The expedition scene requires no gameplay input.
- [PARTIAL] The intended ratio is roughly 90% productivity and 10% game presentation during focus. The current scene supports this, but its information density and visual emphasis still require ongoing real-use validation.
- [PARTIAL] Session completion opens a short Debrief with outcome, discovery, and route flow. Route choice works; the relic step does not yet present a meaningful two-option choice in the UI.
- [PARTIAL] The Archive provides collection and one restoration action, but it is not yet a mature visual meta-progression world.
- [PLANNED] A deliberate end-of-day return to the Archive will settle the run and connect it to permanent progression, without a separate Camp system.

## Product principles

### Work and play are synchronized

The user should feel that the time spent working is the journey itself. Focus progress is always determined by elapsed focus time; the animation interprets that fact rather than controlling it.

### Depth without interruption

Game depth may be high across route planning, run builds, discovery, restoration, and collection. Interaction frequency during a focus session must remain extremely low.

### Guaranteed progress, variable discovery, meaningful choice

- Guaranteed progress: valid focus time advances the selected node, including partial progress that can be resumed.
- Variable discovery: seeds, events, routes, and ambient actions make sessions feel different.
- Meaningful choice: the user chooses a route and, after full completion, should choose a relic and next route.

Variation must not become random reward spam.

### No punishment for the shape of a real day

A day with one session is a valid run. A day with eight sessions is also valid. Partial progress is saved. The design does not require a boss, a fixed number of rooms, or a perfect daily streak.

## Reward hierarchy

Primary rewards are:

1. Visible world change.
2. Discovery of locations, events, letters, and relics.
3. Meaningful post-session choices.
4. Long-term visual progression.
5. An emotional record of time spent with intention.

XP, coins, resources, and numeric levels may support legibility, but they must not become the product's main emotional or economic engine.

## Current product boundary

- [IMPLEMENTED] Local tasks, task steps, focus timing, process blocker, reminders, mini timer, settings, backup, and analytics export.
- [IMPLEMENTED] A daily expedition slice with generated routes, node selection, resumable partial progress, full completion, event data, run relic persistence, and next-route choice.
- [IMPLEMENTED] A timer-driven autonomous Phaser exploration prototype with a waypoint graph, state machine, utility selection, seeded variation, and five mandatory lamps.
- [PARTIAL] A world-first Archive surface backed by discovered data and one restoration project.
- [KNOWN ISSUE] A legacy time/light progression loop still coexists with the expedition and discovery model. It is evidence of the earlier product, not the desired long-term reward spine.
- [KNOWN ISSUE] The current `README.md` still describes the focus world primarily as an animated background and emphasizes total-focus-time world stages. Production code has advanced beyond that description.

## Non-goals

- [DO NOT IMPLEMENT] Combat, damage, bosses, or game over.
- [DO NOT IMPLEMENT] PVP or competitive pressure.
- [DO NOT IMPLEMENT] Gacha or randomized paid pulls.
- [DO NOT IMPLEMENT] Mandatory login for the local-first core.
- [DO NOT IMPLEMENT] Daily punishment, lost streak value, or shame-based retention.
- [DO NOT IMPLEMENT] Large currency-farming economies.
- [DO NOT IMPLEMENT] High-stimulation interaction that interrupts focus.
- [DO NOT IMPLEMENT] An ordinary Pomodoro timer with a cosmetic fantasy skin.
- [DO NOT IMPLEMENT] An LLM or machine-learning dependency for the core gameplay loop.

## Decision test

A proposed feature belongs in Focus Quest only if it strengthens at least one of focus, discovery, meaningful choice, or visible world growth without increasing required interaction during focus. If it mainly increases clicks, currencies, notification pressure, or abstract level numbers, it is probably outside the product core.
