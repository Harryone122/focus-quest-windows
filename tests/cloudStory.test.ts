import { describe, expect, it } from 'vitest'
import { cloudStoryClueTimes, cloudStorySchedule } from '../src/shared/cloudStory'

describe('Cloud Ruins story clues', () => {
  it('retries missing first-visit knowledge without replaying the opening, and stops once learned', () => {
    const plan = { visit: 4, opening: false, items: [], records: [], knownClues: [] as string[] }
    expect(cloudStorySchedule(plan).flatMap(e => e.evs)).toEqual(expect.arrayContaining(['notebook_a', 'notebook_b', 'stele', 'well']))
    expect(cloudStoryClueTimes(plan, 3000).c01_bark_date.earliest).toBe(3000)
    plan.knownClues = ['c01_first_tree', 'c01_bark_date', 'c01_stele_scale', 'h1a']
    expect(cloudStorySchedule(plan)).toEqual([])
    expect(cloudStoryClueTimes(plan, 3000)).toEqual({})
  })
  it('distinguishes the game opening from a later first visit and keeps the tree date until the fifth lamp', () => {
    const opening = cloudStoryClueTimes({ visit: 1, opening: true, items: [] }, 3000)
    const firstVisit = cloudStoryClueTimes({ visit: 1, opening: false, items: [] }, 3000)
    expect(opening.c01_first_tree).toEqual({ earliest: 40, fallback: 130 })
    expect(firstVisit.c01_first_tree.earliest).toBe(240)
    expect(opening.c01_bark_date.earliest).toBe(3000)
  })

  it('limits second-visit and carried-item clues to eligible states', () => {
    const second = cloudStoryClueTimes({ visit: 2, opening: false, items: ['charcoal_paper'] }, 3000)
    expect(second.h1a).toEqual({ earliest: 1260, fallback: 1400 })
    expect(second.c01_rubbing).toBeDefined()
    expect(second.c01_tag).toBeUndefined()
    expect(second.c01_first_tree).toBeUndefined()
    expect(cloudStoryClueTimes({ visit: 3, opening: false, items: [] }, 3000)).toEqual({})
  })
})
