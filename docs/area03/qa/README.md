# 倒影湖畔 第 3 段 QA 程式與結果

## 結果檔
- `clearance.json`：每條連線與每個站位的最小身體／帽簷間隙、最大坡度、最大落差、最大踏石空隙（46 條連線、43 個站位，全部通過）。
- `measure.json`：`check.js` 的原始輸出（含每 0.1 的走面高度、空隙、落差）。
- `graph_design.json`：路網設計（節點最終座標與每條連線的 via 點）；`graph_spec.json` 是 SPEC 8.1 的原始節點。
- `lamps_measured.json`：五盞燈的實測火焰高度與燈身底高度。

## 重跑
```
npm install            # playwright-core、three@0.128、three-mesh-bvh
node check.js graph_design.json measure.json     # 對 ../../prototypes/reflection-lake.html 重新量一次
node lamp5-hat-test.js                            # 燈 5 與旅人各部位的網格對網格測試
python3 build_scene.py                            # 由 graph_design.json + measure.json + lamps_measured.json 產生 ../area-03-reflection-lake.scene.json
```
- `check.js` 有問題的連線／站位會印出來，沒有輸出＝全部通過。`LAKE_FILE=路徑` 可指定別的 HTML。
- 需要 Chromium。`h.js` 在 Windows 預設使用 `C:/Program Files/Google/Chrome/Application/chrome.exe`，其他平台維持 `/opt/pw-browsers/chromium`；可用 `LAKE_BROWSER` 環境變數指定路徑。`h.js` 從 `node_modules/three` 提供 three.js，不連外網。
- Codex 獨立驗收：`node codex-acceptance.cjs`；結果與截圖在 `previews/area03-codex-acceptance/`。重測路網請另存：`node check.js graph_design.json measure-codex.json`，保留原始交付的 `measure.json`。
- 2026-10-01 加入兩個使用者核准的小區域後，現行原型使用 `graph-tidal.json`，48 個節點、51 條邊、23 個互動點。請用 `node check.js graph-tidal.json measure-tidal.json`，再執行 `python bake-tidal-routes.py` 同步新增路線走面到 JSON／HTML，最後執行 `node codex-acceptance.cjs`。原本的 `build_scene.py` 只對應第 3 段交付，不應覆蓋新版本。

## 程式
- `qa_lib.js`：BVH 射線（走面高度 `surfY`、間隙 `clearAt`、頭頂 `headroom`）；規則：地面類面（法線 y > 0.5）、水、蘆葦、草、苔、火焰不算實心；比腳低 5 公分的東西或走面的高低邊不算；身體半徑 0.27（腳上 0.08–0.8）、帽簷半徑 0.36（腳上 1.05–1.2）、蘆葦 ≥ 0.45。
- `measure_lib.js`：逐 0.1 沿 Catmull-Rom 連線量走面與間隙，跳躍（空隙 > 0.3）與步階判定、松岩 15 公分內的隆起當步階。
- `fix.js`、`occmap.js`、`occ_render.py`、`plan.py`、`merge_vias.py`、`graph_design.py`、`vias_manual.json`、`node_over.json`、`nodes_spec.json`：設計路網用的工具（佔用格圖 → 規劃 via → 最佳化 → 手動修正）。重現設計需要重新產生佔用格圖，不是驗收必要的步驟。
- `lamp5-hat-test.js`：走過燈 5 底下（0–1.3、5 個步伐相位）時，旅人每個網格與燈 5 外框是否相交。
