export interface CloudRuinsDepartureCue {
  exit: 'exit_high' | 'exit_pines'
  route: string[]
  durationMs: number
}

/** Where the Focus Active text sits, in CSS pixels relative to the scene host. */
export interface CloudRuinsChrome {
  /** Header band: distance from the host top to the header bottom. */
  top: number
  /** Footer band: distance from the footer top to the host bottom. */
  bottom: number
  /** Side panel (lobby): distance from the panel's left edge to the host's right edge. The Area is framed left of it. */
  right?: number
  /** Navigation rail over the left edge (Today lobby): distance from the host's left edge to the rail's right edge. */
  left?: number
  /** pill: crisp glass card with a lit rim; zone: soft darkening behind a text group.
   *  snap: the card tracks the camera (lobby route markers), so its glass jumps with it instead of easing. */
  cards: Array<{ x: number; y: number; w: number; h: number; kind: 'pill' | 'zone'; snap?: boolean }>
}

/** Lobby: where a route leaves this Area. 'entry' = the entry stones (a fresh day, before the Area). */
export type CloudRuinsRouteExit = 'exit_high' | 'exit_pines' | 'entry'

export interface CloudRuinsRouteMark {
  key: string
  exit: CloudRuinsRouteExit | null
  state: 'selected' | 'available' | 'partial'
}

/** Screen positions in CSS pixels from the scene host's top-left: 'exit_high', 'exit_pines', 'entry', 'rest',
 *  and 'item:<key>' for each find set with setLobbyItems. */
export type CloudRuinsAnchors = Partial<Record<string, { x: number; y: number }>>

/** Lobby camera. close: close-up of the traveller; look: toward one exit; overview: the whole Area. */
export type CloudRuinsLobbyView = { kind: 'close' } | { kind: 'look'; exit: 'exit_high' | 'exit_pines' } | { kind: 'overview' }

export interface CloudRuinsSceneOptions {
  /** 'lobby' holds progressSeconds still (Today): lamps and daylight stay as saved, the traveller rests or waits. */
  mode?: 'focus' | 'lobby'
  /** Lobby only: the first camera. Default close-up. */
  lobbyView?: CloudRuinsLobbyView | null
  /** World progress on this route in seconds (saved node progress + this session). */
  progressSeconds: number
  /** Planned exploration time for the route; lamps are due at equal fifths of it. */
  targetSeconds: number
  seed?: number
  /** Stable per Focus session, so the cloud whale schedule survives pause and reload. */
  whaleSeed?: number
  /** Saved eligibility and completed records; the scene only presents them. */
  story?: NonNullable<import('../../../shared/types').AppSnapshot['cloudStory']> | null
  reportStoryRecord?: (clueId: string) => void
  reportCinematic?: (active: boolean) => void
  reducedMotion?: boolean
  /** FocusSession.departure. Only the first Focus on a new route carries it. */
  departure?: CloudRuinsDepartureCue | null
  arriveFromMist?: boolean
  /** Start frozen (Focus reopened while paused). Toggle later with setPaused; never rebuild for it. */
  paused?: boolean
  /** How far into this Focus we already are when the scene mounts (reopen / remount). */
  departureOnly?: boolean
  departureElapsedMs?: number
  reportActivity?: (activity: string) => void
  reportLights?: (dueCount: number) => void
  /** Visual sync only. Never gate saved progress on it. */
  reportDepartureComplete?: () => void
  /** Two frames submitted, including initial shader compilation and measured glass. */
  reportReady?: () => void
  /** The Area's permanent core is already owned: the astrolabe shows its empty cradle. */
  coreTaken?: boolean
  /** Saved one-time world marks for this Area (e.g. 'tree_traces_seen'). Omit when not stored yet. */
  worldMarks?: string[]
  /** A one-time world moment finished (presentation signal only; the back end decides what to save). */
  reportWorldMark?: (mark: string) => void
  /** Lobby only: called when the camera, size or framing moves the route anchors. */
  reportAnchors?: (anchors: CloudRuinsAnchors) => void
}

export interface CloudRuinsSceneHandle {
  /** One-way Focus/review -> lobby handoff. Reuses the renderer, geometry and
   * GPU programs; uses saved lobby progress and existing authored rest anchors. */
  enterLobby(host: HTMLElement, options: CloudRuinsSceneOptions): void
  /** Present one measured frame during a DOM/view-transition commit. */
  renderNow(): void
  setProgress(progressSeconds: number): void
  /** Plays the find reveal for a saved result: journey items (tier 'journey') warm and modest, the core blue. */
  playSpecialFind(eventId: string, specifiedByCore?: boolean): void
  /** Saved world state changed. coreTaken=true waits until a queued/playing core reveal has finished. */
  setWorldState(state: { coreTaken?: boolean; worldMarks?: string[] }): void
  /** Freeze or resume every animation on the scene clock; resuming continues from the same instant. */
  setPaused(paused: boolean): void
  /** Immersive mode: opacity of the glass under the text, eased by the scene. */
  setUiFade(opacity: number): void
  /** Frames the Area inside the clear band and draws edge glass behind the given text areas. */
  setChrome(chrome: CloudRuinsChrome): void
  /** Lobby only: draws a trail from the rest spot to each route's exit; the selected one is lit. */
  setRoutes(routes: CloudRuinsRouteMark[], hoverKey?: string | null): void
  /** Lobby only: eases the camera (about 1.2 s) to a close-up, toward an exit, or to the whole Area. */
  setLobbyView(view: CloudRuinsLobbyView): void
  /** Lobby only: new finds lying beside the resting traveller (up to 3); anchors 'item:<key>'. */
  setLobbyItems(items: Array<{ key: string }>): void
  setReducedMotion(reducedMotion: boolean): void
  debugState(): Record<string, unknown>
  destroy(): void
}

export function createCloudRuinsScene(host: HTMLElement, options: CloudRuinsSceneOptions): CloudRuinsSceneHandle
