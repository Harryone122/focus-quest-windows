# Focus Pause：Codex → Claude 交接

日期：2026-09-26。使用者要求：按下暫停後整個世界靜止，計時停止；前端美感由 Claude 負責。

## 本輪狀態

**最新狀態（2026-09-26，0.6.5）：Claude 已完成按鈕、場景凍結與沉浸模式；Codex 已完成實機整合驗證，並修正恢復快照抵達時可能短暫倒退一秒的問題。驗證紀錄見 `docs/RELEASE_0.6.5_QA.md`。** 下列工作清單與原先的「待驗證」描述保留作為交接歷程，以本段最新狀態為準。

請保留目前玻璃介面及 Claude 的地圖效果。讀取 `AGENTS.md`、`docs/AGENT_WORKFLOW.md` 後再修改，同一工作目錄輪流寫入。

## 已可用的後端契約

```ts
window.focusQuest.pauseFocus(sessionId: string): Promise<AppSnapshot>
window.focusQuest.resumeFocus(sessionId: string): Promise<AppSnapshot>
```

- 兩者均先存檔，再回傳完整快照，同時透過 `onSnapshotChanged` 廣播。
- `activeSession.suspendedAt: string | null`：非 null 表示有效時間暫停，UI 與場景應以此判斷凍結。
- `activeSession.manuallyPaused: boolean`：是否為使用者手動暫停。系統喚醒只解除系統暫停，不能解除手動暫停。
- `activeSession.pausedSeconds: number`：已結算的暫停秒數，可包含小數；目前尚未結束的暫停由 `suspendedAt` 表示，不要自行每秒增加這個欄位。
- 重複暫停或繼續相同的進行中 session 不重複扣除時間；無效／已結束 session 回報錯誤，不能建立另一場專注。
- 暫停前已達成的燈點會在同一交易內保存抽選結果；暫停中不抽選、繼續不重抽。暫停期間停止應用程式封鎖，繼續恢復。
- 暫停中可沿用現有結束專注流程，後端排除整段暫停時間；不需要先呼叫 resume。
- 備份格式升為 v5，仍可讀 v1–v4。手動暫停可在重開／備份還原後恢復。

共用時間工具 `src/shared/focusTime.ts`：

```ts
focusElapsedMs(session, now?)       // 毫秒，不含暫停，適合離開演出恢復
focusElapsedSeconds(session, now?)  // 向下取整的有效秒數
```

App 的 `sessionSeconds` 與 `departureElapsedMs` 已使用上述工具。Area 累積進度仍為原本 `node.progressSeconds + 本次有效秒數`。十分鐘日夜循環與五盞燈均沿用有效時間，不另建後端計時器。

## Claude 要完成的前端

### 1. 暫停操作與畫面

- 在 Focus Active 加入暫停／繼續入口與清楚的暫停狀態；按鈕、文案配置、玻璃視覺與過渡效果由你設計，保留地圖構圖。
- 呼叫 pause/resume API，使用成功回傳的快照更新 React 狀態；等待期間防止重複送出與結束操作交錯，失敗顯示可理解的錯誤並依實際快照恢復。
- 如為即時操作感先凍結畫面，API 失敗必須撤回這個暫時狀態；本機 UI 布林值不能取代後端存檔。
- 不以 `setTimeout` 或動畫完成作為發放獎勵／累積專注時間的依據，不重設 sessionId、startedAt 或建立新 session。
- 重開 App 讀到 `suspendedAt` 時，初次建立場景就處於暫停，不先播幾幀才停止。迷你計時器同樣呈現暫停狀態。

### 2. 凍結全部場景時間

- 在 `CloudRuinsFocusScene.tsx` 與場景 handle 加入 `paused` 初始參數及 `setPaused(boolean)`，同步更新 `.d.ts`。切換 paused **不可**銷毀／重建場景，不要把 paused 加入初始化 effect 的依賴。
- `cloudRuinsScene.js` 暫停後凍結旅人位置／姿態、植物風動、雲霧、落葉、水流、動物、粒子、光照、日夜與特殊發現／離開演出。不是只把旅人速度改成 0。
- 請盤點 `performance.now()`、Three Clock、累加 dt、shader time、tween、CSS animation、延遲事件及鏡頭輸入。各種場景演出共用可暫停的時間；恢復時計時接續，不能把暫停的牆鐘時間加回。
- 特別檢查 `reportedAt`、`lastIncreaseAt`、departure 的 `startWall`、`swapAt`；單純跳過 update 仍可能在恢復後跳過整段演出。可改用同一個排除暫停的場景時鐘，或正確補償所有時間錨點。
- 暫停時不允許拖曳／慣性改變場景鏡頭；resize 可重畫當前凍結狀態。不要把整個 React UI 停住，繼續／結束入口必須可操作。
- 暫停交易可能回傳剛在暫停前取得的特殊發現。已在播放的演出原地凍結，新收到的演出排隊待繼續，不丟棄、不重複播放，也不呼叫後端重新抽選。
- 同一場景內繼續須保持原姿態；重開 App 則從已保存的遊戲狀態恢復並保持暫停，不要求後端保存每一片葉子的畫格。
- 離開演出中的暫停也要生效，恢復接著播；原來 5 秒上限指有效播放時間，不含玩家暫停時間。不要因暫停重複觸發完成回呼。

### 3. 沉浸模式的界線

Claude 本次交付已包含沉浸模式，Codex 已驗證 20 秒閒置淡出與移動恢復。它只改資訊透明度，不改 Focus 狀態或計時，也不把滑鼠閒置當作暫停；暫停中、保存中、有錯誤或面板時不啟用，鍵盤焦點仍須維持可辨識。

## Codex 接手後的實機驗收

2026-09-26 分工修訂：以下開啟 App、截圖／錄影與實機操作由 Codex 執行，Claude 不需要完成這些步驟才能交接，也不需要為此設定 nvm 或模擬環境。Claude 保留前端美感與實作責任，依驗收回饋修正。

1. 專注到接近下一盞燈時暫停，等超過原本燈點：時間、燈數、日夜、世界位置不變，沒有新抽選。
2. 同一場景暫停後隔數秒擷取兩張圖，排除 UI 提示過渡後比較地圖區，確認不是只有旅人停止。繼續後正常移動，沒有瞬移／快轉。
3. 在風動、特殊發現與 5 秒離開演出途中各測一次，兩個出口都測。UI 仍能操作，沒有重複完成回呼。
4. 暫停中重開 App 仍暫停；睡眠／喚醒不解除手動暫停；直接結束得到正確有效時間，保存的發現不遺失。
5. 連續暫停／繼續不重設場景、不重抽獎勵、不改十分鐘日夜週期，API 失敗時畫面與後端一致。
6. 保留現有玻璃介面與不同視窗比例的完整地圖；Codex 檢查整合呈現，Claude 依回饋調整設計，使用者驗收美感。

Claude 請在環境可執行時跑 `npm.cmd run typecheck`、`npm.cmd test`，提供修改清單、已執行檢查的結果、未執行項目與原因、預期畫面行為及剩餘問題，直接交給 Codex。不要把未執行的檢查標示為通過。Codex 接手後補齊檢查，以隔離的 QA 存檔啟動 App、截圖／錄影、實機驗收並負責 Windows 打包；不修改使用者的真實存檔。

## Codex 本輪驗證

- TypeScript 檢查通過。
- 正式環境程式建置通過；未產生新的 Windows 安裝包。
- 78 項測試通過（新增 8 項暫停案例：時間／抽選凍結、兩種睡眠重疊順序、毫秒精度、兩種結束流程、重開／還原、舊備份）。
- 本輪未修改外觀與場景動畫；完整的世界凍結、UI 與實機驗收待 Claude 接入後完成。

## Claude 前端交付（2026-09-26）

### 介面
- 標題列右側：`❙❙ 暫停` 與 `結束這次專注` 兩顆玻璃按鈕。暫停後按鈕變成琥珀色 `▶ 繼續`；計時數字變淡，並顯示「已暫停 · 計時與世界停在這一刻」，承諾進度條轉為琥珀色。狀態膠囊改為「暫停中 · 旅人停在原地，等你回來」，地圖整體淡出約 30% 飽和度與 8% 亮度，作為暫停提示。另有 `role="status"` 的讀屏提示。
- 請求期間 `pauseRequest` 會停用暫停及結束按鈕，按鈕文字為「保存中…」。畫面先顯示目標狀態（樂觀更新），時鐘停在按下的那一秒，並以後端回傳的快照為準。失敗時顯示「暫停／繼續沒有成功：…」，重新讀取 `getSnapshot()` 撤回樂觀狀態。暫停中仍可直接結束。
- 迷你計時器：`suspendedAt` 非 null 時顯示 `❙❙`、「已暫停 · 點一下回到專注」。
- 沉浸模式：20 秒內沒有滑鼠或鍵盤輸入時，文字淡到 40%，場景玻璃淡到 50%；任何輸入都會快速恢復。暫停中、保存中、結果面板或錯誤訊息顯示時不啟用，只改透明度，不影響 Focus 狀態。鍵盤焦點（`:focus-visible`）所在的標題列保持不透明。

### 場景凍結（`cloudRuinsScene.js`）
- 新增可暫停的場景時鐘 `sceneNow()`，等於 `performance.now()` 減去累計的暫停時間。`reportedAt`、`lastIncreaseAt`、departure 的 `startWall`、`swapAt` 與 `setProgress` 全部改用這個時鐘，因此恢復後不會補算暫停期間，也不會跳過演出。
- 暫停時 `update()` 完全不執行：`tAcc`（所有 shader 的 uTime、植物、雲、水、火、動物、粒子、旅人姿態）、`dt` 累加、日夜 preset 的漸變、規劃器、特殊發現與離開演出一律停止。每幀仍會讀取 `clock.getDelta()`，避免恢復時出現一段很大的 dt。暫停中也不能拖曳鏡頭。
- 場景以 `paused: true` 建立時（重開 App 讀到 `suspendedAt`），只執行一次長度為 0 的 update 來顯示存檔狀態，之後不會播放任何一幀。
- 暫停中停止持續繪圖，只在 resize、玻璃位置變化或暫停色調過渡時重畫目前凍結的畫面，因此 GPU 幾乎閒置。
- `playSpecialFind` 在暫停中只會排入佇列，恢復後照原本的佇列播放；`reportDepartureComplete` 仍只觸發一次。
- `setPaused` 與 `setUiFade` 不會重建場景；`paused` 不在 `CloudRuinsFocusScene` 初始化 effect 的依賴中。

### 修改檔案
`cloudRuins/cloudRuinsScene.js`、`cloudRuins/edgeGlass.js`（暫停色調 `uPause`、沉浸淡出 `uUi`）、`cloudRuins/cloudRuinsScene.d.ts`、`CloudRuinsFocusScene.tsx`、`App.tsx`（FocusActive、MiniTimerView、傳給 App 的 `onSnapshot`）、`focusGlass.css`、`scripts/qa-focus-pause.cmd`（新增）。

### 驗證
- TypeScript 5.7 `tsc --noEmit` 通過；renderer 可以完整 bundle。
- Prototype harness（同一份場景程式）：
  - 暫停後相隔 4 秒擷取的兩張地圖區截圖，差異像素為 0；場景時間與 sim 都沒有改變。恢復後從原位置接續走動，沒有瞬移。
  - 高台與松林出口的離開演出途中暫停 6 秒，`t` 不變；恢復後接續播放並完成，完成回呼只觸發 1 次，之後再暫停／繼續也不會重複觸發。
  - 以 `paused: true` 建立的場景，兩張截圖的差異為 0。
- 使用者表示這輪不需要截圖驗收，因此**尚未在實機 App 中操作暫停**。Windows `npm.cmd run typecheck` 與 `npm.cmd test` 也請 Codex 一併執行（`scripts/qa-focus-pause.cmd` 會跑這兩項，並用隔離 QA 存檔開啟一個接近第一盞燈的 Focus 視窗）。

### 請 Codex 接手確認
1. 實機暫停／繼續、暫停中結束、重開仍保持暫停，以及系統睡眠後的畫面。也可以用 Ctrl+R 重新載入 renderer，確認建立時就是暫停狀態。
2. `optimisticPaused` 在成功路徑中與 `onSnapshot(next)` 在同一個 React batch 內清除；如果廣播比回應晚到，畫面仍以回傳的快照為準。
3. 燈數仍依 `node.progressSeconds + 有效秒數` 在前端計算顯示，抽選結果只來自後端的 `specialFinds`。
