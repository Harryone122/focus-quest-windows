# Focus Quest 0.6.7 後端規則測試版

日期：2026-09-26。使用者後續要求「先給我測試版」，本次先打包現有規則，不等待新大廳交付。

## 內容與限制

- 包含日期＋順序清單、昨日未完成保留、每日例行實例、跨日旅程續玩、partial 換路鎖定及各層出口映射。完整契約見 `LOBBY_RULES_BACKEND_HANDOFF.md`。
- 保留已認可的第一張地圖與現有 UI；未製作／重設前端美感或動畫。
- Claude 的 `LOBBY_A_HANDOFF.md`／`lobbyTypes.ts` 尚未出現在本機；Today 仍為舊大廳，仍有舊主線／支線文字。新的清單排序、昨天分頁與例行設定介面尚未接上，只有後端 API 已完成。
- 可先測既有出發、專注、暫停／繼續、結束與部分探索續玩；不是完整新大廳驗收。全 50 分鐘路線、五段終點、十張地圖及新事件流程未隨本版完成。

## 驗證

- `npm.cmd run build` 通過 TypeScript、9 個測試檔共 92 項測試，以及 main/preload/renderer 建置。
- `electron-builder --win nsis --x64 --config.directories.output=release-v0.6.7` 成功。
- `scripts/qa-task-list.cjs` 支援 `FOCUSQUEST_QA_BUNDLE`，以開發用 Electron 載入本次出貨的 asar，而非重新載入來源 out。確認版本及 main/preload 雜湊與本次建置一致，SQLite 使用包內原生依賴。
- 隔離 temp 存檔透過真實 preload/IPC 驗證標題新增、排序、改名、例行、快照推送、預設事項開始 Focus、一次回顧、partial 換路拒絕、移到今天、文字確認批次刪除及 reload 保存。兩次預期拒絕的主程序錯誤輸出屬測試断言；renderer error 為零。
- Focus 畫面出現真正 canvas，沒有場景 fallback；已目視 `previews/task-list-shipped-qa/focus.png`，第一張浮島地圖與專注 UI 正常。reload 後也確認 `.app-shell` 恢復；隱藏視窗的 lobby 截圖保留載入幀，不作為大廳視覺驗收證據。
- 結果：`previews/task-list-shipped-qa/report.json`。本輪不是完整視覺／長時間回歸驗收，沒有實際等待跨午夜或 50 分鐘。

## 出貨及正式存檔

- 安裝檔：`release-v0.6.7/Focus Quest Setup 0.6.7.exe`，142,225,097 bytes。
- SHA-256：`F71864148C3CED144BC4D8D7DDC0882456F456496783CD4A03FFCB7D9ADB861D`。
- 解包主程式：`release-v0.6.7/win-unpacked/Focus Quest.exe`，版本 0.6.7.0。
- 已啟動此路徑的新版，並透過既有 single-instance 喚出視窗；確認主視窗標題 `Focus Quest`、程序正常回應。
- 未覆寫 0.6.6 安裝檔，未執行安裝精靈。只關閉完整路徑屬於 `release-v0.6.6/win-unpacked/Focus Quest.exe` 的程序。
- 停止舊程序後，將正式 `focusquest.db` 及存在的 WAL/SHM 複製至 `C:\Users\User\AppData\Roaming\focus-quest-windows\backup-before-0.6.7-20260926-213201`，逐檔比對 SHA-256 通過，再啟動 0.6.7。QA 未往正式存檔注入測試資料。
- 新版使用原正式資料路徑，正常啟動時執行相容 migration；這不是隔離的新玩家存檔。備份應保留，若需退版，須先停止 App 再還原一致的資料檔案，而非直接用舊版匯入 v7 備份。
