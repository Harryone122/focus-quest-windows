# Focus Quest core plan: agent brief

## 2026-10-13 Area 07 樓梯與互動修正（0.6.34）

使用者要求移除苗圃樓梯懸空坐姿；正式排程與測試頁已取消 `stairSit`，舊存檔原時段改等待。苗圃低幀率行走與育苗機繞行、轉盤連續休息及苔痕貨車坐姿過渡已修正。四圖低幀率全程檢查、214 測試與包內完整流程通過，發布與存檔核對見 `RELEASE_0.6.34_QA.md`。保留已驗收模型、音效與有效時間規則。

## 2026-10-05 Area 07 正式整合（0.6.29）

玻璃苗圃與照料者移植支線已整合，待使用者試玩。幼苗從 02 帶走後跨旅程保留到 07 種下；新探索才長大，階段 2 的完整探索後在大廳選擇移植或延後。移植不結束旅程，保存永久小樹、新刻度與兩樹筆記。五燈、故事／特殊發現、營火剪影、8 秒出口及暫停接線已完成；190 項測試、包內驗證與防穿模證據見 `RELEASE_0.6.29_QA.md`。採集日期 11·02 仍待定，音效由使用者製作。

## 2026-10-03 Area 03 第 5 階段（0.6.25）

使用者在設計完成後授權接線，4 個故事、5 個信物事件及 11 線索已接入正式後端／場景／收藏室；暫停、提前結束、舊存檔與滿潮五燈排程已檢查。186 項測試與建置通過，證據見 `RELEASE_0.6.25_QA.md`。此段取代下文所有「第 5 段仍待設計」記載；全遊戲五段結局仍不在本次範圍。

## 2026-10-03 Area 03 正式整合（0.6.24）

使用者授權接上 Claude 已驗收的倒影湖畔第 1–4 段並將音效打包。正式 App 已加入第三張候選地圖、有效時間五燈、種子潮汐、後端旅人排程／世界記憶、兩種信物／湖鏡永久核心及跨图出口／大廳／收藏室接線。28 來源錄音收錄（26 修正版＋兩份原音樂），不採用未驗收的重新移調編排候選。175 項測試、建置與包內 Electron 驗證見 `RELEASE_0.6.24_QA.md`；第 5 段故事／信物故事／線索仍待設計，不能把本次整合解讀為全部地圖故事完成。此段取代下文較早的「Area 03 尚未整合／音效尚未打包」狀態。

This is short, persistent project memory for the complete `Focus Quest — 最終版核心企畫書 v1.md` (v1.0, 45 original sections plus dated amendments, including the new §46). The Markdown is the searchable working copy; later user-approved decisions in it supersede the original 32-page PDF. The PDF resolves other transcription discrepancies. This brief helps agents orient without rereading the full plan for every command. It describes intended goals, not the current implementation status. Consult production code and tests for current behavior.

## Latest ownership decision (2026-09-27)

Claude now handles design only (including optional web prototypes/assets). Codex owns all production frontend/backend work, prototype porting, animation implementation, fixes, tests, integration, visual QA and packaging. This supersedes older Claude-frontend-implementation ownership in historical notes. Do not wait for Claude to deliver App modules: Codex will port the existing Moss Station HTML prototype while preserving its accepted design. See `AGENT_WORKFLOW.md`. This instruction updates responsibility; it does not itself report the port as finished.

The ten basic maps form a route candidate pool. New maps supplement existing choices; Moss Station does not replace Cloud Ruins, which remains available for selection and revisits. Map numbering is not mandatory visit order.

## Area 02 backend integration (2026-09-27)

Moss Station backend contracts are implemented; read `AREA_02_BACKEND_HANDOFF.md`. Map-specific rewards/pity, persistent weather seed per exploration, authored traveller scheduling, rain routing, umbrella, world counters/notes and departure IPC are verified locally (121 tests plus real Electron main/preload QA). Backup v9 imports v1–v8. The supplied frontend port is now integrated: AreaFocusScene selects the saved map, the Moss scene reads backend actions/weather/world state, and the lobby supports boat/tunnel exits. New routes offer both released maps with their own titles and 50-minute durations; existing saved 25/90-minute routes remain unchanged. Cloud Ruins remains available for revisits. See RELEASE_0.6.13_QA.md for integration verification. Follow-up 0.6.14 moves the boulder/tablet anchors and routes around the rock on dry ground; cross-map playback retains the source frame until the destination has rendered, then fades in without a solid mist. See RELEASE_0.6.14_QA.md (132 tests, four packaged Windows exits, existing save preserved).

Area 02 follow-up (2026-09-27): walk actions now carry a full remaining `plan` and absolute per-leg end times; weather updates preserve the current edge. Event selection adds current/previous-place exclusion with eligible-only fallback, distance weighting and persisted 15/30-minute cooldown history. Dry/rain shortest paths are cached. See the Codex reply after Claude's reply in `AREA_02_BACKEND_HANDOFF.md`; 129 tests and a new 60-run/300-lamp simulation pass. These updates are scoped to Area 02; the first map's existing ambient renderer planner has not been migrated.

## Forest lamp and background fix: 0.6.9 (2026-09-27)

HUD, scene lamps and reward eligibility share `shared/lampTiming.ts`. Lamp light is determined by supplied effective Focus time, never by completing a reveal or walk. Planner activities reserve the next lamp deadline. Keep the main window's `backgroundThrottling: false` AND the scene's pause-aware background frame watchdog: Windows may stop RAF on minimize even without throttling. Do not replace them with a replay/catch-up queue. Details and runtime evidence: `FOREST_LAMP_BACKGROUND_FIX.md` and `previews/lamp-sync-qa/`. Manual pause/system sleep retain the existing freeze behavior.

## Forest backend implementation: 0.6.6 (2026-09-26)

The scoped Area 01 handoff is implemented: a persisted one-of-two journey item and lamp, independent core 5% rolls/fifth-visit guarantee, permanent `mapCores`, and `tree_traces_seen` via `worldMarks`. Existing scene animation IDs are unchanged. New automatic rewards skip the old generic Relic-choice award. Backup v6 includes the new tables and migrates legacy core ownership. Read `FOREST_BACKEND_0.6.6_HANDOFF.md` for exact contracts and compatibility limits. This does **not** implement the cross-day journey, all-50-minute route generation, five-stage ending or §47 lobby/task redesign. Existing route durations and old recorded rolls remain intact; only completed 50-minute visits under the new forest tracking count toward pity. No pending design decisions about item effects/carryover have been implemented.

## Latest design decision: 2026-09-26, core plan §46

The user approved recording a cross-day journey and ten-map content draft before implementation. Read §46 for the full rules, all ten maps, their two journey items and permanent core, revisit clues, item combinations, and narrative. This supersedes older daily-run and shared special-find-pool rules, including earlier decisions on the same date. It is NOT implemented in 0.6.5 and does not authorize starting development before the design is settled.

- The traveller follows records to find a person who is their future self. This is author-side knowledge; early encounters provide puzzling clues, not a dismissive response or an immediate identity reveal.
- Every new Area exploration targets 50 effective minutes; five lamps fall at 10-minute intervals. Five completed explorations, including the first map, lead to the final encounter after Focus ends: 250 exploration minutes across as many days/sessions as needed. The final encounter is not an additional 50-minute map. Map combinations affect content, not initial journey length.
- Each map has two journey items (one guaranteed per completed exploration) and one unique permanent core. Only the core uses the independent 5% per-lamp chance. After four completed visits without the core, the fifth new exploration has a persisted random guaranteed lamp; an earlier random success cancels the guarantee. Partial resumes do not count as new visits. Counts and cores survive journey endings and dates.
- Ten distinct map cores unlock the true-ending route; zero cores still allow a final encounter. Specific cores and their count affect dialogue. Other items and choices support side endings. Permanent discoveries are saved immediately, not only at journey settlement.
- The ten-map draft is: 雲上遺庭, 苔痕驛站, 倒影湖畔, 風切斷橋, 回聲採石場, 潮汐郵驛, 玻璃苗圃, 無聲書庫, 停擺鐘樓, 折光觀測台. The order is not mandatory. Repeat visits should expose new uses of items and clues; targeted revisit generation remains to be specified.
- Lobby direction: close-up of the resting traveller, especially the accepted tree-side writing/lying animations. Claude and the user will settle camera and choice layout. Preserve the user-approved first map and its three items: old_wick, weathered_lens, astrolabe_core.
- Pending details include duplicate journey items/carryover, route generation, event scripts, time-loop causality/endings, partial lobby framing, legacy migration and the existing sub-five-minute progress gate. Do not silently resolve these through implementation. Supporting docs describing Daily Run or the old 5% shared pool may be historical implementation notes.

## Latest design decision: 2026-09-26, core plan §47 (lobby and task list)

**2026-09-27 integration update (0.6.8):** Claude delivered LobbyA, DepartureSheet, AfterFocus and the glass navigation rail. Codex connected production Today and expedition review via `lobby/fromSnapshot.ts` and `ConnectedLobby.tsx`, with saved tasks/routines, partial continuation, full-map return to lobby, next-exit choice and persisted discovery reads (`seenFindIds`, backup v8, imports 1–7). Legacy pending reward choices remain accessible as event cards. The original scene/layout was not redesigned. See `LOBBY_A_HANDOFF.md` and `RELEASE_0.6.8_QA.md`. The paragraph below describes 0.6.7 history; new frontend files are now present and connected. Five-stage endings, all-50-minute route generation and new story event mechanics remain unimplemented; actual legacy route durations are displayed, not relabeled as 50.

The user chose lobby option A and a task-list model, then explicitly authorized Codex to implement its backend rules before frontend delivery. The subsequent request "先給我測試版" authorized packaging the intermediate backend as 0.6.7; see `RELEASE_0.6.7_QA.md`. Read §47 and `LOBBY_RULES_BACKEND_HANDOFF.md`. The ordered/date-based task list, daily routine instances, all-depth exit mapping, partial route lock, role-free Focus binding and cross-day active-run recovery are implemented and packaged (92 tests plus isolated shipped-ASAR Electron IPC/scene QA). Claude's new lobby/types are not yet present locally; `snapshot.taskList` is a shared intermediate contract, not the completed `snapshot.lobby` adapter. Legacy role columns and the old lobby UI remain for compatibility; new list/routine controls are not yet accessible in that UI. Backup is v7. All-50-minute routes, the five-stage ending, deferred event/discovery UI and the Today switch remain integration work; existing first-map visuals are unchanged.

- Lobby: close-up of the resting traveller on the left, Focus-style glass panel on the right (next map + one main button, today's list, journey items). Two route cards under the close-up; hover/focus pans the camera to that exit. Selecting never starts the timer.
- A map must be fully explored (50 min) before the next is chosen; partial progress only offers Continue. The first segment is also a choice of two routes; a campfire start point will be designed later. Core guarantee progress is never shown. Event choices may wait in the lobby.
- Main/side task roles are removed. Today's list is ordered; its first item is the next Focus's work. After Focus ask once, "Is <item> done?": done = the whole item, strike it and bring up the next; not done = stays on top. Routines repeat on weekdays only (no times), are added on the first open of the day and never pile up. The previous day's unfinished one-off items wait in a "昨天沒做完" tab: move some or all to today, or delete all (explicit confirmation). Task completion never affects game rewards.

## Latest design decision: 2026-09-28, core plan §48 (campfire start and why lamps are lit)

The user approved the journey start point 霧岸營火 and the story reason for lighting lamps. On 2026-09-28 the user accepted prototype v2 and approved handing it to Codex for porting; not yet implemented. Claude's design prototype is `prototypes/campfire-start.html`; the handoff is `CAMPFIRE_START_HANDOFF.md`.

- Story (author-side, never stated in UI): the fog swallows unlit paths. The traveller borrows fire from the campfire for the lantern, and uses it to light each map's five lamps. Those lamps are what a possible future self once followed out of the fog, which is why he leaves things "for the next traveller". A journey's 25 lamps reach the edge of the final domain. Without all cores the meeting cannot last, so the fog closes and the traveller wakes by the campfire again. Each journey is a different possible future, so lamps are relit every journey. Lamp mechanics are unchanged.
- The campfire replaces the lobby close-up in the `journey_start` and `returned` phases; the rest of lobby A is reused. A tiny floating islet at pre-dawn with no day/night or weather; a rope bridge (left) and floating stepping stones (right) lead into the mist; hovering a route card reveals the destination's far silhouette.
- The empty seat opposite shows cumulative, permanent, large-silhouette traces by encounter depth (v2, 2026-09-28): 0 none; 1 (met, 0 cores) chopping stump with axe; 2 (1–3) pot crane with steaming kettle and tin cup; 3 (4–6) tarp lean-to and mended blanket; 4 (7–9) bedroll, old pack and a staff with the same, older lantern; 5 (true ending) the future self sits there, back to camera. The sky also moves one step toward sunrise per stage and the mist thins; stage 5 is sunrise. New traces get a small dot marker only (no text over the traveller). The traveller uses the same model as other maps (no face details).
- Motion: "borrow fire" departure (5 s, visual only) and a ~4 s "return to the campfire" wake-up. §46.8's first-encounter closing line is now 「火還沒熄。先回去坐一下吧。」

## Latest design decision: 2026-09-28, core plan §49 (length, hidden maps, collection room, novelty)

User-approved plan; read §49 before route generation, collection room or event-table work.

- Keep ten cores and the §46.4 odds. NEW route guarantee: while any core is unowned, every two-route choice includes at least one map whose core is unowned (still excluding maps already visited this journey). Simulated time to true ending: 32 h average and 50 h worst case with the guarantee, versus 40 h average and 79 h worst without it.
- Hidden maps (2–3) are optional and NOT required for the true ending. They unlock without chance: clues assembled on the collection room's clue table, plus specific journey items carried in the same journey, add a third route card (the only exception to two routes). Their reward is a missing notebook page (the "blank page" from the first encounter), not a core.
- The campfire shows only the future self's traces; the collection room shows only evidence (cores, clue table, notebook pages) and is always accessible. Neither shows the other's content.
- Novelty priority for revisits: first- and second-visit events per map; one map-specific ambient variation per map, separate from day/night and never affecting lamps or rewards (Moss Station = rain); visible world memory; item-triggered events.
- The only scripted sequence in the game: first launch wakes at the campfire with the notebook; the first exploration has a fixed opening event before the first lamp; the first Focus recap always adds one notebook/clue record. That record is not a journey item or core.

## Latest design decision: 2026-09-29, core plan §49.8 (Moss Station opening, visit events, clues; no clipping)

User-approved design; not implemented. Details: `AREA_02_MOSS_STATION_EVENTS.md` §19–20, scene JSON `storyRules`/`storyEvents`/`clues`/`clipFix`, handoff `handoff/area02-story-events/README.md`.

- Opening (first exploration of the game on Moss Station): the traveller finds 「從這裡開始。」 carved on lamp 1's post, matching the notebook's first page; the recap always grants clue `m02_open` regardless of animation.
- First/second-visit events are keyed on clue possession (`h1b` missing → first-visit event; `h1b` owned, `h1c` missing → second-visit event), scheduled like special finds between lamps. First visit: a dead lantern drifts past the pier over the falls (rain: seen from the wagon door). Second: a sketch of a half-sunk lantern marked 「灣」 in the ledger. No NPCs.
- Item-carry events give visuals, a journey-only lobby card and, the first time, one permanent clue (`m02_wick`/`m02_lens`/`m02_sign`/`m02_sapling`; same as Cloud Ruins' item events; user decision 2026-09-29). Clues are records, so 'understood' states still read only permanent records, never whether an item is carried now. Item-event clues must not be the only source of a hidden-map unlock clue (items are random per journey). New category: core-gated events may grant clues (`c02` understands the compass; `c08` the diary). §46.7 combo 壓葉標本＋護根布 becomes 護根布 alone.
- No clipping, all maps: routes, stand points and event spots must keep the traveller's body (r 0.27) and hat brim (r 0.36) out of props. Moss Station nodes, vias and a few props were moved; Codex must port the prop changes, recompute lengths/lamp legs and rerun lamp-deadline tests.

## Latest design decision: 2026-09-28, core plan §50 (collection room inside the traveller's bag, clue table, core-chosen items, hidden maps)

User-approved design record; not implemented. Prototype `prototypes/collection-room.html` (Artifact 「收藏室」); handoff `COLLECTION_ROOM_HANDOFF.md`. §50 supersedes the legacy Archive (§39–41: Starlight Archive, north wing, restoration project, focus-time stages, map wall). `ArchiveGame.tsx`, `LivingArchive.tsx` and restoration UI are to be retired; use the current lobby/Focus frosted-glass UI.

- The collection room is the inside of the traveller's bag (bigger inside; never explained). Always accessible; the traveller never appears inside, only his large gloved hand reaches in from the open mouth when something is put in place (placing a new core, pinning a clue, opening the notebook). The hand is visual only; skip it under reduced motion.
- Cutaway view at the usual 45°/31° orthographic camera; canvas lining, leather piping, brass mouth frame; light comes from the open mouth. No day/night or weather. A pocket near the mouth holds this journey's items (same data as the lobby bag, emptied on a new journey); cores, clue table and notebook live deeper and are permanent.
- Ten core exhibits are large, specific objects that fill the bag when complete, each alive in its own way rather than lit (only three involve light: orrery star specks, the bridge lamp once understood, prism rainbows). 01 sky-orrery over the table, 02 compass in a brass bowl on the station luggage trolley, 03 an upright disc of lake water in a stone ring (shows the same bag used longer by someone else, never a person), 04 bridge-head lamp post with a flag blowing in no wind, 05 holed stone in a quarry cart, 06 whale-bone horn across the left wall (core renamed from 回寄郵戳 to 蒼鯨號角), 07 sapling under a glass bell that grows every journey, 08 giant book on a lectern turning its own pages, 09 clock-tower face leaning on the wall, 10 refracting telescope poking out of the mouth. Core blue is only a detail accent. 01/02 in-map items and reveals stay unchanged. Empty slots are hinted by bare supports (wall cradles, an empty easel, a bolted base plate, an empty trolley or lectern); no chalk outlines. The 'understood' trigger is always a permanent record (map event or place), never a journey item, because journey items reset every journey. Map stickers and piles of books/maps grow with progress. Ten cores trigger a one-time ~8 s linkage.
- Clue table: a hand-drawn fog-sea map of visited maps. New clues wait in a tray; one click pins them to their source island. Clue kinds: bearing, look, note. Two crossing bearings reveal "?"; adding the look draws the hidden place with its two required items. One place can be tracked: compass needle and the lobby `trackingClue` follow it. No odds, pity or unvisited maps are shown.
- NEW RULE (user-approved): once a map's core is owned, each new exploration of that map may pick which of its two journey items it yields, chosen on the departure sheet before Focus (default: the item the tracked place needs, else random). Locked for the exploration once started; extra thin blue light on pickup; core odds and the route guarantee are unchanged.
- Hidden maps: three, chained (沉燈灣, 冷營地, 留白書桌); each takes one of the five segments; a third route card appears after both required items are carried in the same journey. Reward is a notebook page only (no journey items, tentatively no revisit). Clues, items and page drafts are in §50.8; page 3 must be settled with the true-ending script. Content settled now; scenes built later. 沉燈灣 story (2026-09-29): its hundreds of cold lanterns belong to travellers of other possible futures; only the future self reached the final realm, because someone lit lamps on his path; the unwritten routes of page 3 sank here. Show only lanterns, luggage tags, boat and fog (no people, no death framing); each lantern carries a numbered 舊荷札 and only the player's number is missing; lantern count is fixed and never grows with abandoned/unfinished journeys. See §50.8.

## Latest design decision: 2026-09-28, core plan §51 (app shell: navigation rail and function sheets)

The user asked for a simple, useful glass UI because switching to 任務/紀錄/設定 showed the old solid pages, and delegated the choices to Claude. Design record only; prototype `prototypes/lobby-shell.html`, handoff `APP_SHELL_HANDOFF.md`.

- The scene is always behind: 今天 (lobby) and 收藏室 are scenes; 紀錄, 設定 and 全部事項 are glass sheets over the current scene (scene blurred/dimmed, lobby UI fades). The rail is always glass.
- Rail has four items: 今天, 收藏室, 紀錄, 設定, plus today's focus minutes at the bottom. Remove the 任務 tab, brand text and the legacy focus-time world-stage card; the collection button moves from the lobby to the rail (new-dot there).
- 紀錄: three figures (today, last 7 days, things done in 7 days), a 14-day bar chart, last 5 sessions, journey history. No judgement, no red, no distraction count.
- 設定: one list (reminders, phone ritual, traveller colours, backup/restore/analytics with in-page confirm).
- 全部事項 replaces the 任務 tab and opens from the lobby list: yesterday's unfinished, add (today / later / weekly routine), today's list (read-only order), later (parked backlog), weekly routines (edit weekdays), recently done. §47.4 list rules are unchanged.

## Product identity and loop

- Focus Quest is a local-first Windows focus tool and autonomous exploration game. Actual work time moves the traveller through the world. The player does not directly control the traveller during Focus. The approved front-end direction may use a realtime 3D scene; the current 2.5D Phaser implementation is not a future constraint.
- Core loop: `Focus -> exploration progress -> discovery -> post-session choices -> visible world growth`. A seeded journey persists across calendar days; restarting or changing dates does not reroll it. There is no daily expedition settlement/reset in the new design.
- During Focus, the world stays calm and ignorable. No required treasure clicks, event, relic, inventory, or route decisions. After Focus, a brief Debrief can present discoveries, meaningful event choices, and the next route. The old guaranteed relic-choice sequence must be reconciled with the one-of-two journey item award, not duplicated.
- A valid partial Area retains progress for the next session. Reaching planned Area exploration time moves the traveller into natural ambient rest; it does not stop the user's timer or demand input. Manual Pause freezes effective Focus time AND the whole world at its current frame (2026-09-26 override of original section 8). Resume continues without catch-up; manual pause persists across app restart and system wake. Extending Focus does not improve reward rarity or quality. Backend API and Claude scene/UI handoff: `docs/FOCUS_PAUSE_HANDOFF.md`; backend and visual integration verified for 0.6.5. Runtime QA details: `docs/RELEASE_0.6.5_QA.md`.
- Every new Area has five mandatory lamps at 10, 20, 30, 40 and 50 effective minutes. The fifth is due at 100% planned time. These are autonomous visual milestones, not timer authority or reward tiers. Legacy 25/90-minute saves require an explicit migration design.
- Each lamp has one independent 5% chance for that map's unowned permanent core, with a fifth-visit guarantee as specified in §46. A completed exploration also guarantees one of its two journey items. Results, misses and guaranteed-lamp assignments must persist before reveal animation. Current 0.6.5 still uses the superseded three-item shared chance pool; do not describe the new rule as implemented.
- Scene daylight completes dawn, day, dusk, night and returns to dawn every 10 minutes of effective Focus time. Its four lighting keyframes are 2.5 minutes apart, with smooth transitions; pause, restart and a partial Area resume preserve the effective-time phase. This is independent of the five lamp milestones.
- Exploring an Area never marks the real Main Quest complete by itself. Task completion requires an explicit user action.

## Journey build and permanent growth

- Routes, events, relics, tags, and special tokens reshape available content, discoveries, and visible traveller behavior. This is a content build, not an attack/defense or currency build.
- Journey items affect the current cross-day journey and enable event/route combinations. Permanent map cores advance encounters and visibly grow the Archive, not numerical efficiency buffs. Item duplication and next-journey carrying rules remain to be designed.
- Stopping for the day preserves the journey. A journey encounter/ending leads to a recap and return to the start while keeping permanent cores, pity progress and story records. Archive access does not require ending a journey. Do not add a separate Camp system; the Archive is a place that changes visibly, not merely a collection grid.

## Area scene and map contract

- One Expedition node corresponds to one complete Area scene; one Focus session mainly explores one Area. Areas are authored scenes connected by a port contract, not one huge open world.
- Each Area needs an Entry Port and at least one Exit Port, usually two exits. Roads and ports visually continue to the scene edge. A chosen exit connects to the matching entry direction of the next Area. Use in-world transition cover such as fog, an arch, or darkness when practical.
- Between lamps the traveller explores freely and meets random events (content/animation proposed by Claude; selection, timing, outcomes and persistence decided by Codex). After the fifth lamp the traveller rests at the Area's authored rest spot; Area 01 uses its central tree and meadow (notes, lying in the grass, watching clouds). The next Focus departs through the chosen exit, capped at 5 seconds with mist-covered transition. Every map has exactly two journey items and one permanent core under §46's award rules. `docs/AREA_01_CLOUD_RUINS_EVENTS.md` remains the existing scene/animation reference; its earlier shared-pool award rules are superseded for the new design.
- Scene data includes waypoints/paths, interaction, scenic, rest and milestone anchors, entry/exit ports, depth and occlusion zones, and lighting zones. Keep traveller feet grounded and correctly layered around trees, walls, stairs, bridges, and arches.
- The initial Focus Active view must show the complete Area composition. Video, static backgrounds, foreground art, and waypoints must share framing and coordinates; do not enlarge and crop the scene to fill a differently shaped window.
- The current accepted first map is Claude's integrated 3D 雲上遺庭 scene; preserve its UI, composition, effects and existing behavior while designing new rules. Legacy Phaser code does not constrain future rendering. Autonomous navigation uses deterministic rules, authored routes/anchors, a state machine and seeded variation rather than an LLM.
- Claude owns design; Codex owns all production implementation, frontend/backend integration, fixes, runtime QA and packaging (2026-09-27 update). A design prototype/assets are sufficient for handoff; preserve accepted visuals and do not wait for Claude to write App modules. The user accepts the final result.
- Claude designs scenes/events/motion; Codex implements playback and gameplay event eligibility, selection, timing, outcomes and recovery. New gameplay rules require user approval unless already authorized. Focus-time ambient events require no choice; choices wait for Debrief. Animation failure must not alter persisted results.
- Prefer reusable authored scenes with meaningful variations. The current design draft has ten exploration maps plus a short final encounter; the old 12–20-template example does not require building more. Ten-map design approval does not authorize producing all assets in this task.

## Engineering invariant and exclusions

- Focus time and durable expedition state have higher priority than visual effects. No scene renderer is the authority for elapsed time. Renderer failure, app restart, Windows sleep, or visual loading failure should preserve or recover the active session, actual time, current Area, partial progress, pending choices, and route state as far as the persistence architecture supports.
- Do not add combat, HP/ATK/DEF, XP farming, gacha, punitive streaks, mandatory daily room counts, PvP, true open world, unnecessary high-cost global illumination, or required player control during Focus.

## Reading cadence

## Current implementation audit: 2026-10-02

This dated status supersedes the historical "not implemented" notes above: lobby/task list, Today switch, app-shell tabs/sheets/settings/history, campfire departure, Collection Room and both Cloud/Moss maps are integrated. Moss §49.8 currently obtainable stories shipped in 0.6.19; the Collection Room preload and departure fixes shipped in 0.6.20. The 0.6.21 handoff audit connects per-exploration Cloud story records, backend-provided schedules, stable whale seeds, ambient cooldown recovery, world props, carried-item discovery cards, and authoritative clue definitions/comparisons in the Collection Room. Backup v12 preserves the new exploration fields and imports older formats.

Do not interpret ten approved map concepts or Collection Room display models as ten finished playable maps. Area 03 is still at conditional prototype stage 3; its events, story and final handoff are not delivered. Moss stories requiring future maps 07/08 remain unavailable; taking away the wrapped seedling is still a draft. The final meeting/true-ending script, bag-entry camera design, Cloud tree date and fog-map geography remain unfinished design decisions. See `HANDOFF_AUDIT_2026-10-02.md` and `AREA_01_INTEGRATION_2026-10-02.md`.

Read `AGENTS.md` and this brief once when a new task begins, then read only the Markdown plan sections and supporting documents needed for that task. Use the PDF only to resolve a transcription discrepancy outside dated decisions. Keep the resulting decisions in working context during the task. A new agent task must reload this project guidance because conversational memory is not guaranteed to carry across tasks.


## Sound and Focus settings: 2026-10-02

Campfire lobby ambience is now integrated for journey_start/returned: fire, wind, distant water, motion-cued cloth/wood and stage-3 shelter fabric. It uses saved environment volume/mute, retains sound under sheets/minimization, suspends in Collection, and stops for departure without duplicating destination audio. No added music or gameplay changes. See CAMPFIRE_AUDIO_HANDOFF.md and previews/campfire-audio-qa/ (164 tests, isolated real Electron and stereo DSP QA; not packaged yet).

Later 2026-10-02 handoff: `AUDIO_DESIGN_HANDOFF.md` §3 departure audio is now implemented: campfire stays audible through borrowing fire, glass C4 uses music volume, motion cues use environment volume, and exit footsteps follow bridge/steps. Recent-only recovery and 150ms cleanup preserve timing authority. Two 5-second WAV previews are in `previews/lobby-audio-qa/`; 166 tests and build pass. This supersedes the prior stop-on-departure behavior, remains unbundled, and awaits user listening; §2 and §4–§6 are still pending. See the latest Codex report in `CAMPFIRE_AUDIO_HANDOFF.md`.

2026-10-03 superseding audio workflow: all new sounds come from user-supplied ElevenLabs files; no new procedural synthesis. Batch 1's five supplied campfire MP3s are integrated with in-memory calibration/filtering/seam processing and per-layer existing fallback. Only stage 5 gets sparse dawn-bird excerpts; there is no new ending unlock or melody. Existing departure cues remain unchanged pending batch 2/2b. The interrupted new harmony/Collection/return synthesis draft is inactive and archived in `docs/handoff/interrupted-audio-draft-2026-10-03/`; these features must wait for recordings. Build and 168 tests plus isolated Electron checks pass; stage 3/5 WAVs and report are in `previews/lobby-audio-qa/batch-1/`. Not packaged; user listening remains pending. See the newest report in `CAMPFIRE_AUDIO_HANDOFF.md`.

Cloud and Moss Focus ambience are implemented independently of gameplay. All Focus screens use a top-right gear to open the same frosted-glass Settings panel; no map-specific mute buttons. Environment/music volumes and global mute are saved settings (defaults 35/12, unmuted), backup v13 with legacy import defaults. Opening Settings does not pause Focus. Pause/review/unmount stop audio; minimizing keeps it playing. Moss rain/drips share saved weather seed and effective time. See both AREA_01/02_AUDIO_HANDOFF.md and RELEASE_0.6.22_QA.md for runtime/package verification.

### 2026-10-03 第一批音效第三輪驗收更新

使用者已通過兩份水聲半量／2 秒接縫淡化試聽，正式程式採納，168 項測試、建置、真 Electron 播放檢查及驗收檔逐樣本比對通過。完整五檔 60 秒混音位於 `previews/lobby-audio-qa/batch-1/accepted/campfire-batch-1-full.wav`。尚未打包，已安裝版本仍為 0.6.22；後續音效先試聽確認再整合，其他批次等待使用者素材。
## 2026-10-03 營火出發 8 秒與錄音正式整合（0.6.23）

此更新取代下方歷史「未打包／待試聽／5 秒營火出發」狀態。使用者已接受自然重疊版本並授權整合；第一批 5 個環境錄音、第二批與 2b 共 27 個動作錄音採用。營火出發改為 8 秒，只延長闔書至點燈前段：點燃 5.05 秒、約 5.4 秒完成，出口腳步 0.38 秒間隔保留。動畫及音效暫停／恢復同步。其他地圖時間、專注計時起點及獎勵不變；沒有新增合成聲音。29 檔／170 項測試、型別檢查、建置與真 Electron 音畫檢查通過，安裝包及進度延續結果見 `RELEASE_0.6.23_QA.md`。後續素材先試聽再整合。

## 2026-10-03 debug 與設定修正（0.6.26）
Windows 換行造成的收藏室 ready／本機模組接線已修正；背景預載不消耗核心展示。三圖材質改為批次預編譯、營火錄音重用、目的地可見才開始音場，減少開始卡頓及錯場景音效。音量滑桿移除陰影，背景音下方分隔線上移。沿用現有苔痕運鏡；演出輸入可喚回介面。186 測試／型別／建置、真 Electron 與包內回歸見 RELEASE_0.6.26_QA.md。
