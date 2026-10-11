# Focus Quest 0.6.5 驗證紀錄

日期：2026-09-26。Claude 負責前端設計與動畫；Codex 接手程式檢查、實機驗證與打包。

## 本輪整合

- 保留 Claude 的場景取樣模糊玻璃介面、暫停／繼續操作及沉浸模式。
- 暫停時凍結有效專注時間與全場景；後端保存手動暫停，不因重開或系統喚醒自動解除。
- 修正 `App.tsx` 的時間接線：恢復快照可能先於下一次每秒計時更新抵達。以當下時間計算，避免減去新結算的暫停時間後短暫倒退一秒，觸發場景重新定位。未重設 Claude 的視覺設計。
- 版本由 0.6.4 升為 0.6.5；輸出至獨立的 `release-v0.6.5` 目錄，保留舊版。

## 已通過

- `npm.cmd run build`：TypeScript、78 項測試、main/preload/renderer 建置通過。
- 真正的 Electron App，以隔離 QA 存檔操作暫停：相隔 12 秒的地圖區域像素完全相同；計時、燈數、特殊發現保持不變，即使牆鐘已超過下一燈點。
- 繼續後時間與世界恢復；快速重複暫停／繼續，監測畫面文字沒有時間倒退。
- 重新載入 renderer 與完整重開 Electron 程序，仍維持手動暫停及原本有效時間。
- 20 秒無輸入時沉浸模式淡出，滑鼠輸入恢復；1040×700 與 1366×768 視窗下檢查完整構圖與操作入口。
- 暫停中按結束，直接進入 Debrief，結算有效秒數與後端暫停時間一致。
- 用同一份正式場景程式在 Electron 中驗證兩個出口：在 1.7 秒時凍結，恢復接續演出，完成回呼各一次，重複暫停不再次觸發。維持原有 5 秒有效播放時間設定。
- 特殊發現暫停時排隊，恢復後啟動；演出中再暫停，場景時間與畫面保持不變，恢復可繼續。
- App 操作驗證未出現 renderer error。場景獨立驗證的松林出口截圖僅 1 個像素有 1/255 色階差，時鐘／演出狀態完全一致；其他凍結比較為零差異。

## 證據與範圍

- 可重跑腳本：`scripts/qa-pause-integration.cjs`、`scripts/qa-pause-scene.cjs`（使用 Electron 執行，前者要求明確指定隔離 QA 目錄）。
- 截圖與結構化結果：`previews/focus-pause-integration/`，包含 `pause-results.json`、`resume-results.json`、`scene-results.json`。
- Windows 睡眠與手動暫停重疊由後端自動測試覆蓋；沒有讓使用者電腦實際進入睡眠。
- 視覺驗證使用隔離存檔，不修改使用者的任務、探索與收藏資料。未改動特殊發現的每燈 5% 機率。

## 打包與啟動

- Windows x64 NSIS 安裝檔：`release-v0.6.5/Focus Quest Setup 0.6.5.exe`（145,022,797 bytes）。
- SHA-256：`3F3E813994C5736A53E9A69DA5508064B66B892DDBE294657DA9BA0ABADE84A7`。
- 打包內 `app.asar` 版本為 0.6.5，主程式檔案版本為 0.6.5.0；另以 Electron 載入出貨的 asar 和原生套件，確認能開啟 Focus 畫面，截圖為 `11-shipped-bundle.png`。
- 已只關閉 `release-v6/win-unpacked/Focus Quest.exe` 的舊版程序，再啟動 `release-v0.6.5/win-unpacked/Focus Quest.exe`；確認新版主視窗標題為 Focus Quest，程序正常回應。沒有執行安裝精靈覆蓋既有安裝。
