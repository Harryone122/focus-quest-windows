// Fault injection against production IPC/renderer with a disposable save only.
const { app, BrowserWindow, screen, ipcMain } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-loading-recovery-'))
const out = path.join(root, 'previews/loading-audit/recovery'), report = { profile, errors: [], checks: [] }
fs.mkdirSync(out, { recursive: true })
Object.assign(process.env, { FOCUSQUEST_QA_USER_DATA: profile, FOCUSQUEST_QA_SEED: '1', FOCUSQUEST_QA_EXPEDITION: 'selected' })
BrowserWindow.prototype.show = function () {
  const display = screen.getAllDisplays().find(d => d.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay()
  this.setBounds({ x: display.workArea.x + 10, y: display.workArea.y + 10, width: 1280, height: 800 }); this.showInactive()
}
const Database = require('better-sqlite3'), delay = ms => new Promise(r => setTimeout(r, ms))
let win, sql
const js = code => win.webContents.executeJavaScript(code, true)
const call = (method, ...args) => js(`window.focusQuest[${JSON.stringify(method)}](...${JSON.stringify(args)})`)
async function until(fn, label, timeout = 30000) {
  const end = Date.now() + timeout
  while (Date.now() < end) { if (await fn()) return; await delay(100) }
  throw Error('Timeout ' + label)
}
require(path.join(root, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Focus Quest'); return !!win }, 'window')
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(() => js('!!document.querySelector(".la-route")'), 'lobby')
  await js(`for(const C of [WebGLRenderingContext,WebGL2RenderingContext]){const original=C.prototype.getProgramParameter;C.prototype.getProgramParameter=function(p,n){if(!this.isProgram(p))console.warn("INVALID-PROGRAM "+new Error().stack);return original.call(this,p,n)}};true`);sql = new Database(path.join(profile, 'focusquest.db'))
  let s = await call('getSnapshot'), source = s.expeditionNodes[0]
  sql.prepare('UPDATE expedition_nodes SET area_id=? WHERE id=?').run('area-03-reflection-lake', source.id)
  await call('selectExpeditionNode', s.todayRun.id, source.id)
  s = await call('startListFocus', { minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun.id, nodeId: source.id, plannedMinutes: 50 })
  sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(Date.now() - 3010000).toISOString(), s.activeSession.id)
  await call('finishListFocus', s.activeSession.id, false); s = await call('dismissDebrief', s.activeSession.id)
  const next = s.expeditionNodes.find(n => n.parentNodeId === source.id)
  sql.prepare('UPDATE expedition_nodes SET area_id=? WHERE id=?').run('area-02-moss-station', next.id)
  s = await call('chooseNextRoute', s.todayRun.id, source.id, next.id)
  for (const mode of ['null', 'rejection', 'late']) {
    ipcMain.removeHandler('lake:departure')
    ipcMain.handle('lake:departure', async () => {
      if (mode === 'rejection') throw Error('Injected unavailable departure')
      if (mode === 'late') { await delay(14000); return { exit: 'a_arch', fromExpeditionNodeId: source.id, durationMs: 5000 } }
      return null
    })
    s = await call('startListFocus', { minimumMinutes: 5, blockedProcessNames: [], runId: s.todayRun.id, nodeId: next.id, plannedMinutes: 50 })
    const id = s.activeSession.id, before = await call('pauseFocus', id), start = Date.now()
    await until(() => js('!!document.querySelector("[data-area-layer=destination] [data-scene-ready=true]")'), mode + ' paused destination')
    if (mode === 'late') await delay(Math.max(0, 14500 - (Date.now() - start)))
    assert.equal(await js('!!document.querySelector("[data-area-layer=source]")'), false, 'late cue must not replace an already shown destination')
    const after = await call('getSnapshot')
    assert.equal(after.activeSession.suspendedAt, before.activeSession.suspendedAt)
    assert.equal(after.activeSession.pausedSeconds, before.activeSession.pausedSeconds)
    fs.writeFileSync(path.join(out, mode + '.png'), (await win.webContents.capturePage()).toPNG())
    report.checks.push({ mode, readyWhilePaused: true, elapsedMs: Date.now() - start })
    await call('finishListFocus', id, false); s = await call('dismissDebrief', id)
    await until(() => js('!!document.querySelector(".la-route")'), 'return')
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
  sql.close(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); app.exit(0)
})().catch(error => { report.failure = error.stack; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); app.exit(1) })
