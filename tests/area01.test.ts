import { describe, expect, it } from 'vitest'
import scene from '../docs/area-01-cloud-ruins.scene.json'
import { area01Departure, area01Route } from '../src/shared/area01'

describe('Area 01 departure contract', () => {
  it('keeps legacy performances ambient while retaining their world-memory effects', () => {
    const ids = ['ev_blossom_press', 'ev_stele_rubbing', 'ev_lake_boat', 'ev_chest_open',
      'ev_arch_gap', 'ev_sign_read', 'ev_astro_chart', 'ev_scope_look']
    for (const id of ids) {
      const event = scene.events.find(event => event.id === id)!
      expect(event.outcome).toBe('ambient')
      expect(event).not.toHaveProperty('once')
      expect(event).not.toHaveProperty('note')
      expect(event).not.toHaveProperty('tagGain')
    }
    expect(scene.events.find(event => event.id === 'ev_lake_boat')).toHaveProperty('effect', 'paperBoat')
    expect(scene.events.find(event => event.id === 'ev_chest_open')).toHaveProperty('effect', 'chestOpen')
  })
  it('uses the authored graph and ends at the selected exit', () => {
    const high = area01Departure('source-node', 'exit_high')
    const pines = area01Departure('source-node', 'exit_pines')
    expect(high.route[0]).toBe('b_tree')
    expect(high.route.at(-1)).toBe('c_exit')
    expect(pines.route.at(-1)).toBe('d_exit')
    expect(high.durationMs).toBe(5000)
    expect(pines.durationMs).toBe(5000)
    const edgeKeys = new Set(scene.edges.flatMap((edge) => [`${edge.a}:${edge.b}`, `${edge.b}:${edge.a}`]))
    for (const route of [high.route, pines.route]) {
      for (let index = 1; index < route.length; index += 1) {
        expect(edgeKeys.has(`${route[index - 1]}:${route[index]}`)).toBe(true)
      }
    }
  })

  it('rejects unavailable route nodes', () => {
    expect(() => area01Route('b_tree', 'missing')).toThrow(/路點不存在/)
  })
})
