# 全遊戲邏輯與故事一致性盤點

完成日期：2026-10-11。物件是目前共享 checkout，非重新驗收安裝版。先讀第三份的決策摘要，再用前兩份對照需要調整的位置。

1. [運作流程圖與儲存／重置矩陣](01-flow.md)
2. [故事逐事件揭露與回收表](02-story-reveals.md)
3. [12 項問題與具體調整提案](03-issues-and-proposals.md)

支援材料：[完整場景事件目錄](event-catalog.md)、[事件資料快照](event-catalog.json)、[隔離驗證結果](verification.json)、[驗證來源](verification-source.ts)。

主要發現：第五段後正式流程尚未進入相遇；隱藏圖只有線索桌揭露，沒有可前往路線；雲上第二次探索 10 秒後改路，會跳過古井必要線索，已用真實路線選擇重現。其他未來內容缺口與規格邊界另列，不當成同等性質的故障。

既有 208 項測試與兩項隔離盤點檢查透過。沒有更改正式程式／劇本／規則，沒有玩家資料、視窗或安裝包操作。本次新增審查檔案與 Focus Quest 專用 skill；後續依使用者選定範圍進行調整。

## 重跑隔離驗證

`verification-source.ts` 是放在 repo 根目錄執行的臨時 Vitest 檔之完整保留副本。需重跑時，複製為根目錄 `audit-checks-20261011.test.ts`（先確認沒有同名檔），從 repo 根執行 `npx vitest run audit-checks-20261011.test.ts --reporter=dot`，再刪除自己建立的臨時檔。只使用 `:memory:` SQLite 與假時鐘，輸出會更新本資料夾的 verification.json。

檢查是本次觀察結果的診斷快照，未來修復後應更新預期，不作為保持錯誤行為的產品回歸測試。若程式已更新，先重新盤點，不沿用此報告的狀態斷言。
