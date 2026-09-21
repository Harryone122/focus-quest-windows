import type { Obstacle, TaskKind } from './types'

const typeOpeners: Record<TaskKind, (title: string) => string[]> = {
  study: (title) => [`打開「${title}」需要的教材，先標出一個不懂的地方`, '從最容易的一小節開始讀，不急著讀完整章', '先寫下目前已經知道的三個重點'],
  report: (title) => [`打開「${title}」文件，先寫一個暫定標題`, '列出這份內容最需要回答的三個問題', '不修改文字，先寫一段最粗略的開頭'],
  admin: (title) => [`打開處理「${title}」需要的頁面或表單`, '先找出第一項必須準備的資料', '從現在就能填寫的第一個欄位開始'],
  creative: (title) => [`打開「${title}」目前的草稿，先圈出一個想改的地方`, '快速畫出或寫下三個不需要完美的方向', '挑最容易的一個部分，先留下最粗略的版本'],
  other: (title) => [`先打開或準備「${title}」需要使用的工具`, '寫下一個今天看得見的完成畫面', '先做一個可以隨時修改或撤回的動作']
}

const obstacleStep: Record<Obstacle, string> = {
  unclear: '先花五分鐘列出未知處，選一個最容易確認的問題',
  too_big: '把成果縮小到十五分鐘內看得見的版本',
  boring: '先做最機械、最不需要思考的部分',
  perfection: '允許第一版很粗糙，只要求留下可修改的東西',
  missing_info: '列出缺少的資料，先找到其中一項可靠來源'
}

export function suggestStartingActions(kind: TaskKind, obstacle: Obstacle, title: string, progressDefinition: string): string[] {
  const base = typeOpeners[kind](title.trim() || '這項任務')
  const contextual = progressDefinition.trim()
    ? `先為「${progressDefinition.trim()}」留下第一個看得見的痕跡`
    : obstacleStep[obstacle]
  return [obstacleStep[obstacle], base[0], contextual, ...base.slice(1)]
    .filter((action, index, all) => all.indexOf(action) === index)
    .slice(0, 3)
}
