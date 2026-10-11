// Targeted regression for tester controls; uses the same isolated Electron entry.
process.env.FOCUSQUEST_AREA05_QA='1';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const entry=require.resolve('./qa-echo-quarry.cjs');
require.cache[entry]={id:entry,filename:entry,loaded:true,exports:async({app,win,root})=>{
 const js=code=>win.webContents.executeJavaScript(code,true),out=path.join(root,'previews/area05-trial/qa/controls-report.json');
 try{
  for(let i=0;i<600;i++){if(await js('typeof echoTrialScene!=="undefined"'))break;await new Promise(r=>setTimeout(r,50));}
  assert(await js('typeof echoTrialScene!=="undefined"'),'trial ready');
  for(const kind of ['core','second','whistle']){await js(`echoTrialScene.event('${kind}')`);assert.equal(await js('echoTrialScene.complete()'),false);await js('echoTrialScene.reset()');assert.equal(await js('echoTrialScene.complete()'),true);}
  await js('echoTrialScene.reset();echoTrialScene.setTime(3000);echoTrialScene.speed(20);echoTrialScene.go(5)');let arrived=false;
  for(let i=0;i<150;i++){await js('echoTrialScene.advance(.25)');const s=await js('echoTrialScene.state()');if(s.spot===5&&s.mode==='act'){arrived=true;break;}}
  assert(arrived,'arrive at bell stage: '+JSON.stringify(await js('echoTrialScene.state()')));assert.equal(await js('echoTrialScene.complete()'),true);
  for(let i=0;i<140;i++){await js('echoTrialScene.advance(.5)');const s=await js('echoTrialScene.state()');if(s.mode==='rest'){assert.equal(s.spot,4);break;}if(i===139)throw Error('rest route did not complete');}
  fs.writeFileSync(out,JSON.stringify({passed:true,checks:['completion cannot interrupt a cave/whistle event','reset cancels pending whistle state','rest walk completes from the bell stage using its departure waypoints']},null,2));app.exit(0);
 }catch(e){fs.writeFileSync(out,JSON.stringify({passed:false,error:e.stack},null,2));console.error(e);app.exit(1);}
}};
require('./try-echo-quarry.cjs');
