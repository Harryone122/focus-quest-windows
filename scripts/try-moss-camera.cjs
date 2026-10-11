// Windows Electron inspection of the production renderer with an independent SQLite clock.
// No production database or gameplay result is opened or written by this entry point.
const { app, BrowserWindow, ipcMain, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/moss-camera-qa')
fs.mkdirSync(out, { recursive: true })
const profile = process.env.FOCUSQUEST_CAMERA_QA==='1' ? fs.mkdtempSync(path.join(require('node:os').tmpdir(),'fq-camera-inspection-')) : path.join(out, 'inspection-profile'); fs.mkdirSync(profile, { recursive: true }); app.setPath('userData', profile)
const esbuild = require('esbuild')
fs.writeFileSync(path.join(out, 'runtime.cjs'), esbuild.buildSync({ stdin: { contents: `export {createMossRuntime,emptyMossMarks,mossSceneSnapshot} from './src/shared/area02';`, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text)
const {createMossRuntime,emptyMossMarks,mossSceneSnapshot}=require(path.join(out,'runtime.cjs'))
const area=JSON.parse(fs.readFileSync(path.join(root,'docs/area-02-moss-station.scene.json'),'utf8'))
let db, saved, win, tick
function persist() { db.prepare('INSERT OR REPLACE INTO inspection VALUES (1,?)').run(JSON.stringify(saved)) }
function frame() { return { moss:mossSceneSnapshot('camera-inspection',saved.runtime,emptyMossMarks(),saved.eventId==='story_core_newtag'), paused:!saved.running } }
function event(id,p=0) {
  const ev=area.storyEvents.find(e=>e.id===id);assert(ev)
  const state=createMossRuntime('camera-inspection'); state.seconds=100+ev.dur[1]*p
  state.action={id:++saved.sequence,kind:'event',node:ev.spot,route:[ev.spot],startSeconds:100,endSeconds:100+ev.dur[1],eventId:id,anim:ev.anim}
  state.node=ev.spot
  // Rain example uses an existing authored weather seed, without changing the weather system.
  if (id==='story_first_lantern_rain') {
    for(let seed=0;seed<10000;seed++) { state.weatherSeed=seed; if(mossSceneSnapshot('camera-inspection',state,emptyMossMarks(),false).weather.phase==='rain')break }
  }
  saved.runtime=state;saved.eventId=id;saved.running=false;persist();return frame()
}
const renderer=esbuild.buildSync({ stdin:{resolveDir:root,loader:'js',contents:`
import {createMossStationScene} from './src/renderer/src/mossStation/mossStationScene.js';
import area from './docs/area-02-moss-station.scene.json';
const api=window.inspectAPI, host=document.getElementById('host'), select=document.getElementById('event'), slider=document.getElementById('progress');
let scene,last,director=true,reduced=false;
const names=['開場：燈柱刻字','首訪：晴天提燈','首訪：雨天提燈','二訪：住宿簿與畫','羅盤：新行李牌','日記：住宿簿','攜帶舊燈芯','攜帶風化鏡片','攜帶炭印紙','攜帶護根布'];
area.storyEvents.forEach((e,i)=>{const o=document.createElement('option');o.value=e.id;o.textContent=names[i];select.appendChild(o)});
function make(s){scene?.destroy();scene=createMossStationScene(host,{moss:s.moss,progressSeconds:s.moss.effectiveSeconds,targetSeconds:3000,paused:s.paused,reducedMotion:reduced,reportCinematic(active){document.body.classList.toggle('cinematic',active)},reportActivity(text){document.getElementById('status').textContent=text}});scene.setDirectorEnabled(director);scene.setChrome({top:80,bottom:100,cards:[]});window.__mossCameraScene=scene;}
function apply(s,snap=false){last=s;if(!scene)make(s);else{scene.setMossState(s.moss);scene.setProgress(s.moss.effectiveSeconds);scene.setPaused(s.paused);if(snap)scene.snapCamera();scene.renderNow()}
select.value=s.moss.action.eventId;const a=s.moss.action,p=Math.max(0,Math.min(1,(s.moss.effectiveSeconds-a.startSeconds)/(a.endSeconds-a.startSeconds)));slider.value=p;document.getElementById('percent').textContent=Math.round(p*100)+'%';document.getElementById('play').textContent=s.paused?'播放':'暫停';}
window.seek=async(id,p)=>{apply(await api.call('event',{id,p}),true);return scene.debugState()};
window.remount=()=>{make(last);scene.renderNow();return scene.debugState()};
select.onchange=()=>window.seek(select.value,0);
slider.oninput=()=>window.seek(select.value,Number(slider.value));
document.getElementById('next').onclick=()=>window.seek(area.storyEvents[(area.storyEvents.findIndex(e=>e.id===select.value)+1)%10].id,0).then(()=>api.call('play'));
document.getElementById('play').onclick=()=>api.call('play');
document.getElementById('camera').onclick=e=>{director=!director;scene.setDirectorEnabled(director);scene.renderNow();e.target.textContent='運鏡：'+(director?'開':'關')};
document.getElementById('reduced').onclick=e=>{reduced=!reduced;scene.setReducedMotion(reduced);scene.renderNow();e.target.textContent='減少動態：'+(reduced?'開':'關')};
document.getElementById('remount').onclick=()=>window.remount();
document.getElementById('reload').onclick=()=>location.reload();
window.qaSetReduced=(value)=>{reduced=value;scene.setReducedMotion(value);scene.renderNow()};
window.qaShiftProgress=(p)=>{const a=last.moss.action,seconds=a.startSeconds+(a.endSeconds-a.startSeconds)*p;scene.setPaused(false);scene.setMossState({...last.moss,effectiveSeconds:seconds});scene.setProgress(seconds);scene.renderNow();return scene.debugState()};
window.qaSamples=[];let prev=performance.now();function sample(t){window.qaSamples.push(t-prev);prev=t;if(window.qaSamples.length>600)window.qaSamples.shift();requestAnimationFrame(sample)}requestAnimationFrame(sample);
api.onState(s=>apply(s));api.call('state').then(s=>{apply(s,true);window.ready=true});
`},bundle:true,platform:'browser',format:'iife',write:false}).outputFiles[0].text
fs.writeFileSync(path.join(out,'scene.js'),renderer)
fs.writeFileSync(path.join(out,'preload.cjs'),`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('inspectAPI',{call:(action,args)=>ipcRenderer.invoke('camera-inspection',action,args),onState:cb=>ipcRenderer.on('inspection-state',(_e,s)=>cb(s))});`)
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Focus Quest 苔痕驛站運鏡測試</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#172021;color:#eee;font:14px "Microsoft JhengHei",sans-serif}#host{position:absolute;inset:0}canvas{display:block;width:100%;height:100%;touch-action:none}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none}header,footer{position:absolute;left:0;right:0;z-index:2;padding:14px 20px;box-sizing:border-box}header{top:0;height:80px;pointer-events:none}footer{bottom:0;min-height:100px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}button,select{background:#273c39;color:#fff;border:1px solid #728a80;border-radius:8px;padding:8px}input{min-width:100px;flex:1}.cinematic header{opacity:0}#status{font-size:12px;margin-top:8px;color:#d7dbd5}</style>
<div id="host"></div><header>苔痕驛站 · 正式場景運鏡測試<div id="status"></div></header><footer><select id="event"></select><button id="next">下一事件並播放</button><button id="play">播放</button><button id="camera">運鏡：開</button><input id="progress" type="range" min="0" max="1" step="0.001" aria-label="事件進度"><span id="percent">0%</span><button id="reduced">減少動態：關</button><button id="remount">重建場景</button><button id="reload">重開畫面</button></footer><script src="scene.js"></script></html>`)
app.whenReady().then(async()=>{
  db=new(require('better-sqlite3'))(path.join(profile,'inspection.db'));db.exec('CREATE TABLE IF NOT EXISTS inspection (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)')
  saved=JSON.parse(db.prepare('SELECT payload FROM inspection WHERE id=1').get()?.payload||'null')||{sequence:0,running:false};saved.running=false
  if(!saved.runtime)event(area.storyEvents[0].id,0);persist()
  ipcMain.handle('camera-inspection',(_e,action,args)=>{
    if(action==='event')return event(args.id,args.p)
    if(action==='play'){saved.running=!saved.running;persist();win.webContents.send('inspection-state',frame())}
    return frame()
  })
  const display=screen.getAllDisplays().find(d=>d.id!==screen.getPrimaryDisplay().id)||screen.getPrimaryDisplay(),work=display.workArea
  win=new BrowserWindow({title:'Focus Quest 苔痕驛站運鏡測試',x:work.x+10,y:work.y+10,width:Math.min(1500,work.width-20),height:Math.min(940,work.height-20),show:false,webPreferences:{preload:path.join(out,'preload.cjs'),backgroundThrottling:false}})
  win.webContents.on('console-message',details=>{if(details.level==='error')console.error(details.message)})
  await win.loadFile(path.join(out,'index.html'));win.showInactive()
  let last=performance.now()
  tick=setInterval(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;if(!saved.running)return
    saved.runtime.seconds=Math.min(saved.runtime.action.endSeconds,saved.runtime.seconds+dt);if(saved.runtime.seconds>=saved.runtime.action.endSeconds)saved.running=false
    persist();win.webContents.send('inspection-state',frame())
  },100)
  if(process.env.FOCUSQUEST_CAMERA_QA==='1')await automate(display)
}).catch(e=>{console.error(e);app.exit(1)})
app.on('window-all-closed',()=>{clearInterval(tick);db?.close();app.quit()})

async function automate(display){
  const delay=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s,true)
  const report={display:display.id,events:[],views:[],errors:[]}
  win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)})
  const deadline=Date.now()+30000
  while(!await js('Boolean(window.ready)')){assert(Date.now()<deadline,'renderer ready timeout');await delay(100)}
  for(const ev of area.storyEvents){
    for(const p of [0,.15,.4,.6,.78,.9,1]){
      const s=await js(`seek(${JSON.stringify(ev.id)},${p})`)
      assert.equal(s.story.id,ev.id);assert(Math.abs(s.story.p-p)<.001)
      if(p===1){assert.equal(s.director.z,1);assert.equal(s.director.el,0);assert.equal(s.director.az,0)}
      if(['drift','driftRain','wick'].includes(ev.effect)&&s.lantern.visible){assert(Math.abs(s.lantern.projected[0])<1&&Math.abs(s.lantern.projected[1])<1,ev.id+' lantern outside frame at '+p)}
      if(p===.9&&['drift','wick'].includes(ev.effect))assert.equal(s.farLights,7)
      await delay(100);fs.writeFileSync(path.join(out,ev.id+'-'+p+'.png'),(await win.webContents.capturePage()).toPNG())
      report.events.push({id:ev.id,p,z:s.director.z,lantern:s.lantern})
    }
  }
  const before=await js(`seek('story_second_sketch',.4)`);await delay(500)
  assert.deepEqual((await js('__mossCameraScene.debugState()')).director,before.director)
  const reopened=await js('remount()');assert.deepEqual(reopened.director,before.director)
  await js('location.reload()');await delay(2500);assert(Math.abs((await js('__mossCameraScene.debugState()')).story.p-.4)<.001)
  for(const [w,h] of [[1600,900],[1440,900],[1200,900],[1680,720],[520,800]]){
    win.setContentSize(w,h);await delay(250)
    for(const ev of area.storyEvents)for(const p of [.15,.4,.6,.78,.9]){
      const s=await js(`seek(${JSON.stringify(ev.id)},${p})`)
      if(['drift','driftRain','wick'].includes(ev.effect)&&s.lantern.visible)assert(Math.abs(s.lantern.projected[0])<1&&Math.abs(s.lantern.projected[1])<1,ev.id+' at '+w+'x'+h+' p='+p)
    }
    await js(`seek('story_second_sketch',.4)`);await delay(100)
    fs.writeFileSync(path.join(out,w+'x'+h+'.png'),(await win.webContents.capturePage()).toPNG());report.views.push([w,h])
  }
  await js(`seek('story_open_carving',.3);__mossCameraScene.setPaused(false);qaSamples=[]`);await delay(3000)
  report.frameMs=await js('qaSamples.slice(10).sort((a,b)=>a-b)');report.p95=report.frameMs[Math.floor(report.frameMs.length*.95)]
  await js('qaSetReduced(true)');const held=await js('__mossCameraScene.debugState()');await delay(500)
  assert.deepEqual((await js('__mossCameraScene.debugState()')).director.t,held.director.t)
  await js(`seek('story_first_lantern',.155);qaShiftProgress(.165)`)
  await delay(450);const cut=await js('__mossCameraScene.debugState()');assert.equal(cut.director.cut,false)
  const fixed=cut.director.t;await delay(300);assert.deepEqual((await js('__mossCameraScene.debugState()')).director.t,fixed)
  report.reducedMotion='0.4 second cut, then no moving-anchor follow'
  assert.deepEqual(report.errors,[])
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({events:report.events.length,views:report.views,p95:report.p95,errors:report.errors}));app.exit(0)
}
