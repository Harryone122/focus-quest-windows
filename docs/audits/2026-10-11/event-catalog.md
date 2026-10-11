# 場景事件完整目錄

2026-10-11 由目前五份場景資料逐筆擷取。原始資料完整保留在 event-catalog.json；此表不是正式已播放清單。01 的新增故事不在 scene JSON，另依 cloudStory.ts 與故事設計列在 02-story-reveals.md。05 的 echoVisit／山風規則另由設計與試玩邏輯控制。

每張表區分事件原欄位、條件與結果；純演出不因列入本表就變成永久線索。沒有欄位不表示無條件，仍需對照正式 eligibility／排程。

## 01 雲上遺庭

來源：`docs/area-01-cloud-ruins.scene.json`。

### events（35 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| ev_edge_clouds | 站在島緣看雲海慢慢流過 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_blossom_watch | 抬頭看花瓣一片片落下 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_blossom_press | 撿起一片花瓣，夾進筆記本 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_stele_read | 讀著索引石碑上的字 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_stele_rubbing | 蹲下來拓一段碑文 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pillar_marks | 查看斷柱上的刻痕 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pillar_rest | 在斷柱旁坐下歇一會 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_lake_reflection | 蹲在湖邊看自己的倒影 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_lake_boat | 折了一艘紙船放進湖裡 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_falls_watch | 站在瀑布邊，看水落進雲裡 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_chest_look | 看了看半埋在土裡的箱匣 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_chest_open | 拂去泥土，打開半埋的箱匣 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_well_peek | 探頭往古井裡看 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_well_drink | 打了一瓢井水喝 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_tree_listen | 站在大樹下聽葉子的聲音 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_meadow_lie | 躺在草地上吹一會風 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_arch_vines | 伸手撫過拱門上的藤蔓 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_arch_gap | 在拱石的缺口摸到一枚舊銅扣 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_sign_read | 讀路標上褪色的字 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_astro_turn | 輕輕轉動黃銅星盤的環 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_astro_chart | 對著星盤記下幾顆星的位置 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_edge_sit | 坐在崖邊，看腳下的雲 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pav_sit | 在望亭裡坐一會 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_scope_look | 用望遠鏡看遠方的島 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_shrine_stone | 在小石祠前放一顆小石頭 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_shrine_bow | 在小石祠前靜靜站了一會 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pines_cone | 撿起一顆松果 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pines_breathe | 在松樹間伸個懶腰，深呼吸 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_falls_mist | 伸手接住瀑布飄上來的水霧 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_meadow_clover | 蹲在草地上找四葉草 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_edge_pebble | 撿起一顆小石子，輕輕丟進雲海 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_meadow_fireflies | 坐在草地上看螢火蟲 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| rare_well_wick | 打水時，桶裡撈上來一截用油布包著的舊燈芯 | {"once":true,"rare":true,"tier":"journey"} | {"note":"找到遺物「舊燈芯」。","item":{"id":"old_wick","name":"舊燈芯","kind":"relic","tags":["LIGHT"]},"outcome":"item","tagGain":["LIGHT"]} |
| rare_lake_lens | 看見淺水裡閃了一下，伸手撈起一片風化鏡片 | {"once":true,"rare":true,"tier":"journey"} | {"note":"找到遺物「風化鏡片」。","item":{"id":"weathered_lens","name":"風化鏡片","kind":"relic","tags":["OBSERVATION"]},"outcome":"item","tagGain":["OBSERVATION"]} |
| rare_astro_core | 看著星盤的環慢慢對齊，中心升起一顆星盤核心 | {"once":true,"rare":true,"tier":"core"} | {"note":"找到信物「星盤核心」。","item":{"id":"astrolabe_core","name":"星盤核心","kind":"token","tags":["OBSERVATION"]},"outcome":"item","tagGain":["OBSERVATION"]} |

### anywhereEvents（5 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| amb_stretch | 伸個懶腰 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| amb_clouds | 抬頭看雲 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| amb_birds | 看遠方飛過的鳥 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| amb_fireflies | 停下來看螢火蟲 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| amb_pack | 蹲下來整理背包 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |

### restActivities（4 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| rest_notes | 靠著大樹整理筆記 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| rest_lie | 躺在大樹旁的草地上吹風 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| rest_clouds | 坐在樹下看雲 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| rest_traces | 坐在樹下，看著旁邊那塊被壓平的草地出神 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |

其他環境與世界記憶規則見 JSON 快照的 `extraRules`；敘事知識、伏筆與回收分析見故事揭露表。

## 02 苔痕驛站

來源：`docs/area-02-moss-station.scene.json`。

### events（60 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| ev_bench_chime | 坐在長椅上聽風鈴 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_bench_notes | 在長椅上整理筆記 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_door_peek | 探頭看候車室裡的木頭長椅和掛鐘 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_window_peek | 探頭看售票窗口裡 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_window_ledger | 翻開窗口上的住宿簿 | {"once":true} | {"note":"住宿簿上的名字都被雨水暈開了，只有日期還看得清楚。","outcome":"note","tagGain":["ARCHIVE","MEMORY"]} |
| ev_sign_wipe | 擦去站名牌上的青苔 | {"once":true} | {"note":"擦掉站名牌上的青苔，字已經褪到讀不出來。","outcome":"note","tagGain":["MAP"]} |
| ev_edge_sit | 坐在月台邊晃腳，看著空鐵軌 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_bench2_sit | 在東側長椅坐一會 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_cart_look | 看行李推車上的舊皮箱 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_bede_water | 拿起澆水壺替花澆水 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_bedw_look | 蹲下來看花圃裡的小花 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_post_look | 看郵筒上的收件時間 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_post_drop | 投一張明信片進郵筒 | {"once":true} | {"note":"把一張寫給下一位旅人的明信片投進郵筒。","outcome":"note","tagGain":["MEMORY"]} |
| ev_jizo_stone | 在石地藏前放一顆小石頭 | 由正式調度判斷／見原資料 | {"outcome":"ambient","worldMark":"jizoPebbles"} |
| ev_jizo_cup | 替石地藏換上乾淨的小杯 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_jizo_rain | 看見石地藏前的杯子接滿了雨水 | {"weather":"afterRain","once":true} | {"note":"地藏前的小杯接滿了雨水，水面上浮著一片葉子。","outcome":"note","tagGain":["NATURE"]} |
| ev_rail_listen | 蹲下來把耳朵貼近鐵軌 | {"weather":"dry","once":true} | {"note":"鐵軌很安靜，好像已經很久沒有車經過了。","outcome":"note","tagGain":["OBSERVATION"]} |
| ev_rail_walk | 張開雙手，沿著一條鐵軌走平衡 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_trestle_gaze | 站在鐵道棧橋上，看鐵軌消失在霧裡 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_signal_look | 抬頭看生鏽的腕木號誌 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_signal_pull | 試著扳動號誌，臂板吱一聲落下 | {"weather":"dry","once":true} | {"note":"扳了一下號誌，臂板落到「可通行」的位置。","outcome":"note","worldMark":"signalLowered","tagGain":["MAP"]} |
| ev_tunnel_listen | 站在隧道口聽自己的回聲 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_tunnel_wind | 隧道深處吹出一陣涼風 | {"once":true} | {"note":"隧道深處吹出一陣風，帶著一點煤煙的味道。","outcome":"note","tagGain":["UNDERGROUND"]} |
| ev_wagon_look | 看貨車門上褪色的貨籤 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_wagon_shelter | 坐在貨車門口，聽雨打在車頂上 | {"weather":"rain"} | {"outcome":"ambient"} |
| ev_wagon_label | 在貨車的乾草堆裡翻到一張舊貨籤 | {"weather":"rain","once":true} | {"note":"在貨車的乾草堆裡翻到一張舊貨籤，上面寫著一個沒聽過的站名。","outcome":"note","tagGain":["MAP"]} |
| ev_spring_drink | 在湧泉邊捧水喝 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_boat_look | 蹲在棧橋上，看繫在旁邊的小舟輕輕搖晃 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pier_falls | 站在棧橋盡頭，聽溪水從崖邊落進霧裡 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_boat_bail | 把小舟裡的雨水舀出去 | {"weather":"afterRain"} | {"outcome":"ambient"} |
| ev_boulder_touch | 伸手摸苔石上的青苔 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_boulder_stack | 在苔石頂上疊一顆小石頭 | 由正式調度判斷／見原資料 | {"outcome":"ambient","worldMark":"boulderStones"} |
| ev_boulder_snail | 看一隻蝸牛慢慢爬上苔石 | {"weather":"afterRain"} | {"outcome":"ambient"} |
| ev_tablet_read | 讀舊道標上的刻字 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_brook_look | 蹲在溪邊看水流 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_brook_wash | 在溪邊洗手 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_brook_high | 看溪水漲起來，淹過了踏石 | {"weather":"rain"} | {"outcome":"ambient"} |
| ev_log_mushroom | 蹲下來看倒木上的蕈菇 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_rim_gaze | 站在崖邊，看霧海底下若隱若現的山 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_rim_sit | 坐在崖邊晃腳 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_rim_note | 對著霧海畫下遠方的稜線 | {"weather":"dry","once":true} | {"note":"畫下霧海對面的稜線，其中一座山頂有個像塔的影子。","outcome":"discovery","tagGain":["OBSERVATION"]} |
| ev_falls_watch | 看溪水落進霧裡 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_basin_drink | 用竹杓舀水喝 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_basin_fill | 把水壺裝滿 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_arch_vines | 在樹根拱下抬頭看垂下來的藤 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_arch_shelter | 躲在樹根拱下等雨小一點 | {"weather":"rain"} | {"outcome":"ambient"} |
| ev_arch_fern | 碰了一下蕨葉，水珠一顆顆灑下來 | {"weather":"afterRain"} | {"outcome":"ambient"} |
| ev_hut_peek | 從窗口往住宿小屋裡看 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_hut_bed | 推開住宿小屋的門 | {"once":true} | {"note":"小屋裡的床已經鋪好了，枕邊放著一包還溫溫的烤栗子。","outcome":"note","tagGain":["MEMORY"]} |
| ev_hut_eaves | 站在小屋簷下看雨從蕨葉上滴下來 | {"weather":"rain"} | {"outcome":"ambient"} |
| ev_wood_chop | 劈幾塊柴，堆回柴堆 | {"weather":"dry"} | {"outcome":"ambient"} |
| ev_door_rain | 站在候車室門口看雨 | {"weather":"rain"} | {"outcome":"ambient"} |
| ev_bench_rain | 坐在簷下的長椅上看雨 | {"weather":"rain"} | {"outcome":"ambient"} |
| ev_umbrella_borrow | 從門口的傘架借了一把傘 | {"weather":"rain","once":true} | {"note":"候車室門口的傘架上，有人留了一把傘。","outcome":"note","tagGain":["MEMORY"]} |
| ev_umbrella_return | 把傘掛回傘架，旁邊留一條擦乾的手巾 | {"weather":"afterRain","once":true} | {"note":"把傘掛回去，在旁邊留了一條擦乾的手巾，給下一個人。","outcome":"note","worldMark":"towelLeft"} |
| ev_drips_watch | 看簷下的水珠一顆顆落下 | {"weather":"afterRain"} | {"outcome":"ambient"} |
| rare_cart_tag | 翻看推車上的舊皮箱，解下掛在提把上的木牌 | {"once":true,"rare":true,"tier":"journey"} | {"note":"取得旅程信物「舊荷札」：木牌上刻著一個站名和一組編號。","item":{"id":"old_luggage_tag","name":"舊荷札","kind":"journey","tags":["MAP"]},"outcome":"item","tagGain":["MAP"]} |
| rare_tablet_rubbing | 在舊道標上拓印，紙上浮現被磨掉的字 | {"weather":"notRain","once":true,"rare":true,"tier":"journey"} | {"note":"取得旅程信物「炭印紙」：拓下道標上被磨掉的記號。","item":{"id":"charcoal_rubbing","name":"炭印紙","kind":"journey","tags":["ARCHIVE"]},"outcome":"item","tagGain":["ARCHIVE"]} |
| rare_ledger_rubbing | 住宿簿裡夾著一張別人已經拓好的炭印紙 | {"weather":"rain","once":true,"rare":true,"tier":"journey"} | {"note":"取得旅程信物「炭印紙」：有人拓好了，夾在住宿簿裡。","item":{"id":"charcoal_rubbing","name":"炭印紙","kind":"journey","tags":["ARCHIVE"]},"outcome":"item","tagGain":["ARCHIVE"]} |
| rare_drawer_compass | 拉開窗口下的遺失物抽屜，裡面有一個掛著行李牌的舊羅盤 | {"once":true,"rare":true,"tier":"core"} | {"note":"取得地圖核心「裂痕羅盤」：行李牌上寫著「給下一位旅人」。","item":{"id":"cracked_compass","name":"裂痕羅盤","kind":"core","tags":["MAP","MEMORY"]},"outcome":"item","tagGain":["MAP","MEMORY"]} |

### anywhereEvents（5 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| amb_stretch | 伸個懶腰 | {"weather":"dry"} | 未列永久結果；見原資料與正式程式 |
| amb_clouds | 抬頭看霧慢慢飄過 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| amb_pack | 蹲下來整理背包 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| amb_fireflies | 停下來看溪邊的螢火蟲 | {"weather":"dry"} | 未列永久結果；見原資料與正式程式 |
| amb_hat | 扶正帽子，抖掉帽簷上的雨水 | {"weather":"rain"} | 未列永久結果；見原資料與正式程式 |

### restActivities（6 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| rest_bench_first | 發現長椅上有人留下一條摺好的毯子和一壺熱茶 | {"once":true} | {"worldMark":"bench_tea_seen"} |
| rest_notes | 坐在候車室長椅上整理筆記 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| rest_chime | 坐在長椅上聽風鈴 | {"weather":"dry"} | 未列永久結果；見原資料與正式程式 |
| rest_tea | 倒一杯茶，看著月台 | {"requires":"bench_tea_seen"} | 未列永久結果；見原資料與正式程式 |
| rest_edge | 坐在月台邊晃腳，看著空鐵軌 | {"weather":"dry"} | 未列永久結果；見原資料與正式程式 |
| rest_rain | 坐在簷下看雨 | {"weather":"rain"} | 未列永久結果；見原資料與正式程式 |

### storyEvents（10 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| story_open_carving | 撥開第一盞燈燈柱上的青苔，讀到刻字 | {"requires":{"firstExplorationOfGame":true},"kind":"opening"} | {"clue":"m02_open","worldMark":"carvingSeen"} |
| story_first_lantern | 看一盞熄掉的提燈漂過棧橋，落進霧瀑 | {"requires":{"clueMissing":"h1b"},"weather":"notRain","kind":"firstVisit"} | {"clue":"h1b"} |
| story_first_lantern_rain | 在貨車門口躲雨時，看漲起來的溪水沖走一盞熄燈 | {"requires":{"clueMissing":"h1b"},"weather":"rain","kind":"firstVisit"} | {"clue":"h1b"} |
| story_second_sketch | 住宿簿裡滑出一張畫 | {"requires":{"clueOwned":"h1b","clueMissing":"h1c","notSameExplorationAs":"h1b"},"kind":"secondVisit"} | {"clue":"h1c"} |
| story_core_newtag | 空抽屜裡多了一張新的行李牌 | {"requires":{"coreOwned":"cracked_compass","explorationStartedAfterCore":true,"clueMissing":"c02"},"kind":"coreGated"} | {"clue":"c02","worldMark":"drawerTagLeft"} |
| story_core_ledger08 | 住宿簿上寫著自己住過的那一晚 | {"requires":{"coreOwned":"08 未寫成的日記（id 待 08 設計時定）","clueMissing":"c08"},"kind":"coreGated"} | {"clue":"c08"} |
| carry_old_wick | 拿著舊燈芯，看熄燈漂過棧橋 | {"requires":{"carrying":"old_wick"},"weather":"notRain","kind":"itemCarry"} | {"clue":"m02_wick","clueOnce":true,"card":"一盞熄掉的提燈漂過棧橋，裡面的燈芯和舊燈芯一模一樣。"} |
| carry_weathered_lens | 透過風化鏡片看霧那頭的塔 | {"requires":{"carrying":"weathered_lens"},"weather":"notRain","kind":"itemCarry"} | {"clue":"m02_lens","clueOnce":true,"card":"透過風化鏡片，看得見霧那一頭山頂上的塔。"} |
| carry_charcoal_rubbing | 在褪色的站名牌上拓印 | {"requires":{"carrying":"charcoal_rubbing","note":"本圖的信物，同一次探索取得之後才可能發生"},"weather":"notRain","kind":"itemCarry"} | {"clue":"m02_sign","clueOnce":true,"card":"在站名牌上拓出「苔痕」兩個字，後面的拓不出來。"} |
| carry_mulch_cloth | 用護根布包起地藏小杯裡的幼苗 | {"requires":{"carrying":"護根布（07 玻璃苗圃，id 待定）"},"kind":"itemCarry"} | {"clue":"m02_sapling","clueOnce":true,"card":"地藏的小杯裡長出一株幼苗，根已經用護根布包好。"} |

### specialFinds（4 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| journey | ["rare_cart_tag","rare_tablet_rubbing"] | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| journeyRainVariants | 見原資料 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| core | ["rare_drawer_compass"] | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| note | §46：每次完整探索必得兩種旅程信物之一（可落在任一盞燈）；核心每盞 5%、第五次保底。抽中炭印紙時，若旅人出發去取得的當下正在下雨，改播 rare_ledger_rubbing（同一件物品、同一筆保存結果，只換取得地點）。 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |

其他環境與世界記憶規則見 JSON 快照的 `extraRules`；敘事知識、伏筆與回收分析見故事揭露表。

## 03 倒影湖畔

來源：`docs/area03/area-03-reflection-lake.scene.json`。

### events（44 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| ev_gauge_read | 數標尺上露出水面的刻線 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_gauge_wipe | 擦去標尺上的濕泥 | {"tide":"low","once":true} | {"note":"標尺最高那道刻線，比見過的任何一次潮水都高。","outcome":"note","tagGain":["MAP"]} |
| ev_boat_look | 看船裡的積水和撐篙 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_boat_bail | 用手舀出船底的積水 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_pool_fish | 蹲在潮池邊看小魚 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_pool_shell | 撿一枚貝殼，排到小船的船舷上 | {"tide":"low"} | {"outcome":"ambient","worldMark":"boatShells"} |
| ev_reeds_egret | 安靜地看白鷺 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_reeds_wind | 聽風吹過蘆葦 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pillar_touch | 摸斷柱上的水痕 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pillar_sit | 坐在斷柱腳下休息 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_stele_wipe | 擦去石面水痕 | {"tide":"low","once":true} | {"note":"水痕擦掉了，底下沒有字，只有更舊的水痕。","outcome":"note","tagGain":["ARCHIVE"]} |
| ev_stele_look | 端詳石碑 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_column_sit | 靠著倒柱坐下看湖 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_breach_look | 蹲下看水下沉著的石板 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_breach_pebble | 往破口丟一顆小石子 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_stair_notes | 坐在石階上整理筆記 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_steps_sit | 坐著看石階一階一階沉進水裡 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_steps_count | 數露出水面的台階 | {"tide":"low","once":true} | {"note":"退潮時沉階露出四階，下面還有很多。","outcome":"note","tagGain":["MAP"]} |
| ev_seat_sit | 在亭台南緣的石凳上坐一會 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_mirror_look | 看破掉的鏡框 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_mirror_wipe | 用袖子擦那一角鏡片 | {"requires":"shardPresent","once":true} | {"note":"鏡片照出來的亭子，好像比現在新。","outcome":"note","tagGain":["MEMORY"]} |
| ev_roots_sit | 坐在松根上 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_roots_cone | 撿一顆松果，放到第四盞燈旁的岩石上 | 由正式調度判斷／見原資料 | {"outcome":"ambient","worldMark":"pineCones"} |
| ev_branch_gaze | 看長枝的枝尖垂向水面 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_ring_look | 蹲在石環邊看靜止的水 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_ring_count | 一顆一顆數環上的石頭 | {"once":true} | {"note":"石環有十四顆石頭。圈裡的水連風都吹不動。","outcome":"note","tagGain":["MEMORY"]} |
| ev_pier_sit | 坐在燈旁的棧道上歇腳 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_arch_look | 看遠方踏石淡進薄霞 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_stones_hop | 跳一顆踏石再跳回來 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_far_gaze | 看東方的薄霞 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pond_watch | 蹲著看睡蓮葉 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_pond_touch | 輕撥腳邊的葉片 | {"tide":"high"} | {"outcome":"ambient"} |
| ev_pond_bloom | 看睡蓮一朵一朵打開 | {"requires":"flowersOpen","tide":"high","once":true} | {"note":"水漲上來，池裡的睡蓮一朵一朵開了。","outcome":"note","tagGain":["MEMORY"]} |
| ev_seat_rest | 坐在池邊的石板上 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_moon_look | 看著橋洞 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_moon_full | 看橋洞和倒影合成一輪滿月 | {"tide":"high","once":true} | {"note":"水漲到拱腳，橋洞和倒影合成一輪滿月。圓裡是晚上。","outcome":"note","tagGain":["MEMORY"]} |
| ev_crown_stand | 站在橋頂看水 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| ev_crown_night | 低頭看腳下圓裡的月亮 | {"tide":"high"} | {"outcome":"ambient"} |
| ev_bank_sit | 坐在岸邊，看著橋 | {"tide":"low"} | {"outcome":"ambient"} |
| ev_banyan_root | 摸垂下來的氣根 | 由正式調度判斷／見原資料 | {"outcome":"ambient"} |
| rare_gauge_plate | 在標尺腳邊撬下一片銅片 | {"tide":"low","rare":true,"tier":"journey"} | {"item":{"id":"tide_gauge_plate","name":"水位刻片","kind":"journey"},"outcome":"find"} |
| rare_boat_plate | 從小船座板下抽出一片銅片 | {"tide":"high","rare":true,"tier":"journey"} | {"item":{"id":"tide_gauge_plate","name":"水位刻片","kind":"journey"},"outcome":"find"} |
| rare_mirror_shard | 取下鏡框角落的鏡片 | {"rare":true,"tier":"journey"} | {"item":{"id":"silvered_shard","name":"背銀鏡片","kind":"journey"},"outcome":"find"} |
| rare_ring_mirror | 碰石環裡的水 | {"rare":true,"tier":"core"} | {"item":{"id":"lake_mirror","name":"湖鏡","kind":"core"},"outcome":"find"} |

### anywhereEvents（7 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| amb_stretch | 伸個懶腰 | {"condition":"any"} | 未列永久結果；見原資料與正式程式 |
| amb_pack | 蹲下來整理背包 | {"condition":"low tide (feet dry)"} | 未列永久結果；見原資料與正式程式 |
| amb_watch_water | 蹲在水邊看水 | {"condition":"low tide; faces the nearest water or puddle"} | 未列永久結果；見原資料與正式程式 |
| amb_clouds | 低頭看水裡的雲慢慢飄過 | {"condition":"dawn, day, dusk"} | 未列永久結果；見原資料與正式程式 |
| amb_reflection | 低頭看自己的倒影，輕輕晃一下身體 | {"condition":"high tide"} | 未列永久結果；見原資料與正式程式 |
| amb_spin | 張開手慢慢轉一圈 | {"condition":"high tide; 0.45 free around the body (node.spin)"} | 未列永久結果；見原資料與正式程式 |
| amb_fireflies | 停下來看螢火蟲 | {"condition":"night; lamp 1 or lamp 4"} | 未列永久結果；見原資料與正式程式 |

### restActivities（5 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| rest_cup_first | 在石凳上坐下，翻開身旁倒扣的杯子，倒茶慢慢喝 | {"once":true} | {"worldMark":"cupLeft"} |
| rest_notes | 坐著整理筆記 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| rest_lake | 坐著看湖 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| rest_tea | 再倒一杯茶，看著湖 | {"requires":"cupLeft"} | 未列永久結果；見原資料與正式程式 |
| rest_mirror | 坐著看整片湖變成鏡子 | {"tide":"high"} | 未列永久結果；見原資料與正式程式 |

### storyEvents（9 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| story_open_gauge | 擦掉標尺頂上的泥痕，露出「從這裡開始。」 | {"requires":{"firstExplorationOfGame":true},"tide":"low","kind":"opening"} | {"clue":"m03_open","worldMark":"gaugeCarving"} |
| story_first_lag | 轉身要走時，腳下的倒影還望著亭子 | {"requires":{"clueMissing":"m03_lag"},"tide":"high","kind":"firstVisit"} | {"clue":"m03_lag"} |
| story_second_cup | 沉階上只有他的杯子，倒影裡卻有兩只 | {"requires":{"clueHas":"m03_lag","clueMissing":"c03"},"tide":"high","kind":"secondVisit"} | {"clue":"c03"} |
| story_core_ring | 石環的水又靜了一下，倒影裡環上放著一雙舊靴子 | {"requires":{"hasCore":"rare_ring_mirror","exploredAfterCore":true,"clueMissing":"c03b"},"tide":"high","kind":"coreGated"} | {"clue":"c03b"} |
| carry_old_wick | 拿出舊燈芯，看見沉階下沉著一盞提燈 | {"tide":"low","carry":"old_wick","kind":"itemCarry"} | {"clue":"m03_wick"} |
| carry_weathered_lens | 透過風化鏡片，橋的倒影裡橋頂放著一盞提燈 | {"tide":"high","carry":"weathered_lens","kind":"itemCarry"} | {"clue":"m03_lens"} |
| carry_old_luggage_tag | 船頭刻著和荷札同一種寫法的編號 | {"tide":"low","carry":"old_luggage_tag","kind":"itemCarry"} | {"clue":"m03_tag"} |
| carry_tide_plate | 把水位刻片對著橋墩的潮痕比 | {"tide":"low","carry":"rare_gauge_plate","kind":"itemCarry"} | {"clue":"m03_plate"} |
| carry_silvered_shard | 用背銀鏡片把光照到石凳上，照出兩個杯印 | {"tide":"any","carry":"rare_mirror_shard","kind":"itemCarry"} | {"clue":"m03_shard"} |

### specialFinds（4 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| journey | ["rare_gauge_plate","rare_mirror_shard"] | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| journeyTideVariants | 見原資料 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| core | ["rare_ring_mirror"] | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| note | 每次完整探索必得兩種旅程信物之一（可落在第 1–4 盞燈之間）；核心每盞燈 5%、第五次保底（保底由 App 做）。抽中水位刻片時，若旅人出發去取得的當下是滿潮，改播 rare_boat_plate（同一件物品、同一筆保存結果，只換取得地點）。 | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |

其他環境與世界記憶規則見 JSON 快照的 `extraRules`；敘事知識、伏筆與回收分析見故事揭露表。

## 07 玻璃苗圃

來源：`docs/area07/area-07-glass-nursery.scene.json`。

### storyEvents（5 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| story_first_tray | crouch | {"rule":"no clue m07_tray"} | {"clue":"m07_tray"} |
| story_second_chart | trace | {"rule":"has m07_tray, no m07_chart"} | {"clue":"m07_chart"} |
| carry_silvered_shard | reach | {"rule":"carrying silvered_shard (03); forces heavy-fog look"} | {"clue":"m07_glass (first time only)"} |
| carry_sapling | crouch | {"rule":"carrying the wrapped sapling in the luggage (taken at 02 in any earlier journey, kept until planted); not yet planted"} | {"clue":"m07_planted","worldMark":"saplingStage = 0 (planted in tray 6); +1 on each later visit to 07, max 2"} |
| caretaker_transplant | 見原資料 | {"rule":"saplingStage == 2 (planted, then 2 later visits) and not transplanted; after that focus the lobby asks 「要把它移出苗盤嗎？」 / 「再讓它長一陣子」; plays only if the player chooses to move it; the journey continues normally afterwards","kind":"branch ending (照料者支線結局)"} | {"clue":"m07_transplant","worldMark":"saplingTransplanted"} |

### ambient（9 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| machineWalk | look | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| wipe | wipe | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| potRight | crouch | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| pool | crouch | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| lean | look | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| valve | turn | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| trough | crouch | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| stairSit | sit | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |
| tree | up | 由正式調度判斷／見原資料 | 未列永久結果；見原資料與正式程式 |

### specialFinds（3 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| find_pressed_leaf | 壓葉標本 | {"tier":"journey"} | {"itemKey":"pressed_leaf"} |
| find_mulch_cloth | 護根布 | {"tier":"journey"} | {"itemKey":"mulch_cloth"} |
| find_core | 封存種莢 | {"tier":"core"} | {"itemKey":"sealed_seed_pod"} |

其他環境與世界記憶規則見 JSON 快照的 `extraRules`；敘事知識、伏筆與回收分析見故事揭露表。

## 05 藏聲秋谷（獨立試玩／草案）

來源：`docs/area05/area-05-echo-quarry.scene.json`。

### storyEvents（7 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| story_first_two_notes | one strike; the echo comes back as two waves (warm, then a cool one 1.2 s later) — prototype actFx(1) | {"when":"no m05_two_notes clue","type":"firstVisit"} | {"clue":"m05_two_notes"} |
| story_second_wall_voice | faint warm wave from the wall, subtitle 「……柴都濕了。」 | {"when":"has m05_two_notes, no h2c, not the exploration that gave m05_two_notes","type":"secondVisit"} | {"clue":"h2c (already in collectionRoom.ts)"} |
| core_voice_stone | three quickening hums; warm light dims, blue rises; stone lifts and spins, motes drawn in; big blue wave R15 + R22, screen blue flash; stone shrinks along an arc into the backpack; pedestal empty, hum stops for good | {"when":"core roll hits (5% per lamp, pity by 5th exploration, §46.4)","type":"core"} | 未列永久結果；見原資料與正式程式 |
| carry_charcoal_rubbing | rubs the worn marks | {"when":"carrying charcoal_rubbing (02)","type":"carryItem"} | {"clueOnce":"m05_rubbing","clueText":"刻痕排起來，像石磬的長短。"} |
| carry_copper_wind_whistle | blows the whistle at the wind-hole crag; then cut to the cave: the sealed wall hums four times, shivers, grit falls from the seams | {"when":"carrying copper_wind_whistle (04)","type":"carryItem"} | {"clueOnce":"m05_whistle","clueText":"風哨一響，洞裡有一面牆跟著嗡，那後面是空的。"} |
| ambient_first_wind | nobody strikes it: the great bell rings 13 times | {"when":"first mountain wind (山風石歌)","type":"ambientFirst"} | {"clue":"m05_thirteen","clueText":"沒有人敲，鐘樓的大鐘自己響了十三下。","note":"feeds 09 clock face 看懂; wording still to be confirmed by the user"} |
| echo_visit | cave mouth lets out the sound he made once; he walks in to fork J, the stone plays the sound back, he walks out | {"when":"see echoVisit rules","type":"ambientVisit"} | {"clue":null,"rewards":"none (purely visual)"} |

### specialFinds（3 筆）

| ID | 名稱／描述／動作 | 前置欄位 | 結果／記錄欄位 |
| --- | --- | --- | --- |
| 無獨立 ID | 調音叉 | {"kind":"journeyItem"} | 未列永久結果；見原資料與正式程式 |
| 無獨立 ID | 薄雲母片 | {"kind":"journeyItem"} | 未列永久結果；見原資料與正式程式 |
| 無獨立 ID | 藏聲石 | {"kind":"core"} | 未列永久結果；見原資料與正式程式 |

其他環境與世界記憶規則見 JSON 快照的 `extraRules`；敘事知識、伏筆與回收分析見故事揭露表。

### 一般互動點／動作（不是新增獎勵事件）

| ID | 完整動作資料 |
| --- | --- |
| 1 | {"id":1,"name":"石磬架","marker":[0.9,1.344,-1.5],"standTarget":[1.5,-0.5],"approachAfter":[],"leaveVia":[],"look":[0.9,-1.5],"pose":"reach","blurb":"旅人敲了敲石磬，站著聽它的回聲。","makesSound":"chime"} |
| 2 | {"id":2,"name":"聽音喇叭","marker":[14.6,1.674,0.2],"standTarget":[15.5,0],"approachAfter":[],"leaveVia":[],"look":[14.6,0.2],"pose":"listen","blurb":"旅人把耳朵湊近銅喇叭，聽見遠處的水聲被放大了。","makesSound":null} |
| 3 | {"id":3,"name":"回音巨石","marker":[-4.6,3.525,3.4],"standTarget":[-3,4.5],"approachAfter":[],"leaveVia":[],"look":[-4.6,3.4],"pose":"call","blurb":"旅人對著巨石的凹洞喊了一聲，回聲慢了一拍才回來。","makesSound":"echo"} |
| 4 | {"id":4,"name":"觀景平台（休息點）","marker":[4.349,0.618,19.009],"standTarget":[3.5,20],"approachAfter":[[3.39,19.887],[3.115,19.216],[3.89,18.507],[4.29,19.063]],"leaveVia":[[3.89,18.507],[3.115,19.216],[3.39,19.887]],"look":[7.888,15.766],"pose":"sitGaze","blurb":"旅人在觀景平台坐下，看雲海慢慢流過。","makesSound":null} |
| 5 | {"id":5,"name":"吊橋與鐘樓","marker":[7.6,3,9.6],"standTarget":[24,10.5],"approachAfter":[[23.4,10.25],[11.52,10.25],[8.55,12.62]],"leaveVia":[[11.52,10.25],[23.4,10.25]],"look":[7.6,12.6],"pose":"reach","blurb":"旅人走過吊橋登上鐘樓，拉動撞木。大鐘的聲音一路滾過雲海。","makesSound":"bell"} |
| 6 | {"id":6,"name":"風孔岩","marker":[0.6,3.464,21.8],"standTarget":[2.5,22],"approachAfter":[],"leaveVia":[],"look":[0.6,21.8],"pose":"listen","blurb":"風從岩壁的孔洞吹過，發出低低的嗚嗚聲。","makesSound":"wind"} |
| 7 | {"id":7,"name":"水車鋸石坊","marker":[-7.85,5.556,12.05],"standTarget":[-7.5,8.5],"approachAfter":[],"leaveVia":[],"look":[-7.85,11.6],"pose":"inspect","blurb":"水車一圈一圈地轉，鋸子慢慢切開石塊。","makesSound":null} |
| 8 | {"id":8,"name":"石拱橋","marker":[-4,1.765,12.85],"standTarget":[-3.5,10.5],"approachAfter":[[-3.746,10.967],[-4,12.85]],"leaveVia":[[-3.746,10.967]],"look":[-1.027,13.252],"pose":"look","blurb":"旅人站在橋頂，看溪水一路流向瀑布。","makesSound":null} |
| 9 | {"id":9,"name":"瀑布口","marker":[0.582,0.982,15.303],"standTarget":[0.5,16],"approachAfter":[],"leaveVia":[],"look":[12,12],"pose":"gaze","blurb":"旅人靠在欄繩旁，看水落進深淵。","makesSound":null} |
| 10 | {"id":10,"name":"風化記號石","marker":[6.2,2.046,0.4],"standTarget":[7,1],"approachAfter":[],"leaveVia":[],"look":[6.2,0.4],"pose":"crouch","blurb":"旅人蹲下來，用指尖摸石面上磨平的刻痕。","makesSound":null} |
| 11 | {"id":11,"name":"纜車站","marker":[9.8,4.054,-2],"standTarget":[9,-1.5],"approachAfter":[],"leaveVia":[],"look":[9.8,-2],"pose":"gaze","blurb":"旅人看著纜車慢慢滑進遠處的霧裡。","makesSound":null} |
| 12 | {"id":12,"name":"共鳴洞","marker":[11.4,4.3,-9],"standTarget":[11.5,-6.5],"approachAfter":[],"leaveVia":[],"look":[11.4,-8.4],"pose":"listen","blurb":"洞口傳來很輕的嗡聲，像有人在深處哼歌。","makesSound":null} |
| 13 | {"id":13,"name":"聲壁","marker":[15.6,4.6,-9],"standTarget":[16,-8],"approachAfter":[],"leaveVia":[],"look":[15.6,-9.2],"pose":"reach","blurb":"旅人輕敲聲壁，整面岩壁都跟著嗡了一下。","makesSound":"wall"} |
| 14 | {"id":14,"name":"石材推車","marker":[14.6,2.9,-7.2],"standTarget":[14.5,-5.5],"approachAfter":[],"leaveVia":[],"look":[14.6,-7.2],"pose":"inspect","blurb":"旅人摸了摸推車上的方石，還帶著涼意。","makesSound":null} |
| 15 | {"id":15,"name":"起重架與方石","marker":[14.2,3.968,-4],"standTarget":[14,-5.5],"approachAfter":[],"leaveVia":[],"look":[14.2,-4],"pose":"gaze","blurb":"旅人抬頭看起重架，鐵鏈偶爾輕輕作響。","makesSound":null} |
| 16 | {"id":16,"name":"鋸切壁鷹架","marker":[17.6,4.7,-8.6],"standTarget":[17.5,-8],"approachAfter":[],"leaveVia":[],"look":[17.6,-9.1],"pose":"gaze","blurb":"旅人看著鋸切壁上排得整整齊齊的鑽孔。","makesSound":null} |
| 17 | {"id":17,"name":"絞盤吊籠","marker":[22.615,2.222,4.422],"standTarget":[23.5,3.5],"approachAfter":[],"leaveVia":[],"look":[12,12],"pose":"reach","blurb":"旅人轉了轉絞盤，吊籠在霧裡晃了晃。","makesSound":null} |

