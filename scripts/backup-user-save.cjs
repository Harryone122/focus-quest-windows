// Make a consistent, read-only SQLite backup before switching the installed app.
const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')

const version = require('../package.json').version
const userData = path.join(process.env.APPDATA, 'focus-quest-windows')
const source = path.join(userData, 'focusquest.db')
if (!fs.existsSync(source)) throw new Error('Focus Quest save not found')
const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-')
const directory = path.join(userData, `backup-before-${version}-${stamp}`)
fs.mkdirSync(directory, { recursive: false })
const destination = path.join(directory, 'focusquest.db')

;(async () => {
  const db = new Database(source, { readonly: true })
  try { await db.backup(destination) } finally { db.close() }
  const saved = new Database(destination, { readonly: true })
  const integrity = saved.pragma('integrity_check', { simple: true })
  const sessions = saved.prepare('SELECT COUNT(*) AS count FROM sessions').get().count
  const nodes = saved.prepare('SELECT COUNT(*) AS count FROM expedition_nodes').get().count
  const tasks = saved.prepare('SELECT COUNT(*) AS count FROM tasks').get().count
  saved.close()
  if (integrity !== 'ok') throw new Error(`Backup integrity check failed: ${integrity}`)
  const report = { Directory: directory, integrity, sessions, nodes, tasks }
  const output = path.resolve(__dirname, '../previews', `release-v${version}-qa`, 'user-save-backup.json')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch((error) => { console.error(error); process.exitCode = 1 })
