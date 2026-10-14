const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),qa=process.argv.includes('--qa'),out=path.join(root,'previews/area03-campfire-qa');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
process.env.FOCUSQUEST_QA_USER_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'fq-silhouette-trial-'));
const show=BrowserWindow.prototype.show;BrowserWindow.prototype.show=function(){};
let win;const report={checks:[],errors:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
const js=s=>win.webContents.executeJavaScript(s,true),scene=s=>js(`(()=>{const w=document.querySelector('.campfire-stage iframe')?.contentWindow;if(!w)return false;${s}})()`);
async function until(f){const end=Date.now()+30000;while(Date.now()<end){if(await f())return;await wait(100)}throw Error('Campfire timeout')}
async function shot(n){await win.webContents.capturePage();await wait(200);fs.writeFileSync(path.join(out,n+'.png'),(await win.webContents.capturePage()).toPNG())}
require(path.join(root,'out/main/index.js'));
(async()=>{
 await app.whenReady();await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');return !!win});win.webContents.setBackgroundThrottling(false);if(qa)win.webContents.setAudioMuted(true);
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 await until(()=>scene('return !!w.__campfire;').catch(()=>false));
 await until(()=>scene('return typeof w.__campfireOnSilhouette==="function"'));
 await js(`void(window.__trialBellCallback=document.querySelector('.campfire-stage iframe').contentWindow.__campfireOnSilhouette)`);
 if(qa)fs.mkdirSync(out,{recursive:true});
 await js(`(()=>{const f=document.querySelector('.campfire-stage iframe');f.srcdoc=f.srcdoc.replace('window.__campfire = {', 'window.__campfirePreviewReset=()=>{S.hover=null;S.hoverT=0;S.selected=null;resetHero(false);}; window.__campfire = {');${qa ? "f.srcdoc=f.srcdoc.replace('// mist: a sea below','window.__qaDest=DEST; window.__qaTime=()=>time; // mist: a sea below');" : ''}})()`);
 await until(()=>scene('return !!w.__campfirePreviewReset && !!w.__campfire;'));
 await wait(600);
 await scene('w.__campfireOnSilhouette=w.parent.__trialBellCallback;return true;');
 await scene('w.__trialSetDestinations=w.__campfireSetDestinations;w.__campfireSetDestinations=()=>{};w.__campfire.setDestinations=()=>{};');
 // Trial controls operate the actual compiled scene, without starting Focus or writing player data.
 await js(`(()=>{
  const w=document.querySelector('.campfire-stage iframe').contentWindow,a=w.__campfire;
  const style=document.createElement('style');style.textContent='.la-panel,.la-stage-ui,.sidebar{visibility:hidden!important;pointer-events:none!important}';document.head.append(style);
  const panel=document.createElement('div');Object.assign(panel.style,{position:'fixed',left:'20px',bottom:'20px',zIndex:10000,padding:'16px',background:'#171e23ee',color:'#e7e2d5',borderRadius:'16px',maxWidth:'680px',font:'14px sans-serif'});
  const label=document.createElement('p');label.textContent='營火剪影試玩 · 倒影湖畔／藏聲秋谷 · 獨立存檔';panel.append(label);
  const hint=document.createElement('p');hint.textContent='滑過下方路線看剪影；點擊出發只重播畫面。藏聲秋谷的遠鐘已接入。';panel.append(hint);
  const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;Object.assign(b.style,{margin:'4px',padding:'8px 12px',background:'#303b42',color:'#eee',border:'1px solid #63716e',borderRadius:'8px',cursor:'pointer'});b.onclick=action;panel.append(b);return b};
  let side='bridge';
  // Reset only the departure actor. Keep the world's mist phase continuous;
  // running seven seconds of all scene updates at once visibly stalled replay.
  const reset=()=>{w.__campfirePreviewReset();w.__hold=false};
  const maps=()=>{reset();w.__trialSetDestinations(side==='bridge'?{bridge:'area-03-reflection-lake',steps:'area-05-echo-quarry'}:{bridge:'area-05-echo-quarry',steps:'area-03-reflection-lake'});left.textContent=side==='bridge'?'左 · 倒影湖畔':'左 · 藏聲秋谷';right.textContent=side==='steps'?'右 · 倒影湖畔':'右 · 藏聲秋谷'};
  const left=button('左',()=>{reset();a.setSelected('bridge');a.depart()});const right=button('右',()=>{reset();a.setSelected('steps');a.depart()});
  for(const [b,k] of [[left,'bridge'],[right,'steps']]){b.onpointerenter=b.onfocus=()=>a.setHover(k);b.onpointerleave=b.onblur=()=>a.setHover(null)}
  button('交換左右',()=>{side=side==='bridge'?'steps':'bridge';maps()});button('回到營火',reset);
  panel.append(document.createElement('br'));for(let i=0;i<=5;i++)button('天色 '+i,()=>a.setStage(i,false));
  document.body.append(panel);maps();window.__silTrial={reset,maps};
 })()`);
 if(!qa){const primary=screen.getPrimaryDisplay(),display=screen.getAllDisplays().find(d=>d.id!==primary.id)||primary;win.setBounds({x:display.workArea.x+10,y:display.workArea.y+10,width:Math.min(1600,display.workArea.width-20),height:Math.min(950,display.workArea.height-20)});win.setTitle('Focus Quest · 營火剪影試玩（倒影湖畔／藏聲秋谷）');show.call(win);win.once('close',()=>app.exit(0));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'trial-ready.json'),JSON.stringify({title:win.getTitle(),visible:win.isVisible(),bounds:win.getBounds()},null,2));return}
 await scene('w.__hold=true;');
 if(process.argv.includes('--smoothness')){
  const result=await scene(`const a=w.__campfire;const materials=new Set();w.__qaDest.bridge.g.traverse(o=>{if(o.material)materials.add(o.material)});const versions=[...materials].map(m=>m.version);const timings=[];for(let cycle=0;cycle<3;cycle++){for(const hover of ['bridge',null]){a.setHover(hover);for(let i=0;i<60;i++){const start=performance.now();a.advance(1/30);timings.push(performance.now()-start)}}}return {materialVersionChanges:[...materials].reduce((sum,m,i)=>sum+m.version-versions[i],0),frames:timings.length,maxMs:Math.max(...timings),p95Ms:timings.sort((a,b)=>a-b)[Math.floor(timings.length*.95)]};`);
  const reset=await js(`(()=>{const w=document.querySelector('.campfire-stage iframe').contentWindow;const before=w.__qaTime(),start=performance.now();window.__silTrial.reset();w.__hold=true;return {cpuMs:performance.now()-start,worldTimeJump:w.__qaTime()-before}})()`);
  fs.writeFileSync(path.join(out,process.argv.includes('--before')?'smoothness-before.json':'smoothness-after.json'),JSON.stringify({result,reset},null,2));
  if(!process.argv.includes('--before')){assert.equal(result.materialVersionChanges,0);assert.equal(reset.worldTimeJump,0)}
  app.exit(0);return;
 }
 const state=way=>scene(`const v=w.__qaDest.${way}.g.children[0];const up=v.children[0],refl=v.children[1],water=v.children[2];let um,rm;up.traverse(o=>{if(o.isMesh&&!um)um=o});refl.traverse(o=>{if(o.isMesh&&!rm)rm=o});return {up:um.material.opacity,reflection:rm.material.opacity,upOrder:um.renderOrder,reflectionOrder:rm.renderOrder,waterOrder:water.renderOrder,water:water.material.color.getHexString(),scale:refl.scale.y};`);
 for(const way of ['bridge','steps']){
  await scene(`w.__campfire.setHover(null);w.__trialSetDestinations({${way}:'area-03-reflection-lake',${way==='bridge'?'steps':'bridge'}:'area-05-echo-quarry'});w.__campfire.advance(3);w.__campfire.setHover('${way}');w.__campfire.advance(.95);`);
  let s=await state(way);assert(s.reflection>s.up);assert.equal(s.scale,-1);assert.equal(s.reflectionOrder,1);assert.equal(s.waterOrder,2);assert.equal(s.upOrder,4);await shot(way+'-reflection-first');
  await scene('w.__campfire.advance(2);');s=await state(way);assert.equal(s.up,1);assert.equal(s.reflection,.75);await shot(way+'-full');
  await scene('w.__campfire.setHover(null);w.__campfire.advance(3);');s=await state(way);assert.equal(s.up,0);assert.equal(s.reflection,0);
  await scene(`w.__campfire.setHover('${way}');w.__campfire.advance(.8);w.__campfire.setHover(null);w.__campfire.advance(.2);w.__campfire.setHover('${way}');w.__campfire.advance(.1);w.__campfire.setHover(null);w.__campfire.advance(3);`);s=await state(way);assert.equal(s.up,0);assert.equal(s.reflection,0);
  await scene(`w.__campfire.setSelected('${way}');w.__campfire.depart();w.__campfire.advance(1);`);s=await state(way);assert(s.reflection>s.up);await shot(way+'-departure');
  await js('window.__silTrial.reset()');await scene('w.__hold=true;');
  await scene(`const d=w.__qaDest.${way}.g;w.__old=d.userData.sil;w.__calls=0;const u=w.__old.update;w.__old.update=(...a)=>{w.__calls++;u(...a)};w.__trialSetDestinations({bridge:'area-01-cloud-ruins',steps:'area-02-moss-station'});w.__campfire.advance(2);`);assert.equal(await scene('return w.__old.alive();'),false);assert.equal(await scene('return w.__calls;'),0);assert.equal(await scene(`return w.__qaDest.${way}.g.userData.sil;`),null);
  report.checks.push(way+': reflection first, mirrored geometry, render order, fade out/re-entry, departure and replacement');
 }
 await scene(`w.__trialSetDestinations({bridge:'area-03-reflection-lake',steps:'area-05-echo-quarry'});w.__campfire.setHover('bridge');`);
 const colors=[];for(let i=0;i<=5;i++){await scene(`w.__campfire.setStage(${i},false);w.__campfire.advance(3);`);colors.push((await state('bridge')).water);await shot('stage-'+i)}assert(new Set(colors).size>1);report.checks.push('Stages 0–5 water colour follows sky');
 assert.equal(report.errors.length,0,report.errors.join('\n'));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));app.exit(0);
})().catch(e=>{console.error(e);if(qa){fs.mkdirSync(out,{recursive:true});report.errors.push(e.stack);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2))}app.exit(1)});
