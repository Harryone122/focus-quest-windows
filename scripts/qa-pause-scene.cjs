// Render the production scene in Electron to verify clocks during departures and rare events.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'previews/focus-pause-integration')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-scene-verify-')))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = { checks: [] }
function assertFrozen(a, b) {
  assert.equal(a.length, b.length)
  let changedPixels = 0, maxChannelDelta = 0
  for (let i = 0; i < a.length; i += 4) {
    let changed = false
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(a[i + channel] - b[i + channel])
      if (delta) changed = true
      maxChannelDelta = Math.max(maxChannelDelta, delta)
    }
    if (changed) changedPixels++
  }
  // Permit only sparse 8-bit compositor rounding, never movement. Scene clocks are also compared exactly.
  report.checks.push({ changedPixels, maxChannelDelta })
  assert(changedPixels <= a.length / 4 * 0.0001 && maxChannelDelta <= 2, 'Frozen image has meaningful changes')
}
let win
async function run() {
  await esbuild.build({ entryPoints: [path.join(root, 'src/renderer/src/cloudRuins/cloudRuinsScene.js')], bundle: true, format: 'esm', outfile: path.join(out, 'scene-qa.mjs') })
  fs.writeFileSync(path.join(out, 'scene-qa.html'), `<!doctype html><html><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none;background:#aab7bd;opacity:0}</style><div id="scene"></div><script type="module">
import {createCloudRuinsScene} from './scene-qa.mjs';
window.createTestScene=(options)=>{window.handle?.destroy(); document.querySelector('#scene').replaceChildren();window.completions=0;window.handle=createCloudRuinsScene(document.querySelector('#scene'),{...options,reportDepartureComplete(){window.completions++}});window.handle.setChrome({top:100,bottom:80,cards:[]})};
</script></html>`)
  await app.whenReady()
  win = new BrowserWindow({ width: 1366, height: 768, show: true, autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } })
  await win.loadFile(path.join(out, 'scene-qa.html'))
  win.show()
  win.focus()
  win.webContents.setBackgroundThrottling(false)
  const exec = script => win.webContents.executeJavaScript(script, true)
  const state = () => exec('({ ...handle.debugState(), completions })')
  async function capture(name) {
    const image = await win.webContents.capturePage()
    fs.writeFileSync(path.join(out, `${name}.png`), image.toPNG())
    return image.toBitmap()
  }
  for (const exit of ['exit_high', 'exit_pines']) {
    await exec(`createTestScene({paused:true,progressSeconds:0,targetSeconds:1500,departure:{exit:'${exit}',route:['b_tree'],durationMs:5000},departureElapsedMs:1700})`)
    await delay(3000)
    const a = await state()
    const first = await capture(`${exit}-paused`)
    await delay(3000)
    assert.deepEqual(await state(), a)
    assertFrozen(first, await capture(`${exit}-frozen`))
    await exec('handle.setPaused(false)')
    await delay(1000)
    const mid = await state()
    report.checks.push({ exit, pausedState: a, resumedState: mid })
    assert(mid.departure.t > 1.7 && mid.departure.t < 4.94)
    assert(mid.departure.t - 1.7 <= (mid.sceneNowMs - a.sceneNowMs) / 1000 + 0.05)
    assert.equal(mid.completions, 0)
    const completionDeadline = Date.now() + 10000
    while ((await state()).completions === 0 && Date.now() < completionDeadline) await delay(100)
    assert.equal((await state()).completions, 1)
    await exec('handle.setPaused(true);handle.setPaused(false)')
    await delay(300)
    assert.equal((await state()).completions, 1)
    report.checks.push(`${exit}: frozen at 1.7 seconds, continuous resume, single completion within 5 active seconds`)
  }
  const area = JSON.parse(fs.readFileSync(path.join(root, 'docs/area-01-cloud-ruins.scene.json'), 'utf8'))
  const rareId = area.events.find(event => event.rare && event.outcome === 'item').id
  await exec(`createTestScene({paused:true,progressSeconds:250,targetSeconds:1500});handle.playSpecialFind(${JSON.stringify(rareId)})`)
  await delay(1000)
  const queued = await state()
  await delay(2000)
  assert.deepEqual(await state(), queued)
  await exec('handle.setPaused(false);window.progress=250;window.ticker=setInterval(()=>handle.setProgress(window.progress+=.1),100)')
  const deadline = Date.now() + 60000
  while ((await state()).act !== rareId && Date.now() < deadline) await delay(200)
  assert.equal((await state()).act, rareId)
  await exec('handle.setPaused(true);clearInterval(window.ticker)')
  await delay(2000)
  const rare = await state()
  const first = await capture('rare-event-paused')
  await delay(3000)
  assert.deepEqual(await state(), rare)
  assertFrozen(first, await capture('rare-event-frozen'))
  await exec('handle.setPaused(false);window.ticker=setInterval(()=>handle.setProgress(window.progress+=.1),100)')
  await delay(2000)
  assert((await state()).sceneTime > rare.sceneTime)
  report.checks.push('Rare event queues while paused, starts on resume, freezes mid-animation and continues')
  fs.writeFileSync(path.join(out, 'scene-results.json'), JSON.stringify(report, null, 2))
  app.exit(0)
}
run().catch(error => { report.failure = error.stack; fs.writeFileSync(path.join(out, 'scene-results.json'), JSON.stringify(report,null,2)); app.exit(1) })
