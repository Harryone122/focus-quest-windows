import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { FocusQuestDatabase } from '../src/main/database'

// Existing timing/story fixtures exercise the live presentation; quiet flow is covered separately.
function liveDatabase(...args: ConstructorParameters<typeof FocusQuestDatabase>): FocusQuestDatabase {
  const db = new FocusQuestDatabase(...args)
  db.updateSettings({ focusPresentation: 'live' })
  return db
}
import { focusElapsedMs, focusElapsedSeconds } from '../src/shared/focusTime'
import { effectiveSeconds } from '../src/shared/rewards'

const directories: string[] = []
const databases: FocusQuestDatabase[] = []
let now: number
beforeEach(() => {
  vi.useFakeTimers()
  now = Date.parse('2026-09-26T04:00:00.000Z')
  vi.setSystemTime(now)
})
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    const withinTemp = relative(realpathSync(tmpdir()), realpathSync(directory))
    if (!withinTemp || withinTemp.startsWith('..') || isAbsolute(withinTemp)) throw new Error('Unsafe test cleanup')
    rmSync(directory, { recursive: true, force: true })
  }
})
function advance(ms: number): void { now += ms; vi.setSystemTime(now) }
function database(path?: string): { db: FocusQuestDatabase; path: string } {
  if (!path) {
    const dir = mkdtempSync(join(tmpdir(), 'focus-quest-pause-'))
    directories.push(dir)
    path = join(dir, 'test.db')
  }
  const db = liveDatabase(path)
  databases.push(db)
  return { db, path }
}
function start(db: FocusQuestDatabase, expedition = true): string {
  const task = db.createTask({
    title: '暫停驗收', role: 'main', kind: 'creative', progressDefinition: '完成一段',
    starterAction: null, obstacle: 'too_big', deadline: null, startCue: { type: 'manual', value: '' }
  }).tasks[0]
  let route = {}
  if (expedition) {
    const snapshot = db.startDailyRun(task.id)
    const node = snapshot.expeditionNodes.find((entry) => entry.areaId === 'area-01-cloud-ruins')!
    const backup = db.exportBackup()
    ;(backup.data.expedition_nodes as Array<Record<string, unknown>>).find(entry => entry.id === node.id)!.planned_minutes = 25
    db.importBackup(backup)
    db.selectExpeditionNode(snapshot.todayRun!.id, node.id)
    route = { runId: snapshot.todayRun!.id, nodeId: node.id, plannedMinutes: 25 }
  }
  return db.startFocus({ taskId: task.id, stepId: task.steps[0].id, minimumMinutes: 5, blockedProcessNames: [], ...route }).activeSession!.id
}
function elapsed(db: FocusQuestDatabase): number { return focusElapsedSeconds(db.getSnapshot().activeSession!) }

describe('persistent manual pause', () => {
  it('freezes time and rolls; resumes without catch-up or duplicate rewards', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    const { db } = database()
    const id = start(db)
    advance(300_000)
    const paused = db.pauseFocus(id)
    expect(paused.activeSession?.manuallyPaused).toBe(true)
    expect(paused.specialFinds).toHaveLength(2)
    advance(3_600_000)
    expect(elapsed(db)).toBe(300)
    expect(db.processActiveSpecialFinds()).toBe(false)
    expect(db.exportBackup().data.forest_reward_rolls).toHaveLength(2)
    db.pauseFocus(id) // Duplicate request must keep the original start of pause.
    expect(elapsed(db)).toBe(300)
    const resumed = db.resumeFocus(id)
    expect(resumed.activeSession?.suspendedAt).toBeNull()
    expect(resumed.activeSession?.pausedSeconds).toBe(3600)
    db.resumeFocus(id)
    advance(300_000)
    expect(elapsed(db)).toBe(600)
    expect(db.processActiveSpecialFinds()).toBe(false)
    expect(db.exportBackup().data.forest_reward_rolls).toHaveLength(2)
  })

  it('counts overlapping manual and system pauses only once; wake does not resume manual pause', () => {
    const { db } = database()
    const id = start(db)
    advance(10_000)
    db.pauseFocus(id)
    advance(20_000)
    db.suspendActiveSession()
    advance(30_000)
    db.resumeActiveSession()
    expect(db.getSnapshot().activeSession?.manuallyPaused).toBe(true)
    expect(elapsed(db)).toBe(10)
    advance(40_000)
    expect(db.resumeFocus(id).activeSession?.pausedSeconds).toBe(90)
    advance(10_000)
    expect(elapsed(db)).toBe(20)
  })

  it('retains system pause when manual resume happens before system wake', () => {
    const { db } = database()
    const id = start(db)
    advance(1000)
    db.suspendActiveSession()
    db.pauseFocus(id)
    advance(10_000)
    const result = db.resumeFocus(id)
    expect(result.activeSession?.manuallyPaused).toBe(false)
    expect(result.activeSession?.suspendedAt).not.toBeNull()
    advance(10_000)
    db.resumeActiveSession()
    expect(elapsed(db)).toBe(1)
    expect(db.getSnapshot().activeSession?.pausedSeconds).toBe(20)
  })

  it('retains millisecond precision over many short pauses', () => {
    const { db } = database()
    const id = start(db, false)
    for (let i = 0; i < 20; i++) {
      advance(50)
      db.pauseFocus(id)
      advance(75)
      db.resumeFocus(id)
    }
    const session = db.getSnapshot().activeSession!
    expect(focusElapsedMs(session)).toBe(1000)
    expect(elapsed(db)).toBe(1)
    expect(effectiveSeconds(session.startedAt, new Date(now).toISOString(), session.pausedSeconds)).toBe(1)
  })

  it.each([true, false])('settles only effective time when ending paused (expedition=%s)', (expedition) => {
    const { db } = database()
    const id = start(db, expedition)
    advance(301_000)
    db.pauseFocus(id)
    advance(3_600_000)
    if (expedition) db.beginSessionDebrief(id)
    const result = db.endFocus({ sessionId: id, outcome: 'progress', completeTask: false })
    expect(result.effectiveSeconds).toBe(301)
    expect(result.session.pausedSeconds).toBe(3600)
    expect(result.session.suspendedAt).toBeNull()
    expect(result.session.manuallyPaused).toBe(false)
    expect(focusElapsedSeconds(result.session)).toBe(301)
    expect((db.exportBackup().data.forest_reward_rolls as Array<{reward_kind: string}>).filter((row) => row.reward_kind === 'core')).toHaveLength(expedition ? 1 : 0)
    expect(db.endFocus({ sessionId: id, outcome: 'progress', completeTask: false }).effectiveSeconds).toBe(301)
    expect(() => db.resumeFocus(id)).toThrow('找不到進行中的專注')
  })

  it('preserves manual pause across database reopen and backup restoration', () => {
    const { db, path } = database()
    const id = start(db)
    advance(11_000)
    db.pauseFocus(id)
    const backup = db.exportBackup()
    databases.splice(databases.indexOf(db), 1)
    db.close()
    advance(100_000)
    const reopened = database(path).db
    reopened.resumeActiveSession() // Boot clears system sleep only.
    expect(elapsed(reopened)).toBe(11)
    expect(reopened.getSnapshot().activeSession?.manuallyPaused).toBe(true)
    const restored = database().db
    restored.importBackup(backup)
    restored.resumeActiveSession()
    expect(elapsed(restored)).toBe(11)
    expect(restored.resumeFocus(id).activeSession?.pausedSeconds).toBe(100)
  })

  it('imports old backups with system sleep and without manual flags', () => {
    const { db } = database()
    start(db)
    advance(10_000)
    db.suspendActiveSession()
    const backup = db.exportBackup()
    backup.version = 4
    for (const row of backup.data.sessions as Record<string, unknown>[]) {
      delete row.manual_paused
      delete row.system_paused
    }
    advance(50_000)
    db.importBackup(backup)
    db.resumeActiveSession()
    expect(elapsed(db)).toBe(10)
    expect(db.getSnapshot().activeSession?.suspendedAt).toBeNull()
  })
})
