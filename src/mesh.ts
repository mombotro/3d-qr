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

/** Tiny pads on the AABB edges so both files share one XY box. Off the bed face. */
export function originExtents(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  z0: number,
  z1: number,
): Triangle[] {
  const s = 0.8
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const pad = (x: number, y: number) =>
    extrudeRing(
      [
        { x, y },
        { x: x + s, y },
        { x: x + s, y: y + s },
        { x, y: y + s },
      ],
      [],
      z0,
      z1,
    )
  return [
    ...pad(minX, midY - s / 2),
    ...pad(maxX - s, midY - s / 2),
    ...pad(midX - s / 2, minY),
    ...pad(midX - s / 2, maxY - s),
  ]
}

function needsExtents(inner: BBox, outer: BBox): boolean {
  return (
    inner.minX > outer.minX + 0.05 ||
    inner.maxX < outer.maxX - 0.05 ||
    inner.minY > outer.minY + 0.05 ||
    inner.maxY < outer.maxY - 0.05
  )
}

/** Shift both meshes to the plate min corner and give them the same XY box. */
export function alignExportOrigin(
  black: Triangle[],
  white: Triangle[],
  repair = true,
): { black: Triangle[]; white: Triangle[] } {
  const box = meshBBox(white)
  let movedBlack = translateMesh(black, -box.minX, -box.minY, -box.minZ)
  let movedWhite = translateMesh(white, -box.minX, -box.minY, -box.minZ)
  const w = meshBBox(movedWhite)
  const b = meshBBox(movedBlack)
  const union: BBox = {
    minX: Math.min(b.minX, w.minX),
    maxX: Math.max(b.maxX, w.maxX),
    minY: Math.min(b.minY, w.minY),
    maxY: Math.max(b.maxY, w.maxY),
    minZ: Math.min(b.minZ, w.minZ),
    maxZ: Math.max(b.maxZ, w.maxZ),
  }
  if (needsExtents(b, union)) {
    const z1 = Math.max(b.maxZ, 0.2)
    const z0 = Math.max(0, z1 - 0.2)
    movedBlack = [...movedBlack, ...originExtents(union.minX, union.maxX, union.minY, union.maxY, z0, z1)]
  }
  if (needsExtents(w, union)) {
    const z1 = Math.max(w.maxZ, 0.2)
    const z0 = Math.max(0, z1 - 0.2)
    movedWhite = [...movedWhite, ...originExtents(union.minX, union.maxX, union.minY, union.maxY, z0, z1)]
  }
  if (!repair) return { black: movedBlack, white: movedWhite }
  return {
    black: repairMesh(movedBlack),
    white: repairMesh(movedWhite),
  }
}

function vertKey(p: [number, number, number], eps: number): string {
  const s = 1 / eps
  return `${Math.round(p[0] * s) / s},${Math.round(p[1] * s) / s},${Math.round(p[2] * s) / s}`
}

function snapVert(p: [number, number, number], eps: number): [number, number, number] {
  const s = 1 / eps
  return [
    Math.fround(Math.round(p[0] * s) / s),
    Math.fround(Math.round(p[1] * s) / s),
    Math.fround(Math.round(p[2] * s) / s),
  ]
}

function dist3(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function onSegment(
  p: [number, number, number],
  a: [number, number, number],
  b: [number, number, number],
  eps: number,
): boolean {
  const ab = dist3(a, b)
  if (ab < eps) return false
  const ap = dist3(a, p)
  const pb = dist3(p, b)
  if (ap < eps || pb < eps) return false
  return Math.abs(ap + pb - ab) < eps * 2
}

function uniqueVerts(tris: Triangle[], eps: number): [number, number, number][] {
  const seen = new Set<string>()
  const verts: [number, number, number][] = []
  for (const t of tris) {
    for (const p of [t.a, t.b, t.c]) {
      const k = vertKey(p, eps)
      if (seen.has(k)) continue
      seen.add(k)
      verts.push(p)
    }
  }
  return verts
}

function splitTJunctions(tris: Triangle[], eps: number): Triangle[] {
  let out = tris
  for (let pass = 0; pass < 8; pass++) {
    const counts = new Map<string, number>()
    const keyOf = (p: [number, number, number], q: [number, number, number]) => {
      const ka = vertKey(p, eps)
      const kb = vertKey(q, eps)
      return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
    }
    for (const t of out) {
      for (const [p, q] of [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ] as [typeof t.a, typeof t.a][]) {
        const k = keyOf(p, q)
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    const verts = uniqueVerts(out, eps)
    const next: Triangle[] = []
    let split = false
    for (const t of out) {
      const edges: [[number, number, number], [number, number, number], [number, number, number]][] = [
        [t.a, t.b, t.c],
        [t.b, t.c, t.a],
        [t.c, t.a, t.b],
      ]
      let done = false
      for (const [a, b, c] of edges) {
        if ((counts.get(keyOf(a, b)) ?? 0) !== 1) continue
        const ab = dist3(a, b)
        if (ab < eps) continue
        let hit: [number, number, number] | null = null
        let bestT = 2
        for (const p of verts) {
          if (!onSegment(p, a, b, eps)) continue
          const tval = dist3(a, p) / ab
          if (tval < bestT) {
            bestT = tval
            hit = p
          }
        }
        if (!hit) continue
        next.push({ n: t.n, a, b: hit, c }, { n: t.n, a: hit, b, c })
        split = true
        done = true
        break
      }
      if (!done) next.push(t)
    }
    out = next
    if (!split) break
  }
  return out
}

function dedupeTris(tris: Triangle[], eps: number): Triangle[] {
  const seen = new Set<string>()
  const out: Triangle[] = []
  for (const t of tris) {
    if (triArea2(t) < eps * eps * 1e-4) continue
    const keys = [vertKey(t.a, eps), vertKey(t.b, eps), vertKey(t.c, eps)].sort()
    const id = keys.join('|')
    if (seen.has(id)) continue
    seen.add(id)
    out.push(t)
  }
  return out
}

function triArea2(t: Triangle): number {
  const ux = t.b[0] - t.a[0]
  const uy = t.b[1] - t.a[1]
  const uz = t.b[2] - t.a[2]
  const vx = t.c[0] - t.a[0]
  const vy = t.c[1] - t.a[1]
  const vz = t.c[2] - t.a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  return nx * nx + ny * ny + nz * nz
}

function ringArea(ring: { x: number; y: number }[]): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    if (!p || !q) continue
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

/** Weld nearby vertices and cap leftover planar holes so slicers see a solid. */
export function repairMesh(tris: Triangle[], eps = 1e-4, maxCapArea = 0.5): Triangle[] {
  const welded: Triangle[] = []
  for (const t of tris) {
    const a = snapVert(t.a, eps)
    const b = snapVert(t.b, eps)
    const c = snapVert(t.c, eps)
    const next = { n: t.n, a, b, c }
    if (triArea2(next) < eps * eps * 1e-4) continue
    welded.push(next)
  }
  const split = dedupeTris(splitTJunctions(welded, eps), eps)
  type Edge = { a: [number, number, number]; b: [number, number, number] }
  const counts = new Map<string, { n: number; e: Edge }>()
  const keyOf = (p: [number, number, number], q: [number, number, number]) => {
    const ka = vertKey(p, eps)
    const kb = vertKey(q, eps)
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
  }
  for (const t of split) {
    for (const [p, q] of [
      [t.a, t.b],
      [t.b, t.c],
      [t.c, t.a],
    ] as [typeof t.a, typeof t.a][]) {
      const k = keyOf(p, q)
      const prev = counts.get(k)
      if (prev) prev.n += 1
      else counts.set(k, { n: 1, e: { a: p, b: q } })
    }
  }
  const open: Edge[] = []
  for (const v of counts.values()) {
    if (v.n === 1) open.push(v.e)
  }
  if (open.length < 3) return split
  const adj = new Map<string, [number, number, number][]>()
  const add = (p: [number, number, number], q: [number, number, number]) => {
    const k = vertKey(p, eps)
    const list = adj.get(k) ?? []
    list.push(q)
    adj.set(k, list)
  }
  for (const e of open) {
    add(e.a, e.b)
    add(e.b, e.a)
  }
  const usedEdges = new Set<string>()
  const caps: Triangle[] = []
  const take = (p: [number, number, number], from: string | null) => {
    const ns = adj.get(vertKey(p, eps)) ?? []
    for (const q of ns) {
      const ek = keyOf(p, q)
      if (usedEdges.has(ek)) continue
      if (from && vertKey(q, eps) === from) continue
      usedEdges.add(ek)
      return q
    }
    return null
  }
  for (const e of open) {
    const sk = keyOf(e.a, e.b)
    if (usedEdges.has(sk)) continue
    usedEdges.add(sk)
    const start = e.a
    const loop: [number, number, number][] = [start, e.b]
    let cur = e.b
    let prevK = vertKey(start, eps)
    let guard = 0
    while (guard++ < 4000) {
      if (vertKey(cur, eps) === vertKey(start, eps) && loop.length > 2) break
      const nxt = take(cur, prevK)
      if (!nxt) break
      prevK = vertKey(cur, eps)
      cur = nxt
      loop.push(cur)
    }
    if (loop.length >= 4 && vertKey(loop[0]!, eps) === vertKey(loop[loop.length - 1]!, eps)) {
      loop.pop()
    }
    if (loop.length < 3) continue
    const z0 = loop[0]?.[2]
    if (z0 === undefined || loop.some((p) => Math.abs(p[2] - z0) > eps * 2)) continue
    const ring = loop.map((p) => ({ x: p[0], y: p[1] }))
    if (ringArea(ring) > maxCapArea) continue
    caps.push(...capFaces(ring, [], z0, true, false))
  }
  return dedupeTris([...split, ...caps], eps)
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
 * Drop the original QR face and rebuild it once: plate minus holes minus modules.
 * Keeps the rest of the CAD mesh so the body is not stacked twice.
 */
export function stampPockets(
  tris: Triangle[],
  outline: Polygon,
  throughHoles: Polygon[],
  pockets: Polygon[],
  depth: number,
): Triangle[] {
  const rest = tris.filter((t) => !isQrFace(t))
  if (depth <= EPS || outline.length < 3) return rest
  const cuts = [...throughHoles, ...pockets].filter((p) => p.length >= 3)
  const plate = toClip(outline)
  const fill =
    cuts.length === 0
      ? [plate]
      : difference(
          plate,
          cuts.length === 1 ? toClip(cuts[0]) : union(toClip(cuts[0]), ...cuts.slice(1).map(toClip)),
        )
  const face: Triangle[] = []
  for (const poly of fill) {
    if (!poly[0] || poly[0].length < 3) continue
    face.push(
      ...capFaces(fromClip(poly[0]), poly.slice(1).map(fromClip), 0, false),
    )
  }
  const walls = pockets.flatMap((p) => ringWalls(p, 0, depth, false))
  const ceilings = pockets.flatMap((p) => capFaces(p, [], depth, false))
  return [...rest, ...face, ...walls, ...ceilings]
}
