// Listening-only renders. Does not modify production source or settings.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path')
const out = path.resolve('previews/lobby-audio-qa/batch-1/review-current')
fs.mkdirSync(out, { recursive: true })
function wav(channels, rate = 48000) {
  const data = Buffer.alloc(44 + channels[0].length * 4)
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22)
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34)
  data.write('data', 36); data.writeUInt32LE(data.length - 44, 40)
  for (let c = 0; c < 2; c++) for (let i = 0; i < channels[c].length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), 44 + i * 4 + c * 2)
  return data
}
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false })
    await win.loadURL('about:blank')
    // Approved processing now lives in production; retain older review files unchanged.
    const code = (await require('esbuild').build({ entryPoints: [path.resolve('src/renderer/src/lobby/campfireAudio.ts')], bundle: true, write: false, format: 'iife', globalName: 'Audio', loader: { '.mp3': 'dataurl', '.wav': 'dataurl' } })).outputFiles[0].text
    await win.webContents.executeJavaScript(code)
    async function render(stage, key = null, seconds = 60) {
      return win.webContents.executeJavaScript(`(async()=>{
        const ctx=new OfflineAudioContext(2,48000*${seconds},48000),graph=Audio.buildCampfireAudioGraph(ctx);
        graph.installAssets(await Audio.loadCampfireAssets(ctx));
        const mix=Audio.campfireAudioMix(0,${stage},{environmentVolume:35});
        const key=${JSON.stringify(key)};if(key){for(const k of Object.keys(mix))mix[k]=k===key?0.2:0;}
        graph.setMix(mix,false);if(!key){graph.setBirdVolume({environmentVolume:35},${stage});if(${stage}===5){graph.bird(0,8);graph.bird(1,40)}}
        const rendered=await ctx.startRendering();graph.dispose();
        return [0,1].map(c=>{const raw=new Uint8Array(rendered.getChannelData(c).buffer);let s='';for(let i=0;i<raw.length;i+=8192)s+=String.fromCharCode(...raw.subarray(i,i+8192));return btoa(s)});
      })()`)
    }
    const decode = encoded => encoded.map(s => {const b=Buffer.from(s,'base64');return new Float32Array(b.buffer,b.byteOffset,b.length/4)})
    const stats = { approved: { waterSeamSeconds: 2, waterRelativeGain: 0.5, productionChangedByThisScript: false } }, comparison = [new Float32Array(48000*24),new Float32Array(48000*24)]
    for (const [section,key] of ['fire','wind','water','tarp'].entries()) {
      const channels=decode(await render(3,key,14)), start=48000*8, frames=48000*6
      let sum=0,peak=0;for(const ch of channels)for(let i=start;i<start+frames;i++){sum+=ch[i]*ch[i];peak=Math.max(peak,Math.abs(ch[i]))}
      const rms=Math.sqrt(sum/(frames*2)), gain=Math.min(4,0.025/Math.max(rms,0.000001))
      for(let c=0;c<2;c++)for(let i=0;i<frames;i++){const fade=Math.min(1,i/960,(frames-1-i)/960);comparison[c][section*frames+i]=channels[c][start+i]*gain*fade}
      stats[key]={sectionStart:section*6,previewRange:[8,14],rms,peak,listeningGain:gain}
    }
    fs.writeFileSync(path.join(out,'noise-layer-comparison.wav'),wav(comparison))
    for(const stage of [3,5]) {
      const channels=decode(await render(stage));let peak=0,sum=0,invalid=0
      for(const ch of channels)for(const value of ch){peak=Math.max(peak,Math.abs(value));sum+=value*value;if(!Number.isFinite(value))invalid++}
      if(invalid || peak>=0.8)throw Error('Invalid listening preview')
      stats['stage'+stage]={peak,rms:Math.sqrt(sum/(channels[0].length*2)),invalid,waterRelativeGain:0.5,productionChanged:false}
      fs.writeFileSync(path.join(out,'campfire-stage-'+stage+'-water-50.wav'),wav(channels))
    }
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(stats,null,2))
    console.log(JSON.stringify(stats));app.exit(0)
  }catch(error){console.error(error);app.exit(1)}
})
