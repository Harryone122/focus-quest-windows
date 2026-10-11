// Production renderer + real IPC/SQLite; all timing changes stay in a disposable profile.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const bundle = process.env.FOCUSQUEST_QA_BUNDLE || root
const label = process.argv[2] || 'fixed'
const seconds = Number(process.argv[3] || 106)
const out = path.join(root, 'previews/exit-transition-qa', `${label}-${seconds}`)
fs.mkdirSync(out, { recursive: true })
const data = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-exit-qa-'))
Object.assign(process.env, { FOCUSQUEST_QA_USER_DATA: data, FOCUSQUEST_QA_SEED: '1',
  FOCUSQUEST_QA_EXPEDITION: 'selected', FOCUSQUEST_QA_VIEW: 'focus',
  FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS: String(seconds),
  FOCUSQUEST_QA_WINDOW_WIDTH: '1320', FOCUSQUEST_QA_WINDOW_HEIGHT: '860' })
const report = { label, seconds, data, bundle, version: require(path.join(bundle, 'package.json')).version, errors: [], checks: [] }
BrowserWindow.prototype.show = function () { this.showInactive() }
if (bundle !== root) {
  const hash = file => require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  for (const file of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html',
    ...fs.readdirSync(path.join(root, 'out/renderer/assets')).map(name => 'out/renderer/assets/' + name)]) {
    assert.equal(hash(path.join(bundle, file)), hash(path.join(root, file)), 'Shipped assets match tested source build: ' + file)
  }
}
let win
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const js = code => win.webContents.executeJavaScript(code, true)
async function until(fn) { const end = Date.now() + 30000; while (Date.now() < end) { if (await fn()) return; await delay(50) } throw Error('QA timeout') }
const has = selector => js(`!!document.querySelector(${JSON.stringify(selector)})`)
const click = selector => js(`document.querySelector(${JSON.stringify(selector)}).click(); true`)
async function capture(name) { fs.writeFileSync(path.join(out, name + '.png'), (await win.webContents.capturePage()).toPNG()) }
async function probe() {
  await js(`window.__exitProbe = { contexts: 0, gaps: [], tasks: [], last: performance.now() };
    if (!window.__exitProbeInstalled) {
      window.__exitProbeInstalled = true;
      const original = HTMLCanvasElement.prototype.getContext, seen = new WeakSet();
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
        const context = original.call(this, kind, ...args);
        if (context && kind.startsWith('webgl') && !seen.has(this)) { seen.add(this); window.__exitProbe.contexts++; }
        return context;
      };
      new PerformanceObserver(list => list.getEntries().forEach(e => window.__exitProbe.tasks.push(Math.round(e.duration)))).observe({type:'longtask', buffered:false});
      const frame = t => { const p=window.__exitProbe; p.gaps.push(Math.round(t-p.last)); p.last=t; requestAnimationFrame(frame); }; requestAnimationFrame(frame);
    }; true`)
}
async function result() { return js(`({contexts:window.__exitProbe.contexts,maxFrameGapMs:Math.max(0,...window.__exitProbe.gaps),longTasksMs:window.__exitProbe.tasks})`) }
require(path.join(bundle, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest'); return !!win })
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(() => has('.focus-active canvas')); await delay(1800)
  if (label.includes('paused')) { await click('.focus-pause-button'); await until(()=>has('.focus-active.is-paused')); await delay(1000) }
  if (label.includes('reduced')) await win.webContents.debugger.attach('1.3'), await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] })
  await capture('01-focus'); await probe()
  await js(`window.__originalFocusCanvas=document.querySelector('.focus-active canvas'); document.querySelector('.focus-end-button').click(); document.querySelector('.focus-end-button')?.click(); true`)
  await until(()=>has('.af-question')); await delay(800)
  report.endToQuestion=await result()
  report.retainedCanvas=await js(`document.querySelector('.focus-active canvas')===window.__originalFocusCanvas`)
  if (!label.startsWith('baseline')) {
    assert.equal(report.retainedCanvas,true,'Review must retain the exact Focus canvas')
    assert.equal(report.endToQuestion.contexts,0,'Ending must not construct another WebGL renderer')
    assert.equal(await js(`document.querySelector('.focus-active').inert`),true)
    const time = await js(`document.querySelector('.focus-adventure-clock time').textContent`)
    await delay(1200)
    assert.equal(await js(`document.querySelector('.focus-adventure-clock time').textContent`),time,'Retained timer must stop')
    assert.equal((await js('window.focusQuest.getSnapshot()')).activeSession,null)
  }
  await capture('02-question')
  await click('.af-answer:not(.done)'); await until(()=>has('.af-foot')); await delay(800)
  await capture('03-review')
  if (label.includes('reload')) {
    const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve)); win.webContents.reload(); await loaded
    await until(()=>has('.af-foot')); await delay(1200)
    assert.equal(await has('.after-focus .lobby-a-scene canvas'),true,'Reload must reconstruct a saved review backdrop')
    await js(`window.__originalFocusCanvas=document.querySelector('.after-focus .lobby-a-scene canvas'); true`)
    report.checks.push('Saved review recovers after renderer reload without a retained Focus')
  }
  await probe()
  if (label.includes('transition-failure')) await js(`document.startViewTransition=()=>{throw new Error('QA unavailable compositor')}; true`)
  await click('.af-foot .la-primary')
  await until(()=>has('.la-panel')); await delay(1100)
  report.returnToLobby=await result()
  report.returnedCanvas=await js(`document.querySelector('.lobby-a-scene canvas')===window.__originalFocusCanvas`)
  if (!label.startsWith('baseline')) {
    assert.equal(report.returnedCanvas,true,'Lobby must adopt the same Focus canvas')
    assert.equal(report.returnToLobby.contexts,0,'Returning must not construct another WebGL renderer')
  }
  await capture('04-lobby')
  assert.equal(await has('.focus-active'),false,'Frozen focus must be released after returning')
  const saved=await js('window.focusQuest.getSnapshot()')
  assert.equal(saved.activeSession,null); assert.equal(saved.pendingDebrief,null)
  report.resolutionProgress=saved.expeditionNodes.find(n=>n.id===saved.todayRun.selectedNodeId)?.progressSeconds
  report.checks.push('End -> answer unfinished -> return uses real saved state and leaves no active timer')
  assert.equal(report.errors.length,0,JSON.stringify(report.errors))
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report)); app.exit(0)
})().catch(async error=>{report.failure=error.stack; if(win&&!win.isDestroyed()) await capture('failure').catch(()=>{}); fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)); console.error(error); app.exit(1)})
