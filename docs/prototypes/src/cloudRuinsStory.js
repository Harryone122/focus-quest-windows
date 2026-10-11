// Design reference (Claude, 2026-09-29), NOT wired into the App.
// = src/renderer/src/cloudRuins/cloudRuinsScene.js as of 2026-09-29 + the "Story events" block
// (opening, first/second visit, item events, cloud whale). Spec: docs/AREA_01_STORY_EVENTS.md.
// Diff it against the App's scene to port. Import paths are the App's, as if it sat in cloudRuins/.
// 雲上遺庭 — Focus Active scene (Area 01).
//
// Presentation only. React owns the focus timer and the saved state; this module never
// advances focus time, never decides rewards, and never blocks the session. It reads:
//   progressSeconds / targetSeconds  → where the traveller should be and which lamps are due
//   departure (FocusSession.departure) → the 5-second leave animation at the start of a new route
// Lamps are due at equal fifths of the planned time; the fifth is due at 100%.
import * as T from './vendor/three.module.js';
import AREA from '../../../../docs/area-01-cloud-ruins.scene.json';
import { timeOfDayAt } from '../../../shared/timeOfDay';
import { litLampCount, fitsBeforeLamp } from '../../../shared/lampTiming';
import { createEdgeGlass } from './edgeGlass.js';
import { sampleCamera, mixCamera, easeInOutCubic, springCamera } from './storyCamera.js';

export function createCloudRuinsScene(host, options) {
  const opts = Object.assign({
    progressSeconds: 0, targetSeconds: 1500, seed: 1, reducedMotion: false,
    departure: null, departureElapsedMs: 0, paused: false, mode: 'focus', lobbyView: null,
    // Saved world state for this Area (Codex): whether the permanent core is already owned, and which
    // one-time world marks were already seen (e.g. 'tree_traces_seen'). undefined = not provided yet.
    coreTaken: false, worldMarks: undefined,
    reportActivity() {}, reportLights() {}, reportDepartureComplete() {}, reportAnchors() {}, reportWorldMark() {},
    // story events (design 2026-09-29): { visit, opening, items, whaleSeed }; records and the cinematic flag go back to the App
    story: null, reportStoryRecord() {}, reportCinematic() {}
  }, options || {});
  // Lobby (Today): the same Area, held still at saved progress, with the next routes drawn on it.
  // Nothing here advances time; the traveller only rests, waits or looks around.
  let LOBBY = opts.mode === 'lobby';

  // ---------- renderer / scene ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'cloud-ruins-canvas';
  host.appendChild(canvas);
  const cover = document.createElement('div');
  cover.className = 'cloud-ruins-cover';
  cover.setAttribute('aria-hidden', 'true');
  host.appendChild(cover);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  // Glass behind the Focus Active text is sampled from this same frame (see edgeGlass.js).
  const glass = createEdgeGlass(renderer);
  if (opts.paused) glass.jumpPaused(true);
  host.dataset.glass = 'scene';
  const scene = new T.Scene();
  scene.background = new T.Color(0x6d7488);
  scene.fog = new T.Fog(0x6d7488, 86, 112);
  let MOTION = opts.reducedMotion ? 0.25 : 1;

  // ---------- pausable scene time ----------
  // Every animation reads time from here. While the Focus is paused this clock stands still, and on
  // resume it carries on from the same instant: pause time is never replayed or skipped over.
  let pausedAtReal = opts.paused ? performance.now() : -1;
  let pausedTotalMs = 0;
  const sceneNow = () => (pausedAtReal >= 0 ? pausedAtReal : performance.now()) - pausedTotalMs;
  const isPaused = () => pausedAtReal >= 0;
  let redrawUntil = 0;                // real ms: keep drawing the frozen frame until then (resize, glass easing)
  const requestRedraw = (ms) => { redrawUntil = Math.max(redrawUntil, performance.now() + (ms || 120)); };

  const S = Math.SQRT1_2;
  const W = (u, v, y) => new T.Vector3(u * S - v * S, y || 0, -u * S - v * S);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rr = (a, b) => a + (b - a) * rnd();
  // Runtime choices use their own seeded stream so a session replays the same way after a restart.
  let runSeed = (Math.abs(Math.floor(opts.seed || 1)) % 2147483646) + 1;
  const rand = () => { runSeed = (runSeed * 48271) % 2147483647; return (runSeed - 1) / 2147483646; };
  const mr = (a, b) => a + (b - a) * rand();
  const headingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  const mat = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.96, metalness: 0, flatShading: true }, extra || {}));
  const WHITE = new T.Color(0xffffff);
  const COL = { grass: 0x7d9169, earth: 0x7b6753, rockLow: 0x57565a, water: 0x6d8c93 };
  const M = {
    stone: mat(0xb4aea2), stoneDark: mat(0x8f8a80), path: mat(0xc4beb0), wood: mat(0x6f5b49), woodDark: mat(0x54463a),
    rope: mat(0x8d7c63), cloak: mat(0x3d4659), hat: mat(0xb49c70), skin: mat(0xe0d2c0, { flatShading: false }), roof: mat(0x5d666d),
    pillar: mat(0x6b5446), pine: mat(0x506c5d), pine2: mat(0x5c7a69), island: mat(0xffffff, { vertexColors: true }),
    lampStone: mat(0xa9a397), brass: new T.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.55, roughness: 0.42 }),
    dark: mat(0x2a2926), paper: mat(0xe9e1cf), bush: mat(0x6c8660), vine: mat(0x6f8b5c)
  };
  const shadowy = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
  const mesh = (geo, m, parent, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(o); return o; };

  // ---------- lights ----------
  const hemi = new T.HemisphereLight(0xa4a9c2, 0x4a4c5c, 0.6);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xf0a979, 0.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  // ---------- islands ----------
  const ISLANDS = AREA.islands.map((I) => Object.assign({}, I));
  const FAR_ISLANDS = [
    { u: 5, v: 27, y: -5, r: 3.6, depth: 3.6 }
  ];
  ISLANDS.forEach((I) => { const c = W(I.u, I.v, 0); I.x = c.x; I.z = c.z; });
  const roots = [];
  function makeIsland(I, near) {
    const g = new T.Group();
    const c = W(I.u, I.v, 0);
    g.position.set(c.x, I.y, c.z);
    scene.add(g);
    const p = [rr(0, 6.28), rr(0, 6.28), rr(0, 6.28), rr(0, 6.28), rr(0, 6.28)];
    const rf = (a) => 1 + 0.07 * Math.sin(3 * a + p[0]) + 0.045 * Math.sin(5 * a + p[1]) + 0.025 * Math.sin(9 * a + p[2]);
    I.rf = rf;
    const cGrass = new T.Color(COL.grass), cEarth = new T.Color(COL.earth), cLow = new T.Color(COL.rockLow), cMid = new T.Color(0x8c877f);
    const tmp = new T.Color();
    const top = new T.CylinderGeometry(I.r, I.r * 0.97, 0.7, 44, 1);
    const tp = top.attributes.position; const tc = [];
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
      const f = rf(Math.atan2(z, x));
      tp.setX(i, x * f); tp.setZ(i, z * f);
      if (y > 0) tmp.copy(cGrass).offsetHSL(rr(-0.01, 0.01), rr(-0.03, 0.03), rr(-0.03, 0.03));
      else tmp.copy(cEarth).offsetHSL(0, 0, rr(-0.03, 0.03));
      tc.push(tmp.r, tmp.g, tmp.b);
    }
    top.setAttribute('color', new T.Float32BufferAttribute(tc, 3));
    top.translate(0, -0.35, 0); top.computeVertexNormals();
    const topMesh = mesh(top, M.island, g); topMesh.receiveShadow = true; topMesh.castShadow = true;
    const h = I.depth;
    const cone = new T.ConeGeometry(I.r * 0.97, h, 44, 7, true);
    cone.rotateX(Math.PI);
    const cp = cone.attributes.position;
    const ox = rr(-0.5, 0.5) * I.r * 0.25, oz = rr(-0.5, 0.5) * I.r * 0.25;
    const cc = [];
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
      const t = (y + h / 2) / h;
      const a = Math.atan2(z, x);
      let k = rf(a);
      if (t < 0.999) k *= 1 + 0.13 * Math.sin(4 * a + t * 6 + p[3]) + 0.07 * Math.sin(7 * a - t * 9 + p[4]) + rr(-0.04, 0.04);
      cp.setX(i, x * k + (1 - t) * ox); cp.setZ(i, z * k + (1 - t) * oz);
      if (t < 0.999 && t > 0.001) cp.setY(i, y + rr(-0.06, 0.06) * h);
      const band = 0.5 + 0.5 * Math.sin(t * 13 + a * 2);
      if (t > 0.82) tmp.copy(cEarth).lerp(cMid, (1 - t) * 3);
      else tmp.copy(cLow).lerp(cMid, Math.pow(t, 0.7) * (0.75 + 0.25 * band));
      tmp.offsetHSL(0, 0, rr(-0.025, 0.025));
      cc.push(tmp.r, tmp.g, tmp.b);
    }
    cone.setAttribute('color', new T.Float32BufferAttribute(cc, 3));
    cone.translate(0, -0.68 - h / 2, 0); cone.computeVertexNormals();
    const under = mesh(cone, M.island, g); under.castShadow = true; under.receiveShadow = true;
    if (near) {
      const n = Math.round(I.r * 1.5);
      for (let i = 0; i < n; i++) {
        const a = rr(0, Math.PI * 2), len = rr(0.6, 1.9);
        const geo = new T.CylinderGeometry(0.018, 0.035, len, 4); geo.translate(0, -len / 2, 0);
        const root = mesh(geo, M.woodDark, g, Math.cos(a) * I.r * 0.93 * rf(a), -0.6, Math.sin(a) * I.r * 0.93 * rf(a));
        root.rotation.set(rr(-0.15, 0.15), 0, rr(-0.15, 0.15));
        roots.push({ m: root, ph: rr(0, 6.28), bx: root.rotation.x, bz: root.rotation.z });
      }
    }
    return g;
  }
  ISLANDS.forEach((I) => makeIsland(I, true));
  FAR_ISLANDS.forEach((I) => makeIsland(I, false));
  const islandById = {}; ISLANDS.forEach((I) => { islandById[I.id] = I; });

  function islandUnder(x, z) {
    for (const I of ISLANDS) {
      const dx = x - I.x, dz = z - I.z;
      if (Math.hypot(dx, dz) < I.r * I.rf(Math.atan2(dz, dx)) * 0.97) return I;
    }
    return null;
  }
  const PAV = W(12.62, 9.32, 3.4), PAV_R = 1.55, PAV_H = 0.12;
  function groundY(p) {
    const I = islandUnder(p.x, p.z);
    if (I && Math.abs(p.y - I.y) < 0.5) {
      if (I.id === 'C' && Math.hypot(p.x - PAV.x, p.z - PAV.z) < PAV_R - 0.05) return I.y + PAV_H;
      return I.y;
    }
    return p.y;
  }

  // ---------- nodes & edges ----------
  const NODE = {};
  AREA.nodes.forEach((n) => { NODE[n.id] = Object.assign({}, n, { p: W(n.u, n.v, n.y) }); });
  const makeCurve = (pts) => pts.length === 2 ? new T.LineCurve3(pts[0], pts[1]) : new T.CatmullRomCurve3(pts, false, 'centripetal');
  const ADJ = {}; Object.keys(NODE).forEach((id) => { ADJ[id] = []; });
  const EDGES = AREA.edges.map((e) => {
    const pts = [NODE[e.a].p].concat((e.via || []).map((v) => W(v[0], v[1], v[2]))).concat([NODE[e.b].p]);
    const E = Object.assign({}, e, { pts, fwd: makeCurve(pts), rev: makeCurve(pts.slice().reverse()) });
    E.len = E.fwd.getLength();
    ADJ[e.a].push({ to: e.b, E, dir: 'fwd' }); ADJ[e.b].push({ to: e.a, E, dir: 'rev' });
    return E;
  });
  // all-pairs shortest paths (small graph)
  const IDS = Object.keys(NODE), IX = {}; IDS.forEach((id, i) => { IX[id] = i; });
  const N = IDS.length;
  const SPD = [], NEXT = [];
  for (let i = 0; i < N; i++) { SPD.push(new Array(N).fill(Infinity)); NEXT.push(new Array(N).fill(-1)); SPD[i][i] = 0; NEXT[i][i] = i; }
  EDGES.forEach((E) => { const a = IX[E.a], b = IX[E.b]; SPD[a][b] = SPD[b][a] = E.len; NEXT[a][b] = b; NEXT[b][a] = a; });
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (SPD[i][k] + SPD[k][j] < SPD[i][j]) { SPD[i][j] = SPD[i][k] + SPD[k][j]; NEXT[i][j] = NEXT[i][k]; }
  }
  const D = (a, b) => SPD[IX[a]][IX[b]];
  function pathIds(a, b) { const out = [a]; let i = IX[a]; const j = IX[b]; if (NEXT[i][j] < 0) return null; while (i !== j) { i = NEXT[i][j]; out.push(IDS[i]); } return out; }
  function buildRoute(a, b) {
    const ids = pathIds(a, b); if (!ids || ids.length < 2) return null;
    const cp = new T.CurvePath();
    for (let i = 0; i < ids.length - 1; i++) { const hop = ADJ[ids[i]].find((h) => h.to === ids[i + 1]); cp.add(hop.dir === 'fwd' ? hop.E.fwd : hop.E.rev); }
    return { curve: cp, len: cp.getLength(), ids };
  }

  // ---------- paths on the ground ----------
  const pathSamples = [];
  const blockers = [];
  const flagGeo = new T.CylinderGeometry(1, 1, 1, 6);
  const stepGeo = new T.CylinderGeometry(0.4, 0.3, 0.24, 7);
  const stepUnder = new T.ConeGeometry(0.3, 0.5, 6); stepUnder.rotateX(Math.PI);
  function flagstone(x, y, z, s) {
    const m = mesh(flagGeo, M.path, scene, x, y + 0.02, z);
    const k = s || rr(0.19, 0.28);
    m.scale.set(k, 0.07, k * rr(0.8, 1)); m.rotation.y = rr(0, Math.PI); m.receiveShadow = true;
  }
  const inPav = (p) => Math.hypot(p.x - PAV.x, p.z - PAV.z) < PAV_R + 0.1;
  EDGES.forEach((E) => {
    for (let i = 0; i <= 40; i++) { const p = E.fwd.getPointAt(i / 40); pathSamples.push([p.x, p.z]); }
    if (E.kind === 'path') {
      const n = Math.floor(E.len / 0.42);
      for (let i = 1; i < n; i++) {
        const d = i * 0.42; if (d < 0.25 || d > E.len - 0.25) continue;
        const p = E.fwd.getPointAt(d / E.len);
        if (inPav(p)) continue;
        p.x += rr(-0.1, 0.1); p.z += rr(-0.1, 0.1);
        flagstone(p.x, groundY(p), p.z);
      }
    } else if (E.kind === 'steps') {
      const n = Math.floor(E.len / 0.85);
      for (let i = 1; i < n; i++) {
        const p = E.fwd.getPointAt(i / n);
        if (islandUnder(p.x, p.z)) { flagstone(p.x, groundY(p), p.z); continue; }
        const s = mesh(stepGeo, M.stone, scene, p.x, p.y - 0.12, p.z); s.rotation.y = rr(0, 3); shadowy(s);
        const b = mesh(stepUnder, M.stoneDark, scene, p.x, p.y - 0.48, p.z); b.castShadow = true;
      }
    }
  });
  Object.values(NODE).forEach((n) => { if (n.island && !inPav(n.p)) flagstone(n.p.x, groundY(n.p), n.p.z, 0.3); });

  // ---------- bridges ----------
  const railPosts = [];
  function planksAlong(curve, opts) {
    const len = curve.getLength();
    const count = Math.max(2, Math.round(len / opts.spacing));
    const railL = [], railR = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const plank = new T.Mesh(opts.geo, opts.mat);
      plank.position.copy(p); plank.lookAt(p.clone().add(tan)); plank.rotation.z += rr(-0.03, 0.03);
      shadowy(plank); scene.add(plank);
      const lat = new T.Vector3(-tan.z, 0, tan.x).normalize();
      if (opts.rail) {
        railL.push(p.clone().addScaledVector(lat, opts.width / 2).add(new T.Vector3(0, opts.railH, 0)));
        railR.push(p.clone().addScaledVector(lat, -opts.width / 2).add(new T.Vector3(0, opts.railH, 0)));
        if (i % opts.postEvery === 0 || i === count) {
          [1, -1].forEach((s) => {
            const post = mesh(new T.CylinderGeometry(0.035, 0.04, opts.railH + 0.12, 5), M.woodDark, scene);
            post.position.copy(p).addScaledVector(lat, s * opts.width / 2); post.position.y += (opts.railH + 0.12) / 2 - 0.06; shadowy(post);
            railPosts.push({ top: post.position.clone().add(new T.Vector3(0, (opts.railH + 0.12) / 2, 0)), tan: tan.clone(), side: s });
          });
        }
      }
      if (opts.parapet && i % 2 === 0) {
        [1, -1].forEach((s) => {
          const b = mesh(new T.BoxGeometry(0.14, 0.26, 0.34), M.stone, scene);
          b.position.copy(p).addScaledVector(lat, s * (opts.width / 2 - 0.02)); b.position.y += 0.15;
          b.lookAt(b.position.clone().add(tan)); shadowy(b);
        });
      }
      if (opts.keel) { const k = mesh(opts.keel, M.stoneDark, scene); k.position.copy(p); k.position.y -= 0.26; k.lookAt(k.position.clone().add(tan)); shadowy(k); }
    }
    if (opts.rail) [railL, railR].forEach((r) => { const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(r), r.length * 3, 0.018, 4, false), M.rope); tube.castShadow = true; scene.add(tube); });
  }
  EDGES.forEach((E) => {
    if (E.kind === 'stoneBridge') planksAlong(E.fwd, { spacing: 0.32, geo: new T.BoxGeometry(1.05, 0.12, 0.3), mat: M.path, width: 1.12, parapet: true, keel: new T.BoxGeometry(0.8, 0.4, 0.34) });
    if (E.kind === 'timberStairs') planksAlong(E.fwd, { spacing: 0.27, geo: new T.BoxGeometry(1.0, 0.08, 0.22), mat: M.wood, width: 1.06, rail: true, railH: 0.62, postEvery: 4 });
    if (E.kind === 'ropeBridge') planksAlong(E.fwd, { spacing: 0.3, geo: new T.BoxGeometry(0.85, 0.06, 0.2), mat: M.wood, width: 0.9, rail: true, railH: 0.55, postEvery: 100 });
  });

  // ---------- props ----------
  const swayers = [];
  const P3 = (u, v, y) => W(u, v, y);
  const topOf = (u, v) => { const p = W(u, v, 9); const I = islandUnder(p.x, p.z); return I ? I.y : 0; };
  function limb(parent, a, b, r0, r1, m) {
    const dir = b.clone().sub(a); const len = dir.length();
    const geo = new T.CylinderGeometry(r1, r0, len, 7); geo.translate(0, len / 2, 0);
    const o = new T.Mesh(geo, m || M.wood); o.position.copy(a); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()); parent.add(o); return o;
  }
  function tree(u, v, s, palette, big) {
    const g = new T.Group(); g.position.copy(P3(u, v, topOf(u, v))); g.scale.setScalar(s); scene.add(g);
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const trunk = [V(0, 0, 0), V(0.12, 1.0, 0.05), V(0.32, 1.9, -0.1), V(0.18, 2.6, 0.18)];
    for (let i = 0; i < trunk.length - 1; i++) limb(g, trunk[i], trunk[i + 1], 0.42 - i * 0.1, 0.32 - i * 0.08);
    limb(g, V(0.3, 1.8, -0.1), V(1.2, 2.5, -0.4), 0.14, 0.07);
    limb(g, V(0.25, 1.6, 0.0), V(-0.8, 2.4, 0.4), 0.14, 0.07);
    [[0.6, 0.1], [-0.5, -0.3], [0.1, 0.6], [-0.2, 0.5]].forEach(([x, z]) => limb(g, V(0, 0.3, 0), V(x, -0.05, z), 0.16, 0.06));
    const crown = new T.Group(); g.add(crown);
    let blobs = [[0.2, 3.1, 0.2, 1.45], [-0.9, 2.75, 0.4, 1.05], [1.2, 2.7, -0.4, 1.1], [0.3, 2.85, -1.0, 1.0], [0.5, 3.6, 0.55, 0.9], [-0.4, 3.5, -0.5, 0.95], [1.0, 3.25, 0.85, 0.8], [-0.9, 3.2, -0.6, 0.7]];
    if (big) blobs = blobs.concat([[-1.4, 2.9, -0.2, 0.8], [1.6, 3.0, 0.3, 0.85], [0.0, 4.0, 0.0, 0.85], [0.6, 2.6, 1.2, 0.75]]);
    blobs.forEach(([x, y, z, r], i) => { const m = mesh(new T.IcosahedronGeometry(r, 1), mat(palette[i % palette.length]), crown, x, y, z); m.scale.y = 0.78; m.rotation.set(rr(0, 3), rr(0, 3), 0); });
    shadowy(g);
    swayers.push({ o: crown, ph: rr(0, 6), amp: big ? 0.008 : 0.012 });
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.9 * s });
    return g;
  }
  function pine(u, v, s, y) {
    const g = new T.Group(); g.position.copy(P3(u, v, y === undefined ? topOf(u, v) : y)); g.scale.setScalar(s); scene.add(g);
    mesh(new T.CylinderGeometry(0.06, 0.1, 0.6, 5), M.woodDark, g, 0, 0.3, 0);
    const tiers = new T.Group(); g.add(tiers);
    [[0.75, 1.0, 0.75], [0.6, 0.9, 1.3], [0.42, 0.8, 1.8], [0.25, 0.6, 2.2]].forEach(([r, h, yy], i) => { const c = mesh(new T.ConeGeometry(r, h, 7), i % 2 ? M.pine2 : M.pine, tiers, 0, yy, 0); c.rotation.y = rr(0, 3); });
    shadowy(g); swayers.push({ o: tiers, ph: rr(0, 6), amp: 0.018 });
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.75 * s });
  }
  function bush(u, v, s) {
    const m = mesh(new T.IcosahedronGeometry(s, 0), M.bush, scene); m.position.copy(P3(u, v, topOf(u, v) + s * 0.45)); m.scale.y = 0.7; m.rotation.y = rr(0, 3);
    blockers.push({ x: m.position.x, z: m.position.z, r: s + 0.05 }); shadowy(m);
  }
  function rockAt(x, y, z, s) { const m = mesh(new T.DodecahedronGeometry(s, 0), M.stoneDark, scene, x, y + s * 0.3, z); m.scale.y = 0.6; m.rotation.set(rr(0, 3), rr(0, 3), 0); m.castShadow = true; blockers.push({ x, z, r: s + 0.1 }); }
  function rock(u, v, s) { const p = P3(u, v, topOf(u, v)); rockAt(p.x, p.y, p.z, s); }
  function brokenPillar(u, v, h) {
    const g = new T.Group(); g.position.copy(P3(u, v, topOf(u, v))); scene.add(g);
    mesh(new T.BoxGeometry(0.7, 0.16, 0.7), M.stoneDark, g, 0, 0.08, 0);
    let yy = 0.16;
    while (yy < h) { const dh = Math.min(rr(0.36, 0.5), h - yy + 0.05); const d = mesh(new T.CylinderGeometry(0.25, 0.26, dh, 9), M.stone, g, rr(-0.03, 0.03), yy + dh / 2, rr(-0.03, 0.03)); d.rotation.y = rr(0, 3); yy += dh; }
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.55 }); shadowy(g);
  }
  const faceGroup = (g, fromUV) => { const f = P3(fromUV[0], fromUV[1], 0); g.rotation.y = Math.atan2(f.x - g.position.x, f.z - g.position.z); };

  // island A
  tree(-15.3, -3.0, 0.72, [0xe8d7d2, 0xdcc6c3, 0xefe3dc]);
  brokenPillar(-12.5, -1.8, 1.5); brokenPillar(-13.5, -2.0, 0.9); brokenPillar(-16.2, -6.9, 0.7);
  rock(-10.4, -6.0, 0.26); bush(-10.6, -4.8, 0.3);
  const stele = (function stele() {
    const g = new T.Group(); g.position.copy(P3(-11.2, -6.3, 0)); scene.add(g); faceGroup(g, [-11.8, -6.9]);
    mesh(new T.BoxGeometry(0.9, 0.14, 0.42), M.stoneDark, g, 0, 0.07, 0);
    const slab = mesh(new T.BoxGeometry(0.66, 1.15, 0.16), M.stone, g, 0, 0.71, 0); slab.rotation.z = 0.04;
    for (let i = 0; i < 5; i++) mesh(new T.BoxGeometry(rr(0.25, 0.45), 0.03, 0.01), M.stoneDark, g, 0, 1.0 - i * 0.11, 0.085);
    // a fine scale down the right edge of the face: barely visible until the traveller traces it (2nd visit)
    const ticks = [];
    for (let i = 0; i < 15; i++) { const long = i % 5 === 0; const tm = new T.MeshStandardMaterial({ color: 0x5f5b55, roughness: 1, emissive: 0xffd9a0, emissiveIntensity: 0 }); ticks.push(mesh(new T.BoxGeometry(long ? 0.11 : 0.07, 0.013, 0.008), tm, slab, 0.27 - (long ? 0.02 : 0), -0.5 + i * 0.07, 0.083)); }
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.5 }); shadowy(g);
    return { g, slab, ticks };
  })();

  // island B
  const bigTree = tree(0.5, 2.3, 1.35, [0x7b966b, 0x6d8a62, 0x88a178, 0x62805b], true);
  // ---- "someone rested here before you" (core plan §46.6-01) ----
  // Low-key traces beside the big tree, readable in a close-up, almost invisible in the full view:
  // a patch of flattened grass, a bedroll tied the same way as the traveller's, a folded note under a
  // stone and tally marks cut into the trunk. Built without rnd() so the rest of the Area is unchanged.
  const TRACE = (function () {
    const c = bigTree.position;
    const L = new T.Vector3(-Math.SQRT1_2, 0, Math.SQRT1_2), C = new T.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);
    const at = (l, f) => { const p = c.clone().addScaledVector(L, l).addScaledVector(C, f); const u = (p.x - p.z) * Math.SQRT1_2, v = -(p.x + p.z) * Math.SQRT1_2; p.y = topOf(u, v); return p; };
    const patchP = at(1.35, 0.12);
    const patch = new T.Group(); patch.position.copy(patchP); patch.rotation.y = Math.atan2(L.x, L.z) + 0.25; scene.add(patch);
    // soft-edged, only a little paler than the meadow: pressed grass, not a painted mark
    const soft = (function () {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#bbb'); gr.addColorStop(1, '#000');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(cv);
    })();
    const flatMat = new T.MeshStandardMaterial({ color: 0x9ea577, roughness: 1, transparent: true, alphaMap: soft, opacity: 0.95, depthWrite: false });
    const flat = mesh(new T.PlaneGeometry(1.1, 0.5), flatMat, patch, 0, 0.015, 0); flat.rotation.x = -Math.PI / 2; flat.receiveShadow = true;
    const bladeMat = mat(0x9ea57c);
    for (let i = 0; i < 9; i++) { const b = mesh(new T.BoxGeometry(0.18, 0.006, 0.018), bladeMat, patch, -0.3 + i * 0.075, 0.02, ((i * 37) % 9) / 9 * 0.24 - 0.12); b.rotation.y = 0.12 * Math.sin(i * 1.7); }
    blockers.push({ x: patchP.x, z: patchP.z, r: 0.5 });
    const roll = new T.Group(); roll.position.copy(at(0.95, -0.25)); roll.rotation.y = Math.atan2(L.x, L.z) + 1.2; scene.add(roll);
    mesh(new T.CylinderGeometry(0.075, 0.075, 0.36, 9), mat(0x7d6c58), roll, 0, 0.075, 0).rotation.z = Math.PI / 2;
    [-0.1, 0.1].forEach((x) => { const t = mesh(new T.TorusGeometry(0.078, 0.009, 4, 12), mat(0x4e4034), roll, x, 0.075, 0); t.rotation.y = Math.PI / 2; });
    mesh(new T.BoxGeometry(0.14, 0.1, 0.08), mat(0x6d6150), roll, 0.02, 0.05, 0.13).rotation.y = 0.2;
    shadowy(roll); blockers.push({ x: roll.position.x, z: roll.position.z, r: 0.3 });
    const noteP = at(1.6, 0.8);
    const note = mesh(new T.BoxGeometry(0.13, 0.006, 0.09), mat(0xe9e0cb), scene, noteP.x, noteP.y + 0.012, noteP.z); note.rotation.y = 0.7;
    const stone = mesh(new T.DodecahedronGeometry(0.07, 0), M.stoneDark, scene, noteP.x + 0.02, noteP.y + 0.04, noteP.z - 0.01); stone.scale.y = 0.6; stone.castShadow = true;
    blockers.push({ x: noteP.x, z: noteP.z, r: 0.18 });
    // tally marks cut into the trunk, above the traveller's head, on the face turned toward the view
    // (tree-local; the trunk axis at y 1.15 sits near x 0.15, z 0.03 and its radius is about 0.31)
    const cut = mat(0x3f3127);
    const marksG = new T.Group(); marksG.position.set(0.248, 1.15, 0.31); marksG.rotation.y = 0.32; bigTree.add(marksG);
    // a date cut into the bark with four tally marks under it (clue c01_bark_date; the actual date is
    // set together with core 07's seed pod, placeholder here)
    const dc = document.createElement('canvas'); dc.width = 128; dc.height = 96; const dx = dc.getContext('2d');
    dx.font = '700 34px Georgia, "Noto Serif TC", serif'; dx.textAlign = 'center';
    dx.fillStyle = 'rgba(214,190,150,0.55)'; dx.fillText('11·02', 65, 42);
    dx.fillStyle = 'rgba(52,38,28,0.95)'; dx.fillText('11·02', 64, 40);
    dx.strokeStyle = 'rgba(52,38,28,0.95)'; dx.lineWidth = 4; dx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { dx.beginPath(); dx.moveTo(40 + i * 14, 56); dx.lineTo(42 + i * 14, 84); dx.stroke(); }
    const dateMesh = mesh(new T.PlaneGeometry(0.3, 0.225), new T.MeshStandardMaterial({ map: new T.CanvasTexture(dc), transparent: true, roughness: 1, depthWrite: false }), marksG, 0, 0, 0.012);
    dateMesh.userData.noCloud = true;
    // where the traveller looks when it notices them (uv), and the Area point it kneels toward
    const look = patchP.clone().lerp(noteP, 0.35);
    return { lookUV: [(look.x - look.z) * Math.SQRT1_2, -(look.x + look.z) * Math.SQRT1_2], patch: patchP, roll: roll.position, date: dateMesh };
  })();
  pine(-1.5, 6.6, 1.0); pine(1.4, 6.9, 0.85); pine(3.4, 5.8, 0.9); pine(-5.9, 2.9, 0.9);
  bush(-2.4, 4.3, 0.3); bush(-6.0, 1.9, 0.26); bush(5.6, 1.0, 0.3);
  rock(-4.1, 3.0, 0.2); rock(4.6, -0.4, 0.2);
  const chest = (function () {
    const g = new T.Group(); g.position.copy(P3(-3.4, 3.6, 0.72)); scene.add(g); faceGroup(g, [-2.9, 2.8]); g.rotation.z = 0.08;
    mesh(new T.BoxGeometry(0.52, 0.28, 0.36), M.woodDark, g, 0, 0.14, 0);
    mesh(new T.BoxGeometry(0.54, 0.04, 0.37), M.brass, g, 0, 0.2, 0);
    const lid = new T.Group(); lid.position.set(0, 0.28, -0.18); g.add(lid);
    mesh(new T.BoxGeometry(0.52, 0.12, 0.36), M.wood, lid, 0, 0.06, 0.18);
    mesh(new T.BoxGeometry(0.08, 0.08, 0.02), M.brass, lid, 0, 0.02, 0.37);
    mesh(new T.DodecahedronGeometry(0.2, 0), M.earth || M.stoneDark, g, 0.28, 0.02, 0.1).scale.y = 0.4;
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.45 }); shadowy(g);
    return { g, lid, open: 0 };
  })();
  const well = (function well() {
    const g = new T.Group(); g.position.copy(P3(0.5, -3.45, 0.8)); scene.add(g); faceGroup(g, [1.3, -3.2]);
    const ring = mesh(new T.CylinderGeometry(0.46, 0.5, 0.55, 12, 1, true), mat(0xa39d91, { side: T.DoubleSide }), g, 0, 0.27, 0);
    mesh(new T.TorusGeometry(0.47, 0.065, 5, 14), M.stone, g, 0, 0.55, 0).rotation.x = Math.PI / 2;
    mesh(new T.CircleGeometry(0.44, 14), M.dark, g, 0, 0.3, 0).rotation.x = -Math.PI / 2;
    [-1, 1].forEach((s) => mesh(new T.BoxGeometry(0.08, 1.1, 0.08), M.woodDark, g, s * 0.56, 0.55, 0));
    mesh(new T.CylinderGeometry(0.035, 0.035, 1.2, 6), M.wood, g, 0, 1.05, 0).rotation.z = Math.PI / 2;
    [-1, 1].forEach((s) => { const r = mesh(new T.BoxGeometry(1.35, 0.05, 0.42), M.roof, g, 0, 1.22, s * 0.17); r.rotation.x = s * 0.55; });
    const rope = mesh(new T.CylinderGeometry(0.006, 0.006, 1, 3), M.rope, g, 0, 0.9, 0);
    const bucket = mesh(new T.CylinderGeometry(0.09, 0.07, 0.13, 8), M.wood, g, 0, 0.72, 0);
    const setRope = () => { const top = 1.05, bot = bucket.position.y + 0.065; rope.scale.y = Math.max(0.01, top - bot); rope.position.y = (top + bot) / 2; };
    setRope();
    ring.castShadow = true;
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.7 }); shadowy(g);
    return { g, bucket, setRope };
  })();
  (function arch() {
    const E = EDGES.find((e) => (e.a === 'b_e' && e.b === 'b_arch'));
    const E2 = EDGES.find((e) => (e.a === 'b_arch' && e.b === 'b_ne'));
    const dir = NODE.b_ne.p.clone().sub(NODE.b_e.p).normalize();
    const p = NODE.b_arch.p;
    const g = new T.Group(); g.position.set(p.x, 0.8, p.z); g.rotation.y = Math.atan2(dir.x, dir.z); scene.add(g);
    const R = 1.1, H = 1.55;
    [-1, 1].forEach((s) => {
      mesh(new T.BoxGeometry(0.62, 0.18, 0.62), M.stoneDark, g, s * R, 0.09, 0);
      let y = 0.18;
      while (y < H - 0.01) { const b = mesh(new T.BoxGeometry(0.44 + rr(-0.03, 0.03), 0.34, 0.46), M.stone, g, s * R + rr(-0.025, 0.025), y + 0.17, rr(-0.02, 0.02)); b.rotation.y = rr(-0.05, 0.05); y += 0.345; }
      const wp = new T.Vector3(s * R, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), g.rotation.y).add(g.position);
      blockers.push({ x: wp.x, z: wp.z, r: 0.5 });
    });
    for (let i = 0; i <= 8; i++) { if (i === 6) continue; const a = (Math.PI * i) / 8; const b = mesh(new T.BoxGeometry(0.42, 0.36, 0.46), M.stone, g, Math.cos(a) * R, H + 0.17 + Math.sin(a) * R, 0); b.rotation.z = a + Math.PI / 2; }
    for (let i = 0; i < 6; i++) { const a = rr(0.35, 2.8), len = rr(0.35, 0.9); const geo = new T.BoxGeometry(0.06, len, 0.02); geo.translate(0, -len / 2, 0); const vine = mesh(geo, M.vine, g, Math.cos(a) * (R - 0.2), H + Math.sin(a) * (R - 0.2), rr(-0.15, 0.15)); roots.push({ m: vine, ph: rr(0, 6), bx: 0, bz: 0 }); }
    const f = mesh(new T.BoxGeometry(0.42, 0.36, 0.46), M.stone, g, 1.8, 0.16, 0.8); f.rotation.set(0.1, 0.6, 1.2);
    shadowy(g); void E; void E2;
  })();
  (function sign() {
    const g = new T.Group(); g.position.copy(P3(4.45, -1.45, 0.8)); scene.add(g);
    mesh(new T.BoxGeometry(0.07, 0.9, 0.07), M.woodDark, g, 0, 0.45, 0);
    const board = mesh(new T.BoxGeometry(0.5, 0.16, 0.04), M.wood, g, 0.16, 0.76, 0);
    g.rotation.y = Math.atan2(NODE.d_in.p.x - NODE.b_rope.p.x, NODE.d_in.p.z - NODE.b_rope.p.z) - Math.PI / 2; board.rotation.z = -0.06;
    shadowy(g);
  })();

  // island E: astrolabe
  const astro = (function () {
    const g = new T.Group(); g.position.copy(P3(-9.7, 10.3, 2.0)); scene.add(g);
    mesh(new T.CylinderGeometry(0.62, 0.7, 0.14, 10), M.stoneDark, g, 0, 0.07, 0);
    mesh(new T.CylinderGeometry(0.2, 0.3, 0.75, 8), M.stone, g, 0, 0.5, 0);
    const head = new T.Group(); head.position.y = 1.35; g.add(head);
    const rings = [0.56, 0.45, 0.35].map((r, i) => { const t = mesh(new T.TorusGeometry(r, 0.028, 6, 36), M.brass, head); t.rotation.set(i * 0.9 + 0.3, i * 0.6, 0); return t; });
    const hub = mesh(new T.SphereGeometry(0.08, 10, 8), M.brass, head);
    mesh(new T.CylinderGeometry(0.012, 0.012, 1.3, 4), M.brass, head).rotation.z = 0.4;
    // After the core has gone to the Archive, later visits show an empty brass cradle where it sat.
    const cradle = new T.Group(); cradle.visible = false; head.add(cradle);
    mesh(new T.TorusGeometry(0.075, 0.012, 5, 18), M.brass, cradle).rotation.x = Math.PI / 2;
    [0, 2.09, 4.19].forEach((a) => { const prong = mesh(new T.BoxGeometry(0.012, 0.07, 0.012), M.brass, cradle, Math.cos(a) * 0.07, 0.03, Math.sin(a) * 0.07); prong.rotation.z = Math.cos(a) * 0.35; prong.rotation.x = -Math.sin(a) * 0.35; });
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.75 }); shadowy(g);
    return { rings, head, hub, cradle, boost: 0, align: 0, taken: false };
  })();
  pine(-10.6, 11.6, 0.9); pine(-8.0, 11.7, 0.75);

  // island C: pavilion, bench, telescope
  (function pavilion() {
    const g = new T.Group(); g.position.copy(PAV); scene.add(g);
    const enter = W(1.3, 1.05, 0).normalize(); const face = Math.atan2(enter.x, enter.z);
    const base = mesh(new T.CylinderGeometry(PAV_R, PAV_R + 0.05, PAV_H, 6), M.stoneDark, g, 0, PAV_H / 2, 0); base.rotation.y = face;
    const pillarGeo = new T.CylinderGeometry(0.075, 0.085, 1.6, 7);
    for (let k = 0; k < 6; k++) { const a = face + Math.PI / 6 + (k * Math.PI) / 3; mesh(pillarGeo, M.pillar, g, Math.sin(a) * 1.28, PAV_H + 0.8, Math.cos(a) * 1.28); }
    const ring = mesh(new T.CylinderGeometry(1.4, 1.4, 0.13, 6, 1, true), M.pillar, g, 0, PAV_H + 1.64, 0); ring.rotation.y = face + Math.PI / 6;
    const roof = mesh(new T.ConeGeometry(2.1, 0.95, 6), M.roof, g, 0, PAV_H + 2.18, 0); roof.rotation.y = face + Math.PI / 6;
    mesh(new T.SphereGeometry(0.09, 8, 6), M.hat, g, 0, PAV_H + 2.72, 0);
    shadowy(g); blockers.push({ x: PAV.x, z: PAV.z, r: PAV_R + 0.1, kind: 'walkable-platform' });
  })();
  const VIEW_FACE = Math.atan2(W(0, -1, 0).x, W(0, -1, 0).z);
  (function bench() {
    const p = NODE.c_pav.p.clone().add(new T.Vector3(-Math.sin(VIEW_FACE) * 0.12, PAV_H, -Math.cos(VIEW_FACE) * 0.12));
    const g = new T.Group(); g.position.copy(p); g.rotation.y = VIEW_FACE; scene.add(g);
    mesh(new T.BoxGeometry(0.9, 0.07, 0.3), M.wood, g, 0, 0.4, -0.05);
    [-1, 1].forEach((s) => mesh(new T.BoxGeometry(0.08, 0.38, 0.24), M.woodDark, g, s * 0.36, 0.19, -0.05));
    shadowy(g);
  })();
  (function telescope() {
    const g = new T.Group(); g.position.copy(P3(14.5, 6.9, 3.4)); scene.add(g);
    const out = P3(20, 2, 0); g.rotation.y = Math.atan2(out.x - g.position.x, out.z - g.position.z);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; limb(g, new T.Vector3(Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32), new T.Vector3(0, 0.95, 0), 0.02, 0.018, M.woodDark); }
    const tube = mesh(new T.CylinderGeometry(0.05, 0.075, 0.95, 10), M.brass, g, 0, 1.02, 0.05); tube.rotation.x = Math.PI / 2 - 0.35;
    shadowy(g); blockers.push({ x: g.position.x, z: g.position.z, r: 0.45 });
  })();
  pine(14.8, 9.8, 0.8);
  [[15.2, 11.6], [16.3, 10.9]].forEach(([u, v]) => { const m = mesh(new T.BoxGeometry(0.22, 0.6, 0.22), M.stone, scene); m.position.copy(W(u, v, 3.7)); shadowy(m); });

  // island D: shrine, pines
  const shrine = (function () {
    const g = new T.Group(); g.position.copy(P3(13.0, -5.7, 0.2)); scene.add(g); faceGroup(g, [12.5, -6.2]);
    mesh(new T.BoxGeometry(0.62, 0.12, 0.52), M.stoneDark, g, 0, 0.06, 0);
    mesh(new T.BoxGeometry(0.42, 0.4, 0.34), M.stone, g, 0, 0.32, 0);
    mesh(new T.BoxGeometry(0.18, 0.22, 0.02), M.dark, g, 0, 0.3, 0.175);
    const r = mesh(new T.ConeGeometry(0.42, 0.26, 4), M.roof, g, 0, 0.65, 0); r.rotation.y = Math.PI / 4;
    shadowy(g); blockers.push({ x: g.position.x, z: g.position.z, r: 0.45 });
    return { g, pebbles: [] };
  })();
  // Keep the pine beside the exit walk, leaving enough room for the traveller to pass its trunk.
  pine(13.9, -7.3, 0.95); pine(11.2, -5.3, 0.8); pine(12.7, -9.6, 0.75);

  // ---------- signs of life: cloth in the wind, a hut, a campfire, incense ----------
  const clothUniforms = [];          // { gust, pos } per cloth piece, driven by the gust wave
  const SMOKE_SOURCES = [];          // { pos, kind }
  function clothMaterial(color) {
    const m = new T.MeshStandardMaterial({ color, roughness: 1, side: T.DoubleSide });
    const u = { gust: { value: 0 }, seed: { value: rr(0, 6.28) } };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = timeU; sh.uniforms.uGust = u.gust; sh.uniforms.uSeed = u.seed;
      sh.vertexShader = 'uniform float uTime;\nuniform float uGust;\nuniform float uSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'float hang = clamp(1.0 - uv.y, 0.0, 1.0);',
        'float wave = sin(uTime * 2.6 + position.x * 7.0 + position.y * 3.0 + uSeed) * 0.5 + sin(uTime * 4.3 + position.y * 9.0 + uSeed * 1.7) * 0.25;',
        'transformed.z += hang * (wave * (0.05 + uGust * 0.06) + uGust * 0.3 * hang);',
        'transformed.x += hang * uGust * 0.05 * sin(uTime * 5.0 + position.y * 6.0 + uSeed);'
      ].join('\n'));
    };
    m.customProgramCacheKey = () => 'cloth';
    return { m, u };
  }
  function hangCloth(at, alongDir, w, h, color, segW, segH) {
    const geo = new T.PlaneGeometry(w, h, segW || 6, segH || 8); geo.translate(0, -h / 2, 0);
    const { m, u } = clothMaterial(color);
    const c = new T.Mesh(geo, m); c.position.copy(at);
    c.rotation.y = Math.atan2(-alongDir.z, alongDir.x);
    c.castShadow = true; c.receiveShadow = true; scene.add(c);
    clothUniforms.push({ u, pos: at.clone() });
    return c;
  }
  // a drying line with a cloak on island A
  (function laundry() {
    const a = P3(-14.25, -8.05, 0), b = P3(-12.95, -7.35, 0);
    [a, b].forEach((q) => { mesh(new T.CylinderGeometry(0.035, 0.045, 1.2, 6), M.woodDark, scene, q.x, 0.6, q.z).castShadow = true; blockers.push({ x: q.x, z: q.z, r: 0.25 }); });
    const top = (q) => q.clone().setY(1.15);
    const mid = top(a).lerp(top(b), 0.5); mid.y -= 0.08;
    scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([top(a), mid, top(b)]), 16, 0.009, 4, false), M.rope));
    const dir = b.clone().sub(a).normalize();
    hangCloth(top(a).lerp(top(b), 0.42).setY(1.08), dir, 0.46, 0.62, 0x4a5670);
    hangCloth(top(a).lerp(top(b), 0.78).setY(1.1), dir, 0.24, 0.3, 0xd9cfbd, 4, 5);
    blockers.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, r: 0.5 });
  })();
  // a string of small pennants from the pavilion eave to a pole
  (function pennants() {
    const pole = P3(9.95, 8.75, 3.4);
    mesh(new T.CylinderGeometry(0.035, 0.05, 2.3, 6), M.woodDark, scene, pole.x, 3.4 + 1.15, pole.z).castShadow = true;
    blockers.push({ x: pole.x, z: pole.z, r: 0.25 });
    const eave = PAV.clone(); const d = pole.clone().sub(PAV).setY(0).normalize();
    eave.addScaledVector(d, 1.35); eave.y = PAV.y + PAV_H + 1.72;
    const tip = pole.clone(); tip.y = 3.4 + 2.25;
    const mid = eave.clone().lerp(tip, 0.5); mid.y -= 0.35;
    const rope = new T.CatmullRomCurve3([eave, mid, tip]);
    scene.add(new T.Mesh(new T.TubeGeometry(rope, 20, 0.008, 4, false), M.rope));
    const colors = [0xb7924f, 0x8e4f42, 0x4f5d78, 0xd8cdb7, 0x6d7f5c];
    const n = 9;
    for (let i = 1; i <= n; i++) {
      const at = rope.getPointAt(i / (n + 1)); const tg = rope.getTangentAt(i / (n + 1));
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute([-0.08, 0, 0, 0.08, 0, 0, 0, -0.22, 0], 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
      geo.computeVertexNormals();
      const { m, u } = clothMaterial(colors[i % colors.length]);
      const f = new T.Mesh(geo, m); f.position.copy(at); f.rotation.y = Math.atan2(-tg.z, tg.x); f.castShadow = true; scene.add(f);
      clothUniforms.push({ u, pos: at.clone() });
    }
  })();
  // a lived-in hut on the pine island, window lit toward evening, smoke from the chimney
  const hut = (function () {
    const g = new T.Group(); g.position.copy(P3(13.9, -6.6, 0.2)); g.rotation.y = VIEW_FACE; scene.add(g);
    mesh(new T.BoxGeometry(1.15, 0.1, 0.92), M.stoneDark, g, 0, 0.05, 0);
    mesh(new T.BoxGeometry(1.0, 0.72, 0.78), mat(0xa89f90), g, 0, 0.46, 0);
    [-1, 1].forEach((s) => { const r = mesh(new T.BoxGeometry(1.22, 0.06, 0.56), M.roof, g, 0, 0.98, s * 0.2); r.rotation.x = s * 0.62; });
    mesh(new T.BoxGeometry(0.24, 0.44, 0.03), M.woodDark, g, -0.22, 0.32, 0.4);
    const windowMat = new T.MeshStandardMaterial({ color: 0x2b2620, emissive: 0xffb45e, emissiveIntensity: 0, roughness: 1 });
    windowMat.userData.noCloud = true;
    mesh(new T.BoxGeometry(0.24, 0.2, 0.02), windowMat, g, 0.24, 0.52, 0.4);
    mesh(new T.BoxGeometry(0.28, 0.03, 0.03), M.woodDark, g, 0.24, 0.41, 0.41);
    mesh(new T.BoxGeometry(0.14, 0.4, 0.14), M.stoneDark, g, 0.3, 1.12, -0.22);
    shadowy(g);
    const light = new T.PointLight(0xffb05a, 0, 2.6, 2); light.position.set(0.24, 0.52, 0.7); g.add(light);
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.85 });
    SMOKE_SOURCES.push({ pos: g.localToWorld(new T.Vector3(0.3, 1.36, -0.22)), kind: 'chimney' });
    return { g, windowMat, light };
  })();
  // a small campfire on the star island
  const campfire = (function () {
    const c = P3(-10.25, 8.15, 2.0);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; rockAt(c.x + Math.cos(a) * 0.24, 2.0, c.z + Math.sin(a) * 0.24, 0.07); }
    for (let i = 0; i < 3; i++) { const l = mesh(new T.CylinderGeometry(0.03, 0.03, 0.34, 5), M.woodDark, scene, c.x, 2.05, c.z); l.rotation.set(Math.PI / 2 - 0.25, (i / 3) * Math.PI * 2, 0); }
    const flameMat = new T.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    const flameMat2 = new T.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
    const f1 = mesh(new T.ConeGeometry(0.1, 0.3, 6), flameMat, scene, c.x, 2.2, c.z);
    const f2 = mesh(new T.ConeGeometry(0.055, 0.2, 6), flameMat2, scene, c.x + 0.03, 2.17, c.z - 0.02);
    const light = new T.PointLight(0xff9a48, 0.6, 4, 2); light.position.set(c.x, 2.4, c.z); scene.add(light);
    blockers.push({ x: c.x, z: c.z, r: 0.45 });
    SMOKE_SOURCES.push({ pos: new T.Vector3(c.x, 2.4, c.z), kind: 'campfire' });
    return { f1, f2, light };
  })();
  // incense in front of the shrine
  (function incense() {
    const g = shrine.g;
    const stick = mesh(new T.CylinderGeometry(0.006, 0.006, 0.16, 4), M.woodDark, g, 0.05, 0.13, 0.36); stick.rotation.x = 0.12;
    const emberMat = new T.MeshBasicMaterial({ color: 0xff7a3a }); emberMat.userData = { noCloud: true };
    mesh(new T.SphereGeometry(0.012, 5, 4), emberMat, g, 0.05, 0.21, 0.37);
    SMOKE_SOURCES.push({ pos: g.localToWorld(new T.Vector3(0.05, 0.22, 0.37)), kind: 'incense' });
  })();
  // ribbons tied to a few bridge posts
  railPosts.forEach((rp, i) => {
    if (i % 3 !== 0) return;
    hangCloth(rp.top.clone().add(new T.Vector3(0, -0.02, 0)), rp.tan, 0.07, 0.42, i % 2 ? 0x9a5a4a : 0xb89a5a, 1, 6);
  });
  FAR_ISLANDS.forEach((I, i) => { for (let k = 0; k <= i % 2; k++) pine(I.u + rr(-I.r * 0.4, I.r * 0.4), I.v + rr(-I.r * 0.3, I.r * 0.3), rr(0.9, 1.3), I.y); });

  // ---------- lanterns ----------
  const haloTex = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,205,140,1)'); g.addColorStop(0.35, 'rgba(255,180,100,0.35)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  })();
  const lamps = AREA.lamps.map((L) => {
    const [u, v] = L.prop;
    const g = new T.Group(); g.position.copy(P3(u, v, topOf(u, v))); scene.add(g);
    const st = M.lampStone;
    mesh(new T.BoxGeometry(0.42, 0.14, 0.42), st, g, 0, 0.07, 0);
    mesh(new T.BoxGeometry(0.3, 0.08, 0.3), st, g, 0, 0.18, 0);
    mesh(new T.CylinderGeometry(0.065, 0.075, 0.5, 6), st, g, 0, 0.47, 0);
    mesh(new T.BoxGeometry(0.34, 0.06, 0.34), st, g, 0, 0.75, 0);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => mesh(new T.BoxGeometry(0.05, 0.26, 0.05), st, g, a * 0.12, 0.91, b * 0.12));
    const glowMat = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 0, roughness: 1 });
    mesh(new T.BoxGeometry(0.19, 0.22, 0.19), glowMat, g, 0, 0.91, 0);
    const roof = mesh(new T.ConeGeometry(0.31, 0.2, 4), st, g, 0, 1.14, 0); roof.rotation.y = Math.PI / 4;
    mesh(new T.SphereGeometry(0.045, 6, 5), st, g, 0, 1.27, 0);
    g.rotation.y = rr(-0.3, 0.3); shadowy(g);
    const light = new T.PointLight(0xffb05a, 0, 5.5, 2); light.position.set(0, 0.95, 0); g.add(light);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
    halo.scale.set(1.5, 1.5, 1); halo.position.set(0, 0.92, 0); g.add(halo);
    blockers.push({ x: g.position.x, z: g.position.z, r: 0.35 });
    return { g, glowMat, light, halo, level: 0 };
  });

  const timeU = { value: 0 };
  const swayU = { value: 0.55 * MOTION };

  // ---------- sea of clouds ----------
  const noiseGLSL = [
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }'
  ].join('\n');
  const cloudVS = 'varying vec3 vW; varying float vDepth; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }';
  const skyU = { uSkyTop: { value: new T.Color(0x9dbbd6) }, uGlowCol: { value: new T.Color(0xfff1d6) }, uGlowPos: { value: new T.Vector2(0.84, 0.95) }, uGlowStr: { value: 0.4 }, uRes: { value: new T.Vector2(1, 1) } };
  const cloudUniforms = (alpha, scale, speed) => ({ ...skyU, uTime: timeU, uLight: { value: new T.Color(0xe2c4b6) }, uShade: { value: new T.Color(0x6a7089) }, uFog: { value: new T.Color(0x6d7488) }, uNear: { value: 86 }, uFar: { value: 112 }, uAlpha: { value: alpha }, uScale: { value: scale }, uSpeed: { value: speed * MOTION } });
  const HEAD = 'uniform float uTime, uNear, uFar, uAlpha, uScale, uSpeed, uGlowStr; uniform vec3 uLight, uShade, uFog, uSkyTop, uGlowCol; uniform vec2 uRes, uGlowPos; varying vec3 vW; varying float vDepth;\n' +
    'vec3 skyAt(){ vec2 s = gl_FragCoord.xy / uRes; float asp = uRes.x / max(uRes.y, 1.0); vec3 c = mix(uFog, uSkyTop, smoothstep(0.38, 1.0, s.y)); float d = distance(s * vec2(asp, 1.0), uGlowPos * vec2(asp, 1.0)); return mix(c, uGlowCol, clamp(exp(-d * d * 4.5) * uGlowStr, 0.0, 1.0)); }';
  const seaMat = new T.ShaderMaterial({ uniforms: cloudUniforms(1, 0.05, 1), vertexShader: cloudVS, fragmentShader: [HEAD, noiseGLSL,
    'void main(){ vec2 p = vW.xz * uScale; float t = uTime * uSpeed;',
    '  float n = fbm(p + vec2(t * 0.012, t * 0.005)); float n2 = fbm(p * 2.6 - vec2(t * 0.02, 0.0));',
    '  float c = smoothstep(0.32, 0.78, n * 0.75 + n2 * 0.35);',
    '  vec3 col = mix(uShade, uLight, c); float f = smoothstep(uNear, uFar, vDepth);',
    '  gl_FragColor = vec4(mix(col, skyAt(), f), 1.0); }'].join('\n') });
  const sea = new T.Mesh(new T.PlaneGeometry(420, 420), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.y = -9; scene.add(sea);
  const wispMat = new T.ShaderMaterial({ uniforms: cloudUniforms(0.45, 0.07, 1.6), transparent: true, depthWrite: false, vertexShader: cloudVS, fragmentShader: [HEAD, noiseGLSL,
    'void main(){ vec2 p = vW.xz * uScale; float t = uTime * uSpeed;',
    '  float n = fbm(p + vec2(t * 0.02, -t * 0.006)); float a = smoothstep(0.48, 0.78, n) * uAlpha;',
    '  float f = smoothstep(uNear, uFar, vDepth); vec3 col = mix(uLight, skyAt(), f * 0.8);',
    '  gl_FragColor = vec4(col, a * (1.0 - f * 0.6)); }'].join('\n') });
  const wisps = new T.Mesh(new T.PlaneGeometry(420, 420), wispMat); wisps.rotation.x = -Math.PI / 2; wisps.position.y = -4.2; scene.add(wisps);
  const puffMat = new T.MeshStandardMaterial({ color: 0xe2c4b6, roughness: 1, transparent: true, opacity: 0.82, depthWrite: false });
  const puffs = [[-6, -10.5, -2.6, 0.18], [8, -12.5, -3.2, 0.12], [-22, 2, -2.6, 0.15], [19, 2, -2.2, 0.1], [-10, -14, -1.4, 0.2], [24, 12, 0.2, 0.08], [-1, 13, -3.4, 0.12]].map(([u, v, y, sp]) => {
    const g = new T.Group(); const n = 5 + Math.floor(rr(0, 4));
    for (let i = 0; i < n; i++) { const b = mesh(new T.IcosahedronGeometry(rr(0.6, 1.35), 3), puffMat, g, rr(-1.9, 1.9), rr(0, 0.5), rr(-0.9, 0.9)); b.scale.y = 0.55; }
    g.userData = { u, v, y, sp }; scene.add(g); return g;
  });

  // ---------- lake, stream, waterfall ----------
  const LAKE_UV = [-2.5, -2.3];
  const lakePos = P3(LAKE_UV[0], LAKE_UV[1], 0.8);
  const lakeR = (a) => 1.85 * (1 + 0.1 * Math.sin(2 * a + 0.6) + 0.05 * Math.sin(3 * a + 2.1));
  const OUT_A = Math.atan2(-5.5 - LAKE_UV[1], -2.25 - LAKE_UV[0]); // outflow angle in (u, v)
  const SPILL_HALF = 0.34;
  let SPILL = null; // filled once the island edge (lip) is known
  const lakeWorld = (a, k, extra) => {
    const r = lakeR(a) * k; const du = Math.cos(a) * r, dv = Math.sin(a) * r;
    let x = (du - dv) * S, z = -(du + dv) * S;
    if (SPILL) {
      const along = x * SPILL.ax + z * SPILL.az, lat = x * -SPILL.az + z * SPILL.ax;
      const hw = SPILL_HALF + (extra || 0);
      if (along > 0) {
        const t = Math.min(1, Math.max(0, (hw - Math.abs(lat)) / (hw * 0.45)));
        const t2 = t * t * (3 - 2 * t);
        const na = along + (SPILL.len - along) * t2;
        x = na * SPILL.ax + lat * -SPILL.az; z = na * SPILL.az + lat * SPILL.ax;
      }
    }
    return new T.Vector2(x, z);
  };
  const LIP = (function () {
    const I = islandById.B; const t = W(-2.25, -5.5, 0);
    const dx = t.x - I.x, dz = t.z - I.z; const a = Math.atan2(dz, dx); const len = Math.hypot(dx, dz);
    const r = I.r * I.rf(a) - 0.02;
    return { p: new T.Vector3(I.x + (dx / len) * r, 0.8, I.z + (dz / len) * r), out: new T.Vector3(dx / len, 0, dz / len) };
  })();
  (function () {
    const dx = LIP.p.x - lakePos.x, dz = LIP.p.z - lakePos.z, len = Math.hypot(dx, dz);
    SPILL = { ax: dx / len, az: dz / len, len: len + 0.03 };
  })();
  let lakeWater;
  const waterMats = [];
  (function lake() {
    const shape = (k) => { const sh = new T.Shape(); for (let i = 0; i <= 220; i++) { const w = lakeWorld((i / 220) * Math.PI * 2, k, k > 1 ? 0.08 : 0); if (i === 0) sh.moveTo(w.x, -w.y); else sh.lineTo(w.x, -w.y); } return sh; };
    const shore = new T.Mesh(new T.ShapeGeometry(shape(1.1)), mat(0x5f5646));
    shore.rotation.x = -Math.PI / 2; shore.position.set(lakePos.x, 0.806, lakePos.z); shore.receiveShadow = true; scene.add(shore);
    lakeWater = new T.Mesh(new T.ShapeGeometry(shape(1.0)), new T.MeshStandardMaterial({ color: COL.water, roughness: 0.1, metalness: 0.35 }));
    lakeWater.rotation.x = -Math.PI / 2; lakeWater.position.set(lakePos.x, 0.822, lakePos.z); lakeWater.receiveShadow = true; scene.add(lakeWater);
    // rim stones, leaving a gap where the water spills out
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rr(-0.08, 0.08);
      const w = lakeWorld(a, 1.07, 0.1);
      const along = w.x * SPILL.ax + w.y * SPILL.az, lat = w.x * -SPILL.az + w.y * SPILL.ax;
      if (along > 0 && Math.abs(lat) < SPILL_HALF + 0.3) continue;
      const x = lakePos.x + w.x, z = lakePos.z + w.y, size = rr(0.1, 0.19);
      // Shore decoration must leave the authored footpath open.
      if (pathSamples.some(([px, pz]) => Math.hypot(px - x, pz - z) < size + 0.34)) continue;
      rockAt(x, 0.8, z, size);
    }
    // lily pads and a few pale flowers
    for (let i = 0; i < 6; i++) {
      const a = rr(0, 6.28), w = lakeWorld(a, rr(0.25, 0.8));
      const pad = mesh(new T.CircleGeometry(rr(0.12, 0.18), 7, 0.4, 5.6), mat(0x6f8a5c, { side: T.DoubleSide }), scene, lakePos.x + w.x, 0.83, lakePos.z + w.y);
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = rr(0, 6);
      if (i % 3 === 0) mesh(new T.IcosahedronGeometry(0.045, 0), mat(0xf1ebe4), scene, pad.position.x, 0.86, pad.position.z);
    }
    // reeds along the far bank
    for (let c = 0; c < 5; c++) {
      const a = rr(0.9, 2.7), w = lakeWorld(a, 1.02);
      const g = new T.Group(); g.position.set(lakePos.x + w.x, 0.8, lakePos.z + w.y); scene.add(g);
      for (let i = 0; i < 6; i++) { const h = rr(0.35, 0.65); const r = mesh(new T.ConeGeometry(0.018, h, 3), mat(0x7e8f5e), g, rr(-0.12, 0.12), h / 2, rr(-0.12, 0.12)); r.rotation.set(rr(-0.15, 0.15), 0, rr(-0.15, 0.15)); }
      swayers.push({ o: g, ph: rr(0, 6), amp: 0.05 });
    }
    blockers.push({ x: lakePos.x, z: lakePos.z, r: 2.15, kind: 'water-outline' });
  })();

  const waterVS = 'varying vec2 vUv; varying float vDepth; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }';
  const waterUniforms = () => ({ uTime: timeU, uWater: { value: new T.Color(COL.water) }, uFoam: { value: new T.Color(0xeef2f2) }, uFog: { value: new T.Color(0x6d7488) }, uNear: { value: 86 }, uFar: { value: 112 } });
  (function stream() {
    const start = lakePos.clone().add(new T.Vector3(SPILL.ax, 0, SPILL.az).multiplyScalar(lakeR(OUT_A) * 0.55));
    const end = LIP.p.clone();
    const n = 14, pos = [], uv = [], idx = [];
    const dir = end.clone().sub(start); const len = dir.length(); dir.normalize();
    const lat = new T.Vector3(-dir.z, 0, dir.x);
    for (let i = 0; i <= n; i++) {
      const t = i / n; const c = start.clone().lerp(end, t);
      const w = SPILL_HALF * 2 - 0.04;
      [-1, 1].forEach((s) => { const p = c.clone().addScaledVector(lat, s * w / 2); pos.push(p.x, 0.826, p.z); uv.push(s < 0 ? 0 : 1, t * len / 2); });
      if (i < n) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      if (i % 3 === 1 && t > 0.45) [-1, 1].forEach((s) => { const p = c.clone().addScaledVector(lat, s * (w / 2 + 0.14)); rockAt(p.x, 0.8, p.z, rr(0.07, 0.12)); });
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new T.ShaderMaterial({ uniforms: waterUniforms(), transparent: true, depthWrite: false, vertexShader: waterVS, fragmentShader: [
      'uniform float uTime, uNear, uFar; uniform vec3 uWater, uFoam, uFog; varying vec2 vUv; varying float vDepth;', noiseGLSL,
      'void main(){ float s = noise(vec2(vUv.x * 6.0, vUv.y * 5.0 - uTime * 1.4)) * 0.6 + noise(vec2(vUv.x * 14.0, vUv.y * 11.0 - uTime * 2.1)) * 0.4;',
      '  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);',
      '  vec3 col = mix(uWater, uFoam, smoothstep(0.55, 0.9, s) * 0.7);',
      '  col = mix(col, uFog, smoothstep(uNear, uFar, vDepth) * 0.7);',
      '  gl_FragColor = vec4(col, edge * 0.92); }'].join('\n') });
    const sm = new T.Mesh(g, m); sm.renderOrder = 1; scene.add(sm); waterMats.push(m);
    for (let i = 0; i <= 40; i++) { const p = start.clone().lerp(end, i / 40); pathSamples.push([p.x, p.z]); }
    blockers.push({ x: (start.x + end.x) / 2, z: (start.z + end.z) / 2, r: 0.1 });
  })();
  (function waterfall() {
    const H = 11.5, n = 48, pos = [], uv = [], idx = [];
    const lat = new T.Vector3(-LIP.out.z, 0, LIP.out.x);
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const c = LIP.p.clone().addScaledVector(LIP.out, 0.02 + 0.63 * Math.sqrt(s));
      c.y = 0.824 - H * Math.pow(s, 1.08);
      const w = SPILL_HALF * 2 + 0.95 * s;
      [-1, 1].forEach((k) => { const p = c.clone().addScaledVector(lat, k * w / 2); pos.push(p.x, p.y, p.z); uv.push(k < 0 ? 0 : 1, s); });
      if (i < n) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new T.ShaderMaterial({ uniforms: waterUniforms(), transparent: true, depthWrite: false, side: T.DoubleSide, vertexShader: waterVS, fragmentShader: [
      'uniform float uTime, uNear, uFar; uniform vec3 uWater, uFoam, uFog; varying vec2 vUv; varying float vDepth;', noiseGLSL,
      'void main(){ float x = vUv.x, y = vUv.y;',
      '  float s1 = noise(vec2(x * 11.0, y * 26.0 - uTime * 2.4));',
      '  float s2 = noise(vec2(x * 30.0 + 3.0, y * 60.0 - uTime * 3.6));',
      '  float streak = s1 * 0.6 + s2 * 0.4;',
      '  float edge = smoothstep(0.0, 0.22 + y * 0.2, x) * smoothstep(1.0, 0.78 - y * 0.2, x);',
      '  float a = edge * (0.45 + 0.5 * streak) * (1.0 - smoothstep(0.42, 0.95, y));',
      '  vec3 col = mix(uWater, uFoam, clamp(0.35 + streak * 0.55 + y * 0.5, 0.0, 1.0));',
      '  col = mix(col, uFog, smoothstep(uNear, uFar, vDepth) * 0.6);',
      '  gl_FragColor = vec4(col, a * 0.92); }'].join('\n') });
    const fall = new T.Mesh(g, m); fall.renderOrder = 2; scene.add(fall); waterMats.push(m);
  })();
  const mistSprites = [[0, -0.4, 1.1, 0.28], [0.2, -1.4, 1.7, 0.2], [-0.2, -3.2, 2.6, 0.16], [0.1, -5.2, 3.6, 0.14]].map(([o, y, sc, op], i) => {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: dotTexEarly(), transparent: true, opacity: op, depthWrite: false, color: 0xffffff }));
    sp.position.copy(LIP.p).addScaledVector(LIP.out, 0.5 + i * 0.25); sp.position.y = y; sp.position.x += o; sp.scale.set(sc, sc * 0.8, 1); scene.add(sp);
    return { sp, base: op, sc, ph: i * 1.7 };
  });
  const drops = (function () {
    const n = 26, pos = new Float32Array(n * 3), st = [];
    const lat = new T.Vector3(-LIP.out.z, 0, LIP.out.x);
    for (let i = 0; i < n; i++) st.push({ o: rr(-0.45, 0.45), t: rr(0, 1), sp: rr(0.18, 0.3) });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const m = new T.PointsMaterial({ color: 0xffffff, size: 3, map: dotTexEarly(), transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: false });
    const pts = new T.Points(geo, m); scene.add(pts);
    return { pts, pos, st, lat, m };
  })();
  function dotTexEarly() {
    if (dotTexEarly.t) return dotTexEarly.t;
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    dotTexEarly.t = new T.CanvasTexture(c); return dotTexEarly.t;
  }

  // ---------- grass: soft tufts in patches, thicker along paths and around props ----------
  (function grass() {
    function tuft(blades, hMin, hMax) {
      const pos = [], col = [], nor = [], idx = [];
      let v0 = 0;
      for (let b = 0; b < blades; b++) {
        const a = (b / blades) * Math.PI * 2 + rr(-0.35, 0.35);
        const lean = rr(0.18, 0.5), h = rr(hMin, hMax), w = rr(0.07, 0.1);
        const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
        const ox = dx * rr(0, 0.05), oz = dz * rr(0, 0.05);
        const SEG = 3;
        for (let i = 0; i <= SEG; i++) {
          const t = i / SEG, y = h * t, out = lean * h * t * t, ww = w * (1 - t * 0.92) / 2;
          const cx = ox + dx * out, cz = oz + dz * out;
          pos.push(cx - px * ww, y, cz - pz * ww, cx + px * ww, y, cz + pz * ww);
          const k = 0.8 + 0.3 * t; const warm = t * 0.06;
          for (let j = 0; j < 2; j++) { col.push(k + warm, k + warm * 0.6, k * 0.9); nor.push(0, 1, 0); }
          if (i < SEG) { const q = v0 + i * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
        }
        v0 += (SEG + 1) * 2;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
      return g;
    }
    const gm = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, side: T.DoubleSide });
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = timeU; sh.uniforms.uSway = swayU;
      sh.vertexShader = 'uniform float uTime;\nuniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
        'float hh = max(position.y, 0.0) / 0.4;',
        'float w = sin(uTime * 1.1 + ip.x * 0.45 + ip.z * 0.3) * 0.5 + sin(uTime * 2.3 + ip.x * 1.7 + ip.z) * 0.2;',
        'float gust = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin((ip.x - ip.z) * 0.7071 * 0.32 - uTime * 1.5));',
        'vGust = gust * hh;',
        'vec3 lw = normalize(transpose(mat3(instanceMatrix)) * vec3(0.7071, 0.0, -0.7071));',
        'float bend = (w * 0.045 + gust * 0.24) * hh * hh * uSway;',
        'transformed.xz += lw.xz * bend;',
        'transformed.y -= gust * hh * hh * 0.05 * uSway;'
      ].join('\n'));
      sh.vertexShader = 'varying float vGust;\n' + sh.vertexShader;
      sh.fragmentShader = 'varying float vGust;\n' + sh.fragmentShader.replace('#include <fog_fragment>', 'gl_FragColor.rgb *= 1.0 + vGust * 0.22;\n#include <fog_fragment>');
    };
    const patch = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.9 + Math.sin(z * 0.6) * 2.2) * Math.cos(z * 0.8 + x * 0.35);
    const onPath = (x, z, d) => { for (let k = 0; k < pathSamples.length; k++) { const s = pathSamples[k]; if (Math.abs(s[0] - x) < d && Math.abs(s[1] - z) < d && Math.hypot(s[0] - x, s[1] - z) < d) return true; } return false; };
    const blocked = (x, z) => blockers.some((b) => Math.hypot(x - b.x, z - b.z) < b.r * 0.92);
    const inside = (x, z) => { const I = islandUnder(x, z); return I && (!islandUnder(x, z) || true) ? I : null; };
    const spots = [];
    const tryAdd = (x, z, big) => { const I = inside(x, z); if (!I) return; const dx = x - I.x, dz = z - I.z; if (Math.hypot(dx, dz) > I.r * I.rf(Math.atan2(dz, dx)) * 0.94) return; if (blocked(x, z) || onPath(x, z, 0.4)) return; spots.push([x, I.y, z, big]); };
    // patchy meadow
    ISLANDS.forEach((I) => {
      const n = Math.round(I.r * I.r * 20);
      for (let i = 0; i < n; i++) {
        const a = rr(0, 6.28), d = Math.sqrt(rnd()) * I.r * 0.94 * I.rf(a);
        const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d;
        const edge = d / (I.r * I.rf(a));
        if (rnd() < 0.08 + 0.55 * Math.max(0, (patch(x, z) - 0.45) / 0.55) + (edge > 0.82 ? 0.35 : 0)) tryAdd(x, z, patch(x, z) > 0.75);
      }
    });
    // path verges
    for (let k = 0; k < pathSamples.length; k += 2) {
      if (rnd() > 0.35) continue;
      const s = pathSamples[k], nx = pathSamples[Math.min(k + 1, pathSamples.length - 1)];
      let tx = nx[0] - s[0], tz = nx[1] - s[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const side = rnd() < 0.5 ? -1 : 1, off = rr(0.48, 0.75);
      tryAdd(s[0] - tz * off * side, s[1] + tx * off * side, false);
    }
    // bases of props
    blockers.forEach((b) => { if (b.r > 1.2) return; const n = 2 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) { const a = rr(0, 6.28), d = b.r + rr(0.05, 0.3); tryAdd(b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, false); } });

    const geoSmall = tuft(6, 0.16, 0.26), geoBig = tuft(8, 0.24, 0.36);
    const greens = [0x8a9d6f, 0x829770, 0x93a576, 0x7f9464, 0x9aab7c, 0x879b6c];
    [[geoSmall, false], [geoBig, true]].forEach(([geo, big]) => {
      const list = spots.filter((p) => p[3] === big);
      const im = new T.InstancedMesh(geo, gm, list.length);
      const o = new T.Object3D(), c = new T.Color();
      list.forEach(([x, y, z], i) => {
        o.position.set(x, y, z); o.rotation.set(0, rr(0, 6.28), 0);
        const s = rr(0.8, 1.25); o.scale.set(s, s * rr(0.85, 1.15), s); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
        c.setHex(greens[Math.floor(rnd() * greens.length)]).offsetHSL(0, 0, rr(-0.03, 0.03)); im.setColorAt(i, c);
      });
      im.receiveShadow = true; scene.add(im);
    });
    // small wildflowers growing inside the denser patches
    const flowers = spots.filter((p) => p[3] && rnd() < 0.35);
    const fm = new T.InstancedMesh(new T.IcosahedronGeometry(0.045, 0), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), flowers.length);
    const o = new T.Object3D(), c = new T.Color(), fc = [0xefe9df, 0xdcc9d6, 0xe9dcc0, 0xc9d3e3];
    flowers.forEach(([x, y, z], i) => { o.position.set(x + rr(-0.08, 0.08), y + rr(0.26, 0.36), z + rr(-0.08, 0.08)); o.scale.setScalar(rr(0.8, 1.2)); o.updateMatrix(); fm.setMatrixAt(i, o.matrix); c.setHex(fc[i % fc.length]); fm.setColorAt(i, c); });
    scene.add(fm);
  })();

  // ---------- exits: the two ways out of the Area ----------
  const DEPART = {};
  AREA.departures.forEach((dp) => {
    const pts = [NODE[dp.exitNode].p].concat(dp.offMap.map((q) => W(q[0], q[1], q[2])));
    const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const n = Math.floor(len / (dp.style === 'stairs' ? 0.5 : 0.8));
    for (let i = 1; i <= n; i++) {
      const u = i / n; const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
      if (islandUnder(p.x, p.z)) continue;
      if (dp.style === 'stairs') {
        const b = new T.Mesh(new T.BoxGeometry(0.95, 0.14, 0.4), M.stone); b.position.set(p.x, p.y - 0.07, p.z);
        b.lookAt(b.position.clone().add(new T.Vector3(tan.x, 0, tan.z))); shadowy(b); scene.add(b);
        const c = mesh(stepUnder, M.stoneDark, scene, p.x, p.y - 0.42, p.z); c.castShadow = true;
      } else {
        const st = mesh(stepGeo, M.stone, scene, p.x, p.y - 0.12, p.z); st.rotation.y = rr(0, 3); shadowy(st);
        const b = mesh(stepUnder, M.stoneDark, scene, p.x, p.y - 0.48, p.z); b.castShadow = true;
      }
    }
    const end = curve.getPointAt(0.86);
    const veil = new T.Group(); veil.position.copy(end); scene.add(veil);
    for (let i = 0; i < 7; i++) { const b = mesh(new T.IcosahedronGeometry(rr(0.6, 1.2), 3), puffMat, veil, rr(-1.3, 1.3), rr(-0.7, 0.6), rr(-0.9, 0.9)); b.scale.y = 0.6; }
    veil.scale.setScalar(0.5);
    DEPART[dp.exit] = Object.assign({}, dp, { curve, len, veil, amt: 0, target: 0 });
  });
  const DEPART_T = AREA.departureDurationMs / 1000;
  const departMist = (function () {
    const m = puffMat.clone(); m.opacity = 0.9;
    const make = () => { const g = new T.Group(); for (let i = 0; i < 6; i++) { const b = mesh(new T.IcosahedronGeometry(rr(0.45, 0.8), 3), m, g, rr(-0.7, 0.7), rr(-0.2, 0.5), rr(-0.6, 0.6)); b.scale.y = 0.7; } g.visible = false; scene.add(g); return g; };
    return { a: make(), b: make(), m };
  })();
  // stone gate at the high exit, wooden posts at the pine exit
  (function () {
    const a = W(15.2, 11.6, 4.06), b = W(16.3, 10.9, 4.06);
    const l = mesh(new T.BoxGeometry(a.distanceTo(b) + 0.35, 0.13, 0.28), M.stone, scene, (a.x + b.x) / 2, 4.07, (a.z + b.z) / 2);
    l.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x); shadowy(l);
    const q = [W(15.24, -9.07, 0.2), W(14.56, -9.93, 0.2)];
    q.forEach((w) => { mesh(new T.CylinderGeometry(0.05, 0.06, 0.9, 6), M.woodDark, scene, w.x, 0.65, w.z).castShadow = true; });
    const r = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([q[0].clone().setY(1.0), q[0].clone().lerp(q[1], 0.5).setY(0.86), q[1].clone().setY(1.0)]), 12, 0.014, 4, false), M.rope);
    scene.add(r);
  })();
  // ---------- small life ----------
  const dotTex = (function () { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new T.CanvasTexture(c); })();
  function particleSet(n, color, size, blending, place) {
    const geo = new T.BufferGeometry(); const pos = new Float32Array(n * 3); const base = [];
    for (let i = 0; i < n; i++) { const b = place(i); base.push(b); pos[i * 3] = b.x; pos[i * 3 + 1] = b.y; pos[i * 3 + 2] = b.z; }
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const m = new T.PointsMaterial({ color, size, map: dotTex, transparent: true, opacity: 0, depthWrite: false, blending, sizeAttenuation: false, fog: false });
    const pts = new T.Points(geo, m); scene.add(pts); return { pts, base, pos, m };
  }
  const fireflies = particleSet(34, 0xffcf85, 7, T.AdditiveBlending, () => { const I = ISLANDS[Math.floor(rr(0, 4.99))]; const a = rr(0, 6.28), d = rr(0, I.r * 0.85); return { x: I.x + Math.cos(a) * d, y: I.y + rr(0.35, 2.2), z: I.z + Math.sin(a) * d, ph: rr(0, 6.28), sp: rr(0.3, 0.7) }; });
  const petals = particleSet(22, 0xf1e6de, 5, T.NormalBlending, () => ({ u: rr(-24, 24), v: rr(-10, 12), y: rr(0, 5), ph: rr(0, 6.28), sp: rr(0.35, 0.7), x: 0, z: 0 }));
  const birdMat = new T.MeshStandardMaterial({ color: 0x3b414c, roughness: 1, transparent: true, opacity: 1, side: T.DoubleSide });
  const birds = [0, 1, 2].map((i) => {
    const g = new T.Group(); const wingGeo = new T.BufferGeometry();
    wingGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.08, 0, 0, -0.08, 0.42, 0, -0.04], 3)); wingGeo.computeVertexNormals();
    const L = new T.Mesh(wingGeo, birdMat), R = new T.Mesh(wingGeo, birdMat); R.scale.x = -1; g.add(L, R);
    mesh(new T.BoxGeometry(0.08, 0.06, 0.26), birdMat, g);
    g.userData = { L, R, off: [[0, 0, 0], [-0.9, -0.5, 0.25], [-0.7, 0.6, -0.2]][i], ph: i * 1.3 }; scene.add(g); return g;
  });

  // world-memory props spawned by events
  let boat = null;
  function spawnBoat() {
    if (boat) return;
    const g = new T.Group();
    mesh(new T.BoxGeometry(0.2, 0.05, 0.08), M.paper, g, 0, 0.02, 0);
    const sail = new T.BufferGeometry(); sail.setAttribute('position', new T.Float32BufferAttribute([-0.1, 0.04, 0, 0.1, 0.04, 0, 0, 0.14, 0], 3)); sail.computeVertexNormals();
    mesh(sail, new T.MeshStandardMaterial({ color: 0xe9e1cf, side: T.DoubleSide, roughness: 1 }), g);
    g.position.set(lakePos.x, 0.84, lakePos.z); scene.add(g); shadowy(g);
    boat = { g, a: Math.atan2(NODE.b_lake.p.z - lakePos.z, NODE.b_lake.p.x - lakePos.x) };
  }
  function addPebble() {
    const n = shrine.pebbles.length; if (n > 14) return;
    const m = mesh(new T.DodecahedronGeometry(rr(0.04, 0.06), 0), M.stone, shrine.g, rr(-0.18, 0.18), 0.03 + (n > 6 ? 0.04 : 0), 0.32 + rr(-0.05, 0.08));
    m.castShadow = true; shrine.pebbles.push(m);
  }
  const slips = [];
  function spawnSlip(at) {
    const m = mesh(new T.PlaneGeometry(0.16, 0.11), new T.MeshBasicMaterial({ color: 0xf1e8d4, transparent: true, opacity: 0.95, side: T.DoubleSide, fog: false }), scene, at.x, at.y + 1.2, at.z);
    slips.push({ m, t: 0 });
  }

  // ---------- special finds: items and their reveal choreography ----------
  function buildItem(id) {
    const g = new T.Group();
    const brass = M.brass, paper = M.paper;
    if (id === 'old_wick') {
      mesh(new T.CylinderGeometry(0.05, 0.035, 0.05, 10), brass, g, 0, 0, 0);
      mesh(new T.CylinderGeometry(0.012, 0.012, 0.07, 6), mat(0xf3eee2), g, 0, 0.05, 0);
      mesh(new T.BoxGeometry(0.09, 0.02, 0.06), mat(0x8a7a62), g, 0, -0.03, 0).rotation.y = 0.4;
    } else if (id === 'weathered_lens') {
      mesh(new T.TorusGeometry(0.06, 0.011, 6, 20), brass, g);
      mesh(new T.CircleGeometry(0.058, 20), new T.MeshStandardMaterial({ color: 0xcfe3e8, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2, side: T.DoubleSide }), g);
    } else if (id === 'north_wing_key') {
      mesh(new T.TorusGeometry(0.03, 0.009, 6, 16), brass, g, 0, 0.06, 0);
      mesh(new T.BoxGeometry(0.014, 0.12, 0.014), brass, g, 0, -0.02, 0);
      mesh(new T.BoxGeometry(0.03, 0.014, 0.014), brass, g, 0.015, -0.06, 0);
      mesh(new T.BoxGeometry(0.022, 0.014, 0.014), brass, g, 0.011, -0.035, 0);
    } else if (id === 'astrolabe_core') {
      mesh(new T.SphereGeometry(0.04, 14, 10), new T.MeshStandardMaterial({ color: 0xf3e2b8, emissive: 0xffd28a, emissiveIntensity: 0.9, roughness: 0.4 }), g);
      const r1 = mesh(new T.TorusGeometry(0.06, 0.006, 5, 24), brass, g); r1.rotation.x = 1.1;
      const r2 = mesh(new T.TorusGeometry(0.06, 0.006, 5, 24), brass, g); r2.rotation.y = 1.1;
    } else if (id === 'broken_crest') {
      mesh(new T.CylinderGeometry(0.07, 0.07, 0.016, 14, 1, false, 0, Math.PI * 1.35), mat(0x8e7d5c), g).rotation.x = Math.PI / 2;
      mesh(new T.BoxGeometry(0.05, 0.05, 0.02), brass, g, 0, 0, 0.01).rotation.z = Math.PI / 4;
    } else if (id === 'nameless_badge') {
      mesh(new T.CylinderGeometry(0.045, 0.045, 0.012, 16), brass, g).rotation.x = Math.PI / 2;
      mesh(new T.BoxGeometry(0.03, 0.06, 0.006), mat(0x5d6b7a), g, 0, -0.06, 0);
      mesh(new T.OctahedronGeometry(0.018, 0), mat(0xe9e1cf), g, 0, 0, 0.012);
    } else if (id === 'cracked_compass') {
      mesh(new T.CylinderGeometry(0.058, 0.058, 0.022, 18), brass, g).rotation.x = Math.PI / 2;
      mesh(new T.CircleGeometry(0.048, 18), paper, g, 0, 0, 0.012);
      mesh(new T.BoxGeometry(0.008, 0.07, 0.004), mat(0x7a3b30), g, 0, 0, 0.015).rotation.z = 0.5;
      mesh(new T.BoxGeometry(0.003, 0.06, 0.004), M.dark, g, 0.015, 0.01, 0.016).rotation.z = -0.3;
    } else if (id === 'torn_star_chart') {
      const roll = mesh(new T.CylinderGeometry(0.022, 0.022, 0.17, 10), paper, g); roll.rotation.z = Math.PI / 2;
      [-0.05, 0.05].forEach((x) => { const t = mesh(new T.TorusGeometry(0.024, 0.004, 4, 12), mat(0x7a3b30), g, x, 0, 0); t.rotation.y = Math.PI / 2; });
    }
    g.scale.setScalar(1.9);
    g.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.material = c.material.clone(); c.material.emissive = new T.Color(0x6fbcff); c.material.emissiveIntensity = 0; } });
    return g;
  }
  const SRC_POSE = { well: 'crank', lake: 'reachDown', chest: 'crouch', astro: 'reach', shrine: 'crouch', roots: 'dig', pillar: 'reach', scope: 'inspect' };
  let rare = null;
  const ripples = [];
  function spawnRipple(p) {
    const m = mesh(new T.RingGeometry(0.9, 1.0, 36), new T.MeshBasicMaterial({ color: 0xf2f4f2, transparent: true, opacity: 0.5, depthWrite: false }), scene, p.x, 0.83, p.z);
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.08); ripples.push({ m, t: 0 });
  }
  function toward(nodeId, faceUV, dist, y) {
    const n = NODE[nodeId].p, f = W(faceUV[0], faceUV[1], 0);
    const d = new T.Vector3(f.x - n.x, 0, f.z - n.z).normalize();
    return new T.Vector3(n.x + d.x * dist, y, n.z + d.z * dist);
  }
  function rareSource(ev) {
    const spot = SPOT[ev.spot], gy = groundY(NODE[ev.spot].p);
    switch (ev.source) {
      case 'well': return well.g.localToWorld(new T.Vector3(0, 0.8, 0));
      case 'lake': return toward(ev.spot, spot.face, 0.95, 0.84);
      case 'chest': return chest.g.localToWorld(new T.Vector3(0, 0.26, 0));
      case 'astro': return astro.head.getWorldPosition(new T.Vector3());
      case 'shrine': return shrine.g.localToWorld(new T.Vector3(0, 0.06, 0.36));
      case 'roots': return toward(ev.spot, spot.face, 0.55, gy + 0.05);
      case 'pillar': return toward(ev.spot, spot.face, 0.5, gy + 1.05);
      case 'scope': return toward(ev.spot, spot.face, 0.55, gy + 1.15);
    }
    return NODE[ev.spot].p.clone();
  }
  const BLUE = 0x7cc4ff, AMBER = 0xffc47a;
  // Journey items (one per completed exploration, found along the way) get a warm, modest light.
  // The permanent core (5% per lamp) keeps the strong blue, plus a ring of stars that closes into it.
  const tierOf = (ev) => ev.tier || (ev.item && ev.item.kind === 'token' ? 'core' : 'journey');
  const amberTex = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,246,226,1)'); g.addColorStop(0.25, 'rgba(255,208,140,0.7)'); g.addColorStop(0.6, 'rgba(240,170,90,0.16)'); g.addColorStop(1, 'rgba(230,160,80,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  })();
  const blueTex = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(235,248,255,1)'); g.addColorStop(0.25, 'rgba(140,205,255,0.75)'); g.addColorStop(0.6, 'rgba(90,170,255,0.18)'); g.addColorStop(1, 'rgba(80,160,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  })();
  const beamMat = () => new T.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uTime: timeU }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uAlpha, uTime; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (0.75 + 0.25 * sin(vUv.x * 37.7 + uTime * 3.0)); gl_FragColor = vec4(vec3(0.45, 0.76, 1.0) * a * uAlpha, 1.0); }'
  });
  function startRare(ev) {
    const tier = tierOf(ev), core = tier === 'core', specified = !core && !!ev.__specifiedByCore;
    const tex = core ? blueTex : amberTex, col = core ? BLUE : AMBER;
    const item = buildItem(ev.item.id); item.visible = false; scene.add(item);
    if (!core) item.traverse((c) => { if (c.isMesh) c.material.emissive.setHex(0xffb35c); });
    const add = (o) => { scene.add(o); return o; };
    const src = rareSource(ev);
    const glint = add(new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })));
    glint.scale.set(core ? 1.5 : 0.95, core ? 1.5 : 0.95, 1); glint.position.copy(src);
    const aura = add(new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })));
    aura.scale.set(core ? 1.45 : 1.0, core ? 1.45 : 1.0, 1);
    const beam = add(new T.Mesh(new T.CylinderGeometry(specified ? 0.045 : 0.22, specified ? 0.07 : 0.34, 2.8, 28, 1, true), beamMat())); beam.position.copy(src); beam.visible = core || specified;
    const ringMat = () => new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    const ring = add(new T.Mesh(new T.RingGeometry(0.34, 0.42, 48), ringMat()));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(src); ring.position.y += 0.02;
    const ring2 = add(new T.Mesh(new T.RingGeometry(0.34, 0.4, 48), ringMat()));
    ring2.rotation.x = -Math.PI / 2; ring2.position.copy(ring.position); ring2.visible = core;
    const light = add(new T.PointLight(col, 0, core ? 5.5 : 3.2, 2));
    const motes = (function () { const n = core ? 20 : 9, pos = new Float32Array(n * 3); const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); const m = new T.PointsMaterial({ color: core ? 0xa9dbff : 0xffdcaa, size: core ? 5 : 4, map: tex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: false, fog: false }); return { pts: add(new T.Points(geo, m)), pos, n, m }; })();
    // core only: the future star positions, a ring of small stars that gathers over the astrolabe
    const stars = core ? (function () { const n = 14, pos = new Float32Array(n * 3); const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); const m = new T.PointsMaterial({ color: 0xe4f3ff, size: 6, map: blueTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: false, fog: false }); return { pts: add(new T.Points(geo, m)), pos, n, m }; })() : null;
    rare = { ev, tier, core, specified, item, glint, aura, beam, ring, ring2, light, motes, stars, src, lastRipple: 0 };
  }
  function endRare() {
    if (!rare) return;
    const wasCore = rare.core;
    [rare.item, rare.glint, rare.aura, rare.beam, rare.ring, rare.ring2, rare.light, rare.motes.pts].concat(rare.stars ? [rare.stars.pts] : []).forEach((o) => scene.remove(o));
    well.bucket.position.y = 0.72; well.setRope(); astro.align = 0; astro.boost = 0;
    rare = null;
    // the core has left the astrolabe with the traveller
    if (wasCore) setCoreTaken(true, true);
  }
  let coreTakenWanted = !!opts.coreTaken;
  function setCoreTaken(taken, fromReveal) {
    coreTakenWanted = !!taken;
    // never empty the astrolabe before its own reveal has played
    const revealWaiting = (rare && rare.core) || pendingSpecialFinds.some((ev) => tierOf(ev) === 'core');
    if (coreTakenWanted && revealWaiting && !fromReveal) return;
    astro.taken = coreTakenWanted; astro.hub.visible = !astro.taken; astro.cradle.visible = astro.taken;
  }
  const easeIO = (x) => x * x * (3 - 2 * x);
  function rareUpdate(p, dt) {
    const ev = rare.ev;
    // source choreography
    if (ev.source === 'well') { well.bucket.position.y = p < 0.2 ? 0.72 - 0.5 * easeIO(p / 0.2) : p < 0.45 ? 0.22 + 0.5 * easeIO((p - 0.2) / 0.25) : 0.72; well.setRope(); }
    if (ev.source === 'lake' && p > 0.18 && p < 0.55 && p - rare.lastRipple > 0.07) { rare.lastRipple = p; spawnRipple(rare.src); }
    if (ev.source === 'chest' && p > 0.12) chest.target = 1;
    if (ev.source === 'astro') { astro.boost = p < 0.3 ? 1 : 0; astro.align = p < 0.3 ? 0 : Math.min(1, (p - 0.3) / 0.18); }
    if (ev.source === 'shrine' && p > 0.1 && p < 0.42) shrine.pebbles.forEach((m, i) => { m.position.y = 0.03 + Math.abs(Math.sin(tAcc * 9 + i)) * 0.02; });
    // blue signal at the source: a soft column of light, a ring on the ground, a bright point
    const fl = p > 0.33 && p < 0.62 ? Math.sin(Math.PI * (p - 0.33) / 0.29) : 0;
    const pulse = 0.85 + 0.15 * Math.sin(tAcc * 9);
    const S = rare.core ? 1 : 0.8;                    // journey items stay modest
    rare.glint.material.opacity = fl * pulse * S;
    if (rare.core || rare.specified) {
      rare.beam.material.uniforms.uAlpha.value = fl * 0.95;
      rare.beam.scale.set(1.1, 0.3 + 1.2 * fl, 1.1); rare.beam.position.set(rare.src.x, rare.src.y - 0.1 + 1.4 * rare.beam.scale.y, rare.src.z);
    }
    const rt = p > 0.36 && p < 0.62 ? (p - 0.36) / 0.26 : -1;
    if (rt >= 0) { rare.ring.scale.setScalar(0.6 + rt * (rare.core ? 3.8 : 2.0)); rare.ring.material.opacity = (1 - rt) * (rare.core ? 0.9 : 0.55); } else rare.ring.material.opacity = 0;
    if (rare.core) {
      const r2 = p > 0.44 && p < 0.7 ? (p - 0.44) / 0.26 : -1;
      if (r2 >= 0) { rare.ring2.scale.setScalar(0.6 + r2 * 5.2); rare.ring2.material.opacity = (1 - r2) * 0.6; } else rare.ring2.material.opacity = 0;
      // stars: appear wide around the head, drift, then close into the rising core
      const st = rare.stars, sa = p > 0.22 && p < 0.6 ? Math.min(1, (p - 0.22) / 0.1) * (p < 0.52 ? 1 : 1 - (p - 0.52) / 0.08) : 0;
      st.m.opacity = sa * 0.95;
      if (sa > 0) {
        const close = p < 0.42 ? 0 : easeIO(Math.min(1, (p - 0.42) / 0.12));
        for (let i = 0; i < st.n; i++) {
          const a = i / st.n * Math.PI * 2 + tAcc * 0.25, r = (1.25 + 0.25 * Math.sin(i * 2.3)) * (1 - close);
          st.pos[i * 3] = rare.src.x + Math.cos(a) * r;
          st.pos[i * 3 + 1] = rare.src.y + 0.5 + 0.35 * Math.sin(i * 1.7 + tAcc * 0.6) * (1 - close);
          st.pos[i * 3 + 2] = rare.src.z + Math.sin(a) * r;
        }
        st.pts.geometry.attributes.position.needsUpdate = true;
      }
    }
    // item: rise to the hand, be held and looked at, then go into the pack
    const hand = trav.localToWorld(new T.Vector3(-0.1, 0.6, 0.32));
    const bag = trav.localToWorld(new T.Vector3(0, 0.66, -0.16));
    const it = rare.item, IS = rare.core ? 1.9 : 2.3;
    if (p < 0.5) { it.visible = false; }
    else if (p < 0.66) {
      const t = easeIO((p - 0.5) / 0.16);
      it.visible = true; it.position.copy(rare.src).lerp(hand, t); it.position.y += Math.sin(Math.PI * t) * 0.45; it.scale.setScalar(IS * (0.35 + 0.65 * t)); it.rotation.y += dt * 2;
    } else if (p < 0.88) {
      it.visible = true; it.position.copy(hand); it.position.y += Math.sin(tAcc * 1.6) * 0.015; it.scale.setScalar(IS); it.rotation.y += dt * 0.7;
    } else {
      const t = easeIO(Math.min(1, (p - 0.88) / 0.1));
      it.position.copy(hand).lerp(bag, t); it.scale.setScalar(IS * (1 - t)); it.visible = t < 0.98;
    }
    const held = p > 0.5 && p < 0.92 ? Math.sin(Math.PI * (p - 0.5) / 0.42) : 0;
    const glow = Math.max(fl, held);
    rare.light.position.copy(p < 0.5 ? rare.src : it.position); rare.light.position.y += 0.15;
    rare.light.intensity = glow * (rare.core ? 3.4 : 2.1) * pulse;
    it.traverse((c) => { if (c.isMesh) c.material.emissiveIntensity = held * (rare.core ? 0.9 : 0.75) * pulse; });
    rare.aura.position.copy(it.position); rare.aura.material.opacity = it.visible ? held * (rare.core ? 0.85 : 0.7) * pulse : 0;
    const mt = p > 0.5 && p < 0.92;
    rare.motes.m.opacity = mt ? held * (rare.core ? 0.9 : 0.6) : 0;
    if (mt) for (let i = 0; i < rare.motes.n; i++) {
      const k = i / rare.motes.n, a = tAcc * 1.8 + k * Math.PI * 2, rise = ((tAcc * 0.35 + k) % 1);
      rare.motes.pos[i * 3] = it.position.x + Math.cos(a) * (0.22 + 0.12 * rise);
      rare.motes.pos[i * 3 + 1] = it.position.y - 0.15 + rise * 0.7;
      rare.motes.pos[i * 3 + 2] = it.position.z + Math.sin(a) * (0.22 + 0.12 * rise);
    }
    rare.motes.pts.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- traveller ----------
  const trav = new T.Group(); trav.scale.setScalar(1.15); scene.add(trav);
  const body = new T.Group(); trav.add(body);
  const legGeo = new T.CylinderGeometry(0.045, 0.04, 0.3, 5); legGeo.translate(0, -0.15, 0);
  const legL = mesh(legGeo, M.woodDark, body, -0.07, 0.3, 0);
  const legR = mesh(legGeo, M.woodDark, body, 0.07, 0.3, 0);
  const upper = new T.Group(); upper.position.y = 0.3; body.add(upper);
  const cloak = mesh(new T.ConeGeometry(0.23, 0.6, 8), M.cloak, upper, 0, 0.25, 0);
  mesh(new T.CylinderGeometry(0.07, 0.07, 0.34, 7), mat(0x8a6f55), upper, 0, 0.36, -0.15).rotation.z = Math.PI / 2;
  const head = new T.Group(); head.position.y = 0.6; upper.add(head);
  mesh(new T.SphereGeometry(0.105, 12, 9), M.skin, head);
  mesh(new T.ConeGeometry(0.3, 0.13, 12), M.hat, head, 0, 0.1, 0);
  const armGeo = new T.CylinderGeometry(0.034, 0.03, 0.3, 5); armGeo.translate(0, -0.15, 0);
  const armL = mesh(armGeo, M.cloak, upper, -0.13, 0.44, 0.02);
  const armR = mesh(armGeo, M.cloak, upper, 0.13, 0.44, 0.02);
  const staff = new T.Group(); staff.position.set(0.2, 0.25, 0.08); upper.add(staff);
  mesh(new T.CylinderGeometry(0.017, 0.02, 1.08, 5), M.wood, staff, 0, 0.02, 0);
  mesh(new T.BoxGeometry(0.02, 0.02, 0.14), M.woodDark, staff, 0, 0.55, 0.06);
  const travGlowMat = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.2, roughness: 1 });
  const travLamp = mesh(new T.BoxGeometry(0.075, 0.1, 0.075), travGlowMat, staff, 0, 0.46, 0.13);
  const travLight = new T.PointLight(0xffb05a, 0.8, 3.2, 2); travLight.position.set(0, 0.46, 0.13); staff.add(travLight);
  const travHalo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3, fog: false }));
  travHalo.scale.set(0.8, 0.8, 1); travHalo.position.set(0, 0.46, 0.13); staff.add(travHalo);
  const book = mesh(new T.BoxGeometry(0.2, 0.025, 0.14), M.paper, upper, 0, 0.1, 0.24); book.rotation.x = -0.4;
  shadowy(trav); travLamp.castShadow = false;
  const travMats = [];
  trav.traverse((c) => { if (c.isMesh) { if (c.material !== travGlowMat) c.material = c.material.clone(); travMats.push(c.material); } });
  let travFade = 1, lastFade = 1;
  function setTravOpacity(o) { travMats.forEach((m) => { m.transparent = o < 0.999; m.opacity = o; m.depthWrite = o > 0.4; }); }

  const POSE = {
    idle: {}, walk: {},
    inspect: { lean: 0.3, headX: 0.4, armL: -0.5 },
    crouch: { hip: -0.2, legX: -0.9, lean: 0.45, headX: 0.35, armL: -0.8 },
    pickup: {},
    reach: { armL: -1.7, headX: -0.1 },
    gaze: { headX: -0.32 },
    sit: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3 },
    sitGaze: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3, headX: -0.3 },
    sitEdge: { hip: -0.28, legX: -1.3, staffX: 0.2, staffZ: -0.6, armL: -0.2 },
    write: { hip: -0.28, legX: -1.45, headX: 0.5, armL: -0.9, book: 1, staffX: 0.2, staffZ: -0.6 },
    lie: { lie: 1, hip: 0.2, armL: -2.9 },
    light: { armL: -0.4, headX: -0.1 },
    stretch: {},
    bow: { lean: 0.3, headX: 0.45, armL: -0.9 },
    drink: { armL: -2.0, headX: -0.35 },
    crank: { lean: 0.15, headX: 0.3, armL: -1.2 },
    reachDown: { hip: -0.2, legX: -0.9, lean: 0.6, headX: 0.45, armL: -0.35 },
    dig: { hip: -0.2, legX: -0.9, lean: 0.5, headX: 0.4, armL: -0.8 },
    hold: { armL: -1.15, headX: 0.4, lean: 0.05 },
    pack: { hip: -0.2, legX: -0.9, lean: 0.5, headX: 0.45, armL: -0.9, book: 1 }
  };
  const PKEYS = ['hip', 'legX', 'lean', 'headX', 'headY', 'armL', 'armLz', 'staffX', 'staffZ', 'book', 'lie'];
  const pose = {}; PKEYS.forEach((k) => { pose[k] = 0; });


  // ---------- life: animals with small routines, smoke, cloud shadows (all visual only) ----------
  const WIND = new T.Vector2(Math.SQRT1_2, -Math.SQRT1_2);          // blows toward screen right
  const gustAt = (x, z) => { const v = 0.5 + 0.5 * Math.sin((x - z) * Math.SQRT1_2 * 0.32 - tAccRef.t * 1.5); return v <= 0.55 ? 0 : v >= 1 ? 1 : ((v - 0.55) / 0.45) * ((v - 0.55) / 0.45) * (3 - 2 * ((v - 0.55) / 0.45)); };
  const tAccRef = { t: 0 };
  const cloudShadowU = { value: 0.25 };
  const whaleU = { value: new T.Vector4(0, 0, 0, 0) }, whaleAxU = { value: new T.Vector2(1, 0) };
  const animalMat = (c) => mat(c, { flatShading: true });

  // birds: two small flocks that perch, take off when the traveller comes close, circle, and land elsewhere
  function makeBird(color) {
    const g = new T.Group();
    const m = animalMat(color);
    const bodyM = mesh(new T.SphereGeometry(0.05, 7, 5), m, g); bodyM.scale.set(1, 0.85, 1.6);
    mesh(new T.SphereGeometry(0.032, 6, 5), m, g, 0, 0.035, 0.065);
    mesh(new T.ConeGeometry(0.01, 0.03, 4), animalMat(0xc9a15c), g, 0, 0.03, 0.1).rotation.x = Math.PI / 2;
    const wing = new T.BufferGeometry(); wing.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.04, 0, 0, -0.05, 0.13, 0, -0.02], 3)); wing.computeVertexNormals();
    const wm = new T.MeshStandardMaterial({ color, roughness: 1, side: T.DoubleSide });
    const L = new T.Mesh(wing, wm), R = new T.Mesh(wing, wm); R.scale.x = -1; L.position.y = R.position.y = 0.02; g.add(L, R);
    g.scale.setScalar(1.35); shadowy(g); scene.add(g);
    return { g, L, R, off: new T.Vector3(rr(-0.2, 0.2), 0, rr(-0.2, 0.2)), ph: rr(0, 6.28), hopT: rr(1, 5), look: 0, pos: new T.Vector3(), heading: rr(0, 6.28) };
  }
  const roofApex = PAV.clone().add(new T.Vector3(0, PAV_H + 2.8, 0));
  const lampTop = (i) => lamps[i].g.position.clone().add(new T.Vector3(0, 1.32, 0));
  const flocks = [
    { perches: [roofApex, lampTop(3), P3(14.5, 6.9, 3.4 + 1.18)], color: [0x5b4c40, 0x6b5a4a, 0x4e4a46, 0x6a5b4c] },
    { perches: [P3(-12.5, -1.8, 1.7), lampTop(0), P3(-11.2, -6.3, 1.45)], color: [0x59504a, 0x6d6152, 0x4f4640] }
  ].map((f) => ({ perches: f.perches, birds: f.color.map((c) => makeBird(c)), perch: 0, next: 0, state: 'perched', t: 0, cool: rr(20, 50) }));
  flocks.forEach((f) => f.birds.forEach((b, i) => { b.off.set(Math.cos(i * 1.9) * 0.16, 0, Math.sin(i * 1.9) * 0.16); b.g.position.copy(f.perches[0]).add(b.off); }));

  // koi under the lake surface, now and then rising with a ring of ripples
  const kois = [0xe0874a, 0xf2e6d8, 0xd9a441].map((c, i) => {
    const g = new T.Group();
    const m = new T.MeshStandardMaterial({ color: c, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false });
    const b = mesh(new T.SphereGeometry(0.07, 8, 5), m, g); b.scale.set(0.7, 0.35, 1.9);
    const tail = new T.BufferGeometry(); tail.setAttribute('position', new T.Float32BufferAttribute([0, 0, -0.1, -0.06, 0, -0.2, 0.06, 0, -0.2], 3)); tail.computeVertexNormals();
    const tm = mesh(tail, new T.MeshStandardMaterial({ color: c, roughness: 0.6, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }), g);
    g.renderOrder = 3; scene.add(g);
    return { g, m, tail: tm, a: rr(0, 6.28), k: rr(0.4, 0.7), sp: rr(0.1, 0.16) * (i % 2 ? -1 : 1), rise: 0, next: rr(8, 20) };
  });

  // a white heron standing on the far shore, fishing now and then, stepping away when the traveller comes near
  const heron = (function () {
    const g = new T.Group(); scene.add(g);
    const white = animalMat(0xeeeae2), grey = animalMat(0x9da3a6), leg = animalMat(0x3d3a36), beakM = animalMat(0xd8b24a);
    const body = mesh(new T.SphereGeometry(0.12, 8, 6), white, g, 0, 0.5, 0); body.scale.set(0.8, 0.75, 1.5);
    mesh(new T.SphereGeometry(0.07, 6, 5), grey, g, 0, 0.5, -0.16).scale.set(1, 0.6, 1.2);
    const legs = [-1, 1].map((s) => { const l = new T.Group(); l.position.set(s * 0.04, 0.42, 0); g.add(l); const geo = new T.CylinderGeometry(0.008, 0.008, 0.42, 4); geo.translate(0, -0.21, 0); mesh(geo, leg, l); return l; });
    const neck = new T.Group(); neck.position.set(0, 0.56, 0.12); g.add(neck);
    const ng = new T.CylinderGeometry(0.022, 0.03, 0.3, 6); ng.translate(0, 0.15, 0); mesh(ng, white, neck).rotation.x = 0.25;
    const headG = new T.Group(); headG.position.set(0, 0.3, 0.07); neck.add(headG);
    mesh(new T.SphereGeometry(0.04, 7, 5), white, headG);
    mesh(new T.ConeGeometry(0.012, 0.13, 5), beakM, headG, 0, -0.005, 0.08).rotation.x = Math.PI / 2;
    shadowy(g);
    return { g, neck, legs, a: 2.85, target: 2.85, t: 0, fishT: rr(8, 14), fish: -1, walk: 0 };
  })();
  const HERON_SPOTS = [2.85, 1.75];

  // butterflies around the flower patches by day
  const butterflies = [[-14.6, -3.4, 0.0], [1.5, 0.1, 0.8], [-3.6, 2.6, 0.8]].map(([u, v, y], i) => {
    const c = [0xf1e4a8, 0xe9eef2, 0xb9d3ea][i];
    const g = new T.Group(); scene.add(g);
    const wg = new T.PlaneGeometry(0.07, 0.055); wg.translate(0.035, 0, 0);
    const wm = new T.MeshStandardMaterial({ color: c, roughness: 1, side: T.DoubleSide, transparent: true, opacity: 1 });
    const L = new T.Mesh(wg, wm), R = new T.Mesh(wg, wm); R.scale.x = -1; g.add(L, R);
    [L, R].forEach((w) => { w.rotation.x = -Math.PI / 2; });
    g.scale.setScalar(1.7);
    return { g, L, R, wm, c: P3(u, v, y), ph: rr(0, 6.28), rest: 0, restT: rr(6, 14) };
  });

  // a cat asleep on the pavilion bench, lifting its head to watch the traveller pass
  const cat = (function () {
    // on the sunny front edge of the pavilion floor, between two pillars, where the roof does not hide it
    const enter = W(1.3, 1.05, 0).normalize(); const face = Math.atan2(enter.x, enter.z);
    let best = face, bestD = 9;
    for (let k = 0; k < 6; k++) { const a = face + (k * Math.PI) / 3; const d = Math.abs(Math.atan2(Math.sin(a - (VIEW_FACE - 0.5)), Math.cos(a - (VIEW_FACE - 0.5)))); if (d < bestD && Math.abs(Math.atan2(Math.sin(a - face), Math.cos(a - face))) > 0.5) { bestD = d; best = a; } }
    const g = new T.Group(); g.position.set(PAV.x + Math.sin(best) * 1.3, PAV.y + PAV_H, PAV.z + Math.cos(best) * 1.3); g.rotation.y = best + Math.PI / 2; scene.add(g);
    const fur = animalMat(0xa07a55), dark = animalMat(0x6d5238);
    const body = mesh(new T.SphereGeometry(0.1, 8, 6), fur, g, 0, 0.055, 0); body.scale.set(0.95, 0.6, 1.25);
    const head = new T.Group(); head.position.set(0, 0.05, 0.12); g.add(head);
    mesh(new T.SphereGeometry(0.055, 7, 5), fur, head);
    [-1, 1].forEach((s) => { const e = mesh(new T.ConeGeometry(0.018, 0.04, 4), dark, head, s * 0.028, 0.045, 0); e.rotation.z = -s * 0.2; });
    const tail = new T.Mesh(new T.TorusGeometry(0.1, 0.014, 5, 12, Math.PI * 1.1), dark); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.02, -0.01); g.add(tail);
    shadowy(g);
    return { g, head, body, tail, awake: 0, lastNear: -99 };
  })();

  // smoke: incense, campfire, chimney
  const smokes = SMOKE_SOURCES.map((src) => {
    const cfg = { incense: { n: 6, rise: 0.9, drift: 0.25, s0: 0.06, s1: 0.28, o: 0.32, life: 4.5 }, campfire: { n: 9, rise: 1.8, drift: 0.7, s0: 0.14, s1: 0.75, o: 0.42, life: 5 }, chimney: { n: 8, rise: 1.6, drift: 0.8, s0: 0.12, s1: 0.65, o: 0.45, life: 5.5 } }[src.kind];
    const puffs = [];
    for (let i = 0; i < cfg.n; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xdedad2, transparent: true, opacity: 0, depthWrite: false }));
      scene.add(sp); puffs.push({ sp, a: i / cfg.n, j: rr(-1, 1) });
    }
    return { src, cfg, puffs };
  });

  // cloud shadows: every lit surface darkens slightly where a slow noise field passes over it
  const CS_GLSL = [
    'float cs_hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }',
    'float cs_noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(mix(cs_hash(i), cs_hash(i+vec2(1.0,0.0)), u.x), mix(cs_hash(i+vec2(0.0,1.0)), cs_hash(i+vec2(1.0,1.0)), u.x), u.y); }'
  ].join('\n');
  function withCloudShadow(m) {
    if (!m || !m.isMeshStandardMaterial || (m.userData && (m.userData.noCloud || m.userData.cs))) return;
    if (m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0) return;   // lamps, windows and glowing items stay lit
    m.userData.cs = true;
    const prev = m.onBeforeCompile;
    const prevKey = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      sh.uniforms.uCsTime = timeU; sh.uniforms.uCloudShadow = cloudShadowU; sh.uniforms.uWhale = whaleU; sh.uniforms.uWhaleAx = whaleAxU;
      sh.vertexShader = 'varying vec3 vCsW;\n' + sh.vertexShader.replace('#include <project_vertex>', [
        '#include <project_vertex>',
        'vec4 csW = vec4(transformed, 1.0);',
        '#ifdef USE_INSTANCING',
        'csW = instanceMatrix * csW;',
        '#endif',
        'vCsW = (modelMatrix * csW).xyz;'
      ].join('\n'));
      sh.fragmentShader = 'uniform float uCsTime;\nuniform float uCloudShadow;\nuniform vec4 uWhale;\nuniform vec2 uWhaleAx;\nvarying vec3 vCsW;\n' + CS_GLSL + '\n' + sh.fragmentShader.replace('#include <fog_fragment>', [
        'float csN = cs_noise(vCsW.xz * 0.13 + vec2(uCsTime * 0.08, uCsTime * 0.032)) * 0.65 + cs_noise(vCsW.xz * 0.29 + vec2(uCsTime * 0.12, -uCsTime * 0.03)) * 0.35;',
        'gl_FragColor.rgb *= 1.0 - smoothstep(0.46, 0.66, csN) * uCloudShadow;',
        'vec2 wdl = vCsW.xz - uWhale.xy; float wsh = 1.0 - smoothstep(0.55, 1.0, length(vec2(dot(wdl, uWhaleAx) / 7.0, dot(wdl, vec2(-uWhaleAx.y, uWhaleAx.x)) / 2.6)));',
        'gl_FragColor.rgb *= 1.0 - wsh * uWhale.z;',
        '#include <fog_fragment>'
      ].join('\n'));
    };
    m.customProgramCacheKey = () => 'cs|' + prevKey + '|' + (prev ? prev.toString().length : 0);
    m.needsUpdate = true;
  }
  [M.island, M.path, M.stone, M.stoneDark].forEach(withCloudShadow);
  scene.traverse((o) => { if (o.isMesh && o !== sea && o !== wisps) (Array.isArray(o.material) ? o.material : [o.material]).forEach(withCloudShadow); });

  function lifeUpdate(dt, now) {
    tAccRef.t = tAcc;
    cloudShadowU.value = cur.cloudS;
    const tp = trav.position;
    // cloth and trees follow the gust wave
    clothUniforms.forEach((c) => { const g = gustAt(c.pos.x, c.pos.z); c.u.gust.value += (g - c.u.gust.value) * Math.min(1, dt * 3); });
    swayers.forEach((sw) => {
      if (!sw.wp) sw.wp = sw.o.getWorldPosition(new T.Vector3());
      const g = gustAt(sw.wp.x, sw.wp.z); sw.g = (sw.g || 0) + (g - (sw.g || 0)) * Math.min(1, dt * 2);
      sw.o.rotation.z = Math.sin(tAcc * 0.7 + sw.ph) * sw.amp + sw.g * sw.amp * 2.6;
      sw.o.rotation.x = Math.sin(tAcc * 0.5 + sw.ph * 1.7) * sw.amp * 0.6 + sw.g * sw.amp * 1.6;
    });
    // window light and campfire
    hut.windowMat.emissiveIntensity = cur.win * (0.95 + 0.05 * Math.sin(tAcc * 3.1));
    hut.light.intensity = cur.win * 0.7;
    const fl = 0.85 + 0.15 * Math.sin(tAcc * 11) * Math.sin(tAcc * 7.3 + 1);
    campfire.f1.scale.set(1, fl * (1 + 0.1 * Math.sin(tAcc * 9)), 1); campfire.f2.scale.set(1, fl, 1);
    campfire.light.intensity = (0.35 + cur.fire * 0.9) * fl;
    // smoke drifts with the wind and fades as it rises
    smokes.forEach((sm) => {
      const c = sm.cfg;
      sm.puffs.forEach((pf) => {
        pf.a += (dt * MOTION) / c.life; if (pf.a > 1) { pf.a -= 1; pf.j = rr(-1, 1); }
        const a = pf.a;
        const g = gustAt(sm.src.pos.x, sm.src.pos.z);
        pf.sp.position.set(sm.src.pos.x + (WIND.x * (c.drift + g * 0.5) + pf.j * 0.08) * a, sm.src.pos.y + c.rise * a + Math.sin(tAcc * 1.3 + pf.j * 3) * 0.04 * a, sm.src.pos.z + (WIND.y * (c.drift + g * 0.5)) * a);
        const k = c.s0 + c.s1 * a; pf.sp.scale.set(k, k, 1);
        pf.sp.material.opacity = c.o * cur.smoke * Math.sin(Math.PI * Math.min(1, a * 1.15)) * (1 - a * 0.3);
        pf.sp.material.color.copy(cur.light).lerp(WHITE, 0.3);
      });
    });
    // birds
    flocks.forEach((f) => {
      f.t += dt; f.cool -= dt;
      const perchPos = f.perches[f.perch];
      if (f.state === 'perched') {
        const near = Math.hypot(tp.x - perchPos.x, tp.z - perchPos.z) < 2.4 && trav.visible;
        if (near || f.cool <= 0) {
          const far = f.perches.map((q, i) => ({ i, d: Math.hypot(tp.x - q.x, tp.z - q.z) })).filter((q) => q.i !== f.perch && q.d > 3);
          f.next = far.length ? far[Math.floor(rand() * far.length)].i : (f.perch + 1) % f.perches.length;
          f.state = 'fly'; f.t = 0; f.dur = 7 + rand() * 2; f.cool = rr(45, 90);
        }
      }
      f.birds.forEach((b, i) => {
        let target, flying = false;
        if (f.state === 'fly') {
          const q = Math.min(1, f.t / f.dur); flying = true;
          const from = f.perches[f.perch], to = f.perches[f.next];
          const c = from.clone().lerp(to, q * q * (3 - 2 * q));
          const r = 1.9 * Math.sin(Math.PI * q) + 0.1;
          const ang = q * Math.PI * 3 + b.ph;
          target = c.add(new T.Vector3(Math.cos(ang) * r, 2.2 * Math.sin(Math.PI * q) + Math.sin(tAcc * 3 + i) * 0.08, Math.sin(ang) * r)).add(b.off.clone().multiplyScalar(1 - Math.sin(Math.PI * q)));
          if (i === f.birds.length - 1 && q >= 1) { f.state = 'perched'; f.perch = f.next; }
        } else {
          target = perchPos.clone().add(b.off);
          b.hopT -= dt;
          if (b.hopT < 0) { b.hopT = rr(2, 6); b.heading += rr(-1.2, 1.2); b.off.x = Math.max(-0.22, Math.min(0.22, b.off.x + rr(-0.06, 0.06))); b.off.z = Math.max(-0.22, Math.min(0.22, b.off.z + rr(-0.06, 0.06))); }
        }
        const prev = b.g.position.clone();
        b.g.position.lerp(target, flying ? Math.min(1, dt * 6) : Math.min(1, dt * 8));
        const v = b.g.position.clone().sub(prev);
        if (v.lengthSq() > 1e-6) b.heading = Math.atan2(v.x, v.z);
        b.g.rotation.y += ((b.heading - b.g.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);
        const flap = flying ? Math.sin(tAcc * 18 + b.ph) * 0.9 : -1.25 + Math.sin(tAcc * 0.8 + b.ph) * 0.03;
        b.L.rotation.z = flap; b.R.rotation.z = -flap;
      });
    });
    // koi
    kois.forEach((kf) => {
      kf.a += kf.sp * dt * MOTION; kf.k = 0.55 + 0.18 * Math.sin(tAcc * 0.13 + kf.sp * 20);
      const w = lakeWorld(kf.a, kf.k), w2 = lakeWorld(kf.a + Math.sign(kf.sp) * 0.05, kf.k);
      kf.g.position.set(lakePos.x + w.x, 0.826, lakePos.z + w.y);
      kf.g.rotation.y = Math.atan2(w2.x - w.x, w2.y - w.y);
      kf.tail.rotation.y = Math.sin(tAcc * 6 + kf.a * 10) * 0.35;
      kf.next -= dt;
      if (kf.next < 0) { kf.next = rr(12, 26); kf.rise = 1; spawnRipple(kf.g.position); }
      kf.rise = Math.max(0, kf.rise - dt * 0.4);
      const o = 0.5 + 0.4 * kf.rise; kf.m.opacity = o; kf.tail.material.opacity = o;
    });
    // heron
    {
      const h = heron;
      const nearT = Math.hypot(tp.x - h.g.position.x, tp.z - h.g.position.z) < 2.6 && trav.visible;
      if (nearT && Math.abs(h.target - h.a) < 0.01) h.target = h.target === HERON_SPOTS[0] ? HERON_SPOTS[1] : HERON_SPOTS[0];
      const da = h.target - h.a; const step = Math.sign(da) * Math.min(Math.abs(da), dt * 0.28);
      h.a += step; const walking = Math.abs(da) > 0.01;
      const w = lakeWorld(h.a, 1.14), wc = new T.Vector3(lakePos.x, 0.8, lakePos.z);
      h.g.position.set(lakePos.x + w.x, 0.8, lakePos.z + w.y);
      if (walking) { const w2 = lakeWorld(h.a + Math.sign(da) * 0.05, 1.14); h.g.rotation.y = Math.atan2(w2.x - w.x, w2.y - w.y); }
      else h.g.rotation.y += (Math.atan2(wc.x - h.g.position.x, wc.z - h.g.position.z) - h.g.rotation.y) * Math.min(1, dt * 2);
      h.legs[0].rotation.x = walking ? Math.sin(tAcc * 5) * 0.4 : 0; h.legs[1].rotation.x = walking ? -Math.sin(tAcc * 5) * 0.4 : 0;
      h.fishT -= dt;
      if (!walking && h.fishT < 0 && h.fish < 0) { h.fish = 0; h.fishT = rr(10, 18); }
      if (h.fish >= 0) {
        h.fish += dt / 2.4;
        h.neck.rotation.x = Math.sin(Math.PI * Math.min(1, h.fish)) * 1.35;
        if (h.fish > 0.5 && !h.splash) { h.splash = true; spawnRipple(h.g.localToWorld(new T.Vector3(0, 0, 0.45))); }
        if (h.fish >= 1) { h.fish = -1; h.splash = false; h.neck.rotation.x = 0; }
      } else h.neck.rotation.x = Math.sin(tAcc * 0.6) * 0.04;
    }
    // butterflies
    butterflies.forEach((bf) => {
      const vis = cur.bfly;
      bf.g.visible = vis > 0.03; bf.wm.opacity = Math.min(1, vis * 1.2);
      if (!bf.g.visible) return;
      bf.restT -= dt;
      if (bf.rest > 0) bf.rest -= dt; else if (bf.restT < 0) { bf.rest = rr(2, 4); bf.restT = rr(8, 16); }
      const t = tAcc * 0.6 + bf.ph;
      const target = bf.c.clone().add(new T.Vector3(Math.sin(t) * 0.8 + Math.sin(t * 2.3) * 0.25, bf.rest > 0 ? 0.28 : 0.45 + Math.sin(t * 1.7) * 0.2, Math.cos(t * 0.8) * 0.7));
      const prev = bf.g.position.clone(); bf.g.position.lerp(target, Math.min(1, dt * (bf.rest > 0 ? 2 : 3)));
      const v = bf.g.position.clone().sub(prev); if (v.lengthSq() > 1e-7) bf.g.rotation.y = Math.atan2(v.x, v.z);
      const flap = bf.rest > 0 ? 0.25 + Math.sin(tAcc * 2) * 0.1 : Math.abs(Math.sin(tAcc * 16 + bf.ph)) * 1.2;
      bf.L.rotation.y = -flap; bf.R.rotation.y = flap;
    });
    // cat
    {
      const d = Math.hypot(tp.x - cat.g.position.x, tp.z - cat.g.position.z);
      if (d < 2.4 && trav.visible) cat.lastNear = tAcc;
      const want = tAcc - cat.lastNear < 3 ? 1 : 0;
      cat.awake += (want - cat.awake) * Math.min(1, dt * 1.5);
      const look = Math.atan2(tp.x - cat.g.position.x, tp.z - cat.g.position.z) - cat.g.rotation.y;
      cat.head.position.y = 0.05 + cat.awake * 0.06; cat.head.position.z = 0.12 + cat.awake * 0.02;
      cat.head.rotation.y = cat.awake * Math.atan2(Math.sin(look), Math.cos(look)) * 0.8;
      cat.head.rotation.x = (1 - cat.awake) * 0.35;
      const breathe = 1 + Math.sin(tAcc * 1.6) * 0.025 * (1 - cat.awake * 0.5);
      cat.body.scale.set(0.95 * breathe, 0.6 * breathe, 1.25);
      cat.tail.rotation.z = Math.sin(tAcc * (0.6 + cat.awake * 2)) * (0.08 + cat.awake * 0.25);
    }
  }

  // ---------- presets ----------
  // Warmer sun, less fill light (deeper shadows), a sky gradient with a sun glow, and how strongly
  // cloud shadows, window light and butterflies show at each time of day.
  const PRESETS = {
    dawn: { fog: 0xcdd4d6, near: 3, far: 27, sun: 0xffcf9f, sunI: 0.9, sunAt: [-26, 3, 9], sky: 0xdfe3e6, ground: 0x6f7568, hemiI: 0.5, light: 0xf7efe6, shade: 0xb6bec6, wisp: 0.55, glow: 0.55, trav: 0.35, fire: 0, petal: 0.85, bird: 1,
      skyTop: 0xe5c9b6, glowCol: 0xffd6a8, gx: 0.1, gy: 0.9, glowStr: 0.6, cloudS: 0.2, win: 0.5, bfly: 0.8, smoke: 0.9,
      gCap: 0.42, gCard: 0.28, gTint: 0.08 },
    day: { fog: 0xbfd1db, near: 9, far: 36, sun: 0xffe6c2, sunI: 1.02, sunAt: [-15, -5, 22], sky: 0xe6eef2, ground: 0x6c775d, hemiI: 0.45, light: 0xfdf8ef, shade: 0xbccad3, wisp: 0.35, glow: 0.3, trav: 0.15, fire: 0, petal: 0.75, bird: 1,
      skyTop: 0x98b8d5, glowCol: 0xfff0d2, gx: 0.86, gy: 0.96, glowStr: 0.5, cloudS: 0.34, win: 0.08, bfly: 1, smoke: 1,
      gCap: 0.4, gCard: 0.27, gTint: 0.1 },
    dusk: { fog: 0x6b7287, near: 6, far: 31, sun: 0xf5a066, sunI: 0.95, sunAt: [24, 7, 8], sky: 0x9ea3bd, ground: 0x3f4150, hemiI: 0.47, light: 0xe3c1b0, shade: 0x656a84, wisp: 0.45, glow: 1.25, trav: 0.9, fire: 0.45, petal: 0.35, bird: 0.85,
      skyTop: 0x454f70, glowCol: 0xf4a878, gx: 0.93, gy: 0.72, glowStr: 0.65, cloudS: 0.14, win: 1.0, bfly: 0.15, smoke: 0.8,
      gCap: 0.38, gCard: 0.26, gTint: 0.08 },
    night: { fog: 0x121b27, near: 5, far: 34, sun: 0xa9bddb, sunI: 0.34, sunAt: [-10, 6, 20], sky: 0x3c4c66, ground: 0x0e131b, hemiI: 0.48, light: 0x3d4c63, shade: 0x18212e, wisp: 0.3, glow: 1.9, trav: 1.3, fire: 1, petal: 0, bird: 0,
      skyTop: 0x080e18, glowCol: 0x8098bb, gx: 0.15, gy: 0.88, glowStr: 0.3, cloudS: 0.0, win: 1.45, bfly: 0, smoke: 0.45,
      gCap: 0.34, gCard: 0.23, gTint: 0.05 }
  };
  const COLOR_KEYS = ['fog', 'sun', 'sky', 'ground', 'light', 'shade', 'skyTop', 'glowCol'];
  const NUM_KEYS = ['near', 'far', 'sunI', 'hemiI', 'wisp', 'glow', 'trav', 'fire', 'petal', 'bird', 'gx', 'gy', 'glowStr', 'cloudS', 'win', 'bfly', 'smoke', 'gCap', 'gCard', 'gTint'];
  const toState = (p) => { const s = {}; COLOR_KEYS.forEach((k) => { s[k] = new T.Color(p[k]); }); NUM_KEYS.forEach((k) => { s[k] = p[k]; }); s.sunAt = W(p.sunAt[0], p.sunAt[1], p.sunAt[2]); return s; };
  const presetStates = Object.fromEntries(Object.entries(PRESETS).map(([key, preset]) => [key, toState(preset)]));
  const initialDaylight = timeOfDayAt(opts.progressSeconds || 0);
  let presetKey = initialDaylight.from;
  const cur = toState(PRESETS[presetKey]);
  const goal = toState(PRESETS[presetKey]);
  function applyDaylight(target, daylight) {
    const from = presetStates[daylight.from], to = presetStates[daylight.to];
    COLOR_KEYS.forEach((key) => target[key].copy(from[key]).lerp(to[key], daylight.blend));
    NUM_KEYS.forEach((key) => { target[key] = from[key] + (to[key] - from[key]) * daylight.blend; });
    target.sunAt.copy(from.sunAt).lerp(to.sunAt, daylight.blend);
  }
  applyDaylight(cur, initialDaylight);
  applyDaylight(goal, initialDaylight);

  // ---------- camera ----------
  const BASE_EL = 31 * Math.PI / 180, BASE_AZ = Math.PI / 4, DIST = 80;
  const target = W(0.2, 1.8, 0.8);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 300);
  let yawOff = 0, pitchOff = 0, dragging = false, lastX = 0, lastY = 0;
  let lobbyPitch = 0;                 // lobby close-up looks a little lower than Focus (see lobby camera)
  let cameraEnabled = true, cameraJumping = false, storyCameraCurrent = null, cameraOwner = 'overview';
  let cameraFollow = null, cameraVelocity = { x: 0, y: 0, z: 0 }, whaleCameraHandoff = null;
  let cameraReadout = { name: 'overview', owner: 'overview', width: 38, yaw: 0, pitch: 0, p: 0 };
  function placeCamera(storyYaw = 0, storyPitch = 0) {
    const el = BASE_EL + pitchOff + lobbyPitch + storyPitch, az = BASE_AZ + yawOff + storyYaw;
    camera.position.set(target.x + DIST * Math.cos(el) * Math.sin(az), target.y + DIST * Math.sin(el), target.z + DIST * Math.cos(el) * Math.cos(az));
    camera.lookAt(target);
  }
  // The canvas runs under the Focus Active header and footer. The whole Area is framed inside the
  // clear band between them (never enlarged to fill the text area); sky and cloud sea simply continue
  // behind the glass.
  // In the lobby a side panel covers the right edge too: the Area is framed in the band left of it.
  // In the Today lobby the app's navigation rail can sit over the left edge as glass as well (chrome.left).
  const chromeInsets = { top: 0, bottom: 0, right: 0, left: 0 };
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(skyU.uRes.value);
    glass.setSize(w, h, renderer.getPixelRatio());
    requestRedraw(200);
    const insetTop = Math.min(h * 0.3, chromeInsets.top), insetBottom = Math.min(h * 0.2, chromeInsets.bottom * 0.5);
    const insetRight = Math.min(w * 0.46, chromeInsets.right);
    const sh = Math.max(120, h - insetTop - insetBottom), sw = Math.max(160, w - insetRight);
    anchorsDirty = true;
    if (LOBBY) { if (lobbyCam.kind === 'overview') frameLobby(w, h, insetTop, insetBottom, insetRight); else lobbyCameraStep(0, true); return; }
    const aspect = sw / sh; let vw = aspect >= 1 ? 38 : 28; let vh = vw / aspect;
    if (vh < 22) { vh = 22; vw = vh * aspect; }
    const k = vw / sw, cy = insetTop + sh / 2, cx = sw / 2;
    Object.assign(camera, { left: -cx * k, right: (w - cx) * k, top: cy * k, bottom: -(h - cy) * k }); camera.updateProjectionMatrix();
    if (storyCameraCurrent) storyCameraStep(0, true);
  }
  // Lobby: fit the whole Area (islands, entry stones and both exit stairs) into the clear band, with room
  // above the high exit and below the pine exit for the route markers that hang there.
  let lobbyBox = null;
  function lobbyBounds() {
    if (lobbyBox) return lobbyBox;
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 300);
    cam.position.set(target.x + DIST * Math.cos(BASE_EL) * Math.sin(BASE_AZ), target.y + DIST * Math.sin(BASE_EL), target.z + DIST * Math.cos(BASE_EL) * Math.cos(BASE_AZ));
    cam.lookAt(target); cam.updateMatrixWorld();
    const pts = [];
    ISLANDS.forEach((I) => { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => pts.push(new T.Vector3(I.x + a * I.r, I.y + 0.6, I.z + b * I.r))); pts.push(new T.Vector3(I.x, I.y - I.depth * 0.75, I.z)); });
    pts.push(NODE.entry0.p.clone(), NODE.b_tree.p.clone().add(new T.Vector3(0, 4.4, 0)));
    Object.values(DEPART).forEach((X) => { for (let i = 0; i <= 8; i++) pts.push(X.curve.getPointAt(0.8 * i / 8)); });
    const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    pts.forEach((p) => { p.applyMatrix4(cam.matrixWorldInverse); box.x0 = Math.min(box.x0, p.x); box.x1 = Math.max(box.x1, p.x); box.y0 = Math.min(box.y0, p.y); box.y1 = Math.max(box.y1, p.y); });
    lobbyBox = box; return box;
  }
  function frameLobby(w, h, insetTop, insetBottom, insetRight) {
    lobbyPitch = 0; placeCamera();
    const b = lobbyBounds();
    const mL = Math.max(18, w * 0.03), mR = Math.max(24, w * 0.03), mT = Math.max(64, h * 0.09), mB = Math.max(64, h * 0.09);
    const x0 = mL, x1 = Math.max(x0 + 160, w - insetRight - mR), y0 = insetTop + mT, y1 = Math.max(y0 + 120, h - insetBottom - mB);
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const k = Math.max(bw / (x1 - x0), bh / (y1 - y0));
    const left = b.x0 - k * (x0 + ((x1 - x0) - bw / k) / 2);
    const top = b.y1 + k * (y0 + ((y1 - y0) - bh / k) / 2);
    Object.assign(camera, { left, right: left + w * k, top, bottom: top - h * k }); camera.updateProjectionMatrix();
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  if (resizeObserver) resizeObserver.observe(host);
  canvas.addEventListener('pointerdown', (e) => { if (isPaused() || cinematic || opts.reducedMotion) return; dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.classList.add('dragging'); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; yawOff = Math.max(-1.3, Math.min(1.3, yawOff - (e.clientX - lastX) * 0.006)); pitchOff = Math.max(-0.35, Math.min(0.6, pitchOff + (e.clientY - lastY) * 0.004)); lastX = e.clientX; lastY = e.clientY; });
  const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  // ---------- traveller planner (presentation only — focus time is the only authority) ----------
  const WALK = 0.35;                                  // world units per second (traveller is ~0.95 tall)
  const SPOT = {}; AREA.spots.forEach((s) => { SPOT[s.id] = s; });
  // Only quiet, visual-only events play locally. Events that create a record (notes, discoveries,
  // special finds) wait for back-end signals, so the scene never shows a result the save does not have.
  const EVENTS = AREA.events.filter((ev) => ev.outcome === 'ambient' && !ev.rare);
  const pendingSpecialFinds = [];
  const presentedSpecialFinds = new Set();
  let planned = Math.max(60, opts.targetSeconds || 1500);
  let reported = Math.max(0, opts.progressSeconds || 0);
  let reportedAt = sceneNow();
  let lastIncreaseAt = sceneNow() - 10000;
  let sim = reported;
  let playing = false;
  let lampsLit = 0;
  let lastLightsReport = -1;
  const usedOnce = new Set();
  // entry0 is the approach curve endpoint, outside the first rendered stepping stone.
  // Start and restore on the island's entrance flagstone instead.
  const SPAWN_NODE = 'a_gate';
  const TR = { node: SPAWN_NODE, state: 'idle', t: 0, dur: 0, route: null, u: 0, purpose: null, act: null, recent: [], heading: 0, phase: 0, waitPose: 'idle', waitT: 0, restLast: null, effectDone: false, dep: null };
  TR.heading = headingTo(NODE[SPAWN_NODE].p, NODE.a_mid.p);
  const lampNode = (k) => AREA.lamps[k].node;
  const due = (k) => AREA.lamps[k].dueAt * planned;                       // equal fifths; the fifth at 100%
  const lampsDueAt = (s) => litLampCount(s, planned);
  const LIGHT_SECONDS = 3.2;
  const allowed = (ev) => (!ev.once || !usedOnce.has(ev.id)) && (!ev.time || ev.time.indexOf(presetKey) >= 0) && ev.spot !== TR.node && TR.recent.indexOf(ev.spot) < 0;
  // 50-minute explorations: an event seen in the last ~15 minutes is rarely picked again, in the last
  // ~30 minutes less often, so a full exploration does not visibly loop.
  const lastDoneAt = {};
  const freshness = (ev) => { const t = lastDoneAt[ev.id]; if (t === undefined) return 1; const ago = sim - t; return ago < 900 ? 0.08 : ago < 1800 ? 0.45 : 1; };
  // short pauses between events: the traveller stops, looks around, stretches
  const LINGER = [
    { id: 'linger_look', name: '停下腳步，看了看四周', anim: 'gaze', dur: [12, 22] },
    { id: 'linger_stretch', name: '伸了個懶腰', anim: 'stretch', dur: [8, 14] },
    { id: 'linger_wind', name: '在路邊站了一會，聽風吹過草地', anim: 'idle', dur: [14, 26] }
  ];
  // one-time: noticing the traces beside the big tree (needs a saved world mark to stay one-time)
  const marks = Array.isArray(opts.worldMarks) ? new Set(opts.worldMarks) : null;
  let tracesPending = false, tracesShown = false;
  const TRACE_FIRST = { id: 'rest_traces_first', spot: 'b_tree', name: '在樹旁停下來，看著一塊被壓平的草地', anim: 'traces', face: TRACE.lookUV, dur: [46, 46] };
  setCoreTaken(!!opts.coreTaken, false);
  // =====================================================================================
  // Story events for 雲上遺庭 (core plan §49.5 / §49.6, design 2026-09-29)
  // Presentation only. In the App, Codex decides eligibility and timing from saved state
  // (visit count, first journey, carried journey items) and saves the clue records; the
  // scene only plays what it is asked to play and reports when a record-bearing event ends.
  // =====================================================================================
  const STORY = Object.assign({ visit: 1, opening: false, items: [], whaleSeed: 7 }, opts.story || {});
  const hasItem = (k) => (STORY.items || []).indexOf(k) >= 0;
  const storyQueue = [];
  let cinematic = false;
  function setCinematic(on) { if (cinematic === on) return; cinematic = on; if (on) endDrag(); try { opts.reportCinematic(on); } catch (_) {} }
  function storyRecord(id) { try { opts.reportStoryRecord(id); } catch (_) {} }
  const TREE_C = bigTree.position.clone();
  const FALL_FAR = LIP.p.clone().addScaledVector(LIP.out, 9); FALL_FAR.y = -4.5;
  const faceTree = (p, pos) => headingTo(pos, TREE_C);
  const SE = {
    opening_a: { id: 'story_opening_a', story: 'notebook', spot: 'a_bridge', anim: 'story', dur: [26, 26], cinematic: true,
      name: '在橋頭停下來，翻開筆記的第一頁', walkMsg: '旅人往石拱橋頭走去', faceAt: faceTree },
    opening_b: { id: 'story_opening_b', story: 'touchTree', spot: 'b_tree', anim: 'story', dur: [14, 14], cinematic: true, record: 'c01_first_tree', endCinematic: true,
      name: '走到大樹下，把手貼在樹幹上', walkMsg: '旅人闔上筆記，走過石橋，往那棵大樹走去', faceAt: faceTree },
    notebook_a: { id: 'story_notebook_a', story: 'notebook', spot: 'a_bridge', anim: 'story', dur: [26, 26],
      name: '在橋頭停下來，翻開筆記的第一頁', walkMsg: '旅人往石拱橋頭走去', faceAt: faceTree },
    notebook_b: { id: 'story_notebook_b', story: 'touchTree', spot: 'b_tree', anim: 'story', dur: [14, 14], record: 'c01_first_tree',
      name: '走到大樹下，把手貼在樹幹上', walkMsg: '旅人闔上筆記，往那棵大樹走去', faceAt: faceTree },
    stele: { id: 'story_stele_scale', story: 'steleScale', spot: 'a_stele', anim: 'story', dur: [40, 40], record: 'c01_stele_scale',
      name: '蹲在索引石碑前，手指順著碑緣摸下來' },
    well: { id: 'story_well_lights', story: 'wellLights', spot: 'b_well', anim: 'story', dur: [48, 48], record: 'h1a',
      name: '探頭往古井裡看，愣住了', faceAt: (p, pos) => p < 0.5 ? headingTo(pos, well.g.position) : headingTo(pos, FALL_FAR) },
    rubbing: { id: 'item_rubbing', story: 'rubbing', spot: 'a_stele', anim: 'story', dur: [44, 44], record: 'c01_rubbing', item: 'charcoal_paper',
      name: '把炭印紙貼在石碑上，拓碑上被磨掉的那一行' },
    leafTag: { id: 'item_leaf_tag', story: 'leafTag', spot: 'b_tree', anim: 'story', dur: [42, 42], record: 'c01_tag', item: 'pressed_leaf',
      name: '拿出壓葉標本，對著大樹的葉子比', faceAt: faceTree },
    whistle: { id: 'item_whistle', story: 'whistle', spot: 'a_edge', anim: 'story', dur: [22, 22], item: 'wind_whistle',
      name: '站在島緣，對著雲海吹響風哨' }
  };
  // When each event becomes eligible (effective seconds into this exploration). Prototype defaults; the
  // App's rules are in docs/AREA_01_STORY_EVENTS.md.
  const storySched = [];
  if (STORY.visit === 1) storySched.push(STORY.opening ? { at: 40, evs: ['opening_a', 'opening_b'], forced: true } : { at: 240, evs: ['notebook_a', 'notebook_b'] });
  if (STORY.visit === 2) { storySched.push({ at: 60, evs: ['stele'] }); storySched.push({ at: 1260, evs: ['well'] }); }
  if (hasItem('wind_whistle')) storySched.push({ at: 150, evs: ['whistle'] });
  if (hasItem('charcoal_paper')) storySched.push({ at: 330, evs: ['rubbing'] });
  if (hasItem('pressed_leaf')) storySched.push({ at: 1320, evs: ['leafTag'] });
  function scheduleStory() {
    storySched.forEach((s) => { if (!s.done && sim >= s.at) { s.done = true; s.evs.forEach((k) => storyQueue.push(Object.assign({ forced: !!s.forced }, SE[k]))); } });
  }
  function storyTick() {
    if (LOBBY || (TR.dep && !TR.dep.done)) return false;
    scheduleStory();
    if (!storyQueue.length) return whaleLinger();
    const ev = storyQueue[0];
    const L = lampNode(Math.min(lampsLit, 4));
    const fits = lampsLit >= 5 || ev.forced || fitsBeforeLamp(due(lampsLit) - sim, D(TR.node, ev.spot) / WALK, ev.dur[0], D(ev.spot, L) / WALK);
    if (!fits) return false;
    storyQueue.shift();
    if (ev.cinematic) setCinematic(true);
    if (TR.node === ev.spot) startAct(ev, ev.dur[0]);
    else walkTo(ev.spot, { type: 'event', ev, dur: ev.dur[0], walkMsg: ev.walkMsg || ('旅人往' + (SPOT[ev.spot] ? SPOT[ev.spot].name : '那裡') + '走去') });
    return true;
  }
  function storyFinish(ev) {
    if (ev.record) storyRecord(ev.record);
    if (ev.endCinematic) setCinematic(false);
  }

  // ---- visuals: the notebook sketch laid over the real tree ----
  let sketch = null;
  function buildSketch() {
    const N = 512, S = 8.6;
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 300);
    cam.position.set(target.x + DIST * Math.cos(BASE_EL) * Math.sin(BASE_AZ), target.y + DIST * Math.sin(BASE_EL), target.z + DIST * Math.cos(BASE_EL) * Math.cos(BASE_AZ));
    cam.lookAt(target); cam.updateMatrixWorld();
    const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    bigTree.updateMatrixWorld(true);
    const C = bigTree.localToWorld(new T.Vector3(0.1, 2.05, 0));
    const px = (P) => { const d = P.clone().sub(C); return [(d.dot(right) / S + 0.5) * N, (0.5 - d.dot(up) / S) * N]; };
    const full = document.createElement('canvas'); full.width = full.height = N; const x = full.getContext('2d');
    const blobs = [], limbs = [];
    const ws = new T.Vector3();
    bigTree.traverse((o) => {
      if (!o.isMesh) return;
      if (o.geometry.type === 'IcosahedronGeometry') { o.getWorldScale(ws); blobs.push({ c: px(o.getWorldPosition(new T.Vector3())), r: o.geometry.parameters.radius * ws.x / S * N }); }
      else if (o.geometry.type === 'CylinderGeometry' && o.parent === bigTree && o.geometry.parameters.height > 0.3) {
        o.getWorldScale(ws);
        const A = o.localToWorld(new T.Vector3(0, 0, 0)), B = o.localToWorld(new T.Vector3(0, o.geometry.parameters.height, 0));
        if (B.y < A.y + 0.2) return;                    // roots stay out of the drawing
        const a = px(A), b = px(B);
        limbs.push({ a, b, r0: o.geometry.parameters.radiusBottom * ws.x / S * N, r1: o.geometry.parameters.radiusTop * ws.x / S * N });
      }
    });
    const wob = (i, k) => Math.sin(i * 12.9898 + k * 4.1) * 0.5;
    const blobPath = (b, shrink) => { x.beginPath(); for (let i = 0; i <= 44; i++) { const a = i / 44 * Math.PI * 2; const r = (b.r - shrink) * (1 + 0.03 * Math.sin(a * 5 + b.c[0] * 0.07)); const X = b.c[0] + Math.cos(a) * r, Y = b.c[1] + Math.sin(a) * r * 0.86; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.closePath(); };
    const limbLines = () => limbs.forEach((l, i) => {
      const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      [-1, 1].forEach((s) => { x.beginPath(); x.moveTo(l.a[0] + nx * l.r0 * s + wob(i, s), l.a[1] + ny * l.r0 * s); x.quadraticCurveTo((l.a[0] + l.b[0]) / 2 + nx * (l.r0 + l.r1) / 2 * s * 1.08, (l.a[1] + l.b[1]) / 2 + ny * (l.r0 + l.r1) / 2 * s, l.b[0] + nx * l.r1 * s, l.b[1] + ny * l.r1 * s); x.stroke(); });
    });
    x.lineCap = 'round'; x.lineJoin = 'round';
    [['rgba(250,244,228,0.6)', 12], ['rgba(46,34,24,0.95)', 5.5]].forEach(([col, w]) => {
      x.strokeStyle = col; x.lineWidth = w; limbLines(); blobs.forEach((b) => { blobPath(b, 0); x.stroke(); });
    });
    // keep only the outer outline of the crown (the notebook drawing has no inner lines)
    x.globalCompositeOperation = 'destination-out'; blobs.forEach((b) => { blobPath(b, 8); x.fill(); }); x.globalCompositeOperation = 'source-over';
    // a few quick hatch strokes for leaves, and the ground line
    x.strokeStyle = 'rgba(46,34,24,0.8)'; x.lineWidth = 3;
    blobs.slice(0, 7).forEach((b, i) => { x.beginPath(); x.arc(b.c[0] + wob(i, 1) * 10, b.c[1] + 6, b.r * 0.45, 3.6, 4.6); x.stroke(); });
    const base = limbs.length ? limbs[0].a : [N / 2, N * 0.8];
    x.lineWidth = 4; x.beginPath(); x.moveTo(base[0] - 70, base[1] + 6); x.quadraticCurveTo(base[0], base[1] - 2, base[0] + 80, base[1] + 8); x.stroke();
    // handwriting (appears after the drawing)
    const hand = document.createElement('canvas'); hand.width = hand.height = N; const h = hand.getContext('2d');
    h.font = '600 32px "LXGW WenKai TC", "Noto Serif TC", serif'; h.textBaseline = 'middle';
    h.lineWidth = 10; h.strokeStyle = 'rgba(250,244,228,0.6)'; h.strokeText('從這裡開始。', base[0] - 65, base[1] + 44);
    h.fillStyle = 'rgba(46,34,24,0.95)'; h.fillText('從這裡開始。', base[0] - 65, base[1] + 44);
    const view = document.createElement('canvas'); view.width = view.height = N;
    const tex = new T.CanvasTexture(view);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    sp.position.copy(C); sp.scale.set(S, S, 1); sp.renderOrder = 20; sp.visible = false; scene.add(sp);
    sketch = { sp, tex, view, full, hand, base, N, last: -1 };
  }
  function drawSketch(reveal, write, alpha) {
    if (!sketch) buildSketch();
    const s = sketch; s.sp.visible = alpha > 0.002;
    const key = reveal.toFixed(3) + write.toFixed(3) + alpha.toFixed(3);
    if (!s.sp.visible || key === s.last) return; s.last = key;
    const v = s.view.getContext('2d'); v.clearRect(0, 0, s.N, s.N);
    v.save(); v.globalAlpha = alpha; v.beginPath(); v.arc(s.base[0], s.base[1], reveal * s.N * 1.15, 0, Math.PI * 2); v.clip(); v.drawImage(s.full, 0, 0); v.restore();
    if (write > 0) { v.save(); v.globalAlpha = alpha * write; v.beginPath(); v.rect(0, 0, s.base[0] + 20 + write * 290, s.N); v.clip(); v.drawImage(s.hand, 0, 0); v.restore(); }
    s.tex.needsUpdate = true;
  }

  // ---- visuals: falling leaves when the traveller touches the trunk ----
  const leafMat = new T.MeshStandardMaterial({ color: 0x7f9a66, roughness: 1, side: T.DoubleSide });
  const fallingLeaves = [];
  function dropLeaves(n) {
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(0.09, 0.06), leafMat);
      m.position.copy(bigTree.localToWorld(new T.Vector3(-0.6 + i * 0.25, 2.2 + (i % 3) * 0.2, 0.5 + (i % 2) * 0.3)));
      scene.add(m); fallingLeaves.push({ m, t: 0, ph: i * 1.7, sp: 0.35 + (i % 3) * 0.08 });
    }
  }

  // ---- visuals: the lights in the well, drifting toward the waterfall ----
  const wellLights = (function () {
    const g = new T.Group(); scene.add(g);
    const dots = [];
    for (let i = 0; i < 6; i++) {
      // drawn over the well's rim: from this camera the water itself is hidden behind the ring
      const sp = new T.Sprite(new T.SpriteMaterial({ map: amberTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, fog: false }));
      sp.scale.setScalar(0.34); sp.renderOrder = 15; g.add(sp); dots.push(sp);
    }
    const mouth = new T.Sprite(new T.SpriteMaterial({ map: amberTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    mouth.scale.setScalar(1.1); g.add(mouth);
    const far = new T.Sprite(new T.SpriteMaterial({ map: amberTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, fog: false }));
    far.scale.setScalar(2.2); far.renderOrder = 15; far.position.copy(FALL_FAR); g.add(far);
    return { g, dots, mouth, far };
  })();
  function drawWellLights(p) {
    const W0 = well.g.localToWorld(new T.Vector3(0, 0.56, 0));
    const lip = LIP.p.clone().add(new T.Vector3(0, 0.3, 0));
    wellLights.mouth.position.copy(W0).add(new T.Vector3(0, 0.12, 0));
    const inWell = p > 0.08 && p < 0.5 ? Math.min(1, (p - 0.08) / 0.1) : 0;
    wellLights.mouth.material.opacity = inWell * 0.6 * (0.85 + 0.15 * Math.sin(tAcc * 2));
    wellLights.dots.forEach((d, i) => {
      const k = i / 5;
      if (p < 0.5) {
        // a short string of lights on the water, as if reflected from lamps that are not there
        d.position.set(W0.x + (k - 0.5) * 0.52, W0.y, W0.z + Math.sin(k * 3 + tAcc * 0.4) * 0.08);
        d.material.opacity = inWell * (0.75 + 0.25 * Math.sin(tAcc * 1.7 + i));
      } else {
        // then they rise out of the well one by one and drift over the lip of the waterfall, down into the sea
        const q = Math.max(0, Math.min(1, (p - 0.5 - k * 0.05) / 0.32));
        const P = W0.clone().lerp(lip, Math.min(1, q * 1.4));
        if (q > 0.7) P.lerp(FALL_FAR, (q - 0.7) / 0.3);
        P.y += Math.sin(Math.PI * Math.min(1, q * 1.4)) * 0.8;
        d.position.copy(P); d.material.opacity = q > 0 && q < 1 ? 0.75 * (1 - Math.max(0, q - 0.75) * 4) : 0;
      }
    });
    const fq = p > 0.86 && p < 1 ? Math.sin(Math.PI * (p - 0.86) / 0.14) : 0;
    wellLights.far.material.opacity = fq * 0.8;
  }

  // ---- visuals: the index stele's edge scale, the rubbing paper ----
  const steleGlint = new T.Sprite(new T.SpriteMaterial({ map: amberTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  steleGlint.scale.setScalar(0.45); scene.add(steleGlint);
  const rubPaper = (function () {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 176;
    const tex = new T.CanvasTexture(cv);
    const m = new T.Mesh(new T.PlaneGeometry(0.3, 0.41), new T.MeshStandardMaterial({ map: tex, roughness: 1, side: T.DoubleSide, transparent: true }));
    m.scale.setScalar(1.5); m.visible = false; scene.add(m);
    return { m, cv, tex, last: -1 };
  })();
  function drawRubbing(rev) {
    if (Math.abs(rev - rubPaper.last) < 0.004) return; rubPaper.last = rev;
    const x = rubPaper.cv.getContext('2d'), Wd = 128, H = 176;
    x.fillStyle = '#e9e1cc'; x.fillRect(0, 0, Wd, H);
    rubPaper.tex.needsUpdate = true;
  }

  // ---- visuals: the pressed leaf in hand, the tag on the branch, the whistle rings ----
  const handLeaf = mesh(new T.PlaneGeometry(0.1, 0.07), new T.MeshStandardMaterial({ color: 0x9aa56a, roughness: 1, side: T.DoubleSide }), armL, 0, -0.31, 0.03);
  const leafShape = new T.Shape(); leafShape.moveTo(0, -.1);
  leafShape.bezierCurveTo(-.09, -.03, -.05, .07, 0, .12); leafShape.bezierCurveTo(.07, .05, .08, -.03, 0, -.1);
  handLeaf.geometry.dispose(); handLeaf.geometry = new T.ShapeGeometry(leafShape); handLeaf.material.color.setHex(0xb0b67c);
  handLeaf.visible = false;
  const treeTag = (function () {
    // hangs under the crown, left of the trunk, where the camera can see it
    const g = new T.Group(); g.position.set(-0.45, 1.7, 1.1); bigTree.add(g);
    mesh(new T.CylinderGeometry(0.004, 0.004, 0.3, 3), M.rope, g, 0, -0.15, 0);
    const card = mesh(new T.BoxGeometry(0.1, 0.13, 0.012), mat(0xc4ad84), g, 0, -0.36, 0);
    card.scale.set(2.4, 2.4, 1); return { g, card, swing: 0 };
  })();
  const ringTex = (function () { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.stroke(); return new T.CanvasTexture(c); })();
  const soundRings = [];
  function emitRing() {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: ringTex, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
    sp.position.copy(trav.position).add(new T.Vector3(0, 1.05, 0)); scene.add(sp); soundRings.push({ sp, t: 0 });
  }

  // ---- the map's own ambient variation: a cloud whale passing (design 2026-09-29) ----
  // Like the Moss Station weather: a pure function of effective seconds and a seed, never touching
  // lamps or rewards. Rolls every 240 s, 6% chance, 80 s pass, no new pass within 720 s of the last.
  const WHALE = { every: 240, chance: 0.06, dur: 80, cooldown: 720 };
  const hash01 = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  function whaleStartAt(seed, s) {
    let last = -1e9;
    for (let k = 1; k <= Math.floor(s / WHALE.every); k++) {
      const t0 = k * WHALE.every;
      if (t0 < last + WHALE.dur + WHALE.cooldown) continue;
      if (hash01(seed, k) < WHALE.chance) last = t0 + hash01(seed + 99, k) * 40;
    }
    return s >= last && s < last + WHALE.dur ? last : -1;
  }
  let whaleForced = -1e9, whaleSeenStart = -1e9;
  const whale = (function () {
    const g = new T.Group(); g.visible = false; scene.add(g);
    const wm = new T.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
    const segs = [];
    // a long, tapering body; cloud lumps only along the back; broad fins and flukes
    const R = [1.05, 1.5, 1.68, 1.6, 1.38, 1.08, 0.78, 0.5, 0.32];
    R.forEach((r, i) => {
      const sg = new T.Group(); sg.position.x = -i * 1.4; g.add(sg);
      const m = new T.Mesh(new T.SphereGeometry(1, 18, 12), wm); m.scale.set(r * 1.2, r * (i === 0 ? 0.72 : 0.8), r * 0.95); sg.add(m);
      if (i > 0 && i < R.length - 2) for (let j = 0; j < 2; j++) { const b = new T.Mesh(new T.SphereGeometry(1, 10, 8), wm); const s = r * (0.36 + 0.08 * ((i + j) % 2)); b.scale.set(s * 1.2, s * 0.75, s); b.position.set((j - 0.5) * r * 0.7, r * 0.58, ((i + j) % 2 ? 0.18 : -0.18) * r); sg.add(b); }
      segs.push(sg);
    });
    const fin = (side) => { const f = new T.Mesh(new T.SphereGeometry(1, 14, 8), wm); f.scale.set(1.7, 0.1, 0.5); f.position.set(-1.3, -0.75, side * 1.55); f.rotation.y = side * 0.55; f.rotation.x = side * 0.3; segs[1].add(f); return f; };
    const fins = [fin(1), fin(-1)];
    const fluke = new T.Group(); fluke.position.x = -0.35; segs[R.length - 1].add(fluke);
    [1, -1].forEach((side) => { const f = new T.Mesh(new T.SphereGeometry(1, 14, 8), wm); f.scale.set(0.95, 0.09, 1.35); f.position.set(-0.75, 0, side * 1.05); f.rotation.y = side * 0.75; fluke.add(f); });
    return { g, wm, segs, fins, fluke, vis: 0, u: 0 };
  })();
  const whaleDir = W(1, 0, 0).normalize();
  function whaleState() {
    const t0 = sim - whaleForced < WHALE.dur && sim >= whaleForced ? whaleForced : whaleStartAt(STORY.whaleSeed, sim);
    return t0 < 0 ? null : { t0, q: (sim - t0) / WHALE.dur };
  }
  function drawWhale(dt) {
    const st = whaleState();
    const want = st ? Math.min(1, st.q / 0.1, (1 - st.q) / 0.1) : 0;
    whale.vis += (want - whale.vis) * (1 - Math.exp(-dt * 3));
    whale.g.visible = whale.vis > 0.01;
    whaleU.value.z = 0;
    if (!whale.g.visible) return;
    const q = st ? st.q : 1;
    const u = -44 + 88 * q;
    whale.g.position.copy(W(u, 4 + Math.sin(q * 3) * 1.0, 8.3 + Math.sin(q * 5) * 0.3));   // the sky band above the islands
    whale.g.rotation.y = Math.atan2(-whaleDir.z, whaleDir.x);
    whale.segs.forEach((s, i) => { s.position.y = Math.sin(sim * 0.9 - i * 0.55) * 0.18 * (i / 4); s.rotation.z = Math.cos(sim * 0.9 - i * 0.55) * 0.05 * (i / 4); });
    whale.fluke.rotation.z = Math.sin(sim * 0.9 - 4.2) * 0.35;
    whale.fins.forEach((f, i) => { f.rotation.x = (i ? -1 : 1) * (0.35 + Math.sin(sim * 0.7) * 0.15); });
    whale.wm.color.copy(cur.light).lerp(WHITE, 0.55);
    whale.wm.emissive.copy(cur.light).multiplyScalar(0.18);
    whale.wm.opacity = whale.vis * 0.7;
    // its soft shadow slides over the islands (along the sun direction onto the island height)
    const sd = sun.position.clone().sub(sun.target.position).normalize();
    const c = whale.g.position.clone().addScaledVector(whaleDir, -3.5);
    const sh = c.clone().addScaledVector(sd, -(c.y - 1.0) / Math.max(0.2, sd.y));
    whaleU.value.set(sh.x, sh.z, whale.vis * 0.3 * Math.min(1, cur.sunI), 0);
    whaleAxU.value.set(whaleDir.x, whaleDir.z);
    whale.u = u;
  }
  function whaleLinger() {
    // during a pass, the traveller stops wherever it is and looks up (once per pass)
    const st = whaleState();
    if (!st || st.q > 0.7 || whaleSeenStart === st.t0 || cinematic) return false;
    const L = lampNode(Math.min(lampsLit, 4));
    const dur = 18;
    if (lampsLit < 5 && !fitsBeforeLamp(due(lampsLit) - sim, 0, dur, D(TR.node, L) / WALK)) return false;
    whaleSeenStart = st.t0;
    startAct({ id: 'linger_whale', spot: TR.node, name: '停下腳步，抬頭看一頭雲做的鯨慢慢游過', anim: 'story', story: 'watchWhale', dur: [dur, dur] }, dur);
    return true;
  }

  function storyPose(kind, p, tgt, tt) {
    const set = (o) => Object.assign(tgt, o);
    if (kind === 'notebook') {
      if (p < 0.1) set({ armL: -0.3 });
      else if (p < 0.34) set({ book: 1, armL: -1.0, headX: 0.45 });                  // reading the first page
      else if (p < 0.8) set({ book: 1, armL: -2.0, headX: -0.28, lean: -0.05 });     // holding the page up against the tree
      else set({ book: p < 0.9 ? 1 : 0, armL: -0.6, headX: -0.1 });
    } else if (kind === 'touchTree') {
      if (p < 0.12) set({ headX: -0.3 });
      else if (p < 0.72) set({ armL: -1.55, headX: -0.15, lean: 0.08 });
      else set({ headX: -0.5 });                                                     // looking up into the crown
    } else if (kind === 'steleScale') {
      set(POSE.crouch);
      if (p > 0.2 && p < 0.7) set({ armL: -1.55 + (p - 0.2) / 0.5 * 0.7, headX: 0.35 });
      else if (p >= 0.7) set({ book: 1, armL: -0.9, headX: 0.5 });
    } else if (kind === 'wellLights') {
      if (p < 0.42) set({ lean: 0.45, headX: 0.62, armL: -0.5 });
      else if (p < 0.52) set({ headX: -0.05 });
      else set({ headX: -0.08 + Math.sin(tt * 0.4) * 0.03 });
    } else if (kind === 'rubbing') {
      if (p < 0.65) { set(POSE.crouch); set({ armL: -1.25, armLz: p > 0.15 ? Math.sin(tt * 9) * 0.12 : 0, headX: 0.35 }); }
      else if (p < 0.88) set({ armL: -1.95, armLz: -.75, headX: -0.2 });
      else set({ armL: -0.4 });
    } else if (kind === 'leafTag') {
      if (p < 0.36) set({ armL: -1.95, armLz: -.9, headX: -0.4 });
      else if (p < 0.5) set({ headX: -0.1, headY: Math.sin(tt * 0.9) * 0.45 });
      else if (p < 0.75) set({ armL: -1.75, headX: -0.3 });
      else set({ lean: 0.18, headX: 0.25, armL: -1.1 });
    } else if (kind === 'whistle') {
      if (p > 0.1 && p < 0.45) set(POSE.drink);
      else if (p >= 0.45) set({ headX: -0.45 });
    } else if (kind === 'watchWhale') {
      set({ headX: -0.5 });
    }
  }
  function storyFrame(dt) {
    drawWhale(dt);
    const a = TR.state === 'act' && TR.act && TR.act.story ? TR.act : null;
    const k = a ? a.story : '', p = a ? Math.min(1, TR.t / TR.dur) : 0;
    // notebook sketch over the tree
    if (k === 'notebook') drawSketch(Math.max(0, Math.min(1, (p - 0.36) / 0.2)), Math.max(0, Math.min(1, (p - 0.56) / 0.1)), p < 0.8 ? 1 : Math.max(0, 1 - (p - 0.8) / 0.12));
    else if (sketch && sketch.sp.visible) drawSketch(1, 1, 0);
    if (a && k === 'notebook' && !TR.sn1 && p > 0.36) { TR.sn1 = true; setStatus('旅人把筆記舉起來，對著遠處那棵大樹比了比'); }
    if (a && k === 'notebook' && !TR.sn2 && p > 0.6) { TR.sn2 = true; setStatus('筆記第一頁的大樹，和眼前這一棵一模一樣'); }
    if (a && k === 'touchTree' && !TR.sn1 && p > 0.3) { TR.sn1 = true; dropLeaves(7); setStatus('旅人把手貼在樹幹上，幾片葉子落了下來'); }
    // well
    if (k === 'wellLights') { drawWellLights(p); if (!TR.sn1 && p > 0.12) { TR.sn1 = true; setStatus('井底的水面上有一串燈的倒影，井邊卻一盞燈也沒有'); } if (!TR.sn2 && p > 0.52) { TR.sn2 = true; setStatus('旅人起身，望向瀑布落下去的那一頭'); } }
    else if (wellLights.mouth.material.opacity > 0 || wellLights.far.material.opacity > 0) { wellLights.mouth.material.opacity = 0; wellLights.far.material.opacity = 0; wellLights.dots.forEach((d) => { d.material.opacity = 0; }); }
    // stele edge ticks light up under the finger
    const sweep = k === 'steleScale' && p > 0.2 && p < 0.7 ? (p - 0.2) / 0.5 : -1;
    stele.ticks.forEach((m, i) => { const d = sweep < 0 ? 9 : Math.abs(i / (stele.ticks.length - 1) - sweep); m.material.emissiveIntensity += ((d < 0.14 ? 1.6 * (1 - d / 0.14) : 0) - m.material.emissiveIntensity) * Math.min(1, dt * 8); });
    steleGlint.material.opacity += ((sweep >= 0 ? 0.55 : 0) - steleGlint.material.opacity) * Math.min(1, dt * 6);
    if (sweep >= 0) steleGlint.position.copy(stele.slab.localToWorld(new T.Vector3(0.27, 0.48 - sweep * 0.98, 0.1)));
    if (k === 'steleScale' && !TR.sn1 && p > 0.25) { TR.sn1 = true; setStatus('碑的邊緣有一排很細的刻度，旅人順著摸了下來'); }
    // rubbing paper
    if (k === 'rubbing') {
      rubPaper.m.visible = p > 0.12 && p < 0.95;
      if (p < 0.65) { rubPaper.m.position.copy(stele.slab.localToWorld(new T.Vector3(0.0, 0.3, 0.1))); rubPaper.m.quaternion.copy(stele.slab.getWorldQuaternion(new T.Quaternion())); drawRubbing(Math.max(0, Math.min(1, (p - 0.15) / 0.48))); }
      else { const hand = armL.localToWorld(new T.Vector3(0, -.31, .03)).add(new T.Vector3(0, .17, 0)); rubPaper.m.position.copy(hand); drawRubbing(1); rubPaper.m.lookAt(camera.position); }
      if (!TR.sn1 && p > 0.4) { TR.sn1 = true; setStatus('旅人按住炭印紙，在碑面上來回拓印'); }
    } else if (rubPaper.m.visible) rubPaper.m.visible = false;
    if (k === 'rubbing' && p >= .65 && !TR.sn2) { TR.sn2 = true; setStatus('旅人把紙舉起來，停下來查看'); }
    // pressed leaf and the tag on the branch
    handLeaf.visible = k === 'leafTag' && p < 0.5;
    TRACE.date.scale.setScalar(TR.state === 'act' && TR.act?.id === TRACE_FIRST.id ? 2.3 : 1);
    if (k === 'leafTag' && p > 0.55 && !TR.sn1) { TR.sn1 = true; treeTag.swing = 1; setStatus('葉形一模一樣。低處的樹枝上還綁著一塊小木牌'); }
    treeTag.swing *= Math.exp(-dt * 0.5); treeTag.g.rotation.z = Math.sin(tAcc * 3.2) * 0.35 * treeTag.swing; treeTag.g.rotation.x = Math.cos(tAcc * 2.1) * 0.12 * treeTag.swing;
    // whistle
    if (k === 'whistle') {
      [0.16, 0.26, 0.36].forEach((m, i) => { if (p > m && !TR['ring' + i]) { TR['ring' + i] = true; emitRing(); } });
      if (p > 0.5 && !TR.sn1) { TR.sn1 = true; whaleForced = sim + 2; setStatus('遠處的雲海回了一聲，像有什麼很大的東西在翻身'); }
    }
    for (let i = soundRings.length - 1; i >= 0; i--) { const r = soundRings[i]; r.t += dt; r.sp.scale.setScalar(0.3 + r.t * 1.4); r.sp.position.addScaledVector(W(-1, -0.4, 0).normalize(), dt * 1.2); r.sp.material.opacity = Math.max(0, 0.7 - r.t * 0.28); if (r.t > 2.5) { scene.remove(r.sp); soundRings.splice(i, 1); } }
    for (let i = fallingLeaves.length - 1; i >= 0; i--) { const l = fallingLeaves[i]; l.t += dt; l.m.position.y -= dt * l.sp; l.m.position.x += Math.sin(l.t * 2 + l.ph) * dt * 0.3; l.m.rotation.set(l.t * 2 + l.ph, l.t * 1.3, l.ph); if (l.t > 5 || l.m.position.y < 0.82) { scene.remove(l.m); fallingLeaves.splice(i, 1); } }
    if (a && a.id === SE.opening_b.id && p >= .9 && !TR.uiReturning) { TR.uiReturning = true; try { opts.reportCinematic(false); } catch (_) {} }
    // the traveller looks up at the whale wherever it is
    if (whale.vis > 0.3 && !a) TR.whaleLook = true; else TR.whaleLook = false;
    if (whale.vis > 0.05 && !TR.whaleSaid && whaleState() && !cinematic && !(a && a.record)) { TR.whaleSaid = true; setStatus('一頭雲做的鯨，從浮島上方慢慢游過'); }
    if (!whaleState()) TR.whaleSaid = false;
  }
  // ---------- story camera (scene progress only; lobby/departure retain their own framing) ----------
  function standardCameraShot() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    const top = Math.min(h * .3, chromeInsets.top), bottom = Math.min(h * .2, chromeInsets.bottom * .5);
    const sw = Math.max(160, w - Math.min(w * .46, chromeInsets.right)), sh = Math.max(120, h - top - bottom);
    const aspect = sw / sh; let width = aspect >= 1 ? 38 : 28;
    if (width / aspect < 22) width = 22 * aspect;
    return { x: target.x, y: target.y, z: target.z, width, yaw: 0, pitch: 0, cx: sw / w / 2, cy: .5, overview: 1, golden: 0 };
  }
  function whaleCameraShot(st, baseline) {
    if (!st) return baseline;
    const shift = Math.max(-4, Math.min(4, (st.q - .5) * 88 * .3));
    const f = target.clone().add(W(shift, 0, 5));
    const wide = { x: f.x, y: f.y, z: f.z, width: 46, yaw: 0, pitch: -.15, cx: .5, cy: .54, overview: 0, golden: 0, follow: true };
    if (st.q < .1) return mixCamera(baseline, wide, easeInOutCubic(st.q / .1));
    if (st.q > .9) return mixCamera(wide, baseline, easeInOutCubic((st.q - .9) / .1));
    return wide;
  }
  function currentStoryCamera() {
    if (TR.state === 'act' && TR.act) {
      if (TR.act.id === TRACE_FIRST.id) return { key: 'traces', p: Math.min(1, TR.t / TR.dur), dur: TR.dur };
      const key = Object.keys(SE).find(k => SE[k].id === TR.act.id);
      if (key) return { key, p: Math.min(1, TR.t / TR.dur), dur: TR.dur };
    }
    if (TR.state === 'walk' && TR.purpose?.ev?.id === SE.opening_b.id) return { key: 'opening_walk', p: Math.min(1, TR.u), dur: TR.route.len / WALK };
    return null;
  }
  function resolveCameraFocus(name, p) {
    if (name === 'trav') return trav.position.clone();
    if (name === 'tree') return bigTree.position.clone();
    if (name === 'bridgeTree') return NODE.a_bridge.p.clone().lerp(bigTree.position, .62);
    if (name === 'grass') return TRACE.patch.clone().lerp(trav.position, .3);
    if (name === 'roll') return TRACE.roll.clone().lerp(trav.position, .3);
    if (name === 'date') return TRACE.date.getWorldPosition(new T.Vector3());
    if (name === 'stele') return stele.slab.getWorldPosition(new T.Vector3()).lerp(trav.position, .3).add(new T.Vector3(0, .2, 0));
    if (name === 'glint') return stele.slab.localToWorld(new T.Vector3(.27, .48 - Math.max(0, Math.min(1, (p - .2) / .5)) * .98 + .08, .1)).lerp(trav.position, .3);
    if (name === 'well') return well.g.position.clone().lerp(trav.position, .25);
    if (name === 'wellDownstream') return well.g.position.clone().lerp(FALL_FAR, .53 + .04 * Math.max(0, (p - .6) / .3));
    if (name === 'paper') return rubPaper.m.visible ? rubPaper.m.position.clone().lerp(trav.position, .15) : resolveCameraFocus('stele', p);
    if (name === 'tag') return treeTag.card.getWorldPosition(new T.Vector3()).lerp(trav.position, .15);
    return target.clone();
  }
  function storySubjectBounds(ev) {
    const objects = [trav], points = [];
    if (ev.key === 'opening_a' || ev.key === 'notebook_a') {
      if ((ev.key === 'notebook_a' || ev.p >= .24) && ev.p < .92 && sketch) {
        const q = sketch.sp.position.clone().applyMatrix4(camera.matrixWorldInverse), half = sketch.sp.scale.x / 2;
        const weight = ev.key === 'notebook_a' ? 1 : easeInOutCubic(Math.max(0, Math.min(1, (ev.p - .24) / .12)));
        const center = trav.position.clone().applyMatrix4(camera.matrixWorldInverse);
        points.push(center.clone().lerp(new T.Vector3(q.x - half, q.y - half, 0), weight), center.clone().lerp(new T.Vector3(q.x + half, q.y + half, 0), weight));
      }
    } else if (ev.key === 'stele') objects.push(stele.g);
    else if (ev.key === 'rubbing' && rubPaper.m.visible) objects.push(rubPaper.m);
    else if (ev.key === 'well') objects.push(well.g);
    else if (ev.key === 'leafTag' && ev.p >= .5) objects.push(treeTag.card);
    else if (ev.key === 'traces' && ev.p >= .5 && ev.p < .75) objects.push(TRACE.date);
    objects.forEach(o => { const b = new T.Box3().setFromObject(o);
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) points.push(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    });
    return { xmin: Math.min(...points.map(p => p.x)), xmax: Math.max(...points.map(p => p.x)), ymin: Math.min(...points.map(p => p.y)), ymax: Math.max(...points.map(p => p.y)) };
  }
  function applyStoryCamera(c, ev) {
    const w = host.clientWidth || 1, h = host.clientHeight || 1, blend = 1 - (c.overview || 0);
    const top = cinematic ? 0 : Math.min(h * .3, chromeInsets.top);
    const fullBottom = cinematic ? 0 : chromeInsets.bottom;
    const bottom = fullBottom * (.5 + .5 * blend), clear = Math.max(120, h - top - bottom);
    placeCamera(c.yaw, c.pitch); camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
    const f = new T.Vector3(c.x, c.y, c.z).applyMatrix4(camera.matrixWorldInverse);
    let k = c.width / w, left = f.x - k * w * c.cx, up = f.y + k * (top + clear * c.cy);
    const b = ev && blend > 0 ? storySubjectBounds(ev) : null;
    if (b) {
      const fitted = Math.max(k, (b.xmax - b.xmin) / (.88 * w), (b.ymax - b.ymin) / (.88 * clear));
      k += (fitted - k) * blend;
      left = f.x - k * w * c.cx; up = f.y + k * (top + clear * c.cy);
      const safeLeft = Math.max(b.xmax - .94 * w * k, Math.min(b.xmin - .06 * w * k, left));
      const safeUp = Math.max(b.ymax + (top + .06 * clear) * k, Math.min(b.ymin + (h - bottom - .06 * clear) * k, up));
      left += (safeLeft - left) * blend; up += (safeUp - up) * blend;
      if (c.golden > 0 && ev.key === 'well') {
        const q = FALL_FAR.clone().applyMatrix4(camera.matrixWorldInverse), gx = .382 * w, gy = top + .618 * clear;
        const gk = Math.max(k, (b.ymax - q.y) / (gy - top - .06 * clear), (q.y - b.ymin) / (h - bottom - .06 * clear - gy), (b.xmax - q.x) / (.94 * w - gx), (q.x - b.xmin) / (gx - .06 * w));
        k += (gk - k) * c.golden; left += (q.x - gx * k - left) * c.golden; up += (q.y + gy * k - up) * c.golden;
      }
    }
    Object.assign(camera, { left, right: left + w * k, top: up, bottom: up - h * k }); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    cameraReadout = { name: ev ? ev.key : cameraOwner, width: w * k, yaw: c.yaw + yawOff, pitch: c.pitch + pitchOff, baseYaw: c.yaw, basePitch: c.pitch, owner: cameraOwner, p: ev ? ev.p : whaleState()?.q || 0, focus: [c.x, c.y, c.z], safety: b ? { left: (b.xmin - left) / (w * k), right: (b.xmax - left) / (w * k), top: (up - b.ymax) / (h * k), bottom: (up - b.ymin) / (h * k), safeTop: (top + .06 * clear) / h, safeBottom: (h - bottom - .06 * clear) / h } : null };
    anchorsDirty = true; requestRedraw(120);
  }
  function storyCameraStep(dt, force = false) {
    if (LOBBY || TR.state === 'depart') return;
    const base = standardCameraShot(), st = whaleState(), ev = currentStoryCamera();
    const enabled = cameraEnabled && !opts.reducedMotion;
    const special = rare || (TR.state === 'walk' && TR.purpose?.ev?.rare);
    const owner = !enabled || TR.state === 'light' ? 'overview' : special ? 'special-find' : ev ? ev.key : st ? 'whale' : 'overview';
    let c = base;
    if (owner === 'whale') {
      c = whaleCameraShot(st, base);
      if (cameraOwner === 'whistle' || cameraOwner === 'special-find') whaleCameraHandoff = { from: { ...storyCameraCurrent }, t0: sim };
      if (whaleCameraHandoff) { const p = Math.min(1, (sim - whaleCameraHandoff.t0) / 3);
        c = mixCamera(whaleCameraHandoff.from, c, easeInOutCubic(p)); if (p >= 1) whaleCameraHandoff = null;
      }
    } else if (ev && enabled && !special) {
      c = sampleCamera(ev.key, ev.p, (n, p) => resolveCameraFocus(n, p), st ? whaleCameraShot(st, base) : base);
      whaleCameraHandoff = null;
    } else whaleCameraHandoff = null;
    if (c.follow && enabled) {
      if (!cameraFollow || cameraJumping || force) { cameraFollow = { x: c.x, y: c.y, z: c.z }; cameraVelocity = { x: 0, y: 0, z: 0 }; }
      else springCamera(cameraFollow, cameraVelocity, c, dt);
      const weight = c.followWeight ?? 1; c = { ...c, x: c.x + (cameraFollow.x - c.x) * weight, y: c.y + (cameraFollow.y - c.y) * weight, z: c.z + (cameraFollow.z - c.z) * weight };
    } else { cameraFollow = null; cameraVelocity = { x: 0, y: 0, z: 0 }; }
    cameraOwner = owner; storyCameraCurrent = c;
    applyStoryCamera(c, enabled && !special ? ev : null);
  }

  const pickWeighted = (list) => { const total = list.reduce((s, c) => s + c.w, 0); let r = rand() * total; for (const c of list) { r -= c.w; if (r <= 0) return c; } return list[list.length - 1]; };

  let statusMsg = '';
  function setStatus(msg) { if (!msg || msg === statusMsg) return; statusMsg = msg; try { opts.reportActivity(msg); } catch (_) {} }

  function routeFromIds(ids) {
    if (!Array.isArray(ids) || ids.length < 2) return null;
    const cp = new T.CurvePath();
    for (let i = 0; i < ids.length - 1; i++) {
      const hop = (ADJ[ids[i]] || []).find((h) => h.to === ids[i + 1]);
      if (!hop) return null;
      cp.add(hop.dir === 'fwd' ? hop.E.fwd : hop.E.rev);
    }
    return { curve: cp, len: cp.getLength(), ids: ids.slice() };
  }
  function walkTo(nodeId, purpose) {
    const r = buildRoute(TR.node, nodeId);
    if (!r) { arrive(purpose, nodeId); return; }
    TR.route = r; TR.u = 0; TR.state = 'walk'; TR.purpose = purpose;
    setStatus(purpose.walkMsg);
  }
  function arrive(purpose, nodeId) {
    TR.node = nodeId || TR.node; TR.route = null;
    if (purpose.type === 'event') startAct(purpose.ev, purpose.dur);
    else if (purpose.type === 'lamp') {
      if (purpose.k < lampsLit) { TR.state = 'idle'; return; }
      if (sim >= due(purpose.k) - LIGHT_SECONDS) startLight(purpose.k); else startWait(purpose.k);
    } else if (purpose.type === 'rest') startRest(purpose.act, purpose.dur);
  }
  function startAct(ev, dur) { TR.state = 'act'; TR.act = ev; TR.t = 0; TR.dur = dur; TR.effectDone = false; TR.traceNoted = false; TR.traceSeen2 = false; TR.sn1 = TR.sn2 = false; TR.uiReturning = false; TR.ring0 = TR.ring1 = TR.ring2 = false; if (ev.rare) startRare(ev); setStatus('旅人' + ev.name); }
  function startWait(k) { TR.state = 'wait'; TR.waitK = k; TR.waitT = 0; TR.waitPose = 'gaze'; setStatus('旅人在第 ' + (k + 1) + ' 盞燈旁等著，抬頭看雲'); }
  function startLight(k) { TR.state = 'light'; TR.lightK = k; TR.t = 0; TR.dur = LIGHT_SECONDS; setStatus('旅人準備點亮第 ' + (k + 1) + ' 盞燈'); }
  function startLobbyWait() {
    TR.state = 'wait'; TR.waitK = lampsLit; TR.waitT = 0; TR.waitPose = 'gaze';
    setStatus(lampsLit === 0 ? '旅人站在入口石板上，等著出發' : '旅人停在第 ' + lampsLit + ' 盞燈旁，等著繼續');
  }
  function startRest(act, dur) { TR.state = 'rest'; TR.act = act; TR.t = 0; TR.dur = dur; TR.restLast = act.id; setStatus('旅人' + act.name); }

  function decide() {
    const v = WALK;
    // Rewards are already saved. Their reveal must fit before the next lamp, just like an ambient event.
    const pendingFind = pendingSpecialFinds[0];
    if (pendingFind && (lampsLit >= 5 || fitsBeforeLamp(due(lampsLit) - sim,
      D(TR.node, pendingFind.spot) / v, pendingFind.dur[0], D(pendingFind.spot, lampNode(lampsLit)) / v))) {
      const ev = pendingSpecialFinds.shift();
      const dur = ev.dur[0];
      if (TR.node === ev.spot) startAct(ev, dur);
      else walkTo(ev.spot, { type: 'event', ev, dur, walkMsg: '旅人往' + SPOT[ev.spot].name + '走去' });
      return;
    }
    // story events (opening / first & second visit / carried items), then the whale pause
    if (storyTick()) return;
    if (lampsLit >= 5) {
      if (tracesPending && !LOBBY) {
        tracesPending = false;
        const ev = TRACE_FIRST;
        if (TR.node === ev.spot) startAct(ev, ev.dur[0]);
        else walkTo(ev.spot, { type: 'event', ev, dur: ev.dur[0], walkMsg: '五盞燈都亮了，旅人回到中央的大樹下' });
        return;
      }
      const choices = AREA.restActivities.filter((a) => a.id !== TR.restLast).map((a) => ({ a, w: a.weight }));
      const c = pickWeighted(choices).a; const dur = mr(c.dur[0], c.dur[1]);
      if (TR.node === c.node) startRest(c, dur);
      else walkTo(c.node, { type: 'rest', act: c, dur, walkMsg: TR.restLast ? '旅人起身，換個地方休息' : '五盞燈都亮了，旅人回到中央的大樹下' });
      return;
    }
    const k = lampsLit, L = lampNode(k);
    const left = due(k) - sim;
    const cands = [];
    if (left > 0) {
      EVENTS.forEach((ev) => {
        if (!allowed(ev)) return;
        const d1 = D(TR.node, ev.spot), d2 = D(ev.spot, L);
        const dur = mr(ev.dur[0], ev.dur[1]);
        if (fitsBeforeLamp(left, d1 / v, dur, d2 / v)) cands.push({ ev, dur, w: ev.weight * freshness(ev) / (1 + d1 / 5) });
      });
    }
    if (cands.length && TR.state !== 'linger' && TR.lastWasLinger !== true && rand() < 0.16 && left > 60) {
      const c = LINGER[Math.floor(rand() * LINGER.length)];
      const duration = mr(c.dur[0], c.dur[1]);
      if (fitsBeforeLamp(left, 0, duration, D(TR.node, L) / v)) {
        TR.lastWasLinger = true;
        startAct(Object.assign({ spot: TR.node }, c), duration);
        return;
      }
    }
    TR.lastWasLinger = false;
    if (cands.length) {
      const c = pickWeighted(cands);
      TR.recent = [c.ev.spot].concat(TR.recent).slice(0, 2);
      walkTo(c.ev.spot, { type: 'event', ev: c.ev, dur: c.dur, walkMsg: '旅人往' + SPOT[c.ev.spot].name + '走去' });
      return;
    }
    if (TR.node === L) { if (sim >= due(k) - LIGHT_SECONDS) startLight(k); else startWait(k); return; }
    walkTo(L, { type: 'lamp', k, walkMsg: '第 ' + (k + 1) + ' 盞燈的時間快到了，旅人往燈的方向走' });
  }
  function finishAct() {
    const ev = TR.act; if (ev.rare) endRare(); if (ev.once) usedOnce.add(ev.id);
    lastDoneAt[ev.id] = sim;
    if (ev.id === TRACE_FIRST.id) { if (marks) marks.add('tree_traces_seen'); try { opts.reportWorldMark('tree_traces_seen'); } catch (_) {} storyRecord('c01_bark_date'); }
    if (ev.story) storyFinish(ev);
    TR.state = 'idle';
  }
  function eventEffect(ev, prog) {
    if (!ev.effect) return;
    if (ev.effect === 'astroSpin') astro.boost = Math.sin(Math.PI * prog);
    if (TR.effectDone) return;
    if (ev.effect === 'pebble' && prog > 0.55) { addPebble(); TR.effectDone = true; }
  }

  // Place the world for a given amount of progress (first open, reopen, or after a departure).
  function settleAt(progress) {
    if (rare) endRare();
    lampsLit = Math.min(5, lampsDueAt(progress));
    lamps.forEach((L, i) => { L.level = i < lampsLit ? 1 : 0; });
    TR.route = null; TR.act = null; TR.dep = null; TR.state = 'idle'; TR.restLast = null; TR.recent = [];
    TR.node = lampsLit >= 5 ? 'b_tree' : lampsLit > 0 ? lampNode(lampsLit - 1) : SPAWN_NODE;
    const p = NODE[TR.node].p; trav.position.set(p.x, groundY(p), p.z);
    TR.heading = TR.node === SPAWN_NODE ? headingTo(NODE[SPAWN_NODE].p, NODE.a_mid.p) : VIEW_FACE;
    if (lampsLit >= 5 && marks && !marks.has('tree_traces_seen') && !tracesShown) { tracesPending = true; tracesShown = true; }
    setStatus(lampsLit >= 5 ? '五盞燈都亮了，旅人在中央的大樹下休息' : progress <= 1 ? '旅人從入口石板出發' : '旅人回到島上，繼續今天的路');
  }

  // ---------- departure: plays at the start of the next Focus, never longer than the cue allows ----------
  const cue = opts.departure;
  const cueDuration = cue ? Math.min(DEPART_T, (cue.durationMs || 5000) / 1000) : DEPART_T;
  let swapAt = opts.arriveFromMist ? -2 : -1;                    // sceneNow() when the view switched to the new Area
  let departureReported = false;
  function finishDeparture() {
    if (!TR.dep || TR.dep.done) return;
    TR.dep.done = true;
    if (opts.departureOnly) {
      // Retain this exact departure frame until the next world has drawn.
      if (!departureReported) { departureReported = true; opts.reportDepartureComplete(); }
      return;
    }
   
    settleAt(sim);
    setStatus('旅人穿過雲霧，來到新的一段路');
    swapAt = sceneNow();
    if (!departureReported) { departureReported = true; try { opts.reportDepartureComplete(); } catch (_) {} }
  }
  if (cue && DEPART[cue.exit] && (opts.departureElapsedMs || 0) < cueDuration * 1000) {
    const X = DEPART[cue.exit];
    const from = cue.route && cue.route[0] && NODE[cue.route[0]] ? cue.route[0] : 'b_tree';
    lampsLit = 5; lamps.forEach((L) => { L.level = 1; });
    TR.node = from; TR.state = 'depart';
    // scene-clock driven (wall clock minus pauses): a slow or hidden window can shorten what is seen,
    // never lengthen it, and a paused Focus holds the departure exactly where it is
    TR.dep = { exit: cue.exit, from, route: routeFromIds(cue.route) || buildRoute(from, X.exitNode), label: X.label, leaveMsg: X.leaveMsg, t: Math.max(0, (opts.departureElapsedMs || 0) / 1000), done: false, startWall: null };
    Object.assign(pose, { hip: -0.28, legX: -1.45, lean: 0, headX: 0.5, headY: 0, armL: -0.9, armLz: 0, staffX: 0.2, staffZ: -0.6, book: 1, lie: 0 });
    const p = NODE[from].p; trav.position.set(p.x, groundY(p), p.z); TR.heading = VIEW_FACE;
    setStatus('新的一段路開始了，旅人從大樹下起身，準備往' + X.label + '出發');
  } else {
    settleAt(sim);
  }

  // ---------- lobby: the next routes, drawn on the Area ----------
  // Each exit gets one trail of small lantern marks, from the rest spot under the big tree (or from the
  // entry stones on a fresh day) to where the exit dips into the cloud. The selected route is warm with a
  // slow glow walking toward its exit; the others stay faint. Presentation only: React owns the choice.
  const trails = {};
  // Unlit, opaque marks so they read on sunlit grass as well as at night. The level sets their size;
  // the selected trail is warm amber with a slow swell walking toward its exit.
  const TRAIL_COL = { selected: new T.Color(0xe9b25a), hover: new T.Color(0xe6efe9), available: new T.Color(0xcfe2dd), none: new T.Color(0xcfe2dd) };
  const TRAIL_LVL = { selected: 1, hover: 0.78, available: 0.55, none: 0 };
  let trailGeo = LOBBY ? new T.CircleGeometry(0.1, 12) : null;
  if (trailGeo) trailGeo.rotateX(-Math.PI / 2);
  let trailMat = LOBBY ? new T.MeshBasicMaterial({ color: 0xffffff, fog: true }) : null;
  const trailTmp = new T.Color();
  const trailObj = new T.Object3D();
  function trailFor(exit) {
    if (trails[exit]) return trails[exit];
    if (!trailGeo) { trailGeo = new T.CircleGeometry(0.1, 12); trailGeo.rotateX(-Math.PI / 2); }
    if (!trailMat) trailMat = new T.MeshBasicMaterial({ color: 0xffffff, fog: true });
    const pts = [];
    const sample = (curve, from, to, skipFirst) => {
      const n = Math.max(2, Math.round(curve.getLength() * (to - from) / 0.42));
      for (let i = skipFirst ? 1 : 0; i <= n; i++) pts.push(curve.getPointAt(from + (to - from) * i / n));
    };
    if (exit === 'entry') { const r = buildRoute('entry0', 'a_mid'); if (r) sample(r.curve, 0.02, 1); }
    else if (DEPART[exit]) {
      const X = DEPART[exit]; const r = buildRoute(lobbyRestNode(), X.exitNode);
      if (r) sample(r.curve, 0.035, 1);
      sample(X.curve, 0, 0.78, true);
    }
    if (pts.length < 2) return null;
    const im = new T.InstancedMesh(trailGeo, trailMat, pts.length);
    const along = []; let acc = 0;
    pts.forEach((p, i) => {
      if (i) acc += p.distanceTo(pts[i - 1]);
      along.push(acc);
      trailObj.position.set(p.x, p.y + 0.1, p.z); trailObj.scale.setScalar(0.001); trailObj.updateMatrix(); im.setMatrixAt(i, trailObj.matrix);
      im.setColorAt(i, trailTmp.copy(TRAIL_COL.available));
    });
    im.frustumCulled = false; im.renderOrder = 2; im.visible = false; scene.add(im);
    trails[exit] = { exit, mesh: im, pts, n: pts.length, s: along, len: Math.max(0.001, acc), level: 'none', amt: 0, col: TRAIL_COL.available.clone() };
    return trails[exit];
  }
  function trailsUpdate(dt) {
    const ke = 1 - Math.exp(-dt * 3.2);
    for (const key in trails) {
      const tr = trails[key];
      tr.amt += (TRAIL_LVL[tr.level] - tr.amt) * ke;
      tr.col.lerp(TRAIL_COL[tr.level], ke);
      tr.mesh.visible = tr.amt > 0.01;
      if (!tr.mesh.visible) continue;
      const walking = tr.level === 'selected' && MOTION > 0.5;
      for (let i = 0; i < tr.n; i++) {
        const u = tr.s[i] / tr.len;
        let sz = tr.amt * Math.min(1, (1 - u) / 0.22) * Math.min(1, 0.4 + u / 0.08) * (i % 2 ? 0.82 : 1);
        let br = 1;
        if (walking) { const w = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * 2 * (tr.s[i] / 2.6 - tAcc / 2.4)), 8); sz *= 1 + 0.35 * w; br = 0.9 + 0.3 * w; }
        const p = tr.pts[i];
        trailObj.position.set(p.x, p.y + 0.1, p.z); trailObj.scale.setScalar(Math.max(0.001, sz)); trailObj.updateMatrix(); tr.mesh.setMatrixAt(i, trailObj.matrix);
        tr.mesh.setColorAt(i, trailTmp.copy(tr.col).multiplyScalar(br));
      }
      tr.mesh.instanceMatrix.needsUpdate = true;
      tr.mesh.instanceColor.needsUpdate = true;
    }
  }

  // ---------- lobby: new finds resting on the grass beside the traveller ----------
  // Small brass pieces with a soft amber halo; React pins a label to each ('item:<key>' anchors) and
  // opens its detail on click. Only shown where the traveller rests after a completed map.
  const ITEM_SPOTS = [[1.35, 0.35], [-0.2, -1.0], [1.9, -0.9]];     // (u, v) offsets from the rest node
  const lobbyItems = [];
  function setItems(list) {
    lobbyItems.forEach((it) => { scene.remove(it.g); delete ANCHOR_WORLD['item:' + it.key]; });
    lobbyItems.length = 0;
    const rest = NODE[lobbyRestNode()];
    (Array.isArray(list) ? list : []).slice(0, ITEM_SPOTS.length).forEach((entry, i) => {
      if (!entry || !entry.key) return;
      const at = W(rest.u + ITEM_SPOTS[i][0], rest.v + ITEM_SPOTS[i][1], 0); at.y = groundY(new T.Vector3(at.x, rest.p.y, at.z));
      const g = new T.Group(); g.position.copy(at);
      const piece = mesh(new T.CylinderGeometry(0.1, 0.11, 0.03, 10), M.brass, g, 0, 0.03, 0); piece.rotation.z = 0.2; piece.castShadow = true;
      const halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, fog: false }));
      halo.scale.set(0.9, 0.9, 1); halo.position.set(0, 0.12, 0); g.add(halo);
      scene.add(g);
      lobbyItems.push({ key: String(entry.key), g, halo, ph: i * 1.7 });
      ANCHOR_WORLD['item:' + entry.key] = at.clone().add(new T.Vector3(0, 0.25, 0));
    });
    anchorsDirty = true; requestRedraw(600);
  }
  function itemsUpdate() {
    lobbyItems.forEach((it) => { const a = 0.5 + 0.5 * Math.sin(tAcc * 1.3 + it.ph); it.halo.material.opacity = 0.32 + 0.3 * a * MOTION; const k = 0.8 + 0.2 * a; it.halo.scale.set(k, k, 1); });
  }

  // ---------- lobby camera ----------
  // 'close': a close-up of where the traveller is now (rest spot, the last lit lamp, or the entry stones),
  // a little lower than the Focus angle. 'look': eases toward one exit so the route's trail and the
  // stairs / stepping stones read, then back. 'overview': the whole Area (fallback / QA).
  const CLOSE = { width: 11, pitch: -0.2, cy: 0.46 };
  const lobbyCam = { kind: 'close', exit: null, from: null, to: null, t: 1, dur: 1.2, cur: null };
  function lobbyRestNode() { return lampsLit >= 5 ? 'b_tree' : lampsLit > 0 ? lampNode(lampsLit - 1) : SPAWN_NODE; }
  function lobbyShot(kind, exit) {
    const rest = NODE[lobbyRestNode()].p;
    if (kind === 'look' && exit && DEPART[exit]) {
      const far = DEPART[exit].curve.getPointAt(0.35);
      const f = rest.clone().lerp(far, 0.5); f.y += 0.6;
      return { fx: f.x, fy: f.y, fz: f.z, width: Math.max(18, Math.min(30, rest.distanceTo(far) * 1.25 + 6)), pitch: -0.12, cy: 0.36 };
    }
    const f = rest.clone();
    if (lobbyRestNode() === SPAWN_NODE) f.lerp(NODE.a_mid.p, 0.45);
    f.y += 1.0;
    return { fx: f.x, fy: f.y, fz: f.z, width: CLOSE.width, pitch: CLOSE.pitch, cy: CLOSE.cy };
  }
  const easeCam = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lobbyFocus = new T.Vector3();
  function lobbyCameraStep(dt, force) {
    if (lobbyCam.kind === 'overview') return;
    if (!lobbyCam.cur) { lobbyCam.cur = lobbyShot(lobbyCam.kind, lobbyCam.exit); lobbyCam.t = 1; }
    if (lobbyCam.t < 1) {
      // wall clock, so a slow frame rate never stretches the move
      lobbyCam.t = Math.min(1, (performance.now() - lobbyCam.startAt) / 1000 / Math.max(0.05, lobbyCam.dur));
      const e = easeCam(lobbyCam.t), A = lobbyCam.from, B = lobbyCam.to;
      Object.keys(B).forEach((k) => { lobbyCam.cur[k] = A[k] + (B[k] - A[k]) * e; });
      anchorsDirty = true;
    } else if (!force && !dragging && Math.abs(yawOff) + Math.abs(pitchOff) < 0.002 && !lobbyCam.dirty) return;
    lobbyCam.dirty = false;
    const c = lobbyCam.cur, w = host.clientWidth || 1, h = host.clientHeight || 1;
    lobbyPitch = c.pitch; placeCamera(); camera.updateMatrixWorld();
    lobbyFocus.set(c.fx, c.fy, c.fz).applyMatrix4(camera.matrixWorldInverse);
    const insetTop = Math.min(h * 0.3, chromeInsets.top), insetRight = Math.min(w * 0.46, chromeInsets.right);
    const insetLeft = Math.min(w * 0.2, chromeInsets.left);
    const cw = Math.max(160, w - insetRight - insetLeft), k = c.width / cw;
    const left = lobbyFocus.x - k * (insetLeft + cw * 0.5), top = lobbyFocus.y + k * (insetTop + (h - insetTop) * c.cy);
    Object.assign(camera, { left, right: left + w * k, top, bottom: top - h * k }); camera.updateProjectionMatrix();
    anchorsDirty = true;
  }
  function setView(view) {
    const kind = view && (view.kind === 'look' || view.kind === 'overview') ? view.kind : 'close';
    const exit = kind === 'look' && view.exit && DEPART[view.exit] ? view.exit : null;
    if (kind === 'look' && !exit) return setView({ kind: 'close' });
    if (kind === lobbyCam.kind && exit === lobbyCam.exit && lobbyCam.cur) return;
    lobbyCam.kind = kind; lobbyCam.exit = exit;
    if (kind === 'overview') { lobbyCam.cur = null; resize(); return; }
    const to = lobbyShot(kind, exit);
    if (!lobbyCam.cur) { lobbyCam.cur = Object.assign({}, to); lobbyCam.t = 1; lobbyCam.dirty = true; }
    else { lobbyCam.from = Object.assign({}, lobbyCam.cur); lobbyCam.to = to; lobbyCam.t = 0; lobbyCam.startAt = performance.now(); lobbyCam.dur = MOTION < 0.5 ? 0.35 : 1.2; }
    requestRedraw(1500);
  }
  if (LOBBY && opts.lobbyView) { lobbyCam.kind = opts.lobbyView.kind === 'overview' ? 'overview' : 'close'; }

  // Screen positions (CSS px from the host's top-left) of the places the lobby pins its route markers
  // to. Reported only when the camera, the size or the framing changes.
  const ANCHOR_WORLD = {};
  {
    const up = new T.Vector3(0, 0.55, 0);
    Object.keys(DEPART).forEach((key) => { ANCHOR_WORLD[key] = DEPART[key].curve.getPointAt(0.3).add(up); });
    ANCHOR_WORLD.entry = NODE[SPAWN_NODE].p.clone().add(up);
    ANCHOR_WORLD.rest = NODE.b_tree.p.clone().add(new T.Vector3(0, 2.2, 0));
  }
  let anchorsDirty = true;
  const lastAnchors = {};
  const projV = new T.Vector3();
  function reportAnchorsIfMoved() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    const out = {}; let moved = anchorsDirty;
    Object.keys(ANCHOR_WORLD).forEach((key) => {
      projV.copy(ANCHOR_WORLD[key]).project(camera);
      const x = (projV.x + 1) / 2 * w, y = (1 - projV.y) / 2 * h;
      out[key] = { x, y };
      const l = lastAnchors[key];
      if (!l || Math.abs(l.x - x) > 0.25 || Math.abs(l.y - y) > 0.25) moved = true;
    });
    if (!moved) return;
    anchorsDirty = false; Object.assign(lastAnchors, out);
    try { opts.reportAnchors(out); } catch (_) {}
  }

  // ---------- loop ----------
  resize();
  const clock = new T.Clock();
  let tAcc = 0;
  let raf = 0;
  let disposed = false;
  let wasPlaying = false;
  const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  function faceFor(spotId, ev) {
    const f = (ev && ev.face) || (SPOT[spotId] && SPOT[spotId].face) || 'view';
    if (f === 'view') return VIEW_FACE;
    const n = NODE[spotId].p; const t = W(f[0], f[1], 0); return Math.atan2(t.x - n.x, t.z - n.z);
  }
  function update(dt, travellerDt = dt) {
    tAcc += dt * MOTION; timeU.value = tAcc;
    const now = sceneNow();

    // focus progress: re-anchored by setProgress(); between ticks we extrapolate at most 1.5 s
    // the lobby holds the saved progress: the traveller still moves, time does not
    playing = LOBBY || now - lastIncreaseAt < 2600;
    sim = playing && !LOBBY ? reported + Math.min(1.5, (now - reportedAt) / 1000) : reported;
    if (playing !== wasPlaying && (!TR.dep || TR.dep.done)) {
      if (!playing && wasPlaying) setStatus('暫停中，旅人停在原地');
      wasPlaying = playing;
    }
    const daylight = timeOfDayAt(sim);
    presetKey = daylight.from;
    applyDaylight(goal, daylight);

    // Lamps are saved-time milestones, not animation completion. Do not extrapolate their time:
    // reported is the exact same progress value used by the HUD. Recover ALL due lamps after a gap.
    const dueNow = lampsDueAt(reported);
    if (TR.state !== 'depart' && dueNow > lampsLit) {
      for (let i = lampsLit; i < dueNow; i++) lamps[i].level = 1;
      lampsLit = dueNow;
      if (TR.state === 'light' && TR.lightK < lampsLit) {
        setStatus('旅人點亮第 ' + (TR.lightK + 1) + ' 盞燈');
        TR.state = 'idle';
      } else if (TR.state === 'wait' && TR.waitK < lampsLit) TR.state = 'idle';
      else if (TR.state === 'walk' && TR.purpose?.type === 'lamp' && TR.purpose.k < lampsLit) {
        // A reopen just before a deadline may leave too little walking time. Do not keep saying
        // the already-lit lamp is still upcoming, or replay its lighting gesture on arrival.
        setStatus('第 ' + lampsLit + ' 盞燈已亮，旅人沿路前行');
      }
      if (lampsLit >= 5 && !tracesShown && !(marks && marks.has('tree_traces_seen'))) { tracesPending = true; tracesShown = true; }
    }
    if (dueNow !== lastLightsReport && TR.state !== 'depart') { lastLightsReport = dueNow; try { opts.reportLights(dueNow); } catch (_) {} }

    if (TR.state === 'depart') {
      const Dp = TR.dep; if (Dp.startWall === null && framesDrawn > 0) Dp.startWall = now - Dp.t * 1000; const before = Dp.t; if (Dp.startWall !== null) Dp.t = Math.max(Dp.t, (now - Dp.startWall) / 1000);
      const at = (x) => before < x && Dp.t >= x;
      if (at(0.7)) setStatus('旅人背好行囊，扶正帽子');
      if (at(1.3)) setStatus('旅人往' + Dp.label + '的方向走，霧慢慢圍了上來');
      if (at(2.5)) setStatus(Dp.leaveMsg);
      if (Dp.t >= cueDuration - 0.06) { finishDeparture(); if (opts.departureOnly) return; }
    } else if (playing) {
      if (TR.state === 'idle') { if (LOBBY && lampsLit < 5) startLobbyWait(); else decide(); }
      if (TR.state === 'walk') {
        TR.u += (WALK * travellerDt) / TR.route.len;
        if (TR.u >= 1) { const ids = TR.route.ids; arrive(TR.purpose, ids[ids.length - 1]); }
      } else if (TR.state === 'act') {
        TR.t += travellerDt; eventEffect(TR.act, Math.min(1, TR.t / TR.dur));
        if (rare) rareUpdate(Math.min(1, TR.t / TR.dur), travellerDt);
        if (TR.t >= TR.dur) { astro.boost = 0; finishAct(); }
      } else if (TR.state === 'wait') {
        TR.waitT += dt;
        if (TR.waitT > 6) { TR.waitT = 0; TR.waitPose = ['gaze', 'idle', 'stretch'][Math.floor(rand() * 3)]; }
        if (!LOBBY && sim >= due(TR.waitK) - LIGHT_SECONDS) startLight(TR.waitK);
      } else if (TR.state === 'light') {
        // The gesture prepares the lamp; only the authoritative clock above switches its light on.
        TR.t = Math.min(TR.dur, TR.t + travellerDt);
      } else if (TR.state === 'rest') {
        TR.t += dt; if (TR.t >= TR.dur) TR.state = 'idle';
      }
    }

    // --- traveller placement ---
    let p, moving = false, want = TR.heading, animKey = 'idle', prog = 0, fade = 1;
    if (TR.state === 'depart') {
      const Dp = TR.dep, t = Dp.t, X = DEPART[Dp.exit];
      if (t < 1.3) {
        p = NODE[Dp.from].p.clone(); want = VIEW_FACE;
        animKey = t < 0.7 ? 'idle' : 'shoulder'; prog = Math.min(1, Math.max(0, (t - 0.7) / 0.6));
      } else if (t < 2.4 && Dp.route) {
        const u = Math.min(1, ((t - 1.3) / 1.1) * (1.5 / Dp.route.len));
        p = Dp.route.curve.getPointAt(u); const tg = Dp.route.curve.getTangentAt(u);
        want = Math.atan2(tg.x, tg.z); animKey = 'walk'; moving = true; Dp.walkSpeed = 1.36;
        fade = 1 - Math.min(1, Math.max(0, (t - 1.8) / 0.5));
      } else {
        const k = Math.min(1, Math.max(0, (t - 2.5) / 2.5));
        const u = 0.03 + 0.67 * k;
        p = X.curve.getPointAt(u); const tg = X.curve.getTangentAt(u);
        want = Math.atan2(tg.x, tg.z); animKey = 'walk'; moving = t < cueDuration; Dp.walkSpeed = X.len * 0.67 / 2.5;
        fade = t < 2.5 ? 0 : Math.min(1, (t - 2.5) / 0.35) * (1 - Math.min(1, Math.max(0, (t - 4.2) / 0.75)));
        if (t < 2.5) TR.heading = want;
      }
    } else if (TR.state === 'walk' && TR.route) {
      const u = Math.min(1, TR.u);
      p = TR.route.curve.getPointAt(u);
      moving = playing;
      const tg = TR.route.curve.getTangentAt(u); want = Math.atan2(tg.x, tg.z);
      animKey = playing ? 'walk' : 'idle';
    } else {
      p = NODE[TR.node].p.clone();
      if (TR.state === 'act') { animKey = TR.act.anim; prog = Math.min(1, TR.t / TR.dur); want = TR.act.faceAt ? TR.act.faceAt(prog, p) : animKey === 'lie' ? Math.atan2(W(1, 0, 0).x, W(1, 0, 0).z) : faceFor(TR.node, TR.act); }
      else if (TR.state === 'rest') { animKey = TR.act.anim; want = TR.act.anim === 'lie' ? Math.atan2(W(1, 0, 0).x, W(1, 0, 0).z) : TR.act.face ? faceFor(TR.node, TR.act) : VIEW_FACE; }
      else if (TR.state === 'wait') { animKey = TR.waitPose; want = headingTo(p, lamps[TR.waitK].g.position); }
      else if (TR.state === 'light') { animKey = 'light'; want = headingTo(p, lamps[TR.lightK].g.position); prog = Math.min(1, TR.t / TR.dur); }
    }
    const seat = (TR.state === 'act' || TR.state === 'rest') && SPOT[TR.node] && SPOT[TR.node].seat === 'bench' && /^sit/.test(animKey);
    const gy = groundY(p);
    trav.position.set(p.x, gy, p.z);
    TR.heading = lerpAngle(TR.heading, want, 1 - Math.exp(-dt * 5));
    trav.rotation.y = TR.heading;
    if (moving) TR.phase += (TR.state === 'depart' ? TR.dep.walkSpeed || 1 : WALK * 2.6) * dt * 9;

    // --- pose targets ---
    const tgt = Object.assign({ hip: 0, legX: 0, lean: 0, headX: 0, headY: 0, armL: 0, armLz: 0, staffX: 0, staffZ: 0, book: 0, lie: 0 }, POSE[animKey] || {});
    const tt = TR.t;
    if (animKey === 'traces') {
      if (prog < 0.3) { Object.assign(tgt, POSE.crouch); tgt.headX = 0.5; }
      else if (prog < 0.55) { Object.assign(tgt, POSE.reach); tgt.headX = -0.15; tgt.armL = -1.5 + Math.sin(tt * 2.2) * 0.08; }
      else if (prog < 0.63) Object.assign(tgt, POSE.idle, { headX: 0.1, headY: Math.sin(tt * 0.9) * 0.4 });
      else { Object.assign(tgt, POSE.write); tgt.armLz = Math.sin(tt * 5) * 0.08; }
      if (prog > 0.3 && !TR.traceSeen2) { TR.traceSeen2 = true; setStatus('旅人發現旁邊的行囊，綁法跟自己的一模一樣'); }
      if (prog > 0.55 && !TR.traceNoted) { TR.traceNoted = true; setStatus('樹皮上刻著一個日期。旅人摸了摸，拿出筆記寫了幾行'); }
    }
    if (TR.state === 'act' && TR.act && TR.act.story) storyPose(TR.act.story, prog, tgt, tt);
    if (TR.whaleLook && animKey !== 'lie') tgt.headX = Math.min(tgt.headX, -0.42);
    if (animKey === 'pickup') { const a = Math.sin(Math.PI * prog); Object.assign(tgt, { hip: -0.2 * a, legX: -0.9 * a, lean: 0.5 * a, headX: 0.4 * a, armL: -1.0 * a }); }
    if (animKey === 'stretch') { const a = TR.state === 'wait' ? 0.5 + 0.5 * Math.sin(tAcc * 0.8) : Math.sin(Math.PI * prog); Object.assign(tgt, { armL: -2.9 * a, staffX: -0.25 * a, headX: -0.3 * a }); }
    if (animKey === 'light') tgt.staffX = Math.sin(Math.PI * prog) * 0.9;
    if (animKey === 'gaze' || animKey === 'sitGaze' || animKey === 'idle') tgt.headY = Math.sin(tAcc * 0.35) * (animKey === 'idle' ? 0.35 : 0.5);
    if (animKey === 'write') tgt.armLz = Math.sin(tt * 5) * 0.08;
    // lobby: while the camera looks toward an exit, the traveller glances that way too
    if (LOBBY && lobbyCam.kind === 'look' && lobbyCam.exit && animKey !== 'lie') {
      const far = ANCHOR_WORLD[lobbyCam.exit];
      if (far) { let d = headingTo(trav.position, far) - TR.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; tgt.headY = Math.max(-1.1, Math.min(1.1, d)); tgt.headX = -0.15; }
    }
    if (animKey === 'reach') tgt.armL += Math.sin(tt * 2) * 0.15;
    if (animKey === 'shoulder') Object.assign(tgt, { armL: -2.4 * Math.sin(Math.PI * prog), headX: -0.1, staffX: 0.1 });
    if (seat) tgt.hip = 0.12;
    const k = 1 - Math.exp(-dt * (TR.state === 'depart' ? 9 : 5));
    PKEYS.forEach((key) => { pose[key] += (tgt[key] - pose[key]) * k; });
    const swing = moving ? Math.sin(TR.phase) * 0.55 : 0;
    const bob = moving ? Math.abs(Math.sin(TR.phase)) * 0.035 : 0;
    body.position.y = pose.hip + bob;
    body.rotation.x = -pose.lie * Math.PI / 2;
    upper.rotation.x = pose.lean;
    legL.rotation.x = pose.legX + swing + (animKey === 'sitEdge' ? Math.sin(tAcc * 1.6) * 0.15 : 0);
    legR.rotation.x = pose.legX - swing + (animKey === 'sitEdge' ? Math.sin(tAcc * 1.6 + 1.3) * 0.15 : 0);
    head.rotation.x = pose.headX; head.rotation.y = pose.headY;
    armL.rotation.x = pose.armL; armL.rotation.z = pose.armLz;
    armR.rotation.x = -0.35 + pose.staffX * 0.8;
    staff.rotation.x = pose.staffX; staff.rotation.z = pose.staffZ;
    cloak.rotation.z = swing * 0.07;
    book.visible = pose.book > 0.5;
    travFade = fade; trav.visible = fade > 0.01;
    if (Math.abs(fade - lastFade) > 0.001) { setTravOpacity(fade); lastFade = fade; }
    Object.values(DEPART).forEach((X) => {
      const dt_ = TR.state === 'depart' && TR.dep.exit === X.exit ? TR.dep.t : -1;
      X.target = dt_ >= 3.4 ? 1 : LOBBY && trails[X.exit] && trails[X.exit].level === 'selected' ? 0.3 : 0;
      X.amt += (X.target - X.amt) * (1 - Math.exp(-dt * 1.2)); X.veil.scale.setScalar(0.5 + 0.7 * X.amt);
    });
    {
      const t = TR.state === 'depart' ? TR.dep.t : -1;
      const a = t > 1.4 && t < 3.3 ? Math.sin(Math.PI * Math.min(1, (t - 1.4) / 1.9)) : 0;
      const b = t > 2.1 && t < 3.3 ? Math.sin(Math.PI * Math.min(1, (t - 2.1) / 1.2)) : 0;
      departMist.a.scale.setScalar(a * 0.8); departMist.a.visible = a > 0.01;
      departMist.b.scale.setScalar(b * 0.8); departMist.b.visible = b > 0.01;
      if (TR.state === 'depart') {
        if (t < 2.4 && TR.dep.route) departMist.a.position.copy(TR.dep.route.curve.getPointAt(Math.min(1, 1.5 / TR.dep.route.len))).add(new T.Vector3(0, 0.3, 0));
        departMist.b.position.copy(DEPART[TR.dep.exit].curve.getPointAt(0.05)).add(new T.Vector3(0, 0.3, 0));
      }
    }
    // soft cover at the very end of the departure, lifted over the new Area
    {
      let o = 0;
      if (swapAt === -2) { o = 1; if (framesDrawn > 0) swapAt = now; }
      if (TR.state === 'depart') o = Math.min(1, Math.max(0, (TR.dep.t - (cueDuration - 0.55)) / 0.5));
      else if (swapAt > 0) { o = 1 - Math.min(1, (now - swapAt) / 650); if (o <= 0) swapAt = -1; }
      // A cross-map source stays visible while the destination compiles. React fades in the ready map.
      cover.style.opacity = opts.departureOnly ? '0' : o.toFixed(3);
      cover.style.background = '#' + cur.fog.getHexString();
    }

    // --- presets ---
    const kp = 1 - Math.exp(-dt * 2.2);
    COLOR_KEYS.forEach((key) => cur[key].lerp(goal[key], kp));
    NUM_KEYS.forEach((key) => { cur[key] += (goal[key] - cur[key]) * kp; });
    cur.sunAt.lerp(goal.sunAt, kp);
    scene.fog.color.copy(cur.fog); scene.background.copy(cur.fog);
    scene.fog.near = DIST + cur.near; scene.fog.far = DIST + cur.far;
    sun.color.copy(cur.sun); sun.intensity = cur.sunI * (1 - 0.14 * whale.vis * Math.exp(-Math.pow(whale.u / 16, 2))); sun.position.copy(target).add(cur.sunAt); sun.target.position.copy(target);
    hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.ground); hemi.intensity = cur.hemiI;
    [seaMat, wispMat].forEach((m) => { m.uniforms.uLight.value.copy(cur.light); m.uniforms.uShade.value.copy(cur.shade); m.uniforms.uFog.value.copy(cur.fog); m.uniforms.uNear.value = DIST + cur.near; m.uniforms.uFar.value = DIST + cur.far + 8; });
    wispMat.uniforms.uAlpha.value = cur.wisp;
    skyU.uSkyTop.value.copy(cur.skyTop); skyU.uGlowCol.value.copy(cur.glowCol); skyU.uGlowPos.value.set(cur.gx, cur.gy); skyU.uGlowStr.value = cur.glowStr;
    puffMat.color.copy(cur.light).lerp(cur.shade, 0.15); puffMat.emissive.copy(cur.light).multiplyScalar(0.4); departMist.m.color.copy(puffMat.color); departMist.m.emissive.copy(puffMat.emissive);
    travLight.intensity = cur.trav * travFade; travHalo.material.opacity = Math.min(0.45, cur.trav * 0.35) * travFade;
    waterMats.forEach((m) => { m.uniforms.uWater.value.setHex(COL.water).lerp(cur.shade, 0.35); m.uniforms.uFoam.value.copy(cur.light).lerp(WHITE, 0.45).multiplyScalar(1 - cur.fire * 0.45); m.uniforms.uFog.value.copy(cur.fog); m.uniforms.uNear.value = DIST + cur.near; m.uniforms.uFar.value = DIST + cur.far + 8; });
    mistSprites.forEach((q) => { q.sp.material.color.copy(cur.light).lerp(WHITE, 0.4); q.sp.material.opacity = q.base * (0.85 + 0.15 * Math.sin(tAcc * 0.7 + q.ph)) * (1 - cur.fire * 0.5); const kk = q.sc * (1 + 0.06 * Math.sin(tAcc * 0.5 + q.ph)); q.sp.scale.set(kk, kk * 0.8, 1); });
    drops.st.forEach((d, i) => { d.t += dt * d.sp * MOTION; if (d.t > 1) d.t -= 1; const c = LIP.p.clone().addScaledVector(LIP.out, 0.1 + 0.65 * Math.sqrt(d.t)).addScaledVector(drops.lat, d.o * (0.6 + d.t)); drops.pos[i * 3] = c.x; drops.pos[i * 3 + 1] = 0.8 - 6 * d.t * d.t; drops.pos[i * 3 + 2] = c.z; });
    drops.pts.geometry.attributes.position.needsUpdate = true; drops.m.opacity = 0.5 - cur.fire * 0.25;
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; r.m.scale.setScalar(0.08 + r.t * 0.35); r.m.material.opacity = Math.max(0, 0.5 - r.t * 0.28); if (r.t > 1.8) { scene.remove(r.m); ripples.splice(i, 1); } }

    // --- lamps ---
    lamps.forEach((L, i) => {
      const flick = 1 + (Math.sin(tAcc * 7.3 + i * 2) * 0.03 + Math.sin(tAcc * 13.1 + i) * 0.02) * MOTION;
      L.glowMat.emissiveIntensity = L.level * 1.3 * flick; L.light.intensity = L.level * cur.glow * 1.1 * flick; L.halo.material.opacity = L.level * Math.min(1, cur.glow) * 0.55;
    });

    // --- world motion ---
    lifeUpdate(dt, now);
    storyFrame(dt);
    if (LOBBY) { trailsUpdate(dt); itemsUpdate(); }
    roots.forEach((q) => { q.m.rotation.x = q.bx + Math.sin(tAcc * 0.8 + q.ph) * 0.05; q.m.rotation.z = q.bz + Math.sin(tAcc * 0.6 + q.ph * 1.3) * 0.05; });
    puffs.forEach((g) => { const d = g.userData; d.u += d.sp * dt * MOTION; if (d.u > 30) d.u = -30; g.position.copy(W(d.u, d.v, d.y + Math.sin(tAcc * 0.2 + d.v) * 0.15)); });
    astro.rings.forEach((ring, i) => {
      if (astro.align > 0) { const kk = 1 - Math.exp(-dt * 4 * astro.align); ring.rotation.x += (Math.round(ring.rotation.x / Math.PI) * Math.PI - ring.rotation.x) * kk; ring.rotation.y += (Math.round(ring.rotation.y / Math.PI) * Math.PI - ring.rotation.y) * kk; }
      else { const slow = astro.taken ? 0.35 : 1; ring.rotation.y += dt * (0.05 + astro.boost * 0.8) * slow * (i % 2 ? -1 : 1) * MOTION; ring.rotation.x += dt * 0.02 * (i + 1) * slow * MOTION; }
    });
    chest.open += ((chest.target || 0) - chest.open) * (1 - Math.exp(-dt * 2)); chest.lid.rotation.x = -1.15 * chest.open;
    if (boat) { boat.a += dt * 0.06 * MOTION; const rad = 1.05; boat.g.position.set(lakePos.x + Math.cos(boat.a) * rad, 0.84 + Math.sin(tAcc * 1.3) * 0.006, lakePos.z + Math.sin(boat.a) * rad); boat.g.rotation.y = -boat.a; }
    for (let i = slips.length - 1; i >= 0; i--) { const s = slips[i]; s.t += dt; s.m.position.y += dt * 0.25; s.m.rotation.y += dt * 1.2; s.m.material.opacity = Math.max(0, 0.95 - s.t / 2.6); if (s.t > 2.6) { scene.remove(s.m); slips.splice(i, 1); } }
    fireflies.m.opacity = cur.fire * (0.75 + 0.25 * Math.sin(tAcc * 1.7)); fireflies.pts.visible = cur.fire > 0.01;
    if (fireflies.pts.visible) { fireflies.base.forEach((b, i) => { fireflies.pos[i * 3] = b.x + Math.sin(tAcc * b.sp + b.ph) * 0.6; fireflies.pos[i * 3 + 1] = b.y + Math.sin(tAcc * b.sp * 1.3 + b.ph * 2) * 0.35; fireflies.pos[i * 3 + 2] = b.z + Math.cos(tAcc * b.sp * 0.8 + b.ph) * 0.6; }); fireflies.pts.geometry.attributes.position.needsUpdate = true; }
    petals.m.opacity = cur.petal; petals.pts.visible = cur.petal > 0.01;
    if (petals.pts.visible) { petals.base.forEach((b, i) => { b.u += b.sp * dt * MOTION; b.y -= 0.08 * dt * MOTION; if (b.u > 24 || b.y < -3) { b.u = -24; b.y = rr(1.5, 5.5); } const q = W(b.u, b.v + Math.sin(tAcc * 0.5 + b.ph) * 0.8, b.y + Math.sin(tAcc * 1.2 + b.ph) * 0.2); petals.pos[i * 3] = q.x; petals.pos[i * 3 + 1] = q.y; petals.pos[i * 3 + 2] = q.z; }); petals.pts.geometry.attributes.position.needsUpdate = true; }
    birdMat.opacity = cur.bird; const bt = (tAcc / 55) % 1;
    birds.forEach((g) => { const d = g.userData; g.visible = cur.bird > 0.02; g.position.copy(W(-30 + 60 * bt + d.off[0], 15.5 + d.off[1] + Math.sin(bt * 6) * 0.8, 6.5 + d.off[2] + Math.sin(tAcc * 0.5 + d.ph) * 0.2)); g.rotation.y = Math.atan2(W(1, 0, 0).x, W(1, 0, 0).z); const f = Math.sin(tAcc * 5 + d.ph) * 0.55; d.L.rotation.z = f; d.R.rotation.z = -f; });

    if (!dragging) { const q = Math.exp(-dt * 2.6); yawOff *= q; pitchOff *= q; }
    placeCamera();
    if (LOBBY) lobbyCameraStep(dt, false);
    else storyCameraStep(travellerDt, cameraJumping);
    if (rubPaper.m.visible && TR.act?.story === 'rubbing' && TR.t / TR.dur >= .65) rubPaper.m.lookAt(camera.position);
    if (handLeaf.visible) handLeaf.quaternion.copy(armL.getWorldQuaternion(new T.Quaternion()).invert().multiply(camera.quaternion));
  }
  let primed = false;
  let framesDrawn = 0;
  let lastDrawAt = 0;
  let lastFrameAt = performance.now();
  function frame(scheduleNext = true) {
    if (disposed || (opts.departureOnly && departureReported)) return;
    lastFrameAt = performance.now();
    // The lobby can stay open for a long time: while the camera is at rest it draws at ~30 fps.
    if (LOBBY && !dragging && Math.abs(yawOff) + Math.abs(pitchOff) < 0.002) {
      const t = performance.now();
      if (t - lastDrawAt < 30) { if (scheduleNext !== false) raf = requestAnimationFrame(frame); return; }
      lastDrawAt = t;
    }
    // Always read the clock so the first frame after a pause does not see the whole pause as dt.
    const activeDelta = clock.getDelta();
    const dt = Math.min(activeDelta, 0.05);
    const frozen = isPaused();
    // A scene created already paused (reopened App) runs one zero-length update so it shows the saved
    // state, then stands still. Nothing advances while paused: no dt, no tAcc, no scene clock.
    // Keep smoothing bounded, but do not slow navigation/events below 20 fps. Very long rendering
    // gaps use milestone recovery above rather than simulating minutes of movement in one frame.
    if (!frozen || !primed) { update(frozen ? 0 : dt, frozen ? 0 : Math.min(activeDelta, 1)); primed = true; }
    // Cross-map playback ends here. Do not compile/draw a new pose in the old world while React swaps it.
    if (opts.departureOnly && TR.dep && TR.dep.done) return;
    reportAnchorsIfMoved();
    if (framesDrawn < 2 || !frozen || performance.now() < redrawUntil) {
      glassDeep.copy(cur.fog).lerp(cur.skyTop, 0.35).multiplyScalar(0.2);
      glass.render(scene, camera, dt, glassDeep, [cur.gCap, cur.gCard, cur.gTint], frozen);
      framesDrawn++;
      if (framesDrawn === 2) opts.reportReady?.();
    }
    if (scheduleNext !== false) raf = requestAnimationFrame(frame);
  }
  const glassDeep = new T.Color();
  raf = requestAnimationFrame(frame);
  // Windows can stop RAF completely when minimized even with backgroundThrottling disabled.
  // Keep one timer as a watchdog, not a second animation clock or a catch-up queue. While RAF is
  // active this does nothing; otherwise it executes the same pause-aware frame at roughly 30 fps.
  const backgroundFrameTimer = setInterval(() => {
    if (!disposed && performance.now() - lastFrameAt >= 30) frame(false);
  }, 33);

  return {
    setPaused(paused) {
      const want = !!paused;
      if (want === isPaused()) return;
      if (want) { pausedAtReal = performance.now(); endDrag(); }
      else { pausedTotalMs += performance.now() - pausedAtReal; pausedAtReal = -1; clock.getDelta(); }
      requestRedraw(1600);          // let the paused tint ease in or out over the frozen frame
    },
    renderNow() { lastDrawAt = 0; requestRedraw(120); frame(false); },
    // Integration-only handoff: no new renderer, scene, shadow map or shader
    // compilation at the review -> lobby boundary. Keep authored anchors and
    // animations intact; saved progress (not this presentation) selects the pose.
    enterLobby(nextHost, nextOptions) {
      if (disposed) throw new Error('Cannot reuse a disposed scene');
      if (resizeObserver) resizeObserver.unobserve(host);
      delete host.dataset.glass;
      host = nextHost;
      host.appendChild(canvas); host.appendChild(cover); host.dataset.glass = 'scene';
      if (resizeObserver) resizeObserver.observe(host);
      Object.assign(opts, nextOptions, { mode: 'lobby', departure: null,
        reportActivity: nextOptions.reportActivity || (() => {}),
        reportAnchors: nextOptions.reportAnchors || (() => {}),
        reportWorldMark: nextOptions.reportWorldMark || (() => {}),
        reportLights: nextOptions.reportLights || (() => {}),
        reportDepartureComplete: nextOptions.reportDepartureComplete || (() => {}) });
      LOBBY = true;
      if (isPaused()) { pausedTotalMs += performance.now() - pausedAtReal; pausedAtReal = -1; }
      clock.getDelta();
      glass.jumpPaused(false); glass.setUiFade(1);
      glass.setChrome({ top: 0, bottom: 0, left: 0, right: 0, cards: [] });
      Object.assign(chromeInsets, { top: 0, bottom: 0, left: 0, right: 0 });
      endDrag(); yawOff = 0; pitchOff = 0; swapAt = -1; cover.style.opacity = '0';
      planned = Math.max(60, opts.targetSeconds || 1500);
      reported = Math.max(0, opts.progressSeconds || 0); sim = reported;
      reportedAt = sceneNow(); pendingSpecialFinds.length = 0;
      if (marks && Array.isArray(opts.worldMarks)) opts.worldMarks.forEach((mark) => marks.add(mark));
      setCoreTaken(!!opts.coreTaken, true);
      statusMsg = ''; settleAt(reported);
      runSeed = (Math.abs(Math.floor(opts.seed || 1)) % 2147483646) + 1;
      Object.assign(lobbyCam, { kind: opts.lobbyView?.kind === 'overview' ? 'overview' : 'close', exit: null, cur: null, t: 1 });
      anchorsDirty = true; resize(); requestRedraw(1600);
    },
    setUiFade(opacity) { glass.setUiFade(opacity); requestRedraw(1800); },
    /** Prototype / QA: play a story event now ('opening_a', 'notebook_a', 'stele', 'well', 'rubbing', 'leafTag', 'whistle', 'traces') or a whale pass ('whale'). */
    playStory(key) {
      if (key === 'whale') { whaleForced = sim; requestRedraw(200); return; }
      if (rare || TR.state === 'depart' || TR.state === 'light') return;
      const ev = key === 'traces' ? TRACE_FIRST : SE[key]; if (!ev) return;
      storyQueue.length = 0; setCinematic(false); tracesPending = false;
      storySched.forEach(entry => { if (entry.evs.includes(key)) entry.done = true; });
      if (key === 'opening_a') storyQueue.push(Object.assign({ forced: true }, SE.opening_b));
      if (key === 'notebook_a') storyQueue.push(Object.assign({ forced: true }, SE.notebook_b));
      TR.node = ev.spot; TR.route = null; TR.heading = ev.faceAt ? ev.faceAt(0, NODE[ev.spot].p) : faceFor(ev.spot, ev);
      if (ev.cinematic) setCinematic(true);
      if (key === 'traces') tracesShown = true;
      startAct(ev, ev.dur[0]); update(0, 0); storyCameraStep(0, true); requestRedraw(200);
    },
    /** Prototype / QA: run the world forward by `sec` effective seconds in fixed 50 ms steps. */
    __advance(sec) {
      cameraJumping = true;
      try { for (let t = 0; t < sec - 1e-8; t += .05) { const dt = Math.min(.05, sec - t); reported += dt; reportedAt = sceneNow(); lastIncreaseAt = sceneNow(); update(dt, dt); } }
      finally { cameraJumping = false; opts.reportAdvance?.(reported); }
      requestRedraw(200);
    },
    setChrome(chrome) {
      const top = Math.max(0, Number(chrome && chrome.top) || 0), bottom = Math.max(0, Number(chrome && chrome.bottom) || 0);
      const right = Math.max(0, Number(chrome && chrome.right) || 0), left = Math.max(0, Number(chrome && chrome.left) || 0);
      glass.setChrome(chrome); requestRedraw(700);
      // Only a real layout change reframes the camera; card width changes (new activity text) do not.
      if (Math.abs(top - chromeInsets.top) > 0.5 || Math.abs(bottom - chromeInsets.bottom) > 0.5 || Math.abs(right - chromeInsets.right) > 0.5 || Math.abs(left - chromeInsets.left) > 0.5) {
        chromeInsets.top = top; chromeInsets.bottom = bottom; chromeInsets.right = right; chromeInsets.left = left; resize();
      }
    },
    /** Saved world state changed (core taken elsewhere, marks loaded). Never undoes a reveal in progress. */
    setWorldState(state) {
      if (state && typeof state.coreTaken === 'boolean') setCoreTaken(state.coreTaken, false);
      if (state && Array.isArray(state.worldMarks) && marks) state.worldMarks.forEach((m) => marks.add(m));
    },
    playSpecialFind(eventId, specifiedByCore) {
      const ev = AREA.events.find((entry) => entry.id === eventId && entry.rare && entry.outcome === 'item');
      if (!ev || presentedSpecialFinds.has(eventId)) return;
      presentedSpecialFinds.add(eventId);
      pendingSpecialFinds.push(Object.assign({}, ev, { __specifiedByCore: !!specifiedByCore }));
    },
    setProgress(progressSeconds) {
      const v = Math.max(0, Number(progressSeconds) || 0);
      const t = sceneNow();
      if (v > reported + 0.001) lastIncreaseAt = t;
      if (v < reported - 0.5) { reported = v; reportedAt = t; settleAt(v); return; }
      reported = v; reportedAt = t;
    },
    setRoutes(routes, hoverKey) {
      if (!LOBBY) return;
      const want = {};
      const rank = { none: 0, available: 1, hover: 2, selected: 3 };
      (Array.isArray(routes) ? routes : []).forEach((r) => {
        if (!r || !r.exit || (r.exit !== 'entry' && !DEPART[r.exit])) return;
        const level = r.state === 'selected' ? 'selected' : r.key === hoverKey ? 'hover' : 'available';
        if (!want[r.exit] || rank[level] > rank[want[r.exit]]) want[r.exit] = level;
      });
      Object.keys(want).forEach((exit) => { const tr = trailFor(exit); if (tr) tr.level = want[exit]; });
      Object.keys(trails).forEach((exit) => { if (!want[exit]) trails[exit].level = 'none'; });
      requestRedraw(1500);
    },
    /** Lobby camera: { kind: 'close' } (default), { kind: 'look', exit }, or { kind: 'overview' }. */
    setLobbyView(view) { if (LOBBY) setView(view); },
    /** Lobby: new finds lying beside the resting traveller, [{ key }] (up to 3). */
    setLobbyItems(list) { if (LOBBY) setItems(list); },
    setCameraEnabled(enabled) { cameraEnabled = !!enabled; storyCameraStep(0, true); requestRedraw(200); },
    setReducedMotion(reduced) { opts.reducedMotion = !!reduced; if (reduced) { yawOff = pitchOff = 0; endDrag(); } MOTION = reduced ? 0.25 : 1; swayU.value = 0.55 * MOTION; storyCameraStep(0, true); requestRedraw(200); },
    debugState() { return { camera: { ...cameraReadout, enabled: cameraEnabled, reducedMotion: !!opts.reducedMotion, drag: [yawOff, pitchOff] }, eventProgress: TR.dur ? TR.t / TR.dur : 0, eventDuration: TR.dur, story: { cinematic, queue: storyQueue.map((e) => e.id), whale: +whale.vis.toFixed(3) }, mode: opts.mode, lobbyCam: LOBBY ? { kind: lobbyCam.kind, exit: lobbyCam.exit, t: lobbyCam.t, cur: lobbyCam.cur } : null, items: lobbyItems.map((it) => it.key), trails: Object.fromEntries(Object.entries(trails).map(([k, t]) => [k, { level: t.level, dots: t.n, amt: +t.amt.toFixed(3), visible: t.mesh.visible }])), anchors: Object.assign({}, lastAnchors), sim, planned, lampsLit, lampLevels: lamps.map((lamp) => lamp.level), node: TR.node, state: TR.state, act: TR.act && TR.act.id, departure: TR.dep ? { exit: TR.dep.exit, t: TR.dep.t, done: TR.dep.done } : null, preset: presetKey, coreTaken: astro.taken, tracesPending, walkTo: TR.route ? TR.route.ids[TR.route.ids.length - 1] : null, pendingFinds: pendingSpecialFinds.length, revealP: rare ? Math.min(1, TR.t / TR.dur) : null, paused: isPaused(), sceneTime: tAcc, sceneNowMs: sceneNow(), glass: glass.enabled, chrome: glass.chrome, frustum: { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom } }; },
    destroy() {
      disposed = true;
      clearInterval(backgroundFrameTimer);
      cancelAnimationFrame(raf);
      if (resizeObserver) resizeObserver.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      glass.dispose();
      renderer.dispose();
      delete host.dataset.glass;
      canvas.remove(); cover.remove();
    }
  };
}
