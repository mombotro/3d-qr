import type { Point2, Polygon } from './shapes'

export function pointInPolygon(point: Point2, poly: Polygon): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + 0) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

function outward(a: Point2, b: Point2): Point2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dy / len, y: -dx / len }
}

function intersect(
  p1: Point2,
  d1: Point2,
  p2: Point2,
  d2: Point2,
): Point2 {
  const det = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(det) < 1e-12) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  }
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / det
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y }
}

export function signedArea(poly: Polygon): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

export function insetPolygon(poly: Polygon, insetMm: number): Polygon {
  if (insetMm === 0) return poly.map((p) => ({ ...p }))
  const area = signedArea(poly)
  const delta = area >= 0 ? -insetMm : insetMm
  return offsetPolygon(poly, delta)
}

/** Drop duplicate and collinear vertices so caps and walls share the same edges. */
export function cleanRing(poly: Polygon, eps = 1e-4): Polygon {
  if (poly.length < 3) return poly.map((p) => ({ ...p }))
  const dedup: Polygon = []
  for (const p of poly) {
    const last = dedup[dedup.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < eps) continue
    dedup.push({ x: p.x, y: p.y })
  }
  if (dedup.length > 1) {
    const a = dedup[0]
    const b = dedup[dedup.length - 1]
    if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < eps) dedup.pop()
  }
  if (dedup.length < 3) return dedup
  const out: Polygon = []
  for (let i = 0; i < dedup.length; i++) {
    const prev = dedup[(i - 1 + dedup.length) % dedup.length]
    const curr = dedup[i]
    const next = dedup[(i + 1) % dedup.length]
    if (!prev || !curr || !next) continue
    const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x)
    const span = Math.hypot(next.x - prev.x, next.y - prev.y) || 1
    if (Math.abs(cross) / span > eps) out.push(curr)
  }
  return out.length >= 3 ? out : dedup
}

export function offsetPolygon(poly: Polygon, delta: number): Polygon {
  if (poly.length < 3 || delta === 0) return poly.map((p) => ({ ...p }))
  const n = poly.length
  const out: Polygon = []
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n]
    const curr = poly[i]
    const next = poly[(i + 1) % n]
    const n1 = outward(prev, curr)
    const n2 = outward(curr, next)
    const p1 = { x: curr.x + n1.x * delta, y: curr.y + n1.y * delta }
    const p2 = { x: curr.x + n2.x * delta, y: curr.y + n2.y * delta }
    const d1 = { x: curr.x - prev.x, y: curr.y - prev.y }
    const d2 = { x: next.x - curr.x, y: next.y - curr.y }
    const hit = intersect(p1, d1, p2, d2)
    const miter = Math.hypot(hit.x - curr.x, hit.y - curr.y)
    if (miter > Math.abs(delta) * 3) {
      out.push(p1, p2)
    } else {
      out.push(hit)
    }
  }
  return out
}
