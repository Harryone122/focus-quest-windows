# Focus Quest UI System v3

## Product decision

Focus Quest remains an Electron + React + Phaser application.

- Electron owns Windows integration: tray, notifications, always-on-top blocker, native files, process detection and SQLite.
- React owns accessible text, forms, keyboard navigation and task state.
- SVG/CSS owns hand-drawn frames, brush transitions and tactile controls.
- Phaser owns the archive environment, camera movement, scene tweens and later character animation.

Moving the whole product to Unity would require rewriting the strongest parts of the current application while not solving the art-direction problem by itself. Reconsider Unity only if the archive becomes a continuously playable world rather than a short reward layer.

## Pre-v3 UI audit and redesign map

| Surface | Current issue | Redesign direction | Priority |
| --- | --- | --- | --- |
| App navigation | Clean vertical software sidebar; selection is mostly a background fill | An archival index rail with ink tabs, hand-drawn selected mark and brush transition | P0 |
| Today / Main Menu | Cinematic, but still a website hero with a rectangular status card | Layered expedition journal: painted world, pinned task note, asymmetric resource annotations | P0 |
| Quest UI | Repeating dashboard cards and perfect rectangles | Inserted paper slips, ink check marks, pencilled progress and staggered entry | P0 |
| Task creation | Conventional modal wizard and form controls | A four-page field journal with drawn page turns; preserve real form semantics | P1 |
| Focus setup | Conventional settings modal | A compact departure checklist with physical toggles and stamped commitment choice | P1 |
| Focus HUD | Strong hierarchy, but centred rings feel generic and mostly static | Minimal lantern HUD; hand-drawn time arc and contextual controls | P1 |
| Reward screen | Centred modal with numbers; reward has little weight | 700–900 ms presentation: dim, ink ring, object overshoot, written title, staggered rewards | P0 |
| Archive / Character UI | World scene is present, but resource strip and repair panel sit on top like web cards | Diegetic brass index, loose annotations and animated route drawing | P1 |
| Insights | Analytics dashboard with four stat cards and bars | Observer's ledger: annotated graph, margin notes and ink marks; keep numerical clarity | P2 |
| Settings | SaaS preference rows | Archivist's folio with indexed sections, underlined fields and physical switches | P1 |
| Blocker | Centred glass-like modal | Full-screen ink interruption with one dominant return gesture | P1 |
| Loading | Logo plus text | Pencil line draws the lantern, then the archive title is written | P2 |
| Mini timer | Functional but generic floating card | Small torn note / lantern tag with almost no chrome | P2 |
| Inventory | Does not exist | Do not invent one until items gain meaningful use | N/A |
| Pause menu | Does not exist | Not needed in the productivity shell | N/A |
| Dialogue | Does not exist | Add only with authored archive characters | Future |
| Game Over / Damage | Conflicts with the no-punishment product principle | Never add punitive damage or game-over UI | N/A |
| Tutorial | Embedded copy only | Later convert first-run guidance into dismissible handwritten annotations | P2 |

## World materials

1. **Archive paper** — charcoal paper, warm parchment slips and visible fibre.
2. **Ink** — imperfect outlines, dry-brush wipes, check marks and annotations.
3. **Brass index** — sparse functional highlights, never a full metallic frame.
4. **Star-lantern light** — reserved for progress, selection and rewards.

No glass panels, generic neon, particle fields or repeated rounded cards.

## Motion language

| Interaction | Duration | Motion |
| --- | ---: | --- |
| Hover | 120 ms | Scale 1.02–1.03, frame draws, label shifts 2 px, icon rotates 2–4 degrees |
| Press | 90 ms | Scale 0.94–0.97 and dark ink compression |
| Release | 150 ms | Small 1.04 overshoot, then rest |
| List entry | 220 ms + 38 ms stagger | Paper slip translates along its own angled edge |
| Menu open | 260 ms | Ink line leads; paper unfolds behind it |
| Menu close | 150 ms | Paper retracts in the opposite direction |
| Large view change | 420 ms | Three interruptible dry-brush bands cover, swap, then clear |
| Important reward | 800 ms | Dim → ink ring → item pop → title write → details → confirm |
| Ambient | 2.4–6 s | At most one selected element floats; texture moves below perception threshold |

Animations must never disable navigation. A new selection interrupts and replaces the current transition. `prefers-reduced-motion` collapses all sequences to near-instant state changes.

## Interaction hierarchy

- Level 1: active quest, start focus, blocker return, earned reward.
- Level 2: next step, task selection, resource change, settings choice.
- Level 3: paper drift, line jitter, background brush movement.

Only Level 1 may use large movement. Decorative motion stays below 2 px or runs slowly.

## Sound interface

UI code emits semantic cues without bundling placeholder sounds:

- `paper-hover`
- `ink-select`
- `paper-open`
- `paper-close`
- `reward-accent`
- `warning-brush`

Final sounds should be paper, graphite, dry brush, muted wood and restrained magical accents—not mobile click samples.

## Delivery order

1. Foundation primitives and material layer.
2. Navigation, Today, Quest cards and large transitions.
3. Reward, task journal and focus setup.
4. Settings, blocker, insights, loading and mini timer.
5. Archive diegetic UI, light-spending loop and traveller redesign.

## Beta 0.3 implementation status

Implemented in the current Windows build:

- Archival index navigation with original line icons and an interruptible three-band ink transition.
- Irregular paper silhouettes, charcoal fibre, dry-ink marks and asymmetric screen compositions.
- Journal-style task creation and departure checklist while preserving accessible HTML controls.
- Minimal lantern focus HUD, observer's ledger insights, diegetic archive choices and torn-note mini timer.
- Staged reward presentation and a full-screen asymmetric interruption screen.
- Semantic sound cue events for hover, select, open, close, reward and interruption; final sound assets remain a later audio-production task.
- Reduced-motion fallback, readable body typography and non-colour selected-state cues.

Intentionally not invented: Inventory, Pause Menu, Dialogue, Damage and Game Over. They do not yet exist in the product, and punitive damage/game-over feedback would contradict Focus Quest's no-punishment principle.
