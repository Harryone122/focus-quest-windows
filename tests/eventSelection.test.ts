import { describe, expect, it } from 'vitest'
import { avoidRecentEventSpots, eventCooldownWeight, nearbyEventWeight } from '../src/shared/eventSelection'

describe('shared exploration event policy', () => {
  it('avoids both recent places but only relaxes locations if every eligible candidate is excluded', () => {
    const eligible = [{ id: 'a', spot: 'here' }, { id: 'b', spot: 'last' }, { id: 'c', spot: 'elsewhere' }]
    expect(avoidRecentEventSpots(eligible, 'here', 'last')).toEqual([eligible[2]])
    expect(avoidRecentEventSpots(eligible.slice(0, 2), 'here', 'last')).toEqual(eligible.slice(0, 2))
    expect(avoidRecentEventSpots([], 'here', 'last')).toEqual([])
  })
  it('uses scene distance, retains a nonzero distant chance and recovers at 15/30 effective minutes', () => {
    expect(nearbyEventWeight(2, 5, 2000)).toBe(1)
    expect(nearbyEventWeight(2, 45, 2000)).toBe(0.2)
    expect(nearbyEventWeight(2, 45, 2000, 1999)).toBeGreaterThan(0)
    expect([899, 900, 1799, 1800].map(ago => eventCooldownWeight(3000, 3000 - ago))).toEqual([0.08, 0.45, 0.45, 1])
    expect(eventCooldownWeight(0, undefined)).toBe(1)
    expect(nearbyEventWeight(2, 5, 899, 0)).toBe(0.08)
  })
})
