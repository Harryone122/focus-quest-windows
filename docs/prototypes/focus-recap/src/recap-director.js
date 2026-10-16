// 結算回顧原型的場景導演：在 藏聲秋谷 正式場景（valley.bundle.js）的作用域裡執行（window.__in），
// 直接控制旅人、鏡頭、燈與洞內事件。對外只提供 globalThis.__R，介面與時間軸由頁面負責。
(() => {
  if (globalThis.__R && globalThis.__R.ready) return 'already';
  const DEG = Math.PI / 180;
  const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = globalThis.__R = { ready: false, lit: 0, mute: false, onSound: null, timers: [], clock: 0 };

  // ---- take over from the scene's own loop: no autonomous wandering, no lamps by the clock, no cave lure ----
  automatic = false;
  clearInterval(watchdog);
  startPlay();
  playing = true; started = true; speed = 6;
  caveVisits = 1; caveLure = null; caveCalling = false; windSim = 0; wind = 0; windFirst = false; bellStrikes = 0;
  TR.lit = 5; TR.done = true;
  lampsDue = () => R.lit;
  audio.cue = (kind, payload) => { if (R.mute) return; try { R.onSound && R.onSound(kind, payload || {}); } catch (e) { console.warn(e); } };
  const SIM = 1800 + 0.5 * DAYLEN;              // 薄暮：燈亮著好看，核心的藍光也最清楚
  sim = SIM; timeMode = 'auto';

  // ---- places ----
  const spotP = (id) => (NAV[id] && NAV[id].tgt) || STAND[id].p;
  const facing = (p, look) => Math.atan2(look[0] - p[0], look[1] - p[1]);
  function standSpot(id) { const p = spotP(id); trav.visible = true; place(p[0], p[1]); TR.hd = facing(p, STAND[id].look); TR.spot = id; TR.sit = 0; TR.mode = 'idle'; TR.dwell = 1e9; TR.why = 'goto'; TR.path = null; }
  function act(id, dwell) { TR.spot = id; TR.mode = 'act'; TR.t = 0; TR.dwell = dwell; }
  function bench() {
    if (inCave) CAVE.leave('visit');
    trav.visible = true; storyDone = null;
    const st = STAND[4]; place(st.p[0], st.p[1]); TR.hd = facing(st.p, st.look);
    TR.spot = 4; TR.mode = 'rest'; TR.sit = 1; TR.why = 'rest'; TR.path = null; TR.done = true; TR.lit = 5;
  }

  // ---- camera (outdoors). In the cave the scene's own cave director keeps the camera. ----
  const SHOTS = {
    home: { c: V3(5.0, -0.5, 5.0), vh: 22.5, yaw: 0, pitch: 0 },
    bench: { c: V3(DK_SEAT[0] + 0.707, groundY(DK_SEAT[0], DK_SEAT[1]) + 0.75, DK_SEAT[1] - 0.707), vh: 6.8, yaw: -10 * DEG, pitch: 2 * DEG },
    fork0: { c: V3(1.4, 0.95, -1.25), vh: 4.9, yaw: 7 * DEG, pitch: 15 * DEG },
    fork1: { c: V3(1.42, 0.92, -1.32), vh: 4.3, yaw: 2 * DEG, pitch: 14 * DEG },
    crag0: { c: V3(1.9, 0, 21.6), vh: 6.6, yaw: -12 * DEG, pitch: 8 * DEG },
    crag1: { c: V3(1.8, 0, 21.7), vh: 5.9, yaw: -16 * DEG, pitch: 8 * DEG },
  };
  { const p = spotP(6); SHOTS.crag0.c.y = groundY(p[0], p[1]) + 0.9; SHOTS.crag1.c.y = SHOTS.crag0.c.y + 0.05; }
  const camCur = { c: SHOTS.bench.c.clone(), vh: SHOTS.bench.vh, yaw: SHOTS.bench.yaw, pitch: SHOTS.bench.pitch };
  let camTw = null;
  const copyShot = (s) => ({ c: s.c.clone(), vh: s.vh, yaw: s.yaw, pitch: s.pitch });
  function camSet(name) { const s = typeof name === 'string' ? SHOTS[name] : name; Object.assign(camCur, copyShot(s)); camTw = null; applyView(0); }
  function camTo(name, dur, kind = 'ease') { const s = typeof name === 'string' ? SHOTS[name] : name; camTw = { a: copyShot(camCur), b: copyShot(s), t: 0, dur: Math.max(0.01, dur), kind }; }
  function applyView(dt) {
    if (camTw) { camTw.t += dt; const u = camTw.t / camTw.dur, k = camTw.kind === 'linear' ? cl(u) : camTw.kind === 'sm' ? sm(u) : ease(u);
      camCur.c.copy(camTw.a.c).lerp(camTw.b.c, k); camCur.vh = Math.exp(lerp(Math.log(camTw.a.vh), Math.log(camTw.b.vh), k));
      camCur.yaw = lerp(camTw.a.yaw, camTw.b.yaw, k); camCur.pitch = lerp(camTw.a.pitch, camTw.b.pitch, k); if (u >= 1) camTw = null; }
    CT.copy(camCur.c); VHU = camCur.vh;
    const asp = innerWidth / innerHeight, s = (VHU / 2) * Math.max(1, (16 / 9) / asp);
    cam.left = -s * asp; cam.right = s * asp; cam.top = s; cam.bottom = -s; cam.updateProjectionMatrix();
    yawOff = camCur.yaw; pitchOff = camCur.pitch; window.__holdCam = true; placeCam();
  }

  // ---- timers on scene time (pause with the loop, cleared by cancel) ----
  function after(sec, fn) { R.timers.push({ at: R.clock + sec, fn }); }
  function runTimers() { for (let i = 0; i < R.timers.length; i++) { const t = R.timers[i]; if (R.clock >= t.at) { R.timers.splice(i--, 1); try { t.fn(); } catch (e) { console.error(e); } } } }

  // ---- the tuning fork (調音叉): hangs on the chime rack, resonates amber when the chime is struck ----
  const rot = CHIME1[2], fX = Math.sin(rot), fZ = Math.cos(rot), lX = Math.cos(rot), lZ = -Math.sin(rot);
  // hangs on a hook on the camera side of the rack's right-hand post
  const FORK_HOME = (() => { const g = window.__chimes && window.__chimes[0]; const p = V3(1.85, 1.29, -2.07); if (g) { g.updateMatrixWorld(true); g.children[1].getWorldPosition(p); } return V3(p.x + 0.075, H(CHIME1[0], CHIME1[1]) + 0.98, p.z + 0.075); })();
  const forkMat = new THREE.MeshLambertMaterial({ color: '#c8b590', emissive: new THREE.Color('#ffae45'), emissiveIntensity: 0 });
  const fork = new THREE.Group();
  { const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 8), forkMat); stem.position.y = -0.1;
    const u = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 6, 14, Math.PI), forkMat); u.rotation.z = Math.PI; u.position.y = -0.035;
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.17, 0.018), forkMat); p1.position.set(-0.036, 0.05, 0);
    const p2 = p1.clone(); p2.position.x = 0.036; const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), forkMat); ring.position.y = -0.175;
    fork.add(stem, u, p1, p2, ring); fork.userData = { p1, p2 }; fork.scale.setScalar(1.6); fork.rotation.y = Math.PI / 4; }
  const forkGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffbe6a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  forkGlow.scale.setScalar(0.9);
  const forkLight = new THREE.PointLight('#ffb35a', 0, 2.6, 2);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: '#ffc979', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  spark.scale.setScalar(0.4);
  out.add(fork, forkGlow, forkLight, spark);
  const F = { res: 0, glow: 0, move: -1, from: V3(0, 0, 0), sparkT: -1, sparkMax: 0.8, sparkScale: 0.4 };
  function forkReset() { fork.visible = true; fork.position.copy(FORK_HOME); fork.scale.setScalar(1.6); F.res = 0; F.glow = 0; F.move = -1; F.sparkT = -1; spark.material.opacity = 0; forkGlow.material.opacity = 0; forkLight.intensity = 0; forkMat.emissiveIntensity = 0; }
  forkReset();
  const _h = V3(0, 0, 0);
  function handPos(v) { v.set(TR.x + Math.sin(TR.hd) * 0.32 + Math.cos(TR.hd) * 0.12, TR.y + 0.86, TR.z + Math.cos(TR.hd) * 0.32 - Math.sin(TR.hd) * 0.12); return v; }
  function fxTick(dt) {
    F.res = Math.max(0, F.res - dt * 0.22);
    const k = F.glow > 0 ? F.glow : F.res;
    forkMat.emissiveIntensity = 1.6 * k;
    const jit = Math.sin(R.clock * 95) * 0.006 * F.res; fork.userData.p1.position.x = -0.036 - jit; fork.userData.p2.position.x = 0.036 + jit;
    if (F.move >= 0) { F.move += dt; const u = sm(F.move / 0.75); handPos(_h); fork.position.copy(F.from).lerp(_h, u); fork.position.y += Math.sin(Math.PI * u) * 0.12; fork.scale.setScalar(1.6 * (1 - 0.65 * u));
      if (F.move >= 0.75) { F.move = -1; fork.visible = false; F.res = 0; startSpark(0.9, 0.42, true); } }
    forkGlow.position.copy(fork.position); forkGlow.material.opacity = 0.75 * k * (fork.visible ? 1 : 0); forkGlow.scale.setScalar(0.7 + 0.5 * k);
    forkLight.position.copy(fork.position); forkLight.intensity = 1.5 * k * (fork.visible ? 1 : 0);
    if (F.sparkT >= 0) { F.sparkT += dt; const u = F.sparkT / F.sparkMax; if (F.sparkBelt) { spark.position.set(TR.x, TR.y + 0.62, TR.z); } spark.material.opacity = 0.85 * Math.sin(Math.PI * cl(u)) * (u < 1 ? 1 : 0); spark.scale.setScalar(F.sparkScale * (1 + 0.6 * u)); if (u >= 1) F.sparkT = -1; }
  }
  function startSpark(dur, scale, belt, at) { F.sparkT = 0; F.sparkMax = dur; F.sparkScale = scale; F.sparkBelt = !!belt; if (at) spark.position.copy(at); }

  // ---- events, full version (as played live in 現場 mode, and in the recap) ----
  R.forkFull = () => {             // 0 → ~5.8 s
    forkReset(); standSpot(1); camSet('fork0'); camTo('fork1', 7.5, 'sm');
    after(0.3, () => act(1, 6.0));                       // reach peaks at 0.3 + 1.36
    after(1.62, () => { actFx(1); });                    // strike: two notes come back
    after(2.05, () => { F.res = 1; audio.cue('fork'); pulse(FORK_HOME.x, FORK_HOME.y + 0.05, FORK_HOME.z, { R: 1.25, r0: 0.05, amp: 0.55, col: '#ffd08a', dur: 1.7, dust: 0 }); });
    after(2.9, () => { F.res = Math.max(F.res, 0.9); pulse(FORK_HOME.x, FORK_HOME.y + 0.05, FORK_HOME.z, { R: 1.0, r0: 0.05, amp: 0.38, col: '#ffd08a', dur: 1.5, dust: 0 }); });
    after(3.5, () => act(1, 3.2));                       // reaches for the fork: peak at 3.5 + 0.73
    after(4.15, () => { F.from.copy(fork.position); F.move = 0; F.glow = 0; });
    return 5.9;
  };
  R.forkSmall = () => {            // 安靜模式・專注中：只留走位、姿勢和一點小光，不運鏡、不發聲、不出聲波
    forkReset(); standSpot(1);
    after(0.3, () => act(1, 6.0));
    after(1.7, () => { startSpark(0.6, 0.32, false, FORK_HOME); fork.visible = false; });
    return 6.0;
  };
  R.whistleOut = () => {           // outdoors at 風孔岩: blows the copper whistle, the crag answers
    standSpot(6); camSet('crag0'); camTo('crag1', 4, 'sm'); SPOT_ANIM[6] = 'call';
    after(0.25, () => act(6, 2.6));
    after(1.05, () => { actFx(6); });
    after(2.2, () => { SPOT_ANIM[6] = 'listen'; act(6, 1e9); });
    return 2.6;
  };
  R.firstFull = () => {           // 藏聲秋谷首訪：敲一下石磬，回來兩個音（story_first_two_notes）
    forkReset(); fork.visible = false; standSpot(1); camSet('fork0'); camTo('fork1', 7, 'sm');
    after(0.3, () => act(1, 6.0));
    after(1.62, () => { actFx(1); });
    after(3.2, () => { SPOT_ANIM[1] = 'listen'; act(1, 1e9); });
    return 5.6;
  };
  R.secondDone = false;
  R.secondEnter = () => {          // 第二次造訪：岩壁裡的聲音「……柴都濕了。」（CAVE.evSecond，走位與運鏡都是正式場景的）
    if (inCave) CAVE.leave('visit');
    storyDone = null; yawOff = 0; pitchOff = 0; R.secondDone = false;
    CAVE.journey('second', 'chime', () => { R.secondDone = true; });
  };
  R.whistleDone = false;
  R.whistleCave = () => { R.whistleDone = false; yawOff = 0; pitchOff = 0; SPOT_ANIM[6] = 'listen'; CAVE.whistleCut(() => { R.whistleDone = true; }); return 4.6; };
  R.coreEnter = () => {            // under black: walk in fast, arrive at the dais, then the scene's own core timeline runs (~9.6 s)
    if (inCave) CAVE.leave('visit');
    stoneOwned = false; storyDone = null; yawOff = 0; pitchOff = 0;
    R.mute = true; CAVE.journey('core', 'chime', () => {});
    let n = 0; while (!(TR.mode === 'act' && TR.spot === 'cv_stone') && n < 1200) { update(1 / 30); sim = SIM; n++; }
    CAVE.setCamNow(); R.mute = false; audio.cue('coreStart', { timelineRate: 1 });
    return n;
  };
  R.coreLeave = () => { if (inCave) CAVE.leave('visit'); storyDone = null; bench(); };
  R.cancel = () => {
    R.timers.length = 0; R.mute = false; camTw = null;
    if (inCave) CAVE.leave('visit');
    storyDone = null; trav.visible = true; SPOT_ANIM[6] = 'listen'; SPOT_ANIM[1] = 'reach'; forkReset(); bench();
    const sub = realDocument.getElementById('caveSub'); if (sub) sub.style.opacity = 0;
  };

  // ---- lamps ----
  R.setLit = (n, instant) => { R.lit = n; if (instant) (window.__lamps || []).forEach((L, i) => { L.level = i < n ? 1 : 0; }); };

  // ---- exports ----
  Object.assign(R, { bench, camSet, camTo, standSpot, after, SHOTS, state: () => ({ inCave, mode: TR.mode, spot: TR.spot, lit: R.lit, clock: R.clock, hd: TR.hd, x: TR.x, z: TR.z }) });

  // ---- our own frame loop ----
  let last = performance.now();
  R.step = (dt) => {
    R.clock += dt;
    if (TR.mode === 'act' && !inCave && TR.t > TR.dwell - dt - 0.08) TR.t = TR.dwell - dt - 0.08;   // hold the end of the gesture, never hand back to the wanderer
    update(dt); sim = SIM; wind = 0; windSim = 0;
    runTimers(); fxTick(dt);
    if (!inCave) applyView(dt);
  };
  R.draw = () => draw();
  function loop(now) {
    const dt = Math.min(R.maxDt || 0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!R.frozen) { R.step(dt); draw(); }
    requestAnimationFrame(loop);
  }
  bench(); R.setLit(5, true); camSet('bench');
  for (let i = 0; i < 30; i++) R.step(1 / 30);
  draw();
  requestAnimationFrame(loop);
  R.ready = true;
  return 'ok';
})();
