import {createGlassNurseryScene} from '../src/glassNursery/glassNurseryScene'
import type {NurseryAudioSettings} from '../src/glassNursery/nurseryAudio'
import motifUrl from '../../../previews/nursery-audio-qa/core_motif_07-preview.wav?url'
import './style.css'
type Choice={id:string;label:string;note?:string}
const groups:Record<string,Choice[]>={
 '日常動作':[{id:'walk',label:'走路與腳步'},{id:'machineWalk',label:'沿育苗機走半圈'},{id:'wipe',label:'擦玻璃'},{id:'potRight',label:'扶正盆栽與撥土'},{id:'valve',label:'轉閥門與噴霧'},{id:'trough',label:'撥水槽的水'},{id:'pool',label:'看積水池'},{id:'tree',label:'抬頭看大樹'},{id:'stairSit',label:'在螺旋梯下坐著'},{id:'lean',label:'空中走道看苗圃'}],
 '故事發現':[{id:'first',label:'首訪 · 澆空苗盤'},{id:'chart',label:'再次造訪 · 摸刻度'},{id:'shard',label:'背銀鏡片 · 手印',note:'這段會切到夜晚；反光與手印保留安靜。'},{id:'leaf',label:'取得壓葉標本'},{id:'mulch',label:'取得護根布'},{id:'core',label:'取得封存種莢',note:'取鑰匙 → 走向鐵籠 → 開鎖與籠門 → 鐘罩抬起／縮小。木琴尚待確認。'}],
 '照料者':[{id:'plant',label:'種下驛站的幼苗'},{id:'transplant',label:'完整移植演出',note:'挖起 → 抱著走 → 種下壓土 → 畫三條刻度 → 澆空苗盤。演出約一分鐘。'}],
 '休息出口':[{id:'rest',label:'跨上轉盤休息',note:'會持續休息，包含寫筆記與抬頭觀看；可隨時暫停或換動作。'},{id:'lamps',label:'依序點亮五盞燈',note:'旅途中點燈保持安靜，可以同時檢查走路與站位。'},{id:'corridor',label:'出口一 · 玻璃連廊'},{id:'cellar',label:'出口二 · 地窖鐵梯'}]
}
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
const settings:NurseryAudioSettings={environmentVolume:35,musicVolume:12,audioMuted:false}
let ready=false,current:Choice|null=null,paused=false,activeGroup='日常動作',previewPlaying=false
const scene=createGlassNurseryScene(el('scene'),{testMode:true,mode:'lobby',progressSeconds:0,targetSeconds:3000,paused:false,audioActive:true,audioSettings:settings,reportActivity:text=>el('caption').textContent=text})
const motif=el<HTMLAudioElement>('motif');motif.src=motifUrl
function updateAudio(){scene.setAudioSettings(settings,!previewPlaying);el('mute').setAttribute('aria-pressed',String(settings.audioMuted));el('mute').textContent=settings.audioMuted?'開啟聲音':'靜音'}
function play(id:string){
 if(!ready)return
 motif.pause();el<HTMLAudioElement>('bgm-preview').pause();previewPlaying=false
 current=Object.values(groups).flat().find(item=>item.id===id)??null;if(!current)return
 paused=false;scene.setPaused(false);updateAudio();scene.qa.testMood(el<HTMLSelectElement>('mood').value)
 scene.qa.testPlay(id,el<HTMLInputElement>('walk-in').checked)
 el('current-name').textContent=current.label;el('note').textContent=current.note??'正常速度播放；暫停會一併停止動畫與音效。'
 el<HTMLButtonElement>('pause').disabled=false;el<HTMLButtonElement>('replay').disabled=false;el('pause').textContent='暫停'
 renderActions()
}
function renderActions(){
 const host=el('actions');host.replaceChildren()
 for(const item of groups[activeGroup]){const b=document.createElement('button');b.textContent=item.label;b.dataset.action=item.id;b.disabled=!ready;b.setAttribute('aria-pressed',String(current?.id===item.id));b.onclick=()=>play(item.id);host.append(b)}
}
for(const name of Object.keys(groups)){const b=document.createElement('button');b.textContent=name;b.setAttribute('aria-pressed',String(name===activeGroup));b.onclick=()=>{activeGroup=name;for(const t of el('tabs').querySelectorAll('button'))t.setAttribute('aria-pressed',String(t===b));renderActions()};el('tabs').append(b)}
renderActions()
el('pause').onclick=()=>{paused=!paused;scene.setPaused(paused);el('pause').textContent=paused?'繼續播放':'暫停'}
el('replay').onclick=()=>{if(current)play(current.id)}
el('mute').onclick=()=>{settings.audioMuted=!settings.audioMuted;motif.muted=!!settings.audioMuted;el<HTMLAudioElement>('bgm-preview').muted=!!settings.audioMuted;updateAudio()}
el<HTMLSelectElement>('mood').onchange=()=>{updateAudio();scene.qa.testMood(el<HTMLSelectElement>('mood').value)}
for(const name of ['environment','music'] as const){el<HTMLInputElement>(name).oninput=()=>{const value=Number(el<HTMLInputElement>(name).value);settings[name==='environment'?'environmentVolume':'musicVolume']=value;el(name+'-value').textContent=value+'%';updateAudio();motif.volume=(settings.musicVolume??0)/100;el<HTMLAudioElement>('bgm-preview').volume=Math.pow((settings.musicVolume??0)/100,1.4)}}
motif.volume=.35
motif.onplay=()=>{el<HTMLAudioElement>('bgm-preview').pause();previewPlaying=true;scene.setPaused(true);updateAudio();el('play-state').textContent='單獨試聽核心木琴'}
motif.onpause=motif.onended=()=>{previewPlaying=false;scene.setPaused(paused);updateAudio()}
el<HTMLInputElement>('short-gaps').onchange=()=>scene.setShortMusicGaps(el<HTMLInputElement>('short-gaps').checked)
for(const value of [12,25])el('music-'+value).onclick=()=>{el<HTMLInputElement>('music').value=String(value);el<HTMLInputElement>('music').dispatchEvent(new Event('input'))}
for(const name of ['a','b','ab','c']){const b=document.createElement('button');b.textContent='單獨試聽 '+name.toUpperCase();b.onclick=()=>{motif.pause();scene.setPaused(true);const preview=el<HTMLAudioElement>('bgm-preview');preview.src=new URL(Object.entries(import.meta.glob('../src/glassNursery/audio/bgm_*.wav',{eager:true,query:'?url',import:'default'})).find(([p])=>p.endsWith('bgm_'+name+'.wav'))![1] as string,location.href).href;preview.volume=Math.pow((settings.musicVolume??0)/100,1.4);preview.muted=!!settings.audioMuted;void preview.play()};el('bgm-buttons').append(b)}
const bgmPreview=el<HTMLAudioElement>('bgm-preview');bgmPreview.onplay=()=>{previewPlaying=true;scene.setPaused(true);updateAudio()};bgmPreview.onpause=bgmPreview.onended=()=>{previewPlaying=false;scene.setPaused(paused);updateAudio()}
el('bgm-mix').onclick=()=>{bgmPreview.pause();motif.pause();previewPlaying=false;paused=false;scene.setPaused(false);updateAudio();scene.auditionBgm(el<HTMLSelectElement>('mood').value.includes('Night')||el<HTMLSelectElement>('mood').value==='night'?'bgm_c':'bgm_a');el('pause').removeAttribute('disabled')}
const timer=setInterval(()=>{
 const s=scene.qa.testState()
 if(!ready){el('load-detail').textContent=`正在準備畫面與音效 · ${s.audio?.loaded??0} / 48`;if(s.ready&&s.audio?.loaded===48){ready=true;el('loading').hidden=true;renderActions();el('load-detail').textContent='準備完成'}}
 el('bgm-state').textContent=s.audio?.bgm?`正在播放 ${s.audio.bgm.name} · 剩 ${Math.ceil(s.audio.bgm.remaining)} 秒`:`環境音留白 · 約 ${Math.max(0,Math.ceil((s.audio?.nextMusicAt??0)-(s.audio?.musicClock??0)))} 秒後選曲`
 const sec=Math.floor(s.elapsed);el('elapsed').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`
 if(!previewPlaying)el('play-state').textContent=paused?'已暫停':current?s.finished?'播放完成，可重播或換一段':s.moving?'旅人正在移動':'動畫播放中':'選一段動作，開始試看'
},100)
window.addEventListener('beforeunload',()=>{clearInterval(timer);scene.destroy()})
Object.assign(window,{__nurseryAudioTester:{scene,play,groups,state:()=>({current,settings,...scene.qa.testState(),ready})}})
