import { describe, expect, it } from 'vitest'
import { suggestSteps } from '../src/shared/decomposition'
import { calculateLight, effectiveSeconds } from '../src/shared/rewards'

describe('local task decomposition', () => {
  it('returns two to four immediately usable steps', () => {
    const result = suggestSteps('report', 'too_big', '期末報告', '完成研究背景')
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.length).toBeLessThanOrEqual(4)
    expect(result.some((step) => step.includes('十五分鐘'))).toBe(true)
  })
})

describe('focus rewards', () => {
  it('does not reward sessions shorter than the minimum', () => {
    expect(calculateLight(599, 10, 0)).toBe(0)
  })

  it('caps one session at three light and one day at six', () => {
    expect(calculateLight(60 * 60, 10, 0)).toBe(3)
    expect(calculateLight(60 * 60, 10, 5)).toBe(1)
    expect(calculateLight(60 * 60, 10, 6)).toBe(0)
  })

  it('removes suspended time', () => {
    expect(effectiveSeconds('2026-01-01T10:00:00.000Z', '2026-01-01T10:20:00.000Z', 300)).toBe(900)
  })
})
