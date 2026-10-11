import { afterEach, expect, it, vi } from 'vitest'
import { writeFileSync, readFileSync } from 'node:fs'
import { FocusQuestDatabase } from './src/main/database'
import { generateRoutes } from './src/shared/expedition'
import { cloudStorySchedule } from './src/shared/cloudStory'
import { FOREST_MAP_ID, MOSS_MAP_ID, LAKE_MAP_ID, NURSERY_MAP_ID } from './src/shared/specialFinds'
import { lobbyFromSnapshot } from './src/renderer/src/lobby/fromSnapshot'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
it('records the observed audit gaps using an isolated in-memory journey', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-11T09:00:00+08:00'))
  vi.spyOn(Math, 'random').mockReturnValue(0.01)
  const db = new FocusQuestDatabase(':memory:')
  try {
    let s = db.addListTask({ title: '隔離盤點，非玩家資料' })
    s = db.startDailyRun(s.taskList.nextTaskId!)
    let parent: string | null = null
    for (let segment = 0; segment < 5; segment++) {
      const n = s.expeditionNodes.find(n => n.parentNodeId === parent && n.state === 'available')!
      s = parent ? db.chooseNextRoute(s.todayRun!.id, parent, n.id) : db.selectExpeditionNode(s.todayRun!.id, n.id)
      s = db.startListFocus({ minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun!.id, nodeId: n.id, plannedMinutes: 50 })
      const id = s.activeSession!.id
      vi.setSystemTime(Date.now() + 3000000)
      db.finishListFocus(id, false)
      s = db.dismissDebrief(id)
      parent = n.id
    }
    const model = lobbyFromSnapshot(s)
    expect(s.expeditionNodes.filter(n => ['awaiting_route', 'cleared'].includes(n.state))).toHaveLength(5)
    expect(model.phase).toBe('choose_route')
    expect(model.routes).toHaveLength(2)
    expect(model.journey.segment).toBe(6)
    // Clue fixture tests the downstream route wiring, not story acquisition.
    for (const id of ['h1a','h1b','h1c']) (db as any).acquireCollectionClue(id)
    s = db.pinCollectionClues(['h1a','h1b','h1c'])
    expect(s.collection.hiddenPlaces.find(p => p.id === 'h1')?.revealed).toBe(true)
    const hiddenCandidate = generateRoutes(1, 2, 'fixture').some(r => String(r.areaId) === 'h1')
    expect(hiddenCandidate).toBe(false)
    const first = generateRoutes(1,0,null,{ visitedAreaIds:[], ownedCoreAreaIds:[FOREST_MAP_ID,MOSS_MAP_ID,LAKE_MAP_ID] })
    expect(first.every(r => r.areaId !== NURSERY_MAP_ID)).toBe(true)
    expect(first.every(r => [FOREST_MAP_ID,MOSS_MAP_ID,LAKE_MAP_ID].includes(r.areaId as any))).toBe(true)
    const retry = cloudStorySchedule({visit:3,opening:false,items:[],records:[]})
    expect(retry.some(e => e.evs.includes('well'))).toBe(false)
    const result = {
      date:'2026-10-11', method:'Vitest + :memory: SQLite, fake clock; no player save or UI used',
      afterFive:{phase:model.phase,displaySegment:model.journey.segment,total:model.journey.total,nextRoutes:model.routes.map(r=>r.mapId),completedJourneys:s.collection.completedJourneys},
      hidden:{h1Revealed:true,routeGeneratorAcceptsHiddenState:false,hiddenCandidate},
      firstRoute:{owned:[FOREST_MAP_ID,MOSS_MAP_ID,LAKE_MAP_ID],unowned:NURSERY_MAP_ID,offered:first.map(r=>r.areaId),note:'Nursery deliberately excluded from first segment; specification exception needed'},
      cloudRetry:{visit:3,records:[],scheduled:retry,note:'Missing well clue has no retry after exact visit 2; reachability depends on short-session route switching'},
    }
    writeFileSync('docs/audits/2026-10-11/verification.json',JSON.stringify(result,null,2)+'\n')
  } finally { db.close() }
})

it('reproduces the missing Cloud well clue with actual route selection and short-session switching', () => {
  vi.useFakeTimers({toFake:['Date']}); vi.setSystemTime(new Date('2026-10-11T09:00:00+08:00'))
  vi.spyOn(Math,'random').mockReturnValue(0.01)
  const db=new FocusQuestDatabase(':memory:')
  try {
    let s=db.addListTask({title:'隔離雲上補訪盤點'}); s=db.startDailyRun(s.taskList.nextTaskId!)
    let parent:string|null=null, interrupted=false, foundThird=false
    for(let step=0;step<40;step++){
      const candidates=s.expeditionNodes.filter(n=>n.parentNodeId===parent&&n.state==='available')
      const n=candidates.find(n=>n.areaId===FOREST_MAP_ID)??candidates[0]
      s=parent?db.chooseNextRoute(s.todayRun!.id,parent,n.id):db.selectExpeditionNode(s.todayRun!.id,n.id)
      s=db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun!.id,nodeId:n.id,plannedMinutes:50})
      if(s.cloudStory?.visit===2&&!interrupted){
        vi.setSystemTime(Date.now()+10000); const id=s.activeSession!.id
        db.finishListFocus(id,false);s=db.dismissDebrief(id)
        expect(s.expeditionNodes.find(e=>e.id===n.id)?.state).toBe('selected')
        const alternative=candidates.find(e=>e.id!==n.id)!
        s=db.selectExpeditionNode(s.todayRun!.id,alternative.id)
        s=db.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun!.id,nodeId:alternative.id,plannedMinutes:50})
        vi.setSystemTime(Date.now()+3000000);const altId=s.activeSession!.id
        db.finishListFocus(altId,false);s=db.dismissDebrief(altId);parent=alternative.id;interrupted=true;continue
      }
      if(s.cloudStory?.visit===3){
        expect(interrupted).toBe(true)
        expect(s.collection.clues.some(c=>c.id==='h1a')).toBe(false)
        expect(s.cloudStory.scheduledEvents.some(e=>e.evs.includes('well'))).toBe(false)
        const path='docs/audits/2026-10-11/verification.json',result=JSON.parse(readFileSync(path,'utf8'))
        result.cloudRetry={...result.cloudRetry,actualRouteReproduction:true,steps:step+1,interruptedSecondSeconds:10,thirdVisitCluePresent:false,thirdVisitWellScheduled:false}
        writeFileSync(path,JSON.stringify(result,null,2)+'\n');foundThird=true;break
      }
      vi.setSystemTime(Date.now()+3000000);const id=s.activeSession!.id
      db.finishListFocus(id,false);s=db.dismissDebrief(id);parent=n.id
    }
    expect(foundThird).toBe(true)
  }finally{db.close()}
})
