import Phaser from 'phaser'
import { daylightAt } from './DaylightCycle'
import type { DaylightSceneKey } from './DaylightCycle'
import { EnvironmentLifeController, type EnvironmentPhaseTextureSet } from './EnvironmentLifeController'
import {
  FOREST_ASSET_HEIGHT, FOREST_ASSET_WIDTH, FOREST_PHASE_ASSETS, FOREST_SHADOW_ASSETS,
  FOREST_VEGETATION_IDS, FOREST_WIND_PROTOTYPE_IDS, forestAtmosphereTextureKey,
  forestBackgroundTextureKey, forestShadowTextureKey, forestVegetationTextureKey,
  forestWindPrototypeTextureKey
} from './ForestEnvironmentAssets'
import type { ExplorerAnimationAdapter } from './ExplorerAnimationAdapter'
import { ExplorerBrain } from './ExplorerBrain'
import { ExplorationPlanner, shortestPath } from './ExplorationPlanner'
import { interactionFor } from './InteractionRegistry'
import type { ExplorerAnimationKey, ExplorationMapDefinition, InteractiveObjectDefinition } from './MapDefinition'
import { progressLamps, waypointById } from './MapDefinition'
import { ProgressController, type ExplorationProgressSnapshot } from './ProgressController'
import { SeededRandom } from './SeededRandom'

interface LampView {
  root: Phaser.GameObjects.Container
  shade: Phaser.GameObjects.Image
  glow: Phaser.GameObjects.Container
  halo: Phaser.GameObjects.Image
  pool: Phaser.GameObjects.Image
  flame: Phaser.GameObjects.Ellipse
  lit: boolean
}

export interface ExplorationSceneOptions {
  map: ExplorationMapDefinition
  progressSeconds: number
  targetSeconds: number
  daylightCycleSeconds?: number
  seed: number
  reducedMotion: boolean
  reportActivity: (activity: string) => void
  reportLights: (count: number) => void
}

class PhaserShapeAnimationAdapter implements ExplorerAnimationAdapter {
  private tween: Phaser.Tweens.Tween | null = null
  private shadowTween: Phaser.Tweens.Tween | null = null
  private timer: Phaser.Time.TimerEvent | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly figure: Phaser.GameObjects.Container,
    private readonly handGlow: Phaser.GameObjects.Ellipse,
    private readonly shadow: Phaser.GameObjects.Image,
    private readonly reducedMotion: boolean
  ) {}

  face(direction: -1 | 1): void {
    this.figure.setScale(direction, this.figure.scaleY)
  }

  play(key: ExplorerAnimationKey, durationMs = 1500, onComplete?: () => void): void {
    this.stop()
    if (this.reducedMotion) {
      if (key !== 'walk') this.timer = this.scene.time.delayedCall(durationMs, () => onComplete?.())
      return
    }
    if (key === 'walk') {
      this.tween = this.scene.tweens.add({
        targets: this.figure,
        y: { from: 0, to: -2.5 },
        angle: { from: -1.5, to: 1.5 },
        duration: 245,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      })
      this.shadowTween = this.scene.tweens.add({
        targets: this.shadow,
        scaleX: { from: 1, to: 0.92 },
        alpha: { from: 0.3, to: 0.24 },
        duration: 245,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      })
      return
    }

    const base = { targets: this.figure, duration: Math.max(280, durationMs / 2), yoyo: true, ease: 'Sine.InOut', onComplete }
    if (key === 'inspect') {
      this.tween = this.scene.tweens.add({ ...base, angle: 6, scaleY: 0.88 })
      this.shadow.setScale(1.08, 0.9)
    } else if (key === 'pickup') {
      this.tween = this.scene.tweens.add({ ...base, y: 5, angle: -7, scaleY: 0.82 })
      this.shadow.setScale(1.12, 0.88)
    } else if (key === 'lightLamp') {
      this.scene.tweens.add({ targets: this.handGlow, alpha: 0.15, scale: 1.35, duration: 520, yoyo: true, ease: 'Cubic.Out' })
      this.tween = this.scene.tweens.add({ ...base, angle: -8, scaleY: 0.9 })
    } else if (key === 'rest') {
      this.tween = this.scene.tweens.add({ ...base, y: 6, scaleY: 0.78, duration: Math.max(650, durationMs / 2) })
      this.shadow.setScale(1.16, 0.92)
    } else if (key === 'lookAround') {
      this.tween = this.scene.tweens.add({ ...base, angle: { from: -5, to: 5 }, duration: Math.max(480, durationMs / 2) })
    } else {
      this.tween = this.scene.tweens.add({ ...base, y: -1.6, duration: Math.max(650, durationMs / 2) })
    }
  }

  stop(): void {
    this.tween?.stop()
    this.shadowTween?.stop()
    this.timer?.remove(false)
    this.tween = null
    this.shadowTween = null
    this.timer = null
    this.figure.setY(0).setAngle(0).setScale(this.figure.scaleX < 0 ? -1 : 1, 1)
    this.shadow.setScale(1).setAlpha(0.3)
  }
}

export class ExplorationScene extends Phaser.Scene {
  private readonly options: ExplorationSceneOptions
  private readonly progress: ProgressController
  private readonly random: SeededRandom
  private progressSnapshot: ExplorationProgressSnapshot
  private planner!: ExplorationPlanner
  private brain!: ExplorerBrain
  private background?: Phaser.GameObjects.Image
  private transitionBackground?: Phaser.GameObjects.Image
  private environment?: EnvironmentLifeController
  private daylightLift?: Phaser.GameObjects.Rectangle
  private daylightCool?: Phaser.GameObjects.Rectangle
  private daylightWarm?: Phaser.GameObjects.Rectangle
  private daylightShade?: Phaser.GameObjects.Rectangle
  private traveler?: Phaser.GameObjects.Container
  private travelerLantern?: Phaser.GameObjects.Container
  private travelerShadow?: Phaser.GameObjects.Image
  private adapter?: ExplorerAnimationAdapter
  private lamps = new Map<string, LampView>()
  private busy = false
  private waitingLamp: InteractiveObjectDefinition | null = null
  private nextDecisionAt = 0
  private completionPending = false
  private softCompleted = false
  private disposed = false
  private latestProgressSeconds: number
  private created = false

  constructor(options: ExplorationSceneOptions) {
    super('focus-exploration')
    this.options = options
    const lampCount = progressLamps(options.map).length
    this.progress = new ProgressController(options.targetSeconds, lampCount)
    this.progressSnapshot = this.progress.update(options.progressSeconds)
    this.latestProgressSeconds = options.progressSeconds
    this.random = new SeededRandom(options.seed)
    // Reopening at the same time bucket resumes with the same local variation.
    this.random.skip(Math.floor(options.progressSeconds / 12))
  }

  preload(): void {
    for (const phase of ['morning', 'noon', 'afternoon', 'night'] as const) {
      const assets = FOREST_PHASE_ASSETS[phase]
      this.load.image(forestBackgroundTextureKey(phase), assets.background)
      for (const id of FOREST_VEGETATION_IDS) this.load.image(forestVegetationTextureKey(phase, id), assets.vegetation[id])
      for (const id of FOREST_WIND_PROTOTYPE_IDS) this.load.image(forestWindPrototypeTextureKey(phase, id), assets.windPrototype[id])
      this.load.image(forestAtmosphereTextureKey(phase, 'fogFar'), assets.fogFar)
      this.load.image(forestAtmosphereTextureKey(phase, 'fogMid'), assets.fogMid)
      this.load.image(forestAtmosphereTextureKey(phase, 'fogNear'), assets.fogNear)
      this.load.image(forestAtmosphereTextureKey(phase, 'leaves'), assets.leaves)
    }
    this.load.image(forestShadowTextureKey('architecture'), FOREST_SHADOW_ASSETS.architecture)
    this.load.image(forestShadowTextureKey('foliage'), FOREST_SHADOW_ASSETS.foliage)
  }

  create(): void {
    this.created = true
    const width = this.scale.width
    const height = this.scale.height
    const daylight = this.daylightSnapshot(this.options.progressSeconds)
    this.background = this.add.image(width / 2, height / 2, forestBackgroundTextureKey(daylight.fromScene)).setDepth(0)
    this.transitionBackground = this.add.image(width / 2, height / 2, forestBackgroundTextureKey(daylight.toScene)).setDepth(0.5).setAlpha(daylight.sceneBlend)
    this.fitBackground(width, height)
    this.createAtmosphere(width, height)
    this.createDaylightSystem(width, height)
    const lamps = progressLamps(this.options.map)
    this.createSoftLightTexture()
    this.createContactShadowTexture()
    this.createUnlitLampShadeTexture()
    lamps.forEach((object, index) => {
      const waypoint = waypointById(this.options.map, object.waypointId)
      const view = this.createLamp(width * waypoint.x, height * waypoint.y, index)
      this.lamps.set(object.id, view)
      this.setLamp(view, index < this.progressSnapshot.dueLampCount, true)
    })

    this.brain = new ExplorerBrain(this.options.map, this.progressSnapshot.dueLampCount)
    this.planner = new ExplorationPlanner(this.options.map, this.progress, this.random)
    const spawn = waypointById(this.options.map, this.brain.memory.currentWaypointId)
    this.traveler = this.createTraveler(width * spawn.x, height * spawn.y)
    this.traveler.setScale(this.depthScaleAt(spawn.y, spawn.depth))
    this.updateTravelerDepth()
    this.environment = new EnvironmentLifeController({
      scene: this,
      fromTextures: this.environmentTextures(daylight.fromScene),
      toTextures: this.environmentTextures(daylight.toScene),
      phaseBlend: daylight.sceneBlend,
      shadowTextureKeys: {
        architecture: forestShadowTextureKey('architecture'),
        foliage: forestShadowTextureKey('foliage')
      },
      shadowCasters: this.options.map.shadowCasters,
      canvas: { viewportWidth: width, viewportHeight: height, centerX: width / 2, centerY: height / 2, scale: 1 },
      daylight: daylight.presentation,
      reducedMotion: this.options.reducedMotion,
      windPrototypeEnabled: false,
      seed: this.options.seed,
      travelerCastShadow: this.travelerShadow
    })
    this.applyDaylight(this.options.progressSeconds)
    this.options.reportLights(this.brain.memory.litLampCount)
    this.options.reportActivity(this.brain.memory.litLampCount
      ? '旅人從上一個點亮的路標繼續前進'
      : '旅人從森林入口展開探索')

    this.time.addEvent({ delay: 500, loop: true, callback: () => this.tickBrain() })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.created = false
      this.disposed = true
      this.environment?.destroy()
      this.environment = undefined
    })
  }

  setProgress(seconds: number): void {
    this.latestProgressSeconds = seconds
    this.progressSnapshot = this.progress.update(seconds)
    if (!this.created) return
    this.applyDaylight(seconds)
    if (
      this.progressSnapshot.ratio >= 1 &&
      !this.softCompleted &&
      this.brain?.memory.litLampCount === progressLamps(this.options.map).length
    ) this.completionPending = true
    this.tickBrain()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.options.reducedMotion = reducedMotion
    this.environment?.setReducedMotion(reducedMotion)
  }

  private tickBrain(): void {
    if (this.disposed || this.softCompleted || !this.brain || !this.planner || this.busy) return
    if (this.completionPending) {
      this.beginSoftCompletion()
      return
    }
    if (this.time.now < this.nextDecisionAt) return
    if (this.waitingLamp) {
      const milestoneIndex = this.waitingLamp.milestoneIndex ?? 0
      if (this.progress.isMilestoneDue(milestoneIndex)) {
        const lamp = this.waitingLamp
        this.waitingLamp = null
        this.performInteraction(lamp)
      } else {
        this.busy = true
        const ambient = this.random.next() > 0.64 ? 'lookAround' : 'idle'
        this.options.reportActivity(ambient === 'lookAround' ? '在路旁觀察遠處' : '在路旁安靜等候')
        this.adapter?.play(ambient, Math.round(this.random.range(2600, 4200)), () => {
          this.busy = false
          this.nextDecisionAt = this.time.now + this.random.range(2200, 4200)
        })
      }
      return
    }
    this.chooseAndTravel()
  }

  private beginSoftCompletion(): void {
    if (!this.brain || !this.adapter || this.softCompleted) return
    this.completionPending = false
    this.busy = true
    const rest = this.options.map.restAnchor
    const path = shortestPath(this.options.map, this.brain.memory.currentWaypointId, rest.waypointId)
    this.options.reportActivity(`這一段路已走完，旅人前往${rest.label}休息`)
    this.walkPath(path, 0.92, () => {
      this.brain.memory.currentWaypointId = rest.waypointId
      this.softCompleted = true
      this.busy = true
      this.options.reportActivity(`旅人在${rest.label}整理筆記`)
      this.holdCompletionRest()
    })
  }

  private holdCompletionRest(): void {
    if (!this.softCompleted || !this.adapter) return
    this.adapter.play('rest', 5200, () => this.holdCompletionRest())
  }

  private chooseAndTravel(): void {
    const target = this.brain.choose(this.planner, this.progressSnapshot)
    this.brain.beginWalking()
    const crossesBridge = target.path.some((id) => waypointById(this.options.map, id).tags.includes('bridge'))
    this.options.reportActivity(crossesBridge ? '正在穿過石橋' : '沿石路前進')
    this.walkPath(target.path, target.speedScale, () => {
      this.brain.arrive(target.object.waypointId, target.waitForMilestone)
      if (target.mandatory && target.waitForMilestone && !this.progress.isMilestoneDue(target.object.milestoneIndex ?? 0)) {
        this.waitingLamp = target.object
        this.busy = false
        this.tickBrain()
      } else {
        this.performInteraction(target.object)
      }
    })
  }

  private walkPath(path: string[], speedScale: number, onComplete: () => void): void {
    if (!this.traveler || !this.adapter) return
    const remaining = path.slice(1)
    this.busy = true
    this.adapter.play('walk')

    const walkSegment = (): void => {
      const nextId = remaining.shift()
      if (!nextId || !this.traveler || !this.adapter) {
        this.adapter?.stop()
        this.busy = false
        onComplete()
        return
      }
      const waypoint = waypointById(this.options.map, nextId)
      const x = this.scale.width * waypoint.x
      const y = this.scale.height * waypoint.y
      const distance = Phaser.Math.Distance.Between(this.traveler.x, this.traveler.y, x, y)
      const depthScale = this.depthScaleAt(waypoint.y, waypoint.depth)
      this.adapter.face(x < this.traveler.x ? -1 : 1)
      this.tweens.add({
        targets: this.traveler,
        x,
        y,
        scaleX: depthScale,
        scaleY: depthScale,
        duration: Phaser.Math.Clamp((distance / 38) * 1000 / Math.min(1.08, speedScale), 650, 5200),
        ease: 'Sine.InOut',
        onUpdate: () => this.updateTravelerDepth(),
        onComplete: walkSegment
      })
    }
    walkSegment()
  }

  private performInteraction(object: InteractiveObjectDefinition): void {
    if (!this.adapter) return
    const presentation = interactionFor(object)
    const waypoint = waypointById(this.options.map, object.waypointId)
    this.busy = true
    this.adapter.stop()
    if (presentation.facingRequired) this.adapter.face(object.facingHint ?? waypoint.facingHint ?? 1)
    this.options.reportActivity(presentation.arrivalActivity)
    this.adapter.play('idle', presentation.arrivalPauseMs, () => {
      this.brain.beginInteraction(object.type)
      if (object.type === 'treasure') this.createPickupCue()
      this.adapter?.play(presentation.animationKey, presentation.durationMs, () => {
        if (object.type === 'lamp') {
          const view = this.lamps.get(object.id)
          if (view) this.setLamp(view, true, false)
        }
        this.adapter?.play('idle', presentation.recoveryPauseMs, () => {
          const currentTarget = this.brain.currentTarget
          if (currentTarget) this.brain.completeInteraction(currentTarget)
          this.options.reportLights(this.brain.memory.litLampCount)
          this.options.reportActivity(presentation.completionActivity)
          this.nextDecisionAt = this.time.now + this.random.range(3200, 6500)
          this.busy = false
          if (
            this.progressSnapshot.ratio >= 1 &&
            this.brain.memory.litLampCount === progressLamps(this.options.map).length
          ) this.completionPending = true
          this.tickBrain()
        })
      })
    })
  }

  private environmentTextures(phase: DaylightSceneKey): EnvironmentPhaseTextureSet {
    return {
      phase,
      vegetation: Object.fromEntries(FOREST_VEGETATION_IDS.map((id) => [id, forestVegetationTextureKey(phase, id)])) as EnvironmentPhaseTextureSet['vegetation'],
      windPrototype: Object.fromEntries(FOREST_WIND_PROTOTYPE_IDS.map((id) => [id, forestWindPrototypeTextureKey(phase, id)])) as EnvironmentPhaseTextureSet['windPrototype'],
      fogFar: forestAtmosphereTextureKey(phase, 'fogFar'),
      fogMid: forestAtmosphereTextureKey(phase, 'fogMid'),
      fogNear: forestAtmosphereTextureKey(phase, 'fogNear'),
      leaves: forestAtmosphereTextureKey(phase, 'leaves')
    }
  }

  private createAtmosphere(width: number, height: number): void {
    this.add.rectangle(width / 2, height / 2, width, height, 0x06101a, 0.075).setDepth(1)
  }

  private createDaylightSystem(width: number, height: number): void {
    this.daylightLift = this.add.rectangle(width / 2, height / 2, width, height, 0xcdd7d3, 0).setDepth(4).setBlendMode(Phaser.BlendModes.SCREEN)
    this.daylightCool = this.add.rectangle(width / 2, height / 2, width, height, 0x587183, 0).setDepth(5)
    this.daylightWarm = this.add.rectangle(width / 2, height / 2, width, height, 0x8f5f43, 0).setDepth(6)
    this.daylightShade = this.add.rectangle(width / 2, height / 2, width, height, 0x020609, 0).setDepth(7)
  }

  private applyDaylight(seconds: number): void {
    const daylight = this.daylightSnapshot(seconds)
    const fromTexture = forestBackgroundTextureKey(daylight.fromScene)
    const toTexture = forestBackgroundTextureKey(daylight.toScene)
    if (this.background?.texture.key !== fromTexture) this.background?.setTexture(fromTexture)
    if (this.transitionBackground?.texture.key !== toTexture) this.transitionBackground?.setTexture(toTexture)
    this.background?.setAlpha(1)
    this.transitionBackground?.setAlpha(daylight.fromScene === daylight.toScene ? 0 : daylight.sceneBlend)
    this.environment?.setPhaseTextures(this.environmentTextures(daylight.fromScene), this.environmentTextures(daylight.toScene), daylight.sceneBlend)
    this.environment?.setDaylight(daylight.presentation)
    this.daylightLift?.setAlpha(daylight.liftAlpha)
    this.daylightCool?.setAlpha(daylight.coolAlpha)
    this.daylightWarm?.setAlpha(daylight.warmAlpha)
    this.daylightShade?.setAlpha(daylight.shadeAlpha)
    this.lamps.forEach((lamp) => {
      lamp.glow.setAlpha(daylight.lampAlpha)
      if (!lamp.lit) lamp.shade.setAlpha(daylight.unlitLampShadeAlpha)
    })
    this.travelerLantern?.setAlpha(daylight.lanternAlpha)
    this.travelerShadow?.setAlpha(0.2 + daylight.shadowAlpha * 0.25)
  }

  private createLamp(x: number, y: number, index: number): LampView {
    const root = this.add.container(x, y).setDepth(20 + index)
    const shade = this.add.image(0, 3, 'focus-unlit-lamp-shade')
      .setDisplaySize(index === 0 ? 220 : 168, index === 0 ? 124 : 98)
      .setAlpha(0)
    const glow = this.add.container(0, 0)
    const pool = this.add.image(0, 9, 'focus-soft-light').setDisplaySize(index === 0 ? 190 : 150, index === 0 ? 92 : 72).setAlpha(0).setAngle(-8)
    const halo = this.add.image(0, -4, 'focus-soft-light').setDisplaySize(104, 86).setAlpha(0)
    const frame = this.add.graphics()
    frame.lineStyle(1.2, 0x807258, 0.45)
    frame.beginPath(); frame.moveTo(-4, 8); frame.lineTo(-4, -7); frame.lineTo(0, -14); frame.lineTo(4, -7); frame.lineTo(4, 8); frame.strokePath()
    frame.lineBetween(-7, 8, 7, 8)
    const flame = this.add.ellipse(0, -5, 7, 11, 0xf0c77e, 1).setAlpha(0)
    glow.add([pool, halo, flame])
    root.add([shade, glow, frame])
    return { root, shade, glow, halo, pool, flame, lit: false }
  }

  private setLamp(lamp: LampView, lit: boolean, instant: boolean): void {
    lamp.lit = lit
    if (!lit) {
      lamp.shade.setAlpha(this.daylightSnapshot(this.progressSnapshot.elapsedSeconds).unlitLampShadeAlpha)
      lamp.halo.setAlpha(0); lamp.pool.setAlpha(0); lamp.flame.setAlpha(0)
      return
    }
    if (instant) {
      lamp.shade.setAlpha(0)
      lamp.halo.setAlpha(0.36).setScale(1)
      lamp.pool.setAlpha(0.25).setScale(1)
      lamp.flame.setAlpha(0.88)
      if (!this.options.reducedMotion) this.tweens.add({ targets: lamp.halo, alpha: { from: 0.33, to: 0.39 }, scale: { from: 0.985, to: 1.015 }, duration: 3600, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      return
    }
    const duration = 1400
    lamp.halo.setScale(0.88); lamp.pool.setScale(0.9)
    this.tweens.add({ targets: lamp.shade, alpha: 0, duration: duration + 200, ease: 'Sine.Out' })
    this.tweens.add({ targets: lamp.halo, alpha: 0.36, scale: 1, duration, ease: 'Sine.Out' })
    this.tweens.add({ targets: lamp.pool, alpha: 0.25, scale: 1, duration: duration + 260, ease: 'Sine.Out' })
    this.tweens.add({ targets: lamp.flame, alpha: 0.88, duration: duration * 0.7, ease: 'Sine.Out' })
    if (!this.options.reducedMotion) this.tweens.add({ targets: lamp.halo, alpha: { from: 0.33, to: 0.39 }, scale: { from: 0.985, to: 1.015 }, delay: duration, duration: 3600, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
  }

  private createTraveler(x: number, y: number): Phaser.GameObjects.Container {
    const root = this.add.container(x, y).setDepth(60)
    const shadow = this.add.image(0, 13, 'focus-contact-shadow').setDisplaySize(35, 13).setAlpha(0.3)
    this.travelerShadow = shadow
    const figure = this.add.container(0, 0).setAlpha(0.92)
    const coat = this.add.graphics()
    coat.fillStyle(0x111c25, 0.94)
    const coatPoints = [
      new Phaser.Math.Vector2(-8, -6),
      new Phaser.Math.Vector2(7, -7),
      new Phaser.Math.Vector2(11, 11),
      new Phaser.Math.Vector2(2, 17),
      new Phaser.Math.Vector2(-10, 12)
    ]
    coat.fillPoints(coatPoints, true)
    coat.lineStyle(1, 0x52636a, 0.34); coat.strokePoints(coatPoints, true)
    const head = this.add.circle(-1, -13, 5.5, 0x786f66, 0.86).setStrokeStyle(1, 0x1a2328, 0.7)
    const hood = this.add.arc(-1, -13, 7, 190, 355, false, 0x17232d, 0.96).setAngle(-6)
    const backpack = this.add.rectangle(8, 0, 7, 11, 0x41443f, 0.78).setAngle(-8)
    const handLamp = this.add.container(-10, 5)
    this.travelerLantern = handLamp
    const handGlow = this.add.ellipse(0, 0, 26, 20, 0xc99a56, 0.045)
    const handCore = this.add.circle(0, 0, 2, 0xd2aa6a, 0.82)
    handLamp.add([handGlow, handCore])
    if (!this.options.reducedMotion) this.tweens.add({ targets: handGlow, alpha: { from: 0.035, to: 0.052 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    figure.add([coat, head, hood, backpack, handLamp])
    root.add([shadow, figure])
    this.adapter = new PhaserShapeAnimationAdapter(this, figure, handGlow, shadow, this.options.reducedMotion)
    return root
  }

  private createSoftLightTexture(): void {
    if (this.textures.exists('focus-soft-light')) return
    const texture = this.textures.createCanvas('focus-soft-light', 256, 256)
    if (!texture) return
    const context = texture.getContext()
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(242, 203, 132, 0.92)')
    gradient.addColorStop(0.2, 'rgba(226, 178, 103, 0.62)')
    gradient.addColorStop(0.52, 'rgba(190, 133, 69, 0.25)')
    gradient.addColorStop(0.8, 'rgba(148, 94, 45, 0.07)')
    gradient.addColorStop(1, 'rgba(120, 70, 30, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 256)
    texture.refresh()
  }

  private createContactShadowTexture(): void {
    if (this.textures.exists('focus-contact-shadow')) return
    const texture = this.textures.createCanvas('focus-contact-shadow', 128, 48)
    if (!texture) return
    const context = texture.getContext()
    const gradient = context.createRadialGradient(64, 24, 2, 64, 24, 60)
    gradient.addColorStop(0, 'rgba(0, 3, 6, 0.78)')
    gradient.addColorStop(0.48, 'rgba(0, 3, 6, 0.34)')
    gradient.addColorStop(1, 'rgba(0, 3, 6, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 48)
    texture.refresh()
  }

  private createUnlitLampShadeTexture(): void {
    if (this.textures.exists('focus-unlit-lamp-shade')) return
    const texture = this.textures.createCanvas('focus-unlit-lamp-shade', 256, 160)
    if (!texture) return
    const context = texture.getContext()
    const gradient = context.createRadialGradient(128, 80, 4, 128, 80, 126)
    gradient.addColorStop(0, 'rgba(2, 6, 10, 0.98)')
    gradient.addColorStop(0.42, 'rgba(3, 8, 13, 0.86)')
    gradient.addColorStop(0.72, 'rgba(4, 10, 16, 0.36)')
    gradient.addColorStop(1, 'rgba(4, 10, 16, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 160)
    texture.refresh()
  }

  private createPickupCue(): void {
    if (!this.traveler || this.options.reducedMotion) return
    const paper = this.add.rectangle(this.traveler.x + 8, this.traveler.y + 3, 5, 7, 0xa79c85, 0.55).setAngle(-12).setDepth(61)
    this.tweens.add({
      targets: paper,
      x: this.traveler.x + 4,
      y: this.traveler.y - 1,
      alpha: 0,
      scale: 0.65,
      angle: 4,
      duration: 900,
      ease: 'Sine.InOut',
      onComplete: () => paper.destroy()
    })
  }

  private fitBackground(width: number, height: number): void {
    if (!this.background) return
    const scale = Math.min(width / FOREST_ASSET_WIDTH, height / FOREST_ASSET_HEIGHT)
    this.background.setPosition(width / 2, height / 2).setScale(scale)
    this.transitionBackground?.setPosition(width / 2, height / 2).setScale(scale)
  }

  private depthScaleAt(normalizedY: number, fallback: number): number {
    const zone = this.options.map.depthZones.find((candidate) => normalizedY >= candidate.minY && normalizedY <= candidate.maxY)
    if (!zone) return fallback
    const amount = (normalizedY - zone.minY) / Math.max(0.0001, zone.maxY - zone.minY)
    return Phaser.Math.Linear(zone.minScale, zone.maxScale, amount)
  }

  private daylightSnapshot(seconds: number): ReturnType<typeof daylightAt> {
    return daylightAt(seconds, this.options.daylightCycleSeconds)
  }

  private updateTravelerDepth(): void {
    if (!this.traveler) return
    const normalizedY = this.traveler.y / Math.max(1, this.scale.height)
    this.traveler.setDepth(42 + normalizedY * 32)
  }
}
