// Actual production bundle, isolated save and secondary display. Never mutates the user's profile.
const {app,BrowserWindow,screen}=require('electron'),fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),Database=require('better-sqlite3')
const root=path.resolve(__dirname,'..'),bundle=process.env.FOCUSQUEST_QA_BUNDLE||root,shipped=bundle!==root,out=path.join(root,'previews/area03-stage5-integration',shipped?'shipped':'source'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'fq-lake-story-'))
fs.mkdirSync(out,{recursive:true});Object.assign(process.env,{FOCUSQUEST_QA_USER_DATA:profile,FOCUSQUEST_QA_SEED:'1',FOCUSQUEST_QA_EXPEDITION:'selected'});app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');BrowserWindow.prototype.show=function(){this.showInactive()}
const report={checks:[],errors:[],profile,bundle},delay=ms=>new Promise(r=>setTimeout(r,ms));let win,sql
const js=s=>win.webContents.executeJavaScript(s,true),call=(m,...a)=>js(`window.focusQuest[${JSON.stringify(m)}](...${JSON.stringify(a)})`),snap=()=>call('getSnapshot'),has=s=>js(`!!document.querySelector(${JSON.stringify(s)})`),click=s=>js(`document.querySelector(${JSON.stringify(s)}).click()`)
async function until(f,label){const end=Date.now()+40000;while(Date.now()<end){if(await f())return;await delay(150)}throw Error('Timeout: '+label)}
async function shot(name){fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())}
require(path.join(bundle,'out/main/index.js'))
;(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win},'window')
 const primary=screen.getPrimaryDisplay(),display=screen.getAllDisplays().find(d=>d.id!==primary.id)||primary;report.secondary=display.id!==primary.id;win.setBounds({x:display.workArea.x+10,y:display.workArea.y+10,width:1280,height:800});win.showInactive();win.webContents.on('console-message',(_e,l,m)=>{if(l>=3||m.includes('GL_INVALID_OPERATION'))report.errors.push(m)})
 await until(()=>has('.la-route'),'routes');sql=new Database(path.join(profile,'focusquest.db'));let s=await snap(),node=s.expeditionNodes[0]
 sql.prepare('UPDATE expedition_nodes SET area_id=?,title=? WHERE id=?').run('area-03-reflection-lake','倒影湖畔',node.id);await call('selectExpeditionNode',s.todayRun.id,node.id)
 await call('startListFocus',{minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun.id,nodeId:node.id,plannedMinutes:50});await until(()=>js('Boolean(window.__lakeScene)'),'scene');await delay(10000)
 // Traverse every phase with unchanged production art and deterministic manual snapshots.
 const area=JSON.parse(fs.readFileSync(path.join(root,'docs/area03/area-03-reflection-lake.scene.json'),'utf8'));await js('__lakeScene.setInspection(true);__lakeScene.setPaused(true)')
 for(const e of area.storyEvents){
  await js(`__lakeScene.qa.focus();__lakeScene.qa.setTime('day');__lakeScene.qa.setTide(${e.tide==='high'?1:0})`)
  for(let i=0;i<=20;i++){
   await js(`__lakeScene.qa.story('${e.id}',${i/20});__lakeScene.qa.render()`)
   const state=await js('__lakeScene.debugState()');assert(Number.isFinite(state.sim));assert(Number.isFinite(state.traveller.u));assert(Number.isFinite(state.traveller.y))
   if(i===10){await delay(100);await shot(e.id);report.checks.push({id:e.id,key:state})}
  }
  assert.equal(await js('__lakeScene.qa.camera.zoom'),1,e.id+' restores zoom')
 }
 await js('__lakeScene.setReducedMotion(true);__lakeScene.qa.story("story_second_cup",.5);__lakeScene.qa.render()');assert.equal(await js('__lakeScene.qa.camera.zoom'),1);assert((await js('__lakeScene.qa.s5().vignette'))>.9);report.checks.push('Reduced motion: stable full view and soft vignette');await js('__lakeScene.setReducedMotion(false)')
 // Backend action drives the actual push without using prototype timeline controls.
 const ev=area.storyEvents.find(e=>e.id==='story_first_lag');let seconds=660
 // Force a persisted story action in this isolated profile, keep its real seeded full tide.
 const row=sql.prepare('SELECT state_json FROM area_scene_states WHERE node_id=?').get(node.id),runtime=JSON.parse(row.state_json)
 for(seconds=660;seconds<3000;seconds++){const start=seconds;const rand=(seed,k)=>{let a=(seed^Math.imul(k+1,0x9E3779B1))>>>0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296};const tideStart=660+rand(runtime.seed,1)*1200;if(start>tideStart+90&&start<tideStart+400&&start%600<500)break}
 const start=seconds;runtime.seconds=start+12;runtime.node=ev.spot;runtime.intent=null;runtime.action={id:100000,kind:'story',node:ev.spot,route:[ev.spot],eventId:ev.id,startSeconds:start,endSeconds:start+30}
 sql.prepare('UPDATE area_scene_states SET state_json=? WHERE node_id=?').run(JSON.stringify(runtime),node.id)
 s=await snap();sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(Date.now()-(start+12)*1000).toISOString(),s.activeSession.id)
 await js('__lakeScene.qa.focus();__lakeScene.qa.setTide(null);__lakeScene.qa.setTime("auto");__lakeScene.setInspection(false);__lakeScene.setPaused(false)');await until(()=>js('__lakeScene.debugState().action?.id===100000 && __lakeScene.qa.camera.zoom>5'),'persisted story reaches renderer')
 report.production=await js('({scene:__lakeScene.debugState(),story:__lakeScene.qa.s5(),zoom:__lakeScene.qa.camera.zoom})')
 assert(report.production.zoom>5,JSON.stringify(report.production));assert(await js('__lakeScene.qa.s5().double'));await shot('production-first-lag')
 await call('pauseFocus',s.activeSession.id);await delay(400);const frozen=await js('({sim:__lakeScene.debugState().sim,zoom:__lakeScene.qa.camera.zoom})');await delay(600);assert.deepEqual(await js('({sim:__lakeScene.debugState().sim,zoom:__lakeScene.qa.camera.zoom})'),frozen)
 await call('finishListFocus',s.activeSession.id,false);await call('dismissDebrief',s.activeSession.id);await until(()=>has('.la-panel'),'lobby');await delay(800);await shot('after-interruption');assert.equal(await js('__lakeScene.qa.camera.zoom'),1)
 report.checks.push('Persisted story playback, real 3D double, pause freezes zoom/time, interruption restores lobby')
 // Collection receives permanent evidence, never prototype-made discoveries.
 sql.prepare('INSERT OR IGNORE INTO map_cores(map_id,item_key,acquired_at) VALUES(?,?,?)').run('area-03-reflection-lake','lake_mirror',new Date().toISOString())
 for(const c of area.clues)sql.prepare('INSERT OR IGNORE INTO collection_clues(id,kind,source_id,place_id,source_label,text,acquired_at,pinned_at) VALUES(?,?,?,NULL,?,?,?,?)').run(c.id,'note','m03',c.source,c.text,new Date().toISOString(),c.id==='c03'?new Date().toISOString():null)
 await call('markCollectionCorePresented','area-03-reflection-lake');win.reload();await until(()=>has('.la-panel'),'reloaded lobby')
 await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='收藏室'||b.getAttribute('aria-label')==='收藏室').click()`)
 await until(()=>js(`Boolean(document.querySelector('iframe')?.contentWindow.__room)`),'collection');await delay(1000)
 const room=await js(`(()=>{const r=document.querySelector('iframe').contentWindow.__room;return {cores:r.EX[3].state,boots:r.S.lakeBoots,pinned:r.S.pinned,tray:r.S.tray}})()`)
 assert.equal(room.cores,2);assert.equal(room.boots,true);assert.equal(room.tray.filter(id=>area.clues.some(c=>c.id===id)).length,10)
 await js(`document.querySelector('iframe').contentWindow.__room.enterTable()`);await delay(800);await shot('collection-clues');report.checks.push({collection:room})
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));sql.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0)
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)})
