import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { afterFocusFromSnapshot, departureFromSnapshot, lobbyFromSnapshot } from '../src/renderer/src/lobby/fromSnapshot'
import type { AppSnapshot } from '../src/shared/types'

let db: FocusQuestDatabase
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 27, 9)); db = new FocusQuestDatabase(':memory:') })
afterEach(() => { db.close(); vi.restoreAllMocks(); vi.useRealTimers() })
const advance = (seconds: number): void => { vi.setSystemTime(Date.now() + seconds * 1000) }
function prepare(minutes: number = 50): AppSnapshot {
  const s = db.addListTask({ title: '寫筆記' })
  const run = db.startDailyRun(s.taskList.nextTaskId!)
  const node = run.expeditionNodes.find(node => node.areaId === 'area-01-cloud-ruins')!
  if (minutes !== 50) {
    const backup = db.exportBackup()
    ;(backup.data.expedition_nodes as Array<Record<string, unknown>>).find(entry => entry.id === node.id)!.planned_minutes = minutes
    db.importBackup(backup)
  }
  return db.selectExpeditionNode(run.todayRun!.id, node.id)
}
function start(s: AppSnapshot): string {
  const node = s.expeditionNodes.find((entry) => entry.id === s.todayRun?.selectedNodeId)!
  return db.startListFocus({ minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun!.id, nodeId: node.id, plannedMinutes: node.plannedMinutes }).activeSession!.id
}

describe('real lobby projections and saved handoff', () => {
  it('empty profile uses no fabricated journey, discoveries or task; routes never start a timer', () => {
    const empty = lobbyFromSnapshot(db.getSnapshot())
    expect(empty.routes).toEqual([])
    expect(empty.newFinds).toEqual([])
    expect(empty.tasks.currentTaskId).toBeNull()
    const selected = prepare()
    expect(selected.activeSession).toBeNull()
    expect(lobbyFromSnapshot(selected).routes).toHaveLength(2)
    expect(departureFromSnapshot(selected, null)?.targetSeconds).toBe(3000)
    expect(lobbyFromSnapshot(selected).routes.map((route) => route.exit)).toEqual(['exit_bridge', 'exit_steps'])
  })

  it('uses actual legacy duration and defaults to the backend ordered item', () => {
    const s = prepare(25)
    const second = db.addListTask({ title: '讀書' }).taskList.today[1].id
    const model = departureFromSnapshot(db.getSnapshot(), second)!
    expect(model.targetSeconds).toBe(1500)
    expect(model.task.id).toBe(second)
    expect(lobbyFromSnapshot(db.getSnapshot(), 'missing').tasks.currentTaskId).toBe(s.taskList.nextTaskId)
  })

  it('partial and too-short reviews preserve saved progress and correct lamp delta', () => {
    let s = prepare(), id = start(s)
    advance(600)
    s = db.beginSessionDebrief(id)
    expect(afterFocusFromSnapshot(s)).toMatchObject({ step: 'task', resolution: 'partial', map: { exploredSeconds: 600, litBefore: 0 } })
    expect(() => db.dismissDebrief(id)).toThrow(/回顧/)
    s = db.finishListFocus(id, false)
    expect(afterFocusFromSnapshot(s)?.step).toBe('review')
    s = db.dismissDebrief(id)
    expect(lobbyFromSnapshot(s)).toMatchObject({ phase: 'exploring', routes: [] })
    expect(departureFromSnapshot(s, null)?.mode).toBe('continue')
    id = start(s); advance(30)
    s = db.beginSessionDebrief(id)
    expect(afterFocusFromSnapshot(s)).toMatchObject({ resolution: 'too_short', map: { exploredSeconds: 600, litBefore: 1 } })
  })

  it('full review returns to rest before route selection; reload and reselection preserve parent and exits', () => {
    let s = prepare(), id = start(s)
    advance(3000)
    s = db.finishListFocus(id, false)
    const beforeRewards = s.specialFinds
    s = db.dismissDebrief(id)
    expect(s.pendingDebrief).toBeNull()
    expect(s.specialFinds).toEqual(beforeRewards)
    let lobby = lobbyFromSnapshot(s)
    expect(lobby.phase).toBe('choose_route')
    expect(new Set(lobby.routes.map((route) => route.exit))).toEqual(new Set(['exit_high', 'exit_pines']))
    const parentId = s.todayRun!.selectedNodeId!
    s = db.chooseNextRoute(s.todayRun!.id, parentId, lobby.routes[0].id)
    lobby = lobbyFromSnapshot(s)
    expect(lobby.map.exploredSeconds).toBe(3000)
    expect(lobby.routes).toHaveLength(2)
    expect(s.activeSession).toBeNull()
    s = db.selectExpeditionNode(s.todayRun!.id, lobby.routes[1].id)
    const saved = db.exportBackup(); db.importBackup(saved)
    expect(lobbyFromSnapshot(db.getSnapshot())).toEqual(lobbyFromSnapshot(s))
    const next = start(s)
    expect(db.getSnapshot().activeSession?.departure?.exit).toBe('exit_pines')
    expect(next).not.toBe(id)
  })

  it('legacy reward can wait in lobby and is never auto-chosen', () => {
    let s = prepare(25), id = start(s)
    advance(1500)
    s = db.finishListFocus(id, false)
    // Fixture for a pre-forest-auto-award save, not a newly generated map.
    const legacy = db.exportBackup()
    const row = (legacy.data.expedition_nodes as Array<Record<string, unknown>>).find((entry) => entry.id === s.todayRun!.selectedNodeId)!
    row.state = 'awaiting_reward'; row.selected_relic_key = null
    row.reward_options = JSON.stringify(['broken_compass', 'old_oil_lamp'])
    db.importBackup(legacy)
    s = db.dismissDebrief(id)
    const model = lobbyFromSnapshot(s), event = model.pendingEvents[0]
    expect(model.routes).toEqual([])
    expect(event.options).toHaveLength(2)
    const nodeId = s.todayRun!.selectedNodeId!
    expect(() => db.chooseNextRoute(s.todayRun!.id, nodeId, s.expeditionNodes.find((node) => node.parentNodeId === nodeId)!.id)).toThrow(/物件/)
    s = db.chooseRunRelic(s.todayRun!.id, event.id, event.options[0].id)
    expect(lobbyFromSnapshot(s).pendingEvents).toEqual([])
    expect(lobbyFromSnapshot(s).routes).toHaveLength(2)
  })

  it('discovery reads persist and v8 round-trips without mutating ownership; v7 remains importable', () => {
    const s = prepare(), id = start(s)
    advance(3000)
    const ended = db.finishListFocus(id, false), find = ended.specialFinds[0]
    expect(find).toBeDefined()
    const seen = db.inspectLobbyFind(find.id)
    expect(lobbyFromSnapshot(seen).newFinds.some((entry) => entry.key === find.id)).toBe(false)
    expect(seen.specialFinds).toEqual(ended.specialFinds)
    expect(seen.mapCores).toEqual(ended.mapCores)
    expect(db.inspectLobbyFind(find.id).seenFindIds).toEqual([find.id])
    expect(() => db.inspectLobbyFind('missing')).toThrow(/找不到/)
    const backup = db.exportBackup(); db.importBackup(backup)
    expect(db.getSnapshot().seenFindIds).toEqual([find.id])
    backup.version = 7; delete backup.data.lobby_find_reads
    db.importBackup(backup)
    expect(db.getSnapshot().seenFindIds).toEqual([])
  })
})
