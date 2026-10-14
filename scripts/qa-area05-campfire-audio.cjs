// Production compiled component, disposable SQLite, actual source-node starts.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bundle=process.env.FOCUSQUEST_QA_BUNDLE||root,out=path.join(root,process.env.FOCUSQUEST_QA_AUDIO_OUT||'previews/area05-audio-integration-qa');fs.mkdirSync(out,{recursive:true});
process.env.FOCUSQUEST_QA_USER_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'fq-a05-bell-audio-'));
BrowserWindow.prototype.show=function(){};app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let win;const report={checks:[],errors:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
const js=s=>win.webContents.executeJavaScript(s,true),scene=s=>js(`(()=>{const w=document.querySelector('.campfire-stage iframe')?.contentWindow;if(!w)return null;${s}})()`);
async function until(fn){const end=Date.now()+30000;while(Date.now()<end){if(await fn())return;await wait(100)}throw Error('Campfire audio timeout')}
require(path.join(bundle,'out/main/index.js'));
(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win});win.webContents.setAudioMuted(true);
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 await until(()=>scene('return typeof w.__campfireOnSilhouette==="function"'));
 await wait(1000);
 await js(`(()=>{window.__bellStarts=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration===8)window.__bellStarts.push({duration:this.buffer.duration,clock:this.context.currentTime,args});return original.apply(this,args)}})()`);
 await scene(`w.__qaSet=w.__campfire.setDestinations;w.__campfire.setDestinations=()=>{};w.__qaSet({bridge:'area-05-echo-quarry',steps:'area-03-reflection-lake'});w.__hold=true;w.__campfire.setHover(null);`);
 for(const way of ['bridge','steps']){
  await scene(`w.__campfire.setHover(null);w.__qaSet({${way}:'area-05-echo-quarry',${way==='bridge'?'steps':'bridge'}:'area-03-reflection-lake'});w.__campfire.setHover('${way}');w.__campfire.advance(1.2);`);
  const n=await js('__bellStarts.length');await scene('w.__campfire.advance(.2);');assert.equal(await js('__bellStarts.length'),n+1);
  await scene('w.__campfire.advance(8);');assert.equal(await js('__bellStarts.length'),n+1);
  await scene(`w.__campfire.setHover(null);w.__campfire.setHover('${way}');w.__campfire.advance(.6);w.__campfire.setHover(null);w.__campfire.advance(2);`);assert.equal(await js('__bellStarts.length'),n+1);
 }
 report.starts=await js('__bellStarts');report.checks.push('actual approved 8s distant-bell recording starts at the authored 1.35s impact on each side, once per hover; rapid hover silent');
 await scene(`w.__campfire.setHover(null);w.__qaSet({bridge:'area-01-cloud-ruins',steps:'area-03-reflection-lake'});w.__campfire.setHover('steps');w.__campfire.advance(10)`);assert.equal(await js('__bellStarts.length'),2);
 report.checks.push('other map silhouettes do not trigger Area 05 recording');
 fs.writeFileSync(path.join(out,'campfire.png'),(await win.webContents.capturePage()).toPNG());assert.equal(report.errors.length,0,report.errors.join('\n'));
 fs.writeFileSync(path.join(out,'campfire-report.json'),JSON.stringify(report,null,2));app.exit(0);
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'campfire-report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});
