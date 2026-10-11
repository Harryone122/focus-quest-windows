/** Presentation only: all progress is supplied by the saved event action's clock. */
export type Point3 = [number, number, number]
export type CameraAnchor = Point3 | 'home' | 'traveller' | 'lantern'
export interface CameraKey { p: number; at: CameraAnchor; z: number; el?: number; az?: number }
export interface CameraEvent { id: string; camera?: { keys: CameraKey[] } }
export interface Shot { t: Point3; z: number; el: number; az: number }
export interface Anchors {
  home: Point3
  traveller: Point3
  world: (u: number, v: number, y: number) => Point3
  lantern: (eventId: string, p: number) => Point3
}
export const smoothstep = (x: number): number => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x) }
export function keyIndex(keys: CameraKey[], p: number): number {
  let i = 0
  while (i < keys.length - 1 && p >= keys[i + 1].p) i++
  return i
}
export function dirShot(eventId: string | null, p: number, anchors: Anchors, events: CameraEvent[]): Shot {
  const home = (): Shot => ({ t: [...anchors.home], z: 1, el: 0, az: 0 })
  const keys = events.find(e => e.id === eventId)?.camera?.keys
  if (!keys?.length || p >= 1) return home()
  p = Math.max(keys[0].p, Math.min(1, p))
  const i = keyIndex(keys, p), a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)]
  const w = a === b ? 0 : smoothstep((p - a.p) / (b.p - a.p))
  const resolve = (at: CameraAnchor): Point3 => Array.isArray(at) ? anchors.world(...at)
    : at === 'home' ? anchors.home : at === 'traveller' ? anchors.traveller : anchors.lantern(eventId!, p)
  const av = resolve(a.at), bv = resolve(b.at)
  return {
    t: av.map((v, n) => v + (bv[n] - v) * w) as Point3,
    z: Math.max(1, Math.min(12, Math.exp(Math.log(a.z) * (1 - w) + Math.log(b.z) * w))),
    el: (a.el ?? 0) * (1 - w) + (b.el ?? 0) * w,
    az: (a.az ?? 0) * (1 - w) + (b.az ?? 0) * w
  }
}
/** Exact critically damped spring; time constant 0.55 seconds, no Euler instability. */
export function spring(value: number, velocity: number, goal: number, dt: number): [number, number] {
  const omega = 1 / 0.55, delta = value - goal, c = velocity + omega * delta, e = Math.exp(-omega * Math.max(0, dt))
  return [goal + (delta + c * dt) * e, (velocity - omega * c * dt) * e]
}
