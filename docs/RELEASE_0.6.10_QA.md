# 0.6.10 入口出生點修正

2026-09-27。只調整森林旅人的起點與相關入口錨點，沿用已整合的場景與遊戲規則。

## 修正

- 舊 `entry0` 是踏石曲線端點，踏石生成從內側第一個採樣點才開始，導致旅人在路線外側懸空等待。
- `SPAWN_NODE` 改用入口島現有的 `a_gate` 石板。首次進入、未點燈時重開、大廳等待統一使用它，朝向 `a_mid`；入口提示錨點及等待文字同步調整。
- 原入口踏石與圖層不改；已點燈時仍在對應路燈旁恢復。

## 驗收

- `npm.cmd run build`：型別檢查、101 項測試、production build 通過。
- `scripts/qa-entry-spawn.cjs`：首次畫面、15 秒重開、21 秒重開、大廳等待，旅人 X/Z 與實際生成石板中心相同；腳底高度與石板一致。30 秒後已沿石徑走上橋。已檢視截图。
- `scripts/qa-lamp-sync.cjs`：三個 seed 的 50 分鐘路線模擬、特殊發現時間預算、暫停及長時間缺幀恢復通過；每秒地圖燈數符合進度，第四盞 40 分鐘到位。
- `scripts/qa-entry-app.cjs`：從出貨 app.asar 載入 App，以隔離存檔驗證；出貨 main/preload/renderer 雜湊與驗證建置一致，無 renderer error。已檢視完整 App 截圖 `previews/entry-spawn-qa/app-entry.png`。
- 出生點資料與截图：`previews/entry-spawn-qa/report.json`、`first-frame.png`、`after-30s.png`。前一版背景更新修正保留，本輪未重跑完整背景視窗切換測試。

## 交付

- 安裝檔：`release-v0.6.10/Focus Quest Setup 0.6.10.exe`。
- SHA-256：`1540C4257A5A259BE0FF426C2A8C5C3F9ABE7C46636CDC6810B0BE0C18465AFB`。
- 已關閉 0.6.9 的 Focus Quest 程序並啟動 0.6.10 的 win-unpacked 版本。
- 存檔備份：`C:/Users/User/AppData/Roaming/focus-quest-windows/backup-before-0.6.10-20260927-144442/`。
