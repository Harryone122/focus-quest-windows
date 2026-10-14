# 藏聲秋谷（05）環境音與背景音樂：設計與 ElevenLabs prompt（第一版）

> **2026-10-14 已被 `AUDIO_HANDOFF.md` 取代**：使用者改用新的 prompt 生成了整批音檔（含 lofi 背景音樂），驗收結果、混音與背景音樂規則以 `AUDIO_HANDOFF.md` 為準。本文件只留作原則參考。


日期：2026-10-11。設計者：Claude。生成者：使用者（ElevenLabs）。整合者：Codex（等使用者說開始）。**我沒有聽過任何這張圖的音檔。**
範圍：只有環境音與背景音樂。互動點與事件的一發音效（石磬、梵鐘、撞木、風孔岩、聲壁、水車鋸石、核心演出等）是下一批，這次不做。

## 0. 這張圖的聲音原則

這張圖的主題是「聲音被藏起來、再放出來」。所以平常的山谷要**留白**：環境很少、很乾淨，玩家敲石磬、敲鐘的時候，那一聲才會被聽見。

**刻意沉默**：雲海、光柱、霧、彩虹、燈籠與石燈籠、落葉（單片飄落）、畫面上的球形氣波本身（氣波只陪著真的聲音出現）。

## 1. 不吵、不雜音的做法（沿用 07 的教訓）

| 以前的問題 | 這次怎麼避免 |
| --- | --- |
| 層太多、互相蓋（營火、湖畔） | 戶外只有 **3 個環境循環**＋稀疏的鳥與風鐸。沒有河流循環、水車循環、蟲聲、洞內底噪 |
| 水聲是白噪音，最容易變成「沙沙」雜音 | 瀑布寫成**很遠、圓、低中頻**的聲音，不要近距離的水花；整合時低通約 3 kHz，是最小聲的底層 |
| 蘆葦聲偏亮、刺耳（湖畔 7 kHz） | 樹葉寫「soft sparse」，不寫 crisp／crunchy；整合時低通約 8 kHz |
| 蟋蟀太吵（07） | 夜裡不用任何蟲聲，改用低的風 |
| 寫了 quiet → 生成太小聲 → 放大後底噪也放大 | prompt 不寫音量；開頭固定寫品質，結尾固定 `no background noise` |
| AI 自己補怪聲 | 環境循環 20 秒（07 的 20 秒循環可用）、influence 60–65%，一發音效秒數設成實際長度 |
| AI 生成的洞內「空間感」＝一層嗡嗡底噪 | 洞內不生成空間聲；空間感由 Codex 用殘響與把洞外聲音低通來做 |
| 循環接縫有雜音（營火水聲第 10 秒） | Loop 開；整合時仍用 2 秒交叉淡化，Codex 檢查接縫 |
| 只有低頻、筆電喇叭聽不到（07 轉盤） | 藏聲石低鳴要求「清楚的中頻泛音」 |
| BGM 太暗、低頻太重、母帶太大聲（07） | 寫「balanced low end, clear gentle highs」；響度由 Codex 校準 |

**挑檔（每次 4 版，戴耳機）**：高頻沒有嘶聲或金屬閃爍、不悶、20 秒裡沒有突然的大聲事件、沒有多出來的鳥／人聲／音樂。都不行就重生，不要將就。

## 2. 沿用既有檔（不用生成）

| 用在哪裡 | 沿用 |
| --- | --- |
| 白天、清晨的鳥 | `lake_birds_day`（量過很乾淨，底噪約 −75 dB；4 個鳥叫在 3.5、12.0、18.25、28.5 秒，切片段用） |
| 洞內滴水 | `nursery_drip_loop`（稀疏清楚的滴答） |
| 洞內楓葉落水（每 10–18 秒） | `lake_fish_plip`，降音量、升高約 3 半音、加洞內殘響。聽起來不像葉子再另外生成 |
| 腳步 | 地面 `stone_step_dry`、木橋與鐘樓舞台 `bridge_plank_step`、洞內棧道 `bridge_plank_step` |

## 3. 新生成：6 則（5 則 Sound Effects＋1 首 Music）

全部下載 WAV 48 kHz，放進 `game project/audio-incoming/`。檔名＝標題列的 ID，「留 N 版」存成 `_a`、`_b`、`_c`。

### A 批：戶外環境（Sound Effects）

```
echo_falls_far_loop · 20 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: a large waterfall far away across a wide mountain valley, heard only as a smooth, soft, rounded low roar with a warm low-mid tone. Steady and even, no sudden events, no background noise.

echo_maple_leaves_loop · 20 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: dry autumn maple leaves still on the branches rustling gently in a light mountain breeze, soft sparse rustles in slow swells with calm gaps between them. Steady and even, no sudden events, no background noise.

echo_valley_wind_loop · 20 秒 · Loop 開 · influence 60%
High-quality professional stereo field recording, clean and detailed: a soft steady wind flowing across an open mountain valley, a smooth low whoosh with slow gentle swells. Steady and even, no sudden events, no background noise.

echo_wind_bell · 3 秒 · Loop 關 · influence 65% · 留 3 版
High-quality professional foley recording, close-mic, clean and detailed: one small bronze temple eave bell swaying once, a single soft low clink with a warm short ring that fades naturally. Isolated sound, no background noise.
```

`echo_wind_bell` 是鐘樓四角的風鐸。三版的音高可能不一樣，Codex 偵測後校正到 C、D、G、A 其中之一（和背景音樂同一組音），不會跟音樂打架。

### B 批：洞內（Sound Effects）

```
hum_stone_g2 · 3 秒 · Loop 關 · influence 60%
High-quality professional recording, clean and detailed: one deep resonant hum of a large singing stone at the pitch G2, a gentle swell then a slow natural decay, with clear warm mid-range overtones. One note only, no melody. Isolated sound, no background noise.
```

這是批次 7 `hum_stone_g2` 的第二版（舊版沒生成過）。同一個檔同時用在：洞內藏聲石每 8 秒低鳴、收藏室藏聲石（`AUDIO_DESIGN_HANDOFF.md` §9）、營火浮石的「嗡」。驗音高：差不到半音照收，Codex 校正。

### C 批：背景音樂（Eleven Music，器樂，1 版，2:10）

```
Instrumental only, no vocals, no drums, no percussion. Calm ambient background music for a long focus session in a quiet autumn mountain valley, A minor pentatonic, about 60 BPM, gentle rubato, soft even dynamics, no climax, no catchy melody.
Three clearly separated sections, each ending by decaying to near silence:
0:00–0:50: a soft koto playing slow, sparse plucked phrases with long pauses, over a warm low string pad. Ends on a held chord fading to near silence.
0:50–1:30: a solo alto flute with a smooth pure tone playing a few long simple phrases over held strings and occasional soft koto notes. Ends fading to near silence.
1:30–2:10: very sparse, almost no pulse, a low sustained string drone on A with a few soft koto harmonics far apart. Fades out to silence.
Clean, warm, high-quality studio recording, natural room reverb, balanced low end, clear gentle highs. No bells or chimes.
```

為什麼這樣選：
- **古箏＋中音長笛＋弦樂**：秋天山寺的感覺，但和 07（鋼琴＋大提琴）分得開。長笛指定「smooth pure tone」，避免尺八那種很多氣音（氣音聽起來就是雜音）。
- **A 小調五聲音階**（A、C、D、E、G）：和全遊戲的 C／G 單音、藏聲石的 G2、風鐸校正後的音都相容。
- **No bells or chimes**：畫面裡有真的梵鐘和風鐸，音樂裡再有鐘聲會分不清是遊戲事件還是配樂。也避開核心旋律用的卡林巴（`core_motif_05`）。
- 為了省點數，跟 07 一樣只生一首，由 Codex 剪成三段。

## 4. 混音（設計目標，以試聽為準）

基準：使用者 2026-10-08 確認的 D7 `m10_leaves60` 混音（環境與動作清楚、配樂襯底、樹葉不搶）。數值是各層相對增益，環境滑桿曲線 1.4 次方。

| 情境 | 瀑布 | 樹葉 | 風 | 鳥（`lake_birds_day` 片段） | 風鐸 |
| --- | --- | --- | --- | --- | --- |
| 晨 | 0.5 | 0.4 | 0.3 | 1（間隔 15–30 秒） | 每 40–70 秒一聲 |
| 日 | 0.5 | 0.6 | 0.2 | 0.6（間隔 20–40 秒） | 每 30–60 秒 |
| 暮 | 0.5 | 0.5 | 0.4 | 0.2 | 每 30–60 秒 |
| 夜 | 0.45 | 0.3 | 0.5 | 0 | 每 60–120 秒 |
| 山風石歌（約 60 秒） | 0.5 | 4 秒內升到 1.0 | 4 秒內升到 1.0 | 不變（鳥群驚起另做一發音效，下一批） | 每 2–5 秒，四個角輪流 |

- 瀑布在畫面左側：聲像固定偏左（約 −0.35），低通約 3 kHz，永遠不比樹葉大聲。
- 樹葉低通約 8 kHz；風高通約 60 Hz。
- 風鐸隨機選一個角（左右聲像依位置）、每次 ±3% 速率，不連續兩次同一版。
- 山風結束時，風與樹葉 6 秒內回到原值。
- 前景最多 3 個；一發音效與事件出現時，環境在約 0.3 秒內壓到約 30%，約 1 秒回復（全遊戲規則）。

### 洞內

| 層 | 設定 |
| --- | --- |
| 洞外聲音（瀑布＋風＋樹葉） | 0.7 秒淡入淡出時一起低通到約 500 Hz、降到約 20%：聽得出外面還有世界 |
| 滴水 `nursery_drip_loop` | 0.5，加約 2.5 秒的洞內殘響 |
| 藏聲石 `hum_stone_g2` | 每 8 秒一次（跟畫面氣波同步），加同一個殘響；取得核心後不再播 |
| 楓葉落水 `lake_fish_plip` | 跟畫面同步，加殘響 |
| 鳥、風鐸 | 不播 |

## 5. 背景音樂剪段與播放（比照 07 §9.3–§9.4）

剪段（只能剪切、淡入淡出、濾波與固定增益，不合成、不生成；切點以實際音檔為準，±1 秒內找乾淨的點）：

| 段 | 範圍 | 用途 |
| --- | --- | --- |
| `echo_bgm_a` | 約 0:00–0:50（古箏） | 晨、日 |
| `echo_bgm_b` | 約 0:50–1:30（長笛） | 晨、日 |
| `echo_bgm_ab` | 約 0:00–1:30 | 晨、日（較長） |
| `echo_bgm_c` | 約 1:30–2:10（低音弦＋泛音） | 夜 |

播放規則沿用 07（`nurseryBgm.ts` 的邏輯可直接共用）：進場先 20–40 秒只有環境；晨日留白 60–150 秒、夜 90–180 秒；暮不開新段；時段切換時當前段播完才換；四段校準到同一響度，比照 m10 基準。

這張圖多的規則：
- **梵鐘、石磬等「聲音事件」響起時**，背景音樂 0.3 秒內壓到約 35%（比一般事件的 50% 更低），約 2 秒回復：這張圖的主角是那一聲。
- **山風石歌**期間不開新的一段；正在播的照播。
- **洞內**：背景音樂繼續，0.7 秒內降到約 60%，不加低通（空靈的感覺留給音樂）。
- **取得藏聲石**：背景音樂 4 秒內淡出，`core_motif_05` 結束後至少 30 秒才開始下一段（同 07）。

## 6. 驗收

- 戴耳機、也用筆電喇叭各聽一次。
- 環境三層：高頻乾淨、沒有嘶聲；瀑布是遠遠的低沉水聲，不是近距離的沙沙聲；20 秒內沒有突然的大聲事件。
- 風鐸：一聲清楚、尾巴自然、沒有金屬嘶聲。
- 藏聲石：筆電喇叭聽得到；音高差不到半音。
- 背景音樂：三段分得開、沒有鐘聲或鼓、低頻不悶；0:50 與 1:30 附近要有安靜下來的換段點。
- 檔案到位後 Claude 用數據量一次（響度、削波、頻譜、接縫），同 07 §7。

## 7. 給 Codex（等使用者說開始）

- 流程同 `AUDIO_DESIGN_HANDOFF.md` §10：先出試聽（日、夜、山風、洞內各一段混音，附背景音樂），使用者確認後才整合；不自己合成或生成聲音；缺檔就不播。
- 聲音只由既有狀態驅動（時段、山風、洞內／洞外、事件 cue）。暫停時凍結，快轉與跳時直接就位，不補播。
- 不改其他地圖的聲音。
