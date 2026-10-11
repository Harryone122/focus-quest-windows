import { FOREST_MAP_ID, MOSS_MAP_ID, LAKE_MAP_ID, NURSERY_MAP_ID } from './specialFinds'
import type { ExpeditionDistance, ExpeditionNodeType, ExpeditionResolution } from './types'

export const EXPEDITION_EVENTS = {
  lost_letter: {
    title: '遺失的信件',
    description: '你在抽屜底部找到一封沒有寄出的信。'
  },
  collapsed_gallery: {
    title: '倒塌的迴廊',
    description: '前方的一段石橋已經塌陷，你繞了一段路才找到另一個入口。'
  },
  glass_observatory: {
    title: '玻璃觀測台',
    description: '厚重灰塵下面，一片玻璃仍映著天空。'
  }
} as const

export type ExpeditionEventKey = keyof typeof EXPEDITION_EVENTS

export const RUN_RELICS = {
  broken_compass: {
    title: '破損指南針',
    description: '下一層會標出路線類型，讓岔路更容易判讀。'
  },
  old_oil_lamp: {
    title: '舊油燈',
    description: '照亮路線旁的一句環境線索。'
  },
  faded_map: {
    title: '褪色地圖',
    description: '在選路時揭露這段探索偏向 Passage 或 Archive。'
  },
  copper_signpost: {
    title: '銅製路標',
    description: '替其中一條岔路補上一個方向提示。'
  }
} as const

export type RunRelicKey = keyof typeof RUN_RELICS

export interface GeneratedRoute {
  stableKey: string
  areaId: typeof FOREST_MAP_ID | typeof MOSS_MAP_ID | typeof LAKE_MAP_ID | typeof NURSERY_MAP_ID
  depth: number
  departureExitId: 'exit_high' | 'exit_pines' | 'exit_bridge' | 'exit_steps' | null
  distance: ExpeditionDistance
  type: ExpeditionNodeType
  title: string
  description: string
  environmentHint: string
  plannedMinutes: 25 | 50 | 90
}

function hashText(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function stableIndex(seed: number, salt: string, length: number): number {
  return hashText(`${seed}:${salt}`) % length
}

// The currently released candidates. Future Areas extend this pool; visits never remove an Area.
const AREAS = [
  { areaId: FOREST_MAP_ID, title: '雲上遺庭', description: '循著林間燈火，走進雲霧中的古老遺庭。', environmentHint: '中央大樹下，仍留著旅人歇腳的痕跡。' },
  { areaId: MOSS_MAP_ID, title: '苔痕驛站', description: '沿著濕潤石徑，抵達長滿苔痕的舊驛站。', environmentHint: '候車亭、遺失物抽屜與河岸，還留著往日的故事。' },
  { areaId: NURSERY_MAP_ID, title: '玻璃苗圃', description: '推開玻璃門，走進仍在運轉的荒廢苗圃。', environmentHint: '育苗機照樣澆著那格空盤。' },
  { areaId: LAKE_MAP_ID, title: '倒影湖畔', description: '踩著踏石，走向映著天空的湖畔。', environmentHint: '潮水淹過石台，疊月橋與倒影慢慢接成一輪圓。' }
] as const

export interface RoutePoolState {
  /** Areas completed earlier in this journey, not merely offered as choices. */
  visitedAreaIds: readonly string[]
  /** Permanent cores owned across all journeys. */
  ownedCoreAreaIds: readonly string[]
}

/** §49.2: prefer unvisited released Areas and reserve a slot for an unowned core.
 * With fewer than two unvisited released Areas, the second slot may revisit one;
 * this is temporary until the ten authored Areas are playable. */
export function chooseRouteAreas(seed: number, depth: number, parentNodeId: string | null, state: RoutePoolState): [typeof AREAS[number], typeof AREAS[number]] {
  // The released campfire has authored left/right silhouettes for these two Areas.
  if (depth === 0 && (!state.ownedCoreAreaIds.includes(FOREST_MAP_ID) || !state.ownedCoreAreaIds.includes(MOSS_MAP_ID) || state.ownedCoreAreaIds.includes(LAKE_MAP_ID))) return [AREAS[0], AREAS[1]]

  const visited = new Set(state.visitedAreaIds)
  const owned = new Set(state.ownedCoreAreaIds)
  const pool = depth === 0 ? AREAS.filter(area=>area.areaId!==NURSERY_MAP_ID) : AREAS
  const unvisited = pool.filter((area) => !visited.has(area.areaId))
  const firstPool = unvisited.length ? unvisited : pool
  const unowned = unvisited.filter((area) => !owned.has(area.areaId))
  const firstCandidates = unowned.length ? unowned : firstPool
  const first = firstCandidates[stableIndex(seed, `areas:first:${depth}:${parentNodeId}`, firstCandidates.length)]
  const secondPool = (unvisited.length > 1 ? unvisited : pool).filter((area) => area.areaId !== first.areaId)
  const second = secondPool[stableIndex(seed, `areas:second:${depth}:${parentNodeId}`, secondPool.length)]
  return [first, second]
}

function routeType(seed: number, depth: number, parentNodeId: string | null, index: number, minutes: number): ExpeditionNodeType {
  if (minutes === 25) return stableIndex(seed, `type:${depth}:${parentNodeId}:${index}`, 4) === 0 ? 'archive' : 'passage'
  if (minutes === 90) return stableIndex(seed, `type:${depth}:${parentNodeId}:${index}`, 4) === 0 ? 'passage' : 'archive'
  return stableIndex(seed, `type:${depth}:${parentNodeId}:${index}`, 2) === 0 ? 'passage' : 'archive'
}

export function generateRoutes(seed: number, depth: number, parentNodeId: string | null, state: RoutePoolState = { visitedAreaIds: [], ownedCoreAreaIds: [] }): GeneratedRoute[] {
  const areas = chooseRouteAreas(seed, depth, parentNodeId, state)
  return Array.from({ length: 2 }, (_, index) => {
    const area = areas[index]
    const plannedMinutes = 50 as const
    const type = routeType(seed, depth, parentNodeId, index, plannedMinutes)
    // Preserve the legacy key formula so departure backfills still identify old routes.
    const stableKey = `route-${hashText(`${seed}:${depth}:${parentNodeId ?? 'entrance'}:${index}`).toString(16)}`
    return {
      ...area, stableKey, depth,
      departureExitId: parentNodeId !== null ? (index === 0 ? 'exit_high' as const : 'exit_pines' as const)
        : (index === 0 ? 'exit_bridge' as const : 'exit_steps' as const),
      distance: 'middle' as const, type, plannedMinutes
    }
  })
}

export function eventForNode(seed: number, nodeId: string): ExpeditionEventKey {
  const keys = Object.keys(EXPEDITION_EVENTS) as ExpeditionEventKey[]
  return keys[stableIndex(seed, `event:${nodeId}`, keys.length)]
}

export function relicOptionsForNode(seed: number, nodeId: string): [RunRelicKey, RunRelicKey] {
  const keys = Object.keys(RUN_RELICS) as RunRelicKey[]
  const first = stableIndex(seed, `relic:first:${nodeId}`, keys.length)
  const offset = 1 + stableIndex(seed, `relic:second:${nodeId}`, keys.length - 1)
  return [keys[first], keys[(first + offset) % keys.length]]
}

export function fullThresholdSeconds(plannedMinutes: 25 | 50 | 90): number {
  return plannedMinutes * 60
}

export function resolveExpeditionProgress(
  existingProgressSeconds: number,
  sessionSeconds: number,
  plannedMinutes: 25 | 50 | 90
): { resolution: ExpeditionResolution; progressSeconds: number; thresholdSeconds: number; appliedSeconds: number } {
  const thresholdSeconds = fullThresholdSeconds(plannedMinutes)
  if (sessionSeconds < 5 * 60) {
    return { resolution: 'too_short', progressSeconds: existingProgressSeconds, thresholdSeconds, appliedSeconds: 0 }
  }
  const progressSeconds = existingProgressSeconds + sessionSeconds
  return {
    resolution: progressSeconds >= thresholdSeconds ? 'full' : 'partial',
    progressSeconds,
    thresholdSeconds,
    appliedSeconds: sessionSeconds
  }
}
