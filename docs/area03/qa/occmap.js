// top-down occupancy map: floor height + body clearance per cell (QA only)
const { open } = require('./h.js'); const fs = require('fs'); const path = require('path');
const [u0, u1, v0, v1, step, out] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5]), Number(process.argv[6] || 0.15), process.argv[7] || 'occ.json'];
(async () => {
  const { page, browser, errs } = await open();
  await page.addScriptTag({ path: path.resolve(__dirname, 'node_modules/three-mesh-bvh/build/index.umd.cjs') });
  await page.evaluate(require('./qa_lib.js'));
  const t0 = Date.now();
  const cells = await page.evaluate(([u0, u1, v0, v1, step]) => {
    const A = window.__qa, Q = window.__lake.internals(); const res = [];
    for (let u = u0; u <= u1 + 1e-9; u += step) for (let v = v0; v <= v1 + 1e-9; v += step) {
      const yf = (u > -0.9 && u < 4.9 && v > 8.2 && v < 13.9) ? 0.9 : (u > 7 && u < 13.6 && v > -0.6 && v < 6) ? 2.0 : 0.75; const y = A.surfY(u, v, yf);
      if (y === null || y < -0.2) { res.push([+u.toFixed(2), +v.toFixed(2), null, null, null]); continue; }
      const p = Q.W(u, v, 0); const cb = A.clearAt(p, y, A.BODY_H, 0.27); const cr = A.clearAt(p, y, A.BRIM_H, 0.36);
      res.push([+u.toFixed(2), +v.toFixed(2), +y.toFixed(3), +cb.c.toFixed(2), +cr.c.toFixed(2), cb.obj ? A.targets.indexOf(cb.obj) : -1, cr.obj ? A.targets.indexOf(cr.obj) : -1]);
    }
    return res;
  }, [u0, u1, v0, v1, step]);
  const info = await page.evaluate(() => window.__qa.targets.map((o, i) => { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); const Q = window.__lake.internals(); const a = Q.toUV(b.min.x, b.min.z), c = Q.toUV(b.max.x, b.max.z), d = Q.toUV(b.min.x, b.max.z), e = Q.toUV(b.max.x, b.min.z); const us = [a[0], c[0], d[0], e[0]], vs = [a[1], c[1], d[1], e[1]]; return [i, '0x' + o.material.color.getHexString(), o.geometry.attributes.position.count / 3 | 0, [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)].map((x) => +x.toFixed(1)), [+b.min.y.toFixed(2), +b.max.y.toFixed(2)], o.parent && o.parent.name || '']; }));
  fs.writeFileSync(out + '.targets.json', JSON.stringify(info));
  fs.writeFileSync(out, JSON.stringify({ u0, u1, v0, v1, step, cells })); console.log('cells', cells.length, 'ms', Date.now() - t0, errs.filter((e) => !/ERR_FAILED/.test(e)).join('|'));
  await browser.close();
})();
