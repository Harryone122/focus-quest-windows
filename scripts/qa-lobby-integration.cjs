// Real renderer + preload + SQLite in a disposable profile, optionally from shipped ASAR.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), bundle = process.env.FOCUSQUEST_QA_BUNDLE || root
const Database = require(path.join(bundle, 'node_modules/better-sqlite3'))
const data = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-lobby-integration-'))
const out = path.join(root, 'previews', bundle === root ? 'lobby-integration' : 'lobby-shipped')
fs.mkdirSync(out, { recursive: true })
process.env.FOCUSQUEST_QA_USER_DATA = data
for (const key of ['FOCUSQUEST_QA_SEED', 'FOCUSQUEST_QA_EXPEDITION', 'FOCUSQUEST_QA_VIEW']) delete process.env[key]
const report = { data, bundle, version: require(path.join(bundle, 'package.json')).version, checks: [], errors: [] }
if (bundle !== root) {
  const hash = (file) => require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  for (const file of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html']) assert.equal(hash(path.join(bundle, file)), hash(path.join(root, file)))
}
BrowserWindow.prototype.show = function () {} // Only the test main window is shown explicitly below.
let win, sql
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const js = (source) => win.webContents.executeJavaScript(source, true)
const call = (name, ...args) => js(`window.focusQuest[${JSON.stringify(name)}](...${JSON.stringify(args)})`)
async function until(fn, label = 'condition') {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) { if (await fn()) return; await delay(100) }
  throw new Error(`Timeout: ${label}`)
}
const has = (selector) => js(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
async function click(selector) {
  await until(() => js(`!!document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`), selector)
  await js(`document.querySelector(${JSON.stringify(selector)}).click(); true`)
  await delay(180)
}
async function textInput(selector, value) {
  await js(`{ const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', {bubbles:true})); }`)
}
async function addTask(title) {
  await textInput('.la-add input', title)
  await js(`document.querySelector('.la-add input').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true})); true`)
  await until(async () => (await call('getSnapshot')).taskList.today.some((task) => task.title === title), 'task saved')
}
async function capture(name) {
  win.showInactive()
  await delay(1100)
  fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG())
}
async function reload() {
  const loaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
  win.webContents.reload(); await loaded
  await until(() => has('.lobby-a-scene canvas'), 'lobby after reload')
}
async function depart() {
  await click('.la-panel .la-primary')
  await until(() => has('.la-depart'), 'departure sheet')
  if (await has('.la-depart-phone input')) await click('.la-depart-phone input')
  await click('.la-depart-actions .la-primary')
  await until(() => has('.focus-active canvas'), 'focus canvas')
}
require(path.join(bundle, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win = BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().endsWith('#/')); return win && !win.webContents.isLoading() }, 'main')
  win.webContents.setBackgroundThrottling(false)
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  win.showInactive()
  await until(() => has('.lobby-a-scene canvas'), 'real lobby')
  assert.equal(await has('.lobby-a-fallback'), false)
  await capture('01-empty')
  await addTask('QA 寫作')
  await addTask('QA 閱讀')
  await until(async () => Boolean((await call('getSnapshot')).todayRun), 'real journey')
  let s = await call('getSnapshot')
  const writingId = s.taskList.today[0].id, readingId = s.taskList.today[1].id
  await js(`Array.from(document.querySelectorAll('button')).find(el=>el.innerText==='調整順序').click(); true`)
  await click('button[aria-label="把「QA 閱讀」往上移"]')
  await until(async () => (await call('getSnapshot')).taskList.nextTaskId === readingId)
  await click('button[aria-label="把「QA 閱讀」往下移"]')
  await until(async () => (await call('getSnapshot')).taskList.nextTaskId === writingId)
  const route = s.expeditionNodes.find((node) => node.plannedMinutes === 50)
  const routeIndex = s.expeditionNodes.filter((node) => node.parentNodeId === null).findIndex((node) => node.id === route.id)
  await click(`.la-route:nth-child(${routeIndex + 1})`)
  await until(async () => (await call('getSnapshot')).todayRun.selectedNodeId === route.id)
  assert.equal((await call('getSnapshot')).activeSession, null)
  await capture('02-selected-glass-rail')
  await click('.la-panel .la-primary'); await capture('03-departure')
  await click('.la-depart-actions .la-link')
  assert.equal((await call('getSnapshot')).activeSession, null)
  report.checks.push('Empty profile creates real title-only items and persisted routes; selection/confirmation cancel never starts Focus')

  await js(`Array.from(document.querySelectorAll('.la-panel-foot button')).find(el => el.innerText.includes('例行事項')).click(); true`)
  await until(() => has('.la-routine-new input'))
  await textInput('.la-routine-new input', 'QA 每日整理')
  await js(`document.querySelectorAll('.la-routine-new .la-days button').forEach(el=>el.click()); true`)
  await click('.la-routine-new .la-primary')
  await until(async () => (await call('getSnapshot')).taskList.routines.length === 1)
  await capture('04-routines')
  await click('.la-routines > .la-link')
  await call('addListTask', { title: 'QA 昨天事項' })
  s = await call('getSnapshot')
  const yesterdayId = s.taskList.today.find((task) => task.title === 'QA 昨天事項').id
  sql = new Database(path.join(data, 'focusquest.db'))
  sql.prepare('UPDATE tasks SET scheduled_date = ? WHERE id = ?').run('2026-09-20', yesterdayId)
  await reload()
  await js(`Array.from(document.querySelectorAll('button')).find(el=>el.innerText.includes('昨天沒做完')).click(); true`)
  await until(() => has('.la-yesterday'))
  await capture('05-yesterday')
  await click('.la-yesterday .la-task .la-link')
  await until(async () => (await call('getSnapshot')).taskList.yesterday.length === 0)
  assert.equal((await call('getSnapshot')).taskList.today.filter((task) => task.routineId).length, 1)
  report.checks.push('Real routine editor generates one daily item; yesterday tab displays original date and moves it to today; reload persists state')
  await call('addListTask', { title: 'QA 待刪昨日事項' })
  const deleteId = (await call('getSnapshot')).taskList.today.find((task) => task.title === 'QA 待刪昨日事項').id
  sql.prepare('UPDATE tasks SET scheduled_date = ? WHERE id = ?').run('2026-09-20', deleteId)
  await reload()
  await js(`Array.from(document.querySelectorAll('button')).find(el=>el.innerText.includes('昨天沒做完')).click(); true`)
  await click('.la-yesterday-actions .danger')
  assert.equal((await call('getSnapshot')).taskList.yesterday.length, 1)
  await click('.la-confirm .danger')
  await until(async () => (await call('getSnapshot')).taskList.yesterday.length === 0)
  report.checks.push('UI ordering changes backend next work; yesterday bulk removal only executes after explicit confirmation')

  await depart()
  s = await call('getSnapshot'); let sessionId = s.activeSession.id
  assert.equal(s.activeSession.taskId, writingId)
  await click('.focus-pause-button')
  await until(async () => (await call('getSnapshot')).activeSession.manuallyPaused)
  await capture('06-paused-focus')
  await click('.focus-pause-button')
  await until(async () => !(await call('getSnapshot')).activeSession.manuallyPaused)
  sql.prepare('UPDATE sessions SET started_at = ?, paused_seconds = 0 WHERE id = ?').run(new Date(Date.now()-600000).toISOString(), sessionId)
  await click('.focus-end-button')
  await until(() => has('.af-question'))
  await capture('07-one-question')
  await click('.af-answer:not(.done)')
  await until(() => has('.af-foot'))
  await capture('08-partial-review')
  await click('.af-foot .la-primary')
  await until(() => has('.la-panel'))
  assert.equal(await has('.la-route'), false)
  await capture('09-continue-lobby')
  report.checks.push('UI departure binds work/route; pause and resume persist; ending asks one question; unfinished item and partial map resume without route switching')

  await depart()
  s = await call('getSnapshot'); sessionId = s.activeSession.id
  sql.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(new Date(Date.now()-3000000).toISOString(), sessionId)
  await click('.focus-end-button'); await until(() => has('.af-question'))
  await click('.af-answer.done'); await until(() => has('.af-foot'))
  await capture('10-complete-review')
  await click('.af-foot .la-primary'); await until(() => has('.la-route'))
  await capture('11-rest-and-exits')
  s = await call('getSnapshot')
  assert.equal(s.pendingDebrief, null)
  assert.equal(s.taskList.nextTaskId, readingId)
  assert.equal(s.taskList.today.find((task) => task.id === writingId).completed, true)
  await until(() => has('.la-find-pin'))
  await click('.la-find-pin'); await click('.la-find-sheet .la-primary')
  await until(async () => (await call('getSnapshot')).seenFindIds.length > 0)
  await reload()
  assert((await call('getSnapshot')).seenFindIds.length > 0)
  const routesBefore = (await call('getSnapshot')).expeditionNodes
  const parentId = s.todayRun.selectedNodeId
  const child = routesBefore.find((node) => node.parentNodeId === parentId && node.departureExitId === 'exit_pines')
  await js(`Array.from(document.querySelectorAll('.la-route')).find(el=>el.innerText.includes('松林出口')).click(); true`)
  await until(async () => (await call('getSnapshot')).todayRun.selectedNodeId === child.id)
  await capture('12-next-selected')
  await js(`document.querySelector('.la-route').focus(); true`)
  await delay(1500); await capture('12b-look-at-exit')
  await js(`document.activeElement.blur(); true`)
  report.checks.push('Full map returns to resting lobby; item completion advances work; discovery acknowledgement persists; next exit is selected without starting Focus')

  win.setSize(1040, 700); await delay(1000)
  await capture('13-small-lobby')
  const bounds = await js(`(() => { const rail=document.querySelector('.sidebar').getBoundingClientRect(),scene=document.querySelector('.lobby-a-scene').getBoundingClientRect(),panel=document.querySelector('.la-panel').getBoundingClientRect();return {railLeft:rail.left,railRight:rail.right,sceneLeft:scene.left,panelRight:panel.right,width:innerWidth} })()`)
  assert.equal(bounds.sceneLeft, 0); assert.equal(bounds.railLeft, 0); assert(bounds.panelRight <= bounds.width + 1)
  await click('.la-panel .la-primary'); await capture('14-small-departure'); await click('.la-depart-actions .la-link')
  await click('nav button[aria-label="任務"]'); await until(() => has('.page-heading.compact-heading'))
  await capture('15-paper-rail-library')
  await click('nav button[aria-label="今天"]'); await until(() => has('.la-panel'))
  await depart()
  assert.equal((await call('getSnapshot')).activeSession.departure.exit, 'exit_pines')
  report.checks.push('1040x700 scene extends under glass rail; paper navigation retained outside lobby; second map receives the chosen exit cue')
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report)); sql.close(); app.exit(0)
})().catch(async (error) => {
  report.failure = String(error.stack)
  if (win && !win.isDestroyed()) { report.body = await js('document.body.innerText').catch(String); await capture('failure').catch(()=>{}) }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.error(error); sql?.close(); app.exit(1)
})
