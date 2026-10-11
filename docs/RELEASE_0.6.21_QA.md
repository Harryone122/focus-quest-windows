# Focus Quest 0.6.21 — 已交付設計漏接修正

安裝包：`release-v0.6.21/Focus Quest Setup 0.6.21.exe`（Windows x64，NSIS）。

## 包含內容

- 保留已整合的大廳、收藏室、雲上遺庭、苔痕驛站。
- 雲上故事按探索存檔：首次很快結束仍給大樹線索、繼續不補播；物品事件每探索可重現，永久線索僅一份；風哨及橋頭段保存完成紀錄。
- 後端提供故事排程、同探索固定雲鯨種子、環境事件冷卻保存；八個舊事件改純環境演出。
- 紙船、箱匣、石祠世界記憶還原，石祠回報去重、最多 15 顆。
- 收藏室讀正式存檔的線索 ID／文字／未知地名遮蔽，取得相應核心後顯示對照；補 Cloud 物品事件大廳發現卡與已读紀錄。
- 備份格式 v12；支援舊備份匯入與短開場紀錄遷移，保存釘選與探索進度。

第三張地圖、未来 07／08 取得條件、幼苗帶走與真結局未完設計不在此次開放範圍。詳見 `HANDOFF_AUDIT_2026-10-02.md`。

## 驗證

- TypeScript、24 個測試檔／158 項測試、正式主程式／前端建置通過。
- 正式 App 與封裝後 ASAR 的收藏室整合 QA 都通過：六個新舊線索顯示、羅盤對照、單釘／全釘保存、預載場景重用、營火借火至地圖到達；無 renderer errors。
- Cloud 場景 QA 通過世界物件還原、重複 snapshot 冪等、石頭上限、暫停、故事部分完成恢復與環境歷史恢復。
- 測試使用獨立臨時 profile。視窗優先使用副螢幕；本次 Windows 只列出主螢幕 DISPLAY1，故使用主螢幕。
- 已安裝 ASAR 與已驗證包一致，SHA-256：`AC0CA4034CD60573C7C67DAB984A86A55BF72A5C4362E618BC3CBB1CB1DEEBC9`。
- 更新前使用者 SQLite 備份：`C:/Users/User/AppData/Roaming/focus-quest-windows/backup-before-0.6.21-2026-10-02-024623074Z/focusquest.db`，完整性 `ok`。
- 更新前保存 32 次專注、42 個探索節點、18 項任務，沒有正在執行的專注。更新後啟動新版本並作唯讀比對；逐筆保留既有 session／node／task／run 紀錄。

報告與截圖：`previews/handoff-integration-qa/`、`previews/handoff-integration-qa-shipped/`、`previews/cloud-world-memory-qa/`、`previews/release-v0.6.21-qa/`。
