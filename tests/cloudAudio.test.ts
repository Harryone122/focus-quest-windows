import { describe, expect, it } from 'vitest'
import { cloudAudioMix } from '../src/renderer/src/cloudRuins/cloudRuinsAudio'

describe('Cloud Ruins audio follows scene daylight', () => {
  it('reduces birds toward night and returns to dawn without a boundary jump', () => {
    expect(cloudAudioMix(0).birds).toBe(1)
    expect(cloudAudioMix(150).birds).toBe(0.7)
    expect(cloudAudioMix(450).birds).toBe(0)
    expect(Math.abs(cloudAudioMix(599.99).birds - cloudAudioMix(600).birds)).toBeLessThan(0.00001)
    expect(cloudAudioMix(600).birds).toBe(1)
  })
  it('keeps gusts gentle and bounded throughout a fifty-minute visit', () => {
    for (let second = 0; second <= 3000; second += 7) {
      const mix = cloudAudioMix(second)
      expect(mix.gust).toBeGreaterThan(0.18)
      expect(mix.gust).toBeLessThan(0.94)
      expect(mix.birds).toBeGreaterThanOrEqual(0)
      expect(mix.birds).toBeLessThanOrEqual(1)
    }
  })
})
