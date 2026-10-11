import { describe, expect, it } from 'vitest'
import { prepareCampfireAsset } from '../src/renderer/src/lobby/campfireAssets'

function recording(samples: number[], rate = 100) {
  const data = Float32Array.from(samples)
  return { sampleRate: rate, length: data.length, duration: data.length / rate, numberOfChannels: 1, getChannelData: () => data } as unknown as AudioBuffer
}
const context = { createBuffer: (_channels: number, length: number, rate: number) => recording(Array(length).fill(0), rate) } as unknown as BaseAudioContext

describe('Supplied campfire recording processing', () => {
  it('preserves incoming samples while calibrating quiet recordings and limiting isolated peaks', () => {
    const original = recording([...Array(199).fill(0.0001), 0.9]), before = original.getChannelData(0).slice()
    const { buffer, calibration } = prepareCampfireAsset(context, original, false)
    expect(original.getChannelData(0)).toEqual(before)
    expect(calibration.gain).toBeGreaterThan(1)
    expect(calibration.peak).toBeLessThanOrEqual(0.7)
    expect(Array.from(buffer.getChannelData(0)).every(Number.isFinite)).toBe(true)
    expect(calibration.loopStart).toBe(0)
  })
  it('joins the tail to the loop-start neighborhood without adding silence to silent material', () => {
    const { buffer, calibration } = prepareCampfireAsset(context, recording([...Array(100).fill(0.002), ...Array(100).fill(-0.003)]), true)
    expect(calibration.loopStart).toBe(0.4)
    expect(buffer.getChannelData(0).at(-1)).toBeCloseTo(buffer.getChannelData(0)[39], 6)
    const silent = prepareCampfireAsset(context, recording(Array(200).fill(0)), true)
    expect(silent.calibration.peak).toBe(0)
  })
})
