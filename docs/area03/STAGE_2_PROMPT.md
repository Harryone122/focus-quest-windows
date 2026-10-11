# 給 Sonnet 的第 2 段指令：細節與環境生命

（使用者：貼回做第 1 段的同一個 Sonnet 對話最好；對話太長、變慢的話就開新對話，它會照清單讀檔案。把「---」之後的全部內容貼上。）

---

第 1 段（含修正）已經驗收通過，見 `docs/area03/REVIEW_1B.md`。接下來做第 2 段：**地標細節與環境生命**。湖面、倒影、天空、潮位、日夜、中央石庭都已定案，除非這一段的細節需要，不要重寫它們。

## 先讀

1. `docs/area03/REVIEW_1B.md`
2. `docs/area03/SPEC.md` 的 **2.5 節**（這一段的完整規格），以及 2.2 的位置表
3. `docs/area03/CHECKLIST.md` 的「第 2 段」
4. 如果是新對話：再讀 `docs/area03/DECISIONS.md`，並用 `device_stage_files` 取得目前的 `docs/prototypes/reflection-lake.html` 當起點

## 硬規則（同前）

- 只能寫：`docs/prototypes/reflection-lake.html`、`previews/area03-stage-2/` 的截圖、`docs/area03/STAGE_2_REPORT.md`。
- 規格沒寫到的設計決定列進「待釐清」，不要自己發明；**場景裡不能有任何文字或數字**。
- 不碰 git；做完就停，不開始第 3 段。
- 旅人仍然只站在 (−0.8, 0.6) 閒置，不走路；燈、路線、事件都還不做（燈 4 的長枝與燈 5 的掛鉤只做「掛點」）。

## 要做的事

照 SPEC 2.5：
1. **潮痕帶**：依世界高度染色的共用做法，所有石材與木柱共用。先做這個，再做各地標細節。
2. **各地標細節**：半沉亭、水位標尺、蘆葦洲與小船、石拱門、松岩（含燈 4 長枝）、中央石庭的碎石與石碑水痕、缺板積水、石環的自然大石、棧道與踏石、沉階漸層。
3. **環境生命**：白鷺、魚跳與潮池魚影、蜻蜓、螢火蟲、水面閃光、風。全部用 `tAcc` 時鐘（暫停凍結），減少動態效果時降低頻率或停止。白鷺在 `window.__lake` 加一個 `egret(state)` 測試入口（`'stand'|'walk'|'peck'|'preen'|'fly'|'sleep'`），截圖用。
4. **效能**：新增的東西盡量合併網格或用 InstancedMesh（蘆葦、貝殼、碎石、螢火蟲）。`draws` 上限 250。

## 截圖：`previews/area03-stage-2/`（1600×900）

| 檔名 | 內容 |
| --- | --- |
| `day-low.png`、`day-high.png` | 白天退潮／滿潮，全圖 |
| `dusk-low.png`、`night-high.png` | 黃昏退潮、夜滿潮，全圖（夜要看得到螢火蟲與倒影） |
| `zoom-pavilion-low.png` | 亭子約 2.5 倍，白天退潮（瓦、簷、鏡框、鏡片、掛鉤） |
| `zoom-gauge-low.png` | 水位標尺與小船約 2.5 倍，白天退潮（刻痕、空白石面、潮痕帶、撐篙） |
| `zoom-gauge-high.png` | 同上，白天滿潮（水面剛好到潮痕帶上緣） |
| `zoom-arch-low.png` | 石拱門約 2.5 倍，白天退潮 |
| `zoom-pine-low.png` | 松岩約 2 倍，白天退潮（長枝末端的位置要看得出來） |
| `zoom-terrace-low.png` | 中央石庭約 2 倍，白天退潮（石碑水痕、缺板積水、碎石） |
| `zoom-ring-low.png` | 石環小洲約 2.5 倍，白天退潮 |
| `egret-stand.png`、`egret-peck.png`、`egret-fly.png`、`egret-sleep.png` | 白鷺約 3 倍特寫，前三張白天、最後一張夜 |
| `fish-ripple.png` | 白天退潮，約 2 倍，剛好有一個魚跳的水花 |

截完先自己看過，對照 `CHECKLIST.md` 第 2 段。

## 回報：`docs/area03/STAGE_2_REPORT.md`

1. 做了什麼（簡短列點）。
2. `CHECKLIST.md` 第 2 段逐條自查。
3. 偏離規格的地方與理由；燈 4 長枝末端與燈 5 掛鉤的**實際世界座標**（第 3 段要用）。
4. 待釐清。
5. 白天滿潮全圖的 `draws`、`tris`；console 錯誤。
6. 已知問題。

最後寫回使用者電腦，告訴使用者：「第 2 段完成，請回到 Opus 對話說『驗收第 2 段』。」
