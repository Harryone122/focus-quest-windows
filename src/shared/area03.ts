import scene from '../../docs/area03/area-03-reflection-lake.scene.json'
import { weatherSeedFrom } from './weather'
import { timeOfDayAt } from './timeOfDay'
import { avoidRecentEventSpots, nearbyEventWeight } from './eventSelection'

export const LAKE_AREA_ID = 'area-03-reflection-lake' as const
export type LakeExit = 'a_arch' | 'b_far'
export interface LakeMarks { cupLeft: boolean; ringStill: boolean; boatShells: number; pineCones: number; gaugeCarving: boolean }
export const emptyLakeMarks = (): LakeMarks => ({ cupLeft: false, ringStill: true, boatShells: 0, pineCones: 0, gaugeCarving: false })
const smooth = (x: number) => x*x*x*(x*(x*6-15)+10)
function roll(seed: number, k: number) {
  let a = (seed ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0
  a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
/** Same authored tide as the accepted prototype; seed belongs to a saved exploration. */
export function lakeTideAt(seed: number, seconds: number) {
  const s = Math.max(0, seconds), starts = [660 + roll(seed, 1)*1200]
  if (roll(seed, 2) < 0.5) starts.push(2400 + roll(seed, 3)*300)
  for (let k=0; 3000+1200*k<=s; k++) if (roll(seed,10+2*k)<0.5) starts.push(3000+1200*k+roll(seed,11+2*k)*300)
  let level=0, phase='low', lastEnd=-1
  for (const start of starts) {
    const u=s-start
    if (u>0 && u<540) {
      const l=u<90 ? smooth(u/90) : u<450 ? 1 : 1-smooth((u-450)/90)
      if (l>level) { level=l; phase=u<90?'rising':u<450?'high':'falling' }
    }
    if (u>=540) lastEnd=Math.max(lastEnd,start+540)
  }
  return { level, phase, wet: level>0?1:lastEnd>=0?Math.max(0,1-(s-lastEnd)/240):0 }
}
export interface LakeAction { id: number; kind: 'walk'|'event'|'story'|'rest'|'lamp'|'wait'|'cuff'; node: string; route: string[]; eventId?: string; lamp?: number; startSeconds: number; endSeconds: number }
export interface LakeStoryPlan { opening: boolean; visitEvent: string|null; coreEvent: boolean; carriedItems: string[]; reservedSegments: number[]; eligibleAfter?:number }
export const lakeStoryEvents = scene.storyEvents
export const lakeClues = scene.clues
const stories = new Map(lakeStoryEvents.map(e=>[e.id,e]))
interface Intent { kind: LakeAction['kind']; node: string; eventId?: string; lamp?: number; duration: number; findId?: string; startAt?:number }
export interface LakeRuntime { version: 1; seed: number; seconds: number; node: string; sequence: number; action: LakeAction|null; intent: Intent|null; visitedLamps: number[]; handledFinds: string[]; usedEvents: string[]; lastSpot: string|null; completedAt: Record<string,number>; cuffedRise: boolean; steleWiped: boolean; steleWet: boolean; storyPlan?:LakeStoryPlan; startedStories?:string[]; storySegments?:number[]; notes: Array<{eventId:string;text:string;tags:string[];atSeconds:number}> }
export interface LakeSnapshot { areaId: typeof LAKE_AREA_ID; nodeId: string; effectiveSeconds: number; seed: number; action: LakeAction|null; worldMarks: LakeMarks; steleWiped: boolean; coreTaken: boolean; litLampCount: number; notes: LakeRuntime['notes'] }
export interface LakeFind { id:string; eventId:string; lampIndex:number }
export function createLakeRuntime(id:string,storyPlan?:LakeStoryPlan): LakeRuntime { return { version:1, seed:weatherSeedFrom(`${LAKE_AREA_ID}:${id}`), seconds:0,node:scene.ports.spawn,sequence:0,action:null,intent:null,visitedLamps:[],handledFinds:[],usedEvents:[],lastSpot:null,completedAt:{},cuffedRise:false,steleWiped:false,steleWet:false,storyPlan,startedStories:[],storySegments:[],notes:[] } }
type Event = {id:string;spot:string;name:string;anim:string;dur:number[];weight?:number;rare?:boolean;once?:boolean;tide?:string;time?:string[];requires?:string;note?:string;tagGain?:string[]}
export const lakeEvents: Event[] = scene.events.map(e => ({...e, dur: 'dur' in e ? e.dur! : e.tier === 'core' ? [80,110] : [35,60]})) as Event[]
const events = new Map(lakeEvents.map(e=>[e.id,e]))
const nodes = new Map(scene.nodes.map(n=>[n.id,n]))
const paths = new Map<string,{path:string[];seconds:number}>()
const visitSegments = new Map<string,number>()
export function lakeRoute(a:string,b:string) {
  const key=`${a}:${b}`, cached=paths.get(key)
  if (cached) return cached
  if (!nodes.has(a)||!nodes.has(b)) throw new Error('湖畔路點不存在。')
  const dist=new Map([[a,0]]), prev=new Map<string,string>(),todo=new Set(nodes.keys())
  while(todo.size) {
    const c=[...todo].filter(n=>dist.has(n)).sort((x,y)=>dist.get(x)!-dist.get(y)!)[0]
    if(!c) break
    todo.delete(c)
    for(const e of scene.edges) { const n=e.a===c?e.b:e.b===c?e.a:null
      if(!n||!todo.has(n)) continue
      const d=dist.get(c)!+Math.ceil(e.length/0.35)
      if(d<(dist.get(n)??Infinity)) {dist.set(n,d);prev.set(n,c)}
    }
  }
  if(!dist.has(b)) throw new Error('湖畔路線無法抵達。')
  const path=[b];while(path[0]!==a) path.unshift(prev.get(path[0])!)
  const result={path,seconds:dist.get(b)!}; paths.set(key,result);return result
}
function allowed(e:Event,s:LakeRuntime) {
  const tide=lakeTideAt(s.seed,s.seconds),tod=timeOfDayAt(s.seconds),time=tod.blend<0.5?tod.from:tod.to
  if(e.once&&s.usedEvents.includes(e.id))return false
  if(e.tide==='low'&&tide.level>0.08)return false
  if(e.tide==='high'&&tide.level<0.85)return false
  if(e.time&&!e.time.includes(time))return false
  if(e.requires==='flowersOpen'&&tide.level<0.85)return false
  if(e.requires==='shardPresent'&&s.usedEvents.includes('rare_mirror_shard'))return false
  if(e.requires==='egretA')return true // Design: call egret back, never use its position as eligibility.
  if(['sit','sitGaze','sitEdge','write','drinkSit'].includes(e.anim)) {const n=nodes.get(e.spot)!;if(tide.level*0.30>=n.y+(n.seat??0)-0.02)return false}
  return true
}
export function advanceLakeRuntime(saved:LakeRuntime,targetSeconds:number,savedMarks:LakeMarks,finds:readonly LakeFind[]) {
  const s=structuredClone(saved),marks={...savedMarks},target=Math.max(s.seconds,Math.floor(targetSeconds))
  s.startedStories??=[];s.storySegments??=[]
  const segmentKey=`${s.seed}:${s.storyPlan?.visitEvent}:${s.storyPlan?.eligibleAfter??0}`
  let visitSegment=visitSegments.get(segmentKey)??-1
  if(s.storyPlan?.visitEvent&&!visitSegments.has(segmentKey))for(let at=Math.max(660,s.storyPlan.eligibleAfter??0);at<3000;at++){
    const e=stories.get(s.storyPlan.visitEvent)!,segment=Math.floor(at/600),lamp=scene.lamps[segment]
    if(lamp&&at+e.dur[1]+lakeRoute(e.spot,lamp.node).seconds+12<(segment+1)*600&&lakeTideAt(s.seed,at).level>=0.9&&lakeTideAt(s.seed,at+e.dur[1]).level>=0.9){visitSegment=segment;break}
  }
  visitSegments.set(segmentKey,visitSegment)
  const rand=(salt:string)=>weatherSeedFrom(`${s.seed}:${s.sequence}:${s.seconds}:${salt}`)/4294967296
  const choose=<T extends {weight?:number}>(list:T[],salt:string):T|undefined=> {let v=rand(salt)*list.reduce((n,e)=>n+(e.weight??1),0);return list.find(e=>{v-=e.weight??1;return v<0})??list.at(-1)}
  const start=(kind:LakeAction['kind'],node:string,duration:number,eventId?:string,lamp?:number,route=[node])=>{s.action={id:++s.sequence,kind,node,route,eventId,lamp,startSeconds:s.seconds,endSeconds:s.seconds+Math.max(1,Math.ceil(duration))}}
  for(;s.seconds<=target;s.seconds++) {
    const tide=lakeTideAt(s.seed,s.seconds)
    if(tide.phase==='low')s.cuffedRise=false
    if(s.steleWiped&&tide.phase==='high')s.steleWet=true
    if(s.steleWet&&tide.phase==='low'){s.steleWiped=false;s.steleWet=false}
    if(s.action&&s.seconds>=s.action.endSeconds) {
      const a=s.action;s.node=a.node
      if(a.kind!=='walk'&&a.kind!=='wait') {
        if(a.kind==='lamp')s.visitedLamps.push(a.lamp!)
        if(a.eventId) {
          s.usedEvents.push(a.eventId);s.lastSpot=a.node;s.completedAt[a.eventId]=s.seconds
          const e=events.get(a.eventId)
          if(a.eventId==='story_open_gauge')marks.gaugeCarving=true
          if(e?.note&&!s.notes.some(n=>n.eventId===e.id))s.notes.push({eventId:e.id,text:e.note,tags:e.tagGain??[],atSeconds:s.seconds})
          if(a.eventId==='ev_pool_shell')marks.boatShells=Math.min(10,marks.boatShells+1)
          if(a.eventId==='ev_roots_cone')marks.pineCones=Math.min(6,marks.pineCones+1)
          if(a.eventId==='rest_cup_first')marks.cupLeft=true
          if(a.eventId==='ev_stele_wipe')s.steleWiped=true
        }
        if(s.intent?.findId)s.handledFinds.push(s.intent.findId)
        s.intent=null
      }
      s.action=null
    }
    if(s.action)continue
    const lamp=scene.lamps.find(l=>!s.visitedLamps.includes(l.index)), deadline=lamp?lamp.index*600:Infinity
    const fits=(node:string,dur:number)=>!lamp||s.seconds+lakeRoute(s.node,node).seconds+dur+lakeRoute(node,lamp.node).seconds+12<deadline
    const storyStart=(id:string):number|null=>{
      const e=stories.get(id)!;const arrival=s.seconds+lakeRoute(s.node,e.spot).seconds
      const check=(at:number)=>e.tide==='high'?lakeTideAt(s.seed,at).level>=0.9:e.tide==='low'?lakeTideAt(s.seed,at).level<=0.08:true
      for(let at=arrival;at<=arrival+(e.tide==='high'?180:0);at++){
        const end=at+e.dur[1],segment=Math.floor(at/600)
        if(end+lakeRoute(e.spot,lamp?.node??e.spot).seconds+12>=deadline||Math.floor(end/600)!==segment)continue
        if(id!=='story_open_gauge'&&(segment<1||s.storySegments!.includes(segment)))continue
        if(lakeEvents.some(e=>e.rare&&Math.floor((s.completedAt[e.id]??-600)/600)===segment))continue
        if(id!==s.storyPlan?.visitEvent&&s.storyPlan?.visitEvent&&!s.startedStories!.includes(s.storyPlan.visitEvent)&&segment===visitSegment)continue
        if(check(at)&&check(end))return at
      }
      return null
    }
    if(s.intent?.kind==='event'&&!s.intent.findId&&!allowed(events.get(s.intent.eventId!)!,s))s.intent=null
    if(!s.intent) {
      const plan=s.storyPlan
      if(plan?.opening&&!s.startedStories.includes('story_open_gauge')&&s.seconds<120&&storyStart('story_open_gauge')!==null){
        const e=stories.get('story_open_gauge')!;s.intent={kind:'story',node:e.spot,eventId:e.id,duration:e.dur[0]}
      }
      const find=finds.find(f=>!s.handledFinds.includes(f.id)&&f.lampIndex*600<=s.seconds)
      // Keep the first full-tide segment for the clue-selected visit story. Finds are already
      // saved at the lamp; their presentation can wait for a different segment.
      if(!s.intent&&find&&!s.storySegments.includes(Math.floor(s.seconds/600))&&(!plan?.visitEvent||s.startedStories.includes(plan.visitEvent)||Math.floor(s.seconds/600)!==visitSegment)) {const id=find.eventId==='rare_gauge_plate'&&tide.level>0.85?'rare_boat_plate':find.eventId,e=events.get(id)!
        if(e&&fits(e.spot,e.dur[1]))s.intent={kind:'event',node:e.spot,eventId:id,duration:e.dur[0]+rand('find')*(e.dur[1]-e.dur[0]),findId:find.id}}
      if(!s.intent&&lamp&&s.seconds>=deadline-lakeRoute(s.node,lamp.node).seconds-12)s.intent={kind:'lamp',node:lamp.node, lamp:lamp.index,duration:3}
      if(!s.intent&&plan&&lamp){
        const acquired=finds.filter(f=>f.lampIndex*600<=s.seconds).map(f=>f.eventId==='rare_boat_plate'?'rare_gauge_plate':f.eventId)
        const carried=new Set([...plan.carriedItems.filter(i=>!['tide_gauge_plate','silvered_shard'].includes(i)),...acquired])
        const carryDone=s.startedStories.some(id=>id.startsWith('carry_'))
        const ids=[plan.visitEvent,plan.coreEvent?'story_core_ring':null,
          ...(!carryDone?lakeStoryEvents.filter(e=>'carry'in e&&carried.has(e.carry!)).map(e=>e.id):[])]
        const id=ids.find(id=>id&&!s.startedStories!.includes(id)&&storyStart(id)!==null)
        if(id){const e=stories.get(id)!;s.intent={kind:'story',node:e.spot,eventId:id,duration:e.dur[0],startAt:storyStart(id)!}}
      }
      if(!s.intent&&tide.phase==='rising'&&!s.cuffedRise&&tide.level*0.3>nodes.get(s.node)!.y+0.005&&fits(s.node,2)){s.cuffedRise=true;s.intent={kind:'cuff',node:s.node,duration:2}}
      if(!s.intent&&lamp) {
        const candidates=lakeEvents.filter(e=>!e.rare&&(e.weight??0)>0&&allowed(e,s)&&fits(e.spot,e.dur[1]))
        const list=avoidRecentEventSpots(candidates,s.node,s.lastSpot).map(e=>({...e,weight:nearbyEventWeight(e.weight!,lakeRoute(s.node,e.spot).seconds*0.35,s.seconds,s.completedAt[e.id])}))
        const e=choose(list,'event');if(e)s.intent={kind:'event',node:e.spot,eventId:e.id,duration:e.dur[0]+rand('duration')*(e.dur[1]-e.dur[0])}
      }
      if(!s.intent&&!lamp) {const r=!marks.cupLeft?scene.restActivities[0]:choose(scene.restActivities.filter(r=>r.weight>0&&r.id!==s.usedEvents.at(-1)&&(!('requires'in r)||marks.cupLeft)&&(!('tide'in r)||tide.level>0.85)),'rest')??scene.restActivities[1]
        s.intent={kind:'rest',node:r.node,eventId:r.id,duration:r.dur[0]+rand('rest-duration')*(r.dur[1]-r.dur[0])}}
    }
    const i=s.intent
    if(!i){start('wait',s.node,1);continue}
    if(s.node!==i.node){const next=lakeRoute(s.node,i.node).path[1];start('walk',next,lakeRoute(s.node,next).seconds,i.eventId,undefined,[s.node,next])}
    else if(i.kind==='lamp'&&s.seconds<i.lamp!*600)start('wait',s.node,i.lamp!*600-s.seconds)
    else if(i.eventId==='story_open_gauge'&&s.seconds<15)start('wait',s.node,15-s.seconds)
    else if(i.kind==='story'&&i.startAt&&s.seconds<i.startAt)start('wait',s.node,i.startAt-s.seconds)
    else {
      if(i.kind==='story'){
        const e=stories.get(i.eventId!)!;s.startedStories.push(e.id);s.storySegments.push(Math.floor(s.seconds/600))
        const clue=lakeClues.find(c=>c.id===e.clue)!
        if(!s.notes.some(n=>n.eventId===e.id))s.notes.push({eventId:e.id,text:clue.text,tags:[],atSeconds:s.seconds})
      }
      start(i.kind,i.node,i.duration,i.eventId,i.lamp)
    }
  }
  s.seconds=target
  return {state:s,marks}
}
export function lakeSnapshot(nodeId:string,s:LakeRuntime,marks:LakeMarks,coreTaken:boolean):LakeSnapshot {return {areaId:LAKE_AREA_ID,nodeId,effectiveSeconds:s.seconds,seed:s.seed,action:s.action,worldMarks:{...marks,ringStill:!coreTaken},steleWiped:s.steleWiped,coreTaken,litLampCount:Math.min(5,Math.floor(s.seconds/600)),notes:s.notes}}
export function lakeDeparture(nodeId:string,exit:LakeExit) {if(!['a_arch','b_far'].includes(exit))throw new Error('未知湖畔出口。');return {fromExpeditionNodeId:nodeId,exit,durationMs:5000 as const}}
