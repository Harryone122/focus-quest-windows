import type { ExplorationMapDefinition, InteractionType } from './MapDefinition'
import { progressLamps } from './MapDefinition'
import type { PlannedExplorationTarget, ExplorerMemory } from './ExplorationPlanner'
import { ExplorationPlanner } from './ExplorationPlanner'
import type { ExplorationProgressSnapshot } from './ProgressController'

export type ExplorerState = 'IDLE' | 'CHOOSE_TARGET' | 'WALK' | 'ARRIVE' | 'INTERACT' | 'LOOK_AROUND' | 'REST'

export class ExplorerBrain {
  state: ExplorerState = 'IDLE'
  currentTarget: PlannedExplorationTarget | null = null
  readonly memory: ExplorerMemory

  constructor(map: ExplorationMapDefinition, restoredLampCount: number) {
    const lamps = progressLamps(map)
    const checkpoint = restoredLampCount > 0 ? lamps[restoredLampCount - 1]?.waypointId : map.spawnWaypointId
    this.memory = {
      currentWaypointId: checkpoint ?? map.spawnWaypointId,
      visitedObjectIds: new Set<string>(),
      recentObjectIds: [],
      lastInteractionType: null,
      calmSelectionsRemaining: 0,
      litLampCount: restoredLampCount
    }
  }

  choose(planner: ExplorationPlanner, progress: ExplorationProgressSnapshot): PlannedExplorationTarget {
    this.state = 'CHOOSE_TARGET'
    this.currentTarget = planner.choose(this.memory, progress)
    if (!this.currentTarget.mandatory && this.memory.calmSelectionsRemaining > 0) {
      this.memory.calmSelectionsRemaining -= 1
    }
    return this.currentTarget
  }

  beginWalking(): void {
    this.state = 'WALK'
  }

  arrive(waypointId: string, waitingForMilestone: boolean): void {
    this.memory.currentWaypointId = waypointId
    this.state = waitingForMilestone ? 'LOOK_AROUND' : 'ARRIVE'
  }

  beginInteraction(type: InteractionType): void {
    this.state = type === 'rest' ? 'REST' : 'INTERACT'
  }

  completeInteraction(target: PlannedExplorationTarget): void {
    const object = target.object
    this.memory.currentWaypointId = object.waypointId
    this.memory.visitedObjectIds.add(object.id)
    this.memory.recentObjectIds = [object.id, ...this.memory.recentObjectIds.filter((id) => id !== object.id)].slice(0, 3)
    this.memory.lastInteractionType = object.type
    if (object.type === 'treasure') this.memory.calmSelectionsRemaining = 2
    else if (object.type === 'inspect' || object.type === 'lamp') this.memory.calmSelectionsRemaining = Math.max(1, this.memory.calmSelectionsRemaining)
    if (object.progressCritical && object.type === 'lamp') {
      this.memory.litLampCount = Math.max(this.memory.litLampCount, (object.milestoneIndex ?? 0) + 1)
    }
    this.currentTarget = null
    this.state = 'IDLE'
  }
}
