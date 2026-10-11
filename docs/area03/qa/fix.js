// local via optimiser: node fix.js design.json out.json edgeKey [edgeKey...]   (edgeKey = a>b)
const { open } = require('./h.js'); const fs = require('fs'); const path = require('path');
const design = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const outFile = process.argv[3]; const keys = process.argv.slice(4);
(async () => {
  const { page, browser } = await open();
  await page.addScriptTag({ path: path.resolve(__dirname, 'node_modules/three-mesh-bvh/build/index.umd.cjs') });
  await page.evaluate(require('./qa_lib.js')); await page.evaluate(require('./measure_lib.js'));
  const res = await page.evaluate(([design, keys]) => {
    const A = window.__qa; const NODE = {}; design.nodes.forEach((n) => { NODE[n.id] = n; });
    const hint = (id) => id.startsWith('k_') || id === 'b_far' ? 2.2 : id.startsWith('p_') && id !== 'p_lamp5' ? 0.9 : 0.6; const Q = window.__lake.internals();
    const nodeY = {}; design.nodes.forEach((n) => { nodeY[n.id] = A.surfY(n.u, n.v, hint(n.id)); });
    const slopeMax = (k) => k === 'rock' ? 0.85 : 0.7;
    const score = (E) => { const m = A.measureEdge(E, NODE, nodeY); const s = Math.min(m.minBody, m.minBrim, m.minReed - 0.45 + 0.2, 0.5) - (m.maxSlope > slopeMax(E.kind) ? 0.3 : 0) - (m.gaps.some((g) => g[2] > 1.0) ? 0.5 : 0); return { s, m }; };
    const log = [];
    keys.forEach((key) => {
      const [a, b] = key.split('>'); const E = design.edges.find((e) => e.a === a && e.b === b); let cur = score(E);
      for (let it = 0; it < 8 && cur.s < 0.035; it++) {
        const at = cur.m.minBody <= cur.m.minBrim ? cur.m.atBody : cur.m.atBrim; if (!at) break;
        // candidate list: existing vias near the failing spot, or a fresh via at the spot (inserted at the right place)
        const cands = [];
        E.via.forEach((q, i) => { if (Math.hypot(q[0] - at[0], q[1] - at[1]) < 1.6) cands.push({ i, ins: false }); });
        // insert position: index of the segment nearest to the failing point
        const chain = [[NODE[a].u, NODE[a].v]].concat(E.via).concat([[NODE[b].u, NODE[b].v]]); let bi = 0, bd = 9; for (let i = 0; i < chain.length - 1; i++) { const p = chain[i], q = chain[i + 1]; const dx = q[0] - p[0], dy = q[1] - p[1]; const t = Math.max(0, Math.min(1, ((at[0] - p[0]) * dx + (at[1] - p[1]) * dy) / (dx * dx + dy * dy || 1))); const d = Math.hypot(p[0] + dx * t - at[0], p[1] + dy * t - at[1]); if (d < bd) { bd = d; bi = i; } }
        cands.push({ i: bi, ins: true });
        let best = { s: cur.s, via: null, cost: 0 };
        cands.forEach((c) => {
          const base = E.via.map((q) => q.slice()); const p0 = c.ins ? at.slice() : base[c.i].slice();
          for (let dx = -0.3; dx <= 0.3001; dx += 0.05) for (let dy = -0.3; dy <= 0.3001; dy += 0.05) {
            const via = base.map((q) => q.slice()); const np = [+(p0[0] + dx).toFixed(2), +(p0[1] + dy).toFixed(2)]; if (c.ins) via.splice(c.i, 0, np); else via[c.i] = np;
            const r = score({ a, b, kind: E.kind, via }); const eff = r.s - 0.08 * Math.hypot(dx, dy);
            if (eff > best.s - best.cost + 1e-9 && r.s > cur.s + 0.005) best = { s: r.s, via, cost: 0.08 * Math.hypot(dx, dy) };
          }
        });
        if (!best.via) break; E.via = best.via; cur = score(E);
      }
      log.push([key, +cur.s.toFixed(3), +cur.m.minBody.toFixed(3), +cur.m.minBrim.toFixed(3), +cur.m.minReed.toFixed(2), +cur.m.maxSlope.toFixed(2), JSON.stringify(E.via)]);
    });
    return { design, log };
  }, [design, keys]);
  res.log.forEach((l) => console.log(l.join(' ')));
  fs.writeFileSync(outFile, JSON.stringify(res.design, null, 0)); await browser.close();
})();
