import { describe, expect, it } from 'vitest'
import { DAY_NIGHT_CYCLE_SECONDS, timeOfDayAt } from '../src/shared/timeOfDay'

describe('ten-minute daylight cycle', () => {
  it('reaches each authored lighting preset every two and a half minutes', () => {
    expect(DAY_NIGHT_CYCLE_SECONDS).toBe(600)
    expect([0, 150, 300, 450, 600].map((seconds) => timeOfDayAt(seconds).from))
      .toEqual(['dawn', 'day', 'dusk', 'night', 'dawn'])
  })

  it('continues from saved effective time and wraps smoothly into dawn', () => {
    expect(timeOfDayAt(750)).toEqual(timeOfDayAt(150))
    expect(timeOfDayAt(599.9).to).toBe('dawn')
    expect(timeOfDayAt(599.9).blend).toBeGreaterThan(0.99)
    expect(timeOfDayAt(600).blend).toBe(0)
  })

  it('starts at dawn if effective time is unavailable', () => {
    expect(timeOfDayAt(Number.NaN)).toEqual(timeOfDayAt(0))
    expect(timeOfDayAt(-10)).toEqual(timeOfDayAt(0))
  })
})
