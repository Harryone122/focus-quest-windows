import { createGlassNurseryScene } from '../glassNursery/glassNurseryScene'
import { createReflectionLakeScene } from '../reflectionLake/reflectionLakeScene'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  createCloudRuinsScene,
  type CloudRuinsAnchors,
  type CloudRuinsChrome,
  type CloudRuinsLobbyView,
  type CloudRuinsRouteMark,
  type CloudRuinsSceneHandle
} from '../cloudRuins/cloudRuinsScene'
import { createMossStationScene, type MossLobbyView, type MossRouteMark, type MossStationSceneHandle, type MossStationSceneOptions } from '../mossStation/mossStationScene'
import { leaveSceneForLobby, takeSceneForLobby, type AreaSceneHandle } from '../cloudRuins/sceneHandoff'
import type { CloudRuinsSceneOptions } from '../cloudRuins/cloudRuinsScene'
import type { LobbyExit, LobbySceneKey } from './lobbyTypes'

/** A route marker on either Area; exits of another Area are ignored by the scene. */
export interface StageRouteMark { key: string; exit: LobbyExit | 'entry' | null; state: 'selected' | 'available' | 'partial' }
export type StageView = { kind: 'close' } | { kind: 'look'; exit: LobbyExit } | { kind: 'overview' }
const isMoss = (scene: AreaSceneHandle): scene is MossStationSceneHandle => 'areaId' in scene && scene.areaId === 'area-02-moss-station'
const MOSS_EXITS = new Set(['exit_boat', 'exit_tunnel', 'entry'])
function applyRoutes(scene: AreaSceneHandle, routes: StageRouteMark[], hoverKey: string | null): void {
  if ('setNurseryState' in scene) { scene.setRoutes(routes as unknown as CloudRuinsRouteMark[], hoverKey); return }
  if ('setLakeState' in scene) { scene.setRoutes(routes as unknown as CloudRuinsRouteMark[], hoverKey); return }
  if (isMoss(scene)) scene.setRoutes(routes.filter((route) => !route.exit || MOSS_EXITS.has(route.exit)) as MossRouteMark[], hoverKey)
  else scene.setRoutes(routes.filter((route) => !route.exit || !MOSS_EXITS.has(route.exit) || route.exit === 'entry') as CloudRuinsRouteMark[], hoverKey)
}
function applyView(scene: AreaSceneHandle, view: StageView): void {
  if ('setNurseryState' in scene) { scene.setLobbyView(view as unknown as CloudRuinsLobbyView); return }
  if ('setLakeState' in scene) { scene.setLobbyView(view as unknown as CloudRuinsLobbyView); return }
  const own = view.kind !== 'look' || (isMoss(scene) ? MOSS_EXITS.has(view.exit) : !MOSS_EXITS.has(view.exit))
  const next = own ? view : { kind: 'close' as const }
  if (isMoss(scene)) scene.setLobbyView(next as MossLobbyView)
  else scene.setLobbyView(next as CloudRuinsLobbyView)
}

// The close-up lobby scene (§47). The same 雲上遺庭 scene as Focus Active in 'lobby' mode: held at the
// saved progress, camera close on the traveller, easing toward an exit while a route card is hovered.
// Like Focus, the scene draws the glass under the text: [data-glass="top"] header band (unused here),
// [data-glass-side] the side panel (also the right edge of the framing), [data-glass-card] crisp cards
// (snap: they follow the camera), [data-glass-zone] soft zones.
// The app's navigation rail (.app-shell > .sidebar) lies over the scene's left edge while the lobby is shown
// (lobbyA.css): the scene draws glass under it too, as a panel whose only visible edge is the right one.
const RAIL_SELECTOR = '.app-shell > .sidebar'
const RAIL_BLEED = 24

function measureRail(hostRect: DOMRect): { left: number; card: CloudRuinsChrome['cards'][number] } | null {
  const rail = document.querySelector<HTMLElement>(RAIL_SELECTOR)
  const rect = rail?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return null
  const right = rect.right - hostRect.left
  // Only when the rail actually lies over the scene (not beside it).
  if (rect.left - hostRect.left > 1 || right <= 0 || right >= hostRect.width * 0.4) return null
  return {
    left: right,
    card: { x: -RAIL_BLEED, y: -RAIL_BLEED, w: right + RAIL_BLEED, h: hostRect.height + RAIL_BLEED * 2, kind: 'pill', snap: false }
  }
}

function measure(host: HTMLElement): CloudRuinsChrome {
  const root = host.closest('.lobby-a') ?? host.parentElement ?? host
  const hostRect = host.getBoundingClientRect()
  const side = root.querySelector<HTMLElement>('[data-glass-side]')
  const sideRect = side?.getBoundingClientRect()
  const rail = root.classList.contains('after-focus') ? null : measureRail(hostRect)
  const elements = [
    ...Array.from(root.querySelectorAll<HTMLElement>('[data-glass-side]')),
    ...Array.from(root.querySelectorAll<HTMLElement>('[data-glass-zone]')),
    ...Array.from(root.querySelectorAll<HTMLElement>('[data-glass-card]'))
  ]
  const cards = elements
    .filter((element) => !element.closest('[hidden], .is-waiting'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        x: rect.left - hostRect.left, y: rect.top - hostRect.top, w: rect.width, h: rect.height,
        kind: element.hasAttribute('data-glass-zone') ? 'zone' as const : 'pill' as const,
        snap: element.hasAttribute('data-glass-card')
      }
    })
    .filter((card) => card.w > 0 && card.h > 0 && card.x + card.w > 0 && card.x < hostRect.width && card.y + card.h > 0 && card.y < hostRect.height)
  return {
    top: 0,
    bottom: 0,
    right: sideRect && sideRect.width > 0 ? Math.max(0, hostRect.right - sideRect.left) : 0,
    left: rail?.left ?? 0,
    cards: rail ? [rail.card, ...cards] : cards
  }
}

interface LobbyStageProps {
  audioSettings?: import('../glassNursery/nurseryAudio').NurseryAudioSettings
  active?: boolean
  /** A restored review can also hand its backdrop to the returning lobby. */
  handoffOnUnmount?: boolean
  /** Which Area is drawn (default 雲上遺庭) and, for 苔痕驛站, the saved node whose scene state is shown. */
  sceneKey?: LobbySceneKey
  nodeId?: string | null
  progressSeconds: number
  targetSeconds: number
  seed: number
  routes: StageRouteMark[]
  hoverKey: string | null
  view: StageView
  findKeys: string[]
  /** Saved world state of the map shown (see LobbyCurrentMap). */
  coreTaken: boolean
  worldMarks: string[]
  onAnchors: (anchors: CloudRuinsAnchors) => void
  onActivityChange?: (activity: string) => void
  onFailed?: () => void
  /** Filled with a function that re-measures the glass after a card moves, opens or changes size. */
  syncChromeRef: MutableRefObject<(() => void) | null>
}

export function LobbyStage({
  active = true, audioSettings,
  progressSeconds, targetSeconds, seed, routes, hoverKey, view, findKeys, coreTaken, worldMarks,
  onAnchors, onActivityChange, onFailed, syncChromeRef, handoffOnUnmount = false,
  sceneKey = 'area-01-cloud-ruins', nodeId = null
}: LobbyStageProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<AreaSceneHandle | null>(null)
  const retainOnUnmount = useRef(handoffOnUnmount)
  retainOnUnmount.current = handoffOnUnmount
  const [failed, setFailed] = useState(false)
  const callbacks = useRef({ onAnchors, onActivityChange, onFailed })
  callbacks.current = { onAnchors, onActivityChange, onFailed }
  const live = useRef({ routes, hoverKey, view, findKeys, coreTaken, worldMarks })
  live.current = { routes, hoverKey, view, findKeys, coreTaken, worldMarks }

  useEffect(() => {
    if (!host.current) return
    let handle: AreaSceneHandle
    try {
      const options: CloudRuinsSceneOptions & MossStationSceneOptions = {
        mode: 'lobby',
        lobbyView: { kind: 'close' },
        progressSeconds,
        targetSeconds,
        seed,
        coreTaken: live.current.coreTaken,
        worldMarks: live.current.worldMarks,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        reportActivity: (activity) => callbacks.current.onActivityChange?.(activity),
        reportAnchors: (anchors) => callbacks.current.onAnchors(anchors)
      }
      const retained = takeSceneForLobby(sceneKey)
      if (retained) {
        try { retained.enterLobby(host.current, options); handle = retained }
        catch (reason) { retained.destroy(); throw reason }
      } else handle = sceneKey === 'area-07-glass-nursery' ? createGlassNurseryScene(host.current,{...options,departure:null}) : sceneKey === 'area-03-reflection-lake' ? createReflectionLakeScene(host.current, { ...options, departure: null, departureState: null }) : sceneKey === 'area-02-moss-station' ? createMossStationScene(host.current, options) : createCloudRuinsScene(host.current, options)
    } catch (reason) {
      // WebGL unavailable or a broken asset: the lobby still works on a plain background.
      console.error('大廳畫面無法建立', reason)
      setFailed(true)
      callbacks.current.onFailed?.()
      return
    }
    setFailed(false)
    scene.current = handle
    // Dev-only QA hook: window.__lobbyScene.debugState() shows the camera, trails, anchors and glass.
    if (import.meta.env.DEV) (window as unknown as { __lobbyScene?: AreaSceneHandle }).__lobbyScene = handle
    applyRoutes(handle, live.current.routes, live.current.hoverKey)
    handle.setLobbyItems(live.current.findKeys.map((key) => ({ key })))
    applyView(handle, live.current.view)
    // 苔痕驛站 reads the saved scene state of the node shown (marks, umbrella, core, where the traveller is).
    let stateLive = true
    const mossHandle = isMoss(handle) ? handle : null
    if (mossHandle && nodeId && typeof window.focusQuest?.getMossScene === 'function') {
      void window.focusQuest.getMossScene(nodeId).then((state) => {
        if (stateLive && state && scene.current === mossHandle) { mossHandle.setMossState(state); mossHandle.setProgress(progressSeconds) }
      }).catch(() => undefined)
    }
    if ('setNurseryState' in handle && nodeId) {const nurseryHandle=handle;void window.focusQuest.getNurseryScene(nodeId).then(s=>{if(stateLive&&s)nurseryHandle.setNurseryState(s)}).catch(()=>undefined)}
    if ('setLakeState' in handle && nodeId) { const lakeHandle = handle; void window.focusQuest.getLakeScene(nodeId).then(state => { if(stateLive && state) lakeHandle.setLakeState(state) }).catch(() => undefined) }
    const hostElement = host.current
    let frame = 0
    const sync = (): void => {
      if (frame) return
      frame = window.requestAnimationFrame(() => { frame = 0; handle.setChrome(measure(hostElement)) })
    }
    syncChromeRef.current = sync
    // View transitions suppress normal animation frames while updating the DOM.
    // Present the correctly framed first scene synchronously; waiting for RAF
    // here would add a visible half-second stall before Chromium can blend it.
    handle.setChrome(measure(hostElement))
    handle.renderNow()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null
    const root = hostElement.closest('.lobby-a') ?? hostElement.parentElement
    observer?.observe(hostElement)
    root?.querySelectorAll('[data-glass-side], [data-glass-zone], [data-glass-card]').forEach((element) => observer?.observe(element))
    window.addEventListener('resize', sync)
    return () => {
      stateLive = false
      window.removeEventListener('resize', sync)
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      if (syncChromeRef.current === sync) syncChromeRef.current = null
      scene.current = null
      if (retainOnUnmount.current) leaveSceneForLobby(handle)
      else handle.destroy()
    }
    // Rebuilt only when the place shown changes; routes, view and finds stream in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressSeconds, targetSeconds, seed, sceneKey, nodeId])

  useEffect(() => { if (scene.current) applyRoutes(scene.current, routes, hoverKey) }, [routes, hoverKey])
  useEffect(() => { scene.current?.setPaused(!active) }, [active])
  useEffect(() => { if (scene.current) applyView(scene.current, view) }, [view])
  const marksSignature = worldMarks.join('|')
  useEffect(() => { scene.current?.setWorldState({ coreTaken, worldMarks: live.current.worldMarks }) }, [coreTaken, marksSignature])
  const findSignature = findKeys.join('|')
  useEffect(() => { scene.current?.setLobbyItems(live.current.findKeys.map((key) => ({ key }))) }, [findSignature])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => scene.current?.setReducedMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {const h=scene.current;if(h&&'setNurseryState' in h)h.setAudioSettings(audioSettings,active)},[audioSettings,active,sceneKey,nodeId])
  return <div className={`lobby-a-scene biome-cloud-ruins${sceneKey === 'area-02-moss-station' ? ' biome-moss-station' : ''}`} ref={host} aria-hidden="true">
    {failed && <div className="lobby-a-fallback" />}
  </div>
}
