# Archive and Meta Progression

## Role of the Archive

The Starlight Archive is the visual meta-progression hub: a place the user gradually builds through focused time, discovery, and restoration.

It is not a dashboard, a card-grid collection album, or a numeric level screen. The first impression should be a place. Information is revealed through its rooms and objects.

## Current implementation

- [IMPLEMENTED] `LivingArchive.tsx` presents a world-first Archive surface with a map wall, observatory, relic shelf, astrolabe, letters desk, and locked north wing.
- [IMPLEMENTED] Archive collection data is derived from cleared or reward-resolved expedition nodes and acquired run relics.
- [IMPLEMENTED] Locations, events, relics, and the discovered letter can appear in Archive state.
- [IMPLEMENTED] One restoration project, `restore_astrolabe`, checks for the Glass Observatory discovery, Broken Compass relic, and Lost Letter event, then persists completion.
- [IMPLEMENTED] `ArchiveGame.tsx` supplies an ambient Phaser archive scene for home/journey/debrief contexts.
- [PARTIAL] The current scene and page communicate a place, but much of its growth is still labels, layered UI, and a single restoration rather than a broadly changing 2.5D environment.
- [KNOWN ISSUE] `ArchiveGame.tsx` still selects twelve visual world stages from total legacy `rpg.focusSeconds`. This conflicts with the desired discovery/restoration-driven progression spine.
- [KNOWN ISSUE] Legacy `light`, `materials`, `starPages`, and `ability` remain in `rpg_state` alongside the newer expedition/archive model.

## Collection should live in the world

The intended mapping is:

| Discovery | World expression |
| --- | --- |
| Relic | A physical object on the display shelf or at a restored mechanism |
| Letter | A new paper, drawer, or thread at the letters desk |
| Location | A mark, drawing, or connected route on the map wall |
| Event | A persistent environmental trace or archive record |
| Restoration | Changed architecture, light, motion, access, or function |

- [PARTIAL] Current UI has named zones and data-backed counts/content.
- [PLANNED] Collections should increasingly change the scene itself before adding more panels or cards.

## Growth stages

These are a product direction, not current database stages:

1. [PLANNED] **Broken, dim, empty** — the central hall exists but most mechanisms and wings are dormant.
2. [PLANNED] **Local repair** — a few lamps, shelves, and map marks return.
3. [FUTURE] **Connected rooms** — the astrolabe moves, the observatory opens, and collections visibly occupy the world.
4. [FUTURE] **Mature Archive** — multiple restoration chains alter architecture and animation.
5. [FUTURE] **Complete but calm** — rich and beautiful without neon saturation or constant spectacle.

The labels above must not become a simple `Lv1 -> Lv5` badge. Progression should be readable through architecture, objects, light sources, accessible areas, animation, and collection density.

## Permanent and daily layers

### Permanent meta layer

- [IMPLEMENTED] Discovery history is retained in expedition nodes and run relic rows.
- [IMPLEMENTED] Restoration completion is persisted separately.
- [PARTIAL] The Archive snapshot derives its current catalog from these records.
- [PLANNED] More restorations should transform the visible hub and unlock authored interactions.

### Daily run layer

- [IMPLEMENTED] Routes, node progress, and run relics belong to a Daily Run.
- [PARTIAL] Run relics currently behave more like collected run records and route-intel modifiers than a complete temporary build.
- [PLANNED] Evening settlement should clearly show which outcomes become Archive discoveries and which temporary effects end with the day.

## World areas

The long-term hub may include:

- [PARTIAL] Central astrolabe hall.
- [PARTIAL] Observatory.
- [PARTIAL] Relic display.
- [PARTIAL] Letters desk.
- [PARTIAL] Map wall.
- [PARTIAL] Unrestored/locked region.
- [FUTURE] Additional rooms only when they have a clear discovery or restoration purpose.

## Interaction and presentation rules

- Lead with the environment, then reveal details for a selected area.
- Make a restored object visibly different in shape, motion, function, or light—not only in text.
- Keep warm light sparse and purposeful.
- Preserve calm inspection; the Archive is a record, not a reward casino.
- Avoid duplicating every collection as both a world object and a dominant card grid.
- Keep all archive growth local-first and recoverable from SQLite-backed state.

## Non-goals

- [DO NOT IMPLEMENT] A generic analytics dashboard as the Archive.
- [DO NOT IMPLEMENT] A full-screen inventory before items have meaningful use.
- [DO NOT IMPLEMENT] Gear score, collection power, combat stats, or loot rarity as the hub's main language.
- [DO NOT IMPLEMENT] Continuous sparkles, rim light on every object, or a bright theme that erases the quiet archive atmosphere.
