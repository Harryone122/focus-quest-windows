# Focus Quest 0.6.8：正式大廳 A 接線與新 icon

日期：2026-09-27。Claude 負責前端視覺／動畫，Codex 接入資料、驗證並打包。

## 本版內容

- Today 切換到真資料 `LobbyA`，導覽列依 Claude 的 `:has()` 樣式與場景玻璃量測自動套用，不重設佈局。其他頁面保留紙張導覽列。
- `DepartureSheet` 接上今天事項、換事項、手機確認、程式阻擋與真實路線；選路及打開確認不計時，按出發才開始。
- `AfterFocus` 接一次完成問題、部分進度與短於五分鐘回顧。完整探索也能回到大廳休息／選路，不再被舊結算畫面綁住；下一次開始送出對應出口提示。
- 今日清單、排序、昨日事項移回／確認刪除、例行設定皆經 IPC 寫入既有後端。前端只做 projection 和操作，不抽獎或累積時間。
- 新發現已讀保存至 `lobby_find_reads`，快照新增 `seenFindIds`、實際 `mapVisits`。备份 v8，仍可匯入 1–7。保底進度不送進 lobby model。
- 原有 `awaiting_reward` 存檔的選物品改用現成事件卡呈現，可留到大廳處理，不會自動替玩家選擇。歷史任務／進度／核心不刪除。
- 既有第一張地圖、玻璃樣式與所有演出未重新設計。僅修正舊時長在新面板的資料接線，以及保存中新增事項／昨日刪除確認的防護。
- 同時打包 Claude 的旅人浮島 icon，沒有重新產圖。

## 自動與實機驗證

- `npm.cmd run build`：TypeScript、10 個檔案共 98 項測試、main/preload/renderer 建置通過。
- 新增 `tests/lobby.test.ts` 六項：空存檔、實際時長／事項選擇、partial／too-short、完整回顧回大廳與出口、舊獎勵接續、已讀與 v8/v7 備份。
- `scripts/qa-lobby-integration.cjs` 在全新 temp 存檔，實際操作 React 控制項 → preload → SQLite，再觀察快照與畫面。
- 最終測試載入 `release-v0.6.8/win-unpacked/resources/app.asar` 及其 SQLite 原生套件。main/preload/index.html 與本次建置雜湊一致；載入的是出貨 renderer，不是 mock 預覽。
- 實測：新增兩件事、改順序、選路不計時、取消出發不計時、例行日程／每日一份、昨日原日期／移回今天、二次確認刪除、Focus 暫停／繼續、結束後只問一次、partial 只能續玩、完整回顧回樹下、完成事項後選下一件、新發現收好後重載不重現、選松林出口後實際 session 帶 `exit_pines`。
- 1320×860 與 1040×700：場景左緣 x=0、導覽列覆在場景上，右側面板未超出視窗；出發確認可操作；離開大廳後恢復原紙張導覽列。另截取路線 focus 看向出口。
- 成功報告 `previews/lobby-shipped/report.json`，版本 0.6.8，6 組流程檢查，renderer errors 為空。`01`–`15` 截圖（含 `12b`）為成功測試證據。該目錄的 `failure.png` 是先前 QA 以相同名稱辨識候選、點錯路線的腳本失敗紀錄，不代表最終測試失敗；已改用候選位置。
- QA 的時間加速只改獨立 temp 資料庫，未注入正式存檔；沒有真等 50 分鐘或跨午夜，也未讓 Windows 睡眠。
- 編譯後主程式與安裝檔的關聯 icon 都是新旅人圖示。主程式抽出的 32px icon 與來源 ICO 逐像素一致（差異 0）。證據：`previews/lobby-integration/packaged-icon.png`、`installer-icon.png`。

## 範圍與交回 Claude 的視覺細節

- 五段终點、其餘九張地圖、線索組合及新的延後故事事件尚未實作，不啟用 mock 的 final_ready／returned；左上五段條仍是設計目標，不代表第五段有結局。舊路線生成仍可產生 25／50／90 分鐘，本版照實顯示，未強制改存檔時間。
- 主／支線仍可出現在舊任務庫或歷史相容畫面，新的 Today 已不使用這些角色來決定專注事项。
- 起點特寫時旅人腳下看不到踏石，觀感像懸空；完整探索後樹下站位正常。請 Claude 參考 `02-selected-glass-rail.png` 調整大廳起點站位／構圖，不動已認可的 Focus 場景。帽簷遮臉與筆記本不明顯仍為原交接已知問題。
- 沒有刪除舊畫面原始碼；等使用者驗收後再清理。未改系統列原有小燈籠圖示。

## 出貨與存檔

- Windows x64 NSIS：`release-v0.6.8/Focus Quest Setup 0.6.8.exe`，142,235,848 bytes。
- SHA-256：`AE7F2C386E8A543E418B4743C79CDADC4C709C686E895FBA0E961605323543F7`。
- 主程式：`release-v0.6.8/win-unpacked/Focus Quest.exe`，版本 0.6.8.0。舊版產物保留，未跑安裝精靈覆盖既有安裝。
- 啟動前確認沒有其他 Focus Quest 程序，備份正式 DB 及存在的 WAL/SHM 至 `C:\Users\User\AppData\Roaming\focus-quest-windows\backup-before-0.6.8-20260927-012842`，逐檔雜湊一致，再啟動新版使用原資料。QA 存檔沒有複製進正式環境。
- 退版前請先停止 App，還原這份一致的原始備份；不要直接用舊版讀入 v8 JSON 備份。
