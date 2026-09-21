export function calculateLight(effectiveSeconds: number, minimumMinutes: number, alreadyEarnedToday: number): number {
  const minimumSeconds = minimumMinutes * 60
  if (effectiveSeconds < minimumSeconds) return 0
  const raw = Math.min(3, 1 + Math.floor((effectiveSeconds - minimumSeconds) / 900))
  return Math.max(0, Math.min(raw, 6 - alreadyEarnedToday))
}

export function effectiveSeconds(startedAt: string, endedAt: string, pausedSeconds: number): number {
  const elapsed = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  return Math.max(0, elapsed - pausedSeconds)
}
