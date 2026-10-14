import {describe,it,expect} from 'vitest'
import {NurseryBgmSchedule,nurseryLeafEnvelope} from '../src/renderer/src/glassNursery/nurseryBgm'
describe('nursery continuous music and leaf swells',()=>{
 it('starts on arrival and selects consecutive daytime cuts without a silent gap',()=>{
  const s=new NurseryBgmSchedule(0,()=>.5),first=s.pick(0,'day')
  expect(first).toBeTruthy();s.ended(59.2,'day');expect(s.nextAt).toBe(59.2)
  expect(s.pick(59.2,'day')).not.toBe(first)
 })
 it('keeps music available at dusk, at night and throughout core discovery',()=>{
  const s=new NurseryBgmSchedule(0,()=>0)
  expect(s.pick(0,'dusk')).toBeTruthy();expect(s.pick(10,'night')).toBe('bgm_c')
  s.setCore(true,20);expect(s.pick(20,'night')).toBe('bgm_c')
  s.setCore(false,21);expect(s.pick(21,'day')).toBeTruthy()
 })
 it('uses audio time deadlines that remain frozen while paused',()=>{
  const s=new NurseryBgmSchedule(12,()=>0)
  expect(s.pick(11,'day')).toBeNull();expect(s.pick(11,'night')).toBeNull()
  expect(s.pick(12,'night')).toBe('bgm_c')
 })
 it('gently rises and falls with an eleven-second silent interval',()=>{
  expect(nurseryLeafEnvelope(0)).toBe(0)
  expect(nurseryLeafEnvelope(1)).toBeLessThan(nurseryLeafEnvelope(2))
  expect(nurseryLeafEnvelope(3.5)).toBeCloseTo(.65)
  expect(nurseryLeafEnvelope(6)).toBeCloseTo(nurseryLeafEnvelope(1))
  for(const t of [7,10,17,18])expect(nurseryLeafEnvelope(t)).toBe(0)
  expect(nurseryLeafEnvelope(21.5)).toBeCloseTo(.65)
 })
})
