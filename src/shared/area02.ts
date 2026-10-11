import scene from '../../docs/area-02-moss-station.scene.json'
import { weatherAllows, weatherAt, weatherSeedFrom, type WeatherCondition, type WeatherPhase } from './weather'
import { litLampCount } from './lampTiming'
import { avoidRecentEventSpots, nearbyEventWeight } from './eventSelection'

export const MOSS_AREA_ID = 'area-02-moss-station' as const
export const MOSS_TARGET_SECONDS = 3000
export const MOSS_WALK_SPEED = 0.35
export type MossExit = 'exit_boat' | 'exit_tunnel'
export interface MossWorldMarks {
  boulderStones: number
  jizoPebbles: number
  signalLowered: boolean
  towelLeft: boolean
  bench_tea_seen: boolean
  carvingSeen?: boolean
  drawerTagLeft?: boolean
  saplingWrapped?: boolean
}
export const emptyMossMarks = (): MossWorldMarks => ({ boulderStones: 0, jizoPebbles: 0,
  signalLowered: false, towelLeft: false, bench_tea_seen: false,
  carvingSeen: false, drawerTagLeft: false, saplingWrapped: false })

export interface MossStoryPlan {
  opening: boolean
  visitEvent: 'story_first_lantern' | 'story_second_sketch' | null
  coreEvents: string[]
  /** Journey items already held when this exploration began. */
  carriedItems: string[]
}
type StoryEvent = { id: string; name: string; kind: string; spot: string; dur: number[]; anim: string; effect: string;
  clue?: string; worldMark?: string; card?: string; phases?: [number, string][]; status?: [number, string][];
  weather?: string; shelter?: boolean; combo?: { card?: string } }
export const mossStoryEvents: readonly StoryEvent[] = scene.storyEvents as unknown as StoryEvent[]
const storyEvents = new Map(mossStoryEvents.map(event => [event.id, event]))
const carryEventForItem: Record<string, string> = { old_wick: 'carry_old_wick', weathered_lens: 'carry_weathered_lens',
  charcoal_rubbing: 'carry_charcoal_rubbing', mulch_cloth: 'carry_mulch_cloth' }

export interface MossEvent {
  id: string; spot: string; name: string; anim: string; dur: number[]; weight?: number
  weather?: string; once?: boolean; rare?: boolean; outcome: string
  note?: string; tagGain?: string[]; shelter?: boolean; worldMark?: string
}
export const mossEvents: readonly MossEvent[] = scene.events
const events = new Map(mossEvents.map(event => [event.id, event]))
const nodes = new Set(scene.nodes.map(node => node.id))
interface RouteData { path: string[]; distance: number; legSeconds: number[]; travelSeconds: number }
function routeTable(rain: boolean): Map<string, Map<string, RouteData>> {
  const table = new Map<string, Map<string, RouteData>>()
  for (const start of nodes) {
    const distances = new Map([[start, 0]]), previous = new Map<string, string>(), todo = new Set(nodes)
    while (todo.size) {
      const current = [...todo].filter(id => distances.has(id)).sort((a, b) => distances.get(a)! - distances.get(b)!)[0]
      if (!current) break
      todo.delete(current)
      for (const edge of scene.edges) {
        if (rain && edge.closedInRain) continue
        const next = edge.a === current ? edge.b : edge.b === current ? edge.a : null
        if (!next || !todo.has(next)) continue
        const distance = distances.get(current)! + edge.length
        if (distance < (distances.get(next) ?? Infinity)) { distances.set(next, distance); previous.set(next, current) }
      }
    }
    const routes = new Map<string, RouteData>()
    for (const [end, distance] of distances) {
      const path = [end]
      while (path[0] !== start) path.unshift(previous.get(path[0])!)
      const legSeconds = path.slice(1).map((id, i) => Math.ceil(scene.edges.find(edge =>
        (edge.a === path[i] && edge.b === id) || (edge.b === path[i] && edge.a === id))!.length / MOSS_WALK_SPEED))
      routes.set(end, { path, distance, legSeconds, travelSeconds: legSeconds.reduce((sum, seconds) => sum + seconds, 0) })
    }
    table.set(start, routes)
  }
  return table
}
const routesByWeather = { dry: routeTable(false), rain: routeTable(true) }
function routeData(start: string, end: string, rain: boolean): RouteData {
  if (!nodes.has(start) || !nodes.has(end)) throw new Error('苔痕驛站路點不存在。')
  const route = routesByWeather[rain ? 'rain' : 'dry'].get(start)?.get(end)
  if (!route) throw new Error('苔痕驛站路線無法抵達。')
  return route
}
export function mossRoute(start: string, end: string, rain = false): string[] { return [...routeData(start, end, rain).path] }
export function mossRouteSeconds(start: string, end: string, rain = false): number {
  return routeData(start, end, rain).distance / MOSS_WALK_SPEED
}
export function mossDeparture(nodeId: string, exit: MossExit, rain = false) {
  if (exit !== 'exit_boat' && exit !== 'exit_tunnel') throw new Error('未知的驛站出口。')
  return { fromExpeditionNodeId: nodeId, fromAreaId: MOSS_AREA_ID, exit,
    route: mossRoute('p_bench', exit, rain), durationMs: 5000 as const }
}

type IntentKind = 'event' | 'special' | 'story' | 'lamp' | 'rest'
interface Intent { kind: IntentKind; node: string; eventId?: string; duration: number; lamp?: number; findId?: string; startAt?: number }
export interface MossAction {
  id: number; kind: 'walk' | 'event' | 'wait' | 'lamp' | 'rest'
  node: string; route: string[]; eventId?: string; startSeconds: number; endSeconds: number
  /** Animations interpolate this saved action; callbacks do not advance it. */
  anim?: string
  /** Presentation-only: this journey item was selected with the owned map core. */
  specifiedByCore?: boolean
  /** Full remaining walk, including this in-flight edge. Times are absolute effective seconds. */
  plan?: { destination: string; path: string[]; legEndSeconds: number[] }
}
export interface MossFind { id: string; eventId: string; lampIndex: number; itemKey?: string }
export interface MossRuntime {
  version: 1; weatherSeed: number; seconds: number; node: string; sequence: number
  umbrella: 'none' | 'borrowed'; usedEvents: string[]; handledFinds: string[]
  visitedLamps: number[]; lastEvent: string | null; action: MossAction | null; intent: Intent | null
  /** Optional for pre-policy v1 saves; filled on the next advance. */
  lastEventSpot?: string | null
  eventCompletedAt?: Record<string, number>
  storyPlan?: MossStoryPlan
  /** Between-lamp segments already used by a story this exploration. */
  storySegmentsUsed?: number[]
  /** The wrapped seedling belongs to this exploration, not the permanent map. */
  saplingWrapped?: boolean
  notes: Array<{ eventId: string; text: string; tags: string[]; atSeconds: number }>
}
export interface MossSceneSnapshot {
  saplingTaken?: boolean
  areaId: typeof MOSS_AREA_ID; nodeId: string; targetSeconds: 3000; effectiveSeconds: number
  weatherSeed: number; weather: ReturnType<typeof weatherAt>; worldMarks: MossWorldMarks
  coreTaken: boolean; umbrella: MossRuntime['umbrella']; action: MossAction | null
  saplingWrapped?: boolean
  litLampCount: number; notes: MossRuntime['notes']
}
export function createMossRuntime(nodeId: string, storyPlan?: MossStoryPlan): MossRuntime {
  return { version: 1, weatherSeed: weatherSeedFrom(`${MOSS_AREA_ID}:${nodeId}`), seconds: 0,
    node: 'w_gate', sequence: 0, umbrella: 'none', usedEvents: [], handledFinds: [], visitedLamps: [],
    lastEvent: null, lastEventSpot: null, eventCompletedAt: {}, storyPlan, storySegmentsUsed: [], saplingWrapped: false,
    action: null, intent: null, notes: [] }
}
export function mossEventAllowed(event: MossEvent, phase: WeatherPhase, state: MossRuntime): boolean {
  if (event.rare || (event.once && state.usedEvents.includes(event.id))) return false
  // Return is required even if a long walk outlasts the 240-second wet window.
  if (event.id === 'ev_umbrella_return') return phase !== 'rain' && state.umbrella === 'borrowed'
  if (!weatherAllows(event.weather as WeatherCondition | undefined, phase)) return false
  if (event.id === 'ev_umbrella_borrow') return state.umbrella === 'none'
  return phase !== 'rain' || !!event.shelter || (state.umbrella === 'borrowed' && event.weather === 'rain')
}
function random(state: MossRuntime, salt: string): number {
  return weatherSeedFrom(`${state.weatherSeed}:${state.sequence}:${state.seconds}:${salt}`) / 4294967296
}
function choose<T extends { weight?: number }>(entries: T[], roll: number): T | undefined {
  let value = roll * entries.reduce((sum, entry) => sum + (entry.weight ?? 1), 0)
  return entries.find(entry => { value -= entry.weight ?? 1; return value < 0 }) ?? entries.at(-1)
}
function complete(state: MossRuntime, marks: MossWorldMarks): void {
  const action = state.action!
  if (action.kind === 'walk') { state.node = action.node; return }
  if (action.kind === 'wait') return
  const intent = state.intent!
  if (intent.kind === 'lamp') state.visitedLamps.push(intent.lamp!)
  const id = intent.eventId
  if (id) {
    state.lastEvent = id
    if (!state.usedEvents.includes(id)) state.usedEvents.push(id)
    const event = events.get(id)
    if (event) { state.lastEventSpot = event.spot; state.eventCompletedAt![id] = state.seconds }
    if (event?.note && !state.notes.some(note => note.eventId === id)) state.notes.push({ eventId: id,
      text: event.note, tags: event.tagGain ?? [], atSeconds: state.seconds })
    if (id === 'ev_boulder_stack') marks.boulderStones = Math.min(8, marks.boulderStones + 1)
    if (id === 'ev_jizo_stone') marks.jizoPebbles = Math.min(12, marks.jizoPebbles + 1)
    if (id === 'ev_signal_pull') marks.signalLowered = true
    if (id === 'ev_umbrella_borrow') state.umbrella = 'borrowed'
    if (id === 'ev_umbrella_return') { state.umbrella = 'none'; marks.towelLeft = true }
    if (id === 'rest_bench_first') marks.bench_tea_seen = true
    const story = storyEvents.get(id)
    if (story?.worldMark && story.worldMark in marks) (marks as unknown as Record<string, boolean>)[story.worldMark] = true
    if (id === 'carry_mulch_cloth') state.saplingWrapped = true
    if (story) {
      if (story.kind !== 'opening') {
        state.storySegmentsUsed ??= []
        if (!state.storySegmentsUsed.includes(state.visitedLamps.length)) state.storySegmentsUsed.push(state.visitedLamps.length)
      }
      state.lastEventSpot = story.spot
      state.eventCompletedAt![id] = state.seconds
      const text = story.card || scene.clues.find(clue => clue.id === story.clue)?.text || story.id
      state.notes.push({ eventId: id, text, tags: [], atSeconds: state.seconds })
      if (id === 'carry_old_wick' && state.storyPlan?.carriedItems.includes('old_luggage_tag') && story.combo?.card)
        state.notes.push({ eventId: `${id}:combo`, text: story.combo.card, tags: [], atSeconds: state.seconds })
    }
  }
  state.intent = null
}

function setWalkPlan(state: MossRuntime, rain: boolean): void {
  const action = state.action!
  const intent = state.intent!
  const phase = rain ? 'rain' : weatherAt(state.weatherSeed, state.seconds).phase
  const eventInvalid = intent.kind === 'event' && !mossEventAllowed(events.get(intent.eventId!)!, phase, state)
  const rest = intent.kind === 'rest' ? scene.restActivities.find(entry => entry.id === intent.eventId) : undefined
  const restInvalid = rest && !weatherAllows(rest.weather as WeatherCondition | undefined, phase)
  // A weather-invalid activity stops at the current edge's endpoint. Do not let the
  // renderer anticipate a cancelled continuation; never snap back mid-edge.
  const destination = eventInvalid || restInvalid ? action.node : intent.node
  const remaining = routeData(action.node, destination, rain)
  let at = action.endSeconds
  action.plan = { destination, path: [action.route[0], ...remaining.path],
    legEndSeconds: [at, ...remaining.legSeconds.map(seconds => { at += seconds; return at })] }
}
function startAction(state: MossRuntime, kind: MossAction['kind'], node: string, duration: number, eventId?: string): void {
  state.action = { id: ++state.sequence, kind, node, route: kind === 'walk' ? [state.node, node] : [node],
    startSeconds: state.seconds, endSeconds: state.seconds + Math.max(1, Math.ceil(duration)), eventId,
    anim: eventId ? events.get(eventId)?.anim ?? storyEvents.get(eventId)?.anim ?? scene.restActivities.find(rest => rest.id === eventId)?.anim : undefined }
}

/** Advances only on supplied effective time. Safe to serialize and resume at any action boundary. */
export function advanceMossRuntime(saved: MossRuntime, seconds: number, savedMarks: MossWorldMarks, finds: readonly MossFind[]) {
  const state: MossRuntime = structuredClone(saved), marks = { ...savedMarks }
  state.lastEventSpot ??= state.lastEvent ? events.get(state.lastEvent)?.spot ?? null : null
  state.eventCompletedAt ??= Object.fromEntries(state.notes.map(note => [note.eventId, note.atSeconds]))
  state.storySegmentsUsed ??= state.notes.filter(note => storyEvents.has(note.eventId) && note.eventId !== 'story_open_carving')
    .map(note => Math.min(5, Math.floor(note.atSeconds / 600)))
  const target = Math.max(state.seconds, Math.floor(Number.isFinite(seconds) ? seconds : state.seconds))
  for (; state.seconds <= target; state.seconds++) {
    const weather = weatherAt(state.weatherSeed, state.seconds), rain = weather.phase === 'rain'
    if (state.action && state.seconds >= state.action.endSeconds) { complete(state, marks); state.action = null }
    // Finish an in-flight edge on the authored path, then revalidate and reroute at its endpoint.
    if (state.action && state.action.kind !== 'walk' && state.intent?.kind === 'event') {
      const event = events.get(state.intent.eventId!)!
      if (event.outcome === 'ambient' && !mossEventAllowed(event, weather.phase, state)) { state.action = null; state.intent = null }
    }
    if (state.action && state.action.kind !== 'walk' && state.intent?.kind === 'rest' && state.intent.eventId !== 'rest_bench_first') {
      const rest = scene.restActivities.find(entry => entry.id === state.intent!.eventId)!
      if (!weatherAllows(rest.weather as WeatherCondition | undefined, weather.phase)) { state.action = null; state.intent = null }
    }
    if (state.action?.kind === 'walk' && (!state.action.plan ||
      weather.phase !== weatherAt(state.weatherSeed, Math.max(0, state.seconds - 1)).phase)) setWalkPlan(state, rain)
    if (state.action) continue
    if (state.intent?.kind === 'event' && !mossEventAllowed(events.get(state.intent.eventId!)!, weather.phase, state)) state.intent = null
    if (state.intent?.kind === 'rest' && !weatherAllows(scene.restActivities.find(entry => entry.id === state.intent!.eventId)?.weather as WeatherCondition | undefined, weather.phase)) state.intent = null
    const nextLamp = scene.lamps.find(lamp => !state.visitedLamps.includes(lamp.index))
    const deadline = nextLamp ? nextLamp.index * 600 : Infinity
    // Reserve even the rain detour, so a weather change cannot consume the next lamp's walking time.
    const fits = (node: string, duration: number) => !nextLamp || state.seconds +
      routeData(state.node, node, true).travelSeconds + duration +
      routeData(node, nextLamp.node, true).travelSeconds + 12 < deadline
    const storyIntent = (id: string, startAt?: number): Intent | null => {
      const event = storyEvents.get(id)
      return event && fits(event.spot, event.dur[1]) ? { kind: 'story', node: event.spot, eventId: id,
        duration: event.dur[1], startAt } : null
    }
    if (!state.intent) {
      const story = state.storyPlan
      if (story?.opening && state.seconds < 120 && !state.usedEvents.includes('story_open_carving'))
        state.intent = storyIntent('story_open_carving', 15)
      const pendingFind = finds.find(find => !state.handledFinds.includes(find.id) && find.lampIndex * 600 <= state.seconds)
      if (!state.intent && pendingFind) {
        const id = pendingFind.eventId === 'rare_tablet_rubbing' && rain ? 'rare_ledger_rubbing' : pendingFind.eventId
        const event = events.get(id)
        if (event) {
          const duration = Math.ceil(event.dur[0] + random(state, 'find-duration') * (event.dur[1] - event.dur[0]))
          if (fits(event.spot, duration)) {
            state.handledFinds.push(pendingFind.id)
            if (pendingFind.itemKey && state.storyPlan && !state.storyPlan.carriedItems.includes(pendingFind.itemKey))
              state.storyPlan.carriedItems.push(pendingFind.itemKey)
            state.intent = { kind: 'special', node: event.spot, eventId: id, duration, findId: pendingFind.id }
          }
        }
      }
      if (!state.intent && story && nextLamp && state.visitedLamps.length >= 1 && nextLamp.index <= 5 &&
        !state.storySegmentsUsed.includes(state.visitedLamps.length)) {
        const previousLamp = state.visitedLamps.at(-1)!
        const sameSegmentFind = finds.some(find => find.lampIndex === previousLamp)
        const has = (id: string) => state.usedEvents.includes(id)
        if (!sameSegmentFind && story.visitEvent && !has(story.visitEvent) && !has('story_first_lantern_rain')) {
          const visit = story.visitEvent === 'story_first_lantern' && rain ? 'story_first_lantern_rain' : story.visitEvent
          state.intent = storyIntent(visit)
        }
        if (!state.intent && !sameSegmentFind && state.visitedLamps.length >= 2) {
          const core = story.coreEvents.find(id => !has(id))
          if (core) state.intent = storyIntent(core)
        }
        if (!state.intent && !sameSegmentFind && state.visitedLamps.length >= 2 &&
          !state.usedEvents.some(id => id.startsWith('carry_'))) {
          const held = new Set([...story.carriedItems, ...finds.filter(find => state.handledFinds.includes(find.id)).map(find => find.itemKey)])
          const choices = [...held].map(item => item && carryEventForItem[item]).filter((id): id is string => !!id)
          const available = choices.map(id => storyEvents.get(id)!).filter(event => !!event &&
            weatherAllows(event.weather as WeatherCondition | undefined, weather.phase) && fits(event.spot, event.dur[1]))
          const weighted = available.map(event => ({ event, weight: nearbyEventWeight(1,
            routeData(state.node, event.spot, rain).distance, state.seconds, state.eventCompletedAt![event.id]) }))
          const selected = choose(weighted, random(state, 'story-carry'))
          if (selected) state.intent = storyIntent(selected.event.id)
        }
      }
      if (!state.intent) {
        const returnUmbrella = !rain && state.umbrella === 'borrowed'
        const borrow = rain && state.umbrella === 'none' && !state.usedEvents.includes('ev_umbrella_borrow') &&
          nextLamp && deadline < (weather.window?.end ?? 0)
        const event = events.get(returnUmbrella ? 'ev_umbrella_return' : 'ev_umbrella_borrow')!
        if ((returnUmbrella || borrow) && fits(event.spot, event.dur[1])) state.intent = {
          kind: 'event', node: event.spot, eventId: event.id, duration: event.dur[1] }
      }
      if (!state.intent && nextLamp && (state.seconds >= deadline - routeData(state.node, nextLamp.node, true).travelSeconds - 15)) {
        state.intent = { kind: 'lamp', node: nextLamp.node, duration: 2, lamp: nextLamp.index }
      }
      if (!state.intent && nextLamp) {
        const available = mossEvents.filter(event => !event.rare && (event.weight ?? 0) > 0 &&
          mossEventAllowed(event, weather.phase, state) && fits(event.spot, event.dur[1]))
        const nearby = avoidRecentEventSpots(available, state.node, state.lastEventSpot).map(event => ({ ...event,
          weight: nearbyEventWeight(event.weight!, routeData(state.node, event.spot, rain).distance,
            state.seconds, state.eventCompletedAt![event.id]) }))
        const event = choose(nearby, random(state, 'event'))
        if (event) state.intent = { kind: 'event', node: event.spot, eventId: event.id,
          duration: Math.ceil(event.dur[0] + random(state, 'duration') * (event.dur[1] - event.dur[0])) }
      }
      if (!state.intent && !nextLamp) {
        const rest = !marks.bench_tea_seen ? scene.restActivities[0] : rain
          ? scene.restActivities.find(entry => entry.id === 'rest_rain')!
          : choose(scene.restActivities.filter(entry => entry.weight > 0 && entry.id !== state.lastEvent &&
            (!entry.requires || marks.bench_tea_seen) && weatherAllows(entry.weather as WeatherCondition | undefined, weather.phase)), random(state, 'rest'))!
        state.intent = { kind: 'rest', node: rest.node, eventId: rest.id,
          duration: Math.ceil(rest.dur[0] + random(state, 'duration') * (rest.dur[1] - rest.dur[0])) }
      }
    }
    const intent = state.intent
    if (!intent) { startAction(state, 'wait', state.node, 1); continue }
    if (state.node !== intent.node) {
      const route = mossRoute(state.node, intent.node, rain)
      startAction(state, 'walk', route[1], mossRouteSeconds(state.node, route[1], rain), intent.eventId)
      setWalkPlan(state, rain)
    } else if (intent.kind === 'story' && intent.startAt && state.seconds < intent.startAt) {
      startAction(state, 'wait', state.node, intent.startAt - state.seconds)
    } else if (intent.kind === 'lamp' && state.seconds < intent.lamp! * 600) {
      startAction(state, 'wait', state.node, intent.lamp! * 600 - state.seconds)
    } else startAction(state, intent.kind === 'special' || intent.kind === 'story' ? 'event' : intent.kind, state.node, intent.duration, intent.eventId)
  }
  state.seconds = target
  return { state, marks }
}

export function mossSceneSnapshot(nodeId: string, state: MossRuntime, marks: MossWorldMarks, coreTaken: boolean): MossSceneSnapshot {
  // Older saves can be opened while paused, before the first advancing tick.
  if (state.action?.kind === 'walk' && !state.action.plan) {
    state = structuredClone(state)
    setWalkPlan(state, weatherAt(state.weatherSeed, state.seconds).phase === 'rain')
  }
  return { areaId: MOSS_AREA_ID, nodeId, targetSeconds: 3000, effectiveSeconds: state.seconds,
    weatherSeed: state.weatherSeed, weather: weatherAt(state.weatherSeed, state.seconds), worldMarks: marks,
    coreTaken, umbrella: state.umbrella, saplingWrapped: state.saplingWrapped, action: state.action, notes: state.notes,
    litLampCount: litLampCount(state.seconds, MOSS_TARGET_SECONDS) }
}
