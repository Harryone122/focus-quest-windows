const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/nursery-continuous-audio-qa');fs.mkdirSync(out,{recursive:true});app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'fq-nursery-continuous-')));app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const delay=ms=>new Promise(r=>setTimeout(r,ms));let win;const report={checks:[],errors:[]};
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1400,height:900,show:false,webPreferences:{offscreen:true,backgroundThrottling:false}});win.webContents.setAudioMuted(true);
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 const js=s=>win.webContents.executeJavaScript(s,true),state=()=>js('__nurseryAudioTester.state()');
 await win.loadFile(path.join(root,'previews/nursery-audio-tester/dist/index.html'));
 for(let i=0;i<300;i++){if(await js('Boolean(window.__nurseryAudioTester?.state().ready)'))break;await delay(100)}
 let s=await state();assert.equal(s.audio.loaded,48);assert.equal(s.audio.failures.length,0);
 for(let i=0;i<30&&!s.audio.bgm;i++){await delay(100);s=await state()};assert(s.audio.bgm);assert(s.audio.musicHistory[0].at<5);report.checks.push('all 48 recordings decode; music starts immediately');
 await js("document.getElementById('mood').value='clearNight';document.getElementById('mood').dispatchEvent(new Event('change'));document.getElementById('bgm-mix').click()");
 await delay(1000);await js("document.getElementById('pause').click()");await delay(200);const frozen=(await state()).audio;await delay(700);s=await state();assert.equal(s.audio.musicClock,frozen.musicClock);assert.equal(s.audio.bgm.remaining,frozen.bgm.remaining);await js("document.getElementById('pause').click()");report.checks.push('pause freezes music and envelope clocks; resume continues');
 const samples=[];const end=Date.now()+41000;
 while(Date.now()<end){s=await state();assert(s.audio.bgm,'no musical gap');samples.push({clock:s.audio.musicClock,leaf:s.audio.leafEnvelope});await delay(200)}
 s=await state();const h=s.audio.musicHistory;assert(h.length>=3);const prev=h[h.length-2],next=h[h.length-1];assert(next.at<=prev.at+prev.duration-2.7);assert(next.at>=prev.at+prev.duration-3.3);report.checks.push('night music restarts with a three-second overlap and no silent gap');
 assert(samples.some(x=>x.leaf===0));assert(samples.some(x=>x.leaf>.6));report.checks.push('leaves swell and recede; each cycle includes silence');
 await js("__nurseryAudioTester.play('core');for(let i=0;i<1200&&__nurseryAudioTester.scene.debugState().localAction?.key!=='core';i++)__nurseryAudioTester.scene.qa.seek(.1)");await delay(700);s=await state();assert(s.audio.bgm);assert.equal(s.audio.duck,.3);report.checks.push('core discovery reduces music to 30% while preserving playback');
 report.musicHistory=s.audio.musicHistory;report.leafSamples=samples;assert.equal(report.errors.length,0);fs.writeFileSync(path.join(out,'overview.png'),(await win.webContents.capturePage()).toPNG());fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,errors:report.errors}));app.quit();
}).catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});
