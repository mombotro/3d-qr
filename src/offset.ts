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
    out.push(intersect(p1, d1, p2, d2))
  }
  return out
}
