import { observeFocusChrome } from './cloudRuins/observeFocusChrome'
import {useEffect,useRef,useState} from 'react'
import {createGlassNurseryScene,type NurserySceneHandle} from './glassNursery/glassNurseryScene'
import {leaveSceneForLobby} from './cloudRuins/sceneHandoff'
import type {NurserySnapshot,NurseryExit} from '../../shared/area07'
import type {NurseryAudioSettings} from './glassNursery/nurseryAudio'
interface Props {quietFocus?:boolean;audioSettings?:NurseryAudioSettings;audioActive?:boolean;nursery:NurserySnapshot|null;progressSeconds:number;targetSeconds:number;sessionId:string;nodeId:string;paused:boolean;retainForLobby?:boolean;uiFade?:number;departureElapsedMs:number;departure?:{exit:NurseryExit;durationMs:number}|null;onReady?:()=>void;onDepartureComplete?:()=>void;onActivityChange?:(s:string)=>void;onCinematicChange?:(v:boolean)=>void}
export function GlassNurseryFocusScene(p:Props){
 const host=useRef<HTMLDivElement>(null),scene=useRef<NurserySceneHandle|null>(null),live=useRef(p);live.current=p
 const [failed,setFailed]=useState(false)
 useEffect(()=>{if(!host.current)return;let h:NurserySceneHandle
  try{h=createGlassNurseryScene(host.current,{...p,reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches,reportReady:()=>{if(host.current)host.current.dataset.sceneReady='true';live.current.onReady?.()},reportDepartureComplete:()=>live.current.onDepartureComplete?.(),reportCinematic:v=>live.current.onCinematicChange?.(v),reportActivity:s=>live.current.onActivityChange?.(s)})}
  catch(e){console.error('苗圃畫面無法建立',e);setFailed(true);live.current.onReady?.();live.current.onDepartureComplete?.();return}
  setFailed(false)
  scene.current=h
  const stopChrome = observeFocusChrome(host.current, value => h.setChrome(value))
  ;(window as any).__nurseryScene=h
  return()=>{stopChrome();scene.current=null;live.current.onCinematicChange?.(false);if(live.current.retainForLobby&&!live.current.departure)leaveSceneForLobby(h);else h.destroy()}
 },[p.sessionId,p.nodeId])
 useEffect(()=>{if(p.nursery)scene.current?.setNurseryState(p.nursery)},[p.nursery]);useEffect(()=>{scene.current?.setProgress(p.progressSeconds)},[p.progressSeconds]);useEffect(()=>{scene.current?.setPaused(p.paused)},[p.paused]);useEffect(()=>{scene.current?.setUiFade(p.uiFade??1)},[p.uiFade])
 useEffect(()=>{scene.current?.setAudioSettings(p.audioSettings,p.audioActive!==false)},[p.audioSettings,p.audioActive])
  useEffect(()=>{scene.current?.setQuietFocus(!!p.quietFocus)},[p.quietFocus])
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>scene.current?.setReducedMotion(query.matches);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync)},[])
 return <div ref={host} className="focus-exploration-game biome-cloud-ruins biome-glass-nursery" aria-label="玻璃苗圃自動探索畫面">{failed&&<p className="cloud-ruins-fallback">探索畫面暫時無法顯示，專注時間照常累積。</p>}</div>
}
