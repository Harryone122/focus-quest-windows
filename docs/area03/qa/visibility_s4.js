// SPEC 10.2: is the traveller hidden by scene objects at a standing spot, seen from the default camera?  usage: node visibility.js [out.json]
const { open } = require('./h.js'); const fs = require('fs'); const path = require('path');
(async () => {
  const out = { camera: 'default 31deg, orthographic', rule: 'body >= 70% visible; head and hat fully visible (reeds, grass, flame glow do not count)', sizes: {} };
  for (const [w, h] of [[1600, 900], [1280, 800]]) {
    const { page, browser, errs } = await open({ w, h });
    await page.addScriptTag({ path: path.resolve(__dirname, 'node_modules/three-mesh-bvh/build/index.umd.cjs') });
    await page.evaluate(require('./qa_lib.js'));
    const res = await page.evaluate(() => {
      const L = window.__lake, I = L.internals(), T = I.T, A = window.__qa;
      L.setTime('day'); L.setTide(0); L.setWet(0); L.focus(); L.advance(0.2);
      // targets without the traveller itself
      const trav = I.trav; const own = (o) => { for (let q = o; q; q = q.parent) if (q === trav) return true; return false; };
      const targets = A.targets.filter((o) => !own(o));
      const rc = new T.Raycaster(); rc.firstHitOnly = true;
      const camDir = new T.Vector3(); I.scene.updateMatrixWorld(true); L.camera.getWorldDirection(camDir); const toCam = camDir.clone().negate();
      const lampNodes = ['r_lamp1', 'c_lamp2', 'n_lamp3', 'k_lamp4', 'p_lamp5'];
      const list = []; const seen = new Set();
      lampNodes.forEach((n, i) => list.push({ id: n, kind: 'lamp ' + (i + 1), node: n, anim: 'light' }));
      I.AREA.events.forEach((e) => { const k = e.spot + '|' + e.anim; if (seen.has(k) && !e.rare) return; seen.add(k); list.push({ id: e.id, kind: e.rare ? 'rare' : 'event', node: e.spot, anim: e.rare && e.tier === 'core' ? 'crouch' : e.anim }); });
      I.AREA.restActivities.forEach((r) => { if (r.id === 'rest_cup_first' || r.id === 'rest_notes' || r.id === 'rest_tea') list.push({ id: r.id, kind: 'rest', node: r.node, anim: r.anim === 'sequence' ? 'sitGaze' : r.anim }); });
      list.push({ id: 'rest_floor_sit', kind: 'rest', node: 'p_seat', anim: 'sit' });
      const rows = []; const nameOf = (o, pt) => { const q = I.toUV(pt.x, pt.z); return 'mesh hit at uv(' + q[0].toFixed(1) + ',' + q[1].toFixed(1) + ') h' + pt.y.toFixed(2); }; const nameOfOld = (o) => { const c = o.material && o.material.color ? '#' + o.material.color.getHexString() : '?'; const b = new T.Box3().setFromObject(o); const cc = b.getCenter(new T.Vector3()); const uv = I.toUV(cc); return (o.name || 'mesh') + ' ' + c + ' near uv(' + uv[0].toFixed(1) + ',' + uv[1].toFixed(1) + ')'; };
      for (const it of list) {
        L.goto(it.node); L.hold(true); L.pose(it.anim === 'light' ? 'light' : it.anim, 0.5); L.advance(2.5); L.pose(it.anim === 'light' ? 'light' : it.anim, 0.5);
        trav.updateWorldMatrix(true, true);
        const foot = trav.position.y; const pts = [];
        trav.traverse((o) => { if (!o.isMesh || o.material.blending === T.AdditiveBlending || (o.material.transparent && o.material.opacity < 0.5) || o.isSprite) return; const pa = o.geometry.attributes.position; const step = Math.max(1, Math.floor(pa.count / 40)); for (let k = 0; k < pa.count; k += step) { const p = new T.Vector3().fromBufferAttribute(pa, k).applyMatrix4(o.matrixWorld); pts.push(p); } });
        let nb = 0, ob = 0, nh = 0, oh = 0; const who = {};
        for (const p of pts) {
          const isHead = p.y - foot > 1.0; rc.set(p.clone().addScaledVector(toCam, 0.04), toCam); rc.far = 60; const r = rc.intersectObjects(targets, false);
          const hit = r.length ? r[0] : null; if (isHead) { nh++; if (hit) { oh++; who[nameOf(hit.object, hit.point)] = (who[nameOf(hit.object, hit.point)] || 0) + 1; } } else { nb++; if (hit) { ob++; const k = nameOf(hit.object, hit.point); who[k] = (who[k] || 0) + 1; } }
        }
        rows.push({ id: it.id, kind: it.kind, pose: it.anim, uv: [+I.TR.u.toFixed(2), +I.TR.v.toFixed(2)], bodyVisible: +(1 - ob / Math.max(1, nb)).toFixed(3), headHatVisible: +(1 - oh / Math.max(1, nh)).toFixed(3), samples: [nb, nh], blockedBy: who });
      }
      return rows;
    });
    out.sizes[w + 'x' + h] = res.map((r) => Object.assign(r, { pass: r.bodyVisible >= 0.7 && r.headHatVisible >= 0.95 }));
    console.log(w + 'x' + h, 'errs', errs.filter((e) => !/ERR_FAILED/.test(e)).join('|'));
    await browser.close();
  }
  fs.writeFileSync(process.argv[2] || 'visibility.json', JSON.stringify(out, null, 1));
  for (const [k, rows] of Object.entries(out.sizes)) { console.log('==', k); rows.forEach((r) => console.log(r.pass ? ' ok ' : 'FAIL', r.id.padEnd(12), r.kind.padEnd(7), 'body', r.bodyVisible, 'head', r.headHatVisible, JSON.stringify(r.blockedBy))); }
})();
