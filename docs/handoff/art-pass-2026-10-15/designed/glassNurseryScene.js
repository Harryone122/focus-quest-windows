import { recapAction } from '../../../shared/focusRecap';
import { quietCanvas, quietRare, quietLampLevel } from '../quietPresentation.js';
import { QUIET_FOCUS } from '../../../shared/focusPresentation';
import { advanceAnimation } from '../animationSteps';
import * as T from '../cloudRuins/vendor/three.module.js';
import { createEdgeGlass } from '../cloudRuins/edgeGlass.js';
import { nurseryFog, nurseryStoryKeys } from '../../../shared/area07';
import { createNurseryAudio } from './nurseryAudio';
import { crossedNurseryCues, nurseryAudioCues } from './nurseryAudioCues';
export function createGlassNurseryScene(host, options) {
let opts={...options}, paused=!!opts.paused,lobby=opts.mode==='lobby',dead=false,raf=0;
let audio=null,lastBook=false,seeking=false,audioSettings=opts.audioSettings,audioActive=opts.audioActive!==false,lastRun=null,nextBird=20,nextTick=12,doorPlayed=false;
try { audio=createNurseryAudio(); } catch(e) { console.error('苗圃音效無法建立',e); }
function sound(name,duration,music=false,gain=1){if(opts.quietFocus&&!lobby&&!/(stone_step_dry|nursery_(disc_step|ladder_step|fern_brush)|dep_cloth)/.test(name))return;if(!seeking&&!paused)audio?.shot(name,duration,music,gain);}
let nursery=opts.nursery||null,progress=opts.progressSeconds||0,progressAt=performance.now(),lastReal=performance.now();
const realDocument=globalThis.document,canvasHost=realDocument.createElement('canvas'),lens=realDocument.createElement('canvas');
canvasHost.style.cssText='width:100%;height:100%;display:block';lens.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';host.append(canvasHost,lens);
const ui=new Map(), listeners=[];
const document={createElement:realDocument.createElement.bind(realDocument),querySelectorAll:()=>[],querySelector:()=>realDocument.createElement('div'),getElementById(id){if(id==='c')return canvasHost;if(id==='fg')return lens;if(!ui.has(id))ui.set(id,realDocument.createElement('div'));return ui.get(id);}};
const addEventListener=(type,fn)=>{globalThis.addEventListener(type,fn);listeners.push([type,fn]);};


const V3 = (x, y, z) => new T.Vector3(x, y, z);
function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let R = mulberry(7);
const rr = (a, b) => a + (b - a) * R();

// ---------- renderer ----------
const canvas = document.getElementById('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
const glass=createEdgeGlass(renderer);host.dataset.glass="scene";
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.VSMShadowMap;
const scene = new T.Scene();
scene.background = new T.Color(0xe4dcc6);
const DIST = 70;
scene.fog = new T.Fog(0xddd3bb, DIST + 10, DIST + 70);

const hemi = new T.HemisphereLight(0xf2ead8, 0x5d5a40, 0.65); scene.add(hemi);
const sun = new T.DirectionalLight(0xfff0d2, 1.5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6; sun.shadow.blurSamples = 12; Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 90 }); sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.05;
scene.add(sun); scene.add(sun.target);

// ---------- materials ----------
const mat = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0, flatShading: true }, o));
const M = {
  iron: mat(0xd9d3c4, { roughness: 0.7 }), rust: mat(0x8b5a3a), ironDark: mat(0x3b3a36, { roughness: 0.6 }),
  stone: mat(0xa49d8a), stoneLight: mat(0xbab29c), stoneDark: mat(0x6f6a5d), cliff: mat(0x7d7462),
  soil: mat(0x5b4a39), grass: mat(0x66704a), moss: mat(0x6d7350),
  leaf: mat(0x5f7f45), leafLight: mat(0x88a55a, { side: T.DoubleSide }), leafDark: mat(0x3f5e3a), palm: mat(0x6f9048, { side: T.DoubleSide }),
  bark: mat(0x6b5440), terracotta: mat(0xb06a46), copper: mat(0xa86e45, { roughness: 0.55, metalness: 0.2 }),
  grate: mat(0x3d3c38, { roughness: 0.55, metalness: 0.3 }), wood: mat(0x8a6a4a), woodDark: mat(0x5a4532),
  cloak: mat(0x47535c), hat: mat(0x3a3029), skin: mat(0xe8cfb4), paper: mat(0xece3cf), water: mat(0x55707a, { roughness: 0.2, metalness: 0.1 }),
  canvasBag: mat(0x8a7a5c)
};
const glassMat = new T.MeshStandardMaterial({ color: 0xdcefe9, map: null, transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0, side: T.DoubleSide, depthWrite: false, flatShading: true });

function mesh(geo, m, parent, x = 0, y = 0, z = 0) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
function tube(points, r, m, parent, seg) { const g = new T.TubeGeometry(new T.CatmullRomCurve3(points), seg || points.length * 6, r, 5, false); return mesh(g, m, parent); }
function ring(parent, cx, y, cz, radius, r, m, arc) { const o = mesh(new T.TorusGeometry(radius, r, 4, 56, arc || Math.PI * 2), m, parent, cx, y, cz); o.rotation.x = Math.PI / 2; return o; }

// soft sprite texture
function softTex(inner = 'rgba(255,255,255,1)') { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); }
const SOFT = softTex();

const CAM_H = V3(1, 0, 1).normalize();          // camera side (az 45 deg)
const SUN_DAWN = V3(-0.72, 0.56, -0.42).normalize();  // low sun behind the glasshouse: backlit beams toward the camera

// ---------- shared props ----------
const swayers = [];
function sway(o, amp = 0.05) { o.userData.ph = R() * 6.28; o.userData.amp = amp; o.userData.rz = o.rotation.z; o.userData.rx = o.rotation.x; swayers.push(o); return o; }
function palm(parent, x, z, h = 4, lean = 0.15) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = R() * 6.28; parent.add(g);
  const n = 6; let p = V3(0, 0, 0); const pts = [p.clone()];
  for (let i = 1; i <= n; i++) { p = V3(Math.sin(i / n * 1.4) * lean * h * 0.5, i / n * h, 0); pts.push(p.clone()); }
  tube(pts, 0.11, M.bark, g, 12);
  const crown = new T.Group(); crown.position.copy(p); g.add(crown); sway(crown, 0.06);
  for (let i = 0; i < 9; i++) {
    const f = new T.Group(); f.rotation.y = i / 9 * 6.28 + R() * 0.3; crown.add(f);
    const a = new T.Group(); a.rotation.z = -rr(0.25, 0.75); f.add(a);
    const leaf = mesh(new T.PlaneGeometry(1.9, 0.5, 4, 1), M.palm, a, 0.95, 0, 0); leaf.rotation.x = Math.PI / 2;
    const lp = leaf.geometry.attributes.position; for (let k = 0; k < lp.count; k++) { const lx = lp.getX(k); lp.setZ(k, ((lx + 0.95) ** 2) * 0.22); if (Math.abs(lx - 0.95) < 0.01) lp.setY(k, 0); } leaf.geometry.computeVertexNormals();
  }
  return g;
}
function banana(parent, x, z, s = 1) {
  const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = R() * 6.28; parent.add(g);
  mesh(new T.CylinderGeometry(0.1, 0.16, 1.2, 6), M.leafDark, g, 0, 0.6, 0);
  for (let i = 0; i < 6; i++) { const f = new T.Group(); f.position.y = 1.1; f.rotation.y = i / 6 * 6.28; g.add(f); const a = new T.Group(); a.rotation.z = -rr(0.35, 0.9); f.add(a); sway(a, 0.07);
    const leaf = mesh(new T.PlaneGeometry(1.7, 0.75, 3, 1), M.leafLight, a, 0.85, 0, 0); leaf.rotation.x = Math.PI / 2 + rr(-0.3, 0.3);
    const lp = leaf.geometry.attributes.position; for (let k = 0; k < lp.count; k++) { const lx = lp.getX(k) + 0.85; lp.setZ(k, lx * lx * 0.12); } leaf.geometry.computeVertexNormals(); }
  return g;
}
const FERNS = [];
function fern(parent, x, z, s = 1, m = M.leaf) {
  const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g); sway(g, 0.04); g.userData.fern = true; FERNS.push(g);
  for (let i = 0; i < 8; i++) { const c = mesh(new T.ConeGeometry(0.1, 0.9, 3), m, g); c.geometry.translate(0, 0.45, 0); c.rotation.set(rr(0.6, 1.0), 0, 0); const p = new T.Group(); p.rotation.y = i / 8 * 6.28 + R() * 0.3; p.add(c); g.add(p); }
  return g;
}
function bush(parent, x, z, s = 0.7, m = M.leaf) { const g = new T.Group(); g.position.set(x, 0, z); parent.add(g); for (let i = 0; i < 3; i++) mesh(new T.IcosahedronGeometry(s * rr(0.6, 1), 0), i ? m : M.leafDark, g, rr(-s, s) * 0.6, s * rr(0.5, 0.9), rr(-s, s) * 0.6); sway(g, 0.02); return g; }
function tree(parent, x, z, h, spread = 2.6) {
  const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
  tube([V3(0, 0, 0), V3(0.3, h * 0.35, 0.1), V3(-0.2, h * 0.7, -0.2), V3(0.1, h, 0)], 0.28, M.bark, g, 18);
  tube([V3(0.2, h * 0.5, 0), V3(1.2, h * 0.7, 0.6), V3(1.8, h * 0.82, 0.8)], 0.12, M.bark, g, 10);
  const can = new T.Group(); can.position.y = h; g.add(can); sway(can, 0.02);
  for (let i = 0; i < 9; i++) mesh(new T.IcosahedronGeometry(rr(0.9, 1.5), 0), i % 3 ? M.leaf : M.leafDark, can, rr(-spread, spread), rr(-0.8, 0.9), rr(-spread, spread) * 0.8);
  mesh(new T.IcosahedronGeometry(1.2, 0), M.leaf, can, 1.7, -h * 0.18, 0.8);
  // roots
  for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; tube([V3(0, 0.4, 0), V3(Math.cos(a) * 0.6, 0.15, Math.sin(a) * 0.6), V3(Math.cos(a) * 1.1, 0.02, Math.sin(a) * 1.1)], 0.09, M.bark, g, 6); }
  return g;
}
function pot(parent, x, z, r = 0.28, plant = true) { const g = new T.Group(); g.position.set(x, 0, z); parent.add(g); mesh(new T.CylinderGeometry(r, r * 0.75, r * 1.3, 8), M.terracotta, g, 0, r * 0.65, 0); if (plant) { if (R() < 0.5) fern(g, 0, 0, r * 1.4).position.y = r * 1.2; else bush(g, 0, 0, r * 0.9).position.y = r * 1.1; } return g; }
function vine(parent, x, y, z, len) { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); sway(g, 0.05); let yy = 0; while (yy < len) { mesh(new T.BoxGeometry(0.06, 0.32, 0.06), R() < 0.5 ? M.leaf : M.leafDark, g, rr(-0.05, 0.05), -yy - 0.16, rr(-0.05, 0.05)); if (R() < 0.5) mesh(new T.IcosahedronGeometry(0.1, 0), M.leafLight, g, rr(-0.1, 0.1), -yy - 0.1, rr(-0.1, 0.1)); yy += 0.3; } return g; }
function grate(parent, x, z, r) {
  const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(new T.CylinderGeometry(r + 0.18, r + 0.24, 0.16, 40), M.stoneDark, g, 0, 0.08, 0);
  mesh(new T.CylinderGeometry(r, r, 0.04, 40), M.grate, g, 0, 0.17, 0);
  ring(g, 0, 0.19, 0, r, 0.05, M.copper); ring(g, 0, 0.19, 0, r * 0.55, 0.035, M.copper); ring(g, 0, 0.19, 0, r * 0.18, 0.04, M.copper);
  for (let i = 0; i < 12; i++) { const b = mesh(new T.BoxGeometry(r * 2, 0.03, 0.05), M.copper, g, 0, 0.19, 0); b.rotation.y = i / 12 * Math.PI; }
  return g;
}
function bench(parent, x, z, ry) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g); mesh(new T.BoxGeometry(1.3, 0.07, 0.4), M.wood, g, 0, 0.45, 0); mesh(new T.BoxGeometry(1.3, 0.35, 0.06), M.wood, g, 0, 0.75, -0.18); [-0.55, 0.55].forEach((sx) => mesh(new T.BoxGeometry(0.06, 0.45, 0.4), M.ironDark, g, sx, 0.22, 0)); return g; }
function luggage(parent, x, z, ry) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g); mesh(new T.BoxGeometry(0.55, 0.4, 0.3), M.canvasBag, g, 0, 0.2, 0); mesh(new T.BoxGeometry(0.57, 0.06, 0.32), M.woodDark, g, 0, 0.36, 0); mesh(new T.TorusGeometry(0.08, 0.015, 4, 10, Math.PI), M.copper, g, 0, 0.42, 0); return g; }
function stairsDown(parent, x, z, ry, n = 7) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g); for (let i = 0; i < n; i++) mesh(new T.BoxGeometry(1.2, 0.25, 0.5), i % 2 ? M.stone : M.stoneDark, g, 0, -i * 0.45 - 0.1, i * 0.5); return g; }
function footbridge(parent, x, z, ry, len = 6) { const g = new T.Group(); g.position.set(x, -0.05, z); g.rotation.y = ry; parent.add(g); for (let i = 0; i < len / 0.4; i++) mesh(new T.BoxGeometry(1.1, 0.06, 0.32), i % 5 === 3 ? M.rust : M.ironDark, g, 0, -Math.sin(i / (len / 0.4) * Math.PI) * 0.4, i * 0.4); [-0.55, 0.55].forEach((sx) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push(V3(sx, 0.8 - Math.sin(i / 8 * Math.PI) * 0.4, i / 8 * len)); tube(pts, 0.03, M.rust, g); }); return g; }

// lamps (5 per map, driven by mood here)
function lamp(parent, list, x, z) {
  const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(new T.CylinderGeometry(0.05, 0.07, 1.7, 6), M.ironDark, g, 0, 0.85, 0);
  mesh(new T.BoxGeometry(0.34, 0.04, 0.04), M.ironDark, g, 0.12, 1.66, 0);
  const gm = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 0, roughness: 1 });
  const head = mesh(new T.BoxGeometry(0.16, 0.22, 0.16), gm, g, 0.26, 1.5, 0); head.castShadow = false;
  mesh(new T.ConeGeometry(0.15, 0.1, 4), M.ironDark, g, 0.26, 1.66, 0).rotation.y = Math.PI / 4;
  const light = new T.PointLight(0xffb05a, 0, 5, 2); light.position.set(0.26, 1.5, 0); g.add(light);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xffc27a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); halo.position.set(0.26, 1.5, 0); halo.scale.setScalar(1.6); g.add(halo);
  list.push({ gm, light, halo }); return g;
}

// ---------- glass structures ----------
// Domes and vaults record their open (broken) panes on the far side, which become the sun-beam sources at dawn.
function front(nx, nz) { return (nx * CAM_H.x + nz * CAM_H.z); }
function pushQuad(arr, a, b, c, d) { arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z); }

// glass surface: soft diagonal sheen + grime at the bottom edge + water spots, so the panes read as glass
function glassTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
  const sh = x.createLinearGradient(0, 256, 256, 0); sh.addColorStop(0.18, 'rgba(255,255,255,0)'); sh.addColorStop(0.3, 'rgba(255,255,255,1)'); sh.addColorStop(0.36, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(0.56, 'rgba(255,255,255,0.8)'); sh.addColorStop(0.59, 'rgba(255,255,255,0)');
  x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(150,168,165,1)'; x.fillRect(0, 0, 256, 256); x.fillStyle = sh; x.fillRect(0, 0, 256, 256);
  const gr = x.createLinearGradient(0, 256, 0, 150); gr.addColorStop(0, 'rgba(92,96,70,0.95)'); gr.addColorStop(1, 'rgba(92,96,70,0)'); x.fillStyle = gr; x.fillRect(0, 150, 256, 106);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,125,110,${0.2 + Math.random() * 0.3})`; x.beginPath(); x.arc(Math.random() * 256, 120 + Math.random() * 136, 1 + Math.random() * 3, 0, 6.28); x.fill(); }
  for (let i = 0; i < 6; i++) { const sx = Math.random() * 256; x.strokeStyle = 'rgba(110,115,100,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx, 60 + Math.random() * 80); x.lineTo(sx + Math.random() * 6 - 3, 256); x.stroke(); }
  x.strokeStyle = 'rgba(70,72,64,0.7)'; x.lineWidth = 6; x.strokeRect(0, 0, 256, 256);
  const t = new T.CanvasTexture(c); return t; }
const GTEX = glassTex();
function sheenTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  const sh = x.createLinearGradient(0, 256, 256, 0); sh.addColorStop(0.2, 'rgba(255,255,255,0)'); sh.addColorStop(0.3, 'rgba(255,255,255,0.9)'); sh.addColorStop(0.38, 'rgba(255,255,255,0)'); sh.addColorStop(0.52, 'rgba(255,255,255,0)'); sh.addColorStop(0.56, 'rgba(255,255,255,0.6)'); sh.addColorStop(0.6, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 3; x.strokeRect(4, 4, 248, 248); return new T.CanvasTexture(c); }
const STEX = sheenTex();

const frostMat = new T.MeshStandardMaterial({ color: 0xffffff, map: GTEX, transparent: true, opacity: 0.45, roughness: 0.6, side: T.DoubleSide, depthWrite: false });
const algaeMat = new T.MeshStandardMaterial({ color: 0x9fb98a, map: GTEX, transparent: true, opacity: 0.38, roughness: 0.4, side: T.DoubleSide, depthWrite: false });
const wallGlassMat = glassMat.clone(); wallGlassMat.map = GTEX; wallGlassMat.emissive = new T.Color(0xffffff); wallGlassMat.emissiveMap = STEX; wallGlassMat.emissiveIntensity = 0.3; frostMat.emissive = new T.Color(0xffffff); frostMat.emissiveMap = STEX; frostMat.emissiveIntensity = 0.25;
function glassMeshUV(arr, parent, m) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); const uv = []; for (let i = 0; i < arr.length / 18; i++) uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); const me = new T.Mesh(g, m || wallGlassMat); me.renderOrder = 2; parent.add(me); return me; }

function glassMesh(arr, parent) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); const m = new T.Mesh(g, glassMat); m.renderOrder = 2; parent.add(m); return m; }

function dome(parent, o) {
  const { cx, cz, r, h, drum, segs = 16, rings = 5, broken = 0.25, holes, cutAt = 0.05, avoid } = o;
  const g = new T.Group(); parent.add(g); const panes = [];
  const P = (th, ph) => V3(cx + r * Math.cos(ph) * Math.cos(th), drum + h * Math.sin(ph), cz + r * Math.cos(ph) * Math.sin(th));
  const PHM = Math.PI / 2 * 0.86;
  // base curb + drum
  for (let j = 0; j < segs; j++) {
    const t0 = j / segs * 6.28, t1 = (j + 1) / segs * 6.28, tm = (t0 + t1) / 2; const f = front(Math.cos(tm), Math.sin(tm));
    const wall = f > 0.2 ? 0.25 : 0.6;
    const w = mesh(new T.BoxGeometry(2 * r * Math.sin(Math.PI / segs) + 0.05, wall, 0.32), M.stone, g, cx + Math.cos(tm) * r * Math.cos(Math.PI / segs), wall / 2, cz + Math.sin(tm) * r * Math.cos(Math.PI / segs)); w.rotation.y = -tm + Math.PI / 2;
    const post = mesh(new T.BoxGeometry(0.1, drum - 0.6, 0.1), M.iron, g, cx + Math.cos(t0) * r, 0.6 + (drum - 0.6) / 2, cz + Math.sin(t0) * r);
    if (f > cutAt && j % 2) post.visible = false;
    if (!(f > cutAt) && R() > broken) { pushQuad(panes, V3(cx + Math.cos(t0) * r, 0.6, cz + Math.sin(t0) * r), V3(cx + Math.cos(t1) * r, 0.6, cz + Math.sin(t1) * r), V3(cx + Math.cos(t1) * r, drum, cz + Math.sin(t1) * r), V3(cx + Math.cos(t0) * r, drum, cz + Math.sin(t0) * r)); }
    else if (!(f > cutAt) && holes) holes.push(V3(cx + Math.cos(tm) * r, drum * 0.75, cz + Math.sin(tm) * r));
    // dome panes
    for (let i = 0; i < rings; i++) {
      const p0 = i / rings * PHM, p1 = (i + 1) / rings * PHM, pm = (p0 + p1) / 2;
      const c = P(tm, pm); const isFront = f > cutAt || (pm > 1.0 && f > -0.45);
      const near = avoid && avoid.some((a) => c.distanceTo(a.p) < a.r);
      if (isFront || near || R() < broken) { if (!isFront && holes && f < -0.15) holes.push(c); continue; }
      pushQuad(panes, P(t0, p0), P(t1, p0), P(t1, p1), P(t0, p1));
    }
    // meridian rib (keep every other one on the camera side for a lighter skeleton)
    if (!(f > cutAt && j % 2)) { const pts = []; for (let i = 0; i <= 8; i++) pts.push(P(t0, i / 8 * PHM)); tube(pts, f > cutAt ? 0.045 : 0.06, M.iron, g, 20); }
  }
  ring(g, cx, drum, cz, r, 0.07, M.iron); ring(g, cx, 0.6, cz, r, 0.06, M.iron);
  for (let i = 1; i < rings; i++) { const ph = i / rings * PHM; const rr2 = ring(g, cx, drum + h * Math.sin(ph), cz, r * Math.cos(ph), 0.04, M.iron, Math.PI * 1.25); rr2.rotation.z = Math.PI * 0.62; }
  // cupola
  const top = drum + h * Math.sin(PHM), rt = r * Math.cos(PHM);
  ring(g, cx, top, cz, rt, 0.07, M.iron);
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; mesh(new T.BoxGeometry(0.06, 0.7, 0.06), M.iron, g, cx + Math.cos(a) * rt * 0.8, top + 0.35, cz + Math.sin(a) * rt * 0.8); }
  const cap = mesh(new T.ConeGeometry(rt * 0.95, 0.8, 8), M.rust, g, cx, top + 1.1, cz); mesh(new T.SphereGeometry(0.1, 6, 4), M.copper, g, cx, top + 1.6, cz);
  glassMesh(panes, g);
  return { top, g };
}

// barrel-vault wing along x, from x0 to x1, half-width w, wall height wh
function vault(parent, o) {
  const { x0, x1, cz = 0, w, wh, step = 1.5, broken = 0.25, holes, gable0, gable1 } = o;
  const g = new T.Group(); parent.add(g); const panes = []; const n = Math.round((x1 - x0) / step);
  const A = (x, a) => V3(x, wh + Math.sin(a) * w * 0.95, cz + Math.cos(a) * w);   // a: 0 = front (z+), PI = back
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    // posts
    mesh(new T.BoxGeometry(0.1, wh, 0.1), M.iron, g, x, wh / 2, cz - w);
    if (i % 2 === 0) mesh(new T.BoxGeometry(0.08, wh, 0.08), M.iron, g, x, wh / 2, cz + w);
    // arched rib: full on the back half, partial in front
    const pts = []; const aEnd = i % 2 === 0 ? 0 : Math.PI * 0.45; for (let k = 0; k <= 10; k++) { const a = Math.PI - (Math.PI - aEnd) * k / 10; pts.push(A(x, a)); }
    tube(pts, 0.055, M.iron, g, 20);
    if (i === n) break;
    const xa = x, xb = x0 + (x1 - x0) * (i + 1) / n;
    // back wall panes
    if (R() > broken) pushQuad(panes, V3(xa, 0.5, cz - w), V3(xb, 0.5, cz - w), V3(xb, wh, cz - w), V3(xa, wh, cz - w)); else if (holes) holes.push(V3((xa + xb) / 2, wh * 0.7, cz - w));
    // vault panes on the back half only
    for (let k = 0; k < 4; k++) { const a0 = Math.PI - k / 4 * Math.PI * 0.5, a1 = Math.PI - (k + 1) / 4 * Math.PI * 0.5; if (R() < broken) { if (holes) holes.push(A((xa + xb) / 2, (a0 + a1) / 2)); continue; } pushQuad(panes, A(xa, a0), A(xb, a0), A(xb, a1), A(xa, a1)); }
  }
  // wall plates and ridge
  tube([V3(x0, wh, cz - w), V3(x1, wh, cz - w)], 0.06, M.iron, g, 2); tube([V3(x0, wh, cz + w), V3(x1, wh, cz + w)], 0.05, M.iron, g, 2);
  tube([A(x0, Math.PI / 2), A(x1, Math.PI / 2)], 0.05, M.iron, g, 2);
  mesh(new T.BoxGeometry(x1 - x0, 0.5, 0.3), M.stone, g, (x0 + x1) / 2, 0.25, cz - w);
  mesh(new T.BoxGeometry(x1 - x0, 0.22, 0.3), M.stone, g, (x0 + x1) / 2, 0.11, cz + w);
  // gable fans (only the far end keeps glass)
  [[gable0, x0], [gable1, x1]].forEach(([keep, x]) => { if (keep === undefined) return; for (let k = 0; k < 8; k++) { const a0 = Math.PI - k / 8 * Math.PI, a1 = Math.PI - (k + 1) / 8 * Math.PI; tube([V3(x, wh, cz), A(x, a0)], 0.035, M.iron, g, 2); if (keep && R() > broken) { panes.push(x, wh, cz, ...A(x, a0).toArray(), ...A(x, a1).toArray()); } } });
  glassMesh(panes, g);
  return g;
}

function sprinklerTruss(parent, cx, y, cz, len) {
  const g = new T.Group(); g.position.set(cx, y, cz); parent.add(g);
  mesh(new T.BoxGeometry(len, 0.08, 0.08), M.copper, g, 0, 0, 0.18); mesh(new T.BoxGeometry(len, 0.08, 0.08), M.copper, g, 0, 0, -0.18);
  for (let i = 0; i <= len / 0.6; i++) { const x = -len / 2 + i * 0.6; const b = mesh(new T.BoxGeometry(0.04, 0.04, 0.42), M.rust, g, x, 0, 0); b.rotation.x = i % 2 ? 0.6 : -0.6; if (i % 2 === 0) { mesh(new T.CylinderGeometry(0.02, 0.02, 0.4, 4), M.copper, g, x, -0.22, 0); mesh(new T.ConeGeometry(0.06, 0.1, 6), M.copper, g, x, -0.45, 0).rotation.x = Math.PI; } }
  [-1, 1].forEach((s) => { mesh(new T.BoxGeometry(0.22, 0.2, 0.5), M.ironDark, g, s * len / 2, 0, 0); mesh(new T.CylinderGeometry(0.09, 0.09, 0.06, 8), M.ironDark, g, s * len / 2, -0.14, 0).rotation.x = Math.PI / 2; });
  return g;
}
function valve(parent, x, y, z) { const v = mesh(new T.TorusGeometry(0.14, 0.025, 4, 10), M.rust, parent, x, y + 0.25, z); mesh(new T.CylinderGeometry(0.03, 0.03, 0.25, 5), M.copper, parent, x, y + 0.12, z); v.rotation.x = Math.PI / 2; }
function pipeRun(parent, pts, r = 0.07) { tube(pts, r, M.copper, parent, pts.length * 4); }

// ---------- traveller ----------
function traveller(parent) {
  const trav = new T.Group(); trav.scale.setScalar(1.15); parent.add(trav);
  const body = new T.Group(); trav.add(body);
  const legGeo = new T.CylinderGeometry(0.045, 0.04, 0.3, 5); legGeo.translate(0, -0.15, 0);
  const footGeo = new T.BoxGeometry(0.07, 0.035, 0.12); footGeo.translate(0, -0.3, 0.025);
  const legL = mesh(legGeo, M.woodDark, body, -0.07, 0.3, 0), legR = mesh(legGeo, M.woodDark, body, 0.07, 0.3, 0);
  mesh(footGeo, M.woodDark, legL); mesh(footGeo, M.woodDark, legR);
  const upper = new T.Group(); upper.position.y = 0.3; body.add(upper);
  mesh(new T.ConeGeometry(0.23, 0.6, 8), M.cloak, upper, 0, 0.25, 0);
  mesh(new T.CylinderGeometry(0.07, 0.07, 0.34, 7), M.canvasBag, upper, 0, 0.36, -0.15).rotation.z = Math.PI / 2;
  const head = new T.Group(); head.position.y = 0.6; upper.add(head);
  mesh(new T.SphereGeometry(0.105, 12, 9), M.skin, head); const hat = mesh(new T.ConeGeometry(0.3, 0.13, 12), M.hat, head, 0, 0.1, 0);
  const armGeo = new T.CylinderGeometry(0.034, 0.03, 0.3, 5); armGeo.translate(0, -0.15, 0);
  const armL = mesh(armGeo, M.cloak, upper, -0.13, 0.44, 0.02), armR = mesh(armGeo, M.cloak, upper, 0.13, 0.44, 0.02);
  mesh(new T.SphereGeometry(0.03, 6, 4), M.skin, armL, 0, -0.31, 0); mesh(new T.SphereGeometry(0.03, 6, 4), M.skin, armR, 0, -0.31, 0);
  // the staff hangs from the right hand, so it follows the arm swing
  const staff = new T.Group(); staff.position.set(0, -0.31, 0); armR.add(staff);
  mesh(new T.CylinderGeometry(0.017, 0.02, 1.08, 5), M.wood, staff, 0, 0.28, 0);
  mesh(new T.BoxGeometry(0.02, 0.02, 0.14), M.woodDark, staff, 0, 0.77, 0.06);
  const gm = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.2, roughness: 1 });
  mesh(new T.BoxGeometry(0.075, 0.1, 0.075), gm, staff, 0, 0.72, 0.13).castShadow = false;
  const halo = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xffc27a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.3 })); halo.position.set(0, 0.72, 0.13); halo.scale.setScalar(0.8); staff.add(halo);
  const book = mesh(new T.BoxGeometry(0.16, 0.025, 0.12), M.paper, armL, 0, -0.32, 0.05); book.visible = false;
  trav.userData = { head, halo, upper, body, legL, legR, armL, armR, staff, hat, book };
  return trav;
}

// ---------- mist, beams, motes ----------
function mistCloud(parent, list, cx, cz, rad, n, yMax = 3) { for (let i = 0; i < n; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: SOFT, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff })); const a = R() * 6.28, d = Math.sqrt(R()) * rad; s.position.set(cx + Math.cos(a) * d, rr(0.4, yMax), cz + Math.sin(a) * d); s.scale.setScalar(rr(3.5, 6)); s.renderOrder = 3; s.userData = { base: s.position.clone(), ph: R() * 6.28 }; parent.add(s); list.push(s); } }
const beamU = { uOpacity: { value: 0 }, uTime: { value: 0 }, uColor: { value: new T.Color(0xffd79a) } };
const beamMat = new T.ShaderMaterial({
  uniforms: beamU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'uniform float uOpacity; uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;' +
    'float h(float x){ return fract(sin(x*127.1)*43758.5453); } float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(h(i), h(i+1.0), f); }' +
    'void main(){ float v = vUv.y; float along = smoothstep(1.0, 0.9, v) * smoothstep(0.0, 0.22, v) * mix(0.3, 1.0, v);' +
    ' float edge = pow(abs(dot(vN, vec3(0.0,0.0,1.0))), 2.4);' +
    ' float streak = 0.45 + 0.55 * n1(vUv.x * 26.0 + n1(v * 3.0 + uTime * 0.05) * 3.0);' +
    ' float dust = 0.85 + 0.15 * n1(vUv.x * 60.0 + v * 40.0 - uTime * 0.6);' +
    ' gl_FragColor = vec4(uColor, uOpacity * along * edge * streak * dust * 0.42); }'
});
function beams(parent, holes, maxN, floorY = 0.1, dirV = SUN_DAWN, matl = beamMat, noMotes) {
  const d = dirV.clone().negate(); const out = [];
  const picked = holes.filter((p) => p.y > 2.8 && p.y < 10).sort(() => R() - 0.5).slice(0, maxN);
  picked.forEach((p) => {
    const L = (p.y - floorY) / -d.y; const rTop = rr(0.16, 0.3), rBot = rTop * rr(1.8, 2.5);
    const geo = new T.CylinderGeometry(rBot, rTop, L, 10, 1, true); geo.translate(0, L / 2, 0);
    const m = new T.Mesh(geo, matl); m.renderOrder = 4; m.userData.rBot = rBot;
    const end = p.clone().addScaledVector(d, L); m.position.copy(end); m.quaternion.setFromUnitVectors(V3(0, 1, 0), dirV); parent.add(m); out.push({ m, a: end, b: p });
  });
  // soft light pools where each shaft lands, stretched along the light's direction
  const poolMat = new T.MeshBasicMaterial({ map: SOFT, color: matl.uniforms.uColor.value, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
  const hd = V3(d.x, 0, d.z).normalize();
  out.forEach((b) => { const pl = new T.Mesh(new T.PlaneGeometry(1, 1), poolMat); pl.rotation.set(-Math.PI / 2, 0, -Math.atan2(hd.z, hd.x)); pl.scale.set(b.m.userData.rBot * 3.6, b.m.userData.rBot * 2.4, 1); pl.position.set(b.a.x + hd.x * 0.3, floorY + 0.045, b.a.z + hd.z * 0.3); pl.renderOrder = 2; parent.add(pl); });
  out.poolMat = poolMat;
  if (noMotes) return { list: out };
  // dust motes inside the beams
  const N = 220, arr = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) { const bm = out[i % Math.max(1, out.length)]; if (!bm) break; const t = R(); const q = bm.a.clone().lerp(bm.b, t * 0.8); q.x += rr(-0.5, 0.5); q.z += rr(-0.5, 0.5); arr.set([q.x, q.y, q.z], i * 3); seeds.push(q); }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(arr, 3));
  const pm = new T.PointsMaterial({ color: 0xfff0c8, size: 0.06, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
  const pts = new T.Points(pg, pm); parent.add(pts);
  return { list: out, motes: pts, seeds, poolMat };
}

// ---------- outside world (seen through the glass and past the cut edges) ----------
const world = new T.Group(); scene.add(world);
{
  const ground = mesh(new T.PlaneGeometry(90, 90), M.moss.clone(), world, 0, -0.02, 0); ground.rotation.x = -Math.PI / 2;
  world.userData.sea = { material: { color: new T.Color() } }; world.userData.edgeMist = [];
  // overgrown hedges and far trees behind the far walls (fogged into silhouettes)
  for (let i = 0; i < 30; i++) { const x = rr(-40, 6), z = rr(-40, 6); if (x > -20 && z > -20) continue; const t = new T.Group(); t.position.set(x, 0, z); world.add(t); const h = rr(4, 9); mesh(new T.CylinderGeometry(0.2, 0.3, h, 5), M.bark, t, 0, h / 2, 0); for (let k = 0; k < 3; k++) mesh(new T.IcosahedronGeometry(rr(1.4, 2.4), 0), M.leafDark, t, rr(-1, 1), h + rr(-0.5, 1), rr(-1, 1)); }
  for (let i = 0; i < 30; i++) { const x = rr(-14, 16), z = rr(-14, 16); if (x > -11.8 && z > -11.8) continue; bush(world, x, z, rr(0.5, 1.0), R() < 0.5 ? M.leaf : M.leafDark); }
  for (let i = 0; i < 16; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: SOFT, transparent: true, depthWrite: false, opacity: 0.5, color: 0xffffff })); s.position.set(rr(-26, -10), rr(1, 6), rr(-26, -10)); if (R() < 0.5) s.position.x = rr(-12, 14); else s.position.z = rr(-12, 14); s.position.y = rr(1, 5); s.scale.setScalar(rr(8, 13)); world.add(s); world.userData.edgeMist.push(s); }
}

// ---------- props for the interior ----------
function wallWithCornice(parent, o) {
  // o: origin (Vector3 at s=0), dir (unit along wall), nrm (unit into room), len, H, c (cornice inset), bay, door: [s0, s1], holes
  const { origin, dir, nrm, len, H, c, bay, door, holes, broken = 0.22 } = o; const up = V3(0, 1, 0);
  const P = (s, y) => origin.clone().addScaledVector(dir, s).addScaledVector(up, y);
  const Q = (s, t) => origin.clone().addScaledVector(dir, s).addScaledVector(nrm, c * (1 - Math.cos(t * Math.PI / 2))).addScaledVector(up, H + c * 1.1 * Math.sin(t * Math.PI / 2));
  const panes = [], frost = [], algae = []; const n = Math.round(len / bay); const tiers = [[0.8, 3.0], [3.0, 5.2], [5.2, H]];
  const inDoor = (s) => door && s > door[0] - 0.01 && s < door[1] + 0.01;
  // stone base
  const baseSeg = (a0, a1) => { if (a1 - a0 < 0.05) return; const b = mesh(new T.BoxGeometry(a1 - a0, 0.8, 0.4), M.stone, parent); b.position.copy(P((a0 + a1) / 2, 0.4)); b.rotation.y = Math.atan2(-dir.z, dir.x); };
  if (door) { baseSeg(0, door[0]); baseSeg(door[1], len); const sill = mesh(new T.BoxGeometry(door[1] - door[0], 0.04, 0.5), M.stoneDark, parent); sill.position.copy(P((door[0] + door[1]) / 2, 0.14)); sill.rotation.y = Math.atan2(-dir.z, dir.x); } else baseSeg(0, len);   // the door gets no stone base
  for (let i = 0; i <= n; i++) {
    const s = i * len / n;
    const post = mesh(new T.BoxGeometry(0.14, inDoor(s) ? H - 3.4 : H - 0.8, 0.14), M.iron, parent); post.position.copy(inDoor(s) ? P(s, 3.4 + (H - 3.4) / 2) : P(s, 0.8 + (H - 0.8) / 2));   // posts over the door start above the door arch
    const pts = []; for (let k = 0; k <= 6; k++) pts.push(Q(s, k / 6)); tube(pts, 0.06, M.iron, parent, 14).castShadow = false;   // cornice ribs: no shadow lines on the floor
    if (i === n) break;
    const s0 = s, s1 = (i + 1) * len / n, sm = (s0 + s1) / 2;
    tiers.forEach(([y0, y1], ti) => {
      if (inDoor(sm) && ti < 1) return;
      if (R() < broken * (ti === 0 ? 0.5 : 1)) { if (holes && y0 >= 3) holes.push(P(sm, (y0 + y1) / 2)); return; }
      const roll = R(); const qa = P(s0, y0), qb = P(s1, y0), qc = P(s1, y1), qd = P(s0, y1);
      if (roll < 0.07) { const bd = new T.Group(); bd.position.copy(P(sm, (y0 + y1) / 2)).addScaledVector(nrm, 0.06); bd.rotation.y = Math.atan2(-dir.z, dir.x); parent.add(bd); const nb = Math.floor((y1 - y0) / 0.32); for (let b = 0; b < nb; b++) { const pl = mesh(new T.BoxGeometry(s1 - s0 + rr(-0.1, 0.15), 0.27, 0.04), R() < 0.5 ? M.wood : M.woodDark, bd, rr(-0.05, 0.05), -(y1 - y0) / 2 + 0.16 + b * 0.32, 0); pl.rotation.z = rr(-0.06, 0.06); } }
      else { const kind = roll < 0.17 ? 'frost' : roll < 0.3 ? 'algae' : (ti === 0 ? 'dirt' : null); pushQuad(kind === 'frost' ? frost : kind === 'algae' ? algae : panes, qa, qb, qc, qd); if (kind && o.tints) o.tints.push({ kind, q: [qa, qb, qc, qd] }); }
      // arched top band on the middle tier: small iron arc per bay
      if (ti === 1) { const arc = []; for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI; arc.push(P(s0 + (s1 - s0) * (0.5 - 0.5 * Math.cos(a)), y1 - 0.7 + Math.sin(a) * 0.55).addScaledVector(nrm, 0.02)); } tube(arc, 0.025, M.iron, parent, 12); }
    });
    for (let k = 0; k < 3; k++) { const t0 = k / 3, t1 = (k + 1) / 3; if (R() < broken * 1.3) { if (holes) holes.push(Q(sm, (t0 + t1) / 2)); continue; } pushQuad(panes, Q(s0, t0), Q(s1, t0), Q(s1, t1), Q(s0, t1)); }
  }
  [0.8, 3.0, 5.2, H].forEach((y) => tube([P(0, y), P(len, y)], y === H ? 0.07 : 0.045, M.iron, parent, 2));
  tube([Q(0, 1), Q(len, 1)], 0.05, M.iron, parent, 2);
  glassMeshUV(panes, parent); glassMeshUV(frost, parent, frostMat); glassMeshUV(algae, parent, algaeMat);
  return { P, Q };
}
function seedTrough(parent, x, z, len) {
  const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
  mesh(new T.BoxGeometry(len, 0.7, 1.1), M.stone, g, 0, 0.35, 0);
  mesh(new T.BoxGeometry(len - 0.2, 0.04, 0.9), M.water, g, 0, 0.66, 0);
  for (let i = 0; i < Math.floor(len / 0.9); i++) { const tx = -len / 2 + 0.55 + i * 0.9; mesh(new T.BoxGeometry(0.7, 0.06, 0.6), M.wood, g, tx, 0.7, 0); for (let k = 0; k < 4; k++) mesh(new T.ConeGeometry(0.05, rr(0.15, 0.3), 3), M.leafLight, g, tx - 0.2 + (k % 2) * 0.4, 0.84, -0.15 + Math.floor(k / 2) * 0.3); }
  for (let i = 0; i < 2; i++) mesh(new T.CylinderGeometry(0.04, 0.04, 0.5, 5), M.copper, g, -len / 2 + 0.3 + i * (len - 0.6), 0.95, -0.5);
  return g;
}
function bellJar(parent, x, y, z, s = 1) { const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g); mesh(new T.CylinderGeometry(0.2, 0.22, 0.05, 10), M.woodDark, g, 0, 0.025, 0); mesh(new T.ConeGeometry(0.05, 0.22, 3), M.leafLight, g, 0, 0.16, 0); const j = new T.Mesh(new T.SphereGeometry(0.19, 10, 8, 0, 6.28, 0, Math.PI / 2), glassMat); j.scale.y = 1.6; j.position.y = 0.05; j.renderOrder = 2; g.add(j); mesh(new T.SphereGeometry(0.03, 5, 4), M.copper, g, 0, 0.36, 0); return g; }
function hangingBasket(parent, p, len) { tube([p.clone(), p.clone().add(V3(0, -len, 0))], 0.01, M.ironDark, parent, 2); const g = new T.Group(); g.position.copy(p).add(V3(0, -len, 0)); parent.add(g); sway(g, 0.03); mesh(new T.CylinderGeometry(0.28, 0.18, 0.25, 8), M.terracotta, g, 0, -0.12, 0); for (let i = 0; i < 4; i++) vine(g, rr(-0.2, 0.2), -0.1, rr(-0.2, 0.2), rr(0.6, 1.6)); fern(g, 0, 0, 0.6).position.y = 0; return g; }


// more plant kinds (variety pass)
const M2 = { monstera: mat(0x2f5a3a, { side: T.DoubleSide }), reed: mat(0x8a9a5a), succ: mat(0x7aa59a), flowerA: mat(0xe8d9a8), flowerB: mat(0xd98f6a), flowerC: mat(0xc9a7d6), wetSoil: mat(0x2e251c, { roughness: 0.45 }) };
function monstera(parent, x, z, s = 1) {
  const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = R() * 6.28; parent.add(g);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + R() * 0.4, h = rr(0.6, 1.2), d = rr(0.4, 0.8);
    tube([V3(0, 0, 0), V3(Math.cos(a) * d * 0.4, h, Math.sin(a) * d * 0.4), V3(Math.cos(a) * d, h * 0.9, Math.sin(a) * d)], 0.025, M.leafDark, g, 6);
    const geo = new T.CircleGeometry(0.42, 12); const pp = geo.attributes.position; for (let k = 1; k < pp.count; k++) { if (k % 2 === 0) { pp.setX(k, pp.getX(k) * 0.62); pp.setY(k, pp.getY(k) * 0.62); } } geo.computeVertexNormals();
    const lf = new T.Group(); lf.position.set(Math.cos(a) * d, h * 0.9, Math.sin(a) * d); lf.rotation.y = -a; g.add(lf); sway(lf, 0.05);
    const leaf = mesh(geo, M2.monstera, lf, 0.3, 0, 0); leaf.rotation.set(-Math.PI / 2 + rr(0.3, 0.7), 0, 0); }
  return g;
}
function flowers(parent, x, z, m) { const g = bush(parent, x, z, rr(0.3, 0.45), M.leaf); for (let i = 0; i < 9; i++) mesh(new T.IcosahedronGeometry(0.06, 0), m, g, rr(-0.35, 0.35), rr(0.35, 0.65), rr(-0.35, 0.35)); return g; }
function reeds(parent, x, z) { const g = new T.Group(); g.position.set(x, 0, z); parent.add(g); sway(g, 0.05); g.userData.fern = true; FERNS.push(g); for (let i = 0; i < 10; i++) { const h = rr(1.0, 1.9); const c = mesh(new T.ConeGeometry(0.03, h, 3), M2.reed, g, rr(-0.3, 0.3), h / 2, rr(-0.3, 0.3)); c.rotation.set(rr(-0.15, 0.15), 0, rr(-0.15, 0.15)); } return g; }
function succulent(parent, x, y, z, s = 1) { const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g); for (let i = 0; i < 10; i++) { const c = mesh(new T.ConeGeometry(0.05, 0.28, 3), M2.succ, g); c.geometry.translate(0, 0.14, 0); const p = new T.Group(); p.rotation.y = i / 10 * 6.28; p.add(c); c.rotation.x = i < 5 ? 0.9 : 0.4; g.add(p); } return g; }
function crackedTiles(parent, x, z) { const sp = mesh(new T.CylinderGeometry(rr(0.5, 0.8), rr(0.6, 0.9), 0.03, 6), M.soil, parent, x, 0.125, z); sp.castShadow = false; const n = 3 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const t = mesh(new T.BoxGeometry(rr(0.35, 0.65), 0.09, rr(0.3, 0.6)), R() < 0.5 ? M.stoneLight : M.stone, parent, x + rr(-0.5, 0.5), rr(0.1, 0.19), z + rr(-0.5, 0.5)); t.rotation.set(rr(-0.12, 0.12), R() * 3, rr(-0.12, 0.12)); } }
function wipeTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); for (let i = 0; i < 9; i++) { const y = 26 + i * 9; const gr = x.createLinearGradient(14, 0, 114, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.beginPath(); x.ellipse(64, y, 50 - Math.abs(i - 4) * 5, 6, (i % 2 ? 0.05 : -0.05), 0, 6.28); x.fill(); } return new T.CanvasTexture(c); }
const MEM = { on: false, list: [], state: { pot: false, wipe: false, pile: false } };
const memOn = (o, key) => { o.userData.mem = 1; o.userData.memKey = key; MEM.list.push(o); return o; }, memOff = (o, key) => { o.userData.mem = 0; o.userData.memKey = key; MEM.list.push(o); return o; };

// ---------- the interior ----------
// spiral stair geometry shared by the model and the walk line (stair centre, tread count, top tread points at the catwalk, -z)
const SPIRAL = { sx: -0.6, sz: -9.05, n: 20, cw: 5.0, da: Math.PI * 1.75 / 20, exit: [-1.35, -0.45] };
SPIRAL.a = (i) => Math.PI * 2.5 - (SPIRAL.n - 1 - i) * SPIRAL.da;          // tread i points along (cos a, -sin a)
SPIRAL.h = (i) => (i + 1) / SPIRAL.n * SPIRAL.cw;                          // tread i centre height (top tread = deck height)
SPIRAL.p = (a, r, y) => V3(SPIRAL.sx + Math.cos(a) * r, y, SPIRAL.sz - Math.sin(a) * r);
const CONCEPTS = {};
function makeConcept(key, name, desc, build) { R = mulberry(key.charCodeAt(0) * 97 + 11); const g = new T.Group(); g.visible = false; scene.add(g); const C = { key, name, desc, g, lamps: [], mist: [], holes: [], trusses: [], tints: [] }; build(C); CONCEPTS[key] = C; }

makeConcept('I', '苗圃內部', '整個畫面就是溫室裡面，像一台裝在溫室角落的監視器。中央的育苗機是這張圖的重心，也是專注計時器：每點亮一盞燈，就有一盤苗長大，第六盤永遠是空的。沿著玻璃牆有一圈空中走道，大樹從後方的破玻璃把枝葉伸進來。', (C) => {
  const g = C.g; const S = 11.5; const H = 8.4;
  // ---- floor: old tiles, moss, roots and cracks; no clean grid of paths ----
  const NE = 21, FL = NE + S, FC = (NE - S) / 2;   // the floor runs on past the camera so the room fills the frame
  mesh(new T.BoxGeometry(FL, 0.12, FL), M.stoneLight, g, FC, 0.06, FC);
  for (let i = -S + 1.5; i < NE; i += 1.5) { mesh(new T.BoxGeometry(FL, 0.005, 0.04), M.stone, g, FC, 0.125, i); mesh(new T.BoxGeometry(0.04, 0.005, FL), M.stone, g, i, 0.125, FC); }
  const FLOOR_MOSS = mat(new T.Color(0x6d7350).lerp(new T.Color(0xbab29c), 0.35).getHex());   // 2026-10-15: floor moss closer to the tiles
  for (let i = 0; i < 44; i++) { const d = mesh(new T.CylinderGeometry(rr(0.5, 1.3), rr(0.5, 1.3), 0.025, 11), FLOOR_MOSS, g, rr(-10.5, 19), 0.13, rr(-10.5, 19)); d.scale.set(rr(0.6, 1.4), 1, rr(0.6, 1.4)); d.rotation.y = R() * 3; { const pp = d.geometry.attributes.position; for (let k = 0; k < pp.count; k++) { const f = 0.75 + 0.5 * Math.abs(Math.sin(k * 2.7 + i)); pp.setX(k, pp.getX(k) * f); pp.setZ(k, pp.getZ(k) * f); } d.geometry.computeVertexNormals(); } d.castShadow = false; }
  // cracked, uneven tiles where the roots push through (soil showing between the broken pieces)
  for (let i = 0; i < 18; i++) { const a = rr(0.15, 1.45), d = rr(3.2, 9.5); crackedTiles(g, -6 + Math.cos(a) * d, -6 + Math.sin(a) * d); }
  for (let i = 0; i < 12; i++) { const c = mesh(new T.BoxGeometry(rr(0.4, 1.0), 0.006, 0.025), mat(0x8a8270), g, rr(-9, 14), 0.127, rr(-9, 14)); c.rotation.y = R() * 3; c.castShadow = false; }
  // glass shards under the broken panes, a toppled pot with spilled soil
  for (let i = 0; i < 26; i++) { const s = mesh(new T.BoxGeometry(rr(0.2, 0.6), 0.02, rr(0.15, 0.45)), glassMat, g, R() < 0.5 ? rr(-10.8, -8.5) : rr(-9, 9), 0.14, 0); s.position.z = s.position.x < -8.4 ? rr(-10, 8) : rr(-10.8, -8.8); s.rotation.y = R() * 3; s.castShadow = false; }
  { const p = memOff(pot(g, 2.2, 6.4, 0.3, false), 'pot'); p.rotation.z = 1.45; p.position.y = 0.3; const soil = memOff(mesh(new T.CylinderGeometry(0.55, 0.7, 0.04, 8), M.soil, g, 2.9, 0.14, 6.6), 'pot'); soil.castShadow = false;
    memOn(pot(g, 2.4, 6.2, 0.3, false), 'pot'); C.fallenPot = p; C.spill = soil; }   // world memory: the pot set upright again (animated by the potRight event)   // world memory: the pot set upright again
  { const p = pot(g, -3.0, 8.6, 0.24, false); p.rotation.x = 1.4; p.position.y = 0.26; }

  // ---- far walls (back-left x=-S along z, back-right z=-S along x). Corridor door in the back-left wall, inside the clear middle band ----
  const WL = wallWithCornice(g, { origin: V3(-S, 0, S), dir: V3(0, 0, -1), nrm: V3(1, 0, 0), len: 2 * S, H, c: 2.2, bay: 1.92, door: [8.5, 11.5], holes: C.holes, tints: C.tints });
  const WR = wallWithCornice(g, { origin: V3(-S, 0, -S), dir: V3(1, 0, 0), nrm: V3(0, 0, 1), len: 2 * S, H, c: 2.2, bay: 1.92, holes: C.holes, tints: C.tints });
  mesh(new T.BoxGeometry(0.4, H + 2.5, 0.4), M.iron, g, -S, (H + 2.5) / 2, -S);
  [[V3(-S, 0, NE), V3(1, 0, 0)], [V3(NE, 0, -S), V3(0, 0, 1)]].forEach(([o, d]) => { const m = mesh(new T.BoxGeometry(FL, 0.45, 0.4), M.stone, g); m.position.copy(o).addScaledVector(d, FL / 2); m.position.y = 0.22; m.rotation.y = Math.atan2(-d.z, d.x); for (let s = 0; s <= FL; s += 1.5) { const p = o.clone().addScaledVector(d, s); mesh(new T.BoxGeometry(0.14, 0.75, 0.14), M.iron, g, p.x, 0.62, p.z); mesh(new T.BoxGeometry(0.15, 0.06, 0.15), M.rust, g, p.x, 1.0, p.z); } });

  // ---- catwalk along both glass walls (deck at 3.6) + spiral stair ----
  const CW = 5.0, CWW = 1.1;   // high and narrow so the lower glass wall stays visible under it
  const deckM = mat(0x4a4842, { roughness: 0.55, metalness: 0.3 });
  const catwalk = (x0, z0, x1, z1, inward, gap) => {
    const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2 + inward.x * CWW / 2, mz = (z0 + z1) / 2 + inward.z * CWW / 2;
    const deck = mesh(new T.BoxGeometry(len, 0.08, CWW), deckM, g, mx, CW, mz); deck.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    for (let s = 0; s <= len; s += 0.5) { const p = V3(x0 + (x1 - x0) * s / len + inward.x * CWW / 2, CW + 0.05, z0 + (z1 - z0) * s / len + inward.z * CWW / 2); const b = mesh(new T.BoxGeometry(0.03, 0.02, CWW), M.rust, g, p.x, p.y, p.z); b.rotation.y = deck.rotation.y; }
    const edge = (k) => V3(x0 + inward.x * CWW * k, 0, z0 + inward.z * CWW * k), edge1 = (k) => V3(x1 + inward.x * CWW * k, 0, z1 + inward.z * CWW * k);
    const at = (sv) => V3(x0 + (x1 - x0) * sv / len + inward.x * CWW, 0, z0 + (z1 - z0) * sv / len + inward.z * CWW);
    const spans = gap ? [[0, gap[0]], [gap[1], len]] : [[0, len]];
    spans.forEach(([a0, a1]) => { tube([at(a0).setY(CW + 1.0), at(a1).setY(CW + 1.0)], 0.035, M.ironDark, g, 2); tube([at(a0).setY(CW + 0.5), at(a1).setY(CW + 0.5)], 0.02, M.ironDark, g, 2); });
    for (let s = 0; s <= len; s += 1.0) { if (gap && s > gap[0] - 0.05 && s < gap[1] + 0.05) continue; const p = V3(x0 + (x1 - x0) * s / len + inward.x * CWW, 0, z0 + (z1 - z0) * s / len + inward.z * CWW); mesh(new T.BoxGeometry(0.04, 1.0, 0.04), M.ironDark, g, p.x, CW + 0.5, p.z); }
    for (let s = 1.5; s < len; s += 3.0) { const p = V3(x0 + (x1 - x0) * s / len + inward.x * CWW * 0.85, 0, z0 + (z1 - z0) * s / len + inward.z * CWW * 0.85); mesh(new T.BoxGeometry(0.1, CW, 0.1), M.iron, g, p.x, CW / 2, p.z); const br = mesh(new T.BoxGeometry(0.05, 1.2, 0.05), M.iron, g, p.x - inward.x * 0.4, CW - 0.45, p.z - inward.z * 0.4); br.rotation.set(inward.z * 0.7, 0, -inward.x * 0.7); }
  };
  catwalk(-S + 0.25, -S + 0.25, -S + 0.25, S - 2.0, V3(1, 0, 0));          // back-left wall
  catwalk(-S + 0.25 + CWW, -S + 0.25, S - 2.0, -S + 0.25, V3(0, 0, 1), [SPIRAL.exit[0] + S - 0.25 - CWW, SPIRAL.exit[1] + S - 0.25 - CWW]);    // back-right wall
  { // spiral stair up to the back-right catwalk — treads, balusters, rail and the walk line all come from SPIRAL so they stay aligned
    const { sx, sz, n } = SPIRAL, deckEdge = -S + 0.25 + CWW, xIn = SPIRAL.exit[1], xOut = SPIRAL.exit[0];
    mesh(new T.CylinderGeometry(0.07, 0.07, CW + 1.1, 6), M.ironDark, g, sx, (CW + 1.1) / 2, sz);
    for (let i = 0; i < n - 1; i++) { const st = new T.Group(); st.position.set(sx, SPIRAL.h(i), sz); st.rotation.y = SPIRAL.a(i); g.add(st); mesh(new T.BoxGeometry(1.0, 0.05, 0.36), deckM, st, 0.55, 0, 0); mesh(new T.BoxGeometry(0.03, 0.9, 0.03), M.ironDark, st, 1.02, 0.45, 0); }
    // top landing (replaces the last tread): fills the gap between the last tread and the catwalk deck, flush with the deck
    const aL = SPIRAL.a(n - 1) - SPIRAL.da / 2, k = (sz - deckEdge) / Math.sin(aL), lp = [[sx, sz], [sx + Math.cos(aL) * k, deckEdge], [xOut, deckEdge], [xOut, sz]];
    const sh = new T.Shape(); lp.forEach(([x, z], q) => (q ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
    const land = mesh(new T.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }), deckM, g, 0, CW - 0.04, 0); land.rotation.x = -Math.PI / 2;
    // stair rail follows the tread nosings, then bends onto the catwalk rail at the inner side of the opening
    const rail = []; for (let q = 0; q <= 40; q++) { const ia = -0.5 + q / 40 * (n - 1.5), a = SPIRAL.a(0) + ia * SPIRAL.da; rail.push(V3(sx + Math.cos(a) * 1.02, SPIRAL.h(ia) + 0.92, sz - Math.sin(a) * 1.02)); }
    rail.push(V3(xIn, CW + 1.0, deckEdge)); tube(rail, 0.025, M.ironDark, g, 80);
    // guard rail around the open sides of the landing, meeting the catwalk rail at the outer side of the opening
    [CW + 1.0, CW + 0.5].forEach((y, q) => tube([V3(xOut, y, deckEdge), V3(xOut, y, sz), V3(sx - 0.1, y, sz)], q ? 0.02 : 0.035, M.ironDark, g, 12));
    [[xIn, deckEdge], [xOut, deckEdge], [xOut, sz]].forEach(([x, z]) => mesh(new T.BoxGeometry(0.05, 1.0, 0.05), M.ironDark, g, x, CW + 0.5, z));
  }

  // ---- exit 1: glass corridor (door in the back-left wall, z 0..3) ----
  const dz0 = 3.0, dz1 = 0.0, dzc = 1.5;
  [dz0, dz1].forEach((z) => mesh(new T.BoxGeometry(0.22, 3.0, 0.22), M.ironDark, g, -S, 1.5, z));
  tube((() => { const a = []; for (let k = 0; k <= 10; k++) { const t = k / 10 * Math.PI; a.push(V3(-S + 0.05, 3.0 + Math.sin(t) * 0.5, dz1 + (dz0 - dz1) * (0.5 - 0.5 * Math.cos(t)))); } return a; })(), 0.07, M.ironDark, g, 16);
  const leaf1 = mesh(new T.BoxGeometry(0.06, 2.8, 1.45), M.rust, g, -S + 0.65, 1.4, dz0 - 0.15); leaf1.rotation.y = 0.9; C.exitDoor=leaf1;
  mesh(new T.BoxGeometry(14, 0.1, 2.6), M.stone, g, -S - 7, 0.05, dzc);
  vault(g, { x0: -S - 14, x1: -S, cz: dzc, w: 1.4, wh: 2.2, step: 1.2, broken: 0.25 });
  for (let i = 0; i < 7; i++) vine(g, -S - rr(1, 12), 3.1, dzc + rr(-1, 1), rr(0.6, 1.8));
  for (let i = 0; i < 6; i++) fern(g, -S - rr(1, 13), dzc + rr(-1.0, 1.0), rr(0.5, 0.8));

  // ---- exit 2: boiler cellar hatch (right side, clear middle band) ----
  const hx = 8.4, hz = -1.6;
  mesh(new T.BoxGeometry(2.4, 0.16, 2.4), M.stoneDark, g, hx, 0.08, hz);
  const pit = mesh(new T.BoxGeometry(1.9, 0.02, 1.9), mat(0x14130f), g, hx, 0.165, hz); pit.castShadow = false;
  for (let i = 0; i < 2; i++) mesh(new T.BoxGeometry(1.5, 0.06, 0.32), M.ironDark, g, hx, 0.15 - i * 0.02, hz + 0.6 - i * 0.4);
  const lid = mesh(new T.BoxGeometry(1.5, 0.07, 1.4), M.rust, g, hx, 0.62, hz - 1.1); lid.rotation.x = 1.05;
  [hx - 1.0, hx + 1.0].forEach((x) => { mesh(new T.BoxGeometry(0.05, 0.9, 0.05), M.ironDark, g, x, 0.6, hz - 0.9); mesh(new T.BoxGeometry(0.05, 0.9, 0.05), M.ironDark, g, x, 0.6, hz + 0.9); tube([V3(x, 1.05, hz - 0.9), V3(x, 1.05, hz + 0.9)], 0.03, M.ironDark, g, 2); });
  const pump = new T.Group(); pump.position.set(10.3, 0, 0.8); g.add(pump);
  mesh(new T.CylinderGeometry(0.5, 0.55, 1.1, 10), M.copper, pump, 0, 0.55, 0); mesh(new T.SphereGeometry(0.5, 10, 6, 0, 6.28, 0, Math.PI / 2), M.copper, pump, 0, 1.1, 0);
  mesh(new T.TorusGeometry(0.32, 0.04, 4, 14), M.rust, pump, -0.58, 0.7, 0).rotation.y = Math.PI / 2;
  mesh(new T.CylinderGeometry(0.16, 0.16, 0.05, 12), M.paper, pump, -0.4, 1.0, 0.35).rotation.x = Math.PI / 2;
  pipeRun(g, [V3(10.3, 1.3, 0.8), V3(10.3, 6.4, 0.8), V3(10.3, 6.8, -0.8), V3(10.3, 6.8, -S + 0.6)], 0.08);
  pipeRun(g, [V3(9.9, 0.25, 0.4), V3(9.6, 0.25, -1.0)], 0.07); valve(g, 9.8, 0.25, -0.2);
  pipeRun(g, [V3(9.8, 0.25, 1.2), V3(4.0, 0.25, 1.6), V3(2.6, 0.25, 0.9)], 0.07);

  // ---- sprinkler gantry under the back-right cornice ----
  tube([V3(-S + 1, 6.95, -S + 0.6), V3(S - 0.6, 6.95, -S + 0.6)], 0.07, M.copper, g, 2);
  const arm = sprinklerTruss(g, 0, 6.8, -S + 3.6, 6.0); arm.rotation.y = Math.PI / 2; C.trusses.push({ o: arm, slide: [1.5, 8.5], mach: true });

  // ---- back-left: the overgrown bed, and the big tree reaching in through the broken back corner ----
  mesh(new T.BoxGeometry(8.0, 0.45, 8.0), M.soil, g, -6.9, 0.22, -6.9);
  [[-6.9, -2.85, 8.2, 0.25], [-2.85, -6.9, 0.25, 8.2]].forEach(([x, z, w, d]) => { const c = mesh(new T.BoxGeometry(w, 0.55, d), M.stone, g, x, 0.27, z); c.rotation.y = rr(-0.02, 0.02); });
  const tr = tree(g, -5.8, -5.8, 5.4, 3.6); tr.position.y = 0.4; tr.scale.set(0.82, 0.95, 0.82);
  for (let i = 0; i < 8; i++) { const a = R() * 6.28; vine(g, -6.2 + Math.cos(a) * rr(1, 3), rr(5.6, 6.6), -6.2 + Math.sin(a) * rr(1, 3), rr(1.4, 3.2)); }
  // roots crawling out of the bed across the floor
  for (let i = 0; i < 6; i++) { const a = rr(0.1, 1.45); const pts = [V3(-6.2, 0.5, -6.2)]; for (let k = 1; k <= 4; k++) pts.push(V3(-6.2 + Math.cos(a) * k * 2.0 + rr(-0.4, 0.4), 0.16 + (k === 1 ? 0.25 : 0.02), -6.2 + Math.sin(a) * k * 2.0 + rr(-0.4, 0.4))); tube(pts, 0.11 - i * 0.008, M.bark, g, 18); }
  palm(g, -3.8, -9.4, 5.2, 0.25).position.y = 0.4; palm(g, -9.4, -3.6, 4.6, 0.2).position.y = 0.4; palm(g, -9.6, -8.4, 4.0, 0.2).position.y = 0.4;
  banana(g, -7.2, -3.8, 1.2).position.y = 0.4; banana(g, -3.8, -6.6, 1.0).position.y = 0.4; banana(g, -9.6, -6.0, 1.0).position.y = 0.4;
  for (let i = 0; i < 20; i++) fern(g, rr(-10.6, -3.2), rr(-10.6, -3.2), rr(0.8, 1.3), R() < 0.5 ? M.leaf : M.leafLight).position.y = 0.42;
  for (let i = 0; i < 8; i++) { const y = rr(8.8, 9.8); vine(g, -S + 0.5 + rr(0, 1.2), y, rr(-10, 8), Math.min(rr(1.5, 4.5), y - 6.95)); }   // stop above the catwalk walker's head
  for (let i = 0; i < 6; i++) { const y = rr(8.8, 9.8); vine(g, rr(-10, 10), y, -S + 0.5 + rr(0, 1.2), Math.min(rr(1.5, 4.5), y - 6.95)); }
  // plants spilling out onto the floor
  for (let i = 0; i < 16; i++) fern(g, rr(-3, 4), rr(-3, 4) - 1, rr(0.5, 0.9), M.leafLight);
  for (let i = 0; i < 10; i++) fern(g, rr(-9, 1), rr(4, 10), rr(0.6, 1.0));

  // ---- back-right: seedling troughs under the gantry ----
  seedTrough(g, 4.8, -9.4, 7.0); seedTrough(g, 4.8, -7.0, 7.0); seedTrough(g, 4.8, -4.6, 7.0);

  // ---- sunken pool (front-left of centre) ----
  { const px = -5.4, pz = 1.6; mesh(new T.BoxGeometry(3.4, 0.2, 2.6), M.stoneDark, g, px, 0.1, pz); const w = mesh(new T.BoxGeometry(3.0, 0.02, 2.2), M.water, g, px, 0.15, pz); w.castShadow = false;
    [[0, -1.3, 3.4, 0.2], [0, 1.3, 3.4, 0.2], [-1.7, 0, 0.2, 2.6], [1.7, 0, 0.2, 2.6]].forEach(([dx, dz, ww, dd]) => mesh(new T.BoxGeometry(ww, 0.26, dd), M.stone, g, px + dx, 0.13, pz + dz));
    for (let i = 0; i < 6; i++) { const lp = mesh(new T.CylinderGeometry(rr(0.15, 0.28), rr(0.15, 0.28), 0.02, 7), M.leafLight, g, px + rr(-1.2, 1.2), 0.17, pz + rr(-0.9, 0.9)); lp.castShadow = false; }
    fern(g, px - 1.6, pz - 1.2, 1.0); }

  // ---- front-left: caretaker's corner — workbench, growth chart, seed cabinet (locked drawer = core), specimen table ----
  const bench1 = new T.Group(); bench1.position.set(-9.8, 0, 6.2); bench1.rotation.y = Math.PI / 2; g.add(bench1);
  mesh(new T.BoxGeometry(3.2, 0.1, 1.0), M.wood, bench1, 0, 0.92, 0); [[-1.5, -0.42], [1.5, -0.42], [-1.5, 0.42], [1.5, 0.42]].forEach(([x, z]) => mesh(new T.BoxGeometry(0.08, 0.9, 0.08), M.woodDark, bench1, x, 0.45, z));
  mesh(new T.BoxGeometry(3.0, 0.06, 0.8), M.wood, bench1, 0, 0.3, 0);
  for (let i = 0; i < 4; i++) pot(bench1, -1.2 + i * 0.6, rr(-0.2, 0.2), 0.16).position.y = 0.97;
  const mulch = mesh(new T.BoxGeometry(0.5, 0.08, 0.4), M.canvasBag, bench1, 1.15, 1.0, 0.1); // 護根布, folded
  // growth chart on the wall: tick marks that get denser, then stop
  { const bd = mesh(new T.BoxGeometry(0.05, 1.6, 1.4), M.wood, g, -S + 0.45, 2.2, 6.2); for (let i = 0; i < 18; i++) { const y = 1.55 + Math.pow(i / 18, 0.6) * 1.2; mesh(new T.BoxGeometry(0.02, 0.025, i % 5 === 0 ? 0.7 : 0.4), M.woodDark, g, -S + 0.48, y, 6.0); } }
  const cab = new T.Group(); cab.position.set(-7.4, 0, 9.8); g.add(cab);
  mesh(new T.BoxGeometry(2.4, 2.2, 0.7), M.woodDark, cab, 0, 1.1, 0);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) { mesh(new T.BoxGeometry(0.34, 0.3, 0.04), M.wood, cab, -0.95 + k * 0.38, 0.35 + r * 0.38, 0.36); mesh(new T.BoxGeometry(0.08, 0.03, 0.03), M.copper, cab, -0.95 + k * 0.38, 0.35 + r * 0.38, 0.39); }
  const table = new T.Group(); table.position.set(-4.4, 0, 6.8); g.add(table);
  mesh(new T.BoxGeometry(2.2, 0.08, 1.2), M.wood, table, 0, 0.88, 0); [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].forEach(([x, z]) => mesh(new T.BoxGeometry(0.07, 0.86, 0.07), M.woodDark, table, x, 0.43, z));
  bellJar(table, -0.6, 0.92, -0.1, 1.1); bellJar(table, 0.1, 0.92, 0.2, 0.9); mesh(new T.BoxGeometry(0.5, 0.06, 0.36), M.paper, table, 0.65, 0.95, -0.1).rotation.y = 0.3; // book with the pressed leaf
  const wb = new T.Group(); wb.position.set(-0.4, 0, 9.0); wb.rotation.y = 0.6; g.add(wb); mesh(new T.BoxGeometry(0.8, 0.35, 0.55), M.rust, wb, 0, 0.5, 0); mesh(new T.CylinderGeometry(0.2, 0.2, 0.08, 10), M.ironDark, wb, 0.5, 0.2, 0).rotation.x = Math.PI / 2; tube([V3(-0.3, 0.55, -0.25), V3(-1.0, 0.65, -0.3)], 0.025, M.wood, wb, 2); tube([V3(-0.3, 0.55, 0.25), V3(-1.0, 0.65, 0.3)], 0.025, M.wood, wb, 2);

  // ---- centre: the seed machine (rest point). Rotating seed-tray disc, mast, three nozzle arms ----
  const mx = 0.4, mz = 0.4;
  mesh(new T.CylinderGeometry(2.5, 2.7, 0.35, 32), M.stoneDark, g, mx, 0.17, mz);
  const disc = new T.Group(); disc.position.set(mx, 0.36, mz); g.add(disc); C.disc = disc; C.trusses.push({ o: disc, spin: 0.06, mach: true });
  mesh(new T.CylinderGeometry(2.25, 2.25, 0.08, 36), M.grate, disc, 0, 0.04, 0); ring(disc, 0, 0.1, 0, 2.25, 0.06, M.copper); ring(disc, 0, 0.1, 0, 1.2, 0.04, M.copper);
  C.trays = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const tg = new T.Group(); tg.position.set(Math.cos(a) * 1.65, 0.1, Math.sin(a) * 1.65); tg.rotation.y = -a; disc.add(tg); mesh(new T.BoxGeometry(0.95, 0.14, 0.66), M.woodDark, tg, 0, 0.07, 0);
    if (i === 5) { // the sixth tray: always empty, always watered
      mesh(new T.BoxGeometry(0.85, 0.05, 0.56), M2.wetSoil, tg, 0, 0.15, 0); const pud = mesh(new T.CylinderGeometry(0.16, 0.16, 0.01, 10), M.water, tg, 0.15, 0.18, 0.08); pud.castShadow = false; mesh(new T.BoxGeometry(0.03, 0.42, 0.03), M.wood, tg, -0.32, 0.36, -0.2); mesh(new T.BoxGeometry(0.16, 0.1, 0.02), M.paper, tg, -0.32, 0.55, -0.18); C.emptyTray = tg; continue; }
    mesh(new T.BoxGeometry(0.85, 0.05, 0.56), M.soil, tg, 0, 0.15, 0); const sg = new T.Group(); sg.position.y = 0.17; tg.add(sg);
    for (let k = 0; k < 6; k++) { const pl = new T.Group(); pl.position.set(-0.28 + (k % 3) * 0.28, 0, -0.13 + Math.floor(k / 3) * 0.26); sg.add(pl); mesh(new T.CylinderGeometry(0.012, 0.015, 0.3, 4), M.leafDark, pl, 0, 0.15, 0); for (let q = 0; q < 3; q++) { const lf = mesh(new T.ConeGeometry(0.06, 0.2, 3), q ? M.leafLight : M.leaf, pl, 0, 0.26 + q * 0.04, 0); lf.rotation.set(0.9, q * 2.1, 0); } }
    sg.scale.set(1, 0.15, 1); C.trays.push({ sg, cur: 0.15 }); }
  mesh(new T.CylinderGeometry(0.22, 0.3, 2.8, 10), M.copper, g, mx, 1.6, mz);
  mesh(new T.CylinderGeometry(0.45, 0.45, 0.5, 10), M.ironDark, g, mx, 3.0, mz);
  const head = new T.Group(); head.position.set(mx, 3.0, mz); g.add(head); C.trusses.push({ o: head, spin: -0.1, mach: true });
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; const am = new T.Group(); am.rotation.y = a; head.add(am); mesh(new T.BoxGeometry(2.6, 0.07, 0.07), M.copper, am, 1.5, 0.05, 0); tube([V3(0.3, 0.2, 0), V3(1.6, 0.5, 0), V3(2.75, 0.05, 0)], 0.025, M.rust, am, 8); for (let k = 0; k < 3; k++) { mesh(new T.CylinderGeometry(0.02, 0.02, 0.3, 4), M.copper, am, 1.1 + k * 0.7, -0.12, 0); mesh(new T.ConeGeometry(0.06, 0.1, 6), M.copper, am, 1.1 + k * 0.7, -0.3, 0).rotation.x = Math.PI; } }
  mesh(new T.SphereGeometry(0.3, 10, 6, 0, 6.28, 0, Math.PI / 2), M.rust, g, mx, 3.25, mz);
  C.machineMist = []; mistCloud(g, C.machineMist, mx, mz, 2.2, 6, 2.2);
  luggage(g, 4.0, 2.2, 0.4);

  // ---- variety pass: monstera, flowers, reeds, succulents, ivy on the catwalk ----
  [[-4.2, -4.0, 1.2], [-8.6, -7.8, 1.4], [-3.4, -8.8, 1.1], [-9.2, -4.6, 1.0], [-6.8, -9.6, 1.2]].forEach(([x, z, sc]) => monstera(g, x, z, sc).position.y = 0.42);
  [[-2.6, -0.7, M2.flowerA], [-7.0, 0.0, M2.flowerB], [-3.6, 0.2, M2.flowerC], [-8.2, 8.2, M2.flowerA], [0.6, 7.2, M2.flowerB], [7.0, 6.8, M2.flowerC], [5.2, 8.6, M2.flowerA]].forEach(([x, z, m]) => flowers(g, x, z, m));
  [[-7.2, 3.0], [-3.8, 2.6], [-7.4, 0.2]].forEach(([x, z]) => reeds(g, x, z));
  [[-9.9, 1.0, 5.0], [-9.9, 1.0, 7.3]].forEach(([x, y, z]) => succulent(g, x, y, z, 0.8));
  for (let i = 0; i < 6; i++) succulent(g, rr(1.8, 7.8), 0.72, rr(-4.85, -4.35), rr(0.6, 0.9));   // on the trough rims
  for (let i = 0; i < 12; i++) vine(g, -S + 0.25 + 1.1, 5.0, rr(-10, 8), rr(0.6, 1.8));
  for (let i = 0; i < 10; i++) vine(g, rr(-9, 8), 5.0, -S + 0.25 + 1.1, rr(0.6, 1.8));


  // ---- wall dressing: shelves with jars and pots, trellis with climbers, foliage pressing on the glass from outside ----
  const shelf = (x0, z0, x1, z1, y, inward) => { const len = Math.hypot(x1 - x0, z1 - z0); const m = mesh(new T.BoxGeometry(len, 0.06, 0.45), M.wood, g, (x0 + x1) / 2 + inward.x * 0.3, y, (z0 + z1) / 2 + inward.z * 0.3); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    for (let s = 0.4; s < len; s += rr(0.28, 0.55)) { const px = x0 + (x1 - x0) * s / len + inward.x * 0.3, pz = z0 + (z1 - z0) * s / len + inward.z * 0.3; const r0 = R(); if (r0 < 0.45) pot(g, px, pz, rr(0.1, 0.15), R() < 0.7).position.y = y + 0.03; else if (r0 < 0.75) { const j = mesh(new T.CylinderGeometry(0.07, 0.07, rr(0.18, 0.3), 8), R() < 0.5 ? algaeMat : frostMat, g, px, y + 0.15, pz); j.castShadow = false; } else succulent(g, px, y + 0.03, pz, 0.45); }
    for (let s = 0.6; s < len; s += 2.2) { const px = x0 + (x1 - x0) * s / len + inward.x * 0.3, pz = z0 + (z1 - z0) * s / len + inward.z * 0.3; const br = mesh(new T.BoxGeometry(0.05, 0.35, 0.05), M.ironDark, g, px, y - 0.18, pz); } };
  shelf(1.0, -S + 0.2, 9.8, -S + 0.2, 1.55, V3(0, 0, 1));
  shelf(-S + 0.2, 4.6, -S + 0.2, 8.2, 1.65, V3(1, 0, 0));
  shelf(-S + 0.2, -2.2, -S + 0.2, 0.0, 1.5, V3(1, 0, 0));
  const trellis = (cx, cz, along, w, h) => { const grp = new T.Group(); grp.position.set(cx, 0.6, cz); grp.rotation.y = along; g.add(grp); for (let k = -w / 2; k <= w / 2 + 0.01; k += 0.35) { const b1 = mesh(new T.BoxGeometry(0.03, h * 1.25, 0.03), M.wood, grp, k, h / 2, 0); b1.rotation.z = 0.6; const b2 = mesh(new T.BoxGeometry(0.03, h * 1.25, 0.03), M.wood, grp, k, h / 2, 0); b2.rotation.z = -0.6; } for (let k = 0; k < 9; k++) mesh(new T.IcosahedronGeometry(rr(0.12, 0.22), 0), R() < 0.5 ? M.leaf : M.leafLight, grp, rr(-w / 2, w / 2), rr(0.1, h), 0.05); };
  trellis(-6.5, -S + 0.35, 0, 2.2, 2.4); trellis(-S + 0.35, -6.5, Math.PI / 2, 2.2, 2.4); trellis(8.6, -S + 0.35, 0, 1.8, 2.0);
  // outside, against the glass: big leaves seen through the panes
  for (let i = 0; i < 9; i++) { let z = rr(-10, 9); if (z > -1.2 && z < 4.2) z -= 5.6; banana(g, -S - rr(0.6, 1.4), z, rr(1.1, 1.6)); }
  for (let i = 0; i < 9; i++) { const x = rr(-10, 10); (R() < 0.5 ? banana : monstera)(g, x, -S - rr(0.6, 1.4), rr(1.1, 1.7)); }
  for (let i = 0; i < 6; i++) { let z = rr(-10, 9); if (z > -1.5 && z < 4.5) z -= 6; palm(g, -S - rr(1.5, 3), z, rr(4, 6), 0.2); }
  for (let i = 0; i < 6; i++) palm(g, rr(-10, 10), -S - rr(1.5, 3), rr(4, 6), 0.2);

  // ---- world memory spots (toggle in the panel) ----
  { const wm = new T.MeshBasicMaterial({ map: wipeTex(), transparent: true, depthWrite: false, color: 0x1d2632, opacity: 0 }); const wipe = new T.Mesh(new T.PlaneGeometry(1.5, 1.3), wm); wipe.position.set(-S + 0.08, 1.9, -1.2); wipe.rotation.y = Math.PI / 2; wipe.renderOrder = 3; g.add(wipe); C.wipe = memOn(wipe, 'wipe'); }
  { const pile = new T.Group(); pile.position.set(-10.5, 0.12, 7.0); g.add(pile); for (let i = 0; i < 16; i++) { const sh = mesh(new T.BoxGeometry(rr(0.2, 0.5), 0.02, rr(0.15, 0.4)), glassMat, pile, rr(-0.35, 0.35), i * 0.018, rr(-0.35, 0.35)); sh.rotation.set(rr(-0.4, 0.4), R() * 3, rr(-0.4, 0.4)); sh.castShadow = false; } memOn(pile, 'pile'); }

  // hanging baskets from the cornice
  for (let i = 0; i < 5; i++) hangingBasket(g, V3(-S + 2.6, 9.2, -8 + i * 3.6), rr(1.6, 3.0));
  for (let i = 0; i < 5; i++) hangingBasket(g, V3(-5 + i * 3.6, 9.2, -S + 2.6), rr(1.6, 3.0));
  // near zone (past the old wall line): low beds, potted palms and ferns so the bottom of the frame stays planted
  const nearSpot = () => { for (;;) { const x = rr(-10.5, 20), z = rr(-10.5, 20); if (x + z > 9.5 && (x > 9.6 || z > 10.2) && Math.hypot(x + 7.3, z - 10.6) > 2.6 && Math.hypot(x + 4.4, z - 8.0) > 1.6) return [x, z]; } };
  for (let i = 0; i < 46; i++) { const [x, z] = nearSpot(); fern(g, x, z, rr(0.7, 1.3), R() < 0.5 ? M.leaf : M.leafLight); }
  for (let i = 0; i < 12; i++) { const [x, z] = nearSpot(); bush(g, x, z, rr(0.45, 0.8), R() < 0.5 ? M.leaf : M.leafDark); }
  for (let i = 0; i < 6; i++) { const [x, z] = nearSpot(); palm(g, x, z, rr(2.6, 3.8), 0.2); }
  for (let i = 0; i < 5; i++) { const [x, z] = nearSpot(); banana(g, x, z, rr(0.8, 1.1)); }
  for (let i = 0; i < 10; i++) { const [x, z] = nearSpot(); pot(g, x, z, rr(0.2, 0.32), R() < 0.8); }
  [[13.5, -4], [-4, 13.5], [12.5, 6.5], [6, 12.5]].forEach(([x, z]) => { const b = mesh(new T.BoxGeometry(3.4, 0.4, 1.4), M.soil, g, x, 0.2, z); b.rotation.y = x > z ? Math.PI / 2 : 0; mesh(new T.BoxGeometry(x > z ? 1.6 : 3.6, 0.46, x > z ? 3.6 : 1.6), M.stone, g, x, 0.18, z).scale.set(1, 1, 1); for (let k = 0; k < 6; k++) fern(g, x + rr(-1.4, 1.4) * (x > z ? 0.4 : 1), z + rr(-1.4, 1.4) * (x > z ? 1 : 0.4), rr(0.6, 0.9), M.leafLight).position.y = 0.4; });

  // boiler house outside the back-right corner
  const bh = new T.Group(); bh.position.set(S + 3.2, 0, -S - 2.8); g.add(bh);
  mesh(new T.BoxGeometry(4, 3.4, 3.4), mat(0x8a5a46), bh, 0, 1.7, 0); mesh(new T.BoxGeometry(4.4, 0.3, 3.8), M.stoneDark, bh, 0, 3.5, 0);
  mesh(new T.CylinderGeometry(0.35, 0.45, 8, 8), mat(0x7a4c3a), bh, 1.0, 5.5, -0.6);

  // lamps: three on the floor, two up on the catwalk
  lamp(g, C.lamps, -0.6, 6.2); lamp(g, C.lamps, 6.6, 2.7); lamp(g, C.lamps, -5.4, 5.6);
  lamp(g, C.lamps, 0.3, -6.2); lamp(g, C.lamps, -9.0, 0.4);   // all five lamps on the ground floor
  mistCloud(g, C.mist, 0, 0, 11, 44, 6.5); mistCloud(g, C.mist, -S - 7, dzc, 4, 6, 2.6);
  C.travPos = V3(2.2, 0.12, 3.6); C.travYaw = Math.PI * 0.25; C.view = 16.5; C.target = V3(-0.4, 2.8, -0.4);
  Object.assign(C, beams(g, C.holes, 12));
});

const trav = traveller(scene);

// ---------- moods ----------
const MOODS = {
  day:   { bg: 0xe2dcc8, fog: 0xd9d4bf, near: 0, far: 60, sun: 0xfff0d2, sunI: 0.95, dir: V3(-0.55, 0.85, -0.45), hs: 0xf2ead8, hg: 0x6a6650, hI: 0.74, glass: 0xdcefe9, gO: 0.2, mist: 0.0, mistC: 0xffffff, beam: 0.0, lamps: 0, look: 0, edge: 0.35 },
  night: { bg: 0x1d2632, fog: 0x2a3441, near: -6, far: 34, sun: 0x9fb4d6, sunI: 0.3, dir: V3(-0.42, 0.82, -0.4), hs: 0x44536b, hg: 0x16181b, hI: 0.42, glass: 0xd5dee2, gO: 0.72, mist: 0.7, mistC: 0x9eacb9, beam: 0.0, lamps: 1, look: 0.1, edge: 0.5 },
  dawn:  { bg: 0xf0d3a3, fog: 0xeccb98, near: 0, far: 55, sun: 0xffc27a, sunI: 1.3, dir: SUN_DAWN.clone(), hs: 0xf6dcb8, hg: 0x6a5844, hI: 0.6, glass: 0xf3e3c8, gO: 0.3, mist: 0.18, mistC: 0xffe7c4, beam: 0.85, lamps: 0.25, look: -0.42, edge: 0.6 }
};
const col = (h) => new T.Color(h);
const asCol = (c) => (c && c.isColor ? c.clone() : col(c));
function lerpMood(a, b, t) { const o = {}; for (const k in a) { const x = a[k], y = b[k]; if (['bg', 'fog', 'sun', 'hs', 'hg', 'glass', 'mistC'].includes(k)) o[k] = asCol(x).lerp(asCol(y), t); else if (x && x.isVector3) o[k] = x.clone().lerp(y, t).normalize(); else o[k] = x + (y - x) * t; } return o; }
let cur = lerpMood(MOODS.day, MOODS.day, 0), from = cur, to = MOODS.day, mt = 1, mDur = 1.2, playSeq = null, audioPeriod = 'day';

function apply(P) {
  scene.background.copy(P.bg); scene.fog.color.copy(P.fog); scene.fog.near = DIST + P.near; scene.fog.far = DIST + P.far;
  world.userData.sea.material.color.copy(P.fog);
  world.userData.edgeMist.forEach((s) => { s.material.opacity = P.edge; s.material.color.copy(P.fog).lerp(col(0xffffff), 0.35); });
  sun.color.copy(P.sun); sun.intensity = P.sunI; sun.position.copy(P.dir).multiplyScalar(40); sun.target.position.set(0, 0, 0);
  hemi.color.copy(P.hs); hemi.groundColor.copy(P.hg); hemi.intensity = P.hI;
  glassMat.color.copy(P.glass); glassMat.opacity = P.gO;
  wallGlassMat.color.copy(P.glass); wallGlassMat.opacity = Math.min(0.9, P.gO + 0.22); frostMat.opacity = Math.min(0.94, P.gO + 0.48); frostMat.color.copy(P.glass).lerp(col(0xffffff), 0.5); algaeMat.opacity = Math.min(0.9, P.gO + 0.36); const sheenK = 0.12 + 0.28 * Math.min(1, P.sunI); wallGlassMat.emissiveIntensity = sheenK; frostMat.emissiveIntensity = sheenK * 0.8; wallGlassMat.emissive.copy(P.sun).lerp(col(0xffffff), 0.5); frostMat.emissive.copy(wallGlassMat.emissive);
  beamU.uOpacity.value = P.beam;
  const C = CONCEPTS[active];
  C.mist.forEach((s) => { s.material.opacity = P.mist * 0.55; s.material.color.copy(P.mistC); });
  C.lamps.forEach((l, i) => { const k = (i < LIT ? Math.max(P.lamps, 0.45)*(opts.quietFocus&&!lobby?quietLampLevel(progress+(paused?0:Math.max(0,(performance.now()-progressAt)/1000)),i,600):1) : 0) + (typeof flare !== 'undefined' ? flare[i] || 0 : 0); l.gm.emissiveIntensity = 1.4 * k; l.light.intensity = 1.1 * k; l.halo.material.opacity = 0.55 * k; });
  if (C.wipe) { C.wipe.material.color.copy(P.bg); C.wipe.material.opacity = MEM.state.wipe ? Math.max(0, (P.gO - 0.18) / 0.54) * 0.85 : 0; }
  if (C.motes) C.motes.material.opacity = Math.min(1, P.beam * 1.3);
  trav.userData.head.rotation.x = P.look;
}

// ---------- camera ----------
const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 300);
const BASE_EL = 31 * Math.PI / 180, BASE_AZ = Math.PI / 4;
let yawOff = 0, pitchOff = 0, dragging = false, lx = 0, ly = 0, active = 'I';
const target = V3(0, 2, 0);
function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); glass.setSize(w,h); const aspect = w / h; const C = CONCEPTS[active]; let vh = C.view; let vw = vh * aspect; if (vw < 20) { vw = 20; vh = vw / aspect; } Object.assign(camera, { left: -vw / 2, right: vw / 2, top: vh / 2, bottom: -vh / 2 }); camera.userData.base = [-vw / 2, vw / 2, vh / 2, -vh / 2]; camera.updateProjectionMatrix(); }
function placeCam() { if (typeof camZoom !== 'undefined' && camera.userData.base) { const b = camera.userData.base; Object.assign(camera, { left: b[0] / camZoom, right: b[1] / camZoom, top: b[2] / camZoom, bottom: b[3] / camZoom }); camera.updateProjectionMatrix(); } const el = BASE_EL + pitchOff, az = BASE_AZ + yawOff; camera.position.set(target.x + DIST * Math.cos(el) * Math.sin(az), target.y + DIST * Math.sin(el), target.z + DIST * Math.cos(el) * Math.cos(az)); camera.lookAt(target); }


// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const STATUS = { day: '午後。玻璃是乾的，灑水臂沿著軌道慢慢來回。', night: '夜裡起了濃霧，玻璃整片結露，燈點起來會散成一團光。', dawn: '太陽升起來，霧從破掉的玻璃退出去，光一道一道照進來。' };
function setConcept(k) {
  active = k; Object.values(CONCEPTS).forEach((c) => { c.g.visible = c.key === k; });
  const C = CONCEPTS[k]; $('name').textContent = C.name; $('desc').textContent = C.desc; target.copy(C.target);
  trav.position.copy(C.travPos); trav.rotation.y = C.travYaw;
  document.querySelectorAll('[data-c]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c === k)));
  resize(); apply(cur);
}
let moodKey = 'day';
function setMood(k, instant) { if(opts.quietFocus&&!lobby)return; moodKey = k; playSeq = null; from = cur; to = MOODS[k]; mt = instant ? 1 : 0; if (instant) cur = lerpMood(to, to, 0); statusEl.textContent = STATUS[k]; document.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === k))); }
document.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => setConcept(b.dataset.c)));
document.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => setMood(b.dataset.m)));
$('play').addEventListener('click', () => { setMood('night', true); playSeq = { t: -1.2, dur: 9 }; statusEl.textContent = '夜裡的濃霧……'; document.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', 'false')); });

let LIT = 3;
function setMem(on) { MEM.on = on; Object.keys(MEM.state).forEach((k) => { MEM.state[k] = on; }); MEM.list.forEach((o) => { o.visible = o.userData.mem ? on : !on; }); }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- loop ----------
const clock = new T.Clock(); let time = 0;

function tick(dt) {
  if (playSeq) {
    playSeq.t += dt; const k = Math.max(0, playSeq.t / playSeq.dur);
    const base = lerpMood(MOODS.night, MOODS.dawn, smooth(0, 0.75, k));
    base.mist = MOODS.night.mist * (1 - smooth(0.15, 0.85, k)) + MOODS.dawn.mist * smooth(0.6, 1, k);
    base.gO = MOODS.night.gO + (MOODS.dawn.gO - MOODS.night.gO) * smooth(0.2, 0.9, k);
    base.beam = MOODS.dawn.beam * smooth(0.4, 0.95, k);
    base.lamps = 1 - 0.75 * smooth(0.3, 0.9, k);
    cur = base;
    if (k > 0.35 && k < 0.36) statusEl.textContent = '天亮了，霧開始從破玻璃退出去。';
    if (k > 0.7 && k < 0.71) statusEl.textContent = '光一道一道照進來，旅人抬起頭。';
    if (k >= 1) { playSeq = null; moodKey = 'dawn'; to = MOODS.dawn; mt = 1; document.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === 'dawn'))); }
  } else if (mt < 1) { mt = Math.min(1, mt + dt / mDur); cur = lerpMood(from, to, smooth(0, 1, mt)); }
  if (playSeq && typeof SIM !== 'undefined') SIM.vortex = smooth(0.12, 0.85, Math.max(0, playSeq.t / playSeq.dur)); else if (typeof SIM !== 'undefined' && !EX) SIM.vortex = 0;
  if (typeof simUpdate === 'function') simUpdate(dt);
  apply(cur);
  const C = CONCEPTS[active];
  const wind = reduced ? 0 : 1;
  swayers.forEach((o) => { o.rotation.z = o.userData.rz + Math.sin(time * 0.9 + o.userData.ph) * o.userData.amp * wind; o.rotation.x = o.userData.rx + Math.sin(time * 0.7 + o.userData.ph * 1.3) * o.userData.amp * 0.5 * wind; });
  const run = Math.max(0, Math.min(1, 1 - cur.lamps * 1.15));
  C.trusses.forEach((t) => { if (reduced) return; if (typeof SIM !== 'undefined' && SIM.holdDisc && t.o === C.disc) return; const k = t.mach ? run : 1; if (t.spin) t.o.rotation.y += t.spin * dt * k; if (t.slide) { t.ph = (t.ph || 0) + dt * 0.08 * k; t.o.position.x = t.slide[0] + (t.slide[1] - t.slide[0]) * (0.5 - 0.5 * Math.cos(t.ph)); } });
  if (C.machineMist) C.machineMist.forEach((s, i) => { s.material.opacity = run * (0.12 + cur.beam * 0.35) + (typeof SIM !== 'undefined' && SIM.burst ? SIM.burst * 0.5 : 0); s.material.color.copy(cur.mistC); const mph = ((time * 0.3 + i * 0.37) % 1.4) / 1.4; s.position.y = 1.4 + mph * 1.4; s.material.opacity *= Math.sin(Math.PI * mph); });
  const VX = (typeof SIM !== 'undefined' && SIM.vortex) || 0;
  C.mist.forEach((s) => { const b = s.userData.base; s.position.set(b.x + Math.sin(time * 0.12 + s.userData.ph) * 0.6, b.y + Math.sin(time * 0.2 + s.userData.ph) * 0.15, b.z + Math.cos(time * 0.1 + s.userData.ph) * 0.6);
    if (VX > 0) { // fog spins open from the machine outward
      const dx = s.position.x - 0.4, dz = s.position.z - 0.4, r0 = Math.hypot(dx, dz), a0 = Math.atan2(dz, dx); const a = a0 + VX * (2.6 - r0 * 0.12); const r = r0 + VX * VX * 7; s.position.x = 0.4 + Math.cos(a) * r; s.position.z = 0.4 + Math.sin(a) * r; const clear = smooth(r0 / 13 - 0.05, r0 / 13 + 0.25, VX); s.material.opacity *= (1 - clear); } });
  if (C.motes && !reduced) { const a = C.motes.geometry.attributes.position; for (let i = 0; i < C.seeds.length; i++) { const q = C.seeds[i]; a.setXYZ(i, q.x + Math.sin(time * 0.3 + i) * 0.15, q.y + Math.sin(time * 0.21 + i * 1.7) * 0.2, q.z + Math.cos(time * 0.27 + i) * 0.15); } a.needsUpdate = true; }
  if (C.trays) C.trays.forEach((t, i) => { const tgt = i < LIT ? 1 : 0.15; t.cur += (tgt - t.cur) * Math.min(1, dt * 1.6); t.sg.scale.set(0.6 + 0.4 * t.cur, t.cur, 0.6 + 0.4 * t.cur); });
  beamU.uTime.value = time;
  if (!dragging) { yawOff *= Math.pow(0.02, dt); pitchOff *= Math.pow(0.02, dt); }
  placeCam();
  if (typeof polishUpdate === 'function') polishUpdate(dt);
  if (typeof fgDraw === 'function') fgDraw(time);
}
// ---------- lens layer: condensation on foggy nights + soft vignette ----------
const fg = document.getElementById('fg'); const fx = fg.getContext('2d');
let FW = 0, FH = 0;
function fgResize() { const d = Math.min(2, window.devicePixelRatio || 1); FW = host.clientWidth; FH = host.clientHeight; fg.width = FW * d; fg.height = FH * d; fx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', fgResize); fgResize();
const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(Math.min(255, c[0] * k))},${Math.round(Math.min(255, c[1] * k))},${Math.round(Math.min(255, c[2] * k))},${a})`;
function fgDraw(t) {
  fx.clearRect(0, 0, FW, FH);
  const bg = [cur.bg.r * 255, cur.bg.g * 255, cur.bg.b * 255], sc = [cur.sun.r * 255, cur.sun.g * 255, cur.sun.b * 255];
  const base = [24 + bg[0] * 0.1, 34 + bg[1] * 0.1, 22 + bg[2] * 0.08]; const rimA = Math.min(0.55, cur.sunI * 0.28);
  const sw = reduced ? 0 : 1;
  // lens condensation: the camera fogs over at the edges on foggy nights and clears with the sun
  if (cur.mist > 0.01) { const g = fx.createRadialGradient(FW / 2, FH / 2, Math.min(FW, FH) * 0.32, FW / 2, FH / 2, Math.max(FW, FH) * 0.72); const mc = [cur.mistC.r * 255, cur.mistC.g * 255, cur.mistC.b * 255]; g.addColorStop(0, rgb(mc, 1, 0)); g.addColorStop(1, rgb(mc, 1, cur.mist * 0.55)); fx.fillStyle = g; fx.fillRect(0, 0, FW, FH); }
  // soft vignette, like a small fixed lens
  const v = fx.createRadialGradient(FW / 2, FH / 2, Math.min(FW, FH) * 0.45, FW / 2, FH / 2, Math.max(FW, FH) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,10,8,0.32)'); fx.fillStyle = v; fx.fillRect(0, 0, FW, FH);
}

$('fold').addEventListener('click', () => { const c = document.querySelector('.card'); const f = c.classList.toggle('folded'); $('fold').textContent = f ? '展開說明' : '收起說明'; $('fold').setAttribute('aria-expanded', String(!f)); });
document.querySelectorAll('[data-sap]').forEach((b) => b.addEventListener('click', () => setSap(+b.dataset.sap)));
document.querySelectorAll('[data-lit]').forEach((b) => b.addEventListener('click', () => { LIT = +b.dataset.lit; document.querySelectorAll('[data-lit]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
$('mem').addEventListener('change', (e) => setMem(e.target.checked));
setMem(false);
// =====================================================================
// Step 2: traveller, lamps, fog vortex, story events, exits, camera keys
// =====================================================================
const SIM = { on: false, mode: null, t: 0, holdDisc: false, ride: false, rideA: 0, pose: 'idle', walkPhase: 0, fade: 1, camAt: null, camZoom: 1, look: 0 };
let camZoom = 1, camZoomGoal = 1; const camGoal = new T.Vector3();
const MC = V3(0.4, 0, 0.4);                         // machine centre
const toastEl = document.getElementById('toast');
let toastT = 0; function toast(msg, s = 4.5) { toastEl.textContent = msg; toastEl.hidden = false; toastT = s; }
function say(msg) { statusEl.textContent = msg; opts.reportActivity?.(msg); }

// ---- extra scene props for step 2 ----
const SC = CONCEPTS.I.g; const CI = CONCEPTS.I;
// key on the last tick's nail
const keyG = new T.Group(); keyG.position.set(-11.0, 2.78, 6.0); SC.add(keyG);
mesh(new T.TorusGeometry(0.05, 0.012, 4, 10), M.copper, keyG, 0, 0, 0).rotation.y = Math.PI / 2; mesh(new T.BoxGeometry(0.015, 0.15, 0.015), M.copper, keyG, 0, -0.1, 0); mesh(new T.BoxGeometry(0.015, 0.03, 0.05), M.copper, keyG, 0, -0.16, 0.02);
// core: the sealed seed pod under a tall glass bell (same proportions as the collection-room exhibit), locked inside an iron cage
const JAR_P = V3(-7.3, 0.12, 8.0);
const cage = new T.Group(); cage.position.copy(JAR_P); SC.add(cage);
mesh(new T.CylinderGeometry(0.62, 0.66, 0.2, 14), M.woodDark, cage, 0, 0.1, 0);
const jar = new T.Group(); jar.position.y = 0.2; cage.add(jar);
mesh(new T.CylinderGeometry(0.55, 0.55, 0.06, 14), mat(0x7a6a52), jar, 0, 0.03, 0);
const jarGlassM = glassMat.clone(); jarGlassM.opacity = 0.26; jarGlassM.color = new T.Color(0xe6f2ee);
{ const cg = new T.Mesh(new T.CylinderGeometry(0.52, 0.52, 1.0, 20, 1, true), jarGlassM); cg.position.y = 0.55; cg.renderOrder = 3; jar.add(cg); const top = new T.Mesh(new T.SphereGeometry(0.52, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), jarGlassM); top.position.y = 1.05; top.renderOrder = 3; jar.add(top); mesh(new T.SphereGeometry(0.05, 6, 4), M.copper, jar, 0, 1.6, 0); ring(jar, 0, 0.08, 0, 0.53, 0.025, M.copper); }
const pod = mesh(new T.SphereGeometry(0.09, 8, 6), mat(0x8a6a3a), jar, 0.05, 0.16, 0); pod.scale.set(0.8, 1.5, 0.8); mesh(new T.ConeGeometry(0.02, 0.08, 4), M.leafDark, jar, 0.05, 0.32, 0);
const cageBars = new T.Group(); cage.add(cageBars); const cageDoor = new T.Group(); cageDoor.position.set(Math.cos(0.3) * 0.72, 0, Math.sin(0.3) * 0.72); cage.add(cageDoor);
for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; const inDoor = a > 0.3 && a < 1.25; const bar = mesh(new T.BoxGeometry(0.035, 1.75, 0.035), M.ironDark, inDoor ? cageDoor : cageBars, Math.cos(a) * 0.72, 1.0, Math.sin(a) * 0.72); if (inDoor) bar.position.sub(cageDoor.position); }
ring(cageBars, 0, 0.22, 0, 0.72, 0.03, M.ironDark); ring(cageBars, 0, 1.88, 0, 0.72, 0.03, M.ironDark); for (let k = 0; k < 4; k++) { const a = k / 4 * 6.283; const arc = []; for (let q = 0; q <= 8; q++) { const t = q / 8; arc.push(V3(Math.cos(a) * 0.72 * Math.cos(t * 1.57), 1.88 + Math.sin(t * 1.57) * 0.35, Math.sin(a) * 0.72 * Math.cos(t * 1.57))); } tube(arc, 0.02, M.ironDark, cageBars, 10); }
mesh(new T.SphereGeometry(0.06, 6, 4), M.ironDark, cageBars, 0, 2.25, 0);
const padlock = mesh(new T.BoxGeometry(0.1, 0.12, 0.05), M.copper, cage, Math.cos(1.25) * 0.76, 1.0, Math.sin(1.25) * 0.76); padlock.rotation.y = -1.25;
function resetCage() { jar.visible = true; jar.scale.setScalar(1); jar.position.y = 0.2; cageDoor.rotation.y = 0; padlock.visible = true; padlock.position.y = 1.0; }
// blue core presentation (light pillar, two rings, star points) and amber pickup sparks
const coreFx = new T.Group(); SC.add(coreFx); coreFx.visible = false;
const pillarM = new T.MeshBasicMaterial({ color: 0x9cc8e8, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
const pillar = new T.Mesh(new T.CylinderGeometry(0.35, 0.6, 7, 16, 1, true), pillarM); pillar.position.y = 3.5; coreFx.add(pillar);
const ringM = new T.MeshBasicMaterial({ color: 0xbfe0f5, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
const ring1 = new T.Mesh(new T.RingGeometry(0.5, 0.56, 48), ringM); ring1.rotation.x = -Math.PI / 2; coreFx.add(ring1); const ring2 = ring1.clone(); coreFx.add(ring2);
const starM = new T.PointsMaterial({ color: 0xd8ecff, size: 0.09, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
const starG = new T.BufferGeometry(); { const a = []; for (let i = 0; i < 70; i++) a.push(rr(-1.2, 1.2), rr(0, 3.2), rr(-1.2, 1.2)); starG.setAttribute('position', new T.Float32BufferAttribute(a, 3)); } coreFx.add(new T.Points(starG, starM));
const amberFx = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xe0b265, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); amberFx.scale.setScalar(1.4); SC.add(amberFx);
// handprints on the fogged glass, revealed inside a light spot
function handTex() { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); const hand = (cx, cy, a) => { x.fillStyle = `rgba(255,255,255,${a})`; x.beginPath(); x.ellipse(cx, cy + 18, 20, 24, 0, 0, 6.28); x.fill(); [[-16, -14, 0.35], [-6, -26, 0.1], [6, -27, -0.05], [16, -22, -0.2], [26, 2, -0.9]].forEach(([dx, dy, r]) => { x.save(); x.translate(cx + dx, cy + dy); x.rotate(r); x.beginPath(); x.ellipse(0, 0, 5.5, 15, 0, 0, 6.28); x.fill(); x.restore(); }); }; hand(80, 64, 0.55); hand(170, 62, 0.95); return new T.CanvasTexture(c); }
const handM = new T.MeshBasicMaterial({ map: handTex(), transparent: true, opacity: 0, depthWrite: false, color: 0xfff4dc });
const hands = new T.Mesh(new T.PlaneGeometry(1.0, 0.5), handM); hands.position.set(-11.5 + 0.1, 2.45, -1.2); hands.rotation.y = Math.PI / 2; hands.renderOrder = 5; SC.add(hands);
const spot = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xfff0d0, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); spot.position.set(-11.3, 2.45, -1.2); spot.scale.setScalar(1.3); SC.add(spot);
// a sapling for the sixth tray (caretaker branch) + water drips on that tray
const sapling = new T.Group(); sapling.position.set(0.1, 0.17, 0); CI.emptyTray.add(sapling); sapling.visible = false;
{ mesh(new T.CylinderGeometry(0.015, 0.02, 0.4, 5), M.leafDark, sapling, 0, 0.2, 0); for (let i = 0; i < 5; i++) { const l = mesh(new T.ConeGeometry(0.07, 0.22, 3), M.leafLight, sapling, Math.cos(i * 1.3) * 0.06, 0.25 + i * 0.05, Math.sin(i * 1.3) * 0.06); l.rotation.set(1.0, i * 1.3, 0); } mesh(new T.BoxGeometry(0.22, 0.06, 0.18), M.canvasBag, sapling, 0, 0.03, 0); }
const drips = []; for (let i = 0; i < 6; i++) { const d = mesh(new T.SphereGeometry(0.04, 6, 4), M.water, SC, 0, -5, 0); d.castShadow = false; d.userData.ph = i / 6; drips.push(d); }
// ---- caretaker branch ending: the sapling grows a little on each later visit; after two returns it has outgrown the tray,
//      and (after the player chooses it in the lobby) the traveller moves it out to where the old tree's root broke the tiles ----
const TS = V3(-5.0, 0.12, -2.3);                  // the transplant spot, at the tip of one of the old tree's roots
const SAP = { stage: -1 };                         // -1 not planted, 0 just planted, 1 one return, 2 two returns (outgrown), 3 transplanted
const young = new T.Group(); young.visible = false; SC.add(young); const youngTree = new T.Group(); young.add(youngTree);
const youngBall = mesh(new T.SphereGeometry(0.17, 8, 6), M.soil, young, 0, 0.02, 0); youngBall.scale.y = 0.7;
const tsMound = mesh(new T.CylinderGeometry(0.32, 0.48, 0.08, 9), M.soil, SC, TS.x, 0.15, TS.z); tsMound.visible = false; tsMound.castShadow = false;
const newTicks = [];
{ const R0 = R; R = mulberry(77);              // a separate seed so nothing else in the room changes
  const t = tree(youngTree, 0, 0, 5.4, 3.6);     // the same recipe as the old tree, so the leaves read as the same kind
  t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  crackedTiles(SC, TS.x + 0.15, TS.z + 0.1);
  const rp = [V3(-5.45, 0.6, -3.35), V3(-5.25, 0.22, -2.85), V3(-5.15, 0.13, -2.55)]; tube(rp, 0.075, M.bark, SC, 12);
  for (let i = 0; i < 3; i++) { const tk = mesh(new T.BoxGeometry(0.02, 0.025, 0.28), mat(0x2b2620), SC, -11.5 + 0.49, 1.92 + i * 0.32, 6.62); tk.visible = false; tk.castShadow = false; newTicks.push(tk); }
  R = R0; }
SC.updateMatrixWorld(true); FERNS.forEach((f) => { const w = f.getWorldPosition(new T.Vector3()); if (Math.hypot(w.x - TS.x, w.z - TS.z) < 0.9) f.visible = false; });
const YOUNG_S = [0, 0.13, 0.2, 0.28];
function youngS(s) { youngTree.scale.set(s * 0.8, s * 1.25, s * 0.8); }   // slim and tall: the crown stays above head height
function putYoungInTray(s) { CI.emptyTray.add(young); young.position.set(0.05, 0.16, 0); young.rotation.set(0, 0, 0.05); youngS(s); youngBall.visible = false; young.visible = true; }
function putYoungOnGround(s) { SC.add(young); young.position.set(TS.x, 0.1, TS.z); young.rotation.set(0, 0.6, 0); youngS(s); youngBall.visible = false; young.visible = true; }
function setSap(st, ticks = true) { SAP.stage = st; SIM.carry = null; sapling.visible = st === 0; young.visible = false; tsMound.visible = st === 3; newTicks.forEach((t) => { t.visible = st === 3 && ticks; });
  if (st === 0) sapling.scale.setScalar(1); if (st === 1 || st === 2) putYoungInTray(YOUNG_S[st]); if (st === 3) putYoungOnGround(YOUNG_S[3]);
  document.querySelectorAll('[data-sap]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.sap === st))); }
// a little light that travels up the chart under the finger
const chartSpot = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xffe2b0, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); chartSpot.scale.setScalar(0.5); SC.add(chartSpot);
// departure veil
const veil = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 })); veil.scale.setScalar(6); SC.add(veil);

// ---- traveller pose rig ----
const TU = trav.userData;
const staffWorldTilt = new T.Quaternion(), staffTiltEuler = new T.Euler();
function setTravOpacity(o) { trav.traverse((c) => { if (c.isMesh) { if (!c.userData.own) { c.material = c.material.clone(); c.userData.own = 1; } c.material.transparent = o < 0.999; c.material.opacity = o; } }); TU.halo.material.opacity = 0.3 * o; }

// ---- navigation graph ----
const N = {
  H: [2.2, 3.7], A: [-1.0, 5.0], RP: [2.9, 5.6], P: [-3.2, 1.6], P2: [-5.4, -0.3], L2: [-6.4, 4.6], T: [-4.4, 7.95], T1: [-2.8, 7.8], T2: [-6.0, 7.9], B: [-8.8, 6.2], C: [-7.3, 10.9], C1: [-5.6, 10.9], C2: [-9.3, 10.9], K: [-6.1, 8.0], L3: [-0.6, -5.4], WL: [-9.8, -1.6], D: [-9.8, 1.5], Q: [-7.6, 3.5],
  E: [5.7, 1.9], ME: [3.7, -0.2], MSE: [2.8, -2.4], MS: [0.2, -3.2], G: [-1.2, -3.6], G2: [-1.8, -7.8], TR: [4.8, -3.5], PV: [9.3, 1.3], X2: [8.4, 0.5], MT: [3.36, 1.48], SP: [-4.6, -1.75],
  CT: [-0.2, -10.7, 5.0], CR: [4.0, -10.7, 5.0], CRL: [1.8, -10.45, 5.0], CC: [-10.7, -10.7, 5.0], CL: [-10.7, -2.2, 5.0]
};
const NP = (id) => { const n = N[id]; return V3(n[0], n.length > 2 ? n[2] + 0.04 : 0.12, n[1]); };
const EDGES = [['H', 'A'], ['H', 'E'], ['H', 'RP'], ['A', 'RP'], ['A', 'T1'], ['T1', 'T'], ['A', 'P'], ['P', 'L2'], ['L2', 'T2'], ['T2', 'T'], ['T2', 'K'], ['L2', 'B'], ['T', 'C1'], ['C1', 'C'], ['B', 'C2'], ['C2', 'C'], ['P', 'P2'], ['P2', 'WL'], ['WL', 'D'], ['L2', 'D'], ['H', 'Q'], ['Q', 'D'], ['Q', 'L2'], ['H', 'MT'], ['MT', 'ME'], ['E', 'ME'], ['ME', 'MSE'], ['MSE', 'MS'], ['MS', 'G'], ['G', 'P2'], ['ME', 'TR'], ['MSE', 'TR'], ['E', 'PV'], ['E', 'X2'], ['X2', 'PV'], ['G', 'G2'], ['G', 'L3'], ['G2', 'CT'], ['CT', 'CRL'], ['CRL', 'CR'], ['CT', 'CC'], ['CC', 'CL'], ['SP', 'P2']];
// spiral stair polyline (G2 -> CT)
const STAIR = (() => { const { n, da } = SPIRAL, a0 = SPIRAL.a(0), free = a0 - da * 1.6;
  // Enter from the clear east side; the west side is occupied by the planting bed.
  const pts = [SPIRAL.p(-Math.PI / 2, 1.45, 0.12)];
  for (let i = 1; i <= 12; i++) { const a = -Math.PI / 2 + (free + Math.PI / 2) * i / 12; pts.push(SPIRAL.p(a, a > 0 && a < 1.7 ? 1.1 : 1.45, 0.12)); }
  pts.push(SPIRAL.p(free, 0.62, 0.12));
  for (let i = 0; i < n - 1; i++) pts.push(SPIRAL.p(SPIRAL.a(i), 0.62, SPIRAL.h(i) + 0.025));
  const exitX = (SPIRAL.exit[0] + SPIRAL.exit[1]) / 2;
  pts.push(V3(exitX, SPIRAL.cw + 0.04, SPIRAL.sz - 0.62), V3(exitX, SPIRAL.cw + 0.04, -10.45)); return pts; })();
const ADJ = {}; EDGES.forEach(([a, b]) => { (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); });
function edgePts(a, b) { if ((a === 'G2' && b === 'CT')) return [NP('G2'), ...STAIR, NP('CT')]; if (a === 'CT' && b === 'G2') return [NP('CT'), ...STAIR.slice().reverse(), NP('G2')]; return [NP(a), NP(b)]; }
// Expand the saved node route with the same authored geometry used by local walks.
function routePoints(ids) { let pts = [NP(ids[0])]; for (let i = 1; i < ids.length; i++) pts = pts.concat(edgePts(ids[i - 1], ids[i]).slice(1)); return pts; }
function route(a, b) { const dist = { [a]: 0 }, prev = {}, Q = new Set(Object.keys(N)); while (Q.size) { let u = null; Q.forEach((k) => { if (dist[k] !== undefined && (u === null || dist[k] < dist[u])) u = k; }); if (u === null || u === b) break; Q.delete(u); (ADJ[u] || []).forEach((v) => { const d = dist[u] + NP(u).distanceTo(NP(v)) * ((u === 'G2' && v === 'CT') || (u === 'CT' && v === 'G2') ? 1.6 : 1); if (dist[v] === undefined || d < dist[v]) { dist[v] = d; prev[v] = u; } }); } const ids = [b]; while (ids[0] !== a) { if (!prev[ids[0]]) return [NP(a), NP(b)]; ids.unshift(prev[ids[0]]); } let pts = [NP(ids[0])]; for (let i = 1; i < ids.length; i++) pts = pts.concat(edgePts(ids[i - 1], ids[i]).slice(1)); return pts; }
function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += p[i].distanceTo(p[i - 1]); return L; }
function polyAt(p, d) { for (let i = 1; i < p.length; i++) { const s = p[i].distanceTo(p[i - 1]); if (d <= s || i === p.length - 1) { const t = Math.min(1, d / Math.max(1e-4, s)); return { pos: p[i - 1].clone().lerp(p[i], t), dir: p[i].clone().sub(p[i - 1]) }; } d -= s; } return { pos: p[p.length - 1].clone(), dir: V3(0, 0, 1) }; }

// ---- traveller state machine ----
const TRV = { node: 'H', pos: NP('H'), yaw: Math.PI * 0.25, path: null, d: 0, speed: 2.0, onArrive: null, act: null };
function nearestNode() { let best = 'H', bd = 1e9; Object.keys(N).forEach((k) => { const d = NP(k).distanceTo(TRV.pos); if (d < bd) { bd = d; best = k; } }); return best; }
function walkTo(id, then, speed = 2.0) { if(opts.recapNoWalk){TRV.pos.copy(NP(id));TRV.node=id;TRV.path=null;TRV.act=null;then?.();return;} TRV.savedWalk = false; TRV.node = nearestNode(); TRV.path = [TRV.pos.clone(), ...route(TRV.node, id)]; TRV.d = 0; TRV.speed = speed; TRV.target = id; TRV.onArrive = then; TRV.act = null; SIM.ride = false; }
function faceTo(x, z) { const dx = x - TRV.pos.x, dz = z - TRV.pos.z; return Math.atan2(dx, dz); }
function doAct(a) { if(opts.quietFocus&&!lobby){a={...a,cam:null,say:null};} TRV.act = Object.assign({ t: 0 }, a); TRV.path = null; if (a.cam) { camGoal.set(...a.cam.at); camZoomGoal = a.cam.zoom; } if (a.say) say(a.say); if (a.start) a.start(); }
function camHome() { camGoal.copy(CI.target); camZoomGoal = 1; }

// ---- ambient (visual-only) events ----
const AMB = {
  machineWalk: { node: 'MT', say: '旅人沿著育苗機外圈慢慢走了半圈，停下來低頭看苗盤。', dur: 4, pose: 'look', face: () => faceTo(MC.x, MC.z), arc: true },
  wipe: { node: 'WL', say: '玻璃起了霧，旅人用袖子擦出一塊，看看外面。', dur: 5, pose: 'wipe', face: () => faceTo(-11.5, -1.2), end: () => setMemKey('wipe', true) },
  potRight: { node: 'RP', say: '旅人蹲下來，把倒在地上的盆栽慢慢扶正，再把撒出來的土一把一把撥回盆裡。', dur: 7, pose: 'crouch', face: () => faceTo(2.2, 6.4), update: (p) => { const P0 = CI.fallenPot, S0 = CI.spill; if (!P0 || MEM.state.pot) return; const a = smooth(0.08, 0.45, p); P0.rotation.z = 1.45 * (1 - a); P0.position.set(2.2 + 0.2 * a, 0.3 * (1 - a), 6.4 - 0.2 * a); const b = smooth(0.45, 0.95, p); S0.scale.set(1 - 0.92 * b, 1, 1 - 0.92 * b); S0.position.x = 2.9 - 0.5 * b; }, end: () => { setMemKey('pot', true); if (CI.fallenPot) { CI.fallenPot.rotation.z = 1.45; CI.fallenPot.position.set(2.2, 0.3, 6.4); CI.spill.scale.set(1, 1, 1); CI.spill.position.x = 2.9; } } },
  pool: { node: 'P', say: '旅人蹲在積水池邊，看浮葉慢慢轉。', dur: 5, pose: 'crouch', face: () => faceTo(-5.4, 1.6) },
  lean: { node: 'CRL', say: '旅人在空中走道上靠著欄杆，往下看整座苗圃。', dur: 6, pose: 'look', face: () => faceTo(1.8, 0) },
  valve: { node: 'PV', say: '旅人轉了一下幫浦的閥門，灑水臂噴出一陣水霧。', dur: 5, pose: 'turn', face: () => faceTo(10.3, 0.8), update: (p) => { SIM.burst = Math.sin(Math.PI * p); } },
  trough: { node: 'TR', say: '旅人用手指撥了一下育苗水槽的水。', dur: 4.5, pose: 'crouch', face: () => faceTo(4.8, -4.6) },
  tree: { node: 'G', say: '旅人停下來，抬頭看伸進玻璃裡的那棵大樹。', dur: 5, pose: 'up', face: () => faceTo(-5.8, -5.8) }
};
function runAmbient(id, then) { const e = AMB[id];
  if (!e) { doAct({dur:1,pose:'idle',end:then}); return; }
  walkTo(e.node, () => {
    if (e.arc) { // walk half a circle around the machine (an ordinary walk with steps), then stop and look at the trays
      const a0 = Math.atan2(TRV.pos.z - MC.z, TRV.pos.x - MC.x); const pts = []; for (let i = 0; i <= 24; i++) { const a = a0 - i / 24 * 2.2; pts.push(V3(MC.x + Math.cos(a) * 3.15, 0.12, MC.z + Math.sin(a) * 3.15)); }
      pts[0]=TRV.pos.clone();
      TRV.path = pts; TRV.d = 0; TRV.speed = 1.2; TRV.target = e.node; TRV.onArrive = () => { TRV.yaw = faceTo(MC.x, MC.z); doAct({ dur: e.dur, pose: e.pose, say: e.say, end: () => {
        // Return along the same rim to the saved event anchor before the next walk.
        TRV.path=pts.slice().reverse();TRV.d=0;TRV.speed=1.2;TRV.target=e.node;TRV.onArrive=then;
      } }); }; say(e.say); return; }
    TRV.yaw = e.face(); doAct({ audioKey: id, dur: e.dur, pose: e.pose, say: e.say, update: e.update, end: () => { if (e.end) e.end(); if (then) then(); } }); }); }

// ---- lamps ----
const LAMP_NODE = ['A', 'E', 'L2', 'L3', 'D'], LAMP_POS = [[-0.6, 6.2], [6.6, 2.7], [-5.4, 5.6], [0.3, -6.2], [-9.0, 0.4]];
const flare = [0, 0, 0, 0, 0];
function lightLamp(k, then) { walkTo(LAMP_NODE[k], () => { TRV.yaw = faceTo(...LAMP_POS[k]); doAct({ dur: 2.2, pose: 'light', say: `旅人用提燈的火點亮了第 ${k + 1} 盞燈。`, update: (p) => { if (p > 0.5 && LIT < k + 1) { LIT = k + 1; flare[k] = 1.6; } }, end: then }); }); }

// ---- rest: sit on the machine's rim and ride the turning disc ----
let SEAT_LOCAL = Math.PI / 6;   // between tray 0 and tray 1 in the disc's own frame, so no tray ever passes through him
function seatPos() { const a = SEAT_LOCAL - (CI.disc ? CI.disc.rotation.y : 0); return { a, p: V3(MC.x + Math.cos(a) * 2.12, 0.42, MC.z + Math.sin(a) * 2.12) }; }
const SEAT_A = Math.PI * 0.25, SEAT = V3(MC.x + Math.cos(SEAT_A) * 2.12, 0.42, MC.z + Math.sin(SEAT_A) * 2.12);
const BOARD_A = Math.atan2(3.7 - MC.z, 2.2 - MC.x), BOARD = V3(MC.x + Math.cos(BOARD_A) * 2.95, 0.12, MC.z + Math.sin(BOARD_A) * 2.95);
function rest() { walkTo('H', () => { TRV.path = [TRV.pos.clone(), BOARD.clone()]; TRV.d = 0; TRV.speed = 1.0; TRV.onArrive = () => { TRV.yaw = faceTo(MC.x, MC.z); SIM.seatWait = true; TRV.act = { t: 0, dur: 1e9, pose: 'idle' }; say('五盞燈都點亮了。旅人走到育苗機旁，跨上轉盤坐下。'); }; }); }

// ---- story events ----
const STORY = {
  first: () => { camHome(); walkTo('MT', () => { TRV.yaw = faceTo(MC.x, MC.z); SIM.holdDisc = true; doAct({ audioKey: 'first', dur: 14, pose: 'crouch', cam: { at: [2.7, 0.8, 1.1], zoom: 3.0 }, say: '灑水臂停在一盤什麼都沒種的土上面，照樣澆了一圈水。', update: (p) => { SIM.discGoal = -1.396; SIM.dripOn = p > 0.3 && p < 0.85; }, end: () => { SIM.holdDisc = false; SIM.dripOn = false; toast('新線索：機器每一圈都還在澆一盤什麼都沒種的土。'); camHome(); } }); }); },
  chart: () => { camHome(); walkTo('B', () => { TRV.yaw = faceTo(-11.5, 6.2); doAct({ audioKey: 'chart', dur: 12, pose: 'trace', cam: { at: [-10.6, 2.2, 6.0], zoom: 2.6 }, say: '牆上的生長記錄，刻度越畫越密，到某一天突然停了。', update: (p) => { const k = Math.min(1, p / 0.8); chartSpot.position.set(-10.98, 1.55 + Math.pow(k, 0.6) * 1.2, 6.0); chartSpot.material.opacity = Math.sin(Math.PI * Math.min(1, p / 0.95)) * 0.9; }, end: () => { chartSpot.material.opacity = 0; toast('新線索：刻度越畫越密，然後停了。旁邊寫著：不要為了趕上日期，讓它長得太快。', 6); camHome(); } }); }); },
  core: () => { camHome(); keyG.visible = true; resetCage(); walkTo('B', () => { TRV.yaw = faceTo(-11.5, 6.0); doAct({ audioKey: 'key', dur: 3, pose: 'reach', cam: { at: [-10.6, 2.4, 6.0], zoom: 2.4 }, say: '最後一條刻度的釘子上掛著一把小鑰匙。', update: (p) => { if (p > 0.6) keyG.visible = false; }, end: () => { camGoal.set(-7.0, 1.2, 8.0); camZoomGoal = 1.9; walkTo('K', () => { TRV.yaw = faceTo(JAR_P.x, JAR_P.z); doAct({ audioKey: 'core', dur: 11, pose: 'reach', cam: { at: [-7.1, 1.1, 8.0], zoom: 2.5 }, say: '鑰匙打開了鐵籠的鎖，玻璃鐘罩裡封著一顆種莢。', start: () => { coreFx.position.set(JAR_P.x, 0.12, JAR_P.z); coreFx.visible = true; }, update: (p) => {
      if (p > 0.08) { padlock.position.y = Math.max(0.24, 1.0 - (p - 0.08) * 9); }
      cageDoor.rotation.y = -1.7 * smooth(0.14, 0.32, p);
      const b = Math.sin(Math.PI * Math.min(1, Math.max(0, (p - 0.25) / 0.75))); pillarM.opacity = 0; ringM.opacity = 0.8 * b; starM.opacity = b; const r = (p * 3) % 1; ring1.scale.setScalar(1 + r * 2.5); ring1.position.y = 0.1 + r * 1.5; ring2.scale.setScalar(1 + ((r + 0.5) % 1) * 2.5); ring2.position.y = 0.1 + ((r + 0.5) % 1) * 1.5; coreFx.rotation.y += 0.01;
      jarGlassM.emissive = jarGlassM.emissive || new T.Color(); jarGlassM.emissive.setHex(0x9cc8e8); jarGlassM.emissiveIntensity = 0.6 * b;
      if (p > 0.62) { const q = smooth(0.62, 0.95, p); jar.position.y = 0.2 + q * 0.6; jar.scale.setScalar(1 - q * 0.98); }
      if (p > 0.6 && p < 0.61) say('鐘罩連同種莢，被收進了旅人的行李。'); },
    end: () => { coreFx.visible = false; jar.visible = false; toast('取得地圖核心：封存種莢。'); camHome(); } }); }, 2.0); } }); }); },
  shard: () => { camHome(); setMood('night', false); walkTo('WL', () => { TRV.yaw = faceTo(-11.5, -1.2); doAct({ dur: 11, pose: 'reach', cam: { at: [-11.0, 2.2, -1.0], zoom: 2.6 }, say: '旅人用背銀鏡片把光反照到起霧的玻璃上。', update: (p) => { const b = Math.sin(Math.PI * Math.min(1, p / 0.95)); spot.material.opacity = 0.7 * b; spot.position.z = -1.6 + p * 0.8; handM.opacity = Math.max(0, b - 0.25) * 1.2; if (p > 0.45 && p < 0.46) say('光斑裡浮出兩個一樣大的手印。'); }, end: () => { spot.material.opacity = 0; handM.opacity = 0; toast('新線索：起霧的玻璃上有兩個一樣大的手印，一個很舊，一個比較新。', 6); camHome(); } }); }); },
  plant: () => { camHome(); setSap(-1); walkTo('MT', () => { TRV.yaw = faceTo(MC.x, MC.z); SIM.holdDisc = true; doAct({ audioKey: 'plant', dur: 12, pose: 'crouch', cam: { at: [2.7, 0.8, 1.1], zoom: 3.0 }, say: '旅人把從驛站帶來的幼苗，種進育苗機那一格空盤。', update: (p) => { SIM.discGoal = -1.396; if (p > 0.35) { sapling.visible = true; const s = Math.min(1, (p - 0.35) / 0.3); sapling.scale.setScalar(0.3 + 0.7 * s); } SIM.dripOn = p > 0.7; }, end: () => { SIM.holdDisc = false; SIM.dripOn = false; setSap(0); toast('灑水臂澆的，從此是這株苗。'); camHome(); } }); }); },
  transplant: () => { camHome(); setSap(2); walkTo('MT', () => { TRV.yaw = faceTo(MC.x, MC.z); SIM.holdDisc = true;
    doAct({ audioKey: 'dig', dur: 6.5, pose: 'crouch', cam: { at: [2.6, 0.9, 1.0], zoom: 2.7 }, say: '苗盤已經裝不下它了。旅人蹲下來，連土把它從第六盤挖起來。',
      update: (p) => { SIM.discGoal = -1.396; if (p > 0.25 && p < 0.6) young.position.y = 0.16 + Math.sin((p - 0.25) / 0.35 * Math.PI) * 0.03; if (p > 0.6 && !SIM.carry) { const w = young.getWorldPosition(new T.Vector3()); SC.add(young); young.position.copy(w); youngBall.visible = true; SIM.carry = { obj: young, t: 0, from: w.clone() }; } },
      end: () => { SIM.holdDisc = false; camGoal.set(-2.4, 0.9, -0.6); camZoomGoal = 1.6; say('旅人抱著它，繞過育苗機，走向老樹的根頂破地磚的地方。');
        walkTo('SP', () => { TRV.yaw = faceTo(TS.x, TS.z);
          doAct({ audioKey: 'transplant', dur: 8, pose: 'crouch', cam: { at: [-4.7, 0.8, -1.9], zoom: 2.7 }, say: '旅人把它種在老樹的根頂破地磚的地方，把土壓實。',
            start: () => { SIM.carryFrom = young.position.clone(); SIM.carry = null; },
            update: (p) => { const a = smooth(0.05, 0.4, p); young.position.copy(SIM.carryFrom).lerp(V3(TS.x, 0.1, TS.z), a); young.rotation.set(0, 0.6 * a, 0); youngS(YOUNG_S[2] + (YOUNG_S[3] - YOUNG_S[2]) * a); youngBall.visible = a < 0.95;
              tsMound.visible = p > 0.35; const m = smooth(0.35, 0.9, p); tsMound.scale.set(0.3 + 0.7 * m, 0.3 + 0.7 * m, 0.3 + 0.7 * m); },
            end: () => { SAP.stage = 3; tsMound.scale.setScalar(1); camGoal.set(-9.8, 1.6, 5.4); camZoomGoal = 1.7; say('旅人走到牆邊的生長記錄板前。');
              walkTo('B', () => { TRV.yaw = faceTo(-11.5, 6.62);
                doAct({ audioKey: 'marks', dur: 8, pose: 'trace', cam: { at: [-10.95, 2.2, 6.35], zoom: 4.2 }, say: '旅人在停掉的刻度旁邊，畫下新的刻度。間隔畫得很寬。',
                  update: (p) => { newTicks.forEach((t, i) => { t.visible = p > 0.2 + i * 0.22; }); const k = Math.min(2, Math.floor(Math.max(0, p - 0.12) / 0.22)); chartSpot.position.set(-11.0, 1.92 + k * 0.32 + Math.min(1, ((p - 0.12) % 0.22) / 0.22) * 0.05, 6.62); chartSpot.material.opacity = Math.sin(Math.PI * Math.min(1, p / 0.92)) * 0.8; },
                  end: () => { chartSpot.material.opacity = 0; newTicks.forEach((t) => { t.visible = true; }); SIM.holdDisc = true;
                    doAct({ audioKey: 'empty', dur: 6, pose: 'idle', cam: { at: [2.4, 0.9, 1.0], zoom: 2.4 }, say: '第六盤又空了。機器照樣澆它。',
                      update: (p) => { SIM.discGoal = -1.396; SIM.dripOn = p > 0.2; },
                      end: () => { SIM.holdDisc = false; SIM.dripOn = false; toast('照料者支線結局：苗圃裡有了第二棵樹。', 6); camHome(); } }); } }); }); } }); }); } }); }); },
  leaf: () => { camHome(); walkTo('T', () => { TRV.yaw = faceTo(-4.4, 6.8); doAct({ audioKey: 'leaf', dur: 4, pose: 'read', cam: { at: [-4.4, 1.2, 6.9], zoom: 2.0 }, say: '標本桌上的書裡，夾著一片壓平的葉子。', update: (p) => { amberFx.position.set(-4.0, 1.1 + p * 0.8, 6.8); amberFx.material.opacity = Math.sin(Math.PI * p); }, end: () => { amberFx.material.opacity = 0; toast('取得旅程信物：壓葉標本。'); camHome(); } }); }); },
  mulch: () => { camHome(); walkTo('B', () => { TRV.yaw = faceTo(-9.8, 7.3); doAct({ audioKey: 'mulch', dur: 4, pose: 'reach', cam: { at: [-9.4, 1.2, 7.2], zoom: 2.0 }, say: '工作台上有一塊摺好的麻布，旅人拿起來拍掉土。', update: (p) => { amberFx.position.set(-9.6, 1.1 + p * 0.8, 7.3); amberFx.material.opacity = Math.sin(Math.PI * p); }, end: () => { amberFx.material.opacity = 0; toast('取得旅程信物：護根布。'); camHome(); } }); }); }
};

// ---- departures (max 5 s): short walk, fog veil, then the exit's own last seconds ----
function depart(exit) {
  doorPlayed=false; stopSim(); TRV.act = null; SIM.ride = false; SIM.seatWait = false; SIM.board = null; TRV.path = null;
  const tail = exit === 'corridor' ? CORR : CELL, via = exit === 'corridor' ? 'D' : 'X2';
  TRV.node = NP('H').distanceTo(TRV.pos) < 3.2 && exit === 'corridor' ? 'H' : nearestNode(); const path = [TRV.pos.clone(), ...route(TRV.node, via), ...tail];
  const L = polyLen(path); SIM.dep = { exit, t: 0, path, L, speed: Math.min(2.6, Math.max(1.1, L / 6.0)) };
  if (exit === 'corridor') { camGoal.set(-6.5, 1.2, 2.2); camZoomGoal = 1.35; } else { camGoal.set(6.8, 0.4, 0.4); camZoomGoal = 1.6; }
  say(exit === 'corridor' ? '旅人從育苗機邊起身，背好行囊，往玻璃連廊走去。' : '旅人從育苗機邊起身，背好行囊，走向地窖口。');
}
const CORR = [V3(-11.6, 0.12, 1.5), V3(-14.8, 0.12, 1.5)];
const CELL = [V3(8.4, 0.12, -0.7), V3(8.4, -0.9, -1.5), V3(8.4, -2.2, -2.3)];

// ---- exploration demo: 5 lamp segments, each = one full day/night (600 s effective), shown at 30x ----
const SEG_DEMO = 20; let EX = null;
const MOOD_DUSK = { bg: 0xc9a78a, fog: 0xb99a82, near: 0, far: 50, sun: 0xffb070, sunI: 0.7, dir: V3(0.75, 0.35, -0.35), hs: 0xd9b89a, hg: 0x3d3530, hI: 0.45, glass: 0xe3d2c0, gO: 0.3, mist: 0.04, mistC: 0xe8d0b8, beam: 0, lamps: 0.3, look: 0, edge: 0.4 };
const nightLight = Object.assign({}, MOODS.night, { mist: 0.12, gO: 0.4 }); const dawnClear = Object.assign({}, MOODS.dawn, { beam: 0, mist: 0.04, gO: 0.26 });
const FOG_ROLL = Array.from({length:100},(_,i)=>nurseryFog(opts.nursery?.seed || opts.seed || 1,i*600));
function moodAt(sim) { const cyc = Math.floor(sim / SEG_DEMO), ph = (sim % SEG_DEMO) / SEG_DEMO, pos = ph * 4, i = Math.floor(pos), f = pos - i, sm = f * f * f * (f * (f * 6 - 15) + 10);
  audioPeriod = i === 2 ? 'dusk' : i === 3 ? 'night' : 'day';
  const heavyPrev = cyc > 0 && FOG_ROLL[(cyc - 1) % 5], heavy = FOG_ROLL[cyc % 5];
  const dawnP = heavyPrev ? MOODS.dawn : dawnClear, nightP = heavy ? MOODS.night : nightLight;
  const seq = [dawnP, MOODS.day, MOOD_DUSK, nightP, dawnClear]; const nextDawn = FOG_ROLL[cyc % 5] ? MOODS.dawn : dawnClear; seq[4] = nextDawn;
  const m = lerpMood(seq[i], seq[i + 1], sm); SIM.vortex = (i === 0 && heavyPrev) ? Math.min(1, ph * 4 / 0.8) : (i === 3 && f > 0.98 && heavy ? 0 : 0); if (!(i === 0 && heavyPrev)) SIM.vortex = 0; return m; }
const AMB_ORDER = [['potRight', 'pool'], ['machineWalk', 'trough'], ['tree'], ['valve', 'trough'], ['wipe', 'pool']];
function startExplore() { stopSim(); SIM.on = true; LIT = 0; setMemKey('pot', false); setMemKey('wipe', false); TRV.node = 'D'; TRV.pos.copy(NP('D')); EX = { sim: 0, seg: -1 }; say('旅人推開鐵門，走進苗圃。'); nextSeg(); }
function segDue() { return (EX.seg + 1) * SEG_DEMO; }
function est(fromId, ambId, lampId) { const e = AMB[ambId]; return polyLen(route(fromId, e.node)) / 2.0 + e.dur + polyLen(route(e.node, lampId)) / 2.0 + 0.6; }
function nextSeg() { EX.seg++; EX.lit = false; if (EX.seg >= 5) { rest(); return; } EX.queue = AMB_ORDER[EX.seg].slice(); stepSeg(); }
function stepSeg() { const lampId = LAMP_NODE[EX.seg]; const nxt = EX.queue[0]; const here = nearestNode();
  if (nxt && EX.sim + est(here, nxt, lampId) < segDue() - 1.0) { EX.queue.shift(); runAmbient(nxt, stepSeg); return; }
  walkTo(lampId, () => { TRV.yaw = faceTo(...LAMP_POS[EX.seg]); if (EX.lit) { doAct({ dur: 1.2, pose: 'light', end: nextSeg }); } else doAct({ dur: 1e9, pose: 'idle', wait: true }); }); }
function stopSim() { SIM.on = false; EX = null; SIM.holdDisc = false; SIM.dripOn = false; SIM.vortex = 0; }


// ---- traveller animation: walk cycle (legs, arms, staff), idle breathing and glances, event poses ----
const POSES = {
  idle: {}, look: { lean: 0.3, headX: 0.4, armL: -0.5 }, up: { headX: -0.32 },
  reach: { armL: -1.7, headX: -0.1 }, crouch: { hip: -0.2, legX: -0.9, lean: 0.45, headX: 0.35, armL: -0.8 },
  sit: { hip: -0.28, legX: -1.45, armL: -0.3, staffX: 0.2, staffZ: -0.6 }, sitEdge: { hip: -0.28, legX: -1.3, armL: -0.2, staffX: 0.2, staffZ: -0.6 }, sitGaze: { hip: -0.28, legX: -1.3, armL: -0.3, headX: -0.3, staffX: 0.2, staffZ: -0.6 },
  write: { hip: -0.28, legX: -1.45, headX: 0.5, armL: -0.9, book: 1, staffX: 0.2, staffZ: -0.6 }, shoulder: {},
  wipe: { armL: -1.5, headX: 0.05 }, turn: { lean: 0.22, headX: 0.45, armL: -1.1 }, trace: { armL: -1.7, headX: -0.1 }, light: { armL: -0.4, headX: -0.1 }, carry: { armL: -1.05, armLz: 0.25, headX: 0.12 }, read: { armL: -1.05, headX: 0.5, lean: 0.08, book: 1 }
};
const PK = ['hip', 'legX', 'lean', 'headX', 'armL', 'armLz', 'armR', 'book', 'staffX', 'staffZ'];
const PZ = {}; PK.forEach((k) => { PZ[k] = 0; });
let walkPh = 0, glance = 0, glanceGoal = 0, glanceT = 2;
function animateTraveller(dt, pose, moving, prog) {
  // same liveliness as 倒影湖畔: legs swing and the body bobs while walking; everything else comes from the pose targets
  let key = pose;
  if (pose === 'sitRest') { const c = (time % 36) / 36; key = c < 0.4 ? 'sitEdge' : c < 0.75 ? 'write' : 'sitGaze'; }
  const g = POSES[key] || {}; const k = Math.min(1, dt * 4);
  PK.forEach((kk) => { PZ[kk] += ((g[kk] || 0) - PZ[kk]) * k; });
  if (moving) { const before=Math.floor(walkPh/Math.PI); walkPh += dt * 9 * 1.05; if(Math.floor(walkPh/Math.PI)!==before&&!SIM.board) { const ladder=SIM.dep?.exit==='cellar'&&TRV.pos.y<.1; const airborne=TRV.pos.y>1&&!SIM.dep; if(!airborne&&!ladder) sound('stone_step_dry',.3); } }
  const swing = moving ? Math.sin(walkPh) * 0.55 : 0, bob = moving ? Math.abs(Math.sin(walkPh)) * 0.035 : 0;
  const dangle = key === 'sitEdge' || key === 'sitGaze';
  TU.body.position.y = PZ.hip + bob; TU.upper.rotation.set(PZ.lean, 0, 0); TU.upper.scale.y = 1;
  TU.legL.rotation.x = PZ.legX + swing + (dangle ? Math.sin(time * 1.6) * 0.15 : 0); TU.legR.rotation.x = PZ.legX - swing + (dangle ? Math.sin(time * 1.6 + 1.3) * 0.15 : 0);
  TU.head.rotation.set(PZ.headX, 0, 0);
  TU.armL.rotation.set(PZ.armL, 0, -0.12 + PZ.armLz); TU.armR.rotation.set(-0.35 + PZ.armR, 0, 0.7);
  // Keep the grip at the palm while the authored lean stays independent of the carrying arm.
  staffWorldTilt.setFromEuler(staffTiltEuler.set((-0.35 + PZ.armR) * 0.15 + PZ.staffX, 0, PZ.staffZ));
  TU.staff.quaternion.copy(TU.armR.quaternion).invert().multiply(staffWorldTilt);
  TU.book.visible = PZ.book > 0.5; if(lastBook&&!TU.book.visible)sound('dep_notebook_close',.5,false,.45);lastBook=TU.book.visible;
}

// ---- per-frame update (called from tick) ----
function simUpdate(dt) {
  if (EX) { EX.sim += dt; cur = moodAt(EX.sim);
    if (EX.seg < 5 && !EX.lit && EX.sim >= segDue()) { const k = EX.seg; EX.lit = true; LIT = k + 1; flare[k] = 1.6; say(`第 ${k + 1} 盞燈亮了（燈跟著專注時間亮），育苗機上又有一盤苗長大。`);
      if (TRV.act && TRV.act.wait) { TRV.act = null; doAct({ dur: 1.6, pose: 'light', end: nextSeg }); } } }
  if (SIM.litShown !== LIT) { SIM.litShown = LIT; document.querySelectorAll('[data-lit]').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.lit === LIT))); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.hidden = true; }
  for (let k = 0; k < 5; k++) flare[k] = Math.max(0, flare[k] - dt * 0.9);
  // traveller
  let pose = 'idle', moving = false;
  if (SIM.dep) {
    // DEPARTURE (8 s, one continuous walk): 0-0.9 stand up and shoulder the pack, then walk the whole way, fade only at the very end
    const D = SIM.dep; const oldY=TRV.pos.y; const before=D.t; D.t += dt; if(before<=.05&&D.t>.05) sound('dep_cloth_rise',.7); if(before<=.9&&D.t>.9) sound('nursery_disc_step',.3); const t = D.t;
    if (t < 0.9) { pose = t < 0.5 ? 'sit' : 'shoulder'; if (t < 0.5 && D.path) TRV.pos.y = Math.max(0.12, TRV.pos.y); }
    else { const dist = Math.min(D.L, (t - 0.9) * D.speed * Math.min(1, (t - 0.9) / 0.6)); const q = polyAt(D.path, dist); TRV.pos.copy(q.pos); if (Math.hypot(q.dir.x, q.dir.z) > 0.02) TRV.yaw = Math.atan2(q.dir.x, q.dir.z); moving = dist < D.L; if(D.exit==='corridor'&&TRV.pos.x<-10.7&&!doorPlayed){doorPlayed=true;D.doorT=0;sound('nursery_door_iron',1.8);} SIM.speedNow = moving ? D.speed : 0;
      const fs = D.exit === 'corridor' ? 6.8 : 6.4; SIM.fade = 1 - Math.max(0, Math.min(1, (t - fs) / (8 - fs))); }
    if(D.exit==='cellar'){for(const y of [-.3,-.8,-1.3,-1.8])if(oldY>=y&&TRV.pos.y<y)sound('nursery_ladder_step',.35);}
    if(D.doorT!==undefined&&CI.exitDoor){D.doorT+=dt;CI.exitDoor.rotation.y=.9+.45*smooth(0,1.8,D.doorT);}
    veil.material.opacity = 0;
    if (t > 8.1) { SIM.dep = null; camHome(); say(D.exit === 'corridor' ? '旅人走進玻璃連廊，身影慢慢沒進霧裡。下一次專注會從新的地方開始。' : '旅人走下地窖，提燈的光一階一階變小。下一次專注會從新的地方開始。'); }
  } else if (TRV.path) {
    const L = polyLen(TRV.path); const ease = TRV.savedWalk ? 1 : Math.max(0.35, Math.min(1, (TRV.d + 0.15) / 0.7, (L - TRV.d + 0.1) / 0.6)); TRV.d += TRV.speed * ease * dt; SIM.speedNow = TRV.speed * ease; const q = polyAt(TRV.path, Math.min(TRV.d, L)); TRV.pos.copy(q.pos); if (q.dir.lengthSq() > 1e-6 && Math.hypot(q.dir.x, q.dir.z) > 0.02) TRV.yaw = Math.atan2(q.dir.x, q.dir.z); moving = true; SIM.fade = 1;
    if (TRV.d >= L) { TRV.node = TRV.target; TRV.path = null; const f = TRV.onArrive; TRV.onArrive = null; if (f) f(); }
  } else if (TRV.act) {
    const a = TRV.act; const before=a.t; a.t += dt; for(const cue of crossedNurseryCues(a.audioKey,before,a.t,a.dur)) sound(cue.name,cue.music?undefined:(cue.end-cue.at)*a.dur,cue.music); const p = Math.min(1, a.t / a.dur); pose = a.pose || 'idle'; if (a.update) a.update(p); if (a.t >= a.dur) { TRV.act = null; if (a.end) a.end(); }
  }
  if (SIM.seatWait && CI.disc) { // take the gap between two trays that is nearest to him (gaps sit at 30 + 60k degrees in the disc frame)
    const loc = BOARD_A + CI.disc.rotation.y; SEAT_LOCAL = Math.PI / 6 + Math.round((loc - Math.PI / 6) / (Math.PI / 3)) * (Math.PI / 3); SIM.seatWait = false; SIM.board = { t: 0, from: TRV.pos.clone() }; }
  if (SIM.board && CI.disc) { // step up onto the turning disc and sit down (1.1 s), the seat keeps moving under him
    const B = SIM.board; const before=B.t; B.t += dt; if(before<=.55&&B.t>.55) sound('nursery_disc_step',.35); const k = Math.min(1, B.t / 1.1); const sp = seatPos(); TRV.pos.copy(B.from).lerp(sp.p, k * k * (3 - 2 * k)); TRV.pos.y = 0.12 + (sp.p.y - 0.12) * Math.min(1, k * 1.6) + Math.sin(Math.PI * k) * 0.08; TRV.yaw = k < 0.5 ? faceTo(MC.x, MC.z) : Math.atan2(Math.cos(sp.a), Math.sin(sp.a)); pose = k < 0.55 ? 'idle' : 'sitEdge'; moving = k < 0.55;
    if (k >= 1) { SIM.board = null; SIM.ride = true; TRV.act = { t: 0, dur: 1e9, pose: 'sitRest' }; say('旅人坐在育苗機的轉盤邊，跟著它慢慢轉。'); } }
  if (SIM.ride && CI.disc) { const sp = seatPos(); TRV.pos.copy(sp.p); TRV.yaw = Math.atan2(Math.cos(sp.a), Math.sin(sp.a)); pose = 'sitRest'; }
  if (SIM.carry) { const C0 = SIM.carry; C0.t += dt; const fw = V3(Math.sin(TRV.yaw), 0, Math.cos(TRV.yaw)); const goal = TRV.pos.clone().addScaledVector(fw, 0.4); goal.y = TRV.pos.y + 0.55; C0.obj.position.lerp(goal, Math.min(1, C0.t < 0.8 ? dt * 3 : 1)); C0.obj.rotation.set(0, TRV.yaw, 0); if (pose === 'idle') pose = 'carry'; }
  // apply pose
  trav.position.copy(TRV.pos); let dy = trav.rotation.y; let d = TRV.yaw - dy; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; trav.rotation.y = dy + d * Math.min(1, dt * 8);
  animateTraveller(dt, pose, moving, TRV.act ? Math.min(1, TRV.act.t / TRV.act.dur) : 0);
  setTravOpacity(Math.max(0, Math.min(1, SIM.fade)));
  // machine: hold the disc for the tray events, drips on the empty tray
  if (SIM.holdDisc && CI.disc && SIM.discGoal !== undefined) { let r = CI.disc.rotation.y, g = SIM.discGoal; while (g - r > Math.PI) g -= Math.PI * 2; while (g - r < -Math.PI) g += Math.PI * 2; CI.disc.rotation.y += (g - r) * Math.min(1, dt * 1.2); }
  drips.forEach((dp) => { if (!SIM.dripOn) { dp.position.y = -5; return; } const w = CI.emptyTray.getWorldPosition(new T.Vector3()); const k = (time * 1.4 + dp.userData.ph) % 1; dp.position.set(w.x + Math.sin(dp.userData.ph * 9) * 0.2, 3.0 - k * 2.6, w.z + Math.cos(dp.userData.ph * 9) * 0.15); });
  // camera follows the event keys with a soft spring

  target.lerp(camGoal, Math.min(1, dt * 1.8)); camZoom += (camZoomGoal - camZoom) * Math.min(1, dt * 1.8);
}
function setMemKey(key, on) { MEM.state[key] = on; MEM.list.forEach((o) => { if (o.userData.memKey === key) o.visible = o.userData.mem ? on : !on; }); }

// ---- UI for step 2 ----
document.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.sim; SIM.dep = null; veil.material.opacity = 0; SIM.fade = 1; camHome(); if (k !== 'corridor' && k !== 'cellar') { SIM.ride = false; SIM.seatWait = false; SIM.board = null; }
  if (k === 'explore') { startExplore(); return; }
  stopSim();
  if (k === 'rest') { LIT = 5; rest(); return; }
  if (k === 'corridor' || k === 'cellar') { // departures start from wherever the disc has carried him
    const sp = seatPos(); TRV.pos.copy(sp.p); TRV.yaw = Math.atan2(Math.cos(sp.a), Math.sin(sp.a)); trav.rotation.y = TRV.yaw; depart(k); return; }
  if (STORY[k]) { if (k !== 'shard') setMood('day', false); STORY[k](); }
}));
camGoal.copy(CI.target);


// =====================================================================
// Polish pass: soft shadows from the big structure only, tinted light through dirty glass,
// flowing night fog, misty moonbeams, ferns that part around the traveller
// =====================================================================
(function shadowCasters() { const bb = new T.Box3(), sz = new T.Vector3(), lb = new T.Vector3(); scene.updateMatrixWorld(true);
  // 2026-10-15 light-density pass. two fixes:
  // 1) Judge thin iron by its cross-section, not its bounding box: a curved roof rib or a long purlin has a huge box but is ~0.1 thick.
  //    Thin limbs of the tree, the hundreds of small leaf cones and hanging vines are dropped too; trunk, big branches, palms, canopy,
  //    The 0.14 iron frame (posts and beams), trunk, big branches, palms, canopy, catwalk decks and the machine still cast.
  // 2) three r128 VSMShadowMap also draws every receiveShadow mesh into the shadow map (WebGLShadowMap: castShadow || (receiveShadow && VSM)).
  //    So castShadow = false alone never removed these lines. A thin caster we drop must also stop receiving.
  const skip = new Set(); trav.traverse((o) => skip.add(o));   // the traveller is left exactly as it was
  scene.traverse((o) => { if (!o.isMesh || !o.castShadow || skip.has(o)) return; bb.setFromObject(o); bb.getSize(sz); const d = [sz.x, sz.y, sz.z].sort((a, b) => a - b);
    const gp = o.geometry.parameters || {}, gt = o.geometry.type; let thin = d[1] < 0.1;
    if (gt === 'TubeGeometry' && gp.radius < 0.13) thin = true;
    if (gt === 'ConeGeometry' && gp.radius < 0.12) thin = true;
    if ((gt === 'BoxGeometry' || gt === 'CylinderGeometry') && o.material !== M.bark) { o.geometry.computeBoundingBox(); o.geometry.boundingBox.getSize(lb).multiply(o.scale); const ld = [lb.x, lb.y, lb.z].sort((a, b) => a - b); if (ld[1] < 0.12) thin = true; }   // the 0.14 iron frame (wall posts and beams) keeps its shadow — user 2026-10-15
    if (thin || d[2] < 0.35) o.castShadow = false;
    if (thin && bb.max.y > 0.3) o.receiveShadow = false;   // flat floor details (tile joints, cracks) keep receiving, or they glow inside shadows
  }); })();
// tinted, half-transparent patches where light passes through frosted / algae / grimy panes
const TINT = {}; ['frost', 'algae', 'dirt'].forEach((k) => { const col = { frost: 0x5a6266, algae: 0x3f5a2e, dirt: 0x5b4a36 }[k]; const g2 = new T.BufferGeometry(); const list = CI.tints.filter((t) => t.kind === k); g2.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(list.length * 18), 3)); const m = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); const me = new T.Mesh(g2, m); me.frustumCulled = false; me.renderOrder = 1; SC.add(me); TINT[k] = { list, me, base: { frost: 0.07, algae: 0.24, dirt: 0.1 }[k] }; /* 2026-10-15 light-density pass: frosted panes are most of the roof, so their grey patches drew a lattice over the whole floor; keep them a whisper and let the green algae patches be the one daytime light pattern */ });
function updateTints() { const sd = sun.position.clone().normalize(); const ok = sd.y > 0.12; Object.values(TINT).forEach((T0) => { const a = T0.me.geometry.attributes.position; let i = 0; T0.list.forEach((t) => { const pr = t.q.map((p) => { const k = (p.y - 0.14) / Math.max(0.12, sd.y); return [p.x - sd.x * k, 0.14, p.z - sd.z * k]; }); [0, 1, 2, 0, 2, 3].forEach((n) => { a.setXYZ(i++, pr[n][0], pr[n][1], pr[n][2]); }); }); a.needsUpdate = true; T0.me.material.opacity = ok ? T0.base * Math.min(1, Math.max(0, (cur.sunI - 0.35) / 0.7)) : 0; }); }
// flowing fog layers (noise that drifts), cleared from the centre by the morning vortex
const fogU = { uTime: { value: 0 }, uDens: { value: 0 }, uColor: { value: new T.Color(0xffffff) }, uClear: { value: 0 }, uC: { value: new T.Vector2(0.4, 0.4) } };
const fogMat = new T.ShaderMaterial({ uniforms: fogU, transparent: true, depthWrite: false, side: T.DoubleSide,
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float uTime; uniform float uDens; uniform vec3 uColor; uniform float uClear; uniform vec2 uC; varying vec3 vW;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*n2(p); p *= 2.03; a *= 0.5; } return v; }
    void main(){ vec2 p = vW.xz*0.16 + vec2(uTime*0.05, uTime*0.018) + vW.y*0.7; float n = fbm(p + fbm(p*0.7 - uTime*0.02)); float a = smoothstep(0.32, 0.78, n) * uDens;
      float r = length(vW.xz - uC); a *= smoothstep(uClear - 3.5, uClear, r); float edge = smoothstep(26.0, 14.0, length(vW.xz - vec2(3.0)));
      gl_FragColor = vec4(uColor, a*edge); }` });
const FOG_LAYERS = [[0.3, 1.0], [1.2, 0.75], [2.5, 0.55], [4.1, 0.35]].map(([y, f]) => { const m = new T.Mesh(new T.PlaneGeometry(40, 40), fogMat.clone()); m.material.uniforms = { uTime: fogU.uTime, uDens: { value: 0 }, uColor: fogU.uColor, uClear: fogU.uClear, uC: fogU.uC }; m.rotation.x = -Math.PI / 2; m.position.set(3, y, 3); m.renderOrder = 3; SC.add(m); m.userData.f = f; return m; });
// misty moonbeams through the broken roof panes (only on foggy nights)
const moonU = { uOpacity: { value: 0 }, uTime: beamU.uTime, uColor: { value: new T.Color(0xa9c2e6) } };
const moonMat = beamMat.clone(); moonMat.uniforms = moonU;
const MOON_DIR = V3(-0.42, 0.82, -0.4).normalize();
const MOONB = beams(SC, CI.holes.filter((h) => h.y > 4), 7, 0.1, MOON_DIR, moonMat, true);

// a lantern hanging in the glass corridor, so the exit reads from inside the room
const corrLamp = new T.Group(); corrLamp.position.set(-14.2, 2.05, 1.5); SC.add(corrLamp);
tube([V3(0, 0.15, 0), V3(0, 0.6, 0)], 0.01, M.ironDark, corrLamp, 2);
const corrGM = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffb45e, emissiveIntensity: 1.2, roughness: 1 }); mesh(new T.BoxGeometry(0.16, 0.22, 0.16), corrGM, corrLamp).castShadow = false;
const corrHalo = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xffc27a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 })); corrHalo.scale.setScalar(1.8); corrLamp.add(corrHalo);
const corrLight = new T.PointLight(0xffb05a, 0.9, 6, 2); corrLamp.add(corrLight);
// a small work lamp on the seed machine's mast: the focal point stays readable on dark nights
const workLamp = new T.Group(); workLamp.position.set(MC.x + 0.32, 2.35, MC.z + 0.32); SC.add(workLamp);
mesh(new T.BoxGeometry(0.06, 0.06, 0.26), M.ironDark, workLamp, 0, 0, -0.1).rotation.y = Math.PI / 4;
const workGM = new T.MeshStandardMaterial({ color: 0x2c2620, emissive: 0xffc78a, emissiveIntensity: 0.6, roughness: 1 }); mesh(new T.CylinderGeometry(0.07, 0.1, 0.12, 8), workGM, workLamp, 0.05, -0.05, 0.05).castShadow = false;
const workLight = new T.PointLight(0xffc27a, 0.3, 5.5, 2); workLight.position.set(0.1, -0.2, 0.1); workLamp.add(workLight);
const workHalo = new T.Sprite(new T.SpriteMaterial({ map: SOFT, color: 0xffd09a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.3 })); workHalo.scale.setScalar(1.0); workLamp.add(workHalo);
// ripples on the empty tray where the drips land
const ripples = []; for (let i = 0; i < 3; i++) { const r = new T.Mesh(new T.RingGeometry(0.05, 0.065, 20), new T.MeshBasicMaterial({ color: 0xdfeef0, transparent: true, opacity: 0, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.set(0.15, 0.185, 0.08); CI.emptyTray.add(r); r.userData.ph = i / 3; ripples.push(r); }

function polishUpdate(dt) {
  if (active !== 'I') return;
  updateTints();
  const nightK = smooth(0.3, 0.9, cur.lamps); workGM.emissiveIntensity = 0.4 + 1.1 * nightK; workLight.intensity = 0.15 + 0.75 * nightK; workHalo.material.opacity = 0.12 + 0.4 * nightK;
  corrGM.emissiveIntensity = 0.7 + 0.8 * nightK; corrLight.intensity = 0.5 + 0.8 * nightK; corrHalo.material.opacity = 0.35 + 0.35 * nightK;
  ripples.forEach((r) => { const k = (time * 0.7 + r.userData.ph) % 1; r.scale.setScalar(1 + k * 3); r.material.opacity = SIM.dripOn ? (1 - k) * 0.8 : 0; });
  // fog: flowing layers + drifting puffs
  fogU.uTime.value = time; fogU.uColor.value.copy(cur.mistC); const VX = SIM.vortex || 0; fogU.uClear.value = VX * VX * 24;
  FOG_LAYERS.forEach((m) => { m.material.uniforms.uDens.value = Math.max(0, cur.mist - 0.05) * 0.62 * m.userData.f; });
  CI.mist.forEach((sp) => { const b = sp.userData.base; b.x += dt * 0.22; b.z += dt * 0.07; if (b.x > 12.5) { b.x -= 24; sp.userData.wrapT = time; } if (b.z > 12.5) { b.z -= 24; sp.userData.wrapT = time; } sp.material.opacity *= (1 - smooth(10.0, 12.5, b.x)) * (1 - smooth(10.0, 12.5, b.z)) * (sp.userData.wrapT === undefined ? 1 : smooth(0, 4, time - sp.userData.wrapT)); const br = 1 + Math.sin(time * 0.25 + sp.userData.ph) * 0.12; sp.scale.setScalar((sp.userData.s0 || (sp.userData.s0 = sp.scale.x)) * br); });
  // moonbeams: cold, faint, shimmering with the fog; only when it is foggy at night
  if (CI.poolMat) CI.poolMat.opacity = beamU.uOpacity.value * 0.5; if (MOONB.list.poolMat) MOONB.list.poolMat.opacity = moonU.uOpacity.value * 0.35;
  moonU.uOpacity.value = 0.95 * smooth(0.3, 0.65, cur.mist) * smooth(0.5, 0.95, cur.lamps) * (0.75 + 0.25 * Math.sin(time * 0.6));
  // ferns part around the traveller and spring back
  const tp = trav.position; FERNS.forEach((f) => { if (!f.userData.wp) { f.userData.wp = f.getWorldPosition(new T.Vector3()); } const w = f.userData.wp; const dx = w.x - tp.x, dz = w.z - tp.z, d = Math.hypot(dx, dz); const tgt = d < 0.85 && Math.abs(tp.y - w.y) < 1 ? (0.85 - d) / 0.85 : 0; f.userData.bend = (f.userData.bend || 0) + (tgt - (f.userData.bend || 0)) * Math.min(1, dt * (tgt > (f.userData.bend || 0) ? 10 : 2.5)); if(tgt>.12&&!f.userData.audioTouch){sound('nursery_fern_brush',.65,false,.35);f.userData.audioTouch=true;}if(tgt===0)f.userData.audioTouch=false; const b = f.userData.bend * 0.75; if (b > 0.001) { const nx = dx / (d || 1), nz = dz / (d || 1); f.rotation.z += -nx * b; f.rotation.x += nz * b; } });
}

setConcept('I'); setMood('day', true);


let key=null,actionElapsed=0,view={kind:'overview'},chrome={cards:[]},routes=[],items=[],departureDone=false,departureStarted=false,ready=0,transplant=false;
let testId=null,testElapsed=0,testFinished=false;
function testPlay(id,walkIn=false){
 if(!opts.testMode)throw new Error('Animation audition is available only in the dedicated tester.');
 clearAction();SIM.dep=null;SIM.fade=1;SIM.vortex=0;EX=null;transplant=false;departureDone=false;departureStarted=false;
 coreFx.visible=false;amberFx.material.opacity=0;chartSpot.material.opacity=0;spot.material.opacity=0;handM.opacity=0;
 resetCage();keyG.visible=true;setSap(-1);setMemKey('pot',false);setMemKey('wipe',false);
 if(CI.fallenPot){CI.fallenPot.rotation.z=1.45;CI.fallenPot.position.set(2.2,.3,6.4);CI.spill.scale.set(1,1,1);CI.spill.position.x=2.9;}
 if(CI.exitDoor)CI.exitDoor.rotation.y=.9;
 LIT=id==='rest'||id==='corridor'||id==='cellar'?5:0;
 time=0;testElapsed=0;testId=id;testFinished=false;walkPh=0;nextBird=20;nextTick=12;lastBook=false;
 PK.forEach(k=>PZ[k]=0);setTravOpacity(1);
 const node=AMB[id]?.node??({first:'MT',chart:'B',core:'B',shard:'WL',plant:'MT',transplant:'MT',leaf:'T',mulch:'B',rest:'H',walk:'D',lamps:'H'})[id]??'H';
 TRV.node=walkIn?'H':node;TRV.pos.copy(NP(TRV.node));trav.position.copy(TRV.pos);
 if(id==='corridor'||id==='cellar'){TRV.pos.copy(seatPos().p);depart(id);}
 else if(id==='rest')rest();
 else if(id==='walk')walkTo('G',()=>walkTo('B'));
 else if(id==='lamps'){const next=k=>{if(k<5)lightLamp(k,()=>next(k+1));};next(0);}
 else if(STORY[id])STORY[id]();else if(AMB[id])runAmbient(id);else throw new Error('Unknown nursery audition.');
}
function testMood(name){
 if(!opts.testMode)return;
 audioPeriod=name==='dusk'?'dusk':['night','clearNight','sunrise'].includes(name)?'night':'day';
 lastRun=null;
 if(name==='dusk'){playSeq=null;from=cur;to=MOOD_DUSK;mt=0;}
 else if(name==='clearNight'){setMood('night',false);to=nightLight;}
 else if(name==='dawnClear'){setMood('dawn',false);to=dawnClear;}
 else if(name==='sunrise'){setMood('night',true);playSeq={t:0,dur:75};}
 else setMood(name,false);
}
function applyWorld(){const m=nursery?.worldMarks;if(!m)return;setMemKey('pot',m.potUpright);setMemKey('wipe',m.glassWiped);
  setSap(m.saplingTransplanted?3:m.saplingPlanted?m.saplingStage:-1);
  if(nursery.coreTaken){jar.visible=false;cageDoor.rotation.y=-1.7;padlock.visible=false;keyG.visible=false;}}
function clearAction(){audio?.stopShots();coreFx.visible=false;amberFx.material.opacity=0;chartSpot.material.opacity=0;TRV.savedWalk=false;TRV.onArrive=null;SIM.burst=0;TRV.path=null;TRV.act=null;SIM.ride=false;SIM.seatWait=false;SIM.board=null;SIM.carry=null;SIM.holdDisc=false;SIM.dripOn=false;camHome();}
function presentAction(now){
  if(opts.testMode)return;
  const a=nursery?.action,seconds=paused||lobby?progress:Math.min(a?.endSeconds??progress+1,progress+(now-progressAt)/1000);
  LIT=opts.recapLamps??Math.min(5,Math.floor(seconds/600));
  if(opts.departure){if(!departureStarted){clearAction();applyWorld();const p=seatPos();TRV.pos.copy(p.p);depart(opts.departure.exit==='exit_corridor'?'corridor':'cellar');departureStarted=true;}
    if(!SIM.dep&&!departureDone){departureDone=true;opts.reportDepartureComplete?.();}return;}
  if(transplant)return;
  if(lobby){if(key!=='lobby'){clearAction();applyWorld();rest();key='lobby';}return;}
  cur=!opts.quietFocus&&a?.eventId==='carry_silvered_shard'?lerpMood(MOODS.night,MOODS.night,0):moodAt(seconds/30);playSeq=null;mt=1;
  if(!a)return;
  const next=`${a.id}:${a.kind}`;
  if(key===next)return;key=next;
  // Consecutive rest checkpoints keep the same rotating seat.
  if(a.kind==='rest'&&SIM.ride){actionElapsed=0;applyWorld();return;}
  clearAction();applyWorld();
  if(a.kind==='walk'){TRV.pos.copy(NP(a.route[0]));TRV.path=routePoints(a.route);TRV.d=0;TRV.speed=polyLen(TRV.path)/Math.max(1,a.endSeconds-a.startSeconds);TRV.target=a.node;TRV.savedWalk=true;}
  else {TRV.node=a.fromNode??a.node;if(a.kind!=='rest')TRV.pos.copy(NP(a.fromNode??a.node));
    if(a.kind==='story'){
      if(opts.quietFocus&&['find_core','find_pressed_leaf','find_mulch_cloth'].includes(a.eventId)){const core=a.eventId==='find_core',item=a.eventId==='find_pressed_leaf'||a.eventId==='find_mulch_cloth';
        const pickup=()=>doAct({dur:core?QUIET_FOCUS.corePoseSeconds:a.endSeconds-a.startSeconds,pose:core?'crouch':item?'reach':'look',update:p=>{const elapsed=p*(core?QUIET_FOCUS.corePoseSeconds:a.endSeconds-a.startSeconds);amberFx.position.copy(TRV.pos);amberFx.position.y+=.7;amberFx.scale.setScalar(.12);amberFx.material.color.setHex(core?0x9cc8e8:0xffbf70);amberFx.material.opacity=opts.reducedMotion?0:.18*Math.max(0,1-elapsed/(core?QUIET_FOCUS.coreFadeSeconds:QUIET_FOCUS.itemFadeSeconds));},end:()=>{amberFx.material.opacity=0;}});
        if(core)doAct({dur:3,pose:'reach',end:()=>walkTo('K',pickup,2)});else pickup();
      }else{const f=STORY[nurseryStoryKeys[a.eventId]];f?.();}}

    else if(a.kind==='ambient'){runAmbient(a.eventId);}
    else if(a.kind==='lamp'){TRV.yaw=faceTo(...LAMP_POS[a.lamp-1]);doAct({dur:2.2,pose:'light'});}
    else if(a.kind==='rest'){rest();}}
  // Reopen at the saved position in the action rather than replaying an old event.
  const elapsed=Math.max(0,Math.min(60,seconds-a.startSeconds));seeking=true;try{for(let t=0;t<elapsed;t+=.05)tick(Math.min(.05,elapsed-t));}finally{seeking=false;}
  actionElapsed=elapsed;
}
function anchor(node){const p=NP(node).clone();p.y+=.7;p.project(camera);return {x:(p.x+1)*canvas.clientWidth/2,y:(1-p.y)*canvas.clientHeight/2};}
function lobbyCam(){if(!lobby||transplant||opts.departure)return;
  const p=view.kind==='look'?NP(view.exit==='exit_corridor'?'D':'X2'):TRV.pos.clone();p.y+=.8;
  if(view.kind==='overview'){camGoal.copy(CI.target);camZoomGoal=1;return;}
  const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);p.addScaledVector(right,(chrome.right||0)/Math.max(1,canvas.clientWidth)*6);camGoal.copy(p);camZoomGoal=1.6;}
let compiled=false;void renderer.compileAsync(scene,camera,()=>dead).then(()=>dead?undefined:glass.prepare(()=>dead)).then(()=>{compiled=true;}).catch(e=>{console.error(e);compiled=true;});
function draw(now=performance.now()){
  if(dead)return;const elapsed=Math.max(0,(now-lastReal)/1000);lastReal=now;if(!compiled)return;
  presentAction(now);lobbyCam();
  const run=Math.max(0,Math.min(1,1-cur.lamps*1.15));
  const audible=audioActive&&!paused&&!departureDone;
  if(opts.testMode&&playSeq&&playSeq.t>playSeq.dur*.5)audioPeriod='day';
  audio?.update(audioSettings,!audible,{paused,run,turn:SIM.holdDisc||cur.lamps>.85?0:run,mist:cur.mist,vortex:SIM.vortex||0,ride:SIM.ride,core:!opts.quietFocus&&TRV.act?.audioKey==='core',burst:SIM.burst||0,fade:opts.departure?SIM.fade:1,period:nursery?.action?.eventId==='carry_silvered_shard'?'night':audioPeriod,action:!opts.quietFocus&&!!nurseryAudioCues[TRV.act?.audioKey]});
  if(lastRun!==null&&Math.abs(run-lastRun)<.1&&audible){if(lastRun<=.0225&&run>.0225)sound('nursery_machine_start',6);if(lastRun>.0225&&run<=.0225)sound('nursery_machine_stop',5);}lastRun=run;
  if(audible&&time>nextBird&&run>.25){sound('nursery_birds_day',5,false,.5*run);nextBird=time+16+Math.random()*18;}
  if(audible&&time>nextTick&&run===0){sound('nursery_glass_tick',.5,false,.25);nextTick=time+12+Math.random()*22;}
  const activeElapsed=paused?0:Math.min(1,elapsed),dt=Math.min(.05,activeElapsed);time+=activeElapsed;
  if(!opts.testMode&&!lobby&&!opts.departure&&!transplant&&nursery?.action){
    const a=nursery.action,seconds=paused?progress:Math.min(a.endSeconds,progress+(now-progressAt)/1000);
    const targetElapsed=Math.max(0,Math.min(a.endSeconds-a.startSeconds,seconds-a.startSeconds));
    const advance=Math.max(0,targetElapsed-actionElapsed);const oldSeeking=seeking;seeking=advance>.5;
    try{for(let t=0;t<advance;t+=.05)tick(Math.min(.05,advance-t));}finally{seeking=oldSeeking;}
    actionElapsed=Math.max(actionElapsed,targetElapsed);
  }else advanceAnimation(activeElapsed,step=>tick(step));
  if(opts.testMode&&testId&&!testFinished){testElapsed+=activeElapsed;if(!TRV.path&&!TRV.act&&!SIM.dep&&!SIM.board&&!SIM.seatWait){testFinished=true;}}
  if(!SIM.holdDisc&&CI.disc&&!lobby&&!opts.departure){const seconds=paused?progress:progress+(now-progressAt)/1000;const night=cur.lamps>.85;CI.disc.rotation.y=night?Math.floor(seconds/600)*Math.PI*2:seconds/600*Math.PI*2;}
  if(opts.quietFocus&&!lobby){spot.material.opacity=0;handM.opacity=0;chartSpot.material.opacity=0;coreFx.visible=false;}
  quietCanvas(canvasHost,opts.quietFocus&&!lobby);glass.render(scene,camera,dt,scene.background,[.34,.24,.08],paused);
  opts.reportCinematic?.(transplant||(!opts.quietFocus&&nursery?.action?.kind==='story'));
  const anchors={rest:anchor('H'),entry:anchor('D'),exit_corridor:anchor('D'),exit_cellar:anchor('X2')};items.forEach((item,i)=>{const p=anchors.rest;anchors['item:'+item.key]={x:p.x+i*30,y:p.y+60};});opts.reportAnchors?.(anchors);
  if(++ready===2)opts.reportReady?.();
  if(!opts.testMode&&transplant&&!TRV.act&&!TRV.path){transplant=false;key=null;applyWorld();glass.setUiFade(1);opts.reportCinematic?.(false);opts.reportTransplantComplete?.();globalThis.dispatchEvent(new CustomEvent('focusquest:nursery-transplant-done')); }
}
function loop(now){if(!opts.recapDormant)draw(now);else lastReal=now;if(!dead)raf=requestAnimationFrame(loop);}
const observer=new ResizeObserver(()=>{resize();fgResize();});observer.observe(host);
const watchdog=setInterval(()=>{if(!opts.recapDormant&&performance.now()-lastReal>250)draw();},33);
function transplantChoice(e){if(!lobby||e.detail?.nodeId!==nursery?.nodeId)return;if(e.detail.state)nursery=e.detail.state;clearAction();transplant=true;glass.setUiFade(0);SIM.dep=null;STORY.transplant();opts.reportCinematic?.(true);}
globalThis.addEventListener('focusquest:nursery-transplant',transplantChoice);
raf=requestAnimationFrame(loop);
return {areaId:'area-07-glass-nursery',
 setNurseryState(s){nursery=s;for(let i=0;i<FOG_ROLL.length;i++)FOG_ROLL[i]=nurseryFog(s.seed,i*600);},setProgress(s){if(Math.abs(s-progress-(performance.now()-progressAt)/1000)>2){audio?.stopShots();lastRun=null;}progress=s;progressAt=performance.now();},setPaused(v){paused=!!v;progressAt=performance.now();glass.jumpPaused(paused);},
 auditionBgm(name){draw();return audio?.auditionBgm(name);},setShortMusicGaps(value){audio?.setShortGaps(value);},
 beginRecapEvent(record,id){clearAction();transplant=false;lobby=false;opts.departure=null;opts.quietFocus=false;opts.recapNoWalk=true;key=null;
   const action=recapAction(record,id);nursery={...structuredClone(record.scene.nursery),action,effectiveSeconds:action.startSeconds};progress=action.startSeconds;progressAt=performance.now();paused=false;actionElapsed=0;},
 async warmRecapEvent(record){this.beginRecapEvent(record,-Math.random());this.renderNow();paused=true;coreFx.visible=true;amberFx.material.opacity=.5;await renderer.compileAsync(scene,camera,()=>dead);this.showRecapOverview();},
 showRecapOverview(close=false){clearAction();opts.recapNoWalk=false;lobby=true;key=null;view={kind:close?'close':'overview'};paused=false;},
 setRecapLamps(count){opts.recapLamps=Math.max(0,Math.min(5,count));LIT=opts.recapLamps;},
 setRecapDormant(value){opts.recapDormant=value;lastReal=performance.now();},
 enableRecapTransitions(){glass.enableTransitions();},beginRecapTransition(duration){glass.crossfade(duration);},
 setStory(){},setQuietFocus(value){opts.quietFocus=!!value;},setAudioSettings(s,active=true){audioSettings=s;audioActive=active;},setReducedMotion(value){opts.reducedMotion=!!value;},setUiFade(v){glass.setUiFade(v);},setChrome(v){chrome=v;glass.setChrome(v);},setWorldState(){},playSpecialFind(){},
 setRoutes(v,hover){routes=v;if(hover){const r=routes.find(r=>r.key===hover);if(r?.exit)view={kind:'look',exit:r.exit};}},setLobbyView(v){view=v;},setLobbyItems(v){items=v;},
 enterLobby(nextHost,nextOpts){observer.disconnect();host=nextHost;host.append(canvas,lens);observer.observe(host);opts={...opts,...nextOpts,departure:null};lobby=true;paused=false;key=null;resize();fgResize();},
 renderNow(){draw();},debugState(){return {areaId:'area-07-glass-nursery',action:nursery?.action,worldMarks:nursery?.worldMarks,audio:audio?.debugState(),localAction:TRV.act?{key:TRV.act.audioKey,t:TRV.act.t,dur:TRV.act.dur}:null,lit:LIT,departureDone,transplant,position:TRV.pos.toArray(),camera:target.toArray(),zoom:camZoom};},
 qa:{testPlay,testMood,testState(){return {id:testId,elapsed:testElapsed,finished:testFinished,moving:!!TRV.path||!!SIM.dep,paused,ready:compiled&&ready>=2,audio:audio?.debugState()};},seek(s){seeking=true;try{for(let t=0;t<s;t+=.05){time+=.05;tick(Math.min(.05,s-t));}}finally{seeking=false;}},setAudioSettings(s,active=true){audioSettings=s;audioActive=active;},T,scene,renderer,camera,N,EDGES,NP,route,edgePts,polyLen,polyAt,CORR,CELL,MC,BOARD,trav,M,M2,setSap,play(id){clearAction();transplant=true;STORY[id]?.();},advance(s){for(let t=0;t<s;t+=.05){time+=.05;tick(.05);}renderer.render(scene,camera);}},
 destroy(){if(dead)return;dead=true;audio?.destroy();cancelAnimationFrame(raf);clearInterval(watchdog);observer.disconnect();globalThis.removeEventListener('focusquest:nursery-transplant',transplantChoice);listeners.forEach(([type,fn])=>globalThis.removeEventListener(type,fn));scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(!m)return;Object.values(m).forEach(v=>{if(v?.isTexture)v.dispose();});m.dispose();});});glass.dispose();renderer.dispose();canvas.remove();lens.remove();}
};

}
