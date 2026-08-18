import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flipFaceToBed, flipMeshX, meshBBox, placeOnBed, stampPockets } from '../src/mesh'
import { readBinaryStl } from '../src/stl'
import { squarePoly } from '../src/shapes'
import { pointInPolygon } from '../src/offset'

function loadStl(name: string) {
  const buf = readFileSync(join(process.cwd(), 'cassette', name))
  const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return readBinaryStl(copy).triangles
}

describe('mesh transforms', () => {
  it('flips the top plate so the QR face sits on the bed', () => {
    const raw = loadStl('top-plate-qr.stl')
    const flipped = flipFaceToBed(raw, 2)
    const b = meshBBox(flipped)
    expect(b.minZ).toBeCloseTo(0, 3)
    expect(b.maxZ).toBeCloseTo(2.676, 2)
    expect(b.minX).toBeCloseTo(0, 2)
    expect(b.maxX).toBeCloseTo(100.11, 2)
    expect(b.minY).toBeCloseTo(0, 2)
    expect(b.maxY).toBeCloseTo(63.6, 2)
    const bed = flipped.filter(
      (t) => t.a[2] < 1e-3 && t.b[2] < 1e-3 && t.c[2] < 1e-3,
    )
    expect(bed.length).toBeGreaterThan(0)
  })

  it('mirrors a bottom shell so slider slots move to the other side', () => {
    const raw = loadStl('bottom-shell.stl')
    const flipped = flipMeshX(raw, 50.055)
    const b = meshBBox(flipped)
    expect(b.minX).toBeCloseTo(0, 2)
    expect(b.maxX).toBeCloseTo(100.11, 2)
    const slotZ = -3.925
    const origSlot = raw.filter((t) =>
      [t.a, t.b, t.c].some((v) => Math.abs(v[2] - slotZ) < 0.05),
    )
    const flipSlot = flipped.filter((t) =>
      [t.a, t.b, t.c].some((v) => Math.abs(v[2] - slotZ) < 0.05),
    )
    const origMaxX = Math.max(...origSlot.flatMap((t) => [t.a[0], t.b[0], t.c[0]]))
    const flipMinX = Math.min(...flipSlot.flatMap((t) => [t.a[0], t.b[0], t.c[0]]))
    expect(origMaxX).toBeLessThan(40)
    expect(flipMinX).toBeGreaterThan(60)
  })

  it('places a shifted part on the bed at the origin', () => {
    const raw = loadStl('top-plate-qr-flat.stl')
    const onBed = placeOnBed(raw)
    const b = meshBBox(onBed)
    expect(b.minX).toBeCloseTo(0, 5)
    expect(b.minY).toBeCloseTo(0, 5)
    expect(b.minZ).toBeCloseTo(0, 5)
    expect(b.maxX).toBeCloseTo(100.11, 2)
    expect(b.maxY).toBeCloseTo(63.6, 2)
  })
})

describe('stampPockets', () => {
  it('cuts a pocket in the source plate without rebuilding the outline', () => {
    const raw = loadStl('top-plate-qr.stl')
    const flipped = flipFaceToBed(raw, 2)
    const before = flipped.length
    const pocket = squarePoly(40, 25, 8)
    const out = stampPockets(flipped, [pocket], 0.6)
    const mid = { x: 44, y: 29 }
    const bed = out.filter((t) => t.a[2] < 1e-3 && t.b[2] < 1e-3 && t.c[2] < 1e-3)
    const hits = bed.some((t) =>
      pointInPolygon(mid, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(hits).toBe(false)
    const b = meshBBox(out)
    expect(b.maxX).toBeCloseTo(meshBBox(flipped).maxX, 3)
    expect(b.maxY).toBeCloseTo(meshBBox(flipped).maxY, 3)
    expect(out.length).toBeGreaterThan(before / 2)
    const ceiling = out.filter(
      (t) =>
        Math.abs(t.a[2] - 0.6) < 1e-3 &&
        Math.abs(t.b[2] - 0.6) < 1e-3 &&
        Math.abs(t.c[2] - 0.6) < 1e-3,
    )
    expect(ceiling.length).toBeGreaterThan(0)
  })
})
