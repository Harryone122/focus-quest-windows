import { createMossStationScene } from '../../repo/src/renderer/src/mossStation/mossStationScene.js'
import { advanceMossRuntime, createMossRuntime, emptyMossMarks, mossSceneSnapshot, mossDeparture, type MossRuntime, type MossWorldMarks, type MossFind } from '../../repo/src/shared/area02'

const host = document.getElementById('host')!
const params = new URLSearchParams(location.search)
const mode = (params.get('mode') || 'focus') as 'focus' | 'lobby'
let state: MossRuntime = createMossRuntime(params.get('node') || 'qa-node')
let marks: MossWorldMarks = emptyMossMarks()
let finds: MossFind[] = []
let core = false
let t = 0
const snap = () => mossSceneSnapshot('qa-node', state, marks, core)
const depExit = params.get('depart') as 'exit_boat' | 'exit_tunnel' | null
const leaving = depExit ? (() => { let s = createMossRuntime('old'); const m = emptyMossMarks(); const r = advanceMossRuntime(s, 3100, m, []); return mossSceneSnapshot('old', r.state, r.marks, false) })() : null
const scene = createMossStationScene(host, {
  mode, progressSeconds: 0, targetSeconds: 3000, moss: snap(), preserveDrawingBuffer: true, manualFrames: true,
  departure: depExit ? mossDeparture('old', depExit) : null, departureState: leaving, departureElapsedMs: 0,
  lobbyView: mode === 'lobby' ? { kind: 'close' } : null,
  reportActivity: (a) => { (window as any).__activity = a }
})
function advanceTo(target: number) {
  const r = advanceMossRuntime(state, target, marks, finds)
  state = r.state; marks = r.marks; t = target
  scene.setMossState(snap()); scene.setProgress(t)
}
;(window as any).__qa = {
  scene, advanceTo,
  setFinds(list: MossFind[]) { finds = list },
  setCore(v: boolean) { core = v },
  state: () => ({ t, action: state.action, umbrella: state.umbrella, marks, debug: scene.debugState(), activity: (window as any).__activity }),
  // play in "real time" at `rate` effective seconds per real second for `ms` milliseconds
  play(rate: number, ms: number) { return new Promise<void>((res) => { const t0 = performance.now(), s0 = t; const tick = () => { const e = performance.now() - t0; const target = Math.floor(s0 + e / 1000 * rate); if (target > t) advanceTo(target); if (e < ms) setTimeout(tick, 20); else res() }; tick() }) },
  wait(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
}
;(window as any).__ready = true
