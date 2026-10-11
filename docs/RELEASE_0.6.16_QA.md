# Focus Quest 0.6.16 — 今日清單排序動畫

- 範圍：大廳「調整順序」的上下移動。維持後端排序與存檔方式；收到新快照後，兩列以 280 ms 位移到新位置。儲存中暫停排序按鈕，系統偏好減少動態效果時不播放。
- `npm run dist -- --config.directories.output=release-v0.6.16`：型別檢查、136 項測試、Electron/Vite 建置、Windows NSIS 打包均通過。
- `scripts/qa-lobby-reorder-animation.cjs`：在獨立資料目錄以正式 renderer/preload/SQLite 與已打包 `app.asar` 驗證。兩列分別位移 +36 / -36 px、動畫結束後順序正確、減少動態效果下直接切換，沒有錯誤提示。
- 畫面截圖：`previews/lobby-reorder-animation/mid-motion.png`、`after-motion.png`。
- 已檢查使用者存檔沒有進行中的專注，切換前的 SQLite 快照在 `previews/release-v0.6.16-save-backup/focusquest.db`；啟動 0.6.16 後，31 筆專注、18 筆事項、6 趟旅程筆數與備份一致。
- 安裝檔：`release-v0.6.16/Focus Quest Setup 0.6.16.exe`。SHA-256：`D3BCFABF6A48EB02FA04C1F71AB9527D9E4F3390C3A9625DC7D5C17C26F90795`。
