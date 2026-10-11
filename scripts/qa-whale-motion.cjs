// Real scene, controlled 30-fps clock. Validates a stable whale pass and frozen pause without changing a save.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/cloud-whale-qa')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-whale-qa-')))
;(async () => {
  await esbuild.build({ entryPoints: [path.join(root, 'src/renderer/src/cloudRuins/cloudRuinsScene.js')], bundle: true, format: 'esm', outfile: path.join(out, 'scene.mjs'),
    plugins: [{ name: 'controlled-frame', setup(build) {
      build.onLoad({ filter: /cloudRuinsScene\.js$/ }, args => ({ loader: 'js', contents: fs.readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n')
        .replace('  return {\n    setPaused(paused)', '  window.__frame=frame;window.__whale=()=>({u:whale.u,opacity:whale.vis,visible:whale.g.visible,x:whale.g.position.x,z:whale.g.position.z});\n  return {\n    setPaused(paused)')
        .replace('      glass.render(scene, camera, dt, glassDeep, [cur.gCap, cur.gCard, cur.gTint], frozen);', '      if(window.__draw) glass.render(scene, camera, dt, glassDeep, [cur.gCap, cur.gCard, cur.gTint], frozen);') }))
    }}] })
  fs.writeFileSync(path.join(out,'index.html'), `<!doctype html><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none;opacity:0}</style><div id="scene"></div><script type="module">
    window.__now=10000;window.__draw=false;performance.now=()=>window.__now;window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};window.setInterval=()=>0;
    const {createCloudRuinsScene}=await import('./scene.mjs');
    window.handle=createCloudRuinsScene(document.querySelector('#scene'),{progressSeconds:274.6,targetSeconds:3000,seed:28,whaleSeed:28,worldMarks:['tree_traces_seen']});window.__frame();window.ready=true;
    window.step=(n)=>{window.__now+=n*1000;handle.setProgress(274.6+(window.__now-10000)/1000);window.__frame();return window.__whale()};
  </script>`)
  await app.whenReady()
  const win = new BrowserWindow({width:1280,height:800,show:true,webPreferences:{contextIsolation:true}})
  const errors=[]
  win.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message)})
  await win.loadFile(path.join(out,'index.html'))
  const js=code=>win.webContents.executeJavaScript(code,true)
  for(let i=0;i<50&&!await js('window.ready===true');i++)await new Promise(r=>setTimeout(r,100))
  const report={samples:[],errors}
  let prev=null,maxJump=0
  for(let i=0;i<2100;i++){
    const state=await js('step(1/30)')
    if(state.opacity>0.1&&prev&&prev.opacity>0.1)maxJump=Math.max(maxJump,Math.abs(state.u-prev.u))
    if(i===30||i===600||i===1200||i===1700)report.samples.push({second:i/30,...state})
    if(i===1200){await js('window.__draw=true;window.__frame()');await new Promise(r=>setTimeout(r,3000));await js('window.__frame()');await new Promise(r=>setTimeout(r,1500));fs.writeFileSync(path.join(out,'midpass.png'),(await win.webContents.capturePage()).toPNG());await js('window.__draw=false')}
    prev=state
  }
  report.maxFrameJump=maxJump
  assert(maxJump<0.055,'Whale must not jump more than one 30-fps step at nominal speed')
  assert(report.samples.some(s=>s.opacity>0.5),'Whale must cross the map')
  await js('handle.setPaused(true)');const before=await js('window.__whale()')
  await js('window.__now+=10000;window.__frame()');const after=await js('window.__whale()')
  assert.deepEqual(after,before,'Pause freezes whale movement and opacity')
  report.pauseFrozen=true
  assert.equal(errors.length,0)
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(0)
})().catch(e=>{console.error(e);app.exit(1)})

