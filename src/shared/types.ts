import type { AddListTaskInput, DeleteYesterdayInput, SaveRoutineInput, StartListFocusInput, TaskListSnapshot } from './taskList'
import type { CollectionRoomState } from './collectionRoom'

/** Legacy UI/backup field; the new list uses scheduledDate + position, not roles. */
export type TaskRole = 'main' | 'side' | 'backlog'
export type TaskKind = 'study' | 'report' | 'admin' | 'creative' | 'other'
export type Obstacle = 'unclear' | 'too_big' | 'boring' | 'perfection' | 'missing_info'
export type TaskStatus = 'active' | 'done' | 'archived'
export type StepStatus = 'pending' | 'done'
export type CueType = 'time' | 'event' | 'manual'
export type FocusOutcome = 'completed' | 'progress' | 'blocked'
export type ReminderPolicy = 'off' | 'gentle' | 'structured'
export type RpgChoice = 'restore' | 'illuminate' | 'catalogue'
export type DailyRunStatus = 'active' | 'ended'
export type ExpeditionNodeType = 'passage' | 'archive' | 'cache' | 'detour'
export type ExpeditionDistance = 'near' | 'middle' | 'far'
export type ExpeditionNodeState = 'available' | 'selected' | 'active' | 'partial' | 'awaiting_reward' | 'awaiting_route' | 'cleared'
export type ExpeditionResolution = 'too_short' | 'partial' | 'full'

export interface StartCue {
  type: CueType
  value: string
}

export interface MicroStep {
  id: string
  taskId: string
  text: string
  position: number
  status: StepStatus
}

export interface QuestTask {
  id: string
  title: string
  role: TaskRole
  kind: TaskKind
  progressDefinition: string
  starterAction: string | null
  obstacle: Obstacle
  deadline: string | null
  startCue: StartCue
  scheduledDate: string | null
  status: TaskStatus
  createdAt: string
  updatedAt: string
  steps: MicroStep[]
}

export interface FocusSession {
  beforeFocusCompleted?: boolean
  presentation?: import('./focusPresentation').FocusPresentation
  beforeFocus?: import('./focusPresentation').BeforeFocus | null
  id: string
  taskId: string
  stepId: string
  taskTitle?: string
  stepText?: string
  startedAt: string
  endedAt: string | null
  minimumMinutes: 5 | 10 | 15
  pausedSeconds: number
  suspendedAt: string | null
  manuallyPaused: boolean
  outcome: FocusOutcome | null
  blockedAttempts: number
  earnedLight: number
  runId: string | null
  nodeId: string | null
  plannedMinutes: 25 | 50 | 90 | null
  departure: AreaDepartureCue | null
}

export interface AreaDepartureCue {
  fromExpeditionNodeId: string
  fromAreaId: 'area-01-cloud-ruins'
  exit: 'exit_high' | 'exit_pines'
  route: string[]
  durationMs: 5000
}

export interface DailyRun {
  id: string
  localDay: string
  mainTaskId: string
  seed: number
  status: DailyRunStatus
  depth: number
  selectedNodeId: string | null
  startedAt: string
  endedAt: string | null
}

export interface ExpeditionNode {
  id: string
  /** Legacy routes default to Area 01; new authored scenes have a stable map identity. */
  areaId?: 'area-01-cloud-ruins' | 'area-02-moss-station' | 'area-03-reflection-lake' | 'area-07-glass-nursery'
  nurseryExitId?: import('./area07').NurseryExit | null
  lakeExitId?: import('./area03').LakeExit | null
  mossExitId?: import('./area02').MossExit | null
  runId: string
  parentNodeId: string | null
  departureExitId: 'exit_high' | 'exit_pines' | 'exit_bridge' | 'exit_steps' | null
  depth: number
  distance: ExpeditionDistance
  type: ExpeditionNodeType
  title: string
  description: string
  environmentHint: string
  plannedMinutes: 25 | 50 | 90
  state: ExpeditionNodeState
  progressSeconds: number
  eventKey: string | null
  rewardOptions: string[]
  selectedRelicKey: string | null
  createdAt: string
}

export interface RunRelic {
  id: string
  runId: string
  nodeId: string
  relicKey: string
  acquiredAt: string
}

export interface SpecialFindAcquisition {
  id: string
  runId: string
  nodeId: string
  sessionId: string
  lampIndex: number
  eventId: string
  itemKey: string
  title: string
  kind: 'relic' | 'token'
  acquiredAt: string
  specifiedByCore?: boolean
}

export interface ArchiveSpecialFindEntry {
  key: string
  eventId: string
  title: string
  kind: 'relic' | 'token'
  firstDiscoveredAt: string
  firstLocation: string
  acquiredCount: number
}

export interface ArchiveRelicEntry {
  key: string
  title: string
  description: string
  firstDiscoveredAt: string
  firstLocation: string
  firstTaskTitle: string
  acquiredCount: number
}

export interface ArchiveLocationEntry {
  key: string
  title: string
  firstVisitedAt: string
  visitCount: number
  focusSeconds: number
  relatedEvents: string[]
}

export interface ArchiveEventEntry {
  key: string
  title: string
  description: string
  firstDiscoveredAt: string
  firstLocation: string
  discoveredCount: number
}

export interface ArchiveLetterEntry {
  key: string
  title: string
  description: string
  firstDiscoveredAt: string
  firstLocation: string
}

export interface RestorationRequirement {
  key: string
  label: string
  met: boolean
}

export interface RestorationProject {
  key: string
  title: string
  description: string
  requirements: RestorationRequirement[]
  progress: number
  canComplete: boolean
  completedAt: string | null
}

export interface ArchiveState {
  relics: ArchiveRelicEntry[]
  specialFinds: ArchiveSpecialFindEntry[]
  locations: ArchiveLocationEntry[]
  events: ArchiveEventEntry[]
  letters: ArchiveLetterEntry[]
  restoration: RestorationProject
  litRegionCount: number
  activeFacilityCount: number
  recentDiscovery: string | null
}

export interface PendingDebrief {
  sessionId: string
  runId: string
  nodeId: string
  resolution: ExpeditionResolution
  effectiveSeconds: number
  progressSeconds: number
  thresholdSeconds: number
  outcome: FocusOutcome | null
  completeTask: boolean | null
  createdAt: string
}

export interface BlockRule {
  id: string
  processName: string
  displayName: string
  enabled: boolean
  createdAt: string
}

export interface RunningApplication {
  processName: string
  displayName: string
  path?: string
}

export interface RpgState {
  chapter: number
  node: number
  focusSeconds: number
  light: number
  starPages: number
  materials: number
  ability: RpgChoice | null
  lastLoot: string | null
}

export interface AppSettings {
  focusPresentation?: import('./focusPresentation').FocusPresentation
  audioMuted: boolean
  environmentVolume: number
  musicVolume: number
  reminderPolicy: ReminderPolicy
  eveningReminder: string
  miniTimer: boolean
  phoneRitual: boolean
  coatColor: 'navy' | 'ink' | 'violet'
  lanternColor: 'amber' | 'cyan' | 'cream'
}

export interface AnonymousEvent {
  id: string
  name: string
  createdAt: string
  numericPayload: Record<string, number | boolean>
}

export interface AppSnapshot {
  activityLog: {
    days: Array<{ day: string; seconds: number; completedTasks: number }>
    sessions: Array<{ id: string; title: string; startedAt: string; seconds: number; mapTitle: string | null; completed: boolean }>
    journeys: Array<{ id: string; startedAt: string; endedAt: string | null; maps: string[]; cores: string[] }>
    recentlyCompleted: Array<{ id: string; title: string; completedAt: string }>
  }
  nursery?: import('./area07').NurserySnapshot | null
  caretaker?: { saplingInLuggage:boolean; takeNodeId:string|null; transplantNodeId:string|null }
  lake?: import('./area03').LakeSnapshot | null
  mossStation?: import('./area02').MossSceneSnapshot | null
  mossDiscoveries: Array<{ id: string; title: string; text: string }>
  cloudDiscoveries?: Array<{ id: string; title: string; text: string }>
  lakeDiscoveries?: Array<{ id: string; title: string; text: string }>
  cloudStory?: {
    nodeId: string
    visit: number
    opening: boolean
    items: string[]
    whaleSeed: number
    records: string[]
    knownClues?: string[]
    scheduledEvents: Array<{ at: number; evs: string[]; forced?: boolean }>
    eventHistory: Array<{ id: string; at: number }>
  } | null
  seenFindIds: string[]
  mapVisits: Array<{ mapId: string; completed: number }>
  taskList: TaskListSnapshot
  /** Permanent map state, independent of today's run and Archive presentation. */
  mapCores: Array<{ mapId: string; itemKey: string; acquiredAt: string }>
  worldMarks: Array<{ mapId: string; mark: string; seenAt: string }>
  collection: CollectionRoomState
  tasks: QuestTask[]
  activeSession: FocusSession | null
  recentSessions: FocusSession[]
  blockRules: BlockRule[]
  rpg: RpgState
  settings: AppSettings
  todayRun: DailyRun | null
  expeditionNodes: ExpeditionNode[]
  runRelics: RunRelic[]
  specialFinds: SpecialFindAcquisition[]
  pendingDebrief: PendingDebrief | null
  archive: ArchiveState
}

export interface CreateTaskInput {
  title: string
  role: TaskRole
  kind: TaskKind
  progressDefinition: string
  starterAction: string | null
  obstacle: Obstacle
  deadline: string | null
  startCue: StartCue
}

export interface StartFocusInput {
  taskId: string
  stepId: string
  minimumMinutes: 5 | 10 | 15
  blockedProcessNames: string[]
  runId?: string
  nodeId?: string
  plannedMinutes?: 25 | 50 | 90
  /** Null means random. Only accepted for a new exploration whose map core is owned. */
  requestedJourneyItem?: string | null
}

export interface EndFocusInput {
  sessionId: string
  outcome: FocusOutcome
  completeTask: boolean
}

export interface FocusResult {
  session: FocusSession
  effectiveSeconds: number
  totalFocusSeconds: number
  worldStageAdvanced: boolean
  earnedLight: number
  earnedStarPage: boolean
  earnedMaterial: boolean
  loot: string | null
  storyAdvanced: boolean
  expeditionResolution: ExpeditionResolution | null
}

export interface BackupPayload {
  format: 'focusquest-backup'
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14
  exportedAt: string
  data: Record<string, unknown[]>
}

export interface OverlayState {
  processName: string
  displayName: string
  taskTitle: string
  stepText: string
}

export interface FocusQuestApi {
  beginBeforeFocusEvent: (sessionId: string, eventId: string) => Promise<AppSnapshot>
  finishBeforeFocus: (sessionId: string, skippedIds?: string[]) => Promise<AppSnapshot>
  getFocusRecap: (sessionId: string) => Promise<import('./focusPresentation').FocusRecap>
  listReplayEvents: (runId?: string) => Promise<import('./focusPresentation').FocusEventRecord[]>
  getReplayEvent: (recordId: string) => Promise<import('./focusPresentation').FocusEventRecord>


  pinCollectionClue: (clueId: string) => Promise<AppSnapshot>
  pinCollectionClues: (clueIds: string[]) => Promise<AppSnapshot>
  setTrackingClue: (placeId: string | null) => Promise<AppSnapshot>
  markCollectionCorePresented: (mapId: string) => Promise<AppSnapshot>
  markCollectionLinkagePlayed: () => Promise<AppSnapshot>
  inspectLobbyFind: (acquisitionId: string) => Promise<AppSnapshot>
  inspectCampfireTrace: (stage: number) => Promise<AppSnapshot>
  addListTask: (input: AddListTaskInput) => Promise<AppSnapshot>
  renameListTask: (taskId: string, title: string) => Promise<AppSnapshot>
  reorderTodayTasks: (localDay: string, taskIds: string[]) => Promise<AppSnapshot>
  moveTasksToToday: (taskIds: string[]) => Promise<AppSnapshot>
  setListTaskDone: (taskId: string, done: boolean) => Promise<AppSnapshot>
  deleteListTask: (taskId: string) => Promise<AppSnapshot>
  deleteYesterdayTasks: (input: DeleteYesterdayInput) => Promise<AppSnapshot>
  saveRoutines: (inputs: SaveRoutineInput[]) => Promise<AppSnapshot>
  startListFocus: (input: StartListFocusInput) => Promise<AppSnapshot>
  finishListFocus: (sessionId: string, completed: boolean) => Promise<AppSnapshot>
  recordWorldMark: (sessionId: string, mark: string) => Promise<AppSnapshot>
  recordCloudStoryClue: (sessionId: string, clueId: string) => Promise<AppSnapshot>
  getMossScene: (nodeId: string) => Promise<import('./area02').MossSceneSnapshot | null>
  getNurseryScene: (nodeId:string)=>Promise<import('./area07').NurserySnapshot|null>
  getNurseryDeparture: (sessionId:string)=>Promise<{fromExpeditionNodeId:string;exit:import('./area07').NurseryExit;durationMs:number}|null>
  chooseCaretaker: (nodeId:string,choice:'take'|'leave'|'transplant'|'wait')=>Promise<AppSnapshot>
  getLakeScene: (nodeId: string) => Promise<import('./area03').LakeSnapshot | null>
  getLakeDeparture: (sessionId: string) => Promise<ReturnType<typeof import('./area03').lakeDeparture> | null>
  getMossDeparture: (sessionId: string) => Promise<ReturnType<typeof import('./area02').mossDeparture> | null>
  getSnapshot: () => Promise<AppSnapshot>
  createTask: (input: CreateTaskInput) => Promise<AppSnapshot>
  setTaskRole: (taskId: string, role: TaskRole) => Promise<AppSnapshot>
  archiveTask: (taskId: string) => Promise<AppSnapshot>
  deleteTask: (taskId: string) => Promise<AppSnapshot>
  startDailyRun: (mainTaskId: string) => Promise<AppSnapshot>
  selectExpeditionNode: (runId: string, nodeId: string) => Promise<AppSnapshot>
  startFocus: (input: StartFocusInput) => Promise<AppSnapshot>
  pauseFocus: (sessionId: string) => Promise<AppSnapshot>
  resumeFocus: (sessionId: string) => Promise<AppSnapshot>
  beginSessionDebrief: (sessionId: string) => Promise<AppSnapshot>
  endFocus: (input: EndFocusInput) => Promise<FocusResult>
  chooseRunRelic: (runId: string, nodeId: string, relicKey: string) => Promise<AppSnapshot>
  chooseNextRoute: (runId: string, fromNodeId: string, nextNodeId: string) => Promise<AppSnapshot>
  completeRestoration: (projectKey: string) => Promise<AppSnapshot>
  dismissDebrief: (sessionId: string) => Promise<AppSnapshot>
  listRunningApplications: () => Promise<RunningApplication[]>
  saveBlockRules: (apps: RunningApplication[]) => Promise<AppSnapshot>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSnapshot>
  makeRpgChoice: (choice: RpgChoice) => Promise<AppSnapshot>
  exportBackup: () => Promise<{ canceled: boolean; path?: string }>
  importBackup: () => Promise<{ canceled: boolean; path?: string }>
  exportAnalytics: () => Promise<{ canceled: boolean; path?: string }>
  overlayReturn: () => Promise<void>
  overlayEmergency: (mode: 'ten_minutes' | 'end_session') => Promise<void>
  onSnapshotChanged: (callback: (snapshot: AppSnapshot) => void) => () => void
  onOverlayState: (callback: (state: OverlayState) => void) => () => void
}
