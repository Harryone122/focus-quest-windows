// Visual smoke test of the shipping scene with its real frame loop and seeded whale window.
const {app,BrowserWindow}=require('electron')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),esbuild=require('esbuild')
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/cloud-whale-qa')
fs.mkdirSync(out,{recursive:true});app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'focusquest-whale-live-')))
;(async()=>{
 await esbuild.build({entryPoints:[path.join(root,'src/renderer/src/cloudRuins/cloudRuinsScene.js')],bundle:true,format:'esm',outfile:path.join(out,'live-scene.mjs')})
 fs.writeFileSync(path.join(out,'live.html'),`<!doctype html><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none}</style><div id="scene"></div><script type="module">const{createCloudRuinsScene}=await import('./live-scene.mjs');window.handle=createCloudRuinsScene(document.querySelector('#scene'),{progressSeconds:314.5,targetSeconds:3000,whaleSeed:28,seed:28,worldMarks:['tree_traces_seen']});let t=314.5;setInterval(()=>handle.setProgress(++t),1000);window.ready=true;</script>`)
 await app.whenReady();const win=new BrowserWindow({width:1280,height:800,show:true,webPreferences:{contextIsolation:true}})
 const errors=[];win.webContents.on('console-message',(_e,level,message)=>{if(level>=2&&!message.includes('Electron Security Warning'))errors.push(message)})
 await win.loadFile(path.join(out,'live.html'));const js=x=>win.webContents.executeJavaScript(x,true)
 for(let i=0;i<50&&!await js('window.ready===true');i++)await new Promise(r=>setTimeout(r,100))
 await new Promise(r=>setTimeout(r,3500));const png=(await win.webContents.capturePage()).toPNG();fs.writeFileSync(path.join(out,'app-scene-midpass.png'),png)
 const report={pngBytes:png.length,errors};console.log(JSON.stringify(report));assert(png.length>50000);assert.equal(errors.length,0)
 fs.writeFileSync(path.join(out,'live-report.json'),JSON.stringify(report,null,2));app.exit(0)
})().catch(e=>{console.error(e);app.exit(1)})

