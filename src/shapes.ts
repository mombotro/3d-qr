import type { QrStyle } from './types'

export type Point2 = { x: number; y: number }
export type Polygon = Point2[]

export function squarePoly(x: number, y: number, size: number): Polygon {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ]
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps: number): Point2[] {
  const pts: Point2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

export function roundedPoly(x: number, y: number, size: number, radiusRatio = 0.3): Polygon {
  const r = size * radiusRatio
  const steps = 4
  const x1 = x + size
  const y1 = y + size
  return [
    ...arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, steps).slice(0, -1),
    ...arc(x1 - r, y + r, r, Math.PI * 1.5, Math.PI * 2, steps).slice(0, -1),
    ...arc(x1 - r, y1 - r, r, 0, Math.PI * 0.5, steps).slice(0, -1),
    ...arc(x + r, y1 - r, r, Math.PI * 0.5, Math.PI, steps).slice(0, -1),
  ]
}

export function circlePoly(cx: number, cy: number, diameter: number, segments = 24): Polygon {
  const r = diameter / 2
  const pts: Point2[] = []
  for (let i = 0; i < segments; i++) {
    const t = (Math.PI * 2 * i) / segments
    pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
  }
  return pts
}

export function modulePoly(
  style: QrStyle,
  x: number,
  y: number,
  size: number,
  isFinder: boolean,
): Polygon {
  if (isFinder || style === 'square') return squarePoly(x, y, size)
  if (style === 'rounded') return roundedPoly(x, y, size, 0.3)
  return circlePoly(x + size / 2, y + size / 2, size * 0.9)
}

export function frameRing(widthMm: number, frameMm: number): { outer: Polygon; hole: Polygon } {
  return {
    outer: squarePoly(0, 0, widthMm),
    hole: [
      { x: frameMm, y: frameMm },
      { x: widthMm - frameMm, y: frameMm },
      { x: widthMm - frameMm, y: widthMm - frameMm },
      { x: frameMm, y: widthMm - frameMm },
    ],
  }
}
