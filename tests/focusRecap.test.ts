import { expect,it } from 'vitest'
import { RecapDirector, type RecapView } from '../src/shared/recapDirector'
import type { FocusEventRecord,FocusRecap } from '../src/shared/focusPresentation'
import { snapRecapEvent,recapLampCount } from '../src/shared/focusRecap'
import { timeOfDayAt } from '../src/shared/timeOfDay'
import { focusEventCaption } from '../src/shared/focusEventCatalog'
import { eventSeconds,recapClipSeconds } from '../src/shared/focusRecap'
const event=(id:string,seconds:number,kind:FocusEventRecord['kind']='item'):FocusEventRecord=>({id,eventId:id,sessionId:'s',runId:'r',nodeId:'n',mapId:'area-01-cloud-ruins',segment:1,kind,phase:'focus',effectiveSeconds:seconds,explorationSeconds:seconds,timeOfDay:timeOfDayAt(seconds),weather:'clear',seed:1,carriedItems:[],variant:id,skipped:false,recordedAt:'',scene:{}})
const recap=(events:FocusEventRecord[]=[],presentation:'quiet'|'live'='quiet'):FocusRecap=>({sessionId:'s',effectiveSeconds:3000,presentation,events,lamps:[event('l1',600,'lamp'),event('l2',1200,'lamp')]})
function setup(data:FocusRecap){const played:string[]=[],frames:number[]=[],views:RecapView[]=[];const d=new RecapDirector(data,{event:e=>{played.push(e.id);return e.kind==='core'?12:8},frame:t=>frames.push(t),overview:()=>undefined,change:v=>views.push(v)});return {d,played,frames,views}}
function finish(d:RecapDirector){for(let i=0;i<2000&&d.view.mode!=='ask';i++)d.tick(.1);expect(d.view.mode).toBe('ask')}
it('shows ordinary events in time order, including simultaneous records, and puts all cores last',()=>{
 const {d,played}=setup(recap([event('core',900,'core'),event('b',1800),event('a',600),event('a2',600)]));d.start();finish(d)
 expect(played).toEqual(['a','a2','b','core']);expect(d.view.head).toBe(3000)
})
it('grabbing aborts an active clip; marker release resumes at that event without stale completion',()=>{
 const data=recap([event('a',600),event('b',1800),event('core',900,'core')]),{d,played,frames}=setup(data);d.start();d.tick(1);expect(d.view.event?.id).toBe('a');d.tick(1)
 d.grab();const count=frames.length;d.tick(100);expect(frames).toHaveLength(count);expect(d.view.event).toBeNull()
 d.seek(1800);d.release(data.events[1]);finish(d);expect(played).toEqual(['a','b','core'])
})
it('blank release during automatic recap goes to the next event; core markers still defer cores',()=>{
 const data=recap([event('a',600),event('b',1800),event('core',900,'core')]),{d,played}=setup(data);d.start();d.grab();d.seek(1000);d.release(null);finish(d);expect(played).toEqual(['b','core'])
 const second=setup(data);second.d.start();second.d.choose(data.events[2]);finish(second.d);expect(second.played).toEqual(['b','core'])
})
it('does not automatically repeat an already completed core after seeking backward',()=>{
 const data=recap([event('a',600),event('core1',900,'core'),event('core2',1200,'core')]),{d,played}=setup(data);d.start();for(let i=0;i<500&&!d.coreDone.has('core1');i++)d.tick(.1)
 expect(d.view.event?.id).toBe('core2');d.grab();d.seek(0);d.release(null);finish(d);expect(played.filter(id=>id==='core1')).toHaveLength(1)
})
it.each(['quiet','live'] as const)('finished %s recap permits one-event playback and restores the end on blank release',presentation=>{
 const data=recap([event('a',600),event('core',900,'core')],presentation),{d,played}=setup(data);d.start();if(presentation==='quiet')d.skipAll();expect(played).toEqual([])
 d.choose(data.events[1]);expect(d.view.mode).toBe('single');finish(d);expect(played).toEqual(['core']);expect(d.view.head).toBe(3000)
 d.grab();d.seek(500);d.release(null);expect(d.view.mode).toBe('ask');expect(d.view.head).toBe(3000)
})
it('skip-current advances just the clip; skip-all cancels future frames without modifying records',()=>{
 const data=recap([event('a',600),event('b',1800)]),before=structuredClone(data),{d,played,frames}=setup(data);d.start();d.tick(1);d.skipCurrent();expect(d.view.event).toBeNull();d.skipAll();const n=frames.length;d.tick(999);expect(frames.length).toBe(n);expect(played).toEqual(['a']);expect(data).toEqual(before)
})
it('an empty quiet recap takes about two seconds and a live recap has no autoplay',()=>{
 const {d}=setup(recap());d.start();d.tick(1.9);expect(d.view.mode).toBe('auto');d.tick(.1);expect(d.view.mode).toBe('ask')
 const live=setup(recap([event('a',600)],'live'));live.d.start();live.d.tick(999);expect(live.played).toEqual([])
})
it('snaps within 18 CSS pixels at any width and uses effective time for lamps',()=>{
 const data=recap([event('a',600)]);expect(snapRecapEvent(data,653,1000)?.id).toBe('a');expect(snapRecapEvent(data,655,1000)).toBeNull();expect(snapRecapEvent(data,700,500)?.id).toBe('a')
 expect(recapLampCount(data,599)).toBe(0);expect(recapLampCount(data,1200)).toBe(2)
})
it('uses authored clue copy and excludes walking from Nursery replay durations',()=>{
 const e={...event('m07_glass',60,'story'),mapId:'area-07-glass-nursery',variant:'carry_silvered_shard'}
 expect(focusEventCaption(e).name).toBe('玻璃手印');expect(focusEventCaption(e).text).toContain('兩個一樣大的手印');expect(eventSeconds(e)).toBe(11);expect(recapClipSeconds(e)).toBe(8)
 const core={...e,kind:'core' as const,variant:'find_core'};expect(recapClipSeconds(core)).toBe(12)
})
it('plays a record at the first second instead of treating it as already passed',()=>{const {d,played}=setup(recap([event('zero',0)]));d.start();finish(d);expect(played).toEqual(['zero'])})
