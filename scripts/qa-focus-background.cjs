const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), bundle = process.env.FOCUSQUEST_QA_BUNDLE || root
const out = path.join(root, 'previews/lamp-sync-qa')
fs.mkdirSync(out, { recursive: true })
process.env.FOCUSQUEST_QA_USER_DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-background-qa-'))
process.env.FOCUSQUEST_QA_SEED = '1'
process.env.FOCUSQUEST_QA_EXPEDITION = 'selected'
process.env.FOCUSQUEST_QA_VIEW = 'focus'
process.env.FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS = '2390'
process.env.FOCUSQUEST_QA_WINDOW_WIDTH = '1040'
process.env.FOCUSQUEST_QA_WINDOW_HEIGHT = '700'
const report = { bundle, checks: [], errors: [] }
if (bundle !== root) {
  const hash = file => require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  for (const file of ['out/main/index.js', 'out/preload/index.js', 'out/renderer/index.html',
    ...fs.readdirSync(path.join(root, 'out/renderer/assets')).map(name => 'out/renderer/assets/' + name)]) {
    assert.equal(hash(path.join(bundle, file)), hash(path.join(root, file)), 'Shipped asset must match tested build: ' + file)
  }
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let win, cover
const js = code => win.webContents.executeJavaScript(code, true)
async function until(fn) { const end = Date.now() + 30000; while (Date.now() < end) { if (await fn()) return; await delay(100) } throw Error('QA timeout') }
async function capture(name) {
  const image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(out, name + '.png'), image.toPNG())
  return image.crop({x:10,y:190,width:image.getSize().width-20,height:Math.min(350,image.getSize().height-300)}).toBitmap()
}
require(path.join(bundle, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(async () => { win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Focus Quest'); return !!win })
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) report.errors.push(message) })
  // Do not call setBackgroundThrottling here: test the actual production window configuration.
  assert.equal(win.webContents.backgroundThrottling, false)
  await until(() => js("!!document.querySelector('.focus-active canvas')"))
  await delay(2500)
  await js(`window.__rafProbe={frames:0,maxGap:0,last:performance.now()};for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){const p=window.__rafProbe,n=performance.now(),gap=n-p.last;if(gap>5)p.frames++;p.maxGap=Math.max(p.maxGap,gap);p.last=n;return original.apply(this,args)}};true` )
  await capture('background-01-foreground')
  cover = new BrowserWindow({ ...win.getBounds(), show: true, alwaysOnTop: true, title: 'Focus Quest 背景驗證', backgroundColor: '#202020' })
  await cover.loadURL('data:text/html,<body style="color:white;font-family:sans-serif">Focus Quest background test</body>')
  async function checkFrames(label) {
    const before = await js('({...window.__rafProbe})')
    await delay(5000)
    const after = await js('({...window.__rafProbe})')
    assert(after.frames - before.frames > 15, label + ': scene WebGL rendering must continue')
    assert(after.maxGap < 2000, label + ': no multi-second animation freeze')
    report.checks.push({ label, frames: after.frames - before.frames, maxGapMs: after.maxGap })
  }
  await checkFrames('Covered by another window')
  win.minimize(); await checkFrames('Minimized')
  const minimizedPixels = await capture('background-02-minimized')
  win.hide(); await checkFrames('Hidden to tray')
  assert(!minimizedPixels.equals(await capture('background-03-hidden')), 'Map keeps animating while hidden')
  assert.equal(await js("document.querySelector('.lamp-progress span').textContent"), '4 / 5 路燈')
  cover.destroy(); win.restore(); win.show(); win.focus()
  await checkFrames('Restored without animation fast-forward')
  await capture('background-04-restored-four-lamps')
  const s = await js('window.focusQuest.getSnapshot()')
  await js(`window.focusQuest.pauseFocus(${JSON.stringify(s.activeSession.id)})`)
  await delay(2500)
  const pausedTime = await js("document.querySelector('.focus-adventure-clock time').textContent")
  const frozen = await capture('background-05-paused')
  win.minimize(); await delay(5000)
  assert.equal(await js("document.querySelector('.focus-adventure-clock time').textContent"), pausedTime)
  assert(frozen.equals(await capture('background-06-paused-minimized')), 'Manual pause still freezes map pixels in background')
  report.checks.push('Fourth lamp milestone and HUD agree; manual pause still freezes both clock and map in background')
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors))
  fs.writeFileSync(path.join(out, bundle === root ? 'background-report.json' : 'shipped-background-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report)); app.exit(0)
})().catch(error => { report.failure = error.stack; fs.writeFileSync(path.join(out, 'background-failure.json'), JSON.stringify(report,null,2)); console.error(error); cover?.destroy(); app.exit(1) })
