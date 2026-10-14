# Focus Quest 0.6.34：移除懸空坐姿與互動移動修正

日期：2026-10-13。使用者明確偏好取消苗圃樓梯坐姿，並要求檢查其他地圖的環境互動瞬移。

## 修正

- 刪除正式苗圃排程與測試頁的 `stairSit`。舊存檔中的事件轉為同時間等待，不重置專注或獎勵。
- 苗圃保存行走採路線長度／保存時長的固定速度，低幀率亦補足有效時間；原先每幀只計最多 .05 秒且減速，事件到期時未抵達而被下個事件放回路線節點。
- 苗圃繞育苗機的日常事件沿同一路線返回 MT；原先停在半圈另一側，下一保存行走卻從 MT 開始。
- 苗圃已坐上轉盤時保留連續休息狀態，避免新一分鐘休息再次重設登座。
- 苔痕驛站貨車坐姿的兩種日常互動及雨天提燈故事，於首尾 1.2 秒平順移到座位／回到路線节点，同步混合姿勢。
- 保留已驗收模型、音效及既有時間／燈／獎勵權威；本輪不新增載入畫面。

## 驗證證據

- TypeScript、214 測試／38 測試檔、正式與獨立苗圃動畫音效測試頁建置通過。
- `scripts/qa-interaction-continuity.cjs`：實際正式場景程式與後端保存排程，僅停用中間繪圖／自動迴圈／音訊，控制時鐘。四圖各 3,000 秒，以 5 fps 逐步量測。跨事件最大位移苗圃 .398、苔痕 .071、湖畔 .269 世界單位；雲上本地連續規劃最大每幀 .372。全程未超過不連續位移門檻。苗圃覆蓋七種現有日常事件、苔痕 26 種、湖畔 23 種。此為確定性場景／排程檢查，並非排除所有未知情境。
- 三種貨車坐姿專項：站點→座位實距 1.276；50 ms 最大步進 .080；結束與原站點距離 0。轉盤休息 240 秒跨多次保存行動，最大 200 ms 步進 .385，暫停 60 秒位置變化 0。
- 證據：`previews/interaction-continuity-qa/report.json`、`fixtures.json`、`previews/interaction-build.log`。
- 正式 App 樓梯 G2↔CT 保存行走通過；苔痕十種故事畫面、暫停重載、恢復與回家鏡頭整合通過，無 renderer error。`previews/stair-fix-qa/app/report.json`、`previews/moss-camera-app-qa/report.json`。

## 發布

- 0.6.34 Windows 安裝包完成，`release-v0.6.34/Focus Quest Setup 0.6.34.exe`，205,430,438 bytes；SHA256 `5d6fcf10f825b3392fae0a71131423e398580fd761b32aa8f9f69a28de4bb539`。
- 全部 115 個包內 out 檔案與本輪建置逐 byte 吻合；安裝後 app.asar 與驗證包 SHA256 同為 `0e07194133a2ac152c115e95215bc9f07bc6fc0e13e4aa3c8454c48bd0a77266`。
- 包內苗圃六項完整流程、暫停、五燈、移植與收藏室、8 秒出口通過；包內湖畔 62 項含日常互動／故事／出口整合通過，均無 renderer error。證據 `previews/release-v0.6.34-qa/{nursery,lake}/report.json`。
- 包內保存楼梯 G2↔CT 路線檢查通過；實際苗圃 framebuffer 已檢視。隱藏 Electron 視窗的 compositor 截圖可能保留營火影格，樓梯 QA 因而改直接擷取 nursery renderer，證據 `previews/stair-fix-qa/shipped/scene.png`，不將營火殘留截圖當苗圃視覺證據。
- 安裝前確認無進行中專注、SQLite 一致備份 integrity=ok；更新前後 32 筆專注、42 路線節點、18 任務完整保留，無重置。證據 `previews/release-v0.6.34-qa/user-save-*.json`。
- 已更新實際 `%LOCALAPPDATA%/Programs/Focus Quest/Focus Quest.exe` 至 0.6.34，啟動 PID 8720，視窗標題 Focus Quest、Responding=true。動畫音效測試頁亦重新建置，已刪除樓梯坐姿選項。
