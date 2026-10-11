# Focus Quest 0.6.23 驗證與交付

日期：2026-10-03。使用者批准 `previews/lobby-audio-qa/batch-2/review-front-overlap/` 並要求接進遊戲、延長演出動畫。

## 交付行為

- 第一批 5 個環境錄音與第二批／2b 的 27 個動作錄音正式整合；原始素材不變、副本雜湊相符，沒有新增合成音效。
- 營火出發由 5 秒延長至 8 秒；主要拉長闔書、起身、走向營火及點燈。點燃 5.05 秒、約 5.4 秒完成，出口腳步仍每 0.38 秒，動作尾音自然交疊。回營火維持 4 秒。
- 暫停／恢復同步音畫，恢復不補播過期的準備聲。其他地圖轉場、專注計時及獎勵規則維持既有行為。

## 驗證

- `npm run build`：型別檢查、29 個測試檔／170 項測試、正式建置通過。
- 正式音場吊橋／浮石／回營火輸出與驗收 WAV 的最大差異為 1 個 16-bit 量化單位；無無效樣本或輸出削波，靜音輸出為零。
- Source 與包內 production bundle 皆使用真 Electron 驗證。包內兩條出發路線可解碼全部 32 個錄音；完整觀察到 8 秒動畫，點燃至目的地交接量測最長靜音 0 ms，轉場後只剩目的地音場。
- 實測準備階段暫停時動畫凍結、AudioContext 暫停，恢復同步接續；聲音裝置恢復在 500 ms 檢查界限內。音量零／靜音、設定頁、收藏室、最小化、取消排程及舊音場關閉均通過，renderer errors 為空。
- 證據：`previews/lobby-audio-qa/batch-2/accepted/report-bridge.json`、`report-steps.json`；包內結果及截圖在同路徑 `shipped/`。一次 source QA 啟動等待超時，重試通過；最終包內兩路線均首次通過，未將不明原因記為已修復。

## 安裝與進度

NSIS：`release-v0.6.23/Focus Quest Setup 0.6.23.exe`。安裝已完成（exit 0）；已安裝 exe 版本為 0.6.23，installed `app.asar` 與驗證過的 bundle SHA256 相同：`C1BFC733F9CA3BA45520A6A0564DFCB62520CC67BBA1B8C950D38A3BC9DD7CE8`。新版已啟動。

安裝前確認無進行中的專注並備份至 `C:/Users/User/AppData/Roaming/focus-quest-windows/backup-before-0.6.23-2026-10-02-214406167Z`；SQLite integrity 為 ok。安裝前後逐列比對 sessions／nodes／tasks／runs，既有 32 次 session、42 個 node、18 個 task 保留。證據在 `previews/release-v0.6.23-qa/` 的備份、前後快照及 `installation.json`。

下一個負責人：使用者在遊戲驗收節奏。後續新批次仍先試聽確認再整合；未擴充收藏室、和弦墊、旋律草案或未交付的 Area 03。
