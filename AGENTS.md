# Focus Quest Agent Guide

## What Focus Quest is

Focus Quest is a local-first Windows focus game currently built with Electron, React, Phaser, TypeScript, and SQLite. Phaser describes the current renderer, not the approved future visual direction.

Its central rule is:

> Real focus time is exploration progress in the game world.

The player does not finish work in order to unlock a separate game. The world advances quietly while the player works.

## Product Core

`Focus -> Progress -> Discovery -> Choice -> World Growth`

Do not reduce this to `Todo -> XP -> Level Up`.

## Core Interaction Rule

- During a focus session: calm, ambient, and very low interaction.
- After a session: a short gameplay, choice, and reward window.
- Across days: deeper meta progression through discoveries and visible world growth.

## Source of Truth

- [Core project plan, searchable Markdown](docs/Focus%20Quest%20%E2%80%94%20%E6%9C%80%E7%B5%82%E7%89%88%E6%A0%B8%E5%BF%83%E4%BC%81%E7%95%AB%E6%9B%B8%20v1.md) — complete working plan, including dated user-approved decisions that supersede the original PDF.
- [Core project plan, original PDF](docs/Focus%20Quest%20%E2%80%94%20%E6%9C%80%E7%B5%82%E7%89%88%E6%A0%B8%E5%BF%83%E4%BC%81%E7%95%AB%E6%9B%B8%20v1.pdf) — preserved original; it resolves transcription discrepancies outside the dated amendments.
- [Core plan agent brief](docs/CORE_PLAN_AGENT_BRIEF.md) — short working memory and section map; consult relevant Markdown sections when exact requirements matter.
- [Product vision](docs/PRODUCT_VISION.md)
- [Gameplay loop](docs/GAMEPLAY_LOOP.md)
- [Daily expedition](docs/DAILY_EXPEDITION.md)
- [Exploration system](docs/EXPLORATION_SYSTEM.md)
- [Archive and meta progression](docs/ARCHIVE_META_PROGRESSION.md)
- [Art direction](docs/ART_DIRECTION.md)
- [UI and UX rules](docs/UI_UX_RULES.md)
- [Copy style](docs/COPY_STYLE.md)
- [Data and state](docs/DATA_AND_STATE.md)
- [Technical architecture](docs/TECH_ARCHITECTURE.md)
- [QA checklist](docs/QA_CHECKLIST.md)
- [Repository map](docs/REPO_MAP.md)

Explicit user instructions govern the current task. For intended product direction, the core project plan governs; use the brief and focused design documents to navigate it. If a supporting document conflicts with the plan, follow the plan and report the conflict. For claims about what works now, production code and tests are authoritative. Current code does not automatically define the permanent design; future design in a document does not mean it is implemented. The plan is a goal, not authorization to implement every feature in one task.

`docs/ui-system-v3.md` and `docs/ui-visual-compression-v4.md` are supporting visual-history documents. The focused rules above take precedence when they conflict.

## Before modifying code

1. At the start of each new task, read this file once and retain the core plan brief in working context. Open only the relevant sections of the full Markdown plan when the task needs exact requirements or the brief leaves an ambiguity. Use the original PDF only for a possible transcription error; later dated decisions in the Markdown plan take precedence. Do not reread these before every command.
2. Read only the additional documents relevant to the task.
3. Inspect the related production code and tests.
4. Do not reinvent the product direction.
5. Do not let visual work break a state machine.
6. Do not let gameplay work break productivity features.
7. Prefer the smallest useful vertical slice.
8. Run tests and typecheck after changes.
9. If UI changed, Codex launches the app and performs visual QA, screenshots/recordings, and integration checks. When a secondary monitor is available, open Windows QA/test windows there; use the primary monitor only when no secondary monitor is available. Claude supplies design references, assets or prototypes; Codex implements the production scene and performs all runtime checks. Do not require Claude to deliver App modules, launch windows or capture screenshots.
10. Do not redesign unrelated systems.
11. After a new Windows test build has passed verification, close only the currently running Focus Quest version and launch the newly packaged build so the user never unknowingly tests an older version.

## Hard Constraints

Do not turn Focus Quest into a SaaS dashboard, ordinary Pomodoro skin, combat RPG, gacha, idle clicker, animated wallpaper, or XP-farming app.

[DO NOT IMPLEMENT]

- Gameplay that requires repeated input during focus.
- Clicking treasure, choosing events, opening inventory, choosing relics, or choosing routes during focus.
- A rule that makes 90-minute sessions inherently higher-quality or rarer in reward than 25-minute sessions.
- Coins, XP, or gear score as the primary reward.
- Punitive daily streaks, damage, game over, or missed-day punishment.
- Dense motivational copy or generic AI-fantasy glow and sparkles.

## Working Method

For each task: read guidance, inspect the real code, make the smallest implementation plan, implement only the scoped change, and run available tests/typecheck. Codex owns production implementation, prototype porting, bug fixes, tests, running-app visual QA and packaging. Claude hands off design references, assets or prototypes; production modules and runtime setup are not prerequisites for that handoff.

## Codex and Claude collaboration

**2026-09-27 user decision, superseding earlier implementation ownership:** Claude is responsible for design only: map concepts, composition, UI layout, art direction, motion and interaction design, plus optional visual prototypes/assets. Codex owns everything needed to ship that design: production frontend and scene implementation, animation playback code, porting HTML/web prototypes into the App, gameplay rules, traveller behavior/routes, Focus timing, five-lamp logic, Electron/SQLite, persistence, shared contracts, fixes, tests, integration, visual QA and Windows packaging. The user decides product direction and accepts the final experience.

Codex may implement or fix frontend and scene files directly while preserving the accepted design; do not send implementation work back to Claude or wait for Claude to create production scene modules. Existing HTML prototypes are valid design handoffs. Ask for design clarification only when the supplied design leaves a material product decision unresolved. This ownership change does not authorize redesigning accepted visuals or inventing new gameplay rules. New gameplay effects require the user's approval unless already covered by the approved plan/task.

Claude can describe event content, visual behavior, coordinates and anchors. Codex implements both the visual playback and the authoritative selection, eligibility, timing, outcomes, persistence and recovery. Ambient events during Focus require no player action; choices appear after Focus. Animation completion or failure must not become the authority for persisted game results. Before editing shared files, identify the active writer and preserve other agents' work.

Follow [the shared handoff workflow](docs/AGENT_WORKFLOW.md). In the current uncommitted checkout, only one agent should write to the same working directory at a time. Do not reset, clean, stash, or overwrite another agent's work. The same-machine handoff does not require a Git push.

At the start of a collaboration task, read [the shared current handoff index](docs/COLLABORATION_STATUS.md) after the brief and workflow. Use its linked latest handoffs to resume within the user's authorized scope; do not ask the user to paste their contents. Update the relevant existing handoff and index row when handing off. The index is advisory, not a writer lock, product authority, implementation authorization or background task dispatcher.
