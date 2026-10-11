// Render the original soundscape and exercise the real browser audio lifecycle in a disposable profile.
const { app, BrowserWindow, screen } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/moss-audio-qa')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-moss-audio-')))
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = { checks: [], errors: [] }
;(async () => {
  await esbuild.build({ entryPoints: [path.join(root, 'src/renderer/src/mossStation/mossStationAudio.ts')], bundle: true, format: 'esm', outfile: path.join(out, 'audio.mjs') })
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><style>body{background:#23332c;color:#e6e7d9;font:20px sans-serif;padding:40px}button{padding:15px}</style><h1>苔痕驛站聲音實測</h1><p>風、草葉、溪流、下雨、屋簷滴水與淡背景音。</p><button id="play">播放／恢復</button><button id="pause">暫停</button><script type="module">
    const audio=await import('./audio.mjs');window.audio=audio;window.settings={environmentVolume:35,musicVolume:12};
    window.sound=audio.createMossSoundscape(1);window.sound.update(0,settings,false);
    document.querySelector('#play').onclick=()=>sound.update(0,settings,false);document.querySelector('#pause').onclick=()=>sound.update(0,settings,true);
    window.sample=async(rain)=>{let seconds=0,seed=1;if(rain){for(seed=1;seed<100;seed++){for(seconds=0;seconds<3000;seconds+=20){if(audio.mossAudioMix(seed,seconds,settings).rain>.04)break;}if(seconds<3000)break;}}
      const ctx=new OfflineAudioContext(2,48000*12,48000),graph=audio.buildMossAudioGraph(ctx,seed),mix=audio.mossAudioMix(seed,seconds,settings);graph.setMix(mix,false);
      const result=await ctx.startRendering(),data=result.getChannelData(0);let peak=0,sum=0,invalid=0;for(const value of data){peak=Math.max(peak,Math.abs(value));sum+=value*value;if(!Number.isFinite(value))invalid++;}
      const samples=result.length,bytes=new ArrayBuffer(44+samples*4),view=new DataView(bytes);const str=(at,text)=>{for(let i=0;i<text.length;i++)view.setUint8(at+i,text.charCodeAt(i));};
      str(0,'RIFF');view.setUint32(4,36+samples*4,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,48000,true);view.setUint32(28,192000,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples*4,true);
      for(let c=0;c<2;c++){const channel=result.getChannelData(c);for(let i=0;i<samples;i++)view.setInt16(44+i*4+c*2,Math.max(-1,Math.min(1,channel[i]))*32767,true);}
      let binary='';const raw=new Uint8Array(bytes);for(let i=0;i<raw.length;i+=8192)binary+=String.fromCharCode(...raw.subarray(i,i+8192));graph.dispose();return{peak,rms:Math.sqrt(sum/data.length),invalid,seed,seconds,mix,wav:btoa(binary)};};window.ready=true;
  </script>`)
  await app.whenReady()
  const display = screen.getAllDisplays().find(d => d.id !== screen.getPrimaryDisplay().id) || screen.getPrimaryDisplay()
  report.display = { id: display.id, secondary: display.id !== screen.getPrimaryDisplay().id }
  const win = new BrowserWindow({ x: display.workArea.x + 20, y: display.workArea.y + 20, width: 800, height: 500, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) report.errors.push(message) })
  await win.loadFile(path.join(out, 'index.html'))
  const js = source => win.webContents.executeJavaScript(source, true)
  for (let i = 0; i < 100 && !await js('Boolean(window.ready)'); i++) await delay(100)
  for (const rain of [false, true]) {
    const rendered = await js(`window.sample(${rain})`)
    fs.writeFileSync(path.join(out, rain ? 'rain.wav' : 'dry.wav'), Buffer.from(rendered.wav, 'base64')); delete rendered.wav
    assert(rendered.rms > 0.001 && rendered.peak < 0.8 && rendered.invalid === 0)
    report[rain ? 'rain' : 'dry'] = rendered
  }
  assert(report.rain.mix.rain > 0 && report.dry.mix.rain === 0)
  assert.equal(await js('sound.inspect().state'), 'running')
  await js('sound.update(0,settings,true)'); await delay(100)
  assert.equal(await js('sound.inspect().state'), 'suspended')
  await js('sound.update(0,settings,false)'); await delay(100)
  win.minimize(); await delay(1200)
  assert.equal(await js('sound.inspect().state'), 'running')
  win.restore()
  await js('sound.update(0,{environmentVolume:0,musicVolume:0},false)'); await delay(100)
  assert.equal(await js('sound.inspect().state'), 'suspended')
  await js('sound.dispose()'); await delay(100)
  assert.equal(await js('sound.inspect().state'), 'closed')
  assert.equal(report.errors.length, 0)
  report.checks.push('Dry/rain PCM rendered without clipping or invalid samples', 'Paused and muted contexts suspended', 'Minimizing keeps ambience running', 'Dispose closes context and stops every source')
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); app.exit(0)
})().catch(error => { report.errors.push(error.stack || String(error)); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.error(error); app.exit(1) })
