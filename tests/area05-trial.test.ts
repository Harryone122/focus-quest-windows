import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
const rules = createRequire(import.meta.url)('../src/shared/area05TrialRules.cjs')
const ready = () => { const s = rules.newExploration(); rules.signal(s, 'bell'); rules.mouth(s); return s }
describe('Area 05 echo visit timing authority', () => {
  it('requires a sound and a single mouth echo in this exploration', () => {
    const s = rules.newExploration(); const b = { now: 610, walkToMouth: 20, walkToLamp: 20 }
    expect(rules.fits(s, b)).toBe(false)
    rules.signal(s, 'chime'); expect(rules.mouth(s)).toBe(true); expect(rules.mouth(s)).toBe(false)
    rules.signal(s, 'wall'); expect(s.sound).toBe('chime'); expect(rules.fits(s, b)).toBe(true)
  })
  it('rejects the strict deadline boundary, initial five minutes, rest and bad route estimates', () => {
    const s = ready()
    for (const b of [{ now: 299, walkToMouth: 0, walkToLamp: 0 }, { now: 320, walkToMouth: 10, walkToLamp: 10 }, { now: 610, walkToMouth: 0, walkToLamp: Infinity }, { now: 610, walkToMouth: 0, walkToLamp: 0, resting: true }, { now: 3000, walkToMouth: 0, walkToLamp: 0 }]) expect(rules.fits(s, b)).toBe(false)
    expect(rules.fits(s, { now: 319, walkToMouth: 10, walkToLamp: 10 })).toBe(true)
  })
  it('rechecks on arrival and preserves the one visit limit across serialization', () => {
    const s = ready()
    expect(rules.choose(s, { now: 610, walkToMouth: 30, walkToLamp: 30 })).toBe(true)
    expect(rules.choose(s, { now: 960, walkToMouth: 0, walkToLamp: 20 }, true)).toBe(false)
    expect(s.visits).toBe(0)
    expect(rules.choose(s, { now: 620, walkToMouth: 0, walkToLamp: 20 }, true)).toBe(true)
    expect(rules.fits(JSON.parse(JSON.stringify(s)), { now: 1210, walkToMouth: 0, walkToLamp: 0 })).toBe(false)
  })
  it('reserves the cave for core and second visit events', () => {
    for (const reserved of ['core', 'second']) { const s = ready(); s.reserved = reserved; expect(rules.fits(s, { now: 610, walkToMouth: 0, walkToLamp: 0 })).toBe(false) }
  })
  it('uses saved wind rolls and never rerolls the same effective time', () => {
    const s = rules.newExploration(11)
    expect(rules.wind(s, 239)).toBe(null)
    expect(rules.wind(s, 240)).toMatchObject({ first: true, at: 240 })
    const saved = JSON.parse(JSON.stringify(s)); expect(rules.wind(saved, 240)).toBe(null); expect(saved.seed).toBe(s.seed)
    expect(rules.newExploration().visits).toBe(0)
  })
})
