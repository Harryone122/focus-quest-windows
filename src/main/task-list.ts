import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DELETE_YESTERDAY_CONFIRMATION } from '../shared/taskList'
import type { AddListTaskInput, DeleteYesterdayInput, ListTask, RoutineDefinition, SaveRoutineInput, TaskListSnapshot } from '../shared/taskList'

type Row = Record<string, unknown>

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function titleText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) throw new Error('請輸入 1–500 字的事項名稱。')
  return value.trim()
}

function uniqueIds(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id) || new Set(value).size !== value.length) {
    throw new Error('事項清單包含無效或重複的識別。')
  }
}

/** SQLite owns ordering, rollover and routine occurrence identity; no renderer rules. */
export class TaskListStore {
  constructor(private readonly db: Database.Database) {
    this.migrate()
  }

  private migrate(): void {
    this.db.transaction(() => {
      const columns = this.db.prepare('PRAGMA table_info(tasks)').all() as Row[]
      for (const [name, type] of Object.entries({ list_position: 'INTEGER', routine_id: 'TEXT', routine_day: 'TEXT', deleted_at: 'TEXT', parked_at: 'TEXT' })) {
        if (!columns.some((column) => column.name === name)) this.db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${type}`)
      }
      this.db.exec(`CREATE TABLE IF NOT EXISTS task_routines (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, weekdays TEXT NOT NULL,
        enabled INTEGER NOT NULL, position INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_routine_occurrence ON tasks(routine_id, routine_day) WHERE routine_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_task_list ON tasks(scheduled_date, status, list_position);`)
      this.backfillPositions()
      this.backfillParkedAt()
    })()
  }

  backfillPositions(): void {
    const rows = this.db.prepare(`SELECT id, scheduled_date FROM tasks WHERE list_position IS NULL
      ORDER BY CASE role WHEN 'main' THEN 0 WHEN 'side' THEN 1 ELSE 2 END, created_at, id`).all() as Row[]
    const update = this.db.prepare('UPDATE tasks SET list_position = ? WHERE id = ?')
    for (const row of rows) update.run(this.nextPosition(row.scheduled_date as string | null), row.id)
  }

  backfillParkedAt(): void {
    // Old saves have no precise park timestamp. Their last edit is the best
    // available approximation; new writes persist the actual transition time.
    this.db.prepare(`UPDATE tasks SET parked_at = updated_at WHERE parked_at IS NULL
      AND scheduled_date IS NULL AND status = 'active' AND routine_id IS NULL`).run()
  }

  validateStoredRoutines(): void {
    for (const row of this.db.prepare('SELECT * FROM task_routines').all() as Row[]) {
      titleText(row.title)
      const days: unknown = JSON.parse(String(row.weekdays))
      if (!Array.isArray(days) || !days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
        || new Set(days).size !== days.length || ![0, 1].includes(Number(row.enabled))
        || !Number.isInteger(row.position) || Number(row.position) < 0) throw new Error('備份的例行事項格式不正確。')
    }
  }

  private nextPosition(day: string | null): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(list_position), -1) + 1 AS position FROM tasks WHERE scheduled_date IS ?').get(day) as Row
    return Number(row.position)
  }

  private insert(title: string, day: string | null, routineId: string | null = null): void {
    const id = randomUUID(), at = new Date().toISOString()
    // The legacy columns/one step are compatibility storage, never list authority.
    this.db.prepare(`INSERT INTO tasks (id, title, role, kind, progress_definition, starter_action,
      obstacle, deadline, cue_type, cue_value, scheduled_date, status, created_at, updated_at,
      list_position, routine_id, routine_day, parked_at)
      VALUES (?, ?, ?, 'other', ?, NULL, 'unclear', NULL, 'manual', '', ?, 'active', ?, ?, ?, ?, ?, ?)`)
      .run(id, title, day ? 'side' : 'backlog', title, day, at, at, this.nextPosition(day), routineId, routineId ? day : null, day ? null : at)
    this.db.prepare("INSERT INTO steps (id, task_id, text, position, status) VALUES (?, ?, ?, 0, 'pending')")
      .run(randomUUID(), id, title)
  }

  prepareDay(now = new Date()): void {
    const day = dayKey(now)
    this.db.transaction(() => {
      this.backfillPositions()
      const routines = this.db.prepare('SELECT * FROM task_routines WHERE enabled = 1 ORDER BY position, id').all() as Row[]
      for (const routine of routines) {
        const weekdays: number[] = JSON.parse(String(routine.weekdays))
        if (!weekdays.includes(now.getDay())) continue
        // Include completed/deleted/moved instances so none can regenerate today.
        if (this.db.prepare('SELECT 1 FROM tasks WHERE routine_id = ? AND routine_day = ?').get(routine.id, day)) continue
        this.insert(String(routine.title), day, String(routine.id))
      }
    })()
  }

  snapshot(now = new Date()): TaskListSnapshot {
    this.prepareDay(now)
    const day = dayKey(now)
    const rows = this.db.prepare(`SELECT tasks.*, (SELECT id FROM steps WHERE task_id = tasks.id
      AND status = 'pending' ORDER BY position, id LIMIT 1) AS step_id
      FROM tasks WHERE status != 'archived' AND deleted_at IS NULL
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, list_position, created_at, id`).all() as Row[]
    const map = (row: Row): ListTask => ({
      id: String(row.id), title: String(row.title), scheduledDate: row.scheduled_date as string | null,
      parkedAt: row.parked_at as string | null,
      position: Number(row.list_position), completed: row.status === 'done',
      routineId: row.routine_id as string | null, stepId: row.step_id as string | null
    })
    const today = rows.filter((row) => row.scheduled_date === day).map(map)
    return {
      localDay: day, today,
      yesterday: rows.filter((row) => row.status === 'active' && !row.routine_id && row.scheduled_date && String(row.scheduled_date) < day)
        .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)) || Number(a.list_position) - Number(b.list_position)).map(map),
      backlog: rows.filter((row) => row.status === 'active' && !row.scheduled_date && !row.routine_id).map(map),
      routines: (this.db.prepare('SELECT * FROM task_routines ORDER BY position, id').all() as Row[]).map((row): RoutineDefinition => ({
        id: String(row.id), title: String(row.title), weekdays: JSON.parse(String(row.weekdays)), enabled: Boolean(row.enabled), position: Number(row.position)
      })),
      nextTaskId: today.find((task) => !task.completed && task.stepId)?.id ?? null
    }
  }

  add(input: AddListTaskInput): void {
    const title = titleText(input?.title)
    if (input.placement !== undefined && !['today', 'backlog'].includes(input.placement)) throw new Error('未知的事項清單。')
    this.prepareDay()
    this.db.transaction(() => this.insert(title, input.placement === 'backlog' ? null : dayKey(new Date())))()
  }

  private editable(id: string): Row {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ? AND status != 'archived' AND deleted_at IS NULL").get(id) as Row | undefined
    if (!row) throw new Error('找不到這件事項。')
    if (this.db.prepare(`SELECT 1 FROM sessions WHERE task_id = ? AND (ended_at IS NULL OR outcome IS NULL)`).get(id)) {
      throw new Error('這件事項正在專注或等待回顧，請先完成這次專注。')
    }
    return row
  }

  rename(id: string, title: string): void {
    const text = titleText(title)
    this.db.transaction(() => {
      this.editable(id)
      this.db.prepare('UPDATE tasks SET title = ?, progress_definition = ?, updated_at = ? WHERE id = ?').run(text, text, new Date().toISOString(), id)
      // Keep historical session step text intact; the task title is the current label.
      this.db.prepare("UPDATE steps SET text = ? WHERE task_id = ? AND status = 'pending' AND id NOT IN (SELECT step_id FROM sessions)").run(text, id)
    })()
  }

  reorder(day: string, ids: string[]): void {
    uniqueIds(ids)
    this.db.transaction(() => {
      const list = this.snapshot()
      const expected = list.today.filter((task) => !task.completed).map((task) => task.id)
      if (day !== list.localDay || expected.length !== ids.length || ids.some((id) => !expected.includes(id))) {
        throw new Error('清單已更新，請重新排序。')
      }
      const update = this.db.prepare('UPDATE tasks SET list_position = ?, updated_at = ? WHERE id = ?')
      const at = new Date().toISOString()
      ids.forEach((id, index) => update.run(index, at, id))
    })()
  }

  moveToToday(ids: string[]): void {
    uniqueIds(ids)
    this.db.transaction(() => {
      this.prepareDay()
      const day = dayKey(new Date())
      const rows = ids.map((id) => this.editable(id))
      if (rows.some((row) => row.status !== 'active' || row.routine_id || (row.scheduled_date && String(row.scheduled_date) > day))) {
        throw new Error('只能把未完成的一般事項移到今天。')
      }
      for (const row of rows) {
        if (row.scheduled_date === day) continue
        this.db.prepare("UPDATE tasks SET scheduled_date = ?, list_position = ?, role = 'side', parked_at = NULL, updated_at = ? WHERE id = ?")
          .run(day, this.nextPosition(day), new Date().toISOString(), row.id)
      }
    })()
  }

  park(id: string): void {
    this.db.transaction(() => {
      const row = this.editable(id)
      if (row.routine_id || row.status !== 'active') throw new Error('只能暫放未完成的一般事項。')
      const at = new Date().toISOString()
      this.db.prepare("UPDATE tasks SET scheduled_date = NULL, list_position = ?, role = 'backlog', parked_at = ?, updated_at = ? WHERE id = ?")
        .run(this.nextPosition(null), at, at, id)
    })()
  }

  setDone(id: string, done: boolean): void {
    if (typeof done !== 'boolean') throw new Error('完成狀態不正確。')
    this.db.transaction(() => {
      this.editable(id)
      this.db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(done ? 'done' : 'active', new Date().toISOString(), id)
      this.db.prepare('UPDATE steps SET status = ? WHERE task_id = ?').run(done ? 'done' : 'pending', id)
    })()
  }

  promote(id: string): void {
    const row = this.db.prepare('SELECT scheduled_date FROM tasks WHERE id = ?').get(id) as Row | undefined
    if (!row) return
    const first = this.db.prepare('SELECT COALESCE(MIN(list_position), 0) - 1 AS position FROM tasks WHERE scheduled_date IS ?').get(row.scheduled_date) as Row
    this.db.prepare("UPDATE tasks SET list_position = ?, updated_at = ? WHERE id = ? AND status = 'active' AND deleted_at IS NULL")
      .run(first.position, new Date().toISOString(), id)
  }

  remove(id: string): void {
    this.db.transaction(() => {
      this.editable(id)
      // Hidden permanently from lists, retaining historical sessions and run FK links.
      this.db.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?').run(new Date().toISOString(), new Date().toISOString(), id)
    })()
  }

  deleteYesterday(input: DeleteYesterdayInput): void {
    uniqueIds(input?.taskIds)
    if (input.confirmation !== DELETE_YESTERDAY_CONFIRMATION) throw new Error(`請輸入「${DELETE_YESTERDAY_CONFIRMATION}」確認。`)
    this.db.transaction(() => {
      const list = this.snapshot()
      const expected = list.yesterday.map((task) => task.id)
      if (input.localDay !== list.localDay || expected.length !== input.taskIds.length || input.taskIds.some((id) => !expected.includes(id))) {
        throw new Error('昨天清單已更新，請重新確認刪除範圍。')
      }
      // Validate every item before mutating; an active overnight session blocks the batch.
      for (const id of expected) this.editable(id)
      for (const id of expected) this.remove(id)
    })()
  }

  saveRoutines(inputs: SaveRoutineInput[]): void {
    if (!Array.isArray(inputs)) throw new Error('例行事項格式不正確。')
    const ids = inputs.filter((input) => input.id !== undefined).map((input) => input.id)
    uniqueIds(ids)
    const normalized = inputs.map((input, position) => {
      const title = titleText(input?.title)
      if (!Array.isArray(input.weekdays) || !input.weekdays.length || input.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
        || new Set(input.weekdays).size !== input.weekdays.length || typeof input.enabled !== 'boolean') throw new Error('請選擇有效且不重複的星期。')
      return { ...input, title, position, weekdays: [...input.weekdays].sort() }
    })
    this.db.transaction(() => {
      for (const input of normalized) {
        if (input.id && !this.db.prepare('SELECT 1 FROM task_routines WHERE id = ?').get(input.id)) throw new Error('例行事項已更新，請重新讀取。')
      }
      // Replacing definitions never mutates today's already generated work/history.
      const retained = new Set(ids)
      for (const row of this.db.prepare('SELECT id FROM task_routines').all() as Row[]) {
        if (!retained.has(String(row.id))) this.db.prepare('DELETE FROM task_routines WHERE id = ?').run(row.id)
      }
      const at = new Date().toISOString()
      for (const input of normalized) this.db.prepare(`INSERT INTO task_routines (id, title, weekdays, enabled, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, weekdays=excluded.weekdays,
        enabled=excluded.enabled, position=excluded.position, updated_at=excluded.updated_at`)
        .run(input.id ?? randomUUID(), input.title, JSON.stringify(input.weekdays), Number(input.enabled), input.position, at, at)
      this.prepareDay()
    })()
  }
}
