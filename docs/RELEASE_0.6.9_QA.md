# 0.6.9 點燈同步與背景播放驗收

2026-09-27。沿用現有 0.6.9 工作目錄，這輪改動只涉及森林點燈計算、旅人時間預算與背景更新；保留其他任務已整合的大廳內容。

- `npm.cmd run build`：型別、101 項測試、production main/preload/renderer 建置通過。
- 正式場景程式的三種 seed 完整 50 分鐘模擬，涵蓋 1 fps 與特殊發現。每秒檢查燈亮度與 HUD 到期公式一致；第 40 分鐘第四盞亮、旅人已在 c_lamp。暫停及長時間缺幀恢復也通過。
- 真正 Electron App 與獨立 QA 存檔：以其他視窗遮住、最小化、隱藏到系統列再恢復，直接檢查場景 WebGL 繪製及截圖。確認背景仍在更新、恢復沒有積壓動畫快轉；手動暫停後在背景，計時與地圖區域像素皆不變。
- 打包後再次載入出貨 `app.asar`、原生 SQLite 與新的隔離存檔，重跑以上背景測試。出貨 main、preload、renderer 所有 assets 雜湊與已驗證建置一致；renderer errors 為空。出貨測試各情境繪製最大間隔約 29–60 ms。
- 實作說明：`FOREST_LAMP_BACKGROUND_FIX.md`。
- 可重跑：`scripts/qa-lamp-sync.cjs`、`scripts/qa-focus-background.cjs`。出貨測試設定 `FOCUSQUEST_QA_BUNDLE` 為 asar 絕對路徑。
- 證據：`previews/lamp-sync-qa/report.json`、`background-report.json`、`shipped-background-report.json`、`background-04-restored-four-lamps.png`。

## 交付

- 安裝檔：`release-v0.6.9/Focus Quest Setup 0.6.9.exe`，142,236,688 bytes。
- SHA-256：`51DC3A2947300BDB8C881B1CAFF5FE9A0982A7B3D5BC9913D3B5F9ED990AF9FF`。
- 已只關閉 `release-v0.6.8/win-unpacked/Focus Quest.exe` 的舊版程序，啟動 `release-v0.6.9/win-unpacked/Focus Quest.exe`，主程序 PID 41820。
- 更新前存檔備份：`C:/Users/User/AppData/Roaming/focus-quest-windows/backup-before-0.6.9-20260927-143537/`。
- 本輪沒有修改玩家探索時間、獎勵機率或正式存檔內容；測試用的時間調整限隔離 QA 存檔。
