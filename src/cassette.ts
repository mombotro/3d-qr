import type { CustomPlate } from './contour'
import { circlePoly, roundedRectPoly, type Polygon } from './shapes'

/** From cassette.svg viewBox 288×180 and its two spindle holes. */
export const CASSETTE_VIEW_W = 288
export const CASSETTE_VIEW_H = 180
export const CASSETTE_ASPECT = CASSETTE_VIEW_H / CASSETTE_VIEW_W
export const CASSETTE_DEFAULT_WIDTH_MM = 100.8
export const CASSETTE_DEFAULT_HEIGHT_MM = CASSETTE_DEFAULT_WIDTH_MM * CASSETTE_ASPECT
export const CASSETTE_HEAD_STRIP_RAISE_MM = 1
export const CASSETTE_HEAD_STRIP_WIDTH_RATIO = 0.75
export const CASSETTE_HEAD_STRIP_HEIGHT_RATIO = 0.18
export const CASSETTE_HEAD_STRIP_TOP_CHAMFER_RATIO = 0.08
export const CASSETTE_CORNER_RATIO = 0.035

const HOLES = [
  { cx: 83.33090909090909 / CASSETTE_VIEW_W, cy: 77.48181818181818 / CASSETTE_VIEW_W },
  { cx: 203.6690909090909 / CASSETTE_VIEW_W, cy: 77.48181818181818 / CASSETTE_VIEW_W },
]
const HOLE_DIAMETER = 26 / CASSETTE_VIEW_W

export function cassettePlate(): CustomPlate {
  return {
    outer: roundedRectPoly(0, 0, 1, CASSETTE_ASPECT, CASSETTE_CORNER_RATIO),
    holes: HOLES.map((h) => circlePoly(h.cx, h.cy, HOLE_DIAMETER, 32)),
    aspect: CASSETTE_ASPECT,
    mask: [[true]],
    pixelBBox: { minX: 0, minY: 0, maxX: CASSETTE_VIEW_W, maxY: CASSETTE_VIEW_H },
  }
}

export function cassetteHeadStrip(widthMm: number, heightMm: number): Polygon {
  const w = widthMm * CASSETTE_HEAD_STRIP_WIDTH_RATIO
  const h = heightMm * CASSETTE_HEAD_STRIP_HEIGHT_RATIO
  const x0 = (widthMm - w) / 2
  const x1 = x0 + w
  const yTop = heightMm - h
  const yBottom = heightMm
  const chamfer = Math.min(w * CASSETTE_HEAD_STRIP_TOP_CHAMFER_RATIO, h * 0.45)
  return [
    { x: x0 + chamfer, y: yTop },
    { x: x1 - chamfer, y: yTop },
    { x: x1, y: yTop + chamfer },
    { x: x1, y: yBottom },
    { x: x0, y: yBottom },
    { x: x0, y: yTop + chamfer },
  ]
}
