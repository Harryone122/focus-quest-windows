import { focusAudioSettings } from '../../shared/focusPresentation'
import { TravelLoading } from './loading/TravelLoading'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GlassNurseryFocusScene } from './GlassNurseryFocusScene'
import type { NurserySnapshot,NurseryExit } from '../../shared/area07'
import { ReflectionLakeFocusScene } from './ReflectionLakeFocusScene'
import type { LakeSnapshot, LakeExit } from '../../shared/area03'
import { CloudRuinsFocusScene } from './CloudRuinsFocusScene'
import { MossStationFocusScene } from './MossStationFocusScene'
import { CampfireStage } from './lobby/CampfireStage'
import type { MossDepartureCue } from './mossStation/mossStationScene'
import type { AppSnapshot, ExpeditionNode, FocusSession, SpecialFindAcquisition } from '../../shared/types'
import type { MossSceneSnapshot } from '../../shared/area02'
import { FOREST_MAP_ID } from '../../shared/specialFinds'

const NURSERY = 'area-07-glass-nursery'
const LAKE = 'area-03-reflection-lake'
const MOSS = 'area-02-moss-station'
/** A departure cue is only fetched while the Focus is this young (the animation itself is 5 s). */
const DEPARTURE_WINDOW_MS = 5000
const CAMPFIRE_WINDOW_MS = 8000
/** The leaving Area's scene reports when its 5-second departure has played (it starts once the scene is built).
 *  If that report never comes (no WebGL, a hung frame), the new Area is shown anyway after this long. */
const DEPARTURE_FALLBACK_MS = 15000

interface AreaFocusSceneProps {
  audioActive?: boolean
  snapshot: AppSnapshot
  session: FocusSession
  node: ExpeditionNode | undefined
  progressSeconds: number
  targetSeconds: number
  seed: number
  /** Milliseconds of this Focus already elapsed (pause excluded); updated every second by the timer. */
  departureElapsedMs: number
  specialFinds: SpecialFindAcquisition[]
  paused: boolean
  retainForLobby: boolean
  uiFade: number
  onActivityChange: (activity: string) => void
  onWorldMark: (mark: string) => void
  onStoryRecord: (clueId: string) => void
  onCinematicChange: (active: boolean) => void
  onReady?: () => void
  skipCampfire?: boolean
}

type MossLeave = { cue: MossDepartureCue; state: MossSceneSnapshot | null }

// Picks the scene for the node being explored and plays the previous Area's 5-second departure first.
// 雲上遺庭 → 雲上遺庭 stays one scene (it handles its own departure). Crossing Areas shows the Area being left
// until the destination has drawn, then fades it in. A Focus-clock fallback starts loading even if
// the departure callback fails; the timer, progress and rewards never wait for either renderer.
export function AreaFocusScene(props: AreaFocusSceneProps): React.JSX.Element {
  const { snapshot, session, node, departureElapsedMs } = props
  const area = node?.areaId === NURSERY ? NURSERY : node?.areaId === LAKE ? LAKE : node?.areaId === MOSS ? MOSS : 'area-01-cloud-ruins'
  const parent = node?.parentNodeId ? snapshot.expeditionNodes.find((entry) => entry.id === node.parentNodeId) : undefined
  const [nurseryCueSettled, setNurseryCueSettled] = useState(false)
  const [lakeCueSettled, setLakeCueSettled] = useState(false)
  const [cueTimedOut, setCueTimedOut] = useState(false)
  const cueExpired = useRef(false)
  useEffect(() => {
    setCueTimedOut(false)
    cueExpired.current = false
    // IPC failure must also release a destination when effective Focus time is paused.
    const timer = window.setTimeout(() => { cueExpired.current = true; setCueTimedOut(true) }, 8000)
    return () => window.clearTimeout(timer)
  }, [session.id])
  const [nurseryLeave,setNurseryLeave]=useState<{cue:{exit:NurseryExit;durationMs:number};state:NurserySnapshot|null}|null>(null)
  useEffect(()=>{let live=true;setNurseryCueSettled(false);if(parent?.areaId===NURSERY&&departureElapsedMs<8000)void window.focusQuest.getNurseryDeparture(session.id).then(async cue=>{if(cue){const state=await window.focusQuest.getNurseryScene(cue.fromExpeditionNodeId);if(live&&!cueExpired.current)setNurseryLeave({cue,state})}}).catch(()=>undefined).finally(()=>{if(live)setNurseryCueSettled(true)});else setNurseryCueSettled(true);return()=>{live=false}},[session.id])
  const [lakeLeave, setLakeLeave] = useState<{cue:{exit:LakeExit;durationMs:number};state:LakeSnapshot|null}|null>(null)
  const [lakeFallback,setLakeFallback] = useState<LakeSnapshot|null>(null)
  useEffect(() => { let live=true;setLakeCueSettled(false);if(parent?.areaId===LAKE && departureElapsedMs<5000) void window.focusQuest.getLakeDeparture(session.id).then(async cue=>{if(cue){const state=await window.focusQuest.getLakeScene(cue.fromExpeditionNodeId);if(live&&!cueExpired.current)setLakeLeave({cue,state})}}).catch(()=>undefined).finally(()=>{if(live)setLakeCueSettled(true)});else setLakeCueSettled(true);return()=>{live=false} },[session.id])
  const lakeState = snapshot.lake?.nodeId===node?.id ? snapshot.lake : lakeFallback?.nodeId===node?.id ? lakeFallback : null
  useEffect(()=>{let live=true;if(area===LAKE && node && !lakeState)void window.focusQuest.getLakeScene(node.id).then(s=>{if(live)setLakeFallback(s)}).catch(()=>undefined);return()=>{live=false}},[area,node?.id,lakeState===null])
  const expectMossLeave = parent?.areaId === MOSS && departureElapsedMs < DEPARTURE_WINDOW_MS
  const [mossLeave, setMossLeave] = useState<MossLeave | null | 'loading'>(expectMossLeave ? 'loading' : null)
  const [mossFallback, setMossFallback] = useState<MossSceneSnapshot | null>(null)
  const [departureReported, setDepartureReported] = useState(false)
  const [sourceReady, setSourceReady] = useState(false)
  const [readySession, setReadySession] = useState<string | null>(null)
  const [releasedSession, setReleasedSession] = useState<string | null>(null)
  const [campfireFailed, setCampfireFailed] = useState(false)
  const [entranceSessionId] = useState<string | null>(() => {
    const eligible = node?.depth === 0 && !node.parentNodeId && node.progressSeconds === 0 && departureElapsedMs < CAMPFIRE_WINDOW_MS
    if (!eligible || props.skipCampfire) return null
    const key = `campfire-depart-${session.id}`
    if (window.sessionStorage.getItem(key)) return null
    window.sessionStorage.setItem(key, '1')
    return session.id
  })
  const [entranceDismissed, setEntranceDismissed] = useState(false)
  const destinationReady = readySession === session.id

  useEffect(() => {
    setDepartureReported(false)
    setSourceReady(false)
    if (!expectMossLeave) { setMossLeave(null); return }
    let live = true
    setMossLeave('loading')
    void (async () => {
      const cue = await window.focusQuest.getMossDeparture(session.id)
      const state = cue ? await window.focusQuest.getMossScene(cue.fromExpeditionNodeId) : null
      if (live && !cueExpired.current) setMossLeave(cue ? { cue: { exit: cue.exit, route: cue.route, durationMs: cue.durationMs }, state } : null)
    })().catch(() => { if (live) setMossLeave(null) })
    return () => { live = false }
    // Fetched once per Focus; later seconds only move the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  // The broadcast snapshot carries the selected Area 02 node; read it directly if it names another node.
  const liveMoss = area === MOSS && snapshot.mossStation && snapshot.mossStation.nodeId === node?.id ? snapshot.mossStation : null
  useEffect(() => {
    if (area !== MOSS || !node || liveMoss) return
    let live = true
    void window.focusQuest.getMossScene(node.id).then((state) => { if (live) setMossFallback(state) }).catch(() => undefined)
    return () => { live = false }
  }, [area, node?.id, liveMoss === null])
  const moss = liveMoss ?? (mossFallback && mossFallback.nodeId === node?.id ? mossFallback : null)

  // Capture eligibility at mount; a reopened, older session must show its destination immediately.
  const cloudCue = useMemo(() => departureElapsedMs < DEPARTURE_WINDOW_MS ? session.departure : null, [session.id])
  const leaving = nurseryLeave ? NURSERY : lakeLeave ? LAKE : cloudCue ? 'area-01-cloud-ruins' : mossLeave && mossLeave !== 'loading' ? MOSS : null
  const departureOver = departureReported || departureElapsedMs >= DEPARTURE_FALLBACK_MS
  const onDepartureComplete = (): void => setDepartureReported(true)
  const quietFocus = session.presentation !== 'live' && !session.beforeFocus
  const audioSettings = focusAudioSettings(snapshot.settings,quietFocus)
  if(quietFocus&&(node?.areaId===FOREST_MAP_ID||!node?.areaId)){audioSettings.environmentVolume *= 10**(-6/20*(1-1/1.4));audioSettings.musicVolume *= 10**(-6/20*(1-1/1.4))}
  const common = {
    quietFocus,
    progressSeconds: props.progressSeconds, targetSeconds: props.targetSeconds, sessionId: session.id,
    departureElapsedMs, paused: props.paused, retainForLobby: props.retainForLobby, uiFade: props.uiFade,
    onActivityChange: props.onActivityChange, onCinematicChange: props.onCinematicChange
  }
  const cloudProps = {
    audioSettings,
    ...common, seed: props.seed, specialFinds: props.specialFinds,
    coreTaken: snapshot.mapCores.some((core) => core.mapId === FOREST_MAP_ID),
    worldMarks: snapshot.worldMarks.filter((entry) => entry.mapId === FOREST_MAP_ID).map((entry) => entry.mark),
    onWorldMark: props.onWorldMark,
    story: !session.beforeFocus&&snapshot.cloudStory?.nodeId === node?.id ? snapshot.cloudStory : null,
    onStoryRecord: props.onStoryRecord,
    onCinematicChange: props.onCinematicChange
  }
  const mossCue = mossLeave && mossLeave !== 'loading' ? mossLeave : null

  // Keep the destination rendering behind the mist while the first departure
  // plays. A slow shader compile must not expose a black frame at five seconds.
  const entrance = entranceSessionId === session.id && !campfireFailed && !props.skipCampfire
  const entranceFading = entrance && departureElapsedMs >= CAMPFIRE_WINDOW_MS && destinationReady
  useEffect(() => {
    if (!entranceFading) return
    const timer = window.setTimeout(() => setEntranceDismissed(true), 500)
    return () => window.clearTimeout(timer)
  }, [entranceFading])

  const crossing = leaving !== null && (leaving !== area || leaving === NURSERY)
  const waitingForLake = parent?.areaId === LAKE && departureElapsedMs < 5000 && !lakeCueSettled && !lakeLeave
  const waitingForCue = !cueTimedOut && ((parent?.areaId===NURSERY&&departureElapsedMs<8000&&!nurseryCueSettled&&!nurseryLeave) || waitingForLake || mossLeave === 'loading' && departureElapsedMs < DEPARTURE_WINDOW_MS)
  const showDestination = !waitingForCue && (!crossing || departureOver)
  // Once the source has drawn, prepare the destination during the authored
  // departure instead of adding its full construction time after the exit.
  const mountDestination = !waitingForCue && (!crossing || sourceReady || departureOver)
  const destinationVisible = destinationReady && showDestination
  const destinationStatus = useRef<{ activity: string | null; cinematic: boolean }>({ activity: null, cinematic: false })
  const destinationCallbacks = {
    onActivityChange: (activity: string): void => {
      destinationStatus.current.activity = activity
      if (!crossing || destinationVisible) props.onActivityChange(activity)
    },
    onCinematicChange: (active: boolean): void => {
      destinationStatus.current.cinematic = active
      if (!crossing || destinationVisible) props.onCinematicChange(active)
    }
  }
  useEffect(() => {
    if (!destinationVisible) return
    if (destinationStatus.current.activity) props.onActivityChange(destinationStatus.current.activity)
    props.onCinematicChange(destinationStatus.current.cinematic)
  }, [destinationVisible])
  useEffect(() => {
    if (!destinationVisible) return
    const timer = window.setTimeout(() => setReleasedSession(session.id), 350)
    return () => window.clearTimeout(timer)
  }, [destinationVisible, session.id])
  // Keep the last source frame on screen through destination construction AND GPU compilation.
  // Opacity 0 still gives the new canvas its real dimensions; display:none would not.
  return <div className="area-focus-scenes">
    {!destinationReady && (!entrance || departureElapsedMs >= CAMPFIRE_WINDOW_MS || campfireFailed) && (showDestination || waitingForCue) && <TravelLoading paused={props.paused} />}
    {crossing && releasedSession !== session.id && <div className="area-scene-layer" key="source" data-area-layer="source">
      {leaving === NURSERY && nurseryLeave ? <GlassNurseryFocusScene {...common} audioSettings={audioSettings} audioActive={props.audioActive!==false} retainForLobby={false} nursery={nurseryLeave.state} progressSeconds={nurseryLeave.state?.effectiveSeconds??3000} nodeId={`leave:${parent?.id}`} departure={nurseryLeave.cue} onDepartureComplete={onDepartureComplete} onReady={()=>setSourceReady(true)}/> : leaving === LAKE && lakeLeave ? <ReflectionLakeFocusScene {...common} audioSettings={audioSettings} retainForLobby={false} lake={lakeLeave.state} nodeId={`leave:${parent?.id}`} departure={lakeLeave.cue} onDepartureComplete={onDepartureComplete} onReady={()=>setSourceReady(true)} /> : leaving === MOSS && mossCue
        ? <MossStationFocusScene departureOnly {...common} retainForLobby={false} moss={null} nodeId={`leave:${mossCue.cue.exit}`}
          departure={mossCue.cue} departureState={mossCue.state} onDepartureComplete={onDepartureComplete} onReady={()=>setSourceReady(true)} />
        : <CloudRuinsFocusScene departureOnly {...cloudProps} retainForLobby={false} departure={cloudCue} onDepartureComplete={onDepartureComplete} onReady={()=>setSourceReady(true)} />}
    </div>}
    {mountDestination && <div className="area-scene-layer area-scene-destination" key="destination" data-area-layer="destination"
      style={{ opacity: !crossing || destinationVisible ? 1 : 0 }}>
      {area === NURSERY ? <GlassNurseryFocusScene {...common} {...destinationCallbacks} audioSettings={audioSettings} audioActive={props.audioActive !== false && (!crossing || destinationVisible) && (!entrance || entranceDismissed)} nursery={snapshot.nursery??null} nodeId={node?.id??session.id} onReady={()=>{setReadySession(session.id);props.onReady?.()}}/> : area === LAKE ? <ReflectionLakeFocusScene {...common} {...destinationCallbacks} audioActive={props.audioActive !== false && (!crossing || destinationVisible) && (!entrance || entranceDismissed)} audioSettings={audioSettings} lake={lakeState ?? null} nodeId={node?.id??session.id} departure={leaving===LAKE?lakeLeave?.cue:null} departureState={lakeLeave?.state} onDepartureComplete={onDepartureComplete} onReady={()=>{setReadySession(session.id);props.onReady?.()}} /> : area === MOSS
        ? <MossStationFocusScene {...common} {...destinationCallbacks} audioActive={props.audioActive !== false && (!crossing || destinationVisible) && (!entrance || entranceDismissed)} audioSettings={audioSettings} moss={moss} nodeId={node?.id ?? session.id}
          onReady={() => { setReadySession(session.id); props.onReady?.() }}
          departure={leaving === MOSS && mossCue ? mossCue.cue : null} departureState={mossCue?.state ?? null} />
        : <CloudRuinsFocusScene {...cloudProps} {...destinationCallbacks} audioActive={props.audioActive !== false && (!crossing || destinationVisible) && (!entrance || entranceDismissed)} onReady={() => { setReadySession(session.id); props.onReady?.() }}
          departure={leaving === 'area-01-cloud-ruins' ? cloudCue : null} />}
    </div>}
    {entrance && !entranceDismissed && node && <div className={`campfire-depart-layer${entranceFading ? ' is-fading' : ''}`}>
      <CampfireStage
        audioSettings={audioSettings} active={!props.paused}
        stage={snapshot.worldMarks.some((mark) => mark.mapId === 'campfire-start' && mark.mark === 'future_self_met')
          ? Math.max(1, Math.min(4, Math.ceil(snapshot.mapCores.length / 3) + 1)) : 0}
        seenStage={true} returned={false} departing
        departureStartedAt={session.startedAt} departureElapsedMs={departureElapsedMs} departurePaused={props.paused}
        routes={[{ id: node.id, mapId: area === LAKE ? LAKE : area === MOSS ? 'map-02-moss-station' : 'map-01-cloud-ruins', title: node.title,
          tagline: node.description, details: null, itemHints: [], clueHint: null, coreOwned: false, visits: 0,
          exit: node.departureExitId === 'exit_steps' || node.departureExitId === 'exit_bridge' ? node.departureExitId : null }]}
        selectedRouteId={node.id} hoverRouteId={null} onFind={() => undefined}
        onFailed={() => setCampfireFailed(true)}
      />
    </div>}
  </div>
}
