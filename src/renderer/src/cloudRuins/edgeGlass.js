// Edge glass for Focus Active (雲上遺庭).
// The one live 3D scene is rendered into an off-screen target, a small blurred copy is made from it,
// and a final full-screen pass mixes the sharp and blurred images: blurred, gently darkened glass
// only where the header, footer pill and button sit, the sharp map everywhere else. Because the glass
// samples the same frame, its colour follows dawn / day / dusk / night continuously, with no second
// scene and no reliance on CSS backdrop-filter over WebGL.
import * as T from './vendor/three.module.js';

const MAX_CARDS = 12;
// pill: a crisp glass card with a faint lit rim. zone: a soft, wide darkening behind a text group.
const KIND = { pill: [16, 9, 1, 0], zone: [60, 96, 0, 0] };

const VERT = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// Dual-filter (Kawase) downsample: a smooth half-size copy that does not shimmer on grass or water.
const DOWN = 'uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;\n' +
  'void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 4.0;\n' +
  ' c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb; c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;\n' +
  ' c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb; c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;\n' +
  ' gl_FragColor = vec4(c / 8.0, 1.0); }';

// Separable 9-tap gaussian with linear sampling (5 fetches).
const BLUR = 'uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;\n' +
  'void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;\n' +
  ' vec2 o1 = uDir * 1.3846153846, o2 = uDir * 3.2307692308;\n' +
  ' c += (texture2D(tSrc, vUv + o1).rgb + texture2D(tSrc, vUv - o1).rgb) * 0.3162162162;\n' +
  ' c += (texture2D(tSrc, vUv + o2).rgb + texture2D(tSrc, vUv - o2).rgb) * 0.0702702703;\n' +
  ' gl_FragColor = vec4(c, 1.0); }';

const COMPOSITE = 'uniform sampler2D tSharp, tBlur; uniform vec2 uSize; uniform vec4 uBand; uniform vec4 uCards[' + MAX_CARDS + '], uCardFx[' + MAX_CARDS + '];\n' +
  'uniform float uCardCount, uUi, uPause, uCrossFade; uniform sampler2D tPrevious; uniform vec3 uDeep; uniform vec3 uTone; varying vec2 vUv;\n' +
  'float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }\n' +
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' +
  'void main(){\n' +
  ' vec3 sharp = texture2D(tSharp, vUv).rgb;\n' +
  ' vec3 soft = texture2D(tBlur, vUv).rgb;\n' +
  // paused: the frozen world rests slightly quieter (a little less colour and light), eased in and out
  ' vec3 lw = vec3(0.2126, 0.7152, 0.0722);\n' +
  ' sharp = mix(sharp, vec3(dot(sharp, lw)), 0.3 * uPause) * (1.0 - 0.08 * uPause);\n' +
  ' soft = mix(soft, vec3(dot(soft, lw)), 0.3 * uPause) * (1.0 - 0.08 * uPause);\n' +
  // position in CSS pixels from the top-left of the scene host
  ' vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize; float yb = uSize.y - p.y;\n' +
  ' float top = uBand.x, bot = uBand.y, ft = uBand.z, fb = uBand.w;\n' +
  // header: full glass under the text, fading out a little below the header edge (no hard line)
  ' float mT = top > 0.5 ? 1.0 - smoothstep(top * 0.35, top + ft, p.y) : 0.0;\n' +
  // footer: a lighter, shorter progressive blur along the bottom edge
  ' float mB = bot > 0.5 ? (1.0 - smoothstep(bot * 0.2, bot + fb, yb)) * 0.85 : 0.0;\n' +
  ' float mC = 0.0, mZ = 0.0, rim = 0.0;\n' +
  ' for (int i = 0; i < ' + MAX_CARDS + '; i++) { if (float(i) >= uCardCount) break; vec4 c = uCards[i]; vec4 fx = uCardFx[i]; vec2 h = c.zw * 0.5;\n' +
  '  float d = sdBox(p - c.xy - h, h, min(fx.x, h.y)); float m = 1.0 - smoothstep(fx.z > 0.5 ? -fx.y * 0.3 : -fx.y * 0.2, fx.y, d);\n' +
  '  if (fx.z > 0.5) { mC = max(mC, m); rim = max(rim, (1.0 - smoothstep(0.0, 1.1, abs(d + 0.7))) * (0.55 + 0.45 * (1.0 - clamp((p.y - c.y) / max(c.w, 1.0), 0.0, 1.0)))); }\n' +
  '  else mZ = max(mZ, m * m * (3.0 - 2.0 * m) * 0.78); }\n' +
  // immersive mode: the glass fades together with the text it sits under
  ' mT *= uUi; mB *= uUi; mC *= uUi; mZ *= uUi; rim *= uUi;\n' +
  ' float glass = clamp(max(max(mT, mB), max(mC, mZ)), 0.0, 1.0);\n' +
  // gentle vibrancy, then keep the glass dark enough for light text by capping its brightness;
  // the hue always comes from the live scene, so every time of day blends through continuously
  ' float l0 = dot(soft, vec3(0.2126, 0.7152, 0.0722));\n' +
  ' vec3 g = mix(vec3(l0), soft, 1.14);\n' +
  ' float cap = mix(1.0, uTone.x, max(mT, mB * 0.6)); cap = min(cap, mix(1.0, uTone.y, max(mC, mZ)));\n' +
  ' g *= min(1.0, cap / max(l0, 0.001));\n' +
  ' g = mix(g, uDeep, uTone.z * max(max(mT, mC), mZ));\n' +
  ' vec3 col = mix(sharp, g, glass);\n' +
  ' col += rim * 0.075 * vec3(1.0, 0.98, 0.94);\n' +
  ' col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;\n' +
  ' if(uCrossFade < 0.999) col = mix(texture2D(tPrevious, vUv).rgb, col, uCrossFade);\n' +
  ' gl_FragColor = vec4(col, 1.0); }';

export function createEdgeGlass(renderer) {
  const gl2 = renderer.capabilities.isWebGL2 === true;
  const rtOpts = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: false, stencilBuffer: false };
  const sharp = gl2 && T.WebGLMultisampleRenderTarget
    ? new T.WebGLMultisampleRenderTarget(1, 1, Object.assign({}, rtOpts, { depthBuffer: true }))
    : new T.WebGLRenderTarget(1, 1, Object.assign({}, rtOpts, { depthBuffer: true }));
  if (sharp.isWebGLMultisampleRenderTarget) sharp.samples = 4;
  let levels = [];
  let ping = null, pong = null;
  let previous = null, history = false, fadeAt = -Infinity, fadeDuration = 220;

  const quadScene = new T.Scene();
  const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new T.BufferGeometry();
  quadGeo.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new T.Mesh(quadGeo);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const mat = (frag, uniforms) => new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const downMat = mat(DOWN, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
  const blurMat = mat(BLUR, { tSrc: { value: null }, uDir: { value: new T.Vector2() } });
  const cards = Array.from({ length: MAX_CARDS }, () => new T.Vector4());
  const cardFx = Array.from({ length: MAX_CARDS }, () => new T.Vector4());
  const compMat = mat(COMPOSITE, {
    tSharp: { value: sharp.texture }, tBlur: { value: null }, tPrevious: {value:null}, uCrossFade:{value:1}, uSize: { value: new T.Vector2(1, 1) },
    uBand: { value: new T.Vector4(0, 0, 44, 30) }, uCards: { value: cards }, uCardFx: { value: cardFx }, uCardCount: { value: 0 }, uUi: { value: 1 }, uPause: { value: 0 },
    uDeep: { value: new T.Color(0x0b1016) }, uTone: { value: new T.Vector3(0.3, 0.24, 0.12) }
  });

  // Layout from the DOM (CSS pixels). Card rects ease toward their targets so a changing text width
  // never makes the glass jump.
  const chrome = { top: 0, bottom: 0, cards: [] };
  const shown = [];
  let cssW = 1, cssH = 1, dpr = 1, enabled = false;

  function run(material, target) { quad.material = material; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }

  function setSize(w, h, pixelRatio) {
    if(levels.length&&cssW===Math.max(1,w)&&cssH===Math.max(1,h)&&dpr===(pixelRatio||1))return;
    cssW = Math.max(1, w); cssH = Math.max(1, h); dpr = pixelRatio || 1;
    const bw = Math.max(1, Math.round(cssW * dpr)), bh = Math.max(1, Math.round(cssH * dpr));
    sharp.setSize(bw, bh);
    if(previous)previous.setSize(bw,bh);history=false;fadeAt=-Infinity;
    // halve until about a quarter of the CSS size; the blur then runs on a few hundred pixels
    const want = Math.max(1, Math.round(Math.log2(4 * dpr)));
    levels.forEach((rt) => rt.dispose());
    levels = [];
    let lw = bw, lh = bh;
    for (let i = 0; i < want; i++) { lw = Math.max(1, Math.ceil(lw / 2)); lh = Math.max(1, Math.ceil(lh / 2)); levels.push(new T.WebGLRenderTarget(lw, lh, rtOpts)); }
    if (ping) { ping.dispose(); pong.dispose(); }
    ping = new T.WebGLRenderTarget(lw, lh, rtOpts); pong = new T.WebGLRenderTarget(lw, lh, rtOpts);
    compMat.uniforms.uSize.value.set(cssW, cssH);
  }

  function setChrome(next) {
    chrome.top = Math.max(0, Number(next && next.top) || 0);
    chrome.bottom = Math.max(0, Number(next && next.bottom) || 0);
    // snap: the card follows something that moves with the camera (lobby route markers); its glass
    // must stay under it instead of easing behind it.
    chrome.cards = ((next && next.cards) || []).slice(0, MAX_CARDS).map((c) => ({ x: +c.x || 0, y: +c.y || 0, w: +c.w || 0, h: +c.h || 0, kind: c.kind === 'zone' ? 'zone' : 'pill', snap: !!c.snap }));
    enabled = chrome.top > 0 || chrome.bottom > 0 || chrome.cards.length > 0;
    while (shown.length > chrome.cards.length) shown.pop();
    chrome.cards.forEach((c, i) => { if (!shown[i]) shown[i] = Object.assign({}, c); });
  }

  // deep: a dark tone taken from the scene's current fog; tone = [brightness cap under the header,
  // brightness cap inside cards, extra tint toward deep]. Both are eased by the scene's preset blend.
  let uiTarget = 1, uiFade = 1, pauseMix = 0;
  function setUiFade(opacity) { uiTarget = Math.max(0, Math.min(1, Number(opacity))); if (!Number.isFinite(uiTarget)) uiTarget = 1; }

  // A scene that is created already paused starts with the paused tint fully applied.
  function jumpPaused(paused) { pauseMix = paused ? 1 : 0; }

  function render(scene, camera, dt, deep, tone, paused) {
    // eased in real time (these are UI states, not world time), ~1.2 s like the CSS text fade
    const ke = 1 - Math.exp(-(dt || 0.016) * 3.2);
    uiFade += (uiTarget - uiFade) * ke; if (Math.abs(uiTarget - uiFade) < 0.002) uiFade = uiTarget;
    pauseMix += ((paused ? 1 : 0) - pauseMix) * ke; if (Math.abs((paused ? 1 : 0) - pauseMix) < 0.002) pauseMix = paused ? 1 : 0;
    if (!enabled&&!previous) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    const k = 1 - Math.exp(-(dt || 0.016) * 10);
    chrome.cards.forEach((c, i) => {
      const s = shown[i]; const kk = c.snap ? 1 : k;
      s.x += (c.x - s.x) * kk; s.y += (c.y - s.y) * kk; s.w += (c.w - s.w) * kk; s.h += (c.h - s.h) * kk;
      cards[i].set(s.x, s.y, s.w, s.h); cardFx[i].fromArray(KIND[c.kind]);
    });

    renderer.setRenderTarget(sharp);
    renderer.render(scene, camera);
    let src = sharp;
    for (const rt of levels) {
      downMat.uniforms.tSrc.value = src.texture;
      downMat.uniforms.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
      run(downMat, rt); src = rt;
    }
    blurMat.uniforms.tSrc.value = src.texture;
    const spread = 1.35;
    for (let i = 0; i < 2; i++) {
      blurMat.uniforms.tSrc.value = i === 0 ? src.texture : pong.texture;
      blurMat.uniforms.uDir.value.set(spread / ping.width, 0); run(blurMat, ping);
      blurMat.uniforms.tSrc.value = ping.texture;
      blurMat.uniforms.uDir.value.set(0, spread / ping.height); run(blurMat, pong);
    }
    const u = compMat.uniforms;
    u.tBlur.value = pong.texture;
    u.uBand.value.set(chrome.top, chrome.bottom, 44, 34);
    u.uCardCount.value = chrome.cards.length;
    if (deep) u.uDeep.value.copy(deep);
    if (tone) u.uTone.value.set(tone[0], tone[1], tone[2]);
    u.uUi.value = uiFade; u.uPause.value = pauseMix;
    u.uCrossFade.value=Math.min(1,Math.max(0,(performance.now()-fadeAt)/Math.max(1,fadeDuration)));
    run(compMat, null);history=true;
  }

  /** Replay only: retain the prior GPU texture, without canvas readback or another scene render. */
  function enableTransitions(){if(previous)return;previous=new T.WebGLRenderTarget(sharp.width,sharp.height,rtOpts);compMat.uniforms.tPrevious.value=previous.texture;renderer.setRenderTarget(previous);renderer.clear();renderer.setRenderTarget(null);}
  function crossfade(duration=220){if(!previous||!history||duration<=0){fadeAt=-Infinity;return;}downMat.uniforms.tSrc.value=sharp.texture;downMat.uniforms.uTexel.value.set(0,0);run(downMat,previous);renderer.setRenderTarget(null);fadeAt=performance.now();fadeDuration=duration;}

  function dispose() {
    previous?.dispose();
    sharp.dispose(); levels.forEach((rt) => rt.dispose()); if (ping) { ping.dispose(); pong.dispose(); }
    [downMat, blurMat, compMat].forEach((m) => m.dispose()); quadGeo.dispose();
  }

  async function prepare(cancelled = () => false) {
    // Prepare the postprocess shaders before the first visible frame.
    for (const material of [downMat, blurMat, compMat]) {
      if (cancelled()) return;
      quad.material = material;
      await renderer.compileAsync(quadScene, quadCam, cancelled);
    }
  }

  return { setSize, setChrome, setUiFade, jumpPaused, render, dispose, prepare, enableTransitions, crossfade, get enabled() { return enabled; }, get chrome() { return chrome; } };
}
