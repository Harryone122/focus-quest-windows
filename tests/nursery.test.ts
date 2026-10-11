import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {FocusQuestDatabase} from '../src/main/database'
import {advanceNurseryRuntime,createNurseryRuntime,emptyNurseryMarks,NURSERY_AREA_ID,nurseryFog,nurseryRoute} from '../src/shared/area07'
import {generateRoutes} from '../src/shared/expedition'
import {specialFindsForMap} from '../src/shared/specialFinds'
let db:FocusQuestDatabase
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,9,5,9));db=new FocusQuestDatabase(':memory:')})
afterEach(()=>{db.close();vi.useRealTimers()})
const sql=()=> (db as any).db
function prepare(area=NURSERY_AREA_ID as string){let s=db.addListTask({title:'苗圃驗收'});s=db.startDailyRun(s.taskList.nextTaskId!);const n=s.expeditionNodes[0];sql().prepare('UPDATE expedition_nodes SET area_id=?,title=? WHERE id=?').run(area,area===NURSERY_AREA_ID?'玻璃苗圃':'苔痕驛站',n.id);s=db.selectExpeditionNode(s.todayRun!.id,n.id);return {s,node:n.id}}
function full(node:string){const s=db.getSnapshot();const start=db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun!.id,nodeId:node,plannedMinutes:50});vi.setSystemTime(Date.now()+3000000);db.finishListFocus(start.activeSession!.id,false);return db.dismissDebrief(start.activeSession!.id)}
function forceNextNursery(parent:string){const s=db.getSnapshot(),n=s.expeditionNodes.find(n=>n.parentNodeId===parent)!;sql().prepare('UPDATE expedition_nodes SET area_id=?,title=? WHERE id=?').run(NURSERY_AREA_ID,'玻璃苗圃',n.id);db.chooseNextRoute(s.todayRun!.id,parent,n.id);return n.id}
it('uses only the approved ground path to SP and never offers nursery at the campfire',()=>{
 expect(nurseryRoute('MT','SP').path).toContain('P2');expect(nurseryRoute('G','SP').path.slice(-2)).toEqual(['P2','SP'])
 for(let seed=0;seed<100;seed++)expect(generateRoutes(seed,0,null,{visitedAreaIds:[],ownedCoreAreaIds:[]}).map(r=>r.areaId)).not.toContain(NURSERY_AREA_ID)
 expect(specialFindsForMap(NURSERY_AREA_ID).map(f=>f.itemKey).sort()).toEqual(['mulch_cloth','pressed_leaf','sealed_seed_pod'])
})
it('restores deterministic stories, fog, world memory and all five lamp deadlines across 40 seeds',()=>{
 for(let i=0;i<40;i++){
  const initial=createNurseryRuntime('nursery'+i,['story_first_tray','carry_silvered_shard','carry_sapling']),world={...emptyNurseryMarks(),saplingInLuggage:true}
  const finds=[{id:'item',eventId:'find_mulch_cloth',lampIndex:2},{id:'core',eventId:'find_core',lampIndex:4}]
  let state=initial,marks=world
  for(let time=0;time<=3010;time+=10){({state,marks}=advanceNurseryRuntime(state,time,marks,finds));const a=state.action
    if(a?.kind==='story'||a?.kind==='ambient')expect(a.endSeconds+nurseryRoute(a.node,['A','E','L2','L3','D'][Math.floor(a.startSeconds/600)]??a.node).seconds).toBeLessThan((Math.floor(a.startSeconds/600)+1)*600)
  }
  expect(state.visitedLamps).toEqual([1,2,3,4,5]);expect(state.startedStories).toEqual(expect.arrayContaining(initial.stories));expect(state.handledFinds).toEqual(['item','core']);expect(marks.saplingStage).toBe(0);expect(marks.saplingInLuggage).toBe(false)
  expect(advanceNurseryRuntime(initial,3010,world,finds)).toEqual({state,marks});expect(nurseryFog(state.seed,480)).toBe(nurseryFog(state.seed,480))
 }
},20000)
it('saves the carried sapling across journeys and backup, consumes it once when planting',()=>{
 const {s,node}=prepare('area-02-moss-station');full(node)
 const state=JSON.parse(sql().prepare('SELECT state_json FROM area_scene_states WHERE node_id=?').get(node).state_json);state.saplingWrapped=true;sql().prepare('UPDATE area_scene_states SET state_json=? WHERE node_id=?').run(JSON.stringify(state),node)
 expect(db.getSnapshot().caretaker?.takeNodeId).toBe(node);db.chooseCaretaker(node,'take');expect(()=>db.chooseCaretaker(node,'take')).toThrow()
 sql().prepare("UPDATE daily_runs SET status='ended',ended_at=? WHERE id=?").run(new Date().toISOString(),s.todayRun!.id);const backup=db.exportBackup();db.importBackup(backup);expect(db.getSnapshot().caretaker?.saplingInLuggage).toBe(true)
 let next=db.startDailyRun(db.getSnapshot().taskList.nextTaskId!);const n=next.expeditionNodes.find(n=>n.runId===next.todayRun!.id)!;sql().prepare('UPDATE expedition_nodes SET area_id=? WHERE id=?').run(NURSERY_AREA_ID,n.id);db.selectExpeditionNode(next.todayRun!.id,n.id)
 next=db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:next.todayRun!.id,nodeId:n.id,plannedMinutes:50});expect(()=>db.chooseCaretaker(n.id,'transplant')).toThrow()
 const session=next.activeSession!.id;vi.setSystemTime(Date.now()+10000);db.finishListFocus(session,false);db.dismissDebrief(session);expect(db.getSnapshot().caretaker?.saplingInLuggage).toBe(true)
 full(n.id);expect(db.getSnapshot().caretaker?.saplingInLuggage).toBe(false);expect(db.getSnapshot().collection.clues.map(c=>c.id)).toContain('m07_planted')
})
it('grows once per later visit, defers until the next visit and saves transplant before playback without ending the journey',()=>{
 const {node}=prepare();sql().prepare('INSERT INTO map_world_state (map_id,state_json) VALUES (?,?)').run(NURSERY_AREA_ID,JSON.stringify({...emptyNurseryMarks(),saplingPlanted:true,saplingStage:0}))
 full(node);expect(db.getNurseryScene(node)?.worldMarks.saplingStage).toBe(1);db.getSnapshot();db.getNurseryScene(node);expect(db.getNurseryScene(node)?.worldMarks.saplingStage).toBe(1)
 const second=forceNextNursery(node);full(second);expect(db.getSnapshot().caretaker?.transplantNodeId).toBe(second)
 db.chooseCaretaker(second,'wait');expect(db.getSnapshot().caretaker?.transplantNodeId).toBeNull();db.importBackup(db.exportBackup());expect(db.getSnapshot().caretaker?.transplantNodeId).toBeNull()
 const third=forceNextNursery(second);full(third);expect(db.getSnapshot().caretaker?.transplantNodeId).toBe(third)
 const before=db.getSnapshot().todayRun!;const after=db.chooseCaretaker(third,'transplant');expect(after.todayRun?.id).toBe(before.id);expect(after.todayRun?.status).toBe('active');expect(after.collection.clues.map(c=>c.id)).toContain('m07_transplant');expect(db.getNurseryScene(third)?.worldMarks.saplingTransplanted).toBe(true)
 expect(()=>db.chooseCaretaker(third,'transplant')).toThrow();db.importBackup(db.exportBackup());expect(db.getNurseryScene(third)?.worldMarks.saplingTransplanted).toBe(true)
 const routes=after.expeditionNodes.filter(n=>n.parentNodeId===third);expect(routes.map(n=>n.nurseryExitId).sort()).toEqual(['exit_cellar','exit_corridor'])
 const exit=routes[0];db.chooseNextRoute(before.id,third,exit.id);const start=db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:before.id,nodeId:exit.id,plannedMinutes:50});expect(db.getNurseryDeparture(start.activeSession!.id)?.durationMs).toBe(8000)
})
