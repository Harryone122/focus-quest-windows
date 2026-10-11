// Read-only continuity check around switching the user's running build. Never changes the database.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const out = path.resolve(__dirname, process.env.FOCUSQUEST_QA_SAVE_OUT || '../previews/area02-port-qa')
fs.mkdirSync(out, { recursive: true })
const db = new Database(path.join(process.env.APPDATA, 'focus-quest-windows', 'focusquest.db'), { readonly: true })
const state = {
  sessions: db.prepare('SELECT id, node_id, started_at, ended_at, paused_seconds, manual_paused, suspended_at, system_paused FROM sessions ORDER BY id').all(),
  nodes: db.prepare('SELECT id, state, progress_seconds, planned_minutes FROM expedition_nodes ORDER BY id').all(),
  tasks: db.prepare('SELECT id, status, deleted_at FROM tasks ORDER BY id').all(),
  runs: db.prepare('SELECT id, selected_node_id, status FROM daily_runs ORDER BY id').all()
}
db.close()
const phase = process.argv[2]
assert(['before', 'after'].includes(phase))
fs.writeFileSync(path.join(out, `user-save-${phase}.json`), JSON.stringify(state, null, 2))
if (phase === 'after') {
  const before = JSON.parse(fs.readFileSync(path.join(out, 'user-save-before.json'), 'utf8'))
  const backupInfo = JSON.parse(fs.readFileSync(path.join(out, 'user-save-backup.json'), 'utf8').replace(/^\uFEFF/, ''))
  const backup = new Database(path.join(backupInfo.Directory, 'focusquest.db'), { readonly: true })
  const pauseResumptions = []
  for (const old of before.sessions) {
    const savedPause = backup.prepare('SELECT suspended_at, system_paused FROM sessions WHERE id = ?').get(old.id)
    Object.assign(old, savedPause)
    const current = state.sessions.find(row => row.id === old.id)
    if (!old.ended_at && old.system_paused && !old.manual_paused && !current.system_paused && !current.suspended_at) {
      const resumedAt = Date.parse(old.suspended_at) + (current.paused_seconds - old.paused_seconds) * 1000
      assert(resumedAt >= fs.statSync(path.join(out, 'user-save-before.json')).mtimeMs - 2000 && resumedAt <= Date.now(), 'Only the saved system pause was settled on startup')
      pauseResumptions.push({ id: old.id, resumedAt: new Date(resumedAt).toISOString(), settledPauseSeconds: current.paused_seconds - old.paused_seconds })
      old.paused_seconds = current.paused_seconds; old.suspended_at = null; old.system_paused = 0
    }
  }
  backup.close()
  fs.writeFileSync(path.join(out, 'user-save-resumption.json'), JSON.stringify(pauseResumptions, null, 2))
  for (const table of ['sessions', 'nodes', 'tasks', 'runs']) {
    for (const old of before[table]) assert.deepEqual(state[table].find(row => row.id === old.id), old, `Saved ${table} ${old.id} preserved`)
  }
}
console.log(JSON.stringify({ phase, sessions: state.sessions.length, nodes: state.nodes.length, tasks: state.tasks.length, activeSessions: state.sessions.filter(row => !row.ended_at).length, preserved: phase === 'after' }))
