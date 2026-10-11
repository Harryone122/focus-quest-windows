const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), bundle = process.env.FOCUSQUEST_QA_BUNDLE ? path.resolve(process.env.FOCUSQUEST_QA_BUNDLE) : root
const out = path.join(root, 'previews/lobby-audio-qa/batch-2/accepted', bundle === root ? '' : 'shipped')
fs.mkdirSync(out, { recursive: true })
process.env.FOCUSQUEST_QA_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-campfire-audio-'))
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const report = { checks: [], errors: [], profile: process.env.FOCUSQUEST_QA_USER_DATA }
const exitWay = process.argv.includes('--steps') ? 'steps' : 'bridge'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let win
const js = text => win.webContents.executeJavaScript(text, true)
const call = (method, ...args) => js(`window.focusQuest[${JSON.stringify(method)}](...${JSON.stringify(args)})`)
async function until(check, label) { const end = Date.now() + 20000; while (Date.now() < end) { if (await check()) return; await delay(100) }; throw Error(`Timeout: ${label}`) }
require(path.join(bundle, 'out/main/index.js'))
;(async () => {
  await app.whenReady()
  await until(() => { win = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Focus Quest'); return !!win }, 'main window')
  const primary = screen.getPrimaryDisplay(), display = screen.getAllDisplays().find(d => d.id !== primary.id) || primary
  report.display = { secondary: display.id !== primary.id, id: display.id }
  win.setBounds({ x: display.workArea.x + 10, y: display.workArea.y + 10, width: Math.min(1400, display.workArea.width - 20), height: Math.min(850, display.workArea.height - 20) })
  win.showInactive()
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) report.errors.push(message) })
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('Page.enable')
  await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `window.qaAudio=[];window.qaMeters=[];const OriginalAudio=window.AudioContext;window.AudioContext=class extends OriginalAudio{constructor(...args){super(...args);this.qaDecoded=0;window.qaAudio.push(this)}async decodeAudioData(...args){const buffer=await super.decodeAudioData(...args);this.qaDecoded++;return buffer}};const connect=AudioNode.prototype.connect;AudioNode.prototype.connect=function(target,...args){if(target instanceof AudioDestinationNode){const meter=this.context.createAnalyser();meter.fftSize=2048;connect.call(this,meter);window.qaMeters.push(meter)}return connect.call(this,target,...args)}` })
  win.reload()
  await until(() => js('Boolean(window.qaAudio?.length && document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire)'), 'production campfire audio')
  await until(() => js('qaAudio.some(c=>c.state==="running")'), 'playing')
  await until(() => js('qaAudio[0].qaDecoded===32'), 'all 32 supplied recordings decoded in production');report.decodedRecordings=32;
  assert.equal(await js('qaAudio.filter(c=>c.state==="running").length'), 1)
  await call('updateSettings', { audioMuted: true })
  await until(() => js('qaAudio.every(c=>c.state!=="running")'), 'mute')
  await call('updateSettings', { audioMuted: false, environmentVolume: 35 })
  await until(() => js('qaAudio.some(c=>c.state==="running")'), 'unmute')
  await call('updateSettings', { environmentVolume: 0 })
  await until(() => js('qaAudio.every(c=>c.state!=="running")'), 'zero volume')
  await call('updateSettings', { environmentVolume: 35 })
  await until(() => js('qaAudio.some(c=>c.state==="running")'), 'volume restored')
  await js(`Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.includes('設定')).click()`)
  await delay(300)
  assert(await js('qaAudio.some(c=>c.state==="running")'))
  await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`)
  await js(`Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.includes('收藏室')).click()`)
  await delay(1200)
  assert(await js('qaAudio.every(c=>c.state!=="running")'))
  await js(`Array.from(document.querySelectorAll('.sidebar button')).find(b=>b.textContent.includes('今天')).click()`)
  await delay(500)
  assert(await js('qaAudio.some(c=>c.state==="running")'))
  win.minimize(); await delay(1200)
  assert(await js('qaAudio.some(c=>c.state==="running")'))
  win.restore()
  for (let attempt = 0; attempt < 3; attempt++) {
    await delay(1200)
    try { fs.writeFileSync(path.join(out, 'lobby.png'), (await win.webContents.capturePage()).toPNG()); break }
    catch (error) { if (attempt === 2) throw error }
  }
  // Render all authored layers and motion details with the actual browser DSP.
  const built = await require('esbuild').build({ entryPoints: [path.join(root, 'src/renderer/src/lobby/campfireAudio.ts')], loader: { '.mp3': 'dataurl', '.wav': 'dataurl' }, bundle: true, format: 'iife', globalName: 'CampfireAudio', write: false })
  await js(`window.qaCampfireModule=(()=>{${built.outputFiles[0].text};return CampfireAudio})();true`)
  const render = async (way, settings) => js(`(async()=>{
    const seconds=${way === 'return' ? 4 : 8},ctx=new OfflineAudioContext(2,48000*seconds,48000), graph=qaCampfireModule.buildCampfireAudioGraph(ctx);
    const settings=${JSON.stringify(settings)};graph.setMusic(settings,false);graph.setActionVolume(settings,false);graph.installAssets(await qaCampfireModule.loadCampfireAssets(ctx));graph.installActions(await qaCampfireModule.loadCampfireActions(ctx));
    for(let t=0;t<seconds;t+=1/60)graph.setMix(qaCampfireModule.campfireActionMix(t,3,settings,${JSON.stringify(way)}),false,0.04,t);
    graph.scheduleActions(${JSON.stringify(way)},0,0,3);
    const result=await ctx.startRendering();let peak=0,sum=0,invalid=0;
    for(let c=0;c<2;c++)for(const value of result.getChannelData(c)){peak=Math.max(peak,Math.abs(value));sum+=value*value;if(!Number.isFinite(value))invalid++;}
    const bytes=new ArrayBuffer(44+result.length*4),v=new DataView(bytes),str=(p,t)=>{for(let i=0;i<t.length;i++)v.setUint8(p+i,t.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,48000,true);v.setUint32(28,192000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,result.length*4,true);
    for(let c=0;c<2;c++)for(let i=0;i<result.length;i++)v.setInt16(44+i*4+c*2,Math.max(-1,Math.min(1,result.getChannelData(c)[i]))*32767,true);
    let binary='';const raw=new Uint8Array(bytes);for(let i=0;i<raw.length;i+=8192)binary+=String.fromCharCode(...raw.subarray(i,i+8192));graph.dispose();return{peak,rms:Math.sqrt(sum/(result.length*2)),invalid,wav:btoa(binary)};
  })().catch(e=>({error:e.name+': '+e.message,stack:e.stack}))`)
  report.samples={};
  for(const [name,way,settings] of [
    ['departure-bridge-8s','bridge',{environmentVolume:35,musicVolume:12}],
    ['departure-steps-8s','steps',{environmentVolume:35,musicVolume:12}],
    ['return-campfire-4s','return',{environmentVolume:35,musicVolume:12}],
    ['departure-environment-only','bridge',{environmentVolume:35,musicVolume:0}],
    ['departure-glass-only','bridge',{environmentVolume:0,musicVolume:100}],
    ['departure-muted','bridge',{environmentVolume:100,musicVolume:100,audioMuted:true}]
  ]) {
    const rendered=await render(way,settings);
    assert(!rendered.error,rendered.error+'\n'+rendered.stack);
    if(name.endsWith('8s')||name.endsWith('4s')){
      const wav=Buffer.from(rendered.wav,'base64');fs.writeFileSync(path.join(out,name+'.wav'),wav);
      const approved=fs.readFileSync(path.join(root,'previews/lobby-audio-qa/batch-2/review-front-overlap',name+'.wav'));
      assert.equal(wav.length,approved.length);let difference=0;for(let i=44;i<wav.length;i+=2)difference=Math.max(difference,Math.abs(wav.readInt16LE(i)-approved.readInt16LE(i)));
      rendered.approvedPcmMaxDifference=difference;assert(difference<=1,'Production audio must match accepted preview');
    }
    delete rendered.wav;report.samples[name]=rendered;
    assert(rendered.peak<0.8&&rendered.invalid===0);
    if(settings.audioMuted)assert.equal(rendered.peak,0);else assert(rendered.rms>0.00001);
  }
  const lifecycle=await js(`(async()=>{
    const sound=qaCampfireModule.createCampfireSoundscape();await new Promise(r=>setTimeout(r,1200));
    const scene={mode:'depart',idleT:0,t:0,stage:3,selected:'bridge'},settings={environmentVolume:35,musicVolume:12};
    sound.update(scene,settings);await new Promise(r=>setTimeout(r,100));const started=sound.inspect();
    sound.update({...scene,t:.1},settings,true);await new Promise(r=>setTimeout(r,650));const paused=sound.inspect();
    sound.update({...scene,t:6.3},settings);for(let i=0;i<20&&sound.inspect().state!=='running';i++)await new Promise(r=>setTimeout(r,50));const resumed=sound.inspect();
    sound.update({...scene,t:6.35},{...settings,audioMuted:true});const muted=sound.inspect();sound.dispose();await new Promise(r=>setTimeout(r,250));return{started,paused,resumed,muted,disposed:sound.inspect()};
  })()`);
  assert.equal(lifecycle.started.actionAssetCount,27);assert(lifecycle.started.scheduledActionSources>0);
  assert.equal(lifecycle.paused.scheduledActionSources,0);assert.equal(lifecycle.paused.state,'suspended');
  assert.equal(lifecycle.resumed.state,'running');
  assert(lifecycle.resumed.scheduledEventNames.every(name=>!name.startsWith('dep_')),'Skipped stale preparation cues');
  assert.equal(lifecycle.muted.scheduledActionSources,0);assert.equal(lifecycle.disposed.state,'closed');report.actionLifecycle=lifecycle;
  // Real departure removes the lobby graph and leaves destination audio alone.
  let snapshot = await call('addListTask', { title: 'QA 營火音效出發' })
  if (!snapshot.todayRun) snapshot = await call('startDailyRun', snapshot.taskList.nextTaskId)
  const route = snapshot.expeditionNodes.find(n => n.areaId === (exitWay === 'steps' ? 'area-02-moss-station' : 'area-01-cloud-ruins'))
  report.exit = exitWay
  await call('selectExpeditionNode', snapshot.todayRun.id, route.id)
  await js(`window.qaHandoff=[];window.qaSampleTimer=setInterval(()=>{let rms=0;for(const meter of qaMeters){if(meter.context.state!=='running')continue;const samples=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(samples);rms=Math.max(rms,Math.sqrt(samples.reduce((s,x)=>s+x*x,0)/samples.length))}qaHandoff.push({at:performance.now(),rms,states:qaAudio.map(c=>c.state),t:document.querySelector('.campfire-stage iframe')?.contentWindow?.__campfire?.S.t,held:document.querySelector('.campfire-stage iframe')?.contentWindow?.__hold})},50)`)
  await call('startListFocus', { taskId: snapshot.taskList.nextTaskId, minimumMinutes: 5, blockedProcessNames: [], runId: snapshot.todayRun.id, nodeId: route.id, plannedMinutes: 50 })
  await until(()=>js('document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire?.S.t>=2.2'),'preparation');
  const active=await call('getSnapshot');await call('pauseFocus',active.activeSession.id);
  await until(()=>js('document.querySelector(".campfire-stage iframe")?.contentWindow?.__hold'),'paused visual clock');
  const pausedTime=await js('document.querySelector(".campfire-stage iframe").contentWindow.__campfire.S.t');await delay(800);
  assert.equal(await js('document.querySelector(".campfire-stage iframe").contentWindow.__campfire.S.t'),pausedTime);
  assert(await js('qaAudio[0].state==="suspended"'));
  const resumeAt=await js('performance.now()');await call('resumeFocus',active.activeSession.id);
  await until(()=>js('!document.querySelector(".campfire-stage iframe")?.contentWindow?.__hold && qaAudio[0].state==="running"'),'resumed visual/audio clocks');
  const audioResumedAt=await js('performance.now()');report.resumeAudioDelayMs=audioResumedAt-resumeAt;assert(report.resumeAudioDelayMs<=500,'Bounded audio-device resume latency');
  await until(()=>js('document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire?.S.t>=5.1'),'extended ignition');
  assert(await js('document.querySelector(".campfire-stage iframe").contentWindow.__campfire.S.lit'));
  fs.writeFileSync(path.join(out,'ignition-'+exitWay+'.png'),(await win.webContents.capturePage()).toPNG());
  await until(()=>js('document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire?.S.t>=7.0'),'exit');
  fs.writeFileSync(path.join(out,'exit-'+exitWay+'.png'),(await win.webContents.capturePage()).toPNG());
  await until(()=>js('qaAudio[0].state==="closed" && qaAudio.filter(c=>c.state==="running").length===1'),'departure handoff and old graph cleanup')
  await delay(700)
  fs.writeFileSync(path.join(out,'destination.png'),(await win.webContents.capturePage()).toPNG())
  const handoff=await js('clearInterval(qaSampleTimer);qaHandoff');report.handoff=handoff;
  report.maxObservedSceneTime=Math.max(...handoff.filter(s=>typeof s.t==='number').map(s=>s.t));assert(report.maxObservedSceneTime>=8,'Observed extended eight-second animation');
  const ignition=handoff.findIndex(s=>s.t>=5.05);assert(ignition>=0,'Observed production ignition');
  let silenceMs=0,maxSilenceMs=0;
  for(let i=ignition;i<handoff.length;i++){silenceMs=handoff[i].rms<0.00001?silenceMs+(i?handoff[i].at-handoff[i-1].at:50):0;maxSilenceMs=Math.max(maxSilenceMs,silenceMs)}
  report.maxSilenceMs=maxSilenceMs;assert(maxSilenceMs<=500,'Handoff silence exceeds 0.5 seconds');
  assert(handoff.filter(s=>s.t>=0.5&&s.t<=7.8&&!s.held&&(s.at<resumeAt||s.at>=audioResumedAt)).every(s=>s.states[0]==='running'),'Campfire keeps playing throughout departure outside bounded device resume');
  assert(await js('qaAudio[0].state!=="running" && qaAudio.filter(c=>c.state==="running").length===1'))
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.checks.push('One campfire soundscape in production lobby', 'Saved mute and zero volume suspend playback; changing settings resumes it', 'Settings sheet retains ambience; Collection stops it; Today resumes it', 'Minimizing retains ambience', '8-second accepted departure stereo PCM has no clipping or invalid samples', 'Campfire plays during departure; handoff has no silence over 500ms; only destination remains')
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(out, 'report-'+exitWay+'.json'), JSON.stringify(report, null, 2)); app.exit(0)
})().catch(async error => {
  report.errors.push(error.stack || String(error));
  try { report.failureState=await js('({scene:document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire?.S,held:document.querySelector(".campfire-stage iframe")?.contentWindow?.__hold,contexts:qaAudio.map(c=>({state:c.state,decoded:c.qaDecoded})),frames:Array.from(document.querySelectorAll("iframe")).map(f=>f.title),handoff:window.qaHandoff?.slice(-10)})');fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG()) } catch {}
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); app.exit(1)
})
