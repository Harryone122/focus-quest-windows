import fireUrl from './audio/camp_fire_loop.mp3?url'
import windUrl from './audio/camp_wind_loop.mp3?url'
import waterUrl from './audio/camp_water_far_loop.mp3?url'
import tarpUrl from './audio/camp_tarp_loop.mp3?url'
import birdsUrl from './audio/camp_dawn_birds.mp3?url'

export const campfireAssetUrls = { fire: fireUrl, wind: windUrl, water: waterUrl, tarp: tarpUrl, birds: birdsUrl }
export type CampfireAssetKey = keyof typeof campfireAssetUrls
export interface AssetCalibration { seconds: number; inputRms: number; outputRms: number; peak: number; gain: number; loopStart: number }
// AudioBuffers can be reused across contexts. Do not repeat the sample processing on departure.
const preparedAssets = new Map<CampfireAssetKey, ReturnType<typeof prepareCampfireAsset>>()

/** Loudness and loop processing of supplied recordings, never synthesis. */
export function prepareCampfireAsset(context: BaseAudioContext, original: AudioBuffer, loop: boolean, key?: CampfireAssetKey) {
  let sum = 0
  for (let c = 0; c < original.numberOfChannels; c++) for (const value of original.getChannelData(c)) sum += value * value
  const inputRms = Math.sqrt(sum / (original.length * original.numberOfChannels))
  const gain = Math.min(1000, 0.07 / Math.max(0.000001, inputRms))
  const buffer = context.createBuffer(original.numberOfChannels, original.length, original.sampleRate)
  const seam = loop ? Math.min(Math.floor(original.sampleRate * (key === 'water' ? 2 : 0.4)), Math.floor(original.length / 4)) : 0
  let peak = 0; sum = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const input = original.getChannelData(c), output = buffer.getChannelData(c)
    const cutoff = key === 'fire' ? 3400 : key === 'wind' ? 650 : key === 'water' ? 1400 : key === 'tarp' ? 2400 : 6500
    const lowAlpha = 1 - Math.exp(-2 * Math.PI * cutoff / original.sampleRate)
    const highAlpha = Math.exp(-2 * Math.PI * (key === 'wind' ? 65 : 100) / original.sampleRate)
    let low = 0, high = 0, previousLow = 0
    for (let i = 0; i < output.length; i++) {
      const limited = 0.7 * Math.tanh(input[i] * gain / 0.7)
      if (key) { low += lowAlpha * (limited - low); high = highAlpha * (high + low - previousLow); previousLow = low; output[i] = high }
      else output[i] = limited
    }
    if (seam > 0) {
      const head = output.slice(0, seam)
      for (let i = 0; i < seam; i++) { const blend = i / (seam - 1); output[output.length - seam + i] = output[output.length - seam + i] * (1 - blend) + head[i] * blend }
    }
    for (const value of output) { sum += value * value; peak = Math.max(peak, Math.abs(value)) }
  }
  return { buffer, calibration: { seconds: original.duration, inputRms, outputRms: Math.sqrt(sum / (buffer.length * buffer.numberOfChannels)), peak, gain, loopStart: seam / original.sampleRate } satisfies AssetCalibration }
}

export async function loadCampfireAssets(context: BaseAudioContext, signal?: AbortSignal) {
  const results = await Promise.allSettled(Object.entries(campfireAssetUrls).map(async ([key, url]) => {
    const cached = preparedAssets.get(key as CampfireAssetKey)
    if (cached) return [key, cached] as const
    const response = await fetch(url, { signal }); if (!response.ok) throw new Error(`Missing campfire asset: ${key}`)
    const decoded = await context.decodeAudioData(await response.arrayBuffer())
    // Let the scene paint between decoded files instead of processing the whole batch in one turn.
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    if (signal?.aborted) throw new Error('Campfire loading cancelled')
    const prepared = prepareCampfireAsset(context, decoded, key !== 'birds', key as CampfireAssetKey)
    preparedAssets.set(key as CampfireAssetKey, prepared)
    return [key, prepared] as const
  }))
  return Object.fromEntries(results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])) as Partial<Record<CampfireAssetKey, ReturnType<typeof prepareCampfireAsset>>>
}
