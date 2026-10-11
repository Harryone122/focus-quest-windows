// Recheck notebook rendering using the isolated save from the shipped scenario.
const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/nursery-integration-qa/shipped'),report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
assert(report.profile.startsWith(path.join(os.tmpdir(),'fq-nursery-')));
process.env.FOCUSQUEST_QA_USER_DATA=report.profile;
BrowserWindow.prototype.show=function(){this.showInactive()};require(path.join(report.bundle,'out/main/index.js'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await app.whenReady();let win;for(let i=0;i<200;i++){win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');if(win)break;await delay(100)}assert(win);
 const primary=screen.getPrimaryDisplay(),d=screen.getAllDisplays().find(x=>x.id!==primary.id)||primary;win.setBounds({x:d.workArea.x+10,y:d.workArea.y+10,width:1280,height:800});
 const js=s=>win.webContents.executeJavaScript(s,true);await delay(2000);let s=await js('window.focusQuest.getSnapshot()');if(s.activeSession){await js(`window.focusQuest.finishListFocus(${JSON.stringify(s.activeSession.id)},false)`);await js(`window.focusQuest.dismissDebrief(${JSON.stringify(s.activeSession.id)})`)}
 for(let i=0;i<400;i++){if(await js(`!!document.querySelector('button[aria-label="收藏室"]')`))break;await delay(100)}await js(`document.querySelector('button[aria-label="收藏室"]').click()`);let ready=false;for(let i=0;i<400;i++){ready=await js(`!!document.querySelector('iframe')?.contentWindow?.__room?.S.nurseryEnding`);if(ready)break;await delay(100)}assert(ready);
 await js(`{const w=document.querySelector('iframe').contentWindow;w.__room.S.spread=0;w.__room.openBook()}`);await delay(2000);
 assert(await js(`{const w=document.querySelector('iframe').contentWindow;for(let i=0;i<6&&!w.document.querySelector('#bookWrap svg[aria-label="兩棵樹的素描"]');i++){const n=w.document.querySelector('#bNext');if(!n||n.disabled)break;n.click()}!!w.document.querySelector('#bookWrap svg[aria-label="兩棵樹的素描"]')}`));await delay(600);
 fs.writeFileSync(path.join(out,'08b-collection-ending.png'),(await win.webContents.capturePage()).toPNG());app.exit(0);
})().catch(e=>{console.error(e);app.exit(1)});
