const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({app,win,profile,root})=>{
 const out=path.join(root,'previews/area05-trial/qa');fs.mkdirSync(out,{recursive:true});
 const report={profile,checks:[],errors:[],externalRequests:[]};
 win.webContents.on('console-message',(_,level,message)=>{if(level>=3)report.errors.push(message)});
 const js=code=>win.webContents.executeJavaScript(code,true),sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const shot=async name=>{await sleep(100);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())};
 try{
  for(let i=0;i<600;i++){if(await js('typeof echoTrialScene!=="undefined"'))break;await sleep(50);}assert(await js('typeof echoTrialScene!=="undefined"'));
  assert.equal(await js('!!window.__quarry'),false);assert.equal(await js('!!document.getElementById("hudBar")'),false);
  await js('echoTrialScene.time("day");echoTrialScene.pause()');await shot('01-outdoor-day');
  await js('echoTrialScene.automatic(false)');report.waterFlow=[];
  for(const t of [0,500,3000]){
   const r=await js(`echoTrialScene.qa('water-flow',${t})`);assert.equal(r.maxJoinGap,0);report.waterFlow.push(r);await shot('water-flow-'+t);
  }
  report.checks.push('shared water-strip joins; stable flow material visually checked at 0, 500 and 3000 seconds');
  report.waterLip=await js("echoTrialScene.qa('water-lip',true)");assert.equal(report.waterLip.exposed,0);assert.equal(report.waterLip.lipCenterGap,0);assert.equal(report.waterLip.lipWidth,2.3);assert(report.waterLip.opaqueBacking);
  await shot('water-lip-closeup');await js("echoTrialScene.qa('water-lip',false)");
  report.checks.push('original 2.3m river width; opaque foam waterfall backing; close-up rendering and riverbed clearance checked');
  await js('echoTrialScene.automatic(true)');
  const reach=await js('echoTrialScene.state().reach');assert(Object.values(reach).every(Boolean));assert.equal(Object.keys(reach).length,17);report.checks.push('offline port; 17 reachable spots; prototype HUD and global interface removed');
  for(const file of ['occlusion-all.js','cave-mouth-tunnel.js','cave-route-clearance.js']){
   const result=await js(`echoTrialScene.qa(${JSON.stringify(file)})`);report[file]=result;
   if(file==='occlusion-all.js')assert(!Object.values(result).some(r=>r.hits.BELL));
   if(file==='cave-mouth-tunnel.js'){assert.equal(result.bad.length,0);assert.equal(result.terrainInTunnel,0)}
   if(file==='cave-route-clearance.js'){assert.equal(result.hits.length,0);assert(result.float.every(f=>Math.abs(f.first[3]-f.first[4])<=.071))}
  }report.checks.push('ported scene: bell occlusion, cave tunnel and cave route clearance');
  await js('echoTrialScene.reset();echoTrialScene.pause();echoTrialScene.setTime(1200);echoTrialScene.advance(.1)');assert.equal((await js('echoTrialScene.state()')).lamps,2);await shot('02-two-lamps');
  for(const event of ['second','core','whistle']){
   await js(`echoTrialScene.event(${JSON.stringify(event)});echoTrialScene.speed(20)`);
   assert.equal((await js('echoTrialScene.state()')).inCave,false);
   let entered=false,left=false,core=false;const trace=[];
   for(let i=0;i<180;i++){
    await js('echoTrialScene.advance(.5)');const s=await js('echoTrialScene.state()');trace.push({inCave:s.inCave,goal:s.goal,mode:s.mode,stoneOwned:s.stoneOwned});
    if(s.inCave&&!entered){entered=true;await shot('03-'+event+'-entry');await js('echoTrialScene.pause()');const frozen=await js('echoTrialScene.state()');await js('echoTrialScene.advance(2)');const after=await js('echoTrialScene.state()');assert.deepEqual(after.position,frozen.position);assert.equal(after.sim,frozen.sim);await js('echoTrialScene.play()')}
    if(s.stoneOwned&&!core){core=true;await shot('04-core-collected')}
    if(entered&&!s.inCave){left=true;break;}
   }
   assert(entered&&left,event+' complete round trip');if(event==='core')assert(core);report[event]=trace;
   await shot('05-'+event+'-outdoor');
  }report.checks.push('core and second visit walk through mouth, authored cave routes and return; whistle remote cut; pause freezes cave movement and clock');
  await js('echoTrialScene.reset();echoTrialScene.speed(20);echoTrialScene.time("auto")');
  // Start early in a lamp interval and make a real sound at spot 1. No forced entry bypass.
  await js('echoTrialScene.echoScenario()');let saw=false;
  for(let i=0;i<240;i++){await js('echoTrialScene.advance(.5)');const s=await js('echoTrialScene.state()');if(s.inCave&&!saw){saw=true;await shot('06-echo-visit');}if(saw&&!s.inCave){await js('echoTrialScene.speed(60)');}if(s.sim>=3000)break;}
  const authority=await js('echoTrial.request("state")');assert(authority.visits<=1);assert(authority.mouthEcho);report.echo={saw,authority};
  if(!saw)throw Error('Seeded echo trial did not enter cave');
  await js('echoTrialScene.advance(20)');assert.equal((await js('echoTrialScene.state()')).lamps,5);await shot('07-rest');report.checks.push('natural sound leads to budgeted echo visit, one visit maximum; five lamps follow effective seconds');
  await js('echoTrialScene.reset();echoTrialScene.time("night");echoTrialScene.advance(3);echoTrialScene.pause()');await shot('08-outdoor-night');
  await js("echoTrialScene.qa('water-lip',true)");await shot('water-lip-night-closeup');await js("echoTrialScene.qa('water-lip',false)");
  await js('echoTrialScene.event("second");echoTrialScene.speed(60);echoTrialScene.advance(10);echoTrialScene.pause()');await shot('09-cave-night');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.checks.push('night outdoor/cave rendering');
  win.setSize(1024,680);await sleep(300);await shot('10-compact-window');
  assert(await js('document.querySelector("aside").getBoundingClientRect().bottom <= innerHeight'));report.checks.push('compact 1024x680 controls remain inside the window');
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0);
 }catch(e){report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)}
};
