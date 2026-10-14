"""Reproduce the Area 05 renderer port; leave the handed-off prototype untouched."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
source = (root / 'docs/prototypes/echo-valley.html').read_text(encoding='utf-8')
s = source.split('<script>')[1].split('</script>')[0]
s = s.replace("const VIEW = (location.hash || '#outdoor').slice(1);", '')
s = s.replace('const VW = innerWidth, VH = innerHeight, aspect = VW / VH;', 'let innerWidth=host.clientWidth, innerHeight=host.clientHeight; const VW=innerWidth, VH=innerHeight, aspect=VW/VH;')
s = s.replace('const Q = new URLSearchParams(location.search);', 'const Q = new URLSearchParams();')
# Remove the prototype panels and controls, keeping only scene overlays.
a = s.index('const hud = document.createElement'); b = s.index('/* ---------- main update ---------- */', a)
s = s[:a] + """
const $ = id => document.getElementById(id), statusEl=$('status');
const fadeEl=document.createElement('div'); fadeEl.style.cssText='position:absolute;inset:0;background:#05080a;opacity:0;pointer-events:none;z-index:5';document.body.appendChild(fadeEl);
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s)%60).padStart(2,'0');
function startPlay(){playing=true;if(!started){started=true;place(...NAV[startSpot].tgt);TR.hd=0;TR.mode='idle';TR.dwell=.6;say('旅人從瀑布邊的木棧道走上來。');}}
function resetAll(){if(inCave)CAVE.leave('visit'); CAVE.reset(); sim=0;tAcc=0;TR.lit=0;TR.done=false;TR.recent=[];TR.leave=[];TR.spot=0;TR.goal=null;TR.why='wander';TR.mode='idle';TR.dwell=.4;started=false;playing=false;windSim=0;wind=0;bellStrikes=0;windFirst=true;caveLure=null;caveCalling=false;caveVisits=0;fade=null;fadeEl.style.opacity=0;pendingEvent=null;storyDone=null;place(...NAV[startSpot].tgt);}
function goSpot(id, rest){if(inCave||pendingEvent||TR.why==='cave')return false;const pa=planTo(id);if(!pa)return false;startPlay();startWalk(pa,id,rest?'rest':'goto');return true;}
const dots=[];
""" + s[b:]
a=s.index('const clk = new THREE.Clock()'); s=s[:a] # Drop __quarry, QA URL branches and prototype timers.
# Isolate all former globals in this scene instance.
header="""import { advanceAnimation } from '../animationSteps';
import { advanceBellPendulum } from './bellPendulum';
import { createTravelLoading } from '../loading/travelLoadingDrawing';
import * as ThreeLib from '../cloudRuins/vendor/three.module.js';
// Area 05 v10 geometry, materials, routes and animation port. No prototype panel or global test API.
export async function createEchoQuarryScene(host, opts) {
const THREE=ThreeLib;
const window={}, realDocument=globalThis.document, nodes=new Map(), listeners=[];
let dead=false, raf=0, lastFrameAt=performance.now(), pendingEvent=null, storyDone=null, stoneOwned=false;
const document={createElement:realDocument.createElement.bind(realDocument),body:host,getElementById(id){if(!nodes.has(id)){const el=realDocument.createElement('div');el.id=id;nodes.set(id,el);}return nodes.get(id);}};
const addEventListener=(type,fn)=>{globalThis.addEventListener(type,fn);listeners.push([type,fn]);};
function backend(action,payload={}){return opts.authority?.(action,payload);}
window.__seededRand=()=>backend('random');
"""
s=s.replace("function say(t) { statusEl.textContent = t;", "function say(t) { statusEl.textContent = t; opts.reportActivity?.(t);")
s=s.replace("function resizeAll() { const w = innerWidth, h = innerHeight, asp = w / h;", "function resizeAll() { innerWidth=host.clientWidth;innerHeight=host.clientHeight;const w=innerWidth,h=innerHeight,asp=w/h;")
s=s.replace("const rate = () => speed / 6;", "const rate = () => speed / 6;")
# Authoritative visit eligibility and randomness live in the isolated Electron main process.
a=s.index('function caveOK('); b=s.index('const SOUND_OF',a)
s=s[:a]+"""function lampFromMouthEff(){const k=Math.min(4,Math.floor(sim/600)),saved={x:TR.x,z:TR.z,leave:TR.leave};const p=caveAxis(1);TR.x=p[0];TR.z=p[1];TR.leave=[];const route=planToXZ(...LAMPNODE[k].p);Object.assign(TR,saved);return route?plen(route)/V_WALK*speed/rate()+13.2:Infinity;}
function budget(walkEff=0){return {now:sim,walkToMouth:walkEff,walkToLamp:lampFromMouthEff(),resting:TR.done||TR.lit>=5};}
function caveOK(walkEff=0){return !inCave&&!pendingEvent&&!!backend('fits',budget(walkEff));}
"""+s[b:]
s=s.replace("if (SOUND_OF[id] && caveVisits < 1) caveLure = { kind: SOUND_OF[id], at: tAcc };", "if(SOUND_OF[id] && !caveCalling && caveVisits<1){backend('sound',{kind:SOUND_OF[id]});caveLure={kind:SOUND_OF[id],at:tAcc};}")
s=s.replace('tAcc - caveLure.at > 4 && !inCave)', "tAcc - caveLure.at > 4 && !inCave && backend('mouth'))")
a=s.index('  if (caveCalling && REACH[12]',s.index('function pickNext')); b=s.index('  const cands',a)
s=s[:a]+"  if(caveCalling&&REACH[12]&&TR.spot!==12&&!pendingEvent){const pa=planTo(12);if(pa&&backend('choose',budget(plen(pa)/V_WALK*speed/rate())))return 12;}\n"+s[b:]
s=s.replace("if (g === 12 && caveCalling && (caveOK() || TR.forceCave))", "if(g===12&&(pendingEvent||(caveCalling&&backend('arrive',budget()))))")
s=s.replace("CAVE.visit(TR.caveKind || 'chime', () => {", "CAVE.journey(pendingEvent||'echo', TR.caveKind||'chime', () => {")
s=s.replace("if (g === 'caveOut') { TR.mode", "if(g==='caveOut'){pendingEvent=null;backend('finished');TR.mode")
# All story entries and exits use authored cave routes; core no longer teleports to J.
s=s.replace("function resetCave() { tl = null; busy = ''; stoneHere = true; VS.visible = true;", "function resetCave() { tl = null; busy = ''; ascend=0;shrinkT=-1;stoneHere=!stoneOwned;VS.visible=stoneHere;")
s=s.replace("resetCave(); busy = 'second'; standAt('E0'", "resetCave(); busy = 'second'; standAt('E1'")
s=s.replace("walk(ROUTE_IN, () => { act('cv_look', 2.4)", "walk(ROUTE_IN.slice(1), () => { act('cv_look', 2.4)")
s=s.replace("busy = ''; say('旅人在封住的牆前站了很久。');", "busy='';say('旅人在封住的牆前站了很久。');if(storyDone)walk([...ROUTE_WALL].reverse().concat([...ROUTE_IN].reverse().slice(1,-1)),finishStory);")
s=s.replace("if (!stoneHere) resetCave(); resetCave(); busy = 'core'; standAt('J', [NODES.B3[0], NODES.B3[1]]);", "stoneOwned=false;resetCave();busy='core';standAt('E1',[NODES.L0[0],NODES.L0[1]]);")
s=s.replace("walk(ROUTE_STONE, () =>", "walk(ROUTE_IN.slice(1).concat(ROUTE_STONE.slice(1)), () =>")
s=s.replace("stoneHere = false; VS.visible = false; ascend = 0;", "stoneHere=false;stoneOwned=true;VS.visible=false;ascend=0;")
s=s.replace("act('cv_look', 1e9); busy = ''; }]]); }); }", "act('cv_look',1e9);busy='';if(storyDone)walk([...ROUTE_STONE].reverse().concat([...ROUTE_IN].reverse().slice(1,-1)),finishStory);}]]);});}")
# A whistle is a remote visual cut; traveller stays at the outdoor wind-hole rock.
s=s.replace("camTo(HOME, 0.8); busy = ''; }]]); }", "camTo(HOME,.8);busy='';if(storyDone)finishStory();}]]);}")
insert="""
  function finishStory(){const f=storyDone;storyDone=null;if(f)f();}
  function journey(kind,sound,done){if(kind==='echo'){visit(sound,done);return;}enter('visit');visiting=true;storyDone=done;if(kind==='core')evCore();else evSecond();}
  function whistleCut(done){enter('visit');visiting=false;trav.visible=false;storyDone=()=>{trav.visible=true;leave();done?.();};evWhistle();}
"""
s=s.replace('  return { visit, isVisiting:', insert+'  return { journey, whistleCut, visit, isVisiting:')
# Pause every visual clock and overlay expiry, including fade and shader animation.
s=re.sub(r"function sub\(t, dur\) \{.*?\n", "function sub(t,dur){subEl.textContent=t;subEl.style.opacity=1;sub.until=dur?tAcc+dur:Infinity;}\n",s)
s=re.sub(r"function toast\(t\) \{.*?\n", "function toast(t){toastEl.innerHTML=t;toastEl.style.opacity=1;toast.until=tAcc+5.2;}\n",s)
s=s.replace('    const T = tAcc;', "    const T=tAcc;if(tAcc>=sub.until)subEl.style.opacity=0;if(tAcc>=toast.until)toastEl.style.opacity=0;")
s=s.replace("  tAcc += dt; const visitNow", "  if(!playing)dt=0; tAcc+=dt; const w=playing?backend('wind',{now:sim}):null;if(w&&sim-w.at<60){startWind(w.first);windSim=60-(sim-w.at);}const visitNow")
s=s.replace("if (playing && (!inCave || visitNow)) { sim += dt * speed; }", "if(playing){sim=Math.min(3000,sim+dt*speed);}")
# Continuous bell strokes and short, pause-aware cave transitions.
s=s.replace("st.cool -= dt; if (st.queue > 0 && st.cool <= 0 && Math.abs(st.th) < 0.05 && Math.abs(st.v) < 0.3) { st.queue--; st.cool = 2.6; st.th = 0.5; st.v = 0; }", "advanceBellPendulum(st,dt,DROP,HIT,strike);")
s=s.replace("    st.v += (-9.81 / DROP * Math.sin(st.th) - 0.35 * st.v) * dt; st.th += st.v * dt;\n    if (st.th <= -HIT && st.v < 0) { const k = Math.min(1, Math.abs(st.v) / 1.4); st.th = -HIT; st.v = -st.v * 0.35; if (k > 0.2) strike(0.55 + 0.45 * k); }", "")
s=s.replace("function update(dt) {\n  if(!playing)", "function update(dt,fadeDt=dt) {\n  if(!playing)fadeDt=0;\n  if(!playing)")
s=s.replace("fade.t += dt; const u = Math.min(1, fade.t / 0.7);", "fade.t += fadeDt; const u = Math.min(1, fade.t / (fade.k==='out'?.28:.36));")
s=s.replace("  ambient(dt);", "  travelLoader.hidden=!fade;travelLoader.dataset.paused=String(!playing);\n  ambient(dt);")
s=s.replace("document.body.appendChild(fadeEl);", "document.body.appendChild(fadeEl);const travelLoader=createTravelLoading();travelLoader.hidden=true;document.body.appendChild(travelLoader);")
# Draw both camera passes to a temporary target before the first visit, while the outdoor scene stays displayed.
s=s.replace("  return { journey,", """  async function warm(){const oldParent=trav.parent,oldCT=CT.clone(),oldVH=VHU,oldOut=out.visible,oldG=G.visible;const target=new THREE.WebGLRenderTarget(8,8);try{out.visible=false;G.visible=true;G.add(trav);Object.assign(camC,HOME);placeCaveCam();placeCam();await renderer.compileAsync(scene,cam);renderReflection();renderer.setRenderTarget(target);renderer.render(scene,cam);}finally{renderer.setRenderTarget(null);target.dispose();oldParent.add(trav);out.visible=oldOut;G.visible=oldG;CT.copy(oldCT);VHU=oldVH;resizeAll();placeCam();}}
  return { warm, journey,""")
# Stop fade-in completion from discarding a newly started outgoing fade.
footer="""
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
function state(){return {sim,lamps:lampsDue(),playing,speed,mode:TR.mode,spot:TR.spot,goal:TR.goal,position:[TR.x,TR.y,TR.z],bell:{angle:BELL.st.th,velocity:BELL.st.v,rung:BELL.st.rung,queue:BELL.st.queue},transition:fade?{kind:fade.k,opacity:Number(fadeEl.style.opacity)}:null,caveWarmMs,inCave,visits:caveVisits,pendingEvent,stoneOwned,cave:CAVE.state(),status:statusEl.textContent,reach:{...REACH}};}
automatic=false;reset();applyLook(1);update(.001);draw();const warmAt=performance.now();await CAVE.warm();const caveWarmMs=performance.now()-warmAt;draw();lastFrameAt=performance.now();automatic=true;raf=requestAnimationFrame(frame);
return {state,reset,event,echoScenario,automatic(value){automatic=!!value;lastFrameAt=performance.now();},pause(){playing=false;},play:startPlay,speed(v){if([1,6,20,60].includes(v))speed=v;},time(m){if(['auto','dawn','day','dusk','night'].includes(m)){timeMode=m;lookInit=false;}},go:goSpot,
wind(){startWind(windFirst);},complete(){if(inCave||pendingEvent||remoteWhistle||TR.why==='cave')return false;sim=3000;TR.lit=5;TR.done=false;TR.mode='idle';decide();return true;},
// Explicit test entry points, confined to the independent tester, never published as window.__quarry.
qa(name){return qaChecks[name]();},
advance(sec){for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);draw();},setTime(sec){sim=sec;TR.lit=lampsDue();},
destroy(){dead=true;cancelAnimationFrame(raf);clearInterval(watchdog);observer.disconnect();listeners.forEach(([t,f])=>globalThis.removeEventListener(t,f));scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.filter(Boolean).forEach(m=>m.dispose());});renderer.dispose();host.replaceChildren();}};
}
}
"""
s=s.replace("TR.mode = 'act'; TR.t = 0; TR.dwell", "if(g===6&&remoteWhistle){remoteWhistle=false;TR.mode='act';TR.spot=6;TR.t=0;TR.dwell=1e9;actFx(6);fade={k:'out',t:0,then:()=>{CAVE.whistleCut(()=>{fade={k:'in',t:0};TR.mode='idle';TR.dwell=.6;});fade={k:'in',t:0};}};return;}TR.mode = 'act'; TR.t = 0; TR.dwell",1)
qa="const qaChecks={};\n"
for name in ['occlusion-all.js','cave-mouth-tunnel.js','cave-route-clearance.js']:
    body=(root/'docs/area05/qa'/name).read_text(encoding='utf-8').replace('(()=>{','return (()=>{',1)
    qa += f"qaChecks['{name}']=function(){{const __quarry={{TR,M_BELL:BELL,yAt,nav:NAV,cave:{{enter:()=>CAVE.enter(),run(sec){{for(let i=0;i<Math.ceil(sec*30);i++)update(1/30);}},M:CAVE}}}};\n{body}\n}};\n"
qa += "qaChecks['water-flow']=function(time){\n  riverMat.uniforms.uTime.value=time;\n  curtains.forEach(m=>{m.uniforms.uTime.value=time;});\n  draw();\n  const p=riverMesh.geometry.attributes.position;let maxJoinGap=0;\n  for(let i=0;i+6<p.count;i+=6)for(const [a,b] of [[i+2,i+6],[i+4,i+7]]){\n    maxJoinGap=Math.max(maxJoinGap,Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b)));\n  }\n  return {time,maxJoinGap};\n};\n"
footer=footer.replace('qa(name){return qaChecks[name]();}', 'qa(name,...args){return qaChecks[name](...args);}')
qa += "qaChecks['water-lip']=function(close){\n  if(close){qaChecks.lipCamera={ct:CT.clone(),vh:VHU};CT.set(FW.fx,FW.fy-1,FW.fz);VHU=5;}\n  else if(qaChecks.lipCamera){CT.copy(qaChecks.lipCamera.ct);VHU=qaChecks.lipCamera.vh;}\n  resizeAll();placeCam();draw();\n  const terrain=out.children.find(c=>c.isMesh&&c.geometry.attributes.color&&c.geometry.attributes.position.count>100000);\n  const ray=new THREE.Raycaster(),p=riverMesh.geometry.attributes.position;let exposed=0,samples=0,maxBed=-Infinity;\n  for(let i=p.count-60;i<p.count;i++){\n    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);ray.set(new THREE.Vector3(x,y+2,z),new THREE.Vector3(0,-1,0));\n    const hit=ray.intersectObject(terrain,false)[0];if(hit){maxBed=Math.max(maxBed,hit.point.y-y);if(hit.point.y>=y-.03)exposed++;}samples++;\n  }\n  const end=RIVER[RIVER.length-1];\n  return {exposed,samples,maxBed,lipWidth:riverWidth(5)*2,curtainWidth:3.5,lipCenterGap:Math.hypot(end[0]-FW.fx,end[1]-FW.fz)};\n};\n"
footer=footer.replace('reset();applyLook(1);',qa+'reset();applyLook(1);')
out=root/'src/renderer/src/echoQuarry';out.mkdir(exist_ok=True)
# Preserve the accepted river-mouth fix when reproducing the renderer port.
s=s.replace('const topAt = (x, z) => H(x, z);', '''const topAt = (x, z) => H(x, z);
// Keep the rendered riverbed below the centreline water sheet, including the lip.
// A grid-cell margin prevents interpolated bank triangles from piercing the water.
function riverbedHeight(x, z) {
  const height = H(x, z), [distance, along] = riverDist(x, z);
  const width = 0.5 + along * 0.13, margin = 0.5;
  if (distance >= width + margin) return height;
  const k = Math.min(RIVER.length - 2, Math.floor(along)), t = along - k;
  const a = RIVER[k], b = RIVER[k + 1];
  const bed = H(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) + 0.12;
  const blend = Math.max(0, Math.min(1, (width + margin - distance) / 0.25));
  return height - Math.max(0, height - bed) * blend;
}''')
s=s.replace('hg[i][j] = H(X0 + i * S, Z0 + j * S);', 'hg[i][j] = riverbedHeight(X0 + i * S, Z0 + j * S);')
# Keep river joins and long-session water flow smooth.
s=s.replace('    const V = [], F = []; let SS = 0; for (let i = 0; i < pts.length - 1; i++) { const [x0, z0, t0] = pts[i], [x1, z1, t1] = pts[i + 1]; const tx = x1 - x0, tz = z1 - z0, L = Math.hypot(tx, tz), nx_ = -tz / L, nz_ = tx / L;\n      const w0 = 0.5 + t0 * 0.13, w1 = 0.5 + t1 * 0.13, y0 = H(x0, z0) + 0.32, y1 = H(x1, z1) + 0.32;\n      const a1 = [x0 + nx_ * w0, y0, z0 + nz_ * w0], b1 = [x0 - nx_ * w0, y0, z0 - nz_ * w0], c1 = [x1 + nx_ * w1, y1, z1 + nz_ * w1], d1 = [x1 - nx_ * w1, y1, z1 - nz_ * w1];\n', '    // Adjacent strips share their cross-section at bends: no overlapping triangles.\n    const edges = pts.map(([x, z, t], i) => {\n      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];\n      const dx = next[0] - prev[0], dz = next[1] - prev[1], L = Math.hypot(dx, dz);\n      const w = 0.5 + t * 0.13, y = H(x, z) + 0.32;\n      return [[x - dz / L * w, y, z + dx / L * w], [x + dz / L * w, y, z - dx / L * w]];\n    });\n    const V = [], F = []; let SS = 0; for (let i = 0; i < pts.length - 1; i++) {\n      const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);\n      const [a1, b1] = edges[i], [c1, d1] = edges[i + 1];\n')
s=s.replace('void main(){ float s = vF.x, sd = vF.y; float rap = smoothstep(uLen - 4.5, uLen, s); float sp = 0.9 + 2.2 * rap;\n  float n = vn(vec2(sd * 2.2 + 3., s * 1.1 - uTime * sp)) * 0.6 + vn(vec2(sd * 4.7, s * 2.6 - uTime * sp * 1.3) + 7.) * 0.4;\n  float st = smoothstep(0.66, 0.92, vn(vec2(sd * 7. + s * 0.15, s * 3.0 - uTime * sp * 1.8)));\n', 'void main(){ float s = vF.x, sd = vF.y; float rap = smoothstep(uLen - 7., uLen, s);\n  // Fixed advection keeps spatial frequency stable even after a full exploration.\n  float n = vn(vec2(sd * 2.2 + 3., s * 1.1 - uTime * 0.9)) * 0.6 + vn(vec2(sd * 4.7, s * 2.6 - uTime * 1.17) + 7.) * 0.4;\n  float st = smoothstep(0.66, 0.92, vn(vec2(sd * 7. + s * 0.15, s * 3.0 - uTime * 1.62)));\n')
# Align the entire river mouth with the waterfall curtain, not just the centreline.
s=s.replace('const RIVER = [[-19, 9.4], [-14.5, 10.3], [-10.0, 11.5], [-5.7, 12.6], [-2.0, 13.1], [12 + Math.cos(FALL_TH) * (rimR(FALL_TH) + 0.05), 12 + Math.sin(FALL_TH) * (rimR(FALL_TH) + 0.05)]]; // the river reaches the rim level and drops straight off the cliff edge\n', 'const RIVER = [[-19, 9.4], [-14.5, 10.3], [-10.0, 11.5], [-5.7, 12.6], [-2.0, 13.1], [12 + Math.cos(FALL_TH) * rimR(FALL_TH), 12 + Math.sin(FALL_TH) * rimR(FALL_TH)]]; // river and curtain share the same lip\nfunction riverLipBlend(along) { const t=Math.max(0,Math.min(1,(along-4.35)/0.65));return t*t*(3-2*t); }\nfunction riverWidth(along) { const blend=riverLipBlend(along);return (0.5+along*0.13)*(1-blend)+1.75*blend; }\n')
s=s.replace('const width = 0.5 + along * 0.13, margin = 0.5;', 'const width = riverWidth(along), margin = 0.75;')
s=s.replace(') + 0.12;\n  const blend', ') - 0.25;\n  const blend')
s=s.replace('      const w = 0.5 + t * 0.13, y = H(x, z) + 0.32;\n      return [[x - dz / L * w, y, z + dx / L * w], [x + dz / L * w, y, z - dx / L * w]];', '      const w = riverWidth(t), y = H(x, z) + 0.32, blend=riverLipBlend(t);\n      const nx=(-dz/L)*(1-blend)+Math.sin(FALL_TH)*blend, nz=(dx/L)*(1-blend)-Math.cos(FALL_TH)*blend;\n      const N=Math.hypot(nx,nz);\n      return [[x + nx/N*w, y, z + nz/N*w], [x - nx/N*w, y, z - nz/N*w]];')
s=s.replace('    if (CUTZ(cx - 0.6', '    const [channelDistance,channelAlong]=riverDist(cx,cz);\n    // The spillway is bare riverbed rock, including terrain seen through the curtain.\n    if(channelAlong>4.35&&channelDistance<riverWidth(channelAlong)+0.5&&cy<0.7) col=ROCK.clone();\n    else if (CUTZ(cx - 0.6')
# User correction: preserve narrow river; hide cliff behind opaque blue falling water.
s=s.replace('function riverLipBlend(along) { const t=Math.max(0,Math.min(1,(along-4.35)/0.65));return t*t*(3-2*t); }\nfunction riverWidth(along) { const blend=riverLipBlend(along);return (0.5+along*0.13)*(1-blend)+1.75*blend; }\n', 'function riverWidth(along) { return 0.5+along*0.13; }\n')
s=s.replace('function riverbedHeight(x, z) {\n  const height = H(x, z), [distance, along] = riverDist(x, z);\n  const width = riverWidth(along), margin = 0.75;\n  if (distance >= width + margin) return height;\n  const k = Math.min(RIVER.length - 2, Math.floor(along)), t = along - k;\n  const a = RIVER[k], b = RIVER[k + 1];\n  const bed = H(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) - 0.25;\n  const blend = Math.max(0, Math.min(1, (width + margin - distance) / 0.25));\n  return height - Math.max(0, height - bed) * blend;\n}\n', 'function riverbedHeight(x, z) {\n  const height = H(x, z), [distance, along] = riverDist(x, z);\n  const width = riverWidth(along), margin = 0.5;\n  if (distance >= width + margin) return height;\n  const k = Math.min(RIVER.length - 2, Math.floor(along)), t = along - k;\n  const a = RIVER[k], b = RIVER[k + 1];\n  const bed = H(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) - 0.25;\n  const blend = Math.max(0, Math.min(1, (width + margin - distance) / 0.25));\n  return height - Math.max(0, height - bed) * blend;\n}\n')
s=s.replace('    const [channelDistance,channelAlong]=riverDist(cx,cz);\n    // The spillway is bare riverbed rock, including terrain seen through the curtain.\n    if(channelAlong>4.35&&channelDistance<riverWidth(channelAlong)+0.5&&cy<0.7) col=ROCK.clone();\n    else if (CUTZ(cx - 0.6, cz) || CUTZ(cx + 0.6, cz) || CUTZ(cx, cz - 0.6) || CUTZ(cx, cz + 0.6) ? (cy > 1.62 && ny < 0.62) : false) col = CUTC.clone(); // every steep face along the cut edge takes the sawn-stone colour (no alternating teeth)\n', '    if (CUTZ(cx - 0.6, cz) || CUTZ(cx + 0.6, cz) || CUTZ(cx, cz - 0.6) || CUTZ(cx, cz + 0.6) ? (cy > 1.62 && ny < 0.62) : false) col = CUTC.clone(); // every steep face along the cut edge takes the sawn-stone colour (no alternating teeth)\n')
s=s.replace('      const w = riverWidth(t), y = H(x, z) + 0.32, blend=riverLipBlend(t);\n      const nx=(-dz/L)*(1-blend)+Math.sin(FALL_TH)*blend, nz=(dx/L)*(1-blend)-Math.cos(FALL_TH)*blend;\n      const N=Math.hypot(nx,nz);\n      return [[x + nx/N*w, y, z + nz/N*w], [x - nx/N*w, y, z - nz/N*w]];', '      const w = riverWidth(t), y = H(x, z) + 0.32;\n      return [[x - dz/L*w, y, z + dx/L*w], [x + dz/L*w, y, z - dx/L*w]];')
s=s.replace('curtain(3.5, -0.05, 0, 0.75, 0.95, 1.3); curtain(3.0, 0.14, 0.1, 0.95, 1.12, 4.7); curtain(1.7, 0.34, 0.55, 0.7, 1.3, 8.1); curtain(1.1, 0.42, -0.85, 0.6, 1.22, 2.9);\n\n', "curtain(3.5, -0.05, 0, 0.75, 0.95, 1.3); curtain(3.0, 0.14, 0.1, 0.95, 1.12, 4.7); curtain(1.7, 0.34, 0.55, 0.7, 1.3, 8.1); curtain(1.1, 0.42, -0.85, 0.6, 1.22, 2.9);\n// Opaque blue water behind the original white sheets hides the cliff through their gaps.\n// Follow the falling water's arc; keep the authored river width unchanged.\nconst fallBacking=curtain(3.5,-0.10,0,1,0.95,1.3);\nfallBacking.renderOrder=1;\nfallBacking.material.transparent=false;\nfallBacking.material.depthWrite=true;\nfallBacking.material.fragmentShader=NOISE_GLSL+`\nvarying vec2 vUv; uniform float uTime; uniform vec3 uTint;\nvoid main(){\n  float flow=vn(vec2(vUv.x*10.,vUv.y*18.-uTime*1.8));\n  vec3 blue=mix(vec3(0.27,0.46,0.52),vec3(0.42,0.62,0.66),0.3+0.35*flow);\n  gl_FragColor=vec4(blue*uTint,1.);\n}`;\nfallBacking.material.needsUpdate=true;\n\n")
footer=footer.replace('curtainWidth:3.5,lipCenterGap:', 'curtainWidth:3.5,opaqueBacking:!fallBacking.material.transparent&&fallBacking.material.depthWrite,lipCenterGap:')
(out/'echoQuarryScene.js').write_text(header+s+footer,encoding='utf-8')
import importlib.util
audio_spec=importlib.util.spec_from_file_location('wire_area05_audio',root/'scripts/wire-area05-audio.py')
audio_wire=importlib.util.module_from_spec(audio_spec);audio_spec.loader.exec_module(audio_wire)
audio_wire.wire(out/'echoQuarryScene.js')
