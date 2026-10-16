const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({app,win,root})=>{
 const out=path.join(root,'previews/style-refine-qa');fs.mkdirSync(out,{recursive:true});const report={errors:[]};
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 const js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  const ready="[...document.querySelectorAll('iframe')].some(f=>f.contentWindow?.__campfire)";
  for(let i=0;i<300&&!await js(ready);i++)await wait(100);assert(await js(ready),'Campfire failed to initialize');
  await js("window.cf=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow?.__campfire).contentWindow;cf.__hold=true;cf.__campfire.advance(.5)");
  await wait(500);fs.writeFileSync(path.join(out,'campfire-rest.png'),(await win.webContents.capturePage()).toPNG());
  report.borrow=await js(`(()=>{const c=cf.__campfire;c.setSelected('bridge');c.depart();const samples=[];for(let i=0;i<24;i++){c.advance(.25);const s=c.debugState();samples.push({time:(i+1)*.25,gap:Math.hypot(...s.staff.hand.map((v,k)=>v-s.staff.grip[k])),mode:c.S.mode});}return samples})()`);
  // Once picked up, the original hand-to-staff constraint must remain intact.
  assert(report.borrow.filter(s=>s.time>=1&&s.time<=6).every(s=>s.gap<.08));
  fs.writeFileSync(path.join(out,'campfire-borrow.png'),(await win.webContents.capturePage()).toPNG());
  await js("window.focusQuest.updateSettings({coatColor:'ink'})");await wait(400);
  report.coat=await js("document.documentElement.dataset.coatColor");assert.equal(report.coat,'ink');
  await js('cf.__campfire.advance(.1)');fs.writeFileSync(path.join(out,'campfire-ink.png'),(await win.webContents.capturePage()).toPNG());
  assert.equal(report.errors.length,0);report.passed=true;fs.writeFileSync(path.join(out,'campfire-report.json'),JSON.stringify(report,null,2));app.exit(0);
 }catch(e){report.failure=e.stack;fs.writeFileSync(path.join(out,'campfire-report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)}
};
