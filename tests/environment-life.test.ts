import { describe, expect, it } from 'vitest'
import { DAYLIGHT_CYCLE_SECONDS, daylightAt } from '../src/renderer/src/exploration/DaylightCycle'
import {
  ENVIRONMENT_RUNTIME_POLICY,
  EnvironmentLifecycleRegistry,
  FOG_LAYER_PROFILES,
  MAX_LEAF_PARTICLES,
  WIND_LAYER_PROFILES,
  environmentMotionAt,
  localWindAngleAt,
  motionScaleFor,
  particleLimitFor
} from '../src/renderer/src/exploration/EnvironmentLifeController'
import { FOREST_WIND_PROTOTYPES } from '../src/renderer/src/exploration/ForestEnvironmentAssets'
import { ProgressController } from '../src/renderer/src/exploration/ProgressController'
import { buildWindMeshGeometry, deformWindMesh, windMeshWeight } from '../src/renderer/src/exploration/WindMeshPrototype'

describe('environmental life presentation', () => {
  it('keeps the full daylight loop at ten minutes', () => {
    expect(DAYLIGHT_CYCLE_SECONDS).toBe(10 * 60)
    expect(daylightAt(DAYLIGHT_CYCLE_SECONDS)).toEqual(daylightAt(0))
  })

  it('keeps the night to morning seam continuous', () => {
    const beforeWrap = daylightAt(DAYLIGHT_CYCLE_SECONDS - 0.1).presentation
    const morning = daylightAt(0).presentation
    expect(Math.abs(beforeWrap.ambientIntensity - morning.ambientIntensity)).toBeLessThan(0.001)
    expect(Math.abs(beforeWrap.shadowDirectionX - morning.shadowDirectionX)).toBeLessThan(0.001)
    expect(Math.abs(beforeWrap.shadowDirectionY - morning.shadowDirectionY)).toBeLessThan(0.001)
    expect(Math.abs(beforeWrap.shadowLength - morning.shadowLength)).toBeLessThan(0.001)
  })

  it('uses long morning and afternoon shadows with the shortest shadow at noon', () => {
    const morning = daylightAt(0).presentation
    const noon = daylightAt(DAYLIGHT_CYCLE_SECONDS * 0.25).presentation
    const afternoon = daylightAt(DAYLIGHT_CYCLE_SECONDS * 0.5).presentation
    expect(noon.shadowLength).toBeLessThan(morning.shadowLength)
    expect(noon.shadowLength).toBeLessThan(afternoon.shadowLength)
    expect(afternoon.shadowDirectionX).toBeLessThan(morning.shadowDirectionX)
  })

  it('gives wind layers distinct phase offsets and motion at the same instant', () => {
    expect(new Set(WIND_LAYER_PROFILES.map((profile) => profile.phaseOffset)).size).toBe(WIND_LAYER_PROFILES.length)
    const frame = environmentMotionAt(23_000, false)
    const roundedAngles = WIND_LAYER_PROFILES.map((profile) => frame.layerAngles[profile.id].toFixed(4))
    expect(new Set(roundedAngles).size).toBeGreaterThan(4)
  })

  it('uses three local prototype studies with independent delays in one shared wind field', () => {
    expect(FOREST_WIND_PROTOTYPES.map((prototype) => prototype.kind)).toEqual(['grass', 'vine', 'canopy'])
    expect(new Set(FOREST_WIND_PROTOTYPES.map((prototype) => prototype.phaseOffset)).size).toBe(3)
    expect(FOREST_WIND_PROTOTYPES.every((prototype) => prototype.tipDisplacement <= 5.2)).toBe(true)
  })

  it('keeps local sprite wind subtle and reduces it with the motion preference', () => {
    const frame = environmentMotionAt(2300, false)
    for (const definition of FOREST_WIND_PROTOTYPES) {
      const angle = localWindAngleAt(definition, frame, false)
      const reduced = localWindAngleAt(definition, frame, true)
      expect(Math.abs(angle)).toBeLessThanOrEqual(1.7)
      expect(reduced).toBeCloseTo(angle * 0.2)
    }
  })

  it('locks grass roots, vine attachment and canopy branch junction', () => {
    const [grass, vine, canopy] = FOREST_WIND_PROTOTYPES
    expect(windMeshWeight(grass, 0.5, 1)).toBe(0)
    expect(windMeshWeight(grass, 0.5, 0)).toBe(1)
    expect(windMeshWeight(vine, 0.5, 0)).toBe(0)
    expect(windMeshWeight(vine, 0.5, 1)).toBe(1)
    expect(windMeshWeight(canopy, canopy.anchorX, canopy.anchorY)).toBe(0)
    expect(windMeshWeight(canopy, 0, 0)).toBeGreaterThan(0.8)
  })

  it('deforms only weighted mesh vertices and keeps every fixed vertex stationary', () => {
    const wind = { phase: 1.4, strength: 0.82, gust: 0.55, directionX: 0.84, directionY: 0.56, motionScale: 1 }
    for (const definition of FOREST_WIND_PROTOTYPES) {
      const geometry = buildWindMeshGeometry(definition)
      const before = [...geometry.baseVertices]
      const after = deformWindMesh(geometry, definition, wind)
      let moved = 0
      for (let index = 0; index < before.length; index += 4) {
        const u = before[index + 2]
        const v = before[index + 3]
        const distance = Math.hypot(after[index] - before[index], after[index + 1] - before[index + 1])
        if (windMeshWeight(definition, u, v) === 0) expect(distance).toBe(0)
        if (distance > 0.01) moved += 1
        expect(distance).toBeLessThanOrEqual(definition.tipDisplacement * 1.1)
      }
      expect(moved).toBeGreaterThan(0)
      expect(geometry.indices).toHaveLength((definition.columns - 1) * (definition.rows - 1) * 8)
    }
  })

  it('moves three fog banks continuously in one direction with stronger near-field gust response', () => {
    expect(FOG_LAYER_PROFILES.map((profile) => profile.kind)).toEqual(['fogFar', 'fogMid', 'fogNear'])
    expect(FOG_LAYER_PROFILES[0].speed).toBeLessThan(FOG_LAYER_PROFILES[1].speed)
    expect(FOG_LAYER_PROFILES[1].speed).toBeLessThan(FOG_LAYER_PROFILES[2].speed)
    expect(FOG_LAYER_PROFILES[0].gustResponse).toBeLessThan(FOG_LAYER_PROFILES[2].gustResponse)
    expect(FOG_LAYER_PROFILES.every((profile) => profile.speed > 0)).toBe(true)
  })

  it('reduces wind, foliage and fog motion without stopping daylight', () => {
    const regular = environmentMotionAt(19_000, false)
    const reduced = environmentMotionAt(19_000, true)
    const regularAmplitude = Object.values(regular.layerAngles).reduce((sum, value) => sum + Math.abs(value), 0)
    const reducedAmplitude = Object.values(reduced.layerAngles).reduce((sum, value) => sum + Math.abs(value), 0)
    expect(motionScaleFor(true)).toBeLessThan(motionScaleFor(false))
    expect(reducedAmplitude).toBeLessThan(regularAmplitude * 0.3)
    expect(reduced.fogSpeedScale).toBeLessThan(regular.fogSpeedScale)
    expect(daylightAt(321).presentation.normalizedProgress).toBeGreaterThan(0)
  })

  it('never allows the leaf pool to exceed its hard cap', () => {
    expect(particleLimitFor(false, 0.4)).toBe(8)
    expect(particleLimitFor(false, 0.95)).toBe(MAX_LEAF_PARTICLES)
    expect(particleLimitFor(true, 0.95)).toBe(1)
    expect(MAX_LEAF_PARTICLES).toBe(12)
  })

  it('cleans every registered runtime hook and owns no timers or tweens', () => {
    const lifecycle = new EnvironmentLifecycleRegistry()
    let cleaned = 0
    lifecycle.add(() => { cleaned += 1 })
    lifecycle.add(() => { cleaned += 1 })
    expect(lifecycle.activeCleanupCount).toBe(2)
    lifecycle.destroy()
    expect(cleaned).toBe(2)
    expect(lifecycle.activeCleanupCount).toBe(0)
    expect(ENVIRONMENT_RUNTIME_POLICY).toEqual({ managedTimers: 0, managedTweens: 0 })
  })

  it('cannot become timer authority or change focus progress', () => {
    const progress = new ProgressController(600, 5)
    const before = progress.update(240)
    daylightAt(240)
    environmentMotionAt(240_000, false)
    const after = progress.update(240)
    expect(after).toEqual(before)
  })
})
