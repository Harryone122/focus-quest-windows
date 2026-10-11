# Today 大廳：路線選擇的美術與介面交接

> 2026-09-26 晚更新：使用者之後選定大廳方案 A（旅人特寫＋右側面板），並取消主線／支線，改為今天的清單，見企畫書 §47。本文件記錄的是上午交付的全圖版；其中的大廳模式、燈痕、出口錨點、玻璃面板與 `snap` 會沿用到新版，但全圖構圖與以分鐘數為主的路線標記不再是最終方向。

Claude 交付，2026-09-26。目標是讓大廳（Today）的路線選擇沿用雲上遺庭 3D 地圖與 Focus Active 玻璃介面的視覺語言；依 `UI_UX_RULES.md`，地圖仍是這一頁的主角，回答「下一步往哪裡走？」。

## 畫面構成

- **整頁只有一套 3D 場景**：`cloudRuinsScene.js` 新增 `mode: 'lobby'`，畫布鋪滿 Today。場景停在已保存的進度，不推進時間：
  - 今天還沒走完任何一段：旅人站在入口的霧中踏石，燈都沒亮，晨霧光線。
  - 已走完一段：顯示剛走完的 Area，五盞燈全亮，旅人在中央大樹下休息（整理筆記／躺草地／看雲，沿用休息活動），光線停在該段結束時的時段。
  - 相機仍可拖曳偷看，放開後彈回。
- **路線標記掛在出口旁**：每條候選路線是一顆玻璃膠囊（分鐘數、路名、出口名），用細引線連到它離開的地方。
  - 高台出口的標記在浮空石階上方的天空，松林出口的標記在往下踏石的雲裡，兩者都不壓到浮島。
  - 第一個岔路（兩條路都從入口進島）：兩顆標記疊在入口踏石下方的雲上。
  - 出口不明的路線（見「請 Codex 補的欄位」第 1 點）或 WebGL 失敗時：標記排成一列，放在地圖下緣。
- **地面上的燈痕**：從大樹（或入口踏石）沿路走到每個出口，路上有一串小燈痕。已選的路線是暖琥珀色，並有一道慢慢往出口走的光；其他路線是很淡的青白色；滑鼠移到標記上或用鍵盤聚焦時會稍微提亮（預覽）。已選出口的雲霧也會微微聚攏。
- **右側玻璃面板**（`data-glass-side`，由場景繪製的玻璃卡）：
  - 上段是**路線**：Area · 出口、路名、分鐘數、五盞燈（partial 時點亮已過的燈並顯示「已保存 N 分鐘」）、一句描述、出口提示、遺物情報（只有真的有情報時才出現），以及唯一的主要按鈕「開始探索／繼續探索」。
  - 中段是**主線**。
  - 下緣是可展開的「如果還有餘裕 n / 2」，裡面放原本的支線 TaskCard（操作不變）。
- **標題列**：使用場景的上方玻璃帶，左邊是「今日遠征 · 日期」與「今天往哪走？」，右邊是旅人此刻的動作（來自場景的 `reportActivity`，例如「旅人靠著大樹整理筆記」）。
- 相機會把整個 Area 框在「標題列下緣、面板左緣」之間的清晰區，並替上下兩顆出口標記留出空間。1040×700 到寬螢幕都能看到完整構圖。
- 顏色與 Focus 相同：燈火琥珀 `#e0b265`、青綠 `#a9d0c9`、文字 `#f1eee6`，按鈕都是 16px 圓角玻璃膠囊。

## 互動契約（不變）

```text
點標記 -> onSelectNode（只選擇，可以來回改選）
開始探索 / 繼續探索 -> onContinueNode -> Focus Setup -> 確認出發才開始計時
```

- 標記只呼叫原本的 `selectExpeditionNode`。沒有任何動畫會決定進度或寫入存檔。
- Focus 期間仍不能選路（Focus 進行中 App 不會顯示 Today）。
- 標記是 `<button aria-pressed>`，可用 Tab 聚焦；無障礙名稱包含路名、分鐘、出口、已保存時間與是否已選擇。
- 使用者設定減少動態時，燈痕不流動，場景動態降到 25%，並關閉 CSS 轉場。

## 動畫清單（全部純視覺，不需要結果回報）

| 識別 | 觸發 | 需要的狀態 | 說明 |
| --- | --- | --- | --- |
| `lobby.trail.selected` | 選定路線改變 | `run.selectedNodeId`、`node.departureExitId` | 琥珀燈痕沿路往出口流動 |
| `lobby.trail.hover` | 滑鼠移到標記上或鍵盤聚焦 | 無 | 未選路線的燈痕提亮 |
| `lobby.exit.veil` | 選定路線有出口 | 同上 | 出口雲霧微微聚攏 |
| `lobby.traveller.rest` / `.wait` | 大廳掛載 | 上一段已完成的進度 | 在大樹下休息，或在入口等待；不前進 |
| `lobby.marker.fade` | 場景回報錨點 | 無 | 標記淡入 |

## 修改的檔案

| 檔案 | 內容 |
| --- | --- |
| `src/renderer/src/cloudRuins/cloudRuinsScene.js` | 新增 `mode: 'lobby'`：固定進度，旅人不走向燈，只休息或等待；新增 `setRoutes()` 燈痕、`reportAnchors` 錨點回報、大廳取景（依整個 Area 的邊界配合 `chrome.right`）；鏡頭靜止時約 30fps。Focus 模式行為不變（相同尺寸下 frustum 與原版完全相同，已比對）。 |
| `src/renderer/src/cloudRuins/cloudRuinsScene.d.ts` | `mode`、`reportAnchors`、`setRoutes`、`CloudRuinsRouteMark`、`CloudRuinsAnchors`、`chrome.right`、`card.snap` 型別 |
| `src/renderer/src/cloudRuins/edgeGlass.js` | 玻璃卡可設定 `snap`：跟著鏡頭移動的標記，玻璃直接貼齊，不緩動。Focus 沒有使用 `snap`，所以不受影響。 |
| `src/renderer/src/LobbyScene.tsx` | 新增：大廳場景的 React 包裝，負責量測玻璃位置（面板→文字區→標記的固定順序），以及開發模式的 `window.__lobbyScene` QA 入口 |
| `src/renderer/src/ExpeditionLobby.tsx` | 新增：整個大廳（標題列、標記配置、右側面板） |
| `src/renderer/src/ExpeditionMap.tsx` | 改為純函式的路線模型：保留 `selectedNodeForRun`、`canStartSelectedNode`（測試會用到），新增 `lobbyModel`、`routeExit`、`EXIT_COPY`、`routeIntel`。舊的 SVG 岔路元件已移除。 |
| `src/renderer/src/lobbyGlass.css` | 新增，於 `focusGlass.css` 之後載入 |
| `src/renderer/src/App.tsx` | 只改 `TodayView`：改用 `ExpeditionLobby`，支線移入面板，並移除 Today 背景的 `ArchiveGame` 與「檔案館現況」卡（側欄已有顯示）。另外移除未使用的 `nextWorldStage` import。 |
| `src/renderer/src/main.tsx` | 載入 `lobbyGlass.css` |
| `scripts/qa-lobby.cmd` | 新增：typecheck、test，以及 norun／map／archive 三種狀態在 1366×768 與 1040×700 的實機截圖（資料放在 `%TEMP%`） |

`styles.css` 裡舊的 `.today-hero`、`.expedition-interface`、`.today-main-quest` 等規則已不再使用，但仍保留，之後可以另外清理。

## 檢查結果

- **已執行（遠端 VM）**：
  - 在這個 repo 以 `npx -y -p typescript@5.7.3 tsc --noEmit -p tsconfig.json` 做全專案型別檢查（含 `App.tsx` 與 tests），exit 0。
  - 以 `esbuild@0.24.2` 打包 `src/renderer/src/main.tsx`，成功。
  - 用 headless Chromium（SwiftShader WebGL）搭配模擬快照，檢查以下狀態的畫面：尚未開啟、第一個岔路、深度 1 出口、partial、深度 2（標記排在下緣）、1440×900 與 1040×700。另外操作了點選切換、拖曳鏡頭（標記跟著錨點移動）與放開。
  - Focus 模式比對：新舊版同尺寸下取景完全相同。
  - 模擬快照的預覽截圖放在 `previews/lobby-harness/`（不是 Electron 實機畫面，僅供對照構圖）。
- **未執行**（遠端 VM 不能執行 tsc 7、vitest、Electron）：`npm.cmd run typecheck`、`npm.cmd test`，以及 Electron 實機畫面。請 Codex 或使用者雙擊 `scripts/qa-lobby.cmd`，結果會輸出到 `previews/lobby-qa/`。

## 請 Codex 補的欄位與決定

1. **出口只存在深度 1**：`generateRoutes` 只有在 `depth === 1` 時才寫入 `departureExitId`。深度 2 以後的路線沒有出口，大廳只能把它們的標記排在地圖下緣，下一次 Focus 也不會播放離開演出。建議每一層子路線都依序對應母 Area 的兩個出口（index 0 → `exit_high`、1 → `exit_pines`），並讓 `startFocus` 為所有深度產生 `departure`。
2. **Area 身分**：目前所有節點都畫成雲上遺庭，所以大廳直接寫死「雲上遺庭」。之後有第二張地圖時，請在 `ExpeditionNode` 加上 `areaId`（或 Area 標題），大廳與 Focus 再依此選擇場景。
3. **大廳光線**：大廳使用上一段的已保存進度計算日夜（`max(progressSeconds, planned)`）。例如 25 分鐘的路走了 27 分鐘，大廳就停在夜晚。這符合「以有效專注時間計算」的規則；如果使用者希望大廳用別的時間，再請使用者決定。
4. **Git 鎖檔**：Claude 在查看 `git status` 時，因為沙箱不允許刪除檔案，留下了空的 `.git/index.lock`。已把它改名為 `.git/index.lock.stale-from-claude`，Git 可以正常使用。這個空檔案可以直接刪除。之後 Claude 查看狀態時會改用 `git --no-optional-locks status`。

## 驗收重點

1. Today 開啟後整頁是雲上遺庭。沒有岔路時，旅人在入口踏石；有岔路時，旅人在大樹下休息，並且沒有前進。
2. 兩顆標記在出口旁，引線指向石階／踏石，沒有壓到浮島或面板；1040×700 也成立。
3. 點另一顆標記：燈痕和面板一起切換，不會開始計時；按「開始探索」才打開 Focus Setup。
4. 拖曳地圖：標記和它的玻璃跟著出口移動，放開後一起彈回。
5. partial 路線顯示已保存分鐘數，按鈕是「繼續探索」。
6. WebGL 無法建立時：背景退回深色漸層，標記排成一列，面板是半透明深色底，所有操作都照常可用。
7. 大廳切到 Focus Active 時，大廳場景會先卸載（App 只顯示 FocusActive），不會同時存在兩個 WebGL 場景。
