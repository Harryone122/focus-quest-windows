import {describe,it,expect} from 'vitest'
import {QuarryBgmSchedule,QUARRY_BGM_CROSSFADE} from '../src/renderer/src/echoQuarry/quarryBgm'

describe('Area 05 continuous music and core priority',()=>{
  it('fades in shortly after arrival and respects a frozen audio clock',()=>{
    const s=new QuarryBgmSchedule(12,()=>.5)
    expect(s.nextAt).toBe(14)
    for(let i=0;i<100;i++)expect(s.pick(13.9,'day',false,150)).toBeNull()
    const cut=s.pick(14,'day',false,150)!
    expect(cut.seconds).toBeGreaterThanOrEqual(60);expect(cut.seconds).toBeLessThanOrEqual(120)
    expect(cut.offset+cut.seconds).toBeLessThanOrEqual(147)
    expect((cut.offset-.01)/(240/68)).toBeCloseTo(Math.round((cut.offset-.01)/(240/68)))
  })
  it('starts the next segment inside the current fade-out in every period, leaving no silence',()=>{
    for(const period of ['dawn','day','dusk','night'] as const)for(const r of [0,.15,.7,.999999]){
      const s=new QuarryBgmSchedule(0,()=>r),at=s.nextAt,c=s.pick(at,period,false,150)!
      expect(c.seconds).toBeGreaterThanOrEqual(60);expect(c.seconds).toBeLessThanOrEqual(120)
      expect(s.nextAt).toBeCloseTo(at+c.seconds-QUARRY_BGM_CROSSFADE)
    }
  })
  it('steps aside only for the core motif and returns right after it',()=>{
    const s=new QuarryBgmSchedule(0,()=>0)
    expect(s.pick(120,'day',true,150)).toBeNull()
    s.core(130)
    expect(s.pick(131.99,'day',false,150)).toBeNull()
    expect(s.pick(132,'day',false,150)).not.toBeNull()
  })
  it('seeks directly to a fresh fade-in without consuming earlier passages',()=>{
    const s=new QuarryBgmSchedule(0,()=>.5);s.seek(500)
    expect(s.nextAt).toBe(502);expect(s.lastOffset).toBe(-1)
    expect(s.pick(501,'night',false,150)).toBeNull()
  })
  it('avoids the last cut and refuses an incomplete source',()=>{
    const s=new QuarryBgmSchedule(0,()=>.5),a=s.pick(30,'day',false,150)!
    const b=s.pick(s.nextAt,'day',false,150)!
    expect(b.offset).not.toBe(a.offset)
    expect(s.pick(10000,'day',false,40)).toBeNull()
  })
})
