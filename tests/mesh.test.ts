import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  alignExportOrigin,
  flipFaceToBed,
  flipMeshX,
  meshBBox,
  placeOnBed,
  repairMesh,
  stampPockets,
} from '../src/mesh'
import { extrudeRing } from '../src/extrude'
import { readBinaryStl } from '../src/stl'
import { rectPoly, squarePoly } from '../src/shapes'
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

describe('repairMesh', () => {
  it('caps a box that is missing its top and bottom', () => {
    const walls = extrudeRing(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      [],
      0,
      2,
    ).filter((t) => {
      const zs = [t.a[2], t.b[2], t.c[2]]
      return Math.min(...zs) < 0.5 && Math.max(...zs) > 1.5
    })
    const fixed = repairMesh(walls, 1e-4, Infinity)
    const counts = new Map<string, number>()
    const key = (p: number[], q: number[]) => {
      const a = p.map((n) => n.toFixed(4)).join(',')
      const b = q.map((n) => n.toFixed(4)).join(',')
      return a < b ? `${a}|${b}` : `${b}|${a}`
    }
    for (const t of fixed) {
      for (const [p, q] of [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ]) {
        const k = key(p, q)
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    const open = [...counts.values()].filter((n) => n !== 2).length
    expect(fixed.length).toBeGreaterThan(walls.length)
    expect(open).toBe(0)
  })
})

describe('alignExportOrigin', () => {
  it('shifts both meshes to the white min corner without extra pads', () => {
    const plate = extrudeRing(
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 50 },
        { x: 0, y: 50 },
      ],
      [],
      0,
      2,
    )
    const qr = extrudeRing(
      [
        { x: 20, y: 15 },
        { x: 40, y: 15 },
        { x: 40, y: 35 },
        { x: 20, y: 35 },
      ],
      [],
      0,
      0.6,
    )
    const aligned = alignExportOrigin(
      qr.map((t) => ({
        ...t,
        a: [t.a[0] + 3, t.a[1] + 2, t.a[2]] as [number, number, number],
        b: [t.b[0] + 3, t.b[1] + 2, t.b[2]] as [number, number, number],
        c: [t.c[0] + 3, t.c[1] + 2, t.c[2]] as [number, number, number],
      })),
      plate.map((t) => ({
        ...t,
        a: [t.a[0] + 3, t.a[1] + 2, t.a[2]] as [number, number, number],
        b: [t.b[0] + 3, t.b[1] + 2, t.b[2]] as [number, number, number],
        c: [t.c[0] + 3, t.c[1] + 2, t.c[2]] as [number, number, number],
      })),
    )
    const w = meshBBox(aligned.white)
    const b = meshBBox(aligned.black)
    expect(w.minX).toBeCloseTo(0)
    expect(w.minY).toBeCloseTo(0)
    expect(w.maxX).toBeCloseTo(80)
    expect(w.maxY).toBeCloseTo(50)
    expect(b.minX).toBeCloseTo(20)
    expect(b.minY).toBeCloseTo(15)
    expect(b.maxX).toBeCloseTo(40)
  })
})

describe('stampPockets', () => {
  it('cuts a pocket in the source plate without stacking a second body', () => {
    const raw = loadStl('top-plate-qr.stl')
    const flipped = flipFaceToBed(raw, 2)
    const outline = rectPoly(0, 0, 100.11, 63.6)
    const pocket = squarePoly(40, 25, 8)
    const out = stampPockets(flipped, outline, [], [pocket], 0.6)
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
    expect(b.maxX).toBeCloseTo(meshBBox(flipped).maxX, 2)
    expect(b.maxY).toBeCloseTo(meshBBox(flipped).maxY, 2)
    expect(out.length).toBeGreaterThan(100)
    const ceiling = out.filter(
      (t) =>
        Math.abs(t.a[2] - 0.6) < 1e-3 &&
        Math.abs(t.b[2] - 0.6) < 1e-3 &&
        Math.abs(t.c[2] - 0.6) < 1e-3,
    )
    expect(ceiling.length).toBeGreaterThan(0)
  })
})
