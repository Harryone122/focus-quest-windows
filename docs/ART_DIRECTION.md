# Art Direction

This document records the current visual language and review principles. The 2026-09-25 core-plan decision gives Claude ownership of the entire front-end redesign, beginning with Focus Active. The user's accepted final Claude scene becomes the visual reference for that redesign; the older painted/Phaser assets below remain production history and reusable material, not a mandate to recreate the old scene. Supporting history is available in `ui-system-v3.md` and `ui-visual-compression-v4.md`.

## Existing visual language

- Dark.
- Ink-wash and hand-painted.
- Deep navy-black rather than pure digital black.
- Astronomical archive and observatory imagery.
- Mysterious, calm, and restrained.
- Sparse warm light with clear purpose.
- Controlled imperfection in line, edge, paper, and brush texture.

Current assets already use a charcoal paper material, disordered reading hall, lantern-traveller silhouette, and painted forest biome. These describe the present App; Claude can establish a coherent new visual language around the final scene the user approves.

## Materials

1. **Archive paper** — charcoal ground, warm parchment inserts, visible fibre, irregular silhouettes.
2. **Ink and graphite** — dry brush, imperfect lines, annotations, and physical marks.
3. **Brass index** — a sparse functional accent, not a full metallic frame around every surface.
4. **Lantern and starlight** — reserved for progress, selection, discovery, and restored mechanisms.
5. **Deep shadow** — large quiet areas are part of the composition, not unfinished space.

## Light hierarchy

Light must communicate importance.

- Primary: current route, mandatory milestone, central restored mechanism.
- Secondary: selected object, active note, one local discovery.
- Ambient: low-contrast atmosphere below the user's attention threshold.

Do not make every region, edge, particle, character, and collectible glow. A small number of warm lights against deep shadow will feel more authored and more mysterious than many equal bright points.

## Avoiding generic AI-fantasy appearance

- [DO NOT IMPLEMENT] Excessive bloom or glow.
- [DO NOT IMPLEMENT] Constant sparkles or floating light dots across the full screen.
- [DO NOT IMPLEMENT] Rim light on every object.
- [DO NOT IMPLEMENT] Gold flecks used as a universal filler.
- [DO NOT IMPLEMENT] Ornate fantasy VFX without gameplay meaning.
- [DO NOT IMPLEMENT] High-saturation neon palettes.
- [DO NOT IMPLEMENT] Clean-vector fantasy, bright cartoon rendering, or mobile-game gloss.
- [DO NOT IMPLEMENT] Glassmorphism and repeated luminous rounded panels.

Important objects may glow. The rule is scarcity, hierarchy, and meaning.

## Composition

- Let environment art carry state and navigation when it can do so safely.
- Preserve asymmetry and negative space.
- Avoid centered landing-page hero composition for ordinary product screens.
- Keep the expedition map visually dominant on Today.
- Keep the Archive readable first as an environment, second as an interface.
- Use paper slips, route marks, shelves, desks, walls, and instruments as spatial anchors rather than repeating generic cards.

## Motion

- [IMPLEMENTED] Current UI uses restrained paper/ink transitions and supports `prefers-reduced-motion`.
- [IMPLEMENTED] Focus exploration uses slow autonomous walking, looking, rest, and lamp actions.
- Use large motion only for primary state changes or an important post-session discovery.
- Make transitions interruptible and keep navigation available.
- Keep decorative breathing or texture motion very small and slow.
- Reserve the richer 700–900 ms reveal sequence for meaningful rewards after focus.

## Production status

- [IMPLEMENTED] The renderer has an established dark archival material system and existing painted/line assets.
- [IMPLEMENTED] Phaser scenes provide environmental depth and ambient movement.
- [PLANNED] Claude owns the new front-end visuals across all screens. Codex will connect the accepted visuals to existing local game logic and persistence, then Claude will inspect the integrated result.
- [PARTIAL] The current exploration traveller is a prototype presentation rather than a final hand-animated character.
- [PARTIAL] The Archive mixes environment-first intent with overlay information and legacy time-driven visual stages.
- [FUTURE] Additional painted biomes, stronger pseudo-isometric archive layers, and an optional richer animation pipeline.
- [FUTURE] Spine may be evaluated for character animation, but it is not a style requirement or current dependency.

## Art review questions

- Is the brightest point also the most important point?
- Is there enough darkness and silence around it?
- Does the screen look painted and materially grounded, or like a generic fantasy UI kit?
- Could one glow, sparkle layer, frame, or caption be removed without losing meaning?
- Does a discovery visibly change a place, or only add another badge?
