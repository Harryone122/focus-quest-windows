import type { FocusSession } from './types'

/** One time source for the timer, lamps, daylight and departure recovery. */
export function focusElapsedMs(
  session: Pick<FocusSession, 'startedAt' | 'endedAt' | 'pausedSeconds' | 'suspendedAt'>,
  now = Date.now()
): number {
  const end = session.endedAt ?? session.suspendedAt
  return Math.max(0, Math.round((end ? Date.parse(end) : now) - Date.parse(session.startedAt) - session.pausedSeconds * 1000))
}

export function focusElapsedSeconds(session: Parameters<typeof focusElapsedMs>[0], now = Date.now()): number {
  return Math.floor(focusElapsedMs(session, now) / 1000)
}
