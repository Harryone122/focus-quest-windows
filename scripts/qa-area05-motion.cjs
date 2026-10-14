// Actual trial playback at 10 fps plus normal-speed movement and pause checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({app,win,root})=>{
 const out=path.join(root,'previews/area05-motion-qa');fs.mkdirSync(out,{recursive:true});
 const report={checks:[],errors:[]},js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 try{
  for(let i=0;i<600;i++){if(await js('typeof echoTrialScene!=="undefined"'))break;await wait(50)}
  await js('echoTrialScene.audioReady');
  for(const speed of [1,6]){
   const r=await js(`(()=>{echoTrialScene.reset();echoTrialScene.automatic(false);echoTrialScene.speed(${speed});echoTrialScene.go(11);let p=echoTrialScene.state().position,d=0;for(let i=0;i<60;i++){echoTrialScene.advance(1/30);const q=echoTrialScene.state().position;d+=Math.hypot(q[0]-p[0],q[2]-p[2]);p=q;}return {speed:${speed},distance:d,sim:echoTrialScene.state().sim};})()`);
   assert(r.distance>1.6&&r.distance<2.1,JSON.stringify(r));report.checks.push(r);
  }
  await js('echoTrialScene.reset();echoTrialScene.speed(1);echoTrialScene.automatic(true)');
  win.webContents.setFrameRate(10);await wait(500);
  const start=await js('echoTrialScene.state()'),at=Date.now();await wait(4000);
  const end=await js('echoTrialScene.state()'),wall=(Date.now()-at)/1000,elapsed=end.sim-start.sim;
  assert(elapsed/wall>.8&&elapsed/wall<1.2,JSON.stringify({wall,elapsed}));report.checks.push({fps:10,wall,elapsed});
  fs.writeFileSync(path.join(out,'normal-walking.png'),(await win.webContents.capturePage()).toPNG());
  await js('echoTrialScene.pause()');await wait(200);const frozen=await js('echoTrialScene.state()');await wait(800);const paused=await js('echoTrialScene.state()');assert.equal(paused.sim,frozen.sim);assert.deepEqual(paused.position,frozen.position);report.checks.push('pause freezes position and exploration');
  await js(`echoTrialScene.event('core');echoTrialScene.automatic(false);echoTrialScene.speed(60);`);
  await js(`(()=>{for(let i=0;i<1200;i++){const s=echoTrialScene.state();if(s.inCave&&s.cave.mode==='walk'&&Math.hypot(s.cave.x+1.892,s.cave.z+1.892)<2.2)break;echoTrialScene.advance(.04)}})()`);
  assert((await js('echoTrialScene.state()')).inCave);
  await js('echoTrialScene.speed(1)');
  let coreSeconds=0;for(;coreSeconds<25;coreSeconds+=.5){await js('echoTrialScene.advance(.5)');if((await js('echoTrialScene.state()')).stoneOwned)break;}
  assert(coreSeconds<25);report.checks.push({normalCaveCoreSeconds:coreSeconds});
  fs.writeFileSync(path.join(out,'normal-core.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal(report.errors.length,0);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0);
 }catch(e){report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)}
};
