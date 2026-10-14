// Exercise production frame drivers with a controlled 5 fps clock; skip GPU draws only.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/map-animation-clocks-qa');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(require('node:os').tmpdir(),'fq-animation-')));
(async()=>{
 await esbuild.build({stdin:{contents:`export {createGlassNurseryScene as nursery} from './src/renderer/src/glassNursery/glassNurseryScene.js';export {createMossStationScene as moss} from './src/renderer/src/mossStation/mossStationScene.js';export {createReflectionLakeScene as lake} from './src/renderer/src/reflectionLake/reflectionLakeScene.js';export {createCloudRuinsScene as cloud} from './src/renderer/src/cloudRuins/cloudRuinsScene.js';`,resolveDir:root},bundle:true,format:'esm',outfile:path.join(out,'scenes.mjs'),plugins:[{name:'observe-frame-clock',setup(b){
  b.onLoad({filter:/\.txt\?raw$/},a=>({loader:'text',contents:fs.readFileSync(a.path.replace(/\?raw$/,''),'utf8')}));
  b.onLoad({filter:/nurseryAudio\.ts$/},()=>({loader:'js',contents:'export function createNurseryAudio(){return null}'}));
  b.onLoad({filter:/(glassNursery|mossStation|reflectionLake|cloudRuins)Scene\.js$/},a=>{let s=fs.readFileSync(a.path,'utf8').replace(/\r\n/g,'\n');
   if(a.path.includes('glassNursery'))s=s.replace(/let compiled=false;[^\n]+/,'let compiled=true; window.__frame=()=>draw();window.__animationClock=()=>time;');
   else if(a.path.includes('reflectionLake'))s=s.replace('function draw(now=performance.now()) {','window.__frame=()=>draw();window.__animationClock=()=>tAcc;\nfunction draw(now=performance.now()) {');
   else s=s.replace('  let programsReady = !!opts.manualFrames;','  window.__frame=()=>frame(false);window.__animationClock=()=>tAcc;\n  let programsReady = !!opts.manualFrames;');
   s=s.replace(/glass\.render\([^;]+;/g,'');return {loader:'js',contents:s};});
 }}]});
 fs.writeFileSync(path.join(out,'index.html'),`<div id="host" style="width:1000px;height:700px"></div><script type="module">window.__now=10000;performance.now=()=>__now;requestAnimationFrame=()=>0;cancelAnimationFrame=()=>{};setInterval=()=>0;window.code=await import('./scenes.mjs');window.ready=true;</script>`);
 await app.whenReady();const win=new BrowserWindow({show:false});await win.loadFile(path.join(out,'index.html'));const js=s=>win.webContents.executeJavaScript(s,true);
 for(let i=0;i<200&&!await js('window.ready===true');i++)await new Promise(r=>setTimeout(r,50));
 const results=[];
 for(const name of ['cloud','moss','lake','nursery']){
  const r=await js(`(()=>{window.handle?.destroy();host.replaceChildren();window.handle=code[${JSON.stringify(name)}](host,{manualFrames:true,targetSeconds:3000,seed:17});__frame();const before=__animationClock();for(let i=0;i<50;i++){__now+=200;handle.setProgress(i*.2);__frame();}const duration=__animationClock()-before;handle.setPaused(true);__frame();const frozen=__animationClock();__now+=2000;__frame();return {name:${JSON.stringify(name)},duration,pauseAdvance:__animationClock()-frozen};})()`);
  assert(Math.abs(r.duration-10)<.001,JSON.stringify(r));assert.equal(r.pauseAdvance,0);results.push(r);
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));app.exit(0);
})().catch(e=>{console.error(e);app.exit(1)});
