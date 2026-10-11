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
header="""import { advanceBellPendulum } from './bellPendulum';
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
s=s[:a]+"""function lampFromMouthEff(){const k=Math.min(4,Math.floor(sim/600)),saved={x:TR.x,z:TR.z,leave:TR.leave};const p=caveAxis(1);TR.x=p[0];TR.z=p[1];TR.leave=[];const route=planToXZ(...LAMPNODE[k].p);Object.assign(TR,saved);return route?plen(route)/V_WALK*6+13.2:Infinity;}
function budget(walkEff=0){return {now:sim,walkToMouth:walkEff,walkToLamp:lampFromMouthEff(),resting:TR.done||TR.lit>=5};}
function caveOK(walkEff=0){return !inCave&&!pendingEvent&&!!backend('fits',budget(walkEff));}
"""+s[b:]
s=s.replace("if (SOUND_OF[id] && caveVisits < 1) caveLure = { kind: SOUND_OF[id], at: tAcc };", "if(SOUND_OF[id] && !caveCalling && caveVisits<1){backend('sound',{kind:SOUND_OF[id]});caveLure={kind:SOUND_OF[id],at:tAcc};}")
s=s.replace('tAcc - caveLure.at > 4 && !inCave)', "tAcc - caveLure.at > 4 && !inCave && backend('mouth'))")
a=s.index('  if (caveCalling && REACH[12]',s.index('function pickNext')); b=s.index('  const cands',a)
s=s[:a]+"  if(caveCalling&&REACH[12]&&TR.spot!==12&&!pendingEvent){const pa=planTo(12);if(pa&&backend('choose',budget(plen(pa)/V_WALK*6)))return 12;}\n"+s[b:]
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
function tick(){const now=performance.now(),elapsed=Math.max(0,(now-lastFrameAt)/1000),dt=Math.min(.05,elapsed);lastFrameAt=now;update(dt,Math.min(.25,elapsed));draw();}
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
footer=footer.replace('reset();applyLook(1);',qa+'reset();applyLook(1);')
out=root/'src/renderer/src/echoQuarry';out.mkdir(exist_ok=True)
(out/'echoQuarryScene.js').write_text(header+s+footer,encoding='utf-8')
