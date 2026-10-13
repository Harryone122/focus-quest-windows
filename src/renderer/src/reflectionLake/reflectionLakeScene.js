import * as T from '../cloudRuins/vendor/three.module.js';
import AREA from '../../../../docs/area03/area-03-reflection-lake.scene.json';
import { createEdgeGlass } from '../cloudRuins/edgeGlass.js';
import { frameDue, shouldRender } from '../framePacing.js';
import groundPixels from './groundPixels.base64.txt?raw';
// Exact fixed shoreline pixels baked from the accepted procedural scene.
const groundBytes = Uint8Array.from(atob(groundPixels.trim()), c => c.charCodeAt(0));

export function createReflectionLakeScene(host, options) {
let opts = {...options}; let paused = !!opts.paused, lobby = opts.mode === 'lobby', dead = false; let lake = opts.lake || null; let savedProgress = opts.progressSeconds || 0, lastProgressAt = performance.now(); let S4_HANDLES = {}, holdCam = false;
const realDocument = globalThis.document;
const canvasHost = realDocument.createElement('canvas'); canvasHost.className = 'cloud-ruins-canvas reflection-lake-canvas'; canvasHost.style.cssText = 'width:100%;height:100%;display:block'; host.appendChild(canvasHost);
const uiNodes = new Map();
// Prototype-only controls stay detached: the shipped App owns all interaction.
const document = { createElement: realDocument.createElement.bind(realDocument), createTextNode: realDocument.createTextNode.bind(realDocument), querySelectorAll: () => [], body: realDocument.createElement('div'), getElementById(id) { if (id === 'scene') return canvasHost; if (!uiNodes.has(id)) uiNodes.set(id, realDocument.createElement('div')); return uiNodes.get(id); } };
const statusEl = document.getElementById('status');
if (!T) { statusEl.textContent = '3D 函式庫載入失敗，請重新整理頁面。'; return; }

const Q = new URLSearchParams(location.search);
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let MOTION = opts.reducedMotion || reduceMotion ? 0.25 : 1;
let TIDE_SEED = lake?.seed || opts.seed || 20260930;
const REFL_TEST = Q.get('reflTest') === '1';

// ---------- math & noise ----------
let seed = 43;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
const S = Math.SQRT1_2;
const W = (u, v, y) => new T.Vector3(u * S - v * S, y || 0, -u * S - v * S);
const toUV = (x, z) => [(x / S - z / S) / 2, (-z / S - x / S) / 2];
const rotY = (phi) => phi + Math.PI / 4;   // an angle in the (u, v) plane -> yaw of a mesh in the scene
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sm5 = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
const nz = (u, v) => Math.sin(u * 0.83 + v * 0.31) * Math.cos(v * 0.67 - u * 0.27) * 0.5 + Math.sin(u * 1.9 - v * 1.3 + 1.7) * 0.25;
const V3 = (x, y, z) => new T.Vector3(x, y, z);
const fract = (x) => x - Math.floor(x);
const h3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
const easeIO = (x) => x * x * (3 - 2 * x);
const headingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
function segDist(u, v, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy))); const x = a[0] + dx * t - u, y = a[1] + dy * t - v; return Math.sqrt(x * x + y * y); }
function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- time presets ----------
const PRE = {
  dawn:  { skyTop: 0xe9c7bd, haze: 0xf6e6da, cloud: 0xfff3ec, sun: 0xffd9c0, sunI: 0.7,  sunAt: [-26, 3.5, 9], hS: 0xf3e4da, hG: 0x8f8579, hI: 0.6, cloudAmt: 0.64, star: 0,    bot: 0.85, lamp: 0.6, fogN: 6, fogF: 46, hazeLo: 0.80, glint: 0.35 },
  day:   { skyTop: 0x6fb0e3, haze: 0xd6ebf6, cloud: 0xffffff, sun: 0xfff6e6, sunI: 0.72, sunAt: [-15, -6, 22],  hS: 0xdcebf6, hG: 0x8c9187, hI: 0.58, cloudAmt: 0.74, star: 0,   bot: 1.0,  lamp: 0.35, fogN: 8, fogF: 50, hazeLo: 0.80, glint: 1.0 },
  dusk:  { skyTop: 0xe79a67, haze: 0x9a86b3, cloud: 0xf4c7a4, sun: 0xf2a06a, sunI: 0.85, sunAt: [26, 7, 7],    hS: 0xd9b0a8, hG: 0x5d5668, hI: 0.55, cloudAmt: 0.62, star: 0.12, bot: 0.7,  lamp: 1.0, fogN: 6, fogF: 44, hazeLo: 0.55, glint: 0.4 },
  night: { skyTop: 0x0d1a2f, haze: 0x1e2f4a, cloud: 0x27364e, sun: 0xc4d3ec, sunI: 0.62, sunAt: [9, 17, 13],  hS: 0x5d7098, hG: 0x18202f, hI: 0.78, cloudAmt: 0.42, star: 1,    bot: 0.35, lamp: 1.6, fogN: 6, fogF: 44, hazeLo: 0.999, glint: 0.0 }
};
const COLOR_KEYS = ['skyTop', 'haze', 'cloud', 'sun', 'hS', 'hG'];
const NUM_KEYS = ['sunI', 'hI', 'cloudAmt', 'star', 'bot', 'lamp', 'fogN', 'fogF', 'hazeLo', 'glint'];
const toState = (p) => { const s = {}; COLOR_KEYS.forEach((k) => { s[k] = new T.Color(p[k]); }); NUM_KEYS.forEach((k) => { s[k] = p[k]; }); s.sunAt = W(p.sunAt[0], p.sunAt[1], p.sunAt[2]).normalize(); return s; };
const STATES = {}; Object.keys(PRE).forEach((k) => { STATES[k] = toState(PRE[k]); });
const cur = toState(PRE.dawn);
const P0 = PRE.day;

// ---------- renderer ----------
const canvas = document.getElementById('scene');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!Q.get('qa') });
const glass = createEdgeGlass(renderer); host.dataset.glass = 'scene';
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.info.autoReset = false;
const scene = new T.Scene();
scene.background = new T.Color(P0.haze);
const DIST = 80;
scene.fog = new T.Fog(P0.haze, DIST + P0.fogN, DIST + P0.fogF);

const mat = (c, e) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.95, metalness: 0, flatShading: true }, e || {}));
// materials that get wet: dry and wet colours from the spec (SPEC 6), one variant per multiplier
const WETM = [];
function wetMat(dryHex, wetHex, k, extra) { const m = mat(dryHex, extra); const dry = new T.Color(dryHex).multiplyScalar(k), wet = new T.Color(wetHex).multiplyScalar(k); m.color.copy(dry); WETM.push({ m, dry, wet, r: m.roughness }); return m; }
const STONE_K = [0.97, 1.0, 1.03, 0.94];
const M = {
  stone: STONE_K.map((k) => wetMat(0xc9c3b6, 0x8f8b81, k)),
  stoneG: wetMat(0xc9c3b6, 0x8f8b81, 1, { vertexColors: true }),
  mud: [0.97, 1.03].map((k) => wetMat(0x9d9076, 0x6f6552, k)),
  mudG: wetMat(0x9d9076, 0x6f6552, 1, { vertexColors: true }),
  stoneHi: mat(0xc9c3b6), stoneHi2: mat(0xbdb7aa), stoneStain: mat(0xa59f92), stoneDark: mat(0x9d998f),
  rock: [mat(0xa7a398), mat(0x9a968c), mat(0xb0ab9f), mat(0x8f8b82)],
  reed: mat(0xb9b07a), reed2: mat(0x8c8a55),
  pine: mat(0x3f5e4c), pine2: mat(0x4a6a55), pine3: mat(0x36523f), bark: mat(0x5a4a3c),
  wood: mat(0x7a6a5a), woodD: mat(0x5d5045), woodL: mat(0x8a7a68), tile: mat(0x4e5560), tile2: mat(0x585f6a),
  hull: mat(0x857866), hullIn: mat(0x6d6153),
  // traveller (same materials as 苔痕驛站)
  woodDark: mat(0x564436), tWood: mat(0x7d624a), cloak: mat(0x3d4659), hat: mat(0xb49c70), skin: mat(0xe0d2c0, { flatShading: false }), paper: mat(0xe9e1cf)
};

// ---------- 潮痕帶 (SPEC 2.5): one world-height based tint shared by every stone / wood material ----------
function tmark(m, o) {
  o = o || {}; const K = (o.k === undefined ? 0.75 : o.k).toFixed(2), ALL = o.all ? '1.0' : '0.0', GRN = (o.green || 0).toFixed(2);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vTmY; varying float vTmNy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vTmY = (modelMatrix * vec4(transformed, 1.0)).y; vTmNy = normalize(mat3(modelMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTmY; varying float vTmNy;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' +
        ' { float vert = ' + ALL + ' > 0.5 ? 1.0 : 1.0 - smoothstep(0.5, 0.9, abs(vTmNy));\n' +
        '   float inb = 1.0 - smoothstep(0.296, 0.306, vTmY);\n' +
        '   float g = clamp(1.0 - vTmY / 0.30, 0.0, 1.0);\n' +
        '   vec3 tint = mix(vec3(0.74, 0.75, 0.66), vec3(0.50, 0.60, 0.49), g);\n' +
        '   diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tint, inb * vert * ' + K + ');\n' +
        '   float ln = 1.0 - smoothstep(0.0, 0.022, abs(vTmY - 0.305));\n' +
        '   diffuseColor.rgb *= 1.0 - 0.16 * ln * vert * ' + K + ';\n' +
        '   float gr = clamp((0.34 - vTmY) / 0.5, 0.0, 1.0) * ' + GRN + ';\n' +
        '   diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.42, 0.34) * (0.8 + 0.3 * diffuseColor.r), gr * 0.65); }');
  };
  m.customProgramCacheKey = () => 'tm' + K + ALL + GRN;
  return m;
}
[].concat(M.stone, M.rock, [M.stoneHi, M.stoneHi2, M.stoneStain, M.stoneDark, M.wood, M.woodD, M.woodL]).forEach((m) => tmark(m));
tmark(M.stoneG, { k: 0.5 });
M.iron = mat(0x2f2c2a); M.tile3 = mat(0x3d434d); M.tile4 = mat(0x666e7a);
// the puddles (SPEC 2.5): a flat plane that only shows the sky colour, not the reflection texture
const PUD = new T.MeshBasicMaterial({ color: 0x8fbbe0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

const shadowy = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
const mesh = (geo, m, parent, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); (parent || scene).add(o); return o; };
const dyn = (o) => { o.userData.dyn = true; return o; };
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return new T.CanvasTexture(c); };
const haloTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,160,1)'); g.addColorStop(0.35, 'rgba(255,180,100,0.35)'); g.addColorStop(1, 'rgba(255,160,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });

// ---------- lights ----------
const hemi = new T.HemisphereLight(P0.hS, P0.hG, P0.hI); scene.add(hemi);
const sun = new T.DirectionalLight(P0.sun, P0.sunI);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

const R = { crowns: [], reeds: [], faders: [] };

// =====================================================================
// tide (SPEC 4.1): a pure function of (seed, effective seconds)
// =====================================================================
const WL_LOW = 0.0, WL_HIGH = 0.30;
const TIDE_RISE = 90, TIDE_HOLD = 360, TIDE_FALL = 90, TIDE_LEN = TIDE_RISE + TIDE_HOLD + TIDE_FALL, DRY_S = 240;
function tideEvents(sd, upTo) {
  const r = (k) => mulberry((sd ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0)();
  const ev = [{ s: 660 + r(1) * 1200 }];                                  // guaranteed: starts in [660, 1860]
  if (r(2) < 0.5) ev.push({ s: 2400 + r(3) * 300 });                      // second: 50%, starts in [2400, 2700]
  for (let k = 0; 3000 + 1200 * k <= upTo; k++) if (r(10 + 2 * k) < 0.5) ev.push({ s: 3000 + 1200 * k + r(11 + 2 * k) * 300 });
  ev.forEach((e) => { e.e = e.s + TIDE_LEN; });
  return ev;
}
function tideAt(sd, sec) {
  const t = Math.max(0, sec); const ev = tideEvents(sd, t);
  let level = 0, phase = 'low', lastEnd = -1;
  ev.forEach((e) => {
    const u = t - e.s; let l = 0, ph = 'low';
    if (u > 0 && u < TIDE_LEN) {
      if (u < TIDE_RISE) { l = sm5(u / TIDE_RISE); ph = 'rising'; }
      else if (u < TIDE_RISE + TIDE_HOLD) { l = 1; ph = 'high'; }
      else { l = 1 - sm5((u - TIDE_RISE - TIDE_HOLD) / TIDE_FALL); ph = 'falling'; }
    }
    if (l > level || (l === level && l > 0 && phase === 'low')) { level = l; phase = ph; }   // overlapping events: the higher one wins
    if (t >= e.e) lastEnd = Math.max(lastEnd, e.e);
  });
  const wet = level > 0 ? 1 : (lastEnd >= 0 ? Math.max(0, 1 - (t - lastEnd) / DRY_S) : 0);
  return { level, phase, wet };
}

// =====================================================================
// land: features shared by the meshes and the baked depth map (SPEC 2)
// =====================================================================
const BOTTOM = -0.55, DEEP = -1.5, HMIN = -1.6, HMAX = 0.6;
const sdBox = (u, v, cu, cv, hu, hv) => { const du = Math.abs(u - cu) - hu, dv = Math.abs(v - cv) - hv; return Math.hypot(Math.max(du, 0), Math.max(dv, 0)) + Math.min(Math.max(du, dv), 0); };
const sdDisc = (u, v, cu, cv, r) => Math.hypot(u - cu, v - cv) - r;
const sdHex = (u, v, cu, cv, ap) => { const x = u - cu, y = v - cv; let m = -1e9; for (let i = 0; i < 6; i++) { const a = (i * 60 + 30) * Math.PI / 180; m = Math.max(m, x * Math.cos(a) + y * Math.sin(a) - ap); } return m; };
const sdCap = (u, v, a, b, w) => segDist(u, v, a, b) - w / 2;
const FE = [];
const addF = (sd, top, edge, col, bb) => { const f = { sd, top, edge, col: new T.Color(col), bb }; FE.push(f); return f; };
const feH = (f, u, v) => { const sd = f.sd(u, v); const top = typeof f.top === 'function' ? f.top(u, v) : f.top; return sd <= 0 ? top : (sd >= f.edge ? BOTTOM : top + (BOTTOM - top) * sstep(0, f.edge, sd)); };
const C_STONE = 0xb2ada1, C_MUD = 0x8d8068, C_ROCK = 0x98948a;

// -- 蘆葦洲 (reed island), a mud bank with three tide pools on its south rim
const RI = { c: [-13, -2], a: 4.6, b: 3.0, rot: 0.22 };
const POOLS = [[-14.7, -4.15, 0.75], [-12.4, -4.55, 0.85], [-10.5, -3.7, 0.6]];
function reedR(u, v) { const x = u - RI.c[0], y = v - RI.c[1]; const cr = Math.cos(RI.rot), sr = Math.sin(RI.rot); const X = (x * cr + y * sr) / RI.a, Y = (-x * sr + y * cr) / RI.b; const ang = Math.atan2(Y, X); const w = 1 + 0.10 * Math.sin(ang * 3 + 0.7) + 0.06 * Math.sin(ang * 5 + 2.1) + 0.05 * nz(u * 0.6, v * 0.6); return Math.hypot(X, Y) / w; }
function reedTop(u, v) { const r = reedR(u, v); let h = 0.06 + 0.16 * Math.pow(Math.max(0, 1 - r), 0.6); for (const p of POOLS) { const d = Math.hypot(u - p[0], v - p[1]); if (d < p[2]) h = Math.min(h, -0.09 + 0.15 * sstep(0, p[2], d)); } return h; }
const LOBE = { c: [-14.6, -0.1], a: 1.6, b: 1.2 };   // a small spit toward the stranded boat
const lobeR = (u, v) => Math.hypot((u - LOBE.c[0]) / LOBE.a, (v - LOBE.c[1]) / LOBE.b);
const F_REED = addF((u, v) => Math.min((reedR(u, v) - 1) * 2.4, (lobeR(u, v) - 1) * 1.2), (u, v) => Math.max(reedTop(u, v), 0.06 + 0.12 * Math.pow(Math.max(0, 1 - lobeR(u, v)), 0.6)), 1.0, C_MUD, [-19, -7, -6.5, 2.5]);

// -- 中央石庭 (SPEC 2.4): an irregular two-level courtyard. lower court top 0.12, upper terrace (north-west) top 0.20
function sdPoly(u, v, P) { let d = (u - P[0][0]) * (u - P[0][0]) + (v - P[0][1]) * (v - P[0][1]), s = 1; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], wx = u - P[i][0], wy = v - P[i][1]; const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey))); const bx = wx - ex * t, by = wy - ey * t; d = Math.min(d, bx * bx + by * by); const c1 = v >= P[i][1], c2 = v < P[j][1], c3 = ex * wy > ey * wx; if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s; } return s * Math.sqrt(d); }
const COURT = [[-5.0, -3.55], [-4.6, -3.55], [-4.5, -4.0], [-3.4, -4.1], [-3.3, -3.85], [-2.2, -3.95], [-2.1, -4.2], [-0.3, -4.2], [-0.1, -4.15], [-0.1, -3.15], [1.5, -3.2], [1.5, -4.1], [2.6, -4.2], [2.7, -3.9], [3.0, -4.0], [4.8, -4.05], [4.9, -3.85], [5.3, -3.3], [5.8, -2.6], [5.7, -1.2], [5.85, -0.3], [5.75, 1.7], [5.5, 2.2], [5.75, 2.9], [4.65, 3.05], [4.55, 4.15], [3.5, 4.2], [2.4, 4.15], [1.7, 4.25], [-0.6, 4.25], [-1.4, 4.05], [-2.6, 4.2], [-3.8, 3.95], [-4.3, 4.1], [-5.2, 3.5], [-5.5, 2.8], [-5.75, 1.4], [-5.8, -1.5], [-5.5, -2.7], [-5.0, -2.9]];
const UPPER = [[-4.6, 0.2], [-3.0, -0.15], [-1.9, -0.18], [-0.6, -0.25], [1.1, 0.15], [1.25, 1.0], [1.3, 1.6], [1.15, 2.4], [1.2, 3.3], [0.6, 3.9], [-1.2, 3.95], [-2.6, 3.8], [-4.1, 3.9], [-4.55, 2.6], [-4.6, 1.2]];
const BITE = { u0: -0.1, u1: 1.5, v0: -4.2, v1: -3.15 };   // the broken south rim: water, with a few slabs sunk in it
const STEPS2 = [{ c: [-1.2, -0.55], h: [0.55, 0.33] }, { c: [1.45, 0.60], h: [0.35, 0.55] }];   // the two 1-step drops between the levels, top 0.16
const courtSD = (u, v) => sdPoly(u, v, COURT), upperSD = (u, v) => sdPoly(u, v, UPPER);
addF(courtSD, 0.12, 0.15, C_STONE, [-5.85, 5.85, -4.3, 4.3]);
addF(upperSD, 0.20, 0.10, 0xc9c3b6, [-4.7, 1.4, -0.3, 4.0]);
STEPS2.forEach((st) => addF((u, v) => sdBox(u, v, st.c[0], st.c[1], st.h[0], st.h[1]), 0.16, 0.08, C_STONE, [st.c[0] - st.h[0] - 0.2, st.c[0] + st.h[0] + 0.2, st.c[1] - st.h[1] - 0.2, st.c[1] + st.h[1] + 0.2]));
addF((u, v) => sdBox(u, v, (BITE.u0 + BITE.u1) / 2, (BITE.v0 + BITE.v1) / 2, (BITE.u1 - BITE.u0) / 2 - 0.05, (BITE.v1 - BITE.v0) / 2), -0.10, 0.25, C_STONE, [BITE.u0 - 0.4, BITE.u1 + 0.4, BITE.v0 - 0.4, BITE.v1 + 0.4]);

// -- 亭台
const PAV = { c: [2.0, 11.0], R: 1.7, plat: 2.4 };
addF((u, v) => sdHex(u, v, PAV.c[0], PAV.c[1], PAV.plat * Math.cos(Math.PI / 6)), 0.12, 0.15, C_STONE, [-0.4, 4.4, 8.6, 13.4]);

// -- causeways (top 0.18) and their little piers
const CW = [[[-9.4, -1.2], [-5.6, -0.2]], [[0.4, 4.1], [1.6, 9.0]], [[5.6, 0.6], [7.2, 1.25]]];
CW.forEach((s) => addF((u, v) => sdCap(u, v, s[0], s[1], 1.0), 0.18, 0.12, C_STONE, [Math.min(s[0][0], s[1][0]) - 0.6, Math.max(s[0][0], s[1][0]) + 0.6, Math.min(s[0][1], s[1][1]) - 0.6, Math.max(s[0][1], s[1][1]) + 0.6]));

// -- 沉階: 9 steps down into the water; tops are chosen so that 4 show at low tide and 1 at high tide
const STEP0 = [3.9, -3.7], STEP1 = [5.4, -6.0], NSTEPS = 9, STEP_W = 1.5, STEP_D = 0.36;
const STEP_DIR = (() => { const dx = STEP1[0] - STEP0[0], dy = STEP1[1] - STEP0[1], L = Math.hypot(dx, dy); return [dx / L, dy / L, L]; })();
const stepTop = (k) => 0.34 - 0.10 * k;
const stepPos = (k) => [STEP0[0] + STEP_DIR[0] * STEP_DIR[2] * k / (NSTEPS - 1), STEP0[1] + STEP_DIR[1] * STEP_DIR[2] * k / (NSTEPS - 1)];
for (let k = 0; k < NSTEPS; k++) { const p = stepPos(k); const ang = Math.atan2(STEP_DIR[1], STEP_DIR[0]); const ca = Math.cos(ang), sa = Math.sin(ang); addF((u, v) => { const x = u - p[0], y = v - p[1]; const a = x * ca + y * sa, b = -x * sa + y * ca; return sdBox(a, b, 0, 0, STEP_D / 2, STEP_W / 2); }, stepTop(k), 0.1, C_STONE, [p[0] - 1.2, p[0] + 1.2, p[1] - 1.2, p[1] + 1.2]); }

// -- stepping stones
const STONES = [];
function chain(pts, gap, r0, r1, k0, k1, top) {
  const segs = []; let L = 0; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push([pts[i], pts[i + 1], d]); L += d; }
  const n = Math.max(1, Math.round(L / gap)); const out = [];
  for (let i = 0; i <= n; i++) { let d = L * i / n; let s = 0; while (s < segs.length - 1 && d > segs[s][2]) { d -= segs[s][2]; s++; } const q = segs[s]; const t = q[2] ? d / q[2] : 0; const f = i / n; out.push({ u: q[0][0] + (q[1][0] - q[0][0]) * t, v: q[0][1] + (q[1][1] - q[0][1]) * t, r: r0 + (r1 - r0) * f, k: k0 + (k1 - k0) * f, top: top || 0.16 }); }
  return out;
}
const addStones = (list) => list.forEach((s) => { STONES.push(s); addF((u, v) => sdDisc(u, v, s.u, s.v, s.r), s.top, 0.1, C_STONE, [s.u - s.r - 0.3, s.u + s.r + 0.3, s.v - s.r - 0.3, s.v + s.r + 0.3]); });
// entry (from the pale haze on the left), exit A (through the arch), exit B (east), south, and the two that climb onto 松岩
addStones(chain([[-24.6, -4.85], [-21, -4.5], [-17.6, -3.4]], 1.42, 0.3, 0.44, 0.9, 0.12));
addStones(chain([[-0.4, 12.2], [-3.4, 13.8]], 0.78, 0.44, 0.44, 0.02, 0.05));
addStones(chain([[-3.4, 13.8], [-6, 18], [-8, 23]], 1.55, 0.44, 0.27, 0.08, 0.88).slice(1));
addStones(chain([[12.4, 3.0], [15.5, 3.6], [18.5, 4.3], [22, 5.2]], 1.55, 0.45, 0.26, 0.05, 0.8));
addStones([{ u: -0.9, v: -4.5, r: 0.44, k: 0, top: 0.16 }, { u: -1.1, v: -5.45, r: 0.42, k: 0, top: 0.16 }, { u: -1.3, v: -6.4, r: 0.42, k: 0, top: 0.16 }]);
addStones([{ u: 7.85, v: 1.6, r: 0.42, k: 0, top: 0.16 }, { u: 8.5, v: 2.05, r: 0.4, k: 0, top: 0.34 }]);

// -- 松岩
const ROCK = { c: [10.2, 2.7], a: 2.4, b: 2.0, top: 1.3 };
const rockR = (u, v) => { const x = (u - ROCK.c[0]) / ROCK.a, y = (v - ROCK.c[1]) / ROCK.b; return Math.hypot(x, y) * (1 + 0.06 * Math.sin(Math.atan2(y, x) * 3 + 1)); };
addF((u, v) => (rockR(u, v) - 1) * 1.9, (u, v) => ROCK.top * Math.sqrt(Math.max(0, 1 - Math.pow(rockR(u, v), 2))) + 0.12, 0.5, C_ROCK, [7.6, 12.8, 0.5, 4.9]);

// -- 石環小洲: a low islet with a still basin inside the ring of 14 stones
const RING = { c: [-1.5, -8.2], R: 2.2, ringR: 0.98 };
const ringDist = (u, v) => Math.hypot(u - RING.c[0], v - RING.c[1]);
const ringTop = (u, v) => { const r = ringDist(u, v); return 0.12 - 0.22 * (1 - sstep(0.68, 0.92, r)) + 0.012 * nz(u * 3, v * 3); };
const F_RING = addF((u, v) => ringDist(u, v) - RING.R + 0.1 * nz(u * 1.3, v * 1.3), ringTop, 0.35, C_STONE, [-4.2, 1.2, -10.9, -5.5]);

// -- 石拱門 feet
const ARCH = { c: [-3.8, 14.2], w: 1.2, h: 3.2 };
const ARCH_FEET = [[ARCH.c[0] + 0.9 * S, ARCH.c[1] + 0.9 * S], [ARCH.c[0] - 0.9 * S, ARCH.c[1] - 0.9 * S]];
ARCH_FEET.forEach((p) => addF((u, v) => sdDisc(u, v, p[0], p[1], 0.62), 0.6, 0.12, C_STONE, [p[0] - 1, p[0] + 1, p[1] - 1, p[1] + 1]));

// approved tidal pocket areas (2026-10-01): the same stone routes at both tides.
const LEAF_POLY = [[9.85,-3.35],[10.5,-2.95],[11.4,-2.75],[12.5,-2.7],[13.4,-2.95],[14.15,-3.45],[14.55,-4.2],[14.6,-5.0],[14.2,-5.8],[13.7,-6.35],[12.9,-6.65],[12.0,-6.7],[11.1,-6.4],[10.4,-5.95],[9.95,-5.3],[9.75,-4.5]];
const LEAF_POND = [[11.8,-4.0],[12.0,-3.52],[12.55,-3.28],[13.3,-3.32],[13.82,-3.75],[13.97,-4.45],[13.72,-5.08],[13.1,-5.36],[12.42,-5.3],[12.0,-5.02],[11.76,-4.55]];
const POND_FLOOR = -0.07;
const BR_WEST = [[-10.2,4.6],[-9.4,4.35],[-8.55,4.6],[-8.2,5.2],[-8.3,6.1],[-8.75,6.55],[-9.05,7.0],[-8.9,7.6],[-9.15,8.25],[-9.9,8.6],[-10.6,8.25],[-10.85,7.4],[-10.6,6.2],[-10.5,5.3]];
const BR_EAST = [[-5.6,6.0],[-4.7,5.75],[-3.7,6.3],[-3.05,6.9],[-2.95,7.8],[-3.3,8.7],[-4.1,9.05],[-4.9,8.8],[-5.4,8.2],[-5.55,7.3]];
addF((u,v)=>Math.max(sdPoly(u,v,LEAF_POLY),-sdPoly(u,v,LEAF_POND)),0.11,0.12,C_STONE,[9.6,14.8,-6.9,-2.5]);
addF((u,v)=>sdPoly(u,v,LEAF_POND),POND_FLOOR,0.06,C_MUD,[11.6,14.1,-5.5,-3.1]);
addF((u,v)=>sdPoly(u,v,BR_WEST),0.11,0.12,C_STONE,[-11.0,-8.0,4.2,8.8]);
addF((u,v)=>sdPoly(u,v,BR_EAST),0.11,0.12,C_MUD,[-5.8,-2.8,5.6,9.2]);
const POCKET_PATHS = [[[5.3,0.5],[8.4,-1.3],[10.5,-2.5],[10.7,-3.2]], [[-10.95,0.35],[-10.95,1.6],[-10.6,2.8],[-9.8,4.0],[-9.3,5.1]]];
POCKET_PATHS.forEach(pts=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1]; addF((u,v)=>sdCap(u,v,a,b,0.95),0.11,0.08,C_STONE,[Math.min(a[0],b[0])-.6,Math.max(a[0],b[0])+.6,Math.min(a[1],b[1])-.6,Math.max(a[1],b[1])+.6]);}});

function groundH(u, v) { let h = BOTTOM; for (let k = 0; k < FE.length; k++) { const f = FE[k], b = f.bb; if (u < b[0] - f.edge || u > b[1] + f.edge || v < b[2] - f.edge || v > b[3] + f.edge) continue; h = Math.max(h, feH(f, u, v)); } return h; }
// -- bake: RGB = colour of the bottom, A = height (SPEC 3.4)
const MAPB = { u0: -24, u1: 24, v0: -14, v1: 28, px: 16 };
const groundTex = (function () {
  const w = (MAPB.u1 - MAPB.u0) * MAPB.px, h = (MAPB.v1 - MAPB.v0) * MAPB.px; const data = new Uint8Array(w * h * 4);
  data.set(groundBytes);
  const tex = new T.DataTexture(data, w, h, T.RGBAFormat); tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter; tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true; return tex;
})();

// =====================================================================
// scene: masses of the landmarks (details are stage 2)
// =====================================================================
// static ground objects live in GL, whose local (x, z) is exactly (u, -v)
const GL = new T.Group(); GL.rotation.y = Math.PI / 4; scene.add(GL);
const L = (geo, m, parent, du, y, dv) => mesh(geo, m, parent || GL, du, y, -dv);
const G = (u, v, y, yaw) => { const g = new T.Group(); g.position.copy(W(u, v, y || 0)); g.rotation.y = rotY(yaw || 0); scene.add(g); return g; };
function prism(pts, y0, y1, m, parent) { const sh = new T.Shape(); pts.forEach((p, i) => { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); }); const o = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false }), m); o.rotation.x = -Math.PI / 2; o.position.y = y0; (parent || GL).add(o); return o; }
function limb(parent, a, b, r0, r1, m, sides) {
  const dir = b.clone().sub(a); const len = dir.length();
  const geo = new T.CylinderGeometry(r1, r0, len, sides || 7, 1); geo.translate(0, len / 2, 0);
  const o = new T.Mesh(geo, m || M.bark); o.position.copy(a); o.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize()); parent.add(o); return o;
}

// ---------- merging (static geometry into a few draw calls), as in 苔痕驛站 ----------
const bakeOk = (m) => m.isMeshStandardMaterial && !m.vertexColors && !m.userData.noBake && !WETM.some((e) => e.m === m) && !R.faders.some((f) => f.m === m);
const BAKED = new Map();
function bakedMat(m, key) {
  if (!BAKED.has(key)) {
    const b = new T.MeshStandardMaterial({ color: 0xffffff, roughness: m.roughness, metalness: m.metalness, flatShading: m.flatShading, side: m.side, vertexColors: true, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits });
    b.onBeforeCompile = m.onBeforeCompile; if (m.customProgramCacheKey !== T.Material.prototype.customProgramCacheKey) b.customProgramCacheKey = m.customProgramCacheKey;
    b.userData = Object.assign({}, m.userData); b.userData.baked = true; BAKED.set(key, b);
  }
  return BAKED.get(key);
}
function materialKey(m, cast) { if (bakeOk(m)) return ['B', m.roughness.toFixed(2), m.metalness.toFixed(2), m.flatShading ? 1 : 0, m.side, cast ? 1 : 0, m.customProgramCacheKey === T.Material.prototype.customProgramCacheKey ? '-' : m.customProgramCacheKey(), m.userData.soft ? 1 : 0, m.userData.mainOnly ? 1 : 0, m.userData.glow ? 1 : 0].join('|'); return [m.type, m.color.getHex(), (m.roughness || 0).toFixed(2), (m.metalness || 0).toFixed(2), m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0, m.side, cast ? 1 : 0].join('|'); }
function mergeUnder(root, opts) {
  opts = opts || {};
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const isDyn = (o) => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.dyn) return true; return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o === root || o.userData.noMerge || o.children.length) return;
    if (o.layers.mask !== 1) return;
    if (opts.skipDyn !== false && isDyn(o)) return;
    const m = o.material; if (!m || Array.isArray(m) || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial) || m.transparent || m.map || m.alphaMap || m.userData.glow) return;
    if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return;
    if (m.userData.noMerge) return;
    const key = materialKey(m, o.castShadow && !m.userData.mainOnly);
    if (!groups.has(key)) groups.set(key, { mat: bakeOk(m) ? bakedMat(m, key) : m, baked: bakeOk(m), cast: o.castShadow, list: [] });
    groups.get(key).list.push(o);
  });
  const mtx = new T.Matrix4(), nmx = new T.Matrix3();
  let merged = 0;
  groups.forEach((Gp) => {
    if (Gp.list.length < 2 && !opts.always) return;
    let count = 0; const parts = [];
    Gp.list.forEach((o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; parts.push({ o, g }); count += g.attributes.position.count; });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3); const col = Gp.mat.vertexColors ? new Float32Array(count * 3) : null; const bk = Gp.baked;
    let off = 0; const v = new T.Vector3();
    parts.forEach(({ o, g }) => {
      o.updateMatrixWorld(true);
      mtx.multiplyMatrices(inv, o.matrixWorld); nmx.getNormalMatrix(mtx);
      const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mtx); pos[(off + i) * 3] = v.x; pos[(off + i) * 3 + 1] = v.y; pos[(off + i) * 3 + 2] = v.z;
        if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nmx).normalize(); nor[(off + i) * 3] = v.x; nor[(off + i) * 3 + 1] = v.y; nor[(off + i) * 3 + 2] = v.z; }
        if (col && bk) { const mc = o.material.color; col[(off + i) * 3] = mc.r; col[(off + i) * 3 + 1] = mc.g; col[(off + i) * 3 + 2] = mc.b; } else if (col) { if (c) { col[(off + i) * 3] = c.getX(i); col[(off + i) * 3 + 1] = c.getY(i); col[(off + i) * 3 + 2] = c.getZ(i); } else { col[(off + i) * 3] = col[(off + i) * 3 + 1] = col[(off + i) * 3 + 2] = 1; } }
      }
      off += p.count;
      o.parent.remove(o);
    });
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); if (col) geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const me = new T.Mesh(geo, Gp.mat); if (Gp.mat.userData.mainOnly) { me.layers.set(2); Gp.cast = false; } me.castShadow = Gp.cast; me.receiveShadow = true; me.userData.noMerge = true; root.add(me); merged++;
  });
  return merged;
}


// ---------- stage 2: shared detail materials (own random generator so the stage-1 layout never shifts) ----------
const rd = mulberry(0x2b5d1); const rdr = (a, b) => a + (b - a) * rd();
const M_HEAD = mat(0x7a5f3c), M_SHELL = mat(0xe6dcc8), M_SHELL2 = mat(0xe3c9bd), M_DRIFT = mat(0x8f8574), M_ROPE = mat(0xb59f74), M_LEAFA = mat(0x9a7b4a), M_LEAFB = mat(0x86894c);
const M_VINE = mat(0x6f8c55), M_LICHEN = mat(0xa7a584), M_LICHEN2 = mat(0x93a08a), M_MOSS2 = mat(0x6d8560), M_STREAK = mat(0x87816f), M_POLISH = mat(0xdcd7ca, { roughness: 0.7 });
const M_GAUGE = tmark(mat(0xc9c3b6), { k: 1.0 });
const M_STEP = tmark(wetMat(0xc9c3b6, 0x8f8b81, 1), { all: true, green: 1, k: 0.9 });
const M_ARCH = tmark(mat(0xc9c3b6, { vertexColors: true }), { k: 0.8 });
[M_LEAFA, M_LEAFB, M_LICHEN, M_LICHEN2, M_MOSS2, M_STREAK, M_POLISH, M_SHELL, M_SHELL2, M_ROPE].forEach((m) => { m.userData.mainOnly = true; });
PUD.userData.mainOnly = true;
[M_LEAFA, M_LEAFB, M_LICHEN, M_LICHEN2, M_MOSS2, M_STREAK, M_POLISH, M_SHELL, M_SHELL2, M_ROPE, M_HEAD, M_VINE, M_DRIFT].forEach((m) => { m.userData.soft = true; }); PUD.userData.soft = true;
const M_REEDV = mat(0xffffff, { vertexColors: true }); M_REEDV.userData.soft = true;
const MARKS = {}; const PAVFX = {}; const toUVY = (v) => [(v.x - v.z) * Math.SQRT1_2, (-v.z - v.x) * Math.SQRT1_2, v.y];
const hv3 = (x, y, z, s) => { const q = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453; return q - Math.floor(q); };
function bumpGeo(g, amp, seed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const f = 1 + amp * (hv3(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40), seed) - 0.5) * 2; p.setXYZ(i, x * f, y * f, z * f); } g.computeVertexNormals(); return g; }
function strip(parent, a, b, w, h, m) { const d = b.clone().sub(a), len = d.length(); const o = new T.Mesh(new T.BoxGeometry(w, h, len), m); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(V3(0, 0, 1), d.normalize()); parent.add(o); return o; }

// ---------- terrain grids (low-poly mud bank and islet) ----------
function gridTerrain(u0, u1, v0, v1, res, hFn, material, kFn) {
  const pos = [], col = [];
  const pt = (u, v) => { const j = 0.09 * Math.sin(u * 12.9898 + v * 78.233); return [u + j, v - j]; };
  for (let u = u0; u < u1 - 1e-6; u += res) for (let v = v0; v < v1 - 1e-6; v += res) {
    const A = pt(u, v), B = pt(u + res, v), C = pt(u + res, v + res), D = pt(u, v + res);
    [[A, B, C], [A, C, D]].forEach((tri) => {
      const ps = tri.map((q) => W(q[0], q[1], Math.max(-0.6, hFn(q[0], q[1]))));
      const n = new T.Vector3().subVectors(ps[1], ps[0]).cross(new T.Vector3().subVectors(ps[2], ps[0]));
      const k = kFn((tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3);
      (n.y >= 0 ? [0, 1, 2] : [0, 2, 1]).forEach((i) => { pos.push(ps[i].x, ps[i].y, ps[i].z); col.push(k[0], k[1], k[2]); });
    });
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new T.Mesh(geo, material); m.receiveShadow = true; m.userData.noMerge = true; scene.add(m); return m;
}

// ---------- stone helpers ----------
const pickStone = () => M.stone[Math.floor(rnd() * 4)];
function slabs(sdFn, u0, u1, v0, v1, cu, cv, top, gap) {
  for (let u = u0 + cu / 2; u < u1; u += cu) for (let v = v0 + cv / 2; v < v1; v += cv) {
    let ok = true; for (let a = -1; a <= 1 && ok; a += 2) for (let b = -1; b <= 1; b += 2) if (sdFn(u + a * cu / 2, v + b * cv / 2) > 0.03) { ok = false; break; }
    if (!ok) continue;
    const b = L(new T.BoxGeometry(cu - gap, 0.04, cv - gap), pickStone(), GL, u, top - 0.02 + rr(-0.004, 0.008), v);
    b.castShadow = true; b.receiveShadow = true;
  }
}
function segBox(a, b, w, y0, y1, m) {
  const cu = (a[0] + b[0]) / 2, cv = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]), phi = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const o = L(new T.BoxGeometry(len + 0.05, y1 - y0, w), m, GL, cu, (y0 + y1) / 2, cv); o.rotation.y = phi; o.castShadow = true; o.receiveShadow = true; return o;
}
function pier(u, v, w, top, m) { const o = L(new T.BoxGeometry(w, top - BOTTOM, w), m || pickStone(), GL, u, (top + BOTTOM) / 2, v); o.rotation.y = rr(-0.15, 0.15); o.castShadow = true; o.receiveShadow = true; return o; }
function drum(cu, cv, phi, len, r, y, m) { const g = new T.CylinderGeometry(r * 0.95, r, len, 9); g.rotateZ(Math.PI / 2); const o = L(g, m || M.stoneHi, GL, cu, y, cv); o.rotation.y = phi; o.castShadow = true; o.receiveShadow = true; return o; }
const fadeMats = {};
function fadeMat(k) { const band = Math.min(4, Math.max(1, Math.round(k * 4))) * 2; if (!fadeMats[band]) { const base = new T.Color(0xc0baad); const m = mat(0xc0baad, { roughness: 0.9 + band * 0.01 }); fadeMats[band] = m; R.faders.push({ m, base, k: band / 8 }); } return fadeMats[band]; }

// ---------- 蘆葦洲 ----------
const DROPPED = { piers: [], reeds: [] };   // scene objects removed for stage 3 (SPEC 8.3 item 6), reported in the scene JSON
const REEDS = [];                            // every reed clump centre (u, v, cut) - QA keeps the route >= 0.45 away from them
const REED_CUT = [[-14.383904728092164, -0.8427947743728712], [-14.250829812186613, -1.1736922241036707], [-13.5075641734596, -1.4636411853261677], [-13.536678723000623, -1.75023617814317], [-14.4495189917735, -2.459022308242528], [-14.371229745979635, -2.5635433116588215], [-13.63520240749717, -2.5573190793928866], [-14.713538463146927, -2.7711278259485286]];                         // clumps removed because a route passes through them (at most 8; filled from the clearance run)
gridTerrain(-19.6, -6.4, -6.9, 2.9, 0.42, (u, v) => feH(F_REED, u, v), M.mudG, (u, v) => { const d = 0.93 + 0.09 * (nz(u * 1.7, v * 1.7) + 0.5) + 0.03 * h3(Math.round(u * 5), Math.round(v * 5), 1); return [d, d * 0.99, d * 0.97]; });
const REED_GROUPS = []; for (let i = 0; i < 3; i++) { const g = dyn(new T.Group()); g.position.copy(W(-13, 0.1, 0)); scene.add(g); REED_GROUPS.push(g); R.reeds.push({ o: g, ph: rr(0, 6), amp: 0.05 }); }
rr(0, 6); rr(0, 6);   // keep the stage-1 random stream unchanged (the two dropped sway groups used to draw these)
let reedN = 0;
function reedClump(u, v, s) {
  const cut = REED_CUT.some((q) => Math.hypot(q[0] - u, q[1] - v) < 0.02); REEDS.push([u, v, cut ? 1 : 0]);
  const g = REED_GROUPS[reedN++ % 3]; const nBefore = g.children.length; const base = W(u, v, Math.max(0.02, feH(F_REED, u, v)) - 0.05).sub(g.position);
  const n = 9 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const c = rnd(), cls = c < 0.4 ? 0 : (c < 0.82 ? 1 : 2); const h = [rr(0.7, 1.0), rr(1.1, 1.5), rr(1.6, 2.1)][cls] * s, lean = rr(0.04, 0.26) * (cls === 2 ? 0.8 : 1), ang = rr(0, 6.283);
    const bg = new T.ConeGeometry(0.04, h, 4), bc = new T.Color(rnd() < 0.55 ? 0xb9b07a : 0x8c8a55); const bca = new Float32Array(bg.attributes.position.count * 3); for (let q = 0; q < bg.attributes.position.count; q++) { bca[q * 3] = bc.r; bca[q * 3 + 1] = bc.g; bca[q * 3 + 2] = bc.b; } bg.setAttribute('color', new T.BufferAttribute(bca, 3));
    const c0 = mesh(bg, M_REEDV, g, base.x + Math.cos(ang) * 0.14, base.y + h / 2, base.z + Math.sin(ang) * 0.14); c0.rotation.z = -Math.cos(ang) * lean; c0.rotation.x = Math.sin(ang) * lean; c0.castShadow = true;
    if (cls >= 1 && rnd() < 0.7) { const rr2 = 0.14 + Math.sin(lean) * h * 0.46; const hd = mesh(new T.CylinderGeometry(0.03, 0.048, 0.26, 5), M_HEAD, g, base.x + Math.cos(ang) * rr2, base.y + h * 0.93, base.z + Math.sin(ang) * rr2); hd.rotation.z = -Math.cos(ang) * lean; hd.rotation.x = Math.sin(ang) * lean; hd.castShadow = true; }
  }
  if (cut) { while (g.children.length > nBefore) g.remove(g.children[g.children.length - 1]); DROPPED.reeds.push([+u.toFixed(2), +v.toFixed(2)]); }   // same random draws as before, so nothing else in the scene shifts
}
const nearPool = (u, v) => POOLS.some((p) => Math.hypot(u - p[0], v - p[1]) < p[2] + 0.35);
for (let i = 0, n = 0; n < 34 && i < 700; i++) { const u = rr(-18, -8.6), v = rr(-3.4, 1.7); if (reedR(u, v) > 0.88 && !(u < -15 && v > 0)) continue; if (Math.hypot(u + 11, v + 0.4) < 1.2 || Math.hypot(u + 15.6, v - 0.9) < 1.6 || Math.hypot(u + 8.8, v + 1.0) < 1.3 || nearPool(u, v) || Math.hypot(u + 12.0, v + 3.1) < 1.3 || (u > -12.2 && u < -9.9 && v < -0.2 && v > -3.0)) continue; reedClump(u, v, rr(0.85, 1.15)); n++; }
REED_GROUPS.forEach((g) => mergeUnder(g, { skipDyn: false, always: true }));
// 擱淺平底小船 (heading north-east, a third of it on the mud)
{ const bt = G(-15.6, 0.9, 0.0, Math.PI / 4); const outer = [[-1.3, -0.44], [0.3, -0.52], [1.0, -0.3], [1.55, 0], [1.0, 0.3], [0.3, 0.52], [-1.3, 0.44]]; const inner = [[-1.2, -0.35], [0.3, -0.43], [0.9, -0.25], [1.32, 0], [0.9, 0.25], [0.3, 0.43], [-1.2, 0.35]];
  const sh = new T.Shape(); outer.forEach((p, i) => { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); }); const hole = new T.Path(); inner.forEach((p, i) => { if (i) hole.lineTo(p[0], p[1]); else hole.moveTo(p[0], p[1]); }); sh.holes.push(hole);
  const hull = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: false }), M.hull); hull.rotation.x = -Math.PI / 2; const inn = new T.Group(); inn.add(hull);
  mesh(new T.BoxGeometry(2.55, 0.05, 0.8), M.hullIn, inn, 0.1, 0.05, 0); mesh(new T.BoxGeometry(0.09, 0.07, 0.86), M.woodL, inn, 0.25, 0.24, 0); mesh(new T.BoxGeometry(0.09, 0.07, 0.8), M.woodL, inn, -0.7, 0.22, 0);
  inn.position.y = -0.02; inn.rotation.z = 0.10; inn.rotation.x = 0.05; bt.add(inn); shadowy(bt); S4_HANDLES = S4_HANDLES || {}; S4_HANDLES.boatInn = inn;
  { const P0 = V3(0.7, 0.07, -0.30), d = V3(-0.125, 0.351, 0.927).normalize(); const pole = new T.Mesh(new T.CylinderGeometry(0.022, 0.03, 2.4, 5), M.woodL); pole.position.copy(P0).addScaledVector(d, 1.2); pole.quaternion.setFromUnitVectors(V3(0, 1, 0), d); pole.castShadow = true; inn.add(pole);
    const rope = new T.Mesh(new T.TorusGeometry(0.15, 0.035, 5, 10), M_ROPE); rope.rotation.x = Math.PI / 2; rope.position.set(-0.55, 0.10, 0.05); rope.castShadow = true; inn.add(rope);
    const pg = new T.CircleGeometry(0.4, 10); pg.rotateX(-Math.PI / 2); const pd = new T.Mesh(pg, PUD); pd.scale.set(1.3, 1, 0.8); pd.position.set(0.45, 0.083, 0.05); inn.add(pd); } }
// 漂流木 and shells on the mud
{ const du = -11.9, dv = -3.15; const y = Math.max(0.03, feH(F_REED, du, dv)); const lg = L(new T.CylinderGeometry(0.08, 0.1, 1.9, 6), M_DRIFT, GL, du, y + 0.08, dv); lg.rotation.z = Math.PI / 2; lg.rotation.y = 0.5; lg.castShadow = true;
  const br = L(new T.CylinderGeometry(0.035, 0.05, 0.62, 5), M_DRIFT, GL, du + 0.22, y + 0.2, dv + 0.35); br.rotation.set(0.6, 0.5, 0.9); br.castShadow = true; }
for (let i = 0, n = 0; n < 22 && i < 300; i++) { const u = rdr(-17.5, -8.8), v = rdr(-5.2, 1.0); if (reedR(u, v) > 0.93 || reedR(u, v) < 0.35) continue; const y = feH(F_REED, u, v); if (y < -0.02) continue; const o = L(new T.IcosahedronGeometry(0.055, 0), n % 3 ? M_SHELL : M_SHELL2, GL, u, y + 0.012, v); o.scale.set(rdr(0.9, 1.4), 0.42, rdr(0.8, 1.1)); o.rotation.y = rdr(0, 6); n++; }
// 水位標尺: a square stone post, ten level marks on the face toward the camera (no numbers or words); a polished blank patch beside the top mark is for the story event
{ const gu = -10.15, gv = -0.7; const y0 = Math.max(0.05, feH(F_REED, gu, gv)) - 0.1; const top = 1.75;
  const post = L(new T.BoxGeometry(0.34, top - y0, 0.34), M_GAUGE, GL, gu, (top + y0) / 2, gv); post.castShadow = true; post.receiveShadow = true;
  const cap = L(new T.BoxGeometry(0.42, 0.08, 0.42), M.stoneHi2, GL, gu, top + 0.04, gv); cap.castShadow = true;
  for (let i = 0; i < 10; i++) { const y = 0.30 + i * 0.13; const w = i === 9 ? 0.12 : (i % 2 ? 0.14 : 0.22); const m = L(new T.BoxGeometry(w, 0.022, 0.02), M.woodDark, GL, gu + (i === 9 ? -0.085 : -0.04), y, gv - 0.175); m.receiveShadow = true; }
  const patch = L(new T.BoxGeometry(0.11, 0.34, 0.012), M_POLISH, GL, gu + 0.075, 0.30 + 9 * 0.13, gv - 0.176); patch.receiveShadow = true; MARKS.gaugePatch = [gu + 0.075, gv - 0.18, 0.30 + 9 * 0.13]; }

// ---------- 中央石庭 (SPEC 2.4) ----------
{
  const rg = mulberry(0x51ab2f); const rq = (a, b) => a + (b - a) * rg();   // own generator: the courtyard layout must not shift the rest of the scene
  const M_DK = wetMat(0xc9c3b6, 0x8f8b81, 0.86), M_LT = wetMat(0xc9c3b6, 0x8f8b81, 1.08);
  const M_CRACK = mat(0x77726a), M_GRASS = mat(0x7c8a58), M_MOSS = mat(0x6d8560); [M_CRACK, M_GRASS, M_MOSS].forEach((m) => { m.userData.soft = true; });
  const KEEP = [[-5.5, -0.3], [0.4, 3.8], [5.5, 0.6], [-0.9, -3.8], [3.9, -3.4], [-0.8, 0.6]];   // junctions + traveller: the slabs here stay whole
  const keep = (u, v, r) => KEEP.some((p) => Math.hypot(u - p[0], v - p[1]) < (r || 1.15));
  const boxAt = (w, h, d, m, u, y, v, sh) => { const o = L(new T.BoxGeometry(w, h, d), m, GL, u, y, v); if (sh !== false) { o.castShadow = true; } o.receiveShadow = true; return o; };
  prism(COURT, BOTTOM, 0.108, M.stone[3]).castShadow = true;
  prism(UPPER, BOTTOM, 0.188, M.stone[2]).castShadow = true;
  STEPS2.forEach((st, i) => boxAt(st.h[0] * 2, 0.16 - BOTTOM, st.h[1] * 2, M.stone[1 + i], st.c[0], (0.16 + BOTTOM) / 2, st.c[1]));
  const inStep = (u, v) => STEPS2.some((st) => sdBox(u, v, st.c[0], st.c[1], st.h[0] + 0.12, st.h[1] + 0.12) < 0);
  function layRows(sd, excl, y, v0, v1, u0, u1) {
    const out = []; let v = v0 + rq(0, 0.3);
    while (v < v1) {
      const rh = rq(0.62, 0.95); let u = u0 + rq(-0.5, 0.2);
      while (u < u1) {
        const len = rq(0.6, 1.6); let placed = false;
        for (const f of [1, 0.78, 0.58]) {
          const l = len * f; if (l < 0.5) continue; const cu = u + l / 2, cv = v + rh / 2;
          if ([[-1, -1], [1, -1], [1, 1], [-1, 1]].every((c) => sd(cu + c[0] * l / 2, cv + c[1] * rh / 2) <= 0.02) && !excl(cu, cv)) { out.push({ u: cu, v: cv, lu: l - 0.06, lv: rh - 0.06, y }); u += l; placed = true; break; }
        }
        if (!placed) u += 0.45;
      }
      v += rh;
    }
    return out;
  }
  const all = layRows(courtSD, (u, v) => upperSD(u, v) < 0.3 || inStep(u, v), 0.12, -4.3, 4.3, -5.9, 5.9).concat(layRows(upperSD, (u, v) => inStep(u, v), 0.20, -0.3, 4.0, -4.7, 1.4));
  const MISS = []; let nMiss = 0, nRaise = 0, nCrack = 0;
  all.forEach((s) => {
    const kp = keep(s.u, s.v); const r = rg();
    if (!kp && nMiss < 6 && r < 0.05) { nMiss++; MISS.push(s); boxAt(s.lu, 0.02, s.lv, M.mud[nMiss % 2], s.u, s.y - 0.018, s.v, false); return; }
    const c = rg(); const m = c < 0.09 ? M_DK : (c < 0.19 ? M_LT : M.stone[Math.floor(rg() * 4)]);
    const b = boxAt(s.lu, 0.04, s.lv, m, s.u, s.y - 0.02 + rq(-0.003, 0.006), s.v);
    if (!kp && nRaise < 7 && rg() < 0.08) { nRaise++; const half = Math.max(s.lu, s.lv) / 2; const a = Math.min(rq(1, 3) * Math.PI / 180, Math.asin(0.03 / half)); if (s.lu >= s.lv) b.rotation.z = a * (rg() < 0.5 ? 1 : -1); else b.rotation.x = a * (rg() < 0.5 ? 1 : -1); b.position.y += 0.006; }
    if (!kp && nCrack < 9 && rg() < 0.10) { nCrack++; const len = rq(0.35, 0.7); const k = boxAt(0.022, 0.004, len, M_CRACK, s.u + rq(-0.2, 0.2), s.y + 0.001, s.v + rq(-0.1, 0.1), false); k.rotation.y = rq(0, 3.14); }
  });
  // shallow puddles left in the holes of the missing slabs: flat planes that show only the sky colour (never the reflection map)
  MISS.forEach((q, qi) => {
    // an irregular pool that hugs the walls of the hole: a rounded rectangle whose boundary is pulled in unevenly (touches the slab edges in places, recedes in others)
    const pr = mulberry(0x7a11 + qi * 977); const a = q.lu / 2 - 0.02, b = q.lv / 2 - 0.02, N = 22, ph = [pr() * 6.28, pr() * 6.28, pr() * 6.28], cut = pr() * 6.28;
    const pts = []; for (let i = 0; i < N; i++) { const th = i / N * Math.PI * 2; const c = Math.cos(th), sn = Math.sin(th); const k = Math.pow(Math.pow(Math.abs(c) / a, 5) + Math.pow(Math.abs(sn) / b, 5), -1 / 5); let rr2 = 0.5 * Math.sin(2 * th + ph[0]) + 0.35 * Math.sin(3 * th + ph[1]) + 0.25 * Math.sin(5 * th + ph[2]); rr2 = Math.max(0, rr2 + 0.15); const dc = Math.abs(Math.atan2(Math.sin(th - cut), Math.cos(th - cut))); const notch = 0.3 * Math.max(0, 1 - dc / 0.7); const f = Math.max(0.42, 1 - 0.34 * rr2 - notch); pts.push([c * k * f, sn * k * f]); }
    const sh = new T.Shape(); pts.forEach((p, i) => { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
    const pg = new T.ShapeGeometry(sh); pg.rotateX(-Math.PI / 2); L(pg, PUD, GL, q.u, q.y - 0.003, q.v); rdr(-0.2, 0.2);
  });
  MARKS.puddles = MISS.map((q) => [q.u, q.v]);
  // small rubble near the fallen columns and the broken column, a few elsewhere
  [[2.6, 2.1, 9], [-1.6, -2.7, 7], [-3.2, 2.6, 7], [-3.6, 0.6, 3], [4.2, -0.5, 3]].forEach((q) => { for (let i = 0, k = 0; k < q[2] && i < 80; i++) { const a = rdr(0, 6.28), d = rdr(0.55, 1.7); const u = q[0] + Math.cos(a) * d, v = q[1] + Math.sin(a) * d; if (courtSD(u, v) > -0.35 || keep(u, v, 0.9) || inStep(u, v) || Math.abs(upperSD(u, v)) < 0.25 || sdBox(u, v, 0.7, -3.7, 1.1, 0.9) < 0 || sdBox(u, v, 1.4, -1.2, 0.7, 0.4) < 0) continue; const y = upperSD(u, v) < 0 ? 0.20 : 0.12; const r = rdr(0.045, 0.12); const o = L(new T.DodecahedronGeometry(r, 0), [M.stoneHi, M.stoneHi2, M.stone[1]][k % 3], GL, u, y + r * 0.35, v); o.scale.set(rdr(0.9, 1.5), rdr(0.45, 0.8), rdr(0.8, 1.2)); o.rotation.set(rdr(0, 3), rdr(0, 3), rdr(0, 3)); o.castShadow = true; k++; } });
  // sunk slabs in the broken south rim (only their high ends show at low tide)
  [[0.30, -3.58, 0.85, 0.6, 0.005, 0.16, 0], [1.05, -3.88, 0.8, 0.55, -0.02, 0, -0.22], [1.2, -3.42, 0.5, 0.4, -0.05, -0.3, 0]].forEach((q) => { const o = boxAt(q[2], 0.06, q[3], M.stone[2], q[0], q[4], q[1]); o.rotation.z = q[5]; o.rotation.x = q[6]; });
  // grass and moss: only along the upper terrace and around the broken column
  const centroid = (P) => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]);
  const cU = centroid(UPPER), cC = [0, 0];
  const tuft = (u, v, y) => { const n = 3 + Math.floor(rg() * 3); for (let i = 0; i < n; i++) { const h = rq(0.07, 0.17); const g = L(new T.ConeGeometry(0.022, h, 4), M_GRASS, GL, u + rq(-0.07, 0.07), y + h / 2, v + rq(-0.07, 0.07)); g.rotation.z = rq(-0.3, 0.3); g.rotation.x = rq(-0.3, 0.3); g.castShadow = true; } };
  const moss = (u, v, y) => { const o = L(new T.BoxGeometry(rq(0.22, 0.4), 0.012, rq(0.16, 0.3)), M_MOSS, GL, u, y + 0.004, v); o.rotation.y = rq(0, 3); o.receiveShadow = true; };
  const edgePt = (P, cen, inset) => { const i = Math.floor(rg() * P.length), j = (i + 1) % P.length, t = rg(); const u = P[i][0] + (P[j][0] - P[i][0]) * t, v = P[i][1] + (P[j][1] - P[i][1]) * t; const dx = cen[0] - u, dy = cen[1] - v, d = Math.hypot(dx, dy); return [u + dx / d * inset, v + dy / d * inset]; };
  for (let n = 0, tries = 0; n < 24 && tries < 200; tries++) { const p = edgePt(UPPER, cU, 0.16); if (keep(p[0], p[1], 0.9) || inStep(p[0], p[1])) continue; (n % 3 === 2 ? moss : tuft)(p[0], p[1], 0.20); n++; }
  for (let n = 0, tries = 0; n < 7 && tries < 100; tries++) { const p = edgePt(COURT, cC, 0.14); if (keep(p[0], p[1], 0.9) || upperSD(p[0], p[1]) < 0.4 || inStep(p[0], p[1]) || sdBox(p[0], p[1], (BITE.u0 + BITE.u1) / 2, -3.7, 1.0, 0.8) < 0) continue; tuft(p[0], p[1], 0.12); n++; }
  for (let i = 0; i < 5; i++) { const a = rq(0, 6.28), d = rq(0.5, 0.95); (i % 2 ? moss : tuft)(-3.2 + Math.cos(a) * d, 2.6 + Math.sin(a) * d, 0.20); }
}
// two fallen columns, one broken column, one stele with a water stain
drum(2.05, 1.75, 0.44, 1.05, 0.33, 0.44, M.stoneHi); drum(2.75, 2.15, 0.40, 0.92, 0.33, 0.44, M.stoneHi2); drum(3.42, 2.47, 0.52, 0.78, 0.33, 0.44, M.stoneHi);
drum(-1.05, -2.35, -0.62, 1.15, 0.31, 0.43, M.stoneHi2); drum(-1.95, -2.85, -0.57, 1.0, 0.31, 0.43, M.stoneHi);
{ const cu = -3.2, cv = 2.6; L(new T.BoxGeometry(0.95, 0.14, 0.95), M.stoneHi2, GL, cu, 0.27, cv).castShadow = true;
  const g = new T.CylinderGeometry(0.34, 0.38, 1.66, 8, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setY(i, p.getY(i) + 0.13 * Math.sin(p.getX(i) * 9 + p.getZ(i) * 5) - 0.06 + 0.18 * (p.getX(i) > 0 ? 1 : -0.4)); g.computeVertexNormals();
  const sh = L(g, M.stoneHi, GL, cu, 0.34 + 0.83, cv); sh.castShadow = true; sh.receiveShadow = true; }
{ const cu = 1.4, cv = -1.2; const a = L(new T.BoxGeometry(0.85, 0.5, 0.2), M.stoneStain, GL, cu, 0.12 + 0.25, cv); const b = L(new T.BoxGeometry(0.85, 0.66, 0.2), M.stoneHi, GL, cu, 0.12 + 0.5 + 0.33, cv); const c = L(new T.BoxGeometry(0.93, 0.08, 0.28), M.stoneHi2, GL, cu, 0.12 + 1.16 + 0.04, cv); [a, b, c].forEach((o) => { o.rotation.y = 0.06; o.castShadow = true; o.receiveShadow = true; });
  // water streaks running down the camera-side face (a small group of its own: a later event wipes them)
  const sg = dyn(new T.Group()); sg.position.set(cu, 0, -cv); sg.rotation.y = 0.06; GL.add(sg);
  [[-0.31, 0.62], [-0.20, 0.98], [-0.06, 0.5], [0.08, 0.84], [0.21, 0.55], [0.32, 0.9]].forEach((q, i) => { const w = rdr(0.03, 0.06), top = 1.27 - (i % 2) * 0.05; mesh(new T.BoxGeometry(w, q[1], 0.012), M_STREAK, sg, q[0], top - q[1] / 2, 0.104); });
  mergeUnder(sg, { skipDyn: false, always: true }); MARKS.streaks = sg; }

// ---------- causeways with their low piers ----------
// lamp 3's big pier moved from the middle of the north causeway to its east side (SPEC 5, 8.3): 1.0 along the causeway x 0.8 outward, top 0.40, centre (1.90, 6.50)
const BIGPIER = { c: [1.90, 6.50], along: 1.0, out: 0.8, top: 0.40, phi: Math.atan2(9.0 - 4.1, 1.6 - 0.4) };
const bigPierHit = (u, v, r) => { const dx = u - BIGPIER.c[0], dy = v - BIGPIER.c[1], c = Math.cos(BIGPIER.phi), sn = Math.sin(BIGPIER.phi); const a = dx * c + dy * sn, b = -dx * sn + dy * c; return Math.abs(a) < BIGPIER.along / 2 + r && Math.abs(b) < BIGPIER.out / 2 + r; };
CW.forEach((s, ci) => {
  const w = 1.0; segBox(s[0], s[1], w, BOTTOM, 0.176, M.stoneDark).castShadow = false;
  const len = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]), phi = Math.atan2(s[1][1] - s[0][1], s[1][0] - s[0][0]), dx = Math.cos(phi), dy = Math.sin(phi);
  for (let t = 0.45; t < len - 0.3; t += 0.95) for (let side = -1; side <= 1; side += 2) { const cu = s[0][0] + dx * t - dy * side * 0.25, cv = s[0][1] + dy * t + dx * side * 0.25; const b = L(new T.BoxGeometry(0.9, 0.04, 0.46), pickStone(), GL, cu, 0.18 - 0.02 + rr(-0.004, 0.006), cv); b.rotation.y = phi; b.castShadow = true; b.receiveShadow = true; }
  for (let t = 1.0; t < len - 0.4; t += 2.0) { const side = (Math.floor(t / 2) % 2) ? 1 : -1; const pu = s[0][0] + dx * t - dy * side * 0.66, pv = s[0][1] + dy * t + dx * side * 0.66; const po = pier(pu, pv, 0.34, 0.27); if (ci === 1 && bigPierHit(pu, pv, 0.17)) { po.parent.remove(po); DROPPED.piers.push([+pu.toFixed(2), +pv.toFixed(2)]); } }
});
{ const o = L(new T.BoxGeometry(BIGPIER.along, BIGPIER.top - BOTTOM, BIGPIER.out), M.stone[2], GL, BIGPIER.c[0], (BIGPIER.top + BOTTOM) / 2, BIGPIER.c[1]); o.rotation.y = BIGPIER.phi; o.castShadow = true; o.receiveShadow = true; rr(-0.15, 0.15); }   // lamp 3's pier (the old square one used the same random call)

// ---------- 沉階 ----------
for (let k = 0; k < NSTEPS; k++) { const p = stepPos(k); const st = L(new T.BoxGeometry(STEP_D, stepTop(k) - BOTTOM, STEP_W), M_STEP, GL, p[0], (stepTop(k) + BOTTOM) / 2, p[1]); st.rotation.y = Math.atan2(STEP_DIR[1], STEP_DIR[0]); st.castShadow = true; st.receiveShadow = true; }

// ---------- stepping stones ----------
STONES.forEach((s, i) => {
  const wetCapable = s.k < 0.04; const m = wetCapable ? M.stone[i % 4] : fadeMat(s.k);
  const top = s.top + rr(-0.006, 0.01);
  const o = L(new T.CylinderGeometry(s.r * 0.9, s.r, top - BOTTOM, 7), m, GL, s.u, (top + BOTTOM) / 2, s.v); o.rotation.y = rr(0, 3); o.scale.set(rr(0.85, 1.2), 1, rr(0.85, 1.2)); o.rotation.x = rdr(-0.05, 0.05); o.rotation.z = rdr(-0.05, 0.05); o.castShadow = true; o.receiveShadow = true;
  if (s.k < 0.3 && rd() < 0.3) { const mo = L(new T.IcosahedronGeometry(s.r * 0.36, 0), M_MOSS2, GL, s.u + rdr(-0.12, 0.12) * s.r, top + 0.004, s.v + rdr(-0.12, 0.12) * s.r); mo.scale.set(1, 0.22, 1); }
});

// The stone bench on the platform's south edge (Opus 2026-10-03): between the standing point p_seat and column 4's base, top 0.38
// (0.08 above high water, so he stays dry), long axis along u. He sits on its east half; the cup stands on its west half, at his
// right hand (the hand that holds the cup; the staff is in his left).
const SEAT_BENCH = { a: [1.0, 9.28], b: [1.74, 9.28], w: 0.16, top: 0.38 };   // front edge v 9.20: legs swinging past on p_seat's two paths stay clear (measured); back edge meets column 4's plinth
{
  const B = SEAT_BENCH, fy = 0.176, mu = (B.a[0] + B.b[0]) / 2, len = B.b[0] - B.a[0];
  const top = L(new T.BoxGeometry(len, 0.065, B.w), M.stoneHi, GL, mu, B.top - 0.0325, B.a[1]); top.castShadow = true; top.receiveShadow = true;
  [-1, 1].forEach((sd) => { const leg = L(new T.BoxGeometry(0.13, B.top - 0.065 - fy + 0.02, B.w - 0.06), M.stoneHi2, GL, mu + sd * (len / 2 - 0.13), (fy - 0.02 + B.top - 0.065) / 2, B.a[1]); leg.castShadow = true; leg.receiveShadow = true; });
}
// ---------- 亭台 and 半沉亭 ----------
{
  const [pu, pv] = PAV.c; const hexPts = []; for (let i = 0; i < 6; i++) hexPts.push([pu + PAV.plat * Math.cos(i * Math.PI / 3), pv + PAV.plat * Math.sin(i * Math.PI / 3)]);
  prism(hexPts, BOTTOM, 0.108, M.stone[1]).castShadow = true;
  slabs((u, v) => sdHex(u, v, pu, pv, PAV.plat * Math.cos(Math.PI / 6)), pu - 2.4, pu + 2.4, pv - 2.1, pv + 2.1, 0.8, 0.7, 0.122, 0.05);
  const tilt = new T.Group(); tilt.position.copy(W(pu, pv, 0.10)); tilt.rotation.z = -4 * Math.PI / 180; scene.add(tilt);
  const pv3 = new T.Group(); pv3.rotation.y = Math.PI / 4; tilt.add(pv3);
  const R0 = PAV.R, FR = 1.9;
  // floor: six wedges, the one toward the south-east has dropped
  for (let k = 0; k < 6; k++) {
    const a0 = k * Math.PI / 3, a1 = (k + 1) * Math.PI / 3; const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(FR * Math.cos(a0), FR * Math.sin(a0)); sh.lineTo(FR * Math.cos(a1), FR * Math.sin(a1)); sh.lineTo(0, 0);
    const w = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }), M.wood); w.rotation.x = -Math.PI / 2; w.position.y = -0.18; w.castShadow = true; w.receiveShadow = true;
    const hold = new T.Group(); hold.add(w); pv3.add(hold);
    if (k === 5) { const bu = Math.cos(Math.PI * 11 / 6), bv = Math.sin(Math.PI * 11 / 6); const bl = V3(bu, 0, -bv); const axis = V3(0, 1, 0).cross(bl).normalize(); hold.quaternion.setFromAxisAngle(axis, 0.13); }
  }
  // columns, beams, rails
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3; const cu = R0 * Math.cos(a), cv = R0 * Math.sin(a);
    const col = L(new T.CylinderGeometry(0.1, 0.12, 2.2, 8), M.woodD, pv3, cu, 1.1, cv); col.castShadow = true;
    L(new T.BoxGeometry(0.34, 0.12, 0.34), M.stoneHi2, pv3, cu, 0.05, cv);
    const ph = a + Math.PI / 3 + Math.PI / 6 - Math.PI / 6;   // edge i runs from vertex i to vertex i+1
    const mu = (R0 * Math.cos(a) + R0 * Math.cos(a + Math.PI / 3)) / 2, mv = (R0 * Math.sin(a) + R0 * Math.sin(a + Math.PI / 3)) / 2; const ed = a + Math.PI / 3 + Math.PI / 6 + Math.PI / 2 - Math.PI / 3;  // tangent direction
    const beam = L(new T.BoxGeometry(R0 + 0.14, 0.16, 0.13), M.woodD, pv3, mu, 2.2, mv); beam.rotation.y = ed; beam.castShadow = true;
    if (i === 0 || i === 1 || i === 3 || i === 5) {
      const rt = L(new T.BoxGeometry(R0 - 0.1, 0.06, 0.09), M.wood, pv3, mu, 0.95, mv); rt.rotation.y = ed; const rb = L(new T.BoxGeometry(R0 - 0.1, 0.05, 0.07), M.wood, pv3, mu, 0.5, mv); rb.rotation.y = ed;
      for (let j = 1; j < 5; j++) { const t = (j / 5 - 0.5) * (R0 - 0.2); const bu = mu + Math.cos(ed) * t, bv = mv + Math.sin(ed) * t; L(new T.BoxGeometry(0.05, 0.42, 0.05), M.woodL, pv3, bu, 0.72, bv); }
    }
  }
  // roof (攢尖頂): skirt + spire, dark tiles, tilted with the rest
  { const ce = mesh(new T.CylinderGeometry(2.05, 2.05, 0.06, 6), M.woodL, pv3, 0, 2.28, 0); ce.rotation.y = Math.PI / 2; }
  const skirt = mesh(new T.ConeGeometry(2.5, 0.34, 6), M.tile2, pv3, 0, 2.2 + 0.08 + 0.17, 0); skirt.rotation.y = Math.PI / 2; skirt.castShadow = true;
  const spire = mesh(new T.ConeGeometry(2.0, 1.05, 6), M.tile, pv3, 0, 2.2 + 0.08 + 0.34 + 0.52, 0); spire.rotation.y = Math.PI / 2; spire.castShadow = true;
  mesh(new T.CylinderGeometry(0.035, 0.06, 0.4, 6), M.woodD, pv3, 0, 2.2 + 0.08 + 0.34 + 1.05 + 0.15, 0); mesh(new T.SphereGeometry(0.1, 8, 6), M.tile2, pv3, 0, 2.2 + 0.08 + 0.34 + 1.05 + 0.4, 0);
  // stone table (top 0.78 above the water datum) and two benches (seat 0.55)
  L(new T.CylinderGeometry(0.15, 0.2, 0.6, 6), M.stoneHi2, pv3, 0.1, 0.3, 0.05); const tbl = L(new T.CylinderGeometry(0.46, 0.42, 0.1, 6), M.stoneHi, pv3, 0.1, 0.63, 0.05); tbl.castShadow = true; tbl.receiveShadow = true;
  const bench = (cu, cv, phi, len) => { const g = new T.Group(); g.position.set(cu, 0, -cv); g.rotation.y = phi; pv3.add(g); mesh(new T.BoxGeometry(len, 0.07, 0.34), M.woodL, g, 0, 0.43, 0); [-1, 1].forEach((s) => mesh(new T.BoxGeometry(0.08, 0.4, 0.3), M.woodD, g, s * (len / 2 - 0.14), 0.2, 0)); };
  bench(-0.55, 1.02, 0, 1.3); bench(0.95, 0.55, 2.094, 1.2);
  // ---- stage 2: tile lines, hip ridges, upturned eaves, rafter ends, south hook (lamp 5 mount), leaves, moss ----
  {
    const PR = (r, y, a) => V3(r * Math.cos(a), y, -r * Math.sin(a));
    const apexS = V3(0, 3.67, 0), apexK = V3(0, 2.62, 0);
    const facet = (P0, P1, A, off) => { const n = new T.Vector3().crossVectors(P1.clone().sub(A), P0.clone().sub(A)).normalize(); const mid = P0.clone().add(P1); mid.y = 0; if (n.dot(mid) < 0) n.negate(); return n.multiplyScalar(off); };
    for (let k = 0; k < 6; k++) {
      const a0 = k * Math.PI / 3, a1 = (k + 1) * Math.PI / 3, am = (a0 + a1) / 2;
      const S0 = PR(2.0, 2.62, a0), S1 = PR(2.0, 2.62, a1), K0 = PR(2.5, 2.28, a0), K1 = PR(2.5, 2.28, a1);
      const ns = facet(S0, S1, apexS, 0.012), nk = facet(K0, K1, apexK, 0.012);
      strip(pv3, apexS, S0, 0.075, 0.05, M.tile4); strip(pv3, S0, K0, 0.085, 0.05, M.tile4);
      for (let j = 1; j <= 4; j++) { const B = S0.clone().lerp(S1, j / 5); const A2 = apexS.clone().lerp(B, 0.14); strip(pv3, A2.add(ns), B.clone().add(ns), 0.03, 0.022, M.tile3); }
      for (let j = 1; j <= 5; j++) { const B = K0.clone().lerp(K1, j / 6); const A2 = apexK.clone().lerp(B, 0.62); strip(pv3, A2.add(nk), B.clone().add(nk), 0.03, 0.02, M.tile3); }
      const dir = V3(Math.cos(a0), 0, -Math.sin(a0)); const tip = K0.clone().addScaledVector(dir, 0.22); tip.y += 0.11; strip(pv3, K0.clone().addScaledVector(dir, -0.02), tip, 0.13, 0.05, M.tile2);
      for (let i = 0; i < 10; i++) { const P = PR(2.46, 2.235, a0).lerp(PR(2.46, 2.235, a1), (i + 0.5) / 10); const rf = mesh(new T.BoxGeometry(0.055, 0.06, 0.15), M.woodL, pv3, P.x, P.y, P.z); rf.rotation.y = Math.atan2(Math.cos(am), -Math.sin(am)); }
    }
    // lamp-5 mount: a small iron bracket arm out of the middle of the south beam, ending in a hook that hangs just below the eave line
    const hk = new T.Group(); hk.position.set(0, 2.12, R0 * Math.cos(Math.PI / 6)); pv3.add(hk);
    mesh(new T.BoxGeometry(0.05, 0.05, 0.42), M.iron, hk, 0, -0.02, 0.2);
    mesh(new T.CylinderGeometry(0.016, 0.016, 0.36, 5), M.iron, hk, 0, -0.2, 0.4);
    const hr = mesh(new T.TorusGeometry(0.075, 0.017, 5, 12, Math.PI * 1.6), M.iron, hk, 0, -0.455, 0.4); hr.rotation.z = Math.PI * 0.7;
    const hookAnchor = new T.Object3D(); hookAnchor.position.set(0, -0.53, 0.4); hk.add(hookAnchor); MARKS.hookObj = hookAnchor;
    // fallen leaves on the deck and platform, moss on the platform beside the dropped corner
    const flY = (u, v) => Math.max(0.127, 0.108 - 0.0698 * ((u - pu) - (v - pv)) * Math.SQRT1_2 + 0.008);
    for (let i = 0, n = 0; n < 11 && i < 200; i++) { const a = rdr(0, 6.283), r = n < 7 ? rdr(0.5, 1.6) : rdr(1.95, 2.2); const ad = (a * 180 / Math.PI) % 360; if (r < 2 && ad > 292 && ad < 368) continue; const u = pu + Math.cos(a) * r, v = pv + Math.sin(a) * r; if (Math.hypot(u - (pu + 0.1), v - (pv + 0.05)) < 0.5) continue; const lf = L(new T.BoxGeometry(rdr(0.09, 0.14), 0.008, rdr(0.05, 0.08)), n % 2 ? M_LEAFA : M_LEAFB, GL, u, flY(u, v), v); lf.rotation.y = rdr(0, 6.28); n++; }
    for (let i = 0; i < 7; i++) { const a = rdr(302, 358) * Math.PI / 180, r = rdr(1.75, 2.0); const u = pu + Math.cos(a) * r, v = pv + Math.sin(a) * r; const m = L(new T.BoxGeometry(rdr(0.16, 0.3), 0.012, rdr(0.1, 0.2)), M_MOSS2, GL, u, 0.129, v); m.rotation.y = rdr(0, 6.28); }
  }
  // the broken wooden mirror frame hung on the outside of the SOUTH-WEST rail (edge 3, facing 210 deg, toward the camera side; REVIEW_2)
  { const fg = new T.Group(); fg.position.set(-1.25, 0.76, 0.953); fg.rotation.y = -Math.PI / 3; fg.rotation.z = 0.2; fg.scale.setScalar(1.2); pv3.add(fg); mesh(new T.BoxGeometry(0.72, 0.07, 0.05), M.woodL, fg, 0, 0.45, 0); mesh(new T.BoxGeometry(0.07, 0.95, 0.05), M.woodL, fg, -0.325, 0, 0); mesh(new T.BoxGeometry(0.07, 0.5, 0.05), M.woodL, fg, 0.325, 0.22, 0); mesh(new T.BoxGeometry(0.34, 0.07, 0.05), M.woodL, fg, -0.14, -0.45, 0); const cord = mesh(new T.CylinderGeometry(0.008, 0.008, 0.3, 4), M.woodL, fg, -0.1, 0.62, 0); cord.rotation.z = 0.5;
    // the frame is empty except for one small mirror shard wedged in its lower-left corner (it flashes now and then in daylight)
    const shardM = new T.MeshBasicMaterial({ color: 0xb2c9d8, side: T.DoubleSide }); shardM.userData.noMerge = true;
    const ss = new T.Shape(); ss.moveTo(-0.285, -0.41); ss.lineTo(-0.07, -0.41); ss.lineTo(-0.14, -0.29); ss.lineTo(-0.285, -0.15); ss.lineTo(-0.285, -0.41);
    const shard = new T.Mesh(new T.ShapeGeometry(ss), shardM); shard.position.z = 0.004; shard.userData.noMerge = true; fg.add(shard);
    const starM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }); starM.userData.noMerge = true;
    const star = new T.Group(); star.position.set(-0.19, -0.29, 0.06); star.visible = false; fg.add(star);
    [[0.62, 0.05, 0], [0.62, 0.05, Math.PI / 2], [0.36, 0.035, Math.PI / 4], [0.36, 0.035, -Math.PI / 4]].forEach((q) => { const pl = new T.Mesh(new T.PlaneGeometry(q[0], q[1]), starM); pl.rotation.z = q[2]; pl.userData.noMerge = true; star.add(pl); });
    PAVFX.shardM = shardM; PAVFX.star = star; PAVFX.starM = starM; PAVFX.shard = shard; }
  shadowy(tilt);
}

// ---------- 石拱門 (exit A): faces north-west, stands in the water ----------
{
  const w = ARCH.w, h = ARCH.h + 0.55, o = 0.62, yc = h - w - 0.15; const sh = new T.Shape();
  sh.moveTo(-w, 0); sh.lineTo(-o, 0); sh.lineTo(-o, yc); sh.absarc(0, yc, o, Math.PI, 0, true); sh.lineTo(o, 0); sh.lineTo(w, 0); sh.lineTo(w, h - w); sh.absarc(0, h - w, w, 0, Math.PI, false); sh.lineTo(-w, 0);
  const geo = new T.ExtrudeGeometry(sh, { depth: 0.75, bevelEnabled: false, curveSegments: 10 }); geo.translate(0, 0, -0.375);
  // weathering: a slow patchy darkening in the vertex colours (the shared tide band does the rest)
  { const pp = geo.attributes.position, col = new Float32Array(pp.count * 3); for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); let k = 0.95 + 0.13 * (nz(x * 2.1 + z * 3.0, y * 2.3) + 0.75) / 1.5 - 0.10 * hv3(Math.round(x * 2.5), Math.round(y * 2.5), Math.round(z * 4), 3); if (y > 3.3 && x < 0.1) k -= 0.05; col[i * 3] = k; col[i * 3 + 1] = k * 0.995; col[i * 3 + 2] = k * 0.97; } geo.setAttribute('color', new T.BufferAttribute(col, 3)); }
  const ag = new T.Group(); ag.position.copy(W(ARCH.c[0], ARCH.c[1], BOTTOM)); ag.rotation.y = -Math.PI / 2; scene.add(ag);
  const am = mesh(geo, M_ARCH, ag); am.castShadow = true; am.receiveShadow = true;
  // keystone with a chipped corner
  const ks = new T.Shape(); [[-0.19, -0.21], [0.19, -0.21], [0.19, 0.08], [0.08, 0.21], [-0.19, 0.21]].forEach((q, i) => { if (i) ks.lineTo(q[0], q[1]); else ks.moveTo(q[0], q[1]); });
  const kg = new T.ExtrudeGeometry(ks, { depth: 0.86, bevelEnabled: false }); kg.translate(0, 0, -0.43);
  const key = mesh(kg, M.stoneHi2, ag, 0, yc + o + 0.02, 0); key.castShadow = true;
  const chip = mesh(new T.IcosahedronGeometry(0.05, 0), M.stoneHi2, ag, 0.16, yc + o + 0.20, -0.42); chip.scale.set(1, 0.5, 0.7);
  // impost mouldings: one horizontal band across each pier at the spring of the arch
  [-1, 1].forEach((sd) => { const f = mesh(new T.BoxGeometry(0.66, 0.16, 0.9), M.stoneHi2, ag, sd * 0.92, 0.45 + 0.0, 0); f.castShadow = true; const im = mesh(new T.BoxGeometry(0.64, 0.07, 0.83), M.stoneHi2, ag, sd * 0.935, yc, 0); im.castShadow = true; const im2 = mesh(new T.BoxGeometry(0.64, 0.035, 0.85), M.stoneHi2, ag, sd * 0.935, yc + 0.09, 0); });
  // the foot blocks (plinths) keep their old size
  [-1, 1].forEach((sd) => { const f = mesh(new T.BoxGeometry(0.62, 0.9, 0.9), M.stoneHi2, ag, sd * 0.92, 0.45, 0); f.castShadow = true; });
  // hanging vines on the camera-side face (own sway group, merged into a few meshes)
  const vg = dyn(new T.Group()); vg.position.set(0, yc, -0.41); ag.add(vg);
  const vine = (x, y0, len, lean) => { const seg = mesh(new T.CylinderGeometry(0.012, 0.024, len, 5), M_VINE, vg, x, y0 - yc - len / 2, 0); seg.rotation.z = lean; const nl = 3 + Math.floor(rd() * 3); for (let i = 0; i < nl; i++) { const t = rdr(0.2, 1.0); const lf = mesh(new T.IcosahedronGeometry(rdr(0.055, 0.09), 0), i % 2 ? M_MOSS2 : M_VINE, vg, x + Math.sin(-lean) * len * (t - 0.5) + rdr(-0.04, 0.04), y0 - yc - len * t, rdr(-0.03, 0.02)); lf.scale.set(1, 0.7, 0.6); lf.rotation.set(rdr(0, 3), rdr(0, 3), rdr(0, 3)); } };
  [[0.35, 0.55], [0.13, 0.42], [-0.12, 0.85], [-0.35, 0.5], [-0.55, 0.3], [0.52, 0.28]].forEach((q, i) => { const x = q[0] * 1.0; const ang = Math.asin(Math.min(0.99, Math.abs(x) / 0.62)); const y0 = yc + Math.sqrt(Math.max(0.02, o * o - x * x)) - 0.02; vine(x, y0, q[1], rdr(-0.07, 0.07)); });
  [[-0.30, 0.9], [0.05, 0.65], [0.48, 0.55]].forEach((q) => { const y0 = h - w + Math.sqrt(Math.max(0.05, w * w - q[0] * q[0])) - 0.03; vine(q[0], y0, q[1], rdr(-0.05, 0.05)); });
  mergeUnder(vg, { skipDyn: false, always: true }); R.reeds.push({ o: vg, ph: rdr(0, 6), amp: 0.05 });
}

// ---------- 松岩 and the old pine ----------
{
  const RB = [[10.3, 2.7, 0.25, 2.35, 1.05, 1.85], [9.1, 2.3, 0.05, 1.5, 0.8, 1.3], [11.55, 3.15, 0.1, 1.5, 0.9, 1.3], [10.6, 3.75, 0.0, 1.3, 0.6, 1.0], [9.2, 3.3, 0.0, 1.2, 0.55, 1.0], [11.2, 1.7, 0.0, 1.1, 0.5, 0.9]];
  RB.forEach((b, i) => { const g = new T.DodecahedronGeometry(1, 1); const o = L(g, M.rock[i % 4], GL, b[0], b[2], b[1]); o.scale.set(b[3], b[4], b[5]); o.rotation.set(rr(-0.1, 0.1), rr(0, 3), rr(-0.1, 0.1)); o.castShadow = true; o.receiveShadow = true; });
  const rockY = (u, v) => { let best = -9; RB.forEach((b) => { const dx = (u - b[0]) / b[3], dz = (v - b[1]) / b[5]; const q = 1 - dx * dx - dz * dz; if (q > 0) best = Math.max(best, b[2] + b[4] * Math.sqrt(q) * 0.94); }); return best; };
  [[0.4, 1.25], [2.1, 1.0], [3.5, 1.3], [5.3, 0.95], [1.2, 0.8]].forEach((q) => { const pts = []; for (let k = 0; k <= 3; k++) { const d = 0.05 + q[1] * k / 3; const u = 10.6 + Math.cos(q[0]) * d, v = 3.2 + Math.sin(q[0]) * d; const yy = rockY(u, v); if (yy < 0.05) break; pts.push(W(u, v, yy + 0.02 + 0.13 * (1 - k / 3))); } for (let k = 0; k + 1 < pts.length; k++) { const l = limb(scene, pts[k], pts[k + 1], 0.17 - k * 0.045, 0.13 - k * 0.045, M.bark, 6); l.castShadow = true; } });
  for (let i = 0, n = 0; n < 18 && i < 500; i++) { const u = rdr(8.5, 12.1), v = rdr(1.5, 4.0); const y = rockY(u, v); if (y < 0.5 || Math.hypot(u - 10.6, v - 3.2) < 0.7) continue; if (Math.hypot(rockY(u + 0.15, v) - y, rockY(u, v + 0.15) - y) / 0.15 > 0.8) continue; const o = L(new T.IcosahedronGeometry(rdr(0.07, 0.16), 0), n % 3 ? M_LICHEN : M_LICHEN2, GL, u, y + 0.02, v); o.scale.set(1, 0.2, 1); o.rotation.y = rdr(0, 6); n++; }
  [[9.0, 2.35], [11.35, 2.1]].forEach((q) => { const y = rockY(q[0], q[1]); for (let i = 0; i < 4; i++) { const r = rdr(0.16, 0.26); const o = L(new T.IcosahedronGeometry(r, 0), i % 2 ? M_VINE : M.pine3, GL, q[0] + rdr(-0.22, 0.22), y + r * 0.45, q[1] + rdr(-0.2, 0.2)); o.scale.set(1, 0.72, 1); o.rotation.set(rdr(0, 3), rdr(0, 3), rdr(0, 3)); o.castShadow = true; } });
  // trunk (leans south-west), crown, and the long branch reaching over the water toward (8.6, 1.3)
  const T0 = [[10.6, 3.2, 1.2], [10.35, 3.0, 2.4], [9.95, 2.75, 3.5], [9.6, 2.55, 4.5]]; const tp = T0.map((q) => W(q[0], q[1], q[2]));
  for (let i = 0; i < 3; i++) { const t = limb(scene, tp[i], tp[i + 1], 0.36 - i * 0.05, 0.3 - i * 0.05, M.bark, 7); t.castShadow = true; t.receiveShadow = true; }
  const org = W(9.6, 2.55, 4.4); const crown = dyn(new T.Group()); crown.position.copy(org); scene.add(crown);
  const rel = (u, v, y) => W(u, v, y).sub(org);
  const pad = (u, v, y, r, mm) => { const q = rel(u, v, y); const b = mesh(new T.IcosahedronGeometry(r, 1), mm, crown, q.x, q.y, q.z); b.scale.set(rr(0.95, 1.15), rr(0.5, 0.62), rr(0.95, 1.15)); b.rotation.set(rr(-0.2, 0.2), rr(0, 3), rr(-0.2, 0.2)); b.castShadow = true; b.receiveShadow = true; };
  [[9.5, 2.5, 4.75, 1.3], [10.35, 3.1, 4.3, 1.0], [8.95, 2.1, 4.25, 0.95], [9.9, 2.4, 5.3, 0.8], [10.1, 3.3, 3.5, 0.7]].forEach((p, i) => pad(p[0], p[1], p[2], p[3], [M.pine, M.pine2, M.pine3][i % 3]));
  const B0 = [[10.05, 2.8, 3.2], [9.5, 2.3, 3.55], [9.05, 1.85, 3.3], [8.85, 1.55, 2.75], [8.7, 1.3, 2.05]].map((q) => rel(q[0], q[1], q[2])); for (let i = 0; i < 4; i++) { const l = limb(crown, B0[i], B0[i + 1], 0.13 - i * 0.03, 0.10 - i * 0.022, M.bark, 6); l.castShadow = true; }
  { const tp0 = B0[4]; const kn = mesh(new T.SphereGeometry(0.055, 6, 5), M.bark, crown, tp0.x, tp0.y, tp0.z); kn.castShadow = true; const tipObj = new T.Object3D(); tipObj.position.copy(rel(8.7, 1.3, 2.0)); crown.add(tipObj); MARKS.branchObj = tipObj; }
  [[9.4, 2.25, 3.8, 0.58], [8.95, 1.75, 3.45, 0.48], [8.78, 1.42, 2.5, 0.3]].forEach((p, i) => pad(p[0], p[1], p[2], p[3], [M.pine2, M.pine3, M.pine][i % 3]));
  mergeUnder(crown, { skipDyn: false }); R.crowns.push({ o: crown, ph: rr(0, 6), amp: 0.014 });
}

// ---------- 石環小洲: islet with a still basin and 14 stones ----------
gridTerrain(-4.6, 1.6, -11.3, -5.1, 0.36, (u, v) => feH(F_RING, u, v), M.stoneG, (u, v) => { const d = 0.94 + 0.08 * (nz(u * 2.3, v * 2.3) + 0.5); return [d, d, d * 0.99]; });
for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + 0.2; const hh = rr(0.25, 0.45); const g = bumpGeo(new T.DodecahedronGeometry(1, 1), 0.10, i + 1); const ux = RING.c[0] + Math.cos(a) * RING.ringR, uz = RING.c[1] + Math.sin(a) * RING.ringR; const o = L(g, [M.stoneHi, M.stoneHi2, M.stoneDark][i % 3], GL, ux, 0.10 + hh / 2, uz); o.scale.set(rr(0.26, 0.34), hh / 2 + 0.06, rr(0.26, 0.34)); o.rotation.set(rr(-0.2, 0.2), rr(0, 3), rr(-0.2, 0.2)); o.castShadow = true; o.receiveShadow = true;
  if (rd() < 0.6) { const mo = L(new T.IcosahedronGeometry(0.15, 0), M_MOSS2, GL, ux + rdr(-0.06, 0.06), 0.10 + hh + 0.05, uz + rdr(-0.06, 0.06)); mo.scale.set(rdr(0.8, 1.1), 0.32, rdr(0.8, 1.1)); mo.rotation.y = rdr(0, 6); } }

// the only-in-the-reflection test block (?reflTest=1): must never appear in the main view
if (REFL_TEST) { const tb = new T.Mesh(new T.BoxGeometry(1.3, 1.8, 1.3), new T.MeshBasicMaterial({ color: 0xff2fb5 })); tb.position.copy(W(3.5, -2.0, 0.12 + 0.9)); tb.rotation.y = Math.PI / 4; tb.layers.set(1); tb.userData.noMerge = true; scene.add(tb); }

// =====================================================================
// stage 3 · the five lamps (SPEC 5). Bodies reuse the static stone / wood materials (they merge with the rest); the flames and halos of all five are
// two shared Points objects, so a lit lamp costs no extra draw calls. Lit or not is decided by the effective time only (see update()).
// =====================================================================
const LAMPS = [];   // { k, base: [u, v, y], flame: () => Vector3 (world), light, level, obj }
{
  const sq = (w, h, d, m, u, y, v, parent) => { const o = L(new T.BoxGeometry(w, h, d), m, parent || GL, u, y, v); o.castShadow = true; o.receiveShadow = true; return o; };
  // 石燈籠 (lamps 1, 2): base, pole with a swollen joint, seat, a fire box open on four sides (corner posts), a pyramid cap and a finial. flame at ground + 1.10
  const stoneLantern = (u, v, y0, k) => {
    sq(0.46, 0.10, 0.46, M.stoneHi2, u, y0 + 0.05, v);
    const pole = L(new T.CylinderGeometry(0.06, 0.075, 0.74, 7), M.stoneHi, GL, u, y0 + 0.47, v); pole.castShadow = true;
    const jt = L(new T.SphereGeometry(0.115, 7, 5), M.stoneHi2, GL, u, y0 + 0.56, v); jt.scale.set(1, 0.7, 1); jt.castShadow = true;
    sq(0.40, 0.08, 0.40, M.stoneHi2, u, y0 + 0.88, v);
    sq(0.30, 0.03, 0.30, M.stoneDark, u, y0 + 0.935, v);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((c) => sq(0.045, 0.30, 0.045, M.stoneHi, u + c[0] * 0.125, y0 + 1.10, v + c[1] * 0.125));
    sq(0.15, 0.20, 0.15, M.stoneDark, u, y0 + 1.09, v);          // the paper core between the posts (dim stone-grey while unlit)
    sq(0.34, 0.035, 0.34, M.stoneHi2, u, y0 + 1.2675, v);
    const cap = L(new T.ConeGeometry(0.31, 0.17, 4), M.stoneHi, GL, u, y0 + 1.37, v); cap.rotation.y = Math.PI / 4; cap.castShadow = true;
    const fin = L(new T.SphereGeometry(0.05, 6, 5), M.stoneHi2, GL, u, y0 + 1.48, v);
    LAMPS.push({ k, base: [u, v, y0], flameLocal: null, flameU: [u, v, y0 + 1.10], level: 0 });
  };
  // 矮石燈 (lamp 3) on the big pier: about 0.6 tall, flame 0.45 above the pier top
  const lowLantern = (u, v, y0, k) => {
    sq(0.34, 0.05, 0.34, M.stoneHi2, u, y0 + 0.025, v);
    const pole = L(new T.CylinderGeometry(0.05, 0.06, 0.22, 7), M.stoneHi, GL, u, y0 + 0.16, v); pole.castShadow = true;
    sq(0.30, 0.05, 0.30, M.stoneHi2, u, y0 + 0.295, v);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((c) => sq(0.04, 0.26, 0.04, M.stoneHi, u + c[0] * 0.10, y0 + 0.45, v + c[1] * 0.10));
    sq(0.12, 0.16, 0.12, M.stoneDark, u, y0 + 0.45, v);
    sq(0.30, 0.03, 0.30, M.stoneHi2, u, y0 + 0.595, v);
    const cap = L(new T.ConeGeometry(0.26, 0.11, 4), M.stoneHi, GL, u, y0 + 0.665, v); cap.rotation.y = Math.PI / 4; cap.castShadow = true;
    LAMPS.push({ k, base: [u, v, y0], flameU: [u, v, y0 + 0.45], level: 0 });
  };
  stoneLantern(-11.6, 0.5, Math.max(0.05, feH(F_REED, -11.6, 0.5)) - 0.03, 0);
  stoneLantern(-4.6, 0.9, 0.19, 1);
  { const c = BIGPIER.c, d = [Math.cos(BIGPIER.phi), Math.sin(BIGPIER.phi)]; lowLantern(c[0] - d[0] * 0.25, c[1] - d[1] * 0.25, BIGPIER.top - 0.005, 2); }
  // 木框提燈 (lamp 4): hangs 0.2 below the branch tip, sways with the pine and swings a little on its own. local origin = the branch tip
  { const g = dyn(new T.Group()); MARKS.branchObj.add(g);
    const wm = M.woodD, wl = M.woodL; const q = (w, h, d, m, x, y, z) => mesh(new T.BoxGeometry(w, h, d), m, g, x, y, z);
    mesh(new T.CylinderGeometry(0.008, 0.008, 0.2, 4), M_ROPE, g, 0, -0.10, 0);                                   // rope
    q(0.05, 0.02, 0.05, wm, 0, -0.205, 0);                                                                        // hanging cap
    { const cap = mesh(new T.ConeGeometry(0.135, 0.06, 4), wm, g, 0, -0.24, 0); cap.rotation.y = Math.PI / 4; }   // roof
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((c) => q(0.02, 0.17, 0.02, wl, c[0] * 0.075, -0.355, c[1] * 0.075));   // corner posts
    q(0.16, 0.02, 0.16, wm, 0, -0.45, 0); q(0.11, 0.02, 0.11, wm, 0, -0.47, 0);                                    // floor plate and foot
    q(0.10, 0.12, 0.10, wl, 0, -0.355, 0);                                                                         // the dim paper core
    g.children.forEach((c) => { c.castShadow = true; });
    mergeUnder(g, { skipDyn: false, always: true });
    LAMPS.push({ k: 3, obj: g, flameLocal: V3(0, -0.33, 0), level: 0 });
  }
  // 小吊燈 (lamp 5): a 0.04 chain and a 0.13 body under the iron ring; body bottom at world y >= 1.42. Hangs plumb although the pavilion leans 4 degrees.
  { const an = MARKS.hookObj; an.updateWorldMatrix(true, false); const qi = new T.Quaternion(); an.getWorldQuaternion(qi).invert();
    const g = dyn(new T.Group()); g.quaternion.copy(qi); g.position.y = 0.012; an.add(g);
    const wm = M.iron, wl = M.woodL; const q = (w, h, d, m, x, y, z) => mesh(new T.BoxGeometry(w, h, d), m, g, x, y, z);
    mesh(new T.CylinderGeometry(0.006, 0.006, 0.04, 4), M.iron, g, 0, -0.02, 0);
    { const cap = mesh(new T.ConeGeometry(0.10, 0.04, 4), wm, g, 0, -0.06, 0); cap.rotation.y = Math.PI / 4; }
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((c) => q(0.014, 0.09, 0.014, wm, c[0] * 0.058, -0.105, c[1] * 0.058));
    q(0.11, 0.012, 0.11, wm, 0, -0.166, 0); q(0.09, 0.05, 0.09, wl, 0, -0.105, 0);
    g.children.forEach((c) => { c.castShadow = true; });
    mergeUnder(g, { skipDyn: false, always: true });
    LAMPS.push({ k: 4, obj: g, flameLocal: V3(0, -0.105, 0), level: 0, q0: qi.clone() });
  }
}
// the shared flame / halo points
const LAMPFX = (() => {
  const n = 5; const pos = new Float32Array(n * 3), lev = new Float32Array(n), siz = new Float32Array(n);
  const geo = () => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aL', new T.BufferAttribute(lev, 1)); g.setAttribute('aS', new T.BufferAttribute(siz, 1)); return g; };
  const vs = 'attribute float aL; attribute float aS; varying float vL; uniform float uPx; void main(){ vL = aL; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uPx * step(0.001, aL); }';
  const glow = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uPx: { value: 30 }, uK: { value: 1 } }, vertexShader: vs,
    fragmentShader: 'varying float vL; uniform float uK; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float h = pow(max(0.0, 1.0 - r), 2.3) * 0.62; float c = smoothstep(0.17, 0.0, r); vec3 col = mix(vec3(1.0, 0.58, 0.22), vec3(1.0, 0.9, 0.62), c); gl_FragColor = vec4(col, min(1.0, h * uK + c * 0.95) * vL); }' });
  const day = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: 30 }, uK: { value: 0 } }, vertexShader: vs,
    fragmentShader: 'varying float vL; uniform float uK; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = pow(max(0.0, 1.0 - r), 1.5) * 0.85; gl_FragColor = vec4(1.0, 0.63, 0.25, a * uK * vL); }' });
  const pg = new T.Points(geo(), glow), pd = new T.Points(geo(), day);
  [pg, pd].forEach((p) => { p.frustumCulled = false; p.userData.noMerge = true; p.userData.noSolid = true; scene.add(p); p.onBeforeRender = (rd, sc, cam) => { const tgt = rd.getRenderTarget(); const h = tgt ? tgt.height : rd.domElement.height; p.material.uniforms.uPx.value = h / ((cam.top - cam.bottom) / cam.zoom) * (p === pd ? 0.7 : 1); }; });
  pd.renderOrder = 2;
  return { pos, lev, siz, pg, pd, glow, day, sizeGlow: 1.5, sizeDay: 1.05 };
})();

// ---- world coordinates of the two mount points (lamp 4 branch tip, lamp 5 hook) ----
scene.updateMatrixWorld(true);
MARKS.lamp5 = toUVY(MARKS.hookObj.getWorldPosition(new T.Vector3())); MARKS.lamp4 = toUVY(MARKS.branchObj.getWorldPosition(new T.Vector3()));

// ---------- two tide-revealed pockets (3C draft): the sunken lily pond and the 疊月橋 ----------
const TIDAL = { leaves: [], flowers: [], arcs: [], pond: null, bridge: null };
const POCKET_STONE = STONE_K.concat([.88,1.07]).map(k=>tmark(wetMat(0xc9c3b6,0x8f8b81,k,{vertexColors:true})));
const POCKET_CRACK=mat(0x756f61), POCKET_MOSS=mat(0x6d7a57);
[POCKET_CRACK,POCKET_MOSS].forEach(m=>{m.userData.soft=true;});
const artRandom=mulberry(0x17d5a9), ar=(a,b)=>a+(b-a)*artRandom();
function weatherPocket(o){
  const p=o.geometry.attributes.position,c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const k=.92+.09*nz(x*3.1+z*1.7,y*3.7+z*2.3);
    c[i*3]=k;c[i*3+1]=k*.995;c[i*3+2]=k*.975;}
  o.geometry.setAttribute('color',new T.BufferAttribute(c,3));return o;
}
function clipPaving(poly,boundary){
  const area=boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  for(let k=0;k<boundary.length;k++){
    const a=boundary[k],b=boundary[(k+1)%boundary.length],input=poly;poly=[];
    const side=p=>((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))*Math.sign(area);
    for(let i=0;i<input.length;i++){const s=input[i],e=input[(i+1)%input.length],ds=side(s),de=side(e);
      if(ds>=0)poly.push(s);if((ds>=0)!==(de>=0)){const t=ds/(ds-de);poly.push([s[0]+(e[0]-s[0])*t,s[1]+(e[1]-s[1])*t]);}}
    if(poly.length<3)break;
  }return poly;
}
// a prism with an optional hole (the pond is cut out of the court's mortar bed)
function prismH(pts,hole,y0,y1,m){
  const sh=new T.Shape();pts.forEach((p,i)=>{if(i)sh.lineTo(p[0],p[1]);else sh.moveTo(p[0],p[1]);});
  if(hole){const h=new T.Path();hole.slice().reverse().forEach((p,i)=>{if(i)h.lineTo(p[0],p[1]);else h.moveTo(p[0],p[1]);});sh.holes.push(h);}
  const o=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:y1-y0,bevelEnabled:false}),m);o.rotation.x=-Math.PI/2;o.position.y=y0;GL.add(o);return o;
}
// outward unit normal of a polygon edge point (finite difference of the signed distance)
const polyN=(P,u,v)=>{const e=.02,gx=sdPoly(u+e,v,P)-sdPoly(u-e,v,P),gy=sdPoly(u,v+e,P)-sdPoly(u,v-e,P),l=Math.hypot(gx,gy)||1;return[gx/l,gy/l];};
// loose rubble along an irregular shore, so the banks read as natural low stone edges instead of slabs
function rubbleEdge(P,seedN,rmin,rmax){
  const rr2=mulberry(seedN),q=(a,b)=>a+(b-a)*rr2();
  P.forEach((a,i)=>{const b=P[(i+1)%P.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.round(len/.34));
    for(let j=0;j<n;j++){const t=(j+q(.15,.85))/n,u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t,nn=polyN(P,u,v),r=q(rmin,rmax);
      const o=L(bumpGeo(new T.DodecahedronGeometry(1,0),.16,seedN+i*11+j),M.rock[(i+j)%4],GL,u+nn[0]*q(-.03,.1),.055+r*.2,v+nn[1]*q(-.03,.1));
      o.scale.set(r*q(1,1.5),r*q(.45,.7),r);o.rotation.y=q(0,3.1);o.castShadow=true;o.receiveShadow=true;}});
}
function pocketPaving(P,basins,hole,opt){
  opt=opt||{};
  const floor=prismH(P,hole,-.24,.084,M.stone[3]);floor.receiveShadow=true;floor.castShadow=true;
  const minU=Math.min(...P.map(p=>p[0])),maxU=Math.max(...P.map(p=>p[0])),minV=Math.min(...P.map(p=>p[1])),maxV=Math.max(...P.map(p=>p[1]));
  let row=0;for(let v=minV;v<maxV;){const rh=ar(.58,.88);let u=minU-ar(.15,.75);
    while(u<maxU){const width=ar(.65,1.24),gap=.027,c=ar(.04,.09),x=u+gap,z=v+gap,w=width-gap*2,d=rh-gap*2;
      let pts=[[x+c,z],[x+w-c,z],[x+w,z+c],[x+w,z+d-c],[x+w-c,z+d],[x+c,z+d],[x,z+d-c],[x,z+c]];
      pts=clipPaving(pts,P);const cu=u+width/2,cv=v+rh/2;
      let ok=pts.length>=3 && !basins.some(b=>Math.hypot(cu-b[0],cv-b[1])<b[2]+.23);
      if(ok&&hole&&pts.some(p=>sdPoly(p[0],p[1],hole)<.07))ok=false;
      if(ok){
        const stone=weatherPocket(prism(pts,.077,.11,POCKET_STONE[Math.floor(ar(0,POCKET_STONE.length))]));stone.castShadow=true;stone.receiveShadow=true;
        if(sdPoly(cu,cv,P)<-.35 && artRandom()<.17){const crack=L(new T.BoxGeometry(.013,.002,ar(.18,.36)),POCKET_CRACK,GL,cu,.112,cv);crack.rotation.y=ar(-.8,.8);}
        if(sdPoly(cu,cv,P)<-.3 && artRandom()<.10){const moss=L(new T.IcosahedronGeometry(ar(.045,.095),0),POCKET_MOSS,GL,cu,.112,cv);moss.scale.set(1,.055,.6);}
      }u+=width;
    }v+=rh;row++;
  }
  if(opt.rubble) rubbleEdge(P,opt.rubble,.1,.2);
  else P.forEach((a,i)=>{const b=P[(i+1)%P.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.65);
    for(let j=0;j<n;j++){const t0=(j+.035)/n,t1=(j+.965)/n;segBox([a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1],.12,-.19,.108,POCKET_STONE[(i+j)%4]);}});
}
pocketPaving(LEAF_POLY,[],LEAF_POND);
pocketPaving(BR_WEST,[],null,{rubble:77});
POCKET_PATHS.forEach(pts=>{for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.75);
  segBox(a,b,.95,-.18,.084,M.stone[3]);
  for(let j=0;j<n;j++){const t0=(j+.02)/n,t1=(j+.98)/n;segBox([a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1],.91,.072,.11,POCKET_STONE[j%4]);}
}});

// =====================================================================
// 睡蓮池 (Opus SPEC 9.3): a sunken lily pond. Low tide: shallow pond, young leaves rolled, buds shut.
// Rising water: the pads unroll and float, the water lilies open one after another.
// Pads, petals and flower hearts are three InstancedMeshes; everything else merges with the stone.
// =====================================================================
{
  const pr=mulberry(0x51ee7a), pq=(a,b)=>a+(b-a)*pr();
  const RIMM=[POCKET_STONE[0],POCKET_STONE[2],POCKET_STONE[3],M.stoneDark];
  for(let i=0;i<LEAF_POND.length;i++){
    const a=LEAF_POND[i],b=LEAF_POND[(i+1)%LEAF_POND.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.round(len/.24));
    const nx=(b[1]-a[1])/len,ny=-(b[0]-a[0])/len;
    for(let j=0;j<n;j++){const t=(j+pq(.25,.75))/n,u=a[0]+(b[0]-a[0])*t+nx*.04,v=a[1]+(b[1]-a[1])*t+ny*.04;
      const west=u<12.15, r=west?pq(.11,.15):pq(.09,.16), top=west?pq(.118,.132):pq(.13,.2);
      const st=L(bumpGeo(new T.DodecahedronGeometry(1,0),.12,i*7+j+3),RIMM[(i+j)%RIMM.length],GL,u,(top+POND_FLOOR)/2,v);
      st.scale.set(r*pq(1,1.35),(top-POND_FLOOR)/2,r);st.rotation.y=pq(0,3.1);st.castShadow=true;st.receiveShadow=true;
      if(!west&&pr()<.3){const mo=L(new T.IcosahedronGeometry(r*.55,0),M_MOSS2,GL,u,top+.004,v);mo.scale.set(1,.25,.8);}
    }
  }
  {const g=G(14.12,-4.12,.11,.4);
    [[0,0,0,.30,.26,.24],[.03,.30,.02,.22,.2,.19],[-.04,.52,.04,.17,.16,.14],[.02,.68,-.01,.11,.09,.1]].forEach((q,i)=>{const o=mesh(bumpGeo(new T.DodecahedronGeometry(1,1),.16,40+i),[M.rock[1],M.rock[3],M.rock[0],M.rock[2]][i],g,q[0],q[1],q[2]);o.scale.set(q[3],q[4],q[5]);o.rotation.set(.15*i,.9*i,-.1*i);o.castShadow=true;o.receiveShadow=true;});
    const mo=mesh(new T.IcosahedronGeometry(.12,0),M_MOSS2,g,-.1,.42,.12);mo.scale.set(1,.3,.7);}
  const irisM=[mat(0x5f8257,{side:T.DoubleSide}),mat(0x4f7350,{side:T.DoubleSide}),mat(0x6e8f5c,{side:T.DoubleSide})], irisF=mat(0x7d70b4,{side:T.DoubleSide}), irisY=mat(0xe2c35c);
  [[12.35,-3.02,1],[13.55,-3.12,.85],[13.98,-5.42,.8],[10.25,-5.45,.7]].forEach((c,ci)=>{
    const g=dyn(G(c[0],c[1],.11));
    const nL=8+ci%3;
    for(let k=0;k<nL;k++){const h=pq(.42,.72)*c[2],w=pq(.035,.05),ang=pq(0,6.28),lean=pq(.08,.32);
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-w,0,0, w,0,0, w*.25,h*.62,0, -w*.25,h*.62,0, 0,h,0],3));geo.setIndex([0,1,2, 0,2,3, 3,2,4]);geo.computeVertexNormals();
      const lf=mesh(geo,irisM[k%3],g,pq(-.12,.12),0,pq(-.12,.12));lf.rotation.set(lean,ang,pq(-.1,.1));}
    for(let k=0;k<(ci===1?1:2);k++){const h=pq(.5,.68)*c[2],x=pq(-.08,.08),z=pq(-.08,.08);
      mesh(new T.CylinderGeometry(.007,.009,h,4),irisM[0],g,x,h/2,z);
      for(let p=0;p<3;p++){const a=p*2.094+k;const fall=mesh(new T.ConeGeometry(.035,.09,4),irisF,g,x+Math.cos(a)*.035,h-.01,z+Math.sin(a)*.035);fall.rotation.set(Math.cos(a)*1.9,0,-Math.sin(a)*1.9);
        const std=mesh(new T.ConeGeometry(.022,.08,4),irisF,g,x+Math.cos(a+1.05)*.012,h+.045,z+Math.sin(a+1.05)*.012);std.rotation.set(Math.cos(a+1.05)*.3,0,-Math.sin(a+1.05)*.3);}
      mesh(new T.SphereGeometry(.012,4,3),irisY,g,x,h+.01,z);}
    mergeUnder(g,{skipDyn:false,always:true});R.reeds.push({o:g,ph:pq(0,6),amp:.035});
  });
  // the dry-tide seat: a long weathered slab on two low stones, right behind leaf_seat (node bench: he sits back onto it; Opus 2026-10-03 moved it 0.13 north and made it 0.32 deep; it used to sit 0.5 behind him and he floated)
  {segBox([11.88,-6.22],[12.2,-6.22],.24,.11,.24,POCKET_STONE[3]);segBox([12.7,-6.22],[13.0,-6.22],.24,.11,.24,POCKET_STONE[1]);
    const top=weatherPocket(segBox([11.76,-6.23],[13.09,-6.2],.32,.24,.31,POCKET_STONE[0]));top.castShadow=true;}

  // --- lily pads (instanced) ---
  const padGeo=(()=>{const n=16,notch=.42,pos=[0,0,0];for(let i=0;i<=n;i++){const t=notch/2+i/n*(Math.PI*2-notch);const r=1+.035*Math.sin(t*5+1);pos.push(Math.cos(t)*r,.055,Math.sin(t)*r);}
    const idx=[];for(let i=1;i<=n;i++)idx.push(0,i+1,i);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    const col=[];for(let i=0;i<pos.length/3;i++)col.push(...(i===0?[.86,.9,.8]:[1,1,1]));g.setAttribute('color',new T.Float32BufferAttribute(col,3));return g;})();
  const padM=mat(0xffffff,{side:T.DoubleSide,vertexColors:true});padM.userData.soft=true;
  const PADS=[];const clear=[13.15,-4.55,.42];
  const clusters=[[12.45,-3.85],[13.55,-3.95],[12.25,-4.85],[13.45,-4.95],[12.95,-3.55]];
  for(let tries=0;PADS.length<36&&tries<6000;tries++){
    let u,v;if(pr()<.8){const c=clusters[Math.floor(pr()*clusters.length)];u=c[0]+(pr()+pr()+pr()-1.5)*.55;v=c[1]+(pr()+pr()+pr()-1.5)*.5;}else{u=pq(11.7,14.0);v=pq(-5.4,-3.2);}
    const r=pq(.11,.27)*(pr()<.25?1.25:1);
    if(sdPoly(u,v,LEAF_POND)>-(r*.55+.08))continue;if(Math.hypot(u-clear[0],v-clear[1])<clear[2]+r*.5)continue;
    if(PADS.some(p=>Math.hypot(p.u-u,p.v-v)<(p.r+r)*.82))continue;
    PADS.push({u,v,r,a:pq(0,6.28),ph:pq(0,6.28),k:PADS.length});
  }
  const padIM=new T.InstancedMesh(padGeo,padM,PADS.length);padIM.castShadow=false;padIM.receiveShadow=true;padIM.userData.noSolid=true;padIM.frustumCulled=false;scene.add(padIM);
  const PADC=[new T.Color(0x5e8a5c),new T.Color(0x6c9963),new T.Color(0x4f7b57),new T.Color(0x77a068),new T.Color(0x5a8065)];
  PADS.forEach((p,i)=>{p.col=PADC[i%PADC.length].clone().multiplyScalar(pq(.92,1.05));if(pr()<.2)p.col.lerp(new T.Color(0x8a6a52),.35);});
  // --- water lilies: petals and green sepals share one instanced mesh; hearts are another ---
  const petalGeo=(()=>{const w=.42,cr=-.07;const P=[0,0,0, -w,0,.42, 0,cr,.5, w,0,.42, 0,0,1];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setIndex([0,2,1, 0,3,2, 1,2,4, 2,3,4]);g.computeVertexNormals();
    g.setAttribute('color',new T.Float32BufferAttribute([.82,.8,.72, .95,.94,.9, .92,.9,.86, .95,.94,.9, 1,1,1],3));return g;})();
  const petalM=mat(0xffffff,{side:T.DoubleSide,vertexColors:true,roughness:.8});petalM.userData.soft=true;
  const FL=[];const FLC=[0xf6f1e8,0xf3b9c6,0xf6f1e8,0xeea9b8,0xf7e7b4,0xf3c3cd,0xf6f1e8];
  const hosts=PADS.slice().sort((a,b)=>b.r-a.r);
  for(const h of hosts){if(FL.length>=7)break;if(FL.some(f=>Math.hypot(f.u-h.u,f.v-h.v)<.55))continue;
    FL.push({u:h.u+Math.cos(h.a+3.14)*h.r*.35,v:h.v+Math.sin(h.a+3.14)*h.r*.35,pad:h,c:new T.Color(FLC[FL.length]),d:pq(0,.42),yaw:pq(0,6.28),s:pq(.9,1.12)});}
  const NPF=20;const petIM=new T.InstancedMesh(petalGeo,petalM,FL.length*NPF);petIM.castShadow=true;petIM.receiveShadow=true;petIM.userData.noSolid=true;petIM.frustumCulled=false;scene.add(petIM);
  const SEPAL=new T.Color(0x5d8456);
  FL.forEach((f,fi)=>{for(let k=0;k<NPF;k++){const c=k<4?SEPAL:(k<12?f.c:f.c.clone().lerp(new T.Color(0xffffff),.12).multiplyScalar(.97));petIM.setColorAt(fi*NPF+k,c);}});
  const heartM=mat(0xe7c25b,{roughness:.7});heartM.userData.soft=true;
  const heartIM=new T.InstancedMesh(new T.CylinderGeometry(.034,.03,.03,7),heartM,FL.length);heartIM.userData.noSolid=true;heartIM.frustumCulled=false;scene.add(heartIM);
  const D=new T.Object3D();
  TIDAL.pond={padIM,petIM,heartIM,PADS,FL,D};
  TIDAL.leaves=PADS;TIDAL.flowers=FL;
}

// =====================================================================
// 疊月橋 (SPEC 9.2 + 9.6.1): a single-arch Lingnan granite bridge. The spring line sits exactly on the high-water line (y = 0.30).
// Group-local axes: x = u (screen right), y = up, z = toward the camera (−v). The arch faces the camera.
// =====================================================================
const BR = { cu: -7.1, cv: 7.55, R: 1.1, SP: 0.30, D: 1.2, VT: 0.16, ring: null };
{
  // masonry courses: horizontal joints every 0.19, staggered vertical joints, per-stone tone; only on the faces that look along the bridge's depth
  const courseMat = (m) => {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh) => {
      prev(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBw; varying vec3 vBn;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vBw = (modelMatrix * vec4(transformed, 1.0)).xyz; vBn = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBw; varying vec3 vBn;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' +
          ' { float face = smoothstep(0.55, 0.85, abs(dot(vBn, vec3(-0.70710678, 0.0, -0.70710678))));\n' +
          '   float cyy = vBw.y / 0.19; float ci = floor(cyy); float fy = fract(cyy);\n' +
          '   float ru = fract(sin(ci * 12.9898) * 43758.5453);\n' +
          '   float cw = 0.60 + 0.55 * ru; float uu = (vBw.x - vBw.z) * 0.70710678 + ru * 3.0; float si = floor(uu / cw); float fu = fract(uu / cw);\n' +
          '   float jh = smoothstep(0.05, 0.0, fy) + smoothstep(0.95, 1.0, fy);\n' +
          '   float jv = (smoothstep(0.035, 0.0, fu) + smoothstep(0.965, 1.0, fu)) * step(0.05, fy) * step(fy, 0.95);\n' +
          '   float tone = fract(sin((ci * 7.0 + si) * 43.17) * 9631.7);\n' +
          '   diffuseColor.rgb *= mix(1.0, (0.93 + 0.12 * tone) * (1.0 - 0.30 * clamp(jh + jv, 0.0, 1.0)), face); }');
    };
    m.customProgramCacheKey = () => 'brc';
    return m;
  };
  const wallM = courseMat(tmark(mat(0xc6c2b7)));
  const wallM2 = tmark(mat(0xc6c2b7));
  const ringM = [tmark(mat(0xd6d2c7, { vertexColors: true })), tmark(mat(0xcfcbc0, { vertexColors: true }))];
  const copeM = tmark(mat(0xd0ccc1));
  const g = G(BR.cu, BR.cv, 0, 0); g.userData.bridge = true;
  const hump = (x) => { const a = Math.abs(x); if (a <= 0.35) return 1.64; const t = Math.min(1, (a - 0.35) / 2.5); const s = 0.6 * t + 0.4 * t * t * (3 - 2 * t); return 0.11 + 1.53 * (1 - s); };
  // smooth hump polyline: 12 segments per side
  const XS = []; for (let i = 11; i >= 0; i--) XS.push(-(0.35 + i * 2.5 / 11)); XS.push(-0.0); for (let i = 0; i <= 11; i++) XS.push(0.35 + i * 2.5 / 11);
  const XSS = []; for (let i = 11; i >= 0; i--) XSS.push(-(0.35 + i * 2.5 / 11)); for (let i = 0; i <= 11; i++) XSS.push(0.35 + i * 2.5 / 11);   // without the centre point
  const D = BR.D, R = BR.R, SP = BR.SP, Ro = R + BR.VT;
  // body: spandrel walls + piers in one extrusion with the arch cut out (piers go below the water so the arch always stands on the bed)
  {
    const sh = new T.Shape();
    sh.moveTo(-2.85, -0.7); sh.lineTo(-R, -0.7); sh.lineTo(-R, SP); sh.lineTo(-Ro, SP);
    for (let i = 0; i <= 48; i++) { const a = Math.PI - i / 48 * Math.PI; sh.lineTo(Ro * Math.cos(a), SP + Ro * Math.sin(a)); }
    sh.lineTo(R, SP); sh.lineTo(R, -0.7); sh.lineTo(2.85, -0.7);
    for (let i = XSS.length - 1; i >= 0; i--) { const x = XSS[i]; sh.lineTo(x, hump(x) - 0.10); }
    const geo = new T.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 4 }); geo.translate(0, 0, -D / 2);
    const o = new T.Mesh(geo, wallM); o.castShadow = true; o.receiveShadow = true; g.add(o);
  }
  // voussoirs: 15 cut stones, radial 0.16, proud of the wall face by 0.03, hairline joints
  for (let i = 0; i < 15; i++) {
    const a = i * Math.PI / 15 + 0.0035, b = (i + 1) * Math.PI / 15 - 0.0035;
    const sh = new T.Shape(); sh.moveTo(Math.cos(a) * Ro, Math.sin(a) * Ro); sh.absarc(0, 0, Ro, a, b, false);
    sh.lineTo(Math.cos(b) * R, Math.sin(b) * R); sh.absarc(0, 0, R, b, a, true); sh.closePath();
    const geo = new T.ExtrudeGeometry(sh, { depth: D + 0.06, bevelEnabled: false, curveSegments: 3 }); geo.translate(0, SP, -(D + 0.06) / 2);
    // geometry is built about (0,0); the translate above moved it to the spring line
    const o = weatherPocket(new T.Mesh(geo, ringM[i % 2])); o.castShadow = true; o.receiveShadow = true; g.add(o);
  }
  // imposts: a slim course where the ring meets the piers
  for (const s of [-1, 1]) { const o = mesh(new T.BoxGeometry(0.34, 0.06, D + 0.07), copeM, g, s * (R + 0.04), SP - 0.03, 0); o.castShadow = true; }
  // steps: only on the deck, between the parapets (the side silhouette stays one smooth hump)
  const run = 0.25;
  for (const s of [-1, 1]) for (let k = 0; k < 10; k++) {
    const x0 = 0.35 + k * run, xm = x0 + run / 2, top = hump(xm) - 0.02;
    const bot = hump(xm) - 0.14, o = mesh(new T.BoxGeometry(run - 0.012, top - bot, D - 0.2), wallM2, g, s * xm, (top + bot) / 2, 0); o.castShadow = true; o.receiveShadow = true;
  }
  { const o = mesh(new T.BoxGeometry(0.72, 0.14, D - 0.2), wallM2, g, 0, 1.64 - 0.07, 0); o.castShadow = true; o.receiveShadow = true; }
  // parapets: low solid slabs (top 0.45 above the deck) following the same polyline, with a coping stone
  for (const z of [-1, 1]) {
    const polyTop = (dy) => XS.map((x) => [x, hump(x) + dy]);
    const slab = new T.Shape(); const tp = polyTop(0.45), bt = polyTop(-0.10);
    slab.moveTo(tp[0][0], tp[0][1]); tp.forEach((p) => slab.lineTo(p[0], p[1])); for (let i = bt.length - 1; i >= 0; i--) slab.lineTo(bt[i][0], bt[i][1]);
    const geo = new T.ExtrudeGeometry(slab, { depth: 0.10, bevelEnabled: false }); geo.translate(0, 0, z * (D / 2 - 0.05) - 0.05);
    const o = new T.Mesh(geo, wallM); o.castShadow = true; o.receiveShadow = true; g.add(o);
    const cope = new T.Shape(); const c1 = polyTop(0.50), c0 = polyTop(0.45);
    cope.moveTo(c1[0][0], c1[0][1]); c1.forEach((p) => cope.lineTo(p[0], p[1])); for (let i = c0.length - 1; i >= 0; i--) cope.lineTo(c0[i][0], c0[i][1]);
    const cg = new T.ExtrudeGeometry(cope, { depth: 0.14, bevelEnabled: false }); cg.translate(0, 0, z * (D / 2 - 0.05) - 0.07);
    const co = new T.Mesh(cg, copeM); co.castShadow = true; co.receiveShadow = true; g.add(co);
    // six posts per parapet: both ends, mid-slope on each side, both sides of the crown
    [-2.78, -1.55, -0.42, 0.42, 1.55, 2.78].forEach((x) => { const y = hump(x) + 0.50;
      const p = mesh(new T.BoxGeometry(0.10, 0.10, 0.12), copeM, g, x, y + 0.04, z * (D / 2 - 0.05)); p.castShadow = true;
      const c = mesh(new T.BoxGeometry(0.135, 0.035, 0.155), copeM, g, x, y + 0.10, z * (D / 2 - 0.05)); c.castShadow = true; });
  }
  // shallow moon-disc reliefs on the spandrels, both faces (no text)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const d = mesh(new T.CylinderGeometry(0.17, 0.17, 0.03, 22), copeM, g, sx * 1.62, 0.60, sz * (D / 2 + 0.008)); d.rotation.x = Math.PI / 2;
    const d2 = mesh(new T.CylinderGeometry(0.115, 0.115, 0.03, 22), M.stoneStain, g, sx * 1.62, 0.60, sz * (D / 2 + 0.017)); d2.rotation.x = Math.PI / 2;
  }
  // the moon-phase light on the arch soffit and the front/back lips (additive, vertex-coloured; updated each frame)
  {
    const N = 56, pos = [], idx = [];
    const ring = (r0, r1, z) => { const b = pos.length / 3; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI; pos.push(Math.cos(a) * r0, SP + Math.sin(a) * r0, z, Math.cos(a) * r1, SP + Math.sin(a) * r1, z); } for (let i = 0; i < N; i++) { const q = b + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } };
    const soffit = (rr, z0, z1, rows) => { const b = pos.length / 3; for (let j = 0; j <= rows; j++) { const z = z0 + (z1 - z0) * j / rows; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI; pos.push(Math.cos(a) * rr, SP + Math.sin(a) * rr, z); } } for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) { const q = b + j * (N + 1) + i; idx.push(q, q + 1, q + N + 1, q + 1, q + N + 2, q + N + 1); } };
    const nF = pos.length; ring(R, R + 0.11, D / 2 + 0.05); const nB = pos.length / 3; ring(R, R + 0.11, -D / 2 - 0.05); const nS = pos.length / 3; soffit(R - 0.004, -D / 2 - 0.03, D / 2 + 0.03, 8);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const col = new Float32Array(pos.length / 3 * 4); geo.setAttribute('color', new T.BufferAttribute(col, 4));
    const gm = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false }); gm.userData.soft = true;
    const glow = new T.Mesh(geo, gm); glow.frustumCulled = false; glow.userData.noMerge = true; g.add(glow);
    BR.ring = { geo, col, N, nFront: [0, (N + 1) * 2], nBack: [(N + 1) * 2, (N + 1) * 4], rows: 8, soffitStart: (N + 1) * 4 };
  }
  TIDAL.arcs.push({ center: [BR.cu, BR.cv], radius: R, seam: SP, style: 'single-arch-bridge' });
  TIDAL.bridge = g;
  mergeUnder(g, { skipDyn: false });
}
// shores: a low irregular stone bank on the west (paved, with rubble edge) and a small earthen islet with the banyan on the east
{
  const m0 = L(new T.BoxGeometry(.2, .3, .2), POCKET_STONE[2], GL, -10.2, .24, 8.1); m0.castShadow = true;               // mooring stone
  const rg = mesh(new T.TorusGeometry(.08, .018, 4, 8), M.iron, scene, 0, 0, 0); rg.position.copy(W(-10.2, 8.1, .34)); rg.rotation.y = rotY(0);
  prism(BR_EAST, -.24, .108, M.mud[0]).receiveShadow = true;
  const inset = BR_EAST.map((p) => { const cx = BR_EAST.reduce((s, q) => s + q[0], 0) / BR_EAST.length, cy = BR_EAST.reduce((s, q) => s + q[1], 0) / BR_EAST.length; return [cx + (p[0] - cx) * .84, cy + (p[1] - cy) * .84]; });
  const grass = mat(0x7d8f5a); grass.userData.soft = true; prism(inset, .1, .122, grass).receiveShadow = true;
  rubbleEdge(BR_EAST, 91, .1, .2);
  const gr = mulberry(0x3a11); const gq = (a, b) => a + (b - a) * gr();
  const tuftM = mat(0x86a062, { side: T.DoubleSide }); tuftM.userData.soft = true;
  [[-4.7, 6.45], [-3.7, 6.75], [-4.4, 8.3], [-3.2, 7.3], [-5.0, 7.5], [-4.1, 7.0]].forEach((c) => {
    for (let k = 0; k < 9; k++) { const h = gq(.12, .26); const o = L(new T.ConeGeometry(.02, h, 3), tuftM, GL, c[0] + gq(-.14, .14), .12 + h / 2, c[1] + gq(-.14, .14)); o.rotation.set(gq(-.3, .3), 0, gq(-.3, .3)); }
  });
}
// 榕樹: a short, stout trunk in 2–3 strands with buttress roots, horizontal main limbs, a broad flat umbrella crown (olive), and curtains of aerial roots
{
  const bu = -3.55, bv = 8.35, y0 = .118, tr = mulberry(0xba17), tq = (a, b) => a + (b - a) * tr();
  const barkM = tmark(wetMat(0x7d7468, 0x5a554c, 1.0));
  const oliveA = mat(0x55704a), oliveB = mat(0x4b6a4c), oliveC = mat(0x6d8a55);
  const strands = [[-.16, .05, -.05, .08, 1.35, .19], [.15, -.07, .10, -.06, 1.15, .17], [.01, .19, .02, .12, 1.0, .15]];
  strands.forEach((s) => { const a = W(bu + s[0], bv + s[1], y0 - .05), b = W(bu + s[0] + s[2], bv + s[1] + s[3], y0 + s[4]); const t = limb(scene, a, b, s[5] + .05, s[5] - .02, barkM, 7); t.castShadow = true; t.receiveShadow = true; });
  for (let i = 0; i < 7; i++) { const ang = i / 7 * 6.28 + tq(-.2, .2), ln = tq(.5, .85); const a = W(bu + Math.cos(ang) * ln, bv + Math.sin(ang) * ln, y0 - .02), b = W(bu + Math.cos(ang) * .12, bv + Math.sin(ang) * .12, y0 + tq(.35, .6)); const r = limb(scene, a, b, .035, .1, barkM, 5); r.castShadow = true; }
  const org = W(bu + .15, bv, 1.55); const crown = dyn(new T.Group()); crown.position.copy(org); scene.add(crown);
  const rel = (u, v, y) => W(u, v, y).sub(org);
  // main limbs, nearly horizontal, reaching out under the crown
  [[.9, .1, 1.7], [-.55, .45, 1.75], [.35, -.85, 1.65], [-.95, -.3, 1.6], [.2, .95, 1.7]].forEach((q) => { const a = rel(bu, bv, 1.3), b = rel(bu + q[0], bv + q[1], q[2]); const l = limb(crown, a, b, .1, .05, barkM, 6); l.castShadow = true; });
  // umbrella crown: many flattened foliage lumps, highest in the middle, drooping at the rim
  const lump = (u, v, y, r, mm) => { const q = rel(u, v, y); const b = mesh(new T.IcosahedronGeometry(r, 1), mm, crown, q.x, q.y, q.z); b.scale.set(tq(.95, 1.2), tq(.5, .62), tq(.95, 1.2)); b.rotation.set(tq(-.2, .2), tq(0, 3), tq(-.2, .2)); b.castShadow = true; b.receiveShadow = true; };
  const mats = [oliveA, oliveB, oliveC, oliveA, oliveB];
  for (let i = 0; i < 17; i++) { const a = tq(0, 6.28), rr0 = Math.sqrt(tq(0, 1)) * 1.45; const u = bu + .2 + Math.cos(a) * rr0, v = bv + Math.sin(a) * rr0 * .8; const y = 2.55 - (rr0 / 1.45) * .55 + tq(-.1, .15); lump(u, v, y, tq(.34, .55) * (1.05 - rr0 / 1.45 * .3), mats[i % 5]); }
  lump(bu + .2, bv, 2.8, .62, oliveC); lump(bu - .3, bv + .2, 2.7, .5, oliveA);
  // aerial roots: six to ten thin, slightly bowed curtains; the ones that reach the ground thicken into prop roots
  for (let i = 0; i < 9; i++) { const a = tq(0, 6.28), rr0 = tq(.5, 1.3); const u = bu + .2 + Math.cos(a) * rr0, v = bv + Math.sin(a) * rr0 * .8; const topY = 2.0 - rr0 * .15; const ground = i < 4; const endY = ground ? y0 : tq(.5, 1.2); const bow = tq(-.07, .07);
    const p0 = rel(u, v, topY), p1 = rel(u + bow, v - bow * .6, (topY + endY) / 2 + .1), p2 = rel(u + bow * .3, v, endY);
    const l1 = limb(crown, p0, p1, .012, .016, barkM, 4), l2 = limb(crown, p1, p2, .016, ground ? .045 : .01, barkM, 5); l1.castShadow = true; l2.castShadow = true; }
  mergeUnder(crown, { skipDyn: false }); R.crowns.push({ o: crown, ph: tq(0, 6), amp: .012 });
}

function tidalUpdate(wl,time){
  const P=TIDAL.pond; if(!P) return;
  const bloom=sstep(.06,.28,wl), surf=Math.max(wl,POND_FLOOR+.03)+.004, D=P.D, col=new T.Color(), dull=new T.Color(0x6b7150);
  P.PADS.forEach((p,i)=>{
    const open=sstep(-.15,.75,bloom*1.3-(i%7)*.04);
    const dr=.018*open*Math.sin(time*.23+p.ph);
    D.position.copy(W(p.u+dr,p.v+.018*open*Math.cos(time*.19+p.ph),surf+i*.0004));
    D.rotation.set(0,rotY(p.a+.06*Math.sin(time*.17+p.ph)*open),0);
    const curl=1-open;
    D.scale.set(p.r*(.5+.5*open),p.r*(1+3.2*curl),p.r*(.28+.72*open));
    D.updateMatrix();
    if(curl>.01){D.rotateZ(curl*.55);D.updateMatrix();}
    P.padIM.setMatrixAt(i,D.matrix);
    col.copy(p.col).lerp(dull,.35*curl);P.padIM.setColorAt(i,col);
  });
  P.padIM.instanceMatrix.needsUpdate=true;if(P.padIM.instanceColor)P.padIM.instanceColor.needsUpdate=true;
  const deg=Math.PI/180;
  P.FL.forEach((f,fi)=>{
    const b=sstep(f.d,f.d+.55,bloom), s=f.s*(.78+.22*b);
    const cy=surf+.012+.03*(1-b), bob=.006*Math.sin(time*.6+fi);
    const cu=f.u+.016*b*Math.sin(time*.23+f.pad.ph), cv=f.v+.016*b*Math.cos(time*.19+f.pad.ph);
    for(let k=0;k<20;k++){
      let n,j,L0,a,off;
      if(k<4){n=4;j=k;L0=.17;a=(72-62*b)*deg;off=Math.PI/4;}
      else if(k<12){n=8;j=k-4;L0=.165;a=(80-56*b)*deg;off=Math.PI/8;}
      else{n=8;j=k-12;L0=.125;a=(86-38*b)*deg;off=0;}
      D.position.copy(W(cu,cv,cy+bob+(k<4?-.004:k<12?0:.006)));
      D.rotation.set(0,0,0);D.updateMatrix();
      D.rotation.order='YXZ';D.rotation.set(-a,rotY(f.yaw)+off+j*2*Math.PI/n,0);
      D.scale.set(L0*s*.36,L0*s,L0*s);D.updateMatrix();P.petIM.setMatrixAt(fi*20+k,D.matrix);
    }
    D.rotation.order='XYZ';D.rotation.set(0,0,0);D.position.copy(W(cu,cv,cy+bob+.012));D.scale.setScalar(s*(.4+.6*b));D.updateMatrix();P.heartIM.setMatrixAt(fi,D.matrix);
  });
  P.petIM.instanceMatrix.needsUpdate=true;P.heartIM.instanceMatrix.needsUpdate=true;
}

// ---------- 疊月橋 moon clock (SPEC 9.6.2 / 9.6.4): phases on the arch, the closing ripple, and the night window in the lake shader ----------
const BFX = { k: 0, force: null, rip: -1, wasHigh: false, u: BR.cu, v: BR.cv - BR.D / 2 - 0.03, phase: 0, amp: 0 };
const _bp = new T.Vector3();
function bridgeFxUpdate(dt) {
  const eff = (playing || sim === 0 || forceMotion) ? dt : 0;     // paused = frozen
  const hi = WL >= 0.2985;
  const want = BFX.force === null ? (hi ? 1 : 0) : (BFX.force ? 1 : 0);
  if (want > BFX.k) BFX.k = Math.min(1, BFX.k + (reduceMotion ? 1 : eff / 1.4));        // opens from the centre outwards
  else if (want < BFX.k) BFX.k = Math.max(0, BFX.k - (reduceMotion ? 1 : eff / 4.0));   // the night draws in from the rim, about 4 s
  if (hi && !BFX.wasHigh && BFX.force === null && !reduceMotion) BFX.rip = 0;           // the circle closes: one slow ripple (about 3 s)
  BFX.wasHigh = hi;
  if (BFX.rip >= 0) { BFX.rip += eff / 3; if (BFX.rip >= 1) BFX.rip = -1; }
  // moon phase on the soffit and lips: waxing from the left, 0.15 -> 0.30 of water level (a thin crescent at night even at low tide)
  const p = sstep(0.15, 0.30, WL), nightK = sstep(0.65, 0.97, cur.star);
  const amp = nightK * 0.55 + (1 - nightK * 0.55) * sstep(0.0, 0.12, p);
  const hw = (30 + 150 * p) * Math.PI / 180;
  BFX.phase = p; BFX.amp = amp;
  const geo = BR.ring.geo, pos = geo.attributes.position, col = BR.ring.col, N = BR.ring.N, R = BR.R, SP = BR.SP, nF = (N + 1) * 2;
  const dayK = 1 - nightK, act = sstep(0.0, 0.12, p);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i) - SP, z = pos.getZ(i), a = Math.atan2(y, x), r = Math.hypot(x, y), d = Math.abs(a - Math.PI);
    let lit = 1 - sstep(hw - 0.30, hw + 0.04, d);
    lit *= (1 - 0.55 * (d / hw)) * (1 - p * p) + p * p;           // a crescent tapers to its tips; the full ring is even
    let w;
    if (i < nF * 2) w = Math.max(0, 1 - (r - R) / 0.11);            // front / back lip: brightest on the inner edge
    else w = 0.35 + 0.65 * sstep(0.0, 0.62, Math.abs(z) / (BR.D / 2));   // soffit: brightest toward the open ends
    const l = Math.min(0.92, amp * lit * w * (1.7 + 0.4 * nightK));
    // by day the part of the ring the moon has not reached yet falls into a cool shade, so the growing light reads against pale stone
    const dk = dayK * act * (1 - lit) * (i < nF * 2 ? Math.max(0, 1 - (r - R) / 0.2) : 0.5) * 1.0;
    const al = l + dk * (1 - l);
    const lw = al > 1e-4 ? l / al : 1;
    col[i * 4] = 0.90 * lw + 0.30 * (1 - lw); col[i * 4 + 1] = 0.96 * lw + 0.38 * (1 - lw); col[i * 4 + 2] = lw + 0.55 * (1 - lw); col[i * 4 + 3] = al;
  }
  geo.attributes.color.needsUpdate = true;
}
function bridgeFxPrepare() {
  camera.updateMatrixWorld();
  const q = (u, v, y) => { _bp.copy(W(u, v, y)).project(camera); return [(_bp.x + 1) / 2 * uRes.x, (_bp.y + 1) / 2 * uRes.y]; };
  const c = q(BR.cu, BFX.v, BR.SP), ex = q(BR.cu + 1, BFX.v, BR.SP), ey = q(BR.cu, BFX.v, BR.SP + 1);
  const exx = ex[0] - c[0], exy = ex[1] - c[1], eyx = ey[0] - c[0], eyy = ey[1] - c[1], det = exx * eyy - eyx * exy || 1e-6;
  WU.uWinC.value.set(c[0], c[1]);
  WU.uWinM.value.set(eyy / det, -exy / det, -eyx / det, exx / det);     // inverse of [ex ey]: screen px -> arch-plane units (across, up)
  WU.uWinK.value = BFX.k; WU.uWinR.value = BR.R;
  WU.uBrip.value.set(BFX.u, BFX.v, BFX.rip);
  WU.uWinGlow.value = BFX.k * sstep(0.65, 0.97, cur.star);
  WU.uWinDay.value = 1 - Math.min(1, Math.max(0, (1 - cur.bot) / 0.65));   // 1 by day, 0.77 at dawn, 0.54 at dusk, 0 at night (cur.bot is 1 / .85 / .7 / .35)
}

// ---- merge everything static into a few draw calls ----
const mergedGroups = mergeUnder(scene);

// =====================================================================
// stage 2 · environment life: egret, fish, dragonflies, fireflies (pure staging, no link to lamps or events)
// Everything advances on the effective motion clock (tAcc): paused = frozen; reduced motion = slower clock, no flights, no dragonflies.
// =====================================================================
const LIFE = (() => {
  const lr = mulberry(0x9e3779b1); const lq = (a, b) => a + (b - a) * lr();
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const stdM = (c, r) => new T.MeshStandardMaterial({ color: c, flatShading: true, roughness: r === undefined ? 0.9 : r });
  const grp = new T.Group(); grp.userData.noSolid = true; scene.add(grp);
  const ML = { white: stdM(0xf4f2ea), beak: stdM(0xe3a32a, 0.7), leg: stdM(0x2c2a27), fish: stdM(0xc4d0d4, 0.5), df: stdM(0x3c8f9c, 0.6), dfRed: stdM(0xb8563d, 0.7) };
  const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  const seg = (len, r0, r1, sides) => { const g = new T.CylinderGeometry(r1, r0, len, sides || 6); g.translate(0, len / 2, 0); return g; };
  const flatPrism = (pts, th) => { const sh = new T.Shape(); pts.forEach((p, i) => { if (i) sh.lineTo(p[0], -p[1]); else sh.moveTo(p[0], -p[1]); }); const g = new T.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; };   // outline given as (x, z)

  // ---------------------------------------------------------------- egret
  const EGH = { A: [-13.4, -5.7], B: [-1.3, -10.45], C: [9.9, 0.55], D: [-3.6, -3.4] };   // A reed-island south shallows, B outside the stone ring, C foot of the pine rock, D the drowned edge of the terrace
  const root = new T.Group(); grp.add(root);
  const hip = new T.Group(); root.add(hip);
  const bs = new T.Group(); hip.add(bs);
  { const body = mesh(new T.SphereGeometry(0.16, 8, 6), ML.white, bs, 0, 0, 0); body.scale.set(0.82, 0.78, 1.55); body.castShadow = true;
    const tail = mesh(new T.ConeGeometry(0.06, 0.26, 5), ML.white, bs, 0, -0.03, -0.32); tail.rotation.x = -Math.PI / 2 - 0.25; tail.castShadow = true;
    [-1, 1].forEach((sd) => { const w = mesh(new T.SphereGeometry(0.14, 7, 5), ML.white, bs, sd * 0.125, 0.03, -0.05); w.scale.set(0.35, 0.7, 1.7); w.castShadow = true; });
    const br = mesh(new T.SphereGeometry(0.1, 7, 5), ML.white, bs, 0, 0.0, 0.16); br.scale.set(0.9, 1.0, 1.0); br.castShadow = true;
    mergeUnder(bs, { skipDyn: false, always: true }); }
  const nkBase = new T.Group(); nkBase.position.set(0, 0.07, 0.2); hip.add(nkBase);
  const nk1 = new T.Group(); nkBase.add(nk1); { const m = mesh(seg(0.27, 0.05, 0.036), ML.white, nk1); m; }
  const nk2 = new T.Group(); nk2.position.y = 0.27; nk1.add(nk2); { const m = mesh(seg(0.27, 0.036, 0.03), ML.white, nk2); m; }
  const hd = new T.Group(); hd.position.y = 0.27; nk2.add(hd);
  { const h = mesh(new T.SphereGeometry(0.042, 7, 5), ML.white, hd, 0, 0.01, 0); h.scale.set(0.9, 1.2, 1.1); h; const bg = new T.ConeGeometry(0.022, 0.19, 5); bg.translate(0, 0.095, 0); const bk = mesh(bg, ML.beak, hd, 0, 0.03, 0); bk; }
  const legs = [-1, 1].map((sd) => {
    const th = new T.Group(); th.position.set(sd * 0.055, 0, -0.02); hip.add(th);
    const tg = new T.CylinderGeometry(0.03, 0.024, 0.24, 5); tg.translate(0, -0.12, 0); mesh(tg, ML.white, th);
    const sh = new T.Group(); sh.position.y = -0.24; th.add(sh);
    const shg = new T.Group(); sh.add(shg); const sg2 = new T.CylinderGeometry(0.016, 0.013, 0.26, 5); sg2.translate(0, -0.13, 0); mesh(sg2, ML.leg, shg); mesh(new T.BoxGeometry(0.05, 0.012, 0.11), ML.leg, shg, 0, -0.262, 0.04);
    mergeUnder(shg, { skipDyn: false, always: true });
    return { th, sh };
  });
  const wings = [-1, 1].map((sd) => {
    const w = new T.Group(); w.position.set(sd * 0.12, 0.07, 0.05); hip.add(w);
    const inner = flatPrism([[0, 0.12], [sd * 0.46, 0.10], [sd * 0.46, -0.12], [0, -0.14]], 0.02); const im = new T.Mesh(inner, ML.white); im; w.add(im);
    const o = new T.Group(); o.position.x = sd * 0.46; w.add(o);
    const outer = flatPrism([[0, 0.10], [sd * 0.44, 0.0], [sd * 0.40, -0.14], [0, -0.12]], 0.016); const om = new T.Mesh(outer, ML.white); om; o.add(om);
    w.visible = false; return { w, o, sd };
  });
  const POSE0 = { hipY: 0.49, pitch: 0, n1: 0.5, n2: -0.95, n3: 2.2, twist: 0, nl: 1, thA: 0.1, shA: -0.2 };
  const poseFor = (st) => {
    switch (st) {
      case 'peck': return { hipY: 0.44, pitch: 0.45, n1: 0.45, n2: 1.4, n3: 0.6, twist: 0, nl: 1, thA: 0.5, shA: -0.8 };
      case 'preen': return { hipY: 0.49, pitch: 0.06, n1: 1.05, n2: 1.35, n3: 1.0, twist: 0.75, nl: 1, thA: 0.1, shA: -0.2 };
      case 'sleep': return { hipY: 0.38, pitch: -0.05, n1: -0.2, n2: 2.8, n3: -3.9, twist: 0, nl: 0.62, thA: 0.55, shA: -1.3 };
      case 'fly': return { hipY: 0.56, pitch: -0.12, n1: -0.6, n2: 1.9, n3: -0.1, twist: 0, nl: 1, thA: 1.25, shA: 0.05 };
      default: return POSE0;
    }
  };
  const P = Object.assign({}, POSE0);
  const EG = { state: 'stand', t: 0, dur: 4, u: EGH.A[0], v: EGH.A[1], y: groundH(EGH.A[0], EGH.A[1]), phi: 0, phiT: 0, home: 'A', force: null, fly: null, gait: 0, stab: 0, flap: 0, tgt: null, nextFly: lq(140, 300), bob: 0, lift: 0 };
  const depthAt = (u, v, WL) => WL - groundH(u, v);
  const setState = (st, dur) => { EG.state = st; EG.t = 0; EG.dur = dur; EG.stab = 0; };
  function startFly(home, WLn) {
    const to = EGH[home]; const d = Math.hypot(to[0] - EG.u, to[1] - EG.v);
    EG.fly = { u0: EG.u, v0: EG.v, y0: EG.y, u1: to[0], v1: to[1], y1: groundH(to[0], to[1]), T: 1.5 + d / 4.6, s: 0, home };
    EG.phiT = Math.atan2(to[1] - EG.v, to[0] - EG.u); setState('fly', EG.fly.T);
  }
  function pickWalk() { const WL = 0; for (let k = 0; k < 12; k++) { const a = EG.phi + lq(-1.0, 1.0), L2 = lq(0.9, 1.4), tu = EG.u + Math.cos(a) * L2, tv = EG.v + Math.sin(a) * L2; EG.tgt = [tu, tv]; EG.phiT = a; break; } }
  // ---- SPEC 8.6: the egret keeps its distance from the traveller ----
  const away = {};   // stop -> egret clock until which it stays off limits (60 s after leaving it)
  const nearRoute = (u, v, pts, r) => { if (!pts) return false; for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i][0] - u, pts[i][1] - v) < r) return true; return false; };
  function startFlyOff(du, dv) {
    const d = Math.hypot(du, dv) || 1, far = 38;
    EG.fly = { u0: EG.u, v0: EG.v, y0: EG.y, u1: EG.u + du / d * far, v1: EG.v + dv / d * far, y1: 0, T: 1.5 + far / 4.6, s: 0, home: null, off: true };
    EG.phiT = Math.atan2(dv, du); setState('fly', EG.fly.T);
  }
  function fleeCheck(ctx, force) {
    if (!ctx.trav || EG.force || EG.state === 'fly' || EG.state === 'off') return false;
    const tu = ctx.trav[0], tv = ctx.trav[1], d = Math.hypot(EG.u - tu, EG.v - tv);
    if (!force && d >= 2.5) return false;
    if (EG.state === 'walk' && EG.fleeWalk && !force) { if (d >= 1.6) return false; }
    const asleep = EG.state === 'sleep', wantWalk = force ? force === 'walk' : lr() < 0.6;
    if (!asleep && wantWalk && !(EG.state === 'walk' && EG.fleeWalk)) {
      const ax = Math.atan2(EG.v - tv, EG.u - tu);
      for (let k = 0; k < 20; k++) { const a = ax + lq(-1.0, 1.0), L2 = lq(0.8, 1.4), u2 = EG.u + Math.cos(a) * L2, v2 = EG.v + Math.sin(a) * L2; const dd = depthAt(u2, v2, ctx.WL); if (dd > 0.03 && dd < 0.28 && Math.hypot(u2 - tu, v2 - tv) >= 3.2) { EG.tgt = [u2, v2]; EG.phiT = a; EG.fleeWalk = true; setState('walk', 9); return true; } }
    }
    EG.fleeWalk = false;
    const opts = Object.keys(EGH).filter((h) => h !== EG.home && (away[h] || 0) <= EG.clock && Math.hypot(EGH[h][0] - tu, EGH[h][1] - tv) >= 4 && Math.hypot(EGH[h][0] - tu, EGH[h][1] - tv) > d && !nearRoute(EGH[h][0], EGH[h][1], ctx.route, 2.5));
    away[EG.home] = EG.clock + 60;
    if (opts.length) startFly(opts[Math.floor(lr() * opts.length)], ctx.WL); else startFlyOff(EG.u - tu, EG.v - tv);
    return true;
  }
  function egretUpdate(dt, ctx) {
    const WL = ctx.WL, night = ctx.night, calm = MOTION < 1;
    EG.t += dt; EG.clock = (EG.clock || 0) + dt;
    if (EG.state === 'off') {
      root.visible = false;
      if (EG.clock >= EG.offUntil) {   // back from behind the mist: to the stop farthest from him
        const tr = ctx.trav || [0, 0]; let best = 'A', bd = -1; Object.keys(EGH).forEach((h) => { const dd = Math.hypot(EGH[h][0] - tr[0], EGH[h][1] - tr[1]); if (dd > bd && (away[h] || 0) <= EG.clock) { bd = dd; best = h; } });
        const h = EGH[best]; let dx = h[0] - 0.8, dz = h[1] - 2.6; const dl = Math.hypot(dx, dz) || 1; EG.u = h[0] + dx / dl * 38; EG.v = h[1] + dz / dl * 38; EG.y = 0; root.visible = true; startFly(best, WL);
      }
      return;
    }
    root.visible = true;
    if (EG.state === 'fly') {
      const f = EG.fly; f.s = Math.min(1, EG.t / f.T); const e = ss(0, 1, f.s);
      EG.u = f.u0 + (f.u1 - f.u0) * e; EG.v = f.v0 + (f.v1 - f.v0) * e; EG.y = f.y0 + (f.y1 - f.y0) * e;
      EG.lift = 1.55 * Math.pow(Math.sin(Math.PI * e), 0.8);
      EG.flap += dt * Math.PI * 2 * (f.s > 0.86 ? 2.6 : 3.4);
      EG.phi = lerpAng(EG.phi, EG.phiT, 1 - Math.exp(-dt * 6));
      if (f.s >= 1) {
        if (f.off) { EG.state = 'off'; EG.offUntil = EG.clock + 60; EG.lift = 0; EG.fly = null; root.visible = false; return; }
        EG.home = f.home; EG.lift = 0; EG.phiT = lq(-0.6, 0.6); setState('stand', 3); EG.nextFly = lq(140, 300);
      }
    } else {
      EG.lift *= Math.exp(-dt * 8);
      if (!EG.force && fleeCheck(ctx, false)) { /* startled: the state was set above */ }
      else if (!EG.force) {
        // sleep at night, wake at dawn
        if (night && EG.state !== 'sleep') setState('sleep', 1e9);
        else if (!night && EG.state === 'sleep') setState('stand', 2.5);
        // the tide decides where a bird can stand: it moves before the water gets too deep (or before its stone dries out)
        const d = depthAt(EG.u, EG.v, WL);
        if (!calm && (d > 0.32 || d < -0.02)) startFly(WL > 0.11 && depthAt(EGH.D[0], EGH.D[1], WL) >= -0.02 ? 'D' : 'A', WL);
        else if (EG.t >= EG.dur && EG.state !== 'sleep') {
          const r = lr();
          EG.nextFly -= Math.min(EG.dur, 8);   // roughly the seconds spent since the last decision
          if (!calm && EG.nextFly <= 0 && WL < 0.06 && !night) { const opts = ['A', 'B', 'C'].filter((h) => h !== EG.home && (away[h] || 0) <= EG.clock); if (opts.length) startFly(opts[Math.floor(lr() * opts.length)], WL); }
          else if (r < 0.28) { setState('stand', lq(3, 7)); if (lr() < 0.3) EG.phiT = EG.phi + lq(-2.4, 2.4) * (lr() < 0.5 ? 1 : -1); }
          else if (r < 0.58) { setState('peck', lq(3, 4.2)); }
          else if (r < 0.83) {
            // walk two or three steps along the shallows
            for (let k = 0; k < 12; k++) { const a = EG.phi + lq(-1.2, 1.2), L2 = lq(0.55, 1.1), tu = EG.u + Math.cos(a) * L2, tv = EG.v + Math.sin(a) * L2; const dd = depthAt(tu, tv, WL); if (dd > 0.03 && dd < 0.28 && Math.hypot(tu - EGH[EG.home][0], tv - EGH[EG.home][1]) < 2.4) { EG.tgt = [tu, tv]; EG.phiT = a; break; } }
            if (EG.tgt) setState('walk', 6); else setState('stand', 3);
          } else setState('preen', 3.6);
        }
      }
      if (EG.state === 'walk' && EG.tgt) {
        const dx = EG.tgt[0] - EG.u, dv = EG.tgt[1] - EG.v, dist = Math.hypot(dx, dv), sp = 0.3 * dt;
        EG.phiT = Math.atan2(dv, dx);
        if (Math.abs(lerpAng(EG.phi, EG.phiT, 1) - EG.phi) < 0.6) { const st = Math.min(sp, dist); EG.u += dx / dist * st; EG.v += dv / dist * st; EG.gait += st * 11; }
        if (dist < 0.05) { EG.tgt = null; if (EG.force === 'walk') pickWalk(); else setState('stand', lq(2.5, 5)); }
      } else if (EG.state !== 'walk') EG.gait *= 0.9;
      EG.phi = lerpAng(EG.phi, EG.phiT, 1 - Math.exp(-dt * 3.5));
      EG.y += (groundH(EG.u, EG.v) - EG.y) * (1 - Math.exp(-dt * 10));
    }
    // ---- pose (smoothed toward the target of the current state) ----
    const st = EG.state, tg = poseFor(st), kpos = 1 - Math.exp(-dt * (st === 'peck' ? 11 : 5.5));
    if (st === 'peck') {
      // two quick stabs per cycle; when the test hook holds the state, hold the stab
      const c = EG.force ? 1 : Math.max(ss(0.55, 0.75, EG.t % 1.5) * (1 - ss(0.95, 1.15, EG.t % 1.5)), 0);
      Object.assign(tg, { n1: POSE0.n1 + (tg.n1 - POSE0.n1) * (0.25 + 0.75 * c), n2: POSE0.n2 + (tg.n2 - POSE0.n2) * (0.25 + 0.75 * c), n3: POSE0.n3 + (tg.n3 - POSE0.n3) * (0.25 + 0.75 * c) });
    }
    if (st === 'preen') tg.n3 += 0.28 * Math.sin(EG.t * 9);
    for (const k in tg) P[k] += (tg[k] - P[k]) * kpos;
    const breath = (st === 'stand' || st === 'sleep') ? 0.004 * Math.sin(EG.t * 2.2) : 0;
    hip.position.y = P.hipY + breath + (st === 'walk' ? 0.012 * Math.abs(Math.sin(EG.gait)) : 0); hip.rotation.x = P.pitch;
    nkBase.rotation.y = P.twist + (st === 'stand' ? 0.16 * Math.sin(EG.t * 0.5) : 0); nk1.rotation.x = P.n1; nk2.rotation.x = P.n2; hd.rotation.x = P.n3;
    nk1.scale.y = P.nl; hd.scale.y = 1 / P.nl;
    legs.forEach((lg, i) => {
      let a = P.thA, b = P.shA;
      if (st === 'walk') { const s = Math.sin(EG.gait + i * Math.PI); a += s * 0.5; b += 0.9 * Math.max(0, -s); }
      if (st === 'sleep' && i === 1) { a = -0.2; b = 1.9; }
      lg.th.rotation.x = a; lg.sh.rotation.x = b;
    });
    const fl = st === 'fly'; wings.forEach((w) => { w.w.visible = fl; if (fl) { w.w.rotation.z = w.sd * (0.65 * Math.sin(EG.flap) + 0.08); w.o.rotation.z = w.sd * (0.4 * Math.sin(EG.flap - 1.0) + 0.05); } });
    root.position.copy(W(EG.u, EG.v, EG.y + EG.lift)); root.rotation.y = EG.phi + 0.75 * Math.PI;
  }

  // ---------------------------------------------------------------- fish that jump, drops and ripple rings
  const jump = new T.Group(); jump.visible = false; grp.add(jump);
  { const b = mesh(new T.SphereGeometry(0.09, 7, 5), ML.fish, jump, 0, 0, 0); b.scale.set(0.8, 0.8, 2.6); const tl = mesh(new T.ConeGeometry(0.06, 0.14, 4), ML.fish, jump, 0, 0, -0.27); tl.rotation.x = -Math.PI / 2; tl.scale.set(1, 0.3, 1); }
  const dropMat = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const drops = []; for (let i = 0; i < 7; i++) { const d = mesh(new T.IcosahedronGeometry(0.03, 0), dropMat, grp); d.visible = false; drops.push({ m: d, vx: 0, vy: 0, vz: 0 }); }
  const rings = []; for (let i = 0; i < 2; i++) { const g = new T.RingGeometry(0.9, 1.0, 40); g.rotateX(-Math.PI / 2); const m = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: false }); const r = new T.Mesh(g, m); r.layers.set(2); r.visible = false; grp.add(r); rings.push({ r, m, t: -1, delay: i * 0.4 }); }
  const JF = { on: false, t: 0, u: 0, v: 0, dx: 1, dz: 0, next: lq(12, 24), T: 0.9, WL: 0 };
  const DEEP = [[-7, -7], [5, -7], [-9, 7], [8, 8], [14, -2], [-2, 16.5], [-18, -8], [13, 12], [-6, 1.5], [4, 15]];
  function splash(u, v, WL, big) {
    rings.forEach((q) => { q.t = -q.delay; q.u = u; q.v = v; q.big = big ? 1.25 : 1; q.active = true; });
    drops.forEach((d) => { const a = lq(0, 6.283), sp = lq(0.25, 0.7); d.m.visible = true; d.age = 0; d.u = u; d.v = v; d.y = WL + 0.02; d.vu = Math.cos(a) * sp * 0.5; d.vv = Math.sin(a) * sp * 0.5; d.vy = lq(1.4, 2.4); });
  }
  function startJump(u, v, WL) {
    if (u === undefined) { for (let k = 0; k < 20; k++) { const a = DEEP[Math.floor(lr() * DEEP.length)]; u = a[0] + lq(-2.5, 2.5); v = a[1] + lq(-2.5, 2.5); if (groundH(u, v) < -0.7) break; } }
    const a = lq(0, 6.283); Object.assign(JF, { on: true, t: 0, u, v, dx: Math.cos(a), dz: Math.sin(a), WL });
    jump.visible = true; splash(u, v, WL, false);
  }
  const dirTmp = new T.Vector3(), posTmp = new T.Vector3(), zero3 = W(0, 0, 0);
  function jumpUpdate(dt, ctx) {
    const WL = ctx.WL;
    if (!JF.on && !rings.some((q) => q.active)) { JF.next -= dt; if (JF.next <= 0) { startJump(undefined, undefined, WL); JF.next = lq(20, 40); } }
    if (JF.on) {
      JF.t += dt; const s = JF.t / JF.T;
      if (s >= 1) { JF.on = false; jump.visible = false; splash(JF.u, JF.v, WL, true); }
      else {
        const ph = s * 2 - 1, y = WL + 0.05 + 0.62 * (1 - ph * ph); const uu = JF.u + JF.dx * 0.55 * (s - 0.5), vv = JF.v + JF.dz * 0.55 * (s - 0.5);
        posTmp.copy(W(uu, vv, y)); jump.position.copy(posTmp);
        dirTmp.copy(W(JF.dx, JF.dz, 0)).sub(zero3).multiplyScalar(0.55 / JF.T); dirTmp.y = -2.48 * ph / JF.T;
        jump.lookAt(posTmp.x + dirTmp.x, posTmp.y + dirTmp.y, posTmp.z + dirTmp.z); jump.rotateZ(s * 5.0);
      }
    }
    const lum = ctx.cur.haze.r * 0.3 + ctx.cur.haze.g * 0.6 + ctx.cur.haze.b * 0.1;
    rings.forEach((q) => {
      if (!q.active) return;
      q.t += dt; if (q.t < 0) { q.r.visible = false; return; }
      const L2 = 2.4; if (q.t > L2) { q.active = false; q.r.visible = false; return; }
      const x = q.t / L2; q.r.visible = true; q.r.position.copy(W(q.u, q.v, WL + 0.012)); const sc = (0.12 + 1.9 * (1 - Math.pow(1 - x, 2))) * q.big; q.r.scale.set(sc, 1, sc);
      q.m.opacity = 0.75 * (1 - x) * (1 - x) * (0.3 + 0.7 * lum);
    });
    drops.forEach((d) => { if (!d.m.visible) return; d.age += dt; d.vy -= 6.5 * dt; d.u += d.vu * dt; d.v += d.vv * dt; d.y += d.vy * dt; d.m.position.copy(W(d.u, d.v, d.y)); if (d.y < WL - 0.005 || d.age > 1.2) d.m.visible = false; });
  }

  // ---------------------------------------------------------------- little fish shadows in the tide pools (low tide only)
  const fishGeo = (() => {
    const body = new T.Shape(); for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2; const x = Math.cos(a) * 0.13 + 0.03, y = Math.sin(a) * 0.045; if (i) body.lineTo(x, y); else body.moveTo(x, y); }
    const tri = new T.Shape(); tri.moveTo(-0.08, 0); tri.lineTo(-0.2, 0.05); tri.lineTo(-0.2, -0.05); tri.lineTo(-0.08, 0);
    const pos = []; [body, tri].forEach((sh) => { const g = new T.ShapeGeometry(sh).toNonIndexed(); const p = g.attributes.position; for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), 0); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.rotateX(-Math.PI / 2); return g;
  })();
  const fishMat = new T.MeshBasicMaterial({ color: 0x2f3f47, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const poolFish = [[0, 0.24, 0.55, 0.0], [0, 0.34, -0.42, 2.4], [1, 0.3, 0.5, 1.1], [2, 0.2, 0.7, 4.0]].map((q) => { const m = new T.Mesh(fishGeo, fishMat); m.layers.set(2); m.visible = false; grp.add(m); return { m, pool: POOLS[q[0]], r: q[1], w: q[2], ph: q[3] }; });
  function poolUpdate(t, ctx) {
    const k = 1 - ss(0.0, 0.22, ctx.tide); fishMat.opacity = 0.5 * k;
    poolFish.forEach((f) => {
      f.m.visible = k > 0.02; if (!f.m.visible) return;
      const a = t * f.w + f.ph + 0.35 * Math.sin(t * 0.9 + f.ph * 3), sg = f.w > 0 ? 1 : -1;
      const u = f.pool[0] + Math.cos(a) * f.r, v = f.pool[1] + Math.sin(a) * f.r * 0.8;
      f.m.position.copy(W(u, v, ctx.WL + 0.006)); f.m.rotation.y = Math.atan2(0.8 * Math.cos(a) * sg, -Math.sin(a) * sg) + Math.PI / 4; f.m.scale.set(1 + 0.12 * Math.sin(t * 6 + f.ph), 1, 1);
    });
  }

  // ---------------------------------------------------------------- dragonflies (day only)
  const wingGeo = () => { const p = []; const quad = (a, b, c, d) => { p.push(...a, ...b, ...c, ...a, ...c, ...d); }; [-1, 1].forEach((sd) => { const dh = 0.22; quad([0, 0, 0.05], [sd * 0.21, dh * 0.21, 0.045], [sd * 0.21, dh * 0.21, 0.0], [0, 0, 0.0]); quad([0, 0, -0.005], [sd * 0.19, dh * 0.19, -0.008], [sd * 0.19, dh * 0.19, -0.055], [0, 0, -0.045]); }); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); return g; };
  const dfWingMat = new T.MeshBasicMaterial({ color: 0xe8f4f6, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false, fog: false });
  const dragons = [{ c: [-13.6, -1.0], m: ML.df }, { c: [-10.3, 0.5], m: ML.dfRed }].map((q, i) => {
    const g = new T.Group(); grp.add(g); const b = new T.CylinderGeometry(0.014, 0.008, 0.3, 5); b.rotateX(Math.PI / 2); b.translate(0, 0, -0.06); mesh(b, q.m, g); mesh(new T.SphereGeometry(0.03, 6, 5), q.m, g, 0, 0, 0.1);
    mergeUnder(g, { skipDyn: false, always: true });
    const wg = new T.Mesh(wingGeo(), dfWingMat); wg.position.y = 0.014; g.add(wg);
    const s = { g, wg, c: q.c, u: q.c[0] + lq(-2, 2), v: q.c[1] + lq(-2, 2), y: 1.2, tu: 0, tv: 0, ty: 1.2, hover: lq(0.5, 2), yaw: lq(0, 6), ph: i * 2 };
    s.tu = s.u; s.tv = s.v; g.visible = false; return s;
  });
  function dragonUpdate(dt, t, ctx) {
    const df = MOTION < 1 ? 0 : ss(0.7, 0.95, ctx.cur.glint);
    dragons.forEach((d) => {
      d.g.visible = df > 0.05; if (!d.g.visible) return; d.g.scale.setScalar(Math.min(1, df * 1.4) * 1.25);
      d.hover -= dt;
      if (d.hover <= 0) { d.tu = d.c[0] + lq(-3.6, 3.6); d.tv = d.c[1] + lq(-2.8, 2.8); d.ty = lq(0.9, 2.1); d.hover = lq(1.2, 3.2); }
      const dx = d.tu - d.u, dv = d.tv - d.v, dy = d.ty - d.y, dist = Math.hypot(dx, dv, dy);
      if (dist > 0.03) { const sp = Math.min(dist, (dist > 0.6 ? 3.6 : 1.2) * dt); d.u += dx / dist * sp; d.v += dv / dist * sp; d.y += dy / dist * sp; d.yaw = lerpAng(d.yaw, Math.atan2(dv, dx), 1 - Math.exp(-dt * 10)); }
      const jit = 0.03 * Math.sin(t * 9 + d.ph);
      d.g.position.copy(W(d.u, d.v, d.y + jit)); d.g.rotation.y = d.yaw + 0.75 * Math.PI;
      d.wg.scale.y = 0.2 + 2.6 * Math.sin(t * 46 + d.ph);   // both wings beat together: the wing tips rise and fall
    });
  }

  // ---------------------------------------------------------------- fireflies (night; they show in the reflection too)
  const FFB = [[-14, -1.5, 0.7], [-12, 0.5, 1.0], [-10, -2.2, 0.6], [-16, -3, 0.8], [-11.5, -0.8, 1.35], [-13.5, 1, 0.9], [9.0, 1.2, 0.9], [8.4, 2.4, 1.25], [10.8, 0.9, 0.7], [11.6, 2.4, 1.5]];
  const flies = FFB.map((b) => ({ b, ph: lq(0, 6.28), f1: lq(0.12, 0.25), f2: lq(0.1, 0.22), f3: lq(0.3, 0.6), rx: lq(0.5, 1.3), ry: lq(0.5, 1.3), bl: lq(0.25, 0.6) }));
  // all ten are one Points object (one draw per pass); the point size follows the current render target so the reflection glows like the main view
  const ffPos = new Float32Array(flies.length * 3), ffA = new Float32Array(flies.length);
  const ffGeo = new T.BufferGeometry(); ffGeo.setAttribute('position', new T.BufferAttribute(ffPos, 3)); ffGeo.setAttribute('aA', new T.BufferAttribute(ffA, 1));
  const ffMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uPx: { value: 20 } },
    vertexShader: 'attribute float aA; varying float vA; uniform float uPx; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx; }',
    fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float g = pow(max(0.0, 1.0 - r), 2.2) * 0.8; float core = smoothstep(0.2, 0.0, r); vec3 col = mix(vec3(0.81, 0.96, 0.42), vec3(0.97, 1.0, 0.72), core); gl_FragColor = vec4(col, min(1.0, g + core) * vA); }' });
  const ffPts = new T.Points(ffGeo, ffMat); ffPts.frustumCulled = false; ffPts.visible = false; grp.add(ffPts);
  ffPts.onBeforeRender = (rd, sc, cam) => { const tgt = rd.getRenderTarget(); const h = tgt ? tgt.height : rd.domElement.height; ffMat.uniforms.uPx.value = 0.55 * h / ((cam.top - cam.bottom) / cam.zoom); };
  function flyUpdate(t, ctx) {
    const nf = ss(0.3, 0.8, ctx.cur.star); ffPts.visible = nf > 0.02; if (!ffPts.visible) return;
    flies.forEach((f, i) => {
      const u = f.b[0] + Math.sin(t * f.f1 + f.ph) * f.rx + Math.sin(t * f.f1 * 2.3 + f.ph * 2) * 0.25, v = f.b[1] + Math.sin(t * f.f2 + f.ph * 1.7) * f.ry, y = f.b[2] + Math.sin(t * f.f3 + f.ph) * 0.25;
      const p = W(u, v, y); ffPos[i * 3] = p.x; ffPos[i * 3 + 1] = p.y; ffPos[i * 3 + 2] = p.z;
      const pulse = MOTION < 1 ? 0.7 : Math.pow(0.5 + 0.5 * Math.sin(t * f.bl * 6.28 + f.ph * 3), 2.2);
      ffA[i] = nf * (0.25 + 0.75 * pulse);
    });
    ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.aA.needsUpdate = true;
  }

  // ---------------------------------------------------------------- mirror shard: an occasional flash in daylight
  const SH = { next: lq(14, 30), t: -1 };
  function shardUpdate(dt, ctx) {
    if (!PAVFX.star) return;
    const day = ss(0.6, 0.95, ctx.cur.glint) * (MOTION < 1 ? 0.5 : 1);
    if (SH.t < 0) { SH.next -= dt; if (SH.next <= 0 && day > 0.5) { SH.t = 0; SH.next = lq(18, 42); } }
    let k = 0;
    if (SH.t >= 0) { SH.t += dt; const x = SH.t / 0.9; if (x >= 1) { SH.t = -1; } else k = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 2; }
    if (SH.force) k = 1;
    PAVFX.star.visible = k > 0.01; PAVFX.star.scale.setScalar(0.22 + 0.4 * k); PAVFX.starM.opacity = 0.95 * k;
    PAVFX.shardM.color.setRGB(0.70 + 0.30 * k, 0.79 + 0.21 * k, 0.85 + 0.15 * k);
  }

  // ---------------------------------------------------------------- driver
  let lastT = 0, lastCtx = null;
  return {
    update(tNow, ctx) {
      lastCtx = ctx; const dt = Math.max(0, Math.min(0.25, tNow - lastT)); lastT = tNow;
      ctx.night = ctx.cur.star > 0.55;
      egretUpdate(dt, ctx); jumpUpdate(dt, ctx); poolUpdate(tNow, ctx); dragonUpdate(dt, tNow, ctx); flyUpdate(tNow, ctx); shardUpdate(dt, ctx);
    },
    reset() { lastT = 0; },
    egret(state) {
      if (state === undefined || state === null || state === 'auto') { EG.force = null; return; }
      if (state === 'fly') { EG.force = null; const opts = ['A', 'B', 'C'].filter((h) => h !== EG.home); startFly(opts[0], 0); return; }
      EG.force = state; setState(state, 1e9); EG.fly = null; EG.lift = 0; if (state === 'walk') pickWalk();
    },
    flee(kind) { if (lastCtx) fleeCheck(lastCtx, kind === 'walk' ? 'walk' : 'fly'); },
    egretGoto(home) { const h = EGH[home]; EG.u = h[0]; EG.v = h[1]; EG.y = groundH(h[0], h[1]); EG.home = home; EG.tgt = null; },
    egretPhi(p) { EG.phi = EG.phiT = p; },
    egretPos() { return [EG.u, EG.v, EG.y + EG.lift]; },
    fish(u, v, WL) { startJump(u, v, WL === undefined ? 0 : WL); },
    shard(on) { SH.force = !!on; },
    callTo(home) { if (EG.state !== 'fly' && EG.state !== 'off' && EG.home !== home && EGH[home]) startFly(home, lastCtx ? lastCtx.WL : 0); },
    homes: EGH
  };
})();

// =====================================================================
// the lake: reflection render target, sky and water shader (SPEC 3)
// =====================================================================
const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 400);
camera.layers.set(0); camera.layers.enable(2);          // main view: everything + main-only (layer 2)
const reflCam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 400);
reflCam.layers.set(0); reflCam.layers.enable(1);         // reflection: everything + reflection-only (layer 1)
const clipPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
const texMat = new T.Matrix4();
const makeRT = (w, h) => { const o = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: true, stencilBuffer: false }; return renderer.capabilities.isWebGL2 ? new T.WebGLMultisampleRenderTarget(w, h, o) : new T.WebGLRenderTarget(w, h, o); };
const rt = makeRT(800, 450);
const uRes = new T.Vector2(1600, 900);
const VERT = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const FRAG = [
'precision highp float;',
'uniform sampler2D uRefl; uniform sampler2D uGround; uniform mat4 uTex;',
'uniform float uTime, uWL, uRipple, uCloudAmt, uStar, uBot, uRingR, uHazeLo, uGlint, uTide, uGlintK;',
'uniform vec2 uWinC; uniform vec4 uWinM; uniform vec3 uBrip; uniform float uWinK, uWinR, uWinGlow, uWinDay;',
'uniform vec2 uRes, uCenter, uRingC, uHR, uSunUV; uniform vec4 uMap; uniform vec4 uRip[6];',
'uniform vec3 uSkyTop, uHaze, uCloud, uTint;',
'varying vec3 vW;',
'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0)); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }',
'float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; } return s; }',
'float wave(vec2 q){ return vn(q * 1.15 + vec2(uTime * 0.10, uTime * 0.06)) + 0.45 * vn(q * 2.2 - vec2(uTime * 0.14, uTime * 0.08)); }',
'float cloudD(vec2 p){ vec2 w = vec2(vn(p * 1.7), vn(p * 1.7 + 7.0)); return fbm(p + 0.35 * w); }',
'void main(){',
'  vec2 uv = vec2((vW.x - vW.z) * 0.70710678, -(vW.x + vW.z) * 0.70710678);',
'  float dc = length(uv - uCenter);',
// wind ripples: fade with distance, dead still inside the stone ring
'  float rfade = 1.0 - smoothstep(14.0, 46.0, dc);',
'  float ringMask = smoothstep(uRingR, uRingR + 0.22, length(uv - uRingC));',
'  float amp = 0.0026 * uRipple * rfade * ringMask;',
// wind ripples (Opus 2026-10-03): the slope used to be the finite-difference gradient of value noise, whose cells show up as a grid of
// little rectangles once it bends the cloud / star reflection (very visible at low tide, any hour). Now: five crossing sine swells with an
// analytic slope, their phase bent by smooth low-frequency noise so the pattern never lines up. No grid, same strength.
'  vec2 q = uv * 0.5; vec2 rip = vec2(0.0); float px = length(fwidth(uv));   // lake units per pixel: far water gets the fine swells faded out instead of aliasing into blocks',
'  float bend = 2.2 * (vn(q * 0.35 + vec2(uTime * 0.02, -uTime * 0.015)) - 0.5);',
'  for (int i = 0; i < 5; i++) { float fi = float(i); float an = 0.55 + fi * 1.13 + 0.25 * bend; vec2 dr = vec2(cos(an), sin(an)); float k = 1.1 + fi * 0.62; float ph = k * dot(q, dr) * 2.2 + uTime * (0.55 + 0.17 * fi) + fi * 1.7 + bend * (1.0 + fi); rip += dr * cos(ph) * (0.62 / (1.0 + fi * 0.55)) * (1.0 - smoothstep(0.35, 0.9, k * 1.1 * px * 6.0)); }',
'  rip *= amp;',
// footstep ripples (SPEC 8.4): rings of (u, v, age, maxRadius); they shake the reflection and add a faint bright line, and die at the still ring
'  vec2 ripF = vec2(0.0); float ripL = 0.0;',
'  for (int i = 0; i < 6; i++) { vec4 rp = uRip[i]; if (rp.z >= 0.0) { vec2 dvv = uv - rp.xy; float dd = length(dvv); float rad = rp.w * (1.0 - (1.0 - rp.z) * (1.0 - rp.z)); float wd = 0.06 + 0.05 * rp.z; float env = exp(-pow((dd - rad) / wd, 2.0)) * (1.0 - rp.z) * ringMask; ripF += dvv / max(dd, 0.001) * sin((dd - rad) / wd * 3.14159) * env * 0.006; ripL += env * exp(-pow((dd - rad) / (wd * 0.45), 2.0)); } }',
// procedural sky: base colour, drifting clouds, thin haze toward the top of the screen, stars at night
'  float sy = gl_FragCoord.y / uRes.y;',
'  float hazeK = uHazeLo > 0.99 ? 0.0 : pow(smoothstep(uHazeLo, 1.0, sy), 1.0 - (0.8 - uHazeLo) * 1.4);',
'  vec2 cp = (uv + rip * 80.0 - vec2(0.9, 0.44) * 0.15 * uTime) * 0.055;',
'  float d = cloudD(cp); float d2 = cloudD(cp + vec2(0.035, 0.02));',
'  float cov = smoothstep(0.50, 0.76, d + (uCloudAmt - 0.5) * 0.6);',
'  vec3 cc = mix(uCloud * 0.84, uCloud, clamp((d - d2) * 5.0 + 0.55, 0.0, 1.0));',
'  vec3 sky = mix(uSkyTop, cc, cov * 0.95);',
'  float rough = clamp(uRipple, 0.0, 1.0) * ringMask;',
'  vec2 sp = (uv + rip * 70.0 + vec2(sin(uTime * 0.7 + uv.y * 3.0), cos(uTime * 0.6 + uv.x * 3.0)) * 0.012 * rough) * 2.6; sp.y *= mix(1.0, 0.42, rough);',
'  vec2 id = floor(sp); vec2 f = fract(sp) - 0.5; float hs = hash(id + 3.7);',
'  vec2 off = (vec2(hash(id + 1.3), hash(id + 9.1)) - 0.5) * 0.55; float ds = length(f - off);',
'  float star = step(0.972, hs) * smoothstep(0.10 + 0.09 * rough, 0.015, ds) * (1.0 - 0.3 * rough) * (0.55 + 0.45 * sin(uTime * (1.2 + hs * 3.0 + rough * 2.0) + hs * 60.0)) * (0.5 + 0.9 * hash(id + 5.5));',
'  sky += uStar * star * vec3(1.0, 0.97, 0.9) * (1.0 - cov * 0.85);',
'  sky = mix(sky, uHaze, hazeK * 0.9);',
'  vec2 wq = mat2(uWinM.x, uWinM.y, uWinM.z, uWinM.w) * (gl_FragCoord.xy - uWinC);',
'  float wr = length(wq);',
'  float wedge = mix(0.016, 0.05, uWinDay);',
'  float winMask = (1.0 - smoothstep(uWinR * uWinK - wedge, uWinR * uWinK + wedge, wr)) * step(0.002, uWinK);',
'  if (winMask > 0.0) {',
'    vec3 ns = mix(vec3(0.012, 0.025, 0.075), vec3(0.055, 0.095, 0.22), clamp(0.5 + wq.y * 0.42, 0.0, 1.0));',
'    float rr = clamp(wr / max(uWinR * uWinK, 0.001), 0.0, 1.0);',
'    vec3 dayNs = mix(vec3(0.353, 0.416, 0.627), vec3(0.173, 0.227, 0.420), smoothstep(1.0, 0.85, rr));',
'    ns = mix(ns, dayNs, uWinDay);',
'    vec2 s2 = wq * 9.0; vec2 sid = floor(s2); vec2 sf = fract(s2) - 0.5; float h2 = hash(sid + 11.3);',
'    vec2 so = (vec2(hash(sid + 2.1), hash(sid + 6.7)) - 0.5) * 0.6;',
'    float stw = step(mix(0.80, 0.93, uWinDay), h2) * smoothstep(0.17, 0.01, length(sf - so)) * (0.6 + 0.4 * sin(uTime * (0.8 + h2 * 2.0) + h2 * 70.0));',
'    ns += vec3(0.95, 0.97, 1.0) * stw * (0.45 + 0.55 * hash(sid + 4.4)) * mix(1.0, 0.32, uWinDay);',
'    float mrad = mix(0.33, 0.242, uWinDay);\n    float mr2 = wr / mrad;',
'    vec2 mn = wq / mrad;',
'    float mdisk = 1.0 - smoothstep(0.965, 1.0, mr2);',
'    float maria = 0.93 + 0.07 * fbm(mn * 2.4 + vec2(3.1, 7.7)) - 0.08 * exp(-pow(length(mn - vec2(-0.30, 0.22)) * 2.8, 2.0)) - 0.06 * exp(-pow(length(mn - vec2(0.26, -0.18)) * 3.2, 2.0)) - 0.04 * exp(-pow(length(mn - vec2(0.04, 0.46)) * 4.2, 2.0));',
'    vec3 mcol = vec3(0.99, 0.97, 0.90) * maria * (1.0 - 0.10 * mr2 * mr2);',
'    float halo = exp(-mr2 * 1.15) * 0.5 + exp(-mr2 * mr2 * 0.09) * 0.14;',
'    ns += vec3(0.58, 0.68, 0.95) * halo * (1.0 - mdisk) * mix(1.0, 0.4, uWinDay);',
'    ns = mix(ns, mix(mcol, mcol * vec3(0.84, 0.88, 0.97), uWinDay), mdisk * mix(1.0, 0.82, uWinDay));',
'    sky = mix(sky, ns, winMask);',
'  }',
'  if (uBrip.z >= 0.0) { vec2 dvb = uv - uBrip.xy; float db = length(dvb); float radb = 1.25 + 4.4 * uBrip.z; float wdb = 0.17 + 0.10 * uBrip.z; float envb = exp(-pow((db - radb) / wdb, 2.0)) * (1.0 - uBrip.z) * (1.0 - winMask); ripF += dvb / max(db, 0.001) * sin((db - radb) / wdb * 3.14159) * envb * 0.007; ripL += envb * exp(-pow((db - radb) / (wdb * 0.45), 2.0)); }',
// reflection: premultiplied colour + alpha, over the sky
'  vec4 rc = uTex * vec4(vW, 1.0); vec2 ruv = rc.xy / rc.w + (rip + ripF) * (1.0 - winMask);',
'  vec4 refl = texture2D(uRefl, ruv);',
'  float rk = 0.94;',
'  refl *= (1.0 - winMask);',
'  vec3 col = refl.rgb * rk + sky * (1.0 - refl.a * rk);',
// wind texture (Opus 2026-10-03): was a hard step (noise > 0.7 -> +0.03), which drew flat pale blotches with crisp edges, very visible on the dark night lake.
// Now a soft, multiplicative brightness variation of a few percent that follows the water colour, so it never adds pale patches, and it fades
// out on far water (px = lake units per pixel), where its noise cells would otherwise alias into a mosaic of little rectangles.
'  col *= 1.0 + 0.045 * (smoothstep(0.25, 0.85, vn(uv * 3.1 + vec2(uTime * 0.25, -uTime * 0.17))) - 0.5) * uRipple * rfade * ringMask * (1.0 - smoothstep(0.02, 0.06, px));',
'  col += ripL * 0.14 * mix(uHaze, vec3(1.0), 0.65);',
'  col += vec3(0.50, 0.62, 0.92) * uWinGlow * 0.17 * exp(-max(wr - uWinR, 0.0) * 1.5) * (1.0 - winMask);',
// depth from the baked height map: bottom shows through the shallows, wet line along the shore
'  vec2 muv = (uv - uMap.xy) / (uMap.zw - uMap.xy);',
'  vec4 g = texture2D(uGround, muv);',
'  float depth = uWL - mix(uHR.x, uHR.y, g.a);',
'  float dp = max(depth, 0.0);',
'  float kk = 0.28 * (1.0 - smoothstep(0.02, 0.6, dp)) * mix(1.0, 0.30, uTide);',
'  vec3 bot = g.rgb * uBot * mix(1.0, 0.6, smoothstep(0.0, 0.5, dp));',
'  col = mix(col, bot, kk);',
'  float wetz = smoothstep(0.12, 0.03, depth) * step(0.0, depth);',
'  col = mix(col, bot * 0.9, wetz * 0.22);',
'  float edge = smoothstep(0.032, 0.0, depth) * step(-0.03, depth);',
'  col = mix(col, mix(uHaze, vec3(1.0), 0.6) * (0.55 + 0.45 * uBot), edge * 0.5);',
// glints (SPEC 2.5, REVIEW_2): only inside one narrow band along the sun's azimuth (about 2.8 wide, 12-17 long); each spot fades in, holds 0.3-0.6 s, fades out
'  vec2 sdv = uv - uCenter; float along = dot(sdv, uSunUV); float perp = dot(sdv, vec2(-uSunUV.y, uSunUV.x));',
'  float gmask = smoothstep(1.55, 0.55, abs(perp)) * smoothstep(1.5, 4.5, along) * (1.0 - smoothstep(14.0, 19.0, along));',
'  vec2 gq = uv * 1.6 * uGlintK + rip * 40.0; vec2 gi = floor(gq), gf = fract(gq) - 0.5;',
'  float gper = 1.7 + 1.5 * hash(gi + 4.4); float gts = uTime / gper + hash(gi + 13.1) * 9.0; float gcy = floor(gts), gfr = fract(gts);',
'  float gon = step(1.0 - (0.27 + 0.11 * uTide) / (uGlintK * uGlintK), hash(gi + vec2(gcy * 1.7, gcy * 0.9 + 31.0)));',
'  vec2 goff = (vec2(hash(gi + 5.1 + gcy), hash(gi + 8.7 - gcy)) - 0.5) * 0.5;',
'  float genv = smoothstep(0.0, 0.22, gfr) * (1.0 - smoothstep(0.34, 0.56, gfr));',
'  float gsp = gon * genv * smoothstep(0.20, 0.03, length(gf - goff));',
'  col += gsp * uGlint * gmask * (1.0 - refl.a * 0.9) * (1.0 - smoothstep(30.0, 60.0, dc)) * (1.0 - edge) * vec3(1.0, 0.98, 0.9) * 0.9;',
'  col = mix(col, uHaze, smoothstep(45.0, 90.0, dc) * 0.5);',
'  col = mix(col, uTint, 0.05);',
'  gl_FragColor = vec4(col, 1.0);',
'}'
].join('\n');
const WU = {
  uRefl: { value: rt.texture }, uGround: { value: groundTex }, uTex: { value: texMat }, uTime: { value: 0 }, uWL: { value: 0 }, uRipple: { value: 1 },
  uCloudAmt: { value: 0.5 }, uHazeLo: { value: 0.8 }, uGlint: { value: 0 }, uGlintK: { value: 1 }, uTide: { value: 0 }, uSunUV: { value: new T.Vector2(-1, 0) }, uStar: { value: 0 }, uBot: { value: 1 }, uRingR: { value: RING.ringR },
  uRes: { value: uRes }, uCenter: { value: new T.Vector2(0.8, 2.6) }, uRingC: { value: new T.Vector2(RING.c[0], RING.c[1]) }, uHR: { value: new T.Vector2(HMIN, HMAX) },
  uMap: { value: new T.Vector4(MAPB.u0, MAPB.v0, MAPB.u1, MAPB.v1) }, uRip: { value: Array.from({ length: 6 }, () => new T.Vector4(0, 0, -1, 0.5)) },
  uSkyTop: { value: new T.Color() }, uHaze: { value: new T.Color() }, uCloud: { value: new T.Color() }, uTint: { value: new T.Color() },
  uWinC: { value: new T.Vector2() }, uWinM: { value: new T.Vector4(1, 0, 0, 1) }, uBrip: { value: new T.Vector3(0, 0, -1) }, uWinK: { value: 0 }, uWinR: { value: 1.1 }, uWinGlow: { value: 0 }, uWinDay: { value: 0 }
};
const water = new T.Mesh(new T.PlaneGeometry(600, 600, 1, 1).rotateX(-Math.PI / 2), new T.ShaderMaterial({ uniforms: WU, vertexShader: VERT, fragmentShader: FRAG, extensions: { derivatives: true } }));
water.frustumCulled = false; water.layers.set(2); water.userData.noMerge = true; scene.add(water);

// =====================================================================
// runtime
// =====================================================================
// ---------- traveller (same model and pose table as 苔痕驛站, plus the lake's own poses) ----------
const trav = new T.Group(); trav.scale.setScalar(1.15); trav.userData.noSolid = true; scene.add(trav);
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
mesh(new T.CylinderGeometry(0.017, 0.02, 1.08, 5), M.tWood, staff, 0, 0.02, 0); mesh(new T.BoxGeometry(0.02, 0.02, 0.14), M.woodDark, staff, 0, 0.55, 0.06);
const travGlowMat = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.2, roughness: 1 }); travGlowMat.userData.glow = true;
const travLamp = mesh(new T.BoxGeometry(0.075, 0.1, 0.075), travGlowMat, staff, 0, 0.46, 0.13);
// Keep the light count stable when the traveller fades away: hiding its parent
// would otherwise relink every lit material in both the sharp and reflection pass.
const travLightAnchor = new T.Object3D(); travLightAnchor.position.set(0, 0.46, 0.13); staff.add(travLightAnchor);
const travLight = new T.PointLight(0xffb05a, 0.8, 3.2, 2); scene.add(travLight);
const travHalo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3, fog: false })); travHalo.scale.set(0.8, 0.8, 1); travHalo.position.set(0, 0.46, 0.13); staff.add(travHalo);
const book = mesh(new T.BoxGeometry(0.2, 0.025, 0.14), M.paper, upper, 0, 0.1, 0.24); book.rotation.x = -0.4;
const cup = mesh(new T.CylinderGeometry(0.035, 0.03, 0.05, 8), M.paper, armL, 0, -0.3, 0.02); cup.visible = false;
shadowy(trav); travLamp.castShadow = false;
const POSE = {
  idle: {}, walk: {},
  inspect: { lean: 0.3, headX: 0.4, armL: -0.5 },
  crouch: { hip: -0.2, legX: -0.9, lean: 0.45, headX: 0.35, armL: -0.8 },
  pickup: {}, reach: { armL: -1.7, headX: -0.1 }, gaze: { headX: -0.32 },
  sit: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3 },
  sitGaze: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3, headX: -0.3 },
  sitEdge: { hip: -0.28, legX: -1.3, staffX: 0.2, staffZ: -0.6, armL: -0.2 },
  write: { hip: -0.28, legX: -1.45, headX: 0.5, armL: -0.9, book: 1, staffX: 0.2, staffZ: -0.6 },
  drinkSit: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -2.0, headX: -0.3, cup: 1 },
  light: { armL: -0.4, headX: -0.1 }, stretch: {}, bow: { lean: 0.3, headX: 0.45, armL: -0.9 },
  drink: { armL: -2.0, headX: -0.35 }, water: { lean: 0.22, headX: 0.45, armL: -1.1 }, balance: { armL: -1.35, armLz: -1.1, headX: 0.15 },
  hold: { armL: -1.15, headX: 0.4, lean: 0.05 }, shoulder: {},
  reachDown: { hip: -0.2, legX: -0.9, lean: 0.6, headX: 0.45, armL: -0.35 },
  readBook: { armL: -1.05, headX: 0.5, lean: 0.08, book: 1 }, lens: { armL: -2.35, headX: -0.22, lean: -0.04 },
  // stage 3 (SPEC 8.3-8.5): hop = peak of a stone-to-stone jump (crouch before, tuck in the air, crouch on landing); climb = leaning into a steep slope (> 0.5);
  // rollCuff / lookDown / gazeDown / spin / hopStones are dynamic (see poseTarget)
  hop: { hip: -0.05, legX: -0.75, lean: 0.12, armL: -1.0, armLz: -0.3 }, climb: { lean: 0.38, headX: -0.12, armL: -0.55 },
  rollCuff: {}, lookDown: { headX: 0.55, lean: 0.06 }, gazeDown: { headX: 0.5, lean: 0.03 }, spin: { armLz: -1.4, armRz: 0.5 }, hopStones: { headX: 0.12 }
};
const PKEYS = ['hip', 'legX', 'lean', 'headX', 'headY', 'armL', 'armLz', 'staffX', 'staffZ', 'book', 'lie', 'cup', 'sway', 'armRz', 'lift', 'bench'];
const pose = {}; PKEYS.forEach((k) => { pose[k] = 0; });

// ---------- clocks: effective focus time, day/night line, tide line ----------
const SEG = 600, PLANNED = (AREA.plannedMinutes || 50) * 60;
let speed = 6, sim = 0, playing = false, tAcc = 0, timeMode = 'auto', forceMotion = false;
const TIMES = ['dawn', 'day', 'dusk', 'night'];
function timeOfDayAt(sec) { const phase = (Math.max(0, sec) % SEG) / SEG; const pos = phase * 4; const i = Math.min(3, Math.floor(pos)); const f = pos - i; return { from: TIMES[i], to: TIMES[(i + 1) % 4], blend: f * f * f * (f * (f * 6 - 15) + 10), phase }; }
const target = W(0.8, 2.6, 0.3); const DEFAULT_TARGET = target.clone();
const TRANS_S = 2.8; let trans = null, snapLook = true;
const TGT = toState(PRE.dawn);
function startLookTransition() { trans = { from: toState(PRE.dawn), t: 0 }; COLOR_KEYS.forEach((key) => trans.from[key].copy(cur[key])); NUM_KEYS.forEach((key) => { trans.from[key] = cur[key]; }); trans.from.sunAt = cur.sunAt.clone(); }
function blendState(tod, dtReal) {
  const a = timeMode === 'auto' ? tod.from : timeMode, b = timeMode === 'auto' ? tod.to : timeMode, k = timeMode === 'auto' ? tod.blend : 0;
  const A = STATES[a], B = STATES[b];
  COLOR_KEYS.forEach((key) => { TGT[key].copy(A[key]).lerp(B[key], k); });
  NUM_KEYS.forEach((key) => { TGT[key] = A[key] + (B[key] - A[key]) * k; });
  TGT.sunAt = A.sunAt.clone().lerp(B.sunAt, k).normalize();
  if (snapLook) { trans = null; snapLook = false; }
  let e = 1;
  if (trans) { trans.t += dtReal || 0; const x = Math.min(1, trans.t / TRANS_S); e = sm5(x); if (x >= 1) trans = null; }
  if (e >= 1) { COLOR_KEYS.forEach((key) => cur[key].copy(TGT[key])); NUM_KEYS.forEach((key) => { cur[key] = TGT[key]; }); cur.sunAt = TGT.sunAt.clone(); }
  else { const F = trans.from; COLOR_KEYS.forEach((key) => cur[key].copy(F[key]).lerp(TGT[key], e)); NUM_KEYS.forEach((key) => { cur[key] = F[key] + (TGT[key] - F[key]) * e; }); cur.sunAt = F.sunAt.clone().lerp(TGT.sunAt, e).normalize(); }
  return k < 0.5 ? a : b;
}
// tide: follows time unless the "試看漲潮" button (or the test hook) overrides it; a jump eases over TIDE_EASE real seconds
const TIDE_EASE = 4;
let tideMan = null, tideTrans = null, tideShown = 0, tidePhase = 'low', wetShown = 0, prevShown = 0, WL = WL_LOW;
const WHITE = new T.Color(1, 1, 1);
let lastWet = -1;
function applyWet(w) { if (Math.abs(w - lastWet) < 0.004) return; lastWet = w; WETM.forEach((e) => { e.m.color.copy(e.dry).lerp(e.wet, w); e.m.roughness = e.r + (0.42 - e.r) * w; e.m.metalness = 0.06 * w; }); }

// ---------- UI ----------
const playBtn = document.getElementById('play'), clockEl = document.getElementById('clockNow'), clockBox = document.getElementById('clock');
const lampDots = Array.from(document.querySelectorAll('#lamps span')), lampCount = document.getElementById('lampCount'), skyEl = document.getElementById('sky'), tideBtn = document.getElementById('tideBtn');
let statusMsg = '';
function setStatus(msg) { statusMsg = msg; statusEl.textContent = msg; }
const fmt = (sec) => { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
function updatePlayLabel() { playBtn.textContent = playing ? '暫停' : (sim > 0 ? '繼續' : '開始專注'); }
playBtn.addEventListener('click', () => { playing = !playing; updatePlayLabel(); if (!playing && sim > 0) setStatus('暫停中。整個世界停在原地，連雲也停在半空。'); else setStatus('時間往前走了。潮水會在第一盞燈之後漲起來。'); });
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { speed = Number(b.dataset.speed); document.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
function setTimeMode(mode, fade) { if (fade && timeMode !== mode) startLookTransition(); else if (!fade) snapLook = true; timeMode = mode; document.querySelectorAll('[data-time]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.time === mode))); }
document.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => setTimeMode(b.dataset.time, true)));
function startTideTransition() { tideTrans = { from: tideShown, t: 0 }; }
tideBtn.addEventListener('click', () => {
  if (tideMan) { tideMan = null; startTideTransition(); tideBtn.textContent = '試看漲潮'; setStatus('潮水回到依時間的節奏。'); }
  else { const nat = tideAt(TIDE_SEED, sim); tideMan = { level: nat.level < 0.5 ? 1 : 0 }; startTideTransition(); tideBtn.textContent = '回到依時間'; setStatus(tideMan.level ? '水慢慢漲上來了。' : '水慢慢退下去了。'); }
});
function resetAll() {
  sim = 0; playing = false; tideMan = null; tideTrans = null; tideBtn.textContent = '試看漲潮'; snapLook = true; lastWet = -1;
  resetTraveller(); s4Reset(); LAMPS.forEach((L) => { L.level = 0; L.prev = 0; });
  updatePlayLabel(); setStatus('按下開始，時間會往前走；潮水會在第一盞燈之後漲起來。');
}
document.getElementById('skip').addEventListener('click', () => {
  startLookTransition(); sim = Math.max(sim, PLANNED); TR.lit = 5; TR.route = null; TR.cuffPending = false; TR.after = null; endRare(); TR.pending = []; TR.dep = null; setAt('p_seat'); TR.heading = nodeFace('p_seat'); heading = TR.heading; startRest(restPool());
  playing = true; updatePlayLabel(); setStatus('跳到完成：五盞燈都亮了，旅人坐在亭台南緣的石凳上。');
});

// =====================================================================
// stage 3 · road network (SPEC 8), traveller controller, wading, demo planner
// Nodes and edges come from area-data. Every edge carries its baked walking surface (y per 0.1 of path), its hops and its steps, so the runtime never has to
// ray-cast: the surface was measured against the visible meshes by docs/area03/qa (see the report).
// =====================================================================
const APP_TO_DEMO = 8, DEMO_WALK = 0.95, BASE_SPEED = 6;
const rate = () => speed / BASE_SPEED;
const uvHeading = (du, dv) => Math.atan2((du - dv) * Math.SQRT1_2, -(du + dv) * Math.SQRT1_2);   // world heading (rotation.y) of a (du, dv) direction
const NODE = {}, IDS = [], EDGES = [], IX = {};
AREA.nodes.forEach((n, i) => { NODE[n.id] = Object.assign({ adj: [], seat: 0 }, n); IDS.push(n.id); IX[n.id] = i; });
AREA.edges.forEach((e) => {
  const a = NODE[e.a], b = NODE[e.b];
  const pts = [[a.u, 0, a.v]].concat((e.via || []).map((q) => [q[0], 0, q[1]])).concat([[b.u, 0, b.v]]).map((q) => new T.Vector3(q[0], q[1], q[2]));
  const curve = new T.CatmullRomCurve3(pts, false, 'centripetal'); curve.arcLengthDivisions = 100 * (pts.length - 1);
  const L = curve.getLength(), n = Math.max(1, Math.ceil(L / 0.1)); const P = [];
  for (let i = 0; i <= n; i++) { const q = curve.getPointAt(i / n); P.push([q.x, q.z]); }
  const E = { a: e.a, b: e.b, kind: e.kind, L, n, H: L / n, P, y: e.y, hops: e.hops || [], steps: e.steps || [] };
  EDGES.push(E); a.adj.push({ to: e.b, e: E, rev: false }); b.adj.push({ to: e.a, e: E, rev: true });
});
const NN = IDS.length, GDIST = [], GNEXT = [];
for (let i = 0; i < NN; i++) { GDIST.push(new Array(NN).fill(Infinity)); GNEXT.push(new Array(NN).fill(-1)); GDIST[i][i] = 0; }
EDGES.forEach((E) => { const i = IX[E.a], j = IX[E.b]; GDIST[i][j] = GDIST[j][i] = E.L; GNEXT[i][j] = j; GNEXT[j][i] = i; });
for (let k = 0; k < NN; k++) for (let i = 0; i < NN; i++) for (let j = 0; j < NN; j++) if (GDIST[i][k] + GDIST[k][j] < GDIST[i][j]) { GDIST[i][j] = GDIST[i][k] + GDIST[k][j]; GNEXT[i][j] = GNEXT[i][k]; }
const D = (a, b) => GDIST[IX[a]][IX[b]];
function buildRoute(a, b) {
  if (a === b) return { ids: [a], legs: [], len: 0, pts: [[NODE[a].u, NODE[a].v]] };
  let i = IX[a]; const j = IX[b]; if (GNEXT[i][j] < 0) return null;
  const ids = [a], legs = []; let len = 0;
  while (i !== j) { const nx = GNEXT[i][j]; const from = IDS[i], to = IDS[nx]; const adj = NODE[from].adj.find((q) => q.to === to); legs.push({ e: adj.e, rev: adj.rev, from, to }); len += adj.e.L; ids.push(to); i = nx; }
  const pts = []; legs.forEach((lg) => { for (let k = 0; k <= lg.e.n; k += 5) { const q = lg.e.P[lg.rev ? lg.e.n - k : k]; pts.push([q[0], q[1]]); } });
  return { ids, legs, len, pts };
}
// position on a leg: d = distance walked along the leg in the travel direction
function legAt(leg, d) {
  const E = leg.e, dd = Math.max(0, Math.min(E.L, d)); const f = Math.min(E.n, (leg.rev ? E.L - dd : dd) / E.H);
  const i = Math.min(E.n - 1, Math.floor(f)), t = f - i; const p0 = E.P[i], p1 = E.P[i + 1];
  const sy = E.y[i] + (E.y[i + 1] - E.y[i]) * t; let y = sy, hop = null;
  for (let h = 0; h < E.hops.length; h++) { const hp = E.hops[h]; if (f > hp[0] && f < hp[1]) { const tt = (f - hp[0]) / (hp[1] - hp[0]); y += (0.12 + 0.1 * hp[2]) * 4 * tt * (1 - tt); hop = { t: tt, gap: hp[2] }; break; } }
  for (let h = 0; h < E.steps.length; h++) { const k = E.steps[h][0]; if (f > k - 1 && f < k + 2) y += (0.015 + 0.2 * Math.abs(E.steps[h][1])) * Math.sin(Math.PI * (f - (k - 1)) / 3); }
  // hop approach / landing zone (three samples either side) for the crouch
  let near = 0;
  if (!hop) for (let h = 0; h < E.hops.length; h++) { const hp = E.hops[h]; const dl = leg.rev ? f - hp[1] : hp[0] - f; const dl2 = leg.rev ? hp[0] - f : f - hp[1]; if (dl > 0 && dl < 3) near = Math.max(near, 1 - dl / 3); else if (dl2 > 0 && dl2 < 3) near = Math.max(near, 0.6 * (1 - dl2 / 3)); }
  return { u: p0[0] + (p1[0] - p0[0]) * t, v: p0[1] + (p1[1] - p0[1]) * t, sy, y, hop, near };
}
const bySpot = {}; (AREA.spots || []).forEach((s) => { bySpot[s.id] = s; });
const lampNode = (k) => AREA.lamps[k].node;
const dueOf = (k) => AREA.lamps[k].dueAt * PLANNED;
const lampsDue = () => Math.max(0, Math.min(5, Math.floor(sim * 5 / PLANNED + 1e-9)));
const todKey = () => { const t = timeOfDayAt(sim); return timeMode === 'auto' ? (t.blend < 0.5 ? t.from : t.to) : timeMode; };
const mrand = (a, b) => a + Math.random() * (b - a);
const easeInOut = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---------- wading: ripples live in the water shader (uniform array), splashes are a main-view-only Points object ----------
const RIP = { n: 6, age: new Float32Array(6).fill(1), life: new Float32Array(6).fill(1.2), u: new Float32Array(6), v: new Float32Array(6), r: new Float32Array(6) };
const RIPU = []; for (let i = 0; i < 6; i++) RIPU.push(new T.Vector4(0, 0, -1, 0.5));
function addRipple(u, v, maxR, life) { let k = 0, best = -1; for (let i = 0; i < RIP.n; i++) { if (RIP.age[i] >= 1) { k = i; best = 2; break; } if (RIP.age[i] > best) { best = RIP.age[i]; k = i; } } RIP.age[k] = 0; RIP.life[k] = life || 1.2; RIP.u[k] = u; RIP.v[k] = v; RIP.r[k] = maxR || 0.5; }
function rippleUpdate(dt) { for (let i = 0; i < RIP.n; i++) { if (RIP.age[i] < 1) RIP.age[i] += dt / RIP.life[i]; RIPU[i].set(RIP.u[i], RIP.v[i], RIP.age[i] < 1 ? RIP.age[i] : -1, RIP.r[i]); } WU.uRip.value = RIPU; }
const SPL = (() => {
  const N = 30, pos = new Float32Array(N * 3), st = []; for (let i = 0; i < N; i++) st.push({ on: false, x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, age: 0 });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
  const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: 30 } }, vertexShader: 'uniform float uPx; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 0.075 * uPx; }',
    fragmentShader: 'void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(0.93, 0.98, 1.0, 0.85 * (1.0 - r * r)); }' });
  const p = new T.Points(g, m); p.frustumCulled = false; p.layers.set(2); p.userData.noMerge = true; p.userData.noSolid = true; p.renderOrder = 3; scene.add(p);
  p.onBeforeRender = (rd, sc, cam) => { const tgt = rd.getRenderTarget(); const h = tgt ? tgt.height : rd.domElement.height; m.uniforms.uPx.value = h / ((cam.top - cam.bottom) / cam.zoom); };
  return { st, pos, p, g, N };
})();
function splashAt(u, v, wl) { const q = W(u, v, wl + 0.02); let k = 4 + Math.floor(Math.random() * 3); for (let i = 0; i < SPL.N && k > 0; i++) { const s = SPL.st[i]; if (s.on) continue; s.on = true; s.age = 0; s.x = q.x; s.y = q.y; s.z = q.z; const a = Math.random() * 6.283, sp = mrand(0.25, 0.7); s.vx = Math.cos(a) * sp * 0.5; s.vz = Math.sin(a) * sp * 0.5; s.vy = mrand(1.4, 2.2); k--; } }
function splashUpdate(dt) { let any = false; SPL.st.forEach((s, i) => { if (s.on) { s.age += dt; s.vy -= 6.5 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (s.age > 0.55 || s.y < WL) { s.on = false; s.y = -50; } else any = true; } SPL.pos[i * 3] = s.x; SPL.pos[i * 3 + 1] = s.y; SPL.pos[i * 3 + 2] = s.z; }); SPL.g.attributes.position.needsUpdate = true; SPL.p.visible = any; }

// ---------- the traveller controller ----------
const TR = { node: 'r_landing', state: 'idle', t: 0, dur: 0, route: null, leg: 0, s: 0, purpose: null, recent: [], lit: 0, act: null, amb: null, ambLast: null, phase: 0, stepN: 0, splashAt: 5, cuffT: 0, cuffDone: true, cuffPending: false, after: null, free: false, hold: false, heading: Math.PI / 4, u: 0, v: 0, sy: 0, ripT: 0, lastTP: 'low', hs: null, lightK: 0, waitK: 0, forcePose: null, forceProg: 0, restLast: false, pending: [], dep: null, effectDone: false, restSay: -1, slope: 0, air: 0, wading: false, moving: false };
function nodeFace(n) { const nd = NODE[n]; return nd.face ? uvHeading(nd.face[0] - nd.u, nd.face[1] - nd.v) : VIEW_FACE; }
function setAt(nodeId) { const n = NODE[nodeId]; TR.node = nodeId; TR.u = n.u; TR.v = n.v; TR.sy = n.y; TR.route = null; TR.leg = 0; TR.s = 0; }
function walkTo(nodeId, purpose) {
  const r = buildRoute(TR.node, nodeId);
  if (!r || !r.legs.length) { arrive(purpose, nodeId); return; }
  TR.route = r; TR.leg = 0; TR.s = 0; TR.state = 'walk'; TR.purpose = purpose; if (purpose.walkMsg) setStatus(purpose.walkMsg);
}
function startCuff(after) { TR.state = 'cuff'; TR.cuffT = 0; TR.after = after; setStatus('水漫上來了，旅人低頭看了看腳邊。'); }
function arrive(purpose, nodeId) {
  TR.node = nodeId || TR.node; TR.route = null; TR.leg = 0; TR.s = 0;
  const n = NODE[TR.node]; TR.u = n.u; TR.v = n.v; TR.sy = n.y;
  if (purpose.type === 'test') { TR.state = 'idle'; TR.free = false; return; }
  if (purpose.type === 'spot') {
    const sp = purpose.spot; if (sp.tide === 'low' && tideShown > 0.3) { TR.state = 'idle'; TR.cuffPending = false; return; }
    TR.cuffPending = false; startAct(sp, purpose.dur); return;
  }
  if (purpose.type === 'lamp') {
    const k = purpose.k; const left = (dueOf(k) - sim) / speed;
    if (left <= 1.5) { TR.cuffPending = false; startLight(k); return; }
    if (TR.cuffPending) { TR.cuffPending = false; startCuff(() => startWait(k)); return; }
    startWait(k); return;
  }
  if (purpose.type === 'rest') { TR.cuffPending = false; startRest(restPool(), purpose.dur); return; }
  TR.state = 'idle';
}
function startWait(k) { TR.state = 'wait'; TR.waitK = k; TR.amb = null; setStatus('旅人在第 ' + (k + 1) + ' 盞燈旁等著。'); pickAmb(); }
function startLight(k) { TR.state = 'light'; TR.lightK = k; TR.t = 0; TR.dur = 3.0; setStatus('第 ' + (k + 1) + ' 盞燈的時間到了，旅人伸手去點。'); }
// ambient waiting actions (SPEC 8.5)
const AMB = [
  { id: 'amb_stretch', anim: 'stretch', dur: [8, 15], min: 5 }, { id: 'amb_pack', anim: 'crouch', dur: [15, 25], min: 6 }, { id: 'amb_watch_water', anim: 'crouch', dur: [15, 25], min: 6 },
  { id: 'amb_clouds', anim: 'gazeDown', dur: [10, 25], min: 6 }, { id: 'amb_reflection', anim: 'lookDown', dur: [12, 20], min: 6 }, { id: 'amb_spin', anim: 'spin', dur: [10, 14], min: 9 }, { id: 'amb_fireflies', anim: 'gaze', dur: [20, 40], min: 6 }
];
function ambOk(a) {
  const n = NODE[TR.node], dry = WL < n.y - 0.02, tk = todKey(), hi = tideShown > 0.8, lo = tideShown < 0.2;
  switch (a.id) {
    case 'amb_pack': case 'amb_watch_water': return dry && lo;
    case 'amb_clouds': return tk !== 'night';
    case 'amb_reflection': return hi;
    case 'amb_spin': return hi && n.spin !== false;
    case 'amb_fireflies': return tk === 'night' && (TR.node === 'r_lamp1' || TR.node === 'k_lamp4');
    default: return true;
  }
}
function waterFace(n) {   // the nearest bit of water or puddle, for "crouch and watch the water"
  let best = null, bd = 9; for (let r = 0.5; r <= 3.0 && !best; r += 0.25) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, u = n.u + Math.cos(a) * r, v = n.v + Math.sin(a) * r; if (groundH(u, v) < -0.02 && r < bd) { bd = r; best = [u, v]; } }
  return best;
}
function pickAmb() {
  const c = AMB.filter((a) => ambOk(a) && a.id !== TR.ambLast); const a = c.length ? c[Math.floor(Math.random() * c.length)] : AMB[0];
  TR.amb = { a, t: 0, dur: Math.max(a.min, mrand(a.dur[0], a.dur[1]) / APP_TO_DEMO * 2 / rate()) }; TR.ambLast = a.id;
  TR.amb.face = a.id === 'amb_watch_water' ? waterFace(NODE[TR.node]) : null;
}
// ----- demo planner (SPEC 8.8) -----
function pickWeighted(list) { const total = list.reduce((s, c) => s + c.w, 0); let r = Math.random() * total; for (const c of list) { r -= c.w; if (r <= 0) return c; } return list[list.length - 1]; }
function spotOk(sp) { if (sp.id === TR.node || TR.recent.indexOf(sp.id) >= 0) return false; if (sp.tide === 'low' && tideShown > 0.15) return false; if (sp.tide === 'high' && tideShown < 0.85) return false; return true; }
function decide() {
  const r = rate(), v = DEMO_WALK * r;
  if (TR.pending.length) {   // a special find drawn for this trip (stage 4): walk to where it is, then play it
    let ev = variantFor(TR.pending.shift()); const dur = rareDur(ev); TR.recent = [ev.spot].concat(TR.recent).slice(0, 2);
    walkTo(ev.spot, { type: 'spot', spot: ev, dur, walkMsg: '旅人往' + (ev.tier === 'core' ? '石環邊' : ev.source === 'frame' ? '鏡框那邊' : ev.source === 'boat' ? '擱淺的小船那邊' : '水位標尺那邊') + '走去。' }); return;
  }
  if (TR.lit >= 5) {
    if (TR.node === 'p_seat') { startRest(restPool()); return; }
    walkTo('p_seat', { type: 'rest', walkMsg: '五盞燈都亮了。旅人往亭台南緣走去，準備坐下。' }); return;
  }
  const k = TR.lit, L = lampNode(k), left = (dueOf(k) - sim) / speed;
  if (left < -25 / speed) { TR.lit = k + 1; return; }
  const fits = (n, dur) => { const d1 = D(TR.node, n), d2 = D(n, L); return d1 / v + dur + d2 / v + 8 / APP_TO_DEMO / r <= left; };
  const cands = [];
  if (left > 0) EVENTS.forEach((ev) => { if (!eligible(ev)) return; const dur = durFor(ev); if (fits(ev.spot, dur)) cands.push({ ev, dur, w: ev.weight / (1 + D(TR.node, ev.spot) / 5) }); });
  if (cands.length) { const c = pickWeighted(cands); TR.recent = [c.ev.spot].concat(TR.recent).slice(0, 2); walkTo(c.ev.spot, { type: 'spot', spot: c.ev, dur: c.dur, walkMsg: '旅人往' + (NODE[c.ev.spot].label || c.ev.spot) + '走去。' }); return; }
  if (TR.node === L) { if (left <= 1.5) startLight(k); else startWait(k); return; }
  walkTo(L, { type: 'lamp', k, walkMsg: '第 ' + (k + 1) + ' 盞燈的時間快到了，旅人往燈走去。' });
}
function stateStep(dt) {
  const r = rate();
  switch (TR.state) {
    case 'walk': {
      const rt = TR.route; if (!rt) { TR.state = 'idle'; break; }
      const offSeat = TR.leg === 0 && TR.s < 0.01 && NODE[TR.node].bench && pose.bench > 0.12;   // get up off a bench before setting out
      if (!offSeat) TR.s += DEMO_WALK * r * dt;
      let guard = 0;
      while (TR.route && TR.s >= rt.legs[TR.leg].e.L && guard++ < 8) {
        TR.s -= rt.legs[TR.leg].e.L; TR.node = rt.legs[TR.leg].to; TR.leg++;
        if (TR.leg >= rt.legs.length) { arrive(TR.purpose, TR.node); break; }
        if (TR.cuffPending) { TR.cuffPending = false; const nd = NODE[TR.node]; TR.u = nd.u; TR.v = nd.v; TR.sy = nd.y; startCuff(() => { TR.state = 'walk'; }); break; }
      }
      break;
    }
    case 'act': {
      TR.t += dt; if (TR.t >= TR.dur) finishAct(); break;
    }
    case 'wait': {
      if (!TR.amb) pickAmb();
      TR.amb.t += dt; if (TR.amb.t >= TR.amb.dur) pickAmb();
      if ((dueOf(TR.waitK) - sim) / speed <= 1.5) startLight(TR.waitK);
      break;
    }
    case 'light': { TR.t += dt; if (TR.t >= TR.dur) { TR.lit = Math.max(TR.lit, TR.lightK + 1); TR.state = 'idle'; afterLamp(TR.lightK + 1); } break; }
    case 'rest': { TR.t += dt; if (TR.t >= TR.dur) finishRest(); break; }
    case 'depart': { TR.dep.t += dt; if (TR.dep.t >= DEPART_T + 0.4) { TR.state = 'gone'; TR.dep = null; setStatus('旅人已經離開。按「重來」可以開始新的一趟。'); } break; }
    case 'cuff': { TR.cuffT += dt; if (TR.cuffT >= 2.0) { const f = TR.after; TR.after = null; TR.state = 'idle'; if (f) f(); } break; }
    default: break;
  }
}
// pose targets. dynamic poses read the state timers; POSE holds the static ones
const SIT_KEYS = { sit: 1, sitGaze: 1, sitEdge: 1, write: 1, drinkSit: 1 };
function poseTarget(key, prog, ctx) {
  const tgt = Object.assign({ hip: 0, legX: 0, lean: 0, headX: 0, headY: 0, armL: 0, armLz: 0, staffX: 0, staffZ: 0, book: 0, lie: 0, cup: 0, sway: 0, armRz: 0, lift: 0, bench: 0 }, POSE[key] || {});
  const tt = ctx.t;
  if (key === 'stretch') { const a = ctx.waiting ? 0.5 + 0.5 * Math.sin(tAcc * 0.8) : Math.sin(Math.PI * prog); Object.assign(tgt, { armL: -2.9 * a, staffX: -0.25 * a, headX: -0.3 * a }); }
  if (key === 'gaze' || key === 'sitGaze' || key === 'idle') tgt.headY = Math.sin(tAcc * 0.35) * (key === 'idle' ? 0.35 : 0.5);
  if (key === 'lookDown') { tgt.headX = 0.55; tgt.lean = 0.06; tgt.sway = Math.sin(tAcc * 0.9) * 0.06; tgt.headY = Math.sin(tAcc * 0.5) * 0.18; }
  if (key === 'gazeDown') { tgt.headX = 0.5; tgt.lean = 0.03; tgt.headY = Math.sin(tAcc * 0.3) * 0.35; }
  if (key === 'spin') { tgt.armLz = -1.4; tgt.armL = 0; tgt.armRz = 0.5; tgt.headX = -0.05; tgt.lean = 0.02; tgt.legX = Math.sin(tAcc * 9) * 0.22; }
  if (key === 'hopStones') { tgt.headX = 0.12; }
  if (key === 'leafTouch') { const e=Math.sin(Math.PI*prog); Object.assign(tgt,{hip:-.17,legX:-.6,lean:.3,headX:.55,armL:-.6-.45*e,armLz:-.18*e}); }
  if (key === 'inspect') tgt.headY = Math.sin(tAcc * 0.5) * 0.15;
  if (key === 'light') {
    const e = Math.sin(Math.PI * clamp01(prog)); const dy = ctx.reach || 0;   // dy: flame height above the shoulder
    Object.assign(tgt, { armL: -(1.57 + Math.max(-0.6, Math.min(1.2, dy * 2.6))) * Math.min(1, e * 1.4), headX: -0.1 * e, staffX: 0.15 * e, lean: (dy < -0.15 ? 0.2 : 0) * e });
  }
  if (key === 'rollCuff') {
    const c = ctx.cuffT; const down = clamp01(c / 0.8), pinch = clamp01((c - 0.8) / 0.25) * (1 - clamp01((c - 1.6) / 0.4));
    const up = 1 - clamp01((c - 1.6) / 0.4);
    Object.assign(tgt, { headX: 0.62 * Math.min(1, down * 1.5) * up + 0.1 * (1 - up), lean: (0.1 * down + 0.42 * pinch) * up, hip: -0.2 * pinch, legX: -0.9 * pinch, armL: -0.9 * pinch + 0.15 * pinch * Math.sin(c * 14), sway: 0 });
  }
  if (key === 'climb') { Object.assign(tgt, { lean: 0.38, headX: -0.12, armL: -0.55 }); }
  if (key === 'pickup') { const e = Math.sin(Math.PI * clamp01(prog)); Object.assign(tgt, { hip: -0.2 * e, legX: -0.9 * e, lean: 0.55 * e, headX: 0.4 * e, armL: -0.5 - 0.6 * e }); }
  return tgt;
}
const SEAT_HOP = 0.12;
// Bench seats (Opus 2026-10-03): a node with `bench: [u, v]` has a real seat behind the standing point (top = node y + seat).
// seat 0 = sitting on the floor itself (an edge to hang the feet over, or the ground against a fallen column); `benchLeg` overrides the leg angle.
// Sitting there slides him back onto it (pose.bench 0 -> 1), lowers the hips so the hip joint rests on the seat top and puts the
// feet down in front instead of the on-the-floor sit (legs straight out). No lift, no SEAT_HOP: nothing floats, nothing clips.
const BENCH_LEG = -1.0;
const benchHip = (seat) => seat / 1.15 - 0.3;   // hip joint (body y + 0.3, model scale 1.15) at the seat top
const RIP_STEP_R = 0.5;
function travUpdate(dt) {
  const move = !paused;
  const dtm = move ? dt : 0;
  // The saved main-process action is the sole traveller schedule.
  // ---- placement ----
  let u = TR.u, v = TR.v, sy = TR.sy, want = TR.heading, key = 'idle', prog = 0, moving = false, slope = 0, air = 0, near = 0, hopping = false, walkLike = false;
  const nd = NODE[TR.node];
  const ctx = { t: 0, waiting: false, cuffT: TR.cuffT, reach: 0 };
  if (TR.state === 'walk' && TR.route) {
    const leg = TR.route.legs[TR.leg]; const q = legAt(leg, TR.s), a = legAt(leg, TR.s - 0.14), b = legAt(leg, TR.s + 0.14);
    u = q.u; v = q.v; sy = q.y; const du = b.u - a.u, dv = b.v - a.v; if (Math.hypot(du, dv) > 1e-4) want = uvHeading(du, dv);
    slope = (b.sy - a.sy) / 0.28; key = 'walk'; moving = move; hopping = !!q.hop; near = q.near; air = q.hop ? 4 * q.hop.t * (1 - q.hop.t) : 0;
    TR.u = u; TR.v = v; TR.sy = q.sy;
  } else {
    u = nd.u; v = nd.v; sy = nd.y; TR.u = u; TR.v = v; TR.sy = sy;
    want = nodeFace(TR.node);
    if (TR.state === 'act') {
      key = TR.act.anim || TR.act.demoAnim || 'gaze'; prog = clamp01(TR.t / TR.dur); ctx.t = TR.t;
      if (key === 'hopStones') {   // hop to the next stone and back (SPEC 8.7, a_stones)
        if (!TR.hs) { const lg = buildRoute('a_stones', 'a_arch').legs[0]; const h0 = lg.e.hops[0]; TR.hs = { leg: lg, dEnd: Math.min(lg.e.L, (h0 ? h0[1] : 12) * lg.e.H + 0.25) }; }
        const p = prog, H = TR.hs; let d = 0, dir = 1;
        if (p >= 0.2 && p < 0.4) d = H.dEnd * easeInOut((p - 0.2) / 0.2); else if (p >= 0.4 && p < 0.6) d = H.dEnd; else if (p >= 0.6 && p < 0.8) { d = H.dEnd * (1 - easeInOut((p - 0.6) / 0.2)); dir = -1; }
        const q = legAt(H.leg, d), a = legAt(H.leg, d - 0.14 * dir), b = legAt(H.leg, d + 0.14 * dir);
        u = q.u; v = q.v; sy = q.y; hopping = !!q.hop; near = q.near; air = q.hop ? 4 * q.hop.t * (1 - q.hop.t) : 0;
        const hm = (p >= 0.2 && p < 0.4) || (p >= 0.6 && p < 0.8); moving = move && hm;
        if (hm) { const du = b.u - a.u, dv = b.v - a.v; if (Math.hypot(du, dv) > 1e-4) want = uvHeading(du, dv); slope = (b.sy - a.sy) / 0.28; } else want = uvHeading(H.leg.e.P[3][0] - H.leg.e.P[0][0], H.leg.e.P[3][1] - H.leg.e.P[0][1]);
        TR.u = u; TR.v = v; TR.sy = q.sy; walkLike = true;
      }
    }
    else if (TR.state === 'wait') { const A = TR.amb; key = A ? A.a.anim : 'gaze'; prog = A ? clamp01(A.t / A.dur) : 0; ctx.t = A ? A.t : 0; ctx.waiting = true; if (A && A.face) want = uvHeading(A.face[0] - nd.u, A.face[1] - nd.v); if (A && A.a.id === 'amb_spin') want = VIEW_FACE + 6.2832 * easeInOut(clamp01(A.t / 8.0)); }
    else if (TR.state === 'light') { key = 'light'; prog = clamp01(TR.t / TR.dur); ctx.reach = LAMPS[TR.lightK].flameY - (sy + 0.85); }
    else if (TR.state === 'rest') { key = 'sitGaze'; want = nodeFace(TR.node); }
    else if (TR.state === 'cuff') { key = 'rollCuff'; }
    else if (TR.state === 'idle') { key = 'idle'; }
  }
  const OV = TR.forcePose ? null : s4Override();   // stage 4: the current sequence (rare find, rest, departure) steers the traveller
  if (OV) {
    if (OV.pos) { u = OV.pos[0]; v = OV.pos[1]; sy = OV.pos[2]; TR.u = u; TR.v = v; TR.sy = sy; }
    if (OV.face !== undefined) want = OV.face;
    if (OV.key) { key = OV.key; prog = OV.prog || 0; ctx.t = prog * 8; }
    if (OV.walk) { key = 'walk'; moving = move; }
    if (OV.moving) moving = move;
    if (OV.hop) { hopping = true; air = OV.air || 0; }
    if (OV.near !== undefined) near = OV.near;
  }
  if (TR.forcePose) { key = TR.forcePose; prog = TR.forceProg; ctx.t = prog * 8; ctx.cuffT = prog * 2; ctx.waiting = false; }
  if (TR.forcePose && TR.faceOv !== undefined && TR.faceOv !== null) want = TR.faceOv;
  // ---- facing ----
  if (TR.state === 'story' || dt === 0 || (key === 'spin' && TR.state === 'wait')) TR.heading = want; else TR.heading = lerpAngle(TR.heading, want, 1 - Math.exp(-dt * (moving ? 7 : 5)));
  // ---- pose ----
  let tgt;
  if (key === 'walk' || walkLike) {
    tgt = poseTarget('idle', 0, ctx); tgt.headY = 0;
    const cl = clamp01((slope - 0.45) / 0.25); if (cl > 0) { tgt.lean += 0.38 * cl; tgt.headX -= 0.12 * cl; tgt.armL -= 0.55 * cl; }
    if (slope < -0.5) { tgt.lean -= 0.1 * clamp01((-slope - 0.5) / 0.3); }
    const cr = hopping ? 0 : near, ar = hopping ? 1 : 0;
    tgt.hip -= 0.2 * cr + 0.05 * ar; tgt.lean += 0.3 * cr + 0.12 * ar; tgt.legX += -0.5 * cr - 0.75 * ar; tgt.armL += -0.4 * cr - 1.0 * ar; tgt.armLz += -0.3 * ar;
  } else tgt = poseTarget(key, prog, ctx);
  if (OV) { if (OV.tgt) Object.assign(tgt, OV.tgt); tgt.cup = OV.cup === 'hand' ? 1 : 0; }
  const onBench = !!(nd.bench && SIT_KEYS[key] && TR.state !== 'walk');
  const seatY = SIT_KEYS[key] && nd.seat && !nd.bench ? nd.seat : 0; tgt.lift = seatY; if (seatY > 0.1 && SIT_KEYS[key]) tgt.hip += SEAT_HOP;
  tgt.bench = onBench ? 1 : 0; if (onBench) { tgt.hip += benchHip(nd.seat) - POSE.sit.hip; tgt.legX += (nd.benchLeg !== undefined ? nd.benchLeg : BENCH_LEG) - POSE.sit.legX; }
  const k = dt === 0 ? 1 : 1 - Math.exp(-dt * (hopping || near > 0.05 || key === 'rollCuff' ? 12 : 5));
  PKEYS.forEach((kk) => { pose[kk] += (tgt[kk] - pose[kk]) * k; });
  if (TR.state === 'walk' && TR.leg === 0 && TR.s < 0.01 && nd.bench && pose.bench > 0.12) moving = false;   // still getting up: no walking in place
  const scoot = nd.bench && (TR.state !== 'walk' || (TR.leg === 0 && TR.s < 0.01)) && Math.abs(tgt.bench - pose.bench) > 0.12 && pose.bench > 0.25 && Math.hypot(nd.bench[0] - nd.u, nd.bench[1] - nd.v) > 0.22;   // steps only mid-way (legs never swing back into the seat)   // a step or two onto / off a bench a little to the side
  if (scoot && !moving) { moving = true; }
  if (moving) TR.phase += (OV && OV.walkRate !== undefined && !scoot ? OV.walkRate : scoot ? 1.1 : DEMO_WALK * Math.min(rate(), 3)) * dt * 9;
  if (key === 'spin' && move) TR.phase += dt * 9;
  const swing = (moving && !hopping) ? Math.sin(TR.phase) * 0.55 : 0, bob = (moving && !hopping) ? Math.abs(Math.sin(TR.phase)) * 0.035 : 0;
  // ---- wading (SPEC 8.4): the surface under his feet is below the water ----
  const wet = WL > sy + 0.005 && air < 0.02 && !SIT_KEYS[key];
  if (move && wet && (moving || key === 'spin')) {
    const si = Math.floor(TR.phase / Math.PI);
    if (si !== TR.stepN) { TR.stepN = si; TR.ripT = 0; if (tAcc - (TR.lastRip === undefined ? -9 : TR.lastRip) > 0.09) { TR.lastRip = tAcc; addRipple(u + (si % 2 ? 0.05 : -0.05), v, RIP_STEP_R, 1.2); TR.splashCount = (TR.splashCount || 0) + 1; if (TR.splashCount >= TR.splashAt) { TR.splashCount = 0; TR.splashAt = 4 + Math.floor(Math.random() * 3); splashAt(u, v, WL); } } }
  } else if (move && wet) { TR.ripT += dt; if (TR.ripT > 1.5) { TR.ripT = 0; addRipple(u, v, 0.28, 1.2); } }
  else TR.stepN = Math.floor(TR.phase / Math.PI);
  TR.wading = wet; TR.moving = moving; TR.slope = slope; TR.air = air;
  // ---- water rising over his feet: one rollCuff per rise (SPEC 8.4) ----
  if (tidePhase !== TR.lastTP) { if (tidePhase === 'rising') TR.cuffDone = false; TR.lastTP = tidePhase; }
  if (tidePhase === 'rising' && !TR.cuffDone && WL > TR.sy + 0.005 && air < 0.02) {
    TR.cuffDone = true;
    if (TR.state === 'idle') startCuff(() => { TR.state = 'idle'; });
    else if (TR.state === 'wait') startCuff(() => { TR.state = 'wait'; });
    else if (TR.state === 'walk') TR.cuffPending = true;
  }
  // ---- apply ----
  const lift = pose.lift;
  // also while walking away: TR.node is still the bench node at the start of the route, so he eases off the seat as he sets out
  if (nd.bench && pose.bench > 0.001) { const b = pose.bench; u += (nd.bench[0] - u) * b; v += (nd.bench[1] - v) * b; }
  trav.position.copy(W(u, v, sy + lift));
  trav.rotation.set(0, TR.heading, 0);
  body.position.y = pose.hip + bob; body.rotation.z = pose.sway; body.rotation.x = -pose.lie * Math.PI / 2; upper.rotation.x = pose.lean;
  const dangle = key === 'sitEdge';
  legL.rotation.x = pose.legX + swing + (dangle ? Math.sin(tAcc * 1.6) * 0.15 : 0); legR.rotation.x = pose.legX - swing + (dangle ? Math.sin(tAcc * 1.6 + 1.3) * 0.15 : 0);
  head.rotation.x = pose.headX; head.rotation.y = pose.headY; armL.rotation.x = pose.armL; armL.rotation.z = pose.armLz; armR.rotation.z = pose.armRz;
  armR.rotation.x = -0.35 + pose.staffX * 0.8; staff.rotation.x = pose.staffX; staff.rotation.z = pose.staffZ; cloak.rotation.z = swing * 0.07;
  book.visible = pose.book > 0.5; cup.visible = pose.cup > 0.5;
  rippleUpdate(dtm); splashUpdate(dtm);
}
function resetTraveller() {
  TR.state = 'idle'; TR.route = null; TR.recent = []; TR.lit = 0; TR.act = null; TR.amb = null; TR.ambLast = null; TR.cuffDone = true; TR.cuffPending = false; TR.after = null; TR.forcePose = null; TR.faceOv = null; TR.hold = false; TR.free = false; TR.restLast = false; TR.t = 0; TR.pending = []; TR.dep = null;
  setAt(AREA.ports.spawn); TR.heading = nodeFace(AREA.ports.spawn); heading = TR.heading; PKEYS.forEach((kk) => { pose[kk] = 0; });
  for (let i = 0; i < RIP.n; i++) RIP.age[i] = 1;
}

// ---------- lamps: lit by the effective time only (SPEC 5), never by the traveller ----------
const lampTmp = new T.Vector3();
function lampFlameWorld(L, out) {
  if (L.flameU) { const q = W(L.flameU[0], L.flameU[1], L.flameU[2]); out.copy(q); }
  else { L.obj.updateWorldMatrix(true, false); out.copy(L.flameLocal); L.obj.localToWorld(out); }
  return out;
}
const swingQ = new T.Quaternion(), swingE = new T.Euler();
function lampsUpdate(dt, snap) {
  const dueN = lampsDue(), U = LAMPFX;
  const dayK = Math.max(0, 1 - cur.lamp);
  LAMPS.forEach((L, i) => {
    const target = i < dueN ? 1 : 0;
    if (L.prev !== undefined && L.prev !== target && target === 1 && !snap) setStatus('第 ' + (i + 1) + ' 盞燈亮了。');
    L.prev = target;
    L.level = snap ? target : L.level + (target - L.level) * (1 - Math.exp(-dt * 3));
    if (i === 3) { L.obj.rotation.z = Math.sin(tAcc * 1.05 + 0.7) * 0.07 * MOTION; L.obj.rotation.x = Math.sin(tAcc * 0.79 + 2.1) * 0.04 * MOTION; }
    if (i === 4) { swingE.set(Math.sin(tAcc * 1.3) * 0.018 * MOTION, 0, Math.sin(tAcc * 1.6 + 1.0) * 0.022 * MOTION); swingQ.setFromEuler(swingE); L.obj.quaternion.copy(L.q0).multiply(swingQ); }
    lampFlameWorld(L, lampTmp); L.flameY = lampTmp.y;
    const fl = 1 + (Math.sin(tAcc * 7.3 + i * 2) * 0.05 + Math.sin(tAcc * 13.1 + i) * 0.03) * MOTION;
    U.pos[i * 3] = lampTmp.x; U.pos[i * 3 + 1] = lampTmp.y; U.pos[i * 3 + 2] = lampTmp.z; U.lev[i] = L.level * fl * (1 + 0.9 * flashK); U.siz[i] = U.sizeGlow * (1 + 0.5 * flashK);
  });
  U.pg.geometry.attributes.position.needsUpdate = true; U.pg.geometry.attributes.aL.needsUpdate = true; U.pg.geometry.attributes.aS.needsUpdate = true;
  U.glow.uniforms.uK.value = Math.min(1.25, 0.3 + 0.85 * cur.lamp); U.day.uniforms.uK.value = Math.min(0.85, dayK * 1.3);
  lampDots.forEach((d, i) => d.classList.toggle('on', i < dueN)); lampCount.textContent = dueN + ' / 5';
}

document.getElementById('reset').addEventListener('click', () => { resetAll(); update(0); });

// ---------- camera (same as 苔痕驛站) ----------
const BASE_EL = 31 * Math.PI / 180, BASE_AZ = Math.PI / 4;
let yawOff = 0, pitchOff = 0, dragging = false, lastX = 0, lastY = 0;
const VIEW_FACE = Math.atan2(Math.sin(BASE_AZ), Math.cos(BASE_AZ));
function placeCamera() { const el = BASE_EL + pitchOff, az = BASE_AZ + yawOff; camera.position.set(target.x + DIST * Math.cos(el) * Math.sin(az), target.y + DIST * Math.sin(el), target.z + DIST * Math.cos(el) * Math.cos(az)); camera.lookAt(target); }
let baseVw = 45;
function reflSizeFor() { const zf = Math.max(1, Math.min(2, baseVw / ((camera.right - camera.left) / camera.zoom))); return [Math.max(2, Math.round(uRes.x * 0.5 * zf)), Math.max(2, Math.round(uRes.y * 0.5 * zf))]; }
function syncRefl(force) { const s = reflSizeFor(); if (force || Math.abs(s[0] / rt.width - 1) > 0.06) rt.setSize(s[0], s[1]); }   // half resolution x min(2, zoom); hysteresis so an animated zoom does not rebuild the target every frame
function resize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; renderer.setSize(w, h, false); const aspect = w / h;
  let vw = Math.max(40, 25.5 * aspect); if (aspect < 1) vw = 30; const vh = Math.max(vw / aspect, 25.5 * (aspect < 1 ? 1.2 : 1)); vw = vh * aspect;
  Object.assign(camera, { left: -vw / 2, right: vw / 2, top: vh / 2, bottom: -vh / 2 }); camera.updateProjectionMatrix();
  glass.setSize(w, h);
  const bs = renderer.getDrawingBufferSize(new T.Vector2()); uRes.set(bs.x, bs.y); baseVw = vw; syncRefl(true);   // reflection at half resolution, more when zoomed in
}



// ---------- loop ----------
const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
let heading = VIEW_FACE;
const TIDE_NAME = { low: '退潮', rising: '漲潮中', high: '滿潮', falling: '退潮中' };
const TOD_NAME = { dawn: '晨霧', day: '白天', dusk: '薄暮', night: '夜' };
function update(dt) {
  if (playing || sim === 0 || forceMotion) tAcc += dt * MOTION;
  const wind = 0.55 + 0.3 * Math.sin(tAcc * 0.13) + 0.25 * Math.max(0, Math.sin(tAcc * 0.37 + 1.3));
  // sim is supplied by the backend clock; never advance rewards from RAF.
  // ----- tide line -----
  const nat = tideAt(TIDE_SEED, sim);
  const want = tideMan ? tideMan.level : nat.level;
  if (tideTrans) { tideTrans.t += dt; const x = Math.min(1, tideTrans.t / TIDE_EASE); tideShown = tideTrans.from + (want - tideTrans.from) * sm5(x); if (x >= 1) tideTrans = null; } else tideShown = want;
  const trend = tideShown - prevShown; prevShown = tideShown;
  if (tideMan || tideTrans) {
    tidePhase = tideShown < 0.004 ? 'low' : tideShown > 0.996 ? 'high' : (tideTrans ? (want >= tideTrans.from ? 'rising' : 'falling') : (trend > 0 ? 'rising' : 'falling'));
    if (tideShown > 0.004) wetShown = 1; else if (tideMan && tideMan.wet !== undefined) wetShown = tideMan.wet; else wetShown = Math.max(0, wetShown - (playing ? dt * speed / DRY_S : 0));
  } else { tidePhase = nat.phase; wetShown = nat.wet; }
  WL = WL_LOW + (WL_HIGH - WL_LOW) * tideShown;
  water.position.y = WL; WU.uWL.value = WL; tidalUpdate(WL, tAcc);
  // ----- traveller (road network, wading, demo planner) -----
  travUpdate(dt);
  // ----- sky: day/night line -----
  const tod = timeOfDayAt(sim); const key = blendState(tod, dt);
  scene.background.copy(cur.haze); scene.fog.color.copy(cur.haze); scene.fog.near = DIST + cur.fogN; scene.fog.far = DIST + cur.fogF;
  document.body.style.backgroundColor = '#' + cur.haze.getHexString();
  document.body.classList.toggle('paper', (key === 'dawn' || key === 'day'));
  sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(target).addScaledVector(cur.sunAt, 70); sun.target.position.copy(target);
  hemi.color.copy(cur.hS); hemi.groundColor.copy(cur.hG); hemi.intensity = cur.hI;
  travLight.intensity = 0.8 * Math.min(1.4, cur.lamp); travHalo.material.opacity = Math.min(0.45, cur.lamp * 0.3); travGlowMat.emissiveIntensity = 0.6 + 0.6 * Math.min(1, cur.lamp);
  WU.uTime.value = tAcc; WU.uRipple.value = (1 - 0.88 * tideShown) * MOTION / 1;
  WU.uSkyTop.value.copy(cur.skyTop); WU.uHaze.value.copy(cur.haze); WU.uCloud.value.copy(cur.cloud); WU.uTint.value.copy(cur.skyTop).multiplyScalar(0.5);
  PUD.color.copy(cur.skyTop).lerp(cur.haze, 0.3).multiplyScalar(0.97);
  { const sa = cur.sunAt, su = (sa.x - sa.z) * Math.SQRT1_2, sv = (-sa.z - sa.x) * Math.SQRT1_2, hy = Math.hypot(su, sv) || 1; WU.uSunUV.value.set(su / hy, sv / hy); WU.uGlint.value = cur.glint; WU.uTide.value = tideShown; WU.uGlintK.value = Math.max(1, baseVw / ((camera.right - camera.left) / camera.zoom)); }
  WU.uHazeLo.value = cur.hazeLo; WU.uCloudAmt.value = cur.cloudAmt; WU.uStar.value = cur.star; WU.uBot.value = cur.bot;
  R.faders.forEach((f) => { f.m.color.copy(f.base).lerp(cur.haze, f.k); });
  applyWet(wetShown);
  clockEl.textContent = fmt(sim); clockBox.classList.toggle('over', sim > PLANNED);
  skyEl.innerHTML = '<b>' + TIDE_NAME[tidePhase] + '</b> · ' + TOD_NAME[key];
  // ----- world motion -----
  const sway = wind * MOTION * (1 - 0.25 * tideShown);   // a little calmer at high tide, to match the mirror
  R.crowns.forEach((q) => { q.o.rotation.z = Math.sin(tAcc * 0.7 + q.ph) * q.amp * sway; q.o.rotation.x = Math.sin(tAcc * 0.5 + q.ph * 1.7) * q.amp * 0.6 * sway; });
  R.reeds.forEach((q) => { q.o.rotation.x = Math.sin(tAcc * 1.1 + q.ph) * q.amp * sway; q.o.rotation.z = Math.sin(tAcc * 0.8 + q.ph * 1.7) * q.amp * 0.7 * sway; });
  lampsUpdate(dt, false);
  LIFE.update(tAcc, { WL, tide: tideShown, cur, trav: [TR.u, TR.v], route: TR.route ? TR.route.pts : null });
  if (!dragging && !holdCam) { const q = Math.exp(-dt * 2.6); yawOff *= q; pitchOff *= q; }
  bridgeFxUpdate(dt);
  s4Update(dt);
  travLightAnchor.getWorldPosition(travLight.position);
  if (!trav.visible) travLight.intensity = 0;
  placeCamera();
}


// ---------- ?graph=1 : the road network drawn over the scene (no text) ----------
const GOV = (() => {
  const c = document.createElement('canvas'); c.setAttribute('aria-hidden', 'true'); c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:4;display:none'; document.body.appendChild(c);
  return { c, g: c.getContext('2d'), on: false };
})();
const GCOL = { path: '#9aa0a6', spot: '#4f9dff', lamp: '#ffb300', gate: '#3fd07a', rest: '#ffffff' };
function nodeColor(n) { const k = n.kind; if (k.indexOf('entry') >= 0 || k.indexOf('exit') >= 0 || k.indexOf('spawn') >= 0) return GCOL.gate; if (k.indexOf('rest') >= 0) return GCOL.rest; if (k.indexOf('lamp') >= 0) return GCOL.lamp; if (k.indexOf('spot') >= 0) return GCOL.spot; return GCOL.path; }
function setGraphOverlay(on) { GOV.on = !!on; GOV.c.style.display = GOV.on ? 'block' : 'none'; }
if (Q.get('graph') === '1') setGraphOverlay(true);
function drawGraph() {
  const c = GOV.c, g = GOV.g, w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const P = new T.Vector3(); const pr = (u, v, y) => { P.copy(W(u, v, y + 0.05)).project(camera); return [(P.x + 1) / 2 * w, (1 - P.y) / 2 * h]; };
  g.lineWidth = 2.5; g.lineCap = 'round'; g.lineJoin = 'round';
  EDGES.forEach((E) => {
    g.strokeStyle = 'rgba(214,218,224,0.85)'; g.beginPath();
    for (let i = 0; i <= E.n; i += 2) { const q = E.P[i], p = pr(q[0], q[1], E.y[i]); if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
    const q = E.P[E.n], p = pr(q[0], q[1], E.y[E.n]); g.lineTo(p[0], p[1]); g.stroke();
    E.hops.forEach((hp) => { const a = E.P[hp[0]], b = E.P[hp[1]], pa = pr(a[0], a[1], E.y[hp[0]]), pb = pr(b[0], b[1], E.y[hp[1]]); g.strokeStyle = 'rgba(255,120,120,0.95)'; g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke(); });
  });
  IDS.forEach((id) => { const n = NODE[id], p = pr(n.u, n.v, n.y); g.fillStyle = nodeColor(n); g.strokeStyle = 'rgba(20,24,32,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], 6.5, 0, 6.2832); g.fill(); g.stroke(); });
}

// ---------- one frame = reflection pass (half-res, clipped at the water plane) + main pass ----------
let lastStats = { calls: 0, triangles: 0 };
function renderFrame() {
  renderer.info.reset(); syncRefl(false); bridgeFxPrepare();
  reflCam.left = camera.left; reflCam.right = camera.right; reflCam.top = camera.top; reflCam.bottom = camera.bottom; reflCam.zoom = camera.zoom; reflCam.near = camera.near; reflCam.far = camera.far; reflCam.updateProjectionMatrix();
  reflCam.position.set(camera.position.x, 2 * WL - camera.position.y, camera.position.z);
  reflCam.up.set(0, -1, 0); reflCam.lookAt(target.x, 2 * WL - target.y, target.z); reflCam.updateMatrixWorld();
  texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  const bg = scene.background; scene.background = null;
  clipPlane.constant = -(WL - 0.005); renderer.clippingPlanes = [clipPlane];
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.shadowMap.autoUpdate = true;
  renderer.render(scene, reflCam);
  renderer.setRenderTarget(null); renderer.clippingPlanes = []; scene.background = bg;
  renderer.shadowMap.autoUpdate = false;
  S4P.mirrorRender();       // the shadow map was just rendered; the main pass reuses it
  glass.render(scene, camera, 0.016, cur.haze, [0.34, 0.24, 0.08], paused);
  lastStats = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  if (GOV.on) drawGraph();
}
// =====================================================================
// stage 4 · events, rest, special finds, departures, world marks (SPEC 11, 11.7, 11.8)
// Everything here is picture only: the real draw and the saving belong to the App. The demo planner stands in for them.
// Props are built once, hidden, and shown by the sequences; nothing in the scene is ever hidden or cut away to get a better view (SPEC 11.7.1).
// =====================================================================
const EVT = {}, EVENTS = [];
(AREA.events || []).forEach((e) => { EVT[e.id] = e; if (!e.rare && e.weight > 0) EVENTS.push(e); });
const REST_LIST = AREA.restActivities || [];
const usedOnce = new Set(), journal = [];
const marks = { cupLeft: false, ringStill: true, boatShells: 0, pineCones: 0, gaugeCarving: false };
const trip = { steleWiped: false, steleArm: 0, shardGone: false, journeyLamp: 1, journey: null, say: -1 };
const win = (p, a, b) => clamp01((p - a) / (b - a));
const eio = easeInOut;
const uvDir = (a, b) => uvHeading(b[0] - a[0], b[1] - a[1]);
const S4P = {};   // props
camera.layers.enable(2);   // layer 2 = picture-only effects (glints, stars, haze): drawn by the main camera and the mirror, not by the water reflection (keeps the draw count down)
const fx2 = (o) => { o.traverse((c) => { c.layers.set(2); }); return o; };
const S4X = S4_HANDLES || {};   // handles exported from the scene build (boat, frame shard)
const DEPART_T = (AREA.departureDurationMs || 5000) / 1000;

// ---------- traveller materials: private copies so the traveller can fade out without touching the scene's shared materials ----------
const TRMATS = [];
trav.traverse((o) => { if (o.isMesh && o.material && o !== travLamp) { const m = o.material.clone(); m.userData = Object.assign({}, o.material.userData, { noMerge: true }); o.material = m; TRMATS.push(m); } });
let travFade = 1;
function applyFade(f) {
  travFade = f; trav.visible = f > 0.004;
  TRMATS.forEach((m) => { m.transparent = f < 0.999; m.opacity = f; m.depthWrite = f > 0.5; });
  travHalo.material.opacity *= f; travLight.intensity *= f; travGlowMat.emissiveIntensity *= f;
}

// ---------- small helpers ----------
const addNM = (o, parent) => { o.userData.noMerge = true; o.userData.noSolid = true; o.traverse((c) => { c.userData.noMerge = true; c.userData.noSolid = true; }); (parent || scene).add(o); return o; };
const stdM = (c, o) => { const m = new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.0 }, o || {})); m.userData.noMerge = true; return m; };
const radTex = (rgb0, rgb1) => canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, `rgba(${rgb0},1)`); g.addColorStop(0.3, `rgba(${rgb1},0.4)`); g.addColorStop(1, `rgba(${rgb1},0)`); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const blueTex = radTex('235,248,255', '110,190,255');
const starTex = canvasTex(128, 128, (x) => { x.translate(64, 64); const arm = (len, w, a) => { x.save(); x.rotate(a); const g = x.createLinearGradient(-len, 0, len, 0); g.addColorStop(0, 'rgba(255,215,140,0)'); g.addColorStop(0.5, 'rgba(255,245,215,1)'); g.addColorStop(1, 'rgba(255,215,140,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, len, w, 0, 0, 6.3); x.fill(); x.restore(); }; arm(60, 3.2, 0); arm(60, 3.2, Math.PI / 2); arm(34, 2.4, Math.PI / 4); arm(34, 2.4, -Math.PI / 4); const g = x.createRadialGradient(0, 0, 0, 0, 0, 24); g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(-64, -64, 128, 128); });
const streakTex = canvasTex(8, 64, (x) => { const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(235,248,255,0.95)'); g.addColorStop(1, 'rgba(235,248,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64); });
const beamTex = canvasTex(8, 128, (x) => { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(70,160,255,0)'); g.addColorStop(0.5, 'rgba(70,160,255,.7)'); g.addColorStop(1, 'rgba(170,220,255,1)'); x.fillStyle = g; x.fillRect(0, 0, 8, 128); });
const plateTex = canvasTex(128, 96, (x) => { const g = x.createLinearGradient(0, 0, 128, 96); g.addColorStop(0, '#5f9b87'); g.addColorStop(0.5, '#4d8672'); g.addColorStop(1, '#6aa38d'); x.fillStyle = g; x.fillRect(0, 0, 128, 96); x.fillStyle = 'rgba(160,110,60,.35)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(((i * 53) % 128), ((i * 37) % 96), 3 + (i % 5), 0, 6.3); x.fill(); } x.strokeStyle = 'rgba(20,50,44,.85)'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { const y = 10 + i * 8; x.beginPath(); x.moveTo(14, y); x.lineTo(114 - (i % 2) * 18, y); x.stroke(); } x.strokeStyle = 'rgba(150,105,60,.9)'; x.lineWidth = 3; x.strokeRect(2, 2, 124, 92); });
const spr = (tex, col, s, op, add) => { const m = new T.SpriteMaterial({ map: tex, color: col, blending: add === false ? T.NormalBlending : T.AdditiveBlending, depthWrite: false, transparent: true, opacity: op, fog: false }); const o = new T.Sprite(m); o.scale.set(s, s, 1); o.renderOrder = 5; o.layers.set(2); return o; };
const glintGroup = (s) => { const g = new T.Group(); g.add(spr(haloTex, 0xffd890, s * 1.5, 0.85)); g.add(spr(starTex, 0xffffff, s, 0.95)); g.userData.s = s; return g; };
const setGlint = (g, k) => { g.visible = k > 0.01; g.children.forEach((c, i) => { c.material.opacity = k * (i === 1 ? 0.95 : 0.85); }); const f = 0.6 + 0.4 * k; g.scale.setScalar(f); };

// one merged geometry for a row of small props (shells, cones): a single draw call, shown by draw range
function mergeSlots(slots) {
  const pos = [], nor = [], col = [], counts = []; let total = 0;
  slots.forEach((slot) => { slot.forEach(([g, m, hex]) => { const gg = g.index ? g.toNonIndexed() : g.clone(); gg.applyMatrix4(m); const p = gg.attributes.position, nn = gg.attributes.normal, c = new T.Color(hex); for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(nn.getX(i), nn.getY(i), nn.getZ(i)); col.push(c.r, c.g, c.b); } total += p.count; }); counts.push(total); });
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return { geo, counts };
}
const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new T.Matrix4().compose(V3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), V3(sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz));

// ---------- world marks: shells on the boat gunwale, pine cones on the rock beside lamp 4 ----------
{
  const mid = [[-1.22, 0.395], [0.3, 0.475], [0.95, 0.275]]; const segs = []; let tot = 0; for (let i = 0; i < 2; i++) { const l = Math.hypot(mid[i + 1][0] - mid[i][0], mid[i + 1][1] - mid[i][1]); segs.push(l); tot += l; }
  const cols = [0xf3e8d6, 0xe6c4b4, 0xd8d1c0, 0xf0dcc8]; const slots = [];
  const hemi = new T.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), rib = new T.BoxGeometry(0.004, 0.004, 0.05);
  for (let i = 0; i < 10; i++) {
    let d = (i + 0.5) / 10 * tot, k = 0; while (k < 1 && d > segs[k]) { d -= segs[k]; k++; } const t = d / segs[k];
    const x = mid[k][0] + (mid[k + 1][0] - mid[k][0]) * t, z = mid[k][1] + (mid[k + 1][1] - mid[k][1]) * t, ry = (i * 1.7) % 3; const slot = [];
    slot.push([hemi, M4(x, 0.345, z, 0, ry, 0, 1.1, 0.55, 0.9), cols[i % 4]]);
    for (let r = 0; r < 5; r++) slot.push([rib, M4(x, 0.378, z, 0, ry + (r - 2) * 0.42, 0), 0xb9a58f]);
    slots.push(slot);
  }
  const mg = mergeSlots(slots); const sm = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true }); sm.userData.noMerge = true;
  S4P.shells = new T.Mesh(mg.geo, sm); S4P.shells.userData.noMerge = true; S4P.shells.userData.noSolid = true; fx2(S4P.shells); S4P.shells.visible = false; S4P.shellCounts = mg.counts; S4P.shells.castShadow = false;
  if (S4X.boatInn) S4X.boatInn.add(S4P.shells);
}
{
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; const r = Math.sin(t * Math.PI) * 0.06 * (1 + 0.28 * Math.cos(i * 2.5)) * (1 - 0.15 * t); pts.push(new T.Vector2(Math.max(0.002, r), t * 0.15 - 0.075)); }
  const cg = new T.LatheGeometry(pts, 7); cg.scale(1.35, 1.35, 1.35); const slots = [];
  [[8.1, 1.78, 1.0], [8.28, 2.3, 2.1], [8.74, 2.34, 0.4], [7.92, 2.12, 3.0], [8.52, 1.7, 5.0], [8.95, 2.05, 4.1]].forEach((q) => { const w = W(q[0], q[1], groundH(q[0], q[1]) + 0.04); slots.push([[cg, new T.Matrix4().compose(w, new T.Quaternion().setFromEuler(new T.Euler(1.35, q[2], 0, 'XYZ')), V3(1, 1, 1)), 0x7a5230]]); });
  const mg = mergeSlots(slots); const cm = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }); cm.userData.noMerge = true;
  S4P.cones = new T.Mesh(mg.geo, cm); S4P.cones.userData.noMerge = true; S4P.cones.userData.noSolid = true; fx2(S4P.cones); S4P.cones.visible = false; S4P.coneCounts = mg.counts; S4P.cones.castShadow = false; scene.add(S4P.cones);
}
function applyMarks() {
  const sc = Math.min(10, marks.boatShells), pc = Math.min(6, marks.pineCones);
  S4P.shells.visible = sc > 0; if (sc > 0) S4P.shells.geometry.setDrawRange(0, S4P.shellCounts[sc - 1]);
  S4P.cones.visible = pc > 0; if (pc > 0) S4P.cones.geometry.setDrawRange(0, S4P.coneCounts[pc - 1]);
  if (MARKS.streaks) MARKS.streaks.visible = !trip.steleWiped;
}
// the stele's water stain comes back after the next high tide has ended (not across days)
function steleTick() {
  if (!trip.steleWiped) return;
  if (trip.steleArm === 0 && tideShown > 0.85) trip.steleArm = 1;
  else if (trip.steleArm === 1 && tideShown < 0.5) { trip.steleWiped = false; trip.steleArm = 0; applyMarks(); }
}

// ---------- the cup on the platform's south edge (first rest: upside down; afterwards it stays, upright) ----------
const CUP_AT = [1.07, 9.28], SEAT_FACE = [0.42, 8.0];   // he sits turned toward the south-west (the bridge), which reads as sitting from this camera
{
  const g = new T.Group(); const inner = new T.Group(); inner.position.y = 0.045; g.add(inner);
  const cm = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }); cm.userData.noMerge = true;
  const cmg = mergeSlots([[[new T.CylinderGeometry(0.058, 0.044, 0.09, 14), M4(0, 0, 0), 0xe9e4d6], [new T.TorusGeometry(0.03, 0.009, 6, 12, Math.PI), M4(0.066, 0, 0, 0, 0, -Math.PI / 2), 0xe9e4d6]]]);
  const body = new T.Mesh(cmg.geo, cm); inner.add(body);
  const lq = new T.Mesh(new T.CircleGeometry(0.05, 14).rotateX(-Math.PI / 2), stdM(0x7b4b27, { roughness: 0.2 })); lq.position.y = 0.039; inner.add(lq);
  const steam = { material: { opacity: 0 } };
  addNM(fx2(g)); g.visible = true; S4P.cup = { g, inner, lq, steam };
  g.position.copy(W(CUP_AT[0], CUP_AT[1], SEAT_BENCH.top));
}
let cupMode = 'auto';   // auto | inv | flip | up | hand
function cupUpdate(mode, flip) {
  const C = S4P.cup; let m = mode;
  if (m === 'auto') m = marks.cupLeft ? 'up' : 'inv';
  C.g.visible = m !== 'hand';
  let rx = 0, hop = 0;
  if (m === 'inv') rx = Math.PI; else if (m === 'flip') { rx = Math.PI * (1 - eio(flip)); hop = 0.07 * Math.sin(Math.PI * clamp01(flip)); }
  C.inner.rotation.x = rx; C.inner.position.y = 0.045 + hop; C.lq.visible = m === 'up' || (m === 'flip' && flip > 0.5);
  C.steam.material.opacity = (m === 'up' && marks.cupLeft && TR.state === 'rest' && TR.act && TR.act.id === 'rest_cup_first') ? 0 : 0;
}

// ---------- rare-find props ----------
const mkPlate = (w) => { const g = new T.Group(); const side = stdM(0x7a5a33); const plm = stdM(0xffffff, { map: plateTex, roughness: 0.65, metalness: 0.3 }); const bg = new T.BoxGeometry(w, w * 0.75, 0.014); bg.clearGroups(); const m = new T.Mesh(bg, plm); g.add(m); return g; };
S4P.plate = mkPlate(0.21); addNM(S4P.plate); S4P.plate.visible = false;
S4P.shardItem = (() => {
  const g = new T.Group(); const ss = new T.Shape(); ss.moveTo(-0.12, -0.14); ss.lineTo(0.1, -0.14); ss.lineTo(0.04, -0.01); ss.lineTo(-0.12, 0.12); ss.lineTo(-0.12, -0.14); const geo = new T.ShapeGeometry(ss);
  const fr = new T.Mesh(geo, stdM(0xc8ced6, { roughness: 0.4, emissive: 0xbfd3e6, emissiveIntensity: 0.07, side: T.FrontSide })), bk = new T.Mesh(geo, stdM(0xc8ced6, { roughness: 0.4, side: T.BackSide }));
  g.add(fr); g.add(bk); g.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: 0x6a7480 }))); addNM(g); g.visible = false; return g;
})();
S4P.itemGlint = glintGroup(0.5); addNM(S4P.itemGlint); S4P.itemGlint.visible = false;
S4P.srcGlint = glintGroup(0.8); addNM(S4P.srcGlint); S4P.srcGlint.visible = false;
S4P.chips = []; { const cm = stdM(0x8d8f8c); for (let i = 0; i < 3; i++) { const o = new T.Mesh(new T.IcosahedronGeometry(0.024 + 0.006 * (i % 3), 0), cm); o.visible = false; addNM(fx2(o)); S4P.chips.push(o); } }
S4P.seam = new T.Mesh(new T.BoxGeometry(0.28, 0.025, 0.012), new T.MeshBasicMaterial({ color: 0x15171a })); addNM(fx2(S4P.seam)); S4P.seam.visible = false;
S4P.amberRing = new T.Mesh(new T.RingGeometry(0.34, 0.4, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); addNM(fx2(S4P.amberRing)); S4P.amberRing.visible = false;

// ---- the water mirror (core) ----
const RC = RING.c;
const mrt = new T.WebGLRenderTarget(512, 512, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat }); mrt.texture.generateMipmaps = false;
const vcam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100); vcam.layers.set(0); vcam.layers.enable(2);
const mTm = new T.Matrix4(), mClip = new T.Plane();
const mirrorMat = new T.ShaderMaterial({
  uniforms: { tMap: { value: mrt.texture }, tm: { value: mTm }, uT: { value: 0 }, uBright: { value: 0.93 } },
  vertexShader: 'varying vec4 vP; varying vec2 vL; uniform mat4 tm; void main(){ vL = position.xy; vP = tm * modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tMap; uniform float uT; uniform float uBright; varying vec4 vP; varying vec2 vL; void main(){ vec2 uv = vP.xy / vP.w; float r = length(vL) / 0.98; uv += 0.0010 * vec2(sin(vL.y * 11.0 + uT * 1.3 + vL.x * 3.0), cos(vL.x * 9.0 - uT * 1.1 + vL.y * 2.0)); vec3 c = texture2D(tMap, uv).rgb; c = mix(c, vec3(0.50, 0.72, 0.96), 0.24) * uBright; c *= 1.0 - 0.2 * smoothstep(0.55, 1.0, r); c = mix(c, vec3(0.62, 0.82, 0.98), 0.35 * smoothstep(0.93, 1.0, r)); gl_FragColor = vec4(c, 1.0); }',
  fog: false });
mirrorMat.userData.noMerge = true;
S4P.disc = new T.Group(); S4P.disc.visible = false; addNM(S4P.disc);
S4P.discT = new T.Group(); S4P.disc.add(S4P.discT);
{
  const face = new T.Mesh(new T.CircleGeometry(0.98, 64), mirrorMat); S4P.discT.add(face);
  const back = new T.Mesh(new T.CircleGeometry(0.98, 48).rotateY(Math.PI), new T.MeshBasicMaterial({ color: 0x86a9c8, fog: false })); back.position.z = -0.004; S4P.discT.add(back);
  const rim = new T.Mesh(new T.RingGeometry(0.93, 1.03, 64), new T.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); rim.position.z = 0.004; S4P.discT.add(rim);
  const rim2 = new T.Mesh(new T.RingGeometry(1.0, 1.14, 64), new T.MeshBasicMaterial({ color: 0x8ac9ff, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); rim2.position.z = 0.003; S4P.discT.add(rim2);
  S4P.streaks = new T.Group(); S4P.discT.add(S4P.streaks);
  const seed = (i) => { const s = Math.sin(i * 91.7 + 3.1) * 43758.5; return s - Math.floor(s); };
  for (let i = 0; i < 26; i++) { const th = (200 + (i / 25) * 140) * Math.PI / 180; const len = 0.22 + 0.36 * seed(i); const m = new T.Mesh(new T.PlaneGeometry(0.018 + 0.012 * seed(i + 9), len), new T.MeshBasicMaterial({ map: streakTex, color: 0xeaf7ff, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); m.position.set(Math.cos(th) * 0.995, Math.sin(th) * 0.995 - len / 2 + 0.01, -0.006); S4P.streaks.add(m); }
}
S4P.basin = new T.Mesh(new T.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2), stdM(0x3f4a4d, { roughness: 0.35, metalness: 0.1 })); S4P.basin.position.copy(W(RC[0], RC[1], 0.012)); S4P.basin.visible = false; addNM(S4P.basin);
S4P.beam = new T.Group(); S4P.beam.position.copy(W(RC[0], RC[1], 0.1)); S4P.beam.visible = false; addNM(S4P.beam);
{
  const b1 = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 4.0, 28, 1, true), new T.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide, fog: false })); b1.position.y = 2.0; S4P.beam.add(b1);
  const b2 = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 4.0, 20, 1, true), new T.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide, fog: false })); b2.position.y = 2.0; S4P.beam.add(b2);
  const gl = spr(blueTex, 0xffffff, 2.2, 0.8); gl.position.y = 0.25; S4P.beam.add(gl);
  S4P.beamRings = [1.25, 1.85].map((r, i) => { const m = new T.Mesh(new T.RingGeometry(r - 0.035, r + 0.035, 64).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: i ? 0.16 : 0.3, blending: T.AdditiveBlending, depthWrite: false, fog: false })); m.position.y = 0.04; S4P.beam.add(m); return m; });
  S4P.beamParts = { b1, b2, gl };
}
S4P.stars = []; S4P.starLines = [];
{
  const lm = new T.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 14; i++) { const s = spr(blueTex, 0xffffff, 0.34, 1.0); s.visible = false; addNM(s); s.add(spr(blueTex, 0xffffff, 0.09, 1.0)); S4P.stars.push(s); const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)); const ln = new T.Line(lg, lm); ln.frustumCulled = false; ln.visible = false; addNM(ln); S4P.starLines.push(ln); }
}
S4P.touch = new T.Group(); S4P.touch.visible = false; addNM(S4P.touch);
{ S4P.touchGlow = spr(blueTex, 0xffffff, 0.34, 0.9); S4P.touch.add(S4P.touchGlow); S4P.touchRing = new T.Mesh(new T.RingGeometry(0.2, 0.25, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, fog: false })); S4P.touch.add(S4P.touchRing); }
S4P.veil = spr(radTex('232,238,242', '232,238,242'), 0xffffff, 3.2, 0.0, false); S4P.veil.visible = false; addNM(S4P.veil);

// reflection of the traveller turns its head one beat later than he does (SPEC 11.8.5): remember the head angle a moment ago
const headHist = []; let headDelayed = 0;
function mirrorRender() {
  const D = S4P.disc; if (!D.visible || travFade < 0.01) return;
  mirrorMat.uniforms.uT.value = performance.now() / 1000;
  D.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  const P = new T.Vector3().setFromMatrixPosition(S4P.discT.matrixWorld);
  const rot = new T.Matrix4().extractRotation(S4P.discT.matrixWorld);
  const n = new T.Vector3(0, 0, 1).applyMatrix4(rot).normalize();
  const cp = new T.Vector3().setFromMatrixPosition(camera.matrixWorld);
  const view = P.clone().sub(cp); if (view.dot(n) > 0) return;
  view.reflect(n).negate().add(P);
  const crot = new T.Matrix4().extractRotation(camera.matrixWorld);
  const look = new T.Vector3(0, 0, -1).applyMatrix4(crot).add(cp);
  const tgt = P.clone().sub(look).reflect(n).negate().add(P);
  vcam.position.copy(view); vcam.up.set(0, 1, 0).applyMatrix4(crot).reflect(n); vcam.lookAt(tgt);
  // Opus 2026-10-03: the mirror camera only frames the disc (plus a margin) instead of the whole view, so frustum culling drops
  // nearly everything the disc cannot show (core draw calls ~400-510 -> see report) and the texels all land on the disc.
  vcam.updateMatrixWorld(); const pv = P.clone().applyMatrix4(vcam.matrixWorldInverse);
  const dsc = new T.Vector3().setFromMatrixScale(S4P.discT.matrixWorld); const R = 0.98 * Math.max(dsc.x, dsc.y) * 1.25 + 0.05;
  const dn = Math.max(camera.near, -pv.z - 1.2);   // everything between the mirror camera and the disc is behind the mirror anyway
  Object.assign(vcam, { left: pv.x - R, right: pv.x + R, top: pv.y + R, bottom: pv.y - R, zoom: 1, near: dn, far: Math.min(camera.far, dn + 14) }); vcam.updateProjectionMatrix(); vcam.updateMatrixWorld();
  mTm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
  mClip.setFromNormalAndCoplanarPoint(n, P.clone().addScaledVector(n, 0.02));
  const pxPerU = renderer.getDrawingBufferSize(new T.Vector2()).y / ((camera.top - camera.bottom) / camera.zoom); const side = Math.min(1024, Math.max(128, Math.round(2 * R * pxPerU / 64) * 64)); if (mrt.width !== side || mrt.height !== side) mrt.setSize(side, side);   // square, about screen resolution over the disc
  const hy = head.rotation.y; head.rotation.y = headDelayed;   // the mirror image lags behind the traveller
  const vis = D.visible; D.visible = false; const bg = scene.background; scene.background = bg;
  const oldClip = renderer.clippingPlanes, sAuto = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;   // reuse this frame's shadow maps (no second shadow pass)
  renderer.clippingPlanes = [mClip]; renderer.setRenderTarget(mrt); renderer.render(scene, vcam);
  renderer.setRenderTarget(null); renderer.clippingPlanes = oldClip; renderer.shadowMap.autoUpdate = sAuto; D.visible = vis; head.rotation.y = hy;
}
S4P.mirrorRender = mirrorRender;

// ---------- the rare sequences ----------
let rare = null;   // { ev, p, src, srcQ, ... }
const GU = -10.15, GV = -0.7;   // the water gauge post (see the scene build)
const RC_V = [-0.5, -9.4];                     // where he stands to look at the mirror (camera side of the ring)
const TOUCH_AT = [RC[0] + 1.32 * Math.cos(-0.0175), RC[1] + 1.32 * Math.sin(-0.0175)];   // east side of the ring, between two stones
const TOUCH_WATER = [RC[0] + 0.78 * Math.cos(-0.0175), RC[1] + 0.78 * Math.sin(-0.0175)];
const handPos = (off) => { trav.updateMatrixWorld(true); return armL.localToWorld((off || V3(0, -0.3, 0.05)).clone()); };
const bagPos = () => { trav.updateMatrixWorld(true); return upper.localToWorld(V3(0, 0.38, -0.2)); };
function rareSource(ev) {
  if (ev.source === 'gauge') return { p: W(GU + 0.05, GV - 0.205, 0.27), q: new T.Quaternion().setFromEuler(new T.Euler(-0.32, Math.PI / 4, 0.12, 'YXZ')) };
  if (ev.source === 'boat' && S4X.boatInn) { S4X.boatInn.updateMatrixWorld(true); const p = S4X.boatInn.localToWorld(V3(0.25, 0.14, 0.12)); return { p, q: new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0.8, 0)) }; }
  if (ev.source === 'frame' && PAVFX.shard) { PAVFX.shard.updateWorldMatrix(true, false); const p = PAVFX.shard.localToWorld(V3(-0.15, -0.28, 0.02)); return { p, q: new T.Quaternion() }; }
  return { p: W(RC[0], RC[1], 0.05), q: new T.Quaternion() };
}
function startRare(ev) {
  endRare();
  const s = rareSource(ev); rare = { ev, p: 0, core: ev.tier === 'core', src: s.p, srcQ: s.q, said: -1, ringTouched: false, splashed: 0 };
  if (ev.source === 'frame') trip.shardGone = false;
}
function endRare() {
  if (!rare) return;
  [S4P.plate, S4P.shardItem, S4P.itemGlint, S4P.srcGlint, S4P.seam, S4P.disc, S4P.beam, S4P.basin, S4P.touch, S4P.amberRing].forEach((o) => { o.visible = false; });
  S4P.chips.forEach((c) => { c.visible = false; }); S4P.stars.forEach((s) => { s.visible = false; }); S4P.starLines.forEach((s) => { s.visible = false; });
  S4P.shardItem.rotation.set(0, 0, 0);
  rare = null; lakeHush = 0; flashK = 0;
  if (PAVFX.shard) PAVFX.shard.visible = !trip.shardGone;
}
let lakeHush = 0, flashK = 0, ringK = 1;
const bagItemScale = 1.15;
function itemObject(ev) { return ev.source === 'frame' ? S4P.shardItem : S4P.plate; }
function say(i, text) { if (rare && rare.said < i) { rare.said = i; setStatus(text); } }

// what the traveller does in each sequence: pose key, pose targets, facing, position
function rareOverride(p) {
  const ev = rare.ev, o = {};
  if (ev.source === 'gauge') {
    const toPost = uvDir([NODE.r_gauge.u, NODE.r_gauge.v], [GU + 0.04, GV - 0.2]);
    o.face = toPost;
    if (p < 0.12) { o.key = 'crouch'; o.prog = p / 0.12; }
    else if (p < 0.66) { o.key = 'reachDown'; o.tgt = { hip: -0.22, legX: -1.0, lean: 0.72, headX: 0.5, armL: -1.3 + 0.1 * Math.sin(p * 55) * (p < 0.5 ? 1 : 0) }; }
    else if (p < 0.88) { o.key = 'hold'; o.tgt = { headX: 0.4, armL: -1.35 }; o.face = toPost - 0.35; }
    else { o.key = 'shoulder'; o.face = toPost - 0.35; }
  } else if (ev.source === 'boat') {
    const toBoat = uvDir([NODE.r_boat.u, NODE.r_boat.v], NODE.r_boat.face);
    o.face = toBoat;
    if (p < 0.12) { o.key = 'inspect'; o.prog = p / 0.12; }
    else if (p < 0.66) { o.key = 'reachDown'; o.tgt = { hip: -0.12, legX: -0.5, lean: 0.22, headX: 0.25, armL: -1.2 }; }
    else if (p < 0.88) { o.key = 'hold'; o.tgt = { headX: 0.4, armL: -1.35 }; }
    else { o.key = 'shoulder'; }
  } else if (ev.source === 'frame') {
    const toFrame = uvDir([NODE.p_mirror.u, NODE.p_mirror.v], [0.79, 10.01]);
    if (p < 0.66) { o.face = toFrame; o.key = 'reach'; o.tgt = { armL: -1.7, headX: -0.05 }; }
    else { o.face = uvDir([NODE.p_mirror.u, NODE.p_mirror.v], [0.9, 9.2]); o.key = p < 0.88 ? 'hold' : 'shoulder'; if (p < 0.88) o.tgt = { armL: -1.55, headX: 0.35 }; }
  } else {   // core
    const waterDir = uvDir(TOUCH_AT, TOUCH_WATER);
    const ringY = (u, v) => groundH(u, v);
    const frontOfMirror = uvDir(RC_V, RC);
    if (p < 0.12) {
      const e = win(p, 0.0, 0.05);
      o.pos = [TOUCH_AT[0], TOUCH_AT[1], ringY(TOUCH_AT[0], TOUCH_AT[1])]; o.face = waterDir; o.key = 'crouch'; o.tgt = { hip: -0.2, legX: -0.95, lean: 0.6, headX: 0.4, armL: -1.35 * Math.max(0.15, e) };
    } else if (p < 0.30) {   // stand up and step back, round to the camera side of the ring
      const k = eio(win(p, 0.12, 0.30)); const ang0 = Math.atan2(TOUCH_AT[1] - RC[1], TOUCH_AT[0] - RC[0]), ang1 = Math.atan2(RC_V[1] - RC[1], RC_V[0] - RC[0]);
      const rr = (1.32 + (1.56 - 1.32) * k), aa = ang0 + (ang1 - ang0) * k; const u = RC[0] + rr * Math.cos(aa), v = RC[1] + rr * Math.sin(aa);
      o.pos = [u, v, ringY(u, v)]; o.face = uvDir([u, v], RC); o.key = k < 0.25 ? 'crouch' : 'idle'; o.tgt = k < 0.25 ? { hip: -0.2 * (1 - k * 4), legX: -0.95 * (1 - k * 4), lean: 0.6 * (1 - k * 4), headX: 0.4, armL: -1.35 * (1 - k * 4) } : { headX: -0.15 * k };
      o.walk = k > 0.25 && k < 0.95;
    } else if (p < 0.62) { o.pos = [RC_V[0], RC_V[1], ringY(RC_V[0], RC_V[1])]; o.face = frontOfMirror; o.key = 'gaze'; o.tgt = { headX: -0.5 * win(p, 0.30, 0.45) - 0.12, headY: 0 }; }
    else if (p < 0.88) { o.pos = [RC_V[0], RC_V[1], ringY(RC_V[0], RC_V[1])]; o.face = frontOfMirror; o.key = 'hold'; o.tgt = { armL: -1.15, headX: -0.12 + 0.5 * win(p, 0.62, 0.68), headY: p > 0.85 ? 0.95 : 0.0, lean: 0.03 }; }
    else { o.pos = [RC_V[0], RC_V[1], ringY(RC_V[0], RC_V[1])]; o.face = frontOfMirror + (p > 0.9 ? 0.0 : 0); o.key = 'shoulder'; o.tgt = { headY: 0.0 }; }
    if (p >= 0.62 && p < 0.88 && o.tgt) o.tgt.armL = -1.15;
  }
  return o;
}
function rareUpdate(p) {   // props, as a function of progress only (so a frozen progress is a stable picture)
  const ev = rare.ev, core = rare.core, T0 = tAcc;
  const hand = handPos(), bag = bagPos();
  const fl = p > 0.33 && p < 0.62 ? Math.sin(Math.PI * (p - 0.33) / 0.29) : 0; const pulse = 0.85 + 0.15 * Math.sin(T0 * 9);
  const held = p > 0.5 && p < 0.92 ? Math.sin(Math.PI * (p - 0.5) / 0.42) : 0;
  // ---- the item ----
  if (!core) {
    const it = itemObject(ev); it.visible = true; const sc = 1.15;
    const armQ = armL.getWorldQuaternion(new T.Quaternion());
    const heldQ = armQ.clone().multiply(new T.Quaternion().setFromEuler(ev.source === 'frame' ? new T.Euler(0.2, Math.PI, 0) : new T.Euler(0.4, 0, 0)));
    if (ev.source === 'gauge' || ev.source === 'boat') {
      const seamK = ev.source === 'gauge' ? 1 : 0; S4P.seam.visible = seamK > 0 && p < 0.52;
      if (S4P.seam.visible) { S4P.seam.position.copy(rare.src).add(V3(0, -0.01, 0)); S4P.seam.rotation.y = Math.PI / 4 + 0.0; S4P.seam.position.x += 0.0; }
      if (ev.source === 'gauge') {   // chips of stone fall when the plate comes out
        S4P.chips.forEach((c, i) => { const t = win(p, 0.34 + i * 0.015, 0.5 + i * 0.015); c.visible = t > 0 && t < 1; const gy = rare.src.y; c.position.set(rare.src.x + (i - 1) * 0.04, gy - t * t * 0.26, rare.src.z + (i % 2 ? 0.06 : -0.02) * (1 + t)); c.rotation.set(i * 2 + t * 4, i, t * 3); });
      }
    }
    if (p < 0.12) it.visible = false;
    else if (p < 0.5) { it.position.copy(rare.src); it.quaternion.copy(rare.srcQ); it.scale.setScalar(sc); it.visible = ev.source !== 'frame' ? true : false; if (ev.source === 'frame') it.visible = false; }
    else if (p < 0.66) { const t = eio((p - 0.5) / 0.16); it.position.copy(rare.src).lerp(hand, t); it.position.y += Math.sin(Math.PI * t) * 0.3; it.quaternion.copy(rare.srcQ).slerp(heldQ, t); it.scale.setScalar(sc * (0.6 + 0.4 * t)); }
    else if (p < 0.88) { it.position.copy(hand); it.position.y += Math.sin(T0 * 1.6) * 0.012; it.quaternion.copy(heldQ); it.scale.setScalar(sc); if (ev.source === 'frame') { const fl2 = eio(win(p, 0.66, 0.75)); it.quaternion.copy(armQ).multiply(new T.Quaternion().setFromEuler(new T.Euler(0.2, Math.PI * (1 - fl2), 0))); } }
    else { const t = eio(win(p, 0.88, 0.98)); it.position.copy(hand).lerp(bag, t); it.quaternion.copy(heldQ); it.scale.setScalar(sc * (1 - t)); it.visible = t < 0.98; }
    if (ev.source === 'frame') { it.visible = p >= 0.5 && p < 0.98; trip.shardGone = p >= 0.5; if (PAVFX.shard) PAVFX.shard.visible = p < 0.5; }
    // glints: amber for a keepsake, a little flash of sky blue when the shard is turned over
    const sg = S4P.srcGlint; if (p < 0.5) { sg.position.copy(rare.src).add(V3(0, 0.1, 0)); setGlint(sg, fl * pulse * 0.8); } else sg.visible = false;
    const ig = S4P.itemGlint; ig.position.copy(it.position); ig.position.y += 0.1; setGlint(ig, p >= 0.5 && p < 0.92 ? held * (0.55 + 0.45 * pulse) : 0);
    if (ev.source === 'frame' && p >= 0.66 && p < 0.8) { const f = Math.sin(Math.PI * win(p, 0.68, 0.8)); ig.children.forEach((c) => { c.material.color.setHex(0xbfd3e6); }); setGlint(ig, Math.max(held * 0.4, f)); }
    else ig.children.forEach((c, i) => { c.material.color.setHex(i === 0 ? 0xffd890 : 0xffffff); });
    const ring = S4P.amberRing; const rt = p > 0.36 && p < 0.62 ? (p - 0.36) / 0.26 : -1; ring.visible = rt >= 0;
    if (rt >= 0) { ring.position.set(rare.src.x, groundAtWorld(rare.src), rare.src.z); ring.scale.setScalar(0.6 + rt * 1.6); ring.material.opacity = (1 - rt) * 0.6; }
    return;
  }
  // ---- the core: the water mirror ----
  const D = S4P.disc, DT = S4P.discT;
  const rise = win(p, 0.30, 0.62); let e = eio(rise); e = e + 0.05 * Math.sin(Math.PI * clamp01((rise - 0.62) / 0.38)) * (rise > 0.62 ? 1 : 0);   // a little past upright, then back
  if (rise < 1) e = eio(rise) * 1.0; if (rise >= 1) e = 1;
  // overshoot just before the end of the rise
  const over = 0.06 * Math.sin(Math.PI * clamp01((p - 0.56) / 0.12));
  const tiltBack = -(e > 0.98 ? over : 0);
  D.visible = p >= 0.30 && p < 0.97; S4P.basin.visible = D.visible && p < 0.90;
  const cyFlat = 0.03, cyUp = 1.45;
  const float = eio(win(p, 0.62, 0.66)), shrink = eio(win(p, 0.88, 0.97));
  const vu = RC_V, ctr = RC;
  const dirx = ctr[0] - vu[0], dirv = ctr[1] - vu[1], dl = Math.hypot(dirx, dirv);
  const frontU = vu[0] + dirx / dl * 1.05, frontV = vu[1] + dirv / dl * 1.05;   // a step in front of him
  const du = ctr[0] + (frontU - ctr[0]) * float, dv = ctr[1] + (frontV - ctr[1]) * float;
  const cy = cyFlat + (cyUp - cyFlat) * e + (1.05 - cyUp) * float;
  const dw = W(du, dv, cy);
  const tw = W(vu[0], vu[1], 0); const toTrav = V3(tw.x - dw.x, 0, tw.z - dw.z).normalize();
  const camAz = Math.PI / 4; const ya = Math.atan2(toTrav.x, toTrav.z); let dy = camAz - ya; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  const yaw = e < 0.05 ? Math.PI / 2 : ya + dy * 0.5;
  const scl = (1 - 0.4 * float) * (1 - shrink);
  D.position.copy(dw); D.rotation.y = yaw; D.scale.setScalar(Math.max(0.001, scl));
  let sp = dw.clone(); if (shrink > 0) { D.position.lerp(bag, shrink); }
  DT.rotation.x = -Math.PI / 2 * (1 - e) + tiltBack; S4P.streaks.visible = e > 0.35; S4P.streaks.children.forEach((m) => { m.material.opacity = 0.7 * Math.min(1, (e - 0.3) / 0.4); });
  // splashes when it is put away
  if (p > 0.9 && rare.splashed < 3 && (p - 0.9) > rare.splashed * 0.02) { rare.splashed++; splashAt(du + (rare.splashed - 2) * 0.12, dv, WL); }
  // beam, rings, stars
  const B = S4P.beam; B.visible = fl > 0.01; B.position.copy(W(RC[0], RC[1], WL + 0.1)); S4P.beamParts.b1.material.opacity = 0.5 * fl; S4P.beamParts.b2.material.opacity = 0.85 * fl; S4P.beamParts.gl.material.opacity = 0.8 * fl; B.scale.y = 0.35 + 0.65 * fl;
  S4P.beamRings.forEach((r, i) => { const rt = p > 0.36 + i * 0.07 && p < 0.62 + i * 0.07 ? (p - 0.36 - i * 0.07) / 0.26 : -1; r.visible = rt >= 0; if (rt >= 0) { r.scale.setScalar(0.5 + rt * 1.6); r.material.opacity = (1 - rt) * (i ? 0.22 : 0.4); } });
  const rise2 = win(p, 0.33, 0.55), conv = eio(win(p, 0.55, 0.62));
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + 0.2; const su = RC[0] + Math.cos(a) * RING.ringR, sv = RC[1] + Math.sin(a) * RING.ringR;
    const vis = p > 0.33 && p < 0.625; const p0 = W(su, sv, 0.46 + 0.4 * eio(rise2)); const p1 = dw.clone().add(V3(0, 0.0, 0));
    const pos = p0.clone().lerp(p1, conv); pos.y += Math.sin(Math.PI * Math.min(1, conv)) * 0.3;
    const s = S4P.stars[i]; s.visible = vis; s.position.copy(pos); const sc = 0.34 * (1 - 0.35 * conv) * Math.min(1, win(p, 0.33, 0.38) * 3); s.scale.set(sc, sc, 1);
    const ln = S4P.starLines[i]; ln.visible = vis; const q = p0.clone().lerp(p1, Math.max(0, conv - 0.22)); q.y += Math.sin(Math.PI * Math.min(1, Math.max(0, conv - 0.22))) * 0.3; const arr = ln.geometry.attributes.position.array; arr[0] = q.x; arr[1] = q.y; arr[2] = q.z; arr[3] = pos.x; arr[4] = pos.y; arr[5] = pos.z; ln.geometry.attributes.position.needsUpdate = true;
  }
  // fingertip: a small ripple and a point of light where the finger meets the water (before the mirror rises)
  const tp = p > 0.04 && p < 0.14 ? (p - 0.04) / 0.10 : -1; const T_ = S4P.touch; T_.visible = tp >= 0;
  if (tp >= 0) { const hp = handPos(V3(0, -0.3, 0.0)); const wy = WL + 0.02; T_.position.set(hp.x, Math.max(wy, hp.y), hp.z); S4P.touchGlow.material.opacity = 0.9 * Math.sin(Math.PI * Math.min(1, tp * 1.15)); S4P.touchRing.scale.setScalar(0.3 + tp * 2.2); S4P.touchRing.material.opacity = (1 - tp) * 0.85; T_.children[1].position.y = -(T_.position.y - wy) + 0.0; }
  // five lamp flames flash together
  flashK = p > 0.47 && p < 0.57 ? Math.sin(Math.PI * (p - 0.47) / 0.10) : 0;
  // the whole lake goes still (SPEC 11.8.4/5), the ring becomes ordinary water at the very end
  lakeHush = win(p, 0.30, 0.36) * (1 - win(p, 0.84, 0.90));
  ringK = 1 - win(p, 0.88, 1.0);
}
const groundAtWorld = (w) => Math.max(WL, w.y - 0.2) + 0.03;
function rareFinish() {
  const ev = rare.ev; const item = ev.item;
  if (ev.tier === 'core') { setRingStill(false); ringK = 0; }
  journal.push({ t: sim, text: (ev.tier === 'core' ? '取得地圖核心：' : '收進行囊：') + item.name, kind: item.kind, tags: [] }); renderJournal();
  setStatus((ev.tier === 'core' ? '取得地圖核心：' : '收進行囊：') + item.name, 4);
  if (ev.source === 'frame') trip.shardGone = true;
  endRare();
}

// ---------- rest (SPEC 11.2, moved to the platform's south edge by SPEC 11.7) ----------
function restPool() {
  const hi = tideShown > 0.85; const last = TR.restLast;
  const first = REST_LIST.find((a) => a.once && !marks[a.worldMark]);
  if (first) return first;
  if (hi && last !== 'rest_mirror') return REST_LIST.find((a) => a.id === 'rest_mirror');
  const opts = REST_LIST.filter((a) => !a.once && a.id !== last && (!a.tide || (a.tide === 'high' && hi)) && (!a.requires || marks[a.requires])).map((a) => ({ a, w: a.weight }));
  return opts.length ? pickWeighted(opts.map((c) => ({ w: c.w, a: c.a }))).a : REST_LIST[1];
}
function restDur(act, r) { return act.once ? Math.max(14, 46 / APP_TO_DEMO / r * 1.6) : Math.max(9, mrand(act.dur[0], act.dur[1]) / APP_TO_DEMO / r); }
function startRest(act, dur) {
  TR.state = 'rest'; TR.act = act; TR.t = 0; TR.dur = dur || restDur(act, rate()); TR.restLast = act.id; TR.restSay = -1;
  setStatus('專注已完成預計時間。旅人' + act.name + '，等你結束這段專注。');
}
// pour pose: the cup stands on the bench at his right, a little behind him, so the right arm (armL in the rig) swings out and back to it
function restOverride() {
  const act = TR.act, p = clamp01(TR.t / TR.dur), nd = NODE.p_seat, o = {}; const here = [nd.u, nd.v];
  o.face = uvDir(here, SEAT_FACE); o.key = act.anim === 'sequence' ? 'sitGaze' : (act.anim || 'sitGaze'); o.cup = 'auto';
  const say = (i, t) => { if (TR.restSay < i) { TR.restSay = i; setStatus(t); } };
  if (act.id === 'rest_cup_first') {
    const toCup = uvDir(here, CUP_AT);
    // he notices the upturned cup, sits down beside it (east half of the bench), flips it with his right hand, pours, drinks
    const POUR = { armL: 0.3, armLz: -0.8, lean: 0.06, headX: 0.35 };
    if (p < 0.12) { o.key = 'gazeDown'; o.face = toCup; o.cup = 'inv'; say(0, '亭台邊的石凳上有一只倒扣的杯子。'); }
    else if (p < 0.24) { o.key = 'sit'; o.cup = 'inv'; say(1, '旅人在杯子旁邊坐下。'); }
    else if (p < 0.36) { o.key = 'sit'; o.tgt = Object.assign({}, POUR, { headX: 0.45 }); o.cup = p < 0.28 ? 'inv' : (p < 0.34 ? 'flip' : 'up'); o.flip = win(p, 0.28, 0.34); say(2, '旅人把凳上的杯子翻過來。'); }
    else if (p < 0.44) { o.key = 'sit'; o.tgt = POUR; o.cup = p < 0.41 ? 'up' : 'hand'; say(3, '旅人倒了一杯茶。'); }
    else if (p < 0.97) { o.key = 'drinkSit'; o.cup = 'hand'; say(4, '旅人慢慢喝茶。'); }
    else { o.key = 'sit'; o.cup = 'up'; }
  } else if (act.id === 'rest_tea') {
    if (p < 0.1) { o.key = 'sit'; o.tgt = { armL: 0.3, armLz: -0.8, lean: 0.06, headX: 0.35 }; o.cup = p < 0.07 ? 'up' : 'hand'; }
    else if (p < 0.96) { o.key = 'drinkSit'; o.cup = 'hand'; } else { o.key = 'sit'; o.cup = 'up'; }
  }
  return o;
}
function finishRest() {
  const act = TR.act;
  if (act && act.worldMark === 'cupLeft') { marks.cupLeft = true; journal.push({ t: sim, text: '亭台邊的石凳上留下一只杯子，之後它一直放在那裡。', kind: 'note', tags: ['MEMORY'] }); renderJournal(); setStatus('記進旅途筆記：亭台邊的石凳上留下一只杯子，之後它一直放在那裡。', 4); }
  TR.state = 'idle';
}

// ---------- departures (SPEC 11.3, fixed 5 s, same shape as 苔痕驛站) ----------
const DEPART = {};
(AREA.departures || []).forEach((d) => { DEPART[d.exit] = d; });
// The walk off the map (Opus 2026-10-03): he walks across each stone at a normal pace, crouches at its far edge, hops the gap
// (tucked legs, one short arc), lands with a small dip and walks on. Stone radii come from STONES so take-off and landing
// points sit inside the stone tops. Only the hops are in the air; everything else uses the ordinary walking gait.
const DEP_WALK = 1.15, DEP_EDGE = 0.13, DEP_NEAR = 0.3;
function stoneR(u, v) { let best = 0.3, bd = 0.25; STONES.forEach((st) => { const d = Math.hypot(st.u - u, st.v - v); if (d < bd) { bd = d; best = st.r; } }); return best; }
function departPlan(X, from) {
  const pts = [[from.u, from.v, from.y]].concat(X.offMap); const segs = []; let t = 0;
  let cur = pts[0].slice();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv), ux = du / L, uy = dv / L;
    const ra = stoneR(a[0], a[1]), rb = stoneR(b[0], b[1]);
    const off = [a[0] + ux * (ra - DEP_EDGE), a[1] + uy * (ra - DEP_EDGE), a[2]], land = [b[0] - ux * (rb - DEP_EDGE), b[1] - uy * (rb - DEP_EDGE), b[2]];
    const wl = Math.hypot(off[0] - cur[0], off[1] - cur[1]); if (wl > 0.01) { segs.push({ type: 'w', a: cur, b: off, t0: t, t1: t + wl / DEP_WALK, L: wl }); t += wl / DEP_WALK; }
    const hd = Math.hypot(land[0] - off[0], land[1] - off[1]); const ht = 0.3 + 0.2 * hd;
    segs.push({ type: 'h', a: off, b: land, t0: t, t1: t + ht, L: hd, H: 0.12 + 0.1 * hd }); t += ht; cur = land;
  }
  const last = pts[pts.length - 1]; const wl = Math.hypot(last[0] - cur[0], last[1] - cur[1]); segs.push({ type: 'w', a: cur, b: last.slice(), t0: t, t1: t + wl / DEP_WALK + 9, L: wl + 9 * DEP_WALK, end: true });
  return segs;
}
function departAt(plan, tt) {   // tt = seconds since he reappears at the exit stone
  let i = 0; while (i < plan.length - 1 && tt > plan[i].t1) i++;
  const g = plan[i]; const k = clamp01((tt - g.t0) / (g.t1 - g.t0)); const h = uvHeading(g.b[0] - g.a[0], g.b[1] - g.a[1]);
  if (g.type === 'h') { const air = 4 * k * (1 - k); return { u: g.a[0] + (g.b[0] - g.a[0]) * k, v: g.a[1] + (g.b[1] - g.a[1]) * k, y: g.a[2] + (g.b[2] - g.a[2]) * k + g.H * air, air, hop: true, near: 0, h, seg: i, k }; }
  let d = DEP_WALK * Math.max(0, tt - g.t0); if (!g.end) d = Math.min(d, g.L); const kk = g.end ? Math.min(1, d / Math.max(1e-3, g.L - 9 * DEP_WALK)) : d / g.L;
  const u = g.a[0] + (g.b[0] - g.a[0]) * kk, v = g.a[1] + (g.b[1] - g.a[1]) * kk;
  // crouch while closing on the take-off point, a smaller dip just after landing (same feel as the hops inside the map)
  let near = 0; const nx = plan[i + 1]; if (nx && nx.type === 'h') near = Math.max(near, 1 - (g.L - d) / DEP_NEAR);
  const pv = plan[i - 1]; if (pv && pv.type === 'h') near = Math.max(near, 0.6 * (1 - d / DEP_NEAR));
  return { u, v, y: g.a[2], air: 0, hop: false, near: clamp01(near), h, seg: i, k: kk };
}
function routeAt(rt, s) {
  let d = Math.max(0, s), i = 0; while (i < rt.legs.length - 1 && d > rt.legs[i].e.L) { d -= rt.legs[i].e.L; i++; }
  const lg = rt.legs[i], q = legAt(lg, d), a = legAt(lg, d - 0.14), b = legAt(lg, d + 0.14);
  return { u: q.u, v: q.v, y: q.y, h: uvHeading(b.u - a.u, b.v - a.v), slope: (b.sy - a.sy) / 0.28, hop: q.hop, near: q.near };
}
function previewDepart(exitId) {
  endRare(); const X = DEPART[exitId]; if (!X) return;
  sim = Math.max(sim, PLANNED); TR.lit = 5; TR.pending = [];
  const wasSeat = TR.state === 'rest' && TR.node === 'p_seat';
  if (!wasSeat) { setAt('p_seat'); TR.heading = nodeFace('p_seat'); heading = TR.heading; Object.assign(pose, POSE.sitGaze); }
  TR.route = null; TR.state = 'depart'; TR.act = null; TR.free = false;
  TR.dep = { exit: exitId, X, from: 'p_seat', route: buildRoute('p_seat', X.exitNode), t: 0, said: -1, lastSeg: -1, fade: 1 };
  playing = true; updatePlayLabel(); setStatus('新的一段專注開始了，路線選的是' + X.label + '。旅人從亭台邊起身。');
}
function departOverride() {
  const Dp = TR.dep, t = Dp.t, X = Dp.X, o = {}; const rt = Dp.route; const nodeEnd = NODE[X.exitNode];
  const sayD = (i, text) => { if (Dp.said < i) { Dp.said = i; setStatus(text); } };
  Dp.fade = 1;
  if (t < 1.3) { o.pos = [NODE.p_seat.u, NODE.p_seat.v, NODE.p_seat.y]; o.face = uvDir([NODE.p_seat.u, NODE.p_seat.v], SEAT_FACE); o.key = t < 0.7 ? 'idle' : 'shoulder'; if (t >= 0.7) o.tgt = { armRz: 0.9 * Math.sin(Math.PI * clamp01((t - 0.7) / 0.6)), headX: -0.1 }; if (t >= 0.7) sayD(0, '旅人背好行囊，扶正帽子。'); }
  else if (t < 2.4) {
    const s = clamp01((t - 1.3) / 1.1) * Math.min(1.5, rt.len); const q = routeAt(rt, s); o.pos = [q.u, q.v, q.y]; o.face = q.h; o.key = 'walk'; o.moving = true; o.walkRate = 1.36 * 1.0; Dp.fade = 1 - win(t, 1.8, 2.3); sayD(1, '旅人往' + X.label + '的方向走，霧慢慢圍了上來。');
  } else {
    if (!Dp.plan) Dp.plan = departPlan(X, nodeEnd);
    const q = departAt(Dp.plan, Math.max(0, t - 2.5));
    o.pos = [q.u, q.v, q.y]; o.face = q.h; o.key = 'walk'; o.moving = !q.hop; o.walkRate = DEP_WALK; o.near = q.near; if (q.hop) { o.hop = true; o.air = q.air; }
    Dp.fade = t < 2.5 ? 0 : Math.min(1, (t - 2.5) / 0.35) * (1 - win(t, 4.2, 5.1)); if (t < 2.5) { o.pos = [nodeEnd.u, nodeEnd.v, nodeEnd.y]; o.moving = false; }
    if (t >= 2.5) sayD(2, X.leaveMsg);
    // a ring where he pushes off and where he lands (the submerged stones at high tide also get the ordinary wading ripples)
    if (t >= 2.5 && q.hop && Dp.lastSeg !== q.seg) { Dp.lastSeg = q.seg; if (WL > 0.13) addRipple(q.u, q.v, 0.45, 2.2); }
    if (t >= 2.5 && !q.hop && Dp.lastSeg === q.seg - 1 && Dp.lastLand !== q.seg) { Dp.lastLand = q.seg; if (WL > 0.13) { addRipple(q.u, q.v, 0.55, 2.4); } }
  }
  if (t >= DEPART_T) sayD(3, '旅人從' + X.label + '離開了。下一次專注會從新的地方開始。');
  // the evening haze the traveller walks into
  const V = S4P.veil; const vt = t; const vo = (vt > 1.4 && vt < 3.3 ? Math.sin(Math.PI * Math.min(1, (vt - 1.4) / 1.9)) : 0) * 0.8; V.visible = vo > 0.01; V.material.opacity = vo;
  const hp = vt < 2.4 ? routeAt(rt, Math.min(rt.len, 1.5)) : { u: X.offMap[0][0], v: X.offMap[0][1] }; const hy = (vt < 2.4 ? nodeEnd.y : 0.16) + 0.6; V.position.copy(W(hp.u, hp.v, hy));
  V.scale.setScalar(3.2); V.material.color.copy(cur.haze).lerp(WHITE, 0.5);
  return o;
}

// ---------- events ----------
const tideOk = (t) => !t || t === 'any' || (t === 'low' && tideShown <= 0.15) || (t === 'high' && tideShown >= 0.85);
const todOk = (list) => !list || list.indexOf(todKey()) >= 0;
function reqOk(r) {
  if (!r) return true;
  if (r === 'cupLeft') return marks.cupLeft;
  if (r === 'shardPresent') return !trip.shardGone;
  if (r === 'flowersOpen') return tideShown >= 0.85;
  return true;
}
function dryOk(ev) { if (!SIT_KEYS[ev.anim]) return true; const n = NODE[ev.spot]; return WL < n.y + (n.seat || 0) - 0.02; }   // nobody sits down in the water
function eligible(ev) {
  if (ev.rare || ev.weight <= 0) return false;
  if (ev.once && usedOnce.has(ev.id)) return false;
  if (ev.spot === TR.node || TR.recent.indexOf(ev.spot) >= 0) return false;
  return tideOk(ev.tide) && todOk(ev.time) && reqOk(ev.requires) && dryOk(ev);
}
function evDur(ev) { return Math.max(9, mrand(ev.dur[0], ev.dur[1]) / APP_TO_DEMO / rate()); }
function rareDur(ev) { return Math.max(9, (ev.demoSeconds || 16) / Math.sqrt(rate())); }
function durFor(ev) { return ev.rare ? rareDur(ev) : evDur(ev); }
function variantFor(ev) {
  if (ev.id === 'rare_gauge_plate' && tideShown > 0.5) return EVT.rare_boat_plate;
  if (ev.id === 'rare_boat_plate' && tideShown <= 0.5) return EVT.rare_gauge_plate;
  return ev;
}
function startAct(ev, dur) {
  endRare(); TR.state = 'act'; TR.act = ev; TR.t = 0; TR.dur = dur; TR.effectDone = false; TR.restSay = -1;
  if (ev.rare) startRare(ev); else setStatus('旅人' + ev.name + '。');
  if (ev.callEgret) { LIFE.callTo('A'); }
}
function eventFx(ev, prog) {
  if (ev.effect === 'steleWipe' && prog > 0.55 && !trip.steleWiped) { trip.steleWiped = true; trip.steleArm = 0; applyMarks(); }
  if (ev.effect === 'pebble' && !TR.effectDone && prog > 0.55) { TR.effectDone = true; const f = NODE[ev.spot].face; addRipple(f[0], f[1], 0.5, 2.4); splashAt(f[0], f[1], WL); }
}
function finishAct() {
  const ev = TR.act; if (!ev) { TR.state = 'idle'; return; }
  if (ev.once) usedOnce.add(ev.id);
  if (ev.rare) { if (rare && rare.ev === ev) rareFinish(); TR.state = 'idle'; TR.act = null; return; }
  if (ev.callEgret) LIFE.egret('auto');
  if (ev.effect === 'steleWipe' && !trip.steleWiped) { trip.steleWiped = true; trip.steleArm = 0; applyMarks(); }
  if (ev.worldMark === 'boatShells') marks.boatShells = Math.min(10, marks.boatShells + 1);
  if (ev.worldMark === 'pineCones') marks.pineCones = Math.min(6, marks.pineCones + 1);
  applyMarks();
  if (ev.outcome === 'note') { const text = (ev.noteAfterCore && !marks.ringStill) ? ev.noteAfterCore : ev.note; journal.push({ t: sim, text, kind: 'note', tags: ev.tagGain || [] }); renderJournal(); setStatus('記進旅途筆記：' + text, 4); }
  TR.state = 'idle'; TR.act = null;
}
function afterLamp(n) {
  if (n === trip.journeyLamp && trip.journey && !usedOnce.has(trip.journey)) { TR.pending.push(EVT[trip.journey]); usedOnce.add(trip.journey); }
  if (marks.ringStill && !usedOnce.has('rare_ring_mirror') && Math.random() < 0.05) { TR.pending.push(EVT.rare_ring_mirror); usedOnce.add('rare_ring_mirror'); }
}
function resetDemo() { trip.journeyLamp = 1 + Math.floor(Math.random() * 4); trip.journey = AREA.specialFinds.journey[Math.random() < 0.5 ? 0 : 1]; }

// ---------- journal ----------
const journalBtn = document.getElementById('journalBtn'), journalBox = document.getElementById('journal'), journalList = document.getElementById('journalList');
function renderJournal() {
  journalBtn.textContent = '旅途筆記 ' + journal.length; journalList.innerHTML = '';
  if (!journal.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = '還沒有記下任何東西。'; journalList.appendChild(li); return; }
  journal.forEach((j) => { const li = document.createElement('li'); const t = document.createElement('time'); t.textContent = fmt(j.t); li.appendChild(t); li.appendChild(document.createTextNode(j.text)); const KIND = { journey: '旅程信物', core: '地圖核心' }; if (KIND[j.kind]) { const k = document.createElement('span'); k.className = 'kind' + (j.kind === 'core' ? ' core' : ''); k.textContent = KIND[j.kind]; li.appendChild(k); } (j.tags || []).forEach((tg) => { const k = document.createElement('span'); k.className = 'tag'; k.textContent = tg; li.appendChild(k); }); journalList.appendChild(li); });
}
journalBtn.addEventListener('click', () => { const open = journalBox.hidden; journalBox.hidden = !open; journalBtn.setAttribute('aria-expanded', String(open)); });

// stage 5 (SPEC 12, Opus 2026-10-03): opening, first visit, second visit, after the lake mirror, keepsake events, clues
// Every sequence is a function of its progress p (0..1), so story(id, p) freezes a stable picture.
// =====================================================================
const STORY = {}; (AREA.storyEvents || []).forEach((e) => { STORY[e.id] = e; });
const CLUE = {}; (AREA.clues || []).forEach((c) => { CLUE[c.id] = c; });
const cluesGot = new Set();
const REFL_ONLY = 1;   // layer only the water-reflection camera renders (stage 1)
const reflOnly = (o) => { o.traverse((c) => { c.layers.set(REFL_ONLY); }); return o; };
const STY = { active: false, cam: null, dbl: null, pairs: null, layerSave: null, shadowLayer: false, statusAt: -1, rippled: false, touched: false };
const hit3 = (() => { const rc = new T.Raycaster(); let ms = null; return (from, dir) => { if (!ms) { ms = []; scene.traverse((o) => { if (o.isMesh && o.visible && o !== water && !(o.material && o.material.transparent)) { let own = false; for (let q = o; q; q = q.parent) if (q === trav) own = true; if (!own) ms.push(o); } }); } rc.set(from, dir.clone().normalize()); const h = rc.intersectObjects(ms, false)[0]; return h || null; }; })();
const DOWN = new T.Vector3(0, -1, 0);
const uvVec = (du, dv) => new T.Vector3((du - dv) * Math.SQRT1_2, 0, -(du + dv) * Math.SQRT1_2);   // a (du, dv) direction in world space
const decalMat = (tex, op) => { const m = new T.MeshStandardMaterial({ map: tex, transparent: true, opacity: op === undefined ? 1 : op, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); m.userData.noMerge = true; return m; };
const softTex = radTex('255,255,255', '255,255,255');

// ---- 12.2 the gauge: dried mud over the blank face, and the carving under it (the only words in the scene) ----
const GP = MARKS.gaugePatch;   // [u, v (front face), y]
const carveTex = canvasTex(64, 224, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.font = '600 30px "Noto Serif CJK TC","Noto Serif TC","Songti TC","PMingLiU",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const s = '從這裡開始。'; for (let i = 0; i < s.length; i++) { const y = 22 + i * 34; x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillText(s[i], w / 2 + 1, y + 1); x.fillStyle = 'rgba(58,56,52,0.92)'; x.fillText(s[i], w / 2, y); }
});
const mudTex = canvasTex(64, 192, (x, w, h) => {
  for (let i = 0; i < 60; i++) { const px = Math.random() * w, py = Math.random() * h, r = 8 + Math.random() * 22; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(118,98,72,0.55)'); g.addColorStop(1, 'rgba(118,98,72,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  x.globalCompositeOperation = 'destination-in'; const e = x.createLinearGradient(0, 0, w, 0); e.addColorStop(0, 'rgba(0,0,0,0.6)'); e.addColorStop(0.2, 'rgba(0,0,0,1)'); e.addColorStop(0.8, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0.6)'); x.fillStyle = e; x.fillRect(0, 0, w, h);
});
const S5 = {};
S5.carving = new T.Mesh(new T.PlaneGeometry(0.085, 0.3), decalMat(carveTex, 0)); S5.carving.position.copy(W(GP[0], GP[1] - 0.009, GP[2])); S5.carving.rotation.y = Math.PI / 4; addNM(fx2(S5.carving));
S5.mud = new T.Mesh(new T.PlaneGeometry(0.12, 0.36), decalMat(mudTex, 1)); S5.mud.position.copy(W(GP[0], GP[1] - 0.012, GP[2])); S5.mud.rotation.y = Math.PI / 4; addNM(fx2(S5.mud));

// ---- 12.6 permanent props: the sunken lantern, the boat's carved marks, the old tide line on the bridge's east abutment ----
S5.lantern = (() => {   // one merged mesh (one draw): glass box, two iron bands, the handle ring
  const mg = mergeSlots([[[new T.BoxGeometry(0.075, 0.11, 0.075), M4(0, 0, 0), 0x55705f], [new T.BoxGeometry(0.09, 0.014, 0.09), M4(0, 0.06, 0), 0x2f3330], [new T.BoxGeometry(0.09, 0.014, 0.09), M4(0, -0.06, 0), 0x2f3330], [new T.TorusGeometry(0.025, 0.005, 5, 10), M4(0, 0.085, 0), 0x2f3330]]]);
  const m = new T.Mesh(mg.geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, flatShading: true })); m.material.userData.noMerge = true;
  m.position.copy(W(4.68, -4.82, -0.02)); m.rotation.set(0.25, 0.6, 1.35); m.scale.setScalar(1.15); addNM(m); return m;
})();
const marksTex = canvasTex(96, 48, (x, w, h) => { x.strokeStyle = 'rgba(40,30,22,0.85)'; x.lineWidth = 3; x.lineCap = 'round'; const seg = [[10, 10, 10, 38], [20, 10, 20, 38], [30, 12, 44, 36], [44, 12, 30, 36], [56, 10, 56, 38], [56, 24, 70, 24], [80, 10, 86, 38]]; seg.forEach((s) => { x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); }); });
function decalOn(fromU, fromV, fromY, dirU, dirV, w, h, tex, op) {
  const hh = hit3(W(fromU, fromV, fromY), uvVec(dirU, dirV)); if (!hh) return null;
  const n = hh.face.normal.clone().transformDirection(hh.object.matrixWorld).normalize();
  const m = new T.Mesh(new T.PlaneGeometry(w, h), decalMat(tex, op)); m.position.copy(hh.point).addScaledVector(n, 0.025); m.lookAt(hh.point.clone().add(n)); addNM(fx2(m)); return m;   // picture-only (layer 2): too small to matter in the water reflection
}
S5.boatMarks = decalOn(-15.2, 0.25, 0.2, 0, 1, 0.13, 0.065, marksTex, 0.9);
const tideTex = canvasTex(128, 32, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(52,60,50,0)'); g.addColorStop(0.3, 'rgba(52,60,50,0.9)'); g.addColorStop(0.55, 'rgba(66,82,58,0.95)'); g.addColorStop(0.8, 'rgba(70,74,60,0.5)'); g.addColorStop(1, 'rgba(70,74,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(40,46,38,0.5)'; x.fillRect(Math.random() * w, h * 0.5 + Math.random() * h * 0.4, 2, 3 + Math.random() * 6); } });   // an old, mossy tide line with a few drips
S5.tideLine = decalOn(-5.62, 6.62, 0.5, 0, 1, 0.62, 0.085, tideTex, 1);

// ---- 12.6 the bench: two cup rings, only inside the light thrown by the silvered shard ----
const ringTex = canvasTex(64, 64, (x) => { x.strokeStyle = 'rgba(70,55,40,0.9)'; x.lineWidth = 5; x.beginPath(); x.arc(32, 32, 22, 0, 6.3); x.stroke(); x.strokeStyle = 'rgba(70,55,40,0.35)'; x.lineWidth = 9; x.beginPath(); x.arc(32, 32, 22, 0, 6.3); x.stroke(); });
S5.cupRings = [[1.22, 9.285, 1.0], [1.5, 9.27, 0.55]].map((r) => { const m = new T.Mesh(new T.PlaneGeometry(0.1, 0.1).rotateX(-Math.PI / 2), decalMat(ringTex, 0)); m.position.copy(W(r[0], r[1], SEAT_BENCH.top + 0.002)); m.userData.k = r[2]; m.visible = false; addNM(fx2(m)); return m; });
S5.spot = new T.Mesh(new T.CircleGeometry(0.075, 20).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: softTex, color: 0xfff3d8, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); addNM(fx2(S5.spot)); S5.spot.visible = false;

// ---- props that only exist during a sequence ----
const cupGeo = new T.CylinderGeometry(0.058, 0.044, 0.09, 14);
S5.myCup = new T.Mesh(cupGeo, stdM(0xe9e4d6, { roughness: 0.35 })); S5.myCup.visible = false; addNM(S5.myCup);
S5.cup2 = new T.Group(); { const c = new T.Mesh(cupGeo, stdM(0xd8ccb4, { roughness: 0.4 })); c.position.y = 0.045; S5.cup2.add(c); const tea = new T.Mesh(new T.CircleGeometry(0.05, 14).rotateX(-Math.PI / 2), stdM(0x7b4b27, { roughness: 0.2 })); tea.position.y = 0.086; S5.cup2.add(tea); }
S5.steam = [0, 1, 2, 3].map((i) => { const s = spr(softTex, 0xffffff, 0.08, 0.0, false); S5.cup2.add(s); return s; });
reflOnly(S5.cup2); S5.cup2.visible = false; addNM(S5.cup2);
S5.boots = new T.Group(); {
  const lea = stdM(0x5a3a24, { roughness: 0.85 }), sole = stdM(0x2c2119, { roughness: 0.9 });
  [-1, 1].forEach((sd) => { const b = new T.Group(); const shaft = new T.Mesh(new T.CylinderGeometry(0.03, 0.034, 0.09, 8), lea); shaft.position.y = 0.075; b.add(shaft); const foot = new T.Mesh(new T.BoxGeometry(0.046, 0.034, 0.1), lea); foot.position.set(0, 0.02, 0.025); b.add(foot); const so = new T.Mesh(new T.BoxGeometry(0.05, 0.008, 0.104), sole); so.position.set(0, 0.004, 0.025); b.add(so); b.position.x = sd * 0.04; if (sd > 0) { b.rotation.z = -0.28; b.position.y = -0.005; shaft.scale.y = 0.85; } b.rotation.y = sd * 0.2; S5.boots.add(b); });
  S5.boots.scale.setScalar(1.4); reflOnly(S5.boots); S5.boots.visible = false; addNM(S5.boots);
}
S5.crownLamp = new T.Group(); {
  const iron = stdM(0x2c2620, { roughness: 0.7 }); const glow = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.3, roughness: 1 }); glow.userData.glow = true; glow.userData.noMerge = true;
  const body = new T.Mesh(new T.BoxGeometry(0.085, 0.12, 0.085), glow); body.position.y = 0.075; S5.crownLamp.add(body);
  const cap = new T.Mesh(new T.ConeGeometry(0.07, 0.05, 4), iron); cap.position.y = 0.16; cap.rotation.y = Math.PI / 4; S5.crownLamp.add(cap);
  const base = new T.Mesh(new T.BoxGeometry(0.095, 0.015, 0.095), iron); base.position.y = 0.01; S5.crownLamp.add(base);
  const halo = spr(haloTex, 0xffffff, 0.55, 0.5); halo.position.y = 0.08; S5.crownLamp.add(halo);
  // on the camera-side parapet at the crown (on the deck the parapet hid it and its reflection)
  S5.crownLamp.scale.setScalar(1.3); S5.crownLamp.position.copy(W(-7.1, 7.0, 2.14)); reflOnly(S5.crownLamp); S5.crownLamp.visible = false; addNM(S5.crownLamp);
}
S5.lens = new T.Group(); { const g = new T.Mesh(new T.CylinderGeometry(0.036, 0.036, 0.006, 18), stdM(0xcfe3e8, { roughness: 0.15, transparent: true, opacity: 0.7 })); g.rotation.x = Math.PI / 2; S5.lens.add(g); const rim = new T.Mesh(new T.TorusGeometry(0.037, 0.005, 5, 18), stdM(0x8a6a3a, { roughness: 0.5, metalness: 0.5 })); S5.lens.add(rim); S5.lens.visible = false; addNM(S5.lens); }
S5.tag = new T.Mesh(new T.BoxGeometry(0.05, 0.075, 0.003), stdM(0xcdb98e)); S5.tag.visible = false; addNM(S5.tag);
S5.wick = new T.Mesh(new T.TorusGeometry(0.018, 0.005, 5, 12), stdM(0xd8c9a2)); S5.wick.visible = false; addNM(S5.wick);
S5.plate = S4P.plate.clone(true); S5.plate.visible = false; addNM(S5.plate);
S5.shard = S4P.shardItem.clone(true); S5.shard.visible = false; addNM(S5.shard);
S5.glint = spr(softTex, 0xfff4dc, 0.35, 0.0); addNM(fx2(S5.glint)); S5.glint.visible = false;
S5.vignette = (() => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:none;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 22%, rgba(8,12,20,0.55) 70%)'; host.appendChild(d); return d; })();
function applyStoryMarks() { const c = !!marks.gaugeCarving; S5.mud.material.opacity = c ? 0 : 1; S5.mud.visible = !c; S5.carving.material.opacity = c ? 1 : 0; S5.carving.visible = c; }
applyStoryMarks();

// ---- geometry used by the sequences ----
const nd5 = (id) => [NODE[id].u, NODE[id].v, NODE[id].y];
const OPEN_A = [GU + 0.05, GV - 0.42];
const S5_DIR = (() => { const a = NODE.c_steps, f = a.face; const du = f[0] - a.u, dv = f[1] - a.v, l = Math.hypot(du, dv); return [du / l, dv / l]; })();
const S5_RIGHT = [S5_DIR[1], -S5_DIR[0]];   // his right when he faces down the steps (the rig's armL side)
const S5_SEAT = [NODE.c_steps.u + 0.13 * S5_DIR[0], NODE.c_steps.v + 0.13 * S5_DIR[1]];
const CUP1 = [S5_SEAT[0] + 0.32 * S5_RIGHT[0] + 0.05 * S5_DIR[0], S5_SEAT[1] + 0.32 * S5_RIGHT[1] + 0.05 * S5_DIR[1]];   // clear of his robe as seen from the camera
const CUP2 = [CUP1[0] + 0.24 * S5_RIGHT[0], CUP1[1] + 0.24 * S5_RIGHT[1]];
const TOUCH5 = [CUP2[0] + 0.16 * S5_DIR[0], CUP2[1] + 0.16 * S5_DIR[1]];
const BOOT_STONE = (() => { const a = 1 / 14 * Math.PI * 2 + 0.2;   // the stone farthest from the camera: its reflection falls inside the still ring
 const u = RING.c[0] + Math.cos(a) * RING.ringR, v = RING.c[1] + Math.sin(a) * RING.ringR; const h = hit3(W(u, v, 3), DOWN); return [u, v, h ? h.point.y : 0.5]; })();
// the boots stand at the inner foot of the far stone, right at the water line, so their reflection lies in the open, still water of the ring
// (on the stone top the stone itself hid the reflection from this camera)
const BOOT_AT = (() => { const a = 1 / 14 * Math.PI * 2 + 0.2; return [RING.c[0] + Math.cos(a) * 0.66, RING.c[1] + Math.sin(a) * 0.66]; })();
S5.boots.rotation.y = Math.PI / 4 + 0.3;
const PLATE_AT = [-5.1, 6.7];   // beside the tide line, not in front of it (the camera must see both)
const TAG_AT = [-14.7, 0.2];   // south-east of the boat's marks, so the camera sees him and the marks
const HOME_TURN = [NODE.c_home.u - 1.2, NODE.c_home.v - 1.6];

// ---- the reflection's own traveller (first visit) ----
function makeDouble() {
  if (STY.dbl) return; const d = trav.clone(true); d.traverse((o) => { if (o.isLight) { o.visible = false; o.intensity = 0; } });
  const pairs = []; const walk = (a, b) => { pairs.push([a, b]); a.children.forEach((c, i) => { if (b.children[i]) walk(c, b.children[i]); }); }; walk(trav, d);
  reflOnly(d); scene.add(d); STY.dbl = d; STY.pairs = pairs;
  STY.layerSave = []; trav.traverse((o) => { STY.layerSave.push([o, o.layers.mask]); o.layers.set(2); });
  STY.shadowLayer = (sun.shadow.camera.layers.mask & 4) === 0; sun.shadow.camera.layers.enable(2);
}
function dropDouble() {
  if (!STY.dbl) return; scene.remove(STY.dbl); STY.dbl = null; STY.pairs = null;
  (STY.layerSave || []).forEach(([o, m]) => { o.layers.mask = m; }); STY.layerSave = null; if (STY.shadowLayer) sun.shadow.camera.layers.disable(2);
}
function syncDouble(heading) { STY.pairs.forEach(([a, b], i) => { if (i === 0) return; b.position.copy(a.position); b.quaternion.copy(a.quaternion); b.scale.copy(a.scale); b.visible = a.visible; }); STY.dbl.position.copy(trav.position); STY.dbl.scale.copy(trav.scale); STY.dbl.rotation.set(0, heading, 0); STY.dbl.visible = trav.visible; }

// ---- camera push (CONCEPT 7.1): about 2.5 s in, hold, about 3 s back out ----
function pushK(ev, t, dur) { const c = ev.push; if (!c) return 0; return Math.min(eio(clamp01(t / 2.5)), 1 - eio(clamp01((t - c.outAt * dur) / 3))); }
function applyPush(ev, k) {
  if (!ev.push) return;
  if (MOTION < 1) { S5.vignette.style.opacity = String(k); return; }
  if (!STY.cam) STY.cam = { base: target.clone(), zoom: camera.zoom };
  const c = ev.push; target.copy(STY.cam.base).lerp(W(c.at[0], c.at[1], c.at[2]), k); camera.zoom = STY.cam.zoom + (Math.max(c.zoom, STY.cam.zoom) - STY.cam.zoom) * k; camera.updateProjectionMatrix(); yawOff = 0; pitchOff = 0; placeCamera();   // c.zoom is relative to the default full view
}
function releaseCam() { if (STY.cam) { target.copy(STY.cam.base); camera.zoom = STY.cam.zoom; camera.updateProjectionMatrix(); placeCamera(); STY.cam = null; } S5.vignette.style.opacity = '0'; }

// ---- clues ----
function grantClue(id) {
  const c = CLUE[id]; if (!c) return; const first = !cluesGot.has(id); cluesGot.add(id);
  if (first) { journal.push({ t: sim, text: c.text, kind: 'clue', tags: [] }); renderJournal(); }
  setStatus((first ? '記進旅途筆記：' : '（已經記過）') + c.text);
}

// ---- start / stop ----
let storyIdx = 0, carryIdx = 0;
const STORY_LIST = ['story_open_gauge', 'story_first_lag', 'story_second_cup', 'story_core_ring'];
const CARRY_LIST = ['carry_old_wick', 'carry_weathered_lens', 'carry_old_luggage_tag', 'carry_tide_plate', 'carry_silvered_shard'];
function playStory(id, opts) {
  opts = opts || {}; const ev = STORY[id]; if (!ev) return;
  if (inspection && !opts.arrived) {
    endRare(); storyCleanup(); TR.pending = []; TR.free = false; TR.dep = null; TR.forcePose = null; TR.act = null;
    if (ev.tide === 'low' && tideShown > 0.15) setTideLevel(0);
    if (ev.tide === 'high' && tideShown < 0.9) setTideLevel(1);
    if (ev.setTime) setTimeMode(ev.setTime, false);
    if (TR.state === 'gone' || travFade < 0.99) { applyFade(1); setAt('entry0'); TR.state = 'idle'; }
    // (Opus 2026-10-03) he always walks to the spot along the road network first, then the sequence (and its camera push) begins: no teleport
    if (opts.p === undefined && TR.node !== ev.spot) { if (TR.state === 'walk' && TR.route) setAt(TR.node); TR.state = 'idle'; TR.hold = false; playing = true; updatePlayLabel(); walkTo(ev.spot, { type: 'story', id, walkMsg: '旅人往' + (NODE[ev.spot].label || ev.spot) + '走去。' }); update(0); return; }
  }
  TR.route = null;
  if (id === 'story_open_gauge') { marks.gaugeCarving = false; applyStoryMarks(); }
  if (id === 'story_core_ring') setRingStill(false);
  setAt(ev.spot); TR.heading = ev.face ? uvDir([NODE[ev.spot].u, NODE[ev.spot].v], ev.face) : nodeFace(ev.spot); heading = TR.heading;
  TR.state = 'story'; TR.story = { ev, t: 0, dur: ev.demoSeconds }; STY.active = true; STY.statusAt = -1; STY.rippled = false; STY.touched = false;
  if (id === 'story_first_lag') makeDouble();
  if (opts.p !== undefined) { TR.story.t = opts.p * TR.story.dur; TR.hold = true; } else { TR.hold = false; playing = true; updatePlayLabel(); }
  if (inspection) update(0);
}
function finishStory() {
  const ev = TR.story && TR.story.ev; if (!ev) return;
  if (ev.id === 'story_open_gauge') { marks.gaugeCarving = true; applyStoryMarks(); }
  storyCleanup(); TR.state = 'idle'; TR.story = null;
  if (ev.clue) grantClue(ev.clue);
}
function storyCleanup() {
  if (!STY.active) return; STY.active = false; dropDouble(); releaseCam(); lakeHush = 0; storyRingK = -1;
  [S5.myCup, S5.cup2, S5.boots, S5.crownLamp, S5.lens, S5.tag, S5.wick, S5.plate, S5.shard, S5.glint, S5.spot].forEach((o) => { o.visible = false; });
  S5.cupRings.forEach((r) => { r.material.opacity = 0; r.visible = false; }); applyStoryMarks();
}
let storyRingK = -1;

// ---- what he does (pose, facing, position) ----
function heldAt(obj, off, euler) { obj.visible = true; trav.updateMatrixWorld(true); obj.position.copy(armL.localToWorld((off || V3(0, -0.3, 0.05)).clone())); obj.quaternion.copy(armL.getWorldQuaternion(new T.Quaternion())).multiply(new T.Quaternion().setFromEuler(euler || new T.Euler(0, 0, 0))); }
function storyOverride() {
  const S = TR.story, ev = S.ev, p = clamp01(S.t / S.dur), o = {};
  const home = nd5(ev.spot);
  switch (ev.id) {
    case 'story_open_gauge': {
      const ay = groundH(OPEN_A[0], OPEN_A[1]); const toFace = uvDir(OPEN_A, [GP[0], GP[1]]);
      if (p < 0.15) { const k = eio(p / 0.15); o.pos = [home[0] + (OPEN_A[0] - home[0]) * k, home[1] + (OPEN_A[1] - home[1]) * k, home[2] + (ay - home[2]) * k]; o.face = uvDir([home[0], home[1]], OPEN_A); o.key = 'walk'; o.moving = true; o.walkRate = 0.9; }
      else if (p < 0.85) {
        o.pos = [OPEN_A[0], OPEN_A[1], ay]; o.face = toFace;
        if (p < 0.25) { o.key = 'gaze'; o.tgt = { headX: -0.55 * win(p, 0.15, 0.22) }; }
        else if (p < 0.5) { o.key = 'reach'; o.pos[2] = ay + 0.04 * Math.sin(Math.PI * win(p, 0.25, 0.5)); o.tgt = { armL: -2.55, armLz: 0.2 * Math.sin(S.t * 9), headX: -0.5, lean: -0.04 }; }
        else if (p < 0.62) { o.key = 'idle'; o.tgt = { headX: -0.45 }; }
        else { const look = p > 0.7 && p < 0.76 ? -0.45 : 0.45; o.key = 'idle'; o.tgt = { book: 1, armL: -0.9, headX: look, lean: 0.05 }; }
      } else { const k = eio(win(p, 0.88, 1)); o.pos = [OPEN_A[0] + (home[0] - OPEN_A[0]) * k, OPEN_A[1] + (home[1] - OPEN_A[1]) * k, ay + (home[2] - ay) * k]; o.face = k > 0.05 ? uvDir(OPEN_A, [home[0], home[1]]) : toFace; o.key = k > 0.02 && k < 0.98 ? 'walk' : 'idle'; o.moving = k > 0.02 && k < 0.98; o.walkRate = 0.9; }
      break;
    }
    case 'story_first_lag': {
      const hP = uvDir([home[0], home[1]], PAV.c), hT = uvDir([home[0], home[1]], HOME_TURN);
      o.face = p < 0.25 ? hP : hT;
      if (p < 0.25) { o.key = 'gaze'; o.tgt = { headX: -0.15 }; }
      else if (p < 0.33) { o.key = 'idle'; o.moving = true; o.walkRate = 0.6; }
      else if (p < 0.62) { o.key = 'gazeDown'; o.tgt = { headX: 0.55 * win(p, 0.33, 0.38), lean: 0.06 }; }
      else if (p < 0.7) { o.key = 'gaze'; o.tgt = { headY: 1.15 * Math.sin(Math.PI * win(p, 0.62, 0.7)), headX: -0.1 }; }
      else o.key = 'idle';
      break;
    }
    case 'story_second_cup': {
      const toLake = uvHeading(S5_DIR[0], S5_DIR[1]);
      o.face = toLake;
      if (p < 0.06) { const k = eio(p / 0.06); o.pos = [home[0] + (S5_SEAT[0] - home[0]) * k, home[1] + (S5_SEAT[1] - home[1]) * k, home[2]]; o.key = 'walk'; o.moving = true; o.walkRate = 0.8; }
      else {
        o.pos = [S5_SEAT[0], S5_SEAT[1], home[2]];
        const POUR = { armL: 0.3, armLz: -0.8, lean: 0.06, headX: 0.35 };
        if (p < 0.15) o.key = 'sitEdge';
        else if (p < 0.22) { o.key = 'sitEdge'; o.cup = 'hand'; o.tgt = { armL: -0.95, lean: 0.12, headX: 0.3 }; }
        else if (p < 0.3) { o.key = 'sitEdge'; o.cup = p < 0.27 ? 'hand' : 'none'; o.tgt = POUR; }
        else if (p < 0.55) { o.key = 'sitEdge'; o.tgt = { headX: -0.2 }; }
        else if (p < 0.7) { const k = win(p, 0.55, 0.64); o.key = 'sitEdge'; o.tgt = { headX: 0.6 * Math.min(1, k * 2), lean: 0.45 * k, armL: -0.9 * k, armLz: -0.45 * k }; }
        else if (p < 0.78) { o.key = 'sitEdge'; o.tgt = { headX: 0.55, lean: 0.2 }; }
        else if (p < 0.82) { o.key = 'sitEdge'; o.tgt = POUR; }
        else if (p < 0.94) { o.key = 'drinkSit'; o.cup = 'hand'; }
        else { o.key = 'sitGaze'; }
      }
      break;
    }
    case 'story_core_ring': {
      const waterDir = uvDir(TOUCH_AT, TOUCH_WATER); const gy = groundH(TOUCH_AT[0], TOUCH_AT[1]);
      o.pos = [TOUCH_AT[0], TOUCH_AT[1], gy]; o.face = waterDir;
      if (p < 0.2) { o.key = 'crouch'; o.tgt = { hip: -0.2, legX: -0.95, lean: 0.6, headX: 0.4, armL: -1.35 * Math.max(0.15, win(p, 0, 0.08)) }; }
      else if (p < 0.65) { o.key = 'crouch'; o.face = uvDir(TOUCH_AT, RC); o.tgt = { hip: -0.2, legX: -0.95, lean: 0.35, headX: p > 0.46 && p < 0.56 ? 0.0 : 0.3, armL: -0.3 }; if (p > 0.46 && p < 0.56) o.face = uvDir(TOUCH_AT, BOOT_STONE); }
      else { o.key = p < 0.72 ? 'crouch' : 'idle'; o.face = uvDir(TOUCH_AT, p > 0.46 && p < 0.56 ? BOOT_STONE : RC); }
      break;
    }
    case 'carry_old_wick': {
      o.face = uvHeading(S5_DIR[0], S5_DIR[1]); o.pos = [S5_SEAT[0], S5_SEAT[1], home[2]];
      if (p < 0.12) o.key = 'idle';
      else if (p < 0.35) { o.key = 'hold'; o.tgt = { armL: -1.35, headX: 0.35 }; }
      else if (p < 0.75) { o.key = 'crouch'; o.tgt = { hip: -0.18, legX: -0.9, lean: 0.5, headX: 0.55, armL: -1.2 }; }
      else o.key = p < 0.88 ? 'hold' : 'shoulder';
      break;
    }
    case 'carry_weathered_lens': {
      o.face = uvDir([home[0], home[1]], [NODE.moon_crown.u, NODE.moon_crown.v - 0.6]);
      if (p < 0.15) o.key = 'gaze';
      else if (p < 0.8) { o.key = 'reach'; o.tgt = { armL: -2.25, armLz: 0.35, headX: 0.05 }; }
      else o.key = p < 0.9 ? 'hold' : 'shoulder';
      break;
    }
    case 'carry_old_luggage_tag': {
      const ty = groundH(TAG_AT[0], TAG_AT[1]); const toMarks = uvDir(TAG_AT, [-15.2, 0.56]);
      if (p < 0.12) { const k = eio(p / 0.12); o.pos = [home[0] + (TAG_AT[0] - home[0]) * k, home[1] + (TAG_AT[1] - home[1]) * k, home[2] + (ty - home[2]) * k]; o.face = uvDir([home[0], home[1]], TAG_AT); o.key = 'walk'; o.moving = true; o.walkRate = 0.9; }
      else if (p < 0.86) { o.pos = [TAG_AT[0], TAG_AT[1], ty]; o.face = toMarks; o.key = 'crouch'; o.tgt = { hip: -0.2, legX: -0.95, lean: 0.35, headX: p > 0.45 && p < 0.55 ? 0.1 : 0.45, armL: -1.25 }; }
      else { const k = eio(win(p, 0.86, 1)); o.pos = [TAG_AT[0] + (home[0] - TAG_AT[0]) * k, TAG_AT[1] + (home[1] - TAG_AT[1]) * k, ty + (home[2] - ty) * k]; o.face = uvDir(TAG_AT, [home[0], home[1]]); o.key = k > 0.02 && k < 0.98 ? 'walk' : 'idle'; o.moving = k > 0.02 && k < 0.98; o.walkRate = 0.9; }
      break;
    }
    case 'carry_tide_plate': {
      const py = groundH(PLATE_AT[0], PLATE_AT[1]); const toLine = uvDir(PLATE_AT, [-5.7, 6.94]);
      if (p < 0.15) { const k = eio(p / 0.15); o.pos = [home[0] + (PLATE_AT[0] - home[0]) * k, home[1] + (PLATE_AT[1] - home[1]) * k, home[2] + (py - home[2]) * k]; o.face = uvDir([home[0], home[1]], PLATE_AT); o.key = 'walk'; o.moving = true; o.walkRate = 0.9; }
      else if (p < 0.85) { o.pos = [PLATE_AT[0], PLATE_AT[1], py]; o.face = uvDir(PLATE_AT, [-5.52, 6.93]); const c = p > 0.22 && p < 0.8; o.key = c ? 'crouch' : 'hold'; o.tgt = c ? { hip: -0.2, legX: -0.95, lean: 0.4, headX: 0.35, armL: -1.35 } : { armL: -1.25, headX: 0.1 }; }
      else { const k = eio(win(p, 0.85, 1)); o.pos = [PLATE_AT[0] + (home[0] - PLATE_AT[0]) * k, PLATE_AT[1] + (home[1] - PLATE_AT[1]) * k, py + (home[2] - py) * k]; o.face = uvDir(PLATE_AT, [home[0], home[1]]); o.key = k > 0.02 && k < 0.98 ? 'walk' : 'idle'; o.moving = k > 0.02 && k < 0.98; o.walkRate = 0.9; }
      break;
    }
    case 'carry_silvered_shard': {
      o.face = uvDir([home[0], home[1]], [1.38, 9.28]);
      if (p < 0.12) o.key = 'idle';
      else if (p < 0.88) { o.key = 'hold'; o.tgt = { armL: -1.15, headX: 0.5, lean: 0.12 }; }
      else o.key = 'shoulder';
      break;
    }
    default: o.key = 'idle';
  }
  return o;
}

// ---- props, reflection, camera, lake, as a function of progress ----
function storyUpdate(dt) {
  if (STY.active && TR.state !== 'story') { storyCleanup(); return; }
  if (!STY.active || !TR.story) return;
  const S = TR.story, ev = S.ev, p = clamp01(S.t / S.dur), t = S.t;
  // status text from the data
  const st = ev.status || []; let si = -1; for (let i = 0; i < st.length; i++) if (p >= st[i][0]) si = i; if (si !== STY.statusAt && si >= 0) { STY.statusAt = si; setStatus(st[si][1]); }
  applyPush(ev, pushK(ev, t, S.dur));
  const hush = (a, b) => Math.min(win(p, a, a + 0.05), 1 - win(p, b - 0.05, b));
  trav.updateMatrixWorld(true);
  switch (ev.id) {
    case 'story_open_gauge': {
      S5.mud.visible = true; S5.mud.material.opacity = 1 - win(p, 0.28, 0.48); S5.carving.visible = true; S5.carving.material.opacity = win(p, 0.33, 0.52);
      break;
    }
    case 'story_first_lag': {
      lakeHush = hush(0.02, 0.97);
      const hP = uvDir([NODE.c_home.u, NODE.c_home.v], PAV.c); let hR;
      if (p < 0.48) hR = hP; else if (p < 0.55) hR = lerpAngle(hP, TR.heading, eio(win(p, 0.48, 0.55))); else hR = TR.heading;
      if (STY.dbl) syncDouble(hR);
      break;
    }
    case 'story_second_cup': {
      lakeHush = hush(0.02, 0.97);
      S5.myCup.visible = p >= 0.27 && p < 0.82; S5.myCup.position.copy(W(CUP1[0], CUP1[1], NODE.c_steps.y + 0.045));
      const a2 = win(p, 0.32, 0.4) * (1 - win(p, 0.7, 0.78)); S5.cup2.visible = a2 > 0.01; S5.cup2.position.copy(W(CUP2[0], CUP2[1], NODE.c_steps.y));
      S5.cup2.traverse((c) => { if (c.material && !c.isSprite) { c.material.transparent = a2 < 0.99; c.material.opacity = a2; } });
      S5.steam.forEach((s, i) => { const ph = (tAcc * 0.35 + i / 4) % 1; s.position.set(0.012 * Math.sin(tAcc * 1.3 + i * 2), 0.1 + ph * 0.16, 0.01 * Math.cos(tAcc + i)); s.scale.setScalar(0.1 + ph * 0.16); s.material.opacity = 0.85 * Math.sin(Math.PI * ph) * a2; });
      if (p >= 0.7 && !STY.touched) { STY.touched = true; addRipple(TOUCH5[0], TOUCH5[1], 0.55, 2.6); addRipple(TOUCH5[0], TOUCH5[1], 0.3, 1.6); }
      if (p < 0.7) STY.touched = false;
      break;
    }
    case 'story_core_ring': {
      if (p >= 0.12 && !STY.touched) { STY.touched = true; addRipple(TOUCH_WATER[0], TOUCH_WATER[1], 0.4, 1.8); }
      storyRingK = Math.min(win(p, 0.18, 0.24), 1 - win(p, 0.62, 0.68)); lakeHush = 0.6 * storyRingK;
      S5.boots.visible = win(p, 0.24, 0.3) * (1 - win(p, 0.6, 0.64)) > 0.5; S5.boots.position.copy(W(BOOT_AT[0], BOOT_AT[1], WL + 0.012));
      break;
    }
    case 'carry_old_wick': {
      if (p > 0.12 && p < 0.88) heldAt(S5.wick, V3(0, -0.3, 0.05)); else S5.wick.visible = false;
      const g = Math.sin(Math.PI * win(p, 0.35, 0.72)); S5.glint.visible = g > 0.01; S5.glint.position.copy(S5.lantern.position).add(V3(0, 0.06, 0)); S5.glint.material.opacity = 0.55 * g * (0.75 + 0.25 * Math.sin(tAcc * 5)); S5.glint.scale.setScalar(0.32);
      break;
    }
    case 'carry_weathered_lens': {
      if (p > 0.12 && p < 0.9) heldAt(S5.lens, V3(0, -0.3, 0.06), new T.Euler(Math.PI / 2, 0, 0)); else S5.lens.visible = false;
      const a = win(p, 0.3, 0.4) * (1 - win(p, 0.72, 0.8)); S5.crownLamp.visible = a > 0.02; S5.crownLamp.scale.setScalar(1.3 * (0.6 + 0.4 * a));
      break;
    }
    case 'carry_old_luggage_tag': {
      if (p > 0.12 && p < 0.86) heldAt(S5.tag, V3(0, -0.31, 0.04), new T.Euler(0.4, 0, 0)); else S5.tag.visible = false;
      const g = Math.sin(Math.PI * win(p, 0.35, 0.7)); S5.glint.visible = g > 0.01 && !!S5.boatMarks; if (S5.boatMarks) S5.glint.position.copy(S5.boatMarks.position); S5.glint.material.opacity = 0.35 * g; S5.glint.scale.setScalar(0.3);
      break;
    }
    case 'carry_tide_plate': {
      if (p > 0.25 && p < 0.78) { S5.plate.visible = true; S5.plate.position.copy(W(-5.42, 6.915, 0.5)); S5.plate.rotation.set(0, Math.PI / 4, 0); S5.plate.scale.setScalar(1.15); }   // held flat against the abutment, beside the old tide line
      else if (p > 0.15 && p < 0.85) heldAt(S5.plate, V3(0, -0.3, 0.08), new T.Euler(0.1, 0, 0)); else S5.plate.visible = false;
      break;
    }
    case 'carry_silvered_shard': {
      if (p > 0.1 && p < 0.9) heldAt(S5.shard, V3(0, -0.3, 0.05), new T.Euler(0.6, Math.PI, 0)); else S5.shard.visible = false;
      const on = Math.min(win(p, 0.22, 0.28), 1 - win(p, 0.78, 0.84)); const k = eio(win(p, 0.25, 0.75));
      const su = 1.72 + (1.08 - 1.72) * k, sv = 9.28 + 0.012 * Math.sin(tAcc * 2.1); S5.spot.visible = on > 0.01; S5.spot.material.opacity = 0.75 * on * (0.85 + 0.15 * Math.sin(tAcc * 7)); S5.spot.position.copy(W(su, sv, SEAT_BENCH.top + 0.004));
      S5.cupRings.forEach((r) => { const ru = (r.position.x - r.position.z) * Math.SQRT1_2; const d = Math.abs(ru - su); r.material.opacity = on * r.userData.k * (1 - smooth01(clamp01((d - 0.03) / 0.07))); r.visible = r.material.opacity > 0.01; });
      break;
    }
    default: break;
  }
}
const smooth01 = (x) => x * x * (3 - 2 * x);
// prototype only: a camera that follows the traveller up close, so small sequences can be watched without the push
let followCam = false;
function followUpdate(dt) {
  if (!followCam || STY.cam) return; const want = (camera.right - camera.left) / 9; const k = 1 - Math.exp(-dt * 2.5);
  const tp = trav.position.clone(); tp.y += 0.45; target.lerp(tp, dt > 0 ? k : 1); camera.zoom += (want - camera.zoom) * (dt > 0 ? k : 1); camera.updateProjectionMatrix(); yawOff = 0; pitchOff = 0; placeCamera();
}
function storyRingOverride() { if (storyRingK >= 0) WU.uRingR.value = -0.25 + (RING.ringR + 0.25) * storyRingK; }

// ---------- per-frame hooks ----------
function s4Override() {   // called from travUpdate: what the current sequence wants the traveller to do (or null)
  if (TR.state === 'story' && TR.story) return storyOverride();
  if (TR.state === 'depart' && TR.dep) return departOverride();
  if (TR.state === 'rest' && TR.act) { const o = restOverride(); cupMode = o.cup || 'auto'; cupFlip = o.flip || 0; return o; }
  if (TR.state === 'act' && TR.act && TR.act.rare && rare && rare.ev === TR.act) { const p = clamp01(TR.t / TR.dur); rare.p = p; return rareOverride(p); }
  cupMode = 'auto'; return null;
}
let cupFlip = 0;
function s4Update(dt) {   // called at the end of update(): props that follow the traveller, fades, lake hush, ring
  storyUpdate(dt);
  if(headHist.at(-1)?.[0]!==sim)headHist.push([sim, head.rotation.y]);
  while (headHist.length > 2 && sim - headHist[0][0] > 1.2) headHist.shift();
  { const want = sim - 0.5; let h = headHist[0][1]; for (let i = 0; i < headHist.length; i++) { if (headHist[i][0] <= want) h = headHist[i][1]; else break; } headDelayed = h; }
  if (TR.state === 'act' && TR.act && TR.act.rare && rare && rare.ev === TR.act) { trav.updateMatrixWorld(true); rareUpdate(rare.p); }
  else if (TR.state !== 'act' && rare) endRare();
  if (TR.state === 'act' && TR.act) eventFx(TR.act, clamp01(TR.t / TR.dur));
  steleTick();
  // fade (departure only)
  if (TR.state === 'depart' && TR.dep) applyFade(TR.dep.fade); else if (travFade !== 1 || !trav.visible) applyFade(1);
  if (TR.state !== 'depart') S4P.veil.visible = false;
  cupUpdate(TR.state === 'rest' || TR.state === 'depart' ? cupMode : 'auto', cupFlip);
  // lake hush and the ring (SPEC 11.8.4)
  WU.uRipple.value *= (1 - lakeHush);
  const rk = marks.ringStill ? (rare && rare.core ? ringK : 1) : (rare && rare.core ? ringK : 0);
  WU.uRingR.value = -0.25 + (RING.ringR + 0.25) * rk;
  storyRingOverride();
  applyMarks();
  if (!STY.active) applyStoryMarks();
}
function s4Reset() {
  storyCleanup(); TR.story=null; endRare(); usedOnce.clear(); journal.length = 0; renderJournal(); TR.pending = []; TR.dep = null; trip.steleWiped = false; trip.steleArm = 0; trip.shardGone = false; resetDemo(); cupMode = 'auto'; applyFade(1); S4P.veil.visible = false; LIFE.egret('auto'); applyMarks();
}
function resetMarks() { marks.cupLeft = false; setRingStill(true); marks.boatShells = 0; marks.pineCones = 0; marks.gaugeCarving = false; applyMarks(); setStatus('世界記憶已清空：杯子、貝殼、松果回到最初，石環裡的水又靜止了。'); }

// ---------- buttons ----------
const RARE_LIST = ['rare_gauge_plate', 'rare_boat_plate', 'rare_mirror_shard', 'rare_ring_mirror'];
let rareIdx = 0; const rareBtn = document.getElementById('rareBtn');
const labelRare = () => { rareBtn.textContent = '試看特殊發現：' + EVT[RARE_LIST[rareIdx]].item.name + (rareIdx === 1 ? '（滿潮版）' : rareIdx === 3 ? '（核心）' : ''); }; labelRare();
function playRare(id, opts) {
  opts = opts || {}; const ev = EVT[id]; endRare(); TR.pending = []; TR.free = false;
  if (ev.tier === 'core') { setRingStill(true); }
  if (ev.source === 'gauge' && tideShown > 0.15) setTideLevel(0);
  if (ev.source === 'boat' && tideShown < 0.85) setTideLevel(1);
  trip.shardGone = false; if (PAVFX.shard) PAVFX.shard.visible = true;
  setAt(ev.spot); TR.heading = nodeFace(ev.spot); heading = TR.heading; TR.forcePose = null;
  startAct(ev, opts.dur || rareDur(ev)); TR.hold = false;
  if (opts.p !== undefined) { TR.t = opts.p * TR.dur; TR.hold = true; }
  else { playing = true; updatePlayLabel(); }
  update(0);
}
rareBtn.addEventListener('click', () => { const id = RARE_LIST[rareIdx]; rareIdx = (rareIdx + 1) % RARE_LIST.length; labelRare(); playRare(id); });
function playEvent(id, opts) {
  opts = opts || {}; const ev = EVT[id]; endRare(); TR.pending = []; TR.free = false; setAt(ev.spot); TR.heading = nodeFace(ev.spot); heading = TR.heading; TR.forcePose = null;
  startAct(ev, opts.dur || Math.max(10, 12 / Math.sqrt(rate()))); TR.hold = false;
  if (opts.p !== undefined) { TR.t = opts.p * TR.dur; TR.hold = true; } else { playing = true; updatePlayLabel(); }
  update(0);
}
document.getElementById('eventBtn').addEventListener('click', () => {
  const pool = EVENTS.filter((e) => (!e.once || !usedOnce.has(e.id)) && tideOk(e.tide) && todOk(e.time) && reqOk(e.requires) && dryOk(e) && e.spot !== TR.node);
  const list = pool.length ? pool : EVENTS.filter((e) => e.spot !== TR.node); const ev = list[Math.floor(Math.random() * list.length)];
  playEvent(ev.id);
});
document.getElementById('departA').addEventListener('click', () => previewDepart('a_arch'));
document.getElementById('departB').addEventListener('click', () => previewDepart('b_far'));
document.getElementById('marksBtn').addEventListener('click', resetMarks);
const ringBtn = document.getElementById('ringBtn');
function setRingStill(v) { marks.ringStill = !!v; ringBtn.textContent = marks.ringStill ? '石環：靜止' : '石環：起漣漪'; applyMarks(); }
ringBtn.addEventListener('click', () => { setRingStill(!marks.ringStill); setStatus(marks.ringStill ? '石環裡的水又靜止了（還沒取得湖鏡）。' : '石環裡的水和外面一樣會被風吹出漣漪（取得湖鏡之後）。'); });
setRingStill(true); renderJournal(); resetDemo(); applyMarks();

const clock = new T.Clock();
let lastFrameAt = performance.now();

resize(); resetAll(); placeCamera();

// ---------- test hooks ----------
const setTideLevel = (level) => { if (level === null || level === undefined) { tideMan = null; tideTrans = null; tideBtn.textContent = '試看漲潮'; } else { tideMan = { level: Math.max(0, Math.min(1, level)) }; tideTrans = null; tideBtn.textContent = '回到依時間'; } update(0); };
const api = {
  setTime(mode) { setTimeMode(mode, false); update(0); },
  setTide: setTideLevel,
  setSim(s) { sim = s; update(0); lampsUpdate(0, true); },
  advance(realSeconds, step) { step = step || 0.05; const n = Math.round(realSeconds / step); forceMotion = true; for (let i = 0; i < n; i++) update(step); forceMotion = false; },
  focus(u, v, y, vw, el) {
    if (u === undefined) { target.copy(DEFAULT_TARGET); resize(); pitchOff = 0; yawOff = 0; placeCamera(); return; }
    target.copy(W(u, v, y)); const aspect = canvas.clientWidth / canvas.clientHeight;
    Object.assign(camera, { left: -vw / 2, right: vw / 2, top: vw / aspect / 2, bottom: -vw / aspect / 2 }); camera.updateProjectionMatrix();
    pitchOff = el ? (el - 31) * Math.PI / 180 : 0; yawOff = 0; placeCamera(); update(0);
  },
  drag(yaw, pitch) { if (yaw === undefined) { holdCam = false; return; } holdCam = true; yawOff = Math.max(-1.1, Math.min(1.1, yaw)); pitchOff = Math.max(-0.3, Math.min(0.5, pitch || 0)); placeCamera(); update(0); },
  render() { renderFrame(); renderFrame(); },
  travAt(u, v, y) { trav.position.copy(W(u, v, y === undefined ? 0.125 : y)); },
  state: () => ({ sim, time: timeMode, tide: { level: +tideShown.toFixed(3), phase: tidePhase, wet: +wetShown.toFixed(3) }, WL: +WL.toFixed(3), draws: lastStats.calls, tris: lastStats.triangles, merged: mergedGroups, seed: TIDE_SEED, reflSize: [rt.width, rt.height] }),
  events: (sd, upTo) => tideEvents(sd === undefined ? TIDE_SEED : sd, upTo === undefined ? 6000 : upTo).map((e) => [Math.round(e.s), Math.round(e.e)]),
  tideAt: (s, sd) => tideAt(sd === undefined ? TIDE_SEED : sd, s),
  life: LIFE, egret: (st) => { LIFE.egret(st); update(0); }, egretPos: () => LIFE.egretPos(), fish: (u, v) => { LIFE.fish(u, v, WL); update(0); }, shard: (on) => { LIFE.shard(on); update(0); },
  marks: () => ({ lamp4: MARKS.lamp4, lamp5: MARKS.lamp5, gaugePatch: MARKS.gaugePatch, puddles: MARKS.puddles }), groundH,
  internals: () => ({ T, scene, W, toUV, trav, STONES, FE, groundH, feH, REEDS, REED_CUT, POOLS, BIGPIER, DROPPED, RING, ARCH, PAV, ROCK, CW, F_REED, LIFE, LAMPS, NODE, EDGES, TR, AREA, water }),
  // ----- stage 3 test entries (SPEC 8.8) -----
  graph(show) { if (show !== undefined) setGraphOverlay(show); return { nodes: IDS.map((id) => { const n = NODE[id]; return { id, u: n.u, v: n.v, y: n.y, kind: n.kind, label: n.label }; }), edges: EDGES.map((E) => ({ a: E.a, b: E.b, kind: E.kind, length: +E.L.toFixed(3) })) }; },
  route(a, b) { const r = buildRoute(a, b); return r ? { ids: r.ids, length: +r.len.toFixed(3) } : null; },
  goto(id) { setAt(id); TR.state = 'idle'; TR.forcePose = null; TR.hold = false; TR.heading = nodeFace(id); heading = TR.heading; update(0); },
  walk(a, b) { setAt(a); TR.forcePose = null; TR.hold = false; walkTo(b, { type: 'test' }); TR.free = true; },
  place(a, b, d, phase) {   // stand at distance d along the route a -> b, frozen (for pictures)
    setAt(a); const r = buildRoute(a, b); TR.route = r; TR.state = 'walk'; TR.purpose = { type: 'test' }; TR.leg = 0; let rest = d; while (TR.leg < r.legs.length - 1 && rest > r.legs[TR.leg].e.L) { rest -= r.legs[TR.leg].e.L; TR.node = r.legs[TR.leg].to; TR.leg++; }
    TR.s = rest; TR.hold = true; TR.forcePose = null; if (phase !== undefined) TR.phase = phase; update(0); const lg = r.legs[TR.leg]; TR.heading = lerpAngle(TR.heading, TR.heading, 1); return { leg: TR.leg, u: TR.u, v: TR.v, y: TR.sy };
  },
  pose(key, prog) { TR.forcePose = key || null; if (!key) TR.faceOv = null; TR.forceProg = prog || 0; update(0); },
  hold(on) { TR.hold = on !== false; },
  play(on) { playing = on !== false; updatePlayLabel(); },
  speed(n) { speed = n; document.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.speed) === n))); },
  tr: () => ({ state: TR.state, node: TR.node, lit: TR.lit, act: TR.act && TR.act.id, amb: TR.amb && TR.amb.a.id, wading: TR.wading, moving: TR.moving, slope: +TR.slope.toFixed(2), u: +TR.u.toFixed(2), v: +TR.v.toFixed(2), y: +TR.sy.toFixed(3), route: TR.route ? TR.route.ids.join('>') : null, cuffDone: TR.cuffDone, pending: TR.cuffPending, status: statusMsg }),
  qa() {
    const rows = AREA.edges.map((E) => ({ edge: E.a + '>' + E.b, kind: E.kind, length: E.length, minSurfaceY: E.minSurfaceY, maxSlope: E.maxSlope, maxStoneGap: E.maxStoneGap, maxDrop: E.maxDrop, minBody: E.minBodyClearance, minBrim: E.minBrimClearance, note: E.clearanceNote }));
    const bad = rows.filter((r) => (r.minBody < 0 || r.minBrim < 0) && !r.note);   // edges with a clearanceNote are the measured bench exceptions
    return { ok: bad.length === 0, edges: rows, nodes: AREA.nodes.map((n) => ({ id: n.id, body: n.clearance.body, brim: n.clearance.brim, spin: n.clearance.spin, reed: n.clearance.reed })), failing: bad.map((r) => r.edge), note: 'baked at design time by qa/check.js; re-run it to measure the current geometry live' };
  },
  face(a) { TR.faceOv = a === undefined ? VIEW_FACE : a; TR.heading = TR.faceOv; update(0); },
  light(k, prog) { setAt(lampNode(k)); TR.lit = k; TR.forcePose = null; startLight(k); TR.t = (prog === undefined ? 0.5 : prog) * TR.dur; TR.hold = true; sim = dueOf(k) + 1; lampsUpdate(0, true); update(0); },
  reset() { resetAll(); update(0); },
  follow(vw, el, dy) { this.focus(TR.u, TR.v, TR.sy + (dy === undefined ? 0.5 : dy), vw, el); },
  setWet(w) { if (tideMan) tideMan.wet = w; update(0); },
  lamps: () => LAMPS.map((L, i) => { let bottom = null; if (L.obj) { L.obj.updateWorldMatrix(true, true); bottom = new T.Box3().setFromObject(L.obj).min.y; } else bottom = L.base[2]; lampFlameWorld(L, lampTmp); const fu = toUVY(lampTmp); return { index: i + 1, flameWorld: [+lampTmp.x.toFixed(3), +lampTmp.y.toFixed(3), +lampTmp.z.toFixed(3)], flameU: fu.map((x) => +x.toFixed(3)), bodyBottom: +bottom.toFixed(3), level: +L.level.toFixed(2) }; }),
  moonWindow(on) { BFX.force = (on === undefined || on === null) ? null : !!on; if (BFX.force !== null) { BFX.k = BFX.force ? 1 : 0; BFX.rip = -1; } update(0); },
  bridgeFx: () => ({ k: +BFX.k.toFixed(3), rip: BFX.rip, phase: +BFX.phase.toFixed(3), amp: +BFX.amp.toFixed(3), force: BFX.force, wl: +WL.toFixed(3), star: +cur.star.toFixed(2), maxA: (()=>{let m=0;const c=BR.ring.col;for(let i=3;i<c.length;i+=4)m=Math.max(m,c[i]);return +m.toFixed(3)})() }),
  tidalAreas: () => ({ arcs: TIDAL.arcs, leaves: TIDAL.pond.PADS.map(l=>({y:+(Math.max(WL,POND_FLOOR+.03)+.004).toFixed(3)})), bloom: sstep(.07,.29,WL), moonNight: sstep(.65,.97,cur.star) }),
  W, camera, scene, renderer, water
};
Object.assign(api, {
  // stage 4 test entries: p given -> frozen at that progress (for pictures), otherwise it plays
  rare(id, p) { playRare(id, p === undefined ? {} : { p }); },
  event(id, p) { playEvent(id, p === undefined ? {} : { p }); },
  rest(id, p) { const act = REST_LIST.find((a) => a.id === id) || REST_LIST[0]; endRare(); TR.pending = []; setAt('p_seat'); TR.heading = nodeFace('p_seat'); heading = TR.heading; TR.forcePose = null; TR.lit = 5; startRest(act, 20); if (p !== undefined) { TR.t = p * TR.dur; TR.hold = true; } else { TR.hold = false; playing = true; updatePlayLabel(); } update(0); },
  depart(which, t) { previewDepart(which === 'a' || which === 'a_arch' ? 'a_arch' : 'b_far'); if (t !== undefined) { TR.dep.t = t; TR.hold = true; } update(0); },
  ringStill(v) { setRingStill(v); update(0); },
  worldMarks(o) { if (o) { Object.assign(marks, o); applyMarks(); update(0); } return Object.assign({}, marks, { steleWiped: trip.steleWiped, shardGone: trip.shardGone }); },
  journal: () => journal.map((j) => j.text),
  s4: () => ({ state: TR.state, act: TR.act && TR.act.id, rareP: rare ? +rare.p.toFixed(3) : null, usedOnce: [...usedOnce], journeyLamp: trip.journeyLamp, journey: trip.journey, pending: TR.pending.map((e) => e.id), cupMode, fade: +travFade.toFixed(3), events: EVENTS.length, restList: REST_LIST.map((a) => a.id) }),
  story(id,p){playStory(id,p===undefined?{}:{p});},storiesAll:()=>Object.keys(STORY),s5:()=>({active:STY.active,zoom:camera.zoom,double:!!STY.dbl,vignette:Number(S5.vignette.style.opacity)}),clues:()=>[...cluesGot],
  eventsAll: () => EVENTS.map((e) => e.id), restAll: () => REST_LIST.map((a) => a.id)
});

let inspection = false, actionKey = null, departureStarted = false, departureDone = false, departureMs = opts.departureElapsedMs || 0;
let lastReal = performance.now(), raf = 0, view = {kind:'overview'}, chrome = {cards:[]}, routes = [], items = [], readyFrames = 0;
let programsReady = !!opts.manualFrames;
if(!programsReady)void (async()=>{
  applyAction(performance.now());update(0);
  renderer.clippingPlanes=[clipPlane];
  await renderer.compileAsync(scene,reflCam,()=>dead);
  if(dead)return;
  renderer.clippingPlanes=[];
  await renderer.compileAsync(scene,camera,()=>dead);
  if(dead)return;
  await glass.prepare(()=>dead);
  if(!dead)programsReady=true;
})().catch(error=>{renderer.clippingPlanes=[];console.error('倒影湖畔材質載入失敗',error);programsReady=true;});
function applyAction(now) {
  const shown=opts.departure&&!departureDone?(opts.departureState||lake):lake;
  if (shown) { TIDE_SEED=shown.seed; Object.assign(marks,shown.worldMarks); trip.steleWiped=shown.steleWiped; }
  sim = opts.departure&&!departureDone&&shown?shown.effectiveSeconds:savedProgress + (!paused && !lobby ? Math.min(1.25,Math.max(0,(now-lastProgressAt)/1000)) : 0);
  playing = false; forceMotion = !paused; speed = BASE_SPEED * 0.35 / DEMO_WALK;
  if (opts.departure && !departureDone) {
    if(!departureStarted) { previewDepart(opts.departure.exit); departureStarted=true; }
    TR.dep.t = Math.min(5.1,departureMs/1000); TR.state='depart';
    if(departureMs>=5000) {departureDone=true;opts.reportDepartureComplete?.();}
    return;
  }
  const a = lake?.action;
  if(lobby) { if(actionKey!=='lobby'){storyCleanup();TR.story=null;endRare();setAt(sim>=3000?'p_seat':a?.route?.[0]||AREA.ports.spawn);TR.state='idle';TR.forcePose=sim>=3000?'sitGaze':'gaze';actionKey='lobby';} return; }
  if(!a)return;
  if(actionKey!==a.id) {
    storyCleanup();TR.story=null;endRare();TR.forcePose=null;TR.route=null;TR.act=null;TR.hs=null;TR.amb=null;TR.cuffPending=false;TR.cuffDone=true;
    setAt(a.route[0]||a.node);TR.heading=nodeFace(TR.node);TR.t=0;
    if(a.kind==='walk') {TR.route=buildRoute(a.route[0],a.node);TR.state='walk';TR.leg=0;TR.s=0;}
    else if(a.kind==='lamp'){setAt(a.node);startLight(a.lamp-1);}
    else if(a.kind==='rest'){setAt(a.node);startRest(REST_LIST.find(r=>r.id===a.eventId),a.endSeconds-a.startSeconds);}
    else if(a.kind==='story'){playStory(a.eventId,{arrived:true});playing=false;TR.story.dur=a.endSeconds-a.startSeconds;}
    else if(a.kind==='event'){setAt(a.node);startAct(EVT[a.eventId],a.endSeconds-a.startSeconds);}
    else {setAt(a.node);TR.state='idle';TR.forcePose=a.kind==='cuff'?'rollCuff':'gaze';}
    TR.dur=a.endSeconds-a.startSeconds;actionKey=a.id;
  }
  const p=clamp01((sim-a.startSeconds)/(a.endSeconds-a.startSeconds));TR.t=p*TR.dur;if(TR.story)TR.story.t=TR.t;TR.forceProg=p;TR.cuffT=p*2;
  if(a.kind==='walk'&&TR.route) {TR.s=p*TR.route.len;}
  TR.lit=Math.min(5,Math.floor(sim/600));
}
function anchor(node) { const n=NODE[node];if(!n)return null;const p=W(n.u,n.v,n.y+0.7).project(camera);return {x:(p.x+1)/2*canvas.clientWidth,y:(1-p.y)/2*canvas.clientHeight}; }
function lobbyCamera(dt) {
  if(!lobby)return;
  const node=view.kind==='look'?view.exit:(sim>=3000?'p_seat':TR.node),n=NODE[node]||NODE.p_seat;
  const aspect=canvas.clientWidth/canvas.clientHeight, available=Math.max(.35,1-(chrome.right||0)/canvas.clientWidth);
  const vw=view.kind==='overview'?baseVw:12/available, vh=vw/aspect;
  const q=1-Math.exp(-dt*4),want=W(n.u,n.v,n.y+.7);
  // Keep the resting traveller left of the frosted panel.
  const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);want.addScaledVector(right,vw*(1-available)/2);
  target.lerp(want,q);camera.left+=(-vw/2-camera.left)*q;camera.right+=(vw/2-camera.right)*q;camera.top+=(vh/2-camera.top)*q;camera.bottom+=(-vh/2-camera.bottom)*q;camera.updateProjectionMatrix();
}
let reportedActivity = '';
function draw(now=performance.now()) {
  if(!programsReady){lastReal=now;return;}
  if(dead)return; const realElapsed=Math.max(0,(now-lastReal)/1000), elapsed=Math.min(.05,realElapsed);lastReal=now;
  if(!paused&&!lobby)departureMs+=realElapsed*1000;
  if(!inspection)applyAction(now);lobbyCamera(elapsed);update(paused?0:elapsed);if(readyFrames<2||shouldRender())renderFrame();
  const anchors={rest:anchor('p_seat'),entry:anchor(AREA.ports.entry),a_arch:anchor('a_arch'),b_far:anchor('b_far')};items.forEach((it,i)=>{const p=anchor('p_seat');anchors['item:'+it.key]={x:p.x+(i-1)*34,y:p.y+70};});opts.reportAnchors?.(anchors);
  if(++readyFrames===2)opts.reportReady?.();
  opts.reportLights?.(lampsDue());opts.reportCinematic?.(!!(rare?.core || STY.active));
  const a=lake?.action,activity=opts.departure&&!departureDone?'旅人沿踏石離開湖畔。':a?.kind==='walk'?'旅人沿著湖畔踏石前行。':a?.kind==='lamp'?'旅人點亮路燈。':a?.kind==='cuff'?'旅人捲起褲管。':STORY[a?.eventId]?.name||EVT[a?.eventId]?.name||REST_LIST.find(r=>r.id===a?.eventId)?.name||'旅人在湖畔等候。';
  if(activity!==reportedActivity){reportedActivity=activity;opts.reportActivity?.(activity);}
}
function loop(now){if(frameDue(now,lastReal))draw(now);if(!dead)raf=requestAnimationFrame(loop);}
const observer=new ResizeObserver(()=>{resize();});observer.observe(host);
const watchdog=setInterval(()=>{if(!dead&&performance.now()-lastReal>250)draw();},33);
if(!opts.manualFrames)raf=requestAnimationFrame(loop);else draw();
return {
 areaId:'area-03-reflection-lake',
 setLakeState(state){lake=state;TIDE_SEED=state.seed;},
 setProgress(seconds){savedProgress=seconds;lastProgressAt=performance.now();},
 setPaused(value){paused=!!value;lastProgressAt=performance.now();glass.jumpPaused(paused);},
 setReducedMotion(value){releaseCam();MOTION=value ? 0.25 : 1;},setUiFade(value){glass.setUiFade(value);},
 setChrome(value){chrome=value;glass.setChrome(value);},
 setWorldState(value){if(value.coreTaken!==undefined)marks.ringStill=!value.coreTaken;},
 setRoutes(value,hover){routes=value;if(hover){const r=routes.find(r=>r.key===hover);if(r?.exit)view={kind:'look',exit:r.exit};}},
 setLobbyView(value){view=value;},setLobbyItems(value){items=value;},playSpecialFind(){},
 enterLobby(nextHost,nextOpts){observer.disconnect();host=nextHost;host.appendChild(canvas);observer.observe(host);opts={...opts,...nextOpts,departure:null};lobby=true;paused=false;actionKey=null;view={kind:'close'};resize();},
 renderNow(){draw();},debugState(){return {...api.state(),traveller:{...api.tr(),stepIndex:Math.floor(TR.phase/Math.PI),air:TR.air},worldMarks:{...marks},action:lake?.action,paused,lobby,departureDone,chrome};},
 destroy(){if(dead)return;storyCleanup();S5.vignette.remove();dead=true;cancelAnimationFrame(raf);clearInterval(watchdog);observer.disconnect();glass.dispose();rt.dispose();mrt.dispose();const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.shadow?.map)resources.add(o.shadow.map);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){resources.add(m);for(const v of Object.values(m)){if(v?.isTexture)resources.add(v);}for(const u of Object.values(m.uniforms||{})){if(u.value?.isTexture)resources.add(u.value);}}});resources.forEach(r=>r.dispose());renderer.dispose();canvas.remove();GOV.c.remove();opts.reportCinematic?.(false);},
 // Isolated QA only: no production control calls these prototype inspection entries.
 qa:api, setInspection(value){inspection=value;}
};
}
