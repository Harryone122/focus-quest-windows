export const DAY_NIGHT_CYCLE_SECONDS = 10 * 60

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'

const TIME_OF_DAY: readonly TimeOfDay[] = ['dawn', 'day', 'dusk', 'night']

export interface TimeOfDayState {
  phase: number
  from: TimeOfDay
  to: TimeOfDay
  blend: number
}

export function timeOfDayAt(effectiveSeconds: number): TimeOfDayState {
  const seconds = Number.isFinite(effectiveSeconds) ? Math.max(0, effectiveSeconds) : 0
  const phase = (seconds % DAY_NIGHT_CYCLE_SECONDS) / DAY_NIGHT_CYCLE_SECONDS
  const position = phase * TIME_OF_DAY.length
  const index = Math.min(TIME_OF_DAY.length - 1, Math.floor(position))
  const fraction = position - index
  const blend = fraction * fraction * fraction * (fraction * (fraction * 6 - 15) + 10)
  return {
    phase,
    from: TIME_OF_DAY[index],
    to: TIME_OF_DAY[(index + 1) % TIME_OF_DAY.length],
    blend
  }
}
