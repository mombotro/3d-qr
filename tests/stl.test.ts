import { describe, expect, it } from 'vitest'
import { extrudeRing } from '../src/extrude'
import { squarePoly } from '../src/shapes'
import { readBinaryStl, writeBinaryStl } from '../src/stl'

describe('writeBinaryStl', () => {
  it('writes a valid header and triangle count', () => {
    const tris = extrudeRing(squarePoly(0, 0, 10), [], 0, 1)
    const buf = writeBinaryStl(tris)
    const parsed = readBinaryStl(buf)
    expect(parsed.triangleCount).toBe(tris.length)
    expect(parsed.triangles.length).toBe(tris.length)
    expect(buf.byteLength).toBe(84 + 50 * tris.length)
  })
})
