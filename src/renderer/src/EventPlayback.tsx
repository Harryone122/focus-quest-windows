import { useEffect, useRef, useState } from 'react'
import type { AppSettings } from '../../shared/types'
import type { FocusEventRecord } from '../../shared/focusPresentation'
import { focusEventDefinition } from '../../shared/focusEventCatalog'
import { createCloudRuinsScene, type CloudRuinsSceneHandle } from './cloudRuins/cloudRuinsScene'
import { createMossStationScene } from './mossStation/mossStationScene'
import { createReflectionLakeScene } from './reflectionLake/reflectionLakeScene'
import { createGlassNurseryScene } from './glassNursery/glassNurseryScene'
import { createCloudRuinsAudio } from './cloudRuins/cloudRuinsAudio'
import { createMossSoundscape } from './mossStation/mossStationAudio'
import { createLakeAudio } from './reflectionLake/lakeAudio'

/** An isolated presentation. It has no world/clue callbacks and never uses a current save. */
export function EventPlayback({ record, settings, onStarted, onDone, reduced = false }: {
  record:FocusEventRecord;settings:AppSettings;onStarted?:()=>Promise<void>;onDone:()=>void;reduced?:boolean
}):React.JSX.Element {
  const host=useRef<HTMLDivElement>(null),live=useRef({settings,onStarted,onDone});live.current={settings,onStarted,onDone}
  const [error,setError]=useState(''),[caption,setCaption]=useState('')
  useEffect(()=>{
    if(!host.current)return
    let dead=false,timer=0,fallback=0,scene:Pick<CloudRuinsSceneHandle,'setPaused'|'setProgress'|'debugState'|'destroy'|'playRecordedEvent'|'setReducedMotion'>|null=null,audio:{destroy?:()=>void;dispose?:()=>void}|null=null,started=false
    const e=structuredClone(record),def=focusEventDefinition(e.mapId,e.variant),duration=def.seconds,base=e.explorationSeconds
    const savedAction=e.scene.moss?.action??e.scene.lake?.action??e.scene.nursery?.action
    const action:any={...(savedAction?.eventId===e.variant?savedAction:{}),id:1,kind:e.kind==='story'?(e.mapId==='area-02-moss-station'?'event':'story'):(e.mapId==='area-07-glass-nursery'?'story':'event'),node:def.node,route:[def.node],eventId:e.variant,startSeconds:base,endSeconds:base+duration}
    const moss=e.scene.moss?{...e.scene.moss,action,effectiveSeconds:base}:null
    const lake=e.scene.lake?{...e.scene.lake,action,effectiveSeconds:base}:null
    const nursery=e.scene.nursery?{...e.scene.nursery,action,effectiveSeconds:base}:null
    let clock=base
    const run=async():Promise<void>=>{
      if(dead||started||!scene)return;started=true;window.clearTimeout(fallback)
      try {
        await live.current.onStarted?.();if(dead)return
        const began=performance.now()
        scene.setReducedMotion?.(reduced);scene.setPaused(false)
        if(e.mapId==='area-01-cloud-ruins')scene.playRecordedEvent?.(e.variant)
        if(e.mapId==='area-02-moss-station'){const a=createMossSoundscape(e.seed);audio=a;a.update(base,live.current.settings,false)}
        if(e.mapId==='area-01-cloud-ruins'){const a=createCloudRuinsAudio({progressSeconds:base,paused:false,muted:live.current.settings.audioMuted,environmentVolume:live.current.settings.environmentVolume,musicVolume:live.current.settings.musicVolume});audio=a}
        if(lake)audio=createLakeAudio(()=>({...lake,effectiveSeconds:clock}),()=>scene?.debugState(),()=>live.current.settings,()=>dead)
        timer=window.setInterval(()=>{
          if(dead||!scene)return;const elapsed=(performance.now()-began)/1000;clock=base+Math.min(duration,elapsed)
          if(reduced){scene.setPaused(true);scene.setProgress(base+duration*.5)}else scene.setProgress(clock)
          const complete=e.mapId==='area-01-cloud-ruins'&&elapsed>1&&scene.debugState().state==='idle'
          if(complete||elapsed>=duration){window.clearInterval(timer);live.current.onDone()}
        },50)
      }catch(reason){setError(String(reason))}
    }
    const common={progressSeconds:base,targetSeconds:3000,paused:true,reducedMotion:reduced,replay:true,seed:e.seed,reportActivity:(value:string)=>{if(!dead)setCaption(value)},reportReady:()=>void run()}
    try {
      if(moss)scene=createMossStationScene(host.current,{...common,moss})
      else if(lake)scene=createReflectionLakeScene(host.current,{...common,lake})
      else if(nursery)scene=createGlassNurseryScene(host.current,{...common,nursery,audioSettings:live.current.settings})
      else scene=createCloudRuinsScene(host.current,{...common,story:e.scene.cloud?{...e.scene.cloud,scheduledEvents:[],eventHistory:[]}:null,coreTaken:e.scene.coreTaken,worldMarks:e.scene.worldMarks})
      fallback=window.setTimeout(()=>{if(!started)setError('演出暫時無法載入，可以跳過繼續。')},20000)
    }catch(reason){setError(String(reason))}
    return()=>{dead=true;window.clearInterval(timer);window.clearTimeout(fallback);audio?.destroy?.();audio?.dispose?.();scene?.destroy()}
  },[record.id,reduced])
  return <div className="focus-event-playback" ref={host} aria-label="事件重播">{caption&&<p className="event-playback-caption">{caption}</p>}{error&&<p role="alert" className="focus-event-error">{error}</p>}</div>
}
