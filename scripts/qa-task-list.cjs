// Backend/preload smoke check. Uses a new temporary profile; all windows stay hidden.
// Run with node_modules/.bin/electron.cmd after electron-vite build (no packaging).
// Set FOCUSQUEST_QA_BUNDLE to a packaged app.asar to verify the actual shipped code/native dependency.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { tmpdir } = require('node:os')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const bundle = process.env.FOCUSQUEST_QA_BUNDLE ? path.resolve(process.env.FOCUSQUEST_QA_BUNDLE) : root
const Database = require(path.join(bundle, 'node_modules', 'better-sqlite3'))
const data = fs.mkdtempSync(path.join(tmpdir(), 'focusquest-task-list-qa-'))
const out = path.join(root, 'previews', bundle === root ? 'task-list-backend-qa' : 'task-list-shipped-qa')
process.env.FOCUSQUEST_QA_USER_DATA = data
delete process.env.FOCUSQUEST_QA_SEED
delete process.env.FOCUSQUEST_QA_EXPEDITION
delete process.env.FOCUSQUEST_QA_VIEW
BrowserWindow.prototype.show = function () {}
const report = { data, bundle, version: require(path.join(bundle, 'package.json')).version, checks: [], errors: [] }
if (bundle !== root) {
  assert.equal(report.version, require(path.join(root, 'package.json')).version)
  const hash = (file) => require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  for (const file of ['out/main/index.js', 'out/preload/index.js']) {
    assert.equal(hash(path.join(bundle, file)), hash(path.join(root, file)))
  }
  report.checks.push('Shipped version/main/preload match build; SQLite loaded from packaged native dependency')
}
let win, sql
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(fn) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) { if (await fn()) return; await delay(100) }
  throw new Error('Timed out waiting for QA app')
}
const execute = (source) => win.webContents.executeJavaScript(source, true)
// JSON is passed directly to JS in the isolated renderer, never interpolated into a shell.
const call = (name, ...args) => execute(`window.focusQuest[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
require(path.join(bundle, 'out', 'main', 'index.js'))
;(async () => {
  await app.whenReady()
  await until(() => {
    // Both windows inherit index.html's title; only the main view ends in #/.
    win = BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().endsWith('#/'))
    return win && !win.webContents.isLoading()
  })
  win.webContents.setBackgroundThrottling(false)
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(() => execute('Boolean(window.focusQuest?.addListTask)'))
  await execute('window.__taskListUpdates = []; window.focusQuest.onSnapshotChanged(s => window.__taskListUpdates.push(s.taskList)); true')
  let s = await call('addListTask', { title: 'QA 第一件' })
  const first = s.taskList.nextTaskId
  s = await call('addListTask', { title: 'QA 第二件' })
  const second = s.taskList.today.find((task) => task.id !== first).id
  s = await call('reorderTodayTasks', s.taskList.localDay, [second, first])
  assert.equal(s.taskList.nextTaskId, second)
  await call('renameListTask', second, 'QA 更新名稱')
  s = await call('saveRoutines', [{ title: 'QA 每日例行', weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true }])
  assert.equal(s.taskList.today.filter((task) => task.routineId).length, 1)
  assert.equal((await call('getSnapshot')).taskList.today.length, 3)
  await until(async () => (await execute('window.__taskListUpdates.length')) >= 5)
  assert.equal(await execute('window.__taskListUpdates.at(-1).routines.length'), 1)
  report.checks.push('Real preload/IPC accepts title-only items, ordering, rename and routine save; snapshot updates reach renderer')

  s = await call('startDailyRun', second)
  const node = s.expeditionNodes.find((entry) => entry.plannedMinutes === 50)
  assert(node)
  await call('selectExpeditionNode', s.todayRun.id, node.id)
  s = await call('startListFocus', { minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun.id, nodeId: node.id, plannedMinutes: 50 })
  assert.equal(s.activeSession.taskId, second)
  const sessionId = s.activeSession.id
  await until(() => execute("Boolean(document.querySelector('.focus-active canvas'))"))
  await delay(3000)
  assert.equal(await execute("Boolean(document.querySelector('.cloud-ruins-fallback'))"), false)
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'focus.png'), (await win.webContents.capturePage()).toPNG())
  report.checks.push('Shipped Focus scene renders a canvas without scene fallback')
  sql = new Database(path.join(data, 'focusquest.db'))
  sql.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(new Date(Date.now() - 600000).toISOString(), sessionId)
  s = await call('finishListFocus', sessionId, false)
  assert.equal(s.taskList.nextTaskId, second)
  assert.equal(s.pendingDebrief.resolution, 'partial')
  await call('dismissDebrief', sessionId)
  const sibling = s.expeditionNodes.find((entry) => entry.id !== node.id)
  await assert.rejects(call('selectExpeditionNode', s.todayRun.id, sibling.id), /先完成目前地圖/)
  report.checks.push('First list item binds Focus; one-question review preserves partial progress; partial route switching is rejected')

  await call('setListTaskDone', second, true)
  // Only this isolated fixture's dates are edited; production user data is never opened.
  sql.prepare('UPDATE tasks SET scheduled_date = ? WHERE id = ?').run('2020-01-01', first)
  s = await call('getSnapshot')
  assert.equal(s.taskList.yesterday[0].id, first)
  await call('moveTasksToToday', [first])
  sql.prepare('UPDATE tasks SET scheduled_date = ? WHERE id = ?').run('2020-01-01', first)
  s = await call('getSnapshot')
  await assert.rejects(call('deleteYesterdayTasks', { localDay: s.taskList.localDay, taskIds: [first], confirmation: 'yes' }), /請輸入/)
  s = await call('deleteYesterdayTasks', { localDay: s.taskList.localDay, taskIds: [first], confirmation: '刪除昨天全部未完成事項' })
  assert.equal(s.taskList.yesterday.length, 0)
  assert.equal(s.recentSessions[0].id, sessionId)
  report.checks.push('Move-to-today and confirmed bulk deletion work over IPC without losing session history')

  const before = s.taskList
  const loaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
  win.webContents.reload()
  await loaded
  assert.deepEqual((await call('getSnapshot')).taskList, before)
  await until(() => execute("Boolean(document.querySelector('.app-shell'))"))
  await delay(1000)
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
  report.checks.push('Renderer reload preserves list/routines; no renderer errors; no window or production profile changed')
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'lobby.png'), (await win.webContents.capturePage()).toPNG())
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
  sql.close()
  app.exit(0)
})().catch((error) => {
  report.failure = String(error.stack)
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.error(error)
  sql?.close()
  app.exit(1)
})
