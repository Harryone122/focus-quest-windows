import { afterEach, expect, it } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { lobbyFromSnapshot } from '../src/renderer/src/lobby/fromSnapshot'
import { FOREST_MAP_ID } from '../src/shared/specialFinds'

const dbs: FocusQuestDatabase[] = []
afterEach(() => { while (dbs.length) dbs.pop()!.close() })

it('shows no future-self trace before a real encounter, even if a core was found', () => {
  const db = new FocusQuestDatabase(':memory:'); dbs.push(db)
  const backup = db.exportBackup()
  backup.data.map_cores.push({ map_id: FOREST_MAP_ID, item_key: 'astrolabe_core', acquired_at: new Date().toISOString() })
  db.importBackup(backup)
  expect(lobbyFromSnapshot(db.getSnapshot()).campfireStage).toBe(0)
  expect(() => db.inspectCampfireTrace(1)).toThrow(/還沒有出現/)
})

it('derives cumulative stage from encounter and cores, and persists latest trace read state', () => {
  const db = new FocusQuestDatabase(':memory:'); dbs.push(db)
  const backup = db.exportBackup()
  backup.data.world_marks.push({ map_id: 'campfire-start', mark: 'future_self_met', seen_at: new Date().toISOString() })
  db.importBackup(backup)
  expect(lobbyFromSnapshot(db.getSnapshot()).campfireStage).toBe(1)
  expect(lobbyFromSnapshot(db.getSnapshot()).seenCampfireStage).toBe(false)
  db.inspectCampfireTrace(1)
  expect(lobbyFromSnapshot(db.getSnapshot()).seenCampfireStage).toBe(true)
  expect(db.getSnapshot().seenFindIds).toContain('campfire-stage-1')
  const withCore = db.exportBackup()
  withCore.data.map_cores.push({ map_id: FOREST_MAP_ID, item_key: 'astrolabe_core', acquired_at: new Date().toISOString() })
  db.importBackup(withCore)
  expect(lobbyFromSnapshot(db.getSnapshot()).campfireStage).toBe(2)
  expect(lobbyFromSnapshot(db.getSnapshot()).seenCampfireStage).toBe(false)
  expect(() => db.inspectCampfireTrace(1)).toThrow(/還沒有出現/)
  db.inspectCampfireTrace(2)
  expect(lobbyFromSnapshot(db.getSnapshot()).seenCampfireStage).toBe(true)
})
