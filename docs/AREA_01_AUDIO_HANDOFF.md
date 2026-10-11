# 雲上遺庭聲音（2026-10-02）

使用者要求加入風、草葉、鳥鳴、環境音與適量背景音；後續修正要求所有專注畫面透過右上齒輪開啟共用設定，沿用模糊液態玻璃。地圖內不保留專屬聲音控制。

## 已實作的聲音

- 柔和風聲、草葉沙沙聲、遠處瀑布底音：App 本機 Web Audio 產生，音量隨緩慢風勢起伏。
- 自然鳥鳴：使用 isaiah658 的 CC0 錄音，播放約 5.5 秒的片段，中間留 16–34 秒空檔，左右有輕微距離感。晨間較多，夜間減少，與場景共用 600 秒日夜漸變。
- 原創低音量背景長音：無鼓點，緩慢淡入，不靠循環歌曲造成反覆感。背景音與環境音獨立音量。
- 音檔隨 App 打包，執行時不使用外部網路。

## 接線

`CloudRuinsFocusScene.audioSettings` 讀取全域 `environmentVolume`／`musicVolume`，預設 35／12，以及 `audioMuted`（預設關閉靜音）。設定更新即時套用；全域靜音會保留原音量，兩個音量為零也會停止聲音。不改燈、計時、獎勵或事件抽選。

手動／系統暫停與回顧會淡出並 suspend AudioContext，來源時間凍結；恢復後接續。視窗在背景仍播放。離開地圖或元件卸載會淡出、停止來源並 close context，避免重複疊加。

素材出處與授權：`src/renderer/src/cloudRuins/audio/CREDITS.md`。原始碼：`src/renderer/src/cloudRuins/cloudRuinsAudio.ts`。

## 驗證

`tests/cloudAudio.test.ts` 驗證日夜漸變與風勢範圍。`scripts/qa-cloud-audio.cjs` 在獨立 Electron profile 檢查實際聲波、離線鳥鳴解碼及播放、暫停時 currentTime 凍結、背景持續、靜音、全域音量即時套用與關閉後釋放 context。最終報告 `previews/cloud-audio-qa/report.json` 無 renderer errors，預設混音峰值約 0.126、最大 RMS 約 0.0354，無削波。

測試錄音：`previews/cloud-audio-qa/preview.webm`。錄音與波形證明音效路徑運作；自然度與個人音量喜好仍由使用者實聽驗收。

共用齒輪、液態玻璃設定介面及完整安裝包的實機驗證由本輪版本 QA 文件記錄，不能以音效單獨通過替代介面驗收。
