# 大廳方案 A、出發確認、專注後回顧：前端交接與後端串接

Claude 交付，2026-09-26 晚。規格依據企畫書 §46、§47，視覺參考是設計畫布「旅人大廳提案」。本文件已對照 Codex 的 `docs/LOBBY_RULES_BACKEND_HANDOFF.md`（`snapshot.taskList` 與清單 IPC），下面列出的後端呼叫都是已經存在的名稱。

## Codex 整合更新（2026-09-27，0.6.8）

**0.6.11 後續修正：** Focus → AfterFocus 保留並凍結同一個畫布，返回大廳經一次性 scene ownership 交接，不再拆建地圖。`AfterFocus.retainFocusBackdrop`、`LobbyStage.handoffOnUnmount`、場景 `enterLobby`／`renderNow` 是新的生命週期介面；畫面契約、任務與獎勵規則不變。請見 `FOCUS_EXIT_TRANSITION_FIX.md`、`RELEASE_0.6.11_QA.md`。0.6.10 已由另一對話修正入口石板站位，本輪原樣保留。

- 正式 Today 已切換 `ConnectedLobby` → `LobbyA`；出發使用 `DepartureSheet`，遠征回顧使用 `ConnectedAfterFocus` → `AfterFocus`。下面的「尚未切換／模擬資料」描述保留作原始交接歷史，正式入口已使用 SQLite 真資料。
- `fromSnapshot.ts` 投影三份 view model；`ConnectedLobby.tsx` 接 IPC。沒任務的新存檔先顯示空大廳，加入第一件事後才建立真實旅程／兩條候選，絕不建立假任務。計時只由出發確認啟動。
- 完整地圖回答事項後可 `dismissDebrief` 回到樹下，node 保持 `awaiting_route`；選下一段用 `chooseNextRoute`，尚未出發前改選用 `selectExpeditionNode`。旧版 `awaiting_reward` 透過既有事件卡選物品，不自動選獎勵；可留在大廳繼續決定。
- 新發現的 `key` 是 acquisition ID；`inspectLobbyFind(id)` 寫入 `lobby_find_reads`，snapshot 提供 `seenFindIds`，備份 v8（相容 1–7）。信物種類由 itemKey 判定，不能把既有 `kind: token` 直接當信物，因為星盤核心在舊資料中也是 token。
- `mapVisits` 為後端已完成地圖次數，不包含保底欄位；目前全部可玩節點仍使用同一張雲上遺庭。
- 舊時長不覆寫，候選新增可選 `targetSeconds`，面板與出發確認均顯示真實的 25／50／90 分鐘。全 50 分鐘生成仍待另輪整合；五段終點、十張地圖與真正的延後故事事件未實作，不會啟用 preview 的假結局。
- 未刪除舊畫面原始碼，方便使用者驗收後再清理；舊普通 Focus 存檔仍使用既有相容路徑。
- 未重新設計任何玻璃／鏡頭／動畫。實機觀察到起點特寫中旅人腳下沒有可見踏石（`previews/lobby-shipped/02-selected-glass-rail.png`）；已完成地圖的樹下站位正常。此項連同帽簷遮臉等原有問題交由 Claude 視覺調整，不改 Focus 已認可場景。
- 驗證和打包詳見 `RELEASE_0.6.8_QA.md`。

## 這次完成的範圍

三個畫面的前端都已完成，目前用**模擬資料**運作；正式的 Today 與結算畫面**還沒切換**。

1. **大廳（`LobbyA`）**
   - 左側是旅人特寫：滑過路線卡時鏡頭看向出口，草地上有新發現。
   - 旅程條、收藏室入口。
   - 右側面板：下一段、這次要做、唯一的主要按鈕、待決定的事件、今天的清單（含「昨天沒做完」分頁，會標出原本的日期）、行囊、例行事項。
2. **出發前確認（`DepartureSheet`，取代 `FocusSetup`）**
   - 疊在大廳上的一張面板，內容是：要去哪裡、這次要做什麼（可以直接換成清單中的其他事）、最低專注時間 5／10／15 分鐘、手機放遠的確認、要擋住的程式。
   - 只有按「出發」才會開始 Focus。
3. **專注結束（`AfterFocus`，取代 `SessionDebrief` 的新流程）**
   - 背景是模糊的地圖。
   - 第一步只問一題「〈事項〉完成了嗎？」，並預告完成後的下一件。
   - 第二步回顧：這一段走完了，或已探索 N / 50 分鐘，或這次不到 5 分鐘；這次新點亮的燈；取得的信物（琥珀色）、核心（藍色）、線索；待決定的事件。事件可以當場選，也可以留到大廳處理。最後按「回到樹下」。

## 怎麼看

- 開發模式網址：
  - `#/qa/lobby-a-<情境>`：`start`、`partial`、`choose`、`selected`、`yesterday`、`final`、`returned`、`empty`。在大廳按主要按鈕會打開出發確認。
  - `#/qa/after-<情境>`：`task`（完成了嗎？）、`complete`（走完一段）、`partial`、`short`。按「回到樹下」會進入對應的大廳。
- 雙擊 `scripts/qa-lobby-a.cmd`：在 `%TEMP%` 隔離資料下截圖所有情境，輸出到 `previews/lobby-a-qa/`。
- 模擬資料的點擊只存在畫面上，不寫入資料庫。

## 邊界

前端只讀 view model，只透過 actions 回報操作，定義都在 `src/renderer/src/lobby/lobbyTypes.ts`：

- 大廳：`LobbyViewModel`、`LobbyActions`
- 出發確認：`DepartureModel`，回傳 `DepartureInput`
- 專注結束：`AfterFocusModel`、`AfterFocusActions`

前端不判斷進度、獎勵或任務狀態；每次操作後都以後端回傳的 snapshot 重新產生 model。**不提供保底進度**（§47.3），model 裡也沒有這個欄位。

建議由 Codex 寫一個 adapter，例如 `src/renderer/src/lobby/fromSnapshot.ts`，從 `AppSnapshot`（`taskList`、`todayRun`、`expeditionNodes`、`specialFinds`、`mapCores`、`worldMarks`、`pendingDebrief`）產生上面三個 model。

## 大廳：資料來源與操作

### LobbyViewModel

| 欄位 | 來源 |
|---|---|
| `phase` | `journey_start`：旅程第一段還沒出發。`exploring`：目前地圖是 partial，只能續玩（後端已鎖定）。`choose_route`：目前地圖已完成。`final_ready` 與 `returned` 需要五段終點，目前後端還沒有 |
| `journey` | 旅程第幾段、已完成的地圖（`todayRun` 與已完成節點）、追查中的線索（還沒有資料來源，先傳 `null`） |
| `map` | 目前節點的 `progressSeconds`、規劃時間、`mapCores` 是否含本圖、`worldMarks` |
| `routes` | 目前分岔的子節點。出口依後端已做好的 index 規則（0 → `exit_high`、1 → `exit_pines`，第一層為 `null`）；`title`、`tagline`（`description`）；`itemHints` 與 `clueHint` 還沒有資料時傳空陣列與 `null`；`coreOwned`；`visits` 為該地圖已完成探索的次數 |
| `selectedRouteId` | `todayRun.selectedNodeId` |
| `bag` | 本趟取得的信物（`specialFinds` 中 kind 為信物的項目） |
| `newFinds` | 取得後還沒看過的項目。「已看過」需要新的旗標（見下方待補） |
| `pendingEvents` | 延後處理的事件。目前事件系統還沒改造，先傳空陣列 |
| `tasks.today` / `tasks.yesterday` | 來自 `taskList.today` / `taskList.yesterday`。`completed` 對應 `done`，`scheduledDate` 直接帶入 |
| `tasks.currentTaskId` | 前端記住的選擇；沒有選時用 `taskList.nextTaskId` |
| `routines` | `taskList.routines`（`weekdays` 對應 `days`；只列出 `enabled` 的） |
| `collectionHasNew` | 還沒有資料時傳 `false` |

### LobbyActions 對應的後端呼叫

| Action | 呼叫 |
|---|---|
| `selectRoute(id)` | `selectExpeditionNode(runId, id)` |
| `primary()` | `exploring`、`journey_start`、`choose_route`：打開 `DepartureSheet`。`returned`：開始新旅程（等五段終點完成後再接） |
| `openCollection()` | `navigate('journey')` |
| `inspectFind(key)` | 待補：已看過的旗標 |
| `chooseEvent(eventId, optionId)` | 待補：延後事件的決定 |
| `addTask(title)` | `addListTask({ title })` |
| `setCurrentTask(id)` | 只存在前端 state；出發時作為 `startListFocus` 的 `taskId` |
| `moveTask(id, ±1)` | 用今天未完成的 ID 算出新順序，呼叫 `reorderTodayTasks(localDay, ids)` |
| `removeTask(id)` | `deleteListTask(id)` |
| `moveToToday(ids)` | `moveTasksToToday(ids)` |
| `deleteAllYesterday()` | 前端已經問過一次確認。呼叫 `deleteYesterdayTasks({ localDay, taskIds: 目前畫面上的全部 ID, confirmation: DELETE_YESTERDAY_CONFIRMATION })` |
| `saveRoutine({ id, title, days })` | 把目前完整的例行設定清單改掉這一筆（新的一筆不帶 id），呼叫 `saveRoutines(list)` |
| `deleteRoutine(id)` | 從完整清單拿掉這一筆後，呼叫 `saveRoutines(list)` |

## 出發確認：資料與操作

- `DepartureModel`：
  - `mode`：`continue`（partial 續玩）或 `new`（選好的新路線）。
  - 地圖名稱、出口、已探索時間與規劃時間。
  - `task`（`currentTaskId` 那一件）與 `otherTasks`（今天其他未完成的事）。
  - `phoneRitual`：取自 `settings.phoneRitual`。
  - `blockedProcessNames`：已啟用的 `blockRules`。
- `loadApps`：`listRunningApplications()`。
- `onConfirm({ taskId, minimumMinutes, blockedApps })`：
  1. 先 `saveBlockRules(blockedApps)`。
  2. 再 `startListFocus({ taskId, minimumMinutes, blockedProcessNames, runId, nodeId, plannedMinutes })`，路線三個欄位一定要帶上（見 Codex 交接）。
  3. 失敗時 throw，面板會把錯誤訊息顯示在自己裡面。

## 專注結束：資料與操作

| 欄位 | 來源 |
|---|---|
| `step` | 還沒回答「完成了嗎」時為 `task`，回答後為 `review` |
| `effectiveSeconds`、`resolution` | `pendingDebrief`：`full` → `complete`、`partial`、`too_short` |
| `task` / `nextTask` | 這次 session 的事項；下一件用 `taskList.nextTaskId`（假設這件完成） |
| `map` | 地圖名稱、結算後的 `progressSeconds`、規劃時間、`litBefore`（這次開始前已經亮的燈數） |
| `finds` | 這次 session 取得的 `specialFinds`（信物 → `item`，核心 → `core`），加上故事線索 |
| `pendingEvents` | 延後處理的事件，目前先傳空陣列 |

| Action | 呼叫 |
|---|---|
| `answerTask(done)` | `finishListFocus(sessionId, done)` |
| `chooseEvent` | 待補 |
| `finish()` | partial 與 too_short：`dismissDebrief`。complete：依現有流程進入 `awaiting_route`，回到大廳選路；在大廳選路後由 `chooseNextRoute` 接下一段 |

在 `App.tsx`：
- 有 `pendingDebrief` 時，改為顯示 `<AfterFocus … />`，取代 `SessionDebrief`。
- `seed`、`coreOwned`、`worldMarks` 與大廳相同。
- 背景的場景依結算後的進度擺放旅人。

## 還沒有後端資料的部分

以下畫面已經支援，只是資料還是空的：
- 新發現「已看過」的旗標。
- 延後處理的事件。
- 追查中的線索。
- 路線的信物與線索提示。
- 收藏室「有新內容」。
- 五段終點（`final_ready`、`returned`）。
- 全部地圖統一為 50 分鐘。

## 接上後端的建議順序

1. 寫 adapter，從 snapshot 產生三個 model。
2. 在 `App.tsx` 的 Today：有旅程時顯示 `<div className="view-content lobby-a-view"><LobbyA model actions busy overlay={departure && <DepartureSheet … />} /></div>`。
3. `pendingDebrief` 改由 `AfterFocus` 處理。
4. 驗收後移除上午的全圖版（`ExpeditionLobby.tsx`、`LobbyScene.tsx`、`lobbyGlass.css`、`ExpeditionMap.tsx` 的舊函式，並一併調整它的測試），以及 `FocusSetup` 與 `SessionDebrief` 的舊畫面。`#/qa/lobby-a-*`、`#/qa/after-*` 預覽與 `lobbyMock.ts` 可以保留，方便日後調整畫面。

## 場景（`cloudRuinsScene.js`）的新增功能

- `mode: 'lobby'` 預設為**特寫鏡頭**：大約 11 個單位寬，仰角比 Focus 低約 11°。框住的位置依狀態而定：
  - 還沒出發：入口踏石。
  - 部分進度：最後一盞點亮的燈。
  - 完成：中央大樹。
- `setLobbyView({ kind: 'close' | 'look', exit? | 'overview' })`：鏡頭用 1.2 秒移過去，依實際時間計算，不受幀率影響。看向出口時旅人會轉頭。上午的全圖版傳入 `overview`，外觀不變。
- `setLobbyItems([{ key }])`：在休息點旁放最多 3 個發光的小物件，並回報 `item:<key>` 錨點給前端。
- 燈痕改成不透明、不受光照的小圓點，白天也看得見。
- `edgeGlass.js`：玻璃卡上限從 8 張提高到 12 張。
- 左側導覽列也是玻璃（2026-09-27 使用者要求）：大廳 A 顯示時，`lobbyA.css` 用 `.app-shell:has(.lobby-a)` 讓場景鋪到整個視窗，導覽列（`.app-shell > .sidebar`，寬 132px，可用 `--app-rail-w` 改）浮在場景左邊、本身透明。`LobbyStage` 會量它的位置，讓場景在底下畫同一種玻璃，並以 `chrome.left` 把旅人框在導覽列和右側面板之間。導覽列的分頁與進度卡在這個畫面改成圓角玻璃樣式。其他頁面（任務、世界、紀錄、設定）不受影響；專注結束畫面蓋住整個視窗，也不受影響。`App.tsx` 不需要改。
- 以上都合併在 Codex 今晚加入的 `coreTaken`、`worldMarks`、樹下痕跡、信物／核心分級之上，兩邊的功能都保留。Focus Active 同尺寸下的鏡頭取景比對結果相同。

## 修改的檔案

| 檔案 | 內容 |
|---|---|
| `src/renderer/src/lobby/lobbyTypes.ts` | 新增：三個畫面的資料與 action 介面 |
| `src/renderer/src/lobby/LobbyA.tsx` | 新增：大廳 |
| `src/renderer/src/lobby/DepartureSheet.tsx` | 新增：出發前確認 |
| `src/renderer/src/lobby/AfterFocus.tsx` | 新增：完成了嗎與回顧 |
| `src/renderer/src/lobby/LobbyStage.tsx` | 新增：特寫場景的 React 包裝與玻璃量測 |
| `src/renderer/src/lobby/lobbyMock.ts` | 新增：模擬資料與本地操作 |
| `src/renderer/src/lobby/LobbyPreview.tsx` | 新增：開發用預覽 |
| `src/renderer/src/lobby/lobbyA.css` | 新增：三個畫面的樣式；大廳顯示時左側導覽列改為浮在場景上的玻璃 |
| `src/renderer/src/cloudRuins/cloudRuinsScene.js`、`.d.ts` | 特寫鏡頭、看向出口、旅人轉頭、草地物件、燈痕畫法、`chrome.left` |
| `src/renderer/src/cloudRuins/edgeGlass.js` | 玻璃卡上限 12 張 |
| `src/renderer/src/LobbyScene.tsx` | 上午的全圖版改為明確要求 `overview` 鏡頭 |
| `src/renderer/src/App.tsx` | 只在開發模式、網址是 `#/qa/lobby-a-*` 或 `#/qa/after-*` 時顯示預覽 |
| `src/renderer/src/main.tsx` | 載入 `lobby/lobbyA.css` |
| `scripts/qa-lobby-a.cmd` | 新增：實機截圖腳本 |

## 檢查結果

- **已執行**：
  - 以 TypeScript 5.7.3 對新檔案做 strict 型別檢查，沒有錯誤。
  - 在雲端容器用 headless Chromium 檢查大廳 8 種情境與專注結束 4 種情境，尺寸 1366×768、1320×860、1040×700；也操作了出發確認的換事項、程式清單，以及面板變長時按鈕固定在下方。
- **未執行**：全專案的 `npm.cmd run typecheck`、`npm.cmd test`，以及 Electron 實機畫面。寫入 repo 後會在電腦上再跑一次 TypeScript 5.7.3 型別檢查；實機請雙擊 `scripts/qa-lobby-a.cmd`。

## 已知問題

- 特寫時旅人的帽簷會遮住臉，筆記本也不夠明顯，需要調整旅人模型或動作。
- 視窗較窄時，路線卡的一句介紹會被截斷；滑過卡片時，詳情卡會顯示全文。
- 「看向出口」目前只為雲上遺庭的兩個出口設計。
- 玻璃導覽列靠 CSS `:has()`（Electron 的 Chromium 支援）。接上真資料後，大廳 A 取代 TodayView 就會自動套用；上午的全圖版不套用。
- 營火起點還沒做（§47.3），旅程第一段暫時用入口踏石。
