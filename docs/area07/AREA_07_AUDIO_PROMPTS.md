# 玻璃苗圃（07）音效：審查與 ElevenLabs prompt（第二版）

日期：2026-10-07。設計者：Claude。生成者：使用者（ElevenLabs）。整合者：Codex（等使用者說開始）。**我沒有聽過任何這張圖的音檔。**

## 0. 第二版改了什麼（使用者 2026-10-07 回饋）

使用者回饋兩件事：
- prompt 不該描述情境，要直接說要什麼聲音。例如「玻璃被風吹」實際上沒有聲音，寫進去只會生出奇怪的聲音。
- 生成的音質很差。

**改法：**
1. 每則 prompt 只寫**一個實際會發出聲音的東西**：材質＋動作＋聲音。不寫地點（溫室、荒廢）、氣氛、時間。地點的空間感由 Codex 在混音時處理。
2. 依實際物理重審一次，下面這些是第一版寫了、實際上不會發聲的，**全部拿掉**：
   - 玻璃被風吹。
   - 「中空的空間感」。
   - 遠處的幫浦（畫面看不到）。
   - 苗長大的聲音（植物長大不發聲）：`nursery_tray_grow` 刪除。
   - 鐘罩開門時的鍊條（原型只有掛鎖）。
   - 門打開時玻璃格震動。
3. 混在一起的聲音拆開，一則一個聲源（ElevenLabs 官方也建議分開生成再組合）：
   - 機器拆成「轉動」`nursery_turn_loop` 與「噴霧」`nursery_spray_loop`。
   - 核心拆成「掛鎖」「籠門」「鐘罩抬起」「縮小的光」四個。
   - 閥門只留「轉動的吱聲」，噴霧改由 `nursery_spray_loop` 在那幾秒加大。
4. 音質（見 §1）。

## 1. 為什麼音質差，以及 prompt 能做的事

我量了 `audio-incoming/` 裡幾個舊檔，問題有三種：
- **太小聲**：
  - 涉水、倒茶、泥土腳步的最大聲只有約 −26 到 −34 dBFS。整合時要放大很多倍，底噪和雜訊就跟著被放大。
  - 原因之一是 prompt 寫了很多 quiet、very quiet、faint。**音量是混音決定的，不該寫進 prompt。**第二版全部拿掉。
- **悶**：倒茶 99% 的能量在 1.5 kHz 以下，泥土腳步在 5 kHz 以下，聽起來像隔了一層布。
- **高頻怪聲**：`stone_step_dry_a` 的 12–16 kHz 比 8–12 kHz 大 16 dB，這通常是 AI 生成的金屬嘶聲。

第二版 prompt 的寫法：
- **開頭固定寫品質**。這是 ElevenLabs 說明文件建議的寫法（「high-quality, professionally recorded … sound effects foley」）：
  - 動作聲：`High-quality professional foley recording, close-mic, dry, clean and detailed:`
  - 環境：`High-quality professional stereo field recording, clean and detailed:`
- **結尾固定**：`Isolated sound, no background noise.`。不再列一長串 no birds、no voices：寫出來的詞反而可能被生出來。
- 不寫 quiet。soft 只用在材質（例如 soft boot step），不用在音量。

生成設定（這些也會影響音質）：
- **環境循環開 Loop、下載 WAV 48 kHz**：使用者 2026-10-07 確認，開 Loop 也能下載 WAV（官方文件寫只有 MP3，已過時）。所以五個環境循環（leaves、turn、spray、drip、night）都開 Loop；鳥不是循環，維持關閉。
- **秒數設成動作的實際長度**：一發音效不要用自動長度，也不要設太長，多出來的時間 AI 會自己補怪聲。
- **Prompt influence 60–70%**：越高越照字面，比較不會加料。
- 每次生成 4 版，**戴耳機挑**：
  - 選高頻乾淨、沒有金屬嘶聲、沒有「水底下」那種悶的。
  - 都不行就重生，不要將就。

## 2. 不用重新生成：沿用既有的檔

| 用在哪裡 | 沿用 |
| --- | --- |
| 地面與玻璃連廊的腳步 | `stone_step_dry_a／b／c` |
| 蹲下、起身、坐上轉盤 | `dep_cloth_kneel`、`dep_cloth_rise` |
| 休息時寫筆記 | `dep_notebook_close` |
| 信物取得 | `tone_item_d4` |
| 線索取得 | `tone_clue_g4`（批次 7，尚未生成） |
| 移植結局最後一下（提案） | `tone_lantern_c4`（批次 7，尚未生成） |
| 和弦墊 | `pad_csus2_loop`（批次 7，尚未生成） |
| 夜裡的蟲 | **不用**（使用者 2026-10-07：蟋蟀太吵）。夜裡只有滴水與鐵框冷縮的輕響 |

批次 7 的 prompt 在 `AUDIO_ASSET_PROMPTS.md`。生成時建議照本文件 §1 的方式，在開頭加品質描述。

## 3. 會出現的聲音與混音

**刻意沉默**：
- 燈柱（旅途中不加聲音，§3b）。
- 光柱與月光柱。
- 霧（用濾波表現，不另做檔）。
- 苗長大、抬頭看樹、看積水池。
- 空中走道。

**環境**：

| 時段與霧 | 葉子 leaves | 轉動 turn | 噴霧 spray | 滴水 drip | 鳥 |
| --- | --- | --- | --- | --- | --- |
| 晨（機器重啟） | 0.6 | 淡入 | 淡入 | 0.4 | 1（每次抽約 5 秒，間隔 16–34 秒） |
| 日 | 0.8 | 1 | 1 | 0.3 | 0.7 |
| 暮 | 0.6 | 淡出，播 `machine_stop` | 淡出 | 0.5 | 0.22 |
| 夜 | 0.4 | 0 | 0 | 1 | 0 |
| 夜（起濃霧） | 0.4 並低通 | 0 | 0 | 1.4 | 0 |
| 早晨霧從中心旋開 | 低通隨 `SIM.vortex` 打開（60–90 秒） | 隨 `machine_start` | 隨重啟 | 0.4 | 漸入 |

- 數值是設計目標，以試聽為準。滑桿是環境音，曲線 1.4 次方。
- 溫室的空間感，由 Codex 對 leaves、drip、鳥加一點短的殘響。
- 休息坐在轉盤上：turn 升到約 1.2、leaves 降到 0.6。

**一發音效**：

| 檔案 | 什麼時候 |
| --- | --- |
| `nursery_machine_start`／`stop` | 夜→晨轉盤開始轉／暮→夜停下 |
| `nursery_disc_step`（2 版） | 踏上轉盤、出發時跨下 |
| `nursery_key_unhook` → `nursery_padlock_open` → `nursery_cage_door` → `nursery_jar_lift` → `nursery_jar_shrink` → `core_motif_07` | 核心：取鑰匙、開鎖、開籠門、鐘罩抬起、縮小收進行李、旋律。演出中環境壓到 30% |
| `nursery_tray_water` | 首訪（灑水臂澆空盤）；移植結局最後一段 |
| `nursery_chart_trace` | 第二次造訪，手指順著刻度摸 |
| `nursery_chart_mark`（2 版） | 移植結局畫三條新刻度 |
| `nursery_soil_scoop`、`nursery_soil_press` | 扶正盆栽後半段撥土；種下幼苗；移植挖起與種下 |
| `nursery_pot_upright` | 扶正盆栽前半段 |
| `nursery_glass_wipe` | 擦玻璃；背銀鏡片事件 |
| `nursery_book_leaf`、`nursery_cloth_pat` | 壓葉標本、護根布，之後接 `tone_item_d4` |
| `nursery_sapling_leaf` | 種下幼苗、移植完成；收藏室 07 長高（§9.3） |
| `nursery_valve_squeak` | 轉閥門；同時 `nursery_spray_loop` 加大約 3 秒 |
| `nursery_door_iron` | 出口一：玻璃連廊鐵門 |
| `nursery_ladder_step`（3 版） | 出口二：下鐵梯約 4 步 |
| C 批 `glass_tick`、`fern_brush`、`trough_flick` | 夜裡鐵框冷縮的輕響；穿過蕨類；撥水槽（選用） |

## 4. prompt

全部確認在 450 字元以內。檔名＝標題列的 ID；標「留 N 版」的存成 `_a`、`_b`、`_c`；全部下載 WAV，放進 `game project/audio-incoming/`。

### A 批：環境、機器、核心（12 個＋旋律）

```
nursery_leaves_loop · 30 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: large broad tropical leaves rustling softly and continuously in a gentle indoor breeze, slow soft swells. Steady and even, no sudden events, no background noise.

nursery_turn_loop · 30 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: a heavy old iron rotating platform turning very slowly on a worn bearing, a low smooth rumble with an occasional soft metal creak. Steady and even, no sudden events, no background noise.

nursery_spray_loop · 30 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: fine water mist spraying steadily from small metal nozzles, a soft even hiss with light droplets pattering on leaves and soil. Steady and even, no sudden events, no background noise.

nursery_drip_loop · 30 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: single water drops falling slowly and irregularly into a shallow puddle on stone, sparse clear plinks with silence between drops. No background noise.

nursery_machine_start · 6 秒 · Loop 關 · influence 65%
High-quality professional recording, clean and detailed: a heavy old iron rotating platform starting up, a low metal groan and a soft gear clunk, then slow steady turning. Isolated sound, no background noise.

nursery_machine_stop · 5 秒 · Loop 關 · influence 65%
High-quality professional recording, clean and detailed: a heavy old iron rotating platform slowing down to a stop, the turning winds down with a soft metal grind and ends with one low clunk. Isolated sound, no background noise.

nursery_disc_step · 0.6 秒 · Loop 關 · influence 70% · 留 2 版
High-quality professional foley recording, close-mic, dry, clean and detailed: one soft boot step onto a metal grate floor, a light hollow metallic tap. Isolated sound, no background noise.

nursery_key_unhook · 1 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a small brass key lifted off a nail, a tiny metal scrape and a soft jingle. Isolated sound, no background noise.

nursery_padlock_open · 1.2 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a small old iron padlock unlocking, a key turning and the shackle clicking open. Isolated sound, no background noise.

nursery_cage_door · 2.5 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a small iron cage door swinging open slowly, one long low rusty hinge creak. Isolated sound, no background noise.

nursery_jar_lift · 2 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a large glass bell jar lifted off a wooden base, a soft glass-on-wood scrape and a faint glass ring. Isolated sound, no background noise.

nursery_jar_shrink · 4 秒 · Loop 關 · influence 50%
High-quality cinematic sound design, clean and detailed: a soft high crystalline shimmer that swells gently, then shrinks smaller and smaller into one tiny sparkle. Magical and delicate, no melody. Isolated sound, no background noise.
```

```
core_motif_07 · 6 秒 · 用 Eleven Music
Solo soft wooden marimba, no accompaniment, no drums, no vocals. A slow gentle four-note phrase G4, C5, D5, G5 in C major at about 50 BPM, the last note held and fading naturally. About 6 seconds, clean high-quality studio recording, dry with very little reverb. Tender and simple.
```

### B 批：事件與動作（14 個）

```
nursery_tray_water · 4 秒 · Loop 關 · influence 65%
High-quality professional foley recording, close-mic, dry, clean and detailed: a thin stream of water pouring steadily onto wet soil, soft patter and small trickles. Isolated sound, no background noise.

nursery_chart_trace · 3 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a fingertip sliding slowly over a row of small carved notches in a wooden board, soft quick ticks, then it stops. Isolated sound, no background noise.

nursery_chart_mark · 1 秒 · Loop 關 · influence 70% · 留 2 版
High-quality professional foley recording, close-mic, dry, clean and detailed: one short stroke of a charcoal stick on dry wood, a soft dry scratch. Isolated sound, no background noise.

nursery_soil_press · 2.5 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: hands pressing and patting damp soil, soft muffled pats and crumbling earth. Isolated sound, no background noise.

nursery_soil_scoop · 3 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: hands scooping loose soil and dropping it into a clay pot, three slow scoops, soft earth sifting. Isolated sound, no background noise.

nursery_pot_upright · 3 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a heavy terracotta pot dragged on stone tiles and tipped upright, a ceramic scrape and one dull knock. Isolated sound, no background noise.

nursery_glass_wipe · 2 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a cloth sleeve wiping a wet glass window, two slow squeaky strokes. Isolated sound, no background noise.

nursery_book_leaf · 2 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: an old book opened and two brittle pages turned, then a dry pressed leaf lifted with a faint papery crinkle. Isolated sound, no background noise.

nursery_cloth_pat · 1.5 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a folded burlap cloth picked up and patted twice, soft dull cloth pats. Isolated sound, no background noise.

nursery_sapling_leaf · 1.2 秒 · Loop 關 · influence 65%
High-quality professional foley recording, close-mic, dry, clean and detailed: a few small fresh leaves rustling briefly, soft and delicate. Isolated sound, no background noise.

nursery_valve_squeak · 2 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: an old rusty iron valve wheel turned by hand, a dry metal squeak and a slow grind. Isolated sound, no background noise.

nursery_door_iron · 3 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a heavy old iron door pushed open slowly, one long low rusty hinge creak, then a soft stop. Isolated sound, no background noise.

nursery_ladder_step · 0.5 秒 · Loop 關 · influence 70% · 留 3 版
High-quality professional foley recording, close-mic, dry, clean and detailed: one soft boot step on an iron ladder rung, a dull light metallic clank. Isolated sound, no background noise.

nursery_birds_day · 30 秒 · Loop 關 · influence 55%
High-quality professional stereo field recording, clean and detailed: a few small songbirds chirping at a distance, sparse short calls with long silences between them. No background noise.
```

### C 批：選用（4 個）

```
nursery_glass_tick · 0.5 秒 · Loop 關 · influence 65% · 留 3 版
High-quality professional foley recording, close-mic, dry, clean and detailed: one tiny faint metallic tick of an iron frame contracting. Isolated sound, no background noise.

nursery_fern_brush · 0.7 秒 · Loop 關 · influence 70% · 留 3 版
High-quality professional foley recording, close-mic, dry, clean and detailed: fern leaves brushing against a cloth trouser leg, one gentle quick leafy swish. Isolated sound, no background noise.

nursery_trough_flick · 1 秒 · Loop 關 · influence 70%
High-quality professional foley recording, close-mic, dry, clean and detailed: a fingertip flicking water in a small stone basin, a tiny soft splash and a few drops. Isolated sound, no background noise.

nursery_night_loop · 30 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: a few crickets chirping softly at a distance, sparse and slow. Steady and even, no sudden events, no background noise.
```

## 5. 驗收重點

- 戴耳機聽：高頻乾淨、沒有金屬嘶聲、不悶、沒有多出來的聲音（鳥、人聲、音樂）。
- 環境的 30 秒裡不要有突然的大聲事件。
- 一發音效的主聲要清楚，尾巴乾淨。
- `core_motif_07`：音是 G、C、D、G。差半音內照收，Codex 校正。

## 6. 給 Codex（等使用者說開始）

- 流程同 `AUDIO_DESIGN_HANDOFF.md` §10：先出試聽，使用者確認後才整合；不自己合成或生成聲音；缺檔就不播。
- 五個環境是 ElevenLabs 生成的循環 WAV，直接無縫循環；如果接縫仍聽得出，才用 2 秒交叉淡化修（同倒影湖畔）。
- 聲音只由既有狀態驅動（`moodAt`、`SIM.vortex`、轉盤狀態、事件 cue）。暫停、重開、快轉時直接就位，不補播。
- 多版本先標準化響度再隨機挑，不連續重複同一版。前景最多 3 個。
- 溫室的空間感用短殘響統一加在環境層，事件聲保持乾。

## 7. 檔案檢查（Claude，2026-10-07；用數據量，沒有聽）

使用者已生成全部檔案，`nursery_night_loop` 不做（蟋蟀太吵），夜裡也不用 `lake_night_insects_loop`。

- **齊全**：A、B、C 批的 29 則都在，共 39 個檔（含多版本）；沒有重複檔。全部 48 kHz、16-bit、立體聲 WAV。
- **檔名**：`nursery_glass_tick _a`、`_b` 檔名多了一個空格，已改成 `nursery_glass_tick_a`、`_b`。
- **整體音量**：比倒影湖畔那批好很多。大部分有效段 RMS 在 −14 到 −30 dBFS，第二版 prompt 拿掉 quiet 有效。
- **長度**：leaves、turn、spray 三個循環是 20 秒（不是 30 秒），可以用。

**要重生的（4 個）**：

| 檔案 | 問題 | 怎麼做 |
| --- | --- | --- |
| `core_motif_07` | 不是四個音的旋律，只有開頭一下 C4＋G4，接著一路衰減 6 秒 | 用 **Eleven Music**（不是 Sound Effects）重生，用下面第二版 prompt；或交給 Codex，把這一下乾淨的木琴音移調排成 G4、C5、D5、G5（03 湖鏡做過同樣的事） |
| `nursery_turn_loop` | 99% 能量在 205 Hz 以下，只有低頻隆隆聲，沒有金屬吱嘎聲；筆電喇叭幾乎聽不到，看不出是轉盤 | 用第二版 prompt 重生 |
| `nursery_disc_step_a`／`_b` | 很小聲（峰值 −29／−33 dBFS）；`_b` 悶（1 kHz 以下）而且後面拖著一段 −51 dB 的嗡聲 | 用第二版 prompt 重生 |
| `nursery_machine_start` | 削波 632 個取樣點，最長連續 48 點，在 1.0–1.2 秒與 4.1–4.4 秒，聽起來會破 | 同一個 prompt，挑 4 版裡沒有破音的那一版 |

**Codex 可以修，不用重生**：
- 輕微削波（每段都很短）：`valve_squeak` 133、`pot_upright` 70、`machine_stop` 66、`door_iron` 28、`chart_mark_b` 14、`padlock_open` 12、`fern_brush_b` 7、`ladder_step_b` 3、`cage_door` 1。用倒影湖畔的插值修法。
- 左右不平衡 4–5 dB：`fern_brush_c`、`sapling_leaf`、`soil_scoop`，改成置中。
- 同組音量不一：`ladder_step_c` 比 a、b 小約 15 dB。整合前先標準化。

### 第二版 prompt（重生用）

```
nursery_turn_loop · 20 秒 · Loop 開 · influence 65%
High-quality professional recording, clean and detailed: a large old iron wheel turning slowly on a rusty axle, slow rhythmic metal creaks and soft squeaks every few seconds, clear in the mid frequencies, with a light low rumble underneath. Steady and even, no sudden events, no background noise.

nursery_disc_step · 0.6 秒 · Loop 關 · influence 70% · 留 2 版
High-quality professional foley recording, close-mic, dry, clean and detailed: one firm boot step on a steel grate floor, a clear crisp metallic clank with a short ring. Isolated sound, no background noise.

core_motif_07 · 6 秒 · 用 Eleven Music
Solo soft wooden marimba, no accompaniment, no drums, no vocals. Four separate notes played one after another, each struck clearly: G4, then C5, then D5, then G5, in C major at about 50 BPM, the last note held and fading naturally. About 6 seconds, clean high-quality studio recording, dry with very little reverb. Tender and simple.
```

## 8. 最後檢查（Claude，2026-10-07 04:00；用數據量，沒有聽）

使用者重生了 `nursery_machine_start`、`nursery_disc_step_b`、`nursery_turn_loop`；旋律決定**不重生，交給 Codex 改**。38 個 nursery 檔都在，沒有缺檔，也沒有多餘的檔。

| 檔案 | 結果 |
| --- | --- |
| `nursery_machine_start` | 通過：沒有削波，峰值 −7.8 dBFS，聲音分布正常 |
| `nursery_disc_step_b` | 通過：清脆的金屬聲，峰值 −9.7 dBFS |
| `nursery_disc_step_a` | 使用者 04:01 換過，但和 `_b` **是同一個檔**（MD5 相同）。兩個都可以用，但其實只有一種聲音：當作一個版本，播放時加 ±3% 速率變化。另外左聲道比右聲道大 4.8 dB，要置中 |
| `nursery_turn_loop` | 可以用，但仍然幾乎全是 300 Hz 以下的低頻，沒有吱嘎聲，筆電喇叭聽不太到。當作耳機才聽得到的低頻底，白天機器的存在感主要靠 `nursery_spray_loop` |
| `core_motif_07` | 交給 Codex 改（見下） |

### 給 Codex：`core_motif_07` 的改法（使用者 2026-10-07 授權）

- 原檔只有開頭一下木琴（C4 與 G4 同時響），之後一路衰減約 6 秒，不是旋律。
- 做法同 03 湖鏡的 `core_motif_03`：從原檔取這一下乾淨的木琴音（以 G4 那個成分為主，必要時濾掉 C4），**移調**排成 G4、C5、D5、G5。
  - 時間：0、0.7、1.4、2.5 秒。
  - 最後一個音讓它自然衰減，總長約 6 秒。
- 只能用原檔的聲音移調、修剪、淡入淡出；不要用振盪器、其他音源或 AI 生成。
- 每個音的主峰偏差要在 ±10 音分內。
- 先出試聽 WAV 給使用者聽，確認後才整合。

### 整合前 Codex 要做的修正（§7 已列，這裡彙整）

- 短暫削波，用插值修：
  - `valve_squeak`、`pot_upright`、`machine_stop`、`door_iron`
  - `chart_mark_b`、`padlock_open`、`fern_brush_b`、`ladder_step_b`、`cage_door`
- 左右置中：`fern_brush_c`、`sapling_leaf`、`soil_scoop`。
- 同組先標準化響度：`ladder_step`、`chart_mark`、`fern_brush`、`glass_tick`。
- 夜裡不用任何蟲聲。

## 9. 背景音樂 `nursery_bgm`（Claude，2026-10-08）

狀態：**2026-10-08 Codex 已接線與重混，待使用者試聽**。四段配樂、正式苗圃與動畫音效測試畫面已更新；D7 已另存兩版。預設背景音仍為 12%，安裝版 0.6.30 尚未重發；完成與驗證記錄見 §9.7。

### 9.1 使用者決策（2026-10-08）

- 使用者覺得純環境音太單調，**改為加入背景音樂**，取代原本「沒有持續的旋律」（`AUDIO_DESIGN_HANDOFF.md` §0 第 1 點）。企畫書已同步。
- 做法是**間歇播放**：一段播完留白一陣子只剩環境音，再播下一段；不整段循環。
- 為了省 ElevenLabs 點數，只生成**一首 2:10**，由 Codex 剪成三段使用。晨霧專用曲（dawn）取消。
- 07 原本要用的和弦墊 `pad_csus2_loop` 取消，由背景音樂取代。
- 核心旋律（G4–C5–D5–G5、木琴）仍只在取得核心時出現；背景音樂沒有使用木琴與玻璃鈴音色，與發現的單音區分開。

### 9.2 檔案與數據（用數據量，Claude 沒有聽）

- `game project/audio-incoming/nursery_bgm.wav`，MD5 `3c1e9794a5fb0941454fe28f0bb32836`。
- 48 kHz、立體聲、130.0 秒；峰值 −0.3 dBFS，沒有削波；整體響度 −11.9 LUFS（已母帶化，很大聲，整合時要降）。
- **開頭沒有淡入**：0 秒就是全音量，需要補淡入。結尾自然淡出到 −64 dB，可以直接用。
- 兩處段落轉換都量得到：
  - **約 59.3 秒**：2–6 kHz 從約 −53 dB 升到約 −33 dB（相對整體），有較亮的樂器進來。前後音量沒有下降，**不是**預期的「先靜下來再換段」。
  - **約 89–92 秒**：音量從約 −14 dB 降到約 −28 dB，之後是很稀疏的低音段，偶爾有單音（96、103、107、110.5、118 秒左右）。
- 0–59 秒很暗：2 kHz 以上的能量約 −52 dB，150 Hz 以下很重。筆電喇叭可能聽不太到這段，請使用者試聽時用筆電喇叭也聽一次。

生成用的 prompt（Eleven Music v2.5、器樂、1 版、2:10）：

```
Instrumental only, no vocals, no drums, no percussion. Calm ambient background music for a long focus session, key C major, about 66 BPM, gentle rubato, soft even dynamics, no climax, no catchy melody.
Three clearly separated sections, each ending by decaying to near silence:
0:00–0:50: soft felt piano playing a slow circular arpeggio in 3/4, a faint warm analog pad underneath. Ends on a held chord fading to near silence.
0:50–1:30: solo cello playing a few long simple phrases over held felt piano chords. Ends fading to near silence.
1:30–2:10: very sparse, almost no pulse, a low sustained string drone in A minor with a few single low piano notes far apart. Fades out to silence.
Clean, warm, high-quality studio recording, natural room reverb.
```

### 9.3 剪段（只能剪切、淡入淡出與濾波，不合成、不生成）

| 段 | 範圍（起點可在 ±1 秒內找較乾淨的點） | 處理 | 用途 |
| --- | --- | --- | --- |
| `bgm_a` | 0.0–59.2 秒 | 開頭淡入 2 秒；結尾淡出 3 秒（約 56.2 秒開始） | 晨、日 |
| `bgm_b` | 58.9–92.0 秒 | 開頭淡入約 0.3 秒，保留 59.0 秒那個起音；結尾自然衰減後淡出 1.5 秒 | 晨、日 |
| `bgm_ab` | 0.0–92.0 秒 | 開頭淡入 2 秒；結尾同 `bgm_b` | 晨、日（較長的一首） |
| `bgm_c` | 91.5–130.0 秒 | 開頭淡入 2 秒；結尾用原檔的淡出 | 夜 |

- 原檔不要改，剪段的結果另存，處理可重現（可加進 `scripts/prepare-nursery-audio.py`）。
- 響度：四段校準到同一個整體響度，再依 §9.4 的混音比例設增益。

### 9.4 播放規則

- **歸屬**：走「背景音」滑桿，曲線 1.4 次方，與其他場景相同；背景音為 0 或全部靜音時不播。
- **開始**：進入苗圃（含旅途中的大廳＝苗圃休息處）後，先只有環境音 20–40 秒，再播第一段。
- **間隔**：每段播完，晨、日留白 60–150 秒，夜留白 90–180 秒（隨機），再從當下時段的曲庫挑一段，不連續挑同一段。
- **時段**：晨、日的曲庫是 `bgm_a`、`bgm_b`、`bgm_ab`；夜只有 `bgm_c`；暮不開新的一段。時段切換時，正在播的那段播完，下一段才依新時段挑。起濃霧的夜晚，`bgm_c` 跟環境一起加低通。
- **壓低**：
  - 故事事件、信物、扶正盆栽等有動作聲的演出：背景音樂在約 0.3 秒內壓到 50%，結束後約 1 秒回復。
  - 取得核心：背景音樂在 4 秒內淡出，`core_motif_07` 結束後至少 30 秒才開始下一段。
  - 開收藏室：沿用既有的進入低通，不另做。
- **暫停／離開**：暫停與環境音一起凍結、繼續後接續；8 秒出口演出期間繼續播，離開場景時淡出約 1.5 秒；重開不補播。
- **響度目標**（以試聽為準）：環境音 35%、背景音為預設值時，背景音樂聽得出來，但比葉子＋噴霧的白天環境層小。原本 12% 的預設是為「幾乎聽不出來的和弦墊」設的，可能太小。請出試聽時附背景音 12% 與 25% 兩種，由使用者決定預設值。

### 9.5 範圍

- 只做 07 玻璃苗圃。其他地圖之後各自設計，這次不要動雲上遺庭、苔痕驛站、倒影湖畔、營火大廳現有的聲音。
- 動畫音效測試畫面（`AUDIO_TESTER_README.md`）加上背景音樂：可以單獨試聽四段，並在六種環境下聽到實際的混音與留白（可加一個「縮短留白」的選項方便試聽）。
- 不改燈、計時、獎勵、事件或存檔；音訊失敗不得影響專注。
- 使用者已授權直接整合（2026-10-08）；整合後仍由使用者在遊戲或測試畫面試聽，數值依回饋調整。

### 9.6 整合完成後：重做 D7 展示影片的聲音

- 影片：`game project/showcase-video/d7/FocusQuest_D7_玻璃苗圃.mp4`（34 秒，30 fps，1020 格）。畫格已在 `d7/frames/`，**不需要重新錄影**，只要重混聲音再用 `d7/tools/ffmpeg.exe` 合成（參數照 `d7/record.cjs` 第 42 行）。
- 聲音：原本的 `d7/hero_audio.wav`（遊戲音效）加上 `bgm_a` 的開頭 34 秒，開頭淡入 1 秒，最後 2 秒跟著影片淡出。遊戲音效仍要聽得清楚。
- 背景音樂比 `hero_audio.wav` 的整體響度低約 6 dB 與約 10 dB 各出一版，讓使用者挑。
- 不要覆蓋原檔：新的聲音存成 `hero_audio_bgm_m6.wav`／`_m10.wav`，影片存成 `FocusQuest_D7_玻璃苗圃_bgm_m6.mp4`／`_m10.mp4`；原影片與 `hero_audio.wav` 保留。
- 影片檢查：長度與原影片相同、聲音沒有削波、影音同步。

### 9.7 Codex 接線與 D7 重混（2026-10-08）

- 四段只使用原錄音剪切、淡入淡出與固定增益，整體響度均為 −24 LUFS（偏差 0.01 LU）；原檔 MD5 與 §9.2 相符。切點與淡入淡出依 §9.3，沒有使用和弦墊或新增音源。可重現：`scripts/prepare-nursery-bgm.py`；數據：`previews/nursery-audio-qa/bgm-processing-report.json`。原有處理腳本排除 `nursery_bgm`，避免日後重跑時誤當成動作音效。
- 正式苗圃 `nurseryAudio.ts`／`nurseryBgm.ts` 與 `glassNurseryScene.js` 已接入進場 20–40 秒、日間／夜間留白、黃昏不開新曲、換時段播完當前曲、1.4 次方音量曲線、動作 0.3 秒壓至 50%／1 秒恢復、核心 4 秒淡出與後續留白、夜霧低通、暫停接續及離開釋放。Focus→苗圃休息處沿用同一實例，不重置配樂。核心木琴仍待確認，未加入取得動畫；目前預留其 6 秒長度加至少 30 秒留白。
- 動畫音效測試頁已重建為 48 個錄音（44 舊音檔＋4 曲），提供四段單獨試聽、12%／25%、立即聽環境混音及縮短留白。日間混音 WAV 為 `bgm-day-12.wav`／`bgm-day-25.wav`（位於 `previews/nursery-audio-qa/`）。預設保留 12%，待使用者試聽決定；此次不重發安裝版 0.6.30。TypeScript、199 測試與正式／測試頁建置通過；正式 Electron 48 音檔、暫停／音量、信物／核心與跳時檢查通過，見 `previews/nursery-audio-qa/runtime/report.json`。
- D7 已另存 `hero_audio_bgm_m6.wav`／`hero_audio_bgm_m10.wav` 與兩支同名後綴 MP4。配樂響度分別為 −21.92／−25.92 LUFS，相對原遊戲音效 −15.92 LUFS 低 6／10 dB。新片沿用原片影像碼流，只有音軌重新 AAC 256 kbps 編碼；兩支都為 34 秒、1020 格，逐格影像與時間戳 SHA256 和原片相同，AAC 真峰值 −0.42／−0.64 dBTP，WAV 無削波。原片及原音效保留。驗證：`scripts/verify-nursery-bgm-video.py` 與 `showcase-video/d7/bgm-video-verification.json`。
- 使用者本次要求測試不要切換其視窗。後續 QA 使用隱藏／離屏視窗，不自動打開互動測試頁或影片；桌面測試入口保留供使用者自行開啟。

後續更新：使用者已選定 m10_leaves60 影片的混音，確認與正式場景校準方向見 §9.9；核心木琴仍待獨立確認。

隱藏／離屏 Electron 最終驗證也已通過：48 音檔、22 動畫、進場 20–40 秒、時段切換保留當前曲、動作壓低、配樂與前景暫停接續、背景音 0 仍保留環境音、12%／25%、四段獨立播放器隔離、濃霧夜間配樂低通、核心後留白、移植重播、兩出口及兩尺寸。報告 `previews/nursery-audio-tester/qa-report.json`，22 動畫、0 錯誤；最後一輪未顯示視窗。

### 9.8 樹葉音量回饋（2026-10-08）

使用者要求風吹樹葉降至原音量的 60%，影片亦同。正式 `nurseryAudio.ts` 的葉層獨立乘 0.6；環境總滑桿、配樂與其他聲音設定不變。正式來源與離線動畫測試頁已重建，TypeScript 通過；已安裝版仍未重發。`bgm-day-12.wav`／`bgm-day-25.wav` 也使用葉層 0.6。

D7 原音效是已混合的 WAV，沒有獨立分軌。`scripts/reduce-d7-leaves.py` 以提供的原始葉子錄音、循環相位、二階低通及 85 ms／12% 反射，擬合取回葉層；136 量測窗中 96 個穩定窗可直接匹配，接受窗的相對殘差中位數約 0.063%，動態區間以相鄰可靠數據插值，不能宣稱原分軌逐取樣完全重建。只從原混音扣除所還原葉層的 40%，其他原混音保留；配樂沿用前版相同增益，不因葉層變小而重新調整。

另存 `hero_audio_leaves60.wav`、兩版 `hero_audio_bgm_m6_leaves60.wav`／`hero_audio_bgm_m10_leaves60.wav`，以及 `FocusQuest_D7_玻璃苗圃_leaves60.mp4`、`FocusQuest_D7_玻璃苗圃_bgm_m6_leaves60.mp4`、`FocusQuest_D7_玻璃苗圃_bgm_m10_leaves60.mp4`。原始與上一版全部保留。可重現：`prepare-nursery-bgm.py --leaves60`；數據：`showcase-video/d7/leaves60-processing-report.json`、`previews/nursery-audio-qa/bgm-leaves60-processing-report.json`；影片驗證：`verify-nursery-bgm-video.py --leaves60`。本次未顯示或切換任何測試視窗。

三支新版影片均通過 34 秒／1020 格、原影像碼流與逐格時間戳一致檢查；低 6／10 dB 配樂版的 AAC 真峰值為 −0.46／−0.66 dBTP，原音效版為 −1.02 dBTP，WAV 無削波。配樂增益仍為 +2.25／−1.75 dB，與上一版相同。

### 9.9 使用者確認的混音基準（2026-10-08）

使用者指定 `FocusQuest_D7_玻璃苗圃_bgm_m10_leaves60.mp4`，確認「這個音量剛好，之後往這方向前進」。此版為已驗收的音量與層次參考：葉層為先前 60%，背景音樂採 m10 版的既有增益（相對未調葉層的原 hero 音效低 10 dB；對 −24 LUFS 的切段加 −1.75 dB）。後續苗圃調整及其他場景混音參考，維持環境與動作清楚、配樂襯底、樹葉不搶音的平衡，依各錄音響度校準。

這次確認的是指定影片的實際混音，不等同選定 App 背景音滑桿 12% 或 25%；影片增益與 App 音量曲線須在正式場景對照此基準。苗圃來源與測試頁的葉層 60% 已完成，已安裝的 0.6.30 尚未重發。核心木琴仍依原流程等待獨立確認。
