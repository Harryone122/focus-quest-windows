import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ExplorerBrain } from '../src/renderer/src/exploration/ExplorerBrain'
import { ExplorationPlanner, shortestPath } from '../src/renderer/src/exploration/ExplorationPlanner'
import { FOREST_MAP, progressLamps, waypointById } from '../src/renderer/src/exploration/MapDefinition'
import { interactionFor } from '../src/renderer/src/exploration/InteractionRegistry'
import { ProgressController } from '../src/renderer/src/exploration/ProgressController'
import { hashExplorationSeed, SeededRandom } from '../src/renderer/src/exploration/SeededRandom'
import { DAYLIGHT_CYCLE_SECONDS, daylightAt } from '../src/renderer/src/exploration/DaylightCycle'
import { FOREST_ASSET_HEIGHT, FOREST_ASSET_WIDTH } from '../src/renderer/src/exploration/ForestEnvironmentAssets'

describe('timer-driven autonomous exploration', () => {
  it('keeps the complete forest composition and every route anchor inside one fixed scene', () => {
    expect([FOREST_ASSET_WIDTH, FOREST_ASSET_HEIGHT]).toEqual([1672, 941])
    for (const phase of ['morning', 'noon', 'afternoon', 'night']) {
      const header = readFileSync(`src/renderer/src/assets/forest-dynamic-v2/static/${phase}.png`).subarray(0, 24)
      expect([header.readUInt32BE(16), header.readUInt32BE(20)], phase).toEqual([FOREST_ASSET_WIDTH, FOREST_ASSET_HEIGHT])
    }
    for (const waypoint of FOREST_MAP.waypoints) {
      expect(waypoint.x * FOREST_ASSET_WIDTH, waypoint.id).toBeGreaterThanOrEqual(0)
      expect(waypoint.x * FOREST_ASSET_WIDTH, waypoint.id).toBeLessThanOrEqual(FOREST_ASSET_WIDTH)
      expect(waypoint.y * FOREST_ASSET_HEIGHT, waypoint.id).toBeGreaterThanOrEqual(0)
      expect(waypoint.y * FOREST_ASSET_HEIGHT, waypoint.id).toBeLessThanOrEqual(FOREST_ASSET_HEIGHT)
    }
    for (const anchor of [FOREST_MAP.entryAnchor, FOREST_MAP.exitAAnchor, FOREST_MAP.exitBAnchor]) {
      expect(FOREST_MAP.waypoints.some((waypoint) => waypoint.id === anchor.waypointId)).toBe(true)
    }
    expect(progressLamps(FOREST_MAP)).toHaveLength(5)
  })
  it('maps timer progress to exact mandatory lamp milestones', () => {
    const progress = new ProgressController(600, 5)
    expect(progress.update(0).dueLampCount).toBe(0)
    expect(progress.update(120).dueLampCount).toBe(1)
    expect(progress.update(299).dueLampCount).toBe(2)
    expect(progress.update(360).dueLampCount).toBe(3)
    expect(progress.update(480).dueLampCount).toBe(4)
    expect(progress.update(600).dueLampCount).toBe(5)
  })

  it('creates a stable session seed while varying different sessions', () => {
    const first = hashExplorationSeed(1834, 'forest-node', 'session-a')
    expect(first).toBe(hashExplorationSeed(1834, 'forest-node', 'session-a'))
    expect(first).not.toBe(hashExplorationSeed(1834, 'forest-node', 'session-b'))
    const sequenceA = new SeededRandom(first)
    const sequenceB = new SeededRandom(first)
    expect([sequenceA.next(), sequenceA.next(), sequenceA.next()]).toEqual([sequenceB.next(), sequenceB.next(), sequenceB.next()])
  })

  it('routes only through legal neighboring waypoints', () => {
    const path = shortestPath(FOREST_MAP, 'forest_entrance', 'chest_inspect')
    expect(path[0]).toBe('forest_entrance')
    expect(path.at(-1)).toBe('chest_inspect')
    for (let index = 1; index < path.length; index += 1) {
      expect(waypointById(FOREST_MAP, path[index - 1]).neighbors).toContain(path[index])
    }
  })

  it('keeps every authored route on short, reciprocal stone-floor segments', () => {
    const forbiddenShortcuts = new Set([
      'archive_arch|ruin_overlook',
      'astrolabe_exit|tablet_read',
      'east_bridge_mid|lower_east_exit'
    ])

    for (const waypoint of FOREST_MAP.waypoints) {
      for (const neighborId of waypoint.neighbors) {
        const neighbor = waypointById(FOREST_MAP, neighborId)
        expect(neighbor.neighbors, `${neighborId} must link back to ${waypoint.id}`).toContain(waypoint.id)

        const edgeKey = [waypoint.id, neighbor.id].sort().join('|')
        expect(forbiddenShortcuts.has(edgeKey), `${edgeKey} cuts across non-walkable art`).toBe(false)

        const segmentLength = Math.hypot(waypoint.x - neighbor.x, waypoint.y - neighbor.y)
        expect(segmentLength, `${edgeKey} needs another stone-floor waypoint`).toBeLessThanOrEqual(0.205)
      }
    }
  })

  it('allows ambient discovery when the next milestone is safely far away', () => {
    const progress = new ProgressController(600, 5)
    const snapshot = progress.update(8)
    const random = new SeededRandom(42)
    const planner = new ExplorationPlanner(FOREST_MAP, progress, random)
    const brain = new ExplorerBrain(FOREST_MAP, 0)
    const plan = brain.choose(planner, snapshot)
    expect(plan.mandatory).toBe(false)
    expect(plan.object.progressCritical).toBe(false)
  })

  it('prioritizes the required lamp before its timer milestone', () => {
    const progress = new ProgressController(600, 5)
    const snapshot = progress.update(96)
    const planner = new ExplorationPlanner(FOREST_MAP, progress, new SeededRandom(42))
    const brain = new ExplorerBrain(FOREST_MAP, 0)
    const plan = brain.choose(planner, snapshot)
    expect(plan.mandatory).toBe(true)
    expect(plan.object.id).toBe(progressLamps(FOREST_MAP)[0].id)
    expect(plan.waitForMilestone).toBe(true)
  })

  it('restores at the latest timer checkpoint instead of the entrance', () => {
    const lamps = progressLamps(FOREST_MAP)
    const brain = new ExplorerBrain(FOREST_MAP, 3)
    expect(brain.memory.litLampCount).toBe(3)
    expect(brain.memory.currentWaypointId).toBe(lamps[2].waypointId)
  })

  it('authors every forest waypoint as a typed, depth-aware scene anchor', () => {
    const anchorTypes = new Set(FOREST_MAP.waypoints.map((waypoint) => waypoint.anchorType))
    expect(anchorTypes).toEqual(new Set(['transit', 'interaction', 'scenic', 'milestone']))
    for (const waypoint of FOREST_MAP.waypoints) {
      expect(waypoint.depth).toBeGreaterThanOrEqual(0.85)
      expect(waypoint.depth).toBeLessThanOrEqual(1.05)
      expect(waypoint.sceneRegion.length).toBeGreaterThan(0)
    }
  })

  it('defines reachable entry, two exits, rest, landmarks, depth and occlusion for the forest scene', () => {
    const anchorIds = [
      FOREST_MAP.entryAnchor,
      FOREST_MAP.exitAAnchor,
      FOREST_MAP.exitBAnchor,
      FOREST_MAP.restAnchor,
      ...FOREST_MAP.landmarkAnchors
    ].map((anchor) => anchor.waypointId)
    for (const waypointId of anchorIds) expect(() => waypointById(FOREST_MAP, waypointId)).not.toThrow()
    expect(shortestPath(FOREST_MAP, FOREST_MAP.entryAnchor.waypointId, FOREST_MAP.exitAAnchor.waypointId).at(-1)).toBe(FOREST_MAP.exitAAnchor.waypointId)
    expect(shortestPath(FOREST_MAP, FOREST_MAP.entryAnchor.waypointId, FOREST_MAP.exitBAnchor.waypointId).at(-1)).toBe(FOREST_MAP.exitBAnchor.waypointId)
    expect(FOREST_MAP.occlusionZones.length).toBeGreaterThanOrEqual(3)
    expect(FOREST_MAP.depthZones.length).toBeGreaterThanOrEqual(3)
    expect(new Set(FOREST_MAP.shadowCasters.map((caster) => caster.kind))).toEqual(new Set(['tree', 'pillar', 'arch', 'astrolabe']))
  })

  it('gives ambient interactions an arrival, action and recovery cadence', () => {
    for (const object of FOREST_MAP.objects) {
      const presentation = interactionFor(object)
      expect(presentation.arrivalPauseMs).toBeGreaterThanOrEqual(800)
      expect(presentation.durationMs).toBeGreaterThanOrEqual(1400)
      expect(presentation.recoveryPauseMs).toBeGreaterThanOrEqual(1100)
    }
  })

  it('biases the next ambient choice toward calm activity after treasure', () => {
    const progress = new ProgressController(600, 5)
    const planner = new ExplorationPlanner(FOREST_MAP, progress, new SeededRandom(42))
    const brain = new ExplorerBrain(FOREST_MAP, 0)
    brain.memory.currentWaypointId = 'root_alcove'
    brain.memory.lastInteractionType = 'treasure'
    brain.memory.calmSelectionsRemaining = 2
    const plan = brain.choose(planner, progress.update(5))
    expect(['rest', 'landmark']).toContain(plan.object.type)
  })

  it('loops the daylight presentation seamlessly every ten minutes', () => {
    const dawn = daylightAt(0)
    const nextDawn = daylightAt(DAYLIGHT_CYCLE_SECONDS)
    expect(nextDawn).toEqual(dawn)
    const beforeWrap = daylightAt(DAYLIGHT_CYCLE_SECONDS - 1)
    expect(Math.abs(beforeWrap.shadeAlpha - dawn.shadeAlpha)).toBeLessThan(0.001)
    expect(Math.abs(beforeWrap.coolAlpha - dawn.coolAlpha)).toBeLessThan(0.001)
    expect(Math.abs(beforeWrap.liftAlpha - dawn.liftAlpha)).toBeLessThan(0.001)
    expect(dawn.fromScene).toBe('morning')
    expect(dawn.toScene).toBe('noon')
    expect(beforeWrap.toScene).toBe('morning')
    expect(beforeWrap.sceneBlend).toBeGreaterThan(0.999)
  })

  it('keeps noon restrained while making lamps relatively clearer at night', () => {
    const noon = daylightAt(DAYLIGHT_CYCLE_SECONDS * 0.25)
    const night = daylightAt(DAYLIGHT_CYCLE_SECONDS * 0.75)
    expect(noon.shadeAlpha).toBeLessThan(night.shadeAlpha)
    expect(noon.liftAlpha).toBeGreaterThan(night.liftAlpha)
    expect(noon.toScene).toBe('noon')
    expect(noon.sceneBlend).toBe(1)
    expect(night.toScene).toBe('night')
    expect(night.sceneBlend).toBe(1)
    expect(noon.lampAlpha).toBeLessThan(night.lampAlpha)
    expect(night.shadeAlpha).toBeLessThanOrEqual(0.2)
    expect(noon.shadowLength).toBeLessThan(daylightAt(0).shadowLength)
    expect(daylightAt(DAYLIGHT_CYCLE_SECONDS * 0.5).shadowLength).toBeGreaterThan(noon.shadowLength)
  })
})
