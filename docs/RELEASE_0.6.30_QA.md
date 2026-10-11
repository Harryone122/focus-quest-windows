# Focus Quest 0.6.30：玻璃苗圃動作音效

日期：2026-10-07（台灣）。使用者授權植入音效並要求動作同步；依 `area07/AREA_07_AUDIO_PROMPTS.md` 整合現有錄音。

- 正式播放 44 個素材：37 個苗圃錄音與 7 個既有腳步／衣料／筆記／信物錄音。原始 WAV 保留，前景起音修剪、削波插值、置中及響度校準可重現於 `scripts/prepare-nursery-audio.py`。
- 音效跟著本地動畫，不從後端故事開始時間猜測操作時點。腳步跟腿部落點；開鎖、門、鐘罩、扶盆、土壤、灑水、刻度與出口跟畫面同一更新。連廊門補上實際開啟動作，地窖腳步依四個梯級高度觸發。
- 同一音場沿用 Focus→大廳→移植；音量／靜音／暫停接線。快轉與重開直接還原、不補播，解碼晚到不重播，前景最多三聲。夜裡無蟲聲，燈與植物長大不加音效。
- 保留後端玩法、專注時間、五燈、信物抽選與永久紀錄。

## 已驗證

- TypeScript 通過，34 檔／195 測試通過，正式建置與 Windows NSIS 打包成功。
- `previews/nursery-audio-qa/runtime/report.json`：真 Electron 載入 44 音檔，暫停與靜音、信物、本地核心動畫門檻、跳時不補播；無執行錯誤。
- `previews/nursery-audio-qa/integration/report.json`：完整五段移植、三條刻度與土壤／灑水音效、大廳音場交接、收藏室永久紀錄、8 秒出口／目的地交接；無執行錯誤。截圖已檢視。
- `previews/nursery-audio-qa/shipped/report.json`：0.6.30 的 app.asar 在真 Electron 重跑動作音效檢查通過；無執行錯誤。包內核對 37 個 nursery WAV，未包含未批准的木琴或蟲鳴。
- 既有存檔已一致性備份，完整性 `ok`，32 專注紀錄／42 路線節點／18 任務，備份位置見 `previews/release-v0.6.30-qa/user-save-backup.json`。QA 均使用獨立暫存存檔。

## 試玩與唯一待確認音檔

`scripts/try-nursery.cmd` 為獨立存檔、30 倍有效時間、正常速度動作的苗圃試玩；安裝版仍為正常 50 分鐘探索。安裝檔：`release-v0.6.30/Focus Quest Setup 0.6.30.exe`。

核心木琴 `previews/nursery-audio-qa/core_motif_07-preview.wav` 已只用原錄音排成 G4／C5／D5／G5，四音誤差均小於 1 音分。依原音效文件 §8，**仍待使用者試聽確認，不在 0.6.30 正式播放素材中**。未生成的批次 7 和弦墊／線索提示音也不合成替代。

已安裝並重開 `C:/Users/User/AppData/Local/Programs/Focus Quest/Focus Quest.exe`，檔案版本 `0.6.30.0`。
