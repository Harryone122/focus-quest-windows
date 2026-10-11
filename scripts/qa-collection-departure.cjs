// Disposable-profile Electron check for Collection Room navigation, clue pinning, and the first departure.
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const bundle = process.env.FOCUSQUEST_QA_BUNDLE ? path.resolve(process.env.FOCUSQUEST_QA_BUNDLE) : root
const Database = require(path.join(bundle, 'node_modules', 'better-sqlite3'))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-collection-departure-'))
process.env.FOCUSQUEST_QA_USER_DATA = profile
const out = path.join(root, 'previews', bundle === root ? 'collection-departure-qa' : 'collection-departure-qa-shipped')
fs.mkdirSync(out, { recursive: true })
const report = { profile, bundle, checks: [], errors: [] }
if (bundle !== root) {
  const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  assert.equal(require(path.join(bundle, 'package.json')).version, require(path.join(root, 'package.json')).version)
  for (const file of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html']) {
    assert.equal(hash(path.join(bundle, file)), hash(path.join(root, file)), `Packaged ${file} differs from tested build`)
  }
  report.checks.push('Packaged main, preload, and renderer entry match the tested build')
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let win
const js = (source) => win.webContents.executeJavaScript(source, true)
const until = async (check, label, ms = 30000) => {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await check()) return; await delay(50) }
  throw new Error(`Timeout: ${label}`)
}
const shot = async (name) => fs.writeFileSync(path.join(out, `${name}.png`), (await win.webContents.capturePage()).toPNG())
const originalShow = BrowserWindow.prototype.show
BrowserWindow.prototype.show = function () {
  if (this.getTitle() === 'Focus Quest') {
    const primary = screen.getPrimaryDisplay()
    const secondary = screen.getAllDisplays().find((display) => display.id !== primary.id)
    if (secondary) {
      const area = secondary.workArea, bounds = this.getBounds()
      this.setBounds({ x: area.x + 20, y: area.y + 20, width: Math.min(bounds.width, area.width - 40), height: Math.min(bounds.height, area.height - 40) })
      report.checks.push('QA window opened on the secondary display')
    }
  }
  return originalShow.call(this)
}

require(path.join(bundle, 'out', 'main', 'index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win = BrowserWindow.getAllWindows().find((item) => item.getTitle() === 'Focus Quest'); return Boolean(win) }, 'main window')
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(() => js('Boolean(document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire)'), 'campfire ready')
  await until(() => js('Boolean(document.querySelector(".collection-room-view iframe"))'), 'collection frame')
  await until(() => js('!!document.querySelector(".collection-room-view iframe").contentWindow.__room'), 'collection preloaded')
  const roomFrame = await js('window.__qaRoom = document.querySelector(".collection-room-view iframe"); true')
  assert(roomFrame)
  await js('document.querySelector(`.sidebar nav button[aria-label="收藏室"]`).click(); true')
  await until(() => js('document.querySelector(`.sidebar nav button[aria-label="收藏室"]`)?.getAttribute("aria-current") === "page" && !document.querySelector(".collection-room-view").classList.contains("is-hidden") && document.querySelector(".shell-today-layer").classList.contains("is-hidden")'), 'collection visible')
  await delay(200)
  await shot('01-collection-open')
  await js('document.querySelector(`.sidebar nav button[aria-label="今天"]`).click(); true')
  await js('document.querySelector(`.sidebar nav button[aria-label="收藏室"]`).click(); true')
  assert.equal(await js('window.__qaRoom === document.querySelector(".collection-room-view iframe")'), true)
  report.checks.push('Collection reuses the preloaded 3D frame across navigation')

  const rows = [
    ['h1a', 'way', 'm01', 'h1', '雲上遺庭 · 古井', '井底的倒影裡有一串燈。'],
    ['h1b', 'way', 'm02', 'h1', '苔痕驛站 · 小舟', '溪尾漂來一盞熄掉的提燈。'],
    ['h1c', 'look', 'm02', 'h1', '苔痕驛站 · 住宿簿', '住宿簿夾著一張半沉在水裡的提燈。']
  ]
  const db = new Database(path.join(profile, 'focusquest.db'))
  const insert = db.prepare('INSERT INTO collection_clues (id,kind,source_id,place_id,source_label,text,acquired_at,pinned_at) VALUES (?,?,?,?,?,?,?,NULL)')
  for (const row of rows) insert.run(...row, new Date().toISOString())
  db.close()
  win.webContents.reload()
  await until(() => js('Boolean(document.querySelector(".collection-room-view iframe")?.contentWindow?.__room?.S.tray.includes("h1c"))'), 'three clues loaded')
  await js('document.querySelector(`.sidebar nav button[aria-label="收藏室"]`).click(); true')
  await until(() => js('document.querySelector(".collection-room-view iframe").contentWindow.__hold !== true'), 'collection resumed')
  await js('document.querySelector(".collection-room-view iframe").contentWindow.__room.enterTable(); true')
  await until(() => js('document.querySelector(".collection-room-view iframe").contentWindow.__room.S.mode === "table"'), 'clue table')
  await delay(600)
  assert.equal(await js('document.querySelector(".collection-room-view iframe").contentWindow.document.querySelectorAll("#pinAll,#pinSingle").length'), 2)
  assert.equal(await js('(() => { const t = document.querySelector(".collection-room-view iframe").contentWindow.document.querySelector("#tray"); return !t.hidden && t.getBoundingClientRect().height > 50 })()'), true)
  await shot('02-clue-buttons')
  await js('document.querySelector(".collection-room-view iframe").contentWindow.document.querySelector("#pinSingle").click(); true')
  await until(() => js('window.focusQuest.getSnapshot().then(s => s.collection.clues.filter(c => c.pinnedAt).length === 1)'), 'single clue persisted')
  await until(() => js('document.querySelector(".collection-room-view iframe").contentWindow.__room.S.busy === false'), 'single clue animation')
  report.checks.push('Single pin saves only the selected clue')
  await js('document.querySelector(".collection-room-view iframe").contentWindow.document.querySelector("#pinAll").click(); true')
  await until(() => js('window.focusQuest.getSnapshot().then(s => s.collection.clues.filter(c => c.pinnedAt).length === 3)'), 'all clues persisted')
  await until(() => js('document.querySelector(".collection-room-view iframe").contentWindow.__room.S.tray.length === 0'), 'all clue animations finished', 30000)
  report.checks.push('The remaining clues were pinned together and the tray emptied')
  await shot('03-all-pinned')

  await js('document.querySelector(`.sidebar nav button[aria-label="今天"]`).click(); true')
  const task = await js('window.focusQuest.addListTask({ title: "QA 借火出發" })')
  const run = await js(`window.focusQuest.startDailyRun(${JSON.stringify(task.taskList.nextTaskId)})`)
  const node = run.expeditionNodes.find((entry) => entry.depth === 0 && entry.areaId === 'area-01-cloud-ruins')
  assert(node)
  await js(`window.focusQuest.selectExpeditionNode(${JSON.stringify(run.todayRun.id)}, ${JSON.stringify(node.id)})`)
  await until(() => js('Boolean(document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire)'), 'selected campfire')
  await js('window.__qaCampfire = document.querySelector(".campfire-stage iframe"); true')
  await js(`window.focusQuest.startListFocus({ taskId: ${JSON.stringify(task.taskList.nextTaskId)}, minimumMinutes: 5, blockedProcessNames: [], runId: ${JSON.stringify(run.todayRun.id)}, nodeId: ${JSON.stringify(node.id)}, plannedMinutes: ${node.plannedMinutes} })`)
  await until(() => js('Boolean(document.querySelector(".app-shell.is-departing"))'), 'retained departure')
  assert.equal(await js('window.__qaCampfire === document.querySelector(".app-shell.is-departing .campfire-stage iframe")'), true)
  await until(() => js('window.__qaCampfire.contentWindow.__campfire.S.mode === "depart"'), 'departure animation started')
  report.departStart = await js('({t:window.__qaCampfire.contentWindow.__campfire.S.t,hold:window.__qaCampfire.contentWindow.__hold})')
  await delay(700)
  report.departAfter700 = await js('({t:window.__qaCampfire?.contentWindow?.__campfire?.S.t ?? null,hold:window.__qaCampfire?.contentWindow?.__hold ?? null})')
  await shot('04-depart-start')
  await until(() => js('(window.__qaCampfire?.contentWindow?.__campfire?.S.t ?? 0) >= 2.1'), 'lantern lighting')
  await shot('05-lantern-light')
  await until(() => js('!document.querySelector(".app-shell.is-departing") && Boolean(document.querySelector(".focus-active .area-scene-destination"))'), 'destination revealed', 30000)
  await shot('06-destination')
  report.checks.push('The same campfire frame animates through lantern lighting before the destination is revealed')
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  app.exit(0)
})().catch((error) => {
  report.errors.push(error.stack || String(error))
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.error(error)
  app.exit(1)
})
