# 0.6.6 森林後端驗收

日期：2026-09-26。需求：依新規則保存信物與核心取得結果、大樹痕跡世界記憶、正式核心欄位，驗證後打包。

## 結果

- `npm.cmd run build` 通過：TypeScript、79 項測試與 main/preload/renderer 建置。
- SQLite 測試：同燈獨立雙獎勵、5% 邊界與 miss 不重抽、partial 續玩、第五次保底、提前取得取消保底、核心永久唯一、超時不重複计次、舊核心遷移、備份與世界記憶冪等保存。
- 真正 Electron App 與獨立測試存檔：後端 ticker 保存信物與核心，既有 IPC 傳遞結果。暫停後兩張地圖區域截圖像素完全一致；比對排除頁首既有 UI 呼吸提示。
- 大樹一次性演出实际結束後，由前端 callback 經 preload/IPC 寫入 `tree_traces_seen`。重新載入後記憶與核心仍在，截圖確認普通休息狀態。
- 結束專注後不再發放第二套通關遺物，選路回到大廳；正式核心狀態同時傳入大廳場景。
- 讀取出貨 `app.asar` 的版本與 main 雜湊，與驗證過的建置一致。以 Electron 載入出貨 asar／原生 SQLite 與獨立測試存檔，專注場景、核心及世界記憶正常，未出現 renderer error。

## 證據

- 腳本：`scripts/qa-forest-backend.cjs`、`scripts/qa-forest-shipped.cjs`。
- `previews/forest-0.6.6-qa/report.json`、`shipped-report.json` 與 01–08 截圖。
- 測試資料使用新建 temp 目錄；沒有使用玩家正式存檔進行改時間、保底與獎勵測試。

## 出貨與啟動

- 安裝檔：`release-v0.6.6/Focus Quest Setup 0.6.6.exe`，142,222,982 bytes。
- SHA-256：`41D16A68616067E5A406031B96558A7219628A359550C8E10C56E2493A8EF4C2`。
- 已關閉路徑指向 `release-v0.6.5/win-unpacked/Focus Quest.exe` 的舊版程序，備份 SQLite 本體與存在的 WAL/SHM，然後啟動 `release-v0.6.6/win-unpacked/Focus Quest.exe`。
- 正式存檔備份：`C:/Users/User/AppData/Roaming/focus-quest-windows/backup-before-0.6.6-20260926-205234/`。
- 新版主程序 PID 53964，視窗標題 Focus Quest、Responding=True，執行路徑確認為 0.6.6。沒有執行安裝精靈覆蓋原有安裝。

## 範圍限制

此輪未把整體路線與旅程改成 §46／§47。既有路線仍可能為 25／50／90 分鐘；新版森林 10 分鐘一燈與保底測試使用 50 分鐘路線。完整後端交接與舊資料處理見 `FOREST_BACKEND_0.6.6_HANDOFF.md`。
