import { useEffect, useRef, useState } from 'react'
import { createMossStationScene, type MossDepartureCue, type MossStationSceneHandle } from './mossStation/mossStationScene'
import type { CloudRuinsChrome } from './cloudRuins/cloudRuinsScene'
import type { MossSceneSnapshot } from '../../shared/area02'
import { leaveSceneForLobby } from './cloudRuins/sceneHandoff'
import { createMossSoundscape, type MossAudioSettings } from './mossStation/mossStationAudio'

// Same glass contract as 雲上遺庭 (CloudRuinsFocusScene): the scene draws its own glass under the
// [data-glass="top"] header band, the [data-glass="bottom"] footer and the [data-glass-card]/[data-glass-zone] areas.
function measureGlassChrome(host: HTMLElement): CloudRuinsChrome {
  const root = host.closest('.focus-active') ?? host.parentElement ?? host
  const hostRect = host.getBoundingClientRect()
  const top = root.querySelector('[data-glass="top"]')
  const bottom = root.querySelector('[data-glass="bottom"]')
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-glass-card], [data-glass-zone]')).map((element) => {
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left - hostRect.left, y: rect.top - hostRect.top, w: rect.width, h: rect.height,
      kind: element.hasAttribute('data-glass-zone') ? 'zone' as const : 'pill' as const
    }
  }).filter((card) => card.w > 0 && card.h > 0)
  return {
    top: top ? Math.max(0, top.getBoundingClientRect().bottom - hostRect.top) : 0,
    bottom: bottom ? Math.max(0, hostRect.bottom - bottom.getBoundingClientRect().top) : 0,
    cards
  }
}

interface MossStationFocusSceneProps {
  quietFocus?: boolean
  audioActive?: boolean
  audioSettings?: MossAudioSettings
  /** Saved presentation state of this node (snapshot.mossStation / getMossScene). May arrive after mount. */
  moss: MossSceneSnapshot | null
  progressSeconds: number
  targetSeconds: number
  sessionId: string
  nodeId: string
  /** The leave animation from the previous station (getMossDeparture), with that station's saved state. */
  departure: MossDepartureCue | null
  departureState: MossSceneSnapshot | null
  departureElapsedMs: number
  /** Mounted right after another Area's departure: start under the mist and let it lift. */
  arriveFromMist?: boolean
  paused: boolean
  /** Review keeps this renderer and hands it to the returning lobby. */
  retainForLobby?: boolean
  uiFade?: number
  onActivityChange?: (activity: string) => void
  onCinematicChange?: (active: boolean) => void
  departureOnly?: boolean
  onDepartureComplete?: () => void
  onReady?: () => void
}

// Presentation only: the main process owns time, the traveller's saved schedule, weather and results.
export function MossStationFocusScene({
  quietFocus = false, moss, progressSeconds, targetSeconds, sessionId, nodeId, departure, departureState, departureElapsedMs,
  arriveFromMist = false, departureOnly = false, paused, retainForLobby = false, audioActive = true, uiFade = 1, onActivityChange, onCinematicChange, onDepartureComplete, onReady, audioSettings = { environmentVolume: 35, musicVolume: 12 }
}: MossStationFocusSceneProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<MossStationSceneHandle | null>(null)
  const [failed, setFailed] = useState(false)
  const audio = useRef<ReturnType<typeof createMossSoundscape> | null>(null)
  useEffect(() => {
    if (departureOnly || !moss) return
    try { audio.current = createMossSoundscape(moss.weatherSeed) } catch { return }
    return () => { audio.current?.dispose(); audio.current = null }
  }, [sessionId, nodeId, departureOnly, moss?.weatherSeed])
  useEffect(() => {
    audio.current?.update(progressSeconds, audioSettings, paused || retainForLobby || !audioActive)
  }, [progressSeconds, paused, retainForLobby, audioActive, audioSettings.audioMuted, audioSettings.environmentVolume, audioSettings.musicVolume, moss?.weatherSeed])
  const activityCallback = useRef(onActivityChange)
  const cinematicCallback = useRef(onCinematicChange)
  const readyCallback = useRef(onReady)
  readyCallback.current = onReady
  const departureCallback = useRef(onDepartureComplete)
  const retainOnUnmount = useRef(retainForLobby)
  retainOnUnmount.current = retainForLobby
  const mountState = useRef({ moss, progressSeconds, departure, departureState, departureElapsedMs, paused, arriveFromMist })
  mountState.current = { moss, progressSeconds, departure, departureState, departureElapsedMs, paused, arriveFromMist }
  useEffect(() => { activityCallback.current = onActivityChange }, [onActivityChange])
  useEffect(() => { cinematicCallback.current = onCinematicChange }, [onCinematicChange])
  useEffect(() => { departureCallback.current = onDepartureComplete }, [onDepartureComplete])

  useEffect(() => {
    if (!host.current) return
    const initial = mountState.current
    let handle: MossStationSceneHandle
    try {
      handle = createMossStationScene(host.current, {
        quietFocus,
        progressSeconds: initial.progressSeconds,
        targetSeconds,
        moss: initial.moss,
        departure: initial.departure,
        departureOnly,
        departureState: initial.departureState,
        departureElapsedMs: initial.departureElapsedMs,
        arriveFromMist: initial.arriveFromMist,
        paused: initial.paused,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        reportActivity: (activity) => activityCallback.current?.(activity),
        reportCinematic: (active) => cinematicCallback.current?.(active),
        reportReady: () => {
          if (host.current) host.current.dataset.sceneReady = 'true'
          readyCallback.current?.()
        },
        reportDepartureComplete: () => departureCallback.current?.()
      })
    } catch (reason) {
      console.error('苔痕驛站畫面無法建立', reason)
      setFailed(true)
      readyCallback.current?.()
      // No scene, no departure to wait for: let the next Area show at once.
      if (initial.departure) departureCallback.current?.()
      return
    }
    setFailed(false)
    scene.current = handle
    // An IPC or slow mount can outlive the cue; do not strand a paused cross-map departure.
    if (initial.departure && initial.departureElapsedMs >= initial.departure.durationMs) departureCallback.current?.()
    if (import.meta.env.DEV) (window as unknown as { __mossScene?: MossStationSceneHandle }).__mossScene = handle
    const hostElement = host.current
    let measureFrame = 0
    const syncChrome = (): void => {
      if (measureFrame) return
      measureFrame = window.requestAnimationFrame(() => { measureFrame = 0; handle.setChrome(measureGlassChrome(hostElement)) })
    }
    syncChrome()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(syncChrome) : null
    const root = hostElement.closest('.focus-active') ?? hostElement.parentElement
    observer?.observe(hostElement)
    root?.querySelectorAll('[data-glass], [data-glass-card], [data-glass-zone]').forEach((element) => observer?.observe(element))
    window.addEventListener('resize', syncChrome)
    return () => {
      window.removeEventListener('resize', syncChrome)
      observer?.disconnect()
      if (measureFrame) window.cancelAnimationFrame(measureFrame)
      scene.current = null
      cinematicCallback.current?.(false)
      if (retainOnUnmount.current) leaveSceneForLobby(handle)
      else handle.destroy()
    }
  }, [sessionId, nodeId, targetSeconds])

  useEffect(() => { scene.current?.setProgress(progressSeconds) }, [progressSeconds])
  // A newer save (next action, weather seed, marks, umbrella, core). Same object = nothing new.
  useEffect(() => { if (moss) scene.current?.setMossState(moss) }, [moss])
  useEffect(() => { scene.current?.setPaused(paused) }, [paused])
  useEffect(() => { scene.current?.setUiFade(uiFade) }, [uiFade])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => scene.current?.setReducedMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(()=>{scene.current?.setQuietFocus(!!quietFocus)},[quietFocus])
  return <div className="focus-exploration-game biome-cloud-ruins biome-moss-station" ref={host} aria-label="苔痕驛站自動探索畫面">
    {failed && <p className="cloud-ruins-fallback">探索畫面暫時無法顯示，專注時間照常累積。</p>}
  </div>
}
