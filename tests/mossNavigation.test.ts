import { expect, it } from 'vitest'
import area from '../docs/area-02-moss-station.scene.json'
// Use the same curve interpolation as the production renderer.
// @ts-expect-error The vendored Three module is JavaScript.
import * as T from '../src/renderer/src/cloudRuins/vendor/three.module.js'

it('keeps the traveller outside the moss boulder along both directions and at event anchors', () => {
  const world = (u: number, v: number) => new T.Vector3((u - v) * Math.SQRT1_2, 0, (-u - v) * Math.SQRT1_2)
  const center = world(-4.6, -2.3)
  const nearby = area.edges.filter(edge => [edge.a, edge.b].some(id => ['f_boulder', 'f_tablet'].includes(id)))
  for (const edge of nearby) {
    const a = area.nodes.find(node => node.id === edge.a)!, b = area.nodes.find(node => node.id === edge.b)!
    const points = [world(a.u, a.v), ...(edge.via ?? []).map(point => world(point[0], point[1])), world(b.u, b.v)]
    for (const pts of [points, [...points].reverse()]) {
      const curve = pts.length === 2 ? new T.LineCurve3(...pts) : new T.CatmullRomCurve3(pts, false, 'centripetal')
      // The authored radius, scale, rotation, maximum noise expansion, plus the traveller's body radius.
      for (let i = 0; i <= 200; i++) {
        const local = curve.getPointAt(i / 200).sub(center).applyAxisAngle(new T.Vector3(0, 1, 0), -0.7)
        const clearance = Math.hypot(local.x / (1.7 * 1.45 * 1.16 + 0.23), local.z / (1.7 * 1.15 * 1.16 + 0.23))
        expect(clearance, `${edge.a} -> ${edge.b} at ${i}/200`).toBeGreaterThan(1)
      }
      expect(curve.getLength(), 'Backend travel allowance includes the curved detour').toBeLessThanOrEqual(edge.length)
    }
  }
})
