你要幫 Windows 專注遊戲「Focus Quest」修改第三張地圖「倒影湖畔」的網頁原型。設計由另一個對話（Opus）負責，你照規格實作，不做設計決定。這一段叫「3C」：重做兩個漲潮小區域（浮葉小庭 → 睡蓮池、缺月石廊 → 疊月橋）和夜裡的月光。

如果你之前做過這一段的預覽：使用者看過了，Opus 已經依意見修改規格，這份指令取代之前所有版本。

## 協作硬規定（使用者定的，一定要遵守）

1. 先預覽、後實作：先做出「完整地圖」的預覽給使用者看，然後停下來等。使用者會帶回 Opus 對話討論，拿到 Opus 的回覆後，你才正式實作。不可以跳過預覽直接做。
2. 預覽要在完整地圖裡：不是單獨的物件特寫。用全圖截圖＋可以打開的草稿網頁。
3. 做完要給使用者親自試：正式實作完成後，用 SendUserFile 把測試網頁傳給使用者（display: "render"），讓他自己打開、試看漲潮和時段，再回 Opus 對話討論。

## 專案位置

使用者電腦上的 C:\Users\User\Documents\game project\focus-quest-windows。需要時用 device_request_folder_access 申請 C:\Users\User\Documents\game project。讀檔用 device_bash／device_stage_files，寫回用 device_commit_files（stagedPath 必須在 /mnt/user-data/outputs/ 底下）。查 git 一定加 GIT_OPTIONAL_LOCKS=0；不准 commit、reset、stash。

## 先讀（依序）

1. docs/area03/SPEC.md 第 9 節。9.6 是最新修訂，優先於 9.2、9.4；9.6.4 又優先於 9.4 與 9.6.3 裡關於湖面月亮的部分。另外讀第 0、8.3 節（座標、走路與穿模規則）
2. docs/area03/CHECKLIST.md 的「第 3C 段」
3. docs/area03/DECISIONS.md 第 2、8–11 項（全圖都是湖面；湖面上不放月亮）
4. docs/area03/TIDAL_AREAS_REPORT.md（Codex 原本的做法，你要取代的東西）
5. docs/area03/ref/lily-pond-draft.js（Opus 的睡蓮池草稿，未測試，可以拿來改）。同資料夾的 moon-water-draft.glsl.txt 是湖面月亮的舊草稿，現在湖面不放月亮，只能參考它的寫法
6. docs/area03/qa/README.md（走面與穿模檢查工具）
7. 原型 docs/prototypes/reflection-lake.html：地形定義搜尋 const LEAF_POLY；兩區模型搜尋 two tide-revealed pockets 到 function tidalUpdate 結束；Codex 的湖面月亮在湖面 shader FRAG 裡搜尋 moonP；夜晚光線在 const PRE 的 night；內嵌 JSON 在 area-data；預覽按鈕搜尋 moonView

## 這一段要做出來的樣子（細節以 SPEC 第 9 節為準）

### A. 睡蓮池（SPEC 9.3）
- 拿掉三個圓形水槽、舊葉片、星形花。小庭改成圓潤的外形，中間沉下一個不規則淺池（池底 y −0.07）；池邊石（西側走路那邊是平的）、池東肩一塊約 0.8 高的立石、3–4 叢開紫花的菖蒲。
- 睡蓮葉約 36 片，小而多、有 V 形缺口、成群，中間留一塊開放水面。退潮時葉子還捲著，漲潮時依序攤平浮起。
- 睡蓮花 6–7 朵，直徑約 0.32–0.36：4 片綠萼片＋兩圈花瓣＋黃色花心，杯狀；閉合時是花苞，漲潮時錯開時間盛開。葉子、花瓣、花心各用一個 InstancedMesh。
- 石凳改成兩塊低石托著一塊風化長石板，位置不變。三個節點 leaf_entry、leaf_watch、leaf_seat 不變。

### B. 疊月橋（SPEC 9.2＋9.6.1）
- 拿掉 Codex 的厚拱圈、八角台、方塊殘牆與碎石。
- 一座嶺南花崗岩單孔石拱橋，橋軸沿 u、v = 7.55、中心 u = −7.1，拱面朝鏡頭。半圓拱淨跨 2.2（R = 1.1），起拱線一定在 y = 0.30：滿潮時拱＋倒影是正圓，不是長圓；起拱線以下的橋墩滿潮時全在水下。
- 側面輪廓是平順的駝峰弧線：台階只在橋面上、藏在欄杆後面，拱肩牆頂和欄杆頂用 10–14 段折線逼近圓弧，不要階梯狀的側影。
- 低矮實心石欄板＋壓頂石；望柱只留 6 根（兩端、斜坡中段、橋頂兩側各一對），只比欄板高 0.08–0.1。券石徑向 0.16、顏色只比牆面亮一點、縫細。兩側拱肩各一個淺圓形月輪浮雕。
- 兩岸是貼著水面、邊緣不規則的低石岸，不是厚平板。拱下與拱前是開放水面，不鋪石。
- 東岸榕樹：粗短分 2–3 股的樹幹＋板根、水平主枝、寬扁傘形樹冠（橄欖綠，和老松分得出來）、6–10 條成簾略彎的氣根，碰地的末端變粗。樹冠在拱的右邊，不能遮到拱和它的倒影。

### C. 疊月橋的特殊效果：月亮時鐘（SPEC 9.6.2＋9.6.4）
整張地圖的月亮只出現在這座橋的橋洞裡。效果跟著潮水走：
1. 夜裡退潮：拱的內緣只有一彎很細的月牙微光（白天退潮沒有）。
2. 漲潮途中（水位 0.15 → 0.30）：拱的內緣和它的倒影上，月白色的光像月相一樣漸盈，從左側細月牙→上弦→凸月，水位 0.30 時剛好一整圈滿月。光是石頭被月光照亮的柔和漸層，不是霓虹燈管。白天、夜裡都有；退潮時反過來慢慢虧缺。
3. 合圓瞬間：從圓心往外擴散一圈很慢的水紋（約 3 秒），之後圓裡的水面完全靜止。
4. 滿潮期間：圓圈裡的湖面不映現在的天空，而是一片有滿月的夜空（深藍、星星比外面多、正中央一輪清楚的滿月和淡淡光暈）。白天也是這樣，像一扇通往夜晚的圓窗。夜裡，圓裡的滿月在圓外附近的水面暈開一圈很淡的光，整張夜景只有這一個月光源。退潮開始時夜色從圓的邊緣往內收，約 4 秒消失。
- 做法建議：每一幀把拱的圓心（起拱線中點、拱的前緣）投影到螢幕座標，連同螢幕上的半徑傳進湖面 shader；湖面片段落在這個螢幕圓裡就換成夜窗。鏡頭拖曳、縮放都要跟著。
- 純畫面，不影響燈、事件、獎勵；暫停時凍結；減少動態效果時省略水紋。加一個測試入口 __lake.moonWindow(on)。

### D. 夜晚與月光（SPEC 9.6.3＋9.6.4）
- 拿掉 Codex 湖面上的月亮（左下那張圓片）。湖面上任何地方都不畫月亮、月光路或月亮碎光。
- 這張地圖從畫面邊緣到邊緣都是湖，鏡頭往下看，看不到天空，只看得到湖面映出的天空。夜景要看起來是「一整片映著星空的湖」，不是天空：
  - 星星是倒影：跟著水波輕微晃動、閃爍，退潮時有點模糊、拉長，滿潮時清楚；亮星少一點。
  - 夜裡不能有依螢幕高度的上下漸層或分界線（檢查 hazeK；夜晚把 hazeLo 設成 1.0 或改用世界距離淡出）。
  - 石頭、踏石的倒影和岸邊濕線要清楚，讓人一眼看出是水。
- 保留月光照明：夜裡主光改成從畫面遠處、疊月橋那一側照過來的冷銀色光，影子朝鏡頭落下。起點數值：顏色 #c4d3ec、強度 0.62；半球光 hS #5d7098、hG #18202f、強度 0.78。依畫面調，朝鏡頭的面在夜裡仍要看得清楚。

## 第一階段：預覽（做完就停）

1. 不要改正式原型。把 reflection-lake.html 複製成 previews/area03-3c-draft/reflection-lake-draft.html，在這份草稿裡做出上面 A–D 的外觀。路網、JSON、穿模檢查這一階段先不做。
2. 截圖存到 previews/area03-3c-draft/（1600×900）：
   - map-day-low.png、map-day-high.png：白天退潮／滿潮全圖
   - map-night-low.png、map-night-high.png：夜退潮／滿潮全圖（要看起來是映著星空的湖，不是天空）
   - map-night-high-1280.png：夜滿潮全圖，1280×800
   - bridge-day-low.png、bridge-day-high.png、bridge-night-low.png、bridge-night-high.png：疊月橋約 2.5 倍（在地圖裡，不是單獨模型）
   - bridge-phase-0.2.png、bridge-phase-0.25.png、bridge-phase-0.28.png：白天漲潮途中，看月相漸盈
   - pond-day-low.png、pond-day-high.png、pond-rising-0.5.png：睡蓮池約 2.5 倍
3. 截完先自己對照 SPEC 第 9 節看一遍；不好看就繼續調，不要只求通過。
4. 用 SendUserFile 把全部截圖（display: "render"）和草稿網頁 reflection-lake-draft.html（display: "render"）傳給使用者。
5. 寫一段簡短說明：做了什麼、哪裡你不確定、和規格不同的地方。
6. 告訴使用者：「預覽完成，請把截圖帶回 Opus 對話討論；確定後再叫我正式實作。」然後停止，不要繼續第二階段。

## 第二階段：正式實作（拿到 Opus 的回覆之後才做）

1. 先把目前的 reflection-lake.html 和場景 JSON 備份到 previews/area03-before-3c/。
2. 把確定的版本做進 docs/prototypes/reflection-lake.html。
3. 路網：依 SPEC 9.2 移動 moon_watch 到 (−8.85, 5.75)，新增 moon_wfoot、moon_crown、moon_efoot、moon_bank 與五條連線（橋上兩條是 stair）。用 docs/area03/qa/ 的工具重量走面、重跑穿模檢查，同步內嵌 JSON 與 docs/area03/area-03-reflection-lake.scene.json。示範排程器要能走到新的互動點。
4. 預覽按鈕「缺月石廊」改名（名稱照 Opus 回覆；未定就用「疊月橋」），近看位置對準橋。
5. draws ≤ 250；沒有 console 錯誤。
6. 截圖存到 previews/area03-stage-3c/（第一階段那一組，加上 bridge-crown.png：旅人站在橋頂、白天滿潮）。
7. 回報寫在 docs/area03/STAGE_3C_REPORT.md：做了什麼、CHECKLIST.md 第 3C 段逐條自查、新節點的 (u, v, y) 與連線檢查結果、夜間光線的最後數值、和規格不同的地方、待釐清、draws／tris、已知問題。
8. 用 SendUserFile 把測試網頁 reflection-lake.html（display: "render"）和主要截圖傳給使用者，告訴他：「第 3C 段完成，請先自己打開測試網頁試試看（試看漲潮、切換白天與夜），再回到 Opus 對話討論要修正的地方。」

## 規則

- 只能寫：docs/prototypes/reflection-lake.html（第二階段才寫）、docs/area03/area-03-reflection-lake.scene.json、docs/area03/qa/、previews/area03-3c-draft/、previews/area03-before-3c/、previews/area03-stage-3c/、docs/area03/STAGE_3C_REPORT.md。其他檔案不准改，Codex 可能在同一個資料夾工作。
- 只動這兩區、夜晚光線與月亮、預覽按鈕名稱；其他區域、五盞燈、原有節點不能變。
- 規格沒寫到的設計決定列進「待釐清」；場景裡不能有任何文字或數字；座標為了穿模檢查可微調 ±0.4，要回報。
