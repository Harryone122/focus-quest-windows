const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/area05-campfire-qa');fs.mkdirSync(out,{recursive:true});
process.env.FOCUSQUEST_QA_USER_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'focusquest-sil05-'));
// Keep production QA hidden so it does not interrupt the user's active window.
BrowserWindow.prototype.show=function(){};
const report={checks:[],errors:[]};let win;
const js=s=>win.webContents.executeJavaScript(s,true);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const scene=s=>js(`(()=>{const w=document.querySelector('.campfire-stage iframe').contentWindow;${s}})()`);
async function until(f){const end=Date.now()+30000;while(Date.now()<end){if(await f())return;await wait(100)}throw Error('Scene timeout')}
async function shot(n){fs.writeFileSync(path.join(out,n+'.png'),(await win.webContents.capturePage()).toPNG())}
require(path.join(root,'out/main/index.js'));
(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win});win.webContents.setBackgroundThrottling(false);
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 await until(()=>js(`!!document.querySelector('.campfire-stage iframe')?.contentWindow?.__campfire`));
 // Instrument the actual compiled component document, without importing prototype-only hooks.
 await js(`(()=>{const f=document.querySelector('.campfire-stage iframe');f.srcdoc=f.srcdoc.replace('// mist: a sea below','window.__qaDest=DEST; // mist: a sea below');})()`);
 await until(()=>scene('return !!w.__campfire && !!w.__qaDest;'));
 await wait(600);await scene('w.__hold=true;w.__qaSetDestinations=w.__campfireSetDestinations;w.__campfireSetDestinations=()=>{};w.__campfire.setDestinations=()=>{};w.__events=[];w.__campfireOnSilhouette=(...a)=>w.__events.push(a);');
 for(const way of ['bridge','steps']){
  const other=way==='bridge'?'steps':'bridge';
  await scene(`w.__campfire.setHover(null);w.__qaSetDestinations({${way}:'area-05-echo-quarry',${other}:'area-07-glass-nursery'});w.__campfire.setSelected('${way}');w.__campfire.advance(2);`);
  assert.equal(await scene('return w.__events.length;'),0);
  await scene(`w.__campfire.setHover('${way}');w.__campfire.advance(1.2);`);await shot(way+'-before-bell');assert.equal(await scene('return w.__events.length;'),0);
  await scene('w.__campfire.advance(.2);');assert.deepEqual(await scene('return w.__events;'),[['area-05-echo-quarry','bell']]);
  await scene('w.__campfire.advance(.8);');await shot(way+'-wave');
  await scene('w.__campfire.advance(8);');assert.equal(await scene('return w.__events.length;'),1);
  await scene(`w.__campfire.setHover(null);w.__campfire.setHover('${way}');w.__campfire.advance(1.2);`);assert.equal(await scene('return w.__events.length;'),1);
  await scene('w.__campfire.advance(.2);');assert.equal(await scene('return w.__events.length;'),2);
  await scene(`w.__campfire.setHover(null);w.__campfire.setHover('${way}');w.__campfire.advance(1);w.__campfire.setHover(null);w.__campfire.setHover('${way}');w.__campfire.advance(.5);`);assert.equal(await scene('return w.__events.length;'),2);
  await scene(`w.__campfire.setHover(null);w.__campfire.advance(.1);`);
  // Striker is restored when hover ends, before impact.
  assert.equal(await scene(`return w.__qaDest.${way}.g.userData.sil.alive();`),true);
  await scene(`const d=w.__qaDest.${way}.g;w.__old=d.userData.sil;w.__oldUpdates=0;const update=w.__old.update;w.__old.update=(...a)=>{w.__oldUpdates++;update(...a)};w.__qaSetDestinations({${way}:'area-01-cloud-ruins',${other}:'area-02-moss-station'});w.__campfire.advance(2);`);
  assert.equal(await scene('return w.__old.alive();'),false);assert.equal(await scene('return w.__oldUpdates;'),0);assert.equal(await scene(`return w.__qaDest.${way}.g.userData.sil;`),null);
  await scene('w.__events=[];');report.checks.push(way+': selection silent, ring at 1.35s once, same-frame re-entry resets, rapid hover cancels, replaced silhouette stops');
 }
 await scene(`w.__qaSetDestinations({bridge:'area-05-echo-quarry',steps:'area-07-glass-nursery'});w.__campfire.setSelected('bridge');w.__campfire.playReturn();w.__campfire.advance(7);w.__campfire.depart();w.__campfire.advance(8);`);
 assert.equal(await scene('return w.__events.length;'),0);report.checks.push('Return and departure do not ring');
 assert.equal(report.errors.length,0,report.errors.join('\n'));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0);
})().catch(e=>{report.errors.push(e.stack);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});
