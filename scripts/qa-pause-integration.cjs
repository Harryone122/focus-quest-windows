// Run with Electron after `npm.cmd run build`. Uses ONLY the explicitly isolated QA save.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'previews', 'focus-pause-integration')
const mode = process.env.FOCUSQUEST_PAUSE_QA_MODE || 'pause'
const data = process.env.FOCUSQUEST_QA_USER_DATA
assert(data && path.basename(data).startsWith('focusquest-pause-verify-'), 'Use a dedicated QA directory')
fs.mkdirSync(output, { recursive: true })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = { mode, checks: [], errors: [] }
let win
const evaluate = source => Promise.race([
  win.webContents.executeJavaScript(source, true),
  new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Renderer evaluation timeout')), 5000); timer.unref() })
])
const snapshot = () => evaluate('window.focusQuest.getSnapshot()')
const ui = () => evaluate(`({time:document.querySelector('.focus-adventure-clock time')?.textContent, paused:!!document.querySelector('.focus-active.is-paused'), lamps:document.querySelector('.lamp-progress')?.getAttribute('aria-label'), error:document.querySelector('.focus-adventure-error')?.textContent})`)
async function until(source, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await evaluate(source).catch(() => false)) return
    await delay(100)
  }
  throw new Error(`Timed out: ${source}`)
}
async function capture(name) {
  const image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(output, `${name}.png`), image.toPNG())
  const size = image.getSize()
  return image.crop({ x: 50, y: 190, width: size.width - 100, height: size.height - 330 }).toBitmap()
}
async function toggle(paused) {
  await evaluate(`document.querySelector('.focus-pause-button').click()`)
  await until(`!!document.querySelector('.focus-active.is-paused') === ${paused} && !document.querySelector('.focus-pause-button').disabled`)
  assert.equal(!!(await snapshot()).activeSession.suspendedAt, paused)
}

require(path.join(root, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  const deadline = Date.now() + 20000
  while (!win && Date.now() < deadline) {
    win = BrowserWindow.getAllWindows().find(window => window.getTitle() === 'Focus Quest')
    if (!win) await delay(100)
  }
  assert(win, 'Main App window exists')
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(`!!document.querySelector('.focus-pause-button') && !!document.querySelector('canvas')`)
  await delay(1500)
  if (mode === 'pause') {
    await capture('01-running')
    await toggle(true)
    await delay(2200)
    const before = await ui()
    const saved = await snapshot()
    const first = await capture('02-paused')
    await delay(12000)
    const second = await capture('03-still-paused')
    assert(first.equals(second), 'Paused map pixels must be identical')
    assert.deepEqual(await ui(), before, 'Timer and lamps remain frozen across the next wall-clock milestone')
    assert.deepEqual((await snapshot()).specialFinds, saved.specialFinds)
    report.checks.push('Paused map pixels identical after 12 seconds; timer, lamps and finds frozen')
    await toggle(false)
    await delay(2300)
    assert.notEqual((await ui()).time, before.time)
    assert(!second.equals(await capture('04-resumed')), 'World resumes moving')
    report.checks.push('Resume advances time and world without including paused duration')
    await evaluate(`window.__clockSamples=[];window.__clockObserver=new MutationObserver(()=>window.__clockSamples.push(document.querySelector('.focus-adventure-clock time').textContent));window.__clockObserver.observe(document.querySelector('.focus-adventure-clock time'),{subtree:true,childList:true,characterData:true})`)
    for (let index = 0; index < 4; index++) { await toggle(true); await delay(375); await toggle(false); await delay(125) }
    const samples = await evaluate(`window.__clockObserver.disconnect();window.__clockSamples`)
    const seconds = value => value.split(':').reduce((total, part) => total * 60 + Number(part), 0)
    assert(samples.every((value, index) => !index || seconds(value) >= seconds(samples[index - 1])), 'Rapid resume must never rewind the displayed timer')
    report.checks.push('Rapid pause/resume does not rewind time between timer ticks')
    await toggle(true)
    const held = await ui()
    const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve))
    win.webContents.reload()
    await loaded
    await until(`!!document.querySelector('.focus-active.is-paused') && !!document.querySelector('canvas')`)
    await delay(2000)
    assert.equal((await ui()).time, held.time)
    const reloaded = await capture('05-reloaded-paused')
    await delay(2000)
    assert(reloaded.equals(await capture('06-reloaded-still-paused')))
    report.checks.push('Renderer reload creates a paused scene and preserves effective time')
    fs.writeFileSync(path.join(output, 'pause-restart-state.json'), JSON.stringify(await ui()))
  } else {
    const expected = JSON.parse(fs.readFileSync(path.join(output, 'pause-restart-state.json'), 'utf8'))
    assert.equal((await ui()).time, expected.time)
    assert.equal((await ui()).paused, true)
    await capture('07-process-restarted-paused')
    report.checks.push('Full Electron process restart preserves manual pause and timer')
    await toggle(false)
    await delay(23000)
    assert(await evaluate(`document.querySelector('.focus-active').classList.contains('is-immersed')`))
    await capture('08-immersed')
    await evaluate(`window.dispatchEvent(new PointerEvent('pointermove'))`)
    await delay(500)
    assert(!await evaluate(`document.querySelector('.focus-active').classList.contains('is-immersed')`))
    report.checks.push('20-second immersion activates; pointer movement restores information')
    win.setSize(1040, 700)
    await delay(1200)
    await capture('09-small-window')
    await toggle(true)
    const active = (await snapshot()).activeSession
    const effective = Math.floor((Date.parse(active.suspendedAt) - Date.parse(active.startedAt) - Math.round(active.pausedSeconds * 1000)) / 1000)
    await delay(1500)
    await evaluate(`document.querySelector('.focus-end-button').click()`)
    await until(`!document.querySelector('.focus-active')`)
    const ended = await snapshot()
    assert.equal(ended.activeSession, null)
    assert.equal(ended.pendingDebrief.effectiveSeconds, effective)
    await capture('10-debrief')
    report.checks.push('End while paused enters Debrief with exact effective time')
  }
  assert.equal(report.errors.length, 0, 'No renderer errors')
  fs.writeFileSync(path.join(output, `${mode}-results.json`), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
  app.exit(0)
})().catch(error => {
  report.failure = String(error.stack || error)
  fs.writeFileSync(path.join(output, `${mode}-results.json`), JSON.stringify(report, null, 2))
  console.error(error)
  app.exit(1)
})
