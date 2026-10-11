export interface WorldStage {
  minimumSeconds: number
  title: string
  change: string
}

export const WORLD_STAGES: WorldStage[] = [
  { minimumSeconds: 0, title: '沉睡的閱覽廳', change: '檔案館仍在等待第一段專注。' },
  { minimumSeconds: 10 * 60, title: '第一盞燈', change: '閱覽桌上的燈開始呼吸。' },
  { minimumSeconds: 25 * 60, title: '窗外微光', change: '遠方星圖第一次浮現。' },
  { minimumSeconds: 45 * 60, title: '甦醒的藤蔓', change: '植物沿著黃銅支架慢慢生長。' },
  { minimumSeconds: 60 * 60, title: '開啟的走廊', change: '通往下一間檔案室的光被點亮。' },
  { minimumSeconds: 90 * 60, title: '漂浮索引', change: '散落的索引卡開始回到原位。' },
  { minimumSeconds: 3 * 60 * 60, title: '星盤回聲', change: '沉默的天文儀重新轉動。' },
  { minimumSeconds: 6 * 60 * 60, title: '溫室訊號', change: '遠方溫室出現了回應。' },
  { minimumSeconds: 10 * 60 * 60, title: '完整的閱覽廳', change: '第一個區域恢復了長久的光。' },
  { minimumSeconds: 30 * 60 * 60, title: '觀測者來訪', change: '新的身影出現在檔案館。' },
  { minimumSeconds: 50 * 60 * 60, title: '群星歸檔', change: '失序的星圖逐漸連成道路。' },
  { minimumSeconds: 100 * 60 * 60, title: '被建立的世界', change: '這座檔案館已經記住你的長途旅程。' }
]

export function worldStageIndex(totalSeconds: number): number {
  const safeSeconds = Math.max(0, totalSeconds)
  let result = 0
  WORLD_STAGES.forEach((stage, index) => {
    if (safeSeconds >= stage.minimumSeconds) result = index
  })
  return result
}

export function nextWorldStage(totalSeconds: number): WorldStage | null {
  return WORLD_STAGES[worldStageIndex(totalSeconds) + 1] ?? null
}
