// Inspect the production Area 01 route curves against its solid prop footprints.
// Runs in an isolated Electron scene; never reads or changes the player's save.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const esbuild = require('esbuild')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'previews', 'cloud-clearance-qa')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'focusquest-clearance-')))

;(async () => {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/renderer/src/cloudRuins/cloudRuinsScene.js')],
    bundle: true, format: 'esm', outfile: path.join(out, 'scene.mjs'),
    plugins: [{ name: 'navigation-audit', setup(build) {
      build.onLoad({ filter: /cloudRuinsScene\.js$/ }, args => ({ loader: 'js', contents: fs.readFileSync(args.path, 'utf8').replace(
        '  // ---------- traveller ----------',
        `  window.__navigationAudit = { blockers: blockers.map((b, index) => ({ ...b, index })), edges: EDGES.map((e) => ({ a: e.a, b: e.b, kind: e.kind, points: Array.from({ length: 101 }, (_, i) => { const p = e.fwd.getPointAt(i / 100); return [p.x, p.y, p.z]; }) })) };
  // ---------- traveller ----------`
      ) }))
    } }]
  })
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><style>html,body,#scene{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="scene"></div><script type="module">const {createCloudRuinsScene}=await import('./scene.mjs');window.sceneHandle=createCloudRuinsScene(document.querySelector('#scene'),{mode:'lobby',progressSeconds:0,targetSeconds:3000,worldMarks:['tree_traces_seen']});window.ready=true</script>`)
  await app.whenReady()
  const win = new BrowserWindow({ width: 1200, height: 800, show: false })
  await win.loadFile(path.join(out, 'index.html'))
  const js = source => win.webContents.executeJavaScript(source, true)
  for (let i = 0; i < 80 && !await js('window.ready===true'); i++) await new Promise(resolve => setTimeout(resolve, 100))
  const nav = await js('window.__navigationAudit')
  if (!nav) throw new Error('Navigation audit did not initialize')
  const hazards = []
  for (const edge of nav.edges.filter(item => item.kind === 'path')) {
    for (const b of nav.blockers.filter(item => !['walkable-platform', 'water-outline'].includes(item.kind))) {
      let nearest = { gap: Infinity, u: 0 }
      edge.points.forEach((p, index) => { const gap = Math.hypot(p[0] - b.x, p[2] - b.z) - (b.collisionR ?? b.r) - 0.2; if (gap < nearest.gap) nearest = { gap, u: index / 100, point: p } })
      if (nearest.gap < 0.2) hazards.push({ edge: `${edge.a}->${edge.b}`, blocker: b.index, center: [b.x, b.z], radius: b.r, gap: +nearest.gap.toFixed(3), u: +nearest.u.toFixed(2), point: nearest.point.map(v => +v.toFixed(2)) })
    }
  }
  hazards.sort((a, b) => a.gap - b.gap)
  const violations = hazards.filter(item => item.gap < -0.1 && item.u > 0.02 && item.u < 0.98)
  const report = { pathEdges: nav.edges.filter(edge => edge.kind === 'path').length, blockers: nav.blockers.length, violations, nearMisses: hazards }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`Cloud Ruins clearance: ${report.pathEdges} paths, ${report.blockers} props, ${violations.length} intersections, ${hazards.length} near misses`)
  assert.equal(violations.length, 0, JSON.stringify(violations))
  app.exit(0)
})().catch(error => { console.error(error); app.exit(1) })
