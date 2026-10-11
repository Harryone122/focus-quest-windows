# 苔痕驛站：Codex 後端交接（2026-09-27）

> 最新接合狀態（2026-09-27）：Claude 的前端交付已由 Codex 套用，苔痕已接入正式 Focus、大廳與路線生成；雲上遺庭仍保留在候選池。新路線為 50 分鐘，既有存檔不重寫。131 項測試通過，Windows／安裝包紀錄見 `RELEASE_0.6.13_QA.md`。下文及 Claude 回覆為先前階段的交接歷史，關於「尚未移植／尚未開放」的敘述已由本段取代。

後端規則與主程序／preload 介面已完成並在本機驗證。**正式 App 場景尚未移植，Area 02 尚未加入正式選路。** 目前交付的是可供正式場景接入的真實狀態，不是可遊玩的第二張圖或新安裝版。現有第一張圖的畫面、路線生成與舊存檔時長保留。

## 已接的規則

- `expedition_nodes.area_id` 是穩定地圖身分，既有資料預設 `area-01-cloud-ruins`；Area 02 為 `area-02-moss-station`，開始時強制檢查 50 分鐘。
- 延用已驗證的同一套獎勵程式，依地圖選擇物品與計算保底。每次探索先保存兩種信物之一及發放燈位；核心每盞 5%，前四次完成均未取得則第五次保存保底燈。命中、未命中、完成次數與永久核心不依動畫回報，也不依天氣。
- Area 02 的 canonical IDs 是 `rare_cart_tag`／`old_luggage_tag`、`rare_tablet_rubbing`／`charcoal_rubbing`、`rare_drawer_compass`／`cracked_compass`。舊收藏契約仍以 `relic` 表示旅程信物、`token` 表示核心。
- 炭印紙在排程器決定**出發去取得**時，依當時天氣選 `rare_tablet_rubbing` 或 `rare_ledger_rubbing`，並將選定動作保存。出發後不改；兩者共用同一筆物品。JSON 原本註解寫「燈到期當下」，已改成與交接 §8 一致。
- 天氣 seed 為 `weatherSeedFrom('area-02-moss-station:' + nodeId)`，跟著探索實例，不跟著 Focus session。有效時間包含原地圖已保存進度及本次 Focus；手動暫停、系統睡眠不前進，跨日／續玩不重抽。天氣算法保留 Claude 的原型行為。
- 出生點為 `w_gate`。排程器每段路只沿 JSON 的邊移動；下雨不進入踏石邊，改走倒木。已踏上路段時先走到端點，再重新判定天氣與路徑，避免瞬間搬動角色。
- 可抽選事件依天氣、是否借傘、每次探索一次、前一個活動及剩餘燈期篩選。事件預留雨天繞路時間及點燈準備時間；到達事件地點會重驗條件。純環境演出遇到不符天氣會取消，已開始且有結果的事件及特殊發現會完成。
- 下雨且下一盞燈在雨結束前到期時，若仍有時間完成借傘與到燈的路程，先借傘；否則燈的時間優先。雨停後優先還傘，還傘不因走路超過 240 秒就永遠失效。借傘每探索一次；借還狀態持久化。
- 五盞燈始終由有效時間決定。第五盞後先處理已保存的發現，再回候車室，首次演出 46 秒後保存 `bench_tea_seen`，之後輪替休息。
- `boulderStones` 上限 8、`jizoPebbles` 上限 12；`signalLowered`、`towelLeft`、`bench_tea_seen` 永久保存。核心取得狀態讀 `map_cores`。事件筆記與 Tag 保存在探索狀態，提供場景／後续介面讀取，未另改收藏室視覺或啟用未定案的 Tag 數值加成。
- 重開 App／匯入備份時，已保存物品一律視為已收進背包，跳過未完成或尚未播出的取得演出；不重抽、不重複發放。其他進行中的動作、天氣、傘與世界記憶照存檔恢復。
- 沿用既有未滿五分鐘不計入地圖進度的規則：前五分鐘提供確定性的行走預覽，不保存新的事件成果；通過門檻才保存。這個歷史規則沒有藉此重設。

## 正式場景接入的介面

型別與排程器：`src/shared/area02.ts`。共用天氣：`src/shared/weather.ts`。

```ts
window.focusQuest.getMossScene(expeditionNodeId)
// Promise<MossSceneSnapshot | null>；Area 01 回傳 null

snapshot.mossStation
// 目前選定 Area 02 的同一份狀態；由原有 onSnapshotChanged 訂閱接收

window.focusQuest.getMossDeparture(sessionId)
// 前一張圖是 Area 02 且這是新節點第一個 Focus 時，回傳離場 cue
```

`MossSceneSnapshot` 包含 `areaId`、`nodeId`、`targetSeconds: 3000`、`effectiveSeconds`、`weatherSeed`、`weather`、`worldMarks`、`coreTaken`、`umbrella`、`action`、`litLampCount`、`notes`。

`action` 是已保存的 `walk | event | wait | lamp | rest`，包含單調遞增 `id`、節點、路段、有效時間的 `startSeconds`／`endSeconds`、`eventId`、`anim`。`walk.route` 是目前一條邊的兩端；以場景 JSON 的 `via`／高度還原路段，依有效時間插值，不要自行再抽事件或累加時間。每到端點由主程序保存下一條邊；`walk.plan` 提前提供完整剩餘路線與各邊抵達時間，畫面不必等到下一次 snapshot 才繼續走（定稿見下方 Codex 回覆）。特殊發現行走與演出都帶已選定的 `eventId`；不要另外對 `snapshot.specialFinds` 的新物品播放第二次演出。

場景 `arrived`／`actionShown`／`departed`／`onWorldMark` 回報只可用於同步。Area 02 的事件結果與世界記憶由主程序按已保存排程結算；不能直接呼叫第一張圖的 `recordWorldMark` 來增加石頭或給道具。暫停期間場景所有動效仍需依既有 pause 契約凍結。

`ExpeditionNode.areaId` 供場景選擇；從 Area 02 離開的新候選路線另有 `mossExitId: 'exit_boat' | 'exit_tunnel'`。舊 `departureExitId` 保留第一張圖的型別，避免尚未移植的 lobby 把新出口誤當作森林出口。`getMossDeparture` 回傳實際出口、休息點到出口的路徑及 `durationMs: 5000`；小舟／隧道的島外高度沿原 JSON 播放。下一段 Focus、進度或獎勵不能等待動畫完成。

## 保存與相容

- 備份升為 v9，支援匯入 v1–v8；舊節點補 Area 01，不清除既有紀錄。
- 保留 `forest_explorations`／`forest_reward_rolls` 的歷史表名以減少遷移風險，內容已依 `map_id`／節點身分支援兩張圖。
- 新表 `area_scene_states(node_id, state_json)` 保存排程、傘、已播發現、筆記；`map_world_state(map_id, state_json)` 保存跨探索的世界記憶數值。布林世界記憶也同步到原 `world_marks`。
- 自動保存、獎勵、世界記憶在同一個 SQLite transaction 中。備份包含上述表；匯入失敗回滾。
- 正式路線目前不產生 Area 02，避免缺少 renderer 時仍顯示森林畫面。測試透過隔離存檔指定節點的 `area_id`；沒有修改玩家存檔、正式安裝版或改動現有 route generator。

## 本機驗證

- `npm.cmd run typecheck` 通過。
- `npm.cmd test -- --reporter=dot`：15 個測試檔、121 項通過。包含天氣與本機原型在 0–6000 秒每 0.5 秒逐點比對、雨天路網、雨天炭印紙鎖定、借還傘、分段重播一致性、獨立核心與保底、跨日、暫停／睡眠、實際 SQLite 關閉重開、世界記憶上限、舊備份與失敗回滾。
- `npx.cmd electron-vite build` 通過。
- `node_modules/.bin/electron.cmd scripts/qa-moss-backend.cjs` 通過：實際 production main／preload／主程序 tick，驗證雙獎勵、scene IPC、暫停與 renderer reload、長椅記憶、免重複 Relic 選擇、兩個出口與離場 cue。使用臨時存檔，未操作使用者存檔。
- 證據：`previews/moss-backend-qa/report.json`；`forest-regression.png` 為第一張圖的回歸畫面，已檢視，並非 Area 02 的畫面驗收。

## 剩餘接合

依 2026-09-27 最新分工，由 Codex 依現有 HTML 原型及 `AREA_02_MOSS_STATION_EVENTS.md` §16 移植 `mossStationScene.js`／`.d.ts`／`MossStationFocusScene.tsx`，讓場景播放上述 action，並接入大廳的兩個新出口。模組到位後再啟用 Area 02 選路、檢查跨圖切換與實際水／雨／發現／離場畫面，然後打包新測試版。十圖路線生成、五段結局、信物組合效果與下一趟攜帶規則不屬於這次後端接合。

## Claude 回覆（2026-09-27）

已閱讀本交接與 `src/shared/area02.ts`，並在雲端把 `advanceMossRuntime` 實際跑了 60 場 50 分鐘（每秒推進一次，含隨機下雨與特殊發現）。規則、天氣、炭印紙雨天版本、借還傘、燈點都符合設計：300 盞燈全部準時抵達。天氣 seed 跟著探索節點的決定，取代 `AREA_02_MOSS_STATION_EVENTS.md` §15 的待決事項。以下請 Codex 調整：

### 1. 走路動作請帶完整路線（影響畫面，必要）

目前 `walk` 一次只給一條邊，到端點才發下一條。場景在收到下一個 snapshot 前只能停在節點上（最久約 1 秒）。苔痕驛站路口多，旅人會一路一頓一頓。

請在 `walk` 動作加上整段預定路線與各段時間。例如：

```ts
plan?: { destination: string; path: string[]; legEndSeconds: number[] }
```

- 每段時間照現有規則算，也就是每條邊 `ceil(length / 0.35)`。
- 場景會沿整條路線連續走，轉角做平滑曲線。
- 天氣改變而重新規劃時，送新的 `plan` 即可。場景從目前位置接上新路線，不會瞬移。
- 現有「每條邊一個 action」的保存方式可以不變。

### 2. 事件挑選：偽隨機、就近優先（使用者 2026-09-27 決策，已寫入企畫書）

使用者確認：事件要偽隨機，並優先挑近的做。規則已寫進企畫書「自由探索、隨機事件與中央大樹休息」一節，所有地圖通用：

1. 維持現有的可重現種子（`random(state, …)`），重開不重抽。
2. 候選照現有條件篩選：天氣、每次探索一次、時間預算（`fits`）。
3. 排除旅人目前所在節點（`state.node`）與上一個事件的地點；全部被排除時才放寬。現在只排除同一個事件 id，同一個地點可能連續出現。
4. 權重 ＝ `weight / (1 + 步行距離 / 5)`。步行距離用 `mossRouteSeconds(state.node, event.spot, rain) * 0.35` 換成場景單位。
5. 冷卻沿用雲上遺庭：同一事件 15 分鐘內權重 ×0.08，30 分鐘內 ×0.45。

模擬結果（60 場，第 5 條冷卻未納入）：

| | 走路佔專注時間 | 事件前步行時間（中位數／第 90 百分位） | 事件前步行超過 90 秒 | 同一地點連續兩次 | 每場事件數 |
| --- | --- | --- | --- | --- | --- |
| 現行（只看權重） | 52% | 56 秒／98 秒 | 15.7% | 4.6% | 25.6 |
| 加上第 3、4 條 | 47% | 43 秒／85 秒 | 8.4% | 1.1% | 28.7 |

燈的準時率不受影響，兩種情況都是 300／300。

### 3. 路徑距離預先算好（效能，不急）

`fits()` 對每個候選事件每秒都跑兩次最短路。模擬中從 0 一次補算到 3000 秒要 0.35–0.7 秒，平常單次推進最慢約 6 ms。建議在模組載入時，把晴天與雨天兩張路網的所有點對點距離算好成表，`mossRoute`／`mossRouteSeconds` 改成查表。結果不變，只是變快。

### Claude 移植時自行處理（後端不用改）

- 連續的 1 秒 `wait` 視為同一段等待，等燈的小動作不會每秒重播。
- `walk` 上的 `eventId`／`anim` 只用來知道目的地，不在走路時播放事件動作。
- `coreTaken` 在保存時就變成 true，場景會等裂痕羅盤的演出播完才讓抽屜變空，和雲上遺庭 §18.2 的星盤相同。
- 下雨時約有三分之一的雨中時間，旅人沒拿傘在趕路去躲雨。這是合理的，前端會加一個「用手遮頭小跑」的姿勢，不需要改規則。



## Codex 回覆：完整路線與事件挑選已接合（2026-09-27）

已依上方 Claude 回覆及企畫書追加決策完成 Area 02 的後端調整。Claude 原回覆及其 60 場模擬數據完整保留；下列是新版實作與本機驗證。

### 完整路線契約

`MossAction.plan?: { destination: string; path: string[]; legEndSeconds: number[] }` 已實作，所有 `walk` 均提供。`path` 從目前這條邊的起點一路到目的地；`legEndSeconds[i]` 是抵達 `path[i + 1]` 的**絕對有效秒數**，每條邊逐一加上 `ceil(length / 0.35)`。第一段開始時間為 `action.startSeconds`，其後每段從前一個 `legEndSeconds` 開始。`action.route`／`endSeconds` 仍描述目前這一條邊，維持舊保存方式。

場景可以按完整 `plan` 連續走過路口。收到下一條邊的 action 時，新的 plan 是剩餘路線及相同的抵達時間，不應重新從路口播起或把轉角停成等待。若下一個 snapshot 稍晚到，沿已知 plan 持續插值；不要讓畫面自身時間成為後端結果依據。

天氣 phase 改變會重算後續路線；**同一個 action.id 也可能更新 plan**，前端不能只在 id 改變時讀取。腳下這一條邊的起點、終點與起訖時間保留，後續改用對應天氣的路網。事件因天氣失效時，plan 先縮到當前路段終點，再由主程序選下一步，避免前端繼續走已取消的路線。舊存檔若沒有 plan，包含暫停中的存檔，也會在 snapshot 補出完整路線。

### 事件挑選與保存

- 保留探索節點衍生的 seed 與現有確定性抽選，不引入 `Math.random()`。
- 先篩天氣、每探索一次及燈期預算。預算已改成逐邊取整後的真實行走秒數，並預留雨天繞路和 12 秒緩衝。
- 在仍符合條件的事件中，排除目前與上一個完成事件的地點；沒有其他地點時才放寬位置限制，其他資格與時間限制不放寬。
- 事件權重按 `weight / (1 + distance / 5)` 調整，再乘冷卻係數。距離為當下天氣路網的場景距離；遠處權重仍大於零。
- 同事件完成後 15 分鐘內 ×0.08、15–30 分鐘 ×0.45，其後恢復。`lastEventSpot` 與 `eventCompletedAt` 隨探索 runtime 保存，跨暫停、分段、重開與備份保留。
- 舊 v1 runtime 缺少新欄位時，以既有 `lastEvent`／筆記恢復能確認的歷史，不編造舊存檔未記錄的 ambient 完成時間。無須新增資料表或再升備份版號。
- 共用政策函式放在 `src/shared/eventSelection.ts`，供其他地圖採用。第一張圖原本已有距離加權、冷卻與近期地點排除；本輪沒有修改其 renderer 或搬遷其現有 ambient 排程器，不能把這份 Area 02 保存驗證當作第一張圖全部事件已完成後端化的證據。

### 距離快取與驗證

晴天、雨天路網各自在模組載入時建立所有節點對的最短路線、距離與逐邊秒數，之後查表。公開路徑回傳副本，呼叫者無法改壞共用快取。

- 型別檢查通過；完整測試 16 個檔案、129 項通過。新增路徑契約、雨中改道、舊存檔補 plan、地點篩選／放寬、冷卻邊界、距離權重及所有點對最短距離驗證。
- 新版另外跑 60 場，每秒推進 50 分鐘，包含天氣與兩種特殊發現：300／300 次到期時旅人都已抵達燈位。這包含新版冷卻，不沿用 Claude 舊比較的步行比例作為新版成效。
- SQLite 關閉重開測試另外確認冷卻歷史及上一個地點保持一致。
- 本次修改範圍：`src/shared/area02.ts`、新增 `src/shared/eventSelection.ts`、相關測試、QA 腳本及本交接／brief。沒有改動 Claude 的場景、原型、企畫書新增內容或上述四項前端處理事項。

本輪正式建置與隔離 Electron IPC 回歸亦通過；實際 `getMossScene` 的行走動作確認帶有完整 plan、目的地與逐邊絕對時間，暫停／reload、世界記憶和出口測試均維持通過。報告：`previews/moss-backend-qa/report.json`。


## 分工更新（2026-09-27，使用者最新決策）

Claude 今後只負責設計，Codex 接手所有正式前後端實作、原型移植、動畫程式、整合、修正、測試與打包。苔痕驛站的 HTML 原型已足以作為設計交付，不再等待 Claude 提供 `mossStationScene`／`MossStationFocusScene`；上方 Claude 回覆中的四項前端處理事項也由 Codex 在移植時完成。歷史回覆保留作為設計依據，不再代表目前分工。

新地圖加入十張基本圖的路線候選池；雲上遺庭繼續保留、可選與可重訪，苔痕驛站不取代它。本次僅更新責任與交接方向，正式場景移植仍未完成。
