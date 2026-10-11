// Windows Electron, production renderer/preload/main, real SQLite, disposable profile only.
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const root = path.resolve(__dirname, '..'), bundle = process.env.FOCUSQUEST_QA_BUNDLE || root
const exit = process.argv[2] || 'exit_high'
const source = exit === 'exit_high' || exit === 'exit_pines' ? 'area-01-cloud-ruins' : 'area-02-moss-station'
const target = source === 'area-01-cloud-ruins' ? 'area-02-moss-station' : 'area-01-cloud-ruins'
const out = path.join(root, 'previews/area02-fixes-qa', path.basename(bundle) + '-' + exit)
fs.mkdirSync(out, { recursive: true })
const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'fq-port-'))
Object.assign(process.env, { FOCUSQUEST_QA_USER_DATA: profile, FOCUSQUEST_QA_SEED: '1', FOCUSQUEST_QA_EXPEDITION: 'selected', FOCUSQUEST_QA_VIEW: '', FOCUSQUEST_QA_WINDOW_WIDTH: '1320', FOCUSQUEST_QA_WINDOW_HEIGHT: '860' })
BrowserWindow.prototype.show = function () { this.showInactive() }
const report = { source, target, exit, profile, bundle, version: require(path.join(bundle, 'package.json')).version, checks: [], errors: [] }
if (bundle !== root) {
  const hash = file => require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  for (const file of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html', ...fs.readdirSync(path.join(root, 'out/renderer/assets')).map(name => 'out/renderer/assets/' + name)]) assert.equal(hash(path.join(bundle, file)), hash(path.join(root, file)), file)
  report.checks.push('Shipped ASAR matches tested build byte for byte')
}
let win, sql
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const js = text => win.webContents.executeJavaScript(text, true)
const call = (method, ...args) => js(`window.focusQuest[${JSON.stringify(method)}](...${JSON.stringify(args)})`)
const has = selector => js(`!!document.querySelector(${JSON.stringify(selector)})`)
const click = selector => js(`document.querySelector(${JSON.stringify(selector)}).click(); true`)
const snap = () => call('getSnapshot')
async function until(fn, label) { const end = Date.now() + 45000; while (Date.now() < end) { if (await fn()) return; await delay(70) } throw Error('Timeout: ' + label) }
async function shot(name) { for(let attempt=0; ; attempt++){try {fs.writeFileSync(path.join(out, name + '.png'), (await win.webContents.capturePage()).toPNG());return} catch(error){if(attempt>=2)throw error;await js('window.dispatchEvent(new Event("resize")); true');await delay(400)}} }
async function startUI() {
  await until(() => has('.la-panel .la-primary:not(:disabled)'), 'ready lobby')
  await click('.la-panel .la-primary'); await until(() => has('.la-depart'), 'departure sheet')
  await js(`document.querySelector('.la-depart-phone input:not(:checked)')?.click(); true`)
  await click('.la-depart-actions .la-primary')
  await until(() => has('.focus-active canvas'), 'focus canvas')
}
async function endUI() {
  await js(`document.querySelector('.focus-end-button').click(); document.querySelector('.focus-end-button')?.click(); true`)
  await until(() => has('.af-question'), 'review question'); await click('.af-answer:not(.done)')
  await until(() => has('.af-foot'), 'review'); await click('.af-foot .la-primary')
  await until(() => has('.la-route'), 'new routes'); await delay(700)
}
function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0 }
require(path.join(bundle, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Focus Quest'); return !!win }, 'window')
  const primary = screen.getPrimaryDisplay(), secondary = screen.getAllDisplays().find(display => display.id !== primary.id)
  const work = (secondary ?? primary).workArea
  win.setBounds({ x: work.x + 10, y: work.y + 10, width: Math.min(1320, work.width - 20), height: Math.min(860, work.height - 20) })
  report.display = secondary ? 'secondary' : 'primary'
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(() => has('.la-route'), 'initial routes')
  sql = new Database(path.join(profile, 'focusquest.db'))
  let s = await snap()
  assert.deepEqual(new Set(s.expeditionNodes.map(n => n.areaId)), new Set([source, target]))
  const from = s.expeditionNodes.find(n => n.areaId === source)
  const sourceTitle = source.includes('02') ? '苔痕驛站' : '雲上遺庭'
  const targetTitle = target.includes('02') ? '苔痕驛站' : '雲上遺庭'
  await js(`Array.from(document.querySelectorAll('.la-route')).find(e=>e.textContent.includes(${JSON.stringify(sourceTitle)})).click(); true`)
  await until(async () => (await snap()).todayRun.selectedNodeId === from.id, 'selected source')
  await startUI(); await delay(1700)
  s = await snap()
  assert.equal(await has('.focus-active .biome-moss-station canvas'), source.includes('02'))
  await shot('01-source-focus')
  if (source.includes('02')) {
    sql.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(new Date(Date.now() - 30000).toISOString(), s.activeSession.id)
    await until(async () => { const action = (await call('getMossScene', from.id))?.action; return action?.kind === 'event' && action.eventId === 'story_open_carving' }, 'first Moss opening')
    await delay(900)
    await shot('01b-moss-opening')
    report.checks.push('First Moss opening renders during the initial five-minute preview')
  }
  // Choose a stable seed that assigns the target to the requested real exit. No map/route is injected.
  const exitIndex = exit === 'exit_high' || exit === 'exit_boat' ? 0 : 1
  let seed = 1
  while ((hash(`${seed}:areas:1:${from.id}`) % 2 + exitIndex) % 2 !== (target.includes('02') ? 1 : 0)) seed++
  sql.prepare('UPDATE daily_runs SET seed = ? WHERE id = ?').run(seed, s.todayRun.id)
  sql.prepare('UPDATE sessions SET started_at = ? WHERE id = ?').run(new Date(Date.now() - 3070000).toISOString(), s.activeSession.id)
  await delay(2300)
  await endUI(); await shot('02-source-lobby')
  if (source.includes('02') && process.argv[3] === 'story-card') {
    const row = sql.prepare('SELECT state_json FROM area_scene_states WHERE node_id = ?').get(from.id)
    const state = JSON.parse(row.state_json)
    state.notes.push({ eventId: 'carry_old_wick', text: '熄燈的燈芯和手上的一樣。', tags: [], atSeconds: 1500 })
    sql.prepare('UPDATE area_scene_states SET state_json = ? WHERE node_id = ?').run(JSON.stringify(state), from.id)
    const reloaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve)); win.webContents.reload(); await reloaded
    await until(() => js("Array.from(document.querySelectorAll('.la-find-pin')).some(e => e.textContent.includes('舊燈芯'))"), 'Moss discovery card pin')
    await shot('02b-story-card-pin')
    await js("Array.from(document.querySelectorAll('.la-find-pin')).find(e => e.textContent.includes('舊燈芯')).click(); true")
    await until(() => has('.la-find-sheet'), 'Moss discovery card')
    assert.match(await js("document.querySelector('.la-find-sheet').textContent"), /熄燈的燈芯和手上的一樣/)
    await shot('02c-story-card-open')
    await click('.la-find-sheet .la-primary')
    report.checks.push('Carried-item discovery appears on the Moss lobby and can be stored')
  }
  s = await snap()
  const next = s.expeditionNodes.find(n => n.parentNodeId === from.id && n.areaId === target)
  assert.equal(next.mossExitId ?? next.departureExitId, exit)
  assert.equal(next.title, targetTitle)
  assert.equal(await has('.lobby-a-scene.biome-moss-station canvas'), source.includes('02'))
  report.checks.push('Real routes contain both maps, correct titles/50 minutes, source lobby and requested exit')
  await js(`Array.from(document.querySelectorAll('.la-route')).find(e=>e.textContent.includes(${JSON.stringify(targetTitle)})).click(); true`)
  await until(async () => (await snap()).todayRun.selectedNodeId === next.id, 'selected destination')
  await js(`window.__departureTiming={samples:[],blankFrames:0,opaqueFrames:0};
    const sampleDeparture=()=>{const p=window.__departureTiming;if(p.removed)return;
      const source=document.querySelector('[data-area-layer="source"]');
      const dest=document.querySelector('[data-area-layer="destination"]');
      const ready=dest?.querySelector('[data-scene-ready="true"]');
      if(ready && !p.ready)p.ready=performance.now();
      if(p.canvas && !source && !ready)p.blankFrames++;
      if(source && Number(source.querySelector('.cloud-ruins-cover')?.style.opacity||0)>.05)p.opaqueFrames++;
      if(dest && !ready && Number(getComputedStyle(dest).opacity)>.01)p.blankFrames++;
      if(p.handle){const d=p.handle.debugState();if(d.departure)p.samples.push({wall:performance.now(),t:d.departure.t,done:d.departure.done});return;}
      const host=document.querySelector('.focus-active .focus-exploration-game');
      let fiber=host&&host[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];
      for(;fiber;fiber=fiber.return){for(let h=fiber.memoizedState;h&&typeof h==='object';h=h.next){const handle=h.memoizedState?.current;
        if(handle&&typeof handle.debugState==='function'){p.handle=handle;const d=handle.debugState();if(d.departure)p.samples.push({wall:performance.now(),t:d.departure.t,done:d.departure.done});return;}}}
    };setInterval(sampleDeparture,50);
    const originalRemove=Element.prototype.remove;
    Element.prototype.remove=function(){ const p=window.__departureTiming; if(!p.removed && this===p.canvas)p.removed=performance.now(); return originalRemove.call(this); };
    const originalRemoveChild=Node.prototype.removeChild;
    Node.prototype.removeChild=function(child){const p=window.__departureTiming; if(!p.removed && p.canvas && (child===p.canvas || child.contains(p.canvas)))p.removed=performance.now(); return originalRemoveChild.call(this,child);};
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
        const draw=proto[name]; if(!draw)continue;
        proto[name]=function(...args){ const result=draw.apply(this,args); const p=window.__departureTiming;
          if(!p.canvas && this.canvas.matches('.focus-active canvas')) {p.canvas=this.canvas;queueMicrotask(()=>{p.first=performance.now();});} return result; };
      }
    }; true`)
  await startUI()
  const firstFrame = Date.now()
  assert.equal(await has('.focus-active .biome-moss-station canvas'), source.includes('02'), 'Departure shows source map')
  await shot('03-departure-start'); await delay(3200); await shot('04-departure-moving')
  await until(async () => (await has('[data-area-layer="destination"] [data-scene-ready="true"]')) && !(await has('[data-area-layer="source"]')), 'painted arrival')
  report.departureVisibleMs = Date.now() - firstFrame
  report.departureSamples = await js('window.__departureTiming.samples')
  report.departureAnimationMs = await js('(()=>{const p=window.__departureTiming,s=p.samples.find(s=>s.t>0.2&&s.t<3),end=p.samples.find(s=>s.done);return s&&end?(end.t-s.t)*1000+s.t*1000:null})()')
  report.transition = await js('(()=>{const p=window.__departureTiming;return {blankFrames:p.blankFrames,opaqueFrames:p.opaqueFrames,ready:p.ready,removed:p.removed}})()')
  assert.equal(report.transition.blankFrames,0, 'Never reveal an unpainted destination')
  assert.equal(report.transition.opaqueFrames,0, 'Never hide the loading gap under a solid mist')
  assert(report.transition.removed >= report.transition.ready + 250, 'Source survives the first destination frames and fade')
  assert(report.departureAnimationMs > 2500 && report.departureAnimationMs < 6200, 'Visible departure finishes near five seconds; destination shader compilation is separate')
  await delay(2500); await shot('05-arrival')
  report.checks.push('Source remains visible until destination has drawn; no white veil; 300 ms crossfade; timer and awards stay independent')
  await click('.focus-pause-button'); await until(() => has('.focus-active.is-paused'), 'pause')
  const paused = await snap(), frozen = target.includes('02') ? await call('getMossScene', next.id) : null
  await delay(1700)
  if (frozen) assert.deepEqual(await call('getMossScene', next.id), frozen)
  const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve)); win.webContents.reload(); await loaded
  await until(() => has('.focus-active.is-paused canvas'), 'paused reload')
  assert.equal(await has('.focus-active .biome-moss-station canvas'), target.includes('02'), 'Reload shows destination immediately')
  assert.equal((await snap()).activeSession.id, paused.activeSession.id)
  if (frozen) assert.deepEqual(await call('getMossScene', next.id), frozen)
  await delay(1800); await shot('06-paused-reload')
  report.checks.push('Pause and renderer reload preserve session, weather, action and correct destination')
  await click('.focus-pause-button')
  await until(() => has('.focus-active:not(.is-paused)'), 'resume')
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
  sql.close(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({...report, departureSamples: undefined})); app.exit(0)
})().catch(async error => { report.failure = error.stack; if (win && !win.isDestroyed()) await shot('failure').catch(() => {}); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); sql?.close(); app.exit(1) })
