const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({app,win,root})=>{
 const out=path.join(root,'previews/area05-audio-integration-qa');const r={checks:[],errors:[]};
 const js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 const node=JSON.parse(fs.readFileSync(path.join(root,'docs/area05/area-05-echo-quarry.scene.json'),'utf8')).cave.nodes.WL;
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)r.errors.push(m)});
 try{
  for(let i=0;i<500;i++){if(await js('typeof echoTrialScene!=="undefined"'))break;await wait(50)}await js('echoTrialScene.audioReady');
  await js(`(()=>{window.__murmurStarts=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration>6.04&&this.buffer?.duration<6.07){let peak=0;for(let c=0;c<this.buffer.numberOfChannels;c++)for(const v of this.buffer.getChannelData(c))peak=Math.max(peak,Math.abs(v));window.__murmurStarts.push({duration:this.buffer.duration,peak,clock:this.context.currentTime})}return original.apply(this,args)}})()`);
  await js(`echoTrialScene.automatic(false);echoTrialScene.event('second');echoTrialScene.speed(60);(()=>{for(let i=0;i<1200;i++){const s=echoTrialScene.state();if(s.inCave&&s.cave.mode==='walk'&&Math.hypot(s.cave.x-(${node[0]}),s.cave.z-(${node[1]}))<2.2)break;echoTrialScene.advance(.04)}})();echoTrialScene.speed(6);echoTrialScene.automatic(true);`);
  const end=Date.now()+22000;let starts=[];while(Date.now()<end){starts=await js('__murmurStarts');if(starts.length)break;await wait(100)}assert.equal(starts.length,1);
  const s=await js('echoTrialScene.state()');assert(s.audio.history.some(e=>e.id==='a05_wall_murmur'));r.start=starts[0];r.subtitle=await js('document.getElementById("caveSub").textContent');assert.equal(r.subtitle,'……柴都濕了。');
  r.checks.push('actual wall-voice timeline plays revised murmur recording once, aligned with unchanged subtitle');
  const file=fs.readFileSync(path.join(root,'src/renderer/src/echoQuarry/audio/a05_wall_murmur.wav'));let at=12,data;
  while(at+8<file.length){const name=file.toString('ascii',at,at+4),size=file.readUInt32LE(at+4);if(name==='data'){data=file.subarray(at+8,at+8+size);break}at+=8+size+(size%2)}
  let peak=0;for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i))/32768);assert(Math.abs(peak-r.start.peak)<.05);
  r.installedPeak=peak;r.checks.push('AudioBuffer peak matches the user-approved +9 dB installed asset');
  fs.writeFileSync(path.join(out,'murmur.png'),(await win.webContents.capturePage()).toPNG());assert.equal(r.errors.length,0);fs.writeFileSync(path.join(out,'murmur-report.json'),JSON.stringify(r,null,2));app.exit(0);
 }catch(e){r.failure=e.stack;fs.writeFileSync(path.join(out,'murmur-report.json'),JSON.stringify(r,null,2));console.error(e);app.exit(1)}
};
