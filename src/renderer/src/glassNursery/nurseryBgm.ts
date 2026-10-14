export type NurseryMusicPeriod = 'day' | 'night' | 'dusk'
/** Quiet intervals separate seven-second swells of the existing leaf recording. */
export function nurseryLeafEnvelope(seconds: number): number {
 const cycle = 18, phase = ((seconds % cycle) + cycle) % cycle
 if (phase >= 7) return 0
 return Math.sin(Math.PI * phase / 7) ** 2 * .65
}
/** AudioContext time freezes on pause; the player overlaps consecutive cuts. */
export class NurseryBgmSchedule {
 nextAt: number
 last = ''
 core = false
 shortGaps = false
 constructor(now: number, private random = Math.random) { this.nextAt = now }
 gap(_period: NurseryMusicPeriod) { return 0 }
 pick(now: number, period: NurseryMusicPeriod): string | null {
  if (now < this.nextAt) return null
  const pool = period === 'night' ? ['bgm_c'] : ['bgm_a','bgm_b','bgm_ab'].filter(n=>n!==this.last)
  const name=pool[Math.floor(this.random()*pool.length)];this.last=name;return name
 }
 ended(now: number, _period: NurseryMusicPeriod) { this.nextAt = now }
 setCore(value: boolean, _now: number) { this.core=value }
}
