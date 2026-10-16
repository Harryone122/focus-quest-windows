import { useEffect } from 'react'
import type { AppSnapshot } from '../../shared/types'
import { getRecapScene, releaseRecapScene } from './recapScene'
/** Prepare geometry, audio and first-use shaders while Focus runs, never during a marker transition. */
export function useRecapPrewarm(snapshot:AppSnapshot|null):void{
 useEffect(()=>()=>releaseRecapScene(),[])
 const session=snapshot?.activeSession
 const markers=[snapshot?.specialFinds.map(e=>e.id).join(','),snapshot?.cloudStory?.records.join(','),snapshot?.mossStation?.action?.eventId,snapshot?.lake?.action?.eventId,snapshot?.nursery?.action?.eventId].join('|')
 useEffect(()=>{if(!snapshot)return;if(!session){if(!snapshot.pendingDebrief)releaseRecapScene();return}if(session.beforeFocus)return
  let live=true;const timer=window.setTimeout(()=>{if(!live)return;try{const stage=getRecapScene(session.id,snapshot);stage.updateSettings(snapshot.settings);void window.focusQuest.getFocusRecap(session.id).then(recap=>{if(live)stage.warm(recap.events)}).catch(()=>undefined)}catch{/* The normal Focus and debrief remain available. */}},1000)
  return()=>{live=false;window.clearTimeout(timer)}
 },[session?.id,!!session?.beforeFocus,markers])
}
