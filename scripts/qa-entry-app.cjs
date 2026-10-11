const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), bundle = process.env.FOCUSQUEST_QA_BUNDLE || root
const out = path.join(root, 'previews/entry-spawn-qa')
fs.mkdirSync(out, { recursive: true })
process.env.FOCUSQUEST_QA_USER_DATA = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-background-qa-'))
process.env.FOCUSQUEST_QA_SEED = '1'
process.env.FOCUSQUEST_QA_EXPEDITION = 'selected'
process.env.FOCUSQUEST_QA_VIEW = 'focus'
process.env.FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS = '0'
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
  await until(() => js("!!document.querySelector('.focus-active canvas')"))
  await delay(2500)
  await capture('app-entry')
  assert.equal(report.errors.length,0)
  report.checks.push('Shipped assets match verified build; production focus scene renders without errors')
  fs.writeFileSync(path.join(out,'app-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(0)
})().catch(error=>{console.error(error);app.exit(1)})
