import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { generateRoutes } from '../src/shared/expedition'
import { FOREST_MAP_ID, MOSS_MAP_ID, LAKE_MAP_ID, NURSERY_MAP_ID } from '../src/shared/specialFinds'
import { lobbyFromSnapshot, departureFromSnapshot } from '../src/renderer/src/lobby/fromSnapshot'

let db: FocusQuestDatabase
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 27, 9)); db = new FocusQuestDatabase(':memory:') })
afterEach(() => { db.close(); vi.useRealTimers() })

it('offers two of four released maps at 50 minutes, with seeded ordering at both exits', () => {
  const mossExits = new Set()
  const offered = new Set()
  for (let seed = 0; seed < 60; seed++) {
    const routes = generateRoutes(seed, 2, 'parent')
    expect(routes).toEqual(generateRoutes(seed, 2, 'parent'))
    expect(new Set(routes.map(route => route.areaId)).size).toBe(2)
    routes.forEach(route=>offered.add(route.areaId))
    expect(routes.every(route => route.plannedMinutes === 50)).toBe(true)
    const moss=routes.find(route => route.areaId === MOSS_MAP_ID)
    if(moss){expect(moss.title).toBe('苔痕驛站');mossExits.add(moss.departureExitId)}
  }
  expect(mossExits).toEqual(new Set(['exit_high', 'exit_pines']))
  expect(offered).toEqual(new Set([FOREST_MAP_ID,MOSS_MAP_ID,LAKE_MAP_ID,NURSERY_MAP_ID]))
})

it('persists real map choices, both departure directions and visits without replacing the forest', () => {
  let s = db.addListTask({ title: '跨圖驗收' })
  s = db.startDailyRun(s.taskList.nextTaskId!)
  let previous: string | null = null
  for (const area of [FOREST_MAP_ID, MOSS_MAP_ID, LAKE_MAP_ID]) {
    let next = s.expeditionNodes.find(node => node.parentNodeId === previous && node.areaId === area)
    // Four released maps now give three unvisited candidates after the forest;
    // this persistence fixture deliberately chooses its three-map itinerary.
    if (!next) {
      const backup=db.exportBackup()
      const row=(backup.data.expedition_nodes as Array<Record<string,unknown>>).find(row=>row.parent_node_id===previous&&row.state==='available')!
      row.area_id=area;row.title=area===LAKE_MAP_ID?'倒影湖畔':area===MOSS_MAP_ID?'苔痕驛站':'雲上遺庭'
      db.importBackup(backup);s=db.getSnapshot();next=s.expeditionNodes.find(node=>node.id===row.id)!
    }
    s = previous ? db.chooseNextRoute(s.todayRun!.id, previous, next.id) : db.selectExpeditionNode(s.todayRun!.id, next.id)
    expect(departureFromSnapshot(s, null)?.mapTitle).toBe(area === LAKE_MAP_ID ? '倒影湖畔' : area === MOSS_MAP_ID ? '苔痕驛站' : '雲上遺庭')
    const saved = db.exportBackup(); db.importBackup(saved)
    expect(db.getSnapshot().expeditionNodes).toEqual(s.expeditionNodes)
    s = db.startListFocus({ minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun!.id, nodeId: next.id, plannedMinutes: 50 })
    const session = s.activeSession!.id
    if (previous) expect((s.activeSession!.departure ?? db.getMossDeparture(session) ?? db.getLakeDeparture(session))?.durationMs).toBe(5000)
    expect(lobbyFromSnapshot(s).map.sceneKey).toBe(area)
    vi.setSystemTime(Date.now() + 3000000)
    db.finishListFocus(session, false); s = db.dismissDebrief(session)
    const model = lobbyFromSnapshot(s)
    expect(model.map.sceneKey).toBe(area)
    expect(new Set(model.routes.map(route => route.mapId)).size).toBe(2)
    expect(model.routes.map(route => route.exit).sort()).toEqual(area === LAKE_MAP_ID ? ['a_arch','b_far'] : area === MOSS_MAP_ID ? ['exit_boat', 'exit_tunnel'] : ['exit_high', 'exit_pines'])
    previous = next.id
  }
  expect(s.mapVisits).toEqual(expect.arrayContaining([{ mapId: FOREST_MAP_ID, completed: 1 }, { mapId: MOSS_MAP_ID, completed: 1 }, {mapId:LAKE_MAP_ID,completed:1}]))
})
