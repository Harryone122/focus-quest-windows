import { advanceAnimation } from '../animationSteps';
import { createQuarryAudio } from './quarryAudio';
import { advanceBellPendulum } from './bellPendulum';
import { createTravelLoading } from '../loading/travelLoadingDrawing';
import * as ThreeLib from '../cloudRuins/vendor/three.module.js';
// Area 05 v10 geometry, materials, routes and animation port. No prototype panel or global test API.
export async function createEchoQuarryScene(host, opts) {
const THREE=ThreeLib;
const audio=createQuarryAudio();
function sound(kind,payload){audio.cue(kind,payload);}
let audioStep=-1;
const window={}, realDocument=globalThis.document, nodes=new Map(), listeners=[];
let dead=false, raf=0, lastFrameAt=performance.now(), pendingEvent=null, storyDone=null, stoneOwned=false;
const document={createElement:realDocument.createElement.bind(realDocument),body:host,getElementById(id){if(!nodes.has(id)){const el=realDocument.createElement('div');el.id=id;nodes.set(id,el);}return nodes.get(id);}};
const addEventListener=(type,fn)=>{globalThis.addEventListener(type,fn);listeners.push([type,fn]);};
function backend(action,payload={}){return opts.authority?.(action,payload);}
window.__seededRand=()=>backend('random');


let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let innerWidth=host.clientWidth, innerHeight=host.clientHeight; const VW=innerWidth, VH=innerHeight, aspect=VW/VH;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setSize(VW, VH); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const C = (h) => new THREE.Color(h);

/* ---------- textures ---------- */
function canvasTex(sz, draw, srgb = true) { const c = document.createElement('canvas'); c.width = c.height = sz; draw(c.getContext('2d'), sz); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.encoding = THREE.sRGBEncoding; return t; }
const rockTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 64) { g.fillStyle = 'rgba(90,70,50,.10)'; g.fillRect(0, y, s, 3); }            // bench bands
  g.strokeStyle = 'rgba(90,70,50,.10)'; g.lineWidth = 1.5;
  for (let i = -s; i < 2 * s; i += 9) { g.beginPath(); g.moveTo(i, s); g.lineTo(i + s * 0.6, 0); g.stroke(); } // chisel
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(80,70,60,${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * s, rnd() * s, 10 + rnd() * 50, 2 + rnd() * 4); }
});
const softTex = canvasTex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
const shaftTex = canvasTex(128, (g, s) => { const l = g.createLinearGradient(0, 0, 0, s); l.addColorStop(0, 'rgba(255,255,255,.9)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(0, 0, s, s); const h = g.createLinearGradient(0, 0, s, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.25, 'rgba(0,0,0,0)'); h.addColorStop(.75, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, s, s); });
const fallTex = canvasTex(128, (g, s) => { for (let q = 0; q < 42; q++) rnd(); let ls = 7; const lr = () => (ls = (ls * 16807) % 2147483647) / 2147483647; g.clearRect(0, 0, s, s); for (let i = 0; i < 26; i++) { const x = lr() * s, w = 1 + lr() * 3; let y = lr() * s; for (let k = 0; k < 3; k++) { const L = s * (0.18 + lr() * 0.4); g.fillStyle = `rgba(255,255,255,${0.35 + lr() * 0.55})`; g.fillRect(x, y, w, L); y += L + s * (0.06 + lr() * 0.2); if (y > s) break; } } }); fallTex.repeat.set(1, 4);

const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, metalness: 0, flatShading: true }, o));
const woodMat = M('#7c5a3a'), woodDark = M('#4f3a26'), ironMat = M('#45464b', { metalness: .3, roughness: .7 }), ropeMat = M('#b8a47c');
const amberMat = new THREE.MeshBasicMaterial({ color: '#ffd58a' });

const out = new THREE.Group(); scene.add(out);
const grotto = new THREE.Group(); grotto.position.set(400, 0, 0); scene.add(grotto);
function add(g, geo, mat, x, y, z, o = {}) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; g.add(m); return m; }
const box = (g, w, h, d, mat, x, y, z, o) => add(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
const cyl = (g, rt, rb, h, s, mat, x, y, z, o) => add(g, new THREE.CylinderGeometry(rt, rb, h, s), mat, x, y, z, o);
function rope(g, a, b, sag, r, mat) { // catenary-ish segments
  const N = 14; let prev = null;
  for (let i = 0; i <= N; i++) { const t = i / N; const p = new THREE.Vector3().lerpVectors(a, b, t); p.y -= sag * 4 * t * (1 - t);
    if (prev) { const mid = prev.clone().add(p).multiplyScalar(.5), len = prev.distanceTo(p); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 4), mat); m.position.copy(mid); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize()); g.add(m); }
    prev = p; }
}

/* ---------- traveller (same proportions as other maps: ~0.95 tall body) ---------- */
function traveller(lit) {
  const g = new THREE.Group();
  const cloak = M('#6f8f8a'), skin = M('#e9cfae'), hat = M('#b9ab88');
  cyl(g, 0.16, 0.42, 1.0, 7, cloak, 0, 0.5, 0);
  const head = add(g, new THREE.IcosahedronGeometry(0.2, 0), skin, 0, 1.15, 0);
  cyl(g, 0.5, 0.5, 0.05, 10, hat, 0, 1.3, 0); cyl(g, 0.0, 0.3, 0.38, 8, hat, 0, 1.52, 0);
  box(g, 0.34, 0.26, 0.22, M('#8c6b49'), 0, 0.68, -0.25);
  cyl(g, 0.025, 0.025, 1.7, 5, woodDark, 0.42, 0.85, 0.12);
  box(g, 0.16, 0.2, 0.16, lit ? amberMat : M('#6b5a3d'), 0.42, 1.55, 0.12, { cast: false });
  box(g, 0.22, 0.04, 0.22, ironMat, 0.42, 1.68, 0.12, { cast: false });
  if (lit) { const l = new THREE.PointLight(0xffc474, 2.2, 7, 1.5); l.position.set(0.42, 1.55, 0.12); g.add(l);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc474, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set(0.42, 1.55, 0.12); g.add(glow); }
  g.scale.setScalar(0.55); return g;
}

/* =================== OUTDOOR v5: a natural sinkhole the quarry opened onto the fog sea =================== */
const FOG = C('#b3a3ad'), DEEP = C('#e0ad80');
function hsh(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hsh(i, j), b = hsh(i + 1, j), c = hsh(i, j + 1), d = hsh(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm3(x, z) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < 3; k++) { s += a * vn(x * f, z * f); f *= 2.03; a *= 0.5; } return s / 0.875; }
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < 4; k++) { s += a * vn(x * f, z * f); f *= 2.03; a *= 0.5; } return s / 0.9375; }
const HC = [12, 12];
function rimR(th) { return 11.5 + 4.0 * (fbm(Math.cos(th) * 1.4 + 5, Math.sin(th) * 1.4 + 5) - 0.5); }
const CUTZ = (x, z) => x > 9.5 && x < 19 && z > -9.2 && z < -3.2;
const SPIRE = [5.2, 10.6];
const CHIME1 = [0.9, -1.5, Math.PI / 4 - 0.25], HORN1 = [14.6, 0.2, Math.atan2(7.6 - 14.6, 9.6 - 0.2)], LAMP1 = [-2.6, -0.2]; // v10: moved out from behind the bell tower
const STAGE = { x0: 4.6, x1: 11.6, z0: 7.0, z1: 13.5, y: 0.6, bz: 10.25 }; // the bell pavilion's stage over the abyss
const FALL_TH = 3.06;
const RIVER = [[-19, 9.4], [-14.5, 10.3], [-10.0, 11.5], [-5.7, 12.6], [-2.0, 13.1], [12 + Math.cos(FALL_TH) * rimR(FALL_TH), 12 + Math.sin(FALL_TH) * rimR(FALL_TH)]]; // river and curtain share the same lip
function riverWidth(along) { return 0.5+along*0.13; }
function riverDist(x, z) { let best = 1e9, bt = 0; for (let i = 0; i < RIVER.length - 1; i++) { const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1]; const vx = bx - ax, vz = bz - az; let t = ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz); t = Math.max(0, Math.min(1, t)); const d = Math.hypot(x - ax - vx * t, z - az - vz * t); if (d < best) { best = d; bt = i + t; } } return [best, bt]; }
function H(x, z) {
  const dx = x - HC[0], dz = z - HC[1], r = Math.hypot(dx, dz), th = Math.atan2(dz, dx), e = r - rimR(th);
  let h;
  if (e > 0) {
    const n = fbm3(x * 0.13, z * 0.13);
    h = Math.min(e, 5) * 0.1 + Math.max(0, e - 5) * 0.5 + (n - 0.5) * 1.8 * Math.min(1, e / 3);
    h += Math.max(0, fbm(x * 0.22 + 3, z * 0.22 + 7) - 0.5) * 9 * Math.min(1, Math.max(0, (e - 4) / 5));
    h = Math.min(h, 14);
  } else {
    const t = -e, ledge = fbm(th * 2.2 + 11, 3.3) > 0.56;
    if (t < 0.7) h = -t * 5;
    else if (ledge && t < 2.6) h = -3.5 - (t - 0.7) * 0.45;
    else h = -3.5 - (ledge ? 0.9 : 0) - (t - (ledge ? 2.6 : 0.7)) * 9;
    h += (fbm(x * 0.7, z * 0.7) - 0.5) * 0.9 * Math.min(1, t);
    h = Math.max(h, -22);
  }
  const sd = Math.hypot(x - SPIRE[0], z - SPIRE[1]); const sr = 1.7 + (fbm(x * 1.3, z * 1.3) - 0.5) * 0.7;
  // (no stone spire: the bell stage stands on timber legs that go down into the abyss)
  { const [rd, rt] = riverDist(x, z); const w = 0.8 + rt * 0.25; if (rd < w + 0.6 && e > -0.2) h -= 0.45 * Math.max(0, Math.min(1, (w + 0.6 - rd) / 0.6)); }
  if (CUTZ(x, z) && h > 1.6) h = 1.6;                       // the old quarry cut: a flat floor with sheer sawn walls
  return h;
}
const topAt = (x, z) => H(x, z);
// Keep the rendered riverbed below the centreline water sheet, including the lip.
// A grid-cell margin prevents interpolated bank triangles from piercing the water.
function riverbedHeight(x, z) {
  const height = H(x, z), [distance, along] = riverDist(x, z);
  const width = riverWidth(along), margin = 0.5;
  if (distance >= width + margin) return height;
  const k = Math.min(RIVER.length - 2, Math.floor(along)), t = along - k;
  const a = RIVER[k], b = RIVER[k + 1];
  const bed = H(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) - 0.25;
  const blend = Math.max(0, Math.min(1, (width + margin - distance) / 0.25));
  return height - Math.max(0, height - bed) * blend;
}
function buildOutdoor() {
  // ---- terrain mesh (flat-shaded, coloured by slope / height) ----
  const X0 = -24, X1 = 50, Z0 = -24, Z1 = 50, S = 0.5;
  const nx = Math.round((X1 - X0) / S), nz = Math.round((Z1 - Z0) / S);
  const hg = []; for (let i = 0; i <= nx; i++) { hg[i] = []; for (let j = 0; j <= nz; j++) hg[i][j] = riverbedHeight(X0 + i * S, Z0 + j * S); }
  window.__T = { hg, X0, Z0, S, nx, nz }; const P = [], CO = [];
  const ROCK = C('#a6a29e'), ROCK2 = C('#938f8f'), STAIN = C('#a8968a'), CUTC = C('#d3cec6');
  const GR = [C('#93a061'), C('#86955a'), C('#a3a96a'), C('#c4b47c')], LEDGE = C('#6e8656'), GRAVEL = C('#c8c2b8');
  const haze = (c, y) => { const t = Math.max(0, Math.min(0.75, (-y - 1.5) / 9)); return c.clone().lerp(FOG, t).lerp(DEEP, Math.max(0, Math.min(0.7, (-y - 6) / 7))); };
  const band = y => 1 + 0.07 * Math.sin(y * 2.1) + 0.05 * Math.sin(y * 5.3 + 1.1);
  const tri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let ny = uz * vx - ux * vz; const nxx = uy * vz - uz * vy, nzz = ux * vy - uy * vx; const L = Math.hypot(nxx, ny, nzz); ny = Math.abs(ny / L);
    const cy = (a[1] + b[1] + c[1]) / 3, cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3; let col;
    const ss = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    if (CUTZ(cx - 0.6, cz) || CUTZ(cx + 0.6, cz) || CUTZ(cx, cz - 0.6) || CUTZ(cx, cz + 0.6) ? (cy > 1.62 && ny < 0.62) : false) col = CUTC.clone(); // every steep face along the cut edge takes the sawn-stone colour (no alternating teeth)
    else if (ny < 0.62) { // rock faces: one stone colour drifting slowly between two greys, broad moss bands near the top
      col = ROCK.clone().lerp(ROCK2, ss(0.3, 0.7, fbm((cx + cz) * 0.07, cy * 0.1))); if (cy > -6) col.lerp(C('#5e8560'), 0.55 * ss(0.6, 0.72, fbm((cx - cz) * 0.12 + 3, cy * 0.16 + 5))); }
    else if ((CUTZ(cx - 0.6, cz) || CUTZ(cx + 0.6, cz) || CUTZ(cx, cz - 0.6) || CUTZ(cx, cz + 0.6)) && cy < 1.9) col = GRAVEL.clone();
    else if (cy < -2.5) col = LEDGE.clone();
    else { // grass: two greens blended over large soft fields, bare stone showing through only in a few broad patches
      col = GR[1].clone().lerp(GR[2], ss(0.32, 0.68, fbm(cx * 0.06 + 9, cz * 0.06))).lerp(GR[3], 0.5 * ss(0.6, 0.8, fbm(cx * 0.11 + 4, cz * 0.11 + 1)));
      col.lerp(C('#b8703f'), 0.42 * ss(0.6, 0.74, fbm(cx * 0.16 + 13, cz * 0.16 + 21))); // fallen leaves gathering in drifts
      if (cy > -0.3) col.lerp(ROCK, 0.75 * ss(0.66, 0.76, fbm(cx * 0.12 + 31, cz * 0.12 + 7))); }
    col = haze(col, cy).convertSRGBToLinear();
    for (const p of [a, b, c]) { P.push(p[0], p[1], p[2]); CO.push(col.r, col.g, col.b); } };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x0 = X0 + i * S, z0 = Z0 + j * S, x1 = x0 + S, z1 = z0 + S;
    const p00 = [x0, hg[i][j], z0], p10 = [x1, hg[i + 1][j], z0], p01 = [x0, hg[i][j + 1], z1], p11 = [x1, hg[i + 1][j + 1], z1];
    if ((i + j) & 1) { tri(p00, p01, p11); tri(p00, p11, p10); } else { tri(p00, p01, p10); tri(p10, p01, p11); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(CO, 3)); geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
  terrain.castShadow = terrain.receiveShadow = true; out.add(terrain);
  { // outer land: a coarse ring out to the horizon (any peek angle stays on land); far ridges rise into the haze
    P.length = 0; CO.length = 0; const S2 = 2, OX0 = -104, OX1 = 130, OZ0 = -104, OZ1 = 130, n2x = (OX1 - OX0) / S2, n2z = (OZ1 - OZ0) / S2;
    const Ho = (x, z) => { const d = Math.hypot(x - HC[0], z - HC[1]); let m = Math.max(0, Math.min(1, (d - 42) / 58)); m = m * m * (3 - 2 * m);
      // ridges only in the wedge that is behind the map for every peek angle (camera yaw 45°±63°); elsewhere the land stays under the lowest sight line
      let da = Math.atan2(x - 5, z - 5) - (Math.PI / 4 + Math.PI); da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))); let far = 1 - Math.max(0, Math.min(1, (da - 0.25) / 0.35)); far = far * far * (3 - 2 * far);
      const base = H(x, z) * (1 - 0.6 * m), ridge = base + m * (3 + 24 * fbm(x * 0.022 + 3, z * 0.022 + 7) + 5 * fbm(x * 0.08, z * 0.08));
      return far * ridge + (1 - far) * H(x, z); };
    const h2 = []; for (let i = 0; i <= n2x; i++) { h2[i] = []; for (let j = 0; j <= n2z; j++) h2[i][j] = Ho(OX0 + i * S2, OZ0 + j * S2); }
    for (let i = 0; i < n2x; i++) for (let j = 0; j < n2z; j++) { const x0 = OX0 + i * S2, z0 = OZ0 + j * S2, x1 = x0 + S2, z1 = z0 + S2; if (x0 >= X0 && x1 <= X1 && z0 >= Z0 && z1 <= Z1) continue;
      const p00 = [x0, h2[i][j], z0], p10 = [x1, h2[i + 1][j], z0], p01 = [x0, h2[i][j + 1], z1], p11 = [x1, h2[i + 1][j + 1], z1];
      if ((i + j) & 1) { tri(p00, p01, p11); tri(p00, p11, p10); } else { tri(p00, p01, p10); tri(p10, p01, p11); } }
    const sk = ROCK2.clone().multiplyScalar(0.8).convertSRGBToLinear(); const skirt = (a, b) => { const A = [a[0], a[1], a[2]], B = [b[0], b[1], b[2]], A2 = [a[0], a[1] - 5, a[2]], B2 = [b[0], b[1] - 5, b[2]]; for (const p of [A, B, B2, A, B2, A2]) { P.push(...p); CO.push(sk.r, sk.g, sk.b); } };
    for (let i = 0; i < nx; i++) { skirt([X0 + i * S, hg[i][0], Z0], [X0 + (i + 1) * S, hg[i + 1][0], Z0]); skirt([X0 + i * S, hg[i][nz], Z1], [X0 + (i + 1) * S, hg[i + 1][nz], Z1]); }
    for (let j = 0; j < nz; j++) { skirt([X0, hg[0][j], Z0 + j * S], [X0, hg[0][j + 1], Z0 + (j + 1) * S]); skirt([X1, hg[nx][j], Z0 + j * S], [X1, hg[nx][j + 1], Z0 + (j + 1) * S]); }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(CO, 3)); g2.computeVertexNormals();
    const outer = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide })); outer.receiveShadow = true; out.add(outer); window.__outer = outer; }
  const rimPt = (th, off = 0) => { const r = rimR(th) + off; return [HC[0] + Math.cos(th) * r, HC[1] + Math.sin(th) * r]; };

  // ---- the sawn wall at the back of the cut: honeycomb of drilled holes, cave mouth ----
  const holeM = new THREE.MeshBasicMaterial({ color: '#211c17' });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { if ((r * 10 + c) % 7 === 3) continue; add(out, new THREE.CircleGeometry(0.11, 8), holeM, 13.6 + c * 0.42 + (r % 2) * 0.21, 2.3 + r * 0.55, -9.17, { cast: false }); }
  // ---- cave mouth (v9): a rock face with an arched opening, a short tunnel that turns to darkness, and the knoll behind ----
  // Every surface is single-sided and faces the viewer: the tunnel faces inward, the face faces out, the far end is an opaque
  // dark cap, and the tunnel stops before the hillside so no terrain ever crosses it. The rock lumps all sit outside the tunnel.
  { const g = new THREE.Group(); g.position.set(11.4, 1.6, -7.75); g.rotation.y = 0.3; out.add(g); window.__cave = g;
    const N = 18, secs = [0, 0.3, 0.65, 1.0], W = 1.18, HH = 2.4, ROCKC = C('#8e8a85'), MOSS = C('#5e8560');
    const prof = []; for (let i = 0; i <= N; i++) { const a = Math.PI * i / N, n = (hsh(i * 3.7, 1.3) - 0.5) * 0.18; prof.push([Math.cos(a) * W * (1 + n) + Math.sin(a) * 0.08, Math.pow(Math.sin(a), 0.8) * HH * (1 + n * 0.7)]); }
    const ring = k => prof.map(([x, y], i) => { const s = 1 - 0.09 * k, j = (hsh(i * 1.9 + k * 7.1, k * 2.3) - 0.5) * 0.12 * (k > 0 ? 1 : 0); return [x * s + j, Math.max(0.03, y * s - 0.04 * k + (y > 0.05 ? j : 0)), -secs[k]]; });
    const R = secs.map((_, k) => ring(k)); window.__caveTun = { R, secs };
    const P2 = [], C2 = [];
    // orient every triangle so its normal points at `ref` (inside the tunnel, or out in front of the face)
    const tri2 = (a, b, c, ref, colf) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      const r = ref(cx, cy, cz); if (nx * (r[0] - cx) + ny * (r[1] - cy) + nz * (r[2] - cz) < 0) { const t = b; b = c; c = t; }
      for (const p of [a, b, c]) { P2.push(p[0], p[1], p[2]); const cc = colf(p); C2.push(cc.r, cc.g, cc.b); } };
    const tunCol = p => { const d = -p[2] / secs[secs.length - 1], f = Math.pow(Math.max(0, 1 - d), 2.2) * 0.75 + 0.03; return ROCKC.clone().multiplyScalar(f).convertSRGBToLinear(); };
    const inRef = (x, y, z) => [0, 0.9, z];
    for (let k = 0; k < secs.length - 1; k++) { for (let i = 0; i < N; i++) { const a = R[k][i], b = R[k][i + 1], c = R[k + 1][i], d = R[k + 1][i + 1]; tri2(a, c, b, inRef, tunCol); tri2(b, c, d, inRef, tunCol); }
      tri2(R[k][0], R[k][N], R[k + 1][0], inRef, tunCol); tri2(R[k][N], R[k + 1][N], R[k + 1][0], inRef, tunCol); }   // floor
    const L = R[secs.length - 1], zE = L[0][2], black = () => C('#0d0b0a').convertSRGBToLinear();
    for (let i = 0; i < N; i++) tri2([0, 0.7, zE], L[i], L[i + 1], () => [0, 0.8, zE + 1], black); tri2([0, 0.7, zE], L[N], L[0], () => [0, 0.8, zE + 1], black);
    // the rock face around the opening: three rings out from the mouth edge, bulging forward, then folding back into the knoll
    const RINGS = [[0, 0, 0], [0.55, 0.42, 0.16], [1.25, 0.95, 0.02], [2.05, 1.55, -0.55]];
    const FR = RINGS.map(([o, oy, fz], r) => prof.map(([x, y], i) => { const a = Math.PI * i / N, nx = Math.cos(a), ny = Math.pow(Math.sin(a), 0.8), jit = r ? (hsh(i * 2.1 + r * 5.3, r * 1.7) - 0.5) * 0.28 : 0;
      return [x + nx * (o + jit), r ? Math.max(0, y + ny * (oy + jit * 0.8)) : y, r ? fz + (hsh(i * 4.3, r * 9.1) - 0.5) * 0.18 : 0]; }));
    for (let r = 0; r < FR.length; r++) { FR[r][0][1] = 0; FR[r][N][1] = 0; } // both feet stand on the floor
    const faceCol = p => { const top = Math.max(0, Math.min(1, (p[1] - 1.9) / 1.2)) * (0.5 + 0.5 * Math.max(0, Math.min(1, (hsh(Math.round(p[0] * 3), 7) - 0.3) * 2))); return ROCKC.clone().multiplyScalar(0.92 + 0.12 * hsh(Math.round(p[0] * 4), Math.round(p[1] * 4))).lerp(MOSS, top * 0.8).convertSRGBToLinear(); };
    const outRef = (x, y, z) => [x * 0.3, y * 0.3 + 0.8, 4];
    for (let r = 0; r < FR.length - 1; r++) for (let i = 0; i < N; i++) { const a = FR[r][i], b = FR[r][i + 1], c = FR[r + 1][i], d = FR[r + 1][i + 1]; tri2(a, c, b, outRef, faceCol); tri2(b, c, d, outRef, faceCol); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3)); tg.computeVertexNormals();
    const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); tm.receiveShadow = true; tm.castShadow = true; g.add(tm);
    // the knoll: shoulders and a crown that tuck behind the face's outer ring, and a big back mass sunk into the hillside
    const rockM = new THREE.MeshStandardMaterial({ color: '#8e8a85', roughness: 1, flatShading: true }), mossM = new THREE.MeshStandardMaterial({ color: '#5e8560', roughness: 1, flatShading: true });
    const lumps = []; const lump = (r, x, y, z, sx, sy, sz, sd, m) => { const o = add(g, smoothRock(r, 0.4, sd), m || rockM, x, y, z); o.scale.set(sx, sy, sz); lumps.push(o); return o; }; // no rotation: a stretched lump must keep its long axis where it was placed
    lump(1.35, -2.75, 0.85, -0.85, 1.0, 1.1, 1.0, 1.1); lump(1.3, 2.75, 0.8, -0.95, 1.0, 1.05, 1.0, 2.3);
    lump(1.55, 0.0, 3.75, -1.15, 1.55, 0.72, 1.0, 3.7); lump(1.5, 0.05, 4.15, -1.25, 1.35, 0.4, 0.85, 5.2, mossM);
    lump(2.1, 0.0, 2.0, -3.5, 1.75, 1.2, 0.85, 4.4); lump(1.6, -2.4, 2.1, -2.4, 1.0, 1.0, 1.0, 6.6); lump(1.6, 2.5, 2.0, -2.5, 1.0, 1.0, 1.0, 7.7);
    lump(0.5, -3.55, 0.25, 0.35, 1, 0.75, 1, 6.1); lump(0.42, 3.5, 0.22, 0.3, 1, 0.75, 1, 7.3); lump(0.26, 1.95, 0.12, 0.62, 1, 0.8, 1, 8.2);
    window.__caveLumps = lumps;
    const vineM = new THREE.MeshLambertMaterial({ color: '#557c4f', side: THREE.DoubleSide });
    [[-1.55, 0.5], [-1.2, 0.35], [1.25, 0.45], [1.6, 0.6], [0.95, 0.28]].forEach(([x, len], k) => { const y = FR[2][Math.round((Math.acos(Math.max(-1, Math.min(1, x / 2.4))) / Math.PI) * N)][1] - 0.15; const v = new THREE.Mesh(new THREE.PlaneGeometry(0.06 + hsh(k, 5) * 0.05, len), vineM); v.position.set(x, y - len / 2, 0.32); g.add(v); }); }
  const ringM = (op) => new THREE.MeshBasicMaterial({ color: '#ffe9c0', transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  function rings(x, y, z, face, r0, n, gap) { for (let i = 0; i < n; i++) { const r = r0 + i * gap; const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.035, 40), ringM(0.42 - i * 0.11)); m.position.set(x, y, z);
      if (face === 'z') m.position.z += 0.02; else if (face === 'x') { m.rotation.y = Math.PI / 2; m.position.x += 0.02; } else m.rotation.x = -Math.PI / 2; out.add(m); (window.__rings = window.__rings || []).push({ x, y, z, i, mat: m.material, base: m.material.opacity, m }); } }
  rings(15.5, 3.1, -9.15, 'z', 0.35, 4, 0.38); rings(11.4, 2.75, -8.95, 'z', 1.3, 3, 0.45);

  // ---- water: stream out of the cave, across the cut floor, over the rim; plus a fall from the far rim ----
  const water = new THREE.MeshStandardMaterial({ color: '#a7dcd6', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9, emissive: '#3c6f70', emissiveIntensity: 0.35 });
  // flagstone path from the cave mouth down to the meadow by the ropeway station
  { const path = [[11.4, -7.2], [11.25, -6.2], [10.9, -3.6], [11.1, -1.6], [10.5, 0.2]]; const flagM = [M('#b9b2a6'), M('#aaa397'), M('#c4bdb1'), M('#a39c90')];
    let k = 0; for (let i = 0; i < path.length - 1; i++) { const [x0, z0] = path[i], [x1, z1] = path[i + 1]; const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 0.52), nx_ = -(z1 - z0) / L, nz_ = (x1 - x0) / L;
      for (let q = 0; q < n; q++) { const t = (q + 0.5) / n; for (const sd of [-1, 1]) { k++; const h1 = hsh(k * 1.7, i * 3.1 + q), h2 = hsh(q * 2.3 + 11, k * 0.7), h3 = hsh(k * 5.1, q * 1.3 + 4);
        if (h3 < 0.12) continue; const off = sd * (0.22 + h1 * 0.12), x = x0 + (x1 - x0) * t + nx_ * off + (h2 - 0.5) * 0.12, z = z0 + (z1 - z0) * t + nz_ * off + (h1 - 0.5) * 0.12;
        const r = 0.2 + h2 * 0.1, st = add(out, new THREE.CylinderGeometry(r, r * 1.08, 0.07, 6 + (k % 3)), flagM[k % 4], x, H(x, z) + 0.035, z, { cast: false }); st.rotation.y = h3 * 6.28; st.scale.z = 0.75 + h1 * 0.35; } } }
    window.__flagPath = path; }

  // ---- vegetation: tree clusters on the slopes, shrubs on ledges, vines hanging over the rim ----
  const pine = [M('#3f6450'), M('#4a705a'), M('#375a48')], round = [M('#6c9a63'), M('#79a86f'), M('#5f8b58')], pink = [M('#a8432c'), M('#bb5333')], gold = [M('#d09a3a'), M('#ddae4a'), M('#bc8a32')], rust = [M('#ad442c'), M('#c05535'), M('#963a27')], orng = [M('#cc7232'), M('#d9843e'), M('#b8652b')];
  function tree(x, z, s, kind) { s *= 1.3; const y = H(x, z); const g = new THREE.Group(); (window.__trees = window.__trees || []).push({ g, ph: hsh(x * 1.7, z * 2.3) * 6.28, s }); (window.__obst = window.__obst || []).push({ x, z, r: 0.3 * s + 0.12 }); g.position.set(x, y - 0.05, z); g.scale.setScalar(s); out.add(g); cyl(g, 0.07, 0.11, 0.9, 5, woodDark, 0, 0.45, 0);
    if (kind === 0) [0, 0.55, 1.05].forEach((yy, j) => cyl(g, 0, 0.75 - j * 0.2, 1.05, 6, pine[(j + Math.floor(x)) % 3 < 0 ? 0 : (j + Math.floor(Math.abs(x))) % 3], 0, 1.0 + yy, 0));
    else if (kind === 1) for (let k = 0; k < 3; k++) add(g, new THREE.IcosahedronGeometry(0.55 + rnd() * 0.3, 1), (hsh(x * 0.7, z * 0.9) < 0.3 ? rust : hsh(x * 0.7, z * 0.9) < 0.55 ? orng : hsh(x * 0.7, z * 0.9) < 0.75 ? gold : round)[k], (rnd() - .5) * 0.6, 1.25 + rnd() * 0.4, (rnd() - .5) * 0.6);
    else for (let k = 0; k < 5; k++) add(g, new THREE.IcosahedronGeometry(0.35 + rnd() * 0.22, 0), pink[k % 2], (rnd() - .5) * 0.8, 1.15 + rnd() * 0.5, (rnd() - .5) * 0.8); }
  const slope = (x, z) => { const d = 0.3; return Math.hypot(H(x + d, z) - H(x - d, z), H(x, z + d) - H(x, z - d)) / (2 * d); };
  for (let i = 0; i < 900; i++) { const x = -22 + rnd() * 50, z = -22 + rnd() * 50; const h = H(x, z); if (h < -0.3 || slope(x, z) > 0.75 || CUTZ(x, z)) continue;
    const dens = fbm(x * 0.18 + 2, z * 0.18 + 8); const e = Math.hypot(x - HC[0], z - HC[1]) - rimR(Math.atan2(z - HC[1], x - HC[0]));
    if (dens < 0.5 || e < 1.6) continue; if (rnd() < 0.55) continue;
    tree(x, z, 0.6 + rnd() * 0.7, dens > 0.66 ? 0 : (rnd() < 0.08 ? 2 : 1)); }
  [[2.2, 14.5], [6.8, -1.6], [-3.5, 6.4], [17.5, 0.2]].forEach(([x, z]) => tree(x, z, 1.0, 2));
  const shrubM = [M('#a9673f'), M('#8f9058'), M('#6d8553')];
  for (let i = 0; i < 700; i++) { const x = -18 + rnd() * 46, z = -18 + rnd() * 46; const h = H(x, z); const s = slope(x, z); if (s > 0.9 || CUTZ(x, z)) continue;
    if (h < -2.6 && h > -5.5) { const b = add(out, new THREE.IcosahedronGeometry(0.22 + rnd() * 0.3, 0), shrubM[i % 3], x, h + 0.15, z); b.scale.y = 0.7; continue; }
    if (h > -0.3 && rnd() < 0.3) { const t = cyl(out, 0, 0.08, 0.32, 4, rnd() < .5 ? M('#a49b68') : M('#c2b48a'), x, h + 0.14, z, { cast: false }); t.scale.y = 0.7 + rnd(); } }
  const vineG = new THREE.MeshLambertMaterial({ color: '#5e7a4c', side: THREE.DoubleSide }), vineL = new THREE.MeshLambertMaterial({ color: '#a8553a', side: THREE.DoubleSide });
  for (let i = 0; i < 160; i++) { const th = -Math.PI - 0.2 + rnd() * (Math.PI * 0.95); const [x, z] = rimPt(th, -0.15 - rnd() * 0.2); const top = H(x, z) + 0.05; if (top < -1.5) continue; const len = 0.5 + rnd() * 4.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06 + rnd() * 0.14, len), rnd() < .5 ? vineG : vineL); m.position.set(x, top - len / 2, z); m.rotation.y = Math.atan2(-Math.cos(th), -Math.sin(th)); out.add(m); }
  for (let i = 0; i < 70; i++) { const x = -10 + rnd() * 34, z = -10 + rnd() * 34; const h = H(x, z); if (h < -0.2 || slope(x, z) > 0.6) continue; const r = add(out, new THREE.DodecahedronGeometry(0.15 + rnd() * 0.35, 0), M(['#a8a196', '#958d82', '#b8b1a6'][i % 3]), x, h + 0.08, z); r.rotation.set(rnd() * 3, rnd() * 3, 0); }

  for (let i = 0; i < 40; i++) { const x = -14 + rnd() * 40, z = -14 + rnd() * 40; const h = H(x, z); if (h < -0.2 || CUTZ(x, z)) continue; if (fbm(x * 0.55 + 31, z * 0.55 + 7) < 0.6) continue;
    const r = add(out, new THREE.DodecahedronGeometry(0.5 + rnd() * 0.7, 0), M(['#aaa296', '#9a9286', '#b5ada2'][i % 3]), x, h + 0.1, z); r.scale.y = 0.55 + rnd() * 0.3; r.rotation.set(0, rnd() * 3, 0); }
  // ---- quarry traces: squared blocks on the cut floor, derricks, scaffolds on the sawn wall ----
  [[17.3, -4.9], [18.1, -4.9], [17.3, -4.1], [17.7, -4.5, 1]].forEach(([x, z, up]) => box(out, 0.75, 0.55, 0.75, M('#d6cfc2'), x, 1.6 + 0.28 + (up ? 0.55 : 0), z));
  function derrick(x, z, hgt, len, ry, load) { const y = H(x, z); (window.__obst = window.__obst || []).push({ x, z, r: 0.8 }); const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; out.add(g);
    box(g, 0.14, hgt, 0.14, woodMat, 0, hgt / 2, 0); box(g, 0.09, hgt * 0.8, 0.09, woodDark, -0.5, hgt * 0.4, 0, { rz: -0.22 });
    box(g, len, 0.12, 0.12, woodMat, len / 2 - 0.3, hgt - 0.2, 0); box(g, 0.06, 1.6, 0.06, woodDark, len * 0.35, hgt - 0.65, 0, { rz: 0.9 });
    cyl(g, 0.012, 0.012, 1.4, 4, ropeMat, len - 0.4, hgt - 0.9, 0); if (load) box(g, 0.55, 0.45, 0.55, M('#d6cfc2'), len - 0.4, hgt - 1.8, 0); }
  derrick(14.2, -4.0, 3.2, 2.8, -0.4, true); derrick(-1.5, 3.2, 3.0, 2.6, 0.7, true);
  function scaffold(x, y, z, w) { const g = new THREE.Group(); g.position.set(x, y, z); out.add(g);
    box(g, w, 0.1, 1.0, woodMat, 0, 0, 0.5); [-w / 2 + .1, w / 2 - .1].forEach(px => { box(g, 0.08, 1.1, 0.08, woodDark, px, 0.55, 0.95); box(g, 0.07, 1.6, 0.07, woodDark, px, -0.7, 0.6, { rx: 0.55 }); });
    box(g, w + 0.3, 0.06, 1.2, M('#8f6c48'), 0, 1.15, 0.55, { rx: -0.14 }); box(g, w, 0.04, 0.04, woodDark, 0, 0.5, 0.98); }
  scaffold(14.8, 4.6, -9.1, 2.0); scaffold(17.6, 3.2, -9.1, 1.6);
  [-0.2, 0.2].forEach(d => box(out, 0.05, 3.0, 0.05, woodDark, 16.4 + d, 1.6 + 1.5, -8.95)); for (let y = 1.8; y < 4.6; y += 0.3) box(out, 0.42, 0.035, 0.05, woodDark, 16.4, y, -8.95);

  // ---- ropeway over the abyss: from the left slope to the top of the cut ----
  const [tAx, tAz] = rimPt(-0.33, 2.0), tA = new THREE.Vector3(tAx, H(tAx, tAz) + 3.4, tAz), tB = new THREE.Vector3(9.8, H(9.8, -2.0) + 3.6, -2.0);
  [tA, tB].forEach(p => { const y0 = p.y - 3.4; box(out, 0.13, 3.4, 0.13, woodMat, p.x, y0 + 1.7, p.z); box(out, 0.9, 0.1, 0.1, woodMat, p.x, p.y, p.z, { ry: Math.PI / 4 }); box(out, 0.08, 2.2, 0.08, woodDark, p.x + 0.4, y0 + 1.0, p.z + 0.4, { rx: -0.3, rz: 0.3 }); });
  rope(out, tA, tB, 1.8, 0.02, M('#4a443c')); rope(out, tA.clone().add(new THREE.Vector3(0, -0.25, 0)), tB.clone().add(new THREE.Vector3(0, -0.25, 0)), 1.8, 0.012, M('#4a443c'));
  const mid = new THREE.Vector3().lerpVectors(tA, tB, 0.55); mid.y -= 1.8 * 4 * 0.55 * 0.45;
  cyl(out, 0.012, 0.012, 0.7, 4, M('#4a443c'), mid.x, mid.y - 0.35, mid.z); const bk = new THREE.Group(); window.__gondola = { bk, tA, tB }; bk.position.set(mid.x, mid.y - 0.95, mid.z); out.add(bk);
  box(bk, 0.7, 0.4, 0.5, woodMat, 0, 0, 0); box(bk, 0.5, 0.25, 0.32, M('#d6cfc2'), 0, 0.22, 0);

  // ---- sound: stone chimes, listening horns, the bell on the spire ----
  function chimes(x, z, ry, n) { const y = H(x, z); const g = new THREE.Group(); (window.__chimes=window.__chimes||[]).push(g); g.position.set(x, y, z); g.rotation.y = ry; out.add(g);
    const w = n * 0.32 + 0.3; box(g, 0.08, 1.9, 0.08, woodDark, -w / 2, 0.95, 0); box(g, 0.08, 1.9, 0.08, woodDark, w / 2, 0.95, 0); box(g, w + 0.3, 0.1, 0.1, woodMat, 0, 1.85, 0); box(g, w + 0.5, 0.06, 0.16, M('#8f6c48'), 0, 1.95, 0);
    for (let i = 0; i < n; i++) { const L = 1.05 - i * 0.1, xx = -w / 2 + 0.3 + i * 0.32; cyl(g, 0.008, 0.008, 0.18, 3, ropeMat, xx, 1.75, 0); box(g, 0.24, L * 0.62, 0.05, M(i % 2 ? '#dcd7cd' : '#cbc5bb'), xx, 1.66 - L * 0.31, 0, { rz: (i % 2 ? 0.04 : -0.03) }); } }
  chimes(CHIME1[0], CHIME1[1], CHIME1[2], 6); chimes(6.4, -2.4, 0.3, 5);
  rings(-0.4, 1.3, 5.0, 'x', 0.45, 3, 0.35);
  function horn(x, z, ry, s) { const y = H(x, z); const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); out.add(g);
    box(g, 0.08, 1.2, 0.08, woodDark, 0, 0.6, 0); cyl(g, 0.05, 0.42, 1.1, 12, M('#c39550', { metalness: .5, roughness: .45 }), 0, 1.35, 0.45, { rx: Math.PI / 2 - 0.25 });
    const mouth = add(g, new THREE.CircleGeometry(0.4, 12), new THREE.MeshBasicMaterial({ color: '#2a2016' }), 0, 1.25, 1.0, { cast: false }); mouth.rotation.x = -0.25; }
  horn(HORN1[0], HORN1[1], HORN1[2], 1.15); horn(3.6, -0.8, Math.PI / 4 - 0.3, 0.9);
  const sy = H(SPIRE[0], SPIRE[1]); const bell = new THREE.Group(); window.__bell = bell; bell.position.set(SPIRE[0], sy, SPIRE[1]); out.add(bell);
  [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(([x, z]) => box(bell, 0.09, 1.6, 0.09, woodMat, x, 0.8, z));
  box(bell, 1.35, 0.1, 1.35, woodMat, 0, 1.6, 0); box(bell, 1.6, 0.06, 1.6, M('#8f6c48'), 0, 1.78, 0, { rx: 0.05 });
  cyl(bell, 0.13, 0.38, 0.55, 9, M('#b98a4e', { metalness: .45, roughness: .5 }), 0, 1.2, 0);
  rings(SPIRE[0], sy + 1.3, SPIRE[1], 'y', 0.75, 4, 0.5);
  // (the old rope bridge to the spire is gone: the bell stage is reached by a timber bridge from the east rim, built at runtime)
  // lamps along the rim path (lit by effective time, see runtime)
  window.__lamps = [];
  // stone lanterns (石燈籠): hexagonal base, pillar, platform, a fire box open between four posts, flared roof and finial
  const lanternStone = M('#9d978f'), lanternMoss = M('#6e7f4f');
  [[-1.65, 8.6], LAMP1, [5.35, -4.65], [12.1, -3.5], [-6.5, 15.5]].forEach(([x, z], i) => { const y = H(x, z); const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = i * 0.7; out.add(g);
    cyl(g, 0.42, 0.47, 0.2, 6, lanternStone, 0, 0.1, 0); cyl(g, 0.3, 0.38, 0.14, 6, lanternStone, 0, 0.27, 0); cyl(g, 0.13, 0.16, 0.72, 8, lanternStone, 0, 0.7, 0);
    cyl(g, 0.38, 0.27, 0.16, 6, lanternStone, 0, 1.13, 0);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; box(g, 0.08, 0.42, 0.08, lanternStone, Math.cos(a) * 0.21, 1.42, Math.sin(a) * 0.21); }
    cyl(g, 0.3, 0.3, 0.05, 6, lanternStone, 0, 1.64, 0);
    const mat = new THREE.MeshBasicMaterial({ color: '#3a3128' }); cyl(g, 0.17, 0.17, 0.36, 8, mat, 0, 1.42, 0, { cast: false });
    cyl(g, 0.06, 0.52, 0.3, 6, lanternStone, 0, 1.81, 0); cyl(g, 0.5, 0.52, 0.05, 6, lanternMoss, 0, 1.68, 0); add(g, new THREE.SphereGeometry(0.09, 8, 6), lanternStone, 0, 2.02, 0); cyl(g, 0.05, 0.06, 0.06, 6, lanternStone, 0, 1.95, 0);
    const l = new THREE.PointLight(0xffc474, 0, 5.5, 2); l.position.set(x, y + 1.42, z); out.add(l);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffc474', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(1.6, 1.6, 1); gl.position.set(x, y + 1.42, z); out.add(gl);
    window.__lamps.push({ x, z, y, mat, light: l, glow: gl, level: 0 }); });

  // ======== LEFT: river, great waterfall, water mill ========
  const waterM = new THREE.MeshStandardMaterial({ color: '#4f98a5', roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.9, emissive: '#244f58', emissiveIntensity: 0.3 });
  { const pts = []; for (let i = 0; i < RIVER.length - 1; i++) { const [x0, z0] = RIVER[i], [x1, z1] = RIVER[i + 1]; const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25); for (let k = 0; k < n; k++) pts.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, i + k / n]); }
    pts.push([...RIVER[RIVER.length - 1], RIVER.length - 1]);
    // Adjacent strips share their cross-section at bends: no overlapping triangles.
    const edges = pts.map(([x, z, t], i) => {
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next[0] - prev[0], dz = next[1] - prev[1], L = Math.hypot(dx, dz);
      const w = riverWidth(t), y = H(x, z) + 0.32;
      return [[x - dz/L*w, y, z + dx/L*w], [x + dz/L*w, y, z - dx/L*w]];
    });
    const V = [], F = []; let SS = 0; for (let i = 0; i < pts.length - 1; i++) {
      const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      const [a1, b1] = edges[i], [c1, d1] = edges[i + 1];
      V.push(...a1, ...b1, ...c1, ...b1, ...d1, ...c1); F.push(SS, 1, SS, -1, SS + L, 1, SS, -1, SS + L, -1, SS + L, 1); SS += L; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(F, 2)); g.computeVertexNormals(); window.__riverLen = SS;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#4f98a5', roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.9, emissive: '#244f58', emissiveIntensity: 0.3, side: THREE.DoubleSide })); m.receiveShadow = true; out.add(m); }
  { const sm = new THREE.MeshBasicMaterial({ color: '#e8f6f7', transparent: true, opacity: 0.55 });
    for (let i = 0; i < RIVER.length - 1; i++) { const [x0, z0] = RIVER[i], [x1, z1] = RIVER[i + 1]; const L = Math.hypot(x1 - x0, z1 - z0), nx_ = -(z1 - z0) / L, nz_ = (x1 - x0) / L;
      for (let k = 0; k < 7; k++) { const t = rnd(), off = (rnd() - .5) * 1.0, len = 0.6 + rnd() * 1.4; const x = x0 + (x1 - x0) * t + nx_ * off, z = z0 + (z1 - z0) * t + nz_ * off;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.05), sm); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(z1 - z0, x1 - x0) * -1; m.position.set(x, H(x, z) + 0.34, z); out.add(m); (window.__streaks = window.__streaks || []).push({ m, x0, z0, x1, z1, t, off, L, len, sp: 0.18 + hsh(t * 9, off * 9) * 0.25 }); } } }
  const foamM = new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.8 });
  for (let i = 0; i < 40; i++) { const t = rnd() * (RIVER.length - 1.2); const k = Math.floor(t), f = t - k; const [x0, z0] = RIVER[k], [x1, z1] = RIVER[k + 1]; const x = x0 + (x1 - x0) * f + (rnd() - .5) * 1.2, z = z0 + (z1 - z0) * f + (rnd() - .5) * 1.2;
    add(out, new THREE.CircleGeometry(0.05 + rnd() * 0.12, 6), foamM, x, H(x, z) + 0.31, z, { cast: false, rx: -Math.PI / 2 }); }
  for (let i = 0; i < 30; i++) { const t = rnd() * (RIVER.length - 1); const k = Math.min(RIVER.length - 2, Math.floor(t)), f = t - k; const [x0, z0] = RIVER[k], [x1, z1] = RIVER[k + 1]; const sd = (rnd() < .5 ? -1 : 1) * (1.0 + (k + f) * 0.25 + rnd() * 0.4);
    const nxv = -(z1 - z0), nzv = x1 - x0, L = Math.hypot(nxv, nzv); const x = x0 + (x1 - x0) * f + nxv / L * sd, z = z0 + (z1 - z0) * f + nzv / L * sd;
    const r = add(out, new THREE.DodecahedronGeometry(0.18 + rnd() * 0.3, 0), M(['#a8a196', '#958d82', '#b8b1a6'][i % 3]), x, H(x, z) + 0.12, z); r.rotation.set(rnd() * 3, rnd() * 3, 0); }
  // the great fall: several sheets, spray at the lip, mist clouds down the drop, a faint rainbow
  const [fx, fz] = rimPt(FALL_TH, 0.0), fy = H(fx, fz) + 0.32, fry = Math.atan2(-Math.cos(FALL_TH), -Math.sin(FALL_TH));
  window.__fall = { fx, fz, fy, fry }; for (let q = 0; q < 52; q++) rnd();
  // stone arch bridge over the river
  { const bx = -4.0, bz = 12.85, by = H(-4.0, 11.0) ; const g = new THREE.Group(); g.position.set(bx, by, bz); g.rotation.y = -Math.atan2(13.1 - 12.6, -2.0 + 5.7); out.add(g);
    for (let k = 0; k < 9; k++) { const t = k / 8 - 0.5, yy = 0.55 - t * t * 1.4; box(g, 0.55, 0.22, 1.0, M(k % 2 ? '#b9b1a5' : '#aca498'), 0, yy, t * 3.2, { rx: -t * 0.9 }); }
    [-1, 1].forEach(sd => box(g, 0.25, 0.75, 0.5, M('#9d958a'), 0, 0.15, sd * 1.75)); }
  // water mill driving a stone saw, with the workshop next to it
  { const mx = -7.85, mz = 12.05, my = H(-7.85, 12.05) + 0.45; const g = new THREE.Group(); g.position.set(mx, my, mz); g.rotation.y = -Math.atan2(1.1, 4.3); out.add(g);
    const wheel = new THREE.Group(); window.__wheel = wheel; wheel.position.set(0, 0.95, 0); g.add(wheel); cyl(wheel, 1.05, 1.05, 0.12, 14, woodMat, 0, 0, -0.25, { rx: Math.PI / 2 }); cyl(wheel, 1.05, 1.05, 0.12, 14, woodMat, 0, 0, 0.25, { rx: Math.PI / 2 });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const p = box(wheel, 0.06, 0.5, 0.6, woodDark, Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0); p.rotation.z = a; }
    cyl(wheel, 0.12, 0.12, 1.4, 8, woodDark, 0, 0, 0, { rx: Math.PI / 2 });
    box(g, 0.14, 1.6, 0.14, woodDark, 0, 0.6, -0.8); box(g, 0.14, 1.6, 0.14, woodDark, 0, 0.6, 0.8);
    // saw bench beside it: a block being sawn
    box(g, 2.2, 0.6, 1.0, woodMat, 0, 0.3, -2.1); box(g, 1.3, 0.8, 0.8, M('#d6cfc2'), 0.2, 1.0, -2.1); box(g, 0.03, 1.0, 1.2, ironMat, -0.15, 1.15, -2.1); box(g, 2.6, 0.08, 0.08, woodDark, -0.15, 1.6, -2.1);
    // little workshop roof with hanging tools
    const sh = new THREE.Group(); sh.position.set(1.8, 0, -3.4); g.add(sh);
    [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]].forEach(([a, b], i) => box(sh, 0.1, i < 2 ? 1.9 : 1.5, 0.1, woodDark, a, (i < 2 ? 1.9 : 1.5) / 2, b)); box(sh, 2.2, 0.07, 1.6, M('#8b6644'), 0, 1.72, 0, { rx: 0.25 });
    box(sh, 1.4, 0.08, 0.5, woodMat, 0, 0.75, 0.2); for (let k = 0; k < 5; k++) { box(sh, 0.04, 0.55, 0.04, ironMat, -0.7 + k * 0.32, 1.25, -0.56); box(sh, 0.14, 0.08, 0.06, ironMat, -0.7 + k * 0.32, 1.52, -0.56); } }
  // lip of the fall: a worn rock shelf with a rope rail where the traveller watches the water go
  { const [px, pz] = rimPt(FALL_TH - 0.2, 0.6); const py = H(px, pz); const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.y = fry; out.add(g);
    for (let k = 0; k < 3; k++) cyl(g, 0.05, 0.06, 0.9, 5, woodDark, -0.9 + k * 0.9, 0.45, 0.9); rope(g, new THREE.Vector3(-0.9, 0.85, 0.9), new THREE.Vector3(0.9, 0.85, 0.9), 0.15, 0.018, ropeMat); }
  // ======== NEW INTERACTION SPOTS ========
  // echo boulder: a huge rounded stone with a hollow, beside the path
  { const y = H(-4.6, 3.4); const b = add(out, new THREE.IcosahedronGeometry(1.25, 1), M('#a59d91'), -4.6, y + 0.8, 3.4); b.scale.set(1.15, 0.85, 1.0);
    add(out, new THREE.CircleGeometry(0.42, 10), new THREE.MeshBasicMaterial({ color: '#1f1a15' }), -3.62, y + 0.85, 3.9, { cast: false }).rotation.y = Math.PI / 2 - 0.4;
    add(out, new THREE.IcosahedronGeometry(1.26, 1), M('#6c9a62'), -4.7, y + 1.15, 3.3).scale.set(0.9, 0.35, 0.8); }
  // lookout deck jutting over the abyss (rest point – the traveller's luggage sits here)
  const lth = 2.4, [lx, lz] = rimPt(lth, 0.6), dirx = -Math.cos(lth), dirz = -Math.sin(lth), ly = H(lx, lz);
  { const g = new THREE.Group(); g.position.set(lx, ly + 0.05, lz); g.rotation.y = Math.atan2(dirx, dirz); out.add(g);
    box(g, 2.0, 0.1, 2.6, woodMat, 0, 0, 1.0);
    // structure: two joists run back under the deck into the ground, a cross beam carries the outer edge, and raked struts take it back to footings set into the cliff face
    { const th = Math.atan2(dirx, dirz), y0 = ly + 0.05, wy = (x, z) => H(lx + x * Math.cos(th) + z * Math.sin(th), lz - x * Math.sin(th) + z * Math.cos(th)) - y0;
      [-0.75, 0.75].forEach(x => box(g, 0.15, 0.15, 3.5, woodDark, x, -0.13, 0.65)); box(g, 1.75, 0.15, 0.15, woodDark, 0, -0.13, 2.2);
      const strut = (A, B, w) => { const d = new THREE.Vector3().subVectors(B, A), L = d.length(); const m = add(g, new THREE.BoxGeometry(w, L, w), woodDark, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
      const feet = [-0.75, 0.75].map(x => { let zb = 0.4; for (let z = 0.3; z < 2.0; z += 0.02) { if (wy(x, z) <= -1.9) { zb = z; break; } } const B = new THREE.Vector3(x, -1.9, zb - 0.15); strut(new THREE.Vector3(x, -0.2, 2.15), B, 0.12);
        box(g, 0.34, 0.24, 0.34, M('#8f8a86'), x, -1.95, zb - 0.1); return B; });
      // a knee brace from each strut back to the joist, and one cross brace between the struts
      feet.forEach(B => { const mid = new THREE.Vector3().lerpVectors(new THREE.Vector3(B.x, -0.2, 2.15), B, 0.45); strut(mid, new THREE.Vector3(B.x, -0.2, Math.max(0.0, B.z - 0.1)), 0.08); });
      const m1 = new THREE.Vector3().lerpVectors(new THREE.Vector3(-0.75, -0.2, 2.15), feet[0], 0.5), m2 = new THREE.Vector3().lerpVectors(new THREE.Vector3(0.75, -0.2, 2.15), feet[1], 0.5); strut(m1, m2, 0.07); }
    [-0.95, 0.95].forEach(a => { box(g, 0.06, 0.6, 0.06, woodDark, a, 0.3, 2.25); box(g, 0.05, 0.05, 2.5, woodDark, a, 0.58, 1.0); }); box(g, 1.9, 0.05, 0.05, woodDark, 0, 0.58, 2.28);
    box(g, 0.8, 0.08, 0.35, woodMat, 0, 0.35, 0.6); box(g, 0.08, 0.3, 0.3, woodDark, -0.33, 0.17, 0.6); box(g, 0.08, 0.3, 0.3, woodDark, 0.33, 0.17, 0.6);
    box(g, 0.45, 0.4, 0.3, M('#8c6b49'), -0.68, 0.25, -0.05); box(g, 0.38, 0.06, 0.25, M('#6e5236'), -0.68, 0.48, -0.05); window.__deck = g; }
  // rail line on the cut floor with a stone cart
  { for (const dz of [-0.32, 0.32]) box(out, 7.0, 0.06, 0.06, ironMat, 15.4, 1.68, -7.2 + dz, { cast: false }); for (let x = 12.1; x < 18.9; x += 0.55) box(out, 0.13, 0.05, 0.9, woodDark, x, 1.63, -7.2, { cast: false });
    const c = new THREE.Group(); c.position.set(14.6, 1.6, -7.2); out.add(c); box(c, 1.2, 0.55, 0.85, M('#6c5a45'), 0, 0.5, 0); box(c, 0.7, 0.45, 0.6, M('#d6cfc2'), 0, 0.98, 0);
    [-0.4, 0.4].forEach(x => [-0.42, 0.42].forEach(z => cyl(c, 0.17, 0.17, 0.08, 8, ironMat, x, 0.18, z, { rx: Math.PI / 2 }))); }
  // weathered marker stone (its worn marks are what the charcoal rubbing paper reads)
  { const x = 6.2, z = 0.4, y = H(x, z); const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = 0.6; out.add(g);
    box(g, 0.8, 1.6, 0.32, M('#a9a296'), 0, 0.8, 0); box(g, 1.0, 0.18, 0.5, M('#8f887d'), 0, 0.09, 0); for (let k = 0; k < 5; k++) box(g, 0.08 + (k % 2) * 0.06, 0.05, 0.02, M('#6d665c'), -0.2 + k * 0.1, 0.6 + (k % 3) * 0.25, 0.17); add(g, new THREE.IcosahedronGeometry(0.3, 0), M('#6c9a62'), 0.3, 1.6, 0).scale.y = 0.4; }
  // wind-hole crag: natural rock riddled with holes that whistle in the wind (copper wind-whistle event)
  { const x = 0.6, z = 21.8, y = H(x, z); const g = new THREE.Group(); g.position.set(x, y, z); out.add(g);
    const r = add(g, new THREE.IcosahedronGeometry(1.1, 1), M('#9d958a'), 0, 1.3, 0); r.scale.set(0.8, 1.5, 0.8); add(g, new THREE.IcosahedronGeometry(0.7, 1), M('#a8a094'), 0.7, 0.6, 0.4);
    [[0.75, 1.6, 0.2], [0.6, 1.0, 0.5], [0.4, 2.1, 0.55], [0.85, 1.25, -0.25]].forEach(([a, b, c]) => { const h = add(g, new THREE.CircleGeometry(0.11, 8), new THREE.MeshBasicMaterial({ color: '#1f1a15' }), a, b, c + 0.05, { cast: false }); h.lookAt(x + a * 3, y + b, z + c * 3 + 2); });
    rings(x + 0.7, y + 1.5, z + 0.6, 'z', 0.3, 3, 0.3); }
  // windlass at the far-right rim: a cage lowered on a rope into the cloud sea
  const [w16x, w16z] = rimPt(-0.62, 0.9);
  { const y = H(w16x, w16z), th = -0.62; const g = new THREE.Group(); g.position.set(w16x, y, w16z); g.rotation.y = Math.atan2(-Math.cos(th), -Math.sin(th)); out.add(g);
    [-0.6, 0.6].forEach(a => { box(g, 0.1, 1.0, 0.1, woodDark, a, 0.5, 0); box(g, 0.1, 1.9, 0.1, woodMat, a, 0.95, 0.9, { rx: 0.35 }); });
    cyl(g, 0.16, 0.16, 1.1, 8, woodMat, 0, 0.9, 0, { rz: Math.PI / 2 }); box(g, 0.06, 0.5, 0.06, woodDark, 0.65, 0.75, 0.2);
    box(g, 1.4, 0.1, 0.1, woodMat, 0, 1.75, 1.2); cyl(g, 0.012, 0.012, 4.2, 4, ropeMat, 0, 1.75 - 2.1, 1.35);
    const cage = new THREE.Group(); window.__cage = cage; cage.position.set(0, -2.7, 1.35); g.add(cage); box(cage, 0.6, 0.06, 0.6, woodMat, 0, -0.35, 0); box(cage, 0.6, 0.06, 0.6, woodMat, 0, 0.35, 0);
    [[-.27, -.27], [.27, -.27], [-.27, .27], [.27, .27]].forEach(([a, b]) => box(cage, 0.05, 0.7, 0.05, woodDark, a, 0, b)); box(cage, 0.32, 0.3, 0.32, M('#d6cfc2'), 0, -0.15, 0); }
  const [lpx, lpz] = rimPt(FALL_TH - 0.2, 0.6);
  window.__spots = [
    [1, '石磬架', [CHIME1[0], H(CHIME1[0], CHIME1[1]) + 1.0, CHIME1[1]]], [2, '聽音喇叭', [HORN1[0], H(HORN1[0], HORN1[1]) + 1.5, HORN1[1]]], [3, '回音巨石', [-4.6, H(-4.6, 3.4) + 1.6, 3.4]],
    [4, '觀景平台（休息點）', [lx + dirx * 1.2, ly + 0.6, lz + dirz * 1.2]], [5, '吊橋與鐘樓', [7.6, STAGE.y + 2.4, 9.6]],
    [6, '風孔岩', [0.6, H(0.6, 21.8) + 2.9, 21.8]], [7, '水車鋸石坊', [-7.85, H(-7.85, 12.05) + 2.9, 12.05]], [8, '石拱橋', [-4.0, H(-4.0, 11.0) + 1.3, 12.85]], [9, '瀑布口', [lpx, H(lpx, lpz) + 1.2, lpz]],
    [10, '風化記號石', [6.2, H(6.2, 0.4) + 1.9, 0.4]], [11, '纜車站', [9.8, H(9.8, -2.0) + 3.9, -2.0]], [12, '共鳴洞', [11.4, 4.3, -9.0]], [13, '聲壁', [15.6, 4.6, -9.0]],
    [14, '石材推車', [14.6, 2.9, -7.2]], [15, '起重架與方石', [14.2, H(14.2, -4.0) + 3.5, -4.0]], [16, '鋸切壁鷹架', [17.6, 4.7, -8.6]], [17, '絞盤吊籠', [w16x, H(w16x, w16z) + 2.0, w16z]]];
  // ---- cloud sea, mist, birds, motes, shafts ----
  const spr = (x, y, z, sx, sy2, col, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: col, transparent: true, opacity: op, depthWrite: false })); sp.scale.set(sx, sy2, 1); sp.position.set(x, y, z); out.add(sp); };
  function cloud(x, y, z, s) { spr(x, y - 0.25 * s, z, 3.4 * s, 1.3 * s, '#e3bd98', 0.5); for (let k = 0; k < 4; k++) spr(x + (rnd() - .5) * 2 * s, y + 0.1 * s + rnd() * 0.35 * s, z + (rnd() - .5) * 2 * s, (1.3 + rnd()) * s, (0.9 + rnd() * 0.5) * s, rnd() < .5 ? '#fff0de' : '#f7d9d6', 0.55); }
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: '#f0bf86' })); deep.rotation.x = -Math.PI / 2; deep.position.set(12, -21.5, 12); out.add(deep);
  const inHole = (x, z, m) => Math.hypot(x - HC[0], z - HC[1]) < rimR(Math.atan2(z - HC[1], x - HC[0])) - m;
  for (let i = 0; i < 160; i++) { const x = rnd() * 26, z = rnd() * 26; if (!inHole(x, z, 1.2)) continue; cloud(x, -10.5 + rnd() * 4, z, 1.0 + rnd() * 1.3); }
  for (let i = 0; i < 40; i++) { const x = rnd() * 26, z = rnd() * 26; if (!inHole(x, z, 1.5)) continue; spr(x, -4.5 + rnd() * 2, z, 6 + rnd() * 5, 0.8 + rnd() * 0.6, '#fbe4c8', 0.18); }
  const birdM = new THREE.MeshBasicMaterial({ color: '#f6efe4', side: THREE.DoubleSide });
  const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.32, 0.09, -0.1, -0.05, 0, 0.12, 0, 0, 0, 0.32, 0.09, -0.1, 0.05, 0, 0.12], 3));
  [[8, -3.0, 12], [9.2, -3.4, 13.1], [12, -5.2, 7.4], [13.5, -4.6, 8.2], [10.5, -6.6, 11], [15, -3.0, 11.5], [7.4, -5.8, 15]].forEach(([x, y, z]) => { const m = new THREE.Mesh(wing, birdM); m.position.set(x, y, z); m.rotation.y = rnd() * 6; out.add(m); (window.__birds=window.__birds||[]).push({ m, x, y, z, r: 2.5 + hsh(x, z) * 3, sp: 0.18 + hsh(z, y) * 0.15, ph: hsh(x, y) * 6.28 }); });
  const pos = []; for (let i = 0; i < 500 && pos.length < 900; i++) { const x = rnd() * 26, z = rnd() * 26; if (inHole(x, z, 1)) pos.push(x, -9 + rnd() * 16, z); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const moteM = new THREE.PointsMaterial({ map: softTex, color: '#fff2d6', size: 0.2, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }); out.add(new THREE.Points(pg, moteM)); window.__motes = { pg, pos, moteM };
  const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex, color: '#ffe0b4', transparent: true, opacity: 0.17, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  [[10, 12, 3.4, -0.55], [14, 8, 2.2, -0.5], [7, 16, 1.8, -0.6]].forEach(([x, z, w, rz]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 30), shaftM); m.position.set(x, -2, z); m.rotation.set(0, -Math.PI / 4, rz); out.add(m); (window.__shafts = window.__shafts || []).push({ m, rz }); });
}

/* rock helpers (also used by the cave interior) */
function jitterRock(r, det, amt, s) {
  const g = new THREE.IcosahedronGeometry(r, det); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const h = Math.sin(x * 12.9 + y * 78.2 + z * 37.7 + s) * 43758.5; const k = 1 + ((h - Math.floor(h)) - .5) * amt; p.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals(); return g;
}
function smoothRock(r, amt, sd) {
  const g = new THREE.SphereGeometry(r, 22, 14); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = fbm(x * 0.9 / r * 2 + sd, z * 0.9 / r * 2 + y * 0.7 / r) - 0.5; const k = 1 + n * amt * 2; p.setXYZ(i, x * k, y * k, z * k); }
  g.computeVertexNormals(); return g; }
/* ---------- camera: fixed 45° / 31° orthographic, same framing scale as 苔痕驛站 (22.5 units tall at 16:9) ---------- */
let cam;
function setCam(tx, ty, tz, vh) {
  const az = Math.PI / 4, el = 31 * Math.PI / 180, dist = 90, s = vh / 2;
  cam = new THREE.OrthographicCamera(-s * aspect, s * aspect, s, -s, 0.1, 400);
  cam.position.set(tx + Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist); cam.lookAt(tx, ty, tz);
}
{
/* =====================================================================
   INTERACTIVE RUNTIME – 藏聲秋谷 (area 05, formerly 回聲採石場)
   effective time (sim) drives lamps + day/night; the traveller wanders
   between the 17 spots, lights the five lamps, and rests at the lookout.
   ===================================================================== */
buildOutdoor(); grotto.visible = false;
const Q = new URLSearchParams();
const PLANNED = 3000, DAYLEN = 600, V_WALK = 0.95; // same walking pace as 苔痕驛站 (DEMO_WALK)
scene.fog = new THREE.Fog(0xf2d2b4, 125, 215); // only the far land/ridges reach it: peeking sideways fades into the sky
const hemi = new THREE.HemisphereLight(0x9cb2ea, 0x4e4038, 0.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffbd78, 2.2); sun.position.set(22, 12, -10);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, far: 140 }); sun.shadow.bias = -0.0005;
scene.add(sun); renderer.setClearColor(0, 0);

/* ---------- terrain sampling (exact, same triangulation as the mesh) ---------- */
const TG = window.__T;
function yAt(x, z) {
  const fi = (x - TG.X0) / TG.S, fj = (z - TG.Z0) / TG.S, i = Math.floor(fi), j = Math.floor(fj);
  if (i < 0 || j < 0 || i >= TG.nx || j >= TG.nz) return H(x, z);
  const fx = fi - i, fz = fj - j, hg = TG.hg, h00 = hg[i][j], h10 = hg[i + 1][j], h01 = hg[i][j + 1], h11 = hg[i + 1][j + 1];
  if ((i + j) & 1) return fz >= fx ? h00 + (h01 - h00) * fz + (h11 - h01) * fx : h00 + (h10 - h00) * fx + (h11 - h10) * fz;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
const rimPt = (th, off = 0) => { const r = rimR(th) + off; return [HC[0] + Math.cos(th) * r, HC[1] + Math.sin(th) * r]; };
const inHole = (x, z, m) => Math.hypot(x - HC[0], z - HC[1]) < rimR(Math.atan2(z - HC[1], x - HC[0])) - m;
const SP = {}; window.__spots.forEach(([n, name, p]) => SP[n] = { id: n, name, p });

/* ---------- structures the traveller can stand on ---------- */
const BRa = Math.atan2(13.1 - 12.6, -2.0 + 5.7), BR = { x: -4.0, z: 12.85, y: H(-4.0, 11.0), ux: -Math.sin(BRa), uz: Math.cos(BRa) }; // axial (across the river)
BR.lx = Math.cos(BRa); BR.lz = Math.sin(BRa);
const brArch = (ax) => (Math.abs(ax) <= 1.6 ? 0.55 - (ax / 3.2) * (ax / 3.2) * 1.4 : 0.2);
const lth = 2.4, [DKx, DKz] = rimPt(lth, 0.6), DKdx = -Math.cos(lth), DKdz = -Math.sin(lth), DKy = H(DKx, DKz) + 0.1;
const dk = (lx, lz) => [DKx + DKdz * lx + DKdx * lz, DKz - DKdx * lx + DKdz * lz]; // lookout deck local → world (local +z points over the abyss)
const DK_SEAT = dk(0, 0.6), DK_SEAT_LIFT = 0.32; // bench top sits 0.32 above the deck boards
const bth = Math.atan2(SPIRE[1] - HC[1], SPIRE[0] - HC[0]), [SAx, SAz] = rimPt(bth, 0.4), SPy = H(SPIRE[0], SPIRE[1]);
let BXr = STAGE.x1 + 3; for (let x = STAGE.x1; x < 34; x += 0.1) if (!inHole(x, STAGE.bz, -0.2)) { BXr = x + 0.6; break; }
const SBa = { x: BXr, y: yAt(BXr, STAGE.bz) + 0.03, z: STAGE.bz }, SBb = { x: STAGE.x1 + 0.02, y: STAGE.y + 0.06, z: STAGE.bz }; // timber bridge: east rim → the stage
const PF = STAGE; // the bell pavilion's stage
function groundY(x, z) {
  let y = yAt(x, z) + 0.02;
  if (x > PF.x0 - 0.02 && x < PF.x1 && z > PF.z0 && z < PF.z1) y = Math.max(y, PF.y + 0.06);
  { const dx = x - BR.x, dz = z - BR.z, ax = dx * BR.ux + dz * BR.uz, lat = dx * BR.lx + dz * BR.lz;
    if (Math.abs(lat) < 0.75 && Math.abs(ax) < 2.3) y = Math.max(y, BR.y + brArch(ax) + 0.13); }
  { const dx = x - SBa.x, dz = z - SBa.z, vx = SBb.x - SBa.x, vz = SBb.z - SBa.z, L2 = vx * vx + vz * vz, t = (dx * vx + dz * vz) / L2;
    if (t >= -0.02 && t <= 1.02) { const lat = Math.abs(dx * vz - dz * vx) / Math.sqrt(L2); if (lat < 0.65) { const tt = Math.max(0, Math.min(1, t)); y = Math.max(y, SBa.y + (SBb.y - SBa.y) * tt + 0.04); } } }
  { const dx = x - DKx, dz = z - DKz, ax = dx * DKdx + dz * DKdz, lat = dx * DKdz - dz * DKdx; if (ax > -0.5 && ax < 2.2 && Math.abs(lat) < 1.0) y = Math.max(y, DKy + 0.02); }
  return y;
}

/* ---------- walk grid ---------- */
const WX0 = -22, WZ0 = -12, WS = 0.5, WNX = 112, WNZ = 84;
const OB = window.__obst || [];
function declutter(x, z, r) { out.children.forEach(c => { if (c.isMesh && c.geometry.type === 'DodecahedronGeometry' && Math.hypot(c.position.x - x, c.position.z - z) < r) c.visible = false; }); (window.__trees || []).forEach(t => { if (Math.hypot(t.g.position.x - x, t.g.position.z - z) < r) { t.g.visible = false; t.gone = true; for (let k = OB.length - 1; k >= 0; k--) if (Math.hypot(OB[k].x - t.g.position.x, OB[k].z - t.g.position.z) < 0.01) OB.splice(k, 1); } }); }
[[-4.25, 6.5, 0.55], [0.3, 9.5, 1.2], [-2.5, 7.3, 0.9], [-2.4, 10.8, 1.6], [-4.7, 14.9, 0.7], [-4.0, 15.05, 0.5], [-3.8, 10.6, 0.8], [-4.2, 15.1, 0.8], [SBa.x + 0.9, SBa.z, 1.9], [...rimPt(-0.33, 2.0), 1.4], [14.7, -1.4, 0.9], [CHIME1[0], CHIME1[1], 1.7], [HORN1[0], HORN1[1], 1.5], [LAMP1[0], LAMP1[1], 1.0], [15.8, -5.9, 0.5], [-4.7, 5.8, 0.45], [-1.0, 5.7, 0.45], [15.72, -1.68, 0.4], [8.12, -2.71, 0.4], [6.2, -2.68, 0.4]].forEach(a => declutter(...a)); // v10: trees that stood between the camera and the echo boulder, the crane and the third lantern
// nothing may grow or lie on the bell pavilion's stage
out.children.forEach(c => { const p = c.position; if (p.x > PF.x0 - 0.15 && p.x < PF.x1 + 0.6 && p.z > PF.z0 - 0.6 && p.z < PF.z1 + 0.6 && p.y > PF.y - 2.5 && p.y < PF.y + 2.5 && (c.isMesh || c.isGroup) && c !== window.__bell) { c.visible = false; const t = (window.__trees || []).find(q => q.g === c); if (t) t.gone = true; for (let k = OB.length - 1; k >= 0; k--) if (Math.hypot(OB[k].x - p.x, OB[k].z - p.z) < 0.01) OB.splice(k, 1); } });
{ const seg = (ax, az, bx, bz, r) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.35)); for (let k = 0; k <= n; k++) OB.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, r }); };
  const loc = (px, pz, ry, lx, lz) => [px + lx * Math.cos(ry) + lz * Math.sin(ry), pz - lx * Math.sin(ry) + lz * Math.cos(ry)];
  out.children.forEach(c => { if (c.isMesh && c.visible && c.geometry && c.position.y > -1) { const t = c.geometry.type, pr = c.geometry.parameters || {}; const sc = Math.max(c.scale.x, c.scale.z);
    if (t === 'DodecahedronGeometry' && pr.radius * sc >= 0.3) OB.push({ x: c.position.x, z: c.position.z, r: pr.radius * sc * 0.95 });
    if (t === 'IcosahedronGeometry' && pr.radius >= 0.9) OB.push({ x: c.position.x, z: c.position.z, r: pr.radius * sc * 1.0 }); } });
  { const ry = CHIME1[2], a = [Math.cos(ry), -Math.sin(ry)]; seg(CHIME1[0] - a[0] * 1.1, CHIME1[1] - a[1] * 1.1, CHIME1[0] + a[0] * 1.1, CHIME1[1] + a[1] * 1.1, 0.3); }
  { const ry = 0.3, a = [Math.cos(ry), -Math.sin(ry)]; seg(6.4 - a[0] * 0.95, -2.4 - a[1] * 0.95, 6.4 + a[0] * 0.95, -2.4 + a[1] * 0.95, 0.3); }
  seg(HORN1[0], HORN1[1], HORN1[0] + Math.sin(HORN1[2]) * 1.15, HORN1[1] + Math.cos(HORN1[2]) * 1.15, 0.38); seg(3.6, -0.8, 3.6 + Math.sin(0.485) * 0.9, -0.8 + Math.cos(0.485) * 0.9, 0.35);
  OB.push({ x: 6.2, z: 0.4, r: 0.55 }); OB.push({ x: 14.6, z: -7.2, r: 0.85 }); OB.push({ x: 0.6, z: 21.8, r: 1.0 }); OB.push({ x: 1.3, z: 22.2, r: 0.7 });
  OB.push({ x: -1.5, z: 3.2, r: 0.8 }); [[17.3, -4.9], [18.1, -4.9], [17.3, -4.1], [17.7, -4.5]].forEach(([x, z]) => OB.push({ x, z, r: 0.65 }));
  { const [ax, az] = rimPt(-0.33, 2.0); OB.push({ x: ax, z: az, r: 0.3 }); OB.push({ x: ax + 0.4, z: az + 0.4, r: 0.25 }); } OB.push({ x: 9.8, z: -2.0, r: 0.3 }); { const cg = window.__cave; cg.updateMatrixWorld(true); const v = new THREE.Vector3(); window.__caveLumps.forEach(o => { o.updateMatrixWorld(true); const pa = o.geometry.attributes.position, pts = []; for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (v.y < 1.6 + 1.6) pts.push([v.x, v.z]); } if (!pts.length) return; // only the part a traveller could bump into (below head height)
      let cx = 0, cz = 0; pts.forEach(q => { cx += q[0]; cz += q[1]; }); cx /= pts.length; cz /= pts.length; let r = 0; pts.forEach(q => r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cz))); OB.push({ x: cx, z: cz, r: r * 0.92 }); });
    // the face itself: a row of blockers along its foot on both sides of the opening
    [[-1.9, 0.1], [-2.6, -0.1], [-1.4, 0.15], [1.9, 0.1], [2.6, -0.1], [1.4, 0.15], [0, -0.6]].forEach(([lx, lz]) => { v.set(lx, 0, lz).applyMatrix4(cg.matrixWorld); OB.push({ x: v.x, z: v.z, r: 0.45 }); }); } OB.push({ x: 10.2, z: -1.6, r: 0.25 });
  window.__lamps.forEach(l => OB.push({ x: l.x, z: l.z, r: 0.5 }));
  { const th = -0.62, [wx, wz] = rimPt(th, 0.9), ax = -Math.sin(th), az = Math.cos(th); seg(wx - ax * 0.6, wz - az * 0.6, wx + ax * 0.6, wz + az * 0.6, 0.35); }
  { const mx = -7.85, mz = 12.05, ry = -Math.atan2(1.1, 4.3); const a = loc(mx, mz, ry, -1.2, -2.1), b = loc(mx, mz, ry, 1.2, -2.1); seg(a[0], a[1], b[0], b[1], 0.75); const sh = loc(mx, mz, ry, 1.8, -3.4); OB.push({ x: sh[0], z: sh[1], r: 1.2 }); } }
const rawG = new Uint8Array((WNX + 1) * (WNZ + 1)), okG = new Uint8Array((WNX + 1) * (WNZ + 1)), slG = new Float32Array((WNX + 1) * (WNZ + 1));
const gi = (i, j) => i * (WNZ + 1) + j, cxw = (i) => WX0 + i * WS, czw = (j) => WZ0 + j * WS;
function rawWalk(x, z) {
  const h = yAt(x, z); if (h < -0.5) return [false, 0]; if (inHole(x, z, 0.8)) return [false, 0];
  const d = 0.6, sl = Math.hypot(H(x + d, z) - H(x - d, z), H(x, z + d) - H(x, z - d)) / (2 * d); if (sl > 0.95) return [false, sl];
  const [rd, bt] = riverDist(x, z); if (rd < 0.5 + bt * 0.13 + 0.45) return [false, sl];
  for (let k = 0; k < OB.length; k++) { const o = OB[k]; const dx = x - o.x; if (dx > 3 || dx < -3) continue; if (Math.hypot(dx, z - o.z) < o.r + 0.36) return [false, sl]; }
  return [true, sl];
}
for (let i = 0; i <= WNX; i++) for (let j = 0; j <= WNZ; j++) { const [ok, sl] = rawWalk(cxw(i), czw(j)); rawG[gi(i, j)] = ok ? 1 : 0; slG[gi(i, j)] = sl; }
for (let i = 1; i < WNX; i++) for (let j = 1; j < WNZ; j++) okG[gi(i, j)] = rawG[gi(i, j)];
const OBB = new Map(); OB.forEach(o => { const k0 = Math.floor((o.x - o.r - 1) / 2), k1 = Math.floor((o.x + o.r + 1) / 2), l0 = Math.floor((o.z - o.r - 1) / 2), l1 = Math.floor((o.z + o.r + 1) / 2); for (let a = k0; a <= k1; a++) for (let b = l0; b <= l1; b++) { const k = a * 1000 + b; if (!OBB.has(k)) OBB.set(k, []); OBB.get(k).push(o); } });
const obsClear = (x, z, m) => { const arr = OBB.get(Math.floor(x / 2) * 1000 + Math.floor(z / 2)); if (!arr) return true; for (const o of arr) if (Math.hypot(x - o.x, z - o.z) < o.r + m) return false; return true; };
const cellOf = (x, z) => [Math.round((x - WX0) / WS), Math.round((z - WZ0) / WS)];
const okCell = (i, j) => i > 0 && j > 0 && i < WNX && j < WNZ && okG[gi(i, j)] === 1;
const okAt = (x, z) => { const [i, j] = cellOf(x, z); return okCell(i, j); };
function nearestOk(x, z, maxR = 14) { const [ci, cj] = cellOf(x, z); if (okCell(ci, cj)) return [ci, cj, 0];
  let best = null, bd = 1e9; for (let r = 1; r <= maxR; r++) { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const i = ci + a, j = cj + b; if (!okCell(i, j)) continue; const d = Math.hypot(cxw(i) - x, czw(j) - z); if (d < bd) { bd = d; best = [i, j]; } } if (best && bd <= r * WS * 1.0 + 0.01) break; }
  return best ? [best[0], best[1], bd] : null; }
/* arch bridge as a graph link between its two banks */
const BP = []; for (let a = -2.3; a <= 2.31; a += 0.4) BP.push([BR.x + BR.ux * a, BR.z + BR.uz * a]);
const bridgeN = nearestOk(BP[0][0], BP[0][1]), bridgeS = nearestOk(BP[BP.length - 1][0], BP[BP.length - 1][1]);
const LINK = new Map(); if (bridgeN && bridgeS) { LINK.set(gi(bridgeN[0], bridgeN[1]), { to: gi(bridgeS[0], bridgeS[1]), pts: BP.map(p => [p[0], p[1]]), cost: 5 }); LINK.set(gi(bridgeS[0], bridgeS[1]), { to: gi(bridgeN[0], bridgeN[1]), pts: BP.slice().reverse().map(p => [p[0], p[1]]), cost: 5 }); }
class Heap { constructor() { this.a = []; } push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, t = a[0], l = a.pop(); if (a.length) { a[0] = l; let i = 0; for (;;) { let m = i; const c1 = 2 * i + 1, c2 = c1 + 1; if (c1 < a.length && a[c1][0] < a[m][0]) m = c1; if (c2 < a.length && a[c2][0] < a[m][0]) m = c2; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return t; } get n() { return this.a.length; } }
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function astar(sx, sz, gx, gz) {
  const s = nearestOk(sx, sz), g = nearestOk(gx, gz); if (!s || !g) return null;
  const N = (WNX + 1) * (WNZ + 1), G = new Float32Array(N).fill(1e9), P = new Int32Array(N).fill(-1), C = new Uint8Array(N), via = new Map();
  const S0 = gi(s[0], s[1]), G0 = gi(g[0], g[1]); G[S0] = 0; const hp = new Heap(); hp.push(0, S0);
  const hh = (idx) => { const i = (idx / (WNZ + 1)) | 0, j = idx % (WNZ + 1); return Math.hypot(i - g[0], j - g[1]) * WS; };
  while (hp.n) { const [, cur] = hp.pop(); if (C[cur]) continue; C[cur] = 1; if (cur === G0) break; const ci = (cur / (WNZ + 1)) | 0, cj = cur % (WNZ + 1);
    for (const [a, b] of DIRS) { const ni = ci + a, nj = cj + b; if (!okCell(ni, nj)) continue; if (a && b && (!okCell(ci + a, cj) || !okCell(ci, cj + b))) continue; const nx = gi(ni, nj); const c = G[cur] + (a && b ? 1.414 : 1) * WS * (1 + 2.2 * slG[nx]); if (c < G[nx]) { G[nx] = c; P[nx] = cur; via.delete(nx); hp.push(c + hh(nx), nx); } }
    const lk = LINK.get(cur); if (lk) { const c = G[cur] + lk.cost; if (c < G[lk.to]) { G[lk.to] = c; P[lk.to] = cur; via.set(lk.to, lk); hp.push(c + hh(lk.to), lk.to); } } }
  if (G[G0] >= 1e9) return null;
  const chain = []; for (let c = G0; c !== -1; c = P[c]) chain.push(c); chain.reverse();
  // build points; keep link polylines intact, string-pull the rest
  const segs = []; let cur = [];
  for (let k = 0; k < chain.length; k++) { const c = chain[k], i = (c / (WNZ + 1)) | 0, j = c % (WNZ + 1);
    if (k > 0 && via.has(c)) { segs.push({ pts: cur }); segs.push({ link: via.get(c).pts }); cur = []; }
    cur.push([cxw(i), czw(j)]); }
  segs.push({ pts: cur });
  const los = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 0.2); for (let k = 1; k < n; k++) { const t = k / n; const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; if (!okAt(x, z) || !obsClear(x, z, 0.3)) return false; } return true; };
  const pull = (pts) => { if (pts.length < 3) return pts; const o = [pts[0]]; let i = 0; while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i], pts[j])) j--; o.push(pts[j]); i = j; } return o; };
  const res = []; segs.forEach(sg => { (sg.link ? sg.link : pull(sg.pts)).forEach(p => res.push([p[0], p[1]])); });
  return res;
}
const plen = (pts) => { let L = 0; for (let k = 1; k < pts.length; k++) L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return L; };

/* ---------- spots: where the traveller stands, what he looks at ---------- */
const wl = SP[17]; const [W17x, W17z] = rimPt(-0.62, 0.9);
const lipP = SP[9].p, lookoutP = SP[4].p;
const STAND = {
  1: { p: [CHIME1[0] + Math.sin(CHIME1[2]) * 0.95, CHIME1[1] + Math.cos(CHIME1[2]) * 0.95], look: [CHIME1[0], CHIME1[1]] }, 2: { p: [HORN1[0] - Math.sin(HORN1[2]) * 0.6 + Math.cos(HORN1[2]) * 0.7, HORN1[1] - Math.cos(HORN1[2]) * 0.6 - Math.sin(HORN1[2]) * 0.7], look: [HORN1[0], HORN1[1]] }, 3: { p: [-2.9, 4.4], look: [-4.6, 3.4] },
  4: { deck: true, p: dk(0, 1.12), look: dk(0, 6) },
  5: { spire: true, p: [8.55, 12.62], look: [7.6, 12.6] },
  6: { p: [2.1, 21.8], look: [0.6, 21.8] }, 7: { p: [-7.06, 8.95], look: [-7.85, 11.6] },
  8: { bridge: true, p: [BR.x, BR.z], look: [BR.x + BR.lx * 3, BR.z + BR.lz * 3] },
  9: { p: [lipP[0], lipP[2]], look: [HC[0], HC[1]] }, 10: { p: [6.76, 1.22], look: [6.2, 0.4] }, 11: { p: [9.2, -1.4], look: [9.8, -2.0] },
  12: { p: [11.4, -6.4], look: [11.4, -8.4] }, 13: { p: [15.6, -7.9], look: [15.6, -9.2] }, 14: { p: [14.6, -5.9], look: [14.6, -7.2] },
  15: { p: [14.2, -5.3], look: [14.2, -4.0] }, 16: { p: [17.6, -7.5], look: [17.6, -9.1] },
  17: { p: [W17x + Math.cos(-0.62) * 1.3, W17z + Math.sin(-0.62) * 1.3], look: [HC[0], HC[1]] }
};
const SPOT_IDS = Object.keys(STAND).map(Number);
const BLURB = {
  1: '旅人敲了敲石磬，站著聽它的回聲。', 2: '旅人把耳朵湊近銅喇叭，聽見遠處的水聲被放大了。', 3: '旅人對著巨石的凹洞喊了一聲，回聲慢了一拍才回來。',
  4: '旅人在觀景平台坐下，看雲海慢慢流過。', 5: '旅人走過吊橋登上鐘樓，拉動撞木。大鐘的聲音一路滾過雲海。', 6: '風從岩壁的孔洞吹過，發出低低的嗚嗚聲。',
  7: '水車一圈一圈地轉，鋸子慢慢切開石塊。', 8: '旅人站在橋頂，看溪水一路流向瀑布。', 9: '旅人靠在欄繩旁，看水落進深淵。',
  10: '旅人蹲下來，用指尖摸石面上磨平的刻痕。', 11: '旅人看著纜車慢慢滑進遠處的霧裡。', 12: '洞口傳來很輕的嗡聲，像有人在深處哼歌。',
  13: '旅人輕敲聲壁，整面岩壁都跟著嗡了一下。', 14: '旅人摸了摸推車上的方石，還帶著涼意。', 15: '旅人抬頭看起重架，鐵鏈偶爾輕輕作響。',
  16: '旅人看著鋸切壁上排得整整齊齊的鑽孔。', 17: '旅人轉了轉絞盤，吊籠在霧裡晃了晃。'
};
const NAV = {}; // per-spot planned data
/* camera-facing occlusion test: is the standing traveller hidden behind a tree / prop from the fixed camera? */
const CAMDIR = new THREE.Vector3(Math.sin(Math.PI / 4) * Math.cos(31 * Math.PI / 180), Math.sin(31 * Math.PI / 180), Math.cos(Math.PI / 4) * Math.cos(31 * Math.PI / 180));
out.updateMatrixWorld(true);
const OCC = []; out.traverse(o => { if (!o.isMesh || (o.geometry.attributes.position.count > 50000) || (o.material && (o.material.transparent || o.material.blending === THREE.AdditiveBlending))) return; let v = true, q = o; while (q) { if (!q.visible) v = false; q = q.parent; } if (v) OCC.push(o); });
const RC = new THREE.Raycaster();
function occluder(x, z, y) { const gy = y === undefined ? groundY(x, z) : y; let first = null, n = 0; for (const hh of [0.3, 0.75, 1.2]) { RC.set(new THREE.Vector3(x, gy + hh, z), CAMDIR); RC.far = 16; const h = RC.intersectObjects(OCC, false).filter(k => k.distance > 0.5); if (h.length) { n++; if (!first) first = h[0]; } } if (first) first.n = n; return first; }
const COMP = new Uint8Array((WNX + 1) * (WNZ + 1)); { const s0 = nearestOk(...[0, 11]); const stack = []; const st0 = nearestOk(lipP[0], lipP[2]); stack.push(gi(st0[0], st0[1])); COMP[stack[0]] = 1;
  while (stack.length) { const c = stack.pop(), ci = (c / (WNZ + 1)) | 0, cj = c % (WNZ + 1); for (const [a, b] of DIRS) { const ni = ci + a, nj = cj + b; if (!okCell(ni, nj) || COMP[gi(ni, nj)]) continue; if (a && b && (!okCell(ci + a, cj) || !okCell(ci, cj + b))) continue; COMP[gi(ni, nj)] = 1; stack.push(gi(ni, nj)); } const lk = LINK.get(c); if (lk && !COMP[lk.to]) { COMP[lk.to] = 1; stack.push(lk.to); } } }
function bestStand(st) { const [ci, cj] = cellOf(st.p[0], st.p[1]); let best = null; const R = 5;
  for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const i = ci + a, j = cj + b; if (!okCell(i, j) || !COMP[gi(i, j)]) continue; const x = cxw(i), z = czw(j); const dl = Math.hypot(x - st.look[0], z - st.look[1]); if (dl > (st.maxLook || 3.6)) continue;
    const oc = occluder(x, z); const cost = Math.hypot(x - st.p[0], z - st.p[1]) + (oc ? 3 + 3 * oc.n : 0) + (dl < 0.9 ? 3 : 0); if (!best || cost < best.cost) best = { x, z, cost, oc }; }
  return best; }
SPOT_IDS.forEach(id => { const st = STAND[id]; let tgt = st.p, post = [], oc = null;
  if (st.deck) { const E = dk(0, -0.1); tgt = E; post = [E, dk(0.68, 0.15), dk(0.68, 1.2), dk(0, 1.12)]; }
  else if (st.spire) { tgt = [SBa.x + 0.7, SBa.z]; post = [[SBa.x, SBa.z], [SBb.x - 0.1, SBb.z], [8.55, 12.62]]; }
  else if (st.bridge) { post = [BP[1], [BR.x, BR.z]]; tgt = BP[0]; }
  else { const bs = bestStand(st); if (bs) { tgt = [bs.x, bs.z]; oc = bs.oc; st.chosen = [bs.x, bs.z]; } }
  const c = nearestOk(tgt[0], tgt[1]); NAV[id] = { cell: c, snap: c ? c[2] : 99, tgt: c ? [cxw(c[0]), czw(c[1])] : null, post, leave: post.length ? post.slice(0, -1).reverse() : [], occ: oc ? [+oc.point.x.toFixed(1), +oc.point.z.toFixed(1), oc.object.geometry.type] : null }; });

/* ---------- traveller ---------- */
/* same rig, proportions, colours and pose set as the traveller in 苔痕驛站 / 倒影湖畔 */
const TM = (c, e) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.95, metalness: 0, flatShading: true }, e || {}));
const TMAT = { wood: TM(0x7d624a), woodDark: TM(0x564436), paper: TM(0xe9e1cf), cloak: TM(0x3d4659), hat: TM(0xb49c70), skin: TM(0xe0d2c0, { flatShading: false }), pack: TM(0x8a6f55) };
const tmesh = (geo, m, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
const trav = new THREE.Group(); trav.scale.setScalar(1.15); out.add(trav);
const body = new THREE.Group(); trav.add(body);
const legGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.3, 5); legGeo.translate(0, -0.15, 0);
const legL = tmesh(legGeo, TMAT.woodDark, body, -0.07, 0.3, 0), legR = tmesh(legGeo, TMAT.woodDark, body, 0.07, 0.3, 0);
const upper = new THREE.Group(); upper.position.y = 0.3; body.add(upper);
const cloak = tmesh(new THREE.ConeGeometry(0.23, 0.6, 8), TMAT.cloak, upper, 0, 0.25, 0);
tmesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 7), TMAT.pack, upper, 0, 0.36, -0.15).rotation.z = Math.PI / 2;
const head = new THREE.Group(); head.position.y = 0.6; upper.add(head);
tmesh(new THREE.SphereGeometry(0.105, 12, 9), TMAT.skin, head); tmesh(new THREE.ConeGeometry(0.3, 0.13, 12), TMAT.hat, head, 0, 0.1, 0);
const armGeo = new THREE.CylinderGeometry(0.034, 0.03, 0.3, 5); armGeo.translate(0, -0.15, 0);
const armL = tmesh(armGeo, TMAT.cloak, upper, -0.13, 0.44, 0.02), armR = tmesh(armGeo, TMAT.cloak, upper, 0.13, 0.44, 0.02);
const staff = new THREE.Group(); staff.position.set(0.2, 0.25, 0.08); upper.add(staff);
tmesh(new THREE.CylinderGeometry(0.017, 0.02, 1.08, 5), TMAT.wood, staff, 0, 0.02, 0); tmesh(new THREE.BoxGeometry(0.02, 0.02, 0.14), TMAT.woodDark, staff, 0, 0.55, 0.06);
const travGlowMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.2, roughness: 1 });
const travLamp = tmesh(new THREE.BoxGeometry(0.075, 0.1, 0.075), travGlowMat, staff, 0, 0.46, 0.13); travLamp.castShadow = false;
const lantern = new THREE.PointLight(0xffb05a, 0.8, 3.2, 2); lantern.position.set(0, 0.46, 0.13); staff.add(lantern);
const haloTex = canvasTex(64, (g, s) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,220,160,1)'); r.addColorStop(0.35, 'rgba(255,180,100,0.35)'); r.addColorStop(1, 'rgba(255,160,80,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 })); lanternGlow.scale.set(0.8, 0.8, 1); lanternGlow.position.set(0, 0.46, 0.13); staff.add(lanternGlow);
const book = tmesh(new THREE.BoxGeometry(0.2, 0.025, 0.14), TMAT.paper, upper, 0, 0.1, 0.24); book.rotation.x = -0.4; book.visible = false;
const POSE = {
  idle: {}, walk: {}, inspect: { lean: 0.3, headX: 0.4, armL: -0.5 }, crouch: { hip: -0.2, legX: -0.9, lean: 0.45, headX: 0.35, armL: -0.8 },
  reach: { armL: -1.7, headX: -0.1 }, gaze: { headX: -0.32 }, look: { headX: 0.25 }, listen: { lean: 0.12, headX: 0.15, armL: -0.35 },
  sit: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3 }, sitGaze: { hip: -0.28, legX: -1.45, staffX: 0.2, staffZ: -0.6, armL: -0.3, headX: -0.3 },
  write: { hip: -0.28, legX: -1.45, headX: 0.5, armL: -0.9, book: 1, staffX: 0.2, staffZ: -0.6 }, light: { armL: -0.4, headX: -0.1 }, call: { headX: -0.2, lean: -0.08, armL: -1.2 }
};
const PKEYS = ['hip', 'legX', 'lean', 'headX', 'headY', 'armL', 'armLz', 'staffX', 'staffZ', 'book'];
const pose = {}; PKEYS.forEach(k => pose[k] = 0);
// what he does at each spot (moss-station pose names)
const SPOT_ANIM = { cv_look: 'gaze', cv_wall: 'listen', cv_stone: 'reach', 1: 'reach', 2: 'listen', 3: 'call', 4: 'sitGaze', 5: 'reach', 6: 'listen', 7: 'inspect', 8: 'look', 9: 'gaze', 10: 'crouch', 11: 'gaze', 12: 'listen', 13: 'reach', 14: 'inspect', 15: 'gaze', 16: 'gaze', 17: 'reach' };
const TR = { x: 0, z: 0, y: 0, hd: 0, mode: 'idle', path: [], wi: 0, spot: 0, leave: [], t: 0, dwell: 0, goal: null, phase: 0, sit: 0, lean: 0, recent: [], lit: 0, actId: 0, lampBusy: false, done: false };
const REACH = {};
function planTo(id, from) { // returns waypoint array from current position to the standing point of spot id (null if unreachable)
  const nv = NAV[id]; if (!nv || !nv.tgt) return null; const st = STAND[id];
  const start = from ? from : [TR.x, TR.z]; const pre = []; (TR.leave || []).forEach(p => pre.push([p[0], p[1]]));
  const sp = astar(pre.length ? pre[pre.length - 1][0] : start[0], pre.length ? pre[pre.length - 1][1] : start[1], nv.tgt[0], nv.tgt[1]); if (!sp) return null;
  return pre.concat(sp, nv.post.map(p => [p[0], p[1]])); }
function planToXZ(x, z) { const pre = []; (TR.leave || []).forEach(p => pre.push([p[0], p[1]])); const sp = astar(pre.length ? pre[pre.length - 1][0] : TR.x, pre.length ? pre[pre.length - 1][1] : TR.z, x, z); return sp ? pre.concat(sp) : null; }
function place(x, z) { TR.x = x; TR.z = z; TR.y = groundY(x, z); trav.position.set(x, TR.y, z); }
function say(t) { statusEl.textContent = t; opts.reportActivity?.(t); const c = document.getElementById('caveStatus'); if (c) c.textContent = t; }

/* ---------- lamps, sim clock, looks ---------- */
let speed = 6, sim = 0, playing = false, tAcc = 0, timeMode = 'auto', started = false;
// The prototype used 6x exploration as its reference. Normal exploration must not slow the traveller to one sixth.
const rate = () => Math.max(1, speed / 6);
const dueOf = (k) => (k + 1) * (PLANNED / 5); // k=0..4
const lampsDue = () => Math.min(5, Math.floor(sim / (PLANNED / 5) + 1e-6));
const LAMPNODE = window.__lamps.map(l => { const b = bestStand({ p: [l.x + 0.8, l.z + 0.8], look: [l.x, l.z], maxLook: 1.9 }); return { p: [b.x, b.z], look: [l.x, l.z], occ: !!b.oc }; });

/* ---------- looks: dawn / day / dusk / night ---------- */
const KF = [
  { sun: '#ffb98a', si: 1.5, hs: '#c0b0e0', hg: '#5a4e54', hi: 0.5, top: '#8f9fdc', bot: '#f7c8b0', exp: 0.74, lamp: 0.25, sp: [24, 5, -6] },
  { sun: '#ffeccb', si: 2.0, hs: '#a4b4e0', hg: '#4e4640', hi: 0.5, top: '#8fb2d8', bot: '#f2d2b4', exp: 0.76, lamp: 0, sp: [22, 12, -10] },
  { sun: '#ff935e', si: 1.6, hs: '#a58ec4', hg: '#4a3e46', hi: 0.45, top: '#5b5fa8', bot: '#f2a07c', exp: 0.75, lamp: 0.55, sp: [14, 5, -20] },
  { sun: '#7d92dc', si: 0.6, hs: '#3a4a8c', hg: '#1b1b30', hi: 0.6, top: '#10163f', bot: '#3b3a78', exp: 0.95, lamp: 1, sp: [-8, 15, -18] }];
const col = (h) => new THREE.Color(h);
const KPOS = [0, 0.2, 0.5, 0.68, 0.9], KIDX = [0, 1, 2, 3, 3];
function lookAt(p) { p = ((p % 1) + 1) % 1; let i = 0; for (let k = 0; k < KPOS.length; k++) if (p >= KPOS[k]) i = k; const j = (i + 1) % KPOS.length, p0 = KPOS[i], p1 = j === 0 ? 1 : KPOS[j], t = (p - p0) / (p1 - p0), s = t * t * (3 - 2 * t), a = KF[KIDX[i]], b = KF[KIDX[j]];
  const L = (x, y) => x + (y - x) * s, C2 = (x, y) => col(x).lerp(col(y), s);
  return { sun: C2(a.sun, b.sun), si: L(a.si, b.si), hs: C2(a.hs, b.hs), hg: C2(a.hg, b.hg), hi: L(a.hi, b.hi), top: C2(a.top, b.top), bot: C2(a.bot, b.bot), exp: L(a.exp, b.exp), lamp: L(a.lamp, b.lamp), sp: a.sp.map((v, k) => L(v, b.sp[k])) }; }
const MODEP = { dawn: 0.0, day: 0.2, dusk: 0.5, night: 0.78 };
let cur = lookAt(0.25), lookInit = false;
function applyLook(dt) { const p = timeMode === 'auto' ? (sim % DAYLEN) / DAYLEN : MODEP[timeMode]; const tg = lookAt(p);
  if (!lookInit) { cur = tg; lookInit = true; } else { const k = 1 - Math.exp(-dt * (timeMode === 'auto' ? 8 : 1.6)); const lerpC = (a, b) => a.lerp(b, k); lerpC(cur.sun, tg.sun); cur.si += (tg.si - cur.si) * k; lerpC(cur.hs, tg.hs); lerpC(cur.hg, tg.hg); cur.hi += (tg.hi - cur.hi) * k; lerpC(cur.top, tg.top); lerpC(cur.bot, tg.bot); cur.exp += (tg.exp - cur.exp) * k; cur.lamp += (tg.lamp - cur.lamp) * k; for (let q = 0; q < 3; q++) cur.sp[q] += (tg.sp[q] - cur.sp[q]) * k; }
  sun.color.copy(cur.sun); sun.intensity = cur.si; sun.position.set(...cur.sp); hemi.color.copy(cur.hs); hemi.groundColor.copy(cur.hg); hemi.intensity = cur.hi; renderer.toneMappingExposure = cur.exp;
  const bg = `linear-gradient(${'#' + cur.top.getHexString()}, ${'#' + cur.bot.getHexString()} 70%, ${'#' + cur.bot.getHexString()})`; if (bg !== applyLook.bg) { document.body.style.background = bg; applyLook.bg = bg; } }

/* ---------- shared GLSL ---------- */
const NOISE_GLSL = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }`;
const UV_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/* ---------- sound visuals: pressure waves in the air ----------
   A sound is a soft spherical shell expanding from its source: bright only at its silhouette (fresnel rim),
   faintly filled, cut by the ground it passes through, and it nudges motes of dust outward as it goes.
   Nothing glows when nothing is sounding. */
const SHELL_VS = `varying vec3 vN; varying float vWY; void main(){ vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position, 1.); vWY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHELL_FS = `varying vec3 vN; varying float vWY; uniform float uA, uCut; uniform vec3 uCol;
void main(){ if (vWY < uCut) discard; float f = 1. - abs(vN.z); float a = (pow(f, 5.0) * 1.1 + pow(f, 2.0) * 0.035) * uA; gl_FragColor = vec4(uCol * a, 1.); }`;
const SHELL_GEO = new THREE.SphereGeometry(1, 40, 22);
const shells = [];
function pulse(x, y, z, o = {}) { shells.push({ x, y, z, R: o.R || 2.5, r0: o.r0 || 0.15, dur: o.dur || 1.8, amp: o.amp === undefined ? 0.8 : o.amp, col: new THREE.Color(o.col || '#ffe6c2'), t: -(o.delay || 0), inward: !!o.inward, dust: o.dust === undefined ? 16 : o.dust, mesh: null, kicked: false, parent: o.parent || out, cut: o.cut === undefined ? -1e9 : o.cut }); }
// dust motes pushed outward by a passing wave
const DUST_N = 700, dust = { P: new Float32Array(DUST_N * 3), V: new Float32Array(DUST_N * 3), L: new Float32Array(DUST_N), A: new Float32Array(DUST_N), S: new Float32Array(DUST_N), k: 0 };
const DUST_VS = `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uPx; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = max(1.0, aSize * uPx); }`;
const DUST_FS = `varying float vA; uniform vec3 uColor; void main(){ float d = length(gl_PointCoord - 0.5); float a = 1. - smoothstep(0.1, 0.5, d); gl_FragColor = vec4(uColor * a * vA, 1.); }`;
const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dust.P, 3)); dustG.setAttribute('aAlpha', new THREE.BufferAttribute(dust.A, 1)); dustG.setAttribute('aSize', new THREE.BufferAttribute(dust.S, 1));
const dustM = new THREE.ShaderMaterial({ uniforms: { uPx: { value: 40 }, uColor: { value: new THREE.Color('#ffe9c8') } }, vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const dustPts = new THREE.Points(dustG, dustM); dustPts.frustumCulled = false; out.add(dustPts);
function kickDust(s, n) { for (let q = 0; q < n; q++) { const i = dust.k++ % DUST_N; const u = Math.random() * 2 - 1, a = Math.random() * 6.283, sq = Math.sqrt(1 - u * u), dx = sq * Math.cos(a), dy = Math.abs(u) * 0.8 + 0.1, dz = sq * Math.sin(a); const r = s.r0 + 0.2;
  dust.P.set([s.x + dx * r, s.y + dy * r, s.z + dz * r], i * 3); const sp = (s.R / s.dur) * (0.45 + Math.random() * 0.4); dust.V.set([dx * sp, dy * sp * 0.6, dz * sp], i * 3); dust.L[i] = 1; dust.S[i] = 0.04 + Math.random() * 0.04; } }
function updateSound(dt) {
  for (let i = shells.length - 1; i >= 0; i--) { const s = shells[i]; s.t += dt; if (s.t < 0) continue;
    if (!s.mesh) { s.mesh = new THREE.Mesh(SHELL_GEO, new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uCol: { value: s.col }, uCut: { value: s.cut } }, vertexShader: SHELL_VS, fragmentShader: SHELL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.mesh.renderOrder = 5; s.mesh.position.set(s.x, s.y, s.z); s.parent.add(s.mesh); }
    const u = s.t / s.dur; if (u >= 1) { s.parent.remove(s.mesh); s.mesh.material.dispose(); shells.splice(i, 1); continue; }
    const e = 1 - Math.pow(1 - u, 2.2), r = s.inward ? s.R - (s.R - s.r0) * e : s.r0 + (s.R - s.r0) * e;
    s.mesh.scale.setScalar(r); s.mesh.material.uniforms.uA.value = s.amp * (s.inward ? Math.sin(Math.PI * u) : Math.min(1, u * 12) * Math.pow(1 - u, 1.6)) * (1 + 0.5 * cur.lamp);
    if (!s.kicked && !s.inward && u > 0.05) { s.kicked = true; kickDust(s, s.dust); } }
  for (let i = 0; i < DUST_N; i++) { if (dust.L[i] <= 0) { dust.A[i] = 0; continue; } dust.L[i] -= dt / 1.4; const j = i * 3; const f = Math.max(0, 1 - 1.6 * dt); dust.V[j] *= f; dust.V[j + 1] *= f; dust.V[j + 2] *= f;
    dust.P[j] += dust.V[j] * dt; dust.P[j + 1] += dust.V[j + 1] * dt + 0.05 * dt; dust.P[j + 2] += dust.V[j + 2] * dt; dust.A[i] = Math.max(0, dust.L[i]) * Math.min(1, (1 - dust.L[i]) * 6) * (0.7 + 0.3 * cur.lamp); }
  dustG.attributes.position.needsUpdate = true; dustG.attributes.aAlpha.needsUpdate = true; dustG.attributes.aSize.needsUpdate = true;
  dustM.uniforms.uPx.value = renderer.domElement.height / ((cam.top - cam.bottom) / cam.zoom);
  // the hidden stone in the cave hums: a slow, faint, cool breath of sound from the mouth every few seconds
  updateSound.cave = (updateSound.cave || 2) - dt; if (updateSound.cave <= 0) { updateSound.cave = 6.5 + Math.random() * 2;
    if (caveLure && !caveCalling && tAcc - caveLure.at > 4 && !inCave && backend('mouth')) { caveCalling = true;sound('mouthEcho',{echo:caveLure.kind});const E = CAVE.ECHO[caveLure.kind]; pulse(CAVE_MOUTH[0], CAVE_MOUTH[1], CAVE_MOUTH[2], { R: 4.2, dur: 3.6, amp: 0.5, col: '#ffe4bf', dust: 10 }); pulse(CAVE_MOUTH[0], CAVE_MOUTH[1], CAVE_MOUTH[2], { R: 3.4, r0: 0.3, dur: 2.6, amp: 0.3, delay: 1.0, col: '#c4e2ff', dust: 0 }); if (TR.mode !== 'light') say(`共鳴洞的洞口傳出一聲回音，像剛才的${E.name}。`); }
    else pulse(CAVE_MOUTH[0], CAVE_MOUTH[1], CAVE_MOUTH[2], { R: 3.2, dur: 3.4, amp: 0.32, col: '#c4e2ff', dust: 8 }); }
}
// where things sound from
const CAVE_MOUTH = [11.4, 2.6, -7.5];
const SOURCES = [{ x: CHIME1[0], y: H(CHIME1[0], CHIME1[1]) + 1.3, z: CHIME1[1] }, { x: 7.6, y: STAGE.y + 2.5, z: 9.6 }, { x: 1.3, y: H(0.6, 21.8) + 1.5, z: 22.4 }, { x: 15.5, y: 3.1, z: -8.9 }, { x: CAVE_MOUTH[0], y: CAVE_MOUTH[1], z: CAVE_MOUTH[2] }];
(window.__rings || []).forEach(r => r.m.visible = false); // the old flat ring decals are gone
function ringWave(x, z, rad = 2.6, k = 1) { let b = SOURCES[0], bd = 1e9; SOURCES.forEach(s => { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; b = s; } }); pulse(b.x, b.y, b.z, { R: rad * 1.25 + 0.6, amp: 0.75 * k, dur: 1.6 + rad * 0.15 }); }
function echoRing(x, y, z, n = 1, size = 2.4, delay = 0, amp = 1) { for (let k = 0; k < n; k++) pulse(x, y, z, { R: size, amp: amp * (1 - k * 0.25), delay: delay + k * 0.4, dur: 1.5 }); }
const worldHorn = (hx, hz, ry, s) => [hx + Math.sin(ry) * 1.05 * s, H(hx, hz) + 1.35 * s, hz + Math.cos(ry) * 1.05 * s];
/* 聽回音 pacing: at most one visit per exploration; only after he has made a sound this exploration; never in the first 5 minutes,
   never after the five lamps (resting), and only when the next lamp is far enough away for the whole visit (~3 min of focus) plus the walk to it. */
const VISIT_EFF = 200; // effective seconds a visit takes (walk in 11 units, listen ~7 s, walk out), measured on the focus clock
let caveLure = null, caveCalling = false, caveVisits = 0, fade = null;
function lampFromMouthEff(){const k=Math.min(4,Math.floor(sim/600)),saved={x:TR.x,z:TR.z,leave:TR.leave};const p=caveAxis(1);TR.x=p[0];TR.z=p[1];TR.leave=[];const route=planToXZ(...LAMPNODE[k].p);Object.assign(TR,saved);return route?plen(route)/V_WALK*speed/rate()+13.2:Infinity;}
function budget(walkEff=0){return {now:sim,walkToMouth:walkEff,walkToLamp:lampFromMouthEff(),resting:TR.done||TR.lit>=5};}
function caveOK(walkEff=0){return !inCave&&!pendingEvent&&!!backend('fits',budget(walkEff));}
const SOUND_OF = { 1: 'chime', 3: 'echo', 5: 'bell', 6: 'wind', 13: 'wall' };
let swayChime = 0, bellSwing = 0, bellStrikes = 0, bellCool = 0, windSim = 0, wind = 0, windFirst = true, gondolaBoost = 0, cageBoost = 0;
function actFx(id) {
  const cue={1:'chime',3:'clap',6:'windRock',13:'wall',14:'cart',15:'crane',17:'winch'}[id];if(cue)sound(cue);
  const S0 = SOURCES[0]; if(SOUND_OF[id] && !caveCalling && caveVisits<1){backend('sound',{kind:SOUND_OF[id]});caveLure={kind:SOUND_OF[id],at:tAcc};}
  switch (id) {
    case 1: swayChime = 1; pulse(S0.x, S0.y, S0.z, { R: 2.6, amp: 0.85, delay: 0.15 }); pulse(S0.x, S0.y, S0.z, { R: 3.4, amp: 0.55, delay: 1.25, col: '#cfe6ff', dur: 2.2 }); break; // one strike, two notes come back
    case 2: { const h = worldHorn(HORN1[0], HORN1[1], HORN1[2], 1.15); pulse(h[0], h[1], h[2], { R: 4.5, r0: 3.5, inward: true, amp: 0.5, dur: 1.6, col: '#cfe6ff', dust: 0 }); break; } // far sounds gathered into the horn
    case 3: pulse(-3.6, H(-4.6, 3.4) + 1.0, 3.9, { R: 2.4, amp: 0.8, delay: 0.3 }); pulse(-3.6, H(-4.6, 3.4) + 1.0, 3.9, { R: 3.2, r0: 0.3, inward: true, amp: 0.55, delay: 1.5, dur: 1.4, col: '#cfe6ff', dust: 0 }); break; // the echo comes back a beat late
    case 5: BELL.pull(); bellSwing = 0.5; break;
    case 6: ringWave(1.3, 22.4, 2.4, 1.2); break;
    case 11: gondolaBoost = 1; break;
    case 12: pulse(CAVE_MOUTH[0], CAVE_MOUTH[1], CAVE_MOUTH[2], { R: 3.6, amp: 0.55, dur: 3.0, col: '#c4e2ff' }); break;
    case 13: ringWave(15.5, -9.15, 2.4, 1.2); break;
    case 14: pulse(14.6, 2.6, -7.2, { R: 1.6, amp: 0.6 }); break;
    case 17: cageBoost = 1; break;
  } }

const caveAir = []; for (let k = 0; k < 4; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#dfe8f2', transparent: true, opacity: 0, depthWrite: false })); out.add(sp); caveAir.push({ sp, ph: k / 4 }); }
const caveGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#7fc4ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); caveGlow.position.set(11.16, 2.35, -8.5); caveGlow.scale.set(1.1, 1.1, 1); out.add(caveGlow);
function updateCave() { caveAir.forEach(c => { const u = ((tAcc / 9) + c.ph) % 1; c.sp.position.set(11.4 + Math.sin(c.ph * 9 + tAcc * 0.2) * 0.4, 1.8 + u * 0.45, -7.4 + u * 2.0); const s = 0.9 + u * 2.2; c.sp.scale.set(s * 1.5, s * 0.55, 1); c.sp.material.opacity = 0.16 * Math.sin(Math.PI * u) * (0.6 + 0.4 * cur.lamp); });
  caveGlow.material.opacity = (0.18 + 0.4 * cur.lamp) * (0.65 + 0.35 * Math.sin(tAcc * 0.9)); }
/* ---------- 懸崖鐘樓: a temple bell pavilion on a stilted wooden stage (懸造) built out from the spire over the abyss ----------
   Railed deck, steps up from the rope bridge, a heavy tiled roof on four pillars, the great bell under it, and a hanging
   log (撞木) on the camera side. The stilts run down the cliff into the cloud sea. When the log strikes, one great wave of
   sound crosses the whole pit, rolls the cloud sea and lifts the birds. */
const BELL = (() => {
  const wood = M('#5c4535'), woodL = M('#7a5d47'), lacq = M('#8a4e38'), plank = M('#8d735c'), tile = new THREE.MeshStandardMaterial({ color: '#3e434b', roughness: 0.85, flatShading: true }), stone = M('#8e8a85');
  const bronze = new THREE.MeshStandardMaterial({ color: '#5a6452', roughness: 0.5, metalness: 0.55 }), bronzeD = new THREE.MeshStandardMaterial({ color: '#46503f', roughness: 0.55, metalness: 0.5 });
  const g = new THREE.Group(); out.add(g); const Y = PF.y;
  const W = PF.x1 - PF.x0, D = PF.z1 - PF.z0, cx = (PF.x0 + PF.x1) / 2, cz = (PF.z0 + PF.z1) / 2;
  // deck: planks on a perimeter frame
  box(g, W, 0.12, D, plank, cx, Y, cz); for (let k = 1; k < 16; k++) box(g, 0.02, 0.005, D - 0.1, wood, PF.x0 + k * W / 16, Y + 0.062, cz, { cast: false });
  box(g, W + 0.1, 0.22, 0.24, wood, cx, Y - 0.16, PF.z0); box(g, W + 0.1, 0.22, 0.24, wood, cx, Y - 0.16, PF.z1); box(g, 0.24, 0.22, D, wood, PF.x0, Y - 0.16, cz); box(g, 0.24, 0.22, D, wood, PF.x1, Y - 0.16, cz);
  // stilts down the cliff into the clouds, tied with horizontal beams (nuki)
  const xs = [PF.x0 + 0.2, 6.3, 8.0, 9.7, PF.x1 - 0.2], zs = [PF.z0 + 0.2, 8.7, 10.5, PF.z1 - 0.2], BOT = -17, LV = [Y - 1.6, -2.6, -5.6, -8.6, -11.6];
  xs.forEach(x => zs.forEach(z => { const L = Y - 0.2 - BOT; cyl(g, 0.16, 0.2, L, 7, wood, x, BOT + L / 2, z); }));
  LV.forEach(yy => { for (let i = 0; i < xs.length - 1; i++) zs.forEach(z => box(g, xs[i + 1] - xs[i] + 0.3, 0.18, 0.15, woodL, (xs[i] + xs[i + 1]) / 2, yy, z)); xs.forEach(x => { for (let j = 0; j < zs.length - 1; j++) box(g, 0.15, 0.18, zs[j + 1] - zs[j] + 0.3, woodL, x, yy, (zs[j] + zs[j + 1]) / 2); }); });
  // diagonal braces on the outer faces between the first tie levels (the stage's stiffness)
  const brace = (A, B) => { const d = new THREE.Vector3().subVectors(B, A), L = d.length(); const m = add(g, new THREE.BoxGeometry(0.1, L, 0.1), wood, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
  for (let l = 0; l < 3; l++) { const y0 = LV[l], y1 = LV[l + 1]; for (let i = 0; i < xs.length - 1; i++) [zs[0], zs[zs.length - 1]].forEach(z => brace(new THREE.Vector3(xs[i], (l + i) % 2 ? y0 : y1, z), new THREE.Vector3(xs[i + 1], (l + i) % 2 ? y1 : y0, z)));
    for (let j = 0; j < zs.length - 1; j++) [xs[0], xs[xs.length - 1]].forEach(x => brace(new THREE.Vector3(x, (l + j) % 2 ? y0 : y1, zs[j]), new THREE.Vector3(x, (l + j) % 2 ? y1 : y0, zs[j + 1]))); }
  // railing (faded red lacquer) with a gap where the steps come up from the bridge
  const rail = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 0.8)), ry = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; box(g, 0.12, 0.75, 0.12, lacq, x, Y + 0.42, z); box(g, 0.16, 0.07, 0.16, wood, x, Y + 0.82, z); }
    [0.78, 0.4].forEach(h => { const m = box(g, 0.07, 0.07, L, h > 0.5 ? lacq : woodL, (ax + bx) / 2, Y + h, (az + bz) / 2); m.rotation.y = ry; }); };
  const SZ = 10.36; rail(PF.x0, PF.z0, PF.x1, PF.z0); rail(PF.x1, PF.z0, PF.x1, PF.bz - 0.7); rail(PF.x1, PF.bz + 0.7, PF.x1, PF.z1); rail(PF.x0, PF.z1, PF.x1, PF.z1); rail(PF.x0, PF.z0, PF.x0, PF.z1);
  // the approach: a railed timber bridge from the east rim, carried on two-legged bents that go down into the abyss like the stage
  { const L = SBa.x - SBb.x, yAtB = x => SBb.y + (SBa.y - SBb.y) * (x - SBb.x) / L - 0.06, BZ = PF.bz;
    for (let x = SBb.x + 0.15; x < SBa.x; x += 0.3) box(g, 0.26, 0.08, 1.3, plank, x, yAtB(x), BZ);
    [-0.68, 0.68].forEach(o => { box(g, L, 0.18, 0.16, wood, SBb.x + L / 2, yAtB(SBb.x + L / 2) - 0.12, BZ + o).rotation.z = Math.atan2(SBa.y - SBb.y, L);
      for (let x = SBb.x + 0.5; x < SBa.x - 0.2; x += 1.0) { box(g, 0.11, 0.75, 0.11, lacq, x, yAtB(x) + 0.42, BZ + o); }
      const r = box(g, L, 0.07, 0.07, lacq, SBb.x + L / 2, yAtB(SBb.x + L / 2) + 0.78, BZ + o); r.rotation.z = Math.atan2(SBa.y - SBb.y, L); });
    for (let x = SBb.x + 2.8; x < SBa.x - 1.2; x += 2.8) { if (!inHole(x, BZ, 0.3)) continue; const top = yAtB(x) - 0.2;
      [-0.6, 0.6].forEach(o => cyl(g, 0.14, 0.18, top + 17, 7, wood, x, (top - 17) / 2, BZ + o)); box(g, 0.18, 0.2, 1.5, woodL, x, top - 0.05, BZ);
      [-2.6, -5.6, -8.6, -11.6].forEach(yy => box(g, 0.15, 0.16, 1.5, woodL, x, yy, BZ)); [[top - 0.1, -2.6], [-2.6, -5.6], [-5.6, -8.6]].forEach(([y0, y1], k) => brace(new THREE.Vector3(x, k % 2 ? y0 : y1, BZ - 0.6), new THREE.Vector3(x, k % 2 ? y1 : y0, BZ + 0.6))); } }
  // the pavilion: four pillars on stone bases, tie beams, bracket blocks, a heavy hip roof with lifted eaves
  const P = new THREE.Vector3(7.6, Y, 9.6), PH = 4.3, Q = 1.75;
  [[-Q, -Q], [Q, -Q], [-Q, Q], [Q, Q]].forEach(([a, b]) => { cyl(g, 0.17, 0.19, PH, 10, lacq, P.x + a, Y + PH / 2, P.z + b); cyl(g, 0.3, 0.32, 0.18, 10, stone, P.x + a, Y + 0.12, P.z + b); });
  [-Q, Q].forEach(b => { box(g, 2 * Q + 0.5, 0.26, 0.22, wood, P.x, Y + PH - 0.2, P.z + b); box(g, 0.22, 0.26, 2 * Q + 0.5, wood, P.x + b, Y + PH - 0.2, P.z); box(g, 2 * Q + 0.2, 0.12, 0.18, wood, P.x, Y + PH - 1.0, P.z + b); box(g, 0.18, 0.12, 2 * Q + 0.2, wood, P.x + b, Y + PH - 1.0, P.z); });
  box(g, 0.3, 0.3, 2 * Q + 0.6, wood, P.x, Y + PH + 0.3, P.z); // the beam the bell hangs from
  // ---- the roof (v9): a curved 入母屋 (hip-and-gable) roof in the manner of a temple bell tower ----
  // lower hipped skirt with a concave sweep and lifted corners (反り・起り), a steep gable roof above it with carved bargeboards (破風)
  // and a hanging ornament (懸魚), a heavy ridge with 鬼瓦 at both ends, four corner ridges, tile ribs, two rows of rafter ends,
  // bracket sets (斗栱) on every pillar and a purlin ring under the eaves. Low-poly, flat-shaded, built to read from 45°/31°.
  { const B = Y + PH, cxr = P.x, czr = P.z;
    const tileM = new THREE.MeshStandardMaterial({ color: '#3f454e', roughness: 0.8, flatShading: true }), ribM = new THREE.MeshStandardMaterial({ color: '#555c66', roughness: 0.75, flatShading: true });
    const ridgeM = new THREE.MeshStandardMaterial({ color: '#2d3239', roughness: 0.8, flatShading: true }), soffM = M('#5a4232'), fasM = M('#4a3427'), rafM = M('#d8ccb2'), plasterM = M('#e4dac8'), frameM = M('#4f3a2b'), gegyoM = new THREE.MeshStandardMaterial({ color: '#b39257', roughness: 0.5, metalness: 0.5, flatShading: true });
    const E = 3.15, EXT = 0.07, LIFT = 0.52, y0 = B + 0.95, FAS = 0.2, I = 1.45, y1 = y0 + 1.2, yr = y1 + 1.38, OV = 0.42, UZ0 = I + 0.24, uy0 = y1 - 0.12;
    const rot = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
    const SK = (side, t, v) => { const a = side * Math.PI / 2, at = Math.abs(t), e = 1 + EXT * Math.pow(at, 4), ox = t * E * e, oz = E * e, ix = t * I, iz = I;
      const hx = ox + (ix - ox) * v, hz = oz + (iz - oz) * v, yo = y0 + LIFT * Math.pow(at, 3.5), y = yo + (y1 - yo) * Math.pow(v, 1.6); const [rx, rz] = rot(hx, hz, a); return [cxr + rx, y, czr + rz]; };
    const UP = (sz, x, w) => [cxr + x, uy0 + (yr - uy0) * Math.pow(w, 1.4), czr + sz * UZ0 * (1 - w)];
    function sheet(fn, nu, nv, mat, up, cast = true) { const P3 = []; for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = fn(i / nu, j / nv), b = fn((i + 1) / nu, j / nv), c = fn(i / nu, (j + 1) / nv), d = fn((i + 1) / nu, (j + 1) / nv);
        for (const [p, q, r] of [[a, b, c], [b, d, c]]) { const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2]; const ny = uz * vx - ux * vz; if ((ny > 0) !== up) P3.push(...p, ...r, ...q); else P3.push(...p, ...q, ...r); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; }
    // strip between two polylines, facing `out(p)` (a point the face should look toward)
    function strip(A, Bp, mat, toward, cast = true) { const P3 = []; for (let i = 0; i < A.length - 1; i++) for (const [p, q, r] of [[A[i], A[i + 1], Bp[i]], [A[i + 1], Bp[i + 1], Bp[i]]]) {
        const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2]; const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], c = toward(p); if (n[0] * (c[0] - p[0]) + n[1] * (c[1] - p[1]) + n[2] * (c[2] - p[2]) < 0) P3.push(...p, ...r, ...q); else P3.push(...p, ...q, ...r); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; }
    const outward = p => [cxr + (p[0] - cxr) * 3, p[1], czr + (p[2] - czr) * 3];
    // skirt: tiles on top, a fascia band at the edge, a soffit underneath running in to the purlin
    for (let s = 0; s < 4; s++) {
      sheet((u, v) => SK(s, u * 2 - 1, v), 16, 6, tileM, true);
      const top = [], bot = []; for (let i = 0; i <= 24; i++) { const p = SK(s, i / 12 - 1, 0); top.push(p); bot.push([p[0], p[1] - FAS, p[2]]); } strip(top, bot, fasM, outward);
      const QI = Q + 0.6; sheet((u, w) => { const t = u * 2 - 1, p = SK(s, t, 0), a = s * Math.PI / 2, [ix, iz] = rot(t * QI, QI, a); return [p[0] + (cxr + ix - p[0]) * w, p[1] - FAS + (B + 1.0 - (p[1] - FAS)) * w, p[2] + (czr + iz - p[2]) * w]; }, 16, 2, soffM, false, false);
      // tile ribs (丸瓦): parallel lines from the eave up the slope, cut off where they meet the hips
      const ribG = []; for (let x = -E + 0.2; x < E - 0.1; x += 0.27) { const pts = []; for (let k = 0; k <= 12; k++) { const v = k / 12, hw = E * (1 - v) + I * v, t = x / hw; if (Math.abs(t) > 0.97) break; pts.push(SK(s, t, v)); } if (pts.length > 2) ribG.push(pts); }
      const RP = []; const a = s * Math.PI / 2, ax = Math.cos(a), az = -Math.sin(a);
      ribG.forEach(pts => { for (let k = 0; k < pts.length - 1; k++) { const p = pts[k], q = pts[k + 1]; const L = [p[0] - ax * 0.05, p[1] + 0.01, p[2] - az * 0.05], R2 = [p[0] + ax * 0.05, p[1] + 0.01, p[2] + az * 0.05], T = [p[0], p[1] + 0.06, p[2]];
          const L2 = [q[0] - ax * 0.05, q[1] + 0.01, q[2] - az * 0.05], R3 = [q[0] + ax * 0.05, q[1] + 0.01, q[2] + az * 0.05], T2 = [q[0], q[1] + 0.06, q[2]];
          RP.push(...L, ...T, ...L2, ...T, ...T2, ...L2, ...T, ...R2, ...T2, ...R2, ...R3, ...T2); } });
      if (RP.length) { const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(RP, 3)); rg.computeVertexNormals(); const rm = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: '#555c66', roughness: 0.75, flatShading: true, side: THREE.DoubleSide })); rm.receiveShadow = true; g.add(rm); } }
    // corner ridges (隅棟) down each hip, ending in a small upturned 鬼瓦
    const seg = (A, Bv, w, h, mat) => { const d = new THREE.Vector3(Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]), L = d.length(); const m = add(g, new THREE.BoxGeometry(w, h, L), mat, (A[0] + Bv[0]) / 2, (A[1] + Bv[1]) / 2, (A[2] + Bv[2]) / 2); m.lookAt(Bv[0], Bv[1], Bv[2]); return m; };
    for (let s = 0; s < 4; s++) { let prev = null; for (let k = 0; k <= 8; k++) { const v = 1 - k / 8, p = SK(s, 1, v); const q = [p[0], p[1] + 0.1, p[2]]; if (prev) seg(prev, q, 0.17, 0.15, ridgeM); prev = q; }
      const tip = SK(s, 1, 0), inn = SK(s, 1, 0.12); const o = add(g, new THREE.BoxGeometry(0.2, 0.34, 0.16), ridgeM, tip[0], tip[1] + 0.22, tip[2]); o.lookAt(inn[0], inn[1] + 0.22, inn[2]); o.rotateX(-0.35); }
    // the gable roof above: two steep tiled planes over a plaster gable, with a soffit underneath and a fascia at the foot
    [1, -1].forEach(sz => { sheet((u, w) => UP(sz, (u * 2 - 1) * (I + OV), w), 10, 6, tileM, true); sheet((u, w) => { const p = UP(sz, (u * 2 - 1) * (I + OV), w); return [p[0], p[1] - 0.12, p[2]]; }, 10, 6, soffM, false, false);
      const top = [], bot = []; for (let i = 0; i <= 10; i++) { const p = UP(sz, (i / 5 - 1) * (I + OV), 0); top.push(p); bot.push([p[0], p[1] - 0.14, p[2]]); } strip(top, bot, fasM, p => [p[0], p[1], p[2] + sz * 3]);
      const RP = []; for (let x = -(I + OV) + 0.18; x < I + OV - 0.1; x += 0.27) for (let k = 0; k < 8; k++) { const p = UP(sz, x, k / 8), q = UP(sz, x, (k + 1) / 8);
        const L = [p[0] - 0.05, p[1] + 0.01, p[2]], R2 = [p[0] + 0.05, p[1] + 0.01, p[2]], T = [p[0], p[1] + 0.06, p[2]], L2 = [q[0] - 0.05, q[1] + 0.01, q[2]], R3 = [q[0] + 0.05, q[1] + 0.01, q[2]], T2 = [q[0], q[1] + 0.06, q[2]];
        RP.push(...L, ...T, ...L2, ...T, ...T2, ...L2, ...T, ...R2, ...T2, ...R2, ...R3, ...T2); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(RP, 3)); rg.computeVertexNormals(); const rm = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: '#555c66', roughness: 0.75, flatShading: true, side: THREE.DoubleSide })); rm.receiveShadow = true; g.add(rm); });
    // gables (妻): plaster triangle with a dark timber frame, carved bargeboards that flare at the feet, and a 懸魚 under the apex
    const yu = z => uy0 - 0.12 + (yr - uy0) * Math.pow(Math.max(0, 1 - Math.abs(z) / UZ0), 1.4);
    [1, -1].forEach(sx => { const gx = cxr + sx * (I - 0.02), A = [], Bp = []; for (let i = 0; i <= 16; i++) { const z = -I + 2 * I * i / 16; A.push([gx, Math.max(y1, yu(z) - 0.02), czr + z]); Bp.push([gx, y1 - 0.02, czr + z]); }
      strip(A, Bp, plasterM, p => [p[0] + sx * 3, p[1], p[2]], false);
      box(g, 0.06, 0.12, 2 * I, frameM, gx + sx * 0.03, y1 + 0.06, czr); box(g, 0.06, yr - y1 - 0.15, 0.1, frameM, gx + sx * 0.03, (y1 + yr - 0.15) / 2, czr);
      [-0.55, 0.55].forEach(z => box(g, 0.05, Math.max(0.05, yu(z) - y1 - 0.06), 0.07, frameM, gx + sx * 0.03, (y1 + yu(z)) / 2, czr + z));
      box(g, 0.05, 0.08, 1.5, frameM, gx + sx * 0.03, y1 + (yr - y1) * 0.48, czr);
      // bargeboards
      const hx = cxr + sx * (I + OV + 0.04), top = [], bot = [], top2 = []; for (let i = 0; i <= 20; i++) { const u = i / 20 * 2 - 1, z = u * (UZ0 + 0.22), w = Math.max(0, 1 - Math.abs(z) / UZ0); let y = uy0 + (yr - uy0) * Math.pow(w, 1.4) + 0.06; if (Math.abs(z) > UZ0) y = uy0 + 0.06 - (Math.abs(z) - UZ0) * 0.25 + Math.pow((Math.abs(z) - UZ0) / 0.22, 2) * 0.12;
        top.push([hx, y, czr + z]); bot.push([hx, y - 0.24 - 0.06 * (1 - Math.abs(u)), czr + z]); top2.push([hx - sx * 0.1, y, czr + z]); }
      strip(top, bot, fasM, p => [p[0] + sx * 3, p[1], p[2]]); strip(top2, top, fasM, p => [p[0], p[1] + 3, p[2]]);
      const gg = new THREE.Group(); gg.position.set(hx + sx * 0.03, yr - 0.38, czr); gg.rotation.z = Math.PI / 2; g.add(gg);
      add(gg, new THREE.CylinderGeometry(0.2, 0.14, 0.05, 6), gegyoM, 0, 0, 0); add(gg, new THREE.CylinderGeometry(0.07, 0.07, 0.07, 8), gegyoM, 0, 0.02, 0);
      [-1, 1].forEach(k => { const f = add(gg, new THREE.BoxGeometry(0.06, 0.04, 0.22), gegyoM, 0.16, 0, k * 0.12); f.rotation.y = k * 0.6; }); });
    // ridge (大棟) with 鬼瓦 and small fins at both ends
    const RL = 2 * (I + OV) + 0.1; box(g, RL, 0.26, 0.34, ridgeM, cxr, yr + 0.07, czr); box(g, RL + 0.06, 0.1, 0.22, ridgeM, cxr, yr + 0.25, czr); box(g, RL - 0.2, 0.05, 0.4, ribM, cxr, yr - 0.04, czr);
    [1, -1].forEach(sx => { const ox = cxr + sx * (RL / 2 + 0.04); const o = box(g, 0.14, 0.56, 0.46, ridgeM, ox, yr + 0.2, czr); o.rotation.z = -sx * 0.12;
      [-1, 1].forEach(k => { const h = box(g, 0.1, 0.22, 0.08, ridgeM, ox - sx * 0.02, yr + 0.5, czr + k * 0.17); h.rotation.x = k * 0.5; h.rotation.z = -sx * 0.2; }); box(g, 0.12, 0.12, 0.18, gegyoM, ox + sx * 0.05, yr + 0.18, czr); });
    // purlin ring, ceiling, and bracket sets (斗栱): bearing block, crossed arms with small blocks, a second arm reaching out to the purlin
    const QI = Q + 0.6; [-1, 1].forEach(sd => { box(g, 2 * QI + 0.24, 0.2, 0.2, lacq, cxr, B + 0.82, czr + sd * QI); box(g, 0.2, 0.2, 2 * QI + 0.24, lacq, cxr + sd * QI, B + 0.82, czr); });
    box(g, 2 * QI + 0.1, 0.06, 2 * QI + 0.1, soffM, cxr, B + 1.0, czr, { cast: false });
    const bracket = (x, z, diag) => { box(g, 0.36, 0.16, 0.36, woodL, x, B + 0.08, z); box(g, 0.95, 0.13, 0.15, lacq, x, B + 0.23, z); box(g, 0.15, 0.13, 0.95, lacq, x, B + 0.23, z);
      [[0, 0], [0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]].forEach(([a, b]) => box(g, 0.17, 0.11, 0.17, woodL, x + a, B + 0.355, z + b));
      if (diag) { const dx = Math.sign(x - cxr), dz = Math.sign(z - czr), L2 = 0.85; const arm = box(g, 0.14, 0.13, L2 * 1.414, lacq, x + dx * 0.3, B + 0.48, z + dz * 0.3); arm.rotation.y = Math.atan2(dx, dz); box(g, 0.2, 0.12, 0.2, woodL, x + dx * 0.6, B + 0.6, z + dz * 0.6); }
      else { const dz = Math.sign(z - czr), dx = Math.sign(x - cxr); box(g, dz ? 0.14 : 0.75, 0.13, dz ? 0.75 : 0.14, lacq, x + dx * 0.3, B + 0.48, z + dz * 0.3); box(g, 0.2, 0.12, 0.2, woodL, x + dx * 0.6, B + 0.6, z + dz * 0.6); } };
    [[-Q, -Q], [Q, -Q], [-Q, Q], [Q, Q]].forEach(([a, b]) => bracket(cxr + a, czr + b, true));
    [[0, -Q], [0, Q], [-Q, 0], [Q, 0]].forEach(([a, b]) => { box(g, 0.32, 0.5, 0.32, woodL, cxr + a, B - 0.05, czr + b); bracket(cxr + a, czr + b, false); }); // 中備: a short strut on the head beam carries a middle set
    // rafter ends (垂木): two rows peeking out under the fascia, following the corner lift
    const rafGeo = new THREE.BoxGeometry(0.07, 0.07, 0.3), rafN = 4 * 2 * 26, raf = new THREE.InstancedMesh(rafGeo, rafM, rafN), _o = new THREE.Object3D(); let ri = 0;
    for (let s = 0; s < 4; s++) for (let row = 0; row < 2; row++) for (let k = 0; k < 26; k++) { const t = (k + 0.5) / 26 * 2 - 1, p = SK(s, t * 0.985, 0), q = SK(s, t * 0.985, 0.12); const back = row ? 0.3 : 0.08, drop = row ? 0.24 : 0.04;
      const dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz); _o.position.set(p[0] + dx / L * back, p[1] - FAS - drop, p[2] + dz / L * back); _o.lookAt(p[0] + dx / L * (back + 1), p[1] - FAS - drop + (row ? 0.25 : 0.18), p[2] + dz / L * (back + 1)); _o.updateMatrix(); raf.setMatrixAt(ri++, _o.matrix); }
    raf.count = ri; raf.castShadow = false; g.add(raf);
    // 風鐸: a small bronze bell hanging under each corner, swinging in the mountain wind
    window.__futaku = []; for (let s = 0; s < 4; s++) { const p = SK(s, 1, 0.02); const hb = new THREE.Group(); hb.position.set(p[0], p[1] - FAS - 0.02, p[2]); g.add(hb);
      cyl(hb, 0.008, 0.008, 0.22, 3, ironMat, 0, -0.11, 0, { cast: false }); add(hb, new THREE.CylinderGeometry(0.06, 0.1, 0.22, 8), bronze, 0, -0.32, 0); const pl = box(hb, 0.12, 0.16, 0.012, bronzeD, 0, -0.55, 0, { cast: false });
      window.__futaku.push({ hb, ph: s * 1.7 }); } }
  // two hanging lanterns at the front eave corners
  const lanterns = [[Q + 0.75, Q + 0.75], [-Q - 0.75, Q + 0.75]].map(([a, b]) => { const lm = new THREE.MeshStandardMaterial({ color: '#e9d9b8', emissive: '#ffb45e', emissiveIntensity: 0.3, roughness: 0.9 }); cyl(g, 0.006, 0.006, 1.25, 3, ropeMat, P.x + a, Y + PH + 0.2, P.z + b); const o = cyl(g, 0.15, 0.15, 0.36, 10, lm, P.x + a, Y + PH - 0.48, P.z + b, { cast: false }); const l = new THREE.PointLight(0xffb45e, 0, 4, 2); l.position.set(P.x + a, Y + PH - 0.5, P.z + b); g.add(l); return { lm, l }; });
  // the bell (梵鐘): dragon-head loop, cap, nipple panels, bands, lotus striking seats, flared lip
  const S = 1.0, bell = new THREE.Group(); bell.position.set(P.x, Y + PH + 0.15, P.z); bell.scale.setScalar(S); g.add(bell);
  const prof = [[0.001, 0], [0.75, 0], [1.08, -0.12], [1.2, -0.32], [1.22, -1.2], [1.27, -2.5], [1.34, -2.88], [1.4, -3.05], [1.3, -3.1], [1.18, -3.0], [1.14, -1.2], [1.1, -0.35], [0.001, -0.3]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), bronze); body.castShadow = true; body.receiveShadow = true; bell.add(body);
  const ring = (r, y, t) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 48), bronzeD); o.rotation.x = Math.PI / 2; o.position.y = y; bell.add(o); };
  ring(1.21, -0.38, 0.045); ring(1.23, -1.22, 0.05); ring(1.25, -1.95, 0.035); ring(1.29, -2.55, 0.05); ring(1.37, -2.95, 0.04);
  for (let q = 0; q < 4; q++) { const a0 = q * Math.PI / 2 + Math.PI / 4; const vb = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.06), bronzeD); vb.position.set(Math.cos(a0) * 1.22, -0.8, Math.sin(a0) * 1.22); vb.rotation.y = -a0; bell.add(vb);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const a = q * Math.PI / 2 + (c - 1) * 0.24; const n = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), bronzeD); n.position.set(Math.cos(a) * 1.23, -0.55 - r * 0.24, Math.sin(a) * 1.23); bell.add(n); } }
  [-1, 1].forEach(sg => { const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 16), bronzeD); seat.rotation.z = Math.PI / 2; seat.position.set(sg * 1.27, -2.2, 0); bell.add(seat); });
  { const loop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 20), bronzeD); loop.position.y = 0.12; bell.add(loop); }
  // the hanging log on the east (camera) side, on two ropes from a small gantry tied into the pavilion
  bell.rotation.y = Math.PI / 2; // striking seats face north/south
  const seatY = bell.position.y - 2.2 * S, R0 = 1.27 * S, GAP = 0.4, LOGL = 1.7, BY = Y + PH - 0.2, DROP = BY - seatY;
  const lgp = new THREE.Group(); lgp.position.set(P.x, 0, P.z); lgp.rotation.y = -Math.PI / 2; g.add(lgp); // local +x points south (+z)
  const GX = R0 + GAP + LOGL; [-0.55, 0.55].forEach(b => cyl(lgp, 0.11, 0.13, PH - 0.2, 8, wood, GX + 0.15, Y + (PH - 0.2) / 2, b)); box(lgp, 0.2, 0.2, 1.3, wood, GX + 0.15, BY, 0); box(lgp, GX + 0.15 - Q, 0.18, 0.18, wood, (GX + 0.15 + Q) / 2, BY, 0);
  const piv = new THREE.Group(); piv.position.set(R0 + GAP + LOGL / 2, BY, 0); lgp.add(piv);
  const log = new THREE.Group(); log.position.set(0, -DROP, 0); piv.add(log); cyl(log, 0.17, 0.17, LOGL, 10, woodL, 0, 0, 0, { rz: Math.PI / 2 });
  [-0.55, 0.55].forEach(px => cyl(piv, 0.016, 0.016, DROP, 4, ropeMat, px, -DROP / 2, 0)); cyl(log, 0.014, 0.014, 0.9, 4, ropeMat, LOGL / 2 - 0.05, -0.45, 0);
  const st = { th: 0, v: 0, sway: 0, swayV: 0, queue: 0, cool: 0, rung: 0, waveT: -99, waveC: new THREE.Vector3(P.x, seatY, P.z) };
  const HIT = Math.asin(GAP / DROP);
  function strike(k) { sound('bell',{strength:k});st.rung++; st.waveT = tAcc; const c = st.waveC;
    pulse(c.x, c.y, c.z, { R: 15 * k, dur: 4.6, amp: 0.6 * k, r0: 1.2, dust: 60, col: '#ffe4bf' }); pulse(c.x, c.y, c.z, { R: 22 * k, dur: 6.5, amp: 0.25 * k, r0: 1.2, delay: 0.35, dust: 0, col: '#d8e8ff' });
    st.swayV -= 0.06 * k; (window.__birds || []).forEach(b => b.boost = 1); }
  function update(dt) {
    advanceBellPendulum(st,dt,DROP,HIT,strike);
    if (wind > 0.4 && Math.random() < dt * 0.25) st.v += (Math.random() - 0.5) * 0.2;

    piv.rotation.z = st.th; // +th swings the log away (east), −th toward the bell
    st.swayV += (-2.2 * st.sway - 0.25 * st.swayV) * dt; st.sway += st.swayV * dt; bell.rotation.x = st.sway + Math.sin(tAcc * 0.6) * 0.004 * (1 + 3 * wind);
    (window.__futaku || []).forEach(f => { f.hb.rotation.x = Math.sin(tAcc * 1.3 + f.ph) * (0.03 + 0.28 * wind); f.hb.rotation.z = Math.sin(tAcc * 1.1 + f.ph * 2) * (0.02 + 0.2 * wind); });
    lanterns.forEach((L, i) => { const f = 1 + Math.sin(tAcc * 6.1 + i * 2) * 0.05; L.lm.emissiveIntensity = (0.3 + 1.3 * cur.lamp) * f; L.l.intensity = (0.15 + 1.1 * cur.lamp) * f; });
  }
  return { g, P, st, update, ring(n) { st.queue += n; }, pull() { sound('pull');st.queue = Math.max(st.queue, 1); }, stand: [P.x + 0.95, P.z + GX - 0.35] };
})();
if (window.__bell) window.__bell.visible = false; // the old small bell on the spire is retired
const collar = []; for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#f6ecdf', transparent: true, opacity: 0, depthWrite: false })); sp.position.set(8.1 + Math.cos(a) * 4.2, -6.8 + (k % 3) * 0.7, 9.6 + Math.sin(a) * 3.4); sp.scale.set(7.5, 2.6, 1); out.add(sp); collar.push({ sp, ph: k * 0.9, x: sp.position.x }); }
function updateCollar() { collar.forEach(c => { c.sp.position.x = c.x + Math.sin(tAcc * 0.07 + c.ph) * 0.8; c.sp.material.opacity = 0.5 * (0.8 + 0.2 * Math.sin(tAcc * 0.2 + c.ph)); }); }

// the cloud sea glows from beneath: a warm light under the clouds, luminous haze on top, stronger shafts
const underLight = new THREE.PointLight(0xffc690, 1.5, 26, 1.2); underLight.position.set(12, -7, 12); out.add(underLight);
const glowHaze = []; for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, r = 3 + (k % 3) * 2.2; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffd9a6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(12 + Math.cos(a) * r, -6.2 + (k % 2) * 0.8, 12 + Math.sin(a) * r); sp.scale.set(9, 3.2, 1); out.add(sp); glowHaze.push({ sp, ph: k * 0.7 }); }
function updateGlow() { const day = 1 - cur.lamp; underLight.intensity = 1.2 + 0.6 * cur.lamp; glowHaze.forEach(g => g.sp.material.opacity = (0.08 + 0.06 * cur.lamp) * (0.75 + 0.25 * Math.sin(tAcc * 0.25 + g.ph))); }
const LEAF_TREES = (window.__trees || []).filter(t => !t.gone && t.s > 0.6); const leafSpawn = () => { const t = LEAF_TREES[(Math.random() * LEAF_TREES.length) | 0]; const p = t.g.position; return { p: [p.x + R_(-0.6, 0.6) * t.s, p.y + R_(1.0, 1.9) * t.s, p.z + R_(-0.6, 0.6) * t.s], v: [R_(-0.15, 0.15) + wind * 0.9, -R_(0.25, 0.45), R_(-0.15, 0.15) + wind * 0.5], life: R_(3.5, 6), s0: R_(0.06, 0.09) }; };
const R_ = (a, b) => a + Math.random() * (b - a);
/* ---------- water: river flow, the great fall, droplets, spray, rainbow ---------- */
const FW = window.__fall, FALL_L = 9.6, fo = [-Math.cos(FALL_TH), -Math.sin(FALL_TH)], ft = [-Math.sin(FALL_TH), Math.cos(FALL_TH)];
function fallPt(u, drop, w, outOff, lat0 = 0, bow = 0.22) { const lat = lat0 + (u - 0.5) * w * (1 + 0.16 * drop / FALL_L), ou = outOff + 0.95 * Math.sqrt(Math.max(0, drop)) + bow * Math.sin(u * Math.PI) * (0.3 + drop / FALL_L);
  return [FW.fx + ft[0] * lat + fo[0] * ou, FW.fy - drop, FW.fz + ft[1] * lat + fo[1] * ou]; }
const CURTAIN_FS = NOISE_GLSL + `
varying vec2 vUv; uniform float uTime, uSpeed, uAlpha, uSeed; uniform vec3 uTint;
void main(){ float x = vUv.x, y = vUv.y; float fy = sqrt(y) * 2.6; float t = uTime * uSpeed;
  float n1 = vn(vec2(x * 15. + uSeed, fy * 5. - t * 2.3)), n2 = vn(vec2(x * 37. + uSeed * 2., fy * 11. - t * 3.6)), n3 = vn(vec2(x * 6. + uSeed * 3., fy * 2. - t * 1.3));
  float streak = smoothstep(0.3, 0.85, 0.5 * n1 + 0.35 * n2 + 0.25 * n3);
  float ew = 0.05 + 0.1 * vn(vec2(y * 5. - t * 1.6, uSeed)) + 0.12 * y; float edge = smoothstep(0., ew, x) * smoothstep(0., ew, 1. - x);
  float lace = smoothstep(0.3, 0.85, y);
  float a = (0.32 + 0.68 * streak) * edge; a *= mix(1., smoothstep(0.25, 0.75, n2 * 0.6 + n1 * 0.5), lace * 0.85); a *= 1. - smoothstep(0.62, 0.92, y);
  float crest = 1. - smoothstep(0., 0.07, y);
  float w = clamp(streak * 0.85 + crest * 0.8 + lace * 0.3, 0., 1.);
  vec3 c = mix(vec3(0.56, 0.75, 0.81), vec3(0.97, 0.99, 1.), w);
  gl_FragColor = vec4(c * mix(uTint, vec3(1.), w), a * uAlpha); }`; // night tint only on the blue body; white foam stays white
const curtains = [];
function curtain(w, outOff, lat0, alpha, speed, seed, cols = 22, rows = 40) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const u = i / cols, v = j / rows; pos.push(...fallPt(u, v * FALL_L, w, outOff, lat0)); uv.push(u, v); }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uSpeed: { value: speed }, uAlpha: { value: alpha }, uSeed: { value: seed }, uTint: { value: new THREE.Color(1, 1, 1) } }, vertexShader: UV_VS, fragmentShader: CURTAIN_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 2; mesh.frustumCulled = false; out.add(mesh); curtains.push(m); return mesh; }
curtain(3.5, -0.05, 0, 0.75, 0.95, 1.3); curtain(3.0, 0.14, 0.1, 0.95, 1.12, 4.7); curtain(1.7, 0.34, 0.55, 0.7, 1.3, 8.1); curtain(1.1, 0.42, -0.85, 0.6, 1.22, 2.9);
// Opaque backing behind the white sheets so the cliff and riverbed never show through their gaps.
// Blue only near the lip; as the water falls it aerates into white foam, so the lower fall reads as white spray.
// Stays opaque all the way down; only its last stretch, already inside the cloud sea, frays out.
const fallBacking=curtain(3.5,-0.10,0,1,0.95,1.3);
fallBacking.renderOrder=1;
fallBacking.material.transparent=false;
fallBacking.material.depthWrite=true;
fallBacking.material.fragmentShader=NOISE_GLSL+`
varying vec2 vUv; uniform float uTime; uniform vec3 uTint;
void main(){
  float x=vUv.x,y=vUv.y,t=uTime;
  float flow=vn(vec2(x*10.,y*18.-t*1.8));
  float churn=vn(vec2(x*13.+3.,y*9.-t*2.4))*0.6+vn(vec2(x*29.,y*22.-t*3.3)+7.)*0.4;
  vec3 blue=mix(vec3(0.27,0.46,0.52),vec3(0.42,0.62,0.66),0.3+0.35*flow);
  vec3 foam=mix(vec3(0.82,0.88,0.91),vec3(0.97,0.99,1.),smoothstep(0.3,0.75,churn));
  float aer=smoothstep(0.12,0.42,y+(churn-0.5)*0.12);
  if(churn<smoothstep(0.84,0.97,y)*1.05)discard;
  gl_FragColor=vec4(mix(blue*uTint,foam,aer),1.);
}`;
fallBacking.material.needsUpdate=true;

/* particles: droplets, spray and foam share one soft-point shader (sizes in world units, so they scale with the camera) */
const PT_VS = `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uPx;
void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = max(1.5, aSize * uPx); }`;
const PT_FS = `varying float vA; uniform vec3 uColor; uniform float uSoft;
void main(){ float d = length(gl_PointCoord - 0.5); float a = 1. - smoothstep(0.5 - uSoft, 0.5, d); if (a <= 0.01) discard; gl_FragColor = vec4(uColor, a * vA); }`;
const sprays = [];
class Spray {
  constructor(n, o) { this.n = n; this.o = o; this.base = new THREE.Color(o.color || '#ffffff'); this.P = new Float32Array(n * 3); this.S = new Float32Array(n); this.A = new Float32Array(n); this.v = new Float32Array(n * 3);
    this.age = new Float32Array(n); this.life = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.P, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.S, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.A, 1)); this.g = g;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uPx: { value: 40 }, uColor: { value: new THREE.Color(o.color || '#ffffff') }, uSoft: { value: o.soft === undefined ? 0.3 : o.soft } }, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = o.order || 3; out.add(this.pts);
    for (let i = 0; i < n; i++) { this.spawn(i); this.age[i] = Math.random() * this.life[i]; }
    for (let k = 0; k < 50; k++) this.update(0.05); sprays.push(this); }
  spawn(i) { const r = this.o.spawn(); this.P.set(r.p, i * 3); this.v.set(r.v, i * 3); this.life[i] = r.life; this.s0[i] = r.s0; this.s1[i] = r.s1 === undefined ? r.s0 : r.s1; this.age[i] = 0; }
  update(dt) { const o = this.o, gr = o.g || 0, f = Math.max(0, 1 - (o.drag || 0) * dt);
    for (let i = 0; i < this.n; i++) { this.age[i] += dt; if (this.age[i] >= this.life[i]) this.spawn(i); const j = i * 3;
      this.v[j + 1] -= gr * dt; this.v[j] *= f; this.v[j + 1] *= f; this.v[j + 2] *= f; this.P[j] += this.v[j] * dt; this.P[j + 1] += this.v[j + 1] * dt; this.P[j + 2] += this.v[j + 2] * dt;
      const u = this.age[i] / this.life[i]; this.S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * u; this.A[i] = o.alpha * (o.fade ? o.fade(u) : Math.sin(Math.PI * u)); }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aSize.needsUpdate = true; this.g.attributes.aAlpha.needsUpdate = true; } }

const PLUNGE = fallPt(0.5, 6.9, 3.0, 0.14, 0.1); // where the fall disappears into the cloud sea
// droplets peeling off the curtain edges and falling free
new Spray(240, { g: 7, alpha: 0.8, soft: 0.25, fade: u => Math.min(1, u * 8) * (1 - u), spawn: () => { const u = Math.random() < 0.65 ? (Math.random() < 0.5 ? R_(-0.05, 0.12) : R_(0.88, 1.05)) : Math.random(); const d0 = R_(0.1, 2.5);
  const p = fallPt(u, d0, 3.2, R_(0.2, 0.5), 0.1); const side = (u - 0.5) * 0.6; return { p, v: [fo[0] * R_(0.3, 0.8) + ft[0] * side, -R_(1.0, 3.0), fo[1] * R_(0.3, 0.8) + ft[1] * side], life: R_(1.3, 2.1), s0: R_(0.05, 0.09) }; } });
// white foam bursting off the lip
new Spray(120, { g: 4, drag: 0.6, alpha: 0.85, soft: 0.35, spawn: () => { const p = fallPt(Math.random(), R_(0.05, 0.35), 3.0, 0.3, 0.1); return { p, v: [fo[0] * R_(0.4, 1.2) + ft[0] * R_(-0.3, 0.3), R_(0.2, 0.9), fo[1] * R_(0.4, 1.2) + ft[1] * R_(-0.3, 0.3)], life: R_(0.5, 1.0), s0: R_(0.07, 0.14), s1: R_(0.18, 0.3) }; } });
// the plunge: spray thrown up and out where the water hits the cloud sea
new Spray(380, { g: 1.0, drag: 0.5, alpha: 0.5, soft: 0.48, order: 5, spawn: () => { const l = R_(-1.8, 1.8), o2 = R_(-0.4, 0.6); return { p: [PLUNGE[0] + ft[0] * l + fo[0] * o2, PLUNGE[1] + R_(-0.3, 0.3), PLUNGE[2] + ft[1] * l + fo[1] * o2], v: [fo[0] * R_(0.3, 1.4) + ft[0] * l * 0.25, R_(1.0, 3.2), fo[1] * R_(0.3, 1.4) + ft[1] * l * 0.25], life: R_(1.8, 3.4), s0: R_(0.25, 0.4), s1: R_(1.1, 2.0) }; } });
new Spray(140, { g: 6, drag: 0.2, alpha: 0.75, soft: 0.25, order: 5, spawn: () => { const l = R_(-1.6, 1.6); return { p: [PLUNGE[0] + ft[0] * l, PLUNGE[1] + 0.2, PLUNGE[2] + ft[1] * l], v: [fo[0] * R_(0.5, 1.8) + ft[0] * R_(-0.6, 0.6), R_(2.0, 4.2), fo[1] * R_(0.5, 1.8) + ft[1] * R_(-0.6, 0.6)], life: R_(0.7, 1.3), s0: R_(0.06, 0.1) }; } });
// white spray veil over the lower half of the fall: soft puffs peeling off the face and drifting down/out
new Spray(260, { g: 0.6, drag: 0.6, alpha: 0.45, soft: 0.48, order: 4, spawn: () => { const p = fallPt(R_(-0.05, 1.05), R_(3.4, 7.2), 3.4, R_(0.1, 0.45), 0.05); return { p, v: [fo[0] * R_(0.2, 0.8), -R_(0.3, 1.2), fo[1] * R_(0.2, 0.8)], life: R_(1.6, 2.8), s0: R_(0.3, 0.5), s1: R_(0.8, 1.5) }; } });
const LEAF_N = 260, leafGeo = new THREE.BufferGeometry(); leafGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.13, 0.075, 0, 0, 0, 0, 0.13, 0, 0, -0.13, 0, 0, 0.13, -0.075, 0, 0], 3)); leafGeo.computeVertexNormals();
const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), LEAF_N); leafMesh.castShadow = false; out.add(leafMesh);
const LEAF_COLS = ['#c45a32', '#d7793a', '#e0a446', '#b8462e', '#cf8a3a'].map(c => new THREE.Color(c)); const leaves = [], _lo = new THREE.Object3D();
function leafReset(L, first) { const s = leafSpawn(); L.p = new THREE.Vector3(...s.p); L.v = new THREE.Vector3(s.v[0], -0.3 - Math.random() * 0.2, s.v[2]); L.ax = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); L.spin = 2 + Math.random() * 4; L.ph = Math.random() * 6.28; L.rest = 0; L.size = 0.8 + Math.random() * 0.6; L.q = new THREE.Quaternion(); if (first) L.p.y -= Math.random() * 1.5; }
for (let i = 0; i < LEAF_N; i++) { const L = {}; leafReset(L, true); leaves.push(L); leafMesh.setColorAt(i, LEAF_COLS[i % LEAF_COLS.length]); }
function updateLeaves(dt) { for (let i = 0; i < LEAF_N; i++) { const L = leaves[i];
    if (L.rest > 0) { L.rest += dt; if (L.rest > 6) leafReset(L); }
    else { L.ph += dt * 2.2; L.p.x += (L.v.x + Math.sin(L.ph) * 0.35 + wind * 0.9) * dt; L.p.z += (L.v.z + Math.cos(L.ph * 0.8) * 0.25 + wind * 0.5) * dt; L.p.y += L.v.y * dt * (0.8 + 0.4 * Math.abs(Math.sin(L.ph)));
      L.q.multiply(new THREE.Quaternion().setFromAxisAngle(L.ax, L.spin * dt)); const gy = yAt(L.p.x, L.p.z); if (L.p.y < gy + 0.03 && gy > -1) { L.p.y = gy + 0.03; L.rest = 0.001; L.q.setFromEuler(new THREE.Euler(0, Math.random() * 6.28, 0)); } if (L.p.y < -10) leafReset(L); }
    const k = L.rest > 0 ? Math.max(0, 1 - Math.max(0, L.rest - 4.5) / 1.5) : 1; _lo.position.copy(L.p); _lo.quaternion.copy(L.q); _lo.scale.setScalar(L.size * k); _lo.updateMatrix(); leafMesh.setMatrixAt(i, _lo.matrix); }
  leafMesh.instanceMatrix.needsUpdate = true; }
// water wheel: paddles throw a little water as they come out of the stream
{ const wp = new THREE.Vector3(); window.__wheel.updateMatrixWorld(true); window.__wheel.getWorldPosition(wp); const ax = new THREE.Vector3(0, 0, 1).applyQuaternion(window.__wheel.getWorldQuaternion(new THREE.Quaternion())), fl = new THREE.Vector3(1, 0, 0).applyQuaternion(window.__wheel.getWorldQuaternion(new THREE.Quaternion()));
  new Spray(70, { g: 5, drag: 0.3, alpha: 0.75, soft: 0.3, spawn: () => { const a = R_(-0.3, 0.3); const p = [wp.x + fl.x * 0.75 + ax.x * a, wp.y - 0.55, wp.z + fl.z * 0.75 + ax.z * a]; return { p, v: [fl.x * R_(0.2, 0.7), R_(0.6, 1.4), fl.z * R_(0.2, 0.7)], life: R_(0.4, 0.8), s0: R_(0.04, 0.08) }; } }); }
// billowing mist where the fall meets the clouds, and a breath of mist down its length
const billows = []; for (let k = 0; k < 8; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#f4f2fb', transparent: true, opacity: 0, depthWrite: false })); sp.renderOrder = 4; out.add(sp); billows.push({ sp, ph: k / 8, T: R_(6, 9), l: R_(-1.6, 1.6), o: R_(-0.2, 0.9) }); }
for (let k = 0; k < 2; k++) { const p = fallPt(0.5, 2.8 + k * 2.0, 3.0, 0.6, 0.1); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#f4f2fb', transparent: true, opacity: 0, depthWrite: false })); sp.position.set(p[0] + fo[0] * 0.6, p[1], p[2] + fo[1] * 0.6); out.add(sp); billows.push({ sp, mid: true, ph: k * 0.37, T: 9, base: p }); }
// a faint rainbow standing in the plunge spray (camera-facing, daytime only)
const RAIN_FS = `varying vec2 vUv; uniform float uA, uTime;
vec3 hue(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
void main(){ vec2 p = vUv * 2. - 1.; p.y += 0.55; float r = length(p); float t = (r - 0.68) / 0.2; if (t < 0. || t > 1.) discard;
  float ang = atan(p.y, p.x); float arcM = smoothstep(0.3, 1.1, ang) * smoothstep(0.3, 1.1, 3.14159 - ang);
  float a = sin(t * 3.14159) * arcM * uA * (0.85 + 0.15 * sin(uTime * 0.4)); gl_FragColor = vec4(hue((1. - t) * 0.78) * a, 1.); }`;
const rainbow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uTime: { value: 0 } }, vertexShader: UV_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
rainbow.position.set(PLUNGE[0] + fo[0] * 1.8, PLUNGE[1] + 1.4, PLUNGE[2] + fo[1] * 1.8); rainbow.renderOrder = 6; out.add(rainbow);
// river: flowing streaks, foam along the banks, rapids before the lip
const RIV_VS = `attribute vec2 aFlow; varying vec2 vF; void main(){ vF = aFlow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const RIV_FS = NOISE_GLSL + `
varying vec2 vF; uniform float uTime, uLen; uniform vec3 uTint;
void main(){ float s = vF.x, sd = vF.y; float rap = smoothstep(uLen - 7., uLen, s);
  // Fixed advection keeps spatial frequency stable even after a full exploration.
  float n = vn(vec2(sd * 2.2 + 3., s * 1.1 - uTime * 0.9)) * 0.6 + vn(vec2(sd * 4.7, s * 2.6 - uTime * 1.17) + 7.) * 0.4;
  float st = smoothstep(0.66, 0.92, vn(vec2(sd * 7. + s * 0.15, s * 3.0 - uTime * 1.62)));
  float bank = smoothstep(0.6, 1., abs(sd));
  vec3 c = mix(vec3(0.27, 0.46, 0.52), vec3(0.42, 0.62, 0.66), 0.25 + 0.5 * n + 0.25 * bank);
  c = mix(c, vec3(0.90, 0.97, 0.97), clamp(st * 0.6 + bank * 0.35 * smoothstep(0.45, 0.8, n) + rap * 0.55 * smoothstep(0.35, 0.75, n), 0., 1.));
  gl_FragColor = vec4(c * uTint, 0.94); }`;
const riverMesh = out.children.find(c => c.isMesh && c.geometry.attributes.aFlow);
const riverMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uLen: { value: window.__riverLen || 20 }, uTint: { value: new THREE.Color(1, 1, 1) } }, vertexShader: RIV_VS, fragmentShader: RIV_FS, transparent: true, side: THREE.DoubleSide });
if (riverMesh) riverMesh.material = riverMat;
(window.__streaks || []).forEach(s => s.m.visible = false);
const waterTint = new THREE.Color(1, 1, 1), NIGHTW = new THREE.Color(0.3, 0.36, 0.58), WHITE = new THREE.Color(1, 1, 1);
function updateWater(dt) {
  waterTint.copy(WHITE).lerp(NIGHTW, cur.lamp * 0.9).multiply(WHITE.clone().lerp(cur.sun, 0.22));
  curtains.forEach(m => { m.uniforms.uTime.value = tAcc; m.uniforms.uTint.value.copy(waterTint); });
  riverMat.uniforms.uTime.value = tAcc; riverMat.uniforms.uTint.value.copy(waterTint);
  const px = renderer.domElement.height / ((cam.top - cam.bottom) / cam.zoom), spc = WHITE.clone().lerp(NIGHTW, cur.lamp * 0.12); // spray and mist stay white at night
  sprays.forEach(s => { s.update(dt); s.mat.uniforms.uPx.value = px; s.mat.uniforms.uColor.value.copy(s.base).multiply(spc); });
  billows.forEach(b => { const u = ((tAcc / b.T) + b.ph) % 1; b.sp.material.color.copy(spc);
    if (b.mid) { const s = 2.2 + Math.sin(tAcc * 0.4 + b.ph * 6) * 0.4; b.sp.scale.set(s * 1.4, s, 1); b.sp.material.opacity = 0.18 + 0.06 * Math.sin(tAcc * 0.5 + b.ph * 5); return; }
    b.sp.position.set(PLUNGE[0] + ft[0] * b.l + fo[0] * b.o, PLUNGE[1] + 0.3 + u * 2.6, PLUNGE[2] + ft[1] * b.l + fo[1] * b.o); const s = 2.2 + 5.2 * u; b.sp.scale.set(s * 1.3, s, 1); b.sp.material.opacity = 0.55 * Math.sin(Math.PI * u) * (1 + 0.3 * wind); });
  rainbow.quaternion.copy(cam.quaternion); rainbow.material.uniforms.uTime.value = tAcc; rainbow.material.uniforms.uA.value = 0.3 * Math.pow(Math.max(0, 1 - cur.lamp * 1.6), 2);
}

/* ---------- behaviour ---------- */
const startSpot = 9;
const caveAxis = (d) => { const g = window.__cave; return [g.position.x + Math.sin(g.rotation.y) * d, g.position.z + Math.cos(g.rotation.y) * d]; }; // a point on the tunnel's centre line, d units in front of the mouth
function startWalk(path, goalId, why) { TR.path = path; TR.wi = 0; TR.goal = goalId; TR.mode = 'walk'; TR.why = why || 'wander'; }
function spotNow() { return TR.spot; }
function pickNext() {
  if(caveCalling&&REACH[12]&&TR.spot!==12&&!pendingEvent){const pa=planTo(12);if(pa&&backend('choose',budget(plen(pa)/V_WALK*speed/rate())))return 12;}
  const cands = SPOT_IDS.filter(id => id !== TR.spot && REACH[id] && !TR.recent.includes(id) && id !== 4); if (!cands.length) return 4;
  const w = cands.map(id => 1); let tot = w.reduce((a, b) => a + b, 0), r = Math.random() * tot; if (window.__seededRand) { r = window.__seededRand() * tot; }
  for (let k = 0; k < cands.length; k++) { r -= w[k]; if (r <= 0) return cands[k]; } return cands[0]; }
function lampEta(k) { const L = LAMPNODE[k]; const pa = planToXZ(L.p[0], L.p[1]); return pa ? plen(pa) / (V_WALK * rate()) + 2.2 : 0; }
function decide() {
  if (TR.done) return;
  const ldue = lampsDue();
  if (TR.lit < 5) { const k = TR.lit; const remain = (dueOf(k) - sim) / speed; // real seconds to the lamp's due time
    const eta = lampEta(k); if (sim >= dueOf(k) - 1e-6 || remain <= eta + 6 / rate()) { const pa = planToXZ(LAMPNODE[k].p[0], LAMPNODE[k].p[1]); if (pa) { startWalk(pa, 'lamp' + k, 'lamp'); TR.leave = []; say(`旅人提著燈，走向第 ${k + 1} 盞路燈。`); return; } TR.lit = k + 1; } }
  else { const pa = planTo(4); if (pa) { TR.leave = []; startWalk(pa, 4, 'rest'); say('五盞燈都亮了。旅人慢慢走回觀景平台。'); return; } }
  const id = pickNext(); const pa = planTo(id); if (!pa) { REACH[id] = false; TR.dwell = 0.5; return; }
  TR.leave = []; startWalk(pa, id, 'wander'); say(`旅人往「${SP[id].name}」走去。`);
}
function arrive() {
  const g = TR.goal;
  if (g === 'caveIn') { TR.mode = 'idle'; TR.dwell = 1e9; fade = { k: 'out', t: 0, then: () => { CAVE.journey(pendingEvent||'echo', TR.caveKind||'chime', () => { fade = { k: 'out', t: 0, then: () => { CAVE.leave('visit'); const m = caveAxis(-0.45); place(m[0], m[1]); TR.hd = Math.atan2(caveAxis(1)[0] - m[0], caveAxis(1)[1] - m[1]); TR.leave = []; fade = { k: 'in', t: 0 }; startWalk([caveAxis(0.2), caveAxis(1.0)], 'caveOut', 'cave'); say('旅人從共鳴洞裡走了出來。'); } }; }); fade = { k: 'in', t: 0 }; } }; return; }
  if(g==='caveOut'){pendingEvent=null;backend('finished');TR.mode = 'idle'; TR.dwell = 0.6; TR.spot = 12; return; }
  if(g===12&&(pendingEvent||(caveCalling&&backend('arrive',budget())))) { TR.forceCave = false; TR.caveKind = caveLure ? caveLure.kind : 'chime'; caveCalling = false; caveLure = null; caveVisits++; TR.spot = 12; TR.leave = []; startWalk([caveAxis(1.0), caveAxis(0.2), caveAxis(-0.45)], 'caveIn', 'cave'); say('旅人走進共鳴洞。'); return; }
  if (typeof g === 'string' && g.startsWith('lamp')) { TR.mode = 'light'; TR.t = 0; TR.lampIdx = +g.slice(4); const L = LAMPNODE[TR.lampIdx]; TR.hd = Math.atan2(L.look[0] - TR.x, L.look[1] - TR.z); TR.spot = 0; return; }
  TR.spot = g; const st = STAND[g]; TR.hd = Math.atan2(st.look[0] - TR.x, st.look[1] - TR.z);
  const nv = NAV[g]; TR.leave = nv.leave.map(p => [p[0], p[1]]);
  TR.recent.push(g); if (TR.recent.length > 5) TR.recent.shift();
  if (g === 4 && TR.why === 'rest') { TR.mode = 'rest'; TR.done = TR.lit >= 5; say(TR.done ? '五盞燈都亮了。旅人坐在觀景平台，看著雲海，一直到專注結束。' : BLURB[4]); return; }
  if(g===6&&remoteWhistle){remoteWhistle=false;TR.mode='act';TR.spot=6;TR.t=0;TR.dwell=1e9;actFx(6);fade={k:'out',t:0,then:()=>{CAVE.whistleCut(()=>{fade={k:'in',t:0};TR.mode='idle';TR.dwell=.6;});fade={k:'in',t:0};}};return;}TR.mode = 'act'; TR.t = 0; TR.dwell = (5 + Math.random() * 5) / rate(); if (window.__seededRand) TR.dwell = (5 + window.__seededRand() * 5) / rate(); say(BLURB[g]); actFx(g); TR.acted = false; }
function updateTraveller(dt) {
  const r = rate();
  TR.chk = (TR.chk || 0) + dt; if (TR.chk > 0.5 && TR.lit < 5 && TR.why !== 'cave' && (TR.mode === 'act' || (TR.mode === 'walk' && TR.why !== 'lamp' && TR.why !== 'cave' && Math.abs(TR.y - yAt(TR.x, TR.z)) < 0.15))) { TR.chk = 0; const k = TR.lit; const remain = (dueOf(k) - sim) / speed; if (remain <= lampEta(k) + 1.5) { TR.mode = 'idle'; decide(); } } if (TR.mode === 'walk') TR.phase += V_WALK * r * dt * 9;
  if (TR.mode === 'walk') {
    let step = V_WALK * r * dt; while (step > 0 && TR.wi < TR.path.length) { const w = TR.path[TR.wi], dx = w[0] - TR.x, dz = w[1] - TR.z, d = Math.hypot(dx, dz); if (d <= step) { place(w[0], w[1]); step -= d; TR.wi++; } else { place(TR.x + dx / d * step, TR.z + dz / d * step); step = 0; } if (d > 0.02) { const tg = Math.atan2(dx, dz); let da = tg - TR.hd; da = Math.atan2(Math.sin(da), Math.cos(da)); TR.hd += da * Math.min(1, dt * 9); } }
    if (TR.wi >= TR.path.length) arrive();
  } else if (TR.mode === 'act') { TR.t += dt; let da = Math.atan2(STAND[TR.spot].look[0] - TR.x, STAND[TR.spot].look[1] - TR.z) - TR.hd; da = Math.atan2(Math.sin(da), Math.cos(da)); TR.hd += da * Math.min(1, dt * 5);
    if (TR.t > TR.dwell) { TR.mode = 'idle'; decide(); }
  } else if (TR.mode === 'light') { TR.t += dt; if (TR.t > 2.2 / r) { TR.lit = TR.lampIdx + 1; TR.mode = 'idle'; if (TR.lit >= 5) say('第五盞燈亮了。旅人轉身，走向觀景平台。'); decide(); }
  } else if (TR.mode === 'idle') { TR.dwell -= dt; if (TR.dwell <= 0) decide();
  } else if (TR.mode === 'rest') { }
  poseTraveller(dt);
}
function poseTraveller(dt) {
  const walking = TR.mode === 'walk' && (playing || inCave);
  // which pose
  let key = 'idle', prog = 0;
  if (TR.mode === 'walk') key = 'walk';
  else if (TR.mode === 'light') { key = 'light'; prog = Math.min(1, TR.t * rate() / 2.0); }
  else if (TR.mode === 'rest') key = (Math.floor(tAcc / 22) % 3 === 1) ? 'write' : 'sitGaze';
  else if (TR.mode === 'act') { key = SPOT_ANIM[TR.spot] || 'idle'; prog = Math.min(1, TR.t / Math.max(0.1, TR.dwell)); if (TR.spot === 'cv_stone') prog = Math.min(0.42, TR.t / 4); }
  const onBench = TR.spot === 4 && (TR.mode === 'rest' || TR.mode === 'act');
  const tgt = Object.assign({ hip: 0, legX: 0, lean: 0, headX: 0, headY: 0, armL: 0, armLz: 0, staffX: 0, staffZ: 0, book: 0 }, POSE[key] || {});
  if (key === 'light') tgt.staffX = Math.sin(Math.PI * prog) * 0.9;
  if (key === 'reach') { const a = Math.sin(Math.PI * Math.min(1, prog * 2.2)); tgt.armL = -1.7 * a + Math.sin(TR.t * 2) * 0.12 * a; tgt.headX = -0.1 * a + 0.25 * (1 - a); }
  if (key === 'call') { const a = Math.sin(Math.PI * Math.min(1, prog * 1.6)); tgt.armL *= a; tgt.lean *= a; tgt.headX = -0.2 * a; }
  if (key === 'gaze' || key === 'sitGaze' || key === 'idle' || key === 'look') tgt.headY = Math.sin(tAcc * 0.35) * (key === 'idle' ? 0.35 : 0.5);
  if (key === 'listen') tgt.headY = 0.35 + Math.sin(tAcc * 0.5) * 0.08;
  if (key === 'write') tgt.armLz = Math.sin(tAcc * 5) * 0.08;
  if (onBench) tgt.hip = DK_SEAT_LIFT / 1.15 - 0.3 + 0.01; // pelvis on the bench top, not on the boards
  const k = 1 - Math.exp(-dt * 5); PKEYS.forEach(q => { pose[q] += (tgt[q] - pose[q]) * k; });
  // sitting down on the lookout bench: back up from the standing point onto the seat
  TR.sit = (TR.sit || 0) + ((onBench ? 1 : 0) - (TR.sit || 0)) * Math.min(1, dt * 2.2);
  let px = TR.x, pz = TR.z, py = TR.y; if (TR.sit > 0.001 && TR.spot === 4) { px += (DK_SEAT[0] - TR.x) * TR.sit; pz += (DK_SEAT[1] - TR.z) * TR.sit; py = groundY(px, pz); }
  trav.position.set(px, py, pz); trav.rotation.y = TR.hd;
  const swing = walking ? Math.sin(TR.phase) * 0.55 : 0, bob = walking ? Math.abs(Math.sin(TR.phase)) * 0.035 : 0;
  body.position.y = pose.hip + bob; upper.rotation.x = pose.lean;
  legL.rotation.x = pose.legX + swing; legR.rotation.x = pose.legX - swing;
  head.rotation.x = pose.headX; head.rotation.y = pose.headY; armL.rotation.x = pose.armL; armL.rotation.z = pose.armLz;
  armR.rotation.x = -0.35 + pose.staffX * 0.8; staff.rotation.x = pose.staffX; staff.rotation.z = pose.staffZ; cloak.rotation.z = swing * 0.07;
  book.visible = pose.book > 0.5;
}

/* ---------- ambient motion ---------- */
const chimeBars = (window.__chimes || []).map(g => g.children.slice(4).filter(c => c.geometry.type === 'BoxGeometry').map(c => ({ c, rz0: c.rotation.z, ph: Math.random() * 6 })));
const _n = new THREE.Vector3(), _cd = new THREE.Vector3();
function ambient(dt) {
  // wind envelope (山風石歌)
  if (windSim > 0) windSim -= dt * speed; const wt = windSim > 0 ? 1 : 0; wind += (wt - wind) * (1 - Math.exp(-dt * 1.2));
  const wt2 = tAcc - BELL.st.waveT, wr = wt2 * 4.2, wf = Math.max(0, 1 - wt2 / 5.5), WC = BELL.st.waveC;
  (window.__sprs || []).forEach(o => { const k = o.big ? 0.05 : 0.07; let bump = 0; if (wf > 0 && o.y < -3) { const d = Math.hypot(o.x - WC.x, o.z - WC.z); bump = Math.exp(-((d - wr) / 1.5) * ((d - wr) / 1.5)) * wf; }
    o.sp.position.x = o.x + Math.sin(tAcc * k + o.ph) * (o.big ? 1.6 : 0.7) + wind * Math.sin(tAcc * 0.4 + o.ph) * 0.5; o.sp.position.y = o.y + Math.sin(tAcc * 0.11 + o.ph * 1.7) * 0.12 + 1.0 * bump; o.sp.material.opacity = o.op * (0.92 + 0.08 * Math.sin(tAcc * 0.3 + o.ph)) * (1 + 0.5 * bump); });
  (window.__birds || []).forEach(b => { b.boost = Math.max(0, (b.boost || 0) - dt * 0.15); b.acc = (b.acc || 0) + dt * b.sp * (1 + 2.5 * b.boost); const a = b.acc + b.ph; b.m.position.set(b.x + Math.cos(a) * b.r * (1 + 0.4 * b.boost), b.y + Math.sin(a * 2) * 0.35 + 3.5 * Math.sin(Math.PI * Math.min(1, 1 - b.boost)) * (b.boost > 0 ? 1 : 0), b.z + Math.sin(a) * b.r * (1 + 0.4 * b.boost)); b.m.rotation.y = -a + Math.PI; b.m.scale.y = 0.3 + Math.abs(Math.sin(tAcc * 5 + b.ph)) * 1.1; });
  if (window.__motes) { const M2 = window.__motes, p = M2.pos; for (let i = 0; i < p.length; i += 3) { p[i + 1] += dt * (0.12 + 0.25 * wind + 0.06 * Math.sin(i)); p[i] += Math.sin(tAcc * 0.5 + i) * dt * 0.05 + wind * dt * 0.35; if (p[i + 1] > 7) p[i + 1] = -9; }
    M2.pg.attributes.position.needsUpdate = true; M2.moteM.opacity = 0.65 + 0.3 * cur.lamp; M2.moteM.size = 0.2 + 0.08 * cur.lamp; }
  // undershot wheel: the stream pushes the bottom paddles downstream
  if (window.__wheel) window.__wheel.rotation.z += dt * 0.85;
  if (window.__cage) { cageBoost = Math.max(0, cageBoost - dt * 0.35); window.__cage.rotation.z = Math.sin(tAcc * 0.8) * (0.035 + 0.12 * cageBoost + 0.05 * wind); window.__cage.rotation.x = Math.sin(tAcc * 0.6 + 1) * 0.02; }
  (window.__trees || []).forEach(t => { if (t.gone) return; const a = 0.018 + 0.05 * wind; t.g.rotation.z = Math.sin(tAcc * 0.8 + t.ph) * a - wind * 0.04; t.g.rotation.x = Math.sin(tAcc * 0.6 + t.ph * 1.7) * a * 0.7; });
  (window.__shafts || []).forEach(s => { s.m.rotation.y = -Math.PI / 4 + yawOff; s.m.material.opacity = 0.26 * (1 - 0.7 * cur.lamp); });
  // chimes
  swayChime = Math.max(0, swayChime - dt * 0.5); chimeBars.forEach((arr, gi2) => arr.forEach((o, k) => { o.c.rotation.z = o.rz0 + Math.sin(tAcc * (2.4 + k * 0.3) + o.ph) * (0.03 + 0.16 * swayChime * (gi2 === 0 ? 1 : 0.2) + 0.14 * wind); }));
  // bell (spire)
  if (bellStrikes > 0) { BELL.ring(bellStrikes); bellStrikes = 0; }
  if (window.__bell) { bellSwing *= Math.exp(-dt * 1.4); const b = window.__bell.children[window.__bell.children.length - 1]; if (b && b.geometry.type === 'CylinderGeometry') b.rotation.z = Math.sin(tAcc * 7) * 0.12 * bellSwing; }
  // gondola
  if (window.__gondola) { const G = window.__gondola; gondolaBoost = Math.max(0, gondolaBoost - dt * 0.05); const u = 0.5 + 0.38 * Math.sin(tAcc * (0.05 + 0.1 * gondolaBoost)); const p = new THREE.Vector3().lerpVectors(G.tA, G.tB, u); p.y -= 1.8 * 4 * u * (1 - u) + 0.95; G.bk.position.set(p.x, p.y, p.z); G.bk.rotation.z = Math.sin(tAcc * 0.9) * 0.04; }
  updateSound(dt); updateCave(); updateGlow(); updateCollar(); BELL.update(dt); updateLeaves(dt);
  // wind keeps the wind-hole rock and the sound wall humming
  if (wind > 0.3) { ambient.hum = (ambient.hum || 0) - dt; if (ambient.hum <= 0) { ambient.hum = 2.4; ringWave(1.3, 22.4, 1.2, 0.8); ringWave(15.5, -9.15, 1.2, 0.7); } }
  updateWater(dt);
  // lamps
  const due = lampsDue(); window.__lamps.forEach((L, i) => { const tg = i < due ? 1 : 0; L.level += (tg - L.level) * (1 - Math.exp(-dt * 3)); const fl = 1 + Math.sin(tAcc * 7.3 + i * 2) * 0.04 + Math.sin(tAcc * 13.1 + i) * 0.02;
    L.mat.color.setRGB(0.23 + 0.77 * L.level, 0.19 + 0.63 * L.level, 0.16 + 0.39 * L.level); L.light.intensity = L.level * (0.35 + 0.95 * cur.lamp) * fl; L.glow.material.opacity = L.level * (0.22 + 0.45 * cur.lamp) * fl; L.glow.scale.setScalar(1.2 + 0.7 * cur.lamp); });
  lantern.intensity = 0.25 + 0.9 * cur.lamp; lanternGlow.material.opacity = Math.min(0.45, 0.1 + 0.3 * cur.lamp); travGlowMat.emissiveIntensity = 0.6 + 0.6 * cur.lamp;
  scene.fog.color.copy(cur.bot).convertSRGBToLinear();
}
let bellRung = 0; const SPY = () => H(SPIRE[0], SPIRE[1]);
function startWind(first) { if(windSim<=0)sound('windStart');windSim = 60; if (first) { bellStrikes = 13; windFirst = false; } say(first ? '風穿過石縫。沒有人敲，鐘樓的大鐘自己響了起來。' : '山風從洞口與石縫吹過，整座採石場輕輕地嗡。'); }

/* =====================================================================
   共鳴洞 · 洞內 (v9): a still, glowing pool under one shaft of light.
   The traveller comes in from the lower right, crosses a zigzag boardwalk (八橋) over the water, and the voice stone
   rests on a lotus pedestal on a stone dais inside a sacred rope, right where the light falls. The sealed wall stands
   in the rock on the left with a ledge in front of it. Lotus leaves, white lotus, floating maple leaves, low mist and
   slow motes; the water mirrors everything (a real planar reflection). Sounds are spherical air waves, nothing flat.
   Local coordinates of the `grotto` group (world x + 400). Water level y = 0.
   ===================================================================== */
let inCave = false;
const CAVE = (() => {
  const noRefl = [];
  const G = grotto, WY = 0, CX = -2.5, CZ = -2.5, PLANK = 0.32;
  G.visible = false;
  const hashR = (a, b) => hsh(a * 1.37 + 11.1, b * 0.71 + 3.3);
  const sm = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.95, flatShading: true }, o || {}));
  const floorMeshes = []; const markFloor = m => { m.userData.floor = true; floorMeshes.push(m); return m; };
  const deg = Math.PI / 180;
  const rockM = [sm('#56645f'), sm('#646f66'), sm('#46534f')], mossM = sm('#5a7649');

  /* ---------- the cave wall: one continuous band around the back and sides (no gaps between boulders) ---------- */
  const PHI0 = 112 * deg, PHI1 = 338 * deg;                        // only the back arc: no part of the band ever stands between a peeking camera (45°±63°) and the pool
  const Rw = phi => 11 - 2.2 * Math.exp(-Math.pow((phi - 152 * deg) / (24 * deg), 2)) + 1.0 * (fbm(Math.cos(phi) * 2 + 3, Math.sin(phi) * 2 + 7) - 0.5) * 2;
  const Hw = phi => { const d = Math.abs(phi - 225 * deg) / deg; if (d < 46) return 12; const t = Math.min(1, (d - 46) / 52); return Math.max(0.9, 12 - 11.1 * (t * t * (3 - 2 * t))); };
  { const NA = 150, NY = 16, P3 = [], C3 = [];
    const wallPt = (i, j) => { const phi = PHI0 + (PHI1 - PHI0) * i / NA, h0 = Hw(phi), h = h0 * (0.72 + 0.56 * fbm(phi * 7.3 + 4, 2.2)), y = -1.2 + (h + 1.2) * j / NY; const n = fbm(phi * 3.1 + 2, y * 0.35 + 5) - 0.5, n2 = fbm(phi * 9 + 7, y * 1.1) - 0.5;
      const r = Rw(phi) + n * 2.2 + n2 * 0.5 - 1.7 * Math.pow(Math.max(0, y) / 12, 2) * (h > 6 ? 1 : 0); return [Math.cos(phi) * r, y, Math.sin(phi) * r, phi]; };
    const colAt = (y, phi) => { const base = C('#4f5f5b'), moss = C('#57724a'), wet = C('#262e2c'), hi = C('#6f7c74'); let c = base.clone().lerp(hi, 0.35 * fbm(phi * 6, y * 0.4));
      c.lerp(moss, 0.65 * Math.max(0, Math.min(1, (fbm(phi * 4 + 9, y * 0.5 + 2) - 0.48) * 5)) * (y < 6 ? 1 : 0.4)); if (y < 0.5) c.lerp(wet, Math.min(1, (0.5 - y) * 1.4)); c.multiplyScalar(0.92 + 0.2 * Math.max(0, 1 - y / 12)); return c.convertSRGBToLinear(); };
    const W = []; for (let i = 0; i <= NA; i++) { W[i] = []; for (let j = 0; j <= NY; j++) W[i][j] = wallPt(i, j); }
    const push = (a, b, c2, toward) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2]; const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; const cx = (a[0] + b[0] + c2[0]) / 3, cy = (a[1] + b[1] + c2[1]) / 3, cz = (a[2] + b[2] + c2[2]) / 3; const t = toward(cx, cy, cz);
      if (n[0] * (t[0] - cx) + n[1] * (t[1] - cy) + n[2] * (t[2] - cz) < 0) { const q = b; b = c2; c2 = q; } const col = colAt(cy, Math.atan2(cz, cx)); for (const p of [a, b, c2]) { P3.push(p[0], p[1], p[2]); C3.push(col.r, col.g, col.b); } };
    const inward = (x, y, z) => [0, y, 0];
    for (let i = 0; i < NA; i++) for (let j = 0; j < NY; j++) { const a = W[i][j], b = W[i + 1][j], c2 = W[i][j + 1], d = W[i + 1][j + 1]; push(a, b, c2, inward); push(b, d, c2, inward); }
    // the top of the low side walls: a rounded cap back to an outer skin, so nothing looks paper-thin from above
    for (let i = 0; i < NA; i++) { const a = W[i][NY], b = W[i + 1][NY]; if (a[1] > 8 && b[1] > 8) continue; const o = p => { const k = (Math.hypot(p[0], p[2]) + 2.4) / Math.hypot(p[0], p[2]); return [p[0] * k, p[1] - 0.6, p[2] * k]; }, oo = p => { const k = (Math.hypot(p[0], p[2]) + 3.0) / Math.hypot(p[0], p[2]); return [p[0] * k, -1.2, p[2] * k]; };
      const up = (x, y, z) => [x * 1.05, y + 5, z * 1.05]; push(a, b, o(a), up); push(b, o(b), o(a), up); const out2 = (x, y, z) => [x * 2, y, z * 2]; push(o(a), o(b), oo(a), out2); push(o(b), oo(b), oo(a), out2); }
    // the two ends of the band close down to the water
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C3, 3)); geo.computeVertexNormals();
    const wall = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); wall.receiveShadow = true; wall.castShadow = true; G.add(wall); }
  const WALLP = (() => { const phi = 152 * deg, r = Rw(phi) - 0.95; return [Math.cos(phi) * r, Math.sin(phi) * r]; })(), WALLN = [0.99, 0.15];
  /* ---------- water: still, dark, mirroring; ripples only when something sounds or lands ---------- */
  const rtW = Math.max(256, Math.floor(innerWidth / 2)), rtH = Math.max(144, Math.floor(innerHeight / 2));
  const reflRT = new THREE.WebGLRenderTarget(rtW, rtH, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const mirrorCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400), texMat = new THREE.Matrix4();
  const RIP_N = 8, rip = []; for (let i = 0; i < RIP_N; i++) rip.push(new THREE.Vector4(0, 0, -9, 0)); let ripK = 0;
  const WATER_VS = `uniform mat4 uTex; varying vec4 vR; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vR = uTex * w; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const WATER_FS = NOISE_GLSL + `
  uniform sampler2D tRefl; uniform float uTime, uLightI, uGlow; uniform vec3 uDeep, uMid, uLightCol; uniform vec2 uLight, uOff; uniform vec4 uRip[${RIP_N}];
  varying vec4 vR; varying vec3 vW;
  void main(){ vec2 p = vW.xz - uOff;
    vec2 d = vec2(vn(p * 0.9 + uTime * 0.04) - 0.5, vn(p * 0.9 + 17. - uTime * 0.035) - 0.5) * 0.006;
    float ring = 0.;
    for (int i = 0; i < ${RIP_N}; i++) { vec4 R = uRip[i]; if (R.w <= 0.001) continue; vec2 q = p - R.xy; float r = length(q); float k = R.w * exp(-pow((r - R.z) * 2.6, 2.)) * smoothstep(0., 0.4, R.z);
      d += q / max(r, 1e-3) * k * 0.035 * sin((r - R.z) * 9.); ring += k; }
    vec4 uv = vR; uv.xy += d * uv.w;
    vec3 refl = texture2DProj(tRefl, uv).rgb;
    float r0 = length(p); vec3 base = mix(uMid, uDeep, smoothstep(2., 11., r0));
    vec3 c = base + refl * 0.78;
    float lp = exp(-pow(length(p - uLight) / 2.4, 2.)) * uLightI; c += uLightCol * lp * (0.16 + 0.06 * vn(p * 3. + uTime * 0.3));
    c += vec3(0.42, 0.66, 0.95) * ring * 0.11 + vec3(0.25, 0.55, 0.75) * uGlow * exp(-pow(length(p - uLight) / 4.5, 2.)) * 0.18;
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    gl_FragColor = linearToOutputTexel(vec4(c, 1.)); }`;
  const waterMat = new THREE.ShaderMaterial({ uniforms: { tRefl: { value: reflRT.texture }, uTex: { value: texMat }, uTime: { value: 0 }, uDeep: { value: new THREE.Color('#03090b') }, uMid: { value: new THREE.Color('#0a1d22') },
      uLight: { value: new THREE.Vector2(CX, CZ) }, uLightI: { value: 1 }, uLightCol: { value: new THREE.Color('#ffe7c2') }, uGlow: { value: 0 }, uRip: { value: rip }, uOff: { value: new THREE.Vector2(0, 0) } }, vertexShader: WATER_VS, fragmentShader: WATER_FS });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = WY; water.receiveShadow = false; G.add(water);
  function ripple(x, z, amp) { rip[ripK % RIP_N].set(x, z, 0, amp); ripK++; }

  /* ---------- the boardwalk (八橋) and the path ---------- */
  // path nodes [x, z, y]; the traveller only ever walks these lines, everything solid is kept clear of them
  const NODES = { E0: [15.2, 3.6, 0.36], E1: [11.4, 2.5, 0.36], L0: [9.6, 2.05, 0.34], B1: [7.0, 3.35, PLANK], B2: [4.4, 1.55, PLANK], J: [1.8, 2.85, PLANK],
    B3: [0.15, 0.95, PLANK], I0: [CX + 2.55 * 0.7071, CZ + 2.55 * 0.7071, 0.31], A0: [CX + 2.2 * 0.7071, CZ + 2.2 * 0.7071, 0.31], S1: [CX + 1.95 * 0.7071, CZ + 1.95 * 0.7071, 0.44], S1b: [CX + 1.52 * 0.7071, CZ + 1.52 * 0.7071, 0.55], S2: [CX + 1.3 * 0.7071, CZ + 1.3 * 0.7071, 0.66], S2b: [CX + 1.0 * 0.7071, CZ + 1.0 * 0.7071, 0.76], ST: [CX + 0.86 * 0.7071, CZ + 0.86 * 0.7071, 0.76],
    W1: [-0.8, 4.95, PLANK], W2: [-3.6, 3.75, PLANK], W3: [WALLP[0] + WALLN[0] * 1.6 + 1.15, WALLP[1] + WALLN[1] * 1.6 + 0.25, PLANK], WL: [WALLP[0] + WALLN[0] * 1.6, WALLP[1] + WALLN[1] * 1.6, 0.31] };
  const ROUTE_IN = ['E0', 'E1', 'L0', 'B1', 'B2', 'J'], ROUTE_STONE = ['J', 'B3', 'I0', 'A0', 'S1', 'S1b', 'S2', 'S2b', 'ST'], ROUTE_WALL = ['J', 'W1', 'W2', 'W3', 'WL'];
  const deckSegs = [['L0', 'B1'], ['B1', 'B2'], ['B2', 'J'], ['J', 'B3'], ['B3', 'I0'], ['J', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'WL']];
  const PATH_SEGS = deckSegs.map(([a, b]) => [NODES[a], NODES[b]]).concat([[NODES.E0, NODES.E1], [NODES.E1, NODES.L0], [NODES.I0, NODES.ST]]);
  const plankM = [sm('#7b6450'), sm('#6e5846'), sm('#85705a')], postM = sm('#4a3b2f'), beamM = sm('#5a4838');
  deckSegs.forEach(([a, b], si) => { const A = NODES[a], Bn = NODES[b]; const dx = Bn[0] - A[0], dz = Bn[1] - A[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ry = Math.atan2(dx, dz);
    const ext0 = 0.55, ext1 = 0.55, n = Math.ceil((L + ext0 + ext1) / 0.34);
    for (let k = 0; k < n; k++) { const t = -ext0 + (k + 0.5) * (L + ext0 + ext1) / n; const x = A[0] + ux * t, z = A[1] + uz * t; const m = markFloor(box(G, 1.24, 0.08, (L + ext0 + ext1) / n - 0.018, plankM[(k + si) % 3], x, PLANK - 0.04 - (k % 3 === 1 ? 0.006 : 0), z, { ry })); m.rotation.y = ry; }
    [-0.52, 0.52].forEach(o => { const ox = uz * o, oz = -ux * o; const st = box(G, 0.1, 0.12, L + ext0 + ext1, beamM, A[0] + ux * (L / 2) + ox, PLANK - 0.14, A[1] + uz * (L / 2) + oz, { ry }); st.rotation.y = ry;
      for (let t = -ext0 + 0.25; t <= L + ext1 - 0.2; t += 1.25) cyl(G, 0.06, 0.07, 1.2, 6, postM, A[0] + ux * t + ox, PLANK - 0.75, A[1] + uz * t + oz); }); });
  // landing on the entrance shelf and the ledge before the sealed wall
  { const shelf = add(G, smoothRock(2.6, 0.25, 41), sm('#4e605d'), 12.6, -0.32, 2.8); shelf.scale.set(1.35, 0.25, 0.85); markFloor(shelf);
    const slabM = [sm('#7d8681'), sm('#6f7873'), sm('#89918c')]; [[15.5, 3.7], [14.75, 3.48], [14.0, 3.26], [13.25, 3.04], [12.5, 2.82], [11.75, 2.6], [11.0, 2.4], [10.25, 2.2]].forEach(([x, z], i) => { const s = markFloor(cyl(G, 0.48, 0.52, 0.14, 7, slabM[i % 3], x, 0.29, z)); s.rotation.y = i * 0.9; s.scale.z = 0.8; });
    [[13.9, 5.2, 0.8], [14.4, 1.5, 0.7], [11.9, 0.9, 0.5], [16.0, 4.6, 0.9], [16.2, 2.2, 0.8]].forEach(([x, z, s], i) => { const r = add(G, smoothRock(s, 0.4, 70 + i), rockM[i % 3], x, 0.15, z); r.scale.y = 0.75; }); }
  // the sealed wall: a dressed slab set into the rock (the copper whistle makes it hum: hollow behind)
  const sealed = new THREE.Group(); sealed.position.set(WALLP[0], 0, WALLP[1]); sealed.rotation.y = Math.atan2(0.99, 0.15) ; sealed.scale.setScalar(0.8); G.add(sealed); // faces +x, a little toward +z (toward the camera)
  const slabM = sm('#6c7f7b'), seamM = sm('#1f2a28');
  { box(sealed, 3.6, 4.6, 0.7, slabM, 0, 2.15, -0.1); box(sealed, 4.2, 0.35, 0.9, sm('#5d6f6a'), 0, 4.55, -0.05); box(sealed, 4.0, 0.3, 0.9, sm('#5d6f6a'), 0, -0.05, 0.05);
    [-0.6, 0.6].forEach(x => box(sealed, 0.035, 4.4, 0.02, seamM, x, 2.15, 0.26, { cast: false })); box(sealed, 1.2, 0.035, 0.02, seamM, 0, 1.45, 0.26, { cast: false }); box(sealed, 1.2, 0.035, 0.02, seamM, 0, 2.95, 0.26, { cast: false });
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; add(sealed, new THREE.CircleGeometry(0.045, 6), seamM, Math.cos(a) * 0.42, 2.2 + Math.sin(a) * 0.42, 0.265, { cast: false }); }
    for (let k = 0; k < 5; k++) add(sealed, new THREE.CircleGeometry(0.06, 7), M('#111614'), -0.8 + k * 0.4, 1.0, 0.265, { cast: false });
    const ledge = add(sealed, smoothRock(1.3, 0.2, 93), sm('#56685f'), 0, -0.05, 1.5); ledge.scale.set(1.25, 0.34, 0.8); markFloor(ledge);
    const frR = sm('#46585a'); [[-2.55, 1.9, -0.35, 1.2, 2.6, 0.9, 101], [2.55, 1.8, -0.35, 1.1, 2.5, 0.9, 102], [0, 5.35, -0.4, 2.9, 1.0, 0.95, 103], [-2.2, 4.6, -0.5, 1.2, 1.1, 0.9, 104], [2.3, 4.5, -0.5, 1.1, 1.1, 0.9, 105]].forEach(([x, y, z, sx, sy, sz, sd]) => { const r = add(sealed, smoothRock(1, 0.35, sd), frR, x, y, z); r.scale.set(sx, sy, sz); });
    add(sealed, smoothRock(0.9, 0.3, 106), mossM, 0, 5.85, -0.2).scale.set(2.2, 0.35, 0.8); }

  /* ---------- the islet, the dais, the lotus pedestal and the sacred rope ---------- */
  const DAIS = new THREE.Group(); DAIS.position.set(CX, 0, CZ); G.add(DAIS);
  const stoneA = sm('#8b918a'), stoneB = sm('#7a8079'), stoneMoss = sm('#5c7752');
  { const ig = new THREE.CylinderGeometry(2.85, 3.2, 1.3, 14, 1); { const p = ig.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x); const k = 1 + (fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 1) - 0.5) * 0.22; p.setX(i, x * k); p.setZ(i, z * k); } ig.computeVertexNormals(); }
    const isl = markFloor(add(DAIS, ig, sm('#55665d'), 0, 0.3 - 0.65, 0)); add(DAIS, new THREE.CylinderGeometry(2.6, 2.6, 0.02, 14), sm('#5f7756'), 0, 0.305, 0, { cast: false });
    for (let k = 0; k < 13; k++) { const a = (k / 13) * Math.PI * 2 + 0.2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 4), Math.cos(a - Math.PI / 4))) < 0.5) continue; const rr = 2.75 + hashR(k, 31) * 0.3, sz = 0.35 + hashR(k, 32) * 0.35; const st = add(DAIS, smoothRock(sz, 0.4, 200 + k), rockM[k % 3], Math.cos(a) * rr, 0.22, Math.sin(a) * rr); st.scale.y = 0.7; }
    const t1 = markFloor(cyl(DAIS, 1.72, 1.82, 0.26, 8, stoneB, 0, 0.42, 0)); t1.rotation.y = Math.PI / 8; const t2 = markFloor(cyl(DAIS, 1.18, 1.24, 0.22, 8, stoneA, 0, 0.65, 0)); t2.rotation.y = Math.PI / 8;
    cyl(DAIS, 1.76, 1.76, 0.03, 8, stoneMoss, 0, 0.56, 0, { cast: false }).rotation.y = Math.PI / 8;
    // two steps toward the boardwalk (the approach is the +x+z diagonal)
    const s1 = markFloor(box(DAIS, 0.95, 0.12, 0.42, stoneB, 1.85 * 0.7071, 0.38, 1.85 * 0.7071)); s1.rotation.y = Math.PI / 4; const s2 = markFloor(box(DAIS, 0.85, 0.12, 0.36, stoneA, 1.3 * 0.7071, 0.6, 1.3 * 0.7071)); s2.rotation.y = Math.PI / 4;
    // lotus pedestal: a short drum, a ring of stone petals, a shallow bowl
    cyl(DAIS, 0.34, 0.42, 0.42, 10, stoneA, 0, 0.97, 0); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const pt = add(DAIS, new THREE.SphereGeometry(0.2, 7, 5), stoneB, Math.cos(a) * 0.36, 1.24, Math.sin(a) * 0.36); pt.scale.set(0.55, 0.42, 1.0); pt.rotation.y = -a; pt.rotation.x = 0.5; }
    cyl(DAIS, 0.4, 0.3, 0.12, 12, stoneA, 0, 1.3, 0);
    // sacred rope (注連縄) on three sides, open toward the steps; zigzag paper streamers (紙垂) hang from it
    const ropeM2 = sm('#c9b583'), paperM = new THREE.MeshStandardMaterial({ color: '#f1ede2', roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
    const PA = [0, 90, 180, 270].map(a => [Math.cos(a * deg) * 1.55, Math.sin(a * deg) * 1.55]); PA.forEach(([x, z]) => { cyl(DAIS, 0.05, 0.06, 1.35, 6, postM, x, 0.55 + 0.67, z); add(DAIS, new THREE.SphereGeometry(0.06, 6, 4), postM, x, 1.92, z); });
    [[0, 3], [3, 2], [2, 1]].forEach(([a, b]) => { const A = new THREE.Vector3(PA[a][0], 1.82, PA[a][1]), Bv = new THREE.Vector3(PA[b][0], 1.82, PA[b][1]); rope(DAIS, A, Bv, 0.28, 0.035, ropeM2);
      [0.3, 0.5, 0.7].forEach(t => { const p = new THREE.Vector3().lerpVectors(A, Bv, t); p.y -= 0.28 * 4 * t * (1 - t); const sh = new THREE.Group(); sh.position.copy(p); sh.rotation.y = Math.atan2(Bv.x - A.x, Bv.z - A.z) + Math.PI / 2; DAIS.add(sh);
        for (let k = 0; k < 4; k++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.1), paperM); q.position.set((k % 2 ? 0.04 : -0.04), -0.07 - k * 0.09, 0); sh.add(q); } (window.__shide = window.__shide || []).push(sh); }); });
    // a pair of small stone lanterns on the islet, either side of the approach
    [15, 75].forEach(a => { const x = Math.cos(a * deg) * 2.25, z = Math.sin(a * deg) * 2.25; const lg = new THREE.Group(); lg.position.set(x, 0.3, z); lg.scale.setScalar(0.62); DAIS.add(lg);
      cyl(lg, 0.3, 0.36, 0.16, 6, stoneA, 0, 0.08, 0); cyl(lg, 0.1, 0.13, 0.6, 8, stoneA, 0, 0.45, 0); cyl(lg, 0.3, 0.22, 0.12, 6, stoneA, 0, 0.8, 0);
      cyl(lg, 0.15, 0.15, 0.28, 8, new THREE.MeshStandardMaterial({ color: '#3a3128', emissive: '#ffb45e', emissiveIntensity: 0.55 }), 0, 1.0, 0, { cast: false }); cyl(lg, 0.05, 0.42, 0.26, 6, stoneA, 0, 1.27, 0); cyl(lg, 0.4, 0.42, 0.04, 6, stoneMoss, 0, 1.15, 0); }); }

  /* ---------- the voice stone (藏聲石) ---------- */
  const STONE_Y = 1.72; const VS = new THREE.Group(); VS.position.set(CX, STONE_Y, CZ); G.add(VS);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#d7cfba', roughness: 0.85, flatShading: true, emissive: '#5fa8ff', emissiveIntensity: 0 });
  const stoneMesh = add(VS, jitterRock(0.42, 1, 0.22, 77), stoneMat, 0, 0, 0); stoneMesh.scale.set(1.1, 0.85, 1.0);
  const holeBlue = new THREE.MeshBasicMaterial({ color: '#79b8ff' }), holeDark = M('#1a150f');
  [[0.55, 0.15, 0.25], [0.45, -0.05, 0.42], [0.25, 0.32, 0.45], [0.05, 0.05, 0.62], [0.6, 0.0, -0.05], [-0.2, 0.25, 0.5], [0.3, -0.25, 0.42]].forEach(([x, y, z], i) => add(VS, new THREE.SphereGeometry(0.05, 8, 6), i === 2 || i === 5 ? holeBlue : holeDark, x * 0.7, y * 0.6, z * 0.7, { cast: false }));
  const stoneLight = new THREE.PointLight(0x4f97ff, 0, 11, 1.6); VS.add(stoneLight);
  const stoneHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#8cc6ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); stoneHalo.scale.set(2.2, 2.2, 1); VS.add(stoneHalo);

  // boulders at the foot of the wall and along the low front edges (all sitting against the band)
  // the band's two ends disappear behind piles of big boulders; the open front is edged with low rocks only
  [[PHI0 + 0.02, 0], [PHI0 - 0.1, 1], [PHI0 - 0.22, 2], [PHI1 - 0.02, 3], [PHI1 + 0.1, 4], [PHI1 + 0.2, 5]].forEach(([phi, k]) => { const r = Rw(phi) - 0.2 + (k % 3) * 0.35, s = 2.2 - (k % 3) * 0.45; const m = add(G, smoothRock(s, 0.4, 300 + k), rockM[k % 3], Math.cos(phi) * r, s * 0.35 - 0.3, Math.sin(phi) * r); m.scale.y = 1.25 - (k % 3) * 0.2; const t = add(G, smoothRock(s * 0.75, 0.4, 320 + k), mossM, m.position.x, m.position.y + s * m.scale.y * 0.78, m.position.z); t.scale.set(1, 0.3, 1); });
  for (let i = 0; i < 26; i++) { const a0 = i < 13 ? 68 + (112 - 68) * i / 13 : 340 + (382 - 340) * (i - 13) / 13; const phi = a0 * deg; if (a0 > 360 + 2 && a0 < 360 + 22) continue; const r = 10.4 + hashR(i, 401) * 1.6, s = 0.55 + hashR(i, 402) * 0.75;
    const bx = Math.cos(phi) * r, bz = Math.sin(phi) * r; if (PATH_SEGS.some(([A, Bn]) => { const vx = Bn[0] - A[0], vz = Bn[1] - A[1]; let t = ((bx - A[0]) * vx + (bz - A[1]) * vz) / (vx * vx + vz * vz); t = Math.max(0, Math.min(1, t)); return Math.hypot(bx - A[0] - vx * t, bz - A[1] - vz * t) < s + 0.9; })) continue;
    const m = add(G, smoothRock(s, 0.45, 410 + i), rockM[i % 3], bx, 0.0, bz); m.scale.y = 0.6 + hashR(i, 403) * 0.4; if (hashR(i, 404) < 0.5) { const t = add(G, smoothRock(s * 0.8, 0.4, 440 + i), mossM, bx, m.scale.y * s * 0.75, bz); t.scale.set(1, 0.3, 1); } }
  for (let i = 0; i < 46; i++) { const phi = PHI0 + 0.04 + (PHI1 - PHI0 - 0.08) * (i + hashR(i, 1) * 0.6) / 46; const r = Rw(phi) - 0.6 - hashR(i, 2) * 0.9, s = 0.7 + hashR(i, 3) * 1.4;
    const bx = Math.cos(phi) * r, bz = Math.sin(phi) * r; if (Math.hypot(bx - WALLP[0], bz - WALLP[1]) < 3.3 || PATH_SEGS.some(([A, Bn]) => { const vx = Bn[0] - A[0], vz = Bn[1] - A[1]; let t = ((bx - A[0]) * vx + (bz - A[1]) * vz) / (vx * vx + vz * vz); t = Math.max(0, Math.min(1, t)); return Math.hypot(bx - A[0] - vx * t, bz - A[1] - vz * t) < s + 0.9; })) continue;
    const m = add(G, smoothRock(s, 0.45, i * 2.7), rockM[i % 3], bx, -0.2 + hashR(i, 4) * 0.4, bz); m.scale.y = 0.55 + hashR(i, 5) * 0.6;
    if (hashR(i, 6) < 0.45) { const t = add(G, smoothRock(s * 0.8, 0.4, i * 5.1), mossM, m.position.x, m.position.y + s * m.scale.y * 0.75, m.position.z); t.scale.set(1, 0.28, 1); } }

  /* ---------- lotus: leaves, white flowers (a few faintly glowing), buds ---------- */
  const distPath = (x, z) => { let best = 1e9; PATH_SEGS.forEach(([A, Bn]) => { const vx = Bn[0] - A[0], vz = Bn[1] - A[1]; let t = ((x - A[0]) * vx + (z - A[1]) * vz) / (vx * vx + vz * vz); t = Math.max(-0.15, Math.min(1.15, t)); best = Math.min(best, Math.hypot(x - A[0] - vx * t, z - A[1] - vz * t)); }); return best; };
  const okPad = (x, z, r) => distPath(x, z) > 0.95 + r && Math.hypot(x - CX, z - CZ) > 3.1 + r && Math.hypot(x, z) < 9.6 && Math.hypot(x - WALLP[0], z - WALLP[1]) > 2.6;
  const padM = [sm('#3f6a44'), sm('#4c7a4b'), sm('#5b7d45'), sm('#7f8a46'), sm('#8f7a42')];
  const padGeo = (r) => { const g = new THREE.CircleGeometry(r, 18, 0.18, Math.PI * 2 - 0.36); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), d = Math.hypot(x, y) / r; p.setZ(i, d * d * r * 0.12 + (d > 0.9 ? 0.012 : 0)); } g.computeVertexNormals(); return g; };
  const petalGeo = (() => { const g = new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(0.55, 1.6, 0.32); g.translate(0, 0, 0.0); return g; })();
  const flowerWhite = new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.6, flatShading: true, emissive: '#cfe6ff', emissiveIntensity: 0.06 }), flowerGlow = new THREE.MeshStandardMaterial({ color: '#f7f6f0', roughness: 0.5, flatShading: true, emissive: '#cfe6ff', emissiveIntensity: 0.38 }), centerM = sm('#e2c25c', { emissive: '#e2c25c', emissiveIntensity: 0.15 });
  const flowers = [], pads = [];
  function lotusFlower(x, z, s, glow, bud) { const f = new THREE.Group(); f.position.set(x, 0.05, z); f.scale.setScalar(s); G.add(f); const mat = glow ? flowerGlow : flowerWhite;
    const rings = bud ? [[5, 0.12, 0]] : [[7, 1.05, 0], [6, 0.62, 0.3], [5, 0.25, 0.6]];
    rings.forEach(([n, tilt, off]) => { for (let k = 0; k < n; k++) { const a = (k + off) / n * Math.PI * 2; const pg = new THREE.Group(); pg.rotation.y = a; f.add(pg); const p = new THREE.Mesh(petalGeo, mat); p.position.set(0, 0, bud ? 0.03 : 0.04); p.rotation.x = tilt; p.castShadow = false; pg.add(p); } });
    if (!bud) add(f, new THREE.CylinderGeometry(0.05, 0.06, 0.06, 8), centerM, 0, 0.05, 0, { cast: false });
    if (glow) { const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#bcdcff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.set(1.2, 1.2, 1); h.position.y = 0.15; f.add(h); f.userData.halo = h; }
    flowers.push({ f, glow, ph: hashR(x, z) * 6.28 }); return f; }
  let pk = 0; for (let i = 0; i < 900 && pads.length < 72; i++) { const a = hashR(i, 21) * Math.PI * 2, r = 1.0 + Math.sqrt(hashR(i, 22)) * 8.6; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const cl = fbm(x * 0.28 + 4, z * 0.28 + 9); if (cl < 0.47) continue; const pr = 0.32 + hashR(i, 23) * 0.4; if (!okPad(x, z, pr)) continue; if (pads.some(p => Math.hypot(p.x - x, p.z - z) < p.r + pr + 0.05)) continue;
    const m = new THREE.Mesh(padGeo(pr), padM[(pk++) % 5 < 3 ? (pk % 3) : 3 + (pk % 2)]); m.rotation.x = -Math.PI / 2; m.rotation.z = hashR(i, 24) * 6.28; m.position.set(x, 0.012, z); m.receiveShadow = true; G.add(m); pads.push({ m, x, z, r: pr, ph: hashR(i, 25) * 6.28 });
    if (hashR(i, 26) < 0.3 && pr > 0.4) lotusFlower(x + 0.05, z - 0.03, 1.5 + hashR(i, 27) * 0.6, hashR(i, 28) < 0.5, false); else if (hashR(i, 29) < 0.1) lotusFlower(x, z, 1.4, false, true); }

  /* ---------- floating maple leaves, one falling through the light now and then ---------- */
  const LEAFN = 46, leafG = new THREE.BufferGeometry(); { const pts = [0, 0, 0]; const lobes = [[0, 0.16], [0.12, 0.09], [0.15, -0.02], [0.06, -0.06], [0, -0.11], [-0.06, -0.06], [-0.15, -0.02], [-0.12, 0.09]]; const V = []; for (let k = 0; k < lobes.length; k++) { const a = lobes[k], b = lobes[(k + 1) % lobes.length]; V.push(0, 0, 0, a[0], 0, -a[1], b[0], 0, -b[1]); } leafG.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); leafG.computeVertexNormals(); }
  const leafI = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }), LEAFN + 1); leafI.receiveShadow = true; G.add(leafI);
  const LCOL = ['#b8412b', '#c95a2f', '#d77e35', '#a8352a', '#cf9a3c'].map(c => new THREE.Color(c)); const lv = [], _q = new THREE.Object3D();
  for (let i = 0; i < LEAFN; i++) { let x, z, tries = 0; do { const a = hashR(i, 41 + tries) * 6.28, r = 1.5 + hashR(i, 42 + tries) * 8; x = Math.cos(a) * r; z = Math.sin(a) * r; tries++; } while ((distPath(x, z) < 0.8 || Math.hypot(x - CX, z - CZ) < 3.0) && tries < 20);
    lv.push({ x, z, a: hashR(i, 43) * 6.28, s: 0.9 + hashR(i, 44) * 0.7, vx: 0, vz: 0, spin: (hashR(i, 45) - 0.5) * 0.1 }); leafI.setColorAt(i, LCOL[i % 5]); }
  leafI.setColorAt(LEAFN, LCOL[1]); const faller = { on: false, t: 0, x: 0, y: 0, z: 0, next: 4 };

  /* ---------- light: one shaft from a crack high in the back, a warm pool on the dais, cool fill off the water ---------- */
  const SH_O = new THREE.Vector3(CX - 3.4, 15, CZ - 5.2), SH_T = new THREE.Vector3(CX, 0.6, CZ);
  const spot = new THREE.SpotLight(0xffe9c8, 2.6, 60, 0.2, 0.75, 1.0); spot.position.copy(SH_O); spot.target.position.copy(SH_T); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0008; G.add(spot, spot.target);
  const fill = new THREE.PointLight(0xe8dcc0, 1.15, 15, 1.4); fill.position.set(CX + 2.2, 4.2, CZ + 2.6); G.add(fill); const fill2 = new THREE.PointLight(0x9cc8d8, 0.55, 13, 1.5); fill2.position.set(4.5, 2.5, 3.5); G.add(fill2);
  const daisGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffe2b0', transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending })); daisGlow.position.set(CX, 1.2, CZ); daisGlow.scale.set(7.5, 5, 1); daisGlow.renderOrder = 5; G.add(daisGlow); noRefl.push(daisGlow);
  const SHAFT_FS = NOISE_GLSL + `varying vec2 vUv; uniform float uTime, uA; uniform vec3 uCol;
  void main(){ float x = vUv.x, y = vUv.y; float edge = smoothstep(0., 0.42, x) * smoothstep(0., 0.42, 1. - x); edge *= edge;
    float len = smoothstep(0., 0.18, y) * (0.55 + 0.45 * smoothstep(1., 0.35, y));
    float n = 0.75 + 0.25 * vn(vec2(x * 6. + uTime * 0.05, y * 2. - uTime * 0.08));
    gl_FragColor = vec4(uCol * edge * len * n * uA, 1.); }`;
  const shafts = [[2.6, 0.26], [1.3, 0.3], [4.8, 0.12]].map(([w, a]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uA: { value: a }, uCol: { value: new THREE.Color('#fff0d4') } }, vertexShader: UV_VS, fragmentShader: SHAFT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.renderOrder = 6; m.frustumCulled = false; m.userData = { w, a }; G.add(m); return m; });
  const _ax = new THREE.Vector3(), _cd2 = new THREE.Vector3(), _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _mx = new THREE.Matrix4();
  function aimShafts() { _ax.subVectors(SH_O, SH_T); const L = _ax.length(); _ax.normalize(); cam.getWorldDirection(_cd2).negate(); _bz.copy(_cd2).addScaledVector(_ax, -_cd2.dot(_ax)).normalize(); _bx.crossVectors(_ax, _bz).normalize();
    shafts.forEach(m => { _mx.makeBasis(_bx, _ax, _bz); m.quaternion.setFromRotationMatrix(_mx); m.scale.set(m.userData.w, L * 1.05, 1); m.position.copy(SH_T).addScaledVector(_ax, L * 0.5); }); }
  // hanging roots and a maple branch at the top of the crack, out of the traveller's reach
  { const rootM = new THREE.MeshLambertMaterial({ color: '#3f5a3b', side: THREE.DoubleSide }); for (let i = 0; i < 26; i++) { const t = hashR(i, 61), len = 1.5 + hashR(i, 62) * 4; const p = new THREE.Vector3().lerpVectors(SH_T, SH_O, 0.62 + t * 0.35); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + hashR(i, 63) * 0.05, len), rootM); noRefl.push(m); m.position.set(p.x + (hashR(i, 64) - 0.5) * 3, p.y - len / 2, p.z + (hashR(i, 65) - 0.5) * 3); m.rotation.y = hashR(i, 66) * 3; G.add(m); }
    const br = new THREE.Group(); noRefl.push(br); br.position.copy(new THREE.Vector3().lerpVectors(SH_T, SH_O, 0.78)); G.add(br); cyl(br, 0.05, 0.09, 3.2, 5, woodDark, 0.6, 0, 0.4, { rz: 1.1 });
    for (let k = 0; k < 9; k++) { const b = add(br, new THREE.IcosahedronGeometry(0.35 + hashR(k, 71) * 0.25, 0), [M('#b8412b'), M('#cc5a30'), M('#a8352a')][k % 3], -0.6 + hashR(k, 72) * 2.4, -0.3 + hashR(k, 73) * 0.6, hashR(k, 74) * 1.2); b.scale.y = 0.6; } }

  /* ---------- mist on the water, motes drifting in the dark ---------- */
  const mist = []; for (let k = 0; k < 16; k++) { const a = hashR(k, 81) * 6.28, r = 1 + hashR(k, 82) * 8; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#d4e2da', transparent: true, opacity: 0, depthWrite: false })); sp.renderOrder = 4; sp.position.set(Math.cos(a) * r, 0.35 + hashR(k, 83) * 0.6, Math.sin(a) * r); sp.scale.set(5 + hashR(k, 84) * 4, 1.2 + hashR(k, 85) * 0.8, 1); G.add(sp); mist.push({ sp, x: sp.position.x, z: sp.position.z, ph: k * 0.9, op: 0.16 + hashR(k, 86) * 0.12 }); }
  const MOTE_N = 300, mP = new Float32Array(MOTE_N * 3), mA = new Float32Array(MOTE_N), mS = new Float32Array(MOTE_N), mV = new Float32Array(MOTE_N * 3), mHome = new Float32Array(MOTE_N * 3), mWarm = new Float32Array(MOTE_N);
  for (let i = 0; i < MOTE_N; i++) { let x, y, z; if (i < 80) { const t = hashR(i, 91); const p = new THREE.Vector3().lerpVectors(SH_T, SH_O, t * 0.55); x = p.x + (hashR(i, 92) - 0.5) * 1.6; y = p.y; z = p.z + (hashR(i, 93) - 0.5) * 1.6; mWarm[i] = 1; } else { const a = hashR(i, 94) * 6.28, r = Math.sqrt(hashR(i, 95)) * 9.5; x = Math.cos(a) * r; z = Math.sin(a) * r; y = 0.3 + hashR(i, 96) * 4.5; }
    mHome.set([x, y, z], i * 3); mP.set([x, y, z], i * 3); mS[i] = 0.05 + hashR(i, 97) * 0.06; }
  const moteG = new THREE.BufferGeometry(); moteG.setAttribute('position', new THREE.BufferAttribute(mP, 3)); moteG.setAttribute('aAlpha', new THREE.BufferAttribute(mA, 1)); moteG.setAttribute('aSize', new THREE.BufferAttribute(mS, 1)); moteG.setAttribute('aWarm', new THREE.BufferAttribute(mWarm, 1));
  const MOTE_VS = `attribute float aSize; attribute float aAlpha; attribute float aWarm; varying float vA; varying float vW; uniform float uPx; void main(){ vA = aAlpha; vW = aWarm; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = max(1.0, aSize * uPx); }`;
  const MOTE_FS = `varying float vA; varying float vW; uniform vec3 uCool, uWarmC; void main(){ float d = length(gl_PointCoord - 0.5); float a = 1. - smoothstep(0.05, 0.5, d); gl_FragColor = vec4(mix(uCool, uWarmC, vW) * a * vA, 1.); }`;
  const moteM = new THREE.ShaderMaterial({ uniforms: { uPx: { value: 40 }, uCool: { value: new THREE.Color('#bfe2ff') }, uWarmC: { value: new THREE.Color('#ffe6bf') } }, vertexShader: MOTE_VS, fragmentShader: MOTE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const motes = new THREE.Points(moteG, moteM); motes.frustumCulled = false; motes.renderOrder = 7; G.add(motes);
  // grit shaken from the sealed wall's seams
  const GRIT_N = 90, gP = new Float32Array(GRIT_N * 3), gV = new Float32Array(GRIT_N * 3), gL = new Float32Array(GRIT_N), gA = new Float32Array(GRIT_N), gS = new Float32Array(GRIT_N).fill(0.035);
  const gritG = new THREE.BufferGeometry(); gritG.setAttribute('position', new THREE.BufferAttribute(gP, 3)); gritG.setAttribute('aAlpha', new THREE.BufferAttribute(gA, 1)); gritG.setAttribute('aSize', new THREE.BufferAttribute(gS, 1)); gritG.setAttribute('aWarm', new THREE.BufferAttribute(new Float32Array(GRIT_N).fill(1), 1));
  const gritM = moteM.clone(); gritM.blending = THREE.NormalBlending; gritM.uniforms.uWarmC.value = new THREE.Color('#9fa79f'); const grit = new THREE.Points(gritG, gritM); grit.frustumCulled = false; G.add(grit); let gk = 0;
  function shakeGrit(n) { const wp = new THREE.Vector3(); for (let q = 0; q < n; q++) { const i = gk++ % GRIT_N; const sx = (Math.random() < 0.5 ? -0.6 : 0.6) + (Math.random() - 0.5) * 0.05; wp.set(sx, 1.2 + Math.random() * 3, 0.3).applyMatrix4(sealed.matrix); gP.set([wp.x, wp.y, wp.z], i * 3); gV.set([(Math.random() - 0.5) * 0.1, -0.2, (Math.random() - 0.5) * 0.1], i * 3); gL[i] = 1; } }

  /* ---------- sound in the cave ---------- */
  const waves = []; // mirror of the cave's pulses, so motes and leaves can feel the wavefront
  function cavePulse(x, y, z, o) { pulse(x, y, z, Object.assign({ parent: G, cut: WY + 0.005, dust: 0 }, o)); waves.push({ x, y, z, R: o.R, r0: o.r0 || 0.15, dur: o.dur || 1.8, t: -(o.delay || 0), push: o.push === undefined ? 1 : o.push, inward: !!o.inward }); }
  let humT = 3.0, stoneHere = true, glowBoost = 0, holeFlash = 0;
  function hum(k = 1) { if (!stoneHere) return;sound(busy==='core'?'coreHum':'hum',{k}); cavePulse(CX, STONE_Y, CZ, { R: 5.2 * k, r0: 0.35, dur: 3.8, amp: 0.48 * k, col: '#bfe0ff', push: 0.8 * k }); ripple(CX, CZ, 0.7 * k); holeFlash = 1; glowBoost = Math.max(glowBoost, 0.6 * k); }

  /* ---------- traveller in the cave: follows a route of nodes, then acts ---------- */
  const SAVE = {}; let route = null, ri = 0, afterRoute = null; const V_CAVE = 0.95; let visiting = false, visitDone = null;
  const routePts = names => names.map(n => NODES[n]);
  function walk(names, then) { route = routePts(names); ri = 1; afterRoute = then; TR.mode = 'walk'; }
  function standAt(name, look) { const n = NODES[name]; TR.x = n[0]; TR.z = n[1]; TR.cy = n[2]; if (look) TR.hd = Math.atan2(look[0] - TR.x, look[1] - TR.z); }
  function act(spot, dur) { TR.mode = 'act'; TR.spot = spot; TR.t = 0; TR.dwell = dur; }

  /* ---------- director: camera, subtitles, toasts, timelines ---------- */
  const camT = { x: 0, y: 1.0, z: 0, vh: 15 }, camC = { x: 0, y: 1.0, z: 0, vh: 15 }; let camK = 1.2;
  const HOME = { x: 2.0, y: 0.2, z: 1.7, vh: 15 }; // framed a little high so the HUD panel never covers the boardwalk or the entrance
  function camTo(o, k) { Object.assign(camT, o); camK = k || 1.2; }
  let tl = null; // { t, steps:[[time, fn]], i }
  function timeline(steps) { tl = { t: 0, steps: steps.sort((a, b) => a[0] - b[0]), i: 0 }; }
  const subEl = document.createElement('div'); subEl.id = 'caveSub'; document.body.appendChild(subEl);
  const toastEl = document.createElement('div'); toastEl.id = 'caveToast'; document.body.appendChild(toastEl);
  const flashEl = document.createElement('div'); flashEl.id = 'caveFlash'; document.body.appendChild(flashEl);
  const vigEl = document.createElement('div'); vigEl.id = 'caveVig'; document.body.appendChild(vigEl);
  function sub(t,dur){subEl.textContent=t;subEl.style.opacity=1;sub.until=dur?tAcc+dur:Infinity;}
  function toast(t){toastEl.innerHTML=t;toastEl.style.opacity=1;toast.until=tAcc+5.2;}
  let flash = 0, busy = '';

  /* ---------- events ---------- */
  function resetCave() { tl = null; busy = ''; ascend=0;shrinkT=-1;stoneHere=!stoneOwned;VS.visible=stoneHere; VS.position.set(CX, STONE_Y, CZ); VS.scale.setScalar(1); VS.rotation.set(0, 0, 0); stoneMat.emissiveIntensity = 0; stoneLight.intensity = 0; stoneHalo.material.opacity = 0;
    humT = 2.5; route = null; standAt('L0', [NODES.B1[0], NODES.B1[1]]); TR.mode = 'act'; TR.spot = 'cv_look'; TR.t = 0; TR.dwell = 1e9; camTo(HOME, 1.0); subEl.style.opacity = 0; sealed.position.y = 0; say('洞裡很靜。水面像一面鏡子，藏聲石每過一會兒就低低地鳴一聲。'); }
  function evSecond() { // second visit: the first walk into the cave, a voice in the rock: "……柴都濕了。"
    resetCave(); busy = 'second'; standAt('E1', [NODES.E1[0], NODES.E1[1]]); camTo({ x: 6.5, y: 0.8, z: 2.6, vh: 12 }, 3); say('旅人走進共鳴洞。');
    walk(ROUTE_IN.slice(1), () => { act('cv_look', 2.4); camTo({ x: 0.2, y: 1.2, z: 3.2, vh: 13 }, 0.9); say('旅人在岔口停下，左邊的岩壁裡好像有聲音。');
      timeline([[1.2, () => {sound('wallWarm');cavePulse(WALLP[0] + 0.6, 2.1, WALLP[1] + 0.1, { R: 2.2, r0: 0.3, dur: 2.4, amp: 0.22, col: '#e9dccb', push: 0.4 });}],
        [2.4, () => walk(ROUTE_WALL, () => { act('cv_wall', 1e9); TR.hd = Math.atan2(WALLP[0] - TR.x, WALLP[1] - TR.z); camTo({ x: (WALLP[0] + NODES.WL[0]) / 2 + 0.3, y: 1.7, z: (WALLP[1] + NODES.WL[1]) / 2 + 0.2, vh: 8.5 }, 0.7);
          timeline([[1.4, () => { sound('murmur');cavePulse(WALLP[0] + 0.35, 1.9, WALLP[1] + 0.06, { R: 1.8, r0: 0.25, dur: 2.6, amp: 0.3, col: '#efdcc4', push: 0.5 }); sub('……柴都濕了。', 4.2); say('岩壁裡有人低低地說了一句話。'); }],
            [2.6, () => cavePulse(WALLP[0] + 0.35, 1.9, WALLP[1] + 0.06, { R: 2.6, r0: 0.25, dur: 3.2, amp: 0.16, col: '#efdcc4', push: 0.3 })],
            [6.2, () => { toast('<b>永久線索 h2c</b>　共鳴洞的岩壁裡有人說話：「……柴都濕了。」'); camTo(HOME, 0.8); act('cv_look', 1e9); busy='';say('旅人在封住的牆前站了很久。');if(storyDone)walk([...ROUTE_WALL].reverse().concat([...ROUTE_IN].reverse().slice(1,-1)),finishStory); }]]); })]]); }); }
  function evWhistle() { // copper wind-whistle (04): blown at the wind-hole crag outside; in here the sealed wall hums
    if (busy) return; busy = 'whistle'; camTo({ x: WALLP[0] + 2.6, y: 2.0, z: WALLP[1] + 0.6, vh: 10 }, 1.1); say('外面的風孔岩傳來風哨聲。');
    timeline([[0.9, () => { sound('whistle');for (let k = 0; k < 4; k++) cavePulse(WALLP[0] + 0.45, 2.2, WALLP[1] + 0.07, { R: 3.4 + k * 0.4, r0: 0.6, dur: 2.8, amp: 0.42 - k * 0.06, delay: k * 0.75, col: '#eadfce', push: 0.7 }); shakeGrit(30); wallBuzz = 3.6; say('封住的牆跟著嗡了起來，像後面是空的。'); }],
      [2.5, () => shakeGrit(30)], [4.6, () => { toast('<b>信物：銅製風哨</b>　風哨一響，洞裡有一面牆跟著嗡，那後面是空的。'); camTo(HOME,.8);busy='';if(storyDone)finishStory();}]]);}
  let wallBuzz = 0;
  function evCore() { // the map core: blue light, the stone shrinks into the luggage
    stoneOwned=false;resetCave();busy='core';standAt('E1',[NODES.L0[0],NODES.L0[1]]); camTo({ x: 0.0, y: 1.0, z: 0.4, vh: 12 }, 1.2); say('旅人走向光柱下的石壇。');
    walk(ROUTE_IN.slice(1).concat(ROUTE_STONE.slice(1)), () => { act('cv_stone', 1e9); TR.hd = Math.atan2(CX - TR.x, CZ - TR.z); camTo({ x: CX + 0.35, y: 1.45, z: CZ + 0.35, vh: 7.5 }, 0.9); humT = 99;
      sound('coreStart',{timelineRate:rate()});
      timeline([[0.6, () => { hum(1.0); say('藏聲石亮了起來，一聲比一聲急。'); }], [1.5, () => hum(1.1)], [2.2, () => hum(1.25)], [2.7, () => { ascend = 1; }],
        [3.6, () => { sound('coreWave');cavePulse(CX, STONE_Y + 0.4, CZ, { R: 15, r0: 0.5, dur: 4.4, amp: 1.0, col: '#5fa8ff', push: 2.2 }); cavePulse(CX, STONE_Y + 0.4, CZ, { R: 22, r0: 0.5, dur: 6, amp: 0.4, delay: 0.35, col: '#8cc4ff', push: 0 }); ripple(CX, CZ, 1.6); flash = 1; say('一道藍光從石頭裡湧出來，整座洞都亮了。'); }],
        [5.0, () => { shrinkT = 0; camTo({ x: CX + 0.6, y: 1.4, z: CZ + 0.6, vh: 9 }, 0.8); }],
        [7.6, () => { sound('coreMotif');stoneHere=false;stoneOwned=true;VS.visible=false;ascend=0; cavePulse(packPos.x, packPos.y, packPos.z, { R: 1.4, r0: 0.1, dur: 1.4, amp: 0.6, col: '#9fd2ff', push: 0.3 }); say('藏聲石縮成一顆小石子，收進了旅人的行李。'); }],
        [9.6, () => { toast('<b>地圖核心：藏聲石</b>　會留住聲音的石頭，收進了行李。'); camTo(HOME, 0.7); act('cv_look',1e9);busy='';if(storyDone)walk([...ROUTE_STONE].reverse().concat([...ROUTE_IN].reverse().slice(1,-1)),finishStory);}]]);});}
  // 聽回音: the stone keeps the sounds made in the valley and lets them out again. The traveller walks in as far as the fork,
  // listens to his own sound come back from the stone, and walks out. He never crosses the sacred rope: the stone has not answered him.
  const ECHO = {
    chime: { name: '石磬', line: '藏聲石放出兩個音，正是剛才石磬的那一下。', play: () => { cavePulse(CX, STONE_Y, CZ, { R: 4.2, r0: 0.3, dur: 2.6, amp: 0.55, col: '#ffe4bf', push: 0.8 }); cavePulse(CX, STONE_Y, CZ, { R: 5.2, r0: 0.3, dur: 3.2, amp: 0.4, delay: 1.2, col: '#cfe6ff', push: 0.6 }); } },
    echo: { name: '巨石的回聲', line: '藏聲石把旅人剛才拍手的那一聲，慢慢地還了回來。', play: () => { cavePulse(CX, STONE_Y, CZ, { R: 4.0, r0: 0.3, dur: 2.4, amp: 0.5, col: '#ffe4bf', push: 0.7 }); cavePulse(CX, STONE_Y, CZ, { R: 4.4, r0: 0.4, dur: 1.8, amp: 0.4, delay: 1.6, inward: true, col: '#cfe6ff', push: 0 }); } },
    bell: { name: '鐘聲', line: '藏聲石低低地放出一聲鐘響，是鐘樓那一下。', play: () => { cavePulse(CX, STONE_Y + 0.2, CZ, { R: 9.5, r0: 0.6, dur: 4.6, amp: 0.55, col: '#ffe4bf', push: 1.2 }); cavePulse(CX, STONE_Y + 0.2, CZ, { R: 13, r0: 0.6, dur: 6, amp: 0.22, delay: 0.4, col: '#d8e8ff', push: 0 }); ripple(CX, CZ, 0.9); } },
    wind: { name: '風孔岩的嗚聲', line: '藏聲石裡傳出風穿過孔洞的一聲長嗚。', play: () => { cavePulse(CX, STONE_Y, CZ, { R: 4.2, r0: 0.4, dur: 3.3, amp: 0.36, col: '#e2ddd2', push: 0.5 }); } },
    wall: { name: '聲壁', line: '藏聲石悶悶地響了一下，像剛才敲聲壁的那一聲。', play: () => { cavePulse(CX, STONE_Y, CZ, { R: 4.6, r0: 0.5, dur: 2.4, amp: 0.5, col: '#ead9c0', push: 0.8 }); } }
  };
  function visit(kind, onDone) { // called by the outdoor runtime after the traveller has walked into the cave mouth
    enter('visit'); visiting = true; visitDone = onDone; busy = 'visit'; standAt('E1', [NODES.L0[0], NODES.L0[1]]); camTo(HOME, 1.0); Object.assign(camC, HOME); humT = 99;
    const E = ECHO[kind] || ECHO.chime; say('旅人循著回音走進共鳴洞。');
    walk(['E1', 'L0', 'B1', 'B2', 'J'], () => { act('cv_wall', 1e9); TR.spot = 'cv_listen'; TR.hd = Math.atan2(CX - TR.x, CZ - TR.z); camTo({ x: 0.6, y: 0.6, z: 0.9, vh: 12.5 }, 0.8);
      timeline([[1.0, () => { sound('caveEcho',{echo:kind});E.play(); holeFlash = 1; glowBoost = 0.7; say(E.line); }], [7.0, () => { camTo(HOME, 0.8); humT = 3; walk(['J', 'B2', 'B1', 'L0', 'E1'], () => { const f = visitDone; visitDone = null; busy = ''; if (f) f(); }); }]]); }); }
  let ascend = 0, shrinkT = -1; const packPos = new THREE.Vector3(), _sp = new THREE.Vector3();

  /* ---------- enter / leave ---------- */
  function enter(mode) { if (inCave) return; inCave = true; Object.assign(SAVE, { x: TR.x, z: TR.z, hd: TR.hd, mode: TR.mode, spot: TR.spot, t: TR.t, dwell: TR.dwell, playing });
    if (mode !== 'visit') playing = false; out.visible = false; G.visible = true; G.add(trav); document.body.classList.add(mode === 'visit' ? 'inCaveVisit' : 'inCave'); resetCave(); Object.assign(camC, HOME); placeCaveCam(); }
  function leave(mode) { if (!inCave) return; const wasVisit = visiting; inCave = false; visiting = false; tl = null; busy = ''; G.visible = false; out.visible = true; out.add(trav); document.body.classList.remove('inCave', 'inCaveVisit');
    if (wasVisit) { CT.set(5.0, -0.5, 5.0); VHU = 22.5; resizeAll(); window.__holdCam = false; return; }
    Object.assign(TR, { x: SAVE.x, z: SAVE.z, hd: SAVE.hd, mode: SAVE.mode, spot: SAVE.spot, t: SAVE.t, dwell: SAVE.dwell }); TR.y = groundY(TR.x, TR.z); playing = !!SAVE.playing; $('play').textContent = playing ? '暫停' : (started ? '繼續' : '開始專注');
    CT.set(5.0, -0.5, 5.0); VHU = 22.5; resizeAll(); window.__holdCam = false; subEl.style.opacity = 0; say('旅人走出共鳴洞。'); }
  function placeCaveCam() { CT.set(400 + camC.x, camC.y, camC.z); VHU = camC.vh; resizeAll(); }

  /* ---------- per-frame ---------- */
  function update(dt) {
    const T=tAcc;if(tAcc>=sub.until)subEl.style.opacity=0;if(tAcc>=toast.until)toastEl.style.opacity=0;
    // timeline
    const tdt = visiting ? dt * rate() : dt; // during a visit the traveller and the timeline run on the focus clock, like outdoors
    if (tl) { tl.t += tdt; while (tl && tl.i < tl.steps.length && tl.t >= tl.steps[tl.i][0]) { const fn = tl.steps[tl.i][1]; tl.i++; fn(); } if (tl && tl.i >= tl.steps.length) tl = null; }
    // traveller
    if (TR.mode === 'walk' && route) { let step = V_CAVE * tdt; TR.phase += V_CAVE * tdt * 9;
      while (step > 0 && route && ri < route.length) { const w = route[ri], dx = w[0] - TR.x, dz = w[1] - TR.z, d = Math.hypot(dx, dz), p0 = route[ri - 1];
        if (d <= step) { TR.x = w[0]; TR.z = w[1]; TR.cy = w[2]; step -= d; ri++; } else { TR.x += dx / d * step; TR.z += dz / d * step; const segL = Math.hypot(w[0] - p0[0], w[1] - p0[1]) || 1; const u = 1 - (d - step) / segL; TR.cy = p0[2] + (w[2] - p0[2]) * Math.max(0, Math.min(1, u)); step = 0; }
        if (d > 0.02) { const tg = Math.atan2(dx, dz); let da = tg - TR.hd; da = Math.atan2(Math.sin(da), Math.cos(da)); TR.hd += da * Math.min(1, dt * 8); } }
      if (route && ri >= route.length) { route = null; TR.mode = 'act'; TR.spot = 'cv_look'; TR.t = 0; TR.dwell = 1e9; const f = afterRoute; afterRoute = null; if (f) f(); } }
    else if (TR.mode === 'act') TR.t += tdt;
    TR.y = TR.cy; poseTraveller(dt);
    // the stone's hum every 8 s
    if (stoneHere && (!busy || busy === 'visit')) { humT -= dt; if (humT <= 0) { humT = 8; hum(1); } }
    holeFlash = Math.max(0, holeFlash - dt * 0.7); glowBoost = Math.max(0, glowBoost - dt * 0.35);
    holeBlue.color.setRGB(0.3 + 0.6 * holeFlash + 0.4 * ascend, 0.55 + 0.4 * holeFlash + 0.3 * ascend, 0.95);
    if (stoneHere) { const k = Math.max(glowBoost, ascend); stoneMat.emissiveIntensity = 0.05 + 0.9 * k; stoneLight.intensity = 0.15 + 2.2 * k + 4.0 * ascend; stoneHalo.material.opacity = 0.08 + 0.55 * k; stoneHalo.scale.setScalar(1.6 + 1.8 * k); }
    if (ascend > 0) { VS.position.y += (STONE_Y + 0.45 - VS.position.y) * Math.min(1, dt * 1.5); VS.rotation.y += dt * (0.6 + 2 * (shrinkT >= 0 ? 1 : 0)); }
    if (shrinkT >= 0 && stoneHere) { shrinkT += dt; const u = Math.min(1, shrinkT / 2.6), e = u * u * (3 - 2 * u); TR.mode === 'act';
      trav.updateMatrixWorld(true); upper.children[1].getWorldPosition(packPos); G.worldToLocal(packPos);
      _sp.set(CX, STONE_Y + 0.45, CZ).lerp(packPos, e); _sp.y += Math.sin(Math.PI * e) * 0.8; VS.position.copy(_sp); VS.scale.setScalar(1 - 0.88 * e);
      if (Math.random() < dt * 30) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#8cc6ff', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.copy(VS.position); sp.scale.setScalar(0.3); G.add(sp); trail.push({ sp, life: 1 }); }
      if (u >= 1) shrinkT = -1; }
    for (let i = trail.length - 1; i >= 0; i--) { const q = trail[i]; q.life -= dt * 1.1; q.sp.material.opacity = 0.7 * Math.max(0, q.life); q.sp.scale.setScalar(0.3 + (1 - q.life) * 0.3); if (q.life <= 0) { G.remove(q.sp); q.sp.material.dispose(); trail.splice(i, 1); } }
    flash = Math.max(0, flash - dt * 0.55); flashEl.style.opacity = (flash * 0.42).toFixed(3);
    // waves: mirror the shells so motes can feel the wavefront
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.t += dt; if (w.t > w.dur) waves.splice(i, 1); }
    // motes: drift around home, pushed outward when a wavefront passes, pulled in while the stone ascends
    for (let i = 0; i < MOTE_N; i++) { const j = i * 3; let fx = (mHome[j] - mP[j]) * 0.25, fy = (mHome[j + 1] - mP[j + 1]) * 0.25, fz = (mHome[j + 2] - mP[j + 2]) * 0.25;
      fx += Math.sin(T * 0.21 + i * 1.7) * 0.05; fy += Math.sin(T * 0.17 + i * 0.9) * 0.04; fz += Math.cos(T * 0.19 + i * 1.3) * 0.05;
      for (const w of waves) { if (w.t < 0 || !w.push) continue; const u = w.t / w.dur, e = 1 - Math.pow(1 - u, 2.2), r = w.r0 + (w.R - w.r0) * e; const dx = mP[j] - w.x, dy = mP[j + 1] - w.y, dz = mP[j + 2] - w.z, d = Math.hypot(dx, dy, dz) + 1e-3; const k = Math.exp(-Math.pow((d - r) / 0.6, 2)) * w.push * (1 - u) * 3.5; fx += dx / d * k; fy += dy / d * k * 0.6; fz += dz / d * k; }
      if (ascend > 0 && shrinkT < 0 && stoneHere) { const dx = CX - mP[j], dy = STONE_Y + 0.4 - mP[j + 1], dz = CZ - mP[j + 2], d = Math.hypot(dx, dy, dz) + 0.3; if (d < 7) { fx += dx / d * 1.2; fy += dy / d * 1.2; fz += dz / d * 1.2; } }
      mV[j] = mV[j] * 0.94 + fx * dt * 2; mV[j + 1] = mV[j + 1] * 0.94 + fy * dt * 2; mV[j + 2] = mV[j + 2] * 0.94 + fz * dt * 2; mP[j] += mV[j] * dt; mP[j + 1] = Math.max(0.08, mP[j + 1] + mV[j + 1] * dt); mP[j + 2] += mV[j + 2] * dt;
      const tw = 0.55 + 0.45 * Math.sin(T * (0.6 + (i % 7) * 0.13) + i); mA[i] = (mWarm[i] ? 0.55 * shaftA : 0.5) * tw * (1 + 0.8 * glowBoost); }
    moteG.attributes.position.needsUpdate = true; moteG.attributes.aAlpha.needsUpdate = true; moteM.uniforms.uPx.value = renderer.domElement.height / ((cam.top - cam.bottom) / cam.zoom); gritM.uniforms.uPx.value = moteM.uniforms.uPx.value;
    for (let i = 0; i < GRIT_N; i++) { if (gL[i] <= 0) { gA[i] = 0; continue; } gL[i] -= dt / 2.4; const j = i * 3; gV[j + 1] -= 2.2 * dt; gP[j] += gV[j] * dt; gP[j + 1] = Math.max(0.02, gP[j + 1] + gV[j + 1] * dt); gP[j + 2] += gV[j + 2] * dt; gA[i] = Math.max(0, gL[i]) * 0.9; }
    gritG.attributes.position.needsUpdate = true; gritG.attributes.aAlpha.needsUpdate = true;
    wallBuzz = Math.max(0, wallBuzz - dt); sealed.position.x = WALLP[0] + (wallBuzz > 0 ? Math.sin(T * 61) * 0.008 * Math.min(1, wallBuzz) : 0);
    // lotus, pads, mist bob on the still water; a wave nudges them
    pads.forEach(p => { p.m.position.y = 0.012 + Math.sin(T * 0.6 + p.ph) * 0.004; });
    flowers.forEach(fl => { fl.f.rotation.y = Math.sin(T * 0.15 + fl.ph) * 0.12; if (fl.f.userData.halo) fl.f.userData.halo.material.opacity = (0.16 + 0.08 * Math.sin(T * 0.7 + fl.ph)) * (1 + 1.5 * glowBoost); });
    flowerGlow.emissiveIntensity = 0.32 + 0.4 * glowBoost;
    mist.forEach(m => { m.sp.position.x = m.x + Math.sin(T * 0.05 + m.ph) * 1.2; m.sp.position.z = m.z + Math.cos(T * 0.04 + m.ph) * 0.8; m.sp.material.opacity = m.op * (0.8 + 0.2 * Math.sin(T * 0.2 + m.ph)); });
    (window.__shide || []).forEach((s, k) => s.rotation.z = Math.sin(T * 0.9 + k) * 0.05);
    // floating leaves: a very slow current around the pool, pushed by the stone's wave
    for (let i = 0; i < LEAFN; i++) { const L = lv[i]; const r = Math.hypot(L.x, L.z) + 1e-3; let vx = -L.z / r * 0.025, vz = L.x / r * 0.025;
      for (const w of waves) { if (w.t < 0 || !w.push) continue; const u = w.t / w.dur, e = 1 - Math.pow(1 - u, 2.2), rr = w.r0 + (w.R - w.r0) * e; const dx = L.x - w.x, dz = L.z - w.z, d = Math.hypot(dx, dz) + 1e-3; const k = Math.exp(-Math.pow((d - rr) / 0.8, 2)) * w.push * (1 - u) * 0.6; vx += dx / d * k; vz += dz / d * k; }
      L.vx += (vx - L.vx) * Math.min(1, dt * 1.5); L.vz += (vz - L.vz) * Math.min(1, dt * 1.5); let nx = L.x + L.vx * dt, nz = L.z + L.vz * dt;
      if (distPath(nx, nz) < 0.75 || Math.hypot(nx - CX, nz - CZ) < 2.95 || Math.hypot(nx, nz) > 9.6) { L.vx *= -0.5; L.vz *= -0.5; nx = L.x; nz = L.z; } L.x = nx; L.z = nz; L.a += L.spin * dt;
      _q.position.set(L.x, 0.01 + Math.sin(T * 0.6 + i) * 0.003, L.z); _q.rotation.set(0, L.a, 0); _q.scale.setScalar(L.s); _q.updateMatrix(); leafI.setMatrixAt(i, _q.matrix); }
    // a leaf falling through the light now and then
    faller.next -= dt; if (!faller.on && faller.next <= 0) { faller.on = true; const p = new THREE.Vector3().lerpVectors(SH_T, SH_O, 0.5); faller.x = p.x + 0.8; faller.y = p.y; faller.z = p.z + 0.6; faller.t = 0; }
    if (faller.on) { faller.t += dt; faller.y -= dt * 0.55; faller.x += (Math.sin(faller.t * 1.7) * 0.5 + 0.12) * dt; faller.z += (Math.cos(faller.t * 1.3) * 0.4 + 0.18) * dt;
      _q.position.set(faller.x, faller.y, faller.z); _q.rotation.set(Math.sin(faller.t * 2.3) * 0.9, faller.t * 1.4, Math.cos(faller.t * 1.9) * 0.7); _q.scale.setScalar(1.2); _q.updateMatrix(); leafI.setMatrixAt(LEAFN, _q.matrix);
      if (faller.y <= 0.015) { faller.on = false; faller.next = 10 + Math.random() * 8;sound('leaf');ripple(faller.x, faller.z, 0.35); let far = 0, fd = -1; lv.forEach((L, i) => { const d = Math.hypot(L.x - CX, L.z - CZ); if (d > fd) { fd = d; far = i; } });
        if (distPath(faller.x, faller.z) > 0.8 && Math.hypot(faller.x - CX, faller.z - CZ) > 3) { lv[far].x = faller.x; lv[far].z = faller.z; } _q.scale.setScalar(0); _q.updateMatrix(); leafI.setMatrixAt(LEAFN, _q.matrix); } }
    else { _q.scale.setScalar(0); _q.updateMatrix(); leafI.setMatrixAt(LEAFN, _q.matrix); }
    leafI.instanceMatrix.needsUpdate = true;
    // ripples grow and fade
    rip.forEach(r => { if (r.w > 0) { r.z += dt * 1.25; r.w = Math.max(0, r.w - dt * 0.22); } });
    // light follows the day outside: warm by day, a cool moonbeam at night
    const night = cur.lamp; shaftA = 1 - 0.55 * night; const sc = new THREE.Color('#fff0d4').lerp(new THREE.Color('#b8cdf7'), night);
    shafts.forEach(m => { m.material.uniforms.uTime.value = T; m.material.uniforms.uCol.value.copy(sc); m.material.uniforms.uA.value = m.userData.a * shaftA; });
    const blueK = Math.min(1, Math.max(ascend, flash, shrinkT >= 0 ? 1 : 0)); blueNow += (blueK - blueNow) * Math.min(1, dt * 2.5);
    spot.color.copy(sc); spot.intensity = 2.6 * shaftA * (1 - 0.65 * blueNow); daisGlow.material.opacity = 0.2 * (1 - 0.8 * blueNow); fill.intensity = 1.15 * (1 - 0.6 * blueNow); shafts.forEach(m => m.material.uniforms.uA.value *= (1 - 0.5 * blueNow)); waterMat.uniforms.uLightCol.value.copy(sc); waterMat.uniforms.uLightI.value = shaftA; waterMat.uniforms.uTime.value = T; waterMat.uniforms.uGlow.value = Math.max(glowBoost, ascend) + 0.15;
    aimShafts();
    // camera glide
    const kk = 1 - Math.exp(-dt * camK); ['x', 'y', 'z', 'vh'].forEach(q => camC[q] += (camT[q] - camC[q]) * kk); placeCaveCam();
  }
  let shaftA = 1, blueNow = 0; const trail = [];
  /* ---------- reflection pass (called right before the main render) ---------- */
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(WY - 0.01)), _cp = new THREE.Vector3(), _tg = new THREE.Vector3(), _up = new THREE.Vector3();
  function renderReflection() {
    cam.updateMatrixWorld(); mirrorCam.left = cam.left; mirrorCam.right = cam.right; mirrorCam.top = cam.top; mirrorCam.bottom = cam.bottom; mirrorCam.zoom = cam.zoom; mirrorCam.near = cam.near; mirrorCam.far = cam.far; mirrorCam.updateProjectionMatrix();
    _cp.copy(cam.position); _cp.y = 2 * WY - _cp.y; _tg.copy(CT); _tg.y = 2 * WY - _tg.y; _up.set(0, 1, 0).applyQuaternion(cam.quaternion); _up.y = -_up.y;
    mirrorCam.position.copy(_cp); mirrorCam.up.copy(_up); mirrorCam.lookAt(_tg); mirrorCam.updateMatrixWorld();
    texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); texMat.multiply(mirrorCam.projectionMatrix); texMat.multiply(mirrorCam.matrixWorldInverse);
    water.visible = false; shafts.forEach(m => m.visible = false); noRefl.forEach(m => m.visible = false); subVis = vigEl.style.display; const au = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; renderer.clippingPlanes = [clipPlane];
    renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, mirrorCam); renderer.setRenderTarget(null);
    renderer.clippingPlanes = []; renderer.shadowMap.autoUpdate = au; water.visible = true; shafts.forEach(m => m.visible = true); noRefl.forEach(m => m.visible = true); }
  let subVis;
  function state() { return { busy, stoneHere, x: +TR.x.toFixed(2), z: +TR.z.toFixed(2), y: +TR.cy.toFixed(2), mode: TR.mode, spot: TR.spot, cam: { ...camC } }; }

  function finishStory(){const f=storyDone;storyDone=null;if(f)f();}
  function journey(kind,sound,done){if(kind==='echo'){visit(sound,done);return;}enter('visit');visiting=true;storyDone=done;if(kind==='core')evCore();else evSecond();}
  function whistleCut(done){enter('visit');visiting=false;trav.visible=false;storyDone=()=>{trav.visible=true;leave();done?.();};evWhistle();}
  async function warm(){const oldParent=trav.parent,oldCT=CT.clone(),oldVH=VHU,oldOut=out.visible,oldG=G.visible;const target=new THREE.WebGLRenderTarget(8,8);try{out.visible=false;G.visible=true;G.add(trav);Object.assign(camC,HOME);placeCaveCam();placeCam();await renderer.compileAsync(scene,cam);renderReflection();renderer.setRenderTarget(target);renderer.render(scene,cam);}finally{renderer.setRenderTarget(null);target.dispose();oldParent.add(trav);out.visible=oldOut;G.visible=oldG;CT.copy(oldCT);VHU=oldVH;resizeAll();placeCam();}}
  return { warm, journey, whistleCut, visit, isVisiting: () => visiting, ECHO, enter, leave, update, renderReflection, evSecond, evCore, evWhistle, reset: resetCave, state, NODES, ROUTES: { ROUTE_IN, ROUTE_STONE, ROUTE_WALL }, floorMeshes, G, hum, camC, camT, setCamNow() { Object.assign(camC, camT); placeCaveCam(); } };
})();

/* ---------- HUD ---------- */

const $ = id => document.getElementById(id), statusEl=$('status');
const fadeEl=document.createElement('div'); fadeEl.style.cssText='position:absolute;inset:0;background:#05080a;opacity:0;pointer-events:none;z-index:5';document.body.appendChild(fadeEl);const travelLoader=createTravelLoading();travelLoader.hidden=true;document.body.appendChild(travelLoader);
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s)%60).padStart(2,'0');
function startPlay(){playing=true;if(!started){started=true;place(...NAV[startSpot].tgt);TR.hd=0;TR.mode='idle';TR.dwell=.6;say('旅人從瀑布邊的木棧道走上來。');}}
function resetAll(){audio.reset();audioStep=-1;if(inCave)CAVE.leave('visit'); CAVE.reset(); sim=0;tAcc=0;TR.lit=0;TR.done=false;TR.recent=[];TR.leave=[];TR.spot=0;TR.goal=null;TR.why='wander';TR.mode='idle';TR.dwell=.4;started=false;playing=false;windSim=0;wind=0;bellStrikes=0;windFirst=true;caveLure=null;caveCalling=false;caveVisits=0;fade=null;fadeEl.style.opacity=0;pendingEvent=null;storyDone=null;place(...NAV[startSpot].tgt);}
function goSpot(id, rest){if(inCave||pendingEvent||TR.why==='cave')return false;const pa=planTo(id);if(!pa)return false;startPlay();startWalk(pa,id,rest?'rest':'goto');return true;}
const dots=[];
/* ---------- main update ---------- */
function update(dt,fadeDt=dt) {
  if(!playing)fadeDt=0;
  if(!playing)dt=0; tAcc+=dt; const w=playing?backend('wind',{now:sim}):null;if(w&&sim-w.at<60){startWind(w.first);windSim=60-(sim-w.at);}const visitNow = inCave && CAVE.isVisiting(); if(playing){sim=Math.min(3000,sim+dt*speed);}
  applyLook(dt); if (started && playing && !inCave && !(fade && fade.k === 'out')) updateTraveller(dt);
  if (fade) { fade.t += fadeDt; const u = Math.min(1, fade.t / (fade.k==='out'?.28:.36)); fadeEl.style.opacity = fade.k === 'out' ? u : 1 - u; if (u >= 1) { const f = fade.then; fade = fade.k === 'in' ? null : { k: 'hold' }; if (f) f(); else if (fade && fade.k === 'hold') fade = null; } }
  travelLoader.hidden=!fade;travelLoader.dataset.paused=String(!playing);
  ambient(dt);
  if (inCave) { sun.intensity = 0; hemi.color.set('#9fb0b0'); hemi.groundColor.set('#151c1c'); hemi.intensity = 0.42; renderer.toneMappingExposure = 1.0; if (applyLook.bg !== 'cave') { document.body.style.background = '#05080a'; applyLook.bg = 'cave'; } CAVE.update(visitNow && !playing ? 0 : dt); }
  const due = lampsDue(); dots.forEach((d, i) => d.classList.toggle('on', i < due)); $('lampCount').textContent = due + ' / 5'; $('clockNow').textContent = fmt(sim);
  const ph = (sim % DAYLEN) / DAYLEN, nm = timeMode === 'auto' ? (ph < 0.09 || ph >= 0.95 ? '晨霧' : ph < 0.4 ? '白天' : ph < 0.6 ? '薄暮' : '夜') : { dawn: '晨霧', day: '白天', dusk: '薄暮', night: '夜' }[timeMode];
  $('sky').innerHTML = `<b style="color:var(--ink);font-weight:600">晴</b> · ${nm}${wind > 0.3 ? ' · 山風石歌' : ''}`;
  const walking=playing&&TR.mode==='walk',step=Math.floor(TR.phase/Math.PI);
  if(walking&&audioStep>=0&&step!==audioStep)sound((inCave?Math.abs(TR.y-.32)<.12:TR.y>H(TR.x,TR.z)+.12)?'woodStep':'stoneStep');
  audioStep=walking?step:-1;
  audio.update({playing,inactive:opts.inactive?.()??globalThis.document.hidden,inCave,period:timeMode==='auto'?(ph<.09||ph>=.95?'dawn':ph<.4?'day':ph<.6?'dusk':'night'):timeMode,saw:!inCave&&TR.mode==='act'&&TR.spot===7,ropeway:gondolaBoost,winch:cageBoost,wind:windSim});
  camera_update(dt);
}

/* ---------- camera: fixed 45° / 31° orthographic; drag to peek, springs back ---------- */
cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
let yawOff = 0, pitchOff = 0, dragging = false, lastX = 0, lastY = 0; const CT = new THREE.Vector3(5.0, -0.5, 5.0); let VHU = 22.5;
function resizeAll() { innerWidth=host.clientWidth;innerHeight=host.clientHeight;const w=innerWidth,h=innerHeight,asp=w/h; renderer.setSize(w, h); const s = (VHU / 2) * Math.max(1, (16 / 9) / asp); cam.left = -s * asp; cam.right = s * asp; cam.top = s; cam.bottom = -s; cam.updateProjectionMatrix(); }
function placeCam() { const az = Math.PI / 4 + yawOff, el = 31 * Math.PI / 180 + pitchOff, dist = 90; cam.position.set(CT.x + Math.sin(az) * Math.cos(el) * dist, CT.y + Math.sin(el) * dist, CT.z + Math.cos(az) * Math.cos(el) * dist); cam.lookAt(CT); }
function camera_update(dt) { if (!dragging && !window.__holdCam) { const q = Math.exp(-dt * 2.6); yawOff *= q; pitchOff *= q; } placeCam(); }
addEventListener('resize', resizeAll); resizeAll(); placeCam();
renderer.domElement.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => { if (!dragging) return; const YL = inCave ? 0.55 : 1.1, PL = inCave ? 0.35 : 0.5; yawOff = Math.max(-YL, Math.min(YL, yawOff - (e.clientX - lastX) * 0.006)); pitchOff = Math.max(-0.12, Math.min(PL, pitchOff + (e.clientY - lastY) * 0.004)); /* the cave interior is a diorama: a smaller peek keeps the open side out of view */ lastX = e.clientX; lastY = e.clientY; });
addEventListener('pointerup', () => { dragging = false; });

/* ---------- boot ---------- */
SPOT_IDS.forEach(id => { REACH[id] = !!NAV[id].tgt && !!planTo(id, NAV[startSpot].tgt) ; });
resetAll();

function draw(){if(inCave)CAVE.renderReflection();renderer.render(scene,cam);}
function tick(){const now=performance.now(),elapsed=Math.max(0,(now-lastFrameAt)/1000);lastFrameAt=now;advanceAnimation(elapsed,dt=>update(dt));draw();}
let automatic=true;function frame(){if(dead)return;if(automatic)tick();raf=requestAnimationFrame(frame);}
const watchdog=setInterval(()=>{if(!dead&&automatic&&performance.now()-lastFrameAt>250)tick();},33);
const observer=new ResizeObserver(resizeAll);observer.observe(host);
function reset(kind=null){backend('new',{reserved:kind});resetAll();remoteWhistle=false;startPlay();}
function event(kind){reset(kind==='core'||kind==='second'?kind:null);pendingEvent=kind;
 if(kind==='whistle'){pendingEvent=null;const pa=planTo(6);startWalk(pa,6,'goto');remoteWhistle=true;return;}
 const pa=planTo(12);if(!pa)throw Error('洞口不可到達');startWalk(pa,12,'goto');say(kind==='core'?'旅人往共鳴洞走去，石頭正在回應他。':'旅人往共鳴洞走去，聽岩壁裡的聲音。');}
let remoteWhistle=false;
function echoScenario(){reset();sim=1205;TR.lit=2;place(...NAV[1].tgt);TR.spot=1;TR.leave=[];goSpot(1);}
function state(){return {audio:audio.debug(),sim,lamps:lampsDue(),playing,speed,mode:TR.mode,spot:TR.spot,goal:TR.goal,position:[TR.x,TR.y,TR.z],bell:{angle:BELL.st.th,velocity:BELL.st.v,rung:BELL.st.rung,queue:BELL.st.queue},transition:fade?{kind:fade.k,opacity:Number(fadeEl.style.opacity)}:null,caveWarmMs,inCave,visits:caveVisits,pendingEvent,stoneOwned,cave:CAVE.state(),status:statusEl.textContent,reach:{...REACH}};}
automatic=false;const qaChecks={};
qaChecks['water-lip']=function(close){
  if(close){qaChecks.lipCamera={ct:CT.clone(),vh:VHU};CT.set(FW.fx,FW.fy-1,FW.fz);VHU=5;}
  else if(qaChecks.lipCamera){CT.copy(qaChecks.lipCamera.ct);VHU=qaChecks.lipCamera.vh;}
  resizeAll();placeCam();draw();
  const terrain=out.children.find(c=>c.isMesh&&c.geometry.attributes.color&&c.geometry.attributes.position.count>100000);
  const ray=new THREE.Raycaster(),p=riverMesh.geometry.attributes.position;let exposed=0,samples=0,maxBed=-Infinity;
  for(let i=p.count-60;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);ray.set(new THREE.Vector3(x,y+2,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(terrain,false)[0];if(hit){maxBed=Math.max(maxBed,hit.point.y-y);if(hit.point.y>=y-.03)exposed++;}samples++;
  }
  const end=RIVER[RIVER.length-1];
  return {exposed,samples,maxBed,lipWidth:riverWidth(5)*2,curtainWidth:3.5,opaqueBacking:!fallBacking.material.transparent&&fallBacking.material.depthWrite,lipCenterGap:Math.hypot(end[0]-FW.fx,end[1]-FW.fz)};
};
qaChecks['water-flow']=function(time){
  riverMat.uniforms.uTime.value=time;
  curtains.forEach(m=>{m.uniforms.uTime.value=time;});
  draw();
  const p=riverMesh.geometry.attributes.position;let maxJoinGap=0;
  for(let i=0;i+6<p.count;i+=6)for(const [a,b] of [[i+2,i+6],[i+4,i+7]]){
    maxJoinGap=Math.max(maxJoinGap,Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b)));
  }
  return {time,maxJoinGap};
};
qaChecks['occlusion-all.js']=function(){const __quarry={TR,M_BELL:BELL,yAt,nav:NAV,cave:{enter:()=>CAVE.enter(),run(sec){for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);},M:CAVE}};
// Fixed-camera occlusion: for every spot (prop and standing point) and lamp, cast rays toward the camera and report what blocks them.
return (()=>{ const RC=new THREE.Raycaster(); const cd=new THREE.Vector3(Math.sin(Math.PI/4)*Math.cos(31*Math.PI/180),Math.sin(31*Math.PI/180),Math.cos(Math.PI/4)*Math.cos(31*Math.PI/180)); const B=new Set(); __quarry.M_BELL.g.traverse(o=>B.add(o));
 const all=[]; out.updateMatrixWorld(true); out.traverse(o=>{ if(!o.isMesh||o.material.transparent||o.material.blending===THREE.AdditiveBlending||o.isInstancedMesh) return; let v=true,q=o; while(q){ if(!q.visible) v=false; q=q.parent;} if(v) all.push(o); });
 const trees=window.__trees||[]; const who=o=>{ if(B.has(o)) return 'BELL'; let q=o; while(q&&q.parent!==out) q=q.parent; const t=trees.find(t=>t.g===q); if(t) return 'tree@'+q.position.x.toFixed(2)+','+q.position.z.toFixed(2); return (q||o).type+'@'+(q||o).position.x.toFixed(1)+','+(q||o).position.z.toFixed(1); };
 const test=(cx,cz,rad,h0,h1,ignoreR)=>{ const y=__quarry.yAt(cx,cz); let n=0,tot=0; const hits={}; for(let a=0;a<10;a++) for(let k=0;k<3;k++){ const hh=h0+(h1-h0)*k/2; const p=new THREE.Vector3(cx+Math.cos(a/10*6.28)*rad, y+hh, cz+Math.sin(a/10*6.28)*rad); tot++; RC.set(p,cd); RC.far=60; const h=RC.intersectObjects(all,false).filter(q=>q.distance>0.3 && Math.hypot(q.point.x-cx,q.point.z-cz)>ignoreR); if(h.length){ n++; const w=who(h[0].object); hits[w]=(hits[w]||0)+1; } } return {frac:+(n/tot).toFixed(2),hits}; };
 const res={}; window.__spots.forEach(([n,nm,p])=>{ const r=test(p[0],p[2],0.5,0.4,1.4,1.3); if(r.frac>0.15) res[n+nm]=r; const t=__quarry.nav[n].tgt; if(t){ const r2=test(t[0],t[1],0.15,0.3,1.3,0.5); if(r2.frac>0.2) res[n+nm+'(人)']=r2; } });
 window.__lamps.forEach((l,i)=>{ const r=test(l.x,l.z,0.3,0.5,1.8,0.7); if(r.frac>0.15) res['燈'+i]=r; });
 return res; })()

};
qaChecks['cave-mouth-tunnel.js']=function(){const __quarry={TR,M_BELL:BELL,yAt,nav:NAV,cave:{enter:()=>CAVE.enter(),run(sec){for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);},M:CAVE}};
// Cave mouth: no rock lump vertex and no terrain may lie inside the tunnel volume.
return (()=>{ // any lump vertex inside the tunnel volume?
 const g=window.__cave, T=window.__caveTun; g.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(g.matrixWorld).invert(); let bad=[];
 const halfAt=(z,y)=>{ // tunnel cross-section at depth -z: interpolate ring polygons -> test point inside polygon
   const d=-z; if(d<0||d>T.secs[T.secs.length-1]) return null; let k=0; while(k<T.secs.length-2&&d>T.secs[k+1])k++; const t=(d-T.secs[k])/(T.secs[k+1]-T.secs[k]); return T.R[k].map((p,i)=>[p[0]+(T.R[k+1][i][0]-p[0])*t,p[1]+(T.R[k+1][i][1]-p[1])*t]); };
 const inside=(poly,x,y)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j]; if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;} return c;};
 window.__caveLumps.forEach((o,li)=>{o.updateMatrixWorld(true);const p=o.geometry.attributes.position,v=new THREE.Vector3();let n=0;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);const poly=halfAt(v.z,v.y);if(poly&&inside(poly,v.x,v.y))n++;} if(n)bad.push([li,n]);});
 // terrain inside tunnel?
 let tb=0; for(let d=0;d<=1.0;d+=0.05) for(let x=-1.2;x<=1.2;x+=0.1){const poly=halfAt(-d,0); const v=new THREE.Vector3(x,0,-d); if(!poly)continue; const w=v.clone().applyMatrix4(g.matrixWorld); const ty=__quarry.yAt(w.x,w.z)-1.6; if(ty>0.03 && inside(halfAt(-d,ty),x,ty)) tb++;}
 return {bad,terrainInTunnel:tb};})()

};
qaChecks['cave-route-clearance.js']=function(){const __quarry={TR,M_BELL:BELL,yAt,nav:NAV,cave:{enter:()=>CAVE.enter(),run(sec){for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);},M:CAVE}};
// Cave interior route clearance: samples the three cave routes every 0.2 units, rays at 3 heights x 10 directions (r 0.3-0.36), plus a downward ray for the floor.
// Run against the prototype with qa/run.js: node run.js ../../prototypes/echo-valley.html cave-route-clearance.js  (it enters the cave first)
__quarry.cave.enter(); __quarry.cave.run(1);
return (()=>{ const C=__quarry.cave.M, G=C.G; G.updateMatrixWorld(true); const tr=new Set(); __quarry.TR && 0; 
 const trav=[]; G.traverse(o=>{}); const skip=new Set(); let travRoot=null; G.children.forEach(c=>{ if(c.isGroup && c.children.length>=1 && c.children[0].isGroup && c.scale.x===1.15) travRoot=c; });
 if(travRoot) travRoot.traverse(o=>skip.add(o));
 const solids=[], floors=[]; G.traverse(o=>{ if(!o.isMesh||skip.has(o)) return; let v=true,q=o; while(q){ if(!q.visible) v=false; q=q.parent;} if(!v) return; if(o.material&&(o.material.blending===THREE.AdditiveBlending||o.material.isShaderMaterial||o.material.type==='SpriteMaterial')) return; if(o.isInstancedMesh) return; if(o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width>30) return; if(o.userData.floor) floors.push(o); else solids.push(o); });
 const RC=new THREE.Raycaster(); const N=C.NODES; const res={hits:[],float:[],samples:0};
 const routes=Object.values(C.ROUTES);
 routes.forEach(rt=>{ for(let k=0;k<rt.length-1;k++){ const A=N[rt[k]],B=N[rt[k+1]], L=Math.hypot(B[0]-A[0],B[1]-A[1]); const n=Math.max(1,Math.ceil(L/0.2)); for(let i=0;i<=n;i++){ const t=i/n, x=A[0]+(B[0]-A[0])*t, z=A[1]+(B[1]-A[1])*t, y=A[2]+(B[2]-A[2])*t; res.samples++;
   const wp=new THREE.Vector3(x,0,z).applyMatrix4(G.matrixWorld);
   for(const h of [0.3,0.85,1.4]) for(let a=0;a<10;a++){ const ang=a/10*6.283; const r= h>1.3?0.36:0.3; RC.set(new THREE.Vector3(wp.x,y+h,wp.z),new THREE.Vector3(Math.cos(ang),0,Math.sin(ang))); RC.far=r; const hit=RC.intersectObjects(solids,false); if(hit.length){ res.hits.push([rt[k]+'-'+rt[k+1],+x.toFixed(2),+z.toFixed(2),h,hit[0].object.geometry.type,+hit[0].point.y.toFixed(2)]); break; } }
   RC.set(new THREE.Vector3(wp.x,y+1.0,wp.z),new THREE.Vector3(0,1,0)); RC.far=0.6; const up=RC.intersectObjects(solids,false); if(up.length) res.hits.push(['overhead',x,z]);
   RC.set(new THREE.Vector3(wp.x,y+0.6,wp.z),new THREE.Vector3(0,-1,0)); RC.far=2; const dn=RC.intersectObjects(floors,false); const gy=dn.length?dn[0].point.y:-9; if(Math.abs(gy-y)>0.07) res.float.push([rt[k]+'-'+rt[k+1],+x.toFixed(2),+z.toFixed(2),+y.toFixed(2),+gy.toFixed(2)]); } } });
 const uniq=a=>{const m=new Map(); a.forEach(h=>{const k=h[0]; if(!m.has(k)) m.set(k,{n:0,first:h}); m.get(k).n++;}); return [...m.values()];};
 return {samples:res.samples, hits:uniq(res.hits), float:uniq(res.float)}; })()

};
reset();applyLook(1);update(.001);draw();const warmAt=performance.now();await CAVE.warm();const caveWarmMs=performance.now()-warmAt;draw();lastFrameAt=performance.now();automatic=true;raf=requestAnimationFrame(frame);
return {discoverySound(kind){if(kind==='fork'||kind==='mica')sound(kind);},audioSettings(value){audio.settings(value);},audioReady:audio.ready,state,reset,event,echoScenario,automatic(value){automatic=!!value;lastFrameAt=performance.now();},pause(){playing=false;},play:startPlay,speed(v){if([1,6,20,60].includes(v)&&v!==speed){audio.seek(true);speed=v;audio.seek(false);}},time(m){if(['auto','dawn','day','dusk','night'].includes(m)){timeMode=m;lookInit=false;}},go:goSpot,
wind(){startWind(windFirst);},complete(){if(inCave||pendingEvent||remoteWhistle||TR.why==='cave')return false;sim=3000;TR.lit=5;TR.done=false;TR.mode='idle';decide();return true;},
// Explicit test entry points, confined to the independent tester, never published as window.__quarry.
qa(name,...args){return qaChecks[name](...args);},
advance(sec){audio.seek(true);try{for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);draw();}finally{audio.seek(false);}},setTime(sec){audio.seek(true);sim=sec;TR.lit=lampsDue();audio.seek(false);},
destroy(){audio.dispose();dead=true;cancelAnimationFrame(raf);clearInterval(watchdog);observer.disconnect();listeners.forEach(([t,f])=>globalThis.removeEventListener(t,f));scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.filter(Boolean).forEach(m=>m.dispose());});renderer.dispose();host.replaceChildren();}};
}
}
