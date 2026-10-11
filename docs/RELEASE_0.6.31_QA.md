# Focus Quest 0.6.31：玻璃苗圃螺旋梯

日期：2026-10-10（台灣）。使用者要求檢查樓梯修整，確認合理後整合正式遊戲。

## 檢查與修正

- 保留 Claude 已交付的共用 `SPIRAL` 幾何、踏板方向、扶手高度、頂端齊平平台及出口護欄。
- 原入口繞西側時碰到植栽，改繞東側並避開走道支柱；平台走路位置改走出口中央，避開右側護欄柱。
- 正式保存動作的路線轉換原本直接連接節點。現在逐邊展開，G2↔CT 與本地動畫使用相同的螺旋線，避免直線穿過樓梯。
- 本次不新增後端空中走道活動：目前場景 JSON 沒有 CT／CRL 路點，排程仍排除 `lean`。倚欄與完整上下樓透過正式場景的隔離 QA 動作驗證；不把 QA 注入描述成正常遊玩會自動出現的事件。
- 新包包含目前已接線的苗圃背景音樂、葉聲 60%、動畫音效暫停接續及霧循環修正。核心木琴仍未加入正式取得動畫。

## 驗證

- TypeScript、35 測試檔／199 測試及正式建置通過：`previews/stair-fix-qa/build.log`。
- 真 Electron 全圖行走／節點碰撞檢查通過；G2→CT 每 0.025 m 採樣皆有踏板或平台支撐，沒有踩空。實際走入 `lean`／`stairSit` 及特寫已渲染並檢視：`previews/stair-fix-qa/runtime/report.json`、同目錄 PNG。
- 正式 App 保存動作接線隔離測試：上樓及下樓全程留在螺旋線，抵達端點，無 renderer 錯誤：`previews/stair-fix-qa/app/report.json`。
- QA 均使用隱藏視窗與獨立暫存存檔。

## 發布紀錄

- Windows NSIS 打包成功：`release-v0.6.31/Focus Quest Setup 0.6.31.exe`。
- 從新 `app.asar` 與 unpacked 依賴取出套件後，真 Electron 重跑上下樓接線通過：`previews/stair-fix-qa/shipped/report.json`。
- 包內 48 音檔解碼、暫停／靜音、書頁／信物、核心四個接觸點、跳時不補播等六项檢查通過：`previews/nursery-audio-qa/shipped/report.json`。修正舊音效 QA 的快轉斷言：在同一次同步操作比較音效歷史，而非跨兩次工具呼叫檢查前景數量，避免正常動畫在兩次呼叫間發聲造成假失敗。
- 已靜默安裝，安裝程式退出碼 0，已安裝版本 `0.6.31.0`，並啟動新版本。
- 安裝前無進行中專注；一致性 SQLite 備份完整性 `ok`。更新前後 32 專注紀錄／42 路線節點／18 任務完整保留：`previews/release-v0.6.31-qa/user-save-before.json`、`user-save-after.json`、`user-save-backup.json`，比對程序退出碼 0。
- 正式苗圃試玩入口與桌面離線動畫測試使用新場景；使用者可直接試看。
