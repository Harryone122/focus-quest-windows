import type { FocusEventRecord, FocusRecap } from './focusPresentation'
import { focusEventDefinition } from './focusEventCatalog'
export function eventSeconds(e:FocusEventRecord):number {
  const saved=e.mapId==='area-02-moss-station'?e.scene.moss?.action:e.mapId==='area-03-reflection-lake'?e.scene.lake?.action:e.scene.nursery?.action
  const nurseryDurations:Record<string,number>={find_core:14,find_pressed_leaf:4,find_mulch_cloth:4,carry_silvered_shard:11,story_first_tray:14,story_second_chart:12,carry_sapling:12}
  if(e.mapId==='area-07-glass-nursery'&&nurseryDurations[e.variant])return nurseryDurations[e.variant]
  return saved?.eventId===e.variant ? Math.max(1,saved.endSeconds-saved.startSeconds) : focusEventDefinition(e.mapId,e.variant).seconds
}
export function recapAction(e:FocusEventRecord,id:number){
  const def=focusEventDefinition(e.mapId,e.variant),saved=e.mapId==='area-02-moss-station'?e.scene.moss:e.mapId==='area-03-reflection-lake'?e.scene.lake:e.mapId==='area-07-glass-nursery'?e.scene.nursery:null,base=saved?.effectiveSeconds??e.explorationSeconds
  return {id,kind:e.mapId==='area-02-moss-station'?'event':e.mapId==='area-07-glass-nursery'||e.kind==='story'?'story':'event',node:def.node,route:[def.node],eventId:e.variant,startSeconds:base,endSeconds:base+eventSeconds(e)}
}
export function snapRecapEvent(recap:FocusRecap,seconds:number,width:number):FocusEventRecord|null {
  const total=Math.max(1,recap.effectiveSeconds);let closest:FocusEventRecord|null=null,distance=Infinity
  for(const e of recap.events){const d=Math.abs(e.effectiveSeconds-seconds)*width/total;if(d<distance){distance=d;closest=e}}
  return distance<=18?closest:null
}
export function recapClipSeconds(e:FocusEventRecord):number{return Math.min(eventSeconds(e),e.kind==='core'?12:8)}
export function recapLampCount(recap:FocusRecap,head:number):number{return recap.lamps.filter(e=>e.effectiveSeconds<=head+.0001).length}
