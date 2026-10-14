import {describe,it,expect} from 'vitest'
import {QuarryBgmSchedule} from '../src/renderer/src/echoQuarry/quarryBgm'

describe('Area 05 music spacing and core priority',()=>{
  it('leaves environment alone for the arrival interval and respects a frozen audio clock',()=>{
    const s=new QuarryBgmSchedule(12,()=>.5)
    expect(s.nextAt).toBe(42)
    for(let i=0;i<100;i++)expect(s.pick(41,'day',false,150)).toBeNull()
    const cut=s.pick(42,'day',false,150)!
    expect(cut.seconds).toBeGreaterThanOrEqual(60);expect(cut.seconds).toBeLessThanOrEqual(120)
    expect(cut.offset+cut.seconds).toBeLessThanOrEqual(147)
    expect((cut.offset-.01)/(240/68)).toBeCloseTo(Math.round((cut.offset-.01)/(240/68)))
    expect(s.nextAt-(42+cut.seconds)).toBe(45)
  })
  it('uses the right quiet intervals over many different random starts',()=>{
    for(const period of ['dawn','day','dusk','night'] as const)for(const r of [0,.15,.7,.999999]){
      const s=new QuarryBgmSchedule(0,()=>r),at=s.nextAt,c=s.pick(at,period,false,150)!
      expect(c.seconds).toBeGreaterThanOrEqual(60);expect(c.seconds).toBeLessThanOrEqual(120)
      const [lo,hi]=period==='night'?[60,120]:period==='dusk'?[45,90]:[30,60]
      expect(s.nextAt-at-c.seconds).toBeGreaterThanOrEqual(lo);expect(s.nextAt-at-c.seconds).toBeLessThanOrEqual(hi)
    }
  })
  it('does not open music during mountain wind or discovery and preserves the post-motif silence',()=>{
    const s=new QuarryBgmSchedule(0,()=>0)
    expect(s.pick(120,'day',true,150)).toBeNull()
    s.core(130)
    expect(s.pick(159.99,'day',false,150)).toBeNull()
    expect(s.pick(160,'day',false,150)).not.toBeNull()
  })
  it('seeks directly to a new quiet interval without consuming earlier passages',()=>{
    const s=new QuarryBgmSchedule(0,()=>.5);s.seek(500)
    expect(s.nextAt).toBe(530);expect(s.lastOffset).toBe(-1)
    expect(s.pick(529,'night',false,150)).toBeNull()
  })
  it('avoids the last cut and refuses an incomplete source',()=>{
    const s=new QuarryBgmSchedule(0,()=>.5),a=s.pick(30,'day',false,150)!
    const b=s.pick(s.nextAt,'day',false,150)!
    expect(b.offset).not.toBe(a.offset)
    expect(s.pick(10000,'day',false,40)).toBeNull()
  })
})
