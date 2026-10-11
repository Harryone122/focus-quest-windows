# 苔痕驛站 App 移植交付（Claude，2026-09-27）

> Codex 接合更新（2026-09-27）：本補丁已套用至正式程式，請勿再次套用。正式選路已開放雲上遺庭與苔痕驛站，兩張地圖都有自己的標題；新節點為 50 分鐘，既有節點維持原時長。Codex 另修正首次繪製後才開始的離場計時、跨圖霧幕與重開／慢速載入的離場恢復。Windows 與出貨版本驗收見 `docs/RELEASE_0.6.13_QA.md`。下文保留原始交付紀錄。

使用者先前請 Claude 開始實作苔痕驛站的 App 場景，Claude 已完成原型移植和 Focus／大廳接線。11:11 的分工更新改由 Codex 負責正式實作與整合，所以這份成果**沒有寫進 `src/`**。成果以 patch 交付，是否套用由 Codex 決定。可以整包套用，也可以只參考部分內容。

## 基準

這份 patch 以 2026-09-27 11:56 UTC 的工作目錄為基準，下列檔案在 Claude 端與使用者電腦上的 `git hash-object` 完全一致：

- `App.tsx`、`cloudRuins/sceneHandoff.ts`、`lobby/*`（6 個）
- `shared/area02.ts`、`types.ts`、`eventSelection.ts`、`specialFinds.ts`
- `preload/index.ts`、`main/database.ts`、`styles.css`
- `docs/area-02-moss-station.scene.json`

後端檔案一個都沒改。`App.tsx` 保持 CRLF。

```
git apply --check docs/handoff/area02-frontend-port/area02-frontend-port.patch
git apply docs/handoff/area02-frontend-port/area02-frontend-port.patch
```

## 內容（12 個檔案，+2407／−59）

### 新增

**`src/renderer/src/mossStation/mossStationScene.js`＋`.d.ts`**

這是場景模組，以已驗收的原型 `docs/prototypes/moss-station.html` 為準，世界、光影、天氣、水與瀑布都不變。模組只負責播放，對外介面與 `cloudRuinsScene` 同形：

- `setProgress`、`setMossState(MossSceneSnapshot)`、`setPaused`、`setUiFade`、`setChrome`
- `enterLobby`、`setRoutes`、`setLobbyView`、`setLobbyItems`
- `setReducedMotion`、`destroy`
- `areaId = 'area-02-moss-station'`

播放規則如下：

- 旅人照 `action.plan` 的絕對 `legEndSeconds` 連續行走，同一 id 的 plan 更新也會讀取。
- 事件、等待、點燈、休息的姿勢來自已保存的 action。
- 路燈只依 `litLampCount(effectiveSeconds)`。
- 天氣用 `weatherAt(weatherSeed, 秒)`。
- 時段用 `timeOfDayAt`，連續漸變。
- 世界記憶來自 `worldMarks`。
- 核心抽屜在 `rare_drawer_compass` 揭示完成後才變空。
- 暫停時場景時鐘凍結。
- 保留 RAF watchdog。
- 邊緣玻璃沿用 `edgeGlass.js`。

離開演出：

- 小舟：從溪尾順瀑布落入霧海。
- 隧道：沿軌道走進洞口。
- 演出時長 ≤ 5 秒，從**第一個畫出的影格**開始計時，建構場景與編譯 shader 的時間不算在 5 秒內。

**`src/renderer/src/MossStationFocusScene.tsx`**

React 包裝，對應 `CloudRuinsFocusScene`。它處理玻璃量測、`retainForLobby` 交棒和失敗 fallback；場景建立失敗時直接回報離開完成。

**`src/renderer/src/AreaFocusScene.tsx`**

依 `node.areaId` 選擇雲上遺庭或苔痕驛站：

- 苔痕狀態優先讀 `snapshot.mossStation`（nodeId 相符時），否則讀 `getMossScene(nodeId)`。
- 上一站在苔痕時，Focus 前 5.25 秒內讀取 `getMossDeparture`＋`getMossScene(from)`。
- 跨區離開時，先顯示被離開的區域播完 5 秒離開演出，場景回報完成後才換到新區域，並從霧中浮現。場景一直沒有回報時，Focus 15 秒後強制切換。計時、進度、獎勵都不等動畫。

### 修改

| 檔案 | 改動 |
|---|---|
| `App.tsx` | `<CloudRuinsFocusScene …/>` 改為 `<AreaFocusScene …/>`，props 相同，另外帶入 snapshot／session／node |
| `cloudRuins/sceneHandoff.ts` | 新增 `AreaSceneHandle`、`sceneAreaOf`；`takeSceneForLobby(area)` 會釋放不同區域留下的場景，不會拿錯場景 |
| `lobby/LobbyStage.tsx` | 依 `sceneKey` 建立苔痕或雲上場景，苔痕大廳讀 `getMossScene(nodeId)`；路線與鏡頭依區域篩選出口 |
| `lobby/LobbyA.tsx`、`DepartureSheet.tsx` | 出口文字新增「⌄ 霧瀑小舟」、「⌃ 苔痕隧道」 |
| `lobby/AfterFocus.tsx` | 休息處文字依區域顯示「候車室」或「樹下」 |
| `lobby/lobbyTypes.ts`、`fromSnapshot.ts` | 新增 `sceneKey`／`nodeId`；核心、世界記憶、造訪次數按地圖分開；路線出口取 `mossExitId ?? departureExitId` |

## 已驗證

以下都在 Claude 雲端環境完成，**不是** Windows／Electron 實機：

- 型別與建置：`tsc --noEmit` 通過，`electron-vite build` 通過。
- 場景 harness：
  - 用 Codex 的 `advanceMossRuntime` 餵資料，連續行走 180 秒沒有跳位。
  - 核心揭示與抽屜延後清空正常。
  - 小舟與隧道離開都在 4.97 秒完成。
  - 大廳近景、看路線、總覽鏡頭，以及路線軌跡、物品擺放都正常。
- 整合測試：真實的 `FocusQuestDatabase`（better-sqlite3，隔離的暫存資料庫）＋mock preload＋正式 renderer build，用 headless Chromium 執行。
  - `focus`：苔痕 Focus 畫面、玻璃、狀態文字都來自已保存的 action。
  - `journey`：
    - 完成苔痕節點後，大廳顯示長椅、新發現與兩張出口卡。
    - 選路線並開始下一段 Focus 後，先播苔痕小舟離開，再換成雲上遺庭。
- 限制：swiftshader 建一次苔痕場景約需 30 秒，所以 journey 測試用 `LATE_START=100` 把 Focus 開始時間往後推，避開 15 秒 fallback。實機 GPU 預期 1–2 秒。

`qa/` 附測試腳本供參考，路徑請依實際位置調整：

- `integ-run.js`：`NODE_PATH=<repo>/node_modules node integ-run.js focus|journey`
- `integ-backend.ts`：以 esbuild 打包成 node cjs，better-sqlite3 設為 external。
- `harness-*`：場景單獨測試頁。

## 留給 Codex

1. 決定是否套用。套用後在 Windows Electron 實測：
   - 苔痕 Focus、暫停與恢復、重開。
   - 大廳。
   - 苔痕 ↔ 雲上的跨區離開，兩個方向都要測。
2. 路線生成正式開放 Area 02，並給苔痕節點正確的標題與描述。測試時是用 SQL 把節點改成 Area 02，大廳卡片仍顯示雲上遺庭的房間名。
3. 選做：雲上遺庭場景（`cloudRuinsScene.js`）的離開計時仍從建構開始算。第一次編譯 shader 較慢的機器上，可比照苔痕改成從第一個影格開始算。這次沒有動它。
4. 打包。
