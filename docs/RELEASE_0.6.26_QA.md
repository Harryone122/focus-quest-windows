# Focus Quest 0.6.26 — 開始卡頓、收藏室與音量滑桿修正

日期：2026-10-03。使用者要求修正開始卡頓／收藏館無法进入、继续 debug、避免錯場景音效；後續說明地圖畫面是演出，運鏡已另行調整。本次沿用目前的苔痕運鏡，不另改已驗收鏡位。

## 修正

- 收藏室 raw HTML 先統一 CRLF／LF，再接入本機 Three 模組、保存狀態與 ready 通知。原本 Windows 換行令多行替換失敗，外層永遠等不到 ready，且可能仍使用外部 CDN。兩種換行的回歸測試皆通過。
- 預載收藏室保持 `__hold`，不在背景把核心標為已展示或播放十核心聯動；進入後才依存檔展示。核對 iframe 訊息來源，離開時停止後續展示項目。
- 目的地音場等實際顯示才開始；營火出發期間保持目的地靜音。湖畔回顧也會停止音場，場景建立失敗會釋放等待。沒有加入新音效、新合成或借用其他地圖的錄音。
- 同一個 renderer 內重用營火已校準 AudioBuffer 與動作解碼，不在出發／返回時重跑錄音處理；首次每檔處理前讓出一次畫面更新。
- r128 Three 新增局部 `compileAsync`：先提交全部材質，再透過 `KHR_parallel_shader_compile` 輪詢完成，完成後仍驗證 LINK_STATUS。只在預編譯期間延後阻塞式診斷／uniform 查詢，正常新材質診斷仍保留。三張地圖第一次繪製等材質完成，計時、保存及獎勵不等待畫面。沒有此扩充的 GPU 沿用原同步 compile；manualFrames 檢視器保留原流程。
- 演出中滑鼠／鍵盤輸入可喚回操作介面，最晚 20 秒恢復；暫停、錯誤、保存或設定面板期間保持可操作，不改故事排程。
- 設定音量 range 不再繼承文字欄位的背景、內陰影及焦點位移；聲音區取消末尾 23px padding，使背景音下方分隔線上移、滑桿位於上下分隔線中央。大廳與 Focus 設定共用這個樣式。

## 驗證

- `npm run build`：32 個測試檔／186 項測試、typecheck、Electron 前後端建置全過。`collectionDocument.test.ts` 的 CRLF／LF 本機模組及 ready 接線測試另行單獨確認 2 項通過。
- `scripts/qa-debug-regression.cjs`：正式 Electron main／preload／renderer、獨立存檔、副螢幕。來源及 ASAR 包內皆通過：預載不消耗核心展示、收藏室離線開啟／只在可見時展示、收藏室無營火音場、兩個滑桿無陰影／鍵盤調音保存、營火與目的地音場交接、暫停停止音訊、返回錄音快取。兩份 errors 均為空。
- 開始耗時以 renderer 25ms timer 超過 100ms 的間隔記錄，CPU profile 在同一台 Windows 的冷進入指出原同步 `getProgramInfoLog` 約 3.8 秒、最大間隔約 5.2 秒。新來源檢查（同時另跑湖畔 QA）最大約 1.27 秒；包內單獨檢查最大約 0.448 秒。這是本機短樣本，不代表所有硬體零卡頓。
- `scripts/qa-moss-camera-app.cjs`：十個保存故事事件、暫停恢復／重載、最小化、有效秒快轉、鏡頭回 home 全過，沒有 renderer error；保持目前運鏡。
- `scripts/qa-area03-integration.cjs`：三張場景預編譯改動後，湖畔 28 音效、燈、暫停／靜音、事件／休息、兩出口、大廳與跨圖實播全過，errors 為空。
- `scripts/qa-area03-assets.cjs`：包內 28 個湖畔錄音及全部 production 輸出逐位元相同；沒有替換或重編音效。

證據：`previews/debug-regression/{source,shipped}/`、`previews/moss-camera-app-qa/`、`previews/area03-integration-qa/source/`。來源與包內的滑桿／收藏室／Focus 截圖已目視檢查。

安裝包：`release-v0.6.26/Focus Quest Setup 0.6.26.exe`。ASAR SHA256：`e0a6b7ebd0841d8cd8fb319903699d848ba92ec84531c996c076205effffacf1`。

實際存檔更新結果：`previews/release-v0.6.26-qa/`。先核對沒有正在進行的 Focus，做唯讀 SQLite backup（integrity = ok），再只關閉已安裝的 Focus Quest、更新並重開。原有 32 sessions、42 nodes、18 tasks 須逐筆核對保留。

下一個負責人：使用者試玩；Codex 依具體回饋修正。後續音效等待使用者素材，不添加未驗收的替代場景音效。

## 安裝完成結果
NSIS exit 0；已安裝並重開 0.6.26，已安裝 ASAR 與上述通過驗證的安裝包完全相同。逐筆存檔比較 exit 0：32 次專注、42 個節點、18 個任務及原有旅程全部保留。見 installation.json、launched.json、user-save-after.json。
