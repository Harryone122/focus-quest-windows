const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({app,win,root})=>{
 const out=path.join(root,'previews/style-refine-qa');fs.mkdirSync(out,{recursive:true});
 win.showInactive();
 const report={errors:[]};win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 const js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  for(let i=0;i<600&&!await js('!!window.echoTrialScene');i++)await wait(50);
  assert(await js('!!window.echoTrialScene'));await js('echoTrialScene.automatic(false);echoTrialScene.reset();echoTrialScene.play()');
  report.lowFps=process.env.FOCUSQUEST_STYLE_SHOTS_ONLY ? JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8')).lowFps : await js(`(()=>{let maxDelta=0,previous=null;for(let i=0;i<15000;i++){const s=echoTrialScene.qa('refinement','step',.2);if(!s.rotation.every(Number.isFinite))throw Error('Non-finite lantern');if(previous)maxDelta=Math.max(maxDelta,...s.rotation.map((v,k)=>Math.abs(v-previous[k])));previous=s.rotation;}return {maxDelta,...echoTrialScene.qa('refinement','snapshot')}})()`);
  assert(report.lowFps.maxDelta<.65,'Unstable lantern at 5 fps');assert(Math.abs(report.lowFps.sim-3000)<1e-6);
  await js('echoTrialScene.pause()');report.paused=await js(`(()=>{const a=echoTrialScene.qa('refinement','snapshot');for(let i=0;i<30;i++)echoTrialScene.qa('refinement','step',.2);return {before:a,after:echoTrialScene.qa('refinement','snapshot')}})()`);assert.deepEqual(report.paused.before,report.paused.after);
  await js('echoTrialScene.reset();echoTrialScene.pause()');
  for(const time of ['day','dusk','night']){
   await js(`echoTrialScene.time('${time}');echoTrialScene.advance(.1)`);await wait(500);
   fs.writeFileSync(path.join(out,time+'-world.png'),(await win.webContents.capturePage()).toPNG());
   fs.writeFileSync(path.join(out,time+'-traveller.png'),Buffer.from(await js("echoTrialScene.qa('refinement','portrait')"),'base64'));
  }
  await js("echoTrialScene.time('day');echoTrialScene.advance(.1);document.getElementById('quiet-look').checked=true;document.getElementById('quiet-look').dispatchEvent(new Event('change'))");await wait(500);
  fs.writeFileSync(path.join(out,'day-quiet.png'),(await win.webContents.capturePage()).toPNG());
  report.quietFilter=await js("document.getElementById('scene').style.filter");assert(report.quietFilter.includes('brightness'));
  assert.equal(report.errors.length,0);report.passed=true;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0);
 }catch(e){report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)}
};
