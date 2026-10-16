export type QuarryPeriod = 'dawn' | 'day' | 'dusk' | 'night'
export const QUARRY_AUDIO_DEFAULTS = { environmentVolume: 35, musicVolume: 25, windRockRate: 1.5 } as const
/** Each segment's four-second fade-out overlaps the next one's fade-in, so music never falls silent. */
export const QUARRY_BGM_CROSSFADE = 4

/** Continuous music (2026-10-16 user decision): back-to-back segments that only make way for the core motif.
 *  Deadlines use AudioContext time, which freezes on pause. No catch-up queue. */
export class QuarryBgmSchedule {
  nextAt: number
  lastOffset = -1
  constructor(now = 0, private readonly random = Math.random) { this.nextAt = now + 2 }
  pick(now: number, _period: QuarryPeriod, blocked: boolean, duration: number, phase = .01) {
    if (blocked || now < this.nextAt || duration < 64) return null
    const bar = 240 / 68, end = Math.min(147, duration)
    // Only starts that can supply at least a 60s segment before the source fade.
    const bars = Array.from({length: Math.floor((end - 60 - phase) / bar) + 1}, (_, i) => phase + i * bar)
      .filter(offset => Math.abs(offset - this.lastOffset) > .1)
    const offset = bars[Math.min(bars.length - 1, Math.floor(this.random() * bars.length))]
    const seconds = Math.min(60 + this.random() * 60, end - offset)
    this.lastOffset = offset
    this.nextAt = now + seconds - QUARRY_BGM_CROSSFADE
    return {offset, seconds}
  }
  /** The core melody plays alone; music fades back in right after it. */
  core(motifEnds: number) { this.nextAt = Math.max(this.nextAt, motifEnds + 2) }
  seek(now: number) { this.nextAt = now + 2 }
}
