// Production App, preload and SQLite recovery; writes exclusively to a disposable QA profile.
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),Database=require('better-sqlite3')
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/moss-camera-app-qa'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'fq-camera-app-'))
fs.mkdirSync(out,{recursive:true});Object.assign(process.env,{FOCUSQUEST_QA_USER_DATA:profile,FOCUSQUEST_QA_SEED:'1',FOCUSQUEST_QA_EXPEDITION:'selected'})
BrowserWindow.prototype.show=function(){this.showInactive()}
const report={profile,checks:[],events:[],errors:[]},delay=ms=>new Promise(r=>setTimeout(r,ms));let win,sql
const js=s=>win.webContents.executeJavaScript(s,true),call=(m,...a)=>js(`window.focusQuest[${JSON.stringify(m)}](...${JSON.stringify(a)})`)
async function until(f,label){const end=Date.now()+40000;while(Date.now()<end){if(await f())return;await delay(100)}throw Error('Timeout: '+label)}
async function shot(name){await delay(200);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())}
async function handle(){return js(`(()=>{const host=document.querySelector('.focus-active .biome-moss-station');let fiber=host&&host[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];for(;fiber;fiber=fiber.return){for(let h=fiber.memoizedState;h&&typeof h==='object';h=h.next){const handle=h.memoizedState?.current;if(handle?.areaId==='area-02-moss-station'&&handle.debugState){window.qaScene=handle;return handle.debugState()}}}return null})()`)}
require(path.join(root,'out/main/index.js'))
;(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win},'window')
 const primary=screen.getPrimaryDisplay(),display=screen.getAllDisplays().find(d=>d.id!==primary.id)||primary;report.secondary=display.id!==primary.id;win.setBounds({x:display.workArea.x+10,y:display.workArea.y+10,width:1320,height:860});win.showInactive()
 win.webContents.on('console-message',details=>{if(details.level==='error')report.errors.push(details.message)})
 await until(()=>js('Boolean(document.querySelector(".la-route"))'),'lobby');sql=new Database(path.join(profile,'focusquest.db'))
 let s=await call('getSnapshot'),node=s.expeditionNodes.find(n=>n.areaId==='area-02-moss-station')
 // Candidate generation has three released maps; select Moss deterministically only inside QA.
 if(!node){node=s.expeditionNodes[0];sql.prepare('UPDATE expedition_nodes SET area_id=?,title=? WHERE id=?').run('area-02-moss-station','苔痕驛站',node.id)}
 await call('selectExpeditionNode',s.todayRun.id,node.id)
 s=await call('startListFocus',{minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun.id,nodeId:node.id,plannedMinutes:50})
 await until(()=>handle(),'Moss production scene');await delay(9000)
 const session=s.activeSession.id;sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(Date.now()-400000).toISOString(),session)
 await delay(1600);await call('pauseFocus',session);await delay(300)
 const area=JSON.parse(fs.readFileSync(path.join(root,'docs/area-02-moss-station.scene.json'),'utf8'))
 for(const ev of area.storyEvents){
   const current=await call('getMossScene',node.id),seconds=current.effectiveSeconds
   const state=JSON.parse(sql.prepare('SELECT state_json FROM area_scene_states WHERE node_id=?').get(node.id).state_json)
   state.seconds=seconds;state.action={id:10000+report.events.length,kind:'event',node:ev.spot,route:[ev.spot],startSeconds:seconds-ev.dur[1]*.4,endSeconds:seconds+ev.dur[1]*.6,eventId:ev.id,anim:ev.anim};state.node=ev.spot
   sql.prepare('UPDATE area_scene_states SET state_json=? WHERE node_id=?').run(JSON.stringify(state),node.id)
   await call('updateSettings',{});await delay(200);await js('qaScene.snapCamera();qaScene.renderNow()')
   const saved=await call('getMossScene',node.id),view=await handle();assert.equal(view.story.id,ev.id);assert(Math.abs(view.story.p-.4)<.01,JSON.stringify({event:ev.id,saved,view}))
   assert(Math.abs(view.story.p-(saved.effectiveSeconds-saved.action.startSeconds)/(saved.action.endSeconds-saved.action.startSeconds))<.01)
   await shot(ev.id);report.events.push({id:ev.id,p:view.story.p,z:view.director.z})
   if(ev.id==='story_second_sketch'){
     const frozen=await handle();await delay(800);assert.deepEqual((await handle()).director,frozen.director)
     win.reload();await until(()=>handle(),'paused reload');await delay(1300);const restored=await handle();assert(Math.abs(restored.director.z-frozen.director.z)<.01)
     assert.equal((await call('getSnapshot')).activeSession.id,session);report.checks.push('Paused SQLite event resumes at exact shot after renderer reload')
     win.minimize();await delay(500);win.restore();await delay(200);assert(Math.abs((await handle()).director.z-frozen.director.z)<.01)
   }
 }
 await call('resumeFocus',session);await until(async()=>{const view=await handle();return view.story?.p>.4},'resumed progress');report.checks.push('Resume advances the same saved event progress')
 sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(Date.now()-1800000).toISOString(),session)
 await delay(1700);const backend=await call('getMossScene',node.id),fast=await handle();assert.equal(fast.lampsLit,backend.litLampCount);assert(Math.abs(fast.sim-backend.effectiveSeconds)<2)
 report.checks.push('Real backend fast-forward catches up lamps/action independently of the camera')
 await call('pauseFocus',session);const row=sql.prepare('SELECT state_json FROM area_scene_states WHERE node_id=?').get(node.id),state=JSON.parse(row.state_json)
 state.action={...state.action,id:99999,kind:'wait',eventId:null,startSeconds:state.seconds,endSeconds:state.seconds+60}
 sql.prepare('UPDATE area_scene_states SET state_json=? WHERE node_id=?').run(JSON.stringify(state),node.id);await call('updateSettings',{});await js('qaScene.snapCamera();qaScene.renderNow()')
 assert.equal((await handle()).director.z,1);await shot('home-after-event');report.checks.push('Story completion restores home frame')
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));sql.close();app.exit(0)
})().catch(e=>{console.error(e);app.exit(1)})
