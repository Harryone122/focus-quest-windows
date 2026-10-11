const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),Database=require('better-sqlite3')
const root=path.resolve(__dirname,'..'),bundle=process.env.FOCUSQUEST_QA_BUNDLE||root,out=process.env.FOCUSQUEST_QA_OUT||path.join(root,'previews/area03-integration-qa',bundle===root?'source':'shipped'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'fq-lake-'))
fs.mkdirSync(out,{recursive:true});Object.assign(process.env,{FOCUSQUEST_QA_USER_DATA:profile,FOCUSQUEST_QA_SEED:'1',FOCUSQUEST_QA_EXPEDITION:'selected'});app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');BrowserWindow.prototype.show=function(){this.showInactive()}
const report={checks:[],errors:[],profile,bundle},delay=ms=>new Promise(r=>setTimeout(r,ms));let win,sql
const js=s=>win.webContents.executeJavaScript(s,true),call=(m,...a)=>js(`window.focusQuest[${JSON.stringify(m)}](...${JSON.stringify(a)})`),snap=()=>call('getSnapshot'),has=s=>js(`!!document.querySelector(${JSON.stringify(s)})`),click=s=>js(`document.querySelector(${JSON.stringify(s)}).click()`)
async function until(f,label){const end=Date.now()+40000;while(Date.now()<end){if(await f())return;await delay(150)}throw Error('Timeout: '+label)}
async function shot(name){fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())}
require(path.join(bundle,'out/main/index.js'))
;(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win},'window')
 const primary=screen.getPrimaryDisplay(),display=screen.getAllDisplays().find(d=>d.id!==primary.id)||primary;report.secondary=display.id!==primary.id;win.setBounds({x:display.workArea.x+10,y:display.workArea.y+10,width:1280,height:800});win.showInactive();win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});win.webContents.on('render-process-gone',(_e,d)=>report.errors.push(d))
 await until(()=>has('.la-route'),'routes');sql=new Database(path.join(profile,'focusquest.db'));let s=await snap(),node=s.expeditionNodes[0]
 sql.prepare('UPDATE expedition_nodes SET area_id=?,title=? WHERE id=?').run('area-03-reflection-lake','倒影湖畔',node.id)
 await call('selectExpeditionNode',s.todayRun.id,node.id)
 win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Page.enable');await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:`window.qaAudio=[];const OriginalAudio=window.AudioContext;window.AudioContext=class extends OriginalAudio{constructor(...a){super(...a);this.decoded=0;window.qaAudio.push(this)}async decodeAudioData(...a){const b=await super.decodeAudioData(...a);this.decoded++;return b}}`})
 win.reload();await until(()=>has('.la-panel .la-primary:not(:disabled)'),'lobby');await click('.la-panel .la-primary');await until(()=>has('.la-depart'),'sheet');await js(`document.querySelector('.la-depart-phone input:not(:checked)')?.click()`);await click('.la-depart-actions .la-primary')
 await until(()=>js('Boolean(window.__lakeScene)'),'lake canvas');await delay(9000);await until(()=>js('Boolean(window.qaAudio?.some(c=>c.decoded===28))'),'28 audio decoded')
 assert(await has('.biome-reflection-lake canvas'));await shot('01-focus');report.initial=await js('__lakeScene.debugState()');report.checks.push('Production lake and all 28 packaged recordings load')
 s=await snap();sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(Date.now()-1230000).toISOString(),s.activeSession.id)
 await until(async()=>((await call('getLakeScene',node.id))?.litLampCount===2),'backend two lamps');await delay(1200);report.at1230=await js('__lakeScene.debugState()');assert.equal(Math.floor(report.at1230.sim/600),2)
 await call('pauseFocus',s.activeSession.id);await delay(500);const frozen=await js('__lakeScene.debugState()');await delay(600);assert.equal((await js('__lakeScene.debugState()')).sim,frozen.sim);assert(await js('qaAudio.every(c=>c.state!="running")'));await shot('02-paused');await call('resumeFocus',s.activeSession.id);await delay(500);report.checks.push('Backend lamps, saved tide, pause and audio suspension/resumption')
 await call('updateSettings',{audioMuted:true});await delay(250);assert(await js('qaAudio.every(c=>c.state!="running")'));await call('updateSettings',{audioMuted:false});await delay(250)
 // Inspect authored visual sequences without writing a reward or advancing focus time.
 const area=JSON.parse(fs.readFileSync(path.join(root,'docs/area03/area-03-reflection-lake.scene.json'),'utf8'));await js('__lakeScene.setInspection(true);__lakeScene.setPaused(true)')
 report.views=[]
 for(const time of ['dawn','day','dusk','night'])for(const tide of [0,1]){await js(`__lakeScene.qa.setTime('${time}');__lakeScene.qa.setTide(${tide});__lakeScene.qa.render()`);await delay(150);await shot(`view-${time}-${tide}`);report.views.push(await js('__lakeScene.debugState()'))}
 for(const e of area.events){await js(`__lakeScene.qa.${e.rare?'rare':'event'}('${e.id}',0.6);__lakeScene.qa.render()`);report.checks.push(e.id)}
 for(const e of area.restActivities){await js(`__lakeScene.qa.rest('${e.id}',0.5);__lakeScene.qa.render()`);report.checks.push(e.id)}
 await js('__lakeScene.qa.rest("rest_cup_first",0.6);__lakeScene.qa.focus(1.5,9,.4,9);__lakeScene.qa.render()');await delay(150);await shot('03-rest-cup')
 await js('__lakeScene.qa.rare("rare_ring_mirror",0.65);__lakeScene.qa.follow(8,31,.5);__lakeScene.qa.render()');await delay(150);await shot('04-core-reflection')
 for(const exit of ['a','b'])for(const t of [1,2.8,3.4,4.1,5]){await js(`__lakeScene.qa.depart('${exit}',${t});__lakeScene.qa.render()`);report.checks.push(`departure ${exit} ${t}`)}
 await js('__lakeScene.qa.focus();__lakeScene.qa.setTide(null);__lakeScene.qa.setTime("auto");__lakeScene.setInspection(false);__lakeScene.setPaused(false)')
 sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(Date.now()-3600000).toISOString(),s.activeSession.id);await delay(1300)
 await call('finishListFocus',s.activeSession.id,false);await call('dismissDebrief',s.activeSession.id);await until(()=>has('.la-route'),'lake lobby');await delay(1000);await shot('05-lake-lobby');const full=await snap();report.lobby=full.expeditionNodes.filter(n=>n.parentNodeId===node.id);assert.deepEqual(report.lobby.map(n=>n.lakeExitId).sort(),['a_arch','b_far'])
 const next=report.lobby[0];await call('chooseNextRoute',full.todayRun.id,node.id,next.id);await call('startListFocus',{minimumMinutes:5,blockedProcessNames:[],runId:full.todayRun.id,nodeId:next.id,plannedMinutes:50});await delay(1500);assert(await has('[data-area-layer="source"] .biome-reflection-lake canvas'));await shot('06-lake-departure');await delay(5500);assert(await has('[data-area-layer="destination"] canvas'));await shot('07-destination');report.checks.push('Lake lobby, both exits and production cross-map departure')
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));sql.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0)
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)})
