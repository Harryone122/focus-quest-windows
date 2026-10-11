# Focus Quest for Windows

Focus Quest 是一款本機優先的 Windows 專注探索遊戲。你工作時，旅人在世界裡安靜前進；真實的專注時間會點亮路燈、推動探索，留下故事、信物與世界記憶。專注結束後，再回到大廳整理任務、閱讀發現並選擇下一條路。

核心循環：**專注 → 前進 → 發現 → 選擇 → 世界成長**。

## 目前進度

更新日期：2026-10-11。最新已安裝測試版為 **0.6.31**；倉庫另包含尚未重新打包的來源修正與獨立試玩。

| 場景 | 狀態 | 詳細紀錄 |
| --- | --- | --- |
| 霧岸營火與旅途中大廳 | 已整合出發、回程、任務清單、路線選擇與音效 | [營火交接](docs/CAMPFIRE_START_HANDOFF.md)、[大廳交接](docs/LOBBY_A_HANDOFF.md) |
| Area 01 雲上遺庭 | 已接正式探索、五燈、故事／發現及世界記憶；新版故事運鏡仍待原型驗收 | [整合紀錄](docs/AREA_01_INTEGRATION_2026-10-02.md)、[運鏡原型](docs/AREA_01_CAMERA_PROTOTYPE_QA.md) |
| Area 02 苔痕驛站 | 已接正式探索、天氣、旅人排程、信物及世界狀態；故事運鏡待使用者驗收 | [後端交接](docs/AREA_02_BACKEND_HANDOFF.md)、[運鏡實作](docs/handoff/area02-camera-direction/IMPLEMENTATION.md) |
| Area 03 倒影湖畔 | 已接正式探索、潮汐、故事、信物、線索與音效 | [場景交接](docs/area03/CODEX_HANDOFF.md)、[音效交接](docs/AREA_03_AUDIO_HANDOFF.md) |
| Area 07 玻璃苗圃 | 已接正式探索、跨旅程幼苗、移植支線、音效與配樂；0.6.31 修正螺旋梯路線 | [場景交接](docs/area07/CODEX_HANDOFF.md)、[0.6.31 驗證](docs/RELEASE_0.6.31_QA.md) |
| Area 05 藏聲秋谷（名稱暫定） | v10 戶外／洞內已移植為獨立試玩；正式路線候選、獎勵、線索與恢復尚未接線 | [試玩說明](docs/area05/TRIAL_README.md)、[場景交接](docs/area05/CODEX_HANDOFF.md) |

十張地圖、五段旅程的最終相遇與真結局是企畫方向，目前仍有未實作與待定案部分。已接線、原型完成與使用者驗收分開記錄；最新狀態以 [共同交接入口](docs/COLLABORATION_STATUS.md) 及其連結文件為準。

## 已有的主要功能

- 專注期間低互動的探索場景，旅人自行行走、點燈與演出；五盞燈依有效專注時間推進，暫停時凍結進度。
- 新探索以 50 分鐘、每 10 分鐘一盞燈為基準；舊存檔既有路線時長保留。
- 未完成地圖可繼續探索，完成後回大廳再選下一條路；選路本身不啟動計時。
- 今日任務排序、依星期重複的例行任務及昨日未完成項目處理；任務完成與遊戲獎勵分開。
- 信物、永久核心、故事線索、世界記憶及收藏室，並保存探索與專注紀錄。
- 本機 SQLite 存檔、JSON 備份／還原與匿名紀錄 CSV 匯出。
- Windows 干擾程式提醒／攔截與緊急解鎖；攔截不終止其他程式。
- 場景環境音、動作音效與部分地圖配樂；素材及未定案音效詳見各地圖交接。

## 開發與建置

需要 Windows、Node.js／npm 與 Git。首次安裝會處理 Electron 原生依賴；版本以 `package-lock.json` 為準。

```powershell
git clone https://github.com/Harryone122/focus-quest-windows.git
cd focus-quest-windows
npm ci
npm run dev
```

倉庫為私人倉庫，下載與推送需要有權限的 GitHub 帳號。

```powershell
npm run typecheck
npm test
npm run build
npm run dist
npm run dist:portable
```

`npm run build` 依序執行 TypeScript 檢查、測試及 Electron Vite 建置。2026-10-11 共同基準通過 **37 個測試檔、208 項測試及完整建置**；這是當日驗證結果。

預設 NSIS 安裝包輸出到 `release-v6/`，單檔版輸出到 `release-portable/`。已有版本驗證紀錄可能使用另外指定的 `release-v0.6.x/` 目錄。安裝包與編譯輸出不提交到 Git；目前未建立 GitHub Releases 下載版。Windows 測試版尚未簽章。

### 獨立試玩

Area 05 使用隔離暫存狀態，不存取玩家正式資料庫。首次從倉庫下載時需先重建離線頁：

```powershell
npx vite build --config scripts/echo-quarry-tester.vite.mjs
.\scripts\try-echo-quarry.cmd
```

玻璃苗圃另有 [動畫音效測試頁](docs/area07/AUDIO_TESTER_README.md)：

```powershell
npx vite build --config scripts/nursery-audio-tester.vite.mjs
.\scripts\open-nursery-audio-tester.cmd
```

大量歷史預覽、QA 截圖／影片、安裝包及存檔只保留在原機；部分素材處理與歷史 QA 工具另需本機錄音、預覽或額外依賴。完整保存範圍見 [Git 基準交接](docs/GIT_CHECKPOINT_2026-10-11.md)。

## Codex 與 Claude 協作

私人遠端：[Harryone122/focus-quest-windows](https://github.com/Harryone122/focus-quest-windows)。共同基準為 `checkpoint/progress-2026-10-11`，保留早期三次提交歷史；後續修正也推送到此分支。

- **Claude**：美術、場景構圖、角色、UI、運鏡、動效／互動設計及設計原型。
- **Codex**：正式 App 前後端、原型移植、動畫接線、計時與存檔、修錯、整合、測試、實機驗證及 Windows 打包。
- **使用者**：產品方向、設計定案、原型試玩與最終體驗驗收。

兩邊從同一基準建立各自分支／工作目錄；共用同一資料夾時輪流寫入，保留其他 agent 的修改。Git 推送與交接文件不會自動喚醒另一個 agent。開工先讀 [AGENTS.md](AGENTS.md)／[CLAUDE.md](CLAUDE.md)、[協作流程](docs/AGENT_WORKFLOW.md) 與相關交接。

## 企畫與文件入口

- [完整核心企畫書](docs/Focus%20Quest%20%E2%80%94%20%E6%9C%80%E7%B5%82%E7%89%88%E6%A0%B8%E5%BF%83%E4%BC%81%E7%95%AB%E6%9B%B8%20v1.md)：產品方向與後續使用者決策的主要來源。
- [企畫摘要](docs/CORE_PLAN_AGENT_BRIEF.md)：快速定位企畫章節；部分段落保留歷史狀態。
- [共同交接入口](docs/COLLABORATION_STATUS.md)：目前進度、下一位與詳細交接。
- [故事與邏輯盤點](docs/audits/2026-10-11/README.md)：已辨識問題與討論提案，不代表全部獲准實作。
- [專案檔案導覽](docs/REPO_MAP.md)：來源與文件位置。

產品方向以核心企畫與使用者決策為準；已實作行為以正式程式與測試為準。舊 UI／架構文件可能保留歷史內容，閱讀時需核對日期及最新交接。

## 技術與資料

Electron、React、TypeScript、SQLite（`better-sqlite3`）、electron-vite、Vitest 與 electron-builder／NSIS。現有正式地圖使用本地 Three.js 場景；倉庫仍保留 Phaser 的早期探索程式與依賴。

任務與遊戲資料保存在本機 AppData。匿名匯出不包含任務文字、視窗標題或完整檔案路徑；攔截器不修改 hosts、不要求系統管理員權限。正式遊戲不依賴雲端 AI，Windows 攔截不涵蓋 iPhone 或瀏覽器網站。
