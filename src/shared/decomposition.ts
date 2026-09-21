import type { Obstacle, TaskKind } from './types'

const typeOpeners: Record<TaskKind, (title: string) => string[]> = {
  study: (title) => [`打開「${title}」需要的教材`, '圈出今天要理解的一個小節', '用自己的話寫下三句重點'],
  report: (title) => [`建立「${title}」文件並寫下標題`, '列出三個必要段落', '先完成最容易的一段粗稿'],
  admin: (title) => [`打開處理「${title}」需要的頁面或表單`, '找出第一個必填欄位', '完成並保存第一小段資料'],
  creative: (title) => [`建立「${title}」的空白草稿`, '寫下三個不需要完美的方向', '選一個方向完成最粗略版本'],
  other: (title) => [`準備「${title}」需要的工具或資料`, '寫下最小可見成果', '只完成第一個可逆的小動作']
}

const obstacleStep: Record<Obstacle, string> = {
  unclear: '先花五分鐘列出未知處，選一個最容易確認的問題',
  too_big: '把成果縮小到十五分鐘內看得見的版本',
  boring: '先做最機械、最不需要思考的部分',
  perfection: '允許第一版很粗糙，只要求留下可修改的東西',
  missing_info: '列出缺少的資料，先找到其中一項可靠來源'
}

export function suggestSteps(kind: TaskKind, obstacle: Obstacle, title: string, progressDefinition: string): string[] {
  const base = typeOpeners[kind](title.trim() || '這項任務')
  const progress = progressDefinition.trim()
    ? `確認今天的進展標準：「${progressDefinition.trim()}」`
    : obstacleStep[obstacle]
  return [obstacleStep[obstacle], ...base, progress]
    .filter((step, index, all) => all.indexOf(step) === index)
    .slice(0, 4)
}
