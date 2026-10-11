// The lobby (Today, core plan §47) is drawn from one view model and reports what the player does
// through one set of actions. The front end never decides progress, rewards or task state: Codex fills
// LobbyViewModel from the save and implements LobbyActions (IPC). See docs/LOBBY_A_HANDOFF.md.

/** Weekday numbers as in Date.getDay(): 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * - journey_start: a new journey; the first map is chosen from two routes.
 * - exploring: the current map has saved progress but is not finished (only Continue; no route choice).
 * - choose_route: the current map is complete; two routes to the next map (one may be selected).
 * - final_ready: the fifth map is complete; the next step is the final encounter.
 * - returned: back at the start after an encounter or ending; a new journey can begin.
 */
/** Where a route leaves the current map: 雲上遺庭's two exits or 苔痕驛站's two exits. */
export type LobbyExit = 'exit_corridor' | 'exit_cellar' | 'exit_high' | 'exit_pines' | 'exit_boat' | 'exit_tunnel' | 'exit_bridge' | 'exit_steps' | 'a_arch' | 'b_far'
/** Which scene draws a map. */
export type LobbySceneKey = 'area-01-cloud-ruins' | 'area-02-moss-station' | 'area-03-reflection-lake' | 'area-07-glass-nursery'

export type LobbyPhase = 'journey_start' | 'exploring' | 'choose_route' | 'final_ready' | 'returned'

export interface LobbyJourney {
  /** The segment being explored, or about to start (1–5). */
  segment: number
  total: 5
  /** Completed maps of this journey, in order. */
  visited: Array<{ mapId: string; title: string }>
  /** One sentence on the clue being followed, or null. */
  trackingClue: string | null
}

export interface LobbyCurrentMap {
  mapId: string
  title: string
  /** Which scene draws it. */
  sceneKey: LobbySceneKey
  /** The saved node shown (Area 02 reads its scene state by node); null for mock data. */
  nodeId?: string | null
  /** Effective exploration seconds saved for this map instance. */
  exploredSeconds: number
  /** 3000 (50 minutes) under §46. */
  targetSeconds: number
  /** This map's permanent core is owned (the scene shows its empty cradle). */
  coreOwned: boolean
  /** Saved one-time world marks for this map (e.g. 'tree_traces_seen'). */
  worldMarks: string[]
}

export interface LobbyRouteOption {
  id: string
  /** Saved duration for legacy routes; do not label a 25/90-minute save as 50. */
  targetSeconds?: number
  /** The exit of the current map this route leaves by; null when it starts from the journey's start point. */
  exit: LobbyExit | null
  mapId: string
  title: string
  /** One line on what the map is like (its tendency), shown on the card. */
  tagline: string
  /** A longer description for the detail card, or null. */
  details: string | null
  /** Bag items that can be used there, each with a short line. */
  itemHints: Array<{ itemKey: string; text: string }>
  /** How this route relates to the tracked clue or a revisit, or null. */
  clueHint: string | null
  /** Whether this map's permanent core is already owned. Guarantee progress is never shown (§47.3). */
  coreOwned: boolean
  /** Completed explorations of this map before (any journey). */
  visits: number
}

export interface LobbyBagItem {
  key: string
  title: string
  /** What it does, in one sentence. */
  use: string
  isNew: boolean
  /** Known combinations, e.g. "舊燈芯＋覆寫墨水：無聲書庫". Empty until discovered. */
  knownCombos: string[]
}

/** Things brought back from the last completed map that lie on the grass until the player looks at them. */
export interface LobbyNewFind {
  key: string
  kind: 'item' | 'core' | 'clue'
  title: string
  text: string
}

export interface LobbyPendingEvent {
  id: string
  /** One concrete observation (§COPY_STYLE). */
  prompt: string
  options: Array<{ id: string; label: string }>
}

export interface LobbyTask {
  id: string
  title: string
  /** Optional note (what to push forward this time). */
  note: string | null
  /** Set when the task comes from a routine. */
  routineId: string | null
  done: boolean
  /** Local YYYY-MM-DD the item was planned for; shown on items waiting from earlier days. */
  scheduledDate?: string | null
}

export interface LobbyRoutine {
  id: string
  title: string
  days: Weekday[]
}

export interface LobbyTasks {
  /** Today's ordered list. Done items stay, struck through. */
  today: LobbyTask[]
  /** Unfinished one-off items from before today, waiting for the player to move or delete them. */
  yesterday: LobbyTask[]
  /** The task the next Focus is for: the first unfinished item unless the player picked another. */
  currentTaskId: string | null
}

export interface LobbyViewModel {
  phase: LobbyPhase
  /** §48 campfire traces, computed from permanent story/collection state. */
  campfireStage: number
  seenCampfireStage: boolean
  journey: LobbyJourney
  map: LobbyCurrentMap
  /** Two options in journey_start / returned (after starting) and choose_route; empty otherwise. */
  routes: LobbyRouteOption[]
  selectedRouteId: string | null
  bag: LobbyBagItem[]
  newFinds: LobbyNewFind[]
  pendingEvents: LobbyPendingEvent[]
  tasks: LobbyTasks
  routines: LobbyRoutine[]
  collectionHasNew: boolean
  /** Seed for the scene's ambient variation (journey seed). */
  seed: number
}

export interface LobbyActions {
  /** Select (or re-select) a route. Never starts the timer. */
  selectRoute: (routeId: string) => void
  /**
   * The one main button: journey_start / choose_route → confirm the task and depart on the selected route;
   * exploring → continue the current map; final_ready → go to the final encounter; returned → begin a new journey.
   * Opens the departure confirmation; only that confirmation starts Focus.
   */
  primary: () => void
  openCollection: () => void
  /** The player looked at a find on the grass (clears its "new" state). */
  inspectFind: (key: string) => void
  inspectCampfireTrace: (stage: number) => void
  chooseEvent: (eventId: string, optionId: string) => void
  addTask: (title: string) => void
  /** Make this task the one the next Focus is for. */
  setCurrentTask: (taskId: string) => void
  /** Move a task within today's list by -1 / +1. */
  moveTask: (taskId: string, delta: -1 | 1) => void
  removeTask: (taskId: string) => void
  /** Move some or all unfinished items from before today to the end of today's list. */
  moveToToday: (taskIds: string[]) => void
  /** Permanently delete every item waiting in the yesterday tab. The UI has already asked to confirm. */
  deleteAllYesterday: () => void
  saveRoutine: (routine: { id: string | null; title: string; days: Weekday[] }) => void
  deleteRoutine: (routineId: string) => void
}

// ── Departure (出發前確認, replaces FocusSetup for the §47 lobby) ─────────────────────────────

export interface DepartureModel {
  /** new: the selected route to a new map; continue: the current map's saved progress. */
  mode: 'new' | 'continue'
  mapTitle: string
  exit: LobbyExit | null
  exploredSeconds: number
  targetSeconds: number
  /** The task this Focus is for (today's current task). */
  task: LobbyTask
  /** Today's other unfinished items, to switch to without leaving the sheet. */
  otherTasks: LobbyTask[]
  /** Settings: ask the player to confirm the phone is out of reach. */
  phoneRitual: boolean
  /** Process names blocked last time (preselected). */
  blockedProcessNames: string[]
  itemChoice: null | {
    coreTitle: string
    defaultItemKey: string | null
    options: Array<{ itemKey: string; title: string; trackedPlaceTitle: string | null }>
  }
}

export interface DepartureRunningApp {
  processName: string
  displayName: string
}

export interface DepartureInput {
  taskId: string
  minimumMinutes: 5 | 10 | 15
  blockedApps: DepartureRunningApp[]
  requestedJourneyItem: string | null
}

// ── After Focus: "完成了嗎？" then a short review (§47.4, canvas S2 + E) ─────────────────────

export interface AfterFocusModel {
  /** 'task': ask whether the item is done. 'review': what this session left in the world. */
  step: 'task' | 'review'
  effectiveSeconds: number
  task: { id: string; title: string } | null
  /** The item that would come up next if this one is done (today's list), or null. */
  nextTask: { id: string; title: string; routineDays: Weekday[] | null } | null
  map: {
    title: string
    /** Which scene draws the map (defaults to 雲上遺庭). */
    sceneKey?: LobbySceneKey
    nodeId?: string | null
    /** Saved exploration after this session. */
    exploredSeconds: number
    targetSeconds: number
    /** Lamps lit before this session started (to show what changed). */
    litBefore: number
  }
  /** complete: the map reached 50 minutes this session; partial: saved and continues; too_short: no map progress. */
  resolution: 'complete' | 'partial' | 'too_short'
  /** Items, cores and clues saved during this session, in the order found. */
  finds: LobbyNewFind[]
  /** Choices waiting; each can be answered here or left for the lobby. */
  pendingEvents: LobbyPendingEvent[]
}

export interface AfterFocusActions {
  /** done = the whole item is complete (strike it, bring up the next); not done = it stays on top. */
  answerTask: (done: boolean) => void
  chooseEvent: (eventId: string, optionId: string) => void
  /** Leave to the lobby (unanswered events wait there). */
  finish: () => void
}
