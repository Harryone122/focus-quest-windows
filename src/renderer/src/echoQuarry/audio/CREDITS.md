# Area 05 藏聲秋谷音訊

使用者提供、ElevenLabs 生成。2026-10-14 使用者試聽後確認整組可接進場景：環境音 35%、背景音 25%，風孔岩 1.5 倍。確切生成日期與使用方案未另提供，不推定方案或商用授權。

来源為 `game project/audio-incoming/` 的 a05 錄音、使用者選定的 Ove talu 低喃及既有 lake 鳥聲。原檔保留；`hum_stone_g2`／`core_motif_05` 使用重生新版，沒有自行生成聲音。
`a05_distant_bell.wav` 由已驗收 `10-25.wav` 移除 1.35 秒導入並還原環境滑桿增益，供剪影的 1.35 秒撞鐘回呼播放。
石步與木板腳步是其他地圖已採用素材的副本；沒有改原有檔案或其他地圖混音。

處理／來源 SHA256：`previews/area05-audio-qa/processing-report.json`；已驗收試聽 SHA256：`verification-report.json`；安裝後素材清單：本目錄 `manifest.json`。
可重跑 `scripts/prepare-area05-audio.py`、`scripts/install-area05-audio.py`。安裝腳本先比對試聽與來源雜湊，使用 `docs/area05/AUDIO_ACCEPTANCE.json` 的使用者接受紀錄。

低喃追加 +9 dB：使用者於 2026-10-14 比較原版／+6／+9 dB 後選定；處理與接受 SHA256 見 `murmur-review/report.json`，先執行 `scripts/prepare-area05-murmur-review.py` 再安裝。
