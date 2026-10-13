// 苔痕驛站 — Focus Active and lobby scene (Area 02).
//
// Presentation only. The main process owns effective focus time, the traveller's saved schedule,
// weather, lamps, finds and world marks (src/shared/area02.ts). This module plays them back:
//   setProgress(effectiveSeconds)  → the clock between saved ticks (extrapolated at most 1.5 s)
//   setMossState(MossSceneSnapshot) → the traveller's current action (walk plan, event, wait, lamp, rest),
//                                     weather seed, world marks, umbrella and core state
//   departure                      → the 5-second leave animation at the start of the next Focus
// It never advances focus time, never picks events and never decides rewards. Built from the approved
// prototype docs/prototypes/moss-station.html (world and effects unchanged).
import * as T from '../cloudRuins/vendor/three.module.js';
import AREA from '../../../../docs/area-02-moss-station.scene.json';
import { timeOfDayAt } from '../../../shared/timeOfDay';
import { litLampCount } from '../../../shared/lampTiming';
import { weatherAt } from '../../../shared/weather';
import { createEdgeGlass } from '../cloudRuins/edgeGlass.js';
import { dirShot, keyIndex, spring } from '../exploration/storyDirector';

export const MOSS_SCENE_AREA_ID = 'area-02-moss-station';

export function createMossStationScene(host, options) {
  const opts = Object.assign({
    mode: 'focus', lobbyView: null, progressSeconds: 0, targetSeconds: 3000, reducedMotion: false,
    moss: null, departure: null, departureState: null, departureElapsedMs: 0, paused: false,
    manualFrames: false, arriveFromMist: false,
    reportActivity() {}, reportLights() {}, reportDepartureComplete() {}, reportAnchors() {}, reportWorldMark() {}, reportCinematic() {}
  }, options || {});
  let LOBBY = opts.mode === 'lobby';

  // ---------- renderer / scene ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'cloud-ruins-canvas moss-station-canvas';
  host.appendChild(canvas);
  const cover = document.createElement('div');
  cover.className = 'cloud-ruins-cover';
  cover.setAttribute('aria-hidden', 'true');
  host.appendChild(cover);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  // Glass behind the Focus Active / lobby text is sampled from this same frame (see edgeGlass.js).
  const glass = createEdgeGlass(renderer);
  if (opts.paused) glass.jumpPaused(true);
  host.dataset.glass = 'scene';
  const scene = new T.Scene();
  const DIST = 80;
  let MOTION = opts.reducedMotion ? 0.25 : 1;

  // ---------- pausable scene time ----------
  // Every animation reads time from here. While the Focus is paused this clock stands still and on
  // resume it carries on from the same instant: pause time is never replayed or skipped over.
  let pausedAtReal = opts.paused ? performance.now() : -1;
  let pausedTotalMs = 0;
  const sceneNow = () => (pausedAtReal >= 0 ? pausedAtReal : performance.now()) - pausedTotalMs;
  const isPaused = () => pausedAtReal >= 0;
  let redrawUntil = 0;
  const requestRedraw = (ms) => { redrawUntil = Math.max(redrawUntil, performance.now() + (ms || 120)); };

  // =====================================================================
  // world (from the approved prototype)
  // =====================================================================

// ---------- math & noise ----------
let seed = 43;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
const mr = (a, b) => a + (b - a) * Math.random();
const S = Math.SQRT1_2;
const W = (u, v, y) => new T.Vector3(u * S - v * S, y || 0, -u * S - v * S);
const toUV = (x, z) => [(x / S - z / S) / 2, (-z / S - x / S) / 2];
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const nz = (u, v) => Math.sin(u * 0.83 + v * 0.31) * Math.cos(v * 0.67 - u * 0.27) * 0.5 + Math.sin(u * 1.9 - v * 1.3 + 1.7) * 0.25;
const V3 = (x, y, z) => new T.Vector3(x, y, z);
const fract = (x) => x - Math.floor(x);
const h3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t; const c = (i, j, k) => h3(xi + i, yi + j, zi + k);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), xf), L(c(0, 1, 0), c(1, 1, 0), xf), yf), L(L(c(0, 0, 1), c(1, 0, 1), xf), L(c(0, 1, 1), c(1, 1, 1), xf), yf), zf);
}
const fbm = (x, y, z) => 0.55 * vnoise(x, y, z) + 0.3 * vnoise(x * 2.13 + 5.2, y * 2.13 + 1.3, z * 2.13 + 7.7) + 0.15 * vnoise(x * 4.31 + 9.1, y * 4.31 + 3.3, z * 4.31 + 2.2);
const yawFor = (du, dv) => Math.atan2(du - dv, -(du + dv));
const headingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const easeIO = (x) => x * x * (3 - 2 * x);

// ---------- time presets (clear, and the overcast version of each) ----------
const PRE = {
  dawn:  { bg: 0xdfe3df, fog: 0xd0d6d2, near: -4, far: 32, sun: 0xffdcc2, sunI: 0.7, sunAt: [-26, 3, 9], hS: 0xdfe5e8, hG: 0x7a8272, hI: 0.62, lamp: 0.6, win: 0.55, mist: 0.6, cloud: 0xf2f2ef, shaft: 0.12, fire: 0 },
  day:   { bg: 0xd7e2dc, fog: 0xc6d2cd, near: 0, far: 44, sun: 0xfff3e2, sunI: 0.7, sunAt: [-15, -6, 22], hS: 0xdde5e6, hG: 0x5a6250, hI: 0.5, lamp: 0.35, win: 0.35, mist: 0.42, cloud: 0xeef2ef, shaft: 0.16, fire: 0 },
  dusk:  { bg: 0x7c8990, fog: 0x6a787d, near: 3, far: 40, sun: 0xf2a06a, sunI: 0.95, sunAt: [26, 7, 7], hS: 0xa6a9b3, hG: 0x384036, hI: 0.55, lamp: 1.0, win: 1.0, mist: 0.5, cloud: 0xc9c6cc, shaft: 0.13, fire: 0.3 },
  night: { bg: 0x1a2530, fog: 0x142029, near: 0, far: 40, sun: 0xa9bddb, sunI: 0.4, sunAt: [-10, 6, 20], hS: 0x4a5a74, hG: 0x141b24, hI: 0.62, lamp: 1.6, win: 1.5, mist: 0.28, cloud: 0x3a4658, shaft: 0, fire: 1 }
};
const RAIN = {
  dawn:  { bg: 0xb4bcbb, fog: 0xa8b1b0, near: -6, far: 28, sun: 0xe6e2dc, sunI: 0.25, hS: 0xc6cdce, hG: 0x4a5247, hI: 0.72, lamp: 0.9, win: 0.8, mist: 0.8, cloud: 0xc9cfcd, shaft: 0, fire: 0 },
  day:   { bg: 0xa3aeac, fog: 0x939f9e, near: -6, far: 34, sun: 0xdfe6e8, sunI: 0.28, hS: 0xbcc6c7, hG: 0x3d453a, hI: 0.78, lamp: 0.8, win: 0.8, mist: 0.75, cloud: 0xb9c2c1, shaft: 0, fire: 0 },
  dusk:  { bg: 0x5d6970, fog: 0x56636a, near: -6, far: 32, sun: 0xd79a78, sunI: 0.32, hS: 0x8e98a2, hG: 0x2c332c, hI: 0.62, lamp: 1.2, win: 1.15, mist: 0.7, cloud: 0x7d878d, shaft: 0, fire: 0 },
  night: { bg: 0x121b22, fog: 0x0f171d, near: -4, far: 30, sun: 0xa9bddb, sunI: 0.18, hS: 0x3d4c63, hG: 0x10161f, hI: 0.5, lamp: 1.8, win: 1.6, mist: 0.4, cloud: 0x2c3644, shaft: 0, fire: 0 }
};
const COLOR_KEYS = ['bg', 'fog', 'sun', 'hS', 'hG', 'cloud'];
const NUM_KEYS = ['near', 'far', 'sunI', 'hI', 'lamp', 'win', 'mist', 'shaft', 'fire'];
const toState = (p) => { const s = {}; COLOR_KEYS.forEach((k) => { s[k] = new T.Color(p[k]); }); NUM_KEYS.forEach((k) => { s[k] = p[k]; }); if (p.sunAt) s.sunAt = W(p.sunAt[0], p.sunAt[1], p.sunAt[2]).normalize(); return s; };
const CLEAR_S = {}, RAIN_S = {};
Object.keys(PRE).forEach((k) => { CLEAR_S[k] = toState(PRE[k]); RAIN_S[k] = toState(Object.assign({}, PRE[k], RAIN[k])); });
const cur = toState(PRE.dawn);
const P = PRE.dusk; // build-time reference only; runtime colours come from `cur`

scene.background = new T.Color(P.bg);
scene.fog = new T.Fog(P.fog, DIST + P.near, DIST + P.far);

const mat = (c, e) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.95, metalness: 0, flatShading: true }, e || {}));
const M = {
  bark: mat(0x5c4b3c), barkDark: mat(0x483b30), barkGrey: mat(0x6b6158),
  moss: mat(0x6f8a4a), mossDeep: mat(0x4f6a3c), mossBright: mat(0x7e9459),
  wood: mat(0x7d624a), woodDark: mat(0x564436), plank: mat(0x8c6f52), plankGrey: mat(0x857866),
  roof: mat(0x56634a), shingle: mat(0x6a5a4a),
  stone: mat(0xa09d93), stoneDark: mat(0x7a7870), stoneMoss: mat(0x7f8b6c), lampStone: mat(0xa9a397),
  cloth: mat(0xd9cfb8), clothBlue: mat(0x6b7d8e), clothRed: mat(0x9b6b56), clothGreen: mat(0x6f7f5e), leather: mat(0x7b5a3e),
  paper: mat(0xe9e1cf), dark: mat(0x27231f), rope: mat(0x8d7c63),
  fern: mat(0x587840), fern2: mat(0x68864b), pine: mat(0x4a6755), pine2: mat(0x55725f),
  cloak: mat(0x3d4659), hat: mat(0xb49c70), skin: mat(0xe0d2c0, { flatShading: false }),
  water: new T.MeshStandardMaterial({ color: 0x587876, roughness: 0.22, metalness: 0.25, transparent: true, opacity: 0.9, side: T.DoubleSide }),
  mush: mat(0xc9b38e), mushRed: mat(0xa4654e),
  brass: new T.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.55, roughness: 0.42 })
};
const glowWin = new T.MeshStandardMaterial({ color: 0x3a2e22, emissive: 0xffb865, emissiveIntensity: 1, roughness: 1, side: T.DoubleSide });
glowWin.userData.glow = true;
const glowOff = mat(0x3b3630);
const shadowy = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
const mesh = (geo, m, parent, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); (parent || scene).add(o); return o; };
const dyn = (o) => { o.userData.dyn = true; return o; };
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new T.CanvasTexture(c); };
const haloTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,160,1)'); g.addColorStop(0.35, 'rgba(255,180,100,0.35)'); g.addColorStop(1, 'rgba(255,160,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const mistTex = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
const dotTex = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });
const shaftTex = canvasTex(64, 256, (x) => { const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); const g2 = x.createLinearGradient(0, 0, 0, 256); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.25, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'destination-in'; x.fillStyle = g2; x.fillRect(0, 0, 64, 256); });

// ---------- lights ----------
const hemi = new T.HemisphereLight(P.hS, P.hG, P.hI); scene.add(hemi);
const sun = new T.DirectionalLight(P.sun, P.sunI);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// ---------- runtime registries ----------
const R = { lamps: [], ferns: [], crowns: [], chimes: [], smokes: [], mists: [], layers: [], ridges: [], shafts: [], interior: [], eaves: [], puddles: [], waterfalls: [] };

// ---------- terrain primitives ----------
let H = () => 0; let PATHS = []; let WATERLINE = null; let BW_Y = null;
let SEGS = [];
const segs = () => { const out = []; PATHS.forEach((p) => { for (let i = 0; i < p.pts.length - 1; i++) out.push([p.pts[i], p.pts[i + 1], p.w || 0.9]); }); return out; };
function segDist(u, v, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy))); const x = a[0] + dx * t - u, y = a[1] + dy * t - v; return Math.sqrt(x * x + y * y); }
function segT(u, v, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; return Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy))); }
function pathD(u, v) { let m = 1e9; for (const s of SEGS) { const d = segDist(u, v, s[0], s[1]) - (s[2] - 0.9); if (d < m) m = d; } return m; }
function polyD(u, v, pts) { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segDist(u, v, pts[i], pts[i + 1])); return m; }
const at = (u, v, dy) => W(u, v, H(u, v) + (dy || 0));

const cMossDeep = new T.Color(0x546f3e), cMoss = new T.Color(0x6b8748), cGrass = new T.Color(0x86915c), cPath = new T.Color(0x8f7b62), cPathL = new T.Color(0xa08d73), cRock = new T.Color(0x77776e), cRockMoss = new T.Color(0x66725a), cEarth = new T.Color(0x6a5a47);
function buildTerrain(u0, u1, v0, v1, res, colorFn) {
  const pos = [], col = []; const tmp = new T.Color();
  const pt = (u, v) => { const j = 0.12 * Math.sin(u * 12.9898 + v * 78.233); return [u + j, v - j]; };
  for (let u = u0; u < u1; u += res) for (let v = v0; v < v1; v += res) {
    const A = pt(u, v), B = pt(u + res, v), C = pt(u + res, v + res), D = pt(u, v + res);
    [[A, B, C], [A, C, D]].forEach((tri) => {
      const ps = tri.map((q) => W(q[0], q[1], H(q[0], q[1])));
      const n = new T.Vector3().subVectors(ps[1], ps[0]).cross(new T.Vector3().subVectors(ps[2], ps[0])).normalize(); if (n.y < 0) n.negate();
      const cu = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cv = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      colorFn(cu, cv, H(cu, cv), n.y, tmp); tmp.multiplyScalar(0.975 + 0.05 * rnd());
      const nn = new T.Vector3().subVectors(ps[1], ps[0]).cross(new T.Vector3().subVectors(ps[2], ps[0]));
      (nn.y >= 0 ? [0, 1, 2] : [0, 2, 1]).forEach((i) => { pos.push(ps[i].x, ps[i].y, ps[i].z); col.push(tmp.r, tmp.g, tmp.b); });
    });
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); m.receiveShadow = true; m.userData.noMerge = true; scene.add(m); return m;
}
function defaultColor(u, v, h, ny, out) {
  const pd = pathD(u, v);
  if (ny < 0.62) { out.copy(cRock).lerp(cRockMoss, 0.5 + 0.5 * nz(u * 2, v * 2)); return; }
  if (ny < 0.8) { out.copy(cRockMoss).lerp(cMossDeep, (ny - 0.62) / 0.18); return; }
  const g = 0.5 + 0.5 * nz(u * 0.7 + 3, v * 0.7);
  out.copy(cMossDeep).lerp(cMoss, g); if (g > 0.75) out.lerp(cGrass, (g - 0.75) * 2);
  if (pd < 1.35) { const k = sstep(1.35, 0.7, pd); const p = new T.Color().copy(cPath).lerp(cPathL, 0.5 + 0.5 * nz(u * 3, v * 3)); out.lerp(p, k); }
}

// ---------- living moss ----------
const MOSS_COLS = [0x5b763c, 0x6a8544, 0x7a9150, 0x52693a, 0x86955a, 0x607a42].map((c) => new T.Color(c));
const MOSS_DARK = new T.Color(0x3f5530);
function mossColor(f, out) { const i = Math.floor(fract(f * 5.7) * MOSS_COLS.length); return out.copy(MOSS_COLS[i]).lerp(MOSS_COLS[(i + 1) % MOSS_COLS.length], fract(f * 13.1)); }
function mossify(list, o) {
  o = Object.assign({ thr: 0.35, bias: 0, scale: 0.9, strength: 1 }, o || {});
  const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), N = new T.Vector3(), Cn = new T.Vector3(), tmp = new T.Color(), mc = new T.Color();
  list.forEach((m) => {
    if (!m || !m.isMesh || !m.geometry || !m.material || m.material.isMeshBasicMaterial || m.material.transparent || m.material.userData.glow) return;
    m.updateMatrixWorld(true);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    const pos = g.attributes.position; const col = new Float32Array(pos.count * 3); const base = m.material.color.clone();
    for (let i = 0; i < pos.count; i += 3) {
      A.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); B.fromBufferAttribute(pos, i + 1).applyMatrix4(m.matrixWorld); C.fromBufferAttribute(pos, i + 2).applyMatrix4(m.matrixWorld);
      N.subVectors(B, A).cross(Cn.subVectors(C, A)).normalize(); Cn.copy(A).add(B).add(C).multiplyScalar(1 / 3);
      const f = fbm(Cn.x * o.scale, Cn.y * o.scale * 1.3, Cn.z * o.scale);
      const k = sstep(0, 0.22, N.y - o.thr + (f - 0.5) * 1.25 + o.bias) * o.strength;
      tmp.copy(base); if (k > 0) { mossColor(f, mc); if (k < 0.5) mc.lerp(MOSS_DARK, 0.25); tmp.lerp(mc, Math.min(1, k * 1.1)); }
      tmp.multiplyScalar(0.95 + 0.1 * h3(Cn.x, Cn.y, Cn.z));
      for (let j = 0; j < 3; j++) { col[(i + j) * 3] = tmp.r; col[(i + j) * 3 + 1] = tmp.g; col[(i + j) * 3 + 2] = tmp.b; }
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    m.geometry = g; const mm = m.material.clone(); mm.vertexColors = true; mm.color.set(0xffffff); m.material = mm;
  });
}
const MOSS_MATS = [mat(0x5b763c), mat(0x6f8a47), mat(0x4e6636)];
function sheet(Wd, L, o) {
  o = Object.assign({ base: 0x6a7176, rust: 0x7a5d49, corr: true, moss: 0, step: 0.16, tufts: true, drip: true, seed: rr(0, 50) }, o || {});
  const segX = Math.ceil(Wd / 0.12), segZ = Math.ceil(L / 0.12);
  let geo = new T.PlaneGeometry(Wd, L, segX, segZ); geo.rotateX(-Math.PI / 2);
  const sd = o.seed;
  const field = (x, z) => { const s = (z + L / 2) / L; return (fbm(x * 0.55 + sd, s * 2.0, sd * 0.37) - 0.5) * 1.8 + 0.36 * s * s + o.moss + 0.18 + 0.2 * (vnoise(x * 3.1 + sd, s * 6, 1.7) - 0.5); };
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const m = field(x, z); const corr = o.corr ? 0.02 * Math.sin(x * Math.PI * 2 / o.step) : 0.012 * fract(z / 0.22 + 0.5 * Math.floor(x / 0.35)); const th = m > 0.42 ? (m - 0.42) * 0.22 * (0.7 + 0.6 * h3(x * 9, z * 9, sd)) : 0; p.setY(i, corr + th); }
  geo.computeVertexNormals(); geo = geo.toNonIndexed(); const q = geo.attributes.position; const col = new Float32Array(q.count * 3);
  const bc = new T.Color(o.base), rc = new T.Color(o.rust), c = new T.Color(), mc = new T.Color();
  for (let i = 0; i < q.count; i += 3) {
    const x = (q.getX(i) + q.getX(i + 1) + q.getX(i + 2)) / 3, z = (q.getZ(i) + q.getZ(i + 1) + q.getZ(i + 2)) / 3; const s = (z + L / 2) / L;
    const m = field(x, z); const streak = fbm(x * 3.2 + sd, s * 0.45, 3.1);
    c.copy(bc).multiplyScalar(0.92 + 0.14 * vnoise(x * 1.3, s * 3, sd));
    c.lerp(rc, sstep(0.56, 0.82, streak + 0.18 * s) * 0.55);
    const k = sstep(0.36, 0.5, m); if (k > 0) { mossColor(fbm(x * 1.9, s * 3.3, sd + 4), mc); mc.lerp(MOSS_DARK, sstep(0.55, 0.36, m) * 0.5); c.lerp(mc, k); }
    c.multiplyScalar(0.96 + 0.08 * h3(x, z, sd));
    for (let j = 0; j < 3; j++) { col[(i + j) * 3] = c.r; col[(i + j) * 3 + 1] = c.g; col[(i + j) * 3 + 2] = c.b; }
  }
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const me = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: o.corr ? 0.1 : 0, flatShading: false, side: T.DoubleSide })); me.castShadow = true; me.receiveShadow = true;
  if (o.tufts) {
    const n = Math.floor(Wd * L * 9); const tg = new T.IcosahedronGeometry(0.07, 0); const im = new T.InstancedMesh(tg, new T.MeshStandardMaterial({ roughness: 1, flatShading: true }), n);
    const d = new T.Object3D(); let k = 0;
    for (let t = 0; t < n * 4 && k < n; t++) { const x = rr(-Wd / 2, Wd / 2), z = rr(-L / 2, L / 2); const m = field(x, z); if (m < 0.5 || rnd() > (m - 0.45) * 2.2) continue; d.position.set(x, 0.03 + (m - 0.42) * 0.2, z); const sc = rr(0.6, 1.5); d.scale.set(sc, sc * rr(0.35, 0.6), sc); d.rotation.y = rr(0, 6); d.updateMatrix(); im.setMatrixAt(k, d.matrix); im.setColorAt(k, mossColor(rnd(), mc).multiplyScalar(rr(0.9, 1.12))); k++; }
    im.count = k; im.receiveShadow = true; me.add(im);
  }
  if (o.drip) {
    for (let x = -Wd / 2 + 0.1; x < Wd / 2; x += rr(0.12, 0.3)) {
      const m = field(x, L / 2 - 0.05); if (m < 0.48) continue;
      const len = rr(0.06, 0.32) * (m - 0.35) * 2.5; const st = mesh(new T.CylinderGeometry(0.025, 0.008, len, 4), MOSS_MATS[Math.floor(rnd() * 3)], me, x, -len / 2 + 0.02, L / 2 + 0.01); st.rotation.x = rr(-0.2, 0.1);
    }
  }
  me.userData.field = field; me.userData.noMerge = true;
  return me;
}
function sheetRoof(g, w, d, y, pitch, o) {
  o = o || {}; const xo = o.xo || 0; const oh = o.oh || 0.5; const half = d / 2 + oh;
  const out = [];
  [1, -1].forEach((sgn) => { const grp = new T.Group(); grp.position.set(xo, y + Math.tan(pitch) * half / 2, 0); grp.rotation.y = sgn > 0 ? 0 : Math.PI; g.add(grp); const sh = sheet(w + oh * 2, half / Math.cos(pitch), Object.assign({}, o, { seed: rr(0, 60), moss: (o.moss || 0) + (sgn < 0 ? 0.08 : 0) })); sh.position.set(0, 0, half / 2); sh.rotation.x = pitch; grp.add(sh); out.push(sh); });
  const ridgeH = Math.tan(pitch) * d / 2; const shp = new T.Shape(); shp.moveTo(-d / 2, 0); shp.lineTo(d / 2, 0); shp.lineTo(0, ridgeH); shp.lineTo(-d / 2, 0);
  const gm = mesh(new T.ExtrudeGeometry(shp, { depth: w - 0.1, bevelEnabled: false }), o.gable || M.wood, g, xo + (w - 0.1) / 2, y, 0); gm.rotation.y = -Math.PI / 2;
  mesh(new T.BoxGeometry(w + oh * 2, 0.08, 0.22), mat(o.ridge || 0x55595c), g, xo, y + Math.tan(pitch) * half + 0.04, 0);
  return out;
}

// ---------- merging (static geometry into a few draw calls) ----------
function materialKey(m, cast) { return [m.type, m.color.getHex(), m.roughness.toFixed(2), m.metalness.toFixed(2), m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0, m.side, cast ? 1 : 0].join('|'); }
function mergeUnder(root, opts) {
  opts = opts || {};
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const isDyn = (o) => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.dyn) return true; return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o === root || o.userData.noMerge || o.children.length) return;
    if (opts.skipDyn !== false && isDyn(o)) return;
    const m = o.material; if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent || m.map || m.alphaMap || m.userData.glow) return;
    if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return;
    const key = materialKey(m, o.castShadow);
    if (!groups.has(key)) groups.set(key, { mat: m, cast: o.castShadow, list: [] });
    groups.get(key).list.push(o);
  });
  const mtx = new T.Matrix4(), nmx = new T.Matrix3();
  let merged = 0;
  groups.forEach((G) => {
    if (G.list.length < 2 && !opts.always) return;
    let count = 0; const parts = [];
    G.list.forEach((o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; parts.push({ o, g }); count += g.attributes.position.count; });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3); const col = G.mat.vertexColors ? new Float32Array(count * 3) : null;
    let off = 0; const v = new T.Vector3();
    parts.forEach(({ o, g }) => {
      mtx.multiplyMatrices(inv, o.matrixWorld); nmx.getNormalMatrix(mtx);
      const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mtx); pos[(off + i) * 3] = v.x; pos[(off + i) * 3 + 1] = v.y; pos[(off + i) * 3 + 2] = v.z;
        if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nmx).normalize(); nor[(off + i) * 3] = v.x; nor[(off + i) * 3 + 1] = v.y; nor[(off + i) * 3 + 2] = v.z; }
        if (col) { if (c) { col[(off + i) * 3] = c.getX(i); col[(off + i) * 3 + 1] = c.getY(i); col[(off + i) * 3 + 2] = c.getZ(i); } else { col[(off + i) * 3] = col[(off + i) * 3 + 1] = col[(off + i) * 3 + 2] = 1; } }
      }
      off += p.count;
      o.parent.remove(o);
    });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); if (col) geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const me = new T.Mesh(geo, G.mat); me.castShadow = G.cast; me.receiveShadow = true; me.userData.noMerge = true; root.add(me); merged++;
  });
  return merged;
}

// ---------- props ----------
function limb(parent, a, b, r0, r1, m, sides, hseg) {
  const dir = b.clone().sub(a); const len = dir.length();
  const geo = new T.CylinderGeometry(r1, r0, len, sides || 7, hseg || 1); geo.translate(0, len / 2, 0);
  const o = new T.Mesh(geo, m || M.bark); o.position.copy(a); o.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize()); parent.add(o); o.castShadow = true; o.receiveShadow = true; return o;
}
function mossBlob(parent, p, r, m) { const b = mesh(new T.IcosahedronGeometry(r, 0), m || (rnd() < 0.5 ? M.moss : M.mossBright), parent, p.x, p.y, p.z); b.scale.y = 0.42; b.rotation.y = rr(0, 3); b.receiveShadow = true; return b; }
function root(pts, r0, r1, opt) {
  opt = opt || {};
  const curve = new T.CatmullRomCurve3(pts); const N = opt.n || 14;
  for (let i = 0; i < N; i++) {
    const a = curve.getPoint(i / N), b = curve.getPoint((i + 1) / N);
    const ra = r0 + (r1 - r0) * (i / N), rb = r0 + (r1 - r0) * ((i + 1) / N);
    const lm = limb(scene, a, b, ra, rb, opt.m || M.bark, 7);
    const j = mesh(new T.IcosahedronGeometry(ra * 1.02, 0), opt.m || M.bark, scene, a.x, a.y, a.z); j.castShadow = true;
    mossify([lm, j], { thr: opt.thr === undefined ? 0.15 : opt.thr, scale: 1.1 });
  }
  return curve;
}
function vine(p, len) { const g = new T.Group(); g.position.copy(p); scene.add(g); let y = 0; const n = Math.ceil(len / 0.35); for (let i = 0; i < n; i++) { mesh(new T.CylinderGeometry(0.02, 0.02, 0.36, 4), M.mossDeep, g, Math.sin(i * 0.9) * 0.04, y - 0.18, 0); if (rnd() < 0.6) { const l = mesh(new T.IcosahedronGeometry(0.07, 0), rnd() < 0.5 ? M.moss : M.fern2, g, 0.05, y - 0.1, 0.03); l.scale.set(1, 0.5, 1.4); } y -= 0.35; } return g; }
function crownBlob(parent, x, y, z, r, pal) { const m = mesh(new T.IcosahedronGeometry(r, 1), mat(pal[Math.floor(rnd() * pal.length)]), parent, x, y, z); m.scale.set(rr(0.95, 1.15), rr(0.55, 0.68), rr(0.95, 1.15)); m.rotation.set(rr(-0.2, 0.2), rr(0, 3), rr(-0.2, 0.2)); m.castShadow = true; m.receiveShadow = true; return m; }
const PAL_BRIGHT = [0x5d7a4b, 0x6a8654, 0x51704a, 0x738f5a];
function tree(u, v, s, pal) {
  const g = new T.Group(); g.position.copy(at(u, v)); g.scale.setScalar(s); scene.add(g);
  const tr = [V3(0, 0, 0), V3(0.12, 1.0, 0.05), V3(0.3, 1.9, -0.1), V3(0.18, 2.6, 0.18)];
  for (let i = 0; i < 3; i++) limb(g, tr[i], tr[i + 1], 0.36 - i * 0.09, 0.28 - i * 0.07);
  const crown = dyn(new T.Group()); g.add(crown);
  [[0.2, 3.0, 0.2, 1.3], [-0.9, 2.7, 0.4, 1.0], [1.1, 2.7, -0.4, 1.0], [0.3, 2.8, -1.0, 0.95], [0.4, 3.5, 0.5, 0.85], [-0.4, 3.4, -0.5, 0.9]].forEach((b) => crownBlob(crown, b[0], b[1], b[2], b[3], pal || PAL_BRIGHT));
  mergeUnder(crown, { skipDyn: false }); R.crowns.push({ o: crown, ph: rr(0, 6), amp: 0.014 });
  return g;
}
function cedar(u, v, s, y) {
  const g = new T.Group(); g.position.copy(y === undefined ? at(u, v) : W(u, v, y)); g.scale.setScalar(s); scene.add(g);
  mesh(new T.CylinderGeometry(0.12, 0.2, 3.2, 6), M.barkDark, g, 0, 1.6, 0);
  const cm = [mat(0x3e5848), mat(0x46614f), mat(0x3a5243)];
  for (let i = 0; i < 6; i++) { const c = mesh(new T.ConeGeometry(0.95 - i * 0.13, 1.25, 7), cm[i % 3], g, 0, 1.9 + i * 0.72, 0); c.rotation.y = rr(0, 3); }
  shadowy(g); return g;
}
function fern(u, v, s, y) {
  const g = new T.Group(); g.position.copy(y === undefined ? at(u, v) : W(u, v, y)); g.scale.setScalar(s); scene.add(g);
  const n = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) { const f = new T.Group(); f.rotation.y = i / n * Math.PI * 2 + rr(-0.2, 0.2); g.add(f); const c = mesh(new T.ConeGeometry(0.13, 0.95, 4), rnd() < 0.5 ? M.fern : M.fern2, f, 0, 0.42, 0); c.scale.set(1, 1, 0.3); c.position.set(0, 0.34, 0.3); c.rotation.x = rr(0.85, 1.15); c.castShadow = true; }
  return g;
}
function rockAt(p, s, mossy) { const m = mesh(new T.DodecahedronGeometry(s, 1), M.stoneDark, scene, p.x, p.y + s * 0.25, p.z); m.scale.y = 0.62; m.rotation.set(rr(0, 3), rr(0, 3), 0); m.castShadow = true; m.receiveShadow = true; if (mossy) mossify([m], { thr: 0.1, scale: 1.4 }); return m; }
function mushroom(u, v, s) { const g = new T.Group(); g.position.copy(at(u, v)); g.scale.setScalar(s); scene.add(g); mesh(new T.CylinderGeometry(0.04, 0.05, 0.18, 5), M.paper, g, 0, 0.09, 0); const c = mesh(new T.ConeGeometry(0.12, 0.09, 7), rnd() < 0.4 ? M.mushRed : M.mush, g, 0, 0.2, 0); c.castShadow = true; }
function place(obj, u, v, yaw, dy) { obj.position.copy(at(u, v, dy)); obj.rotation.y = Math.PI / 4 + (yaw || 0); scene.add(obj); shadowy(obj); return obj; }
function stilts(g, w, d, fl, drop) { [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => mesh(new T.CylinderGeometry(0.09, 0.11, fl + drop, 6), M.woodDark, g, a * (w / 2), (fl - drop) / 2, b * (d / 2))); }
function plankWall(g, w, h, x, y, z, rotY) { const f = new T.Group(); f.position.set(x, y, z); f.rotation.y = rotY || 0; g.add(f); const n = Math.max(2, Math.round(h / 0.28)); for (let i = 0; i < n; i++) { const b = mesh(new T.BoxGeometry(w, h / n - 0.02, 0.12), i % 2 ? M.wood : M.plank, f, 0, (i + 0.5) * h / n, 0); b.position.z = (i % 2) * 0.015; } return f; }
function crate(g, x, y, z, s, m) { const c = mesh(new T.BoxGeometry(s, s * 0.75, s * 0.8), m || M.wood, g, x, y + s * 0.375, z); c.rotation.y = rr(-0.3, 0.3); return c; }
function sack(g, x, y, z, s, m) { const c = mesh(new T.IcosahedronGeometry(s, 0), m || M.cloth, g, x, y + s * 0.7, z); c.scale.set(1, 1.2, 0.9); return c; }
function luggageRack(g, x, z, rotY) {
  const r = new T.Group(); r.position.set(x, 0, z); r.rotation.y = rotY || 0; g.add(r);
  [-0.8, 0.8].forEach((a) => mesh(new T.BoxGeometry(0.09, 1.7, 0.09), M.woodDark, r, a, 0.85, -0.2));
  [-0.8, 0.8].forEach((a) => mesh(new T.BoxGeometry(0.09, 1.7, 0.09), M.woodDark, r, a, 0.85, 0.25));
  [0.25, 0.85, 1.45].forEach((y, i) => {
    mesh(new T.BoxGeometry(1.75, 0.07, 0.55), M.plank, r, 0, y, 0.02);
    if (i === 0) { crate(r, -0.45, y + 0.04, 0, 0.5, M.leather); sack(r, 0.35, y + 0.04, 0, 0.26, M.clothGreen); }
    if (i === 1) { crate(r, 0.4, y + 0.04, 0, 0.42, M.wood); sack(r, -0.35, y + 0.04, 0.02, 0.22, M.cloth); mesh(new T.CylinderGeometry(0.1, 0.1, 0.3, 7), M.brass, r, -0.7, y + 0.2, 0.05); }
    if (i === 2) { mesh(new T.CylinderGeometry(0.12, 0.12, 0.6, 7), M.rope, r, -0.2, y + 0.14, 0).rotation.z = Math.PI / 2; crate(r, 0.5, y + 0.04, 0, 0.3, M.paper); }
  });
  const hat = mesh(new T.ConeGeometry(0.26, 0.12, 10), M.hat, r, 0.95, 1.55, 0.3); hat.rotation.z = -0.4;
  return r;
}
function bench(g, x, z, rotY, w) { const b = new T.Group(); b.position.set(x, 0, z); b.rotation.y = rotY || 0; g.add(b); mesh(new T.BoxGeometry(w || 1.3, 0.08, 0.36), M.plank, b, 0, 0.42, 0); [-1, 1].forEach((s) => mesh(new T.BoxGeometry(0.08, 0.42, 0.3), M.woodDark, b, s * ((w || 1.3) / 2 - 0.12), 0.21, 0)); return b; }
function latticeWindow(g, x, y, z, ww, hh, rotY) {
  const f = new T.Group(); f.position.set(x, y, z); f.rotation.y = rotY || 0; g.add(f);
  mesh(new T.PlaneGeometry(ww, hh), glowWin, f, 0, 0, 0.012);
  const fr = M.woodDark;
  mesh(new T.BoxGeometry(ww + 0.14, 0.08, 0.1), fr, f, 0, hh / 2, 0.03); mesh(new T.BoxGeometry(ww + 0.14, 0.08, 0.1), fr, f, 0, -hh / 2, 0.03);
  mesh(new T.BoxGeometry(0.07, hh, 0.08), fr, f, -ww / 2, 0, 0.03); mesh(new T.BoxGeometry(0.07, hh, 0.08), fr, f, ww / 2, 0, 0.03);
  for (let i = 1; i < 4; i++) mesh(new T.BoxGeometry(0.035, hh, 0.05), fr, f, -ww / 2 + i * ww / 4, 0, 0.035);
  mesh(new T.BoxGeometry(ww, 0.035, 0.05), fr, f, 0, 0, 0.035);
}
function interiorLight(parent, x, y, z, k, dist) { const l = new T.PointLight(0xffb060, 0, dist || 4, 2); l.position.set(x, y, z); parent.add(l); R.interior.push({ l, k }); return l; }

// lamps: glow is driven by the saved lamp count, never by animation
function lampParts(g, x, y, z, bulbGeo, shadeFn) {
  const glow = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 0, roughness: 1 }); glow.userData.glow = true;
  const bulb = mesh(bulbGeo, glow, g, x, y, z);
  const light = new T.PointLight(0xffb05a, 0, 6, 2); light.position.set(x, y - 0.05, z); g.add(light);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })); halo.scale.set(1.4, 1.4, 1); halo.position.set(x, y, z); g.add(halo);
  // daylight glow: additive light vanishes against a pale sky, so a warm normal-blended bloom carries the lit lamp by day
  const dayHalo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: 0xffa040, depthWrite: false, transparent: true, opacity: 0, fog: false })); dayHalo.scale.set(1.05, 1.05, 1); dayHalo.position.set(x, y, z); dayHalo.renderOrder = 2; g.add(dayHalo);
  if (shadeFn) shadeFn();
  return { glow, light, halo, dayHalo, bulb };
}
function stationLamp(u, v) {
  const g = new T.Group(); const iron = mat(0x3b3f3c);
  mesh(new T.CylinderGeometry(0.05, 0.08, 2.6, 6), iron, g, 0, 1.3, 0);
  mesh(new T.BoxGeometry(0.5, 0.05, 0.05), iron, g, 0.2, 2.55, 0);
  mesh(new T.ConeGeometry(0.26, 0.18, 10, 1, true), mat(0x4d5a52, { side: T.DoubleSide }), g, 0.42, 2.45, 0);
  mesh(new T.CylinderGeometry(0.035, 0.035, 0.08, 6), iron, g, 0.42, 2.35, 0);
  const L = lampParts(g, 0.42, 2.2, 0, new T.SphereGeometry(0.13, 10, 8));
  place(g, u, v, 0); mossify(g.children.slice(0, 1), { thr: -0.4, bias: -0.2, scale: 3 });
  return Object.assign(L, { g, level: 0 });
}
function hangLamp(u, v) {
  const g = new T.Group();
  mesh(new T.CylinderGeometry(0.07, 0.09, 2.2, 6), M.woodDark, g, 0, 1.1, 0);
  mesh(new T.BoxGeometry(0.7, 0.07, 0.07), M.woodDark, g, 0.3, 2.1, 0);
  mesh(new T.CylinderGeometry(0.01, 0.01, 0.25, 3), M.rope, g, 0.58, 1.95, 0);
  const cap = mesh(new T.ConeGeometry(0.24, 0.14, 4), M.woodDark, g, 0.58, 1.9, 0); cap.rotation.y = Math.PI / 4;
  const L = lampParts(g, 0.58, 1.7, 0, new T.BoxGeometry(0.24, 0.3, 0.24));
  place(g, u, v, 0); mossify(g.children.slice(0, 2), { thr: 0.2, bias: 0.05, scale: 3 });
  return Object.assign(L, { g, level: 0 });
}

// fern fronds (merged per cluster so each cluster can sway as one piece)
const FERN_MATS = [mat(0x5f8043), mat(0x6f9050), mat(0x557639), mat(0x7a9656)];
function frond(parent, origin, yaw, len, pitch0, droop, scale) {
  const g = new T.Group(); g.position.copy(origin); g.rotation.y = yaw; parent.add(g);
  const fm = FERN_MATS[Math.floor(rnd() * FERN_MATS.length)]; const N = 8; let p = V3(0, 0, 0); let ang = pitch0;
  const seg = len / N; const sc = scale || 1;
  for (let i = 0; i < N; i++) {
    const t = i / N; ang += droop / N; const dir = V3(Math.cos(ang), -Math.sin(ang), 0).multiplyScalar(seg);
    const q = p.clone().add(dir); limb(g, p, q, 0.012 * sc, 0.009 * sc, fm, 3);
    const mid = p.clone().add(q).multiplyScalar(0.5); const pl = (0.2 * (1 - t * 0.7) + 0.03) * sc;
    [1, -1].forEach((sd) => { const pn = mesh(new T.BoxGeometry(0.045 * sc, 0.01, pl), fm, g, mid.x, mid.y, sd * pl * 0.5); pn.rotation.set(sd * 0.32, 0, -ang); });
    p = q;
  }
  return g;
}
function hangingFerns(parent, origin, n, len) {
  const cl = dyn(new T.Group()); cl.position.copy(origin); parent.add(cl);
  for (let i = 0; i < n; i++) frond(cl, V3(rr(-0.12, 0.12), rr(-0.03, 0.03), rr(-0.08, 0.08)), rr(-0.9, 0.9) + Math.PI / 2, len * rr(0.6, 1.1), rr(0.1, 0.7), rr(0.9, 1.6));
  mergeUnder(cl, { skipDyn: false, always: true }); cl.children.forEach((c) => { c.castShadow = false; });
  R.ferns.push({ o: cl, ph: rr(0, 6), amp: rr(0.05, 0.1) * Math.min(1.4, len + 0.3) });
  return cl;
}
function shinobu(parent, x, y, z) {
  const g = dyn(new T.Group()); g.position.set(x, y, z); parent.add(g);
  mesh(new T.CylinderGeometry(0.006, 0.006, 0.4, 3), M.rope, g, 0, 0.2, 0);
  const ball = mesh(new T.IcosahedronGeometry(0.17, 1), mat(0x4d6538), g, 0, -0.05, 0);
  const fr = new T.Group(); g.add(fr);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; frond(fr, V3(Math.cos(a) * 0.12, -0.05 + rr(-0.05, 0.08), Math.sin(a) * 0.12), -a, rr(0.35, 0.6), rr(-0.4, 0.3), rr(1.0, 1.8), 0.8); }
  mergeUnder(fr, { skipDyn: false, always: true });
  const bellG = new T.Group(); bellG.position.set(0, -0.2, 0); g.add(bellG);
  mesh(new T.CylinderGeometry(0.004, 0.004, 0.35, 3), M.rope, bellG, 0, -0.18, 0);
  mesh(new T.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xcfe3e6, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, side: T.DoubleSide }), bellG, 0, -0.32, 0);
  const tzG = new T.Group(); tzG.position.set(0, -0.34, 0); bellG.add(tzG);
  mesh(new T.CylinderGeometry(0.003, 0.003, 0.16, 3), M.rope, tzG, 0, -0.08, 0);
  const tz = mesh(new T.PlaneGeometry(0.05, 0.24), new T.MeshStandardMaterial({ color: 0xe6dcc6, side: T.DoubleSide }), tzG, 0, -0.28, 0); tz.rotation.y = 0.5;
  R.chimes.push({ g, bell: bellG, tz: tzG, ph: rr(0, 6) });
  return g;
}

// ---------- ground helpers ----------
function wallAlongU(u0, u1, v, y0, y1) {
  const hh = y1 - y0;
  for (let u = u0; u < u1;) {
    const sx = rr(0.55, 1.2);
    let y = y0;
    while (y < y1 - 0.05) {
      const sy = Math.min(y1 - y, rr(0.38, 0.75));
      const g = new T.Group(); const m = rnd() < 0.4 ? M.stoneMoss : (rnd() < 0.6 ? M.stone : M.stoneDark);
      const b = mesh(new T.DodecahedronGeometry(0.5, 0), m, g, 0, 0, 0); b.scale.set(sx * 1.05, sy * 1.15, 0.7); b.rotation.set(rr(-0.1, 0.1), rr(-0.15, 0.15), rr(-0.08, 0.08));
      g.position.copy(W(u + sx / 2, v + rr(-0.06, 0.06), y + sy / 2)); g.rotation.y = Math.PI / 4; scene.add(g); shadowy(g);
      mossify([b], { thr: 0.25, scale: 1.3, bias: 0.05 });
      y += sy;
    }
    if (rnd() < 0.3) vine(W(u + sx / 2, v - 0.4, y1), rr(0.6, hh * 0.9));
    u += sx;
  }
}
function boardwalk(pts, y, w, heightAt) {
  const curve = new T.CatmullRomCurve3(pts.map((p) => V3(p[0], 0, p[1])));
  const len = curve.getLength(); const n = Math.floor(len / 0.34);
  for (let i = 0; i <= n; i++) {
    const t = i / n; const p = curve.getPointAt(t); const tg = curve.getTangentAt(t);
    const hh0 = Math.max(H(p.x, p.z) + (y || 0.45), (WATERLINE !== null ? WATERLINE + 0.45 : -99));
    const hh = heightAt ? heightAt(p.x, p.z) : BW_Y ? BW_Y(p.x, p.z, hh0) : hh0;
    const g = new T.Group(); mesh(new T.BoxGeometry(w || 1.3, 0.07, 0.28), rnd() < 0.2 ? M.plankGrey : M.plank, g, rr(-0.04, 0.04), 0, 0);
    g.position.copy(W(p.x, p.z, hh)); g.rotation.y = yawFor(tg.x, tg.z); scene.add(g); shadowy(g);
    if (i % 5 === 0) { [-1, 1].forEach((s) => { const off = V3(-tg.z, 0, tg.x).multiplyScalar(s * ((w || 1.3) / 2 - 0.08)); const q = W(p.x + off.x, p.z + off.z, 0); const gh = H(p.x + off.x, p.z + off.z); const post = mesh(new T.CylinderGeometry(0.06, 0.07, Math.max(0.3, hh - gh + 0.4), 5), M.woodDark, scene, q.x, (hh + gh) / 2 - 0.2, q.z); post.castShadow = true; }); }
    if (rnd() < 0.12) mossBlob(scene, W(p.x, p.z, hh + 0.03), 0.16);
  }
  return curve;
}
const windU = { value: 0 }, timeU = { value: 0 };
function grass(count, okFn) {
  const geo = new T.ConeGeometry(0.07, 0.42, 4); geo.translate(0, 0.21, 0);
  const m = new T.MeshStandardMaterial({ roughness: 1, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU; sh.uniforms.uWind = windU;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vec4 gw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n  float gk = max(position.y, 0.0) / 0.42;\n  float gs = sin(uTime * 1.6 + gw.x * 0.45 + gw.z * 0.3) * 0.6 + sin(uTime * 2.7 + gw.x * 1.1) * 0.25;\n  transformed.x += gs * gk * gk * 0.12 * uWind;\n  transformed.z += gs * gk * gk * 0.06 * uWind;');
  };
  const im = new T.InstancedMesh(geo, m, count);
  const d = new T.Object3D(); const c = new T.Color(); let k = 0;
  const pal = [0x6c8449, 0x7d9357, 0x5d7643, 0x8b9563, 0x74894e];
  for (let tries = 0; k < count && tries < count * 8; tries++) {
    const u = rr(-26, 26), v = rr(-20, 30);
    if (!okFn(u, v)) continue;
    const n = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < n && k < count; j++) {
      const uu = u + rr(-0.2, 0.2), vv = v + rr(-0.2, 0.2);
      d.position.copy(at(uu, vv, -0.02)); d.rotation.set(rr(-0.35, 0.35), rr(0, 6), rr(-0.35, 0.35)); d.scale.setScalar(rr(0.6, 1.3)); d.updateMatrix(); im.setMatrixAt(k, d.matrix); c.setHex(pal[Math.floor(rnd() * pal.length)]); im.setColorAt(k, c); k++;
    }
  }
  im.count = k; im.receiveShadow = true; scene.add(im);
}
function mossMounds(count, okFn) { for (let i = 0; i < count; i++) { const u = rr(-26, 26), v = rr(-20, 30); if (!okFn(u, v)) continue; const b = mossBlob(scene, at(u, v, 0.02), rr(0.35, 0.9), rnd() < 0.5 ? M.moss : M.mossDeep); b.scale.y = 0.3; } }
function mist(u, v, y, s, o) { const sp = new T.Sprite(new T.SpriteMaterial({ map: mistTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false })); sp.position.copy(W(u, v, y)); sp.scale.set(s, s * 0.45, 1); scene.add(sp); R.mists.push({ sp, base: o || 0.5, sc: s, ph: rr(0, 6), p0: sp.position.clone(), drift: rr(-0.25, 0.25) }); return sp; }
function mistLayers() {
  const mk = (seedv, lo, hi) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const img = x.createImageData(256, 256);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const u = i / 256 * 6, v = j / 256 * 6; const f = 0.6 * vnoise(u + seedv, v, seedv) + 0.28 * vnoise(u * 2.1, v * 2.1 + seedv, 1) + 0.12 * vnoise(u * 4.3, v * 4.3, seedv + 2); const a = lo + (hi - lo) * sstep(0.32, 0.72, f); const k = (j * 256 + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(a * 255); img.data[k + 3] = 255; }
    x.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.MirroredRepeatWrapping; t.repeat.set(4.5, 4.5); return t; };
  [[-8.5, 0.35, 0.78, 1], [-5.6, 0.12, 0.6, 2], [-3.2, 0.0, 0.5, 3], [-1.9, 0.0, 0.32, 4]].forEach(([y, lo, hi, ro], i) => {
    const m = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, alphaMap: mk(3.7 * (i + 1), lo, hi), depthWrite: false, opacity: 1 });
    const p = new T.Mesh(new T.PlaneGeometry(240, 240), m); p.rotation.x = -Math.PI / 2; p.rotation.z = i * 0.7; p.position.y = y; p.renderOrder = ro; scene.add(p);
    R.layers.push({ m, i, sp: [0.004 + 0.002 * i, 0.0015 * (i % 2 ? 1 : -1)] });
  });
}
// the last half unit before each lip bends down with the water, so the surface never ends in a cut edge over the drop
const brookDroop = (dEnd) => dEnd < 0.55 ? 0.95 * Math.pow(1 - dEnd / 0.55, 2) : 0;
function brookWater(BROOK, y, splitAt) {
  const curve = new T.CatmullRomCurve3(BROOK.map((p) => V3(p[0], 0, p[1])));
  const N = 140, pos = [], idx = [], widths = [], CL = curve.getLength();
  for (let i = 0; i <= N; i++) { const p = curve.getPointAt(i / N), tg = curve.getTangentAt(i / N); const dEnd = Math.min(i / N, 1 - i / N) * CL; const k = Math.min(1, dEnd / 1.6); const wdt = (1.3 + 0.3 * Math.sin(i * 0.37)) * (0.6 + 0.4 * k * k * (3 - 2 * k)); widths.push(wdt); const dr = brookDroop(dEnd); [-1, 1].forEach((sg) => { const q = W(p.x - tg.z * sg * wdt, p.z + tg.x * sg * wdt, y - dr); pos.push(q.x, q.y, q.z); }); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); wg.setIndex(idx); wg.computeVertexNormals();
  const wm = new T.Mesh(wg, M.water); wm.receiveShadow = true; wm.userData.noMerge = true; scene.add(wm);
  for (let i = 0; i < 30; i++) { const p = curve.getPointAt(rr(0.03, 0.97)); rockAt(W(p.x + rr(-1.4, 1.4), p.z + rr(-1.4, 1.4), y - 0.1), rr(0.2, 0.5), rnd() < 0.5); }
  const flow = brookFlow(curve, N, widths, y + 0.015, splitAt || BROOK[0]); curve.userData = { split: flow.split };
  return curve;
}
// ---------- moving water: brook flow layer, waterfall sheets, spray (shaders; clock = tAcc, frozen while paused) ----------
const NOISE_GLSL = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm2(vec2 p){ return 0.55 * vn(p) + 0.3 * vn(p * 2.03 + 7.1) + 0.15 * vn(p * 4.1 + 3.7); }`;
const WATERS = [];   // every live water material; partD feeds time, colours, rain and pixel scale
function waterUniforms(extra) { return T.UniformsUtils.merge([T.UniformsLib.fog, Object.assign({ uTime: { value: 0 }, uFoam: { value: new T.Color(0xf2f5f4) }, uDeep: { value: new T.Color(0x5d7b79) }, uRain: { value: 0 }, uOpacity: { value: 1 } }, extra || {})]); }

// flow layer over the brook: streaks and bank foam drifting outward from the pool, whitewater near both lips
function brookFlow(curve, N, widths, y, splitAt) {
  const pos = [], uv = [], dist = [], lip = [], idx = [];
  const P = []; for (let i = 0; i <= N; i++) P.push(curve.getPointAt(i / N));
  const L = [0]; for (let i = 1; i <= N; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  let si = 0, bd = 1e9; P.forEach((p, i) => { const d = Math.hypot(p.x - splitAt[0], p.z - splitAt[1]); if (d < bd) { bd = d; si = i; } });
  const Ltot = L[N];
  for (let i = 0; i <= N; i++) { const p = P[i], tg = curve.getTangentAt(i / N); const wdt = widths[i] * 0.97;
    const dr = brookDroop(Math.min(L[i], L[N] - L[i])); [-1, 1].forEach((sg, k) => { const q = W(p.x - tg.z * sg * wdt, p.z + tg.x * sg * wdt, y - dr); pos.push(q.x, q.y, q.z); uv.push(k, i / N); dist.push(Math.abs(L[i] - L[si])); lip.push(1 - Math.min(1, Math.min(L[i], Ltot - L[i]) / 2.6)); });
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('aDist', new T.Float32BufferAttribute(dist, 1)); g.setAttribute('aLip', new T.Float32BufferAttribute(lip, 1)); g.setIndex(idx);
  const m = new T.ShaderMaterial({ uniforms: waterUniforms(), transparent: true, depthWrite: false, fog: true,
    vertexShader: `attribute float aDist; attribute float aLip; varying vec2 vUv; varying float vDist; varying float vLip;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vDist = aDist; vLip = aLip; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uFoam; uniform float uRain; uniform float uOpacity; varying vec2 vUv; varying float vDist; varying float vLip;
      ${NOISE_GLSL}
      #include <fog_pars_fragment>
      void main(){
        float d = vDist, t = uTime;
        float across = abs(vUv.x - 0.5) * 2.0;
        // long thin streaks stretched along the current, thin foam lines hugging the banks
        float n1 = fbm2(vec2(vUv.x * 13.0 + 0.8 * sin(d * 0.5), d * 0.55 - t * 0.5));
        float n2 = fbm2(vec2(vUv.x * 26.0 + 3.0, d * 1.1 - t * 0.8));
        float streak = smoothstep(0.66, 0.86, n1 * 0.6 + n2 * 0.45);
        float bank = smoothstep(0.8, 1.0, across) * smoothstep(0.45, 0.8, n2);
        float fast = fbm2(vec2(vUv.x * 18.0, d * 2.2 - t * 2.0));
        float white = vLip * vLip * smoothstep(0.35, 0.75, fast + vLip * 0.25);
        float calm = smoothstep(0.6, 3.2, d);
        float a = (streak * 0.3 + bank * 0.3) * calm + white * 0.7;
        a *= 1.0 + 0.6 * uRain;
        vec3 col = uFoam * (0.9 + 0.1 * n2);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.85) * uOpacity);
        #include <fog_fragment>
      }` });
  const mesh = new T.Mesh(g, m); mesh.renderOrder = 1; mesh.userData.noMerge = true; mesh.frustumCulled = false; scene.add(mesh);
  WATERS.push(m); return { mesh, split: si / N };
}

// a waterfall: two translucent sheets following a real ballistic arc off the lip, plus spray particles
function waterfall(lipUV, flowUV, yTop, opt) {
  opt = opt || {};
  const drop = opt.drop || 8, v0 = opt.v0 || 2.1, g = 9.8, Tt = Math.sqrt(2 * drop / g), w0 = opt.width || 1.5;
  const lipW = W(lipUV[0], lipUV[1], yTop);
  const dir = W(flowUV[0], flowUV[1], 0).sub(W(0, 0, 0)); dir.y = 0; dir.normalize();
  const side = V3(dir.z, 0, -dir.x);
  const NS = 44, NW = 12, APP = 0.1, BACK = [0, 0.09];
  const centre = (s) => { if (s < APP) { const k = s / APP; return lipW.clone().addScaledVector(dir, -0.75 * (1 - k)); } const tau = (s - APP) / (1 - APP) * Tt; return lipW.clone().addScaledVector(dir, v0 * tau).add(V3(0, -0.5 * g * tau * tau, 0)); };
  let len = 0; { let prev = centre(0); for (let j = 1; j <= NS; j++) { const c = centre(j / NS); len += c.distanceTo(prev); prev = c; } }
  const sheets = [];
  BACK.forEach((back, layer) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NS; j++) { const s = j / NS, c = centre(s), wdt = w0 * (1 + 0.45 * s) * (layer ? 1.08 : 1);
      for (let i = 0; i <= NW; i++) { const x = i / NW; const p = c.clone().addScaledVector(side, (x - 0.5) * wdt).addScaledVector(dir, -back * Math.min(1, s * 4)); pos.push(p.x, p.y, p.z); uv.push(x, s); }
      if (j < NS) for (let i = 0; i < NW; i++) { const a = j * (NW + 1) + i, b = a + NW + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); } }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new T.ShaderMaterial({ uniforms: waterUniforms({ uLen: { value: len }, uSeed: { value: layer * 13.7 + (opt.seed || 0) }, uBack: { value: layer }, uSide: { value: side.clone() } }), transparent: true, depthWrite: false, side: T.DoubleSide, fog: true,
      vertexShader: `uniform float uTime; uniform vec3 uSide; uniform float uBack; varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vec3 p = position;
          float fall = smoothstep(0.1, 1.0, uv.y);
          p += uSide * sin(uv.y * 11.0 - uTime * 4.0 + uv.x * 3.0 + uBack * 2.0) * 0.05 * fall;
          p.y += sin(uv.x * 17.0 + uTime * 3.0) * 0.02 * fall;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; uniform vec3 uFoam; uniform vec3 uDeep; uniform float uLen; uniform float uSeed; uniform float uBack; uniform float uRain; uniform float uOpacity; varying vec2 vUv;
        ${NOISE_GLSL}
        #include <fog_pars_fragment>
        void main(){
          float s = vUv.y, x = vUv.x, t = uTime;
          float along = s * uLen;
          // water accelerates as it falls, so the pattern scrolls faster lower down
          float sc = along - t * (1.6 + 2.2 * s);
          float n1 = fbm2(vec2(x * 9.0 + uSeed, sc * 0.55));
          float n2 = fbm2(vec2(x * 23.0 + uSeed * 1.7, sc * 1.25 - t * 0.6));
          float n3 = fbm2(vec2(x * 4.0 + uSeed, along * 0.35 - t * 0.9));
          float aer = smoothstep(0.08, 0.45, s);                 // glassy over the lip, aerated below
          float streak = smoothstep(0.42, 0.78, n1 * 0.55 + n2 * 0.55);
          float lipGlint = exp(-pow((s - 0.1) / 0.035, 2.0));
          vec3 col = mix(uDeep, uFoam, clamp(0.18 + aer * 0.5 + streak * 0.5 + lipGlint * 0.5, 0.0, 1.0));
          col *= 0.92 + 0.12 * n3 - 0.12 * uBack;
          float ragged = 0.035 + 0.08 * n2 + 0.2 * aer;
          float edge = smoothstep(0.0, ragged, x) * smoothstep(1.0, 1.0 - ragged, x);
          float a = mix(0.62, 0.85, aer) * (0.75 + 0.35 * streak);
          // the curtain tears into strands and spray low down, then dissolves into the mist
          float tear = smoothstep(0.35, 1.0, s);
          a *= mix(1.0, smoothstep(0.28, 0.62, n1 + n3 * 0.35 + (1.0 - s) * 0.25), tear);
          a *= 1.0 - smoothstep(0.7, 0.98, s);
          a *= edge * (uBack > 0.5 ? 0.55 : 1.0) * (1.0 + 0.15 * uRain);
          gl_FragColor = vec4(col, clamp(a, 0.0, 0.95) * uOpacity);
          #include <fog_fragment>
        }` });
    const me = new T.Mesh(geo, m); me.renderOrder = 3 - layer; me.userData.noMerge = true; me.frustumCulled = false; scene.add(me); WATERS.push(m); sheets.push(me);
  });
  // spray: droplets riding the curtain, splashes where the water breaks over the lip stones, mist rising at the foot
  const n = opt.spray || 220; const seeds = new Float32Array(n * 4), pp = new Float32Array(n * 3);
  for (let i = 0; i < n * 4; i++) seeds[i] = Math.random();
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pp, 3)); pg.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));
  const pm = new T.ShaderMaterial({ uniforms: waterUniforms({ uLip: { value: lipW.clone() }, uDir: { value: dir.clone() }, uSideV: { value: side.clone() }, uV0: { value: v0 }, uG: { value: g }, uTt: { value: Tt }, uW0: { value: w0 }, uPx: { value: 20 } }), transparent: true, depthWrite: false, fog: true,
    vertexShader: `uniform float uTime; uniform vec3 uLip; uniform vec3 uDir; uniform vec3 uSideV; uniform float uV0; uniform float uG; uniform float uTt; uniform float uW0; uniform float uPx; uniform float uRain;
      attribute vec4 aSeed; varying float vA; varying float vSoft;
      #include <fog_pars_vertex>
      void main(){
        vec3 p; float size; float a;
        float r1 = aSeed.x, r2 = aSeed.y, kind = aSeed.z, r4 = aSeed.w;
        if (kind < 0.55) {            // droplets and foam clumps riding the falling sheet
          float tau = fract(uTime * (0.45 + 0.3 * r4) + r2) * uTt; float s = tau / uTt;
          p = uLip + uDir * (uV0 * tau + 0.06 + 0.35 * s * r4) + vec3(0.0, -0.5 * uG * tau * tau, 0.0) + uSideV * ((r1 - 0.5) * uW0 * (1.0 + 0.6 * s));
          size = mix(0.03, 0.075, r4 * r4) * (1.0 + 0.8 * s); a = sin(3.1416 * s) * 0.55; vSoft = 0.9;
        } else if (kind < 0.8) {      // splashes kicked up where the water breaks over the lip
          float life = 0.7 + 0.4 * r4; float k = fract(uTime / life + r2); float tt = k * life;
          p = uLip + uSideV * ((r1 - 0.5) * uW0 * 1.1) + uDir * (0.15 + 0.5 * tt * (0.5 + r4)) + vec3(0.0, 0.9 * tt * (0.6 + r4) - 2.6 * tt * tt, 0.0);
          size = mix(0.03, 0.07, r4); a = (1.0 - k) * 0.7; vSoft = 0.8;
        } else {                      // mist boiling up from the foot of the fall
          float life = 3.0 + 2.0 * r4; float k = fract(uTime / life + r2);
          vec3 foot = uLip + uDir * (uV0 * uTt * 0.9) + vec3(0.0, -0.5 * uG * uTt * uTt * 0.82, 0.0);
          p = foot + uSideV * ((r1 - 0.5) * uW0 * 2.4) + uDir * (0.9 * k * (r4 - 0.2)) + vec3(0.0, 1.6 * k, 0.0);
          size = mix(0.9, 2.2, r4) * (0.6 + k); a = sin(3.1416 * k) * 0.28; vSoft = 1.0;
        }
        vA = a * (1.0 + 0.4 * uRain);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(1.5, size * uPx);
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uFoam; uniform float uOpacity; varying float vA; varying float vSoft;
      #include <fog_pars_fragment>
      void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
        float a = vA * (1.0 - smoothstep(1.0 - vSoft, 1.0, r));
        gl_FragColor = vec4(uFoam, a * uOpacity);
        #include <fog_fragment>
      }` });
  const pts = new T.Points(pg, pm); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts); WATERS.push(pm);
  return { sheets, pts, lip: lipW, dir, side, Tt, v0 };
}



// =====================================================================
// 苔痕驛站：霧海上方山肩的單線小站
// =====================================================================
const TRK = [[-32, 0.9], [-20, 0.95], [-8, 1.0], [4, 1.0], [7.5, 1.7], [10.3, 3.6], [12.4, 6.1], [14.5, 9.2], [17, 13]];
const PORTAL = [12.9, 6.7];
const BROOK = [[16.5, -4.3], [16.05, -3.25], [15.4, -2.2], [12.5, -3.9], [10, -5.0], [2, -6.2], [-6, -5.4], [-9.8, -7.0], [-11.2, -9.2], [-11.6, -10.5]];
const PIER = [[14.75, -0.95], [15.55, -2.25]], PIER_Y = -0.08;
const EAST_LIP = [16.62, -4.55], EAST_FLOW = [0.42, -1];
const SIDING = [[2.2, 1.0], [5.2, 0.35], [8.2, -0.9], [11.2, -2.2]];
const BW = [[-27, -16.5], [-22.5, -12.4], [-17.8, -9.0], [-14.6, -5.8], [-13.2, -2.6], [-12.4, -0.6]];
const LOG = [[1.4, -3.9], [3.9, -5.9], [6.4, -7.7]];
const STONES = [[-8.45, -5.35], [-8.6, -6.1], [-8.5, -6.85], [-8.8, -7.55], [-8.3, -4.75], [-8.9, -8.15]];
const LODGE_STONES = []; for (let i = 0; i < 7; i++) LODGE_STONES.push([-9.6 - i * 0.18, 8.6 + i * 0.55]);
const PU0 = -10.4, PU1 = 6.6, PV0 = 1.9;
const RIM = (u, v) => { const a = (u + 1.5) / 18.4, b = (v - 2.2) / (v > 2.2 ? 14.2 : 13.4); return Math.pow(Math.abs(a), 3.2) + Math.pow(Math.abs(b), 3.2) + 0.22 * (vnoise(u * 0.33 + 2, v * 0.33, 4) - 0.5); };
const trkD = (u, v) => Math.min(polyD(u, v, TRK), polyD(u, v, SIDING) + 0.15);
const HILL = (u, v) => Math.max(0, v - 10.5) * 0.22 + Math.max(0, 9.5 - Math.hypot(u - 16.2, (v - 10.2) * 0.85) * 1.05) * (1 + 0.15 * nz(u, v));
H = (u, v) => {
  let h = 0.32 * nz(u, v) + 0.1 * nz(u * 2.3, v * 2.1);
  h += HILL(u, v);
  const td = trkD(u, v); const k = 1 - sstep(1.2, 2.3, td);
  if (u < PORTAL[0] - 0.2) h = h * (1 - k) + 0.22 * k;
  let plat = sstep(PV0 - 0.12, PV0 + 0.05, v) * sstep(-13.8, -10.6, u) * (1 - sstep(8.2, 10.8, u)) * (1 - sstep(10, 12.5, v));
  plat *= 1 - (1 - sstep(1.1, 1.9, td)) * sstep(7.0, 7.6, u);
  h = h * (1 - plat) + (1.0 + (v > 8 ? 0.2 * nz(u, v) : 0)) * plat;
  const bd = polyD(u, v, BROOK); h -= 0.9 * (1 - sstep(0.7, 2.3, bd));
  const keep = sstep(1.2, 3.0, HILL(u, v) - Math.max(0, v - 10.5) * 0.22) * (u > 6 ? 1 : 0);
  const dropK = sstep(1.0, 1.2, RIM(u, v)) * (1 - keep);
  if (dropK > 0) { const VAL = -12.5 + 13.2 * Math.pow(fbm(u * 0.075 + 3.1, v * 0.075 + 0.4, 5.5), 1.35) * 1.35 + 1.2 * nz(u * 0.4, v * 0.4); h = h * (1 - dropK) + Math.min(VAL, h - 1.5 * dropK) * dropK; }
  return h;
};
WATERLINE = -0.5;
PATHS = [{ pts: [[-9.6, 8.6], [-9.8, 10.6], [-10.6, 12.2]], w: 0.8 }, { pts: [[-8, 7.9], [-9.6, 8.6]], w: 0.8 }, { pts: [[-10.4, 3.2], [-10.0, 4.8], [-9.7, 6.3], [-8.6, 8.9]], w: 0.7 }];
SEGS = segs();
BW_Y = (u, v, y0) => { const r = RIM(u, v); return r > 0.95 ? Math.min(y0, 0.2 - (r - 0.95) * 9) : y0; };
// walkable surface height (terrain, boardwalk, trestle, sleepers, log, stones)
// Keep the entry boards and walkable surface on the same gradual climb.
const BW_PROF = (() => { const c = new T.CatmullRomCurve3(BW.map((p) => V3(p[0], 0, p[1]))); const n = 240, pts = c.getSpacedPoints(n), L = c.getLength() / n;
  const raw = pts.map((p) => BW_Y(p.x, p.z, Math.max(H(p.x, p.z) + 0.5, WATERLINE + 0.45))); const h = raw.slice();
  for (let i = n - 1; i >= 0; i--) h[i] = Math.max(raw[i], h[i + 1] - 0.7 * L);
  return { pts, h }; })();
const bwProfile = (u, v) => { let best = 0, bd = 1e9; for (let i = 0; i < BW_PROF.pts.length; i++) { const p = BW_PROF.pts[i]; const d = (p.x - u) * (p.x - u) + (p.z - v) * (p.z - v); if (d < bd) { bd = d; best = i; } } return BW_PROF.h[best]; };
const bwHeight = (u, v) => bwProfile(u, v) + 0.04;
function logTop(u, v) { let best = null; for (let i = 0; i < LOG.length - 1; i++) { const d = segDist(u, v, LOG[i], LOG[i + 1]); if (d < 0.5) { const t = segT(u, v, LOG[i], LOG[i + 1]); const g = (i + t) / (LOG.length - 1); const y = (1 - g) * (1 - g) * (H(1.4, -3.9) + 0.35) + 2 * g * (1 - g) * (-0.05 - 0.05) + g * g * (H(6.4, -7.7) + 0.35); best = Math.max(best === null ? -99 : best, y + 0.34); } } return best; }
function walkY(u, v) {
  let y = H(u, v);
  if (polyD(u, v, BW) < 0.72) y = Math.max(y, bwHeight(u, v));
  if (polyD(u, v, TRK) < 0.95 && u < PORTAL[0] + 0.5) y = Math.max(y, (RIM(u, v) > 0.98 ? 0.22 : H(u, v)) + 0.12);
  if (polyD(u, v, SIDING) < 0.9) y = Math.max(y, H(u, v) + 0.12);
  const lt = logTop(u, v); if (lt !== null) y = Math.max(y, lt);
  STONES.forEach(([a, b]) => { if (Math.hypot(u - a, v - b) < 0.5) y = Math.max(y, Math.max(H(a, b), WATERLINE) + 0.16); });
  LODGE_STONES.forEach(([a, b]) => { if (Math.hypot(u - a, v - b) < 0.55) y = Math.max(y, H(a, b) + 0.1); });
  if (polyD(u, v, PIER) < 0.46) y = Math.max(y, PIER_Y + 0.04);
  return y;
}
const groundAt = (p) => { const [u, v] = toUV(p.x, p.z); return walkY(u, v); };

const cGravel = new T.Color(0x8b877d), cSlab = new T.Color(0xa29b8d), cSlab2 = new T.Color(0x958e80);
buildTerrain(-32, 34, -26, 36, 0.45, (u, v, h, ny, out) => {
  defaultColor(u, v, h, ny, out);
  const bd = polyD(u, v, BROOK); if (bd < 1.7) out.lerp(cEarth, sstep(1.7, 0.9, bd));
  const td = trkD(u, v); if (td < 1.35 && u < PORTAL[0]) out.copy(cGravel).lerp(cMossDeep, 0.25 + 0.3 * (0.5 + 0.5 * nz(u * 3, v * 3))).lerp(cGravel, 0.3);
  if (v > PV0 && v < 4.4 && u > PU0 && u < PU1 && ny > 0.9) { out.copy(((Math.floor(u / 0.9) + Math.floor(v / 0.9)) % 2) ? cSlab : cSlab2); const m = 0.5 + 0.5 * nz(u * 1.7, v * 2.2); if (m > 0.6) out.lerp(cMoss, (m - 0.6) * 1.6); }
});
const brookCurve = brookWater(BROOK, WATERLINE, [15.75, -2.75]);

// ---- sea of mist, drowned valley, distant ridges ----
mistLayers();
for (let i = 0; i < 420; i++) { const u = rr(-34, 36), v = rr(-28, 36); if (RIM(u, v) < 1.3) continue; const hh = H(u, v); if (hh < -10.5 || hh > -2.2) continue; const top = rnd() < 0.12 ? rr(-1.8, -0.6) : rr(-6.5, -2.6); const sc = (top - hh) / 6; if (sc < 0.35) continue; cedar(u, v, Math.min(sc, 1.6)); }
for (let i = 0; i < 40; i++) { const a = rr(0, Math.PI * 2); const cu = -1.5 + Math.cos(a) * 18.4 * 1.05, cv = 2.2 + Math.sin(a) * 14 * 1.05; mist(cu + rr(-2, 2), cv + rr(-2, 2), rr(-2.4, -0.8), rr(5, 10), 0.5); }
for (let i = 0; i < 70; i++) { const u = rr(-36, 36), v = rr(-30, 34); if (RIM(u, v) < 1.15) continue; mist(u, v, rr(-2.6, -0.6), rr(6, 12), 0.45); }
[[20, 0x2c3a35, 9, 1.3], [25, 0x3a4944, 11, 1.0], [31, 0x4a5954, 13, 0.8]].forEach(([vv, c, hmax, fq], li) => {
  const shp = new T.Shape(); const X0 = -70, X1 = 70; shp.moveTo(X0, -8); for (let x = X0; x <= X1; x += 1.6) { const f = fbm(x * 0.05 * fq + li * 7, li * 1.3, 3); const ridge = Math.pow(1 - Math.abs(2 * f - 1), 1.8); shp.lineTo(x, -3 + hmax * (0.15 + 0.85 * ridge) + 1.2 * (vnoise(x * 0.4, li, 9) - 0.5)); } shp.lineTo(X1, -8); shp.lineTo(X0, -8);
  const m = new T.MeshBasicMaterial({ color: c }); const rg = new T.Mesh(new T.ShapeGeometry(shp), m);
  rg.position.copy(W(0, vv, 0)); rg.rotation.y = Math.PI / 4; scene.add(rg); R.ridges.push({ m, c: new T.Color(c), k: 0.35 + li * 0.18 });
});
// waterfall where the brook leaves the ledge
const fallTex = canvasTex(64, 256, (x) => { for (let i = 0; i < 26; i++) { const px = 4 + Math.random() * 56, w = 1 + Math.random() * 3; const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0.05)'); x.fillStyle = g; x.fillRect(px, 0, w, 256); } });
fallTex.wrapS = fallTex.wrapT = T.RepeatWrapping;
{ const ru = -11.62, rv = -10.55; const fm = new T.MeshBasicMaterial({ map: fallTex, color: 0xeef4f4, transparent: true, depthWrite: false, side: T.DoubleSide });
  const n = BROOK.length; R.falls = [waterfall([ru, rv], [BROOK[n - 1][0] - BROOK[n - 2][0], BROOK[n - 1][1] - BROOK[n - 2][1]], WATERLINE + 0.01, { drop: 8, v0: 1.9, width: 1.75, seed: 3.1 })];
  for (let i = 0; i < 7; i++) mist(ru + rr(-1.5, 1.5), rv - rr(0.5, 2.5), rr(-2.2, -0.6), rr(3, 6), 0.65); }

// ---- east end: the pool spills over the rim; a pier and a moored boat (exit: 霧瀑小舟) ----
const BOAT = {};
{ const [lu, lv] = EAST_LIP; const fl = Math.hypot(EAST_FLOW[0], EAST_FLOW[1]); const du = EAST_FLOW[0] / fl, dv = EAST_FLOW[1] / fl;
  const wd = W(du, dv, 0).sub(W(0, 0, 0)); const ry = Math.atan2(wd.x, wd.z);
  const fm = new T.MeshBasicMaterial({ map: fallTex.clone(), color: 0xeef4f4, transparent: true, depthWrite: false, side: T.DoubleSide }); fm.map.needsUpdate = true; R.waterfalls.push(fm);   // spout trickle only
  R.falls.push(waterfall([lu, lv], EAST_FLOW, WATERLINE + 0.01, { drop: 8.5, v0: 2.2, width: 1.65, seed: 7.7 }));
  for (let i = 0; i < 6; i++) mist(lu + du * rr(1, 2.5) + rr(-1, 1), lv + dv * rr(1, 2.5) + rr(-1, 1), rr(-6.5, -3.5), rr(3, 6), 0.7);
  mist(lu + du * 0.9, lv + dv * 0.9, rr(-1.6, -1.0), 2.2, 0.45);
  for (let i = 0; i < 4; i++) rockAt(W(lu + rr(-0.9, 0.9) - dv * (i % 2 ? 0.9 : -0.9), lv + rr(-0.4, 0.4) + du * (i % 2 ? 0.9 : -0.9), WATERLINE - 0.05), rr(0.25, 0.45), true);
  // pier
  const [a, b] = PIER; const pu = b[0] - a[0], pv = b[1] - a[1], pl = Math.hypot(pu, pv), n = Math.round(pl / 0.26);
  const pierG = new T.Group(); scene.add(pierG);
  for (let i = 0; i <= n; i++) { const t = i / n; const pk = mesh(new T.BoxGeometry(0.95, 0.07, 0.22), i % 3 === 1 ? M.plankGrey : M.plank, pierG); pk.position.copy(W(a[0] + pu * t, a[1] + pv * t, PIER_Y)); pk.rotation.y = yawFor(pu, pv) + rr(-0.04, 0.04); }
  [[0, -1], [0, 1], [1, -1], [1, 1], [0.5, -1], [0.5, 1]].forEach(([t, sd]) => { const pu2 = -pv / pl * 0.44 * sd, pv2 = pu / pl * 0.44 * sd; const post = mesh(new T.CylinderGeometry(0.06, 0.07, 1.5 + (t === 1 ? 0.35 : 0), 6), M.woodDark, pierG); post.position.copy(W(a[0] + pu * t + pu2, a[1] + pv * t + pv2, PIER_Y - 0.62 + (t === 1 ? 0.17 : 0))); });
  const bollard = mesh(new T.CylinderGeometry(0.08, 0.09, 0.42, 6), M.woodDark, pierG); bollard.position.copy(W(b[0] - pu / pl * 0.15 + pv / pl * 0.4, b[1] - pv / pl * 0.15 - pu / pl * 0.4, PIER_Y + 0.2));
  shadowy(pierG); mossify(pierG.children, { thr: 0.55, bias: -0.15, scale: 2.5 });
  // boat: a flat-bottomed punt with a lantern pole, moored beside the pier, bow toward the lip
  const g = new T.Group(); g.userData.dyn = true; const hull = mat(0x6b5440), hull2 = mat(0x5a4636), boatMats = [hull, hull2, M.plank, M.rope];
  mesh(new T.BoxGeometry(0.66, 0.07, 1.55), hull2, g, 0, 0.04, 0);
  [-1, 1].forEach((sd) => { const side = mesh(new T.BoxGeometry(0.06, 0.22, 1.55), hull, g, sd * 0.33, 0.15, 0); side.rotation.z = sd * 0.12; });
  [-1, 1].forEach((sd) => { const end = mesh(new T.BoxGeometry(0.66, 0.22, 0.06), hull, g, 0, 0.17, sd * 0.8); end.rotation.x = -sd * 0.45; });
  mesh(new T.BoxGeometry(0.62, 0.05, 0.26), M.plank, g, 0, 0.2, -0.12);
  const coil = mesh(new T.TorusGeometry(0.1, 0.03, 4, 10), M.rope, g, 0.12, 0.1, 0.5); coil.rotation.x = Math.PI / 2;
  const pole = mesh(new T.CylinderGeometry(0.025, 0.03, 1.1, 5), M.woodDark, g, -0.22, 0.6, -0.68); pole.rotation.x = -0.15;
  mesh(new T.BoxGeometry(0.03, 0.03, 0.3), M.woodDark, g, -0.22, 1.12, -0.6);
  const glowM = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.2, roughness: 1 }); glowM.userData.glow = true;
  mesh(new T.BoxGeometry(0.13, 0.17, 0.13), glowM, g, -0.22, 0.98, -0.47);
  const light = new T.PointLight(0xffb05a, 0.3, 2.4, 2); light.position.set(-0.22, 0.95, -0.47); scene.add(light);
  const home = W(15.98, -1.92, WATERLINE + 0.02); g.position.copy(home);
  const bw = W(pu, pv, 0).sub(W(0, 0, 0)); const homeYaw = Math.atan2(bw.x, bw.z); g.rotation.y = homeYaw;
  scene.add(g); shadowy(g);
  const mats = []; g.traverse((c) => { if (c.isMesh && c.material !== glowM) { c.material = c.material.clone(); mats.push(c.material); } });
  Object.assign(BOAT, { g, home: home.clone(), homeYaw, light, glowM, mats, seat: V3(0, 0.22, -0.12) });
  // the spring: water wells out of a mossy rock and runs down a bamboo spout into the pool
  const sp = W(14.05, -1.1, H(14.05, -1.1)); rockAt(sp, 0.55, true); rockAt(W(14.45, -0.75, H(14.45, -0.75)), 0.35, true);
  const tubeG = new T.Group(); const tube = mesh(new T.CylinderGeometry(0.05, 0.05, 0.9, 6), mat(0x8a9a5a), tubeG, 0, 0, 0); tube.rotation.z = Math.PI / 2 - 0.25;
  tubeG.position.copy(W(14.3, -1.45, H(14.05, -1.1) + 0.45)); tubeG.rotation.y = yawFor(0.35, -0.5) - Math.PI / 2; scene.add(tubeG); shadowy(tubeG);
  const trickle = mesh(new T.PlaneGeometry(0.07, 0.6), fm, scene); trickle.position.copy(W(14.55, -1.8, WATERLINE + 0.3)); trickle.rotation.y = ry;
}

// ---- platform stone face ----
wallAlongU(PU0, PU1 + 0.6, PV0 - 0.05, 0.12, 1.0);

// ---- the single track, the trestle, the crossing ----
const rail = mat(0x6f5444, { roughness: 0.6, metalness: 0.3 }); const sleeperM = mat(0x4a3d33);
function layTrack(pts, stopU, startI) {
  const tc = new T.CatmullRomCurve3(pts.map((p) => V3(p[0], 0, p[1])));
  const n = Math.floor(tc.getLength() / 0.62); let pL = null, pR = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n; const p = tc.getPointAt(t); if (stopU !== undefined && p.x > stopU) break; const tg = tc.getTangentAt(t);
    const y = (RIM(p.x, p.z) > 0.98 ? 0.22 : H(p.x, p.z)) + 0.02; const nu = -tg.z, nv = tg.x;
    const L = W(p.x + nu * 0.55, p.z + nv * 0.55, y + 0.16), Rr = W(p.x - nu * 0.55, p.z - nv * 0.55, y + 0.16);
    if (i >= (startI || 0)) {
      const sl = new T.Group(); mesh(new T.BoxGeometry(2.0, 0.1, 0.26), sleeperM, sl, 0, 0.05, 0); sl.position.copy(W(p.x, p.z, y)); sl.rotation.y = yawFor(tg.x, tg.z); scene.add(sl); sl.children[0].receiveShadow = true;
      if (pL) [[pL, L], [pR, Rr]].forEach(([a, b]) => { const d = b.clone().sub(a); const r = new T.Mesh(new T.BoxGeometry(0.08, 0.1, d.length() + 0.02), rail); r.position.copy(a).add(b).multiplyScalar(0.5); r.lookAt(b); scene.add(r); r.castShadow = true; });
    }
    pL = L; pR = Rr;
  }
  return tc;
}
layTrack(TRK, PORTAL[0] - 0.1);
layTrack(SIDING, undefined, 4);
for (let u = -19.2; u > -34; u -= 2.1) { const v = 0.9 + (u + 20) * 0.004; const g = new T.Group(); [-0.95, 0.95].forEach((x) => { mesh(new T.BoxGeometry(0.22, 12, 0.22), M.woodDark, g, x, -6, 0); }); mesh(new T.BoxGeometry(2.4, 0.2, 0.3), M.wood, g, 0, -0.05, 0); for (let k = 0; k < 3; k++) { const br = mesh(new T.BoxGeometry(0.1, 3.2, 0.1), M.woodDark, g, 0, -1.8 - k * 3, 0.05); br.rotation.z = k % 2 ? 1.0 : -1.0; } mesh(new T.BoxGeometry(2.0, 0.12, 0.12), M.woodDark, g, 0, -3.3, 0.05); g.position.copy(W(u, v, 0.15)); g.rotation.y = yawFor(1, 0); scene.add(g); shadowy(g); mossify(g.children, { thr: 0.3, bias: 0.05, scale: 1.4 }); }
[-0.85, 0.85].forEach((o) => { const a = W(-19.2, 0.9 + o, 0.1), b = W(-34, 0.9 + o, 0.1); const d = b.clone().sub(a); const st = new T.Mesh(new T.BoxGeometry(0.2, 0.22, d.length()), M.wood); st.position.copy(a).add(b).multiplyScalar(0.5); st.lookAt(b); scene.add(st); });
for (let i = 0; i < 6; i++) { const g = new T.Group(); mesh(new T.BoxGeometry(1.6, 0.08, 0.24), M.plankGrey, g); g.position.copy(W(-12.2 + (i - 2.5) * 0.28, 0.95, 0.42)); g.rotation.y = yawFor(0, 1); scene.add(g); shadowy(g); }
const bs = new T.Group(); [-0.6, 0.6].forEach((x) => mesh(new T.BoxGeometry(0.2, 0.7, 0.2), M.woodDark, bs, x, 0.35, 0)); mesh(new T.BoxGeometry(1.6, 0.25, 0.25), mat(0x6e4a3e), bs, 0, 0.62, 0.05); bs.position.copy(at(11.3, -2.3, 0.1)); bs.rotation.y = yawFor(-3, 1.3); scene.add(bs); shadowy(bs); mossify(bs.children, { thr: 0.2, bias: 0.1, scale: 2 });

// ---- tunnel portal ----
const tunnel = new T.Group(); { const tp = tunnel; const sm = [M.stone, M.stoneMoss, M.stoneDark];
  [-1, 1].forEach((sx) => { for (let r = 0; r < 4; r++) mesh(new T.BoxGeometry(0.95, 0.62, 0.9), sm[(r + (sx > 0 ? 1 : 0)) % 3], tp, sx * 1.75, 0.31 + r * 0.64, 0); });
  for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; const b = mesh(new T.BoxGeometry(0.5, 0.62, 0.95), sm[i % 3], tp, Math.cos(a) * 1.6, 2.55 + Math.sin(a) * 1.55, 0); b.rotation.z = a - Math.PI / 2; }
  mesh(new T.BoxGeometry(5.0, 0.9, 1.0), M.stoneDark, tp, 0, 4.55, -0.05);
  mesh(new T.BoxGeometry(4.2, 1.2, 0.95), M.stone, tp, 0, 3.75, -0.02);
  const voidM = new T.MeshBasicMaterial({ color: 0x0b0d0c, side: T.BackSide });
  mesh(new T.BoxGeometry(3.05, 2.6, 4), voidM, tp, 0, 1.3, -2.1); mesh(new T.CylinderGeometry(1.52, 1.52, 4, 16, 1, false, 0, Math.PI), voidM, tp, 0, 2.55, -2.1).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  tp.position.copy(W(PORTAL[0], PORTAL[1], 0.22)); tp.rotation.y = yawFor(-2.1, -2.5); scene.add(tp); shadowy(tp); tp.updateMatrixWorld(true); mossify(tp.children, { thr: 0.2, bias: 0.12, scale: 1.2 });
  for (let i = 0; i < 5; i++) fern(0, 0, rr(0.6, 0.9)).position.copy(tp.localToWorld(V3(rr(-2.2, 2.2), 5.0, rr(-0.2, 0.3))));
  hangingFerns(tp, V3(0, 4.1, 0.55), 5, 0.7); hangingFerns(tp, V3(-1.3, 4.1, 0.55), 3, 0.5);
  for (let i = 0; i < 8; i++) vine(tp.localToWorld(V3(rr(-2.2, 2.2), 4.9, 0.55)), rr(0.8, 2.6)); }

// ---- station building (7 bays, unpainted timber, iron-sheet roof) ----
const ST = {};
const st = new T.Group(); { const w = 9.8, d = 3.3, h = 2.35, fl = 0.12;
  const woodOld = mat(0x8c7a64), woodOld2 = mat(0x7f6e5a), woodBase = mat(0x62513f);
  mesh(new T.BoxGeometry(w + 0.2, fl * 2, d + 0.2), M.stoneDark, st, 0, fl / 2, 0);
  const wall = (ww, x, z, ry) => { const f = new T.Group(); f.position.set(x, fl, z); f.rotation.y = ry || 0; st.add(f); mesh(new T.BoxGeometry(ww, 0.8, 0.14), woodBase, f, 0, 0.4, 0); const n = 6; for (let i = 0; i < n; i++) mesh(new T.BoxGeometry(ww, (h - 0.8) / n - 0.02, 0.12), i % 2 ? woodOld : woodOld2, f, 0, 0.8 + (i + 0.5) * (h - 0.8) / n, (i % 2) * 0.012); return f; };
  wall(w, 0, -d / 2); wall(d, -w / 2, 0, Math.PI / 2); wall(d, w / 2, 0, Math.PI / 2);
  const bay = w / 7; const fx = (i) => -w / 2 + bay * (i + 0.5);
  [0, 2].forEach((i) => wall(bay, fx(i), d / 2));
  mesh(new T.BoxGeometry(bay, 0.55, 0.14), woodOld, st, fx(1), fl + h - 0.27, d / 2);
  mesh(new T.PlaneGeometry(bay - 0.1, h - 0.55), glowWin, st, fx(1), fl + (h - 0.55) / 2, d / 2 - 0.3);
  for (let i = 3; i < 7; i++) wall(bay, fx(i), d / 2);
  latticeWindow(st, fx(0), fl + 1.45, d / 2 + 0.08, 0.95, 0.75); latticeWindow(st, fx(2), fl + 1.45, d / 2 + 0.08, 0.95, 0.75);
  latticeWindow(st, fx(4), fl + 1.45, d / 2 + 0.08, 0.95, 0.75); latticeWindow(st, fx(6), fl + 1.45, d / 2 + 0.08, 0.95, 0.75);
  // ticket window with counter, ledger and the lost-property drawer
  mesh(new T.PlaneGeometry(0.8, 0.5), glowWin, st, fx(3), fl + 1.2, d / 2 + 0.085); mesh(new T.BoxGeometry(1.0, 0.07, 0.35), M.plank, st, fx(3), fl + 0.95, d / 2 + 0.2);
  const ledger = dyn(new T.Group()); ledger.position.set(fx(3) - 0.2, fl + 0.99, d / 2 + 0.22); ledger.rotation.y = 0.15; st.add(ledger);
  mesh(new T.BoxGeometry(0.36, 0.035, 0.26), M.paper, ledger, 0, 0, 0);
  const ledgerCover = new T.Group(); ledgerCover.position.set(-0.18, 0.02, 0); ledger.add(ledgerCover); mesh(new T.BoxGeometry(0.36, 0.015, 0.27), mat(0x5b4636), ledgerCover, 0.18, 0, 0);
  const slip = mesh(new T.PlaneGeometry(0.22, 0.28), new T.MeshStandardMaterial({ color: 0xd9d0bc, side: T.DoubleSide }), ledger, 0.05, 0.03, 0); slip.rotation.x = -Math.PI / 2; slip.visible = false;
  const drawer = dyn(new T.Group()); drawer.position.set(fx(3), fl + 0.62, d / 2 + 0.02); st.add(drawer);
  mesh(new T.BoxGeometry(0.62, 0.2, 0.42), M.woodDark, drawer, 0, 0, -0.14); mesh(new T.BoxGeometry(0.66, 0.24, 0.04), mat(0x6a5646), drawer, 0, 0, 0.08); mesh(new T.SphereGeometry(0.025, 6, 5), M.brass, drawer, 0, 0, 0.11);
  mesh(new T.BoxGeometry(0.72, 0.3, 0.06), M.woodDark, st, fx(3), fl + 0.62, d / 2 + 0.005);
  const tagLbl = mesh(new T.PlaneGeometry(0.2, 0.08), new T.MeshStandardMaterial({ color: 0xe6dcc6, side: T.DoubleSide }), st, fx(3), fl + 0.8, d / 2 + 0.05);
  for (let i = 0; i <= 7; i++) mesh(new T.BoxGeometry(0.15, h, 0.16), M.woodDark, st, -w / 2 + bay * i, fl + h / 2, d / 2 + 0.02);
  for (let i = 0; i <= 7; i++) mesh(new T.BoxGeometry(0.15, h, 0.16), M.woodDark, st, -w / 2 + bay * i, fl + h / 2, -d / 2 - 0.02);
  interiorLight(st, fx(1), fl + 1.9, d / 2 - 0.9, 0.9, 4.2); interiorLight(st, fx(3), fl + 1.4, d / 2 + 0.6, 0.55, 3);
  bench(st, fx(1), -d / 2 + 0.4, 0, bay * 2.4);
  [-0.55, 0.55].forEach((x) => { mesh(new T.BoxGeometry(0.1, 0.9, 0.5), M.woodDark, st, fx(1) + x, fl + 0.45, d / 2 + 0.55); });
  // umbrella stand by the waiting-room door (a wagasa someone left) and the towel peg
  const stand = new T.Group(); stand.position.set(fx(1) + 0.85, fl, d / 2 + 0.35); st.add(stand);
  mesh(new T.CylinderGeometry(0.13, 0.12, 0.5, 8, 1, true), mat(0x4e5f56, { side: T.DoubleSide }), stand, 0, 0.25, 0);
  const standUmb = dyn(new T.Group()); stand.add(standUmb); { const c = mesh(new T.CylinderGeometry(0.07, 0.04, 0.85, 8), mat(0x4b5a6e), standUmb, 0, 0.72, 0); mesh(new T.CylinderGeometry(0.012, 0.012, 1.0, 4), M.wood, standUmb, 0, 0.62, 0); mesh(new T.SphereGeometry(0.02, 5, 4), M.woodDark, standUmb, 0, 1.15, 0); }
  const towel = dyn(new T.Group()); towel.position.set(fx(1) + 1.2, fl + 1.35, d / 2 + 0.12); st.add(towel); mesh(new T.BoxGeometry(0.05, 0.05, 0.08), M.woodDark, towel, 0, 0.04, 0); mesh(new T.PlaneGeometry(0.28, 0.42), new T.MeshStandardMaterial({ color: 0xdfd6c3, side: T.DoubleSide }), towel, 0, -0.2, 0.04); towel.visible = false;
  // iron-sheet roof and canopy with living moss
  sheetRoof(st, w + 0.2, d, fl + h, 0.42, { oh: 0.55, base: 0x6a7176, moss: 0.13 });
  const cz0 = d / 2 + 0.2, cz1 = d / 2 + 1.45; const ironDark = mat(0x5a6064);
  const cy = fl + h - 0.05; const can = sheet(w + 1.4, cz1 - cz0 + 0.5, { base: 0x5f666a, moss: 0.2, seed: 11 }); can.position.set(0, cy - 0.12, (cz0 + cz1) / 2); can.rotation.x = 0.14; st.add(can);
  const gut = (cz0 + cz1) / 2 + (cz1 - cz0 + 0.5) / 2;
  for (let x = -w / 2 - 0.5; x < w / 2 + 0.6; x += rr(0.5, 1.3)) { const f = can.userData.field(x, (cz1 - cz0 + 0.5) / 2 - 0.05); if ((f > 0.5 && rnd() < 0.5) || rnd() < 0.08) hangingFerns(st, V3(x, cy - 0.25, gut), 2 + Math.floor(rnd() * 5), rr(0.35, 0.95)); }
  mesh(new T.BoxGeometry(w + 1.4, 0.1, 0.12), ironDark, st, 0, cy - 0.26, gut);
  R.eaves.push([st, V3(-w / 2 - 0.7, cy - 0.3, gut + 0.05), V3(w / 2 + 0.7, cy - 0.3, gut + 0.05)]);
  shinobu(st, -w / 2 + bay * 0.9, cy - 0.32, cz1 - 0.25); shinobu(st, -w / 2 + bay * 4.9, cy - 0.32, cz1 - 0.25);
  for (let i = 0; i <= 5; i++) { const x = -w / 2 - 0.3 + i * (w + 0.6) / 5; mesh(new T.BoxGeometry(0.13, cy - 0.35, 0.13), M.woodDark, st, x, (cy - 0.35) / 2, cz1 - 0.1); limb(st, V3(x, cy - 0.75, cz1 - 0.1), V3(x, cy - 0.3, cz1 - 0.75), 0.05, 0.05, M.woodDark, 4); }
  bench(st, fx(0) + 0.1, d / 2 + 0.55, 0, 1.6); bench(st, fx(5) + 0.3, d / 2 + 0.55, 0, 1.8);
  const clk = mesh(new T.CylinderGeometry(0.22, 0.22, 0.08, 16), M.paper, st, fx(3), cy - 0.55, cz1 - 0.3); clk.rotation.x = Math.PI / 2;
  mesh(new T.CylinderGeometry(0.03, 0.03, 0.35, 4), M.woodDark, st, fx(3), cy - 0.3, cz1 - 0.3);
  luggageRack(st, fx(6) - 0.1, d / 2 + 0.45, 0);
  // someone left a folded blanket and a small tea flask on the bench (shown after the first rest)
  const tea = dyn(new T.Group()); tea.position.set(fx(0) + 0.65, 0.46, d / 2 + 0.55); st.add(tea); tea.visible = false;
  mesh(new T.BoxGeometry(0.42, 0.1, 0.3), M.clothBlue, tea, -0.05, 0.05, 0); mesh(new T.BoxGeometry(0.42, 0.02, 0.3), M.cloth, tea, -0.05, 0.1, 0);
  mesh(new T.CylinderGeometry(0.05, 0.055, 0.24, 10), mat(0x6f7a73, { metalness: 0.3, roughness: 0.5 }), tea, 0.25, 0.12, 0.02); mesh(new T.CylinderGeometry(0.035, 0.03, 0.05, 8), M.paper, tea, 0.12, 0.03, 0.1);
  place(st, -1.6, 6.05, 0, 0);
  Object.assign(ST, { g: st, ledger, ledgerCover, slip, drawer, standUmb, towel, tea, tagLbl, fx, d, fl }); }
// smoke from the waiting-room stove pipe
for (let i = 0; i < 5; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: mistTex, color: 0xd9d6d0, transparent: true, opacity: 0, depthWrite: false })); scene.add(sp); R.smokes.push({ sp, base: at(-3.8, 6.9, 3.4), ph: i / 5 }); }

// luggage cart with the old trunk (the tag hangs from its handle)
const CART = {}; { const cart = new T.Group();
  mesh(new T.BoxGeometry(1.9, 0.1, 0.95), M.plank, cart, 0, 0.42, 0);
  [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]].forEach(([x, z]) => { const wh = mesh(new T.CylinderGeometry(0.2, 0.2, 0.06, 10), mat(0x3b3f3c), cart, x, 0.2, z); wh.rotation.x = Math.PI / 2; });
  mesh(new T.CylinderGeometry(0.02, 0.02, 1.1, 4), M.woodDark, cart, -1.2, 0.75, 0).rotation.z = 0.9;
  const trunk = dyn(new T.Group()); trunk.position.set(-0.4, 0.47, 0); trunk.rotation.y = 0.12; cart.add(trunk);
  mesh(new T.BoxGeometry(0.66, 0.34, 0.46), M.leather, trunk, 0, 0.17, 0); [-0.22, 0.22].forEach((x) => mesh(new T.BoxGeometry(0.04, 0.36, 0.48), M.brass, trunk, x, 0.17, 0));
  const lid = new T.Group(); lid.position.set(0, 0.34, -0.23); trunk.add(lid); mesh(new T.BoxGeometry(0.66, 0.1, 0.46), mat(0x6c4d35), lid, 0, 0.05, 0.23);
  mesh(new T.TorusGeometry(0.06, 0.012, 4, 10, Math.PI), M.woodDark, trunk, 0, 0.36, 0.24);
  const tagHang = new T.Group(); tagHang.position.set(0.06, 0.3, 0.26); trunk.add(tagHang); mesh(new T.BoxGeometry(0.1, 0.16, 0.012), mat(0x9b7a55), tagHang, 0, -0.1, 0); mesh(new T.CylinderGeometry(0.004, 0.004, 0.08, 3), M.rope, tagHang, 0, -0.01, 0);
  crate(cart, 0.35, 0.47, 0.05, 0.5, mat(0x5f6f7c)); crate(cart, -0.35, 0.83, 0, 0.36, M.wood); sack(cart, 0.55, 0.47, 0.2, 0.22, M.cloth);
  place(cart, 5.0, 3.05, 0.15); cart.scale.setScalar(0.8);
  Object.assign(CART, { g: cart, trunk, lid, tagHang }); }

const STORY = {};
// station name board (blank lettering), flower beds, postbox, watering can
{ const nb = new T.Group();
  [-1.05, 1.05].forEach((x) => mesh(new T.BoxGeometry(0.1, 1.9, 0.1), M.woodDark, nb, x, 0.95, 0));
  mesh(new T.BoxGeometry(2.4, 0.6, 0.06), mat(0xe6e0d0), nb, 0, 1.6, 0.03);
  mesh(new T.BoxGeometry(2.3, 0.07, 0.07), mat(0x4a5a50), nb, 0, 1.36, 0.06);
  [-0.6, -0.2, 0.2, 0.6].forEach((x) => { mesh(new T.BoxGeometry(0.2, 0.03, 0.02), mat(0x55544e), nb, x, 1.7, 0.07); mesh(new T.BoxGeometry(0.03, 0.2, 0.02), mat(0x55544e), nb, x + 0.02, 1.64, 0.07); });
  place(nb, -9.35, 2.5, 0); STORY.nameBoard = nb; mossify(nb.children.slice(0, 3), { thr: 0.4, bias: 0.05, scale: 4 }); }
const flowerCols = [0xc9a2a0, 0xe6dcc0, 0xd6bf7c, 0xa9a2c2, 0xd8b3a8];
const bed = (u0, u1, v) => { for (let u = u0; u < u1; u += 1.1) { const g = new T.Group(); mesh(new T.BoxGeometry(1.0, 0.22, 0.6), M.woodDark, g, 0, 0.11, 0); mesh(new T.BoxGeometry(0.9, 0.05, 0.5), mat(0x3e3429), g, 0, 0.22, 0); for (let k = 0; k < 7; k++) { const x = rr(-0.4, 0.4), z = rr(-0.2, 0.2); const lf = mesh(new T.IcosahedronGeometry(0.1, 0), M.fern2, g, x, 0.3, z); lf.scale.y = 0.7; mesh(new T.IcosahedronGeometry(0.055, 0), mat(flowerCols[Math.floor(rnd() * flowerCols.length)]), g, x + rr(-0.05, 0.05), 0.41, z); } place(g, u, v, 0); } };
bed(-9.6, -6.9, 4.0); bed(4.4, 7.2, 4.0);
{ const pb = new T.Group(); mesh(new T.CylinderGeometry(0.24, 0.26, 1.1, 14), mat(0xa24a3e), pb, 0, 0.55, 0); mesh(new T.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xa24a3e), pb, 0, 1.1, 0); mesh(new T.BoxGeometry(0.22, 0.03, 0.05), M.dark, pb, 0, 0.9, 0.24); place(pb, -11.3, 3.3, 0); }
const CAN = new T.Group(); { const tin = mat(0x7d8a86, { metalness: 0.4, roughness: 0.5 }); mesh(new T.CylinderGeometry(0.15, 0.17, 0.3, 10), tin, CAN, 0, 0.15, 0); const sp = mesh(new T.CylinderGeometry(0.02, 0.03, 0.4, 5), tin, CAN, 0.2, 0.25, 0); sp.rotation.z = -0.9; mesh(new T.TorusGeometry(0.11, 0.015, 4, 10, Math.PI), tin, CAN, -0.02, 0.3, 0); dyn(CAN); place(CAN, 6.9, 3.55, 0.4); }

// ---- five lamps ----
AREA.lamps.forEach((L) => { R.lamps.push(L.style === 'station' ? stationLamp(L.prop[0], L.prop[1]) : hangLamp(L.prop[0], L.prop[1])); });

// ---- entry boardwalk climbing out of the mist ----
boardwalk(BW, 0.5, 1.35, bwProfile);

// ---- lodging hut ----
const LODGE = {}; { const lh = new T.Group();
  stilts(lh, 3.0, 2.4, 0.5, 0.9); mesh(new T.BoxGeometry(3.3, 0.14, 2.9), M.plank, lh, 0, 0.5, 0.2);
  plankWall(lh, 3.0, 1.8, 0, 0.5, -1.2); plankWall(lh, 2.4, 1.8, -1.5, 0.5, 0, Math.PI / 2); plankWall(lh, 2.4, 1.8, 1.5, 0.5, 0, Math.PI / 2); plankWall(lh, 3.0, 1.8, 0, 0.5, 1.2);
  latticeWindow(lh, -0.55, 1.5, 1.28, 0.8, 0.6); mesh(new T.BoxGeometry(0.7, 1.4, 0.06), M.woodDark, lh, 0.75, 1.2, 1.26);
  interiorLight(lh, -0.55, 1.5, 1.9, 0.6, 3.2);
  sheetRoof(lh, 3.0, 2.4, 2.3, 0.6, { oh: 0.45, base: 0x5b4c3e, rust: 0x4c4036, corr: false, moss: 0.14, ridge: 0x4a3e33 });
  hangingFerns(lh, V3(-0.9, 2.05, 1.62), 4, 0.6); hangingFerns(lh, V3(0.6, 2.05, 1.62), 5, 0.7); hangingFerns(lh, V3(1.55, 2.05, 1.1), 3, 0.5);
  mesh(new T.BoxGeometry(0.35, 0.9, 0.35), M.stone, lh, -0.8, 3.1, -0.4);
  place(lh, -11.2, 13.2, 0.35); LODGE.g = lh; lh.updateMatrixWorld(true);
  R.eaves.push([lh, V3(-1.9, 2.05, 1.65), V3(1.9, 2.05, 1.65)]);
  for (let i = 0; i < 5; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: mistTex, color: 0xd9d6d0, transparent: true, opacity: 0, depthWrite: false })); scene.add(sp); R.smokes.push({ sp, base: lh.localToWorld(V3(-0.8, 3.7, -0.4)), ph: i / 5 }); } }
LODGE_STONES.forEach(([u, v]) => { const g = new T.Group(); mesh(new T.BoxGeometry(0.9, 0.12, 0.45), M.stone, g); place(g, u, v, 0.1, 0.02); });

// ---- giant mossy trunk + roots; the great root arch over the lodge path ----
const TRUNK = [-17.6, 5.2, 1.9];
{ const [u, v, r] = TRUNK; const g = new T.Group(); g.position.copy(at(u, v)); scene.add(g);
  const tl = [limb(g, V3(0, -0.5, 0), V3(0.2, 12, 0.1), r, r * 0.8, M.barkGrey, 12, 24), limb(g, V3(0.2, 12, 0.1), V3(0.4, 26, 0.2), r * 0.8, r * 0.6, M.barkGrey, 12, 14)];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + rr(0, 0.5); tl.push(limb(g, V3(Math.cos(a) * r * 1.2, 0, Math.sin(a) * r * 1.2), V3(Math.cos(a) * r * 0.5, 3.5, Math.sin(a) * r * 0.5), r * 0.45, r * 0.12, M.barkGrey, 6, 4)); }
  mossify(tl, { thr: -0.35, bias: -0.1, scale: 0.8 });
  for (let i = 0; i < 3; i++) vine(g.position.clone().add(W(rr(-1, 1), rr(-1, 1), rr(11, 16))), rr(3, 7));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + rr(-0.3, 0.3); let Lr = rr(3.5, 6.5); const du = Math.cos(a), dv = Math.sin(a);
    if (dv < 0) Lr = Math.min(Lr, (v - r - 2.7) / -dv);
    const P3a = (f, lift) => { const uu = u + du * (r + Lr * f), vv = v + dv * (r + Lr * f); return W(uu, vv, H(uu, vv) + lift); };
    root([W(u + du * r * 0.8, v + dv * r * 0.8, H(u, v) + 1.3), P3a(0.35, rr(0.3, 0.9)), P3a(0.7, rr(0.0, 0.5)), P3a(1, -0.3)], r * 0.3, 0.14, { m: M.barkGrey });
  } }
root([W(-18, 7.5, H(-18, 7.5) + 1.2), W(-14, 10.2, H(-14, 10.2) + 2.6), W(-10.4, 11.2, 3.9), W(-7, 11.8, H(-7, 11.8) + 1.6), W(-4.5, 12.6, H(-4.5, 12.6) - 0.3)], 0.7, 0.3, { m: M.barkGrey });
for (let i = 0; i < 5; i++) vine(W(-12 + i * 0.9, 11.2, 3.6), rr(0.6, 1.6));

// ---- forest on the ledge ----
for (let i = 0; i < 60; i++) { const u = rr(-30, 30), v = rr(6, 34); if (RIM(u, v) > 0.9 && !(u > 6 && HILL(u, v) > 2.5)) continue; if (u > -6 && u < 9 && v > 9.5) continue; if (Math.abs(u + 11) < 3 && v < 16) continue; if (Math.abs(u - PORTAL[0]) < 3.5 && Math.abs(v - PORTAL[1]) < 3.5) continue; if (v < 11.5 && u > -9 && u < 9) continue; cedar(u, v, rr(1.1, 1.8)); }
for (let i = 0; i < 20; i++) { const u = rr(-30, 30), v = rr(-24, -10); if (RIM(u, v) > 0.9) continue; if (Math.abs(u) < 14 || polyD(u, v, BROOK) < 2.5 || polyD(u, v, BW) < 2.5) continue; cedar(u, v, rr(1.0, 1.5)); }
[[-6, -9.2, 0.9], [11.5, -7.6, 1.0]].forEach(([u, v, s]) => tree(u, v, s, PAL_BRIGHT));

// ---- event props ----
// the great mossy boulder with an old road marker; stones stacked on top are a world mark
const MARKS = {};
{ const bg = new T.IcosahedronGeometry(1.7, 2); const bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i); const k = 1 + 0.16 * (vnoise(x * 1.3 + 3, y * 1.3, z * 1.3) - 0.5) * 2; bp.setXYZ(i, x * k, y * k, z * k); }
  const b = new T.Mesh(bg, M.stoneDark); b.position.copy(at(-4.6, -2.3, 0.1)); b.scale.set(1.45, 0.7, 1.15); b.rotation.y = 0.7; scene.add(b); b.castShadow = b.receiveShadow = true; mossify([b], { thr: 0.25, bias: 0.02, scale: 1.1 });
  const tab = new T.Group(); mesh(new T.BoxGeometry(0.55, 1.35, 0.22), M.stone, tab, 0, 0.62, 0); for (let i = 0; i < 4; i++) mesh(new T.BoxGeometry(0.05, 0.22, 0.02), M.dark, tab, 0, 1.05 - i * 0.26, 0.115); tab.rotation.z = -0.12; place(tab, -2.7, -3.2, -0.25); mossify(tab.children.slice(0, 1), { thr: 0.3, bias: 0.15, scale: 3 });
  const rubPaper = dyn(mesh(new T.PlaneGeometry(0.42, 0.62), new T.MeshStandardMaterial({ color: 0xe8e0cc, side: T.DoubleSide, transparent: true, opacity: 0 }), tab, 0, 0.78, 0.125)); rubPaper.userData.noMerge = true;
  MARKS.rubPaper = rubPaper; MARKS.tablet = tab;
  [[-6.3, -1.6], [-3.1, -1.7], [-3.6, -4.6]].forEach(([u, v]) => fern(u, v, rr(0.8, 1.2)));
  const stones = dyn(new T.Group()); scene.add(stones); MARKS.boulderStones = [];
  for (let i = 0; i < 8; i++) { const s = mesh(new T.DodecahedronGeometry(0.13 - i * 0.008, 0), M.stone, stones); s.position.copy(at(-4.45, -2.25, 1.26 + i * 0.12)); s.scale.y = 0.6; s.rotation.y = i; s.visible = false; MARKS.boulderStones.push(s); } }
// abandoned goods wagon on the siding; the traveller shelters in its door when it rains
const WAGON = {}; { const wg = new T.Group(); const wood = mat(0x6f5d4b), wood2 = mat(0x645341);
  mesh(new T.BoxGeometry(3.6, 0.22, 1.7), mat(0x2f2b27), wg, 0, 0.62, 0);
  [-1.2, 1.2].forEach((x) => [-0.55, 0.55].forEach((z) => { const wh = mesh(new T.CylinderGeometry(0.3, 0.3, 0.1, 12), mat(0x3a3530), wg, x, 0.36, z); wh.rotation.x = Math.PI / 2; }));
  for (let i = 0; i < 8; i++) { mesh(new T.BoxGeometry(3.4, 0.19, 0.08), i % 2 ? wood : wood2, wg, 0, 0.85 + i * 0.2, 0.8); mesh(new T.BoxGeometry(3.4, 0.19, 0.08), i % 2 ? wood2 : wood, wg, 0, 0.85 + i * 0.2, -0.8); }
  [-1.7, 1.7].forEach((x) => mesh(new T.BoxGeometry(0.08, 1.6, 1.6), wood, wg, x, 1.55, 0));
  mesh(new T.BoxGeometry(1.1, 1.4, 0.05), M.dark, wg, 0.2, 1.45, 0.83); mesh(new T.BoxGeometry(1.1, 1.45, 0.08), wood2, wg, 1.05, 1.45, 0.9);
  crate(wg, -0.2, 0.73, 0.35, 0.45, M.leather); sack(wg, 0.8, 0.73, 0.45, 0.2, M.cloth);
  const hay = mesh(new T.IcosahedronGeometry(0.35, 0), mat(0x9c8a5c), wg, -0.5, 0.8, 0.2); hay.scale.set(1.6, 0.35, 1);
  mesh(new T.PlaneGeometry(0.34, 0.22), new T.MeshStandardMaterial({ color: 0xcbbfa6, side: T.DoubleSide }), wg, -1.0, 1.55, 0.85);
  const wr = sheet(3.9, 1.05, { base: 0x5d5044, rust: 0x4f4338, corr: false, moss: 0.3, seed: 22 }); const wr2 = sheet(3.9, 1.05, { base: 0x5d5044, rust: 0x4f4338, corr: false, moss: 0.36, seed: 23 });
  const r1 = new T.Group(); r1.position.set(0, 2.48, 0); wg.add(r1); wr.position.set(0, 0, 0.47); wr.rotation.x = 0.2; r1.add(wr); const r2 = new T.Group(); r2.position.set(0, 2.48, 0); r2.rotation.y = Math.PI; wg.add(r2); wr2.position.set(0, 0, 0.47); wr2.rotation.x = 0.2; r2.add(wr2);
  wg.position.copy(at(8.4, -1.0, 0.18)); wg.rotation.y = yawFor(3, -1.3) - Math.PI / 2; scene.add(wg); shadowy(wg); wg.updateMatrixWorld(true);
  mossify(wg.children.filter((c) => c.isMesh && c.geometry.type === 'BoxGeometry'), { thr: 0.4, bias: 0.05, scale: 1.8 });
  for (let i = 0; i < 3; i++) fern(0, 0, rr(0.5, 0.8)).position.copy(wg.localToWorld(V3(rr(-1.4, 1.4), 2.62, rr(-0.2, 0.2))));
  hangingFerns(wg, V3(-1.0, 2.36, 0.95), 4, 0.6); hangingFerns(wg, V3(1.3, 2.36, 0.95), 3, 0.5);
  for (let i = 0; i < 4; i++) vine(wg.localToWorld(V3(rr(-1.6, 1.6), 2.4, 0.95)), rr(0.5, 1.3));
  R.eaves.push([wg, V3(-1.95, 2.35, 1.0), V3(1.95, 2.35, 1.0)]);
  Object.assign(WAGON, { g: wg, seat: wg.localToWorld(V3(0.5, 0.74, 0.86)), yaw: wg.rotation.y }); }
// arm semaphore; its arm is a world mark once pulled
const SIGNAL = {}; { const sg = new T.Group(); const iron = mat(0x3b3f3c); mesh(new T.CylinderGeometry(0.07, 0.1, 4.2, 6), iron, sg, 0, 2.1, 0);
  for (let i = 0; i < 12; i++) mesh(new T.BoxGeometry(0.28, 0.03, 0.03), iron, sg, 0, 0.3 + i * 0.3, 0.12);
  const arm = dyn(new T.Group()); arm.position.set(0.1, 3.7, 0.05); arm.rotation.z = -0.08; sg.add(arm); mesh(new T.BoxGeometry(1.2, 0.16, 0.04), mat(0xb8b0a0), arm, 0.6, 0, 0); mesh(new T.BoxGeometry(0.3, 0.16, 0.05), mat(0x8c4f45), arm, 0.95, 0, 0.005);
  mesh(new T.CylinderGeometry(0.08, 0.08, 0.04, 10), new T.MeshStandardMaterial({ color: 0x5a7a6a, emissive: 0x335544, emissiveIntensity: 0.2 }), sg, -0.12, 3.62, 0.08).rotation.x = Math.PI / 2;
  place(sg, 10.9, 1.4, -0.4); mossify(sg.children.slice(0, 1), { thr: -0.6, bias: -0.1, scale: 2.2 }); vine(at(10.9, 1.4, 2.4), 2.2); fern(10.6, 1.0, 0.8);
  SIGNAL.arm = arm; }
// fallen log bridging the brook, shelf fungi
root([at(1.4, -3.9, 0.35), W(3.9, -5.9, -0.05), at(6.4, -7.7, 0.35)], 0.38, 0.32, { m: M.barkGrey, thr: 0.05 });
for (let i = 0; i < 5; i++) { const p = W(1.8 + i * 1.0, -4.2 - i * 0.8, Math.max(H(1.8 + i * 1.0, -4.2 - i * 0.8), -0.4) + 0.3); const fg = mesh(new T.CylinderGeometry(0.16, 0.18, 0.05, 10, 1, false, 0, Math.PI), mat(0xc9b38e), scene, p.x + 0.35, p.y - 0.1, p.z + 0.2); fg.rotation.y = rr(-0.4, 0.4); }
// stepping stones (drowned while it rains)
const STONE_MESHES = [];
STONES.forEach(([u, v]) => { const s = mesh(new T.DodecahedronGeometry(0.42, 1), M.stone, scene); s.position.copy(W(u, v, Math.max(H(u, v), WATERLINE) + 0.02)); s.scale.set(1, 0.32, 0.9); s.rotation.y = rr(0, 3); s.castShadow = s.receiveShadow = true; mossify([s], { thr: 0.55, bias: 0.05, scale: 3 }); STONE_MESHES.push(s); });
// small stone jizo in the root hollow; pebbles are a world mark
{ const jz = new T.Group(); mesh(new T.CylinderGeometry(0.2, 0.26, 0.55, 8), M.stone, jz, 0, 0.3, 0); mesh(new T.SphereGeometry(0.16, 10, 8), M.stone, jz, 0, 0.72, 0); const bib = mesh(new T.ConeGeometry(0.24, 0.26, 8, 1, true), mat(0x8e5548, { side: T.DoubleSide }), jz, 0, 0.47, 0.02); bib.rotation.x = Math.PI;
  mesh(new T.CylinderGeometry(0.05, 0.04, 0.07, 8), M.paper, jz, 0.25, 0.04, 0.2); mesh(new T.BoxGeometry(0.7, 0.12, 0.5), M.stoneDark, jz, 0, 0.0, 0);
  place(jz, -15.6, 3.4, 0.5); STORY.jizo = jz; mossify([jz.children[0], jz.children[1], jz.children[4]], { thr: 0.2, bias: 0.15, scale: 5 });
  const peb = dyn(new T.Group()); jz.add(peb); MARKS.jizoPebbles = [];
  for (let i = 0; i < 12; i++) { const s = mesh(new T.DodecahedronGeometry(0.045 + (i % 3) * 0.01, 0), M.stone, peb, -0.3 + (i % 6) * 0.1, 0.07 + Math.floor(i / 6) * 0.06, 0.28 + (i % 2) * 0.05); s.scale.y = 0.6; s.visible = false; MARKS.jizoPebbles.push(s); } }
// stone basin fed by a bamboo spout
{ const ts = new T.Group(); const basin = mesh(new T.CylinderGeometry(0.42, 0.36, 0.5, 9), M.stone, ts, 0, 0.25, 0); mesh(new T.CylinderGeometry(0.32, 0.32, 0.02, 9), M.water, ts, 0, 0.49, 0);
  const bb = mesh(new T.CylinderGeometry(0.05, 0.05, 1.1, 6), mat(0x7f8a55), ts, -0.1, 0.85, -0.55); bb.rotation.x = 1.05;
  const ld = mesh(new T.CylinderGeometry(0.012, 0.012, 0.6, 4), M.wood, ts, 0.15, 0.52, 0.05); ld.rotation.z = 1.4; mesh(new T.CylinderGeometry(0.06, 0.05, 0.08, 8), M.wood, ts, 0.42, 0.56, 0.05);
  const rk = mesh(new T.DodecahedronGeometry(0.5, 1), M.stoneDark, ts, -0.2, 0.3, -0.9); rk.scale.y = 0.8;
  place(ts, -8.1, 9.6, 0.3); mossify([basin, rk], { thr: 0.1, bias: 0.12, scale: 2.5 }); fern(-8.8, 10.3, 0.9); }
// woodpile and chopping stump
{ const wp = new T.Group(); for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) { const lg = mesh(new T.CylinderGeometry(0.13, 0.13, 0.9, 7), i % 2 ? M.wood : M.woodDark, wp, -0.65 + i * 0.27 + r * 0.13, 0.14 + r * 0.24, 0); lg.rotation.x = Math.PI / 2; }
  const pr = sheet(2.0, 1.2, { base: 0x5b4c3e, rust: 0x4c4036, corr: false, moss: 0.25, seed: 31 }); pr.position.set(0, 1.25, 0.05); pr.rotation.x = 0.25; wp.add(pr); [-0.85, 0.85].forEach((x) => mesh(new T.BoxGeometry(0.08, 1.25, 0.08), M.woodDark, wp, x, 0.62, 0.5));
  mesh(new T.CylinderGeometry(0.28, 0.32, 0.45, 9), M.wood, wp, 1.3, 0.22, 0.5);
  place(wp, -8.5, 14.6, 0.35); }

// ---- story props (2026-09-29): the opening carving on lamp 1, a drifting dead lantern, the ledger sketch,
//      the drawer's new tag, the jizo sapling, a far tower, a rubbing sheet on the name board ----
{ // 1. lamp 1's post: carved strokes (read as 「從這裡開始。」), half under a pad of moss that the opening wipes off
  const carveTex = canvasTex(32, 128, (x, w, h) => { x.fillStyle = '#6b5644'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(28,20,14,0.9)'; x.lineWidth = 2.2; x.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const y = 12 + i * 22; x.beginPath(); x.moveTo(9, y); x.lineTo(23, y + 2); x.moveTo(16, y - 6); x.lineTo(15, y + 9); if (i % 2) { x.moveTo(8, y + 8); x.lineTo(24, y + 7); } x.stroke(); }
    x.beginPath(); x.arc(16, 120, 2.5, 0, 7); x.stroke(); });
  const lamp1 = R.lamps[0].g; const cg = dyn(new T.Group()); lamp1.updateWorldMatrix(true, false); const lq = new T.Quaternion(); lamp1.getWorldQuaternion(lq); const lyaw = new T.Euler().setFromQuaternion(lq, 'YXZ').y;
  const cry = Math.PI / 4 - lyaw; cg.rotation.y = cry; cg.position.set(Math.sin(cry) * 0.085, 1.0, Math.cos(cry) * 0.085); lamp1.add(cg);   // faces the game camera (a small carved plaque lashed to the post)
  mesh(new T.BoxGeometry(0.2, 0.52, 0.03), mat(0x5b4636), cg, 0, 0, -0.012);
  mesh(new T.PlaneGeometry(0.17, 0.46), new T.MeshStandardMaterial({ map: carveTex, roughness: 1 }), cg, 0, 0, 0.005);
  const pad = mesh(new T.IcosahedronGeometry(0.1, 1), M.moss, cg, 0, 0.02, 0.02); pad.scale.set(1.15, 2.7, 0.45);
  const crumbs = []; for (let i = 0; i < 6; i++) { const c = mesh(new T.IcosahedronGeometry(0.03, 0), M.mossBright, cg, rr(-0.05, 0.05), rr(-0.15, 0.2), 0.03); c.visible = false; crumbs.push({ c, y0: c.position.y, x0: c.position.x, vx: rr(-0.25, 0.25) }); }
  STORY.carve = { g: cg, pad, crumbs };
}
{ // 2. a dead lantern that drifts down the brook: east branch → over the east falls (dry, seen from the pier);
  //    west branch past the wagon (rain, seen from its door)
  const lg = dyn(new T.Group()); const brass = mat(0x8a7a5a, { roughness: 0.6, metalness: 0.3 }); const glass = mat(0x3a3a34, { roughness: 0.3 });
  mesh(new T.BoxGeometry(0.2, 0.05, 0.2), brass, lg, 0, 0.025, 0); mesh(new T.BoxGeometry(0.17, 0.2, 0.17), glass, lg, 0, 0.15, 0);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => mesh(new T.BoxGeometry(0.025, 0.22, 0.025), brass, lg, a * 0.09, 0.15, b * 0.09));
  const cap = mesh(new T.ConeGeometry(0.15, 0.1, 4), brass, lg, 0, 0.3, 0); cap.rotation.y = Math.PI / 4; mesh(new T.TorusGeometry(0.04, 0.01, 4, 8), brass, lg, 0, 0.37, 0);
  lg.scale.setScalar(1.7); lg.rotation.z = 0.25; lg.visible = false; scene.add(lg); shadowy(lg);
  const wake = new T.Mesh(new T.RingGeometry(0.22, 0.3, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); wake.rotation.x = -Math.PI / 2; scene.add(wake);
  const mats = []; lg.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); mats.push(c.material); } });
  const WL = WATERLINE + 0.02;
  const cr = (pts) => new T.CatmullRomCurve3(pts, false, 'centripetal');
  const east = cr([W(14.6, -2.55, WL), W(15.2, -2.35, WL), W(15.8, -2.8, WL), W(16.15, -3.5, WL), W(16.45, -4.2, WL)].concat(AREA.departures[0].offMap.slice(1).map((q) => W(q[0], q[1], q[2]))));
  const west = cr([W(14.9, -2.45, WL), W(13.5, -3.3, WL), W(12.2, -4.05, WL), W(10.4, -4.85, WL), W(8.4, -5.3, WL), W(6.0, -5.7, WL)]);
  const lipLen = cr([W(14.6, -2.55, WL), W(15.2, -2.35, WL), W(15.8, -2.8, WL), W(16.15, -3.5, WL), W(16.45, -4.2, WL)]).getLength();
  STORY.drift = { g: lg, wake, mats, east, west, lipAt: lipLen / east.getLength() };
}
{ // 3. the sketch that slides out of the ledger on the second visit: a lantern half under water, and 「灣」 in the corner
  STORY.sketchTex = canvasTex(96, 128, (x, w, h) => { x.fillStyle = '#e4dccb'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(40,34,28,0.85)'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(6, 78); for (let i = 0; i <= 84; i += 6) x.lineTo(6 + i, 78 + Math.sin(i * 0.3) * 2); x.stroke();
    x.strokeRect(34, 44, 26, 30); x.beginPath(); x.moveTo(30, 44); x.lineTo(47, 32); x.lineTo(64, 44); x.stroke(); x.beginPath(); x.arc(47, 28, 4, 0, 7); x.stroke();
    x.fillStyle = 'rgba(70,90,100,0.35)'; x.fillRect(8, 80, 80, 40); x.fillStyle = 'rgba(40,34,28,0.85)'; x.fillRect(74, 104, 12, 2); x.fillRect(79, 98, 2, 14); x.fillRect(74, 110, 12, 2); });
}
{ // 4. a new luggage tag in the empty drawer (the visit after the compass was taken)
  const tg = dyn(new T.Group()); mesh(new T.BoxGeometry(0.1, 0.012, 0.16), mat(0xa88460), tg, 0, 0, 0); mesh(new T.TorusGeometry(0.025, 0.004, 4, 10), M.rope, tg, 0, 0.004, -0.09).rotation.x = Math.PI / 2;
  tg.position.set(0.08, 0.1, -0.12); tg.rotation.y = 0.4; tg.visible = false; ST.drawer.add(tg);
  STORY.drawerTag = tg;
}
{ // 5. a sapling in the jizo's cup (the 護根布 event wraps its roots in cloth)
  const sg = dyn(new T.Group()); sg.position.set(0.25, 0.08, 0.2); STORY.jizo.add(sg);
  mesh(new T.CylinderGeometry(0.006, 0.008, 0.16, 4), mat(0x6b7a4a), sg, 0, 0.08, 0);
  [[0.03, 0.12, 0.5], [-0.03, 0.15, -0.6], [0.01, 0.17, 2.2]].forEach(([x, y, r]) => { const l = mesh(new T.IcosahedronGeometry(0.03, 0), M.fern2, sg, x, y, 0); l.scale.set(1.4, 0.4, 0.8); l.rotation.y = r; });
  const wrap = mesh(new T.CylinderGeometry(0.06, 0.05, 0.07, 8), mat(0x8f8466), sg, 0, 0.02, 0); wrap.visible = false;
  STORY.sapling = { g: sg, wrap };
}
{ // 6. a far tower on a rock pinnacle in the mist behind the station: faint in the fog, clearer through the weathered lens
  const m = new T.MeshBasicMaterial({ color: 0x3a4944 }); const tw = dyn(new T.Group()); tw.position.copy(W(5.5, 19.5, 0)); tw.rotation.y = Math.PI / 4; scene.add(tw);
  const rk = mesh(new T.ConeGeometry(1.5, 4.5, 5), m, tw, 0, -3.2, 0); rk.scale.z = 0.5;
  mesh(new T.BoxGeometry(0.5, 2.4, 0.1), m, tw, 0, 0.1, 0.3); mesh(new T.BoxGeometry(0.85, 0.3, 0.1), m, tw, 0, 1.35, 0.3); mesh(new T.ConeGeometry(0.42, 0.9, 4), m, tw, 0, 1.95, 0.3);
  R.ridges.push(STORY.tower = { m, c: new T.Color(0x3a4944), k: 0.72, k0: 0.72 });
}
{ // 8. far lights in the fog below the falls: only shown at the end of the first-lantern events ("下游的霧裡，好像還有更多")
  const tx = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(0.25, 'rgba(255,214,150,0.55)'); g.addColorStop(1, 'rgba(255,200,130,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const pts = [[20.5, -9.0, -6.0, 0.5], [23.2, -11.0, -8.0, 0.4], [16.8, -10.0, -9.2, 0.35], [24.6, -8.5, -4.8, 0.3], [21.8, -14.0, -9.8, 0.3], [15.4, -8.6, -7.4, 0.28], [26.2, -10.2, -7.0, 0.25]];
  STORY.far = pts.map(([u, v, y, s], i) => { const m = new T.SpriteMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false, depthTest: false }); const sp = new T.Sprite(m); sp.position.copy(W(u, v, y)); sp.scale.setScalar(s * 2.4); sp.userData = { base: sp.position.clone(), s: s * 2.4, ph: i * 1.7 }; sp.visible = false; sp.renderOrder = 50; scene.add(sp); return sp; });
}
{ // 7. a rubbing sheet held to the name board (carrying 炭印紙)
  const pp = dyn(mesh(new T.PlaneGeometry(0.9, 0.4), new T.MeshStandardMaterial({ color: 0xece4d2, side: T.DoubleSide, transparent: true, opacity: 0 }), STORY.nameBoard, -0.35, 1.62, 0.08)); pp.userData.noMerge = true;
  STORY.signPaper = pp;
}

// ---- light shafts (only when the sky is clear enough) ----
[[-5, 8, 1.1], [6, 6, 0.9], [-14, -2, 0.9], [12, -4, 0.8]].forEach(([u, v, s]) => { const m = new T.MeshBasicMaterial({ map: shaftTex, color: 0xfff4dc, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }); const sh = new T.Mesh(new T.PlaneGeometry(2.4 * s, 24), m); sh.position.copy(at(u, v, 10)); sh.rotation.set(0, Math.PI / 4, 0.35); scene.add(sh); R.shafts.push({ m, ph: rr(0, 6) }); });

// ---- ground cover ----
const NO_GROW = [[-13, 9, 1.3, 8.3]];
const ok = (u, v) => RIM(u, v) < 0.93 && polyD(u, v, TRK) > 1.6 && polyD(u, v, SIDING) > 1.3 && polyD(u, v, BROOK) > 1.8 && polyD(u, v, BW) > 1.1 && pathD(u, v) > 0.9 && !(u > -13 && u < 9 && v > 1.3 && v < 8.3) && Math.hypot(u - TRUNK[0], v - TRUNK[1]) > TRUNK[2] + 0.6 && Math.hypot(u + 11.2, v - 13.2) > 2.4 && Math.hypot(u - PORTAL[0], v - PORTAL[1]) > 3 && Math.hypot(u + 4.6, v + 2.3) > 2.4 && Math.hypot(u - 8.4, v + 1.0) > 2.2 && polyD(u, v, LOG) > 0.8;
for (let i = 0; i < 110; i++) { const u = rr(-26, 24), v = rr(-16, 24); if (ok(u, v)) fern(u, v, rr(0.8, 1.45)); }
for (let i = 0; i < 30; i++) { const u = rr(-22, 22), v = rr(-14, 20); if (ok(u, v)) mushroom(u, v, rr(0.8, 1.5)); }
for (let i = 0; i < 24; i++) { const u = rr(-24, 24), v = rr(-14, 22); if (ok(u, v)) rockAt(at(u, v), rr(0.3, 0.7), true); }
mossMounds(150, ok); grass(2400, (u, v) => ok(u, v) || (polyD(u, v, TRK) < 1.2 && rnd() < 0.35 && u < PORTAL[0] && RIM(u, v) < 0.95));
for (let i = 0; i < 14; i++) mist(rr(-22, 22), rr(-12, 4), rr(-0.3, 1.2), rr(6, 11), 0.32);
for (let i = 0; i < 10; i++) mist(rr(-24, 24), rr(14, 30), rr(6, 12), rr(9, 15), 0.4);

// ---- merge everything static into a few draw calls ----
const mergedGroups = mergeUnder(scene);


  // =====================================================================
  // runtime: plays back the saved schedule (src/shared/area02.ts)
  // =====================================================================
  let tAcc = 0;
  const PLANNED = 3000, DEPART_T = 5;
  const REST = {}; AREA.restActivities.forEach((a) => { REST[a.id] = a; });
  const LAMP_AT = {}; AREA.lamps.forEach((L, i) => { LAMP_AT[L.node] = i; });
  const AMBIENT = AREA.anywhereEvents;
  const VIEW_FACE = Math.atan2(Math.sin(Math.PI / 4), Math.cos(Math.PI / 4));
  const target = W(-1.8, 1.8, 0.8);

// ---------- nodes, edges, routes ----------
const NODE = {}; AREA.nodes.forEach((n) => { NODE[n.id] = Object.assign({}, n, { p: W(n.u, n.v, walkY(n.u, n.v)) }); });
const SPOT = {}; AREA.spots.forEach((s) => { SPOT[s.id] = s; });
const makeCurve = (pts) => pts.length === 2 ? new T.LineCurve3(pts[0], pts[1]) : new T.CatmullRomCurve3(pts, false, 'centripetal');
const ADJ = {}; Object.keys(NODE).forEach((id) => { ADJ[id] = []; });
const EDGES = AREA.edges.map((e) => {
  const pts = [NODE[e.a].p].concat((e.via || []).map((v) => W(v[0], v[1], walkY(v[0], v[1])))).concat([NODE[e.b].p]);
  const E = Object.assign({}, e, { pts, fwd: makeCurve(pts), rev: makeCurve(pts.slice().reverse()) }); E.len = E.fwd.getLength();
  ADJ[e.a].push({ to: e.b, E, dir: 'fwd' }); ADJ[e.b].push({ to: e.a, E, dir: 'rev' }); return E;
});
const IDS = Object.keys(NODE), IX = {}; IDS.forEach((id, i) => { IX[id] = i; });
function allPairs(skipClosed) {
  const N = IDS.length; const SPD = [], NEXT = [];
  for (let i = 0; i < N; i++) { SPD.push(new Array(N).fill(Infinity)); NEXT.push(new Array(N).fill(-1)); SPD[i][i] = 0; NEXT[i][i] = i; }
  EDGES.forEach((E) => { if (skipClosed && E.closedInRain) return; const a = IX[E.a], b = IX[E.b]; SPD[a][b] = SPD[b][a] = E.len; NEXT[a][b] = b; NEXT[b][a] = a; });
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (SPD[i][k] + SPD[k][j] < SPD[i][j]) { SPD[i][j] = SPD[i][k] + SPD[k][j]; NEXT[i][j] = NEXT[i][k]; }
  return { SPD, NEXT };
}
const GRAPH = { open: allPairs(false), rain: allPairs(true) };
let raining = false;
const G = () => raining ? GRAPH.rain : GRAPH.open;
const D = (a, b) => G().SPD[IX[a]][IX[b]];
function pathIds(a, b) { const g = G(); const out = [a]; let i = IX[a]; const j = IX[b]; if (g.NEXT[i][j] < 0) return null; while (i !== j) { i = g.NEXT[i][j]; out.push(IDS[i]); } return out; }
function buildRoute(a, b) {
  const ids = pathIds(a, b); if (!ids || ids.length < 2) return null;
  const cp = new T.CurvePath();
  for (let i = 0; i < ids.length - 1; i++) { const hop = ADJ[ids[i]].find((h) => h.to === ids[i + 1] && !(raining && h.E.closedInRain)) || ADJ[ids[i]].find((h) => h.to === ids[i + 1]); cp.add(hop.dir === 'fwd' ? hop.E.fwd : hop.E.rev); }
  return { curve: cp, len: cp.getLength(), ids };
}
const BROOK_CROSS = STONES.slice(0, 4);
function travelY(p) { const [u, v] = toUV(p.x, p.z); let y = walkY(u, v); if (polyD(u, v, [[-8.3, -4.5], [-8.45, -5.35], [-8.6, -6.1], [-8.5, -6.85], [-8.8, -7.55], [-8.9, -8.1]]) < 0.45) y = Math.max(y, WATERLINE + 0.12); return y; }

// ---------- traveller ----------
const trav = new T.Group(); trav.scale.setScalar(1.15); scene.add(trav);
const body = new T.Group(); trav.add(body);
const legGeo = new T.CylinderGeometry(0.045, 0.04, 0.3, 5); legGeo.translate(0, -0.15, 0);
const legL = mesh(legGeo, M.woodDark, body, -0.07, 0.3, 0), legR = mesh(legGeo, M.woodDark, body, 0.07, 0.3, 0);
const upper = new T.Group(); upper.position.y = 0.3; body.add(upper);
const cloak = mesh(new T.ConeGeometry(0.23, 0.6, 8), M.cloak, upper, 0, 0.25, 0);
mesh(new T.CylinderGeometry(0.07, 0.07, 0.34, 7), mat(0x8a6f55), upper, 0, 0.36, -0.15).rotation.z = Math.PI / 2;
const head = new T.Group(); head.position.y = 0.6; upper.add(head);
mesh(new T.SphereGeometry(0.105, 12, 9), M.skin, head); mesh(new T.ConeGeometry(0.3, 0.13, 12), M.hat, head, 0, 0.1, 0);
const armGeo = new T.CylinderGeometry(0.034, 0.03, 0.3, 5); armGeo.translate(0, -0.15, 0);
const armL = mesh(armGeo, M.cloak, upper, -0.13, 0.44, 0.02), armR = mesh(armGeo, M.cloak, upper, 0.13, 0.44, 0.02);
const staff = new T.Group(); staff.position.set(0.2, 0.25, 0.08); upper.add(staff);
mesh(new T.CylinderGeometry(0.017, 0.02, 1.08, 5), M.wood, staff, 0, 0.02, 0); mesh(new T.BoxGeometry(0.02, 0.02, 0.14), M.woodDark, staff, 0, 0.55, 0.06);
const travGlowMat = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.2, roughness: 1 }); travGlowMat.userData.glow = true;
const travLamp = mesh(new T.BoxGeometry(0.075, 0.1, 0.075), travGlowMat, staff, 0, 0.46, 0.13);
const travLight = new T.PointLight(0xffb05a, 0.8, 3.2, 2); travLight.position.set(0, 0.46, 0.13); scene.add(travLight);
const travHalo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3, fog: false })); travHalo.scale.set(0.8, 0.8, 1); travHalo.position.set(0, 0.46, 0.13); staff.add(travHalo);
const book = mesh(new T.BoxGeometry(0.2, 0.025, 0.14), M.paper, upper, 0, 0.1, 0.24); book.rotation.x = -0.4;
const umb = new T.Group(); umb.position.set(-0.12, 0.95, 0.05); upper.add(umb); umb.visible = false;
{ mesh(new T.ConeGeometry(0.62, 0.24, 14, 1, true), mat(0x4b5a6e, { side: T.DoubleSide }), umb, 0, 0.12, 0); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; mesh(new T.BoxGeometry(0.012, 0.012, 0.6), M.woodDark, umb, Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3).rotation.y = -a + Math.PI / 2; } mesh(new T.CylinderGeometry(0.012, 0.012, 0.8, 4), M.wood, umb, 0, -0.2, 0); }
const cup = mesh(new T.CylinderGeometry(0.035, 0.03, 0.05, 8), M.paper, armL, 0, -0.3, 0.02); cup.visible = false;
shadowy(trav); travLamp.castShadow = false;
const travMats = []; trav.traverse((c) => { if (c.isMesh) { if (c.material !== travGlowMat) c.material = c.material.clone(); travMats.push(c.material); } });
let lastFade = 1;
function setTravOpacity(o) { travMats.forEach((m) => { m.transparent = o < 0.999; m.opacity = o; m.depthWrite = o > 0.4; }); }
const POSE = {
  idle: {}, walk: {},
  inspect: { lean: 0.3, headX: 0.4, armL: -0.5 },
  crouch: { hip: -0.2, legX: -0.9, lean: 0.45, headX: 0.35, armL: -0.8 },
  pickup: {}, reach: { armL: -1.7, headX: -0.1 }, gaze: { headX: -0.32 },
  sit: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3 },
  sitGaze: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3, headX: -0.3 },
  sitEdge: { hip: -0.28, legX: -1.3, staffX: 0.2, staffZ: -0.6, armL: -0.2 },
  sitDoor: { hip: -0.28, legX: -1.25, staffX: 0.2, staffZ: -0.6, armL: -0.25, headX: -0.15 },
  write: { hip: -0.28, legX: -1.45, headX: 0.5, armL: -0.9, book: 1, staffX: 0.2, staffZ: -0.6 },
  drinkSit: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -2.0, headX: -0.3, cup: 1 },
  light: { armL: -0.4, headX: -0.1 }, stretch: {}, bow: { lean: 0.3, headX: 0.45, armL: -0.9 },
  drink: { armL: -2.0, headX: -0.35 }, water: { lean: 0.22, headX: 0.45, armL: -1.1 }, chop: {}, balance: { armL: -1.35, armLz: -1.1, headX: 0.15 },
  hold: { armL: -1.15, headX: 0.4, lean: 0.05 }, umbrella: { armL: -2.45, headX: -0.05 }, shoulder: {},
  reachDown: { hip: -0.2, legX: -0.9, lean: 0.6, headX: 0.45, armL: -0.35 },
  readBook: { book: 1, headX: 0.32, armL: -1.0 }, lens: { armL: -1.65, headX: -0.12 }
};
const PKEYS = ['hip', 'legX', 'lean', 'headX', 'headY', 'armL', 'armLz', 'staffX', 'staffZ', 'book', 'lie', 'cup'];
const pose = {}; PKEYS.forEach((k) => { pose[k] = 0; });

  // hand over the hat: hurrying through the rain without an umbrella
  POSE.hurry = { armL: -2.55, headX: 0.22, lean: 0.14 };

  // ---------- saved state ----------
  let moss = opts.moss || null;             // MossSceneSnapshot of the node on screen
  let planned = Math.max(60, opts.targetSeconds || PLANNED);
  let reported = Math.max(0, Number(moss ? Math.max(moss.effectiveSeconds || 0, opts.progressSeconds || 0) : opts.progressSeconds) || 0);
  let reportedAt = sceneNow(), lastIncreaseAt = -1e9;
  let sim = reported, playing = false;
  const weatherSeed = () => (TR.state === 'depart' && depView ? depView.seed : moss ? moss.weatherSeed : 0);
  let wx = weatherAt(moss ? moss.weatherSeed : 0, sim);
  const worldMarks = { boulderStones: 0, jizoPebbles: 0, signalLowered: false, towelLeft: false, bench_tea_seen: false, carvingSeen: false, drawerTagLeft: false };
  let umbrellaSaved = 'none';
  let coreSaved = false;                     // saved state; the drawer empties only after a core reveal has played
  let saplingWrapped = false;
  function readSnapshot(s) {
    if (!s) return;
    if (s.worldMarks) Object.assign(worldMarks, s.worldMarks);
    umbrellaSaved = s.umbrella === 'borrowed' ? 'borrowed' : 'none';
    coreSaved = !!s.coreTaken;
    saplingWrapped = !!s.saplingWrapped;
    STORY.sapling.g.visible = !s.saplingTaken;
  }

  // ---------- sky: day/night line blended with the weather line ----------
  const TGT = toState(PRE.dawn);
  let lookPrimed = false;
  function blendState(tod, overcast, dt) {
    const A = CLEAR_S[tod.from], B = CLEAR_S[tod.to], Ar = RAIN_S[tod.from], Br = RAIN_S[tod.to], k = tod.blend;
    COLOR_KEYS.forEach((key) => { TGT[key].copy(A[key]).lerp(B[key], k); const rc = Ar[key].clone().lerp(Br[key], k); TGT[key].lerp(rc, overcast); });
    NUM_KEYS.forEach((key) => { const c = A[key] + (B[key] - A[key]) * k; const r = Ar[key] + (Br[key] - Ar[key]) * k; TGT[key] = c + (r - c) * overcast; });
    TGT.sunAt = A.sunAt.clone().lerp(B.sunAt, k).normalize();
    // time only moves forward slowly, so this mostly follows exactly; a jump (reopen, departure swap) eases over ~1.5 s
    const e = lookPrimed ? 1 - Math.exp(-dt * 2.2) : 1; lookPrimed = true;
    COLOR_KEYS.forEach((key) => cur[key].lerp(TGT[key], e)); NUM_KEYS.forEach((key) => { cur[key] += (TGT[key] - cur[key]) * e; });
    cur.sunAt = (cur.sunAt || TGT.sunAt.clone()).lerp(TGT.sunAt, e).normalize();
    return k < 0.5 ? tod.from : tod.to;
  }
const WHITE = new T.Color(0xffffff);
// wet surfaces: remember every lit material's dry look
const WETS = []; { const seen = new Set(); scene.traverse((o) => { if (!o.isMesh || !o.material || seen.has(o.material)) return; const m = o.material; seen.add(m); if (!m.isMeshStandardMaterial || m.transparent || m.userData.glow || m === M.water || travMats.indexOf(m) >= 0) return; WETS.push({ m, c: m.color.clone(), r: m.roughness, mt: m.metalness }); }); }
let lastWet = -1;
function applyWet(w) { if (Math.abs(w - lastWet) < 0.01) return; lastWet = w; WETS.forEach((e) => { e.m.color.copy(e.c).multiplyScalar(1 - 0.16 * w); e.m.roughness = e.r + (Math.min(e.r, 0.4) - e.r) * w; e.m.metalness = e.mt + 0.06 * w; }); }

// ---------- rain: streaks, puddles, splashes, drips ----------
const RAIN_FX = {};
{ const N = 5200, pos = new Float32Array(N * 2 * 3), aT = new Float32Array(N * 2), aS = new Float32Array(N * 2);
  const under = (u, v) => (u > -7.2 && u < 4.2 && v > 2.6 && v < 8.0) || (u > 6.4 && u < 10.5 && v > -2.6 && v < 0.6) || (u > -13.2 && u < -9.2 && v > 11.6 && v < 14.9);
  let k = 0; while (k < N) { const u = rr(-26, 24), v = rr(-20, 26); if (under(u, v)) continue; const p = W(u, v, rr(0, 18)); const sd = rnd(); for (let e = 0; e < 2; e++) { pos.set([p.x, p.y, p.z], (k * 2 + e) * 3); aT[k * 2 + e] = e; aS[k * 2 + e] = sd; } k++; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aT', new T.BufferAttribute(aT, 1)); g.setAttribute('aS', new T.BufferAttribute(aS, 1));
  const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uRain: { value: 0 }, uColor: { value: new T.Color(0xd3dde0) }, uOpacity: { value: 0.3 } },
    vertexShader: 'attribute float aT; attribute float aS; uniform float uTime; uniform float uRain; varying float vA; void main(){ vec3 p = position; float fall = mod(p.y - uTime * 20.0 * (0.85 + 0.3 * aS), 18.0) - 1.6; float len = 0.45 + 0.4 * fract(aS * 7.13); vec3 q = vec3(p.x, fall, p.z) + vec3(0.1, -1.0, 0.06) * (aT * len); vA = step(aS, uRain) * (1.0 - aT * 0.6); gl_Position = projectionMatrix * modelViewMatrix * vec4(q, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uColor, uOpacity * vA); }' });
  const ls = new T.LineSegments(g, m); ls.frustumCulled = false; scene.add(ls); RAIN_FX.streaks = m;
  // puddles (platform slabs, gravel beside the rails, the lodge path) and splash rings
  const pm = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }); RAIN_FX.puddleMat = pm;
  const ringM = new T.MeshBasicMaterial({ color: 0xe3ecee, transparent: true, opacity: 0, depthWrite: false }); RAIN_FX.rings = [];
  const pud = (u, v, r) => { const c = new T.Mesh(new T.CircleGeometry(r, 14), pm); c.rotation.x = -Math.PI / 2; c.position.copy(W(u, v, walkY(u, v) + 0.03)); c.scale.set(1, rr(0.55, 0.9), 1); c.rotation.z = rr(0, 3); scene.add(c);
    for (let i = 0; i < Math.ceil(r * 3); i++) { const rg = new T.Mesh(new T.RingGeometry(0.05, 0.075, 12), ringM.clone()); rg.rotation.x = -Math.PI / 2; const a = rr(0, 6.28), d = rr(0, r * 0.6); rg.position.copy(c.position).add(W(Math.cos(a) * d, Math.sin(a) * d, 0.01)); scene.add(rg); RAIN_FX.rings.push({ m: rg, ph: rnd(), sp: rr(0.9, 1.4) }); } };
  [[-8.2, 2.7, 0.7], [-3.2, 2.45, 0.55], [1.2, 2.55, 0.7], [5.2, 2.6, 0.5], [-6.3, 2.3, 0.35], [-14, 0.1, 0.5], [-6, -0.15, 0.45], [2.8, -0.1, 0.5], [-9.7, 9.4, 0.4], [-11.6, 1.4, 0.4], [-9.9, 6.0, 0.35]].forEach(([u, v, r]) => pud(u, v, r));
  // drips under the eaves
  RAIN_FX.drips = []; R.eaves.forEach(([g0, a, b]) => { g0.updateMatrixWorld(true); const A = g0.localToWorld(a.clone()), B = g0.localToWorld(b.clone()); const n = Math.round(A.distanceTo(B) * 6); const pos2 = new Float32Array(n * 3); const base = []; for (let i = 0; i < n; i++) { const q = A.clone().lerp(B, rnd()); base.push({ q, ph: rnd(), sp: rr(0.8, 1.3), len: rr(0.8, 1.6) }); } const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos2, 3)); const pm2 = new T.PointsMaterial({ color: 0xe6eef0, size: 3, map: dotTex, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: false }); const pts = new T.Points(geo, pm2); pts.frustumCulled = false; scene.add(pts); RAIN_FX.drips.push({ pts, pos: pos2, base, m: pm2 }); });
}
// brook foam, fireflies
const SPLIT = brookCurve.userData.split;
const FOAM = (function () { const n = 90, pos = new Float32Array(n * 3); const base = []; for (let i = 0; i < n; i++) { const t = rnd(); base.push({ t, off: rr(-0.9, 0.9), sp: rr(0.012, 0.02), east: t < SPLIT }); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); const m = new T.PointsMaterial({ color: 0xe8efee, size: 2.5, map: dotTex, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: false }); const pts = new T.Points(g, m); pts.frustumCulled = false; scene.add(pts); return { pos, base, pts, m }; })();
const FIRE = (function () { const n = 36, pos = new Float32Array(n * 3); const base = []; for (let i = 0; i < n; i++) { const near = rnd() < 0.65; const p = near ? brookCurve.getPointAt(rr(0.1, 0.9)) : V3(rr(-12, -7), 0, rr(8, 13)); const q = W(p.x + rr(-1.5, 1.5), p.z + rr(-1.5, 1.5), 0); base.push({ x: q.x, y: walkY(p.x, p.z) + rr(0.4, 1.4), z: q.z, ph: rr(0, 6), sp: rr(0.4, 0.9) }); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); const m = new T.PointsMaterial({ color: 0xd9f29a, size: 4, map: dotTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: false, fog: false }); const pts = new T.Points(g, m); pts.frustumCulled = false; scene.add(pts); return { pos, base, pts, m }; })();
// ---------- special finds (journey: warm and small; core: blue and large) ----------
const BLUE = 0x7cc4ff, AMBER = 0xe0b265;
const blueTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(235,248,255,1)'); g.addColorStop(0.25, 'rgba(140,205,255,0.75)'); g.addColorStop(0.6, 'rgba(90,170,255,0.18)'); g.addColorStop(1, 'rgba(80,160,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const charTex = canvasTex(128, 176, (x, w, h) => { x.fillStyle = '#e8e0cc'; x.fillRect(0, 0, w, h); x.globalAlpha = 0.85; for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(40,36,32,' + (0.25 + Math.random() * 0.4) + ')'; x.fillRect(8 + Math.random() * 112, 8 + Math.random() * 160, 2 + Math.random() * 5, 1 + Math.random() * 2); } x.globalAlpha = 1; x.fillStyle = '#e8e0cc'; [[34, 30], [34, 72], [34, 114], [74, 50], [74, 96]].forEach(([a, b]) => { x.fillRect(a, b, 22, 5); x.fillRect(a + 9, b - 8, 5, 22); }); });
function buildItem(id) {
  const g = new T.Group();
  if (id === 'old_luggage_tag') { mesh(new T.BoxGeometry(0.12, 0.2, 0.016), mat(0x9b7a55), g); mesh(new T.CylinderGeometry(0.018, 0.018, 0.02, 8), M.dark, g, 0, 0.07, 0).rotation.x = Math.PI / 2; mesh(new T.TorusGeometry(0.03, 0.004, 4, 10), M.rope, g, 0, 0.11, 0); [-0.03, 0, 0.03].forEach((y) => mesh(new T.BoxGeometry(0.07, 0.008, 0.004), M.dark, g, 0, y - 0.02, 0.01)); }
  if (id === 'charcoal_rubbing') { const p = mesh(new T.PlaneGeometry(0.22, 0.3), new T.MeshStandardMaterial({ map: charTex, side: T.DoubleSide }), g); p.rotation.x = -0.2; }
  if (id === 'cracked_compass') { mesh(new T.CylinderGeometry(0.1, 0.1, 0.035, 20), M.brass, g).rotation.x = Math.PI / 2; mesh(new T.CylinderGeometry(0.085, 0.085, 0.01, 20), mat(0xe9e1cf), g, 0, 0, 0.018).rotation.x = Math.PI / 2; const nd = mesh(new T.BoxGeometry(0.012, 0.15, 0.006), mat(0x8c3a30), g, 0, 0, 0.026); nd.name = 'needle'; mesh(new T.BoxGeometry(0.004, 0.13, 0.004), M.dark, g, 0.03, 0.01, 0.027).rotation.z = 0.5; const tg = mesh(new T.BoxGeometry(0.07, 0.11, 0.01), mat(0x9b7a55), g, 0.13, -0.08, 0); tg.rotation.z = 0.4; }
  g.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.emissive = new T.Color(0); c.material.userData.glow = true; } });
  return g;
}
const SRC_POSE = { cart: 'inspect', tablet: 'crouch', ledger: 'inspect', drawer: 'crouch' };
const EVENTS = AREA.events; const EV = {}; EVENTS.forEach((e) => { EV[e.id] = e; });
let rare = null; let coreTaken = false;
const beamMat = () => new T.ShaderMaterial({ uniforms: { uAlpha: { value: 0 }, uTime: timeU }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float uAlpha, uTime; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (0.75 + 0.25 * sin(vUv.x * 37.7 + uTime * 3.0)); gl_FragColor = vec4(vec3(0.45, 0.76, 1.0) * a * uAlpha, 1.0); }' });
function rareSource(ev) {
  if (ev.source === 'cart') { CART.tagHang.updateMatrixWorld(true); return CART.tagHang.localToWorld(V3(0, -0.1, 0)); }
  if (ev.source === 'tablet') { MARKS.rubPaper.updateMatrixWorld(true); return MARKS.rubPaper.getWorldPosition(V3(0, 0, 0)); }
  if (ev.source === 'ledger') { ST.ledger.updateMatrixWorld(true); return ST.ledger.localToWorld(V3(0.05, 0.06, 0)); }
  if (ev.source === 'drawer') { ST.drawer.updateMatrixWorld(true); return ST.drawer.localToWorld(V3(0, 0.12, 0.2)); }
  return NODE[ev.spot].p.clone();
}
function startRare(ev, specifiedByCore) {
  const core = ev.tier === 'core', specified = !core && !!specifiedByCore; const add = (o) => { scene.add(o); return o; };
  const item = add(buildItem(ev.item.id)); item.visible = false; const src = rareSource(ev);
  const tex = core ? blueTex : haloTex; const col = core ? BLUE : AMBER;
  const glint = add(new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }))); glint.scale.setScalar(core ? 1.4 : 0.8); glint.position.copy(src);
  const aura = add(new T.Sprite(new T.SpriteMaterial({ map: tex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }))); aura.scale.setScalar(core ? 1.35 : 0.7);
  const beam = core || specified ? add(new T.Mesh(new T.CylinderGeometry(specified ? 0.05 : 0.3, specified ? 0.08 : 0.5, 7.5, 28, 1, true), beamMat())) : null; if (beam) beam.position.copy(src);
  const rings = []; for (let i = 0; i < (core ? 2 : 1); i++) { const rg = add(new T.Mesh(new T.RingGeometry(0.34, 0.42, 48), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }))); rg.rotation.x = -Math.PI / 2; rg.position.copy(src); rg.position.y = groundAt(src) + 0.03; rings.push(rg); }
  const light = add(new T.PointLight(col, 0, core ? 5 : 2.8, 2));
  const stars = (function () { if (!core) return null; const n = 14, pos = new Float32Array(n * 3); const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); const m = new T.PointsMaterial({ color: 0xbfe4ff, size: 5, map: blueTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: false, fog: false }); const pts = add(new T.Points(geo, m)); pts.frustumCulled = false; const st0 = []; for (let i = 0; i < n; i++) st0.push(V3(rr(-1.6, 1.6), rr(1.5, 3.4), rr(-1.6, 1.6))); return { pts, pos, m, n, st0 }; })();
  rare = { ev, core, specified, item, glint, aura, beam, rings, light, stars, src };
}
function endRare() {
  if (!rare) return;
  [rare.item, rare.glint, rare.aura, rare.beam, rare.light].concat(rare.rings).concat(rare.stars ? [rare.stars.pts] : []).forEach((o) => { if (o) scene.remove(o); });
  CART.lid.rotation.x = 0; ST.ledgerCover.rotation.z = 0; ST.slip.visible = false; if (!coreTaken) ST.drawer.position.z = ST.d / 2 + 0.02;
  CART.tagHang.visible = true; if (MARKS.rubPaper.material) MARKS.rubPaper.material.opacity = 0;
  rare = null; hush = 1;
}
let hush = 1;
function rareUpdate(p) {
  const ev = rare.ev, core = rare.core;
  if (ev.source === 'cart') CART.lid.rotation.x = -1.5 * easeIO(Math.min(1, Math.max(0, (p - 0.08) / 0.25)));
  if (ev.source === 'tablet') { const k = Math.min(1, Math.max(0, (p - 0.06) / 0.38)); MARKS.rubPaper.material.opacity = k < 1 && p < 0.5 ? 0.95 : 0; if (k > 0 && !MARKS.rubPaper.material.map) { MARKS.rubPaper.material.map = charTex; MARKS.rubPaper.material.needsUpdate = true; } MARKS.rubPaper.material.color.setScalar(1.3 - 0.3 * k); }
  if (ev.source === 'ledger') { ST.ledgerCover.rotation.z = 2.7 * easeIO(Math.min(1, Math.max(0, (p - 0.08) / 0.2))); ST.slip.visible = p > 0.25 && p < 0.5; }
  if (ev.source === 'drawer') ST.drawer.position.z = ST.d / 2 + 0.02 + 0.32 * easeIO(Math.min(1, Math.max(0, (p - 0.1) / 0.2)));
  if (core) hush = 1 - 0.85 * Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.3) / 0.6)));
  const fl = p > 0.33 && p < 0.62 ? Math.sin(Math.PI * (p - 0.33) / 0.29) : 0; const pulse = 0.85 + 0.15 * Math.sin(tAcc * 9);
  rare.glint.material.opacity = fl * pulse * (core ? 1 : 0.8);
  if (rare.beam) { rare.beam.material.uniforms.uAlpha.value = fl * 0.85; rare.beam.scale.y = 0.25 + 0.75 * fl; rare.beam.position.set(rare.src.x, rare.src.y - 0.1 + 3.75 * rare.beam.scale.y, rare.src.z); }
  rare.rings.forEach((rg, i) => { const rt = p > 0.36 + i * 0.07 && p < 0.62 + i * 0.07 ? (p - 0.36 - i * 0.07) / 0.26 : -1; if (rt >= 0) { rg.scale.setScalar(0.6 + rt * (core ? 3.6 : 1.6)); rg.material.opacity = (1 - rt) * (core ? 0.9 : 0.6); } else rg.material.opacity = 0; });
  const hand = trav.localToWorld(V3(-0.1, 0.6, 0.32)), bag = trav.localToWorld(V3(0, 0.66, -0.16)); const it = rare.item;
  const sc = core ? 2.4 : 2.1;
  if (p < 0.5) it.visible = false;
  else if (p < 0.66) { const t = easeIO((p - 0.5) / 0.16); it.visible = true; it.position.copy(rare.src).lerp(hand, t); it.position.y += Math.sin(Math.PI * t) * 0.45; it.scale.setScalar(sc * (0.35 + 0.65 * t)); it.rotation.y += 0.04; }
  else if (p < 0.88) { it.visible = true; it.position.copy(hand); it.position.y += Math.sin(tAcc * 1.6) * 0.015; it.scale.setScalar(sc); it.rotation.y += 0.012; const nd = it.getObjectByName('needle'); if (nd) nd.rotation.z = -0.8 * easeIO(Math.min(1, (p - 0.66) / 0.18)) + Math.sin(tAcc * 3) * 0.04 * (1 - (p - 0.66) / 0.22); }
  else { const t = easeIO(Math.min(1, (p - 0.88) / 0.1)); it.position.copy(hand).lerp(bag, t); it.scale.setScalar(sc * (1 - t)); it.visible = t < 0.98; }
  if (ev.source === 'cart') CART.tagHang.visible = p < 0.5; if (ev.source === 'tablet' && p >= 0.5) MARKS.rubPaper.material.opacity = 0;
  const held = p > 0.5 && p < 0.92 ? Math.sin(Math.PI * (p - 0.5) / 0.42) : 0; const glow = Math.max(fl, held);
  rare.light.position.copy(p < 0.5 ? rare.src : it.position); rare.light.position.y += 0.15; rare.light.intensity = glow * (core ? 2.8 : 1.3) * pulse;
  it.traverse((c) => { if (c.isMesh) { c.material.emissive.setHex(core ? 0x5aa8ff : 0xffb45e); c.material.emissiveIntensity = held * (core ? 0.9 : 0.55) * pulse; } });
  rare.aura.position.copy(it.position); rare.aura.material.opacity = it.visible ? held * (core ? 0.85 : 0.55) * pulse : 0;
  if (rare.stars) { const s = rare.stars; const k = Math.min(1, Math.max(0, (p - 0.3) / 0.36)); s.m.opacity = p > 0.25 && p < 0.7 ? 0.9 * Math.sin(Math.PI * Math.min(1, (p - 0.25) / 0.45)) : 0; for (let i = 0; i < s.n; i++) { const q = rare.src.clone().add(s.st0[i].clone().multiplyScalar(1 - easeIO(k))); s.pos[i * 3] = q.x + Math.sin(tAcc * 2 + i) * 0.03; s.pos[i * 3 + 1] = q.y; s.pos[i * 3 + 2] = q.z; } s.pts.geometry.attributes.position.needsUpdate = true; }
}

// ---------- story events (2026-09-29): the opening, first / second visit, core-gated and carried-item events ----------
// The App owns scheduling and persistence; these are playback definitions from the approved prototype.
const SEV = {}; (AREA.storyEvents || []).forEach((e) => { SEV[e.id] = Object.assign({ story: true, anim: 'idle', outcome: e.clue ? 'clue' : 'find' }, e); });
const CLUE = {}; (AREA.clues || []).forEach((c) => { CLUE[c.id] = c; });
let story = null, boatNudge = 0;
function phaseAnim(ev, p) { let a = ev.anim; (ev.phases || []).forEach(([t, k]) => { if (p >= t) a = k; }); return a; }
function heldMesh(kind) {
  const g = new T.Group();
  if (kind === 'wick') { const c = mesh(new T.TorusGeometry(0.05, 0.012, 5, 14), mat(0xd8cdb4), g); c.rotation.x = Math.PI / 2; mesh(new T.CylinderGeometry(0.008, 0.008, 0.12, 4), mat(0x2b2622), g, 0.05, 0.05, 0).rotation.z = 0.5; }
  if (kind === 'lens') { mesh(new T.TorusGeometry(0.06, 0.012, 5, 16), M.brass, g); const gl = mesh(new T.CircleGeometry(0.055, 16), new T.MeshStandardMaterial({ color: 0xbfd3cf, transparent: true, opacity: 0.55, roughness: 0.1, side: T.DoubleSide }), g); gl.position.z = 0.002; }
  if (kind === 'tag') return buildItem('old_luggage_tag');
  if (kind === 'cloth') { const c = mesh(new T.BoxGeometry(0.16, 0.03, 0.12), mat(0x8f8466), g); c.rotation.z = 0.2; }
  return g;
}
const rubTex = canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#ece4d2'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(38,34,30,0.75)'; for (let i = 0; i < 600; i++) x.fillRect(Math.random() * w, Math.random() * h, 2, 1.5); x.fillStyle = '#ece4d2';
  [[18, 20], [46, 20]].forEach(([a, b]) => { x.fillRect(a, b, 20, 4); x.fillRect(a + 8, b - 6, 4, 24); x.fillRect(a, b + 12, 20, 3); }); x.fillStyle = 'rgba(38,34,30,0.85)'; x.fillRect(76, 10, 44, 44); });
function startStory(ev) {
  endStory();
  story = { ev, si: -1, look: null, held: null };
  const fx = ev.effect;
  if (fx === 'drift' || fx === 'driftRain' || fx === 'wick') { const D0 = STORY.drift; D0.g.visible = false; D0.mats.forEach((m) => { m.transparent = true; m.opacity = 0; }); }
  if (fx === 'wick') story.held = heldMesh('wick');
  if (fx === 'lens') story.held = heldMesh('lens');
  if (fx === 'newTag') { story.held = heldMesh('tag'); STORY.drawerTag.visible = true; }
  if (fx === 'sketch') { ST.slip.material.map = STORY.sketchTex; ST.slip.material.needsUpdate = true; }
  if (fx === 'rubSign') { STORY.signPaper.material.map = null; STORY.signPaper.material.needsUpdate = true; }
  if (fx === 'mulch') story.held = heldMesh('cloth');
  if (story.held) { story.held.visible = false; scene.add(story.held); }
}
function endStory() {
  if (!story) return;
  const fx = story.ev.effect;
  if (story.held) scene.remove(story.held);
  STORY.drift.g.visible = false; STORY.drift.wake.material.opacity = 0;
  STORY.carve.crumbs.forEach((q) => { q.c.visible = false; }); STORY.carve.pad.scale.set(1.15, 2.7, 0.45);
  if (fx === 'sketch' || fx === 'ledger08') { ST.ledgerCover.rotation.z = 0; ST.slip.visible = false; ST.slip.material.map = null; ST.slip.material.needsUpdate = true; }
  if (fx === 'newTag' && coreTaken) ST.drawer.position.z = ST.d / 2 + 0.16;
  STORY.signPaper.material.opacity = 0; STORY.tower.k = STORY.tower.k0; boatNudge = 0; STORY.far.forEach((sp) => { sp.visible = false; });
  story = null;
}
const win = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
function storyUpdate(p) {
  const ev = story.ev, fx = ev.effect; story.p = p;
  if (ev.status) { let i = -1; ev.status.forEach(([t], k) => { if (p >= t) i = k; }); if (i !== story.si) { story.si = i; if (i >= 0) setStatus(ev.status[i][1]); } }
  const hand = trav.localToWorld(V3(-0.1, 0.62, 0.3));
  if (story.held) { story.held.position.copy(hand); story.held.rotation.y = trav.rotation.y; }
  story.look = null;
  if (fx === 'carving') {
    const w = win(p, 0.14, 0.38); const pad = STORY.carve.pad; pad.scale.set(1.15 * (1 - w), 2.7 * (1 - w * 0.6), 0.45 * (1 - w)); pad.visible = w < 0.98;
    STORY.carve.crumbs.forEach((q, i) => { const t = win(p, 0.16 + i * 0.03, 0.42 + i * 0.03); q.c.visible = t > 0 && t < 1; q.c.position.y = q.y0 - t * t * 1.0; q.c.position.x = q.x0 + q.vx * t; });
  }
  if (fx === 'drift' || fx === 'wick') {
    const D0 = STORY.drift; const b = win(p, 0.58, 0.78);
    const q = lanternAt(story.ev, p); D0.g.position.copy(q); D0.g.rotation.y = tAcc * 0.4; D0.g.rotation.z = 0.25 + Math.sin(tAcc * 1.7) * 0.08 + b * 1.2;
    const op = Math.min(win(p, 0.06, 0.14), 1 - win(p, 0.72, 0.8)); D0.g.visible = op > 0.01; D0.mats.forEach((m) => { m.opacity = op; m.depthWrite = op > 0.5; });
    D0.wake.position.set(q.x, WATERLINE + 0.04, q.z); D0.wake.scale.setScalar(1 + 0.3 * Math.sin(tAcc * 3)); D0.wake.material.opacity = b > 0 ? 0 : op * 0.35; D0.wake.material.color.copy(cur.fog).lerp(WHITE, 0.7);
    boatNudge = 0.07 * Math.sin(tAcc * 5) * Math.sin(Math.PI * win(p, 0.26, 0.42));
    if (op > 0.05) story.look = q;
    { const fo = win(p, 0.76, 0.9) * (1 - win(p, 0.95, 1)); STORY.far.forEach((sp) => { sp.visible = fo > 0.01; sp.material.opacity = fo * (0.55 + 0.25 * Math.sin(tAcc * 1.3 + sp.userData.ph)); sp.position.copy(sp.userData.base); sp.position.y += Math.sin(tAcc * 0.5 + sp.userData.ph) * 0.12; }); }
    if (story.held) story.held.visible = fx === 'wick' && p > 0.1 && p < 0.9;
  }
  if (fx === 'driftRain') {
    const D0 = STORY.drift; const q = lanternAt(story.ev, p); D0.g.position.copy(q); D0.g.rotation.y = tAcc * 0.5; D0.g.rotation.z = 0.3 + Math.sin(tAcc * 2.3) * 0.12;
    const op = Math.min(win(p, 0.1, 0.18), 1 - win(p, 0.75, 0.85)); D0.g.visible = op > 0.01; D0.mats.forEach((m) => { m.opacity = op; m.depthWrite = op > 0.5; });
    D0.wake.position.set(q.x, WATERLINE + 0.04, q.z); D0.wake.scale.setScalar(1.5); D0.wake.material.opacity = op * 0.55; D0.wake.material.color.copy(cur.fog).lerp(WHITE, 0.85);
  }
  if (fx === 'sketch' || fx === 'ledger08') { ST.ledgerCover.rotation.z = 2.7 * easeIO(win(p, 0.06, 0.2)) * (1 - easeIO(win(p, 0.86, 0.96))); if (fx === 'sketch') ST.slip.visible = p > 0.24 && p < 0.8; }
  if (fx === 'newTag') { ST.drawer.position.z = ST.d / 2 + 0.16 + 0.14 * Math.sin(Math.PI * win(p, 0.06, 0.94)); const held = p > 0.3 && p < 0.78; story.held.visible = held; STORY.drawerTag.visible = !held; }
  if (fx === 'lens') { story.held.visible = p > 0.12 && p < 0.9; STORY.tower.k = STORY.tower.k0 - 0.5 * Math.sin(Math.PI * win(p, 0.22, 0.88)); }
  if (fx === 'rubSign') { const a = win(p, 0.1, 0.2), b = win(p, 0.2, 0.6); STORY.signPaper.material.opacity = 0.95 * Math.min(a, 1 - win(p, 0.8, 0.9)); if (b > 0.05 && !STORY.signPaper.material.map) { STORY.signPaper.material.map = rubTex; STORY.signPaper.material.needsUpdate = true; } STORY.signPaper.material.color.setScalar(1.25 - 0.25 * b); }
  if (fx === 'mulch') { story.held.visible = p > 0.18 && p < 0.5; STORY.sapling.wrap.visible = p >= 0.5; }
}
  // ---------- world marks: shown exactly as saved ----------
  function applyMarks() {
    MARKS.boulderStones.forEach((s, i) => { s.visible = i < worldMarks.boulderStones; });
    MARKS.jizoPebbles.forEach((s, i) => { s.visible = i < worldMarks.jizoPebbles; });
    const act = currentAction();
    const firstRest = act && act.kind === 'rest' && act.eventId === 'rest_bench_first';
    ST.towel.visible = worldMarks.towelLeft || (act && act.eventId === 'ev_umbrella_return' && actionProgress(act) > 0.5);
    ST.tea.visible = worldMarks.bench_tea_seen || firstRest;
    if (!(act && act.kind === 'event' && act.eventId === 'ev_signal_pull')) SIGNAL.arm.rotation.z = worldMarks.signalLowered ? 0.62 : -0.08;
    let umbOnStand = umbrellaSaved !== 'borrowed';
    if (act && act.kind === 'event' && act.eventId === 'ev_umbrella_borrow') umbOnStand = actionProgress(act) < 0.5;
    if (act && act.kind === 'event' && act.eventId === 'ev_umbrella_return') umbOnStand = actionProgress(act) > 0.5;
    ST.standUmb.visible = umbOnStand;
    // a core found right now keeps the drawer closed until its reveal has played
    const coreDue = act && act.eventId === 'rare_drawer_compass';
    const show = coreSaved && !coreDue && !(rare && rare.core);
    if (show !== coreTaken) { coreTaken = show; ST.drawer.position.z = ST.d / 2 + (coreTaken ? 0.16 : 0.02); }
    if (!(story && story.ev.effect === 'carving')) STORY.carve.pad.visible = !worldMarks.carvingSeen;
    if (!(story && story.ev.effect === 'newTag')) STORY.drawerTag.visible = coreTaken && worldMarks.drawerTagLeft;
    STORY.sapling.wrap.visible = saplingWrapped || !!(story && story.ev.effect === 'mulch' && actionProgress(act) >= 0.5);
  }
function eventEffect(ev, prog) {
  if (ev.effect === 'signalArm') SIGNAL.arm.rotation.z = -0.08 + 0.7 * easeIO(Math.min(1, Math.max(0, (prog - 0.35) / 0.25)));
  if (ev.effect === 'flowersWatered') CAN.rotation.z = -0.5 * Math.sin(Math.PI * Math.min(1, prog));
  if (ev.effect === 'umbrellaTake' && prog > 0.5) ST.standUmb.visible = false;
  if (ev.effect === 'umbrellaReturn' && prog > 0.5) { ST.standUmb.visible = true; ST.towel.visible = true; }
}
// ---------- departures (fixed 5 s) ----------
const DEPART = {};
// off-map legs carry their own height: the tunnel stays on the rail bed (it must not climb the hill), the boat leaves from its mooring and rides the east falls down
AREA.departures.forEach((d) => { const start = d.style === 'boat' ? BOAT.home.clone() : d.appearAt ? W(d.appearAt[0], d.appearAt[1], walkY(d.appearAt[0], d.appearAt[1])) : NODE[d.exitNode].p.clone(); const pts = [start].concat(d.offMap.map((q) => W(q[0], q[1], q.length > 2 ? q[2] : 0.34))); const curve = makeCurve(pts); DEPART[d.exit] = Object.assign({}, d, { curve, len: curve.getLength() }); });
function resetBoat() { BOAT.g.visible = true; BOAT.g.position.copy(BOAT.home); BOAT.g.rotation.set(0, BOAT.homeYaw, 0); BOAT.mats.forEach((m) => { m.transparent = false; m.opacity = 1; m.depthWrite = true; }); }
const veil = new T.Sprite(new T.SpriteMaterial({ map: mistTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false })); veil.scale.set(3, 2, 1); scene.add(veil);

  // ---------- traveller playback ----------
  const TR = { state: 'idle', heading: VIEW_FACE, phase: 0, dep: null, node: 'w_gate', rareId: -1, storyId: -1, statusKey: '' };
  const presentedRare = new Set();
  let primed = false;
  let depView = null;                        // the Area being left: { seed, seconds } for its sky during the departure
  const currentAction = () => (LOBBY || TR.state === 'depart' || !moss ? null : moss.action || null);
  const actionProgress = (a) => Math.max(0, Math.min(1, (sim - a.startSeconds) / Math.max(0.001, a.endSeconds - a.startSeconds)));
  function edgeCurve(a, b) { const hop = ADJ[a] && ADJ[a].find((h) => h.to === b); return hop ? (hop.dir === 'fwd' ? hop.E.fwd : hop.E.rev) : null; }
  // Walk along the saved plan: legEndSeconds are absolute effective seconds, so a late snapshot never
  // stalls the traveller at a crossing and a new plan for the same moment continues from the same spot.
  function walkAt(a, t) {
    const plan = a.plan && Array.isArray(a.plan.path) && a.plan.path.length > 1 && Array.isArray(a.plan.legEndSeconds) && a.plan.legEndSeconds.length === a.plan.path.length - 1 ? a.plan : null;
    const path = plan ? plan.path : a.route, ends = plan ? plan.legEndSeconds : [a.endSeconds];
    const dest = plan ? plan.destination : a.node;
    if (!path || path.length < 2 || !NODE[path[0]]) return { p: NODE[a.node] ? NODE[a.node].p.clone() : NODE.w_gate.p.clone(), tg: null, done: true, node: a.node, dest };
    let i = 0; while (i < ends.length - 1 && t >= ends[i]) i++;
    const t0 = i === 0 ? a.startSeconds : ends[i - 1], t1 = ends[i];
    const u = Math.max(0, Math.min(1, (t - t0) / Math.max(0.001, t1 - t0)));
    const c = edgeCurve(path[i], path[i + 1]);
    if (!c) return { p: NODE[path[i + 1]].p.clone(), tg: null, done: true, node: path[i + 1], dest };
    const done = i === ends.length - 1 && u >= 1;
    return { p: c.getPointAt(u), tg: c.getTangentAt(u), done, node: done ? path[path.length - 1] : path[i], dest };
  }
  const SHELTERS = new Set(AREA.shelters.nodes);
  const spotName = (id) => (SPOT[id] && SPOT[id].name) || (NODE[id] && NODE[id].label) || '';
  let statusMsg = '';
  function setStatus(msg) { if (!msg || msg === statusMsg) return; statusMsg = msg; try { opts.reportActivity(msg); } catch (_) {} }
  function statusFor(a) {
    const rain = wx.phase === 'rain', umb = umbrellaSaved === 'borrowed';
    if (a.kind === 'walk') {
      const dest = a.plan ? a.plan.destination : a.node;
      if (a.eventId && EV[a.eventId]) {
        if (a.eventId === 'ev_umbrella_borrow') return '下雨了，旅人往候車室門口的傘架走';
        if (a.eventId === 'ev_umbrella_return') return '雨停了，旅人把借來的傘拿回候車室';
        if (EV[a.eventId].shelter) return '雨下起來了，旅人往' + spotName(dest) + '躲雨';
        return (rain && umb ? '旅人撐著傘往' : rain ? '旅人冒雨往' : '旅人往') + spotName(dest) + '走去';
      }
      if (a.eventId && SEV[a.eventId]) return '旅人往' + spotName(dest) + '走去，似乎發現了什麼';
      if (a.eventId && REST[a.eventId]) return '五盞燈都亮了，旅人回到候車室的長椅';
      if (LAMP_AT[dest] !== undefined) return (rain ? '第 ' + (LAMP_AT[dest] + 1) + ' 盞燈的時間快到了，旅人冒雨往燈走去' : '第 ' + (LAMP_AT[dest] + 1) + ' 盞燈的時間快到了，旅人往燈的方向走');
      return (rain && !umb ? '旅人冒雨往' : '旅人往') + spotName(dest) + '走去';
    }
    if (a.kind === 'event') { const ev = EV[a.eventId]; return ev ? '旅人' + ev.name : SEV[a.eventId] ? '' : '旅人停下來看看四周'; }
    if (a.kind === 'rest') { const r = REST[a.eventId]; return r ? '旅人' + r.name : '旅人在長椅上休息'; }
    if (a.kind === 'lamp') return '旅人點亮第 ' + ((LAMP_AT[a.node] ?? 0) + 1) + ' 盞燈';
    if (a.kind === 'wait') {
      if (LAMP_AT[a.node] !== undefined && LAMP_AT[a.node] >= lampsLit) return rain && umb ? '旅人撐著傘在第 ' + (LAMP_AT[a.node] + 1) + ' 盞燈旁等著' : '旅人在第 ' + (LAMP_AT[a.node] + 1) + ' 盞燈旁等著';
      if (rain) return SHELTERS.has(a.node) ? '旅人在' + spotName(a.node) + '等雨小一點' : '雨打在帽簷上，旅人停下來看了看天色';
      return '旅人停下來看看四周';
    }
    return '';
  }
  // ambient moments while waiting (the prototype's anywhereEvents), picked by weather and time of day
  function waitPose(node) {
    const tod = timeOfDayAt(sim), key = tod.blend < 0.5 ? tod.from : tod.to, rain = wx.phase === 'rain';
    const list = AMBIENT.filter((e) => (!e.time || e.time.indexOf(key) >= 0) && (!e.weather || (e.weather === 'rain' ? rain : !rain)));
    const slot = Math.floor(tAcc / 9 + (IX[node] || 0) * 0.37);
    const e = list.length ? list[((slot % list.length) + list.length) % list.length] : null;
    return e ? e.anim : 'idle';
  }
  function syncRare(a) {
    const ev = a && a.kind === 'event' ? EV[a.eventId] : null;
    if (ev && ev.rare) {
      if (TR.rareId === a.id) return;
      endRare(); TR.rareId = a.id;
      // Reopened in the middle of a reveal: the saved item is already in the bag, so nothing replays.
      const late = !primed && sim - a.startSeconds > 3;
      if (!late && !presentedRare.has(a.id)) { presentedRare.add(a.id); startRare(ev, a.specifiedByCore); }
    } else if (TR.rareId !== -1) { endRare(); TR.rareId = -1; }
  }
  let cinematic = false;
  function syncStory(a) {
    const ev = a && a.kind === 'event' ? SEV[a.eventId] : null;
    if (ev && TR.storyId !== a.id) { endStory(); TR.storyId = a.id; startStory(ev); }
    else if (!ev && TR.storyId !== -1) { endStory(); TR.storyId = -1; }
    const next = !!(ev && ev.kind === 'opening');
    if (next !== cinematic) { cinematic = next; if (next) endDrag(); opts.reportCinematic(next); }
  }
  let lampsLit = litLampCount(reported, planned), lastLightsReport = -1;

  // ---------- departure: the start of the next Focus, never longer than the cue allows ----------
  const cue = opts.departure;
  const cueDuration = cue ? Math.min(DEPART_T, (cue.durationMs || 5000) / 1000) : DEPART_T;
  let swapAt = -1, departureReported = false;
  function finishDeparture() {
    if (!TR.dep || TR.dep.done) return;
    TR.dep.done = true;
    if (opts.departureOnly) {
      // Retain this exact departure frame until the next world has drawn.
      if (!departureReported) { departureReported = true; opts.reportDepartureComplete(); }
      return;
    }
    TR.state = 'idle'; depView = null;
    resetBoat(); readSnapshot(moss); lookPrimed = false;
    TR.node = moss && moss.action && NODE[moss.action.node] ? moss.action.node : 'w_gate';
    setStatus('旅人穿過霧，來到新的一段路');
    swapAt = sceneNow();
    if (!departureReported) { departureReported = true; try { opts.reportDepartureComplete(); } catch (_) {} }
  }
  function startDeparture(c, elapsedMs, leaving) {
    const X = DEPART[c.exit]; if (!X) return false;
    const from = c.route && c.route[0] && NODE[c.route[0]] ? c.route[0] : 'p_bench';
    depView = { seed: leaving && typeof leaving.weatherSeed === 'number' ? leaving.weatherSeed : 0, seconds: leaving && leaving.effectiveSeconds ? Math.max(leaving.effectiveSeconds, PLANNED) : PLANNED };
    if (leaving) readSnapshot(leaving);
    TR.node = from; TR.state = 'depart';
    const route = (c.route && c.route.length > 1 && routeFromIds(c.route)) || buildRoute(from, X.exitNode);
    TR.dep = { exit: c.exit, from, route, label: X.label, leaveMsg: X.leaveMsg, t: Math.max(0, elapsedMs / 1000), done: false, style: X.style, startWall: null };   // anchored on the first drawn frame (building the scene and compiling shaders must not eat the 5 s)
    Object.assign(pose, POSE.sit); const p = NODE[from].p; trav.position.set(p.x, travelY(p), p.z); TR.heading = VIEW_FACE;
    setStatus('新的一段專注開始了，旅人從長椅上起身，準備往' + X.label + '出發');
    return true;
  }
  function routeFromIds(ids) {
    for (let i = 0; i < ids.length; i++) if (!NODE[ids[i]]) return null;
    const cp = new T.CurvePath();
    for (let i = 0; i < ids.length - 1; i++) { const c = edgeCurve(ids[i], ids[i + 1]); if (!c) return null; cp.add(c); }
    return { curve: cp, len: cp.getLength(), ids };
  }
  readSnapshot(moss);
  if (opts.arriveFromMist && !LOBBY) swapAt = -2;   // the previous Area left through the mist: lift it here
  if (!(cue && !LOBBY && (opts.departureElapsedMs || 0) < cueDuration * 1000 && startDeparture(cue, opts.departureElapsedMs || 0, opts.departureState))) {
    if (moss && moss.action) TR.node = moss.action.node;
  }


  // ---------- camera ----------
  const BASE_EL = 31 * Math.PI / 180, BASE_AZ = Math.PI / 4;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  let yawOff = 0, pitchOff = 0, dragging = false, lastX = 0, lastY = 0;
  let lobbyPitch = 0;
  const HOME_T = target.clone();
  const DIR = { t: HOME_T.clone(), z: 1, el: 0, az: 0, on: true, snap: true, v: [0,0,0,0,0,0], key: null, cut: null };
  const cutCover = document.createElement('div');
  cutCover.setAttribute('aria-hidden', 'true');
  Object.assign(cutCover.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', zIndex: '1' });
  host.appendChild(cutCover);
  function lanternAt(ev, p) {
    const d = STORY.drift;
    if (ev.effect === 'driftRain') return d.west.getPointAt(win(p, 0.1, 0.85));
    const a = win(p, 0.06, 0.58), b = win(p, 0.58, 0.78);
    const u = b > 0 ? d.lipAt + (1 - d.lipAt) * Math.pow(b, 1.6) : d.lipAt * easeIO(a) * 0.999;
    return d.east.getPointAt(Math.min(0.999, u));
  }
  const anchors = { home: HOME_T.toArray(), traveller: [0,0,0], world: (u,v,y) => W(u,v,y).toArray(), lantern: (id,p) => lanternAt(SEV[id],p).toArray() };
  function snapShot(want) { DIR.t.fromArray(want.t); DIR.z = want.z; DIR.el = want.el; DIR.az = want.az; DIR.v.fill(0); }
  function stepDirector(dt) {
    if (LOBBY) return;
    anchors.traveller = trav.position.clone().add(V3(0,0.7,0)).toArray();
    const id = DIR.on && story ? story.ev.id : null, p = story ? story.p : 1;
    let want = dirShot(id, p, anchors, AREA.storyEvents);
    const keys = id && SEV[id].camera?.keys;
    const index = keys ? keyIndex(keys, p) : -1, key = id + ':' + index;
    if (DIR.snap || ((!id || p >= 1) && MOTION >= 1)) {
      if (MOTION < 1 && keys) want = dirShot(id, keys[index].p, anchors, AREA.storyEvents);
      snapShot(want); DIR.snap = false; DIR.key = key; DIR.cut = null;
    } else if (MOTION < 1) {
      // Moving anchors are sampled once per key. Replace continuous motion with a 0.4 s fade.
      if (DIR.key !== key) {
        DIR.key = key;
        DIR.cut = { at: sceneNow(), want: keys ? dirShot(id, keys[index].p, anchors, AREA.storyEvents) : want, applied: false };
      }
      if (DIR.cut) {
        const t = Math.max(0, (sceneNow() - DIR.cut.at) / 400);
        if (t >= 0.5 && !DIR.cut.applied) { snapShot(DIR.cut.want); DIR.cut.applied = true; }
        if (t >= 1) DIR.cut = null;
      }
    } else {
      DIR.key = key; DIR.cut = null;
      const values = [...DIR.t.toArray(), Math.log(DIR.z), DIR.el, DIR.az], goals = [...want.t, Math.log(want.z), want.el, want.az];
      values.forEach((value,i) => { [values[i],DIR.v[i]] = spring(value,DIR.v[i],goals[i],dt); });
      DIR.t.fromArray(values); DIR.z = Math.max(1,Math.min(12,Math.exp(values[3]))); DIR.el = values[4]; DIR.az = values[5];
    }
    cutCover.style.background = '#' + cur.fog.getHexString();
    cutCover.style.opacity = DIR.cut ? String(Math.sin(Math.PI * Math.min(1,(sceneNow()-DIR.cut.at)/400))) : '0';
    if (camera.zoom !== DIR.z) { camera.zoom = DIR.z; camera.updateProjectionMatrix(); }
  }
  function recoverCamera() { DIR.snap = true; primed = false; requestRedraw(500); }
  document.addEventListener('visibilitychange', recoverCamera);
  window.addEventListener('focus', recoverCamera);
  function placeCamera() {
    const el = BASE_EL + pitchOff + lobbyPitch + (LOBBY ? 0 : DIR.el * Math.PI / 180), az = BASE_AZ + yawOff + (LOBBY ? 0 : DIR.az * Math.PI / 180);
    const c = LOBBY ? target.clone() : DIR.t.clone();
    if (!LOBBY && DIR.z > 1) {
      // Compensate three.js's zoom of an asymmetric chrome frustum: keep the clear-band centre.
      const k = 1 - 1 / DIR.z;
      c.addScaledVector(V3(Math.cos(az),0,-Math.sin(az)), -(camera.left+camera.right)/2*k);
      c.addScaledVector(V3(-Math.sin(el)*Math.sin(az),Math.cos(el),-Math.sin(el)*Math.cos(az)), -(camera.top+camera.bottom)/2*k);
    }
    camera.position.set(c.x + DIST * Math.cos(el) * Math.sin(az), c.y + DIST * Math.sin(el), c.z + DIST * Math.cos(el) * Math.cos(az));
    camera.lookAt(c);
  }
  // The canvas runs under the Focus Active header and footer: the station is framed inside the clear band
  // between them (never enlarged into the text area); the sea of mist simply continues behind the glass.
  const chromeInsets = { top: 0, bottom: 0, right: 0, left: 0 };
  let anchorsDirty = true;
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    glass.setSize(w, h, renderer.getPixelRatio());
    requestRedraw(200);
    const insetTop = Math.min(h * 0.3, chromeInsets.top), insetBottom = Math.min(h * 0.2, chromeInsets.bottom * 0.5);
    const insetRight = Math.min(w * 0.46, chromeInsets.right);
    const sh = Math.max(120, h - insetTop - insetBottom), sw = Math.max(160, w - insetRight);
    anchorsDirty = true;
    if (LOBBY) { if (lobbyCam.kind === 'overview') frameLobby(w, h, insetTop, insetBottom, insetRight); else lobbyCameraStep(0, true); return; }
    const aspect = sw / sh;
    let vw = Math.max(40, 25.5 * aspect); if (aspect < 1) vw = 30;
    const vh = Math.max(vw / aspect, 25.5 * (aspect < 1 ? 1.2 : 1)); vw = vh * aspect;
    const k = vw / sw, cy = insetTop + sh / 2, cx = sw / 2;
    Object.assign(camera, { left: -cx * k, right: (w - cx) * k, top: cy * k, bottom: -(h - cy) * k }); camera.updateProjectionMatrix();
  }
  let lobbyBox = null;
  function lobbyBounds() {
    if (lobbyBox) return lobbyBox;
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    cam.position.set(target.x + DIST * Math.cos(BASE_EL) * Math.sin(BASE_AZ), target.y + DIST * Math.sin(BASE_EL), target.z + DIST * Math.cos(BASE_EL) * Math.cos(BASE_AZ));
    cam.lookAt(target); cam.updateMatrixWorld();
    const pts = IDS.map((id) => NODE[id].p.clone());
    [[-22, 0.9], [-9.4, -10.4], [16.8, -4.6], [13.5, 8], [-10.4, 14.5]].forEach(([u, v]) => pts.push(W(u, v, walkY(u, v)), W(u, v, walkY(u, v) + 3)));
    Object.values(DEPART).forEach((X) => { for (let i = 0; i <= 6; i++) pts.push(X.curve.getPointAt(0.6 * i / 6)); });
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
  canvas.addEventListener('pointerdown', (e) => { if (isPaused() || cinematic) return; dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.classList.add('dragging'); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; yawOff = Math.max(-1.1, Math.min(1.1, yawOff - (e.clientX - lastX) * 0.006)); pitchOff = Math.max(-0.3, Math.min(0.5, pitchOff + (e.clientY - lastY) * 0.004)); lastX = e.clientX; lastY = e.clientY; });
  const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  // ---------- lobby: where the traveller rests, the next routes, new finds ----------
  const lampNode = (k) => AREA.lamps[k].node;
  function lobbyRestNode() { return lampsLit >= 5 ? 'p_bench' : lampsLit > 0 ? lampNode(lampsLit - 1) : 'w_gate'; }
  // Each exit gets one trail of small lantern marks from the rest spot to where the exit leaves the Area.
  const trails = {};
  const TRAIL_COL = { selected: new T.Color(0xe9b25a), hover: new T.Color(0xe6efe9), available: new T.Color(0xcfe2dd), none: new T.Color(0xcfe2dd) };
  const TRAIL_LVL = { selected: 1, hover: 0.78, available: 0.55, none: 0 };
  let trailGeo = null, trailMat = null;
  const trailTmp = new T.Color(), trailObj = new T.Object3D();
  function trailFor(exit) {
    if (trails[exit]) return trails[exit];
    if (!trailGeo) { trailGeo = new T.CircleGeometry(0.1, 12); trailGeo.rotateX(-Math.PI / 2); }
    if (!trailMat) trailMat = new T.MeshBasicMaterial({ color: 0xffffff, fog: true });
    const pts = [];
    const sample = (curve, from, to, skipFirst) => {
      const n = Math.max(2, Math.round(curve.getLength() * (to - from) / 0.42));
      for (let i = skipFirst ? 1 : 0; i <= n; i++) pts.push(curve.getPointAt(from + (to - from) * i / n));
    };
    raining = false;
    if (exit === 'entry') { const r = buildRoute('entry0', 'w_top'); if (r) sample(r.curve, 0.3, 1); }
    else if (DEPART[exit]) {
      const X = DEPART[exit]; const r = buildRoute(lobbyRestNode(), X.exitNode);
      if (r) sample(r.curve, 0.035, 1);
      sample(X.curve, 0, X.style === 'boat' ? 0.2 : 0.7, true);
    }
    if (pts.length < 2) return null;
    pts.forEach((p) => { const [u, v] = toUV(p.x, p.z); p.y = Math.max(p.y, travelY(p)); if (!(u === u)) p.y = p.y; });
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
  // New finds rest on the platform beside the bench; React pins a label to each ('item:<key>' anchors).
  const ITEM_SPOTS = [[1.1, -0.6], [-1.1, -0.5], [0.25, -1.3]];
  const lobbyItems = [];
  function setItems(list) {
    lobbyItems.forEach((it) => { scene.remove(it.g); delete ANCHOR_WORLD['item:' + it.key]; });
    lobbyItems.length = 0;
    const rest = NODE[lobbyRestNode()];
    (Array.isArray(list) ? list : []).slice(0, ITEM_SPOTS.length).forEach((entry, i) => {
      if (!entry || !entry.key) return;
      const u = rest.u + ITEM_SPOTS[i][0], v = rest.v + ITEM_SPOTS[i][1];
      const at = W(u, v, walkY(u, v));
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
  // Lobby camera: 'close' on the traveller, 'look' easing toward one exit, 'overview' the whole Area.
  const CLOSE = { width: 11, pitch: -0.2, cy: 0.46 };
  const lobbyCam = { kind: 'close', exit: null, from: null, to: null, t: 1, dur: 1.2, cur: null };
  function lobbyShot(kind, exit) {
    const rest = NODE[lobbyRestNode()].p;
    if (kind === 'look' && exit && DEPART[exit]) {
      const far = DEPART[exit].curve.getPointAt(DEPART[exit].style === 'boat' ? 0.12 : 0.35);
      const f = rest.clone().lerp(far, 0.5); f.y += 0.6;
      return { fx: f.x, fy: f.y, fz: f.z, width: Math.max(18, Math.min(34, rest.distanceTo(far) * 1.25 + 6)), pitch: -0.12, cy: 0.36 };
    }
    const f = rest.clone(); f.y += 1.0;
    return { fx: f.x, fy: f.y, fz: f.z, width: CLOSE.width, pitch: CLOSE.pitch, cy: CLOSE.cy };
  }
  const easeCam = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lobbyFocus = new T.Vector3();
  function lobbyCameraStep(dt, force) {
    if (lobbyCam.kind === 'overview') return;
    if (!lobbyCam.cur) { lobbyCam.cur = lobbyShot(lobbyCam.kind, lobbyCam.exit); lobbyCam.t = 1; }
    if (lobbyCam.t < 1) {
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
  // Screen positions (CSS px from the host's top-left) the lobby pins its route markers to.
  const ANCHOR_WORLD = {};
  function setAnchorWorld() {
    const up = new T.Vector3(0, 0.55, 0);
    Object.keys(DEPART).forEach((key) => { ANCHOR_WORLD[key] = DEPART[key].curve.getPointAt(DEPART[key].style === 'boat' ? 0.05 : 0.3).add(up); });
    ANCHOR_WORLD.entry = NODE.w_gate.p.clone().add(up);
    ANCHOR_WORLD.rest = NODE[lobbyRestNode()].p.clone().add(new T.Vector3(0, 1.8, 0));
  }
  setAnchorWorld();
  // The lobby's saved progress moved the rest spot (bench / last lamp / entry): re-aim the camera, anchors and trails.
  let lobbyRestShown = lobbyRestNode();
  function lobbyRefresh() {
    const rest = lobbyRestNode(); if (rest === lobbyRestShown) return;
    lobbyRestShown = rest; setAnchorWorld();
    const levels = {}; Object.keys(trails).forEach((k) => { levels[k] = trails[k].level; scene.remove(trails[k].mesh); delete trails[k]; });
    Object.keys(levels).forEach((k) => { const tr = trailFor(k); if (tr) tr.level = levels[k]; });
    if (lobbyItems.length) setItems(lobbyItems.map((it) => ({ key: it.key })));
    if (lobbyCam.kind !== 'overview') { lobbyCam.cur = null; lobbyCam.t = 1; lobbyCameraStep(0, true); }
    anchorsDirty = true; requestRedraw(600);
  }
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
  const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  function faceFor(spotId, ev) {
    const f = (ev && ev.face) || (SPOT[spotId] && SPOT[spotId].face) || 'view';
    if (f === 'view' || !NODE[spotId]) return VIEW_FACE;
    const n = NODE[spotId].p; const t = W(f[0], f[1], 0); return Math.atan2(t.x - n.x, t.z - n.z);
  }
  let lastPhase = null;
  function update(dt) {
    const wind = (0.55 + 0.3 * Math.sin(tAcc * 0.13) + 0.25 * Math.max(0, Math.sin(tAcc * 0.37 + 1.3)) + wx.rain * 0.35) * hush;
    tAcc += dt * MOTION;
    timeU.value = tAcc; windU.value = wind;
    const now = sceneNow();
    // effective time: re-anchored by setProgress(); between ticks it runs on for at most 1.5 s
    playing = !LOBBY && now - lastIncreaseAt < 2600;
    sim = playing && !isPaused() ? reported + Math.min(1.5, (now - reportedAt) / 1000) : reported;
    const lookSeconds = TR.state === 'depart' && depView ? depView.seconds : sim;
    wx = weatherAt(weatherSeed(), lookSeconds);
    raining = wx.phase === 'rain';
    if (lastPhase !== null && wx.phase !== lastPhase && TR.state !== 'depart' && !LOBBY) {
      if (wx.phase === 'rain') setStatus('下雨了');
      else if (lastPhase === 'rain') setStatus('雨停了，葉子上還在滴水');
    }
    lastPhase = wx.phase;
    // lamps are saved-time milestones (the same value the HUD uses), never the traveller's gesture
    const dueNow = TR.state === 'depart' ? 5 : litLampCount(reported, planned);
    lampsLit = dueNow;
    if (dueNow !== lastLightsReport && TR.state !== 'depart') { lastLightsReport = dueNow; try { opts.reportLights(dueNow); } catch (_) {} }
    if (TR.state === 'depart') {
      const Dp = TR.dep; if (Dp.startWall === null && framesDrawn > 0) Dp.startWall = now - Dp.t * 1000; const before = Dp.t; if (Dp.startWall !== null) Dp.t = Math.max(Dp.t, (now - Dp.startWall) / 1000);
      const at = (x) => before < x && Dp.t >= x;
      if (at(0.7)) setStatus('旅人背好行囊，扶正帽子');
      if (at(1.3)) setStatus('旅人往' + Dp.label + '的方向走，霧慢慢圍了上來');
      if (at(2.5)) setStatus(Dp.leaveMsg);
      if (Dp.t >= cueDuration - 0.06) { finishDeparture(); if (opts.departureOnly) return; }
    }

    // ----- traveller placement -----
    let p, moving = false, want = TR.heading, animKey = 'idle', prog = 0, fade = 1, onSeat = false, curveY = false, boatRide = false, walkSpeed = 0.95;
    const a = currentAction();
    syncRare(a);
    syncStory(a);
    if (TR.state === 'depart') {
      const Dp = TR.dep, t = Dp.t, X = DEPART[Dp.exit];
      if (t < 1.3) { p = NODE[Dp.from].p.clone(); want = VIEW_FACE; animKey = t < 0.7 ? 'sit' : 'shoulder'; prog = Math.min(1, Math.max(0, (t - 0.7) / 0.6)); }
      else if (t < 2.4 && Dp.route) { const u = Math.min(1, ((t - 1.3) / 1.1) * (1.5 / Dp.route.len)); p = Dp.route.curve.getPointAt(u); const tg = Dp.route.curve.getTangentAt(u); want = Math.atan2(tg.x, tg.z); animKey = 'walk'; moving = true; walkSpeed = 1.36; fade = 1 - Math.min(1, Math.max(0, (t - 1.8) / 0.5)); }
      else if (X.style === 'boat') {
        // seated in the punt: cast off, drift to the lip, then slide down the falls into the mist
        const k = Math.min(1, Math.max(0, (t - 2.5) / 2.5)); const LIP = 0.2;
        const u = k < 0.42 ? LIP * easeIO(k / 0.42) * 0.98 : LIP * 0.98 + (1 - LIP * 0.98) * Math.pow((k - 0.42) / 0.58, 1.7);
        const bp = X.curve.getPointAt(Math.min(0.999, u)), tg = X.curve.getTangentAt(Math.min(0.999, u));
        BOAT.g.position.copy(bp); BOAT.g.position.y += Math.sin(tAcc * 2.2) * 0.015 * (1 - k);
        const look = bp.clone().add(V3(tg.x, tg.y * (u < LIP ? 0 : 0.8), tg.z)); BOAT.g.lookAt(look);
        boatRide = true; p = BOAT.g.localToWorld(BOAT.seat.clone()); animKey = 'sit';
        fade = t < 2.5 ? 0 : Math.min(1, (t - 2.5) / 0.35) * (1 - Math.min(1, Math.max(0, (t - 4.15) / 0.75)));
        const bf = t < 4.15 ? 1 : Math.max(0, 1 - (t - 4.15) / 0.75); BOAT.mats.forEach((m) => { m.transparent = bf < 0.999; m.opacity = bf; m.depthWrite = bf > 0.4; }); BOAT.g.visible = bf > 0.01; BOAT.glowM.emissiveIntensity = 1.2 * bf; BOAT.light.intensity = 0.9 * bf;
      }
      else { const k = Math.min(1, Math.max(0, (t - 2.5) / 2.5)); const u = X.style === 'tunnel' ? 0.85 * k : 0.02 + 0.7 * k; p = X.curve.getPointAt(u); const tg = X.curve.getTangentAt(u); want = Math.atan2(tg.x, tg.z); animKey = 'walk'; moving = t < cueDuration; walkSpeed = X.len * (X.style === 'tunnel' ? 0.85 : 0.7) / 2.5 / 0.95; fade = t < 2.5 ? 0 : Math.min(1, (t - 2.5) / 0.35) * (1 - Math.min(1, Math.max(0, (t - (X.style === 'tunnel' ? 3.9 : 4.2)) / 0.9))); if (t < 2.5) TR.heading = want; curveY = true; }
      const vt = Dp.t; veil.material.opacity = (vt > 1.4 && vt < 3.3 ? Math.sin(Math.PI * Math.min(1, (vt - 1.4) / 1.9)) : 0) * 0.8;
      if (vt < 2.4 && Dp.route) veil.position.copy(Dp.route.curve.getPointAt(Math.min(1, 1.5 / Dp.route.len))).add(V3(0, 0.5, 0)); else veil.position.copy(X.curve.getPointAt(0.05)).add(V3(0, 0.5, 0));
      veil.material.color.copy(cur.fog).lerp(WHITE, 0.5);
    } else {
      veil.material.opacity = 0;
      if (LOBBY || !a) {
        // lobby (time held) or nothing saved yet: resting on the bench, or waiting at the last lit lamp
        const node = LOBBY ? lobbyRestNode() : (moss && moss.action && NODE[moss.action.node] ? moss.action.node : lampsLit >= 5 ? 'p_bench' : NODE[TR.node] ? TR.node : 'w_gate');
        p = NODE[node].p.clone(); TR.node = node;
        if (node === 'p_bench') { animKey = Math.floor(tAcc / 40) % 3 === 2 ? 'write' : 'sitGaze'; onSeat = true; want = VIEW_FACE; }
        else { animKey = waitPose(node); want = LAMP_AT[node] !== undefined ? headingTo(p, R.lamps[LAMP_AT[node]].g.position) : VIEW_FACE; }
        if (LOBBY && lobbyCam.kind === 'look' && lobbyCam.exit && ANCHOR_WORLD[lobbyCam.exit]) want = TR.heading;
      } else if (a.kind === 'walk') {
        const wlk = walkAt(a, sim);
        p = wlk.p; TR.node = wlk.node;
        if (wlk.tg) want = Math.atan2(wlk.tg.x, wlk.tg.z);
        moving = playing && !wlk.done;
        const rain = wx.phase === 'rain';
        animKey = !moving ? 'idle' : rain && umbrellaSaved === 'borrowed' ? 'umbrellaWalk' : rain ? 'hurry' : 'walk';
        walkSpeed = rain && umbrellaSaved !== 'borrowed' ? 1.25 : 0.95;
      } else {
        const node = NODE[a.node] ? a.node : TR.node;
        p = NODE[node].p.clone(); TR.node = node;
        prog = actionProgress(a);
        if (a.kind === 'event') {
          const ev = EV[a.eventId], sev = SEV[a.eventId];
          if (ev) {
            animKey = ev.rare ? (rare ? (prog < 0.5 ? SRC_POSE[ev.source] : prog < 0.88 ? 'hold' : 'idle') : 'idle') : (a.anim || ev.anim);
            want = faceFor(node, ev);
            eventEffect(ev, prog);
            if (rare) rareUpdate(prog);
            if (animKey === 'sitDoor') { p = WAGON.seat.clone(); want = WAGON.yaw; }
            onSeat = SPOT[node] && SPOT[node].seat === 'bench' && /^sit|write|drinkSit/.test(animKey);
          } else if (sev && story) {
            animKey = phaseAnim(sev, prog); want = faceFor(node, sev);
            if (animKey === 'sitDoor') { p = WAGON.seat.clone(); want = WAGON.yaw; }
            storyUpdate(prog);
            if (story.look) want = headingTo(p, story.look);
          }
        } else if (a.kind === 'rest') {
          const r = REST[a.eventId];
          animKey = r ? r.anim : 'sitGaze'; want = VIEW_FACE;
          if (animKey === 'sequence') { animKey = prog < 0.22 ? 'inspect' : prog < 0.55 ? 'drinkSit' : 'write'; want = prog < 0.22 ? headingTo(p, ST.tea.getWorldPosition(V3(0, 0, 0))) : VIEW_FACE; }
          if (animKey === 'sitEdge') want = faceFor('p_edge');
          onSeat = node === 'p_bench' && animKey !== 'inspect';
        } else if (a.kind === 'lamp') {
          animKey = 'light'; const k = LAMP_AT[node]; if (k !== undefined) want = headingTo(p, R.lamps[k].g.position);
        } else {
          // waiting: at the next lamp it faces the lamp; elsewhere small moments (stretch, clouds, the pack, the hat)
          const k = LAMP_AT[node];
          animKey = wx.phase === 'rain' && umbrellaSaved === 'borrowed' && !SHELTERS.has(node) ? 'umbrella' : waitPose(node);
          want = k !== undefined ? headingTo(p, R.lamps[k].g.position) : TR.heading;
          prog = (tAcc % 9) / 9;
        }
      }
      if (!LOBBY && a && !(a.kind === 'event' && SEV[a.eventId])) { const msg = statusFor(a); if (msg) setStatus(msg); }
      else if (LOBBY) setStatus(lampsLit >= 5 ? '旅人坐在候車室的長椅上休息' : '旅人在路上停下來，等你回來');
    }
    const gy = a && a.kind === 'event' && animKey === 'sitDoor' ? WAGON.seat.y : (curveY || boatRide) ? p.y : travelY(p);
    trav.position.set(p.x, gy, p.z);
    if (boatRide) { trav.quaternion.copy(BOAT.g.quaternion); TR.heading = trav.rotation.y; }
    else { TR.heading = lerpAngle(TR.heading, want, !primed ? 1 : 1 - Math.exp(-dt * 5)); trav.rotation.set(0, TR.heading, 0); }
    if (moving) TR.phase += walkSpeed * dt * 9;
    const baseKey = animKey === 'umbrellaWalk' ? 'umbrella' : animKey;
    const tgt = Object.assign({ hip: 0, legX: 0, lean: 0, headX: 0, headY: 0, armL: 0, armLz: 0, staffX: 0, staffZ: 0, book: 0, lie: 0, cup: 0 }, POSE[baseKey] || {});
    const tt = tAcc;
    if (animKey === 'pickup') { const s = Math.sin(Math.PI * prog); Object.assign(tgt, { hip: -0.2 * s, legX: -0.9 * s, lean: 0.5 * s, headX: 0.4 * s, armL: -1.0 * s }); }
    if (animKey === 'stretch') { const s = 0.5 + 0.5 * Math.sin(tAcc * 0.8); Object.assign(tgt, { armL: -2.9 * s, staffX: -0.25 * s, headX: -0.3 * s }); }
    if (animKey === 'light') tgt.staffX = Math.sin(Math.PI * prog) * 0.9;
    if (animKey === 'gaze' || animKey === 'sitGaze' || animKey === 'idle' || animKey === 'sitDoor') tgt.headY = Math.sin(tAcc * 0.35) * (animKey === 'idle' ? 0.35 : 0.5);
    if (animKey === 'write') tgt.armLz = Math.sin(tt * 5) * 0.08;
    if (animKey === 'reach') tgt.armL += Math.sin(tt * 2) * 0.15;
    if (animKey === 'chop') { const c = Math.sin(tt * 3.2); Object.assign(tgt, { armL: -2.2 + 1.6 * Math.max(0, -c), lean: 0.2 * Math.max(0, -c), headX: 0.3 }); }
    if (animKey === 'balance') { tgt.armLz = -1.1 + Math.sin(tt * 2.1) * 0.2; tgt.lean = Math.sin(tt * 1.7) * 0.06; }
    if (animKey === 'shoulder') Object.assign(tgt, { armL: -2.4 * Math.sin(Math.PI * prog), headX: -0.1, staffX: 0.1 });
    if (LOBBY && lobbyCam.kind === 'look' && lobbyCam.exit && ANCHOR_WORLD[lobbyCam.exit]) {
      let d = headingTo(trav.position, ANCHOR_WORLD[lobbyCam.exit]) - TR.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      tgt.headY = Math.max(-1.1, Math.min(1.1, d)); tgt.headX = -0.15;
    }
    if (onSeat) tgt.hip = 0.12;
    const kk = !primed ? 1 : 1 - Math.exp(-dt * (TR.state === 'depart' ? 9 : 5));
    PKEYS.forEach((key) => { pose[key] += (tgt[key] - pose[key]) * kk; });
    const swing = moving ? Math.sin(TR.phase) * 0.55 : 0, bob = moving ? Math.abs(Math.sin(TR.phase)) * 0.035 : 0;
    body.position.y = pose.hip + bob; body.rotation.x = -pose.lie * Math.PI / 2; upper.rotation.x = pose.lean;
    const dangle = animKey === 'sitEdge' || animKey === 'sitDoor';
    legL.rotation.x = pose.legX + swing + (dangle ? Math.sin(tAcc * 1.6) * 0.15 : 0); legR.rotation.x = pose.legX - swing + (dangle ? Math.sin(tAcc * 1.6 + 1.3) * 0.15 : 0);
    head.rotation.x = pose.headX; head.rotation.y = pose.headY; armL.rotation.x = pose.armL; armL.rotation.z = pose.armLz;
    armR.rotation.x = -0.35 + pose.staffX * 0.8; staff.rotation.x = pose.staffX; staff.rotation.z = pose.staffZ; cloak.rotation.z = swing * 0.07;
    book.visible = pose.book > 0.5; cup.visible = pose.cup > 0.5;
    umb.visible = umbrellaSaved === 'borrowed' && raining && TR.state !== 'depart' && !LOBBY && a && (a.kind === 'walk' || a.kind === 'wait' || a.kind === 'lamp') && !(a.kind === 'wait' && SHELTERS.has(a.node)) && fade > 0.5;
    if (story?.held) { story.held.position.copy(trav.localToWorld(V3(-0.1,0.62,0.3))); story.held.rotation.y = trav.rotation.y; }
    trav.visible = fade > 0.01; if (Math.abs(fade - lastFade) > 0.001) { setTravOpacity(fade); lastFade = fade; }

    // ----- sky -----
    const key = blendState(timeOfDayAt(lookSeconds), wx.overcast, dt);
    scene.background.copy(cur.bg); scene.fog.color.copy(cur.fog); scene.fog.near = DIST + cur.near; scene.fog.far = DIST + cur.far;
    sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(target).addScaledVector(cur.sunAt, 70); sun.target.position.copy(target);
    hemi.color.copy(cur.hS); hemi.groundColor.copy(cur.hG); hemi.intensity = cur.hI;
    glowWin.emissiveIntensity = 0.95 * cur.win; R.interior.forEach((q) => { q.l.intensity = q.k * cur.win; });
    // Keep light membership stable when the traveller/boat fades out. Removing a parent
    // from visibility changes the light count and recompiles every StandardMaterial on Windows.
    travLight.position.copy(staff.localToWorld(V3(0, 0.46, 0.13)));
    BOAT.light.position.copy(BOAT.g.localToWorld(V3(-0.22, 0.95, -0.47)));
    travLight.intensity = 0.8 * Math.min(1.4, cur.lamp) * lastFade; travHalo.material.opacity = Math.min(0.45, cur.lamp * 0.3) * lastFade; travGlowMat.emissiveIntensity = 0.6 + 0.6 * Math.min(1, cur.lamp);
    const mistCol = cur.fog.clone().lerp(WHITE, 0.45);
    R.mists.forEach((q) => { q.sp.material.color.copy(mistCol); q.sp.material.opacity = q.base * cur.mist * (0.85 + 0.15 * Math.sin(tAcc * 0.5 + q.ph)); q.sp.position.copy(q.p0).add(W(Math.sin(tAcc * 0.05 + q.ph) * 1.2, Math.cos(tAcc * 0.04 + q.ph) * 0.4, 0)); });
    const layerCol = cur.fog.clone().lerp(cur.cloud, 0.25);
    R.layers.forEach((L) => { L.m.color.copy(layerCol).lerp(WHITE, 0.04 * L.i); L.m.alphaMap.offset.set(tAcc * L.sp[0], tAcc * L.sp[1]); });
    R.ridges.forEach((q) => { q.m.color.copy(q.c).lerp(cur.fog, q.k); });
    R.shafts.forEach((q) => { q.m.opacity = cur.shaft * (0.8 + 0.2 * Math.sin(tAcc * 0.4 + q.ph)); q.m.color.copy(cur.sun).lerp(WHITE, 0.5); });
    if (!(TR.state === 'depart' && TR.dep && TR.dep.style === 'boat' && TR.dep.t >= 2.5) && BOAT.g.visible && BOAT.mats[0].opacity === 1) { BOAT.g.position.y = BOAT.home.y + Math.sin(tAcc * 1.3) * 0.012 + boatNudge; BOAT.g.rotation.z = Math.sin(tAcc * 0.9) * 0.02; BOAT.glowM.emissiveIntensity = 0.5 + 0.9 * Math.min(1, cur.lamp); BOAT.light.intensity = 0.25 * Math.max(0, cur.lamp - 0.6); }
    R.waterfalls.forEach((m) => { m.map.offset.y = (m.map.offset.y + dt * 0.6 * MOTION) % 1; m.color.copy(cur.fog).lerp(WHITE, 0.7); });
    R.smokes.forEach((q) => { const t = (tAcc * 0.08 + q.ph) % 1; q.sp.position.copy(q.base).add(V3(t * 0.8 * wind, t * 3.2, -t * 0.3)); q.sp.scale.setScalar(0.5 + t * 1.6); q.sp.material.opacity = 0.32 * Math.sin(Math.PI * t) * (1 - wx.rain * 0.6); q.sp.material.color.copy(cur.fog).lerp(WHITE, 0.55); });
    M.water.color.setHex(0x587876).lerp(cur.fog, 0.25);
    // ----- wet surfaces, rain -----
    applyWet(wx.wet);
    RAIN_FX.streaks.uniforms.uTime.value = tAcc; RAIN_FX.streaks.uniforms.uRain.value = wx.rain; RAIN_FX.streaks.uniforms.uColor.value.copy(cur.fog).lerp(WHITE, key === 'night' ? 0.2 : 0.6); RAIN_FX.streaks.uniforms.uOpacity.value = key === 'night' ? 0.25 : 0.33;
    RAIN_FX.puddleMat.color.copy(cur.bg).lerp(WHITE, key === 'night' ? 0.03 : 0.12); RAIN_FX.puddleMat.opacity = wx.wet * (key === 'night' ? 0.4 : 0.45);
    RAIN_FX.rings.forEach((q) => { const t = (tAcc * q.sp + q.ph) % 1; q.m.scale.setScalar(0.4 + t * 1.8); q.m.material.opacity = wx.rain * 0.4 * (1 - t); });
    RAIN_FX.drips.forEach((d) => { d.base.forEach((b, i) => { const t = (tAcc * b.sp * 0.9 + b.ph) % 1; d.pos[i * 3] = b.q.x; d.pos[i * 3 + 1] = b.q.y - t * t * b.len; d.pos[i * 3 + 2] = b.q.z; }); d.pts.geometry.attributes.position.needsUpdate = true; d.m.opacity = Math.min(1, wx.wet * 1.3) * 0.75; });
    STONE_MESHES.slice(0, 4).forEach((s, i) => { s.position.y = Math.max(H(STONES[i][0], STONES[i][1]), WATERLINE) + 0.02 - 0.18 * wx.rain; });
    // ----- lamps: driven by effective time, not by the traveller -----
    const rareP = rare && a ? actionProgress(a) : 0;
    R.lamps.forEach((L, i) => { const tgt2 = i < lampsLit ? 1 : 0; L.level += (tgt2 - L.level) * (primed ? 1 - Math.exp(-dt * 3) : 1); const fl = 1 + (Math.sin(tAcc * 7.3 + i * 2) * 0.03 + Math.sin(tAcc * 13.1 + i) * 0.02) * MOTION; const flash = rare && rare.core ? 1 + 0.9 * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (rareP - 0.33) / 0.3)))) : 1; const dayK = Math.max(0, 1 - cur.lamp); L.glow.emissiveIntensity = L.level * (1.3 + 1.1 * dayK) * fl * flash; L.light.intensity = L.level * Math.max(cur.lamp, 0.75) * 1.1 * fl * flash; L.halo.material.opacity = L.level * Math.min(1, cur.lamp) * 0.55 * flash; L.dayHalo.material.opacity = L.level * Math.min(0.85, dayK * 1.3) * fl * Math.min(1.4, flash); });
    // ----- world motion -----
    const sway = wind * MOTION;
    R.ferns.forEach((q) => { q.o.rotation.x = Math.sin(tAcc * 1.1 + q.ph) * q.amp * sway; q.o.rotation.z = Math.sin(tAcc * 0.8 + q.ph * 1.7) * q.amp * 0.7 * sway; });
    R.crowns.forEach((q) => { q.o.rotation.z = Math.sin(tAcc * 0.7 + q.ph) * q.amp * sway; q.o.rotation.x = Math.sin(tAcc * 0.5 + q.ph * 1.7) * q.amp * 0.6 * sway; });
    R.chimes.forEach((q) => { q.g.rotation.z = Math.sin(tAcc * 0.9 + q.ph) * 0.05 * sway; q.bell.rotation.z = Math.sin(tAcc * 2.3 + q.ph) * 0.18 * sway; q.tz.rotation.x = Math.sin(tAcc * 3.1 + q.ph) * 0.5 * sway; q.tz.rotation.z = Math.sin(tAcc * 2.2 + q.ph) * 0.3 * sway; });
    const wFoam = WF.foam, wDeep = WF.deep; { const lum = (cur.bg.r + cur.bg.g + cur.bg.b) / 3; wFoam.copy(cur.fog).lerp(WHITE, 0.28 + 0.55 * lum); wDeep.copy(cur.fog).lerp(WF.teal, 0.55).multiplyScalar(0.78 + 0.3 * lum); }
    stepDirector(dt);
    const pxPerUnit = renderer.domElement.height / ((camera.top - camera.bottom) / camera.zoom);
    WATERS.forEach((m) => { const U = m.uniforms; U.uTime.value = tAcc; U.uFoam.value.copy(wFoam); U.uDeep.value.copy(wDeep); U.uRain.value = wx.rain; if (U.uPx) U.uPx.value = pxPerUnit; });
    FOAM.base.forEach((b, i) => { const st = b.sp * dt * MOTION * (1 + wx.rain); if (b.east) { b.t -= st; if (b.t < 0) b.t = SPLIT - rr(0, 0.02); } else { b.t += st; if (b.t > 1) b.t = SPLIT + rr(0, 0.02); } const q = brookCurve.getPointAt(b.t); const tg = brookCurve.getTangentAt(b.t); const w = W(q.x - tg.z * b.off, q.z + tg.x * b.off, WATERLINE + 0.02); FOAM.pos[i * 3] = w.x; FOAM.pos[i * 3 + 1] = w.y; FOAM.pos[i * 3 + 2] = w.z; }); FOAM.pts.geometry.attributes.position.needsUpdate = true; FOAM.m.color.copy(cur.fog).lerp(WHITE, 0.6);
    FIRE.m.opacity = cur.fire * (1 - wx.rain) * (0.75 + 0.25 * Math.sin(tAcc * 1.7)); FIRE.pts.visible = FIRE.m.opacity > 0.01;
    if (FIRE.pts.visible) { FIRE.base.forEach((b, i) => { FIRE.pos[i * 3] = b.x + Math.sin(tAcc * b.sp + b.ph) * 0.6; FIRE.pos[i * 3 + 1] = b.y + Math.sin(tAcc * b.sp * 1.3 + b.ph * 2) * 0.35; FIRE.pos[i * 3 + 2] = b.z + Math.cos(tAcc * b.sp * 0.8 + b.ph) * 0.6; }); FIRE.pts.geometry.attributes.position.needsUpdate = true; }
    applyMarks();
    if (LOBBY) { trailsUpdate(dt); itemsUpdate(); }
    // soft cover over the swap from the departure to the new route
    {
      let o = 0;
      if (swapAt === -2) { o = 1; if (framesDrawn > 0) swapAt = now; }
      if (TR.state === 'depart') o = Math.min(1, Math.max(0, (TR.dep.t - (cueDuration - 0.55)) / 0.5));
      else if (swapAt > 0) { o = 1 - Math.min(1, (now - swapAt) / 650); if (o <= 0) swapAt = -1; }
      // A cross-map source stays visible while the destination compiles. React fades in the ready map.
      cover.style.opacity = opts.departureOnly ? '0' : o.toFixed(3);
      cover.style.background = '#' + cur.fog.getHexString();
    }
    if (!dragging) { const q = Math.exp(-dt * 2.6); yawOff *= q; pitchOff *= q; }
    placeCamera();
    if (LOBBY) lobbyCameraStep(dt, false);
  }
  const WF = { foam: new T.Color(), deep: new T.Color(), teal: new T.Color(0x46625f) };
  const clock = new T.Clock();
  let raf = 0, disposed = false, lastDrawAt = 0, framesDrawn = 0, lastFrameAt = performance.now();
  let programsReady = !!opts.manualFrames;
  if (!programsReady) void renderer.compileAsync(scene, camera, () => disposed).then(() => disposed ? undefined : glass.prepare(() => disposed)).then(() => { if (!disposed) programsReady = true; }).catch(error => { console.error('苔痕驛站材質載入失敗', error); programsReady = true; });
  const glassDeep = new T.Color();
  function frame(scheduleNext = true) {
    if (!programsReady) { lastFrameAt = performance.now(); if (scheduleNext !== false) raf = requestAnimationFrame(frame); return; }
    if (disposed || (opts.departureOnly && departureReported)) return;
    if (performance.now() - lastFrameAt > 250) DIR.snap = true;
    lastFrameAt = performance.now();
    // The lobby can stay open for a long time: while the camera is at rest it draws at ~30 fps.
    if (LOBBY && !dragging && Math.abs(yawOff) + Math.abs(pitchOff) < 0.002) {
      const t = performance.now();
      if (t - lastDrawAt < 30) { if (scheduleNext !== false) raf = requestAnimationFrame(frame); return; }
      lastDrawAt = t;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const frozen = isPaused();
    // A scene created already paused runs one zero-length update so it shows the saved state, then stands still.
    if (!frozen || !primed) { update(frozen ? 0 : dt); primed = true; }
    // Cross-map playback ends here. Do not compile/draw a new pose in the old world while React swaps it.
    if (opts.departureOnly && TR.dep && TR.dep.done) return;
    if (LOBBY) reportAnchorsIfMoved();
    if (framesDrawn < 2 || !frozen || performance.now() < redrawUntil) {
      const lum = (cur.bg.r + cur.bg.g + cur.bg.b) / 3;
      glassDeep.copy(cur.fog).multiplyScalar(0.2);
      glass.render(scene, camera, dt, glassDeep, [0.34 + 0.08 * lum, 0.23 + 0.05 * lum, 0.05 + 0.05 * lum], frozen);
      framesDrawn++;
      if (framesDrawn === 2) opts.reportReady?.();   // the first draw compiles every shader; the departure clock starts after it
    }
    if (scheduleNext !== false) raf = requestAnimationFrame(frame);
  }
  // manualFrames: headless QA draws only on renderNow(); the app always runs the loop.
  if (!opts.manualFrames) raf = requestAnimationFrame(frame);
  // Windows can stop RAF completely when minimized: one timer keeps the same pause-aware frame going (~30 fps).
  const backgroundFrameTimer = opts.manualFrames ? 0 : setInterval(() => { if (!disposed && performance.now() - lastFrameAt >= 30) frame(false); }, 33);

  function setMossState(s) {
    if (!s) return;
    if (Math.abs(s.effectiveSeconds - sim) > 2) recoverCamera();
    moss = s;
    if (TR.state !== 'depart') readSnapshot(s);
    if (typeof s.effectiveSeconds === 'number' && !LOBBY) {
      const v = Math.max(0, s.effectiveSeconds);
      if (v > reported + 0.001) { const t = sceneNow(); reported = v; reportedAt = t; lastIncreaseAt = t; }
    } else if (LOBBY && typeof s.effectiveSeconds === 'number') { reported = Math.max(0, s.effectiveSeconds); sim = reported; lampsLit = litLampCount(reported, planned); lobbyRefresh(); }
    anchorsDirty = true; requestRedraw(400);
  }
  return {
    areaId: MOSS_SCENE_AREA_ID,
    setMossState,
    setPaused(paused) {
      const want = !!paused;
      if (want === isPaused()) return;
      if (want) { pausedAtReal = performance.now(); endDrag(); primed = false; }
      else { pausedTotalMs += performance.now() - pausedAtReal; pausedAtReal = -1; clock.getDelta(); }
      requestRedraw(1600);
    },
    renderNow() { lastDrawAt = 0; requestRedraw(120); frame(false); },
    enterLobby(nextHost, nextOptions) {
      if (disposed) throw new Error('Cannot reuse a disposed scene');
      if (resizeObserver) resizeObserver.unobserve(host);
      delete host.dataset.glass;
      host = nextHost;
      host.appendChild(canvas); host.appendChild(cover); host.appendChild(cutCover); host.dataset.glass = 'scene';
      if (resizeObserver) resizeObserver.observe(host);
      Object.assign(opts, nextOptions, { mode: 'lobby', departure: null,
        reportActivity: nextOptions.reportActivity || (() => {}), reportAnchors: nextOptions.reportAnchors || (() => {}),
        reportWorldMark: nextOptions.reportWorldMark || (() => {}), reportLights: nextOptions.reportLights || (() => {}),
        reportDepartureComplete: nextOptions.reportDepartureComplete || (() => {}) });
      LOBBY = true; endStory(); TR.storyId = -1; camera.zoom = 1; camera.updateProjectionMatrix(); cutCover.style.opacity = '0';
      if (isPaused()) { pausedTotalMs += performance.now() - pausedAtReal; pausedAtReal = -1; }
      clock.getDelta();
      glass.jumpPaused(false); glass.setUiFade(1);
      glass.setChrome({ top: 0, bottom: 0, left: 0, right: 0, cards: [] });
      Object.assign(chromeInsets, { top: 0, bottom: 0, left: 0, right: 0 });
      endDrag(); yawOff = 0; pitchOff = 0; swapAt = -1; cover.style.opacity = '0';
      if (TR.state === 'depart') { TR.dep.done = true; TR.state = 'idle'; depView = null; resetBoat(); }
      endRare(); TR.rareId = -1;
      planned = Math.max(60, opts.targetSeconds || PLANNED);
      if (opts.moss) { moss = opts.moss; readSnapshot(moss); }
      reported = Math.max(0, Number(opts.progressSeconds) || (moss ? moss.effectiveSeconds : 0) || 0); sim = reported; reportedAt = sceneNow();
      lampsLit = litLampCount(reported, planned); lobbyRestShown = lobbyRestNode(); setAnchorWorld(); statusMsg = '';
      Object.keys(trails).forEach((k) => { scene.remove(trails[k].mesh); delete trails[k]; });
      Object.assign(lobbyCam, { kind: opts.lobbyView && opts.lobbyView.kind === 'overview' ? 'overview' : 'close', exit: null, cur: null, t: 1 });
      anchorsDirty = true; resize(); requestRedraw(1600);
    },
    setUiFade(opacity) { glass.setUiFade(opacity); requestRedraw(1800); },
    setChrome(chrome) {
      const top = Math.max(0, Number(chrome && chrome.top) || 0), bottom = Math.max(0, Number(chrome && chrome.bottom) || 0);
      const right = Math.max(0, Number(chrome && chrome.right) || 0), left = Math.max(0, Number(chrome && chrome.left) || 0);
      glass.setChrome(chrome); requestRedraw(700);
      if (Math.abs(top - chromeInsets.top) > 0.5 || Math.abs(bottom - chromeInsets.bottom) > 0.5 || Math.abs(right - chromeInsets.right) > 0.5 || Math.abs(left - chromeInsets.left) > 0.5) {
        chromeInsets.top = top; chromeInsets.bottom = bottom; chromeInsets.right = right; chromeInsets.left = left; resize();
      }
    },
    /** Saved world state: the core flag also arrives with every moss snapshot. */
    setWorldState(state) { if (state && typeof state.coreTaken === 'boolean') coreSaved = state.coreTaken; },
    /** Area 02 plays finds from the saved action itself (the event carries the chosen reveal). */
    playSpecialFind() {},
    setProgress(progressSeconds) {
      const v = Math.max(0, Number(progressSeconds) || 0);
      const t = sceneNow();
      if (Math.abs(v - sim) > 2) recoverCamera();
      if (LOBBY) { reported = v; sim = v; reportedAt = t; lampsLit = litLampCount(reported, planned); lobbyRefresh(); return; }
      if (v > reported + 0.001) { lastIncreaseAt = t; reported = v; reportedAt = t; return; }
      if (v < reported - 0.5) { reported = v; reportedAt = t; }
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
    setLobbyView(view) { if (LOBBY) setView(view); },
    setLobbyItems(list) { if (LOBBY) setItems(list); },
    setReducedMotion(reduced) { MOTION = reduced ? 0.25 : 1; recoverCamera(); },
    setDirectorEnabled(on) { DIR.on = !!on; recoverCamera(); },
    snapCamera() { recoverCamera(); },
    /** Headless QA only (manualFrames): advance the scene clock without drawing. */
    qaStep(dt) { if (opts.manualFrames) { framesDrawn++; update(Math.max(0, Number(dt) || 0)); primed = true; } },
    debugState() {
      const a = currentAction();
      return { area: MOSS_SCENE_AREA_ID, mode: LOBBY ? 'lobby' : 'focus', sim: +sim.toFixed(2), reported, playing, state: TR.state, node: TR.node,
        action: a ? { id: a.id, kind: a.kind, node: a.node, eventId: a.eventId, start: a.startSeconds, end: a.endSeconds, plan: a.plan ? a.plan.path.length : 0 } : null,
        weather: { phase: wx.phase, rain: +wx.rain.toFixed(2), overcast: +wx.overcast.toFixed(2), wet: +wx.wet.toFixed(2) }, lampsLit, umbrella: umbrellaSaved, coreSaved, coreTaken,
        rare: rare ? { id: rare.ev.id, core: rare.core } : null,
        story: story ? { id: story.ev.id, p: story.p, cinematic } : null,
        director: { on: DIR.on, t: DIR.t.toArray(), z: DIR.z, el: DIR.el, az: DIR.az, velocity: DIR.v.slice(), cut: !!DIR.cut },
        camera: { zoom: camera.zoom, position: camera.position.toArray(), frustum: [camera.left,camera.right,camera.top,camera.bottom] },
        lantern: { visible: STORY.drift.g.visible, position: STORY.drift.g.position.toArray(), projected: STORY.drift.g.position.clone().project(camera).toArray() },
        farLights: STORY.far.filter(sp => sp.visible).length, status: statusMsg,
        trav: { x: +trav.position.x.toFixed(2), y: +trav.position.y.toFixed(2), z: +trav.position.z.toFixed(2), visible: trav.visible },
        departure: TR.dep ? { exit: TR.dep.exit, t: +TR.dep.t.toFixed(2), done: TR.dep.done } : null, marks: Object.assign({}, worldMarks),
        lobbyCam: LOBBY ? { kind: lobbyCam.kind, exit: lobbyCam.exit, t: lobbyCam.t } : null, trails: Object.keys(trails), items: lobbyItems.map((it) => it.key),
        draws: renderer.info.render.calls, tris: renderer.info.render.triangles,
        edgeLengths: opts.manualFrames ? EDGES.map((edge) => ({ a: edge.a, b: edge.b, length: edge.len })) : undefined };
    },
    destroy() {
      disposed = true;
      document.removeEventListener('visibilitychange', recoverCamera); window.removeEventListener('focus', recoverCamera); cutCover.remove();
      clearInterval(backgroundFrameTimer);
      cancelAnimationFrame(raf);
      if (resizeObserver) resizeObserver.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => { if (m.map) m.map.dispose(); if (m.alphaMap) m.alphaMap.dispose(); m.dispose(); });
      });
      glass.dispose();
      renderer.dispose();
      delete host.dataset.glass;
      canvas.remove(); cover.remove();
    }
  };
}
