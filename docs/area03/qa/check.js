// measure the designed road network: surface heights, hops, slopes, clearance. usage: node check.js [design.json] [out.json]
const { open } = require('./h.js'); const fs = require('fs'); const path = require('path');
const design = JSON.parse(fs.readFileSync(process.argv[2] || 'graph_design.json', 'utf8')); const outFile = process.argv[3] || 'measure.json';
(async () => {
  const { page, browser, errs } = await open();
  await page.addScriptTag({ path: path.resolve(__dirname, 'node_modules/three-mesh-bvh/build/index.umd.cjs') });
  await page.evaluate(require('./qa_lib.js')); await page.evaluate(require('./measure_lib.js'));
  const t0 = Date.now();
  const res = await page.evaluate((design) => {
    const A = window.__qa, Q = window.__lake.internals(), T = Q.T, W = Q.W;
    const STEP = 0.1;
    const hint = (id) => id === 'moon_crown' ? 1.9 : id.startsWith('k_') || id === 'b_far' ? 2.2 : id.startsWith('p_') && id !== 'p_lamp5' ? 0.9 : 0.6;
    const NODE = {}; design.nodes.forEach((n) => { NODE[n.id] = n; });
    const out = { nodes: {}, edges: [] };
    // reeds still standing
    const reeds = Q.REEDS.filter((r) => !r[2]);
    const reedDist = (u, v) => { let m = 9; for (const r of reeds) m = Math.min(m, Math.hypot(r[0] - u, r[1] - v)); return m; };
    const objInfo = (o) => o ? A.targets.indexOf(o) : -1;
    // nodes
    design.nodes.forEach((n) => {
      const y = A.surfY(n.u, n.v, hint(n.id)); const p = W(n.u, n.v, 0);
      const cb = y === null ? { c: NaN } : A.clearAt(p, y, A.BODY_H, 0.27), cr = y === null ? { c: NaN } : A.clearAt(p, y, A.BRIM_H, 0.36);
      const sp = y === null ? { c: NaN } : A.clearAt(p, y, A.BRIM_H.concat([0.5]), 0.45);   // spin needs the hat brim + extended arm
      out.nodes[n.id] = { y, body: cb.c, bodyObj: objInfo(cb.obj), brim: cr.c, brimObj: objInfo(cr.obj), spin: sp.c, head: y === null ? NaN : A.headroom(p, y), reed: reedDist(n.u, n.v) };
    });
    const nodeY = {}; Object.entries(out.nodes).forEach(([k, r]) => { nodeY[k] = r.y; });
    design.edges.forEach((E) => { out.edges.push(A.measureEdge(E, NODE, nodeY)); });
    return out;
  }, design);
  fs.writeFileSync(outFile, JSON.stringify(res));
  console.log('ms', Date.now() - t0, errs.filter((e) => !/ERR_FAILED/.test(e)).join('|'));
  const f2 = (x) => (x === null || x === undefined || isNaN(x) ? '  -  ' : (Math.abs(x) > 8 ? '  .  ' : x.toFixed(2)));
  Object.entries(res.nodes).forEach(([id, r]) => { const bad = r.y === null || r.body < 0.0 || r.brim < 0.0; if (bad || process.argv[4] === 'all') console.log((bad ? 'X ' : '  ') + id.padEnd(11), 'y', r.y && r.y.toFixed(3), 'body', f2(r.body), 'brim', f2(r.brim), 'spin', f2(r.spin), 'reed', f2(r.reed)); });
  res.edges.forEach((E) => { const bad = E.minBody < 0.005 || E.minBrim < 0.005 || E.minReed < 0.45 || E.maxSlope > (E.kind === 'rock' ? 0.85 : 0.7); const nGap = E.gaps.filter((g) => g[2] > 0.3).length;
    if (bad || process.argv[4] === 'all') console.log((bad ? 'X ' : '  ') + (E.a + '>' + E.b).padEnd(24), E.kind.padEnd(8), 'L', E.L.toFixed(2), 'body', f2(E.minBody), JSON.stringify(E.atBody), 'obj', E.objBody, 'brim', f2(E.minBrim), JSON.stringify(E.atBrim), 'obj', E.objBrim, 'reed', f2(E.minReed), 'slope', E.maxSlope.toFixed(2), JSON.stringify(E.atSlope), 'gaps', JSON.stringify(E.gaps.map((g) => g[2])), 'drops', JSON.stringify(E.drops.map((d) => d.slice(0, 2)))); });
  await browser.close();
})();
