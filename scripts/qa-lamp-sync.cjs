// Exercise the production scene with an isolated, controlled clock, including 1-fps rendering.
// No player save or production timer is edited. Only automatic RAF and intermediate drawing are disabled.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..'), out = path.join(root, 'previews/lamp-sync-qa')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'focusquest-lamp-qa-')))
const report = { checks: [], errors: [] }
;(async () => {
  await esbuild.build({ entryPoints: [path.join(root, 'src/renderer/src/cloudRuins/cloudRuinsScene.js')], bundle: true, format: 'esm', outfile: path.join(out, 'scene.mjs'),
    plugins: [{ name: 'controlled-clock', setup(build) {
      build.onLoad({ filter: /cloudRuinsScene\.js$/ }, args => ({ loader: 'js', contents: fs.readFileSync(args.path, 'utf8').replace(/\r\n/g, '\n')
        .replace('  const glassDeep = new T.Color();', '  window.__frame = frame;\n  const glassDeep = new T.Color();')
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
  for (const seed of [1, 17, 281]) {
    const result = await exec(`(() => {
      make(0,${seed}); const milestones=[], failures=[];
      for(let second=1; second<=3000; second++) {
        if ([600,1200,1800].includes(second)) handle.playSpecialFind(['rare_well_wick','rare_lake_lens','rare_astro_core'][second/600-1]);
        const s=step(second); const due=Math.floor(second/600);
        if(s.lampsLit!==due || s.lampLevels.some((v,i)=>v!==(i<due?1:0))) failures.push({second,s});
        if(second%600===0 || second===2820) milestones.push({second,node:s.node,state:s.state,act:s.act,lit:s.lampsLit,pending:s.pendingFinds});
      }
      return {failures:failures.slice(0,3),milestones};
    })()`)
    assert.deepEqual(result.failures, [], 'Scene lamps must equal HUD at every simulated second')
    assert.equal(result.milestones.find(m => m.second === 2400).node, 'c_lamp', 'Traveller must reach lamp four on time despite reward reveals and low fps')
    report.checks.push({ seed, ...result })
  }
  await exec('make(2399,1,{paused:true});step(2399,60000)')
  let state = await exec('handle.debugState()')
  assert.equal(state.lampsLit, 3)
  await exec('handle.setPaused(false);step(2400)')
  assert.equal((await exec('handle.debugState()')).lampsLit, 4)
  report.checks.push('Pause across wall-clock deadline does not light a lamp; effective-time resume does')
  await exec('make(1801);step(2820,419000);window.__draw=true;window.__frame()')
  state = await exec('handle.debugState()')
  assert.equal(state.lampsLit, 4); assert.deepEqual(state.lampLevels, [1,1,1,1,0])
  await new Promise(resolve => setTimeout(resolve, 1500))
  fs.writeFileSync(path.join(out, '47-minutes.png'), (await win.webContents.capturePage()).toPNG())
  await exec('step(3000,180000)'); state = await exec('handle.debugState()')
  assert.equal(state.lampsLit, 5); assert.deepEqual(state.lampLevels, [1,1,1,1,1])
  report.checks.push('Long rendering gap restores every due lamp, including fourth at 47 minutes and fifth at 50')
  assert.equal(report.errors.length, 0)
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report)); app.exit(0)
})().catch(error => { report.failure = error.stack; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report,null,2)); console.error(error); app.exit(1) })
