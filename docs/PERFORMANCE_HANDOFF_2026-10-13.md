# 效能／資源用量優化交接（2026-10-13，Claude）

狀態：**可交接，待 Codex 實機驗證**。使用者直接要求「優化整個 App，不要吃這麼多資源也能正常運行」。本次只改呈現頻率與資源載入方式，**不改畫面構圖、燈光、動作、遊戲規則、計時、獎勵或存檔**。

## 改了什麼

| 項目 | 之前 | 之後 |
| --- | --- | --- |
| 3D 場景（雲上、苔痕、湖畔、苗圃）＋營火大廳／收藏室 iframe | 每個 RAF 都畫；144 Hz 螢幕畫 144 fps；視窗最小化或縮到系統匣時，看門狗計時器仍以 ~30 fps 做完整 GPU 繪製（含陰影、倒影） | 視窗在前景：最多 ~60 fps；可見但未聚焦（玩家在別的 App 工作，Focus 常態）：~30 fps；最小化／藏到系統匣：模擬照常 ~30 Hz 推進，**不做 GPU 繪製**。恢復可見時暫停中的畫面會重畫一次 |
| 封鎖 App 檢查（Focus 期間每 0.8 秒） | 每次呼叫 `getSnapshot()` 兩次（數十個 SQL 查詢，含全部旅程紀錄） | 新的 `getWindowMonitorState()` 只查進行中 session 與已啟用封鎖規則 |
| 玻璃苗圃背景音樂 | 進場時一次解碼 4 首 BGM（42 MB WAV，解碼後約兩倍記憶體） | 選到才解碼，同時最多保留播放中＋下一首；環境音 44 檔照舊預先解碼 |

模擬時間步長仍以 0.05 秒為上限，30 fps（33 ms）不會讓旅人、燈或出發計時變慢；跳幀時下一幀的 dt 會包含跳過的時間。前兩幀永遠會畫（編譯 shader、`reportReady`），所以在背景啟動的場景不會卡在載入。

## 檔案

- 新增 `src/renderer/src/framePacing.js`（＋`.d.ts`）：共用幀預算；`window.__focusQuestFramePace` 供 iframe 讀取。
- `src/main/index.ts`：主視窗 show/hide/minimize/restore/focus/blur → `window:frame-state`。`backgroundThrottling` 仍為 false（Focus 需持續推進），因此 Page Visibility API 看不到最小化，改由主程序通知。**任何 `FOCUSQUEST_QA*` 環境變數或 `FOCUSQUEST_FULL_FRAME_RATE` 存在時（未打包）不送狀態，維持全速**，避免影響隱藏視窗 QA 截圖。
- `src/preload/index.ts`、`src/shared/types.ts`（`onWindowFrameState?`）、`src/renderer/src/main.tsx`。
- 場景：`cloudRuins/cloudRuinsScene.js`、`mossStation/mossStationScene.js`、`reflectionLake/reflectionLakeScene.js`、`glassNursery/glassNurseryScene.js`。
- iframe：`lobby/CampfireStage.tsx`、`CollectionRoom.tsx` 以字串替換原型的 `function frame()`（原型 HTML 未改）。
- `src/main/database.ts`、`src/main/window-monitor.ts`。
- `glassNursery/nurseryAudio.ts`；`scripts/qa-nursery-audio.cjs` 的預期解碼數 48 → 44。
- 測試：新增 `tests/framePacing.test.ts`，`tests/collectionDocument.test.ts` 加一項斷言。

## 已執行的檢查

- `tsc --noEmit` 通過；`vitest run` 38 檔／211 測試通過；`electron-vite build` 通過。
- **未執行**：Windows 實機、開 App、量測 CPU/GPU/記憶體、打包（雲端 Linux 容器，無 Windows／顯示環境；依 2026-09-26 決定由 Codex 負責）。

## 請 Codex 驗證

1. Focus 中切到其他 App：場景仍流暢（~30 fps），旅人、燈、出發 8 秒與存檔結果不變。
2. 最小化／關到系統匣數分鐘再叫回：旅人位置與存檔進度一致；暫停中叫回時暫停色調正確。
3. 工作管理員比較 GPU／CPU：最小化與系統匣時 GPU 應接近 0。
4. 苗圃 BGM：第一次播放延遲約一次解碼時間；`qa-nursery-audio` 改為 44 檔。
5. 高更新率螢幕（120/144 Hz）上限 ~60 fps。

## 未決（需使用者決定，未實作）

- 「省電模式」設定（例如降低 devicePixelRatio 上限 2→1.5、關閉柔和陰影、前景也 30 fps）會改變畫質，需使用者同意才做。
- 大型 WAV（`glassNursery/audio` 75 MB、`reflectionLake/audio` 31 MB）改壓縮格式可大幅縮小安裝檔，但牽涉已驗收的混音，需試聽確認。
