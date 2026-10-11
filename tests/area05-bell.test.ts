import { describe, it, expect } from 'vitest'
import { advanceBellPendulum, type BellPendulum } from '../src/renderer/src/echoQuarry/bellPendulum'

const initial = (): BellPendulum => ({ th: 0, v: 0, queue: 1, cool: 0 })
describe('Area 05 hanging striker', () => {
  it('pulls continuously instead of jumping to half a radian', () => {
    const s = initial(); let strikes = 0, largestStep = 0
    for (let i = 0; i < 1200; i++) {
      const before = s.th
      advanceBellPendulum(s, 1 / 120, 2, .2, () => strikes++)
      largestStep = Math.max(largestStep, Math.abs(s.th - before))
    }
    expect(largestStep).toBeLessThan(.025)
    expect(strikes).toBe(1)
    expect(s.queue).toBe(0)
  })
  it('freezes a queued or moving log when paused', () => {
    const s = initial(), before = { ...s }
    advanceBellPendulum(s, 0, 2, .2, () => { throw Error('paused strike') })
    expect(s).toEqual(before)
  })
  it('keeps repeated strokes continuous and delivers thirteen strikes', () => {
    const s = initial(); s.queue = 13
    let strikes = 0, largestStep = 0
    for (let i = 0; i < 36000; i++) {
      const before = s.th
      advanceBellPendulum(s, 1 / 120, 2, .2, () => strikes++)
      largestStep = Math.max(largestStep, Math.abs(s.th - before))
    }
    expect(strikes).toBe(13)
    expect(largestStep).toBeLessThan(.025)
  })
  it('uses stable substeps when frames are slow', () => {
    const a = initial(), b = initial(); let hitsA = 0, hitsB = 0
    for (let i = 0; i < 100; i++) advanceBellPendulum(a, .1, 2, .2, () => hitsA++)
    for (let i = 0; i < 1200; i++) advanceBellPendulum(b, 1 / 120, 2, .2, () => hitsB++)
    expect(a.th).toBeCloseTo(b.th, 8)
    expect(hitsA).toBe(hitsB)
  })
})
