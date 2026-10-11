import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FocusQuestDatabase } from '../src/main/database'
import { chooseRouteAreas, fullThresholdSeconds, generateRoutes } from '../src/shared/expedition'
import { FOREST_MAP_ID, MOSS_MAP_ID } from '../src/shared/specialFinds'
import type { AppSnapshot, BackupPayload, ExpeditionNode } from '../src/shared/types'
import { canStartSelectedNode, selectedNodeForRun } from '../src/renderer/src/ExpeditionMap'

const directories: string[] = []

afterEach(() => {
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true })
})

function database(): { db: FocusQuestDatabase; path: string } {
  const directory = mkdtempSync(join(tmpdir(), 'focus-quest-expedition-'))
  directories.push(directory)
  const path = join(directory, 'focus-quest.db')
  return { db: new FocusQuestDatabase(path), path }
}

function createTask(db: FocusQuestDatabase, title = '完成 Gameplay Prototype', role: 'main' | 'backlog' = 'main'): AppSnapshot {
  return db.createTask({
    title,
    role,
    kind: 'creative',
    progressDefinition: '完成可操作的垂直切片',
    starterAction: null,
    obstacle: 'too_big',
    deadline: null,
    startCue: { type: 'manual', value: '' }
  })
}

function startRunAndSelect(db: FocusQuestDatabase, plannedMinutes: 25 | 50 = 50): { snapshot: AppSnapshot; node: ExpeditionNode } {
  const task = createTask(db).tasks[0]
  let snapshot = db.startDailyRun(task.id)
  const node = snapshot.expeditionNodes.find((entry) => entry.areaId === 'area-01-cloud-ruins')!
  if (plannedMinutes !== 50) {
    const backup = db.exportBackup()
    ;(backup.data.expedition_nodes as Array<Record<string, unknown>>).find(entry => entry.id === node.id)!.planned_minutes = plannedMinutes
    db.importBackup(backup)
  }
  snapshot = db.selectExpeditionNode(snapshot.todayRun!.id, node.id)
  return { snapshot, node: snapshot.expeditionNodes.find((entry) => entry.id === node.id)! }
}

function startNodeFocus(db: FocusQuestDatabase, snapshot: AppSnapshot, node: ExpeditionNode): string {
  const task = snapshot.tasks.find((entry) => entry.id === snapshot.todayRun!.mainTaskId)!
  const next = db.startFocus({
    taskId: task.id,
    stepId: task.steps.find((entry) => entry.status === 'pending')!.id,
    minimumMinutes: 10,
    blockedProcessNames: [],
    runId: snapshot.todayRun!.id,
    nodeId: node.id,
    plannedMinutes: node.plannedMinutes
  })
  return next.activeSession!.id
}

function rewindSession(db: FocusQuestDatabase, sessionId: string, seconds: number): void {
  const backup = db.exportBackup()
  const sessions = backup.data.sessions as Array<Record<string, unknown>>
  const session = sessions.find((entry) => entry.id === sessionId)!
  session.started_at = new Date(Date.now() - seconds * 1000).toISOString()
  db.importBackup(backup)
}

function beginFor(db: FocusQuestDatabase, sessionId: string, seconds: number): AppSnapshot {
  rewindSession(db, sessionId, seconds)
  return db.beginSessionDebrief(sessionId)
}

describe('stable Daily Expedition rules', () => {
  it('returns the same active run on repeated starts, even with another task id', () => {
    const { db } = database()
    const main = createTask(db).tasks[0]
    const other = createTask(db, '另一件事', 'backlog').tasks.find((task) => task.title === '另一件事')!
    const first = db.startDailyRun(main.id)
    const second = db.startDailyRun(other.id)
    expect(second.todayRun?.id).toBe(first.todayRun?.id)
    expect(second.todayRun?.mainTaskId).toBe(main.id)
    expect(second.todayRun?.seed).toBe(first.todayRun?.seed)
    expect(second.expeditionNodes.map((node) => node.id)).toEqual(first.expeditionNodes.map((node) => node.id))
    db.close()
  })

  it('generates identical routes for the same seed, depth, and parent', () => {
    expect(generateRoutes(184921, 3, 'north_archive')).toEqual(generateRoutes(184921, 3, 'north_archive'))
    expect(generateRoutes(184921, 3, 'north_archive')).toHaveLength(2)
  })

  it('reserves a candidate for an unowned, unvisited core and keeps the saved slots stable', () => {
    for (let seed = 0; seed < 100; seed++) {
      const state = { visitedAreaIds: [FOREST_MAP_ID], ownedCoreAreaIds: [FOREST_MAP_ID] }
      const pair = generateRoutes(seed, 1, 'forest-parent', state)
      expect(pair.some(route=>!state.visitedAreaIds.includes(route.areaId)&&!state.ownedCoreAreaIds.includes(route.areaId))).toBe(true)
      expect(pair).toEqual(generateRoutes(seed, 1, 'forest-parent', state))
      expect(pair.map((route) => route.departureExitId)).toEqual(['exit_high', 'exit_pines'])
    }
  })

  it('only falls back to a same-journey revisit when released unvisited choices are exhausted', () => {
    const state = { visitedAreaIds: [FOREST_MAP_ID, MOSS_MAP_ID, 'area-03-reflection-lake'], ownedCoreAreaIds: [FOREST_MAP_ID] }
    expect(new Set(chooseRouteAreas(17, 2, 'moss-parent', state).map((area) => area.areaId)))
      .toHaveProperty('size', 2)
  })

  it('reaches the fifth lamp and full Area completion at 100 percent of planned time', () => {
    expect(fullThresholdSeconds(25)).toBe(25 * 60)
    expect(fullThresholdSeconds(50)).toBe(50 * 60)
    expect(fullThresholdSeconds(90)).toBe(90 * 60)
  })

  it('binds the two generated child routes to distinct Area 01 exits', () => {
    const routes = generateRoutes(184921, 1, 'parent-node')
    expect(routes.map((route) => route.departureExitId)).toEqual(['exit_high', 'exit_pines'])
    expect(generateRoutes(184921, 0, null).map((route) => route.departureExitId)).toEqual(['exit_bridge', 'exit_steps'])
  })

  it('requires a selected node and binds one session to exactly one node', () => {
    const { db } = database()
    const task = createTask(db).tasks[0]
    const run = db.startDailyRun(task.id)
    const node = run.expeditionNodes[0]
    expect(() => db.startFocus({
      taskId: task.id,
      stepId: task.steps[0].id,
      minimumMinutes: 10,
      blockedProcessNames: [],
      runId: run.todayRun!.id,
      nodeId: node.id,
      plannedMinutes: node.plannedMinutes
    })).toThrow(/先選定|不能開始/)
    const selected = db.selectExpeditionNode(run.todayRun!.id, node.id)
    const sessionId = startNodeFocus(db, selected, selected.expeditionNodes.find((entry) => entry.id === node.id)!)
    const active = db.getSnapshot().activeSession!
    expect(active.id).toBe(sessionId)
    expect(active.nodeId).toBe(node.id)
    expect(active.runId).toBe(run.todayRun!.id)
    expect(() => startNodeFocus(db, selected, node)).toThrow(/已有進行中的專注/)
    db.close()
  })

  it('switches A to B before focus and keeps the detail/start source in sync', () => {
    const { db } = database()
    const task = createTask(db).tasks[0]
    const run = db.startDailyRun(task.id)
    const [routeA, routeB] = run.expeditionNodes
    const selectedA = db.selectExpeditionNode(run.todayRun!.id, routeA.id)
    expect(selectedA.expeditionNodes.find((node) => node.id === routeA.id)?.state).toBe('selected')

    const selectedB = db.selectExpeditionNode(run.todayRun!.id, routeB.id)
    expect(selectedB.todayRun?.selectedNodeId).toBe(routeB.id)
    expect(selectedB.expeditionNodes.find((node) => node.id === routeA.id)?.state).toBe('available')
    expect(selectedB.expeditionNodes.find((node) => node.id === routeB.id)?.state).toBe('selected')
    expect(selectedB.expeditionNodes.filter((node) => node.state === 'selected')).toHaveLength(1)
    const detailNode = selectedNodeForRun(selectedB.todayRun, selectedB.expeditionNodes)
    expect(detailNode?.id).toBe(routeB.id)
    expect(canStartSelectedNode(selectedB.todayRun, detailNode, selectedB.tasks[0])).toBe(true)
    expect(() => startNodeFocus(db, selectedB, detailNode!)).not.toThrow()
    db.close()
  })
})

describe('partial and full node resolution', () => {
  it('stores a 23-minute partial without Relic or next routes', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const sessionId = startNodeFocus(db, snapshot, node)
    const resolved = beginFor(db, sessionId, 23 * 60)
    const current = resolved.expeditionNodes.find((entry) => entry.id === node.id)!
    expect(resolved.pendingDebrief?.resolution).toBe('partial')
    expect(current.state).toBe('partial')
    expect(current.progressSeconds).toBeGreaterThanOrEqual(23 * 60)
    expect(current.eventKey).toBeNull()
    expect(current.rewardOptions).toEqual([])
    expect(resolved.expeditionNodes.filter((entry) => entry.parentNodeId === node.id)).toHaveLength(0)
    expect(resolved.runRelics).toHaveLength(0)
    db.close()
  })

  it('resumes a partial node without losing its saved progress', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const firstSession = startNodeFocus(db, snapshot, node)
    let partial = beginFor(db, firstSession, 23 * 60)
    db.endFocus({ sessionId: firstSession, outcome: 'progress', completeTask: false })
    partial = db.dismissDebrief(firstSession)
    const saved = partial.expeditionNodes.find((entry) => entry.id === node.id)!
    expect(saved.state).toBe('partial')
    expect(canStartSelectedNode(partial.todayRun, saved, partial.tasks[0])).toBe(true)
    const savedSeconds = saved.progressSeconds
    startNodeFocus(db, partial, saved)
    const active = db.getSnapshot().expeditionNodes.find((entry) => entry.id === node.id)!
    expect(active.state).toBe('active')
    expect(active.progressSeconds).toBe(savedSeconds)
    db.close()
  })

  it('keeps a partial route usable after its original main task is completed', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 25)
    const originalTaskId = snapshot.todayRun!.mainTaskId
    const firstSession = startNodeFocus(db, snapshot, node)
    beginFor(db, firstSession, 17 * 60)
    db.endFocus({ sessionId: firstSession, outcome: 'completed', completeTask: true })
    let after = db.dismissDebrief(firstSession)
    expect(after.tasks.find((task) => task.id === originalTaskId)?.status).toBe('done')
    expect(after.expeditionNodes.find((entry) => entry.id === node.id)?.state).toBe('partial')

    after = createTask(db, '接續今天的新主線', 'main')
    const replacement = after.tasks.find((task) => task.title === '接續今天的新主線')!
    const partial = after.expeditionNodes.find((entry) => entry.id === node.id)!
    expect(canStartSelectedNode(after.todayRun, partial, replacement)).toBe(true)

    const resumed = db.startFocus({
      taskId: replacement.id,
      stepId: replacement.steps[0].id,
      minimumMinutes: 10,
      blockedProcessNames: [],
      runId: after.todayRun!.id,
      nodeId: partial.id,
      plannedMinutes: partial.plannedMinutes
    })
    expect(resumed.todayRun?.mainTaskId).toBe(replacement.id)
    expect(resumed.activeSession?.taskId).toBe(replacement.id)
    expect(resumed.expeditionNodes.find((entry) => entry.id === node.id)?.state).toBe('active')
    db.close()
  })

  it('adds 23 + 27 minutes to reach the 50-minute threshold and resolves only once', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const firstSession = startNodeFocus(db, snapshot, node)
    beginFor(db, firstSession, 23 * 60)
    db.endFocus({ sessionId: firstSession, outcome: 'progress', completeTask: false })
    let after = db.dismissDebrief(firstSession)
    const partial = after.expeditionNodes.find((entry) => entry.id === node.id)!
    const secondSession = startNodeFocus(db, after, partial)
    after = beginFor(db, secondSession, 27 * 60 + 1)
    const full = after.expeditionNodes.find((entry) => entry.id === node.id)!
    const childIds = after.expeditionNodes.filter((entry) => entry.parentNodeId === node.id).map((entry) => entry.id)
    expect(after.pendingDebrief?.resolution).toBe('full')
    expect(full.state).toBe('awaiting_route')
    expect(full.eventKey).toBeTruthy()
    expect(full.rewardOptions).toHaveLength(0)
    expect(childIds).toHaveLength(2)
    const repeated = db.beginSessionDebrief(secondSession)
    expect(repeated.expeditionNodes.filter((entry) => entry.parentNodeId === node.id).map((entry) => entry.id)).toEqual(childIds)
    expect(repeated.expeditionNodes.find((entry) => entry.id === node.id)?.rewardOptions).toEqual(full.rewardOptions)
    db.close()
  })

  it('does not add node progress for sessions shorter than five minutes', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const sessionId = startNodeFocus(db, snapshot, node)
    const resolved = beginFor(db, sessionId, 3 * 60)
    expect(resolved.pendingDebrief?.resolution).toBe('too_short')
    expect(resolved.expeditionNodes.find((entry) => entry.id === node.id)?.progressSeconds).toBe(0)
    db.close()
  })

  it('full-clears a route even when the real work outcome is blocked', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const sessionId = startNodeFocus(db, snapshot, node)
    const resolved = beginFor(db, sessionId, 50 * 60 + 1)
    expect(resolved.pendingDebrief?.resolution).toBe('full')
    db.endFocus({ sessionId, outcome: 'blocked', completeTask: false })
    expect(db.getSnapshot().expeditionNodes.find((entry) => entry.id === node.id)?.state).toBe('awaiting_route')
    db.close()
  })
})

describe('reward, route, and restart persistence', () => {
  it('locks switching during focus and keeps partial exploration on its current route', () => {
    const { db } = database()
    const task = createTask(db).tasks[0]
    let snapshot = db.startDailyRun(task.id)
    const routeA = snapshot.expeditionNodes.find((entry) => entry.plannedMinutes === 50)!
    const routeB = snapshot.expeditionNodes.find((entry) => entry.id !== routeA.id)!
    snapshot = db.selectExpeditionNode(snapshot.todayRun!.id, routeA.id)
    const sessionId = startNodeFocus(db, snapshot, routeA)
    expect(() => db.selectExpeditionNode(snapshot.todayRun!.id, routeB.id)).toThrow(/專注進行中/)

    beginFor(db, sessionId, 23 * 60)
    db.endFocus({ sessionId, outcome: 'progress', completeTask: false })
    db.dismissDebrief(sessionId)

    expect(() => db.selectExpeditionNode(snapshot.todayRun!.id, routeB.id)).toThrow(/先完成目前地圖/)
    const switched = db.selectExpeditionNode(snapshot.todayRun!.id, routeA.id)
    expect(switched.todayRun?.selectedNodeId).toBe(routeA.id)
    expect(switched.expeditionNodes.find((entry) => entry.id === routeA.id)?.state).toBe('partial')
    expect(switched.expeditionNodes.find((entry) => entry.id === routeB.id)?.state).toBe('available')

    const partialNode = db.getSnapshot().expeditionNodes.find((entry) => entry.id === routeA.id)!
    const secondSession = startNodeFocus(db, db.getSnapshot(), partialNode)
    const pending = beginFor(db, secondSession, 27 * 60 + 1)
    expect(pending.expeditionNodes.find((entry) => entry.id === routeA.id)?.state).toBe('awaiting_route')
    expect(() => db.selectExpeditionNode(snapshot.todayRun!.id, routeB.id)).toThrow(/專注進行中/)
    db.endFocus({ sessionId: secondSession, outcome: 'progress', completeTask: false })
    const fullNode = db.getSnapshot().expeditionNodes.find((entry) => entry.id === routeA.id)!
    expect(fullNode.selectedRelicKey).toBeTruthy()
    expect(() => db.selectExpeditionNode(snapshot.todayRun!.id, routeB.id)).toThrow(/專注進行中/)
    db.close()
  })

  it('awards one journey item automatically, prevents a second reward, then allows a child route', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const sessionId = startNodeFocus(db, snapshot, node)
    let resolved = beginFor(db, sessionId, 50 * 60 + 1)
    const full = resolved.expeditionNodes.find((entry) => entry.id === node.id)!
    const next = resolved.expeditionNodes.find((entry) => entry.parentNodeId === node.id)!
    expect(() => db.chooseNextRoute(resolved.todayRun!.id, node.id, next.id)).toThrow(/回顧/)
    db.endFocus({ sessionId, outcome: 'blocked', completeTask: false })
    resolved = db.getSnapshot()
    expect(full.rewardOptions).toHaveLength(0)
    expect(resolved.specialFinds.filter((find) => find.kind === 'relic')).toHaveLength(1)
    expect(resolved.runRelics).toHaveLength(0)
    expect(() => db.chooseRunRelic(resolved.todayRun!.id, node.id, 'broken_compass')).toThrow(/已經選過/)
    const afterRoute = db.chooseNextRoute(resolved.todayRun!.id, node.id, next.id)
    expect(afterRoute.pendingDebrief).toBeNull()
    expect(afterRoute.todayRun?.selectedNodeId).toBe(next.id)
    expect(afterRoute.expeditionNodes.find((entry) => entry.id === node.id)?.state).toBe('cleared')
    expect(afterRoute.expeditionNodes.find((entry) => entry.id === next.id)?.state).toBe('selected')
    db.close()
  })

  it('hands the chosen Area 01 exit to the next Focus only on its first session', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 25)
    const firstSession = startNodeFocus(db, snapshot, node)
    const resolved = beginFor(db, firstSession, 25 * 60 + 1)
    const fullNode = resolved.expeditionNodes.find((entry) => entry.id === node.id)!
    db.endFocus({ sessionId: firstSession, outcome: 'progress', completeTask: false })
    expect(fullNode.rewardOptions).toHaveLength(0)
    const child = db.getSnapshot().expeditionNodes.find((entry) => entry.parentNodeId === node.id)!
    const selected = db.chooseNextRoute(snapshot.todayRun!.id, node.id, child.id)
    expect(selected.expeditionNodes.find((entry) => entry.id === child.id)?.departureExitId).toBe(child.departureExitId)

    const legacyBackup = db.exportBackup()
    for (const entry of legacyBackup.data.expedition_nodes as Array<Record<string, unknown>>) delete entry.departure_exit_id
    db.importBackup(legacyBackup)
    expect(db.getSnapshot().expeditionNodes.find((entry) => entry.id === child.id)?.departureExitId).toBe(child.departureExitId)

    const childSession = startNodeFocus(db, db.getSnapshot(), child)
    const departure = db.getSnapshot().activeSession!.departure
    expect(departure?.exit).toBe(child.departureExitId)
    expect(departure?.durationMs).toBe(5000)
    expect(departure?.route[0]).toBe('b_tree')
    expect(departure?.route.at(-1)).toBe(child.departureExitId === 'exit_high' ? 'c_exit' : 'd_exit')

    beginFor(db, childSession, 6 * 60)
    db.endFocus({ sessionId: childSession, outcome: 'progress', completeTask: false })
    const continuing = db.dismissDebrief(childSession)
    const resumedNode = continuing.expeditionNodes.find((entry) => entry.id === child.id)!
    startNodeFocus(db, continuing, resumedNode)
    expect(db.getSnapshot().activeSession?.departure).toBeNull()
    db.close()
  })

  it('restores the automatic award and awaiting route state after restart', () => {
    const { db, path } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const sessionId = startNodeFocus(db, snapshot, node)
    const resolved = beginFor(db, sessionId, 50 * 60 + 1)
    const before = resolved.expeditionNodes.find((entry) => entry.id === node.id)!
    const children = resolved.expeditionNodes.filter((entry) => entry.parentNodeId === node.id).map((entry) => entry.id)
    db.close()

    const reopened = new FocusQuestDatabase(path)
    let restored = reopened.getSnapshot()
    const restoredNode = restored.expeditionNodes.find((entry) => entry.id === node.id)!
    expect(restored.pendingDebrief?.resolution).toBe('full')
    expect(restoredNode.eventKey).toBe(before.eventKey)
    expect(restoredNode.rewardOptions).toEqual(before.rewardOptions)
    expect(restored.expeditionNodes.filter((entry) => entry.parentNodeId === node.id).map((entry) => entry.id)).toEqual(children)
    reopened.endFocus({ sessionId, outcome: 'progress', completeTask: false })
    restored = reopened.getSnapshot()
    reopened.close()

    const reopenedAgain = new FocusQuestDatabase(path)
    const awaitingRoute = reopenedAgain.getSnapshot()
    expect(awaitingRoute.pendingDebrief).not.toBeNull()
    expect(awaitingRoute.expeditionNodes.find((entry) => entry.id === node.id)?.state).toBe('awaiting_route')
    expect(awaitingRoute.specialFinds.filter((find) => find.kind === 'relic')).toHaveLength(1)
    reopenedAgain.close()
  })

  it('rejects an extra invented Relic after the automatic award', () => {
    const { db } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const sessionId = startNodeFocus(db, snapshot, node)
    beginFor(db, sessionId, 50 * 60 + 1)
    db.endFocus({ sessionId, outcome: 'progress', completeTask: false })
    expect(() => db.chooseRunRelic(snapshot.todayRun!.id, node.id, 'invented_relic')).toThrow(/已經選過/)
    db.close()
  })

  it('recovers an active session on the same run and node after restart', () => {
    const { db, path } = database()
    const { snapshot, node } = startRunAndSelect(db, 50)
    const sessionId = startNodeFocus(db, snapshot, node)
    db.close()
    const reopened = new FocusQuestDatabase(path)
    const restored = reopened.getSnapshot()
    expect(restored.activeSession?.id).toBe(sessionId)
    expect(restored.activeSession?.nodeId).toBe(node.id)
    expect(restored.expeditionNodes.find((entry) => entry.id === node.id)?.state).toBe('active')
    reopened.close()
  })

  it('restores selected and partial detail state after restart', () => {
    const first = database()
    const task = createTask(first.db).tasks[0]
    let snapshot = first.db.startDailyRun(task.id)
    const route = snapshot.expeditionNodes[1]
    snapshot = first.db.selectExpeditionNode(snapshot.todayRun!.id, route.id)
    first.db.close()

    let reopened = new FocusQuestDatabase(first.path)
    let restored = reopened.getSnapshot()
    expect(selectedNodeForRun(restored.todayRun, restored.expeditionNodes)?.id).toBe(route.id)
    expect(canStartSelectedNode(restored.todayRun, selectedNodeForRun(restored.todayRun, restored.expeditionNodes), restored.tasks[0])).toBe(true)
    const sessionId = startNodeFocus(reopened, restored, selectedNodeForRun(restored.todayRun, restored.expeditionNodes)!)
    restored = beginFor(reopened, sessionId, 23 * 60)
    reopened.close()

    reopened = new FocusQuestDatabase(first.path)
    restored = reopened.getSnapshot()
    expect(restored.pendingDebrief?.resolution).toBe('partial')
    expect(selectedNodeForRun(restored.todayRun, restored.expeditionNodes)?.state).toBe('partial')
    expect(selectedNodeForRun(restored.todayRun, restored.expeditionNodes)?.progressSeconds).toBeGreaterThanOrEqual(23 * 60)
    reopened.close()
  })

  it('keeps automatic journey discoveries in Archive without a duplicate generic Relic', () => {
    const { db } = database()
    expect(db.getSnapshot().archive.relics).toHaveLength(0)
    const { snapshot, node } = startRunAndSelect(db, 25)
    const sessionId = startNodeFocus(db, snapshot, node)
    let resolved = beginFor(db, sessionId, 25 * 60 + 1)
    db.endFocus({ sessionId, outcome: 'progress', completeTask: false })
    const full = resolved.expeditionNodes.find((entry) => entry.id === node.id)!
    resolved = db.getSnapshot()
    expect(resolved.archive.specialFinds.filter((find) => find.kind === 'relic')).toHaveLength(1)
    expect(resolved.archive.locations).toHaveLength(1)
    expect(resolved.archive.events).toHaveLength(1)
    expect(resolved.archive.relics).toHaveLength(0)
    db.close()
  })
})

describe('work outcome and compatibility', () => {
  it('separates session outcome from explicit task completion', () => {
    const { db } = database()
    const task = createTask(db).tasks[0]
    const startOrdinary = (): string => db.startFocus({
      taskId: task.id,
      stepId: db.getSnapshot().tasks.find((entry) => entry.id === task.id)!.steps[0].id,
      minimumMinutes: 5,
      blockedProcessNames: []
    }).activeSession!.id

    let sessionId = startOrdinary()
    rewindSession(db, sessionId, 6 * 60)
    db.endFocus({ sessionId, outcome: 'progress', completeTask: false })
    expect(db.getSnapshot().tasks.find((entry) => entry.id === task.id)?.status).toBe('active')

    sessionId = startOrdinary()
    rewindSession(db, sessionId, 6 * 60)
    db.endFocus({ sessionId, outcome: 'blocked', completeTask: false })
    expect(db.getSnapshot().tasks.find((entry) => entry.id === task.id)?.status).toBe('active')

    sessionId = startOrdinary()
    rewindSession(db, sessionId, 6 * 60)
    db.endFocus({ sessionId, outcome: 'completed', completeTask: true })
    expect(db.getSnapshot().tasks.find((entry) => entry.id === task.id)?.status).toBe('done')
    db.close()
  })

  it('does not complete a task from completed outcome alone', () => {
    const { db } = database()
    const task = createTask(db).tasks[0]
    const sessionId = db.startFocus({ taskId: task.id, stepId: task.steps[0].id, minimumMinutes: 5, blockedProcessNames: [] }).activeSession!.id
    rewindSession(db, sessionId, 6 * 60)
    db.endFocus({ sessionId, outcome: 'completed', completeTask: false })
    expect(db.getSnapshot().tasks.find((entry) => entry.id === task.id)?.status).toBe('active')
    db.close()
  })

  it('does not apply the same ended session twice', () => {
    const { db } = database()
    const task = createTask(db).tasks[0]
    const sessionId = db.startFocus({ taskId: task.id, stepId: task.steps[0].id, minimumMinutes: 5, blockedProcessNames: [] }).activeSession!.id
    rewindSession(db, sessionId, 6 * 60)
    db.endFocus({ sessionId, outcome: 'progress', completeTask: false })
    const once = db.getSnapshot().rpg.focusSeconds
    db.endFocus({ sessionId, outcome: 'progress', completeTask: false })
    expect(db.getSnapshot().rpg.focusSeconds).toBe(once)
    db.close()
  })

  it('imports a version 1 backup without expedition tables', () => {
    const source = database().db
    createTask(source)
    const exported = source.exportBackup()
    const legacy: BackupPayload = { ...exported, version: 1, data: { ...exported.data } }
    for (const table of ['daily_runs', 'expedition_nodes', 'run_relics', 'pending_debriefs']) delete legacy.data[table]
    source.close()
    const target = database().db
    target.importBackup(legacy)
    expect(target.getSnapshot().tasks).toHaveLength(1)
    expect(target.getSnapshot().todayRun).toBeNull()
    target.close()
  })

  it('migrates a pre-expedition database without clearing old tables', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focus-quest-legacy-'))
    directories.push(directory)
    const path = join(directory, 'legacy.db')
    const raw = new Database(path)
    raw.exec(`
      CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, role TEXT NOT NULL, kind TEXT NOT NULL, progress_definition TEXT NOT NULL, obstacle TEXT NOT NULL, deadline TEXT, cue_type TEXT NOT NULL, cue_value TEXT NOT NULL, scheduled_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE steps (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, text TEXT NOT NULL, position INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
      CREATE TABLE sessions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), step_id TEXT NOT NULL REFERENCES steps(id), started_at TEXT NOT NULL, ended_at TEXT, minimum_minutes INTEGER NOT NULL, paused_seconds INTEGER NOT NULL DEFAULT 0, suspended_at TEXT, outcome TEXT, blocked_attempts INTEGER NOT NULL DEFAULT 0, earned_light INTEGER NOT NULL DEFAULT 0, local_day TEXT NOT NULL);
      CREATE TABLE block_rules (id TEXT PRIMARY KEY, process_name TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
      CREATE TABLE rpg_state (id INTEGER PRIMARY KEY CHECK (id = 1), chapter INTEGER NOT NULL, node INTEGER NOT NULL, light INTEGER NOT NULL, star_pages INTEGER NOT NULL, materials INTEGER NOT NULL, ability TEXT, last_loot TEXT);
      CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), reminder_policy TEXT NOT NULL, evening_reminder TEXT NOT NULL, mini_timer INTEGER NOT NULL, phone_ritual INTEGER NOT NULL, coat_color TEXT NOT NULL, lantern_color TEXT NOT NULL);
      CREATE TABLE events (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, numeric_payload TEXT NOT NULL);
    `)
    raw.close()
    const migrated = new FocusQuestDatabase(path)
    expect(migrated.getSnapshot().todayRun).toBeNull()
    expect(migrated.getSnapshot().rpg.focusSeconds).toBe(0)
    migrated.close()
  })
})
