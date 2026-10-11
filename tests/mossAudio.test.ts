import { afterEach, describe, expect, it } from 'vitest'
import { mossAudioMix } from '../src/renderer/src/mossStation/mossStationAudio'
import { weatherAt } from '../src/shared/weather'
import { FocusQuestDatabase } from '../src/main/database'

let db: FocusQuestDatabase | undefined
afterEach(() => { db?.close(); db = undefined })
describe('Moss ambience and volume persistence', () => {
  it('matches saved rain density and keeps the entire environment muted at zero', () => {
    const seed = 1, settings = { environmentVolume: 35, musicVolume: 12 }
    for (let seconds = 0; seconds <= 3000; seconds += 5) {
      const mix = mossAudioMix(seed, seconds, settings), rain = weatherAt(seed, seconds).rain
      expect(mix.rain).toBeCloseTo(Math.pow(0.35, 1.4) * rain * 0.34)
      expect(Object.values(mix).every(value => value >= 0 && Number.isFinite(value))).toBe(true)
      const muted = mossAudioMix(seed, seconds, { environmentVolume: 0, musicVolume: 0 })
      expect(Object.values(muted).every(value => value === 0)).toBe(true)
    }
  })
  it('preserves independent sound settings through backup and imports pre-audio saves', () => {
    db = new FocusQuestDatabase(':memory:')
    expect(db.getSnapshot().settings).toMatchObject({ environmentVolume: 35, musicVolume: 12 })
    db.updateSettings({ environmentVolume: 0, musicVolume: 27, audioMuted: true })
    db.importBackup(db.exportBackup())
    expect(db.getSnapshot().settings).toMatchObject({ environmentVolume: 0, musicVolume: 27, audioMuted: true })
    const legacy = db.exportBackup(); legacy.version = 12
    const settings = legacy.data.settings[0] as Record<string, unknown>
    delete settings.environment_volume; delete settings.music_volume; delete settings.audio_muted
    db.importBackup(legacy)
    expect(db.getSnapshot().settings).toMatchObject({ environmentVolume: 35, musicVolume: 12, audioMuted: false })
    expect(() => db!.updateSettings({ environmentVolume: NaN })).toThrow()
    expect(() => db!.updateSettings({ musicVolume: 101 })).toThrow()
  })
})
