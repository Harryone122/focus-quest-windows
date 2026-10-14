import { TravelLoading } from '../loading/TravelLoading'
import { useEffect, useMemo, useRef, useState } from 'react'
import nurserySilhouette from '../../../../docs/area07/campfire-silhouette-07.html?raw'
import echoValleySilhouette from '../../../../docs/area05/campfire-silhouette-05.html?raw'
import reflectionLakeSilhouette from '../../../../docs/area03/campfire-silhouette-03.html?raw'
import prototypeHtml from '../../../../docs/prototypes/campfire-start.html?raw'
import threeModuleUrl from '../cloudRuins/vendor/three.module.js?url'
import type { LobbyRouteOption } from './lobbyTypes'
import { createCampfireSoundscape, type CampfireAudioSettings, type CampfireAudioScene } from './campfireAudio'
import { CAMPFIRE_DEPARTURE_SECONDS, campfirePoseTimes } from './campfireDeparture'
import { createQuarryDistantBell } from '../echoQuarry/quarryAudio'

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
type CampfireWindow = Window & { __campfire?: CampfireApi; __campfireEmbedded?: boolean; __hold?: boolean; __campfireOnFind?: (stage: number, title: string, text: string) => void; __campfireOnSilhouette?: (mapId:string, cue:string)=>void }

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
  const startMarker = '// ---- 05 藏聲秋谷 silhouette begin ----'
  const endMarker = '// ---- 05 藏聲秋谷 silhouette end ----'
  const start = echoValleySilhouette.indexOf(startMarker), end = echoValleySilhouette.indexOf(endMarker)
  if (start < 0 || end <= start) throw new Error('藏聲秋谷的營火剪影標記已變更，無法載入。')
  const echoSilhouette = echoValleySilhouette.slice(start + startMarker.length, end)
  const lakeStartMarker = '// ---- 03 倒影湖畔 silhouette begin ----'
  const lakeEndMarker = '// ---- 03 倒影湖畔 silhouette end ----'
  const lakeStart = reflectionLakeSilhouette.indexOf(lakeStartMarker), lakeEnd = reflectionLakeSilhouette.indexOf(lakeEndMarker)
  if (lakeStart < 0 || lakeEnd <= lakeStart) throw new Error('倒影湖畔的營火剪影標記已變更，無法載入。')
  const lakeFade = 'const setA = (m, a) => { const tr = a < 0.995; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; m.visible = a > 0.005; };'
  const lakeSource = reflectionLakeSilhouette.slice(lakeStart + lakeStartMarker.length, lakeEnd)
  if (!lakeSource.includes(lakeFade)) throw new Error('倒影湖畔的淡入入口已變更，無法套用平滑播放。')
  // Keep the material in the same render pass throughout every reveal. Only
  // opacity changes; crossing full opacity must not invalidate GPU programs.
  const lakeSilhouette = lakeSource.replace(lakeFade, 'const setA = (m, a) => { m.transparent = true; m.opacity = a; m.visible = a > 0.005; };')
    // At the waterline, begin with the object's own colour and clarity. Blend
    // gradually into the authored reflection tint below it, rather than cutting
    // straight from an opaque object to a pale reflection under a bright sheet.
    .replace('const BLUE = new T.Color', `const lakeSurfaceY = { value: 0 };
  Object.keys(R).forEach(k => {
    R[k].onBeforeCompile = shader => {
      shader.uniforms.lakeSurfaceY = lakeSurfaceY;
      shader.uniforms.lakeBaseColor = { value: U[k].color };
      shader.vertexShader = 'uniform float lakeSurfaceY; varying float lakeDepth;\\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\nlakeDepth = max(0.0, lakeSurfaceY - (modelMatrix * vec4(transformed, 1.0)).y);');
      shader.fragmentShader = 'uniform vec3 lakeBaseColor; varying float lakeDepth;\\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\nfloat lakeBlend = smoothstep(0.0, 1.15, lakeDepth);\\ndiffuseColor.rgb = mix(lakeBaseColor, diffuseColor.rgb, lakeBlend);\\ndiffuseColor.a *= mix(1.25, 1.0, lakeBlend);');
    };
    R[k].customProgramCacheKey = () => 'lake-soft-waterline-v1';
  });
  const BLUE = new T.Color`)
    .replace('const apply = (sky) => {', 'const apply = (sky) => { v.updateWorldMatrix(true, false); lakeSurfaceY.value = v.matrixWorld.elements[13];')
    .replace('waterM.opacity = 0.35 + 0.65 * kr; glintM.opacity = 0.18 * kr', 'waterM.opacity = 0.08 + 0.18 * kr; glintM.opacity = 0.045 * kr')
  const html = prototypeHtml.replace('const DEST = {};',silhouette+'\n'+echoSilhouette+'\n'+lakeSilhouette+'\nconst DEST = {};').replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>\s*<script>/, bootstrap)
  if (html === prototypeHtml) throw new Error('營火原型的場景入口已變更，無法載入。')
  const paced = html
    .replace('S.t += dt; const t = S.t; if (t > 2.55', 'S.t += dt; const t = window.__campfireTime(S.t); if (t > 2.55')
    .replace('const t = S.t; const tilt = S.mode', 'const t = window.__campfireTime(S.t); const tilt = S.mode')
    .replace('w: 6.2 }, 1.6); S.panned', 'w: 6.2 }, 4.1); S.panned')
  if (paced === html || !paced.includes('const t = window.__campfireTime(S.t); const tilt')) throw new Error('營火出發動作入口已變更，無法套用時序。')
  const dynamic=paced.replace('// mist: a sea below', `const silSources={cloud:DEST.bridge.g.clone(true),moss:DEST.steps.g.clone(true)};
window.__campfireSetDestinations=(maps)=>{
  const warm=[];
  for(const way of ['bridge','steps']){
    const d=DEST[way].g,id=maps[way];if(d.userData.mapId===id)continue;
    d.userData.mapId=id;d.userData.sil=null;while(d.children.length)d.remove(d.children[0]);
    if(id==='area-03-reflection-lake'){silReflectionLake(d);d.scale.setScalar(.85);warm.push(d);}
    else if(id==='area-05-echo-quarry'){silEchoValley(d);d.scale.setScalar(.8);}
    else if(id==='area-07-glass-nursery'){silGlassNursery(d);d.scale.setScalar(.85);}
    else{const source=id==='area-01-cloud-ruins'?silSources.cloud:id==='area-02-moss-station'?silSources.moss:null;if(source){const c=source.clone(true);while(c.children.length)d.add(c.children[0]);d.scale.copy(source.scale);}}
  }
  // Prepare initially invisible lake geometry once, before the first hover.
  // A zero-opacity draw uploads its buffers without showing it or writing depth.
  if(warm.length){
    const hidden=new Map();warm.forEach(d=>d.traverse(o=>{const m=o.material;if(m&&!m.visible&&!hidden.has(m)){hidden.set(m,{visible:m.visible,depthWrite:m.depthWrite});m.visible=true;m.depthWrite=false;}}));
    try{renderer.compile(scene,camera);renderer.render(scene,camera);}
    finally{hidden.forEach((state,m)=>{m.visible=state.visible;m.depthWrite=state.depthWrite;});}
  }
};
// mist: a sea below`)
  const hoverClock = 'S.hoverT = S.hover ? (S.hoverT || 0) + dt : 0;'
  if (!dynamic.includes(hoverClock)) throw new Error('營火滑過時間入口已變更，無法更新剪影。')
  const animated = dynamic.replace(hoverClock, `${hoverClock}
  ['bridge', 'steps'].forEach((k) => { const s = DEST[k].g.userData.sil; if (s && s.alive()) s.update(dt, mt, S.hover === k ? S.hoverT : 0, veilTarget(k) < 0.5); });`)
    // Reset immediately, including leave/re-enter between two rendered frames.
    .replace('S.hover = way; camTo', `if (S.hover !== way) { const s = S.hover && DEST[S.hover].g.userData.sil; if (s && s.alive() && DEST[S.hover].g.userData.mapId === 'area-05-echo-quarry') s.update(0, time, 0); S.hoverT = 0; } S.hover = way; camTo`)
  // __campfireOnSilhouette emits the single authored impact at hover 1.35s.
  return animated.replace(/<link rel="(?:preconnect|stylesheet)"[^>]*>\s*/g, '').replace('</head>', `<style>
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
  useEffect(() => {
    if (!ready || !props.audioSettings) return
    const target=frame.current?.contentWindow as CampfireWindow | null
    if(!target)return
    const bell=createQuarryDistantBell()
    const update=()=>{const p=audioInputs.current;bell.update(p.audioSettings!,p.active!==false&&!p.departurePaused&&!p.departing)}
    const cue=(mapId:string,name:string)=>{update();if(mapId==='area-05-echo-quarry'&&name==='bell')bell.play()}
    target.__campfireOnSilhouette=cue
    update();const timer=window.setInterval(update,120)
    return ()=>{window.clearInterval(timer);if(target.__campfireOnSilhouette===cue)target.__campfireOnSilhouette=undefined;bell.dispose()}
  },[ready,!!props.audioSettings])
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
