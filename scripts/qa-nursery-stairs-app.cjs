// Real application and saved-action adapter check, isolated from the player's save.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),Database=require('better-sqlite3');
const root=path.resolve(__dirname,'..'),bundle=process.env.FOCUSQUEST_QA_BUNDLE||root,profile=fs.mkdtempSync(path.join(os.tmpdir(),'fq-stairs-app-'));
const out=path.join(root,'previews/stair-fix-qa',bundle===root?'app':'shipped');fs.mkdirSync(out,{recursive:true});
Object.assign(process.env,{FOCUSQUEST_QA_USER_DATA:profile,FOCUSQUEST_QA_SEED:'1',FOCUSQUEST_QA_EXPEDITION:'selected'});
BrowserWindow.prototype.show=function(){};BrowserWindow.prototype.showInactive=function(){};
const report={errors:[],checks:[],bundle};let win,sql;
const delay=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s,true),call=(m,...a)=>js(`window.focusQuest[${JSON.stringify(m)}](...${JSON.stringify(a)})`);
async function until(f,label){for(let i=0;i<450;i++){if(await f())return;await delay(100)}throw Error(label)}
require(path.join(bundle,'out/main/index.js'));
(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win},'app window');
 win.webContents.setAudioMuted(true);win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 await until(()=>js('!!document.querySelector(".la-route")'),'routes');let s=await call('getSnapshot');sql=new Database(path.join(profile,'focusquest.db'));const node=s.expeditionNodes[0];
 sql.prepare('UPDATE expedition_nodes SET area_id=?,title=? WHERE id=?').run('area-07-glass-nursery','玻璃苗圃',node.id);
 await call('selectExpeditionNode',s.todayRun.id,node.id);s=await call('startListFocus',{minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun.id,nodeId:node.id,plannedMinutes:50});
 await until(()=>js('!!window.__nurseryScene?.qa.testState().ready'),'production renderer');await call('pauseFocus',s.activeSession.id);await delay(300);
 for(const [from,to,id] of [['G2','CT',900],['CT','G2',901]]){
  const result=await js(`(()=>{const scene=__nurseryScene,q=scene.qa;scene.setNurseryState({areaId:'area-07-glass-nursery',nodeId:'qa',seed:1,effectiveSeconds:0,coreTaken:false,worldMarks:{potUpright:false,glassWiped:false,shardPile:false,saplingInLuggage:false,saplingPlanted:false,saplingStage:-1,saplingTransplanted:false},action:{id:${id},kind:'walk',node:'${to}',fromNode:'${from}',route:['${from}','${to}'],startSeconds:0,endSeconds:30}});scene.setProgress(0);scene.renderNow();const path=q.edgePts('${from}','${to}'),samples=[];for(let i=0;i<33;i++){q.seek(1);const p=scene.debugState().position;samples.push(p);let min=Infinity;for(let d=0;d<=q.polyLen(path);d+=.01)min=Math.min(min,q.polyAt(path,d).pos.distanceTo(new q.T.Vector3(...p)));if(min>.02)throw Error('saved walk left the spiral: '+min)}return {from:'${from}',to:'${to}',samples,end:scene.debugState().position,target:q.NP('${to}').toArray()}})()`);
  assert(Math.hypot(...result.end.map((v,i)=>v-result.target[i]))<.04);report.checks.push(from+' -> '+to+' saved action follows spiral and reaches endpoint');report[from]=result;
 }
 // Capture the actual nursery framebuffer: hidden Electron compositor captures may retain the campfire frame.
 const png=await js('(()=>{const q=__nurseryScene.qa;q.renderer.render(q.scene,q.camera);return q.renderer.domElement.toDataURL("image/png")})()');
 fs.writeFileSync(path.join(out,'scene.png'),Buffer.from(png.split(',')[1],'base64'));
 assert.equal(report.errors.length,0);sql.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0);
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});

