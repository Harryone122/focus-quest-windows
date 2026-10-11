# 0.6.12 關閉視窗通知移除

2026-09-27。依使用者要求，移除關閉主視窗時的「Focus Quest 仍在守望」通知及 main 中未再使用的 Notification import。關閉仍隱藏至系統列，保留背景計時與 ReminderScheduler 任務提醒。

- 修改：`src/main/index.ts`；`package.json` 與 `package-lock.json` 更新版本為 0.6.12。
- `npm.cmd run dist -- --config.directories.output=release-v0.6.12` 通過：型別檢查、12 個測試檔／106 項測試、production build、Windows NSIS。
- 以隔離存檔載入出貨 ASAR，連續三次 close/show 均成功隱藏、重開；攔截 Notification.show 的呼叫數為零。專注 session ID 與開始時間保持相同，renderer errors 為空。
- 出貨 main 與建置 main SHA-256 相同；已檢視重開後畫面。證據：`previews/close-notification-qa/report.json`、`reopened.png`，重現腳本 `check.cjs`。
- 只停止 0.6.11 的 Focus Quest 程序，將 DB／WAL／SHM 備份至使用者資料目錄的 `backup-before-0.6.12-20260927-151259`，逐檔比對雜湊後啟動 0.6.12。切換前後專注紀錄比對位於 `previews/close-notification-qa/progress-before.json` 與 `progress-after.json`。
- 安裝檔：`release-v0.6.12/Focus Quest Setup 0.6.12.exe`。

保留工作目錄原有未提交修改；未修改前端視覺或遊戲規則。
