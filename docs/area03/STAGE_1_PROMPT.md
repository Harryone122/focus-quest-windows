# 給 Sonnet 的第 1 段指令：倒影湖畔的地形、湖面、天空、倒影、潮位與日夜

（使用者：把下面「---」之後的全部內容貼進新的 Sonnet 對話。）

---

你要幫一個 Windows 專注遊戲「Focus Quest」做第三張地圖「倒影湖畔」的**網頁原型**。設計已經由另一個對話（Opus）決定好，你的工作是**照規格實作**，不做設計決定。這是六段中的第 1 段，做完就停，交回報，等驗收。

## 1. 專案位置與讀取方式

專案在使用者電腦上：`C:\Users\User\Documents\game project\focus-quest-windows`。這個對話連著使用者的電腦：
1. 用 `device_request_folder_access` 申請 `C:\Users\User\Documents\game project`（使用者會按同意）。
2. 用 `device_stage_files` 把需要的檔案複製進你的雲端工作區，在工作區裡編輯、截圖。
3. 做好的檔案用 `device_commit_files` 寫回使用者電腦（`stagedPath` 必須在 `/mnt/user-data/outputs/` 底下）。

## 2. 先讀這些（依序）

1. `docs/area03/DECISIONS.md`：使用者已定案的事，最優先。
2. `docs/area03/SPEC.md`：完整規格。**第 0–4、6 節是這一段要做的**；第 5、7 節先了解就好。
3. `docs/area03/CHECKLIST.md` 的「第 1 段」：Opus 會照這份逐條驗收。
4. `docs/prototypes/moss-station.html`：第二張地圖的原型，約 5400 行。它是你的**骨架**：渲染器、光源、`lampParts`、旅人模型與姿勢表、時鐘與 `timeOfDayAt`、鏡頭與拖曳、介面列、主迴圈、`window.__moss` 測試介面都可以沿用。

不需要讀企畫書或其他文件。

## 3. 硬規則

1. **只能寫這些檔案：**
   - `docs/prototypes/reflection-lake.html`（新檔，你的原型）
   - `previews/area03-stage-1/` 底下的截圖
   - `docs/area03/STAGE_1_REPORT.md`（你的回報）
   其他檔案一律不准改，包括 `moss-station.html`、`src/`、企畫書和 `docs/area03/` 裡的其他檔案。另一個程式 agent（Codex）正在同一個資料夾工作。
2. **規格沒寫到的設計決定，停下來寫進回報的「待釐清」，不要自己發明。** 規格允許的微調（例如座標 ±0.5、配色依畫面調整）可以做，但要在回報裡列出來。
3. 不准執行 `git` 的 `reset`、`clean`、`stash`、`checkout`，也不要 `git add`／`commit`。
4. 做完第 1 段就停，不要開始第 2 段。

## 4. 這一段要做的事

### 4.1 建立檔案
把 `moss-station.html` 複製成 `reflection-lake.html`，然後：
- 標題、說明文字、`aria-label` 換成倒影湖畔（`AREA 03 · FOCUS 50:00`、`倒影湖畔`、一句說明：一片映著天空的淺湖，漲潮時整張地圖會變成一面鏡子）。
- **刪掉苔痕驛站的場景內容**：建築、鐵軌、森林、霧海、溪流與瀑布、雨、苔、事件、特殊發現、故事事件、離開動畫、示範排程器。內嵌的 `area-data` JSON 換成這張的最小資料（`areaId: "area-03-reflection-lake"`、`title`、`plannedMinutes: 50`，其他之後再加）。
- **保留引擎**：數學與噪聲、時段配色的結構（改成本張的值）、渲染器、光源、`lampParts`（之後的燈用）、旅人模型與姿勢表、時鐘、鏡頭、拖曳、介面列、主迴圈、背景 watchdog。
- 旅人這一段只需要**站在中央石台 (−0.8, 0.6) 閒置**，當比例尺並檢查他的倒影；不必走路。
- 介面列：「試看下雨」換成「試看漲潮」（在退潮與滿潮之間切換，約 4 秒漸變）；天氣顯示改成潮位（退潮／漲潮中／滿潮／退潮中 · 時段）。「試看特殊發現」「試看新事件」「試看離開」「旅途筆記」先拿掉。速度、時段按鈕、開始／暫停、重來保留。
- 旅人仍依 `sim` 跑日夜；潮位依 SPEC 4.1 的 `tideAt(seed, sim)`。「試看漲潮」按下後改由手動覆蓋，再按一次或按「重來」回到依時間。

### 4.2 地形與地標量體
依 SPEC 第 2 節做地形與地標的**量體**（形狀、比例、位置、高度正確即可，細節在第 2 段）：蘆葦洲、中央石台（含兩根倒柱、一根斷柱、石碑）、沉階、三條棧道與所有踏石、亭台與半沉亭（含石桌、長凳、破鏡框）、石拱門、松岩與老松、長踏石串、石環小洲與 14 顆環石、水位標尺、擱淺小船。蘆葦先放少量簡單的叢，第 2 段再做完整。

高度一定要照 SPEC 2.1：退潮時石台、棧道、踏石要高出水面，滿潮時要淹在水下。

### 4.3 湖面、天空、倒影（這一段的重點）
完全照 SPEC 第 3 節：
- 三種可見性用 `layers`（主畫面 layer 0＋2、倒影 layer 0＋1），並放一個「只在倒影」的測試方塊在 (3.5, −2.0)（可用網址參數 `?reflTest=1` 開啟，預設關閉）。
- 倒影相機每幀跟主相機同步（含 `zoom`、拖曳偷看），對 `y = WL` 鏡射；裁掉水面以下；畫到一半解析度、透明底的 render target。
- 湖面 shader：程序化天空（底色＋上緣薄霞＋漂移的雲＋夜裡的星星）上面疊倒影；水深貼圖；淺水透底；岸邊濕線；風紋（退潮時細紋、滿潮時幾乎靜止）；石環內完全靜止；遠處擾動漸弱；平面至少 600×600。
- 所有動態（雲漂、風紋、閃爍）用和苔痕驛站一樣的 `tAcc` 時鐘，暫停時凍結。
- 系統「減少動態效果」時，雲漂與風紋降到苔痕驛站 `MOTION` 的比例。

### 4.4 潮位與濕度
- 實作 SPEC 4.1 的 `tideAt(seed, sec)`（純函式，同樣的輸入一定得到同樣的輸出），原型固定 `seed = 20260930`，網址參數 `?seed=` 可換。
- `WL` 驅動湖面高度、倒影鏡射面、裁切面、水深計算。
- 被淹過的石頭與泥變濕（深色、稍反光），退潮後 240 秒慢慢變乾（參考苔痕驛站的 `applyWet`）。
- 路網與旅人的涉水是第 3 段的事，這一段不做。

### 4.5 時段
依 SPEC 第 6 節設定四個時段的天空、薄霞、雲、光線；沿用 `timeOfDayAt` 的平順漸變。`body.paper` 的切換（清晨與白天用淺色介面）照舊。

### 4.6 測試介面
把 `window.__moss` 改名為 `window.__lake`，至少提供：
- `setTime(key)`：`'dawn'|'day'|'dusk'|'night'|'auto'`
- `setTide(level)`：0–1，手動覆蓋潮位；`setTide(null)` 回到依時間
- `setSim(sec)`、`advance(realSeconds)`（讓雲漂和漸變往前走，截圖用）
- `focus(u, v, y, vw, el)`、`drag(yawOff, pitchOff)`、`render()`
- `state()`：回傳 `sim`、潮位 `{ level, phase, wet }`、`WL`、`draws`、`tris`
- 維持 `?qa=1` 時不跑 `requestAnimationFrame`、`window.__ready = true` 的做法。

## 5. 截圖

在雲端工作區用 Playwright 截圖（這台工作區的網路擋掉 cdnjs 與 Google Fonts，所以要把 three.js 換成本地檔）：

```bash
mkdir -p ~/lakeqa && cd ~/lakeqa && npm init -y >/dev/null && npm i playwright-core three@0.128.0
```

```js
// 重點：用內建的 Chromium 與 swiftshader；把 cdnjs 的 three.min.js 導到本地；擋掉字型
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
await page.route('**/cdnjs.cloudflare.com/**/three.min.js', (r) => r.fulfill({ path: 'node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto('file://.../reflection-lake.html?qa=1');
await page.waitForFunction('window.__ready === true', null, { timeout: 240000 });
```

存到 `previews/area03-stage-1/`，檔名如下（沒特別註明的都是 1600×900）：

| 檔名 | 內容 |
| --- | --- |
| `day-low.png`、`day-high.png` | 白天，退潮／滿潮 |
| `dawn-low.png`、`dawn-high.png` | 清晨 |
| `dusk-low.png`、`dusk-high.png` | 黃昏 |
| `night-low.png`、`night-high.png` | 夜 |
| `tide-rising.png` | 白天，潮位 0.5 |
| `day-low-1280.png` | 1280×800，白天退潮 |
| `drag-left.png`、`drag-right.png`、`drag-up.png`、`drag-down.png` | 白天滿潮，拖曳偷看到四個極限 |
| `zoom-pavilion.png` | 白天滿潮，`focus` 對準亭子、約 2 倍放大 |
| `zoom-ring.png` | 白天退潮，對準石環小洲、約 2 倍放大 |
| `refl-only.png` | 白天滿潮，`?reflTest=1` |
| `clouds-a.png`、`clouds-b.png` | 白天滿潮，同一個畫面相隔 `advance(20)` |
| `wet-after.png` | 白天，滿潮結束後 60 秒（石頭應該還是濕的） |

截完**自己先看過每一張**，對照 `CHECKLIST.md` 第 1 段；自己看得出不通過的，先修再截。

## 6. 回報：`docs/area03/STAGE_1_REPORT.md`

用繁體中文，包含：
1. **做了什麼**：簡短列點。
2. **自我檢查**：`CHECKLIST.md` 第 1 段每一條，你認為通過或不通過，一句理由。
3. **偏離規格的地方**：座標微調、配色最後的值、任何和 SPEC 不同的做法與原因。
4. **待釐清**：規格沒寫清楚、你沒有自己決定的問題。
5. **數據**：`state()` 在白天滿潮時的 `draws`、`tris`；截圖時的 console 錯誤（沒有就寫「無」）。
6. **已知問題**：還沒做好或看起來不理想的地方。

最後用 `device_commit_files` 把 `reflection-lake.html`、全部截圖和回報寫回使用者電腦的對應位置，然後告訴使用者：「第 1 段完成，請回到 Opus 對話說『驗收第 1 段』。」
