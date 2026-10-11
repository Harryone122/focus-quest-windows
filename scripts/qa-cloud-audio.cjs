const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/cloud-audio-qa')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-audio-qa-')))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
;(async () => {
  await esbuild.build({ entryPoints: [path.join(root, 'src/renderer/src/cloudRuins/cloudRuinsAudio.ts')], bundle: true, format: 'esm', outfile: path.join(out, 'audio.mjs'), loader: { '.ogg': 'file' } })
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><title>雲上遺庭音效驗證</title><p>環境音測試：風、草葉、遠處水聲、鳥鳴、柔和長音。</p><script type="module">
    const NativeContext=window.AudioContext;const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(target,...rest){if(target===this.context.destination&&!window.tap){window.tap=this.context.createAnalyser();window.tap.fftSize=4096;connect.call(this,tap);connect.call(tap,target);window.capture=this.context.createMediaStreamDestination();connect.call(tap,capture);return target}return connect.call(this,target,...rest)};
    window.AudioContext=class extends NativeContext{constructor(...args){super(...args);window.ctx=this}};
    const {createCloudRuinsAudio}=await import('./audio.mjs');
    window.state={progressSeconds:30,paused:false,muted:false,environmentVolume:35,musicVolume:12};window.handle=createCloudRuinsAudio(state);
    window.rms=()=>{const data=new Float32Array(tap.fftSize);tap.getFloatTimeDomainData(data);return {rms:Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length),peak:Math.max(...data.map(Math.abs))}};
    window.recording=[];window.recorder=new MediaRecorder(capture.stream);recorder.ondataavailable=e=>recording.push(e.data);recorder.start();window.ready=true;
  </script>`)
  await app.whenReady()
  const primary = screen.getPrimaryDisplay(), display = screen.getAllDisplays().find(d => d.id !== primary.id) || primary
  const win = new BrowserWindow({ x: display.workArea.x + 10, y: display.workArea.y + 10, width: 650, height: 220, show: true,
    webPreferences: { autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false } })
  const errors = []
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message) })
  const js = code => win.webContents.executeJavaScript(code, true)
  await win.loadFile(path.join(out, 'index.html'))
  for (let i = 0; i < 100 && !await js('window.ready===true'); i++) await delay(100)
  for (let i = 0; i < 100 && !await js('handle.debugState().birdReady'); i++) await delay(100)
  assert(await js('handle.debugState().birdReady'), 'Bundled CC0 bird recording must decode offline')
  const samples = []
  for (let i = 0; i < 40; i++) { await delay(200); samples.push(await js('rms()')) }
  assert(samples.some(s => s.rms > 0.0005), 'Environment must produce real audio samples')
  assert(Math.max(...samples.map(s => s.peak)) < 0.15, 'Quiet mix must start softly and stay below clipping')
  assert((await js('handle.debugState()')).birdCount > 0, 'Recorded birds must actually play')
  const recording = await js('new Promise(resolve=>{recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(recording).arrayBuffer())));recorder.stop()})')
  fs.writeFileSync(path.join(out, 'preview.webm'), Buffer.from(recording))
  await js('state.paused=true;handle.update(state)'); await delay(250)
  assert.equal(await js('ctx.state'), 'suspended')
  const pausedAt = await js('ctx.currentTime'); await delay(350)
  assert.equal(await js('ctx.currentTime'), pausedAt, 'Pause freezes every audio source')
  await js('state.paused=false;handle.update(state)'); await delay(400)
  assert.equal(await js('ctx.state'), 'running')
  win.hide(); const backgroundAt = await js('ctx.currentTime'); await delay(500)
  assert(await js('ctx.currentTime') > backgroundAt + 0.3, 'Background window must keep ambience playing')
  win.show()
  await js('state.progressSeconds=450;handle.update(state)')
  assert((await js('handle.debugState()')).mix.birds < 0.0001)
  await js('state.muted=true;handle.update(state)'); await delay(250)
  assert.equal(await js('ctx.state'), 'suspended')
  await js('state.muted=false;state.environmentVolume=0;state.musicVolume=0;handle.update(state)'); await delay(250)
  assert.equal(await js('ctx.state'), 'suspended', 'Global zero volumes must silence the map')
  await js('state.environmentVolume=35;handle.update(state)'); await delay(250)
  assert.equal(await js('ctx.state'), 'running', 'Settings changes must restore ambience without rebuilding the map')
  await js('handle.destroy()'); await delay(250)
  assert.equal(await js('ctx.state'), 'closed', 'Leaving map must release the audio context')
  assert.equal(errors.length, 0, errors.join('\n'))
  const report = { birdDecoded: true, birdPlayback: true, maxPeak: Math.max(...samples.map(s => s.peak)), maxRms: Math.max(...samples.map(s => s.rms)), pauseFrozen: true, backgroundContinues: true, muteSuspends: true, globalVolumesApply: true, destroyCloses: true, errors }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); app.exit(0)
})().catch(error => { console.error(error); app.exit(1) })
