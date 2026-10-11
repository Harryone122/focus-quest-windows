# 苔痕驛站故事運鏡：Codex 實作交接（2026-10-03）

狀態：正式場景已整合，待使用者試用並與 Claude 討論；尚未收尾。使用者已看過原型，本次直接移植，不重新設計。

## 實作

- `src/renderer/src/exploration/storyDirector.ts`：共用、無 WebGL 相依的 `dirShot(eventId,p,anchors,events)`；smoothstep、對數 zoom、三種動態錨點、臨界阻尼彈簧（0.55 秒）。
- `docs/area-02-moss-station.scene.json`：十個故事事件加入原型 `camera.keys`；只插入鏡頭欄位，寫入前比較來源位元組，確認沒有其他寫入者改檔。
- `src/renderer/src/mossStation/mossStationScene.js`／`.d.ts`：與 `storyUpdate(p)` 共用保存動作的 `actionProgress`；提燈演出和鏡頭呼叫同一個 `lanternAt()`，使用既有曲線。開場依既有 cinematic UI 規則播放。
- 鏡頭恢復／快轉直接 snap；暫停對齊保存進度；場景初建／恢復時姿勢與手持物亦定位到該進度。正常播放疊加既有拖曳及回彈。
- 使用 `camera.zoom`，水面 pxPerUnit 依 zoom 更新；放大後補償不對稱 chrome 視錐，保留可視帶中央；玻璃仍取樣同一張最新場景。太陽維持原 home 目標，固定 4096 陰影貼圖避免追鏡移動。
- 減少動態：凍結各關鍵格（包含移動錨點），以場景暫停時鐘做 0.4 秒淡出／切換／淡入；恢復與快轉直接定位。
- 依 diff 移植朝向鏡頭刻字牌、1.7 倍提燈、雨天 1.5 倍水痕圈及 `drift`／`wick` 尾段七點遠方燈光。

本次未改正式後端、獎勵、燈、天氣、排程、線索與保存規則；未讀寫使用者存檔。App.tsx、LobbyScene.tsx、企畫書與 brief 沒有修改。

## 試用入口

在專案根目錄雙擊 **苔痕驛站運鏡測試.lnk**，或執行 `scripts/try-moss-camera.cmd`。

這是正式場景模組的 Windows Electron 檢視器，使用 `previews/moss-camera-qa/inspection-profile/inspection.db`，與使用者遊戲存檔完全分開。十個事件、下一事件並播放、運鏡開關、進度拖曳、暫停、減少動態、重建與重開皆可操作。檢視器主程序保存事件動作及時間，再透過 IPC 傳入正式場景；不產生正式獎勵。開場仍提供檢視器控制列以利比較，正式 App 保留原本的介面隱藏規則。

自動測試：`FOCUSQUEST_CAMERA_QA=1` 執行 `scripts/try-moss-camera.cjs`。正式 App 接線檢查：`scripts/qa-moss-camera-app.cjs`（自動建立獨立暫存資料夾）。

## 驗證與界線

- `npm run build`：typecheck、32 個測試檔／181 項 vitest 與 Electron 前後端建置全過。
- `tests/storyDirector.test.ts`：十份關鍵格與交接逐項相同，所有 at 可解析、連續、zoom 1–12、末格精確 home；對數倍率及彈簧幀率一致性／暫停測試。
- `previews/moss-camera-qa/report.json`：70 個鏡位進度點；五種比例各檢查十個事件／五個進度點的提燈可見範圍；暫停、重建、重開、減少動態 0.4 秒切換；沒有 renderer error。放大鏡位 RAF 間隔 P95 約 7.2 ms（此 Windows 機器、短時間取樣，不代表所有硬體）。
- `previews/moss-camera-app-qa/report.json`：實際 App／preload／SQLite，十個保存事件與相同 p、暫停重開、繼續、最小化恢復、後端快轉及事件結束 home。QA 在第二螢幕執行。
- 五種比例為 1600×900、1440×900、1200×900、1680×720、520×800。相關畫面與事件鏡位截圖保存在上述 QA 資料夾。

未做：穿透剪影、柴堆站位調整、抽屜特寫重設，以及新的安裝包／使用者現有安裝版替換。這些不包含在本次移植驗證裡。

尚未達成的視覺驗收：雨天首訪約 p=0.4 的提燈雖然投影位於可視帶內，實際仍被樹冠遮住；二訪紙片角落的「灣」在沿用原型的平放小紙片及低角度鏡位下仍偏小。投影可見範圍測試只證明沒有出框，不證明沒有物件遮擋。相關證據是 `previews/moss-camera-qa/story_first_lantern_rain-0.4.png`、`story_second_sketch-0.4.png`，以及正式 App 的 `previews/moss-camera-app-qa/story_second_sketch.png`。

需要使用者／Claude 決定：雨天此段是否調整方位／高度，二訪紙片是否需要改成更可讀的鏡位，以及新行李牌是否需要額外抽屜特寫。現有鏡位及物件沿用已批准原型；可運行和資料測試通過不等同視覺驗收完成。不自行改作者鏡位、不新增穿透剪影。
