/** Authoritative effective Focus time, shared by the HUD and the scene. */
export function litLampCount(progressSeconds: number, targetSeconds: number): number {
  return Math.max(0, Math.min(5, Math.floor(progressSeconds * 5 / Math.max(1, targetSeconds) + 1e-9)))
}

/** Reserve the return walk and preparation time before starting any optional activity. */
export function fitsBeforeLamp(secondsLeft: number, walkToEvent: number, eventSeconds: number, walkToLamp: number): boolean {
  return walkToEvent + eventSeconds + walkToLamp + 8 <= secondsLeft
}
