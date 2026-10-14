// Exercise the installed G2 recording in compiled campfire and collection components.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),bundle=process.env.FOCUSQUEST_QA_BUNDLE||root,out=path.join(root,process.env.FOCUSQUEST_QA_AUDIO_OUT||'previews/area05-audio-integration-qa');fs.mkdirSync(out,{recursive:true});
process.env.FOCUSQUEST_QA_USER_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'fq-a05-shared-hum-'));
BrowserWindow.prototype.show=function(){};app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let win;const report={checks:[],errors:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
const js=s=>win.webContents.executeJavaScript(s,true);
async function until(fn){const end=Date.now()+30000;while(Date.now()<end){if(await fn())return;await wait(100)}throw Error('Shared hum timeout')}
require(path.join(bundle,'out/main/index.js'));
(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win});win.webContents.setAudioMuted(true);
 await until(()=>js('!!document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfireOnSilhouette'));
 await wait(1000);
 await js(`(()=>{window.__humStarts=[];const original=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration>5.49&&this.buffer.duration<5.50){this.__humQa={duration:this.buffer.duration,args};window.__humStarts.push(this.__humQa)}return original.apply(this,args)};AudioBufferSourceNode.prototype.stop=function(at){if(this.__humQa)this.__humQa.stop=at;return stop.call(this,at)}})()`);
 await js(`var w=document.querySelector('.campfire-stage iframe').contentWindow;w.__campfire.setSelected('steps');w.__campfire.depart()`);
 await until(()=>js('__humStarts.length>0'));report.floatStarts=await js('__humStarts');
 assert(report.floatStarts.some(x=>Math.abs(x.stop-x.args[0]-.32)<.00001));report.checks.push('floating-stone landings schedule short slices of the installed G2 recording');
 await js(`document.querySelector('button[aria-label="收藏室"]').click()`);
 await until(()=>js('!!document.querySelector(".collection-room-view iframe")?.contentWindow?.__roomOnStoneHum'));
 await wait(1000);
 await js(`window.__humStarts=[];var w=document.querySelector('.collection-room-view iframe').contentWindow;w.__hold=true;w.__room.setState(5,1,true);w.__room.advance(.1);w.__room.advance(8)`);
 await until(()=>js('__humStarts.length>0'));report.roomStarts=await js('__humStarts');report.checks.push('collection exhibit 05 visual hum cycle plays the same installed G2 recording');
 fs.writeFileSync(path.join(out,'shared-hum-report.json'),JSON.stringify(report,null,2));app.exit(0);
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'shared-hum-report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});
