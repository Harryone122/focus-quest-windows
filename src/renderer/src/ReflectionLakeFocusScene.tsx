import { observeFocusChrome } from './cloudRuins/observeFocusChrome'
import { useEffect, useRef, useState } from 'react'
import { createReflectionLakeScene, type LakeSceneHandle } from './reflectionLake/reflectionLakeScene'
import { createLakeAudio } from './reflectionLake/lakeAudio'
import { leaveSceneForLobby } from './cloudRuins/sceneHandoff'
import type { LakeSnapshot, LakeExit } from '../../shared/area03'
import type { AppSettings as Settings } from '../../shared/types'

interface Props {
 quietFocus?:boolean
 audioActive?:boolean
 lake: LakeSnapshot | null; progressSeconds:number; targetSeconds:number; sessionId:string; nodeId:string
 paused:boolean; retainForLobby?:boolean; uiFade?:number; audioSettings?:Settings
 departure?: {exit:LakeExit;durationMs:number}|null;departureElapsedMs:number
 departureState?:LakeSnapshot|null
 onReady?:()=>void;onDepartureComplete?:()=>void;onActivityChange?:(s:string)=>void;onCinematicChange?:(s:boolean)=>void
}
export function ReflectionLakeFocusScene(p:Props) {
 const host=useRef<HTMLDivElement>(null),scene=useRef<LakeSceneHandle|null>(null),live=useRef(p),[failed,setFailed]=useState(false)
 live.current=p
 useEffect(()=>{
  if(!host.current)return
  let handle:LakeSceneHandle
  try {handle=createReflectionLakeScene(host.current,{quietFocus:p.quietFocus,progressSeconds:p.progressSeconds,targetSeconds:p.targetSeconds,lake:p.lake,departureState:p.departureState,paused:p.paused,departure:p.departure,departureElapsedMs:p.departureElapsedMs,reportReady:()=>{if(host.current)host.current.dataset.sceneReady='true';live.current.onReady?.()},reportActivity:s=>live.current.onActivityChange?.(s),reportDepartureComplete:()=>live.current.onDepartureComplete?.(),reportCinematic:s=>live.current.onCinematicChange?.(s)})}
  catch(e){console.error('倒影湖畔畫面無法建立',e);setFailed(true);live.current.onReady?.();live.current.onDepartureComplete?.();return}
  scene.current=handle
  const stopChrome = observeFocusChrome(host.current, value => handle.setChrome(value))
  ;(window as any).__lakeScene=handle
  return()=>{stopChrome();scene.current=null;live.current.onCinematicChange?.(false);if(live.current.retainForLobby&&!live.current.departure)leaveSceneForLobby(handle);else handle.destroy()}
 },[p.sessionId,p.nodeId])
 useEffect(()=>{scene.current?.setProgress(p.progressSeconds)},[p.progressSeconds])
 useEffect(()=>{if(p.lake)scene.current?.setLakeState(p.lake)},[p.lake])
 useEffect(()=>{scene.current?.setPaused(p.paused)},[p.paused])
 useEffect(()=>{scene.current?.setUiFade(p.uiFade??1)},[p.uiFade])
 useEffect(()=>{
  const audio=createLakeAudio(()=>live.current.departure&&!scene.current?.debugState().departureDone?(live.current.departureState??live.current.lake):live.current.lake,()=>scene.current?.debugState(),()=>live.current.audioSettings,()=>live.current.audioActive===false||live.current.retainForLobby===true||live.current.paused||Boolean(live.current.nodeId.startsWith('leave:')&&scene.current?.debugState().departureDone))
  return()=>audio.destroy()
 },[p.sessionId,p.nodeId])
  useEffect(()=>{scene.current?.setQuietFocus(!!p.quietFocus)},[p.quietFocus])
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>scene.current?.setReducedMotion(query.matches);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync)},[])
 return <div className="focus-exploration-game biome-cloud-ruins biome-reflection-lake" ref={host} aria-label="倒影湖畔自動探索畫面">{failed&&<p className="cloud-ruins-fallback">探索畫面暫時無法顯示，專注時間照常累積。</p>}</div>
}
