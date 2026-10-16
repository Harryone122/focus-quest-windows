import scene from '../../docs/area07/area-07-glass-nursery.scene.json'
import { weatherSeedFrom } from './weather'

export const NURSERY_AREA_ID = 'area-07-glass-nursery' as const
export type NurseryExit = 'exit_corridor' | 'exit_cellar'
export interface NurseryMarks {
  potUpright: boolean; glassWiped: boolean; shardPile: boolean
  saplingInLuggage: boolean; saplingPlanted: boolean; saplingStage: number; saplingTransplanted: boolean
}
export const emptyNurseryMarks = (): NurseryMarks => ({potUpright:false,glassWiped:false,shardPile:false,
  saplingInLuggage:false,saplingPlanted:false,saplingStage:-1,saplingTransplanted:false})
export interface NurseryAction { id:number; kind:'walk'|'story'|'ambient'|'lamp'|'wait'|'rest'; node:string; fromNode?:string; route:string[]; eventId?:string; lamp?:number; startSeconds:number; endSeconds:number }
export interface NurseryRuntime {
  version:1; seed:number; seconds:number; node:string; sequence:number; action:NurseryAction|null
  stories:string[]; startedStories:string[]; handledFinds:string[]; visitedLamps:number[]; lastEvent:string|null
  takeOffered:boolean; transplantOffered:boolean; transplantAccepted:boolean; storySegments:number[]
}
export interface NurserySnapshot { areaId:typeof NURSERY_AREA_ID; nodeId:string; seed:number; effectiveSeconds:number; action:NurseryAction|null; worldMarks:NurseryMarks; coreTaken:boolean }
export function nurseryFog(seed:number, seconds:number):boolean {
  return weatherSeedFrom(`${seed}:fog:${Math.max(0,Math.floor(seconds/600))}`)/4294967296 < 0.5
}
const nodes = scene.nodes as Record<string,number[]>
const routeCache = new Map<string,{path:string[];seconds:number}>()
export function nurseryRoute(a:string,b:string):{path:string[];seconds:number} {
  const cached=routeCache.get(`${a}:${b}`);if(cached)return cached
  if(!nodes[a]||!nodes[b])throw new Error('苗圃路點不存在。')
  const dist=new Map([[a,0]]),prev=new Map<string,string>(),todo=new Set(Object.keys(nodes))
  while(todo.size){const u=[...todo].filter(n=>dist.has(n)).sort((x,y)=>dist.get(x)!-dist.get(y)!)[0];if(!u)break;todo.delete(u)
    for(const [x,y] of scene.edges){const v=x===u?y:y===u?x:null;if(!v||!todo.has(v))continue
      const d=dist.get(u)!+Math.hypot(...nodes[u].map((n,i)=>n-nodes[v][i]))/2
      if(d<(dist.get(v)??Infinity)){dist.set(v,d);prev.set(v,u)}}}
  if(!dist.has(b))throw new Error('苗圃路線無法抵達。')
  const path=[b];while(path[0]!==a)path.unshift(prev.get(path[0])!)
  const result={path,seconds:Math.ceil(dist.get(b)!)};routeCache.set(`${a}:${b}`,result);return result
}
export function createNurseryRuntime(id:string,stories:string[]):NurseryRuntime {
  return {version:1,seed:weatherSeedFrom(`${NURSERY_AREA_ID}:${id}`),seconds:0,node:scene.spawn,sequence:0,action:null,
    stories,startedStories:[],handledFinds:[],visitedLamps:[],lastEvent:null,takeOffered:false,transplantOffered:false,transplantAccepted:false,storySegments:[]}
}
export const nurseryClues = scene.clues
export const nurseryStoryKeys:Record<string,string> = {story_first_tray:'first',story_second_chart:'chart',carry_silvered_shard:'shard',carry_sapling:'plant',find_pressed_leaf:'leaf',find_mulch_cloth:'mulch',find_core:'core',caretaker_transplant:'transplant'}
const events = scene.storyEvents.filter(e=>e.id!=='caretaker_transplant').map(e=>({id:e.id,node:e.standNode!,sec:e.sec!,kind:'story' as const}))
export function advanceNurseryRuntime(saved:NurseryRuntime, target:number, world:NurseryMarks, finds:readonly {id:string;eventId:string;lampIndex:number}[],onEvent?:(state:NurseryRuntime,marks:NurseryMarks)=>void) {
  const s=structuredClone(saved),marks={...world},end=Math.max(s.seconds,Math.floor(target))
  // Retire a removed pose in old saves without changing its saved focus time.
  if(s.action?.kind==='ambient'&&s.action.eventId==='stairSit'){s.action.kind='wait';delete s.action.eventId}
  const start=(kind:NurseryAction['kind'],node:string,sec:number,eventId?:string,lamp?:number,route=[node])=>{s.action={id:++s.sequence,kind,node,route,eventId,lamp,startSeconds:s.seconds,endSeconds:s.seconds+Math.max(1,Math.ceil(sec))}}
  for(;s.seconds<=end;s.seconds++){
    // A wiped window becomes covered by the next seeded heavy night.
    if(s.seconds%600===450&&nurseryFog(s.seed,s.seconds))marks.glassWiped=false
    if(s.action&&s.seconds>=s.action.endSeconds){const a=s.action;s.node=a.node
      if(a.kind==='lamp')s.visitedLamps.push(a.lamp!)
      if(a.kind==='ambient'){s.lastEvent=a.eventId!;if(a.eventId==='potRight')marks.potUpright=true;if(a.eventId==='wipe')marks.glassWiped=true}
      s.action=null
      if(a.kind==='walk'&&a.eventId&&a.eventId in scene.ambient){const e=(scene.ambient as Record<string,{durSec:number}>)[a.eventId];start('ambient',a.node,e.durSec+20,a.eventId)}
    }
    if(s.action)continue
    const lamp=scene.lamps.find(l=>!s.visitedLamps.includes(l.index)),deadline=lamp?lamp.index*600:Infinity
    const fits=(node:string,sec:number)=>s.seconds+nurseryRoute(s.node,node).seconds+sec+nurseryRoute(node,lamp?.standNode??node).seconds+8<deadline
    const find=finds.find(f=>f.lampIndex*600<=s.seconds&&!s.handledFinds.includes(f.id))
    const segment=Math.floor(s.seconds/600)
    const story=events.find(e=>s.stories.includes(e.id)&&!s.startedStories.includes(e.id))
    let event: {id:string;node:string;sec:number;kind:'story'|'ambient'}|undefined
    if(find&&!s.storySegments.includes(segment)){
      const f=scene.specialFinds.find(e=>e.id===find.eventId)
      if(f){const n='standNode'in f?f.standNode!:'B';const sec=f.tier==='core'?14+nurseryRoute('B','K').seconds:f.sec!
        if(fits(n,sec))event={id:f.id,node:n,sec,kind:'story'}}
    }
    if(!event&&story&&!s.storySegments.includes(segment)&&s.seconds>=30&&fits(story.node,story.sec))event=story
    if(event){
      if(s.node!==event.node){const r=nurseryRoute(s.node,event.node);start('walk',event.node,r.seconds,event.id,undefined,r.path);continue}
      const beforeMarks={...marks}
      s.storySegments.push(segment)
      if(find?.eventId===event.id)s.handledFinds.push(find.id)
      else {s.startedStories.push(event.id);if(event.id==='carry_sapling'){marks.saplingInLuggage=false;marks.saplingPlanted=true;marks.saplingStage=0}}
      start('story',event.id==='find_core'?'K':event.node,event.sec,event.id);if(event.id==='find_core')s.action!.fromNode='B';onEvent?.(s,beforeMarks);continue
    }
    if(!lamp){start('rest','H',60);s.action!.fromNode=s.node;continue}
    const remaining=nurseryRoute(s.node,lamp.standNode)
    if(s.seconds>=deadline-remaining.seconds-8){
      if(s.node!==lamp.standNode)start('walk',lamp.standNode,remaining.seconds,undefined,undefined,remaining.path)
      else if(s.seconds<deadline)start('wait',s.node,deadline-s.seconds)
      else start('lamp',s.node,2.2,undefined,lamp.index)
      continue
    }
    const amb=Object.entries(scene.ambient).filter(([id,e])=>nodes[e.node]&&id!=='lean'&&id!==s.lastEvent&&!(id==='potRight'&&marks.potUpright)&&fits(e.node,e.durSec+20))
    const picked=amb[weatherSeedFrom(`${s.seed}:${s.sequence}`)%Math.max(1,amb.length)]
    if(!picked){start('wait',s.node,Math.max(1,deadline-remaining.seconds-8-s.seconds));continue}
    const [id,e]=picked
    if(s.node!==e.node){const r=nurseryRoute(s.node,e.node);start('walk',e.node,r.seconds,id,undefined,r.path)}
    else start('ambient',e.node,e.durSec+20,id)
  }
  s.seconds=end;return {state:s,marks}
}
