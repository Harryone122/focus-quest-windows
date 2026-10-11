// Isolated Windows WebGL playback of every handed-off Moss animation; never opens the user's save.
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/moss-story-qa')
fs.mkdirSync(out, { recursive: true })
const bundle = require('esbuild').buildSync({ stdin: { resolveDir: root, loader: 'js', contents: `
import { createMossStationScene } from './src/renderer/src/mossStation/mossStationScene.js';
import { createMossRuntime, emptyMossMarks, mossSceneSnapshot } from './src/shared/area02';
import area from './docs/area-02-moss-station.scene.json';
const host=document.getElementById('host');const marks=emptyMossMarks();
const state=createMossRuntime('story-qa');let sequence=0,seconds=100;
state.seconds=seconds;
const scene=createMossStationScene(host,{progressSeconds:seconds,targetSeconds:3000,moss:mossSceneSnapshot('story-qa',state,marks,false),manualFrames:true,preserveDrawingBuffer:true,reportCinematic(active){window.cinematic=active;}});
window.qa=(id)=>{const ev=area.storyEvents.find(e=>e.id===id);if(!ev)throw Error(id);seconds+=100;state.seconds=seconds;
state.action={id:++sequence,kind:'event',node:ev.spot,route:[ev.spot],startSeconds:seconds-ev.dur[1]*.55,endSeconds:seconds+ev.dur[1]*.45,eventId:id,anim:ev.anim};
scene.setMossState(mossSceneSnapshot('story-qa',state,marks,id==='story_core_newtag'));
scene.setProgress(seconds);for(let i=0;i<12;i++)scene.qaStep(.05);scene.renderNow();return scene.debugState();};
window.ready=true;
` }, bundle: true, platform: 'browser', format: 'iife', write: false }).outputFiles[0].text
fs.writeFileSync(path.join(out, 'scene.js'), bundle)
fs.writeFileSync(path.join(out, 'index.html'), '<style>html,body{margin:0;overflow:hidden;background:#172021}#host{position:absolute;inset:0}canvas{display:block;width:100%;height:100%}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none}</style><div id="host"></div><script src="scene.js"></script>')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1500, height: 940, show: false, webPreferences: { backgroundThrottling: false } })
  const primary = screen.getPrimaryDisplay(), secondary = screen.getAllDisplays().find(display => display.id !== primary.id)
  const work = (secondary ?? primary).workArea
  win.setBounds({ x: work.x + 10, y: work.y + 10, width: Math.min(1500, work.width - 20), height: Math.min(940, work.height - 20) })
  const report = { display: secondary ? 'secondary' : 'primary', events: [], errors: [] }
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) report.errors.push(message) })
  await win.loadFile(path.join(out, 'index.html')); win.showInactive()
  for (const ev of [
    'story_open_carving', 'story_first_lantern', 'story_first_lantern_rain', 'story_second_sketch',
    'story_core_newtag', 'story_core_ledger08', 'carry_old_wick', 'carry_weathered_lens',
    'carry_charcoal_rubbing', 'carry_mulch_cloth'
  ]) {
    const state = await win.webContents.executeJavaScript(`qa(${JSON.stringify(ev)})`)
    assert.equal(state.story?.id, ev)
    assert.equal(state.story?.cinematic, ev === 'story_open_carving')
    assert(state.trav.visible)
    fs.writeFileSync(path.join(out, `${ev}.png`), (await win.webContents.capturePage()).toPNG())
    report.events.push({ id: ev, status: state.status, draws: state.draws })
    if (!report.edgeLengths) report.edgeLengths = state.edgeLengths
  }
  assert.deepEqual(report.errors, [])
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report)); app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
