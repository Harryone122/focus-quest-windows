// Verify the traveller stands on rendered entrance stonework, with an isolated scene and clock.
// No player save or production timer is edited. Only automatic RAF and intermediate drawing are disabled.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/entry-spawn-qa')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-lamp-qa-')))
const report = { checks: [], errors: [] }
;(async () => {
  await esbuild.build({ entryPoints: [path.join(root, 'src/renderer/src/cloudRuins/cloudRuinsScene.js')], bundle: true, format: 'esm', outfile: path.join(out, 'scene.mjs'),
    plugins: [{ name: 'controlled-clock', setup(build) {
      build.onLoad({ filter: /cloudRuinsScene\.js$/ }, args => ({ loader: 'js', contents: fs.readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n')
        .replace('  return {\n    setPaused(paused)', '  window.__frame = frame;\n  window.__footing = () => { const p = trav.position; const stone = scene.children.find(m => m.geometry === flagGeo && Math.hypot(m.position.x-p.x,m.position.z-p.z)<0.001); return {position:p.toArray(),stone:stone ? stone.position.toArray():null}; };\n  return {\n    setPaused(paused)')
        .replace('      glass.render(scene, camera, dt, glassDeep, [cur.gCap, cur.gCard, cur.gTint], frozen);', '      if (window.__draw) glass.render(scene, camera, dt, glassDeep, [cur.gCap, cur.gCard, cur.gTint], frozen);') }))
    }}] })
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}.cloud-ruins-cover{position:absolute;inset:0;pointer-events:none;opacity:0}</style><div id="scene"></div><script type="module">
    window.__now=10000;window.__draw=false;performance.now=()=>window.__now;window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{};window.setInterval=()=>0;
    const {createCloudRuinsScene}=await import('./scene.mjs');
    window.make=(progress=0,seed=1,extra={})=>{window.handle?.destroy();document.querySelector('#scene').replaceChildren();window.handle=createCloudRuinsScene(document.querySelector('#scene'),{progressSeconds:progress,targetSeconds:3000,seed,worldMarks:['tree_traces_seen'],...extra});window.__frame()};
    window.step=(progress,delta=1000)=>{window.__now+=delta;handle.setProgress(progress);window.__frame();return handle.debugState()};
    window.ready=true;
  </script>`)
  await app.whenReady()
  const win = new BrowserWindow({ width: 1280, height: 800, show: true, webPreferences: { contextIsolation: true } })
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) report.errors.push(message) })
  await win.loadFile(path.join(out, 'index.html'))
  const exec = js => win.webContents.executeJavaScript(js, true)
  for (let n = 0; n < 50 && !await exec('window.ready === true'); n++) await new Promise(r => setTimeout(r, 100))
  for (const [name,progress,extra] of [['first-frame',0,{paused:true}],['reopen-15s',15,{paused:true}],['reopen-21s',21,{paused:true}],['lobby',0,{mode:'lobby'}]]) {
    await exec(`make(${progress},1,${JSON.stringify(extra)});window.__draw=true;window.__frame()`)
    const state=await exec('handle.debugState()'), footing=await exec('window.__footing()')
    assert.equal(state.node,'a_gate');assert.ok(footing.stone,'Traveller must stand over an actual rendered flagstone')
    assert.ok(Math.abs(footing.position[1]-footing.stone[1])<0.1,'Feet must be at stone height')
    await new Promise(r=>setTimeout(r,1500))
    fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())
    report.checks.push({name,node:state.node,footing})
  }
  await exec('make(0);window.__draw=false;for(let s=1;s<=30;s++)step(s);window.__draw=true;window.__frame()')
  await new Promise(r=>setTimeout(r,1500))
  fs.writeFileSync(path.join(out,'after-30s.png'),(await win.webContents.capturePage()).toPNG())
  report.checks.push({name:'after-30s',state:await exec('handle.debugState()')})
  assert.equal(report.errors.length,0)
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(0)
})().catch(error=>{report.failure=error.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(error);app.exit(1)})
