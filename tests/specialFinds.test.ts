import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { FocusQuestDatabase } from '../src/main/database'
import { AREA01_SPECIAL_FINDS, dueLampCount, FOREST_MAP_ID } from '../src/shared/specialFinds'
import type { AppSnapshot } from '../src/shared/types'

type Row = Record<string, any>
const directories: string[] = []
const opened = new Set<FocusQuestDatabase>()
let now: number
beforeEach(() => { vi.useFakeTimers(); now = Date.parse('2026-09-26T04:00:00Z'); vi.setSystemTime(now) })
afterEach(() => {
  for (const db of opened) db.close()
  opened.clear()
  vi.useRealTimers(); vi.restoreAllMocks()
  for (const dir of directories.splice(0)) {
    const rel = relative(realpathSync(tmpdir()), realpathSync(dir))
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unsafe cleanup')
    rmSync(dir, { recursive: true, force: true })
  }
})
function advance(seconds: number) { now += seconds * 1000; vi.setSystemTime(now) }
function database(path?: string) {
  if (!path) { const dir = mkdtempSync(join(tmpdir(), 'focus-quest-forest-')); directories.push(dir); path = join(dir, 'test.db') }
  const db = new FocusQuestDatabase(path); opened.add(db); return { db, path }
}
function close(db: FocusQuestDatabase) { db.close(); opened.delete(db) }
function startArea(db: FocusQuestDatabase) {
  let snapshot = db.getSnapshot()
  if (!snapshot.todayRun) {
    const task = db.createTask({ title: 'forest test', role: 'main', kind: 'creative', progressDefinition: 'work',
      starterAction: null, obstacle: 'too_big', deadline: null, startCue: { type: 'manual', value: '' } }).tasks[0]
    snapshot = db.startDailyRun(task.id)
  }
  let node = snapshot.expeditionNodes.find(n => n.id === snapshot.todayRun!.selectedNodeId)
  if (!node) {
    node = snapshot.expeditionNodes.find(n => n.areaId === FOREST_MAP_ID)!
    snapshot = db.selectExpeditionNode(snapshot.todayRun!.id, node.id)
  }
  const task = snapshot.tasks.find(t => t.id === snapshot.todayRun!.mainTaskId)!
  return db.startFocus({ taskId: task.id, stepId: task.steps[0].id, minimumMinutes: 5, blockedProcessNames: [],
    runId: snapshot.todayRun!.id, nodeId: node.id, plannedMinutes: node.plannedMinutes })
}
function rows(db: FocusQuestDatabase, table: string): Row[] { return db.exportBackup().data[table] as Row[] }
function finish(db: FocusQuestDatabase) {
  const id = db.getSnapshot().activeSession!.id
  db.beginSessionDebrief(id); db.endFocus({ sessionId: id, outcome: 'progress', completeTask: false })
  return db.getSnapshot()
}
function next(db: FocusQuestDatabase, snapshot: AppSnapshot) {
  const from = snapshot.pendingDebrief!.nodeId
  const candidate = snapshot.expeditionNodes.find(n => n.parentNodeId === from && n.areaId === FOREST_MAP_ID)
    ?? snapshot.expeditionNodes.find(n => n.parentNodeId === from)!
  // Route generation belongs to the lobby task. This fixture explicitly visits the 50-minute forest repeatedly.
  if (candidate.plannedMinutes !== 50 || candidate.areaId !== FOREST_MAP_ID) {
    const backup = db.exportBackup()
    ;(backup.data.expedition_nodes as Row[]).find(n => n.id === candidate.id)!.planned_minutes = 50
    ;(backup.data.expedition_nodes as Row[]).find(n => n.id === candidate.id)!.area_id = FOREST_MAP_ID
    db.importBackup(backup)
  }
  db.chooseNextRoute(snapshot.todayRun!.id, from, candidate.id)
  return startArea(db)
}

describe('forest persisted rewards and world memory', () => {
  it('saves the first tree clue from the effective clock, even when its animation is unavailable', () => {
    const { db, path } = database()
    const started = startArea(db)
    const sessionId = started.activeSession!.id
    expect(started.cloudStory?.opening).toBe(true)
    expect(started.cloudStory?.visit).toBe(1)
    expect(() => db.recordCloudStoryClue(sessionId, 'c01_first_tree')).toThrow()
    advance(130)
    expect(db.processActiveSpecialFinds()).toBe(true)
    expect(db.getSnapshot().collection.clues.some((clue) => clue.id === 'c01_first_tree')).toBe(true)
    close(db)
    const reopened = database(path).db
    expect(reopened.getSnapshot().cloudStory?.records).toContain('c01_first_tree')
    expect(reopened.processActiveSpecialFinds()).toBe(false)
  })
  it('keeps the three authored IDs and 10-minute milestones', () => {
    expect(AREA01_SPECIAL_FINDS.map(f => f.itemKey)).toEqual(['old_wick', 'weathered_lens', 'astrolabe_core'])
    expect([599, 600, 1200, 1800, 2400, 3000, 6000].map(s => dueLampCount(s, 50))).toEqual([0, 1, 2, 3, 4, 5, 5])
  })
  it('persists a journey item/lamp before progress; the same lamp can independently grant the core', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    const { db, path } = database(); startArea(db)
    expect(rows(db, 'forest_explorations')).toHaveLength(1)
    expect(db.getSnapshot().specialFinds).toHaveLength(0)
    advance(600); expect(db.processActiveSpecialFinds()).toBe(true)
    expect(db.getSnapshot().specialFinds.map(f => f.itemKey)).toEqual(['old_wick', 'astrolabe_core'])
    expect(db.getSnapshot().mapCores[0].itemKey).toBe('astrolabe_core')
    const before = db.exportBackup(); close(db)
    const reopened = database(path).db
    expect(reopened.processActiveSpecialFinds()).toBe(false)
    reopened.importBackup(before)
    expect(reopened.getSnapshot().specialFinds).toHaveLength(2)
    expect(reopened.getSnapshot().mapCores).toEqual(before.data.map_cores.map((r: any) => ({ mapId: r.map_id, itemKey: r.item_key, acquiredAt: r.acquired_at })))
  })
  it('keeps 5% misses final, still guarantees a journey item, and cannot farm overtime', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { db } = database(); startArea(db)
    advance(600); db.processActiveSpecialFinds()
    expect(rows(db, 'forest_reward_rolls')[0].item_key).toBeNull()
    random.mockReturnValue(0)
    expect(db.processActiveSpecialFinds()).toBe(false)
    random.mockReturnValue(0.05)
    advance(2400); db.processActiveSpecialFinds()
    expect(db.getSnapshot().specialFinds.map(f => f.itemKey)).toEqual(['weathered_lens'])
    expect(rows(db, 'forest_reward_rolls').filter(r => r.reward_kind === 'core')).toHaveLength(5)
    expect(rows(db, 'forest_explorations').filter(r => r.completed_at)).toHaveLength(1)
    const saved = db.exportBackup(); advance(3600); db.processActiveSpecialFinds()
    expect(rows(db, 'forest_reward_rolls')).toEqual(saved.data.forest_reward_rolls)
    const rewardPlan = ({ story_records: _story, ambient_history: _ambient, ...plan }: Row) => plan
    expect(rows(db, 'forest_explorations').map(rewardPlan)).toEqual((saved.data.forest_explorations as Row[]).map(rewardPlan))
    const full = finish(db)
    expect(full.expeditionNodes.find(n => n.id === full.pendingDebrief!.nodeId)?.state).toBe('awaiting_route')
    expect(full.runRelics).toHaveLength(0)
  })
  it('resumes partials without another item plan, visit count or repeated lamp', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { db } = database(); startArea(db); advance(1200)
    let snapshot = finish(db)
    const plan = rows(db, 'forest_explorations')
    db.dismissDebrief(snapshot.pendingDebrief!.sessionId); startArea(db)
    expect(rows(db, 'forest_explorations')).toEqual(plan)
    advance(1800); snapshot = finish(db)
    expect(snapshot.specialFinds.filter(f => f.kind === 'relic')).toHaveLength(1)
    expect(rows(db, 'forest_reward_rolls').filter(r => r.reward_kind === 'core')).toHaveLength(5)
    expect(rows(db, 'forest_explorations').filter(r => r.completed_at)).toHaveLength(1)
  })
  it('persists the fifth-visit guarantee across restart and gives the core without a successful random roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { db, path } = database(); startArea(db)
    for (let visit = 0; visit < 4; visit++) { advance(3000); const completed = finish(db); next(db, completed) }
    expect(db.getSnapshot().mapCores).toHaveLength(0)
    const fifth = rows(db, 'forest_explorations').find(r => !r.completed_at)!
    expect(fifth.guaranteed_lamp).toBe(5)
    advance(1200); db.processActiveSpecialFinds(); close(db)
    const reopened = database(path).db
    expect(rows(reopened, 'forest_explorations').find(r => r.node_id === fifth.node_id)!.guaranteed_lamp).toBe(5)
    advance(1800); reopened.processActiveSpecialFinds()
    expect(reopened.getSnapshot().mapCores).toHaveLength(1)
    expect(reopened.getSnapshot().specialFinds.filter(f => f.kind === 'token')).toHaveLength(1)
    expect(rows(reopened, 'forest_explorations').every(r => r.guaranteed_lamp === null)).toBe(true)
    const completed = finish(reopened); next(reopened, completed); advance(3000); reopened.processActiveSpecialFinds()
    expect(reopened.getSnapshot().specialFinds.filter(f => f.kind === 'token')).toHaveLength(1)
    expect(reopened.getSnapshot().specialFinds.filter(f => f.kind === 'relic')).toHaveLength(6)
  })
  it('cancels a later guarantee when a normal core roll succeeds earlier', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { db } = database(); startArea(db)
    for (let visit = 0; visit < 4; visit++) { advance(3000); next(db, finish(db)) }
    random.mockReturnValue(0); advance(600); db.processActiveSpecialFinds()
    expect(db.getSnapshot().mapCores).toHaveLength(1)
    expect(rows(db, 'forest_explorations').every(r => r.guaranteed_lamp === null)).toBe(true)
    advance(2400); db.processActiveSpecialFinds()
    expect(db.getSnapshot().specialFinds.filter(f => f.kind === 'token')).toHaveLength(1)
  })
  it('validates and permanently saves the tree presentation acknowledgement idempotently', () => {
    const { db, path } = database(); const started = startArea(db); const id = started.activeSession!.id
    expect(() => db.recordWorldMark(id, 'invented')).toThrow()
    expect(() => db.recordWorldMark('unknown', 'tree_traces_seen')).toThrow()
    expect(() => db.recordWorldMark(id, 'tree_traces_seen')).toThrow()
    advance(3000); db.processActiveSpecialFinds()
    const saved = db.recordWorldMark(id, 'tree_traces_seen').worldMarks
    expect(saved).toHaveLength(1)
    advance(3); expect(db.recordWorldMark(id, 'tree_traces_seen').worldMarks).toEqual(saved)
    close(db); const reopened = database(path).db
    expect(reopened.getSnapshot().worldMarks).toEqual(saved)
    const backup = reopened.exportBackup(); reopened.importBackup(backup)
    expect(reopened.getSnapshot().worldMarks).toEqual(saved)
  })
  it('migrates legacy core ownership without inventing completed visits or replaying an award', () => {
    const { db } = database(); const snapshot = startArea(db)
    const backup = db.exportBackup(); backup.version = 5
    for (const t of ['forest_explorations', 'forest_reward_rolls', 'map_cores', 'world_marks']) delete backup.data[t]
    const at = '2026-09-25T00:00:00.000Z'
    backup.data.special_find_rolls = [{ id: 'legacy-core', run_id: snapshot.todayRun!.id, node_id: snapshot.activeSession!.nodeId,
      session_id: snapshot.activeSession!.id, location_title: 'forest', lamp_index: 1, item_key: 'astrolabe_core', rolled_at: at }]
    db.importBackup(backup)
    expect(db.getSnapshot().mapCores).toEqual([{ mapId: FOREST_MAP_ID, itemKey: 'astrolabe_core', acquiredAt: at }])
    expect(rows(db, 'forest_explorations')).toHaveLength(0)
    advance(3000); db.processActiveSpecialFinds()
    expect(db.getSnapshot().specialFinds.filter(f => f.kind === 'token')).toHaveLength(1)
    expect(db.getSnapshot().specialFinds.filter(f => f.kind === 'relic')).toHaveLength(1)
  })
})
