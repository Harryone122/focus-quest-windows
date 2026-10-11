import type Phaser from 'phaser'
import type { DaylightPresentationState, DaylightSceneKey } from './DaylightCycle'
import {
  FOREST_ASSET_BOUNDS,
  FOREST_ASSET_HEIGHT,
  FOREST_ASSET_WIDTH,
  FOREST_CANOPY_IDS,
  FOREST_GRASS_IDS,
  FOREST_VEGETATION_PIVOTS,
  FOREST_VINE_IDS,
  FOREST_WIND_PROTOTYPES,
  type ForestAssetBounds,
  type ForestVegetationId,
  type ForestWindPrototypeDefinition,
  type ForestWindPrototypeId
} from './ForestEnvironmentAssets'
import type { ShadowCasterDefinition } from './MapDefinition'
import { buildWindMeshGeometry, deformWindMesh, type WindMeshGeometry } from './WindMeshPrototype'

export const ENVIRONMENT_SOURCE_WIDTH = FOREST_ASSET_WIDTH
export const ENVIRONMENT_SOURCE_HEIGHT = FOREST_ASSET_HEIGHT
export const MAX_LEAF_PARTICLES = 12
export const ENVIRONMENT_RUNTIME_POLICY = Object.freeze({ managedTimers: 0, managedTweens: 0 })

export interface EnvironmentCanvasTransform {
  viewportWidth: number
  viewportHeight: number
  centerX: number
  centerY: number
  scale: number
}

export interface EnvironmentPhaseTextureSet {
  phase: DaylightSceneKey
  vegetation: Record<ForestVegetationId, string>
  windPrototype: Record<ForestWindPrototypeId, string>
  fogFar: string
  fogMid: string
  fogNear: string
  leaves: string
}

export type WindLayerId = ForestVegetationId
export type WindLayerKind = 'canopy' | 'grass' | 'vine'

export interface WindLayerProfile {
  id: WindLayerId
  amplitudeDeg: number
  phaseOffset: number
  durationMultiplier: number
  driftX: number
  driftY: number
  scalePulse: number
  kind: WindLayerKind
}

export const WIND_LAYER_PROFILES: readonly WindLayerProfile[] = [
  { id: 'tree_canopy_left_foreground', amplitudeDeg: 1.55, phaseOffset: 0.18, durationMultiplier: 1.1, driftX: 0.5, driftY: 0.12, scalePulse: 0.003, kind: 'canopy' },
  { id: 'tree_canopy_midleft', amplitudeDeg: 1.35, phaseOffset: 0.92, durationMultiplier: 0.94, driftX: 0.4, driftY: 0.1, scalePulse: 0.003, kind: 'canopy' },
  { id: 'tree_canopy_center', amplitudeDeg: 1.6, phaseOffset: 1.78, durationMultiplier: 1.22, driftX: 0.55, driftY: 0.12, scalePulse: 0.003, kind: 'canopy' },
  { id: 'tree_canopy_upper_right', amplitudeDeg: 1.25, phaseOffset: 2.66, durationMultiplier: 0.86, driftX: 0.38, driftY: 0.09, scalePulse: 0.0025, kind: 'canopy' },
  { id: 'tree_canopy_right_foreground', amplitudeDeg: 1.75, phaseOffset: 3.42, durationMultiplier: 1.16, driftX: 0.6, driftY: 0.14, scalePulse: 0.0035, kind: 'canopy' },
  { id: 'tree_canopy_bottom_foreground', amplitudeDeg: 1.45, phaseOffset: 4.31, durationMultiplier: 1.3, driftX: 0.45, driftY: 0.1, scalePulse: 0.003, kind: 'canopy' },
  { id: 'grass_astrolabe_west', amplitudeDeg: 2.5, phaseOffset: 0.47, durationMultiplier: 0.74, driftX: 0, driftY: 0, scalePulse: 0.004, kind: 'grass' },
  { id: 'grass_astrolabe_east', amplitudeDeg: 3.1, phaseOffset: 1.23, durationMultiplier: 0.81, driftX: 0, driftY: 0, scalePulse: 0.0045, kind: 'grass' },
  { id: 'grass_left_ruins', amplitudeDeg: 2.7, phaseOffset: 2.11, durationMultiplier: 0.69, driftX: 0, driftY: 0, scalePulse: 0.004, kind: 'grass' },
  { id: 'grass_center_path_west', amplitudeDeg: 3.3, phaseOffset: 2.87, durationMultiplier: 0.77, driftX: 0, driftY: 0, scalePulse: 0.0045, kind: 'grass' },
  { id: 'grass_center_path_east', amplitudeDeg: 2.8, phaseOffset: 3.59, durationMultiplier: 0.84, driftX: 0, driftY: 0, scalePulse: 0.004, kind: 'grass' },
  { id: 'grass_archive_arch_base', amplitudeDeg: 3.4, phaseOffset: 4.36, durationMultiplier: 0.72, driftX: 0, driftY: 0, scalePulse: 0.0045, kind: 'grass' },
  { id: 'grass_right_upper_path', amplitudeDeg: 2.4, phaseOffset: 5.04, durationMultiplier: 0.8, driftX: 0, driftY: 0, scalePulse: 0.0035, kind: 'grass' },
  { id: 'grass_bridge_edge', amplitudeDeg: 3.2, phaseOffset: 5.78, durationMultiplier: 0.7, driftX: 0, driftY: 0, scalePulse: 0.0045, kind: 'grass' },
  { id: 'grass_lower_left_stairs', amplitudeDeg: 2.6, phaseOffset: 6.44, durationMultiplier: 0.88, driftX: 0, driftY: 0, scalePulse: 0.004, kind: 'grass' },
  { id: 'vines_west', amplitudeDeg: 4.2, phaseOffset: 0.71, durationMultiplier: 0.92, driftX: 0, driftY: 0, scalePulse: 0.0035, kind: 'vine' },
  { id: 'vines_astrolabe', amplitudeDeg: 4.8, phaseOffset: 1.91, durationMultiplier: 1.08, driftX: 0, driftY: 0, scalePulse: 0.004, kind: 'vine' },
  { id: 'vines_center_bridge', amplitudeDeg: 5.3, phaseOffset: 3.08, durationMultiplier: 0.86, driftX: 0, driftY: 0, scalePulse: 0.0045, kind: 'vine' },
  { id: 'vines_archive_arch', amplitudeDeg: 4.5, phaseOffset: 4.39, durationMultiplier: 1.18, driftX: 0, driftY: 0, scalePulse: 0.004, kind: 'vine' },
  { id: 'vines_east', amplitudeDeg: 5.6, phaseOffset: 5.52, durationMultiplier: 0.98, driftX: 0, driftY: 0, scalePulse: 0.0045, kind: 'vine' },
  { id: 'vines_lower_stairs', amplitudeDeg: 4.6, phaseOffset: 6.13, durationMultiplier: 1.26, driftX: 0, driftY: 0, scalePulse: 0.0035, kind: 'vine' }
]

export interface WindState {
  directionX: number
  directionY: number
  strength: number
  gust: number
  phase: number
}

export interface EnvironmentMotionFrame {
  wind: WindState
  layerAngles: Record<WindLayerId, number>
  layerDriftX: Record<WindLayerId, number>
  layerDriftY: Record<WindLayerId, number>
  fogSpeedScale: number
  particleLimit: number
}

export function motionScaleFor(reducedMotion: boolean): number {
  return reducedMotion ? 0.2 : 1
}

export function localWindAngleAt(definition: ForestWindPrototypeDefinition, frame: EnvironmentMotionFrame, reducedMotion: boolean): number {
  const maxAngle = definition.kind === 'vine' ? 1.7 : definition.kind === 'grass' ? 1.5 : 0.55
  return Math.sin(frame.wind.phase + definition.phaseOffset) * maxAngle * frame.wind.strength *
    (0.86 + frame.wind.gust * 0.14) * motionScaleFor(reducedMotion)
}

export function particleLimitFor(reducedMotion: boolean, gust: number): number {
  if (reducedMotion) return 1
  return gust > 0.82 ? MAX_LEAF_PARTICLES : 8
}

export function environmentMotionAt(elapsedMs: number, reducedMotion: boolean): EnvironmentMotionFrame {
  const seconds = elapsedMs / 1000
  const gustWave = 0.5 + Math.sin(seconds / 39 + 0.65) * 0.5
  const gust = Math.pow(gustWave, 2.8)
  const strength = clamp(0.52 + Math.sin(seconds / 17) * 0.12 + Math.sin(seconds / 7.2 + 1.1) * 0.06 + gust * 0.22, 0.35, 1.05)
  const phase = seconds * Math.PI * 2 / 10.5
  const directionX = 0.82 + Math.sin(seconds / 59) * 0.025
  const directionY = 0.57 + Math.sin(seconds / 47 + 1.9) * 0.02
  const motionScale = motionScaleFor(reducedMotion)
  const layerAngles = {} as Record<WindLayerId, number>
  const layerDriftX = {} as Record<WindLayerId, number>
  const layerDriftY = {} as Record<WindLayerId, number>

  for (const profile of WIND_LAYER_PROFILES) {
    const localPhase = phase / profile.durationMultiplier + profile.phaseOffset
    const primary = Math.sin(localPhase)
    const secondary = Math.sin(localPhase * 0.53 + profile.phaseOffset * 0.77)
    layerAngles[profile.id] = (primary * 0.82 + secondary * 0.18) * profile.amplitudeDeg * strength * motionScale
    layerDriftX[profile.id] = (primary * 0.78 + secondary * 0.22) * profile.driftX * strength * motionScale
    layerDriftY[profile.id] = secondary * profile.driftY * strength * motionScale
  }

  return {
    wind: { directionX, directionY, strength, gust, phase },
    layerAngles,
    layerDriftX,
    layerDriftY,
    fogSpeedScale: reducedMotion ? 0.22 : 1,
    particleLimit: particleLimitFor(reducedMotion, gust)
  }
}

export class EnvironmentLifecycleRegistry {
  private cleanups: Array<() => void> = []

  add(cleanup: () => void): void { this.cleanups.push(cleanup) }

  destroy(): void {
    for (let index = this.cleanups.length - 1; index >= 0; index -= 1) this.cleanups[index]()
    this.cleanups.length = 0
  }

  get activeCleanupCount(): number { return this.cleanups.length }
}

interface PhaseImagePair {
  from: Phaser.GameObjects.Image
  to: Phaser.GameObjects.Image
}

interface WindLayerRuntime {
  id: WindLayerId
  assetId: ForestVegetationId
  kind: WindLayerKind
  images: PhaseImagePair
  bounds: ForestAssetBounds
  pivotX: number
  pivotY: number
  baseX: number
  baseY: number
  baseScale: number
  baseAlpha: number
}

interface WindPrototypeRuntime {
  definition: ForestWindPrototypeDefinition
  geometry: WindMeshGeometry
  fromMesh?: Phaser.GameObjects.Mesh2D
  toMesh?: Phaser.GameObjects.Mesh2D
  fromFallback?: Phaser.GameObjects.Image
  toFallback?: Phaser.GameObjects.Image
  baseX: number
  baseY: number
  baseScale: number
  baseAlpha: number
}

export type FogLayerKind = 'fogFar' | 'fogMid' | 'fogNear'

export interface FogLayerProfile {
  kind: FogLayerKind
  speed: number
  baseAlpha: number
  verticalAmplitude: number
  phaseOffset: number
  spacingFactor: number
  widthFactor: number
  gustResponse: number
  directionYRatio: number
}

export const FOG_LAYER_PROFILES: readonly FogLayerProfile[] = [
  { kind: 'fogFar', speed: 1.6, baseAlpha: 0.2, verticalAmplitude: 2.2, phaseOffset: 0.4, spacingFactor: 0.8, widthFactor: 1.02, gustResponse: 0.12, directionYRatio: 0.012 },
  { kind: 'fogMid', speed: 3.15, baseAlpha: 0.17, verticalAmplitude: 3.7, phaseOffset: 1.35, spacingFactor: 0.74, widthFactor: 0.94, gustResponse: 0.38, directionYRatio: 0.02 },
  { kind: 'fogNear', speed: 5.8, baseAlpha: 0.14, verticalAmplitude: 5.5, phaseOffset: 2.2, spacingFactor: 0.68, widthFactor: 0.88, gustResponse: 0.78, directionYRatio: 0.03 }
]

interface FogRuntime {
  profile: FogLayerProfile
  from: Phaser.GameObjects.Image[]
  to: Phaser.GameObjects.Image[]
  bounds: ForestAssetBounds
  offset: number
  displayWidth: number
  displayHeight: number
  spacing: number
  baseX: number
  baseY: number
}

interface ShadowRuntime {
  image: Phaser.GameObjects.Image
  caster: ShadowCasterDefinition
  weight: number
}

interface LeafParticle {
  image: Phaser.GameObjects.Image
  active: boolean
  ageMs: number
  lifetimeMs: number
  velocityX: number
  velocityY: number
  angularVelocity: number
  baseAlpha: number
}

interface EnvironmentLifeControllerOptions {
  scene: Phaser.Scene
  fromTextures: EnvironmentPhaseTextureSet
  toTextures: EnvironmentPhaseTextureSet
  phaseBlend: number
  shadowTextureKeys: { architecture: string; foliage: string }
  shadowCasters: ShadowCasterDefinition[]
  canvas: EnvironmentCanvasTransform
  daylight: DaylightPresentationState
  reducedMotion: boolean
  windPrototypeEnabled?: boolean
  seed: number
  travelerCastShadow?: Phaser.GameObjects.Image
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)) }
function lerp(from: number, to: number, amount: number): number { return from + (to - from) * amount }

function copyDaylight(state: DaylightPresentationState): DaylightPresentationState { return { ...state } }

export class EnvironmentLifeController {
  private readonly scene: Phaser.Scene
  private readonly shadowCasters: ShadowCasterDefinition[]
  private readonly lifecycle = new EnvironmentLifecycleRegistry()
  private readonly windLayers: WindLayerRuntime[] = []
  private readonly windPrototypes: WindPrototypeRuntime[] = []
  private readonly fogLayers: FogRuntime[] = []
  private readonly shadowViews: ShadowRuntime[] = []
  private readonly particles: LeafParticle[] = []
  private readonly shadowMasks: Phaser.GameObjects.Image[] = []
  private fromTextures: EnvironmentPhaseTextureSet
  private toTextures: EnvironmentPhaseTextureSet
  private phaseBlend: number
  private travelerCastShadow?: Phaser.GameObjects.Image
  private canvas: EnvironmentCanvasTransform
  private targetDaylight: DaylightPresentationState
  private currentDaylight: DaylightPresentationState
  private reducedMotion: boolean
  private elapsedMs = 0
  private accumulatorMs = 0
  private nextParticleAtMs = 1800
  private randomState: number
  private destroyed = false
  private updateAttached = false
  private readonly meshPrototypeEnabled: boolean

  constructor(options: EnvironmentLifeControllerOptions) {
    this.scene = options.scene
    this.fromTextures = options.fromTextures
    this.toTextures = options.toTextures
    this.phaseBlend = clamp(options.phaseBlend, 0, 1)
    this.shadowCasters = options.shadowCasters
    this.canvas = { ...options.canvas }
    this.targetDaylight = copyDaylight(options.daylight)
    this.currentDaylight = copyDaylight(options.daylight)
    this.reducedMotion = options.reducedMotion
    this.meshPrototypeEnabled = options.windPrototypeEnabled !== false && typeof this.scene.add.mesh2d === 'function' && 'gl' in this.scene.game.renderer
    this.randomState = options.seed >>> 0 || 0x6d2b79f5
    this.travelerCastShadow = options.travelerCastShadow
    this.ensureShadowTexture()
    this.createWindLayers()
    this.createWindPrototypes()
    this.createFogLayers()
    this.createShadowLayers(options.shadowTextureKeys)
    this.createParticlePool()
    this.resize(options.canvas)
    this.applyPhaseBlend()
    this.scene.events.on('update', this.onUpdate)
    this.updateAttached = true
    this.lifecycle.add(() => {
      this.scene.events.off('update', this.onUpdate)
      this.updateAttached = false
    })
  }

  setDaylight(state: DaylightPresentationState): void { this.targetDaylight = copyDaylight(state) }

  setPhaseTextures(from: EnvironmentPhaseTextureSet, to: EnvironmentPhaseTextureSet, blend: number): void {
    const phasesChanged = from.phase !== this.fromTextures.phase || to.phase !== this.toTextures.phase
    this.fromTextures = from
    this.toTextures = to
    this.phaseBlend = clamp(blend, 0, 1)
    if (phasesChanged) {
      for (const layer of this.windLayers) {
        layer.images.from.setTexture(from.vegetation[layer.assetId])
        layer.images.to.setTexture(to.vegetation[layer.assetId])
      }
      for (const prototype of this.windPrototypes) {
        const fromKey = from.windPrototype[prototype.definition.id]
        const toKey = to.windPrototype[prototype.definition.id]
        prototype.fromMesh?.setTexture(fromKey)
        prototype.toMesh?.setTexture(toKey)
        prototype.fromFallback?.setTexture(fromKey)
        prototype.toFallback?.setTexture(toKey)
      }
      for (const fog of this.fogLayers) {
        const fromKey = fog.profile.kind === 'fogFar' ? from.fogFar : fog.profile.kind === 'fogMid' ? from.fogMid : from.fogNear
        const toKey = fog.profile.kind === 'fogFar' ? to.fogFar : fog.profile.kind === 'fogMid' ? to.fogMid : to.fogNear
        for (const image of fog.from) image.setTexture(fromKey)
        for (const image of fog.to) image.setTexture(toKey)
      }
      const leafKey = this.phaseBlend < 0.5 ? from.leaves : to.leaves
      for (const particle of this.particles) particle.image.setTexture(leafKey)
    }
    this.applyPhaseBlend()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    if (reducedMotion) {
      for (const particle of this.particles) {
        if (this.activeParticleCount <= 1) break
        this.deactivateParticle(particle)
      }
    }
  }

  attachTravelerShadow(shadow?: Phaser.GameObjects.Image): void { this.travelerCastShadow = shadow }

  resize(canvas: EnvironmentCanvasTransform): void {
    this.canvas = { ...canvas }
    const left = canvas.centerX - ENVIRONMENT_SOURCE_WIDTH * canvas.scale / 2
    const top = canvas.centerY - ENVIRONMENT_SOURCE_HEIGHT * canvas.scale / 2

    for (const layer of this.windLayers) {
      const localPivotX = layer.pivotX - layer.bounds.x
      const localPivotY = layer.pivotY - layer.bounds.y
      const textureWidth = layer.bounds.width
      const textureHeight = layer.bounds.height
      const originX = localPivotX / textureWidth
      const originY = localPivotY / textureHeight
      for (const image of [layer.images.from, layer.images.to]) image.setOrigin(originX, originY).setScale(canvas.scale)
      layer.baseX = left + layer.pivotX * canvas.scale
      layer.baseY = top + layer.pivotY * canvas.scale
      layer.baseScale = canvas.scale
      for (const image of [layer.images.from, layer.images.to]) {
        image.setPosition(layer.baseX, layer.baseY).setAngle(0).setScale(canvas.scale)
      }
    }

    for (const prototype of this.windPrototypes) {
      prototype.baseX = left + prototype.definition.x * canvas.scale
      prototype.baseY = top + prototype.definition.y * canvas.scale
      prototype.baseScale = canvas.scale
      for (const object of [prototype.fromMesh, prototype.toMesh]) {
        object?.setPosition(prototype.baseX, prototype.baseY).setScale(canvas.scale)
      }
      const anchorX = prototype.baseX + prototype.definition.anchorX * prototype.definition.width * canvas.scale
      const anchorY = prototype.baseY + prototype.definition.anchorY * prototype.definition.height * canvas.scale
      for (const image of [prototype.fromFallback, prototype.toFallback]) image?.setPosition(anchorX, anchorY).setScale(canvas.scale)
    }

    for (const fog of this.fogLayers) {
      fog.displayWidth = fog.bounds.width * canvas.scale * fog.profile.widthFactor
      fog.displayHeight = fog.bounds.height * canvas.scale * 1.08
      fog.spacing = fog.displayWidth * fog.profile.spacingFactor
      fog.baseX = left + (fog.bounds.x + fog.bounds.width / 2) * canvas.scale
      fog.baseY = top + (fog.bounds.y + fog.bounds.height / 2) * canvas.scale
      fog.offset %= Math.max(1, fog.spacing)
      for (const image of [...fog.from, ...fog.to]) image.setDisplaySize(fog.displayWidth, fog.displayHeight)
      this.positionFog(fog)
    }

    for (const mask of this.shadowMasks) mask.setScale(canvas.scale)
    if (this.shadowMasks[0]) this.positionCroppedImage(this.shadowMasks[0], FOREST_ASSET_BOUNDS.shadow_architecture, left, top, canvas.scale)
    if (this.shadowMasks[1]) this.positionCroppedImage(this.shadowMasks[1], FOREST_ASSET_BOUNDS.shadow_foliage, left, top, canvas.scale)
    for (const shadow of this.shadowViews) {
      shadow.image.setPosition(
        left + ENVIRONMENT_SOURCE_WIDTH * shadow.caster.x * canvas.scale,
        top + ENVIRONMENT_SOURCE_HEIGHT * shadow.caster.y * canvas.scale
      )
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.lifecycle.destroy()
    this.windLayers.length = 0
    this.windPrototypes.length = 0
    this.fogLayers.length = 0
    this.shadowViews.length = 0
    this.shadowMasks.length = 0
    this.particles.length = 0
    this.travelerCastShadow = undefined
  }

  getDiagnostics(): { destroyed: boolean; activeParticleCount: number; particleLimit: number; updateAttached: boolean; managedTimers: number; managedTweens: number; meshPrototypeEnabled: boolean; prototypeCount: number; phases: [DaylightSceneKey, DaylightSceneKey] } {
    const frame = environmentMotionAt(this.elapsedMs, this.reducedMotion)
    return {
      destroyed: this.destroyed,
      activeParticleCount: this.activeParticleCount,
      particleLimit: frame.particleLimit,
      updateAttached: this.updateAttached,
      managedTimers: ENVIRONMENT_RUNTIME_POLICY.managedTimers,
      managedTweens: ENVIRONMENT_RUNTIME_POLICY.managedTweens,
      meshPrototypeEnabled: this.meshPrototypeEnabled,
      prototypeCount: this.windPrototypes.length,
      phases: [this.fromTextures.phase, this.toTextures.phase]
    }
  }

  private get activeParticleCount(): number { return this.particles.reduce((count, particle) => count + Number(particle.active), 0) }

  private readonly onUpdate = (_time: number, deltaMs: number): void => {
    if (this.destroyed) return
    const safeDelta = clamp(deltaMs, 0, 250)
    this.elapsedMs += safeDelta
    this.accumulatorMs += safeDelta
    const hidden = typeof document !== 'undefined' && document.hidden
    const interval = hidden ? 250 : this.reducedMotion ? 100 : 34
    if (this.accumulatorMs < interval) return
    const stepMs = this.accumulatorMs
    this.accumulatorMs = 0
    const stepSeconds = stepMs / 1000
    this.smoothDaylight(stepSeconds)
    const frame = environmentMotionAt(this.elapsedMs, this.reducedMotion)
    this.updateWind(frame)
    this.updateFog(stepSeconds, frame)
    this.updateParticles(stepMs, frame, hidden)
    this.updateShadows()
  }

  private smoothDaylight(deltaSeconds: number): void {
    const amount = 1 - Math.exp(-deltaSeconds * (this.reducedMotion ? 1.1 : 2.7))
    const phaseDelta = ((this.targetDaylight.phase - this.currentDaylight.phase + 1.5) % 1) - 0.5
    this.currentDaylight.phase = (this.currentDaylight.phase + phaseDelta * amount + 1) % 1
    this.currentDaylight.normalizedProgress = this.currentDaylight.phase
    const keys: Array<keyof DaylightPresentationState> = [
      'sunHeight', 'shadowDirectionX', 'shadowDirectionY', 'shadowLength',
      'shadowOpacity', 'ambientIntensity', 'warmness', 'layerBrightness'
    ]
    for (const key of keys) this.currentDaylight[key] = lerp(this.currentDaylight[key], this.targetDaylight[key], amount)
  }

  private createWindLayers(): void {
    const addPair = (
      assetId: ForestVegetationId,
      depth: number,
      alpha: number
    ): void => {
      const profile = WIND_LAYER_PROFILES.find((candidate) => candidate.id === assetId)
      if (!profile) throw new Error(`Missing wind profile for ${assetId}`)
      const bounds = FOREST_ASSET_BOUNDS[assetId]
      const pivot = FOREST_VEGETATION_PIVOTS[assetId]
      const from = this.registerImage(this.scene.add.image(0, 0, this.fromTextures.vegetation[assetId]).setDepth(depth))
      const to = this.registerImage(this.scene.add.image(0, 0, this.toTextures.vegetation[assetId]).setDepth(depth + 0.01))
      this.windLayers.push({ id: assetId, assetId, kind: profile.kind, images: { from, to }, bounds, pivotX: pivot.x, pivotY: pivot.y, baseX: 0, baseY: 0, baseScale: 1, baseAlpha: alpha })
    }

    const canopyDepths: Record<(typeof FOREST_CANOPY_IDS)[number], number> = {
      tree_canopy_left_foreground: 74,
      tree_canopy_midleft: 32,
      tree_canopy_center: 68,
      tree_canopy_upper_right: 30,
      tree_canopy_right_foreground: 75,
      tree_canopy_bottom_foreground: 76
    }
    for (const id of FOREST_CANOPY_IDS) addPair(id, canopyDepths[id], 0.98)
    FOREST_GRASS_IDS.forEach((id, index) => addPair(id, 70 + index * 0.015, 0.94))
    FOREST_VINE_IDS.forEach((id, index) => addPair(id, 71 + index * 0.018, 0.95))
  }

  private createWindPrototypes(): void {
    for (const definition of FOREST_WIND_PROTOTYPES) {
      const geometry = buildWindMeshGeometry(definition)
      const runtime: WindPrototypeRuntime = {
        definition,
        geometry,
        baseX: 0,
        baseY: 0,
        baseScale: 1,
        baseAlpha: 1
      }
      if (this.meshPrototypeEnabled) {
        runtime.fromMesh = this.registerMesh(
          this.scene.add.mesh2d(0, 0, this.fromTextures.windPrototype[definition.id], [...geometry.vertices], [...geometry.indices])
            .setSize(definition.width, definition.height)
            .setOrigin(0, 0)
            .setDepth(definition.depth)
            .buildOrderedIndices(1, true)
        )
        runtime.toMesh = this.registerMesh(
          this.scene.add.mesh2d(0, 0, this.toTextures.windPrototype[definition.id], [...geometry.vertices], [...geometry.indices])
            .setSize(definition.width, definition.height)
            .setOrigin(0, 0)
            .setDepth(definition.depth + 0.01)
            .buildOrderedIndices(1, true)
        )
      } else {
        runtime.fromFallback = this.registerImage(
          this.scene.add.image(0, 0, this.fromTextures.windPrototype[definition.id]).setOrigin(definition.anchorX, definition.anchorY).setDepth(definition.depth)
        )
        runtime.toFallback = this.registerImage(
          this.scene.add.image(0, 0, this.toTextures.windPrototype[definition.id]).setOrigin(definition.anchorX, definition.anchorY).setDepth(definition.depth + 0.01)
        )
      }
      this.windPrototypes.push(runtime)
    }
  }

  private createFogLayers(): void {
    const depths: Record<FogLayerKind, number> = { fogFar: 2.2, fogMid: 5.2, fogNear: 67 }
    const boundsFor = (kind: FogLayerKind): ForestAssetBounds => FOREST_ASSET_BOUNDS[kind === 'fogFar' ? 'fog_far' : kind === 'fogMid' ? 'fog_mid' : 'fog_near']
    const textureFor = (textures: EnvironmentPhaseTextureSet, kind: FogLayerKind): string => kind === 'fogFar' ? textures.fogFar : kind === 'fogMid' ? textures.fogMid : textures.fogNear
    for (const profile of FOG_LAYER_PROFILES) {
      const makeWaveBank = (key: string, depth: number): Phaser.GameObjects.Image[] => Array.from({ length: 3 }, (_, index) => (
        this.registerImage(this.scene.add.image(0, 0, key).setDepth(depth + index * 0.001).setFlipX(index % 2 === 1))
      ))
      this.fogLayers.push({
        profile,
        from: makeWaveBank(textureFor(this.fromTextures, profile.kind), depths[profile.kind]),
        to: makeWaveBank(textureFor(this.toTextures, profile.kind), depths[profile.kind] + 0.01),
        bounds: boundsFor(profile.kind),
        offset: this.random() * 600,
        displayWidth: 0,
        displayHeight: 0,
        spacing: 1,
        baseX: 0,
        baseY: 0
      })
    }
  }

  private createShadowLayers(keys: { architecture: string; foliage: string }): void {
    this.shadowMasks.push(
      this.registerImage(this.scene.add.image(0, 0, keys.architecture).setDepth(7.6).setBlendMode('MULTIPLY')),
      this.registerImage(this.scene.add.image(0, 0, keys.foliage).setDepth(7.7).setBlendMode('MULTIPLY'))
    )
    const weight = (kind: ShadowCasterDefinition['kind']): number => kind === 'tree' ? 1 : kind === 'arch' ? 0.86 : kind === 'astrolabe' ? 0.74 : 0.66
    for (const caster of this.shadowCasters) {
      const image = this.registerImage(this.scene.add.image(0, 0, 'focus-environment-cast-shadow').setDepth(8).setOrigin(0.06, 0.5))
      this.shadowViews.push({ image, caster, weight: weight(caster.kind) })
    }
  }

  private createParticlePool(): void {
    for (let index = 0; index < MAX_LEAF_PARTICLES; index += 1) {
      const image = this.registerImage(this.scene.add.image(-100, -100, this.fromTextures.leaves).setDepth(78).setVisible(false).setActive(false))
      this.particles.push({ image, active: false, ageMs: 0, lifetimeMs: 0, velocityX: 0, velocityY: 0, angularVelocity: 0, baseAlpha: 0 })
    }
  }

  private applyPhaseBlend(): void {
    const fromAlpha = 1 - this.phaseBlend
    const toAlpha = this.phaseBlend
    for (const layer of this.windLayers) {
      layer.images.from.setAlpha(layer.baseAlpha * fromAlpha)
      layer.images.to.setAlpha(layer.baseAlpha * toAlpha)
    }
    for (const prototype of this.windPrototypes) {
      prototype.fromMesh?.setAlpha(prototype.baseAlpha * fromAlpha)
      prototype.toMesh?.setAlpha(prototype.baseAlpha * toAlpha)
      prototype.fromFallback?.setAlpha(prototype.baseAlpha * fromAlpha)
      prototype.toFallback?.setAlpha(prototype.baseAlpha * toAlpha)
    }
    for (const fog of this.fogLayers) {
      for (const image of fog.from) image.setAlpha(fog.profile.baseAlpha * fromAlpha)
      for (const image of fog.to) image.setAlpha(fog.profile.baseAlpha * toAlpha)
    }
  }

  private updateWind(frame: EnvironmentMotionFrame): void {
    const prototypeWind = this.meshPrototypeEnabled ? {
      phase: frame.wind.phase,
      strength: frame.wind.strength,
      gust: frame.wind.gust,
      directionX: frame.wind.directionX,
      directionY: frame.wind.directionY,
      motionScale: motionScaleFor(this.reducedMotion)
    } : null
    for (const prototype of this.windPrototypes) {
      if (prototypeWind) {
        const vertices = deformWindMesh(prototype.geometry, prototype.definition, prototypeWind)
        if (prototype.fromMesh) prototype.fromMesh.vertices = [...vertices]
        if (prototype.toMesh) prototype.toMesh.vertices = [...vertices]
      }
      const angle = localWindAngleAt(prototype.definition, frame, this.reducedMotion)
      prototype.fromFallback?.setAngle(angle)
      prototype.toFallback?.setAngle(angle)
    }
  }

  private updateFog(deltaSeconds: number, frame: EnvironmentMotionFrame): void {
    for (const fog of this.fogLayers) {
      const gustPush = 0.72 + frame.wind.strength * 0.22 + frame.wind.gust * fog.profile.gustResponse
      fog.offset = (fog.offset + fog.profile.speed * gustPush * frame.fogSpeedScale * deltaSeconds) % Math.max(1, fog.spacing)
      this.positionFog(fog)
      const breathing = 0.88 + Math.sin(this.elapsedMs / 22000 + fog.profile.phaseOffset) * 0.08
      const gustDensity = 0.94 + frame.wind.gust * (fog.profile.kind === 'fogNear' ? 0.12 : 0.05)
      fog.from.forEach((image, index) => {
        const wave = 0.86 + Math.sin(this.elapsedMs / 18000 + fog.profile.phaseOffset + index * 1.7) * 0.1
        image.setAlpha(fog.profile.baseAlpha * (1 - this.phaseBlend) * breathing * gustDensity * wave)
      })
      fog.to.forEach((image, index) => {
        const wave = 0.86 + Math.sin(this.elapsedMs / 18000 + fog.profile.phaseOffset + index * 1.7) * 0.1
        image.setAlpha(fog.profile.baseAlpha * this.phaseBlend * breathing * gustDensity * wave)
      })
    }
  }

  private positionFog(fog: FogRuntime): void {
    const motionScale = motionScaleFor(this.reducedMotion)
    const vertical = Math.sin(this.elapsedMs / 26000 + fog.profile.phaseOffset) * fog.profile.verticalAmplitude * motionScale
    const bankCount = fog.from.length
    for (const pair of [fog.from, fog.to]) {
      pair.forEach((image, index) => {
        const centeredIndex = index - Math.floor(bankCount / 2)
        const localX = centeredIndex * fog.spacing + fog.offset
        const wrappedX = ((localX + fog.spacing * 1.5) % (fog.spacing * bankCount)) - fog.spacing * 1.5
        const localVertical = vertical * (index % 2 === 0 ? 1 : -0.42)
        image.setPosition(
          fog.baseX + wrappedX,
          fog.baseY + localVertical + wrappedX * fog.profile.directionYRatio * motionScale
        )
      })
    }
  }

  private updateParticles(deltaMs: number, frame: EnvironmentMotionFrame, hidden: boolean): void {
    for (const particle of this.particles) {
      if (!particle.active) continue
      particle.ageMs += deltaMs
      if (particle.ageMs >= particle.lifetimeMs) {
        this.deactivateParticle(particle)
        continue
      }
      particle.image.x += particle.velocityX * deltaMs / 1000
      particle.image.y += particle.velocityY * deltaMs / 1000
      particle.image.angle += particle.angularVelocity * deltaMs / 1000
      const life = particle.ageMs / particle.lifetimeMs
      const fade = Math.min(1, life / 0.12, (1 - life) / 0.18)
      particle.image.setAlpha(particle.baseAlpha * clamp(fade, 0, 1))
    }

    if (hidden || this.elapsedMs < this.nextParticleAtMs || this.activeParticleCount >= frame.particleLimit) return
    const target = this.reducedMotion ? 1 : frame.wind.gust > 0.82 ? Math.min(frame.particleLimit, 8 + Math.floor(frame.wind.gust * 3)) : 4
    if (this.activeParticleCount < target || this.random() > 0.76) this.spawnParticle(frame)
    const delay = this.reducedMotion ? 15000 : frame.wind.gust > 0.82 ? 850 : 2600
    this.nextParticleAtMs = this.elapsedMs + delay + this.random() * (this.reducedMotion ? 9000 : 3000)
  }

  private spawnParticle(frame: EnvironmentMotionFrame): void {
    const particle = this.particles.find((candidate) => !candidate.active)
    if (!particle) return
    const cell = Math.floor(this.random() * 16)
    const cellSize = 96
    const cropX = (cell % 4) * cellSize
    const cropY = Math.floor(cell / 4) * cellSize
    const size = 13 + this.random() * 16
    const startFromTree = this.random() < 0.38
    const treeStarts = [0.06, 0.25, 0.43, 0.76, 0.9]
    const startX = startFromTree
      ? this.canvas.viewportWidth * treeStarts[Math.floor(this.random() * treeStarts.length)]
      : this.canvas.viewportWidth * (-0.04 + this.random() * 0.9)
    const startY = startFromTree
      ? this.canvas.viewportHeight * (0.02 + this.random() * 0.24)
      : -size
    particle.active = true
    particle.ageMs = 0
    particle.lifetimeMs = 15000 + this.random() * 14000
    particle.velocityX = (19 + this.random() * 24) * (0.7 + frame.wind.strength * 0.62)
    particle.velocityY = (24 + this.random() * 23) * (0.78 + frame.wind.strength * 0.42)
    particle.angularVelocity = -24 + this.random() * 48
    particle.baseAlpha = 0.35 + this.random() * 0.25
    particle.image
      .setTexture(this.phaseBlend < 0.5 ? this.fromTextures.leaves : this.toTextures.leaves)
      .setCrop(cropX, cropY, cellSize, cellSize)
      .setOrigin((cropX + cellSize / 2) / 384, (cropY + cellSize / 2) / 384)
      .setScale(size / cellSize)
      .setPosition(startX, startY)
      .setAngle(this.random() * 360)
      .setAlpha(0)
      .setVisible(true)
      .setActive(true)
  }

  private deactivateParticle(particle: LeafParticle): void {
    particle.active = false
    particle.image.setVisible(false).setActive(false).setPosition(-100, -100)
  }

  private updateShadows(): void {
    const daylight = this.currentDaylight
    const angle = Math.atan2(daylight.shadowDirectionY, daylight.shadowDirectionX) * 180 / Math.PI
    const length = this.reducedMotion ? 1 + (daylight.shadowLength - 1) * 0.32 : daylight.shadowLength
    const referenceScale = this.canvas.viewportWidth / 1366
    for (const shadow of this.shadowViews) {
      shadow.image
        .setAngle(angle)
        .setDisplaySize(shadow.caster.width * referenceScale * length, Math.max(8, shadow.caster.width * referenceScale * 0.16))
        .setAlpha(daylight.shadowOpacity * shadow.weight * (this.reducedMotion ? 0.28 : 0.48))
    }
    this.shadowMasks[0]?.setAlpha(daylight.shadowOpacity * 0.055)
    this.shadowMasks[1]?.setAlpha(daylight.shadowOpacity * 0.045)
    if (this.travelerCastShadow) {
      const travelerLength = 38 * length
      this.travelerCastShadow
        .setPosition(daylight.shadowDirectionX * travelerLength * 0.26, 12 + daylight.shadowDirectionY * travelerLength * 0.15)
        .setAngle(angle)
        .setDisplaySize(travelerLength, 9)
        .setAlpha(clamp(0.06 + daylight.shadowOpacity * 0.5, 0.07, 0.18))
    }
  }

  private positionCroppedImage(image: Phaser.GameObjects.Image, bounds: ForestAssetBounds, left: number, top: number, scale: number): void {
    image.setOrigin(0.5, 0.5).setPosition(
      left + (bounds.x + bounds.width / 2) * scale,
      top + (bounds.y + bounds.height / 2) * scale
    )
  }

  private ensureShadowTexture(): void {
    if (this.scene.textures.exists('focus-environment-cast-shadow')) return
    const texture = this.scene.textures.createCanvas('focus-environment-cast-shadow', 256, 64)
    if (!texture) return
    const context = texture.getContext()
    const gradient = context.createLinearGradient(0, 32, 256, 32)
    gradient.addColorStop(0, 'rgba(7, 12, 14, 0.42)')
    gradient.addColorStop(0.34, 'rgba(8, 14, 15, 0.22)')
    gradient.addColorStop(1, 'rgba(8, 14, 15, 0)')
    context.fillStyle = gradient
    context.beginPath()
    context.ellipse(128, 32, 126, 22, 0, 0, Math.PI * 2)
    context.fill()
    texture.refresh()
  }

  private registerImage<T extends Phaser.GameObjects.Image>(image: T): T {
    this.lifecycle.add(() => { if (image.scene) image.destroy() })
    return image
  }

  private registerMesh<T extends Phaser.GameObjects.Mesh2D>(mesh: T): T {
    this.lifecycle.add(() => { if (mesh.scene) mesh.destroy() })
    return mesh
  }

  private random(): number {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0
    return this.randomState / 0x100000000
  }
}
