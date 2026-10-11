// Preview only: supplied batch 2/2b recordings; production files and saves are untouched.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict')
const stretch=process.argv.includes('--8s')?1.6:1
const overlap=process.argv.includes('--overlap')
const frontSlow=process.argv.includes('--front-slow')||overlap
const root=path.resolve(__dirname,'..'), incoming=path.resolve(root,'../audio-incoming'), out=path.join(root,'previews/lobby-audio-qa/batch-2',overlap?'review-front-overlap':frontSlow?'review-front-8s':stretch===1?'':'review-8s')
fs.mkdirSync(out,{recursive:true})
const files=fs.readdirSync(incoming).filter(n=>/^(dep_|ret_|bridge_|stone_).*\.wav$/.test(n)).sort()
// The design summary says 14 batch-2b files, but its table enumerates 16.
assert.equal(files.length,27)
const sources=Object.fromEntries(files.map(name=>{const bytes=fs.readFileSync(path.join(incoming,name));return[name.slice(0,-4),{base64:bytes.toString('base64'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')}]}))
const hashes=Object.fromEntries(Object.entries(sources).map(([name,s])=>[name,s.sha256]))
async function candidate(encoded, way, stretch=1, frontSlow=false, overlap=false) {
  frontSlow=frontSlow&&way!=='return'
  const scale=way==='return'||frontSlow?1:stretch
  const rate=48000,seconds=way==='return'?4:frontSlow?8:5*scale,ctx=new OfflineAudioContext(2,rate*seconds,rate)
  const buffers={},calibration={}
  function target(name){return name.includes('cloth_kneel')?.008:name.includes('cloth_rise')?.006:name.includes('fog')?.008:name.includes('air_hop')?.003:name.includes('flare')?.07:name.includes('spark')?.045:name.includes('clink')?.05:name.includes('step')?.025:name.includes('creak')?.035:.035}
  for(const[name,source]of Object.entries(encoded)){
    const bytes=Uint8Array.from(atob(source.base64),c=>c.charCodeAt(0)),raw=await ctx.decodeAudioData(bytes.buffer)
    let peak=0,sum=0,clipped=0;for(let c=0;c<raw.numberOfChannels;c++)for(const v of raw.getChannelData(c)){peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>=32767/32768)clipped++}
    const rms=Math.sqrt(sum/(raw.length*raw.numberOfChannels)),gain=Math.min(target(name)/Math.max(rms,1e-8),Math.pow(10,-3/20)/Math.max(peak,1e-8))
    calibration[name]={seconds:raw.duration,peak,rms,clipped,gain,processedPeak:peak*gain};buffers[name]=raw
  }
  const events=[];let randomState=20261003;const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return(randomState>>>0)/4294967296}
  function event(name,main,onset=0,options={}){
    const speed=options.speed??1,offset=Math.max(0,onset-main*speed),start=Math.max(0,main-onset/speed),duration=Math.min(options.duration??buffers[name].duration-offset,buffers[name].duration-offset)/speed
    events.push({name,main,onset,start,offset,duration,rate:speed,gain:calibration[name].gain,...options,end:Math.min(seconds,start+duration)})
  }
  if(way==='return')event('ret_log_settle',.8,.1)
  else{
    event('dep_notebook_close',.08,.31);event('dep_log_creak',.3,.21);event('dep_staff_tap',.65,.28)
    event('dep_steps_dirt',.85,.03,{duration:.4,fade:.08})
    event('dep_cloth_kneel',1.35,.35,{quiet:true,speed:1+(random()-.5)*.06})
    event('dep_lantern_clink',1.5,.42);event('dep_ember_spark',1.78,.08,{duration:.45})
    event('dep_fire_flare',2.05,.13,{duration:.9})
    event('dep_cloth_rise',2.5,.05,{quiet:true,speed:1+(random()-.5)*.06,jitter:(random()-.5)*.1})
    event('dep_fog_swell',4.5,1.55,{quiet:true,fade:.12})
    const times=Audio.departureCues.filter(c=>c.at>=2.75).map(c=>c.at),steps=['a','b','c'],up=['a','b','d'],down=['a','b','c','d'];let last={}
    function pick(group,versions){const candidates=versions.filter(v=>v!==last[group]),v=candidates[Math.floor(random()*candidates.length)];last[group]=v;return group+'_'+v}
    for(const[index,at]of times.entries()){
      const db=(random()*4-2),speed=1+(random()-.5)*.1
      const name=pick(way==='bridge'?'bridge_plank_step':'stone_step_dry',steps)
      const onset={bridge_plank_step_a:.03,bridge_plank_step_b:.11,bridge_plank_step_c:.02,stone_step_dry_a:.01,stone_step_dry_b:.01,stone_step_dry_c:.03}[name]
      event(name,at,onset,{duration:.23,speed,gain:Math.min(calibration[name].gain*Math.pow(10,db/20),Math.pow(10,-3/20)/calibration[name].peak),variationDb:db,fade:.045})
      if(way==='bridge'){
        const group=index%2?'bridge_creak_down':'bridge_creak_up',name=pick(group,index%2?down:up)
        const onset={bridge_creak_up_a:.01,bridge_creak_up_b:.02,bridge_creak_up_d:.03,bridge_creak_down_a:.04,bridge_creak_down_b:.08,bridge_creak_down_c:.17,bridge_creak_down_d:.08}[name]
        const speed=1+(random()-.5)*.16,delay=random()*.03,db=random()*4-2
        // Keep each creak inside its step slot; retain the gi/乖 alternation.
        event(name,at+delay,onset,{duration:Math.min(buffers[name].duration,.30+onset),speed,gain:Math.min(calibration[name].gain*Math.pow(10,db/20),Math.pow(10,-3/20)/calibration[name].peak),variationDb:db,fade:.07})
      }else if(index===1||index===3)event('stone_air_hop',at+.20,.12,{quiet:true,duration:.35,fade:.1})
    }
    if(way==='bridge')event('bridge_sway_groan',3.9,.3,{quiet:true,duration:.8,fade:.25,gain:calibration.bridge_sway_groan.gain*.2})
  }
  if(scale!==1){
    const materialTimes=Audio.departureCues.filter(c=>c.at>=2.75).map(c=>c.at)
    for(const e of events){
      const previousMain=e.main,previousOffset=e.offset,playDuration=e.end-e.start
      e.main*=scale
      if(e.name.startsWith('bridge_creak_')){
        const step=materialTimes.find(at=>previousMain>=at&&previousMain-at<=.03)
        if(step!==undefined)e.main=step*scale+(previousMain-step)
      }
      if(e.name==='bridge_sway_groan')e.main=3.6*scale+e.onset
      e.offset=Math.max(0,e.onset-e.main*e.rate);e.start=Math.max(0,e.main-e.onset/e.rate)
      e.end=Math.min(seconds,e.start+playDuration+(previousOffset-e.offset)/e.rate)
    }
    // Cut two existing dirt impacts apart instead of slowing/pitching the rapid three-hit recording.
    const index=events.findIndex(e=>e.name==='dep_steps_dirt'),original=events[index]
    const steps=[{main:.85*scale,offset:0,onset:.03,duration:.13},{main:1.1*scale,offset:.15,onset:.18,duration:.12}]
    events.splice(index,1,...steps.map(s=>({...original,...s,start:s.main-(s.onset-s.offset),end:s.main-(s.onset-s.offset)+s.duration,rate:1,fade:.025})))
  }
  if(frontSlow){
    const mainTimes=overlap
      ?{dep_notebook_close:.4,dep_log_creak:.9,dep_staff_tap:1.65,dep_cloth_kneel:3.35,dep_lantern_clink:4.05,dep_ember_spark:4.65,dep_fire_flare:5.05,dep_cloth_rise:5.5,dep_fog_swell:7.5}
      :{dep_notebook_close:.3,dep_log_creak:1.2,dep_staff_tap:1.9,dep_cloth_kneel:3.8,dep_lantern_clink:4,dep_ember_spark:4.78,dep_fire_flare:5.05,dep_cloth_rise:5.5,dep_fog_swell:7.5}
    for(const e of events){
      const previousOffset=e.offset,playDuration=e.end-e.start
      e.main=mainTimes[e.name]??e.main+3
      e.offset=Math.max(0,e.onset-e.main*e.rate);e.start=Math.max(0,e.main-e.onset/e.rate)
      e.end=Math.min(seconds,e.start+playDuration+(previousOffset-e.offset)/e.rate)
    }
    const index=events.findIndex(e=>e.name==='dep_steps_dirt'),original=events[index]
    const steps=[{main:overlap?2.3:2.45,offset:0,onset:.03,duration:.13},{main:overlap?3:3.1,offset:.15,onset:.18,duration:.12}]
    events.splice(index,1,...steps.map(s=>({...original,...s,start:s.main-(s.onset-s.offset),end:s.main-(s.onset-s.offset)+s.duration,rate:1,fade:.025})))
  }
  // Enforce the foreground budget by fading the oldest overlapping event before the new one.
  const foreground=events.filter(e=>!e.quiet).sort((a,b)=>a.start-b.start)
  for(let i=0;i<foreground.length;i++){const e=foreground[i],active=foreground.slice(0,i).filter(p=>p.end>e.start);while(active.length>=3){const old=active.shift();old.end=e.start;old.voiceLimited=true}}
  const graph=Audio.buildCampfireAudioGraph(ctx);graph.installAssets(await Audio.loadCampfireAssets(ctx));graph.setMusic({musicVolume:12},false)
  for(let t=0;t<seconds;t+=1/60){
    // Candidate time map: expand preparation; after ignition preserve the original exit pace.
    const sceneTime=frontSlow?(t<5.05?t*2.05/5.05:t-3):t/scale
    let mix=way==='return'?Audio.campfireAudioMix(t,3,{environmentVolume:35}):Audio.campfireDepartureMix(sceneTime,3,{environmentVolume:35})
    if(way!=='return'){const boost=sceneTime>=2.05&&sceneTime<2.65?1-(sceneTime-2.05)/.6:0;mix.fire=mix.fire/(1+.35*boost)*(1+.12*boost)}
    let duck=1;for(const e of foreground){if(t>=e.main-.3&&t<=e.end+1){const before=Math.min(1,Math.max(0,(t-e.main+.3)/.3)),after=Math.min(1,Math.max(0,(t-e.end)/1));duck=Math.min(duck,t<e.main?1-.7*before:.3+.7*after)}}
    for(const key of ['fire','wind','water','tarp'])mix[key]*=duck;graph.setMix(mix,false,.04,t)
  }
  if(way!=='return')graph.cue('glass',frontSlow?5.05:2.05*scale) // Existing C4 only; batch 7 has no recording yet.
  else { graph.cue('cloth',2); graph.cue('wood',2.15) } // Retain existing wake-up cues.
  const bus=ctx.createGain();bus.gain.value=Math.pow(.35,1.4)*.8;bus.connect(ctx.destination)
  for(const e of events){
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffers[e.name];source.playbackRate.value=e.rate
    const start=Math.max(0,e.start+(e.jitter??0)),end=Math.min(e.end,seconds),fade=Math.min(e.fade??.035,Math.max(.001,(end-start)/3));e.actualStart=start;e.actualEnd=end
    if(end<=start)continue;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(e.gain,start+.006);gain.gain.setValueAtTime(e.gain,Math.max(start+.006,end-fade));gain.gain.linearRampToValueAtTime(0,end)
    source.connect(gain);gain.connect(bus);source.start(start,e.offset);source.stop(end)
  }
  const result=await ctx.startRendering();graph.dispose();let peak=0,sum=0,invalid=0,maxForeground=0
  for(let c=0;c<2;c++)for(const value of result.getChannelData(c)){peak=Math.max(peak,Math.abs(value));sum+=value*value;if(!Number.isFinite(value))invalid++}
  for(let t=0;t<seconds;t+=.001)maxForeground=Math.max(maxForeground,foreground.filter(e=>e.actualStart<=t&&e.actualEnd>t).length+(way==='return'?(t>=2&&t<2.85?1:0)+(t>=2.15&&t<2.8?1:0):0))
  const output=new ArrayBuffer(44+result.length*4),view=new DataView(output),str=(p,s)=>{for(let i=0;i<s.length;i++)view.setUint8(p+i,s.charCodeAt(i))}
  str(0,'RIFF');view.setUint32(4,output.byteLength-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,result.length*4,true)
  for(let c=0;c<2;c++)for(let i=0;i<result.length;i++)view.setInt16(44+i*4+c*2,Math.round(Math.max(-1,Math.min(1,result.getChannelData(c)[i]))*32767),true)
  let binary='';const bytes=new Uint8Array(output);for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
  const overlapPairs=[]
  if(frontSlow&&overlap){
    const pairs=[['dep_notebook_close','dep_log_creak'],['dep_log_creak','dep_staff_tap'],['dep_staff_tap','dep_steps_dirt'],['dep_steps_dirt','dep_cloth_kneel'],['dep_cloth_kneel','dep_lantern_clink'],['dep_lantern_clink','dep_ember_spark'],['dep_ember_spark','dep_fire_flare'],['dep_fire_flare','dep_cloth_rise']]
    for(const[a,b]of pairs){const first=events.filter(e=>e.name===a).at(-1),second=events.find(e=>e.name===b);const earlier=a==='dep_staff_tap'?events.find(e=>e.name===b):second;overlapPairs.push({from:a,to:b,seconds:Math.max(0,Math.min(first.actualEnd,earlier.actualEnd)-Math.max(first.actualStart,earlier.actualStart))})}
  }
  return{wav:btoa(binary),seconds,scale,frontSlow,overlap,overlapPairs,peak,rms:Math.sqrt(sum/(result.length*2)),invalid,maxForeground,events,calibration}
}
app.whenReady().then(async()=>{try{
  const win=new BrowserWindow({show:false});await win.loadURL('about:blank')
  const built=await require('esbuild').build({entryPoints:[path.join(root,'src/renderer/src/lobby/campfireAudio.ts')],loader:{'.mp3':'dataurl','.wav':'dataurl'},bundle:true,format:'iife',globalName:'Audio',write:false})
  await win.webContents.executeJavaScript(built.outputFiles[0].text)
  const report={date:'2026-10-03',previewOnly:true,sourceHashes:hashes,samples:{},provenance:'User-supplied ElevenLabs WAVs; paid plan confirmed, exact tier unspecified; batch dates not independently provided',notes:['No production changes, no new synthesis; unchanged existing C4 and return wake-up cloth/wood cues retained','Dirt excerpt uses first 0.4 seconds, contains three fast impacts; only one supplied version','Bridge up a and c are duplicates; c excluded','Return settle main sound aligned to 0.8 seconds; existing wake-up cloth/wood at 2/2.15 seconds','Stone hum and other batch 7 recordings absent; not added','Quiet cloth/fog/sway/air are texture layers outside the maximum-three foreground budget']}
  for(const way of ['bridge','steps','return']){
    const result=await win.webContents.executeJavaScript(`(${candidate.toString()})(${JSON.stringify(sources)},${JSON.stringify(way)},${stretch},${frontSlow},${overlap})`)
    assert(result.invalid===0&&result.peak<Math.pow(10,-3/20)&&result.maxForeground<=3)
    if(overlap&&way!=='return')assert(result.overlapPairs.every(pair=>pair.seconds>0),'Expected natural action overlaps')
    const name=way==='return'?'return-campfire-4s':`departure-${way}-${frontSlow?8:5*stretch}s`
    fs.writeFileSync(path.join(out,name+'.wav'),Buffer.from(result.wav,'base64'));delete result.wav;report.samples[way]=result
  }
  if(stretch!==1){report.notes=report.notes.filter(n=>!n.startsWith('Dirt excerpt'));report.notes.push('8-second candidate: event spacing extended without pitching/stretching source recordings; dirt split into two isolated supplied impacts at 1.36/1.76 seconds; original 5-second production animation unchanged')}
  if(frontSlow){report.notes=report.notes.filter(n=>!n.startsWith('Dirt excerpt'));report.notes.push('User correction: slow only preparation/borrowing fire; close book 0.3, rise 1.2, staff 1.9, dirt 2.45/3.1, kneel 3.8, handle 4, spark 4.78, ignition 5.05; departure steps shift +3 seconds with original 0.38-second gaps; production unchanged')}
  if(overlap){report.notes=report.notes.filter(n=>!n.startsWith('User correction:'));report.notes.push('Natural-overlap revision: retain ignition 5.05 and original exit pace; book 0.4, rise 0.9, staff 1.65, dirt 2.3/3, kneel 3.35, handle 4.05, spark 4.65; adjacent action pairs explicitly overlap without pitching, stretching or adding generated audio')}
  // A/B of already clipped source files: original level then calibrated level, without repair.
  const parts=[],comparison=[];let elapsed=0
  const calibration=report.samples.bridge.calibration
  for(const [name,info] of Object.entries(calibration).filter(([,info])=>info.clipped>0)){
    const original=fs.readFileSync(path.join(incoming,name+'.wav'));let pcm
    for(let pos=12;pos+8<=original.length;){const size=original.readUInt32LE(pos+4);if(original.toString('ascii',pos,pos+4)==='data'){pcm=original.subarray(pos+8,pos+8+size);break}pos+=8+size+(size%2)}
    assert(pcm&&pcm.length%4===0)
    const processed=Buffer.alloc(pcm.length)
    for(let i=0;i<pcm.length;i+=2)processed.writeInt16LE(Math.round(pcm.readInt16LE(i)*info.gain),i)
    comparison.push({name,beforeStart:elapsed,afterStart:elapsed+pcm.length/192000+.2,gain:info.gain,sourceClippedSamples:info.clipped})
    parts.push(pcm,Buffer.alloc(38400),processed,Buffer.alloc(57600));elapsed+=2*pcm.length/192000+.5
  }
  const pcm=Buffer.concat(parts),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(48000,24);header.writeUInt32LE(192000,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40)
  fs.writeFileSync(path.join(out,'clipped-before-after.wav'),Buffer.concat([header,pcm]));report.clippedComparison=comparison
  for(const[name,hash]of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(incoming,name+'.wav'))).digest('hex'),hash)
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(report.samples).map(([k,v])=>[k,{peak:v.peak,rms:v.rms,maxForeground:v.maxForeground}]))));app.exit(0)
}catch(error){console.error(error);app.exit(1)}})
