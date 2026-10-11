export const CAMPFIRE_DEPARTURE_SECONDS = 8
// Real seconds -> existing authored pose time. Only preparation is extended.
export const campfirePoseTimes = [[0, 0], [0.4, 0.08], [0.9, 0.3], [1.65, 0.65], [1.95, 0.8], [2.3, 0.95], [3, 1.25], [3.35, 1.45], [4.05, 1.55], [4.65, 1.78], [5.05, 2.05], [5.4, 2.4], [5.45, 2.45], [5.75, 2.75], [8, 5]]
export function campfirePoseTime(seconds: number): number {
  const time = Math.max(0, Math.min(CAMPFIRE_DEPARTURE_SECONDS, seconds))
  for (let i = 1; i < campfirePoseTimes.length; i++) {
    const [end, poseEnd] = campfirePoseTimes[i], [start, poseStart] = campfirePoseTimes[i - 1]
    if (time <= end) return poseStart + (poseEnd - poseStart) * (time - start) / (end - start)
  }
  return 5
}
