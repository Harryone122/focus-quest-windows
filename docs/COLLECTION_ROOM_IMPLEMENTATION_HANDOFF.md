# Focus Quest 收藏室 §50 — Codex 實作交接

日期：2026-09-28

## 完成範圍

- 正式 App 的「世界」頁已改為收藏室；`ArchiveGame.tsx`、`LivingArchive.tsx`、`SessionDebrief.tsx` 與修復專案的使用者介面已移除。
- `docs/prototypes/collection-room.html` 已以本機 Three r128 資源嵌入 Electron，不依賴 CDN。保留行李內部、十件核心的未取得／未看懂／看懂狀態、各自動態、湖鏡 layer 1 倒影、目鏡、小手／大手、放上核心藍光、十件齊聯動、貼紙、書堆與縮小後的偷看範圍。
- 收藏室由 App 快照驅動。新核心先保存「已播放上演出」，再開始動畫；十件齊亦先保存「已播聯動」，再播放。關閉 App 或動畫中斷不會回滾取得結果。
- 線索桌已接上原型 `CLUES` 範例資料：托盤、釘紙條、方位線、交會、霧散、隱藏地點、追查／取消追查，以及大廳的 `trackingClue` 和羅盤提示。
- DepartureSheet 在已持有該地圖核心時顯示「讓它自己出現／信物 A／信物 B」。有追查中的隱藏地點時，預設選它所需的當地信物；選擇寫進該次探索，開始後沿用且不可改，不修改核心機率、保底或路線保證。
- 被核心指定的信物沿用原本取得演出，另外增加一道細藍光；浮空遺跡與苔痕站兩張現有地圖都已接上。
- 已補 UI 緩和：收藏室進場、右側玻璃面板、出發確認、線索桌／筆記、釘線索與相關遮罩使用淡入、滑移或縮放；系統開啟「減少動態效果」時會縮短或關閉裝飾性動畫。

## 資料與存檔

備份格式升為 version 10，新增：

- `collection_clues`：取得時間、釘上時間。
- `collection_state`：追查中的地點、十件齊聯動是否播過。
- `collection_core_presentations`：各地圖核心的放上演出是否播過。
- `collection_pages`：隱藏地點缺頁狀態（本輪只準備資料，不開放第三張路線卡）。
- `forest_explorations.requested_item`：該次探索指定的信物；空值代表讓它自己出現。

去過的地圖由既有探索紀錄推導，走完的趟數由既有已結束旅程推導；核心看懂狀態由對應線索是否已釘上推導，不另存重複狀態。

### 舊資料處理決定

不把舊修復專案資料硬轉成新線索。兩套資料沒有可靠的一對一語意，強行轉換可能憑空解鎖線索或隱藏地點。既有 `mapCores`、探索、信物、去過地圖與旅程紀錄會直接沿用；舊修復資料表及備份匯入相容性暫時保留，但已沒有使用者介面入口。這樣既不丟資料，也不污染新的收藏室進度，之後若正式訂出映射仍可做一次性遷移。

## 主要檔案

- `src/renderer/src/CollectionRoom.tsx`
- `src/renderer/src/collectionRoom.css`
- `src/shared/collectionRoom.ts`
- `src/shared/types.ts`
- `src/main/database.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/lobby/DepartureSheet.tsx`
- `src/renderer/src/lobby/fromSnapshot.ts`
- `src/renderer/src/lobby/lobbyA.css`
- `src/renderer/src/cloudRuins/CloudRuinsScene.ts`
- `src/renderer/src/mossStation/MossStationScene.ts`
- `docs/prototypes/collection-room.html`
- `tests/collectionRoom.test.ts`

## 驗證結果

- `npm run build`：通過。
- TypeScript：通過。
- Vitest：20 個測試檔、139 項測試全部通過。
- Electron 實機 QA（正式 renderer、preload、SQLite、本機 Three）：
  - 空收藏室與中期收藏室正常顯示。
  - 新核心放上流程已逐格檢查：鏡頭移動、大手、細藍光、核心落位、已放上面板皆正常。
  - 線索桌進場正常；未釘線索留在托盤。
  - 釘上 `h1c` 後，紙條與線段完成，方位線交會並浮出「沉燈灣」與兩件需求物；SQLite 快照同步更新。
  - 無 renderer 程式錯誤。開發模式只出現 Electron 的 CSP 警告，打包版不顯示此警告。

畫面：

- `previews/collection-room-qa/room-empty.png`
- `previews/collection-room-qa/room-mid.png`
- `previews/collection-room-qa/placement-sequence/`
- `previews/collection-room-qa/clue-table.png`
- `previews/collection-room-qa/clue-pinned.png`

## 刻意延後

- 隱藏地圖第三張路線卡只保留解鎖資料，尚未加入選路；等沉燈灣場景完成再開。
- 大廳把行李推入畫面的進場鏡頭未做。
- 正式線索清單未換入，現在使用原型範例。
- 「這一趟」口袋與出發前選信物的排版可在下一輪依驗收調整，不影響已完成的資料契約。

## 2026-10-03 0.6.26 接線回歸修正
Windows CRLF／LF 已統一；收藏室本機模組與 ready 接線恢复，背景預載不再消耗核心展示或十核心聯動。來源及包內離線進入、可見才展示與音場停止均通過。詳見 RELEASE_0.6.26_QA.md 與 previews/debug-regression/。下一步由使用者試玩，Codex 修正具體回饋。
