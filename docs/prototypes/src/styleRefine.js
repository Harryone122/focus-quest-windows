// Focus Quest art-direction study: "current" vs "refined low poly".
// Everything here is switchable live so the two looks can be compared on the same frame.

/* ------------------------------------------------------------------ helpers */
function chamferBox(THREE, w, h, d, b) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const P = [];
  const pt = (sx, sy, sz, ax) => ax === 0 ? [sx * hx, sy * (hy - b), sz * (hz - b)] : ax === 1 ? [sx * (hx - b), sy * hy, sz * (hz - b)] : [sx * (hx - b), sy * (hy - b), sz * hz];
  const tri = (a, c, e) => {
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = e[0] - a[0], vy = e[1] - a[1], vz = e[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = a[0] + c[0] + e[0], my = a[1] + c[1] + e[1], mz = a[2] + c[2] + e[2];
    if (nx * mx + ny * my + nz * mz < 0) { const t = c; c = e; e = t; }
    P.push(...a, ...c, ...e);
  };
  const quad = (a, c, e, f) => { tri(a, c, e); tri(a, e, f); };
  const S = [-1, 1];
  // main faces
  for (const s of S) {
    quad(pt(s, -1, -1, 0), pt(s, 1, -1, 0), pt(s, 1, 1, 0), pt(s, -1, 1, 0));
    quad(pt(-1, s, -1, 1), pt(1, s, -1, 1), pt(1, s, 1, 1), pt(-1, s, 1, 1));
    quad(pt(-1, -1, s, 2), pt(1, -1, s, 2), pt(1, 1, s, 2), pt(-1, 1, s, 2));
  }
  // edge bevels
  for (const a of S) for (const c of S) {
    quad(pt(a, c, -1, 0), pt(a, c, 1, 0), pt(a, c, 1, 1), pt(a, c, -1, 1)); // along z
    quad(pt(-1, a, c, 1), pt(1, a, c, 1), pt(1, a, c, 2), pt(-1, a, c, 2)); // along x
    quad(pt(a, -1, c, 0), pt(a, 1, c, 0), pt(a, 1, c, 2), pt(a, -1, c, 2)); // along y
  }
  // corners
  for (const sx of S) for (const sy of S) for (const sz of S) tri(pt(sx, sy, sz, 0), pt(sx, sy, sz, 1), pt(sx, sy, sz, 2));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(P.length / 3 * 2).fill(0), 2));
  g.computeVertexNormals();
  return g;
}

const ss = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ refined traveller */
export function buildRefinedTraveller(T) {
  const { THREE } = T;
  const parts = [];       // [{ host, group }] refined groups attached under the rig
  const hidden = [];      // original meshes whose geometry is swapped out in refined mode
  const EMPTY = new THREE.BufferGeometry();
  const MS = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.92, metalness: 0, flatShading: true }, o));
  const MAT = {
    cloak: MS(0x3d4659, { flatShading: false }), mantle: MS(0x4b566d, { flatShading: false }), lining: MS(0x2a3040),
    trousers: MS(0x3a3431), boot: MS(0x4e3a2b), wrap: MS(0xb8aa8c), scarf: MS(0xe4d9c3, { flatShading: false, side: THREE.DoubleSide }),
    skin: MS(0xe0d2c0, { flatShading: false }), straw: null, band: MS(0x5a4230), cord: MS(0x3a2c22), glove: MS(0x6b4a35, { flatShading: false }),
    canvas: MS(0x8a7a5e), leather: MS(0x6e5039), blanket: MS(0x8e5a45), tie: MS(0x3d3028), wood: MS(0x7d624a), woodDark: MS(0x564436),
    iron: MS(0x34353a, { metalness: 0.35, roughness: 0.6 }), brass: MS(0x9a7a45, { metalness: 0.5, roughness: 0.45 }), tin: MS(0x8d9196, { metalness: 0.45, roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.35, roughness: 1 })
  };
  // woven straw: concentric rings along the lathe's v, faint radial weave along u
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g2 = c.getContext('2d');
  g2.fillStyle = '#c4aa76'; g2.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 6) { g2.fillStyle = 'rgba(90,64,30,.22)'; g2.fillRect(0, y, 64, 2); g2.fillStyle = 'rgba(255,240,200,.18)'; g2.fillRect(0, y + 3, 64, 1); }
  for (let x = 0; x < 64; x += 4) { g2.fillStyle = 'rgba(90,64,30,.07)'; g2.fillRect(x, 0, 1, 128); }
  const strawTex = new THREE.CanvasTexture(c); strawTex.encoding = THREE.sRGBEncoding; strawTex.wrapS = THREE.RepeatWrapping; strawTex.repeat.set(6, 1);
  MAT.straw = new THREE.MeshStandardMaterial({ color: 0xffffff, map: strawTex, roughness: 0.95, flatShading: false, side: THREE.DoubleSide });

  const mk = (geo, mat, parent, x = 0, y = 0, z = 0, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.s) m.scale.set(...o.s); m.castShadow = o.cast !== false; m.receiveShadow = true; parent.add(m); return m; };
  const attach = (host) => { const g = new THREE.Group(); g.visible = false; host.add(g); parts.push(g); return g; };
  const hide = (mesh) => { hidden.push({ mesh, geo: mesh.geometry }); };

  /* cloak: pleated shell — folds deepen toward the hem, hem is uneven, back hangs a little longer */
  function shell(profile, folds, foldAmp, segs = 28, open = 0) {
    const pos = [], idx = [], uv = [];
    profile.forEach(([y, r, fa], i) => {
      for (let k = 0; k <= segs; k++) {
        const th = (k / segs) * Math.PI * 2;
        const amp = (fa ?? 1) * foldAmp;
        const rr = r * (1 + amp * Math.cos(th * folds) + amp * 0.35 * Math.cos(th * folds * 2 + 1.3));
        const back = Math.cos(th) < 0 ? 0 : 0; // placeholder for symmetry
        const hem = i === profile.length - 1 ? (Math.sin(th * 3 + 0.7) * 0.012 - Math.max(0, -Math.cos(th)) * 0.035) : 0; // back (−z) longer
        pos.push(Math.sin(th) * rr, y + hem + back, Math.cos(th) * rr); uv.push(k / segs, i / (profile.length - 1));
      }
    });
    for (let i = 0; i < profile.length - 1; i++) for (let k = 0; k < segs; k++) {
      const a = i * (segs + 1) + k, b = a + 1, c2 = a + segs + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d);
    }
    const g = new THREE.BufferGeometry(); g.setIndex(idx); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  }
  { hide(T.cloak); const R = attach(T.cloak);
    // cloak-local: centre of old cone (upper y 0.25). Neck ≈ +0.29, hem ≈ −0.30
    const prof = [[0.29, 0.045, 0], [0.25, 0.085, 0.1], [0.19, 0.098, 0.3], [0.06, 0.112, 0.6], [-0.1, 0.145, 0.9], [-0.3, 0.205, 1.15]];
    const cl = mk(shell(prof, 7, 0.05), MAT.cloak, R); cl.material.side = THREE.DoubleSide;
    // inner lining visible at the hem
    mk(shell([[-0.16, 0.152, 0.95], [-0.295, 0.198, 1.1]], 7, 0.05), MAT.lining, R, 0, 0, 0, { s: [0.97, 1, 0.97], cast: false }).material.side = THREE.BackSide;
    // shoulder mantle
    mk(shell([[0.3, 0.05, 0], [0.26, 0.095, 0.4], [0.19, 0.118, 1], [0.13, 0.124, 1.3]], 9, 0.04), MAT.mantle, R).material.side = THREE.DoubleSide;
    // belt + pouch + a small hanging token (journey items hang here)
    mk(new THREE.CylinderGeometry(0.117, 0.119, 0.03, 20, 1, true), MAT.leather, R, 0, 0.03, 0).material.side = THREE.DoubleSide;
    mk(chamferBox(THREE, 0.025, 0.04, 0.012, 0.004), MAT.brass, R, 0, 0.03, 0.119);
    const pouch = mk(chamferBox(THREE, 0.07, 0.065, 0.035, 0.01), MAT.leather, R, 0.092, -0.02, 0.09, { ry: 0.8 });
    mk(chamferBox(THREE, 0.072, 0.025, 0.038, 0.007), MAT.boot, pouch, 0, 0.03, 0.002);
    const tok = new THREE.Group(); tok.position.set(-0.105, 0.015, 0.085); R.add(tok);
    mk(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 3), MAT.cord, tok, 0, -0.03, 0);
    mk(new THREE.OctahedronGeometry(0.022, 0), MAT.glass, tok, 0, -0.07, 0, { cast: false }).material = new THREE.MeshStandardMaterial({ color: 0x7a5a2a, emissive: 0xe0b265, emissiveIntensity: 0.35, roughness: 0.5, flatShading: true });
    R.userData.token = tok;
  }
  /* legs: trousers, wrapped gaiters, boots with toes */
  for (const leg of [T.legL, T.legR]) { hide(leg); const R = attach(leg);
    mk(new THREE.CylinderGeometry(0.04, 0.035, 0.19, 7), MAT.trousers, R, 0, -0.095, 0);
    for (let k = 0; k < 3; k++) mk(new THREE.CylinderGeometry(0.039, 0.039, 0.018, 7), MAT.wrap, R, 0, -0.17 - k * 0.022, 0, { ry: k * 0.4, rz: (k - 1) * 0.12 });
    mk(new THREE.CylinderGeometry(0.038, 0.042, 0.075, 7), MAT.boot, R, 0, -0.255, 0);
    mk(new THREE.SphereGeometry(0.04, 8, 5), MAT.boot, R, 0, -0.28, 0.03, { s: [1, 0.55, 1.45] });
    mk(chamferBox(THREE, 0.084, 0.016, 0.13, 0.005), MAT.cord, R, 0, -0.293, 0.025);
  }
  /* arms: bell sleeves, cuffs, gloved hands */
  for (const [arm, side] of [[T.armL, -1], [T.armR, 1]]) { hide(arm); const R = attach(arm);
    mk(new THREE.CylinderGeometry(0.031, 0.045, 0.25, 9), MAT.cloak, R, 0, -0.12, 0);
    mk(new THREE.CylinderGeometry(0.047, 0.047, 0.018, 9), MAT.mantle, R, 0, -0.245, 0);
    const hand = mk(new THREE.SphereGeometry(0.031, 9, 7), MAT.glove, R, 0, -0.29, 0.004, { s: [0.9, 1.1, 1] });
    mk(new THREE.SphereGeometry(0.014, 6, 5), MAT.glove, hand, -side * 0.024, 0.01, 0.019);
    arm.children.forEach(ch => { if (ch.isMesh && ch.geometry.type === 'SphereGeometry') hide(ch); }); // old bare hand
  }
  /* head: same faceless head; hat is now a woven straw kasa with a band and chin cord */
  { const kids = T.head.children.filter(o => o.isMesh); const [skull, oldHat] = kids; hide(oldHat);
    const R = attach(T.head);
    const prof = [[0.0, 0.205], [0.03, 0.198], [0.08, 0.17], [0.15, 0.123], [0.23, 0.075], [0.3, 0.038], [0.335, 0.02], [0.34, 0.008], [0.322, 0.006], [0.12, 0.06], [0.0, 0.08]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    mk(new THREE.LatheGeometry(prof, 24), MAT.straw, R, 0, -0.02, 0, { s: [0.9, 0.78, 0.9] });
    mk(new THREE.CylinderGeometry(0.1, 0.104, 0.02, 20, 1, true), MAT.band, R, 0, 0.045, 0).material.side = THREE.DoubleSide;
    // chin cord
    for (const s of [-1, 1]) { const cord = mk(new THREE.CylinderGeometry(0.003, 0.003, 0.15, 3), MAT.cord, R, s * 0.08, -0.03, 0.02, { cast: false }); cord.rotation.z = s * 0.55; cord.rotation.x = -0.15; }
    // a little hair at the nape so the head reads from behind
    mk(new THREE.SphereGeometry(0.1, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), MS(0x2f2925), R, 0, -0.005, -0.012, { rx: -0.5, s: [1.04, 1, 1.04] });
    R.userData.skull = skull;
  }
  /* scarf: neck wrap + two tails that trail and flutter (cream, the one bright accent on the silhouette) */
  const tails = [];
  { const R = attach(T.upper);
    mk(new THREE.TorusGeometry(0.058, 0.024, 7, 14), MAT.scarf, R, 0, 0.535, 0, { rx: Math.PI / 2, s: [1, 1.1, 1] });
    mk(new THREE.TorusGeometry(0.056, 0.02, 6, 14), MAT.scarf, R, 0, 0.508, 0.006, { rx: Math.PI / 2 + 0.25 });
    mk(new THREE.BoxGeometry(0.06, 0.012, 0.17), MAT.scarf, R, 0.01, 0.56, -0.13, { rx: -0.1 });
    for (const [x, len, ph] of [[0.035, 4, 0], [-0.02, 3, 1.7]]) {
      let parent = new THREE.Group(); parent.position.set(x * 0.8, 0.53, -0.21); R.add(parent); const segs = [];
      for (let k = 0; k < len; k++) {
        const seg = new THREE.Group(); if (k > 0) seg.position.y = -0.075; parent.add(seg);
        const w = 0.05 - k * 0.004; mk(new THREE.BoxGeometry(w, 0.08, 0.012), MAT.scarf, seg, 0, -0.038, 0);
        if (k === len - 1) for (let f = 0; f < 4; f++) mk(new THREE.BoxGeometry(0.004, 0.025, 0.004), MAT.scarf, seg, -w / 2 + 0.006 + f * (w - 0.012) / 3, -0.09, 0, { cast: false });
        segs.push(seg); parent = seg;
      }
      tails.push({ segs, ph });
    }
  }
  /* pack: canvas rucksack with flap, shoulder straps, rolled blanket, tin cup */
  { const packMesh = T.upper.children.find(o => o.isMesh && o.geometry.type === 'CylinderGeometry' && Math.abs(o.position.z + 0.15) < 0.01); hide(packMesh);
    const R = attach(T.upper);
    const pk = mk(chamferBox(THREE, 0.18, 0.23, 0.09, 0.022), MAT.canvas, R, 0, 0.35, -0.16, { rx: 0.08 });
    mk(chamferBox(THREE, 0.198, 0.1, 0.098, 0.016), MAT.leather, pk, 0, 0.07, 0.002);
    mk(chamferBox(THREE, 0.026, 0.034, 0.01, 0.004), MAT.brass, pk, 0, 0.018, -0.052);
    mk(chamferBox(THREE, 0.13, 0.065, 0.03, 0.01), MAT.canvas, pk, 0, -0.06, -0.055);
    for (const s of [-1, 1]) { mk(chamferBox(THREE, 0.026, 0.2, 0.012, 0.004), MAT.leather, R, s * 0.058, 0.4, 0.1, { rx: 0.12 }); }
    const roll = mk(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 10), MAT.blanket, R, 0, 0.505, -0.165, { rz: Math.PI / 2 });
    for (const s of [-1, 1]) mk(new THREE.CylinderGeometry(0.048, 0.048, 0.016, 10), MAT.tie, roll, 0, s * 0.085, 0);
    mk(new THREE.CircleGeometry(0.045, 10), MS(0x6f4536), R, 0.131, 0.505, -0.165, { ry: Math.PI / 2 });
    const cup = new THREE.Group(); cup.position.set(-0.098, 0.27, -0.165); R.add(cup);
    mk(new THREE.CylinderGeometry(0.026, 0.022, 0.04, 9, 1, true), MAT.tin, cup, 0, -0.03, 0).material.side = THREE.DoubleSide;
    mk(new THREE.TorusGeometry(0.014, 0.004, 4, 8), MAT.tin, cup, -0.034, -0.03, 0);
  }
  /* staff: knotted, slightly crooked, with a hook; lantern hangs from the hook and swings */
  let lanternPivot;
  { const kids = T.staff.children.filter(o => o.isMesh); kids.forEach(hide); const R = attach(T.staff);
    const pts = [[0, -0.52, 0], [0.006, -0.25, 0.004], [-0.004, 0.05, -0.002], [0.004, 0.36, 0.0], [0, 0.52, 0.012], [0, 0.585, 0.06], [0, 0.575, 0.11], [0, 0.545, 0.13]].map(p => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts); const tube = new THREE.TubeGeometry(curve, 40, 0.018, 6, false);
    const pa = tube.attributes.position; // taper toward the hook
    for (let i = 0; i < pa.count; i++) { /* keep: tube radius is uniform — knots below add the variation */ }
    mk(tube, MAT.wood, R);
    for (const y of [-0.3, 0.12, 0.31]) mk(new THREE.SphereGeometry(0.024, 6, 4), MAT.woodDark, R, 0.003, y, 0, { s: [1, 0.7, 1] });
    for (let k = 0; k < 3; k++) mk(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 6), MAT.wrap, R, 0, -0.06 - k * 0.019, 0, { rz: (k - 1) * 0.15 });
    lanternPivot = new THREE.Group(); lanternPivot.position.set(0, 0.545, 0.13); R.add(lanternPivot); lanternPivot.scale.setScalar(1.45);
    const L = lanternPivot;
    mk(new THREE.TorusGeometry(0.014, 0.0035, 4, 10), MAT.iron, L, 0, -0.012, 0, { ry: Math.PI / 2 });
    mk(new THREE.ConeGeometry(0.046, 0.034, 8), MAT.iron, L, 0, -0.04, 0);
    mk(new THREE.CylinderGeometry(0.048, 0.048, 0.008, 8), MAT.iron, L, 0, -0.058, 0);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; mk(new THREE.BoxGeometry(0.006, 0.07, 0.006), MAT.iron, L, Math.cos(a) * 0.036, -0.096, Math.sin(a) * 0.036); }
    const core = mk(new THREE.CylinderGeometry(0.03, 0.03, 0.064, 8), MAT.glass, L, 0, -0.096, 0, { cast: false });
    mk(new THREE.CylinderGeometry(0.044, 0.04, 0.012, 8), MAT.iron, L, 0, -0.136, 0);
    mk(new THREE.SphereGeometry(0.008, 5, 4), MAT.brass, L, 0, -0.147, 0);
    L.userData.core = core;
  }

  /* ---- switching + per-frame motion ---- */
  const home = { light: T.lantern.parent, lightPos: T.lantern.position.clone(), glowPos: T.lanternGlow.position.clone() };
  let on = false;
  function set(v) {
    on = v;
    parts.forEach(g => g.visible = v);
    hidden.forEach(h => { h.mesh.geometry = v ? EMPTY : h.geo; });
    if (v) { lanternPivot.add(T.lantern); lanternPivot.add(T.lanternGlow); T.lantern.position.set(0, -0.096, 0); T.lanternGlow.position.set(0, -0.096, 0); T.lanternGlow.scale.set(0.5, 0.5, 1); T.lantern.intensity = 1.0; }
    else { home.light.add(T.lantern); home.light.add(T.lanternGlow); T.lantern.position.copy(home.lightPos); T.lanternGlow.position.copy(home.glowPos); T.lanternGlow.scale.set(0.8, 0.8, 1); T.lantern.intensity = 0.8; }
  }
  const last = new THREE.Vector3(); let speedS = 0, t = 0, swingV = 0, swingA = 0, swingVz = 0, swingAz = 0;
  const qW = new THREE.Quaternion(), down = new THREE.Vector3();
  function tick(dt) {
    if (!on || dt <= 0) return; t += dt;
    const p = T.trav.position; const v = Math.min(3, p.distanceTo(last) / dt); last.copy(p); speedS += (v - speedS) * Math.min(1, dt * 4);
    const walk = Math.min(1, speedS / 1.2);
    // scarf tails: trail backward when walking, a slow breeze otherwise
    tails.forEach(({ segs, ph }) => segs.forEach((s, k) => {
      const base = k === 0 ? -0.15 - 0.6 * walk : -0.05 - 0.12 * walk;
      s.rotation.x = base + Math.sin(t * (1.6 + walk * 4) + ph + k * 0.9) * (0.06 + 0.1 * walk) * (1 + k * 0.4);
      s.rotation.z = Math.sin(t * 1.1 + ph * 2 + k * 0.7) * 0.07 * (1 + k * 0.5);
    }));
    // lantern: a damped pendulum that hangs plumb in world space, kicked by steps
    lanternPivot.parent.getWorldQuaternion(qW); down.set(0, -1, 0).applyQuaternion(qW.invert());
    const tx = Math.atan2(-down.z, -down.y), tz = Math.atan2(down.x, -down.y);
    const kick = walk * Math.sin(t * 9.5) * 0.9;
    swingV += ((tx - swingA) * 30 - swingV * 3.2 + kick) * dt; swingA += swingV * dt;
    swingVz += ((tz - swingAz) * 30 - swingVz * 3.2) * dt; swingAz += swingVz * dt;
    lanternPivot.rotation.set(swingA, 0, swingAz);
  }
  return { set, tick, get on() { return on; } };
}

/* ------------------------------------------------------------------ world pass */
export function buildWorldPass(W) {
  const { THREE, out, scene, sun, win } = W;
  const U = { k: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) }, sky: { value: new THREE.Color(0.6, 0.7, 0.9) } };
  const meshes = []; out.updateMatrixWorld(true);
  out.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.material && !Array.isArray(o.material)) meshes.push(o); });
  const isTerrain = m => m.material.vertexColors && m.geometry.attributes.position.count > 60000;
  const terrains = meshes.filter(isTerrain);

  /* 1. rim/fresnel on every standard material (edges turned toward the sun pick up its colour) + gentle sky fill */
  const patched = new Set();
  function patch(mat, strength) {
    if (patched.has(mat) || !mat.isMeshStandardMaterial) return; patched.add(mat);
    mat.userData.rim = strength;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      prev && prev(sh, r);
      sh.uniforms.uRefK = U.k; sh.uniforms.uSunDirV = U.sunDir; sh.uniforms.uSunCol = U.sunCol; sh.uniforms.uSky = U.sky; sh.uniforms.uRimS = { value: strength };
      sh.fragmentShader = 'uniform float uRefK; uniform vec3 uSunDirV; uniform vec3 uSunCol; uniform vec3 uSky; uniform float uRimS;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
        { vec3 vd = isOrthographic ? vec3(0.0,0.0,1.0) : normalize(vViewPosition);
          float fr = pow(1.0 - saturate(dot(normal, vd)), 2.6);
          float toward = smoothstep(-0.35, 0.55, dot(normal, uSunDirV));
          outgoingLight += uRefK * uRimS * fr * toward * uSunCol * diffuseColor.rgb * 1.1;
          float up = saturate(normal.y * 0.5 + 0.5);
          outgoingLight += uRefK * uRimS * 0.06 * up * uSky * diffuseColor.rgb; }
        gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);
    };
    mat.customProgramCacheKey = () => 'refine' + strength;
    mat.needsUpdate = true;
  }
  meshes.forEach(m => { const mt = m.material; if (mt.transparent || mt.blending === THREE.AdditiveBlending) return; patch(mt, isTerrain(m) ? 0.25 : 1); });

  /* 2. vertical gradient per object (darker at the foot, a touch lighter on top) — reads as soft AO + volume */
  const grads = [];
  const usable = meshes.filter(m => m.material.isMeshStandardMaterial && !m.material.transparent && !isTerrain(m) && m.material.blending !== THREE.AdditiveBlending && !(m.material.emissiveIntensity > 0.2 && m.material.emissive && m.material.emissive.getHex() !== 0));
  const vcMats = new Map(); // materials that already use vertex colours stay as-is
  meshes.forEach(m => { if (m.material.vertexColors) vcMats.set(m.material, true); });
  const geoDone = new Map();
  usable.forEach(m => {
    if (vcMats.has(m.material)) return;
    const g = m.geometry; if (!g.attributes.position) return;
    if (!geoDone.has(g)) {
      g.computeBoundingBox(); const bb = g.boundingBox, h = Math.max(1e-4, bb.max.y - bb.min.y);
      const pa = g.attributes.position, n = pa.count, ones = new Float32Array(n * 3).fill(1), grad = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const t = (pa.getY(i) - bb.min.y) / h; const v = 0.74 + 0.32 * ss(0, 1, t); grad[i * 3] = grad[i * 3 + 1] = grad[i * 3 + 2] = v; }
      if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(ones.slice(), 3));
      geoDone.set(g, { ones, grad }); grads.push(g);
    }
  });
  // every mesh that shares one of these materials needs a colour attribute too
  const gradMats = new Set(usable.filter(m => !vcMats.has(m.material)).map(m => m.material));
  meshes.forEach(m => { if (gradMats.has(m.material) && !m.geometry.attributes.color) { const n = m.geometry.attributes.position.count; m.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); } });
  gradMats.forEach(mt => { mt.vertexColors = true; mt.needsUpdate = true; });

  /* 3. bevels: hard boxes become chamfered boxes (wood, stone blocks, crates, rails) */
  const bevels = []; const cache = new Map();
  meshes.forEach(m => {
    const g = m.geometry; if (g.type !== 'BoxGeometry' || m.material.map || vcMats.has(m.material) || !m.material.isMeshStandardMaterial || m.material.transparent) return;
    const { width: w, height: h, depth: d } = g.parameters; const mn = Math.min(w, h, d); if (mn < 0.03) return;
    const b = Math.min(0.045, mn * 0.14); const key = [w, h, d, b].map(x => x.toFixed(4)).join();
    let ng = cache.get(key); if (!ng) { ng = chamferBox(THREE, w, h, d, b); cache.set(key, ng); }
    bevels.push({ m, old: g, ng });
  });
  // the bevelled copies need the same gradient colours
  cache.forEach(ng => {
    ng.computeBoundingBox(); const bb = ng.boundingBox, hh = Math.max(1e-4, bb.max.y - bb.min.y), pa = ng.attributes.position, n = pa.count;
    const grad = new Float32Array(n * 3), ones = new Float32Array(n * 3).fill(1);
    for (let i = 0; i < n; i++) { const v = 0.74 + 0.32 * ss(0, 1, (pa.getY(i) - bb.min.y) / hh); grad[i * 3] = grad[i * 3 + 1] = grad[i * 3 + 2] = v; }
    ng.setAttribute('color', new THREE.BufferAttribute(grad, 3));
  });

  /* 4. calmer ground: grass and gentle slopes take smooth normals, cliffs keep their facets; contact shade around trees, rocks, posts */
  const obst = (win.__obst || []).slice();
  const terr = terrains.map(m => {
    const g = m.geometry, pa = g.attributes.position, n = pa.count;
    const flatN = g.attributes.normal.array.slice();
    // smooth normals by welding positions
    const key = i => `${pa.getX(i).toFixed(3)},${pa.getY(i).toFixed(3)},${pa.getZ(i).toFixed(3)}`;
    const acc = new Map(); const fn = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let f = 0; f < n; f += 3) { a.fromBufferAttribute(pa, f); b.fromBufferAttribute(pa, f + 1); c.fromBufferAttribute(pa, f + 2); fn.subVectors(c, b).cross(a.clone().sub(b)); if (fn.y < 0) fn.negate();
      for (let q = 0; q < 3; q++) { const k = key(f + q); const s = acc.get(k) || [0, 0, 0]; s[0] += fn.x; s[1] += fn.y; s[2] += fn.z; acc.set(k, s); } }
    const smoothN = new Float32Array(n * 3);
    for (let f = 0; f < n; f += 3) {
      const fy = Math.abs(flatN[f * 3 + 1]); const w = ss(0.3, 0.72, fy) * 0.92; // near-vertical cliffs keep facets
      for (let q = 0; q < 3; q++) { const i = f + q, s = acc.get(key(i)); const L = Math.hypot(s[0], s[1], s[2]) || 1;
        let x = flatN[i * 3] * (1 - w) + s[0] / L * w, y = flatN[i * 3 + 1] * (1 - w) + s[1] / L * w, z = flatN[i * 3 + 2] * (1 - w) + s[2] / L * w; const l2 = Math.hypot(x, y, z) || 1;
        smoothN[i * 3] = x / l2; smoothN[i * 3 + 1] = y / l2; smoothN[i * 3 + 2] = z / l2; } }
    // contact shade
    const col = g.attributes.color.array, baseC = col.slice(), shadeC = col.slice();
    if (obst.length) { const grid = new Map(); obst.forEach(o => { const k = Math.floor(o.x / 2) * 1000 + Math.floor(o.z / 2); (grid.get(k) || grid.set(k, []).get(k)).push(o); });
      for (let i = 0; i < n; i++) { const x = pa.getX(i), z = pa.getZ(i); let sh = 0; const gx = Math.floor(x / 2), gz = Math.floor(z / 2);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const arr = grid.get((gx + dx) * 1000 + gz + dz); if (!arr) continue; for (const o of arr) { const d = Math.hypot(x - o.x, z - o.z); sh = Math.max(sh, 1 - ss(o.r * 0.6, o.r * 1.9 + 0.25, d)); } }
        const f = 1 - 0.3 * sh; shadeC[i * 3] *= f; shadeC[i * 3 + 1] *= f; shadeC[i * 3 + 2] *= f; } }
    return { m, flatN, smoothN, baseC, shadeC };
  });

  /* 5. foliage: keep the low-poly silhouette but soften the facet contrast inside it */
  const foliage = [];
  (win.__trees || []).forEach(t => t.g.traverse(o => {
    if (!o.isMesh) return; const ty = o.geometry.type; if (ty !== 'IcosahedronGeometry' && ty !== 'DodecahedronGeometry' && ty !== 'ConeGeometry') return;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); const pa = src.attributes.position, n = pa.count;
    src.computeBoundingBox(); const cen = new THREE.Vector3(); src.boundingBox.getCenter(cen); if (ty === 'ConeGeometry') cen.y = src.boundingBox.min.y - (src.boundingBox.max.y - src.boundingBox.min.y) * 0.4;
    const nn = new Float32Array(n * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), rd = new THREE.Vector3();
    for (let f = 0; f < n; f += 3) { a.fromBufferAttribute(pa, f); b.fromBufferAttribute(pa, f + 1); c.fromBufferAttribute(pa, f + 2); fn.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      for (let q = 0; q < 3; q++) { rd.fromBufferAttribute(pa, f + q).sub(cen).normalize(); const m = fn.clone().multiplyScalar(0.45).addScaledVector(rd, 0.55).normalize(); nn[(f + q) * 3] = m.x; nn[(f + q) * 3 + 1] = m.y; nn[(f + q) * 3 + 2] = m.z; } }
    src.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    const h = Math.max(1e-4, src.boundingBox.max.y - src.boundingBox.min.y), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = 0.78 + 0.3 * ss(0, 1, (pa.getY(i) - src.boundingBox.min.y) / h); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
    src.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = o.material.clone(); mat.flatShading = false; mat.vertexColors = true; patch(mat, 1);
    foliage.push({ o, g0: o.geometry, m0: o.material, g1: src, m1: mat });
  }));

  /* light: slightly warmer key, softer shadow edge */
  const sunBase = { intensity: sun.intensity, radius: sun.shadow.radius };
  const camDirTmp = new THREE.Vector3();

  let on = false;
  function set(v) {
    on = v; U.k.value = v ? 1 : 0;
    grads.forEach(g => { const d = geoDone.get(g); g.attributes.color.array.set(v ? d.grad : d.ones); g.attributes.color.needsUpdate = true; });
    bevels.forEach(b => { b.m.geometry = v ? b.ng : b.old; });
    terr.forEach(t => { const g = t.m.geometry; g.attributes.normal.array.set(v ? t.smoothN : t.flatN); g.attributes.normal.needsUpdate = true; g.attributes.color.array.set(v ? t.shadeC : t.baseC); g.attributes.color.needsUpdate = true; t.m.material.flatShading = !v; t.m.material.needsUpdate = true; });
    sun.shadow.radius = v ? 3 : sunBase.radius;
    foliage.forEach(f => { f.o.geometry = v ? f.g1 : f.g0; f.o.material = v ? f.m1 : f.m0; });
  }
  function tick(cam) {
    if (!on || !cam) return;
    // sun direction in view space
    const d = sun.position.clone().sub(sun.target.position).normalize();
    U.sunDir.value.copy(d).transformDirection(cam.matrixWorldInverse);
    U.sunCol.value.copy(sun.color).multiplyScalar(Math.min(1.2, sun.intensity * 0.45));
    U.sky.value.copy(scene.fog ? scene.fog.color : U.sky.value);
  }
  return { set, tick, stats: { patched: patched.size, gradGeos: grads.length, bevels: bevels.length, terrains: terr.length, foliage: foliage.length } };
}
