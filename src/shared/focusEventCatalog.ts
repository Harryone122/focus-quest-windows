import { nurseryRoute } from './area07'
import cloud from '../../docs/area-01-cloud-ruins.scene.json'
import moss from '../../docs/area-02-moss-station.scene.json'
import lake from '../../docs/area03/area-03-reflection-lake.scene.json'
import nursery from '../../docs/area07/area-07-glass-nursery.scene.json'
import type { FocusEventRecord } from './focusPresentation'
import { COLLECTION_CLUES } from './collectionRoom'
export const CLOUD_RECORD_EVENTS: Record<string,string> = { story_opening_a: 'opening_a', c01_first_tree: 'opening_b', c01_stele_scale: 'stele', h1a: 'well', c01_rubbing: 'rubbing', c01_tag: 'leafTag', item_whistle: 'whistle', c01_bark_date: 'traces' }
export const BEFORE_CLUES: Record<string,string[]> = { opening_a: ['story_opening_a','c01_first_tree'], opening_b: ['c01_first_tree'], notebook_a: ['c01_first_tree'], notebook_b: ['c01_first_tree'], stele: ['c01_stele_scale'], well: ['h1a'], story_open_carving: ['m02_open'], story_first_lantern: ['h1b'], story_first_lantern_rain: ['h1b'], story_second_sketch: ['h1c'], story_open_gauge: ['m03_open'], story_first_lag: ['m03_lag'], story_second_cup: ['c03'], story_first_tray: ['m07_tray'], story_second_chart: ['m07_chart'] }
export function focusEventDefinition(mapId:string,id:string): {node:string;seconds:number;pose:string;name:string} {
  const cloudStory:Record<string,[string,number]> = { opening_a:['a_bridge',120], opening_b:['b_tree',14], notebook_a:['a_bridge',120], notebook_b:['b_tree',14], stele:['a_stele',40], well:['b_well',48], rubbing:['a_stele',44], leafTag:['b_tree',42], whistle:['a_edge',22], traces:['b_tree',46] }
  if (mapId === 'area-01-cloud-ruins' && cloudStory[id]) return {node:cloudStory[id][0],seconds:cloudStory[id][1],pose:'crouch',name:id}
  const scene:any = mapId === 'area-02-moss-station' ? moss : mapId === 'area-03-reflection-lake' ? lake : mapId === 'area-07-glass-nursery' ? nursery : cloud
  if(mapId==='area-07-glass-nursery'&&id==='find_core')return {node:'B',seconds:14+nurseryRoute('B','K').seconds,pose:'crouch',name:'封存種莢'}
  const e = [...(scene.events??[]),...(scene.storyEvents??[]),...(Array.isArray(scene.specialFinds)?scene.specialFinds:[])].find((e:any)=>e.id===id)
  return {node:e?.standNode??e?.spot??'H',seconds:e?.sec??e?.dur?.[0]??e?.demoSeconds??12,pose:e?.pose??e?.anim??'crouch',name:e?.label??e?.name??id}
}
/** Card copy comes from the authored map, never from implementation IDs. */
export function focusEventCaption(record:FocusEventRecord):{name:string;place:string;text:string}{
  const scene:any=record.mapId==='area-02-moss-station'?moss:record.mapId==='area-03-reflection-lake'?lake:record.mapId==='area-07-glass-nursery'?nursery:cloud
  const e=[...(scene.events??[]),...(scene.storyEvents??[]),...(Array.isArray(scene.specialFinds)?scene.specialFinds:[])].find((e:any)=>e.id===record.variant||e.id===record.eventId)
  const clueId=String(e?.clue??record.eventId).split(/[\s(]/)[0]
  const clue=COLLECTION_CLUES.find(c=>c.id===clueId||c.id===record.eventId)
  const node=focusEventDefinition(record.mapId,record.variant).node
  const nodes=Array.isArray(scene.nodes)?scene.nodes:Object.entries(scene.nodes??{}).map(([id,value]:[string,any])=>({id,...value}))
  const place=nodes.find((n:any)=>n.id===node)?.label??nodes.find((n:any)=>n.id===node)?.name??'這段路上'
  const stories:Record<string,string>={opening_a:'從這裡開始',opening_b:'第一棵樹',notebook_a:'筆記的第一頁',notebook_b:'第一棵樹',stele:'石碑上的刻度',well:'井裡的回聲',rubbing:'石碑拓印',leafTag:'樹上的標籤',whistle:'銅製風哨',traces:'樹皮上的日期',story_first_tray:'刻字苗盤',story_second_chart:'照料記錄'}
  return {name:e?.item?.name??e?.label??stories[record.variant]??clue?.sourceLabel.split(' · ').at(-1)??e?.name??(record.kind==='core'?'地圖核心':record.kind==='item'?'旅程信物':'故事線索'),place,text:e?.note??clue?.text??e?.name??e?.status?.at(-1)?.[1]??(record.kind==='core'?'這枚核心已收進收藏室。':record.kind==='item'?'這次找到的信物已經記下。':'這一段已記在筆記裡。')}
}
