# Focus Quest UI Visual Compression v4

## Diagnosis

The AI-like feeling did not come mainly from image quality. It came from repeating the same verbal structure everywhere:

- decorative eyebrow;
- large heading;
- explanatory sentence;
- English micro-label;
- rectangular control;
- numeric status;
- another caption explaining the status.

Paper texture and irregular edges cannot fix that structure. The v4 benchmark changes the information grammar instead of adding more decoration.

## New rule

Use pictures for state and navigation. Use words only for information that cannot be safely inferred.

Keep as text:

- the user's task title;
- the current micro-step;
- time and irreversible actions;
- short control labels when an icon alone would be ambiguous.

Turn into images:

- route progress;
- selected state;
- reminder intensity;
- on/off state;
- coat and lantern colours;
- archive resources;
- chapter progress;
- navigation categories.

All visual-only controls retain `aria-label`, keyboard focus and a hover title.

## Today benchmark

Removed:

- the duplicated giant task title;
- motivational paragraph;
- English `TODAY'S EXPEDITION` label;
- progress percentage and `0 / 3` text;
- second fully labelled action button.

Added:

- a drawn route with one node per micro-step;
- completed, current and future nodes expressed by shape and light;
- one pinned quest note containing the only copy that matters: task and next step;
- icon-only secondary action;
- resource glyphs with numbers but no repeated labels.

## Settings benchmark

Removed:

- standard select menus;
- iOS-style switches;
- one explanatory paragraph under every control;
- stacked rectangular setting cards.

Added:

- three illustrated reminder modes;
- hand-drawn check marks for rituals;
- a live traveller silhouette with two rows of colour swatches;
- pictorial backup, restore and record seals;
- irregular connecting lines that make the page read as one tool atlas.

## Text budget

- Page title: preferably 2–6 Chinese characters.
- Primary button: preferably 2–4 characters.
- Only one supporting sentence per screen; zero is acceptable.
- No decorative English micro-label unless it belongs to a physical world object.
- Never show the same task title in two equally prominent places.
- Do not explain a visual state in text if the state is already obvious and safely reversible.

## Product implication from the reference conversation

The strongest long-term loop is:

`focus time → world movement → discovery → collection`

The work screen should remain quiet. The richest illustration and animation should happen after a session ends. This benchmark does not silently change the reward economy or database rules; that product decision should be designed and play-tested separately before implementation.

## Rollout gate

Today and Settings are the benchmark screens. Extend this grammar to Library, Insights and task creation only after the benchmark direction is approved. Do not package it as the next public test build merely because it compiles.
