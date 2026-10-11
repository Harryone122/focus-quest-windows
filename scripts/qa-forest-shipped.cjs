const { app, BrowserWindow } = require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/forest-0.6.6-qa')
const bundle=path.join(root,'release-v0.6.6/win-unpacked/resources/app.asar')
const oldData=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8')).data
const data=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'focusquest-forest-shipped-'))
for(const f of ['focusquest.db','focusquest.db-wal'])if(fs.existsSync(path.join(oldData,f)))fs.copyFileSync(path.join(oldData,f),path.join(data,f))
process.env.FOCUSQUEST_QA_USER_DATA=data;process.env.FOCUSQUEST_QA_VIEW='focus'
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
assert.equal(require(path.join(bundle,'package.json')).version,'0.6.6')
assert.equal(hash(path.join(bundle,'out/main/index.js')),hash(path.join(root,'out/main/index.js')))
const delay=ms=>new Promise(r=>setTimeout(r,ms))
require(path.join(bundle,'out/main/index.js'))
;(async()=>{
 await app.whenReady();let win
 for(let i=0;i<80;i++){win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');if(win)break;await delay(250)}
 assert(win);const errors=[]
 win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message)})
 const exec=js=>win.webContents.executeJavaScript(js,true)
 for(let i=0;i<80;i++){if(await exec("!!document.querySelector('.focus-active canvas')"))break;await delay(250)}
 await delay(3000)
 assert(await exec("!!document.querySelector('.focus-active canvas') && !document.querySelector('.cloud-ruins-fallback')"))
 const s=await exec('window.focusQuest.getSnapshot()');assert.equal(s.mapCores[0].itemKey,'astrolabe_core');assert.equal(s.worldMarks[0].mark,'tree_traces_seen')
 fs.writeFileSync(path.join(out,'08-shipped-bundle.png'),(await win.webContents.capturePage()).toPNG())
 assert.equal(errors.length,0,JSON.stringify(errors))
 fs.writeFileSync(path.join(out,'shipped-report.json'),JSON.stringify({version:'0.6.6',data,core:s.mapCores,marks:s.worldMarks,errors,mainHash:hash(path.join(bundle,'out/main/index.js'))},null,2))
 console.log('Shipped ASAR, native database, core/world memory and Focus scene passed.');app.exit(0)
})().catch(e=>{console.error(e);app.exit(1)})
