import scene from '../../docs/area-01-cloud-ruins.scene.json'
import type { AreaDepartureCue } from './types'

type Area01Exit = AreaDepartureCue['exit']

const exitNodeById: Record<Area01Exit, string> = {
  exit_high: 'c_exit',
  exit_pines: 'd_exit'
}

export function area01Route(start: string, destination: string): string[] {
  const nodes = new Set(scene.nodes.map((node) => node.id))
  if (!nodes.has(start) || !nodes.has(destination)) throw new Error('雲上遺庭路點不存在。')

  const distance = new Map<string, number>([[start, 0]])
  const previous = new Map<string, string>()
  const remaining = new Set(nodes)
  while (remaining.size) {
    let current: string | null = null
    for (const id of remaining) {
      if (distance.has(id) && (current === null || distance.get(id)! < distance.get(current)!)) current = id
    }
    if (current === null || current === destination) break
    remaining.delete(current)
    for (const edge of scene.edges) {
      const neighbor = edge.a === current ? edge.b : edge.b === current ? edge.a : null
      if (!neighbor || !remaining.has(neighbor)) continue
      const candidate = distance.get(current)! + edge.length
      if (candidate < (distance.get(neighbor) ?? Infinity)) {
        distance.set(neighbor, candidate)
        previous.set(neighbor, current)
      }
    }
  }

  if (!distance.has(destination)) throw new Error('雲上遺庭出口無法抵達。')
  const route = [destination]
  while (route[0] !== start) route.unshift(previous.get(route[0])!)
  return route
}

export function area01Departure(fromExpeditionNodeId: string, exit: Area01Exit): AreaDepartureCue {
  return {
    fromExpeditionNodeId,
    fromAreaId: 'area-01-cloud-ruins',
    exit,
    route: area01Route('b_tree', exitNodeById[exit]),
    durationMs: 5000
  }
}
