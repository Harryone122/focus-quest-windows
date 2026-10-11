你是 Focus Quest（Windows Electron + React + SQLite + three.js r128）的正式前後端實作者。全部用繁體中文回覆。

【任務】把苔痕驛站原型的「故事事件運鏡」直接移植進正式遊戲，並接上後端的事件進度。原型已經完成並經使用者看過，請照原型的行為實作，不需要再重新設計，也不需要先做預覽圖。

【先讀（docs/handoff/area02-camera-direction/）】
1. moss-station.html：可執行的參考實作。按「試看新事件」逐一播放，「運鏡：開／關」可比較。
2. prototype-camera.diff：原型這次新增的程式（DIR、dirShot()、stepDirector()、lanternAt()、placeCamera() 的 az/el/zoom 處理），以及場景物件的修改。
3. camera-keys.json：10 個故事事件的關鍵影格資料（p、at、z、el、az）。
4. camera-direction.md：每個鏡位的用意與通用規則。previews/ 是目標畫面。

【要做的事】
1. 在正式場景層（mossStationScene.js／共用聚焦場景）實作和原型相同的導演鏡頭：
   - 關鍵影格內插：smoothstep；z 用對數內插；at、el、az 線性；最後一格一律回 home、z=1。
   - at 可以是 [u,v,y]（用 W(u,v,y)）、"traveller"、"lantern"（用畫提燈的同一條曲線，不要另存）、"home"。
   - 用 camera.zoom 實作；水面著色器的 pxPerUnit 要除以 zoom；太陽目標點維持在 home。
   - 目標狀態經臨界阻尼彈簧平滑（時間常數 0.55 秒）。
2. 接上後端：事件進度 p 必須來自後端保存的事件動作與 sceneNow（和 storyUpdate(p) 用同一個 p），不要在前端另外計時。暫停時鏡頭跟著停；場景重新建立、重開視窗、從背景回來、快轉時，直接 snap 到該進度的鏡位。故事事件的資料（camera.keys）併入 docs/area-02-moss-station.scene.json 的 storyEvents[]（寫之前確認檔案沒被別人改過）。
3. 同步場景物件修改（原型 partC，見 diff）：燈柱刻字改成朝向鏡頭的刻字牌；提燈放大 1.7 倍、雨天水痕圈加大；首訪（晴）與舊燈芯事件最後霧谷浮出 7 點遠方燈光。
4. 與正式 App 的整合：上下玻璃與 chrome insets（z>1 時主體放在可視帶中央、edgeGlass 取樣跟著鏡頭更新）；開場事件照現有規則隱藏介面；拖曳偷看疊加在運鏡上、放開後回彈；減少動態時不做連續推拉與跟拍，改 0.4 秒切換；16:9、16:10、4:3、21:9 與窄視窗不能出現空白或接縫；z≥5 時陰影不能鋸齒或跳動。
5. 不得改變燈的規則、天氣、排程、線索、保存與任何後端資料；鏡頭只是呈現。

【驗收】
- 十個事件的鏡位和 previews/ 一致；首訪（晴／雨）能一直看到提燈；二訪看得到住宿簿、畫與角落的字。
- 事件結束回到 home，取景和事件前相同。
- 暫停、繼續、中途重開、快轉都正確。
- dirShot(eventId, p) 的純函數測試（所有 at 可解析、連續、z 在 1–12、最後一格 home）；現有 vitest 與 typecheck 全過。
- Windows Electron 實機看過，沒有掉幀。
- 完成後請給使用者一個可以自己試的測試入口（逐一播放十個事件、運鏡開關、可拖進度），讓使用者看過、和 Claude 討論修正後才收尾。

【這次不做】「穿透剪影」（柴堆被樹根擋住）還沒有定案，先不要做。

【規則】同一時間只有一個 agent 寫 repo，開始前看 git --no-optional-locks status 與檔案修改時間；不用 reset／clean／stash／push；App.tsx、LobbyScene.tsx、企畫書與 brief 保持 CRLF；不動使用者存檔，QA 用獨立資料夾。做完只回報結果、檔案、沒做到的地方與需要決定的事。
