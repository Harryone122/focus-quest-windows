const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'previews', 'forest-0.6.6-qa')
fs.mkdirSync(out, {recursive:true})
const data = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-forest-qa-'))
process.env.FOCUSQUEST_QA_USER_DATA=data
process.env.FOCUSQUEST_QA_SEED='1'
process.env.FOCUSQUEST_QA_EXPEDITION='selected'
process.env.FOCUSQUEST_QA_VIEW='focus'
const delay = ms=>new Promise(r=>setTimeout(r,ms))
let win, sql
const report={data,checks:[],errors:[]}
const exec=js=>win.webContents.executeJavaScript(js,true)
const snapshot=()=>exec('window.focusQuest.getSnapshot()')
async function until(fn,timeout=20000) { const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await delay(250)}throw Error('QA condition timeout') }
async function capture(name){const img=await win.webContents.capturePage();fs.writeFileSync(path.join(out,name+'.png'),img.toPNG());return img.crop({x:0,y:180,width:img.getSize().width,height:Math.min(600,img.getSize().height-180)}).toBitmap()}
async function reload(){const loaded=new Promise(r=>win.webContents.once('did-finish-load',r));win.webContents.reload();await loaded;await until(()=>exec("!!document.querySelector('.focus-pause-button') && !!document.querySelector('canvas')"));await delay(2000)}
require(path.join(root,'out/main/index.js'))
;(async()=>{
 await app.whenReady()
 await until(async()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win})
 win.webContents.setBackgroundThrottling(false)
 win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)report.errors.push(message)})
 await until(()=>exec("!!document.querySelector('.focus-pause-button') && !!document.querySelector('canvas')"))
 sql=new Database(path.join(data,'focusquest.db'))
 let s=await snapshot();const id=s.activeSession.id,node=s.activeSession.nodeId
 sql.prepare('UPDATE forest_explorations SET journey_item=?, journey_lamp=1, guaranteed_lamp=1 WHERE node_id=?').run('old_wick',node)
 sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(Date.now()-600000).toISOString(),id)
 await until(async()=> (await snapshot()).specialFinds.length===2)
 s=await snapshot();assert.equal(s.mapCores[0].itemKey,'astrolabe_core')
 assert.deepEqual(s.specialFinds.map(f=>f.itemKey),['old_wick','astrolabe_core'])
 await capture('01-live-award-saved')
 report.checks.push('Real main-process ticker saves independent journey/core results and broadcasts the official core field')
 await exec(`window.focusQuest.pauseFocus(${JSON.stringify(id)})`);await delay(2500)
 const first=await capture('02-paused')
 await delay(2000);const second=await capture('03-still-paused')
 assert(first.equals(second),'paused map pixels remain identical (UI status pulse excluded)')
 report.checks.push('Paused integrated scene is pixel-identical; no award replay')
 // Advance ONLY this isolated fixture to rest. Reopening must restore core/marks from SQLite.
 sql.prepare('UPDATE sessions SET started_at=?, suspended_at=NULL, paused_seconds=0, manual_paused=0 WHERE id=?').run(new Date(Date.now()-3000000).toISOString(),id)
 await reload()
 await capture('04-rest-core-owned')
 console.log('Awards and pause passed; waiting for authored tree-traces animation acknowledgement.')
 await until(async()=> (await snapshot()).worldMarks.some(m=>m.mark==='tree_traces_seen'),100000)
 await capture('05-tree-memory-saved')
 report.checks.push('Actual tree animation callback saved tree_traces_seen through preload/IPC')
 const marks=(await snapshot()).worldMarks
 await reload();await delay(4000)
 assert.deepEqual((await snapshot()).worldMarks,marks)
 const activity = await exec("document.querySelector('.traveler-activity strong')?.textContent")
 assert(activity && !activity.includes('被壓平'), 'Reload should show ordinary rest, not the first tree-traces scene')
 await capture('06-rest-reloaded')
 report.checks.push('Reload preserves official core, empty astrolabe and tree memory')
 await exec(`window.focusQuest.beginSessionDebrief(${JSON.stringify(id)})`)
 await exec(`window.focusQuest.endFocus({sessionId:${JSON.stringify(id)},outcome:'progress',completeTask:false})`)
 s=await snapshot();assert.equal(s.runRelics.length,0)
 const next=s.expeditionNodes.find(n=>n.parentNodeId===node)
 await exec(`window.focusQuest.chooseNextRoute(${JSON.stringify(s.todayRun.id)},${JSON.stringify(node)},${JSON.stringify(next.id)})`)
 await until(()=>exec("!!document.querySelector('.today-lobby canvas')"))
 await delay(2500);await capture('07-lobby-official-core')
 report.checks.push('Debrief advances without duplicate generic reward; lobby receives official permanent core state')
 assert.equal(report.errors.length,0,JSON.stringify(report.errors))
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2))
 console.log(JSON.stringify(report));sql.close();app.exit(0)
})().catch(error=>{report.failure=String(error.stack);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(error);sql?.close();app.exit(1)})
