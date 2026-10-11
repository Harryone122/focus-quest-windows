這是「倒影湖畔」第 3C 段的第二階段：正式實作。你（或之前做第一階段預覽的 Sonnet）做的全圖預覽，使用者和 Opus 已經看過並確定方向，只有一處要改（下面第 1 點）。設計由 Opus 負責，你照規格實作，不做設計決定。

## 協作硬規定（使用者定的，一定要遵守）

1. 指令以外的設計決定不要自己做，列進回報的「待釐清」。
2. 如果實作途中要改變已確定的外觀（例如做不到、或要換做法），先給使用者「改完之後的樣子」的靜態預覽圖，停下來等他回 Opus 對話確認，不要直接改。
3. 做完之後，用 SendUserFile 把測試網頁傳給使用者（display: "render"），讓他自己打開試過，再回 Opus 對話討論要修正的地方。

## 專案位置

使用者電腦上的 C:\Users\User\Documents\game project\focus-quest-windows。需要時用 device_request_folder_access 申請 C:\Users\User\Documents\game project。讀檔用 device_bash／device_stage_files，寫回用 device_commit_files（stagedPath 必須在 /mnt/user-data/outputs/ 底下）。查 git 一定加 GIT_OPTIONAL_LOCKS=0；不准 commit、reset、stash。

## 先讀

1. docs/area03/SPEC.md 第 9 節（9.6.1–9.6.5 是最新的，9.6.5 是這次唯一的外觀修改）、第 8.3 節（走路與穿模規則）
2. docs/area03/DECISIONS.md 第 10–12 項
3. docs/area03/CHECKLIST.md 的「第 3C 段」
4. docs/area03/qa/README.md（走面與穿模檢查工具）
5. 第一階段的草稿 previews/area03-3c-draft/reflection-lake-draft.html 與截圖：這是確定的外觀，從它接著做

## 要做的事（依序）

1. 備份：確認 previews/area03-before-3c/ 裡有目前正式版的 docs/prototypes/reflection-lake.html 和 docs/area03/area-03-reflection-lake.scene.json；沒有就現在複製進去。
2. 白天的夜窗調柔和（SPEC 9.6.5，使用者選定）：
   - 白天圓裡的顏色用黃昏後的藍紫色（約 #2c3a6b，往邊緣變成 #5a6aa0），不要接近黑色。
   - 從圓的邊緣往內約 15% 半徑是柔和漸層，夜色像從圓外慢慢暗進去，不是一刀切。
   - 白天的月亮小一點（約圓半徑的 0.22）、淡一點，光暈弱一點；星星少一點、淡一點。
   - 晚上照預覽，不變。黃昏、清晨在兩者之間漸變。
3. 把草稿的全部外觀（睡蓮池、疊月橋與榕樹、月亮時鐘特效、夜晚月光、湖面不放月亮）加上第 2 點，做進正式的 docs/prototypes/reflection-lake.html。其他區域、五盞燈、原有節點都不能變。
4. 路網（SPEC 9.2）：
   - moon_watch 移到 (−8.85, 5.75)，面向 (−7.1, 6.85)。
   - 新增 moon_wfoot (−10.25, 7.55)、moon_crown (−7.1, 7.55，走面約 1.64)、moon_efoot (−3.95, 7.45)、moon_bank (−5.0, 6.25)。
   - 新增五條連線：moon_entry–moon_watch（岸）、moon_watch–moon_wfoot（岸，經 (−9.6, 6.6)）、moon_wfoot–moon_crown（橋，stair）、moon_crown–moon_efoot（橋，stair）、moon_efoot–moon_bank（岸）。
   - 互動點：moon_watch（gazeDown，any）、moon_crown（gazeDown，any，面向南）、moon_bank（sitEdge，low，面向西看拱）。睡蓮池的 leaf_entry、leaf_watch、leaf_seat 不變。
   - 用 docs/area03/qa/ 的工具重量走面、重跑穿模檢查（身體 0.27、帽簷 0.36；欄杆、望柱、榕樹樹幹與氣根要算）。座標可以為了通過檢查微調 ±0.4，要回報。
   - 同步內嵌 JSON（area-data）與 docs/area03/area-03-reflection-lake.scene.json，兩者要一致。
   - 示範排程器要能走到新的互動點，旅人走上橋頂、走過台階要自然。
5. 預覽按鈕名稱維持「疊月橋」，近看位置對準橋；__lake.moonWindow(on) 測試入口要在。
6. 效能與錯誤：draws ≤ 250；沒有 console 錯誤。
7. 截圖存到 previews/area03-stage-3c/（1600×900）：第一階段那一組全部重截（含 map-night-high-1280.png），另外加：
   - bridge-crown.png：旅人站在橋頂，白天滿潮，約 3 倍
   - bridge-bank.png：旅人坐在 moon_bank，白天退潮，約 2.5 倍
   - window-day-soft.png：白天滿潮的夜窗特寫，約 4 倍（看 9.6.5 的柔和效果）
   - window-dusk-high.png：黃昏滿潮的疊月橋，約 2.5 倍
8. 截完先自己對照 CHECKLIST 第 3C 段和 SPEC 9.6.5 看一遍；不好看就繼續調。
9. 回報寫在 docs/area03/STAGE_3C_REPORT.md：做了什麼、CHECKLIST 第 3C 段逐條自查、新節點的最終 (u, v, y) 與每條新連線的長度／最大坡度／最小身體與帽簷間隙、夜窗與夜間光線的最後數值、和規格不同的地方、待釐清、draws／tris（白天滿潮、夜滿潮）、已知問題。
10. 用 SendUserFile 把測試網頁 docs/prototypes/reflection-lake.html（display: "render"）和主要截圖傳給使用者，告訴他：「第 3C 段完成，請先自己打開測試網頁試試看（試看漲潮、切換白天與夜、點疊月橋和浮葉小庭近看），再回到 Opus 對話討論要修正的地方。」然後停止。

## 規則

- 只能寫：docs/prototypes/reflection-lake.html、docs/area03/area-03-reflection-lake.scene.json、docs/area03/qa/、previews/area03-before-3c/、previews/area03-stage-3c/、docs/area03/STAGE_3C_REPORT.md。其他檔案不准改，Codex 可能在同一個資料夾工作。
- 場景裡不能有任何文字或數字。
