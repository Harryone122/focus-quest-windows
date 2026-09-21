export type TaskRole = 'main' | 'side' | 'backlog'
export type TaskKind = 'study' | 'report' | 'admin' | 'creative' | 'other'
export type Obstacle = 'unclear' | 'too_big' | 'boring' | 'perfection' | 'missing_info'
export type TaskStatus = 'active' | 'done' | 'archived'
export type StepStatus = 'pending' | 'done'
export type CueType = 'time' | 'event' | 'manual'
export type FocusOutcome = 'completed' | 'progress' | 'blocked'
export type ReminderPolicy = 'off' | 'gentle' | 'structured'
export type RpgChoice = 'restore' | 'illuminate' | 'catalogue'

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
  id: string
  taskId: string
  stepId: string
  taskTitle?: string
  stepText?: string
  startedAt: string
  endedAt: string | null
  minimumMinutes: 5 | 10 | 15
  pausedSeconds: number
  outcome: FocusOutcome | null
  blockedAttempts: number
  earnedLight: number
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
  light: number
  starPages: number
  materials: number
  ability: RpgChoice | null
  lastLoot: string | null
}

export interface AppSettings {
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
  tasks: QuestTask[]
  activeSession: FocusSession | null
  recentSessions: FocusSession[]
  blockRules: BlockRule[]
  rpg: RpgState
  settings: AppSettings
}

export interface CreateTaskInput {
  title: string
  role: TaskRole
  kind: TaskKind
  progressDefinition: string
  obstacle: Obstacle
  deadline: string | null
  startCue: StartCue
  steps: string[]
}

export interface StartFocusInput {
  taskId: string
  stepId: string
  minimumMinutes: 5 | 10 | 15
  blockedProcessNames: string[]
}

export interface EndFocusInput {
  sessionId: string
  outcome: FocusOutcome
}

export interface FocusResult {
  session: FocusSession
  earnedLight: number
  earnedStarPage: boolean
  earnedMaterial: boolean
  loot: string | null
  storyAdvanced: boolean
}

export interface BackupPayload {
  format: 'focusquest-backup'
  version: 1
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
  getSnapshot: () => Promise<AppSnapshot>
  createTask: (input: CreateTaskInput) => Promise<AppSnapshot>
  setTaskRole: (taskId: string, role: TaskRole) => Promise<AppSnapshot>
  archiveTask: (taskId: string) => Promise<AppSnapshot>
  startFocus: (input: StartFocusInput) => Promise<AppSnapshot>
  endFocus: (input: EndFocusInput) => Promise<FocusResult>
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
