/** Permanent clues are decided from saved expedition time, independently of scene playback. */
export interface CloudStoryPlan {
  visit: number
  opening: boolean
  items: readonly string[]
  /** Permanent knowledge at this read; omitted by legacy presentation callers. */
  knownClues?: readonly string[]
}

const needsFirst = (plan: CloudStoryPlan): boolean => plan.knownClues ? !plan.knownClues.includes('c01_first_tree') : plan.visit === 1
const needsSecond = (plan: CloudStoryPlan): boolean => plan.knownClues ? plan.visit >= 2 : plan.visit === 2

export function cloudStorySchedule(plan: CloudStoryPlan & { records: readonly string[] }): Array<{ at: number; evs: string[]; forced?: boolean }> {
  const schedule: Array<{ at: number; evs: string[]; forced?: boolean }> = []
  const has = (id: string) => plan.records.includes(id)
  if (needsFirst(plan) && !has('c01_first_tree')) schedule.push(plan.opening
    ? { at: 40, evs: has('story_opening_a') ? ['opening_b'] : ['opening_a', 'opening_b'], forced: true }
    : { at: 240, evs: ['notebook_a', 'notebook_b'] })
  if (needsSecond(plan)) {
    if (!has('c01_stele_scale') && !plan.knownClues?.includes('c01_stele_scale')) schedule.push({ at: 60, evs: ['stele'] })
    if (!has('h1a') && !plan.knownClues?.includes('h1a')) schedule.push({ at: 1260, evs: ['well'] })
  }
  if (plan.items.includes('wind_whistle') && !has('item_whistle')) schedule.push({ at: 150, evs: ['whistle'] })
  if (plan.items.includes('charcoal_paper') && !has('c01_rubbing')) schedule.push({ at: 330, evs: ['rubbing'] })
  if (plan.items.includes('pressed_leaf') && !has('c01_tag')) schedule.push({ at: 1320, evs: ['leafTag'] })
  return schedule.sort((a, b) => a.at - b.at)
}

/** Non-reward presentation checkpoints share the same durable exploration ledger. */
export function cloudStoryEventTimes(plan: CloudStoryPlan, plannedSeconds: number): Record<string, { earliest: number; fallback: number }> {
  return {
    ...cloudStoryClueTimes(plan, plannedSeconds),
    ...(plan.visit === 1 && plan.opening ? { story_opening_a: { earliest: 40, fallback: 66 } } : {}),
    ...(plan.items.includes('wind_whistle') ? { item_whistle: { earliest: 150, fallback: 260 } } : {})
  }
}

export function cloudStoryClueTimes(plan: CloudStoryPlan, plannedSeconds: number): Record<string, { earliest: number; fallback: number }> {
  const times: Record<string, { earliest: number; fallback: number }> = {}
  if (needsFirst(plan)) {
    times.c01_first_tree = plan.opening ? { earliest: 40, fallback: 130 } : { earliest: 240, fallback: 340 }
  }
  if (plan.knownClues ? !plan.knownClues.includes('c01_bark_date') : plan.visit === 1) {
    times.c01_bark_date = { earliest: plannedSeconds, fallback: plannedSeconds + 46 }
  }
  if (needsSecond(plan)) {
    if (!plan.knownClues?.includes('c01_stele_scale')) times.c01_stele_scale = { earliest: 60, fallback: 140 }
    if (!plan.knownClues?.includes('h1a')) times.h1a = { earliest: 1260, fallback: 1400 }
  }
  if (plan.items.includes('charcoal_paper')) times.c01_rubbing = { earliest: 330, fallback: 450 }
  if (plan.items.includes('pressed_leaf')) times.c01_tag = { earliest: 1320, fallback: 1450 }
  return times
}
