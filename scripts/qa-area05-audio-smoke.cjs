const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({app,win,root})=>{
 const out=path.join(root,'previews/area05-audio-integration-qa'),r={checks:[],errors:[]};fs.mkdirSync(out,{recursive:true});
 const js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)r.errors.push(m)});
 try{
  for(let i=0;i<500;i++){if(await js('typeof echoTrialScene!=="undefined"'))break;await wait(50)}
  await js('echoTrialScene.audioReady');await wait(200);
  const initial=await js('echoTrialScene.state().audio');assert.equal(initial.loaded,43);assert.deepEqual(initial.failures,[]);
  for(const base of ['stone_step_dry','bridge_plank_step']){const levels=['a','b','c'].map(v=>initial.footCalibration[base+'_'+v].outputRms);assert(Math.max(...levels)-Math.min(...levels)<1e-6)}
  r.footCalibration=initial.footCalibration;r.checks.push('43 recordings ready; each footstep group equal RMS, without altering source files');
  await js(`echoTrialScene.automatic(false);document.querySelector('[data-discovery="fork"]').click();`);await wait(100);
  assert((await js('echoTrialScene.state().audio.history')).some(e=>e.id==='a05_tuning_fork'));
  await js(`document.querySelector('[data-discovery="mica"]').click()`);await wait(100);
  assert((await js('echoTrialScene.state().audio.history')).some(e=>e.id==='a05_mica_peel'));
  await js('echoTrialScene.speed(20)');await wait(100);let s=await js('echoTrialScene.state()');assert.equal(s.audio.foreground,0);assert.equal(s.audio.music,null);
  r.checks.push('discovery sound buttons play their real recordings; rate changes clear old cue sources');
  await js(`echoTrialScene.speed(1);echoTrialScene.play();echoTrialScene.automatic(true);echoTrialScene.time('night');`);
  // Wait for one real active music node before testing its night filter, not an
  // idle node whose browser-optimized AudioParam value may remain intrinsic.
  const end=Date.now()+45000;while(Date.now()<end){s=await js('echoTrialScene.state()');if(s.audio.music)break;await wait(100)}
  assert(s.audio.music);await wait(900);s=await js('echoTrialScene.state()');assert(s.audio.bgmFilter<2600);assert.equal(s.audio.period,'night');
  r.checks.push('real active night music uses 2.5kHz lowpass');r.night=s.audio;
  assert.equal(r.errors.length,0);fs.writeFileSync(path.join(out,'smoke-report.json'),JSON.stringify(r,null,2));app.exit(0);
 }catch(e){r.failure=e.stack;fs.writeFileSync(path.join(out,'smoke-report.json'),JSON.stringify(r,null,2));console.error(e);app.exit(1)}
};
