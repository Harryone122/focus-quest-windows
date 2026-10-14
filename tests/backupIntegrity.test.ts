import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FocusQuestDatabase } from '../src/main/database'
import { FOREST_MAP_ID } from '../src/shared/specialFinds'

let db: FocusQuestDatabase
beforeEach(() => { db = new FocusQuestDatabase(':memory:') })
afterEach(() => db.close())

describe('backup import does not replace a playable save with corrupt JSON', () => {
  for (const value of ['{', '{}', '[3]']) it(`rejects invalid story records ${value} before replacing the save`, () => {
    let s = db.addListTask({ title: '必須保留的任務' })
    s = db.startDailyRun(s.taskList.nextTaskId!)
    const node = s.expeditionNodes.find(n => n.areaId === FOREST_MAP_ID)!
    s = db.selectExpeditionNode(s.todayRun!.id, node.id)
    db.startListFocus({ minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun!.id, nodeId: node.id, plannedMinutes: 50 })
    const before = db.exportBackup(), broken = structuredClone(before)
    const rows = broken.data.forest_explorations as Record<string, unknown>[]
    rows[0].story_records = value
    expect(() => db.importBackup(broken)).toThrow()
    expect(db.exportBackup().data).toEqual(before.data)
    expect(db.getSnapshot().activeSession?.nodeId).toBe(node.id)
  })
})
