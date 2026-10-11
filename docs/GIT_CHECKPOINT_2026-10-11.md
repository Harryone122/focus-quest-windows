# 2026-10-11 共同 Git 基準

使用者授權將截至目前的進度保存並推送，供 Codex 與 Claude 接續。

- 私人遠端：<https://github.com/Harryone122/focus-quest-windows>
- 基準分支：`checkpoint/progress-2026-10-11`。保留原有三個提交的歷史；不直接推送舊 `main` 作為交接。
- 正式版本：0.6.31。Area 05 是獨立試玩，正式候選、獎勵、線索及恢復尚未接線；本次未修改遊戲規則或重新打包。
- 包含正式程式、測試、來源素材、設計原型、完整企畫、故事盤點與共同交接文件。現況及待驗收項目以 `COLLABORATION_STATUS.md` 和其連結交接為準。
- 本機保留但不新增進 Git：安裝包、編譯輸出、玩家／測試存檔、捷徑與大量暫存預覽。已有追蹤的歷史檔案保留。苗圃音效測試頁引用的木琴試聽來源例外納入，仍未獲批准用於正式 App。
- 驗證：`npm run build` 通過，包含 TypeScript、37 個測試檔／208 項測試及 Electron Vite 建置。

## 兩邊如何接續

同一工作目錄仍輪流寫入，不使用 reset、clean、stash 或覆蓋他人修改。各自工作目錄從本次基準建立分支；既有 `fix/five-lamp-milestones` 仍停在舊提交，不代表最新進度，勿直接用其舊內容接續。新 worktree 需安裝依賴。

每次開工先讀 `AGENTS.md`／`CLAUDE.md`、`AGENT_WORKFLOW.md`、`COLLABORATION_STATUS.md` 和對應交接。Claude 負責設計，Codex 負責正式實作、整合及驗證；待使用者定案項目不能因基準提交而視為已授權。

預覽與 QA 證據多數只在原機。正式 App 可由來源建置；獨立試玩可用 `scripts/echo-quarry-tester.vite.mjs`、`scripts/nursery-audio-tester.vite.mjs` 重建。部分歷史素材處理／QA 工具依賴本機預覽、來源錄音或額外工具，Git 基準不保證這些歷史流程能在乾淨機器直接重跑。
