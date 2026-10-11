# Focus Active 介面改版交接：讓地圖延伸到文字邊緣

## 使用者回饋（2026-09-26）

參考截圖：`previews/focus-ui-before-blur-20260926.png`。目前上方不透明的深色資訊列、下方兩塊深色資訊底板，與雲上遺庭場景有明顯的矩形邊界。使用者希望保留地圖主體，讓場景的顏色與光影延伸到文字所在的邊緣，再以局部模糊、半透明材質與漸層維持可讀性；觀感參考 Apple 常見的柔和玻璃效果，不使用整片純色背景蓋住地圖。

## Claude 的前端工作

- 重做 Focus Active 的資訊層與場景邊緣銜接。計時、任務、結束按鈕、旅人動向和五盞燈仍可清楚辨識，但畫面不再被上方厚重色塊切成兩半。
- 地圖的浮島、道路、兩個出口、旅人與五盞燈在原有視窗比例及最小視窗 1040×700 下都要完整可見；不能為了鋪滿資訊列而裁切或放大場景主體。
- 讓文字所在區域取色於**同一個正在變化的場景**。可使場景延伸到資訊層後方，再用局部 backdrop blur、透明漸層及適量暗化處理；若該方法在 Electron/WebGL 上效果不穩，選用性能可控的同場景模糊取樣方案。避免額外啟動一套完整的 3D 場景只為了模糊背景。
- 模糊集中在周邊文字區，不糊掉中央地圖和旅人。晨、日、暮、夜切換時，邊緣色彩要跟著場景連續變化，不留下固定黑框、亮度跳變或文字難讀的時刻。底部資訊盡量避開道路、旅人及出口。
- 保留可用的鍵盤焦點、按鈕狀態與低動態偏好。請用晨、日、暮、夜及至少兩種視窗比例的 App 截圖或短錄影交接。

## Codex 已接好的時間契約

`src/shared/timeOfDay.ts` 以**有效專注時間**計算 10 分鐘完整循環，晨霧、日間、薄暮、夜晚四個基準點在 0、2.5、5、7.5 分鐘。`src/renderer/src/cloudRuins/cloudRuinsScene.js` 已用它連續混合 Claude 的四套光照參數，不再讀電腦時鐘。暫停時不推進，同一 Area 續玩與重開後接續已保存的進度。五盞燈仍依該 Area 的規劃時間等分，與 10 分鐘日夜循環互不綁定。

這次視覺改版請保留上述時間與存檔來源，不在動畫端另開計時器。需要新增顯示欄位時，列出欄位名稱與用途交給 Codex 接線。Windows 原生選單列已設為預設隱藏，保留 Alt 鍵叫出功能。

## 驗收重點

1. 同一畫面的場景與文字區之間沒有生硬的純色橫條；文字仍清楚可讀。
2. 地圖主體及旅人不被裁切，1040×700 與較寬視窗都成立。
3. 10 分鐘循環的四個時段及夜晚回晨霧過渡平順，邊緣效果同步。
4. Focus、結束與 Debrief 的功能不受視覺改版影響；畫面載入失敗時 Focus 計時照常保存。

## Claude 交付（2026-09-26）

### 做法

- **只有一套 3D 場景**。畫布鋪滿整個 Focus Active，標題列與狀態膠囊浮在畫布上；相機把整個 Area 框在「標題列下緣 ~ 狀態列上緣」之間的清晰區，只縮不放、不裁切，天空與雲海自然延伸到文字背後。
- **玻璃由場景自己畫**（`cloudRuins/edgeGlass.js`），沒有使用 CSS `backdrop-filter` 疊在 WebGL 上：同一幀先畫進離屏目標（WebGL2 4× MSAA），再縮到約 1/4 解析度做高斯模糊，最後合成：標題列區與底部邊緣使用模糊後的同幀影像，並依亮度上限適度壓暗；文字群組後方有柔和暗區，按鈕與狀態膠囊則是有淡亮邊的玻璃卡。中央地圖直接使用原本的清晰影像。
- 顏色完全取自當下畫面，壓暗參數 `gCap / gCard / gTint` 也放在晨、日、暮、夜四組 PRESETS 中，跟著 `timeOfDayAt` 連續混合；夜晚轉回晨霧時一起過渡，沒有固定黑框或跳色。
- DOM 以屬性標示玻璃位置：`data-glass="top"`（標題列）、`data-glass="bottom"`（底部帶）、`data-glass-card`（按鈕、狀態膠囊）、`data-glass-zone`（任務、計時、路線文字群組）。`CloudRuinsFocusScene` 透過 ResizeObserver 量測後呼叫 `handle.setChrome()`；文字寬度改變時，玻璃形狀會平滑跟隨，相機只在標題列或底部高度真正改變時重新取景。
- 狀態列改為置中的一個膠囊（旅人動向｜五盞燈），避開右下松林出口與右上高台出口；小字從 7–9px 提高到 10–12px。
- WebGL 無法建立時，`.focus-adventure:not(:has([data-glass="scene"]))` 會退回 CSS 半透明漸層，計時與保存不受影響。

### 修改檔案

- `src/renderer/src/cloudRuins/edgeGlass.js`（新增）
- `src/renderer/src/cloudRuins/cloudRuinsScene.js`：接入 edgeGlass、依 chrome 安全區取景、PRESETS 加上 `gCap/gCard/gTint`、handle 加上 `setChrome`；`debugState` 加入 glass、chrome、frustum
- `src/renderer/src/cloudRuins/cloudRuinsScene.d.ts`：`CloudRuinsChrome`、`setChrome`
- `src/renderer/src/CloudRuinsFocusScene.tsx`：量測 `data-glass*` 元素並送進場景
- `src/renderer/src/App.tsx`：FocusActive 只加上 `data-glass*` 屬性與膠囊分隔線；計時、燈數、出口、`openDebrief`、特殊發現等資料來源都沒有改
- `src/renderer/src/focusGlass.css`（新增，`main.tsx` 在 `styles.css` 之後匯入）；`styles.css` 刪除舊的 Focus Active 標題列、世界殼層、狀態列及對應 media query（結果面板與錯誤訊息規則保留）
- `src/main/index.ts`：**只改開發用 QA 截圖**的結束方式，由 `app.quit()` 改為 `app.exit(0)`。原本截完圖後程序不會真正退出，導致 QA 批次檔卡住
- `scripts/qa-focus-glass.cmd`（新增）

### 驗收

- Windows `npm run typecheck` 通過；`npm test`：7 個檔案、70 項測試全部通過（`previews/focus-glass-qa/*.log`）。
- 實機截圖（electron-vite dev、隔離 QA 資料）：`previews/focus-glass-qa/`
  - `wide-*`：1366×768；`min-*`：1040×700（內容區 1026×664）
  - `0-dawn / 150-day / 300-dusk / 450-night / 560-night-to-dawn`
  - `resize-sequence/`：1366×768 縮到 1040×700 的 32 張連續截圖
- 兩種尺寸下，浮島、旅人、道路、五盞燈、高台出口與松林出口都完整可見，沒有裁切或放大。
- 在 prototype harness 中確認鍵盤 Tab 可聚焦「結束這次專注」並顯示金色焦點框；Enter、Space 與滑鼠點擊都能觸發。

### 仍有的視覺問題

1. 開啟 Focus 的第 1 秒內，場景還在建立，畫布區會先顯示深色底（`resize-sequence/frame-000.png`）。這是改版前就存在的情況，可考慮讓 host 背景使用接近晨霧色的漸層。
2. 晨霧時標題列上方偏棕，壓暗感比其他時段明顯；可調整 PRESETS.dawn 的 `gCap`（例如 0.42 → 0.48）。
3. 旅人動向文字變長時，CSS 外框會立即改寬，場景畫的玻璃則約 0.2 秒後才跟上，會有很短的不同步。
4. 寬視窗兩側保留較多天空。這是依照不放大浮島的要求所做的結果。
5. 瀑布尾端和部分雲會經過底部膠囊後方並被模糊，這是刻意保留的畫面。

### Codex 打包前注意

- 會多出一個全解析度離屏目標與一次合成 pass（模糊只在約 1/4 解析度進行）。請在打包版和內顯機器上確認幀率；若效能吃緊，可把 `edgeGlass.js` 中 MSAA 的 `samples` 從 4 降為 2。
- 若日後設定 `renderer.outputEncoding` 或 `toneMapping`，要一起檢查合成 pass，因為目前全流程都是線性且未套用 tone mapping。
- 沒有新增任何後端欄位需求。
- 第一次執行 QA 腳本時留下的一個無視窗 QA Electron 程序可能仍在執行；它只使用 `%TEMP%` 下的 QA 資料。
- 未覆蓋正式存檔，也未產生或發布安裝檔。
