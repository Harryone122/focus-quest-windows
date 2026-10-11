const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/travel-loading-walk');
fs.mkdirSync(out,{recursive:true});
const drawing=fs.readFileSync(path.join(root,'src/renderer/src/loading/travelLoadingDrawing.ts'),'utf8').match(/travelLoadingDrawing = `([\s\S]*?)`/)[1];
const css=fs.readFileSync(path.join(root,'src/renderer/src/loading/travelLoading.css'),'utf8');
const html=`<!doctype html><html><head><style>${css}body{margin:0;background:#12212c}.travel-loading{right:70px;bottom:38px;width:180px;height:137px}</style></head><body><canvas id="bg" width="1024" height="768" style="position:fixed;inset:0"></canvas><script>const gl=document.getElementById("bg").getContext("webgl");function draw(){gl.clearColor(.07,.13,.17,1);gl.clear(gl.COLOR_BUFFER_BIT);requestAnimationFrame(draw)}draw()</script><div class="travel-loading">${drawing}</div></body></html>`;
fs.writeFileSync(path.join(out,'index.html'),html);
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:1024,height:768,frame:false,show:false,webPreferences:{offscreen:true,backgroundThrottling:false}});
 try{
  await win.loadFile(path.join(out,'index.html'));await new Promise(r=>setTimeout(r,350));const js=s=>win.webContents.executeJavaScript(s);
  const poses=[];
  for(let i=0;i<18;i++){
   await js(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${i*1200/18}})`);
   poses.push(await js(`getComputedStyle(document.querySelector('.travel-loading-leg-front')).getPropertyValue('d')`));
   await new Promise(r=>setTimeout(r,60));
   fs.writeFileSync(path.join(out,`frame-${String(i).padStart(2,'0')}.png`),(await win.webContents.capturePage({x:704,y:528,width:320,height:240})).toPNG());
  }
  assert(new Set(poses).size>10,'legs have an actual forward stride, not a rotating fixed outline');
  await win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await js(`Array.from(document.querySelector('.travel-loading').querySelectorAll('*')).every(e=>getComputedStyle(e).animationName==='none')`));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,distinctWalkingPoses:new Set(poses).size,reducedMotion:true},null,2));
  app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
