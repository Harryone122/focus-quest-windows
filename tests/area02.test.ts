import { describe, expect, it } from 'vitest'
import scene from '../docs/area-02-moss-station.scene.json'
import { advanceMossRuntime, createMossRuntime, emptyMossMarks, mossDeparture, mossEvents, mossEventAllowed, mossRoute, mossRouteSeconds, mossSceneSnapshot } from '../src/shared/area02'
import { rainWindowsUntil, weatherAt } from '../src/shared/weather'
import { AREA02_SPECIAL_FINDS } from '../src/shared/specialFinds'

describe('moss authoritative traveller', () => {
  it('uses three canonical items, two exits, the safe spawn and dry/rain paths', () => {
    expect(AREA02_SPECIAL_FINDS.map(find => find.itemKey)).toEqual(['old_luggage_tag', 'charcoal_rubbing', 'cracked_compass'])
    expect(createMossRuntime('node').node).toBe('w_gate')
    expect(mossRoute('f_stones_n', 'f_stones_s')).toEqual(['f_stones_n', 'f_stones_s'])
    const wet = mossRoute('f_stones_n', 'f_stones_s', true)
    expect(wet).toContain('f_log_n')
    expect(wet).toContain('f_log_s')
    for (const node of scene.nodes) expect(mossRoute('w_gate', node.id, true).at(-1)).toBe(node.id)
    for (const exit of ['exit_boat', 'exit_tunnel'] as const) {
      expect(mossDeparture('node', exit, true)).toMatchObject({ exit, durationMs: 5000 })
      expect(mossDeparture('node', exit).route.at(-1)).toBe(exit)
    }
    expect(() => mossRoute('missing', 'p_bench')).toThrow()
  })
  it('filters shelter, after-rain events, once-only events and umbrella access', () => {
    const state = createMossRuntime('node')
    const byId = (id: string) => mossEvents.find(event => event.id === id)!
    expect(mossEventAllowed(byId('ev_wagon_shelter'), 'rain', state)).toBe(true)
    expect(mossEventAllowed(byId('ev_brook_high'), 'rain', state)).toBe(false)
    state.umbrella = 'borrowed'
    expect(mossEventAllowed(byId('ev_brook_high'), 'rain', state)).toBe(true)
    expect(mossEventAllowed(byId('ev_umbrella_return'), 'dry', state)).toBe(true)
    expect(mossEventAllowed(byId('ev_boulder_snail'), 'dry', state)).toBe(false)
    expect(mossEventAllowed(byId('ev_boulder_snail'), 'afterRain', state)).toBe(true)
    state.usedEvents.push('ev_signal_pull')
    expect(mossEventAllowed(byId('ev_signal_pull'), 'dry', state)).toBe(false)
  })
  it('replays identically after serialization; visits all lamps and rests without extra rewards', () => {
    const initial = createMossRuntime('full-visit'), marks = emptyMossMarks()
    const direct = advanceMossRuntime(initial, 4200, marks, [])
    let split = { state: initial, marks }
    for (let t = 1; t <= 4200; t += 7) split = advanceMossRuntime(JSON.parse(JSON.stringify(split.state)), t, split.marks, [])
    split = advanceMossRuntime(split.state, 4200, split.marks, [])
    expect(split).toEqual(direct)
    expect(direct.state.visitedLamps).toEqual([1, 2, 3, 4, 5])
    expect(direct.marks.bench_tea_seen).toBe(true)
    expect(mossSceneSnapshot('node', direct.state, direct.marks, false).litLampCount).toBe(5)
    expect(direct.state.notes.map(note => note.eventId).length).toBe(new Set(direct.state.notes.map(note => note.eventId)).size)
    expect(advanceMossRuntime(direct.state, 4200, direct.marks, [])).toEqual(direct)
  })
  it('locks the rubbing variant when leaving, regardless of subsequent weather', () => {
    const state = createMossRuntime('variant')
    state.weatherSeed = Array.from({ length: 1000 }, (_, seed) => seed).find(seed => weatherAt(seed, 650).phase === 'rain')!
    state.seconds = 650; state.visitedLamps = [1]
    const finds = [{ id: 'rubbing', eventId: 'rare_tablet_rubbing', lampIndex: 1 }]
    const started = advanceMossRuntime(state, 650, emptyMossMarks(), finds)
    expect(started.state.intent?.eventId).toBe('rare_ledger_rubbing')
    expect(started.state.intent?.node).toBe('p_window')
    const end = advanceMossRuntime(started.state, 1200, started.marks, finds)
    expect(end.state.handledFinds).toEqual(['rubbing'])
    expect(end.state.notes.some(note => note.eventId === 'rare_ledger_rubbing')).toBe(true)
  })
  it('borrows before a rainy lamp and returns the umbrella, leaving a permanent towel', () => {
    const state = createMossRuntime('umbrella')
    state.weatherSeed = Array.from({ length: 1000 }, (_, seed) => seed).find(seed => rainWindowsUntil(seed, 600).some(w => w.start === 360))!
    state.seconds = 400; state.node = 'p_door'
    const borrowed = advanceMossRuntime(state, 430, emptyMossMarks(), [])
    expect(borrowed.state.umbrella).toBe('borrowed')
    const returned = advanceMossRuntime(borrowed.state, 950, borrowed.marks, [])
    expect(returned.state.umbrella).toBe('none')
    expect(returned.marks.towelLeft).toBe(true)
  })
  it('gives the renderer a continuous full walk with exact per-edge absolute deadlines', () => {
    const state = createMossRuntime('full-path')
    state.intent = { kind: 'lamp', node: 'l_lamp4', duration: 2, lamp: 4 }
    const first = advanceMossRuntime(state, 0, emptyMossMarks(), [])
    const action = first.state.action!, plan = action.plan!
    expect(plan.path.length).toBeGreaterThan(3)
    expect(plan.destination).toBe('l_lamp4')
    expect(plan.path[0]).toBe('w_gate')
    expect(plan.path.at(-1)).toBe('l_lamp4')
    let seconds = action.startSeconds
    plan.path.slice(1).forEach((id, i) => {
      const edge = scene.edges.find(edge => (edge.a === plan.path[i] && edge.b === id) || (edge.b === plan.path[i] && edge.a === id))!
      seconds += Math.ceil(edge.length / 0.35)
      expect(plan.legEndSeconds[i]).toBe(seconds)
    })
    const next = advanceMossRuntime(first.state, action.endSeconds, first.marks, [])
    expect(next.state.action!.plan!.path).toEqual(plan.path.slice(1))
    expect(next.state.action!.plan!.legEndSeconds).toEqual(plan.legEndSeconds.slice(1))
  })
  it('replans future legs when rain begins without changing the current edge or its deadline', () => {
    const state = createMossRuntime('weather-plan')
    state.weatherSeed = Array.from({ length: 1000 }, (_, seed) => seed).find(seed => weatherAt(seed, 210).phase === 'rain')!
    let onset = 180
    while (weatherAt(state.weatherSeed, onset).phase !== 'rain') onset++
    state.seconds = onset - 1; state.node = 'f_boulder'
    state.intent = { kind: 'special', node: 'f_stones_s', eventId: 'rare_cart_tag', duration: 70 }
    const before = advanceMossRuntime(state, onset - 1, emptyMossMarks(), [])
    expect(before.state.action!.plan!.path).toEqual(['f_boulder', 'f_stones_n', 'f_stones_s'])
    const after = advanceMossRuntime(before.state, onset, before.marks, [])
    expect(after.state.action!.id).toBe(before.state.action!.id)
    expect(after.state.action!.endSeconds).toBe(before.state.action!.endSeconds)
    expect(after.state.node).toBe('f_boulder')
    expect(after.state.action!.plan!.path.slice(0, 2)).toEqual(['f_boulder', 'f_stones_n'])
    expect(after.state.action!.plan!.path).toContain('f_log_s')
    expect(after.state.action!.plan!.destination).toBe('f_stones_s')
  })
  it('projects a missing plan from an older paused save without mutating the save', () => {
    const state = createMossRuntime('old-path')
    state.intent = { kind: 'lamp', node: 'p_lamp2', duration: 2, lamp: 2 }
    const started = advanceMossRuntime(state, 0, emptyMossMarks(), [])
    delete started.state.action!.plan
    const projected = mossSceneSnapshot('old-path', started.state, started.marks, false)
    expect(projected.action!.plan!.destination).toBe('p_lamp2')
    expect(started.state.action!.plan).toBeUndefined()
  })
  it('preserves cooldown history across JSON recovery and excludes the previous event place', () => {
    const state = createMossRuntime('history')
    state.seconds = 100; state.node = 'f_boulder'
    state.intent = { kind: 'event', node: 'f_boulder', eventId: 'ev_boulder_stack', duration: 30 }
    state.action = { id: 1, kind: 'event', node: 'f_boulder', route: ['f_boulder'], eventId: 'ev_boulder_stack', startSeconds: 70, endSeconds: 100 }
    const done = advanceMossRuntime(state, 100, emptyMossMarks(), [])
    expect(done.state.eventCompletedAt!.ev_boulder_stack).toBe(100)
    expect(done.state.lastEventSpot).toBe('f_boulder')
    expect(done.state.intent?.node).not.toBe('f_boulder')
    const restored = JSON.parse(JSON.stringify(done.state))
    expect(advanceMossRuntime(restored, 850, done.marks, [])).toEqual(advanceMossRuntime(done.state, 850, done.marks, []))
  })
  it('cached dry/wet routes remain shortest and callers cannot mutate cached paths', () => {
    const ids = scene.nodes.map(node => node.id), n = ids.length
    for (const rain of [false, true]) {
      const distance = ids.map((_, i) => ids.map((_, j) => i === j ? 0 : Infinity))
      for (const edge of scene.edges) if (!rain || !edge.closedInRain) {
        const a = ids.indexOf(edge.a), b = ids.indexOf(edge.b)
        distance[a][b] = distance[b][a] = edge.length
      }
      for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) distance[i][j] = Math.min(distance[i][j], distance[i][k] + distance[k][j])
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) expect(mossRouteSeconds(ids[i], ids[j], rain) * 0.35).toBeCloseTo(distance[i][j], 8)
    }
    mossRoute('w_gate', 'p_bench').splice(0)
    expect(mossRoute('w_gate', 'p_bench')[0]).toBe('w_gate')
  })
  it('arrives at all 300 lamp deadlines over 60 seeded rainy explorations with finds', () => {
    for (let seed = 0; seed < 60; seed++) {
      let current = { state: createMossRuntime(`policy-simulation-${seed}`), marks: emptyMossMarks() }
      const finds = [{ id: 'journey', eventId: seed % 2 ? 'rare_cart_tag' : 'rare_tablet_rubbing', lampIndex: seed % 5 + 1 },
        { id: 'core', eventId: 'rare_drawer_compass', lampIndex: (seed + 2) % 5 + 1 }]
      for (let seconds = 0; seconds <= 3000; seconds++) {
        current = advanceMossRuntime(current.state, seconds, current.marks, finds)
        if (seconds > 0 && seconds % 600 === 0) {
          expect(current.state.node, `seed ${seed}, lamp ${seconds / 600}`).toBe(scene.lamps[seconds / 600 - 1].node)
          expect(mossSceneSnapshot('node', current.state, current.marks, false).litLampCount).toBe(seconds / 600)
        }
      }
    }
  }, 30000)
})
