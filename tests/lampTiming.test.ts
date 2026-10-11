import { describe, expect, it } from 'vitest'
import { fitsBeforeLamp, litLampCount } from '../src/shared/lampTiming'

describe('shared map and HUD milestones', () => {
  it('lights each 50-minute milestone exactly on time, including the reported 47-minute case', () => {
    for (let lamp = 1; lamp <= 5; lamp++) {
      expect(litLampCount(lamp * 600 - 0.01, 3000)).toBe(lamp - 1)
      expect(litLampCount(lamp * 600, 3000)).toBe(lamp)
    }
    expect(litLampCount(47 * 60, 3000)).toBe(4)
    expect(litLampCount(6000, 3000)).toBe(5)
    expect(litLampCount(-1, 3000)).toBe(0)
  })
  it('preserves legacy route durations and saved partial progress', () => {
    for (const target of [1500, 3000, 5400]) {
      expect(litLampCount(target * 0.8, target)).toBe(4)
      expect(litLampCount(target * 0.6 - 1, target)).toBe(2)
    }
  })
  it('reserves return travel and preparation even for special reveals and short pauses', () => {
    expect(fitsBeforeLamp(120, 30, 70, 40)).toBe(false)
    expect(fitsBeforeLamp(148, 30, 70, 40)).toBe(true)
    expect(fitsBeforeLamp(65, 0, 26, 50)).toBe(false)
  })
})
