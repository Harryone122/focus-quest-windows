// Production scene with a disposable Electron profile; no user save is modified.
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/cloud-world-memory-qa')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-world-qa-')))
;(async () => {
  await esbuild.build({ entryPoints: [path.join(root, 'src/renderer/src/cloudRuins/cloudRuinsScene.js')], bundle: true, format: 'esm', outfile: path.join(out, 'scene.mjs'),
    plugins: [{ name: 'world-inspection', setup(build) {
      build.onLoad({ filter: /cloudRuinsScene\.js$/ }, args => ({ loader: 'js', contents: fs.readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n')
        .replace('  return {\n    setPaused(paused)', `  window.worldState=()=>({boat:!!boat,chest:chest.target,pebbles:shrine.pebbles.length});
  window.effect=(effect)=>{TR.effectDone=false;eventEffect({effect},0.6);eventEffect({effect},0.8);};
  window.storyPlan=()=>{scheduleStory();return storyQueue.map(event=>event.id)};
  window.ambientHistory=()=>({...lastDoneAt});
  return {\n    setPaused(paused)`) }))
    }}] })
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none;opacity:0}</style><div id="scene"></div><script type="module">
    const {createCloudRuinsScene}=await import('./scene.mjs');window.marks=[];
    window.handle=createCloudRuinsScene(document.querySelector('#scene'),{progressSeconds:300,targetSeconds:3000,seed:28,paused:true,story:{nodeId:'qa-node',visit:1,opening:true,items:['wind_whistle'],records:['story_opening_a','item_whistle'],scheduledEvents:[{at:40,evs:['opening_b'],forced:true}],eventHistory:[{id:'ev_lake_boat',at:200}]},worldMarks:['paperBoat','chestOpen','shrine_pebble_1','shrine_pebble_2'],reportWorldMark:m=>marks.push(m)});window.ready=true;
  </script>`)
  await app.whenReady()
  const display = screen.getAllDisplays().find(display => display.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay()
  const win = new BrowserWindow({ x: display.workArea.x + 10, y: display.workArea.y + 10, width: Math.min(1250, display.workArea.width - 20), height: Math.min(700, display.workArea.height - 20), show: true, webPreferences: { contextIsolation: true } })
  const errors = []
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message) })
  const js = source => win.webContents.executeJavaScript(source, true)
  await win.loadFile(path.join(out, 'index.html'))
  for (let i = 0; i < 100 && !await js('window.ready===true'); i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.deepEqual(await js('worldState()'), { boat: true, chest: 1, pebbles: 2 })
  assert.deepEqual(await js('storyPlan()'), ['story_opening_b'], 'Resume follows only the backend remaining phase; completed whistle never queues')
  assert.deepEqual(await js('ambientHistory()'), { ev_lake_boat: 200 }, 'Ambient cooldown survives reopening')
  await js("effect('paperBoat');effect('chestOpen');effect('pebble')")
  assert.equal((await js('worldState()')).pebbles, 3)
  assert.deepEqual(await js('marks.slice(0,2)'), ['paperBoat', 'chestOpen'])
  assert.match((await js('marks'))[2], /^shrinePebble:qa-node:\d+$/)
  await js("handle.setWorldState({worldMarks:['shrine_pebble_1','shrine_pebble_2','shrine_pebble_3']});handle.setWorldState({worldMarks:['shrine_pebble_1','shrine_pebble_2','shrine_pebble_3']})")
  assert.equal((await js('worldState()')).pebbles, 3, 'Snapshot updates must not duplicate pebbles')
  await js("handle.setWorldState({worldMarks:Array.from({length:15},(_,i)=>'shrine_pebble_'+(i+1))});effect('pebble');handle.renderNow()")
  assert.equal((await js('worldState()')).pebbles, 15)
  await new Promise(resolve => setTimeout(resolve, 2000))
  const before = await js('handle.debugState().sceneTime')
  await new Promise(resolve => setTimeout(resolve, 1000))
  assert.equal(await js('handle.debugState().sceneTime'), before)
  fs.writeFileSync(path.join(out, 'restored.png'), (await win.webContents.capturePage()).toPNG())
  assert.equal(errors.length, 0, errors.join('\n'))
  const report = { world: await js('worldState()'), callbacks: await js('marks'), pauseFrozen: true, errors }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report)); app.exit(0)
})().catch(error => { console.error(error); app.exit(1) })
