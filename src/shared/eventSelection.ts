/** Common exploration-event policy; callers first filter weather, time and lamp budget. */
export function eventCooldownWeight(now: number, lastCompletedAt: number | undefined): number {
  if (lastCompletedAt === undefined) return 1
  const ago = now - lastCompletedAt
  return ago < 900 ? 0.08 : ago < 1800 ? 0.45 : 1
}

export function nearbyEventWeight(weight: number, walkingDistance: number, now: number, lastCompletedAt?: number): number {
  return weight / (1 + walkingDistance / 5) * eventCooldownWeight(now, lastCompletedAt)
}

export function avoidRecentEventSpots<T extends { spot: string }>(eligible: readonly T[], current: string, previous: string | null): T[] {
  const distinct = eligible.filter(event => event.spot !== current && event.spot !== previous)
  // Only relax the location rule. Never reintroduce ineligible or over-budget events.
  return distinct.length ? distinct : [...eligible]
}
