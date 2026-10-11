const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),esbuild=require('esbuild'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/nursery-clearance-qa');fs.mkdirSync(out,{recursive:true});app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'fq-nursery-clearance-')));
(async()=>{
 await esbuild.build({entryPoints:[path.join(root,'src/renderer/src/glassNursery/glassNurseryScene.js')],bundle:true,format:'esm',outfile:path.join(out,'scene.mjs')});
 fs.writeFileSync(path.join(out,'index.html'),`<style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="scene"></div><script type="module">import {createGlassNurseryScene} from './scene.mjs';window.handle=createGlassNurseryScene(document.querySelector('#scene'),{mode:'lobby',progressSeconds:3000,targetSeconds:3000,paused:true});window.THREE=handle.qa.T;</script>`);
 await app.whenReady();const win=new BrowserWindow({width:600,height:400,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true}});win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)console.error(m)});await win.loadFile(path.join(out,'index.html'));await new Promise(r=>setTimeout(r,12000));
 await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'previews/nursery-integration-qa/bvh/package/build/index.umd.cjs'),'utf8'));
 const original=fs.readFileSync(path.join(root,'docs/area07/clearance-qa.js'),'utf8');let body=original.split('const res = await p.evaluate(() => {')[1].split('\n  });')[0];
 // World-space bounding boxes reject distant meshes before the unchanged BVH rays.
 body=body.replace('const rc = new T.Raycaster();','const bounds=new Map(targets.map(o=>[o,new T.Box3().setFromObject(o)])); const rc = new T.Raycaster();');
 body=body.replace('dirs.forEach((d) => { rc.set', 'const near=targets.filter(o=>bounds.get(o).distanceToPoint(new T.Vector3(pt.x,pt.y+h,pt.z))<=r); dirs.forEach((d) => { rc.set');
 body=body.replace('rc.intersectObjects(targets, false)','rc.intersectObjects(near, false)');
 const result=await win.webContents.executeJavaScript(`(()=>{try{const {T,scene,N,EDGES,NP,route,edgePts,polyLen,polyAt,CORR,CELL,MC,BOARD,trav,M,M2}=handle.qa;const V3=(x,y,z)=>new T.Vector3(x,y,z);handle.qa.setSap(3);${body}}catch(e){return {error:e.stack}}})()`);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));assert.deepEqual(Object.keys(result).filter(k=>k!=='board'),[],'only authored platform step may intersect');app.exit(0);
})().catch(e=>{console.error(e);app.exit(1)});
