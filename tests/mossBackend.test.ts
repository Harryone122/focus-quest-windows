import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'
import { FocusQuestDatabase } from '../src/main/database'

// Existing timing/story fixtures exercise the live presentation; quiet flow is covered separately.
function liveDatabase(...args: ConstructorParameters<typeof FocusQuestDatabase>): FocusQuestDatabase {
  const db = new FocusQuestDatabase(...args)
  db.updateSettings({ focusPresentation: 'live' })
  return db
}
import { FOREST_MAP_ID, MOSS_MAP_ID } from '../src/shared/specialFinds'
import type { AppSnapshot, BackupPayload } from '../src/shared/types'
import type { MossRuntime } from '../src/shared/area02'
import { weatherAt } from '../src/shared/weather'
import { lobbyFromSnapshot } from '../src/renderer/src/lobby/fromSnapshot'

type Row = Record<string, any>
let db: FocusQuestDatabase
const temporaryDirectories: string[] = []
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 27, 9))
  db = liveDatabase(':memory:')
})
afterEach(() => {
  db.close(); vi.restoreAllMocks(); vi.useRealTimers()
  for (const dir of temporaryDirectories.splice(0)) {
    const rel = relative(realpathSync(tmpdir()), realpathSync(dir))
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unsafe cleanup')
    rmSync(dir, { recursive: true, force: true })
  }
})
const advance = (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000)
const rows = (table: string) => db.exportBackup().data[table] as Row[]
function prepare(mapId = MOSS_MAP_ID): AppSnapshot {
  const task = db.addListTask({ title: '驛站後端測試' }).taskList.nextTaskId!
  const run = db.startDailyRun(task)
  const node = run.expeditionNodes.find(node => node.plannedMinutes === 50)!
  const backup = db.exportBackup()
  ;(backup.data.expedition_nodes as Row[]).find(row => row.id === node.id)!.area_id = mapId
  db.importBackup(backup)
  return db.selectExpeditionNode(run.todayRun!.id, node.id)
}
function start(snapshot = db.getSnapshot()) {
  const node = snapshot.expeditionNodes.find(node => node.id === snapshot.todayRun!.selectedNodeId)!
  return db.startListFocus({ minimumMinutes: 5, blockedProcessNames: [], runId: snapshot.todayRun!.id,
    nodeId: node.id, plannedMinutes: node.plannedMinutes })
}
function finish() {
  const id = db.getSnapshot().activeSession!.id
  db.beginSessionDebrief(id)
  return db.finishListFocus(id, false)
}
function next(snapshot: AppSnapshot, mapId = MOSS_MAP_ID) {
  const from = snapshot.pendingDebrief!.nodeId
  const candidate = snapshot.expeditionNodes.find(node => node.parentNodeId === from)!
  const backup = db.exportBackup()
  const row = (backup.data.expedition_nodes as Row[]).find(row => row.id === candidate.id)!
  row.area_id = mapId; row.planned_minutes = 50
  db.importBackup(backup)
  db.chooseNextRoute(snapshot.todayRun!.id, from, candidate.id)
  return start()
}
function runtime(): MossRuntime { return JSON.parse(rows('area_scene_states').at(-1)!.state_json) }

describe('moss SQLite and IPC-facing contracts', () => {
  it('shows the first opening during the uncommitted five-minute preview', () => {
    const snapshot = start(prepare())
    const nodeId = snapshot.activeSession!.nodeId!
    advance(30)
    const scene = db.getMossScene(nodeId)!
    expect(scene.action?.eventId).toBe('story_open_carving')
    expect(rows('area_scene_states')).toHaveLength(1)
    expect(runtime().seconds).toBe(0)
    expect(rows('collection_clues').map(row => row.id)).not.toContain('m02_open')
  })
  it('records the first-opening clue on review even below the five-minute reward gate', () => {
    start(prepare())
    advance(45)
    finish()
    expect(rows('collection_clues').map(row => row.id)).toContain('m02_open')
    expect(runtime().seconds).toBe(0)
  })
  it('projects a carried-item discovery as a readable lobby card until inspected', () => {
    const first = start(prepare())
    const nodeId = first.activeSession!.nodeId!
    const backup = db.exportBackup()
    const stateRow = (backup.data.area_scene_states as Row[]).find(row => row.node_id === nodeId)!
    const state = JSON.parse(stateRow.state_json) as MossRuntime
    state.notes.push({ eventId: 'carry_old_wick', text: '熄燈的燈芯和手上的一樣。', tags: [], atSeconds: 1500 })
    stateRow.state_json = JSON.stringify(state)
    db.importBackup(backup)
    const discovery = db.getSnapshot().mossDiscoveries[0]
    expect(discovery.id).toBe(`moss-story:${nodeId}:carry_old_wick`)
    expect(lobbyFromSnapshot(db.getSnapshot()).newFinds.some(find => find.key === discovery.id)).toBe(true)
    db.inspectLobbyFind(discovery.id)
    expect(lobbyFromSnapshot(db.getSnapshot()).newFinds.some(find => find.key === discovery.id)).toBe(false)
  })
  it('awards Moss opening and visit clues from saved actions, then schedules the second visit', () => {
    start(prepare())
    expect(runtime().storyPlan).toMatchObject({ opening: true, visitEvent: 'story_first_lantern' })
    advance(3010); db.processActiveSpecialFinds()
    expect(runtime().usedEvents).toContain('story_open_carving')
    expect(runtime().usedEvents.some(id => id === 'story_first_lantern' || id === 'story_first_lantern_rain')).toBe(true)
    expect(rows('collection_clues').map(row => row.id)).toContain('h1b')
    expect(rows('collection_clues').map(row => row.id)).not.toContain('h1c')
    const second = next(finish())
    expect(rows('collection_clues').map(row => row.id)).toContain('m02_open')
    expect(runtime().storyPlan).toMatchObject({ opening: false, visitEvent: 'story_second_sketch' })
    advance(3010); db.processActiveSpecialFinds()
    expect(rows('collection_clues').map(row => row.id)).toContain('h1c')
    expect(second.activeSession?.nodeId).toBeTruthy()
  })
  it('saves two independent rewards on one lamp and separates forest ownership and visits', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    const s = start(prepare()); advance(600); db.processActiveSpecialFinds()
    expect(db.getSnapshot().specialFinds.map(find => find.itemKey)).toEqual(['old_luggage_tag', 'cracked_compass'])
    expect(db.getMossScene(s.activeSession!.nodeId!)!.coreTaken).toBe(true)
    expect(db.getSnapshot().mapCores.map(core => core.mapId)).toEqual([MOSS_MAP_ID])
    advance(2400); const done = finish()
    expect(done.runRelics).toHaveLength(0)
    expect(done.mapVisits).toContainEqual({ mapId: MOSS_MAP_ID, completed: 1 })
    const forest = next(done, FOREST_MAP_ID)
    expect(forest.mossStation).toBeNull()
    expect(db.getMossDeparture(forest.activeSession!.id)).toMatchObject({ fromAreaId: MOSS_MAP_ID, exit: 'exit_boat', durationMs: 5000 })
    advance(600); db.processActiveSpecialFinds()
    expect(db.getSnapshot().mapCores.map(core => core.mapId).sort()).toEqual([FOREST_MAP_ID, MOSS_MAP_ID].sort())
    expect(db.getSnapshot().specialFinds.map(find => find.itemKey)).toEqual(['old_luggage_tag', 'cracked_compass', 'old_wick', 'astrolabe_core'])
  })
  it('keeps clock, umbrella, actions and rewards frozen during manual pause and system sleep', () => {
    const s = start(prepare()), id = s.activeSession!.id
    advance(650); db.processActiveSpecialFinds(); db.pauseFocus(id)
    const scene = db.getSnapshot().mossStation, before = db.exportBackup()
    advance(8000); expect(db.processActiveSpecialFinds()).toBe(false)
    db.suspendActiveSession(); db.resumeActiveSession()
    expect(db.getSnapshot().mossStation).toEqual(scene)
    expect(rows('forest_reward_rolls')).toEqual(before.data.forest_reward_rolls)
    db.resumeFocus(id); advance(10); db.processActiveSpecialFinds()
    expect(db.getSnapshot().mossStation!.effectiveSeconds).toBe(660)
  })
  it('keeps exploration weather and item/guarantee plans across partials and dates', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    start(prepare()); advance(1200); let s = finish()
    const weatherSeed = s.mossStation!.weatherSeed, plan = rows('forest_explorations')
    db.dismissDebrief(s.pendingDebrief!.sessionId)
    advance(86400)
    const taskId = db.getSnapshot().taskList.yesterday[0].id
    db.moveTasksToToday([taskId]); start()
    expect(db.getSnapshot().mossStation!.weatherSeed).toBe(weatherSeed)
    expect(rows('forest_explorations')).toEqual(plan)
    advance(1800); s = finish()
    expect(s.specialFinds.map(find => find.itemKey)).toEqual(['charcoal_rubbing'])
    expect(s.mossStation!.litLampCount).toBe(5)
    expect(rows('forest_reward_rolls').filter(row => row.reward_kind === 'core')).toHaveLength(5)
    expect(rows('forest_explorations').filter(row => row.completed_at)).toHaveLength(1)
  })
  it('grants the fifth-visit core once, stops rolls after ownership, and keeps moss pity separate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    start(prepare())
    for (let visit = 0; visit < 4; visit++) { advance(3000); next(finish()) }
    expect(rows('forest_explorations').find(row => !row.completed_at)!.guaranteed_lamp).toBe(5)
    const before = db.exportBackup(); db.importBackup(before)
    advance(3000); db.processActiveSpecialFinds()
    expect(db.getSnapshot().mapCores).toMatchObject([{ mapId: MOSS_MAP_ID, itemKey: 'cracked_compass' }])
    const after = rows('forest_reward_rolls'); advance(6000); db.processActiveSpecialFinds()
    expect(rows('forest_reward_rolls')).toEqual(after)
    next(finish(), FOREST_MAP_ID)
    expect(rows('forest_explorations').find(row => row.map_id === FOREST_MAP_ID)!.guaranteed_lamp).toBeNull()
  })
  it('commits authored notes and capped world marks once, independent of render acknowledgements', () => {
    start(prepare())
    const backup = db.exportBackup(), state: MossRuntime = JSON.parse((backup.data.area_scene_states as Row[])[0].state_json)
    // This dry-only event must be eligible in the fixture; UUID-derived weather otherwise makes it flaky.
    state.weatherSeed = 0
    while (weatherAt(state.weatherSeed, 599).phase === 'rain') state.weatherSeed++
    state.seconds = 599; state.node = 'f_boulder'; state.sequence = 1
    state.intent = { kind: 'event', node: 'f_boulder', eventId: 'ev_boulder_stack', duration: 30 }
    state.action = { id: 1, kind: 'event', node: 'f_boulder', route: ['f_boulder'], eventId: 'ev_boulder_stack', startSeconds: 570, endSeconds: 600 }
    ;(backup.data.area_scene_states as Row[])[0].state_json = JSON.stringify(state)
    backup.data.map_world_state = [{ map_id: MOSS_MAP_ID, state_json: JSON.stringify({ boulderStones: 7, jizoPebbles: 12, signalLowered: false, towelLeft: false, bench_tea_seen: false }) }]
    db.importBackup(backup); advance(600); db.processActiveSpecialFinds()
    expect(db.getSnapshot().mossStation!.worldMarks).toMatchObject({ boulderStones: 8, jizoPebbles: 12 })
    expect(db.processActiveSpecialFinds()).toBe(false)
    const persisted = db.exportBackup(); db.importBackup(persisted)
    expect(db.getSnapshot().mossStation!.worldMarks.boulderStones).toBe(8)
    advance(6000); db.processActiveSpecialFinds()
    expect(db.getSnapshot().mossStation!.worldMarks.bench_tea_seen).toBe(true)
    expect(db.getSnapshot().worldMarks).toContainEqual(expect.objectContaining({ mapId: MOSS_MAP_ID, mark: 'bench_tea_seen' }))
    expect(runtime().notes.length).toBeGreaterThan(0)
    expect(runtime().notes.some(note => note.tags.length > 0)).toBe(true)
  })
  it('does not commit sub-five-minute event outcomes or poison the next session clock', () => {
    start(prepare()); advance(240); db.processActiveSpecialFinds()
    expect(db.getSnapshot().mossStation!.effectiveSeconds).toBe(240)
    expect(runtime().seconds).toBe(0)
    expect(rows('map_world_state')).toHaveLength(0)
    const s = finish(); db.dismissDebrief(s.pendingDebrief!.sessionId); start()
    expect(db.getSnapshot().mossStation!.effectiveSeconds).toBe(0)
    advance(300); db.processActiveSpecialFinds()
    expect(runtime().seconds).toBe(300)
  })
  it('imports v8 without new fields and rolls back a malformed v9 import', () => {
    const before = prepare(FOREST_MAP_ID), backup = db.exportBackup()
    backup.version = 8
    delete backup.data.area_scene_states; delete backup.data.map_world_state
    for (const node of backup.data.expedition_nodes as Row[]) delete node.area_id
    db.importBackup(backup)
    expect(db.getSnapshot().expeditionNodes.every(node => node.areaId === FOREST_MAP_ID)).toBe(true)
    const invalid = structuredClone(db.exportBackup()) as BackupPayload
    delete invalid.data.area_scene_states
    expect(() => db.importBackup(invalid)).toThrow()
    expect(db.getSnapshot().todayRun!.id).toBe(before.todayRun!.id)
  })
  it('reopens a real paused SQLite file with the awarded find already packed, without rerolling', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focus-quest-moss-')); temporaryDirectories.push(directory)
    const path = join(directory, 'test.db')
    db.close(); db = liveDatabase(path)
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    const s = start(prepare()); advance(610); db.processActiveSpecialFinds(); db.pauseFocus(s.activeSession!.id)
    expect(runtime().intent?.kind).toBe('special')
    const rewards = rows('forest_reward_rolls'), seed = runtime().weatherSeed
    const cooldown = runtime().eventCompletedAt, lastSpot = runtime().lastEventSpot
    expect(Object.keys(cooldown!).length).toBeGreaterThan(0)
    db.close(); advance(86400); db = liveDatabase(path)
    expect(db.processActiveSpecialFinds()).toBe(false)
    expect(runtime().weatherSeed).toBe(seed)
    expect(runtime().eventCompletedAt).toEqual(cooldown)
    expect(runtime().lastEventSpot).toBe(lastSpot)
    expect(runtime().seconds).toBe(610)
    expect(runtime().intent).toBeNull()
    expect(runtime().action).toBeNull()
    expect(runtime().handledFinds).toHaveLength(2)
    expect(rows('forest_reward_rolls')).toEqual(rewards)
    expect(db.getSnapshot().activeSession!.manuallyPaused).toBe(true)
    expect(db.getSnapshot().mossStation!.coreTaken).toBe(true)
  })
})
