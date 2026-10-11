# 0.6.13 苔痕驛站正式接合與 Windows 驗收

2026-09-27。Codex 套用 `docs/handoff/area02-frontend-port/area02-frontend-port.patch`，接上正式路線並完成 Windows 出貨驗收。Claude 的原始交付、原型與交接內容保留。

## 本版行為

- 新產生的兩條候選路線分別提供雲上遺庭與苔痕驛站，兩者均可再次造訪。使用地圖自己的標題、描述、收藏及造訪次數；後續岔路以固定種子決定地圖與出口的對應。
- 新節點固定 50 分鐘。既有節點、已選路線及 25／90 分鐘存檔不重寫；舊旅程要等下一次產生路線才會出現新的候選池。未製作其餘八張圖或新增五段結局。
- Focus、大廳與結束回顧依保存的地圖身分選擇場景；苔痕播放後端保存的完整路線、天氣、事件、道具演出與世界記憶。
- 雲上高台／松林、苔痕小舟／隧道均接上跨圖離開。跨圖先播放來源地圖，完成後霧幕帶入目的地；過期離場提示、重新開啟、慢速 IPC 或場景建立失敗不會卡住下一張圖。
- 離場時鐘從首次繪製後起算。苔痕旅人／船隻的燈光改掛在場景中並同步世界座標，保持光源數量穩定，避免淡出時重新編譯整張圖的材質。跨圖離場完成後停止來源場景多餘的繪製。
- 動畫不是專注時間、進度或獎勵的判定來源。

## 驗證

- `npm.cmd run build` 通過：型別檢查、17 個測試檔／131 項測試、production build。
- 新增 `tests/mapRoutes.test.ts`：60 個種子的候選地圖／出口對應、兩張圖往返與重訪、正確大廳資料、備份回讀。既有 25 分鐘測試改用明確舊存檔 fixture。
- 修正世界記憶測試原本隨 UUID 天氣偶發失敗的 fixture：乾天限定疊石事件需先確保測試當下沒有下雨。
- `npx.cmd electron-builder --win nsis --x64 --config.directories.output=release-v0.6.13` 成功。
- 以 `scripts/qa-area02-port.cjs` 載入出貨 ASAR 的 main／preload／renderer，使用隔離 SQLite 存檔及真實 UI 操作；四個出口全部通過。出貨 main、preload、HTML、每一個 renderer asset 與本機測試建置逐檔 SHA-256 相同。
- 各案例皆確認：正式候選包含兩張圖、名稱與時長正確、來源大廳、來源離場、目的地抵達、暫停、重開後直接顯示正確目的地、同一 session、苔痕天氣與排程保存。四份報告的 renderer errors 均為空。

| 跨圖出口 | 可見離場量測 |
| --- | ---: |
| 苔痕小舟 → 雲上 | 4.935 秒 |
| 苔痕隧道 → 雲上 | 4.951 秒 |
| 雲上高台 → 苔痕 | 5.449 秒 |
| 雲上松林 → 苔痕 | 5.469 秒 |

動畫排程為 5 秒；上表使用場景時鐘取樣及來源 DOM 移除時間量測，含繪製／提交延遲。目的地首次建立與 shader 編譯另需時間，並非整個畫面切換都能在 5 秒內完成；本機四案例從來源畫布出現到目的地畫布出現約 5.1–11.1 秒。後端時間持續運作，不依這段視覺等待結算。

證據位於 `previews/area02-port-qa/app.asar-exit_{boat,tunnel,high,pines}/report.json` 及各資料夾的六張截圖。已檢視苔痕全景、雨景、小舟瀑布離場、大廳雙路線、抵達與暫停畫面。

另記錄一項視覺問題：雲上遺庭在「已暫停後重新載入」的截圖中，HUD 玻璃底色偏淡、構圖較放大；一般抵達畫面正常，暫停時間與恢復資料檢查通過。本版未修正這項雲上畫面問題，不能把功能通過視為所有視覺狀態均無瑕疵。

## 切換與存檔

- 只關閉執行中的已安裝 0.6.12 Focus Quest，啟動 `release-v0.6.13/win-unpacked/Focus Quest.exe`；沒有更動其他應用程式。
- DB／WAL／SHM 已備份至 `C:\Users\User\AppData\Roaming\focus-quest-windows\backup-before-0.6.13-20260927-205735`，每個檔案雜湊相同。
- `scripts/qa-release-save.cjs` 核對 27 筆專注、36 個路線節點、15 件事項及旅程狀態均保留。目前 active session ID、開始時間與綁定路線相同。
- 舊版存檔有一段尚未結算的系統暫停。啟動按既有恢復規則把這段時間加到 paused_seconds，再恢復專注；驗證了恢復時間位於本次切換期間，沒有把暫停時間當成專注時間。明細在 `user-save-resumption.json`，不是刪除或重設專注紀錄。
- 切換、備份及前後比對證據在 `previews/area02-port-qa/user-save-*.json`。

## 交付

- 安裝檔：`release-v0.6.13/Focus Quest Setup 0.6.13.exe`（142,288,600 bytes）。
- SHA-256：`E2B6E29B3751FCF250809A56DA1FE78BAEBE8F81175364A4794885906E1E2EBF`。
- 保留 repo 原有未提交工作。`previews/area02-patch-plan.py` 已不存在。
- 使用者授權的 `_claude_scratch` 清理由自動核准審查以「政策阻擋」拒絕，資料夾仍保留；不影響出貨內容。
