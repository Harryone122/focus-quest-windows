這是「倒影湖畔」第 3C 段之後的一個小修正：使用者試玩時發現，旅人點第一盞燈時站到水位標尺後面，被標尺擋住。設計由 Opus 負責，你照規格做，不做設計決定。

## 協作硬規定（使用者定的，一定要遵守）

1. 先給「改完之後的樣子」的靜態預覽圖，再實作：先在草稿裡把標尺移過去，截一張預設視角、旅人正在點第一盞燈的圖（白天退潮），加一張近看約 2.5 倍的圖，用 SendUserFile（display: "render"）傳給使用者，然後停下來等他回 Opus 對話確認。不用做動畫或其他效果。
2. 指令以外的設計決定不要自己做，列進回報的「待釐清」。
3. 做完之後，用 SendUserFile 把測試網頁傳給使用者（display: "render"），讓他自己打開試過，再回 Opus 對話討論。

## 專案位置

使用者電腦上的 C:\Users\User\Documents\game project\focus-quest-windows。需要時用 device_request_folder_access 申請 C:\Users\User\Documents\game project。讀檔用 device_bash／device_stage_files，寫回用 device_commit_files（stagedPath 必須在 /mnt/user-data/outputs/ 底下）。查 git 一定加 GIT_OPTIONAL_LOCKS=0；不准 commit、reset、stash。

## 先讀

docs/area03/SPEC.md 第 10 節（這次的完整規格）。原型是 docs/prototypes/reflection-lake.html，水位標尺搜尋 gauge。

## 第一步：預覽（做完就停）

1. 把目前的 reflection-lake.html 複製到 previews/area03-gauge-fix/reflection-lake-draft.html，在草稿裡把水位標尺從 (−11.0, −0.4) 移到 (−10.15, −0.7)，朝向不變（刻痕和空白石面仍朝鏡頭），標尺的潮痕帶、細節、周圍的小東西一起移。
2. 截兩張圖存到 previews/area03-gauge-fix/：
   - lamp1-default.png：預設全圖視角，1600×900，白天退潮，旅人站在 r_lamp1 做點燈姿勢
   - lamp1-zoom.png：同一個畫面約 2.5 倍
3. 用 SendUserFile 傳這兩張圖給使用者，告訴他：「水位標尺移位的預覽好了，請帶回 Opus 對話確認；確定後再叫我實作。」然後停止。

## 第二步：實作（使用者確認之後才做）

1. 先把目前的 reflection-lake.html 和場景 JSON 備份到 previews/area03-before-gauge-fix/。
2. 在正式原型裡把標尺移到 (−10.15, −0.7)（可為穿模與可見性微調 ±0.3，要回報）。
3. r_gauge 站位移到 (−10.65, −1.35)，面向標尺。
4. 連線：r_gauge–r_lamp1 改走標尺原本的位置附近（約經 (−11.0, −0.4)），不再繞東側；r_gauge–r_cw 重新安排 via，離標尺至少 0.45。用 docs/area03/qa/ 的工具重量走面、重跑穿模檢查，同步內嵌 JSON 與 docs/area03/area-03-reflection-lake.scene.json。
5. 可見性檢查（SPEC 10.2）：對全部五盞燈的點燈站位、所有互動點、休息點，在預設鏡頭（1600×900 與 1280×800）下檢查旅人有沒有被擋住：身體至少 70% 看得見，頭和帽子要完整看得見（蘆葦、草、燈火光暈不算）。把結果存到 docs/area03/qa/visibility.json。除了第一盞燈之外，不合格的站位只列出來，不要自己改。
6. draws ≤ 250；沒有 console 錯誤。
7. 回報寫在 docs/area03/FIX_GAUGE_REPORT.md：改了什麼、標尺與 r_gauge 的最終座標、兩條連線的檢查結果、可見性檢查的結果表（哪些站位不合格、被什麼擋住、被擋的比例）、待釐清。
8. 用 SendUserFile 把測試網頁 docs/prototypes/reflection-lake.html（display: "render"）和 lamp1 的新截圖傳給使用者，告訴他：「水位標尺已移位，請先自己打開測試網頁看第一盞燈，再回 Opus 對話討論。」然後停止。

## 規則

- 只能寫：docs/prototypes/reflection-lake.html（第二步才寫）、docs/area03/area-03-reflection-lake.scene.json、docs/area03/qa/、previews/area03-gauge-fix/、previews/area03-before-gauge-fix/、docs/area03/FIX_GAUGE_REPORT.md。其他檔案不准改。
- 只動水位標尺、r_gauge 和這兩條連線；其他東西都不能變。場景裡不能有任何文字或數字。
