/**
 * Area weather (first used by Area 02 苔痕驛站).
 *
 * Weather runs on the same clock as the day/night cycle: effective Focus seconds,
 * frozen while paused. It is a separate line from time of day — rain never delays
 * or shifts dawn/day/dusk/night; it only forces the sky to overcast while it lasts.
 *
 * The schedule is a pure function of (seed, seconds), so the HUD, the scene, a
 * reload mid-session and QA all agree without storing anything. Weather never
 * affects lamps, rewards, keepsakes, the core roll or its pity counter.
 */

export interface WeatherConfig {
  rollEverySeconds: number
  rainChance: number
  rainSeconds: number
  cooldownSeconds: number
  fadeInSeconds: number
  fadeOutSeconds: number
  afterRainSeconds: number
}

export const AREA_02_WEATHER: WeatherConfig = {
  rollEverySeconds: 180,
  rainChance: 0.15,
  rainSeconds: 300,
  cooldownSeconds: 900,
  fadeInSeconds: 30,
  fadeOutSeconds: 30,
  afterRainSeconds: 240
}

export type WeatherPhase = 'dry' | 'rain' | 'afterRain'

export interface RainWindow {
  start: number
  end: number
}

export interface WeatherState {
  phase: WeatherPhase
  /** 0..1 sky overcast amount; 1 for the whole shower. Blend clear → rain presets with it. */
  overcast: number
  /** 0..1 rain streak density. */
  rain: number
  /** 0..1 how wet surfaces look (darker, glossier; puddles). Dries over afterRainSeconds. */
  wet: number
  window: RainWindow | null
}

/** Event / rest-activity `weather` field in the scene JSON. */
export type WeatherCondition = 'dry' | 'rain' | 'afterRain' | 'notRain'

function mulberry32(seed: number): number {
  let a = seed | 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Roll k (k = 1, 2, 3 …) happens at k × rollEverySeconds. */
function rollAt(seed: number, k: number): number {
  return mulberry32((seed ^ Math.imul(k, 0x9e3779b1)) >>> 0)
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Stable 32-bit seed (FNV-1a). Area 02 uses its persisted exploration node ID, not a Focus session ID. */
export function weatherSeedFrom(sessionId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Every rain window that has started at or before `effectiveSeconds`.
 * A roll is skipped while a shower or its cooldown (cooldownSeconds after the end) is running.
 */
export function rainWindowsUntil(seed: number, effectiveSeconds: number, config: WeatherConfig = AREA_02_WEATHER): RainWindow[] {
  const seconds = Number.isFinite(effectiveSeconds) ? Math.max(0, effectiveSeconds) : 0
  const windows: RainWindow[] = []
  for (let k = 1; k * config.rollEverySeconds <= seconds; k++) {
    const at = k * config.rollEverySeconds
    const last = windows[windows.length - 1]
    if (last && at < last.end + config.cooldownSeconds) continue
    if (rollAt(seed, k) < config.rainChance) windows.push({ start: at, end: at + config.rainSeconds })
  }
  return windows
}

export function weatherAt(seed: number, effectiveSeconds: number, config: WeatherConfig = AREA_02_WEATHER): WeatherState {
  const t = Number.isFinite(effectiveSeconds) ? Math.max(0, effectiveSeconds) : 0
  const out: WeatherState = { phase: 'dry', overcast: 0, rain: 0, wet: 0, window: null }
  const windows = rainWindowsUntil(seed, t, config)
  const w = windows[windows.length - 1]
  if (!w) return out
  const u = t - w.start
  const len = w.end - w.start
  if (t < w.end) {
    out.overcast = smoothstep(0, config.fadeInSeconds, u) * (1 - smoothstep(len - config.fadeOutSeconds * 0.4, len + 6, u))
    out.rain = smoothstep(10, 35, u) * (1 - smoothstep(len - 35, len - 4, u))
    out.wet = smoothstep(12, 60, u)
    out.window = w
    out.phase = out.rain > 0.25 ? 'rain' : u > len / 2 ? 'afterRain' : 'dry'
  } else if (t < w.end + config.afterRainSeconds) {
    const a = t - w.end
    out.wet = 1 - a / config.afterRainSeconds
    out.overcast = 1 - smoothstep(0, 12, a)
    out.phase = 'afterRain'
    out.window = w
  }
  return out
}

/** `dry` and `notRain` both mean "not raining right now" (after-rain counts). */
export function weatherAllows(condition: WeatherCondition | undefined, phase: WeatherPhase): boolean {
  if (!condition) return true
  if (condition === 'rain') return phase === 'rain'
  if (condition === 'afterRain') return phase === 'afterRain'
  return phase !== 'rain'
}
