// Real production scene in an isolated Electron profile; never touches the user's save.
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const bundle = process.env.FOCUSQUEST_QA_BUNDLE ? path.resolve(process.env.FOCUSQUEST_QA_BUNDLE) : root
const out = process.env.FOCUSQUEST_QA_OUT || path.join(root, 'previews/campfire-traveller-qa', bundle === root ? '' : 'shipped')
fs.mkdirSync(out, { recursive: true })
process.env.FOCUSQUEST_QA_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-traveller-'))
const report = { checks: [], errors: [], routes: {} }
function fail(e) { report.failure = e.stack || String(e); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); app.exit(1) }
process.on('uncaughtException', fail)
process.on('unhandledRejection', fail)
let win
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const js = source => win.webContents.executeJavaScript(source, true)
const scene = source => js(`(()=>{const w=document.querySelector('.campfire-stage iframe').contentWindow;${source}})()`)
async function until(check, label) { const end = Date.now() + 30000; while (Date.now() < end) { if (await check()) return; await delay(100) }; throw Error(label) }
async function shot(name) { fs.writeFileSync(path.join(out, name + '.png'), (await win.webContents.capturePage()).toPNG()) }
function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(p[0] - a[0] - dx * t, p[2] - a[1] - dz * t)
}
if (bundle !== root) {
  const crypto = require('node:crypto')
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  for (const folder of ['out/main', 'out/preload', 'out/renderer', 'out/renderer/assets']) {
    for (const file of fs.readdirSync(path.join(root, folder), { withFileTypes: true }).filter(f => f.isFile()))
      assert.equal(hash(path.join(root, folder, file.name)), hash(path.join(bundle, folder, file.name)), `Packaged ${folder}/${file.name}`)
  }
  report.checks.push('All packaged production files match the tested build')
}
require(path.join(bundle, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Focus Quest'); return !!win }, 'main window')
  const primary = screen.getPrimaryDisplay(), display = screen.getAllDisplays().find(d => d.id !== primary.id) || primary
  win.setBounds({ x: display.workArea.x + 10, y: display.workArea.y + 10, width: 1280, height: 800 })
  win.showInactive(); report.secondary = display.id !== primary.id
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) report.errors.push(message) })
  await until(() => js('Boolean(document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire?.debugState)'), 'production campfire')
  await scene('w.__hold=true;w.__campfire.advance(0);return true')
  await shot('idle')
  const model = await scene('return w.__campfire.debugState()')
  assert.equal(model.scale, 1.15)
  assert.equal(model.model.leg.height, .3)
  assert.equal(model.model.leg.radiusTop, .045)
  assert.equal(model.model.cloak.radius, .23)
  assert.equal(model.model.cloak.height, .6)
  assert.equal(model.model.headY, .6)
  assert.deepEqual(model.model.arms, [[-.13, .44, .02], [.13, .44, .02]])
  report.checks.push('Lake traveller proportions and anchors in the production lobby')
  await scene('w.__campfire.setSelected("bridge");w.__campfire.depart();return true')
  const rest = await scene('return w.__campfire.debugState().staff.position')
  let previous = rest, maxStep = 0
  for (let frame = 1; frame <= 60; frame++) {
    await scene('w.__campfire.advance(1/30);return true')
    const state = await scene('return w.__campfire.debugState()'), staff = state.staff
    assert.equal(staff.side, 'left')
    const step = Math.hypot(...staff.position.map((p, i) => p - previous[i])); maxStep = Math.max(maxStep, step)
    assert(step < .08, 'No staff jump at pickup: ' + step)
    if (frame / 30 < 1.0) assert.deepEqual(staff.position, rest, 'Staff waits for the reaching hand')
    if (frame / 30 >= 1.05) assert(Math.hypot(...staff.grip.map((p, i) => p - staff.hand[i])) < 1e-6, 'Grip follows the same hand')
    if ([15, 30, 33, 45, 60].includes(frame)) await shot('pickup-' + frame)
    previous = staff.position
  }
  report.pickupMaxFrameDistance = maxStep
  report.checks.push('Staff rests on the left, waits for contact, and remains attached without a pickup jump')
  for (const way of ['bridge', 'steps']) {
    await scene(`w.__campfire.playReturn();w.__campfire.advance(7);w.__campfire.setSelected('${way}');w.__campfire.depart();return true`)
    const start = await scene('return w.__campfire.debugState()')
    const min = Math.min(...start.path.map(p => segmentDistance(p, start.log.a, start.log.b)))
    // Includes the full hat width, even though the hat is above the log.
    assert(min >= start.log.radius + .3 * start.scale, `${way} log clearance ${min}`)
    report.routes[way] = { minLogCenterDistance: min, required: start.log.radius + .3 * start.scale, frames: [] }
    let at = 0
    for (const time of [.8, 2.5, 5.05, 5.4, 5.8, 6.1, 6.4, 6.7, 7.0, 7.4, 8]) {
      await scene(`w.__campfire.advance(${time - at});return true`); at = time
      const state = await scene('return w.__campfire.debugState()')
      if (time >= 2.5) assert(Math.hypot(...state.staff.grip.map((p, i) => p - state.staff.hand[i])) < 1e-6, 'Same grip through lighting and walking')
      report.routes[way].frames.push({ time, position: state.position, legs: state.legs, arms: state.arms })
      if (time >= 6.1) {
        assert(state.legs.every(a => Math.abs(a) <= .55 + 1e-8))
        assert(Math.abs(state.arms[0]) < 1e-8)
        assert(Math.abs(state.arms[1] + .35) < 1e-8)
        assert(state.hipY >= .3 && state.hipY <= .335 + 1e-8)
      }
      await shot(`${way}-${String(time).replace('.', '-')}`)
    }
    report.checks.push(`${way}: continuous route clears log; Lake walk amplitude and steady staff arm`)
  }
  await scene('w.__campfire.playReturn();w.__campfire.advance(7);w.__campfire.setSelected("bridge");w.__campfire.depart();w.__campfire.advance(6.4);return true')
  const paused = await scene('return w.__campfire.debugState()')
  await delay(600)
  assert.deepEqual(await scene('return w.__campfire.debugState()'), paused)
  report.checks.push('Held scene freezes path, limbs and departure time')
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); app.exit(0)
})().catch(e => { report.failure = e.stack; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(e); app.exit(1) })
