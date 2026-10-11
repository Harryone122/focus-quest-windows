import { expect, it } from 'vitest'
import area from '../docs/area-02-moss-station.scene.json'
import reference from '../docs/handoff/area02-camera-direction/camera-keys.json'
import { dirShot, spring, type Anchors, type CameraEvent } from '../src/renderer/src/exploration/storyDirector'

const events = area.storyEvents as CameraEvent[]
const anchors: Anchors = {
  home: [1, 2, 3], traveller: [4, 5, 6],
  world: (u,v,y) => [(u-v)/Math.sqrt(2), y, -(u+v)/Math.sqrt(2)],
  lantern: (_id,p) => [p*10, 1-p, p*5]
}
it('preserves all ten approved tracks and only adds presentation camera fields', () => {
  expect(events).toHaveLength(10)
  for (const ev of events) {
    expect(ev.camera).toEqual(reference.events[ev.id as keyof typeof reference.events].camera)
    const keys = ev.camera!.keys
    expect(keys.at(-1)).toEqual({ p: 1, at: 'home', z: 1 })
    expect(keys.every((k,i) => i === 0 || k.p > keys[i-1].p)).toBe(true)
  }
})
it('resolves every anchor, stays continuous at keys and returns exactly home', () => {
  for (const ev of events) {
    for (let i=0;i<=1000;i++) {
      const p=i/1000, s=dirShot(ev.id,p,anchors,events)
      expect([...s.t,s.z,s.az,s.el].every(Number.isFinite)).toBe(true)
      expect(s.z).toBeGreaterThanOrEqual(1); expect(s.z).toBeLessThanOrEqual(12)
      expect(dirShot(ev.id,p,anchors,events)).toEqual(s)
    }
    for (const k of ev.camera!.keys) {
      const a=dirShot(ev.id,k.p-1e-7,anchors,events), b=dirShot(ev.id,k.p+1e-7,anchors,events)
      for (let n=0;n<3;n++) expect(Math.abs(a.t[n]-b.t[n])).toBeLessThan(0.0001)
      expect(Math.abs(a.z-b.z)).toBeLessThan(0.0001)
    }
    expect(dirShot(ev.id,1,anchors,events)).toEqual({t:anchors.home,z:1,el:0,az:0})
  }
  expect(dirShot(null,0,anchors,events)).toEqual({t:anchors.home,z:1,el:0,az:0})
})
it('uses logarithmic zoom with smoothstep and linear angles/coordinates', () => {
  const e: CameraEvent[]=[{id:'test',camera:{keys:[{p:0,at:[0,0,0],z:1,el:0,az:0},{p:0.8,at:[4,4,4],z:9,el:20,az:-30},{p:1,at:'home',z:1}]}}]
  const s=dirShot('test',0.4,anchors,e)
  expect(s.z).toBeCloseTo(3);expect(s.el).toBe(10);expect(s.az).toBe(-15)
  expect(s.t).toEqual(anchors.world(2,2,2))
})
it('the critically damped spring is frame-rate independent and does not move at pause', () => {
  const direct=spring(0,0,10,1)
  let state:[number,number]=[0,0]
  for(let i=0;i<60;i++) state=spring(...state,10,1/60)
  expect(state[0]).toBeCloseTo(direct[0],10);expect(state[1]).toBeCloseTo(direct[1],10)
  expect(spring(...state,10,0)).toEqual(state)
  expect(direct[0]).toBeGreaterThan(0);expect(direct[0]).toBeLessThan(10)
})
