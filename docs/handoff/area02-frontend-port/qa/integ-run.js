// Integration QA in the cloud: the real main-process database (better-sqlite3 in Node) behind a mocked
// preload, the production renderer build in headless Chromium. No Electron, no user data.
// usage: NODE_PATH=../../repo/node_modules node run.js <scenario>
const path = require('path'), fs = require('fs'), os = require('os')
const REPO = path.resolve(__dirname, '../../repo')
const Better = require(path.join(REPO, 'node_modules/better-sqlite3'))
const { FocusQuestDatabase } = require('./backend.cjs')
const { chromium } = require(path.resolve(__dirname, '../node_modules/playwright-core'))
const scenario = process.argv[2] || 'focus'
const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-integ-'))
const dbPath = path.join(tmp, 'focusquest.db')
const db = new FocusQuestDatabase(dbPath)
const sql = new Better(dbPath)
const log = (...a) => console.log(...a)
const shift = (sessionId, seconds) => sql.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(new Date(Date.now() - seconds * 1000).toISOString(), sessionId)

function startMossFocus(elapsed) {
  let s = db.addListTask({ title: '整理苔痕驛站的交接' })
  s = db.startDailyRun(s.taskList.nextTaskId)
  const node = s.expeditionNodes.find((n) => n.depth === 0 && n.state === 'available')
  sql.prepare('UPDATE expedition_nodes SET area_id = ?, planned_minutes = 50 WHERE id = ?').run('area-02-moss-station', node.id)
  s = db.selectExpeditionNode(s.todayRun.id, node.id)
  s = db.startListFocus({ taskId: s.taskList.nextTaskId, minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun.id, nodeId: node.id, plannedMinutes: 50 })
  shift(s.activeSession.id, elapsed)
  db.processActiveSpecialFinds()
  return { node, session: s.activeSession }
}

;(async () => {
  let ctx = {}
  if (scenario === 'focus') ctx = startMossFocus(Number(process.argv[3] || 420))
  if (scenario === 'journey') {
    ctx = startMossFocus(3700)
    for (let i = 0; i < 3; i++) db.processActiveSpecialFinds()
    const id = ctx.session.id
    db.beginSessionDebrief(id); db.finishListFocus(id, false); db.dismissDebrief(id)
    const s = db.getSnapshot(); log('after', s.expeditionNodes.find((n) => n.id === ctx.node.id).state, JSON.stringify(db.getMossScene(ctx.node.id).worldMarks))
  }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  await page.exposeFunction('__fq', (name, args) => {
    if (name === 'listRunningApplications') return []
    const fn = db[name]
    if (typeof fn !== 'function') throw new Error('mock preload: no ' + name)
    const result = fn.apply(db, args || [])
    return result === undefined ? null : JSON.parse(JSON.stringify(result))
  })
  await page.addInitScript(() => {
    window.focusQuest = new Proxy({}, { get: (_, name) => {
      if (name === 'onSnapshotChanged') return (cb) => { window.__snap = cb; return () => {} }
      if (name === 'onOverlayState') return () => () => {}
      return (...args) => window.__fq(String(name), args)
    } })
  })
  const timer = setInterval(async () => {
    try { if (db.processActiveSpecialFinds()) { const s = JSON.parse(JSON.stringify(db.getSnapshot())); await page.evaluate((snap) => window.__snap && window.__snap(snap), s) } } catch (e) { /* page busy */ }
  }, 1000)
  await page.goto('file://' + path.join(REPO, 'out/renderer/index.html'))
  const shot = async (name) => { await page.screenshot({ path: path.join(out, name), timeout: 180000 }); log('shot', name) }
  const scene = () => page.evaluate(() => ({ moss: !!document.querySelector('.biome-moss-station canvas'), glass: document.querySelector('.biome-moss-station')?.dataset.glass || null, status: document.querySelector('.traveler-activity strong')?.textContent, lamps: document.querySelector('.lamp-progress span')?.textContent }))
  const push = async () => { const s = JSON.parse(JSON.stringify(db.getSnapshot())); await page.evaluate((snap) => window.__snap && window.__snap(snap), s) }
  if (scenario === 'journey') {
    try {
      await page.waitForSelector('.lobby-a-scene canvas', { timeout: 120000 })
      await page.waitForTimeout(5000)
      log('lobby', JSON.stringify(await page.evaluate(() => ({ moss: !!document.querySelector('.lobby-a-scene.biome-moss-station canvas'), routes: Array.from(document.querySelectorAll('.la-route')).map((e) => e.textContent.slice(0, 40)) }))))
      await shot('journey-lobby.png')
      const card = await page.$('.la-route'); if (card) { await card.hover({ force: true }); await page.waitForTimeout(3500); await shot('journey-lobby-look.png') }
      const s0 = db.getSnapshot(); const from = ctx.node.id
      const next = s0.expeditionNodes.find((n) => n.parentNodeId === from && n.state === 'available')
      log('next', next.id, next.areaId, next.mossExitId, next.departureExitId)
      let s = db.chooseNextRoute(s0.todayRun.id, from, next.id)
      s = db.startListFocus({ taskId: s.taskList.nextTaskId, minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun.id, nodeId: next.id, plannedMinutes: next.plannedMinutes })
      log('departure cue', JSON.stringify(db.getMossDeparture(s.activeSession.id)), 'session.departure', JSON.stringify(s.activeSession.departure))
      // swiftshader needs ~30 s to build the leaving scene; start this Focus's clock later so the
      // 5-second departure is still due when it appears (real GPUs build it in 1-2 s).
      if (process.env.LATE_START) shift(s.activeSession.id, -Number(process.env.LATE_START))
      const t0 = Date.now(); await push()
      for (let i = 0; i < 40; i++) {
        const st = await page.evaluate(() => ({ focus: !!document.querySelector('.focus-active'), hosts: Array.from(document.querySelectorAll('.focus-exploration-game')).map((e) => e.className.replace('focus-exploration-game ', '') + (e.querySelector('canvas') ? '+c' : '')) }))
        log('poll', Date.now() - t0, JSON.stringify(st)); if (st.hosts.some((h) => h.includes('+c'))) break
        await page.waitForTimeout(250)
      }
      await page.waitForSelector('.focus-active canvas', { timeout: 60000 })
      for (const [ms, name] of [[300, 'journey-depart-a.png'], [300, 'journey-depart-b.png'], [8000, 'journey-after.png']]) {
        await page.waitForTimeout(ms)
        log(name, JSON.stringify(await scene()), await page.evaluate(() => ({ cloud: !!document.querySelector('.focus-exploration-game:not(.biome-moss-station) canvas') })))
        await shot(name)
      }
    } catch (e) { log('FAIL', e.message) }
    clearInterval(timer); log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none'); await browser.close(); return
  }
  try {
    await page.waitForSelector('.focus-active canvas', { timeout: 120000 })
    await page.waitForTimeout(6000)
    log('scene', JSON.stringify(await scene()))
    log('status', await page.evaluate(() => document.querySelector('.traveler-activity strong')?.textContent))
    await shot(scenario + '-1.png')
    await page.waitForTimeout(8000)
    log('scene', JSON.stringify(await scene()))
    await shot(scenario + '-2.png')
  } catch (e) { log('FAIL', e.message) }
  clearInterval(timer)
  log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none')
  await browser.close()
})()
