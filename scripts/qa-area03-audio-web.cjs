const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),os=require('node:os')
const out=path.resolve(__dirname,'../previews/area03-audio-web'),report={errors:[],checks:[]},delay=ms=>new Promise(r=>setTimeout(r,ms))
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'fq-web-audio-')));app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required')
let win;const js=s=>win.webContents.executeJavaScript(s,true)
async function until(fn,label){const end=Date.now()+45000;while(Date.now()<end){if(await fn())return;await delay(200)}throw Error('Timeout: '+label)}
app.whenReady().then(async()=>{
 const primary=screen.getPrimaryDisplay(),display=screen.getAllDisplays().find(d=>d.id!==primary.id)||primary
 win=new BrowserWindow({x:display.workArea.x+12,y:display.workArea.y+12,width:1400,height:900,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});win.webContents.setAudioMuted(true);win.showInactive()
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3||m.includes('GL_INVALID_OPERATION'))report.errors.push(m)})
 await win.loadURL('http://127.0.0.1:4173/');await until(()=>js('window.__lakeAudioWeb?.state().ready'),'scene')
 await js(`window.audioChecks={decoded:0,failed:0,shots:[],closed:0};const dp=AudioContext.prototype.decodeAudioData,cp=AudioContext.prototype.createBufferSource,cl=AudioContext.prototype.close;AudioContext.prototype.decodeAudioData=async function(...args){try{const b=await dp.apply(this,args);audioChecks.decoded++;return b}catch(e){audioChecks.failed++;throw e}};AudioContext.prototype.createBufferSource=function(){const s=cp.call(this),st=s.start;s.start=function(...args){audioChecks.shots.push({duration:s.buffer?.duration,loop:s.loop});return st.apply(this,args)};return s};AudioContext.prototype.close=function(){audioChecks.closed++;return cl.call(this)};document.getElementById('start').click()`)
 await until(()=>js('audioChecks.decoded===28'),'28 game recordings decoded');await delay(800)
 report.checks.push(await js(`({tracks:document.querySelectorAll('.track').length,decoded:audioChecks.decoded,failed:audioChecks.failed,loops:audioChecks.shots.filter(s=>s.loop).length})`))
 assert.equal(report.checks[0].tracks,28);assert.equal(report.checks[0].failed,0);assert.equal(report.checks[0].loops,5)
 await js(`__lakeAudioWeb.playTrack('lake_lap_loop','岸邊水拍')`);await until(()=>js('document.getElementById("player").readyState>=3'),'solo audio');await delay(200)
 const solo=await js(`({mode:__lakeAudioWeb.state().mode,paused:__lakeAudioWeb.scene.debugState().paused,closed:audioChecks.closed,loop:document.getElementById('player').loop,playing:!document.getElementById('player').paused})`)
 assert.equal(solo.closed,1);assert.equal(solo.paused,true);assert.equal(solo.loop,true);assert.equal(solo.playing,true);report.checks.push(solo)
 const decoded=await js(`(async()=>{const ctx=new AudioContext(),results=[];for(const [name,url] of Object.entries(__lakeAudioWeb.urls)){const response=await fetch(url);if(!response.ok)throw Error(name);const b=await ctx.decodeAudioData(await response.arrayBuffer());results.push({name,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate})}await ctx.close();return results})()`)
 assert.equal(decoded.length,28);assert(decoded.every(b=>b.channels===2&&b.sampleRate===48000));report.recordings=decoded
 for(const preset of ['day','rising','high','falling','night']){await js(`__lakeAudioWeb.environment(${JSON.stringify(preset)})`);await delay(250);report.checks.push(await js(`({preset:${JSON.stringify(preset)},sim:__lakeAudioWeb.state().seconds,tide:__lakeAudioWeb.scene.debugState().tide,time:document.getElementById('progress').textContent})`))}
 const ids=await js(`[...document.getElementById('events').options].map(o=>o.value)`)
 for(const id of ids){await js(`__lakeAudioWeb.playEvent(${JSON.stringify(id)})`);await delay(100)}
 report.checks.push({renderedActions:ids.length})
 await js(`audioChecks.shots=[];__lakeAudioWeb.playEvent('story_second_cup')`);await delay(13500)
 const cups=await js(`audioChecks.shots.filter(s=>!s.loop)`);assert(cups.length>=2,'Tea and cup cues must play');report.checks.push({secondCupCues:cups})
 await js(`__lakeAudioWeb.environment('day');__lakeAudioWeb.stop()`);await delay(250)
 assert.equal(await js('document.getElementById("player").paused'),true);assert.equal(await js('__lakeAudioWeb.state().running'),false)
 fs.writeFileSync(path.join(out,'preview.png'),(await win.webContents.capturePage()).toPNG())
 const source=path.resolve(__dirname,'../src/renderer/src/reflectionLake/audio'),assets=path.join(out,'dist/assets'),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
 report.hashes=fs.readdirSync(source).filter(f=>f.endsWith('.wav')).map(f=>{const packed=fs.readdirSync(assets).find(a=>a.startsWith(f.slice(0,-4)+'-')&&a.endsWith('.wav'));assert(packed);assert.equal(hash(path.join(source,f)),hash(path.join(assets,packed)));return {name:f,sha256:hash(path.join(source,f))}})
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({tracks:28,actions:ids.length,errors:0,hashes:report.hashes.length}));app.exit(0)
}).catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'qa-report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)})
