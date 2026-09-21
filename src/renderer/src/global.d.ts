import type { FocusQuestApi } from '../../shared/types'

declare global {
  interface Window {
    focusQuest: FocusQuestApi
  }
}

export {}
