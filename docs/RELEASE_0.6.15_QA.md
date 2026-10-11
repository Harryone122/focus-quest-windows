# 0.6.15：霧岸營火與 §49.2 路線保證

2026-09-28。依已驗收的 `CAMPFIRE_START_HANDOFF.md` v2 和企畫書 §48、§49.2。

## 已接通

- 大廳 `journey_start` 與 `returned` 以原型場景顯示霧岸營火；原有方案 A 的清單、路線卡、行囊與出發前確認保留。原型控制與範例面板不進正式 UI。
- 第一段左吊橋 `exit_bridge`、右浮石 `exit_steps` 持久保存；舊版起點路線未存出口者依已發行地圖補上畫面對應，舊 25/90 分鐘存檔不改時間。
- 看向路線時鏡頭、霧、燈痕與目的地剪影連動。營火痕跡按相遇標記與永久核心數投影，已讀沿用 `lobby_find_reads`；沒有相遇紀錄時不憑核心推斷已見過對方。
- 開始第一段專注時，後端先寫入 Focus；前端播放五秒借火與出發，目的地在霧後預先繪製，準備好後淡入。重開已開始的 Focus 不重播演出。
- 每次產生候選路線時從本趟已完成地圖與永久核心讀取狀態，保證在仍有「本趟未走過、核心未取得」的可玩地圖時，兩條至少一條可通往它。舊候選節點保持原資料，不重抽。

## 兩張已發行地圖期間的暫行規則

使用者確認：目前只有雲上遺庭與苔痕驛站兩張可玩地圖，無法完成五段完全不重複的旅程。因此候選不足時暫時允許重訪；新地圖上線後，優先從本趟未走過的地圖抽選。沒有提供未發行的假地圖。

## 驗證

- `npm run dist -- --config.directories.output=release-v0.6.15`：型別檢查、19 個測試檔／136 個測試、正式建置、Windows NSIS 打包成功。
- `scripts/qa-campfire.cjs` 以隔離存檔跑實際 Electron：起點、吊橋／浮石看向、選路、借火第 2.7／4.9／5.5 秒、雲上遺庭入口、`returned` 階段 1 與四秒回歸畫面。`--moss` 另驗苔痕驛站入口。
- `--asar` 對正式包內 main/preload/renderer 入口與已驗證建置比對 SHA-256，並在正式 ASAR 重新跑雲上遺庭與苔痕驛站兩向。截圖與報告：`previews/campfire-integration/`、`previews/campfire-moss-integration/`、`previews/campfire-shipped/`、`previews/campfire-moss-shipped/`。
- 安裝包：`release-v0.6.15/Focus Quest Setup 0.6.15.exe`，142,493,263 bytes，SHA-256 `E1B65ED0E3C31672F02418D0194733C9E09CD3E3D07BD42258EC1A008D5DF154`。
- 切換前備份真實 `focusquest.db`、`-wal`、`-shm` 至 `C:\Users\User\AppData\Roaming\focus-quest-windows\backup-before-0.6.15-20260928-1030`；三檔雜湊與原檔一致。當時沒有正在執行的舊版。已啟動 `release-v0.6.15/win-unpacked/Focus Quest.exe`，主視窗有回應。

## 尚未由本輪建立的故事節點

目前正式後端仍沒有「第五段後最終領域相遇／回顧／結束旅程」流程，因此正常遊玩尚不會產生 `returned`，也不會寫入 `campfire-start:future_self_met`。`returned` 畫面與回程演出已可渲染、已於隔離 QA 驗證，但不把原型中的相遇當作真實進度。真正結局與階段 5 留待該故事流程定案後接入。
