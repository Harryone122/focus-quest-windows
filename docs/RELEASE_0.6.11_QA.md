# 0.6.11 結束專注場景銜接

2026-09-27。修正使用者錄影中的 Focus → 回顧 → 大廳重建卡頓。保留 0.6.10 的入口石板出生點修正；本輪不修改出生座標、路線、進度或獎勵規則。

## 驗證

- `npm.cmd run dist -- --config.directories.output=release-v0.6.11` 成功：型別檢查、12 個測試檔／106 項測試、production build、Windows NSIS。
- `scripts/qa-lobby-integration.cjs` 六組真實 IPC／SQLite 整合檢查通過：任務、順序、例行事項、昨日清單、部分續玩、完整結束／選出口、小視窗及非大廳導航。測試資料隔離，renderer errors 為空。
- `scripts/qa-lamp-sync.cjs` 三組 seed 的完整時間模擬、低幀率特殊事件、暫停與長缺幀回復通過；`scripts/qa-entry-spawn.cjs` 通過，另一對話的石板位置修正保留。
- 從出貨 ASAR 啟動真實 App 主程式／preload／renderer，測五種情境：106 秒結束、暫停後結束（20 分鐘）、完整探索、減少動態效果＋回顧重載、刻意讓 view-transition API 拋錯。五種皆通過。
- 五種出貨測試的兩次切換均為 **零新增 WebGL context**，返回大廳後是同一個 canvas；計時於回顧停止、資料庫沒有 activeSession，返回後 pendingDebrief 已解除。重載時依已存進度建立一次背景，再交給大廳，不另外重建。
- 出貨 main、preload、renderer index 與全部 renderer assets 的 SHA-256 和最後建置逐一相符；所有出貨情境 renderer errors 為空。
- 已檢視回顧與大廳實機截圖。原版短時間結束的單次樣本約 950ms RAF 空檔；修正版／出貨同情境樣本約 150–233ms／200ms。這是該機測試觀察，不宣稱完全無掉幀；回大廳的 RAF 指標也包含 Chromium view transition 的繪製抑制，不能直接當成可見停頓長度。

## 證據與交接

- `docs/FOCUS_EXIT_TRANSITION_FIX.md`：生命週期、錯誤降級與 Claude 接合注意事項。
- `previews/exit-transition-qa/shipped-106/report.json`
- `previews/exit-transition-qa/shipped-paused-1200/report.json`
- `previews/exit-transition-qa/shipped-full-3010/report.json`
- `previews/exit-transition-qa/shipped-reduced-reload-600/report.json`
- `previews/exit-transition-qa/shipped-transition-failure-106/report.json`
- 各資料夾有 Focus／問題／回顧／大廳截圖。

## 交付與正式進度保留

- 安裝檔：`release-v0.6.11/Focus Quest Setup 0.6.11.exe`，142,239,292 bytes。
- SHA-256：`713A80E49837C57CB393106E7E116EF371C6BB8677A2582BB9E9328EE1392309`。
- 使用者明確選擇「直接切換新版，保留目前專注進度」後，只停止 `release-v0.6.10/win-unpacked/Focus Quest.exe` 的程序。
- 關閉舊版後複製 DB／WAL／SHM，逐檔比對雜湊：`C:/Users/User/AppData/Roaming/focus-quest-windows/backup-before-0.6.11-20260927-150138/`。
- 已啟動 `release-v0.6.11/win-unpacked/Focus Quest.exe`，PID 23196；視窗標題 Focus Quest，檔案產品版本 0.6.11.0。
- 切換前、停止後與新版開啟後，正在進行的 session ID、task ID、node ID、started_at、ended_at、paused_seconds、suspended_at、manual_paused、system_paused 完全相同；14:45:52 開始的同一筆專注仍在進行，未重設或結算。
- 本輪沒有刪除舊安裝檔／舊版本。所有人工時間調整僅限 QA 隔離存檔。
