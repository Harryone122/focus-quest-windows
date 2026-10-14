import { describe, expect, it } from 'vitest'
import { advanceAnimation } from '../src/renderer/src/animationSteps'

describe('elapsed animation playback', () => {
  it.each([5, 10, 15, 20, 30, 60])('preserves ten seconds at %i fps with bounded steps', fps => {
    let elapsed = 0
    let largest = 0
    for (let frame = 0; frame < fps * 10; frame++) {
      advanceAnimation(1 / fps, dt => { elapsed += dt; largest = Math.max(largest, dt) })
    }
    expect(elapsed).toBeCloseTo(10, 8)
    expect(largest).toBeLessThanOrEqual(0.05)
  })
  it('keeps pause frozen and bounds long stalls', () => {
    const steps: number[] = []
    advanceAnimation(0, dt => steps.push(dt))
    expect(steps).toEqual([0])
    expect(advanceAnimation(120, () => {})).toBe(1)
    expect(advanceAnimation(Number.NaN, () => {})).toBe(0)
  })
})
