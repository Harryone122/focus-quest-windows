// Hidden Electron QA using the production scene in its isolated audition page.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/nursery-fog-qa');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'fq-fog-qa-')));
const report={errors:[],runs:[]};let win;
const delay=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s,true);
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1400,height:900,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});
 win.webContents.setAudioMuted(true);win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 await win.loadFile(path.join(root,'previews/nursery-audio-tester/dist/index.html'));
 let ready=false;for(let i=0;i<450;i++){ready=await js('!!window.__nurseryAudioTester?.state().ready');if(ready)break;await delay(100)}assert(ready,'production scene ready');
 await js('__nurseryAudioTester.scene.setPaused(true)');
 for(const mood of ['night','dawn']){
  await js(`{const m=document.getElementById('mood');if(!Array.from(m.options).some(o=>o.value===${JSON.stringify(mood)}))m.add(new Option('晨光（QA）',${JSON.stringify(mood)}));m.value=${JSON.stringify(mood)};m.dispatchEvent(new Event('change'))}`);
  const result=await js(`(()=>{
   const scene=__nurseryAudioTester.scene,q=scene.qa;q.testMood(${JSON.stringify(mood)});q.seek(5);
   const room=[],machine=[];q.scene.traverse(s=>{if(s.isSprite&&s.renderOrder===3&&s.userData.base){(s.userData.s0===undefined?machine:room).push(s)}});
   const sample=s=>({p:s.position.clone(),o:s.material.opacity});
   let prev=new Map([...room,...machine].map(s=>[s,sample(s)]));
   const max={machine:0,room:0},wraps={machine:0,room:0},wrapOpacity={machine:0,room:0};
   for(let frame=0;frame<600;frame++){
    q.seek(.05);
    for(const [kind,list]of Object.entries({machine,room}))for(const s of list){const last=prev.get(s),now=sample(s),d=now.p.distanceTo(last.p);max[kind]=Math.max(max[kind],d*now.o);if(d>1){wraps[kind]++;wrapOpacity[kind]=Math.max(wrapOpacity[kind],last.o,now.o)}prev.set(s,now)}
   }
   // Force independent x/z boundary crossings while the renderer is paused.
   const edges=[];for(const axis of ['x','z']){const s=room[0];s.userData.base[axis]=12.49999;q.seek(.05);const atWrap=s.material.opacity;q.seek(.05);const after=s.material.opacity;q.seek(4);edges.push({axis,atWrap,after,recovered:s.material.opacity})}
   q.advance(.05);
   return {mood:${JSON.stringify(mood)},seconds:30,fps:20,counts:{machine:machine.length,room:room.length},max,wraps,wrapOpacity,edges};
  })()`);
  assert.equal(result.counts.machine,6);assert.equal(result.counts.room,50);
  assert(result.wraps.machine>0&&result.wraps.room>0,'both fog cycles exercised');
  assert(result.max.machine<.03,JSON.stringify(result));assert(result.max.room<.02,JSON.stringify(result));
  for(const edge of result.edges){assert.equal(edge.atWrap,0);assert(edge.after<.001);assert(edge.recovered>0)}
  report.runs.push(result);await delay(400);fs.writeFileSync(path.join(out,mood+'.png'),(await win.webContents.capturePage()).toPNG());
 }
 const frozen=await js(`(()=>{const a=[];__nurseryAudioTester.scene.qa.scene.traverse(s=>{if(s.isSprite&&s.renderOrder===3&&s.userData.base)a.push([s.position.toArray(),s.material.opacity])});return a})()`);
 await delay(400);assert.deepEqual(await js(`(()=>{const a=[];__nurseryAudioTester.scene.qa.scene.traverse(s=>{if(s.isSprite&&s.renderOrder===3&&s.userData.base)a.push([s.position.toArray(),s.material.opacity])});return a})()`),frozen);
 assert.equal(report.errors.length,0);report.paused=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0);
}).catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});
