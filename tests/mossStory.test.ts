import { expect, it } from 'vitest'
import { advanceMossRuntime, createMossRuntime, emptyMossMarks, type MossStoryPlan } from '../src/shared/area02'
import scene from '../docs/area-02-moss-station.scene.json'

const plan = (overrides: Partial<MossStoryPlan> = {}): MossStoryPlan => ({
  opening: false, visitEvent: null, coreEvents: [], carriedItems: [], ...overrides
})

it('schedules the first Moss opening and visit without missing any lamp over rainy seeds', () => {
  let rainyVisits = 0
  for (let seed = 0; seed < 60; seed++) {
    const initial = createMossRuntime(`moss-story-${seed}`, plan({ opening: true, visitEvent: 'story_first_lantern' }))
    initial.weatherSeed = seed
    const finds = [
      { id: `journey-${seed}`, lampIndex: seed % 5 + 1, eventId: 'rare_cart_tag', itemKey: 'old_luggage_tag' },
      { id: `core-${seed}`, lampIndex: (seed + 2) % 5 + 1, eventId: 'rare_drawer_compass', itemKey: 'cracked_compass' }
    ]
    let current = { state: initial, marks: emptyMossMarks() }
    for (let lamp = 1; lamp <= 5; lamp++) {
      current = advanceMossRuntime(current.state, lamp * 600, current.marks, finds)
      expect(current.state.node, `seed ${seed}, deadline ${lamp}`).toBe(scene.lamps[lamp - 1].node)
    }
    const { state, marks } = advanceMossRuntime(current.state, 3010, current.marks, finds)
    expect(state.visitedLamps, `seed ${seed}`).toEqual([1, 2, 3, 4, 5])
    expect(state.usedEvents, `opening seed ${seed}`).toContain('story_open_carving')
    expect(state.usedEvents.some(id => id === 'story_first_lantern' || id === 'story_first_lantern_rain'), `visit seed ${seed}`).toBe(true)
    expect(marks.carvingSeen).toBe(true)
    if (state.usedEvents.includes('story_first_lantern_rain')) rainyVisits++
    const resumed = advanceMossRuntime(state, 3010, marks, finds)
    expect(resumed.state.usedEvents.filter(id => id === 'story_open_carving')).toHaveLength(1)
  }
  expect(rainyVisits).toBeGreaterThan(0)
})

it('plays second-visit, core and one carried-item event from a fixed saved plan', () => {
  const initial = createMossRuntime('moss-second', plan({
    visitEvent: 'story_second_sketch', coreEvents: ['story_core_newtag'],
    carriedItems: ['old_wick', 'weathered_lens']
  }))
  const { state, marks } = advanceMossRuntime(initial, 3010, emptyMossMarks(), [])
  expect(state.visitedLamps).toEqual([1, 2, 3, 4, 5])
  expect(state.usedEvents).toContain('story_second_sketch')
  expect(state.usedEvents).toContain('story_core_newtag')
  expect(state.usedEvents.filter(id => id.startsWith('carry_'))).toHaveLength(1)
  const storySegments = state.notes.filter(note => note.eventId === 'story_second_sketch' ||
    note.eventId === 'story_core_newtag' || note.eventId.startsWith('carry_')).map(note => Math.floor(note.atSeconds / 600))
  expect(new Set(storySegments).size).toBe(3)
  expect(marks.drawerTagLeft).toBe(true)
})
