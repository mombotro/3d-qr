import { describe, expect, it } from 'vitest'
import { extrudeRing } from '../src/extrude'
import { squarePoly } from '../src/shapes'

describe('extrudeRing', () => {
  it('keeps all vertices between z0 and z1', () => {
    const tris = extrudeRing(squarePoly(0, 0, 10), [], 0, 1.2)
    expect(tris.length).toBeGreaterThan(0)
    for (const t of tris) {
      for (const v of [t.a, t.b, t.c]) {
        expect(v[2]).toBeGreaterThanOrEqual(0)
        expect(v[2]).toBeLessThanOrEqual(1.2)
      }
    }
  })
})
