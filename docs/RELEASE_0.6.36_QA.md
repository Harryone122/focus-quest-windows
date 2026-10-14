# 0.6.36 旅人正常速度與低幀率播放修正（2026-10-14）

使用者回報藏聲秋谷旅人像慢動作，要求恢復正常並檢查其他地圖。本輪僅修正動畫播放與時間推進，保留既有動作、路線、音效及後端有效專注時間。

## 原因與修改

- Area 05 原型 `speed / 6` 把 6 倍探索當成正常動作速度；試玩預設切為 1 倍後，戶外行走及洞內路線／時間軸降至六分之一。現在正常與 6 倍探索均使用原型正常動作速度，20／60 倍仍保留快速試看；探索時鐘仍各自為 1／6／20／60 倍。往洞口／下一燈的有效時間估算同步採用實際動作倍率。
- 五張場景都有每幀 0.05 秒上限，低於 20 fps 時會丟失動畫時間。共用 `animationSteps` 將實際經過時間拆為不超過 0.05 秒的小步，每幀最多推進 1 秒，以限制長時間卡住後的補算。雲上遺庭、苔痕驛站、倒影湖畔、玻璃苗圃與藏聲秋谷皆已接入。苗圃保存行動原有權威時間回放保留，只修正動畫時鐘與其他演出分支。
- Area 05 可重跑移植脚本同步更新。原工作目錄已有多項音效、地形與互動修正，均保留；地形回饋由另一個聊天繼續處理，本文件僅報告速度驗證。

## 驗證

- 型別檢查通過；40 檔、226 項測試通過，新增 5／10／15／20／30／60 fps 時間守恆、暫停及長停頓限制。
- `qa-map-animation-clocks.cjs` 使用正式四圖的 frame/draw 入口，僅跳過 GPU 畫圖。在 5 fps 下各推進 10 秒，動畫時鐘皆為 10 秒；暫停推進 0。證據：`previews/map-animation-clocks-qa/report.json`。
- 四圖 50 分鐘保存排程、低幀率路線與互動銜接回歸沒有異常位移；貨車三種坐姿、苗圃連續休息與暫停專項通過。證據：`previews/interaction-continuity-qa/report.json`、`fixtures.json`。
- Area 05 真 Electron 試玩：1／6 倍各行走 2 秒，路程皆為 1.9；正常探索分別推進 2／12 秒。在實際 10 fps 下，4.067 秒牆鐘推進 4.007 秒；暫停位置／時鐘凍結；正常倍率洞內核心演出在 9 秒取得藏聲石。43 音檔解碼，戶外／洞內截圖已檢視。證據：`previews/area05-motion-qa/report.json`、`normal-walking.png`、`normal-core.png`。
- Area 05 原場景路線、核心／岩壁／風哨及暫停回歸通過：`previews/area05-trial/qa/report.json`。
- 正式包 152 檔與此次建置輸出一致，包內苗圃 G2↔CT 實際保存行走通過，無 renderer error。證據：`previews/release-v0.6.36-qa/package-files.json`、`previews/stair-fix-qa/shipped/report.json`。
- 獨立 Area 05 包逐檔比對當時的試玩輸出並啟動實際包：正常走路 2 秒距離 1.9、43 音檔解碼。證據：`previews/area05-motion-qa/packaged-report.json`。後續地形修正仍以另一聊天的最新試玩建置為準。

Windows 測試包位於 `release-v0.6.36/`；藏聲秋谷獨立試玩包位於 `release-area05-v0.6.36/`。Area 05 的正式候選／獎勵／線索／恢復仍待後續整合。

發布確認：兩份 Windows portable 均已完成（正式約 230 MB，Area 05 約 163 MB）；停止舊正式 App 後已開啟 `release-v0.6.36/win-unpacked/Focus Quest.exe`。桌面「Focus Quest」捷徑已指向新版本，原捷徑備份於 `previews/release-v0.6.36-qa/previous-shortcut.lnk`。玩家資料仍在原 `%APPDATA%/focus-quest-windows/`，未複製、匯入或重設存檔；Area 05 桌面入口使用最新共用試玩頁，另有其他聊天持續處理地形回饋。
啟動實機確認：PID 3320，執行路徑為本輪 win-unpacked，視窗標題 Focus Quest、Responding=True；有第二螢幕時已將此驗證視窗移到第二螢幕。

## 音效與最後瀑布修正共同封裝

使用者要求等兩個修正對話完成再打包，並授權推送。2026-10-14 最終 Area 05 portable 已重新固定最新試玩輸出，包含最後的瀑布底層／水紋修正與正常動作。50 份包內快照檔與已完成輸出一致，真 AudioContext 的配樂、暫停、靜音、核心时序及正式營火／收藏室音訊驗證通過。正式 NSIS 安裝包也已交付，已安裝 app.asar SHA256 與本次驗證包一致，原存檔完整保留。完整素材、包雜湊與驗證摘要見 `area05/audio-reports/release-0.6.36.json`。
