import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { FocusQuestDatabase } from '../src/main/database'
import { DELETE_YESTERDAY_CONFIRMATION } from '../src/shared/taskList'
import { generateRoutes } from '../src/shared/expedition'
import type { AppSnapshot, BackupPayload } from '../src/shared/types'

const directories: string[] = []
const opened: FocusQuestDatabase[] = []
const focusInput = { minimumMinutes: 5 as const, blockedProcessNames: [] }
const monday = (): Date => new Date(2026, 8, 28, 9)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(monday())
})

afterEach(() => {
  for (const db of opened.splice(0)) db.close()
  vi.useRealTimers()
  for (const path of directories.splice(0)) {
    if (resolve(dirname(path)) !== resolve(tmpdir()) || !basename(path).startsWith('focus-quest-task-list-')) throw new Error('Unexpected test directory')
    rmSync(path, { recursive: true, force: true })
  }
})

function fixture(): { db: FocusQuestDatabase; path: string } {
  const directory = mkdtempSync(join(tmpdir(), 'focus-quest-task-list-'))
  directories.push(directory)
  const path = join(directory, 'test.db')
  const db = new FocusQuestDatabase(path)
  opened.push(db)
  return { db, path }
}

function reopen(db: FocusQuestDatabase, path: string): FocusQuestDatabase {
  opened.splice(opened.indexOf(db), 1)
  db.close()
  const next = new FocusQuestDatabase(path)
  opened.push(next)
  return next
}

function add(db: FocusQuestDatabase, title: string): string {
  return db.addListTask({ title }).taskList.today.find((task) => task.title === title)!.id
}

function advance(seconds: number): void {
  vi.setSystemTime(new Date(Date.now() + seconds * 1000))
}

function selectedFocus(db: FocusQuestDatabase, snapshot: AppSnapshot): string {
  const run = snapshot.todayRun!
  const node = snapshot.expeditionNodes.find((entry) => entry.id === run.selectedNodeId)!
  return db.startListFocus({ ...focusInput, runId: run.id, nodeId: node.id, plannedMinutes: node.plannedMinutes }).activeSession!.id
}

describe('ordered daily work without task roles', () => {
  it('records the real park time, clears it on return, and restores older backups', () => {
    const { db } = fixture()
    const id = add(db, '之後再讀')
    const parkedTime = new Date(2026, 8, 28, 12)
    vi.setSystemTime(parkedTime)
    const parked = db.setTaskRole(id, 'backlog').taskList.backlog[0]
    expect(parked.parkedAt).toBe(parkedTime.toISOString())
    const backup = db.exportBackup()
    const legacy: BackupPayload = structuredClone(backup)
    legacy.version = 10
    for (const row of legacy.data.tasks as Array<Record<string, unknown>>) delete row.parked_at
    const restored = fixture().db
    restored.importBackup(legacy)
    expect(restored.getSnapshot().taskList.backlog[0].parkedAt).toBeTruthy()
    expect(db.moveTasksToToday([id]).taskList.today[0].parkedAt).toBeNull()
  })
  it('accepts title-only items without a main/side quota and persists reordering', () => {
    let { db, path } = fixture()
    const ids = ['一', '二', '三', '四', '五'].map((title) => add(db, title))
    const snapshot = db.getSnapshot()
    expect(snapshot.taskList.today.map((task) => task.id)).toEqual(ids)
    expect(snapshot.taskList.nextTaskId).toBe(ids[0])
    expect(snapshot.taskList.today.every((task) => Boolean(task.stepId))).toBe(true)
    expect(snapshot.taskList.today.every((task) => !('role' in task))).toBe(true)
    db.reorderTodayTasks(snapshot.taskList.localDay, [...ids].reverse())
    db = reopen(db, path)
    expect(db.getSnapshot().taskList.today.map((task) => task.id)).toEqual([...ids].reverse())
    expect(() => db.reorderTodayTasks(snapshot.taskList.localDay, [ids[0], ids[0]])).toThrow(/重複/)
    expect(() => db.reorderTodayTasks(snapshot.taskList.localDay, ids.slice(1))).toThrow(/已更新/)
    expect(() => db.addListTask({ title: '  ' })).toThrow(/名稱/)
  })

  it('keeps multiple days of unfinished one-off work with the original dates until moved', () => {
    const { db } = fixture()
    const first = add(db, '週一事項')
    const backlog = db.addListTask({ title: '以後', placement: 'backlog' }).taskList.backlog[0].id
    vi.setSystemTime(new Date(2026, 8, 29, 9))
    expect(db.getSnapshot().taskList.yesterday.map((task) => task.id)).toEqual([first])
    const second = add(db, '週二事項')
    vi.setSystemTime(new Date(2026, 8, 30, 9))
    const list = db.getSnapshot().taskList
    expect(list.today).toEqual([])
    expect(list.yesterday.map((task) => task.scheduledDate)).toEqual(['2026-09-28', '2026-09-29'])
    expect(list.backlog.map((task) => task.id)).toEqual([backlog])
    const moved = db.moveTasksToToday([first, second]).taskList
    expect(moved.today.map((task) => task.id)).toEqual([first, second])
    expect(moved.yesterday).toEqual([])
    db.moveTasksToToday([first])
    expect(db.getSnapshot().taskList.today.map((task) => task.id)).toEqual([first, second])
    expect(() => db.moveTasksToToday([backlog, 'missing'])).toThrow()
    expect(db.getSnapshot().taskList.backlog[0].id).toBe(backlog)
  })

  it('uses the first item or an explicit departure selection, then completes the whole item', () => {
    const { db } = fixture()
    const first = add(db, '第一件'), second = add(db, '第二件')
    const initialStoryNode = db.getSnapshot().rpg.node
    const session = db.startListFocus({ ...focusInput, taskId: second }).activeSession!
    expect(session.taskId).toBe(second)
    expect(db.getSnapshot().taskList.nextTaskId).toBe(second)
    expect(() => db.deleteListTask(second)).toThrow(/正在專注/)
    expect(() => db.setListTaskDone(second, true)).toThrow(/正在專注/)
    advance(600)
    const unfinished = db.finishListFocus(session.id, false)
    expect(unfinished.taskList.nextTaskId).toBe(second)
    const resumed = db.startListFocus(focusInput).activeSession!
    expect(resumed.taskId).toBe(second)
    advance(600)
    const complete = db.finishListFocus(resumed.id, true)
    expect(complete.taskList.nextTaskId).toBe(first)
    expect(complete.taskList.today.find((task) => task.id === second)?.completed).toBe(true)
    expect(complete.tasks.find((task) => task.id === second)?.steps.every((step) => step.status === 'done')).toBe(true)
    expect(complete.rpg.starPages).toBe(0)
    expect(complete.rpg.materials).toBe(0)
    expect(complete.rpg.node).toBe(initialStoryNode)
    expect(db.finishListFocus(resumed.id, true).rpg.focusSeconds).toBe(complete.rpg.focusSeconds)
  })

  it('does not change gameplay state when marking a list item complete outside Focus', () => {
    const { db } = fixture()
    const id = add(db, '事項')
    const before = db.getSnapshot()
    const after = db.setListTaskDone(id, true)
    expect(after.rpg).toEqual(before.rpg)
    expect(after.mapCores).toEqual(before.mapCores)
    expect(after.taskList.nextTaskId).toBeNull()
    expect(db.setListTaskDone(id, false).taskList.nextTaskId).toBe(id)
  })

  it('requires exact confirmation and a fresh deletion scope, preserving work and game history', () => {
    const { db } = fixture()
    const id = add(db, '有紀錄的事項')
    let snapshot = db.startDailyRun(id)
    snapshot = db.selectExpeditionNode(snapshot.todayRun!.id, snapshot.expeditionNodes[0].id)
    const session = selectedFocus(db, snapshot)
    advance(600)
    db.finishListFocus(session, false)
    db.dismissDebrief(session)
    const progress = db.getSnapshot().expeditionNodes
    vi.setSystemTime(new Date(2026, 8, 29, 9))
    const list = db.getSnapshot().taskList
    const request = { localDay: list.localDay, taskIds: [id], confirmation: DELETE_YESTERDAY_CONFIRMATION }
    expect(() => db.deleteYesterdayTasks({ ...request, confirmation: 'yes' })).toThrow(/請輸入/)
    expect(() => db.deleteYesterdayTasks({ ...request, taskIds: [] })).toThrow(/已更新/)
    const after = db.deleteYesterdayTasks(request)
    expect(after.taskList.yesterday).toEqual([])
    expect(after.tasks.some((task) => task.id === id)).toBe(false)
    expect(after.recentSessions.some((entry) => entry.id === session)).toBe(true)
    expect(after.expeditionNodes).toEqual(progress)
    expect(after.todayRun?.id).toBe(snapshot.todayRun!.id)
    expect(() => db.setListTaskDone(id, false)).toThrow(/找不到/)
  })

  it('rejects a stale day and an overnight active item before deleting any item', () => {
    const { db } = fixture()
    const first = add(db, '保留一'), second = add(db, '保留二')
    db.startListFocus({ ...focusInput, taskId: second })
    vi.setSystemTime(new Date(2026, 8, 29, 9))
    const request = { localDay: '2026-09-29', taskIds: [first, second], confirmation: DELETE_YESTERDAY_CONFIRMATION }
    expect(() => db.deleteYesterdayTasks({ ...request, localDay: '2026-09-28' })).toThrow(/已更新/)
    expect(() => db.deleteYesterdayTasks(request)).toThrow(/正在專注/)
    expect(db.getSnapshot().taskList.yesterday).toHaveLength(2)
  })
})

describe('weekday routines and local rollover', () => {
  it('generates exactly once, persists restart/delete, skips missed dates and never creates overdue routines', () => {
    let { db, path } = fixture()
    const once = add(db, '一般事項')
    const first = db.saveRoutines([{ title: '讀書', weekdays: [1, 2, 3, 4, 5], enabled: true }]).taskList
    expect(first.today).toHaveLength(2)
    const routine = first.routines[0]
    const occurrence = first.today.find((task) => task.routineId === routine.id)!
    db = reopen(db, path)
    expect(db.getSnapshot().taskList.today.filter((task) => task.routineId)).toHaveLength(1)
    db.deleteTask(occurrence.id) // Also protect the old UI delete path against regeneration.
    expect(db.getSnapshot().taskList.today.map((task) => task.id)).toEqual([once])
    vi.setSystemTime(new Date(2026, 8, 30, 9))
    const next = db.getSnapshot().taskList
    expect(next.yesterday.map((task) => task.id)).toEqual([once])
    expect(next.today).toHaveLength(1)
    expect(next.today[0].routineId).toBe(routine.id)
    expect((db.exportBackup().data.tasks as Array<Record<string, unknown>>).filter((task) => task.routine_id)).toHaveLength(2)
    expect(() => db.moveTasksToToday([next.today[0].id])).toThrow(/一般事項/)
    vi.setSystemTime(new Date(2026, 9, 3, 9)) // Saturday
    expect(db.getSnapshot().taskList.today).toEqual([])
    expect(db.getSnapshot().taskList.yesterday.map((task) => task.id)).toEqual([once])
  })

  it('edits templates without mutating generated work and rejects malformed schedules atomically', () => {
    const { db } = fixture()
    const first = db.saveRoutines([{ title: '原名', weekdays: [1, 2], enabled: true }]).taskList
    const id = first.routines[0].id
    db.saveRoutines([{ id, title: '新名', weekdays: [1, 2], enabled: true }])
    expect(db.getSnapshot().taskList.today[0].title).toBe('原名')
    expect(() => db.saveRoutines([{ id, title: '錯誤', weekdays: [7], enabled: true }])).toThrow(/星期/)
    expect(db.getSnapshot().taskList.routines[0].title).toBe('新名')
    vi.setSystemTime(new Date(2026, 8, 29, 9))
    expect(db.getSnapshot().taskList.today[0].title).toBe('新名')
    db.saveRoutines([])
    expect(db.getSnapshot().taskList.today[0].title).toBe('新名')
    vi.setSystemTime(new Date(2026, 8, 30, 9))
    expect(db.getSnapshot().taskList.today).toEqual([])
    expect(db.getSnapshot().taskList.yesterday).toEqual([])
  })

  it('allows an overnight routine session to finish without resurrecting yesterday in either list', () => {
    const { db } = fixture()
    db.saveRoutines([{ title: '每日閱讀', weekdays: [1, 2], enabled: true }])
    vi.setSystemTime(new Date(2026, 8, 28, 23, 55))
    const session = db.startListFocus(focusInput).activeSession!
    advance(600)
    const result = db.finishListFocus(session.id, false)
    expect(result.taskList.yesterday).toEqual([])
    expect(result.taskList.today).toHaveLength(1)
    expect(result.taskList.today[0].id).not.toBe(session.taskId)
    expect(result.recentSessions[0].taskId).toBe(session.taskId)
  })
})

describe('route and save compatibility', () => {
  it('continues the same run and partial node across days with a different work item', () => {
    const { db } = fixture()
    const first = add(db, '週一工作')
    let snapshot = db.startDailyRun(first)
    const node = snapshot.expeditionNodes.find((entry) => entry.plannedMinutes === 50)!
    snapshot = db.selectExpeditionNode(snapshot.todayRun!.id, node.id)
    const session = selectedFocus(db, snapshot)
    advance(20 * 60)
    db.finishListFocus(session, false)
    db.dismissDebrief(session)
    vi.setSystemTime(new Date(2026, 8, 29, 9))
    const second = add(db, '週二工作')
    const next = db.startDailyRun(second)
    expect(next.todayRun?.id).toBe(snapshot.todayRun?.id)
    expect(next.todayRun?.seed).toBe(snapshot.todayRun?.seed)
    expect(next.expeditionNodes.find((entry) => entry.id === node.id)?.progressSeconds).toBe(1200)
    const continued = db.startListFocus({ ...focusInput, runId: next.todayRun!.id, nodeId: node.id, plannedMinutes: 50 })
    expect(continued.activeSession?.taskId).toBe(second)
    expect(continued.activeSession?.nodeId).toBe(node.id)
    expect(continued.activeSession?.departure).toBeNull()
    expect(continued.taskList.yesterday[0].id).toBe(first)
  })

  it('assigns both exits at all depths, backfills old saves, and departs only once per node', () => {
    let { db, path } = fixture()
    const id = add(db, '持續探索')
    let snapshot = db.startDailyRun(id)
    snapshot = db.selectExpeditionNode(snapshot.todayRun!.id, snapshot.expeditionNodes[0].id)
    for (let depth = 0; depth < 3; depth++) {
      const node = snapshot.expeditionNodes.find((entry) => entry.id === snapshot.todayRun!.selectedNodeId)!
      const session = selectedFocus(db, snapshot)
      if (depth > 0) expect(db.getSnapshot().activeSession?.departure?.exit ?? db.getMossDeparture(session)?.exit ?? db.getLakeDeparture(session)?.exit ?? db.getNurseryDeparture(session)?.exit).toBe(node.nurseryExitId ?? node.lakeExitId ?? node.mossExitId ?? node.departureExitId)
      advance(node.plannedMinutes * 60)
      db.finishListFocus(session, false)
      const full = db.getSnapshot()
      const children = full.expeditionNodes.filter((entry) => entry.parentNodeId === node.id)
      expect(children.map((entry) => entry.nurseryExitId ?? entry.lakeExitId ?? entry.mossExitId ?? entry.departureExitId).sort()).toEqual(node.areaId==='area-07-glass-nursery'?['exit_cellar','exit_corridor']:node.areaId === 'area-03-reflection-lake' ? ['a_arch', 'b_far'] : node.areaId === 'area-02-moss-station' ? ['exit_boat', 'exit_tunnel'] : ['exit_high', 'exit_pines'])
      snapshot = db.chooseNextRoute(snapshot.todayRun!.id, node.id, children[0].id)
    }
    const backup = db.exportBackup()
    for (const row of backup.data.expedition_nodes as Array<Record<string, unknown>>) row.departure_exit_id = null
    db.importBackup(backup)
    db = reopen(db, path)
    const restored = db.getSnapshot()
    expect(restored.expeditionNodes.filter((node) => node.depth > 0).every((node) => node.nurseryExitId ?? node.lakeExitId ?? node.mossExitId ?? node.departureExitId)).toBe(true)
    expect(restored.expeditionNodes.map((node) => node.id)).toEqual(snapshot.expeditionNodes.map((node) => node.id))
    const session = selectedFocus(db, restored)
    expect((db.getSnapshot().activeSession?.departure ?? db.getMossDeparture(session) ?? db.getLakeDeparture(session) ?? db.getNurseryDeparture(session))?.durationMs).toBe(restored.expeditionNodes.find(n=>n.id===restored.expeditionNodes.find(n=>n.id===restored.todayRun?.selectedNodeId)?.parentNodeId)?.areaId==='area-07-glass-nursery'?8000:5000)
    advance(600)
    db.finishListFocus(session, false)
    db.dismissDebrief(session)
    selectedFocus(db, db.getSnapshot())
    expect(db.getSnapshot().activeSession?.departure).toBeNull()
    expect(generateRoutes(11, 0, null).map((node) => node.departureExitId)).toEqual(['exit_bridge', 'exit_steps'])
  })

  it('round-trips v7 list order/routines/deletions and imports v6 without losing dates or sessions', () => {
    const { db } = fixture()
    const first = add(db, '一'), second = add(db, '二')
    db.reorderTodayTasks(db.getSnapshot().taskList.localDay, [second, first])
    db.saveRoutines([{ title: '例行', weekdays: [1], enabled: true }])
    const session = db.startListFocus(focusInput).activeSession!
    advance(600)
    db.finishListFocus(session.id, false)
    db.deleteListTask(first)
    const before = db.getSnapshot()
    const backup = db.exportBackup()
    expect(backup.version).toBe(13)
    const target = fixture().db
    target.importBackup(backup)
    expect(target.getSnapshot().taskList).toEqual(before.taskList)
    expect(target.getSnapshot().recentSessions).toEqual(before.recentSessions)
    const legacy: BackupPayload = structuredClone(backup)
    legacy.version = 6
    delete legacy.data.task_routines
    for (const row of legacy.data.tasks as Array<Record<string, unknown>>) {
      for (const key of ['list_position', 'routine_id', 'routine_day', 'deleted_at']) delete row[key]
      row.scheduled_date = '2026-09-27'
    }
    target.importBackup(legacy)
    expect(target.getSnapshot().taskList.yesterday).toHaveLength(3)
    expect(target.getSnapshot().taskList.yesterday.every((task) => task.scheduledDate === '2026-09-27')).toBe(true)
    expect(target.getSnapshot().recentSessions[0].id).toBe(session.id)
    expect(target.getSnapshot().taskList.routines).toEqual([])
    const invalid = structuredClone(backup)
    delete invalid.data.task_routines
    expect(() => target.importBackup(invalid)).toThrow(/task_routines/)
    expect(target.getSnapshot().taskList.yesterday).toHaveLength(3)
    const corruptSchedule = structuredClone(backup)
    ;(corruptSchedule.data.task_routines[0] as Record<string, unknown>).weekdays = '[9]'
    expect(() => target.importBackup(corruptSchedule)).toThrow(/例行事項/)
    expect(target.getSnapshot().taskList.yesterday).toHaveLength(3)
  })

  it('migrates a physical pre-list task table without resetting dates or IDs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focus-quest-task-list-'))
    directories.push(directory)
    const path = join(directory, 'legacy.db')
    const raw = new Database(path)
    raw.exec(`CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL,
      progress_definition TEXT NOT NULL, starter_action TEXT, obstacle TEXT NOT NULL, deadline TEXT,
      cue_type TEXT NOT NULL, cue_value TEXT NOT NULL, scheduled_date TEXT, status TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO tasks VALUES ('old', '保留事項', 'main', 'other', '原本目標', NULL, 'unclear', NULL,
        'manual', '', '2026-09-25', 'active', '2026-09-25T00:00:00Z', '2026-09-25T00:00:00Z');`)
    raw.close()
    const db = new FocusQuestDatabase(path)
    opened.push(db)
    const snapshot = db.getSnapshot()
    expect(snapshot.taskList.yesterday[0].id).toBe('old')
    expect(snapshot.taskList.yesterday[0].scheduledDate).toBe('2026-09-25')
    expect(snapshot.tasks[0].progressDefinition).toBe('原本目標')
  })
})
