// Real Electron scene/AudioContext; isolated trial state, muted speakers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({app,win,profile,root})=>{
 const out=path.join(root,'previews/area05-audio-integration-qa');fs.mkdirSync(out,{recursive:true});
 const report={profile,checks:[],errors:[],samples:[]};
 const js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>js('echoTrialScene.state()');
 async function until(fn,ms=45000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await wait(100)}throw Error('Audio/scene timeout')}
 const shot=async(name)=>fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 try{
  await until(()=>js('typeof echoTrialScene!=="undefined"'));
  await js('echoTrialScene.audioReady');await wait(300);
  let s=await state();assert.equal(s.audio.loaded,43);assert.deepEqual(s.audio.failures,[]);assert.equal(s.audio.settings.musicVolume,25);assert.equal(s.audio.windRockRate,1.5);
  report.checks.push('43 installed recordings decode; accepted 25% music, 35% environment, wind-rock rate 1.5');
  await until(async()=>!!(await state()).audio.music);
  s=await state();const first=s.audio.history.find(e=>e.bgmSeconds);report.firstMusic=first;assert(first.clock>=19.9&&first.clock<=41);assert(first.bgmSeconds>=60&&first.bgmSeconds<=120);
  report.checks.push('arrival 20–40s environment-only; real music segment 60–120s at a bar candidate');
  await js('echoTrialScene.pause()');await until(async()=>(await state()).audio.context==='suspended');const frozen=await state();await wait(700);s=await state();assert.equal(s.audio.clock,frozen.audio.clock);assert.equal(s.sim,frozen.sim);assert.deepEqual(s.position,frozen.position);assert.deepEqual(s.audio.music,frozen.audio.music);
  await js('echoTrialScene.play()');await until(async()=>(await state()).audio.context==='running');
  report.checks.push('pause freezes actual AudioContext, playing segment, positions and focus clock; resume continues');
  await js(`document.getElementById('audio-muted').checked=true;document.getElementById('audio-muted').dispatchEvent(new Event('input'))`);await wait(200);s=await state();assert.equal(s.audio.context,'suspended');assert.equal(s.audio.foreground,0);assert.equal(s.audio.music,null);
  await js(`document.getElementById('audio-muted').checked=false;document.getElementById('audio-muted').dispatchEvent(new Event('input'))`);await wait(200);s=await state();assert(s.audio.nextMusicAt>s.audio.clock+19);
  report.checks.push('actual mute control stops old cues/music; restoration schedules silence rather than replay');
  await js('echoTrialScene.automatic(false);echoTrialScene.speed(60);echoTrialScene.advance(30)');s=await state();assert.equal(s.audio.foreground,0);assert.equal(s.audio.music,null);assert(s.audio.nextMusicAt>=s.audio.clock+19);
  report.checks.push('fast advance drops historical one-shots and repositions environment without catch-up');
  // Fast approach, then run the authored stone timeline live at its reference rate.
  await js(`echoTrialScene.event('core');echoTrialScene.automatic(false);echoTrialScene.speed(60);`);
  await js(`(()=>{for(let i=0;i<1200;i++){const s=echoTrialScene.state();if(s.inCave&&s.cave.mode==='walk'&&Math.hypot(s.cave.x+1.892,s.cave.z+1.892)<2.2)break;echoTrialScene.advance(.04)}})()`);
  s=await state();assert(s.inCave&&!s.stoneOwned);assert.equal(s.cave.mode,'walk');
  const beforeClock=s.audio.clock;
  await js('echoTrialScene.speed(6);echoTrialScene.automatic(true)');
  await until(async()=>{const s=await state();report.samples.push({clock:s.audio.clock,foreground:s.audio.foreground});return s.audio.history.some(e=>e.id==='core_motif_05'&&e.clock>=beforeClock)},25000);
  s=await state();const h=s.audio.history.filter(e=>e.clock>=beforeClock),swell=h.find(e=>e.id==='a05_core_swell'),wave=h.find(e=>e.coreWave),motif=h.find(e=>e.id==='core_motif_05'),hums=h.filter(e=>e.id==='hum_stone_g2');
  assert(swell&&wave&&motif);assert.equal(hums.length,3);assert(Math.abs(swell.start+2.6-swell.offset-wave.coreWave)<.25);
  assert.equal(motif.music,true);assert(s.audio.nextMusicAt>=motif.end+29.9);assert(report.samples.every(s=>s.foreground<=3));
  report.core={hums,swell,wave,motif,nextMusicAt:s.audio.nextMusicAt};report.checks.push('authored core timeline: three hums, swell peak matches blue wave, motif on music slider, >=30s quiet interval, maximum 3 foreground');await shot('core-collected');
  await js('echoTrialScene.pause()');await wait(100);await shot('paused-cave');
  // The existing rule/geometry regression remains a separate complete run.
  report.final=(await state()).audio;assert.equal(report.errors.length,0,report.errors.join('\n'));
  fs.writeFileSync(path.join(out,'scene-report.json'),JSON.stringify(report,null,2));app.exit(0);
 }catch(e){report.failure=e.stack;fs.writeFileSync(path.join(out,'scene-report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)}
};
