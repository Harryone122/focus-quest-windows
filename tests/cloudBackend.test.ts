import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { FOREST_MAP_ID, MOSS_MAP_ID } from '../src/shared/specialFinds'
import { COLLECTION_CLUES } from '../src/shared/collectionRoom'
import { lobbyFromSnapshot } from '../src/renderer/src/lobby/fromSnapshot'

type Row = Record<string, any>
let db: FocusQuestDatabase
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-02T03:00:00Z')); db = new FocusQuestDatabase(':memory:') })
afterEach(() => { db.close(); vi.useRealTimers() })
const advance = (s: number) => vi.setSystemTime(Date.now() + s * 1000)
function start() {
  let s = db.getSnapshot()
  if (!s.todayRun) {
    const task = db.addListTask({ title: '雲上交接測試' })
    s = db.startDailyRun(task.taskList.nextTaskId!)
    const node = s.expeditionNodes.find(n => n.areaId === FOREST_MAP_ID && n.plannedMinutes === 50)!
    s = db.selectExpeditionNode(s.todayRun!.id, node.id)
  }
  const node = s.expeditionNodes.find(n => n.id === s.todayRun!.selectedNodeId)!
  return db.startListFocus({ minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun!.id, nodeId: node.id, plannedMinutes: node.plannedMinutes })
}
function finish() {
  const id = db.getSnapshot().activeSession!.id
  db.beginSessionDebrief(id)
  return db.finishListFocus(id, false)
}

describe('Cloud handoff persistence', () => {
  it('grants the opening clue before the opening plays, and does not replay it on continuation', () => {
    const first = start(), seed = first.cloudStory!.whaleSeed
    advance(9); const review = finish()
    expect(review.collection.clues.filter(c => c.id === 'c01_first_tree')).toHaveLength(1)
    expect(review.collection.clues.some(c => c.id === 'n_first')).toBe(false)
    db.dismissDebrief(review.pendingDebrief!.sessionId)
    const resumed = start()
    expect(resumed.activeSession!.id).not.toBe(first.activeSession!.id)
    expect(resumed.cloudStory!.whaleSeed).toBe(seed)
    expect(resumed.cloudStory!.scheduledEvents.some(e => e.evs.includes('opening_a'))).toBe(false)
    expect(() => db.recordCloudStoryClue(first.activeSession!.id, 'c01_first_tree')).toThrow()
  })
  it('repeats carried-item discoveries in a new exploration while keeping one permanent clue', () => {
    const first = start(), backup = db.exportBackup()
    const clue = COLLECTION_CLUES.find(c => c.id === 'c01_rubbing')!
    const previousNode = { ...(backup.data.expedition_nodes as Row[])[0], id: 'previous-node', state: 'cleared' }
    ;(backup.data.expedition_nodes as Row[]).push(previousNode)
    ;(backup.data.collection_clues as Row[]).push({ id: clue.id, kind: clue.kind, source_id: clue.sourceId,
      place_id: null, source_label: clue.sourceLabel, text: clue.text, acquired_at: new Date(Date.now() - 60000).toISOString(), pinned_at: null })
    ;(backup.data.run_relics as Row[]).push({ id: 'carried-rubbing', run_id: first.todayRun!.id, node_id: 'previous-node', relic_key: 'charcoal_rubbing', acquired_at: new Date().toISOString() })
    db.importBackup(backup)
    expect(db.getSnapshot().cloudStory!.scheduledEvents.some(e => e.evs.includes('rubbing'))).toBe(true)
    advance(450); db.processActiveSpecialFinds()
    let s = db.getSnapshot()
    expect(s.collection.clues.filter(c => c.id === clue.id)).toHaveLength(1)
    const discovery = s.cloudDiscoveries![0]
    expect(lobbyFromSnapshot(s).newFinds.some(c => c.key === discovery.id)).toBe(true)
    db.inspectLobbyFind(discovery.id)
    db.importBackup(db.exportBackup()); s = db.getSnapshot()
    expect(s.cloudStory!.scheduledEvents.some(e => e.evs.includes('rubbing'))).toBe(false)
    expect(lobbyFromSnapshot(s).newFinds.some(c => c.key === discovery.id)).toBe(false)
  })
  it('saves ambient cooldowns and world props without rewards, deduplicates stones and rejects future events', () => {
    const s = start(), id = s.activeSession!.id, node = s.activeSession!.nodeId!
    advance(100)
    db.recordWorldMark(id, 'ambientEvent:ev_blossom_watch:95')
    db.recordWorldMark(id, 'paperBoat'); db.recordWorldMark(id, 'chestOpen')
    const stone = `shrinePebble:${node}:95000`
    db.recordWorldMark(id, stone); db.recordWorldMark(id, stone)
    const restored = db.exportBackup(); db.importBackup(restored)
    expect(db.getSnapshot().cloudStory!.eventHistory).toEqual([{ id: 'ev_blossom_watch', at: 95 }])
    expect(db.getSnapshot().worldMarks.filter(m => m.mark.startsWith('shrine_pebble_'))).toHaveLength(1)
    expect(db.getSnapshot().specialFinds).toHaveLength(0)
    expect(() => db.recordWorldMark(id, 'ambientEvent:ev_blossom_watch:1000')).toThrow()
    expect(() => db.recordWorldMark(id, 'ambientEvent:invalid:90')).toThrow()
    db.pauseFocus(id); expect(() => db.recordWorldMark(id, 'paperBoat')).toThrow()
  })
  it('shows the authored comparison only after its permanent core is owned', () => {
    const backup = db.exportBackup(), clue = COLLECTION_CLUES.find(c => c.id === 'c01_rubbing')!
    backup.data.collection_clues = [{ id: clue.id, kind: clue.kind, source_id: clue.sourceId, place_id: null,
      source_label: 'old label', text: 'old wording', acquired_at: new Date().toISOString(), pinned_at: null }]
    db.importBackup(backup)
    expect(db.getSnapshot().collection.clues[0].text).toBe(clue.text)
    expect(db.getSnapshot().collection.clues[0].comparison).toBeUndefined()
    ;(backup.data.map_cores as Row[]).push({ map_id: MOSS_MAP_ID, item_key: 'cracked_compass', acquired_at: new Date().toISOString() })
    db.importBackup(backup)
    expect(db.getSnapshot().collection.clues[0].comparison).toBe('和羅盤背面刻的字一樣。')
  })
  it('imports v11 exploration rows without new columns', () => {
    start(); const legacy = db.exportBackup(); legacy.version = 11
    for (const row of legacy.data.forest_explorations as Row[]) { delete row.story_records; delete row.ambient_history }
    db.importBackup(legacy)
    expect(db.getSnapshot().cloudStory!.records).toEqual([])
    expect(db.getSnapshot().cloudStory!.eventHistory).toEqual([])
  })
  it('migrates a short ended v11 opening without replaying its cinematic', () => {
    start(); advance(9); const ended = finish()
    db.dismissDebrief(ended.pendingDebrief!.sessionId)
    const legacy = db.exportBackup(); legacy.version = 11
    for (const row of legacy.data.forest_explorations as Row[]) { delete row.story_records; delete row.ambient_history }
    db.importBackup(legacy)
    expect(start().cloudStory!.scheduledEvents.some(e => e.evs.includes('opening_a'))).toBe(false)
  })
})
