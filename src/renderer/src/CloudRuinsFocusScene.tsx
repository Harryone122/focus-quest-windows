import { useEffect, useRef, useState } from 'react'
import { createCloudRuinsScene, type CloudRuinsChrome, type CloudRuinsSceneHandle } from './cloudRuins/cloudRuinsScene'
import type { AppSettings, AppSnapshot, AreaDepartureCue, SpecialFindAcquisition } from '../../shared/types'
import { leaveSceneForLobby } from './cloudRuins/sceneHandoff'
import { weatherSeedFrom } from '../../shared/weather'
import { createCloudRuinsAudio } from './cloudRuins/cloudRuinsAudio'

// The scene draws its own glass under the Focus Active text (one scene, no CSS backdrop-filter over
// WebGL). It needs to know where that text sits: [data-glass="top"] (header band), [data-glass="bottom"]
// (footer band), [data-glass-card] (crisp glass pills) and [data-glass-zone] (soft zones behind text).
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

interface CloudRuinsFocusSceneProps {
  audioActive?: boolean
  audioSettings?: Pick<AppSettings, 'environmentVolume' | 'musicVolume' | 'audioMuted'>
  progressSeconds: number
  targetSeconds: number
  sessionId: string
  seed: number
  departure: AreaDepartureCue | null
  /** Milliseconds of this Focus already elapsed (pause excluded) when the scene mounts. */
  departureElapsedMs: number
  specialFinds: SpecialFindAcquisition[]
  /** activeSession.suspendedAt !== null (or the requested state while a pause/resume is saving). */
  paused: boolean
  /** Review retains this renderer, then transfers it to the returning lobby. */
  retainForLobby?: boolean
  /** The Area's permanent core is already owned (later visits show the empty astrolabe cradle). */
  coreTaken?: boolean
  /** Saved one-time world marks for this Area, e.g. 'tree_traces_seen'. Omit until the back end stores them. */
  worldMarks?: string[]
  story?: AppSnapshot['cloudStory']
  onStoryRecord?: (clueId: string) => void
  onCinematicChange?: (active: boolean) => void
  /** A one-time world moment finished playing (presentation signal; save it so it does not repeat). */
  onWorldMark?: (mark: string) => void
  /** Immersive mode: opacity of the glass under the text (1 = normal). */
  uiFade?: number
  onActivityChange?: (activity: string) => void
  arriveFromMist?: boolean
  departureOnly?: boolean
  onDepartureComplete?: () => void
  onReady?: () => void
}

// React owns the timer, the saved session and Debrief. The 3D scene only presents
// them: it never advances focus time and nothing waits for its animations.
export function CloudRuinsFocusScene({
  audioSettings,
  audioActive = true,
  progressSeconds,
  targetSeconds,
  sessionId,
  seed,
  departure,
  departureElapsedMs,
  specialFinds,
  paused,
  retainForLobby = false,
  coreTaken = false,
  worldMarks,
  story,
  onStoryRecord,
  onCinematicChange,
  onWorldMark,
  uiFade = 1,
  onActivityChange,
  onDepartureComplete,
  onReady,
  arriveFromMist = false,
  departureOnly = false
}: CloudRuinsFocusSceneProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<CloudRuinsSceneHandle | null>(null)
  const audio = useRef<ReturnType<typeof createCloudRuinsAudio> | null>(null)
  const environmentVolume = audioSettings?.environmentVolume ?? 35
  const musicVolume = audioSettings?.musicVolume ?? 12
  const audioMuted = audioSettings?.audioMuted ?? false
  const audioState = useRef({ progressSeconds, paused: paused || retainForLobby || !audioActive, muted: audioMuted, environmentVolume, musicVolume })
  audioState.current = { progressSeconds, paused: paused || retainForLobby || !audioActive, muted: audioMuted, environmentVolume, musicVolume }
  const shownFindIds = useRef(new Set(specialFinds.map((find) => find.id)))
  const [failed, setFailed] = useState(false)
  const activityCallback = useRef(onActivityChange)
  const readyCallback = useRef(onReady)
  readyCallback.current = onReady
  const departureCallback = useRef(onDepartureComplete)
  // Values read once when the scene mounts; later renders only stream progress.
  const worldMarkCallback = useRef(onWorldMark)
  const storyRecordCallback = useRef(onStoryRecord)
  const cinematicCallback = useRef(onCinematicChange)
  const retainOnUnmount = useRef(retainForLobby)
  retainOnUnmount.current = retainForLobby
  const mountState = useRef({ progressSeconds, departure, departureElapsedMs, paused, coreTaken, worldMarks, arriveFromMist })
  mountState.current = { progressSeconds, departure, departureElapsedMs, paused, coreTaken, worldMarks, arriveFromMist }

  useEffect(() => { activityCallback.current = onActivityChange }, [onActivityChange])
  useEffect(() => { departureCallback.current = onDepartureComplete }, [onDepartureComplete])
  useEffect(() => { worldMarkCallback.current = onWorldMark }, [onWorldMark])
  useEffect(() => { storyRecordCallback.current = onStoryRecord }, [onStoryRecord])
  useEffect(() => { cinematicCallback.current = onCinematicChange }, [onCinematicChange])

  useEffect(() => {
    if (departureOnly) return
    let handle: ReturnType<typeof createCloudRuinsAudio>
    try { handle = createCloudRuinsAudio(audioState.current) } catch { return }
    audio.current = handle
    return () => { audio.current = null; handle.destroy() }
  }, [sessionId, departureOnly])
  useEffect(() => { audio.current?.update(audioState.current) }, [progressSeconds, paused, retainForLobby, audioActive, audioMuted, environmentVolume, musicVolume])

  useEffect(() => {
    if (!host.current) return
    const initial = mountState.current
    let handle: CloudRuinsSceneHandle
    try {
      handle = createCloudRuinsScene(host.current, {
        progressSeconds: initial.progressSeconds,
        targetSeconds,
        seed,
        whaleSeed: story?.whaleSeed ?? weatherSeedFrom(sessionId),
        story: departureOnly ? null : story,
        reportStoryRecord: (clueId) => storyRecordCallback.current?.(clueId),
        reportCinematic: (active) => cinematicCallback.current?.(active),
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        departure: initial.departure,
        departureOnly,
        arriveFromMist: initial.arriveFromMist,
        departureElapsedMs: initial.departureElapsedMs,
        // A Focus reopened while paused is built already frozen: no frames play before it stops.
        paused: initial.paused,
        coreTaken: initial.coreTaken,
        worldMarks: initial.worldMarks,
        reportWorldMark: (mark) => worldMarkCallback.current?.(mark),
        reportActivity: (activity) => activityCallback.current?.(activity),
        reportReady: () => {
          if (host.current) host.current.dataset.sceneReady = 'true'
          readyCallback.current?.()
        },
        reportDepartureComplete: () => departureCallback.current?.()
      })
    } catch (reason) {
      // WebGL unavailable or a broken asset: the Focus itself keeps running.
      console.error('雲上遺庭畫面無法建立', reason)
      setFailed(true)
      readyCallback.current?.()
      if (initial.departure) departureCallback.current?.()
      return
    }
    setFailed(false)
    scene.current = handle
    // An IPC or slow mount can outlive the cue; do not strand a paused cross-map departure.
    if (initial.departure && initial.departureElapsedMs >= initial.departure.durationMs) departureCallback.current?.()
    // Keep the glass under the header / status pill in step with layout and text changes.
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
      if (retainOnUnmount.current) leaveSceneForLobby(handle)
      else handle.destroy()
    }
  }, [sessionId, targetSeconds, seed])

  useEffect(() => { scene.current?.setProgress(progressSeconds) }, [progressSeconds])
  // Pausing never rebuilds the scene (paused is not a dependency of the mount effect above).
  useEffect(() => { scene.current?.setPaused(paused) }, [paused])
  useEffect(() => { scene.current?.setUiFade(uiFade) }, [uiFade])
  useEffect(() => {
    for (const find of specialFinds) {
      if (shownFindIds.current.has(find.id)) continue
      shownFindIds.current.add(find.id)
      scene.current?.playSpecialFind(find.eventId, Boolean(find.specifiedByCore))
    }
  }, [specialFinds])
  // Declared after the special-find effect on purpose: a core found right now is queued first, so the
  // scene keeps the astrolabe full until that reveal has played.
  const worldMarksKey = worldMarks ? worldMarks.join('|') : ''
  useEffect(() => {
    scene.current?.setWorldState({ coreTaken, worldMarks: worldMarksKey ? worldMarksKey.split('|') : undefined })
  }, [coreTaken, worldMarksKey])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => scene.current?.setReducedMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return <div className="focus-exploration-game biome-cloud-ruins" ref={host} aria-label="雲上遺庭自動探索畫面">
    {failed && <p className="cloud-ruins-fallback">探索畫面暫時無法顯示，專注時間照常累積。</p>}
  </div>
}
