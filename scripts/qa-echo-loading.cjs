// First-entry performance and loading-drawing regressions in the isolated trial.
process.env.FOCUSQUEST_AREA05_QA='1';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const entry=require.resolve('./qa-echo-quarry.cjs');
require.cache[entry]={id:entry,filename:entry,loaded:true,exports:async({app,win,root})=>{
 const js=code=>win.webContents.executeJavaScript(code,true),dir=path.join(root,'previews/area05-trial/qa');
 const report={passed:false};
 try{
  for(let i=0;i<600;i++){if(await js('typeof echoTrialScene!=="undefined"'))break;await new Promise(r=>setTimeout(r,50));}
  assert(await js('typeof echoTrialScene!=="undefined"'),'trial ready');
  await js('echoTrialScene.automatic(false);echoTrialScene.event("second");echoTrialScene.speed(60)');
  let transition=false;
  for(let i=0;i<200;i++){await js('echoTrialScene.advance(.05)');if((await js('echoTrialScene.state()')).transition){transition=true;break;}}
  assert(transition,'walk into cave transition');
  await js('echoTrialScene.automatic(true)');
  report.caveWarmMs=(await js('echoTrialScene.state()')).caveWarmMs;
  // Observe the real animation frame clock, including first-entry rendering work.
  report.firstEntry=await js(`new Promise(resolve=>{const start=performance.now();const timer=setInterval(()=>{const s=echoTrialScene.state();if((!s.transition&&s.inCave)||performance.now()-start>5000){clearInterval(timer);resolve({ms:performance.now()-start,state:s});}},16);})`);
  report.firstEntryMs=report.firstEntry.ms;
  assert(report.firstEntryMs<2000,'first entry must complete in under two seconds on this machine');
  await js('echoTrialScene.automatic(false);echoTrialScene.event("core");echoTrialScene.speed(60)');
  for(let i=0;i<200;i++){await js('echoTrialScene.advance(.05)');if((await js('echoTrialScene.state()')).transition)break;}
  await js('echoTrialScene.advance(.28);echoTrialScene.pause()');
  const before=await js('echoTrialScene.state()');assert(before.transition);
  await js('echoTrialScene.advance(2)');assert.deepEqual((await js('echoTrialScene.state()')).transition,before.transition);
  const widget=await js(`(()=>{const e=document.querySelector('.travel-loading'),r=e.getBoundingClientRect();return {hidden:e.hidden,paused:e.dataset.paused,x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight,animations:e.getAnimations({subtree:true}).map(a=>a.playState)};})()`);
  assert(!widget.hidden);assert.equal(widget.paused,'true');assert(widget.animations.every(s=>s==='paused'));
  assert(widget.right<=widget.w&&widget.bottom<=widget.h);report.widget=widget;
  fs.writeFileSync(path.join(dir,'11-loading-traveller.png'),(await win.webContents.capturePage()).toPNG());
  // Reduced-motion emulation verifies the actual computed animation rules.
  await win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await js(`Array.from(document.querySelector('.travel-loading').querySelectorAll('*')).every(e=>getComputedStyle(e).animationName==='none')`));
  win.webContents.debugger.detach();
  await js('echoTrialScene.play()');
  for(let i=0;i<200;i++){await js('echoTrialScene.advance(.5)');if(!(await js('echoTrialScene.state()')).transition&&!(await js('echoTrialScene.state()')).inCave)break;}
  assert(await js('document.querySelector(".travel-loading").hidden'));
  report.passed=true;report.checks=['first cave entry warm and real-time fade','pause freezes fade and travelling drawing','bottom-right drawing fits window','reduced motion disables all loading animations','drawing disappears after transition'];
  fs.writeFileSync(path.join(dir,'loading-report.json'),JSON.stringify(report,null,2));app.exit(0);
 }catch(e){report.error=e.stack;fs.writeFileSync(path.join(dir,'loading-report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1);}
}};
require('./try-echo-quarry.cjs');
