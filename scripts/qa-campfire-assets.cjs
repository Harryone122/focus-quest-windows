const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/lobby-audio-qa/batch-1/accepted')
fs.mkdirSync(out, { recursive: true })
process.env.FOCUSQUEST_QA_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-campfire-audio-'))
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const report = { checks: [], errors: [], profile: process.env.FOCUSQUEST_QA_USER_DATA }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let win
const js = text => win.webContents.executeJavaScript(text, true)
const call = (method, ...args) => js(`window.focusQuest[${JSON.stringify(method)}](...${JSON.stringify(args)})`)
async function until(check, label) { const end = Date.now() + 20000; while (Date.now() < end) { if (await check()) return; await delay(100) }; throw Error(`Timeout: ${label}`) }
require(path.join(root, 'out/main/index.js'))
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
  await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `window.qaAudio=[];const OriginalAudio=window.AudioContext;window.AudioContext=class extends OriginalAudio{constructor(...args){super(...args);this.qaDecoded=0;window.qaAudio.push(this)}async decodeAudioData(...args){const result=await super.decodeAudioData(...args);this.qaDecoded++;return result}}` })
  win.reload()
  await until(() => js('Boolean(window.qaAudio?.length && document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire)'), 'production campfire audio')
  await until(() => js('qaAudio.some(c=>c.state==="running")'), 'playing')
  await until(() => js('qaAudio[0].qaDecoded===32'),'all five supplied campfire assets decoded')
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
  const built = await require('esbuild').build({ entryPoints: [path.join(root, 'src/renderer/src/lobby/campfireAudio.ts')], loader:{'.mp3':'dataurl','.wav':'dataurl'}, bundle: true, format: 'iife', globalName: 'CampfireAudio', write: false })
  await js(`window.qaCampfireModule=(()=>{${built.outputFiles[0].text};return CampfireAudio})();true`)
  const render = async (stage, only = null) => js(`(async()=>{
    const ctx=new OfflineAudioContext(2,48000*60,48000), graph=qaCampfireModule.buildCampfireAudioGraph(ctx);
    const assets=await qaCampfireModule.loadCampfireAssets(ctx);graph.installAssets(${JSON.stringify(only)}?Object.fromEntries(Object.entries(assets).filter(([key])=>key===${JSON.stringify(only)})):assets);
    graph.setMix(qaCampfireModule.campfireAudioMix(0,${stage},{environmentVolume:35}),false);
    graph.setBirdVolume({environmentVolume:35},${stage});if(${stage}===5){graph.bird(0,8);graph.bird(1,40);}
    const result=await ctx.startRendering();let peak=0,sum=0,invalid=0,firstInvalid=-1;
    for(let c=0;c<2;c++)for(const [i,value] of result.getChannelData(c).entries()){peak=Math.max(peak,Math.abs(value));sum+=value*value;if(!Number.isFinite(value)){invalid++;if(firstInvalid<0)firstInvalid=i/48000}}
    const bytes=new ArrayBuffer(44+result.length*4),v=new DataView(bytes),str=(p,t)=>{for(let i=0;i<t.length;i++)v.setUint8(p+i,t.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,48000,true);v.setUint32(28,192000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,result.length*4,true);
    for(let c=0;c<2;c++)for(let i=0;i<result.length;i++)v.setInt16(44+i*4+c*2,Math.max(-1,Math.min(1,result.getChannelData(c)[i]))*32767,true);
    let binary='';const raw=new Uint8Array(bytes);for(let i=0;i<raw.length;i+=8192)binary+=String.fromCharCode(...raw.subarray(i,i+8192));
    const assetInfo=graph.inspectAssets();graph.dispose();return{peak,rms:Math.sqrt(sum/(result.length*2)),invalid,firstInvalid,...assetInfo,wav:btoa(binary)};
  })()`)
  report.samples={};for(const stage of [3,5]){const rendered=await render(stage);
    const wav = Buffer.from(rendered.wav,'base64');
    fs.writeFileSync(path.join(out,'campfire-stage-'+stage+'.wav'),wav);delete rendered.wav;report.samples[stage]=rendered;
    const approved = fs.readFileSync(path.join(root,'previews/lobby-audio-qa/batch-1/review-3/campfire-stage-'+stage+'-water-50.wav'));
    assert.equal(wav.length, approved.length);
    let difference = 0;for(let i=44;i<wav.length;i+=2)difference=Math.max(difference,Math.abs(wav.readInt16LE(i)-approved.readInt16LE(i)));
    // The preview rounds PCM and this renderer truncates it: one quantization step is allowed.
    assert(difference<=1, 'Production render differs from the user-approved listening preview');
    report.samples[stage].approvedPcmMaxDifference=difference;
    assert.equal(rendered.calibrations.water.loopStart,2);
    if(rendered.invalid){report.diagnostics={};for(const key of ['fire','wind','water','tarp']){const isolated=await render(3,key);delete isolated.wav;report.diagnostics[key]=isolated;}}
    assert(rendered.peak<0.8&&rendered.rms>0.0001&&rendered.invalid===0);assert.equal(Object.keys(rendered.calibrations).length,5);}
  // A missing recording leaves the existing layer in place; birds have no generated fallback.
  const fallback=await js(`(async()=>{const ctx=new OfflineAudioContext(2,4800,48000),graph=qaCampfireModule.buildCampfireAudioGraph(ctx);const realFetch=window.fetch;try{window.fetch=()=>Promise.reject(Error('QA missing recording'));graph.installAssets(await qaCampfireModule.loadCampfireAssets(ctx));return graph.inspectAssets()}finally{window.fetch=realFetch;graph.dispose()}})()`);
  assert.equal(Object.keys(fallback.calibrations).length,0);assert.equal(fallback.birdsReady,false);
  const stage5=await js(`(async()=>{const sound=qaCampfireModule.createCampfireSoundscape();window.qaStage5Sound=sound;await new Promise(r=>setTimeout(r,1500));sound.update({mode:'idle',idleT:0,t:0,stage:5},{environmentVolume:35,musicVolume:12});return sound.inspect()})()`);
  assert.equal(stage5.birdsReady,true);
  await js(`window.qaStage5Timer=setInterval(()=>qaStage5Sound.update({mode:'idle',idleT:0,t:0,stage:5},{environmentVolume:35,musicVolume:12}),120)`);
  await until(()=>js('qaStage5Sound.inspect().birdIndex===1'),'stage-5 bird excerpt');
  assert.equal(await js('qaStage5Sound.inspect().birdIndex'),1);
  await js('clearInterval(qaStage5Timer);qaStage5Sound.dispose();true');await delay(300);
  // Real departure removes the lobby graph and leaves destination audio alone.
  let snapshot = await call('addListTask', { title: 'QA 營火音效出發' })
  if (!snapshot.todayRun) snapshot = await call('startDailyRun', snapshot.taskList.nextTaskId)
  const route = snapshot.expeditionNodes.find(n => n.areaId === 'area-01-cloud-ruins')
  await call('selectExpeditionNode', snapshot.todayRun.id, route.id)
  await call('startListFocus', { taskId: snapshot.taskList.nextTaskId, minimumMinutes: 5, blockedProcessNames: [], runId: snapshot.todayRun.id, nodeId: route.id, plannedMinutes: 50 })
  await delay(8500)
  await until(()=>js('qaAudio[0].state==="closed" && qaAudio.filter(c=>c.state==="running").length===1'),'completed departure and old context cleanup')
  assert(await js('qaAudio[0].state!=="running" && qaAudio.filter(c=>c.state==="running").length===1'))
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.checks.push('Five supplied MP3s decoded in production; single lobby context','Saved mute and zero volume suspend playback; settings resume it','Settings sheet retains ambience; Collection stops it; Today resumes it','Minimizing retains ambience','Stage 3/5 60-second stereo PCM has no clipping or invalid samples','Missing assets retain existing fallback; no invented bird fallback','Stage 5 waits eight seconds then plays one sparse bird excerpt','Departure leaves only the destination soundscape running')
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); app.exit(0)
})().catch(error => { report.errors.push(error.stack || String(error)); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); app.exit(1) })
