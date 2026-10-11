import {useEffect,useRef} from 'react'
import {createGlassNurseryScene,type NurserySceneHandle} from './glassNursery/glassNurseryScene'
import {leaveSceneForLobby} from './cloudRuins/sceneHandoff'
import type {NurserySnapshot,NurseryExit} from '../../shared/area07'
import type {NurseryAudioSettings} from './glassNursery/nurseryAudio'
interface Props {audioSettings?:NurseryAudioSettings;audioActive?:boolean;nursery:NurserySnapshot|null;progressSeconds:number;targetSeconds:number;sessionId:string;nodeId:string;paused:boolean;retainForLobby?:boolean;uiFade?:number;departureElapsedMs:number;departure?:{exit:NurseryExit;durationMs:number}|null;onReady?:()=>void;onDepartureComplete?:()=>void;onActivityChange?:(s:string)=>void;onCinematicChange?:(v:boolean)=>void}
export function GlassNurseryFocusScene(p:Props){
 const host=useRef<HTMLDivElement>(null),scene=useRef<NurserySceneHandle|null>(null),live=useRef(p);live.current=p
 useEffect(()=>{if(!host.current)return;let h:NurserySceneHandle
  try{h=createGlassNurseryScene(host.current,{...p,reportReady:()=>live.current.onReady?.(),reportDepartureComplete:()=>live.current.onDepartureComplete?.(),reportCinematic:v=>live.current.onCinematicChange?.(v),reportActivity:s=>live.current.onActivityChange?.(s)})}
  catch(e){console.error('苗圃畫面無法建立',e);live.current.onReady?.();live.current.onDepartureComplete?.();return}
  scene.current=h
  const sync=()=>{const el=host.current;if(!el)return;const root=el.closest('.focus-active')??el.parentElement!,r=el.getBoundingClientRect();const top=root.querySelector('[data-glass="top"]')?.getBoundingClientRect(),bottom=root.querySelector('[data-glass="bottom"]')?.getBoundingClientRect();h.setChrome({top:top?top.bottom-r.top:0,bottom:bottom?r.bottom-bottom.top:0,cards:[...root.querySelectorAll('[data-glass-card],[data-glass-zone]')].map(e=>{const c=e.getBoundingClientRect();return{x:c.left-r.left,y:c.top-r.top,w:c.width,h:c.height,kind:e.hasAttribute('data-glass-zone')?'zone' as const:'pill' as const}})})}
  const observer=new ResizeObserver(sync);observer.observe(host.current);sync();(window as any).__nurseryScene=h
  return()=>{observer.disconnect();scene.current=null;live.current.onCinematicChange?.(false);if(live.current.retainForLobby&&!live.current.departure)leaveSceneForLobby(h);else h.destroy()}
 },[p.sessionId,p.nodeId])
 useEffect(()=>{if(p.nursery)scene.current?.setNurseryState(p.nursery)},[p.nursery]);useEffect(()=>{scene.current?.setProgress(p.progressSeconds)},[p.progressSeconds]);useEffect(()=>{scene.current?.setPaused(p.paused)},[p.paused]);useEffect(()=>{scene.current?.setUiFade(p.uiFade??1)},[p.uiFade])
 useEffect(()=>{scene.current?.setAudioSettings(p.audioSettings,p.audioActive!==false)},[p.audioSettings,p.audioActive])
 return <div ref={host} className="focus-exploration-game biome-cloud-ruins biome-glass-nursery" aria-label="玻璃苗圃自動探索畫面"/>
}
