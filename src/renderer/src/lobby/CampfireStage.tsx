import { TravelLoading } from '../loading/TravelLoading'
import { useEffect, useMemo, useRef, useState } from 'react'
import nurserySilhouette from '../../../../docs/area07/campfire-silhouette-07.html?raw'
import prototypeHtml from '../../../../docs/prototypes/campfire-start.html?raw'
import threeModuleUrl from '../cloudRuins/vendor/three.module.js?url'
import { IFRAME_FRAME_SOURCE, PACED_IFRAME_FRAME_SOURCE } from '../framePacing.js'
import type { LobbyRouteOption } from './lobbyTypes'
import { createCampfireSoundscape, type CampfireAudioSettings, type CampfireAudioScene } from './campfireAudio'
import { CAMPFIRE_DEPARTURE_SECONDS, campfirePoseTimes } from './campfireDeparture'

type Way = 'bridge' | 'steps'
interface CampfireApi {
  S: CampfireAudioScene
  setDestinations: (maps:Record<string,string>)=>void
  setStage: (stage: number, animate: boolean) => void
  setHover: (way: Way | null) => void
  setSelected: (way: Way | null) => void
  setSeen: (stage: number, seen: boolean) => void
  playReturn: () => void
  depart: () => void
  advance: (seconds: number) => void
}
type CampfireWindow = Window & { __campfire?: CampfireApi; __campfireEmbedded?: boolean; __hold?: boolean; __campfireOnFind?: (stage: number, title: string, text: string) => void }

function wayFor(route: LobbyRouteOption | undefined): Way | null {
  if (!route) return null
  if (route.exit === 'exit_bridge') return 'bridge'
  if (route.exit === 'exit_steps') return 'steps'
  // Legacy entrance choices did not save a campfire exit. Keep the two released
  // destination silhouettes in their authored positions when loading those saves.
  return route.mapId === 'map-01-cloud-ruins' ? 'bridge' : route.mapId === 'map-02-moss-station' ? 'steps' : null
}

function embeddedDocument(): string {
  const moduleUrl = new URL(threeModuleUrl, window.location.href).href
  const bootstrap = `<script type="module">import * as THREE from ${JSON.stringify(moduleUrl)}; window.THREE = THREE; window.__campfireEmbedded = true;
    const poseTimes = ${JSON.stringify(campfirePoseTimes)};
    window.__campfireTime = seconds => { const t = Math.max(0, Math.min(8, seconds)); for(let i=1;i<poseTimes.length;i++){const [b,y]=poseTimes[i],[a,x]=poseTimes[i-1];if(t<=b)return x+(y-x)*(t-a)/(b-a)}return 5; };\n`
  const silhouette = nurserySilhouette.slice(nurserySilhouette.indexOf('function silGlassNursery(d)'),nurserySilhouette.indexOf('// destinations waiting in the mist'))
  const html = prototypeHtml.replace('const DEST = {};',silhouette+'\nconst DEST = {};').replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>\s*<script>/, bootstrap)
  if (html === prototypeHtml) throw new Error('營火原型的場景入口已變更，無法載入。')
  const paced = html
    .replace('S.t += dt; const t = S.t; if (t > 2.55', 'S.t += dt; const t = window.__campfireTime(S.t); if (t > 2.55')
    .replace('const t = S.t; const tilt = S.mode', 'const t = window.__campfireTime(S.t); const tilt = S.mode')
    .replace('w: 6.2 }, 1.6); S.panned', 'w: 6.2 }, 4.1); S.panned')
  if (paced === html || !paced.includes('const t = window.__campfireTime(S.t); const tilt')) throw new Error('營火出發動作入口已變更，無法套用時序。')
  const dynamic=paced.replace('// mist: a sea below', `const silSources={cloud:DEST.bridge.g.clone(true),moss:DEST.steps.g.clone(true)};
window.__campfireSetDestinations=(maps)=>{for(const way of ['bridge','steps']){const d=DEST[way].g,id=maps[way];if(d.userData.mapId===id)continue;d.userData.mapId=id;while(d.children.length)d.remove(d.children[0]);if(id==='area-07-glass-nursery'){silGlassNursery(d);d.scale.setScalar(.85);}else{const source=id==='area-01-cloud-ruins'?silSources.cloud:id==='area-02-moss-station'?silSources.moss:null;if(source){const c=source.clone(true);while(c.children.length)d.add(c.children[0]);d.scale.copy(source.scale);}}}};
// mist: a sea below`)
  return dynamic.replace(IFRAME_FRAME_SOURCE, PACED_IFRAME_FRAME_SOURCE).replace(/<link rel="(?:preconnect|stylesheet)"[^>]*>\s*/g, '').replace('</head>', `<style>
    html,body,.app,.stage{width:100%;height:100%;min-height:0!important;overflow:hidden!important}
    .top-left,.routes,.panel,.proto,.veil-msg,.sheet-wrap{visibility:hidden!important;pointer-events:none!important}
    .veil{pointer-events:none!important}
    #pins{position:absolute;inset:0;pointer-events:none}
    #pins .pin{pointer-events:auto}
  </style></head>`)
}

interface Props {
  audioSettings?: CampfireAudioSettings
  active?: boolean
  stage: number
  seenStage: boolean
  returned: boolean
  routes: LobbyRouteOption[]
  selectedRouteId: string | null
  hoverRouteId: string | null
  onFind: (stage: number, title: string, text: string) => void
  onFailed?: () => void
  /** The focus clock has already started; this only plays the eight-second picture. */
  departing?: boolean
  departureStartedAt?: string
  departureElapsedMs?: number
  departurePaused?: boolean
  playFromStart?: boolean
  onDepartureComplete?: () => void
}

export function CampfireStage(props: Props): React.JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const html = useMemo(embeddedDocument, [])
  const api = (): CampfireApi | undefined => (frame.current?.contentWindow as CampfireWindow | null)?.__campfire
  const selected = wayFor(props.routes.find((route) => route.id === props.selectedRouteId))
  const hovered = wayFor(props.routes.find((route) => route.id === props.hoverRouteId))
  const audioInputs = useRef(props)
  audioInputs.current = props
  useEffect(() => {
    if (!ready || !props.audioSettings) return
    let sound: ReturnType<typeof createCampfireSoundscape>
    try { sound = createCampfireSoundscape() } catch { return }
    const update = (): void => {
      const inputs = audioInputs.current, scene = api()?.S
      if (scene && inputs.audioSettings) sound.update(scene, inputs.audioSettings, inputs.active === false || !!inputs.departurePaused)
    }
    update()
    const interval = window.setInterval(update, 120)
    return () => { window.clearInterval(interval); sound.dispose() }
  }, [ready, !!props.audioSettings])
  useEffect(()=>{if(!ready)return;const maps:Record<string,string>={};for(const route of props.routes){const way=wayFor(route);if(way)maps[way]=route.mapId}api()?.setDestinations?.(maps)},[ready,props.routes])
  useEffect(() => { const target = frame.current?.contentWindow as CampfireWindow | null; if (ready && target) target.__hold = props.active === false || !!props.departurePaused }, [ready, props.active, props.departurePaused])

  useEffect(() => {
    const target = frame.current?.contentWindow as CampfireWindow | null
    if (!target) return
    target.__campfireOnFind = props.onFind
    return () => { target.__campfireOnFind = undefined }
  }, [props.onFind, ready])

  useEffect(() => {
    if (!ready) return
    const scene = api()
    scene?.setStage(Math.max(0, Math.min(5, props.stage)), false)
    scene?.setSeen(props.stage, props.seenStage)
    if (props.returned) scene?.playReturn()
    // Stage and returned change only at journey boundaries; no replay on ordinary snapshots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.stage, props.returned])
  useEffect(() => { if (ready) api()?.setSeen(props.stage, props.seenStage) }, [ready, props.stage, props.seenStage])
  useEffect(() => { if (ready) api()?.setSelected(selected) }, [ready, selected])
  useEffect(() => { if (ready) api()?.setHover(hovered) }, [ready, hovered])
  useEffect(() => {
    if (!ready || !props.departing) return
    const scene = api()
    scene?.depart()
    // Scene creation is asynchronous; catch the purely visual animation up to
    // the already-running, persisted Focus clock rather than restarting at 0.
    const realtime = props.departureStartedAt && !props.departurePaused ? Date.now() - Date.parse(props.departureStartedAt) : 0
    if (!props.playFromStart) scene?.advance(Math.min(CAMPFIRE_DEPARTURE_SECONDS, (props.departureElapsedMs ?? Math.max(0, realtime)) / 1000))
    // A new departure scene mounts only once per Focus session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.departing])
  useEffect(() => {
    if (!ready || !props.departing || !props.onDepartureComplete) return
    let frameId = 0
    const check = (): void => {
      if (api()?.S.mode === 'gone') { props.onDepartureComplete?.(); return }
      frameId = window.requestAnimationFrame(check)
    }
    frameId = window.requestAnimationFrame(check)
    return () => window.cancelAnimationFrame(frameId)
  }, [ready, props.departing, props.onDepartureComplete])

  const onLoad = (): void => {
    const target = frame.current?.contentWindow as CampfireWindow | null
    if (!target) return
    // The imported Three module may finish just after the document load event.
    let checks = 0
    const poll = (): void => {
      if (target.__campfire) { target.__campfire.setDestinations=(target as any).__campfireSetDestinations; setReady(true); if (import.meta.env.DEV) (window as unknown as { __campfireScene?: CampfireApi }).__campfireScene = target.__campfire; return }
      if (++checks >= 80) { setFailed(true); props.onFailed?.(); return }
      window.setTimeout(poll, 50)
    }
    poll()
  }
  return <div className="lobby-a-scene campfire-stage">
    <iframe ref={frame} title="霧岸營火" srcDoc={html} onLoad={onLoad} />{!ready && !failed && <TravelLoading paused={props.active === false || !!props.departurePaused} />}
  </div>
}
