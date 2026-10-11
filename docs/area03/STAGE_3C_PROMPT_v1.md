# 給 Sonnet 的第 3C 段指令：重做兩個漲潮小區域與月光

（使用者：開一個新的 Sonnet 對話，把「---」之後的全部內容貼上。它會自己申請資料夾、照清單讀檔案。）

---

你要幫一個 Windows 專注遊戲「Focus Quest」修改第三張地圖「倒影湖畔」的**網頁原型**。設計已經由另一個對話（Opus）決定好，你的工作是**照規格實作**，不做設計決定。這一段叫「3C」：重做兩個漲潮小區域（浮葉小庭、缺月石廊 → 疊月橋）和夜裡的月亮與月光。做完就停，交回報，等驗收。

## 1. 專案位置與讀取方式

專案在使用者電腦上：`C:\Users\User\Documents\game project\focus-quest-windows`。這個對話連著使用者的電腦：
1. 如果還不能讀，用 `device_request_folder_access` 申請 `C:\Users\User\Documents\game project`。
2. 在使用者電腦上讀、找檔案用 `device_bash`；要在雲端工作區編輯、截圖時，用 `device_stage_files` 複製進來。
3. 做好的檔案用 `device_commit_files` 寫回（`stagedPath` 必須在 `/mnt/user-data/outputs/` 底下）。
4. 查 git 狀態一定加 `GIT_OPTIONAL_LOCKS=0`；不要 commit、reset、stash。

## 2. 先讀（依序）

1. `docs/area03/SPEC.md` 的**第 9 節**（這一段的完整規格），以及第 0、8.3 節（座標、走路與穿模規則）
2. `docs/area03/CHECKLIST.md` 的「第 3C 段」
3. `docs/area03/DECISIONS.md`（第 8–10 項）
4. `docs/area03/TIDAL_AREAS_REPORT.md`（Codex 原本怎麼做這兩區，你要取代的東西）
5. `docs/area03/ref/lily-pond-draft.js`、`docs/area03/ref/moon-water-draft.glsl.txt`：Opus 寫的**未測試草稿**，可以直接拿來改，但以 SPEC 第 9 節為準
6. `docs/area03/qa/README.md`：走面與穿模檢查工具的用法
7. 原型 `docs/prototypes/reflection-lake.html`（約 6500 行）。要改的位置：
   - 地形定義：搜尋 `const LEAF_POLY`（兩區的外形與 `addF`）
   - 兩區的模型：搜尋 `two tide-revealed pockets`，一直到 `function tidalUpdate` 結束
   - 月亮：湖面 shader 的 `FRAG` 裡搜尋 `moonP`
   - 夜晚光線：`const PRE` 的 `night`
   - 內嵌場景 JSON（`area-data`）的 `leaf_*`、`moon_*` 節點、連線與互動點
   - 預覽按鈕：搜尋 `moonView`

## 3. 硬規則

1. **只能寫這些檔案：**
   - `docs/prototypes/reflection-lake.html`
   - `docs/area03/area-03-reflection-lake.scene.json`（和原型內嵌的 JSON 保持一致）
   - `docs/area03/qa/` 底下的檢查程式與結果
   - `previews/area03-stage-3c/` 的截圖
   - `docs/area03/STAGE_3C_REPORT.md`
   其他檔案一律不准改。Codex 可能在同一個資料夾工作。
2. **開始改之前，先把目前的 `reflection-lake.html` 和場景 JSON 複製一份到 `previews/area03-before-3c/`**，方便使用者比較或還原。
3. 只動這兩區、月亮、夜間光線，以及預覽按鈕的名稱。其他區域、五盞燈、原有節點都不能變。
4. 規格沒寫到的設計決定列進「待釐清」，不要自己發明。**場景裡不能有任何文字或數字**。座標可以為了穿模檢查微調 ±0.4，全部回報。
5. 不碰 git；做完就停。

## 4. 要做的事（依序）

1. **備份**（規則 2）。
2. **月亮與月光**（SPEC 9.4）：先做這個，因為最獨立。拿掉 Codex 的月亮區塊，換成 Opus 的草稿再調整。夜間主光改從月亮那一側照過來。調到：月亮柔邊有光暈、月光路在退潮時碎亮、滿潮時月面完整乾淨；朝鏡頭的面在夜裡仍看得清楚。
3. **浮葉小庭 → 睡蓮池**（SPEC 9.3）：換地形定義、`pocketPaving` 加挖池塘的參數，拿掉三個水槽和舊葉片、花朵，放入池邊石、立石、菖蒲、睡蓮葉、睡蓮花和新的 `tidalUpdate`。葉子、花瓣、花心各用一個 InstancedMesh。`__lake.tidalAreas()` 要繼續能回傳葉子的高度與開花程度。
4. **缺月石廊 → 疊月橋**（SPEC 9.2）：拿掉厚拱圈、八角台、方塊殘牆與碎石；做西岸、水道、石拱橋（拱、券石、拱肩、橋墩、駝峰台階、欄板與望柱、月輪浮雕、拱腹水光）、東岸小洲與榕樹。**起拱線一定要剛好在 y = 0.30**，滿潮時用截圖確認拱和倒影接成的圓沒有縫、沒有錯位。
5. **路網**：依 SPEC 9.2 移動 `moon_watch`，新增 `moon_wfoot`、`moon_crown`、`moon_efoot`、`moon_bank` 與五條連線（橋上兩條是 `stair`）；睡蓮池的三個節點不變。用 `docs/area03/qa/` 的工具重新量走面高度、重跑穿模檢查，同步內嵌 JSON 與 `area-03-reflection-lake.scene.json`。示範排程器要能走到新的互動點。
6. **預覽按鈕**：「缺月石廊」改成「疊月橋」，近看位置對準橋。
7. **效能**：靜態物件交給原本的 `mergeUnder` 合併；`draws` ≤ 250。

## 5. 截圖：`previews/area03-stage-3c/`（1600×900）

用 `__lake.setTime`、`setTide`、`focus`、`goto`、`pose` 擺好再截。

| 檔名 | 內容 |
| --- | --- |
| `day-low.png`、`day-high.png` | 白天退潮／滿潮全圖 |
| `night-low.png`、`night-high.png` | 夜退潮／滿潮全圖（月亮、月光路、月光） |
| `night-high-1280.png` | 夜滿潮全圖，1280×800 |
| `bridge-day-low.png`、`bridge-day-high.png` | 疊月橋約 2.5 倍，白天退潮／滿潮（滿潮要看出完整的圓） |
| `bridge-night-high.png` | 疊月橋約 2.5 倍，夜滿潮 |
| `bridge-rising-0.5.png` | 疊月橋約 2.5 倍，潮位一半 |
| `bridge-crown.png` | 旅人站在橋頂，約 3 倍，白天滿潮 |
| `bridge-bank.png` | 旅人坐在 `moon_bank`，約 2.5 倍，白天退潮 |
| `pond-day-low.png`、`pond-day-high.png` | 睡蓮池約 2.5 倍，白天退潮／滿潮 |
| `pond-rising-0.4.png`、`pond-rising-0.7.png` | 睡蓮池漲潮途中（葉子攤開、花開到一半） |
| `pond-flower-zoom.png` | 一朵盛開的睡蓮約 6 倍 |
| `pond-night-high.png` | 睡蓮池約 2.5 倍，夜滿潮 |
| `moon-zoom-low.png`、`moon-zoom-high.png` | 月亮約 2.5 倍，夜退潮（碎）／夜滿潮（完整） |

截完先自己看過，對照 `CHECKLIST.md` 第 3C 段；覺得不好看就繼續調，不要只求通過。

## 6. 回報：`docs/area03/STAGE_3C_REPORT.md`

1. 做了什麼（簡短列點）。
2. `CHECKLIST.md` 第 3C 段逐條自查。
3. 新增與移動節點的最終 (u, v, y)，新連線的長度、最大坡度、最小身體／帽簷間隙。
4. 月亮最後的位置與半徑、夜間光線最後的數值。
5. 和規格不同的地方與理由。
6. 待釐清。
7. `draws`、`tris`（白天滿潮、夜滿潮）；console 錯誤。
8. 已知問題。

最後把所有檔案寫回使用者電腦，告訴使用者：「第 3C 段完成，請回到 Opus 對話說『驗收第 3C 段』。」
