import type { AppSnapshot } from '../../shared/types'

// Only the review -> lobby boundary needs a new scene. Focus -> review retains
// its live canvas instead. Never defer a database operation for presentation.
export function isReviewReturn(previous: AppSnapshot | null, next: AppSnapshot): boolean {
  return Boolean(previous?.pendingDebrief && !next.pendingDebrief && !next.activeSession)
}

export function canRetainFocus(previous: AppSnapshot | null, next: AppSnapshot): boolean {
  return Boolean(previous?.activeSession && next.pendingDebrief?.sessionId === previous.activeSession.id && !next.activeSession)
}
