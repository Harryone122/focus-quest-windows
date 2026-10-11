# 音檔生成 prompt 清單（ElevenLabs）

建立：2026-10-02。設計者：Claude。生成者：使用者（在 ElevenLabs 網頁生成）。整合者：Codex。設計依據是 `AUDIO_DESIGN_HANDOFF.md`；整合規則見該文件 §10。

## 使用方式

1. 到 ElevenLabs 的 **Sound Effects**（批次 1–5）或 **Music**（批次 6）貼上 prompt。
2. 照每則標題列設定：**秒數**、**Loop 開關**、**Prompt influence**（滑桿，預設 30%）。
3. 每次會生成 4 個版本。聽完選最好的一個；循環檔要確認沒有明顯接縫、沒有突然出現的人聲或音樂；一發音效要選尾巴乾淨的。
4. 下載：一發音效下載 WAV（48 kHz）；循環檔依官方文件只有 MP3。
5. 檔名 = 標題列的 ID。標「留 N 版」的，各存一個，加 `_a`、`_b`、`_c`（例如 `bridge_creak_up_a.wav`）。
6. 全部放進 `game project/audio-incoming/`，再請 Codex 整合。

**限制（官方文件）**：音效單次最長 30 秒；prompt 最長 450 字元；循環檔只有 MP3；音樂最短 3 秒、最長 5 分鐘。
**點數**：指定秒數時約每秒 40 點，長循環最貴；一發音效請設短，不要用自動長度。
**授權**：免費方案不可商用且需標註 ElevenLabs，付費方案才有商用權；請在付費方案下生成，並自行確認官方條款。
**建議順序**：先做批次 1 和 2（營火大廳與出發），放進遊戲聽聽風格對不對，再做後面的批次。

## 進度（2026-10-03）

| 批次 | 狀態 |
| --- | --- |
| 1 營火大廳環境 | 已生成、已整合、使用者試聽通過 |
| 2 出發與回營火動作聲 | 已生成（11 檔），待 Codex 出試聽；`dep_steps_dirt` 只有 1 版 |
| 2b 吊橋與浮石腳步 | 已生成（14 檔），待 Codex 出試聽；`bridge_creak_up_a` 與 `_c` 內容相同；`stone_air_hop` 整批最大聲、太大 |
| 3 雲上遺庭、4 苔痕驛站、5 收藏室、6 旋律、7 音高單音與和弦墊 | 未做 |
| 8 倒影湖畔（第三張地圖） | **全部 28 個檔已生成**（8a 6、8b 14〔wade 4、mud 3、cuff 1、fish 2、egret 2、arch 2〕、8c 3、8d 3、`tone_item_d4`、`core_motif_03`）；問題檔（音準、削波、接縫、斷續）由 Codex 以原檔為基礎修正（使用者 2026-10-03 授權），使用者聽過再決定要不要重生；地圖還沒移植進 App；Codex 等使用者說「開始」

---

## 批次 1：營火大廳環境（先做）

```
camp_fire_loop · 20 秒 · Loop 開 · influence 40%
Close campfire ambience: soft low steady burning with sparse irregular small wood crackles and tiny pops, gentle warm roar underneath. Calm and intimate. No wind, no loud pops, no voices, no music.

camp_wind_loop · 25 秒 · Loop 開 · influence 35%
Very soft low wind over a misty shoreline at night, slow gentle rises and falls, mostly low frequencies. No whistling, no howling, no leaves, no voices, no music. Calm and quiet.

camp_water_far_loop · 25 秒 · Loop 開 · influence 35%
Distant gentle water lapping on a shore far away, heard through mist, muffled and very soft with a slow rhythm. No splashes, no birds, no voices, no music.

camp_tarp_loop · 20 秒 · Loop 開 · influence 35%
A canvas tarp fluttering softly in a light breeze, slow gentle cloth flapping with a faint rope creak, quiet. No wind howl, no voices, no music.

camp_dawn_birds · 30 秒 · Loop 關 · influence 35%
Sparse distant dawn birdsong over a misty shoreline, a few soft calls with long silences between them, peaceful and gentle. No wind noise, no traffic, no voices, no music.
```

## 批次 2：借火出發與回到營火（一發音效，WAV）

```
dep_notebook_close · 0.8 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a small leather notebook being closed softly, pages folding shut with one gentle thump. No voices, no music.

dep_log_creak · 1.0 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: an old wooden log creaking softly as a person stands up from it, one short low wood creak. No voices, no music.

dep_staff_tap · 0.8 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a wooden walking staff lifted and tapped once on packed dirt, a soft knock. No voices, no music.

dep_steps_dirt · 1.5 秒 · Loop 關 · influence 65% · 留 3 版
Dry close-up, no reverb: two soft slow footsteps of a person walking on dry dirt and short grass, with faint cloak fabric rustle. No voices, no music.

dep_cloth_kneel · 1.0 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: heavy cloak fabric rustling softly as a person kneels down, gentle slow cloth movement. No voices, no music.

dep_lantern_clink · 0.6 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a small metal lantern handle clinking once softly against a wooden staff, a tiny delicate metallic tick. No voices, no music.

dep_ember_spark · 0.8 秒 · Loop 關 · influence 60%
Close-up: a single glowing ember spark flying up from a campfire with a tiny soft hiss and one faint crackle, delicate and quiet. No voices, no music.

dep_fire_flare · 1.5 秒 · Loop 關 · influence 60%
Close-up: a campfire flaring up softly, a gentle warm whoomph as the flames swell, then settling back with small crackles. Not explosive. No voices, no music.

dep_cloth_rise · 1.0 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: heavy cloak fabric rustling softly as a person stands up, gentle cloth movement and a faint knee creak. No voices, no music.

dep_fog_swell · 2.5 秒 · Loop 關 · influence 40%
A low soft airy swell of fog-like wind rising slowly to cover everything, a gentle breath of air, mostly low frequencies. No whistling, no voices, no music.

ret_log_settle · 1.5 秒 · Loop 關 · influence 60%
Close-up: a fresh log placed onto a campfire, a dull soft thud of wood settling, then a small burst of sparks crackling and fading away. No voices, no music.
```

## 批次 2b：吊橋與浮石腳步（一發音效，WAV）

吊橋的「gi 乖、gi 乖」：每一步交替播放 `bridge_creak_up`（gi，音高上滑）與 `bridge_creak_down`（乖，音高下滑）。

```
bridge_creak_up · 0.5 秒 · Loop 關 · influence 70% · 留 4 版
Dry close-up, no reverb: one short creak of a wooden plank on an old rope suspension bridge under a footstep, a rising-pitch squeak like "gi", wood and rope friction. No voices, no music.

bridge_creak_down · 0.6 秒 · Loop 關 · influence 70% · 留 4 版
Dry close-up, no reverb: one short creak of a wooden plank on an old rope suspension bridge under a footstep, a falling-pitch squeak like "gwai", wood and rope friction. No voices, no music.

bridge_plank_step · 0.4 秒 · Loop 關 · influence 65% · 留 3 版
Dry close-up, no reverb: a light soft footstep on a wooden bridge plank, a thin hollow knock, quiet. No voices, no music.

bridge_sway_groan · 1.2 秒 · Loop 關 · influence 55%
A low gentle groan of a long rope suspension bridge swaying slowly under weight, slow wood and rope creak, soft and distant. No voices, no music.

stone_step_dry · 0.4 秒 · Loop 關 · influence 65% · 留 3 版
Dry close-up, no reverb: a short crisp light footstep tap on hard smooth stone, a small clean click with a very short tail. No voices, no music.

stone_air_hop · 0.7 秒 · Loop 關 · influence 55%
Close-up: a very faint soft whoosh of a person stepping across a small gap through the air, light cloth and a breath of air. Quiet. No voices, no music.
```

## 批次 3：雲上遺庭環境

```
cloud_wind_loop · 25 秒 · Loop 開 · influence 35%
Soft high-altitude wind over ancient stone ruins on a floating plateau, slow gentle gusts rising and falling, airy and open. No whistling, no howling, no voices, no music.

cloud_leaves_loop · 25 秒 · Loop 開 · influence 35%
Large tree leaves rustling softly in a light breeze, gentle continuous canopy rustle with slow swells, calm and quiet. No birds, no voices, no music.

cloud_water_far_loop · 25 秒 · Loop 開 · influence 35%
A distant waterfall and stream far below, soft constant low water rush heard from a great height, muffled and very quiet. No birds, no voices, no music.

cloud_birds_day · 30 秒 · Loop 關 · influence 35%
Sparse birdsong on a quiet high plateau in daytime, a few clear soft calls with long silences between them, peaceful. No wind noise, no voices, no music.
```

## 批次 4：苔痕驛站環境

```
moss_wind_loop · 25 秒 · Loop 開 · influence 35%
Soft wind moving through a damp mossy forest ravine, slow gentle gusts with faint grass and fern rustle, calm and quiet. No whistling, no voices, no music.

moss_stream_loop · 25 秒 · Loop 開 · influence 35%
A small shallow mountain stream and a distant mist waterfall, soft constant gentle water flow, quiet and far away. No birds, no voices, no music.

moss_rain_loop · 25 秒 · Loop 開 · influence 35%
Light steady rain falling on forest leaves and wet ground, soft even patter, calm. No thunder, no wind howl, no voices, no music.

moss_roof_rain_loop · 20 秒 · Loop 開 · influence 35%
Rain falling on an old wooden station roof and a rusty metal gutter, soft irregular patter and gentle dripping, cozy and quiet. No thunder, no voices, no music.

moss_drips_loop · 25 秒 · Loop 開 · influence 35%
Sparse slow water drips falling from eaves onto wet wood and moss after rain, soft quiet drops with long gaps between them. No rain patter, no voices, no music.
```

## 批次 5：收藏室

### 5a 房間與進出

```
room_tone_loop · 25 秒 · Loop 開 · influence 35%
Interior ambience inside a large canvas travel bag: very quiet, muffled, soft dark air, a faint canvas and leather creak, a close intimate space with an almost silent low hum. No voices, no music, no wind, no echo.

room_bag_open · 1.0 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a heavy canvas luggage flap lifted open and a brass buckle clicking undone, soft and slow. No voices, no music.

room_sleeve_brush · 0.9 秒 · Loop 關 · influence 65% · 留 2 版
Dry close-up, no reverb: a heavy cloak sleeve brushing slowly against canvas fabric, soft cloth movement. No voices, no music.
```

### 5b 十件核心放上時的落位聲（每件約 0.8–1 秒）

```
place_01_glass · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a delicate glass and brass orrery ring set gently onto a brass rod, a soft glassy tick and a faint metallic chime. No voices, no music.

place_02_metal · 0.8 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a small brass compass set down onto an old wooden cart, a soft metallic click and a wood knock. No voices, no music.

place_03_water · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a ring of smooth stones set down gently, then a fingertip touching still water with one soft drip. No voices, no music.

place_04_woodiron · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a wrought iron lamp post base set onto a stone plinth, a soft iron-on-stone thunk with a faint bolt rattle. No voices, no music.

place_05_stone · 1.0 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a heavy perforated stone set into a mine cart, a deep soft stone thud and a fine grit trickle. No voices, no music.

place_06_brass · 1.0 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a huge horn resting down onto three brass brackets on a wall, a deep soft brass and wood settle, a low thunk. No voices, no music.

place_07_glassdome · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a glass dome bell jar set onto a wooden base, a soft glass-on-wood clink and a faint hollow resonance. No voices, no music.

place_08_paper · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a heavy old book set onto a wooden lectern, a soft wood knock and a gentle paper rustle. No voices, no music.

place_09_clock · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a heavy clock face leaned against a wooden rack, a dull metal-on-wood knock and a tiny gear rattle. No voices, no music.

place_10_metal · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a brass telescope tube sliding into a metal stand, a smooth metal slide and a soft click. No voices, no music.
```

### 5c 核心平時的聲音

```
room_stone_dust · 1.2 秒 · Loop 關 · influence 55%
Close-up: fine stone dust and tiny grit trickling out of holes in a stone and landing softly, a gentle sandy hiss. No voices, no music.

room_horn_breath · 3.0 秒 · Loop 關 · influence 45%
A very soft airy breath of air passing through a giant empty horn, an unpitched airy exhale with a slight low resonance, quiet and slow. No musical note, no voices, no music.

room_letter_float · 1.5 秒 · Loop 關 · influence 55%
A paper letter lifting and floating softly out of the mouth of a horn, delicate paper flutter and faint air. No voices, no music.

room_clock_tick · 0.2 秒 · Loop 關 · influence 70% · 留 4 版
Dry close-up, no reverb: one single tick of a small precise clockwork escapement, a light crisp mechanical tick, very short. No voices, no music.

room_compass_ticks · 1.0 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: three tiny quick metal ticks of a compass needle settling toward a direction, delicate and quiet. No voices, no music.

room_water_drop · 1.5 秒 · Loop 關 · influence 55% · 留 2 版
A single clear water drop falling into a perfectly still lake with a tiny ring ripple, soft and quiet, short tail. No voices, no music.

room_lamp_ignite · 1.0 秒 · Loop 關 · influence 60%
Dry close-up: a small lantern wick catching a flame, a soft gentle whoomph and then a quiet steady glow. No voices, no music.

room_leaf_grow · 1.2 秒 · Loop 關 · influence 55%
Close-up: a tiny young sapling's leaves unfurling with a very soft delicate leaf rustle, subtle. No voices, no music.

room_page_turn · 1.0 秒 · Loop 關 · influence 65% · 留 3 版
Dry close-up, no reverb: one large heavy parchment page of an old book being turned slowly, a soft paper sweep. No voices, no music.

room_mist_air · 12 秒 · Loop 開 · influence 35%
Soft airy mist flowing through a long brass telescope tube, a gentle breathy low airflow, quiet. No whistling, no voices, no music.
```

### 5d 線索桌與筆記

```
desk_paper_drop · 0.6 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a small paper slip dropping onto old parchment, a soft light paper landing. No voices, no music.

desk_pin_tap · 0.4 秒 · Loop 關 · influence 70%
Dry close-up, no reverb: a metal thumbtack pressed into cork board through paper, one small soft tap. No voices, no music.

desk_thread_pull · 0.9 秒 · Loop 關 · influence 60%
Dry close-up, no reverb: a thin red thread pulled taut between two pins, a very soft stretching rasp. No voices, no music.

desk_notebook_open · 1.2 秒 · Loop 關 · influence 60%
Dry close-up, no reverb: an old leather notebook being opened slowly, leather creak and soft pages rustling. No voices, no music.

desk_page_flip · 0.8 秒 · Loop 關 · influence 65% · 留 2 版
Dry close-up, no reverb: a single page of a small notebook flipping over, a light soft paper flip. No voices, no music.
```

## 批次 6：旋律（用 Eleven Music，不是 Sound Effects）

這批的音高 AI 不一定準，請見下方「驗音高」。

### 6a 取得核心的旋律（十個，每個約 6 秒）

十個共用同一段 4 個音的動機（G4 C5 D5 G5，C 大調），只換樂器。把下面的樂器填進 `{樂器}` 後貼上，長度設 6 秒：

```
Solo {樂器}, no accompaniment, no drums, no vocals. A slow gentle four-note phrase G4, C5, D5, G5 in C major at about 50 BPM, the last note held and fading naturally. About 6 seconds, dry with very little reverb. Quiet, tender and simple.
```

```
core_motif_01 · {樂器} = glass bell, celesta-like
core_motif_02 · {樂器} = music box with a plucked metal comb
core_motif_03 · {樂器} = glass armonica, soft watery glass tones
core_motif_04 · {樂器} = soft harp plucks
core_motif_05 · {樂器} = low deep kalimba, played one octave lower (G3 C4 D4 G4)
core_motif_06 · {樂器} = deep warm French horn, slow and breathy, one octave lower (G3 C4 D4 G4)
core_motif_07 · {樂器} = soft wooden marimba
core_motif_08 · {樂器} = soft pizzicato violin
core_motif_09 · {樂器} = small tubular chime bells, clock-like
core_motif_10 · {樂器} = high crystal glockenspiel, airy shimmer
```

### 6b 真結局與十件齊

```
ending_dawn · 18 秒
An 18 second sparse ambient piece in C major for a sunrise. It begins with a single warm glass bell note C4, then a slow four-note phrase G4, C5, D5, G5 on soft glass bell, gradually adding a gentle sustained suspended chord of C, G and D underneath. No drums, no vocals. It ends unresolved on a held open chord that slowly fades. Peaceful, quiet, not epic.

link_swell · 8 秒
An 8 second rising shimmering swell where many soft instruments, glass bells, a low horn, tiny clock ticks and a stone hum, gradually speed up and then glide together into one sustained open chord of C, G and D, then fade gently. No drums, no vocals. Calm awe, not epic or cinematic.
```

### 驗音高（6a、6b 都要）

1. 用手機的調音器 App 或鋼琴 App 聽一下，4 個音是不是 G、C、D、G，結尾是不是 C／G／D 和弦。
2. 差不到半音以內：照收，Codex 會用播放速率校正。
3. 差更多：換 4 個版本裡的另一個，或把 prompt 的樂器描述微調後重生。
4. 實在抓不準的核心，先跳過，不要卡住整批。

## 批次 7：需要精準音高的單音與和弦墊（用 Sound Effects）

這幾個聲音的音高是遊戲邏輯的一部分（提燈與線索的單音、和弦墊、藏聲石的低鳴），所以要驗音高。驗法同批次 6：差不到半音，照收，Codex 會校正；差更多就換版本或重生。

```
tone_lantern_c4 · 3 秒 · Loop 關 · influence 65%
A single soft glass bell tone at the pitch C4 (middle C, 261 Hz), gentle attack and a slow natural decay of about 3 seconds, pure and clean. One note only, no melody, no chord. Dry, no reverb, no voices, no music.

tone_clue_g4 · 2.5 秒 · Loop 關 · influence 65%
A single soft glass bell tone at the pitch G4 (392 Hz), gentle attack and a slow natural decay of about 2 seconds, pure and clean. One note only, no melody, no chord. Dry, no reverb, no voices, no music.

hum_stone_g2 · 2.0 秒 · Loop 關 · influence 60%
A single soft deep resonant hum of a large stone at the low pitch G2 (98 Hz), a gentle swell then a slow decay, warm and low. One note only, no melody. Dry, no reverb, no voices, no music.

pad_csus2_loop · 25 秒 · Loop 開 · influence 40%
An extremely quiet, soft, sustained ambient pad of the notes C3, G3, C4 and D4 played together, a gentle suspended chord with no melody, no rhythm and almost no movement, warm and airy, barely audible. No drums, no vocals.
```

## 批次 8：倒影湖畔（第三張地圖）

這張地圖的聲音只講三件事：**水位**（退潮、漲潮中、滿潮聽起來不一樣）、**時段**（白天有鳥、夜裡有蟲，用現有的 10 分鐘日夜）、**倒影**（滿潮是整張地圖最安靜的時刻，安靜本身就是效果）。所以環境循環做得很少，聲音全部很輕。

**這批的先後（為了明天的展示影片）：**
- **第一優先**：8a 的 `lake_wind_reeds_loop`、`lake_lap_loop`、`lake_tide_rise_loop`、`lake_tide_fall_loop`，加 8b 的 `lake_wade_step`。影片是白天就加 `lake_birds_day`，夜裡就加 `lake_night_insects_loop`。
- **第二優先**（影片有拍到才需要）：8b 其餘、8c 休息的杯子、8d 特殊發現。
- 單音 `tone_item_d4` 和 `core_motif_03` 只有拍到取得物品或核心時才用。

### 8a 環境循環

```
lake_wind_reeds_loop · 25 秒 · Loop 開 · influence 35%
Soft open breeze over a wide shallow lake with faint dry reeds rustling, slow gentle gusts rising and falling, airy and wide. No whistling, no howling, no birds, no voices, no music.

lake_lap_loop · 25 秒 · Loop 開 · influence 35%
Very gentle small ripples lapping against smooth stones and soft mud at the edge of a calm shallow lake, tiny irregular wet clucks, quiet and clear. No waves crashing, no birds, no wind noise, no voices, no music.

lake_tide_rise_loop · 20 秒 · Loop 開 · influence 35%
Shallow water slowly creeping up and spreading over flat stone slabs, soft sheet-like trickling and quiet gentle gurgles, steady and calm. No waves, no splashes, no birds, no voices, no music.

lake_tide_fall_loop · 20 秒 · Loop 開 · influence 35%
Shallow water slowly draining off flat stone slabs through narrow gaps, soft thin trickling and tiny runnels, steady and calm. No waves, no splashes, no birds, no voices, no music.

lake_night_insects_loop · 25 秒 · Loop 開 · influence 35%
Very sparse soft night ambience beside a still lake, a few distant gentle crickets and tiny frog peeps with long silences, calm and quiet. No loud insects, no wind, no voices, no music.

lake_birds_day · 30 秒 · Loop 關 · influence 35%
Sparse distant birdsong over a wide quiet lake in daytime, a few soft small wetland bird calls and a faint distant duck, long silences between them, peaceful. No wind noise, no voices, no music.
```

### 8b 涉水、腳步與湖裡的生命（一發音效，WAV）

```
lake_wade_step · 0.7 秒 · Loop 關 · influence 65% · 留 4 版
Dry close-up, no reverb: one soft footstep wading through very shallow clear water over flat stone, a gentle small splash and a quiet ripple, quiet. No voices, no music.

lake_mud_step · 0.6 秒 · Loop 關 · influence 65% · 留 3 版
Dry close-up, no reverb: one soft footstep on wet mud near reeds, a gentle squelch with a faint suck, quiet. No voices, no music.

lake_cuff_roll · 1.5 秒 · Loop 關 · influence 60%
Dry close-up, no reverb: a person rolling up a trouser leg, a soft cloth fold and slide, gentle and quick. No voices, no music.

lake_fish_plip · 0.8 秒 · Loop 關 · influence 60% · 留 2 版
Close-up: a small fish jumping out of a calm lake and falling back in with a tiny plip and a faint ring of ripples, soft and quiet. No voices, no music.

lake_egret_takeoff · 2.0 秒 · Loop 關 · influence 55% · 留 2 版
A large white heron taking off from shallow water, a few slow soft wingbeats and drops of water falling, then fading away. Gentle, not loud. No voices, no music.

lake_arch_hop · 0.9 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a person hopping across a narrow gap of water and landing on a stone with a small soft splash, light and quiet. No voices, no music.
```

### 8c 休息時的杯子（第一次休息必播的故事動作）

```
lake_cup_flip · 0.8 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a ceramic cup turned right way up on a stone table, a soft ceramic scrape and a gentle knock. No voices, no music.

lake_tea_pour · 3.0 秒 · Loop 關 · influence 55%
Close-up: warm tea being poured slowly from a small iron kettle into a ceramic cup on a stone table, a soft thin stream and a gentle rising tone as the cup fills. Quiet. No voices, no music.

lake_cup_set · 0.6 秒 · Loop 關 · influence 65%
Dry close-up, no reverb: a ceramic cup set down gently on a stone table, one soft ceramic clink. No voices, no music.
```

### 8d 特殊發現（水位刻片、背銀鏡片、湖鏡）

```
lake_gauge_pry · 2.5 秒 · Loop 關 · influence 60%
Dry close-up: a wooden staff tip prying in a crack of an old stone pillar, a soft scrape, small stone fragments falling, then a thin copper plate sliding out and dropping with one small metallic clink. Quiet. No voices, no music.

lake_mirror_shard · 1.8 秒 · Loop 關 · influence 60%
Dry close-up, no reverb: a small mirror shard being gently worked loose from a wooden frame, a tiny glassy scrape and then a soft click as it comes free. Delicate and quiet. No voices, no music.

lake_mirror_rise · 5.0 秒 · Loop 關 · influence 45%
A circle of still water slowly lifting from flat to upright like a standing disc, soft liquid flowing and a gentle shimmering glassy resonance rising and then settling into calm. Mysterious and quiet, no melody, no splash, no voices, no music.
```

### 8e 取得物品的單音（所有地圖共用，這次一起做）

旅程信物（琥珀小型演出）只用單音。提燈是 C4，線索交會是 G4，信物取得定為 **D4**，三個音都在同一個調裡。生成後同樣要驗音高。

```
tone_item_d4 · 2.5 秒 · Loop 關 · influence 65%
A single soft glass bell tone at the pitch D4 (294 Hz), gentle attack and a slow natural decay of about 2 seconds, pure and clean, slightly warmer than a chime. One note only, no melody, no chord. Dry, no reverb, no voices, no music.
```

### 8f 取得核心「湖鏡」的旋律

用批次 6a 的範本，樂器是 `core_motif_03`：

```
core_motif_03 · 長度 6 秒 · 用 Eleven Music
Solo glass armonica, soft watery glass tones, no accompaniment, no drums, no vocals. A slow gentle four-note phrase G4, C5, D5, G5 in C major at about 50 BPM, the last note held and fading naturally. About 6 seconds, dry with very little reverb. Quiet, tender and simple.
```
