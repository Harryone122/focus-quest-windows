// Runs the production main/preload with an isolated SQLite profile. No user saves are touched.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'previews', 'moss-backend-qa')
fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-moss-ipc-'))
process.env.FOCUSQUEST_QA_USER_DATA = profile
process.env.FOCUSQUEST_QA_SEED = '1'
process.env.FOCUSQUEST_QA_EXPEDITION = 'selected'
process.env.FOCUSQUEST_QA_VIEW = 'focus'
const report = { profile, checks: [], errors: [] }
let win, sql
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const js = source => win.webContents.executeJavaScript(source, true)
const call = (method, ...args) => js(`window.focusQuest[${JSON.stringify(method)}](...${JSON.stringify(args)})`)
const snapshot = () => call('getSnapshot')
async function until(fn) {
  const end = Date.now() + 30000
  while (Date.now() < end) { if (await fn()) return; await delay(150) }
  throw Error('QA timeout')
}
require(path.join(root, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(async () => { win = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'Focus Quest'); return !!win })
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(() => js("!!document.querySelector('.focus-active canvas')"))
  await delay(1500)
  fs.writeFileSync(path.join(output, 'forest-regression.png'), (await win.webContents.capturePage()).toPNG())
  report.checks.push('Existing forest Focus scene starts with the new backend and no renderer errors')
  // Area 02 renderer is not delivered. Exercise its real IPC on a blank renderer,
  // never misrepresent the forest canvas as an integrated moss-station scene.
  win.hide()
  await win.loadURL('about:blank')
  sql = new Database(path.join(profile, 'focusquest.db'))
  let s = await snapshot(), first = s.activeSession.id
  sql.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(new Date(Date.now() - 3001000).toISOString(), first)
  await call('beginSessionDebrief', first)
  s = await call('finishListFocus', first, false)
  const from = s.pendingDebrief.nodeId
  const next = s.expeditionNodes.find(node => node.parentNodeId === from)
  sql.prepare('UPDATE expedition_nodes SET area_id = ?, planned_minutes = 50 WHERE id = ?').run('area-02-moss-station', next.id)
  await call('chooseNextRoute', s.todayRun.id, from, next.id)
  s = await call('startListFocus', { minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun.id, nodeId: next.id, plannedMinutes: 50 })
  const id = s.activeSession.id
  sql.prepare('UPDATE forest_explorations SET journey_item = ?, journey_lamp = 1, guaranteed_lamp = 1 WHERE node_id = ?').run('charcoal_rubbing', next.id)
  sql.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(new Date(Date.now() - 650000).toISOString(), id)
  await until(async () => (await snapshot()).specialFinds.filter(find => find.nodeId === next.id).length === 2)
  s = await snapshot()
  assert.deepEqual(s.specialFinds.filter(find => find.nodeId === next.id).map(find => find.itemKey), ['charcoal_rubbing', 'cracked_compass'])
  const scene = await call('getMossScene', next.id)
  assert.equal(scene.areaId, 'area-02-moss-station')
  assert.equal(scene.coreTaken, true)
  assert.equal(scene.litLampCount, 1)
  assert(scene.action && Number.isInteger(scene.weatherSeed))
  const walk = (await call('getMossScene', next.id)).action
  assert.equal(walk.kind, 'walk', 'The controlled first-lamp find is still being approached')
  if (walk.kind === 'walk') {
    assert.equal(walk.plan.path[0], walk.route[0])
    assert.equal(walk.plan.path.at(-1), walk.plan.destination)
    assert.equal(walk.plan.legEndSeconds.length, walk.plan.path.length - 1)
    assert.equal(walk.plan.legEndSeconds[0], walk.endSeconds)
  }
  report.checks.push('Real timer saves map-specific rewards and broadcasts mossStation; preload getMossScene returns authoritative actions/weather')
  await call('pauseFocus', id)
  const paused = await call('getMossScene', next.id)
  await delay(2200)
  assert.deepEqual(await call('getMossScene', next.id), paused)
  await win.reload()
  await until(() => js('!!window.focusQuest'))
  assert.deepEqual(await call('getMossScene', next.id), paused)
  report.checks.push('Manual pause and renderer reload preserve the complete saved moss scene state')
  await call('resumeFocus', id)
  sql.prepare('UPDATE sessions SET started_at = ?, paused_seconds = 0 WHERE id = ?').run(new Date(Date.now() - 3700000).toISOString(), id)
  await until(async () => (await call('getMossScene', next.id)).worldMarks.bench_tea_seen)
  s = await call('beginSessionDebrief', id)
  s = await call('finishListFocus', id, false)
  assert.equal(s.expeditionNodes.find(node => node.id === next.id).state, 'awaiting_route')
  assert.equal(s.runRelics.length, 0)
  const exits = s.expeditionNodes.filter(node => node.parentNodeId === next.id)
  assert.deepEqual(exits.map(node => node.mossExitId).sort(), ['exit_boat', 'exit_tunnel'])
  await call('chooseNextRoute', s.todayRun.id, next.id, exits[0].id)
  s = await call('startListFocus', { minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun.id,
    nodeId: exits[0].id, plannedMinutes: exits[0].plannedMinutes })
  const departure = await call('getMossDeparture', s.activeSession.id)
  assert.equal(departure.durationMs, 5000)
  assert.equal(departure.fromAreaId, 'area-02-moss-station')
  assert.equal(departure.route.at(-1), departure.exit)
  report.checks.push('Full exploration persists bench memory, skips duplicate relic choice and maps both real exits; departure IPC returns a five-second cue')
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
  sql.close(); app.exit(0)
})().catch(error => {
  report.failure = String(error.stack)
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  console.error(error); sql?.close(); app.exit(1)
})
