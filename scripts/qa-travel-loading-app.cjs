// Production React renderer and real IPC, with an isolated profile and delayed first snapshot.
const {app,BrowserWindow,screen,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/area05-trial/qa');
process.env.FOCUSQUEST_QA_USER_DATA=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'focusquest-loading-app-'));
const delay=ms=>new Promise(r=>setTimeout(r,ms)),handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,listener)=>handle(channel,channel==='snapshot:get'?async(...args)=>{await delay(2200);return listener(...args)}:listener);
BrowserWindow.prototype.show=function(){const primary=screen.getPrimaryDisplay(),d=screen.getAllDisplays().find(x=>x.id!==primary.id)||primary;const b=this.getBounds();this.setBounds({...b,x:d.workArea.x+12,y:d.workArea.y+12});this.showInactive();};
require('../out/main/index.js');
(async()=>{
 let win;const report={passed:false,checks:[]};
 const until=async(fn,label)=>{const end=Date.now()+45000;while(Date.now()<end){if(await fn())return;await delay(50)}throw Error('Timeout: '+label)};
 try{
  await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win},'window');
  const js=s=>win.webContents.executeJavaScript(s,true);
  await until(()=>js('!!document.querySelector(".loading-screen .travel-loading")'),'startup drawing');
  const rect=await js(`(()=>{const r=document.querySelector('.loading-screen .travel-loading').getBoundingClientRect();return {right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight}})()`);
  assert(rect.right<=rect.w&&rect.bottom<=rect.h);await delay(150);
  fs.writeFileSync(path.join(out,'12-app-startup-loading.png'),(await win.webContents.capturePage()).toPNG());report.checks.push('production startup drawing appears at lower right while waiting for real snapshot');
  await until(()=>js('!!document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire'),'campfire ready');
  await until(()=>js('!document.querySelector(".campfire-stage .travel-loading")'),'campfire drawing dismissed');
  await until(()=>js('!!document.querySelector(".collection-room-view iframe")?.contentWindow?.__room'),'collection ready');
  await js('document.querySelector(`.sidebar nav button[aria-label="收藏室"]`).click()');
  await until(()=>js('!document.querySelector(".collection-room-view").classList.contains("is-hidden")'),'collection visible');
  assert(await js('!document.querySelector(".collection-room-view .travel-loading")'));report.checks.push('campfire and collection ready signals remove loading drawings');
  report.passed=true;fs.writeFileSync(path.join(out,'app-loading-report.json'),JSON.stringify(report,null,2));win.close();app.exit(0);
 }catch(e){report.error=e.stack;fs.writeFileSync(path.join(out,'app-loading-report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)}
})();
