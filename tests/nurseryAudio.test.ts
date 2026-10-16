import { nurseryAudioFrame } from '../src/renderer/src/glassNursery/nurseryAudioFrame'
import {describe,it,expect} from 'vitest'
import {crossedNurseryCues,nurseryAudioCues} from '../src/renderer/src/glassNursery/nurseryAudioCues'
describe('nursery audio follows the local visible action',()=>{
 it('starts tray watering only when the visible drip window opens',()=>{
  expect(crossedNurseryCues('first',4,4.1,14)).toEqual([])
  expect(crossedNurseryCues('first',4.2,4.25,14).map(c=>c.name)).toEqual(['nursery_tray_water'])
 })
 it('aligns the lock, hinge, lift and shrink with their physical visual thresholds',()=>{
  expect(nurseryAudioCues.core.map(c=>c.at)).toEqual([.08,.14,.62,.62])
  expect(crossedNurseryCues('core',6.8,6.85,11).map(c=>c.name)).toEqual(['nursery_jar_lift','nursery_jar_shrink'])
 })
 it('does not replay cues after jumping ahead, or while paused',()=>{
  expect(crossedNurseryCues('core',0,9,11)).toEqual([])
  expect(crossedNurseryCues('core',7,7,11)).toEqual([])
  expect(crossedNurseryCues('core',9,2,11)).toEqual([])
 })
 it('keeps lamps, growing plants, reflected light and watching water silent',()=>{
  for(const key of ['lamp','grow','shard','pool','tree','lean'])expect(nurseryAudioCues[key]).toBeUndefined()
 })
 it('marks the three strokes at the same thresholds as the new visible ticks',()=>{
  expect(nurseryAudioCues.marks.map(c=>c.at)).toEqual([.2,.42,.64])
 })
})

it('keeps valid scene automation intact and makes transient invalid values safe for Web Audio',()=>{
 const valid={run:.4,turn:.2,mist:.7,vortex:.1,burst:0,fade:1};expect(nurseryAudioFrame(valid)).toEqual(valid)
 const invalid={...valid,mist:NaN,vortex:Infinity,fade:NaN};expect(nurseryAudioFrame(invalid)).toEqual({...valid,mist:0,vortex:0,fade:0});expect(Number.isNaN(invalid.mist)).toBe(true)
})
