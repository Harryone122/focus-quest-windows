# Focus Quest 0.6.22 — 旅途聲音與共用專注設定

安裝包：`release-v0.6.22/Focus Quest Setup 0.6.22.exe`（Windows x64，NSIS）。保留既有大廳、收藏室及兩張可玩地圖。

## 本次內容

- 苔痕驛站：緩慢風勢、草葉、溪流／遠瀑、下雨、屋簷滴水及淡背景長音；雨聲依保存的天氣 seed 與有效專注時鐘變化。聲音程序於本機生成，不需要網路。
- 雲上遺庭：同期協調加入風、草葉、瀑布底音、鳥鳴與淡背景音；鳥鳴配合日夜漸變。自然鳥鳴素材隨包附上，出處見 `src/renderer/src/cloudRuins/audio/CREDITS.md`。
- 所有 Focus 右上角齒輪可開啟共用玻璃設定，場景模糊但仍計時；支援關閉、Esc、點外側與鍵盤焦點循環。沒有每張圖專屬靜音按鈕。
- 設定可分別調整環境／背景音，預設 35%／12%。全部靜音保留原音量；設定即時套用且隨 SQLite／備份 v13 保存。v1–12 匯入補上預設值。
- 暫停、系統暫停、回顧、離開地圖停止聲音；最小化持續播放。跨圖清理舊音訊，避免重複疊加。不影響獎勵、事件、五盞燈或計時。

## 驗證

- TypeScript、26 個測試檔／162 項測試及正式建置通過。
- Moss 的實際 12 秒 PCM 晴／雨樣本沒有無效值或削波，peak 約 0.060／0.093；AudioContext 的暫停、恢復、零音量、背景播放與釋放檢查通過。
- Cloud 的鳥鳴實際解碼／播放與輸出波形、暫停時鐘凍結、背景播放、靜音、零音量、恢復與釋放檢查通過；最大 peak 約 0.126。
- 正式 App 與已打包 ASAR 的兩圖整合 QA 均通過：音量預設、共用齒輪／玻璃設定、開面板持續計時、全域靜音、暫停／恢復、最小化、雨天一致、回顧停止，以及 Moss → Cloud 舊音訊關閉；renderer errors 為空。
- 包內右上齒輪實測寬 54px／高 48px，完整設定與雨天畫面已查看。測試使用獨立 profile；優先副螢幕，本次只偵測到主螢幕，因此使用主螢幕。
- 使用者新版已安裝，ASAR 與已驗證包完全一致，SHA-256：`99B7D0C7CA7011E6748A64DA7B188D30FD7DA8326E34F945EFD94439D3EB31E2`。
- 更新前完整 SQLite 備份：`C:/Users/User/AppData/Roaming/focus-quest-windows/backup-before-0.6.22-2026-10-02-080541511Z/focusquest.db`，完整性 `ok`，32 次專注／42 個節點／18 項任務，無進行中的專注。
- 已啟動本機新版本；唯讀更新前後逐筆比對 session／node／task／run 全部保留，仍為 32 次專注／42 個節點／18 項任務。

報告與聲音樣本：`previews/moss-audio-qa/`、`previews/cloud-audio-qa/`。正式畫面與雙圖報告：`previews/moss-audio-integration-qa/`、`previews/moss-audio-integration-qa-shipped/`。使用者進度比對：`previews/release-v0.6.22-qa/`。
