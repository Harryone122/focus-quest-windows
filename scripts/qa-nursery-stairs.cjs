// Hidden runtime inspection of the production nursery geometry and animation.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'previews/stair-fix-qa/runtime');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'fq-stairs-')));
const report={errors:[],checks:[]};let win;
const delay=ms=>new Promise(r=>setTimeout(r,ms)),js=s=>win.webContents.executeJavaScript(s,true);
async function shot(name){fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())}
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1400,height:900,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});
 win.webContents.setAudioMuted(true);win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)});
 await win.loadFile(path.join(root,'previews/nursery-audio-tester/dist/index.html'));
 let ready=false;for(let i=0;i<450;i++){ready=await js('!!window.__nurseryAudioTester?.state().ready');if(ready)break;await delay(100)}assert(ready);
 await js('__nurseryAudioTester.scene.setPaused(true)');
 await js('window.THREE=__nurseryAudioTester.scene.qa.T;void 0');
 await js(fs.readFileSync(path.join(root,'previews/nursery-integration-qa/bvh/package/build/index.umd.cjs'),'utf8')+';void 0');
 let body=fs.readFileSync(path.join(root,'docs/area07/clearance-qa.js'),'utf8').split('const res = await p.evaluate(() => {')[1].split('\n  });')[0];
 body=body.replace('const rc = new T.Raycaster();','const bounds=new Map(targets.map(o=>[o,new T.Box3().setFromObject(o)])); const rc = new T.Raycaster();');
 body=body.replace('dirs.forEach((d) => { rc.set','const near=targets.filter(o=>bounds.get(o).distanceToPoint(new T.Vector3(pt.x,pt.y+h,pt.z))<=r); dirs.forEach((d) => { rc.set');
 body=body.replace('rc.intersectObjects(targets, false)','rc.intersectObjects(near, false)');
 report.clearance=await js(`(()=>{const {T,scene,N,EDGES,NP,route,edgePts,polyLen,polyAt,CORR,CELL,MC,BOARD,trav,M,M2}=__nurseryAudioTester.scene.qa;const V3=(x,y,z)=>new T.Vector3(x,y,z);${body}})()`);
 report.geometry=await js(`(()=>{const q=__nurseryAudioTester.scene.qa,{T,scene,trav}=q;scene.updateMatrixWorld(true);const exclude=new Set();trav.traverse(o=>exclude.add(o));const meshes=[];scene.traverse(o=>{if(!o.isMesh||exclude.has(o))return;for(let p=o;p;p=p.parent)if(!p.visible)return;meshes.push(o)});const pts=q.edgePts('G2','CT'),ray=new T.Raycaster(),unsupported=[];for(let d=0;d<q.polyLen(pts);d+=.025){const p=q.polyAt(pts,d).pos;ray.set(p.clone().add(new T.Vector3(0,.3,0)),new T.Vector3(0,-1,0));ray.far=.65;const hit=ray.intersectObjects(meshes,false).filter(h=>!h.object.material.transparent&&Math.abs(h.point.y-p.y)<.3)[0];if(!hit)unsupported.push(p.toArray())}return {path:pts.map(p=>p.toArray()),unsupported}})()`);
  for(const id of ['lean']){
  const pose=await js(`(()=>{const scene=__nurseryAudioTester.scene,q=scene.qa;q.testPlay('${id}',true);for(let i=0;i<1000&&scene.debugState().localAction?.key!=='${id}';i++)q.seek(.05);if(scene.debugState().localAction?.key!=='${id}')throw Error('pose not reached');q.seek(.8);q.advance(.05);return scene.debugState().position})()`);
  report[id]=pose;
  await delay(200);await shot(id);report.checks.push(id+' actual walk-in and pose rendered');
 }
 const close=await js(`(()=>{const q=__nurseryAudioTester.scene.qa;q.camera.position.set(5,8,-3);q.camera.lookAt(-.6,2.5,-9.05);q.camera.zoom=3;q.camera.updateProjectionMatrix();q.renderer.render(q.scene,q.camera);return q.renderer.domElement.toDataURL('image/png').split(',')[1]})()`);
 fs.writeFileSync(path.join(out,'stairs-close.png'),Buffer.from(close,'base64'));
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 assert.deepEqual(Object.keys(report.clearance).filter(k=>k!=='board'),[],'route clearance');assert.equal(report.geometry.unsupported.length,0,'continuous tread support');assert.equal(report.errors.length,0);app.exit(0);
}).catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);app.exit(1)});
