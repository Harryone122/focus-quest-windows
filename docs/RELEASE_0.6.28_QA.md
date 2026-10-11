# Focus Quest 0.6.28 — 大廳旅人與吊橋穿模

日期：2026-10-04。使用者要求修正走向吊橋時穿過地面長木頭，並以正式倒影湖畔旅人的外型與動作幅度為準調整大廳。

- 正式 `CampfireStage.tsx` 匯入的 `docs/prototypes/campfire-start.html`：吊橋路線改走長木頭東端外側，繞過路牌再接吊橋，使用 centripetal 曲線；保留浮石出口。
- 旅人採用湖畔的 1.15 倍模型、0.3 短單節腿、0.23／0.6 披風、0.105 頭部、0.6 頭部錨點、±0.13 手臂及棕色背卷。移除額外膝部、鞋與掌部球體，手杖／燈採用湖畔輪廓。長木頭的坐姿高度另行保留，站姿髖高回到 0.3。
- 行走腿擺 ±0.55 rad、垂直起伏 0.035、披風擺動係數 0.07；左臂不額外甩動，右持杖手臂保持 -0.35。蹲下用湖畔的 -0.9 腿部角度／0.45 前傾。没有改地圖內容、Focus 計時、獎勵或存檔格式。
- 原有營火 8 秒出發、5.05 秒點燈、約 5.4 秒亮起及音檔／聲音時序保留。

## 驗證

- 完整建置：32 檔／186 項測試、TypeScript、Electron 前後端全通過。
- `scripts/qa-campfire-traveller.cjs`：獨立存檔、真 Electron、副螢幕；核對模型比例，吊橋／浮石各取整條曲線 401 點，包含帽寬的保守避讓半徑為 0.565。吊橋最小中心距離約 0.901，通過；核對行走肢體及凍結畫面。分段截圖已產出，idle、點燈、繞木頭及吊橋入口已目視檢查。
- `scripts/qa-campfire-actions.cjs`：吊橋正式 Focus 流程、音量／靜音、設定／收藏室、最小化、暫停恢復、點燈及目的地音場交接全通過；觀測出發長度 8.0186 秒、交接靜音 0ms，errors 為空。
- 包內素材一致性與同一組旅人檢查：`previews/campfire-traveller-qa/shipped/report.json`。
- 更新前確認 0 個進行中 Focus，唯讀 SQLite backup integrity = ok；32 sessions、42 nodes、18 tasks。更新與存檔連續性結果在 `previews/release-v0.6.28-qa/`；完成狀態以其 installation 與 after 核對為準。

下一步：使用者試用大廳出發，確認新的旅人比例與動作觀感。證據在 `previews/campfire-traveller-qa/`。

安裝完成：0.6.28 靜默安裝 exit 0，已安裝 ASAR 與通過 QA 的包雜湊一致，已開啟新版本。更新後 32 次專注、42 個節點、18 個任務及旅程狀態逐筆核對保留。
