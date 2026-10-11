// Verify task movement in a real renderer/preload/SQLite app using disposable user data.
const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const bundle = process.argv[2] ? path.resolve(process.argv[2]) : root
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-reorder-'))
const out = path.join(root, 'previews', 'lobby-reorder-animation')
fs.mkdirSync(out, { recursive: true })
process.env.FOCUSQUEST_QA_USER_DATA = data
BrowserWindow.prototype.show = function () {}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let win
const js = (source) => win.webContents.executeJavaScript(source, true)
async function until(check, label) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) { if (await check()) return; await delay(20) }
  throw new Error(`Timed out: ${label}`)
}
require(path.join(bundle, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win = BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().endsWith('#/')); return !!win && !win.webContents.isLoading() }, 'main window')
  win.showInactive()
  await until(() => js(`Boolean(document.querySelector('.la-add input'))`), 'lobby')
  await js(`window.focusQuest.addListTask({ title: '讀微積分' })`)
  await js(`window.focusQuest.addListTask({ title: '讀普物' })`)
  const loaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve))
  win.webContents.reload()
  await loaded
  await until(() => js(`document.querySelectorAll('ol.la-tasks > li').length === 2`), 'two saved items')
  await js(`Array.from(document.querySelectorAll('button')).find(el => el.textContent === '調整順序').click()`)
  await until(() => js(`Boolean(document.querySelector('button[aria-label="把「讀普物」往上移"]'))`), 'reorder mode')
  assert.equal(await js(`document.querySelector('.toast.error')?.textContent ?? null`), null, 'error before reorder')
  await js(`(() => { window.__rowMoves = []; const original = Element.prototype.animate; Element.prototype.animate = function(frames, options) { if (this.matches('.la-task')) window.__rowMoves.push({ id: this.dataset.taskId, frames, duration: options.duration }); return original.call(this, frames, options) }; document.querySelector('button[aria-label="把「讀普物」往上移"]').click() })()`)
  await until(() => js(`window.__rowMoves.length === 2`), 'both rows animate')
  assert.equal(await js(`document.querySelector('.toast.error')?.textContent ?? null`), null, 'error during reorder')
  const animation = await js(`({ order: Array.from(document.querySelectorAll('ol.la-tasks > li')).map(el => el.querySelector('.la-task-title').textContent), moves: window.__rowMoves, running: Array.from(document.querySelectorAll('ol.la-tasks > li')).map(el => el.getAnimations().length) })`)
  assert.deepEqual(animation.order, ['讀普物', '讀微積分'])
  assert.equal(animation.moves.length, 2)
  assert(animation.moves.every((move) => move.duration === 280 && Math.abs(parseFloat(move.frames[0].transform.slice(11))) > 0))
  assert(animation.running.every((count) => count > 0))
  await js(`document.querySelectorAll('ol.la-tasks > li').forEach(el => el.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 140 }))`)
  await delay(80)
  fs.writeFileSync(path.join(out, 'mid-motion.png'), (await win.webContents.capturePage()).toPNG())
  await js(`document.querySelectorAll('ol.la-tasks > li').forEach(el => el.getAnimations().forEach(animation => animation.play()))`)
  await until(() => js(`Array.from(document.querySelectorAll('ol.la-tasks > li')).every(el => el.getAnimations().length === 0)`), 'movement finished')
  assert.deepEqual(await js(`Array.from(document.querySelectorAll('ol.la-tasks > li')).map(el => el.querySelector('.la-task-title').textContent)`), ['讀普物', '讀微積分'])
  assert.deepEqual(await js(`Array.from(document.querySelectorAll('ol.la-tasks > li')).map(el => el.getAnimations().length)`), [0, 0])
  fs.writeFileSync(path.join(out, 'after-motion.png'), (await win.webContents.capturePage()).toPNG())
  await until(() => js(`!document.querySelector('.la-add input').disabled`), 'save complete')
  await js(`(() => { const original = window.matchMedia.bind(window); window.matchMedia = query => query === '(prefers-reduced-motion: reduce)' ? { matches: true } : original(query); document.querySelector('button[aria-label="把「讀普物」往下移"]').click() })()`)
  await until(() => js(`document.querySelector('ol.la-tasks > li .la-task-title').textContent === '讀微積分'`), 'reduced-motion reorder')
  assert.equal(await js(`window.__rowMoves.length`), 2, 'reduced motion must not animate')
  assert.equal(await js(`document.querySelector('.toast.error')?.textContent ?? null`), null)
  console.log(JSON.stringify({ data, bundle, animation }))
  app.exit(0)
})().catch((error) => { console.error(error); app.exit(1) })
