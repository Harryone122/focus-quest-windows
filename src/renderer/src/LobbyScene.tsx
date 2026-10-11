import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  createCloudRuinsScene,
  type CloudRuinsAnchors,
  type CloudRuinsChrome,
  type CloudRuinsRouteMark,
  type CloudRuinsSceneHandle
} from './cloudRuins/cloudRuinsScene'

// Today's lobby runs the same 雲上遺庭 scene as Focus Active, in 'lobby' mode: held still at the saved
// progress, with the next routes drawn on it. Like Focus, the scene draws its own glass under the text
// ([data-glass="top"] header band, [data-glass-side] side panel, [data-glass-card] route markers), so
// there is no CSS backdrop-filter over WebGL. The side panel also tells the camera to frame the Area left
// of it.
function measureLobbyChrome(host: HTMLElement): CloudRuinsChrome {
  const root = host.closest('.today-lobby') ?? host.parentElement ?? host
  const hostRect = host.getBoundingClientRect()
  const top = root.querySelector('[data-glass="top"]')
  const side = root.querySelector<HTMLElement>('[data-glass-side]')
  const sideRect = side?.getBoundingClientRect()
  // Fixed order (panel, header zones, then markers) so a marker appearing never makes another card's
  // glass slide over from a different element.
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
    top: top ? Math.max(0, top.getBoundingClientRect().bottom - hostRect.top) : 0,
    bottom: 0,
    right: sideRect && sideRect.width > 0 ? Math.max(0, hostRect.right - sideRect.left) : 0,
    cards
  }
}

interface LobbySceneProps {
  coreTaken?: boolean
  /** Saved progress of the Area shown (the route the traveller rests in). Never advanced here. */
  progressSeconds: number
  targetSeconds: number
  seed: number
  routes: CloudRuinsRouteMark[]
  hoverKey: string | null
  onAnchors: (anchors: CloudRuinsAnchors) => void
  onActivityChange?: (activity: string) => void
  onFailed?: () => void
  /** Filled with a function that re-measures the glass after the lobby moves a marker or opens a panel. */
  syncChromeRef: MutableRefObject<(() => void) | null>
}

export function LobbyScene({
  coreTaken = false,
  progressSeconds,
  targetSeconds,
  seed,
  routes,
  hoverKey,
  onAnchors,
  onActivityChange,
  onFailed,
  syncChromeRef
}: LobbySceneProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<CloudRuinsSceneHandle | null>(null)
  const [failed, setFailed] = useState(false)
  const callbacks = useRef({ onAnchors, onActivityChange, onFailed })
  callbacks.current = { onAnchors, onActivityChange, onFailed }
  const routeState = useRef({ routes, hoverKey })
  routeState.current = { routes, hoverKey }

  useEffect(() => {
    if (!host.current) return
    let handle: CloudRuinsSceneHandle
    try {
      handle = createCloudRuinsScene(host.current, {
        mode: 'lobby',
        // This lobby frames the whole Area (the close-up lobby is lobby/LobbyStage.tsx).
        lobbyView: { kind: 'overview' },
        coreTaken,
        progressSeconds,
        targetSeconds,
        seed,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        reportActivity: (activity) => callbacks.current.onActivityChange?.(activity),
        reportAnchors: (anchors) => callbacks.current.onAnchors(anchors)
      })
    } catch (reason) {
      // WebGL unavailable or a broken asset: the lobby still works as a plain route list.
      console.error('雲上遺庭大廳畫面無法建立', reason)
      setFailed(true)
      callbacks.current.onFailed?.()
      return
    }
    setFailed(false)
    scene.current = handle
    // Dev-only QA hook: window.__lobbyScene.debugState() shows trails, anchors, framing and glass cards.
    if (import.meta.env.DEV) (window as unknown as { __lobbyScene?: CloudRuinsSceneHandle }).__lobbyScene = handle
    handle.setRoutes(routeState.current.routes, routeState.current.hoverKey)
    const hostElement = host.current
    let frame = 0
    const syncChrome = (): void => {
      if (frame) return
      frame = window.requestAnimationFrame(() => { frame = 0; handle.setChrome(measureLobbyChrome(hostElement)) })
    }
    syncChromeRef.current = syncChrome
    syncChrome()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(syncChrome) : null
    const root = hostElement.closest('.today-lobby') ?? hostElement.parentElement
    observer?.observe(hostElement)
    root?.querySelectorAll('[data-glass], [data-glass-side], [data-glass-zone]').forEach((element) => observer?.observe(element))
    window.addEventListener('resize', syncChrome)
    return () => {
      window.removeEventListener('resize', syncChrome)
      observer?.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      if (syncChromeRef.current === syncChrome) syncChromeRef.current = null
      scene.current = null
      handle.destroy()
    }
    // The Area is rebuilt only when the place it shows changes; routes and hover stream in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressSeconds, targetSeconds, seed])

  useEffect(() => { scene.current?.setWorldState({ coreTaken }) }, [coreTaken])
  useEffect(() => { scene.current?.setRoutes(routes, hoverKey) }, [routes, hoverKey])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => scene.current?.setReducedMotion(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return <div className="lobby-scene biome-cloud-ruins" ref={host} aria-hidden="true">
    {failed && <div className="lobby-scene-fallback" />}
  </div>
}
