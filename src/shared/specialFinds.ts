import area01 from '../../docs/area-01-cloud-ruins.scene.json'
import area02 from '../../docs/area-02-moss-station.scene.json'
import area03 from '../../docs/area03/area-03-reflection-lake.scene.json'
import area07 from '../../docs/area07/area-07-glass-nursery.scene.json'
import { litLampCount } from './lampTiming'

export const SPECIAL_FIND_CHANCE_PER_LAMP = 0.05
export const SPECIAL_FIND_LAMP_COUNT = 5
export const FOREST_MAP_ID = area01.areaId
export const MOSS_MAP_ID = area02.areaId

export interface SpecialFindDefinition {
  eventId: string
  itemKey: string
  title: string
  kind: 'relic' | 'token'
}

// Keep canonical IDs separate from presentation variants (rain is not a fourth item).
export const AREA01_SPECIAL_FINDS: SpecialFindDefinition[] = area01.events
  .filter((event) => event.rare && event.outcome === 'item' && event.item)
  .map((event) => ({
    eventId: event.id,
    itemKey: event.item!.id,
    title: event.item!.name,
    kind: event.item!.kind as SpecialFindDefinition['kind']
  }))

export const AREA02_SPECIAL_FINDS: SpecialFindDefinition[] = area02.events
  .filter((event) => event.rare && event.item && !event.rainVariantOf)
  .map((event) => ({ eventId: event.id, itemKey: event.item!.id, title: event.item!.name,
    kind: event.item!.kind === 'core' ? 'token' : 'relic' }))

export const LAKE_MAP_ID = 'area-03-reflection-lake' as const
export const AREA03_SPECIAL_FINDS: SpecialFindDefinition[] = area03.events.filter(e => e.rare && e.item && e.id !== 'rare_boat_plate').map(e => ({ eventId: e.id, itemKey: e.item!.id, title: e.item!.name, kind: e.item!.kind === 'core' ? 'token' : 'relic' }))
export const NURSERY_MAP_ID = 'area-07-glass-nursery' as const
export const AREA07_SPECIAL_FINDS: SpecialFindDefinition[] = area07.specialFinds.map(e=>({eventId:e.id,itemKey:e.itemKey,title:e.label,kind:e.tier==='core'?'token':'relic'}))
export const ALL_SPECIAL_FINDS = [...AREA01_SPECIAL_FINDS, ...AREA02_SPECIAL_FINDS, ...AREA03_SPECIAL_FINDS, ...AREA07_SPECIAL_FINDS]

export function specialFindsForMap(mapId: string): SpecialFindDefinition[] {
  if (mapId === FOREST_MAP_ID) return AREA01_SPECIAL_FINDS
  if (mapId === MOSS_MAP_ID) return AREA02_SPECIAL_FINDS
  if (mapId === LAKE_MAP_ID) return AREA03_SPECIAL_FINDS
  if (mapId === NURSERY_MAP_ID) return AREA07_SPECIAL_FINDS
  throw new Error('未知的地圖。')
}

export function dueLampCount(progressSeconds: number, plannedMinutes: 25 | 50 | 90): number {
  const targetSeconds = plannedMinutes * 60
  return litLampCount(progressSeconds, targetSeconds)
}

// A chance roll is made once for each newly lit lamp. A successful roll selects
// uniformly from eligible finds; it never changes the 5% success probability.
export function selectSpecialFind(
  chanceRoll: number,
  itemRoll: number,
  eligible: readonly SpecialFindDefinition[]
): SpecialFindDefinition | null {
  if (eligible.length === 0 || chanceRoll >= SPECIAL_FIND_CHANCE_PER_LAMP) return null
  return eligible[Math.min(eligible.length - 1, Math.floor(itemRoll * eligible.length))]
}
