import type { MossExit, MossSceneSnapshot } from '../../../shared/area02'
import type { CloudRuinsAnchors, CloudRuinsChrome } from '../cloudRuins/cloudRuinsScene'

/** getMossDeparture(): the first Focus of the next route plays this from the station (5 s at most). */
export interface MossDepartureCue {
  exit: MossExit
  /** Rest spot → exit node; only the first steps are shown before the mist covers the swap. */
  route: string[]
  durationMs: number
}

/** Lobby: where a route leaves the station. 'entry' = the boardwalk up from the mist (a fresh day). */
export type MossRouteExit = MossExit | 'entry'

export interface MossRouteMark {
  key: string
  exit: MossRouteExit | null
  state: 'selected' | 'available' | 'partial'
}

export type MossLobbyView = { kind: 'close' } | { kind: 'look'; exit: MossExit } | { kind: 'overview' }

export interface MossStationSceneOptions {
  /** 'lobby' holds the saved state still (Today): the traveller rests on the bench or waits at the last lamp. */
  quietFocus?: boolean
  replay?: boolean
  mode?: 'focus' | 'lobby'
  lobbyView?: MossLobbyView | null
  /** Effective seconds on this node (saved progress + this Focus); the same value the HUD uses. */
  progressSeconds: number
  /** 3000 for Area 02. Lamps are due at equal fifths. */
  targetSeconds: number
  /** The saved presentation state (window.focusQuest.getMossScene / snapshot.mossStation). */
  moss?: MossSceneSnapshot | null
  /** Only the first Focus of the next route carries it. */
  departure?: MossDepartureCue | null
  /** The station being left (getMossScene of the previous node): its sky, weather and marks during the departure. */
  departureState?: MossSceneSnapshot | null
  /** How far into this Focus we already are when the scene mounts (reopen / remount). */
  departureOnly?: boolean
  departureElapsedMs?: number
  /** Mounted right after another Area's departure: start under the mist and let it lift (about 0.65 s). */
  arriveFromMist?: boolean
  paused?: boolean
  reducedMotion?: boolean
  /** Headless QA captures only. */
  preserveDrawingBuffer?: boolean
  /** Headless QA only: draw on renderNow() instead of running the animation loop. */
  manualFrames?: boolean
  reportActivity?: (activity: string) => void
  reportCinematic?: (active: boolean) => void
  reportLights?: (dueCount: number) => void
  /** Visual sync only. Never gate saved progress on it. */
  reportDepartureComplete?: () => void
  /** Two frames submitted, including initial shader compilation and measured glass. */
  reportReady?: () => void
  reportAnchors?: (anchors: CloudRuinsAnchors) => void
  reportWorldMark?: (mark: string) => void
}

export interface MossStationSceneHandle {
  readonly areaId: 'area-02-moss-station'
  /** A newer saved state: the current action (walk plan / event / wait / lamp / rest), weather seed, marks, umbrella, core. */
  setMossState(state: MossSceneSnapshot): void
  enterLobby(host: HTMLElement, options: MossStationSceneOptions): void
  renderNow(): void
  setProgress(progressSeconds: number): void
  /** No-op: Area 02 finds play from the saved event action itself. */
  playSpecialFind(eventId: string): void
  setWorldState(state: { coreTaken?: boolean; worldMarks?: string[] }): void
  beginRecapEvent(record:import('../../../shared/focusPresentation').FocusEventRecord,actionId:number):void
  warmRecapEvent(record:import('../../../shared/focusPresentation').FocusEventRecord):Promise<void>
  showRecapOverview(close?:boolean):void
  setRecapLamps(count:number):void
  setRecapDormant(dormant:boolean):void
  enableRecapTransitions():void
  beginRecapTransition(duration:number):void
  setRecapRate?(rate:number):void
  setQuietFocus(quiet:boolean):void
  setPaused(paused: boolean): void
  setUiFade(opacity: number): void
  setChrome(chrome: CloudRuinsChrome): void
  setRoutes(routes: MossRouteMark[], hoverKey?: string | null): void
  setLobbyView(view: MossLobbyView): void
  setLobbyItems(items: Array<{ key: string }>): void
  setReducedMotion(reducedMotion: boolean): void
  /** Presentation comparison only; never modifies the saved event. */
  setDirectorEnabled(enabled: boolean): void
  /** A seek or recovery draws the current saved progress without travelling from home. */
  snapCamera(): void
  debugState(): Record<string, unknown>
  destroy(): void
}

export const MOSS_SCENE_AREA_ID: 'area-02-moss-station'
export function createMossStationScene(host: HTMLElement, options: MossStationSceneOptions): MossStationSceneHandle
