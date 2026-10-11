// measureEdge: shared by check.js and fix.js (runs inside the page, after qa_lib)
module.exports = `
(() => {
  const A = window.__qa, Q = window.__lake.internals(), T = Q.T, W = Q.W; const STEP = 0.1;
  const objInfo = (o) => o ? A.targets.indexOf(o) : -1;
  const reeds = Q.REEDS.filter((r) => !r[2]);
  const reedDist = (u, v) => { let m = 9; for (const r of reeds) m = Math.min(m, Math.hypot(r[0] - u, r[1] - v)); return m; };
  function measureEdge(E, NODE, nodeY) {
    const a = NODE[E.a], b = NODE[E.b];
    const pts = [[a.u, 0, a.v]].concat((E.via || []).map((q) => [q[0], 0, q[1]])).concat([[b.u, 0, b.v]]).map((q) => new T.Vector3(q[0], q[1], q[2]));
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal'); curve.arcLengthDivisions = 100 * (pts.length - 1);
    const L = curve.getLength(); const n = Math.max(1, Math.ceil(L / STEP));
    const S = []; let yprev = nodeY[E.a];
    for (let i = 0; i <= n; i++) {
      const q = curve.getPointAt(i / n); let y = A.surfY(q.x, q.z, yprev + (E.kind === 'rock' ? 0.7 : 0.5));
      if (i === 0) y = nodeY[E.a]; if (i === n) y = nodeY[E.b] === null ? y : A.surfY(q.x, q.z, yprev + 0.5);
      const on = y !== null && y > -0.2; S.push({ u: q.x, v: q.z, y: on ? y : null, on }); if (on) yprev = y;
    }
      // short dips (<= 0.3 wide, > 0.05 deep between two sample levels) are bridged: the foot stays on the level of the two sides
      { const yr = S.map((q) => q.y); for (let k = 1; k < n; k++) { if (!S[k].on) continue; for (let w = 1; w <= 3; w++) { const a = k - w, b = k + w; if (a < 0 || b > n || !S[a].on || !S[b].on) continue; if (yr[k] < Math.min(yr[a], yr[b]) - 0.05) { S[k].on = false; S[k].y = null; break; } } } }
      // hops / bridged gaps, y for every sample, clearance for every sample
      const y = S.map((q) => q.y); const H = L / n;
      const gaps = []; let i = 0; while (i <= n) { if (!S[i].on) { let j = i; while (j <= n && !S[j].on) j++; if (i > 0 && j <= n) gaps.push([i - 1, j]); i = j; } else i++; }
      const yy = y.slice(); const arc = new Array(n + 1).fill(0);
      gaps.forEach(([a, b]) => { const gap = (b - a - 1) * H + 0.05; for (let k = a + 1; k < b; k++) { const t = (k - a) / (b - a); yy[k] = y[a] + (y[b] - y[a]) * t; if (gap > 0.3) arc[k] = (0.12 + 0.1 * gap) * 4 * t * (1 - t); } });
      let minB = 9, minR = 9, atB = null, atR = null, objB = -1, objR = -1, minReed = 9, atReed = null, minHead = 9;
      for (let k = 0; k <= n; k++) { if (yy[k] === null) continue; const p = W(S[k].u, S[k].v, 0); const fy = yy[k] + arc[k];
        let ref = fy; for (let q = Math.max(0, k - 4); q <= Math.min(n, k + 4); q++) if (yy[q] !== null && yy[q] > ref) ref = yy[q]; ref = Math.max(ref, fy);
        const rk = (E.kind === 'rock') ? fy + 0.10 : ref;   // rock: lumps and root humps up to 15 cm above the foot are stepped over (see report)
        const cb = A.clearAt(p, fy, A.BODY_H, 0.27, rk), cr = A.clearAt(p, fy, A.BRIM_H, 0.36, rk); const rd = reedDist(S[k].u, S[k].v); const hd = A.headroom(p, fy);
        if (cb.c < minB) { minB = cb.c; atB = [+S[k].u.toFixed(2), +S[k].v.toFixed(2)]; objB = objInfo(cb.obj); }
        if (cr.c < minR) { minR = cr.c; atR = [+S[k].u.toFixed(2), +S[k].v.toFixed(2)]; objR = objInfo(cr.obj); }
        if (rd < minReed) { minReed = rd; atReed = [+S[k].u.toFixed(2), +S[k].v.toFixed(2)]; } if (hd < minHead) minHead = hd; }
      const drops = []; for (let k = 0; k < n; k++) if (S[k].on && S[k + 1].on && Math.abs(y[k + 1] - y[k]) > 0.07) drops.push([+(k * H).toFixed(2), +(y[k + 1] - y[k]).toFixed(3), +S[k].u.toFixed(2), +S[k].v.toFixed(2)]);
      // slopes: over 0.3 windows, ignoring hops/steps
      let maxSlope = 0, atSlope = null; for (let k = 0; k + 3 <= n; k++) { if (yy[k] === null || yy[k + 3] === null) continue; if (gaps.some(([a, b]) => k < b && k + 3 > a)) continue; if (drops.some((d) => d[0] / H >= k - 1 && d[0] / H <= k + 3)) continue; const sl = Math.abs(yy[k + 3] - yy[k]) / (3 * H); if (sl > maxSlope) { maxSlope = sl; atSlope = [+S[k].u.toFixed(2), +S[k].v.toFixed(2)]; } }
      return ({ a: E.a, b: E.b, kind: E.kind, L, n, H, S: S.map((q, k) => [+q.u.toFixed(3), +q.v.toFixed(3), yy[k] === null ? null : +yy[k].toFixed(3)]), on: S.map((q) => q.on ? 1 : 0), gaps: gaps.map(([a, b]) => [a, b, +((b - a - 1) * H + 0.05).toFixed(2)]), drops,
        minBody: minB, atBody: atB, objBody: objB, minBrim: minR, atBrim: atR, objBrim: objR, minReed, atReed, minHead, maxSlope, atSlope });
  }
  window.__qa.measureEdge = measureEdge; window.__qa.reedDist = reedDist;
})()
`;

