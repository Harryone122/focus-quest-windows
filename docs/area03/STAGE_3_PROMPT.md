# 給 Sonnet 的第 3 段指令：路網、五盞燈、旅人與示範排程器

（使用者：貼回做第 2 段的同一個 Sonnet 對話最好；對話太長、變慢的話就開新對話，它會照清單讀檔案。把「---」之後的全部內容貼上。）

---

第 2 段已經驗收通過，見 `docs/area03/REVIEW_2.md`。接下來做第 3 段：**路網與場景 JSON、五盞燈、旅人走路與涉水、示範排程器**。湖面、倒影、天空、潮位、日夜、地標細節、環境生命都已定案，除了這一段指定的地方，不要重寫。

這一段比前兩段大。Opus 已經在第 2 段的原型上實測過節點的位置（走面高度、有沒有被擋住），也找出三個會擋路的場景物件，所以規格裡的座標大多可以直接用。

## 先讀

1. `docs/area03/REVIEW_2.md`（三項小修）
2. `docs/area03/SPEC.md` 的**第 5 節**（五盞燈，已修訂）、**第 8 節**（路網與旅人，這一段的主規格）、4.3 節，以及 2.2、2.4 節裡標 2026-09-30 的修改
3. `docs/area03/CHECKLIST.md` 的「第 3 段」
4. 前一張地圖的做法（只讀這些段落）：
   - `docs/AREA_02_MOSS_STATION_EVENTS.md` 的 §4 路網、§5 五盞燈、§9 等燈小動作、§20 穿模
   - `docs/area-02-moss-station.scene.json`（JSON 欄位的寫法）
   - `docs/prototypes/moss-station.html` 的 demo planner 一段（搜尋 `the demo planner`，約第 5085–5210 行）、`lampParts`、`walkTo`、旅人走路與姿勢的部分
   - `docs/handoff/area02-story-events/qa/occ.js`（穿模檢查的寫法）
5. 如果是新對話：再讀 `docs/area03/DECISIONS.md`，並用 `device_stage_files` 取得目前的 `docs/prototypes/reflection-lake.html` 當起點

## 硬規則

1. **只能寫這些檔案：**
   - `docs/prototypes/reflection-lake.html`
   - `docs/area03/area-03-reflection-lake.scene.json`（新檔）
   - `docs/area03/qa/` 底下的檢查程式與結果（新資料夾）
   - `previews/area03-stage-3/` 的截圖
   - `docs/area03/STAGE_3_REPORT.md`
   其他檔案一律不准改（包括 `SPEC.md`、`moss-station.html`、`src/`、企畫書）。Codex 可能正在同一個資料夾工作。
2. 規格沒寫到的設計決定列進「待釐清」，不要自己發明。**場景裡不能有任何文字或數字**（狀態列等介面文字可以）。
3. **場景物件只能改 SPEC 8.3 第 6 條列的三項**（燈 3 石墩、東石階、路線旁的蘆葦）。節點可以移動 ±0.4，via 自由安排，全部寫進回報；超過就列進「待釐清」。
4. 不碰 git；做完就停，不開始第 4 段（事件、休息活動、離開動畫、特殊發現都還不做）。

## 要做的事（依序）

### 1. 第 2 段的三項小修（`REVIEW_2.md`）
1. 水面閃光：只在太陽方位的一條窄帶裡，數量約五分之一，每點淡入淡出；滿潮略多（規格見 SPEC 2.5 的環境生命表）。
2. 鏡框移到亭子**西南側**欄杆（亭子局部座標中邊 3、朝 210° 的那一面，面向鏡頭），掛在欄杆外側；預設 31° 視角要看得到框和鏡片。鏡片閃光照舊。
3. 缺板積水改成順著缺板邊緣的不規則形狀。

### 2. 兩項場景修正（SPEC 8.3 第 6 條）
1. 燈 3 的大石墩從棧道中央移到東側 (1.90, 6.50)，沿棧道長 1.0 × 往外 0.8、頂 0.40；刪掉和它重疊的小石墩。
2. 東石階從 (1.5, 1.6) 移到 (1.45, 0.60)。原位置被倒柱西南端擋住。

### 3. 路網與走路
1. 照 SPEC 8.1、8.2 建立節點與連線。先寫一個「看得見的表面」高度函式（往下打射線，SPEC 8.3 第 1 條），所有節點的 `y` 和 via 的高度都用它量。
2. 走路：沿用苔痕驛站的步伐與姿勢；加上跳踏石 `hop`、爬坡前傾 `climb`（SPEC 8.3 第 2、4 條）。
3. 寫穿模檢查（SPEC 8.3 第 5 條），跑過整張路網與所有站位，調整 via 和節點直到全部通過。結果存成 `docs/area03/qa/clearance.json`（每條連線的最小身體間隙、最小帽簷間隙、最大坡度、最大落差），檢查程式也放在 `docs/area03/qa/`。
4. 寫出 `docs/area03/area-03-reflection-lake.scene.json`（SPEC 8.9），並內嵌同一份到原型的 `area-data`。

### 4. 五盞燈
照 SPEC 第 5 節做五盞燈。燈 4 掛在 `__lake.marks().lamp4` 的枝尖，要跟著松枝一起擺；燈 5 掛在 `lamp5` 的鐵環，**燈身底 ≥ 1.42**。燈依 `sim` 準時亮，不跟著動畫（第 5 節「燈跟著有效時間亮」那一條）。

### 5. 涉水、漲潮反應、等燈小動作、白鷺
照 SPEC 8.4、8.5、8.6。波紋在湖面 shader 裡做（擾動倒影＋很淡的亮線），不要另外疊半透明網格；水花只在主畫面。新姿勢（`hop`、`climb`、`rollCuff`、`lookDown`、`gazeDown`、`spin`、`hopStones`）加進姿勢表。

### 6. 示範排程器與測試入口
照 SPEC 8.8。介面列恢復五個燈號點與「跳到完成」。`?graph=1` 疊圖預設關閉、不寫字。

### 7. 效能
新增的東西盡量合併網格；`draws` 上限 250。

## 截圖：`previews/area03-stage-3/`（1600×900）

用 `__lake.goto`、`pose`、`setTime`、`setTide`、`focus` 擺好再截。

| 檔名 | 內容 |
| --- | --- |
| `graph-day-low.png` | 白天退潮全圖，`?graph=1` 路網疊圖 |
| `graph-1280.png` | 同上，1280×800 |
| `fix-glint-day-high.png` | 白天滿潮全圖（看閃光帶） |
| `fix-glint-zoom.png` | 閃光帶約 2.5 倍 |
| `fix-mirror-default.png` | 亭子約 2.5 倍、預設 31° 視角，看得到西南側鏡框與鏡片 |
| `fix-puddle.png` | 石庭缺板積水約 3 倍，白天退潮 |
| `lamps-night-high.png` | 夜滿潮全圖，五盞燈全亮（含倒影） |
| `lamps-dusk-low.png` | 黃昏退潮全圖，五盞燈全亮 |
| `lamp1.png` … `lamp5.png` | 每盞燈約 2.5 倍，白天退潮，旅人在點燈站位做 `light`（燈 4 用 `reach` 若比較自然） |
| `lamp4-high.png` | 燈 4 約 2.5 倍，白天滿潮 |
| `lamp5-night-high.png` | 燈 5 約 2.5 倍，夜滿潮，旅人正從燈下走進亭子 |
| `pier-lamp3.png` | 燈 3 石墩約 3 倍，旅人坐在 `n_pier` |
| `wade-day-high.png` | 旅人在石庭涉水走路，約 3 倍，剛落腳（波紋與倒影晃動） |
| `wade-night-high.png` | 夜滿潮，旅人走在北棧道上，約 2 倍（走在星星上） |
| `hop-low.png` | 往拱門的踏石上跳到一半，約 3 倍 |
| `climb-pine.png` | 爬松岩西北坡，約 3 倍 |
| `tide-react.png` | 漲潮反應 `rollCuff` 中段，約 3 倍 |
| `wait-reflection-high.png`、`wait-spin-high.png`、`wait-water-low.png` | 等燈小動作，約 3 倍 |
| `egret-flee.png` | 旅人約 2.4 距離、白鷺剛起飛，約 2.5 倍 |
| `rest-bench-high.png` | 旅人坐在亭內長凳，滿潮，約 2.5 倍 |
| `east-stair.png` | 石庭東側約 2.5 倍，白天退潮（新石階位置、倒柱、旁邊的路線） |

截完先自己看過，對照 `CHECKLIST.md` 第 3 段。

## 回報：`docs/area03/STAGE_3_REPORT.md`

1. 做了什麼（簡短列點）。
2. `CHECKLIST.md` 第 3 段逐條自查。
3. **節點表**：每個節點的最終 (u, v, y)，和 SPEC 8.1 不同的標出差多少、為什麼。
4. **連線表**：每條連線的類型、長度、最低走面、最大坡度、最小身體／帽簷間隙；跳踏石的最大空隙。
5. `lampLegs`（含步行秒數）與 `graphDiameter`。
6. 場景物件的修改（燈 3 石墩、東石階、刪掉或移動的蘆葦叢位置）。
7. 五盞燈的實際燈火高度與燈身底高度。
8. 新增的姿勢與它們的參數。
9. 偏離規格的地方與理由。
10. 待釐清。
11. `draws`、`tris`（白天滿潮全圖、夜滿潮五燈全亮）；console 錯誤。
12. 已知問題。

最後把所有檔案寫回使用者電腦，告訴使用者：「第 3 段完成，請回到 Opus 對話說『驗收第 3 段』。」
