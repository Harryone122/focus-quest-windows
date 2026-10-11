import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FocusQuestDatabase } from '../src/main/database'
import { suggestStartingActions } from '../src/shared/decomposition'
import { calculateLight, effectiveSeconds } from '../src/shared/rewards'
import { nextWorldStage, worldStageIndex } from '../src/shared/world'

describe('local starting action suggestions', () => {
  it('returns three alternative ways to begin', () => {
    const result = suggestStartingActions('report', 'too_big', '期末報告', '完成研究背景')
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
    expect(result.some((action) => action.includes('十五分鐘'))).toBe(true)
  })
})

describe('optional starting action flow', () => {
  it('creates a focusable task when the user chooses SKIP', () => {
    const directory = mkdtempSync(join(tmpdir(), 'focus-quest-test-'))
    const database = new FocusQuestDatabase(join(directory, 'focus-quest.db'))
    try {
      const snapshot = database.createTask({
        title: '整理介面流程',
        role: 'main',
        kind: 'creative',
        progressDefinition: '完成新版任務建立流程',
        starterAction: null,
        obstacle: 'unclear',
        deadline: null,
        startCue: { type: 'manual', value: '' }
      })
      const task = snapshot.tasks[0]
      expect(task.starterAction).toBeNull()
      expect(task.steps).toHaveLength(1)
      expect(task.steps[0].text).toBe('完成新版任務建立流程')
      const parked = database.setTaskRole(task.id, 'backlog').tasks.find((entry) => entry.id === task.id)
      expect(parked?.role).toBe('backlog')
      expect(parked?.progressDefinition).toBe('完成新版任務建立流程')
      expect(parked?.steps[0].id).toBe(task.steps[0].id)
      const afterDelete = database.deleteTask(task.id)
      expect(afterDelete.tasks.some((entry) => entry.id === task.id)).toBe(false)
    } finally {
      database.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})

describe('focus rewards', () => {
  it('does not reward sessions shorter than the minimum', () => {
    expect(calculateLight(599, 10, 0)).toBe(0)
  })

  it('caps one session at three light and one day at six', () => {
    expect(calculateLight(60 * 60, 10, 0)).toBe(3)
    expect(calculateLight(60 * 60, 10, 5)).toBe(1)
    expect(calculateLight(60 * 60, 10, 6)).toBe(0)
  })

  it('removes suspended time', () => {
    expect(effectiveSeconds('2026-01-01T10:00:00.000Z', '2026-01-01T10:20:00.000Z', 300)).toBe(900)
  })
})

describe('living world growth', () => {
  it('changes the world from accumulated focus time', () => {
    expect(worldStageIndex(0)).toBe(0)
    expect(worldStageIndex(10 * 60)).toBe(1)
    expect(worldStageIndex(60 * 60)).toBe(4)
    expect(nextWorldStage(25 * 60)?.minimumSeconds).toBe(45 * 60)
  })
})
