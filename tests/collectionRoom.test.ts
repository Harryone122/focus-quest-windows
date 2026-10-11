import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { COLLECTION_CLUES } from '../src/shared/collectionRoom'
import { FOREST_MAP_ID } from '../src/shared/specialFinds'
import { departureFromSnapshot, lobbyFromSnapshot } from '../src/renderer/src/lobby/fromSnapshot'

type Row = Record<string, unknown>
let db: FocusQuestDatabase
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-28T10:00:00Z')); db = new FocusQuestDatabase(':memory:') })
afterEach(() => { db.close(); vi.useRealTimers(); vi.restoreAllMocks() })

function selectedForest() {
  const task = db.addListTask({ title: '整理企畫' })
  const run = db.startDailyRun(task.taskList.nextTaskId!)
  const node = run.expeditionNodes.find((entry) => entry.areaId === FOREST_MAP_ID)!
  return db.selectExpeditionNode(run.todayRun!.id, node.id)
}

describe('collection room persistence', () => {
  it('pins the whole tray in one saved operation and rolls back if a clue was not acquired', () => {
    const backup = db.exportBackup()
    backup.data.collection_clues = COLLECTION_CLUES.filter((clue) => ['h1a', 'h1b', 'h1c'].includes(clue.id)).map((clue) => ({
      id: clue.id, kind: clue.kind, source_id: clue.sourceId, place_id: clue.placeId,
      source_label: clue.sourceLabel, text: clue.text, acquired_at: new Date().toISOString(), pinned_at: null
    }))
    db.importBackup(backup)
    expect(() => db.pinCollectionClues(['h1a', 'not-acquired'])).toThrow('這條線索還沒有取得。')
    expect(db.getSnapshot().collection.clues.filter((clue) => clue.pinnedAt)).toHaveLength(0)
    const saved = db.pinCollectionClues(['h1a', 'h1b', 'h1c'])
    expect(saved.collection.clues.filter((clue) => clue.pinnedAt).map((clue) => clue.id)).toEqual(['h1a', 'h1b', 'h1c'])
    expect(saved.collection.hiddenPlaces.find((place) => place.id === 'h1')?.revealed).toBe(true)
  })

  it('pins acquired clues immediately, reveals a crossing place, and projects tracking into the lobby', () => {
    const backup = db.exportBackup()
    backup.data.collection_clues = COLLECTION_CLUES.filter((clue) => ['h1a', 'h1b', 'h1c'].includes(clue.id)).map((clue, index) => ({
      id: clue.id, kind: clue.kind, source_id: clue.sourceId, place_id: clue.placeId,
      source_label: clue.sourceLabel, text: clue.text, acquired_at: new Date(Date.now() + index).toISOString(), pinned_at: null
    }))
    db.importBackup(backup)
    db.pinCollectionClue('h1a'); db.pinCollectionClue('h1b')
    expect(db.getSnapshot().collection.hiddenPlaces.find((place) => place.id === 'h1')).toMatchObject({ located: true, revealed: false })
    db.pinCollectionClue('h1c')
    const tracked = db.setTrackingClue('h1')
    expect(tracked.collection.hiddenPlaces.find((place) => place.id === 'h1')).toMatchObject({ located: true, revealed: true })
    expect(lobbyFromSnapshot(tracked).journey.trackingClue).toBe('追查中 · 沉燈灣')
  })

  it('persists core presentation and the ten-core linkage before animation playback', () => {
    const backup = db.exportBackup()
    backup.data.map_cores = Array.from({ length: 10 }, (_, index) => ({ map_id: index === 0 ? FOREST_MAP_ID : `area-${String(index + 1).padStart(2, '0')}`, item_key: `core-${index + 1}`, acquired_at: new Date().toISOString() }))
    db.importBackup(backup)
    expect(db.markCollectionCorePresented(FOREST_MAP_ID).collection.presentedCoreMapIds).toContain(FOREST_MAP_ID)
    expect(db.markCollectionLinkagePlayed().collection.linkagePlayed).toBe(true)
    const reopened = db.exportBackup()
    db.importBackup(reopened)
    expect(db.getSnapshot().collection.linkagePlayed).toBe(true)
  })

  it('offers an owned core item choice, stores it on the exploration, and leaves random/core rules separate', () => {
    let snapshot = selectedForest()
    const backup = db.exportBackup()
    ;(backup.data.map_cores as Row[]).push({ map_id: FOREST_MAP_ID, item_key: 'astrolabe_core', acquired_at: new Date().toISOString() })
    db.importBackup(backup); snapshot = db.getSnapshot()
    expect(departureFromSnapshot(snapshot, null)?.itemChoice?.options.map((option) => option.itemKey)).toEqual(['old_wick', 'weathered_lens'])
    const node = snapshot.expeditionNodes.find((entry) => entry.id === snapshot.todayRun?.selectedNodeId)!
    db.startListFocus({ minimumMinutes: 5, blockedProcessNames: [], runId: snapshot.todayRun!.id, nodeId: node.id,
      plannedMinutes: node.plannedMinutes, requestedJourneyItem: 'old_wick' })
    const plan = (db.exportBackup().data.forest_explorations as Row[])[0]
    expect(plan).toMatchObject({ journey_item: 'old_wick', requested_item: 'old_wick', guaranteed_lamp: null })
  })
})
