import { createTravelLoading } from '../src/loading/travelLoadingDrawing'
import { createEchoQuarryScene } from '../src/echoQuarry/echoQuarryScene.js'
import sceneData from '../../../docs/area05/area-05-echo-quarry.scene.json'
import './style.css'
const $=id=>document.getElementById(id)
const loading=createTravelLoading();$('scene').append(loading);
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const scene=await createEchoQuarryScene($('scene'),{authority:(a,b)=>globalThis.echoTrial.request(a,b),reportActivity:t=>$('activity').textContent=t})
loading.remove();
// Only this independent tester exposes its controller for Electron runtime QA.
globalThis.echoTrialScene=scene
sceneData.spots.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.id} · ${s.name}`;$('spot').append(o)})
$('play').onclick=()=>scene.state().playing?scene.pause():scene.play()
$('speed').onchange=()=>scene.speed(Number($('speed').value))
$('time').onchange=()=>scene.time($('time').value)
$('new').onclick=()=>scene.reset()
$('complete').onclick=()=>{if(!scene.complete())$('activity').textContent='請等旅人走出洞口，再試看休息。'}
$('wind').onclick=()=>scene.wind()
$('go').onclick=()=>{if(!scene.go(Number($('spot').value)))$('activity').textContent='這段演出結束後，就能走去其他地點。'}
document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>scene.event(b.dataset.event))
$('echo').onclick=()=>{scene.speed(6);$('speed').value='6';scene.echoScenario();$('activity').textContent='獨立試看：從第二盞燈之後、石磬架附近開始。旅人敲石磬，再依回音與時間預算決定是否進洞。'}
setInterval(()=>{const s=scene.state(),t=Math.floor(s.sim);$('clock').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')} / 50:00`;$('lamps').textContent=Array.from({length:5},(_,i)=>i<s.lamps?'●':'○').join(' ');$('phase').textContent=s.inCave?'共鳴洞':'戶外';$('play').textContent=s.playing?'暫停':'繼續'},200)
addEventListener('beforeunload',()=>scene.destroy())
