import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { ExplorationScene } from './exploration/ExplorationScene'
import { FOREST_MAP } from './exploration/MapDefinition'
import { hashExplorationSeed } from './exploration/SeededRandom'
import { FOREST_ASSET_HEIGHT, FOREST_ASSET_WIDTH } from './exploration/ForestEnvironmentAssets'

interface FocusExplorationGameProps {
  progressSeconds: number
  targetSeconds: number
  sessionId: string
  runSeed: number
  nodeId: string
  onActivityChange?: (activity: string) => void
  onLightsChange?: (count: number) => void
}

// React owns the timer and lifecycle. Phaser owns only presentation; it can
// never advance productivity progress or write task state.
export function FocusExplorationGame({
  progressSeconds,
  targetSeconds,
  sessionId,
  runSeed,
  nodeId,
  onActivityChange,
  onLightsChange
}: FocusExplorationGameProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<ExplorationScene | null>(null)
  const activityCallback = useRef(onActivityChange)
  const lightsCallback = useRef(onLightsChange)
  const seed = hashExplorationSeed(runSeed, nodeId, sessionId)

  useEffect(() => { activityCallback.current = onActivityChange }, [onActivityChange])
  useEffect(() => { lightsCallback.current = onLightsChange }, [onLightsChange])

  useEffect(() => {
    if (!host.current) return
    const debugCycleSeconds = import.meta.env.DEV ? Number(import.meta.env.VITE_DAYLIGHT_DEBUG_CYCLE_SECONDS) : Number.NaN
    const nextScene = new ExplorationScene({
      map: FOREST_MAP,
      progressSeconds,
      targetSeconds,
      daylightCycleSeconds: Number.isFinite(debugCycleSeconds) ? Math.max(30, debugCycleSeconds) : undefined,
      seed,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      reportActivity: (activity) => activityCallback.current?.(activity),
      reportLights: (count) => lightsCallback.current?.(count)
    })
    scene.current = nextScene
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: '#050a10',
      width: FOREST_ASSET_WIDTH,
      height: FOREST_ASSET_HEIGHT,
      transparent: false,
      scene: nextScene,
      render: { antialias: true, roundPixels: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
    })
    const observer = new ResizeObserver(() => game.scale.refresh())
    observer.observe(host.current)
    return () => {
      observer.disconnect()
      scene.current = null
      game.destroy(true)
    }
  }, [seed, sessionId, targetSeconds])

  useEffect(() => { scene.current?.setProgress(progressSeconds) }, [progressSeconds])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => scene.current?.setReducedMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return <div
    className="focus-exploration-game biome-forest"
    ref={host}
    aria-label="遺忘索引林自動探索畫面"
  />
}
