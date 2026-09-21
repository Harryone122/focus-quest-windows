import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type {
  AppSettings,
  AppSnapshot,
  BackupPayload,
  BlockRule,
  CreateTaskInput,
  EndFocusInput,
  FocusResult,
  FocusSession,
  QuestTask,
  RpgChoice,
  RpgState,
  RunningApplication,
  StartFocusInput,
  TaskRole
} from '../shared/types'
import { calculateLight, effectiveSeconds } from '../shared/rewards'

type Row = Record<string, unknown>

const DEFAULT_SETTINGS: AppSettings = {
  reminderPolicy: 'gentle',
  eveningReminder: '20:30',
  miniTimer: true,
  phoneRitual: true,
  coatColor: 'navy',
  lanternColor: 'amber'
}

const LOOT = ['黃銅索引片', '微光書籤', '觀測鏡碎片', '星圖墨水', '溫室種子', '靜默鐘片']

function nowIso(): string {
  return new Date().toISOString()
}

export function localDay(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function bool(value: unknown): boolean {
  return Number(value) === 1
}

export class FocusQuestDatabase {
  private readonly db: Database.Database

  constructor(path: string) {
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        progress_definition TEXT NOT NULL,
        obstacle TEXT NOT NULL,
        deadline TEXT,
        cue_type TEXT NOT NULL,
        cue_value TEXT NOT NULL,
        scheduled_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        position INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        step_id TEXT NOT NULL REFERENCES steps(id),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        minimum_minutes INTEGER NOT NULL,
        paused_seconds INTEGER NOT NULL DEFAULT 0,
        suspended_at TEXT,
        outcome TEXT,
        blocked_attempts INTEGER NOT NULL DEFAULT 0,
        earned_light INTEGER NOT NULL DEFAULT 0,
        local_day TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS block_rules (
        id TEXT PRIMARY KEY,
        process_name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        chapter INTEGER NOT NULL,
        node INTEGER NOT NULL,
        light INTEGER NOT NULL,
        star_pages INTEGER NOT NULL,
        materials INTEGER NOT NULL,
        ability TEXT,
        last_loot TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        reminder_policy TEXT NOT NULL,
        evening_reminder TEXT NOT NULL,
        mini_timer INTEGER NOT NULL,
        phone_ritual INTEGER NOT NULL,
        coat_color TEXT NOT NULL,
        lantern_color TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        numeric_payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON tasks(scheduled_date, role, status);
      CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(local_day, ended_at);
    `)

    this.db.prepare(`
      INSERT OR IGNORE INTO rpg_state
      (id, chapter, node, light, star_pages, materials, ability, last_loot)
      VALUES (1, 1, 0, 0, 0, 0, NULL, NULL)
    `).run()
    this.db.prepare(`
      INSERT OR IGNORE INTO settings
      (id, reminder_policy, evening_reminder, mini_timer, phone_ritual, coat_color, lantern_color)
      VALUES (1, @reminderPolicy, @eveningReminder, @miniTimer, @phoneRitual, @coatColor, @lanternColor)
    `).run({
      ...DEFAULT_SETTINGS,
      miniTimer: Number(DEFAULT_SETTINGS.miniTimer),
      phoneRitual: Number(DEFAULT_SETTINGS.phoneRitual)
    })
  }

  close(): void {
    this.db.close()
  }

  private normalizeOldPlans(): void {
    this.db.prepare(`
      UPDATE tasks
      SET role = 'backlog', scheduled_date = NULL, updated_at = ?
      WHERE status = 'active' AND scheduled_date IS NOT NULL AND scheduled_date < ?
    `).run(nowIso(), localDay())
  }

  private taskFromRow(row: Row): QuestTask {
    const steps = this.db.prepare('SELECT * FROM steps WHERE task_id = ? ORDER BY position').all(row.id) as Row[]
    return {
      id: String(row.id),
      title: String(row.title),
      role: row.role as QuestTask['role'],
      kind: row.kind as QuestTask['kind'],
      progressDefinition: String(row.progress_definition),
      obstacle: row.obstacle as QuestTask['obstacle'],
      deadline: row.deadline ? String(row.deadline) : null,
      startCue: { type: row.cue_type as QuestTask['startCue']['type'], value: String(row.cue_value) },
      scheduledDate: row.scheduled_date ? String(row.scheduled_date) : null,
      status: row.status as QuestTask['status'],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      steps: steps.map((step) => ({
        id: String(step.id),
        taskId: String(step.task_id),
        text: String(step.text),
        position: Number(step.position),
        status: step.status as QuestTask['steps'][number]['status']
      }))
    }
  }

  private sessionFromRow(row: Row): FocusSession {
    return {
      id: String(row.id),
      taskId: String(row.task_id),
      stepId: String(row.step_id),
      taskTitle: row.task_title ? String(row.task_title) : undefined,
      stepText: row.step_text ? String(row.step_text) : undefined,
      startedAt: String(row.started_at),
      endedAt: row.ended_at ? String(row.ended_at) : null,
      minimumMinutes: Number(row.minimum_minutes) as FocusSession['minimumMinutes'],
      pausedSeconds: Number(row.paused_seconds),
      outcome: (row.outcome as FocusSession['outcome']) ?? null,
      blockedAttempts: Number(row.blocked_attempts),
      earnedLight: Number(row.earned_light)
    }
  }

  getSnapshot(): AppSnapshot {
    this.normalizeOldPlans()
    const taskRows = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status != 'archived'
      ORDER BY CASE role WHEN 'main' THEN 0 WHEN 'side' THEN 1 ELSE 2 END, created_at DESC
    `).all() as Row[]
    const activeRow = this.db.prepare(`
      SELECT sessions.*, tasks.title AS task_title, steps.text AS step_text
      FROM sessions
      JOIN tasks ON tasks.id = sessions.task_id
      JOIN steps ON steps.id = sessions.step_id
      WHERE sessions.ended_at IS NULL
      ORDER BY sessions.started_at DESC LIMIT 1
    `).get() as Row | undefined
    const recentRows = this.db.prepare(`
      SELECT sessions.*, tasks.title AS task_title, steps.text AS step_text
      FROM sessions
      JOIN tasks ON tasks.id = sessions.task_id
      JOIN steps ON steps.id = sessions.step_id
      WHERE sessions.ended_at IS NOT NULL
      ORDER BY sessions.ended_at DESC LIMIT 30
    `).all() as Row[]
    const blockRows = this.db.prepare('SELECT * FROM block_rules ORDER BY display_name').all() as Row[]
    const rpgRow = this.db.prepare('SELECT * FROM rpg_state WHERE id = 1').get() as Row
    const settingsRow = this.db.prepare('SELECT * FROM settings WHERE id = 1').get() as Row

    return {
      tasks: taskRows.map((row) => this.taskFromRow(row)),
      activeSession: activeRow ? this.sessionFromRow(activeRow) : null,
      recentSessions: recentRows.map((row) => this.sessionFromRow(row)),
      blockRules: blockRows.map((row): BlockRule => ({
        id: String(row.id),
        processName: String(row.process_name),
        displayName: String(row.display_name),
        enabled: bool(row.enabled),
        createdAt: String(row.created_at)
      })),
      rpg: {
        chapter: Number(rpgRow.chapter),
        node: Number(rpgRow.node),
        light: Number(rpgRow.light),
        starPages: Number(rpgRow.star_pages),
        materials: Number(rpgRow.materials),
        ability: (rpgRow.ability as RpgChoice | null) ?? null,
        lastLoot: rpgRow.last_loot ? String(rpgRow.last_loot) : null
      },
      settings: {
        reminderPolicy: settingsRow.reminder_policy as AppSettings['reminderPolicy'],
        eveningReminder: String(settingsRow.evening_reminder),
        miniTimer: bool(settingsRow.mini_timer),
        phoneRitual: bool(settingsRow.phone_ritual),
        coatColor: settingsRow.coat_color as AppSettings['coatColor'],
        lanternColor: settingsRow.lantern_color as AppSettings['lanternColor']
      }
    }
  }

  createTask(input: CreateTaskInput): AppSnapshot {
    const title = input.title.trim()
    if (!title) throw new Error('請輸入任務名稱。')
    const steps = input.steps.map((step) => step.trim()).filter(Boolean).slice(0, 4)
    if (steps.length === 0) throw new Error('至少需要一個能立即開始的步驟。')
    this.assertRoleCapacity(input.role)

    const id = randomUUID()
    const timestamp = nowIso()
    const scheduledDate = input.role === 'backlog' ? null : localDay()
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO tasks
        (id, title, role, kind, progress_definition, obstacle, deadline, cue_type, cue_value, scheduled_date, status, created_at, updated_at)
        VALUES (@id, @title, @role, @kind, @progressDefinition, @obstacle, @deadline, @cueType, @cueValue, @scheduledDate, 'active', @createdAt, @updatedAt)
      `).run({
        id,
        title,
        role: input.role,
        kind: input.kind,
        progressDefinition: input.progressDefinition.trim(),
        obstacle: input.obstacle,
        deadline: input.deadline || null,
        cueType: input.startCue.type,
        cueValue: input.startCue.value.trim(),
        scheduledDate,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      const statement = this.db.prepare('INSERT INTO steps (id, task_id, text, position, status) VALUES (?, ?, ?, ?, ?)')
      steps.forEach((step, index) => statement.run(randomUUID(), id, step, index, 'pending'))
      this.recordEvent('task_created', { roleMain: input.role === 'main', stepCount: steps.length })
    })
    transaction()
    return this.getSnapshot()
  }

  private assertRoleCapacity(role: TaskRole, excludingTaskId?: string): void {
    if (role === 'backlog') return
    const limit = role === 'main' ? 1 : 2
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM tasks
      WHERE scheduled_date = ? AND role = ? AND status = 'active' AND id != ?
    `).get(localDay(), role, excludingTaskId ?? '') as Row
    if (Number(row.count) >= limit) {
      throw new Error(role === 'main' ? '今天已經有主線任務了。' : '今天最多只能安排兩個支線任務。')
    }
  }

  setTaskRole(taskId: string, role: TaskRole): AppSnapshot {
    this.assertRoleCapacity(role, taskId)
    const result = this.db.prepare(`
      UPDATE tasks SET role = ?, scheduled_date = ?, updated_at = ? WHERE id = ? AND status = 'active'
    `).run(role, role === 'backlog' ? null : localDay(), nowIso(), taskId)
    if (!result.changes) throw new Error('找不到這個任務。')
    return this.getSnapshot()
  }

  archiveTask(taskId: string): AppSnapshot {
    this.db.prepare("UPDATE tasks SET status = 'archived', updated_at = ? WHERE id = ?").run(nowIso(), taskId)
    return this.getSnapshot()
  }

  startFocus(input: StartFocusInput): AppSnapshot {
    const existing = this.db.prepare('SELECT id FROM sessions WHERE ended_at IS NULL').get()
    if (existing) throw new Error('目前已有進行中的專注。')
    const step = this.db.prepare(`
      SELECT steps.id, steps.task_id FROM steps JOIN tasks ON tasks.id = steps.task_id
      WHERE steps.id = ? AND tasks.id = ? AND steps.status = 'pending' AND tasks.status = 'active'
    `).get(input.stepId, input.taskId)
    if (!step) throw new Error('這個步驟已完成或不存在。')

    const timestamp = nowIso()
    this.db.prepare(`
      INSERT INTO sessions
      (id, task_id, step_id, started_at, ended_at, minimum_minutes, paused_seconds, outcome, blocked_attempts, earned_light, local_day)
      VALUES (?, ?, ?, ?, NULL, ?, 0, NULL, 0, 0, ?)
    `).run(randomUUID(), input.taskId, input.stepId, timestamp, input.minimumMinutes, localDay())
    this.enableOnlyBlockRules(input.blockedProcessNames)
    this.recordEvent('focus_started', { minimumMinutes: input.minimumMinutes, blockerCount: input.blockedProcessNames.length })
    return this.getSnapshot()
  }

  suspendActiveSession(): void {
    this.db.prepare(`UPDATE sessions SET suspended_at = ? WHERE ended_at IS NULL AND suspended_at IS NULL`).run(nowIso())
  }

  resumeActiveSession(): void {
    const row = this.db.prepare(`SELECT id, suspended_at, paused_seconds FROM sessions WHERE ended_at IS NULL LIMIT 1`).get() as Row | undefined
    if (!row?.suspended_at) return
    const suspended = Math.max(0, Math.floor((Date.now() - new Date(String(row.suspended_at)).getTime()) / 1000))
    this.db.prepare(`UPDATE sessions SET paused_seconds = ?, suspended_at = NULL WHERE id = ?`)
      .run(Number(row.paused_seconds) + suspended, row.id)
  }

  incrementBlockedAttempt(): void {
    this.db.prepare(`UPDATE sessions SET blocked_attempts = blocked_attempts + 1 WHERE ended_at IS NULL`).run()
    this.recordEvent('blocker_triggered', { count: 1 })
  }

  endFocus(input: EndFocusInput): FocusResult {
    const row = this.db.prepare(`
      SELECT sessions.*, tasks.role AS task_role
      FROM sessions JOIN tasks ON tasks.id = sessions.task_id
      WHERE sessions.id = ? AND sessions.ended_at IS NULL
    `).get(input.sessionId) as Row | undefined
    if (!row) throw new Error('找不到進行中的專注。')

    const endedAt = nowIso()
    const seconds = effectiveSeconds(String(row.started_at), endedAt, Number(row.paused_seconds))
    const daily = this.db.prepare(`SELECT COALESCE(SUM(earned_light), 0) AS total FROM sessions WHERE local_day = ?`).get(localDay()) as Row
    const earnedLight = calculateLight(seconds, Number(row.minimum_minutes), Number(daily.total))
    const completed = input.outcome === 'completed'
    const isMain = row.task_role === 'main'
    const lootIndex = Number((this.db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE ended_at IS NOT NULL').get() as Row).count) % LOOT.length
    const loot = completed ? LOOT[lootIndex] : null
    let storyAdvanced = false

    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE sessions SET ended_at = ?, outcome = ?, earned_light = ?, suspended_at = NULL WHERE id = ?
      `).run(endedAt, input.outcome, earnedLight, input.sessionId)

      if (completed) {
        this.db.prepare("UPDATE steps SET status = 'done' WHERE id = ?").run(row.step_id)
        const pending = this.db.prepare("SELECT COUNT(*) AS count FROM steps WHERE task_id = ? AND status = 'pending'").get(row.task_id) as Row
        if (Number(pending.count) === 0) {
          this.db.prepare("UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?").run(endedAt, row.task_id)
        } else {
          this.db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(endedAt, row.task_id)
        }
      }

      const current = this.db.prepare('SELECT * FROM rpg_state WHERE id = 1').get() as Row
      const node = isMain && completed ? Math.min(12, Number(current.node) + 1) : Number(current.node)
      storyAdvanced = node > Number(current.node)
      this.db.prepare(`
        UPDATE rpg_state SET
          node = ?, light = light + ?, star_pages = star_pages + ?, materials = materials + ?, last_loot = ?
        WHERE id = 1
      `).run(node, earnedLight, Number(isMain && completed), Number(!isMain && completed), loot)
      this.recordEvent('focus_ended', {
        effectiveSeconds: seconds,
        minimumReached: seconds >= Number(row.minimum_minutes) * 60,
        completed,
        blocked: input.outcome === 'blocked',
        earnedLight
      })
    })
    transaction()

    const sessionRow = this.db.prepare(`
      SELECT sessions.*, tasks.title AS task_title, steps.text AS step_text
      FROM sessions JOIN tasks ON tasks.id = sessions.task_id JOIN steps ON steps.id = sessions.step_id
      WHERE sessions.id = ?
    `).get(input.sessionId) as Row
    return {
      session: this.sessionFromRow(sessionRow),
      earnedLight,
      earnedStarPage: isMain && completed,
      earnedMaterial: !isMain && completed,
      loot,
      storyAdvanced
    }
  }

  saveBlockRules(apps: RunningApplication[]): AppSnapshot {
    const transaction = this.db.transaction(() => {
      this.db.prepare('UPDATE block_rules SET enabled = 0').run()
      const statement = this.db.prepare(`
        INSERT INTO block_rules (id, process_name, display_name, enabled, created_at)
        VALUES (@id, @processName, @displayName, 1, @createdAt)
        ON CONFLICT(process_name) DO UPDATE SET display_name = excluded.display_name, enabled = 1
      `)
      for (const app of apps) {
        statement.run({ id: randomUUID(), processName: app.processName.toLowerCase(), displayName: app.displayName, createdAt: nowIso() })
      }
    })
    transaction()
    return this.getSnapshot()
  }

  private enableOnlyBlockRules(processNames: string[]): void {
    const normalized = new Set(processNames.map((name) => name.toLowerCase()))
    const rows = this.db.prepare('SELECT process_name FROM block_rules').all() as Row[]
    const statement = this.db.prepare('UPDATE block_rules SET enabled = ? WHERE process_name = ?')
    const transaction = this.db.transaction(() => {
      for (const row of rows) statement.run(Number(normalized.has(String(row.process_name).toLowerCase())), row.process_name)
    })
    transaction()
  }

  updateSettings(patch: Partial<AppSettings>): AppSnapshot {
    const current = this.getSnapshot().settings
    const next = { ...current, ...patch }
    this.db.prepare(`
      UPDATE settings SET reminder_policy = @reminderPolicy, evening_reminder = @eveningReminder,
      mini_timer = @miniTimer, phone_ritual = @phoneRitual, coat_color = @coatColor, lantern_color = @lanternColor
      WHERE id = 1
    `).run({ ...next, miniTimer: Number(next.miniTimer), phoneRitual: Number(next.phoneRitual) })
    return this.getSnapshot()
  }

  makeRpgChoice(choice: RpgChoice): AppSnapshot {
    const row = this.db.prepare('SELECT light FROM rpg_state WHERE id = 1').get() as Row
    if (Number(row.light) < 1) throw new Error('至少需要一點燈火才能修復檔案館。')
    this.db.prepare('UPDATE rpg_state SET light = light - 1, ability = ? WHERE id = 1').run(choice)
    this.recordEvent('rpg_choice', { restore: choice === 'restore', illuminate: choice === 'illuminate', catalogue: choice === 'catalogue' })
    return this.getSnapshot()
  }

  private recordEvent(name: string, numericPayload: Record<string, number | boolean>): void {
    this.db.prepare('INSERT INTO events (id, name, created_at, numeric_payload) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), name, nowIso(), JSON.stringify(numericPayload))
  }

  exportBackup(): BackupPayload {
    const tables = ['tasks', 'steps', 'sessions', 'block_rules', 'rpg_state', 'settings', 'events']
    const data: Record<string, unknown[]> = {}
    for (const table of tables) data[table] = this.db.prepare(`SELECT * FROM ${table}`).all()
    return { format: 'focusquest-backup', version: 1, exportedAt: nowIso(), data }
  }

  importBackup(payload: BackupPayload): void {
    if (payload.format !== 'focusquest-backup' || payload.version !== 1 || !payload.data) {
      throw new Error('這不是有效的 Focus Quest 備份。')
    }
    const tableColumns: Record<string, string[]> = {
      tasks: ['id', 'title', 'role', 'kind', 'progress_definition', 'obstacle', 'deadline', 'cue_type', 'cue_value', 'scheduled_date', 'status', 'created_at', 'updated_at'],
      steps: ['id', 'task_id', 'text', 'position', 'status'],
      sessions: ['id', 'task_id', 'step_id', 'started_at', 'ended_at', 'minimum_minutes', 'paused_seconds', 'suspended_at', 'outcome', 'blocked_attempts', 'earned_light', 'local_day'],
      block_rules: ['id', 'process_name', 'display_name', 'enabled', 'created_at'],
      rpg_state: ['id', 'chapter', 'node', 'light', 'star_pages', 'materials', 'ability', 'last_loot'],
      settings: ['id', 'reminder_policy', 'evening_reminder', 'mini_timer', 'phone_ritual', 'coat_color', 'lantern_color'],
      events: ['id', 'name', 'created_at', 'numeric_payload']
    }
    const transaction = this.db.transaction(() => {
      for (const table of ['events', 'sessions', 'steps', 'tasks', 'block_rules', 'rpg_state', 'settings']) this.db.prepare(`DELETE FROM ${table}`).run()
      for (const [table, columns] of Object.entries(tableColumns)) {
        const rows = payload.data[table]
        if (!Array.isArray(rows)) throw new Error(`備份缺少 ${table} 資料。`)
        const placeholders = columns.map((column) => `@${column}`).join(', ')
        const insert = this.db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
        for (const row of rows) insert.run(row as Row)
      }
    })
    transaction()
  }

  analyticsCsv(): string {
    const rows = this.db.prepare('SELECT name, created_at, numeric_payload FROM events ORDER BY created_at').all() as Row[]
    const header = 'event,created_at,numeric_payload'
    const body = rows.map((row) => {
      const payload = String(row.numeric_payload).replaceAll('"', '""')
      return `"${String(row.name)}","${String(row.created_at)}","${payload}"`
    })
    return [header, ...body].join('\r\n')
  }
}
