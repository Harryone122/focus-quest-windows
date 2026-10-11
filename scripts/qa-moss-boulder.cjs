// Production scene, isolated snapshots, real Windows WebGL. Never opens the user's save.
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/area02-fixes-qa/boulder')
fs.mkdirSync(out, { recursive: true })
const bundle = require('esbuild').buildSync({ stdin: { resolveDir: root, loader: 'js', contents: `
import { createMossStationScene } from './src/renderer/src/mossStation/mossStationScene.js';
import { createMossRuntime, emptyMossMarks, mossSceneSnapshot } from './src/shared/area02';
import area from './docs/area-02-moss-station.scene.json';
let state=createMossRuntime('boulder-qa'), marks=emptyMossMarks();
let sequence=0, seconds=120;state.seconds=seconds;
const scene=createMossStationScene(document.getElementById('host'),{progressSeconds:seconds,targetSeconds:3000,moss:mossSceneSnapshot('qa',state,marks,false),manualFrames:true,preserveDrawingBuffer:true});
window.qa=(a,b,fraction,eventId)=>{
 seconds+=30; state.seconds=seconds;
 state.action={id:++sequence,kind:eventId?'event':'walk',node:b,route:eventId?[b]:[a,b],startSeconds:seconds-fraction*20,endSeconds:seconds+(1-fraction)*20,eventId};
 if(!eventId)state.action.plan={destination:b,path:[a,b],legEndSeconds:[state.action.endSeconds]};
 else state.action.anim=area.events.find(e=>e.id===eventId)?.anim;
 scene.setMossState(mossSceneSnapshot('qa',state,marks,false));scene.setProgress(seconds);
 for(let i=0;i<40;i++)scene.qaStep(.05);
 scene.renderNow();return scene.debugState();
};
window.ready=true;
` }, bundle: true, platform: 'browser', format: 'iife', write: false }).outputFiles[0].text
fs.writeFileSync(path.join(out, 'scene.js'), bundle)
fs.writeFileSync(path.join(out, 'index.html'), '<style>html,body{margin:0;overflow:hidden;background:#172021}#host{position:absolute;inset:0}canvas{display:block;width:100%;height:100%}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none}</style><div id="host"></div><script src="scene.js"></script>')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 980, show: false, webPreferences: { backgroundThrottling: false } })
  const primary = screen.getPrimaryDisplay(), secondary = screen.getAllDisplays().find(display => display.id !== primary.id)
  const work = (secondary ?? primary).workArea
  win.setBounds({ x: work.x + 10, y: work.y + 10, width: Math.min(1600, work.width - 20), height: Math.min(980, work.height - 20) })
  const errors = []
  win.webContents.on('console-message', (_event, level, message) => { if(level >= 3)errors.push(message) })
  await win.loadFile(path.join(out, 'index.html')); win.showInactive()
  const report = []
  for(const [label,a,b,f,event] of [
    ['01-approach','f_stones_n','f_boulder',.7], ['02-boulder','f_boulder','f_boulder',.3,'ev_boulder_touch'],
    ['03-detour','f_boulder','f_tablet',.45], ['04-tablet','f_tablet','f_tablet',.4,'ev_tablet_read'],
    ['05-return','f_tablet','f_boulder',.6]
  ]) {
    const state = await win.webContents.executeJavaScript(`qa(${JSON.stringify(a)},${JSON.stringify(b)},${f},${JSON.stringify(event ?? null)})`)
    await new Promise(resolve => setTimeout(resolve, 250))
    fs.writeFileSync(path.join(out, label + '.png'), (await win.webContents.capturePage()).toPNG())
    const du=(state.trav.x-state.trav.z)*Math.SQRT1_2+4.6, dv=(-state.trav.z-state.trav.x)*Math.SQRT1_2+2.3
    const x=(du-dv)*Math.SQRT1_2,z=(-du-dv)*Math.SQRT1_2,c=Math.cos(.7),s=Math.sin(.7)
    const clearance=Math.hypot((c*x-s*z)/(1.7*1.45*1.16+.23),(s*x+c*z)/(1.7*1.15*1.16+.23))
    assert(clearance>1, label+' traveller intersects boulder')
    assert(state.trav.visible, label+' traveller visible')
    report.push({label,clearance,...state})
  }
  assert.deepEqual(errors,[])
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({label,clearance,trav})=>({label,clearance,trav}))));app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
