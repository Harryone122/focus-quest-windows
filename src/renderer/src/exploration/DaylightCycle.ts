export const DAYLIGHT_CYCLE_SECONDS = 10 * 60

export type DaylightSceneKey = 'morning' | 'noon' | 'afternoon' | 'night'

export interface DaylightPresentationState {
  phase: number
  normalizedProgress: number
  sunAngleDeg: number
  sunHeight: number
  shadowDirectionX: number
  shadowDirectionY: number
  shadowLength: number
  shadowOpacity: number
  ambientIntensity: number
  warmness: number
  layerBrightness: number
}

export interface DaylightSnapshot {
  phase: number
  fromScene: DaylightSceneKey
  toScene: DaylightSceneKey
  sceneBlend: number
  liftAlpha: number
  shadeAlpha: number
  coolAlpha: number
  warmAlpha: number
  fogAlpha: number
  lampAlpha: number
  lanternAlpha: number
  shadowAlpha: number
  shadowAngleDeg: number
  shadowLength: number
  layerBrightness: number
  unlitLampShadeAlpha: number
  presentation: DaylightPresentationState
}

interface DaylightKeyframe extends Omit<DaylightSnapshot, 'phase' | 'fromScene' | 'toScene' | 'sceneBlend' | 'presentation'> {
  at: number
  scene: DaylightSceneKey
  sunHeight: number
  ambientIntensity: number
  warmness: number
}

const MORNING: Omit<DaylightKeyframe, 'at'> = {
  scene: 'morning',
  liftAlpha: 0.004,
  shadeAlpha: 0,
  coolAlpha: 0.004,
  warmAlpha: 0.004,
  fogAlpha: 0.58,
  lampAlpha: 0.38,
  lanternAlpha: 0.5,
  shadowAlpha: 0.2,
  shadowAngleDeg: 25,
  shadowLength: 1.45,
  layerBrightness: 0.92,
  unlitLampShadeAlpha: 0,
  sunHeight: 0.34,
  ambientIntensity: 0.82,
  warmness: 0.28
}

// The paintings already contain their own authored light. These overlays are
// intentionally tiny and only keep the cross-fades visually coherent.
const KEYFRAMES: DaylightKeyframe[] = [
  { at: 0, ...MORNING },
  { at: 0.25, scene: 'noon', liftAlpha: 0.002, shadeAlpha: 0, coolAlpha: 0, warmAlpha: 0, fogAlpha: 0.42, lampAlpha: 0.2, lanternAlpha: 0.34, shadowAlpha: 0.14, shadowAngleDeg: 82, shadowLength: 0.58, layerBrightness: 1, unlitLampShadeAlpha: 0, sunHeight: 1, ambientIntensity: 1, warmness: 0.06 },
  { at: 0.5, scene: 'afternoon', liftAlpha: 0, shadeAlpha: 0.003, coolAlpha: 0, warmAlpha: 0.006, fogAlpha: 0.56, lampAlpha: 0.32, lanternAlpha: 0.48, shadowAlpha: 0.22, shadowAngleDeg: 145, shadowLength: 1.5, layerBrightness: 0.9, unlitLampShadeAlpha: 0.08, sunHeight: 0.38, ambientIntensity: 0.86, warmness: 0.55 },
  { at: 0.75, scene: 'night', liftAlpha: 0, shadeAlpha: 0.018, coolAlpha: 0.006, warmAlpha: 0, fogAlpha: 0.78, lampAlpha: 0.68, lanternAlpha: 0.78, shadowAlpha: 0.08, shadowAngleDeg: 170, shadowLength: 0.9, layerBrightness: 0.43, unlitLampShadeAlpha: 0.7, sunHeight: 0.12, ambientIntensity: 0.4, warmness: 0 },
  // 385 degrees has the same direction vector as the next morning's 25
  // degrees, so directional shadow proxies cross the loop without flipping.
  { at: 1, ...MORNING, shadowAngleDeg: 385 }
]

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

function smootherstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10)
}

export function daylightAt(elapsedSeconds: number, cycleSeconds = DAYLIGHT_CYCLE_SECONDS): DaylightSnapshot {
  const safeCycleSeconds = Math.max(1, cycleSeconds)
  const normalized = ((elapsedSeconds % safeCycleSeconds) + safeCycleSeconds) % safeCycleSeconds
  const phase = normalized / safeCycleSeconds
  const upperIndex = KEYFRAMES.findIndex((keyframe) => keyframe.at >= phase)
  const upper = KEYFRAMES[Math.max(1, upperIndex)]
  const lower = KEYFRAMES[Math.max(0, upperIndex - 1)]
  const sceneBlend = smootherstep((phase - lower.at) / Math.max(0.0001, upper.at - lower.at))
  const shadowAngleDeg = lerp(lower.shadowAngleDeg, upper.shadowAngleDeg, sceneBlend)
  const shadowRadians = shadowAngleDeg * Math.PI / 180
  const shadowLength = lerp(lower.shadowLength, upper.shadowLength, sceneBlend)
  const shadowOpacity = lerp(lower.shadowAlpha, upper.shadowAlpha, sceneBlend)
  const layerBrightness = lerp(lower.layerBrightness, upper.layerBrightness, sceneBlend)
  const presentation: DaylightPresentationState = {
    phase,
    normalizedProgress: phase,
    sunAngleDeg: shadowAngleDeg + 180,
    sunHeight: lerp(lower.sunHeight, upper.sunHeight, sceneBlend),
    shadowDirectionX: Math.cos(shadowRadians),
    shadowDirectionY: Math.sin(shadowRadians),
    shadowLength,
    shadowOpacity,
    ambientIntensity: lerp(lower.ambientIntensity, upper.ambientIntensity, sceneBlend),
    warmness: lerp(lower.warmness, upper.warmness, sceneBlend),
    layerBrightness
  }
  return {
    phase,
    fromScene: lower.scene,
    toScene: upper.scene,
    sceneBlend,
    liftAlpha: lerp(lower.liftAlpha, upper.liftAlpha, sceneBlend),
    shadeAlpha: lerp(lower.shadeAlpha, upper.shadeAlpha, sceneBlend),
    coolAlpha: lerp(lower.coolAlpha, upper.coolAlpha, sceneBlend),
    warmAlpha: lerp(lower.warmAlpha, upper.warmAlpha, sceneBlend),
    fogAlpha: lerp(lower.fogAlpha, upper.fogAlpha, sceneBlend),
    lampAlpha: lerp(lower.lampAlpha, upper.lampAlpha, sceneBlend),
    lanternAlpha: lerp(lower.lanternAlpha, upper.lanternAlpha, sceneBlend),
    shadowAlpha: shadowOpacity,
    shadowAngleDeg,
    shadowLength,
    layerBrightness,
    unlitLampShadeAlpha: lerp(lower.unlitLampShadeAlpha, upper.unlitLampShadeAlpha, sceneBlend),
    presentation
  }
}
