// Real production movement and saved schedules, with controlled time and intermediate GPU draws disabled.
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/interaction-continuity-qa');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(require('node:os').tmpdir(),'fq-motion-')));
const report={checks:[],errors:[]};
(async()=>{
 const entry=`export {createGlassNurseryScene as nursery} from './src/renderer/src/glassNursery/glassNurseryScene.js';export {createMossStationScene as moss} from './src/renderer/src/mossStation/mossStationScene.js';export {createReflectionLakeScene as lake} from './src/renderer/src/reflectionLake/reflectionLakeScene.js';export {createCloudRuinsScene as cloud} from './src/renderer/src/cloudRuins/cloudRuinsScene.js';export * as n from './src/shared/area07';export * as m from './src/shared/area02';export * as l from './src/shared/area03';`;
 await esbuild.build({stdin:{contents:entry,resolveDir:root},bundle:true,format:'esm',outfile:path.join(out,'scenes.mjs'),plugins:[{name:'controlled-motion',setup(b){
  b.onLoad({filter:/\.txt\?raw$/},a=>({loader:'text',contents:fs.readFileSync(a.path.replace(/\?raw$/,''),'utf8')}));
  b.onLoad({filter:/nurseryAudio\.ts$/},()=>({loader:'js',contents:'export function createNurseryAudio(){return null}'}));
  b.onLoad({filter:/(glassNursery|mossStation|reflectionLake|cloudRuins)Scene\.js$/},a=>{let s=fs.readFileSync(a.path,'utf8').replace(/\r\n/g,'\n');
   if(a.path.includes('glassNursery'))s=s.replace(/let compiled=false;[^\n]+/,'let compiled=true; window.__step=()=>draw();window.__position=()=>TRV.pos.toArray();').replace('  glass.render(scene,camera,dt,scene.background,[.34,.24,.08],paused);','  if(window.__draw)glass.render(scene,camera,dt,scene.background,[.34,.24,.08],paused);');
   else if(a.path.includes('reflectionLake'))s=s.replace('function draw(now=performance.now()) {','window.__step=dt=>{applyAction(performance.now());update(dt);};window.__position=()=>trav.position.toArray();\nfunction draw(now=performance.now()) {');
   else s=s.replace('  let programsReady = !!opts.manualFrames;','  window.__step=dt=>update(Math.min(.05,dt),dt);window.__position=()=>trav.position.toArray();\n  let programsReady = !!opts.manualFrames;');
   return {loader:'js',contents:s};});
 }}]});
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><style>html,body,#host{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="host"></div><script type="module">window.__now=10000;performance.now=()=>__now;requestAnimationFrame=()=>0;cancelAnimationFrame=()=>{};setInterval=()=>0;window.code=await import('./scenes.mjs');window.make=(name,extra={})=>{window.handle?.destroy();host.replaceChildren();window.handle=code[name](host,{manualFrames:true,targetSeconds:3000,seed:17,...extra});};window.ready=true;</script>`);
 await app.whenReady();const win=new BrowserWindow({width:1280,height:800,show:false});win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});await win.loadFile(path.join(out,'index.html'));const js=s=>win.webContents.executeJavaScript(s,true);
 for(let i=0;i<100&&!await js('window.ready===true');i++)await new Promise(r=>setTimeout(r,100));
 for(const name of process.env.FOCUSQUEST_QA_FIXTURES_ONLY?[]:['nursery','moss','lake','cloud']){
  const result=await js(`(()=>{const name=${JSON.stringify(name)},dt=.2,failures=[],events=new Set();let state,marks,snapshot,advance,setter;
   if(name==='nursery'){state=code.n.createNurseryRuntime('continuity',[]);marks=code.n.emptyNurseryMarks();advance=code.n.advanceNurseryRuntime;setter='setNurseryState';snapshot=()=>({seed:state.seed,action:state.action,worldMarks:marks,coreTaken:false});}
   if(name==='moss'){state=code.m.createMossRuntime('continuity');marks=code.m.emptyMossMarks();advance=code.m.advanceMossRuntime;setter='setMossState';snapshot=()=>code.m.mossSceneSnapshot('qa',state,marks,false);}
   if(name==='lake'){state=code.l.createLakeRuntime('continuity');marks=code.l.emptyLakeMarks();advance=code.l.advanceLakeRuntime;setter='setLakeState';snapshot=()=>code.l.lakeSnapshot('qa',state,marks,false);}
   if(advance){const r=advance(state,0,marks,[]);state=r.state;marks=r.marks;make(name,{[name]:snapshot()});}else make(name);
   __step(0);let prev=__position(),previousAction=state?.action?.id,max=0,boundaryMax=0;
   for(let frame=1;frame<=15000;frame++){const time=frame*dt;__now+=dt*1000;if(advance){const r=advance(state,time,marks,[]);state=r.state;marks=r.marks;handle[setter](snapshot());if(state.action?.eventId)events.add(state.action.eventId);}handle.setProgress(time);__step(dt);const p=__position(),distance=Math.hypot(...p.map((v,i)=>v-prev[i]));max=Math.max(max,distance);const boundary=previousAction!==state?.action?.id;if(boundary)boundaryMax=Math.max(boundaryMax,distance);if(distance>1.2)failures.push({time,distance,action:state?.action,debug:handle.debugState()});prev=p;previousAction=state?.action?.id;}
   return {name,max,boundaryMax,events:[...events],failures:failures.slice(0,12),failureCount:failures.length};})()`);
  report.checks.push(result);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(result));
 }
 const fixtures=await js(`(()=>{const results=[];
  for(const eventId of ['ev_wagon_shelter','ev_wagon_label',code.m.mossStoryEvents.find(e=>e.anim==='sitDoor').id]){
   const state=code.m.createMossRuntime('door');state.seconds=100;state.node='s_wagon';state.action={id:1,kind:'wait',node:'s_wagon',route:['s_wagon'],startSeconds:99,endSeconds:100};
   make('moss',{moss:code.m.mossSceneSnapshot('qa',state,code.m.emptyMossMarks(),false),progressSeconds:100});__step(0);let prev=__position(),start=prev,max=0,mid;
   state.action={id:2,kind:'event',eventId,node:'s_wagon',route:['s_wagon'],startSeconds:100,endSeconds:110};handle.setMossState(code.m.mossSceneSnapshot('qa',state,code.m.emptyMossMarks(),false));
   for(let i=0;i<=200;i++){__now+=50;handle.setProgress(100+i*.05);__step(.05);const p=__position();max=Math.max(max,Math.hypot(...p.map((v,k)=>v-prev[k])));if(i===100)mid=p;prev=p;}
   results.push({eventId,max,endDistance:Math.hypot(...prev.map((v,k)=>v-start[k])),seatDistance:Math.hypot(...mid.map((v,k)=>v-start[k]))});
  }
  let state=code.n.createNurseryRuntime('rest',[]),marks=code.n.emptyNurseryMarks();state.node='H';state.seconds=3000;state.visitedLamps=[1,2,3,4,5];let r=code.n.advanceNurseryRuntime(state,3000,marks,[]);state=r.state;
  const snapshot=()=>({seed:state.seed,action:state.action,worldMarks:marks,coreTaken:false});make('nursery',{nursery:snapshot(),progressSeconds:3000});__step(0);let prev=__position(),max=0;
  for(let i=1;i<=1200;i++){const time=3000+i*.2;__now+=200;r=code.n.advanceNurseryRuntime(state,time,marks,[]);state=r.state;marks=r.marks;handle.setNurseryState(snapshot());handle.setProgress(time);__step(.2);const p=__position();max=Math.max(max,Math.hypot(...p.map((v,k)=>v-prev[k])));prev=p;}
  handle.setPaused(true);const before=__position();__now+=60000;__step(.2);results.push({eventId:'nursery-rest-checkpoints',max,pauseDistance:Math.hypot(...__position().map((v,k)=>v-before[k]))});return results;
 })()`);
 report.fixtures=fixtures;console.log(JSON.stringify(fixtures));fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify(fixtures,null,2));
 assert(report.checks.every(c=>c.failureCount===0&&c.boundaryMax<.45),'Movement exceeded a plausible 5-fps step; inspect report');
 assert(fixtures.slice(0,3).every(f=>f.max<.3&&f.endDistance<.01&&f.seatDistance>.1),'Cargo doorway must approach and leave its seat smoothly');
 assert(fixtures[3].max<.45&&fixtures[3].pauseDistance===0,'Rotating-seat checkpoints and pause must preserve position');assert.equal(report.errors.length,0);app.exit(0);
})().catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});
