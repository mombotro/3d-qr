import { difference, union, type Pair, type Polygon as ClipPolygon } from 'polygon-clipping'
import { capFaces, extrudeRing, ringWalls, type Triangle } from './extrude'
import type { Polygon } from './shapes'

export type BBox = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

const EPS = 1e-4

function faceNormal(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): [number, number, number] {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz) || 1
  return [nx / len, ny / len, nz / len]
}

function remap(
  tris: Triangle[],
  map: (p: [number, number, number]) => [number, number, number],
  reverse = false,
): Triangle[] {
  return tris.map((t) => {
    const a = map(t.a)
    const b = map(t.b)
    const c = map(t.c)
    return reverse
      ? { n: faceNormal(a, c, b), a, b: c, c: b }
      : { n: faceNormal(a, b, c), a, b, c }
  })
}

export function meshBBox(tris: Triangle[]): BBox {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const t of tris) {
    for (const v of [t.a, t.b, t.c]) {
      minX = Math.min(minX, v[0])
      maxX = Math.max(maxX, v[0])
      minY = Math.min(minY, v[1])
      maxY = Math.max(maxY, v[1])
      minZ = Math.min(minZ, v[2])
      maxZ = Math.max(maxZ, v[2])
    }
  }
  return { minX, maxX, minY, maxY, minZ, maxZ }
}

export function translateMesh(tris: Triangle[], dx: number, dy: number, dz: number): Triangle[] {
  if (dx === 0 && dy === 0 && dz === 0) return tris
  return remap(tris, (p) => [p[0] + dx, p[1] + dy, p[2] + dz])
}

export function placeOnBed(tris: Triangle[]): Triangle[] {
  const b = meshBBox(tris)
  return translateMesh(tris, -b.minX, -b.minY, -b.minZ)
}

/** Tiny pads at opposite plate corners so two STLs share one XY origin. */
export function originPins(widthMm: number, heightMm: number, heightZ = 0.05): Triangle[] {
  const s = 0.2
  const pin = (x: number, y: number) =>
    extrudeRing(
      [
        { x, y },
        { x: x + s, y },
        { x: x + s, y: y + s },
        { x, y: y + s },
      ],
      [],
      0,
      heightZ,
    )
  return [...pin(0, 0), ...pin(widthMm - s, heightMm - s)]
}

/** Mirror X around a center. */
export function flipMeshX(tris: Triangle[], centerX: number): Triangle[] {
  return remap(tris, (p) => [2 * centerX - p[0], p[1], p[2]], true)
}

/** Mirror Y around a center. */
export function flipMeshY(tris: Triangle[], centerY: number): Triangle[] {
  return remap(tris, (p) => [p[0], 2 * centerY - p[1], p[2]], true)
}

/** Put the plane z = faceZ onto the bed (z = 0), reversing Z. */
export function flipFaceToBed(tris: Triangle[], faceZ: number): Triangle[] {
  return remap(tris, (p) => [p[0], p[1], faceZ - p[2]], true)
}

function isQrFace(t: Triangle, z0 = 0): boolean {
  return (
    Math.abs(t.a[2] - z0) < 0.05 &&
    Math.abs(t.b[2] - z0) < 0.05 &&
    Math.abs(t.c[2] - z0) < 0.05
  )
}

function toClip(poly: Polygon): ClipPolygon {
  const ring: Pair[] = poly.map((p) => [p.x, p.y])
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]])
  }
  return [ring]
}

function fromClip(ring: number[][]): Polygon {
  const pts: Polygon = ring.map(([x, y]) => ({ x, y }))
  const a = pts[0]
  const b = pts[pts.length - 1]
  if (a && b && a.x === b.x && a.y === b.y) pts.pop()
  return pts
}

/**
 * Keep the source mesh. Cut module pockets into the QR face only.
 * Does not rebuild the plate from a 2D outline.
 */
export function stampPockets(tris: Triangle[], pockets: Polygon[], depth: number): Triangle[] {
  if (depth <= EPS || pockets.length === 0) return tris
  const face: Triangle[] = []
  const rest: Triangle[] = []
  for (const t of tris) {
    if (isQrFace(t)) face.push(t)
    else rest.push(t)
  }
  const pocketGeoms = pockets.filter((p) => p.length >= 3).map(toClip)
  if (pocketGeoms.length === 0) return tris
  const cutter =
    pocketGeoms.length === 1 ? pocketGeoms[0] : union(pocketGeoms[0], ...pocketGeoms.slice(1))
  const keptFace: Triangle[] = []
  for (const t of face) {
    const tri: ClipPolygon = [
      [
        [t.a[0], t.a[1]],
        [t.b[0], t.b[1]],
        [t.c[0], t.c[1]],
        [t.a[0], t.a[1]],
      ],
    ]
    const leftover = difference(tri, cutter)
    for (const poly of leftover) {
      if (!poly[0] || poly[0].length < 3) continue
      keptFace.push(
        ...capFaces(
          fromClip(poly[0]),
          poly.slice(1).map(fromClip),
          0,
          false,
        ),
      )
    }
  }
  const walls = pockets.flatMap((p) => ringWalls(p, 0, depth, false))
  const ceilings = pockets.flatMap((p) => capFaces(p, [], depth, false))
  return [...rest, ...keptFace, ...walls, ...ceilings]
}
