const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 600, height: 400 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(() => { window.__hold = 1; });
  p.on('crash', () => console.log('CRASH'));
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.min.js')) return r.fulfill({ path: 'node_modules/three/build/three.min.js', contentType: 'text/javascript' }); if (u.startsWith('file:')) return r.continue(); return r.abort(); });
  await p.goto('file://' + process.cwd() + '/glass-nursery-interior.html');
  await p.waitForFunction(() => window.__g7, null, { timeout: 60000 });
  await p.evaluate(() => { window.__hold = 1; });
  await p.addScriptTag({ path: 'node_modules/three-mesh-bvh/build/index.umd.cjs' });
  const res = await p.evaluate(() => {
    const B = window.MeshBVHLib; T.Mesh.prototype.raycast = B.acceleratedRaycast;
    const soft = new Set([M.leaf, M.leafLight, M.leafDark, M.palm, M2.monstera, M2.reed, M2.succ, M2.flowerA, M2.flowerB, M2.flowerC, M.moss]);
    const travSet = new Set(); trav.traverse((o) => travSet.add(o));
    const targets = []; scene.updateMatrixWorld(true);
    const box = new T.Box3();
    scene.traverse((o) => { if (!o.isMesh || travSet.has(o)) return; let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis) return; const m = o.material; if (!m || m.isShaderMaterial || m.isMeshBasicMaterial || m.isPointsMaterial) return; if (m.transparent && m.opacity < 0.6) return; let fernAnc = false; for (let q = o; q; q = q.parent) if (q.userData && q.userData.fern) fernAnc = true; if (fernAnc) return; box.setFromObject(o); const sz = box.getSize(new T.Vector3()); if (sz.y < 0.09) return; if (!o.geometry.boundsTree) o.geometry.boundsTree = new B.MeshBVH(o.geometry); m.side = T.DoubleSide; targets.push(o); });
    const rc = new T.Raycaster(); rc.firstHitOnly = true;
    const dirs = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; dirs.push(new T.Vector3(Math.cos(a), 0, Math.sin(a))); }
    function probe(pt) { const hits = []; [[0.35, 0.27], [0.6, 0.27], [0.85, 0.25], [1.12, 0.36]].forEach(([h, r]) => { dirs.forEach((d) => { rc.set(new T.Vector3(pt.x, pt.y + h, pt.z), d); rc.far = r; const x = rc.intersectObjects(targets, false)[0]; if (x) { const bb = new T.Box3().setFromObject(x.object); const c = bb.getCenter(new T.Vector3()); hits.push({ h, at: [+pt.x.toFixed(2), +pt.z.toFixed(2)], obj: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], sz: bb.getSize(new T.Vector3()).toArray().map((v) => +v.toFixed(2)) }); } }); }); return hits; }
    const out = {};
    function checkPath(name, pts) { const L = polyLen(pts); const bad = []; for (let d = 0; d <= L; d += 0.1) { const q = polyAt(pts, d).pos; const h = probe(q); if (h.length) bad.push(h[0]); } if (bad.length) { const uniq = {}; bad.forEach((x) => { const k = x.obj.join(','); (uniq[k] = uniq[k] || { obj: x.obj, sz: x.sz, at: [] }).at.push(x.at); }); out[name] = Object.values(uniq).map((u) => ({ obj: u.obj, sz: u.sz, n: u.at.length, first: u.at[0], last: u.at[u.at.length - 1] })); } }
    EDGES.forEach(([a, b2]) => checkPath(a + '-' + b2, edgePts(a, b2)));
    Object.keys(N).forEach((k) => { const h = probe(NP(k)); if (h.length) out['node ' + k] = h.slice(0, 3); });
    { const arc = []; for (let i = 0; i <= 30; i++) { const a = -0.1 - i / 30 * 2.2; arc.push(V3(MC.x + Math.cos(a) * 3.15, 0.12, MC.z + Math.sin(a) * 3.15)); } checkPath('machineWalk arc', arc); }
    checkPath('exit corridor', [NP('D'), ...CORR]); checkPath('exit cellar', [NP('X2'), ...CELL]); checkPath('board', [NP('H'), BOARD]);
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
