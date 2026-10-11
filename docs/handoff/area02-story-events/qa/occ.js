// usage: node occ.js <outfile> [u0 u1]  — occupancy map around the walk network (BVH raycasts, QA only)
const { chromium } = require('playwright-core'); const path = require('path'); const fs = require('fs');
(async () => {
  const out = process.argv[2], u0 = Number(process.argv[3] || -22), u1 = Number(process.argv[4] || 18);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'moss-station.local.html') + '?qa=1');
  await page.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  await page.addScriptTag({ path: path.resolve(__dirname, '../node_modules/three-mesh-bvh/build/index.umd.cjs') });
  const t0 = Date.now();
  const res = await page.evaluate(([u0, u1]) => {
    const Q = window.__moss.qa(); const { scene, trav, T, W, toUV, travelY, polyD, EDGES, NODE, IDS, FERN_MATS, M, RIM, BROOK } = Q;
    const B = window.MeshBVHLib; T.Mesh.prototype.raycast = B.acceleratedRaycast;
    const travSet = new Set(); trav.traverse((o) => travSet.add(o));
    const soft = (o) => o.isInstancedMesh || FERN_MATS.indexOf(o.material) >= 0 || o.material === M.fern || o.material === M.fern2;
    const targets = []; scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || travSet.has(o) || o.userData.terrain) return; const m = o.material; if (!m || m.isShaderMaterial || m === M.water || (m.transparent && m.opacity < 0.35)) return; let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis || soft(o)) return; if (!o.geometry.boundsTree) o.geometry.boundsTree = new B.MeshBVH(o.geometry); m.side = T.DoubleSide; targets.push(o); });
    const polys = EDGES.map((E) => [[NODE[E.a].u, NODE[E.a].v]].concat((E.via || []).map((x) => [x[0], x[1]])).concat([[NODE[E.b].u, NODE[E.b].v]]));
    const rc = new T.Raycaster(); rc.firstHitOnly = true; const H = [0.3, 0.55, 0.8, 1.05, 1.2]; const cells = []; const step = 0.1;
    const du = W(step, 0, 0), dv = W(0, step, 0); const ldu = du.length(), ldv = dv.length(); du.normalize(); dv.normalize(); const down = new T.Vector3(0, -1, 0);
    for (let u = u0; u <= u1 + 1e-6; u += step) for (let v = -12; v <= 16; v += step) {
      if (!polys.some((P) => polyD(u, v, P) < 1.5) && !IDS.some((id) => Math.hypot(NODE[id].u - u, NODE[id].v - v) < 1.5)) continue;
      const g = W(u, v, 0); const gy = travelY(g); const occ = [];
      H.forEach((h) => { let hit = false; for (const [d, L] of [[du, ldu], [dv, ldv]]) { rc.set(new T.Vector3(g.x, gy + h, g.z), d); rc.far = L; if (rc.intersectObjects(targets, false).length) { hit = true; break; } } if (hit) occ.push(h); });
      rc.set(new T.Vector3(g.x, gy + 1.45, g.z), down); rc.far = 1.33; const hd = rc.intersectObjects(targets, false); const top = hd.length ? +(gy + 1.45 - hd[0].distance - gy).toFixed(2) : null;
      cells.push([+u.toFixed(2), +v.toFixed(2), +gy.toFixed(2), RIM(u, v) < 0.93 ? 1 : 0, +polyD(u, v, BROOK).toFixed(2), occ, top]);
    }
    return cells;
  }, [u0, u1]);
  fs.writeFileSync(out, JSON.stringify(res)); console.log('cells', res.length, 'ms', Date.now() - t0);
  await browser.close();
})();
