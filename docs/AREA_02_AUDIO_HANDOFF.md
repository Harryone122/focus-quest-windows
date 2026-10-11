# 苔痕驛站聲音（2026-10-02）

使用者要求加入風、草葉、下雨、環境音與適量背景音。本次保留已驗收的地圖，聲音是獨立呈現層，不改變計時、天氣抽選、事件、五盞燈或獎勵。

## 聲音內容

- 低頻風聲，強弱緩慢起伏；較高頻的草葉聲隨風變動，雨大時稍減。
- 持續的溪流／遠瀑底音，地面變濕時稍增。
- 雨聲與屋簷落水隨 `weatherAt(weatherSeed, effectiveSeconds).rain` 淡入淡出，雨停後依 `wet` 保留淡滴水聲。
- 極淡的原創持續音色，沒有明顯節拍、旋律循環或強烈提示音。
- 風、草葉、水、雨與背景音由本機 Web Audio 程序生成，不需網路或外部音檔；不同長度的立體聲底音交織，避免整段環境同時重複。

## 播放與設定

- 僅目的地的苔痕 Focus 建立聲音；出發用的背景副本不再建立一份。
- 使用相同的保存天氣 seed 與有效專注秒數。手動暫停、系統暫停、回顧與離開地圖停止播放；最小化不暫停環境音。
- 不把畫面動畫或音效當作遊戲結果的依據；音訊失敗不阻止專注與進度。
- 聲音控制統一放在共用設定，所有 Focus 右上角齒輪可進入；不使用每張圖自己的靜音鍵。
- 「環境音」預設 35%，「背景音」預設 12%；可以各自拉至 0。「全部靜音」保留原來的兩個音量。
- 設定使用和大廳相同的模糊透明玻璃面板，開啟設定不暫停 Focus。支援關閉按鈕、Esc、點面板外，以及鍵盤焦點循環。
- 音量／靜音保存在 SQLite 設定並納入 v13 備份；舊版備份補上溫和預設值。

## 實作與驗證

- `src/renderer/src/mossStation/mossStationAudio.ts`：混音與 Web Audio graph／生命週期。
- `MossStationFocusScene.tsx`／`AreaFocusScene.tsx`：天氣、有效時鐘與共用設定接線。
- `App.tsx`／`AppShellPanels.tsx`：全 Focus 齒輪、共用設定與聲音控制。
- `tests/mossAudio.test.ts`：同天氣雨聲、完全靜音、音量範圍與新舊備份保存。
- `scripts/qa-moss-audio.cjs`：實際離線 PCM、音訊暫停／恢復、最小化、零音量與釋放檢查。晴天 12 秒樣本 peak 0.0604／RMS 0.0134；雨天 peak 0.0933／RMS 0.0194，沒有削波或無效樣本。
- `scripts/qa-moss-audio-integration.cjs`：正式 App 兩地圖共用設定、Focus 計時、全部靜音、暫停、最小化、雨天、回顧與跨圖聲音關閉。測試使用獨立 profile，優先副螢幕；本次實際只有主螢幕。
- 波形樣本與報告：`previews/moss-audio-qa/`；完整設定／雨天畫面：`previews/moss-audio-integration-qa/`。安裝包檢查另見 `RELEASE_0.6.22_QA.md`。
