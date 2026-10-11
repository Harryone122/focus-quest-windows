import Database from 'better-sqlite3'
import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FocusQuestDatabase } from '../src/main/database'

const directory = mkdtempSync(join(tmpdir(), 'focusquest-shell-test-'))
const path = join(directory, 'shell.db')
const db = new FocusQuestDatabase(path)
afterEach(() => { db.close(); vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }) })

it('projects all 14 days, recent five sessions and completed work from persisted records', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 29, 10))
  const task = db.addListTask({ title: '讀到第三章' }).taskList.today[0]
  const raw = new Database(path)
  const insert = raw.prepare(`INSERT INTO sessions (id, task_id, step_id, started_at, ended_at, minimum_minutes, local_day, outcome)
    VALUES (?, ?, ?, ?, ?, 5, ?, 'completed')`)
  for (let index = 0; index < 35; index++) {
    const start = new Date(2026, 8, 29, 8, index * 11)
    insert.run(`shell-${index}`, task.id, task.stepId, start.toISOString(), new Date(start.getTime() + 600000).toISOString(), '2026-09-29')
  }
  raw.close()
  db.setListTaskDone(task.id, true)
  const snapshot = db.getSnapshot()
  expect(snapshot.activityLog.days).toHaveLength(14)
  expect(snapshot.activityLog.days.at(-1)).toMatchObject({ day: '2026-09-29', seconds: 350 * 60, completedTasks: 1 })
  expect(snapshot.activityLog.sessions).toHaveLength(5)
  expect(snapshot.activityLog.sessions[0]).toMatchObject({ title: '讀到第三章', seconds: 600 })
  expect(snapshot.activityLog.recentlyCompleted[0].title).toBe('讀到第三章')
  vi.setSystemTime(new Date(2026, 9, 15, 10))
  const later = db.getSnapshot()
  expect(later.activityLog.days.every((day) => day.seconds === 0)).toBe(true)
  expect(later.activityLog.sessions).toHaveLength(5)
})
