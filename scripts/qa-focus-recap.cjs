// Full-app QA. Fictional replay fixtures are written only to this disposable save.
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),map=process.env.FOCUSQUEST_RECAP_MAP||'area-01-cloud-ruins',data=process.env.FOCUSQUEST_QA_USER_DATA
const scenario=process.env.FOCUSQUEST_RECAP_CASE||'auto'
assert(data&&path.basename(data).startsWith('focusquest-recap-verify-'),'A disposable QA save is required')
const output=path.join(root,'previews','focus-recap-qa',scenario==='auto'?map:map+'-'+scenario);fs.mkdirSync(output,{recursive:true})
const report={map,scenario,checks:[],errors:[]},delay=ms=>new Promise(r=>setTimeout(r,ms));let win,db
const ev=s=>Promise.race([win.webContents.executeJavaScript(s,true),new Promise((_,reject)=>setTimeout(()=>reject(Error('Evaluation stalled: '+s.slice(0,90))),10000))])
async function until(s,ms=45000){const end=Date.now()+ms;while(Date.now()<end){if(await ev(s).catch(()=>false))return;await delay(100)}throw Error('Timed out: '+s)}
async function capture(name){await ev('window.recapCapture=true');try{fs.writeFileSync(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG())}finally{await ev('window.recapCapture=false')}}
function phase(p){report.phase=p;fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(report,null,2))}
const state=()=>ev(`({mode:document.querySelector('.focus-recap')?.dataset.mode,event:document.querySelector('.focus-recap')?.dataset.event,error:document.querySelector('.fr-error')?.textContent,head:Number(document.querySelector('.fr-track')?.getAttribute('aria-valuenow')),lamps:document.querySelectorAll('.fr-lamp.lit').length,card:document.querySelector('.fr-card')?.textContent,canvases:document.querySelectorAll('.fr-scene canvas:not([data-recap-still])').length})`)
const events={
 'area-01-cloud-ruins':['rare_well_wick','whistle','rare_astro_core'],
 'area-02-moss-station':['rare_cart_tag','carry_old_wick','rare_drawer_compass'],
 'area-03-reflection-lake':['rare_gauge_plate','story_core_ring','rare_ring_mirror'],
 'area-07-glass-nursery':['find_pressed_leaf','carry_silvered_shard','find_core']
}
require(path.join(root,'out','main','index.js'))
;(async()=>{
 await app.whenReady();await delay(500);win=BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('blocker'));assert(win)
 const display=screen.getAllDisplays().find(d=>d.id!==screen.getPrimaryDisplay().id)||screen.getPrimaryDisplay();win.setBounds({x:display.workArea.x+10,y:display.workArea.y+10,width:1280,height:800});win.showInactive();report.secondary=display.id!==screen.getPrimaryDisplay().id
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)})
 win.webContents.on('render-process-gone',(_e,detail)=>{report.errors.push(detail);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2))})
 await until('!!window.focusQuest');phase('seed isolated session')
 if(process.env.FOCUSQUEST_RECAP_DEBUG==='1'){
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Debugger.enable');await win.webContents.debugger.sendCommand('Debugger.setPauseOnExceptions',{state:'uncaught'})
  win.webContents.debugger.on('message',async(_e,method,p)=>{if(method!=='Debugger.paused')return;try{report.exceptionFrames=[];for(const frame of p.callFrames){let expression;if(frame.functionName==='flatten')expression=`JSON.stringify({first:array[0],arrayType:array.constructor.name,length:array.length})`;else if(frame.functionName.includes('setValueV4'))expression=`JSON.stringify({id:this.id})`;else if(frame.functionName==='renderFrame')expression=`JSON.stringify({camera:camera.position.toArray(),matrix:camera.matrixWorldInverse.elements,target:target.toArray(),size:[host.clientWidth,host.clientHeight],lobby,view})`;if(expression){const result=await win.webContents.debugger.sendCommand('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression});report.exceptionFrames.push({function:frame.functionName,result})}}fs.writeFileSync(path.join(output,'debug.json'),JSON.stringify(report,null,2))}finally{await win.webContents.debugger.sendCommand('Debugger.resume')}})
 }
 await ev(`window.recapRuntimeErrors=[];window.addEventListener('error',e=>window.recapRuntimeErrors.push({message:e.message,stack:e.error?.stack,mode:document.querySelector('.focus-recap')?.dataset.mode,event:document.querySelector('.focus-recap')?.dataset.event}))`)
 if(scenario==='live')await ev(`window.focusQuest.updateSettings({focusPresentation:'live'})`)
 if(scenario==='reduced'){win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert(await ev(`window.matchMedia('(prefers-reduced-motion: reduce)').matches`))}
 db=new(require('better-sqlite3'))(path.join(data,'focusquest.db'))
 let s=await ev(`(async()=>{const s=await window.focusQuest.addListTask({title:'結算回顧實機檢查'});return window.focusQuest.startDailyRun(s.taskList.nextTaskId)})()`),node=s.expeditionNodes[0]
 db.prepare('UPDATE expedition_nodes SET area_id=?,title=?,planned_minutes=50 WHERE id=?').run(map,{'area-01-cloud-ruins':'雲上遺庭','area-02-moss-station':'苔痕驛站','area-03-reflection-lake':'倒映湖','area-07-glass-nursery':'玻璃苗圃'}[map],node.id)
 await ev(`window.focusQuest.selectExpeditionNode(${JSON.stringify(s.todayRun.id)},${JSON.stringify(node.id)})`)
 s=await ev(`window.focusQuest.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:${JSON.stringify(s.todayRun.id)},nodeId:${JSON.stringify(node.id)},plannedMinutes:50})`)
 const id=s.activeSession.id;for(const e of s.activeSession.beforeFocus?.queue??[])await ev(`window.focusQuest.beginBeforeFocusEvent(${JSON.stringify(id)},${JSON.stringify(e.id)})`)
 s=await ev(`window.focusQuest.finishBeforeFocus(${JSON.stringify(id)})`)
 const intro=JSON.parse(db.prepare('SELECT payload FROM focus_event_records WHERE session_id=? LIMIT 1').get(id).payload)
 const insert=db.prepare('INSERT INTO focus_event_records (id,session_id,run_id,node_id,event_id,payload) VALUES (?,?,?,?,?,?)')
 const scene={cloud:s.cloudStory,moss:s.mossStation,lake:s.lake,nursery:s.nursery,worldMarks:[],coreTaken:false}
 for(const [i,eventId]of (scenario==='empty'?[]:events[map]).entries()){
  const record={...intro,id:'recap-qa-'+i,eventId,variant:eventId,phase:'focus',kind:i===2?'core':i===1?'story':'item',effectiveSeconds:[600,1800,1200][i],explorationSeconds:[600,1800,1200][i],scene,skipped:false}
  insert.run(record.id,id,record.runId,record.nodeId,eventId,JSON.stringify(record))
 }
 await delay(6000);phase('finish Focus');db.prepare('UPDATE sessions SET started_at=?,paused_seconds=0 WHERE id=?').run(new Date(Date.now()-(scenario==='empty'?180:3000)*1000).toISOString(),id)
 await ev(`window.focusQuest.beginSessionDebrief(${JSON.stringify(id)})`)
 await delay(1000);report.initialUI=await ev(`({recap:document.querySelector('.focus-recap')?.outerHTML,body:document.body.innerText})`);phase('recap preparation')
 await until(`document.querySelector('.focus-recap')?.dataset.ready==='true'`);assert(!(await state()).error)
 if(scenario!=='auto'){
  const before=db.prepare('SELECT payload FROM focus_event_records ORDER BY id').all()
  if(scenario==='empty'){await until(`document.querySelector('.focus-recap')?.dataset.mode==='ask'`);assert.equal(await ev(`document.querySelectorAll('.fr-marker').length`),0);report.checks.push('Empty short Focus completes the quiet timeline and reaches the task question without changing exploration')}
  else if(scenario==='live'){assert.equal((await state()).mode,'ask');await delay(700);assert.equal((await state()).event,'');await ev(`document.querySelector('.fr-marker').click()`);await until(`document.querySelector('.focus-recap')?.dataset.mode==='single'`);await delay(800);await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);assert.equal((await state()).mode,'ask');report.checks.push('Live session has no autoplay; marker plays one event and Esc restores the question')}
  else if(scenario==='reduced'){await until(`!!document.querySelector('.fr-card')`);assert(await ev(`document.querySelector('.focus-recap').classList.contains('reduced')`));await delay(700);await capture('static-event');await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);report.checks.push('Reduced-motion preference uses a static event frame and card; Esc remains available')}
  await capture('question');assert.deepEqual(db.prepare('SELECT payload FROM focus_event_records ORDER BY id').all(),before)
  await ev(`document.querySelector('.fr-answers .fr-primary').click()`);await until(`!document.querySelector('.focus-recap')`);assert.equal(report.errors.length,0,report.errors.join('\n'));phase('passed');fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));db.close();app.exit(0);return
 }
 await ev(`window.recapCanvas=document.querySelector('.fr-scene canvas:not([data-recap-still])');window.frameGaps=[];window.recapLongTasks=[];window.lastRecapTransition=performance.now();window.recapSwitchObserver=new MutationObserver(()=>window.lastRecapTransition=performance.now());window.recapSwitchObserver.observe(document.querySelector('.focus-recap'),{attributes:true,attributeFilter:['data-event','data-mode']});window.recapObserver=new PerformanceObserver(list=>window.recapLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));window.recapObserver.observe({type:'longtask',buffered:false});window.recapSampling=true;let previous=performance.now(),capture=false;function sample(now){if(!window.recapSampling)return;window.frameGaps.push({duration:now-previous,capture:capture||!!window.recapCapture,switchAge:performance.now()-window.lastRecapTransition});previous=now;capture=!!window.recapCapture;requestAnimationFrame(sample)}requestAnimationFrame(sample)`)
 await until(`document.querySelector('.focus-recap')?.dataset.event===${JSON.stringify(events[map][0])}`);await delay(1500);await capture('01-event')
 phase('scrub automatic event');const point=await ev(`(()=>{window.recapPointers=[];for(const type of ['pointerdown','gotpointercapture','lostpointercapture','pointerup','pointercancel'])document.addEventListener(type,e=>window.recapPointers.push({type,target:e.target.className,buttons:e.buttons,mode:document.querySelector('.focus-recap')?.dataset.mode,focused:document.hasFocus()}),true);const r=document.querySelector('[data-record-id="recap-qa-1"]').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`)
 win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});await delay(150);win.webContents.sendInputEvent({type:'mouseMove',...point,modifiers:['leftButtonDown']});await delay(150)
 report.pointers=await ev('window.recapPointers')
 assert.equal((await state()).mode,'scrub');assert.equal((await state()).event,'');assert.equal((await state()).head,1800);await capture('02-scrub')
 win.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1})
 await until(`document.querySelector('.focus-recap')?.dataset.event===${JSON.stringify(events[map][1])}`);await delay(1000);await capture('03-resumed-story')
 await ev(`Array.from(document.querySelectorAll('.fr-controls button')).find(b=>b.textContent==='跳過這段').click()`)
 await until(`document.querySelector('.focus-recap')?.dataset.event===${JSON.stringify(events[map][2])}`);await delay(4500);await capture('04-core-last')
 await ev(`document.querySelector('.fr-controls button').click()`)
 await until(`document.querySelector('.focus-recap')?.dataset.mode==='ask'`);await capture('05-question')
 const before=db.prepare('SELECT payload FROM focus_event_records ORDER BY id').all()
 phase('single replay and rapid cancellation')
 await ev(`document.querySelectorAll('.fr-marker')[0].click()`);await until(`document.querySelector('.focus-recap')?.dataset.mode==='single'`);await delay(1200);await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`)
 await until(`document.querySelector('.focus-recap')?.dataset.mode==='ask'`)
 for(let i=0;i<12;i++){await ev(`document.querySelectorAll('.fr-marker')[${i%3}].click()`);await delay(180);await ev(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);await delay(180)}
 assert.equal(await ev(`window.recapCanvas===document.querySelector('.fr-scene canvas:not([data-recap-still])')`),true)
 assert.equal((await state()).canvases,1);assert.deepEqual(db.prepare('SELECT payload FROM focus_event_records ORDER BY id').all(),before)
 const performance=await ev(`(()=>{window.recapSampling=false;window.recapObserver.disconnect();window.recapSwitchObserver.disconnect();const all=window.frameGaps.slice(2),gaps=all.filter(f=>!f.capture).map(f=>f.duration).sort((a,b)=>a-b),switches=all.filter(f=>!f.capture&&f.switchAge<350).map(f=>f.duration);return {frames:gaps.length,p95:gaps[Math.floor(gaps.length*.95)],max:gaps.at(-1),rawMax:Math.max(...all.map(f=>f.duration)),switchFrames:switches.length,maxSwitch:Math.max(...switches),over100Switch:switches.filter(n=>n>100).length,longTasks:window.recapLongTasks}})()`);report.performance=performance
 assert.equal(performance.over100Switch,0,JSON.stringify(performance));assert(performance.p95<50,JSON.stringify(performance))
 report.checks.push('Automatic event interrupted by scrub; 18px marker seek resumes; core last; skip current/all/Esc; question and one-event replay; same canvas; ledger byte-identical')
 await ev(`document.querySelector('.fr-answers .fr-primary').click()`);await until(`!document.querySelector('.focus-recap')&&!document.querySelector('.focus-active')`)
 assert.equal(db.prepare('SELECT outcome FROM sessions WHERE id=?').get(id).outcome,'completed');report.checks.push('Task answer saved and returned to the lobby')
 report.runtime=await ev('window.recapRuntimeErrors');assert.equal(report.errors.length,0,report.errors.join('\n'));phase('passed');fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));db.close();app.exit(0)
})().catch(async e=>{report.errors.push(e.stack);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));report.ui=await ev(`({recap:document.querySelector('.focus-recap')?.outerHTML,scenes:Array.from(document.querySelectorAll('.recap-scene')).map(e=>e.outerHTML.slice(0,1000)),body:document.body.innerText})`).catch(()=>null);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await capture('failure').catch(()=>undefined);try{db?.close()}catch{};app.exit(1)})
