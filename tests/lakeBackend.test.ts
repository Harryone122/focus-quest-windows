import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { advanceLakeRuntime, createLakeRuntime, emptyLakeMarks, lakeTideAt, lakeRoute, lakeEvents, lakeStoryEvents, type LakeRuntime, type LakeStoryPlan } from '../src/shared/area03'
import { LAKE_MAP_ID } from '../src/shared/specialFinds'
import { chooseRouteAreas } from '../src/shared/expedition'
let db:FocusQuestDatabase
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,9,3,9));db=new FocusQuestDatabase(':memory:')})
afterEach(()=>{db.close();vi.restoreAllMocks();vi.useRealTimers()})
const rows=(table:string)=>db.exportBackup().data[table] as Record<string,any>[]
function start(){const t=db.addListTask({title:'湖畔測試'}).taskList.nextTaskId!,s=db.startDailyRun(t),n=s.expeditionNodes[0],b=db.exportBackup();(b.data.expedition_nodes as Record<string,any>[]).find(r=>r.id===n.id)!.area_id=LAKE_MAP_ID;db.importBackup(b);db.selectExpeditionNode(s.todayRun!.id,n.id);return db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun!.id,nodeId:n.id,plannedMinutes:50})}
it('previews without committing sub-five-minute time, freezes on pause and resumes deterministic saved actions',()=>{
 const s=start(),id=s.activeSession!.nodeId!;vi.setSystemTime(Date.now()+120000)
 expect(db.getLakeScene(id)!.effectiveSeconds).toBe(120);expect(JSON.parse(rows('area_scene_states')[0].state_json).seconds).toBe(0)
 db.pauseFocus(s.activeSession!.id);const frozen=db.getLakeScene(id);vi.setSystemTime(Date.now()+120000);expect(db.getLakeScene(id)).toEqual(frozen)
 db.resumeFocus(s.activeSession!.id);vi.setSystemTime(Date.now()+480000);db.processActiveSpecialFinds();expect(db.getLakeScene(id)!.litLampCount).toBe(1)
 const backup=db.exportBackup(),scene=db.getLakeScene(id);db.importBackup(backup);expect(db.getLakeScene(id)).toEqual(scene)
})
it('uses map-specific automatic items and core once; keeps overtime from rerolling and survives backup',()=>{
 vi.spyOn(Math,'random').mockReturnValue(0);const s=start();vi.setSystemTime(Date.now()+3000000);db.processActiveSpecialFinds()
 expect(db.getSnapshot().mapCores).toEqual(expect.arrayContaining([expect.objectContaining({mapId:LAKE_MAP_ID,itemKey:'lake_mirror'})]))
 const found=db.getSnapshot().specialFinds.map(f=>f.itemKey);expect(found).toHaveLength(2);expect(found.some(i=>['tide_gauge_plate','silvered_shard'].includes(i))).toBe(true)
 const rolls=rows('forest_reward_rolls');vi.setSystemTime(Date.now()+600000);db.processActiveSpecialFinds();expect(rows('forest_reward_rolls')).toEqual(rolls)
 expect(db.getLakeScene(s.activeSession!.nodeId!)!.worldMarks.ringStill).toBe(false)
})
it('all authored events are reachable; five lamps and pending finds finish at real duration without renderer callbacks',()=>{
 const initial=createLakeRuntime('qa'),marks=emptyLakeMarks();lakeEvents.forEach(e=>expect(lakeRoute(initial.node,e.spot).seconds).toBeGreaterThanOrEqual(0))
 const finds=[{id:'j',eventId:'rare_gauge_plate',lampIndex:2},{id:'c',eventId:'rare_ring_mirror',lampIndex:5}]
 const full=advanceLakeRuntime(initial,3600,marks,finds);expect(full.state.visitedLamps).toEqual([1,2,3,4,5]);expect(full.state.handledFinds).toEqual(['j','c']);expect(full.marks.cupLeft).toBe(true)
 const half=advanceLakeRuntime(initial,1800,marks,finds),resumed=advanceLakeRuntime(half.state,3600,half.marks,finds);expect(resumed).toEqual(full)
 expect(full.marks.boatShells).toBeLessThanOrEqual(10);expect(full.marks.pineCones).toBeLessThanOrEqual(6)
})
it('every seed has a tide after the first lamp, uses identical paths at all tide heights',()=>{
 for(let i=0;i<50;i++){const s=createLakeRuntime(String(i));expect(lakeTideAt(s.seed,600).level).toBe(0);expect(Array.from({length:2400},(_,j)=>lakeTideAt(s.seed,600+j).level).some(l=>l===1)).toBe(true)}
})
it('offers the lake at a fresh campfire if the first two cores are already owned',()=>{
 const areas=chooseRouteAreas(7,0,null,{visitedAreaIds:[],ownedCoreAreaIds:['area-01-cloud-ruins','area-02-moss-station']})
 expect(areas.map(a=>a.areaId)).toContain(LAKE_MAP_ID)
})
const plan=(patch:Partial<LakeStoryPlan>={}):LakeStoryPlan=>({opening:false,visitEvent:'story_first_lag',coreEvent:false,carriedItems:[],reservedSegments:[],...patch})
it('first and second stories run at high tide, walk in, preserve all five lamps and resume identically across 50 seeds',()=>{
 for(let seed=0;seed<50;seed++)for(const id of ['story_first_lag','story_second_cup']){
  const initial=createLakeRuntime('story-'+seed,plan({visitEvent:id}));let state=initial,marks=emptyLakeMarks(),found=false
  const finds=[{id:'j',eventId:'rare_gauge_plate',lampIndex:2}]
  for(let seconds=0;seconds<=3000;seconds+=20){const next=advanceLakeRuntime(state,seconds,marks,finds);state=next.state;marks=next.marks
   if(state.action?.kind==='story'&&state.action.eventId===id){found=true;expect(lakeTideAt(state.seed,state.action.startSeconds).level).toBeGreaterThanOrEqual(.9);expect(lakeTideAt(state.seed,state.action.endSeconds).level).toBeGreaterThanOrEqual(.9)}
  }
  expect(found,`${seed}:${id}`).toBe(true);expect(state.visitedLamps).toEqual([1,2,3,4]);
  expect(advanceLakeRuntime(initial,3000,emptyLakeMarks(),finds)).toEqual({state,marks})
 }
},20000)
it('one carry event per exploration, own items require current acquisition; core story requires starting ownership',()=>{
 const run=(p:LakeStoryPlan,finds:any[]=[])=>advanceLakeRuntime(createLakeRuntime('carry',p),3000,emptyLakeMarks(),finds)
 const old=run(plan({visitEvent:null,carriedItems:['tide_gauge_plate','silvered_shard']}));expect(old.state.startedStories).toEqual([])
 const acquired=run(plan({visitEvent:null}),[{id:'item',eventId:'rare_mirror_shard',lampIndex:1}]);expect(acquired.state.startedStories).toContain('carry_silvered_shard')
 const many=run(plan({visitEvent:null,carriedItems:['old_wick','weathered_lens','old_luggage_tag']}));expect(many.state.startedStories!.filter(id=>id.startsWith('carry_'))).toHaveLength(1)
 expect(run(plan({visitEvent:null,coreEvent:true})).state.startedStories).toContain('story_core_ring')
 expect(run(plan({visitEvent:null}),[{id:'core',eventId:'rare_ring_mirror',lampIndex:1}]).state.startedStories).not.toContain('story_core_ring')
})
it('opening recap is retained even below five minutes; committed stories/notes survive interruption, backup and old runtime migration',()=>{
 const s=start(),id=s.activeSession!.nodeId!;vi.setSystemTime(Date.now()+20000);db.finishListFocus(s.activeSession!.id,false)
 expect(db.getSnapshot().collection.clues.some(c=>c.id==='m03_open')).toBe(true)
 const b=db.exportBackup();const r=(b.data.area_scene_states as any[])[0];const old=JSON.parse(r.state_json);delete old.storyPlan;old.seconds=650;r.state_json=JSON.stringify(old)
 ;(b.data.map_cores as any[]).push({map_id:LAKE_MAP_ID,item_key:'lake_mirror',acquired_at:new Date().toISOString()})
 db.importBackup(b);const migrated=db.getLakeScene(id)!;expect(migrated.effectiveSeconds).toBe(650);expect(migrated.seed).toBe(old.seed)
 expect(JSON.parse(rows('area_scene_states')[0].state_json).storyPlan.opening).toBe(false)
 expect(JSON.parse(rows('area_scene_states')[0].state_json).storyPlan.coreEvent).toBe(false)
})
it('every authored clue is registered for collection, acquisition and core understanding',()=>{
 const ids=new Set(db.getSnapshot().collection.clues.map(c=>c.id));expect(ids.size).toBe(0)
 expect(lakeStoryEvents).toHaveLength(9)
 vi.spyOn(Math,'random').mockReturnValue(0);const s=start();vi.setSystemTime(Date.now()+2700000);db.processActiveSpecialFinds()
 const state=db.getSnapshot();expect(state.collection.clues.map(c=>c.id)).toContain('n_plate');expect(state.collection.clues.map(c=>c.id)).toContain('m03_lag')
 const b=db.exportBackup();db.importBackup(b);expect(db.getSnapshot().collection.clues).toEqual(state.collection.clues)
})
it('saves a started story clue before animation completion and resumes that exact action after stopping',()=>{
 const s=start(),id=s.activeSession!.nodeId!,began=Date.now();let found=false
 for(let seconds=300;seconds<3000;seconds+=5){vi.setSystemTime(began+seconds*1000);db.processActiveSpecialFinds()
  const scene=db.getLakeScene(id)!
  if(scene.action?.kind==='story'&&scene.action.eventId==='story_first_lag'){
   found=true;expect(db.getSnapshot().collection.clues.map(c=>c.id)).toContain('m03_lag')
   db.pauseFocus(s.activeSession!.id);const frozen=db.getLakeScene(id);const backup=db.exportBackup();db.importBackup(backup);expect(db.getLakeScene(id)).toEqual(frozen)
   db.finishListFocus(s.activeSession!.id,false);expect(db.getLakeScene(id)).toEqual(frozen);break
  }
 }
 expect(found).toBe(true)
})
