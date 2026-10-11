import {describe,it,expect} from 'vitest'
import {NurseryBgmSchedule} from '../src/renderer/src/glassNursery/nurseryBgm'
describe('nursery intermittent music',()=>{
 it('waits on arrival, leaves daytime gaps and avoids repeating its previous daytime cut',()=>{
  const s=new NurseryBgmSchedule(0,()=>.5)
  expect(s.pick(29,'day')).toBeNull();const first=s.pick(30,'day');expect(first).toBeTruthy()
  s.ended(89.2,'day');expect(s.nextAt).toBe(194.2);expect(s.pick(190,'day')).toBeNull()
  expect(s.pick(194.2,'day')).not.toBe(first)
 })
 it('selects the next library from the current period and never starts at dusk',()=>{
  const s=new NurseryBgmSchedule(0,()=>0)
  expect(s.pick(100,'dusk')).toBeNull();expect(s.pick(100,'night')).toBe('bgm_c')
  s.ended(138.5,'night');expect(s.nextAt).toBe(228.5);expect(s.pick(228,'night')).toBeNull()
  expect(s.pick(228.5,'day')).toBe('bgm_a')
 })
 it('holds music throughout core pickup and for a six second motif plus thirty seconds afterwards',()=>{
  const s=new NurseryBgmSchedule(0,()=>0);s.setCore(true,20)
  expect(s.pick(200,'day')).toBeNull();s.setCore(false,201)
  expect(s.pick(236.9,'day')).toBeNull();expect(s.pick(237,'day')).toBeTruthy()
 })
 it('uses the frozen audio clock for pause rather than elapsed wall time',()=>{
  const s=new NurseryBgmSchedule(0,()=>0);s.ended(40,'day')
  expect(s.pick(40,'day')).toBeNull();expect(s.pick(40,'night')).toBeNull();expect(s.nextAt).toBe(100)
 })
})
