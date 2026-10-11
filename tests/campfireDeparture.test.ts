import { describe, expect, it } from 'vitest'
import { campfirePoseTime, CAMPFIRE_DEPARTURE_SECONDS } from '../src/renderer/src/lobby/campfireDeparture'
import { campfireActionPlans, campfireActionMix } from '../src/renderer/src/lobby/campfireAudio'

describe('Accepted campfire departure', () => {
  it('extends preparation but retains the authored exit speed and completes in eight seconds', () => {
    expect(CAMPFIRE_DEPARTURE_SECONDS).toBe(8)
    expect(campfirePoseTime(5.05)).toBeCloseTo(2.05)
    expect(campfirePoseTime(5.4)).toBeCloseTo(2.4)
    expect(campfirePoseTime(5.75)).toBeCloseTo(2.75)
    for (const time of [5.85, 6.23, 6.61, 6.99, 7.37, 7.75, 8]) expect(campfirePoseTime(time)).toBeCloseTo(time - 3)
    expect(campfirePoseTime(-1)).toBe(0)
    expect(campfirePoseTime(100)).toBe(5)
  })
  it('retains natural overlap, distinct exits, quieter air and mute on the adopted timeline', () => {
    const bridge = campfireActionPlans.bridge, stone = campfireActionPlans.steps
    const book = bridge.find(e => e.name === 'dep_notebook_close')!, rise = bridge.find(e => e.name === 'dep_log_creak')!
    expect(book.actualEnd).toBeGreaterThan(rise.actualStart)
    expect(bridge.filter(e => e.name.startsWith('bridge_creak_')).length).toBe(6)
    expect(stone.some(e => e.name.startsWith('bridge_'))).toBe(false)
    for (const time of [0, 3.35, 5.05, 7.75]) expect(Object.values(campfireActionMix(time, 3, { environmentVolume: 100, audioMuted: true }, 'bridge')).every(value => value === 0)).toBe(true)
  })
})
