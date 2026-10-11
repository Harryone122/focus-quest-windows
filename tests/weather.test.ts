import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { AREA_02_WEATHER, rainWindowsUntil, weatherAt, weatherAllows, weatherSeedFrom } from '../src/shared/weather'

describe('moss weather', () => {
  it('matches the delivered prototype at every half second through 100 minutes', () => {
    const html = readFileSync(new URL('../docs/prototypes/moss-station.html', import.meta.url), 'utf8')
    const source = html.slice(html.indexOf('const WX = AREA.weather;'), html.indexOf('let wx = weatherAt(0);'))
    expect(source).toContain('function weatherAt(t)')
    const prototype = runInNewContext(`${source}; weatherAt`, { AREA: { weather: AREA_02_WEATHER },
      sstep: (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) } })
    for (let t = 0; t <= 6000; t += 0.5) expect(weatherAt(20260927, t)).toEqual(prototype(t))
  })
  it('keeps rain windows 300 seconds with a 900-second cooldown and deterministic seeks', () => {
    const seed = weatherSeedFrom('persistent-node')
    const windows = rainWindowsUntil(seed, 60000)
    expect(windows.length).toBeGreaterThan(1)
    windows.forEach((window, i) => {
      expect(window.end - window.start).toBe(300)
      expect(window.start % 180).toBe(0)
      if (i) expect(window.start - windows[i - 1].end).toBeGreaterThanOrEqual(900)
    })
    const before = weatherAt(seed, 1200)
    weatherAt(seed, 60000)
    expect(weatherAt(seed, 1200)).toEqual(before)
    expect(weatherAt(seed, NaN)).toEqual(weatherAt(seed, 0))
    expect(weatherAllows('dry', 'afterRain')).toBe(true)
    expect(weatherAllows('afterRain', 'dry')).toBe(false)
    expect(weatherAllows('notRain', 'rain')).toBe(false)
  })
})
