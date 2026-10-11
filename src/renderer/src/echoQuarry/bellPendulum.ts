export interface BellPendulum {
  th: number
  v: number
  queue: number
  cool: number
  pullSeconds?: number
}

/** Pull with a force, then release. Never replace the current angle to start a stroke. */
export function advanceBellPendulum(s: BellPendulum, dt: number, drop: number, hit: number, strike: (strength: number) => void): void {
  if (dt <= 0) return
  const steps = Math.ceil(dt * 120), h = dt / steps
  for (let i = 0; i < steps; i++) {
    s.cool -= h
    if (!s.pullSeconds && s.queue > 0 && s.cool <= 0 && Math.abs(s.th) < .05 && Math.abs(s.v) < .3) {
      s.queue--; s.cool = 2.6; s.pullSeconds = .65
    }
    const pulling = (s.pullSeconds ?? 0) > 0
    const acceleration = pulling ? 40 * (.5 - s.th) - 10 * s.v : -9.81 / drop * Math.sin(s.th) - .35 * s.v
    s.v += acceleration * h
    s.th += s.v * h
    s.pullSeconds = Math.max(0, (s.pullSeconds ?? 0) - h)
    if (s.th <= -hit && s.v < 0) {
      const k = Math.min(1, Math.abs(s.v) / 1.4)
      s.th = -hit; s.v *= -.35
      if (k > .2) strike(.55 + .45 * k)
    }
  }
}
