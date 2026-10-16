const {app,BrowserWindow,screen}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),map=process.env.FOCUSQUEST_QUIET_MAP||'area-01-cloud-ruins'
const data=process.env.FOCUSQUEST_QA_USER_DATA
assert(data&&path.basename(data).startsWith('focusquest-quiet-verify-'),'An isolated QA save is required')
const output=path.join(root,'previews','focus-quiet-qa',map);fs.mkdirSync(output,{recursive:true})
const report={map,checks:[],errors:[]},delay=ms=>new Promise(r=>setTimeout(r,ms));let win,db
const evaluate=s=>win.webContents.executeJavaScript(s,true)
async function until(s,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(s).catch(()=>false))return;await delay(100)}throw Error('Timed out: '+s)}
async function capture(name){fs.writeFileSync(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG())}
require(path.join(root,'out','main','index.js'))
;(async()=>{
 await app.whenReady();const end=Date.now()+20000;while(!win&&Date.now()<end){win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');await delay(100)}assert(win)
 const display=screen.getAllDisplays().find(d=>d.id!==screen.getPrimaryDisplay().id)||screen.getPrimaryDisplay();win.setBounds({x:display.workArea.x+10,y:display.workArea.y+10,width:1280,height:800});win.showInactive();report.secondary=display.id!==screen.getPrimaryDisplay().id
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)})
 await until('!!window.focusQuest')
 db=new (require('better-sqlite3'))(path.join(data,'focusquest.db'))
 const s=await evaluate(`(async()=>{let s=await window.focusQuest.addListTask({title:'安靜模式實機驗證'});return window.focusQuest.startDailyRun(s.taskList.nextTaskId)})()`)
 const node=s.expeditionNodes[0];db.prepare('UPDATE expedition_nodes SET area_id=?,planned_minutes=50 WHERE id=?').run(map,node.id)
 await evaluate(`window.focusQuest.selectExpeditionNode(${JSON.stringify(s.todayRun.id)},${JSON.stringify(node.id)})`)
 const started=await evaluate(`window.focusQuest.startListFocus({minimumMinutes:5,blockedProcessNames:[],runId:${JSON.stringify(s.todayRun.id)},nodeId:${JSON.stringify(node.id)},plannedMinutes:50})`)
 assert(started.activeSession.beforeFocus?.queue.length);const id=started.activeSession.id
 await until(`!!document.querySelector('.focus-event-playback canvas')&&!!document.querySelector('.before-focus-playback')`)
 await delay(2500)
 let active=await evaluate('window.focusQuest.getSnapshot()');assert.equal(active.activeSession.pausedSeconds,0);assert.equal(active.activeSession.startedAt,active.activeSession.suspendedAt)
 assert(!await evaluate(`!!document.querySelector('.focus-event-error')`));await until(`!!document.elementFromPoint(640,740)?.closest('.before-focus-playback')`);await capture('01-before-focus')
 report.checks.push('Full story scene mounts before Focus, effective time held at zero')
 await evaluate(`(async()=>{const s=await window.focusQuest.getSnapshot();for(const e of s.activeSession.beforeFocus.queue)await window.focusQuest.beginBeforeFocusEvent(${JSON.stringify(id)},e.id);return window.focusQuest.finishBeforeFocus(${JSON.stringify(id)},s.activeSession.beforeFocus.queue.map(e=>e.id))})()`)
 await until(`!document.querySelector('.before-focus-playback')`);await delay(2000)
 const filters=await evaluate(`Array.from(document.querySelectorAll('.area-scene-destination canvas')).map(c=>c.style.filter)`)
 assert(filters.some(f=>f.includes('brightness(0.75)')&&f.includes('saturate(0.8)')),JSON.stringify(filters));await capture('02-quiet')
 await evaluate(`window.focusQuest.updateSettings({focusPresentation:'live'})`)
 assert.equal((await evaluate('window.focusQuest.getSnapshot()')).activeSession.presentation,'quiet')
 await evaluate(`window.focusQuest.pauseFocus(${JSON.stringify(id)})`);let paused=db.prepare('SELECT * FROM sessions WHERE id=?').get(id);await delay(1100);assert.equal(db.prepare('SELECT * FROM sessions WHERE id=?').get(id).suspended_at,paused.suspended_at)
 await evaluate(`window.focusQuest.resumeFocus(${JSON.stringify(id)})`)
 db.prepare('UPDATE sessions SET started_at=?,paused_seconds=0 WHERE id=?').run(new Date(Date.now()-1300000).toISOString(),id)
 await delay(2200)
 const events=await evaluate('window.focusQuest.listReplayEvents()');assert(events.length>0)
 await evaluate(`window.focusQuest.beginSessionDebrief(${JSON.stringify(id)})`)
 const recap=await evaluate(`window.focusQuest.getFocusRecap(${JSON.stringify(id)})`);assert.equal(recap.lamps.length,2);report.checks.push('Quiet filter, mid-Focus setting lock, pause/resume, background ledger and recap IPC passed')
 const before=db.prepare('SELECT payload FROM focus_event_records ORDER BY id').all();for(const e of events)await evaluate(`window.focusQuest.getReplayEvent(${JSON.stringify(e.id)})`);assert.deepEqual(db.prepare('SELECT payload FROM focus_event_records ORDER BY id').all(),before)
 report.checks.push('Replay reads preserve every recorded payload');assert.equal(report.errors.length,0,report.errors.join('\n'))
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));db.close();app.exit(0)
})().catch(e=>{report.errors.push(e.stack);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));try{db?.close()}catch{};app.exit(1)})
