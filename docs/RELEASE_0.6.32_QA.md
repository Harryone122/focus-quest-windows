# Focus Quest 0.6.32：文字框與地圖切換修正

日期：2026-10-13（台灣）。使用者依湖畔截圖要求修正下方文字框兩側延伸及切換地圖嚴重卡頓。

- 湖畔／苗圃改成觀察實際 HUD 框體，不再只觀察整個場景。旅人文字更新、視窗縮放後，玻璃背景跟隨實際矩形。短／長文字實機矩形寬度分別 255.59／352.99 CSS px，背景吻合；截圖已檢視。
- 共用非同步材質準備分批讓出主執行緒，正確準備裁切變體；四張 Focus 地圖也預先準備玻璃後處理。湖畔在場景狀態更新後預先準備倒影及正常視角。
- 旅人燈改用留在場景中的燈光及隨身位置錨點，淡出時亮度為零；避免旅人隱藏後全場燈光數量改變而重新編譯兩套材質。位置、亮度、旅人陰影／透明度沿用原演出。
- 湖畔固定地形貼圖改用原生產場景算出的相同 RGBA 像素，避免每次進場重算。尺寸／來源／校驗見 `../src/renderer/src/reflectionLake/groundPixels.md`。不改地形、潮汐、路線或計時規則。
- 保留開工前已有的營火剪影／Area 05／企畫與交接改動；沒有重置或覆盖他人的工作。

## 驗證

- TypeScript、37 測試檔／208 測試及正式建置通過：`previews/map-switch-qa/build.log`。
- 真 Electron／生產 IPC／独立 SQLite 驗證短長文字框與湖畔兩出口跨圖；雲上遺庭、苔痕驛站、玻璃苗圃都正常出現，無 renderer 錯誤。證據：`previews/map-switch-qa/{fixed,moss,nursery}/report.json` 及 PNG。
- 同一類湖畔→苔痕跨圖路徑，Profiler 下最長畫面停頓由 baseline 3,813 ms 降至 1,799 ms；湖畔→雲上 618 ms。仍有目的地幾何建立／首繪成本，不宣稱零停頓。苗圃檢查與打包同時執行，只作功能驗證，不作獨立效能比較。
- 湖畔完整整合回歸：`previews/area03-integration-qa/source/report.json`，包含全部錄音、五燈、潮汐、暫停／恢復、事件、休息、核心倒影、兩出口及返回大廳。

## 發布

- Windows NSIS 安裝包：`release-v0.6.32/Focus Quest Setup 0.6.32.exe`，打包退出碼 0。
- 包內 115 生產檔案及湖畔 28 錄音與建置來源逐位元吻合；ASAR SHA-256 `040d7f7459f571e201112b882b036e3aee0737d29a4126264a5371b2d700b594`。證據 `previews/map-switch-qa/shipped-assets/report.json`。
- 從包內提取的程式再次完成 62 項湖畔整合回歸，無 renderer 錯誤：`previews/map-switch-qa/shipped-integration/report.json`。
- 安裝前沒有進行中專注；已完成一致性 SQLite 備份，完整性 `ok`，保留 32 專注紀錄／42 路線節點／18 任務。
- 靜默安裝退出碼 0，已安裝版本 `0.6.32.0`，已關閉舊版並啟動新版本。更新前後存檔核對見 `previews/release-v0.6.32-qa/`。
