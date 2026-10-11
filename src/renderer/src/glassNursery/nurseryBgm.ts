export type NurseryMusicPeriod = 'day' | 'night' | 'dusk'
/** Deadlines use the AudioContext clock, which freezes when the scene pauses. */
export class NurseryBgmSchedule {
 nextAt: number
 last = ''
 core = false
 shortGaps = false
 constructor(now: number, private random = Math.random) { this.nextAt = now + 20 + random() * 20 }
 gap(period: NurseryMusicPeriod) { return this.shortGaps ? 3 : period === 'night' ? 90 + this.random()*90 : 60 + this.random()*90 }
 pick(now: number, period: NurseryMusicPeriod): string | null {
  if (this.core || now < this.nextAt || period === 'dusk') return null
  const pool = period === 'night' ? ['bgm_c'] : ['bgm_a','bgm_b','bgm_ab'].filter(n=>n!==this.last)
  const name=pool[Math.floor(this.random()*pool.length)];this.last=name;return name
 }
 ended(now: number, period: NurseryMusicPeriod) { this.nextAt = Math.max(this.nextAt, now + this.gap(period)) }
 setCore(value: boolean, now: number) {
  if(this.core && !value) this.nextAt=Math.max(this.nextAt,now+36)
  this.core=value
 }
}
