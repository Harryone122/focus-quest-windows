# 結束專注的場景銜接修正（2026-09-27）

## 範圍與原因

使用者提供 14:38 的錄影，指出結束專注後切換生硬、卡頓。本輪不修改另一個對話已完成的入口石板／SPAWN_NODE／路線修正，也不重新設計 Claude 的地圖或回顧介面。

原流程在 Focus → AfterFocus 拆除完整 Three.js 場景，再建一個特寫背景；AfterFocus → Lobby 再拆建一次。原版隔離實機測試在第一個切換建立一個新的 WebGL context，量到約 950ms 的 RAF 更新空檔（單次樣本，不是跨裝置效能保證）。

## 實作

- App 在同一 session 的回顧期間保留原本 Focus 組件和 canvas。停止畫面計時、暫停場景，隱藏並 inert 舊控制項；回顧使用原本的模糊、暗化語言。不呼叫 pauseFocus，不更動後端已結束的 session。
- AfterFocus 新增 `retainFocusBackdrop`；重開程式而沒有原畫布時，仍能由已保存的 pendingDebrief 建立原有回顧背景。
- `sceneHandoff.ts` 是一次性的 renderer 所有權交接，不是常駐場景快取。舊組件 cleanup 將 scene 留給新 LobbyStage；新組件取得後負責 destroy。未被取得的 scene 在一秒後清除，最多保留一份。重開後的回顧也可交接。
- `enterLobby(host, options)` 只改場景生命週期與資料接合：轉接 canvas/ResizeObserver、替換回呼、採用保存後的時間、核心與 marks、套用既有 lobby/rest 錨點及鏡頭。地形、材質、GPU programs 與陰影資源重用；入口座標與燈位不變。
- 回大廳使用 Chromium view transition 淡接。IPC broadcast 與操作回傳共用同一個 snapshot 接收器，避免重複資料提早卸載舊畫面。`renderNow()` 在新布局量測後立即繪製；不在 view transition callback 等待 RAF（該期間可能被抑制）。API 不可用、隱藏視窗、減少動態效果或轉場失敗時仍能正常交付已保存的 snapshot。
- 任何動畫都不決定 session、任務完成、進度或獎勵。回顧期間保留的是顯示資料，不是仍在執行的專注。

## 驗證入口

- `npm.cmd run build`：型別、106 項測試及 production build。
- `scripts/qa-exit-transition.cjs <label> <elapsedSeconds>`：實際 App、preload、SQLite 的隔離測試；檢查 canvas identity、WebGL context 建立數、RAF 空檔、renderer errors、結束後計時停止、回答與返回狀態。label 含 `paused`、`reload`、`reduced`、`transition-failure` 可測對應情境。`FOCUSQUEST_QA_BUNDLE` 可指定出貨 ASAR，並核對所有建置資產雜湊。
- `scripts/qa-lobby-integration.cjs`：原有完整任務／例行事項／大廳／部分進度／出口整合。
- `scripts/qa-lamp-sync.cjs`、`scripts/qa-entry-spawn.cjs`：點燈及另一對話的落腳修正回歸檢查。
- 圖片／報告：`previews/exit-transition-qa/`。使用者錄影的抽樣幀：`previews/exit-transition-reference/`。

## 給 Claude

本輪不要求視覺重做。請保留 `retainFocusBackdrop`、`handoffOnUnmount`、scene ownership 交接，以及在 LobbyStage 量測後的 `renderNow()`。不要為回顧重新建立一個 3D 場景，也不要讓動畫完成成為保存進度的必要條件。未來若調整回顧／大廳樣式，可以沿用這些介面；不需開視窗或截圖。
