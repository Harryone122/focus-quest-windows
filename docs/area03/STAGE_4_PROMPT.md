你要幫 Windows 專注遊戲「Focus Quest」的第三張地圖「倒影湖畔」網頁原型做第 4 段：隨機事件、休息、兩個出口的離開動畫，以及兩種旅程信物和核心「湖鏡」的取得演出。設計由另一個對話（Opus）負責，你照規格實作，不做設計決定。故事事件（開場、首訪、第二次造訪、信物事件）是第 5 段，這次不做。

## 協作硬規定（使用者定的，一定要遵守）

1. 先給「改完之後的樣子」的靜態預覽圖，再實作：先用最少的工夫做出下面「第一步」列的幾個關鍵畫面（靜態截圖就好，不用做完整動畫或排程），用 SendUserFile（display: "render"）傳給使用者，然後停下來，等他回 Opus 對話確認。
2. 指令以外的設計決定不要自己做，列進回報的「待釐清」。
3. 做完之後，用 SendUserFile 把測試網頁傳給使用者（display: "render"），讓他自己打開試過，再回 Opus 對話討論。

## 專案位置

使用者電腦上的 C:\Users\User\Documents\game project\focus-quest-windows。需要時用 device_request_folder_access 申請 C:\Users\User\Documents\game project。讀檔用 device_bash／device_stage_files，寫回用 device_commit_files（stagedPath 必須在 /mnt/user-data/outputs/ 底下）。查 git 一定加 GIT_OPTIONAL_LOCKS=0；不准 commit、reset、stash。

## 先讀（依序）

1. docs/area03/SPEC.md 第 11 節（這一段的實作細節），以及第 8 節（路網、互動點、示範排程器）、第 10.2 節（旅人不能被擋住）
2. docs/area03/STAGE_4_5_DESIGN_DRAFT.md 的第 2、3、4、7、9 節（寶物、休息、離開、41 個一般事件、世界記憶的內容表）
3. docs/AREA_02_MOSS_STATION_EVENTS.md 的 §6、§8、§10、§13（前一張地圖的事件、特殊發現、休息、離開的寫法）
4. docs/prototypes/moss-station.html 的特殊發現演出、休息、離開、旅途筆記、介面按鈕的做法（搜尋 startRare、startRest、previewDepart、renderJournal）
5. 原型 docs/prototypes/reflection-lake.html 與 docs/area03/area-03-reflection-lake.scene.json（目前的版本）

## 第一步：預覽（做完就停）

1. 把目前的 reflection-lake.html 複製成 previews/area03-stage-4-draft/reflection-lake-draft.html，只做出下面這些畫面需要的道具和姿勢，擺好後截圖（1600×900，約 2.5–3 倍近看，除非另外寫）：
   - core-1-touch.png：旅人蹲在石環邊伸手碰水（白天退潮）
   - core-2-rising.png：圈裡的水面立到一半，十四顆星點往中心聚，藍色光柱（白天退潮）
   - core-3-standing.png：直立的圓形水鏡，旅人抬頭看（白天滿潮）
   - core-after-ripple.png：取得核心之後，石環裡的水有漣漪（白天退潮）
   - plate-gauge.png：旅人在標尺腳邊撬銅片，琥珀色小光點（白天退潮）
   - plate-boat.png：滿潮版，旅人在小船邊抽出銅片（白天滿潮）
   - shard.png：旅人拿著翻過來的鏡片，背面暗銀色（白天）
   - rest-cup.png：第一次休息，旅人坐在長凳上喝茶、石桌上放著翻正的杯子（白天）
   - depart-arch-high.png：離開 A，旅人走在拱門外水下的踏石上，滿潮（預設全圖視角）
   - depart-east-dusk.png：離開 B，黃昏退潮（預設全圖視角）
   - marks.png：世界記憶全滿時，船舷上 10 顆貝殼、岩上 6 顆松果（約 2 倍，兩張也可以）
2. 用 SendUserFile 把這些圖傳給使用者，簡短說明做了什麼、哪裡不確定，告訴他：「第 4 段預覽好了，請帶回 Opus 對話確認；確定後再叫我實作。」然後停止。

## 第二步：實作（使用者確認之後才做）

1. 先把目前的 reflection-lake.html 和場景 JSON 備份到 previews/area03-before-stage-4/。
2. 依 SPEC 第 11 節做進正式的 docs/prototypes/reflection-lake.html：
   - 四個寶物演出（11.1）、核心取得後石環的水會起漣漪。
   - 休息（11.2）、兩個出口的離開（11.3）。
   - 41 個一般事件與世界記憶（11.4），事件站位要符合 SPEC 10.2（旅人不能被擋住）；不合格的列出來，不要自己移東西。
   - 示範排程器與介面按鈕（11.5）。
   - 場景 JSON（11.6），內嵌與外部檔案一致。
3. draws ≤ 250；沒有 console 錯誤；新增的道具不穿模（用 docs/area03/qa/ 的工具檢查事件站位）。
4. 截圖存到 previews/area03-stage-4/：第一步那一組全部重截，再加一張 full-run.png（×60 跑完整趟、五盞燈亮、旅人在長凳休息的全圖）。
5. 回報寫在 docs/area03/STAGE_4_REPORT.md：做了什麼、新增的姿勢與道具、41 個事件的站位檢查結果（可見性與穿模）、JSON 新增的欄位、和規格不同的地方、待釐清、draws／tris、已知問題。
6. 用 SendUserFile 把測試網頁 docs/prototypes/reflection-lake.html（display: "render"）和主要截圖傳給使用者，告訴他：「第 4 段完成，請先自己打開測試網頁試試看（試看特殊發現、試看新事件、試看離開、×60 跑一整趟），再回到 Opus 對話討論要修正的地方。」然後停止。

## 規則

- 只能寫：docs/prototypes/reflection-lake.html（第二步才寫）、docs/area03/area-03-reflection-lake.scene.json（第二步才寫）、docs/area03/qa/、previews/area03-stage-4-draft/、previews/area03-before-stage-4/、previews/area03-stage-4/、docs/area03/STAGE_4_REPORT.md。其他檔案不准改，Codex 可能在同一個資料夾工作。
- 不改地形、路網、五盞燈、潮汐、疊月橋特效與已完成的東西；場景裡不能有任何文字或數字。
- 寶物與事件都是純畫面與示範；正式的抽選與保存由 Codex 做，不要改 src/。
