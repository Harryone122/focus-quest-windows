import {createCloudRuinsScene} from '/src/renderer/src/cloudRuins/cloudRuinsScene.js'
import {createMossStationScene} from '/src/renderer/src/mossStation/mossStationScene.js'
import {createReflectionLakeScene} from '/src/renderer/src/reflectionLake/reflectionLakeScene.js'
import {createGlassNurseryScene} from '/src/renderer/src/glassNursery/glassNurseryScene.js'
import {focusEventDefinition} from '/src/shared/focusEventCatalog.ts'
import {createMossRuntime,mossSceneSnapshot,emptyMossMarks} from '/src/shared/area02.ts'
import {createLakeRuntime,lakeSnapshot,emptyLakeMarks} from '/src/shared/area03.ts'
import {createNurseryRuntime,emptyNurseryMarks} from '/src/shared/area07.ts'
const host=document.getElementById('scene');let handle=null,ready=false,cinematic=false
window.quietQA={
 async start(map,event,quiet=true){handle?.destroy();host.replaceChildren();ready=false;cinematic=false
  const def=focusEventDefinition(map,event),common={quietFocus:quiet,progressSeconds:601,targetSeconds:3000,paused:true,reportReady:()=>ready=true,reportCinematic:v=>cinematic=v}
  const action={id:1,kind:event.startsWith('story_')||event.startsWith('carry_')?'story':'event',node:def.node,route:[def.node],eventId:event,startSeconds:601,endSeconds:601+def.seconds}
  if(map==='area-01-cloud-ruins'){handle=createCloudRuinsScene(host,{...common,story:null});handle.playRecordedEvent(event)}
  else if(map==='area-02-moss-station'){const r=createMossRuntime('qa');r.seconds=601;r.action={...action,kind:'event'};handle=createMossStationScene(host,{...common,moss:mossSceneSnapshot('qa',r,emptyMossMarks(),false)})}
  else if(map==='area-03-reflection-lake'){const r=createLakeRuntime('qa');r.seconds=601;r.action=action;handle=createReflectionLakeScene(host,{...common,lake:lakeSnapshot('qa',r,emptyLakeMarks(),false)})}
  else{const r=createNurseryRuntime('qa');r.seconds=601;r.action={...action,kind:'story',fromNode:event==='find_core'?'B':undefined};handle=createGlassNurseryScene(host,{...common,nursery:{areaId:map,nodeId:'qa',seed:r.seed,effectiveSeconds:r.seconds,action:r.action,worldMarks:emptyNurseryMarks(),coreTaken:false},audioSettings:{environmentVolume:35,musicVolume:0}})}
  return true
 },state(){return {ready,cinematic,filter:host.querySelector('canvas')?.style.filter,debug:handle?.debugState()}},
 seek(seconds){handle.setPaused(false);handle.setProgress(seconds);return true},pause(){handle.setPaused(true)},dispose(){handle?.destroy();handle=null}
}
