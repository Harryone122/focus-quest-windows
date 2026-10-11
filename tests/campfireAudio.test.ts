import { describe, expect, it } from 'vitest'
import { campfireAudioMix, campfireDepartureMix, crossedDepartureCues } from '../src/renderer/src/lobby/campfireAudio'

describe('campfire ambience settings', () => {
  it('plays each crossed cue once, skips stale cues on recovery, and follows the exit surface', () => {
    expect(crossedDepartureCues(1.95, 2.12).map(cue => cue.kind)).toEqual(['glass'])
    expect(crossedDepartureCues(2.12, 2.2)).toEqual([])
    expect(crossedDepartureCues(0, 4, 'bridge')).toEqual([{ at: 3.99, kind: 'wood' }])
    expect(crossedDepartureCues(2.75, 2.9, 'steps')).toEqual([{ at: 2.85, kind: 'stone' }])
    expect(crossedDepartureCues(4, 1)).toEqual([])
  })
  it('boosts fire at ignition, then recedes while mist wind carries the handoff', () => {
    const settings = { environmentVolume: 35 }
    expect(campfireDepartureMix(2.05, 0, settings).fire / campfireAudioMix(2.05, 0, settings).fire).toBeCloseTo(1.35)
    expect(campfireDepartureMix(4, 0, settings).water).toBeLessThan(campfireDepartureMix(2, 0, settings).water)
    expect(campfireDepartureMix(5, 0, settings).wind).toBeGreaterThan(0)
    expect(Object.values(campfireDepartureMix(3, 0, { environmentVolume: 0, musicVolume: 100 })).every(value => value === 0)).toBe(true)
  })
  it('silences every layer with mute and clamps invalid volumes', () => {
    for (const settings of [{ environmentVolume: 35, audioMuted: true }, { environmentVolume: 0 }, { environmentVolume: NaN }, { environmentVolume: -10 }]) {
      expect(Object.values(campfireAudioMix(8, 3, settings)).every(value => value === 0)).toBe(true)
    }
    expect(campfireAudioMix(8, 3, { environmentVolume: 1000 })).toEqual(campfireAudioMix(8, 3, { environmentVolume: 100 }))
  })
  it('keeps fire foremost and only adds tarp sound when the shelter exists', () => {
    for (let seconds = 0; seconds < 300; seconds++) {
      const mix = campfireAudioMix(seconds, 0, { environmentVolume: 35 })
      expect(mix.fire).toBeGreaterThan(mix.wind)
      expect(mix.fire).toBeGreaterThan(mix.water)
      expect(mix.tarp).toBe(0)
    }
    expect(campfireAudioMix(8, 3, { environmentVolume: 35 }).tarp).toBeGreaterThan(0)
  })
})
