# 大廳規則後端交接（2026-09-26，0.6.7 後端測試版）

更新：2026-09-27 已接上 Claude 的正式大廳、出發確認、回顧與玻璃導覽列，準備交付 0.6.8。請先讀 `LOBBY_A_HANDOFF.md` 最前面的整合更新；以下保留 0.6.7 原始交接紀錄。新增 discovery-read 表與 `seenFindIds`／`mapVisits`、備份 v8；完整回顧也能 dismiss 回到大廳。舊的全 50 分鐘／五段終點缺口仍未擴張實作。

使用者先授權實作 Codex 負責的規則，後續改為「先給我測試版」，因此已獨立打包 0.6.7。本次完成 SQLite、共用清單型別、IPC/preload 與測試；未切換 Today、未改大廳視覺、未改第一張地圖場景或動畫。這不是完整新大廳整合版，出貨驗證見 `RELEASE_0.6.7_QA.md`。

本次工作時 `docs/LOBBY_A_HANDOFF.md` 與 `lobby/lobbyTypes.ts` 尚未出現在本機。因此不自行建立或覆寫 Claude 的同名檔案；先提供獨立的共用清單契約，實際前端交付後再由 Codex 整合成它需要的 `snapshot.lobby`。

## 已完成的規則

### 路線與 Focus

- 有父節點的每一層子路線依生成順序對應目前森林的兩個出口：index 0 → `exit_high`、index 1 → `exit_pines`。第一層入口沒有前一張地圖，維持 `null`。
- 開庫／匯入舊備份時，以原 seed、parent、stable node ID 回填缺失出口，不重抽路線、不覆寫已存在出口、不改節點 ID 或歷史進度。
- `FocusSession.departure` 沿用既有五秒契約，各深度的節點第一次 Focus 都能帶出正確離場提示；partial 續玩不重播。場景的動畫與鏡頭未改。
- §47 的 partial 鎖定已在後端落實：目前地圖未完成只能續玩；專注中也不能切換選路。尚未開始探索前仍可切換候選。
- 旅程不再因日期不同拒絕續玩；`todayRun` 暫留舊 API 名稱，實際代表目前 active 旅程。舊存檔若有多筆 active 日遠征，優先使用正在專注的，再選待回顧的，再選最近建立的；舊紀錄不刪除。
- 旅程不再綁死主線事項。每次出發可改選今天的未完成事項，開始 session 時才更新舊 `main_task_id` 相容指標；不影響路線、partial 或前次 session 綁定。
- 新清單 Focus 預設使用今天第一件未完成事項，也接受明確選取；完成回顧只需 `completed: boolean`。完成整件事及全部相容 step；未完成則排回原清單頂端。跨午夜的事項不因此自動改排日期。
- 完成事項不決定遊戲獎勵；亦移除舊普通 Focus 中依完成／角色額外給星頁、材料及推劇情的分支，既有歷史數值不回收。有效時間、五燈及森林核心規則維持原有權威。

### 日期清單

- 新清單不帶 main/side 角色，依 `scheduled_date + list_position` 排序，沒有一主線／兩支線數量上限。
- 新事項只需要標題；相容的 kind、step 等欄位由後端補值。舊任務的資料、ID、steps、Focus 紀錄保留。
- 今天的清單顯示未完成在前、已完成在後；`nextTaskId` 由後端提供，不讓前端自行挑工作。
- `yesterday` 合併所有先前日期尚未處理的一般事項，保留各自原 `scheduledDate`。這是本輪採用的多日積欠處理方式，沒有新增日曆或懲罰。
- 只有明確「移到今天」才改日期，依傳入順序排到今天尾端；重送已在今天的 ID 不改順序。
- `backlog` 仍代表未排日期的「以後再說」。旧版曾經自動改成 backlog、已失去原排程的資料，不能推測原日期，維持現況。
- 刪除清單事項使用 `deleted_at` 墓碑：清單沒有還原入口，但保留支撐專注歷史與旅程外鍵的資料，避免刪工作時連帶刪遊戲進度。不是清除永久收藏，也不是刪除全部專注紀錄。
- 「刪除昨天全部」須帶完整待刪 ID 集合、目前 localDay 與精確文字確認；日期或清單已變則要求重確認。若其中有正在專注／未回答回顧的事項，整批拒絕、不部分刪除。

### 例行事項

- 星期用 JavaScript 標準：`0=星期日，1=星期一，…，6=星期六`，不設定時刻。
- 當天首次讀取快照時生成符合星期的例行事項；常駐 App 換日及系統喚醒也會刷新快照。
- 當天新增／啟用一個符合星期的例行設定，立即產生當天的一份；同一天反覆讀取或儲存不重複。
- 同一設定以 `(routine_id, routine_day)` 保證一天最多一份；完成、刪除、重開都不再次生成。不補產 App 未開啟日期的事項。
- 先前日期未完成的例行實例不出現在今天／昨天／任務庫，歷史 session 保留。跨午夜仍在專注的舊實例可正常完成，不阻止隔天新實例生成。
- 修改／停用／刪除例行設定只影響尚未生成的實例，不改寫當天已產生的事項與歷史。刪掉設定後重新新增是新的 routine ID。

## 資料契約

型別：`src/shared/taskList.ts`。由現有 `AppSnapshot` 新增 `taskList`，沿用 `snapshot:changed`。

```ts
interface TaskListSnapshot {
  localDay: string
  today: ListTask[]
  yesterday: ListTask[]
  backlog: ListTask[]
  routines: RoutineDefinition[]
  nextTaskId: string | null
}

interface ListTask {
  id: string
  title: string
  scheduledDate: string | null
  position: number
  completed: boolean
  routineId: string | null
  stepId: string | null // 舊 Focus 相容；新大廳不用讓玩家操作小步驟
}
```

資料內沒有核心保底進度。路線、specialFinds、mapCores、pendingDebrief 仍沿用現有 snapshot 欄位；未假造 Claude 的完整 LobbyData，也未宣稱新發現已讀或延後事件決策的新資料模型已完成。

## 後端操作（均經 window.focusQuest）

| 方法 | 輸入 | 說明 |
| --- | --- | --- |
| `addListTask` | `{ title, placement?: 'today' \| 'backlog' }` | 預設新增到今天 |
| `renameListTask` | `taskId, title` | 改事項名稱 |
| `reorderTodayTasks` | `localDay, taskIds` | 必須包含今天全部未完成 ID，各一次；拒絕過期／不完整排序 |
| `moveTasksToToday` | `taskIds` | 逐件或全部移到今天，按陣列順序附加 |
| `setListTaskDone` | `taskId, done` | 清單勾選，絕不發遊戲獎勵；專注中改用 session 回顧 |
| `deleteListTask` | `taskId` | 從清單刪除，保留歷史關聯 |
| `deleteYesterdayTasks` | `{ localDay, taskIds, confirmation }` | 確認文字為 `刪除昨天全部未完成事項`，常數已匯出 |
| `saveRoutines` | `[{ id?, title, weekdays, enabled }]` | 完整有序設定清單；未傳既有 ID 表示移除該設定；新項目不傳 ID |
| `startListFocus` | `{ taskId?, minimumMinutes, blockedProcessNames, runId?, nodeId?, plannedMinutes? }` | 預設今天第一件，step 由後端決定；探索出發須帶已選定路線的三個欄位 |
| `finishListFocus` | `sessionId, completed` | 回答整件事項完成了嗎，回傳新 snapshot；session 結算冪等 |

以上新操作都回傳完整 AppSnapshot 並透過主程序推送快照。`startDailyRun`、`selectExpeditionNode`、`chooseNextRoute` 暫沿用舊名稱；開始旅程允許今天任何未完成事項。`startListFocus` 不帶路線仍相容普通工作專注，不會自行選路。下一輪大廳接線應明確傳入路線，不能省略後誤以為有推進地圖。

partial／too_short 的回顧回答後仍使用 `dismissDebrief` 清除現有回顧；完整探索依原本 `chooseNextRoute` 接下一段。新大廳允許事件留待稍後處理的流程，等 Claude 完整契約後再接，不在本輪改造故事事件系統。

## 舊資料與備份

- tasks 增加 `list_position`、`routine_id`、`routine_day`、`deleted_at`；增加 `task_routines`。
- 舊任務未有順序時，按舊主線／支線／任務庫順序與建立時間穩定回填，再以日期＋順序運作。沒有重建任務表或刪除舊資料。
- `QuestTask.role` 與 `daily_runs.main_task_id` 仍保留給舊 renderer／備份相容，不是新清單的規則來源。
- 備份版本升為 7，含例行設定與新欄位；仍可匯入 1–6。匯入失敗會完整回滾，例行星期資料也會驗證。
- 不將舊的 25／90 分鐘地圖強制改成 50。新路線生成目前仍有旧時長；全 50 分鐘與既有探索的相容切換另行整合，不宣稱本輪完成完整 §46。

## 驗證與未完成事項

通過：

- `npm.cmd run typecheck`。
- `npm.cmd test -- --reporter=dot`：9 個測試檔、92 項測試通過。新增 13 項涵蓋清單、排序、跨日、例行、完成獨立性、確認刪除、各層出口、跨日續玩與 migration/backup；既有 partial 換路測試改為驗证 §47 的鎖定規則。
- `node_modules/.bin/electron-vite.cmd build`：main/preload/renderer 建置成功，沒有執行 electron-builder。
- `node_modules/.bin/electron.cmd scripts/qa-task-list.cjs`：新建 temp 存檔、隱藏視窗，驗證真正 preload/IPC、快照廣播、例行、開始／回顧、partial 鎖定、移到今天、文字確認刪除及 renderer reload；無 renderer error。
- 證據：`previews/task-list-backend-qa/report.json`。QA 的兩次預期拒絕（partial 換路／錯誤確認文字）會記錄到主程序輸出，屬斷言驗證。

尚待整合：Claude 的 `LOBBY_A_HANDOFF.md`／`lobbyTypes.ts`、完整單一 lobby snapshot adapter、事件處理與新發現已讀、Today 切換、清單版出發／回顧畫面、全 50 分鐘及五段終點。新前端驗收前保留舊大廳檔案。

後續依使用者要求產生 `release-v0.6.7` 測試版；0.6.6 安裝包保留不重建。使用隔離存檔載入出貨 asar 驗證規則與第一張地圖，再備份正式資料並切換到 0.6.7 程序。新清單／例行的操作介面仍待 Claude 交付；後端 API 通過測試不代表這些入口已出現在舊 UI。
