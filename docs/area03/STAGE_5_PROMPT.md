> **2026-10-03 註：使用者決定第 5 段由 Opus 直接實作，這份指令沒有交給 Sonnet。實作結果見 `REVIEW_5.md`。**

# 倒影湖畔 第 5 段指令（給 Sonnet 5.5）：開場、首訪、第二次造訪、擁有湖鏡後、信物事件

你在做 Focus Quest 第三張地圖「倒影湖畔」的網頁原型（單檔 three.js r128）。前四段已經做完並驗收。這一段把**故事事件、信物事件與線索**做進原型。設計與驗收是 Opus，使用者是 Harry（繁體中文、喜歡直白的說明）。

資料夾：`C:\Users\User\Documents\game project\focus-quest-windows`

## 三條硬規定（使用者定的，一定要照做）

1. 這份指令使用者會直接貼給你；你的回報也直接在對話裡給使用者看（檔案照樣存一份）。
2. **動手實作之前，先交「改完之後的樣子」的靜態預覽圖**：用最少的工夫畫出每個演出關鍵那一格長什麼樣子（可以在草稿網頁裡把道具擺好、姿勢擺好再截圖，或其他方式），**不用先做動畫、時間軸、鏡頭推近的過程**；也不是拿現在還沒改的畫面截圖。交完預覽就**停下來**，等使用者和 Opus 討論、確認方向後才正式實作。
3. **做完之後，用 SendUserFile 把測試網頁直接傳給使用者**，讓他自己試過，再回來和 Opus 討論要修什麼。

## 先讀（依序）

1. `docs/area03/DECISIONS.md`：使用者定案的事（第 5、11、13、14 條和這段有關）
2. `docs/area03/SPEC.md` **第 12 節**（本段的完整規格，有衝突以它為準），以及 10.2（旅人不能被擋）、11.7.1（不准隱藏或透視物件）、11.9（石凳與坐法）
3. `docs/area03/STAGE_4_5_DESIGN_DRAFT.md` 第 5、6、8 節（內容表；已依第 12 節更正）
4. `docs/area03/CONCEPT.md` 7.1（首訪、二訪的鏡頭推近）
5. 參考前一張的做法：`docs/AREA_02_MOSS_STATION_EVENTS.md` §19，與 `docs/prototypes/moss-station.html` 內嵌 JSON 的 `storyRules`、`storyEvents`、`clues`（欄位照抄這個格式）
6. 原型：`docs/prototypes/reflection-lake.html`（測試掛鉤在 `window.__lake`，`?qa=1` 停掉自動動畫）。交接文件 `docs/area03/CODEX_HANDOFF.md` 第 3 節有幾條容易踩錯的規則：**模型的 `armL` 是旅人的右手**、凳子坐法、離開的走法。

## 第一步：靜態預覽（做完就停）

交這些圖（1600×900，預設時段配色照該演出的潮位與時段；推近的兩張用推近後的構圖），存到 `previews/area03-stage-5-preview/`，並在對話裡直接給使用者看：

1. `open-carving`：開場，旅人站在水位標尺前、手剛擦完，刻字露出來，手上拿著翻開的筆記。另附一張刻字的特寫，讓使用者看刻字的樣子。
2. `first-lag`：首訪，推近後的那一格：旅人已經轉身、低頭，**腳下的倒影還面向亭子**。（倒影要是同一個 3D 旅人，不是剪影。）
3. `second-cup`：二訪，推近後的那一格：沉階頂上，旅人坐在階緣，身旁真的台階上一只杯子；**倒影裡兩只杯子，一只冒熱氣**。
4. `second-cup-touch`：二訪，旅人伸手碰倒影那一刻（可只擺姿勢，漣漪畫個大概）。
5. `core-boots`：擁有湖鏡後，石環倒影裡環上的一雙舊靴子（預設鏡頭）。
6. `carry-wick`、`carry-lens`、`carry-tag`、`carry-plate`、`carry-shard`：五個信物事件各一張關鍵格（預設鏡頭）。`carry-lens` 是橋倒影裡橋頂的一盞提燈（沒有人）；`carry-shard` 是凳面上光斑裡的兩個杯印。

每張圖旁邊用一兩句寫：位置（節點、座標）、和第 12 節不同的地方（如果有）、你覺得不確定的地方。

**交完預覽就停下來，不要開始實作。**

## 第二步：正式實作（使用者確認預覽後才做）

1. 依 SPEC 第 12 節做完：四個故事事件、五個信物事件、線索、世界記憶 `gaugeCarving`、永久的沉燈（`carry_old_wick` 用）、疊月橋東墩的舊潮痕（`carry_tide_plate` 用）。
2. 首訪、二訪的鏡頭推近與拉回；減少動態效果時改用暗角；演出中不能拖鏡頭；暫停時一起凍結。
3. 首訪用「只在倒影的分身」做延遲轉身（真的旅人演出期間只在 layer 2，分身在 layer 1），腳底對齊；演出完換回。
4. 「只在倒影」的道具（第二只杯子與熱氣、靴子、橋頂提燈）放 layer 1；主畫面完全看不到。
5. 場景 JSON 新增 `storyRules`、`storyEvents`、`clues`（照苔痕驛站的欄位），內嵌副本與 `docs/area03/area-03-reflection-lake.scene.json` 要逐字相同。**不要重跑** `docs/area03/qa/` 裡的 `s4data.py`、`sync_s4.py` 等舊產生器（會蓋掉手動修過的資料），直接改 JSON。
6. 第 4 排加「試看故事」「試看信物事件」兩個輪流按鈕（12.7）；播之前自動設好潮位、時段與需要的狀態，播完恢復。截圖模式（H 鍵）繼續可用。
7. 測試掛鉤補 `story(id, p)`（給了進度就停在那一格）。

## 檢查（做完自己跑）

- `docs/area03/qa/visibility_s4.js`：新站位在預設鏡頭下身體 ≥ 70%、頭帽完整（k_lamp4 是已接受的例外）。
- `docs/area03/qa/final-audit.cjs`：把新事件也加進去，全部播完一次，沒有錯誤、沒有 NaN。
- `docs/area03/qa/bench-clearance.cjs`：`carry_silvered_shard` 站在石凳前，腿和斗篷不能碰到凳子。
- 繪製次數：穩態 ≤ 250、推近時 ≤ 250；1600×900 與 1280×800 沒有 console 錯誤。

## 只能改的檔案

`docs/prototypes/reflection-lake.html`、`docs/area03/area-03-reflection-lake.scene.json`、`docs/area03/qa/` 底下的檢查腳本與結果、`docs/area03/STAGE_5_REPORT.md`、`previews/area03-stage-5-preview/`、`previews/area03-stage-5/`。實作前先把目前的 HTML 與 JSON 備份到 `previews/area03-before-stage-5/`。不要碰企畫書、`src/`、其他地圖的原型。

## 回報（`docs/area03/STAGE_5_REPORT.md`，也直接貼在對話裡）

做了什麼、和 SPEC 第 12 節不同的地方與理由、移動過的站位、檢查結果、繪製次數、截圖清單（`previews/area03-stage-5/`：每個演出的關鍵格，首訪與二訪各附推近前後兩張），以及「待釐清」給 Opus 決定。最後用 SendUserFile 把測試網頁傳給使用者。
