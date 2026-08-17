import earcut from 'earcut'
import type { Polygon } from './shapes'

export type Triangle = {
  n: [number, number, number]
  a: [number, number, number]
  b: [number, number, number]
  c: [number, number, number]
}

function tri(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): Triangle {
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
  return { n: [nx / len, ny / len, nz / len], a, b, c }
}

function flatten(outer: Polygon, holes: Polygon[]): { verts: number[]; holeStarts: number[] } {
  const verts: number[] = []
  const holeStarts: number[] = []
  for (const p of outer) {
    verts.push(p.x, p.y)
  }
  for (const hole of holes) {
    holeStarts.push(verts.length / 2)
    for (const p of hole) {
      verts.push(p.x, p.y)
    }
  }
  return { verts, holeStarts }
}

function wall(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
  outward: boolean,
): Triangle[] {
  const b0: [number, number, number] = [x0, y0, z0]
  const b1: [number, number, number] = [x1, y1, z0]
  const t0: [number, number, number] = [x0, y0, z1]
  const t1: [number, number, number] = [x1, y1, z1]
  if (outward) {
    return [tri(b0, b1, t1), tri(b0, t1, t0)]
  }
  return [tri(b0, t1, b1), tri(b0, t0, t1)]
}

function ringWalls(ring: Polygon, z0: number, z1: number, outward: boolean): Triangle[] {
  const out: Triangle[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    out.push(...wall(a.x, a.y, b.x, b.y, z0, z1, outward))
  }
  return out
}

export function extrudeRing(outer: Polygon, holes: Polygon[], z0: number, z1: number): Triangle[] {
  const { verts, holeStarts } = flatten(outer, holes)
  const index = earcut(verts, holeStarts.length ? holeStarts : undefined, 2)
  const tris: Triangle[] = []
  for (let i = 0; i < index.length; i += 3) {
    const ia = index[i] * 2
    const ib = index[i + 1] * 2
    const ic = index[i + 2] * 2
    const ax = verts[ia]
    const ay = verts[ia + 1]
    const bx = verts[ib]
    const by = verts[ib + 1]
    const cx = verts[ic]
    const cy = verts[ic + 1]
    tris.push(
      tri([ax, ay, z1], [bx, by, z1], [cx, cy, z1]),
      tri([ax, ay, z0], [cx, cy, z0], [bx, by, z0]),
    )
  }
  tris.push(...ringWalls(outer, z0, z1, true))
  for (const hole of holes) {
    tris.push(...ringWalls(hole, z0, z1, false))
  }
  return tris
}
