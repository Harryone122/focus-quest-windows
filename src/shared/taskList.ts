import type { StartFocusInput } from './types'

/** Role-free contract. Dates are local YYYY-MM-DD, weekdays use JS's 0=Sunday. */
export interface ListTask {
  id: string
  title: string
  scheduledDate: string | null
  /** ISO timestamp when an item was placed in the backlog; null for dated items. */
  parkedAt: string | null
  position: number
  completed: boolean
  routineId: string | null
  stepId: string | null
}

export interface RoutineDefinition {
  id: string
  title: string
  weekdays: number[]
  enabled: boolean
  position: number
}

export interface TaskListSnapshot {
  localDay: string
  today: ListTask[]
  /** All unresolved older one-off items; keep their original scheduledDate. */
  yesterday: ListTask[]
  backlog: ListTask[]
  routines: RoutineDefinition[]
  nextTaskId: string | null
}

export interface AddListTaskInput {
  title: string
  placement?: 'today' | 'backlog'
}

export interface SaveRoutineInput {
  id?: string
  title: string
  weekdays: number[]
  enabled: boolean
}

export const DELETE_YESTERDAY_CONFIRMATION = '刪除昨天全部未完成事項'

export interface DeleteYesterdayInput {
  localDay: string
  /** Exactly the IDs shown in the confirmation; stale lists must be reconfirmed. */
  taskIds: string[]
  confirmation: string
}

export type StartListFocusInput = Omit<StartFocusInput, 'taskId' | 'stepId'> & { taskId?: string }
