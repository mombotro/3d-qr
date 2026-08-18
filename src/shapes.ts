import { cardCornerMm } from './card'
import { ROUNDED_TAG_RADIUS, type PlateShape, type QrStyle } from './types'

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

export function roundedRectPoly(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  steps = 6,
): Polygon {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  const x1 = x + width
  const y1 = y + height
  if (r <= 1e-9) return rectPoly(x, y, width, height)
  return [
    ...arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, steps).slice(0, -1),
    ...arc(x1 - r, y + r, r, Math.PI * 1.5, Math.PI * 2, steps).slice(0, -1),
    ...arc(x1 - r, y1 - r, r, 0, Math.PI * 0.5, steps).slice(0, -1),
    ...arc(x + r, y1 - r, r, Math.PI * 0.5, Math.PI, steps).slice(0, -1),
  ]
}

export function roundedPoly(x: number, y: number, size: number, radiusRatio = 0.3): Polygon {
  return roundedRectPoly(x, y, size, size, size * radiusRatio, 4)
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

export function hexagonFlatTop(flatToFlat: number): Polygon {
  const R = flatToFlat / Math.sqrt(3)
  const cx = R
  const cy = flatToFlat / 2
  const pts: Polygon = []
  for (let k = 0; k < 6; k++) {
    const t = (Math.PI / 3) * k
    pts.push({ x: cx + R * Math.cos(t), y: cy + R * Math.sin(t) })
  }
  return pts
}

export function rectPoly(x: number, y: number, width: number, height: number): Polygon {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

export function stadiumPoly(x: number, y: number, width: number, height: number, segments = 16): Polygon {
  const r = Math.min(width, height) / 2
  if (width >= height) {
    const left = x + r
    const right = x + width - r
    const cy = y + height / 2
    return [
      ...arc(left, cy, r, Math.PI / 2, (Math.PI * 3) / 2, segments).slice(0, -1),
      ...arc(right, cy, r, -Math.PI / 2, Math.PI / 2, segments).slice(0, -1),
    ]
  }
  const cx = x + width / 2
  const top = y + r
  const bot = y + height - r
  return [
    ...arc(cx, top, r, Math.PI, Math.PI * 2, segments).slice(0, -1),
    ...arc(cx, bot, r, 0, Math.PI, segments).slice(0, -1),
  ]
}

export const DOGTAG_HOLE_DIAMETER_MM = 4
export const DOGTAG_HOLE_WALL_MM = 5

export function dogtagHole(
  widthMm: number,
  heightMm: number,
  diameterMm = DOGTAG_HOLE_DIAMETER_MM,
): { cx: number; cy: number; diameter: number; poly: Polygon } {
  const maxD = Math.min(12, Math.min(widthMm, heightMm) * 0.35)
  const diameter = Math.min(maxD, Math.max(2, diameterMm))
  const r = diameter / 2
  const inset = r + DOGTAG_HOLE_WALL_MM
  if (widthMm >= heightMm) {
    return { cx: inset, cy: heightMm / 2, diameter, poly: circlePoly(inset, heightMm / 2, diameter, 24) }
  }
  return { cx: widthMm / 2, cy: inset, diameter, poly: circlePoly(widthMm / 2, inset, diameter, 24) }
}

export function plateOutlineAt(shape: PlateShape, widthMm: number, heightMm: number): Polygon {
  if (shape === 'circle') return circlePoly(widthMm / 2, heightMm / 2, widthMm, 64)
  if (shape === 'rounded') return roundedPoly(0, 0, widthMm, ROUNDED_TAG_RADIUS)
  if (shape === 'hexagon') return hexagonFlatTop(heightMm)
  if (shape === 'rect' || shape === 'cassette') return rectPoly(0, 0, widthMm, heightMm)
  if (shape === 'card') return roundedRectPoly(0, 0, widthMm, heightMm, cardCornerMm(widthMm))
  if (shape === 'dogtag') return stadiumPoly(0, 0, widthMm, heightMm)
  return squarePoly(0, 0, widthMm)
}

export function plateFrameAt(
  shape: PlateShape,
  widthMm: number,
  heightMm: number,
  frameMm: number,
): { outer: Polygon; hole: Polygon } {
  const outer = plateOutlineAt(shape, widthMm, heightMm)
  const cx = widthMm / 2
  const cy = heightMm / 2
  if (shape === 'circle') {
    return { outer, hole: circlePoly(cx, cy, widthMm - 2 * frameMm, 64) }
  }
  if (shape === 'rounded') {
    const inner = widthMm - 2 * frameMm
    const radius = Math.max(0, ROUNDED_TAG_RADIUS * widthMm - frameMm)
    return { outer, hole: roundedPoly(frameMm, frameMm, inner, inner > 0 ? radius / inner : 0) }
  }
  if (shape === 'hexagon') {
    const half = heightMm / 2
    const factor = (half - frameMm) / half
    return {
      outer,
      hole: outer.map((p) => ({ x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor })),
    }
  }
  if (shape === 'dogtag') {
    return {
      outer,
      hole: stadiumPoly(frameMm, frameMm, widthMm - 2 * frameMm, heightMm - 2 * frameMm),
    }
  }
  if (shape === 'card') {
    const r = Math.max(0, cardCornerMm(widthMm) - frameMm)
    return {
      outer,
      hole: roundedRectPoly(
        frameMm,
        frameMm,
        widthMm - 2 * frameMm,
        heightMm - 2 * frameMm,
        r,
      ),
    }
  }
  return {
    outer,
    hole: rectPoly(frameMm, frameMm, widthMm - 2 * frameMm, heightMm - 2 * frameMm),
  }
}

export function frameRing(widthMm: number, frameMm: number): { outer: Polygon; hole: Polygon } {
  return plateFrameAt('square', widthMm, widthMm, frameMm)
}
