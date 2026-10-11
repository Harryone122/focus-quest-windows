import { interactionDurationSeconds } from './InteractionRegistry'
import type { ExplorationMapDefinition, InteractiveObjectDefinition, InteractionType, WaypointDefinition } from './MapDefinition'
import { progressLamps, waypointById } from './MapDefinition'
import type { ExplorationProgressSnapshot } from './ProgressController'
import { ProgressController } from './ProgressController'
import type { SeededRandom } from './SeededRandom'

export interface ExplorerMemory {
  currentWaypointId: string
  visitedObjectIds: Set<string>
  recentObjectIds: string[]
  lastInteractionType: InteractionType | null
  calmSelectionsRemaining: number
  litLampCount: number
}

export interface PlannedExplorationTarget {
  object: InteractiveObjectDefinition
  path: string[]
  travelSeconds: number
  speedScale: number
  mandatory: boolean
  waitForMilestone: boolean
  score: number
}

function distance(a: WaypointDefinition, b: WaypointDefinition): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function shortestPath(map: ExplorationMapDefinition, fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId]
  const distances = new Map<string, number>(map.waypoints.map((waypoint) => [waypoint.id, Number.POSITIVE_INFINITY]))
  const previous = new Map<string, string>()
  const unvisited = new Set(map.waypoints.map((waypoint) => waypoint.id))
  distances.set(fromId, 0)

  while (unvisited.size) {
    let current: string | null = null
    let currentDistance = Number.POSITIVE_INFINITY
    for (const candidate of unvisited) {
      const candidateDistance = distances.get(candidate) ?? Number.POSITIVE_INFINITY
      if (candidateDistance < currentDistance) {
        current = candidate
        currentDistance = candidateDistance
      }
    }
    if (!current || current === toId) break
    unvisited.delete(current)
    const waypoint = waypointById(map, current)
    for (const neighborId of waypoint.neighbors) {
      if (!unvisited.has(neighborId)) continue
      const candidateDistance = currentDistance + distance(waypoint, waypointById(map, neighborId))
      if (candidateDistance < (distances.get(neighborId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighborId, candidateDistance)
        previous.set(neighborId, current)
      }
    }
  }

  if (!previous.has(toId)) return [fromId]
  const result = [toId]
  let cursor = toId
  while (cursor !== fromId) {
    const before = previous.get(cursor)
    if (!before) return [fromId]
    result.unshift(before)
    cursor = before
  }
  return result
}

export function pathTravelSeconds(map: ExplorationMapDefinition, path: string[]): number {
  let normalizedDistance = 0
  for (let index = 1; index < path.length; index += 1) {
    normalizedDistance += distance(waypointById(map, path[index - 1]), waypointById(map, path[index]))
  }
  // Roughly 38 px/s on a 1000 px-wide authored surface.
  return normalizedDistance * 26.3
}

export class ExplorationPlanner {
  constructor(
    private readonly map: ExplorationMapDefinition,
    private readonly progress: ProgressController,
    private readonly random: SeededRandom
  ) {}

  choose(memory: ExplorerMemory, snapshot: ExplorationProgressSnapshot): PlannedExplorationTarget {
    const lamps = progressLamps(this.map)
    const nextLamp = lamps[memory.litLampCount]
    const lampPlan = nextLamp ? this.planFor(memory.currentWaypointId, nextLamp, true) : null

    if (lampPlan && (
      this.progress.isMilestoneDue(memory.litLampCount) ||
      this.progress.shouldPrepare(memory.litLampCount, lampPlan.travelSeconds)
    )) {
      return {
        ...lampPlan,
        waitForMilestone: !this.progress.isMilestoneDue(memory.litLampCount),
        speedScale: this.progress.walkingSpeedScale(memory.litLampCount, lampPlan.travelSeconds),
        score: 1000
      }
    }

    const ambient = this.map.objects
      .filter((object) => !object.progressCritical)
      .map((object) => this.scoreAmbient(memory, object, nextLamp, snapshot))
      .filter((plan): plan is PlannedExplorationTarget => plan !== null)
      .sort((a, b) => b.score - a.score)

    if (ambient[0]) return ambient[0]
    if (lampPlan) return { ...lampPlan, waitForMilestone: true, score: 700 }

    // Once every mandatory light is complete, continue quiet seeded wandering.
    const fallback = this.map.objects.find((object) => !object.progressCritical) ?? this.map.objects[0]
    return this.planFor(memory.currentWaypointId, fallback, false)
  }

  private scoreAmbient(
    memory: ExplorerMemory,
    object: InteractiveObjectDefinition,
    nextLamp: InteractiveObjectDefinition | undefined,
    snapshot: ExplorationProgressSnapshot
  ): PlannedExplorationTarget | null {
    const plan = this.planFor(memory.currentWaypointId, object, false)
    if (nextLamp && snapshot.secondsUntilNext !== null) {
      const afterPath = shortestPath(this.map, object.waypointId, nextLamp.waypointId)
      const timeNeeded = plan.travelSeconds + interactionDurationSeconds(object) + pathTravelSeconds(this.map, afterPath) + 5
      if (timeNeeded >= snapshot.secondsUntilNext) return null
    }

    const base = object.type === 'treasure' ? 62 : object.type === 'inspect' ? 55 : object.type === 'rest' ? 40 : 46
    const unseen = memory.visitedObjectIds.has(object.id) ? -34 : 35
    const recent = memory.recentObjectIds.includes(object.id) ? -110 : 0
    const repeatedType = memory.lastInteractionType === object.type ? -24 : 0
    const calmBias = memory.calmSelectionsRemaining > 0
      ? (object.type === 'rest' || object.type === 'landmark' ? 84 : object.type === 'treasure' ? -170 : -105)
      : 0
    const nearby = object.priorityTags.includes('nearby') ? 8 : 0
    const distancePenalty = plan.travelSeconds * -2.1
    return { ...plan, score: base + unseen + recent + repeatedType + calmBias + nearby + distancePenalty + this.random.jitter(11) }
  }

  private planFor(fromId: string, object: InteractiveObjectDefinition, mandatory: boolean): PlannedExplorationTarget {
    const path = shortestPath(this.map, fromId, object.waypointId)
    return {
      object,
      path,
      travelSeconds: pathTravelSeconds(this.map, path),
      speedScale: 1,
      mandatory,
      waitForMilestone: false,
      score: mandatory ? 800 : 0
    }
  }
}
